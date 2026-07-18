// ============================================================
// AthleteOS — src/components/ui/Modal.jsx
// Modal générique réutilisable.
// Remplace tous les modals dupliqués dans chaque module.
//
// Usage :
//   import Modal from "../components/ui/Modal";
//
//   <Modal
//     title="Créer une alerte"
//     onClose={handleClose}
//     disabled={saving}
//     onConfirm={handleSubmit}
//     confirmLabel="Créer"
//     confirmDisabled={!form.title.trim() || saving}
//     loading={saving}
//     loadingLabel="Création…"
//   >
//     {/* contenu du formulaire */}
//   </Modal>
// ============================================================

import { memo } from "react";
import { X } from "lucide-react";

function Modal({
  title,
  onClose,
  onConfirm,
  confirmLabel  = "Confirmer",
  confirmDisabled = false,
  loading       = false,
  loadingLabel  = "Enregistrement…",
  disabled      = false,
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && !disabled && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-[16px] font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            disabled={disabled}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* ── Contenu (slot) ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {onConfirm && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={disabled}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#1D9E75" }}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Modal);