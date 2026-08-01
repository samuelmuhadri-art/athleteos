// ============================================================
// AthleteOS — src/modules/AddInjuryModal.jsx
// Modal "Signaler / modifier une blessure" — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { inputCls, labelCls, INJURY_STATUS_OPTIONS } from "./athleteListUtils";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";

const AddInjuryModal = memo(({ athleteName, initialData, onClose, onSave }) => {
  const isEdit = initialData != null;
  const [form, setForm]     = useState(initialData ?? { name: "", location: "", intensity: 5, status: "actif", startDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled: saving });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const intColor = form.intensity <= 3 ? "#1D9E75" : form.intensity <= 6 ? "#EF9F27" : "#E24B4A";

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
           className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
           style={{ background: "var(--c-surface)" }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} /></div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: "rgba(226,75,74,0.08)", borderBottom: "2px solid rgba(226,75,74,0.2)" }}>
          <div>
            <h2 id={titleId} className="text-[17px] font-bold" style={{ color: "var(--tone-danger)" }}>{isEdit ? "Modifier la blessure" : "Signaler une blessure"}</h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--tone-danger)" }}>{athleteName}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving} className="p-2 rounded-xl transition-colors disabled:opacity-40"
                  style={{ color: "var(--tone-danger)" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(226,75,74,0.15)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="rounded-2xl px-4 py-3 text-[12px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)", color: "var(--tone-danger)" }}>{err}</div>}
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Nom de la blessure *</label>
            <input className={inputCls} placeholder="Ex: Tendinopathie rotulienne"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Localisation</label>
            <input className={inputCls} placeholder="Ex: Genou droit"
              value={form.location} onChange={e => set("location", e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls} style={{ color: "var(--c-text-3)", marginBottom: 0 }}>Intensité douleur</label>
              <span className="text-[14px] font-bold" style={{ color: intColor }}>{form.intensity}/10</span>
            </div>
            <input type="range" min="0" max="10" value={form.intensity}
              onChange={e => set("intensity", Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: intColor, background: "var(--c-surface-3)" }} />
            <div className="flex justify-between text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>
              <span>Légère</span><span>Modérée</span><span>Intense</span>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Statut</label>
            <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value)}>
              {INJURY_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Date de début</label>
            <input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Notes / suivi</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              placeholder="Kiné, consignes, restrictions…"
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />{isEdit ? "Enregistrer" : "Ajouter"}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default AddInjuryModal;
