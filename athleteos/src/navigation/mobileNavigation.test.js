import { describe, expect, it } from "vitest";
import {
  ATHLETE_MOBILE_ITEM_IDS,
  COACH_MOBILE_MORE_ITEMS,
  COACH_MOBILE_PRIMARY_ITEMS,
  isCoachMoreView,
  buildCoachMobileNavigation,
} from "./mobileNavigation";

describe("mobile navigation configuration", () => {
  it("supprime Plus quand cinq destinations suffisent et promeut les outils actifs", () => {
    const primary = COACH_MOBILE_PRIMARY_ITEMS.filter(item => item.id !== "planning");
    const secondary = COACH_MOBILE_MORE_ITEMS.filter(item => ["performances", "alerts"].includes(item.id));
    const result = buildCoachMobileNavigation(primary, secondary);
    expect(result.more).toEqual([]);
    expect(result.primary.map(item => item.id)).toContain("performances");
    expect(result.primary).toHaveLength(5);
  });

  it("garde au plus quatre accès avec Plus et ne duplique aucune route", () => {
    const result = buildCoachMobileNavigation(COACH_MOBILE_PRIMARY_ITEMS.slice(0, 2), COACH_MOBILE_MORE_ITEMS);
    expect(result.primary).toHaveLength(4);
    expect(result.more).toHaveLength(3);
    const ids = [...result.primary, ...result.more].map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
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
