import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Activity, BookOpen, Calculator, ChevronRight, Database, HeartHandshake, Info, Sparkles, X } from "lucide-react";

const FACTOR_COLORS = { positive: "#7BD8B4", neutral: "#A9CBFB", attention: "#F2C46D", unknown: "#8A9B90" };

export default function DailyStateDetailPanel({ state, onClose, onOpenMetric }) {
  useEffect(() => {
    const close = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const helps = state.helps ?? state.factors?.filter(item => item.tone === "positive").map(item => item.meaning) ?? [];
  const watch = state.watch ?? state.factors?.filter(item => item.tone === "attention").map(item => item.meaning) ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center modal-backdrop" style={{ background: "rgba(2,7,12,0.78)", backdropFilter: "blur(14px)" }} onClick={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="daily-state-title" className="w-full max-w-2xl overflow-hidden rounded-t-3xl border modal-content" style={{ maxHeight: "92dvh", background: "linear-gradient(180deg, var(--c-surface), var(--c-bg))", borderColor: "var(--c-border-strong)", animation: "sheet-up 0.34s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full" style={{ background: "var(--c-border-strong)" }} /></div>
        <header className="relative overflow-hidden px-5 pb-5 pt-3 sm:px-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 15% 20%, ${state.color}2B, transparent 43%)` }} />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="chip" style={{ color: state.color, background: `${state.color}14`, borderColor: `${state.color}30` }}>État du jour · tes réponses</span>
              <h2 id="daily-state-title" className="mt-3 text-[22px] font-bold" style={{ color: "var(--c-text-1)" }}>{state.plainHeadline ?? state.label}</h2>
              <p className="mt-2 secondary-text leading-6">{state.plainSummary ?? state.summary}</p>
            </div>
            <button type="button" className="btn-icon" aria-label="Fermer le détail" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className="overflow-y-auto px-5 pb-8 sm:px-6" style={{ maxHeight: "calc(92dvh - 170px)" }}>
          <article className="rounded-2xl border p-4" style={{ borderColor: `${state.color}28`, background: `${state.color}0C` }}>
            <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: state.color }} /><h3 className="card-title">En clair</h3></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl p-3" style={{ background: "rgba(123,216,180,0.08)" }}>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#7BD8B4" }}>Ce qui t'aide</p>
                {helps.length ? helps.slice(0, 3).map(item => <p key={item} className="mt-2 text-[13px] leading-5" style={{ color: "var(--c-text-1)" }}>• {item}</p>) : <p className="mt-2 text-[13px] leading-5" style={{ color: "var(--c-text-2)" }}>Rien ne ressort nettement pour le moment.</p>}
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(242,196,109,0.08)" }}>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F2C46D" }}>À surveiller</p>
                {watch.length ? watch.slice(0, 3).map(item => <p key={item} className="mt-2 text-[13px] leading-5" style={{ color: "var(--c-text-1)" }}>• {item}</p>) : <p className="mt-2 text-[13px] leading-5" style={{ color: "var(--c-text-2)" }}>Aucun point marqué dans tes réponses.</p>}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border p-3" style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border)" }}>
              <HeartHandshake size={16} className="mt-0.5 shrink-0" style={{ color: "#A9CBFB" }} />
              <div><p className="text-[12px] font-bold" style={{ color: "var(--c-text-1)" }}>Le bon réflexe</p><p className="mt-1 text-[13px] leading-5" style={{ color: "var(--c-text-2)" }}>{state.coachPrompt ?? "Utilise ce résumé pour échanger avec ton coach."}</p></div>
            </div>
          </article>

          <button type="button" onClick={() => onOpenMetric?.("variation")} className="card card-hover mt-3 w-full p-4 text-left flex items-center gap-3">
            <Database size={17} style={{ color: "#A9CBFB" }} />
            <div className="flex-1"><p className="card-title">Ta charge récente</p><p className="card-subtitle mt-1">{state.loadContext ?? (state.variation == null ? "Pas encore assez de journées connues." : `Évolution de ${state.variation > 0 ? "+" : ""}${state.variation}% par rapport à ton rythme habituel.`)}</p></div>
            <ChevronRight size={16} style={{ color: "var(--c-text-3)" }} />
          </button>

          <details className="card mt-3 overflow-hidden">
            <summary className="tap-feedback flex cursor-pointer list-none items-center gap-3 p-4">
              <Info size={17} style={{ color: "#B5A3F5" }} />
              <div className="flex-1"><p className="card-title">Voir les réponses, le calcul et les limites</p><p className="card-subtitle mt-1">Le niveau scientifique reste disponible sans encombrer la lecture principale.</p></div>
              <ChevronRight size={16} style={{ color: "var(--c-text-3)" }} />
            </summary>
            <div className="border-t p-4" style={{ borderColor: "var(--c-border)" }}>
              <div className="flex items-center justify-between gap-4 rounded-xl p-3" style={{ background: "var(--c-surface-2)" }}>
                <div><p className="meta-text uppercase tracking-[0.08em]">Résumé des 5 réponses</p><p className="mt-1 text-[28px] font-bold leading-none" style={{ color: state.color }}>{state.score ?? "—"}<span className="ml-1 text-[13px]">/100</span></p></div>
                <div className="text-right"><p className="meta-text">Ta référence personnelle</p><p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{state.baseline == null ? "En construction" : `${state.delta >= 0 ? "+" : ""}${state.delta} vs habitude`}</p></div>
              </div>

              <article className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "var(--c-border)" }}>
                <div className="border-b px-4 py-3 flex items-center gap-2" style={{ borderColor: "var(--c-border)" }}><Activity size={16} style={{ color: state.color }} /><h3 className="card-title">Tes cinq réponses</h3></div>
                <div className="divide-y" style={{ borderColor: "var(--c-border)" }}>
                  {state.factors.map(factor => <div key={factor.key} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--c-border)" }}>
                    <div className="h-2 w-2 rounded-full" style={{ background: FACTOR_COLORS[factor.tone] }} />
                    <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{factor.label}</p><p className="meta-text mt-0.5">{factor.meaning}</p></div>
                    <strong className="text-[15px]" style={{ color: FACTOR_COLORS[factor.tone] }}>{factor.value ?? "—"}/5</strong>
                  </div>)}
                </div>
              </article>

              <article className="mt-3 rounded-xl p-4" style={{ background: "var(--c-surface-2)" }}>
                <div className="flex items-center gap-2"><Calculator size={16} style={{ color: "#B5A3F5" }} /><h3 className="card-title">Calcul transparent</h3></div>
                <code className="mt-3 block rounded-xl p-3 text-[12px] leading-6" style={{ color: "var(--c-text-1)", background: "var(--c-bg)" }}>Moyenne de : sommeil + énergie + (6 − courbatures) + humeur + (6 − stress), puis normalisation de 1–5 vers 0–100.</code>
                <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>C'est un questionnaire interne AthleteOS, pas une mesure physiologique validée. La charge reste un contexte séparé et ne modifie pas secrètement ce résumé.</p>
              </article>

              <article className="mt-3 rounded-xl border p-4" style={{ background: "rgba(91,141,239,0.06)", borderColor: "rgba(91,141,239,0.18)" }}>
                <div className="flex items-center gap-2 text-[#A9CBFB]"><BookOpen size={16} /><h3 className="card-title">Ce que cet état du jour ne dit pas</h3></div>
                <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>Il ne mesure pas directement ta forme physique, ta disponibilité physiologique, ta performance future ou un risque de blessure. Il résume tes réponses pour faciliter une discussion et ne remplace pas le jugement de l'athlète, du coach ou d'un professionnel de santé.</p>
              </article>
            </div>
          </details>
        </div>
      </section>
    </div>, document.body,
  );
}
