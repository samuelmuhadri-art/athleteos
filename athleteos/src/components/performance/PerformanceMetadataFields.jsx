import { useMemo } from "react";
import { BadgeCheck, ChevronDown, Database } from "lucide-react";
import {
  MEASUREMENT_TYPE,
  OFFICIAL_STATUS,
  PERFORMANCE_DIRECTION,
  TIMING_METHOD,
  VENUE_TYPE,
  createPerformanceMetadata,
  getDiscipline,
} from "../../domain/disciplines.js";

const LABEL_STYLE = {
  display: "block", fontSize: 12, fontWeight: 700, color: "var(--c-text-2)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7,
};

const SELECT_OPTIONS = {
  venue_type: [
    [VENUE_TYPE.UNKNOWN, "Non précisé"], [VENUE_TYPE.OUTDOOR, "Plein air"],
    [VENUE_TYPE.INDOOR, "Indoor"], [VENUE_TYPE.ROAD, "Route"],
  ],
  official_status: [
    [OFFICIAL_STATUS.UNKNOWN, "À vérifier"], [OFFICIAL_STATUS.OFFICIAL, "Déclaré officiel"],
    [OFFICIAL_STATUS.UNOFFICIAL, "Non officiel / entraînement"],
  ],
  timing_method: [
    [TIMING_METHOD.UNKNOWN, "Non précisé"], [TIMING_METHOD.FULLY_AUTOMATIC, "Électrique (FAT)"],
    [TIMING_METHOD.HAND, "Manuel"], [TIMING_METHOD.TRANSPONDER, "Transpondeur"],
  ],
};

export default function PerformanceMetadataFields({ discipline, metadata, setMetadata, idPrefix = "performance" }) {
  const definition = getDiscipline(discipline);

  const effectiveMetadata = useMemo(
    () => ({ ...createPerformanceMetadata(discipline), ...(metadata ?? {}) }),
    [discipline, metadata],
  );

  const summary = useMemo(() => {
    if (!definition) return "Épreuve personnalisée · unité et sens requis";
    const direction = definition.higherIsBetter ? "plus haut = meilleur" : "plus bas = meilleur";
    return `${definition.unit} · ${direction} · précision ${definition.decimals} déc.`;
  }, [definition]);

  const set = (key, value) => setMetadata((current = {}) => ({ ...current, [key]: value }));
  const select = (key, label) => (
    <div>
      <label htmlFor={`${idPrefix}-${key}`} style={LABEL_STYLE}>{label}</label>
      <select id={`${idPrefix}-${key}`} className="input-premium" value={effectiveMetadata[key] ?? "unknown"} onChange={(event) => set(key, event.target.value)}>
        {SELECT_OPTIONS[key].map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </div>
  );

  return (
    <details className="rounded-2xl border" style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border)" }}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <Database size={15} style={{ color: "var(--c-accent)" }} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>Contexte technique</span>
            <span className="block truncate text-[12px]" style={{ color: "var(--c-text-2)" }}>{summary}</span>
          </span>
        </span>
        <ChevronDown size={16} style={{ color: "var(--c-text-3)" }} />
      </summary>

      <div className="grid gap-3 border-t px-4 pb-4 pt-4 sm:grid-cols-2" style={{ borderColor: "var(--c-border)" }}>
        {!definition && (
          <>
            <div>
              <label htmlFor={`${idPrefix}-unit`} style={LABEL_STYLE}>Unité *</label>
              <input id={`${idPrefix}-unit`} className="input-premium" placeholder="s, m, kg, pts…" value={effectiveMetadata.unit ?? ""} onChange={(event) => set("unit", event.target.value)} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-direction`} style={LABEL_STYLE}>Sens de performance *</label>
              <select id={`${idPrefix}-direction`} className="input-premium" value={effectiveMetadata.performance_direction ?? PERFORMANCE_DIRECTION.UNKNOWN} onChange={(event) => set("performance_direction", event.target.value)}>
                <option value={PERFORMANCE_DIRECTION.UNKNOWN}>À préciser</option>
                <option value={PERFORMANCE_DIRECTION.LOWER}>Plus bas = meilleur</option>
                <option value={PERFORMANCE_DIRECTION.HIGHER}>Plus haut = meilleur</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-measurement`} style={LABEL_STYLE}>Type de mesure *</label>
              <select id={`${idPrefix}-measurement`} className="input-premium" value={effectiveMetadata.measurement_type ?? MEASUREMENT_TYPE.UNKNOWN} onChange={(event) => set("measurement_type", event.target.value)}>
                <option value={MEASUREMENT_TYPE.UNKNOWN}>À préciser</option>
                <option value={MEASUREMENT_TYPE.TIME}>Temps</option>
                <option value={MEASUREMENT_TYPE.DISTANCE}>Distance / hauteur</option>
                <option value={MEASUREMENT_TYPE.POINTS}>Points</option>
              </select>
            </div>
          </>
        )}

        {select("venue_type", "Environnement")}
        {select("official_status", "Validité déclarée")}
        {definition?.measurementType === MEASUREMENT_TYPE.TIME && select("timing_method", "Chronométrage")}

        {definition?.windMeasurement === "required_for_official_review" && (
          <div>
            <label htmlFor={`${idPrefix}-wind`} style={LABEL_STYLE}>Vent (m/s)</label>
            <input id={`${idPrefix}-wind`} type="number" step="0.1" className="input-premium" placeholder="Ex : +1.2" value={effectiveMetadata.wind_mps ?? ""} onChange={(event) => set("wind_mps", event.target.value)} />
          </div>
        )}
        {definition?.requiresImplementWeight && (
          <div>
            <label htmlFor={`${idPrefix}-implement`} style={LABEL_STYLE}>Poids de l'engin (kg)</label>
            <input id={`${idPrefix}-implement`} type="number" min="0" step="0.001" className="input-premium" placeholder="Ex : 7.260" value={effectiveMetadata.implement_weight_kg ?? ""} onChange={(event) => set("implement_weight_kg", event.target.value)} />
          </div>
        )}
        {definition?.requiresHurdleHeight && (
          <div>
            <label htmlFor={`${idPrefix}-hurdles`} style={LABEL_STYLE}>Hauteur des haies (m)</label>
            <input id={`${idPrefix}-hurdles`} type="number" min="0" step="0.001" className="input-premium" placeholder="Ex : 1.067" value={effectiveMetadata.hurdle_height_m ?? ""} onChange={(event) => set("hurdle_height_m", event.target.value)} />
          </div>
        )}

        <div className="sm:col-span-2 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(29,158,117,0.08)", color: "var(--c-text-2)" }}>
          <BadgeCheck size={15} className="mt-0.5 shrink-0" style={{ color: "var(--tone-success)" }} />
          <p className="text-[12px] leading-5">
            Le statut « déclaré officiel » mémorise ton information ; AthleteOS ne certifie pas automatiquement la conformité aux règles de compétition.
            {effectiveMetadata.scoring_table_version ? ` Référence de tables : ${effectiveMetadata.scoring_table_version}.` : ""}
          </p>
        </div>
      </div>
    </details>
  );
}
