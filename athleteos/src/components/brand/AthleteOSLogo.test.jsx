import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import AthleteOSLogo, { AthleteOSBadge, AthleteOSMark, AthleteOSWordmark } from "./AthleteOSLogo";

afterEach(cleanup);

describe("AthleteOSLogo", () => {
  it("reprend exactement la piste validée dans le composant et les assets SVG", () => {
    const approved = new DOMParser().parseFromString(readFileSync("docs/brand/concepts/piste-v3.svg", "utf8"), "image/svg+xml");
    const signature = node => Array.from(node.children).map(child => [child.tagName.toLowerCase(), Object.fromEntries(Array.from(child.attributes).map(attr => [attr.name, attr.value]))]);
    const expected = signature(approved.querySelector("g"));
    const { container } = render(<AthleteOSMark />);
    const mark = container.querySelector("g");
    expect(signature(mark)).toEqual(expected);
    expect(mark.getAttribute("stroke-width")).toBe("4");
    expect(mark.getAttribute("transform")).toBe("rotate(-28 32 32)");
    for (const file of ["favicon.svg", "icon.svg", "icon-maskable.svg"]) {
      const asset = new DOMParser().parseFromString(readFileSync(`public/${file}`, "utf8"), "image/svg+xml");
      expect(asset.querySelector("parsererror")).toBeNull();
      expect(signature(asset.querySelector('g[transform="rotate(-28 32 32)"]'))).toEqual(expected);
    }
  });

  it("fournit les quatre PNG aux dimensions déclarées par le manifeste", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    expect(manifest.icons).toHaveLength(4);
    for (const icon of manifest.icons) {
      const bytes = readFileSync(`public${icon.src}`);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });

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
