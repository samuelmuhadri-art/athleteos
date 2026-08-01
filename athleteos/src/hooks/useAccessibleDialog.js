import { useId, useRef } from "react";
import { useModalAccessibility } from "./useModalAccessibility";

/**
 * Shared keyboard and focus behaviour for the app's specialised dialogs.
 * The caller keeps control of the markup so existing layouts remain intact.
 */
export function useAccessibleDialog({ onClose, closeDisabled = false, enabled = true }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  useModalAccessibility({ dialogRef, onClose, closeDisabled, enabled });

  return { dialogRef, titleId };
}
