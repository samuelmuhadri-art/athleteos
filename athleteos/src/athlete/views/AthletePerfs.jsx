// ============================================================
// AthleteOS — src/athlete/views/AthletePerfs.jsx  ★ DESIGN PREMIUM DARK v2
// Même logique métier que l'original (fetch, insert, update, delete
// Supabase 100% inchangés). Seul le rendu visuel change :
//   - Header + tabs alignés sur le style du Dashboard (dark, var(--c-*))
//   - Records : ring de progression PR (plus de blocs plats blancs)
//   - Évolution : chips toujours lisibles (fix du bug blanc-sur-blanc)
//   - Objectifs : ring + badge J-X cohérents avec le reste de l'app
//   - Compétitions : card dark alignée
//   - Modals : bg-white → var(--c-surface) partout
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Trophy, Target, BarChart2, CheckCircle,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine,
} from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { getDiscHib, parsePerf, toLocalDateStr, getISOWeek, isBetterOrEqual, pctOfReference } from "../shared";
import { resolveDisciplineId } from "../../domain/disciplines.js";
import { notifyGoalAchieved, postClubCelebration } from "../../utils/notifications";
import { getAthleteMetricsForWeek } from "../../utils/chargeCalculations";
import MesRapports from "./MesRapports";
import { COMBINE_EVENTS, discColor } from "./perfsShared";
import { ConfettiBurst, PerfTooltip, ProgressRing, RecordCard, GoalProgressBar } from "./PerfsWidgets";
import AddPerfModal from "./AddPerfModal";
import AddGoalModal from "./AddGoalModal";
import AddCompModal from "./AddCompModal";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePerfs({ athlete, competitions, myPerformances, myGoals, clubId, weeklyCharge, sessions, onRefresh }) {
  const today = new Date();

  const [activeTab,    setActiveTab]    = useState("records");
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [showAddPerf,  setShowAddPerf]  = useState(false);
  const [showAddGoal,  setShowAddGoal]  = useState(false);
  const [savingPerf,   setSavingPerf]   = useState(false);
  const [savingGoal,   setSavingGoal]   = useState(false);
  const [showAddComp,  setShowAddComp]  = useState(false);
  const [savingComp,   setSavingComp]   = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [compForm,     setCompForm]     = useState({
    name: "", date: toLocalDateStr(new Date()),
    location: "", type: "Régionale", event: "", result: "", context: "", breakdown: {},
  });

  const [perfForm, setPerfForm] = useState({
    discipline: "", value: "", performance_date: toLocalDateStr(today), context: "", breakdown: {},
  });
  const [goalForm, setGoalForm] = useState({
    discipline: "", target_value: "", deadline: "", notes: "",
  });

  const [localPerfs, setLocalPerfs] = useState(myPerformances ?? []);
  const [localGoals, setLocalGoals] = useState(myGoals ?? []);

  useEffect(() => { setLocalPerfs(myPerformances ?? []); }, [myPerformances]);
  useEffect(() => { setLocalGoals(myGoals ?? []);        }, [myGoals]);

  const disciplines = Object.keys(athlete.records ?? {});

  useEffect(() => {
    if (!selectedDisc && disciplines.length > 0) setSelectedDisc(disciplines[0]);
  }, [disciplines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = useMemo(() => {
    const disc = selectedDisc ?? disciplines[0];
    if (!disc) return [];
    return localPerfs
      .filter(p => p.discipline === disc && p.value != null)
      .sort((a, b) => a.performance_date.localeCompare(b.performance_date))
      .map(p => ({
        date:      p.performance_date.slice(0, 10),
        label:     new Date(p.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" }),
        value:     parseFloat(p.value) || 0,
        raw:       p.value,
        ctx:       p.context,
        breakdown: p.breakdown,
      }));
  }, [localPerfs, selectedDisc, disciplines]);

  // Zone ombrée entre le PR actuel et l'objectif visé sur la discipline
  // affichée — visualise d'un coup d'œil l'écart qu'il reste à combler.
  const goalZone = useMemo(() => {
    const disc = selectedDisc ?? disciplines[0];
    if (!disc) return null;
    const goal = localGoals.find(g => !g.achieved && g.discipline === disc);
    if (!goal) return null;
    const targetP = parsePerf(goal.target_value);
    if (targetP.value == null) return null;
    const rec   = athlete.records?.[disc];
    const prP   = rec?.pr ? parsePerf(rec.pr) : null;
    const prVal = prP?.value ?? null;
    const y1 = prVal != null ? Math.min(prVal, targetP.value) : targetP.value;
    const y2 = prVal != null ? Math.max(prVal, targetP.value) : targetP.value;
    return { target: targetP.value, prVal, y1, y2 };
  }, [selectedDisc, disciplines, localGoals, athlete.records]);

  const compHistory = useMemo(() => {
    const all = [];
    (competitions ?? []).forEach(c => {
      if (!c.athleteIds?.includes(athlete.id)) return;
      (c.results ?? []).filter(r => r.athleteId === athlete.id).forEach(r => {
        all.push({ comp: c, result: r });
      });
    });
    return all.sort((a, b) => new Date(b.comp.date) - new Date(a.comp.date));
  }, [competitions, athlete.id]);

  // Charge (ACWR) au moment de chaque compétition vs % du PR réalisé —
  // permet de voir si les bonnes performances arrivent en zone de charge
  // optimale (0.8–1.3) ou plutôt en surcharge/sous-charge.
  const chargeVsPerfData = useMemo(() => {
    if (!selectedDisc || !weeklyCharge?.length) return [];
    const rec = athlete.records?.[selectedDisc];
    if (!rec?.pr) return [];
    const prP = parsePerf(rec.pr);
    if (prP.value == null) return [];
    const hib = getDiscHib(selectedDisc);
    return compHistory
      .filter(({ result }) => result.event === selectedDisc)
      .map(({ comp, result }) => {
        const resP = parsePerf(result.result);
        if (resP.value == null || prP.value === 0) return null;
        const pct = hib
          ? Math.min(105, Math.round((resP.value / prP.value) * 1000) / 10)
          : Math.min(105, Math.round((prP.value / resP.value) * 1000) / 10);
        const week    = getISOWeek(new Date(comp.date));
        const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week);
        return { x: metrics.acwr, y: pct, compName: comp.name, date: comp.date, resultStr: result.result };
      })
      .filter(Boolean);
  }, [compHistory, selectedDisc, athlete.records, weeklyCharge]);

  // Tâche 11 : "meilleure" performance déterminée via le moteur central
  // (isBetterOrEqual, qui consulte getDiscHib) — avant ce fix, un simple
  // "v > best.v" retenait systématiquement la plus grande valeur, ce qui
  // est faux pour toute discipline chronométrée (un 12.50 aurait été
  // "meilleur" qu'un 11.00 sur 100m).
  const disciplineStats = useMemo(() => {
    const map = {};
    localPerfs.forEach(p => {
      if (!map[p.discipline]) map[p.discipline] = { count: 0, best: null, last: null };
      map[p.discipline].count++;
      const v = parsePerf(p.value).value;
      if (v != null) {
        if (!map[p.discipline].best || isBetterOrEqual(v, map[p.discipline].best.v, p.discipline))
          map[p.discipline].best = { v, date: p.performance_date, raw: p.value };
        map[p.discipline].last = { v, date: p.performance_date, raw: p.value };
      }
    });
    return map;
  }, [localPerfs]);

  const activeGoals   = localGoals.filter(g => !g.achieved);
  const achievedGoals = localGoals.filter(g =>  g.achieved);

  // ── Détection + mise à jour automatique du record (PR/SB) ────────────────
  // Partagée entre "Saisir une performance" ET "Ajouter une compétition" —
  // avant ce fix, seule la 1ère mettait le record à jour ; un résultat de
  // compétition qui battait le PR ne le faisait jamais remonter.
  const maybeUpdateRecord = async (disc, resultStr, dateStr) => {
    const newVal = parsePerf(resultStr);
    if (newVal.value == null) return false;
    const curRec = athlete.records?.[disc];
    const curPR  = curRec ? parsePerf(curRec.pr) : null;
    const curSB  = curRec ? parsePerf(curRec.sb) : null;
    const isThisYear = dateStr.slice(0, 4) === new Date().getFullYear().toString();

    const isPR = !curPR?.value || isBetterOrEqual(newVal.value, curPR.value, disc);
    const isSB = isThisYear && (!curSB?.value || isBetterOrEqual(newVal.value, curSB.value, disc));
    if (!isPR && !isSB) return false;

    // Pas de contrainte UNIQUE(athlete_id,discipline) en base — un
    // .upsert(onConflict:...) échoue silencieusement en 400 ici (record
    // jamais sauvé). On vérifie l'existence nous-mêmes et on update/insert
    // explicitement, comme le fait déjà Competitions.jsx côté coach.
    const { data: existingRow } = await supabase.from("records").select("id")
      .eq("athlete_id", athlete.id).eq("discipline", disc).maybeSingle();
    const patch = {
      ...(isPR ? { pr: resultStr, pr_date: dateStr } : {}),
      ...(isSB ? { sb: resultStr } : {}),
      ...(!curPR?.value ? { pr: resultStr, pr_date: dateStr, sb: resultStr } : {}),
    };
    if (existingRow) {
      await supabase.from("records").update(patch).eq("id", existingRow.id);
    } else {
      await supabase.from("records").insert({ athlete_id: athlete.id, discipline: disc, ...patch });
    }
    if (athlete.records) {
      athlete.records[disc] = {
        ...curRec,
        ...(isPR ? { pr: resultStr, prDate: dateStr } : {}),
        ...(isSB ? { sb: resultStr } : {}),
      };
    }
    if (isPR) {
      postClubCelebration(clubId, athlete.id, "record",
        `${athlete.name.split(" ")[0]} a battu son record en ${disc} : ${resultStr} !`).catch(console.warn);
      setShowConfetti(true);
    }
    return isPR;
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAddPerf = async () => {
    if (!perfForm.discipline.trim() || !perfForm.value.trim()) return;
    setSavingPerf(true);
    try {
      // Tâche 9 : normalise un alias saisi librement ("100 m" -> "100m")
      // vers l'identifiant canonique avant d'écrire en base — une
      // discipline personnalisée qui ne correspond à rien de connu passe
      // telle quelle (trim uniquement), le registre officiel n'est jamais
      // pollué par une saisie libre.
      const disc = resolveDisciplineId(perfForm.discipline);
      const isCombine = !!COMBINE_EVENTS[disc];
      const cleanBreakdown = isCombine
        ? Object.fromEntries(Object.entries(perfForm.breakdown).filter(([, v]) => v?.trim()))
        : null;

      const { data, error } = await supabase
        .from("athlete_performances")
        .insert({
          athlete_id:       athlete.id,
          club_id:          clubId,
          discipline:       disc,
          discipline_type:  disc,
          value:            perfForm.value,
          performance_date: perfForm.performance_date,
          context:          perfForm.context || null,
          breakdown:        cleanBreakdown && Object.keys(cleanBreakdown).length ? cleanBreakdown : null,
        })
        .select().single();
      if (error) throw error;
      setLocalPerfs(prev => [...prev, data]);

      await maybeUpdateRecord(disc, perfForm.value, perfForm.performance_date);

      // Bascule l'onglet Évolution sur la discipline qu'on vient de saisir —
      // sinon elle reste affichée sur l'ancienne sélection et la nouvelle
      // discipline ajoutée (ex: Décathlon) semble "ne rien afficher" alors
      // qu'elle est bien enregistrée, juste pas sélectionnée.
      setSelectedDisc(disc);

      setPerfForm({ discipline: disc, value: "", performance_date: toLocalDateStr(today), context: "", breakdown: {} });
      setShowAddPerf(false);
    } catch (e) {
      console.error("Erreur ajout perf:", e);
    } finally {
      setSavingPerf(false);
    }
  };

  const handleAddGoal = async () => {
    if (!goalForm.discipline.trim() || !goalForm.target_value.trim()) return;
    setSavingGoal(true);
    try {
      const { data, error } = await supabase
        .from("athlete_goals")
        .insert({
          athlete_id:   athlete.id,
          club_id:      clubId,
          discipline:   resolveDisciplineId(goalForm.discipline), // tâche 9 : alias -> id canonique
          target_value: goalForm.target_value,
          deadline:     goalForm.deadline || null,
          description:  goalForm.notes || null,
          achieved:     false,
        })
        .select().single();
      if (error) throw error;
      setLocalGoals(prev => [data, ...prev]);
      setGoalForm({ discipline: "", target_value: "", deadline: "", notes: "" });
      setShowAddGoal(false);
      onRefresh?.();
    } catch (e) {
      console.error("Erreur ajout objectif:", e);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleMarkGoalDone = async (goalId) => {
    const goal = localGoals.find(g => g.id === goalId);
    setLocalGoals(prev => prev.map(g => g.id === goalId ? { ...g, achieved: true } : g));
    await supabase.from("athlete_goals").update({ achieved: true }).eq("id", goalId);
    if (goal) {
      notifyGoalAchieved(clubId, athlete.id, goal.discipline, goal.target_value).catch(console.warn);
      postClubCelebration(clubId, athlete.id, "goal",
        `${athlete.name.split(" ")[0]} a atteint son objectif en ${goal.discipline} : ${goal.target_value} !`).catch(console.warn);
    }
    onRefresh?.();
  };

  const handleDeleteGoal = async (goalId) => {
    setLocalGoals(prev => prev.filter(g => g.id !== goalId));
    await supabase.from("athlete_goals").delete().eq("id", goalId);
    onRefresh?.();
  };

  const handleDeletePerf = async (perfId) => {
    setLocalPerfs(prev => prev.filter(p => p.id !== perfId));
    await supabase.from("athlete_performances").delete().eq("id", perfId);
  };

  const handleAddComp = async () => {
    if (!compForm.name.trim() || !compForm.date || !compForm.event.trim() || !compForm.result.trim()) return;
    setSavingComp(true);
    try {
      // Tâche 9 : normalise un alias saisi librement avant d'écrire en base.
      const event = resolveDisciplineId(compForm.event);
      const { data: comp, error: ce } = await supabase.from("competitions").insert({
        club_id:  clubId,
        name:     compForm.name.trim(),
        date:     compForm.date,
        location: compForm.location || null,
        type:     compForm.type,
      }).select().single();
      if (ce) throw ce;

      await supabase.from("competition_athletes").insert({
        competition_id: comp.id,
        athlete_id:     athlete.id,
        planned_event:  event,
      });

      await supabase.from("competition_results").insert({
        competition_id: comp.id,
        athlete_id:     athlete.id,
        event:          event,
        result:         compForm.result,
        context:        compForm.context || null,
      });

      // Un résultat de compétition doit aussi apparaître dans l'onglet
      // Évolution — avant ce fix, seule "Saisir une performance" écrivait
      // dans athlete_performances, donc les résultats de compétition
      // (le cas normal pour un décathlon par ex.) n'y apparaissaient jamais.
      const isCombine = !!COMBINE_EVENTS[event];
      const cleanBreakdown = isCombine
        ? Object.fromEntries(Object.entries(compForm.breakdown).filter(([, v]) => v?.trim()))
        : null;
      const { data: perfRow, error: pe } = await supabase
        .from("athlete_performances")
        .insert({
          athlete_id:       athlete.id,
          club_id:          clubId,
          discipline:       event,
          discipline_type:  event,
          value:            compForm.result,
          performance_date: compForm.date,
          context:          compForm.name.trim(),
          breakdown:        cleanBreakdown && Object.keys(cleanBreakdown).length ? cleanBreakdown : null,
        })
        .select().single();
      if (pe) throw pe;
      setLocalPerfs(prev => [...prev, perfRow]);

      // Un résultat de compétition qui bat le PR/SB doit mettre le record à
      // jour tout seul — avant ce fix, seule "Saisir une performance" le
      // faisait, jamais cette modale-ci.
      await maybeUpdateRecord(event, compForm.result, compForm.date);

      // Idem que pour "Saisir une performance" : bascule Évolution sur la
      // discipline qu'on vient d'ajouter, sinon elle reste sur l'ancienne
      // sélection et semble vide alors qu'elle est bien enregistrée.
      setSelectedDisc(event);

      setCompForm({ name: "", date: toLocalDateStr(new Date()), location: "", type: "Régionale", event: "", result: "", context: "", breakdown: {} });
      setShowAddComp(false);
      onRefresh?.();
    } catch (e) {
      console.error("Erreur ajout compétition:", e);
    } finally {
      setSavingComp(false);
    }
  };

  const PERF_TABS = [
    { id: "records",   label: "Records" },
    { id: "evolution", label: "Évolution" },
    { id: "objectifs", label: activeGoals.length > 0 ? `Objectifs (${activeGoals.length})` : "Objectifs" },
    { id: "comps",     label: "Compétitions" },
    { id: "rapports",  label: "Rapports" },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-5 space-y-4 max-w-4xl mx-auto animate-slide-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--c-text-1)", letterSpacing: "-0.02em" }}>
            Mes performances
          </h2>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
            {disciplines.length} épreuve{disciplines.length !== 1 ? "s" : ""}
            {" · "}{localPerfs.length} mesure{localPerfs.length !== 1 ? "s" : ""}
            {compHistory.length > 0 && ` · ${compHistory.length} compétition${compHistory.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowAddPerf(true)} className="btn-primary">
          <Plus size={14} /> Saisir une perf
        </button>
      </div>

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl p-1.5 overflow-x-auto" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
        {PERF_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 rounded-xl text-center transition-all tap-feedback"
            style={{
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              background: activeTab === tab.id ? "#1D9E75" : "transparent",
              color: activeTab === tab.id ? "#0A150F" : "var(--c-text-3)",
              boxShadow: activeTab === tab.id ? "0 2px 8px rgba(29,158,117,0.25)" : "none",
              border: "none", cursor: "pointer",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* key={activeTab} force un remount à chaque changement d'onglet, ce qui
          déclenche .view-transition (fondu+glissement) au lieu d'un switch
          instantané — évite l'effet "ça saute" en cliquant sur les tabs. */}
      <div key={activeTab} className="view-transition">
      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET RECORDS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "records" && (
        <div className="space-y-3">
          {disciplines.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "var(--c-surface-2)" }}>
                <Trophy size={26} color="var(--c-text-4)" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Aucun record enregistré</p>
              <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 4 }}>Ton coach les ajoutera après tes premières compétitions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {disciplines.map(disc => (
                <RecordCard
                  key={disc}
                  disc={disc}
                  rec={athlete.records[disc]}
                  stats={disciplineStats[disc]}
                  onSeeEvolution={() => { setSelectedDisc(disc); setActiveTab("evolution"); }}
                />
              ))}
            </div>
          )}

          {compHistory.length > 0 && (
            <div className="card overflow-hidden">
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--c-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(234,179,8,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trophy size={12} color="#EAB308" />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)" }}>Dernières compétitions</p>
                </div>
                <button onClick={() => setActiveTab("comps")} style={{ fontSize: 11, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer" }}>
                  Tout voir →
                </button>
              </div>
              <div>
                {compHistory.slice(0, 3).map(({ comp, result }, i) => (
                  <div key={i} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(234,179,8,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trophy size={14} color="#EAB308" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-text-1)" }} className="truncate">{comp.name}</p>
                      <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                        {result.event} · <strong style={{ color: "#4DC9A0" }}>{result.result}</strong>
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--c-text-4)", flexShrink: 0 }}>
                      {new Date(comp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET ÉVOLUTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "evolution" && (
        <div className="space-y-3">

          {disciplines.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {disciplines.map(disc => {
                const col = discColor(disc);
                const sel = selectedDisc === disc;
                return (
                  <button key={disc} onClick={() => setSelectedDisc(disc)}
                    className="tap-feedback"
                    style={{
                      padding: "7px 13px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${sel ? col : "var(--c-border-strong)"}`,
                      background: sel ? col : "var(--c-surface-2)",
                      color: sel ? "#0A150F" : "var(--c-text-2)",
                      cursor: "pointer",
                      boxShadow: sel ? `0 2px 8px ${col}40` : "none",
                    }}>
                    {disc}
                  </button>
                );
              })}
            </div>
          )}

          <div className="card p-4">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-1)" }}>
                {selectedDisc ?? "Sélectionne une épreuve"}
              </p>
              <button onClick={() => setShowAddPerf(true)} style={{ fontSize: 11, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer" }}>
                + Saisir
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 16 }}>
              {chartData.length} mesure{chartData.length !== 1 ? "s" : ""}
            </p>

            {chartData.length < 2 ? (
              <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BarChart2 size={20} color="var(--c-text-4)" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 12, color: "var(--c-text-3)", textAlign: "center" }}>
                  Minimum 2 mesures pour afficher le graphique
                </p>
                <button onClick={() => setShowAddPerf(true)} style={{ fontSize: 12, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}>
                  + Saisir une performance
                </button>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPerfDark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} width={42}
                      domain={([min, max]) => {
                        // Étend l'échelle pour englober l'objectif s'il est hors des données actuelles.
                        const lo = goalZone ? Math.min(min, goalZone.y1) : min;
                        const hi = goalZone ? Math.max(max, goalZone.y2) : max;
                        const padding = (hi - lo) * 0.1 || 0.5;
                        return [Math.floor((lo - padding) * 100) / 100, Math.ceil((hi + padding) * 100) / 100];
                      }}
                      tickCount={6} />
                    <Tooltip content={<PerfTooltip />} />
                    {/* Zone entre le PR actuel et l'objectif — l'écart qu'il reste à combler */}
                    {goalZone && (
                      <ReferenceArea y1={goalZone.y1} y2={goalZone.y2} fill="#EAB308" fillOpacity={0.08} stroke="none" />
                    )}
                    {goalZone && (
                      <ReferenceLine y={goalZone.target} stroke="#EAB308" strokeDasharray="4 3" strokeWidth={1.5}
                        label={{ value: "Objectif", position: "insideTopRight", fontSize: 9, fill: "#EAB308" }} />
                    )}
                    <Area dataKey="value" name={selectedDisc ?? ""}
                      stroke="#1D9E75" fill="url(#gradPerfDark)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#1D9E75", strokeWidth: 2, stroke: "var(--c-surface)" }}
                      activeDot={{ r: 6, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>

                {selectedDisc && athlete.records?.[selectedDisc] && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)", fontSize: 12, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--c-text-3)" }}>
                      PR <strong style={{ color: "#4DC9A0", fontSize: 14 }}>{athlete.records[selectedDisc].pr}</strong>
                    </span>
                    <span style={{ color: "var(--c-text-3)" }}>
                      SB <strong style={{ color: "var(--c-text-2)" }}>{athlete.records[selectedDisc].sb}</strong>
                    </span>
                    {chartData.length >= 2 && (() => {
                      // Tâche 11 : le signe de `diff` seul ne dit rien de "mieux"
                      // ou "moins bien" — sur un chrono, une valeur qui BAISSE est
                      // une amélioration. `improved` tranche via getDiscHib, pas
                      // via le signe brut.
                      const diff  = chartData[chartData.length - 1].value - chartData[0].value;
                      const hib   = getDiscHib(selectedDisc);
                      const improved = diff === 0 ? null : (hib ? diff > 0 : diff < 0);
                      const col  = improved === null ? "var(--c-text-3)" : improved ? "#4DC9A0" : "#F19A9A";
                      const Icon = improved === null ? Minus : improved ? TrendingUp : TrendingDown;
                      return (
                        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: col }}>
                          <Icon size={13} />
                          {diff >= 0 ? "+" : ""}{diff.toFixed(2)}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>

          {chargeVsPerfData.length >= 2 && (
            <div className="card p-4">
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-1)" }}>Charge vs performance</p>
              <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2, marginBottom: 14 }}>
                ACWR au moment de chaque compétition (axe X) · % du PR réalisé (axe Y) — {selectedDisc}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 10, right: 14, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="x" type="number" domain={[0.4, 1.8]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="y" type="number" domain={[70, 105]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} width={36} />
                  <ZAxis range={[90, 90]} />
                  {/* Zone optimale infusée en fond plutôt que des lignes pointillées
                      — même esprit que la réglette ACWR du hero (bande de couleur,
                      pas de traits techniques) */}
                  <ReferenceArea x1={0.8} x2={1.3} fill="#1D9E75" fillOpacity={0.08} stroke="none" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 12, padding: "10px 12px", minWidth: 140 }}>
                        <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-text-1)" }}>{d.compName}</p>
                        <p style={{ fontSize: 10, color: "var(--c-text-3)", marginBottom: 6 }}>{new Date(d.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p style={{ fontSize: 11, color: "var(--c-text-2)" }}>Résultat : <strong style={{ color: "#4DC9A0" }}>{d.resultStr}</strong></p>
                        <p style={{ fontSize: 11, color: "var(--c-text-2)" }}>ACWR : <strong>{d.x.toFixed(2)}</strong> · % PR : <strong>{d.y}%</strong></p>
                      </div>
                    );
                  }} />
                  <Scatter data={chargeVsPerfData} fill="#1D9E75" shape={(props) => {
                    const { cx, cy, payload } = props;
                    const col = payload.y >= 95 ? "#1D9E75" : payload.y >= 85 ? "#E8A020" : "#E05252";
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={14} fill={col} fillOpacity={0.14} />
                        <circle cx={cx} cy={cy} r={8} fill={col} fillOpacity={0.9} stroke={col} strokeWidth={1} />
                      </g>
                    );
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 9.5, color: "var(--c-text-3)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(29,158,117,0.16)", border: "1px solid rgba(29,158,117,0.35)" }} />
                <span>Zone de charge optimale (0.80 – 1.30)</span>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="card overflow-hidden">
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--c-border)" }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-text-1)" }}>
                  Toutes les mesures — {selectedDisc}
                </p>
                <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{chartData.length} entrée{chartData.length > 1 ? "s" : ""}</span>
              </div>
              <div style={{ maxHeight: 256, overflowY: "auto" }}>
                {[...localPerfs].filter(p => p.discipline === selectedDisc).sort((a,b) => b.performance_date.localeCompare(a.performance_date)).map((p, i) => (
                  <div key={p.id} className="group" style={{ padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#1D9E75" }}>{p.value}</p>
                      {p.context && <p style={{ fontSize: 10.5, color: "var(--c-text-4)", fontStyle: "italic" }}>{p.context}</p>}
                      {p.breakdown && Object.keys(p.breakdown).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 5, maxWidth: 220 }}>
                          {Object.entries(p.breakdown).map(([ev, val]) => (
                            <span key={ev} style={{ fontSize: 9.5, color: "var(--c-text-4)" }}>
                              {ev} <strong style={{ color: "var(--c-text-3)" }}>{val}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <p style={{ fontSize: 10.5, color: "var(--c-text-3)", fontWeight: 500 }}>
                        {new Date(p.performance_date + "T00:00:00").toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <button
                        onClick={() => handleDeletePerf(p.id)}
                        className="tap-feedback"
                        style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(224,82,82,0.10)", border: "none", cursor: "pointer", color: "#F19A9A", fontSize: 10.5, fontWeight: 600 }}>
                        Suppr.
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET OBJECTIFS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "objectifs" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddGoal(true)} className="btn-primary">
              <Plus size={14} /> Ajouter un objectif
            </button>
          </div>

          {activeGoals.length === 0 && achievedGoals.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "rgba(234,179,8,0.10)" }}>
                <Target size={26} color="#EAB308" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Aucun objectif défini</p>
              <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 4 }}>Fixe-toi des objectifs pour rester motivé</p>
              <button onClick={() => setShowAddGoal(true)} className="btn-primary" style={{ marginTop: 18, marginInline: "auto" }}>
                <Plus size={14} /> Définir un objectif
              </button>
            </div>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <div className="space-y-2.5">
                  <p style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    En cours ({activeGoals.length})
                  </p>
                  {activeGoals.map(g => {
                    const daysLeft = g.deadline
                      ? Math.round((new Date(g.deadline) - today) / (1000 * 60 * 60 * 24))
                      : null;
                    const isUrgent = daysLeft !== null && daysLeft <= 14;
                    const col      = discColor(g.discipline);
                    const pr  = athlete.records?.[g.discipline]?.pr;
                    // Tâche 11 : parsePerf (pas parseFloat, qui tronque "4:32" à 4)
                    // + pctOfReference (pas un ratio PR/target écrit à la main, faux
                    // sens pour un objectif chronométré plus rapide que le PR).
                    const prN  = parsePerf(pr).value;
                    const tgN  = parsePerf(g.target_value).value;
                    const pct  = pctOfReference(prN, tgN, g.discipline);

                    return (
                      <div key={g.id} className="card p-4" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <ProgressRing pct={pct} color={isUrgent ? "#EAB308" : col} size={56} stroke={5} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>{g.discipline}</p>
                            {daysLeft !== null && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: isUrgent ? "rgba(234,179,8,0.14)" : "var(--c-surface-2)", color: isUrgent ? "#F0CB61" : "var(--c-text-3)" }}>
                                {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "Aujourd'hui !" : "Échu"}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 24, fontWeight: 700, color: col, letterSpacing: "-0.02em", lineHeight: 1 }}>
                            {g.target_value}
                          </p>
                          {g.notes && <p style={{ fontSize: 11, color: "var(--c-text-4)", fontStyle: "italic", marginTop: 6 }}>{g.notes}</p>}
                          {g.deadline && (
                            <p style={{ fontSize: 10.5, color: "var(--c-text-4)", marginTop: 4 }}>
                              Échéance : {new Date(g.deadline).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          )}
                          <GoalProgressBar pr={pr} target={g.target_value} discipline={g.discipline} color={col} />
                          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                            <button onClick={() => handleMarkGoalDone(g.id)}
                              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer" }}>
                              <CheckCircle size={13} /> Marquer atteint
                            </button>
                            <button onClick={() => handleDeleteGoal(g.id)}
                              style={{ fontSize: 11.5, fontWeight: 600, color: "#F19A9A", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {achievedGoals.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Atteints ({achievedGoals.length})
                  </p>
                  {achievedGoals.map(g => (
                    <div key={g.id} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, opacity: 0.55 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(29,158,117,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CheckCircle size={15} color="#1D9E75" />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>
                          {g.discipline} — {g.target_value}
                        </p>
                        {g.notes && <p style={{ fontSize: 10.5, color: "var(--c-text-4)" }}>{g.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET COMPÉTITIONS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "comps" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddComp(true)} className="btn-primary">
              <Plus size={14} /> Ajouter une compétition
            </button>
          </div>
          {compHistory.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "rgba(234,179,8,0.10)" }}>
                <Trophy size={26} color="#EAB308" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Aucune compétition enregistrée</p>
            </div>
          ) : (
            compHistory.map(({ comp, result }, i) => (
              <div key={i} className="card card-hover p-4">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(234,179,8,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trophy size={19} color="#EAB308" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>{comp.name}</p>
                      <span className="chip chip-neutral">{comp.type}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 12 }}>
                      {comp.location && `${comp.location} · `}
                      {new Date(comp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <div style={{ display: "inline-block", borderRadius: 14, padding: "10px 16px", background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.20)" }}>
                      <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4DC9A0", marginBottom: 3 }}>
                        {result.event}
                      </p>
                      <p style={{ fontSize: 21, fontWeight: 700, color: "#4DC9A0", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {result.result}
                      </p>
                    </div>
                    {result.context && (
                      <p style={{ fontSize: 11, color: "var(--c-text-4)", fontStyle: "italic", marginTop: 8 }}>{result.context}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET RAPPORTS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "rapports" && (
        <MesRapports athlete={athlete} sessions={sessions ?? []} weeklyCharge={weeklyCharge ?? []} />
      )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {showAddPerf && (
        <AddPerfModal
          disciplines={disciplines}
          perfForm={perfForm}
          setPerfForm={setPerfForm}
          onClose={() => setShowAddPerf(false)}
          onSubmit={handleAddPerf}
          saving={savingPerf}
        />
      )}
      {showAddGoal && (
        <AddGoalModal
          disciplines={disciplines}
          goalForm={goalForm}
          setGoalForm={setGoalForm}
          onClose={() => setShowAddGoal(false)}
          onSubmit={handleAddGoal}
          saving={savingGoal}
        />
      )}

      {showAddComp && (
        <AddCompModal
          compForm={compForm}
          setCompForm={setCompForm}
          onClose={() => setShowAddComp(false)}
          onSubmit={handleAddComp}
          saving={savingComp}
        />
      )}

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
    </div>
  );
}