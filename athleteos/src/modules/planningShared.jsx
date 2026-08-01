import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const STATUS_COLORS = {
  done: "#3DBE8B",
  partial: "#EAB308",
  none: "#EF6B6B",
};

export function StatusIcon({ status, size = 14 }) {
  if (status === "done") return <CheckCircle size={size} color={STATUS_COLORS.done} />;
  if (status === "partial") return <AlertTriangle size={size} color={STATUS_COLORS.partial} />;
  if (status === "none") return <XCircle size={size} color={STATUS_COLORS.none} />;
  return null;
}

export function ValidationBadge({ status }) {
  const map = {
    done: { label: "Réalisée", bg: "rgba(61,190,139,0.14)", color: "var(--tone-success)" },
    partial: { label: "Partielle", bg: "rgba(234,179,8,0.14)", color: "var(--tone-warning)" },
    none: { label: "Non réalisée", bg: "rgba(239,107,107,0.14)", color: "var(--tone-danger)" },
  };
  const badge = map[status] ?? { label: "À venir", bg: "var(--c-surface-3)", color: "var(--c-text-3)" };
  return (
    <span
      className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: badge.bg, color: badge.color }}
    >
      {badge.label}
    </span>
  );
}
