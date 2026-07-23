// ============================================================
// AthleteOS — src/athlete/views/AthletePerfs.jsx  ★ DESIGN PREMIUM
//
// Logique métier 100% identique.
// Rendu entièrement repoli :
//   - Header hero avec stats inline
//   - Tab bar pill premium (même style que Planning)
//   - Onglet Records : cards avec liseré coloré, badge PR/SB distincts,
//     indicateur "Dernière mesure", lien "Voir évolution"
//   - Onglet Évolution : sélecteur discipline chips, graphique AreaChart
//     premium avec tooltip custom, PR/SB + delta coloré en footer
//   - Onglet Objectifs : cards avec barre de progression PR→cible,
//     badge J-X urgent, bouton "Atteint !" prominent
//   - Onglet Compétitions : cards avec médaille et résultat en accent
//   - Modals Perf & Objectif : même charte que les modals Planning
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Trophy, Target, BarChart2, CheckCircle, X,
  TrendingUp, TrendingDown, Minus, Star, Zap, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { getDiscHib, parsePerf, DISC_TYPE_COLORS, DISC_PRESETS } from "../shared";

// ─── Couleurs par discipline ──────────────────────────────────────────────────
const DISC_COLORS = {
  "100m":       "#3B82F6", "200m":       "#8B5CF6", "400m":       "#F59E0B",
  "800m":       "#EF4444", "1500m":      "#EC4899", "3000m":      "#06B6D4",
  "110m haies": "#EF4444", "100m haies": "#EC4899", "400m haies": "#F97316",
  "Longueur":   "#10B981", "Triple saut":"#14B8A6", "Hauteur":    "#F97316",
  "Perche":     "#6366F1", "Poids":      "#84CC16", "Disque":     "#A78BFA",
  "Javelot":    "#FB923C", "Marteau":    "#34D399",
};
const discColor = (disc) => DISC_COLORS[disc] ?? "#1D9E75";

// ─── Tooltip graphique ────────────────────────────────────────────────────────
function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-card-md px-3.5 py-3 text-[12px] min-w-[110px]">
      <p className="font-bold text-slate-500 mb-1.5">{label}</p>
      <p className="text-[18px] font-black" style={{ color: "#1D9E75" }}>{d.raw}</p>
      {d.ctx && <p className="text-slate-400 italic mt-1 text-[11px]">{d.ctx}</p>}
    </div>
  );
}

