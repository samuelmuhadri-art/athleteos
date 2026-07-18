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
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-[13px] font-medium">{message}</p>
      </div>
    </div>
  );
}

export default memo(LoadingState);