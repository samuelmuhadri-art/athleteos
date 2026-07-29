// ============================================================
// AthleteOS — src/modules/AthleteCard.jsx
// Carte athlète de la grille — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useMemo } from "react";
import { ChevronRight, HeartPulse } from "lucide-react";
import { getAthleteMetricsForWeek, getStatusLabel } from "../utils/chargeCalculations";
import { getISOWeek } from "../utils/helpers.js";
import { scoreColor } from "./athleteListShared";

const AthleteCard = memo(({ athlete, weeklyCharge, onClick }) => {
  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge, getISOWeek(new Date())), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const status         = getStatusLabel(readiness, fatigue, acwr);
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];
  const hasCharge      = weeklyCharge.some(w => w.athleteId === athlete.id);

  return (
    <button
      type="button"
      onClick={() => onClick(athlete)}
      className="card card-hover card-glow-green shimmer-hover text-left p-5 flex flex-col gap-4 w-full tap-feedback"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
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
      </div>

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
        {activeInjuries.length > 0 && (
          <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(239,159,39,0.15)", color: "#F0CB61", border: "1px solid rgba(239,159,39,0.3)" }}>
            <HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Métriques */}
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Bien-être", value: metrics.wellnessScore ?? "—", color: scoreColor(metrics.wellnessScore ?? 0) },
            { label: "Charge 7j", value: metrics.load7 ?? "—", color: "#378ADD" },
            { label: "Charge 28j", value: metrics.load28 ?? "—", color: "#A9CBFB" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-2.5 text-center" style={{ background: "var(--c-surface-2)" }}>
              <p className="text-[18px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="meta-text mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl p-3 text-center" style={{ background: "var(--c-surface-2)" }}>
          <p className="meta-text font-medium">Pas encore de charge enregistrée</p>
        </div>
      )}

      <p className="meta-text font-medium">{athlete.group ?? "Groupe —"}</p>
    </button>
  );
});

export default AthleteCard;
