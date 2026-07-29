// Import CSV d'athlètes : logique pure, sans accès au navigateur ni à Supabase.
// Le résultat utilise la même forme que AddAthleteModal afin que l'intégration
// puisse réutiliser le flux de création existant sans modifier les données.

export const ATHLETE_CSV_LIMITS = Object.freeze({
  maxFileBytes: 2 * 1024 * 1024,
  maxCharacters: 2_000_000,
  maxDataRows: 500,
  maxColumns: 30,
  // 20 disciplines de 160 caractères + séparateurs : le champ CSV complet
  // peut légitimement dépasser 160 caractères, contrairement à chaque item.
  maxFieldLength: 3_400,
  maxNameLength: 120,
  maxTextValueLength: 160,
  maxSecondaryDisciplines: 20,
});

const DEFAULT_PROFILE = Object.freeze({
  speed: 50,
  strength: 50,
  explosivity: 50,
  endurance: 50,
  technique: 50,
  recoveryRate: "normale",
  volumeTolerance: "modérée",
  intensityTolerance: "modérée",
  psychProfile: "",
});

const HEADER_ALIASES = Object.freeze({
  name: [
    "name", "full name", "athlete", "athlete name",
    "nom complet", "nom prenom", "nom et prenom", "prenom nom", "prenom et nom", "athlete nom",
  ],
  firstName: ["first name", "firstname", "given name", "prenom"],
  lastName: ["last name", "lastname", "surname", "family name", "nom", "nom de famille"],
  email: ["email", "e mail", "mail", "email address", "adresse email", "adresse e mail", "courriel"],
  age: ["age", "athlete age"],
  mainDiscipline: [
    "discipline", "main discipline", "primary discipline", "event", "speciality", "specialty",
    "discipline principale", "epreuve", "specialite",
  ],
  secondaryDisciplines: [
    "secondary disciplines", "other disciplines", "secondary events",
    "disciplines secondaires", "autres disciplines", "epreuves secondaires",
  ],
  group: [
    "group", "training group", "team", "squad", "groupe", "groupe entrainement",
    "groupe d entrainement", "groupe de entrainement", "equipe",
  ],
  level: ["level", "competition level", "category", "niveau", "niveau competition", "categorie"],
});

const ALIAS_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => [alias, field])),
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

function containsControlCharacter(value) {
  return [...String(value ?? "")].some((character) => {
    const code = character.codePointAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[_./-]+/gu, " ")
    .replace(/[^a-z0-9 ]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanField(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\r\n\t]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function csvError(code, message, row = null) {
  return { code, message, row };
}

function emptyResult(fatalErrors, delimiter = null, extraMeta = {}) {
  return {
    athletes: [],
    entries: [],
    errors: [],
    fatalErrors,
    warnings: [],
    canImport: false,
    meta: {
      delimiter,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      ignoredHeaders: [],
      ...extraMeta,
    },
  };
}

function detectDelimiter(text) {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && (char === "\n" || char === "\r")) {
      break;
    } else if (!inQuotes && char === ",") commas += 1;
    else if (!inQuotes && char === ";") semicolons += 1;
  }

  return semicolons > commas ? ";" : ",";
}

function tokenizeCsv(text, delimiter, limits, startingLine = 1) {
  const rows = [];
  let cells = [];
  let field = "";
  let inQuotes = false;
  let line = startingLine;
  let rowStartLine = startingLine;

  const pushField = () => {
    if (field.length > limits.maxFieldLength) {
      return csvError(
        "field_too_long",
        `La ligne ${rowStartLine} contient une valeur de plus de ${limits.maxFieldLength} caractères.`,
        rowStartLine,
      );
    }
    cells.push(field);
    field = "";
    if (cells.length > limits.maxColumns) {
      return csvError(
        "too_many_columns",
        `La ligne ${rowStartLine} dépasse la limite de ${limits.maxColumns} colonnes.`,
        rowStartLine,
      );
    }
    return null;
  };

  const pushRow = () => {
    const issue = pushField();
    if (issue) return issue;
    if (cells.some((cell) => cleanField(cell) !== "")) {
      rows.push({ cells, row: rowStartLine });
    }
    cells = [];
    return null;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      const issue = pushField();
      if (issue) return { rows: [], fatalError: issue };
    } else if (char === "\n" || char === "\r") {
      const issue = pushRow();
      if (issue) return { rows: [], fatalError: issue };
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      rowStartLine = line;
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    return {
      rows: [],
      fatalError: csvError(
        "unclosed_quote",
        `Un guillemet ouvert à la ligne ${rowStartLine} n'est pas refermé.`,
        rowStartLine,
      ),
    };
  }

  if (field !== "" || cells.length > 0) {
    const issue = pushRow();
    if (issue) return { rows: [], fatalError: issue };
  }

  return { rows, fatalError: null };
}

function resolveHeaders(headerCells, headerRow) {
  const columns = new Map();
  const ignoredHeaders = [];
  const fatalErrors = [];

  headerCells.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = ALIAS_LOOKUP.get(normalized);

    if (!field) {
      if (cleanField(header)) ignoredHeaders.push(cleanField(header));
      return;
    }

    if (columns.has(field)) {
      fatalErrors.push(csvError(
        "duplicate_header",
        `La colonne « ${cleanField(header)} » apparaît plusieurs fois sous des noms équivalents.`,
        headerRow,
      ));
      return;
    }

    columns.set(field, index);
  });

  if (!columns.has("name") && !columns.has("firstName") && !columns.has("lastName")) {
    fatalErrors.push(csvError(
      "missing_name_header",
      "Ajoute une colonne « Nom complet » ou des colonnes « Prénom » et « Nom ».",
      headerRow,
    ));
  }

  return { columns, ignoredHeaders, fatalErrors };
}

