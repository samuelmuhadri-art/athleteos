// ============================================================
// AthleteOS — src/modules/AddRecordModal.jsx
// Modal "Ajouter un record" — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { inputCls, labelCls } from "./athleteListShared";

const AddRecordModal = memo(({ athleteName, onClose, onAdd }) => {
  const [form, setForm]     = useState({ discipline: "", sb: "", pr: "", prDate: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.discipline.trim() || !form.sb.trim() || !form.pr.trim()) return;
    setSaving(true); setErr(null);
    try { await onAdd(form); onClose(); }
    catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
           style={{ background: "var(--c-surface)" }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 className="text-[17px] font-bold" style={{ color: "var(--c-text-1)" }}>Ajouter un record</h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-3)" }}>{athleteName}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving} className="p-2 rounded-xl transition-colors disabled:opacity-40"
                  style={{ color: "var(--c-text-2)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="rounded-2xl px-4 py-3 text-[12px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)", color: "#F19A9A" }}>{err}</div>}
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Épreuve *</label>
            <input className={inputCls} placeholder="Ex: 100m, Longueur…"
              value={form.discipline} onChange={e => set("discipline", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Season Best *</label>
              <input className={inputCls} placeholder="Ex: 10.94s" value={form.sb} onChange={e => set("sb", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Record perso *</label>
              <input className={inputCls} placeholder="Ex: 10.62s" value={form.pr} onChange={e => set("pr", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Date du record perso</label>
            <input type="date" className={inputCls} value={form.prDate} onChange={e => set("prDate", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.discipline.trim() || !form.sb.trim() || !form.pr.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />Ajouter</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default AddRecordModal;
