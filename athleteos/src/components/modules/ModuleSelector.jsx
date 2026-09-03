import { MODULE_GROUPS, MODULE_KEYS, MODULE_REGISTRY, toggleModule } from "../../domain/modules/moduleRegistry";

export default function ModuleSelector({ value, onChange, availableKeys = MODULE_KEYS, compact = false }) {
  const selected = new Set(value ?? []);
  const activeCount = availableKeys.filter((key) => selected.has(key)).length;
  return (
    <div className="space-y-4">
      <div className="module-selection-summary" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <span>{activeCount} outil{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}</span>
          <span className="module-selection-total">sur {availableKeys.length}</span>
        </div>
        <span className="module-selection-meter" aria-hidden="true">
          <span style={{ width: `${availableKeys.length ? (activeCount / availableKeys.length) * 100 : 0}%` }} />
        </span>
      </div>
      {MODULE_GROUPS.map((group) => {
        const entries = availableKeys.filter((key) => MODULE_REGISTRY[key].group === group.id);
        if (!entries.length) return null;
        return (
          <fieldset key={group.id} className="space-y-2">
            <legend className="meta-text font-bold uppercase tracking-wider mb-2">{group.label}</legend>
            <div className={compact ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-2"}>
              {entries.map((key) => {
                const module = MODULE_REGISTRY[key];
                const checked = selected.has(key);
                return (
                  <label key={key} className="module-option flex items-start gap-3 rounded-2xl p-3 cursor-pointer"
                    data-selected={checked ? "true" : "false"}
                    style={{ background: checked ? "var(--c-dim-accent)" : "var(--c-surface-2)", border: `1px solid ${checked ? "var(--c-accent)" : "var(--c-border)"}` }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onChange(toggleModule(value, key, event.target.checked, availableKeys))}
                      className="mt-1 h-4 w-4"
                      style={{ accentColor: "var(--c-accent)" }}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold" style={{ color: "var(--c-text-1)" }}>{module.label}</span>
                      {!compact && <span className="module-option-description block text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--c-text-2)" }}>{module.description}</span>}
                      {module.dependsOn?.length > 0 && (
                        <span className="block text-[11px] mt-1" style={{ color: "var(--tone-info)" }}>
                          Active automatiquement {module.dependsOn.map((dependency) => MODULE_REGISTRY[dependency].shortLabel).join(", ")}.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
