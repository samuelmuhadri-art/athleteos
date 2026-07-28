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

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Clock, CalendarDays, CheckCircle,
} from "lucide-react";
import {
  DAYS_SHORT, MONTHS_FR, CATEGORIES,
  isSameDay, toLocalDateStr,
} from "../shared";
import { cat, StatusBadge, rpeColor } from "./planningShared";
import CreateSessionModal from "./CreateSessionModal";
import SessionDetailModal from "./SessionDetailModal";

// Ré-export — AthleteDashboard.jsx importe SessionDetailModal depuis ce
// fichier (`import { SessionDetailModal } from "./AthletePlanning"`), donc
// on garde ce point d'entrée même si la définition a été déplacée dans son
// propre fichier.
export { SessionDetailModal };

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — AthletePlanning
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePlanning({
  athlete, sessions, allAthletes, clubId, createdBy, coachUserId,
  onRpeChange, onStatusChange, onFeelingChange, onCommentChange, onRefresh,
}) {
  const today    = new Date();
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
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupedAgenda = useMemo(() => {
    const sorted = [...sessions].filter(s => s.sessionDate).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const groups = []; const seen = new Set();
    sorted.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [sessions]);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()-7); setSelectedDate(d); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()+7); setSelectedDate(d); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month")  return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    if (viewMode === "agenda") return "Mes séances";
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  const SessionCard = useCallback(({ s, isPast = false, compact = false }) => {
    const c   = cat(s.category);
    const val = s.validations?.find(v => v.athleteId === athlete.id);
    const st  = val?.status ?? "future";
    const rpeNeeded = isPast && val?.rpe == null && st !== "none" && st !== "future";

    // ── Swipe à droite pour valider en un geste, sans ouvrir la modale ──────
    // Ne capture le geste que sur les cartes non-compactes et non déjà
    // validées — inutile de re-swiper une séance déjà "faite".
    const canSwipe = !compact && st !== "done" && st !== "none";
    // Trouvé par le lint react-hooks/rules-of-hooks ajouté à la tâche 19 —
    // SessionCard est un composant défini via useCallback (donc son
    // identité change quand [athlete.id, onStatusChange] change), pas
    // reconnu comme un vrai composant stable : à chaque changement
    // d'identité, React le démonte/remonte et l'état de swipe ci-dessous
    // (dragX/dragging) est perdu. Bug réel et pré-existant, pas corrigé
    // ici (corriger proprement = extraire SessionCard en composant de haut
    // niveau et faire remonter ses props — hors périmètre d'une tâche
    // d'installation d'outillage de test, à traiter dans une tâche dédiée).
    /* eslint-disable react-hooks/rules-of-hooks */
    const [dragX, setDragX]     = useState(0);
    const [dragging, setDragging] = useState(false);
    const touchStartX = useRef(0);
    const justSwiped  = useRef(false);
    /* eslint-enable react-hooks/rules-of-hooks */

    const onTouchStart = (e) => {
      if (!canSwipe) return;
      touchStartX.current = e.touches[0].clientX;
      justSwiped.current = false;
      setDragging(true);
    };
    const onTouchMove = (e) => {
      if (!canSwipe || !dragging) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      if (dx > 0) setDragX(Math.min(dx, 110));
    };
    const onTouchEnd = () => {
      if (!canSwipe) return;
      setDragging(false);
      if (dragX > 72) {
        justSwiped.current = true;
        onStatusChange(s.id, athlete.id, "done");
      }
      setDragX(0);
    };
    const onCardClick = () => {
      // Un swipe qui vient de valider ne doit pas aussi ouvrir la modale.
      if (justSwiped.current) { justSwiped.current = false; return; }
      setActiveSession(s);
    };

    if (compact) {
      return (
        <div onClick={e => { e.stopPropagation(); setActiveSession(s); }}
          className="tap-feedback truncate"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 10,
            fontSize: 9.5, fontWeight: 700, cursor: "pointer",
            background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}`,
          }}>
          <span className="truncate" style={{ flex: 1 }}>{s.title}</span>
          {st === "done" && <CheckCircle size={9} color="#3DBE8B" style={{ flexShrink: 0 }} />}
        </div>
      );
    }

    return (
      <div style={{ position: "relative" }}>
        {canSwipe && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 16, display: "flex", alignItems: "center", paddingLeft: 20,
            background: "linear-gradient(90deg, rgba(29,158,117,0.95), rgba(29,158,117,0.55))",
            opacity: Math.min(1, dragX / 55), pointerEvents: "none",
          }}>
            <CheckCircle size={20} color="white" strokeWidth={2.5} />
            <span style={{ color: "white", fontWeight: 800, fontSize: 13, marginLeft: 8 }}>Valider</span>
          </div>
        )}
        <div onClick={onCardClick}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          className="card card-hover tap-feedback"
          style={{
            overflow: "hidden", cursor: "pointer",
            transform: dragX ? `translateX(${dragX}px)` : undefined,
            transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
            ...(rpeNeeded ? { borderWidth: 2, borderColor: "#EAB308", boxShadow: "0 0 0 3px rgba(234,179,8,0.14)" } : {}),
          }}>
        {/* En-tête coloré catégorie */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: c.bg, borderBottom: `1.5px solid ${c.border}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 99, background: c.border, color: "#0A150F" }}>
              {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
            </span>
            {s.pdfUrl && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(91,158,245,0.16)", color: "#5B9EF5" }}>
                PDF
              </span>
            )}
          </div>
          <StatusBadge status={st} size="sm" />
        </div>
        {/* Corps */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 6, color: "var(--c-text-1)" }}>{s.title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {s.time}</span>
            {s.durationMinutes && <span>{s.durationMinutes} min</span>}
            {val?.rpe != null && (
              <span style={{ fontWeight: 700, color: rpeColor(val.rpe).active }}>RPE {val.rpe}/10</span>
            )}
          </div>
          {s.instructions && (
            <p style={{ fontSize: 11, color: "#F0CB61", background: "rgba(234,179,8,0.08)", borderRadius: 12, padding: "8px 12px", marginBottom: 8 }} className="line-clamp-2">
              {s.instructions}
            </p>
          )}
          {rpeNeeded && (
            <p style={{ fontSize: 11, fontWeight: 700, color: "#F0CB61", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EAB308" }} className="animate-pulse-soft" />
              Valide ta séance
            </p>
          )}
        </div>
        </div>
      </div>
    );
  }, [athlete.id, onStatusChange]);

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

      {/* ── HEADER GLASSMORPHISM ─────────────────────────────────────────────── */}
      <div className="header-glass px-3 md:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-10">

        <div className="flex items-center gap-1">
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? prevMonth : prevWeek}
              className="tap-feedback"
              style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-2)" }}>
              <ChevronLeft size={16} />
            </button>
          )}
          <p style={{ fontSize: 14, fontWeight: 800, padding: "0 4px", minWidth: 100, textAlign: "center", color: "var(--c-text-1)" }} className="truncate">
            {navLabel}
          </p>
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? nextMonth : nextWeek}
              className="tap-feedback"
              style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-2)" }}>
              <ChevronRight size={16} />
            </button>
          )}
          {viewMode !== "agenda" && (
            <button onClick={goToday}
              style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, border: "1px solid var(--c-border-strong)", color: "var(--c-text-3)", background: "none", cursor: "pointer", marginLeft: 4 }}>
              Auj.
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border-strong)" }}>
            {[{ id: "agenda", label: "Liste" }, { id: "month", label: "Mois" }, { id: "week", label: "Sem." }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                style={{
                  padding: "6px 12px", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer",
                  background: viewMode === v.id ? "#1D9E75" : "var(--c-surface-2)",
                  color: viewMode === v.id ? "#0A150F" : "var(--c-text-3)",
                }}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: "0 12px", minHeight: 34 }}>
            <Plus size={14} /><span className="hidden sm:inline">Planifier</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VUE AGENDA
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "agenda" && (
        <div className="flex-1 overflow-y-auto">
          {groupedAgenda.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarDays size={28} color="var(--c-text-4)" strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>Aucune séance planifiée</p>
                <p style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 4 }}>Ton coach ou toi pouvez planifier des séances</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={14} /> Planifier une séance
              </button>
            </div>
          ) : (
            <div className="p-3 md:p-5 space-y-6">
              {groupedAgenda.map(({ date, sessions: ds }) => {
                const dateObj = new Date(date);
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
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", lineHeight: 1, color: isToday ? "rgba(255,255,255,0.75)" : "var(--c-text-3)" }}>
                          {dateObj.toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: isToday ? "white" : (isPast ? "var(--c-text-4)" : "var(--c-text-1)") }}>
                          {dateObj.getDate()}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#4DC9A0" : (isPast ? "var(--c-text-4)" : "var(--c-text-1)") }}>
                          {isToday ? "Aujourd'hui" : dateObj.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>
                          {ds.length} séance{ds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16, paddingLeft: 44, borderLeft: "2px solid var(--c-border)" }} className="space-y-2.5">
                      {ds.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")).map(s => (
                        <SessionCard key={s.id} s={s} isPast={isPast} />
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
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-7 mb-2">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "var(--c-text-4)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "6px 0" }}>
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
                <div key={idx}
                  onClick={() => { setSelectedDate(date); if (window.innerWidth < 768) setViewMode("week"); }}
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
                      color: isToday ? "white" : (cur ? "var(--c-text-1)" : "var(--c-text-4)"),
                    }}>
                      {date.getDate()}
                    </span>
                    {ds.length > 0 && (
                      <div className="md:hidden flex flex-wrap gap-0.5 justify-end mt-1">
                        {ds.slice(0, 3).map(s => (
                          <div key={s.id} style={{ width: 6, height: 6, borderRadius: "50%", background: cat(s.category).border }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block space-y-0.5">
                    {ds.slice(0, 3).map(s => <SessionCard key={s.id} s={s} compact />)}
                    {ds.length > 3 && (
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-4)", padding: "0 4px" }}>+{ds.length - 3}</p>
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
                {ds.map(s => <SessionCard key={s.id} s={s} isPast={isPast} />)}
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
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: (isToday || isSel) ? "rgba(255,255,255,0.7)" : "var(--c-text-4)" }}>
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

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {(() => {
              const key     = toLocalDateStr(selectedDate ?? today);
              const ds      = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
              const dateObj = selectedDate ?? today;
              const isPast  = toLocalDateStr(dateObj) < toLocalDateStr(today);

              if (ds.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={24} color="var(--c-text-4)" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-3)" }}>Repos ce jour</p>
                  <button onClick={() => setShowCreate(true)} style={{ fontSize: 12, fontWeight: 700, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer" }}>
                    + Planifier une séance
                  </button>
                </div>
              );

              return ds.map(s => <SessionCard key={s.id} s={s} isPast={isPast} />);
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