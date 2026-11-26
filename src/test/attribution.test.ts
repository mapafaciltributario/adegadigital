import { describe, expect, it } from "vitest";
import { mergeAttribution } from "@/lib/tracking/attribution";
import { clientIp } from "@/lib/request-ip";

describe("attribution", () => {
  it("keeps landing UTMs when the checkout URL has none", () => {
    const first = mergeAttribution({}, "?utm_source=facebook&utm_campaign=c1&fbclid=ABC", 1000);
    const later = mergeAttribution(first, "?plano=completo", 2000);
    expect(later).toMatchObject({ utm_source: "facebook", utm_campaign: "c1", fbclid: "ABC", fbclid_at: "1000" });
  });
  it("a newer click replaces the older fbclid", () => {
    const a = mergeAttribution({ fbclid: "OLD", fbclid_at: "1" }, "?fbclid=NEW", 5);
    expect(a.fbclid).toBe("NEW");
    expect(a.fbclid_at).toBe("5");
  });
});

describe("client ip", () => {
  it("reads the Vercel header and ignores junk", () => {
    const h: Record<string, string> = { "x-real-ip": "<script>", "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" };
    expect(clientIp((n) => h[n])).toBe("203.0.113.7");
  });
});
