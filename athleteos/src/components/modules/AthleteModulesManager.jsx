import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Users, X } from "lucide-react";
import { MODULE_KEYS } from "../../domain/modules/moduleRegistry";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { useModules } from "../../hooks/useModules";
import ModulePresetPicker from "./ModulePresetPicker";
import ModuleSelector from "./ModuleSelector";

export default function AthleteModulesManager({ onClose }) {
  const { athletes, athlete, club, saveAthletes } = useModules();
  const availableKeys = MODULE_KEYS.filter((key) => club[key] !== false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [moduleKeys, setModuleKeys] = useState(availableKeys);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled: saving });
  const groups = useMemo(() => [...new Set(athletes.map((item) => item.group_name).filter(Boolean))], [athletes]);

  const toggleAthlete = (item) => {
    setSelectedIds((current) => {
      const next = current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id];
      if (!current.length && next.length === 1) setModuleKeys(availableKeys.filter((key) => athlete[item.id]?.[key] !== false));
      return next;
    });
  };
  const selectGroup = (group) => setSelectedIds(athletes.filter((item) => item.group_name === group).map((item) => item.id));
  const save = async () => {
    if (!selectedIds.length) return;
    setSaving(true); setError(null);
    try { await saveAthletes(selectedIds, moduleKeys); onClose(); }
    catch (caught) { setError(caught.message ?? "Enregistrement impossible."); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="modal-content rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        <header className="px-6 py-5 flex justify-between gap-3" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div><p className="meta-text">EFFECTIF MODULAIRE</p><h2 id={titleId} className="text-[18px] font-bold" style={{ color: "var(--c-text-1)" }}>Outils par athlète</h2><p className="text-[12px] mt-1" style={{ color: "var(--c-text-2)" }}>Sélectionne une personne, un groupe ou tout l’effectif, puis applique les outils utiles.</p></div>
          <button type="button" className="icon-btn" aria-label="Fermer" disabled={saving} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSelectedIds(athletes.map((item) => item.id))}><Users size={14} /> Tout</button>
              {groups.map((group) => <button key={group} type="button" className="btn-ghost" onClick={() => selectGroup(group)}>{group}</button>)}
            </div>
            <div className="space-y-1.5">
              {athletes.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-xl p-2.5 cursor-pointer" style={{ background: selectedIds.includes(item.id) ? "var(--c-dim-accent)" : "var(--c-surface-2)" }}>
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleAthlete(item)} style={{ accentColor: "var(--c-accent)" }} />
                <span className="min-w-0"><span className="block text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{item.name}</span><span className="meta-text">{item.group_name ?? "Sans groupe"}</span></span>
              </label>)}
            </div>
          </div>
          <div className="space-y-4">
            <ModulePresetPicker onSelect={setModuleKeys} availableKeys={availableKeys} value={moduleKeys} />
            <ModuleSelector value={moduleKeys} onChange={setModuleKeys} availableKeys={availableKeys} compact />
          </div>
        </div>
        <footer className="px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--c-border)" }}>
          <span className="text-[12px]" style={{ color: error ? "var(--tone-danger)" : "var(--c-text-2)" }}>{error ?? `${selectedIds.length} athlète${selectedIds.length > 1 ? "s" : ""} sélectionné${selectedIds.length > 1 ? "s" : ""}`}</span>
          <button type="button" className="btn-primary" disabled={!selectedIds.length || saving} onClick={save}><Check size={15} /> {saving ? "Application…" : "Appliquer"}</button>
        </footer>
      </section>
    </div>, document.body,
  );
}
