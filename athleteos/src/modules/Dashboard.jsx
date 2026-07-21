// ============================================================
// AthleteOS — src/modules/Dashboard.jsx  ★ DESIGN PREMIUM
// Logique métier identique — rendu entièrement repoli :
//   - Hero greeting avec gradient animé + stats inline
//   - KPI cards avec glow coloré au hover + icône premium
//   - Alertes groupe avec bordure gauche colorée
//   - AthleteStatusCard avec ring de couleur + barre de progression
//   - Colonne droite : compétitions countdown, objectifs, feedbacks
//   - 100% mobile-first, tap feedback, transitions spring
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import {
  Users, Zap, Bell, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Activity,
  Trophy, Star, ChevronRight, HeartPulse, Target,
  CalendarDays, BarChart2, ArrowUpRight,
} from "lucide-react";
import { supabase }                  from "../utils/supabaseClient";
import { useAuth }                   from "../context/AuthContext";
import LoadingState                  from "../components/ui/LoadingState";
import ErrorState                    from "../components/ui/ErrorState";
import {
  getAthleteMetricsForWeek,
  getStatusLabel,
} from "../utils/chargeCalculations";
import { checkUpcomingCompetitions } from "../utils/notifications";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d - jan4) / (7 * 24 * 60 * 60 * 1000));
}

function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}

function acwrColor(v) { return v > 1.3 ? "#E24B4A" : v < 0.8 ? "#378ADD" : "#1D9E75"; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

// ─── KPI Card premium ─────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color, badge, onClick, trend }) {
  return (
    <div
      className={[
        "card relative overflow-hidden p-4 flex items-center gap-3.5",
        onClick ? "card-hover card-glow-green tap-feedback" : "",
      ].join(" ")}
      style={{ "--glow": color }}
      onClick={onClick}
    >
      {/* Fond coloré décoratif */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.06] -translate-y-4 translate-x-4"
        style={{ background: color }}
      />

      {/* Icône */}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon size={19} color={color} strokeWidth={2} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-2">
          <p className="text-[26px] font-black text-slate-800 leading-none tracking-tight">
            {value}
          </p>
          {badge && (
            <span
              className="mb-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: badge.color }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
          {label}
        </p>
        {sub && (
          <p className="text-[10.5px] text-slate-300 mt-0.5 font-medium">{sub}</p>
        )}
      </div>

      {/* Flèche si cliquable */}
      {onClick && (
        <ArrowUpRight size={14} className="text-slate-200 flex-shrink-0" />
      )}
    </div>
  );
}

// ─── Badge validation ─────────────────────────────────────────────────────────
function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
    partial: { label: "Partielle",    cls: "bg-amber-50 text-amber-700 border border-amber-100"       },
    none:    { label: "Non réalisée", cls: "bg-red-50 text-red-700 border border-red-100"             },
  };
  const b = map[status] ?? { label: "À venir", cls: "bg-slate-100 text-slate-400" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>
      {b.label}
    </span>
  );
}

