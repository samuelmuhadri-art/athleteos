// ============================================================
// AthleteOS — src/modules/Performances.jsx
// Version nettoyée Phase 2 :
// - useAuth() remplace .eq("club_id", 1)
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : classements, podium, scatter charge/perf,
// évolution individuelle, analyse automatique.
// ============================================================

import { memo, useState, useMemo, useEffect, useCallback } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ZAxis,
  ReferenceLine, Label, LineChart, Line,
} from "recharts";
import {
  Trophy, TrendingUp, Zap, Users, User, Calendar,
} from "lucide-react";
import { supabase }                   from "../utils/supabaseClient";
import { useAuth }                    from "../context/AuthContext";
import LoadingState                   from "../components/ui/LoadingState";
import ErrorState                     from "../components/ui/ErrorState";
import { EmptyState, PageHeader }      from "../components/ui/premium";
import { getAthleteMetricsForWeek }   from "../utils/chargeCalculations";
import { getISOWeek, initialsFromName } from "../utils/helpers.js";
// Tâche 11 : moteur central de comparaison de performances (parsePerf,
// getDiscHib, pctOfReference, compareValues) — ce fichier avait sa PROPRE
// copie de parsePerf() qui devinait le sens ("higherIsBetter") depuis le
// FORMAT de la chaîne plutôt que depuis la discipline. Un lancer de poids
// saisi "14.20" (sans "m") était pris pour un chrono. Supprimée, remplacée
// par athlete/shared.js — seule source de vérité, partagée avec le côté
// athlète, pour que classements et records concordent entre coach et
// athlète (DoD tâche 11).
import { parsePerf, getDiscHib, pctOfReference, compareValues } from "../athlete/shared.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATHLETE_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllDisciplines(athletes) {
  const set = new Set();
  athletes.forEach((a) => { Object.keys(a.records ?? {}).forEach((d) => set.add(d)); });
  return [...set].sort();
}

function rankAthletes(athletes, discipline) {
  const withRecord = athletes
    .filter((a) => a.records?.[discipline])
    .map((a) => {
      const rec = a.records[discipline];
      const sbP = parsePerf(rec.sb);
      const prP = parsePerf(rec.pr);
      const pct = pctOfReference(sbP.value, prP.value, discipline);
      const idx = athletes.findIndex((x) => x.id === a.id);
      return { athlete: a, rec, sbParsed: sbP, pct, colorIdx: idx % ATHLETE_COLORS.length };
    })
    .filter((e) => e.sbParsed.value !== null);
  return withRecord.sort((a, b) => compareValues(a.sbParsed.value, b.sbParsed.value, discipline));
}

function pctColor(pct) {
  if (pct === null) return "var(--c-text-3)";
  if (pct >= 97)   return "#1D9E75";
  if (pct >= 90)   return "#EF9F27";
  return "#E24B4A";
}

