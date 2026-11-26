import { createFileRoute } from "@tanstack/react-router";

// Cakto webhook. Authenticates the caller (secret in the JSON body, or the v1 HMAC header) and
// re-checks the order at Cakto. Forwards verified sale status to LowTrack.
// It never grants access (Cakto delivers the product) and does not send Purchase: the server
// Purchase goes out from the approved screen with the buyer's consent and match data.

async function sameSecret(a: string, b: string) {
  // Compare SHA-256 digests in constant time (Web Crypto; works on Workers).
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let r = 0;
  for (let i = 0; i < u.length; i++) r |= (u[i] ?? 0) ^ (v[i] ?? 0);
  return r === 0;
}

const MAX_BODY = 256 * 1024;
const STATUS_EVENTS = new Set(["purchase_approved", "purchase_refused", "refund", "chargeback", "pix_gerado"]);

export const Route = createFileRoute("/api/public/cakto-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CAKTO_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > MAX_BODY) return new Response("too large", { status: 413 });
        let payload: { secret?: unknown; event?: unknown; data?: unknown };
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        if (!payload || typeof payload !== "object") return new Response("bad json", { status: 400 });

        const { verifyCaktoSignature, getOrder } = await import("@/lib/cakto.server");
        const bodyOk = typeof payload.secret === "string" && (await sameSecret(payload.secret, secret));
        const headerOk = !bodyOk && (await verifyCaktoSignature(raw, request.headers.get("x-cakto-timestamp"), request.headers.get("x-cakto-signature"), secret));
        if (!bodyOk && !headerOk) return new Response("unauthorized", { status: 401 });

        const event = typeof payload.event === "string" ? payload.event.slice(0, 64) : "";
        const items = (Array.isArray(payload.data) ? payload.data : [payload.data]).slice(0, 50) as Array<import("@/lib/lowtrack.server").WebhookOrder | undefined>;
        for (const d of items) {
          const id = typeof d?.id === "string" && /^[0-9a-f-]{36}$/i.test(d.id) ? d.id : null;
          if (!id || !STATUS_EVENTS.has(event)) continue; // e.g. checkout_abandonment has no order id
          try {
            const order = await getOrder(id); // never trust the payload's status
            const { forwardLowTrack } = await import("@/lib/lowtrack.server");
            await forwardLowTrack(event, order, d!);
            console.log("cakto webhook", { event, orderId: id, confirmedStatus: order.status });
          } catch {
            console.error("cakto webhook: order lookup or LowTrack delivery failed", { event, orderId: id });
            return new Response("retry", { status: 502 });
          }
        }
        return new Response("ok");
      },
    },
  },
});
