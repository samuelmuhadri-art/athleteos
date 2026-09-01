import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { getTypeConfig } from "../../modules/competitionsShared";

function plannedEventLabel(competition, athleteId) {
  if (athleteId != null) return competition.plannedEvents?.[athleteId] || null;

  const events = Object.values(competition.plannedEvents ?? {}).filter(Boolean);
  const uniqueEvents = [...new Set(events)];
  if (uniqueEvents.length === 0) return null;
  if (uniqueEvents.length <= 2) return uniqueEvents.join(" · ");
  return `${uniqueEvents.slice(0, 2).join(" · ")} +${uniqueEvents.length - 2}`;
}

export default function CompetitionPlanningCard({ competition, athletes = [], athleteId = null, compact = false }) {
  const cfg = getTypeConfig(competition.type);
  const engagedAthletes = athletes.filter(athlete => competition.athleteIds?.includes(athlete.id));
  const plannedEvent = plannedEventLabel(competition, athleteId);

  if (compact) {
    return (
      <div
        role="group"
        aria-label={`Compétition ${competition.name}`}
        className="truncate"
        style={{
          display: "flex", alignItems: "center", gap: 6, minHeight: 32, padding: "6px 8px",
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: cfg.bg, color: cfg.text, borderLeft: `3px solid ${cfg.border}`,
        }}
      >
        <Trophy size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span className="truncate" style={{ flex: 1 }}>{competition.name}</span>
      </div>
    );
  }

  return (
    <article
      aria-label={`Compétition ${competition.name}`}
      className="card overflow-hidden"
      style={{ borderColor: `${cfg.border}66` }}
    >
      <div
        className="px-3.5 py-2.5 flex items-center justify-between gap-2"
        style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}40` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Trophy size={14} aria-hidden="true" style={{ color: cfg.text, flexShrink: 0 }} />
          <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: cfg.text }}>
            Compétition
          </span>
        </div>
        <span className="chip chip-neutral">{cfg.label}</span>
      </div>

      <div className="px-3.5 py-3">
        <p className="text-[13.5px] font-bold leading-tight" style={{ color: "var(--c-text-1)" }}>
          {competition.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px]" style={{ color: "var(--c-text-2)" }}>
          <span className="flex items-center gap-1">
            <CalendarDays size={11} aria-hidden="true" /> Journée entière
          </span>
          {competition.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} aria-hidden="true" /> {competition.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={11} aria-hidden="true" /> {competition.athleteIds?.length ?? 0} athlète{competition.athleteIds?.length === 1 ? "" : "s"}
          </span>
        </div>

        {plannedEvent && (
          <p
            className="mt-2 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
            style={{ background: `${cfg.border}1F`, color: cfg.text }}
          >
            Épreuve prévue : {plannedEvent}
          </p>
        )}

        {athleteId == null && engagedAthletes.length > 0 && (
          <div className="flex -space-x-1.5 mt-3" aria-label="Athlètes concernés">
            {engagedAthletes.slice(0, 5).map(athlete => (
              <div
                key={athlete.id}
                title={athlete.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{ background: cfg.border, color: "#0A150F", border: "2px solid var(--c-surface)" }}
              >
                {athlete.avatar?.slice(0, 1) ?? "?"}
              </div>
            ))}
            {engagedAthletes.length > 5 && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{ background: "var(--c-surface-3)", color: "var(--c-text-3)", border: "2px solid var(--c-surface)" }}
              >
                +{engagedAthletes.length - 5}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
