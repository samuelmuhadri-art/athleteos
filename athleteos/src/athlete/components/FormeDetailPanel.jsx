import { memo, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertCircle, BookOpen, Calculator, CheckCircle2, Database, X } from "lucide-react";
import { getMonitoringReading } from "../../domain/monitoringMetrics.js";
import { getISOWeek } from "../shared";

const LOAD_KEYS = new Set(["load7", "load28", "ewmaAcute", "ewmaChronic", "variation", "monotony", "acwrExperimental"]);

const FormeDetailPanel = memo(({ metricKey, metrics, sessions, weeklyCharge, athlete, onClose }) => {
  const reading = getMonitoringReading(metricKey, metrics);
  const currentWeek = getISOWeek(new Date());

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const recentSessions = useMemo(() => (sessions ?? [])
    .filter((session) => session.athleteIds?.includes(athlete.id))
    .map((session) => ({
      ...session,
      validation: session.validations?.find((item) => item.athleteId === athlete.id),
    }))
    .filter((session) => session.validation?.rpe != null)
    .sort((a, b) => String(b.sessionDate ?? "").localeCompare(String(a.sessionDate ?? "")))
    .slice(0, 6), [athlete.id, sessions]);

  const recentWeeks = useMemo(() => (weeklyCharge ?? [])
    .filter((week) => week.athleteId === athlete.id)
    .sort((a, b) => a.week - b.week)
    .slice(-4), [athlete.id, weeklyCharge]);

  if (!reading) return null;
  const color = reading.color;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center modal-backdrop"
      style={{ background: "rgba(2,7,12,0.76)", backdropFilter: "blur(12px)" }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitoring-detail-title"
        className="w-full max-w-2xl overflow-hidden rounded-t-3xl border"
        style={{
          maxHeight: "92dvh",
          background: "linear-gradient(180deg, var(--c-surface) 0%, var(--c-bg) 100%)",
          borderColor: "var(--c-border-strong)",
          boxShadow: "0 -24px 80px rgba(0,0,0,0.52)",
          animation: "sheet-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        <header className="relative overflow-hidden px-5 pb-5 pt-3 sm:px-6">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{
            background: `radial-gradient(circle at 12% 20%, ${color}24 0%, transparent 42%), linear-gradient(135deg, ${color}0D, transparent 60%)`,
          }} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="chip" style={{ background: `${color}18`, borderColor: `${color}32`, color }}>
                  {reading.kind}
                </span>
                <span className="chip chip-neutral">{reading.evidence}</span>
              </div>
              <h2 id="monitoring-detail-title" className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: "var(--c-text-1)" }}>
                {reading.shortLabel}
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6" style={{ color: "var(--c-text-2)" }}>
                {reading.athleteMeaning}. Le détail scientifique reste disponible ci-dessous.
              </p>
            </div>
            <button type="button" aria-label="Fermer le détail" onClick={onClose} className="btn-icon flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="relative mt-5 flex items-end justify-between gap-4 rounded-2xl border px-4 py-4" style={{ background: `${color}0B`, borderColor: `${color}25` }}>
            <div>
              <p className="meta-text uppercase tracking-[0.08em]">Valeur actuelle</p>
              <div className="mt-1 flex items-end gap-2">
                <strong className="text-[34px] leading-none tracking-[-0.04em]" style={{ color, fontVariantNumeric: "tabular-nums" }}>
                  {reading.displayValue}
                </strong>
                {reading.unit && <span className="pb-1 text-[13px] font-semibold" style={{ color: "var(--c-text-2)" }}>{reading.unit}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold" style={{
              background: reading.available ? "rgba(29,158,117,0.12)" : "rgba(239,159,39,0.12)",
              color: reading.available ? "#7BD8B4" : "#F6C76B",
            }}>
              {reading.available ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {reading.available ? "Donnée disponible" : "À compléter"}
            </div>
          </div>
        </header>

        <div className="overflow-y-auto px-5 pb-8 sm:px-6" style={{ maxHeight: "calc(92dvh - 245px)" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="card p-4">
              <div className="mb-2 flex items-center gap-2" style={{ color }}><Activity size={16} /><h3 className="card-title">Lecture actuelle</h3></div>
              <p className="secondary-text leading-6">{reading.interpretation}</p>
              {reading.missingReason && (
                <div className="mt-3 rounded-xl border px-3 py-2.5 text-[12px] leading-5" style={{ background: "rgba(239,159,39,0.08)", borderColor: "rgba(239,159,39,0.22)", color: "var(--tone-warning)" }}>
                  Pourquoi « — » : {reading.missingReason}
                </div>
              )}
            </article>

            <article className="card p-4">
              <div className="mb-2 flex items-center gap-2" style={{ color }}><BookOpen size={16} /><h3 className="card-title">Ce que cette ligne indique</h3></div>
              <p className="secondary-text leading-6">{reading.meaning}</p>
            </article>
          </div>

          <article className="card mt-3 overflow-hidden">
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--c-border)", color }}>
              <Calculator size={16} />
              <h3 className="card-title">Méthode de calcul</h3>
            </div>
            <div className="p-4">
              <code className="block rounded-xl px-3 py-3 text-[12px] leading-6" style={{ background: "var(--c-surface-2)", color: "var(--c-text-1)", whiteSpace: "normal" }}>
                {reading.formula}
              </code>
              <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>
                <strong style={{ color: "var(--c-text-1)" }}>Limite :</strong> {reading.limits}
              </p>
              <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--c-text-3)" }}>
                Nom scientifique dans AthleteOS : {reading.label}.
              </p>
            </div>
          </article>

          {metricKey === "spacing" && metrics.recovery?.factors?.length > 0 && (
            <article className="card mt-3 p-4">
              <div className="mb-3 flex items-center gap-2" style={{ color }}><Database size={16} /><h3 className="card-title">Paramètre appliqué</h3></div>
              {metrics.recovery.factors.map((factor, index) => (
                <p key={index} className="secondary-text rounded-xl px-3 py-2" style={{ background: "var(--c-surface-2)" }}>{factor.label}</p>
              ))}
            </article>
          )}

          {LOAD_KEYS.has(metricKey) && recentSessions.length > 0 && (
            <article className="card mt-3 overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--c-border)" }}>
                <div className="flex items-center gap-2" style={{ color }}><Database size={16} /><h3 className="card-title">Séances contributrices récentes</h3></div>
                <span className="meta-text">S{currentWeek}</span>
              </div>
              <div>
                {recentSessions.map((session, index) => {
                  const duration = session.validation?.actualDurationMinutes;
                  const rpe = session.validation?.rpe;
                  const load = Number.isFinite(Number(duration)) && Number.isFinite(Number(rpe)) ? Math.round(Number(duration) * Number(rpe)) : null;
                  return (
                    <div key={session.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: index ? "1px solid var(--c-border)" : "none" }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold" style={{ background: `${color}14`, color }}>{rpe}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{session.title}</p>
                        <p className="meta-text mt-0.5">{session.sessionDate ?? `S${session.week}`} · {duration == null ? "durée réelle inconnue" : `${duration} min réelles`} · RPE {rpe}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold" style={{ color }}>{load ?? "—"}</p>
                        <p className="meta-text">charge</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          {LOAD_KEYS.has(metricKey) && recentWeeks.length > 0 && (
            <article className="card mt-3 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="card-title">Qualité des quatre dernières semaines</h3>
                <span className="meta-text">0 confirmé ≠ inconnu</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {recentWeeks.map((week) => {
                  const complete = (week.unknownDays ?? 0) === 0 && (week.knownDays ?? 0) > 0;
                  return (
                    <div key={week.week} className="rounded-xl border px-2 py-3 text-center" style={{ background: "var(--c-surface-2)", borderColor: complete ? "rgba(29,158,117,0.24)" : "rgba(239,159,39,0.22)" }}>
                      <p className="text-[12px] font-bold" style={{ color: complete ? "#7BD8B4" : "#F6C76B" }}>S{week.week}</p>
                      <p className="meta-text mt-1">{week.knownDays ?? 0} connus</p>
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          <article className="mt-3 rounded-2xl border p-4" style={{ background: "rgba(91,141,239,0.06)", borderColor: "rgba(91,141,239,0.18)" }}>
            <div className="mb-2 flex items-center gap-2 text-[#A9CBFB]"><BookOpen size={16} /><h3 className="card-title">Références et statut</h3></div>
            {reading.sources.map((source) => <p key={source} className="text-[12px] leading-6" style={{ color: "var(--c-text-2)" }}>{source}</p>)}
            <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--c-text-3)" }}>
              AthleteOS affiche cette mesure pour documenter le suivi. La décision d'entraînement reste contextualisée avec l'athlète et le coach.
            </p>
          </article>
        </div>
      </section>
    </div>,
    document.body,
  );
});

export default FormeDetailPanel;
