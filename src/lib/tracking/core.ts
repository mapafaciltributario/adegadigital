// Pure, browser-safe tracking rules shared by the page, the server and the tests.

/** Events this app sends itself. Purchase is never sent from a click: only after Cakto reports "paid". */
export const BROWSER_EVENTS = ["PageView", "ViewContent", "InitiateCheckout", "AddPaymentInfo"] as const;
export type BrowserEvent = (typeof BROWSER_EVENTS)[number];
export type MetaEvent = BrowserEvent | "Purchase";

/** Same id in the Pixel (eventID) and in the Conversions API (event_id) → Meta keeps one. */
export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;
export const newEventId = (name: string) => `${name.toLowerCase()}_${crypto.randomUUID()}`;

/** Only retry what can succeed later: network failures, 429 and 5xx. */
export const shouldRetry = (status: number | null) => status === null || status === 429 || status >= 500;

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const normalizePhone = (e164: string) => e164.replace(/\D/g, "");

export async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** fbc from a fbclid in the URL, per Meta's format fb.1.{ms}.{fbclid}. */
export const fbcFromClickId = (fbclid: string, nowMs: number) => `fb.1.${nowMs}.${fbclid}`;

export type CapiUserData = { client_ip_address?: string; client_user_agent?: string; fbp?: string; fbc?: string; em?: string[]; ph?: string[] };
export type CapiEvent = {
  event_name: MetaEvent; event_id: string; event_time: number; event_source_url?: string;
  action_source: "website"; user_data: CapiUserData;
  custom_data?: { currency: "BRL"; value: number; content_ids?: string[]; content_type?: "product"; order_id?: string };
};

/** Meta rejects website events without at least one customer-information field. */
export const hasMatchKey = (u: CapiUserData) => !!(u.client_ip_address && u.client_user_agent) || !!u.fbp || !!u.fbc || !!u.em?.length || !!u.ph?.length;

/** Round money to cents; Meta expects a number in BRL, not a formatted string. */
export const money = (v: number) => Math.round(v * 100) / 100;

/**
 * Server Purchase from a Cakto order. Returns null unless Cakto says "paid" with a real amount:
 * nothing is ever sent from a click, a URL or a browser-supplied value.
 */
export function buildPurchaseEvent(
  order: { id: string; status: string; amount?: number | string | null; paidAt?: string | null },
  ctx: { user_data: CapiUserData; sourceUrl?: string; contentId?: string; nowSec: number },
): CapiEvent | null {
  const value = Number(order.amount);
  if (order.status !== "paid" || !Number.isFinite(value) || value <= 0) return null;
  const paid = order.paidAt ? Math.floor(Date.parse(order.paidAt) / 1000) : NaN;
  return {
    event_name: "Purchase", event_id: purchaseEventId(order.id),
    // Meta rejects event_time in the future or older than 7 days.
    event_time: Number.isFinite(paid) && paid <= ctx.nowSec && paid > ctx.nowSec - 6 * 86400 ? paid : ctx.nowSec,
    action_source: "website", ...(ctx.sourceUrl ? { event_source_url: ctx.sourceUrl } : {}),
    user_data: ctx.user_data,
    custom_data: { currency: "BRL", value: money(value), order_id: order.id, ...(ctx.contentId ? { content_ids: [ctx.contentId], content_type: "product" as const } : {}) },
  };
}
