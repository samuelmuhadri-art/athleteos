// ============================================================
// AthleteOS — src/athlete/views/AthleteDashboard.jsx  ★ v4
// Émotion : dossier médical de haut niveau — sobre, précis, rassurant.
// Règles strictes :
//   - max font-weight 600 partout sauf 1 chiffre héro (700)
//   - zéro emoji dans l'UI — icônes lucide uniquement
//   - max 2 couleurs vives simultanément
//   - barres de charge : largeur fixe 24px, opacité sur les anciennes
//   - fond #F5F5F2, cards #FDFDFB — contraste visible mais doux
// ============================================================

import { useState, useMemo, memo } from "react";
import {
  CalendarDays, TrendingUp, Zap, CheckCircle,
  Activity, FileText, HeartPulse, Trophy, ChevronRight,
  Star, Clock,
} from "lucide-react";
import {
  getAthleteMetricsForWeek,
} from "../../utils/chargeCalculations";
import { getAthleteAxisProfile } from "../../utils/loadAxes";
import {
  getISOWeek, colorsFor, parsePerf, isSameDay, parseLocalDate, toLocalDateStr,
  initialsFromName, getDiscHib, DISC_TYPE_COLORS, WELLNESS_QUESTIONS,
} from "../shared";
import AxisRadarCard from "../../components/ui/AxisRadarCard";
import FormeDetailPanel from "../components/FormeDetailPanel";
import TrainingGauge from "../components/TrainingGauge";
import { getAthleteLoadStory, getMonitoringReading } from "../../domain/monitoringMetrics.js";
import { TRAINING_GAUGE_KEYS, getTrainingGaugeReading } from "../../domain/trainingGauges.js";
import { SessionDetailModal } from "./AthletePlanning";
import { openSessionPdf } from "../../utils/storage";
import { getTodayFocus } from "../dashboardFocus";
import { buildDailyState } from "../../domain/dailyState";
import DailyStateDetailPanel from "../components/DailyStateDetailPanel";
import { getSessionTrainingFocus } from "../../domain/trainingFocus";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDiscType(discName) {
  const MAP = {
    "100m":"sprint","200m":"sprint","400m":"sprint","800m":"endurance","1500m":"endurance",
    "60m haies":"sprint","100m haies":"sprint","110m haies":"sprint","400m haies":"sprint",
    "Longueur":"saut","Triple saut":"saut","Hauteur":"saut","Perche":"saut",
    "Poids":"lancer","Disque":"lancer","Javelot":"lancer","Marteau":"lancer",
    "Décathlon":"combine","Heptathlon":"combine",
  };
  return MAP[discName] ?? "sprint";
}

// ─── Badges — zéro emoji, icônes lucide ──────────────────────────────────────
function computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak }) {
  const badges = [];
  const myComps   = (competitions ?? []).filter(c => c.athleteIds?.includes(athlete.id));
  const myPerfs   = myPerformances ?? [];
  const myRecords = Object.keys(athlete.records ?? {});
  const totalDone = (sessions ?? []).reduce((acc, s) =>
    acc + (s.validations?.filter(v => v.athleteId === athlete.id && v.status === "done").length ?? 0), 0);

  const add = (id, label, desc, color, icon = "zap") =>
    badges.push({ id, label, desc, color, icon, unlocked: true });
  const addLocked = (id, label, desc) =>
    badges.push({ id, label, desc, color: "var(--c-text-4)", icon: "lock", unlocked: false });

  if (streak >= 1)  add("s1",  "Premier feu",  "1 sem. consécutive",   "#C8890A", "zap");
  if (streak >= 3)  add("s3",  "En feu",       "3 sem. consécutives",  "#C8890A", "zap");
  if (streak >= 5)  add("s5",  "Inarrêtable",  "5 sem. consécutives",  "#C0392B", "zap");
  if (streak >= 10) add("s10", "Légende",      "10 sem. consécutives", "#7C67C8", "star");
  if (totalDone >= 1)   add("d1",  "Premier pas", "1 séance",    "#1D9E75", "check");
  if (totalDone >= 10)  add("d10", "Régulier",    "10 séances",  "#1D9E75", "check");
  if (totalDone >= 25)  add("d25", "Bosseur",     "25 séances",  "#4B7BDB", "trending");
  if (totalDone >= 50)  add("d50", "Acharné",     "50 séances",  "#7C67C8", "trending");
  if (totalDone >= 100) add("d100","Élite",       "100 séances", "#C8890A", "trophy");
  if (myComps.length >= 1) add("c1","Compétiteur","1ère compétition", "#C0392B", "trophy");
  if (myComps.length >= 5) add("c5","Guerrier",   "5 compétitions",   "#C0392B", "trophy");

  const prBeat = myPerfs.filter(p => {
    const rec = athlete.records?.[p.discipline]; if (!rec) return false;
    const hib = getDiscHib(p.discipline);
    const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
    if (!pv.value || !prv.value) return false;
    return hib ? pv.value >= prv.value : pv.value <= prv.value;
  }).length;
  if (prBeat >= 1) add("pr1","Record battu","1 PR amélioré",  "#C8890A","trophy");
  if (prBeat >= 3) add("pr3","Recordman",   "3 PR améliorés", "#C8890A","star");

  const discCount = [...new Set([...myRecords,...myPerfs.map(p=>p.discipline)])].length;
  if (discCount >= 1) add("dc1","Spécialiste", "1 discipline",    "#4B7BDB","star");
  if (discCount >= 3) add("dc3","Polyvalent",  "3 disciplines",   "#7C67C8","star");
  if (discCount >= 5) add("dc5","Décathlonien","5+ disciplines",  "#C0392B","star");
  if (myPerfs.length >= 5)  add("p5", "Analytique", "5 perfs",  "#1D9E75","trending");
  if (myPerfs.length >= 20) add("p20","Data driven","20 perfs", "#4B7BDB","trending");

  const optW = (weeklyCharge.filter(w=>w.athleteId===athlete.id)).filter(w => {
    const m = getAthleteMetricsForWeek(athlete.id, weeklyCharge, w.week);
    return m.variationPercent != null && Math.abs(m.variationPercent) <= 20;
  }).length;
  if (optW >= 3) add("aw3","Régulier","3 fenêtres stables","#1D9E75","check");
  if (optW >= 8) add("aw8","Maestro", "8 fenêtres stables","#7C67C8","star");

  if (streak < 3)         addLocked("l1","En feu",      `${3-streak} sem. de plus`);
  if (totalDone < 10)     addLocked("l2","Régulier",    `${10-totalDone} séance(s)`);
  if (myComps.length < 1) addLocked("l3","Compétiteur", "Participe à une compét.");

  return badges;
}

