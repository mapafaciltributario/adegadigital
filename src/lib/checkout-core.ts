// Pure, browser-safe checkout rules shared by the page, the server and the tests.
import { z } from "zod";

export const PLANS = {
  completo: { name: "Kit Completo +180 Receitas", price: 24.9, envOffer: "CAKTO_OFFER_ID_COMPLETO" },
  especial: { name: "Oferta Especial — 180 Receitas + Bônus", price: 17.9, envOffer: "CAKTO_OFFER_ID_ESPECIAL" },
  basico: { name: "50 Receitas de Copão Gourmet", price: 10, envOffer: "CAKTO_OFFER_ID_BASICO" },
} as const;
export type PlanId = keyof typeof PLANS;
export const planIds = Object.keys(PLANS) as PlanId[];
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;

export const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function maskDoc(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCPF(raw: string) {
  const c = onlyDigits(raw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}
export function isValidCNPJ(raw: string) {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((a, x, i) => a + x * Number(c[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** Brazilian mobile (DDD + 9 digits) → E.164 without "+", as Cakto expects. */
export function phoneToE164(raw: string) {
  const d = onlyDigits(raw);
  return /^[1-9]{2}9\d{8}$/.test(d) ? `55${d}` : null;
}

export const customerSchema = z.object({
  name: z.string().trim().min(5, "Informe seu nome completo").max(120, "Nome muito longo")
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  phone: z.string().refine((v) => phoneToE164(v) !== null, "Celular inválido. Use DDD + número"),
  doc: z.string().refine((v) => isValidCPF(v) || isValidCNPJ(v), "CPF ou CNPJ inválido"),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const pixRequestSchema = z.object({
  plan: z.enum(["completo", "especial", "basico"]),
  customer: customerSchema,
  bumps: z.array(z.enum(["zero", "etiquetas", "canva", "precificadora"])).max(4).default([]),
  idempotencyKey: z.string().uuid(),
  fingerprint: z.string().min(8).max(100),
});

export type PaymentState = "approved" | "pending" | "refused" | "refunded" | "unknown";
/** Cakto order status → what the buyer sees. Only "paid" counts as approved. */
export function mapOrderStatus(status: string): PaymentState {
  if (status === "paid") return "approved";
  if (["waiting_payment", "processing", "authorized", "partially_paid", "retrying", "scheduled"].includes(status)) return "pending";
  if (["refused", "blocked", "canceled"].includes(status)) return "refused";
  if (["refunded", "refund_requested", "in_settlement", "chargedback", "prechargeback"].includes(status)) return "refunded";
  return "unknown";
}

/** Server-side price check: the Cakto offer must be active and match the advertised price. */
export function offerMatchesPlan(offer: { status?: string; price?: number }, plan: PlanId) {
  return offer.status === "active" && typeof offer.price === "number" && Math.abs(offer.price - PLANS[plan].price) < 0.005;
}

/** Order bumps offered on every plan. "combo" = all four with 35% off, charged as one Cakto offer. */
export const BUMPS = [
  { id: "zero", name: "25 Receitas de Copões Zero Açúcar", desc: "Uma alternativa para quem quer reduzir o açúcar sem abrir mão do sabor e da cremosidade.", from: 9.9, price: 6.9, envOffer: "CAKTO_BUMP_ZERO" },
  { id: "etiquetas", name: "Etiquetas em PDF: Prontas para Imprimir", desc: "Deixe seus copões mais profissionais, organizados e com apresentação gourmet.", from: 8.9, price: 5.9, envOffer: "CAKTO_BUMP_ETIQUETAS" },
  { id: "canva", name: "Cardápio Personalizável no Canva", desc: "Cardápio pronto para editar com seus sabores e preços e divulgar no WhatsApp.", from: 9.9, price: 6.9, envOffer: "CAKTO_BUMP_CANVA" },
  { id: "precificadora", name: "Precificadora/Calculadora Inteligente", desc: "Uma ferramenta para não ficar perdido na hora de precificar e calcular o financeiro do seu negócio.", from: 15, price: 5.9, envOffer: "CAKTO_BUMP_PRECIFICADORA" },
] as const;
export type BumpId = (typeof BUMPS)[number]["id"];
export const bumpIds = BUMPS.map((b) => b.id) as BumpId[];
export const COMBO = { price: 16.64, envOffer: "CAKTO_BUMP_COMBO" } as const;
export const COMBO_FULL = Math.round(BUMPS.reduce((a, b) => a + b.price, 0) * 100) / 100;

/** Picking all four bumps always applies the combo price. */
export function bumpLines(selected: readonly string[]) {
  const sel = BUMPS.filter((b) => selected.includes(b.id));
  const combo = sel.length === BUMPS.length;
  const total = combo ? COMBO.price : Math.round(sel.reduce((a, b) => a + b.price, 0) * 100) / 100;
  return { items: sel, combo, total };
}
export const orderTotal = (plan: PlanId, selected: readonly string[]) => Math.round((PLANS[plan].price + bumpLines(selected).total) * 100) / 100;

/** What the main product includes (shown in the order summary). The R$10 plan has no bonus. */
export const PLAN_INCLUDES: Record<PlanId, string[]> = {
  completo: ["Tabela de precificação", "Roteiro de vendas no WhatsApp", "Videoaula: embalar e apresentar", "40 receitas de batidas na garrafa"],
  especial: ["Tabela de precificação", "Roteiro de vendas no WhatsApp", "Videoaula: embalar e apresentar", "PDF baixável das receitas"],
  basico: [],
};
