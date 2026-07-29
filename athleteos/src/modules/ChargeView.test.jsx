import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChargeView from "./ChargeView.jsx";
import { getISOWeek } from "../utils/helpers.js";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rows: {},
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ clubId: 7 }),
}));

vi.mock("../utils/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("recharts", () => {
  const Container = ({ children }) => <div>{children}</div>;
  const Primitive = () => null;
  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    AreaChart: Container,
    Line: Primitive,
    Area: Primitive,
    XAxis: Primitive,
    YAxis: Primitive,
    Tooltip: Primitive,
    CartesianGrid: Primitive,
    Legend: Primitive,
  };
});

function configureSupabase() {
  mocks.from.mockImplementation((table) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve({ data: mocks.rows[table] ?? [], error: null }).then(resolve, reject),
    };
    return chain;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const week = getISOWeek(new Date());
  mocks.rows = {
    athletes: [
      { id: 1, name: "Alice Martin", main_discipline: "400 m", profile_data: {} },
      { id: 2, name: "Nora Dupont", main_discipline: "Saut en longueur", profile_data: {} },
      { id: 3, name: "Lina Petit", main_discipline: "100 m", profile_data: {} },
    ],
    sessions: [],
    athlete_wellness: [{
      athlete_id: 1,
      date: "2026-07-29",
      sleep: 1,
      energy: 1,
      soreness: 5,
      mood: 1,
      stress: 5,
      notes: "Journée difficile",
    }],
    weekly_charge: [
      { athlete_id: 1, week, raw_load: 0, daily_loads: [{ date: "2026-07-29", load: 0 }], known_days: 1, unknown_days: 0, estimated_days: 0 },
      { athlete_id: 2, week, raw_load: null, daily_loads: [{ date: "2026-07-29", load: null }], known_days: 0, unknown_days: 1, estimated_days: 0 },
    ],
  };
  configureSupabase();
});

afterEach(cleanup);

describe("ChargeView", () => {
  it("charge le ressenti du jour et distingue zéro, incomplet et absent", async () => {
    render(<ChargeView />);

    expect(await screen.findByRole("heading", { name: "Charge & suivi" })).toBeTruthy();
    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith("athlete_wellness"));
    expect(screen.getByText("0 renseigné")).toBeTruthy();
    expect(screen.getByText("À compléter")).toBeTruthy();
    expect(screen.getByText("À renseigner")).toBeTruthy();
    expect(screen.getByText((_, element) => element.tagName === "SPAN" && element.textContent.includes("Alice Martin décrit une journée difficile"))).toBeTruthy();
    expect(screen.getByText("1 questionnaire aujourd'hui")).toBeTruthy();
  });

  it("ouvre une lecture simple puis conserve le détail scientifique", async () => {
    render(<ChargeView />);
    const explainButton = await screen.findByRole("button", { name: "Comprendre la charge de Alice Martin" });
    fireEvent.click(explainButton);

    expect(screen.getByText("Lecture simple · Alice Martin")).toBeTruthy();
    expect(screen.getByText("Charge des 7 derniers jours")).toBeTruthy();
    expect(screen.getByText("Charge des 28 derniers jours")).toBeTruthy();
    expect(screen.getByText("Voir le détail scientifique de Alice")).toBeTruthy();
    expect(explainButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("ne transforme pas une absence de questionnaire en conclusion rassurante", async () => {
    mocks.rows.athlete_wellness = [];
    render(<ChargeView />);

    expect(await screen.findByText(/Aucun questionnaire rempli aujourd'hui sur 3 athlètes/)).toBeTruthy();
    expect(screen.queryByText(/Aucun ressenti déclaré difficile parmi/)).toBeNull();
  });

  it("n'affiche pas une courbe expérimentale vide comme si elle contenait des mesures", async () => {
    render(<ChargeView />);
    const advancedButton = await screen.findByRole("button", { name: /Analyse avancée · ACWR EWMA expérimental/ });
    fireEvent.click(advancedButton);

    expect(screen.getByText("Pas encore assez de données pour tracer l'évolution.")).toBeTruthy();
    expect(advancedButton.getAttribute("aria-expanded")).toBe("true");
  });
});
