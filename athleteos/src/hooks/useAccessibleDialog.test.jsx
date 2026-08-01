import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useAccessibleDialog } from "./useAccessibleDialog";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function DialogHarness({ onClose, closeDisabled = false }) {
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, closeDisabled });
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId}>Fenêtre de test</h2>
      <button type="button">Premier</button>
      <button type="button">Dernier</button>
    </div>
  );
}

describe("useAccessibleDialog", () => {
  it("focalise le dialogue, piège Tab et restaure le focus", async () => {
    vi.useFakeTimers();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(<DialogHarness onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Fenêtre de test" });
    const [first, last] = within(dialog).getAllByRole("button");
    await act(() => vi.runOnlyPendingTimers());
    expect(first).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    trigger.remove();
  });

  it("ferme avec Échap sauf pendant une opération bloquante", () => {
    const onClose = vi.fn();
    const { rerender } = render(<DialogHarness onClose={onClose} closeDisabled />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    rerender(<DialogHarness onClose={onClose} closeDisabled={false} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
