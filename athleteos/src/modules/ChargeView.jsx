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
  AlertTriangle, Zap, BarChart2, BookOpen, ChevronDown, CheckCircle, Info,
} from "lucide-react";
import { supabase }          from "../utils/supabaseClient";
import { useAuth }           from "../context/AuthContext";
import LoadingState          from "../components/ui/LoadingState";
import ErrorState            from "../components/ui/ErrorState";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { computeWeeklyLoadByCategory } from "../utils/trainingLoad";
import { getISOWeek, initialsFromName } from "../utils/helpers.js";
import {
  athleteSeriesKey,
  buildExperimentalAcwrSeries,
  buildGroupLoadOverview,
  buildGroupLoadStory,
  describeLoadVariation,
  getWeeklyLoadRow,
  getWeeklyLoadState,
} from "../domain/coachLoadPresentation.js";

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

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-[12px] max-w-[200px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-bold mb-2" style={{ color: "var(--c-text-1)" }}>{label}</p>
      {payload
        .filter((p) => p.value != null && Number.isFinite(Number(p.value)))
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <p key={p.dataKey} className="flex items-center justify-between gap-3">
            <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
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

const MetricCard = memo(({ icon: Icon, label, value, sub, color, trend, trendNote }) => (
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
        {trend > 0 ? <TrendingUp size={12} color="#378ADD" /> :
         trend < 0 ? <TrendingDown size={12} color="#A855F7" /> :
         <Minus size={12} />}
        <span>{trend > 0 ? `+${trend}` : trend} % vs semaine précédente{trendNote ? ` · ${trendNote}` : ""}</span>
      </div>
    )}
  </div>
));

