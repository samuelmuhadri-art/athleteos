import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettingsModal from "./AccountSettingsModal";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "coach-1", email: "coach@club.be" },
    profile: { id: "coach-1", name: "Coach Martin", role: "head_coach" },
    clubId: "club-1",
  }),
}));

vi.mock("../../utils/supabaseClient", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: { updateUser: mocks.updateUser },
    from: mocks.from,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.invoke.mockResolvedValue({ data: { success: true, inviteCode: "NEWCODE1" }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table) => {
    if (table === "clubs") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { name: "Athletic Club", invite_code: "OLDCODE1" }, error: null }),
          }),
        }),
      };
    }
    return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
  });
});

afterEach(cleanup);

describe("AccountSettingsModal", () => {
  it("ouvre directement l’identité du club et enregistre une couleur contrôlée", async () => {
    const onClubUpdated = vi.fn();
    render(<AccountSettingsModal onClose={vi.fn()} initialSection="club" onClubUpdated={onClubUpdated} />);

    expect(screen.getByRole("tab", { name: "Club" }).getAttribute("aria-selected")).toBe("true");
    await screen.findByText("Identité visuelle");
    fireEvent.click(screen.getByRole("radio", { name: "Bleu performance" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’identité" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("admin-actions", {
      body: expect.objectContaining({ action: "update_club_branding", accentColor: "#378ADD" }),
    }));
    expect(onClubUpdated).toHaveBeenCalledOnce();
  });

  it("sépare Compte et Club et confirme avant d'invalider le code", async () => {
    render(<AccountSettingsModal onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Réglages" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Compte" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Club" }));
    expect(await screen.findByText("OLDCODE1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Générer un nouveau code" }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.getByText("L’ancien code sera invalidé immédiatement.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Générer le nouveau code" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("admin-actions", {
      body: expect.objectContaining({ action: "regenerate_invite_code" }),
    }));
    expect(await screen.findByText("NEWCODE1")).toBeTruthy();
  });
});
