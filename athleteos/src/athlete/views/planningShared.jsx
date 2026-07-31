// ============================================================
// AthleteOS — src/athlete/views/planningShared.js
// Constantes et petits composants partagés entre AthletePlanning.jsx,
// CreateSessionModal.jsx et SessionDetailModal.jsx — évite de les
// dupliquer dans chacun.
// ============================================================

// ─── Palette catégories — accents vifs + fond rgba dark-safe ────────────────
const CAT_COLORS_RAW = {
  sprint:       "#5B9EF5",
  haies:        "#A78BFA",
  force:        "#34D399",
  saut:         "#C084FC",
  lancer:       "#FB923C",
  endurance:    "#38BDF8",
  technique:    "#94A3B8",
  mobilite:     "#EAB308",
  recuperation: "#64748B",
};
export function cat(key) {
  const border = CAT_COLORS_RAW[key] ?? CAT_COLORS_RAW.technique;
  return {
    border,
    text: border,
    bg: `${border}1F`,   // ~12% opacité — fond doux sur dark
    glow: `${border}33`, // ~20% opacité — pour box-shadow
  };
}

// ─── Helper : badge statut ────────────────────────────────────────────────────
export function StatusBadge({ status, size = "sm" }) {
  const cfg = {
    done:    { label: "Réalisée",  bg: "rgba(61,190,139,0.16)",  color: "var(--tone-success)", dot: "#3DBE8B" },
    partial: { label: "Partielle", bg: "rgba(234,179,8,0.16)",   color: "var(--tone-warning)", dot: "#EAB308" },
    none:    { label: "Absent",    bg: "rgba(239,107,107,0.16)", color: "var(--tone-danger)", dot: "#EF6B6B" },
    future:  { label: "Prévue",    bg: "var(--c-surface-3)",     color: "var(--c-text-3)", dot: "#5B9EF5" },
  };
  const s = cfg[status] ?? cfg.future;
  const px = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full ${px}`}
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── RPE : couleur progressive ────────────────────────────────────────────────
export function rpeColor(i) {
  if (i <= 3) return { active: "#22C55E", border: "#16A34A", text: "#0A150F" };
  if (i <= 6) return { active: "#F59E0B", border: "#D97706", text: "#0A150F" };
  return          { active: "#EF4444", border: "#DC2626", text: "#0A150F" };
}
