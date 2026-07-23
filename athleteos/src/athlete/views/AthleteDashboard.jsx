// ============================================================
// AthleteOS — src/athlete/views/AthleteDashboard.jsx  ★ DESIGN v3
//
// Inspiration : Whoop × Garmin Connect × Apple Health
// Philosophie : chuchoter, jamais crier.
//   - Hero dark #0D1F18 avec métriques en mini-blocs
//   - Cards avec fond #FAFAFA + bordure subtile, profondeur réelle
//   - Barres de charge fines et élégantes (pas de gros blocs rouges)
//   - Chiffres tabulaires, 3 graisses max
//   - Zéro emoji dans l'UI
//   - Palette désaturée, accent vert utilisé avec parcimonie
// ============================================================

import { useState, useMemo, memo } from "react";
import {
  CalendarDays, TrendingUp, TrendingDown, Zap, CheckCircle,
  Activity, FileText, HeartPulse, Trophy, ChevronRight, Minus,
} from "lucide-react";
import {
  getAthleteMetricsForWeek, getStatusLabel,
} from "../../utils/chargeCalculations";
import {
  getISOWeek, dimColor, acwrColor, colorsFor, parsePerf,
  initialsFromName, getDiscHib, DISC_TYPE_COLORS, WELLNESS_QUESTIONS, METRIC_SCIENCE,
} from "../shared";
import FormeDetailPanel from "../components/FormeDetailPanel";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDiscType(discName) {
  const MAP = {
    "100m": "sprint", "200m": "sprint", "400m": "sprint",
    "800m": "endurance", "1500m": "endurance",
    "60m haies": "sprint", "100m haies": "sprint",
    "110m haies": "sprint", "400m haies": "sprint",
    "Longueur": "saut", "Triple saut": "saut",
    "Hauteur": "saut", "Perche": "saut",
    "Poids": "lancer", "Disque": "lancer",
    "Javelot": "lancer", "Marteau": "lancer",
    "Décathlon": "combine", "Heptathlon": "combine",
  };
  return MAP[discName] ?? "sprint";
}

