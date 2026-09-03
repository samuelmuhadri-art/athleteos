import { MODULE_KEYS, MODULE_REGISTRY } from "../../domain/modules/moduleRegistry";

export default function ActiveToolsSummary({ modules = {}, compact = false, inverted = false }) {
  const activeKeys = MODULE_KEYS.filter((key) => modules[key] !== false);
  const labels = activeKeys.map((key) => MODULE_REGISTRY[key].shortLabel);
  const color = inverted ? "rgba(255,255,255,0.84)" : "var(--c-text-2)";

  if (activeKeys.length > 4) {
    return (
      <details className="active-tools-details" onClick={(event) => event.stopPropagation()}>
        <summary style={{ color }}>{activeKeys.length} outils actifs</summary>
        <p style={{ color }}>{labels.join(" · ")}</p>
      </details>
    );
  }

  return (
    <p className={compact ? "active-tools-summary active-tools-summary--compact" : "active-tools-summary"} style={{ color }}>
      {labels.length ? labels.join(" · ") : "Aucun outil actif"}
    </p>
  );
}
