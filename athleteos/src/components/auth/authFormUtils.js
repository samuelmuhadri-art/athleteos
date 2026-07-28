const AUTH_ERROR_MESSAGES = Object.freeze({
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed": "Confirme ton adresse email avant de te connecter.",
  "User already registered": "Un compte existe déjà avec cette adresse email.",
  "Password should be at least 6 characters": "Choisis un mot de passe d’au moins 8 caractères.",
  "Failed to fetch": "Connexion impossible. Vérifie ton réseau puis réessaie.",
});

export function translateAuthError(error, fallback = "Une erreur est survenue. Réessaie dans un instant.") {
  const message = typeof error === "string" ? error : error?.message;
  if (!message) return fallback;
  return AUTH_ERROR_MESSAGES[message] ?? message;
}

export function getPasswordStrength(password = "") {
  if (!password) return { score: 0, label: "", tone: "" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: "Mot de passe fragile", tone: "weak" };
  if (score === 2) return { score: 2, label: "Mot de passe correct", tone: "fair" };
  if (score === 3) return { score: 3, label: "Bon mot de passe", tone: "good" };
  return { score: 4, label: "Mot de passe robuste", tone: "strong" };
}
