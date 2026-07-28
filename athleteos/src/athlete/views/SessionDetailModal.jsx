// ============================================================
// AthleteOS — src/athlete/views/SessionDetailModal.jsx
// Modal détail d'une séance — extraite d'AthletePlanning.jsx.
// Ré-exportée depuis AthletePlanning.jsx pour ne pas casser les
// imports existants (AthleteDashboard.jsx l'importe depuis là).
// ============================================================

import { useState, memo } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, Users, FileText, Star } from "lucide-react";
import { CATEGORIES } from "../shared";
import { cat, StatusBadge, rpeColor } from "./planningShared";
import { openSessionPdf } from "../../utils/storage";

const SessionDetailModal = memo(({ session, athlete, allAthletes, onClose, onSetStatus, onSetRpe, onSetFeeling, onSetComment }) => {
  const c   = cat(session.category);
  const val = session.validations?.find(v => v.athleteId === athlete.id);
  const [comment, setComment] = useState(val?.comment ?? "");

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : session.day;

  const status  = val?.status ?? null;
  const hasPerf = status === "done" || status === "partial";
  const labelStyle = { fontSize: 10.5, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, display: "block" };

  const presenceOpts = [
    { id: "done",    label: "Réalisée",  activeBg: "rgba(61,190,139,0.16)",  activeBorder: "#3DBE8B", activeText: "#7BD8B4" },
    { id: "partial", label: "Partielle", activeBg: "rgba(234,179,8,0.16)",   activeBorder: "#EAB308", activeText: "#F0CB61" },
    { id: "none",    label: "Absent",    activeBg: "rgba(239,107,107,0.16)", activeBorder: "#EF6B6B", activeText: "#F19A9A" },
  ];

  // Portal sur document.body — même raison que CreateSessionModal :
  // ouvert depuis Planning et depuis la carte "Séance du jour" du Dashboard,
  // toutes deux à l'intérieur du conteneur scrollable <main>.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        {/* Poignée mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré catégorie */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: c.bg, borderBottom: `2px solid ${c.border}` }}>
          <div className="flex-1 min-w-0">
            <span style={{
              fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
              padding: "4px 10px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4,
              marginBottom: 10, background: c.border, color: "#0A150F",
            }}>
              {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
            </span>
            <h3 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: c.text }}>
              {session.title}
            </h3>
            <p style={{ fontSize: 12, marginTop: 8, fontWeight: 500, color: "var(--c-text-2)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{dateStr}</span>
              {session.time && <span>· {session.time}</span>}
              {session.durationMinutes && <span>· {session.durationMinutes} min</span>}
            </p>
          </div>
          <button onClick={onClose}
            style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Description */}
          {session.description && (
            <div style={{ background: "var(--c-surface-2)", borderRadius: 16, padding: 16, border: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--c-text-2)" }}>{session.description}</p>
            </div>
          )}

          {/* Consignes coach */}
          {session.instructions && (
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(234,179,8,0.25)", background: "rgba(234,179,8,0.06)" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(234,179,8,0.18)" }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#F0CB61", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Consignes du coach
                </span>
              </div>
              <p style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "#E6D189" }}>{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <button type="button" onClick={() => openSessionPdf(session.pdfUrl)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16,
                background: "rgba(91,158,245,0.10)", border: "1px solid rgba(91,158,245,0.25)",
                fontSize: 13, fontWeight: 700, color: "#5B9EF5", textDecoration: "none",
                width: "100%", cursor: "pointer",
              }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(91,158,245,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={14} color="#5B9EF5" />
              </div>
              Voir le PDF de séance
              <ChevronRight size={14} style={{ marginLeft: "auto", color: "#5B9EF5", opacity: 0.6 }} />
            </button>
          )}

          {/* Athlètes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Users size={13} color="var(--c-text-3)" />
              <span style={labelStyle}>Participants ({session.athleteIds.length})</span>
            </div>
            {session.athleteIds.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--c-text-4)" }}>Aucun athlète assigné</p>
            ) : (
              <div className="space-y-2">
                {session.athleteIds.map(id => {
                  const a  = allAthletes?.find(x => x.id === id);
                  const v  = session.validations?.find(val => val.athleteId === id);
                  const st = v?.status ?? "future";
                  return (
                    <div key={id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: c.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A150F", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {a?.avatar ?? "?"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{a?.name ?? `Athlète #${id}`}</span>
                          <StatusBadge status={st} />
                          {v?.rpe != null && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>
                              RPE {v.rpe}
                            </span>
                          )}
                        </div>
                        {v?.feeling != null && (
                          <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={11}
                                fill={v.feeling >= n ? "#EAB308" : "none"}
                                color={v.feeling >= n ? "#EAB308" : "var(--c-border-strong)"} />
                            ))}
                          </div>
                        )}
                        {v?.comment && (
                          <p style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--c-text-3)" }}>« {v.comment} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Présence ── */}
          <div>
            <label style={labelStyle}>Ma présence</label>
            <div className="flex gap-2">
              {presenceOpts.map(opt => {
                const sel = status === opt.id;
                return (
                  <button key={opt.id} onClick={() => onSetStatus(session.id, athlete.id, opt.id)}
                    className="tap-feedback"
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 16, fontSize: 11.5, fontWeight: 700,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      border: `1.5px solid ${sel ? opt.activeBorder : "var(--c-border-strong)"}`,
                      background: sel ? opt.activeBg : "var(--c-surface-2)",
                      color: sel ? opt.activeText : "var(--c-text-3)",
                      cursor: "pointer",
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── RPE ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>
                Effort ressenti (RPE)
                {val?.rpe != null && (
                  <span style={{ marginLeft: 8, fontWeight: 800, color: rpeColor(val.rpe).active }}>
                    {val.rpe}/10
                  </span>
                )}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => {
                  const rc  = rpeColor(i);
                  const sel = val?.rpe === i;
                  return (
                    <button key={i} onClick={() => onSetRpe(session.id, athlete.id, i)}
                      className="tap-feedback"
                      style={{
                        width: 38, height: 38, borderRadius: 12, fontSize: 12, fontWeight: 800,
                        border: `1.5px solid ${sel ? rc.border : "var(--c-border-strong)"}`,
                        background: sel ? rc.active : "var(--c-surface-2)",
                        color: sel ? rc.text : "var(--c-text-3)",
                        transform: sel ? "scale(1.1)" : "scale(1)",
                        boxShadow: sel ? `0 2px 8px ${rc.active}55` : "none",
                        cursor: "pointer",
                      }}>
                      {i}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                {[{ range: "0-3", color: "#22C55E", label: "Facile" }, { range: "4-6", color: "#F59E0B", label: "Modéré" }, { range: "7-10", color: "#EF4444", label: "Intense" }].map(l => (
                  <div key={l.range} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
                    <span style={{ fontSize: 10, color: "var(--c-text-4)", fontWeight: 500 }}>{l.range} {l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ressenti général ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>
                Ressenti général
                {val?.feeling != null && <span style={{ marginLeft: 8, fontWeight: 800, color: "#EAB308" }}>{val.feeling}/5</span>}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => onSetFeeling(session.id, athlete.id, n)}
                    className="tap-feedback" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                    <Star size={30}
                      fill={val?.feeling >= n ? "#EAB308" : "none"}
                      color={val?.feeling >= n ? "#EAB308" : "var(--c-border-strong)"}
                      strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Commentaire ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>Commentaire</label>
              <textarea
                className="input-premium resize-none"
                rows={3}
                placeholder="Comment s'est passée la séance ?"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onBlur={() => onSetComment(session.id, athlete.id, comment.trim())}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default SessionDetailModal;
