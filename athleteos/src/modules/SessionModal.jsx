// ============================================================
// AthleteOS — src/modules/SessionModal.jsx
// Modal détail d'une séance (côté coach) — extraite de Planning.jsx.
// ============================================================

import { memo, useState } from "react";
import { X, Users, FileText, AlertCircle, Star } from "lucide-react";
import { CATEGORIES, colors, sessionStatus, ValidationBadge, StatusIcon } from "./planningShared";
import { getSessionTrainingFocus } from "../domain/trainingFocus";
import { openSessionPdf } from "../utils/storage";
import CoachSessionDayPanel from "../components/session/CoachSessionDayPanel";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";

const SessionModal = memo(({
  session, athletes, onClose, onEditRequest, onDeleteSession,
  onSetCoachNote, onSetLifecycle, onRemindFeedback,
}) => {
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled: deleting });
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !deleting && onClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
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
                  style={{ background: "rgba(168,85,247,0.16)", color: "var(--tone-mental)" }}>
                  📋 Proposé par un athlète
                </span>
              )}
              <StatusIcon status={status} size={14} />
            </div>
            <h2 id={titleId} className="text-[20px] font-bold leading-tight" style={{ color: c.text }}>
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
            disabled={deleting}
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
                <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--tone-warning)" }}>Consignes du coach</span>
              </div>
              <p className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#E6D189" }}>{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <button type="button" onClick={() => openSessionPdf(session.pdfUrl)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-semibold transition-colors"
              style={{ background: "rgba(91,158,245,0.10)", border: "1px solid rgba(91,158,245,0.25)", color: "var(--tone-info)" }}>
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
            <p className="text-[12px] rounded-xl px-3 py-2" style={{ color: "var(--tone-danger)", background: "rgba(239,107,107,0.10)" }}>{deleteError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} disabled={deleting}
                className="text-[12px] font-semibold transition-colors"
                style={{ color: "var(--tone-danger)" }}>
                Supprimer
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "var(--tone-danger)" }}>Confirmer ?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-[12px] font-bold rounded-lg px-2.5 py-1 tap-feedback"
                  style={{ background: "#EF6B6B", color: "#0A150F" }}>
                  {deleting ? "…" : "Oui"}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-[12px]" style={{ color: "var(--c-text-3)" }}>Non</button>
              </span>
            )}
          </div>
          <button onClick={() => onEditRequest(session)} disabled={deleting} className="btn-primary">
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  );
});

export default SessionModal;
