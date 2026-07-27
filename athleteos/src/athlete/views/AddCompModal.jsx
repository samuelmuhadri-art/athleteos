// ============================================================
// AthleteOS — src/athlete/views/AddCompModal.jsx
// Modal "Ajouter une compétition" — extraite d'AthletePerfs.jsx (elle
// était inline, contrairement à AddPerfModal/AddGoalModal).
// ============================================================

import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { COMBINE_EVENTS } from "./perfsShared";

export default function AddCompModal({ compForm, setCompForm, onClose, onSubmit, saving }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-1)" }}>Ajouter une compétition</p>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>Résultat enregistré dans ton profil</p>
          </div>
          <button onClick={onClose} disabled={saving}
            style={{ width: 30, height: 30, borderRadius: 8, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "name",     label: "Nom de la compétition *", placeholder: "Ex: Championnat provincial" },
            { key: "location", label: "Lieu",                    placeholder: "Ex: Namur" },
            { key: "event",    label: "Épreuve *",               placeholder: "Ex: 100m ou Décathlon" },
            { key: "result",   label: COMBINE_EVENTS[compForm.event] ? "Total (points) *" : "Résultat *", placeholder: "Ex: 10.94" },
            { key: "context",  label: "Contexte",                placeholder: "Ex: Vent +1.2, finale" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>
                {f.label}
              </label>
              <input className="input-premium" placeholder={f.placeholder}
                value={compForm[f.key]}
                onChange={e => setCompForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          {COMBINE_EVENTS[compForm.event] && (
            <div>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>
                Détail par épreuve (optionnel)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COMBINE_EVENTS[compForm.event].map(ev => (
                  <div key={ev}>
                    <input className="input-premium" placeholder={ev} style={{ fontSize: 12 }}
                      value={compForm.breakdown[ev] ?? ""}
                      onChange={e => setCompForm(f => ({ ...f, breakdown: { ...f.breakdown, [ev]: e.target.value } }))} />
                    <p style={{ fontSize: 9, color: "var(--c-text-4)", marginTop: 3, marginLeft: 2 }}>{ev}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>Date *</label>
              <input type="date" className="input-premium"
                value={compForm.date}
                onChange={e => setCompForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>Type</label>
              <select className="input-premium"
                value={compForm.type}
                onChange={e => setCompForm(p => ({ ...p, type: e.target.value }))}>
                {["Régionale","Provinciale","Nationale","Internationale","Autre"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--c-border)", display: "flex", gap: 10 }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!compForm.name.trim() || !compForm.event.trim() || !compForm.result.trim() || saving}
            className="btn-primary" style={{ flex: 1 }}>
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Ajouter</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
