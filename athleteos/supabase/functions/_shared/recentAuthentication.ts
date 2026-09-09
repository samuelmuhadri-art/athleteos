// Call only AFTER Auth has verified the bearer token with getUser().
// iat is deliberately ignored: refreshing a token is not reauthentication.
export function hasRecentPasswordAuthentication(token: string, now = Date.now()): boolean {
  try {
    const encoded = token.replace(/^Bearer\s+/i, "").split(".")[1];
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return Array.isArray(claims.amr) && claims.amr.some((entry: { method?: string; timestamp?: number }) => {
      if (entry?.method !== "password" || typeof entry.timestamp !== "number") return false;
      const age = now / 1000 - entry.timestamp;
      return age >= -30 && age <= 300;
    });
  } catch { return false; }
}
