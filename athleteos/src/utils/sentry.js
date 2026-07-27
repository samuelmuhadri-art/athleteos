// ============================================================
// AthleteOS — src/utils/sentry.js
// Monitoring d'erreurs en prod. Sans ça, un crash chez un
// athlète est invisible — la seule information disponible était
// un message verbal de l'utilisateur.
//
// Ne s'active que si VITE_SENTRY_DSN est renseigné (créer un
// projet gratuit sur sentry.io, coller le DSN dans .env en local
// ET dans les variables d'environnement du projet sur Vercel).
// Tant que le DSN est vide, tout ceci est un no-op silencieux.
// ============================================================

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;

export const sentryEnabled = !!DSN;

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export function captureError(error, context) {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
