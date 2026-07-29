import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
}

/**
 * Cycle de vie accessible commun aux dialogues AthleteOS : focus initial,
 * focus piégé, fermeture par Échap, verrouillage du fond et restauration.
 */
export function useModalAccessibility({ dialogRef, initialFocusRef, onClose, enabled = true }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const initialTarget = initialFocusRef?.current
      ?? getFocusableElements(dialogRef.current)[0]
      ?? dialogRef.current;
    initialTarget?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialogRef.current);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus?.();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [dialogRef, enabled, initialFocusRef]);
}
