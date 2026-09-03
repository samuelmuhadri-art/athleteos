import { describe, expect, it } from "vitest";
import {
  MODULE_KEYS,
  filterNavigation,
  resolveModuleDependencies,
  resolveEffectiveModules,
  rowsToModuleMap,
  toggleModule,
  moduleKeyForEventType,
  matchingModulePreset,
} from "./moduleRegistry";

describe("module registry", () => {
  it("defaults missing persisted rows to enabled for backward compatibility", () => {
    expect(rowsToModuleMap([{ module_key: "wellness", enabled: false }])).toMatchObject({
      planning: true,
      wellness: false,
    });
  });

  it("enables feedback with training load", () => {
    expect(resolveModuleDependencies(["training_load"])).toEqual(expect.arrayContaining(["session_feedback", "training_load"]));
  });

  it("disables training load when feedback is disabled", () => {
    expect(toggleModule(MODULE_KEYS, "session_feedback", false)).not.toContain("training_load");
  });

  it("removes unavailable views without leaving placeholders", () => {
    const items = [{ id: "dashboard" }, { id: "charge" }, { id: "athletes" }];
    expect(filterNavigation(items, { training_load: false }, { charge: "training_load" }))
      .toEqual([{ id: "dashboard" }, { id: "athletes" }]);
  });

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])("resolves club=%s athlete=%s to effective=%s", (club, athlete, expected) => {
    expect(resolveEffectiveModules({ wellness: club }, { wellness: athlete }).wellness).toBe(expected);
  });

  it("routes generated outputs to their source module", () => {
    expect(moduleKeyForEventType("weekly_report")).toBe("reports");
    expect(moduleKeyForEventType("session_feedback_reminder")).toBe("session_feedback");
    expect(moduleKeyForEventType("blessure")).toBe("health");
    expect(moduleKeyForEventType("badge")).toBe("gamification");
    expect(moduleKeyForEventType("unknown")).toBeNull();
  });

  it("identifie un preset puis bascule en personnalisé après un changement manuel", () => {
    expect(matchingModulePreset(["planning", "performances", "messaging"])?.id).toBe("essential");
    expect(matchingModulePreset(["planning", "performances", "messaging", "gamification"])).toBeNull();
  });
});