// ─── Icône badge sans emoji ───────────────────────────────────────────────────
function BadgeIcon({ icon, color, size = 14 }) {
  const props = { size, color, strokeWidth: 1.8 };
  if (icon === "trophy")   return <Trophy   {...props} />;
  if (icon === "star")     return <Star     {...props} />;
  if (icon === "check")    return <CheckCircle {...props} />;
  if (icon === "trending") return <TrendingUp  {...props} />;
  return <Zap {...props} />;
}

const BadgeItem = memo(({ badge }) => (
  <div className={[
    "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all",
    badge.unlocked ? "hover:-translate-y-0.5" : "opacity-30",
  ].join(" ")}
    style={badge.unlocked
      ? { background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }
      : { background: "var(--c-surface)", border: "1px dashed var(--c-border-strong)" }}>
    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ background: badge.unlocked ? badge.color + "18" : "rgba(255,255,255,0.04)" }}>
      <BadgeIcon icon={badge.icon} color={badge.unlocked ? badge.color : "var(--c-text-4)"} />
    </div>
    <p style={{ fontSize: "var(--text-meta)", fontWeight: 600, color: "var(--c-text-1)", lineHeight: "var(--leading-meta)" }}>{badge.label}</p>
    <p style={{ fontSize: "var(--text-meta)", color: "var(--c-text-3)", lineHeight: "var(--leading-meta)" }}>{badge.desc}</p>
  </div>
));