// ─── Calcul badges (logique identique) ───────────────────────────────────────
function computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek }) {
  const badges = [];
  const myComps = (competitions ?? []).filter(c => c.athleteIds?.includes(athlete.id));
  const myPerfs = myPerformances ?? [];
  const myRecords = Object.keys(athlete.records ?? {});
  const totalDone = (sessions ?? []).reduce((acc, s) =>
    acc + (s.validations?.filter(v => v.athleteId === athlete.id && v.status === "done").length ?? 0), 0);

  if (streak >= 1)  badges.push({ id: "s1",    emoji: "🔥", label: "Premier feu",  desc: "1 sem. consécutive",    color: "#D97706", unlocked: true  });
  if (streak >= 3)  badges.push({ id: "s3",    emoji: "🔥", label: "En feu",       desc: "3 sem. consécutives",   color: "#D97706", unlocked: true  });
  if (streak >= 5)  badges.push({ id: "s5",    emoji: "⚡", label: "Inarrêtable",  desc: "5 sem. consécutives",   color: "#DC2626", unlocked: true  });
  if (streak >= 10) badges.push({ id: "s10",   emoji: "💥", label: "Légende",      desc: "10 sem. consécutives",  color: "#7C3AED", unlocked: true  });
  if (totalDone >= 1)   badges.push({ id: "d1",  label: "Premier pas", desc: "1 séance",          color: "#1D9E75", unlocked: true });
  if (totalDone >= 10)  badges.push({ id: "d10", label: "Régulier",    desc: "10 séances",        color: "#1D9E75", unlocked: true });
  if (totalDone >= 25)  badges.push({ id: "d25", label: "Bosseur",     desc: "25 séances",        color: "#3B82F6", unlocked: true });
  if (totalDone >= 50)  badges.push({ id: "d50", label: "Acharné",     desc: "50 séances",        color: "#7C3AED", unlocked: true });
  if (totalDone >= 100) badges.push({ id: "d100",label: "Élite",       desc: "100 séances",       color: "#D97706", unlocked: true });
  if (myComps.length >= 1) badges.push({ id: "c1", label: "Compétiteur", desc: "1ère compétition", color: "#DC2626", unlocked: true });
  if (myComps.length >= 5) badges.push({ id: "c5", label: "Guerrier",    desc: "5 compétitions",   color: "#DC2626", unlocked: true });

  const prBeat = myPerfs.filter(p => {
    const rec = athlete.records?.[p.discipline]; if (!rec) return false;
    const hib = getDiscHib(p.discipline);
    const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
    if (!pv.value || !prv.value) return false;
    return hib ? pv.value >= prv.value : pv.value <= prv.value;
  }).length;
  if (prBeat >= 1) badges.push({ id: "pr1", label: "Record battu", desc: "1 PR amélioré", color: "#D97706", unlocked: true });
  if (prBeat >= 3) badges.push({ id: "pr3", label: "Recordman",    desc: "3 PR améliorés",color: "#D97706", unlocked: true });

  const discCount = [...new Set([...myRecords, ...myPerfs.map(p => p.discipline)])].length;
  if (discCount >= 1) badges.push({ id: "dc1", label: "Spécialiste",  desc: "1 discipline",   color: "#1D4ED8", unlocked: true });
  if (discCount >= 3) badges.push({ id: "dc3", label: "Polyvalent",   desc: "3 disciplines",  color: "#7C3AED", unlocked: true });
  if (discCount >= 5) badges.push({ id: "dc5", label: "Décathlonien", desc: "5+ disciplines", color: "#DC2626", unlocked: true });

  if (myPerfs.length >= 5)  badges.push({ id: "p5",  label: "Analytique",  desc: "5 perfs suivies",  color: "#1D9E75", unlocked: true });
  if (myPerfs.length >= 20) badges.push({ id: "p20", label: "Data driven", desc: "20 perfs suivies", color: "#3B82F6", unlocked: true });

  const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
  const optW = myCharge.filter(w => {
    const m = getAthleteMetricsForWeek(athlete.id, weeklyCharge, w.week);
    return m.acwr >= 0.8 && m.acwr <= 1.3;
  }).length;
  if (optW >= 3) badges.push({ id: "aw3", label: "Équilibré", desc: "3 sem. optimales", color: "#1D9E75", unlocked: true });
  if (optW >= 8) badges.push({ id: "aw8", label: "Maestro",   desc: "8 sem. optimales", color: "#7C3AED", unlocked: true });

  // Locked
  if (streak < 3)         badges.push({ id: "l1", label: "En feu",      desc: `${3-streak} sem. de plus`,          color: "#BEC8D2", unlocked: false });
  if (totalDone < 10)     badges.push({ id: "l2", label: "Régulier",    desc: `${10-totalDone} séance(s) de plus`, color: "#BEC8D2", unlocked: false });
  if (myComps.length < 1) badges.push({ id: "l3", label: "Compétiteur", desc: "Participe à une compét.",           color: "#BEC8D2", unlocked: false });

  return badges;
}

