import { describe, expect, it, beforeEach } from "vitest";
import { getConsent, isTrackingAllowed, setConsent } from "@/lib/tracking/consent";

beforeEach(() => { localStorage.clear(); });

describe("privacy control (no banner: measurement runs unless refused)", () => {
  it("runs measurement when the visitor has never chosen", () => {
    expect(getConsent()).toBeNull();
    expect(isTrackingAllowed()).toBe(true);
  });

  it("a refusal is remembered and stops measurement", () => {
    setConsent("denied");
    expect(getConsent()).toBe("denied");
    expect(isTrackingAllowed()).toBe(false);
  });

  it("allowing again after a refusal restores measurement", () => {
    setConsent("denied");
    setConsent("granted");
    expect(isTrackingAllowed()).toBe(true);
  });
});
