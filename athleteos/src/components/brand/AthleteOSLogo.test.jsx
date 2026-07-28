import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AthleteOSLogo, { AthleteOSBadge, AthleteOSMark, AthleteOSWordmark } from "./AthleteOSLogo";

afterEach(cleanup);

describe("AthleteOSLogo", () => {
  it("expose un nom accessible quand le symbole porte la marque", () => {
    render(<AthleteOSMark title="AthleteOS" />);
    expect(screen.getByRole("img", { name: "AthleteOS" })).toBeTruthy();
  });

  it("cache les symboles purement décoratifs aux technologies d'assistance", () => {
    const { container } = render(<AthleteOSMark />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("compose le badge et le mot-symbole sans transformer le nom", () => {
    render(<AthleteOSLogo direction="column" size={56} wordmarkSize={24} />);
    expect(screen.getByText(/Athlete/).textContent).toBe("AthleteOS");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("permet d'utiliser séparément le badge et le wordmark", () => {
    render(<><AthleteOSBadge title="Marque AthleteOS" /><AthleteOSWordmark /></>);
    expect(screen.getByRole("img", { name: "Marque AthleteOS" })).toBeTruthy();
    expect(screen.getByText(/Athlete/).textContent).toBe("AthleteOS");
  });
});
