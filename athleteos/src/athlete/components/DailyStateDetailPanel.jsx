import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Activity, BookOpen, Calculator, ChevronRight, Database, X } from "lucide-react";

const FACTOR_COLORS = { positive: "#7BD8B4", neutral: "#A9CBFB", attention: "#F2C46D", unknown: "#8A9B90" };

export default function DailyStateDetailPanel({ state, onClose, onOpenMetric }) {
  useEffect(() => {
    const close = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center modal-backdrop" style={{ background: "rgba(2,7,12,0.78)", backdropFilter: "blur(14px)" }} onClick={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="daily-state-title" className="w-full max-w-2xl overflow-hidden rounded-t-3xl border modal-content" style={{ maxHeight: "92dvh", background: "linear-gradient(180deg, var(--c-surface), var(--c-bg))", borderColor: "var(--c-border-strong)", animation: "sheet-up 0.34s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full" style={{ background: "var(--c-border-strong)" }} /></div>
        <header className="relative overflow-hidden px-5 pb-5 pt-3 sm:px-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 15% 20%, ${state.color}2B, transparent 43%)` }} />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="chip" style={{ color: state.color, background: `${state.color}14`, borderColor: `${state.color}30` }}>Repère AthleteOS · questionnaire interne</span>
              <h2 id="daily-state-title" className="mt-3 text-[22px] font-bold" style={{ color: "var(--c-text-1)" }}>{state.label}</h2>
              <p className="mt-2 secondary-text leading-6">{state.summary}</p>
            </div>
            <button type="button" className="btn-icon" aria-label="Fermer le détail" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="relative mt-4 rounded-2xl border p-4 flex items-end justify-between" style={{ borderColor: `${state.color}28`, background: `${state.color}0C` }}>
            <div><p className="meta-text uppercase tracking-[0.08em]">Repère du jour</p><p className="mt-1 text-[38px] font-bold leading-none" style={{ color: state.color }}>{state.score ?? "—"}<span className="text-[14px] ml-1">/100</span></p></div>
            <div className="text-right"><p className="meta-text">Référence personnelle</p><p className="mt-1 text-[14px] font-semibold" style={{ color: "var(--c-text-1)" }}>{state.baseline == null ? "En construction" : `${state.delta >= 0 ? "+" : ""}${state.delta} vs habitude`}</p></div>
          </div>
        </header>
        <div className="overflow-y-auto px-5 pb-8 sm:px-6" style={{ maxHeight: "calc(92dvh - 240px)" }}>
          <article className="card overflow-hidden">
            <div className="border-b px-4 py-3 flex items-center gap-2" style={{ borderColor: "var(--c-border)" }}><Activity size={16} style={{ color: state.color }} /><h3 className="card-title">Pourquoi ce résultat ?</h3></div>
            <div className="divide-y" style={{ borderColor: "var(--c-border)" }}>
              {state.factors.map(factor => <div key={factor.key} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--c-border)" }}>
                <div className="h-2 w-2 rounded-full" style={{ background: FACTOR_COLORS[factor.tone] }} />
                <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{factor.label}</p><p className="meta-text mt-0.5">{factor.meaning}</p></div>
                <strong className="text-[15px]" style={{ color: FACTOR_COLORS[factor.tone] }}>{factor.value ?? "—"}/5</strong>
              </div>)}
            </div>
          </article>
          <button type="button" onClick={() => onOpenMetric("variation")} className="card card-hover mt-3 w-full p-4 text-left flex items-center gap-3">
            <Database size={17} style={{ color: "#A9CBFB" }} /><div className="flex-1"><p className="card-title">Contexte de charge</p><p className="card-subtitle mt-1">{state.variation == null ? "Pas encore assez de journées connues." : `La moyenne récente varie de ${state.variation > 0 ? "+" : ""}${state.variation}% par rapport aux 28 derniers jours.`}</p></div><ChevronRight size={16} style={{ color: "var(--c-text-3)" }} />
          </button>
          <article className="card mt-3 p-4">
            <div className="flex items-center gap-2"><Calculator size={16} style={{ color: "#B5A3F5" }} /><h3 className="card-title">Calcul transparent</h3></div>
            <code className="mt-3 block rounded-xl p-3 text-[12px] leading-6" style={{ color: "var(--c-text-1)", background: "var(--c-surface-2)" }}>Moyenne de : sommeil + énergie + (6 − courbatures) + humeur + (6 − stress), puis normalisation de 1–5 vers 0–100.</code>
            <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>Ce repère résume les réponses du jour. La charge reste un contexte séparé : elle ne modifie pas secrètement le score.</p>
          </article>
          <article className="mt-3 rounded-2xl border p-4" style={{ background: "rgba(91,141,239,0.06)", borderColor: "rgba(91,141,239,0.18)" }}>
            <div className="flex items-center gap-2 text-[#A9CBFB]"><BookOpen size={16} /><h3 className="card-title">Ce que ce repère ne dit pas</h3></div>
            <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>Il ne mesure pas directement la performance, la disponibilité physiologique ou un risque de blessure. Il aide l’athlète et le coach à ouvrir une discussion avec les données disponibles.</p>
          </article>
        </div>
      </section>
    </div>, document.body,
  );
}
