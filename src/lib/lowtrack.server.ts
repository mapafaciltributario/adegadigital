import type { CaktoOrder } from "./cakto.server";

export type WebhookOrder = {
  id?: unknown; amount?: number | string; paymentMethod?: string;
  product?: { name?: string }; customer?: { name?: string; email?: string; phone?: string };
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string;
  fbp?: string; fbc?: string;
};

export async function forwardLowTrack(event: string, order: CaktoOrder, data: WebhookOrder) {
  const status = order.status;
  const sale = event === "pix_gerado" && ["waiting_payment", "processing", "authorized", "partially_paid", "retrying", "scheduled"].includes(status) ? "sale.pending"
    : event === "purchase_approved" && status === "paid" ? "sale.approved"
    : ["refund", "chargeback"].includes(event) && ["refunded", "chargedback", "chargeback"].includes(status) ? "sale.refunded" : null;
  if (!sale) { console.warn("lowtrack: status skipped", { event, status }); return; }
  const token = process.env["LOWTRACK_API_TOKEN"]?.trim();
  if (!token) throw new Error("LOWTRACK_API_TOKEN missing");
  const rawAmount = order.amount ?? data.amount;
  const amount = Number(rawAmount);
  if (rawAmount == null || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid order amount");
  const name = data.customer?.name?.trim();
  const [first, ...rest] = (name ?? "").split(/\s+/);
  const response = await fetch("https://lowtrack.com.br/api/webhook", {
    method: "POST", signal: AbortSignal.timeout(5000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event: sale, transaction_id: order.id, amount, currency: "BRL",
      payment_method: data.paymentMethod ?? (event === "pix_gerado" ? "pix" : undefined),
      product: { name: (typeof order.product === "object" ? order.product?.name : undefined) ?? data.product?.name },
      customer: { name, first_name: first || undefined, last_name: rest.join(" ") || undefined, email: data.customer?.email, phone: data.customer?.phone, country: "br" },
      tracking: { utm_source: data.utm_source, utm_medium: data.utm_medium, utm_campaign: data.utm_campaign, utm_content: data.utm_content, utm_term: data.utm_term, fbp: data.fbp, fbc: data.fbc },
      metadata: { platform: "cakto_checkout_proprio" }
    })
  });
  if (!response.ok) throw new Error(`LowTrack HTTP ${response.status}`);
  console.info("lowtrack: delivered", { event: sale, orderId: order.id, httpStatus: response.status });
}
