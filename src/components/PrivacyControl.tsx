import { useEffect, useRef, useState } from "react";
import { isTrackingAllowed, setConsent } from "@/lib/tracking/consent";
import { track } from "@/lib/tracking";

/**
 * Discreet privacy control: a small text link that opens a compact panel where the visitor
 * allows or refuses marketing measurement. Nothing floats over the page until it is opened.
 */
export function PrivacyControl({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => { setAllowed(isTrackingAllowed()); }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (c: "granted" | "denied") => {
    setConsent(c);
    setAllowed(c === "granted");
    setOpen(false);
    if (c === "granted") track("PageView");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-muted-foreground underline underline-offset-2 ${className}`}
      >
        Privacidade e cookies
      </button>

      {open && (
        <div className="motion-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Privacidade e cookies"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="motion-enter w-full max-w-sm rounded-[2rem] bg-card p-6 text-sm shadow-soft outline-none"
          >
            <p className="font-display text-lg font-bold">Privacidade e cookies</p>
            <p className="mt-2 text-muted-foreground">
              Medimos visitas e cliques nesta página para saber quais anúncios funcionam. Você pode recusar sem perder nada da página.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Situação atual: {allowed ? "medição permitida" : "medição recusada"}.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => pick("denied")} className="flex-1 rounded-full border-2 border-border py-2 font-semibold">Recusar</button>
              <button onClick={() => pick("granted")} className="flex-1 rounded-full bg-cta py-2 font-bold text-cta-foreground">Permitir</button>
            </div>
            <button onClick={() => setOpen(false)} className="mt-3 w-full text-xs text-muted-foreground underline">Fechar sem alterar</button>
          </div>
        </div>
      )}
    </>
  );
}
