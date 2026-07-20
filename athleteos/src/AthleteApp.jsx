// ============================================================
// AthleteOS — src/AthleteApp.jsx
// CORRECTIONS :
// 1. usePushNotifications remonté AVANT les guards (règle des hooks React)
//    athlete?.id est passé dynamiquement — null au départ, mis à jour après fetch
// 2. PushToggleButton correctement placé dans header mobile + panneau notifs
// ============================================================

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import {
  LayoutDashboard, CalendarDays, TrendingUp, MessageSquare,
  Zap, LogOut, Menu, X, Plus, ChevronLeft, ChevronRight,
  Star, Activity, HeartPulse, Trophy, Target, Send,
  CheckCircle, AlertTriangle, Clock, FileText, BarChart2,
  Users, Heart, Image, Camera, Bell, Moon, Battery, Smile,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { supabase }  from "./utils/supabaseClient";
import { useAuth }   from "./context/AuthContext";
import LoadingState  from "./components/ui/LoadingState";
import {
  getAthleteMetricsForWeek,
  getStatusLabel,
  computeWellnessScore,
} from "./utils/chargeCalculations";
import { usePushNotifications, PushToggleButton } from "./hooks/usePushNotifications";
import { notifyGoalAchieved, notifyCoachMessage } from "./utils/notifications";

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",    label: "Tableau de bord", icon: LayoutDashboard },
  { id: "planning",     label: "Mon planning",    icon: CalendarDays    },
  { id: "performances", label: "Mes perfs",       icon: TrendingUp      },
  { id: "social",       label: "Mon club",        icon: Users           },
  { id: "messagerie",   label: "Messagerie",      icon: MessageSquare   },
];

