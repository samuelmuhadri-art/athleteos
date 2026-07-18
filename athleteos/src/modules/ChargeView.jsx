// ============================================================
// AthleteOS — src/modules/ChargeView.jsx
// Version nettoyée Phase 2 :
// - useAuth() remplace .eq("club_id", 1)
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : charge scientifique session-RPE,
// ACWR, fatigue, breakdown par catégorie, analyse automatique.
// ============================================================

import { memo, useMemo, useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import {
  Activity, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Zap, BarChart2, BookOpen, ChevronDown,
} from "lucide-react";
import { supabase }          from "../utils/supabaseClient";
import { useAuth }           from "../context/AuthContext";
import LoadingState          from "../components/ui/LoadingState";
import ErrorState            from "../components/ui/ErrorState";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import {
  computeAllWeeklyLoads,
  computeWeeklyLoadByCategory,
} from "../utils/trainingLoad";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATHLETE_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

const CATEGORY_STYLE = {
  sprint:       { border: "#3B82F6", label: "Sprint"        },
  haies:        { border: "#7C3AED", label: "Haies"         },
  force:        { border: "#16A34A", label: "Musculation"   },
  saut:         { border: "#A855F7", label: "Saut"          },
  lancer:       { border: "#F97316", label: "Lancer"        },
  endurance:    { border: "#0284C7", label: "Endurance"     },
  technique:    { border: "#64748B", label: "Technique"     },
  mobilite:     { border: "#CA8A04", label: "Mobilité"      },
  recuperation: { border: "#CBD5E1", label: "Récupération"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 60 * 60 * 1000));
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function blockColors(category) {
  return CATEGORY_STYLE[category] ?? { border: "#94A3B8", label: category };
}

function getRawLoad(weeklyCharge, athleteId, week) {
  return weeklyCharge.find((w) => w.athleteId === athleteId && w.week === week)?.rawLoad ?? 0;
}

function chargeColor(rawLoad) {
  if (rawLoad >= 450) return "#E24B4A";
  if (rawLoad >= 320) return "#EF9F27";
  return "#1D9E75";
}

function chargeLabel(rawLoad) {
  if (rawLoad >= 450) return { dot: "🔴", label: "Surcharge",  cls: "bg-red-50 text-red-700"         };
  if (rawLoad >= 320) return { dot: "🟡", label: "Modéré",     cls: "bg-amber-50 text-amber-700"     };
  return                     { dot: "🟢", label: "Optimal",    cls: "bg-emerald-50 text-emerald-700" };
}

function computeGroupACWRSeries(athletes, weeklyCharge) {
  const allWeeks = [...new Set(weeklyCharge.map((w) => w.week))].sort((a, b) => a - b);
  return allWeeks.map((week) => {
    const point = { label: `S${week}` };
    athletes.forEach((a) => {
      const metrics = getAthleteMetricsForWeek(a.id, weeklyCharge, week);
      point[a.name.split(" ")[0]] = metrics.acwr;
    });
    return point;
  });
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-[12px] max-w-[200px]">
      <p className="font-bold text-slate-600 mb-2">{label}</p>
      {payload
        .filter((p) => p.value !== undefined)
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <p key={p.dataKey} className="flex items-center justify-between gap-3">
            <span style={{ color: p.color }}>{p.dataKey}</span>
            <strong style={{ color: p.color }}>{Number(p.value).toFixed(2)}</strong>
          </p>
        ))}
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-[12px]">
      <p className="font-bold text-slate-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const MetricCard = memo(({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon size={16} color={color} strokeWidth={2} />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-[28px] font-bold text-slate-800 leading-none">{value}</span>
      {sub && <span className="text-[12px] text-slate-400 mb-0.5">{sub}</span>}
    </div>
    {trend !== undefined && trend !== null && (
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        {trend > 0 ? <TrendingUp size={12} color="#E24B4A" /> :
         trend < 0 ? <TrendingDown size={12} color="#1D9E75" /> :
         <Minus size={12} />}
        <span>{trend > 0 ? `+${trend}` : trend} vs semaine précédente</span>
      </div>
    )}
  </div>
));

