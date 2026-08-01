// ============================================================
// AthleteOS — src/athlete/views/AddGoalModal.jsx
// Modal "Ajouter un objectif" — extraite d'AthletePerfs.jsx.
// ============================================================

import { createPortal } from "react-dom";
import { Plus, Target, X } from "lucide-react";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";

export default function AddGoalModal({ disciplines, goalForm, setGoalForm, onClose, onSubmit, saving }) {
  const { dialogRef } = useAccessibleDialog({ onClose, closeDisabled: saving });
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <form ref={dialogRef} tabIndex={-1} onSubmit={event => { event.preventDefault(); onSubmit(); }} role="dialog" aria-modal="true" aria-labelledby="add-goal-title"
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(234,179,8,0.14)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <Target size={14} color="#F0CB61" aria-hidden="true" />
              <h2 id="add-goal-title" style={{ fontSize: 15, fontWeight: 700, color: "var(--tone-warning)" }}>Nouvel objectif</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--c-text-2)" }}>Fixe-toi un cap à atteindre</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving}
            style={{ width: 44, height: 44, borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label htmlFor="goal-discipline" style={labelStyle}>Épreuve *</label>
            <input id="goal-discipline" className="input-premium" placeholder="Ex: 100m, Longueur…" required autoFocus
              value={goalForm.discipline}
              onChange={e => setGoalForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = goalForm.discipline === d;
                  return (
                    <button key={d} type="button" aria-pressed={sel} onClick={() => setGoalForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ minHeight: 44, padding: "0 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: `1.5px solid ${sel ? "#EAB308" : "var(--c-border-strong)"}`, background: sel ? "rgba(234,179,8,0.16)" : "var(--c-surface-2)", color: sel ? "#F0CB61" : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="goal-value" style={labelStyle}>Objectif à atteindre *</label>
            <input id="goal-value" className="input-premium" placeholder="Ex: 10.80 ou 7.60m" required
              value={goalForm.target_value}
              onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} />
          </div>

          <div>
            <label htmlFor="goal-deadline" style={labelStyle}>Échéance (optionnel)</label>
            <input id="goal-deadline" type="date" className="input-premium"
              value={goalForm.deadline}
              onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>

          <div>
            <label htmlFor="goal-notes" style={labelStyle}>Notes</label>
            <textarea id="goal-notes" className="input-premium resize-none" rows={3}
              placeholder="Motivation, contexte…"
              value={goalForm.notes}
              onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit"
            disabled={!goalForm.discipline.trim() || !goalForm.target_value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Créer l'objectif</>}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
