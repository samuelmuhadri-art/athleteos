// ============================================================
// AthleteOS — src/athlete/views/AddPerfModal.jsx
// Modal "Saisir une performance" — extraite d'AthletePerfs.jsx.
// ============================================================

import { createPortal } from "react-dom";
import { Plus, TrendingUp, X } from "lucide-react";
import { COMBINE_EVENTS, discColor } from "./perfsShared";

export default function AddPerfModal({ disciplines, perfForm, setPerfForm, onClose, onSubmit, saving }) {
  // Portal sur document.body — AthletePerfs.jsx est rendu à l'intérieur du
  // <main> scrollable d'AthleteApp.jsx ; sans portal ce position:fixed dérive
  // avec le scroll au lieu de rester épinglé à l'écran sur mobile (même bug
  // déjà corrigé sur AthleteClub.jsx et AthletePlanning.jsx).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(29,158,117,0.08)", borderBottom: "1px solid rgba(29,158,117,0.18)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(29,158,117,0.14)", border: "1px solid rgba(29,158,117,0.25)" }}>
              <TrendingUp size={10} color="#1D9E75" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#4DC9A0" }}>Saisir une performance</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Chrono, distance, hauteur…</p>
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
              value={perfForm.discipline}
              onChange={e => setPerfForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = perfForm.discipline === d;
                  const col = discColor(d);
                  return (
                    <button key={d} onClick={() => setPerfForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ padding: "5px 11px", borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1.5px solid ${sel ? col : "var(--c-border-strong)"}`, background: sel ? col : "var(--c-surface-2)", color: sel ? "#0A150F" : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {COMBINE_EVENTS[perfForm.discipline] ? "Total (points) *" : "Résultat *"}
            </label>
            <input className="input-premium" placeholder="Ex: 10.94 ou 7.45m"
              value={perfForm.value}
              onChange={e => setPerfForm(f => ({ ...f, value: e.target.value }))} />
          </div>

          {/* Détail par épreuve — uniquement pour Décathlon/Heptathlon */}
          {COMBINE_EVENTS[perfForm.discipline] && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Détail par épreuve (optionnel)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COMBINE_EVENTS[perfForm.discipline].map(ev => (
                  <div key={ev}>
                    <input className="input-premium" placeholder={ev} style={{ fontSize: 12 }}
                      value={perfForm.breakdown[ev] ?? ""}
                      onChange={e => setPerfForm(f => ({ ...f, breakdown: { ...f.breakdown, [ev]: e.target.value } }))} />
                    <p style={{ fontSize: 9, color: "var(--c-text-4)", marginTop: 3, marginLeft: 2 }}>{ev}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Date</label>
            <input type="date" className="input-premium"
              value={perfForm.performance_date}
              onChange={e => setPerfForm(f => ({ ...f, performance_date: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Contexte (optionnel)</label>
            <input className="input-premium" placeholder="Ex: Vent +1.2m/s, finale régionale…"
              value={perfForm.context}
              onChange={e => setPerfForm(f => ({ ...f, context: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!perfForm.discipline.trim() || !perfForm.value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
