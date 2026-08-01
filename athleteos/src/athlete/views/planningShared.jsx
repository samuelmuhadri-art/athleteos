export function StatusBadge({ status, size = "sm" }) {
  const config = {
    done: { label: "Réalisée", bg: "rgba(61,190,139,0.16)", color: "var(--tone-success)", dot: "#3DBE8B" },
    partial: { label: "Partielle", bg: "rgba(234,179,8,0.16)", color: "var(--tone-warning)", dot: "#EAB308" },
    none: { label: "Absent", bg: "rgba(239,107,107,0.16)", color: "var(--tone-danger)", dot: "#EF6B6B" },
    future: { label: "Prévue", bg: "var(--c-surface-3)", color: "var(--c-text-3)", dot: "#5B9EF5" },
  };
  const badge = config[status] ?? config.future;
  const spacing = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full ${spacing}`}
      style={{ background: badge.bg, color: badge.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.dot }} />
      {badge.label}
    </span>
  );
}
