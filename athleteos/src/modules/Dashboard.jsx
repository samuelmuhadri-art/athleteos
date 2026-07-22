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
import {
  Users, Zap, Bell, CheckCircle, Activity,
  Trophy, Star, ChevronRight, HeartPulse, Target,
  BarChart2, ArrowUpRight,
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

// Système sémantique : couleur = dimension mesurée, pas le statut.
// Vert → forme/récup | Bleu → charge/ACWR | Ambre → fatigue/alerte | Rouge → danger
function dimColor(metric, val) {
  switch (metric) {
    case "readiness":
    case "recuperation":
    case "forme":
      if (val >= 75) return "#1D9E75";
      if (val >= 50) return "#EF9F27";
      return "#E24B4A";
    case "fatigue":
      if (val > 70) return "#E24B4A";
      if (val > 45) return "#EF9F27";
      return "rgba(239,159,39,0.45)";
    case "acwr":
      if (val > 1.5) return "#E24B4A";
      if (val > 1.3) return "#EF9F27";
      return "#378ADD";
    default:
      return "#94A3B8";
  }
}

// Conservées pour compatibilité avec d'éventuels appels existants ailleurs
function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}
function acwrColor(v) {
  if (v > 1.5) return "#E24B4A";
  if (v > 1.3) return "#EF9F27";
  return "#378ADD";
}

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
              className="mb-0.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: badge.color }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.09em] mt-1">
          {label}
        </p>
        {sub && (
          <p className="text-[10.5px] text-slate-300 mt-0.5 font-medium">{sub}</p>
        )}
      </div>

      {onClick && (
        <ArrowUpRight size={14} className="text-slate-200 flex-shrink-0" />
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
function AthleteStatusCard({ athlete, weeklyCharge, currentWeek, injuries, sessions, onNavigate }) {
  const metrics   = useMemo(
    () => getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek),
    [athlete.id, weeklyCharge, currentWeek]
  );
  const status    = getStatusLabel(metrics.readiness, metrics.fatigue, metrics.acwr);
  const activeInj = (injuries ?? []).filter(i => i.athleteId === athlete.id && i.status !== "résolu");
  const weekSess  = sessions.filter(s => s.week === currentWeek && s.athleteIds?.includes(athlete.id));
  const doneCount = weekSess.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;
  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  const readColor = dimColor("readiness", metrics.readiness);
  const acwrCol   = dimColor("acwr", metrics.acwr);
  const fatCol    = dimColor("fatigue", metrics.fatigue);

  return (
    <div
      className="card card-hover tap-feedback p-3.5 flex flex-col gap-2.5 cursor-pointer"
      onClick={() => onNavigate("athletes")}
    >
      {/* Header avec avatar en dégradé */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%)` }}
        >
          {initialsFromName(athlete.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">
            {athlete.name.split(" ")[0]}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{athlete.mainDiscipline ?? "—"}</p>
        </div>
        {/* Dot statut */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: status.color, boxShadow: `0 0 5px ${status.color}` }}
        />
      </div>

      {/* Métriques — 3 valeurs + mini barres */}
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { lbl: "Ready",   val: metrics.readiness,       col: readColor, pct: metrics.readiness },
            { lbl: "ACWR",    val: metrics.acwr.toFixed(2), col: acwrCol,   pct: Math.min(100, (metrics.acwr / 2) * 100) },
            { lbl: "Fatigue", val: metrics.fatigue,         col: fatCol,    pct: metrics.fatigue },
          ].map(s => (
            <div key={s.lbl} className="bg-slate-50 rounded-xl px-1.5 py-2 text-center">
              <p
                className="text-[14px] font-bold leading-none"
                style={{ color: s.col, fontVariantNumeric: "tabular-nums" }}
              >
                {s.val}
              </p>
              <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                {s.lbl}
              </p>
              <div className="mt-1.5 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, s.pct)}%`, background: s.col, opacity: 0.75 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-slate-300 font-medium">Pas encore de données</p>
        </div>
      )}

      {/* Badges blessure / séances */}
      {(activeInj.length > 0 || weekSess.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeInj.length > 0 && (
            <span className="flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <HeartPulse size={8} /> {activeInj.length} blessure{activeInj.length > 1 ? "s" : ""}
            </span>
          )}
          {weekSess.length > 0 && (
            <span className="flex items-center gap-1 text-[9.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
              <CheckCircle size={9} /> {doneCount}/{weekSess.length}
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

  // ═══ Chargement (identique à l'original — aucune requête modifiée) ═════════
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

      {/* ── Hero greeting — fond sombre cohérent avec l'espace athlète ─────── */}
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
          {/* Ligne identité */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="text-white/35 text-[9.5px] font-bold uppercase tracking-[0.15em] mb-1">
                {today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h2 className="text-[20px] md:text-[22px] font-bold text-white tracking-tight leading-tight">
                {getGreeting()}, {firstName}
              </h2>
              <p className="text-white/35 text-[11px] font-medium mt-1">
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
                label: `Actifs S${currentWeek}`,
                value: `${metrics.actifs}/${athletes.length}`,
                color: "#1D9E75",
              },
              {
                label: "Charge moy.",
                value: metrics.avgCharge ?? "—",
                color: "#378ADD",
                sub: metrics.trend != null
                  ? `${metrics.trend > 0 ? "+" : ""}${metrics.trend}% vs S-1`
                  : null,
              },
              {
                label: "Validation",
                value: metrics.validationRate != null ? `${metrics.validationRate}%` : "—",
                color: metrics.validationRate != null && metrics.validationRate < 60 ? "#EF9F27" : "#1D9E75",
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
                <p className="text-[8.5px] font-bold text-white/25 uppercase tracking-[0.09em] mt-1.5">
                  {s.label}
                </p>
                {s.sub && (
                  <p className="text-[9px] text-white/20 mt-0.5">{s.sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alertes critiques groupe — bordure épaisse 4px ─────────────────── */}
      {(metrics.overloaded.length > 0 || metrics.injured > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.overloaded.length > 0 && (
            <div className="card p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: "#E24B4A" }}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(226,75,74,0.08)" }}
              >
                <Activity size={16} color="#E24B4A" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">
                  {metrics.overloaded.length} en surcharge · ACWR &gt; 1.3
                </p>
                <p className="text-[11.5px] text-slate-400 mt-0.5 font-medium">
                  {metrics.overloaded.map(a => a.name.split(" ")[0]).join(", ")}
                </p>
              </div>
            </div>
          )}
          {metrics.injured > 0 && (
            <div className="card p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: "#EF9F27" }}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(239,159,39,0.08)" }}
              >
                <HeartPulse size={16} color="#EF9F27" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">
                  {metrics.injured} athlète{metrics.injured > 1 ? "s" : ""} blessé{metrics.injured > 1 ? "s" : ""}
                </p>
                <p className="text-[11.5px] text-slate-400 mt-0.5 font-medium">
                  {[...new Set(injuries.map(i => i.athleteId))]
                    .map(id => athletes.find(a => a.id === id)?.name?.split(" ")[0])
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs — icône + liseré + glow au survol ────────────────────────── */}
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
              <h3 className="text-[15px] font-semibold text-slate-800 tracking-tight">
                État du groupe
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
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
                <h3 className="text-[14px] font-semibold text-slate-800">Compétitions</h3>
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
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isUrgent ? "rgba(226,75,74,0.08)" : "rgba(29,158,117,0.08)" }}
                      >
                        <Trophy size={15} color={isUrgent ? "#E24B4A" : "#1D9E75"} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {new Date(c.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                          {" · "}{c.athleteIds.length} athlète{c.athleteIds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-xl flex-shrink-0"
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
                <h3 className="text-[14px] font-semibold text-slate-800">Objectifs saison</h3>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full chip chip-success">
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
                        <Target size={15} color="#1D9E75" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[12px] font-semibold text-slate-700">{athlete?.name?.split(" ")[0] ?? "?"}</p>
                          <span className="text-slate-300 text-[10px]">·</span>
                          <p className="text-[11px] text-slate-500 truncate">{g.discipline}</p>
                        </div>
                        <p className="text-[15px] font-bold text-emerald-600 leading-tight">{g.target_value}</p>
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
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-[14px] font-semibold text-slate-800">Feedbacks récents</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{recentFeedbacks.length} retour{recentFeedbacks.length > 1 ? "s" : ""} athlète</p>
              </div>
              <div className="divide-y divide-slate-50">
                {recentFeedbacks.map(({ session, validation, athlete }, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                    {/* Avatar avec dégradé */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}
                    >
                      {initialsFromName(athlete.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[12px] font-semibold text-slate-700">{athlete.name.split(" ")[0]}</span>
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