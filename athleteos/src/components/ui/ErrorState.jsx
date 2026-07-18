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
      <div className="bg-red-50 border border-red-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-red-800 mb-1">
              Impossible de charger les données
            </h3>
            <p className="text-[12px] text-red-600">{message}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-[12px] font-medium hover:bg-red-200 transition-colors flex-shrink-0"
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