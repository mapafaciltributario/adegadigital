import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { clientIp } from "./request-ip";
import { BROWSER_EVENTS } from "./tracking/core";

/**
 * Server half of browser events (same event_id as the Pixel → Meta deduplicates).
 * Only non-purchase events; values come from the server price table, not the client.
 * The browser calls this only after consent was granted.
 */
export const sendBrowserEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    name: z.enum(BROWSER_EVENTS),
    eventId: z.string().regex(/^[a-z]+_[0-9a-f-]{36}$/),
    plan: z.enum(["completo", "especial", "basico"]).optional(),
    sourceUrl: z.string().url().max(500),
    fbp: z.string().max(200).optional(),
    fbc: z.string().max(400).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { sendCapiEvent } = await import("./meta-capi.server");
    const { PLANS } = await import("./checkout-core");
    const ip = clientIp(getRequestHeader);
    const ua = getRequestHeader("user-agent");
    const r = await sendCapiEvent({
      event_name: data.name, event_id: data.eventId, event_time: Math.floor(Date.now() / 1000),
      action_source: "website", event_source_url: data.sourceUrl,
      user_data: { ...(ip ? { client_ip_address: ip } : {}), ...(ua ? { client_user_agent: ua.slice(0, 400) } : {}), ...(data.fbp ? { fbp: data.fbp } : {}), ...(data.fbc ? { fbc: data.fbc } : {}) },
      ...(data.plan ? { custom_data: { currency: "BRL" as const, value: PLANS[data.plan].price, content_ids: [data.plan], content_type: "product" as const } } : {}),
    });
    return { ok: r.ok };
  });
