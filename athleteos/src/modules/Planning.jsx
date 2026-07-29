// ============================================================
// AthleteOS — src/modules/Planning.jsx  ★ DESIGN PREMIUM DARK
// Rendu adapté au dark mode : plus de bg-white / text-slate-*
// hardcodés. Couleurs de catégorie recalibrées pour rester
// lisibles et subtiles sur fond sombre (fill faible opacité +
// texte clair teinté, jamais blanc pur sur noir).
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X,
  Clock, CalendarDays,
} from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { SegmentedTabs } from "../components/ui/premium";
import { initialsFromName } from "../utils/helpers.js";
import {
  alertSessionAbsence,
  notifyAthleteNewSession,
  notifyAthleteSessionUpdated,
  notifyAthleteFeedbackReminder,
} from "../utils/notifications";
import {
  DAYS_FR, DAYS_SHORT, MONTHS_FR, CATEGORIES,
  toLocalDateStr, isSameDay, sessionStatus, colors, getCalendarDays, StatusIcon,
} from "./planningShared";
import SessionModal from "./SessionModal";
import AddSessionModal from "./AddSessionModal";

// ─── Composant principal ──────────────────────────────────────────────────────

function Planning() {
  const { clubId } = useAuth();
  const today   = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode,  setViewMode]  = useState(isMobile ? "week" : "month");

  const [athletes,           setAthletes]           = useState([]);
  const [sessionList,        setSessionList]         = useState([]);
  const [activeSession,      setActiveSession]       = useState(null);
  const [sessionModalTarget, setSessionModalTarget]  = useState(null);
  const [selectedDate,       setSelectedDate]        = useState(null);
  const [filterMode,         setFilterMode]          = useState("all");
  const [loading,            setLoading]             = useState(true);
  const [error,              setError]               = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const sessionIds = sessionsRes.data.map(s => s.id);
      const saRes = sessionIds.length
        ? await supabase.from("session_athletes").select("*").in("session_id", sessionIds)
        : { data: [], error: null };
      if (saRes.error) throw saRes.error;

      setAthletes(athletesRes.data.map(a => ({
        id: a.id, name: a.name, mainDiscipline: a.main_discipline,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
      })));

      setSessionList(sessionsRes.data.map(s => {
        const rows = saRes.data.filter(v => v.session_id === s.id);
        return {
          id: s.id, week: s.week, day: s.day,
          sessionDate:     s.session_date,
          time:            s.time,
          type:            s.type,
          category:        s.category,
          title:           s.title,
          description:     s.description,
          instructions:    s.instructions,
          durationMinutes: s.duration_minutes,
          pdfUrl:          s.pdf_url,
          createdBy:       s.created_by,
          lifecycleStatus: s.lifecycle_status ?? "planned",
          startedAt:       s.started_at,
          closedAt:        s.closed_at,
          createdByAthlete: s.created_by != null && !athletesRes.data.every(a => a.id !== s.created_by),
          athleteIds:  rows.map(v => v.athlete_id),
          validations: rows.map(v => ({
            athleteId: v.athlete_id, status: v.status,
            feeling: v.feeling, fatigue: v.fatigue,
            comment: v.comment, rpe: v.rpe,
            actualDurationMinutes: v.actual_duration_minutes,
            durationSource: v.duration_source,
            attendanceStatus: v.attendance_status,
            attendanceMarkedAt: v.attendance_marked_at,
            rsvpStatus: v.rsvp_status,
            rsvpUpdatedAt: v.rsvp_updated_at,
            coachNote: v.coach_note,
            feedbackSubmittedAt: v.feedback_submitted_at,
          })),
        };
      }));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures ════════════════════════════════════════════════════════════

  const addSession = useCallback(async (form) => {
    const { data: newSession, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        club_id: clubId, week: form.week, day: form.day,
        session_date: form.sessionDate, time: form.time,
        type: form.type, category: form.category, title: form.title,
        description: form.description || null,
        instructions: form.instructions || null,
        duration_minutes: form.durationMinutes,
        load_weight: 1.0,
        pdf_url: form.pdfUrl ?? null,
      })
      .select().single();
    if (sessionError) throw sessionError;

    const { error: linkErr } = await supabase.from("session_athletes").insert(
      form.athleteIds.map(id => ({ session_id: newSession.id, athlete_id: id, status: null, feeling: null, fatigue: null, comment: null }))
    );
    if (linkErr) throw linkErr;

    await notifyAthleteNewSession(clubId, form.athleteIds, { title: form.title, sessionDate: form.sessionDate, day: form.day });
    await fetchAll();
  }, [clubId, fetchAll]);

  const updateSession = useCallback(async (sessionId, form) => {
    const { error: sessionError } = await supabase.from("sessions").update({
      week: form.week, day: form.day, session_date: form.sessionDate,
      time: form.time, type: form.type, category: form.category, title: form.title,
      description: form.description || null, instructions: form.instructions || null,
      duration_minutes: form.durationMinutes,
      load_weight: 1.0,
      pdf_url: form.pdfUrl ?? null,
    }).eq("id", sessionId);
    if (sessionError) throw sessionError;

    const existing    = sessionList.find(s => s.id === sessionId);
    const previousIds = existing?.athleteIds ?? [];
    const toAdd       = form.athleteIds.filter(id => !previousIds.includes(id));
    const toRemove    = previousIds.filter(id => !form.athleteIds.includes(id));
    if (toAdd.length)    { const { error: e } = await supabase.from("session_athletes").insert(toAdd.map(id => ({ session_id: sessionId, athlete_id: id, status: null, feeling: null, fatigue: null, comment: null, rpe: null }))); if (e) throw e; }
    if (toRemove.length) { const { error: e } = await supabase.from("session_athletes").delete().eq("session_id", sessionId).in("athlete_id", toRemove); if (e) throw e; }
    const retainedIds = form.athleteIds.filter(id => previousIds.includes(id));
    if (retainedIds.length) await notifyAthleteSessionUpdated(clubId, retainedIds, { id: sessionId, title: form.title, sessionDate: form.sessionDate, time: form.time });
    if (toAdd.length) await notifyAthleteNewSession(clubId, toAdd, { id: sessionId, title: form.title, sessionDate: form.sessionDate, day: form.day });
    await fetchAll();
  }, [clubId, fetchAll, sessionList]);

  const deleteSession = useCallback(async (sessionId) => {
    const existing = sessionList.find(s => s.id === sessionId);
    await supabase.from("session_athletes").delete().eq("session_id", sessionId);
    const { error: e } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (e) throw e;
    // Évite d'orpheliner le fichier storage privé une fois la séance
    // supprimée (échec d'écriture ici non bloquant : la séance est déjà
    // supprimée, le PDF orphelin est un problème mineur, pas une erreur
    // utilisateur à faire remonter).
    if (existing?.pdfUrl) {
      await supabase.storage.from("session-pdfs").remove([existing.pdfUrl]).catch(() => {});
    }
    await fetchAll();
  }, [fetchAll, sessionList]);

  const setRpe = useCallback(async (sessionId, athleteId, rpe, actualDurationMinutes) => {
    const duration = Number(actualDurationMinutes);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) return;
    setSessionList(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s, validations: s.validations.map(v => v.athleteId === athleteId ? {
        ...v, rpe, actualDurationMinutes: duration, durationSource: "reported",
      } : v),
    }));
    await supabase.from("session_athletes").update({
      rpe, actual_duration_minutes: duration, duration_source: "reported",
    }).eq("session_id", sessionId).eq("athlete_id", athleteId);
  }, []);

  const setStatus = useCallback(async (sessionId, athleteId, status) => {
    setSessionList(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s, validations: s.validations.map(v => v.athleteId === athleteId ? { ...v, status } : v),
    }));
    const { error: updateErr } = await supabase.from("session_athletes").update({ status })
      .eq("session_id", sessionId).eq("athlete_id", athleteId);
    if (updateErr) { fetchAll(); return; }
    if (status === "none") {
      const session = sessionList.find(s => s.id === sessionId);
      const athlete = athletes.find(a => a.id === athleteId);
      if (session && athlete) await alertSessionAbsence(clubId, athlete, session);
    }
  }, [fetchAll, sessionList, athletes, clubId]);

  const setAttendance = useCallback(async (sessionId, athleteId, attendanceStatus) => {
    const markedAt = new Date().toISOString();
    setSessionList(previous => previous.map(session => session.id !== sessionId ? session : {
      ...session,
      validations: session.validations.map(validation => validation.athleteId === athleteId
        ? { ...validation, attendanceStatus, attendanceMarkedAt: markedAt }
        : validation),
    }));
    const updates = { attendance_status: attendanceStatus, attendance_marked_at: markedAt };
    if (attendanceStatus === "absent" || attendanceStatus === "injured") updates.status = "none";
    const { error: updateError } = await supabase.from("session_athletes").update(updates)
      .eq("session_id", sessionId).eq("athlete_id", athleteId);
    if (updateError) { await fetchAll(); throw updateError; }
    if (attendanceStatus === "absent") {
      const session = sessionList.find(item => item.id === sessionId);
      const athlete = athletes.find(item => item.id === athleteId);
      if (session && athlete) await alertSessionAbsence(clubId, athlete, session);
    }
  }, [athletes, clubId, fetchAll, sessionList]);

  const setCoachNote = useCallback(async (sessionId, athleteId, coachNote) => {
    const { error: updateError } = await supabase.from("session_athletes").update({ coach_note: coachNote || null })
      .eq("session_id", sessionId).eq("athlete_id", athleteId);
    if (updateError) throw updateError;
    setSessionList(previous => previous.map(session => session.id !== sessionId ? session : {
      ...session,
      validations: session.validations.map(validation => validation.athleteId === athleteId ? { ...validation, coachNote } : validation),
    }));
  }, []);

  const remindFeedback = useCallback(async (session) => {
    const targetIds = session.validations.filter(validation => (
      validation.attendanceStatus !== "absent" && validation.attendanceStatus !== "injured"
      && (validation.rpe == null || validation.durationSource !== "reported")
    )).map(validation => validation.athleteId);
    await notifyAthleteFeedbackReminder(clubId, targetIds, session);
  }, [clubId]);

  const setLifecycle = useCallback(async (sessionId, lifecycleStatus) => {
    const now = new Date().toISOString();
    const updates = { lifecycle_status: lifecycleStatus };
    if (lifecycleStatus === "live") { updates.started_at = now; updates.closed_at = null; }
    if (lifecycleStatus === "completed") updates.closed_at = now;
    const { error: updateError } = await supabase.from("sessions").update(updates).eq("id", sessionId);
    if (updateError) throw updateError;
    const current = sessionList.find(session => session.id === sessionId);
    setSessionList(previous => previous.map(session => session.id === sessionId ? {
      ...session, lifecycleStatus, startedAt: updates.started_at ?? session.startedAt, closedAt: updates.closed_at ?? null,
    } : session));
    if (lifecycleStatus === "completed" && current) await remindFeedback(current);
  }, [remindFeedback, sessionList]);

  // ═══ Dérivés calendrier ═══════════════════════════════════════════════════

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const filteredSessions = useMemo(() => {
    if (filterMode === "athlete") return sessionList.filter(s => s.createdByAthlete);
    if (filterMode === "coach")   return sessionList.filter(s => !s.createdByAthlete);
    return sessionList;
  }, [sessionList, filterMode]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    filteredSessions.forEach(s => {
      if (!s.sessionDate) return;
      const key = s.sessionDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [filteredSessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return (sessionsByDate[toLocalDateStr(selectedDate)] ?? [])
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }, [selectedDate, sessionsByDate]);

  const weekReference = selectedDate ?? today;
  const weekStart = new Date(weekReference);
  weekStart.setDate(weekReference.getDate() - ((weekReference.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };
  const prevWeek = () => {
    const d = new Date(selectedDate ?? today);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };
  const nextWeek = () => {
    const d = new Date(selectedDate ?? today);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  };

  const liveActiveSession = activeSession
    ? sessionList.find(s => s.id === activeSession.id) ?? activeSession
    : null;

  function buildFormFromSession(s) {
    return {
      title: s.title, type: s.type, category: s.category,
      day: s.day, time: s.time, week: s.week,
      durationMinutes: s.durationMinutes ?? "",
      description: s.description ?? "", instructions: s.instructions ?? "",
      athleteIds: s.athleteIds, pdfUrl: s.pdfUrl ?? null,
      sessionDate: s.sessionDate?.slice(0, 10) ?? "",
    };
  }

  const navLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  // ═══ Render ═══════════════════════════════════════════════════════════════

  if (loading) return <LoadingState message="Chargement du planning…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const athleteSessionCount = sessionList.filter(s => s.createdByAthlete).length;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--c-bg)" }}>

      {/* ── Header glassmorphism ─────────────────────────────────────────── */}
      <div className="header-glass px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0 z-10">

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            aria-label={viewMode === "month" ? "Mois précédent" : "Semaine précédente"}
            onClick={viewMode === "month" ? prevMonth : prevWeek}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all tap-feedback"
            style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center px-2 flex-1 sm:flex-none min-w-[120px] md:min-w-[180px]">
            <p className="meta-text font-bold uppercase tracking-[0.08em] mb-0.5">Période affichée</p>
            <p className="text-[15px] md:text-[17px] font-bold tracking-tight truncate" style={{ color: "var(--c-text-1)" }}>
              {navLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label={viewMode === "month" ? "Mois suivant" : "Semaine suivante"}
            onClick={viewMode === "month" ? nextMonth : nextWeek}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all tap-feedback"
            style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}
          >
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={goToday}
            className="min-h-10 px-3 rounded-xl text-[12px] font-bold transition-all ml-1"
            style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}>
            Auj.
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">

          {/* Toggle vue */}
          <SegmentedTabs
            ariaLabel="Mode d’affichage du planning"
            items={[{ id: "month", label: "Mois" }, { id: "week", label: "Sem." }]}
            value={viewMode}
            onChange={setViewMode}
          />

          {/* Filtre séances athlètes — desktop */}
          {athleteSessionCount > 0 && (
            <div className="hidden lg:block">
              <SegmentedTabs
                ariaLabel="Origine des séances"
                items={[
                  { id: "all", label: "Toutes" },
                  { id: "coach", label: "Coach" },
                  { id: "athlete", label: "Athlètes", badge: athleteSessionCount },
                ]}
                value={filterMode}
                onChange={setFilterMode}
              />
            </div>
          )}

          <button
            type="button"
            aria-label="Ajouter une séance"
            onClick={() => setSessionModalTarget("create")}
            disabled={athletes.length === 0}
            className="btn-primary disabled:opacity-40 !px-3 md:!px-4"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 overflow-auto">

          {/* ── VUE SEMAINE ── */}
          {viewMode === "week" && (
            <div className="p-4 md:p-6 space-y-3">
              {weekDays.map((date, i) => {
                const key     = toLocalDateStr(date);
                const ds      = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
                const isToday = isSameDay(date, today);
                const isPast  = toLocalDateStr(date) < toLocalDateStr(today);

                return (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden border transition-all"
                    style={isToday
                      ? { borderColor: "rgba(29,158,117,0.45)", boxShadow: "0 0 0 1px rgba(29,158,117,0.20)" }
                      : { borderColor: "var(--c-border)" }}
                  >
                    {/* Header jour */}
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: isToday ? "rgba(29,158,117,0.08)" : "var(--c-surface)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-[16px] flex-shrink-0"
                          style={isToday
                            ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" }
                            : { background: "var(--c-surface-2)", color: isPast ? "var(--c-text-3)" : "var(--c-text-2)" }}
                        >
                          {date.getDate()}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold"
                            style={{ color: isToday ? "#3DBE8B" : isPast ? "var(--c-text-2)" : "var(--c-text-1)" }}>
                            {DAYS_FR[i]}
                          </p>
                          <p className="meta-text">
                            {date.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ds.length > 0 && (
                          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                            style={isToday
                              ? { background: "rgba(29,158,117,0.16)", color: "#7BD8B4" }
                              : { background: "var(--c-surface-2)", color: "var(--c-text-2)" }}>
                            {ds.length} séance{ds.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Ajouter une séance le ${date.toLocaleDateString("fr-BE")}`}
                          onClick={() => { setSelectedDate(date); setSessionModalTarget("create"); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Séances du jour */}
                    {ds.length > 0 ? (
                      <div style={{ background: "var(--c-surface)" }}>
                        {ds.map((s, idx) => {
                          const c  = colors(s.category);
                          const st = sessionStatus(s);
                          const missingStatus = s.athleteIds.filter(id => {
                            const v = s.validations?.find(val => val.athleteId === id);
                            return v?.status == null;
                          }).length;

                          return (
                            <div
                              key={s.id}
                              onClick={() => setActiveSession(s)}
                              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors tap-feedback"
                              style={{ borderTop: idx > 0 ? "1px solid var(--c-border)" : "none" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: c.border }} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                                  {s.createdByAthlete && (
                                    <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                                      <span aria-label="Proposée par un athlète">📋</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--c-text-2)" }}>
                                  <span
                                    className="px-1.5 py-0.5 rounded-md text-[12px] font-bold uppercase tracking-wide"
                                    style={{ background: `${c.border}1F`, color: c.text }}
                                  >
                                    {CATEGORIES.find(x => x.id === s.category)?.label}
                                  </span>
                                  <Clock size={10} />
                                  <span>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</span>
                                  {missingStatus > 0 && isPast && (
                                    <span className="font-bold" style={{ color: "#F0CB61" }}>· {missingStatus} en attente</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex -space-x-1">
                                  {s.athleteIds.slice(0, 3).map(id => {
                                    const a = athletes.find(x => x.id === id);
                                    return a ? (
                                      <div key={id}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                                        style={{ background: c.border, color: "#0A150F", border: "2px solid var(--c-surface)" }}>
                                        {a.avatar?.slice(0, 1)}
                                      </div>
                                    ) : null;
                                  })}
                                  {s.athleteIds.length > 3 && (
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                                      style={{ background: "var(--c-surface-3)", color: "var(--c-text-3)", border: "2px solid var(--c-surface)" }}>
                                      +{s.athleteIds.length - 3}
                                    </div>
                                  )}
                                </div>
                                {s.pdfUrl && <span className="text-[12px]">📄</span>}
                                <StatusIcon status={st} size={16} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-3" style={{ background: "var(--c-surface)" }}>
                        <p className="meta-text font-medium">Repos</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VUE MOIS ── */}
          {viewMode === "month" && (
            <div className="p-3 md:p-6">
              <div className="grid grid-cols-7 mb-2">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-[12px] font-bold uppercase tracking-wide py-2"
                    style={{ color: "var(--c-text-2)" }}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                  const key         = toLocalDateStr(date);
                  const daySessions = sessionsByDate[key] ?? [];
                  const isToday     = isSameDay(date, today);
                  const isSelected  = selectedDate && isSameDay(date, selectedDate);
                  const hasSessions = daySessions.length > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(date);
                        if (window.innerWidth < 768) setViewMode("week");
                      }}
                      className="min-h-[52px] md:min-h-[96px] rounded-xl md:rounded-2xl p-1 md:p-2 cursor-pointer transition-all border"
                      style={isToday
                        ? { background: "rgba(29,158,117,0.08)", borderColor: "rgba(29,158,117,0.45)", borderWidth: 2 }
                        : isSelected
                        ? { background: "rgba(91,158,245,0.08)", borderColor: "rgba(91,158,245,0.45)", borderWidth: 2 }
                        : isCurrentMonth
                        ? { background: "var(--c-surface)", borderColor: "var(--c-border)" }
                        : { background: "transparent", borderColor: "transparent", opacity: 0.35 }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[12px] md:text-[13px] font-bold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-xl"
                          style={isToday
                            ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" }
                            : { color: isCurrentMonth ? "var(--c-text-1)" : "var(--c-text-3)" }}
                        >
                          {date.getDate()}
                        </span>
                        {hasSessions && (
                          <div className="md:hidden flex gap-0.5 mt-1 flex-wrap justify-end">
                            {daySessions.slice(0, 3).map(s => (
                              <div
                                key={s.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: colors(s.category).border }}
                                onClick={e => { e.stopPropagation(); setActiveSession(s); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="hidden md:block space-y-0.5">
                        {daySessions.slice(0, 3).map(s => {
                          const c  = colors(s.category);
                          const st = sessionStatus(s);
                          return (
                            <div
                              key={s.id}
                              onClick={e => { e.stopPropagation(); setActiveSession(s); }}
                              className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity truncate"
                              style={{ background: `${c.border}1F`, color: c.text, borderLeft: `2.5px solid ${c.border}` }}
                            >
                              <span className="truncate flex-1">{s.title}</span>
                              {st !== "future" && <StatusIcon status={st} size={8} />}
                              {s.createdByAthlete && <span className="text-[12px]" aria-label="Proposée par un athlète">📋</span>}
                            </div>
                          );
                        })}
                        {daySessions.length > 3 && (
                          <p className="meta-text font-semibold px-1">
                            +{daySessions.length - 3} autre{daySessions.length - 3 > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Panneau latéral desktop ──────────────────────────────────── */}
        {selectedDate && (
          <div className="hidden lg:flex w-80 flex-shrink-0 flex-col overflow-hidden"
            style={{ background: "var(--c-surface)", borderLeft: "1px solid var(--c-border)" }}>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
              <div className="flex items-center justify-between mb-0.5">
                <div>
                  <p className="card-title">
                    {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="card-subtitle mt-0.5">
                    {selectedDaySessions.length} séance{selectedDaySessions.length !== 1 ? "s" : ""} planifiée{selectedDaySessions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button type="button" aria-label="Fermer le détail du jour" onClick={() => setSelectedDate(null)}
                  className="p-1.5 rounded-xl transition-colors" style={{ color: "var(--c-text-3)" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedDaySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10" style={{ color: "var(--c-text-3)" }}>
                  <CalendarDays size={32} strokeWidth={1.5} />
                  <p className="text-[12px] text-center font-medium">Aucune séance ce jour</p>
                  <button onClick={() => setSessionModalTarget("create")}
                    className="text-[12px] font-semibold transition-colors" style={{ color: "#3DBE8B" }}>
                    + Planifier une séance
                  </button>
                </div>
              ) : (
                selectedDaySessions.map(s => {
                  const c  = colors(s.category);
                  const st = sessionStatus(s);
                  const missingStatus = s.athleteIds.filter(id => !s.validations?.find(val => val.athleteId === id)?.status).length;
                  const missingRpe    = s.athleteIds.filter(id => {
                    const v = s.validations?.find(val => val.athleteId === id);
                    return v?.status && v.status !== "none" && v?.rpe == null;
                  }).length;

                  return (
                    <div key={s.id} onClick={() => setActiveSession(s)}
                      className="card card-hover rounded-2xl overflow-hidden cursor-pointer">
                      <div className="px-3.5 py-2.5 flex items-center justify-between"
                        style={{ background: `${c.border}14`, borderBottom: `1.5px solid ${c.border}40` }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: c.text }}>
                            {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                          </span>
                          {s.createdByAthlete && (
                            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                              📋
                            </span>
                          )}
                        </div>
                        <StatusIcon status={st} size={12} />
                      </div>

                      <div className="px-3.5 py-3">
                        <p className="text-[13px] font-bold leading-tight mb-1.5" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--c-text-2)" }}>
                          <Clock size={10} />
                          <span>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</span>
                          {s.pdfUrl && <span style={{ color: "#A9CBFB" }}>📄</span>}
                        </div>

                        {missingStatus > 0 && (
                          <div className="flex items-center gap-1 text-[12px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(239,107,107,0.10)", color: "#F19A9A" }}>
                            ❗ {missingStatus} présence{missingStatus > 1 ? "s" : ""} à confirmer
                          </div>
                        )}
                        {missingRpe > 0 && (
                          <div className="flex items-center gap-1 text-[12px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(234,179,8,0.10)", color: "#F0CB61" }}>
                            🔥 {missingRpe} RPE manquant{missingRpe > 1 ? "s" : ""}
                          </div>
                        )}

                        <div className="flex -space-x-1.5 mt-2">
                          {s.athleteIds.slice(0, 5).map(id => {
                            const a = athletes.find(x => x.id === id);
                            return a ? (
                              <div key={id} title={a.name}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                                style={{ background: c.border, color: "#0A150F", border: "2px solid var(--c-surface)" }}>
                                {a.avatar?.slice(0, 1) ?? "?"}
                              </div>
                            ) : null;
                          })}
                          {s.athleteIds.length > 5 && (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                              style={{ background: "var(--c-surface-3)", color: "var(--c-text-3)", border: "2px solid var(--c-surface)" }}>
                              +{s.athleteIds.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
              <button
                onClick={() => setSessionModalTarget("create")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold transition-colors"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "#3DBE8B" }}
              >
                <Plus size={13} /> Ajouter une séance
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer mobile — séances du jour ──────────────────────────────── */}
      {selectedDate && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 rounded-t-3xl shadow-2xl animate-slide-up"
          style={{ background: "var(--c-surface)", backdropFilter: "blur(20px)", maxHeight: "65vh", border: "1px solid var(--c-border)", borderBottom: "none" }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
          </div>

          <div className="flex flex-col" style={{ maxHeight: "calc(65vh - 20px)" }}>
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="card-title">
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="card-subtitle mt-0.5">
                  {selectedDaySessions.length} séance{selectedDaySessions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button type="button" aria-label="Fermer le détail du jour" onClick={() => setSelectedDate(null)}
                className="p-2 rounded-xl tap-feedback" style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
              {selectedDaySessions.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--c-text-3)" }}>
                  <CalendarDays size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-[12px]">Aucune séance ce jour</p>
                </div>
              ) : selectedDaySessions.map(s => {
                const c  = colors(s.category);
                const st = sessionStatus(s);
                return (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSession(s); setSelectedDate(null); }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer tap-feedback"
                    style={{ background: "var(--c-surface-2)", borderColor: c.border, borderWidth: "1.5px", borderStyle: "solid" }}
                  >
                    <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ background: c.border }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                      <p className="meta-text">{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</p>
                    </div>
                    <StatusIcon status={st} size={16} />
                  </div>
                );
              })}
            </div>

            <div className="p-4 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
              <button
                onClick={() => { setSessionModalTarget("create"); setSelectedDate(null); }}
                className="w-full py-3 rounded-2xl text-[13px] font-bold tap-feedback"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "#3DBE8B" }}
              >
                <Plus size={14} className="inline mr-1.5" />
                Ajouter une séance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {liveActiveSession && (
        <SessionModal
          session={liveActiveSession}
          athletes={athletes}
          onClose={() => setActiveSession(null)}
          onSetRpe={setRpe}
          onSetStatus={setStatus}
          onEditRequest={s => { setSessionModalTarget(s); setActiveSession(null); }}
          onDeleteSession={deleteSession}
          onSetAttendance={setAttendance}
          onSetCoachNote={setCoachNote}
          onSetLifecycle={setLifecycle}
          onRemindFeedback={remindFeedback}
        />
      )}

      {sessionModalTarget && (
        <AddSessionModal
          athletes={athletes}
          initialData={sessionModalTarget === "create" ? null : buildFormFromSession(sessionModalTarget)}
          onClose={() => setSessionModalTarget(null)}
          onAdd={sessionModalTarget === "create" ? addSession : form => updateSession(sessionModalTarget.id, form)}
        />
      )}
    </div>
  );
}

export default memo(Planning);
