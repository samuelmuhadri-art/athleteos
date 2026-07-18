// ============================================================
// AthleteOS — src/modules/Dashboard.jsx
// Dashboard coach enrichi :
// - KPIs groupe (actifs, charge, alertes, validation)
// - État de forme de chaque athlète (carte visuelle)
// - Séances athlètes en attente de validation
// - Feedbacks récents
// - Prochaines compétitions
// - Objectifs athlètes
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import {
  Users, Zap, Bell, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Activity,
  Trophy, Star, ChevronRight, HeartPulse, Target,
  CalendarDays, BarChart2,
} from "lucide-react";
import { supabase }                 from "../utils/supabaseClient";
import { useAuth }                  from "../context/AuthContext";
import LoadingState                 from "../components/ui/LoadingState";
import ErrorState                   from "../components/ui/ErrorState";
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
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  return 1 + Math.round((d-jan4)/(7*24*60*60*1000));
}

function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}

function acwrColor(v) { return v > 1.3 ? "#E24B4A" : v < 0.8 ? "#378ADD" : "#1D9E75"; }

// ─── Composants UI ────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color, badge, onClick }) {
  return (
    <div
      className={["bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4", onClick ? "cursor-pointer hover:shadow-md transition-all" : ""].join(" ")}
      onClick={onClick}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[24px] font-black text-slate-800 leading-tight">
          {value}
          {badge && <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badge.color }}>{badge.label}</span>}
        </p>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     cls: "bg-emerald-50 text-emerald-700" },
    partial: { label: "Partielle",    cls: "bg-amber-50 text-amber-700"     },
    none:    { label: "Non réalisée", cls: "bg-red-50 text-red-700"         },
  };
  const b = map[status] ?? { label: "À venir", cls: "bg-slate-100 text-slate-400" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>;
}

