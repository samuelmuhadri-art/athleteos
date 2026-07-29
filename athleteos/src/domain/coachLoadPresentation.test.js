import { describe, expect, it } from "vitest";
import {
  athleteSeriesKey,
  buildExperimentalAcwrSeries,
  buildGroupLoadOverview,
  buildGroupLoadStory,
  describeLoadVariation,
  getWeeklyLoadState,
} from "./coachLoadPresentation.js";

describe("présentation de la charge coach", () => {
  it("distingue une donnée absente, incomplète et un vrai zéro", () => {
    expect(getWeeklyLoadState(null).kind).toBe("missing");
    expect(getWeeklyLoadState({ rawLoad: null }).kind).toBe("incomplete");
    expect(getWeeklyLoadState({ rawLoad: 0, knownDays: 1 })).toMatchObject({ kind: "zero", value: 0, label: "0 renseigné" });
    expect(getWeeklyLoadState({ rawLoad: 420 }).kind).toBe("observed");
  });

  it("ignore les données inconnues dans la moyenne du groupe", () => {
    const overview = buildGroupLoadOverview([
      { rawLoad: 420, previousRawLoad: 350, metrics: { load7: 900 } },
      { rawLoad: 0, previousRawLoad: 0, metrics: { load7: 0 } },
      { rawLoad: null, previousRawLoad: null, metrics: { load7: null } },
    ]);
    expect(overview.avgLoad).toBe(210);
    expect(overview.observedCount).toBe(2);
    expect(overview.avgLoad7).toBe(450);
    expect(overview.topLoader.rawLoad).toBe(420);
  });

  it("calcule une évolution uniquement avec les athlètes renseignés sur les deux semaines", () => {
    const overview = buildGroupLoadOverview([
      { rawLoad: 600, previousRawLoad: 400, metrics: {} },
      { rawLoad: 300, previousRawLoad: null, metrics: {} },
    ]);
    expect(overview.pairedCount).toBe(1);
    expect(overview.trendPercent).toBe(50);
  });

  it("traduit la variation avec des mots sans prétendre définir un risque", () => {
    expect(describeLoadVariation(28)).toMatchObject({ label: "Nettement plus que d'habitude", valueLabel: "+28 %" });
    expect(describeLoadVariation(-4).label).toBe("Proche de l'habitude");
    expect(describeLoadVariation(null).valueLabel).toBe("Comparaison indisponible");
  });

  it("résume le groupe en langage lisible", () => {
    const story = buildGroupLoadStory([
      { metrics: { variationPercent: 18 } },
      { metrics: { variationPercent: 2 } },
      { metrics: { variationPercent: -14 } },
    ]);
    expect(story.headline).toBe("Les charges évoluent différemment dans le groupe");
    expect(story.counts).toEqual({ higher: 1, stable: 1, lower: 1, known: 3 });
    expect(story.detail).toContain("pas un danger");
  });

  it("garde deux séries distinctes lorsque deux athlètes ont le même prénom", () => {
    const athletes = [{ id: 11, name: "Alex Martin" }, { id: 12, name: "Alex Dupont" }];
    const series = buildExperimentalAcwrSeries(athletes, [
      { athleteId: 11, week: 30, rawLoad: 100 },
      { athleteId: 12, week: 30, rawLoad: 200 },
    ]);
    expect(athleteSeriesKey(11)).not.toBe(athleteSeriesKey(12));
    expect(series[0]).toHaveProperty("athlete_11");
    expect(series[0]).toHaveProperty("athlete_12");
  });
});
