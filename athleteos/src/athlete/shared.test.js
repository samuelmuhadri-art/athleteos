// ============================================================
// AthleteOS — src/athlete/shared.test.js
//
// Moteur central de comparaison de performances (tâche 11), porté ici
// en Vitest (tâche 19) depuis test_perf_engine.mjs — fonctions pures,
// aucune base de données requise.
//
// Le bloc de test isNewRecord() de l'ancien script n'a PAS été porté :
// cette fonction a été supprimée de competitionsShared.js à la tâche 14
// (comparaison de record déplacée côté serveur, RPC _apply_competition_
// result) — l'ancien test_perf_engine.mjs ne le savait pas et plantait
// silencieusement (TypeError: isNewRecord is not a function) depuis,
// jamais ré-exécuté entre-temps. Trouvé en portant ce test — exactement
// le genre de régression que la tâche 19 doit empêcher désormais.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  parsePerf, getDiscHib, isBetterOrEqual, compareValues, pctOfReference,
  dimColor, acwrColor, isSameDay, toLocalDateStr, dateToISOWeek, dateToDayName, colorsFor,
  METRIC_SCIENCE,
} from "./shared.js";

describe("parsePerf", () => {
  it.each([
    ["11.20", 11.2],
    ["4:32", 272],
    ["7.60m", 7.6],
    ["14.20", 14.2],
    [null, null],
  ])("parsePerf(%s) -> %s", (input, expected) => {
    expect(parsePerf(input).value).toBe(expected);
  });

  it("ne renvoie plus de champ hib/higherIsBetter (le sens vient de la discipline, jamais du format)", () => {
    const parsed = parsePerf("11.20");
    expect("hib" in parsed).toBe(false);
    expect("higherIsBetter" in parsed).toBe(false);
  });

  it("précision différente = même valeur numérique", () => {
    expect(parsePerf("11.2").value).toBe(parsePerf("11.20").value);
  });

  it("texte non numérique -> null, jamais NaN", () => {
    expect(parsePerf("abandon").value).toBeNull();
  });
});

describe("getDiscHib — sens correct par discipline", () => {
  it.each([
    ["100m", false],
    ["1500m", false],
    ["Longueur", true],
    ["Poids", true],
    ["Décathlon", true],
  ])("%s -> higherIsBetter=%s", (discipline, expected) => {
    expect(getDiscHib(discipline)).toBe(expected);
  });
});

describe("isBetterOrEqual", () => {
  it("100m : 11.00 est meilleur que 11.20 (chrono, plus petit = mieux)", () => {
    expect(isBetterOrEqual(11.0, 11.2, "100m")).toBe(true);
    expect(isBetterOrEqual(11.2, 11.0, "100m")).toBe(false);
  });

  it("Longueur : 7.60 est meilleur que 7.20 (distance, plus grand = mieux)", () => {
    expect(isBetterOrEqual(7.6, 7.2, "Longueur")).toBe(true);
    expect(isBetterOrEqual(7.2, 7.6, "Longueur")).toBe(false);
  });

  it("Poids : 14.50 est meilleur que 14.20", () => {
    expect(isBetterOrEqual(14.5, 14.2, "Poids")).toBe(true);
  });

  it("Décathlon : 7800 pts est meilleur que 7500 pts", () => {
    expect(isBetterOrEqual(7800, 7500, "Décathlon")).toBe(true);
  });

  it("égalité -> toujours vrai", () => {
    expect(isBetterOrEqual(11.2, 11.2, "100m")).toBe(true);
  });

  it("valeur candidate absente -> jamais meilleure", () => {
    expect(isBetterOrEqual(null, 11.2, "100m")).toBe(false);
  });

  it("valeur de référence absente -> toujours meilleure (rien à battre)", () => {
    expect(isBetterOrEqual(11.2, null, "100m")).toBe(true);
  });
});

describe("compareValues — tri correct pour un classement", () => {
  it("100m : trié du plus rapide au plus lent", () => {
    const sorted = [11.8, 10.95, 11.2].sort((a, b) => compareValues(a, b, "100m"));
    expect(sorted).toEqual([10.95, 11.2, 11.8]);
  });

  it("Longueur : trié du plus loin au moins loin", () => {
    const sorted = [6.2, 7.1, 6.8].sort((a, b) => compareValues(a, b, "Longueur"));
    expect(sorted).toEqual([7.1, 6.8, 6.2]);
  });

  it("ne classe pas une épreuve libre dont le sens est inconnu", () => {
    expect(compareValues(7.45, 7.2, "Épreuve libre")).toBe(0);
    expect(isBetterOrEqual(7.45, 7.2, "Épreuve libre")).toBe(false);
    expect(pctOfReference(7.45, 7.2, "Épreuve libre")).toBeNull();
  });
});

describe("pctOfReference — % du PR, sens correct par discipline", () => {
  it("100m : SB plus lent que le PR -> pct < 100%", () => {
    const pct = pctOfReference(11.5, 11.0, "100m");
    expect(pct).not.toBeNull();
    expect(pct).toBeLessThan(100);
  });

  it("Longueur : SB plus court que le PR -> pct < 100%", () => {
    const pct = pctOfReference(6.5, 7.0, "Longueur");
    expect(pct).not.toBeNull();
    expect(pct).toBeLessThan(100);
  });

  it("SB égal au PR -> 100% pile", () => {
    expect(pctOfReference(11.0, 11.0, "100m")).toBe(100);
  });

  it("objectif chronométré non atteint -> pct < 100% (pas de faux 100%)", () => {
    const pct = pctOfReference(12.0, 11.0, "100m");
    expect(pct).toBeLessThan(100);
  });

  it("objectif déjà dépassé -> plafonné à 100%, jamais au-delà", () => {
    expect(pctOfReference(11.0, 13.0, "100m")).toBe(100);
  });

  it("PR absent -> null, jamais un chiffre inventé", () => {
    expect(pctOfReference(null, 11.0, "100m")).toBeNull();
  });

  it("cible absente -> null", () => {
    expect(pctOfReference(11.0, null, "100m")).toBeNull();
  });
});

