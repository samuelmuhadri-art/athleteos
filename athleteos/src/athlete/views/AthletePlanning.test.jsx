import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AthletePlanning from "./AthletePlanning";

afterEach(cleanup);

describe("AthletePlanning", () => {
  it("utilise le sélecteur premium et affiche le compteur d'archives dans un badge", () => {
    const athlete = { id: "athlete-1", name: "Alice", avatar: "A" };
    const archivedSession = {
      id: "session-archive",
      title: "Séance archivée",
      type: "Sprint",
      category: "sprint",
      trainingFocus: "sprint_general",
      sessionDate: "2000-01-03",
      time: "10:00",
      durationMinutes: 60,
      athleteIds: [athlete.id],
      validations: [{ athleteId: athlete.id, status: "done", rpe: 5 }],
    };

    render(
      <AthletePlanning
        athlete={athlete}
        sessions={[archivedSession]}
        allAthletes={[athlete]}
        clubId="club-1"
        createdBy="user-1"
        coachUserId="coach-1"
        onRpeChange={vi.fn()}
        onStatusChange={vi.fn()}
        onFeelingChange={vi.fn()}
        onCommentChange={vi.fn()}
        onRsvpChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    const selector = screen.getByRole("radiogroup", { name: "Affichage du planning" });
    expect(selector).toHaveClass("aos-segmented-tabs", "w-full", "sm:w-auto");
    expect(within(selector).getAllByRole("radio")).toHaveLength(4);
    expect(within(selector).getByRole("radio", { name: "Semaine" })).toHaveAttribute("aria-checked", "true");

    const archives = within(selector).getByRole("radio", { name: "Archives, 1" });
    expect(archives.querySelector(".aos-segmented-tabs__badge")).toHaveTextContent("1");
    fireEvent.click(archives);

    expect(archives).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Séance archivée")).toBeVisible();
  });

  it("affiche uniquement les compétitions auxquelles l'athlète est inscrit", () => {
    const athlete = { id: "athlete-1", name: "Alice", avatar: "A" };
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    render(
      <AthletePlanning
        athlete={athlete}
        sessions={[]}
        competitions={[
          {
            id: "competition-visible",
            name: "Meeting de Bruxelles",
            date: dateKey,
            type: "objectif",
            athleteIds: [athlete.id],
            plannedEvents: { [athlete.id]: "100 m" },
          },
          {
            id: "competition-hidden",
            name: "Meeting non concerné",
            date: dateKey,
            type: "régional",
            athleteIds: ["athlete-2"],
          },
        ]}
        allAthletes={[athlete]}
        clubId="club-1"
        createdBy="user-1"
        coachUserId="coach-1"
        onRpeChange={vi.fn()}
        onStatusChange={vi.fn()}
        onFeelingChange={vi.fn()}
        onCommentChange={vi.fn()}
        onRsvpChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Compétition Meeting de Bruxelles" })).toBeVisible();
    expect(screen.queryByText("Meeting non concerné")).not.toBeInTheDocument();
  });
});
