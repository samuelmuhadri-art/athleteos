import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ClubOnboardingCard from "./ClubOnboardingCard";
import InviteClubModal from "./InviteClubModal";

afterEach(cleanup);

describe("ClubOnboardingCard", () => {
  it("affiche une progression honnête et conserve toutes les actions", () => {
    const onBranding = vi.fn();
    const onInvite = vi.fn();
    const onPlanning = vi.fn();
    const onDemo = vi.fn();
    render(
      <ClubOnboardingCard
        club={{ name: "Club ami", logoPath: null }}
        athleteCount={2}
        sessionCount={0}
        onBranding={onBranding}
        onInvite={onInvite}
        onPlanning={onPlanning}
        onDemo={onDemo}
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("60");
    expect(screen.getByText("60 %")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Découvrir avec un exemple" }));
    fireEvent.click(screen.getByRole("button", { name: "Personnaliser" }));
    expect(onDemo).toHaveBeenCalledOnce();
    expect(onBranding).toHaveBeenCalledOnce();
  });
});

describe("InviteClubModal", () => {
  it("génère le QR code et un lien prérempli sans service externe", () => {
    render(<InviteClubModal clubName="Club ami" inviteCode="AB12CD34" onClose={vi.fn()} />);

    expect(screen.getByTitle("QR code pour rejoindre Club ami")).toBeTruthy();
    const inviteLink = screen.getByLabelText("Lien direct d’invitation").value;
    expect(inviteLink).toContain("invite=AB12CD34");
    expect(inviteLink).toContain(globalThis.location.origin);
  });

  it("garde le clavier dans le dialogue et se ferme avec Échap", () => {
    const onClose = vi.fn();
    render(<InviteClubModal clubName="Club ami" inviteCode="AB12CD34" onClose={onClose} />);

    expect(screen.getByRole("button", { name: "Fermer l’invitation" })).toHaveFocus();
    fireEvent.keyDown(globalThis, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
