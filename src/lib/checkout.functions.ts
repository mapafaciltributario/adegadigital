import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { buildPurchaseEvent, money, normalizeEmail, normalizePhone, purchaseEventId, sha256Hex } from "./tracking/core";
import { z } from "zod";
import { clientIp } from "./request-ip";
import { COMBO, PLANS, bumpLines, mapOrderStatus, offerMatchesPlan, onlyDigits, phoneToE164, pixRequestSchema, isValidCPF, type PlanId } from "./checkout-core";

/** Attribution parameters forwarded to the Cakto hosted checkout so card sales keep their source. */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"] as const;
const plain = (msg: string) => ({ ok: false as const, error: msg });
const trackingSchema = z.object({
  consent: z.boolean(),
  fbp: z.string().max(200).regex(/^fb\.\d\.\d+\.\d+$/).optional(),
  fbc: z.string().max(400).regex(/^fb\.\d\.\d+\..+$/).optional(),
  sourceUrl: z.string().url().max(500).optional(),
}).default({ consent: false });

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pixRequestSchema.extend({ tracking: trackingSchema }).parse(d))
  .handler(async ({ data }) => {
    const { getOffer, createPixPayment, CaktoError } = await import("./cakto.server");
    const offerId = process.env[PLANS[data.plan].envOffer];
    if (!offerId || !process.env["CAKTO_CLIENT_ID"]) return plain("Pagamento ainda não configurado. Tente novamente mais tarde.");
    try {
      const offer = await getOffer(offerId);
      if (!offerMatchesPlan(offer, data.plan)) {
        console.error("cakto: offer/price mismatch", { plan: data.plan, offerStatus: offer.status });
        return plain("Esta oferta está indisponível no momento.");
      }
      const { items: picked, combo } = bumpLines(data.bumps);
      const bumpOffers: { id: string; price: number }[] = [];
      for (const b of combo ? [{ envOffer: COMBO.envOffer, price: COMBO.price }] : picked) {
        const id = process.env[b.envOffer];
        if (!id) return plain("Um dos produtos adicionais está indisponível. Remova-o e tente novamente.");
        const o = await getOffer(id);
        if (o.status !== "active" || Math.abs(o.price - b.price) >= 0.005) {
          console.error("cakto: bump price mismatch", { bump: b.envOffer });
          return plain("Um dos produtos adicionais está indisponível. Remova-o e tente novamente.");
        }
        bumpOffers.push({ id, price: b.price });
      }
      const doc = onlyDigits(data.customer.doc);
      const ip = clientIp(getRequestHeader);
      const pay = await createPixPayment({
        paymentMethod: "pix",
        customer: {
          name: data.customer.name.trim(), email: data.customer.email.trim().toLowerCase(),
          phone: phoneToE164(data.customer.phone), fingerprint: data.fingerprint,
          docType: isValidCPF(doc) ? "cpf" : "cnpj", docNumber: doc, ...(ip ? { ip } : {}),
        },
        items: [{ offerId, quantity: 1, offerType: "main" }, ...bumpOffers.map((b) => ({ offerId: b.id, quantity: 1, offerType: "orderbump" }))],
        pixExpiresIn: 1800,
      }, data.idempotencyKey);
      return { ok: true as const, orderId: pay.id, refId: pay.refId, amount: Number(pay.amount), qrCode: pay.pix.qrCode, expiresAt: pay.pix.expirationDate, state: mapOrderStatus(pay.status) };
    } catch (e) {
      if (e instanceof CaktoError) {
        console.error("cakto: create pix failed", e.status); // no PII in logs
        if (e.status === 409) return plain("Seu pagamento já está sendo processado. Aguarde alguns segundos.");
        if (e.status === 429) return plain("Muitas tentativas. Aguarde um minuto e tente de novo.");
        if (e.status === 400 || e.status === 422) return plain("Não foi possível gerar o Pix com esses dados. Confira e tente novamente.");
      } else console.error("cakto: unexpected error", (e as Error).message);
      return plain("Não conseguimos falar com o processador de pagamento. Tente novamente.");
    }
  });

