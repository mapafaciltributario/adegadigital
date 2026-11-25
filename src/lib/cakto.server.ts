// Server-only Cakto client. Docs: https://docs.cakto.com.br
const BASE = "https://api.cakto.com.br/public_api";

export class CaktoError extends Error {
  constructor(public status: number, public body: unknown) { super(`Cakto API ${status}`); }
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// Docs: reuse the token until it expires (default 10h); requesting one per call hits 429.
let cached: { token: string; exp: number } | null = null;
async function getToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("CAKTO_CLIENT_ID"), client_secret: env("CAKTO_CLIENT_SECRET") }),
  });
  if (!res.ok) throw new CaktoError(res.status, await safeJson(res));
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function safeJson(res: Response) { try { return await res.json(); } catch { return null; } }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) cached = null;
  if (!res.ok) throw new CaktoError(res.status, await safeJson(res));
  return (await res.json()) as T;
}

export type CaktoOffer = { id: string; name: string; price: number; status: string; product: string };
export const getOffer = (id: string) => call<CaktoOffer>(`/offers/${encodeURIComponent(id)}/`);

export type CaktoPixPayment = {
  id: string; refId: string; status: string; amount: string; checkoutUrl?: string;
  offer: { id: string; name: string; price: number }; pix: { qrCode: string; expirationDate: string };
};
export function createPixPayment(body: unknown, idempotencyKey: string) {
  return call<CaktoPixPayment>(`/payments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

export type CaktoOrder = { id: string; refId?: string; status: string; amount?: number | string | null; product?: { name?: string } | string };
export const getOrder = (id: string) => call<CaktoOrder>(`/orders/${encodeURIComponent(id)}/`);

/** HMAC-SHA256 of "{timestamp}.{rawBody}" compared with X-Cakto-Signature "v1=<hex>" (Web Crypto, runs on Workers). */
export async function verifyCaktoSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string, nowSec = Date.now() / 1000) {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSec - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const expected = "v1=" + Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const candidates = signature.split(",").map((s) => s.trim());
  return candidates.some((c) => timingSafeEqual(c, expected));
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
