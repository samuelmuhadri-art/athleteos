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
  CartesianGrid, Legend,
} from "recharts";
import {
  Activity, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Zap, BarChart2, BookOpen, ChevronDown, CheckCircle,
} from "lucide-react";
import { supabase }          from "../utils/supabaseClient";
import { useAuth }           from "../context/AuthContext";
import LoadingState          from "../components/ui/LoadingState";
import ErrorState            from "../components/ui/ErrorState";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { computeWeeklyLoadByCategory } from "../utils/trainingLoad";
import { getISOWeek, initialsFromName } from "../utils/helpers.js";

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

function blockColors(category) {
  return CATEGORY_STYLE[category] ?? { border: "#94A3B8", label: category };
}

function getRawLoad(weeklyCharge, athleteId, week) {
  return weeklyCharge.find((w) => w.athleteId === athleteId && w.week === week)?.rawLoad ?? 0;
}

function chargeColor(rawLoad) {
  return rawLoad > 0 ? "#378ADD" : "#64748B";
}

function chargeLabel(rawLoad) {
  return rawLoad > 0
    ? { dot: "●", label: "Observée", cls: "bg-[rgba(55,138,221,0.15)] text-[#A9CBFB]" }
    : { dot: "○", label: "Aucune", cls: "bg-[rgba(100,116,139,0.15)] text-[#94A3B8]" };
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
    <div className="rounded-xl px-3 py-2.5 text-[12px] max-w-[200px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-bold mb-2" style={{ color: "var(--c-text-1)" }}>{label}</p>
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
    <div className="rounded-xl px-3 py-2.5 text-[12px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-bold mb-1" style={{ color: "var(--c-text-1)" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const MetricCard = memo(({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="card p-5 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <span className="meta-text font-semibold uppercase tracking-wide leading-snug">{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={16} color={color} strokeWidth={2} />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-[28px] font-bold leading-none" style={{ color: "var(--c-text-1)" }}>{value}</span>
      {sub && <span className="text-[12px] mb-0.5" style={{ color: "var(--c-text-3)" }}>{sub}</span>}
    </div>
    {trend !== undefined && trend !== null && (
      <div className="flex items-center gap-1 text-[12px]" style={{ color: "var(--c-text-2)" }}>
        {trend > 0 ? <TrendingUp size={12} color="#E24B4A" /> :
         trend < 0 ? <TrendingDown size={12} color="#1D9E75" /> :
         <Minus size={12} />}
        <span>{trend > 0 ? `+${trend}` : trend} vs semaine précédente</span>
      </div>
    )}
  </div>
));

const AlertSignals = memo(({ fatigueAlerts }) => {
  const signalCount = fatigueAlerts.length;
  return (
    <section className="card overflow-hidden" aria-labelledby="charge-signals-title">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--c-border)" }}>
        <div>
          <h3 id="charge-signals-title" className="card-title">À examiner aujourd'hui</h3>
          <p className="card-subtitle">Signaux automatiques à confirmer avec l'athlète.</p>
        </div>
        {signalCount > 0 && (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full chip chip-warning">
            {signalCount} signal{signalCount > 1 ? "aux" : ""}
          </span>
        )}
      </div>

      {signalCount === 0 ? (
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.12)" }}>
            <CheckCircle size={17} color="#1D9E75" />
          </div>
          <p className="text-[13px] font-medium" style={{ color: "var(--c-text-2)" }}>
            Aucun questionnaire de bien-être faible à examiner aujourd'hui.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {fatigueAlerts.map(({ athlete, metrics }) => (
            <div key={`f-${athlete.id}`} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.20)" }}>
              <AlertTriangle size={15} color="#E24B4A" className="flex-shrink-0" />
              <span className="text-[12px]" style={{ color: "#F19A9A" }}>
                <strong>{athlete.name.split(" ")[0]}</strong> — bien-être déclaré faible ({metrics.wellnessScore ?? "—"}/100). À contextualiser avec l'athlète.
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

const MethodologyPanel = memo(() => {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="charge-methodology-content"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--c-surface-3)] transition-colors"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--c-text-2)" }}>
          <BookOpen size={14} style={{ color: "var(--c-text-3)" }} />
          Méthode de calcul de la charge — session-RPE
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--c-text-3)" }} />
      </button>
      {open && (
        <div id="charge-methodology-content" className="px-5 pb-5 pt-3 text-[12px] leading-relaxed space-y-2 border-t" style={{ color: "var(--c-text-2)", borderColor: "var(--c-border)" }}>
          <p>
            La charge de chaque séance est calculée selon la méthode <strong>session-RPE</strong> :
            {" "}<code className="px-1.5 py-0.5 rounded text-[12px]" style={{ background: "var(--c-surface-3)" }}>Durée (min) × RPE (0–10)</code>,
            où la durée est celle réellement effectuée et le RPE le ressenti d'effort de l'athlète
            (échelle CR10). Aucun coefficient de discipline ne modifie cette charge totale.
          </p>
          <p style={{ color: "var(--c-text-3)" }}>
            <strong>Références :</strong> Foster C. et al. (2001), <em>"A New Approach to Monitoring Exercise Training"</em>,
            Journal of Strength and Conditioning Research, 15(1) · Foster C. (1998), Medicine & Science in Sports & Exercise,
            30(7) · Borg G. (1998), Borg's Perceived Exertion and Pain Scales, Human Kinetics.
          </p>
          <p className="italic" style={{ color: "var(--c-text-3)" }}>Les contraintes sprint, saut, lancer, force ou technique sont présentées séparément comme dimensions descriptives.</p>
        </div>
      )}
    </div>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────
function ChargeView() {
  const { clubId } = useAuth();
  const CURRENT_WEEK = getISOWeek(new Date());

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
      const athleteIds = athletesRes.data.map((a) => a.id);
      const [sessionAthletesRes, weeklyChargeRes] = await Promise.all([
        sessionIds.length
          ? supabase.from("session_athletes").select("session_id, athlete_id, rpe, actual_duration_minutes, duration_source").in("session_id", sessionIds)
          : Promise.resolve({ data: [], error: null }),
        // Total hebdomadaire calculé côté serveur (vue weekly_charge, voir
        // migration 20260726120000). La ventilation par catégorie ci-dessous
        // reste calculée ici : la vue n'expose que le total par athlète/semaine.
        athleteIds.length
          ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (sessionAthletesRes.error) throw sessionAthletesRes.error;
      if (weeklyChargeRes.error) throw weeklyChargeRes.error;

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
          validations:     rows.map((r) => ({ athleteId: r.athlete_id, rpe: r.rpe, actualDurationMinutes: r.actual_duration_minutes, durationSource: r.duration_source })),
        };
      });

      setAthletes(remappedAthletes);
      setWeeklyCharge((weeklyChargeRes.data ?? []).map((c) => ({
        athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load,
        dailyLoads: c.daily_loads ?? [], knownDays: c.known_days ?? 0,
        unknownDays: c.unknown_days ?? 0, estimatedDays: c.estimated_days ?? 0,
      })));
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
    if (!allMetrics.length) return { avgLoad: 0, avgLoad7: null, topLoader: null, critFatigue: 0, trendLoad: 0 };
    const avgLoad      = Math.round(allMetrics.reduce((s, m) => s + m.rawLoad, 0) / allMetrics.length);
    const load7Values  = allMetrics.map(item => item.metrics.load7).filter(Number.isFinite);
    const avgLoad7     = load7Values.length ? Math.round(load7Values.reduce((sum, value) => sum + value, 0) / load7Values.length) : null;
    const topLoader    = [...allMetrics].sort((a, b) => b.rawLoad - a.rawLoad)[0];
    const critFatigue  = allMetrics.filter((m) => m.metrics.wellnessScore != null && m.metrics.wellnessScore < 25).length;
    const avgLoadPrev  = athletes.length
      ? Math.round(athletes.reduce((s, a) => s + getRawLoad(weeklyCharge, a.id, CURRENT_WEEK - 1), 0) / athletes.length)
      : 0;
    return { avgLoad, avgLoad7, topLoader, critFatigue, trendLoad: avgLoad - avgLoadPrev };
  }, [allMetrics, athletes, weeklyCharge, CURRENT_WEEK]);

  const acwrSeries       = useMemo(() => computeGroupACWRSeries(athletes, weeklyCharge), [athletes, weeklyCharge]);
  const fatigueAlerts    = useMemo(() => allMetrics.filter((m) => m.metrics.wellnessScore != null && m.metrics.wellnessScore < 25), [allMetrics]);
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
  if (loading) return <LoadingState message="Chargement du suivi de charge…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="page-container py-4 md:py-6 max-w-7xl mx-auto space-y-5 md:space-y-6 animate-slide-up">

      <div>
        <h2 className="page-title">Charge & suivi</h2>
        <p className="secondary-text mt-1">
          Semaine {CURRENT_WEEK} · Analyse dynamique du groupe · {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {!hasAnyCharge ? (
        <div className="card p-16 text-center">
          <BarChart2 size={40} className="mx-auto mb-3" style={{ color: "var(--c-text-3)" }} />
          <p className="text-[15px] font-semibold" style={{ color: "var(--c-text-2)" }}>Aucune charge calculable pour l'instant</p>
          <p className="meta-text mt-1 max-w-sm mx-auto">
            La charge se calcule automatiquement dès qu'une séance a une durée renseignée
            et qu'un athlète a noté son RPE dans <strong>Planning</strong>.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPIs globaux ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={BarChart2}   label="Charge moyenne groupe"  value={globalMetrics.avgLoad}              sub="unités"                                color="#378ADD" trend={globalMetrics.trendLoad} />
            <MetricCard icon={Activity}    label="Charge moyenne sur 7j" value={globalMetrics.avgLoad7 ?? "—"} sub="jours connus uniquement" color="#14B8A6" />
            <MetricCard icon={Zap}         label="Athlète le plus chargé" value={globalMetrics.topLoader?.athlete.name.split(" ")[0] ?? "—"} sub={`${globalMetrics.topLoader?.rawLoad ?? 0} u`} color="#EF9F27" />
            <MetricCard icon={AlertTriangle} label="Bien-être à revoir" value={globalMetrics.critFatigue} sub={`athlète${globalMetrics.critFatigue > 1 ? "s" : ""}`} color={globalMetrics.critFatigue > 0 ? "#EF9F27" : "#1D9E75"} />
          </div>

          <AlertSignals fatigueAlerts={fatigueAlerts} />

          {/* ── Tableau charge par athlète ───────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "var(--c-border)" }}>
              <div>
                <h3 className="card-title">Charge calculée — Semaine {CURRENT_WEEK}</h3>
                <p className="card-subtitle mt-0.5">Triée par charge décroissante · Basée sur durée × RPE</p>
              </div>
              <p className="text-[12px]" style={{ color: "var(--c-text-2)" }}>Comparaison descriptive dans le groupe · aucun seuil de risque</p>
            </div>

            {sortedByLoad.every((m) => m.rawLoad === 0) ? (
              <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--c-text-3)" }}>
                Aucun RPE renseigné pour la semaine {CURRENT_WEEK} — va dans Planning pour en saisir un.
              </div>
            ) : (
              <div className="px-5 py-4 overflow-x-auto">
                <div className="space-y-4 min-w-[560px]">
                {sortedByLoad.map(({ athlete, metrics, rawLoad }, i) => {
                  const badge      = chargeLabel(rawLoad);
                  const pct        = maxLoad > 0 ? (rawLoad / maxLoad) * 100 : 0;
                  const color      = chargeColor(rawLoad);
                  const isHL       = highlightedAthlete === athlete.id || highlightedAthlete === null;
                  const colorIdx   = athletes.findIndex((a) => a.id === athlete.id) % ATHLETE_COLORS.length;

                  return (
                    <div
                      key={athlete.id}
                      className="flex items-center gap-4"
                      onMouseEnter={() => setHighlightedAthlete(athlete.id)}
                      onMouseLeave={() => setHighlightedAthlete(null)}
                      style={{ opacity: isHL ? 1 : 0.4, transition: "opacity 0.15s" }}
                    >
                      <span className="text-[12px] font-bold w-4 flex-shrink-0 text-right" style={{ color: "var(--c-text-3)" }}>{i + 1}</span>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                        style={{ background: ATHLETE_COLORS[colorIdx] }}>
                        {athlete.avatar}
                      </div>
                      <div className="w-32 flex-shrink-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{athlete.name.split(" ")[0]}</p>
                        <p className="meta-text truncate">{athlete.mainDiscipline ?? "—"}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--c-surface-3)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-[13px] font-bold w-10 text-right" style={{ color }}>{rawLoad}</span>
                      </div>
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                        {badge.dot} {badge.label}
                      </span>
                      <div className="w-16 text-right flex-shrink-0">
                        <p className="text-[12px] font-bold" style={{ color: "#A9CBFB" }}>
                          {metrics.load7 ?? "—"}
                        </p>
                        <p className="meta-text">7 jours</p>
                      </div>
                      <div className="w-16 text-right flex-shrink-0">
                        <p className="text-[12px] font-bold" style={{ color: "#14B8A6" }}>
                          {metrics.load28 ?? "—"}
                        </p>
                        <p className="meta-text">28 jours</p>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          {/* ── Courbes ACWR ─────────────────────────────────────────── */}
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="card-title">ACWR EWMA · métrique expérimentale</h3>
              <p className="card-subtitle mt-0.5">
                Affiché uniquement lorsque 28 jours quotidiens continus sont connus. Aucun seuil n'est interprété comme optimal ou comme risque.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              {athletes.map((a, i) => (
                <button
                  type="button"
                  key={a.id}
                  onMouseEnter={() => setHighlightedAthlete(a.id)}
                  onMouseLeave={() => setHighlightedAthlete(null)}
                  onFocus={() => setHighlightedAthlete(a.id)}
                  onBlur={() => setHighlightedAthlete(null)}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
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
              <div className="h-[300px] flex items-center justify-center text-[13px]" style={{ color: "var(--c-text-3)" }}>
                Pas encore assez de données pour tracer l'évolution
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={acwrSeries} margin={{ right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0.4, 1.8]} tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<ChartTooltip />} />
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
                <p className="text-[12px] mt-3" style={{ color: "var(--c-text-2)" }}>Section réservée à l'exploration et à la recherche ; aucune décision automatique n'en découle.</p>
              </>
            )}
          </div>

          {/* ── Breakdown catégories ─────────────────────────────────── */}
          {chargeBreakdown.length > 0 && breakdownCategories.length > 0 && (
            <div className="card p-5">
              <div className="mb-4">
                <h3 className="card-title">Répartition des types de charge — Groupe</h3>
                <p className="card-subtitle mt-0.5">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} formatter={(v) => <span style={{ color: "var(--c-text-2)" }}>{blockColors(v).label ?? v}</span>} />
                  {breakdownCategories.map((cat) => (
                    <Area key={cat} dataKey={cat} name={blockColors(cat).label ?? cat} stackId="1"
                      stroke={blockColors(cat).border} fill={`url(#grad-${cat})`} strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

        </>
      )}

      <MethodologyPanel />
    </div>
  );
}

export default memo(ChargeView);
