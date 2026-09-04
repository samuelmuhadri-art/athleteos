// ============================================================
// AthleteOS — src/modules/AddSessionModal.jsx
// Modal création/édition d'une séance (côté coach) — extraite de
// Planning.jsx.
// ============================================================

import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { X, Plus, CheckCircle, Repeat2, UsersRound } from "lucide-react";
import { CATEGORIES, SESSION_COLORS, EMPTY_FORM, dateToISOWeek, dateToDayName, toLocalDateStr } from "./planningUtils";
import TrainingFocusField from "../components/session/TrainingFocusField";
import { getDefaultTrainingFocus, isTrainingFocusCompatible } from "../domain/trainingFocus";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";
import DocumentLibraryField from "../components/documents/DocumentLibraryField";
import { groupAthletes, isoWeekday, RECURRENCE_OPTIONS } from "../domain/planningEvolution";
import { supabase } from "../utils/supabaseClient";
import { mapDocument } from "../services/documentLibrary";

const AddSessionModal = memo(({ athletes, initialData, initialAthleteIds = [], onClose, onAdd }) => {
  const isEdit = !!initialData;
  const today  = toLocalDateStr(new Date());
  const [form, setForm]             = useState(() => {
    const base = initialData ?? { ...EMPTY_FORM, sessionDate: today, athleteIds: initialAthleteIds };
    return {
      ...base,
      recurrence:base.recurrence ?? "none",
      recurrenceWeekdays:base.recurrenceWeekdays ?? [isoWeekday(base.sessionDate || today)],
      recurrenceCount:base.recurrenceCount ?? 8,
      recurrenceEndsOn:base.recurrenceEndsOn ?? "",
      targetGroup:base.targetGroup ?? "",
      editScope:base.editScope ?? "single",
      trainingFocus: isTrainingFocusCompatible(base.trainingFocus, base.category)
        ? base.trainingFocus
        : getDefaultTrainingFocus(base.category),
    };
  });
  const [saving, setSaving]         = useState(false);
  const [documents, setDocuments] = useState(() => initialData?.documents ?? []);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const requestKeyRef = useRef(crypto.randomUUID());
  const initialSnapshotRef = useRef(null);
  const documentSnapshot = useCallback(items => items.map(document => ({
    id:document.id,
    visibility:document.visibility ?? "all",
    athleteIds:[...(document.athleteIds ?? [])].sort((a, b) => a - b),
  })), []);
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = JSON.stringify({ form, documents:documentSnapshot(documents) });
  }
  const dirty = useMemo(() => JSON.stringify({ form, documents:documentSnapshot(documents) }) !== initialSnapshotRef.current, [documentSnapshot, documents, form]);
  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm("Quitter sans enregistrer les modifications de cette séance ?")) return;
    onClose();
  }, [dirty, onClose, saving]);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose:requestClose, closeDisabled:saving });

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (isEdit) return undefined;
    let active = true;
    supabase.from("session_templates").select("*, session_template_documents(documents(*))").order("updated_at", { ascending:false })
      .then(({ data }) => { if (active) setTemplates(data ?? []); });
    return () => { active = false; };
  }, [isEdit]);

  const set = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);
  const toggleAthlete = useCallback(id => {
    setForm(f => ({
      ...f,
      athleteIds: f.athleteIds.includes(id)
        ? f.athleteIds.filter(x => x !== id)
        : [...f.athleteIds, id],
    }));
  }, []);
  const groups = groupAthletes(athletes);
  const assignedAthletes = useMemo(() => athletes.filter(athlete => form.athleteIds.includes(athlete.id)), [athletes, form.athleteIds]);
  const invalidDocumentRecipients = documents.some(document => document.visibility === "selected"
    && !(document.athleteIds ?? []).some(athleteId => form.athleteIds.includes(athleteId)));
  const toggleGroup = group => setForm(current => {
    const allSelected = group.athleteIds.every(id => current.athleteIds.includes(id));
    const selected = new Set(current.athleteIds);
    group.athleteIds.forEach(id => allSelected ? selected.delete(id) : selected.add(id));
    return { ...current, athleteIds:[...selected], targetGroup:allSelected ? "" : group.name };
  });

  const handleSubmit = async () => {
    if (!form.title.trim() || form.athleteIds.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const chosenDate = form.sessionDate || today;
      const distributableDocuments = documents.map(document => document.visibility === "selected"
        ? { ...document, athleteIds:(document.athleteIds ?? []).filter(id => form.athleteIds.includes(id)) }
        : document);
      await onAdd({
        ...form,
        week:        dateToISOWeek(chosenDate),
        day:         dateToDayName(chosenDate),
        type:        CATEGORIES.find(c => c.id === form.category)?.label ?? form.category,
        pdfUrl:form.pdfUrl ?? null,
        documents:distributableDocuments,
        documentIds:distributableDocuments.map(document => document.id),
        sessionDate: chosenDate,
      }, requestKeyRef.current);
      onClose();
    } catch (err) {
      setSaveError(err.message ?? "Impossible d’enregistrer la séance.");
      console.error("Erreur ajout séance :", err);
      setSaving(false);
    }
  };

  const selCat = SESSION_COLORS[form.category] ?? SESSION_COLORS.technique;
  const labelCls = "block text-[12px] font-bold uppercase tracking-wide mb-1.5";
  const labelStyle = { color: "var(--c-text-3)" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && requestClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        <div
          className="px-6 py-5 flex items-center justify-between flex-shrink-0 transition-colors"
          style={{ background: `${selCat.border}14`, borderBottom: `1px solid ${selCat.border}40` }}
        >
          <div>
            <h2 id={titleId} className="text-[17px] font-bold" style={{ color: selCat.text }}>
              {isEdit ? "Modifier la séance" : "Nouvelle séance"}
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-2)" }}>
              {isEdit ? "Modifie les détails" : "Planifie un entraînement"}
            </p>
          </div>
          <button type="button" aria-label="Fermer" onClick={requestClose} disabled={saving}
            className="p-2 rounded-xl disabled:opacity-40 transition-colors">
            <X size={18} style={{ color: selCat.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {!isEdit && templates.length > 0 && <div>
            <label className={labelCls} style={labelStyle}>Partir d’un modèle</label>
            <div className="flex gap-2 overflow-x-auto pb-1">{templates.map(template => <button type="button" key={template.id} className="btn-secondary whitespace-nowrap" onClick={() => {
              setForm(current => ({ ...current, title:template.title, category:template.category, type:template.type,
                trainingFocus:template.training_focus, durationMinutes:template.duration_minutes,
                description:template.description ?? "", instructions:template.instructions ?? "" }));
              setDocuments((template.session_template_documents ?? []).map(link => mapDocument(link.documents)).filter(Boolean));
            }}>{template.name}</button>)}</div>
          </div>}

          <div>
            <label className={labelCls} style={labelStyle}>Titre *</label>
            <input className="input-premium" placeholder="Ex: Sprint — sorties de blocs"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => {
                const cc  = SESSION_COLORS[cat.id];
                const sel = form.category === cat.id;
                return (
                  <button key={cat.id} type="button" aria-pressed={sel} onClick={() => setForm(previous => ({ ...previous, category: cat.id, trainingFocus: getDefaultTrainingFocus(cat.id) }))}
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback"
                    style={sel
                      ? { background: cc.border, color: "#0A150F", borderColor: cc.border }
                      : { background: `${cc.border}14`, color: cc.text, borderColor: `${cc.border}40` }
                    }>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <TrainingFocusField
            category={form.category}
            value={form.trainingFocus}
            onChange={value => set("trainingFocus", value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Date *</label>
              <input type="date" className="input-premium"
                value={form.sessionDate} onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Heure</label>
              <input type="time" className="input-premium"
                value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          {!isEdit && <div className="rounded-2xl p-4 space-y-3" style={{ background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
            <div className="flex items-center gap-2"><Repeat2 size={15} color="var(--tone-success)" /><span className={labelCls} style={{ ...labelStyle, marginBottom:0 }}>Récurrence</span></div>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map(option => <button type="button" key={option.id} aria-pressed={form.recurrence === option.id} onClick={() => set("recurrence", option.id)}
                className={form.recurrence === option.id ? "btn-primary" : "btn-secondary"}>{option.label}</button>)}
            </div>
            {form.recurrence !== "none" && <>
              <div><label className={labelCls} style={labelStyle}>Jours</label><div className="grid grid-cols-7 gap-1">
                {["L","M","M","J","V","S","D"].map((label, index) => {
                  const day = index + 1;
                  const selected = form.recurrenceWeekdays.includes(day);
                  return <button key={day} type="button" aria-label={["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"][index]}
                    onClick={() => set("recurrenceWeekdays", selected ? form.recurrenceWeekdays.filter(value => value !== day) : [...form.recurrenceWeekdays, day])}
                    aria-pressed={selected} className={selected ? "btn-primary" : "btn-secondary"}>{label}</button>;
                })}
              </div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={labelStyle}>Nombre de séances</label><input type="number" min="1" max="104" className="input-premium" value={form.recurrenceCount} onChange={event => set("recurrenceCount", Number(event.target.value))} /></div>
                <div><label className={labelCls} style={labelStyle}>Ou date de fin</label><input type="date" min={form.sessionDate} className="input-premium" value={form.recurrenceEndsOn} onChange={event => set("recurrenceEndsOn", event.target.value)} /></div>
              </div>
            </>}
          </div>}
          {isEdit && initialData?.seriesId && <div className="rounded-2xl p-4" style={{ background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
            <label className={labelCls} style={labelStyle}>Appliquer les modifications</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[{ id:"single", label:"Cette séance" }, { id:"future", label:"Celle-ci et suivantes" }, { id:"all", label:"Toute la série" }].map(option =>
                <button type="button" key={option.id} aria-pressed={form.editScope === option.id} onClick={() => set("editScope", option.id)} className={form.editScope === option.id ? "btn-primary" : "btn-secondary"}>{option.label}</button>)}
            </div>
          </div>}

          <div>
            <label className={labelCls} style={labelStyle}>Durée (minutes)</label>
            <input type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes} onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Description</label>
            <textarea className="input-premium resize-none" rows={3}
              placeholder="Volume, intensité, objectifs…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Consignes spécifiques</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Instructions particulières…"
              value={form.instructions} onChange={e => set("instructions", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>
              Athlètes * ({form.athleteIds.length} sélectionné{form.athleteIds.length > 1 ? "s" : ""})
            </label>
            {athletes.length === 0 ? (
              <p className="meta-text">Aucun athlète disponible</p>
            ) : (
              <>
              {groups.length > 0 && <div className="flex flex-wrap gap-2 mb-3">
                {groups.map(group => {
                  const selected = group.athleteIds.every(id => form.athleteIds.includes(id));
                  return <button key={group.name} type="button" aria-pressed={selected} onClick={() => toggleGroup(group)} className={selected ? "btn-primary" : "btn-secondary"}>
                    <UsersRound size={14} /> {group.name} · {group.athleteIds.length}
                  </button>;
                })}
              </div>}
              <div className="flex flex-wrap gap-2">
                {athletes.map(a => {
                  const sel = form.athleteIds.includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={sel} aria-label={`${sel ? "Retirer" : "Ajouter"} ${a.name}`} onClick={() => toggleAthlete(a.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback"
                      style={sel
                        ? { background: "rgba(29,158,117,0.14)", borderColor: "#1D9E75", color: "var(--tone-success)" }
                        : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                        style={{ background: sel ? "#1D9E75" : "var(--c-surface-3)", color: sel ? "#0A150F" : "var(--c-text-3)" }}>
                        {a.avatar?.slice(0, 1) ?? "?"}
                      </div>
                      {a.name.split(" ")[0]}
                      {sel && <CheckCircle size={12} color="#3DBE8B" />}
                    </button>
                  );
                })}
              </div>
              </>
            )}
          </div>

          <DocumentLibraryField value={documents} onChange={setDocuments} athletes={assignedAthletes}
            allowSpecificRecipients={form.recurrence === "none" && (!isEdit || form.editScope === "single")}
            disabled={saving} onBusyChange={setDocumentsBusy} />
          {saveError && <p role="alert" className="text-[12px]" style={{ color:"var(--tone-danger)" }}>{saveError}</p>}
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={requestClose} disabled={saving} className="btn-secondary">
            Annuler
          </button>
          <button onClick={handleSubmit}
            disabled={!form.title.trim() || form.athleteIds.length === 0 || saving || documentsBusy || invalidDocumentRecipients || (form.recurrence !== "none" && form.recurrenceWeekdays.length === 0)}
            className="btn-primary">
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Enregistrement…</>
            ) : (
              <><Plus size={15} />{isEdit ? "Enregistrer" : "Ajouter"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default AddSessionModal;
