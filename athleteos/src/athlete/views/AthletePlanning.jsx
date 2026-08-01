// ============================================================
// AthleteOS — src/athlete/views/AthletePlanning.jsx  ★ DESIGN PREMIUM DARK v2
//
// Logique métier 100% identique à l'original.
// Corrections apportées :
//   - CAT_COLORS : anciennes couleurs pastel "faites pour fond blanc"
//     remplacées par des accents vifs + fonds semi-transparents (rgba)
//     qui fonctionnent sur fond sombre.
//   - Toutes les modales (CreateSessionModal, SessionDetailModal) :
//     bg-white / text-slate-* / border-slate-* (littéraux, cassés en
//     dark) remplacés par les variables CSS var(--c-*) utilisées
//     partout ailleurs dans l'app (Dashboard, Planning coach, etc.)
//   - StatusBadge, boutons présence/RPE : passage en rgba() dark-safe.
// ============================================================

import { useState, useMemo, useRef } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Clock, CalendarDays, CheckCircle,
} from "lucide-react";
import { MONTHS_FR, CATEGORIES, isSameDay, toLocalDateStr } from "../shared";
import { getSessionTrainingFocus } from "../../domain/trainingFocus";
import { isSessionArchived } from "../../domain/sessionArchive";
import { parseLocalDate } from "../../utils/helpers";
import { cat, StatusBadge, rpeColor } from "./planningShared";
import CreateSessionModal from "./CreateSessionModal";
import SessionDetailModal from "./SessionDetailModal";

// Ré-export — AthleteDashboard.jsx importe SessionDetailModal depuis ce
// fichier (`import { SessionDetailModal } from "./AthletePlanning"`), donc
// on garde ce point d'entrée même si la définition a été déplacée dans son
// propre fichier.
export { SessionDetailModal };

