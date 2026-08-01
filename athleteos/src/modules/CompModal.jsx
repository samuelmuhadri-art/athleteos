// ============================================================
// AthleteOS — src/modules/CompModal.jsx
// Modal de détail d'une compétition — extraite de Competitions.jsx.
// ============================================================

import { memo } from "react";
import { MapPin, CalendarDays, Users, Trophy, X, Zap } from "lucide-react";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { getTypeConfig, daysUntil, formatDate, dateToWeek, athleteColor, generateResultAnalysis } from "./competitionsShared";
import { parsePerf } from "../athlete/shared.js";
import AddResultInline from "./AddResultInline";
import PerformanceContextChips from "../components/performance/PerformanceContextChips.jsx";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";

const CompModal = memo(({ competition, athletes, weeklyCharge, records, onClose, onAddResult }) => {
  const { dialogRef } = useAccessibleDialog({ onClose, enabled: Boolean(competition) });
  if (!competition) return null;

  const cfg            = getTypeConfig(competition.type);
  const isPast         = daysUntil(competition.date) < 0;
  const days           = daysUntil(competition.date);
  const engagedAthletes = athletes.filter((a) => competition.athleteIds.includes(a.id));

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="competition-detail-title" className="modal-content bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div
          className="px-4 sm:px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.border}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[12px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: cfg.border + "25", color: cfg.text }}
              >
                {cfg.label}
              </span>
              {!isPast && days <= 14 && days >= 0 && (
                <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-emerald-500 text-white">
                  {days === 0 ? "Aujourd'hui !" : `Dans ${days} jours`}
                </span>
              )}
              {isPast && (
                <span className="text-[12px] font-semibold text-[var(--c-text-2)] bg-[rgba(255,255,255,0.08)] px-2 py-1 rounded-full border border-[var(--c-border-strong)]">
                  Compétition passée
                </span>
              )}
            </div>
            <h3 id="competition-detail-title" className="text-[20px] font-bold leading-tight" style={{ color: cfg.text }}>
              {competition.name}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-[12px] flex-wrap" style={{ color: cfg.text + "bb" }}>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} />
                {formatDate(competition.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {competition.location || "Lieu non renseigné"}
              </span>
            </div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors flex-shrink-0">
            <X size={18} style={{ color: cfg.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">

          {/* ── Athlètes engagés ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[var(--c-text-3)]" />
              <h4 className="metric-label">
                Athlètes engagés ({engagedAthletes.length})
              </h4>
            </div>
            {engagedAthletes.length === 0 ? (
              <p className="text-[12px] text-[var(--c-text-3)]">Aucun athlète engagé pour l'instant.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {engagedAthletes.map((a) => {
                  const color        = athleteColor(a.id, athletes);
                  const result       = competition.results?.find((r) => r.athleteId === a.id);
                  const plannedEvent = competition.plannedEvents?.[a.id];
                  const week         = dateToWeek(competition.date);
                  const metrics      = getAthleteMetricsForWeek(a.id, weeklyCharge, week, [], [], competition.date);

                  return (
                    <div key={a.id} className="bg-[var(--c-surface-2)] rounded-xl border border-[var(--c-border)] p-3.5 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                        style={{ background: color }}
                      >
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--c-text-1)]">{a.name}</p>
                        {plannedEvent && (
                          <p className="text-[12px] text-[var(--c-text-2)] flex items-center gap-1 mt-1">
                            <Zap size={12} className="text-amber-500" />
                            Prévu : <strong className="text-[var(--c-text-2)]">{plannedEvent}</strong>
                          </p>
                        )}
                        {result ? (
                          <div className="mt-1.5">
                            <p className="text-[13px] text-[var(--c-text-2)]">
                              {result.event} :{" "}
                              <strong className="text-emerald-600">{result.result}</strong>
                              {(() => {
                                const rec   = records.find((r) => r.athleteId === a.id && r.discipline === result.event);
                                // Tâche 12 : comparaison numérique (moteur central,
                                // tâche 11) au lieu d'une égalité de chaînes brute —
                                // "11.20" vs "11.2" ne matchait pas alors qu'ils
                                // désignent la même performance.
                                const recPrVal    = parsePerf(rec?.pr).value;
                                const resultVal   = parsePerf(result.result).value;
                                const isPR  = rec && recPrVal != null && resultVal != null
                                  && recPrVal === resultVal && rec.prDate === competition.date;
                                return isPR ? (
                                  <span className="ml-1.5 text-[12px] font-semibold text-[var(--color-warning)]">🏆 Nouveau record !</span>
                                ) : null;
                              })()}
                            </p>
                          </div>
                        ) : isPast ? (
                          <AddResultInline
                            athlete={a}
                            competitionId={competition.id}
                            defaultEvent={plannedEvent}
                            onAdd={onAddResult}
                          />
                        ) : (
                          <div className="flex items-center gap-2 mt-2 text-[12px] text-[var(--c-text-2)] flex-wrap">
                            <span>Charge observée sur 7 jours :</span>
                            <span className="font-bold" style={{ color: "var(--tone-info)" }}>
                              {metrics.load7 ?? "—"}
                            </span>
                            <span>· Bien-être :</span>
                            <span className="font-bold" style={{ color: "var(--tone-success)" }}>
                              {metrics.wellnessScore == null ? "—" : `${metrics.wellnessScore}/100`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Résultats + analyse contextuelle ─────────────────────── */}
          {isPast && competition.results?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} className="text-[var(--c-text-3)]" />
                <h4 className="metric-label">
                  Résultats & Analyse contextuelle
                </h4>
              </div>
              <div className="space-y-4">
                {competition.results.map((result, i) => {
                  const athlete  = athletes.find((a) => a.id === result.athleteId);
                  if (!athlete) return null;
                  const color    = athleteColor(athlete.id, athletes);
                  const analysis = generateResultAnalysis(result, competition, athlete, weeklyCharge);
                  const week     = dateToWeek(competition.date);
                  const metrics  = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week, [], [], competition.date);

                  return (
                    <div key={i} className="bg-[var(--c-surface-2)] rounded-xl border border-[var(--c-border)] overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold"
                            style={{ background: color }}
                          >
                            {athlete.avatar}
                          </div>
                          <span className="text-[13px] font-semibold text-[var(--c-text-1)]">{athlete.name}</span>
                          <span className="text-[12px] text-[var(--c-text-2)]">{result.event}</span>
                        </div>
                        <span className="text-[16px] font-semibold text-[var(--color-success)]">{result.result}</span>
                      </div>

                      <div className="px-4 py-3 bg-[var(--c-surface-3)] border-b border-[var(--c-border)] flex items-center gap-4 flex-wrap text-[12px]">
                        <span className="text-[var(--c-text-3)]">À la semaine ~{week} :</span>
                        <span className="flex items-center gap-1">
                          Cette semaine :
                          <strong className="ml-1" style={{ color: "var(--tone-info)" }}>
                            {metrics.load7 ?? "—"}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          Rythme habituel · 4 sem. :
                          <strong className="ml-1" style={{ color: "var(--tone-success)" }}>
                            {metrics.load28 ?? "—"}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          Bien-être déclaré :
                          <strong className="ml-1" style={{ color: "var(--tone-info)" }}>
                            {metrics.wellnessScore == null ? "—" : `${metrics.wellnessScore}/100`}
                          </strong>
                        </span>
                      </div>

                      <div className="px-4 py-3 space-y-1.5">
                        {analysis.map((line, j) => (
                          <p key={j} className="text-[12px] text-[var(--c-text-2)] leading-relaxed">{line}</p>
                        ))}
                        {result.context && (
                          <p className="text-[12px] text-[var(--c-text-2)] italic pt-2 border-t border-[var(--c-border)] mt-2">
                            Note du coach : {result.context}
                          </p>
                        )}
                        <PerformanceContextChips performance={result} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isPast && !(competition.results?.length > 0) && (
            <div className="bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-6 text-center">
              <Trophy size={24} className="mx-auto mb-2 text-[var(--c-text-3)]" />
              <p className="text-[13px] text-[var(--c-text-2)]">
                Aucun résultat enregistré pour cette compétition. Utilise "Ajouter un résultat" sous chaque athlète ci-dessus.
              </p>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-[var(--c-border)] flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});

export default CompModal;
