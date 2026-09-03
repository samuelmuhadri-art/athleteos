import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, SlidersHorizontal } from "lucide-react";
import { MODULE_KEYS } from "../../domain/modules/moduleRegistry";
import { useModules } from "../../hooks/useModules";
import ModulePresetPicker from "./ModulePresetPicker";
import ModuleSelector from "./ModuleSelector";

export default function ModuleOnboardingModal() {
  const { configuredAt, loading, athletes, saveClub, saveAthletes, club } = useModules();
  const [step, setStep] = useState(1);
  const [clubKeys, setClubKeys] = useState(() => MODULE_KEYS.filter((key) => club[key] !== false));
  const [athleteKeys, setAthleteKeys] = useState(() => MODULE_KEYS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const availableAthleteKeys = useMemo(() => MODULE_KEYS.filter((key) => clubKeys.includes(key)), [clubKeys]);

  if (loading || configuredAt) return null;
  const finish = async () => {
    setSaving(true); setError(null);
    try {
      await saveClub(clubKeys);
      if (athletes.length) await saveAthletes(athletes.map((athlete) => athlete.id), athleteKeys.filter((key) => clubKeys.includes(key)));
    } catch (caught) {
      setError(caught.message ?? "Configuration impossible.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="module-onboarding-title"
        className="modal-content rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden">
        <header className="px-6 py-5 flex items-start gap-3" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--c-dim-accent)", color: "var(--c-accent)" }}><SlidersHorizontal size={20} /></span>
          <div>
            <p className="meta-text">ÉTAPE {step} SUR 2</p>
            <h2 id="module-onboarding-title" className="text-[20px] font-bold" style={{ color: "var(--c-text-1)" }}>
              {step === 1 ? "Quels outils veux-tu utiliser ?" : "Comment veux-tu suivre tes athlètes ?"}
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--c-text-2)" }}>
              {step === 1 ? "Tu pourras tout modifier plus tard. Aucun historique ne sera supprimé." : "Choisis une base commune maintenant, puis affine par groupe ou par athlète dans Effectif."}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <ModulePresetPicker onSelect={step === 1 ? setClubKeys : setAthleteKeys} availableKeys={step === 2 ? availableAthleteKeys : undefined} value={step === 1 ? clubKeys : athleteKeys} />
          <ModuleSelector
            value={step === 1 ? clubKeys : athleteKeys}
            onChange={step === 1 ? setClubKeys : setAthleteKeys}
            availableKeys={step === 1 ? MODULE_KEYS : availableAthleteKeys}
          />
          {step === 2 && <p className="meta-text">Cette sélection sera appliquée aux {athletes.length} athlète{athletes.length > 1 ? "s" : ""} actuel{athletes.length > 1 ? "s" : ""}.</p>}
          {error && <p role="alert" className="text-[12px]" style={{ color: "var(--tone-danger)" }}>{error}</p>}
        </div>
        <footer className="px-6 py-4 flex justify-between gap-3" style={{ borderTop: "1px solid var(--c-border)" }}>
          {step === 2 ? <button type="button" className="btn-secondary" disabled={saving} onClick={() => setStep(1)}><ArrowLeft size={15} /> Retour</button> : <span />}
          {step === 1
            ? <button type="button" className="btn-primary" onClick={() => { setAthleteKeys(clubKeys); setStep(2); }}>Continuer <ArrowRight size={15} /></button>
            : <button type="button" className="btn-primary" disabled={saving} onClick={finish}><Check size={15} /> {saving ? "Configuration…" : "Terminer"}</button>}
        </footer>
      </section>
    </div>
  );
}
