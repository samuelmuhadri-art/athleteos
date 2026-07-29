import { BadgeCheck, Building2, Clock3, Gauge } from "lucide-react";

const VENUE_LABELS = { indoor: "Indoor", outdoor: "Plein air", road: "Route" };
const TIMING_LABELS = { fully_automatic: "Chrono FAT", hand: "Chrono manuel", transponder: "Transpondeur" };

export default function PerformanceContextChips({ performance }) {
  const chips = [];
  if (VENUE_LABELS[performance?.venue_type]) chips.push({ key: "venue", label: VENUE_LABELS[performance.venue_type], Icon: Building2 });
  if (TIMING_LABELS[performance?.timing_method]) chips.push({ key: "timing", label: TIMING_LABELS[performance.timing_method], Icon: Clock3 });
  if (performance?.wind_mps != null) chips.push({ key: "wind", label: `Vent ${Number(performance.wind_mps) > 0 ? "+" : ""}${performance.wind_mps} m/s`, Icon: Gauge });
  if (performance?.implement_weight_kg != null) chips.push({ key: "implement", label: `Engin ${performance.implement_weight_kg} kg`, Icon: Gauge });
  if (performance?.hurdle_height_m != null) chips.push({ key: "hurdles", label: `Haies ${performance.hurdle_height_m} m`, Icon: Gauge });
  if (performance?.official_status === "official") chips.push({ key: "official", label: "Déclaré officiel", Icon: BadgeCheck, accent: true });
  if (!chips.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Contexte technique de la performance">
      {chips.map(({ key, label, Icon, accent }) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{
          color: accent ? "#7BD8B4" : "var(--c-text-2)",
          borderColor: accent ? "rgba(29,158,117,0.25)" : "var(--c-border)",
          background: accent ? "rgba(29,158,117,0.09)" : "var(--c-surface-2)",
        }}>
          <Icon size={11} /> {label}
        </span>
      ))}
    </div>
  );
}