function generateDisciplineAnalysis(ranked, discipline) {
  if (ranked.length === 0) return [`Aucun athlète n'a de record enregistré pour l'épreuve "${discipline}".`];
  const lines  = [];
  const leader = ranked[0];
  lines.push(`🥇 Leader sur ${discipline} : ${leader.athlete.name} avec un SB à ${leader.rec.sb}${leader.pct !== null ? ` (${leader.pct}% de son PR).` : "."}`);
  const bestPct = [...ranked].filter((r) => r.pct !== null).sort((a, b) => b.pct - a.pct)[0];
  if (bestPct && bestPct.athlete.id !== leader.athlete.id)
    lines.push(`📈 ${bestPct.athlete.name} est l'athlète le plus proche de son record personnel (${bestPct.pct}% du PR).`);
  const inForm = ranked.filter((r) => r.pct !== null && r.pct >= 95);
  if (inForm.length > 1)
    lines.push(`✅ ${inForm.length} athlètes dépassent 95% de leur PR cette saison sur ${discipline} : ` + inForm.map((r) => r.athlete.name.split(" ")[0]).join(", ") + ".");
  const under = ranked.filter((r) => r.pct !== null && r.pct < 85);
  if (under.length > 0)
    lines.push(`⚠️ ${under.map((r) => r.athlete.name.split(" ")[0]).join(", ")} ${under.length > 1 ? "sont" : "est"} en dessous de 85% du PR. Un travail spécifique pourrait être bénéfique.`);
  if (ranked.length === 1)
    lines.push(`ℹ️ Un seul athlète du groupe pratique cette épreuve. Pas de comparaison possible.`);
  return lines;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

const ScatterTooltip = ({ active, payload, currentWeek }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl shadow-lg px-3 py-3 text-[12px] min-w-[170px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold" style={{ background: d.color }}>{d.avatar}</div>
        <span className="font-semibold" style={{ color: "var(--c-text-1)" }}>{d.name}</span>
      </div>
      <div className="space-y-0.5" style={{ color: "var(--c-text-2)" }}>
        <p>Charge S{currentWeek} : <strong style={{ color: "var(--c-text-1)" }}>{d.x} u</strong></p>
        <p>% PR atteint : <strong style={{ color: pctColor(d.y) }}>{d.y}%</strong></p>
        <p>SB : <strong style={{ color: "var(--c-text-1)" }}>{d.sb}</strong></p>
        <p>PR : <strong style={{ color: "var(--tone-success)" }}>{d.pr}</strong></p>
      </div>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl shadow-lg px-3 py-3 text-[12px] min-w-[150px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--c-text-1)" }}>{d.compName}</p>
      <p className="text-[12px] mb-2" style={{ color: "var(--c-text-2)" }}>{label}</p>
      <p className="text-[15px] font-semibold" style={{ color: "var(--color-success)" }}>{d.resultStr}</p>
      {d.context && <p className="text-[12px] mt-1 italic" style={{ color: "var(--c-text-2)" }}>"{d.context}"</p>}
    </div>
  );
};

const Podium = memo(({ ranked }) => {
  const top3 = ranked.slice(0, 3);
  const podiumConfig = [
    { data: top3[1], height: 80,  rank: 2, medal: "🥈", bg: "rgba(148,163,184,0.16)", border: "#94A3B8" },
    { data: top3[0], height: 110, rank: 1, medal: "🥇", bg: "rgba(239,159,39,0.18)", border: "#EF9F27" },
    { data: top3[2], height: 60,  rank: 3, medal: "🥉", bg: "rgba(249,115,22,0.16)", border: "#F97316" },
  ].filter((p) => p.data);
  if (ranked.length === 0) return null;
  return (
    <div className="flex items-end justify-center gap-1 sm:gap-3 pb-4">
      {podiumConfig.map(({ data, height, medal, bg, border }) => (
        <div key={data.athlete.id} className="flex flex-1 max-w-[120px] min-w-0 flex-col items-center gap-2">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[13px] font-bold mx-auto mb-1.5 shadow-sm" style={{ background: ATHLETE_COLORS[data.colorIdx] }}>
              {data.athlete.avatar}
            </div>
            <p className="text-[12px] font-bold leading-tight" style={{ color: "var(--c-text-1)" }}>{data.athlete.name.split(" ")[0]}</p>
            <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--c-text-2)" }}>{data.rec.sb}</p>
            {data.pct !== null && <p className="text-[12px] font-semibold mt-0.5" style={{ color: pctColor(data.pct) }}>{data.pct}% PR</p>}
          </div>
          <div className="w-full rounded-t-xl flex items-start justify-center pt-3 border-t-4" style={{ height, background: bg, borderColor: border }}>
            <span className="text-2xl">{medal}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────
function Performances() {
  const { clubId } = useAuth();
  const CURRENT_WEEK = getISOWeek(new Date());

  const [athletes,       setAthletes]       = useState([]);
  const [weeklyCharge,   setWeeklyCharge]   = useState([]);
  const [historyResults, setHistoryResults] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [viewMode,       setViewMode]       = useState("group");
  const [selectedDisc,   setSelectedDisc]   = useState(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const athletesRes = await supabase
        .from("athletes").select("id, name, main_discipline, profile_data").eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map((a) => a.id);

      const [recordsRes, historyRes] = await Promise.all([
        athleteIds.length ? supabase.from("records").select("*").in("athlete_id", athleteIds) : Promise.resolve({ data: [] }),
        athleteIds.length ? supabase.from("competition_results").select("*, competitions(name, date)").in("athlete_id", athleteIds) : Promise.resolve({ data: [] }),
      ]);
      if (recordsRes.error)  throw recordsRes.error;
      if (historyRes.error)  throw historyRes.error;

      // Charge hebdomadaire calculée côté serveur (vue weekly_charge, voir
      // migration 20260726120000) — plus de recalcul JS à partir des séances.
      let weeklyChargeComputed = [];
      if (athleteIds.length) {
        const chargeRes = await supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds);
        if (!chargeRes.error) {
          weeklyChargeComputed = (chargeRes.data ?? []).map((c) => ({
            athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load,
            dailyLoads: c.daily_loads ?? [], knownDays: c.known_days ?? 0,
            unknownDays: c.unknown_days ?? 0, estimatedDays: c.estimated_days ?? 0,
          }));
        }
      }

      const assembledAthletes = athletesRes.data.map((a) => {
        const recs = {};
        (recordsRes.data ?? []).filter((r) => r.athlete_id === a.id).forEach((r) => {
          recs[r.discipline] = { sb: r.sb, pr: r.pr, prDate: r.pr_date };
        });
        return { id: a.id, name: a.name, mainDiscipline: a.main_discipline, avatar: a.profile_data?.avatar ?? initialsFromName(a.name), records: recs };
      });

      setAthletes(assembledAthletes);
      setWeeklyCharge(weeklyChargeComputed);
      setHistoryResults(historyRes.data ?? []);

      const disciplines = getAllDisciplines(assembledAthletes);
      setSelectedDisc((prev) => prev ?? disciplines[0] ?? null);
      setSelectedAthleteId(athleteIds[0] ?? null);
    } catch (err) {
      console.error("Performances — chargement :", err);
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Calculs dérivés ══════════════════════════════════════════════════════
  const allDisciplines = useMemo(() => getAllDisciplines(athletes), [athletes]);
  const ranked         = useMemo(() => selectedDisc ? rankAthletes(athletes, selectedDisc) : [], [athletes, selectedDisc]);
  const analysis       = useMemo(() => selectedDisc ? generateDisciplineAnalysis(ranked, selectedDisc) : [], [ranked, selectedDisc]);
  const avgPct         = useMemo(() => {
    const valids = ranked.filter((r) => r.pct !== null);
    return valids.length ? Math.round(valids.reduce((s, r) => s + r.pct, 0) / valids.length) : null;
  }, [ranked]);

  const scatterData = useMemo(() =>
    ranked.filter((r) => r.pct !== null).map((r) => {
      const metrics = getAthleteMetricsForWeek(r.athlete.id, weeklyCharge, CURRENT_WEEK);
      return { x: metrics.rawLoad ?? metrics.acute ?? 0, y: r.pct, name: r.athlete.name, avatar: r.athlete.avatar, color: ATHLETE_COLORS[r.colorIdx], sb: r.rec.sb, pr: r.rec.pr, id: r.athlete.id };
    }),
  [ranked, weeklyCharge, CURRENT_WEEK]);

  const evolutionData = useMemo(() => {
    if (!selectedAthleteId || !selectedDisc) return [];
    return historyResults
      .filter((r) => r.athlete_id === selectedAthleteId && r.event === selectedDisc && r.competitions?.date)
      .sort((a, b) => new Date(a.competitions.date) - new Date(b.competitions.date))
      .map((r) => {
        const parsed = parsePerf(r.result);
        return { date: new Date(r.competitions.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), fullDate: r.competitions.date, compName: r.competitions.name, resultStr: r.result, resultNum: parsed.value, context: r.context };
      })
      .filter((d) => d.resultNum !== null);
  }, [historyResults, selectedAthleteId, selectedDisc]);

  // Tâche 11 : le sens (chrono ou pas) vient de la discipline sélectionnée,
  // pas d'un résultat individuel deviné depuis son format — un seul résultat
  // mal formaté ne doit pas inverser l'axe du graphique pour tout le monde.
  const isTimeEvent = selectedDisc ? !getDiscHib(selectedDisc) : false;
  const bestEvolution = useMemo(() => {
    if (!selectedDisc || evolutionData.length === 0) return null;
    return evolutionData.reduce((best, result) => (
      compareValues(result.resultNum, best.resultNum, selectedDisc) < 0 ? result : best
    ));
  }, [evolutionData, selectedDisc]);

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des performances…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  if (allDisciplines.length === 0) {
    return (
      <div className="page-container py-4 md:py-6 max-w-7xl mx-auto space-y-5 animate-slide-up">
        <PageHeader
          eyebrow="ANALYSE DU GROUPE"
          title="Performances"
          description="Classements du groupe et progression individuelle."
        />
        <EmptyState
          icon={Trophy}
          title="Aucun record enregistré pour l’instant"
          description="Les classements et graphiques apparaîtront dès que les premiers records auront été ajoutés aux profils."
        />
      </div>
    );
  }

  return (
    <div className="page-container py-4 md:py-6 max-w-7xl mx-auto space-y-5 md:space-y-6 animate-slide-up">

      <PageHeader
        eyebrow="ANALYSE DU GROUPE"
        title="Performances"
        description={`${athletes.length} athlète${athletes.length !== 1 ? "s" : ""} · ${allDisciplines.length} épreuve${allDisciplines.length !== 1 ? "s" : ""} suivie${allDisciplines.length !== 1 ? "s" : ""}`}
      />

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="card p-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl w-full md:w-auto" style={{ background: "var(--c-surface-2)" }} role="group" aria-label="Mode d'analyse">
          <button type="button" aria-pressed={viewMode === "group"} onClick={() => setViewMode("group")} className={`min-h-11 px-3 md:px-4 rounded-lg text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${viewMode === "group" ? "bg-[rgba(29,158,117,0.15)] text-[var(--color-success)]" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface-3)]"}`}>
            <Users size={16} /> Classement
          </button>
          <button type="button" aria-pressed={viewMode === "evolution"} onClick={() => setViewMode("evolution")} className={`min-h-11 px-3 md:px-4 rounded-lg text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${viewMode === "evolution" ? "bg-[rgba(29,158,117,0.15)] text-[var(--color-success)]" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface-3)]"}`}>
            <TrendingUp size={16} /> Évolution
          </button>
        </div>

        <div className="relative w-full md:w-[240px]">
          <label htmlFor="performance-discipline" className="sr-only">Épreuve analysée</label>
          <Trophy size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-warning)" }} />
          <select id="performance-discipline" value={selectedDisc ?? ""} onChange={(event) => setSelectedDisc(event.target.value)} className="input-premium font-semibold" style={{ paddingLeft: 40 }}>
            {allDisciplines.map((discipline) => <option key={discipline} value={discipline}>{discipline}</option>)}
          </select>
        </div>
      </div>

      {/* ── Vue groupe ───────────────────────────────────────────────────── */}
      {viewMode === "group" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, bg: "bg-[rgba(239,159,39,0.15)]", color: "#EF9F27", label: "Athlètes", value: ranked.length, sub: `pratiquent ${selectedDisc}` },
              { icon: TrendingUp, bg: "bg-[rgba(29,158,117,0.15)]", color: "#1D9E75", label: "Meilleur SB", value: ranked[0]?.rec.sb ?? "—", sub: ranked[0]?.athlete.name.split(" ")[0] ?? "—", valueColor: "#1D9E75" },
              { icon: Zap, bg: "bg-[rgba(55,138,221,0.15)]", color: "#378ADD", label: "% PR moyen groupe", value: avgPct !== null ? `${avgPct}%` : "—", sub: "de leurs records personnels", valueColor: pctColor(avgPct) },
            ].map((card) => (
              <div key={card.label} className="card p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
                  <card.icon size={18} color={card.color} />
                </div>
                <div>
                  <p className="metric-label">{card.label}</p>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: card.valueColor ?? "var(--c-text-1)" }}>{card.value}</p>
                  <p className="meta-text">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {ranked.length === 0 ? (
            <div className="card p-16 text-center">
              <Trophy size={40} className="mx-auto mb-3" style={{ color: "var(--c-text-3)" }} />
              <p className="text-[15px] font-semibold" style={{ color: "var(--c-text-2)" }}>Aucun athlète n'a de record pour « {selectedDisc} »</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 card p-5">
                  <h3 className="card-title mb-4">Podium — {selectedDisc}</h3>
                  {ranked.length >= 2 ? <Podium ranked={ranked} /> : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[18px] font-bold shadow-sm" style={{ background: ATHLETE_COLORS[ranked[0].colorIdx] }}>{ranked[0].athlete.avatar}</div>
                      <div className="text-center">
                        <p className="text-[15px] font-bold" style={{ color: "var(--c-text-1)" }}>{ranked[0].athlete.name}</p>
                        <p className="text-[18px] font-bold mt-1" style={{ color: "var(--tone-success)" }}>{ranked[0].rec.sb}</p>
                        <p className="meta-text mt-1">Seul pratiquant dans le groupe</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 card overflow-hidden">
                  <div className="px-5 py-4 border-b" style={{ borderColor: "var(--c-border)" }}>
                    <h3 className="card-title">Classement complet</h3>
                  </div>
                  <div className="divide-y divide-[var(--c-border)] max-h-[300px] overflow-y-auto">
                    {ranked.map((r, i) => (
                      <div key={r.athlete.id} className="px-5 py-3.5 flex items-center gap-3">
                        <span className={["w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0", i === 0 ? "bg-[rgba(239,159,39,0.15)] text-[#EF9F27]" : i === 1 ? "bg-[rgba(255,255,255,0.08)] text-[var(--c-text-2)]" : i === 2 ? "bg-[rgba(249,115,22,0.15)] text-[#F97316]" : "bg-[rgba(255,255,255,0.08)] text-[var(--c-text-2)]"].join(" ")}>{i + 1}</span>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: ATHLETE_COLORS[r.colorIdx] }}>{r.athlete.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{r.athlete.name}</p>
                          <p className="meta-text truncate">{r.athlete.mainDiscipline ?? "—"}</p>
                        </div>
                        <div className="text-right flex-shrink-0 w-20">
                          <p className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>{r.rec.sb}</p>
                          <p className="meta-text">PR : {r.rec.pr}</p>
                        </div>
                        {r.pct !== null && (
                          <div className="w-16 text-right flex-shrink-0">
                            <p className="text-[12px] font-bold" style={{ color: pctColor(r.pct) }}>{r.pct}%</p>
                            <p className="meta-text">du PR</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {scatterData.length >= 2 && (
                <div className="card p-5">
                  <div className="mb-4">
                    <h3 className="card-title">Charge vs Performance — {selectedDisc}</h3>
                    <p className="card-subtitle">Charge S{CURRENT_WEEK} (axe X) · % du PR atteint (axe Y) · Chaque point représente un athlète</p>
                  </div>
                  <div role="img" aria-label={`Graphique comparant la charge et le pourcentage du record personnel pour ${selectedDisc}`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                      <XAxis dataKey="x" name="Charge" type="number" tick={{ fontSize: 12, fill: "var(--c-text-2)" }} axisLine={false} tickLine={false}>
                        <Label value="Charge (unités)" position="insideBottom" offset={-10} style={{ fontSize: 12, fill: "var(--c-text-2)" }} />
                      </XAxis>
                      <YAxis dataKey="y" name="% PR" type="number" domain={[70, 105]} tick={{ fontSize: 12, fill: "var(--c-text-2)" }} axisLine={false} tickLine={false}>
                        <Label value="% PR" angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--c-text-2)" }} />
                      </YAxis>
                      <ZAxis range={[80, 80]} />
                      <Tooltip content={<ScatterTooltip currentWeek={CURRENT_WEEK} />} />
                      <ReferenceLine y={95} stroke="#1D9E75" strokeDasharray="4 3" strokeWidth={1.5} />
                      <ReferenceLine y={85} stroke="#EF9F27" strokeDasharray="4 3" strokeWidth={1.5} />
                      <Scatter data={scatterData} shape={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={18} fill={payload.color} fillOpacity={0.15} stroke={payload.color} strokeWidth={1.5} />
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600" fill={payload.color}>{payload.avatar}</text>
                          </g>
                        );
                      }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={15} color="#EF9F27" />
                  <h3 className="card-title">Analyse du groupe — {selectedDisc}</h3>
                  <span className="text-[12px] bg-[rgba(255,255,255,0.08)] text-[var(--c-text-2)] px-2 py-1 rounded-full font-medium ml-1">Analyse automatique</span>
                </div>
                <div className="space-y-2">
                  {analysis.map((line, i) => <p key={i} className="text-[13px] bg-[var(--c-surface-2)] rounded-lg px-4 py-3 leading-relaxed" style={{ color: "var(--c-text-2)" }}>{line}</p>)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Vue évolution individuelle ────────────────────────────────────── */}
      {viewMode === "evolution" && (
        <div className="space-y-6">
          <div className="card p-5">
            <label htmlFor="performance-athlete" className="metric-label block mb-2">Sélectionner un athlète</label>
            <div className="relative">
              <select id="performance-athlete" value={selectedAthleteId ?? ""} onChange={(e) => setSelectedAthleteId(Number(e.target.value))} className="input-premium" style={{ paddingLeft: 40 }}>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <User size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--c-text-3)]" />
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="section-title">Historique des compétitions</h3>
                <p className="secondary-text mt-1">Progression sur l'épreuve : {selectedDisc}</p>
              </div>
              {evolutionData.length > 0 && (
                <div className="text-right">
                  <p className="metric-label">Meilleur résultat</p>
                  <p className="text-[20px] font-bold" style={{ color: "var(--tone-success)" }}>
                    {bestEvolution?.resultStr}
                  </p>
                </div>
              )}
            </div>

            {evolutionData.length < 2 ? (
              <div className="h-[300px] flex flex-col items-center justify-center rounded-lg border border-dashed" style={{ color: "var(--c-text-3)", background: "var(--c-surface-2)", borderColor: "var(--c-border)" }}>
                <Calendar size={32} className="mb-2 opacity-50" />
                <p className="text-[14px] font-medium">Pas assez de données</p>
                <p className="meta-text mt-1">Au moins 2 compétitions sur cette épreuve sont nécessaires.</p>
              </div>
            ) : (
              <div className="h-[350px]" role="img" aria-label={`Évolution des résultats de l'athlète sélectionné sur ${selectedDisc}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-border)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--c-text-2)" }} dy={10} />
                    <YAxis domain={["dataMin", "dataMax"]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--c-text-2)" }} reversed={isTimeEvent} tickFormatter={(val) => isTimeEvent && val > 60 ? `${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, "0")}` : val} />
                    <Tooltip content={<LineTooltip />} />
                    <Line type="monotone" dataKey="resultNum" stroke="#1D9E75" strokeWidth={3} dot={{ r: 5, fill: "#1D9E75", strokeWidth: 2, stroke: "var(--c-surface)" }} activeDot={{ r: 7, strokeWidth: 0, fill: "#1D9E75" }} animationDuration={800} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(Performances);
