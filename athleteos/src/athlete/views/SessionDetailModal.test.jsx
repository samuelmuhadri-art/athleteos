import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SessionDetailModal from "./SessionDetailModal";

afterEach(cleanup);

describe("SessionDetailModal", () => {
  it("sépare la réponse avant séance du retour après séance et transmet le message", async () => {
    const onSetRsvp = vi.fn();
    const athlete = { id: 1, name: "Alice", avatar: "A" };
    const session = {
      id: 9, title: "Vitesse", category: "sprint", sessionDate: "2099-08-02", time: "18:00",
      lifecycleStatus: "planned", durationMinutes: 60, athleteIds: [1],
      validations: [{ athleteId: 1, status: null, rsvpStatus: null }],
    };
    render(<SessionDetailModal session={session} athlete={athlete} allAthletes={[athlete]}
      onClose={vi.fn()} onSetStatus={vi.fn()} onSetRpe={vi.fn()} onSetFeeling={vi.fn()}
      onSetComment={vi.fn()} onSetRsvp={onSetRsvp} />);

    expect(screen.getByText("Seras-tu présent ?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Je ne peux pas venir" }));
    fireEvent.change(screen.getByLabelText(/Un message pour ton coach/), { target: { value: "Je suis chez le kiné." } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer ma réponse" }));
    expect(onSetRsvp).toHaveBeenCalledWith(9, 1, "unavailable", "Je suis chez le kiné.");
    expect(screen.getByText("Après la séance")).toBeTruthy();
  });
});