function getCell(cells, columns, key) {
  const index = columns.get(key);
  return index == null ? "" : cleanField(cells[index]);
}

function buildAthlete(cells, columns, row, limits) {
  const payloadColumnIndexes = [...columns.values()];
  if (payloadColumnIndexes.some((index) => containsControlCharacter(cells[index]))) {
    return { error: csvError("control_character", "La ligne contient un caractère de contrôle non autorisé.", row) };
  }

  const directName = getCell(cells, columns, "name");
  const firstName = getCell(cells, columns, "firstName");
  const lastName = getCell(cells, columns, "lastName");
  const name = directName || [firstName, lastName].filter(Boolean).join(" ");
  const email = getCell(cells, columns, "email").toLowerCase();
  const ageValue = getCell(cells, columns, "age");

  if (!name) {
    return { error: csvError("missing_name", "Le nom de l'athlète est obligatoire.", row) };
  }
  if (name.length > limits.maxNameLength) {
    return { error: csvError("name_too_long", `Le nom ne peut pas dépasser ${limits.maxNameLength} caractères.`, row) };
  }
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
    return { error: csvError("invalid_email", `L'adresse email « ${email} » n'est pas valide.`, row) };
  }

  let age = "";
  if (ageValue) {
    const numericAge = Number(ageValue);
    if (!/^\d{1,3}$/u.test(ageValue) || !Number.isInteger(numericAge) || numericAge < 5 || numericAge > 100) {
      return { error: csvError("invalid_age", `L'âge « ${ageValue} » doit être un nombre entier entre 5 et 100.`, row) };
    }
    age = String(numericAge);
  }

  const boundedFields = [
    ["discipline principale", getCell(cells, columns, "mainDiscipline")],
    ["groupe", getCell(cells, columns, "group")],
    ["niveau", getCell(cells, columns, "level")],
  ];
  const oversized = boundedFields.find(([, value]) => value.length > limits.maxTextValueLength);
  if (oversized) {
    return { error: csvError("value_too_long", `La valeur « ${oversized[0]} » dépasse ${limits.maxTextValueLength} caractères.`, row) };
  }

  const secondaryDisciplines = getCell(cells, columns, "secondaryDisciplines")
    .split(/[,|]/gu)
    .map((value) => cleanField(value))
    .filter(Boolean);
  if (secondaryDisciplines.length > limits.maxSecondaryDisciplines) {
    return { error: csvError("too_many_secondary_disciplines", `Maximum ${limits.maxSecondaryDisciplines} disciplines secondaires par athlète.`, row) };
  }
  if (secondaryDisciplines.some((value) => value.length > limits.maxTextValueLength)) {
    return { error: csvError("value_too_long", `Chaque discipline secondaire est limitée à ${limits.maxTextValueLength} caractères.`, row) };
  }

  return {
    athlete: {
      name,
      email,
      age,
      mainDiscipline: boundedFields[0][1],
      secondaryDisciplines: secondaryDisciplines.join(", "),
      group: boundedFields[1][1],
      level: boundedFields[2][1],
      ...DEFAULT_PROFILE,
    },
  };
}

/**
 * Analyse un CSV d'athlètes. Les erreurs de ligne n'empêchent pas l'import des
 * autres lignes ; les erreurs fatales (structure/limites) bloquent tout import.
 */
