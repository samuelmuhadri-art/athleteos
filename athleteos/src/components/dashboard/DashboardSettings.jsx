import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import Modal from "../ui/Modal";
import { DASHBOARD_BLOCKS, DASHBOARD_CARDS, normalizeDashboardPreferences } from "../../domain/dashboardPreferences";
import { saveDashboardPreferences } from "../../services/dashboardPreferencesService";

export default function DashboardSettings({ preferences, groups, onSaved, onClose }) {
  const [draft, setDraft] = useState(() => normalizeDashboardPreferences(preferences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const toggle = key => setDraft(current => ({ ...current, hidden:current.hidden.includes(key) ? current.hidden.filter(item => item !== key) : [...current.hidden,key] }));
  const move = (index, direction) => setDraft(current => {
    const order = [...current.order];
    [order[index],order[index+direction]] = [order[index+direction],order[index]];
    return { ...current, order };
  });
  const save = async () => {
    setSaving(true); setError(null);
    try { onSaved(await saveDashboardPreferences(draft)); }
    catch (err) { setError(err.message ?? "Enregistrement impossible."); }
    finally { setSaving(false); }
  };
  return <Modal title="Personnaliser mon accueil" onClose={onClose} onConfirm={save} confirmLabel="Enregistrer" disabled={saving} loading={saving}>
    <div className="space-y-5">
      <p className="secondary-text">Ces préférences ne changent que ton accueil. Les outils désactivés restent masqués. Place les informations prioritaires en premier.</p>
      <fieldset className="space-y-2"><legend className="card-title mb-2">Blocs principaux</legend>
        {draft.order.map((key,index) => <div key={key} className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] p-2">
          <label className="flex items-center gap-2 flex-1 min-w-0 text-sm"><input type="checkbox" checked={!draft.hidden.includes(key)} onChange={() => toggle(key)} />{DASHBOARD_BLOCKS.find(item => item.key === key).label}</label>
          <button type="button" className="icon-btn" aria-label={`Monter ${DASHBOARD_BLOCKS.find(item => item.key === key).label}`} disabled={index === 0} onClick={() => move(index,-1)}><ArrowUp size={16} /></button>
          <button type="button" className="icon-btn" aria-label={`Descendre ${DASHBOARD_BLOCKS.find(item => item.key === key).label}`} disabled={index === draft.order.length-1} onClick={() => move(index,1)}><ArrowDown size={16} /></button>
        </div>)}
      </fieldset>
      <fieldset className="space-y-2"><legend className="card-title mb-2">Cartes du suivi</legend>
        {DASHBOARD_CARDS.map(item => <label key={item.key} className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={!draft.hidden.includes(item.key)} onChange={() => toggle(item.key)} />{item.label}</label>)}
      </fieldset>
      <label className="block text-sm">Groupe par défaut<select className="input-premium mt-2" value={draft.defaultGroup ?? ""} onChange={event => setDraft({ ...draft, defaultGroup:event.target.value || null })}><option value="">Tous les groupes</option>{groups.map(group => <option key={group} value={group}>{group}</option>)}</select></label>
      <label className="block text-sm">Période des feedbacks récents<select className="input-premium mt-2" value={draft.feedbackDays} onChange={event => setDraft({ ...draft, feedbackDays:Number(event.target.value) })}>{[7,14,28].map(days => <option key={days} value={days}>{days} derniers jours</option>)}</select></label>
      <p className="meta-text">Le wellness reste celui du jour et les indicateurs hebdomadaires ceux de la semaine en cours. Les alertes générales du club restent visibles avec un groupe sélectionné.</p>
      <button type="button" className="btn-secondary" onClick={() => setDraft(normalizeDashboardPreferences(null))}>Rétablir les valeurs par défaut</button>
      {error && <p role="alert" className="text-sm" style={{ color:"var(--tone-danger)" }}>{error}</p>}
    </div>
  </Modal>;
}