const AlertSignals = memo(({ wellnessSignals, completedCount, athleteCount }) => {
  const signalCount = wellnessSignals.length;
  return (
    <section className="card overflow-hidden" aria-labelledby="charge-signals-title">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--c-border)" }}>
        <div>
          <h3 id="charge-signals-title" className="card-title">Ressentis à vérifier aujourd'hui</h3>
          <p className="card-subtitle">Les réponses de l'athlète ouvrent une conversation ; elles ne prédisent pas une blessure.</p>
        </div>
        {signalCount > 0 && (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full chip chip-warning">
            {signalCount} signal{signalCount > 1 ? "aux" : ""}
          </span>
        )}
      </div>

      {completedCount === 0 ? (
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,159,39,0.12)" }}>
            <Info size={17} color="#EF9F27" />
          </div>
          <p className="text-[13px] font-medium" style={{ color: "var(--c-text-2)" }}>
            Aucun questionnaire rempli aujourd'hui sur {athleteCount} athlète{athleteCount > 1 ? "s" : ""}. AthleteOS ne conclut donc rien sur leur ressenti.
          </p>
        </div>
      ) : signalCount === 0 ? (
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.12)" }}>
            <CheckCircle size={17} color="#1D9E75" />
          </div>
          <p className="text-[13px] font-medium" style={{ color: "var(--c-text-2)" }}>
            Aucun ressenti déclaré difficile parmi les {completedCount} questionnaire{completedCount > 1 ? "s" : ""} rempli{completedCount > 1 ? "s" : ""} aujourd'hui.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {wellnessSignals.map(({ athlete, metrics }) => (
            <div key={`f-${athlete.id}`} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.20)" }}>
              <AlertTriangle size={15} color="#E24B4A" className="flex-shrink-0" />
              <span className="text-[12px]" style={{ color: "#F19A9A" }}>
                <strong>{athlete.name}</strong> décrit une journée difficile ({metrics.wellnessScore ?? "—"}/100 au questionnaire AthleteOS). À discuter avec l'athlète, sans diagnostic automatique.
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

function metricValue(value, suffix = "") {
  return Number.isFinite(Number(value)) && value !== null
    ? `${Math.round(Number(value) * 100) / 100}${suffix}`
    : "—";
}

const AthleteLoadDetails = memo(({ item, week }) => {
  const { athlete, metrics, loadState } = item;
  const reading = describeLoadVariation(metrics.variationPercent);
  const toneColor = {
    up: "#EF9F27",
    down: "#A855F7",
    stable: "#14B8A6",
    neutral: "#94A3B8",
  }[reading.tone];
  const monotonyValue = metrics.monotonyStatus === "undefined_zero_variance"
    ? "Indéfinie"
    : metricValue(metrics.monotony);

  const simpleMeasures = [
    {
      label: `Charge de la semaine S${week}`,
      value: loadState.value == null ? "—" : `${loadState.value} points`,
      detail: loadState.detail,
    },
    {
      label: "Charge des 7 derniers jours",
      value: metrics.load7 == null ? "—" : `${metrics.load7} points`,
      detail: "Somme des durées réelles × efforts ressentis sur 7 jours. Un repos confirmé compte 0 ; un jour inconnu bloque le total.",
    },
    {
      label: "Charge des 28 derniers jours",
      value: metrics.load28 == null ? "—" : `${metrics.load28} points`,
      detail: "Somme des 4 dernières semaines, utilisée pour construire l'habitude récente — pas une note de forme.",
    },
    {
      label: "Écart avec l'habitude",
      value: reading.valueLabel,
      detail: reading.summary,
    },
  ];

  const advancedMeasures = [
    {
      label: "EWMA courte",
      value: metricValue(metrics.acute),
      detail: "Moyenne quotidienne lissée qui donne davantage de poids aux jours récents (constante de 7 jours).",
    },
    {
      label: "EWMA longue",
      value: metricValue(metrics.chronic),
      detail: "Moyenne quotidienne lissée sur un repère plus long (constante de 28 jours).",
    },
    {
      label: "Monotonie descriptive",
      value: monotonyValue,
      detail: metrics.monotonyStatus === "undefined_zero_variance"
        ? "Les 7 charges quotidiennes sont identiques : l'écart-type vaut zéro et le ratio n'est pas calculable."
        : "Compare la moyenne et la variabilité des 7 charges quotidiennes. Ce nombre ne prédit pas une blessure.",
    },
    {
      label: "ACWR EWMA expérimental",
      value: metrics.acwr == null ? "—" : Number(metrics.acwr).toFixed(2),
      detail: "Rapport entre les deux EWMA, affiché seulement avec 28 jours continus connus. AthleteOS n'applique ni zone optimale ni risque individuel.",
    },
  ];

  return (
    <div className="rounded-2xl p-4 md:p-5 space-y-4" style={{ background: "linear-gradient(135deg, rgba(55,138,221,0.10), rgba(20,184,166,0.04))", border: "1px solid rgba(55,138,221,0.20)" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${toneColor}18` }}>
          {reading.tone === "up" ? <TrendingUp size={17} color={toneColor} /> :
           reading.tone === "down" ? <TrendingDown size={17} color={toneColor} /> :
           reading.tone === "stable" ? <Minus size={17} color={toneColor} /> :
           <Info size={17} color={toneColor} />}
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--c-text-3)" }}>Lecture simple · {athlete.name}</p>
          <h4 className="text-[15px] font-bold mt-1" style={{ color: "var(--c-text-1)" }}>{reading.label}</h4>
          <p className="text-[13px] leading-6 mt-1" style={{ color: "var(--c-text-2)" }}>{reading.summary}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {simpleMeasures.map((measure) => (
          <div key={measure.label} className="rounded-xl p-3.5" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--c-text-2)" }}>{measure.label}</p>
            <p className="text-[17px] font-bold mt-1" style={{ color: "var(--c-text-1)" }}>{measure.value}</p>
            <p className="text-[12px] leading-5 mt-2" style={{ color: "var(--c-text-3)" }}>{measure.detail}</p>
          </div>
        ))}
      </div>

      <details className="rounded-xl" style={{ border: "1px solid var(--c-border)" }}>
        <summary className="px-4 py-3 cursor-pointer text-[12.5px] font-semibold" style={{ color: "var(--c-text-2)" }}>
          Voir le détail scientifique de {athlete.name.split(" ")[0]}
        </summary>
        <div className="grid sm:grid-cols-2 gap-3 p-3 border-t" style={{ borderColor: "var(--c-border)" }}>
          {advancedMeasures.map((measure) => (
            <div key={measure.label} className="rounded-xl p-3" style={{ background: "var(--c-surface-2)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-semibold" style={{ color: "var(--c-text-2)" }}>{measure.label}</p>
                <strong className="text-[13px]" style={{ color: "var(--c-text-1)" }}>{measure.value}</strong>
              </div>
              <p className="text-[12px] leading-5 mt-1.5" style={{ color: "var(--c-text-3)" }}>{measure.detail}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
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
  const previousWeekDate = new Date();
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const PREVIOUS_WEEK = getISOWeek(previousWeekDate);

  const [athletes,             setAthletes]             = useState([]);
  const [weeklyCharge,         setWeeklyCharge]         = useState([]);
  const [wellnessRows,         setWellnessRows]         = useState([]);
  const [sessionsForBreakdown, setSessionsForBreakdown] = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);
  const [highlightedAthlete,   setHighlightedAthlete]   = useState(null);
  const [expandedAthlete,      setExpandedAthlete]      = useState(null);
  const [advancedOpen,         setAdvancedOpen]         = useState(false);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const requestDate = new Date();
      const [athletesRes, sessionsRes, wellnessRes] = await Promise.all([
        supabase
          .from("athletes")
          .select("id, name, main_discipline, profile_data")
          .eq("club_id", clubId),
        supabase
          .from("sessions")
          .select("id, week, category, training_focus, duration_minutes")
          .eq("club_id", clubId),
        supabase
          .from("athlete_wellness")
          .select("athlete_id, date, sleep, energy, soreness, mood, stress, notes")
          .eq("club_id", clubId)
          .eq("date", toLocalDateStr(requestDate)),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (wellnessRes.error) throw wellnessRes.error;

      const athleteRows = athletesRes.data ?? [];
      const sessionRows = sessionsRes.data ?? [];
      const sessionIds = sessionRows.map((session) => session.id);
      const athleteIds = athleteRows.map((athlete) => athlete.id);
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

      const remappedAthletes = athleteRows.map((a) => ({
        id:             a.id,
        name:           a.name,
        mainDiscipline: a.main_discipline,
        avatar:         a.profile_data?.avatar ?? initialsFromName(a.name),
      }));

      const enrichedSessions = sessionRows.map((s) => {
        const rows = sessionAthletesRes.data.filter((r) => r.session_id === s.id);
        return {
          id:              s.id,
          week:            s.week,
          category:        s.category,
          trainingFocus:   s.training_focus,
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
      setWellnessRows((wellnessRes.data ?? []).map((row) => ({
        athleteId: row.athlete_id,
        date: row.date,
        sleep: row.sleep,
        energy: row.energy,
        soreness: row.soreness,
        mood: row.mood,
        stress: row.stress,
        notes: row.notes,
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
    athletes.map((athlete) => {
      const currentRow = getWeeklyLoadRow(weeklyCharge, athlete.id, CURRENT_WEEK);
      const previousRow = getWeeklyLoadRow(weeklyCharge, athlete.id, PREVIOUS_WEEK);
      const loadState = getWeeklyLoadState(currentRow);
      return {
        athlete,
        metrics: getAthleteMetricsForWeek(athlete.id, weeklyCharge, CURRENT_WEEK, wellnessRows),
        currentRow,
        loadState,
        rawLoad: loadState.value,
        previousRawLoad: getWeeklyLoadState(previousRow).value,
      };
    }),
  [athletes, weeklyCharge, wellnessRows, CURRENT_WEEK, PREVIOUS_WEEK]);

  const hasAnyCharge = weeklyCharge.length > 0;

  const globalMetrics = useMemo(() => buildGroupLoadOverview(allMetrics), [allMetrics]);
  const wellnessSignals = useMemo(() => allMetrics.filter((item) => item.metrics.wellnessScore != null && item.metrics.wellnessScore < 25), [allMetrics]);
  const completedWellnessCount = useMemo(() => allMetrics.filter((item) => item.metrics.wellnessScore != null).length, [allMetrics]);
  const acwrSeries = useMemo(() => buildExperimentalAcwrSeries(athletes, weeklyCharge), [athletes, weeklyCharge]);
  const hasExperimentalAcwr = useMemo(() => acwrSeries.some((point) =>
    athletes.some((athlete) => Number.isFinite(point[athleteSeriesKey(athlete.id)]))
  ), [acwrSeries, athletes]);
  const sortedByLoad = useMemo(() => [...allMetrics].sort((a, b) => {
    if (a.rawLoad == null && b.rawLoad == null) return a.athlete.name.localeCompare(b.athlete.name, "fr");
    if (a.rawLoad == null) return 1;
    if (b.rawLoad == null) return -1;
    return b.rawLoad - a.rawLoad;
  }), [allMetrics]);
  const maxLoad = Math.max(1, ...sortedByLoad.map((item) => item.rawLoad ?? 0));
  const groupStory = useMemo(() => buildGroupLoadStory(allMetrics), [allMetrics]);

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
          Semaine {CURRENT_WEEK} · Une lecture simple du travail réellement effectué par {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
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
          <section className="card overflow-hidden" aria-labelledby="group-load-story-title">
            <div className="p-5 md:p-6" style={{ background: "linear-gradient(135deg, rgba(91,141,239,0.14), rgba(20,184,166,0.06))" }}>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="max-w-3xl">
                  <span className="chip chip-neutral">À comprendre cette semaine</span>
                  <h3 id="group-load-story-title" className="mt-3 text-[17px] font-bold" style={{ color: "var(--c-text-1)" }}>{groupStory.headline}</h3>
                  <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--c-text-2)" }}>{groupStory.detail}</p>
                </div>
                {groupStory.counts.known > 0 && (
                  <div className="grid grid-cols-3 gap-2 flex-shrink-0" aria-label="Résumé des évolutions du groupe">
                    <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(239,159,39,0.10)" }}>
                      <strong className="block text-[15px]" style={{ color: "#F3C77D" }}>{groupStory.counts.higher}</strong>
                      <span className="text-[11px]" style={{ color: "var(--c-text-2)" }}>au-dessus</span>
                    </div>
                    <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(20,184,166,0.10)" }}>
                      <strong className="block text-[15px]" style={{ color: "#76D7CC" }}>{groupStory.counts.stable}</strong>
                      <span className="text-[11px]" style={{ color: "var(--c-text-2)" }}>proches</span>
                    </div>
                    <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(168,85,247,0.10)" }}>
                      <strong className="block text-[15px]" style={{ color: "#C9A2F9" }}>{groupStory.counts.lower}</strong>
                      <span className="text-[11px]" style={{ color: "var(--c-text-2)" }}>en dessous</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <AlertSignals wellnessSignals={wellnessSignals} completedCount={completedWellnessCount} athleteCount={athletes.length} />

          {/* ── KPIs globaux conservés, avec libellés non ambigus ───── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={BarChart2}
              label="Charge moyenne renseignée"
              value={globalMetrics.avgLoad ?? "—"}
              sub={`${globalMetrics.observedCount}/${athletes.length} athlète${athletes.length > 1 ? "s" : ""}`}
              color="#378ADD"
              trend={globalMetrics.trendPercent}
              trendNote={`${globalMetrics.pairedCount} comparé${globalMetrics.pairedCount > 1 ? "s" : ""}`}
            />
            <MetricCard icon={Activity} label="Moyenne sur 7 jours" value={globalMetrics.avgLoad7 ?? "—"} sub="historiques complets" color="#14B8A6" />
            <MetricCard
              icon={Zap}
              label="Charge renseignée la plus élevée"
              value={globalMetrics.topLoader?.athlete.name.split(" ")[0] ?? "—"}
              sub={globalMetrics.topLoader ? `${globalMetrics.topLoader.rawLoad} points · descriptif` : "aucune charge positive"}
              color="#EF9F27"
            />
            <MetricCard icon={AlertTriangle} label="Ressentis à discuter" value={wellnessSignals.length} sub={`${completedWellnessCount} questionnaire${completedWellnessCount > 1 ? "s" : ""} aujourd'hui`} color={wellnessSignals.length > 0 ? "#EF9F27" : "#1D9E75"} />
          </div>

          {/* ── Tableau charge par athlète ───────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "var(--c-border)" }}>
              <div>
                <h3 className="card-title">Comprendre chaque athlète — Semaine {CURRENT_WEEK}</h3>
                <p className="card-subtitle mt-0.5">Clique sur l'interprétation d'un athlète pour passer des chiffres à une explication simple, puis au détail scientifique.</p>
              </div>
              <p className="text-[12px]" style={{ color: "var(--c-text-2)" }}>Tri par charge renseignée · ce n'est pas un classement de forme</p>
            </div>

            {athletes.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--c-text-3)" }}>
                Aucun athlète dans le club pour le moment.
              </div>
            ) : (
              <div className="px-4 md:px-5 py-4">
                <div className="space-y-3">
                {sortedByLoad.map((item, i) => {
                  const { athlete, metrics, rawLoad, loadState } = item;
                  const reading    = describeLoadVariation(metrics.variationPercent);
                  const pct        = rawLoad == null ? 0 : (rawLoad / maxLoad) * 100;
                  const color      = loadState.color;
                  const isHL       = highlightedAthlete === athlete.id || highlightedAthlete === null;
                  const colorIdx   = athletes.findIndex((a) => a.id === athlete.id) % ATHLETE_COLORS.length;
                  const isExpanded = expandedAthlete === athlete.id;

                  return (
                    <div key={athlete.id} className="space-y-3">
                      <div
                        className="flex flex-wrap xl:flex-nowrap items-center gap-3 md:gap-4 rounded-xl px-2 py-2"
                        onMouseEnter={() => setHighlightedAthlete(athlete.id)}
                        onMouseLeave={() => setHighlightedAthlete(null)}
                        style={{ opacity: isHL ? 1 : 0.4, transition: "opacity 0.15s", background: isExpanded ? "var(--c-surface-2)" : "transparent" }}
                      >
                        <span className="order-1 xl:order-none text-[12px] font-bold w-4 flex-shrink-0 text-right" style={{ color: "var(--c-text-3)" }}>{i + 1}</span>
                        <div className="order-1 xl:order-none w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                          style={{ background: ATHLETE_COLORS[colorIdx] }}>
                          {athlete.avatar}
                        </div>
                        <div className="order-1 xl:order-none flex-1 min-w-[130px] xl:w-40 xl:flex-none">
                          <p className="text-[13px] font-semibold truncate" title={athlete.name} style={{ color: "var(--c-text-1)" }}>{athlete.name}</p>
                          <p className="meta-text truncate">{athlete.mainDiscipline ?? "Discipline non renseignée"}</p>
                        </div>
                        <span className={`order-1 xl:order-none text-[12px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${loadState.badgeClass}`}>
                          {loadState.label}
                        </span>
                        <div className="order-2 xl:order-none basis-full xl:basis-auto xl:flex-1 flex items-center gap-3">
                          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--c-surface-3)" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-[13px] font-bold w-12 text-right" style={{ color }}>{rawLoad ?? "—"}</span>
                        </div>
                        <div className="order-3 xl:order-none w-20 text-left xl:text-right flex-shrink-0">
                          <p className="text-[12px] font-bold" style={{ color: "#A9CBFB" }}>{metrics.load7 ?? "—"}</p>
                          <p className="meta-text">7 jours</p>
                        </div>
                        <div className="order-3 xl:order-none w-20 text-left xl:text-right flex-shrink-0">
                          <p className="text-[12px] font-bold" style={{ color: "#14B8A6" }}>{metrics.load28 ?? "—"}</p>
                          <p className="meta-text">28 jours</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Comprendre la charge de ${athlete.name}`}
                          aria-expanded={isExpanded}
                          aria-controls={`charge-details-${athlete.id}`}
                          onClick={() => setExpandedAthlete(isExpanded ? null : athlete.id)}
                          className="order-3 xl:order-none flex-1 min-w-[170px] xl:w-44 xl:flex-none inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-[var(--c-surface-3)]"
                          style={{ color: "var(--c-text-1)", border: "1px solid var(--c-border)" }}
                        >
                          <span className="truncate">{reading.label}</span>
                          <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div id={`charge-details-${athlete.id}`}>
                          <AthleteLoadDetails item={item} week={CURRENT_WEEK} />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          {/* ── Courbes ACWR conservées au second niveau ─────────────── */}
          <section className="card overflow-hidden" aria-labelledby="advanced-load-title">
            <button
              type="button"
              aria-expanded={advancedOpen}
              aria-controls="advanced-load-content"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-[var(--c-surface-3)] transition-colors"
            >
              <span>
                <span id="advanced-load-title" className="card-title block">Analyse avancée · ACWR EWMA expérimental</span>
                <span className="card-subtitle mt-1 block">Optionnel : le suivi quotidien reste prioritaire. Aucun seuil optimal ni risque individuel n'est calculé.</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold flex-shrink-0" style={{ color: "var(--c-text-2)" }}>
                {advancedOpen ? "Masquer" : "Explorer"}
                <ChevronDown size={15} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {advancedOpen && (
              <div id="advanced-load-content" className="p-5 border-t" style={{ borderColor: "var(--c-border)" }}>
                <div className="flex flex-wrap gap-3 mb-4">
                  {athletes.map((athlete, index) => (
                    <button
                      type="button"
                      key={athlete.id}
                      onMouseEnter={() => setHighlightedAthlete(athlete.id)}
                      onMouseLeave={() => setHighlightedAthlete(null)}
                      onFocus={() => setHighlightedAthlete(athlete.id)}
                      onBlur={() => setHighlightedAthlete(null)}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
                      style={{
                        background: highlightedAthlete === athlete.id ? `${ATHLETE_COLORS[index % ATHLETE_COLORS.length]}18` : "transparent",
                        color: ATHLETE_COLORS[index % ATHLETE_COLORS.length],
                        border: `1.5px solid ${ATHLETE_COLORS[index % ATHLETE_COLORS.length]}`,
                        opacity: highlightedAthlete && highlightedAthlete !== athlete.id ? 0.35 : 1,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: ATHLETE_COLORS[index % ATHLETE_COLORS.length] }} />
                      {athlete.name}
                    </button>
                  ))}
                </div>
                {!hasExperimentalAcwr ? (
                  <div className="h-[240px] flex items-center justify-center text-[13px]" style={{ color: "var(--c-text-3)" }}>
                    Pas encore assez de données pour tracer l'évolution.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={acwrSeries} margin={{ right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, "auto"]} tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<ChartTooltip />} />
                        {athletes.map((athlete, index) => {
                          const isHL = highlightedAthlete === null || highlightedAthlete === athlete.id;
                          return (
                            <Line key={athlete.id} dataKey={athleteSeriesKey(athlete.id)} name={athlete.name}
                              stroke={ATHLETE_COLORS[index % ATHLETE_COLORS.length]}
                              strokeWidth={isHL ? 2.5 : 1}
                              dot={isHL ? { r: 3, fill: ATHLETE_COLORS[index % ATHLETE_COLORS.length] } : false}
                              activeDot={{ r: 5 }} opacity={isHL ? 1 : 0.2}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[12px] mt-3" style={{ color: "var(--c-text-2)" }}>Les trous restent visibles lorsque des jours sont inconnus : la courbe ne relie plus artificiellement deux observations séparées.</p>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Breakdown catégories ─────────────────────────────────── */}
          {chargeBreakdown.length > 0 && breakdownCategories.length > 0 && (
            <div className="card p-5">
              <div className="mb-4">
                <h3 className="card-title">Ce que le groupe a surtout travaillé</h3>
                <p className="card-subtitle mt-0.5">
                  Répartition descriptive des 6 dernières semaines. Les catégories expliquent le contenu des séances sans modifier la formule globale durée × effort ressenti.
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
