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

    expect(screen.getAllByText("Technique du soir").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: /voir ma séance/i }));
    expect(screen.getByText("Séance ouverte : Technique du soir")).toBeTruthy();
  }, 10_000);

  it("place la séance en priorité tout en gardant le check-in accessible", () => {
    const props = renderDashboard({ wellnessToday: null });

    expect(screen.getByText("Séance du jour")).toBeTruthy();
    expect(screen.getByText("1/2 traitées")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /ton check-in.*30 secondes/i }));
    expect(props.onOpenWellness).toHaveBeenCalledOnce();
  });

  it("montre l'action d'aujourd'hui avant les analyses et utilise un langage direct", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "Aujourd’hui" })).toBeTruthy();
    expect(screen.getByText("Une action prioritaire, puis les repères utiles de ta journée.")).toBeTruthy();
    expect(screen.getByText("Complète ton historique de charge")).toBeTruthy();
    expect(screen.queryByText("Tendances & progression")).toBeNull();
  });

  it("affiche les 5 jauges de charge d'entraînement et ouvre le détail au tap", () => {
    renderDashboard();

    ["Charge semaine", "Forme", "Condition physique", "Préparation", "Fatigue"].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
    expect(screen.queryByTestId("metric-panel")).toBeNull();
    fireEvent.click(screen.getByText("Fatigue"));
    expect(screen.getByTestId("metric-panel")).toBeTruthy();
  });

  it("place Aujourd’hui et Ma semaine avant le contenu pédagogique", () => {
    renderDashboard();
    const todayHeading = screen.getByRole("heading", { name: "Aujourd’hui" });
    const weekHeading = screen.getByRole("heading", { name: "Ma semaine" });
    const educationalHeading = screen.getByRole("heading", { name: "Mieux comprendre ta journée" });
    expect(todayHeading.compareDocumentPosition(weekHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weekHeading.compareDocumentPosition(educationalHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("retire toute gamification sans laisser de trou quand l’outil est désactivé", () => {
    renderDashboard({ modules: { gamification: false } });
    expect(screen.queryByText("Badges")).toBeNull();
    expect(screen.queryByText(/badge Maestro/i)).toBeNull();
    expect(screen.getByText("1/10 semaines")).toBeTruthy();
  });

  it("résume les badges sans afficher une collection sur l’accueil", () => {
    renderDashboard({ modules: { gamification: true } });
    expect(screen.getByRole("button", { name: "Voir la progression et les badges" })).toBeTruthy();
    expect(screen.getByText(/Progression · \d+ badge/)).toBeTruthy();
    expect(screen.queryByText("Premier pas")).toBeNull();
  });

  it("compose un dashboard Planning + Messages sans sections étrangères", () => {
    renderDashboard({
      modules: {
        planning: true, messaging: true, performances: false, session_feedback: false,
        wellness: false, training_load: false, health: false, social: false,
        reports: false, gamification: false,
      },
      lastMessages: [{ id: 1, content: "Séance décalée à 18 h", created_at: NOW.toISOString() }],
    });
    expect(screen.getByRole("heading", { name: "Aujourd’hui" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ma semaine" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /a envoyé un message/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mieux comprendre ta journée" })).toBeNull();
    expect(screen.queryByText("Badges")).toBeNull();
  });

  it("met en évidence la prochaine compétition quand elle existe", () => {
    renderDashboard({
      competitions: [{ id: 1, name: "Meeting de Bruxelles", date: "2026-09-12", location: "Bruxelles", athleteIds: ["athlete-1"], plannedEvents: { "athlete-1": "100 m" } }],
    });
    expect(screen.getByRole("heading", { name: "Meeting de Bruxelles" })).toBeTruthy();
    expect(screen.getByText("100 m")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Meeting de Bruxelles" }).className).toContain("athlete-next-event");
  });
});