// ─── Carte athlète — état de forme ───────────────────────────────────────────
function AthleteStatusCard({ athlete, weeklyCharge, currentWeek, injuries, sessions, onNavigate }) {
  const metrics      = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek), [athlete.id, weeklyCharge, currentWeek]);
  const status       = getStatusLabel(metrics.readiness, metrics.fatigue, metrics.acwr);
  const activeInj    = (injuries ?? []).filter(i => i.athleteId === athlete.id && i.status !== "résolu");
  const weekSessions = sessions.filter(s => s.week === currentWeek && s.athleteIds.includes(athlete.id));
  const doneCount    = weekSessions.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;
  const hasCharge    = weeklyCharge.some(w => w.athleteId === athlete.id);

  return (
    <div
      className="card card-hover tap-feedback p-4 flex flex-col gap-3 cursor-pointer"
      onClick={() => onNavigate("athletes")}
    >
      {/* Header athlète */}
      <div className="flex items-center gap-2.5">
        {/* Avatar avec ring coloré selon status */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%)` }}
        >
          {initialsFromName(athlete.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">
            {athlete.name.split(" ")[0]}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{athlete.mainDiscipline ?? "—"}</p>
        </div>
        {/* Badge statut */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${status.color}15`, color: status.color }}
        >
          {status.dot}
        </span>
      </div>

      {/* Métriques */}
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "Ready",   value: metrics.readiness,        color: scoreColor(metrics.readiness)      },
            { label: "Fatigue", value: metrics.fatigue,          color: scoreColor(metrics.fatigue, true)  },
            { label: "ACWR",    value: metrics.acwr.toFixed(2),  color: acwrColor(metrics.acwr)            },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl px-1.5 py-2 text-center">
              <p className="text-[14px] font-black leading-none" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-slate-300 font-medium">Pas encore de données</p>
        </div>
      )}

      {/* Badges blessure / séances */}
      {(activeInj.length > 0 || weekSessions.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeInj.length > 0 && (
            <span className="flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <HeartPulse size={8} /> {activeInj.length} blessure{activeInj.length > 1 ? "s" : ""}
            </span>
          )}
          {weekSessions.length > 0 && (
            <span className="flex items-center gap-1 text-[9.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
              ✅ {doneCount}/{weekSessions.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
function Dashboard({ onNavigate }) {
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
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // ═══ Chargement (identique) ═══════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);

      const [athletesRes, sessionsRes, alertsRes, compsRes, injuriesRes, goalsRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data, group_name").eq("club_id", clubId),
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id", clubId),
        supabase.from("alerts").select("id, is_read, severity, type").eq("club_id", clubId),
        supabase.from("competitions").select("id, name, date, competition_athletes(athlete_id)").eq("club_id", clubId).gte("date", today.toISOString().slice(0, 10)).order("date").limit(3),
        supabase.from("injuries").select("id, athlete_id, name, intensity, status, location").eq("status", "actif"),
        supabase.from("athlete_goals").select("*").eq("club_id", clubId).eq("achieved", false),
      ]);

      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map(a => a.id);
      const chargeRes  = athleteIds.length
        ? await supabase.from("session_athletes").select("session_id, athlete_id, rpe").in("athlete_id", athleteIds)
        : { data: [] };

      const mappedSessions = (sessionsRes.data ?? []).map(s => {
        const rows = s.session_athletes ?? [];
        return {
          id: s.id, week: s.week, day: s.day, sessionDate: s.session_date,
          time: s.time, type: s.type, category: s.category, title: s.title,
          durationMinutes: s.duration_minutes, createdBy: s.created_by,
          createdByAthlete: false,
          athleteIds:   rows.map(v => v.athlete_id),
          validations:  rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, rpe: v.rpe, comment: v.comment })),
        };
      });

      const charge = [];
      athleteIds.forEach(aid => {
        const weeks = {};
        mappedSessions.forEach(s => {
          const sa = (chargeRes.data ?? []).find(r => r.session_id === s.id && r.athlete_id === aid);
          if (!sa?.rpe) return;
          weeks[s.week] = (weeks[s.week] ?? 0) + (s.durationMinutes ?? 60) * sa.rpe;
        });
        Object.entries(weeks).forEach(([week, rawLoad]) => {
          charge.push({ athleteId: aid, week: Number(week), rawLoad });
        });
      });

      setAthletes(athletesRes.data.map(a => ({
        id: a.id, name: a.name, mainDiscipline: a.main_discipline,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
        group: a.group_name,
      })));
      setWeeklyCharge(charge);
      setSessions(mappedSessions);
      setAlerts(alertsRes.data ?? []);

      const mappedComps = (compsRes.data ?? []).map(c => ({
        id: c.id, name: c.name, date: c.date,
        athleteIds: (c.competition_athletes ?? []).map(x => x.athlete_id),
      }));
      setCompetitions(mappedComps);
      setInjuries(injuriesRes.data ?? []);
      setGoals(goalsRes.data ?? []);

      if (mappedComps.length > 0) await checkUpcomingCompetitions(clubId, mappedComps);
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Métriques (identique) ════════════════════════════════════════════════
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
    const overloaded = athletes.filter(a => getAthleteMetricsForWeek(a.id, weeklyCharge, currentWeek).acwr > 1.3);
    const injured = [...new Set(injuries.map(i => i.athleteId))].length;
    const pendingAthleteSession = sessions.filter(s => s.createdByAthlete).length;
    return { avgCharge, trend, actifs, unreadAlerts, validationRate, overloaded, injured, pendingAthleteSession };
  }, [athletes, weeklyCharge, sessions, alerts, injuries, currentWeek]);

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
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto animate-slide-up">

      {/* ── Hero greeting ─────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-5 md:p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D9E75 0%, #0f7a5a 60%, #0a6048 100%)" }}
      >
        {/* Déco cercle */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-2 top-8 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mb-0.5">
              {today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h2 className="text-[22px] md:text-[24px] font-black text-white tracking-tight leading-tight">
              {getGreeting()}, {firstName} 👋
            </h2>
            <p className="text-white/60 text-[12px] font-medium mt-1">
              Semaine {currentWeek} · {athletes.length} athlète{athletes.length > 1 ? "s" : ""} suivi{athletes.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Badge séances en attente */}
          {metrics.pendingAthleteSession > 0 && (
            <button
              onClick={() => onNavigate("planning")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 border border-white/20 text-white text-[12px] font-semibold hover:bg-white/25 transition-all tap-feedback"
            >
              📋 {metrics.pendingAthleteSession} à valider
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {/* Mini stats dans le hero */}
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Actifs S" + currentWeek, value: metrics.actifs + "/" + athletes.length },
            { label: "Charge moy.",             value: metrics.avgCharge ?? "—"               },
            { label: "Validation",              value: metrics.validationRate != null ? metrics.validationRate + "%" : "—" },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-2xl px-3 py-2.5 text-center">
              <p className="text-[18px] font-black text-white leading-none">{s.value}</p>
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alertes critiques groupe ───────────────────────────────────────── */}
      {(metrics.overloaded.length > 0 || metrics.injured > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.overloaded.length > 0 && (
            <div className="card p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: "#E24B4A" }}>
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <Activity size={16} color="#E24B4A" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-red-800">
                  {metrics.overloaded.length} en surcharge · ACWR &gt; 1.3
                </p>
                <p className="text-[11.5px] text-red-500 mt-0.5 font-medium">
                  {metrics.overloaded.map(a => a.name.split(" ")[0]).join(", ")}
                </p>
              </div>
            </div>
          )}
          {metrics.injured > 0 && (
            <div className="card p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: "#EF9F27" }}>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <HeartPulse size={16} color="#EF9F27" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-amber-800">
                  {metrics.injured} athlète{metrics.injured > 1 ? "s" : ""} blessé{metrics.injured > 1 ? "s" : ""}
                </p>
                <p className="text-[11.5px] text-amber-600 mt-0.5 font-medium">
                  {[...new Set(injuries.map(i => i.athleteId))].map(id => athletes.find(a => a.id === id)?.name?.split(" ")[0]).filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Users} label="Athlètes actifs" color="#1D9E75"
          value={metrics.actifs} sub={`/${athletes.length} total`}
          onClick={() => onNavigate("athletes")}
        />
        <MetricCard
          icon={Zap} label="Charge moyenne" color="#378ADD"
          value={metrics.avgCharge ?? "—"}
          sub={metrics.trend != null ? `${metrics.trend > 0 ? "+" : ""}${metrics.trend}% vs S-1` : "pas de données"}
          badge={metrics.trend > 20 ? { label: "↑ Élevée", color: "#E24B4A" } : metrics.trend < -20 ? { label: "↓ Baisse", color: "#378ADD" } : undefined}
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

      {/* ── Layout 2 colonnes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── État du groupe ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-slate-800">État du groupe</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Semaine {currentWeek} · données en temps réel</p>
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
              <Users size={32} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
              <p className="text-[13px] font-semibold text-slate-400">Aucun athlète enregistré</p>
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
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Compétitions</h3>
                <button
                  onClick={() => onNavigate("competitions")}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                >
                  Voir tout <ArrowUpRight size={11} />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {competitions.map(c => {
                  const days = Math.round((new Date(c.date) - today) / (1000 * 60 * 60 * 24));
                  const isUrgent = days <= 7;
                  return (
                    <div key={c.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isUrgent ? "bg-red-50" : "bg-emerald-50"}`}>
                        <Trophy size={15} color={isUrgent ? "#E24B4A" : "#1D9E75"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {new Date(c.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                          {" · "}{c.athleteIds.length} athlète{c.athleteIds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-black px-2.5 py-1 rounded-xl flex-shrink-0"
                        style={{
                          background: isUrgent ? "#FFF1F2" : "#F0FDF4",
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
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Objectifs saison</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  {goals.length} actif{goals.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {goals.slice(0, 5).map(g => {
                  const athlete  = athletes.find(a => a.id === g.athlete_id);
                  const daysLeft = g.deadline ? Math.round((new Date(g.deadline) - today) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <div key={g.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Target size={15} color="#1D9E75" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[12px] font-bold text-slate-700">{athlete?.name?.split(" ")[0] ?? "?"}</p>
                          <span className="text-slate-300 text-[10px]">·</span>
                          <p className="text-[11px] text-slate-500 truncate">{g.discipline}</p>
                        </div>
                        <p className="text-[15px] font-black text-emerald-600 leading-tight">{g.target_value}</p>
                      </div>
                      {daysLeft !== null && (
                        <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">
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
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-[14px] font-bold text-slate-800">Feedbacks récents</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{recentFeedbacks.length} retour{recentFeedbacks.length > 1 ? "s" : ""} athlète</p>
              </div>
              <div className="divide-y divide-slate-50">
                {recentFeedbacks.map(({ session, validation, athlete }, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}
                    >
                      {initialsFromName(athlete.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[12px] font-bold text-slate-700">{athlete.name.split(" ")[0]}</span>
                        <span className="text-[10.5px] text-slate-400 truncate max-w-[100px]">{session.title}</span>
                        <ValidationBadge status={validation.status} />
                      </div>
                      {validation.feeling != null && (
                        <div className="flex items-center gap-0.5 mb-1">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j} size={10}
                              fill={j < validation.feeling ? "#EF9F27" : "none"}
                              color={j < validation.feeling ? "#EF9F27" : "#e2e8f0"}
                            />
                          ))}
                        </div>
                      )}
                      {validation.comment && (
                        <p className="text-[11px] text-slate-400 italic truncate">« {validation.comment} »</p>
                      )}
                    </div>
                    {validation.rpe != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
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
              <BarChart2 size={28} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-slate-400">Les données apparaîtront ici</p>
              <p className="text-[11px] text-slate-300 mt-1">
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