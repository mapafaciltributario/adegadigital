import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, Loader2, Mail, ShieldCheck, XCircle } from "lucide-react";
import { getPaymentStatus } from "@/lib/checkout.functions";
import type { PaymentState } from "@/lib/checkout-core";
import { trackConfirmedPurchase } from "@/lib/tracking";
import { PrivacyControl } from "@/components/PrivacyControl";

export const Route = createFileRoute("/confirmacao")({
  validateSearch: (s: Record<string, unknown>): { pedido: string | undefined } => ({ pedido: typeof s["pedido"] === "string" ? s["pedido"] : undefined }),
  head: () => ({
    meta: [
      { title: "Status do pedido — Copão Gourmet" },
      { name: "description", content: "Acompanhe a confirmação do seu pagamento." },
      { property: "og:title", content: "Status do pedido — Copão Gourmet" },
      { property: "og:description", content: "Acompanhe a confirmação do seu pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirmacao,
});

const POLL_MS = 5000;
const MAX_POLLS = 360; // ~30 min, the Pix lifetime

function Confirmacao() {
  const { pedido } = Route.useSearch();
  const statusFn = useServerFn(getPaymentStatus);
  const [state, setState] = useState<PaymentState | "loading">("loading");
  const [ref, setRef] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pedido || !/^[0-9a-f-]{36}$/i.test(pedido)) { setState("unknown"); return; }
    let stop = false, n = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      n++;
      const r = await statusFn({ data: { orderId: pedido } }).catch(() => null);
      if (stop) return;
      if (r?.ok) {
        setState(r.state); setRef(r.refId); setAccessUrl(r.accessUrl);
        if (r.state === "approved" && r.purchase) trackConfirmedPurchase(r.purchase);
      } else if (n >= 3) setState("unknown");
      const keepGoing = !r?.ok || r.state === "pending";
      if (keepGoing && n < MAX_POLLS) timer = setTimeout(check, document.hidden ? POLL_MS * 3 : POLL_MS);
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, [pedido, statusFn]);

  if (state === "approved") return <Approved refId={ref} accessUrl={accessUrl} />;

  const view = {
    loading: [Loader2, "Verificando pagamento…", "Consultando a confirmação do pagamento.", "text-muted-foreground animate-spin"],
    pending: [Clock, "Aguardando pagamento", "Assim que o pagamento for confirmado, esta página atualiza sozinha. Pode deixá-la aberta.", "text-gold"],
    refused: [XCircle, "Pagamento recusado", "Nenhum valor foi cobrado. Você pode tentar novamente.", "text-destructive"],
    refunded: [XCircle, "Pedido reembolsado", "Este pedido foi reembolsado ou está em reembolso.", "text-muted-foreground"],
    unknown: [Mail, "Pedido não encontrado", "Se você já pagou, o acesso chega no seu e-mail em alguns minutos.", "text-muted-foreground"],
  } as const;
  const [Icon, title, text, cls] = view[state];

  return (
    <main className="motion-page flex min-h-screen items-center justify-center bg-muted px-5 font-sans">
      <div className="motion-enter w-full max-w-sm rounded-[2rem] bg-card p-8 text-center shadow-soft" aria-live="polite">
        <Icon className={`mx-auto h-16 w-16 ${cls}`} strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
        {state === "pending" && <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando a cada 5 segundos</p>}
        {ref && <p className="mt-4 text-xs text-muted-foreground">Pedido #{ref}</p>}
        {(state === "refused" || state === "unknown") && <Link to="/checkout" search={{ plano: "completo" }} className="mt-6 block rounded-full bg-cta py-3 font-bold text-cta-foreground">Tentar novamente</Link>}
        <Link to="/" className="mt-4 block text-sm text-muted-foreground underline">Voltar ao início</Link>
        <div className="mt-6"><PrivacyControl /></div>
      </div>
    </main>
  );
}

function Approved({ refId, accessUrl }: { refId: string | null; accessUrl: string | null }) {
  return (
    <main className="motion-page flex min-h-screen items-center justify-center bg-hero px-5 py-10 font-sans">
      <div className="motion-enter w-full max-w-md rounded-[2rem] bg-card p-8 text-center shadow-soft sm:p-10" aria-live="polite">
        <div className="success-badge mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-cta text-cta-foreground">
          <Check className="success-check h-12 w-12" strokeWidth={3} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">PAGAMENTO APROVADO!</h1>
        <p className="mt-3 text-muted-foreground">Sua compra foi confirmada. Obrigado por confiar na Adega Digital!</p>
        {refId && <p className="mt-2 text-xs text-muted-foreground">Pedido #{refId}</p>}

        <ul className="mt-6 grid gap-3 text-left text-sm">
          <li className="flex gap-3 rounded-2xl bg-muted p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-cta" /><span>Seu acesso às receitas está liberado na área de membros.</span></li>
          <li className="flex gap-3 rounded-2xl bg-muted p-4"><Mail className="h-5 w-5 shrink-0 text-cta" /><span>Os dados de acesso também foram enviados para o seu e-mail. Se não encontrar, confira a caixa de spam e promoções.</span></li>
        </ul>

        {accessUrl ? (
          <a href={accessUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cta py-4 font-display text-lg font-extrabold text-cta-foreground shadow-soft transition-transform hover:scale-[1.02] active:scale-[0.98]">
            ACESSAR ÁREA DE MEMBROS <ArrowRight className="h-5 w-5" />
          </a>
        ) : (
          <p className="mt-8 rounded-2xl border-2 border-border p-4 text-sm text-muted-foreground">Use o link enviado para o seu e-mail para entrar na área de membros.</p>
        )}
        <Link to="/" className="mt-5 block text-sm text-muted-foreground underline">Voltar ao início</Link>
        <div className="mt-6"><PrivacyControl /></div>
      </div>
    </main>
  );
}
