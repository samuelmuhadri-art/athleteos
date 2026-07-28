import { describe, expect, it } from "vitest";
import {
  ATHLETE_MOBILE_ITEM_IDS,
  COACH_MOBILE_MORE_ITEMS,
  COACH_MOBILE_PRIMARY_ITEMS,
  isCoachMoreView,
} from "./mobileNavigation";

describe("mobile navigation configuration", () => {
  it("répartit chaque route coach une seule fois entre la barre et Plus", () => {
    const expectedRoutes = [
      "dashboard", "planning", "athletes", "performances", "charge",
      "rapports", "competitions", "alerts", "messaging",
    ];
    const configuredRoutes = [
      ...COACH_MOBILE_PRIMARY_ITEMS.map((item) => item.id),
      ...COACH_MOBILE_MORE_ITEMS.map((item) => item.id),
    ];

    expect(COACH_MOBILE_PRIMARY_ITEMS.map((item) => item.label)).toEqual([
      "Accueil", "Planning", "Athlètes", "Messages",
    ]);
    expect(new Set(configuredRoutes).size).toBe(configuredRoutes.length);
    expect(configuredRoutes.sort()).toEqual(expectedRoutes.sort());
  });

  it("place uniquement les cinq fonctions secondaires demandées dans Plus", () => {
    expect(COACH_MOBILE_MORE_ITEMS.map((item) => item.id)).toEqual([
      "performances", "charge", "competitions", "alerts", "rapports",
    ]);
    expect(isCoachMoreView("alerts")).toBe(true);
    expect(isCoachMoreView("dashboard")).toBe(false);
  });

  it("garde cinq destinations athlète sans ajouter les notifications", () => {
    expect(ATHLETE_MOBILE_ITEM_IDS).toHaveLength(5);
    expect(ATHLETE_MOBILE_ITEM_IDS).toEqual([
      "dashboard", "planning", "performances", "social", "messagerie",
    ]);
    expect(ATHLETE_MOBILE_ITEM_IDS).not.toContain("notifications");
  });
});