// ─── Constantes calendrier ────────────────────────────────────────────────────
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTHS_FR  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR    = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const CATEGORIES = [
  { id: "sprint", label: "Sprint" }, { id: "haies", label: "Haies" },
  { id: "force", label: "Musculation" }, { id: "saut", label: "Saut" },
  { id: "lancer", label: "Lancer" }, { id: "endurance", label: "Endurance" },
  { id: "technique", label: "Technique" }, { id: "mobilite", label: "Mobilité" },
  { id: "recuperation", label: "Récupération" },
];
const SESSION_COLORS = {
  sprint:       { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" },
  haies:        { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95" },
  force:        { bg: "#DCFCE7", border: "#16A34A", text: "#14532D" },
  saut:         { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8" },
  lancer:       { bg: "#FFEDD5", border: "#F97316", text: "#9A3412" },
  endurance:    { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E" },
  technique:    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B" },
  mobilite:     { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12" },
  recuperation: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}
function acwrColor(v) { return v > 1.3 ? "#E24B4A" : v < 0.8 ? "#378ADD" : "#1D9E75"; }
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  return 1 + Math.round((d-jan4)/(7*24*60*60*1000));
}
function dateToISOWeek(s) { return getISOWeek(new Date(s)); }
function dateToDayName(s) { return DAYS_FR[(new Date(s).getDay()+6)%7]; }
function getCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);
  const startDow = (first.getDay()+6)%7;
  const days = [];
  for (let i=startDow-1;i>=0;i--) days.push({ date: new Date(year,month,-i), cur: false });
  for (let d=1;d<=last.getDate();d++) days.push({ date: new Date(year,month,d), cur: true });
  const rem = 7-(days.length%7); if (rem<7) for(let d=1;d<=rem;d++) days.push({ date: new Date(year,month+1,d), cur: false });
  return days;
}
function colorsFor(cat) { return SESSION_COLORS[cat] ?? SESSION_COLORS.technique; }
function parsePerf(str) {
  if (!str) return { value: null, hib: true };
  const s = str.toString().trim();
  if (/^\d+:\d+/.test(s)) { const [m,sec]=s.split(":").map(Number); return { value: m*60+sec, hib: false }; }
  if (s.endsWith("m"))    return { value: parseFloat(s), hib: true };
  if (s.includes("pts"))  return { value: parseFloat(s), hib: true };
  if (s.endsWith("s") || /^\d+\.\d+$/.test(s)) return { value: parseFloat(s), hib: false };
  return { value: parseFloat(s)||null, hib: true };
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────
function ScoreRing({ value, color, label, size=72 }) {
  const r=28, circ=2*Math.PI*r, dash=(Math.max(0,Math.min(100,value))/100)*circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)"/>
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{value}</text>
      </svg>
      <span className="text-[11px] text-slate-400 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── ChartTooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-[12px]">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SYSTÈME DE BADGES & ACHIEVEMENTS (Bloc 3)
// ══════════════════════════════════════════════════════════════════════════════

function computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek }) {
  const badges = [];
  const allSessions = sessions ?? [];
  const myComps = (competitions ?? []).filter(c => c.athleteIds?.includes(athlete.id));
  const myPerfs = myPerformances ?? [];
  const myRecords = Object.keys(athlete.records ?? {});

  if (streak >= 1)  badges.push({ id:"streak1",  emoji:"🔥", label:"Premier feu",      desc:"1 semaine consécutive",      color:"#EF9F27", unlocked:true  });
  if (streak >= 3)  badges.push({ id:"streak3",  emoji:"🔥", label:"En feu",           desc:"3 semaines consécutives",    color:"#EF9F27", unlocked:true  });
  if (streak >= 5)  badges.push({ id:"streak5",  emoji:"⚡", label:"Inarrêtable",      desc:"5 semaines consécutives",    color:"#E24B4A", unlocked:true  });
  if (streak >= 10) badges.push({ id:"streak10", emoji:"💥", label:"Légende",          desc:"10 semaines consécutives",   color:"#7C3AED", unlocked:true  });

  const totalDone = allSessions.reduce((acc,s) =>
    acc + (s.validations?.filter(v=>v.athleteId===athlete.id&&v.status==="done").length??0), 0);
  if (totalDone >= 1)   badges.push({ id:"s1",   emoji:"✅", label:"Premier pas",      desc:"1 séance réalisée",          color:"#1D9E75", unlocked:true  });
  if (totalDone >= 10)  badges.push({ id:"s10",  emoji:"💪", label:"Régulier",         desc:"10 séances réalisées",       color:"#1D9E75", unlocked:true  });
  if (totalDone >= 25)  badges.push({ id:"s25",  emoji:"🏋️", label:"Bosseur",         desc:"25 séances réalisées",       color:"#378ADD", unlocked:true  });
  if (totalDone >= 50)  badges.push({ id:"s50",  emoji:"🚀", label:"Acharné",          desc:"50 séances réalisées",       color:"#7C3AED", unlocked:true  });
  if (totalDone >= 100) badges.push({ id:"s100", emoji:"👑", label:"Élite",            desc:"100 séances réalisées",      color:"#EF9F27", unlocked:true  });

  if (myComps.length >= 1) badges.push({ id:"c1",  emoji:"🏟️", label:"Compétiteur",   desc:"1ère compétition",           color:"#E24B4A", unlocked:true  });
  if (myComps.length >= 5) badges.push({ id:"c5",  emoji:"🎯", label:"Guerrier",       desc:"5 compétitions au compteur", color:"#E24B4A", unlocked:true  });

  const prBeat = myPerfs.filter(p => {
    const rec = athlete.records?.[p.discipline];
    if (!rec) return false;
    const hib = getDiscHib(p.discipline);
    const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
    if (!pv.value||!prv.value) return false;
    return hib ? pv.value >= prv.value : pv.value <= prv.value;
  }).length;
  if (prBeat >= 1) badges.push({ id:"pr1", emoji:"🏆", label:"Record battu",          desc:"1 record personnel amélioré",color:"#EF9F27", unlocked:true  });
  if (prBeat >= 3) badges.push({ id:"pr3", emoji:"🌟", label:"Recordman",             desc:"3 records améliorés",        color:"#EF9F27", unlocked:true  });

  const discCount = [...new Set([...myRecords,...myPerfs.map(p=>p.discipline)])].length;
  if (discCount >= 1) badges.push({ id:"d1",  emoji:"🎪", label:"Spécialiste",        desc:"1 discipline maîtrisée",     color:"#0284C7", unlocked:true  });
  if (discCount >= 3) badges.push({ id:"d3",  emoji:"🎭", label:"Polyvalent",         desc:"3 disciplines pratiquées",   color:"#7C3AED", unlocked:true  });
  if (discCount >= 5) badges.push({ id:"d5",  emoji:"🦁", label:"Décathlonien",       desc:"5+ disciplines pratiquées",  color:"#E24B4A", unlocked:true  });

  if (myPerfs.length >= 5)  badges.push({ id:"p5",  emoji:"📊", label:"Analytique",   desc:"5 performances enregistrées",color:"#1D9E75", unlocked:true  });
  if (myPerfs.length >= 20) badges.push({ id:"p20", emoji:"📈", label:"Data driven",  desc:"20 performances suivies",    color:"#378ADD", unlocked:true  });

  const myCharge = weeklyCharge.filter(w=>w.athleteId===athlete.id);
  const optimalWeeks = myCharge.filter(w => {
    const m = getAthleteMetricsForWeek(athlete.id, weeklyCharge, w.week);
    return m.acwr >= 0.8 && m.acwr <= 1.3;
  }).length;
  if (optimalWeeks >= 3) badges.push({ id:"acwr3", emoji:"⚖️", label:"Équilibré",     desc:"3 semaines en zone optimale",color:"#1D9E75", unlocked:true  });
  if (optimalWeeks >= 8) badges.push({ id:"acwr8", emoji:"🎯", label:"Maestro",        desc:"8 semaines en zone optimale",color:"#7C3AED", unlocked:true  });

  if (streak < 3)    badges.push({ id:"l_s3",   emoji:"🔒", label:"En feu",           desc:`${3-streak} semaine${3-streak>1?"s":""} de plus`,  color:"#cbd5e1", unlocked:false });
  if (totalDone < 10) badges.push({ id:"l_s10",  emoji:"🔒", label:"Régulier",        desc:`${10-totalDone} séance${10-totalDone>1?"s":""} de plus`, color:"#cbd5e1", unlocked:false });
  if (myComps.length < 1) badges.push({ id:"l_c1", emoji:"🔒", label:"Compétiteur",   desc:"Participe à ta 1ère compét.", color:"#cbd5e1", unlocked:false });

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

// ══════════════════════════════════════════════════════════════════════════════
// VUE 1 — TABLEAU DE BORD
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// WELLNESS MODAL — questionnaire matinal (Hooper Index)
// Saw AE, Main LC, Gastin PB. (2016). BJSM 50(5), 281-291.
// ══════════════════════════════════════════════════════════════════════════════
const WELLNESS_QUESTIONS = [
  { key: "sleep",    label: "Qualité du sommeil",    icon: Moon,       color: "#7C3AED", desc: ["Très mauvais","Mauvais","Correct","Bon","Excellent"],            inverted: false },
  { key: "energy",   label: "Niveau d'énergie",       icon: Battery,    color: "#0284C7", desc: ["Épuisé","Fatigué","Correct","Énergique","Très énergique"],      inverted: false },
  { key: "soreness", label: "Courbatures / douleurs", icon: HeartPulse, color: "#E24B4A", desc: ["Aucune","Légères","Modérées","Importantes","Très importantes"], inverted: true  },
  { key: "mood",     label: "Humeur",                 icon: Smile,      color: "#EF9F27", desc: ["Très mauvaise","Mauvaise","Neutre","Bonne","Excellente"],        inverted: false },
  { key: "stress",   label: "Niveau de stress",       icon: Activity,   color: "#E24B4A", desc: ["Aucun","Faible","Modéré","Élevé","Très élevé"],                 inverted: true  },
];

const WellnessModal = memo(({ athlete, clubId, onClose, onSaved }) => {
  const [form, setForm] = useState({ sleep: null, energy: null, soreness: null, mood: null, stress: null });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const allAnswered = Object.values(form).every(v => v !== null);
  const previewScore = useMemo(() => computeWellnessScore(form), [form]);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSaving(true); setErr(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("athlete_wellness").upsert({
        athlete_id: athlete.id, club_id: clubId, date: today,
        sleep: form.sleep, energy: form.energy, soreness: form.soreness,
        mood: form.mood, stress: form.stress, notes: notes.trim() || null,
      }, { onConflict: "athlete_id,date" });
      if (error) throw error;
      onSaved({ ...form, notes: notes.trim() || null, date: today });
      onClose();
    } catch(e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(15,23,42,0.6)" }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0" style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-[16px] font-bold text-emerald-800">🌅 Comment tu vas ce matin ?</h3>
              <p className="text-[12px] text-emerald-600 mt-0.5">{new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-emerald-100"><X size={18} className="text-emerald-600"/></button>
          </div>
          {previewScore !== null && (
            <div className="mt-3 flex items-center gap-2 bg-white/60 rounded-xl px-4 py-2.5">
              <div className="text-[22px] font-black" style={{ color: previewScore >= 75 ? "#1D9E75" : previewScore >= 50 ? "#EF9F27" : "#E24B4A" }}>{previewScore}</div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score wellness</p>
                <p className="text-[10px] text-slate-400">{previewScore >= 75 ? "Forme optimale 🟢" : previewScore >= 50 ? "Correct 🟡" : "Attention 🔴"}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {err && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{err}</div>}
          {WELLNESS_QUESTIONS.map((q) => {
            const Icon = q.icon;
            return (
              <div key={q.key}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: q.color + "18" }}><Icon size={14} color={q.color}/></div>
                  <span className="text-[13px] font-semibold text-slate-700">{q.label}</span>
                  {q.inverted && <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider ml-1">(moins = mieux)</span>}
                </div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map((v) => {
                    const selected = form[q.key] === v;
                    const visualGood = q.inverted ? v <= 2 : v >= 4;
                    const visualBad  = q.inverted ? v >= 4 : v <= 2;
                    const btnColor = selected ? (visualGood ? "#1D9E75" : visualBad ? "#E24B4A" : "#EF9F27") : undefined;
                    return (
                      <button key={v} onClick={() => setForm(f => ({ ...f, [q.key]: v }))}
                        className={["flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                          selected ? "text-white shadow-sm scale-105" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"].join(" ")}
                        style={selected ? { background: btnColor, borderColor: btnColor } : {}}>
                        <span className="text-[16px] font-black">{v}</span>
                        <span className="text-[8px] font-semibold text-center leading-tight px-1" style={selected ? { color: "rgba(255,255,255,0.85)" } : {}}>{q.desc[v-1]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Note (optionnel)</label>
            <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white resize-none"
              rows={2} placeholder="Contexte, ressenti particulier…" value={notes} onChange={e => setNotes(e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 disabled:opacity-40">Plus tard</button>
          <button onClick={handleSubmit} disabled={!allAnswered || saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40" style={{ background: "#1D9E75" }}>
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Enregistrement…</> : <>✅ Valider</>}
          </button>
        </div>
      </div>
    </div>
  );
});

function Dashboard({ athlete, weeklyCharge, sessions, competitions, lastMessages, coachName, myPerformances, onNavigate, wellnessToday, onOpenWellness }) {
  const today = new Date();
  const currentWeek = getISOWeek(today);

  const metrics = useMemo(() =>
    getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek, wellnessToday ? [wellnessToday] : [], sessions),
  [athlete.id, weeklyCharge, currentWeek, wellnessToday, sessions]);

  const status = getStatusLabel(metrics.readiness, metrics.fatigue, metrics.acwr);

  const nextComp = useMemo(() =>
    competitions
      .filter((c) => c.athleteIds.includes(athlete.id) && new Date(c.date) >= today)
      .sort((a,b) => new Date(a.date)-new Date(b.date))[0] ?? null,
  [competitions, athlete.id]);

  const weekSessions = useMemo(() =>
    sessions.filter((s) => s.week === currentWeek).sort((a,b) => a.time.localeCompare(b.time)),
  [sessions, currentWeek]);

  const topRecords = Object.entries(athlete.records ?? {}).slice(0, 4);
  const activeInjuries = (athlete.injuries ?? []).filter((i) => i.status !== "résolu");

  const chargeHistory = useMemo(() => {
    const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
    if (!myCharge.length) return [];
    const sorted = [...myCharge].sort((a,b) => a.week - b.week).slice(-8);
    return sorted.map(w => ({
      label: `S${w.week}`,
      charge: w.rawLoad,
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
      const weekS = sessions.filter(se => se.week === w);
      const hasValidated = weekS.some(se => se.validations?.some(v => v.athleteId === athlete.id && v.status === "done"));
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
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return (myPerformances ?? []).find(p => {
      const rec = athlete.records?.[p.discipline];
      if (!rec || !p.performance_date) return false;
      const perfDate = new Date(p.performance_date);
      if (perfDate < sevenDaysAgo) return false;
      const hib = getDiscHib(p.discipline);
      const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
      if (!pv.value || !prv.value) return false;
      return hib ? pv.value >= prv.value : pv.value <= prv.value;
    }) ?? null;
  }, [myPerformances, athlete.records]);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">

      {/* ── Hero ── */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D9E75 0%, #0f7a5a 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }}/>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-[22px] font-bold flex-shrink-0">
              {initialsFromName(athlete.name)}
            </div>
            <div>
              <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wider mb-0.5">Bienvenue 👋</p>
              <h1 className="text-[22px] font-bold leading-tight">{athlete.name}</h1>
              <p className="text-white/70 text-[13px] mt-0.5">
                {athlete.mainDiscipline ?? "Athlète"}{athlete.group ? ` · ${athlete.group}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="px-3 py-1.5 rounded-full bg-white/20 text-[12px] font-bold">
              {status.dot} {status.label}
            </span>
            <p className="text-white/60 text-[11px]">
              {today.toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-4 gap-3">
          {[
            { label: "Readiness", value: metrics.readiness, hint: "/100" },
            { label: "Fatigue",   value: metrics.fatigue,   hint: "/100" },
            { label: "ACWR",      value: metrics.acwr.toFixed(2), hint: "ratio" },
            { label: "Streak",    value: streak > 0 ? `${streak}🔥` : "0", hint: "semaines" },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl px-3 py-3 text-center">
              <p className="text-[20px] font-bold text-white leading-tight">{s.value}</p>
              <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bloc Wellness ── */}
      {wellnessToday ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-bold text-slate-800">Wellness du jour ✅</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Questionnaire matinal complété</p>
            </div>
            {metrics.wellnessScore !== null && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: (metrics.wellnessScore >= 75 ? "#1D9E75" : metrics.wellnessScore >= 50 ? "#EF9F27" : "#E24B4A") + "15" }}>
                <span className="text-[22px] font-black" style={{ color: metrics.wellnessScore >= 75 ? "#1D9E75" : metrics.wellnessScore >= 50 ? "#EF9F27" : "#E24B4A" }}>{metrics.wellnessScore}</span>
                <div><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Score</p><p className="text-[9px] text-slate-400">/100</p></div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {WELLNESS_QUESTIONS.map((q) => {
              const val = wellnessToday[q.key];
              const Icon = q.icon;
              const displayGood = q.inverted ? val <= 2 : val >= 4;
              const displayBad  = q.inverted ? val >= 4 : val <= 2;
              const dotColor = displayGood ? "#1D9E75" : displayBad ? "#E24B4A" : "#EF9F27";
              return (
                <div key={q.key} className="flex flex-col items-center gap-1.5 bg-slate-50 rounded-xl py-3 px-2">
                  <Icon size={14} color={q.color}/>
                  <span className="text-[18px] font-black" style={{ color: dotColor }}>{val}</span>
                  <span className="text-[8px] text-slate-400 text-center leading-tight">{q.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
          {wellnessToday.notes && <p className="mt-3 text-[11.5px] text-slate-500 italic border-t border-slate-50 pt-3">"{wellnessToday.notes}"</p>}
          <button onClick={onOpenWellness} className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-emerald-600 transition-colors">Modifier →</button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-bold text-emerald-800">🌅 Questionnaire matinal</p>
            <p className="text-[12px] text-emerald-600 mt-1">Prends 30 secondes pour indiquer comment tu te sens. Ça améliore ton score Readiness !</p>
          </div>
          <button onClick={onOpenWellness} className="flex-shrink-0 px-4 py-2.5 rounded-xl text-white text-[12px] font-bold shadow-sm" style={{ background: "#1D9E75" }}>Remplir</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Colonne gauche ── */}
        <div className="lg:col-span-2 space-y-5">

          {hasCharge && chargeHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">Ma charge d'entraînement</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">8 dernières semaines</p>
                </div>
                {chargeTrend !== null && (
                  <div className={["px-3 py-1.5 rounded-xl text-[12px] font-bold",
                    chargeTrend > 15 ? "bg-red-50 text-red-600" :
                    chargeTrend > 0  ? "bg-amber-50 text-amber-600" :
                    chargeTrend < 0  ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                  ].join(" ")}>
                    {chargeTrend > 0 ? `+${chargeTrend}%` : `${chargeTrend}%`} vs S-1
                  </div>
                )}
              </div>
              <div className="flex items-end gap-1.5 h-[100px]">
                {chargeHistory.map((w, i) => {
                  const maxCharge = Math.max(...chargeHistory.map(x => x.charge), 1);
                  const heightPct = (w.charge / maxCharge) * 100;
                  const isCurrent = i === chargeHistory.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{height:"80px"}}>
                        <div className="w-full rounded-t-lg transition-all"
                          style={{
                            height:`${heightPct}%`,
                            background: isCurrent ? w.color : w.color + "80",
                            minHeight: "4px",
                            outline: isCurrent ? `2px solid ${w.color}` : "none",
                          }}/>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">{w.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "ACWR", value: metrics.acwr.toFixed(2), color: acwrColor(metrics.acwr), sub: "0.8–1.3 optimal" },
                  { label: "Charge aiguë", value: metrics.acute, color: "#378ADD", sub: "4 dernières sem." },
                  { label: "Charge chronique", value: metrics.chronic, color: "#94a3b8", sub: "12 dernières sem." },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[18px] font-black" style={{color:s.color}}>{s.value}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Sous-charge</span>
                  <span className="font-bold text-emerald-600">Zone optimale</span>
                  <span>Surcharge</span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{background:"linear-gradient(to right, #378ADD 0%, #1D9E75 40%, #1D9E75 65%, #EF9F27 80%, #E24B4A 100%)"}}>
                  <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-md transition-all"
                    style={{left:`${Math.min(95,Math.max(2,(metrics.acwr/2)*100))}%`}}/>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>0</span><span>0.8</span><span>1.3</span><span>2.0</span>
                </div>
              </div>
            </div>
          )}

          {hasCharge && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">État de forme détaillé</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Basé sur ta charge des dernières semaines</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  {
                    label: "Readiness", value: metrics.readiness, color: scoreColor(metrics.readiness), inv: false,
                    norm: metrics.readiness >= 75 ? { dot: "🟢", label: "Dans les normes", hint: "Tu es prêt pour une séance intense" }
                        : metrics.readiness >= 55 ? { dot: "🟡", label: "Limite", hint: `Zone optimale à partir de 75 — ${75 - metrics.readiness} points manquants` }
                        : { dot: "🔴", label: "En dessous", hint: "Privilégie une séance légère ou du repos" },
                  },
                  {
                    label: "Forme", value: metrics.forme, color: scoreColor(metrics.forme), inv: false,
                    norm: metrics.forme >= 75 ? { dot: "🟢", label: "Excellente", hint: "Condition physique au-dessus de la normale" }
                        : metrics.forme >= 50 ? { dot: "🟡", label: "Correcte", hint: "En progression — continue à t'entraîner régulièrement" }
                        : { dot: "🔴", label: "Faible", hint: "Charge chronique insuffisante — augmente progressivement le volume" },
                  },
                  {
                    label: "Fatigue", value: metrics.fatigue, color: scoreColor(metrics.fatigue, true), inv: true,
                    norm: metrics.fatigue <= 45 ? { dot: "🟢", label: "Normale", hint: "Pas de signe de suraccumulation" }
                        : metrics.fatigue <= 70 ? { dot: "🟡", label: "Modérée", hint: "Surveille l'accumulation — limite les séances intenses" }
                        : { dot: "🔴", label: "Élevée", hint: "Repos ou récupération active fortement conseillés" },
                  },
                  {
                    label: "Récupération", value: metrics.recuperation, color: scoreColor(metrics.recuperation), inv: false,
                    norm: metrics.recuperation >= 70 ? { dot: "🟢", label: "Complète", hint: "Tu es physiologiquement disponible" }
                        : metrics.recuperation >= 45 ? { dot: "🟡", label: "Partielle", hint: "Encore quelques heures nécessaires avant effort intense" }
                        : { dot: "🔴", label: "Insuffisante", hint: "Récupération neuromusculaire incomplète [Hasegawa 2024]" },
                  },
                  {
                    label: "Risque blessure", value: metrics.risque, color: scoreColor(metrics.risque, true), inv: true,
                    norm: metrics.risque <= 20 ? { dot: "🟢", label: "Faible", hint: "Pas d'alerte détectée" }
                        : metrics.risque <= 50 ? { dot: "🟡", label: "Modéré", hint: "ACWR ou monotonie élevés — varie tes séances" }
                        : { dot: "🔴", label: "Élevé", hint: "Réduis la charge immédiatement [Gabbett 2016]" },
                  },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-slate-800">{s.label}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: s.color + "18", color: s.color }}>
                            {s.norm.dot} {s.norm.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{s.norm.hint}</p>
                      </div>
                      <span className="text-[22px] font-black flex-shrink-0" style={{color:s.color}}>{s.value}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{width:`${s.value}%`, background:s.color}}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-300 mt-1">
                      <span>0</span>
                      <span>{s.inv ? "Critique > 70" : "Optimal ≥ 75"}</span>
                      <span>100</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-300 mt-4 text-center">
                Normes ACWR : Gabbett (2016) · Récupération : Hasegawa (2024) · Autres scores : convention coaching
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">Cette semaine</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {weekSessions.filter(s=>s.validations?.find(v=>v.athleteId===athlete.id&&v.status==="done")).length}/{weekSessions.length} réalisées
                </p>
              </div>
              <button onClick={() => onNavigate("planning")} className="text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700">
                Voir tout →
              </button>
            </div>
            {weekSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-300">
                <CalendarDays size={28} className="mx-auto mb-2" strokeWidth={1.5}/>
                <p className="text-[12px]">Aucune séance cette semaine</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {weekSessions.map((s) => {
                  const c = colorsFor(s.category);
                  const val = s.validations?.find((v) => v.athleteId === athlete.id);
                  const st = val?.status ?? "future";
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.border }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-700 truncate">{s.title}</p>
                        <p className="text-[10.5px] text-slate-400">
                          {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("fr-BE",{weekday:"short",day:"numeric",month:"short"}) : s.day} · {s.time}
                        </p>
                      </div>
                      {s.pdfUrl&&<a href={s.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">📄</a>}
                      <span className={["text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0",
                        st==="done"?"bg-emerald-50 text-emerald-700":st==="partial"?"bg-amber-50 text-amber-700":st==="none"?"bg-red-50 text-red-700":"bg-slate-100 text-slate-400"].join(" ")}>
                        {st==="done"?"✅":st==="partial"?"🟡":st==="none"?"❌":"🔵"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {latestPR && (
            <div className="rounded-2xl p-4 text-white relative overflow-hidden"
              style={{background:"linear-gradient(135deg, #EF9F27 0%, #f59e0b 100%)"}}>
              <div className="absolute inset-0 opacity-20"
                style={{backgroundImage:"radial-gradient(circle at 90% 10%, white 0%, transparent 50%)"}}/>
              <div className="relative flex items-center gap-3">
                <div className="text-[32px]">🏆</div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Nouveau record personnel !</p>
                  <p className="text-[16px] font-black">{latestPR.discipline} — {latestPR.value}</p>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    {new Date(latestPR.performance_date).toLocaleDateString("fr-BE",{day:"numeric",month:"long"})}
                  </p>
                </div>
              </div>
            </div>
          )}

          {topRecords.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Mes records</h3>
                <button onClick={() => onNavigate("performances")} className="text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700">
                  Tout voir →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                {topRecords.map(([disc, r]) => {
                  const c = DISC_TYPE_COLORS[getDiscType(disc)] ?? DISC_TYPE_COLORS.sprint;
                  return (
                    <div key={disc} className="bg-white px-4 py-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{background:c.dot}}/>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{disc}</p>
                      </div>
                      <p className="text-[20px] font-black" style={{color:c.border}}>{r.pr}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">SB : {r.sb}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">Mes badges</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unlockedBadges.length} débloqué{unlockedBadges.length>1?"s":""} · {lockedBadges.length} à venir
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[14px]">🏆</span>
                <span className="text-[13px] font-black text-amber-600">{unlockedBadges.length}</span>
              </div>
            </div>
            {unlockedBadges.length === 0 ? (
              <div className="text-center py-6 text-slate-300">
                <p className="text-[12px]">Commence à t'entraîner pour débloquer tes premiers badges !</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {unlockedBadges.slice(0, 8).map(b => <BadgeItem key={b.id} badge={b}/>)}
                </div>
                {lockedBadges.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">À débloquer</p>
                    <div className="grid grid-cols-4 gap-2">
                      {lockedBadges.slice(0, 4).map(b => <BadgeItem key={b.id} badge={b}/>)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Colonne droite ── */}
        <div className="space-y-5">
          {nextComp && (
            <div className="rounded-2xl p-5 text-white"
              style={{ background: "linear-gradient(135deg, #E24B4A 0%, #c73a39 100%)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16}/>
                <span className="text-[11px] font-bold uppercase tracking-wider">Prochaine compétition</span>
              </div>
              <p className="text-[16px] font-bold leading-tight mb-1">{nextComp.name}</p>
              <p className="text-white/70 text-[12px] mb-3">
                {new Date(nextComp.date).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}
              </p>
              {(() => {
                const days = Math.round((new Date(nextComp.date)-today)/(1000*60*60*24));
                return (
                  <div className="bg-white/20 rounded-xl px-4 py-3 text-center mb-3">
                    <p className="text-[32px] font-black">{days}</p>
                    <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider">jours</p>
                  </div>
                );
              })()}
              {nextComp.plannedEvents?.[athlete.id] && (
                <div className="bg-white/20 rounded-xl px-3 py-2">
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Épreuve prévue</p>
                  <p className="text-white font-bold text-[13px]">{nextComp.plannedEvents[athlete.id]}</p>
                </div>
              )}
            </div>
          )}

          {streak > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
              <p className="text-[40px] font-black text-amber-500">🔥 {streak}</p>
              <p className="text-[13px] font-bold text-slate-700 mt-1">semaine{streak>1?"s":""} consécutive{streak>1?"s":""}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">avec au moins 1 séance validée</p>
            </div>
          )}

          {activeInjuries.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={15} color="#EF9F27"/>
                <h3 className="text-[13px] font-bold text-amber-800">Blessures en cours</h3>
              </div>
              <div className="space-y-2">
                {activeInjuries.map((inj) => (
                  <div key={inj.id} className="bg-white rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-slate-700">{inj.name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{inj.intensity}/10</span>
                    </div>
                    <p className="text-[11px] text-slate-400">📍 {inj.location}</p>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width:`${(inj.intensity/10)*100}%`,
                        background: inj.intensity<=3?"#1D9E75":inj.intensity<=6?"#EF9F27":"#E24B4A"
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastMessages.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-slate-800">📩 Coach</h3>
                <button onClick={() => onNavigate("messagerie")} className="text-[11px] text-emerald-600 font-semibold">Répondre →</button>
              </div>
              {lastMessages.slice(0,2).map((m) => (
                <div key={m.id} className="bg-slate-50 rounded-xl px-3 py-2.5 mb-2">
                  <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">{m.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleDateString("fr-BE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!hasCharge && (
            <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 text-center">
              <BarChart2 size={28} className="mx-auto mb-2 text-slate-300" strokeWidth={1.5}/>
              <p className="text-[12px] font-semibold text-slate-400">Charge indisponible</p>
              <p className="text-[11px] text-slate-300 mt-1">Tes scores de forme apparaîtront après tes premières séances avec RPE</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VUE 2 — MON PLANNING
// ══════════════════════════════════════════════════════════════════════════════

 const CreateSessionModal = memo(({ athlete, allAthletes, clubId, createdBy, coachUserId, onClose, onCreated }) => {
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
  const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title:"", category:"technique", time:"10:00", durationMinutes:60,
    description:"", sessionDate: today, invitedAthletes:[],
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleInvite = (id) => setForm(f=>({...f,invitedAthletes:f.invitedAthletes.includes(id)?f.invitedAthletes.filter(x=>x!==id):[...f.invitedAthletes,id]}));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true); setErr(null);
    try {
      let pdfUrl = null;
      if (pdfFile) {
        const ext=pdfFile.name.split(".").pop(), path=`session-pdfs/${Date.now()}.${ext}`;
        const {error:ue}=await supabase.storage.from("session-pdfs").upload(path,pdfFile,{upsert:true});
        if(ue) throw ue;
        const {data:ud}=supabase.storage.from("session-pdfs").getPublicUrl(path);
        pdfUrl=ud?.publicUrl??null;
      }
      const catLabel = CATEGORIES.find(c=>c.id===form.category)?.label??form.category;
      const {data:ns,error:se}=await supabase.from("sessions").insert({
        club_id:clubId, week:dateToISOWeek(form.sessionDate), day:dateToDayName(form.sessionDate),
        session_date:form.sessionDate, time:form.time, type:catLabel, category:form.category,
        title:form.title, description:form.description||null, duration_minutes:form.durationMinutes,
        load_weight:1.0, pdf_url:pdfUrl, created_by:createdBy,
      }).select().single();
      if(se) throw se;
      const allIds=[athlete.id,...form.invitedAthletes];
      await supabase.from("session_athletes").insert(allIds.map(id=>({session_id:ns.id,athlete_id:id,status:null})));
      await supabase.from("alerts").insert({
        club_id:clubId, athlete_id:athlete.id, type:"absence",
        title:`📋 Séance proposée par ${athlete.name}`,
        description:`${athlete.name} a planifié "${form.title}" (${catLabel}) le ${new Date(form.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"long"})}.`,
        severity:"légère", is_read:false,
      });
      if (coachUserId) notifyCoachMessage(coachUserId, athlete.name, `${athlete.name} a planifié "${form.title}" le ${new Date(form.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"long"})}`).catch(console.warn);
      onCreated(); onClose();
    } catch(e) { setErr(e.message??"Erreur"); setSaving(false); }
  };

  const others = allAthletes.filter(a=>a.id!==athlete.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{background:"rgba(15,23,42,0.45)"}}
      onClick={e=>e.target===e.currentTarget&&!saving&&onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="text-[16px] font-bold text-slate-800">Planifier une séance</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">Ton coach sera notifié</p></div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500"/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err&&<div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{err}</div>}
          <div><label className={labelCls}>Titre *</label><input className={inputCls} placeholder="Ex: Footing récup, Technique saut…" value={form.title} onChange={e=>set("title",e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Catégorie</label><select className={inputCls} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label className={labelCls}>Heure</label><input type="time" className={inputCls} value={form.time} onChange={e=>set("time",e.target.value)}/></div>
          </div>
          <div><label className={labelCls}>Date *</label><input type="date" className={inputCls} value={form.sessionDate} onChange={e=>set("sessionDate",e.target.value)}/></div>
          <div><label className={labelCls}>Durée (min)</label><input type="number" min="5" step="5" className={inputCls} value={form.durationMinutes} onChange={e=>set("durationMinutes",Number(e.target.value))}/></div>
          <div><label className={labelCls}>Description</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={e=>set("description",e.target.value)}/></div>
          <div><label className={labelCls}>PDF (optionnel)</label>
            <input type="file" accept="application/pdf" onChange={e=>setPdfFile(e.target.files?.[0]??null)} className="w-full text-[12px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11.5px] file:font-semibold file:bg-emerald-50 file:text-emerald-700"/>
            {pdfFile&&<p className="text-[11px] text-slate-400 mt-1">📎 {pdfFile.name}</p>}
          </div>
          {others.length>0&&(
            <div><label className={labelCls}>Proposer à d'autres athlètes</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {others.map(a=>{const sel=form.invitedAthletes.includes(a.id);return(
                  <button key={a.id} type="button" onClick={()=>toggleInvite(a.id)}
                    className={["flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all",sel?"bg-emerald-50 border-emerald-400 text-emerald-700":"bg-white border-slate-200 text-slate-500"].join(" ")}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{background:sel?"#1D9E75":"#94a3b8"}}>{initialsFromName(a.name).slice(0,1)}</div>
                    {a.name.split(" ")[0]}
                  </button>
                );})}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.title.trim()||saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40" style={{background:"#1D9E75"}}>
            {saving?<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Création…</>:<><Plus size={15}/>Planifier</>}
          </button>
        </div>
      </div>
    </div>
  );
});

const SessionDetailModal = memo(({ session, athlete, onClose, onSetStatus, onSetRpe, onSetFeeling, onSetComment }) => {
  const c = colorsFor(session.category);
  const val = session.validations?.find(v=>v.athleteId===athlete.id);
  const [comment, setComment] = useState(val?.comment??"");

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})
    : `${session.day}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{background:"rgba(15,23,42,0.5)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{background:c.bg, borderBottom:`2px solid ${c.border}`}}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2 inline-block"
              style={{background:c.border+"30",color:c.text}}>
              {CATEGORIES.find(x=>x.id===session.category)?.label??session.type}
            </span>
            <h3 className="text-[18px] font-bold" style={{color:c.text}}>{session.title}</h3>
            <p className="text-[12px] mt-1" style={{color:c.text+"aa"}}>
              📅 {dateStr} · ⏰ {session.time}{session.durationMinutes?` · ${session.durationMinutes} min`:""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10"><X size={18} style={{color:c.text}}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {session.description&&<p className="text-[13px] text-slate-600 leading-relaxed">{session.description}</p>}
          {session.instructions&&(
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Consignes du coach</p>
              <p className="text-[12.5px] text-amber-800">{session.instructions}</p>
            </div>
          )}
          {session.pdfUrl&&(
            <a href={session.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[13px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors">
              📄 Voir le PDF de séance
            </a>
          )}

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Présence</p>
            <div className="flex gap-2">
              {[{id:"done",label:"✅ Réalisée",cls:"border-emerald-400 bg-emerald-50 text-emerald-700"},
                {id:"partial",label:"🟡 Partielle",cls:"border-amber-400 bg-amber-50 text-amber-700"},
                {id:"none",label:"❌ Absent",cls:"border-red-400 bg-red-50 text-red-700"},
              ].map(opt=>(
                <button key={opt.id} onClick={()=>onSetStatus(session.id,athlete.id,opt.id)}
                  className={["flex-1 px-2 py-2 rounded-lg text-[11px] font-semibold border-2 transition-all",val?.status===opt.id?opt.cls:"bg-white border-slate-200 text-slate-400"].join(" ")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {val?.status&&val.status!=="none"&&(
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Effort ressenti (RPE) {val?.rpe!=null&&<span className="text-amber-600 ml-1">{val.rpe}/10</span>}
              </p>
              <div className="flex gap-1 flex-wrap">
                {Array.from({length:11},(_,i)=>(
                  <button key={i} onClick={()=>onSetRpe(session.id,athlete.id,i)}
                    className={["w-9 h-9 rounded-lg text-[12px] font-bold border transition-all",
                      val?.rpe===i?i<=3?"bg-emerald-500 text-white border-emerald-600":i<=6?"bg-amber-500 text-white border-amber-600":"bg-red-500 text-white border-red-600"
                      :"bg-white text-slate-500 border-slate-200"].join(" ")}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(val?.status==="done"||val?.status==="partial")&&(
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Ressenti général {val?.feeling!=null&&<span className="text-amber-500 ml-1">{val.feeling}/5</span>}
              </p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>onSetFeeling(session.id,athlete.id,n)} className="p-1 hover:scale-110 transition-transform">
                    <Star size={26} fill={val?.feeling>=n?"#EF9F27":"none"} color={val?.feeling>=n?"#EF9F27":"#e2e8f0"}/>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(val?.status==="done"||val?.status==="partial")&&(
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Commentaire</p>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                rows={3} placeholder="Comment s'est passée la séance ?"
                value={comment} onChange={e=>setComment(e.target.value)}
                onBlur={()=>onSetComment(session.id,athlete.id,comment.trim())}
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200">Fermer</button>
        </div>
      </div>
    </div>
  );
});

function MonPlanning({ athlete, sessions, allAthletes, clubId, createdBy, coachUserId, onRpeChange, onStatusChange, onFeelingChange, onCommentChange, onRefresh }) {
  const today    = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,      setViewYear]      = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(today.getMonth());
  const [viewMode,      setViewMode]      = useState(isMobile ? "agenda" : "month");
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [activeSession, setActiveSession] = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (!s.sessionDate) return;
      const key = s.sessionDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const calDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const weekDays = useMemo(() => {
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selectedDate]);

  const groupedByDate = useMemo(() => {
    const sorted = [...sessions].filter(s => s.sessionDate).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const groups = [];
    const seen = new Set();
    sorted.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [sessions]);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()-7); setSelectedDate(d); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()+7); setSelectedDate(d); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F5F2" }}>
      <div className="bg-white border-b border-slate-100 px-3 py-2.5 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={viewMode === "month" ? prevMonth : prevWeek}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
            <ChevronLeft size={16}/>
          </button>
          <span className="text-[13px] font-bold text-slate-800 min-w-[120px] text-center truncate">{navLabel}</span>
          <button onClick={viewMode === "month" ? nextMonth : nextWeek}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
            <ChevronRight size={16}/>
          </button>
          <button onClick={goToday} className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">Auj.</button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-semibold">
            <button onClick={() => setViewMode("agenda")} className={["px-2 py-1.5 transition-colors", viewMode==="agenda"?"bg-slate-800 text-white":"bg-white text-slate-500"].join(" ")}>Liste</button>
            <button onClick={() => setViewMode("month")}  className={["px-2 py-1.5 transition-colors", viewMode==="month" ?"bg-slate-800 text-white":"bg-white text-slate-500"].join(" ")}>Mois</button>
            <button onClick={() => setViewMode("week")}   className={["px-2 py-1.5 transition-colors", viewMode==="week"  ?"bg-slate-800 text-white":"bg-white text-slate-500"].join(" ")}>Sem.</button>
          </div>
          <button onClick={() => setShowCreate(true)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: "#1D9E75" }}>
            <Plus size={15}/>
          </button>
        </div>
      </div>

      {/* ===== VUE AGENDA ===== */}
      {viewMode === "agenda" && (
        <div className="flex-1 overflow-y-auto">
          {groupedByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 gap-3 p-6">
              <CalendarDays size={36} strokeWidth={1.5}/>
              <p className="text-[14px] font-semibold text-center">Aucune séance planifiée</p>
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-white text-[12px] font-semibold" style={{ background: "#1D9E75" }}>Planifier une séance</button>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {groupedByDate.map(({ date, sessions: ds }) => {
                const dateObj = new Date(date);
                const isToday = isSameDay(dateObj, today);
                const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={["w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0",
                        isToday ? "bg-emerald-500 text-white" : isPast ? "bg-slate-100 text-slate-400" : "bg-white border border-slate-200 text-slate-700"].join(" ")}>
                        <span className="text-[9px] font-bold uppercase leading-none">{dateObj.toLocaleDateString("fr-BE",{weekday:"short"}).replace(".","")}</span>
                        <span className="text-[15px] font-black leading-none">{dateObj.getDate()}</span>
                      </div>
                      <div>
                        <p className={["text-[12px] font-bold", isToday?"text-emerald-600":isPast?"text-slate-400":"text-slate-700"].join(" ")}>
                          {isToday ? "Aujourd'hui" : dateObj.toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})}
                        </p>
                        <p className="text-[10px] text-slate-400">{ds.length} séance{ds.length>1?"s":""}</p>
                      </div>
                    </div>
                    <div className="space-y-2 ml-3 pl-8 border-l-2 border-slate-100">
                      {ds.sort((a,b)=>a.time.localeCompare(b.time)).map(s => {
                        const c   = colorsFor(s.category);
                        const val = s.validations?.find(v => v.athleteId === athlete.id);
                        const st  = val?.status ?? "future";
                        const rpeNeeded = isPast && !val?.rpe && st !== "none" && st !== "future";
                        return (
                          <div key={s.id} onClick={() => setActiveSession(s)}
                            className={["bg-white rounded-2xl border cursor-pointer active:scale-[0.98] transition-all overflow-hidden shadow-sm",
                              rpeNeeded ? "border-amber-300 border-2" : "border-slate-100"].join(" ")}>
                            <div className="px-4 py-2.5 flex items-center justify-between"
                              style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: c.text }}>
                                  {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                                </span>
                                {s.pdfUrl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">📄 PDF</span>}
                              </div>
                              <span className={["text-[10px] font-bold px-2 py-0.5 rounded-full",
                                st==="done"?"bg-emerald-100 text-emerald-700":st==="partial"?"bg-amber-100 text-amber-700":st==="none"?"bg-red-100 text-red-700":"bg-white/60 text-slate-500"].join(" ")}>
                                {st==="done"?"✅ Faite":st==="partial"?"🟡 Partielle":st==="none"?"❌ Absent":"🔵 Prévue"}
                              </span>
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-[15px] font-bold text-slate-800 leading-tight mb-1">{s.title}</p>
                              <div className="flex items-center gap-3 text-[12px] text-slate-400">
                                <span className="flex items-center gap-1"><Clock size={11}/> {s.time}</span>
                                {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                                {val?.rpe != null && <span className="font-semibold text-slate-600">RPE {val.rpe}/10</span>}
                              </div>
                              {s.instructions && (
                                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 line-clamp-2">💬 {s.instructions}</p>
                              )}
                              {rpeNeeded && <p className="text-[11px] font-bold text-amber-600 mt-2">⏳ RPE en attente · Valide ta séance</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== VUE MOIS ===== */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-7 mb-1.5">
            {DAYS_SHORT.map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map(({ date, cur }, idx) => {
              const key     = date.toISOString().slice(0, 10);
              const ds      = sessionsByDate[key] ?? [];
              const isToday = isSameDay(date, today);
              const isSel   = selectedDate && isSameDay(date, selectedDate);
              return (
                <div key={idx}
                  onClick={() => { setSelectedDate(date); if (ds.length > 0 && isMobile) setViewMode("agenda"); }}
                  className={["min-h-[52px] rounded-xl p-1 cursor-pointer transition-all border",
                    isToday?"bg-emerald-50 border-emerald-300 border-2":isSel?"bg-blue-50 border-blue-200 border-2":
                    cur?"bg-white border-slate-100 hover:border-slate-200":"bg-slate-50/50 border-transparent opacity-40"].join(" ")}>
                  <div className="flex items-center justify-center mb-0.5">
                    <span className={["text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      isToday?"bg-emerald-500 text-white":cur?"text-slate-700":"text-slate-400"].join(" ")}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-0.5 justify-center md:block md:space-y-0.5">
                    {ds.slice(0,3).map(s => {
                      const c = colorsFor(s.category);
                      return (
                        <div key={s.id}>
                          <div className="md:hidden w-1.5 h-1.5 rounded-full" style={{ background: c.border }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }}/>
                          <div className="hidden md:flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold truncate cursor-pointer hover:opacity-80"
                            style={{ background: c.bg, color: c.text, borderLeft: `2px solid ${c.border}` }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }}>
                            <span className="truncate">{s.title}</span>
                          </div>
                        </div>
                      );
                    })}
                    {ds.length > 3 && <div className="md:hidden w-1.5 h-1.5 rounded-full bg-slate-300"/>}
                    {ds.length > 3 && <div className="hidden md:block text-[9px] text-slate-400 px-0.5">+{ds.length-3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDate && (() => {
            const key = selectedDate.toISOString().slice(0, 10);
            const ds  = (sessionsByDate[key] ?? []).sort((a,b) => a.time.localeCompare(b.time));
            if (!ds.length) return null;
            return (
              <div className="mt-4 space-y-2">
                <p className="text-[12px] font-bold text-slate-600 mb-2">{selectedDate.toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})}</p>
                {ds.map(s => {
                  const c   = colorsFor(s.category);
                  const val = s.validations?.find(v => v.athleteId === athlete.id);
                  const st  = val?.status ?? "future";
                  return (
                    <div key={s.id} onClick={() => setActiveSession(s)}
                      className="bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-sm">
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                        <span className="text-[10px] font-bold uppercase" style={{ color: c.text }}>{CATEGORIES.find(x=>x.id===s.category)?.label??s.type}</span>
                        <span className={["text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                          st==="done"?"bg-emerald-100 text-emerald-700":st==="partial"?"bg-amber-100 text-amber-700":st==="none"?"bg-red-100 text-red-700":"bg-white/60 text-slate-400"].join(" ")}>
                          {st==="done"?"✅":st==="partial"?"🟡":st==="none"?"❌":"🔵"}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[13px] font-bold text-slate-800">{s.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.time}{s.durationMinutes?` · ${s.durationMinutes} min`:""}{ val?.rpe!=null?` · RPE ${val.rpe}`:""}</p>
                        {s.pdfUrl && <p className="text-[10px] text-blue-500 mt-1">📄 PDF joint</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== VUE SEMAINE ===== */}
      {viewMode === "week" && (
        <div className="flex-1 overflow-y-auto">
          <div className="md:hidden">
            <div className="flex overflow-x-auto gap-2 px-3 py-2.5 bg-white border-b border-slate-100 scrollbar-hide">
              {weekDays.map((date, i) => {
                const isToday = isSameDay(date, today);
                const isSel   = isSameDay(date, selectedDate ?? today);
                const hasSess = (sessionsByDate[date.toISOString().slice(0,10)] ?? []).length > 0;
                return (
                  <button key={i} onClick={() => setSelectedDate(date)}
                    className={["flex-shrink-0 flex flex-col items-center gap-0.5 w-10 py-2 rounded-xl transition-all",
                      isToday?"bg-emerald-500":isSel?"bg-slate-800":"bg-transparent"].join(" ")}>
                    <span className={["text-[9px] font-bold uppercase",(isToday||isSel)?"text-white/70":"text-slate-400"].join(" ")}>{DAYS_SHORT[i]}</span>
                    <span className={["text-[16px] font-black",(isToday||isSel)?"text-white":"text-slate-700"].join(" ")}>{date.getDate()}</span>
                    {hasSess && <div className={["w-1 h-1 rounded-full",(isToday||isSel)?"bg-white/60":"bg-emerald-400"].join(" ")}/>}
                  </button>
                );
              })}
            </div>
            <div className="p-3 space-y-2">
              {(() => {
                const key = (selectedDate ?? today).toISOString().slice(0, 10);
                const ds  = (sessionsByDate[key] ?? []).sort((a,b) => a.time.localeCompare(b.time));
                if (!ds.length) return (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
                    <CalendarDays size={28} strokeWidth={1.5}/>
                    <p className="text-[12px]">Repos ce jour</p>
                    <button onClick={() => setShowCreate(true)} className="text-[11.5px] font-semibold text-emerald-600">+ Planifier</button>
                  </div>
                );
                return ds.map(s => {
                  const c   = colorsFor(s.category);
                  const val = s.validations?.find(v => v.athleteId === athlete.id);
                  const st  = val?.status ?? "future";
                  return (
                    <div key={s.id} onClick={() => setActiveSession(s)}
                      className="bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-sm">
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                        <span className="text-[10px] font-bold uppercase" style={{ color: c.text }}>{CATEGORIES.find(x=>x.id===s.category)?.label??s.type}</span>
                        <span className={["text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                          st==="done"?"bg-emerald-100 text-emerald-700":st==="partial"?"bg-amber-100 text-amber-700":st==="none"?"bg-red-100 text-red-700":"bg-white/60 text-slate-400"].join(" ")}>
                          {st==="done"?"✅ Faite":st==="partial"?"🟡":st==="none"?"❌":"🔵 Prévue"}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[15px] font-bold text-slate-800">{s.title}</p>
                        <div className="flex items-center gap-3 text-[12px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><Clock size={11}/> {s.time}</span>
                          {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                        </div>
                        {s.instructions && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 line-clamp-2">💬 {s.instructions}</p>}
                        {s.pdfUrl && (
                          <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                            className="text-[11px] text-blue-600 font-semibold mt-2 flex items-center gap-1 w-fit">📄 Voir le PDF</a>
                        )}
                        {val?.rpe != null && <p className="text-[11px] font-semibold text-slate-500 mt-1">RPE {val.rpe}/10</p>}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          <div className="hidden md:block p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((date, i) => {
                const key     = date.toISOString().slice(0, 10);
                const ds      = (sessionsByDate[key] ?? []).sort((a,b) => a.time.localeCompare(b.time));
                const isToday = isSameDay(date, today);
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className={["text-center py-2 rounded-xl border",isToday?"bg-emerald-500 border-emerald-500":"bg-white border-slate-100"].join(" ")}>
                      <p className={["text-[9px] font-bold uppercase",isToday?"text-white/70":"text-slate-400"].join(" ")}>{DAYS_SHORT[i]}</p>
                      <p className={["text-[15px] font-black",isToday?"text-white":"text-slate-700"].join(" ")}>{date.getDate()}</p>
                    </div>
                    <div className="space-y-1.5">
                      {ds.map(s => {
                        const c  = colorsFor(s.category);
                        const val= s.validations?.find(v=>v.athleteId===athlete.id);
                        const st = val?.status??"future";
                        return (
                          <div key={s.id} onClick={()=>setActiveSession(s)} className="rounded-xl border overflow-hidden cursor-pointer hover:shadow-md transition-all" style={{borderColor:c.border,borderWidth:"1.5px"}}>
                            <div className="px-2 py-1" style={{background:c.bg}}><p className="text-[9px] font-bold uppercase truncate" style={{color:c.text}}>{CATEGORIES.find(x=>x.id===s.category)?.label??s.type}</p></div>
                            <div className="px-2 py-2 bg-white">
                              <p className="text-[11px] font-semibold text-slate-800 truncate">{s.title}</p>
                              <p className="text-[10px] text-slate-400">{s.time}</p>
                              <span className={["text-[9px] font-bold px-1 py-0.5 rounded-full mt-1 inline-block",st==="done"?"bg-emerald-50 text-emerald-700":st==="partial"?"bg-amber-50 text-amber-700":st==="none"?"bg-red-50 text-red-700":"bg-slate-100 text-slate-400"].join(" ")}>
                                {st==="done"?"✅":st==="partial"?"🟡":st==="none"?"❌":"🔵"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {!ds.length && <div className="h-16 flex items-center justify-center text-slate-200 text-[9px] border-2 border-dashed border-slate-100 rounded-xl">Repos</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {liveActive && (
        <SessionDetailModal session={liveActive} athlete={athlete} onClose={() => setActiveSession(null)}
          onSetStatus={onStatusChange} onSetRpe={onRpeChange} onSetFeeling={onFeelingChange} onSetComment={onCommentChange}/>
      )}
      {showCreate && (
        <CreateSessionModal athlete={athlete} allAthletes={allAthletes} clubId={clubId} createdBy={createdBy}
          coachUserId={coachUserId}
          onClose={() => setShowCreate(false)} onCreated={onRefresh}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VUE 3 — MES PERFORMANCES
// ══════════════════════════════════════════════════════════════════════════════

const DISC_PRESETS = [
  { name: "100m",        type: "sprint",    unit: "s",     hib: false },
  { name: "200m",        type: "sprint",    unit: "s",     hib: false },
  { name: "400m",        type: "sprint",    unit: "s",     hib: false },
  { name: "800m",        type: "endurance", unit: "min:s", hib: false },
  { name: "1500m",       type: "endurance", unit: "min:s", hib: false },
  { name: "60m haies",   type: "sprint",    unit: "s",     hib: false },
  { name: "100m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "110m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "400m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "Longueur",    type: "saut",      unit: "m",     hib: true  },
  { name: "Triple saut", type: "saut",      unit: "m",     hib: true  },
  { name: "Hauteur",     type: "saut",      unit: "m",     hib: true  },
  { name: "Perche",      type: "saut",      unit: "m",     hib: true  },
  { name: "Poids",       type: "lancer",    unit: "m",     hib: true  },
  { name: "Disque",      type: "lancer",    unit: "m",     hib: true  },
  { name: "Javelot",     type: "lancer",    unit: "m",     hib: true  },
  { name: "Marteau",     type: "lancer",    unit: "m",     hib: true  },
  { name: "Décathlon",   type: "combine",   unit: "pts",   hib: true  },
  { name: "Heptathlon",  type: "combine",   unit: "pts",   hib: true  },
];

const DISC_TYPE_COLORS = {
  sprint:    { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", dot: "#3B82F6" },
  endurance: { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", dot: "#0284C7" },
  saut:      { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8", dot: "#A855F7" },
  lancer:    { bg: "#FFEDD5", border: "#F97316", text: "#9A3412", dot: "#F97316" },
  combine:   { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", dot: "#CA8A04" },
};

function getDiscType(discName) {
  return DISC_PRESETS.find(d => d.name === discName)?.type ?? "sprint";
}
function getDiscHib(discName) {
  return DISC_PRESETS.find(d => d.name === discName)?.hib ?? false;
}

const AddPerfModal = memo(({ athlete, clubId, onClose, onAdded }) => {
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
  const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    discipline: DISC_PRESETS[0].name,
    customDisc: "",
    useCustom: false,
    value: "",
    performanceDate: today,
    context: "",
    source: "training",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const finalDisc  = form.useCustom ? form.customDisc : form.discipline;
  const discType   = getDiscType(finalDisc);
  const discColors = DISC_TYPE_COLORS[discType] ?? DISC_TYPE_COLORS.sprint;

  const handleSubmit = async () => {
    if (!finalDisc.trim() || !form.value.trim() || !form.performanceDate) return;
    setSaving(true); setErr(null);
    try {
      const { error: e } = await supabase.from("athlete_performances").insert({
        athlete_id:       athlete.id,
        club_id:          clubId,
        discipline:       finalDisc.trim(),
        value:            form.value.trim(),
        discipline_type:  discType,
        performance_date: form.performanceDate,
        context:          form.context || null,
        source:           form.source,
      });
      if (e) throw e;

      const hib = getDiscHib(finalDisc);
      const { data: existingRec } = await supabase.from("records")
        .select("*").eq("athlete_id", athlete.id).eq("discipline", finalDisc).single();

      const newVal = parsePerf(form.value.trim());
      const oldPr  = existingRec ? parsePerf(existingRec.pr) : { value: null, hib };

      const isNewPR = !existingRec || (newVal.value !== null && oldPr.value !== null &&
        (hib ? newVal.value > oldPr.value : newVal.value < oldPr.value));

      if (isNewPR && newVal.value !== null) {
        if (existingRec) {
          await supabase.from("records").update({
            pr: form.value.trim(), pr_date: form.performanceDate, sb: form.value.trim(),
          }).eq("id", existingRec.id);
        } else {
          await supabase.from("records").insert({
            athlete_id: athlete.id, discipline: finalDisc.trim(),
            sb: form.value.trim(), pr: form.value.trim(), pr_date: form.performanceDate,
          });
        }
      }

      onAdded();
      onClose();
    } catch(e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{background:"rgba(15,23,42,0.45)"}}
      onClick={e=>e.target===e.currentTarget&&!saving&&onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{background:discColors.bg, borderBottom:`2px solid ${discColors.border}`}}>
          <div>
            <h3 className="text-[16px] font-bold" style={{color:discColors.text}}>Ajouter une performance</h3>
            <p className="text-[12px] mt-0.5" style={{color:discColors.text+"aa"}}>Elle sera ajoutée à ton historique</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-black/10"><X size={18} style={{color:discColors.text}}/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err&&<div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{err}</div>}
          <div>
            <label className={labelCls}>Discipline *</label>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={()=>set("useCustom",false)}
                className={["px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all",!form.useCustom?"bg-slate-800 text-white border-slate-800":"border-slate-200 text-slate-500"].join(" ")}>
                Liste
              </button>
              <button onClick={()=>set("useCustom",true)}
                className={["px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all",form.useCustom?"bg-slate-800 text-white border-slate-800":"border-slate-200 text-slate-500"].join(" ")}>
                Personnalisée
              </button>
            </div>
            {form.useCustom ? (
              <input className={inputCls} placeholder="Ex: Décathlon, 600m…"
                value={form.customDisc} onChange={e=>set("customDisc",e.target.value)}/>
            ) : (
              <select className={inputCls} value={form.discipline} onChange={e=>set("discipline",e.target.value)}>
                {DISC_PRESETS.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{background:discColors.bg,color:discColors.text}}>
              {discType === "sprint" ? "⚡ Sprint/Haies" :
               discType === "endurance" ? "🏃 Endurance" :
               discType === "saut" ? "🦘 Saut" :
               discType === "lancer" ? "🎯 Lancer" : "🏆 Combiné"}
            </span>
          </div>
          <div>
            <label className={labelCls}>Résultat *</label>
            <input className={inputCls}
              placeholder={
                discType==="sprint"?"Ex: 10.94 ou 10.94s":
                discType==="endurance"?"Ex: 4:35.2":
                discType==="lancer"||discType==="saut"?"Ex: 7.35 ou 7.35m":
                "Ex: 7850"
              }
              value={form.value} onChange={e=>set("value",e.target.value)}/>
          </div>
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" className={inputCls} value={form.performanceDate}
              onChange={e=>set("performanceDate",e.target.value)}/>
          </div>
          <div>
            <label className={labelCls}>Contexte</label>
            <div className="flex gap-2">
              {[{id:"training",label:"🏋️ Entraînement"},{id:"competition",label:"🏟️ Compétition"},{id:"test",label:"📏 Test"}].map(s=>(
                <button key={s.id} onClick={()=>set("source",s.id)}
                  className={["flex-1 px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all",
                    form.source===s.id?"bg-slate-800 text-white border-slate-800":"bg-white border-slate-200 text-slate-500"].join(" ")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes (optionnel)</label>
            <textarea className={`${inputCls} resize-none`} rows={2}
              placeholder="Conditions, lieu, ressenti…"
              value={form.context} onChange={e=>set("context",e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.value.trim()||(form.useCustom?!form.customDisc.trim():false)||saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40"
            style={{background:"#1D9E75"}}>
            {saving?<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Enregistrement…</>:<><Plus size={15}/>Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  );
});

const AddGoalModal = memo(({ athlete, clubId, allDiscs, onClose, onAdded }) => {
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
  const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";
  const [form, setForm] = useState({ discipline: allDiscs[0] ?? "", targetValue: "", deadline: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async () => {
    if (!form.discipline || !form.targetValue.trim()) return;
    setSaving(true); setErr(null);
    try {
      const { error: e } = await supabase.from("athlete_goals").insert({
        athlete_id:   athlete.id,
        club_id:      clubId,
        discipline:   form.discipline,
        target_value: form.targetValue.trim(),
        deadline:     form.deadline || null,
        description:  form.description || null,
        achieved:     false,
      });
      if (e) throw e;
      onAdded(); onClose();
    } catch(e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{background:"rgba(15,23,42,0.45)"}}
      onClick={e=>e.target===e.currentTarget&&!saving&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
          style={{background:"linear-gradient(135deg,#f0fdf4,#dcfce7)"}}>
          <div>
            <h3 className="text-[16px] font-bold text-emerald-800">🎯 Nouvel objectif</h3>
            <p className="text-[12px] text-emerald-600 mt-0.5">Fixe-toi un objectif de performance</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-emerald-100"><X size={18} className="text-emerald-600"/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err&&<div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{err}</div>}
          <div>
            <label className={labelCls}>Discipline *</label>
            <select className={inputCls} value={form.discipline} onChange={e=>set("discipline",e.target.value)}>
              {allDiscs.map(d=><option key={d} value={d}>{d}</option>)}
              {DISC_PRESETS.filter(d=>!allDiscs.includes(d.name)).map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Objectif à atteindre *</label>
            <input className={inputCls} placeholder="Ex: 10.80, 7.50m, 58m…"
              value={form.targetValue} onChange={e=>set("targetValue",e.target.value)}/>
          </div>
          <div>
            <label className={labelCls}>Date limite (optionnel)</label>
            <input type="date" className={inputCls} value={form.deadline} onChange={e=>set("deadline",e.target.value)}/>
          </div>
          <div>
            <label className={labelCls}>Note (optionnel)</label>
            <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Contexte, motivation…"
              value={form.description} onChange={e=>set("description",e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.discipline||!form.targetValue.trim()||saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40"
            style={{background:"#1D9E75"}}>
            {saving?<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Enregistrement…</>:<><Target size={14}/>Fixer l'objectif</>}
          </button>
        </div>
      </div>
    </div>
  );
});

function MesPerformances({ athlete, competitions, myPerformances, myGoals, clubId, onRefresh }) {
  const allDiscs = useMemo(() => {
    const fromRecords = Object.keys(athlete.records ?? {});
    const fromPerfs   = [...new Set((myPerformances ?? []).map(p => p.discipline))];
    return [...new Set([...fromRecords, ...fromPerfs])].sort();
  }, [athlete.records, myPerformances]);

  const [selectedDisc, setSelectedDisc] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal,setShowGoalModal]= useState(false);
  const [deleting,     setDeleting]     = useState(null);

  useEffect(() => {
    if (!selectedDisc && allDiscs.length > 0) setSelectedDisc(allDiscs[0]);
  }, [allDiscs, selectedDisc]);

  const rec = selectedDisc ? athlete.records[selectedDisc] : null;

  const discPerfs = useMemo(() => {
    if (!selectedDisc) return [];
    return (myPerformances ?? [])
      .filter(p => p.discipline === selectedDisc)
      .sort((a,b) => new Date(a.performance_date)-new Date(b.performance_date));
  }, [selectedDisc, myPerformances]);

  const compResults = useMemo(() => {
    if (!selectedDisc) return [];
    const results = [];
    competitions.forEach(c => {
      const r = c.results?.find(r => r.athleteId===athlete.id && r.event===selectedDisc);
      if (r) results.push({ date: c.date, label: c.name, value: r.result, source: "competition" });
    });
    return results;
  }, [selectedDisc, competitions, athlete.id]);

  const chartData = useMemo(() => {
    const allPoints = [
      ...discPerfs.map(p => ({ date: p.performance_date, label: new Date(p.performance_date).toLocaleDateString("fr-BE",{day:"2-digit",month:"short"}), result: p.value, source: p.source, note: p.context })),
      ...compResults.map(r => ({ date: r.date, label: new Date(r.date).toLocaleDateString("fr-BE",{day:"2-digit",month:"short"}), result: r.value, source: "competition", note: r.label })),
    ].sort((a,b) => new Date(a.date)-new Date(b.date));
    return allPoints.map(p => {
      const { value } = parsePerf(p.result);
      return { ...p, numValue: value };
    }).filter(p => p.numValue !== null);
  }, [discPerfs, compResults, selectedDisc]);

  const isTime = chartData.length > 0 && !getDiscHib(selectedDisc ?? "");
  const discColors = DISC_TYPE_COLORS[getDiscType(selectedDisc ?? "")] ?? DISC_TYPE_COLORS.sprint;

  const bestPerf = useMemo(() => {
    if (!chartData.length) return null;
    const hib = getDiscHib(selectedDisc ?? "");
    return chartData.reduce((best, p) => {
      if (!best) return p;
      return hib ? (p.numValue > best.numValue ? p : best) : (p.numValue < best.numValue ? p : best);
    }, null);
  }, [chartData, selectedDisc]);

  const handleDelete = async (id) => {
    setDeleting(id);
    await supabase.from("athlete_performances").delete().eq("id", id);
    onRefresh();
    setDeleting(null);
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-slate-800">Mes performances</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{allDiscs.length} épreuve{allDiscs.length!==1?"s":""} · {(myPerformances??[]).length} mesure{(myPerformances??[]).length!==1?"s":""} enregistrée{(myPerformances??[]).length!==1?"s":""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowGoalModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-emerald-700 text-[13px] font-semibold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all">
            <Target size={15}/> Objectif
          </button>
          <button onClick={()=>setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:shadow-md transition-all"
            style={{background:"#1D9E75"}}>
            <Plus size={15}/> Ajouter une performance
          </button>
        </div>
      </div>

      {(myGoals??[]).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-2"><Target size={14} color="#1D9E75"/> Mes objectifs saison</h3>
            <span className="text-[11px] text-slate-400">{(myGoals??[]).filter(g=>!g.achieved).length} actif{(myGoals??[]).filter(g=>!g.achieved).length>1?"s":""}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {(myGoals??[]).slice(0,4).map(g => {
              const today = new Date();
              const daysLeft = g.deadline ? Math.round((new Date(g.deadline)-today)/(1000*60*60*24)) : null;
              const discColors = DISC_TYPE_COLORS[getDiscType(g.discipline)] ?? DISC_TYPE_COLORS.sprint;
              const rec = athlete.records?.[g.discipline];
              const hib = getDiscHib(g.discipline);
              const pv = rec ? parsePerf(rec.pr) : null;
              const tv = parsePerf(g.target_value);
              const progress = pv?.value && tv?.value ? (hib ? Math.min(100,Math.round((pv.value/tv.value)*100)) : Math.min(100,Math.round((tv.value/pv.value)*100))) : null;
              return (
                <div key={g.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{background:discColors.dot}}/>
                      <span className="text-[12px] font-bold text-slate-700">{g.discipline}</span>
                      <span className="text-[10px] text-slate-400">→</span>
                      <span className="text-[14px] font-black" style={{color:discColors.border}}>{g.target_value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {daysLeft !== null && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {daysLeft > 0 ? `J-${daysLeft}` : "Échu"}
                        </span>
                      )}
                      <button onClick={async()=>{
                        await supabase.from("athlete_goals").update({achieved:true,achieved_at:new Date().toISOString().slice(0,10)}).eq("id",g.id);
                        await notifyGoalAchieved(clubId, athlete.id, g.discipline, g.target_value);
                        onRefresh();
                      }}
                        className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors">
                        ✅ Atteint !
                      </button>
                    </div>
                  </div>
                  {progress !== null && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>PR actuel : {rec?.pr}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{width:`${progress}%`,background:progress>=90?"#1D9E75":progress>=70?"#EF9F27":"#378ADD"}}/>
                      </div>
                    </div>
                  )}
                  {g.description && <p className="text-[11px] text-slate-400 mt-1.5 italic">{g.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-[13px] font-bold text-slate-700 mb-3">Mes épreuves</h3>
        {allDiscs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[13px] text-slate-400 mb-3">Aucune épreuve enregistrée</p>
            <button onClick={()=>setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[12px] font-semibold mx-auto" style={{background:"#1D9E75"}}>
              <Plus size={13}/> Ajouter ma première performance
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allDiscs.map(d => {
              const c = DISC_TYPE_COLORS[getDiscType(d)] ?? DISC_TYPE_COLORS.sprint;
              const isSelected = selectedDisc === d;
              return (
                <button key={d} onClick={()=>setSelectedDisc(d)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all"
                  style={isSelected ? {background:c.border,color:"white",borderColor:c.border} : {background:"white",color:c.text,borderColor:c.border+"60"}}>
                  <span className="w-2 h-2 rounded-full" style={{background:isSelected?"white":c.dot}}/>
                  {d}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedDisc && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {rec ? (
              <>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Season Best</p>
                  <p className="text-[28px] font-black text-slate-700">{rec.sb}</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{background:`linear-gradient(135deg,${discColors.bg},${discColors.bg})`}}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{color:discColors.text}}>Record personnel</p>
                  <p className="text-[28px] font-black" style={{color:discColors.border}}>{rec.pr}</p>
                  {rec.prDate&&<p className="text-[10px] mt-0.5" style={{color:discColors.text+"aa"}}>{new Date(rec.prDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short",year:"numeric"})}</p>}
                </div>
              </>
            ) : (
              <div className="col-span-2 bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-[12px] text-slate-400">Pas encore de record — ta première performance deviendra ton PR !</p>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mesures</p>
              <p className="text-[28px] font-black text-slate-700">{chartData.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">enregistrées</p>
            </div>
          </div>

          {rec && (() => {
            const sb=parsePerf(rec.sb), pr=parsePerf(rec.pr);
            if (!sb.value||!pr.value) return null;
            const hib = getDiscHib(selectedDisc);
            const pct = hib ? Math.round((sb.value/pr.value)*100) : Math.round((pr.value/sb.value)*100);
            const color = pct>=97?"#1D9E75":pct>=90?"#EF9F27":"#E24B4A";
            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-slate-700">Progression vers le PR</p>
                  <span className="text-[18px] font-black" style={{color}}>{pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:color}}/>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {pct>=100?"🏆 Tu as égalé ou battu ton PR !":pct>=97?"🔥 Tout proche du record !":pct>=90?"💪 Bonne progression":"📈 Continue, tu progresses !"}
                </p>
              </div>
            );
          })()}

          {chartData.length >= 2 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-[14px] font-bold text-slate-700">Évolution — {selectedDisc}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {chartData.filter(d=>d.source==="competition").length} compét. · {chartData.filter(d=>d.source!=="competition").length} entraînement{chartData.filter(d=>d.source!=="competition").length>1?"s":""}
                  </p>
                </div>
                {bestPerf && (
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Meilleure perf</p>
                    <p className="text-[18px] font-black" style={{color:discColors.border}}>{bestPerf.result}</p>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{top:10,right:10,bottom:10,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                  <YAxis domain={["dataMin","dataMax"]} tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} reversed={isTime}/>
                  <Tooltip content={({active,payload})=>{
                    if(!active||!payload?.length) return null;
                    const d=payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-[12px] min-w-[150px]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{background:d.source==="competition"?"#EF9F27":discColors.border}}/>
                          <p className="font-bold text-slate-700">{d.source==="competition"?"Compétition":d.source==="test"?"Test":"Entraînement"}</p>
                        </div>
                        {d.note&&<p className="text-slate-400 text-[10px] mb-1">{d.note}</p>}
                        <p className="text-[16px] font-black" style={{color:discColors.border}}>{d.result}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">{d.label}</p>
                      </div>
                    );
                  }}/>
                  <Line type="monotone" dataKey="numValue" stroke={discColors.border} strokeWidth={3}
                    dot={(props)=>{
                      const { cx, cy, payload } = props;
                      const isComp = payload.source === "competition";
                      return <circle key={cx} cx={cx} cy={cy} r={isComp?6:4}
                        fill={isComp?"#EF9F27":discColors.border} stroke="white" strokeWidth={2}/>;
                    }}
                    activeDot={{r:7,strokeWidth:0}}/>
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 text-[10px]">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:discColors.border}}/><span className="text-slate-500">Entraînement / Test</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"/><span className="text-slate-500">Compétition</span></div>
                {isTime&&<div className="flex items-center gap-1.5"><span className="text-slate-400">↓ = plus rapide (meilleur)</span></div>}
              </div>
            </div>
          ) : chartData.length === 1 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <p className="text-[13px] text-slate-400">Il faut au moins 2 performances pour voir le graphique</p>
              <button onClick={()=>setShowAddModal(true)} className="mt-3 text-[12px] font-semibold text-emerald-600 hover:text-emerald-700">
                + Ajouter une performance
              </button>
            </div>
          ) : null}

          {(discPerfs.length > 0 || compResults.length > 0) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-[13px] font-bold text-slate-700">Historique complet</h4>
                <button onClick={()=>setShowAddModal(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
                  <Plus size={12}/> Ajouter
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {[...chartData].reverse().map((p,i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{background:p.source==="competition"?"#FFF9C4":discColors.bg}}>
                      {p.source==="competition"?<Trophy size={14} color="#EF9F27"/>:
                       p.source==="test"?<Target size={14} color={discColors.border}/>:
                       <Activity size={14} color={discColors.border}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={["text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          p.source==="competition"?"bg-amber-100 text-amber-700":p.source==="test"?"bg-blue-50 text-blue-600":"bg-slate-100 text-slate-500"].join(" ")}>
                          {p.source==="competition"?"🏟️ Compét.":p.source==="test"?"📏 Test":"🏋️ Entraîn."}
                        </span>
                        {p.note&&<span className="text-[11px] text-slate-400 truncate">{p.note}</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(p.date).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                      </p>
                    </div>
                    <p className="text-[16px] font-black flex-shrink-0" style={{color:discColors.border}}>{p.result}</p>
                    {p.source !== "competition" && (() => {
                      const original = discPerfs.find(dp => dp.performance_date === p.date && dp.value === p.result);
                      if (!original) return null;
                      return (
                        <button onClick={()=>handleDelete(original.id)} disabled={deleting===original.id}
                          className="text-slate-200 hover:text-red-400 transition-colors ml-1 flex-shrink-0">
                          <X size={14}/>
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddPerfModal athlete={athlete} clubId={clubId} onClose={()=>setShowAddModal(false)} onAdded={onRefresh}/>
      )}
      {showGoalModal && (
        <AddGoalModal athlete={athlete} clubId={clubId} allDiscs={allDiscs} onClose={()=>setShowGoalModal(false)} onAdded={onRefresh}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VUE 4 — MESSAGERIE
// ══════════════════════════════════════════════════════════════════════════════
function MaMessagerie({ athlete, coachUserId, athleteUserId, coachName }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!coachUserId||!athleteUserId) return;
    const {data,error}=await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${athleteUserId},receiver_id.eq.${coachUserId}),and(sender_id.eq.${coachUserId},receiver_id.eq.${athleteUserId})`)
      .order("created_at",{ascending:true});
    if (!error) setMessages(data??[]);
    setLoading(false);
  }, [coachUserId, athleteUserId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!coachUserId||!athleteUserId) return;
    const ch=supabase.channel("athlete-msg")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p)=>{
        const m=p.new;
        const ok=(m.sender_id===athleteUserId&&m.receiver_id===coachUserId)||(m.sender_id===coachUserId&&m.receiver_id===athleteUserId);
        if(ok) setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  }, [coachUserId, athleteUserId]);

  const handleSend = async () => {
    const text=input.trim(); if(!text||!coachUserId||!athleteUserId) return;
    setInput(""); setSending(true);
    const {data,error}=await supabase.from("messages")
      .insert({sender_id:athleteUserId,receiver_id:coachUserId,content:text,is_read:false})
      .select().single();
    if(!error&&data) {
      setMessages(p=>[...p,data]);
      // Notif push vers le coach (par user_id)
      notifyCoachMessage(coachUserId, athlete.name, text).catch(console.warn);
    }
    setSending(false);
  };

  if (!coachUserId) return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
        <MessageSquare size={36} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5}/>
        <p className="text-[14px] font-semibold text-slate-400">Messagerie indisponible</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col max-w-2xl mx-auto" style={{height:"calc(100vh - 64px)"}}>
      <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
          {initialsFromName(coachName??"Coach")}
        </div>
        <div>
          <p className="text-[14px] font-bold text-slate-800">{coachName ?? "Coach"}</p>
          <p className="text-[11px] text-slate-400">Head coach</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{background:"#FAFAFA"}}>
        {loading ? <LoadingState message="Chargement…"/> : messages.length===0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
            <MessageSquare size={28} strokeWidth={1.5}/>
            <p className="text-[12.5px]">Aucun message — écris le premier !</p>
          </div>
        ) : messages.map(m=>{
          const isOwn=m.sender_id===athleteUserId;
          return (
            <div key={m.id} className={`flex ${isOwn?"justify-end":"justify-start"}`}>
              {!isOwn&&(
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold mr-2 flex-shrink-0 mt-1">
                  {initialsFromName(coachName??"C")}
                </div>
              )}
              <div className="max-w-[75%]">
                <div className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm"
                  style={isOwn?{background:"#1D9E75",color:"white",borderBottomRightRadius:"4px"}:{background:"white",color:"#334155",borderBottomLeftRadius:"4px",border:"1px solid #f1f5f9"}}>
                  {m.content}
                </div>
                <p className={`text-[10px] mt-0.5 ${isOwn?"text-right text-slate-400":"text-slate-400"}`}>
                  {new Date(m.created_at).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"})}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-end gap-2">
        <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5">
          <textarea className="w-full bg-transparent resize-none text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none max-h-28 min-h-[20px]"
            rows={1} placeholder={`Message à ${coachName?.split(" ")[0]??"ton coach"}…`}
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}/>
        </div>
        <button onClick={handleSend} disabled={!input.trim()||sending}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:scale-105 transition-all"
          style={{background:"#1D9E75"}}>
          <Send size={16} strokeWidth={2.5}/>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VUE 5 — MON CLUB
// ══════════════════════════════════════════════════════════════════════════════

const REACTION_EMOJIS = ["🔥","💪","👏","⚡","🎯","❤️"];

function SocialNotif({ notif, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
      <div className="bg-slate-800 text-white rounded-2xl px-4 py-3.5 shadow-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {initialsFromName(notif.athleteName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight">
            <span className="text-emerald-400">{notif.athleteName.split(" ")[0]}</span> {notif.action}
          </p>
          {notif.preview && <p className="text-[11px] text-white/60 truncate mt-0.5">{notif.preview}</p>}
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white flex-shrink-0"><X size={14}/></button>
      </div>
    </div>
  );
}

const CommentsModal = memo(({ post, postAthlete, athlete, allAthletes, onClose, onCommentAdded }) => {
  const [comments, setComments] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase.from("social_comments")
      .select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    setComments(data ?? []); setLoading(false);
  }, [post.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  useEffect(() => {
    const ch = supabase.channel(`comments-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_comments",
        filter: `post_id=eq.${post.id}` }, payload => {
        setComments(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new]);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id]);

  const handleSend = async () => {
    const text = input.trim(); if (!text) return;
    setInput(""); setSending(true);
    const { data } = await supabase.from("social_comments")
      .insert({ post_id: post.id, athlete_id: athlete.id, content: text }).select().single();
    if (data) { setComments(p => [...p, data]); onCommentAdded(); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(15,23,42,0.6)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mt-auto bg-white rounded-t-2xl flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">Commentaires</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Post de {postAthlete?.name?.split(" ")[0] ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500"/></button>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          {post.image_url && <img src={post.image_url} alt="" className="w-12 h-12 rounded-xl object-cover float-left mr-3 mb-1"/>}
          <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2">{post.content}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-6"><div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto"/></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-slate-300"><p className="text-[12px]">Aucun commentaire — sois le premier !</p></div>
          ) : comments.map(c => {
            const ca = allAthletes.find(a => a.id === c.athlete_id);
            const isOwn = c.athlete_id === athlete.id;
            const diff = (new Date() - new Date(c.created_at)) / 1000;
            const ago = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)}min` : `${Math.floor(diff/3600)}h`;
            return (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                  style={{ background: isOwn ? "#1D9E75" : "#378ADD" }}>
                  {initialsFromName(ca?.name ?? "?")}
                </div>
                <div className="flex-1">
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <p className="text-[11px] font-bold text-slate-700 mb-0.5">
                      {ca?.name?.split(" ")[0] ?? "?"}
                      {isOwn && <span className="ml-1 text-emerald-500">· Moi</span>}
                    </p>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed">{c.content}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 ml-2">{ago}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: "#1D9E75" }}>
            {initialsFromName(athlete.name)}
          </div>
          <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5">
            <input className="w-full bg-transparent text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none"
              placeholder="Ajouter un commentaire…" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); handleSend(); } }}/>
          </div>
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
            style={{ background: "#1D9E75" }}>
            <Send size={14} strokeWidth={2.5}/>
          </button>
        </div>
      </div>
    </div>
  );
});

const PhotoAlbumModal = memo(({ posts, allAthletes, onClose }) => {
  const photos = posts.filter(p => p.image_url);
  const [selected, setSelected] = useState(null);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div>
          <h3 className="text-[16px] font-bold text-white">Album du club</h3>
          <p className="text-[11px] text-white/50">{photos.length} photo{photos.length>1?"s":""}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white"><X size={18}/></button>
      </div>
      {selected ? (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={selected.image_url} alt="" className="max-w-full max-h-full rounded-2xl object-contain"/>
          </div>
          <div className="px-5 py-4 bg-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                {initialsFromName(allAthletes.find(a=>a.id===selected.athlete_id)?.name??"?")}
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">{allAthletes.find(a=>a.id===selected.athlete_id)?.name??"-"}</p>
                <p className="text-[11px] text-white/50">{new Date(selected.created_at).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            </div>
            <p className="text-[12px] text-white/70">{selected.content}</p>
          </div>
          <button onClick={()=>setSelected(null)} className="mx-5 mb-6 py-3 rounded-xl bg-white/10 text-white text-[13px] font-semibold">← Retour à l'album</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
              <Camera size={40} strokeWidth={1.5}/>
              <p className="text-[13px]">Aucune photo partagée</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {photos.map(p => (
                <div key={p.id} className="aspect-square relative cursor-pointer" onClick={()=>setSelected(p)}>
                  <img src={p.image_url} alt="" className="w-full h-full object-cover rounded-lg"/>
                  <div className="absolute bottom-1 left-1">
                    <div className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center text-[7px] font-bold text-slate-700">
                      {initialsFromName(allAthletes.find(a=>a.id===p.athlete_id)?.name??"?")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function MonClub({ athlete, allAthletes, clubId, sessions, profile }) {
  const [posts,           setPosts]           = useState([]);
  const [allPosts,        setAllPosts]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showCreate,      setShowCreate]      = useState(false);
  const [showAlbum,       setShowAlbum]       = useState(false);
  const [activeComments,  setActiveComments]  = useState(null);
  const [newContent,      setNewContent]      = useState("");
  const [newImage,        setNewImage]        = useState(null);
  const [newImageUrl,     setNewImageUrl]     = useState(null);
  const [selectedSession, setSelectedSession] = useState("");
  const [posting,         setPosting]         = useState(false);
  const [notif,           setNotif]           = useState(null);
  const [commentCounts,   setCommentCounts]   = useState({});

  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString();
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!clubId) return;
    const [feedRes, allRes] = await Promise.all([
      supabase.from("social_posts").select("*, social_reactions(*)")
        .eq("club_id", clubId).gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("social_posts").select("id, image_url, athlete_id, content, created_at")
        .eq("club_id", clubId).not("image_url", "is", null)
        .order("created_at", { ascending: false }),
    ]);
    if (!feedRes.error) setPosts(feedRes.data ?? []);
    if (!allRes.error)  setAllPosts(allRes.data ?? []);
    const ids = (feedRes.data ?? []).map(p => p.id);
    if (ids.length > 0) {
      const { data: coms } = await supabase.from("social_comments").select("post_id").in("post_id", ids);
      const counts = {};
      (coms ?? []).forEach(c => { counts[c.post_id] = (counts[c.post_id]??0)+1; });
      setCommentCounts(counts);
    }
    setLoading(false);
  }, [clubId, sevenDaysAgo]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!clubId) return;
    const ch = supabase.channel("social-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_posts" },
        async payload => {
          fetchPosts();
          if (payload.new.athlete_id !== athlete.id) {
            const { data: a } = await supabase.from("athletes").select("name").eq("id", payload.new.athlete_id).single();
            setNotif({ athleteName: a?.name ?? "Un athlète", action: "a partagé une séance 📸", preview: payload.new.content });
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_reactions" }, () => fetchPosts())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "social_reactions" }, () => fetchPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_comments" }, () => fetchPosts())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchPosts, athlete.id, clubId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNewImage(file); setNewImageUrl(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (newImage) {
        const ext = newImage.name.split(".").pop() || "jpg";
        const path = `social-photos/${athlete.id}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("social-photos").upload(path, newImage, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("social-photos").getPublicUrl(path);
          imageUrl = urlData?.publicUrl ?? null;
        }
      }
      await supabase.from("social_posts").insert({
        athlete_id: athlete.id, club_id: clubId,
        session_id: selectedSession ? Number(selectedSession) : null,
        content: newContent.trim(), image_url: imageUrl,
      });
      setNewContent(""); setNewImage(null); setNewImageUrl(null);
      setSelectedSession(""); setShowCreate(false);
    } finally { setPosting(false); }
  };

  const handleReact = async (postId, emoji) => {
    const post = posts.find(p => p.id === postId);
    const existing = post?.social_reactions?.find(r => r.athlete_id === athlete.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("social_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("social_reactions").delete().eq("post_id", postId).eq("athlete_id", athlete.id);
      await supabase.from("social_reactions").insert({ post_id: postId, athlete_id: athlete.id, emoji });
    }
    fetchPosts();
  };

  const handleDelete = async (postId) => {
    await supabase.from("social_comments").delete().eq("post_id", postId);
    await supabase.from("social_reactions").delete().eq("post_id", postId);
    await supabase.from("social_posts").delete().eq("id", postId);
    fetchPosts();
  };

  const recentSessions = sessions.slice(0, 10);

  return (
    <div className="max-w-xl mx-auto" style={{ minHeight: "100%" }}>
      {notif && <SocialNotif notif={notif} onDismiss={() => setNotif(null)}/>}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-slate-800">Mon club</h2>
          <p className="text-[10px] text-slate-400">{allAthletes.length} athlètes · 7 derniers jours</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAlbum(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50">
            <Image size={13}/> Album
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-[12px] font-semibold cursor-pointer"
            style={{ background: "#1D9E75" }}>
            <Camera size={13}/> Photo
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { handleImageChange(e); setShowCreate(true); }}/>
          </label>
          <button onClick={() => setShowCreate(v => !v)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
            <Plus size={16}/>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {showCreate && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: "#1D9E75" }}>
                {initialsFromName(athlete.name)}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-slate-700">{athlete.name}</p>
                <p className="text-[10px] text-slate-400">Partage avec ton club</p>
              </div>
              <button onClick={() => { setShowCreate(false); setNewContent(""); setNewImage(null); setNewImageUrl(null); }}
                className="text-slate-300 hover:text-slate-500"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-3">
              {newImageUrl && (
                <div className="relative">
                  <img src={newImageUrl} alt="preview" className="w-full max-h-64 object-cover rounded-xl"/>
                  <button onClick={() => { setNewImage(null); setNewImageUrl(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                    <X size={13}/>
                  </button>
                </div>
              )}
              <textarea
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                rows={3} autoFocus
                placeholder="Comment s'est passée ta séance ? 💪"
                value={newContent} onChange={e => setNewContent(e.target.value)}/>
              {recentSessions.length > 0 && (
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                  <option value="">📎 Lier une séance (optionnel)</option>
                  {recentSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${s.week}`}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                  <Image size={13}/> {newImage ? "Photo ✓" : "Galerie"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange}/>
                </label>
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                  <Camera size={13}/> Caméra
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange}/>
                </label>
                <button onClick={handlePost} disabled={!newContent.trim() || posting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-[12px] font-semibold disabled:opacity-40"
                  style={{ background: "#1D9E75" }}>
                  {posting ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Envoi…</> : <><Send size={12}/>Publier</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-300">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"/>
            <p className="text-[12px]">Chargement…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
            <Camera size={40} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5}/>
            <p className="text-[15px] font-bold text-slate-400">Fil vide</p>
            <p className="text-[12px] text-slate-300 mt-1">Sois le premier à partager !</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold mx-auto shadow-sm"
              style={{ background: "#1D9E75" }}>
              <Camera size={14}/> Partager maintenant
            </button>
          </div>
        ) : posts.map(post => {
          const postAthlete = allAthletes.find(a => a.id === post.athlete_id);
          const isOwn       = post.athlete_id === athlete.id;
          const linkedSess  = sessions.find(s => s.id === post.session_id);
          const myReaction  = post.social_reactions?.find(r => r.athlete_id === athlete.id);
          const comCount    = commentCounts[post.id] ?? 0;
          const rxCounts    = {};
          (post.social_reactions ?? []).forEach(r => { rxCounts[r.emoji] = (rxCounts[r.emoji]??0)+1; });
          const diff = (new Date() - new Date(post.created_at)) / 1000;
          const timeAgo = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)} min` :
            diff < 86400 ? `${Math.floor(diff/3600)}h` : `${Math.floor(diff/86400)}j`;
          const expiresIn = Math.ceil((7*86400 - diff) / 3600);

          return (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ background: isOwn ? "#1D9E75" : "#378ADD" }}>
                    {initialsFromName(postAthlete?.name ?? "?")}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                      {postAthlete?.name ?? "Athlète"}
                      {isOwn && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Moi</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {timeAgo}
                      {expiresIn <= 24 && expiresIn > 0 && <span className="ml-1.5 text-amber-500 font-semibold">· expire dans {expiresIn}h</span>}
                    </p>
                  </div>
                </div>
                {isOwn && (
                  <button onClick={() => handleDelete(post.id)} className="text-slate-200 hover:text-red-400 transition-colors p-1.5">
                    <X size={14}/>
                  </button>
                )}
              </div>
              {post.image_url && (
                <img src={post.image_url} alt="post" className="w-full max-h-96 object-cover cursor-pointer"
                  onClick={() => setActiveComments(post)}/>
              )}
              <div className="px-4 py-3">
                <p className="text-[13.5px] text-slate-700 leading-relaxed">{post.content}</p>
                {linkedSess && (
                  <div className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorsFor(linkedSess.category).border }}/>
                    <p className="text-[11px] font-semibold text-slate-600">{linkedSess.title}</p>
                    <span className="text-slate-300 text-[10px]">·</span>
                    <p className="text-[11px] text-slate-400">
                      {linkedSess.sessionDate ? new Date(linkedSess.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${linkedSess.week}`}
                    </p>
                  </div>
                )}
              </div>
              <div className="px-4 pb-4">
                {Object.keys(rxCounts).length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {Object.entries(rxCounts).sort((a,b)=>b[1]-a[1]).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                        className={["flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all",
                          myReaction?.emoji===emoji ? "bg-emerald-50 border-emerald-300 text-emerald-700 scale-105" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        ].join(" ")}>
                        <span>{emoji}</span><span className="text-[11px]">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                      className={["w-9 h-9 rounded-xl flex items-center justify-center text-[15px] transition-all border",
                        myReaction?.emoji===emoji ? "bg-emerald-50 border-emerald-300 scale-110" : "bg-slate-50 border-slate-100 hover:scale-110 hover:bg-slate-100"
                      ].join(" ")}>
                      {emoji}
                    </button>
                  ))}
                  <div className="flex-1"/>
                  <button onClick={() => setActiveComments(post)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100 transition-colors">
                    <MessageSquare size={13}/>
                    <span className="text-[11px] font-semibold">{comCount > 0 ? comCount : ""} Commenter</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {posts.length > 0 && (
          <p className="text-center text-[11px] text-slate-300 py-2">
            Posts visibles 7 jours · Photos conservées dans l'album
          </p>
        )}
      </div>

      {activeComments && (
        <CommentsModal
          post={activeComments}
          postAthlete={allAthletes.find(a => a.id === activeComments.athlete_id)}
          athlete={athlete} allAthletes={allAthletes}
          onClose={() => setActiveComments(null)}
          onCommentAdded={() => fetchPosts()}
        />
      )}
      {showAlbum && (
        <PhotoAlbumModal posts={allPosts} allAthletes={allAthletes} onClose={() => setShowAlbum(false)}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — AthleteApp
// ══════════════════════════════════════════════════════════════════════════════
export default function AthleteApp() {
  const { profile, clubId, signOut } = useAuth();

  const [activeView,   setActiveView]   = useState("dashboard");
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [athlete,      setAthlete]      = useState(null);
  const [allAthletes,  setAllAthletes]  = useState([]);
  const [weeklyCharge, setWeeklyCharge] = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [coachUserId,     setCoachUserId]     = useState(null);
  const [coachName,       setCoachName]       = useState(null);
  const [lastMessages,    setLastMessages]    = useState([]);
  const [myPerformances,  setMyPerformances]  = useState([]);
  const [myGoals,         setMyGoals]         = useState([]);
  const [myNotifs,        setMyNotifs]        = useState([]);
  const [showNotifs,      setShowNotifs]      = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  // ── Wellness ─────────────────────────────────────────────────────────────
  const [wellnessToday,   setWellnessToday]   = useState(null);
  const [showWellness,    setShowWellness]     = useState(false);

  // ── Push notifications ────────────────────────────────────────────────────
  // IMPORTANT : appelé AVANT les guards (règle React : hooks toujours en tête).
  // athlete?.id sera null au premier render puis mis à jour après fetchAll.
  // Le hook tolère null et ne crée pas d'abonnement tant que l'id est absent.
  const { subscribed, subscribe, permissionState, swReady } = usePushNotifications(
    athlete?.id ?? null,
    clubId
  );

  // Demande automatique de permission push dès que le SW est prêt
  // (comme sur CoachShell côté Benoît)
  useEffect(() => {
    if (swReady && !subscribed && permissionState !== "denied") {
      subscribe();
    }
  }, [swReady, subscribed, permissionState, subscribe]);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId || !profile?.id) return;
    try {
      setLoading(true); setError(null);

      const athleteRes = await supabase.from("athletes").select("*").eq("user_id", profile.id).single();
      if (athleteRes.error || !athleteRes.data) {
        setError("Aucun profil athlète lié à ton compte. Contacte ton coach.");
        setLoading(false);
        return;
      }

      const a = athleteRes.data;
      const athleteId = a.id;
      const todayStr = new Date().toISOString().split("T")[0];

      const [recordsRes,injuriesRes,perfHistRes,sessionsRes,compsRes,coachRes,allAthletesRes,myPerfsRes,goalsRes,notifsRes,wellnessRes] = await Promise.all([
        supabase.from("records").select("*").eq("athlete_id",athleteId),
        supabase.from("injuries").select("*").eq("athlete_id",athleteId),
        supabase.from("performance_history").select("*").eq("athlete_id",athleteId),
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id",clubId),
        supabase.from("competitions").select("*, competition_athletes(*), competition_results(*)").eq("club_id",clubId),
        supabase.from("users").select("id, name").eq("club_id",clubId).eq("role","head_coach").single(),
        supabase.from("athletes").select("id, name, profile_data").eq("club_id",clubId),
        supabase.from("athlete_performances").select("*").eq("athlete_id",athleteId).order("performance_date",{ascending:true}),
        supabase.from("athlete_goals").select("*").eq("athlete_id",athleteId).order("created_at",{ascending:false}),
        supabase.from("athlete_notifications").select("*").eq("athlete_id",athleteId).order("created_at",{ascending:false}).limit(20),
        supabase.from("athlete_wellness").select("*").eq("athlete_id",athleteId).eq("date",todayStr).maybeSingle(),
      ]);

      setMyPerformances(myPerfsRes.data ?? []);
      setMyGoals(goalsRes.data ?? []);
      setMyNotifs(notifsRes?.data ?? []);

      // Wellness du jour
      setWellnessToday(wellnessRes.data ?? null);

      const coachId = coachRes.data?.id ?? null;
      setCoachUserId(coachId);
      setCoachName(coachRes.data?.name ?? null);

      if (coachId) {
        const {data:msgs}=await supabase.from("messages").select("*")
          .or(`and(sender_id.eq.${coachId},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${coachId})`)
          .order("created_at",{ascending:false}).limit(3);
        setLastMessages((msgs??[]).filter(m=>m.sender_id===coachId));
      }

      setAllAthletes((allAthletesRes.data??[]).map(a=>({id:a.id,name:a.name,avatar:a.profile_data?.avatar??initialsFromName(a.name)})));

      const pd = a.profile_data??{};
      const recs = {};
      (recordsRes.data??[]).forEach(r=>{ recs[r.discipline]={sb:r.sb,pr:r.pr,prDate:r.pr_date}; });

      setAthlete({
        id:a.id, name:a.name, age:a.age,
        avatar:pd.avatar??initialsFromName(a.name),
        mainDiscipline:a.main_discipline,
        secondaryDisciplines:pd.secondary_disciplines??[],
        group:a.group_name, level:pd.level??null,
        records:recs,
        injuries:(injuriesRes.data??[]).map(i=>({id:i.id,name:i.name,location:i.location,intensity:i.intensity,status:i.status,startDate:i.start_date,endDate:i.end_date,notes:i.notes})),
        performanceHistory:(perfHistRes.data??[]).sort((x,y)=>x.month.localeCompare(y.month)),
        profile:pd.profile??{},
      });

      const allSessions=(sessionsRes.data??[]).map(s=>{
        const rows=s.session_athletes??[];
        return {
          id:s.id,week:s.week,day:s.day,sessionDate:s.session_date,time:s.time,
          type:s.type,category:s.category,title:s.title,description:s.description,
          instructions:s.instructions,durationMinutes:s.duration_minutes,pdfUrl:s.pdf_url,
          createdBy:s.created_by,
          athleteIds:rows.map(v=>v.athlete_id),
          validations:rows.map(v=>({athleteId:v.athlete_id,status:v.status,feeling:v.feeling,fatigue:v.fatigue,comment:v.comment,rpe:v.rpe})),
        };
      }).filter(s=>s.athleteIds.includes(athleteId));

      const allComps=(compsRes.data??[]).map(c=>({
        id:c.id,name:c.name,date:c.date,location:c.location,type:c.type,
        athleteIds:(c.competition_athletes??[]).map(x=>x.athlete_id),
        plannedEvents:Object.fromEntries((c.competition_athletes??[]).map(x=>[x.athlete_id,x.planned_event])),
        results:(c.competition_results??[]).map(r=>({athleteId:r.athlete_id,event:r.event,result:r.result,context:r.context})),
      })).filter(c=>c.athleteIds.includes(athleteId));

      const saRes=await supabase.from("session_athletes").select("session_id,rpe").eq("athlete_id",athleteId);
      const byWeek={};
      allSessions.forEach(s=>{
        const sa=(saRes.data??[]).find(r=>r.session_id===s.id);
        if(!sa?.rpe) return;
        byWeek[s.week]=(byWeek[s.week]??0)+(s.durationMinutes??60)*sa.rpe;
      });
      const charge=Object.entries(byWeek).map(([week,rawLoad])=>({athleteId,week:Number(week),rawLoad}));

      setWeeklyCharge(charge);
      setSessions(allSessions);
      setCompetitions(allComps);
    } catch(err) {
      console.error("AthleteApp:",err);
      setError(err.message??"Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId, profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Ouvre la modale wellness si pas encore répondu aujourd'hui
  useEffect(() => {
    if (athlete && !wellnessToday && !loading) setShowWellness(true);
  }, [athlete, wellnessToday, loading]);

  // ═══ Realtime ═════════════════════════════════════════════════════════════
  // Section intentionnellement vide.
  // Les handlers RPE/status/feeling/comment font uniquement une mise à jour
  // locale + write Supabase sans fetchAll(), ce qui évite tout rechargement.
  // Si un realtime est ajouté à l'avenir, filtrer sur athlete_id et
  // utiliser setSessions (patch local) plutôt que fetchAll().

  // ═══ Handlers ═════════════════════════════════════════════════════════════
  const handleRpe = useCallback(async (sid,aid,rpe) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,rpe}:v)}));
    await supabase.from("session_athletes").update({rpe}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);

  const handleStatus = useCallback(async (sid,aid,status) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,status}:v)}));
    await supabase.from("session_athletes").update({status}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);

  const handleFeeling = useCallback(async (sid,aid,feeling) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,feeling}:v)}));
    await supabase.from("session_athletes").update({feeling}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);

  const handleComment = useCallback(async (sid,aid,comment) => {
    setSessions(p=>p.map(s=>s.id!==sid?s:{...s,validations:s.validations.map(v=>v.athleteId===aid?{...v,comment}:v)}));
    await supabase.from("session_athletes").update({comment}).eq("session_id",sid).eq("athlete_id",aid);
  }, []);

  const navigate = useCallback((view) => { setActiveView(view); setMobileOpen(false); }, []);

  // ── Guards (APRÈS tous les hooks) ─────────────────────────────────────────
  if (loading) return <LoadingState message="Chargement de ton espace…"/>;
  if (error || !athlete) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:"#F5F5F2"}}>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-sm text-center">
        <p className="text-[14px] font-semibold text-slate-700 mb-2">Profil introuvable</p>
        <p className="text-[12px] text-slate-400 mb-4">{error}</p>
        <button onClick={signOut} className="text-[12px] text-red-500 hover:text-red-700">Se déconnecter</button>
      </div>
    </div>
  );

  const currentNav = NAV_ITEMS.find(n=>n.id===activeView);

  return (
    <div className="flex h-screen overflow-hidden" style={{background:"#F5F5F2",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      {mobileOpen&&<div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={()=>setMobileOpen(false)}/>}

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col bg-white border-r border-slate-100 z-30 w-56 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{background:"linear-gradient(135deg,#1D9E75 0%,#16826C 100%)"}}>
            <Zap size={16} color="white" strokeWidth={2.5}/>
          </div>
          <span className="font-bold text-slate-800 text-[15px] tracking-tight">AthleteOS</span>
        </div>
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(item=>{
            const Icon=item.icon; const isActive=activeView===item.id;
            return (
              <button key={item.id} onClick={()=>navigate(item.id)}
                className={["w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium transition-all relative hover:bg-slate-50",
                  isActive?"text-emerald-700 bg-emerald-50":"text-slate-500 hover:text-slate-700"].join(" ")}>
                {isActive&&<span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-500"/>}
                <Icon size={18} strokeWidth={isActive?2:1.5} className="flex-shrink-0"/>
                <span className="flex-1 text-left truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 flex-shrink-0 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{background:"#1D9E75"}}>
            {initialsFromName(athlete.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-slate-700 truncate">{athlete.name}</p>
            <p className="text-[11px] text-slate-400">Athlète</p>
          </div>
          <button onClick={()=>setShowNotifs(v=>!v)}
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <Bell size={15}/>
            {myNotifs.filter(n=>!n.is_read).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {myNotifs.filter(n=>!n.is_read).length}
              </span>
            )}
          </button>
          <button onClick={signOut} title="Se déconnecter"
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
            <LogOut size={15}/>
          </button>
        </div>
      </aside>

      {/* Panneau notifications */}
      {showNotifs && (
        <div className="fixed inset-0 z-40 flex" onClick={()=>setShowNotifs(false)}>
          <div className="ml-56 flex-1" />
          <div className="absolute left-0 bottom-20 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50"
            onClick={e=>e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-800">Notifications</p>
              {myNotifs.filter(n=>!n.is_read).length > 0 && (
                <button onClick={async()=>{
                  await supabase.from("athlete_notifications").update({is_read:true}).eq("athlete_id",athlete.id).eq("is_read",false);
                  fetchAll();
                }} className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700">
                  Tout lire
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {myNotifs.length === 0 ? (
                <div className="px-4 py-6 text-center space-y-3">
                  <p className="text-[11px] text-slate-300">Aucune notification</p>
                  {/* Bouton push dans le panneau notifs desktop */}
                  <PushToggleButton
                    subscribed={subscribed}
                    onToggle={subscribe}
                    permissionState={permissionState}
                  />
                </div>
              ) : myNotifs.map(n => {
                const diff = (new Date()-new Date(n.created_at))/1000;
                const ago = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:diff<86400?`${Math.floor(diff/3600)}h`:`${Math.floor(diff/86400)}j`;
                return (
                  <div key={n.id} className={["px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors",!n.is_read?"bg-blue-50/30":""].join(" ")}
                    onClick={async()=>{
                      if(!n.is_read) await supabase.from("athlete_notifications").update({is_read:true}).eq("id",n.id);
                      fetchAll();
                    }}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"/>}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-semibold text-slate-700 leading-tight">{n.title}</p>
                        {n.description && <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{n.description}</p>}
                        <p className="text-[10px] text-slate-300 mt-1">{ago}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:h-16 bg-white border-b border-slate-100 flex items-center gap-3 px-4 flex-shrink-0">
          <div className="flex md:hidden items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}>
              <Zap size={13} color="white" strokeWidth={2.5}/>
            </div>
            <span className="font-bold text-slate-800 text-[14px]">AthleteOS</span>
          </div>
          <h1 className="hidden md:block text-[16px] font-semibold text-slate-800 tracking-tight">{currentNav?.label??"Mon espace"}</h1>
          <div className="flex-1"/>
          {/* Bouton push dans le header — visible desktop */}
          <div className="hidden md:block">
            <PushToggleButton
              subscribed={subscribed}
              onToggle={subscribe}
              permissionState={permissionState}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {activeView==="dashboard"&&(
            <Dashboard athlete={athlete} weeklyCharge={weeklyCharge} sessions={sessions}
              competitions={competitions} lastMessages={lastMessages} coachName={coachName}
              myPerformances={myPerformances} onNavigate={navigate}
              wellnessToday={wellnessToday} onOpenWellness={() => setShowWellness(true)}/>
          )}
          {activeView==="planning"&&(
           <MonPlanning
              athlete={athlete} sessions={sessions} allAthletes={allAthletes}
              clubId={clubId} createdBy={profile?.id}
              coachUserId={coachUserId}
              onRpeChange={handleRpe} onStatusChange={handleStatus}
              onFeelingChange={handleFeeling} onCommentChange={handleComment}
              onRefresh={fetchAll}
            />
          )}
          {activeView==="performances"&&(
            <MesPerformances
              athlete={athlete} competitions={competitions}
              myPerformances={myPerformances} myGoals={myGoals}
              clubId={clubId} onRefresh={fetchAll}
            />
          )}
          {activeView==="messagerie"&&(
            <MaMessagerie
              athlete={athlete} coachUserId={coachUserId}
              athleteUserId={profile?.id} coachName={coachName}
            />
          )}
          {activeView==="social"&&(
            <MonClub
              athlete={athlete} allAthletes={allAthletes}
              clubId={clubId} sessions={sessions} profile={profile}
            />
          )}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={["flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-all",
                  isActive ? "text-emerald-600" : "text-slate-400"].join(" ")}>
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5}/>
                  {item.id === "messagerie" && myNotifs.filter(n=>!n.is_read&&n.type==="message").length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {myNotifs.filter(n=>!n.is_read&&n.type==="message").length}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold truncate max-w-[50px] text-center">{item.label}</span>
              </button>
            );
          })}
          {/* Bouton push + notifs dans la bottom nav mobile */}
          <button onClick={() => setShowNotifs(v=>!v)}
            className={["flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-all",
              showNotifs ? "text-emerald-600" : "text-slate-400"].join(" ")}>
            <div className="relative">
              <Bell size={20} strokeWidth={showNotifs ? 2.2 : 1.5}/>
              {myNotifs.filter(n=>!n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {myNotifs.filter(n=>!n.is_read).length}
                </span>
              )}
            </div>
            {/* Indicateur push intégré sous l'icône notifs */}
            <span className="text-[9px] font-semibold text-center" style={{ color: subscribed ? "#1D9E75" : "inherit" }}>
              {subscribed ? "🔔 ON" : "Notifs"}
            </span>
          </button>
        </div>

        {/* Panneau notifs mobile (slide du bas) */}
        {showNotifs && (
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)}>
            <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl max-h-[60vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <p className="text-[14px] font-bold text-slate-800">Notifications</p>
                <div className="flex items-center gap-3">
                  {/* Bouton push dans le panneau notifs mobile */}
                  <PushToggleButton
                    subscribed={subscribed}
                    onToggle={subscribe}
                    permissionState={permissionState}
                  />
                  {myNotifs.filter(n=>!n.is_read).length > 0 && (
                    <button onClick={async()=>{
                      await supabase.from("athlete_notifications").update({is_read:true}).eq("athlete_id",athlete.id).eq("is_read",false);
                      fetchAll();
                    }} className="text-[11px] font-semibold text-emerald-600">
                      Tout lire
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {myNotifs.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[12px] text-slate-300">Aucune notification</div>
                ) : myNotifs.map(n => {
                  const diff = (new Date()-new Date(n.created_at))/1000;
                  const ago = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:diff<86400?`${Math.floor(diff/3600)}h`:`${Math.floor(diff/86400)}j`;
                  return (
                    <div key={n.id} className={["px-5 py-3.5 cursor-pointer hover:bg-slate-50",!n.is_read?"bg-blue-50/30":""].join(" ")}
                      onClick={async()=>{
                        if(!n.is_read) await supabase.from("athlete_notifications").update({is_read:true}).eq("id",n.id);
                        fetchAll(); setShowNotifs(false);
                      }}>
                      <div className="flex items-start gap-2.5">
                        {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"/>}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-slate-700 leading-tight">{n.title}</p>
                          {n.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.description}</p>}
                          <p className="text-[10px] text-slate-300 mt-1">{ago}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Wellness Modal */}
      {showWellness && athlete && (
        <WellnessModal
          athlete={athlete} clubId={clubId}
          onClose={() => setShowWellness(false)}
          onSaved={(data) => setWellnessToday(data)}
        />
      )}
    </div>
  );
}