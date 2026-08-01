// ============================================================
// AthleteOS — src/athlete/views/AddPerfModal.jsx
// Modal "Saisir une performance" — extraite d'AthletePerfs.jsx.
// ============================================================

import { createPortal } from "react-dom";
import { Plus, TrendingUp, X } from "lucide-react";
import { COMBINE_EVENTS, discColor } from "./perfsShared";
import PerformanceMetadataFields from "../../components/performance/PerformanceMetadataFields.jsx";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";

export default function AddPerfModal({ disciplines, perfForm, setPerfForm, onClose, onSubmit, saving, error }) {
  const { dialogRef } = useAccessibleDialog({ onClose, closeDisabled: saving });
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
  // Portal sur document.body — AthletePerfs.jsx est rendu à l'intérieur du
  // <main> scrollable d'AthleteApp.jsx ; sans portal ce position:fixed dérive
  // avec le scroll au lieu de rester épinglé à l'écran sur mobile (même bug
  // déjà corrigé sur AthleteClub.jsx et AthletePlanning.jsx).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <form ref={dialogRef} tabIndex={-1} onSubmit={event => { event.preventDefault(); onSubmit(); }} role="dialog" aria-modal="true" aria-labelledby="add-perf-title"
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(29,158,117,0.08)", borderBottom: "1px solid rgba(29,158,117,0.18)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(29,158,117,0.14)", border: "1px solid rgba(29,158,117,0.25)" }}>
              <TrendingUp size={14} color="#7BD8B4" aria-hidden="true" />
              <h2 id="add-perf-title" style={{ fontSize: 15, fontWeight: 700, color: "var(--tone-success)" }}>Saisir une performance</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--c-text-2)" }}>Chrono, distance, hauteur…</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving}
            style={{ width: 44, height: 44, borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label htmlFor="perf-discipline" style={labelStyle}>Épreuve *</label>
            <input id="perf-discipline" className="input-premium" placeholder="Ex: 100m, Longueur…" required autoFocus
              value={perfForm.discipline}
              onChange={e => setPerfForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = perfForm.discipline === d;
                  const col = discColor(d);
                  return (
                    <button key={d} type="button" aria-pressed={sel} onClick={() => setPerfForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ minHeight: 44, padding: "0 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: `1.5px solid ${sel ? col : "var(--c-border-strong)"}`, background: sel ? `${col}20` : "var(--c-surface-2)", color: sel ? col : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="perf-value" style={labelStyle}>
              {COMBINE_EVENTS[perfForm.discipline] ? "Total (points) *" : "Résultat *"}
            </label>
            <input id="perf-value" className="input-premium" placeholder="Ex: 10.94 ou 7.45m" required
              value={perfForm.value}
              onChange={e => setPerfForm(f => ({ ...f, value: e.target.value }))} />
          </div>

          {/* Détail par épreuve — uniquement pour Décathlon/Heptathlon */}
          {COMBINE_EVENTS[perfForm.discipline] && (
            <div>
              <label style={labelStyle}>
                Détail par épreuve (optionnel)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COMBINE_EVENTS[perfForm.discipline].map(ev => (
                  <div key={ev}>
                    <input className="input-premium" aria-label={`Résultat ${ev}`} placeholder={ev}
                      value={perfForm.breakdown[ev] ?? ""}
                      onChange={e => setPerfForm(f => ({ ...f, breakdown: { ...f.breakdown, [ev]: e.target.value } }))} />
                    <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 4, marginLeft: 2 }}>{ev}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="perf-date" style={labelStyle}>Date</label>
            <input id="perf-date" type="date" className="input-premium"
              value={perfForm.performance_date}
              onChange={e => setPerfForm(f => ({ ...f, performance_date: e.target.value }))} />
          </div>

          <div>
            <label htmlFor="perf-context" style={labelStyle}>Contexte (optionnel)</label>
            <input id="perf-context" className="input-premium" placeholder="Ex: Vent +1.2m/s, finale régionale…"
              value={perfForm.context}
              onChange={e => setPerfForm(f => ({ ...f, context: e.target.value }))} />
          </div>

          <PerformanceMetadataFields
            discipline={perfForm.discipline}
            metadata={perfForm.metadata}
            setMetadata={(updater) => setPerfForm((current) => ({
              ...current,
              metadata: typeof updater === "function" ? updater(current.metadata) : updater,
            }))}
            idPrefix="perf-meta"
          />
          {error && <p role="alert" className="rounded-xl border px-3 py-2.5 text-[13px]" style={{ color: "var(--color-danger)", borderColor: "rgba(226,75,74,0.28)", background: "rgba(226,75,74,0.08)" }}>{error}</p>}
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit"
            disabled={!perfForm.discipline.trim() || !perfForm.value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Enregistrer</>}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
