// ============================================================
// AthleteOS — src/modules/AthleteCard.jsx
// Carte athlète de la grille — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useMemo } from "react";
import { ChevronRight, HeartPulse, SlidersHorizontal } from "lucide-react";
import { getAthleteMetricsForWeek, getWellnessStatus } from "../utils/chargeCalculations";
import { getISOWeek } from "../utils/helpers.js";
import { scoreColor } from "./athleteListUtils";
import ActiveToolsSummary from "../components/modules/ActiveToolsSummary";

const AthleteCard = memo(({ athlete, weeklyCharge, modules = {}, onClick, onConfigureTools }) => {
  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge, getISOWeek(new Date())), [athlete.id, weeklyCharge]);
  const status         = getWellnessStatus(metrics.wellnessScore);
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];
  const hasCharge      = modules.training_load !== false && weeklyCharge.some(w => w.athleteId === athlete.id);
  const showWellness   = modules.wellness !== false;
  const showHealth     = modules.health !== false;

  return (
    <article className="card card-hover card-glow-green shimmer-hover text-left p-5 flex flex-col gap-4 w-full">
      {/* Header */}
      <button type="button" onClick={() => onClick(athlete)} className="flex items-start justify-between gap-2 text-left w-full tap-feedback" aria-label={`Ouvrir le profil de ${athlete.name}`}>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0 shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}
          >
            {athlete.avatar}
          </div>
          <div>
            <p className="card-title leading-tight">{athlete.name}</p>
            <p className="meta-text mt-0.5">{athlete.mainDiscipline ?? "—"}</p>
          </div>
        </div>
        <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: "var(--c-text-3)" }} />
      </button>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {hasCharge && (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: status.color, color: "#07110C" }}>
            {status.dot} {status.label}
          </span>
        )}
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}>
          {athlete.level ?? "Niveau —"}
        </span>
        {showHealth && activeInjuries.length > 0 && (
          <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(239,159,39,0.15)", color: "var(--tone-warning)", border: "1px solid rgba(239,159,39,0.3)" }}>
            <HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Métriques */}
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            showWellness ? { label: "Bien-être", value: metrics.wellnessScore ?? "—", color: scoreColor(metrics.wellnessScore ?? 0) } : null,
            { label: "Charge 7j", value: metrics.load7 ?? "—", color: "#378ADD" },
            { label: "Charge 28j", value: metrics.load28 ?? "—", color: "var(--tone-info)" },
          ].filter(Boolean).map(s => (
            <div key={s.label} className="rounded-2xl p-2.5 text-center" style={{ background: "var(--c-surface-2)" }}>
              <p className="text-[18px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="meta-text mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      ) : modules.performances !== false ? (
        <div className="rounded-2xl p-3 text-center" style={{ background: "var(--c-surface-2)" }}>
          <p className="meta-text font-medium">{Object.keys(athlete.records ?? {}).length} performance{Object.keys(athlete.records ?? {}).length > 1 ? "s" : ""} suivie{Object.keys(athlete.records ?? {}).length > 1 ? "s" : ""}</p>
        </div>
      ) : null}

      <p className="meta-text font-medium">{athlete.group ?? "Groupe —"}</p>
      <div className="athlete-tools-preview">
        <div className="min-w-0">
          <p className="metric-label">Outils actifs</p>
          <ActiveToolsSummary modules={modules} compact />
        </div>
        <button type="button" className="btn-secondary athlete-tools-action" onClick={() => onConfigureTools?.(athlete)}>
          <SlidersHorizontal size={14} aria-hidden="true" /> Configurer les outils
        </button>
      </div>
    </article>
  );
});

export default AthleteCard;
