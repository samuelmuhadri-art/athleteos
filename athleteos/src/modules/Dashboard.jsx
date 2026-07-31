// ============================================================
// AthleteOS — src/modules/Dashboard.jsx  ★ FUSION FINALE
//
// Fusion des deux variantes premium précédentes :
// - Hero sombre #0A1810 cohérent avec l'espace athlète (base : version "épurée")
// - MetricCard : icône dans carré coloré (version "hybride") + liseré latéral
//   coloré (version "épurée") + glow au survol pour les cartes cliquables
// - Alertes à bordure épaisse 4px (impact visuel, version "hybride") avec
//   icônes en fond translucide (version "épurée")
// - AthleteStatusCard : avatar en dégradé (version "hybride") dans la carte
//   compacte à mini-barres de progression (version "épurée")
// - Système sémantique dimColor conservé partout : couleur = dimension
//   mesurée, jamais le statut
// - Logique métier, requêtes Supabase et calculs 100% identiques à l'original
//   (rien n'a été retiré : mêmes champs, mêmes fetch, mêmes dérivations)
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Users, Zap, Bell, CheckCircle, Activity,
  Trophy, Star, ChevronRight, HeartPulse, Target,
  BarChart2, ArrowUpRight, AlertTriangle, TrendingUp,
} from "lucide-react";
import { supabase }                  from "../utils/supabaseClient";
import { useAuth }                   from "../context/AuthContext";
import LoadingState                  from "../components/ui/LoadingState";
import ErrorState                    from "../components/ui/ErrorState";
import {
  getAthleteMetricsForWeek,
} from "../utils/chargeCalculations";
import { checkUpcomingCompetitions, checkAndAlertACWR, notifyAthleteCompetitionReminder, checkWeeklyRecap, checkWeeklyReports } from "../utils/notifications";
import { buildCoachFeed } from "../utils/coachFeed";
import { getISOWeek, initialsFromName } from "../utils/helpers.js";
import ClubOnboardingCard from "../components/club/ClubOnboardingCard";
import { PageHeader } from "../components/ui/premium";
import { buildDailyState, buildGroupDailyState } from "../domain/dailyState";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Date -> "YYYY-MM-DD" en heure locale (pas .toISOString(), qui convertit en
// UTC et peut faire tomber la date un jour trop tôt/tard selon le fuseau).
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Système sémantique : couleur = dimension mesurée, pas le statut.
// Vert → forme/récup | Bleu → charge/ACWR | Ambre → fatigue/alerte | Rouge → danger
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

// ─── KPI Card — icône colorée + liseré latéral + glow au survol ──────────────
function MetricCard({ icon: Icon, label, value, sub, color, badge, onClick }) {
  return (
    <div
      className={[
        "card relative overflow-hidden p-4 flex items-center gap-3.5",
        onClick ? "card-hover card-glow-green tap-feedback cursor-pointer" : "",
      ].join(" ")}
      style={{ "--glow": color }}
      onClick={onClick}
    >
      {/* Liseré coloré gauche */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
        style={{ background: color }}
      />
      {/* Fond coloré décoratif */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.06] -translate-y-4 translate-x-4"
        style={{ background: color }}
      />

      {/* Icône */}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ml-1"
        style={{ background: `${color}15` }}
      >
        <Icon size={19} color={color} strokeWidth={2} />
      </div>

      {/* Contenu analytique */}
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-2">
          <p
            className="text-[26px] font-bold leading-none tracking-tight"
            style={{ color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
          >
            {value}
          </p>
          {badge && (
            <span
              className="mb-0.5 text-[12px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: badge.color }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="meta-text font-bold uppercase tracking-[0.09em] mt-1">
          {label}
        </p>
        {sub && (
          <p className="meta-text mt-0.5 font-medium">{sub}</p>
        )}
      </div>

      {onClick && (
        <ArrowUpRight size={14} className="flex-shrink-0" style={{ color: "var(--c-text-3)" }} />
      )}
    </div>
  );
}

// ─── Badge validation ─────────────────────────────────────────────────────────
function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     cls: "chip chip-success" },
    partial: { label: "Partielle",    cls: "chip chip-warning" },
    none:    { label: "Non réalisée", cls: "chip chip-danger"  },
  };
  const b = map[status] ?? { label: "À venir", cls: "chip chip-neutral" };
  return <span className={b.cls}>{b.label}</span>;
}

// ─── Carte athlète — avatar dégradé + mini barres de progression ─────────────
// Mini-courbe des 4-6 dernières semaines de charge — on voit la tendance
// d'un coup d'œil au lieu d'un seul chiffre statique.
const MiniSparkline = memo(({ data, color }) => {
  if (data.length < 2) return null;
  return (
    <div style={{ width: "100%", height: 22 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function AthleteStatusCard({ athlete, weeklyCharge, currentWeek, injuries, sessions, wellnessToday, onNavigate }) {
  const metrics   = useMemo(
    () => getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek, wellnessToday ? [wellnessToday] : [], sessions),
    [athlete.id, weeklyCharge, currentWeek, wellnessToday, sessions]
  );
  const status    = useMemo(
    () => buildDailyState({ wellness: wellnessToday, metrics }),
    [wellnessToday, metrics]
  );
  const activeInj = (injuries ?? []).filter(i => i.athleteId === athlete.id && i.status !== "résolu");
  const weekSess  = sessions.filter(s => s.week === currentWeek && s.athleteIds?.includes(athlete.id));
  const doneCount = weekSess.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;
  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);
  const isAtRisk  = false;

  const readColor = status.color;
  const acwrCol   = "#378ADD";
  const fatCol    = "#14B8A6";

  const sparkData = useMemo(() =>
    weeklyCharge.filter(w => w.athleteId === athlete.id).sort((a, b) => a.week - b.week).slice(-6).map(w => ({ v: w.rawLoad })),
  [weeklyCharge, athlete.id]);

  return (
    <div
      className={["card card-hover tap-feedback p-3.5 flex flex-col gap-2.5 cursor-pointer", isAtRisk ? "pulse-danger-bg" : ""].join(" ")}
      onClick={() => onNavigate("athletes")}
    >
      {/* Header avec avatar en dégradé */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%)` }}
        >
          {initialsFromName(athlete.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold truncate leading-tight" style={{ color: "var(--c-text-1)" }}>
            {athlete.name.split(" ")[0]}
          </p>
          <p className="meta-text truncate">{athlete.mainDiscipline ?? "—"}</p>
        </div>
        {/* Dot statut */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: status.color, boxShadow: `0 0 5px ${status.color}` }}
        />
      </div>

      <div className="rounded-xl px-3 py-2" style={{ background: `${status.color}0D`, border: `1px solid ${status.color}20` }}>
        <p className="text-[12px] font-semibold leading-5" style={{ color: "var(--c-text-1)" }}>{status.plainHeadline ?? status.label}</p>
        {status.score != null && <p className="mt-0.5 text-[12px] leading-4" style={{ color: "var(--c-text-2)" }}>{status.watch?.[0] ?? status.helps?.[0] ?? "Ressenti renseigné aujourd'hui."}</p>}
      </div>

      {/* Métriques — 3 valeurs + mini barres */}
      {(hasCharge || status.score != null) ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { lbl: "Ressenti", val: status.score ?? "—", col: readColor, pct: status.score ?? 0 },
            { lbl: "Semaine", val: metrics.load7 ?? "—", col: acwrCol, pct: metrics.load7 && metrics.load28 ? Math.min(100, (metrics.load7 / metrics.load28) * 100) : 0 },
            { lbl: "Habitude", val: metrics.load28 ?? "—", col: fatCol, pct: metrics.load28 ? 100 : 0 },
          ].map(s => (
            <div key={s.lbl} className="bg-[var(--c-surface-2)] rounded-xl px-1.5 py-2 text-center">
              <p
                className="text-[14px] font-bold leading-none"
                style={{ color: s.col, fontVariantNumeric: "tabular-nums" }}
              >
                {s.val}
              </p>
              <p className="text-[12px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--c-text-2)" }}>
                {s.lbl}
              </p>
              <div className="mt-1.5 h-0.5 bg-[var(--c-surface-3)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, s.pct)}%`, background: s.col, opacity: 0.75 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--c-surface-2)] rounded-xl px-3 py-2 text-center">
          <p className="meta-text font-medium">Pas encore de données</p>
        </div>
      )}

      <p className="text-[12px] font-medium leading-snug" style={{ color: "var(--c-text-2)" }}>
        {status.loadContext ?? status.summary}
      </p>

      {/* Tendance charge — 6 dernières semaines */}
      {hasCharge && sparkData.length >= 2 && <MiniSparkline data={sparkData} color={acwrCol} />}

      {/* Badges blessure / séances */}
      {(activeInj.length > 0 || weekSess.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeInj.length > 0 && (
            <span
              className="flex items-center gap-1 text-[12px] font-bold border px-2 py-0.5 rounded-full"
              style={{ color: "var(--tone-warning)", background: "rgba(239,159,39,0.15)", borderColor: "#EF9F27" }}
            >
              <HeartPulse size={8} /> {activeInj.length} blessure{activeInj.length > 1 ? "s" : ""}
            </span>
          )}
          {weekSess.length > 0 && (
            <span
              className="flex items-center gap-1 text-[12px] font-semibold border px-2 py-0.5 rounded-full"
              style={{ color: "var(--c-text-2)", background: "var(--c-surface-3)", borderColor: "var(--c-border)" }}
            >
              <CheckCircle size={9} /> {doneCount}/{weekSess.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fil du coach — les signaux (ACWR, fatigue, blessures, absences,
// compétitions à risque) transformés en phrases priorisées et actionnables
// au lieu de chiffres bruts à interpréter soi-même. Remplace les anciens
// blocs statiques "surcharge"/"blessés". Logique dans src/utils/coachFeed.js.
function CoachFeedIcon({ icon, color }) {
  const props = { size: 15, color, strokeWidth: 2 };
  if (icon === "alert")    return <AlertTriangle {...props} />;
  if (icon === "activity") return <Activity {...props} />;
  if (icon === "zap")      return <Zap {...props} />;
  if (icon === "heart")    return <HeartPulse {...props} />;
  if (icon === "trophy")   return <Trophy {...props} />;
  if (icon === "users")    return <Users {...props} />;
  if (icon === "check")    return <CheckCircle {...props} />;
  if (icon === "trending") return <TrendingUp {...props} />;
  return <Bell {...props} />;
}

function CoachFeedSection({ items, onNavigate }) {
  const shown = items.slice(0, 8);
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--c-border)] flex items-center justify-between">
        <div>
          <h2 className="card-title">Tes actions prioritaires</h2>
          <p className="card-subtitle mt-0.5">
            {items.length > 0 ? "Commence par le haut : chaque ligne ouvre directement le bon écran." : "Aucune action urgente pour le moment"}
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full chip chip-warning">
            {items.length} action{items.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="px-5 py-8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.08)" }}>
            <CheckCircle size={16} color="#1D9E75" strokeWidth={2} />
          </div>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--c-text-2)" }}>
            Les alertes, réponses, présences, validations et compétitions proches sont à jour.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--c-border)]">
          {shown.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.route ?? "athletes")}
              className="w-full px-5 py-3.5 flex items-start gap-3 text-left hover:bg-[var(--c-surface-2)] transition-colors border-l-4"
              style={{ borderLeftColor: item.color }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${item.color}18` }}>
                <CoachFeedIcon icon={item.icon} color={item.color} />
              </div>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{item.label ?? "À vérifier"}</span>
                <span className="block text-[12.5px] leading-relaxed mt-0.5" style={{ color: "var(--c-text-2)" }}>{item.sentence}</span>
              </span>
              <ChevronRight size={14} className="flex-shrink-0 mt-1" style={{ color: "var(--c-text-3)" }} />
            </button>
          ))}
        </div>
      )}
      {items.length > shown.length && (
        <div className="px-5 py-2.5 text-center border-t border-[color:var(--c-border)]">
          <span className="meta-text">
            +{items.length - shown.length} autre{items.length - shown.length > 1 ? "s" : ""} action{items.length - shown.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
function Dashboard({
  onNavigate,
  club,
  clubLoading = false,
  onOpenClubSettings,
  onInvite,
  onDemo,
}) {
  const { clubId, profile } = useAuth();
  const today       = new Date();
  const currentWeek = getISOWeek(today);

  const [athletes,     setAthletes]     = useState([]);
  const [weeklyCharge, setWeeklyCharge] = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [injuries,     setInjuries]     = useState([]);
  const [goals,        setGoals]        = useState([]);
  const [wellnessRows, setWellnessRows] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // ═══ Chargement (identique à l'original — aucune requête modifiée) ═════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const requestDate = new Date();

      const [athletesRes, sessionsRes, alertsRes, compsRes, injuriesRes, goalsRes, wellnessRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data, group_name, user_id").eq("club_id", clubId),
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id", clubId),
        supabase.from("alerts").select("id, is_read, severity, type").eq("club_id", clubId),
        supabase.from("competitions").select("id, name, date, competition_athletes(athlete_id)").eq("club_id", clubId).gte("date", toLocalDateStr(requestDate)).order("date").limit(3),
        supabase.from("injuries").select("id, athlete_id, name, intensity, status, location").eq("status", "actif"),
        supabase.from("athlete_goals").select("*").eq("club_id", clubId).eq("achieved", false),
        supabase.from("athlete_wellness").select("athlete_id, date, sleep, energy, soreness, mood, stress, notes").eq("club_id", clubId).eq("date", toLocalDateStr(requestDate)),
      ]);

      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map(a => a.id);
      // Charge hebdomadaire calculée côté serveur (vue weekly_charge, voir
      // migration 20260726120000) — plus de recalcul JS à partir des séances.
      const chargeRes  = athleteIds.length
        ? await supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)
        : { data: [] };

      const mappedSessions = (sessionsRes.data ?? []).map(s => {
        const rows = s.session_athletes ?? [];
        return {
          id: s.id, week: s.week, day: s.day, sessionDate: s.session_date,
          time: s.time, type: s.type, category: s.category, trainingFocus: s.training_focus, title: s.title,
          durationMinutes: s.duration_minutes, createdBy: s.created_by,
          lifecycleStatus: s.lifecycle_status ?? "planned",
          createdByAthlete: s.created_by != null && athletesRes.data.some(a => a.user_id === s.created_by),
          athleteIds:   rows.map(v => v.athlete_id),
          validations:  rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, rpe: v.rpe, comment: v.comment, actualDurationMinutes: v.actual_duration_minutes, durationSource: v.duration_source, rsvpStatus: v.rsvp_status, rsvpNote: v.rsvp_note, coachNote: v.coach_note })),
        };
      });

      const charge = (chargeRes.data ?? []).map(c => ({
        athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load,
        dailyLoads: c.daily_loads ?? [], knownDays: c.known_days ?? 0,
        unknownDays: c.unknown_days ?? 0, estimatedDays: c.estimated_days ?? 0,
      }));

      const mappedAthletes = athletesRes.data.map(a => ({
        id: a.id, name: a.name, mainDiscipline: a.main_discipline,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
        group: a.group_name,
      }));
      setAthletes(mappedAthletes);
      setWeeklyCharge(charge);
      setSessions(mappedSessions);
      setAlerts(alertsRes.data ?? []);

      const mappedComps = (compsRes.data ?? []).map(c => ({
        id: c.id, name: c.name, date: c.date,
        athleteIds: (c.competition_athletes ?? []).map(x => x.athlete_id),
      }));
      setCompetitions(mappedComps);
      // Les lignes brutes de Supabase sont en snake_case (athlete_id) —
      // sans ce mapping, AthleteStatusCard (i.athleteId) et le fil du coach
      // ne matchaient jamais aucun athlète : le badge "blessure" sur les
      // cartes du groupe ne s'affichait donc jamais, silencieusement.
      setInjuries((injuriesRes.data ?? []).map(i => ({
        id: i.id, athleteId: i.athlete_id, name: i.name,
        intensity: i.intensity, status: i.status, location: i.location,
      })));
      setGoals(goalsRes.data ?? []);
      setWellnessRows((wellnessRes.data ?? []).map(row => ({
        ...row,
        athleteId: row.athlete_id,
      })));

      if (mappedComps.length > 0) {
        await checkUpcomingCompetitions(clubId, mappedComps);
        const in7days = new Date(Date.now() + 7 * 86400000);
        for (const comp of mappedComps) {
          if (new Date(comp.date) <= in7days) {
            await notifyAthleteCompetitionReminder(clubId, comp);
          }
        }
      }
      if (mappedAthletes.length > 0 && charge.length > 0) {
        await checkAndAlertACWR(clubId, mappedAthletes, charge, currentWeek);
      }
      if (mappedAthletes.length > 0) {
        await checkWeeklyRecap(clubId, mappedAthletes, mappedSessions, currentWeek, profile?.id ?? null);
        await checkWeeklyReports(clubId, mappedAthletes, currentWeek, profile?.id ?? null);
      }
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId, currentWeek, profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Métriques (identique à l'original) ════════════════════════════════════
  const metrics = useMemo(() => {
    const currentCharges = weeklyCharge.filter(w => w.week === currentWeek);
    const avgCharge = currentCharges.length > 0
      ? Math.round(currentCharges.reduce((s, w) => s + w.rawLoad, 0) / currentCharges.length)
      : null;
    const prevCharges = weeklyCharge.filter(w => w.week === currentWeek - 1);
    const prevAvg = prevCharges.length > 0
      ? Math.round(prevCharges.reduce((s, w) => s + w.rawLoad, 0) / prevCharges.length)
      : null;
    const trend = avgCharge && prevAvg ? Math.round(((avgCharge - prevAvg) / prevAvg) * 100) : null;
    const actifs = currentCharges.length;
    const unreadAlerts = alerts.filter(a => !a.is_read).length;
    const weekSessions = sessions.filter(s => s.week === currentWeek);
    const totalExpected = weekSessions.reduce((s, sess) => s + sess.athleteIds.length, 0);
    const totalDone = weekSessions.reduce((s, sess) => s + (sess.validations?.filter(v => v.status === "done").length ?? 0), 0);
    const validationRate = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : null;
    const pendingAthleteSession = sessions.filter(s => s.createdByAthlete).length;
    return { avgCharge, trend, actifs, unreadAlerts, validationRate, pendingAthleteSession };
  }, [weeklyCharge, sessions, alerts, currentWeek]);

  // Les anciens blocs "surcharge"/"blessés" (chiffres bruts) sont remplacés
  // par ce fil narrativisé et priorisé — voir src/utils/coachFeed.js.
  const coachFeed = useMemo(
    () => buildCoachFeed({ athletes, weeklyCharge, sessions, injuries, competitions, alerts, currentWeek }),
    [athletes, weeklyCharge, sessions, injuries, competitions, alerts, currentWeek]
  );

  const groupDailyState = useMemo(
    () => buildGroupDailyState(athletes, wellnessRows),
    [athletes, wellnessRows]
  );

  const recentFeedbacks = useMemo(() => {
    const results = [];
    sessions.forEach(s => {
      (s.validations ?? []).forEach(v => {
        if (!v.status) return;
        const athlete = athletes.find(a => a.id === v.athleteId);
        if (!athlete) return;
        results.push({ session: s, validation: v, athlete });
      });
    });
    return results.filter(f => f.validation.feeling || f.validation.comment).slice(0, 5);
  }, [sessions, athletes]);

  const firstName = profile?.name?.split(" ")[0] ?? "Coach";

  if (loading) return <LoadingState message="Chargement du dashboard…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="page-container py-4 md:py-6 space-y-4 md:space-y-5 max-w-7xl mx-auto animate-slide-up">
      <PageHeader
        eyebrow="VUE COACH"
        title={`${getGreeting()}, ${firstName}`}
        description="Les priorités et l’état de ton groupe en un coup d’œil."
        actions={(
          <button type="button" className="btn-primary" onClick={() => onNavigate("planning")}>
            Planifier une séance
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      />

      {profile?.role === "head_coach" && !clubLoading && (
        <ClubOnboardingCard
          club={club}
          athleteCount={athletes.length}
          sessionCount={sessions.length}
          onBranding={onOpenClubSettings}
          onInvite={onInvite}
          onPlanning={() => onNavigate("planning")}
          onDemo={onDemo}
        />
      )}

      {/* Le coach voit d'abord ce qui demande une action. Les statistiques
          restent entièrement disponibles juste après. */}
      <div data-dashboard-priority-queue>
        <CoachFeedSection items={coachFeed} onNavigate={onNavigate} />
      </div>

      {/* ── Synthèse de la semaine ────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{ background: "#0A1810" }}
      >
        {/* Halo vert décoratif */}
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(29,158,117,0.15) 0%, transparent 70%)" }}
        />
        {/* Grille fine déco */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(29,158,117,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.8) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative p-5 md:p-6">
          {/* Ligne de contexte */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: "rgba(255,255,255,0.68)" }}>
                {today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h2 className="text-[20px] md:text-[22px] font-bold text-white tracking-tight leading-tight">Synthèse de la semaine</h2>
              <p className="text-[12px] font-medium mt-1" style={{ color: "rgba(255,255,255,0.68)" }}>
                Semaine {currentWeek} · {athletes.length} athlète{athletes.length > 1 ? "s" : ""} suivi{athletes.length > 1 ? "s" : ""}
              </p>
            </div>

            {/* Badge séances en attente */}
            {metrics.pendingAthleteSession > 0 && (
              <button
                onClick={() => onNavigate("planning")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all tap-feedback"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "0.5px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {metrics.pendingAthleteSession} à valider
                <ChevronRight size={13} />
              </button>
            )}
          </div>

          {/* 3 stats inline dans le hero */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Check-ins du jour",
                value: `${groupDailyState.completed}/${athletes.length}`,
                color: "#1D9E75",
              },
              {
                label: "Bon ressenti",
                value: groupDailyState.favorable,
                color: "var(--tone-success)",
                sub: "d'après leurs réponses",
              },
              {
                label: "À discuter",
                value: groupDailyState.attention,
                color: groupDailyState.attention > 0 ? "#F2C46D" : "#69C5F7",
                sub: "sans prédire un risque",
              },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl px-3 py-3 text-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                }}
              >
                <p
                  className="text-[20px] font-bold leading-none"
                  style={{ color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
                >
                  {s.value}
                </p>
                <p className="text-[12px] font-bold uppercase tracking-[0.07em] mt-1.5" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {s.label}
                </p>
                {s.sub && (
                  <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.62)" }}>{s.sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Priorités coach ──────────────────────────────────────────────── */}
      {/* ── KPIs — icône + liseré + glow au survol ────────────────────────── */}
      <section className="space-y-3" aria-labelledby="overview-title">
        <div>
          <h2 id="overview-title" className="section-title">Vue d'ensemble</h2>
          <p className="secondary-text mt-0.5">Les indicateurs essentiels de la semaine.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            icon={Users} label="Athlètes actifs" color="#1D9E75"
            value={metrics.actifs} sub={`/${athletes.length} total`}
            onClick={() => onNavigate("athletes")}
          />
          <MetricCard
            icon={Zap} label="Effort moyen du groupe" color="#378ADD"
            value={metrics.avgCharge ?? "—"}
            sub={metrics.trend == null ? "Comparaison indisponible" : metrics.trend > 10 ? `Plus que la semaine passée (+${metrics.trend} %)` : metrics.trend < -10 ? `Moins que la semaine passée (${metrics.trend} %)` : "Proche de la semaine passée"}
            badge={metrics.trend > 20 ? { label: "Hausse nette", color: "#D18A24" } : metrics.trend < -20 ? { label: "Baisse nette", color: "#378ADD" } : undefined}
          />
          <MetricCard
            icon={Bell} label="Alertes non lues" color="#E24B4A"
            value={metrics.unreadAlerts} sub="à traiter"
            onClick={() => onNavigate("alerts")}
          />
          <MetricCard
            icon={CheckCircle} label="Taux de validation" color="#EF9F27"
            value={metrics.validationRate != null ? `${metrics.validationRate}%` : "—"}
            sub="séances cette semaine"
          />
        </div>
      </section>

      {/* ── Layout 2 colonnes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── État du groupe ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">
                État du groupe
              </h2>
              <p className="secondary-text mt-0.5">
                Semaine {currentWeek} · données en temps réel
              </p>
            </div>
            <button
              onClick={() => onNavigate("charge")}
              className="flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Détail <ArrowUpRight size={13} />
            </button>
          </div>

          {athletes.length === 0 ? (
            <div className="card p-10 text-center">
              <Users size={32} className="mx-auto mb-3" strokeWidth={1.5} style={{ color: "var(--c-text-4)" }} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--c-text-2)" }}>Aucun athlète enregistré</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {athletes.map(a => (
                <AthleteStatusCard
                  key={a.id}
                  athlete={a}
                  weeklyCharge={weeklyCharge}
                  currentWeek={currentWeek}
                  injuries={injuries}
                  sessions={sessions}
                  wellnessToday={wellnessRows.find(row => row.athleteId === a.id)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Colonne droite ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Prochaines compétitions */}
          {competitions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[color:var(--c-border)] flex items-center justify-between">
                <h3 className="card-title">Compétitions</h3>
                <button
                  onClick={() => onNavigate("competitions")}
                  className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                >
                  Voir tout <ArrowUpRight size={11} />
                </button>
              </div>
              <div className="divide-y divide-[color:var(--c-border)]">
                {competitions.map(c => {
                  const days = Math.round((new Date(c.date) - today) / (1000 * 60 * 60 * 24));
                  const isUrgent = days <= 7;
                  return (
                    <div key={c.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--c-surface-2)] transition-colors">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isUrgent ? "rgba(226,75,74,0.08)" : "rgba(29,158,117,0.08)" }}
                      >
                        <Trophy size={15} color={isUrgent ? "#E24B4A" : "#1D9E75"} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{c.name}</p>
                        <p className="meta-text mt-0.5">
                          {new Date(c.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                          {" · "}{c.athleteIds.length} athlète{c.athleteIds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className="text-[12px] font-bold px-2.5 py-1 rounded-xl flex-shrink-0"
                        style={{
                          background: isUrgent ? "rgba(224,82,82,0.15)" : "rgba(29,158,117,0.15)",
                          color:      isUrgent ? "#E24B4A" : "#1D9E75",
                        }}
                      >
                        {days === 0 ? "Auj." : `J-${days}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objectifs saison */}
          {goals.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[color:var(--c-border)] flex items-center justify-between">
                <h3 className="card-title">Objectifs saison</h3>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full chip chip-success">
                  {goals.length} actif{goals.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-[color:var(--c-border)]">
                {goals.slice(0, 5).map(g => {
                  const athlete  = athletes.find(a => a.id === g.athlete_id);
                  const daysLeft = g.deadline ? Math.round((new Date(g.deadline) - today) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <div key={g.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--c-surface-2)] transition-colors">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.08)" }}>
                        <Target size={15} color="#1D9E75" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[12px] font-semibold" style={{ color: "var(--c-text-1)" }}>{athlete?.name?.split(" ")[0] ?? "?"}</p>
                          <span className="meta-text">·</span>
                          <p className="meta-text truncate" style={{ color: "var(--c-text-2)" }}>{g.discipline}</p>
                        </div>
                        <p className="text-[15px] font-bold text-emerald-600 leading-tight">{g.target_value}</p>
                      </div>
                      {daysLeft !== null && (
                        <span className="meta-text font-semibold flex-shrink-0">
                          {daysLeft > 0 ? `J-${daysLeft}` : "Échu"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedbacks récents */}
          {recentFeedbacks.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[color:var(--c-border)]">
                <h3 className="card-title">Feedbacks récents</h3>
                <p className="card-subtitle mt-0.5">{recentFeedbacks.length} retour{recentFeedbacks.length > 1 ? "s" : ""} athlète</p>
              </div>
              <div className="divide-y divide-[color:var(--c-border)]">
                {recentFeedbacks.map(({ session, validation, athlete }, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[var(--c-surface-2)] transition-colors">
                    {/* Avatar avec dégradé */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}
                    >
                      {initialsFromName(athlete.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[12px] font-semibold" style={{ color: "var(--c-text-1)" }}>{athlete.name.split(" ")[0]}</span>
                        <span className="meta-text truncate max-w-[100px]">{session.title}</span>
                        <ValidationBadge status={validation.status} />
                      </div>
                      {validation.feeling != null && (
                        <div className="flex items-center gap-0.5 mb-1">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j} size={10}
                              fill={j < validation.feeling ? "#EF9F27" : "none"}
                              color={j < validation.feeling ? "#EF9F27" : "rgba(255,255,255,0.18)"}
                            />
                          ))}
                        </div>
                      )}
                      {validation.comment && (
                        <p className="meta-text italic truncate">« {validation.comment} »</p>
                      )}
                    </div>
                    {validation.rpe != null && (
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>
                        RPE {validation.rpe}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* État vide */}
          {competitions.length === 0 && goals.length === 0 && recentFeedbacks.length === 0 && (
            <div className="card p-8 text-center">
              <BarChart2 size={28} className="mx-auto mb-3" strokeWidth={1.5} style={{ color: "var(--c-text-4)" }} />
              <p className="text-[12px] font-semibold" style={{ color: "var(--c-text-2)" }}>Les données apparaîtront ici</p>
              <p className="meta-text mt-1">
                Compétitions, objectifs et feedbacks s'afficheront au fur et à mesure.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(Dashboard);
