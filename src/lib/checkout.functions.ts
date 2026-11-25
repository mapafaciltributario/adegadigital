import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { COMBO, PLANS, bumpLines, mapOrderStatus, offerMatchesPlan, onlyDigits, phoneToE164, pixRequestSchema, isValidCPF, type PlanId } from "./checkout-core";

const plain = (msg: string) => ({ ok: false as const, error: msg });

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pixRequestSchema.parse(d))
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
      const ip = getRequestHeader("cf-connecting-ip");
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

/** Status comes from Cakto, never from the URL. Returns no personal data. */
export const getPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getOrder, CaktoError } = await import("./cakto.server");
    try {
      const o = await getOrder(data.orderId);
      return { ok: true as const, state: mapOrderStatus(o.status), refId: o.refId ?? null };
    } catch (e) {
      if (e instanceof CaktoError && e.status === 404) return { ok: true as const, state: "unknown" as const, refId: null };
      return { ok: false as const, state: "unknown" as const, refId: null };
    }
  });

/** Card payments use Cakto's hosted checkout (card data never touches this app). */
export const getHostedCheckoutUrl = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ plan: z.enum(["completo", "especial", "basico"]) }).parse(d))
  .handler(async ({ data }) => {
    const offerId = process.env[PLANS[data.plan as PlanId].envOffer];
    if (!offerId) return { url: null };
    return { url: `https://pay.cakto.com.br/${encodeURIComponent(offerId)}` };
  });
