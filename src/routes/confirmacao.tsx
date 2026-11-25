import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Mail, XCircle } from "lucide-react";
import { getPaymentStatus } from "@/lib/checkout.functions";
import type { PaymentState } from "@/lib/checkout-core";

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

function Confirmacao() {
  const { pedido } = Route.useSearch();
  const statusFn = useServerFn(getPaymentStatus);
  const [state, setState] = useState<PaymentState | "loading">("loading");
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    if (!pedido || !/^[0-9a-f-]{36}$/i.test(pedido)) { setState("unknown"); return; }
    let stop = false;
    const check = async () => {
      const r = await statusFn({ data: { orderId: pedido } }).catch(() => null);
      if (stop || !r) return;
      setState(r.state); setRef(r.refId);
      if (r.state === "pending") setTimeout(check, 5000);
    };
    check();
    return () => { stop = true; };
  }, [pedido, statusFn]);

  const view = {
    loading: [Loader2, "Verificando pagamento…", "Consultando a Cakto.", "text-muted-foreground animate-spin"],
    approved: [CheckCircle2, "Pagamento aprovado!", "Enviamos o acesso para o seu e-mail. Confira também a caixa de spam.", "text-cta"],
    pending: [Clock, "Aguardando pagamento", "Assim que o pagamento for confirmado, esta página atualiza e você recebe o acesso por e-mail.", "text-gold"],
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
        {ref && <p className="mt-4 text-xs text-muted-foreground">Pedido #{ref}</p>}
        {(state === "refused" || state === "unknown") && <Link to="/checkout" search={{ plano: "completo" }} className="mt-6 block rounded-full bg-cta py-3 font-bold text-cta-foreground">Tentar novamente</Link>}
        <Link to="/" className="mt-4 block text-sm text-muted-foreground underline">Voltar ao início</Link>
      </div>
    </main>
  );
}