describe("dimColor — couleur par dimension", () => {
  it.each([
    ["wellness", "#A78BFA"],
    ["ewmaLong", "#EC4899"],
    ["ewmaShort", "#A855F7"],
    ["spacing", "#38BDF8"],
    ["dataQuality", "#94A3B8"],
    ["acwrExperimental", "#8B5CF6"],
    ["inconnu", "#94A3B8"],
  ])("dimColor(%s) -> %s", (metric, expected) => {
    expect(dimColor(metric)).toBe(expected);
  });

  it("streak : série active (>=3) vs série faible", () => {
    expect(dimColor("streak", 3)).toBe("#378ADD");
    expect(dimColor("streak", 5)).toBe("#378ADD");
    expect(dimColor("streak", 2)).toBe("rgba(55,138,221,0.45)");
    expect(dimColor("streak", 0)).toBe("rgba(55,138,221,0.45)");
  });
});

describe("acwrColor", () => {
  it("retourne toujours la même couleur fixe", () => {
    expect(acwrColor()).toBe("#8B5CF6");
  });
});

describe("isSameDay", () => {
  it("vrai pour deux Date au même jour civil, même à des heures différentes", () => {
    expect(isSameDay(new Date(2026, 6, 30, 8, 0), new Date(2026, 6, 30, 23, 59))).toBe(true);
  });

  it("faux si le jour, le mois ou l'année diffère", () => {
    expect(isSameDay(new Date(2026, 6, 30), new Date(2026, 6, 29))).toBe(false);
    expect(isSameDay(new Date(2026, 6, 30), new Date(2026, 5, 30))).toBe(false);
    expect(isSameDay(new Date(2026, 6, 30), new Date(2025, 6, 30))).toBe(false);
  });
});

describe("toLocalDateStr", () => {
  it("formate en YYYY-MM-DD en heure locale, sans passer par l'UTC", () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalDateStr(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});

describe("dateToISOWeek / dateToDayName", () => {
  it("dérive la semaine ISO et le nom du jour depuis une chaîne YYYY-MM-DD", () => {
    // 2026-07-30 est un jeudi, semaine ISO 31
    expect(dateToISOWeek("2026-07-30")).toBe(31);
    expect(dateToDayName("2026-07-30")).toBe("Jeudi");
  });

  it("reconnaît le lundi comme premier jour de la semaine FR", () => {
    expect(dateToDayName("2026-07-27")).toBe("Lundi");
  });
});

describe("METRIC_SCIENCE — couleur par seuil d'affichage", () => {
  it("wellness : rouge en dessous de 50, orange entre 50 et 74, vert à partir de 75", () => {
    expect(METRIC_SCIENCE.wellness.color(40)).toBe("#E24B4A");
    expect(METRIC_SCIENCE.wellness.color(60)).toBe("#EF9F27");
    expect(METRIC_SCIENCE.wellness.color(80)).toBe("#1D9E75");
  });

  it("ewmaLong : même grille de seuils que wellness (croissant = mieux)", () => {
    expect(METRIC_SCIENCE.ewmaLong.color(40)).toBe("#E24B4A");
    expect(METRIC_SCIENCE.ewmaLong.color(60)).toBe("#EF9F27");
    expect(METRIC_SCIENCE.ewmaLong.color(80)).toBe("#1D9E75");
  });

  it("ewmaShort : inversé (croissant = plus chargé, donc pire)", () => {
    expect(METRIC_SCIENCE.ewmaShort.color(30)).toBe("#1D9E75");
    expect(METRIC_SCIENCE.ewmaShort.color(60)).toBe("#EF9F27");
    expect(METRIC_SCIENCE.ewmaShort.color(80)).toBe("#E24B4A");
  });

  it("spacing : rouge si fenêtre encore active, vert si terminée", () => {
    expect(METRIC_SCIENCE.spacing.color(20)).toBe("#E24B4A");
    expect(METRIC_SCIENCE.spacing.color(55)).toBe("#EF9F27");
    expect(METRIC_SCIENCE.spacing.color(90)).toBe("#1D9E75");
  });

  it("dataQuality : inversé (croissant = donnée manquante, donc pire)", () => {
    expect(METRIC_SCIENCE.dataQuality.color(20)).toBe("#1D9E75");
    expect(METRIC_SCIENCE.dataQuality.color(45)).toBe("#EF9F27");
    expect(METRIC_SCIENCE.dataQuality.color(80)).toBe("#E24B4A");
  });
});

describe("colorsFor", () => {
  it("retourne les couleurs de la catégorie connue", () => {
    expect(colorsFor("sprint")).toEqual({ bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" });
  });

  it("retient la palette technique comme repli pour une catégorie inconnue", () => {
    expect(colorsFor("inexistant")).toEqual({ bg: "#F1F5F9", border: "#64748B", text: "#1E293B" });
  });
});
