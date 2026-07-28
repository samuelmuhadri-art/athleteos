import { describe, expect, it } from "vitest";
import { performanceIndex } from "./perfsShared";

describe("performanceIndex", () => {
  it("fait monter l'indice quand un chrono diminue", () => {
    expect(performanceIndex(11.5, 11, "100m")).toBeCloseTo(95.7, 1);
    expect(performanceIndex(10.9, 11, "100m")).toBeCloseTo(100.9, 1);
  });

  it("fait monter l'indice quand une distance augmente", () => {
    expect(performanceIndex(6.6, 7, "Longueur")).toBeCloseTo(94.3, 1);
    expect(performanceIndex(7.1, 7, "Longueur")).toBeCloseTo(101.4, 1);
  });

  it("refuse les valeurs qui ne permettent pas un ratio fiable", () => {
    expect(performanceIndex(null, 11, "100m")).toBeNull();
    expect(performanceIndex(11, 0, "100m")).toBeNull();
  });
});
