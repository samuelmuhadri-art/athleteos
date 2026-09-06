const MIN_SUBMIT_MS = 1500;

// Ces deux formats restent des signaux déclarés par le client, pas une preuve
// cryptographique d'humanité. Quotas, honeypot et validations serveur restent requis.
export function signupFormProblem(body: Record<string, unknown>, serverNow = Date.now()) {
  if (typeof body.company === "string" && body.company.trim() !== "") return "form_verification_failed";
  if (Object.hasOwn(body, "formElapsedMs")) {
    const elapsed = body.formElapsedMs;
    if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) return "form_timing_invalid";
    return elapsed < MIN_SUBMIT_MS ? "form_too_fast" : null;
  }
  // Compatibilité des PWA déjà installées. Une nouvelle propriété invalide
  // n'est jamais contournée en retombant sur l'ancien timestamp.
  const loadedAt = body.formLoadedAt;
  if (typeof loadedAt !== "number" || !Number.isFinite(loadedAt) || loadedAt <= 0 || loadedAt > serverNow) return "form_timing_invalid";
  return serverNow - loadedAt < MIN_SUBMIT_MS ? "form_too_fast" : null;
}
