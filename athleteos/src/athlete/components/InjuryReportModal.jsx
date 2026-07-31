// ============================================================
// AthleteOS — src/athlete/components/InjuryReportModal.jsx
// Permet à l'athlète de signaler une blessure lui-même — jusqu'ici
// seul le coach pouvait en créer (AthleteList.jsx), ce qui laissait
// alertNewInjury() sans aucun point d'appel réel dans l'app.
// ============================================================

import { useState, memo } from "react";
import { X, AlertTriangle, HeartPulse } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { alertNewInjury } from "../../utils/notifications";
import { toLocalDateStr } from "../shared";

const InjuryReportModal = memo(({ athlete, clubId, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: "", location: "", intensity: 5, notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const { data, error } = await supabase.from("injuries").insert({
        athlete_id: athlete.id,
        name: form.name.trim(),
        location: form.location.trim() || null,
        intensity: form.intensity,
        status: "actif",
        start_date: toLocalDateStr(new Date()),
        notes: form.notes.trim() || null,
      }).select().single();
      if (error) throw error;
      await alertNewInjury(clubId, athlete, {
        name: form.name.trim(), location: form.location.trim() || "", intensity: form.intensity,
      });
      onClose();
      onSaved(data);
    } catch (e) {
      setErr(e.message ?? "Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div style={{
        background: "var(--c-surface)",
        borderRadius: "20px 20px 0 0",
        border: "1px solid var(--c-border)",
        borderBottom: "none",
        width: "100%",
        maxWidth: 480,
        maxHeight: "92dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.50)",
        animation: "sheet-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* Poignée */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        {/* Header */}
        <div style={{
          padding: "14px 20px 16px",
          flexShrink: 0,
          background: "rgba(232,160,32,0.08)",
          borderBottom: "1px solid rgba(232,160,32,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(232,160,32,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <HeartPulse size={17} color="#E8A020" strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--c-text-1)", lineHeight: 1.3 }}>
                  Signaler une blessure
                </h3>
                <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                  Ton coach sera prévenu immédiatement
                </p>
              </div>
            </div>
            <button onClick={onClose} disabled={saving}
              style={{ width: 32, height: 32, borderRadius: 9, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0, opacity: saving ? 0.4 : 1 }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, overscrollBehavior: "contain" }}>
          {err && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.20)", borderRadius: 10, padding: "10px 14px" }}>
              <AlertTriangle size={14} color="#E05252" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "var(--tone-danger)" }}>{err}</p>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 7 }}>
              Nom de la blessure *
            </label>
            <input
              style={{ width: "100%", border: "1.5px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--c-text-1)", background: "var(--c-surface-2)", outline: "none", boxSizing: "border-box" }}
              placeholder="Ex: Douleur mollet, entorse cheville…"
              value={form.name} onChange={e => set("name", e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 7 }}>
              Localisation
            </label>
            <input
              style={{ width: "100%", border: "1.5px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--c-text-1)", background: "var(--c-surface-2)", outline: "none", boxSizing: "border-box" }}
              placeholder="Ex: Mollet droit, genou gauche…"
              value={form.location} onChange={e => set("location", e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <label style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)" }}>
                Intensité
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: form.intensity >= 7 ? "#E05252" : form.intensity >= 4 ? "#E8A020" : "#1D9E75" }}>
                {form.intensity}/10
              </span>
            </div>
            <input
              type="range" min={1} max={10} value={form.intensity}
              onChange={e => set("intensity", Number(e.target.value))}
              style={{ width: "100%", accentColor: form.intensity >= 7 ? "#E05252" : form.intensity >= 4 ? "#E8A020" : "#1D9E75" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 7 }}>
              Note (optionnel)
            </label>
            <textarea
              style={{ width: "100%", border: "1.5px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--c-text-1)", background: "var(--c-surface-2)", resize: "none", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }}
              rows={2} placeholder="Depuis quand, circonstances…"
              value={form.notes} onChange={e => set("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} disabled={saving}
            style={{ flexShrink: 0, minHeight: 44, padding: "0 16px", borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 13, fontWeight: 400, cursor: "pointer", opacity: saving ? 0.4 : 1 }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving}
            style={{
              flex: 1, minHeight: 44, borderRadius: 10, border: "none",
              background: form.name.trim() ? "linear-gradient(135deg, #E8A020, #C8890A)" : "var(--c-surface-2)",
              color: form.name.trim() ? "white" : "var(--c-text-3)",
              fontSize: 13.5, fontWeight: 500, cursor: form.name.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: form.name.trim() ? "0 4px 12px rgba(232,160,32,0.28)" : "none",
              transition: "all 0.2s ease",
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? (
              <>
                <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin-smooth 0.65s linear infinite" }} />
                Envoi…
              </>
            ) : (
              <><HeartPulse size={15} strokeWidth={2} />Signaler</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default InjuryReportModal;