const DailyFocusCard = memo(({
  focus, todaySessions, nextCompetition,
  dailyState, loadStory,
  onOpenWellness, onOpenSession, onOpenPlanning, onConfirmRestDay,
  onOpenDailyState, onOpenLoadDetail,
}) => {
  const wellnessCompleted = focus.kind !== "wellness";
  const session = focus.focusSession;
  const progress = Math.round((focus.completedSteps / Math.max(1, focus.totalSteps)) * 100);

  const presentation = focus.kind === "wellness" ? {
    eyebrow: "Étape suivante",
    title: "Check-in du matin",
    description: "30 secondes pour décrire ton ressenti du jour et donner du contexte à ton coach.",
    cta: "Faire mon check-in",
    color: "var(--color-success)",
    icon: Activity,
    action: onOpenWellness,
  } : focus.kind === "session" ? {
    eyebrow: "Prochaine séance",
    title: session?.title ?? "Séance du jour",
    description: [session?.time, session?.durationMinutes ? `${session.durationMinutes} min` : null].filter(Boolean).join(" · "),
    cta: "Ouvrir la séance",
    color: session ? colorsFor(session.category).border : "var(--c-accent)",
    icon: Clock,
    action: onOpenSession,
  } : focus.kind === "rest" ? {
    eyebrow: "Donnée du jour",
    title: "Confirmer le jour de repos",
    description: "Aucune séance n'est prévue. Confirme seulement si tu n'as réalisé aucun autre entraînement aujourd'hui.",
    cta: "Confirmer 0 de charge",
    color: "var(--color-info)",
    icon: CheckCircle,
    action: onConfirmRestDay,
  } : focus.kind === "complete" ? {
    eyebrow: "Journée à jour",
    title: "Tout est validé",
    description: "Ton check-in et tes séances du jour sont enregistrés. Beau travail.",
    cta: "Voir la semaine",
    color: "var(--color-success)",
    icon: CheckCircle,
    action: onOpenPlanning,
  } : {
    eyebrow: "Journée légère",
    title: "Repos confirmé",
    description: "Le jour est enregistré à 0 de charge. Ce zéro est une donnée confirmée, pas une valeur supposée.",
    cta: "Voir le planning",
    color: "var(--color-info)",
    icon: CalendarDays,
    action: onOpenPlanning,
  };

  const FocusIcon = presentation.icon;
  const completedSessionLabel = todaySessions.length === 0
    ? (focus.kind === "rest" ? "Repos à confirmer" : "Repos confirmé")
    : `${focus.completedSessions}/${todaySessions.length} traitée${todaySessions.length > 1 ? "s" : ""}`;

  return (
    <section className="card xl:col-span-2" aria-labelledby="daily-focus-title" style={{
      position: "relative", overflow: "hidden", minHeight: "100%",
      background: "linear-gradient(135deg, rgba(36,168,125,0.13), rgba(91,141,239,0.045) 45%, rgba(255,255,255,0.018) 72%), var(--c-surface)",
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", width: 180, height: 180, borderRadius: "50%", right: -90, top: -100,
        background: `color-mix(in srgb, ${presentation.color} 9%, transparent)`, filter: "blur(12px)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", padding: "var(--card-padding-comfortable)", height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="metric-label">Ton essentiel</p>
            <h2 id="daily-focus-title" className="section-title" style={{ marginTop: "var(--space-1)" }}>Aujourd’hui</h2>
            <p className="secondary-text" style={{ marginTop: "var(--space-1)" }}>Une action prioritaire, puis les repères utiles de ta journée.</p>
          </div>
          <span style={{
            minWidth: 48, padding: "4px 10px", borderRadius: 99, textAlign: "center",
            background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
            color: "var(--c-text-2)", fontSize: "var(--text-meta)", fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}>
            {focus.completedSteps}/{focus.totalSteps}
          </span>
        </div>

        <div className="progress-bar" style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-4)", height: 4 }}>
          <div className="progress-fill" style={{ width: `${progress}%`, background: presentation.color }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] gap-4">
          <div style={{
            padding: "var(--space-4)", borderRadius: "var(--r-lg)",
            background: `color-mix(in srgb, ${presentation.color} 7%, transparent)`,
            border: `1px solid color-mix(in srgb, ${presentation.color} 20%, transparent)`,
          }}>
            <div className="flex items-start gap-3">
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: presentation.color, background: `color-mix(in srgb, ${presentation.color} 12%, transparent)`,
              }}>
                <FocusIcon size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="metric-label" style={{ color: presentation.color }}>{presentation.eyebrow}</p>
                <p className="card-title" style={{ marginTop: "var(--space-1)", fontSize: 17 }}>{presentation.title}</p>
                <p className="secondary-text" style={{ marginTop: "var(--space-1)" }}>{presentation.description}</p>
              </div>
            </div>
            <button type="button" onClick={presentation.action} className="btn-primary" style={{ width: "100%", marginTop: "var(--space-4)" }}>
              {presentation.cta}<ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>

          <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid var(--c-border)", background: "rgba(2,7,12,0.16)" }}>
            {[
              {
                key: "checkin", icon: Activity, label: "Ton check-in",
                value: wellnessCompleted ? (dailyState?.plainHeadline ?? "Complété") : "30 secondes pour le faire",
                color: wellnessCompleted ? dailyState?.color : "var(--color-warning)", action: wellnessCompleted ? onOpenDailyState : onOpenWellness,
              },
              {
                key: "session", icon: CalendarDays, label: "Ta séance",
                value: session?.title ?? completedSessionLabel,
                detail: session ? completedSessionLabel : null,
                color: session ? presentation.color : "var(--c-text-2)", action: session ? onOpenSession : onOpenPlanning,
              },
              {
                key: "progress", icon: TrendingUp, label: "Ta progression",
                value: loadStory?.headline ?? "Ton historique se construit",
                color: "var(--color-info)", action: onOpenLoadDetail,
              },
            ].map((item, index) => {
              const ItemIcon = item.icon;
              return (
                <button key={item.key} type="button" onClick={item.action} className="tap-feedback" style={{
                  width: "100%", minHeight: 58, display: "flex", alignItems: "center", gap: 10,
                  background: "transparent", border: 0, borderBottom: index < 2 ? "1px solid var(--c-border)" : 0,
                  padding: "10px 12px", color: "inherit", cursor: "pointer", textAlign: "left",
                }}>
                  <ItemIcon size={16} color={item.color} aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="metric-label" style={{ display: "block" }}>{item.label}</span>
                    <span className="secondary-text line-clamp-1" style={{ display: "block", marginTop: 2, color: "var(--c-text-1)", fontWeight: 600 }}>{item.value}</span>
                    {item.detail && <span className="meta-text" style={{ display: "block", marginTop: 2 }}>{item.detail}</span>}
                  </span>
                  <ChevronRight size={14} color="var(--c-text-3)" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        {nextCompetition && (
          <p className="meta-text" style={{ marginTop: "auto", paddingTop: "var(--space-3)" }}>
            Prochain cap · <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>{nextCompetition.name}</span>
          </p>
        )}
      </div>
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthleteDashboard({
  athlete, weeklyCharge, sessions, competitions, lastMessages,
  coachName, myPerformances, onNavigate, wellnessToday, wellnessHistory = [], onOpenWellness,
  confirmedRestDays = [], onConfirmRestDay,
  onOpenInjuryReport, allAthletes, onRpeChange, onStatusChange,
  onFeelingChange, onCommentChange, onRsvpChange,
}) {
  // Recalculé à chaque rendu pour rester juste après un changement de date.
  const today       = new Date();
  const currentWeek = getISOWeek(today);
  const [openTodaySessionId, setOpenTodaySessionId] = useState(null);
  const [activeMetric, setActiveMetric] = useState(null);
  const [showDailyState, setShowDailyState] = useState(false);

  const metrics = useMemo(() =>
    getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek, wellnessToday ? [wellnessToday] : [], sessions),
  [athlete.id, weeklyCharge, currentWeek, wellnessToday, sessions]);

  // Les 5 jauges circulaires (ressenti, charge, condition physique,
  // préparation, sollicitation récente) sont l'affichage principal ; les
  // chiffres scientifiques bruts qui les nourrissent restent disponibles en
  // second niveau, repliés, pour qui veut aller plus loin.
  const advancedMonitoring = useMemo(() => ["wellness", "load7", "load28", "variation", "spacing", "dataQuality", "ewmaAcute", "ewmaChronic", "monotony", "acwrExperimental"]
    .map((key) => getMonitoringReading(key, metrics)), [metrics]);
  const loadStory = useMemo(
    () => getAthleteLoadStory(metrics, sessions, athlete.id),
    [metrics, sessions, athlete.id],
  );

  const dailyState = useMemo(
    () => buildDailyState({ wellness: wellnessToday, history: wellnessHistory, metrics }),
    [wellnessHistory, wellnessToday, metrics],
  );
  const status = { label: dailyState.label, color: dailyState.color };

  const trainingGauges = useMemo(() => [...TRAINING_GAUGE_KEYS].map((key) =>
    getTrainingGaugeReading(key, { metrics, dailyState, sessions, athleteId: athlete.id, currentWeek }),
  ), [metrics, dailyState, sessions, athlete.id, currentWeek]);

  const nextComp = competitions
    .filter(c => c.athleteIds.includes(athlete.id) && new Date(c.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;

  const weekSessions = useMemo(() =>
    sessions.filter(s => s.week === currentWeek).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
  [sessions, currentWeek]);

  // Séance(s) du jour — la plus importante info de l'écran, mise en avant
  // juste sous le ring plutôt que noyée dans la liste de la semaine.
  const todaySessions = weekSessions
    .filter(s => s.sessionDate && isSameDay(parseLocalDate(s.sessionDate), today));
  const todayFocus = getTodayFocus({
    wellnessCompleted: Boolean(wellnessToday),
    restConfirmed: confirmedRestDays.includes(toLocalDateStr(today)),
    todaySessions, athleteId: athlete.id,
  });
  const focusSession = todayFocus.focusSession;
  const openedTodaySession = todaySessions.find(session => session.id === openTodaySessionId) ?? null;

  const topRecords     = Object.entries(athlete.records ?? {}).slice(0, 4);
  const activeInjuries = (athlete.injuries ?? []).filter(i => i.status !== "résolu");

  const streak = useMemo(() => {
    let s = 0;
    for (let w = currentWeek; w >= currentWeek - 20; w--) {
      const ok = sessions.filter(se => se.week === w)
        .some(se => se.validations?.some(v => v.athleteId === athlete.id && v.status === "done"));
      if (ok) s++; else break;
    }
    return s;
  }, [sessions, athlete.id, currentWeek]);


  const axisProfile = useMemo(
    () => getAthleteAxisProfile(athlete.id, sessions, currentWeek),
    [athlete.id, sessions, currentWeek]
  );

  const badges = useMemo(() =>
    computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak }),
  [athlete, weeklyCharge, sessions, competitions, myPerformances, streak]);

  const unlockedBadges = badges.filter(b =>  b.unlocked);
  const lockedBadges   = badges.filter(b => !b.unlocked);

  const latestPR = useMemo(() => {
    const ago = new Date(); ago.setDate(ago.getDate() - 7);
    return (myPerformances ?? []).find(p => {
      const rec = athlete.records?.[p.discipline];
      if (!rec || !p.performance_date || new Date(p.performance_date) < ago) return false;
      const hib = getDiscHib(p.discipline);
      const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
      if (!pv.value || !prv.value) return false;
      return hib ? pv.value >= prv.value : pv.value <= prv.value;
    }) ?? null;
  }, [myPerformances, athlete.records]);

  const doneThisWeek = weekSessions.filter(s =>
    s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;

  const statusColor = dailyState.color;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container py-4 md:py-5 space-y-4 md:space-y-5 max-w-5xl mx-auto animate-slide-up">

      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="meta-text mb-1">Aujourd’hui</p>
          <h1 className="page-title">Bonjour {athlete.name.split(" ")[0]}</h1>
          <p className="secondary-text mt-1">Voici ce qui compte pour ton entraînement.</p>
        </div>
        <span className="meta-text hidden sm:block">Semaine {currentWeek}</span>
      </header>

      {/* L'action du jour occupe seule le premier niveau de lecture. Les
          explications et chiffres restent juste après, sans être supprimés. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5 items-stretch">
        <DailyFocusCard
          focus={todayFocus}
          todaySessions={todaySessions}
          nextCompetition={nextComp}
          dailyState={dailyState}
          loadStory={loadStory}
          onOpenWellness={onOpenWellness}
          onOpenSession={() => focusSession && setOpenTodaySessionId(focusSession.id)}
          onOpenPlanning={() => onNavigate("planning")}
          onConfirmRestDay={() => onConfirmRestDay?.(toLocalDateStr(today))}
          onOpenDailyState={() => setShowDailyState(true)}
          onOpenLoadDetail={() => setActiveMetric("weeklyLoad")}
        />

        <div className="xl:col-span-2" style={{ paddingTop: "var(--space-2)" }}>
          <h2 className="section-title">Mieux comprendre ta journée</h2>
          <p className="secondary-text" style={{ marginTop: "var(--space-1)" }}>Ton ressenti et tes chiffres restent disponibles, avec une explication simple avant le détail scientifique.</p>
        </div>

        <section className="rounded-2xl overflow-hidden select-none border xl:col-span-2" aria-labelledby="wellness-title"
          style={{ position: "relative", background: "linear-gradient(160deg, var(--c-surface) 0%, var(--c-surface-2) 55%, var(--c-bg) 100%)", borderColor: "var(--c-border)" }}>
          {/* Grille décorative — très subtile */}
          <div className="absolute pointer-events-none" aria-hidden="true" style={{
            inset: 0,
            backgroundImage: "linear-gradient(rgba(29,158,117,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          <div style={{ position: "relative", padding: "var(--card-padding-comfortable)" }}>
          {/* Identité */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: "rgba(29,158,117,0.14)", border: "1px solid rgba(29,158,117,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>
                  {initialsFromName(athlete.name)}
                </span>
              </div>
              <div>
                <p className="meta-text" style={{ fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "var(--space-1)" }}>
                  Comment tu te sens · S{currentWeek}
                </p>
                <p id="wellness-title" className="section-title">{status.label}</p>
                <p className="meta-text" style={{ marginTop: "var(--space-1)" }}>
                  {athlete.mainDiscipline ?? "Athlète"}{athlete.group ? ` · ${athlete.group}` : ""}
                </p>
              </div>
            </div>
            {/* Pill statut — discret */}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 99, flexShrink: 0,
              background: `${statusColor}12`, border: `1px solid ${statusColor}22`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, color: statusColor }}>{dailyState.score == null ? "À renseigner" : "5 réponses résumées"}</span>
            </div>
          </div>

          {/* 5 jauges : un mot de statut simple, jamais un chiffre brut en
              face avant. Le détail scientifique complet reste à un tap. */}
          <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:mx-0 sm:px-0"
            style={{ scrollSnapType: "x proximity" }}>
            {trainingGauges.map((gauge) => (
              <TrainingGauge key={gauge.key}
                value={gauge.fillPercent} color={gauge.color} statusWord={gauge.statusWord}
                label={gauge.shortLabel}
                onClick={() => (gauge.key === "form" ? setShowDailyState(true) : setActiveMetric(gauge.key))} />
            ))}
          </div>
          </div>
        </section>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          WELLNESS
         ══════════════════════════════════════════════════════════════════════ */}
      {wellnessToday && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(29,158,117,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle size={14} color="#1D9E75" strokeWidth={2} />
              </div>
              <div>
                <p className="card-title">Ton état du jour</p>
                <p className="card-subtitle">Tes cinq réponses sont enregistrées</p>
              </div>
            </div>
            {metrics.wellnessScore !== null && (
              <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(124,103,200,0.08)" }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#7C67C8", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {metrics.wellnessScore}
                </span>
                <span style={{ fontSize: "var(--text-meta)", color: "var(--tone-mental)", marginLeft: 2 }}>/100</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {WELLNESS_QUESTIONS.map(q => {
              const val  = wellnessToday[q.key];
              const Icon = q.icon;
              const good = q.inverted ? val <= 2 : val >= 4;
              const bad  = q.inverted ? val >= 4 : val <= 2;
              const col  = good ? "#1D9E75" : bad ? "#C0392B" : "#C8890A";
              return (
                <div key={q.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-2) var(--space-1)", borderRadius: 8, background: "var(--c-surface-2)" }}>
                  <Icon size={13} color={q.color} strokeWidth={2} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val}</span>
                  <span style={{ fontSize: "var(--text-meta)", color: "var(--c-text-3)", textAlign: "center", lineHeight: "var(--leading-meta)" }}>{q.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
          {wellnessToday.notes && (
            <p className="meta-text" style={{ marginTop: "var(--space-3)", fontStyle: "italic", borderTop: "1px solid var(--c-border)", paddingTop: "var(--space-3)" }}>
              {wellnessToday.notes}
            </p>
          )}
          <button onClick={onOpenWellness} className="btn-ghost" style={{ marginTop: "var(--space-2)", minHeight: 36, paddingInline: 0 }}>
            Modifier
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GRILLE PRINCIPALE
         ══════════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="athlete-progress-title">
        <h2 id="athlete-progress-title" className="section-title">Ta progression</h2>
        <p className="secondary-text mt-1">D'abord ce qui a changé et pourquoi. Les nombres et les formules restent accessibles si tu veux aller plus loin.</p>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2 space-y-4 md:space-y-5">

          {/* ── Profil de charge (6 axes) ───────────────────────────────────── */}
          <AxisRadarCard
            profile={axisProfile} title="Ce que tes séances ont surtout sollicité"
            subtitle="Une lecture simple de tes objectifs de séance ; ouvre une ligne pour voir la méthode."
            sessions={sessions} athleteId={athlete.id} currentWeek={currentWeek}
          />

          <details className="card p-4">
            <summary className="tap-feedback" style={{ cursor: "pointer", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600 }}>
              Voir le détail scientifique de chaque mesure
            </summary>
            <p className="card-subtitle mt-2 mb-3">La formule et les limites de chaque mesure restent accessibles au toucher.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {advancedMonitoring.map((reading) => (
                <button type="button" key={reading.key} onClick={() => setActiveMetric(reading.key)} className="tap-feedback"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "11px 12px", textAlign: "left", borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
                  <span>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--c-text-1)" }}>{reading.shortLabel}</span>
                    <span className="meta-text">{reading.athleteMeaning}</span>
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: reading.color, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {reading.displayValue}{reading.unit ? ` ${reading.unit}` : ""}<ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          </details>

          {/* ── Séances cette semaine ───────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div style={{ padding: "12px 16px 12px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p className="card-title">Cette semaine</p>
                <p className="card-subtitle">{doneThisWeek}/{weekSessions.length} réalisée{weekSessions.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => onNavigate("planning")} className="btn-ghost" style={{ minHeight: 36, padding: 0 }}>
                Voir tout
              </button>
            </div>
            {weekSessions.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <CalendarDays size={20} color="var(--c-text-3)" strokeWidth={1.5} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Aucune séance cette semaine</p>
              </div>
            ) : weekSessions.map((s, idx) => {
              const c   = colorsFor(s.category);
              const val = s.validations?.find(v => v.athleteId === athlete.id);
              const st  = val?.status ?? "future";
              const stCfg = {
                done:    { label: "Fait",    bg: "rgba(29,158,117,0.15)",  color: "var(--tone-success)" },
                partial: { label: "Partiel", bg: "rgba(232,160,32,0.15)",  color: "var(--tone-warning)" },
                none:    { label: "Absent",  bg: "rgba(224,82,82,0.15)",   color: "var(--tone-danger)" },
                future:  { label: "À venir", bg: "rgba(255,255,255,0.08)", color: "var(--c-text-3)" },
              }[st] ?? { label: "À venir", bg: "rgba(255,255,255,0.08)", color: "var(--c-text-3)" };
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: idx > 0 ? "1px solid var(--c-border)" : "none" }}>
                  {/* Liseré catégorie 2px */}
                  <div style={{ width: 2, alignSelf: "stretch", borderRadius: 2, flexShrink: 0, background: c.border }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }} className="truncate">{s.title}</p>
                    <p className="meta-text" style={{ marginTop: "var(--space-1)" }}>
                      {s.sessionDate
                        ? new Date(s.sessionDate).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" })
                        : s.day} · {s.time}
                    </p>
                    <p className="meta-text" style={{ marginTop: 2, color: "var(--c-text-2)" }}>Objectif · {getSessionTrainingFocus(s).shortLabel}</p>
                  </div>
                  {s.pdfUrl && (
                    <button type="button" onClick={() => openSessionPdf(s.pdfUrl)}
                      style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 32, padding: "4px 8px", borderRadius: 7, background: "rgba(91,141,239,0.15)", color: "var(--color-info)", fontSize: "var(--text-meta)", fontWeight: 600, flexShrink: 0, border: "none", cursor: "pointer" }}>
                      <FileText size={12} />PDF
                    </button>
                  )}
                  <span style={{ flexShrink: 0, padding: "3px 8px", borderRadius: 6, background: stCfg.bg, color: stCfg.color, fontSize: "var(--text-meta)", fontWeight: 600 }}>
                    {stCfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Banner PR ────────────────────────────────────────────────────── */}
          {latestPR && (
            <div style={{ borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #7B5104 0%, #9A6800 50%, #C8890A 100%)" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 90% 15%, rgba(255,255,255,0.08) 0%, transparent 45%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trophy size={18} color="white" strokeWidth={1.8} />
                </div>
                <div>
                  <p style={{ fontSize: "var(--text-meta)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.80)", marginBottom: 4 }}>
                    Nouveau record personnel
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {latestPR.discipline} — {latestPR.value}
                  </p>
                  <p style={{ fontSize: "var(--text-meta)", color: "rgba(255,255,255,0.78)", marginTop: 4 }}>
                    {new Date(latestPR.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Records ─────────────────────────────────────────────────────── */}
          {topRecords.length > 0 && (
            <div className="card overflow-hidden">
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p className="card-title">Mes records</p>
                <button onClick={() => onNavigate("performances")} className="btn-ghost" style={{ minHeight: 36, padding: 0 }}>
                  Tout voir
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {topRecords.map(([disc, r], idx) => {
                  const c = DISC_TYPE_COLORS[getDiscType(disc)] ?? DISC_TYPE_COLORS.sprint;
                  return (
                    <div key={disc} style={{
                      padding: "12px 14px",
                      borderRight: idx % 2 === 0 ? "1px solid var(--c-border)" : "none",
                      borderTop: idx >= 2 ? "1px solid var(--c-border)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                        <p style={{ fontSize: "var(--text-meta)", fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{disc}</p>
                      </div>
                      <p style={{ fontSize: 20, fontWeight: 600, color: c.border, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {r.pr}
                      </p>
                      <p className="meta-text" style={{ marginTop: "var(--space-1)" }}>
                        SB : <span style={{ color: "var(--c-text-2)", fontWeight: 500 }}>{r.sb}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Badges ──────────────────────────────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="card-title">Badges</p>
                <p className="card-subtitle">{unlockedBadges.length} débloqué{unlockedBadges.length > 1 ? "s" : ""}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(200,137,10,0.07)" }}>
                <Trophy size={11} color="#C8890A" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tone-warning)", fontVariantNumeric: "tabular-nums" }}>{unlockedBadges.length}</span>
              </div>
            </div>
            {unlockedBadges.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <Trophy size={22} color="var(--c-text-3)" strokeWidth={1.5} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Commence à t'entraîner pour débloquer tes premiers badges</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: unlockedBadges.length > 0 && lockedBadges.length > 0 ? 12 : 0 }}>
                  {unlockedBadges.slice(0, 8).map(b => <BadgeItem key={b.id} badge={b} />)}
                </div>
                {lockedBadges.length > 0 && (
                  <>
                    <p className="meta-text" style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                      À débloquer
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {lockedBadges.slice(0, 4).map(b => <BadgeItem key={b.id} badge={b} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── COLONNE DROITE ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Prochaine compétition */}
          {nextComp && (() => {
            const days = Math.round((new Date(nextComp.date) - today) / (1000*60*60*24));
            return (
              <div style={{ borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #6B1717 0%, #8B1F1F 50%, #A82525 100%)" }}>
                <div style={{ position: "absolute", right: -20, top: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Trophy size={11} color="rgba(255,255,255,0.40)" strokeWidth={2} />
                    <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.80)" }}>
                      Prochaine compétition
                    </span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 3 }}>
                    {nextComp.name}
                  </p>
                  <p style={{ fontSize: "var(--text-meta)", color: "rgba(255,255,255,0.78)", marginBottom: 12 }}>
                    {new Date(nextComp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center", marginBottom: 10, background: "rgba(255,255,255,0.09)" }}>
                    {/* 1 seul chiffre héro dans tout l'écran — weight 700 autorisé */}
                    <p style={{ fontSize: 38, fontWeight: 700, color: "white", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                      {days}
                    </p>
                    <p style={{ fontSize: "var(--text-meta)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.80)", marginTop: 4 }}>
                      jours
                    </p>
                  </div>
                  {nextComp.plannedEvents?.[athlete.id] && (
                    <div style={{ borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.09)" }}>
                      <p style={{ fontSize: "var(--text-meta)", color: "rgba(255,255,255,0.78)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        Épreuve prévue
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "white" }}>{nextComp.plannedEvents[athlete.id]}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Régularité */}
          {streak > 0 && (
            <div className="card p-4">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(200,137,10,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={13} color="#C8890A" strokeWidth={2} />
                </div>
                <div>
                  <p className="card-title">Régularité</p>
                  <p className="card-subtitle">Semaines consécutives</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 600, color: "var(--tone-warning)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {streak}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--c-text-3)", marginBottom: 3 }}>sem.</span>
              </div>
              <p className="meta-text" style={{ marginBottom: "var(--space-2)" }}>avec au moins 1 séance validée</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100,streak*10)}%`, background: "#C8890A" }} />
              </div>
              <p className="meta-text" style={{ textAlign: "right", marginTop: "var(--space-1)" }}>{streak}/10 badge Maestro</p>
            </div>
          )}

          {/* Blessures */}
          <div style={{ borderRadius: 14, padding: "14px", background: "var(--c-surface-2)", border: "1px solid rgba(232,160,32,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <HeartPulse size={13} color="#C8890A" strokeWidth={2} />
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-dim-alerte)" }}>Blessures en cours</p>
              </div>
              {onOpenInjuryReport && (
                <button onClick={onOpenInjuryReport} className="btn-ghost" style={{ minHeight: 36, padding: 0, color: "var(--color-warning)" }}>
                  + Signaler
                </button>
              )}
            </div>
            {activeInjuries.length === 0 ? (
              <p className="secondary-text">Aucune blessure signalée. Tant mieux !</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {activeInjuries.map(inj => (
                  <div key={inj.id} style={{ borderRadius: 10, padding: "10px 12px", background: "var(--c-surface-3)", border: "1px solid rgba(200,137,10,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-1)" }}>{inj.name}</p>
                      <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "rgba(232,160,32,0.15)", color: "var(--color-warning)" }}>
                        {inj.intensity}/10
                      </span>
                    </div>
                    <p className="meta-text" style={{ marginBottom: "var(--space-2)" }}>{inj.location}</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${(inj.intensity/10)*100}%`,
                        background: inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#C8890A" : "#C0392B",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages coach */}
          {lastMessages.length > 0 && (
            <div className="card p-4">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--c-accent),var(--c-accent-dark))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "var(--text-meta)", fontWeight: 600, flexShrink: 0 }}>
                    {initialsFromName(coachName ?? "C")}
                  </div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }}>{coachName?.split(" ")[0] ?? "Coach"}</p>
                    <p className="meta-text">Message récent</p>
                  </div>
                </div>
                <button onClick={() => onNavigate("messagerie")} className="btn-ghost" style={{ minHeight: 36, padding: 0 }}>
                  Répondre
                </button>
              </div>
              {lastMessages.slice(0, 2).map(m => (
                <div key={m.id} style={{ borderRadius: 10, padding: "9px 11px", marginBottom: 6, background: "var(--c-surface-2)" }}>
                  <p style={{ fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }} className="line-clamp-2">{m.content}</p>
                  <p className="meta-text" style={{ marginTop: "var(--space-1)" }}>
                    {new Date(m.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDailyState && (
        <DailyStateDetailPanel
          state={dailyState}
          onClose={() => setShowDailyState(false)}
          onOpenMetric={(metricKey) => {
            setShowDailyState(false);
            setActiveMetric(metricKey);
          }}
        />
      )}

      {activeMetric && (
        <FormeDetailPanel
          metricKey={activeMetric}
          metrics={metrics}
          dailyState={dailyState}
          sessions={sessions}
          weeklyCharge={weeklyCharge}
          athlete={athlete}
          onClose={() => setActiveMetric(null)}
        />
      )}

      {openedTodaySession && (
        <SessionDetailModal
          session={openedTodaySession} athlete={athlete} allAthletes={allAthletes ?? []}
          onClose={() => setOpenTodaySessionId(null)}
          onSetStatus={onStatusChange} onSetRpe={onRpeChange}
          onSetFeeling={onFeelingChange} onSetComment={onCommentChange}
          onSetRsvp={onRsvpChange}
        />
      )}
    </div>
  );
}