export function parseAthleteCsv(source, options = {}) {
  const limits = { ...ATHLETE_CSV_LIMITS, ...(options.limits ?? {}) };
  let text = String(source ?? "").replace(/^\uFEFF/u, "");

  if (!text.trim()) {
    return emptyResult([csvError("empty_file", "Le fichier CSV est vide.")]);
  }
  if (text.length > limits.maxCharacters) {
    return emptyResult([csvError(
      "content_too_large",
      `Le contenu dépasse la limite de ${limits.maxCharacters.toLocaleString("fr-BE")} caractères.`,
    )]);
  }

  // Certains exports Excel européens ajoutent une ligne « sep=; ». Elle ne
  // contient aucune donnée et sert seulement à indiquer le séparateur.
  const separatorHint = text.match(/^sep=([;,])(?:\r\n|\n|\r)/iu);
  const delimiter = separatorHint?.[1] ?? detectDelimiter(text);
  const startingLine = separatorHint ? 2 : 1;
  if (separatorHint) text = text.slice(separatorHint[0].length);
  if (!text.trim()) {
    return emptyResult([csvError("empty_file", "Le fichier CSV ne contient aucune donnée.")], delimiter);
  }

  const { rows, fatalError } = tokenizeCsv(text, delimiter, limits, startingLine);
  if (fatalError) return emptyResult([fatalError], delimiter);
  if (!rows.length) return emptyResult([csvError("empty_file", "Le fichier CSV est vide.")], delimiter);

  const [header, ...dataRows] = rows;
  const { columns, ignoredHeaders, fatalErrors } = resolveHeaders(header.cells, header.row);
  if (fatalErrors.length) {
    return emptyResult(fatalErrors, delimiter, { totalRows: dataRows.length, ignoredHeaders });
  }
  if (dataRows.length > limits.maxDataRows) {
    return emptyResult([csvError(
      "too_many_rows",
      `Le fichier contient ${dataRows.length} lignes : la limite est de ${limits.maxDataRows} athlètes par import.`,
    )], delimiter, { totalRows: dataRows.length, ignoredHeaders });
  }

  const errors = [];
  const entries = [];
  const seenEmails = new Set(
    (options.existingEmails ?? []).map((email) => cleanField(email).toLowerCase()).filter(Boolean),
  );
  let duplicateRows = 0;

  dataRows.forEach(({ cells, row }) => {
    const { athlete, error } = buildAthlete(cells, columns, row, limits);
    if (error) {
      errors.push(error);
      return;
    }

    if (athlete.email && seenEmails.has(athlete.email)) {
      duplicateRows += 1;
      errors.push(csvError(
        "duplicate_email",
        `L'adresse « ${athlete.email} » est déjà utilisée ; cette ligne a été ignorée.`,
        row,
      ));
      return;
    }

    if (athlete.email) seenEmails.add(athlete.email);
    entries.push({ row, athlete });
  });

  const warnings = ignoredHeaders.length
    ? [{
        code: "ignored_headers",
        message: `Colonnes non reconnues et ignorées : ${ignoredHeaders.join(", ")}.`,
      }]
    : [];

  return {
    athletes: entries.map(({ athlete }) => athlete),
    entries,
    errors,
    fatalErrors: [],
    warnings,
    canImport: entries.length > 0,
    meta: {
      delimiter,
      totalRows: dataRows.length,
      validRows: entries.length,
      invalidRows: errors.length,
      duplicateRows,
      ignoredHeaders,
    },
  };
}

export function validateAthleteCsvFile(file, limits = ATHLETE_CSV_LIMITS) {
  if (!file) return csvError("missing_file", "Choisis un fichier CSV.");
  const fileName = String(file.name ?? "").toLowerCase();
  if (!fileName.endsWith(".csv")) {
    return csvError("invalid_file_type", "Format non pris en charge : choisis un fichier .csv (pas un fichier Excel .xlsx).");
  }
  if (!file.size) return csvError("empty_file", "Le fichier CSV est vide.");
  if (file.size > limits.maxFileBytes) {
    return csvError("file_too_large", `Le fichier dépasse la limite de ${Math.round(limits.maxFileBytes / 1024 / 1024)} Mo.`);
  }
  return null;
}

export function getAthleteCsvTemplate() {
  return [
    "Nom complet;Email;Âge;Discipline principale;Disciplines secondaires;Groupe;Niveau",
    "Nora Vandenberghe;nora@example.com;21;100 m;200 m | 4 × 100 m;Sprint;National",
    "Liam Dubois;liam@example.com;19;Saut en longueur;;Sauts;Régional",
  ].join("\r\n");
}

/** Convertit le numéro ordinal du payload RPC vers la vraie ligne du CSV. */
export function getAthleteCsvImportError(error, sourceRows = []) {
  const rawMessage = typeof error?.message === "string" && error.message.trim()
    ? error.message.trim()
    : "L'import a été refusé par le serveur. Vérifie le fichier puis réessaie.";
  const message = rawMessage.replace(/\bLigne\s+(\d+)\b/giu, (match, ordinalText) => {
    const ordinal = Number(ordinalText);
    const csvRow = sourceRows[ordinal - 1];
    return Number.isInteger(csvRow) && csvRow > 0 ? `Ligne ${csvRow} du CSV` : match;
  });
  return new Error(message);
}
