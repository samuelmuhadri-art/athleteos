// ============================================================
// AthleteOS — src/AthleteApp.jsx  ★ DARK MODE
// Shell uniquement — state, fetch, navigation
// Couleurs hardcodées remplacées par variables CSS dark
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, TrendingUp, MessageSquare,
  LogOut, Users, Bell, Settings
} from "lucide-react";
import { supabase }  from "./utils/supabaseClient";
import { useAuth }   from "./context/AuthContext";
import { usePushNotifications, PushToggleButton } from "./hooks/usePushNotifications";
import { initialsFromName, toLocalDateStr, getISOWeek } from "./athlete/shared";
import { notifyAthleteWeeklyRecap, notifyAthleteWeeklyReport } from "./utils/notifications";
import { useUrlView } from "./hooks/useUrlView";

import AthleteDashboard from "./athlete/views/AthleteDashboard";
import AthletePlanning  from "./athlete/views/AthletePlanning";
import AthletePerfs     from "./athlete/views/AthletePerfs";
import AthleteMsgerie   from "./athlete/views/AthleteMsgerie";
import AthleteClub      from "./athlete/views/AthleteClub";
import WellnessModal    from "./athlete/components/WellnessModal";
import InjuryReportModal from "./athlete/components/InjuryReportModal";
import NotificationBanner from "./athlete/components/NotificationBanner";
import NotificationCenter from "./athlete/components/NotificationCenter";
import AccountSettingsModal from "./components/ui/AccountSettingsModal";
import { AthleteOSBadge, AthleteOSWordmark } from "./components/brand/AthleteOSLogo";
import { getNotificationPresentation, mergeIncomingNotification } from "./athlete/notificationPresentation";

const NAV_ITEMS = [
  { id: "dashboard",    label: "Tableau de bord", shortLabel: "Accueil",  icon: LayoutDashboard },
  { id: "planning",     label: "Mon planning",    shortLabel: "Planning", icon: CalendarDays    },
  { id: "performances", label: "Mes perfs",       shortLabel: "Perfs",    icon: TrendingUp      },
  { id: "social",       label: "Mon club",        shortLabel: "Club",     icon: Users           },
  { id: "messagerie",   label: "Messagerie",      shortLabel: "Messages", icon: MessageSquare   },
];
const NAV_ITEM_IDS = NAV_ITEMS.map(n => n.id);

