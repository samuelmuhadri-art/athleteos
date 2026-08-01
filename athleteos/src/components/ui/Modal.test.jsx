import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Modal from "./Modal";

afterEach(cleanup);

describe("Modal", () => {
  it("annonce le dialogue, gère Échap et restaure le focus", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <Modal title="Créer une alerte" onClose={onClose}>
        <input aria-label="Titre de l’alerte" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Créer une alerte" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await act(() => vi.runOnlyPendingTimers());
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
    vi.useRealTimers();
  });

  it("piège le focus et bloque Échap pendant une sauvegarde", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Modifier" onClose={onClose} onConfirm={vi.fn()} disabled loading>
        <input aria-label="Nom" />
      </Modal>,
    );

    const field = screen.getByRole("textbox", { name: "Nom" });
    const confirm = screen.getByRole("button", { name: /Enregistrement/ });
    field.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(field).toHaveFocus();
    expect(confirm).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
