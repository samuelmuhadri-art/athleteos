// ============================================================
// AthleteOS — src/athlete/views/AthletePerfs.jsx
// Extrait de AthleteApp.jsx — function MesPerformances(...)
// Zéro modification du code.
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { Plus, Trophy, Target, BarChart2, CheckCircle, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { getDiscHib, parsePerf, DISC_TYPE_COLORS, DISC_PRESETS } from "../shared";

function getDiscType(discName) {
  return DISC_PRESETS.find(d => d.name === discName)?.type ?? "sprint";
}

export default function AthletePerfs({ athlete, competitions, myPerformances, myGoals, clubId, onRefresh }) {
  const today = new Date();

  const [activeTab,    setActiveTab]    = useState("records");
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [showAddPerf,  setShowAddPerf]  = useState(false);
  const [showAddGoal,  setShowAddGoal]  = useState(false);
  const [savingPerf,   setSavingPerf]   = useState(false);
  const [savingGoal,   setSavingGoal]   = useState(false);
  const [perfForm,     setPerfForm]     = useState({
    discipline: "", value: "", performance_date: today.toISOString().slice(0,10), context: ""
  });
  const [goalForm, setGoalForm] = useState({
    discipline: "", target_value: "", deadline: "", notes: ""
  });

  const [localPerfs, setLocalPerfs] = useState(myPerformances ?? []);
  const [localGoals, setLocalGoals] = useState(myGoals ?? []);

  useEffect(() => { setLocalPerfs(myPerformances ?? []); }, [myPerformances]);
  useEffect(() => { setLocalGoals(myGoals ?? []); }, [myGoals]);

  const disciplines = Object.keys(athlete.records ?? {});

  useEffect(() => {
    if (!selectedDisc && disciplines.length > 0) setSelectedDisc(disciplines[0]);
  }, [disciplines.length]);

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
      setPerfForm({ discipline: perfForm.discipline, value: "", performance_date: today.toISOString().slice(0,10), context: "" });
      setShowAddPerf(false);
      onRefresh?.();
    } catch(e) {
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
    } catch(e) {
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

  const PERF_TABS = [
    { id: "records",   label: "Records" },
    { id: "evolution", label: "Évolution" },
    { id: "objectifs", label: activeGoals.length > 0 ? `Objectifs (${activeGoals.length})` : "Objectifs" },
    { id: "comps",     label: "Compétitions" },
  ];

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto animate-slide-up">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-black text-slate-800">Mes performances</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {disciplines.length} épreuve{disciplines.length !== 1 ? "s" : ""} · {localPerfs.length} mesure{localPerfs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowAddPerf(true)} className="btn-primary"><Plus size={14} /> Saisir une perf</button>
      </div>

      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 shadow-card p-1.5 overflow-x-auto">
        {PERF_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={["flex-1 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all text-center tap-feedback",
              activeTab === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"].join(" ")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* RECORDS */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {disciplines.length === 0 ? (
            <div className="card p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
              <p className="text-[14px] font-bold text-slate-400">Aucun record enregistré</p>
              <p className="text-[12px] text-slate-300 mt-1">Ton coach les ajoutera après tes premières compétitions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {disciplines.map(disc => {
                const rec   = athlete.records[disc];
                const stats = disciplineStats[disc];
                const DISC_COLORS = {
                  "100m":"#3B82F6","200m":"#8B5CF6","400m":"#F59E0B",
                  "110m haies":"#EF4444","100m haies":"#EC4899",
                  "Longueur":"#10B981","Triple saut":"#14B8A6",
                  "Hauteur":"#F97316","Perche":"#6366F1",
                };
                const col = DISC_COLORS[disc] ?? "#1D9E75";
                return (
                  <div key={disc} className="card p-5 shimmer-hover">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: col }} />
                        <p className="text-[13px] font-black text-slate-700">{disc}</p>
                      </div>
                      <button onClick={() => { setSelectedDisc(disc); setActiveTab("evolution"); }}
                        className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-0.5">
                        Voir évolution →
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-slate-50 rounded-2xl p-3 text-center">
                        <p className="text-[22px] font-black leading-none" style={{ color: col }}>{rec.pr}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Record perso</p>
                        {rec.prDate && (
                          <p className="text-[9px] text-slate-300 mt-0.5">
                            {new Date(rec.prDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short",year:"numeric"})}
                          </p>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3 text-center">
                        <p className="text-[22px] font-black leading-none text-slate-600">{rec.sb}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Season Best</p>
                      </div>
                    </div>
                    {stats && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-semibold">{stats.count} mesure{stats.count > 1 ? "s" : ""}</span>
                        {stats.last && <><span>·</span><span>Dernière : <strong className="text-slate-600">{stats.last.raw}</strong></span></>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {compHistory.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Dernières compétitions</h3>
                <button onClick={() => setActiveTab("comps")} className="text-[11px] font-bold text-emerald-600">Tout voir →</button>
              </div>
              <div className="divide-y divide-slate-50">
                {compHistory.slice(0, 3).map(({ comp, result }, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Trophy size={15} color="#EF9F27" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-700 truncate">{comp.name}</p>
                      <p className="text-[11px] text-slate-400">{result.event} · <strong className="text-emerald-600">{result.result}</strong></p>
                    </div>
                    <span className="text-[10.5px] text-slate-400 flex-shrink-0">
                      {new Date(comp.date).toLocaleDateString("fr-BE",{day:"numeric",month:"short"})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ÉVOLUTION */}
      {activeTab === "evolution" && (
        <div className="space-y-4">
          {disciplines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {disciplines.map(disc => (
                <button key={disc} onClick={() => setSelectedDisc(disc)}
                  className={["px-3 py-1.5 rounded-xl text-[12px] font-bold border-2 transition-all tap-feedback",
                    selectedDisc === disc ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200"].join(" ")}>
                  {disc}
                </button>
              ))}
            </div>
          )}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-slate-800">{selectedDisc ?? "Sélectionne une épreuve"}</h3>
              <button onClick={() => setShowAddPerf(true)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">+ Saisir</button>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">{chartData.length} mesure{chartData.length !== 1 ? "s" : ""}</p>
            {chartData.length < 2 ? (
              <div className="h-[180px] flex flex-col items-center justify-center text-slate-300 gap-2">
                <BarChart2 size={28} strokeWidth={1.5} />
                <p className="text-[12px] text-center">Minimum 2 mesures pour afficher le graphique</p>
                <button onClick={() => setShowAddPerf(true)} className="text-[12px] font-bold text-emerald-600 mt-1">+ Saisir une performance</button>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:"#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"#94a3b8" }} axisLine={false} tickLine={false} width={45}
                      domain={([min, max]) => {
                        const padding = (max - min) * 0.1 || 0.5;
                        return [Math.floor((min - padding) * 100) / 100, Math.ceil((max + padding) * 100) / 100];
                      }} tickCount={6} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-lg px-3 py-2.5 text-[12px]">
                          <p className="font-bold text-slate-600 mb-1">{label}</p>
                          <p className="text-emerald-600 font-black text-[14px]">{d.raw}</p>
                          {d.ctx && <p className="text-slate-400 italic mt-0.5">{d.ctx}</p>}
                        </div>
                      );
                    }} />
                    <Area dataKey="value" name={selectedDisc} stroke="#1D9E75" fill="url(#gradPerf)"
                      strokeWidth={2.5} dot={{ r:4, fill:"#1D9E75" }} activeDot={{ r:6 }} />
                  </AreaChart>
                </ResponsiveContainer>
                {selectedDisc && athlete.records?.[selectedDisc] && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-[12px]">
                    <span className="text-slate-400">PR : <strong className="text-emerald-600 text-[14px]">{athlete.records[selectedDisc].pr}</strong></span>
                    <span className="text-slate-400">SB : <strong className="text-slate-600">{athlete.records[selectedDisc].sb}</strong></span>
                    {chartData.length >= 2 && (() => {
                      const diff = chartData[chartData.length-1].value - chartData[0].value;
                      const col  = diff >= 0 ? "#1D9E75" : "#E24B4A";
                      return <span style={{ color: col }} className="font-bold ml-auto">{diff >= 0 ? "+" : ""}{diff.toFixed(2)}</span>;
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
          {chartData.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-[13px] font-bold text-slate-800">Toutes les mesures — {selectedDisc}</h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {[...chartData].reverse().map((d, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-black text-emerald-600">{d.raw}</p>
                      {d.ctx && <p className="text-[11px] text-slate-400 italic">{d.ctx}</p>}
                    </div>
                    <p className="text-[11px] text-slate-400">{d.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OBJECTIFS */}
      {activeTab === "objectifs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddGoal(true)} className="btn-primary"><Plus size={14} /> Ajouter un objectif</button>
          </div>
          {activeGoals.length === 0 && achievedGoals.length === 0 ? (
            <div className="card p-12 text-center">
              <Target size={32} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
              <p className="text-[14px] font-bold text-slate-400">Aucun objectif défini</p>
              <p className="text-[12px] text-slate-300 mt-1">Fixe-toi des objectifs pour rester motivé</p>
              <button onClick={() => setShowAddGoal(true)} className="mt-4 btn-primary mx-auto"><Plus size={14} /> Définir un objectif</button>
            </div>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En cours ({activeGoals.length})</p>
                  {activeGoals.map(g => {
                    const daysLeft = g.deadline ? Math.round((new Date(g.deadline) - today) / (1000*60*60*24)) : null;
                    const isUrgent = daysLeft !== null && daysLeft <= 14;
                    return (
                      <div key={g.id} className={["card p-5 border-l-4", isUrgent ? "border-amber-400" : "border-emerald-400"].join(" ")}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-[13px] font-bold text-slate-700">{g.discipline}</p>
                              {daysLeft !== null && (
                                <span className={["text-[10px] font-bold px-2 py-0.5 rounded-full", isUrgent ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"].join(" ")}>
                                  {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "Aujourd'hui" : "Échu"}
                                </span>
                              )}
                            </div>
                            <p className="text-[24px] font-black text-emerald-600 leading-tight">{g.target_value}</p>
                            {g.notes && <p className="text-[11.5px] text-slate-400 italic mt-1">{g.notes}</p>}
                            {g.deadline && (
                              <p className="text-[11px] text-slate-400 mt-1">
                                Échéance : {new Date(g.deadline).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
                          <button onClick={() => handleMarkGoalDone(g.id)}
                            className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-600 hover:text-emerald-700">
                            <CheckCircle size={13} /> Marquer atteint
                          </button>
                          <button onClick={() => handleDeleteGoal(g.id)}
                            className="text-[11.5px] font-semibold text-red-400 hover:text-red-600 ml-auto">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {achievedGoals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Atteints 🏆 ({achievedGoals.length})</p>
                  {achievedGoals.map(g => (
                    <div key={g.id} className="card p-4 flex items-center gap-3 opacity-60">
                      <CheckCircle size={18} color="#1D9E75" />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-bold text-slate-600">{g.discipline} — {g.target_value}</p>
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

      {/* COMPÉTITIONS */}
      {activeTab === "comps" && (
        <div className="space-y-3">
          {compHistory.length === 0 ? (
            <div className="card p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
              <p className="text-[14px] font-bold text-slate-400">Aucune compétition enregistrée</p>
            </div>
          ) : compHistory.map(({ comp, result }, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} color="#EF9F27" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-[14px] font-black text-slate-800">{comp.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{comp.type}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-3">
                    {comp.location && `📍 ${comp.location} · `}
                    {new Date(comp.date).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}
                  </p>
                  <div className="bg-emerald-50 rounded-2xl px-4 py-3 inline-block">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{result.event}</p>
                    <p className="text-[22px] font-black text-emerald-700 leading-tight">{result.result}</p>
                  </div>
                  {result.context && <p className="text-[11.5px] text-slate-400 italic mt-2">{result.context}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PERF */}
      {showAddPerf && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowAddPerf(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content">
            <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[16px] font-black text-slate-800">Saisir une performance</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Chrono, distance, hauteur…</p>
              </div>
              <button onClick={() => setShowAddPerf(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Épreuve *</label>
                <input className="input-premium" placeholder="Ex: 100m, Longueur…"
                  value={perfForm.discipline} onChange={e => setPerfForm(f => ({ ...f, discipline: e.target.value }))} />
                {disciplines.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {disciplines.map(d => (
                      <button key={d} onClick={() => setPerfForm(f => ({ ...f, discipline: d }))}
                        className={["px-2.5 py-1 rounded-xl text-[10.5px] font-semibold border transition-all tap-feedback",
                          perfForm.discipline === d ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200"].join(" ")}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Résultat *</label>
                <input className="input-premium" placeholder="Ex: 10.94 ou 7.45m"
                  value={perfForm.value} onChange={e => setPerfForm(f => ({ ...f, value: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                <input type="date" className="input-premium"
                  value={perfForm.performance_date} onChange={e => setPerfForm(f => ({ ...f, performance_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contexte (optionnel)</label>
                <input className="input-premium" placeholder="Ex: Vent +1.2m/s, finale régionale…"
                  value={perfForm.context} onChange={e => setPerfForm(f => ({ ...f, context: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <button onClick={() => setShowAddPerf(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold">Annuler</button>
              <button onClick={handleAddPerf} disabled={!perfForm.discipline.trim() || !perfForm.value.trim() || savingPerf} className="btn-primary">
                {savingPerf ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={14} />Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OBJECTIF */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowAddGoal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content">
            <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[16px] font-black text-slate-800">Nouvel objectif</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Fixe-toi un cap à atteindre</p>
              </div>
              <button onClick={() => setShowAddGoal(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Épreuve *</label>
                <input className="input-premium" placeholder="Ex: 100m, Longueur…"
                  value={goalForm.discipline} onChange={e => setGoalForm(f => ({ ...f, discipline: e.target.value }))} />
                {disciplines.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {disciplines.map(d => (
                      <button key={d} onClick={() => setGoalForm(f => ({ ...f, discipline: d }))}
                        className={["px-2.5 py-1 rounded-xl text-[10.5px] font-semibold border transition-all tap-feedback",
                          goalForm.discipline === d ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200"].join(" ")}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Objectif à atteindre *</label>
                <input className="input-premium" placeholder="Ex: 10.80 ou 7.60m"
                  value={goalForm.target_value} onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Échéance (optionnel)</label>
                <input type="date" className="input-premium"
                  value={goalForm.deadline} onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea className="input-premium resize-none" rows={2} placeholder="Motivation, contexte…"
                  value={goalForm.notes} onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <button onClick={() => setShowAddGoal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold">Annuler</button>
              <button onClick={handleAddGoal} disabled={!goalForm.discipline.trim() || !goalForm.target_value.trim() || savingGoal} className="btn-primary">
                {savingGoal ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={14} />Créer l'objectif</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}