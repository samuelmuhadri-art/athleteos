// ============================================================
// AthleteOS — src/modules/athleteListShared.jsx
// Constantes et petits composants partagés entre AthleteList.jsx,
// AthleteProfile.jsx, AthleteProfileTabs.jsx, AthleteCard.jsx et les
// modales Add*Modal.jsx — évite de les dupliquer.
// ============================================================

import { Trophy, Activity, Dumbbell, HeartPulse, User, Star } from "lucide-react";
import { getStatusLabel } from "../utils/chargeCalculations";

export const TABS = [
  { id: "performances",  label: "Performances",      icon: Trophy     },
  { id: "charge",        label: "Charge & Forme",    icon: Activity   },
  { id: "entrainements", label: "Entraînements",     icon: Dumbbell   },
  { id: "blessures",     label: "Blessures",         icon: HeartPulse },
  { id: "profil",        label: "Profil",            icon: User       },
];

export const RADAR_KEYS = [
  { key: "speed",       label: "Vitesse"     },
  { key: "strength",    label: "Force"       },
  { key: "explosivity", label: "Explosivité" },
  { key: "endurance",   label: "Endurance"   },
  { key: "technique",   label: "Technique"   },
];

export const INJURY_STATUS_OPTIONS = ["actif", "en suivi", "chronique", "résolu"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}

export function acwrColor(v) { return v > 1.3 ? "#E24B4A" : v < 0.8 ? "#378ADD" : "#1D9E75"; }

// ─── Composants UI partagés ───────────────────────────────────────────────────

export function StatusBadge({ readiness, fatigue, acwr }) {
  const s = getStatusLabel(readiness, fatigue, acwr);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold shadow-sm"
      style={{ background: s.color, color: "#07110C" }}
    >
      {s.dot} {s.label}
    </span>
  );
}

export function ScoreRing({ value, color, label, size = 72 }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{value}</text>
      </svg>
      <span className="meta-text font-semibold text-center leading-tight">{label}</span>
    </div>
  );
}

export function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     bg: "rgba(61,190,139,0.15)", color: "#7BD8B4", border: "rgba(61,190,139,0.3)" },
    partial: { label: "Partielle",    bg: "rgba(234,179,8,0.15)",  color: "#F0CB61", border: "rgba(234,179,8,0.3)" },
    none:    { label: "Non réalisée", bg: "rgba(239,107,107,0.15)",color: "#F19A9A", border: "rgba(239,107,107,0.3)" },
    future:  { label: "À venir",      bg: "var(--c-surface-3)",    color: "var(--c-text-3)", border: "transparent" },
  };
  const b = map[status] ?? map.future;
  return (
    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
      {b.label}
    </span>
  );
}

export function StarRow({ value, max = 5, color = "#EF9F27" }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={11} fill={i < value ? color : "none"} color={i < value ? color : "var(--c-border-strong)"} />
      ))}
    </div>
  );
}

export function EmptySection({ icon: Icon = Trophy, title, sub }) {
  return (
    <div className="card p-12 text-center">
      <Icon size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--c-text-3)" }} />
      <p className="text-[13.5px] font-bold" style={{ color: "var(--c-text-2)" }}>{title}</p>
      {sub && <p className="text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>{sub}</p>}
    </div>
  );
}

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl shadow-lg px-3 py-2.5 text-[12px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
      <p className="font-bold mb-1" style={{ color: "var(--c-text-1)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Inputs partagés ──────────────────────────────────────────────────────────
export const inputCls = "input-premium";
export const labelCls = "block text-[12px] font-bold uppercase tracking-wide mb-1.5";
