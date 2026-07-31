import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TrainingGauge from "./TrainingGauge";

afterEach(cleanup);

describe("TrainingGauge", () => {
  it("affiche le mot de statut et déclenche le tap", () => {
    const onClick = vi.fn();
    render(<TrainingGauge value={62} color="var(--tone-success)" statusWord="Bon" label="Charge de la semaine" onClick={onClick} />);
    expect(screen.getByText("Bon")).toBeTruthy();
    expect(screen.getByText("Charge de la semaine")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("affiche un tiret plutôt qu'un statut inventé quand la donnée est absente", () => {
    render(<TrainingGauge value={null} statusWord={null} label="Fatigue" onClick={vi.fn()} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
