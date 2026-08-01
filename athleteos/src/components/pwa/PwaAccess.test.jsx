import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PwaInstallProvider } from "../../context/PwaInstallContext";
import PwaAccessCard, { PwaInstallButton } from "./PwaAccess";

function renderAccess() {
  return render(
    <PwaInstallProvider>
      <PwaInstallButton />
      <PwaAccessCard />
    </PwaInstallProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PwaAccess", () => {
  it("propose l’installation quand le navigateur émet beforeinstallprompt", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event("beforeinstallprompt");
    Object.defineProperties(installEvent, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
    });

    renderAccess();
    act(() => window.dispatchEvent(installEvent));

    const buttons = await screen.findAllByRole("button", { name: /Installer/i });
    fireEvent.click(buttons.at(-1));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(await screen.findByText(/bien été ajouté/i)).toBeTruthy();
  });

  it("copie le lien quand le partage natif n’est pas disponible", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { userAgent: "Desktop", clipboard: { writeText } });
    renderAccess();

    fireEvent.click(screen.getByRole("button", { name: "Partager AthleteOS" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.origin));
    expect(screen.getByText("Le lien AthleteOS a été copié.")).toBeTruthy();
  });
});
