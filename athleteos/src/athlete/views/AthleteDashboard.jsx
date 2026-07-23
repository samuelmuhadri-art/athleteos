// ============================================================
// AthleteOS — src/athlete/views/AthleteDashboard.jsx  ★ v4
// Émotion : dossier médical de haut niveau — sobre, précis, rassurant.
// Règles strictes :
//   - max font-weight 600 partout sauf 1 chiffre héro (700)
//   - zéro emoji dans l'UI — icônes lucide uniquement
//   - max 2 couleurs vives simultanément
//   - barres de charge : largeur fixe 24px, opacité sur les anciennes
//   - fond #F5F5F2, cards #FDFDFB — contraste visible mais doux
// ============================================================

import { useState, useMemo, memo } from "react";
import {
  CalendarDays, TrendingUp, TrendingDown, Zap, CheckCircle,
  Activity, FileText, HeartPulse, Trophy, ChevronRight, Minus,
  Star, MessageSquare,
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
    "100m":"sprint","200m":"sprint","400m":"sprint","800m":"endurance","1500m":"endurance",
    "60m haies":"sprint","100m haies":"sprint","110m haies":"sprint","400m haies":"sprint",
    "Longueur":"saut","Triple saut":"saut","Hauteur":"saut","Perche":"saut",
    "Poids":"lancer","Disque":"lancer","Javelot":"lancer","Marteau":"lancer",
    "Décathlon":"combine","Heptathlon":"combine",
  };
  return MAP[discName] ?? "sprint";
}

// ─── Badges — zéro emoji, icônes lucide ──────────────────────────────────────
function computeBadges({ athlete, weeklyCharge, sessions, competitions, myPerformances, streak, currentWeek }) {
  const badges = [];
  const myComps   = (competitions ?? []).filter(c => c.athleteIds?.includes(athlete.id));
  const myPerfs   = myPerformances ?? [];
  const myRecords = Object.keys(athlete.records ?? {});
  const totalDone = (sessions ?? []).reduce((acc, s) =>
    acc + (s.validations?.filter(v => v.athleteId === athlete.id && v.status === "done").length ?? 0), 0);

  const add = (id, label, desc, color, icon = "zap") =>
    badges.push({ id, label, desc, color, icon, unlocked: true });
  const addLocked = (id, label, desc) =>
    badges.push({ id, label, desc, color: "var(--c-text-4)", icon: "lock", unlocked: false });

  if (streak >= 1)  add("s1",  "Premier feu",  "1 sem. consécutive",   "#C8890A", "zap");
  if (streak >= 3)  add("s3",  "En feu",       "3 sem. consécutives",  "#C8890A", "zap");
  if (streak >= 5)  add("s5",  "Inarrêtable",  "5 sem. consécutives",  "#C0392B", "zap");
  if (streak >= 10) add("s10", "Légende",      "10 sem. consécutives", "#7C67C8", "star");
  if (totalDone >= 1)   add("d1",  "Premier pas", "1 séance",    "#1D9E75", "check");
  if (totalDone >= 10)  add("d10", "Régulier",    "10 séances",  "#1D9E75", "check");
  if (totalDone >= 25)  add("d25", "Bosseur",     "25 séances",  "#4B7BDB", "trending");
  if (totalDone >= 50)  add("d50", "Acharné",     "50 séances",  "#7C67C8", "trending");
  if (totalDone >= 100) add("d100","Élite",       "100 séances", "#C8890A", "trophy");
  if (myComps.length >= 1) add("c1","Compétiteur","1ère compétition", "#C0392B", "trophy");
  if (myComps.length >= 5) add("c5","Guerrier",   "5 compétitions",   "#C0392B", "trophy");

  const prBeat = myPerfs.filter(p => {
    const rec = athlete.records?.[p.discipline]; if (!rec) return false;
    const hib = getDiscHib(p.discipline);
    const pv = parsePerf(p.value), prv = parsePerf(rec.pr);
    if (!pv.value || !prv.value) return false;
    return hib ? pv.value >= prv.value : pv.value <= prv.value;
  }).length;
  if (prBeat >= 1) add("pr1","Record battu","1 PR amélioré",  "#C8890A","trophy");
  if (prBeat >= 3) add("pr3","Recordman",   "3 PR améliorés", "#C8890A","star");

  const discCount = [...new Set([...myRecords,...myPerfs.map(p=>p.discipline)])].length;
  if (discCount >= 1) add("dc1","Spécialiste", "1 discipline",    "#4B7BDB","star");
  if (discCount >= 3) add("dc3","Polyvalent",  "3 disciplines",   "#7C67C8","star");
  if (discCount >= 5) add("dc5","Décathlonien","5+ disciplines",  "#C0392B","star");
  if (myPerfs.length >= 5)  add("p5", "Analytique", "5 perfs",  "#1D9E75","trending");
  if (myPerfs.length >= 20) add("p20","Data driven","20 perfs", "#4B7BDB","trending");

  const optW = (weeklyCharge.filter(w=>w.athleteId===athlete.id)).filter(w => {
    const m = getAthleteMetricsForWeek(athlete.id, weeklyCharge, w.week);
    return m.acwr >= 0.8 && m.acwr <= 1.3;
  }).length;
  if (optW >= 3) add("aw3","Équilibré","3 sem. optimales","#1D9E75","check");
  if (optW >= 8) add("aw8","Maestro",  "8 sem. optimales","#7C67C8","star");

  if (streak < 3)         addLocked("l1","En feu",      `${3-streak} sem. de plus`);
  if (totalDone < 10)     addLocked("l2","Régulier",    `${10-totalDone} séance(s)`);
  if (myComps.length < 1) addLocked("l3","Compétiteur", "Participe à une compét.");

  return badges;
}

