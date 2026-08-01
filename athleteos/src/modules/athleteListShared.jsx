import { Trophy, Star } from "lucide-react";
import { getWellnessStatus } from "../utils/chargeCalculations";

export function StatusBadge({ wellnessScore }) {
  const status = getWellnessStatus(wellnessScore);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold shadow-sm"
      style={{ background: status.color, color: "#07110C" }}
    >
      {status.dot} {status.label}
    </span>
  );
}

export function ScoreRing({ value, color, label, size = 72 }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--c-surface-3)" strokeWidth="7" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{value}</text>
      </svg>
      <span className="meta-text font-semibold text-center leading-tight">{label}</span>
    </div>
  );
}

export function ValidationBadge({ status }) {
  const map = {
    done: { label: "Réalisée", bg: "rgba(61,190,139,0.15)", color: "var(--tone-success)", border: "rgba(61,190,139,0.3)" },
    partial: { label: "Partielle", bg: "rgba(234,179,8,0.15)", color: "var(--tone-warning)", border: "rgba(234,179,8,0.3)" },
    none: { label: "Non réalisée", bg: "rgba(239,107,107,0.15)", color: "var(--tone-danger)", border: "rgba(239,107,107,0.3)" },
    future: { label: "À venir", bg: "var(--c-surface-3)", color: "var(--c-text-3)", border: "transparent" },
  };
  const badge = map[status] ?? map.future;
  return (
    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
      {badge.label}
    </span>
  );
}

export function StarRow({ value, max = 5, color = "#EF9F27" }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, index) => (
        <Star key={index} size={11} fill={index < value ? color : "none"} color={index < value ? color : "var(--c-border-strong)"} />
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

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl shadow-lg px-3 py-2.5 text-[12px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
      <p className="font-bold mb-1" style={{ color: "var(--c-text-1)" }}>{label}</p>
      {payload.map(item => (
        <p key={item.dataKey} style={{ color: item.color }}>
          {item.name} : <strong>{typeof item.value === "number" ? item.value.toFixed(2) : item.value}</strong>
        </p>
      ))}
    </div>
  );
}
