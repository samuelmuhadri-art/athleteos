import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Layers3, UserRound, Users, X } from "lucide-react";
import { MODULE_KEYS, MODULE_REGISTRY } from "../../domain/modules/moduleRegistry";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { useModules } from "../../hooks/useModules";
import ModulePresetPicker from "./ModulePresetPicker";
import ModuleSelector from "./ModuleSelector";

function enabledKeysForAthlete(configuration, athleteId, availableKeys) {
  return availableKeys.filter((key) => configuration[athleteId]?.[key] !== false);
}

export default function AthleteModulesManager({ onClose, initialAthleteId = null, initialMode = "athlete" }) {
  const { athletes, athlete, club, saveAthletes, saveModuleForAthletes } = useModules();
  const availableKeys = MODULE_KEYS.filter((key) => club[key] !== false);
  const [mode, setMode] = useState(initialMode);
  const [selectedIds, setSelectedIds] = useState(() => initialAthleteId == null ? [] : [initialAthleteId]);
  const [moduleKeys, setModuleKeys] = useState(() => initialAthleteId == null
    ? availableKeys
    : enabledKeysForAthlete(athlete, initialAthleteId, availableKeys));
  const [selectedModule, setSelectedModule] = useState(() => availableKeys[0] ?? null);
  const [moduleAthleteIds, setModuleAthleteIds] = useState(() => availableKeys[0]
    ? athletes.filter((item) => athlete[item.id]?.[availableKeys[0]] !== false).map((item) => item.id)
    : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled: saving });
  const groups = useMemo(() => [...new Set(athletes.map((item) => item.group_name).filter(Boolean))], [athletes]);
  const selectedAthlete = selectedIds.length === 1 ? athletes.find((item) => item.id === selectedIds[0]) : null;

  const chooseModule = (moduleKey) => {
    setSelectedModule(moduleKey);
    setModuleAthleteIds(athletes.filter((item) => athlete[item.id]?.[moduleKey] !== false).map((item) => item.id));
  };

  const toggleAthlete = (item) => {
    setSelectedIds((current) => {
      const next = current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id];
      if (next.length === 1) setModuleKeys(enabledKeysForAthlete(athlete, next[0], availableKeys));
      return next;
    });
  };

  const selectGroup = (group) => {
    const ids = athletes.filter((item) => item.group_name === group).map((item) => item.id);
    setSelectedIds(ids);
    if (ids.length === 1) setModuleKeys(enabledKeysForAthlete(athlete, ids[0], availableKeys));
  };

  const save = async () => {
    if (mode === "athlete" && !selectedIds.length) return;
    if (mode === "module" && !selectedModule) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "athlete") await saveAthletes(selectedIds, moduleKeys);
      else await saveModuleForAthletes(selectedModule, moduleAthleteIds);
      onClose();
    } catch (caught) {
      setError(caught.message ?? "Enregistrement impossible.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="modal-content rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94dvh] flex flex-col overflow-hidden">
        <header className="px-5 sm:px-6 py-5 flex justify-between gap-3" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <p className="meta-text">GESTION DES OUTILS</p>
            <h2 id={titleId} className="text-[19px] font-bold" style={{ color: "var(--c-text-1)" }}>Personnaliser le suivi</h2>
            <p className="text-[12px] mt-1" style={{ color: "var(--c-text-2)" }}>Outils du club → outils réellement visibles par chaque athlète.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Fermer" disabled={saving} onClick={onClose}><X size={18} /></button>
        </header>

        <div className="px-5 sm:px-6 pt-4">
          <div className="module-scope-note">
            <Layers3 size={16} aria-hidden="true" />
            <span><strong>{availableKeys.length} outils autorisés par le club.</strong> Tu choisis ici lesquels chaque athlète utilise, sans effacer son historique.</span>
          </div>
          <div className="module-manager-tabs" role="tablist" aria-label="Méthode de configuration">
            <button type="button" role="tab" aria-selected={mode === "athlete"} data-active={mode === "athlete"} onClick={() => setMode("athlete")}>
              <UserRound size={15} /> Par athlète
            </button>
            <button type="button" role="tab" aria-selected={mode === "module"} data-active={mode === "module"} onClick={() => setMode("module")}>
              <Layers3 size={15} /> Par outil
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4">
          {mode === "athlete" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <div className="space-y-3">
                <div><p className="card-title">1. Choisir qui</p><p className="card-subtitle">Une personne, un groupe ou tout l’effectif.</p></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setSelectedIds(athletes.map((item) => item.id))}><Users size={14} /> Tout</button>
                  {groups.map((group) => <button key={group} type="button" className="btn-ghost" onClick={() => selectGroup(group)}>{group}</button>)}
                </div>
                <div className="space-y-1.5">
                  {athletes.map((item) => {
                    const activeCount = enabledKeysForAthlete(athlete, item.id, availableKeys).length;
                    return <label key={item.id} className="module-athlete-choice" data-selected={selectedIds.includes(item.id) ? "true" : "false"}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleAthlete(item)} />
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{item.name}</span><span className="meta-text">{item.group_name ?? "Sans groupe"}</span></span>
                      <span className="module-athlete-count">{activeCount}/{availableKeys.length}</span>
                    </label>;
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <div><p className="card-title">2. Choisir les outils</p><p className="card-subtitle">{selectedAthlete ? `Ce que ${selectedAthlete.name.split(" ")[0]} voit dans AthleteOS.` : selectedIds.length > 1 ? `Même configuration pour ${selectedIds.length} athlètes.` : "Sélectionne un athlète pour personnaliser son expérience."}</p></div>
                <ModulePresetPicker onSelect={setModuleKeys} availableKeys={availableKeys} value={moduleKeys} />
                <ModuleSelector value={moduleKeys} onChange={setModuleKeys} availableKeys={availableKeys} compact />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-6">
              <div className="space-y-3">
                <div><p className="card-title">1. Choisir un outil</p><p className="card-subtitle">Le compteur montre combien d’athlètes l’utilisent.</p></div>
                <div className="space-y-1.5">
                  {availableKeys.map((key) => {
                    const count = athletes.filter((item) => athlete[item.id]?.[key] !== false).length;
                    return <button key={key} type="button" className="module-tool-choice" data-selected={selectedModule === key ? "true" : "false"} onClick={() => chooseModule(key)}>
                      <span>{MODULE_REGISTRY[key].label}</span><span>{count}/{athletes.length}</span>
                    </button>;
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div><p className="card-title">2. Choisir les athlètes</p><p className="card-subtitle">Qui utilise « {MODULE_REGISTRY[selectedModule]?.label ?? "cet outil"} » ?</p></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setModuleAthleteIds(athletes.map((item) => item.id))}>Tout activer</button>
                  <button type="button" className="btn-ghost" onClick={() => setModuleAthleteIds([])}>Tout désactiver</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {athletes.map((item) => {
                    const checked = moduleAthleteIds.includes(item.id);
                    return <label key={item.id} className="module-athlete-choice" data-selected={checked ? "true" : "false"}>
                      <input type="checkbox" checked={checked} onChange={() => setModuleAthleteIds((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{item.name}</span><span className="meta-text">{item.group_name ?? "Sans groupe"}</span></span>
                      <span className="module-toggle" data-on={checked ? "true" : "false"} aria-hidden="true"><span /></span>
                    </label>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className="module-manager-footer px-5 sm:px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--c-border)" }}>
          <span className="text-[12px]" role={error ? "alert" : "status"} style={{ color: error ? "var(--tone-danger)" : "var(--c-text-2)" }}>
            {error ?? (mode === "athlete" ? `${selectedIds.length} athlète${selectedIds.length > 1 ? "s" : ""} sélectionné${selectedIds.length > 1 ? "s" : ""}` : `${moduleAthleteIds.length}/${athletes.length} athlètes utiliseront cet outil`)}
          </span>
          <button type="button" className="btn-primary" disabled={saving || (mode === "athlete" && !selectedIds.length) || (mode === "module" && !selectedModule)} onClick={save}>
            <Check size={15} /> {saving ? "Application…" : "Appliquer"}
          </button>
        </footer>
      </section>
    </div>, document.body,
  );
}