const MethodologyPanel = memo(() => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
          <BookOpen size={14} className="text-slate-400" />
          Méthode de calcul de la charge — session-RPE
        </span>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-[11.5px] text-slate-500 leading-relaxed space-y-2 border-t border-slate-50">
          <p>
            La charge de chaque séance est calculée selon la méthode <strong>session-RPE</strong> :
            {" "}<code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Durée (min) × RPE (0–10)</code>,
            où le RPE est le ressenti d'effort de l'athlète noté juste après la séance
            (échelle de Borg CR10). Un coefficient par catégorie de séance ajuste ensuite cette valeur.
          </p>
          <p className="text-slate-400">
            <strong>Références :</strong> Foster C. et al. (2001), <em>"A New Approach to Monitoring Exercise Training"</em>,
            Journal of Strength and Conditioning Research, 15(1) · Foster C. (1998), Medicine & Science in Sports & Exercise,
            30(7) · Borg G. (1998), Borg's Perceived Exertion and Pain Scales, Human Kinetics.
          </p>
          <p className="text-slate-400 italic">
            Les coefficients par catégorie (ex : musculation ×1.3, technique ×0.7) sont un paramètre
            d'ajustement pratique courant en planification sportive — calibrable par le coach.
          </p>
        </div>
      )}
    </div>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────
