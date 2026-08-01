const CATEGORY_COLORS = {
  sprint: "#5B9EF5",
  haies: "#A78BFA",
  force: "#34D399",
  saut: "#C084FC",
  lancer: "#FB923C",
  endurance: "#38BDF8",
  technique: "#94A3B8",
  mobilite: "#EAB308",
  recuperation: "#64748B",
};

export function cat(key) {
  const border = CATEGORY_COLORS[key] ?? CATEGORY_COLORS.technique;
  return {
    border,
    text: border,
    bg: `${border}1F`,
    glow: `${border}33`,
  };
}

export function rpeColor(value) {
  if (value <= 3) return { active: "#22C55E", border: "#16A34A", text: "#0A150F" };
  if (value <= 6) return { active: "#F59E0B", border: "#D97706", text: "#0A150F" };
  return { active: "#EF4444", border: "#DC2626", text: "#0A150F" };
}
