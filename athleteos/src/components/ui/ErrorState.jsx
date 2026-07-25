// ============================================================
// AthleteOS — src/components/ui/ErrorState.jsx
// Bloc d'erreur réutilisable.
// Remplace tous les blocs if (error) {...} dupliqués.
//
// Usage :
//   import ErrorState from "../components/ui/ErrorState";
//   if (error) return <ErrorState message={error} onRetry={fetchAll} />;
// ============================================================

import { memo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

function ErrorState({ message = "Une erreur est survenue.", onRetry }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div
        className="rounded-xl p-5"
        style={{ background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.20)" }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: "var(--c-dim-danger)" }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold mb-1" style={{ color: "var(--c-text-1)" }}>
              Impossible de charger les données
            </h3>
            <p className="text-[12px]" style={{ color: "var(--c-text-2)" }}>{message}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 hover:bg-[rgba(224,82,82,0.22)]"
              style={{ background: "rgba(224,82,82,0.14)", color: "var(--c-dim-danger)" }}
            >
              <RefreshCw size={13} />
              Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ErrorState);