// ============================================================
// AthleteOS — src/athlete/components/WellnessModal.jsx
// ★ DARK MODE + fermeture automatique après save
// ============================================================

import { useState, useMemo, memo } from "react";
import { X, CheckCircle, AlertTriangle, Activity } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { computeWellnessScore } from "../../utils/chargeCalculations";
import { WELLNESS_QUESTIONS } from "../shared";

const WellnessModal = memo(({ athlete, clubId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    sleep: null, energy: null, soreness: null, mood: null, stress: null,
  });
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  const allAnswered   = Object.values(form).every(v => v !== null);
  const answeredCount = Object.values(form).filter(v => v !== null).length;
  const previewScore  = useMemo(() => computeWellnessScore(form), [form]);

  const scoreColor = previewScore === null ? "var(--c-text-3)"
    : previewScore >= 75 ? "#1D9E75"
    : previewScore >= 50 ? "#E8A020"
    : "#E05252";

  const scoreLabel = previewScore === null ? "—"
    : previewScore >= 75 ? "Optimal"
    : previewScore >= 50 ? "Correct"
    : "Attention";

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSaving(true); setErr(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("athlete_wellness").upsert({
        athlete_id: athlete.id,
        club_id:    clubId,
        date:       today,
        sleep:    form.sleep,
        energy:   form.energy,
        soreness: form.soreness,
        mood:     form.mood,
        stress:   form.stress,
        notes:    notes.trim() || null,
      }, { onConflict: "athlete_id,date" });
      if (error) throw error;
      const saved = { ...form, notes: notes.trim() || null, date: today };
      // Fermer D'ABORD, puis notifier le parent
      onClose();
      onSaved(saved);
    } catch(e) {
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
      onClick={e => e.target === e.currentTarget && onClose()}
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

        {/* Header dark */}
        <div style={{
          padding: "14px 20px 16px",
          flexShrink: 0,
          background: "rgba(29,158,117,0.08)",
          borderBottom: "1px solid rgba(29,158,117,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(29,158,117,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Activity size={17} color="#1D9E75" strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--c-text-1)", lineHeight: 1.3 }}>
                  Comment tu vas ce matin ?
                </h3>
                <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                  {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 9, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>

          {/* Barre de progression */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--c-surface-2)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)" }}>
                  Progression
                </p>
                <p style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>
                  {answeredCount} / {WELLNESS_QUESTIONS.length}
                </p>
              </div>
              <div style={{ height: 4, background: "var(--c-surface-3)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: scoreColor, width: `${(answeredCount / WELLNESS_QUESTIONS.length) * 100}%`, transition: "width 0.4s ease" }} />
              </div>
            </div>
            {previewScore !== null && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: scoreColor, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {previewScore}
                </p>
                <p style={{ fontSize: 9.5, color: scoreColor, marginTop: 2, fontWeight: 500 }}>{scoreLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20, overscrollBehavior: "contain" }}>
          {err && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.20)", borderRadius: 10, padding: "10px 14px" }}>
              <AlertTriangle size={14} color="#E05252" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#E05252" }}>{err}</p>
            </div>
          )}

          {WELLNESS_QUESTIONS.map((q) => {
            const Icon     = q.icon;
            const answered = form[q.key] !== null;
            return (
              <div key={q.key}>
                {/* Label question */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: q.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color={q.color} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-1)" }}>{q.label}</span>
                    {q.inverted && (
                      <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 500, color: "var(--c-text-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        moins = mieux
                      </span>
                    )}
                  </div>
                  {answered && <CheckCircle size={14} color="#1D9E75" style={{ flexShrink: 0 }} />}
                </div>

                {/* Boutons 1-5 */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((v) => {
                    const selected   = form[q.key] === v;
                    const visualGood = q.inverted ? v <= 2 : v >= 4;
                    const visualBad  = q.inverted ? v >= 4 : v <= 2;
                    const btnColor   = selected
                      ? (visualGood ? "#1D9E75" : visualBad ? "#E05252" : "#E8A020")
                      : undefined;
                    return (
                      <button key={v}
                        onClick={() => setForm(f => ({ ...f, [q.key]: v }))}
                        style={{
                          flex: 1, minHeight: 58,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                          borderRadius: 10, cursor: "pointer",
                          border: `1.5px solid ${selected ? btnColor : "var(--c-border-strong)"}`,
                          background: selected ? btnColor + "18" : "var(--c-surface-2)",
                          transition: "all 0.12s ease",
                          transform: selected ? "scale(1.04)" : "scale(1)",
                        }}
                      >
                        <span style={{ fontSize: 17, fontWeight: 600, color: selected ? btnColor : "var(--c-text-1)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          {v}
                        </span>
                        <span style={{ fontSize: 8, textAlign: "center", lineHeight: 1.2, padding: "0 2px", color: selected ? btnColor : "var(--c-text-3)" }}>
                          {q.desc[v - 1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Note optionnelle */}
          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 7 }}>
              Note (optionnel)
            </label>
            <textarea
              style={{ width: "100%", border: "1.5px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--c-text-1)", background: "var(--c-surface-2)", resize: "none", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }}
              rows={2} placeholder="Contexte, ressenti particulier…"
              value={notes} onChange={e => setNotes(e.target.value)}
              onFocus={e => e.target.style.borderColor = "#1D9E75"}
              onBlur={e => e.target.style.borderColor = "var(--c-border-strong)"}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} disabled={saving}
            style={{ flexShrink: 0, minHeight: 44, padding: "0 16px", borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 13, fontWeight: 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.4 : 1 }}>
            Plus tard
          </button>
          <button onClick={handleSubmit} disabled={!allAnswered || saving}
            style={{
              flex: 1, minHeight: 44, borderRadius: 10, border: "none",
              background: allAnswered ? "linear-gradient(135deg, #1D9E75, #16826C)" : "var(--c-surface-2)",
              color: allAnswered ? "white" : "var(--c-text-3)",
              fontSize: 13.5, fontWeight: 500, cursor: allAnswered ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: allAnswered ? "0 4px 12px rgba(29,158,117,0.28)" : "none",
              transition: "all 0.2s ease",
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? (
              <>
                <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin-smooth 0.65s linear infinite" }} />
                Enregistrement…
              </>
            ) : allAnswered ? (
              <><CheckCircle size={15} strokeWidth={2} />Valider</>
            ) : (
              `${5 - answeredCount} question${5 - answeredCount > 1 ? "s" : ""} restante${5 - answeredCount > 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default WellnessModal;