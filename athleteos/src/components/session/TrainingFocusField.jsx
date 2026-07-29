import { Info } from "lucide-react";
import { getDefaultTrainingFocus, getTrainingFocus, getTrainingFocusOptions, isTrainingFocusCompatible } from "../../domain/trainingFocus";

export default function TrainingFocusField({ category, value, onChange, label = "Objectif de la séance" }) {
  const options = getTrainingFocusOptions(category);
  const selectedId = isTrainingFocusCompatible(value, category) ? value : getDefaultTrainingFocus(category);
  const selected = getTrainingFocus(selectedId, category);

  return (
    <div>
      <label className="block text-[12px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--c-text-2)" }}>{label}</label>
      <select
        className="input-premium"
        value={selectedId}
        onChange={event => onChange(event.target.value)}
        aria-describedby="training-focus-help"
      >
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <div id="training-focus-help" className="mt-2 rounded-xl border p-3" style={{ background: "rgba(91,158,245,0.06)", borderColor: "rgba(91,158,245,0.18)" }}>
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: "#A9CBFB" }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{selected.description}</p>
            <p className="mt-1 text-[12px] leading-5" style={{ color: "var(--c-text-2)" }}>{selected.example}</p>
            <p className="mt-1 text-[12px] leading-5" style={{ color: "#A9CBFB" }}>Ce choix explique la séance. Il ne modifie jamais la charge, qui reste durée réelle × effort ressenti.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
