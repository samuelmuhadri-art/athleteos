import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InitialAvatar from "./InitialAvatar";

describe("InitialAvatar partagé", () => {
  it("affiche une ou deux initiales avec une couleur explicite accessible aux deux thèmes", () => {
    const { rerender } = render(<InitialAvatar name="Samuel" />);
    expect(screen.getByRole("img", { name:"Samuel" }).textContent).toBe("S");
    expect(screen.getByRole("img").style.color).toBe("rgb(255, 255, 255)");
    rerender(<InitialAvatar name="Samuel Muhadri" />);
    expect(screen.getByRole("img", { name:"Samuel Muhadri" }).textContent).toBe("SM");
  });

  it("utilise une vraie image lorsqu'elle existe", () => {
    render(<InitialAvatar name="Samuel" src="/avatar.png" />);
    expect(screen.getByAltText("Samuel").getAttribute("src")).toBe("/avatar.png");
  });
});
