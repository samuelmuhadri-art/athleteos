// ============================================================
// AthleteOS — src/athlete/views/AthletePerfs.jsx  ★ DESIGN PREMIUM DARK v2
// Même logique métier que l'original (fetch, insert, update, delete
// Supabase 100% inchangés). Seul le rendu visuel change :
//   - Hero et navigation alignés sur les tokens premium de l'application
//   - Records : mini-courbes par discipline et hiérarchie PR/SB plus fine
//   - Évolution : indice commun où une hausse signifie toujours un progrès
//   - Objectifs et compétitions : cartes plus lisibles et moins massives
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Trophy, Target, BarChart2, CheckCircle,
  TrendingUp, TrendingDown, Minus, Activity, Flag, FileText, Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine,
} from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { getDiscHib, parsePerf, toLocalDateStr, getISOWeek, isBetterOrEqual, pctOfReference } from "../shared";
import { resolveDisciplineId, getDisciplineUnit } from "../../domain/disciplines.js";
import { notifyGoalAchieved, postClubCelebration, dispatchOutboxNotifications } from "../../utils/notifications";
import { getAthleteMetricsForWeek } from "../../utils/chargeCalculations";
import { parseLocalDate } from "../../utils/helpers";
import MesRapports from "./MesRapports";
import { COMBINE_EVENTS, discColor, performanceIndex } from "./perfsShared";
import { ConfettiBurst, PerfTooltip, ProgressRing, RecordCard, GoalProgressBar } from "./PerfsWidgets";
import AddPerfModal from "./AddPerfModal";
import AddGoalModal from "./AddGoalModal";
import AddCompModal from "./AddCompModal";
import { SegmentedTabs } from "../../components/ui/premium";

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

  const disciplines = useMemo(() => Object.keys(athlete.records ?? {}), [athlete.records]);

  useEffect(() => {
    if (!selectedDisc && disciplines.length > 0) setSelectedDisc(disciplines[0]);
  }, [selectedDisc, disciplines]);

  const chartData = useMemo(() => {
    const disc = selectedDisc ?? disciplines[0];
    if (!disc) return [];
    const reference = parsePerf(athlete.records?.[disc]?.pr).value;
    return localPerfs
      .filter(p => p.discipline === disc && p.value != null)
      .sort((a, b) => a.performance_date.localeCompare(b.performance_date))
      .map(p => {
        // Tâche 12 : préfère la valeur canonique déjà stockée (normalized_value)
        // à un parseFloat brut, qui donnait un résultat faux sur un format
        // "minutes:secondes" ("1:52" -> 1 au lieu de 112) — fallback sur
        // parsePerf() pour les lignes pas encore backfillées.
        const value = p.normalized_value ?? parsePerf(p.value).value ?? 0;
        const score = performanceIndex(value, reference, disc) ?? value;
        return {
          date: p.performance_date.slice(0, 10),
          label: parseLocalDate(p.performance_date.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "short" }),
          value,
          score,
          raw: p.value,
          ctx: p.context,
          breakdown: p.breakdown,
        };
      });
  }, [localPerfs, selectedDisc, disciplines, athlete.records]);

  // Zone ombrée entre le PR actuel et l'objectif visé sur la discipline
  // affichée — visualise d'un coup d'œil l'écart qu'il reste à combler.
  const goalZone = useMemo(() => {
    const disc = selectedDisc ?? disciplines[0];
    if (!disc) return null;
    const goal = localGoals.find(g => !g.achieved && g.discipline === disc);
    if (!goal) return null;
    const targetValue = parsePerf(goal.target_value).value;
    if (targetValue == null) return null;
    const rec   = athlete.records?.[disc];
    const prValue = rec?.pr ? parsePerf(rec.pr).value : null;
    if (prValue == null || prValue === 0) return null;
    const targetScore = performanceIndex(targetValue, prValue, disc);
    if (targetScore == null) return null;
    return { target: targetScore, y1: Math.min(100, targetScore), y2: Math.max(100, targetScore) };
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
        const week    = getISOWeek(parseLocalDate(comp.date.slice(0, 10)));
        const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week);
        return { x: metrics.acwr, y: pct, compName: comp.name, date: comp.date, resultStr: result.result };
      })
      .filter(Boolean);
  }, [compHistory, selectedDisc, athlete.id, athlete.records, weeklyCharge]);

  // Tâche 11 : "meilleure" performance déterminée via le moteur central
  // (isBetterOrEqual, qui consulte getDiscHib) — avant ce fix, un simple
  // "v > best.v" retenait systématiquement la plus grande valeur, ce qui
  // est faux pour toute discipline chronométrée (un 12.50 aurait été
  // "meilleur" qu'un 11.00 sur 100m).
  const disciplineStats = useMemo(() => {
    const map = {};
    localPerfs.forEach(p => {
      if (!map[p.discipline]) map[p.discipline] = { count: 0, best: null, last: null, series: [] };
      map[p.discipline].count++;
      const v = parsePerf(p.value).value;
      if (v != null) {
        map[p.discipline].series.push({ value: v, date: p.performance_date, raw: p.value });
        if (!map[p.discipline].best || isBetterOrEqual(v, map[p.discipline].best.v, p.discipline))
          map[p.discipline].best = { v, date: p.performance_date, raw: p.value };
        map[p.discipline].last = { v, date: p.performance_date, raw: p.value };
      }
    });
    Object.values(map).forEach(stats => {
      stats.series.sort((a, b) => a.date.localeCompare(b.date));
      stats.last = stats.series.at(-1) ?? null;
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

    // Tâche 14 : records a maintenant une contrainte UNIQUE(athlete_id,
    // discipline) et des colonnes numériques pr_value/sb_value (comparées
    // par les RPC de compétition, migration 20260730010000) — il faut les
    // maintenir à jour ici aussi, sinon une saisie manuelle "démode"
    // silencieusement la valeur numérique sans toucher au texte, et la
    // prochaine comparaison de record en compétition se ferait contre une
    // valeur obsolète.
    const { data: existingRow } = await supabase.from("records").select("id")
      .eq("athlete_id", athlete.id).eq("discipline", disc).maybeSingle();
    const patch = {
      // Tâche 12 : unité + discipline résolue tenues à jour à chaque écriture.
      unit: getDisciplineUnit(disc), discipline_id: disc,
      ...(isPR ? { pr: resultStr, pr_value: newVal.value, pr_date: dateStr } : {}),
      ...(isSB ? { sb: resultStr, sb_value: newVal.value } : {}),
      ...(!curPR?.value ? { pr: resultStr, pr_value: newVal.value, pr_date: dateStr, sb: resultStr, sb_value: newVal.value } : {}),
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
      // Tâche 12 : valeur canonique + unité + discipline résolue, calculées
      // ici (le client reste la seule source de vérité pour le parsing,
      // tâche 11) — une valeur non interprétable est quand même enregistrée
      // (on ne bloque pas la saisie manuelle d'un athlète) mais marquée pour
      // ne pas fausser silencieusement un tri/calcul ultérieur.
      const normalizedValue = parsePerf(perfForm.value).value;

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
          normalized_value: normalizedValue,
          unit:             getDisciplineUnit(disc),
          discipline_id:    disc,
          quality_flags:    normalizedValue == null ? ["unparsable"] : [],
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

  // Tâche 14 : un seul appel RPC atomique (create_solo_competition_result)
  // au lieu de jusqu'à 5 écritures successives (compétition, lien,
  // résultat, performance, record) — avant, une panne entre deux étapes
  // laissait par exemple une compétition sans aucun résultat, ou un
  // résultat enregistré sans que le record ne soit mis à jour. La
  // comparaison/mise à jour du record est aussi verrouillée côté serveur
  // contre deux soumissions concurrentes qui battraient le même record.
  const handleAddComp = async () => {
    if (!compForm.name.trim() || !compForm.date || !compForm.event.trim() || !compForm.result.trim()) return;
    setSavingComp(true);
    try {
      // Tâche 9 : normalise un alias saisi librement avant d'écrire en base.
      const event = resolveDisciplineId(compForm.event);
      const isCombine = !!COMBINE_EVENTS[event];
      const cleanBreakdown = isCombine
        ? Object.fromEntries(Object.entries(compForm.breakdown).filter(([, v]) => v?.trim()))
        : null;

      const { data, error } = await supabase.rpc("create_solo_competition_result", {
        p_name:             compForm.name.trim(),
        p_date:             compForm.date,
        p_location:         compForm.location || null,
        p_type:             compForm.type,
        p_event:            event,
        p_result:           compForm.result,
        p_result_value:     parsePerf(compForm.result).value,
        p_higher_is_better: getDiscHib(event),
        p_context:          compForm.context || null,
        p_idempotency_key:  crypto.randomUUID(),
        p_breakdown:        cleanBreakdown && Object.keys(cleanBreakdown).length ? cleanBreakdown : null,
        p_unit:             getDisciplineUnit(event),
      });
      if (error) throw error;

      // Reflète tout de suite le nouveau résultat dans l'onglet Évolution
      // (le rafraîchissement complet via onRefresh arrive juste après,
      // mais ceci évite un flash "vide" en attendant).
      if (data?.performanceId) {
        setLocalPerfs(prev => [...prev, {
          id: data.performanceId, athlete_id: athlete.id, club_id: clubId,
          discipline: event, discipline_type: event, value: compForm.result,
          performance_date: compForm.date, context: compForm.name.trim(),
          breakdown: cleanBreakdown && Object.keys(cleanBreakdown).length ? cleanBreakdown : null,
        }]);
      }
      if (data?.isNewRecord) setShowConfetti(true);

      await dispatchOutboxNotifications(data?.notifications);

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
    { id: "records",   label: "Records", icon: Trophy },
    { id: "evolution", label: "Évolution", icon: Activity },
    { id: "objectifs", label: activeGoals.length > 0 ? `Objectifs (${activeGoals.length})` : "Objectifs", icon: Target },
    { id: "comps",     label: "Compétitions", icon: Flag },
    { id: "rapports",  label: "Rapports", icon: FileText },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto animate-slide-up">

      <section className="card" style={{ position: "relative", overflow: "hidden", padding: 20, background: "linear-gradient(145deg, rgba(var(--club-accent-rgb, 29, 158, 117), 0.11), var(--c-surface) 48%, rgba(91,158,245,0.05))" }}>
        <div aria-hidden="true" style={{ position: "absolute", width: 260, height: 260, right: -110, top: -150, borderRadius: "50%", background: "radial-gradient(circle, rgba(var(--club-accent-rgb, 29, 158, 117), 0.16), transparent 68%)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 99, background: "rgba(29,158,117,0.10)", border: "1px solid rgba(77,201,160,0.18)", marginBottom: 12 }}>
              <Sparkles size={13} color="#7BD8B4" aria-hidden="true" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7BD8B4", letterSpacing: "0.05em", textTransform: "uppercase" }}>Performance lab</span>
            </div>
            <h1 className="page-title">Mes performances</h1>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-text-2)", marginTop: 6 }}>
              Lis ta progression, comprends tes tendances et transforme chaque mesure en repère.
            </p>
          </div>
          <button type="button" onClick={() => setShowAddPerf(true)} className="btn-primary" style={{ flexShrink: 0 }}>
            <Plus size={16} aria-hidden="true" /> Saisir une performance
          </button>
        </div>

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
          {[
            { value: disciplines.length, label: "Records suivis" },
            { value: localPerfs.length, label: "Mesures" },
            { value: activeGoals.length, label: "Objectifs actifs" },
          ].map((item, index) => (
            <div key={item.label} style={{ paddingInline: index === 0 ? 0 : 16, borderLeft: index === 0 ? "none" : "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--c-text-1)", fontVariantNumeric: "tabular-nums" }}>{item.value}</p>
              <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 6 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <SegmentedTabs
        className="aos-segmented-tabs--fill"
        ariaLabel="Sections des performances"
        items={PERF_TABS.map((tab) => ({
          ...tab,
          tabId: `athlete-perfs-tab-${tab.id}`,
          panelId: "athlete-perfs-panel",
        }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* key={activeTab} force un remount à chaque changement d'onglet, ce qui
          déclenche .view-transition (fondu+glissement) au lieu d'un switch
          instantané — évite l'effet "ça saute" en cliquant sur les tabs. */}
      <div
        key={activeTab}
        id="athlete-perfs-panel"
        role="tabpanel"
        aria-labelledby={`athlete-perfs-tab-${activeTab}`}
        className="view-transition"
      >
      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET RECORDS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "records" && (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Records personnels</h2>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>
                Ton meilleur niveau et la dynamique de tes dernières mesures.
              </p>
            </div>
            {disciplines.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--c-text-2)", flexShrink: 0 }}>{disciplines.length} discipline{disciplines.length > 1 ? "s" : ""}</span>
            )}
          </div>
          {disciplines.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "var(--c-surface-2)" }}>
                <Trophy size={26} color="var(--c-text-3)" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>Aucun record enregistré</p>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>Ton coach les ajoutera après tes premières compétitions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--c-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(234,179,8,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trophy size={15} color="#EAB308" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="card-title">Dernières compétitions</p>
                    <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 2 }}>Tes résultats les plus récents</p>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveTab("comps")} className="btn-ghost" style={{ minHeight: 44, fontSize: 12 }}>
                  Tout voir →
                </button>
              </div>
              <div>
                {compHistory.slice(0, 3).map(({ comp, result }, i) => (
                  <div key={`${comp.id}-${result.event}-${i}`} style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trophy size={16} color="#EAB308" aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" }} className="truncate">{comp.name}</p>
                      <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 3 }}>{result.event}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#7BD8B4", fontVariantNumeric: "tabular-nums" }}>{result.result}</p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 3 }}>
                        {parseLocalDate(comp.date.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                      </p>
                    </div>
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
        <div className="space-y-5">

          <div>
            <h2 className="section-title">Courbe de progression</h2>
            <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>
              Toutes les disciplines sont ramenées à un indice commun : 100 % correspond à ton record personnel.
            </p>
          </div>

          {disciplines.length > 0 && (
            <div style={{ display: "flex", overflowX: "auto", gap: 8, paddingBottom: 2, scrollbarWidth: "none" }}>
              {disciplines.map(disc => {
                const col = discColor(disc);
                const sel = selectedDisc === disc;
                return (
                  <button key={disc} type="button" aria-pressed={sel} onClick={() => setSelectedDisc(disc)}
                    className="tap-feedback"
                    style={{
                      minHeight: 44, padding: "0 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, flexShrink: 0,
                      border: `1px solid ${sel ? `${col}75` : "var(--c-border-strong)"}`,
                      background: sel ? `${col}18` : "var(--c-surface-2)",
                      color: sel ? col : "var(--c-text-2)", cursor: "pointer",
                      boxShadow: sel ? `inset 0 0 0 1px ${col}22` : "none",
                    }}>
                    {disc}
                  </button>
                );
              })}
            </div>
          )}

          <div className="card" style={{ overflow: "hidden", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedDisc && <span style={{ width: 8, height: 8, borderRadius: "50%", background: discColor(selectedDisc), boxShadow: `0 0 12px ${discColor(selectedDisc)}` }} />}
                  <h3 className="card-title">{selectedDisc ?? "Sélectionne une épreuve"}</h3>
                </div>
                <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 5 }}>
                  Indice de niveau · {chartData.length} mesure{chartData.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button type="button" onClick={() => setShowAddPerf(true)} className="btn-ghost" style={{ minHeight: 44, color: "#7BD8B4" }}>
                <Plus size={14} aria-hidden="true" /> Ajouter
              </button>
            </div>

            {chartData.length < 2 ? (
              <div style={{ minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BarChart2 size={22} color="var(--c-text-3)" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 13, color: "var(--c-text-2)", textAlign: "center" }}>
                  Minimum 2 mesures pour afficher le graphique
                </p>
                <button type="button" onClick={() => setShowAddPerf(true)} className="btn-ghost" style={{ minHeight: 44, color: "#7BD8B4" }}>
                  + Saisir une performance
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
                  <div style={{ padding: 12, borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Dernière mesure</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }} className="truncate">{chartData.at(-1)?.raw}</p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Record</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: selectedDisc ? discColor(selectedDisc) : "var(--c-accent)", marginTop: 4 }} className="truncate">{athlete.records?.[selectedDisc]?.pr ?? "—"}</p>
                  </div>
                  {(() => {
                    const delta = chartData.at(-1).score - chartData[0].score;
                    const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                    const color = delta > 0 ? "#7BD8B4" : delta < 0 ? "#F19A9A" : "var(--c-text-2)";
                    return (
                      <div style={{ padding: 12, borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
                        <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Dynamique</p>
                        <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 15, fontWeight: 700, color, marginTop: 4 }}>
                          <Icon size={15} aria-hidden="true" /> {delta > 0 ? "+" : ""}{delta.toFixed(1)} pts
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPerfPremium" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={selectedDisc ? discColor(selectedDisc) : "#1D9E75"} stopOpacity={0.24} />
                        <stop offset="92%" stopColor={selectedDisc ? discColor(selectedDisc) : "#1D9E75"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--c-text-3)" }} tickFormatter={value => `${value}%`} axisLine={false} tickLine={false} width={48}
                      domain={([min, max]) => {
                        const lo = goalZone ? Math.min(min, goalZone.y1) : min;
                        const hi = goalZone ? Math.max(max, goalZone.y2) : max;
                        const padding = Math.max(1.5, (hi - lo) * 0.14);
                        return [Math.floor(lo - padding), Math.ceil(hi + padding)];
                      }}
                      tickCount={5} />
                    <Tooltip content={<PerfTooltip />} />
                    {goalZone && (
                      <ReferenceArea y1={goalZone.y1} y2={goalZone.y2} fill="#EAB308" fillOpacity={0.07} stroke="none" />
                    )}
                    <ReferenceLine y={100} stroke="rgba(123,216,180,0.52)" strokeDasharray="3 4" strokeWidth={1}
                      label={{ value: "PR", position: "insideTopLeft", fontSize: 12, fill: "#7BD8B4" }} />
                    {goalZone && (
                      <ReferenceLine y={goalZone.target} stroke="#EAB308" strokeDasharray="4 3" strokeWidth={1.5}
                        label={{ value: "Objectif", position: "insideTopRight", fontSize: 12, fill: "#EAB308" }} />
                    )}
                    <Area dataKey="score" name={selectedDisc ?? ""}
                      stroke={selectedDisc ? discColor(selectedDisc) : "#1D9E75"} fill="url(#gradPerfPremium)"
                      strokeWidth={2.25}
                      dot={{ r: 3.5, fill: selectedDisc ? discColor(selectedDisc) : "#1D9E75", strokeWidth: 2, stroke: "var(--c-surface)" }}
                      activeDot={{ r: 5.5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-2)", flexWrap: "wrap" }}>
                  <span><strong style={{ color: "#7BD8B4" }}>100 %</strong> = record personnel</span>
                  {goalZone && <span><strong style={{ color: "#EAB308" }}>{goalZone.target.toFixed(1)} %</strong> = objectif</span>}
                </div>
              </>
            )}
          </div>

          {chargeVsPerfData.length >= 2 && (
            <div className="card" style={{ padding: 20 }}>
              <p className="card-title">Charge et niveau de performance</p>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-text-2)", marginTop: 4, marginBottom: 16 }}>
                ACWR au moment de chaque compétition (axe X) · % du PR réalisé (axe Y) — {selectedDisc}
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="x" type="number" domain={[0.4, 1.8]} tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="y" type="number" domain={[70, 105]} tickFormatter={value => `${value}%`} tick={{ fontSize: 12, fill: "var(--c-text-3)" }} axisLine={false} tickLine={false} width={46} />
                  <ZAxis range={[90, 90]} />
                  {/* Zone optimale infusée en fond plutôt que des lignes pointillées
                      — même esprit que la réglette ACWR du hero (bande de couleur,
                      pas de traits techniques) */}
                  <ReferenceArea x1={0.8} x2={1.3} fill="#1D9E75" fillOpacity={0.08} stroke="none" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 12, padding: "12px 14px", minWidth: 156 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{d.compName}</p>
                        <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 2, marginBottom: 8 }}>{parseLocalDate(d.date.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p style={{ fontSize: 12, color: "var(--c-text-2)" }}>Résultat : <strong style={{ color: "#7BD8B4" }}>{d.resultStr}</strong></p>
                        <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 3 }}>ACWR : <strong>{d.x.toFixed(2)}</strong> · Niveau : <strong>{d.y}%</strong></p>
                      </div>
                    );
                  }} />
                  <Scatter data={chargeVsPerfData} fill="#1D9E75" shape={(props) => {
                    const { cx, cy, payload } = props;
                    const col = payload.y >= 95 ? "#1D9E75" : payload.y >= 85 ? "#E8A020" : "#E05252";
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={10} fill={col} fillOpacity={0.13} />
                        <circle cx={cx} cy={cy} r={5.5} fill={col} fillOpacity={0.94} stroke="var(--c-surface)" strokeWidth={2} />
                      </g>
                    );
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: "var(--c-text-2)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(29,158,117,0.16)", border: "1px solid rgba(29,158,117,0.35)" }} />
                <span>Zone de charge optimale (0.80 – 1.30)</span>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="card overflow-hidden">
              <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--c-border)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" }}>
                  Toutes les mesures — {selectedDisc}
                </p>
                <span style={{ fontSize: 12, color: "var(--c-text-2)", flexShrink: 0 }}>{chartData.length} entrée{chartData.length > 1 ? "s" : ""}</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {[...localPerfs].filter(p => p.discipline === selectedDisc).sort((a,b) => b.performance_date.localeCompare(a.performance_date)).map((p, i) => (
                  <div key={p.id} className="group" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: selectedDisc ? discColor(selectedDisc) : "#7BD8B4", fontVariantNumeric: "tabular-nums" }}>{p.value}</p>
                      {p.context && <p style={{ fontSize: 13, color: "var(--c-text-2)", fontStyle: "italic", marginTop: 3 }} className="truncate">{p.context}</p>}
                      {p.breakdown && Object.keys(p.breakdown).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 6, maxWidth: 320 }}>
                          {Object.entries(p.breakdown).map(([ev, val]) => (
                            <span key={ev} style={{ fontSize: 12, color: "var(--c-text-2)" }}>
                              {ev} <strong style={{ color: "var(--c-text-1)" }}>{val}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <p style={{ fontSize: 12, color: "var(--c-text-2)", fontWeight: 500, textAlign: "right" }}>
                        {parseLocalDate(p.performance_date.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <button
                        type="button"
                        aria-label={`Supprimer la performance ${p.value}`}
                        onClick={() => handleDeletePerf(p.id)}
                        className="tap-feedback"
                        style={{ minHeight: 40, padding: "0 10px", borderRadius: 10, background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.12)", cursor: "pointer", color: "#F19A9A", fontSize: 12, fontWeight: 700 }}>
                        Supprimer
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
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Objectifs</h2>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>Des repères concrets entre ton niveau actuel et ta prochaine étape.</p>
            </div>
            <button type="button" onClick={() => setShowAddGoal(true)} className="btn-primary">
              <Plus size={16} aria-hidden="true" /> Ajouter
            </button>
          </div>

          {activeGoals.length === 0 && achievedGoals.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "rgba(234,179,8,0.10)" }}>
                <Target size={26} color="#EAB308" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>Aucun objectif défini</p>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>Fixe-toi une prochaine étape pour guider ta progression.</p>
              <button type="button" onClick={() => setShowAddGoal(true)} className="btn-primary" style={{ marginTop: 20, marginInline: "auto" }}>
                <Plus size={16} aria-hidden="true" /> Définir un objectif
              </button>
            </div>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <div className="space-y-3">
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    En cours ({activeGoals.length})
                  </p>
                  {activeGoals.map(g => {
                    const daysLeft = g.deadline
                      ? Math.round((parseLocalDate(g.deadline.slice(0, 10)) - today) / (1000 * 60 * 60 * 24))
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
                      <div key={g.id} className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: 20 }}>
                        <ProgressRing pct={pct} color={isUrgent ? "#EAB308" : col} size={56} stroke={4} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>{g.discipline}</p>
                            {daysLeft !== null && (
                              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 9px", borderRadius: 99, background: isUrgent ? "rgba(234,179,8,0.14)" : "var(--c-surface-2)", color: isUrgent ? "#F0CB61" : "var(--c-text-2)" }}>
                                {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "Aujourd'hui !" : "Échu"}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 24, fontWeight: 700, color: col, letterSpacing: "-0.02em", lineHeight: 1 }}>
                            {g.target_value}
                          </p>
                          {g.notes && <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-text-2)", fontStyle: "italic", marginTop: 8 }}>{g.notes}</p>}
                          {g.deadline && (
                            <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 6 }}>
                              Échéance : {parseLocalDate(g.deadline.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          )}
                          <GoalProgressBar pr={pr} target={g.target_value} discipline={g.discipline} color={col} />
                          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                            <button type="button" onClick={() => handleMarkGoalDone(g.id)}
                              style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 12, fontWeight: 700, color: "#7BD8B4", background: "none", border: "none", cursor: "pointer" }}>
                              <CheckCircle size={15} aria-hidden="true" /> Marquer atteint
                            </button>
                            <button type="button" onClick={() => handleDeleteGoal(g.id)}
                              style={{ minHeight: 44, padding: "0 8px", fontSize: 12, fontWeight: 700, color: "#F19A9A", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>
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
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Atteints ({achievedGoals.length})
                  </p>
                  {achievedGoals.map(g => (
                    <div key={g.id} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, opacity: 0.72 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(29,158,117,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CheckCircle size={15} color="#1D9E75" />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>
                          {g.discipline} — {g.target_value}
                        </p>
                        {g.notes && <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 3 }}>{g.notes}</p>}
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
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Compétitions</h2>
              <p style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 4 }}>Le contexte et le résultat de chaque rendez-vous.</p>
            </div>
            <button type="button" onClick={() => setShowAddComp(true)} className="btn-primary">
              <Plus size={16} aria-hidden="true" /> Ajouter
            </button>
          </div>
          {compHistory.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "rgba(234,179,8,0.10)" }}>
                <Trophy size={26} color="#EAB308" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>Aucune compétition enregistrée</p>
            </div>
          ) : (
            compHistory.map(({ comp, result }, i) => (
              <div key={`${comp.id}-${result.event}-${i}`} className="card card-hover" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(234,179,8,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trophy size={19} color="#EAB308" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>{comp.name}</p>
                      <span className="chip chip-neutral">{comp.type}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 12 }}>
                      {comp.location && `${comp.location} · `}
                      {parseLocalDate(comp.date.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <div style={{ display: "inline-block", borderRadius: 14, padding: "10px 16px", background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.20)" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7BD8B4", marginBottom: 4 }}>
                        {result.event}
                      </p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#7BD8B4", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {result.result}
                      </p>
                    </div>
                    {result.context && (
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-text-2)", fontStyle: "italic", marginTop: 10 }}>{result.context}</p>
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
