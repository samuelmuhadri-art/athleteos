import { MODULE_PRESETS, matchingModulePreset } from "../../domain/modules/moduleRegistry";

export default function ModulePresetPicker({ onSelect, availableKeys, value = [] }) {
  const activePreset = matchingModulePreset(value, availableKeys);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="metric-label">Configuration rapide</p>
        <span className="module-preset-status" data-custom={activePreset ? "false" : "true"}>
          {activePreset?.label ?? "Personnalisé"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Configurations rapides">
        {MODULE_PRESETS.map((preset) => {
          const presetKeys = preset.moduleKeys.filter((key) => !availableKeys || availableKeys.includes(key));
          const selected = activePreset?.id === preset.id;
          return (
            <button key={preset.id} type="button" className="module-preset card card-hover p-3 text-left"
              data-selected={selected ? "true" : "false"} aria-pressed={selected}
              onClick={() => onSelect(presetKeys)}>
              <span className="block text-[13px] font-bold" style={{ color: "var(--c-text-1)" }}>{preset.label}</span>
              <span className="block text-[11px] mt-1 leading-relaxed" style={{ color: "var(--c-text-2)" }}>{preset.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
