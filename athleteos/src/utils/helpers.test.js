import { describe, expect, it } from "vitest";
import { getISOWeek, initialsFromName, parseLocalDate } from "./helpers.js";

describe("getISOWeek", () => {
  it("place le 1er janvier d'une année standard en semaine 1", () => {
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
  });

  it("rattache la fin décembre à la semaine 1 de l'année suivante quand l'ISO l'exige", () => {
    // Le 31/12/2029 est un lundi : ISO le place en semaine 1 de 2030.
    expect(getISOWeek(new Date(2029, 11, 31))).toBe(1);
  });

  it("rattache début janvier à la dernière semaine de l'année précédente quand l'ISO l'exige", () => {
    // Le 01/01/2027 est un vendredi : ISO le place encore en semaine 53 de 2026.
    expect(getISOWeek(new Date(2027, 0, 1))).toBe(53);
  });

  it("avance d'une semaine chaque lundi", () => {
    const week1 = getISOWeek(new Date(2026, 2, 2));
    const week2 = getISOWeek(new Date(2026, 2, 9));
    expect(week2).toBe(week1 + 1);
  });
});

describe("parseLocalDate", () => {
  it("construit une date locale sans décalage de fuseau", () => {
    const date = parseLocalDate("2026-07-31");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(31);
  });
});

describe("initialsFromName", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(initialsFromName("Alicia Martin")).toBe("AM");
  });

  it("ne garde qu'une lettre pour un nom simple", () => {
    expect(initialsFromName("Madonna")).toBe("M");
  });

  it("retombe sur « ? » sans nom", () => {
    expect(initialsFromName("")).toBe("?");
    expect(initialsFromName(null)).toBe("?");
  });

  it("ignore les espaces superflus entre les mots", () => {
    expect(initialsFromName("  Jean   Dupont  ")).toBe("JD");
  });
});