// ─── Icône badge sans emoji ───────────────────────────────────────────────────
function BadgeIcon({ icon, color, size = 14 }) {
  const props = { size, color, strokeWidth: 1.8 };
  if (icon === "trophy")   return <Trophy   {...props} />;
  if (icon === "star")     return <Star     {...props} />;
  if (icon === "check")    return <CheckCircle {...props} />;
  if (icon === "trending") return <TrendingUp  {...props} />;
  return <Zap {...props} />;
}

const BadgeItem = memo(({ badge }) => (
  <div className={[
    "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all",
    badge.unlocked ? "bg-white hover:-translate-y-0.5" : "opacity-30",
  ].join(" ")}
    style={badge.unlocked
      ? { boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.05)" }
      : { border: "1px dashed rgba(0,0,0,0.08)" }}>
    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ background: badge.unlocked ? badge.color + "12" : "rgba(0,0,0,0.03)" }}>
      <BadgeIcon icon={badge.icon} color={badge.unlocked ? badge.color : "#C4C2BC"} />
    </div>
    <p style={{ fontSize: 10, fontWeight: 500, color: "var(--c-text-1)", lineHeight: 1.2 }}>{badge.label}</p>
    <p style={{ fontSize: 8.5, color: "var(--c-text-3)", lineHeight: 1.2 }}>{badge.desc}</p>
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

  const chargeHistory = useMemo(() => {
    const myCharge = weeklyCharge.filter(w => w.athleteId === athlete.id);
    if (!myCharge.length) return [];
    return [...myCharge].sort((a, b) => a.week - b.week).slice(-8).map(w => ({
      label: `S${w.week}`, charge: w.rawLoad,
      color: w.rawLoad >= 450 ? "#C0392B" : w.rawLoad >= 320 ? "#C8890A" : "#1D9E75",
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
    metrics.acwr > 1.3 || metrics.readiness < 50 ? "#C0392B" :
    metrics.acwr > 1.15 || metrics.fatigue > 60   ? "#C8890A" :
    "#1D9E75";

  const acwrPct = Math.min(94, Math.max(2, (metrics.acwr / 2) * 100));

  // ── Séparateur de section ──────────────────────────────────────────────────
  const SectionDivider = ({ label, action, onAction }) => (
    <div className="flex items-center justify-between mb-3 mt-5 first:mt-0">
      <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-text-3)" }}>
        {label}
      </p>
      {action && (
        <button onClick={onAction} className="btn-ghost" style={{ minHeight: "auto", padding: "0", fontSize: 11 }}>
          {action}
        </button>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-5 space-y-3 max-w-4xl mx-auto animate-slide-up">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — vert-noir profond, chiffres sobres
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl overflow-hidden select-none"
        style={{ background: "linear-gradient(160deg, #0B1D14 0%, #0D2219 55%, #081611 100%)" }}>
        {/* Grille décorative — très subtile */}
        <div className="absolute pointer-events-none" style={{
          inset: 0, position: "relative",
          backgroundImage: "linear-gradient(rgba(29,158,117,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div style={{ padding: "20px 20px 20px" }}>
          {/* Identité */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: "rgba(29,158,117,0.14)", border: "1px solid rgba(29,158,117,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>
                  {initialsFromName(athlete.name)}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.11em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 3 }}>
                  Mon espace · S{currentWeek}
                </p>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: "white", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {athlete.name.split(" ")[0]}
                </h1>
                <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>
                  {athlete.mainDiscipline ?? "Athlète"}{athlete.group ? ` · ${athlete.group}` : ""}
                </p>
              </div>
            </div>
            {/* Pill statut — discret */}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 99, flexShrink: 0,
              background: `${statusColor}12`, border: `1px solid ${statusColor}22`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: statusColor }}>{status.label}</span>
            </div>
          </div>

          {/* Métriques 4 blocs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { key: "readiness", label: "Readiness", value: metrics.readiness,       unit: "",     pct: metrics.readiness },
              { key: "fatigue",   label: "Fatigue",   value: metrics.fatigue,          unit: "",     pct: metrics.fatigue },
              { key: "acwr",      label: "ACWR",      value: metrics.acwr.toFixed(2),  unit: "",     pct: Math.min(100,(metrics.acwr/2)*100) },
              { key: "streak",    label: "Streak",    value: streak,                   unit: " sem", pct: Math.min(100,streak*10) },
            ].map(s => {
              const col = dimColor(s.key, s.key === "acwr" ? metrics.acwr : Number(s.value));
              return (
                <div key={s.key} style={{
                  background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.055)",
                  borderRadius: 10, padding: "10px 8px", textAlign: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, marginBottom: 4 }}>
                    <span style={{ fontSize: 19, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {s.value}
                    </span>
                    {s.unit && <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.18)", fontWeight: 400, marginBottom: 1 }}>{s.unit}</span>}
                  </div>
                  <p style={{ fontSize: 7.5, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>
                    {s.label}
                  </p>
                  {/* Barre 1.5px */}
                  <div style={{ height: 1.5, background: "rgba(255,255,255,0.05)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(3,s.pct)}%`, background: col, borderRadius: 99, opacity: 0.65, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(29,158,117,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle size={14} color="#1D9E75" strokeWidth={2} />
              </div>
              <div>
                <p className="card-title">Wellness du jour</p>
                <p className="card-subtitle">Questionnaire complété</p>
              </div>
            </div>
            {metrics.wellnessScore !== null && (
              <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(124,103,200,0.08)" }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#7C67C8", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {metrics.wellnessScore}
                </span>
                <span style={{ fontSize: 8.5, color: "#7C67C8", marginLeft: 1 }}>/100</span>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
            {WELLNESS_QUESTIONS.map(q => {
              const val  = wellnessToday[q.key];
              const Icon = q.icon;
              const good = q.inverted ? val <= 2 : val >= 4;
              const bad  = q.inverted ? val >= 4 : val <= 2;
              const col  = good ? "#1D9E75" : bad ? "#C0392B" : "#C8890A";
              return (
                <div key={q.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 8, background: "var(--c-surface-2)" }}>
                  <Icon size={11} color={q.color} strokeWidth={2} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val}</span>
                  <span style={{ fontSize: 7.5, color: "var(--c-text-3)", textAlign: "center", lineHeight: 1.2 }}>{q.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
          {wellnessToday.notes && (
            <p style={{ marginTop: 10, fontSize: 11, color: "var(--c-text-3)", fontStyle: "italic", borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
              {wellnessToday.notes}
            </p>
          )}
          <button onClick={onOpenWellness} style={{ marginTop: 8, fontSize: 10.5, fontWeight: 400, color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Modifier →
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(29,158,117,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Activity size={15} color="#1D9E75" strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.80)" }}>Questionnaire matinal</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>30 secondes · Améliore ton Readiness</p>
            </div>
          </div>
          <button onClick={onOpenWellness} className="btn-primary" style={{ flexShrink: 0 }}>
            Remplir
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GRILLE PRINCIPALE
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 space-y-3">

          {/* ── Charge d'entraînement ───────────────────────────────────────── */}
          {hasCharge && chargeHistory.length > 0 && (
            <div className="card" style={{ overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--c-border)" }}>
                <div>
                  <p className="card-title">Charge d'entraînement</p>
                  <p className="card-subtitle">8 dernières semaines</p>
                </div>
                {chargeTrend !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 8, flexShrink: 0,
                    background: chargeTrend > 15 ? "rgba(192,57,43,0.07)" : chargeTrend > 0 ? "rgba(200,137,10,0.07)" : "rgba(29,158,117,0.07)",
                    color: chargeTrend > 15 ? "#922B21" : chargeTrend > 0 ? "#9A6800" : "#16826C",
                    fontSize: 10.5, fontWeight: 500,
                  }}>
                    {chargeTrend > 0 ? <TrendingUp size={10} /> : chargeTrend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {chargeTrend > 0 ? "+" : ""}{chargeTrend}% vs S-1
                  </div>
                )}
              </div>

              {/* Graphique en colonnes — flex-1 = colonnes qui occupent tout l'espace */}
              <div style={{ padding: "16px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                  {chargeHistory.map((w, i) => {
                    const max       = Math.max(...chargeHistory.map(x => x.charge), 1);
                    const pct       = Math.max((w.charge / max) * 100, 4);
                    const isCurrent = i === chargeHistory.length - 1;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, height: "100%" }}>
                        {/* Zone haute : valeur + espace */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", paddingBottom: 4 }}>
                          {/* Valeur uniquement sur barre courante */}
                          {isCurrent && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: w.color, textAlign: "center", display: "block", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
                              {Math.round(w.charge)}
                            </span>
                          )}
                          {/* Colonne */}
                          <div style={{
                            width: "100%",
                            height: `${pct}%`,
                            minHeight: 4,
                            borderRadius: "4px 4px 2px 2px",
                            // Passé : fond très léger, couleur en bg + bordure top colorée
                            background: isCurrent
                              ? w.color
                              : "rgba(0,0,0,0.045)",
                            // Barre de couleur en haut pour les passées — indique la zone
                            borderTop: isCurrent ? "none" : `2px solid ${w.color}55`,
                            transition: "height 0.6s cubic-bezier(0.16,1,0.3,1)",
                            boxShadow: isCurrent ? `0 2px 8px ${w.color}30` : "none",
                          }} />
                        </div>
                        {/* Label semaine */}
                        <span style={{
                          fontSize: 8, lineHeight: 1, paddingTop: 5, paddingBottom: 2,
                          color: isCurrent ? "#5A5A54" : "#C4C2BC",
                          fontWeight: isCurrent ? 500 : 400,
                          textAlign: "center", display: "block",
                        }}>
                          {w.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Métriques inline sous le graphe — pas de cards séparées */}
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 0, borderTop: "1px solid var(--c-border)", marginTop: 4 }}>
                {[
                  { label: "ACWR",      value: metrics.acwr.toFixed(2), color: acwrColor(metrics.acwr), sub: "0.8–1.3 optimal" },
                  { label: "Aiguë",     value: metrics.acute,           color: "#4B7BDB",               sub: "4 sem." },
                  { label: "Chronique", value: metrics.chronic,         color: "var(--c-text-3)",               sub: "12 sem." },
                ].map((s, idx) => (
                  <div key={s.label} style={{
                    flex: 1, textAlign: "center", paddingTop: 2, paddingBottom: 2,
                    borderRight: idx < 2 ? "1px solid var(--c-border)" : "none",
                  }}>
                    <p style={{ fontSize: 17, fontWeight: 600, color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", lineHeight: 1 }}>
                      {s.value}
                    </p>
                    <p style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginTop: 3 }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 8, color: "var(--c-text-4)", marginTop: 1 }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Réglette ACWR */}
              <div style={{ padding: "0 16px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "var(--c-text-3)", marginBottom: 5 }}>
                  <span>Sous-charge</span>
                  <span style={{ color: "#1D9E75", fontWeight: 500 }}>Zone optimale</span>
                  <span>Surcharge</span>
                </div>
                <div style={{ position: "relative", height: 5, borderRadius: 99, background: "linear-gradient(to right, #4B7BDB 0%, #1D9E75 38%, #1D9E75 62%, #C8890A 78%, #C0392B 100%)" }}>
                  <div style={{
                    position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
                    left: `${acwrPct}%`, width: 11, height: 11, borderRadius: "50%",
                    background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    transition: "left 0.7s cubic-bezier(0.16,1,0.3,1)",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7.5, color: "var(--c-text-4)", marginTop: 4 }}>
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
                <span style={{ fontSize: 9, color: "var(--c-text-4)", fontWeight: 400 }}>Tap pour le détail</span>
              </div>
              <p className="card-subtitle mb-4">Basé sur ta charge réelle</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { key: "readiness",    label: "Readiness"       },
                  { key: "forme",        label: "Forme"           },
                  { key: "fatigue",      label: "Fatigue"         },
                  { key: "recuperation", label: "Récupération"    },
                  { key: "risque",       label: "Risque blessure" },
                ].map(s => {
                  const val    = metrics[s.key];
                  const col    = dimColor(s.key, val);
                  const sci    = METRIC_SCIENCE[s.key];
                  const thresh = sci?.thresholds.find(t => val >= t.min && val <= t.max);
                  return (
                    <button key={s.key} onClick={() => setActiveMetric(s.key)}
                      className="tap-feedback"
                      style={{ background: "var(--c-surface-2)", borderRadius: 10, padding: "10px 12px", textAlign: "left", border: "none", cursor: "pointer", transition: "background 0.15s ease", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 400, color: "var(--c-text-1)" }}>{s.label}</span>
                          {thresh && (
                            <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 6px", borderRadius: 4, background: thresh.color + "10", color: thresh.color }}>
                              {thresh.label}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{val}</span>
                          <ChevronRight size={11} color="#C4C2BC" />
                        </div>
                      </div>
                      {/* Barre 3px */}
                      <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 8.5, color: "var(--c-text-4)", marginTop: 12, textAlign: "center" }}>
                ACWR : Gabbett (2016) · Récup. : Hasegawa (2024) · Banister (1975)
              </p>
            </div>
          )}

          {/* ── Séances cette semaine ───────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div style={{ padding: "12px 16px 12px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p className="card-title">Cette semaine</p>
                <p className="card-subtitle">{doneThisWeek}/{weekSessions.length} réalisée{weekSessions.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => onNavigate("planning")} className="btn-ghost" style={{ minHeight: "auto", padding: 0, fontSize: 11 }}>
                Voir tout →
              </button>
            </div>
            {weekSessions.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <CalendarDays size={20} color="#C4C2BC" strokeWidth={1.5} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Aucune séance cette semaine</p>
              </div>
            ) : weekSessions.map((s, idx) => {
              const c   = colorsFor(s.category);
              const val = s.validations?.find(v => v.athleteId === athlete.id);
              const st  = val?.status ?? "future";
              const stCfg = {
                done:    { label: "Fait",    bg: "rgba(29,158,117,0.07)",  color: "#16826C" },
                partial: { label: "Partiel", bg: "rgba(200,137,10,0.07)",  color: "#9A6800" },
                none:    { label: "Absent",  bg: "rgba(192,57,43,0.07)",   color: "#922B21" },
                future:  { label: "À venir", bg: "rgba(0,0,0,0.04)",       color: "var(--c-text-3)" },
              }[st] ?? { label: "À venir", bg: "rgba(0,0,0,0.04)", color: "var(--c-text-3)" };
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: idx > 0 ? "1px solid var(--c-border)" : "none" }}>
                  {/* Liseré catégorie 2px */}
                  <div style={{ width: 2, alignSelf: "stretch", borderRadius: 2, flexShrink: 0, background: c.border }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }} className="truncate">{s.title}</p>
                    <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 1 }}>
                      {s.sessionDate
                        ? new Date(s.sessionDate).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" })
                        : s.day} · {s.time}
                    </p>
                  </div>
                  {s.pdfUrl && (
                    <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 5, background: "rgba(75,123,219,0.07)", color: "#2E5FA8", fontSize: 9.5, fontWeight: 500, flexShrink: 0, textDecoration: "none" }}>
                      <FileText size={9} />PDF
                    </a>
                  )}
                  <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 6, background: stCfg.bg, color: stCfg.color, fontSize: 10, fontWeight: 500 }}>
                    {stCfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Banner PR ────────────────────────────────────────────────────── */}
          {latestPR && (
            <div style={{ borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #7B5104 0%, #9A6800 50%, #C8890A 100%)" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 90% 15%, rgba(255,255,255,0.08) 0%, transparent 45%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trophy size={18} color="white" strokeWidth={1.8} />
                </div>
                <div>
                  <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>
                    Nouveau record personnel
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {latestPR.discipline} — {latestPR.value}
                  </p>
                  <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.50)", marginTop: 3 }}>
                    {new Date(latestPR.performance_date).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Records ─────────────────────────────────────────────────────── */}
          {topRecords.length > 0 && (
            <div className="card overflow-hidden">
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p className="card-title">Mes records</p>
                <button onClick={() => onNavigate("performances")} className="btn-ghost" style={{ minHeight: "auto", padding: 0, fontSize: 11 }}>
                  Tout voir →
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {topRecords.map(([disc, r], idx) => {
                  const c = DISC_TYPE_COLORS[getDiscType(disc)] ?? DISC_TYPE_COLORS.sprint;
                  return (
                    <div key={disc} style={{
                      padding: "12px 14px",
                      borderRight: idx % 2 === 0 ? "1px solid var(--c-border)" : "none",
                      borderTop: idx >= 2 ? "1px solid var(--c-border)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                        <p style={{ fontSize: 9.5, fontWeight: 500, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{disc}</p>
                      </div>
                      <p style={{ fontSize: 20, fontWeight: 600, color: c.border, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {r.pr}
                      </p>
                      <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 4 }}>
                        SB : <span style={{ color: "var(--c-text-2)", fontWeight: 500 }}>{r.sb}</span>
                      </p>
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
                <p className="card-title">Badges</p>
                <p className="card-subtitle">{unlockedBadges.length} débloqué{unlockedBadges.length > 1 ? "s" : ""}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(200,137,10,0.07)" }}>
                <Trophy size={11} color="#C8890A" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#C8890A", fontVariantNumeric: "tabular-nums" }}>{unlockedBadges.length}</span>
              </div>
            </div>
            {unlockedBadges.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <Trophy size={22} color="#C4C2BC" strokeWidth={1.5} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Commence à t'entraîner pour débloquer tes premiers badges</p>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: unlockedBadges.length > 0 && lockedBadges.length > 0 ? 12 : 0 }}>
                  {unlockedBadges.slice(0, 8).map(b => <BadgeItem key={b.id} badge={b} />)}
                </div>
                {lockedBadges.length > 0 && (
                  <>
                    <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-text-4)", marginBottom: 7 }}>
                      À débloquer
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                      {lockedBadges.slice(0, 4).map(b => <BadgeItem key={b.id} badge={b} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── COLONNE DROITE ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Prochaine compétition */}
          {nextComp && (() => {
            const days = Math.round((new Date(nextComp.date) - today) / (1000*60*60*24));
            return (
              <div style={{ borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #6B1717 0%, #8B1F1F 50%, #A82525 100%)" }}>
                <div style={{ position: "absolute", right: -20, top: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Trophy size={11} color="rgba(255,255,255,0.40)" strokeWidth={2} />
                    <span style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                      Prochaine compétition
                    </span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 3 }}>
                    {nextComp.name}
                  </p>
                  <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", marginBottom: 12 }}>
                    {new Date(nextComp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center", marginBottom: 10, background: "rgba(255,255,255,0.09)" }}>
                    {/* 1 seul chiffre héro dans tout l'écran — weight 700 autorisé */}
                    <p style={{ fontSize: 38, fontWeight: 700, color: "white", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                      {days}
                    </p>
                    <p style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                      jours
                    </p>
                  </div>
                  {nextComp.plannedEvents?.[athlete.id] && (
                    <div style={{ borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.09)" }}>
                      <p style={{ fontSize: 8.5, color: "rgba(255,255,255,0.38)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                        Épreuve prévue
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "white" }}>{nextComp.plannedEvents[athlete.id]}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Régularité */}
          {streak > 0 && (
            <div className="card p-4">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(200,137,10,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={13} color="#C8890A" strokeWidth={2} />
                </div>
                <div>
                  <p className="card-title">Régularité</p>
                  <p className="card-subtitle">Semaines consécutives</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 600, color: "#C8890A", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {streak}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--c-text-3)", marginBottom: 3 }}>sem.</span>
              </div>
              <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginBottom: 8 }}>avec au moins 1 séance validée</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100,streak*10)}%`, background: "#C8890A" }} />
              </div>
              <p style={{ fontSize: 8.5, color: "var(--c-text-4)", textAlign: "right", marginTop: 4 }}>{streak}/10 badge Maestro</p>
            </div>
          )}

          {/* Blessures */}
          {activeInjuries.length > 0 && (
            <div style={{ borderRadius: 14, padding: "14px", background: "var(--c-surface-2)", border: "1px solid rgba(232,160,32,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <HeartPulse size={13} color="#C8890A" strokeWidth={2} />
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-dim-alerte)" }}>Blessures en cours</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {activeInjuries.map(inj => (
                  <div key={inj.id} style={{ borderRadius: 10, padding: "10px 12px", background: "var(--c-surface-3)", border: "1px solid rgba(200,137,10,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-1)" }}>{inj.name}</p>
                      <span style={{ fontSize: 9.5, fontWeight: 500, padding: "1px 6px", borderRadius: 5, background: "rgba(200,137,10,0.08)", color: "#9A6800" }}>
                        {inj.intensity}/10
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginBottom: 6 }}>{inj.location}</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${(inj.intensity/10)*100}%`,
                        background: inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#C8890A" : "#C0392B",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages coach */}
          {lastMessages.length > 0 && (
            <div className="card p-4">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1D9E75,#16826C)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    {initialsFromName(coachName ?? "C")}
                  </div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }}>{coachName?.split(" ")[0] ?? "Coach"}</p>
                    <p style={{ fontSize: 10, color: "var(--c-text-3)" }}>Message récent</p>
                  </div>
                </div>
                <button onClick={() => onNavigate("messagerie")} className="btn-ghost" style={{ minHeight: "auto", padding: 0, fontSize: 11 }}>
                  Répondre →
                </button>
              </div>
              {lastMessages.slice(0, 2).map(m => (
                <div key={m.id} style={{ borderRadius: 10, padding: "9px 11px", marginBottom: 6, background: "var(--c-surface-2)" }}>
                  <p style={{ fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }} className="line-clamp-2">{m.content}</p>
                  <p style={{ fontSize: 9.5, color: "var(--c-text-4)", marginTop: 4 }}>
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