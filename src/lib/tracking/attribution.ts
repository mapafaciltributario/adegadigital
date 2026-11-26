// First-touch attribution kept for the tab session: UTMs, Cakto src/sck and fbclid.
// Captured on the landing page so they survive navigation to /checkout. No personal data.
export const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck", "fbclid"] as const;
export type Attribution = Partial<Record<(typeof ATTR_KEYS)[number], string>> & { fbclid_at?: string };
const KEY = "attribution-v1";

/** Pure merge: new non-empty params override saved ones (latest click wins, like Meta's fbc). */
export function mergeAttribution(saved: Attribution, search: string, nowMs: number): Attribution {
  const q = new URLSearchParams(search);
  const out: Attribution = { ...saved };
  for (const k of ATTR_KEYS) {
    const v = q.get(k)?.trim();
    if (v) { out[k] = v.slice(0, k === "fbclid" ? 300 : 200); if (k === "fbclid") out.fbclid_at = String(nowMs); }
  }
  return out;
}

function read(): Attribution {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Attribution; } catch { return {}; }
}
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(KEY, JSON.stringify(mergeAttribution(read(), location.search, Date.now()))); } catch { /* storage blocked */ }
}
export function getAttribution(): Attribution {
  return typeof window === "undefined" ? {} : read();
}
