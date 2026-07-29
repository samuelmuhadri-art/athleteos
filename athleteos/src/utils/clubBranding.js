export const DEFAULT_CLUB_ACCENT = "#1D9E75";

export const CLUB_ACCENT_PRESETS = Object.freeze([
  { value: "#1D9E75", label: "Émeraude" },
  { value: "#378ADD", label: "Bleu performance" },
  { value: "#7C67C8", label: "Violet technique" },
  { value: "#C8890A", label: "Or compétition" },
  { value: "#D85D76", label: "Framboise" },
  { value: "#D66B2C", label: "Orange énergie" },
]);

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export function normalizeClubAccent(value, fallback = DEFAULT_CLUB_ACCENT) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : fallback;
}

export function hexToRgb(value) {
  const normalized = normalizeClubAccent(value);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function darkenHex(value, amount = 0.16) {
  const { r, g, b } = hexToRgb(value);
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const channel = (part) => Math.round(part * factor).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

export function getClubThemeVariables(accentColor) {
  const accent = normalizeClubAccent(accentColor);
  const { r, g, b } = hexToRgb(accent);
  return {
    "--club-accent": accent,
    "--club-accent-rgb": `${r}, ${g}, ${b}`,
    "--color-accent": accent,
    "--color-accent-strong": darkenHex(accent),
    "--c-accent-light": `rgba(${r}, ${g}, ${b}, 0.15)`,
    "--c-accent-glow": `rgba(${r}, ${g}, ${b}, 0.20)`,
  };
}

export function buildInviteUrl(inviteCode, origin = globalThis.location?.origin) {
  if (!inviteCode || !origin) return "";
  const url = new URL("/", origin);
  url.searchParams.set("invite", String(inviteCode).trim().toUpperCase());
  return url.toString();
}

export function buildClubSetupSteps({ club, athleteCount = 0, sessionCount = 0 }) {
  return [
    {
      id: "brand",
      label: "Ajouter le logo du club",
      description: "Personnalise l’espace pour que les membres reconnaissent immédiatement leur club.",
      complete: Boolean(club?.logoPath),
      action: "branding",
    },
    {
      id: "identity",
      label: "Vérifier l’identité du club",
      description: "Confirme le nom et choisis une couleur d’accent discrète.",
      complete: Boolean(club?.name?.trim()),
      action: "branding",
    },
    {
      id: "athletes",
      label: "Inviter les premiers athlètes",
      description: "Partage le lien, le QR code ou importe une liste CSV.",
      complete: athleteCount > 0,
      action: "invite",
    },
    {
      id: "session",
      label: "Créer la première séance",
      description: "Une première séance suffit pour donner vie au planning.",
      complete: sessionCount > 0,
      action: "planning",
    },
    {
      id: "dashboard",
      label: "Consulter le tableau de bord",
      description: "Tu es ici : AthleteOS est prêt à guider la suite.",
      complete: true,
      action: null,
    },
  ];
}

export function getClubSetupProgress(steps) {
  if (!steps?.length) return 0;
  return Math.round((steps.filter((step) => step.complete).length / steps.length) * 100);
}
