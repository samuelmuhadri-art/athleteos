import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, CircleDot, ClipboardCheck, Play, RotateCcw, Users } from "lucide-react";
import { ATTENDANCE_OPTIONS, getSessionDayMessage, getSessionDaySummary } from "../../domain/sessionDay";

const TONES = {
  success: { color: "#7BD8B4", background: "rgba(29,158,117,0.12)", border: "rgba(29,158,117,0.28)" },
  warning: { color: "#F2C46D", background: "rgba(232,160,32,0.12)", border: "rgba(232,160,32,0.28)" },
  danger: { color: "#F29B9A", background: "rgba(226,75,74,0.10)", border: "rgba(226,75,74,0.26)" },
};

export default function CoachSessionDayPanel({
  session, athletes, onSetAttendance, onSetCoachNote, onSetLifecycle, onRemindFeedback,
}) {
  const summary = useMemo(() => getSessionDaySummary(session), [session]);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);
  const lifecycle = session.lifecycleStatus ?? "planned";

  const run = async (key, action, success) => {
    if (busyKeys.has(key)) return;
    setBusyKeys(previous => new Set(previous).add(key)); setFeedback(null);
    try {
      await action();
      if (success) setFeedback({ type: "success", text: success });
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "La modification n’a pas pu être enregistrée." });
    } finally {
      setBusyKeys(previous => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  const metrics = [
    { label: "Convoqués", value: summary.total, Icon: Users },
    { label: "Présents", value: summary.present + summary.late, Icon: ClipboardCheck },
    { label: "Retours reçus", value: `${summary.feedbackComplete}/${summary.total}`, Icon: CheckCircle2 },
    { label: "Charge totale", value: summary.totalLoad || "—", Icon: CircleDot },
  ];

  return (
    <section className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(77,201,160,0.25)", background: "linear-gradient(145deg, rgba(29,158,117,0.10), rgba(91,141,239,0.05))" }}>
      <div className="p-4 border-b" style={{ borderColor: "var(--c-border)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="meta-text font-bold uppercase tracking-wide" style={{ color: "#7BD8B4" }}>Jour de séance</p>
            <h3 className="mt-1 text-[15px] font-bold" style={{ color: "var(--c-text-1)" }}>
              {lifecycle === "completed" ? "Séance clôturée" : lifecycle === "live" ? "Séance en cours" : "Prête à démarrer"}
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--c-text-2)" }}>{getSessionDayMessage(summary)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lifecycle === "planned" && (
              <button type="button" className="btn-secondary" disabled={busyKeys.size > 0}
                onClick={() => run("start", () => onSetLifecycle(session.id, "live"), "Le suivi de séance est ouvert.")}>
                <Play size={14} /> Démarrer
              </button>
            )}
            {lifecycle === "live" && (
              <button type="button" className="btn-primary" disabled={busyKeys.size > 0}
                onClick={() => run("close", () => onSetLifecycle(session.id, "completed"), "Séance clôturée et rappels envoyés.")}>
                <CheckCircle2 size={14} /> Clôturer
              </button>
            )}
            {lifecycle === "completed" && (
              <button type="button" className="btn-ghost" disabled={busyKeys.size > 0}
                onClick={() => run("reopen", () => onSetLifecycle(session.id, "live"), "La séance est de nouveau ouverte.")}>
                <RotateCcw size={14} /> Rouvrir
              </button>
            )}
            {summary.feedbackMissing > 0 && (
              <button type="button" className="btn-ghost" disabled={busyKeys.size > 0}
                onClick={() => run("remind", () => onRemindFeedback(session), "Rappel envoyé aux athlètes concernés.")}>
                <BellRing size={14} /> Rappeler ({summary.feedbackMissing})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {metrics.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--c-border)", background: "rgba(10,21,15,0.28)" }}>
              <Icon size={14} style={{ color: "#7BD8B4" }} />
              <p className="mt-2 text-[17px] font-bold" style={{ color: "var(--c-text-1)" }}>{value}</p>
              <p className="meta-text mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Présences réelles</h4>
          {summary.pendingAttendance > 0 && <span className="chip-warning">{summary.pendingAttendance} à confirmer</span>}
        </div>
        {session.athleteIds.map((athleteId) => {
          const athlete = athletes.find((item) => item.id === athleteId);
          const validation = session.validations?.find((item) => item.athleteId === athleteId) ?? {};
          return (
            <div key={athleteId} className="rounded-xl border p-3" style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold" style={{ background: "var(--c-surface-3)", color: "var(--c-text-1)" }}>{athlete?.avatar ?? "?"}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{athlete?.name ?? `Athlète #${athleteId}`}</p>
                  {validation.rsvpStatus && <p className="meta-text">Réponse : {validation.rsvpStatus === "going" ? "présent prévu" : validation.rsvpStatus === "unavailable" ? "indisponible" : "incertain"}</p>}
                </div>
              </div>
              {validation.rsvpNote && (
                <p className="mb-2.5 min-h-9 rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ color: "var(--c-text-2)", background: "rgba(91,141,239,0.08)", border: "1px solid rgba(91,141,239,0.18)" }}>
                  « {validation.rsvpNote} »
                </p>
              )}
              <div className="grid grid-cols-4 gap-1.5">
                {ATTENDANCE_OPTIONS.map((option) => {
                  const selected = validation.attendanceStatus === option.id;
                  const tone = TONES[option.tone];
                  return <button key={option.id} type="button" aria-pressed={selected} disabled={busyKeys.has(`attendance-${athleteId}`)}
                    onClick={() => run(`attendance-${athleteId}`, () => onSetAttendance(session.id, athleteId, option.id))}
                    className="min-h-11 rounded-xl border px-1 text-[12px] leading-tight font-semibold tap-feedback"
                    style={selected ? { color: tone.color, background: tone.background, borderColor: tone.border } : { color: "var(--c-text-2)", background: "transparent", borderColor: "var(--c-border)" }}>
                    {option.label}
                  </button>;
                })}
              </div>
              <textarea defaultValue={validation.coachNote ?? ""} rows={1} maxLength={1000}
                aria-label={`Observation coach pour ${athlete?.name ?? athleteId}`}
                onBlur={(event) => {
                  const note = event.target.value.trim();
                  if (note !== (validation.coachNote ?? "")) run(`note-${athleteId}`, () => onSetCoachNote(session.id, athleteId, note));
                }}
                className="input-premium resize-none mt-2.5" placeholder="Observation coach facultative…" />
            </div>
          );
        })}
      </div>
      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className="mx-4 mb-4 rounded-xl px-3 py-2 text-[13px]" style={{ color: feedback.type === "error" ? "#F29B9A" : "#7BD8B4", background: feedback.type === "error" ? "rgba(226,75,74,0.10)" : "rgba(29,158,117,0.10)" }}>{feedback.text}</p>}
    </section>
  );
}
