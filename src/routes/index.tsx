import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Gift, Lock, Mail, MessageCircle, Play, Pause, ShieldCheck, ShoppingCart, Sparkles, Star, Zap, ChevronDown, ChevronLeft, ChevronRight, CreditCard, X } from "lucide-react";

const A = "https://adegadigital.lovable.app";
const PAY_FULL = "/checkout?plano=completo";
const PAY_UPSELL = "/checkout?plano=especial";
const PAY_BASIC = "/checkout?plano=basico";
const MOCKUP = `${A}/__l5e/assets-v1/1694aa7b-dcbc-4edb-a1a3-6bcbc3b577dc/mockup-180-copao.png`;
const VIDEO = `${A}/__l5e/assets-v1/860547de-89f9-4122-addd-2e6a70fe412f/videopag03.mp4`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "180 Receitas de Copão Gourmet — Renda Extra" },
      { name: "description", content: "Receitas de copões e drinks prontas para vender, com bônus de precificação e roteiro de WhatsApp." },
      { property: "og:title", content: "180 Receitas de Copão Gourmet" },
      { property: "og:description", content: "Transforme copões gourmet em uma nova fonte de renda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: MOCKUP },
      { name: "twitter:image", content: MOCKUP },
    ],
  }),
  component: Index,
});

const receitas = [
  ["receita1", "Copão Beijo Doce"], ["receita2", "Espanhola de Vinho c/ Maracujá"], ["receita3", "MaracuBeats Cremosa"],
  ["receita4", "Batida de Bala Halls"], ["receita5", "Drink do Verão"], ["receita6", "Caipirinha de Maracujá c/ Café"],
];
const bonus = [
  ["40 Receitas Alcoólicas de Batidas na Garrafa", "Receitas prontas para vender, sem complicação.", "0b739bcb-6a32-43f1-935a-0daf6d3eaac4/bonus1-40-receitas.png"],
  ["Tabela de Precificação", "Saiba exatamente quanto cobrar em cada receita para lucrar de verdade.", "a9bce4d7-0850-4293-af81-6dd1ba6ba61a/bonus2-precificacao.png"],
  ["Roteiro de Vendas no WhatsApp", "Scripts prontos para copiar, colar e começar a vender.", "93ec151a-2bfc-4f90-a371-e0371ef2c5d1/bonus3-whatsapp.png"],
  ["Videoaula: Embalar e Apresentar", "Aprenda a deixar seus produtos irresistíveis.", "6c45aefd-4289-43ed-be99-bca283aae763/bonus4-videoaula.png"],
];
const faq = [
  ["Preciso saber cozinhar para comprar?", "Não! As receitas são simples e qualquer pessoa consegue fazer, mesmo sem experiência na cozinha."],
  ["Preciso de equipamentos caros?", "Não precisa. Tudo pode ser feito em casa com utensílios simples que você provavelmente já tem."],
  ["Onde vou vender os drinks?", "No WhatsApp, redes sociais, festas, delivery ou até na rua. O bônus 3 te ensina exatamente como."],
  ["Quanto posso cobrar por cada copão?", "Com a tabela de precificação incluída, você sabe exatamente quanto cobrar para ter margem alta."],
  ["Como recebo após a compra?", "O acesso é imediato! Você recebe no e-mail e no WhatsApp assim que o pagamento for confirmado."],
  ["Tenho garantia se não gostar?", "Sim! 7 dias de garantia total. Devolvemos 100% do valor pago."],
];
const fullItems = ["+180 receitas de drinks gourmet", "Tabela de precificação completa", "Roteiro de vendas pelo WhatsApp", "Videoaula: embalar e vender mais", "40 receitas de batidas em garrafa", "Conteúdos novos sem custo extra", "Acesso vitalício", "Suporte dedicado"];

function Cta({ children, href = "#precos" }: { children: React.ReactNode; href?: string }) {
  return <a href={href} className="animate-cta flex w-full items-center justify-center gap-2 rounded-full bg-cta px-6 py-4 text-center font-display text-base font-extrabold uppercase tracking-wide text-cta-foreground shadow-soft">{children}</a>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">{children}</span>;
}

function ProtectedVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => { const v = ref.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  return (
    <div className="relative mx-auto my-8 w-full max-w-sm overflow-hidden rounded-3xl border-4 border-gold/40 shadow-soft" onContextMenu={(e) => e.preventDefault()}>
      <video ref={ref} src={VIDEO} playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={toggle} className="block w-full select-none" />
      <button onClick={toggle} aria-label={playing ? "Pausar" : "Assistir"} className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? "opacity-0 hover:opacity-100" : "bg-foreground/30"}`}>
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-soft">
          {playing ? <Pause className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
        </span>
      </button>
    </div>
  );
}

function Index() {
  const [t, setT] = useState(600);
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.12 });
    els.forEach((e) => { e.classList.add("reveal"); io.observe(e); });
    return () => io.disconnect();
  }, []);
  useEffect(() => { const i = setInterval(() => setT((s) => (s > 0 ? s - 1 : 600)), 1000); return () => clearInterval(i); }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, "0"), ss = String(t % 60).padStart(2, "0");
  const scroll = (d: number) => track.current?.scrollBy({ left: d * 260, behavior: "smooth" });

  return (
    <div className="motion-page sales-motion min-h-screen overflow-x-hidden font-sans">
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-foreground py-2.5 text-sm font-semibold text-background">
        <Clock className="h-4 w-4 text-gold" /> Promoção encerra em <span className="rounded bg-primary px-2 font-mono font-bold text-primary-foreground">{mm}:{ss}</span>
      </div>

      <header className="bg-hero px-5 pb-16 pt-12 text-center text-primary-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 px-4 py-1 text-xs font-bold uppercase tracking-widest text-gold"><Sparkles className="h-3.5 w-3.5" /> Oferta exclusiva</span>
        <h1 className="mx-auto mt-6 max-w-xl font-display text-4xl font-extrabold leading-[1.05] md:text-6xl">
          180 Receitas de <span className="text-gradient">Copão Gourmet</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg opacity-85">Transforme copões gourmet em uma nova fonte de renda.</p>
        <div className="mt-5 flex justify-center gap-3 text-sm opacity-90">
          <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</span>
          <span className="opacity-40">|</span>
          <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" /> E-mail</span>
        </div>
        <ProtectedVideo />
        <div className="mx-auto max-w-md"><Cta>Quero minhas receitas agora</Cta></div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs opacity-75"><Lock className="h-3.5 w-3.5" /> Compra 100% segura · Acesso imediato</p>
      </header>

      <section className="mx-auto max-w-xl px-5 py-16">
        <p data-reveal className="text-center font-display text-2xl font-bold leading-snug">Receitas prontas para vender, com ingredientes simples e <span className="text-primary">margem de lucro que vai te surpreender.</span></p>
        <ul className="mt-8 grid gap-3">
          {["Qualquer pessoa consegue fazer", "Sem cozinha profissional ou equipamentos caros", "Receitas testadas e com custo baixo", "Perfeito para WhatsApp, rua ou delivery"].map((x) => (
            <li data-reveal key={x} className="flex items-center gap-3 rounded-2xl bg-card p-4 font-semibold shadow-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cta/15 text-cta"><Check className="h-4 w-4" /></span>{x}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted py-16">
        <div data-reveal className="px-5 text-center">
          <Eyebrow>Receitas</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-extrabold">Algumas receitas que você vai aprender</h2>
        </div>
        <div className="relative mt-8">
          <div ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
            {receitas.map(([f, n]) => (
              <figure data-reveal key={f} className="group relative w-60 shrink-0 snap-center overflow-hidden rounded-3xl shadow-soft">
                <img src={`${A}/assets/${f}.jpg`} alt={n} className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent p-4 pt-12 font-display font-bold text-background">{n}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-3">
            <button onClick={() => scroll(-1)} aria-label="Anterior" className="rounded-full border bg-card p-2"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => scroll(1)} aria-label="Próxima" className="rounded-full border bg-card p-2"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-5 py-16">
        <div data-reveal className="text-center">
          <Eyebrow><Gift className="h-3.5 w-3.5" /> Bônus</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-extrabold">E ainda leva 4 bônus</h2>
        </div>
        <div className="mt-8 grid gap-5">
          {bonus.map(([h, d, img], i) => (
            <div data-reveal key={h} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-soft">
              <img src={`${A}/__l5e/assets-v1/${img}`} alt={h} className="h-28 w-24 shrink-0 object-contain" />
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Bônus {i + 1}</span>
                <h3 className="font-display text-lg font-bold leading-tight">{h}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="precos" className="bg-hero px-5 py-16">
        <h2 data-reveal className="text-center font-display text-3xl font-extrabold text-primary-foreground">Escolha como quer começar</h2>
        <div className="mx-auto mt-10 max-w-md space-y-6">
          <div data-reveal className="relative rounded-[2rem] border-2 border-gold bg-card p-6 shadow-soft">
            <span className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gold px-4 py-1 text-xs font-bold uppercase tracking-wider text-foreground"><Star className="h-3.5 w-3.5 fill-current" /> Mais vendido</span>
            <img src={MOCKUP} alt="Kit completo" className="mx-auto w-44" />
            <h3 className="mt-2 text-center font-display text-2xl font-extrabold">Kit Completo +180 Receitas</h3>
            <ul className="mt-5 grid gap-2 text-sm">
              {fullItems.map((x) => <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-cta" />{x}</li>)}
            </ul>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground line-through">De R$59,90</p>
              <p className="font-display text-6xl font-extrabold text-cta">R$24,90</p>
              <p className="text-xs text-muted-foreground">pagamento único · acesso imediato</p>
            </div>
            <div className="mt-5"><Cta href={PAY_FULL}><ShoppingCart className="h-5 w-5" /> Quero o kit completo</Cta></div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Acesso imediato · E-mail + WhatsApp · Garantia de 7 dias</p>
          </div>
          <div data-reveal className="rounded-[2rem] bg-card/90 p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Básico</span>
            <h3 className="font-display text-xl font-bold">50 Receitas de Copão Gourmet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sem os bônus exclusivos.</p>
            <p className="mt-3 font-display text-3xl font-extrabold">R$10</p>
            <button onClick={() => setModal(true)} className="mt-4 w-full rounded-full border-2 border-border py-3 text-sm font-semibold text-muted-foreground">Quero apenas o básico</button>
          </div>
        </div>
      </section>

      <section data-reveal className="mx-auto max-w-xl px-5 py-16 text-center">
        <ShieldCheck className="mx-auto h-14 w-14 text-cta" strokeWidth={1.5} />
        <h4 className="mt-3 font-display text-2xl font-bold">Garantia de 7 dias</h4>
        <p className="mt-2 text-muted-foreground">Se por qualquer motivo você não gostar, devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.</p>
      </section>

      <section className="mx-auto max-w-xl px-5 pb-16">
        <h2 data-reveal className="text-center font-display text-3xl font-extrabold">Dúvidas frequentes</h2>
        <div className="mt-6 space-y-3">
          {faq.map(([q, a], i) => (
            <button data-reveal key={q} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="block w-full rounded-2xl bg-card p-5 text-left shadow-soft">
              <div className="flex items-center justify-between gap-3 font-semibold">{q}<ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} /></div>
              <div className={`faq-answer ${open === i ? "is-open" : ""}`} aria-hidden={open !== i}><div><p className="pt-2 text-sm text-muted-foreground">{a}</p></div></div>
            </button>
          ))}
        </div>
        <div data-reveal className="mt-12 rounded-[2rem] bg-foreground p-6 text-center text-background">
          <p className="font-display text-xl font-bold">Cada dia sem vender é dinheiro perdido.</p>
          <div className="mt-5"><Cta>Quero acesso às 180 receitas</Cta></div>
        </div>
      </section>

      <footer className="flex flex-wrap justify-center gap-5 border-t py-6 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4" /> SSL seguro</span>
        <span className="inline-flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Pagamento protegido</span>
        <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4" /> Acesso imediato</span>
      </footer>

      {modal && (
        <div className="motion-overlay fixed inset-0 z-30 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm" onClick={() => setModal(false)}>
          <div className="motion-enter relative w-full max-w-sm rounded-[2rem] bg-card p-6 text-center shadow-soft" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModal(false)} aria-label="Fechar" className="absolute right-4 top-4 text-muted-foreground"><X className="h-5 w-5" /></button>
            <Eyebrow><Zap className="h-3.5 w-3.5" /> Oferta especial</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-extrabold">Espera! Leve tudo por apenas</h2>
            <p className="mt-2 text-sm text-muted-foreground line-through">De R$24,90</p>
            <p className="font-display text-5xl font-extrabold text-cta">R$17,90</p>
            <ul className="my-5 grid gap-2 text-left text-sm">
              {["180 receitas de drinks gourmet", "Tabela de precificação completa", "Roteiro de vendas pelo WhatsApp", "Videoaula: embalar e vender mais", "PDF baixável das receitas", "Acesso vitalício"].map((x) => <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-cta" />{x}</li>)}
            </ul>
            <Cta href={PAY_UPSELL}>Sim! Quero por R$17,90</Cta>
            <a href={PAY_BASIC} className="mt-4 block text-xs text-muted-foreground underline">Não, prefiro pagar R$10 e perder os bônus</a>
          </div>
        </div>
      )}
    </div>
  );
}
