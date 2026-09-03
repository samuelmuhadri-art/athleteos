import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { MODULE_KEYS } from "../../domain/modules/moduleRegistry";
import { useModules } from "../../hooks/useModules";
import ModulePresetPicker from "./ModulePresetPicker";
import ModuleSelector from "./ModuleSelector";

export default function ClubModulesSettings() {
  const { club, saveClub, restartOnboarding } = useModules();
  const [selected, setSelected] = useState(() => MODULE_KEYS.filter((key) => club[key] !== false));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => setSelected(MODULE_KEYS.filter((key) => club[key] !== false)), [club]);

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      await saveClub(selected);
      setMessage({ tone: "success", text: "Les espaces du club ont été mis à jour." });
    } catch (error) {
      setMessage({ tone: "error", text: error.message ?? "Enregistrement impossible." });
    } finally { setSaving(false); }
  };

  return (
    <section className="settings-branding-card" aria-labelledby="settings-modules-title">
      <div className="settings-branding-heading">
        <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
        <div>
          <p className="meta-text">NIVEAU CLUB</p>
          <h4 id="settings-modules-title">Outils du club</h4>
          <p>Choisis les outils que tu souhaites utiliser avec ton groupe. Un outil désactivé disparaît partout, sans supprimer son historique ni les réglages individuels.</p>
        </div>
      </div>
      <ModulePresetPicker onSelect={setSelected} value={selected} />
      <ModuleSelector value={selected} onChange={setSelected} compact />
      {message && <p className="text-[12px]" role="status" style={{ color: message.tone === "error" ? "var(--tone-danger)" : "var(--tone-success)" }}>{message.text}</p>}
      <div className="module-settings-actions flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-ghost" disabled={saving} onClick={async () => { await restartOnboarding(); setMessage({ tone: "success", text: "L’assistant s’ouvrira à ta prochaine visite." }); }}>
          <RotateCcw size={15} /> Revoir l’assistant
        </button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          <CheckCircle2 size={15} /> {saving ? "Enregistrement…" : "Enregistrer les outils"}
        </button>
      </div>
    </section>
  );
}
