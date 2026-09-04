import { useMemo, useState } from "react";
import { CalendarRange, Check, MapPin, Trash2, X } from "lucide-react";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { groupAthletes } from "../../domain/planningEvolution";
import { civilDateKey } from "../../utils/dateTime";
import DocumentLibraryField from "../documents/DocumentLibraryField";

const KINDS = [
  { id:"stage", label:"Stage" }, { id:"test", label:"Test" },
  { id:"rest", label:"Repos" }, { id:"custom", label:"Autre" },
];

export default function PlanningEventModal({ athletes, initialData = null, initialKind = "stage", onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    kind:initialData?.kind ?? initialKind, name:initialData?.name ?? "",
    startsOn:initialData?.startsOn ?? civilDateKey(new Date()), endsOn:initialData?.endsOn ?? initialData?.startsOn ?? civilDateKey(new Date()),
    time:initialData?.time ?? "", location:initialData?.location ?? "", description:initialData?.description ?? "",
    notes:initialData?.notes ?? "", customLabel:initialData?.customLabel ?? "", targetGroup:initialData?.targetGroup ?? "",
    athleteIds:initialData?.athleteIds ?? [],
    documents:initialData?.documents ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [error, setError] = useState(null);
  const groups = useMemo(() => groupAthletes(athletes), [athletes]);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled:saving });
  const set = (key, value) => setForm(current => ({ ...current, [key]:value }));
  const toggleAthlete = id => set("athleteIds", form.athleteIds.includes(id) ? form.athleteIds.filter(value => value !== id) : [...form.athleteIds, id]);
  const selectGroup = group => setForm(current => ({ ...current, targetGroup:group.name, athleteIds:[...new Set([...current.athleteIds, ...group.athleteIds])] }));
  const submit = async event => {
    event.preventDefault();
    if (!form.name.trim() || !form.startsOn || !form.endsOn || !form.athleteIds.length) return;
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message ?? "Impossible d’enregistrer l’événement."); setSaving(false); }
  };

  return <div className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={event => event.target === event.currentTarget && !saving && onClose()}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="modal-content w-full sm:max-w-lg max-h-[94dvh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col">
      <header className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:"1px solid var(--c-border)" }}>
        <div><p className="metric-label">ÉVÉNEMENT DU PLANNING</p><h2 id={titleId} className="section-title">{initialData ? "Modifier" : "Ajouter"}</h2></div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </header>
      <form className="flex-1 min-h-0 flex flex-col" onSubmit={submit}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-4 gap-2">{KINDS.map(kind => <button type="button" key={kind.id} onClick={() => set("kind", kind.id)} className={form.kind === kind.id ? "btn-primary" : "btn-secondary"}>{kind.label}</button>)}</div>
          <div><label className="metric-label block mb-2">NOM *</label><input className="input-premium" value={form.name} onChange={event => set("name", event.target.value)} placeholder="Stage de préparation, test VMA…" /></div>
          {form.kind === "custom" && <div><label className="metric-label block mb-2">LIBELLÉ PERSONNALISÉ</label><input className="input-premium" value={form.customLabel} onChange={event => set("customLabel", event.target.value)} /></div>}
          <div className="grid grid-cols-2 gap-3"><div><label className="metric-label block mb-2">DU *</label><input type="date" className="input-premium" value={form.startsOn} onChange={event => { setForm(current => ({ ...current, startsOn:event.target.value, endsOn:current.endsOn < event.target.value ? event.target.value : current.endsOn })); }} /></div><div><label className="metric-label block mb-2">AU *</label><input type="date" min={form.startsOn} className="input-premium" value={form.endsOn} onChange={event => set("endsOn", event.target.value)} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="metric-label block mb-2">HEURE</label><input type="time" className="input-premium" value={form.time} onChange={event => set("time", event.target.value)} /></div><div><label className="metric-label block mb-2">LIEU</label><label className="input-premium flex items-center gap-2"><MapPin size={14} /><input className="min-w-0 flex-1 bg-transparent outline-none" value={form.location} onChange={event => set("location", event.target.value)} /></label></div></div>
          <div><label className="metric-label block mb-2">DESCRIPTION</label><textarea rows={3} className="input-premium resize-none" value={form.description} onChange={event => set("description", event.target.value)} /></div>
          {groups.length > 0 && <div><label className="metric-label block mb-2">GROUPES</label><div className="flex flex-wrap gap-2">{groups.map(group => <button type="button" className={form.targetGroup === group.name ? "btn-primary" : "btn-secondary"} key={group.name} onClick={() => selectGroup(group)}>{group.name} · {group.athleteIds.length}</button>)}</div></div>}
          <div><label className="metric-label block mb-2">ATHLÈTES * ({form.athleteIds.length})</label><div className="flex flex-wrap gap-2">{athletes.map(athlete => { const selected=form.athleteIds.includes(athlete.id); return <button type="button" key={athlete.id} onClick={() => toggleAthlete(athlete.id)} className={selected ? "btn-primary" : "btn-secondary"}>{selected && <Check size={13} />}{athlete.name}</button>; })}</div></div>
          <DocumentLibraryField value={form.documents} onChange={documents => set("documents", documents)} disabled={saving} onBusyChange={setDocumentsBusy} />
          {error && <p role="alert" style={{ color:"var(--tone-danger)" }}>{error}</p>}
        </div>
        <footer className="p-4 flex items-center justify-between gap-3" style={{ borderTop:"1px solid var(--c-border)" }}>
          {initialData && onDelete ? <button type="button" className="btn-ghost" style={{ color:"var(--tone-danger)" }} onClick={() => onDelete(initialData)}><Trash2 size={15} /> Supprimer</button> : <span />}
          <button type="submit" className="btn-primary" disabled={saving || documentsBusy || !form.name.trim() || !form.athleteIds.length}><CalendarRange size={15} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </footer>
      </form>
    </section>
  </div>;
}
