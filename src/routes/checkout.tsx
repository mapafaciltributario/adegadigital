import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Gift, Copy, CreditCard, Loader2, Lock, QrCode, ShoppingCart, ShieldCheck, WifiOff } from "lucide-react";
import { PLAN_INCLUDES } from "@/lib/checkout-core";
import { Button } from "@/components/ui/button";
import { PLANS, customerSchema, formatBRL, isPlanId, maskDoc, maskPhone, type CustomerInput, type PlanId } from "@/lib/checkout-core";
import { createPixCharge, getHostedCheckoutUrl, getPaymentStatus, UTM_KEYS } from "@/lib/checkout.functions";
import { getAttribution, getTrackingContext, track } from "@/lib/tracking";
import { PrivacyControl } from "@/components/PrivacyControl";

/** Attribution params captured at landing (any page), forwarded to the card checkout. */
function getUtm() {
  const a = getAttribution();
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) { const v = a[k]; if (v) out[k] = v; }
  return out;
}

const MOCKUP = "https://adegadigital.lovable.app/__l5e/assets-v1/1694aa7b-dcbc-4edb-a1a3-6bcbc3b577dc/mockup-180-copao.png";

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): { plano: PlanId } => ({ plano: isPlanId(s["plano"]) ? s["plano"] : "completo" }),
  head: () => ({
    meta: [
      { title: "Finalizar compra — 180 Receitas de Copão Gourmet" },
      { name: "description", content: "Pagamento seguro por Pix ou cartão. Acesso imediato às receitas." },
      { property: "og:title", content: "Finalizar compra — Copão Gourmet" },
      { property: "og:description", content: "Pagamento seguro por Pix ou cartão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type Form = CustomerInput;
type Errors = Partial<Record<keyof Form, string>>;
type Pix = { orderId: string; qrCode: string; amount: number; expiresAt: string };
const FORM_KEY = "checkout-form";
function getFingerprint() {
  let f = localStorage.getItem("checkout-fp");
  if (!f) { f = crypto.randomUUID(); localStorage.setItem("checkout-fp", f); }
  return f;
}
/** Same payload → same key, so retries never create a second charge. */
function getIdemKey(payload: string) {
  const raw = sessionStorage.getItem("checkout-idem");
  const saved = raw ? (JSON.parse(raw) as { p: string; k: string }) : null;
  if (saved?.p === payload) return saved.k;
  const k = crypto.randomUUID();
  sessionStorage.setItem("checkout-idem", JSON.stringify({ p: payload, k }));
  return k;
}

function trackingPayload() {
  const t = getTrackingContext();
  return { consent: t.consent, sourceUrl: t.sourceUrl, ...(t.fbp ? { fbp: t.fbp } : {}), ...(t.fbc ? { fbc: t.fbc } : {}) };
}

function Field({ id, label, error, ...p }: { id: keyof Form; label: string; error?: string | undefined } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input id={id} name={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className={`w-full rounded-xl border-2 bg-background px-4 py-3 text-base outline-none transition-colors focus:border-primary ${error ? "border-destructive" : "border-border"}`} {...p} />
      {error && <p id={`${id}-err`} role="alert" className="motion-enter mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

function Checkout() {
  const { plano } = Route.useSearch();
  const plan = PLANS[plano];
  const navigate = useNavigate();
  const createPix = useServerFn(createPixCharge);
  const statusFn = useServerFn(getPaymentStatus);
  const hostedFn = useServerFn(getHostedCheckoutUrl);

  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", doc: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [state, setState] = useState<"pending" | "refused" | null>(null);
  const inflight = useRef(false);
  const total = plan.price;

  useEffect(() => {
    const s = sessionStorage.getItem(FORM_KEY);
    if (s) try { setForm(JSON.parse(s) as Form); } catch { /* ignore */ }
    const on = () => setOffline(false), off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { getUtm(); track("InitiateCheckout", { plan: plano, onceKey: plano }); }, [plano]);
  useEffect(() => { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); }, [form]);

  useEffect(() => {
    if (!pix) return;
    import("qrcode").then((m) => m.toDataURL(pix.qrCode, { margin: 1, width: 260 })).then(setQr).catch(() => setQr(null));
    const i = setInterval(async () => {
      if (!navigator.onLine || document.hidden) return;
      const r = await statusFn({ data: { orderId: pix.orderId } }).catch(() => null);
      if (r?.state === "approved") { clearInterval(i); sessionStorage.removeItem("checkout-idem"); navigate({ to: "/confirmacao", search: { pedido: pix.orderId } }); }
      if (r?.state === "refused") { clearInterval(i); setState("refused"); }
    }, 5000);
    return () => clearInterval(i);
  }, [pix, statusFn, navigate]);

  const set = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inflight.current) return;
    setError(null);
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) { const k = i.path[0] as keyof Form; errs[k] ??= i.message; }
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0] ?? "")?.focus();
      return;
    }
    if (!navigator.onLine) { setError("Sem conexão. Seus dados foram mantidos — tente quando a internet voltar."); return; }
    inflight.current = true; setBusy(true);
    try {
      if (method === "card") {
        const r = await hostedFn({ data: { plan: plano, utm: getUtm() } });
        if (!r.url) { setError("Pagamento por cartão ainda não configurado."); return; }
        track("AddPaymentInfo", { plan: plano });
        window.location.href = r.url;
        return;
      }
      const payload = JSON.stringify({ plano, ...parsed.data });
      const r = await createPix({ data: { plan: plano, customer: parsed.data, bumps: [], idempotencyKey: getIdemKey(payload), fingerprint: getFingerprint(), tracking: trackingPayload(), utm: getUtm() } });
      if (!r.ok) { setError(r.error); return; }
      sessionStorage.setItem("checkout-plan", plano);
      track("AddPaymentInfo", { plan: plano, onceKey: r.orderId });
      setPix({ orderId: r.orderId, qrCode: r.qrCode, amount: r.amount, expiresAt: r.expiresAt });
      setState("pending");
    } catch {
      setError("Falha de conexão. Seus dados foram mantidos — toque em pagar novamente (não haverá cobrança duplicada).");
    } finally { inflight.current = false; setBusy(false); }
  }

  const copy = async () => { if (!pix) return; await navigator.clipboard.writeText(pix.qrCode); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  return (
    <div className="motion-page checkout-motion min-h-screen bg-muted font-sans">
      <header className="bg-hero px-5 py-4 text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm opacity-90"><ChevronLeft className="h-4 w-4" /> Voltar</Link>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4 text-gold" /> Pagamento seguro</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        {offline && <p role="status" className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm text-background"><WifiOff className="h-4 w-4" /> Você está sem internet. Seus dados ficam salvos.</p>}

        <section aria-label="Resumo do pedido" className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="flex items-center gap-2 border-b pb-3 font-display text-sm font-bold uppercase tracking-widest"><ShoppingCart className="h-4 w-4" /> Resumo do pedido</p>
          <div className="flex items-center gap-4 py-3">
            <img src={MOCKUP} alt="" width={64} height={64} loading="eager" className="h-16 w-16 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-bold leading-tight">{plan.name}</h1>
              <p className="text-xs text-muted-foreground">Produto digital · acesso por e-mail</p>
            </div>
            <p className="font-display font-extrabold">{formatBRL(plan.price)}</p>
          </div>
          {PLAN_INCLUDES[plano].length > 0 && (
            <ul className="grid gap-1 border-t py-3 text-sm">
              {PLAN_INCLUDES[plano].map((x) => <li key={x} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" />{x}</span><span className="text-xs font-bold uppercase text-cta">Incluso</span></li>)}
            </ul>
          )}
          <p className="border-t pt-3 text-right font-semibold">Total <span className="font-display text-2xl font-extrabold text-cta">{formatBRL(total)}</span> à vista</p>
        </section>

        {pix ? (
          <section key={pix.orderId} className="motion-enter rounded-2xl bg-card p-5 text-center shadow-soft" aria-live="polite">
            {state === "refused" ? (
              <>
                <h2 className="font-display text-xl font-bold text-destructive">Pagamento não concluído</h2>
                <p className="mt-2 text-sm text-muted-foreground">O Pix expirou ou foi cancelado. Nenhum valor foi cobrado.</p>
                <Button variant="ghost" onClick={() => { setPix(null); setState(null); sessionStorage.removeItem("checkout-idem"); }} className="h-auto mt-4 w-full rounded-full bg-cta py-3 font-bold text-cta-foreground">Gerar novo Pix</Button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold">Pague {formatBRL(pix.amount)} com Pix</h2>
                <p className="mt-1 text-sm text-muted-foreground">Escaneie o QR Code ou copie o código no app do seu banco.</p>
                {qr ? <img src={qr} alt="QR Code do Pix" width={220} height={220} className="mx-auto my-4 rounded-xl border-2 border-border" /> : <div className="mx-auto my-4 h-[220px] w-[220px] animate-pulse rounded-xl bg-muted" />}
                <Button variant="ghost" onClick={copy} className="h-auto flex w-full items-center justify-center gap-2 rounded-full bg-cta py-3.5 font-bold text-cta-foreground">
                  {copied ? <><Check className="h-5 w-5" /> Código copiado</> : <><Copy className="h-5 w-5" /> Copiar código Pix</>}
                </Button>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do pagamento…</p>
                <p className="mt-1 text-xs text-muted-foreground">Válido até {new Date(pix.expiresAt.replace(" ", "T")).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Esta tela atualiza sozinha.</p>
              </>
            )}
          </section>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl bg-card p-5 shadow-soft">
            <fieldset className="space-y-4" disabled={busy}>
              <legend className="mb-1 font-display text-lg font-bold">Seus dados</legend>
              <Field id="name" label="Nome completo" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
              <Field id="email" label="E-mail (onde você recebe o acesso)" type="email" inputMode="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
              <Field id="phone" label="Celular (WhatsApp)" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(11) 91234-5678" value={form.phone} error={errors.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} />
              <Field id="doc" label="CPF ou CNPJ" inputMode="numeric" placeholder="000.000.000-00" value={form.doc} error={errors.doc} onChange={(e) => set("doc", maskDoc(e.target.value))} />
            </fieldset>

            <fieldset disabled={busy}>
              <legend className="mb-2 font-display text-lg font-bold">Forma de pagamento</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-3">
                {([["pix", "Pix", QrCode, "Aprovação na hora"], ["card", "Cartão", CreditCard, "Página segura Cakto"]] as const).map(([v, l, Icon, d]) => (
                  <Button variant="ghost" key={v} type="button" role="radio" aria-checked={method === v} onClick={() => setMethod(v)}
                    className={`h-auto block whitespace-normal rounded-xl border-2 p-3 text-left transition-colors ${method === v ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Icon className="h-5 w-5 text-primary" /><span className="mt-1 block font-bold">{l}</span><span className="text-xs text-muted-foreground">{d}</span>
                  </Button>
                ))}
              </div>
              {method === "card" && <p className="motion-enter mt-3 text-xs text-muted-foreground">Você será levado à página de pagamento oficial da Cakto. Os dados do cartão não passam por este site.</p>}
            </fieldset>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="font-semibold">Total</span>
              <span className="font-display text-2xl font-extrabold">{formatBRL(method === "card" ? plan.price : total)}</span>
            </div>

            {error && <p role="alert" className="motion-enter rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}

            <Button variant="ghost" type="submit" disabled={busy} className="h-auto flex w-full items-center justify-center gap-2 rounded-full bg-cta py-4 font-display text-base font-extrabold uppercase tracking-wide text-cta-foreground shadow-soft disabled:opacity-70">
              {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Processando…</> : method === "pix" ? "Gerar Pix" : "Ir para pagamento"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-cta" /> Garantia de 7 dias · Processado pela Cakto</p>
          </form>
        )}
      </main>
      <div className="pb-8 text-center">
        <PrivacyControl />
      </div>
    </div>
  );
}
