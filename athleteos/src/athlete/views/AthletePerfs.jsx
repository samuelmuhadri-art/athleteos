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
import { createPortal } from "react-dom";
import {
  Plus, Trophy, Target, BarChart2, CheckCircle, X,
  TrendingUp, TrendingDown, Minus, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine,
} from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { getDiscHib, parsePerf, toLocalDateStr, getISOWeek } from "../shared";
import { notifyGoalAchieved, postClubCelebration } from "../../utils/notifications";
import { getAthleteMetricsForWeek } from "../../utils/chargeCalculations";

// ─── Couleurs par discipline (accents vifs, faits pour fond sombre) ──────────
const DISC_COLORS = {
  "100m":       "#5B9EF5", "200m":       "#A78BFA", "400m":       "#F0CB61",
  "800m":       "#EF6B6B", "1500m":      "#EC4899", "3000m":      "#38BDF8",
  "110m haies": "#EF6B6B", "100m haies": "#EC4899", "400m haies": "#FB923C",
  "Longueur":   "#34D399", "Triple saut":"#14B8A6", "Hauteur":    "#FB923C",
  "Perche":     "#6366F1", "Poids":      "#A3E635", "Disque":     "#C084FC",
  "Javelot":    "#FB923C", "Marteau":    "#34D399",
};
const discColor = (disc) => DISC_COLORS[disc] ?? "#1D9E75";

// ─── Confettis — célébration d'un nouveau record personnel ───────────────────
const CONFETTI_COLORS = ["#1D9E75", "#EAB308", "#5B8DEF", "#EC4899", "#38BDF8", "#FB923C"];

function ConfettiBurst({ onDone }) {
  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.3,
    duration: 1.3 + Math.random() * 0.7,
    width: 5 + Math.random() * 5,
    rotate: Math.round(Math.random() * 360),
    drift: Math.round((Math.random() - 0.5) * 100),
  })), []);

  useEffect(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <span key={p.id} style={{
          position: "absolute", top: -12, left: `${p.left}%`,
          width: p.width, height: p.width * 0.4, background: p.color, borderRadius: 2,
          animation: `confetti-fall ${p.duration}s cubic-bezier(0.4,0,0.6,1) ${p.delay}s both`,
          "--confetti-drift": `${p.drift}px`,
          "--confetti-rotate": `${p.rotate}deg`,
        }} />
      ))}
    </div>
  );
}

// ─── Tooltip graphique (dark) ─────────────────────────────────────────────────
function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 14, padding: "10px 14px", minWidth: 110, boxShadow: "var(--shadow-md)" }}>
      <p style={{ fontSize: 10.5, fontWeight: 500, color: "var(--c-text-3)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{d.raw}</p>
      {d.ctx && <p style={{ fontSize: 10.5, color: "var(--c-text-3)", fontStyle: "italic", marginTop: 4 }}>{d.ctx}</p>}
    </div>
  );
}

