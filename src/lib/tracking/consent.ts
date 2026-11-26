// Visitor privacy control for marketing tracking (LGPD). Measurement is on by default;
// a visitor can refuse it from the discreet "Privacidade e cookies" link in the footer.
const KEY = "tracking-consent-v1";
export type Consent = "granted" | "denied" | null;
const listeners = new Set<(c: Consent) => void>();

export function getConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "granted" || v === "denied" ? v : null;
}

/** Marketing measurement runs unless the visitor refused it. */
export function isTrackingAllowed(): boolean {
  return getConsent() !== "denied";
}

export function setConsent(c: "granted" | "denied") {
  localStorage.setItem(KEY, c);
  listeners.forEach((l) => l(c));
}
export function onConsent(l: (c: Consent) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