function ChargeView() {
  const { clubId } = useAuth();
  const CURRENT_WEEK = useMemo(() => getISOWeek(new Date()), []);

  const [athletes,             setAthletes]             = useState([]);
  const [weeklyCharge,         setWeeklyCharge]         = useState([]);
  const [sessionsForBreakdown, setSessionsForBreakdown] = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);
  const [highlightedAthlete,   setHighlightedAthlete]   = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const athletesRes = await supabase
        .from("athletes")
        .select("id, name, main_discipline, profile_data")
        .eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const sessionsRes = await supabase
        .from("sessions")
        .select("id, week, category, duration_minutes")
        .eq("club_id", clubId);
      if (sessionsRes.error) throw sessionsRes.error;

      const sessionIds = sessionsRes.data.map((s) => s.id);
      const sessionAthletesRes = sessionIds.length
        ? await supabase.from("session_athletes").select("session_id, athlete_id, rpe").in("session_id", sessionIds)
        : { data: [], error: null };
      if (sessionAthletesRes.error) throw sessionAthletesRes.error;

      const remappedAthletes = athletesRes.data.map((a) => ({
        id:             a.id,
        name:           a.name,
        mainDiscipline: a.main_discipline,
        avatar:         a.profile_data?.avatar ?? initialsFromName(a.name),
      }));

      const enrichedSessions = sessionsRes.data.map((s) => {
        const rows = sessionAthletesRes.data.filter((r) => r.session_id === s.id);
        return {
          id:              s.id,
          week:            s.week,
          category:        s.category,
          durationMinutes: s.duration_minutes,
          athleteIds:      rows.map((r) => r.athlete_id),
          validations:     rows.map((r) => ({ athleteId: r.athlete_id, rpe: r.rpe })),
        };
      });

      setAthletes(remappedAthletes);
      setWeeklyCharge(computeAllWeeklyLoads(remappedAthletes, enrichedSessions));
      setSessionsForBreakdown(enrichedSessions);
    } catch (err) {
      console.error("ChargeView — chargement :", err);
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Calculs dérivés ══════════════════════════════════════════════════════
  const allMetrics = useMemo(() =>
    athletes.map((a) => ({
      athlete: a,
      metrics: getAthleteMetricsForWeek(a.id, weeklyCharge, CURRENT_WEEK),
      rawLoad: getRawLoad(weeklyCharge, a.id, CURRENT_WEEK),
    })),
  [athletes, weeklyCharge, CURRENT_WEEK]);

  const hasAnyCharge = weeklyCharge.length > 0;

  const globalMetrics = useMemo(() => {
    if (!allMetrics.length) return { avgLoad: 0, avgACWR: 0, topLoader: null, critFatigue: 0, trendLoad: 0 };
    const avgLoad      = Math.round(allMetrics.reduce((s, m) => s + m.rawLoad, 0) / allMetrics.length);
    const avgACWR      = Math.round((allMetrics.reduce((s, m) => s + m.metrics.acwr, 0) / allMetrics.length) * 100) / 100;
    const topLoader    = [...allMetrics].sort((a, b) => b.rawLoad - a.rawLoad)[0];
    const critFatigue  = allMetrics.filter((m) => m.metrics.fatigue > 70).length;
    const avgLoadPrev  = athletes.length
      ? Math.round(athletes.reduce((s, a) => s + getRawLoad(weeklyCharge, a.id, CURRENT_WEEK - 1), 0) / athletes.length)
      : 0;
    return { avgLoad, avgACWR, topLoader, critFatigue, trendLoad: avgLoad - avgLoadPrev };
  }, [allMetrics, athletes, weeklyCharge, CURRENT_WEEK]);

  const acwrSeries       = useMemo(() => computeGroupACWRSeries(athletes, weeklyCharge), [athletes, weeklyCharge]);
  const fatigueAlerts    = useMemo(() => allMetrics.filter((m) => m.metrics.fatigue > 75), [allMetrics]);
  const acwrAlerts       = useMemo(() => allMetrics.filter((m) => m.metrics.acwr > 1.3), [allMetrics]);
  const sortedByLoad     = useMemo(() => [...allMetrics].sort((a, b) => b.rawLoad - a.rawLoad), [allMetrics]);
  const maxLoad          = sortedByLoad[0]?.rawLoad ?? 1;

  const chargeBreakdown = useMemo(() => {
    const byCategory  = computeWeeklyLoadByCategory(athletes, sessionsForBreakdown);
    const allWeeks    = [...new Set(byCategory.map((b) => b.week))].sort((a, b) => a - b).slice(-6);
    const allCategories = [...new Set(byCategory.map((b) => b.category))];
    return allWeeks.map((week) => {
      const point = { label: `S${week}` };
      allCategories.forEach((cat) => {
        point[cat] = byCategory.find((b) => b.week === week && b.category === cat)?.total ?? 0;
      });
      return point;
    });
  }, [athletes, sessionsForBreakdown]);

  const breakdownCategories = useMemo(
    () => [...new Set(computeWeeklyLoadByCategory(athletes, sessionsForBreakdown).map((b) => b.category))],
    [athletes, sessionsForBreakdown]
  );

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement charge & fatigue…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      <div>
        <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Charge & Fatigue</h2>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Semaine {CURRENT_WEEK} · Analyse dynamique du groupe · {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
        </p>
      </div>

      <MethodologyPanel />

      {!hasAnyCharge ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <BarChart2 size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-[15px] font-semibold text-slate-400">Aucune charge calculable pour l'instant</p>
          <p className="text-[12px] text-slate-300 mt-1 max-w-sm mx-auto">
            La charge se calcule automatiquement dès qu'une séance a une durée renseignée
            et qu'un athlète a noté son RPE dans <strong>Planning</strong>.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPIs globaux ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={BarChart2}   label="Charge moyenne groupe"  value={globalMetrics.avgLoad}              sub="unités"                                color="#378ADD" trend={globalMetrics.trendLoad} />
            <MetricCard icon={Activity}    label="ACWR moyen groupe"      value={globalMetrics.avgACWR.toFixed(2)}   color={globalMetrics.avgACWR > 1.3 ? "#E24B4A" : globalMetrics.avgACWR < 0.8 ? "#378ADD" : "#1D9E75"} />
            <MetricCard icon={Zap}         label="Athlète le + chargé"    value={globalMetrics.topLoader?.athlete.name.split(" ")[0] ?? "—"} sub={`${globalMetrics.topLoader?.rawLoad ?? 0} u`} color="#EF9F27" />
            <MetricCard icon={AlertTriangle} label="Fatigue critique (>75)" value={globalMetrics.critFatigue}        sub={`athlète${globalMetrics.critFatigue > 1 ? "s" : ""}`} color={globalMetrics.critFatigue > 0 ? "#E24B4A" : "#1D9E75"} />
          </div>

          {/* ── Tableau charge par athlète ───────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-700">Charge calculée — Semaine {CURRENT_WEEK}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Triée par charge décroissante · Basée sur durée × RPE</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[
                  { color: "#1D9E75", label: "Optimal (< 320)"   },
                  { color: "#EF9F27", label: "Modéré (320–449)"  },
                  { color: "#E24B4A", label: "Surcharge (≥ 450)" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {sortedByLoad.every((m) => m.rawLoad === 0) ? (
              <div className="px-5 py-10 text-center text-slate-300 text-[13px]">
                Aucun RPE renseigné pour la semaine {CURRENT_WEEK} — va dans Planning pour en saisir un.
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {sortedByLoad.map(({ athlete, metrics, rawLoad }, i) => {
                  const badge      = chargeLabel(rawLoad);
                  const pct        = maxLoad > 0 ? (rawLoad / maxLoad) * 100 : 0;
                  const color      = chargeColor(rawLoad);
                  const isHL       = highlightedAthlete === athlete.id || highlightedAthlete === null;
                  const colorIdx   = athletes.findIndex((a) => a.id === athlete.id) % ATHLETE_COLORS.length;

                  return (
                    <div
                      key={athlete.id}
                      className="flex items-center gap-4 cursor-pointer"
                      onMouseEnter={() => setHighlightedAthlete(athlete.id)}
                      onMouseLeave={() => setHighlightedAthlete(null)}
                      style={{ opacity: isHL ? 1 : 0.4, transition: "opacity 0.15s" }}
                    >
                      <span className="text-[11px] font-bold text-slate-300 w-4 flex-shrink-0 text-right">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: ATHLETE_COLORS[colorIdx] }}>
                        {athlete.avatar}
                      </div>
                      <div className="w-32 flex-shrink-0">
                        <p className="text-[13px] font-semibold text-slate-700 truncate">{athlete.name.split(" ")[0]}</p>
                        <p className="text-[10px] text-slate-400 truncate">{athlete.mainDiscipline ?? "—"}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-[13px] font-bold w-10 text-right" style={{ color }}>{rawLoad}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                        {badge.dot} {badge.label}
                      </span>
                      <div className="w-16 text-right flex-shrink-0">
                        <p className="text-[12px] font-bold" style={{ color: metrics.acwr > 1.3 ? "#E24B4A" : metrics.acwr < 0.8 ? "#378ADD" : "#1D9E75" }}>
                          {metrics.acwr.toFixed(2)}
                        </p>
                        <p className="text-[9px] text-slate-400">ACWR</p>
                      </div>
                      <div className="w-16 text-right flex-shrink-0">
                        <p className="text-[12px] font-bold" style={{ color: metrics.fatigue > 70 ? "#E24B4A" : metrics.fatigue > 45 ? "#EF9F27" : "#1D9E75" }}>
                          {metrics.fatigue}
                        </p>
                        <p className="text-[9px] text-slate-400">Fatigue</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Courbes ACWR ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-slate-700">Évolution ACWR du groupe</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Une courbe par athlète · Zone optimale : 0.80 – 1.30 · Danger : &gt; 1.50
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              {athletes.map((a, i) => (
                <button
                  key={a.id}
                  onMouseEnter={() => setHighlightedAthlete(a.id)}
                  onMouseLeave={() => setHighlightedAthlete(null)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: highlightedAthlete === a.id ? `${ATHLETE_COLORS[i % ATHLETE_COLORS.length]}18` : "transparent",
                    color: ATHLETE_COLORS[i % ATHLETE_COLORS.length],
                    border: `1.5px solid ${ATHLETE_COLORS[i % ATHLETE_COLORS.length]}`,
                    opacity: highlightedAthlete && highlightedAthlete !== a.id ? 0.35 : 1,
                  }}
                >
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }} />
                  {a.name.split(" ")[0]}
                </button>
              ))}
            </div>
            {acwrSeries.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-300 text-[13px]">
                Pas encore assez de données pour tracer l'évolution
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={acwrSeries} margin={{ right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0.4, 1.8]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0.8} stroke="#1D9E75" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: "0.80", position: "right", fontSize: 9, fill: "#1D9E75" }} />
                    <ReferenceLine y={1.3} stroke="#EF9F27" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: "1.30", position: "right", fontSize: 9, fill: "#EF9F27" }} />
                    <ReferenceLine y={1.5} stroke="#E24B4A" strokeDasharray="3 2" strokeWidth={2}   label={{ value: "1.50 ⚠", position: "right", fontSize: 9, fill: "#E24B4A" }} />
                    {athletes.map((a, i) => {
                      const prenom = a.name.split(" ")[0];
                      const isHL   = highlightedAthlete === null || highlightedAthlete === a.id;
                      return (
                        <Line key={a.id} dataKey={prenom} name={prenom}
                          stroke={ATHLETE_COLORS[i % ATHLETE_COLORS.length]}
                          strokeWidth={isHL ? 2.5 : 1}
                          dot={isHL ? { r: 3, fill: ATHLETE_COLORS[i % ATHLETE_COLORS.length] } : false}
                          activeDot={{ r: 5 }} opacity={isHL ? 1 : 0.2} connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3 text-[10px] flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="w-8 h-0.5 inline-block rounded" style={{ background: "#1D9E75", borderTop: "2px dashed #1D9E75" }} /><span className="text-slate-500">0.80 — Seuil bas</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-8 h-0.5 inline-block rounded" style={{ background: "#EF9F27", borderTop: "2px dashed #EF9F27" }} /><span className="text-slate-500">1.30 — Seuil haut</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-8 h-0.5 inline-block rounded" style={{ background: "#E24B4A" }} /><span className="text-slate-500">1.50 — Zone de danger</span></span>
                </div>
              </>
            )}
          </div>

          {/* ── Breakdown catégories ─────────────────────────────────── */}
          {chargeBreakdown.length > 0 && breakdownCategories.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="mb-4">
                <h3 className="text-[14px] font-semibold text-slate-700">Répartition des types de charge — Groupe</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  6 dernières semaines · Calculé à partir des vraies séances (durée × RPE)
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chargeBreakdown}>
                  <defs>
                    {breakdownCategories.map((cat) => {
                      const color = blockColors(cat).border;
                      return (
                        <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={color} stopOpacity={0.7} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.2} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} formatter={(v) => <span style={{ color: "#64748b" }}>{blockColors(v).label ?? v}</span>} />
                  {breakdownCategories.map((cat) => (
                    <Area key={cat} dataKey={cat} name={blockColors(cat).label ?? cat} stackId="1"
                      stroke={blockColors(cat).border} fill={`url(#grad-${cat})`} strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Alertes automatiques ─────────────────────────────────── */}
          {(fatigueAlerts.length > 0 || acwrAlerts.length > 0) && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} color="#EF9F27" />
                <h3 className="text-[14px] font-semibold text-slate-700">Signaux d'alerte automatiques</h3>
              </div>
              <div className="space-y-2">
                {fatigueAlerts.map(({ athlete, metrics }) => (
                  <div key={`f-${athlete.id}`} className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-2.5">
                    <AlertTriangle size={14} color="#E24B4A" />
                    <span className="text-[12px] text-red-700">
                      <strong>{athlete.name.split(" ")[0]}</strong> — Fatigue élevée ({metrics.fatigue}/100)
                    </span>
                  </div>
                ))}
                {acwrAlerts.map(({ athlete, metrics }) => (
                  <div key={`a-${athlete.id}`} className="flex items-center gap-3 bg-amber-50 rounded-lg px-4 py-2.5">
                    <Activity size={14} color="#EF9F27" />
                    <span className="text-[12px] text-amber-700">
                      <strong>{athlete.name.split(" ")[0]}</strong> — ACWR élevé ({metrics.acwr.toFixed(2)}) — risque de blessure accru
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default memo(ChargeView);