// ─── Ring de progression générique ────────────────────────────────────────────
function ProgressRing({ pct, color, size = 64, label, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={stroke} />
        {pct !== null && (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${(clamped/100)*circ} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.16,1,0.3,1)" }} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <span style={{ fontSize: size > 56 ? 13 : 11, fontWeight: 700, color }}>{pct !== null ? `${pct}%` : "—"}</span>
        {label && <span style={{ fontSize: 7.5, color: "var(--c-text-4)", marginTop: 1 }}>{label}</span>}
      </div>
    </div>
  );
}

// ─── Card discipline / record — remplace les 2 blocs plats ───────────────────
function RecordCard({ disc, rec, onSeeEvolution, stats }) {
  const col = discColor(disc);
  const sbN = parseFloat(rec.sb), prN = parseFloat(rec.pr);
  const pct = !isNaN(sbN) && !isNaN(prN) && prN > 0 ? Math.min(100, Math.round((sbN / prN) * 100)) : null;

  return (
    <div className="card p-4" style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <ProgressRing pct={pct} color={col} label="du PR" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)" }} className="truncate">{disc}</p>
          </div>
          <button onClick={onSeeEvolution}
            style={{ fontSize: 10.5, fontWeight: 600, color: col, background: "none", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
            Évolution <ChevronRight size={11} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: col, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {rec.pr ?? "—"}
            </p>
            <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-text-3)", marginTop: 4 }}>
              Record perso
            </p>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--c-text-2)", lineHeight: 1 }}>
              {rec.sb ?? "—"}
            </p>
            <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-text-4)", marginTop: 4 }}>
              Season best
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {rec.prDate && (
            <span style={{ fontSize: 9.5, color: "var(--c-text-4)" }}>
              {new Date(rec.prDate).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {stats?.count > 0 && (
            <>
              <span style={{ color: "var(--c-text-4)", fontSize: 9 }}>·</span>
              <span style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>{stats.count} mesure{stats.count > 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Barre de progression PR → objectif ──────────────────────────────────────
function GoalProgressBar({ pr, target, color }) {
  if (!pr || !target) return null;
  const prN = parseFloat(pr), tgN = parseFloat(target);
  if (isNaN(prN) || isNaN(tgN) || tgN <= 0) return null;
  const pct = Math.min(100, Math.max(0, Math.round((prN / tgN) * 100)));
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 500, color: "var(--c-text-3)", marginBottom: 6 }}>
        <span>PR {pr}</span>
        <span style={{ color }}>{pct}%</span>
        <span>Objectif {target}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SAISIR UNE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
function AddPerfModal({ disciplines, perfForm, setPerfForm, onClose, onSubmit, saving }) {
  // Portal sur document.body — AthletePerfs.jsx est rendu à l'intérieur du
  // <main> scrollable d'AthleteApp.jsx ; sans portal ce position:fixed dérive
  // avec le scroll au lieu de rester épinglé à l'écran sur mobile (même bug
  // déjà corrigé sur AthleteClub.jsx et AthletePlanning.jsx).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(29,158,117,0.08)", borderBottom: "1px solid rgba(29,158,117,0.18)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(29,158,117,0.14)", border: "1px solid rgba(29,158,117,0.25)" }}>
              <TrendingUp size={10} color="#1D9E75" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#4DC9A0" }}>Saisir une performance</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Chrono, distance, hauteur…</p>
          </div>
          <button onClick={onClose} disabled={saving}
            style={{ padding: 8, borderRadius: 10, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Épreuve *</label>
            <input className="input-premium" placeholder="Ex: 100m, Longueur…"
              value={perfForm.discipline}
              onChange={e => setPerfForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = perfForm.discipline === d;
                  const col = discColor(d);
                  return (
                    <button key={d} onClick={() => setPerfForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ padding: "5px 11px", borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1.5px solid ${sel ? col : "var(--c-border-strong)"}`, background: sel ? col : "var(--c-surface-2)", color: sel ? "#0A150F" : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Résultat *</label>
            <input className="input-premium" placeholder="Ex: 10.94 ou 7.45m"
              value={perfForm.value}
              onChange={e => setPerfForm(f => ({ ...f, value: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Date</label>
            <input type="date" className="input-premium"
              value={perfForm.performance_date}
              onChange={e => setPerfForm(f => ({ ...f, performance_date: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Contexte (optionnel)</label>
            <input className="input-premium" placeholder="Ex: Vent +1.2m/s, finale régionale…"
              value={perfForm.context}
              onChange={e => setPerfForm(f => ({ ...f, context: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!perfForm.discipline.trim() || !perfForm.value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AJOUTER UN OBJECTIF
// ═══════════════════════════════════════════════════════════════════════════════
function AddGoalModal({ disciplines, goalForm, setGoalForm, onClose, onSubmit, saving }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, marginBottom: 6, background: "rgba(234,179,8,0.14)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <Target size={10} color="#EAB308" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#F0CB61" }}>Nouvel objectif</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Fixe-toi un cap à atteindre</p>
          </div>
          <button onClick={onClose} disabled={saving}
            style={{ padding: 8, borderRadius: 10, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Épreuve *</label>
            <input className="input-premium" placeholder="Ex: 100m, Longueur…"
              value={goalForm.discipline}
              onChange={e => setGoalForm(f => ({ ...f, discipline: e.target.value }))} />
            {disciplines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {disciplines.map(d => {
                  const sel = goalForm.discipline === d;
                  return (
                    <button key={d} onClick={() => setGoalForm(f => ({ ...f, discipline: d }))}
                      className="tap-feedback"
                      style={{ padding: "5px 11px", borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1.5px solid ${sel ? "#EAB308" : "var(--c-border-strong)"}`, background: sel ? "#EAB308" : "var(--c-surface-2)", color: sel ? "#0A150F" : "var(--c-text-2)", cursor: "pointer" }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Objectif à atteindre *</label>
            <input className="input-premium" placeholder="Ex: 10.80 ou 7.60m"
              value={goalForm.target_value}
              onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Échéance (optionnel)</label>
            <input type="date" className="input-premium"
              value={goalForm.deadline}
              onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Notes</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Motivation, contexte…"
              value={goalForm.notes}
              onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={onSubmit}
            disabled={!goalForm.discipline.trim() || !goalForm.target_value.trim() || saving}
            className="btn-primary">
            {saving ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Créer l'objectif</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePerfs({ athlete, competitions, myPerformances, myGoals, clubId, weeklyCharge, onRefresh }) {
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
    location: "", type: "Régionale", event: "", result: "", context: "",
  });

  const [perfForm, setPerfForm] = useState({
    discipline: "", value: "", performance_date: toLocalDateStr(today), context: "",
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
        date:  p.performance_date.slice(0, 10),
        label: new Date(p.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" }),
        value: parseFloat(p.value) || 0,
        raw:   p.value,
        ctx:   p.context,
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

  // ── Handlers — logique 100% inchangée ────────────────────────────────────
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

      const disc    = perfForm.discipline;
      const hib     = getDiscHib(disc);
      const newVal  = parsePerf(perfForm.value);
      const curRec  = athlete.records?.[disc];
      const curPR   = curRec ? parsePerf(curRec.pr) : null;
      const curSB   = curRec ? parsePerf(curRec.sb) : null;
      const thisYear = new Date().getFullYear().toString();
      const isThisYear = perfForm.performance_date.slice(0, 4) === thisYear;

      if (newVal.value) {
        const isPR = !curPR?.value || (hib ? newVal.value >= curPR.value : newVal.value <= curPR.value);
        const isSB = isThisYear && (!curSB?.value || (hib ? newVal.value >= curSB.value : newVal.value <= curSB.value));
        if (isPR || isSB) {
          // Pas de contrainte UNIQUE(athlete_id,discipline) en base — un
          // .upsert(onConflict:...) échoue silencieusement en 400 ici
          // (record jamais sauvé). On vérifie l'existence nous-mêmes et on
          // update/insert explicitement, comme le fait déjà Competitions.jsx.
          const { data: existingRow } = await supabase.from("records").select("id")
            .eq("athlete_id", athlete.id).eq("discipline", disc).maybeSingle();
          const patch = {
            ...(isPR ? { pr: perfForm.value, pr_date: perfForm.performance_date } : {}),
            ...(isSB ? { sb: perfForm.value } : {}),
            ...(!curPR?.value ? { pr: perfForm.value, pr_date: perfForm.performance_date, sb: perfForm.value } : {}),
          };
          if (existingRow) {
            await supabase.from("records").update(patch).eq("id", existingRow.id);
          } else {
            await supabase.from("records").insert({ athlete_id: athlete.id, discipline: disc, ...patch });
          }
          if (athlete.records) {
            athlete.records[disc] = {
              ...curRec,
              ...(isPR ? { pr: perfForm.value, prDate: perfForm.performance_date } : {}),
              ...(isSB ? { sb: perfForm.value } : {}),
            };
          }
          if (isPR) {
            postClubCelebration(clubId, athlete.id, "record",
              `${athlete.name.split(" ")[0]} a battu son record en ${disc} : ${perfForm.value} !`).catch(console.warn);
            setShowConfetti(true);
          }
        }
      }

      setPerfForm({ discipline: perfForm.discipline, value: "", performance_date: toLocalDateStr(today), context: "" });
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
        planned_event:  compForm.event,
      });

      await supabase.from("competition_results").insert({
        competition_id: comp.id,
        athlete_id:     athlete.id,
        event:          compForm.event,
        result:         compForm.result,
        context:        compForm.context || null,
      });

      setCompForm({ name: "", date: toLocalDateStr(new Date()), location: "", type: "Régionale", event: "", result: "", context: "" });
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
                      const diff = chartData[chartData.length - 1].value - chartData[0].value;
                      const col  = diff >= 0 ? "#4DC9A0" : "#F19A9A";
                      const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
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
                    const pr       = athlete.records?.[g.discipline]?.pr;
                    const prN = parseFloat(pr), tgN = parseFloat(g.target_value);
                    const pct = (!isNaN(prN) && !isNaN(tgN) && tgN > 0) ? Math.min(100, Math.max(0, Math.round((prN/tgN)*100))) : null;

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
                          <GoalProgressBar pr={pr} target={g.target_value} color={col} />
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

      {showAddComp && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && !savingComp && setShowAddComp(false)}>
          <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
            style={{ background: "var(--c-surface)" }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
              <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
            </div>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-1)" }}>Ajouter une compétition</p>
                <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>Résultat enregistré dans ton profil</p>
              </div>
              <button onClick={() => setShowAddComp(false)} disabled={savingComp}
                style={{ width: 30, height: 30, borderRadius: 8, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-2)" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "name",     label: "Nom de la compétition *", placeholder: "Ex: Championnat provincial" },
                { key: "location", label: "Lieu",                    placeholder: "Ex: Namur" },
                { key: "event",    label: "Épreuve *",               placeholder: "Ex: 100m" },
                { key: "result",   label: "Résultat *",              placeholder: "Ex: 10.94" },
                { key: "context",  label: "Contexte",                placeholder: "Ex: Vent +1.2, finale" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>
                    {f.label}
                  </label>
                  <input className="input-premium" placeholder={f.placeholder}
                    value={compForm[f.key]}
                    onChange={e => setCompForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>Date *</label>
                  <input type="date" className="input-premium"
                    value={compForm.date}
                    onChange={e => setCompForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>Type</label>
                  <select className="input-premium"
                    value={compForm.type}
                    onChange={e => setCompForm(p => ({ ...p, type: e.target.value }))}>
                    {["Régionale","Provinciale","Nationale","Internationale","Autre"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--c-border)", display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddComp(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleAddComp}
                disabled={!compForm.name.trim() || !compForm.event.trim() || !compForm.result.trim() || savingComp}
                className="btn-primary" style={{ flex: 1 }}>
                {savingComp ? <><div className="loader-ring loader-ring-sm" />Enregistrement…</> : <><Plus size={14} />Ajouter</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
    </div>
  );
}