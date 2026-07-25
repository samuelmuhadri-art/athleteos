// ============================================================
// AthleteOS — src/components/ui/LoadingState.jsx
// Spinner de chargement réutilisable.
// Remplace tous les blocs if (loading) {...} dupliqués.
//
// Usage :
//   import LoadingState from "../components/ui/LoadingState";
//   if (loading) return <LoadingState message="Chargement des athlètes…" />;
// ============================================================

import { memo } from "react";

function LoadingState({ message = "Chargement…" }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <div className="flex flex-col items-center gap-3" style={{ color: "var(--c-text-3)" }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--c-surface-3)", borderTopColor: "var(--c-accent)" }} />
        <p className="text-[13px] font-medium">{message}</p>
      </div>
    </div>
  );
}

export default memo(LoadingState);