// ============================================================
// AthleteOS — src/athlete/views/AddGoalModal.jsx
// Modal "Ajouter un objectif" — extraite d'AthletePerfs.jsx.
// ============================================================

import { createPortal } from "react-dom";
import { Plus, Target, X } from "lucide-react";

export default function AddGoalModal({ disciplines, goalForm, setGoalForm, onClose, onSubmit, saving }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(234,179,8,0.14)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <Target size={10} color="#EAB308" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#F0CB61" }}>Nouvel objectif</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Fixe-toi un cap à atteindre</p>
          </div>
          <button onClick={onClose} disabled={saving}
            style={{ padding: 8, borderRadius: 10, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Épreuve *</label>
            <input className="input-premium" placeholder="Ex: 100m, Longueur…"
              value={goalForm.discipline}
              onChange={e => setGoalForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = goalForm.discipline === d;
                  return (
                    <button key={d} onClick={() => setGoalForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ padding: "5px 11px", borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1.5px solid ${sel ? "#EAB308" : "var(--c-border-strong)"}`, background: sel ? "#EAB308" : "var(--c-surface-2)", color: sel ? "#0A150F" : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Objectif à atteindre *</label>
            <input className="input-premium" placeholder="Ex: 10.80 ou 7.60m"
              value={goalForm.target_value}
              onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Échéance (optionnel)</label>
            <input type="date" className="input-premium"
              value={goalForm.deadline}
              onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Notes</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Motivation, contexte…"
              value={goalForm.notes}
              onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!goalForm.discipline.trim() || !goalForm.target_value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Créer l'objectif</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
