// ============================================================
// AthleteOS — src/components/ui/LoadingState.jsx
// Squelette de chargement réutilisable (remplace l'ancien spinner).
// Générique à dessein : hero + rangée de KPI + grille de cards, la
// forme la plus fréquente dans l'app (Dashboard, AthleteList,
// Competitions, ChargeView…) — donne l'impression que le contenu
// "apparaît" plutôt que de fixer un rond qui tourne.
//
// Usage :
//   import LoadingState from "../components/ui/LoadingState";
//   if (loading) return <LoadingState message="Chargement des athlètes…" />;
// ============================================================

import { memo } from "react";

function Block({ style }) {
  return <div className="skeleton" style={style} />;
}

function LoadingState({ message = "Chargement…" }) {
  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{message}</span>

      {/* Hero */}
      <Block style={{ height: 128, borderRadius: "var(--r-xl)" }} />

      {/* Rangée de KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} style={{ height: 84, borderRadius: "var(--r-lg)" }} />
        ))}
      </div>

      {/* Grille de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} style={{ height: 112, borderRadius: "var(--r-lg)" }} />
        ))}
      </div>
    </div>
  );
}

export default memo(LoadingState);
