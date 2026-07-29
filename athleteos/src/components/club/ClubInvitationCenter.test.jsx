import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClubInvitationCenter from "./ClubInvitationCenter";

const existingInvitation = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  code: "ABCD2345",
  recipientName: "Alice Martin",
  recipientEmail: "alice@club.be",
  status: "opened",
  createdAt: "2026-07-29T10:00:00Z",
  expiresAt: "2026-08-05T10:00:00Z",
  openedAt: "2026-07-29T11:00:00Z",
  acceptedAt: null,
};

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(cleanup);

describe("ClubInvitationCenter", () => {
  it("affiche le suivi et crée une invitation individuelle", async () => {
    const created = { ...existingInvitation, id: "223e4567-e89b-42d3-a456-426614174000", code: "WXYZ6789", recipientName: "Noah", recipientEmail: null, status: "sent" };
    const callAdmin = vi.fn(async (payload) => {
      if (payload.action === "list_club_invitations") return { invitations: [existingInvitation] };
      if (payload.action === "create_club_invitation") return { invitation: created };
      return {};
    });
    render(<ClubInvitationCenter callAdmin={callAdmin} clubName="Club ami" />);

    expect((await screen.findAllByText("Alice Martin")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ouverte").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Ex. Alice Martin"), { target: { value: "Noah" } });
    fireEvent.change(screen.getByLabelText(/Durée de validité/i), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer l’invitation" }));

    await waitFor(() => expect(callAdmin).toHaveBeenCalledWith(expect.objectContaining({
      action: "create_club_invitation",
      recipientName: "Noah",
      expiresInDays: 14,
    })));
    expect(await screen.findByText("Invitation individuelle prête à être envoyée.")).toBeTruthy();
    expect(screen.getByTitle("QR code invitation WXYZ6789")).toBeTruthy();
  });

  it("demande confirmation avant de révoquer le lien", async () => {
    const callAdmin = vi.fn(async (payload) => (
      payload.action === "list_club_invitations" ? { invitations: [existingInvitation] } : {}
    ));
    render(<ClubInvitationCenter callAdmin={callAdmin} clubName="Club ami" />);
    await screen.findAllByText("Alice Martin");

    fireEvent.click(screen.getByRole("button", { name: "Révoquer cette invitation" }));
    expect(callAdmin).not.toHaveBeenCalledWith(expect.objectContaining({ action: "revoke_club_invitation" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    await waitFor(() => expect(callAdmin).toHaveBeenCalledWith(expect.objectContaining({
      action: "revoke_club_invitation",
      invitationId: existingInvitation.id,
    })));
    expect(await screen.findByText(/Invitation révoquée/)).toBeTruthy();
  });
});
