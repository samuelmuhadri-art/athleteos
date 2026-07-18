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
  Trophy, TrendingUp, Zap, Users, ChevronDown, User, Calendar,
} from "lucide-react";
import { supabase }                   from "../utils/supabaseClient";
import { useAuth }                    from "../context/AuthContext";
import LoadingState                   from "../components/ui/LoadingState";
import ErrorState                     from "../components/ui/ErrorState";
import { getAthleteMetricsForWeek }   from "../utils/chargeCalculations";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATHLETE_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

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

function getAllDisciplines(athletes) {
  const set = new Set();
  athletes.forEach((a) => { Object.keys(a.records ?? {}).forEach((d) => set.add(d)); });
  return [...set].sort();
}

function parsePerf(str) {
  if (!str) return { value: null, higherIsBetter: true };
  const s = str.toString().trim();
  if (/^\d+:\d+/.test(s)) {
    const [min, sec] = s.split(":").map(Number);
    return { value: min * 60 + sec, higherIsBetter: false };
  }
  if (s.endsWith("m"))           return { value: parseFloat(s), higherIsBetter: true  };
  if (s.includes("pts"))         return { value: parseFloat(s), higherIsBetter: true  };
  if (s.endsWith("s") || /^\d+\.\d+$/.test(s)) return { value: parseFloat(s), higherIsBetter: false };
  const num = parseFloat(s);
  return { value: isNaN(num) ? null : num, higherIsBetter: true };
}

function computePctPR(sb, pr) {
  const sbP = parsePerf(sb), prP = parsePerf(pr);
  if (sbP.value === null || prP.value === null || prP.value === 0) return null;
  if (!sbP.higherIsBetter) return Math.min(100, Math.round((prP.value / sbP.value) * 1000) / 10);
  return Math.min(100, Math.round((sbP.value / prP.value) * 1000) / 10);
}

function rankAthletes(athletes, discipline) {
  const withRecord = athletes
    .filter((a) => a.records?.[discipline])
    .map((a) => {
      const rec = a.records[discipline];
      const sbP = parsePerf(rec.sb);
      const pct = computePctPR(rec.sb, rec.pr);
      const idx = athletes.findIndex((x) => x.id === a.id);
      return { athlete: a, rec, sbParsed: sbP, pct, colorIdx: idx % ATHLETE_COLORS.length };
    })
    .filter((e) => e.sbParsed.value !== null);
  const hib = withRecord[0]?.sbParsed.higherIsBetter ?? true;
  return withRecord.sort((a, b) => hib ? b.sbParsed.value - a.sbParsed.value : a.sbParsed.value - b.sbParsed.value);
}

function pctColor(pct) {
  if (pct === null) return "#94a3b8";
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
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-3 text-[12px] min-w-[170px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: d.color }}>{d.avatar}</div>
        <span className="font-bold text-slate-700">{d.name}</span>
      </div>
      <div className="space-y-0.5 text-slate-500">
        <p>Charge S{currentWeek} : <strong className="text-slate-700">{d.x} u</strong></p>
        <p>% PR atteint : <strong style={{ color: pctColor(d.y) }}>{d.y}%</strong></p>
        <p>SB : <strong className="text-slate-700">{d.sb}</strong></p>
        <p>PR : <strong className="text-emerald-600">{d.pr}</strong></p>
      </div>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-3 text-[12px] min-w-[150px]">
      <p className="font-bold text-slate-700 mb-1">{d.compName}</p>
      <p className="text-slate-500 text-[10px] mb-2">{label}</p>
      <p className="text-[14px] font-bold text-emerald-600">{d.resultStr}</p>
      {d.context && <p className="text-slate-400 text-[11px] mt-1 italic">"{d.context}"</p>}
    </div>
  );
};

