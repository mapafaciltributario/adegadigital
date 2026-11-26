import { describe, expect, it, vi, afterEach } from "vitest";
import { hasMatchKey, purchaseEventId, sha256Hex, shouldRetry } from "@/lib/tracking/core";
import { sendCapiEvent } from "@/lib/meta-capi.server";

const ev = { event_name: "Purchase" as const, event_id: purchaseEventId("abc"), event_time: 1, action_source: "website" as const, user_data: { fbp: "fb.1.1.1" }, custom_data: { currency: "BRL" as const, value: 24.9 } };

afterEach(() => { vi.unstubAllEnvs(); });

describe("deduplication ids", () => {
  it("Pixel and CAPI use the same Purchase id per order", () => {
    expect(purchaseEventId("abc")).toBe("purchase_abc");
    expect(purchaseEventId("abc")).toBe(purchaseEventId("abc"));
  });
});

describe("conversions api", () => {
  it("hashes e-mail with SHA-256 hex", async () => {
    expect(await sha256Hex("a@b.com")).toBe("fb98d44ad7501a959f3f4f4a3f004fe2d9e581ea6207e218c4b02c08a4d75adf");
  });
  it("retries only network, 429 and 5xx", () => {
    expect(shouldRetry(null)).toBe(true);
    expect(shouldRetry(429)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
    expect(shouldRetry(400)).toBe(false);
  });
  it("requires a customer match key", () => {
    expect(hasMatchKey({})).toBe(false);
    expect(hasMatchKey({ client_ip_address: "1.1.1.1", client_user_agent: "x" })).toBe(true);
  });
  it("does nothing when not configured", async () => {
    const f = vi.fn();
    expect(await sendCapiEvent(ev, f)).toEqual({ ok: false, reason: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });
  it("retries a 500 then succeeds, and does not retry a 400", async () => {
    vi.stubEnv("META_PIXEL_ID", "1"); vi.stubEnv("META_CAPI_ACCESS_TOKEN", "t");
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await sendCapiEvent(ev, f)).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
    const g = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    expect((await sendCapiEvent(ev, g)).ok).toBe(false);
    expect(g).toHaveBeenCalledTimes(1);
  });
  it("sends BRL value and test code when set", async () => {
    vi.stubEnv("META_PIXEL_ID", "1"); vi.stubEnv("META_CAPI_ACCESS_TOKEN", "t"); vi.stubEnv("META_TEST_EVENT_CODE", "TEST1");
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCapiEvent(ev, f);
    const body = JSON.parse((f.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.test_event_code).toBe("TEST1");
    expect(body.data[0].custom_data).toEqual({ currency: "BRL", value: 24.9 });
    expect(body.data[0].event_id).toBe("purchase_abc");
  });
});
