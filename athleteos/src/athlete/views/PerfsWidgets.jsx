// ============================================================
// AthleteOS — src/athlete/views/PerfsWidgets.jsx
// Petits composants de présentation extraits d'AthletePerfs.jsx (qui
// dépassait 1300 lignes) — aucune logique métier ici, uniquement du
// rendu piloté par props.
// ============================================================

import { useMemo, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { getDiscHib, parsePerf, pctOfReference } from "../shared";
import { discColor, recordStatusColor } from "./perfsShared";
import { parseLocalDate } from "../../utils/helpers";

// ─── Confettis — célébration d'un nouveau record personnel ───────────────────
const CONFETTI_COLORS = ["#1D9E75", "#EAB308", "#5B8DEF", "#EC4899", "#38BDF8", "#FB923C"];

export function ConfettiBurst({ onDone }) {
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
export function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 14, padding: "12px 14px", minWidth: 128, boxShadow: "var(--shadow-md)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--c-accent)" }}>{d.raw}</p>
      {d.ctx && <p style={{ fontSize: 12, color: "var(--c-text-2)", fontStyle: "italic", marginTop: 4 }}>{d.ctx}</p>}
      {d.breakdown && Object.keys(d.breakdown).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-border)" }}>
          {Object.entries(d.breakdown).map(([ev, val]) => (
            <div key={ev} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "var(--c-text-2)", marginTop: 4 }}>
              <span>{ev}</span>
              <span style={{ fontWeight: 600, color: "var(--c-text-2)" }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ring de progression générique ────────────────────────────────────────────
export function ProgressRing({ pct, color, size = 64, label, stroke = 6 }) {
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
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct !== null ? `${pct}%` : "—"}</span>
        {label && <span style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 1 }}>{label}</span>}
      </div>
    </div>
  );
}

// ─── Card discipline / record — façon "carte de crédit sportive" : le PR en
// typo monumentale (ce qui compte le plus), SB juste en dessous en discret,
// barre fine SB→PR colorée selon le statut, glow ambiant assorti.
function TrendSparkline({ discipline, series, color }) {
  const points = (series ?? []).slice(-8);
  if (points.length < 2) {
    return (
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>Courbe après 2 mesures</span>
      </div>
    );
  }

  const higherIsBetter = getDiscHib(discipline);
  const scores = points.map(point => higherIsBetter ? point.value : -point.value);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const coords = scores.map((score, index) => ({
    x: 8 + (index / (scores.length - 1)) * 164,
    y: 45 - ((score - min) / range) * 34,
  }));
  const line = coords.map(point => `${point.x},${point.y}`).join(" ");
  const area = `8,52 ${line} 172,52`;
  const gradientId = `record-spark-${discipline.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <svg viewBox="0 0 180 56" width="100%" height="58" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${area} Z`} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {coords.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 3.5 : 2} fill={index === coords.length - 1 ? color : "var(--c-surface)"} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function RecordCard({ disc, rec, onSeeEvolution, stats }) {
  const col = discColor(disc);
  // hib (higher-is-better) : indispensable pour les disciplines chronométrées
  // (sprint...) où SB ≥ PR est la norme — sbN/prN donnerait alors toujours
  // ~100%, peu importe l'écart réel. On raisonne dans le bon sens ici.
  const hib = getDiscHib(disc);
  const sbP = parsePerf(rec.sb);
  const prP = parsePerf(rec.pr);
  const pct = (sbP.value != null && prP.value != null && prP.value !== 0)
    ? Math.min(100, Math.max(0, Math.round(hib ? (sbP.value / prP.value) * 100 : (prP.value / sbP.value) * 100)))
    : null;
  const statusColor = recordStatusColor(pct) ?? col;

  return (
    <button type="button" onClick={onSeeEvolution} className="card card-hover tap-feedback" style={{ position: "relative", overflow: "hidden", width: "100%", padding: 20, textAlign: "left", cursor: "pointer" }}>
      <div style={{
        position: "absolute", right: -48, top: -58, width: 190, height: 190, borderRadius: "50%",
        background: `radial-gradient(circle, ${col}20 0%, transparent 68%)`, pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, boxShadow: `0 0 12px ${col}`, flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-text-2)" }} className="truncate">{disc}</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: `${statusColor}14`, border: `1px solid ${statusColor}2E`, borderRadius: 99, padding: "4px 8px", flexShrink: 0 }}>
          {pct !== null ? `${pct}% du PR` : "Saison"}
        </span>
      </div>

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(110px, 0.9fr)", alignItems: "end", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 6 }}>Record personnel</p>
          <p style={{ fontSize: "clamp(28px, 7vw, 36px)", fontWeight: 700, color: "var(--c-text-1)", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }} className="truncate">
            {rec.pr ?? "—"}
          </p>
        </div>
        <TrendSparkline discipline={disc} series={stats?.series} color={col} />
      </div>

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Saison</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)", marginTop: 2 }}>{rec.sb ?? "—"}</p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Mesures</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)", marginTop: 2 }}>{stats?.count ?? 0}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Record établi</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", marginTop: 2 }}>
            {rec.prDate ? parseLocalDate(rec.prDate.slice(0, 10)).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </p>
        </div>
      </div>
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 14, fontSize: 12, fontWeight: 700, color: col }}>
        Voir l’évolution <ChevronRight size={14} aria-hidden="true" />
      </span>
    </button>
  );
}

// ─── Barre de progression PR → objectif ──────────────────────────────────────
export function GoalProgressBar({ pr, target, discipline, color }) {
  if (!pr || !target) return null;
  // Tâche 11 : parsePerf (pas parseFloat, qui tronque "4:32" à 4) +
  // pctOfReference (pas un ratio PR/target écrit à la main, qui donnait
  // ~100%+ dès le départ pour un objectif chronométré plus rapide que le PR).
  const prN = parsePerf(pr).value;
  const tgN = parsePerf(target).value;
  const pct = pctOfReference(prN, tgN, discipline);
  if (pct === null) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", marginBottom: 8 }}>
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
