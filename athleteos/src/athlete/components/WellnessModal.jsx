// ============================================================
// AthleteOS — src/athlete/components/WellnessModal.jsx
// Extrait de AthleteApp.jsx — const WellnessModal = memo(...)
// Zéro modification du code.
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

  const scoreColor = previewScore === null ? "#94a3b8"
    : previewScore >= 75 ? "#1D9E75"
    : previewScore >= 50 ? "#EF9F27"
    : "#E24B4A";

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
      onSaved({ ...form, notes: notes.trim() || null, date: today });
      onClose();
    } catch(e) {
      setErr(e.message ?? "Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bottom-sheet-backdrop flex items-end sm:items-center justify-center sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bottom-sheet sm:rounded-3xl w-full sm:max-w-md sm:static sm:transform-none flex flex-col overflow-hidden"
        style={{ maxHeight: "92dvh" }}
      >
        <div className="bottom-sheet-handle sm:hidden" />

        <div
          className="px-5 pt-5 pb-4 flex-shrink-0 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #1D9E75, transparent)" }} />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(29,158,117,0.15)" }}>
                <Activity size={18} color="#1D9E75" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-emerald-900 leading-tight">
                  Comment tu vas ce matin ?
                </h3>
                <p className="text-[11.5px] text-emerald-600 mt-0.5">
                  {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60 hover:bg-white/90 transition-colors tap-feedback">
              <X size={16} className="text-emerald-700" />
            </button>
          </div>

          <div className="relative mt-4 flex items-center gap-3 bg-white/70 rounded-2xl px-4 py-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progression</p>
                <p className="text-[10px] font-semibold text-slate-400">{answeredCount} / {WELLNESS_QUESTIONS.length}</p>
              </div>
              <div className="progress-bar">
                <div className="progress-fill"
                  style={{ width: `${(answeredCount / WELLNESS_QUESTIONS.length) * 100}%`, background: scoreColor }} />
              </div>
            </div>
            {previewScore !== null && (
              <div className="flex-shrink-0 text-right">
                <p className="text-[22px] font-black leading-none" style={{ color: scoreColor }}>{previewScore}</p>
                <span className="chip mt-1" style={{ background: scoreColor + "18", color: scoreColor }}>{scoreLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6" style={{ overscrollBehavior: "contain" }}>
          {err && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2.5">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-700">{err}</p>
            </div>
          )}

          {WELLNESS_QUESTIONS.map((q) => {
            const Icon     = q.icon;
            const answered = form[q.key] !== null;
            return (
              <div key={q.key}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: q.color + "15" }}>
                    <Icon size={15} color={q.color} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-slate-800">{q.label}</span>
                    {q.inverted && (
                      <span className="ml-2 text-[9.5px] font-semibold text-slate-300 uppercase tracking-wider">
                        (moins = mieux)
                      </span>
                    )}
                  </div>
                  {answered && <CheckCircle size={15} color="#1D9E75" className="flex-shrink-0" />}
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => {
                    const selected   = form[q.key] === v;
                    const visualGood = q.inverted ? v <= 2 : v >= 4;
                    const visualBad  = q.inverted ? v >= 4 : v <= 2;
                    const btnColor   = selected
                      ? (visualGood ? "#1D9E75" : visualBad ? "#E24B4A" : "#EF9F27")
                      : undefined;
                    return (
                      <button key={v}
                        onClick={() => setForm(f => ({ ...f, [q.key]: v }))}
                        className={["flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-150 tap-feedback select-none",
                          selected ? "text-white shadow-sm scale-[1.03]" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                        ].join(" ")}
                        style={{ minHeight: "60px", ...(selected ? { background: btnColor, borderColor: btnColor } : {}) }}
                      >
                        <span className="text-[17px] font-bold leading-none">{v}</span>
                        <span className="text-[8px] font-semibold text-center leading-tight px-0.5"
                          style={selected ? { color: "rgba(255,255,255,0.85)" } : { color: "#94a3b8" }}>
                          {q.desc[v - 1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Note (optionnel)
            </label>
            <textarea
              className="w-full border-[1.5px] border-slate-200 rounded-2xl px-4 py-3 text-[13px] text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white resize-none transition-all"
              rows={2} placeholder="Contexte, ressenti particulier…"
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} disabled={saving}
            className="flex-shrink-0 flex items-center justify-center gap-1.5 px-5 rounded-2xl bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 disabled:opacity-40 transition-colors tap-feedback"
            style={{ minHeight: "44px" }}>
            Plus tard
          </button>
          <button onClick={handleSubmit} disabled={!allAnswered || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl text-white text-[13.5px] font-semibold disabled:opacity-40 transition-all tap-feedback"
            style={{ minHeight: "44px", background: allAnswered ? "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" : "#94a3b8", boxShadow: allAnswered ? "0 4px 12px rgba(29,158,117,0.30)" : "none" }}>
            {saving ? (
              <><div className="loader-ring loader-ring-sm" />Enregistrement…</>
            ) : (
              <><CheckCircle size={15} strokeWidth={2.5} />
                {allAnswered ? "Valider" : `${5 - answeredCount} question${5 - answeredCount > 1 ? "s" : ""} restante${5 - answeredCount > 1 ? "s" : ""}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default WellnessModal;