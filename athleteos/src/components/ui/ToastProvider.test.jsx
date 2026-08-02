import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ToastProvider from "./ToastProvider";
import { useToast } from "../../hooks/useToast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ToastHarness({ onRetry = () => {} }) {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success({ key: "saved", message: "La séance est enregistrée." })}>
        Enregistrer
      </button>
      <button type="button" onClick={() => {
        toast.info({ key: "first", title: "Première" });
        toast.info({ key: "second", title: "Deuxième" });
        toast.info({ key: "third", title: "Troisième" });
        toast.info({ key: "fourth", title: "Quatrième" });
      }}>
        Remplir la file
      </button>
      <button type="button" onClick={() => toast.error({
        key: "network-error",
        message: "La connexion a échoué.",
        action: { label: "Réessayer", onClick: onRetry },
      })}>
        Provoquer une erreur
      </button>
    </div>
  );
}

function renderHarness(props) {
  return render(
    <ToastProvider>
      <ToastHarness {...props} />
    </ToastProvider>,
  );
}

describe("ToastProvider", () => {
  it("annonce un succès, déduplique les répétitions et le masque automatiquement", () => {
    vi.useFakeTimers();
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("La séance est enregistrée.")).toBeVisible();
    expect(screen.getByLabelText("Répété 2 fois")).toHaveTextContent("×2");

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByText("La séance est enregistrée.")).not.toBeInTheDocument();
  });

  it("affiche au maximum trois notifications puis fait avancer la file", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "Remplir la file" }));

    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.queryByText("Quatrième")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Fermer la notification" })[0]);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.getByText("Quatrième")).toBeVisible();
  });

  it("conserve les erreurs, expose une action et permet de les fermer", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    renderHarness({ onRetry });

    fireEvent.click(screen.getByRole("button", { name: "Provoquer une erreur" }));
    expect(screen.getByRole("alert")).toHaveTextContent("La connexion a échoué.");

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("alert")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