// ─── Barre de progression PR → objectif ──────────────────────────────────────
function GoalProgress({ pr, target }) {
  if (!pr || !target) return null;
  const prN  = parseFloat(pr);
  const tgN  = parseFloat(target);
  if (isNaN(prN) || isNaN(tgN) || tgN <= prN) return null;
  const pct = Math.min(100, Math.round((prN / tgN) * 100));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
        <span>PR {pr}</span>
        <span className="text-emerald-600">{pct}%</span>
        <span>Objectif {target}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1D9E75, #16826C)" }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SAISIR UNE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
function AddPerfModal({ disciplines, perfForm, setPerfForm, onClose, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content">

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header vert */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #E8F7F2, #D1F0E6)", borderBottom: "2px solid #1D9E7540" }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-1.5"
              style={{ background: "#1D9E7520", border: "1px solid #1D9E7540" }}>
              <TrendingUp size={10} color="#1D9E75" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Saisir une performance</span>
            </div>
            <p className="text-[12px] font-medium text-emerald-700/70">Chrono, distance, hauteur…</p>
          </div>
          <button onClick={onClose} disabled={saving}
            className="p-2 rounded-xl hover:bg-black/10 disabled:opacity-40 transition-colors flex-shrink-0">
            <X size={18} color="#166534" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Épreuve */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Épreuve *</label>
            <input className="input-premium" placeholder="Ex: 100m, Longueur…"
              value={perfForm.discipline}
              onChange={e => setPerfForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {disciplines.map(d => (
                  <button key={d} onClick={() => setPerfForm(f => ({ ...f, discipline: d }))}
                    className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold border-2 transition-all tap-feedback"
                    style={perfForm.discipline === d
                      ? { background: discColor(d), color: "white", borderColor: discColor(d) }
                      : { background: "white", color: "#64748B", borderColor: "#E2E8F0" }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Résultat */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Résultat *</label>
            <input className="input-premium" placeholder="Ex: 10.94 ou 7.45m"
              value={perfForm.value}
              onChange={e => setPerfForm(f => ({ ...f, value: e.target.value }))} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Date</label>
            <input type="date" className="input-premium"
              value={perfForm.performance_date}
              onChange={e => setPerfForm(f => ({ ...f, performance_date: e.target.value }))} />
          </div>

          {/* Contexte */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Contexte (optionnel)</label>
            <input className="input-premium" placeholder="Ex: Vent +1.2m/s, finale régionale…"
              value={perfForm.context}
              onChange={e => setPerfForm(f => ({ ...f, context: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!perfForm.discipline.trim() || !perfForm.value.trim() || saving}
            className="btn-primary">
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</>
              : <><Plus size={14} />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AJOUTER UN OBJECTIF
// ═══════════════════════════════════════════════════════════════════════════════
function AddGoalModal({ disciplines, goalForm, setGoalForm, onClose, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content">

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header amber */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #FEF9C3, #FEF3C7)", borderBottom: "2px solid #EF9F2740" }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-1.5"
              style={{ background: "#EF9F2720", border: "1px solid #EF9F2740" }}>
              <Target size={10} color="#D97706" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">Nouvel objectif</span>
            </div>
            <p className="text-[12px] font-medium text-amber-700/70">Fixe-toi un cap à atteindre</p>
          </div>
          <button onClick={onClose} disabled={saving}
            className="p-2 rounded-xl hover:bg-black/10 disabled:opacity-40 transition-colors flex-shrink-0">
            <X size={18} color="#92400E" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Épreuve */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Épreuve *</label>
            <input className="input-premium" placeholder="Ex: 100m, Longueur…"
              value={goalForm.discipline}
              onChange={e => setGoalForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {disciplines.map(d => (
                  <button key={d} onClick={() => setGoalForm(f => ({ ...f, discipline: d }))}
                    className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold border-2 transition-all tap-feedback"
                    style={goalForm.discipline === d
                      ? { background: "#F59E0B", color: "white", borderColor: "#F59E0B" }
                      : { background: "white", color: "#64748B", borderColor: "#E2E8F0" }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Objectif */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Objectif à atteindre *</label>
            <input className="input-premium" placeholder="Ex: 10.80 ou 7.60m"
              value={goalForm.target_value}
              onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} />
          </div>

          {/* Échéance */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Échéance (optionnel)</label>
            <input type="date" className="input-premium"
              value={goalForm.deadline}
              onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Motivation, contexte…"
              value={goalForm.notes}
              onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!goalForm.discipline.trim() || !goalForm.target_value.trim() || saving}
            className="btn-primary">
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</>
              : <><Plus size={14} />Créer l'objectif</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePerfs({ athlete, competitions, myPerformances, myGoals, clubId, onRefresh }) {
  const today = new Date();

  const [activeTab,    setActiveTab]    = useState("records");
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [showAddPerf,  setShowAddPerf]  = useState(false);
  const [showAddGoal,  setShowAddGoal]  = useState(false);
  const [savingPerf,   setSavingPerf]   = useState(false);
  const [savingGoal,   setSavingGoal]   = useState(false);

  const [perfForm, setPerfForm] = useState({
    discipline: "", value: "", performance_date: today.toISOString().slice(0, 10), context: "",
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
  }, [disciplines.length]);

  // ── Data graphique évolution ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    const disc = selectedDisc ?? disciplines[0];
    if (!disc) return [];
    return localPerfs
      .filter(p => p.discipline === disc && p.value != null)
      .sort((a, b) => a.performance_date.localeCompare(b.performance_date))
      .map(p => ({
        date:  p.performance_date.slice(0, 10),
        label: new Date(p.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" }),
        value: parseFloat(p.value) || 0,
        raw:   p.value,
        ctx:   p.context,
      }));
  }, [localPerfs, selectedDisc, disciplines]);

  // ── Historique compétitions de cet athlète ───────────────────────────────
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

  // ── Stats par discipline (mesures locales) ───────────────────────────────
  const disciplineStats = useMemo(() => {
    const map = {};
    localPerfs.forEach(p => {
      if (!map[p.discipline]) map[p.discipline] = { count: 0, best: null, last: null };
      map[p.discipline].count++;
      const v = parseFloat(p.value);
      if (!isNaN(v)) {
        if (!map[p.discipline].best || v > map[p.discipline].best.v)
          map[p.discipline].best = { v, date: p.performance_date, raw: p.value };
        map[p.discipline].last = { v, date: p.performance_date, raw: p.value };
      }
    });
    return map;
  }, [localPerfs]);

  const activeGoals   = localGoals.filter(g => !g.achieved);
  const achievedGoals = localGoals.filter(g =>  g.achieved);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddPerf = async () => {
    if (!perfForm.discipline.trim() || !perfForm.value.trim()) return;
    setSavingPerf(true);
    try {
      const { data, error } = await supabase
        .from("athlete_performances")
        .insert({
          athlete_id:       athlete.id,
          club_id:          clubId,
          discipline:       perfForm.discipline,
          discipline_type:  perfForm.discipline,
          value:            perfForm.value,
          performance_date: perfForm.performance_date,
          context:          perfForm.context || null,
        })
        .select().single();
      if (error) throw error;
      setLocalPerfs(prev => [...prev, data]);
      setPerfForm({ discipline: perfForm.discipline, value: "", performance_date: today.toISOString().slice(0, 10), context: "" });
      setShowAddPerf(false);
      onRefresh?.();
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
          discipline:   goalForm.discipline,
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
    setLocalGoals(prev => prev.map(g => g.id === goalId ? { ...g, achieved: true } : g));
    await supabase.from("athlete_goals").update({ achieved: true }).eq("id", goalId);
    onRefresh?.();
  };

  const handleDeleteGoal = async (goalId) => {
    setLocalGoals(prev => prev.filter(g => g.id !== goalId));
    await supabase.from("athlete_goals").delete().eq("id", goalId);
    onRefresh?.();
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const PERF_TABS = [
    { id: "records",   label: "Records" },
    { id: "evolution", label: "Évolution" },
    { id: "objectifs", label: activeGoals.length > 0 ? `Objectifs (${activeGoals.length})` : "Objectifs" },
    { id: "comps",     label: "Compétitions" },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-5 space-y-4 max-w-4xl mx-auto animate-slide-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-black text-slate-800">Mes performances</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {disciplines.length} épreuve{disciplines.length !== 1 ? "s" : ""}
            {" · "}
            {localPerfs.length} mesure{localPerfs.length !== 1 ? "s" : ""}
            {compHistory.length > 0 && ` · ${compHistory.length} compétition${compHistory.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowAddPerf(true)} className="btn-primary">
          <Plus size={14} /> Saisir une perf
        </button>
      </div>

      {/* ── TAB BAR pill premium ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 shadow-card p-1.5 overflow-x-auto">
        {PERF_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all text-center tap-feedback"
            style={activeTab === tab.id
              ? { background: "#1D9E75", color: "white", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }
              : { color: "#64748B" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET RECORDS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {disciplines.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Trophy size={28} className="text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-bold text-slate-400">Aucun record enregistré</p>
              <p className="text-[12px] text-slate-300 mt-1">Ton coach les ajoutera après tes premières compétitions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {disciplines.map(disc => {
                const col   = discColor(disc);
                const rec   = athlete.records[disc];
                const stats = disciplineStats[disc];
                return (
                  <div key={disc} className="card-hover rounded-2xl overflow-hidden"
                    style={{ border: "1px solid #F1F5F9", background: "white" }}>
                    {/* Liseré coloré en haut */}
                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${col}, ${col}80)` }} />
                    <div className="p-5">
                      {/* Titre discipline */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: col + "15" }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: col }} />
                          </div>
                          <p className="text-[14px] font-black text-slate-800">{disc}</p>
                        </div>
                        <button
                          onClick={() => { setSelectedDisc(disc); setActiveTab("evolution"); }}
                          className="text-[10.5px] font-bold hover:opacity-80 transition-opacity flex items-center gap-0.5"
                          style={{ color: col }}>
                          Évolution →
                        </button>
                      </div>

                      {/* PR + SB */}
                      <div className="grid grid-cols-2 gap-2.5 mb-3">
                        <div className="rounded-2xl p-3 text-center" style={{ background: col + "10" }}>
                          <p className="text-[24px] font-black leading-none" style={{ color: col }}>
                            {rec.pr ?? "—"}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-wider mt-1.5" style={{ color: col + "90" }}>
                            Record perso
                          </p>
                          {rec.prDate && (
                            <p className="text-[9px] mt-0.5" style={{ color: col + "60" }}>
                              {new Date(rec.prDate).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                          <p className="text-[24px] font-black leading-none text-slate-600">
                            {rec.sb ?? "—"}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-wider mt-1.5 text-slate-400">
                            Season Best
                          </p>
                        </div>
                      </div>

                      {/* Stats mesures locales */}
                      {stats && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-3 border-t border-slate-50">
                          <span className="font-semibold text-slate-500">
                            {stats.count} mesure{stats.count > 1 ? "s" : ""}
                          </span>
                          {stats.last && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span>
                                Dernière : <strong className="text-slate-600">{stats.last.raw}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dernières compétitions en bas des records */}
          {compHistory.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Trophy size={13} color="#EF9F27" />
                  </div>
                  <h3 className="text-[14px] font-bold text-slate-800">Dernières compétitions</h3>
                </div>
                <button onClick={() => setActiveTab("comps")}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Tout voir →
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {compHistory.slice(0, 3).map(({ comp, result }, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Trophy size={14} color="#EF9F27" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-700 truncate">{comp.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {result.event} · <strong className="text-emerald-600">{result.result}</strong>
                      </p>
                    </div>
                    <span className="text-[10.5px] text-slate-400 flex-shrink-0">
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
        <div className="space-y-4">

          {/* Sélecteur discipline */}
          {disciplines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {disciplines.map(disc => {
                const col = discColor(disc);
                const sel = selectedDisc === disc;
                return (
                  <button key={disc} onClick={() => setSelectedDisc(disc)}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-bold border-2 transition-all tap-feedback"
                    style={sel
                      ? { background: col, color: "white", borderColor: col, boxShadow: `0 2px 8px ${col}40` }
                      : { background: "white", color: "#64748B", borderColor: "#E2E8F0" }}>
                    {disc}
                  </button>
                );
              })}
            </div>
          )}

          {/* Graphique */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[15px] font-black text-slate-800">
                {selectedDisc ?? "Sélectionne une épreuve"}
              </h3>
              <button onClick={() => setShowAddPerf(true)}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                + Saisir
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              {chartData.length} mesure{chartData.length !== 1 ? "s" : ""}
            </p>

            {chartData.length < 2 ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <BarChart2 size={22} className="text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-[12px] text-slate-400 text-center">
                  Minimum 2 mesures pour afficher le graphique
                </p>
                <button onClick={() => setShowAddPerf(true)}
                  className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors mt-1">
                  + Saisir une performance
                </button>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={45}
                      domain={([min, max]) => {
                        const padding = (max - min) * 0.1 || 0.5;
                        return [Math.floor((min - padding) * 100) / 100, Math.ceil((max + padding) * 100) / 100];
                      }}
                      tickCount={6} />
                    <Tooltip content={<PerfTooltip />} />
                    <Area dataKey="value" name={selectedDisc ?? ""}
                      stroke="#1D9E75" fill="url(#gradPerf)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#1D9E75", strokeWidth: 2, stroke: "white" }}
                      activeDot={{ r: 6, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Footer PR / SB / delta */}
                {selectedDisc && athlete.records?.[selectedDisc] && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-[12px] flex-wrap">
                    <span className="text-slate-400">
                      PR <strong className="text-emerald-600 text-[14px]">{athlete.records[selectedDisc].pr}</strong>
                    </span>
                    <span className="text-slate-400">
                      SB <strong className="text-slate-600">{athlete.records[selectedDisc].sb}</strong>
                    </span>
                    {chartData.length >= 2 && (() => {
                      const diff = chartData[chartData.length - 1].value - chartData[0].value;
                      const col  = diff >= 0 ? "#1D9E75" : "#E24B4A";
                      const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                      return (
                        <span className="ml-auto flex items-center gap-1 font-bold" style={{ color: col }}>
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

          {/* Tableau de toutes les mesures */}
          {chartData.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-800">
                  Toutes les mesures — {selectedDisc}
                </h3>
                <span className="text-[11px] text-slate-400">{chartData.length} entrée{chartData.length > 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {[...chartData].reverse().map((d, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="text-[15px] font-black text-emerald-600">{d.raw}</p>
                      {d.ctx && <p className="text-[11px] text-slate-400 italic">{d.ctx}</p>}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">{d.label}</p>
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddGoal(true)} className="btn-primary">
              <Plus size={14} /> Ajouter un objectif
            </button>
          </div>

          {activeGoals.length === 0 && achievedGoals.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Target size={28} color="#EF9F27" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-bold text-slate-400">Aucun objectif défini</p>
              <p className="text-[12px] text-slate-300 mt-1">Fixe-toi des objectifs pour rester motivé</p>
              <button onClick={() => setShowAddGoal(true)} className="mt-5 btn-primary mx-auto">
                <Plus size={14} /> Définir un objectif
              </button>
            </div>
          ) : (
            <>
              {/* Objectifs en cours */}
              {activeGoals.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest">
                    En cours ({activeGoals.length})
                  </p>
                  {activeGoals.map(g => {
                    const daysLeft = g.deadline
                      ? Math.round((new Date(g.deadline) - today) / (1000 * 60 * 60 * 24))
                      : null;
                    const isUrgent = daysLeft !== null && daysLeft <= 14;
                    const col      = discColor(g.discipline);

                    return (
                      <div key={g.id} className="card overflow-hidden">
                        {/* Liseré haut coloré */}
                        <div className="h-1 w-full"
                          style={{ background: isUrgent ? "#F59E0B" : col }} />
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <p className="text-[14px] font-bold text-slate-700">{g.discipline}</p>
                                {daysLeft !== null && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={isUrgent
                                      ? { background: "#FEF3C7", color: "#B45309" }
                                      : { background: "#F1F5F9", color: "#64748B" }}>
                                    {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "Aujourd'hui !" : "Échu"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[28px] font-black leading-tight" style={{ color: col }}>
                                {g.target_value}
                              </p>
                              {g.notes && (
                                <p className="text-[11.5px] text-slate-400 italic mt-1">{g.notes}</p>
                              )}
                              {g.deadline && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Échéance : {new Date(g.deadline).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                              )}

                              {/* Barre de progression PR → objectif */}
                              <GoalProgress
                                pr={athlete.records?.[g.discipline]?.pr}
                                target={g.target_value}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-3 border-t border-slate-50 mt-3">
                            <button onClick={() => handleMarkGoalDone(g.id)}
                              className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors tap-feedback">
                              <CheckCircle size={14} /> Marquer atteint
                            </button>
                            <button onClick={() => handleDeleteGoal(g.id)}
                              className="text-[12px] font-semibold text-red-400 hover:text-red-600 transition-colors ml-auto tap-feedback">
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Objectifs atteints */}
              {achievedGoals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest">
                    Atteints 🏆 ({achievedGoals.length})
                  </p>
                  {achievedGoals.map(g => (
                    <div key={g.id} className="card p-4 flex items-center gap-3 opacity-60">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={16} color="#1D9E75" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12.5px] font-bold text-slate-600">
                          {g.discipline} — {g.target_value}
                        </p>
                        {g.notes && <p className="text-[11px] text-slate-400">{g.notes}</p>}
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
          {compHistory.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Trophy size={28} color="#EF9F27" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-bold text-slate-400">Aucune compétition enregistrée</p>
            </div>
          ) : (
            compHistory.map(({ comp, result }, i) => (
              <div key={i} className="card p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Trophy size={20} color="#EF9F27" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-[14px] font-black text-slate-800">{comp.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {comp.type}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-400 mb-3">
                      {comp.location && `📍 ${comp.location} · `}
                      {new Date(comp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {/* Résultat mis en avant */}
                    <div className="inline-block rounded-2xl px-4 py-3"
                      style={{ background: "linear-gradient(135deg, #E8F7F2, #D1F0E6)" }}>
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">
                        {result.event}
                      </p>
                      <p className="text-[24px] font-black text-emerald-700 leading-tight">
                        {result.result}
                      </p>
                    </div>
                    {result.context && (
                      <p className="text-[11.5px] text-slate-400 italic mt-2">{result.context}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
    </div>
  );
}