/**
 * Status comes from Cakto, never from the URL. Returns no personal data.
 * The members-area link and the Purchase payload are returned only when Cakto reports "paid";
 * the value is Cakto's order amount.
 */
export const getPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getOrder, CaktoError } = await import("./cakto.server");
    const none = { accessUrl: null, purchase: null };
    try {
      const o = await getOrder(data.orderId);
      const state = mapOrderStatus(o.status);
      if (state !== "approved") return { ok: true as const, state, refId: o.refId ?? null, ...none };
      const accessUrl = process.env["APP_ACCESS_URL"] ?? null;
      const value = Number(o.amount);
      return {
        ok: true as const, state, refId: o.refId ?? null,
        accessUrl: accessUrl && /^https:\/\//.test(accessUrl) ? accessUrl : null,
        purchase: Number.isFinite(value) && value > 0
          ? { orderId: data.orderId, eventId: purchaseEventId(data.orderId), value: money(value), currency: "BRL" as const }
          : null,
      };
    } catch (e) {
      if (e instanceof CaktoError && e.status === 404) return { ok: true as const, state: "unknown" as const, refId: null, ...none };
      return { ok: false as const, state: "unknown" as const, refId: null, ...none };
    }
  });

/**
 * Server half of Purchase (Conversions API). Called by the approved screen once per tab, only
 * with consent. Re-checks Cakto: sends only for a paid order, at Cakto's amount, with the stable
 * id purchase_{orderId}, so repeats (other tabs, reloads) are deduplicated by Meta.
 */
export const sendPurchaseEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    plan: z.enum(["completo", "especial", "basico"]).optional(),
    tracking: trackingSchema,
    customer: z.object({ email: z.string().max(255).optional(), phone: z.string().max(40).optional() }).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    if (!data.tracking.consent) return { ok: false as const };
    const { getOrder } = await import("./cakto.server");
    const { sendCapiEvent } = await import("./meta-capi.server");
    const o = await getOrder(data.orderId).catch(() => null);
    if (!o) return { ok: false as const };
    const ip = clientIp(getRequestHeader);
    const ua = getRequestHeader("user-agent")?.slice(0, 400);
    const email = data.customer?.email?.trim();
    const e164 = data.customer?.phone ? phoneToE164(data.customer.phone) : null;
    const t = data.tracking;
    const ev = buildPurchaseEvent({ id: data.orderId, status: o.status, amount: o.amount ?? null, paidAt: o.paidAt ?? null }, {
      nowSec: Math.floor(Date.now() / 1000), ...(t.sourceUrl ? { sourceUrl: t.sourceUrl } : {}), ...(data.plan ? { contentId: data.plan } : {}),
      user_data: {
        ...(ip ? { client_ip_address: ip } : {}), ...(ua ? { client_user_agent: ua } : {}),
        ...(t.fbp ? { fbp: t.fbp } : {}), ...(t.fbc ? { fbc: t.fbc } : {}),
        ...(email && /@/.test(email) ? { em: [await sha256Hex(normalizeEmail(email))] } : {}),
        ...(e164 ? { ph: [await sha256Hex(normalizePhone(e164))] } : {}),
      },
    });
    if (!ev) return { ok: false as const };
    return { ok: (await sendCapiEvent(ev)).ok };
  });

/** Card payments use Cakto's hosted checkout (card data never touches this app). */
export const getHostedCheckoutUrl = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    plan: z.enum(["completo", "especial", "basico"]),
    utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const offerId = process.env[PLANS[data.plan as PlanId].envOffer];
    if (!offerId) return { url: null };
    const u = new URL(`https://pay.cakto.com.br/${encodeURIComponent(offerId)}`);
    for (const [k, v] of Object.entries(data.utm ?? {})) if (v) u.searchParams.set(k, v);
    return { url: u.toString() };
  });
