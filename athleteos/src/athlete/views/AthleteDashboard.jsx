// ============================================================
// AthleteOS — src/athlete/views/AthleteDashboard.jsx
// Extrait de AthleteApp.jsx — function Dashboard(...)
// Zéro modification du code.
// ============================================================

import { useState, useMemo, memo } from "react";
import {
  CalendarDays, TrendingUp, Zap, CheckCircle, Activity,
  FileText, HeartPulse, Trophy, Star, ChevronRight,
} from "lucide-react";
import {
  getAthleteMetricsForWeek, getStatusLabel,
} from "../../utils/chargeCalculations";
import {
  getISOWeek, dimColor, acwrColor, colorsFor, parsePerf,
  initialsFromName, getDiscHib, DISC_TYPE_COLORS, WELLNESS_QUESTIONS, METRIC_SCIENCE,
} from "../shared";
import FormeDetailPanel from "../components/FormeDetailPanel";

function getDiscType(discName) {
  const DISC_PRESETS = [
    { name: "100m", type: "sprint" },{ name: "200m", type: "sprint" },{ name: "400m", type: "sprint" },
    { name: "800m", type: "endurance" },{ name: "1500m", type: "endurance" },
    { name: "60m haies", type: "sprint" },{ name: "100m haies", type: "sprint" },
    { name: "110m haies", type: "sprint" },{ name: "400m haies", type: "sprint" },
    { name: "Longueur", type: "saut" },{ name: "Triple saut", type: "saut" },
    { name: "Hauteur", type: "saut" },{ name: "Perche", type: "saut" },
    { name: "Poids", type: "lancer" },{ name: "Disque", type: "lancer" },
    { name: "Javelot", type: "lancer" },{ name: "Marteau", type: "lancer" },
    { name: "Décathlon", type: "combine" },{ name: "Heptathlon", type: "combine" },
  ];
  return DISC_PRESETS.find(d => d.name === discName)?.type ?? "sprint";
}

function computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek }) {
  const badges = [];
  const allSessions = sessions ?? [];
  const myComps  = (competitions ?? []).filter(c => c.athleteIds?.includes(athlete.id));
  const myPerfs  = myPerformances ?? [];
  const myRecords = Object.keys(athlete.records ?? {});

  if (streak >= 1)  badges.push({ id:"streak1",  emoji:"🔥", label:"Premier feu",   desc:"1 semaine consécutive",      color:"#EF9F27", unlocked:true });
  if (streak >= 3)  badges.push({ id:"streak3",  emoji:"🔥", label:"En feu",        desc:"3 semaines consécutives",    color:"#EF9F27", unlocked:true });
  if (streak >= 5)  badges.push({ id:"streak5",  emoji:"⚡", label:"Inarrêtable",   desc:"5 semaines consécutives",    color:"#E24B4A", unlocked:true });
  if (streak >= 10) badges.push({ id:"streak10", emoji:"💥", label:"Légende",       desc:"10 semaines consécutives",   color:"#7C3AED", unlocked:true });

  const totalDone = allSessions.reduce((acc,s) =>
    acc + (s.validations?.filter(v=>v.athleteId===athlete.id&&v.status==="done").length??0), 0);
  if (totalDone >= 1)   badges.push({ id:"s1",   emoji:"✅", label:"Premier pas",  desc:"1 séance réalisée",          color:"#1D9E75", unlocked:true });
  if (totalDone >= 10)  badges.push({ id:"s10",  emoji:"💪", label:"Régulier",     desc:"10 séances réalisées",       color:"#1D9E75", unlocked:true });
  if (totalDone >= 25)  badges.push({ id:"s25",  emoji:"🏋️",label:"Bosseur",      desc:"25 séances réalisées",       color:"#378ADD", unlocked:true });
  if (totalDone >= 50)  badges.push({ id:"s50",  emoji:"🚀", label:"Acharné",      desc:"50 séances réalisées",       color:"#7C3AED", unlocked:true });
  if (totalDone >= 100) badges.push({ id:"s100", emoji:"👑", label:"Élite",        desc:"100 séances réalisées",      color:"#EF9F27", unlocked:true });

  if (myComps.length >= 1) badges.push({ id:"c1", emoji:"🏟️", label:"Compétiteur", desc:"1ère compétition",           color:"#E24B4A", unlocked:true });
  if (myComps.length >= 5) badges.push({ id:"c5", emoji:"🎯", label:"Guerrier",    desc:"5 compétitions au compteur", color:"#E24B4A", unlocked:true });

  const prBeat = myPerfs.filter(p => {
    const rec = athlete.records?.[p.discipline];
    if (!rec) return false;
    const hib = getDiscHib(p.discipline);
    const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
    if (!pv.value||!prv.value) return false;
    return hib ? pv.value >= prv.value : pv.value <= prv.value;
  }).length;
  if (prBeat >= 1) badges.push({ id:"pr1", emoji:"🏆", label:"Record battu",  desc:"1 record personnel amélioré", color:"#EF9F27", unlocked:true });
  if (prBeat >= 3) badges.push({ id:"pr3", emoji:"🌟", label:"Recordman",     desc:"3 records améliorés",         color:"#EF9F27", unlocked:true });

  const discCount = [...new Set([...myRecords,...myPerfs.map(p=>p.discipline)])].length;
  if (discCount >= 1) badges.push({ id:"d1", emoji:"🎪", label:"Spécialiste",  desc:"1 discipline maîtrisée",      color:"#0284C7", unlocked:true });
  if (discCount >= 3) badges.push({ id:"d3", emoji:"🎭", label:"Polyvalent",   desc:"3 disciplines pratiquées",    color:"#7C3AED", unlocked:true });
  if (discCount >= 5) badges.push({ id:"d5", emoji:"🦁", label:"Décathlonien", desc:"5+ disciplines pratiquées",   color:"#E24B4A", unlocked:true });

  if (myPerfs.length >= 5)  badges.push({ id:"p5",  emoji:"📊", label:"Analytique",  desc:"5 performances enregistrées", color:"#1D9E75", unlocked:true });
  if (myPerfs.length >= 20) badges.push({ id:"p20", emoji:"📈", label:"Data driven", desc:"20 performances suivies",     color:"#378ADD", unlocked:true });

  const myCharge = weeklyCharge.filter(w=>w.athleteId===athlete.id);
  const optimalWeeks = myCharge.filter(w => {
    const m = getAthleteMetricsForWeek(athlete.id, weeklyCharge, w.week);
    return m.acwr >= 0.8 && m.acwr <= 1.3;
  }).length;
  if (optimalWeeks >= 3) badges.push({ id:"acwr3", emoji:"⚖️", label:"Équilibré", desc:"3 semaines en zone optimale", color:"#1D9E75", unlocked:true });
  if (optimalWeeks >= 8) badges.push({ id:"acwr8", emoji:"🎯", label:"Maestro",   desc:"8 semaines en zone optimale", color:"#7C3AED", unlocked:true });

  if (streak < 3)     badges.push({ id:"l_s3",  emoji:"🔒", label:"En feu",      desc:`${3-streak} semaine${3-streak>1?"s":""} de plus`,  color:"#cbd5e1", unlocked:false });
  if (totalDone < 10) badges.push({ id:"l_s10", emoji:"🔒", label:"Régulier",    desc:`${10-totalDone} séance${10-totalDone>1?"s":""} de plus`, color:"#cbd5e1", unlocked:false });
  if (myComps.length < 1) badges.push({ id:"l_c1", emoji:"🔒", label:"Compétiteur", desc:"Participe à ta 1ère compét.", color:"#cbd5e1", unlocked:false });

  return badges;
}

