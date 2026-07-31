// ============================================================
// AthleteOS — src/modules/SessionModal.jsx
// Modal détail d'une séance (côté coach) — extraite de Planning.jsx.
// ============================================================

import { memo, useState } from "react";
import { X, Users, FileText, AlertCircle, Star, Zap } from "lucide-react";
import { CATEGORIES, colors, sessionStatus, ValidationBadge, StatusIcon } from "./planningShared";
import { getSessionTrainingFocus } from "../domain/trainingFocus";
import { openSessionPdf } from "../utils/storage";
import CoachSessionDayPanel from "../components/session/CoachSessionDayPanel";

const SessionModal = memo(({
  session, athletes, onClose, onSetRpe, onSetStatus, onEditRequest, onDeleteSession,
  onSetCoachNote, onSetLifecycle, onRemindFeedback,
}) => {
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [durationDrafts, setDurationDrafts] = useState(() => Object.fromEntries(
    (session.validations ?? []).map(validation => [
      validation.athleteId,
      validation.durationSource === "reported" && validation.actualDurationMinutes != null
        ? String(validation.actualDurationMinutes)
        : "",
    ]),
  ));
  const [loadErrors, setLoadErrors] = useState({});
  const c      = colors(session.category);
  const trainingFocus = getSessionTrainingFocus(session);
  const status = sessionStatus(session);

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${session.day} · S${session.week}`;

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDeleteSession(session.id); onClose(); }
    catch { setDeleteError("Impossible de supprimer."); setDeleting(false); }
  };

  const pendingFeedback = session.athleteIds.filter(id => {
    const v = session.validations?.find(val => val.athleteId === id);
    return v?.status == null || ((v?.status === "done" || v?.status === "partial") && (
      v?.rpe == null || v?.durationSource !== "reported" || v?.actualDurationMinutes == null
    ));
  });

  const submitRpe = (athleteId, rpe) => {
    const duration = Number(durationDrafts[athleteId]);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) {
      setLoadErrors(previous => ({ ...previous, [athleteId]: "Durée réelle requise (1 à 1 440 min)." }));
      return;
    }
    setLoadErrors(previous => ({ ...previous, [athleteId]: "" }));
    onSetRpe(session.id, athleteId, rpe, duration);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré — fill faible opacité, pas de blanc */}
        <div
          className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: `${c.border}14`, borderBottom: `2px solid ${c.border}40` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                style={{ background: c.border, color: "#0A150F" }}
              >
                {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
              </span>
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--c-border)", color: "var(--c-text-1)" }}>
                Objectif · {trainingFocus.shortLabel}
              </span>
              {session.createdByAthlete && (
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                  📋 Proposé par un athlète
                </span>
              )}
              <StatusIcon status={status} size={14} />
            </div>
            <h2 className="text-[20px] font-bold leading-tight" style={{ color: c.text }}>
              {session.title}
            </h2>
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: "var(--c-text-2)" }}>
              📅 {dateStr}
              {session.time && ` · ⏰ ${session.time}`}
              {session.durationMinutes && ` · ${session.durationMinutes} min`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 transition-colors"
            style={{ background: "transparent" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <CoachSessionDayPanel
            session={session}
            athletes={athletes}
            onSetCoachNote={onSetCoachNote}
            onSetLifecycle={onSetLifecycle}
            onRemindFeedback={onRemindFeedback}
          />

          {/* Feedback rapide */}
          {pendingFeedback.length > 0 && (
            <div className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "rgba(234,179,8,0.35)", background: "rgba(234,179,8,0.06)" }}>
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(234,179,8,0.18)" }}>
                  <Zap size={13} color="#EAB308" />
                </div>
                <p className="text-[13px] font-bold" style={{ color: "#F0CB61" }}>Confirmer les présences</p>
              </div>
              <div className="p-4 space-y-5">
                {pendingFeedback.map(id => {
                  const a = athletes.find(x => x.id === id);
                  const v = session.validations?.find(val => val.athleteId === id);
                  if (!a) return null;
                  return (
                    <div key={id}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                          style={{ background: c.border, color: "#0A150F" }}>
                          {a.avatar?.slice(0,1) ?? "?"}
                        </div>
                        <p className="text-[12.5px] font-bold" style={{ color: "#F0CB61" }}>{a.name.split(" ")[0]}</p>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {[
                          { id: "done",    label: "✅ Réalisée",  bg: "rgba(61,190,139,0.16)", border: "#3DBE8B", color: "#7BD8B4" },
                          { id: "partial", label: "🟡 Partielle", bg: "rgba(234,179,8,0.16)",  border: "#EAB308", color: "#F0CB61" },
                          { id: "none",    label: "❌ Absent",    bg: "rgba(239,107,107,0.16)",border: "#EF6B6B", color: "#F19A9A" },
                        ].map(opt => {
                          const sel = v?.status === opt.id;
                          return (
                            <button key={opt.id}
                              onClick={() => onSetStatus(session.id, id, opt.id)}
                              className="flex-1 py-2.5 rounded-xl text-[12px] font-bold border-2 transition-all tap-feedback"
                              style={sel
                                ? { background: opt.bg, borderColor: opt.border, color: opt.color }
                                : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {v?.status && v.status !== "none" && (
                        <div>
                          <label className="meta-text font-bold uppercase tracking-wide mb-1.5 block" htmlFor={`duration-${id}`}>
                            Durée réellement effectuée
                          </label>
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              id={`duration-${id}`}
                              type="number"
                              min="1"
                              max="1440"
                              inputMode="numeric"
                              value={durationDrafts[id] ?? ""}
                              onChange={event => {
                                setDurationDrafts(previous => ({ ...previous, [id]: event.target.value }));
                                setLoadErrors(previous => ({ ...previous, [id]: "" }));
                              }}
                              placeholder={session.durationMinutes ? String(session.durationMinutes) : "Minutes"}
                              className="input-premium"
                              style={{ width: 120 }}
                            />
                            <span className="text-[12px]" style={{ color: "var(--c-text-2)" }}>
                              min{session.durationMinutes ? ` · prévu ${session.durationMinutes}` : ""}
                            </span>
                          </div>
                          <p className="meta-text font-bold uppercase tracking-wide mb-1.5">RPE</p>
                          <div className="flex gap-1 flex-wrap">
                            {Array.from({ length: 11 }, (_, i) => {
                              const sel = v?.rpe === i;
                              const rpeColor = i <= 3 ? "#3DBE8B" : i <= 6 ? "#EAB308" : "#EF6B6B";
                              return (
                                <button key={i} onClick={() => submitRpe(id, i)}
                                  className="w-9 h-9 rounded-xl text-[12px] font-bold border-2 transition-all tap-feedback"
                                  style={sel
                                    ? { background: rpeColor, borderColor: rpeColor, color: "#0A150F" }
                                    : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
                                >{i}</button>
                              );
                            })}
                          </div>
                          {loadErrors[id] && <p role="alert" className="text-[12px] mt-2" style={{ color: "#F19A9A" }}>{loadErrors[id]}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div className="rounded-2xl p-4" style={{ background: "var(--c-surface-2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: "var(--c-text-3)" }} />
                <span className="meta-text font-bold uppercase tracking-wide">Description</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--c-text-2)" }}>{session.description}</p>
            </div>
          )}

          {/* Consignes */}
          {session.instructions && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(234,179,8,0.30)", background: "rgba(234,179,8,0.06)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
                <AlertCircle size={13} color="#EAB308" />
                <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F0CB61" }}>Consignes du coach</span>
              </div>
              <p className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#E6D189" }}>{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <button type="button" onClick={() => openSessionPdf(session.pdfUrl)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-semibold transition-colors"
              style={{ background: "rgba(91,158,245,0.10)", border: "1px solid rgba(91,158,245,0.25)", color: "#A9CBFB" }}>
              <span className="text-[18px]">📄</span>
              Voir le PDF de séance
            </button>
          )}

          {/* Athlètes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} style={{ color: "var(--c-text-3)" }} />
              <span className="meta-text font-bold uppercase tracking-wide">
                Participants ({session.athleteIds.length})
              </span>
            </div>
            {session.athleteIds.length === 0 ? (
              <p className="meta-text">Aucun athlète assigné</p>
            ) : (
              <div className="space-y-2">
                {session.athleteIds.map(id => {
                  const a  = athletes.find(x => x.id === id);
                  const v  = session.validations?.find(val => val.athleteId === id);
                  const st = v?.status ?? "future";
                  if (!a) return null;
                  return (
                    <div key={id} className="card flex items-start gap-3 p-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                        style={{ background: c.border, color: "#0A150F" }}>
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[13px] font-bold" style={{ color: "var(--c-text-1)" }}>{a.name}</span>
                          <ValidationBadge status={st} />
                          {v?.rpe != null && (
                            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>
                              RPE {v.rpe}
                            </span>
                          )}
                        </div>
                        {v?.feeling != null && (
                          <div className="flex gap-0.5 mb-1">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={11}
                                fill={v.feeling >= n ? "#EAB308" : "none"}
                                color={v.feeling >= n ? "#EAB308" : "var(--c-border-strong)"} />
                            ))}
                          </div>
                        )}
                        {v?.comment && (
                          <p className="meta-text italic">« {v.comment} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {deleteError && (
            <p className="text-[12px] rounded-xl px-3 py-2" style={{ color: "#F19A9A", background: "rgba(239,107,107,0.10)" }}>{deleteError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} disabled={deleting}
                className="text-[12px] font-semibold transition-colors"
                style={{ color: "#F19A9A" }}>
                Supprimer
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-[12px] font-bold rounded-lg px-2.5 py-1 tap-feedback"
                  style={{ background: "#EF6B6B", color: "#0A150F" }}>
                  {deleting ? "…" : "Oui"}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-[12px]" style={{ color: "var(--c-text-3)" }}>Non</button>
              </span>
            )}
          </div>
          <button onClick={() => onEditRequest(session)} className="btn-primary">
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  );
});

export default SessionModal;