function SessionCard({ session, athleteId, isPast = false, compact = false, onOpen, onStatusChange }) {
  const c = cat(session.category);
  const val = session.validations?.find(v => v.athleteId === athleteId);
  const status = val?.status ?? "future";
  const rpeNeeded = isPast && val?.rpe == null && status !== "none" && status !== "future";
  const canSwipe = !compact && status !== "done" && status !== "none";
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartX = useRef(0);
  const justSwiped = useRef(false);

  const openSession = () => {
    if (justSwiped.current) {
      justSwiped.current = false;
      return;
    }
    onOpen(session);
  };

  const handleKeyDown = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSession();
    }
  };

  const onTouchStart = event => {
    if (!canSwipe) return;
    touchStartX.current = event.touches[0].clientX;
    justSwiped.current = false;
    setDragging(true);
  };

  const onTouchMove = event => {
    if (!canSwipe || !dragging) return;
    const delta = event.touches[0].clientX - touchStartX.current;
    if (delta > 0) setDragX(Math.min(delta, 110));
  };

  const onTouchEnd = () => {
    if (!canSwipe) return;
    setDragging(false);
    if (dragX > 72) {
      justSwiped.current = true;
      onStatusChange(session.id, athleteId, "done");
    }
    setDragX(0);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Ouvrir la séance ${session.title}`}
        onClick={event => { event.stopPropagation(); onOpen(session); }}
        onKeyDown={event => {
          event.stopPropagation();
          handleKeyDown(event);
        }}
        className="tap-feedback truncate"
        style={{
          display: "flex", alignItems: "center", gap: 8, minHeight: 32, padding: "6px 8px", borderRadius: 8,
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}`,
        }}
      >
        <span className="truncate" style={{ flex: 1 }}>{session.title}</span>
        {status === "done" && <CheckCircle size={12} color="#3DBE8B" style={{ flexShrink: 0 }} aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {canSwipe && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, borderRadius: 16, display: "flex", alignItems: "center", paddingLeft: 20,
          background: "linear-gradient(90deg, rgba(29,158,117,0.95), rgba(29,158,117,0.55))",
          opacity: Math.min(1, dragX / 55), pointerEvents: "none",
        }}>
          <CheckCircle size={20} color="white" strokeWidth={2.5} />
          <span style={{ color: "white", fontWeight: 800, fontSize: 13, marginLeft: 8 }}>Valider</span>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Ouvrir la séance ${session.title}`}
        onClick={openSession}
        onKeyDown={handleKeyDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="card card-hover tap-feedback"
        style={{
          overflow: "hidden", cursor: "pointer",
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          ...(rpeNeeded ? { borderWidth: 2, borderColor: "#EAB308", boxShadow: "0 0 0 3px rgba(234,179,8,0.14)" } : {}),
        }}
      >
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: c.bg, borderBottom: `1px solid ${c.border}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 10px", borderRadius: 99, background: c.border, color: "#0A150F" }}>
              {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
            </span>
            <span className="chip chip-neutral">{getSessionTrainingFocus(session).shortLabel}</span>
            {session.pdfUrl && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "rgba(91,158,245,0.16)", color: "var(--tone-info)" }}>
                Fichier
              </span>
            )}
          </div>
          <StatusBadge status={status} size="sm" />
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35, marginBottom: 8, color: "var(--c-text-1)" }}>{session.title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--c-text-2)", marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} aria-hidden="true" /> {session.time}</span>
            {session.durationMinutes && <span>{session.durationMinutes} min</span>}
            {val?.rpe != null && <span style={{ fontWeight: 700, color: rpeColor(val.rpe).active }}>RPE {val.rpe}/10</span>}
          </div>
          {session.instructions && (
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--tone-warning)", background: "rgba(234,179,8,0.08)", borderRadius: 12, padding: "8px 12px", marginBottom: 8 }} className="line-clamp-2">
              {session.instructions}
            </p>
          )}
          {rpeNeeded && (
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--tone-warning)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EAB308" }} className="animate-pulse-soft" />
              Valide ta séance
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — AthletePlanning
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePlanning({
  athlete, sessions, allAthletes, clubId, createdBy, coachUserId,
  onRpeChange, onStatusChange, onFeelingChange, onCommentChange, onRsvpChange, onRefresh,
}) {
  const todayKey = toLocalDateStr(new Date());
  const today    = useMemo(() => parseLocalDate(todayKey), [todayKey]);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,      setViewYear]      = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(today.getMonth());
  const [viewMode,      setViewMode]      = useState(isMobile ? "agenda" : "month");
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [activeSession, setActiveSession] = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (!s.sessionDate) return;
      const key = s.sessionDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const calDays = useMemo(() => {
    const first    = new Date(viewYear, viewMonth, 1);
    const last     = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const days     = [];
    for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth, -i), cur: false });
    for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(viewYear, viewMonth, d), cur: true });
    const rem = 7 - (days.length % 7);
    if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(viewYear, viewMonth + 1, d), cur: false });
    return days;
  }, [viewYear, viewMonth]);

  const weekDays = useMemo(() => {
    const ref = selectedDate;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selectedDate]);

  const groupedAgenda = useMemo(() => {
    const sorted = [...sessions].filter(s => s.sessionDate && !isSessionArchived(s, today)).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const groups = []; const seen = new Set();
    sorted.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [sessions, today]);

  const groupedArchives = useMemo(() => {
    const sorted = [...sessions].filter(s => s.sessionDate && isSessionArchived(s, today)).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    const groups = []; const seen = new Set();
    sorted.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [sessions, today]);

  const archivedSessionCount = groupedArchives.reduce((total, group) => total + group.sessions.length, 0);
  const displayedAgenda = viewMode === "archive" ? groupedArchives : groupedAgenda;

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()-7); setSelectedDate(d); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()+7); setSelectedDate(d); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month")  return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    if (viewMode === "agenda") return "Mes séances";
    if (viewMode === "archive") return `Archives · ${archivedSessionCount}`;
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays, archivedSessionCount]);

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

      <header className="header-glass px-4 md:px-6 py-4 flex-shrink-0 z-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="page-title">Mon planning</h1>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>
                Consulte et valide tes séances d’entraînement.
              </p>
            </div>
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary" style={{ flexShrink: 0 }}>
              <Plus size={16} aria-hidden="true" /><span className="hidden sm:inline">Planifier</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 min-w-0">
              {!['agenda', 'archive'].includes(viewMode) && (
                <button type="button" aria-label="Période précédente" onClick={viewMode === "month" ? prevMonth : prevWeek}
                  className="tap-feedback"
                  style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
              )}
              <p style={{ fontSize: 15, fontWeight: 800, padding: "0 8px", minWidth: 0, flex: 1, textAlign: ['agenda', 'archive'].includes(viewMode) ? "left" : "center", color: "var(--c-text-1)" }} className="truncate">
                {navLabel}
              </p>
              {!['agenda', 'archive'].includes(viewMode) && (
                <button type="button" aria-label="Période suivante" onClick={viewMode === "month" ? nextMonth : nextWeek}
                  className="tap-feedback"
                  style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
              {!['agenda', 'archive'].includes(viewMode) && (
                <button type="button" onClick={goToday}
                  style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: "1px solid var(--c-border-strong)", color: "var(--c-text-2)", background: "var(--c-surface-2)", cursor: "pointer", marginLeft: 4 }}>
                  <span className="hidden sm:inline">Aujourd’hui</span><span className="sm:hidden">Auj.</span>
                </button>
              )}
            </div>

            <div role="group" aria-label="Affichage du planning" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border-strong)" }}>
              {[{ id: "agenda", label: "Liste" }, { id: "month", label: "Mois" }, { id: "week", label: "Semaine" }, { id: "archive", label: `Archives (${archivedSessionCount})` }].map(view => (
                <button key={view.id} type="button" onClick={() => setViewMode(view.id)} aria-pressed={viewMode === view.id}
                  style={{
                    minHeight: 44, padding: "0 14px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                    background: viewMode === view.id ? "var(--c-accent)" : "var(--c-surface-2)",
                    color: viewMode === view.id ? "#07130F" : "var(--c-text-2)",
                  }}>
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          VUE AGENDA
         ══════════════════════════════════════════════════════════════════════ */}
      {(viewMode === "agenda" || viewMode === "archive") && (
        <div className="flex-1 overflow-y-auto">
          {displayedAgenda.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarDays size={28} color="var(--c-text-3)" strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{viewMode === "archive" ? "Aucune séance archivée" : "Aucune séance planifiée"}</p>
                <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>{viewMode === "archive" ? "Les séances de plus de 7 jours apparaîtront ici." : "Ton coach ou toi pouvez planifier des séances"}</p>
              </div>
              {viewMode !== "archive" && (
                <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
                  <Plus size={14} /> Planifier une séance
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-6">
              {displayedAgenda.map(({ date, sessions: ds }) => {
                const dateObj = parseLocalDate(date);
                const isToday = isSameDay(dateObj, today);
                const isPast  = toLocalDateStr(dateObj) < toLocalDateStr(today);
                return (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <div style={{
                        width: 48, height: 48, borderRadius: 16, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : "var(--c-surface-2)",
                        border: isToday ? "none" : "1px solid var(--c-border)",
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", lineHeight: 1, color: isToday ? "rgba(255,255,255,0.82)" : "var(--c-text-2)" }}>
                          {dateObj.toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: isToday ? "white" : (isPast ? "var(--c-text-3)" : "var(--c-text-1)") }}>
                          {dateObj.getDate()}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: isToday ? "#7BD8B4" : (isPast ? "var(--c-text-2)" : "var(--c-text-1)") }}>
                          {isToday ? "Aujourd'hui" : dateObj.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 2 }}>
                          {ds.length} séance{ds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16, paddingLeft: 24, borderLeft: "2px solid var(--c-border)" }} className="space-y-3">
                      {ds.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")).map(s => (
                        <SessionCard key={s.id} session={s} athleteId={athlete.id} isPast={isPast} onOpen={setActiveSession} onStatusChange={onStatusChange} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VUE MOIS
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-7 mb-2">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "8px 0" }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {calDays.map(({ date, cur }, idx) => {
              const key     = toLocalDateStr(date);
              const ds      = sessionsByDate[key] ?? [];
              const isToday = isSameDay(date, today);
              const isSel   = selectedDate && isSameDay(date, selectedDate);

              return (
                <div key={idx} role="button" tabIndex={0}
                  aria-label={`${date.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}, ${ds.length} séance${ds.length > 1 ? "s" : ""}`}
                  onClick={() => { setSelectedDate(date); if (window.innerWidth < 768) setViewMode("week"); }}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(date);
                      if (window.innerWidth < 768) setViewMode("week");
                    }
                  }}
                  className="tap-feedback"
                  style={{
                    minHeight: 60, borderRadius: 14, padding: 6, cursor: "pointer",
                    border: isToday ? "2px solid rgba(29,158,117,0.45)" : isSel ? "2px solid rgba(91,158,245,0.45)" : "1px solid var(--c-border)",
                    background: isToday ? "rgba(29,158,117,0.08)" : isSel ? "rgba(91,158,245,0.08)" : cur ? "var(--c-surface)" : "transparent",
                    opacity: cur ? 1 : 0.35,
                  }}>
                  <div className="flex items-start justify-between mb-1">
                    <span style={{
                      fontSize: 12, fontWeight: 800, width: 24, height: 24, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : "transparent",
                      color: isToday ? "white" : (cur ? "var(--c-text-1)" : "var(--c-text-3)"),
                    }}>
                      {date.getDate()}
                    </span>
                    {ds.length > 0 && (
                      <div className="md:hidden flex flex-wrap gap-0.5 justify-end mt-1">
                        {ds.slice(0, 3).map(s => (
                          <button key={s.id} type="button" aria-label={`Ouvrir ${s.title}`} style={{ width: 12, height: 12, borderRadius: "50%", background: cat(s.category).border, border: "none", padding: 0 }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block space-y-0.5">
                    {ds.slice(0, 3).map(s => <SessionCard key={s.id} session={s} athleteId={athlete.id} compact onOpen={setActiveSession} onStatusChange={onStatusChange} />)}
                    {ds.length > 3 && (
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", padding: "4px" }}>+{ds.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && (() => {
            const key = toLocalDateStr(selectedDate);
            const ds  = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
            if (!ds.length) return null;
            const isPast = toLocalDateStr(selectedDate) < toLocalDateStr(today);
            return (
              <div className="mt-5 space-y-2">
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={9} color="white" />
                  </span>
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {ds.map(s => <SessionCard key={s.id} session={s} athleteId={athlete.id} isPast={isPast} onOpen={setActiveSession} onStatusChange={onStatusChange} />)}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VUE SEMAINE
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "week" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", flexShrink: 0, scrollbarWidth: "none" }}>
            {weekDays.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isSel   = isSameDay(date, selectedDate ?? today);
              const hasSess = (sessionsByDate[toLocalDateStr(date)] ?? []).length > 0;
              return (
                <button key={i} onClick={() => setSelectedDate(date)}
                  className="tap-feedback"
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 44, padding: "10px 0", borderRadius: 16, border: "none", cursor: "pointer",
                    background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : isSel ? "var(--c-surface-3)" : "transparent",
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: (isToday || isSel) ? "rgba(255,255,255,0.82)" : "var(--c-text-2)" }}>
                    {["L", "M", "M", "J", "V", "S", "D"][i]}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: (isToday || isSel) ? "white" : "var(--c-text-1)" }}>
                    {date.getDate()}
                  </span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: hasSess ? ((isToday || isSel) ? "rgba(255,255,255,0.6)" : "#1D9E75") : "transparent" }} />
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            {(() => {
              const key     = toLocalDateStr(selectedDate ?? today);
              const ds      = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
              const dateObj = selectedDate ?? today;
              const isPast  = toLocalDateStr(dateObj) < toLocalDateStr(today);

              if (ds.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={24} color="var(--c-text-3)" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-3)" }}>Repos ce jour</p>
                  <button type="button" onClick={() => setShowCreate(true)} style={{ minHeight: 44, padding: "0 12px", fontSize: 13, fontWeight: 700, color: "var(--tone-success)", background: "none", border: "none", cursor: "pointer" }}>
                    + Planifier une séance
                  </button>
                </div>
              );

              return ds.map(s => <SessionCard key={s.id} session={s} athleteId={athlete.id} isPast={isPast} onOpen={setActiveSession} onStatusChange={onStatusChange} />);
            })()}
          </div>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {liveActive && (
        <SessionDetailModal
          session={liveActive}
          athlete={athlete}
          allAthletes={allAthletes}
          onClose={() => setActiveSession(null)}
          onSetStatus={onStatusChange}
          onSetRpe={onRpeChange}
          onSetFeeling={onFeelingChange}
          onSetComment={onCommentChange}
          onSetRsvp={onRsvpChange}
        />
      )}
      {showCreate && (
        <CreateSessionModal
          athlete={athlete}
          allAthletes={allAthletes}
          clubId={clubId}
          createdBy={createdBy}
          coachUserId={coachUserId}
          onClose={() => setShowCreate(false)}
          onCreated={onRefresh}
        />
      )}
    </div>
  );
}