export default function AthleteApp() {
  const { profile, clubId, signOut } = useAuth();

  const { activeView, navigate, viewKey } = useUrlView(NAV_ITEM_IDS, "dashboard");
  const [athlete,      setAthlete]      = useState(null);
  const [allAthletes,  setAllAthletes]  = useState([]);
  const [weeklyCharge, setWeeklyCharge] = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [coachUserId,    setCoachUserId]    = useState(null);
  const [coachName,      setCoachName]      = useState(null);
  const [lastMessages,   setLastMessages]   = useState([]);
  const [myPerformances, setMyPerformances] = useState([]);
  const [myGoals,        setMyGoals]        = useState([]);
  const [myNotifs,       setMyNotifs]       = useState([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [incomingNotification, setIncomingNotification] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [wellnessToday,  setWellnessToday]  = useState(null);
  const [showWellness,   setShowWellness]   = useState(false);
  const [showInjuryReport, setShowInjuryReport] = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);

  const { subscribed, subscribe, permissionState, swReady } = usePushNotifications(
    athlete?.id ?? null, clubId
  );
  useEffect(() => {
    if (swReady && !subscribed && permissionState !== "denied") subscribe();
  }, [swReady, subscribed, permissionState, subscribe]);

  const fetchAll = useCallback(async () => {
    if (!clubId || !profile?.id) return;
    try {
      setLoading(true); setError(null);
      const athleteRes = await supabase.from("athletes").select("*").eq("user_id", profile.id).single();
      if (athleteRes.error || !athleteRes.data) {
        setError("Aucun profil athlète lié à ton compte. Contacte ton coach.");
        setLoading(false); return;
      }
      const a = athleteRes.data; const athleteId = a.id;
      const todayStr = toLocalDateStr(new Date());

      const [recordsRes,injuriesRes,perfHistRes,sessionsRes,compsRes,coachRes,allAthletesRes,myPerfsRes,goalsRes,notifsRes,wellnessRes,weeklyChargeRes] = await Promise.all([
        supabase.from("records").select("*").eq("athlete_id",athleteId),
        supabase.from("injuries").select("*").eq("athlete_id",athleteId),
        supabase.from("performance_history").select("*").eq("athlete_id",athleteId),
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id",clubId),
        supabase.from("competitions").select("*, competition_athletes(*), competition_results(*)").eq("club_id",clubId),
        supabase.from("users").select("id, name").eq("club_id",clubId).eq("role","head_coach").single(),
        supabase.from("athletes").select("id, name, profile_data").eq("club_id",clubId),
        supabase.from("athlete_performances").select("*").eq("athlete_id",athleteId).order("performance_date",{ascending:true}),
        supabase.from("athlete_goals").select("*").eq("athlete_id",athleteId).order("created_at",{ascending:false}),
        supabase.from("athlete_notifications").select("*").eq("athlete_id",athleteId).order("created_at",{ascending:false}).limit(20),
        supabase.from("athlete_wellness").select("*").eq("athlete_id",athleteId).eq("date",todayStr).maybeSingle(),
        // Charge hebdomadaire calculée côté serveur (vue weekly_charge, voir
        // migration 20260726120000) — plus de recalcul JS à partir des séances.
        supabase.from("weekly_charge").select("*").eq("athlete_id",athleteId),
      ]);

      setMyPerformances(myPerfsRes.data ?? []);
      setMyGoals(goalsRes.data ?? []);
      setMyNotifs(notifsRes?.data ?? []);
      setWellnessToday(wellnessRes.data ?? null);

      const coachId = coachRes.data?.id ?? null;
      setCoachUserId(coachId); setCoachName(coachRes.data?.name ?? null);

      if (coachId) {
        const {data:msgs} = await supabase.from("messages").select("*")
          .or(`and(sender_id.eq.${coachId},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${coachId})`)
          .order("created_at",{ascending:false}).limit(3);
        setLastMessages((msgs??[]).filter(m=>m.sender_id===coachId));
      }

      setAllAthletes((allAthletesRes.data??[]).map(a=>({id:a.id,name:a.name,avatar:a.profile_data?.avatar??initialsFromName(a.name)})));

      const pd   = a.profile_data ?? {};
      const recs = {};
      (recordsRes.data??[]).forEach(r=>{ recs[r.discipline]={sb:r.sb,pr:r.pr,prDate:r.pr_date}; });

      setAthlete({
        id:a.id, name:a.name, age:a.age,
        avatar:pd.avatar??initialsFromName(a.name),
        mainDiscipline:a.main_discipline,
        secondaryDisciplines:pd.secondary_disciplines??[],
        group:a.group_name, level:pd.level??null,
        records:recs,
        injuries:(injuriesRes.data??[]).map(i=>({id:i.id,name:i.name,location:i.location,intensity:i.intensity,status:i.status,startDate:i.start_date,endDate:i.end_date,notes:i.notes})),
        performanceHistory:(perfHistRes.data??[]).sort((x,y)=>x.month.localeCompare(y.month)),
        profile:pd.profile??{},
      });

      const allSessions = (sessionsRes.data??[]).map(s=>{
        const rows = s.session_athletes??[];
        return {
          id:s.id, week:s.week, day:s.day, sessionDate:s.session_date, time:s.time,
          type:s.type, category:s.category, title:s.title, description:s.description,
          instructions:s.instructions, durationMinutes:s.duration_minutes, pdfUrl:s.pdf_url,
          createdBy:s.created_by,
          athleteIds:rows.map(v=>v.athlete_id),
          validations:rows.map(v=>({athleteId:v.athlete_id,status:v.status,feeling:v.feeling,fatigue:v.fatigue,comment:v.comment,rpe:v.rpe})),
        };
      }).filter(s=>s.athleteIds.includes(athleteId));

      const allComps = (compsRes.data??[]).map(c=>({
        id:c.id, name:c.name, date:c.date, location:c.location, type:c.type,
        athleteIds:(c.competition_athletes??[]).map(x=>x.athlete_id),
        plannedEvents:Object.fromEntries((c.competition_athletes??[]).map(x=>[x.athlete_id,x.planned_event])),
        results:(c.competition_results??[]).map(r=>({athleteId:r.athlete_id,event:r.event,result:r.result,context:r.context})),
      })).filter(c=>c.athleteIds.includes(athleteId));

      const charge = (weeklyChargeRes.data??[]).map(c=>({athleteId:c.athlete_id,week:c.week,rawLoad:c.raw_load}));

      setWeeklyCharge(charge);
      setSessions(allSessions);
      setCompetitions(allComps);

      // Récap perso samedi soir — au cas où le coach n'a pas encore ouvert
      // son dashboard (qui envoie aussi celui-ci en boucle sur tout le club).
      await notifyAthleteWeeklyRecap(clubId, { id: athleteId, name: a.name }, allSessions, getISOWeek(new Date()));
      // Rapport hebdomadaire — même fallback, au cas où le coach n'a pas
      // encore ouvert son Dashboard (qui envoie aussi celui-ci pour tout
      // le club via checkWeeklyReports).
      await notifyAthleteWeeklyReport(clubId, { id: athleteId, name: a.name }, getISOWeek(new Date()));
    } catch(err) {
      console.error("AthleteApp:", err);
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId, profile?.id]);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wellnessShownRef = useRef(false);
  useEffect(() => {
    if (!athlete || loading) return;
    // Si déjà rempli aujourd'hui -> jamais afficher
    if (wellnessToday) return;
    // Clé unique par jour — évite le réaffichage au rechargement de page
    const today = toLocalDateStr(new Date());
    const ssKey = `wellness_shown_${athlete.id}_${today}`;
    if (sessionStorage.getItem(ssKey)) return;
    if (wellnessShownRef.current) return;
    wellnessShownRef.current = true;
    sessionStorage.setItem(ssKey, "1");
    setShowWellness(true);
  }, [athlete, wellnessToday, loading]);

  // Le push navigateur reste inchangé. Cette écoute ajoute uniquement le
  // retour visuel instantané quand l'application est déjà ouverte.
  useEffect(() => {
    if (!athlete?.id) return undefined;
    const channel = supabase.channel(`athlete-notifications-${athlete.id}`)
      .on("postgres_changes", {
        event:"INSERT", schema:"public", table:"athlete_notifications",
        filter:`athlete_id=eq.${athlete.id}`,
      }, payload => {
        setMyNotifs(previous => mergeIncomingNotification(previous, payload.new));
        setIncomingNotification(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [athlete?.id]);

  const dismissIncomingNotification = useCallback(() => setIncomingNotification(null), []);

  const openNotification = useCallback(async notification => {
    const presentation = getNotificationPresentation(notification);
    const wasUnread = !notification.is_read;
    setIncomingNotification(current => current?.id === notification.id ? null : current);
    setShowNotifs(false);
    if (wasUnread) {
      setMyNotifs(previous => previous.map(item => item.id === notification.id ? { ...item, is_read:true } : item));
    }
    navigate(presentation.destination);
    if (!wasUnread) return;
    const { error:updateError } = await supabase.from("athlete_notifications")
      .update({ is_read:true })
      .eq("id", notification.id)
      .eq("athlete_id", notification.athlete_id);
    if (updateError) {
      console.error("AthleteApp — notification lue :", updateError);
      setMyNotifs(previous => previous.map(item => item.id === notification.id ? { ...item, is_read:false } : item));
    }
  }, [navigate]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!athlete?.id) return false;
    const unreadIds = myNotifs.filter(notification => !notification.is_read).map(notification => notification.id);
    if (!unreadIds.length) return true;
    const unreadSet = new Set(unreadIds);
    setMyNotifs(previous => previous.map(notification => unreadSet.has(notification.id) ? { ...notification, is_read:true } : notification));
    const { error:updateError } = await supabase.from("athlete_notifications")
      .update({ is_read:true })
      .eq("athlete_id", athlete.id)
      .eq("is_read", false);
    if (!updateError) return true;
    console.error("AthleteApp — toutes notifications lues :", updateError);
    setMyNotifs(previous => previous.map(notification => unreadSet.has(notification.id) ? { ...notification, is_read:false } : notification));
    return false;
  }, [athlete?.id, myNotifs]);

  const handleRpe = useCallback(async (sid,aid,rpe) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,rpe}:v)}));
    await supabase.from("session_athletes").update({rpe}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);
  const handleStatus = useCallback(async (sid,aid,status) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,status}:v)}));
    await supabase.from("session_athletes").update({status}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);
  const handleFeeling = useCallback(async (sid,aid,feeling) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,feeling}:v)}));
    await supabase.from("session_athletes").update({feeling}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);
  const handleComment = useCallback(async (sid,aid,comment) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,comment}:v)}));
    await supabase.from("session_athletes").update({comment}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "var(--c-bg)" }}>
      <AthleteOSBadge size={56} />
      <div className="flex flex-col items-center gap-2">
        <div className="loader-ring" />
        <span style={{ fontSize: 12, color: "var(--c-text-3)", letterSpacing: "0.02em" }}>
          Chargement de ton espace…
        </span>
      </div>
    </div>
  );

  if (error || !athlete) return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--c-bg)" }}>
      <div className="card p-8 max-w-sm w-full text-center">
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--c-text-1)", marginBottom: 4 }}>
          Profil introuvable
        </p>
        <p style={{ fontSize: 12.5, color: "var(--c-text-3)", marginBottom: 24, lineHeight: 1.6 }}>
          {error}
        </p>
        <button onClick={signOut}
          style={{ fontSize: 12, fontWeight: 500, color: "#E05252", background: "none", border: "none", cursor: "pointer" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );

  const currentNav  = NAV_ITEMS.find(n => n.id === activeView);
  const unreadCount = myNotifs.filter(n => !n.is_read).length;
  const msgUnread   = myNotifs.filter(n => !n.is_read && n.type === "message").length;

  return (
    <div className="flex h-screen overflow-hidden w-full"
      style={{ background: "var(--c-bg)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {incomingNotification && (
        <NotificationBanner
          key={incomingNotification.id}
          notification={incomingNotification}
          onOpen={openNotification}
          onDismiss={dismissIncomingNotification}
        />
      )}

      {/* ── SIDEBAR DESKTOP ── */}
      <aside id="athlete-sidebar" className="sidebar-premium z-30 flex-shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{ height: 64, borderBottom: "1px solid var(--c-border)" }}>
          <AthleteOSBadge size={32} title={null} />
          <AthleteOSWordmark size={14} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item, idx) => {
            const Icon     = item.icon;
            const isActive = activeView === item.id;
            const hasBadge = item.id === "messagerie" && msgUnread > 0;
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={["nav-item w-full animate-slide-right", isActive ? "active" : ""].join(" ")}
                style={{ animationDelay: `${idx * 25}ms` }}>
                <div className="relative flex-shrink-0">
                  <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-bounce-in"
                      style={{ background: "#E05252", border: "2px solid var(--c-surface)" }} />
                  )}
                </div>
                <span className="flex-1 text-left truncate" style={{ fontSize: 13 }}>{item.label}</span>
                {hasBadge && (
                  <span className="ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce-in"
                    style={{ background: "#E05252", minWidth: 20, textAlign: "center" }}>
                    {msgUnread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="flex-shrink-0 px-3 py-3"
          style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", fontSize: 10, fontWeight: 600 }}>
              {initialsFromName(athlete.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-1)" }} className="truncate">
                {athlete.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="status-dot-live" />
                <p style={{ fontSize: 10, color: "var(--c-text-3)" }}>Athlète</p>
              </div>
            </div>
            <button onClick={() => setShowNotifs(v => !v)}
              className="relative tap-feedback"
              style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", flexShrink: 0 }}>
              <Bell size={14} />
              {unreadCount > 0 && (
                <span className="absolute animate-bounce-in"
                  style={{ top: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: "#E05252", color: "white", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--c-surface)" }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowSettings(true)}
              className="tap-feedback"
              style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", flexShrink: 0 }}>
              <Settings size={13} />
            </button>
            <button onClick={signOut}
              className="tap-feedback"
              style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", flexShrink: 0 }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
          <PushToggleButton subscribed={subscribed} onToggle={subscribe} permissionState={permissionState} />
        </div>
      </aside>

      {/* ── ZONE PRINCIPALE ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="header-glass flex items-center gap-3 px-4 flex-shrink-0 z-10"
          style={{ height: 56 }}>
          {/* Logo mobile */}
          <div className="flex md:hidden items-center gap-2.5">
            <AthleteOSBadge size={28} title={null} />
            <AthleteOSWordmark size={14} />
          </div>
          {/* Titre vue — desktop */}
          <div className="hidden md:flex items-center gap-2.5">
            {(() => {
              const Icon = currentNav?.icon;
              return Icon ? (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(29,158,117,0.12)" }}>
                  <Icon size={14} color="#1D9E75" strokeWidth={1.8} />
                </div>
              ) : null;
            })()}
            <h1 style={{ fontSize: 15, fontWeight: 500, color: "var(--c-text-1)", letterSpacing: "-0.01em" }}>
              {currentNav?.label ?? "Mon espace"}
            </h1>
          </div>
          <div className="flex-1" />
          <div className="hidden md:block">
            <PushToggleButton subscribed={subscribed} onToggle={subscribe} permissionState={permissionState} />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div key={viewKey} className="view-transition">
            {activeView === "dashboard" && (
              <AthleteDashboard
                athlete={athlete} weeklyCharge={weeklyCharge} sessions={sessions}
                competitions={competitions} lastMessages={lastMessages} coachName={coachName}
                myPerformances={myPerformances} onNavigate={navigate}
                wellnessToday={wellnessToday} onOpenWellness={() => setShowWellness(true)}
                onOpenInjuryReport={() => setShowInjuryReport(true)}
                allAthletes={allAthletes}
                onRpeChange={handleRpe} onStatusChange={handleStatus}
                onFeelingChange={handleFeeling} onCommentChange={handleComment}
              />
            )}
            {activeView === "planning" && (
              <AthletePlanning
                athlete={athlete} sessions={sessions} allAthletes={allAthletes}
                clubId={clubId} createdBy={profile?.id} coachUserId={coachUserId}
                onRpeChange={handleRpe} onStatusChange={handleStatus}
                onFeelingChange={handleFeeling} onCommentChange={handleComment}
                onRefresh={fetchAll}
              />
            )}
            {activeView === "performances" && (
              <AthletePerfs
                athlete={athlete} competitions={competitions}
                myPerformances={myPerformances} myGoals={myGoals}
                clubId={clubId} weeklyCharge={weeklyCharge} sessions={sessions} onRefresh={fetchAll}
              />
            )}
            {activeView === "messagerie" && (
              <AthleteMsgerie
                athlete={athlete} coachUserId={coachUserId}
                athleteUserId={profile?.id} clubId={clubId}
              />
            )}
            {activeView === "social" && (
              <AthleteClub
                athlete={athlete} allAthletes={allAthletes}
                clubId={clubId} sessions={sessions}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── BOTTOM NAV MOBILE ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bottom-nav">
        <div className="flex items-stretch justify-between w-full px-1" style={{ height: "60px" }}>
          {NAV_ITEMS.map(item => {
            const Icon     = item.icon;
            const isActive = activeView === item.id;
            const hasBadge = item.id === "messagerie" && msgUnread > 0;
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={["bottom-nav-item tap-feedback flex-1", isActive ? "active" : ""].join(" ")}>
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  {hasBadge && (
                    <span className="absolute animate-bounce-in"
                      style={{ top: -5, right: -5, width: 14, height: 14, borderRadius: "50%", background: "#E05252", color: "white", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--c-bg)" }}>
                      {msgUnread}
                    </span>
                  )}
                </div>
                <span className="bottom-nav-label truncate max-w-[52px] text-center">
                  {item.shortLabel ?? item.label}
                </span>
              </button>
            );
          })}
          {/* Notifs */}
          <button onClick={() => setShowNotifs(v => !v)}
            className={["bottom-nav-item tap-feedback flex-1", showNotifs ? "active" : ""].join(" ")}>
            <div className="relative">
              <Bell size={20} strokeWidth={showNotifs ? 2 : 1.5} />
              {unreadCount > 0 && (
                <span className="absolute animate-bounce-in"
                  style={{ top: -5, right: -5, width: 14, height: 14, borderRadius: "50%", background: "#E05252", color: "white", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--c-bg)" }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="bottom-nav-label">{subscribed ? "Notifs ●" : "Notifs"}</span>
          </button>
        </div>
      </nav>

      {showNotifs && (
        <NotificationCenter
          notifications={myNotifs}
          subscribed={subscribed}
          onSubscribe={subscribe}
          permissionState={permissionState}
          onClose={() => setShowNotifs(false)}
          onOpen={openNotification}
          onMarkAllRead={markAllNotificationsRead}
        />
      )}

      {showWellness && athlete && (
        <WellnessModal
          athlete={athlete} clubId={clubId}
          onClose={() => setShowWellness(false)}
          onSaved={(data) => {
            // Un seul batch React : ferme ET met à jour
            setShowWellness(false);
            setWellnessToday(data);
          }}
        />
      )}

      {showInjuryReport && athlete && (
        <InjuryReportModal
          athlete={athlete} clubId={clubId}
          onClose={() => setShowInjuryReport(false)}
          onSaved={() => { setShowInjuryReport(false); fetchAll(); }}
        />
      )}

      {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