// Carte athlète avec état de forme
function AthleteStatusCard({ athlete, weeklyCharge, currentWeek, injuries, sessions, onNavigate }) {
  const metrics = useMemo(() =>
    getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek),
  [athlete.id, weeklyCharge, currentWeek]);

  const status = getStatusLabel(metrics.readiness, metrics.fatigue, metrics.acwr);
  const activeInjuries = (injuries ?? []).filter(i => i.athleteId === athlete.id && i.status !== "résolu");
  const weekSessions = sessions.filter(s => s.week === currentWeek && s.athleteIds.includes(athlete.id));
  const doneCount = weekSessions.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;
  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition-all"
      onClick={() => onNavigate("athletes")}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: `${status.color}` }}
        >
          {initialsFromName(athlete.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-slate-800 truncate">{athlete.name.split(" ")[0]}</p>
          <p className="text-[10px] text-slate-400 truncate">{athlete.mainDiscipline ?? "—"}</p>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${status.color}18`, color: status.color }}>
          {status.dot}
        </span>
      </div>

      {hasCharge ? (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "Readiness", value: metrics.readiness, color: scoreColor(metrics.readiness) },
            { label: "Fatigue",   value: metrics.fatigue,   color: scoreColor(metrics.fatigue, true) },
            { label: "ACWR",      value: metrics.acwr.toFixed(2), color: acwrColor(metrics.acwr) },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-lg px-1.5 py-1.5">
              <p className="text-[13px] font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-slate-300">Pas de données de charge</p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        {activeInjuries.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            <HeartPulse size={9}/> {activeInjuries.length} blessure{activeInjuries.length>1?"s":""}
          </span>
        )}
        {weekSessions.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            ✅ {doneCount}/{weekSessions.length} séance{weekSessions.length>1?"s":""}
          </span>
        )}
      </div>
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

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);

      const [athletesRes, sessionsRes, alertsRes, compsRes, injuriesRes, goalsRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data, group_name").eq("club_id", clubId),
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id", clubId),
        supabase.from("alerts").select("id, is_read, severity, type").eq("club_id", clubId),
        supabase.from("competitions").select("id, name, date, competition_athletes(athlete_id)").eq("club_id", clubId).gte("date", today.toISOString().slice(0,10)).order("date").limit(3),
        supabase.from("injuries").select("id, athlete_id, name, intensity, status, location").eq("status", "actif"),
        supabase.from("athlete_goals").select("*").eq("club_id", clubId).eq("achieved", false),
      ]);

      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map(a => a.id);
      const chargeRes  = athleteIds.length
        ? await supabase.from("session_athletes").select("session_id, athlete_id, rpe")
            .in("athlete_id", athleteIds)
        : { data: [] };

      // Calcul charge hebdomadaire par athlète
      const mappedSessions = (sessionsRes.data ?? []).map(s => {
        const rows = s.session_athletes ?? [];
        return {
          id: s.id, week: s.week, day: s.day, sessionDate: s.session_date,
          time: s.time, type: s.type, category: s.category, title: s.title,
          durationMinutes: s.duration_minutes, createdBy: s.created_by,
          createdByAthlete: false,
          athleteIds: rows.map(v => v.athlete_id),
          validations: rows.map(v => ({
            athleteId: v.athlete_id, status: v.status,
            feeling: v.feeling, rpe: v.rpe, comment: v.comment,
          })),
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

      // Check automatique compétitions à venir → alertes coach
      if (mappedComps.length > 0) {
        await checkUpcomingCompetitions(clubId, mappedComps);
      }
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Métriques groupe ═════════════════════════════════════════════════════
  const metrics = useMemo(() => {
    // Charge moyenne cette semaine
    const currentCharges = weeklyCharge.filter(w => w.week === currentWeek);
    const avgCharge = currentCharges.length > 0
      ? Math.round(currentCharges.reduce((s, w) => s + w.rawLoad, 0) / currentCharges.length)
      : null;

    // Charge semaine précédente
    const prevCharges = weeklyCharge.filter(w => w.week === currentWeek - 1);
    const prevAvg = prevCharges.length > 0
      ? Math.round(prevCharges.reduce((s, w) => s + w.rawLoad, 0) / prevCharges.length)
      : null;
    const trend = avgCharge && prevAvg ? Math.round(((avgCharge - prevAvg) / prevAvg) * 100) : null;

    // Athlètes actifs (avec données de charge cette semaine)
    const actifs = currentCharges.length;

    // Alertes non lues
    const unreadAlerts = alerts.filter(a => !a.is_read).length;

    // Taux de validation cette semaine
    const weekSessions = sessions.filter(s => s.week === currentWeek);
    const totalExpected = weekSessions.reduce((s, sess) => s + sess.athleteIds.length, 0);
    const totalDone = weekSessions.reduce((s, sess) =>
      s + (sess.validations?.filter(v => v.status === "done").length ?? 0), 0);
    const validationRate = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : null;

    // Athlètes en surcharge (ACWR > 1.3)
    const overloaded = athletes.filter(a => {
      const m = getAthleteMetricsForWeek(a.id, weeklyCharge, currentWeek);
      return m.acwr > 1.3;
    });

    // Athlètes blessés
    const injured = [...new Set(injuries.map(i => i.athleteId))].length;

    // Séances athlètes non validées par le coach
    const pendingAthleteSession = sessions.filter(s => s.createdByAthlete).length;

    return { avgCharge, trend, actifs, unreadAlerts, validationRate, overloaded, injured, pendingAthleteSession };
  }, [athletes, weeklyCharge, sessions, alerts, injuries, currentWeek]);

  // Feedbacks récents
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
    return results
      .filter(f => f.validation.feeling || f.validation.comment)
      .slice(0, 5);
  }, [sessions, athletes]);

  const firstName = profile?.name?.split(" ")[0] ?? "Coach";

  if (loading) return <LoadingState message="Chargement du dashboard…"/>;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll}/>;

  return (
    <div className="p-4 md:p-5 space-y-4 md:space-y-5 max-w-7xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">
            Bonjour, {firstName} 👋
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {today.toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
            {" · "}Semaine {currentWeek}
          </p>
        </div>
        {metrics.pendingAthleteSession > 0 && (
          <button onClick={() => onNavigate("planning")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-[12px] font-semibold hover:bg-purple-100 transition-colors">
            📋 {metrics.pendingAthleteSession} séance{metrics.pendingAthleteSession>1?"s":""} proposée{metrics.pendingAthleteSession>1?"s":""} par les athlètes
            <ChevronRight size={14}/>
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Users}       label="Athlètes actifs"   value={metrics.actifs}        sub={`/${athletes.length} total`}                                  color="#1D9E75"  onClick={() => onNavigate("athletes")}/>
        <MetricCard icon={Zap}         label="Charge moyenne"    value={metrics.avgCharge ?? "—"} sub={metrics.trend != null ? `${metrics.trend > 0 ? "+" : ""}${metrics.trend}% vs S-1` : "pas de données"} color="#378ADD" badge={metrics.trend > 20 ? { label: "↑ Élevée", color: "#E24B4A" } : metrics.trend < -20 ? { label: "↓ Baisse", color: "#378ADD" } : undefined}/>
        <MetricCard icon={Bell}        label="Alertes non lues"  value={metrics.unreadAlerts}  sub="à traiter"                                                    color="#E24B4A"  onClick={() => onNavigate("alerts")}/>
        <MetricCard icon={CheckCircle} label="Taux de validation" value={metrics.validationRate != null ? `${metrics.validationRate}%` : "—"} sub="séances cette semaine" color="#EF9F27"/>
      </div>

      {/* ── Alertes groupe ── */}
      {(metrics.overloaded.length > 0 || metrics.injured > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.overloaded.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Activity size={16} color="#E24B4A"/>
              </div>
              <div>
                <p className="text-[13px] font-bold text-red-800">
                  {metrics.overloaded.length} athlète{metrics.overloaded.length>1?"s":""} en surcharge (ACWR &gt; 1.3)
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  {metrics.overloaded.map(a => a.name.split(" ")[0]).join(", ")}
                </p>
              </div>
            </div>
          )}
          {metrics.injured > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <HeartPulse size={16} color="#EF9F27"/>
              </div>
              <div>
                <p className="text-[13px] font-bold text-amber-800">
                  {metrics.injured} athlète{metrics.injured>1?"s":""} blessé{metrics.injured>1?"s":""}
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {[...new Set(injuries.map(i => i.athleteId))].map(id => athletes.find(a=>a.id===id)?.name?.split(" ")[0]).filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── État de forme du groupe ── */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-slate-800">État du groupe — S{currentWeek}</h3>
            <button onClick={() => onNavigate("charge")} className="text-[11.5px] font-semibold text-emerald-600">Voir →</button>
          </div>
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
        </div>

        {/* ── Colonne droite ── */}
        <div className="space-y-4">

          {/* Prochaines compétitions */}
          {competitions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Prochaines compétitions</h3>
                <button onClick={() => onNavigate("competitions")} className="text-[11px] font-semibold text-emerald-600">Voir tout →</button>
              </div>
              <div className="divide-y divide-slate-50">
                {competitions.map(c => {
                  const days = Math.round((new Date(c.date) - today) / (1000*60*60*24));
                  return (
                    <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Trophy size={14} color="#E24B4A"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10.5px] text-slate-400">
                          {new Date(c.date).toLocaleDateString("fr-BE",{day:"numeric",month:"short"})}
                          {" · "}{c.athleteIds.length} athlète{c.athleteIds.length>1?"s":""}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: days <= 7 ? "#FFF1F2" : "#F0FDF4", color: days <= 7 ? "#E24B4A" : "#1D9E75" }}>
                        {days === 0 ? "Auj." : `J-${days}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objectifs en cours */}
          {goals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Objectifs saison</h3>
                <span className="text-[11px] text-slate-400">{goals.length} actif{goals.length>1?"s":""}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {goals.slice(0, 5).map(g => {
                  const athlete = athletes.find(a => a.id === g.athlete_id);
                  const daysLeft = g.deadline ? Math.round((new Date(g.deadline)-today)/(1000*60*60*24)) : null;
                  return (
                    <div key={g.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Target size={14} color="#1D9E75"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-bold text-slate-700">{athlete?.name?.split(" ")[0] ?? "?"}</p>
                          <span className="text-[10px] text-slate-400">·</span>
                          <p className="text-[11px] text-slate-500">{g.discipline}</p>
                        </div>
                        <p className="text-[13px] font-black text-emerald-600">{g.target_value}</p>
                      </div>
                      {daysLeft !== null && (
                        <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-[14px] font-bold text-slate-800">Feedbacks récents</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {recentFeedbacks.map(({ session, validation, athlete }, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: "#1D9E75" }}>
                      {initialsFromName(athlete.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[12px] font-semibold text-slate-700">{athlete.name.split(" ")[0]}</span>
                        <span className="text-[10.5px] text-slate-400">{session.title}</span>
                        <ValidationBadge status={validation.status}/>
                      </div>
                      {validation.feeling != null && (
                        <div className="flex items-center gap-0.5 mb-0.5">
                          {Array.from({length:5}).map((_,j) => (
                            <Star key={j} size={10} fill={j<validation.feeling?"#EF9F27":"none"} color={j<validation.feeling?"#EF9F27":"#e2e8f0"}/>
                          ))}
                        </div>
                      )}
                      {validation.comment && (
                        <p className="text-[11px] text-slate-400 truncate italic">« {validation.comment} »</p>
                      )}
                    </div>
                    {validation.rpe != null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                        RPE {validation.rpe}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(Dashboard);