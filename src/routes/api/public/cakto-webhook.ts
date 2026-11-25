import { createFileRoute } from "@tanstack/react-router";

// Cakto webhook. Validates X-Cakto-Signature (HMAC of "{ts}.{raw body}"), re-checks the
// order status at Cakto, and is idempotent: it only logs ids/status and never grants access
// itself — Cakto delivers the product to the buyer after the payment is "paid".
const seen = new Set<string>(); // best-effort per-isolate dedupe; handler has no side effects to repeat

export const Route = createFileRoute("/api/public/cakto-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CAKTO_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        const { verifyCaktoSignature, getOrder } = await import("@/lib/cakto.server");
        const ok = await verifyCaktoSignature(raw, request.headers.get("x-cakto-timestamp"), request.headers.get("x-cakto-signature"), secret);
        if (!ok) return new Response("unauthorized", { status: 401 });

        let payload: { event?: string; data?: unknown };
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        const event = String(payload.event ?? "");
        const items = (Array.isArray(payload.data) ? payload.data : [payload.data]) as Array<{ id?: string; status?: string } | undefined>;

        for (const d of items) {
          const id = d?.id;
          if (!id) continue; // checkout_abandonment has no id
          const key = `${event}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (event === "purchase_approved") {
            try {
              const order = await getOrder(id);
              console.log("cakto webhook", { event, orderId: id, confirmedStatus: order.status });
            } catch { console.log("cakto webhook", { event, orderId: id, confirmedStatus: "lookup_failed" }); }
          } else console.log("cakto webhook", { event, orderId: id, status: d?.status });
        }
        return new Response("ok");
      },
    },
  },
});
