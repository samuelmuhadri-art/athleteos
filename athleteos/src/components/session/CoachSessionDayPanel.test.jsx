import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CoachSessionDayPanel from "./CoachSessionDayPanel";

const session = {
  id: 12,
  title: "Vitesse",
  lifecycleStatus: "live",
  athleteIds: [1, 2],
  validations: [
    { athleteId: 1, status: "done", rpe: 8, actualDurationMinutes: 60, durationSource: "reported" },
    { athleteId: 2, rsvpStatus: "unavailable", rsvpNote: "J’ai un rendez-vous médical." },
  ],
};
const athletes = [
  { id: 1, name: "Alice Martin", avatar: "AM" },
  { id: 2, name: "Noah Dupont", avatar: "ND" },
];

afterEach(cleanup);

describe("CoachSessionDayPanel", () => {
  it("résume la séance et affiche les réponses de présence des athlètes", () => {
    render(<CoachSessionDayPanel session={session} athletes={athletes}
      onSetCoachNote={vi.fn()} onSetLifecycle={vi.fn()} onRemindFeedback={vi.fn()} />);

    expect(screen.getByText("Séance en cours")).toBeTruthy();
    expect(screen.getByText("480")).toBeTruthy();
    expect(screen.getByText("« J’ai un rendez-vous médical. »")).toBeTruthy();
  });

  it("clôture la séance et permet de rappeler les retours manquants", async () => {
    const onSetLifecycle = vi.fn().mockResolvedValue(undefined);
    const onRemindFeedback = vi.fn().mockResolvedValue(undefined);
    render(<CoachSessionDayPanel session={session} athletes={athletes}
      onSetCoachNote={vi.fn()} onSetLifecycle={onSetLifecycle} onRemindFeedback={onRemindFeedback} />);

    fireEvent.click(screen.getByRole("button", { name: /Clôturer/ }));
    await waitFor(() => expect(onSetLifecycle).toHaveBeenCalledWith(12, "completed"));
    fireEvent.click(screen.getByRole("button", { name: /Rappeler/ }));
    await waitFor(() => expect(onRemindFeedback).toHaveBeenCalledWith(session));
  });
});