const Podium = memo(({ ranked }) => {
  const top3 = ranked.slice(0, 3);
  const podiumConfig = [
    { data: top3[1], height: 80,  rank: 2, medal: "🥈", bg: "#E2E8F0", border: "#94A3B8" },
    { data: top3[0], height: 110, rank: 1, medal: "🥇", bg: "#FEF9C3", border: "#EF9F27" },
    { data: top3[2], height: 60,  rank: 3, medal: "🥉", bg: "#FEE2E2", border: "#F97316" },
  ].filter((p) => p.data);
  if (ranked.length === 0) return null;
  return (
    <div className="flex items-end justify-center gap-3 pb-4">
      {podiumConfig.map(({ data, height, medal, bg, border }) => (
        <div key={data.athlete.id} className="flex flex-col items-center gap-2" style={{ width: 120 }}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[13px] font-bold mx-auto mb-1.5 shadow-sm" style={{ background: ATHLETE_COLORS[data.colorIdx] }}>
              {data.athlete.avatar}
            </div>
            <p className="text-[12px] font-bold text-slate-700 leading-tight">{data.athlete.name.split(" ")[0]}</p>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{data.rec.sb}</p>
            {data.pct !== null && <p className="text-[10px] font-semibold mt-0.5" style={{ color: pctColor(data.pct) }}>{data.pct}% PR</p>}
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
  const CURRENT_WEEK = useMemo(() => getISOWeek(new Date()), []);

  const [athletes,       setAthletes]       = useState([]);
  const [weeklyCharge,   setWeeklyCharge]   = useState([]);
  const [historyResults, setHistoryResults] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [viewMode,       setViewMode]       = useState("group");
  const [selectedDisc,   setSelectedDisc]   = useState(null);
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
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

      // Charge calculée depuis sessions (même méthode que ChargeView)
      const sessionsRes = await supabase.from("sessions").select("id, week, duration_minutes, category").eq("club_id", clubId);
      let weeklyChargeComputed = [];
      if (!sessionsRes.error && sessionsRes.data.length) {
        const sessionIds = sessionsRes.data.map((s) => s.id);
        const saRes = await supabase.from("session_athletes").select("session_id, athlete_id, rpe").in("session_id", sessionIds);
        if (!saRes.error) {
          const byAthleteWeek = {};
          sessionsRes.data.forEach((s) => {
            saRes.data.filter((r) => r.session_id === s.id).forEach((r) => {
              if (r.rpe == null) return;
              const key = `${r.athlete_id}-${s.week}`;
              byAthleteWeek[key] = (byAthleteWeek[key] ?? 0) + (s.duration_minutes ?? 60) * r.rpe;
            });
          });
          weeklyChargeComputed = Object.entries(byAthleteWeek).map(([key, rawLoad]) => {
            const [athleteId, week] = key.split("-").map(Number);
            return { athleteId, week, rawLoad };
          });
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
      .filter((r) => r.athlete_id === selectedAthleteId && r.event === selectedDisc)
      .sort((a, b) => new Date(a.competitions.date) - new Date(b.competitions.date))
      .map((r) => {
        const parsed = parsePerf(r.result);
        return { date: new Date(r.competitions.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), fullDate: r.competitions.date, compName: r.competitions.name, resultStr: r.result, resultNum: parsed.value, higherIsBetter: parsed.higherIsBetter, context: r.context };
      })
      .filter((d) => d.resultNum !== null);
  }, [historyResults, selectedAthleteId, selectedDisc]);

  const isTimeEvent = evolutionData.length > 0 ? !evolutionData[0].higherIsBetter : false;

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des performances…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  if (allDisciplines.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Performances</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Classement du groupe par épreuve · Season Best</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-[15px] font-semibold text-slate-400">Aucun record enregistré pour l'instant</p>
          <p className="text-[12px] text-slate-300 mt-1 max-w-sm mx-auto">Dès que les athlètes auront ajouté leurs records, les classements apparaîtront ici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button onClick={() => setViewMode("group")} className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2 ${viewMode === "group" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}>
            <Users size={16} /> Classement Groupe
          </button>
          <button onClick={() => setViewMode("evolution")} className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2 ${viewMode === "evolution" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}>
            <TrendingUp size={16} /> Évolution Individuelle
          </button>
        </div>

        <div className="relative">
          <button onClick={() => setDropdownOpen((v) => !v)} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 transition-all min-w-[200px] justify-between">
            <span className="flex items-center gap-2"><Trophy size={15} color="#EF9F27" />{selectedDisc}</span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden min-w-[220px]">
              <div className="max-h-64 overflow-y-auto py-1">
                {allDisciplines.map((d) => (
                  <button key={d} onClick={() => { setSelectedDisc(d); setDropdownOpen(false); }}
                    className={["w-full text-left px-4 py-2 text-[13px] transition-colors", selectedDisc === d ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"].join(" ")}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Vue groupe ───────────────────────────────────────────────────── */}
      {viewMode === "group" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Users, bg: "bg-amber-50", color: "#EF9F27", label: "Athlètes", value: ranked.length, sub: `pratiquent ${selectedDisc}` },
              { icon: TrendingUp, bg: "bg-emerald-50", color: "#1D9E75", label: "Meilleur SB", value: ranked[0]?.rec.sb ?? "—", sub: ranked[0]?.athlete.name.split(" ")[0] ?? "—", valueColor: "#1D9E75" },
              { icon: Zap, bg: "bg-blue-50", color: "#378ADD", label: "% PR moyen groupe", value: avgPct !== null ? `${avgPct}%` : "—", sub: "de leurs records personnels", valueColor: pctColor(avgPct) },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
                  <card.icon size={18} color={card.color} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: card.valueColor ?? "#1e293b" }}>{card.value}</p>
                  <p className="text-[10px] text-slate-400">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {ranked.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-[15px] font-semibold text-slate-400">Aucun athlète n'a de record pour « {selectedDisc} »</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-[14px] font-semibold text-slate-700 mb-4">Podium — {selectedDisc}</h3>
                  {ranked.length >= 2 ? <Podium ranked={ranked} /> : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[18px] font-bold shadow-sm" style={{ background: ATHLETE_COLORS[ranked[0].colorIdx] }}>{ranked[0].athlete.avatar}</div>
                      <div className="text-center">
                        <p className="text-[15px] font-bold text-slate-700">{ranked[0].athlete.name}</p>
                        <p className="text-[18px] font-bold text-emerald-600 mt-1">{ranked[0].rec.sb}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Seul pratiquant dans le groupe</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50">
                    <h3 className="text-[14px] font-semibold text-slate-700">Classement complet</h3>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                    {ranked.map((r, i) => (
                      <div key={r.athlete.id} className="px-5 py-3.5 flex items-center gap-3">
                        <span className={["w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0", i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"].join(" ")}>{i + 1}</span>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: ATHLETE_COLORS[r.colorIdx] }}>{r.athlete.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700 truncate">{r.athlete.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.athlete.mainDiscipline ?? "—"}</p>
                        </div>
                        <div className="text-right flex-shrink-0 w-20">
                          <p className="text-[14px] font-bold text-slate-700">{r.rec.sb}</p>
                          <p className="text-[10px] text-slate-400">PR : {r.rec.pr}</p>
                        </div>
                        {r.pct !== null && (
                          <div className="w-16 text-right flex-shrink-0">
                            <p className="text-[12px] font-bold" style={{ color: pctColor(r.pct) }}>{r.pct}%</p>
                            <p className="text-[9px] text-slate-400">du PR</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {scatterData.length >= 2 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <div className="mb-4">
                    <h3 className="text-[14px] font-semibold text-slate-700">Charge vs Performance — {selectedDisc}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Charge S{CURRENT_WEEK} (axe X) · % du PR atteint (axe Y) · Chaque point = un athlète</p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="x" name="Charge" type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}>
                        <Label value="Charge (unités)" position="insideBottom" offset={-10} style={{ fontSize: 10, fill: "#94a3b8" }} />
                      </XAxis>
                      <YAxis dataKey="y" name="% PR" type="number" domain={[70, 105]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}>
                        <Label value="% PR" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: "#94a3b8" }} />
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
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="700" fill={payload.color}>{payload.avatar}</text>
                          </g>
                        );
                      }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={15} color="#EF9F27" />
                  <h3 className="text-[14px] font-semibold text-slate-700">Analyse du groupe — {selectedDisc}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-medium ml-1">Règles JS · sans IA</span>
                </div>
                <div className="space-y-2">
                  {analysis.map((line, i) => <p key={i} className="text-[13px] text-slate-600 bg-slate-50 rounded-lg px-4 py-3 leading-relaxed">{line}</p>)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Vue évolution individuelle ────────────────────────────────────── */}
      {viewMode === "evolution" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">Sélectionner un athlète</label>
            <div className="relative">
              <select value={selectedAthleteId ?? ""} onChange={(e) => setSelectedAthleteId(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-[14px] py-2.5 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800">Historique des compétitions</h3>
                <p className="text-[13px] text-slate-400">Progression sur l'épreuve : {selectedDisc}</p>
              </div>
              {evolutionData.length > 0 && (
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Meilleur résultat</p>
                  <p className="text-[20px] font-bold text-emerald-600">
                    {isTimeEvent ? Math.min(...evolutionData.map((d) => d.resultNum)) : Math.max(...evolutionData.map((d) => d.resultNum))}
                  </p>
                </div>
              )}
            </div>

            {evolutionData.length < 2 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <Calendar size={32} className="mb-2 opacity-50" />
                <p className="text-[14px] font-medium">Pas assez de données</p>
                <p className="text-[12px]">Au moins 2 compétitions sur cette épreuve sont nécessaires.</p>
              </div>
            ) : (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dy={10} />
                    <YAxis domain={["dataMin", "dataMax"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} reversed={isTimeEvent} tickFormatter={(val) => isTimeEvent && val > 60 ? `${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, "0")}` : val} />
                    <Tooltip content={<LineTooltip />} />
                    <Line type="monotone" dataKey="resultNum" stroke="#1D9E75" strokeWidth={3} dot={{ r: 5, fill: "#1D9E75", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, strokeWidth: 0, fill: "#059669" }} animationDuration={800} />
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