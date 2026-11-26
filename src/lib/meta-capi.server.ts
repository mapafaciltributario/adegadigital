// Server-only Meta Conversions API client. Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
import { hasMatchKey, shouldRetry, type CapiEvent } from "./tracking/core";

const GRAPH_VERSION = "v23.0";
const DELAYS = [400, 1500]; // 3 attempts in total, kept short so request handlers stay fast

export type CapiResult = { ok: true } | { ok: false; reason: "not_configured" | "no_match_key" | "rejected" | "unavailable"; status?: number };

export async function sendCapiEvent(event: CapiEvent, fetchImpl: typeof fetch = fetch): Promise<CapiResult> {
  const pixel = process.env["META_PIXEL_ID"];
  const token = process.env["META_CAPI_ACCESS_TOKEN"];
  if (!pixel || !token) return { ok: false, reason: "not_configured" };
  if (!hasMatchKey(event.user_data)) return { ok: false, reason: "no_match_key" };
  const testCode = process.env["META_TEST_EVENT_CODE"]; // set only while testing: events go to Events Manager → Test events
  const body = JSON.stringify({ data: [event], ...(testCode ? { test_event_code: testCode } : {}) });
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`;

  let status: number | null = null;
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      status = res.status;
      if (res.ok) return { ok: true };
    } catch { status = null; }
    if (!shouldRetry(status) || attempt === DELAYS.length) break;
    await new Promise((r) => setTimeout(r, DELAYS[attempt]));
  }
  // Log the outcome only: never the token, the payload or personal data.
  console.error("meta capi: send failed", { event: event.event_name, status });
  return { ok: false, reason: status && !shouldRetry(status) ? "rejected" : "unavailable", ...(status ? { status } : {}) };
}
