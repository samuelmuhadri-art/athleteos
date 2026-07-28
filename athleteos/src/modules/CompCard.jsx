// ============================================================
// AthleteOS — src/modules/CompCard.jsx
// Carte compétition de la timeline — extraite de Competitions.jsx.
// ============================================================

import { memo } from "react";
import { MapPin, CalendarDays, ChevronRight, CheckCircle } from "lucide-react";
import { getTypeConfig, daysUntil, formatDateShort, athleteColor } from "./competitionsShared";

const CompCard = memo(({ competition, athletes, isPast, isNext, onClick }) => {
  const cfg            = getTypeConfig(competition.type);
  const days           = daysUntil(competition.date);
  const hasResults     = competition.results?.length > 0;
  const engagedAthletes = athletes.filter((a) => competition.athleteIds.includes(a.id));

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center flex-shrink-0 w-12">
        <div
          className="w-4 h-4 rounded-full border-2 border-[var(--c-bg)] shadow-md flex-shrink-0 z-10 mt-5"
          style={{ background: cfg.dot }}
        />
        <div className="flex-1 w-0.5 bg-[var(--c-border-strong)] mt-1" />
      </div>

      <button
        type="button"
        onClick={() => onClick(competition)}
        aria-label={`Ouvrir ${competition.name}, ${formatDateShort(competition.date)}`}
        className="flex-1 mb-4 text-left rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 overflow-hidden"
        style={{ background: "var(--c-surface)", borderColor: isNext ? cfg.border : "var(--c-border)", borderWidth: isNext ? "1.5px" : "1px" }}
      >
        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{ background: cfg.bg, borderBottom: `1.5px solid ${cfg.border}20` }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: cfg.text }}>
              {cfg.label}
            </span>
            {isNext && (
              <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-emerald-500 text-white ml-1">
                PROCHAINE
              </span>
            )}
          </div>
          {isPast ? (
            hasResults ? (
              <span className="text-[12px] font-semibold text-[var(--color-success)] bg-[rgba(29,158,117,0.15)] px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={12} /> Résultats disponibles
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-[var(--c-text-2)] bg-[rgba(255,255,255,0.08)] px-2 py-1 rounded-full">
                Passée · sans résultat
              </span>
            )
          ) : (
            <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-[rgba(255,255,255,0.08)] text-[var(--c-text-2)]">
              {days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`}
            </span>
          )}
        </div>

        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="section-title mb-2">
              {competition.name}
            </h3>
            <div className="flex items-center gap-4 text-[12px] text-[var(--c-text-2)] mb-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} />
                {formatDateShort(competition.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={12} />
                {competition.location || "Lieu non renseigné"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {engagedAthletes.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    title={a.name}
                    className="w-8 h-8 rounded-full border-2 border-[var(--c-surface)] flex items-center justify-center text-white text-[12px] font-semibold"
                    style={{ background: athleteColor(a.id, athletes) }}
                  >
                    {a.avatar.slice(0, 1)}
                  </div>
                ))}
                {engagedAthletes.length > 5 && (
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--c-surface)] bg-[var(--c-surface-3)] flex items-center justify-center text-[var(--c-text-2)] text-[12px] font-semibold">
                    +{engagedAthletes.length - 5}
                  </div>
                )}
              </div>
              <span className="text-[12px] text-[var(--c-text-2)]">
                {engagedAthletes.length} athlète{engagedAthletes.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--c-text-3)] flex-shrink-0 mt-1 group-hover:text-[var(--c-text-2)] transition-colors" />
        </div>
      </button>
    </div>
  );
});

export default CompCard;
