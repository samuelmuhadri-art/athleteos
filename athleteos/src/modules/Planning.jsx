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
  Clock, CalendarDays, Trophy, Copy,
} from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../hooks/useAuth";
import { useToast }  from "../hooks/useToast";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { SegmentedTabs } from "../components/ui/premium";
import { initialsFromName } from "../utils/helpers.js";
import { captureError } from "../utils/sentry";
import {
  notifyAthleteNewSession,
  notifyAthleteSessionUpdated,
  notifyAthleteFeedbackReminder,
} from "../utils/notifications";
import {
  DAYS_FR, DAYS_SHORT, MONTHS_FR, CATEGORIES,
  toLocalDateStr, isSameDay, sessionStatus, colors, getCalendarDays,
  audienceMatchesFilters, competitionMatchesDiscipline, sessionMatchesDiscipline,
  indexPlanningRelations,
} from "./planningUtils";
import { StatusIcon } from "./planningShared";
import { getSessionTrainingFocus } from "../domain/trainingFocus";
import SessionModal from "./SessionModal";
import AddSessionModal from "./AddSessionModal";
import CompetitionPlanningCard from "../components/planning/CompetitionPlanningCard";
import { groupCompetitionsByDate } from "../domain/planningCompetitions";
import { useModules } from "../hooks/useModules";
import { mapDocument, publishSessionDocumentDistribution } from "../services/documentLibrary";
import CompetitionDetailModal from "../components/planning/CompetitionDetailModal";
import CreateCompModal from "./CreateCompModal";
import PlanningEventModal from "../components/planning/PlanningEventModal";

// ─── Composant principal ──────────────────────────────────────────────────────

