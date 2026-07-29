import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AthleteDashboard from "./views/AthleteDashboard";
import { getISOWeek } from "./shared";

vi.mock("../components/ui/AxisRadarCard", () => ({ default: () => <div data-testid="axis-radar" /> }));
vi.mock("./components/FormeDetailPanel", () => ({ default: () => <div data-testid="metric-panel" /> }));
vi.mock("./views/AthletePlanning", () => ({
  SessionDetailModal: ({ session, onClose }) => (
    <div role="dialog">
      <span>{`Séance ouverte : ${session.title}`}</span>
      <button type="button" onClick={onClose}>Fermer</button>
    </div>
  ),
}));

const NOW = new Date("2026-07-29T10:00:00+02:00");
const today = "2026-07-29";

function makeSession(id, title, time, status) {
  return {
    id, title, time, sessionDate: today, week: getISOWeek(NOW), category: "sprint",
    durationMinutes: 60, athleteIds: ["athlete-1"],
    validations: [{ athleteId: "athlete-1", status }],
  };
}

function renderDashboard(overrides = {}) {
  const props = {
    athlete: { id: "athlete-1", name: "Alicia Martin", records: {}, injuries: [], mainDiscipline: "400m" },
    weeklyCharge: [],
    sessions: [
      makeSession("morning", "Vitesse matinale", "09:00", "done"),
      makeSession("evening", "Technique du soir", "18:00", "future"),
    ],
    competitions: [], lastMessages: [], coachName: "Coach Martin", myPerformances: [],
    wellnessToday: { sleep: 4, energy: 4, soreness: 2, stress: 2, mood: 4 },
    onNavigate: vi.fn(), onOpenWellness: vi.fn(), onOpenInjuryReport: vi.fn(),
    allAthletes: [], onRpeChange: vi.fn(), onStatusChange: vi.fn(),
    onFeelingChange: vi.fn(), onCommentChange: vi.fn(),
    ...overrides,
  };
  render(<AthleteDashboard {...props} />);
  return props;
}

describe("AthleteDashboard — plan du jour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal("requestAnimationFrame", callback => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", timer => clearTimeout(timer));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ouvre la première séance non traitée au lieu d'une séance déjà validée", () => {
    renderDashboard();

    expect(screen.getAllByText("Technique du soir")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /ouvrir la séance/i }));
    expect(screen.getByText("Séance ouverte : Technique du soir")).toBeTruthy();
  });

  it("place le wellness en priorité sans masquer la séance du jour", () => {
    const props = renderDashboard({ wellnessToday: null });

    expect(screen.getByText("Check-in du matin")).toBeTruthy();
    expect(screen.getByText("1/2 traitées")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /faire mon check-in/i }));
    expect(props.onOpenWellness).toHaveBeenCalledOnce();
  });
});
