// Single entry point for all marketing events in the browser. Pages call track(); nothing else
// talks to fbq or LowTrack. Scripts load at idle time, so they never block render, and a visitor
// who refused measurement (footer "Privacidade e cookies") loads and sends nothing.
import { isTrackingAllowed, onConsent } from "./consent";
import { fbcFromClickId, newEventId, type BrowserEvent } from "./core";
import { PLANS, isPlanId } from "../checkout-core";
import { captureAttribution, getAttribution } from "./attribution";
export { getAttribution } from "./attribution";

type Fbq = ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

const PIXEL_ID = import.meta.env['VITE_META_PIXEL_ID'] as string | undefined;
const LOWTRACK_URL = import.meta.env['VITE_LOWTRACK_PIXEL_URL'] as string | undefined;
let booted = false;

function idle(fn: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2500 }); else setTimeout(fn, 1200);
}
function loadScript(src: string) {
  const s = document.createElement("script");
  s.async = true; s.src = src; document.head.appendChild(s);
}

function bootMeta() {
  if (!PIXEL_ID || window.fbq) return;
  // Official Meta base code, unrolled: queue calls until fbevents.js arrives.
  const f = function (...a: unknown[]) { f.callMethod ? f.callMethod(...a) : f.queue.push(a); } as Fbq;
  f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
  window.fbq = f; window._fbq = f;
  loadScript("https://connect.facebook.net/en_US/fbevents.js");
  f("init", PIXEL_ID);
}

function boot() {
  if (booted || !isTrackingAllowed()) return;
  booted = true;
  captureFbc();
  idle(() => {
    bootMeta();
    // LowTrack: only its own script, as provided in its panel. It must not fire Meta events (see docs/TRACKING.md).
    if (LOWTRACK_URL && /^https:\/\//.test(LOWTRACK_URL)) loadScript(LOWTRACK_URL);
    flush();
  });
}

if (typeof window !== "undefined") { captureAttribution(); onConsent(boot); queueMicrotask(boot); }

function captureFbc() {
  // fbclid saved at landing, so it still counts if consent is given on a later page.
  const a = getAttribution();
  const id = new URLSearchParams(location.search).get("fbclid") ?? a.fbclid;
  if (!id) return;
  const current = getCookie("_fbc");
  if (current?.endsWith(`.${id}`)) return; // same click already stored
  document.cookie = `_fbc=${fbcFromClickId(id, Number(a.fbclid_at) || Date.now())}; path=/; max-age=7776000; SameSite=Lax`;
}
function getCookie(n: string) { return document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1); }

export function getTrackingContext() {
  const consent = isTrackingAllowed();
  return { consent, fbp: consent ? getCookie("_fbp") : undefined, fbc: consent ? getCookie("_fbc") : undefined, sourceUrl: location.origin + location.pathname };
}

type Pending = { name: BrowserEvent | "Purchase"; id: string; params: Record<string, unknown> };
const pending: Pending[] = [];
const SENT = "tracking-sent-v1";
function alreadySent(id: string) {
  const s = new Set<string>(JSON.parse(sessionStorage.getItem(SENT) ?? "[]") as string[]);
  if (s.has(id)) return true;
  s.add(id); sessionStorage.setItem(SENT, JSON.stringify([...s].slice(-200)));
  return false;
}
function flush() {
  if (!window.fbq) { pending.length = 0; return; }
  for (const e of pending.splice(0)) window.fbq("track", e.name, e.params, { eventID: e.id });
}

let serverSender: ((e: { name: BrowserEvent; eventId: string; plan?: string }) => Promise<unknown>) | null = null;
/** Registered by the root route so this module stays free of server-function imports. */
export function setServerSender(fn: typeof serverSender) { serverSender = fn; }

/**
 * Sends one browser event to the Pixel and the same event_id to the Conversions API.
 * `onceKey` makes it fire at most once per tab session (e.g. InitiateCheckout per plan).
 */
export function track(name: BrowserEvent, opts: { plan?: string; onceKey?: string } = {}) {
  if (typeof window === "undefined" || !isTrackingAllowed()) return;
  const id = newEventId(name);
  if (opts.onceKey && alreadySent(`${name}:${opts.onceKey}`)) return;
  const plan = isPlanId(opts.plan) ? opts.plan : null;
  pending.push({ name, id, params: plan ? { value: PLANS[plan].price, currency: "BRL", content_ids: [plan], content_type: "product" } : {} });
  if (booted && window.fbq) flush();
  void serverSender?.({ name, eventId: id, ...(opts.plan ? { plan: opts.plan } : {}) }).catch(() => {});
}

type PurchaseSender = (p: { orderId: string; plan?: string; tracking: ReturnType<typeof getTrackingContext>; customer?: { email?: string; phone?: string } }) => Promise<unknown>;
let purchaseSender: PurchaseSender | null = null;
/** Registered by the root route (server function), like setServerSender. */
export function setPurchaseSender(fn: PurchaseSender | null) { purchaseSender = fn; }

/**
 * Purchase, both halves, with the same id purchase_{orderId}. Call only with data returned by the
 * server after Cakto says "paid". Fires once per tab; Meta deduplicates any repeat by event_id.
 */
export function trackConfirmedPurchase(p: { orderId: string; eventId: string; value: number; currency: "BRL" }) {
  if (typeof window === "undefined" || !isTrackingAllowed() || alreadySent(p.eventId)) return;
  const form = readForm();
  const plan = form.plan && isPlanId(form.plan) ? form.plan : undefined;
  pending.push({ name: "Purchase", id: p.eventId, params: { value: p.value, currency: p.currency, ...(plan ? { content_ids: [plan], content_type: "product" } : {}) } });
  if (booted && window.fbq) flush();
  void purchaseSender?.({ orderId: p.orderId, ...(plan ? { plan } : {}), tracking: getTrackingContext(),
    customer: { ...(form.email ? { email: form.email } : {}), ...(form.phone ? { phone: form.phone } : {}) } }).catch(() => {});
}

/** Checkout form saved in this tab (used only as hashed match data, never for value or status). */
function readForm(): { email?: string; phone?: string; plan?: string } {
  try {
    const f = JSON.parse(sessionStorage.getItem("checkout-form") ?? "{}") as Record<string, unknown>;
    const plan = sessionStorage.getItem("checkout-plan") ?? undefined;
    return { ...(typeof f["email"] === "string" ? { email: f["email"] } : {}), ...(typeof f["phone"] === "string" ? { phone: f["phone"] } : {}), ...(plan ? { plan } : {}) };
  } catch { return {}; }
}
