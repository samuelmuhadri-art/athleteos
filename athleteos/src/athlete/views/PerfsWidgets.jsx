// ============================================================
// AthleteOS — src/athlete/views/PerfsWidgets.jsx
// Petits composants de présentation extraits d'AthletePerfs.jsx (qui
// dépassait 1300 lignes) — aucune logique métier ici, uniquement du
// rendu piloté par props.
// ============================================================

import { useMemo, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { getDiscHib, parsePerf } from "../shared";
import { discColor, recordStatusColor } from "./perfsShared";

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
    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 14, padding: "10px 14px", minWidth: 110, boxShadow: "var(--shadow-md)" }}>
      <p style={{ fontSize: 10.5, fontWeight: 500, color: "var(--c-text-3)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{d.raw}</p>
      {d.ctx && <p style={{ fontSize: 10.5, color: "var(--c-text-3)", fontStyle: "italic", marginTop: 4 }}>{d.ctx}</p>}
      {d.breakdown && Object.keys(d.breakdown).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-border)" }}>
          {Object.entries(d.breakdown).map(([ev, val]) => (
            <div key={ev} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>
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
        <span style={{ fontSize: size > 56 ? 13 : 11, fontWeight: 700, color }}>{pct !== null ? `${pct}%` : "—"}</span>
        {label && <span style={{ fontSize: 7.5, color: "var(--c-text-4)", marginTop: 1 }}>{label}</span>}
      </div>
    </div>
  );
}

// ─── Card discipline / record — façon "carte de crédit sportive" : le PR en
// typo monumentale (ce qui compte le plus), SB juste en dessous en discret,
// barre fine SB→PR colorée selon le statut, glow ambiant assorti.
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
    <div className="card" style={{ position: "relative", overflow: "hidden", padding: "16px 18px" }}>
      {/* Glow ambiant — vert si proche du PR, orange/rouge sinon */}
      <div style={{
        position: "absolute", right: -34, top: -34, width: 150, height: 150, borderRadius: "50%",
        background: `radial-gradient(circle, ${statusColor}26 0%, transparent 70%)`, pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--c-text-3)" }} className="truncate">{disc}</p>
        </div>
        <button onClick={onSeeEvolution}
          style={{ fontSize: 10.5, fontWeight: 600, color: col, background: "none", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
          Évolution <ChevronRight size={11} />
        </button>
      </div>

      <p style={{ position: "relative", fontSize: 34, fontWeight: 700, color: "var(--c-text-1)", letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {rec.pr ?? "—"}
      </p>
      <p style={{ position: "relative", fontSize: 9, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-4)", marginTop: 5 }}>
        Record personnel
      </p>

      <p style={{ position: "relative", fontSize: 12.5, color: "var(--c-text-3)", marginTop: 12 }}>
        SB saison <strong style={{ color: "var(--c-text-2)", fontWeight: 600 }}>{rec.sb ?? "—"}</strong>
      </p>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, height: 3, background: "var(--c-surface-3)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct ?? 0}%`, background: statusColor, borderRadius: 99, transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)" }} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, flexShrink: 0, minWidth: 30, textAlign: "right" }}>
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 9.5, color: "var(--c-text-4)" }}>
          {stats?.count > 0 ? `${stats.count} mesure${stats.count > 1 ? "s" : ""}` : ""}
        </span>
        {rec.prDate && (
          <span style={{ fontSize: 9.5, color: "var(--c-text-4)" }}>
            {new Date(rec.prDate).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Barre de progression PR → objectif ──────────────────────────────────────
export function GoalProgressBar({ pr, target, color }) {
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