// ─── Badge item ───────────────────────────────────────────────────────────────
const BadgeItem = memo(({ badge }) => (
  <div className={[
    "flex flex-col items-center gap-1.5 p-3 rounded-2xl text-center transition-all",
    badge.unlocked
      ? "bg-white border border-slate-100 hover:-translate-y-0.5"
      : "border border-dashed border-slate-200 opacity-35",
  ].join(" ")}
    style={badge.unlocked ? { boxShadow: `0 1px 4px ${badge.color}14` } : {}}>
    {/* Icône colorée — pas d'emoji */}
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px]"
      style={{ background: badge.unlocked ? badge.color + "12" : "#F1F5F9" }}>
      {badge.emoji ?? <Trophy size={14} color={badge.color} />}
    </div>
    <p className="text-[10.5px] font-semibold text-slate-600 leading-tight">{badge.label}</p>
    <p className="text-[9px] text-slate-400 leading-tight">{badge.desc}</p>
  </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthleteDashboard({
  athlete, weeklyCharge, sessions, competitions, lastMessages,
  coachName, myPerformances, onNavigate, wellnessToday, onOpenWellness,
}) {
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

  // Historique charge — 8 semaines, normalisé pour affichage fin
  const chargeHistory = useMemo(() => {
    const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
    if (!myCharge.length) return [];
    return [...myCharge].sort((a, b) => a.week - b.week).slice(-8).map(w => ({
      label: `S${w.week}`,
      charge: w.rawLoad,
      // Couleur désaturée — jamais de rouge vif plein bloc
      color: w.rawLoad >= 450 ? "#DC2626" : w.rawLoad >= 320 ? "#D97706" : "#1D9E75",
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
      const ok = sessions.filter(se => se.week === w)
        .some(se => se.validations?.some(v => v.athleteId === athlete.id && v.status === "done"));
      if (ok) s++; else break;
    }
    return s;
  }, [sessions, athlete.id, currentWeek]);

  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  const badges = useMemo(() =>
    computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek }),
  [athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek]);

  const unlockedBadges = badges.filter(b =>  b.unlocked);
  const lockedBadges   = badges.filter(b => !b.unlocked);

  const latestPR = useMemo(() => {
    const ago = new Date(); ago.setDate(ago.getDate() - 7);
    return (myPerformances ?? []).find(p => {
      const rec = athlete.records?.[p.discipline];
      if (!rec || !p.performance_date || new Date(p.performance_date) < ago) return false;
      const hib = getDiscHib(p.discipline);
      const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
      if (!pv.value || !prv.value) return false;
      return hib ? pv.value >= prv.value : pv.value <= prv.value;
    }) ?? null;
  }, [myPerformances, athlete.records]);

  const doneThisWeek = weekSessions.filter(s =>
    s.validations?.find(v => v.athleteId === athlete.id && v.status === "done")).length;

  const [activeMetric, setActiveMetric] = useState(null);

  const statusColor =
    metrics.acwr > 1.3 || metrics.readiness < 50 ? "#DC2626" :
    metrics.acwr > 1.15 || metrics.fatigue > 60   ? "#D97706" :
    "#1D9E75";

  // ── Couleur ACWR pour réglette ────────────────────────────────────────────
  const acwrPct = Math.min(95, Math.max(2, (metrics.acwr / 2) * 100));

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-5 space-y-3 max-w-4xl mx-auto animate-slide-up">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — fond vert-noir profond
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl overflow-hidden relative select-none"
        style={{ background: "linear-gradient(160deg, #0A1C14 0%, #0D2118 50%, #081510 100%)" }}>

        {/* Grille décorative subtile */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(29,158,117,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
        {/* Halo radial coin haut-droit */}
        <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(29,158,117,0.12) 0%, transparent 65%)" }} />

        <div className="relative p-5">
          {/* Identité + pill statut */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.25)" }}>
                <span className="text-[15px] font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
                  {initialsFromName(athlete.name)}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 2 }}>
                  Mon espace · S{currentWeek}
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {athlete.name.split(" ")[0]}
                </h1>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
                  {athlete.mainDiscipline ?? "Athlète"}{athlete.group ? ` · ${athlete.group}` : ""}
                </p>
              </div>
            </div>

            {/* Pill statut — sobre, pas criard */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full flex-shrink-0"
              style={{ background: `${statusColor}14`, border: `1px solid ${statusColor}28` }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: statusColor }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: statusColor }}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Métriques — 4 blocs fins */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: "readiness", label: "Readiness", value: metrics.readiness,       unit: "", pct: metrics.readiness },
              { key: "fatigue",   label: "Fatigue",   value: metrics.fatigue,          unit: "", pct: metrics.fatigue },
              { key: "acwr",      label: "ACWR",      value: metrics.acwr.toFixed(2),  unit: "", pct: Math.min(100, (metrics.acwr / 2) * 100) },
              { key: "streak",    label: "Streak",    value: streak,                   unit: " sem", pct: Math.min(100, streak * 10) },
            ].map(s => {
              const col = dimColor(s.key, s.key === "acwr" ? metrics.acwr : Number(s.value));
              return (
                <div key={s.key}
                  className="rounded-xl px-2.5 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-end justify-center gap-0.5 mb-1">
                    <span style={{ fontSize: 20, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {s.value}
                    </span>
                    {s.unit && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.20)", fontWeight: 500, marginBottom: 1 }}>{s.unit}</span>}
                  </div>
                  <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
                    {s.label}
                  </p>
                  {/* Mini-barre très fine */}
                  <div style={{ height: 1.5, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(3, s.pct)}%`, background: col, borderRadius: 99, opacity: 0.7, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          WELLNESS
         ══════════════════════════════════════════════════════════════════════ */}
      {wellnessToday ? (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(29,158,117,0.10)" }}>
                <CheckCircle size={14} color="#1D9E75" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-700">Wellness du jour</p>
                <p className="text-[10.5px] text-slate-400">Questionnaire complété</p>
              </div>
            </div>
            {metrics.wellnessScore !== null && (
              <div className="px-3 py-1.5 rounded-xl" style={{ background: "rgba(139,92,246,0.08)" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#7C3AED", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {metrics.wellnessScore}
                </span>
                <span style={{ fontSize: 9, color: "#8B5CF6", marginLeft: 2 }}>/100</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {WELLNESS_QUESTIONS.map(q => {
              const val  = wellnessToday[q.key];
              const Icon = q.icon;
              const good = q.inverted ? val <= 2 : val >= 4;
              const bad  = q.inverted ? val >= 4 : val <= 2;
              const col  = good ? "#1D9E75" : bad ? "#DC2626" : "#D97706";
              return (
                <div key={q.key}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                  style={{ background: "#F8F8F5" }}>
                  <Icon size={12} color={q.color} strokeWidth={2} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val}</span>
                  <span style={{ fontSize: 7.5, color: "#94A3B8", textAlign: "center", lineHeight: 1.2 }}>
                    {q.label.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
          {wellnessToday.notes && (
            <p className="mt-3 text-[11px] text-slate-400 italic border-t border-slate-50 pt-2.5">
              {wellnessToday.notes}
            </p>
          )}
          <button onClick={onOpenWellness}
            className="mt-2.5 text-[10.5px] font-semibold text-slate-400 hover:text-emerald-600 transition-colors">
            Modifier →
          </button>
        </div>
      ) : (
        /* CTA wellness */
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
          style={{ background: "linear-gradient(135deg, #F0FAF5 0%, #E6F7EF 100%)", border: "1px solid rgba(29,158,117,0.12)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(29,158,117,0.12)" }}>
              <Activity size={16} color="#1D9E75" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-emerald-800">Questionnaire matinal</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">30 secondes · Améliore ton Readiness</p>
            </div>
          </div>
          <button onClick={onOpenWellness} className="btn-primary !py-2 !px-4 flex-shrink-0">
            Remplir
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GRILLE PRINCIPALE
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 space-y-3">

          {/* ── Charge ─────────────────────────────────────────────────────── */}
          {hasCharge && chargeHistory.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="card-title">Charge d'entraînement</p>
                  <p className="card-subtitle">8 dernières semaines</p>
                </div>
                {chargeTrend !== null && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                    style={chargeTrend > 15
                      ? { background: "rgba(220,38,38,0.07)", color: "#B91C1C" }
                      : chargeTrend > 0
                        ? { background: "rgba(217,119,6,0.07)", color: "#92400E" }
                        : chargeTrend < 0
                          ? { background: "rgba(29,158,117,0.07)", color: "#065F46" }
                          : { background: "rgba(0,0,0,0.04)", color: "#52606D" }}>
                    {chargeTrend > 0 ? <TrendingUp size={11} /> : chargeTrend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                    {chargeTrend > 0 ? "+" : ""}{chargeTrend}% vs S-1
                  </div>
                )}
              </div>

              {/* Barres fines — pas de gros blocs */}
              <div className="flex items-end gap-1.5 mb-4" style={{ height: "80px" }}>
                {chargeHistory.map((w, i) => {
                  const max       = Math.max(...chargeHistory.map(x => x.charge), 1);
                  const pct       = (w.charge / max) * 100;
                  const isCurrent = i === chargeHistory.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end" style={{ height: "62px" }}>
                        <div className="w-full rounded-t-lg transition-all duration-700"
                          style={{
                            height: `${Math.max(pct, 4)}%`,
                            minHeight: "4px",
                            // Barre fine avec opacité — jamais un bloc rouge plein
                            background: isCurrent ? w.color : w.color + "40",
                            // Seule la barre courante a un outline
                            boxShadow: isCurrent ? `0 0 0 1.5px ${w.color}` : "none",
                            borderRadius: "4px 4px 2px 2px",
                          }} />
                      </div>
                      <p style={{ fontSize: 8, color: isCurrent ? "#52606D" : "#BEC8D2", fontWeight: isCurrent ? 600 : 400 }}>
                        {w.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Stats ACWR / Aiguë / Chronique — grid 3 cols épurée */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "ACWR",      value: metrics.acwr.toFixed(2), color: acwrColor(metrics.acwr), sub: "0.8–1.3 optimal" },
                  { label: "Aiguë",     value: metrics.acute,           color: "#3B82F6",               sub: "4 dernières sem." },
                  { label: "Chronique", value: metrics.chronic,         color: "#94a3b8",               sub: "12 dernières sem." },
                ].map(s => (
                  <div key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "#F8F8F5" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", lineHeight: 1 }}>
                      {s.value}
                    </p>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A98A8", marginTop: 4 }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 9, color: "#BEC8D2", marginTop: 2 }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Réglette ACWR — fine et lisible */}
              <div>
                <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 9, color: "#8A98A8" }}>
                  <span>Sous-charge</span>
                  <span style={{ color: "#1D9E75", fontWeight: 600 }}>Zone optimale</span>
                  <span>Surcharge</span>
                </div>
                <div style={{ background: "linear-gradient(to right, #3B82F6 0%, #1D9E75 38%, #1D9E75 62%, #D97706 78%, #DC2626 100%)", height: 6, borderRadius: 99, position: "relative", overflow: "hidden" }}>
                  {/* Curseur blanc */}
                  <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-700"
                    style={{ left: `${acwrPct}%`, width: 10, height: 10, background: "white", borderRadius: "50%", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", marginLeft: -5 }} />
                </div>
                <div className="flex justify-between mt-1" style={{ fontSize: 8.5, color: "#BEC8D2" }}>
                  <span>0</span><span>0.8</span><span>1.3</span><span>2.0</span>
                </div>
              </div>
            </div>
          )}

          {/* ── État de forme ───────────────────────────────────────────────── */}
          {hasCharge && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="card-title">État de forme</p>
                <span style={{ fontSize: 9.5, color: "#BEC8D2", fontWeight: 500 }}>Tap pour le détail</span>
              </div>
              <p className="card-subtitle mb-4">Basé sur ta charge réelle</p>
              <div className="space-y-2">
                {[
                  { key: "readiness",    label: "Readiness"      },
                  { key: "forme",        label: "Forme"          },
                  { key: "fatigue",      label: "Fatigue"        },
                  { key: "recuperation", label: "Récupération"   },
                  { key: "risque",       label: "Risque blessure"},
                ].map(s => {
                  const val    = metrics[s.key];
                  const col    = dimColor(s.key, val);
                  const sci    = METRIC_SCIENCE[s.key];
                  const thresh = sci?.thresholds.find(t => val >= t.min && val <= t.max);
                  return (
                    <button key={s.key} onClick={() => setActiveMetric(s.key)}
                      className="w-full rounded-xl px-3.5 py-3 text-left transition-all hover:bg-slate-50 tap-feedback"
                      style={{ background: "#F8F8F5" }}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#161B22" }}>{s.label}</span>
                          {thresh && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
                              style={{ background: thresh.color + "12", color: thresh.color }}>
                              {thresh.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 15, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{val}</span>
                          <ChevronRight size={12} color="#BEC8D2" />
                        </div>
                      </div>
                      {/* Barre fine */}
                      <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 9, color: "#BEC8D2", marginTop: 14, textAlign: "center" }}>
                ACWR : Gabbett (2016) · Récup. : Hasegawa (2024) · Fitness-Fatigue : Banister (1975)
              </p>
            </div>
          )}

          {/* ── Séances cette semaine ───────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div>
                <p className="card-title">Cette semaine</p>
                <p className="card-subtitle">{doneThisWeek}/{weekSessions.length} réalisée{weekSessions.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => onNavigate("planning")}
                className="text-[11px] font-semibold transition-colors"
                style={{ color: "#1D9E75" }}>
                Voir tout →
              </button>
            </div>
            {weekSessions.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays size={22} className="mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                <p style={{ fontSize: 12, color: "#8A98A8" }}>Aucune séance cette semaine</p>
              </div>
            ) : (
              <div>
                {weekSessions.map((s, idx) => {
                  const c   = colorsFor(s.category);
                  const val = s.validations?.find(v => v.athleteId === athlete.id);
                  const st  = val?.status ?? "future";
                  const statusCfg = {
                    done:    { label: "Fait",     bg: "rgba(29,158,117,0.08)",  color: "#065F46" },
                    partial: { label: "Partiel",  bg: "rgba(217,119,6,0.08)",   color: "#92400E" },
                    none:    { label: "Absent",   bg: "rgba(220,38,38,0.08)",   color: "#B91C1C" },
                    future:  { label: "À venir",  bg: "rgba(0,0,0,0.04)",       color: "#8A98A8" },
                  }[st] ?? { label: "À venir", bg: "rgba(0,0,0,0.04)", color: "#8A98A8" };
                  return (
                    <div key={s.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors"
                      style={{ borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      {/* Liseré catégorie fin */}
                      <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: c.border }} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12.5, fontWeight: 500, color: "#161B22" }} className="truncate">{s.title}</p>
                        <p style={{ fontSize: 10.5, color: "#8A98A8", marginTop: 1 }}>
                          {s.sessionDate
                            ? new Date(s.sessionDate).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" })
                            : s.day} · {s.time}
                        </p>
                      </div>
                      {s.pdfUrl && (
                        <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 flex-shrink-0"
                          style={{ background: "rgba(29,78,216,0.07)", color: "#1D4ED8", fontSize: 9.5, fontWeight: 600 }}>
                          <FileText size={9} />PDF
                        </a>
                      )}
                      <span className="flex-shrink-0 rounded-lg px-2 py-0.5"
                        style={{ background: statusCfg.bg, color: statusCfg.color, fontSize: 10, fontWeight: 600 }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Banner PR ────────────────────────────────────────────────────── */}
          {latestPR && (
            <div className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #92400E 0%, #B45309 50%, #D97706 100%)" }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at 88% 12%, rgba(255,255,255,0.10) 0%, transparent 45%)" }} />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Trophy size={22} color="white" strokeWidth={1.8} />
                </div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.60)", marginBottom: 2 }}>
                    Nouveau record personnel
                  </p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {latestPR.discipline} — {latestPR.value}
                  </p>
                  <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
                    {new Date(latestPR.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Mes records ─────────────────────────────────────────────────── */}
          {topRecords.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="card-title">Mes records</p>
                <button onClick={() => onNavigate("performances")}
                  style={{ fontSize: 11, fontWeight: 600, color: "#1D9E75" }}>
                  Tout voir →
                </button>
              </div>
              <div className="grid grid-cols-2">
                {topRecords.map(([disc, r], idx) => {
                  const c = DISC_TYPE_COLORS[getDiscType(disc)] ?? DISC_TYPE_COLORS.sprint;
                  return (
                    <div key={disc} className="px-4 py-3.5"
                      style={{
                        borderRight: idx % 2 === 0 ? "1px solid rgba(0,0,0,0.05)" : "none",
                        borderTop: idx >= 2 ? "1px solid rgba(0,0,0,0.05)" : "none",
                      }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                        <p style={{ fontSize: 10, fontWeight: 600, color: "#8A98A8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{disc}</p>
                      </div>
                      <p style={{ fontSize: 21, fontWeight: 700, color: c.border, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {r.pr}
                      </p>
                      <p style={{ fontSize: 10.5, color: "#8A98A8", marginTop: 3 }}>SB : <span style={{ color: "#52606D", fontWeight: 500 }}>{r.sb}</span></p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Badges ──────────────────────────────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="card-title">Mes badges</p>
                <p className="card-subtitle">{unlockedBadges.length} débloqué{unlockedBadges.length > 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: "rgba(217,119,6,0.08)" }}>
                <Trophy size={12} color="#D97706" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#D97706", fontVariantNumeric: "tabular-nums" }}>
                  {unlockedBadges.length}
                </span>
              </div>
            </div>
            {unlockedBadges.length === 0 ? (
              <div className="text-center py-8">
                <Trophy size={24} className="mx-auto mb-2 text-slate-200" strokeWidth={1.5} />
                <p style={{ fontSize: 12, color: "#8A98A8" }}>Commence à t'entraîner pour débloquer tes badges !</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {unlockedBadges.slice(0, 8).map(b => <BadgeItem key={b.id} badge={b} />)}
                </div>
                {lockedBadges.length > 0 && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#BEC8D2", marginBottom: 8 }}>
                      À débloquer
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {lockedBadges.slice(0, 4).map(b => <BadgeItem key={b.id} badge={b} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── COLONNE DROITE ─────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Prochaine compétition */}
          {nextComp && (() => {
            const days = Math.round((new Date(nextComp.date) - today) / (1000 * 60 * 60 * 24));
            return (
              <div className="rounded-2xl p-4 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)" }}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full pointer-events-none"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={13} color="rgba(255,255,255,0.50)" strokeWidth={2} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)" }}>
                      Prochaine compétition
                    </span>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 4 }}>
                    {nextComp.name}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>
                    {new Date(nextComp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div className="rounded-xl px-3 py-2.5 text-center mb-3"
                    style={{ background: "rgba(255,255,255,0.10)" }}>
                    <p style={{ fontSize: 36, fontWeight: 700, color: "white", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                      {days}
                    </p>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
                      jours
                    </p>
                  </div>
                  {nextComp.plannedEvents?.[athlete.id] && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.10)" }}>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                        Épreuve prévue
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                        {nextComp.plannedEvents[athlete.id]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Streak */}
          {streak > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(217,119,6,0.10)" }}>
                  <Zap size={15} color="#D97706" strokeWidth={2} />
                </div>
                <div>
                  <p className="card-title">Régularité</p>
                  <p className="card-subtitle">Semaines consécutives</p>
                </div>
              </div>
              <div className="flex items-end gap-1.5 mb-1">
                <span style={{ fontSize: 44, fontWeight: 700, color: "#D97706", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {streak}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#8A98A8", marginBottom: 4 }}>sem.</span>
              </div>
              <p style={{ fontSize: 10.5, color: "#8A98A8", marginBottom: 8 }}>avec au moins 1 séance validée</p>
              <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, streak * 10)}%`, background: "#D97706", borderRadius: 99, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
              </div>
              <p style={{ fontSize: 9, color: "#BEC8D2", textAlign: "right", marginTop: 4 }}>{streak}/10 badge Maestro</p>
            </div>
          )}

          {/* Blessures actives */}
          {activeInjuries.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "#FFFDF5", border: "1px solid rgba(217,119,6,0.14)" }}>
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={14} color="#D97706" strokeWidth={2} />
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "#92400E" }}>Blessures en cours</p>
              </div>
              <div className="space-y-2">
                {activeInjuries.map(inj => (
                  <div key={inj.id} className="rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(217,119,6,0.10)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#161B22" }}>{inj.name}</p>
                      <span className="rounded-md px-1.5 py-0.5"
                        style={{ fontSize: 9.5, fontWeight: 600, background: "rgba(217,119,6,0.08)", color: "#92400E" }}>
                        {inj.intensity}/10
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: "#8A98A8", marginBottom: 6 }}>{inj.location}</p>
                    <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        width: `${(inj.intensity / 10) * 100}%`,
                        background: inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#D97706" : "#DC2626",
                        transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Derniers messages coach */}
          {lastMessages.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", fontSize: 11, fontWeight: 700 }}>
                    {initialsFromName(coachName ?? "C")}
                  </div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "#161B22" }}>
                      {coachName?.split(" ")[0] ?? "Coach"}
                    </p>
                    <p style={{ fontSize: 10, color: "#8A98A8" }}>Message récent</p>
                  </div>
                </div>
                <button onClick={() => onNavigate("messagerie")}
                  style={{ fontSize: 10.5, fontWeight: 600, color: "#1D9E75" }}>
                  Répondre →
                </button>
              </div>
              {lastMessages.slice(0, 2).map(m => (
                <div key={m.id} className="rounded-xl px-3 py-2.5 mb-2"
                  style={{ background: "#F8F8F5" }}>
                  <p style={{ fontSize: 12, color: "#52606D", lineHeight: 1.55 }} className="line-clamp-2">
                    {m.content}
                  </p>
                  <p style={{ fontSize: 9.5, color: "#BEC8D2", marginTop: 4 }}>
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
          metricKey={activeMetric} metrics={metrics}
          sessions={sessions} weeklyCharge={weeklyCharge}
          athlete={athlete} onClose={() => setActiveMetric(null)}
        />
      )}
    </div>
  );
}