function BadgeItem({ badge }) {
  return (
    <div className={["flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all",
      badge.unlocked
        ? "bg-white border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-default"
        : "bg-slate-50 border-dashed border-slate-200 opacity-50"
    ].join(" ")}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]"
        style={{ background: badge.unlocked ? badge.color + "18" : "#f1f5f9" }}>
        {badge.emoji}
      </div>
      <p className="text-[11px] font-bold text-slate-700 leading-tight">{badge.label}</p>
      <p className="text-[9px] text-slate-400 leading-tight">{badge.desc}</p>
    </div>
  );
}

export default function AthleteDashboard({ athlete, weeklyCharge, sessions, competitions, lastMessages, coachName, myPerformances, onNavigate, wellnessToday, onOpenWellness }) {
  const today       = new Date();
  const currentWeek = getISOWeek(today);

  const metrics = useMemo(() =>
    getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek, wellnessToday ? [wellnessToday] : [], sessions),
  [athlete.id, weeklyCharge, currentWeek, wellnessToday, sessions]);

  const status = getStatusLabel(metrics.readiness, metrics.fatigue, metrics.acwr);

  const nextComp = useMemo(() =>
    competitions
      .filter(c => c.athleteIds.includes(athlete.id) && new Date(c.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null,
  [competitions, athlete.id]);

  const weekSessions = useMemo(() =>
    sessions.filter(s => s.week === currentWeek).sort((a, b) => a.time.localeCompare(b.time)),
  [sessions, currentWeek]);

  const topRecords     = Object.entries(athlete.records ?? {}).slice(0, 4);
  const activeInjuries = (athlete.injuries ?? []).filter(i => i.status !== "résolu");

  const chargeHistory = useMemo(() => {
    const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
    if (!myCharge.length) return [];
    return [...myCharge].sort((a, b) => a.week - b.week).slice(-8).map(w => ({
      label: `S${w.week}`, charge: w.rawLoad,
      color: w.rawLoad >= 450 ? "#E24B4A" : w.rawLoad >= 320 ? "#EF9F27" : "#1D9E75",
    }));
  }, [weeklyCharge, athlete.id]);

  const chargeTrend = useMemo(() => {
    const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
    const curr = myCharge.find(w => w.week === currentWeek)?.rawLoad ?? 0;
    const prev = myCharge.find(w => w.week === currentWeek - 1)?.rawLoad ?? 0;
    return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  }, [weeklyCharge, athlete.id, currentWeek]);

  const streak = useMemo(() => {
    let s = 0;
    for (let w = currentWeek; w >= currentWeek - 20; w--) {
      const hasValidated = sessions
        .filter(se => se.week === w)
        .some(se => se.validations?.some(v => v.athleteId === athlete.id && v.status === "done"));
      if (hasValidated) s++; else break;
    }
    return s;
  }, [sessions, athlete.id, currentWeek]);

  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  const badges = useMemo(() => computeBadges({
    athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek,
  }), [athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek]);

  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges   = badges.filter(b => !b.unlocked);

  const latestPR = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return (myPerformances ?? []).find(p => {
      const rec = athlete.records?.[p.discipline];
      if (!rec || !p.performance_date) return false;
      if (new Date(p.performance_date) < sevenDaysAgo) return false;
      const hib = getDiscHib(p.discipline);
      const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
      if (!pv.value || !prv.value) return false;
      return hib ? pv.value >= prv.value : pv.value <= prv.value;
    }) ?? null;
  }, [myPerformances, athlete.records]);

  const doneThisWeek = weekSessions.filter(s =>
    s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")
  ).length;

  const [activeMetric, setActiveMetric] = useState(null);

  const statusColor =
    metrics.acwr > 1.3 || metrics.readiness < 50 ? "#E24B4A" :
    metrics.acwr > 1.15 || metrics.fatigue > 60   ? "#EF9F27" :
    "#1D9E75";

  // ─── Render identique à l'original ───────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto animate-slide-up">

      {/* HERO */}
      <div className="rounded-3xl overflow-hidden relative"
        style={{ background: "linear-gradient(160deg, #0D1F18 0%, #0f2a1e 40%, #0D1F18 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(29,158,117,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.6) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(29,158,117,0.18) 0%, transparent 70%)" }} />
        <div className="relative p-5">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(29,158,117,0.20)", border: "1.5px solid rgba(29,158,117,0.35)", backdropFilter: "blur(8px)" }}>
                <span className="text-[17px] font-bold text-white">{initialsFromName(athlete.name)}</span>
              </div>
              <div>
                <p className="text-white/40 text-[9.5px] font-bold uppercase tracking-[0.15em] mb-0.5">Mon espace · S{currentWeek}</p>
                <h1 className="text-[20px] font-bold leading-tight tracking-tight text-white">{athlete.name.split(" ")[0]}</h1>
                <p className="text-white/40 text-[11px] mt-0.5">
                  {athlete.mainDiscipline ?? "Athlète"}{athlete.group ? ` · ${athlete.group}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full flex-shrink-0"
              style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}35` }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
              <span className="text-[10.5px] font-semibold" style={{ color: statusColor }}>{status.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { metric: "readiness", label: "Readiness", value: metrics.readiness,       unit: "/100", pct: metrics.readiness },
              { metric: "fatigue",   label: "Fatigue",   value: metrics.fatigue,          unit: "/100", pct: metrics.fatigue },
              { metric: "acwr",      label: "ACWR",      value: metrics.acwr.toFixed(2),  unit: "",     pct: Math.min(100, (metrics.acwr / 2) * 100) },
              { metric: "streak",    label: "Streak",    value: streak,                   unit: " sem", pct: Math.min(100, (streak / 10) * 100) },
            ].map(s => {
              const color = dimColor(s.metric, s.metric === "acwr" ? metrics.acwr : Number(s.value));
              return (
                <div key={s.label} className="rounded-2xl px-2.5 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-end justify-center gap-0.5">
                    <p className="text-[22px] font-bold leading-none tracking-tight"
                      style={{ color, fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                    {s.unit && <p className="text-[9px] text-white/25 font-semibold mb-0.5">{s.unit}</p>}
                  </div>
                  <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>{s.label}</p>
                  <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(3, s.pct)}%`, background: color, opacity: 0.65 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* WELLNESS */}
      {wellnessToday ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.12)" }}>
                <CheckCircle size={15} color="#1D9E75" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-slate-800">Wellness du jour</h3>
                <p className="text-[11px] text-slate-400">Questionnaire matinal complété</p>
              </div>
            </div>
            {metrics.wellnessScore !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(167,139,250,0.12)" }}>
                <span className="metric-value-sm" style={{ color: "#A78BFA" }}>{metrics.wellnessScore}</span>
                <div><p className="metric-label">Score</p><p className="text-[9px] text-slate-400">/100</p></div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {WELLNESS_QUESTIONS.map(q => {
              const val  = wellnessToday[q.key];
              const Icon = q.icon;
              const good = q.inverted ? val <= 2 : val >= 4;
              const bad  = q.inverted ? val >= 4 : val <= 2;
              const col  = good ? "#1D9E75" : bad ? "#E24B4A" : "#EF9F27";
              return (
                <div key={q.key} className="flex flex-col items-center gap-1.5 bg-slate-50 rounded-xl py-3 px-1">
                  <Icon size={13} color={q.color} strokeWidth={2} />
                  <span className="text-[18px] font-bold leading-none" style={{ color: col }}>{val}</span>
                  <span className="text-[8px] text-slate-400 text-center leading-tight">{q.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
          {wellnessToday.notes && (
            <p className="mt-3 text-[11.5px] text-slate-500 italic border-t border-slate-50 pt-3">"{wellnessToday.notes}"</p>
          )}
          <button onClick={onOpenWellness} className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-emerald-600 transition-colors">
            Modifier →
          </button>
        </div>
      ) : (
        <div className="rounded-3xl p-5 flex items-center justify-between gap-4 border border-emerald-100"
          style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.15)" }}>
              <Activity size={17} color="#1D9E75" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-emerald-800">Questionnaire matinal</p>
              <p className="text-[12px] text-emerald-600 mt-0.5 leading-relaxed">30 secondes · Améliore ton Readiness</p>
            </div>
          </div>
          <button onClick={onOpenWellness}
            className="flex-shrink-0 px-4 rounded-2xl text-white text-[13px] font-semibold shadow-sm tap-feedback"
            style={{ minHeight: "40px", background: "#1D9E75" }}>
            Remplir
          </button>
        </div>
      )}

      {/* GRILLE PRINCIPALE */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">

          {/* Charge */}
          {hasCharge && chargeHistory.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="card-title">Ma charge</h3>
                  <p className="card-subtitle">8 dernières semaines</p>
                </div>
                {chargeTrend !== null && (
                  <span className={["chip", chargeTrend > 15 ? "chip-danger" : chargeTrend > 0 ? "chip-warning" : chargeTrend < 0 ? "chip-success" : "chip-neutral"].join(" ")}>
                    {chargeTrend > 0 ? `+${chargeTrend}%` : `${chargeTrend}%`} vs S-1
                  </span>
                )}
              </div>
              <div className="flex items-end gap-1.5 mb-3" style={{ height: "90px" }}>
                {chargeHistory.map((w, i) => {
                  const max = Math.max(...chargeHistory.map(x => x.charge), 1);
                  const pct = (w.charge / max) * 100;
                  const isCurrent = i === chargeHistory.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end" style={{ height: "72px" }}>
                        <div className="w-full rounded-t-xl transition-all duration-500"
                          style={{ height: `${pct}%`, minHeight: "4px", background: isCurrent ? w.color : w.color + "60",
                            outline: isCurrent ? `2px solid ${w.color}` : "none", outlineOffset: "1px" }} />
                      </div>
                      <p className="text-[8.5px] text-slate-400 font-medium">{w.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "ACWR",      value: metrics.acwr.toFixed(2), color: acwrColor(metrics.acwr), sub: "0.8–1.3 optimal" },
                  { label: "Aiguë",     value: metrics.acute,           color: "#378ADD",               sub: "4 dernières sem." },
                  { label: "Chronique", value: metrics.chronic,         color: "#94a3b8",               sub: "12 dernières sem." },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-2xl px-3 py-2.5 text-center">
                    <p className="metric-value-sm leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="metric-label mt-1">{s.label}</p>
                    <p className="text-[8.5px] text-slate-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Sous-charge</span><span className="font-semibold text-emerald-600">Zone optimale</span><span>Surcharge</span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden"
                  style={{ background: "linear-gradient(to right, #378ADD 0%, #1D9E75 40%, #1D9E75 65%, #EF9F27 80%, #E24B4A 100%)" }}>
                  <div className="absolute top-0 h-full w-1.5 bg-white rounded-full shadow-md transition-all duration-500"
                    style={{ left: `${Math.min(95, Math.max(2, (metrics.acwr / 2) * 100))}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                  <span>0</span><span>0.8</span><span>1.3</span><span>2.0</span>
                </div>
              </div>
            </div>
          )}

          {/* État de forme */}
          {hasCharge && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="card-title">État de forme</h3>
                <span className="text-[10px] text-slate-300 font-medium">Appuie pour comprendre</span>
              </div>
              <p className="card-subtitle mb-4">Basé sur ta charge réelle · Détail scientifique au tap</p>
              <div className="space-y-3">
                {[
                  { key: "readiness",    label: "Readiness",       value: metrics.readiness    },
                  { key: "forme",        label: "Forme",           value: metrics.forme        },
                  { key: "fatigue",      label: "Fatigue",         value: metrics.fatigue      },
                  { key: "recuperation", label: "Récupération",    value: metrics.recuperation },
                  { key: "risque",       label: "Risque blessure", value: metrics.risque       },
                ].map(s => {
                  const col    = dimColor(s.key, s.value);
                  const sci    = METRIC_SCIENCE[s.key];
                  const thresh = sci?.thresholds.find(t => s.value >= t.min && s.value <= t.max);
                  return (
                    <button key={s.key} onClick={() => setActiveMetric(s.key)}
                      className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-left hover:bg-slate-100 transition-all tap-feedback">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-slate-800">{s.label}</span>
                          {thresh && (
                            <span className="chip" style={{ background: thresh.color + "15", color: thresh.color }}>
                              {thresh.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="metric-value-sm" style={{ color: col }}>{s.value}</span>
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${s.value}%`, background: col }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-300 mt-4 text-center">
                ACWR : Gabbett (2016) · Récup. : Hasegawa (2024) · Fitness-Fatigue : Banister (1975)
              </p>
            </div>
          )}

          {/* Séances semaine */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="card-title">Cette semaine</h3>
                <p className="card-subtitle">{doneThisWeek}/{weekSessions.length} réalisée{weekSessions.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => onNavigate("planning")}
                className="text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                Voir tout →
              </button>
            </div>
            {weekSessions.length === 0 ? (
              <div className="p-10 text-center text-slate-300">
                <CalendarDays size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[12px]">Aucune séance cette semaine</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {weekSessions.map(s => {
                  const c   = colorsFor(s.category);
                  const val = s.validations?.find(v => v.athleteId === athlete.id);
                  const st  = val?.status ?? "future";
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.border }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-700 truncate">{s.title}</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" }) : s.day}
                          {" · "}{s.time}
                        </p>
                      </div>
                      {s.pdfUrl && (
                        <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg flex-shrink-0">
                          <FileText size={10} strokeWidth={2.5} />PDF
                        </a>
                      )}
                      <span className={["chip flex-shrink-0",
                        st === "done" ? "chip-success" : st === "partial" ? "chip-warning" : st === "none" ? "chip-danger" : "chip-neutral"].join(" ")}>
                        {st === "done" ? "Fait" : st === "partial" ? "Partiel" : st === "none" ? "Absent" : "À venir"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PR semaine */}
          {latestPR && (
            <div className="rounded-3xl p-5 text-white relative overflow-hidden tap-feedback"
              style={{ background: "linear-gradient(135deg, #B97A10 0%, #EF9F27 60%, #f59e0b 100%)" }}>
              <div className="absolute inset-0 opacity-15 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at 90% 10%, white 0%, transparent 50%)" }} />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.18)" }}>
                  <Trophy size={26} color="white" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-white/75 mb-0.5">Nouveau record personnel</p>
                  <p className="text-[19px] font-bold leading-tight">{latestPR.discipline} — {latestPR.value}</p>
                  <p className="text-[11px] text-white/65 mt-0.5">
                    {new Date(latestPR.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Records */}
          {topRecords.length > 0 && (
            <div className="card overflow-hidden shimmer-hover">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="card-title">Mes records</h3>
                <button onClick={() => onNavigate("performances")}
                  className="text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Tout voir →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                {topRecords.map(([disc, r]) => {
                  const c = DISC_TYPE_COLORS[getDiscType(disc)] ?? DISC_TYPE_COLORS.sprint;
                  return (
                    <div key={disc} className="bg-white px-4 py-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                        <p className="metric-label">{disc}</p>
                      </div>
                      <p className="metric-value" style={{ color: c.border }}>{r.pr}</p>
                      <p className="text-[10.5px] text-slate-400 mt-1">SB : {r.sb}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-title">Mes badges</h3>
                <p className="card-subtitle">{unlockedBadges.length} débloqué{unlockedBadges.length > 1 ? "s" : ""} · {lockedBadges.length} à venir</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-100">
                <Trophy size={13} color="#D97706" strokeWidth={2} />
                <span className="text-[14px] font-bold text-amber-600">{unlockedBadges.length}</span>
              </div>
            </div>
            {unlockedBadges.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Trophy size={20} className="text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-[12px] text-slate-400">Commence à t'entraîner pour débloquer tes premiers badges !</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {unlockedBadges.slice(0, 8).map(b => <BadgeItem key={b.id} badge={b} />)}
                </div>
                {lockedBadges.length > 0 && (
                  <div>
                    <p className="metric-label mb-2">À débloquer</p>
                    <div className="grid grid-cols-4 gap-2">
                      {lockedBadges.slice(0, 4).map(b => <BadgeItem key={b.id} badge={b} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* COLONNE DROITE */}
        <div className="space-y-4">
          {nextComp && (
            <div className="rounded-3xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #8B1F1F 0%, #E24B4A 100%)" }}>
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} strokeWidth={2} />
                  <span className="metric-label text-white/60">Prochaine compétition</span>
                </div>
                <p className="text-[17px] font-bold leading-tight mb-1">{nextComp.name}</p>
                <p className="text-white/55 text-[12px] mb-4">
                  {new Date(nextComp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {(() => {
                  const days = Math.round((new Date(nextComp.date) - today) / (1000 * 60 * 60 * 24));
                  return (
                    <div className="rounded-2xl px-4 py-3 text-center mb-3" style={{ background: "rgba(255,255,255,0.12)" }}>
                      <p className="text-[38px] font-bold leading-none">{days}</p>
                      <p className="metric-label text-white/55 mt-1">jours</p>
                    </div>
                  );
                })()}
                {nextComp.plannedEvents?.[athlete.id] && (
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <p className="metric-label text-white/55 mb-0.5">Épreuve prévue</p>
                    <p className="text-white font-semibold text-[14px]">{nextComp.plannedEvents[athlete.id]}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {streak > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,159,39,0.12)" }}>
                  <Zap size={18} color="#EF9F27" strokeWidth={2} />
                </div>
                <div>
                  <p className="card-title">Régularité</p>
                  <p className="card-subtitle">Semaines consécutives</p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-[48px] font-bold leading-none text-amber-500 tracking-tight">{streak}</span>
                <span className="text-[13px] font-semibold text-slate-500 mb-2">sem.</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">avec au moins 1 séance validée</p>
              <div className="mt-3 progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (streak / 10) * 100)}%`, background: "#EF9F27" }} />
              </div>
              <p className="text-[9.5px] text-slate-300 mt-1 text-right">{streak}/10 pour le badge Maestro</p>
            </div>
          )}

          {activeInjuries.length > 0 && (
            <div className="rounded-2xl p-5 border border-amber-100" style={{ background: "#FFFBF0" }}>
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={14} color="#EF9F27" strokeWidth={2} />
                <h3 className="text-[13px] font-semibold text-amber-800">Blessures en cours</h3>
              </div>
              <div className="space-y-2">
                {activeInjuries.map(inj => (
                  <div key={inj.id} className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12.5px] font-semibold text-slate-700">{inj.name}</p>
                      <span className="chip chip-warning">{inj.intensity}/10</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Star size={10} strokeWidth={2} className="text-slate-300" />{inj.location}
                    </div>
                    <div className="mt-2 progress-bar">
                      <div className="progress-fill"
                        style={{ width: `${(inj.intensity / 10) * 100}%`, background: inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#EF9F27" : "#E24B4A" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastMessages.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}>
                    {initialsFromName(coachName ?? "C")}
                  </div>
                  <h3 className="text-[13px] font-semibold text-slate-800">{coachName?.split(" ")[0] ?? "Coach"}</h3>
                </div>
                <button onClick={() => onNavigate("messagerie")}
                  className="text-[11px] text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                  Répondre →
                </button>
              </div>
              {lastMessages.slice(0, 2).map(m => (
                <div key={m.id} className="bg-slate-50 rounded-2xl px-3.5 py-2.5 mb-2">
                  <p className="text-[12.5px] text-slate-700 leading-relaxed line-clamp-2">{m.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeMetric && (
        <FormeDetailPanel
          metricKey={activeMetric}
          metrics={metrics}
          sessions={sessions}
          weeklyCharge={weeklyCharge}
          athlete={athlete}
          onClose={() => setActiveMetric(null)}
        />
      )}
    </div>
  );
}