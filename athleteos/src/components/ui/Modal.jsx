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

import { memo, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!disabled) onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  return (
    <div
      className="modal-backdrop modal-safe-inset fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !disabled && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-content rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden"
        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
      >

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <h3 id={titleId} className="text-[16px] font-bold" style={{ color: "var(--c-text-1)" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label={`Fermer — ${title}`}
            className="w-11 h-11 -mr-2 inline-flex items-center justify-center flex-shrink-0 rounded-xl transition-colors disabled:opacity-40 hover:bg-[var(--c-surface-3)]"
          >
            <X size={18} style={{ color: "var(--c-text-3)" }} />
          </button>
        </div>

        {/* ── Contenu (slot) ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 overscroll-contain">
          {children}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {onConfirm && (
          <div
            className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
            style={{ borderTop: "1px solid var(--c-border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="min-h-11 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-40 hover:bg-[var(--c-surface-3)]"
              style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled || disabled}
              className="min-h-11 flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#1D9E75" }}
            >
              {loading ? (
                <>
                  <div aria-hidden="true" className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