function Planning() {
  const { clubId } = useAuth();
  const { enabledAthleteIds } = useModules();
  const { success: showSuccessToast } = useToast();
  const today   = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode,  setViewMode]  = useState(isMobile ? "week" : "month");

  const [athletes,           setAthletes]           = useState([]);
  const [sessionList,        setSessionList]         = useState([]);
  const [competitionList,    setCompetitionList]     = useState([]);
  const [eventList,          setEventList]           = useState([]);
  const [activeSession,      setActiveSession]       = useState(null);
  const [sessionModalTarget, setSessionModalTarget]  = useState(null);
  const [initialAthleteIds,  setInitialAthleteIds]   = useState([]);
  const [selectedDate,       setSelectedDate]        = useState(null);
  const [activeCompetition,  setActiveCompetition]   = useState(null);
  const [competitionEditor,  setCompetitionEditor]   = useState(null);
  const [showAddMenu,        setShowAddMenu]         = useState(false);
  const [eventEditor,        setEventEditor]         = useState(null);
  const [filterMode,         setFilterMode]          = useState("all");
  const [filterAthlete,      setFilterAthlete]       = useState("all");
  const [filterGroup,        setFilterGroup]         = useState("all");
  const [filterDiscipline,   setFilterDiscipline]    = useState("all");
  const [loading,            setLoading]             = useState(true);
  const [error,              setError]               = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes, competitionsRes, eventsRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data, user_id, group_name").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
        supabase.from("competitions").select("id, name, date, location, type, notes, competition_athletes(athlete_id, planned_event)").eq("club_id", clubId),
        supabase.from("planning_events").select("*, planning_event_athletes(athlete_id), planning_event_documents(document_id, documents(*))").eq("club_id", clubId),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (competitionsRes.error) throw competitionsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const sessionIds = sessionsRes.data.map(s => s.id);
      const [saRes, documentsRes, recipientsRes] = sessionIds.length ? await Promise.all([
        supabase.from("session_athletes").select("*").in("session_id", sessionIds),
        supabase.from("session_documents").select("session_id, document_id, visibility, documents(*)").in("session_id", sessionIds),
        supabase.from("session_document_recipients").select("session_id, document_id, athlete_id").in("session_id", sessionIds),
      ]) : [{ data:[], error:null }, { data:[], error:null }, { data:[], error:null }];
      if (saRes.error) throw saRes.error;
      if (documentsRes.error) throw documentsRes.error;
      if (recipientsRes.error) throw recipientsRes.error;

      const planningRelations = indexPlanningRelations(
        saRes.data,
        documentsRes.data,
        recipientsRes.data,
      );
      const athleteUserIds = new Set((athletesRes.data ?? []).map(athlete => athlete.user_id).filter(Boolean));

      const configuredIds = enabledAthleteIds("planning");
      const eligibleIds = configuredIds ? new Set(configuredIds) : null;
      setAthletes(athletesRes.data.filter((a) => !eligibleIds || eligibleIds.has(a.id)).map(a => ({
        id: a.id, name: a.name, mainDiscipline: a.main_discipline,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
        group:a.group_name,
      })));

      setSessionList(sessionsRes.data.map(s => {
        const rows = planningRelations.athletesBySessionId.get(s.id) ?? [];
        return {
          id: s.id, week: s.week, day: s.day,
          sessionDate:     s.session_date,
          time:            s.time,
          type:            s.type,
          category:        s.category,
          trainingFocus:   s.training_focus,
          title:           s.title,
          description:     s.description,
          instructions:    s.instructions,
          durationMinutes: s.duration_minutes,
          pdfUrl:          s.pdf_url,
          documents: (planningRelations.documentsBySessionId.get(s.id) ?? []).map(link => ({
            ...mapDocument(link.documents),
            visibility:link.visibility,
            athleteIds:planningRelations.recipientIds(s.id, link.document_id),
          })),
          createdBy:       s.created_by,
          seriesId:        s.series_id,
          sourceKind:      s.source_kind ?? "individual",
          targetGroup:     s.target_group,
          lifecycleStatus: s.lifecycle_status ?? "planned",
          startedAt:       s.started_at,
          closedAt:        s.closed_at,
          createdByAthlete: s.created_by != null && athleteUserIds.has(s.created_by),
          athleteIds:  rows.map(v => v.athlete_id),
          validations: rows.map(v => ({
            athleteId: v.athlete_id, status: v.status,
            feeling: v.feeling, fatigue: v.fatigue,
            comment: v.comment, rpe: v.rpe,
            actualDurationMinutes: v.actual_duration_minutes,
            durationSource: v.duration_source,
            rsvpStatus: v.rsvp_status,
            rsvpNote: v.rsvp_note,
            rsvpUpdatedAt: v.rsvp_updated_at,
            coachNote: v.coach_note,
            feedbackSubmittedAt: v.feedback_submitted_at,
          })),
        };
      }));
      setCompetitionList((competitionsRes.data ?? []).map(competition => ({
        id: competition.id,
        name: competition.name,
        date: competition.date,
        location: competition.location,
        type: competition.type,
        notes:competition.notes,
        athleteIds: (competition.competition_athletes ?? []).map(row => row.athlete_id),
        plannedEvents: Object.fromEntries((competition.competition_athletes ?? []).map(row => [row.athlete_id, row.planned_event])),
      })));
      setEventList((eventsRes.data ?? []).map(event => ({
        id:event.id, kind:event.kind, name:event.name, startsOn:event.starts_on, endsOn:event.ends_on,
        time:event.time, location:event.location, description:event.description, notes:event.notes,
        customLabel:event.custom_label, targetGroup:event.target_group,
        athleteIds:(event.planning_event_athletes ?? []).map(row => row.athlete_id),
        documents:(event.planning_event_documents ?? []).map(link => mapDocument(link.documents)).filter(Boolean),
      })));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId, enabledAthleteIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!athletes.length || typeof window === "undefined") return;
    const storedAthleteId = Number(window.sessionStorage.getItem("athleteos:planning-athlete"));
    if (!Number.isInteger(storedAthleteId)) return;
    window.sessionStorage.removeItem("athleteos:planning-athlete");
    if (!athletes.some(athlete => athlete.id === storedAthleteId)) return;
    setInitialAthleteIds([storedAthleteId]);
    setSessionModalTarget("create");
  }, [athletes]);

  const openCreateSession = useCallback((athleteIds = []) => {
    setInitialAthleteIds(athleteIds);
    setSessionModalTarget("create");
  }, []);

  // ═══ Écritures ════════════════════════════════════════════════════════════

  const addSession = useCallback(async (form, idempotencyKey) => {
    if (form.recurrence && form.recurrence !== "none") {
      const { data, error:seriesError } = await supabase.rpc("create_session_series_with_occurrences", {
        p_series:{
          title:form.title, type:form.type, category:form.category, trainingFocus:form.trainingFocus,
          durationMinutes:form.durationMinutes, description:form.description, instructions:form.instructions,
          time:form.time, loadWeight:form.loadWeight ?? 1,
          startsOn:form.sessionDate,
          endsOn:form.recurrenceEndsOn || null,
          occurrenceCount:form.recurrenceEndsOn ? null : form.recurrenceCount,
          intervalWeeks:form.recurrence === "biweekly" ? 2 : 1,
          weekdays:form.recurrenceWeekdays,
          targetGroup:form.targetGroup || null,
        },
        p_athlete_ids:form.athleteIds,
        p_idempotency_key:idempotencyKey,
      });
      if (seriesError) throw seriesError;
      if (form.documentIds?.length) {
        const { error:documentError } = await supabase.rpc("publish_series_documents", {
          p_series_id:data.seriesId, p_document_ids:form.documentIds, p_notification_key:idempotencyKey,
        });
        if (documentError) throw documentError;
      }
      await notifyAthleteNewSession(clubId, form.athleteIds, { title:form.title, sessionDate:form.sessionDate, day:form.day });
      await fetchAll();
      showSuccessToast({ key:`series-created-${data.seriesId}`, title:"Série planifiée", message:`${data.occurrenceCount} séances ont été créées.` });
      return;
    }
    const { data, error: sessionError } = await supabase.rpc("create_session_with_athletes", {
      p_session: form,
      p_athlete_ids: form.athleteIds,
      p_idempotency_key: idempotencyKey,
    });
    if (sessionError) throw sessionError;
    const newSession = { id: data?.sessionId };

    await publishSessionDocumentDistribution({
      sessionId:newSession.id,
      documents:form.documents,
      notificationKey:idempotencyKey,
    });

    await notifyAthleteNewSession(clubId, form.athleteIds, { title: form.title, sessionDate: form.sessionDate, day: form.day });
    await fetchAll();
    showSuccessToast({
      key: `session-created-${newSession.id}`,
      title: "Séance planifiée",
      message: "Le planning est à jour et les athlètes assignés ont été prévenus.",
    });
  }, [clubId, fetchAll, showSuccessToast]);

  const updateSession = useCallback(async (sessionId, form) => {
    const existing = sessionList.find(s => s.id === sessionId);
    const { error: sessionError } = existing?.seriesId ? await supabase.rpc("update_recurring_session", {
      p_session_id:sessionId, p_scope:form.editScope ?? "single", p_patch:form, p_athlete_ids:form.athleteIds,
    }) : await supabase.rpc("update_session_with_athletes", {
      p_session_id:sessionId, p_session:form, p_athlete_ids:form.athleteIds,
    });
    if (sessionError) throw sessionError;

    if (existing?.seriesId && form.editScope !== "single") {
      const { error:documentError } = await supabase.rpc("publish_series_documents", {
        p_series_id:existing.seriesId,
        p_document_ids:form.documentIds ?? [],
        p_notification_key:`update-series-${existing.seriesId}-${Date.now()}`,
        p_from_date:form.editScope === "all" ? "0001-01-01" : existing.sessionDate,
      });
      if (documentError) throw documentError;
    } else {
      await publishSessionDocumentDistribution({
        sessionId,
        documents:form.documents,
        notificationKey:`update-${sessionId}-${Date.now()}`,
      });
    }

    const previousIds = existing?.athleteIds ?? [];
    const toAdd       = form.athleteIds.filter(id => !previousIds.includes(id));
    const retainedIds = form.athleteIds.filter(id => previousIds.includes(id));
    if (retainedIds.length) await notifyAthleteSessionUpdated(clubId, retainedIds, { id: sessionId, title: form.title, sessionDate: form.sessionDate, time: form.time });
    if (toAdd.length) await notifyAthleteNewSession(clubId, toAdd, { id: sessionId, title: form.title, sessionDate: form.sessionDate, day: form.day });
    await fetchAll();
    showSuccessToast({
      key: `session-updated-${sessionId}`,
      title: "Séance mise à jour",
      message: "Les modifications sont enregistrées dans le planning.",
    });
  }, [clubId, fetchAll, sessionList, showSuccessToast]);

  const saveCompetition = useCallback(async (form, idempotencyKey) => {
    if (competitionEditor && competitionEditor !== "create") {
      const { error:updateError } = await supabase.rpc("update_competition_with_athletes", {
        p_competition_id:competitionEditor.id, p_name:form.name, p_date:form.date,
        p_location:form.location || null, p_type:form.type, p_notes:form.notes || null,
        p_athlete_entries:form.athleteEntries,
      });
      if (updateError) throw updateError;
    } else {
      const { error:createError } = await supabase.rpc("create_competition_with_athletes", {
        p_name:form.name, p_date:form.date, p_location:form.location || null, p_type:form.type,
        p_athlete_entries:form.athleteEntries, p_idempotency_key:idempotencyKey,
      });
      if (createError) throw createError;
    }
    await fetchAll();
  }, [competitionEditor, fetchAll]);

  const deleteCompetition = useCallback(async competition => {
    if (!window.confirm(`Supprimer « ${competition.name} » ? Cette action est définitive.`)) return;
    const { error:deleteError } = await supabase.rpc("delete_competition_transactional", { p_competition_id:competition.id });
    if (deleteError) throw deleteError;
    setActiveCompetition(null);
    await fetchAll();
  }, [fetchAll]);

  const savePlanningEvent = useCallback(async form => {
    const eventId = eventEditor?.event?.id ?? null;
    const { data:eventResult, error:eventError } = await supabase.rpc("upsert_planning_event_with_athletes", {
      p_event_id:eventId,
      p_event:{ kind:form.kind, name:form.name, startsOn:form.startsOn, endsOn:form.endsOn, time:form.time,
        location:form.location, description:form.description, notes:form.notes, customLabel:form.customLabel, targetGroup:form.targetGroup },
      p_athlete_ids:form.athleteIds,
    });
    if (eventError) throw eventError;
    const { error:documentError } = await supabase.rpc("publish_planning_event_documents", {
      p_event_id:eventResult.eventId,
      p_document_ids:(form.documents ?? []).map(document => Number(document.id)),
      p_notification_key:`planning-event-${eventResult.eventId}-${Date.now()}`,
    });
    if (documentError) throw documentError;
    await fetchAll();
  }, [eventEditor, fetchAll]);

  const deletePlanningEvent = useCallback(async event => {
    if (!window.confirm(`Supprimer « ${event.name} » ?`)) return;
    const { error:eventError } = await supabase.rpc("delete_planning_event", { p_event_id:event.id });
    if (eventError) throw eventError;
    setEventEditor(null);
    await fetchAll();
  }, [fetchAll]);

  const deleteSession = useCallback(async (sessionId, scope = "single") => {
    const existing = sessionList.find(s => s.id === sessionId);
    const { data, error: e } = existing?.seriesId ? await supabase.rpc("delete_recurring_session", {
      p_session_id:sessionId, p_scope:scope,
    }) : await supabase.rpc("delete_session_transactional", { p_session_id:sessionId });
    if (e) throw e;
    // Évite d'orpheliner la pièce jointe privée une fois la séance
    // supprimée (échec d'écriture ici non bloquant : la séance est déjà
    // supprimée, le fichier orphelin est un problème mineur, pas une erreur
    // utilisateur à faire remonter).
    const pdfPath = data?.pdfPath ?? existing?.pdfUrl;
    if (pdfPath) {
      const { error: pdfDeleteError } = await supabase.storage.from("session-pdfs").remove([pdfPath]);
      if (pdfDeleteError) captureError(pdfDeleteError, { operation: "delete_session_pdf", sessionId });
    }
    await fetchAll();
    showSuccessToast({
      key: `session-deleted-${sessionId}`,
      title: "Séance supprimée",
      message: "Elle n’apparaît plus dans le planning.",
    });
  }, [fetchAll, sessionList, showSuccessToast]);

  const duplicateSession = useCallback(async (session, sessionDate) => {
    const { data, error:duplicateError } = await supabase.rpc("duplicate_session_transactional", {
      p_session_id:session.id, p_session_date:sessionDate, p_athlete_ids:session.athleteIds,
    });
    if (duplicateError) throw duplicateError;
    await notifyAthleteNewSession(clubId, session.athleteIds, { title:session.title, sessionDate });
    await fetchAll();
    showSuccessToast({ key:`session-duplicate-${data.sessionId}`, title:"Séance dupliquée", message:"Contenu, participants et documents ont été réutilisés sans copier les fichiers." });
  }, [clubId, fetchAll, showSuccessToast]);

  const saveSessionTemplate = useCallback(async (session, name) => {
    const { error:templateError } = await supabase.rpc("save_session_template", { p_name:name, p_session_id:session.id });
    if (templateError) throw templateError;
    showSuccessToast({ key:`session-template-${session.id}-${name}`, title:"Modèle enregistré", message:"Tu pourras réutiliser cette séance et ses documents." });
  }, [showSuccessToast]);

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
      validation.status !== "none"
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

  const groups = useMemo(() => [...new Set(athletes.map(athlete => athlete.group).filter(Boolean))].sort(), [athletes]);
  const athleteOptions = useMemo(
    () => athletes.filter(athlete => filterGroup === "all" || athlete.group === filterGroup),
    [athletes, filterGroup],
  );

  const matchesAudience = useCallback(athleteIds => audienceMatchesFilters(athleteIds, {
    athleteId:filterAthlete,
    group:filterGroup,
    athletes,
  }), [athletes, filterAthlete, filterGroup]);

  const filteredSessions = useMemo(() => {
    return sessionList.filter(session => {
      if (filterMode === "athlete" && !session.createdByAthlete) return false;
      if (filterMode === "coach" && session.createdByAthlete) return false;
      if (!sessionMatchesDiscipline(session, filterDiscipline)) return false;
      return matchesAudience(session.athleteIds);
    });
  }, [filterDiscipline, filterMode, matchesAudience, sessionList]);

  const filteredCompetitions = useMemo(
    () => competitionList.filter(competition => matchesAudience(competition.athleteIds) && competitionMatchesDiscipline(competition, filterDiscipline)),
    [competitionList, filterDiscipline, matchesAudience],
  );
  const filteredEvents = useMemo(
    () => eventList.filter(event => filterDiscipline === "all" && matchesAudience(event.athleteIds)),
    [eventList, filterDiscipline, matchesAudience],
  );

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

  const competitionsByDate = useMemo(
    () => groupCompetitionsByDate(filteredCompetitions),
    [filteredCompetitions],
  );

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return (sessionsByDate[toLocalDateStr(selectedDate)] ?? [])
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }, [selectedDate, sessionsByDate]);

  const selectedDayCompetitions = useMemo(() => {
    if (!selectedDate) return [];
    return competitionsByDate[toLocalDateStr(selectedDate)] ?? [];
  }, [competitionsByDate, selectedDate]);

  const weekReference = selectedDate ?? today;
  const weekStart = new Date(weekReference);
  weekStart.setDate(weekReference.getDate() - ((weekReference.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const duplicateWeek = useCallback(async () => {
    const source = toLocalDateStr(weekDays[0]);
    const targetDate = new Date(weekDays[0]); targetDate.setDate(targetDate.getDate() + 7);
    const target = toLocalDateStr(targetDate);
    if (!window.confirm(`Dupliquer les séances de la semaine du ${source} vers celle du ${target} ?`)) return;
    const { data, error:duplicateError } = await supabase.rpc("duplicate_week_transactional", {
      p_source_monday:source, p_target_monday:target, p_athlete_ids:null,
    });
    if (duplicateError) throw duplicateError;
    await fetchAll();
    showSuccessToast({ key:`week-duplicate-${source}-${target}`, title:"Semaine dupliquée", message:`${data.duplicatedCount} séance${data.duplicatedCount !== 1 ? "s" : ""} copiée${data.duplicatedCount !== 1 ? "s" : ""}.` });
  }, [fetchAll, showSuccessToast, weekDays]);

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
      title: s.title, type: s.type, category: s.category, trainingFocus: s.trainingFocus,
      day: s.day, time: s.time, week: s.week,
      durationMinutes: s.durationMinutes ?? "",
      description: s.description ?? "", instructions: s.instructions ?? "",
      athleteIds: s.athleteIds, pdfUrl: s.pdfUrl ?? null,
      documents:s.documents ?? [],
      seriesId:s.seriesId, targetGroup:s.targetGroup,
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

          {viewMode === "week" && <button type="button" className="btn-secondary hidden xl:inline-flex" onClick={() => duplicateWeek().catch(error => setError(error.message))}><Copy size={14} /> Dupliquer la semaine</button>}

          <div className="relative">
          <button
            type="button"
            aria-label="Ajouter au planning"
            onClick={() => setShowAddMenu(value => !value)}
            disabled={athletes.length === 0}
            className="btn-primary disabled:opacity-40 !px-3 md:!px-4"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
          {showAddMenu && <div className="absolute right-0 top-full mt-2 z-30 card p-2 min-w-52 shadow-xl">
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => { openCreateSession(); setShowAddMenu(false); }}><CalendarDays size={15} /> Séance</button>
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => { setCompetitionEditor("create"); setShowAddMenu(false); }}><Trophy size={15} /> Compétition</button>
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => { setEventEditor({ kind:"stage" }); setShowAddMenu(false); }}><CalendarDays size={15} /> Stage, test ou autre</button>
          </div>}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-2 flex items-center gap-2 overflow-x-auto" style={{ borderBottom:"1px solid var(--c-border)" }} aria-label="Filtres du planning">
        {groups.length > 1 && <select className="input-premium !w-auto" value={filterGroup} onChange={event => { setFilterGroup(event.target.value); setFilterAthlete("all"); }} aria-label="Filtrer par groupe"><option value="all">Toutes mes équipes</option>{groups.map(group => <option key={group}>{group}</option>)}</select>}
        {groups.length === 1 && <span className="chip chip-neutral whitespace-nowrap">Équipe · {groups[0]}</span>}
        <select className="input-premium !w-auto" value={filterAthlete} onChange={event => setFilterAthlete(event.target.value)} aria-label="Filtrer par athlète"><option value="all">Tous mes athlètes</option>{athleteOptions.map(athlete => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}</select>
        <select className="input-premium !w-auto" value={filterDiscipline} onChange={event => setFilterDiscipline(event.target.value)} aria-label="Filtrer par discipline"><option value="all">Toutes les disciplines</option>{CATEGORIES.map(discipline => <option key={discipline.id} value={discipline.id}>{discipline.label}</option>)}</select>
        {(filterGroup !== "all" || filterAthlete !== "all" || filterDiscipline !== "all") && <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => { setFilterGroup("all"); setFilterAthlete("all"); setFilterDiscipline("all"); }}>Effacer</button>}
      </div>

      {filteredEvents.length > 0 && <div className="px-4 md:px-6 py-2 flex gap-2 overflow-x-auto" style={{ borderBottom:"1px solid var(--c-border)" }}>
        {[...filteredEvents].sort((a,b) => a.startsOn.localeCompare(b.startsOn)).map(event => <button key={event.id} type="button"
          onClick={() => setEventEditor({ event })} className="planning-event-chip whitespace-nowrap min-h-11" data-kind={event.kind}>
          <CalendarDays size={13} /> {event.kind === "stage" ? "Stage" : event.kind === "test" ? "Test" : event.kind === "rest" ? "Repos" : event.customLabel || "Événement"} · {event.name} · {event.startsOn === event.endsOn ? event.startsOn : `${event.startsOn} → ${event.endsOn}`}
        </button>)}
      </div>}

      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 overflow-auto">

          {/* ── VUE SEMAINE ── */}
          {viewMode === "week" && (
            <div className="p-4 md:p-6 space-y-3">
              {weekDays.map((date, i) => {
                const key     = toLocalDateStr(date);
                const ds      = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
                const dc      = competitionsByDate[key] ?? [];
                const eventCount = ds.length + dc.length;
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
                        {eventCount > 0 && (
                          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                            style={isToday
                              ? { background: "rgba(29,158,117,0.16)", color: "var(--tone-success)" }
                              : { background: "var(--c-surface-2)", color: "var(--c-text-2)" }}>
                            {eventCount} événement{eventCount > 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Ajouter une séance le ${date.toLocaleDateString("fr-BE")}`}
                          onClick={() => { setSelectedDate(date); openCreateSession(); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Événements du jour */}
                    {eventCount > 0 ? (
                      <div style={{ background: "var(--c-surface)" }}>
                        {dc.map(competition => (
                          <div key={`competition-${competition.id}`} className="p-3" style={{ borderTop: "1px solid var(--c-border)" }}>
                            <CompetitionPlanningCard competition={competition} athletes={athletes} onOpen={setActiveCompetition} />
                          </div>
                        ))}
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
                              style={{ borderTop: idx > 0 || dc.length > 0 ? "1px solid var(--c-border)" : "none" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: c.border }} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                                  {s.createdByAthlete && (
                                    <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: "rgba(168,85,247,0.16)", color: "var(--tone-mental)" }}>
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
                                  <span className="chip chip-neutral">{getSessionTrainingFocus(s).shortLabel}</span>
                                  <Clock size={10} />
                                  <span>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</span>
                                  {missingStatus > 0 && isPast && (
                                    <span className="font-bold" style={{ color: "var(--tone-warning)" }}>· {missingStatus} en attente</span>
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
                  const dayCompetitions = competitionsByDate[key] ?? [];
                  const dayEvents = [
                    ...dayCompetitions.map(competition => ({ kind: "competition", value: competition })),
                    ...daySessions.map(session => ({ kind: "session", value: session })),
                  ];
                  const isToday     = isSameDay(date, today);
                  const isSelected  = selectedDate && isSameDay(date, selectedDate);
                  const hasEvents   = dayEvents.length > 0;

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
                        {hasEvents && (
                          <div className="md:hidden flex gap-0.5 mt-1 flex-wrap justify-end">
                            {dayEvents.slice(0, 3).map(event => event.kind === "competition" ? (
                              <div key={`competition-${event.value.id}`} aria-label={`Compétition ${event.value.name}`} className="w-1.5 h-1.5 rounded-full" style={{ background: "#A855F7" }} />
                            ) : (
                              <div
                                key={`session-${event.value.id}`}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: colors(event.value.category).border }}
                                onClick={e => { e.stopPropagation(); setActiveSession(event.value); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="hidden md:block space-y-0.5">
                        {dayEvents.slice(0, 3).map(event => {
                          if (event.kind === "competition") return (
                            <CompetitionPlanningCard key={`competition-${event.value.id}`} competition={event.value} athletes={athletes} compact onOpen={setActiveCompetition} />
                          );
                          const s = event.value;
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
                        {dayEvents.length > 3 && (
                          <p className="meta-text font-semibold px-1">
                            +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? "s" : ""}
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
                    {selectedDaySessions.length + selectedDayCompetitions.length} événement{selectedDaySessions.length + selectedDayCompetitions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button type="button" aria-label="Fermer le détail du jour" onClick={() => setSelectedDate(null)}
                  className="p-1.5 rounded-xl transition-colors" style={{ color: "var(--c-text-3)" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedDayCompetitions.map(competition => (
                <CompetitionPlanningCard key={`competition-${competition.id}`} competition={competition} athletes={athletes} onOpen={setActiveCompetition} />
              ))}
              {selectedDaySessions.length === 0 && selectedDayCompetitions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10" style={{ color: "var(--c-text-3)" }}>
                  <CalendarDays size={32} strokeWidth={1.5} />
                  <p className="text-[12px] text-center font-medium">Aucun événement ce jour</p>
                  <button onClick={() => openCreateSession()}
                    className="text-[12px] font-semibold transition-colors" style={{ color: "var(--tone-success)" }}>
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
                          <span className="chip chip-neutral">{getSessionTrainingFocus(s).shortLabel}</span>
                          {s.createdByAthlete && (
                            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(168,85,247,0.16)", color: "var(--tone-mental)" }}>
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
                          {s.pdfUrl && <span style={{ color: "var(--tone-info)" }}>📄</span>}
                        </div>

                        {missingStatus > 0 && (
                          <div className="flex items-center gap-1 text-[12px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(239,107,107,0.10)", color: "var(--tone-danger)" }}>
                            ❗ {missingStatus} présence{missingStatus > 1 ? "s" : ""} à confirmer
                          </div>
                        )}
                        {missingRpe > 0 && (
                          <div className="flex items-center gap-1 text-[12px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(234,179,8,0.10)", color: "var(--tone-warning)" }}>
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
                onClick={() => openCreateSession()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold transition-colors"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "var(--tone-success)" }}
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
                  {selectedDaySessions.length + selectedDayCompetitions.length} événement{selectedDaySessions.length + selectedDayCompetitions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button type="button" aria-label="Fermer le détail du jour" onClick={() => setSelectedDate(null)}
                className="p-2 rounded-xl tap-feedback" style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
              {selectedDayCompetitions.map(competition => (
                <CompetitionPlanningCard key={`competition-${competition.id}`} competition={competition} athletes={athletes} onOpen={competition => { setActiveCompetition(competition); setSelectedDate(null); }} />
              ))}
              {selectedDaySessions.length === 0 && selectedDayCompetitions.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--c-text-3)" }}>
                  <CalendarDays size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-[12px]">Aucun événement ce jour</p>
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
                onClick={() => { openCreateSession(); setSelectedDate(null); }}
                className="w-full py-3 rounded-2xl text-[13px] font-bold tap-feedback"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "var(--tone-success)" }}
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
          onEditRequest={s => { setSessionModalTarget(s); setActiveSession(null); }}
          onDeleteSession={deleteSession}
          onSetCoachNote={setCoachNote}
          onSetLifecycle={setLifecycle}
          onRemindFeedback={remindFeedback}
          onDuplicate={duplicateSession}
          onSaveTemplate={saveSessionTemplate}
        />
      )}

      {sessionModalTarget && (
        <AddSessionModal
          athletes={athletes}
          initialData={sessionModalTarget === "create" ? null : buildFormFromSession(sessionModalTarget)}
          initialAthleteIds={sessionModalTarget === "create" ? initialAthleteIds : []}
          onClose={() => { setSessionModalTarget(null); setInitialAthleteIds([]); }}
          onAdd={sessionModalTarget === "create" ? addSession : form => updateSession(sessionModalTarget.id, form)}
        />
      )}
      {activeCompetition && <CompetitionDetailModal competition={activeCompetition} athletes={athletes}
        onClose={() => setActiveCompetition(null)}
        onEdit={competition => { setCompetitionEditor(competition); setActiveCompetition(null); }}
        onDelete={deleteCompetition} />}
      {competitionEditor && <CreateCompModal athletes={athletes}
        initialData={competitionEditor === "create" ? null : competitionEditor}
        onClose={() => setCompetitionEditor(null)} onCreate={saveCompetition} />}
      {eventEditor && <PlanningEventModal athletes={athletes} initialKind={eventEditor.kind}
        initialData={eventEditor.event ?? null} onClose={() => setEventEditor(null)}
        onSave={savePlanningEvent} onDelete={deletePlanningEvent} />}
    </div>
  );
}

export default memo(Planning);
