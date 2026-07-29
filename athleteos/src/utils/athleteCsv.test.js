import { describe, expect, it } from "vitest";
import {
  getAthleteCsvTemplate,
  getAthleteCsvImportError,
  parseAthleteCsv,
  validateAthleteCsvFile,
} from "./athleteCsv";

describe("parseAthleteCsv", () => {
  it("lit un CSV UTF-8 français séparé par des points-virgules", () => {
    const result = parseAthleteCsv([
      "\uFEFFsep=;",
      "Prénom;Nom;Courriel;Âge;Discipline principale;Disciplines secondaires;Groupe d'entraînement;Niveau",
      'Noémie;Dùpont;NOEMIE@EXAMPLE.COM;20;"100 m, 200 m";Haies | Relais;Sprint;National',
    ].join("\r\n"));

    expect(result.fatalErrors).toEqual([]);
    expect(result.meta.delimiter).toBe(";");
    expect(result.entries[0].row).toBe(3);
    expect(result.athletes).toEqual([
      expect.objectContaining({
        name: "Noémie Dùpont",
        email: "noemie@example.com",
        age: "20",
        mainDiscipline: "100 m, 200 m",
        secondaryDisciplines: "Haies, Relais",
        group: "Sprint",
        level: "National",
        speed: 50,
      }),
    ]);
  });

  it("lit les en-têtes anglais, les virgules et les guillemets échappés", () => {
    const result = parseAthleteCsv([
      "Full Name,Email,Age,Main Discipline,Training Group,Note libre",
      '"Alex ""Rocket"" Martin",alex@example.org,24,"Long jump",Jumps,"ligne 1',
      'ligne 2"',
    ].join("\n"));

    expect(result.athletes[0]).toEqual(expect.objectContaining({
      name: 'Alex "Rocket" Martin',
      mainDiscipline: "Long jump",
      group: "Jumps",
    }));
    expect(result.meta.ignoredHeaders).toEqual(["Note libre"]);
    expect(result.warnings[0].code).toBe("ignored_headers");
  });

  it("ignore les lignes invalides et déduplique les emails sans tenir compte de la casse", () => {
    const result = parseAthleteCsv([
      "Nom complet,Email,Âge",
      "Nora Dupont,nora@example.com,21",
      ",vide@example.com,22",
      "Email incorrect,pas-un-email,20",
      "Âge incorrect,age@example.com,vingt",
      "Doublon,NORA@EXAMPLE.COM,23",
      "Sans email,,18",
    ].join("\n"));

    expect(result.athletes.map((athlete) => athlete.name)).toEqual(["Nora Dupont", "Sans email"]);
    expect(result.errors.map((error) => error.code)).toEqual([
      "missing_name",
      "invalid_email",
      "invalid_age",
      "duplicate_email",
    ]);
    expect(result.meta).toEqual(expect.objectContaining({
      totalRows: 6,
      validRows: 2,
      invalidRows: 4,
      duplicateRows: 1,
    }));
    expect(result.canImport).toBe(true);
  });

  it("déduplique aussi les emails déjà présents dans le club", () => {
    const result = parseAthleteCsv(
      "Name,Email\nExisting,member@club.be\nNew,new@club.be",
      { existingEmails: ["MEMBER@club.be"] },
    );

    expect(result.athletes.map((athlete) => athlete.email)).toEqual(["new@club.be"]);
    expect(result.errors[0].code).toBe("duplicate_email");
  });

  it("aligne la limite des disciplines secondaires sur le contrat serveur", () => {
    const twoLongValues = `${"A".repeat(100)}|${"B".repeat(100)}`;
    const valid = parseAthleteCsv(`Nom complet;Disciplines secondaires\nNora;${twoLongValues}`);
    const disciplines = Array.from({ length: 21 }, (_, index) => `D${index + 1}`).join("|");
    const result = parseAthleteCsv(`Nom complet;Disciplines secondaires\nNora;${disciplines}`);

    expect(valid.athletes).toHaveLength(1);
    expect(valid.athletes[0].secondaryDisciplines).toContain(", ");
    expect(result.athletes).toEqual([]);
    expect(result.errors[0].code).toBe("too_many_secondary_disciplines");
  });

  it("rejette les caractères de contrôle avant l'appel serveur", () => {
    const result = parseAthleteCsv("Nom complet;Groupe\nNora;Sprint\u0000Elite");

    expect(result.athletes).toEqual([]);
    expect(result.errors[0].code).toBe("control_character");
  });

  it("bloque les structures ambiguës et les fichiers au-delà des limites", () => {
    const missingName = parseAthleteCsv("Email;Groupe\nnora@example.com;Sprint");
    const duplicateHeader = parseAthleteCsv("Nom complet;Email;Courriel\nNora;nora@example.com;nora@example.com");
    const tooManyRows = parseAthleteCsv(
      "Name,Email\nA,a@example.com\nB,b@example.com",
      { limits: { maxDataRows: 1 } },
    );
    const unclosedQuote = parseAthleteCsv('Name,Email\n"Nora,nora@example.com');

    expect(missingName.fatalErrors[0].code).toBe("missing_name_header");
    expect(duplicateHeader.fatalErrors[0].code).toBe("duplicate_header");
    expect(tooManyRows.fatalErrors[0].code).toBe("too_many_rows");
    expect(tooManyRows.athletes).toEqual([]);
    expect(unclosedQuote.fatalErrors[0].code).toBe("unclosed_quote");
  });
});

describe("fichier et modèle CSV", () => {
  it("refuse Excel et les fichiers trop lourds, puis fournit un modèle importable", () => {
    expect(validateAthleteCsvFile({ name: "athletes.xlsx", size: 120 }).code).toBe("invalid_file_type");
    expect(validateAthleteCsvFile({ name: "athletes.csv", size: 101 }, { maxFileBytes: 100 }).code).toBe("file_too_large");

    const template = getAthleteCsvTemplate();
    const parsedTemplate = parseAthleteCsv(template);
    expect(parsedTemplate.athletes).toHaveLength(2);
    expect(parsedTemplate.fatalErrors).toEqual([]);
  });

  it("présente une erreur RPC avec le vrai numéro de ligne du CSV", () => {
    const error = getAthleteCsvImportError(
      { message: "Ligne 2 : cet email est déjà utilisé." },
      [4, 9],
    );
    expect(error.message).toBe("Ligne 9 du CSV : cet email est déjà utilisé.");
  });
});
