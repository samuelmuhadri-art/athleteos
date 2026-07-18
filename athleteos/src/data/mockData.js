// ============================================================
// AthleteOS — Mock Data (seed brutes + données statiques)
// ⚠️ Les rawLoad sont des INPUTS bruts. Les scores (fatigue,
//    forme, acwr, readiness, risque) sont CALCULÉS dynamiquement
//    par src/utils/chargeCalculations.js — jamais affichés
//    directement depuis ce fichier.
// ============================================================

// ─────────────────────────────────────────────
// UTILISATEURS (coachs)
// ─────────────────────────────────────────────
export const coaches = [
  {
    id: "c1",
    name: "Benoît Marchal",
    role: "head_coach",       // accès complet
    avatar: "BM",
    email: "benoit.marchal@athleteos.be",
  },
  {
    id: "c2",
    name: "Vincent Lecomte",
    role: "coach",            // lecture + feedback
    avatar: "VL",
    email: "vincent.lecomte@athleteos.be",
  },
];

// ─────────────────────────────────────────────
// ATHLÈTES — 7 profils complets
// ─────────────────────────────────────────────
export const athletes = [
  // ── 1. Samuel Muhadri ──────────────────────
  {
    id: 1,
    name: "Samuel Muhadri",
    age: 22,
    avatar: "SM",
    role: "athlete",
    mainDiscipline: "Décathlon",
    secondaryDisciplines: ["Sprint", "Haies", "Saut", "Lancers"],
    group: "Deca Smac",
    level: "Espoir national",
    // Records : SB = Season Best 2025, PR = Personal Record
    records: {
      "100m":       { sb: "11.08s", pr: "10.94s", prDate: "2024-07-15" },
      "Longueur":   { sb: "7.12m",  pr: "7.35m",  prDate: "2024-08-02" },
      "Poids":      { sb: "12.90m", pr: "13.40m", prDate: "2024-05-10" },
      "Hauteur":    { sb: "1.85m",  pr: "1.91m",  prDate: "2023-09-20" },
      "400m":       { sb: "49.8s",  pr: "48.9s",  prDate: "2024-06-28" },
      "110m haies": { sb: "15.4s",  pr: "15.1s",  prDate: "2024-07-22" },
      "Disque":     { sb: "38.20m", pr: "40.10m", prDate: "2024-05-15" },
      "Perche":     { sb: "4.20m",  pr: "4.40m",  prDate: "2024-08-10" },
      "Javelot":    { sb: "52.10m", pr: "54.50m", prDate: "2024-06-05" },
      "1500m":      { sb: "4:42",   pr: "4:35",   prDate: "2023-10-01" },
      "Décathlon":  { sb: "7410 pts", pr: "7620 pts", prDate: "2024-08-12" },
    },
    // Antécédents médicaux réalistes (tendinopathie active + LCA résolu)
    injuries: [
      {
        id: 1,
        name: "Tendinopathie patellaire",
        location: "Genou droit",
        intensity: 4,         // /10
        status: "chronique",
        startDate: "2024-03-01",
        endDate: null,
        notes: "Gestion à long terme. Éviter squat complet >90°. Suivi kiné hebdomadaire.",
      },
      {
        id: 2,
        name: "Rupture LCA",
        location: "Genou gauche",
        intensity: 0,
        status: "résolu",
        startDate: "2022-09-10",
        endDate: "2023-06-01",
        notes: "Chirurgie + rééducation 9 mois. Retour complet validé juin 2023.",
      },
    ],
    // Profil athlétique (radars, 0-100)
    profile: {
      speed: 85,
      strength: 70,
      explosivity: 88,
      endurance: 60,
      technique: 72,
      recoveryRate: "normale",
      volumeTolerance: "élevée",
      intensityTolerance: "élevée",
      psychProfile: "compétitif",
    },
    // Historique de performances pour LineChart (24 mois, discipline principale)
    performanceHistory: [
      { month: "2024-01", value: 7120 }, { month: "2024-02", value: 7080 },
      { month: "2024-03", value: 7200 }, { month: "2024-04", value: 7150 },
      { month: "2024-05", value: 7280 }, { month: "2024-06", value: 7350 },
      { month: "2024-07", value: 7410 }, { month: "2024-08", value: 7620 },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 7200 }, { month: "2024-12", value: 7100 },
      { month: "2025-01", value: 7180 }, { month: "2025-02", value: 7250 },
      { month: "2025-03", value: 7310 }, { month: "2025-04", value: 7390 },
      { month: "2025-05", value: 7410 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 2. Liana M. ────────────────────────────
  {
    id: 2,
    name: "Liana Mbemba",
    age: 20,
    avatar: "LM",
    role: "athlete",
    mainDiscipline: "Saut en longueur",
    secondaryDisciplines: ["Sprint", "Haies"],
    group: "Sauts",
    level: "Régional",
    records: {
      "Longueur": { sb: "5.98m", pr: "6.12m", prDate: "2024-06-20" },
      "100m":     { sb: "12.10s", pr: "11.95s", prDate: "2024-07-05" },
      "100m haies": { sb: "14.80s", pr: "14.65s", prDate: "2023-08-18" },
    },
    injuries: [],
    profile: {
      speed: 82,
      strength: 58,
      explosivity: 80,
      endurance: 50,
      technique: 75,
      recoveryRate: "rapide",
      volumeTolerance: "modérée",
      intensityTolerance: "élevée",
      psychProfile: "régulier",
    },
    performanceHistory: [
      { month: "2024-01", value: 5.70 }, { month: "2024-02", value: 5.75 },
      { month: "2024-03", value: 5.82 }, { month: "2024-04", value: 5.90 },
      { month: "2024-05", value: 5.95 }, { month: "2024-06", value: 6.12 },
      { month: "2024-07", value: 5.98 }, { month: "2024-08", value: null  },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 5.80 }, { month: "2024-12", value: 5.85 },
      { month: "2025-01", value: 5.88 }, { month: "2025-02", value: 5.92 },
      { month: "2025-03", value: 5.95 }, { month: "2025-04", value: 5.98 },
      { month: "2025-05", value: 6.01 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 3. Théotime H. ─────────────────────────
  {
    id: 3,
    name: "Théotime Henin",
    age: 19,
    avatar: "TH",
    role: "athlete",
    mainDiscipline: "Saut en hauteur",
    secondaryDisciplines: ["Longueur"],
    group: "Sauts",
    level: "Régional",
    records: {
      "Hauteur":  { sb: "1.92m", pr: "1.96m", prDate: "2024-07-12" },
      "Longueur": { sb: "6.45m", pr: "6.60m", prDate: "2024-05-22" },
    },
    injuries: [
      {
        id: 3,
        name: "Douleur lombaire",
        location: "Bas du dos",
        intensity: 3,
        status: "en suivi",
        startDate: "2025-02-15",
        endDate: null,
        notes: "Kiné 2x/semaine. Éviter charges lourdes en extension.",
      },
    ],
    profile: {
      speed: 74,
      strength: 65,
      explosivity: 84,
      endurance: 45,
      technique: 80,
      recoveryRate: "normale",
      volumeTolerance: "modérée",
      intensityTolerance: "modérée",
      psychProfile: "analytique",
    },
    performanceHistory: [
      { month: "2024-01", value: 1.84 }, { month: "2024-02", value: 1.86 },
      { month: "2024-03", value: 1.88 }, { month: "2024-04", value: 1.90 },
      { month: "2024-05", value: 1.90 }, { month: "2024-06", value: 1.92 },
      { month: "2024-07", value: 1.96 }, { month: "2024-08", value: null  },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 1.88 }, { month: "2024-12", value: 1.86 },
      { month: "2025-01", value: 1.88 }, { month: "2025-02", value: 1.85 },
      { month: "2025-03", value: 1.87 }, { month: "2025-04", value: 1.90 },
      { month: "2025-05", value: 1.92 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 4. Juliette B. ─────────────────────────
  {
    id: 4,
    name: "Juliette Bodart",
    age: 21,
    avatar: "JB",
    role: "athlete",
    mainDiscipline: "Haies 100m",
    secondaryDisciplines: ["Sprint"],
    group: "Sprint-Haies",
    level: "Régional",
    records: {
      "100m haies": { sb: "14.02s", pr: "13.88s", prDate: "2024-07-20" },
      "100m":       { sb: "12.30s", pr: "12.18s", prDate: "2024-06-14" },
    },
    injuries: [],
    profile: {
      speed: 80,
      strength: 62,
      explosivity: 78,
      endurance: 52,
      technique: 82,
      recoveryRate: "rapide",
      volumeTolerance: "modérée",
      intensityTolerance: "élevée",
      psychProfile: "régulier",
    },
    performanceHistory: [
      { month: "2024-01", value: 14.45 }, { month: "2024-02", value: 14.38 },
      { month: "2024-03", value: 14.20 }, { month: "2024-04", value: 14.10 },
      { month: "2024-05", value: 14.02 }, { month: "2024-06", value: 13.98 },
      { month: "2024-07", value: 13.88 }, { month: "2024-08", value: null  },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 14.10 }, { month: "2024-12", value: 14.05 },
      { month: "2025-01", value: 14.00 }, { month: "2025-02", value: 13.95 },
      { month: "2025-03", value: 13.92 }, { month: "2025-04", value: 13.98 },
      { month: "2025-05", value: 14.02 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 5. Baptiste A. ─────────────────────────
  {
    id: 5,
    name: "Baptiste Arnould",
    age: 23,
    avatar: "BA",
    role: "athlete",
    mainDiscipline: "Sprint 100m/200m",
    secondaryDisciplines: ["Haies"],
    group: "Sprint-Haies",
    level: "Régional",
    records: {
      "100m": { sb: "10.75s", pr: "10.62s", prDate: "2024-08-05" },
      "200m": { sb: "21.40s", pr: "21.18s", prDate: "2024-07-28" },
      "110m haies": { sb: "14.20s", pr: "14.05s", prDate: "2023-09-10" },
    },
    injuries: [
      {
        id: 4,
        name: "Contracture ischio-jambiers",
        location: "Cuisse gauche",
        intensity: 2,
        status: "en suivi",
        startDate: "2025-04-10",
        endDate: null,
        notes: "Protocole étirements + massage. Pas de sprint à 100% jusqu'à avis médical.",
      },
    ],
    profile: {
      speed: 92,
      strength: 68,
      explosivity: 90,
      endurance: 42,
      technique: 70,
      recoveryRate: "normale",
      volumeTolerance: "faible",
      intensityTolerance: "très élevée",
      psychProfile: "compétitif",
    },
    performanceHistory: [
      { month: "2024-01", value: 11.05 }, { month: "2024-02", value: 10.95 },
      { month: "2024-03", value: 10.88 }, { month: "2024-04", value: 10.80 },
      { month: "2024-05", value: 10.75 }, { month: "2024-06", value: 10.70 },
      { month: "2024-07", value: 10.65 }, { month: "2024-08", value: 10.62 },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 10.80 }, { month: "2024-12", value: 10.75 },
      { month: "2025-01", value: 10.72 }, { month: "2025-02", value: 10.70 },
      { month: "2025-03", value: 10.75 }, { month: "2025-04", value: 10.80 },
      { month: "2025-05", value: 10.75 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 6. Emeline L. ──────────────────────────
  {
    id: 6,
    name: "Emeline Laurent",
    age: 24,
    avatar: "EL",
    role: "athlete",
    mainDiscipline: "Lancers",
    secondaryDisciplines: [],
    group: "Lancers",
    level: "Départemental",
    records: {
      "Poids":  { sb: "13.20m", pr: "13.85m", prDate: "2024-06-08" },
      "Disque": { sb: "40.50m", pr: "42.10m", prDate: "2024-07-19" },
    },
    injuries: [],
    profile: {
      speed: 52,
      strength: 88,
      explosivity: 75,
      endurance: 48,
      technique: 78,
      recoveryRate: "lente",
      volumeTolerance: "élevée",
      intensityTolerance: "élevée",
      psychProfile: "méthodique",
    },
    performanceHistory: [
      { month: "2024-01", value: 12.80 }, { month: "2024-02", value: 12.95 },
      { month: "2024-03", value: 13.10 }, { month: "2024-04", value: 13.20 },
      { month: "2024-05", value: 13.30 }, { month: "2024-06", value: 13.85 },
      { month: "2024-07", value: 13.40 }, { month: "2024-08", value: null  },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 13.00 }, { month: "2024-12", value: 13.10 },
      { month: "2025-01", value: 13.15 }, { month: "2025-02", value: 13.20 },
      { month: "2025-03", value: 13.25 }, { month: "2025-04", value: 13.20 },
      { month: "2025-05", value: 13.30 }, { month: "2025-06", value: null  },
    ],
  },

  // ── 7. Gaël D. ─────────────────────────────
  {
    id: 7,
    name: "Gaël Dubois",
    age: 21,
    avatar: "GD",
    role: "athlete",
    mainDiscipline: "Sprint / Haies",
    secondaryDisciplines: [],
    group: "Sprint-Haies",
    level: "Régional",
    records: {
      "100m":       { sb: "10.92s", pr: "10.80s", prDate: "2024-08-01" },
      "110m haies": { sb: "14.50s", pr: "14.30s", prDate: "2024-07-10" },
    },
    injuries: [
      {
        id: 5,
        name: "Douleur épaule gauche",
        location: "Épaule gauche",
        intensity: 2,
        status: "en suivi",
        startDate: "2025-05-02",
        endDate: null,
        notes: "Apparue lors de la séance muscu. Arrêt presse. Consultation ortho planifiée.",
      },
    ],
    profile: {
      speed: 86,
      strength: 65,
      explosivity: 82,
      endurance: 48,
      technique: 68,
      recoveryRate: "normale",
      volumeTolerance: "modérée",
      intensityTolerance: "élevée",
      psychProfile: "compétitif",
    },
    performanceHistory: [
      { month: "2024-01", value: 11.20 }, { month: "2024-02", value: 11.10 },
      { month: "2024-03", value: 11.00 }, { month: "2024-04", value: 10.95 },
      { month: "2024-05", value: 10.92 }, { month: "2024-06", value: 10.88 },
      { month: "2024-07", value: 10.82 }, { month: "2024-08", value: 10.80 },
      { month: "2024-09", value: null  }, { month: "2024-10", value: null  },
      { month: "2024-11", value: 10.95 }, { month: "2024-12", value: 10.90 },
      { month: "2025-01", value: 10.88 }, { month: "2025-02", value: 10.85 },
      { month: "2025-03", value: 10.90 }, { month: "2025-04", value: 10.92 },
      { month: "2025-05", value: 10.95 }, { month: "2025-06", value: null  },
    ],
  },
];

// ─────────────────────────────────────────────
// CHARGES HEBDOMADAIRES BRUTES
// rawLoad = volume × intensité × poids_type (unité interne)
// ⚠️ NE PAS afficher rawLoad comme "score de forme" —
//    les scores dérivés sont calculés dans chargeCalculations.js
// Semaines 1-20 = semaines ISO 2025 (1 = début janvier)
// ─────────────────────────────────────────────
export const weeklyCharge = [
  // ── Samuel (id:1) ──────────────────────────
  { week: 9,  athleteId: 1, rawLoad: 290 },
  { week: 10, athleteId: 1, rawLoad: 340 },
  { week: 11, athleteId: 1, rawLoad: 400 },
  { week: 12, athleteId: 1, rawLoad: 380 },
  { week: 13, athleteId: 1, rawLoad: 250 }, // Semaine allégée post-compét
  { week: 14, athleteId: 1, rawLoad: 480 },
  { week: 15, athleteId: 1, rawLoad: 520 },
  { week: 16, athleteId: 1, rawLoad: 270 }, // Décharge
  { week: 17, athleteId: 1, rawLoad: 310 },
  { week: 18, athleteId: 1, rawLoad: 445 },
  { week: 19, athleteId: 1, rawLoad: 580 },
  { week: 20, athleteId: 1, rawLoad: 490 },

  // ── Liana (id:2) ───────────────────────────
  { week: 9,  athleteId: 2, rawLoad: 220 },
  { week: 10, athleteId: 2, rawLoad: 260 },
  { week: 11, athleteId: 2, rawLoad: 310 },
  { week: 12, athleteId: 2, rawLoad: 295 },
  { week: 13, athleteId: 2, rawLoad: 200 },
  { week: 14, athleteId: 2, rawLoad: 340 },
  { week: 15, athleteId: 2, rawLoad: 370 },
  { week: 16, athleteId: 2, rawLoad: 210 },
  { week: 17, athleteId: 2, rawLoad: 245 },
  { week: 18, athleteId: 2, rawLoad: 330 },
  { week: 19, athleteId: 2, rawLoad: 410 },
  { week: 20, athleteId: 2, rawLoad: 360 },

  // ── Théotime (id:3) ────────────────────────
  { week: 9,  athleteId: 3, rawLoad: 200 },
  { week: 10, athleteId: 3, rawLoad: 230 },
  { week: 11, athleteId: 3, rawLoad: 270 },
  { week: 12, athleteId: 3, rawLoad: 240 },
  { week: 13, athleteId: 3, rawLoad: 160 },
  { week: 14, athleteId: 3, rawLoad: 290 },
  { week: 15, athleteId: 3, rawLoad: 310 },
  { week: 16, athleteId: 3, rawLoad: 180 },
  { week: 17, athleteId: 3, rawLoad: 200 },
  { week: 18, athleteId: 3, rawLoad: 280 },
  { week: 19, athleteId: 3, rawLoad: 350 }, // Légère surcharge → alerte possible
  { week: 20, athleteId: 3, rawLoad: 300 },

  // ── Juliette (id:4) ────────────────────────
  { week: 9,  athleteId: 4, rawLoad: 240 },
  { week: 10, athleteId: 4, rawLoad: 275 },
  { week: 11, athleteId: 4, rawLoad: 320 },
  { week: 12, athleteId: 4, rawLoad: 305 },
  { week: 13, athleteId: 4, rawLoad: 210 },
  { week: 14, athleteId: 4, rawLoad: 360 },
  { week: 15, athleteId: 4, rawLoad: 390 },
  { week: 16, athleteId: 4, rawLoad: 220 },
  { week: 17, athleteId: 4, rawLoad: 255 },
  { week: 18, athleteId: 4, rawLoad: 340 },
  { week: 19, athleteId: 4, rawLoad: 420 },
  { week: 20, athleteId: 4, rawLoad: 370 },

  // ── Baptiste (id:5) ────────────────────────
  { week: 9,  athleteId: 5, rawLoad: 260 },
  { week: 10, athleteId: 5, rawLoad: 300 },
  { week: 11, athleteId: 5, rawLoad: 360 },
  { week: 12, athleteId: 5, rawLoad: 280 }, // Début contracture → réduction
  { week: 13, athleteId: 5, rawLoad: 180 },
  { week: 14, athleteId: 5, rawLoad: 220 },
  { week: 15, athleteId: 5, rawLoad: 310 },
  { week: 16, athleteId: 5, rawLoad: 190 },
  { week: 17, athleteId: 5, rawLoad: 240 },
  { week: 18, athleteId: 5, rawLoad: 330 },
  { week: 19, athleteId: 5, rawLoad: 390 },
  { week: 20, athleteId: 5, rawLoad: 340 },

  // ── Emeline (id:6) ─────────────────────────
  { week: 9,  athleteId: 6, rawLoad: 280 },
  { week: 10, athleteId: 6, rawLoad: 320 },
  { week: 11, athleteId: 6, rawLoad: 390 },
  { week: 12, athleteId: 6, rawLoad: 370 },
  { week: 13, athleteId: 6, rawLoad: 250 },
  { week: 14, athleteId: 6, rawLoad: 420 },
  { week: 15, athleteId: 6, rawLoad: 460 },
  { week: 16, athleteId: 6, rawLoad: 270 },
  { week: 17, athleteId: 6, rawLoad: 300 },
  { week: 18, athleteId: 6, rawLoad: 410 },
  { week: 19, athleteId: 6, rawLoad: 490 },
  { week: 20, athleteId: 6, rawLoad: 430 },

  // ── Gaël (id:7) ────────────────────────────
  { week: 9,  athleteId: 7, rawLoad: 230 },
  { week: 10, athleteId: 7, rawLoad: 270 },
  { week: 11, athleteId: 7, rawLoad: 320 },
  { week: 12, athleteId: 7, rawLoad: 300 },
  { week: 13, athleteId: 7, rawLoad: 200 },
  { week: 14, athleteId: 7, rawLoad: 350 },
  { week: 15, athleteId: 7, rawLoad: 380 },
  { week: 16, athleteId: 7, rawLoad: 230 },
  { week: 17, athleteId: 7, rawLoad: 260 },
  { week: 18, athleteId: 7, rawLoad: 345 },
  { week: 19, athleteId: 7, rawLoad: 440 }, // Douleur épaule S20 → rawLoad impacté
  { week: 20, athleteId: 7, rawLoad: 310 },
];

// ─────────────────────────────────────────────
// SÉANCES (semaine 20 = semaine courante)
// ─────────────────────────────────────────────
export const sessions = [
  {
    id: 1,
    week: 20,
    day: "Lundi",
    time: "18:00",
    type: "Musculation jambes",
    category: "force",         // force | sprint | haies | saut | lancer | endurance | technique | mobilite | recuperation
    athleteIds: [1, 5, 7],
    title: "Séance force lourde — jambes",
    description:
      "Squat 5×3 à 85% 1RM, Romanian Deadlift 4×6, Presse 4×8. Objectif : maintien de la force en phase de charge.",
    loadWeight: 1.3,           // multiplicateur de charge (ex: force = 1.3, technique = 0.7)
    pdfUrl: null,              // simulé — pas de vrai fichier
    instructions: "Échauffement 15 min obligatoire. Surveiller les genoux de Samuel (tendinopathie).",
    validations: [
      { athleteId: 1, status: "done",    feeling: 4, fatigue: 3, comment: "Bien passé, bonnes sensations." },
      { athleteId: 5, status: "done",    feeling: 5, fatigue: 3, comment: "Prêt pour samedi." },
      { athleteId: 7, status: "partial", feeling: 3, fatigue: 4, comment: "Arrêt sur la presse — légère douleur épaule." },
    ],
  },
  {
    id: 2,
    week: 20,
    day: "Mardi",
    time: "10:00",
    type: "Sprint",
    category: "sprint",
    athleteIds: [1, 4, 5, 7],
    title: "Séance sprint — sorties de blocs",
    description:
      "Blocs : 6×30m, 4×60m à 95%. Récupération complète 6 min entre les 60m. Objectif : réactivité et temps de réaction.",
    loadWeight: 1.1,
    pdfUrl: null,
    instructions: "Ne pas dépasser 95% sur les 60m. Baptiste : surveiller les ischio.",
    validations: [
      { athleteId: 1, status: "done",    feeling: 5, fatigue: 3, comment: "Très bonnes sorties de blocs." },
      { athleteId: 4, status: "done",    feeling: 4, fatigue: 3, comment: "Bonne séance, un peu fatiguée en fin." },
      { athleteId: 5, status: "partial", feeling: 3, fatigue: 4, comment: "Arrêt à 60m sur le 3e rep — cuisse tendue." },
      { athleteId: 7, status: "done",    feeling: 4, fatigue: 3, comment: "RAS." },
    ],
  },
  {
    id: 3,
    week: 20,
    day: "Mardi",
    time: "18:00",
    type: "Saut",
    category: "saut",
    athleteIds: [1],
    title: "Perche — technique d'appel (FIXE)",
    description:
      "Séance technique spécifique perche. Appels, élan progressif, passage de barre à 4.00m. Objectif : régularité de l'élan.",
    loadWeight: 0.9,
    pdfUrl: null,
    instructions: "Séance fixe tous les mardis soir. Priorité à la technique sur la hauteur.",
    validations: [
      { athleteId: 1, status: "done", feeling: 4, fatigue: 2, comment: "Bonne session perche, élan régulier." },
    ],
  },
  {
    id: 4,
    week: 20,
    day: "Mercredi",
    time: "14:00",
    type: "Saut",
    category: "saut",
    athleteIds: [2, 3],
    title: "Longueur / Hauteur — série de sauts",
    description:
      "Longueur : 8 sauts complets avec prise de marques. Hauteur : série progressive de 1.75m à 1.95m.",
    loadWeight: 1.0,
    pdfUrl: null,
    instructions: "Théotime : attention aux lombaires. Arrêt si douleur > 3/10.",
    validations: [
      { athleteId: 2, status: "done", feeling: 5, fatigue: 2, comment: "Meilleure longueur de la saison !" },
      { athleteId: 3, status: "done", feeling: 4, fatigue: 3, comment: "Bonne sensations jusqu'à 1.92, abandon à 1.95." },
    ],
  },
  {
    id: 5,
    week: 20,
    day: "Mercredi",
    time: "10:00",
    type: "Lancer",
    category: "lancer",
    athleteIds: [6, 1],
    title: "Lancers — volume poids et disque",
    description:
      "Poids : 12 lancers max. Disque : 10 lancers avec vidéo technique. Samuel : 4 lancers poids léger uniquement.",
    loadWeight: 1.2,
    pdfUrl: null,
    instructions: "Samuel suit Emeline pour la technique. Pas de disque complet pour Samuel cette semaine.",
    validations: [
      { athleteId: 6, status: "done",    feeling: 5, fatigue: 3, comment: "PR au poids en séance !" },
      { athleteId: 1, status: "done",    feeling: 3, fatigue: 2, comment: "Technique disque à retravailler." },
    ],
  },
  {
    id: 6,
    week: 20,
    day: "Jeudi",
    time: "10:00",
    type: "Technique / Coordination",
    category: "technique",
    athleteIds: [1, 2, 3, 4, 5, 6, 7],
    title: "Séance technique collective + mobilité",
    description:
      "ABC athlétisme, exercices de coordination, drills spécifiques par discipline. 30 min mobilité guidée en fin de séance.",
    loadWeight: 0.7,
    pdfUrl: null,
    instructions: "Séance commune obligatoire. Échauffement collectif, puis groupes par discipline.",
    validations: [
      { athleteId: 1, status: "done",    feeling: 4, fatigue: 2, comment: "Bonnes corrections technique haies." },
      { athleteId: 2, status: "done",    feeling: 5, fatigue: 1, comment: "Top." },
      { athleteId: 3, status: "done",    feeling: 4, fatigue: 2, comment: "Lombaires OK pendant la séance." },
      { athleteId: 4, status: "done",    feeling: 4, fatigue: 2, comment: "RAS." },
      { athleteId: 5, status: "done",    feeling: 3, fatigue: 3, comment: "Cuisse encore un peu tendue." },
      { athleteId: 6, status: "done",    feeling: 5, fatigue: 1, comment: "Bonne détente." },
      { athleteId: 7, status: "partial", feeling: 3, fatigue: 3, comment: "Épaule gênante sur les drills de bras." },
    ],
  },
  {
    id: 7,
    week: 20,
    day: "Vendredi",
    time: "18:00",
    type: "Haies",
    category: "haies",
    athleteIds: [4, 7, 1],
    title: "Haies — séries rythmées (FIXE)",
    description:
      "5×5 haies à 90%, focus sur le rythme inter-haies. Timing avec chrono. Samuel : haies 110m basse intensité.",
    loadWeight: 1.1,
    pdfUrl: null,
    instructions: "Séance fixe tous les vendredis soir. Priorité au rythme sur la vitesse brute.",
    validations: [], // séance future ou non encore validée
  },
  {
    id: 8,
    week: 20,
    day: "Vendredi",
    time: "20:00",
    type: "Musculation haut du corps",
    category: "force",
    athleteIds: [1],
    title: "Muscu haut du corps — Samuel (après haies)",
    description:
      "Tirage vertical 4×10, Développé couché léger 3×12, Gainage 3×45s. Volume réduit en fin de semaine.",
    loadWeight: 1.0,
    pdfUrl: null,
    instructions: "Uniquement si Samuel se sent bien après les haies. Charge allégée.",
    validations: [],
  },

  // ── Semaine précédente (19) — pour historique ──
  {
    id: 9,
    week: 19,
    day: "Lundi",
    time: "18:00",
    type: "Musculation jambes",
    category: "force",
    athleteIds: [1, 5, 7],
    title: "Séance force — jambes S19",
    description: "Squat 5×5 à 80% 1RM, Fentes 4×8 par jambe, Nordic curl 3×6.",
    loadWeight: 1.3,
    pdfUrl: null,
    instructions: null,
    validations: [
      { athleteId: 1, status: "done",    feeling: 4, fatigue: 4, comment: "Semaine chargée, jambes lourdes." },
      { athleteId: 5, status: "done",    feeling: 3, fatigue: 4, comment: "Cuisse droite tendue, prévenu Benoît." },
      { athleteId: 7, status: "done",    feeling: 4, fatigue: 3, comment: "Bonne séance." },
    ],
  },
  {
    id: 10,
    week: 19,
    day: "Mardi",
    time: "10:00",
    type: "Sprint",
    category: "sprint",
    athleteIds: [1, 4, 5, 7],
    title: "Sprint — 150m répétés S19",
    description: "4×150m à 90% récup 8 min. Objectif : endurance spécifique vitesse.",
    loadWeight: 1.2,
    pdfUrl: null,
    instructions: null,
    validations: [
      { athleteId: 1, status: "done", feeling: 3, fatigue: 5, comment: "Très chargé cette semaine." },
      { athleteId: 4, status: "done", feeling: 4, fatigue: 3, comment: "OK." },
      { athleteId: 5, status: "none", feeling: null, fatigue: null, comment: "Absent — contracture." },
      { athleteId: 7, status: "done", feeling: 4, fatigue: 3, comment: "Bonne séance." },
    ],
  },
];

// ─────────────────────────────────────────────
// COMPÉTITIONS
// ─────────────────────────────────────────────
export const competitions = [
  {
    id: 1,
    name: "Meeting de Liège",
    date: "2026-05-10",
    location: "Liège, BE",
    type: "préparation",
    athleteIds: [1, 5],
    results: [
      {
        athleteId: 1,
        event: "Décathlon J1",
        result: "3 841 pts",
        context:
          "Charge S19 = 580. ACWR = 1.28. Résultat cohérent avec une phase de charge élevée.",
      },
      {
        athleteId: 5,
        event: "100m",
        result: "10.82s",
        context: "Contracture ischio en cours. Résultat prudent, pas de prise de risque.",
      },
    ],
  },
  {
    id: 2,
    name: "Championnats Provinciaux de Namur",
    date: "2026-06-07",
    location: "Namur, BE",
    type: "objectif",
    athleteIds: [1, 2, 3, 4, 5, 6, 7],
    results: [], // compétition future
  },
  {
    id: 3,
    name: "Interclubs Régionaux",
    date: "2026-05-24",
    location: "Charleroi, BE",
    type: "préparation",
    athleteIds: [2, 3, 4, 6, 7],
    results: [],
  },
  {
    id: 4,
    name: "Championnats de Belgique Espoirs",
    date: "2026-07-19",
    location: "Bruxelles, BE",
    type: "objectif A",
    athleteIds: [1],
    results: [],
  },
];

// ─────────────────────────────────────────────
// ALERTES
// ─────────────────────────────────────────────
export const alerts = [
  {
    id: 1,
    type: "blessure",
    athleteId: 7,
    title: "Douleur épaule signalée",
    description:
      "Gaël a signalé une douleur épaule gauche lors de la séance muscu du lundi. Séance partiellement réalisée. Consultation ortho à planifier.",
    date: "2026-05-12",
    severity: "modérée", // légère | modérée | critique
    isRead: false,
  },
  {
    id: 2,
    type: "surcharge",
    athleteId: 1,
    title: "Charge aiguë élevée — Samuel",
    description:
      "L'ACWR de Samuel atteint 1.28 cette semaine. La charge S19 (580) est la plus haute depuis 12 semaines. Surveiller les signaux de fatigue.",
    date: "2026-05-13",
    severity: "modérée",
    isRead: false,
  },
  {
    id: 3,
    type: "absence",
    athleteId: 5,
    title: "Absence répétée — Baptiste",
    description:
      "Baptiste a manqué la séance sprint de mardi (S19) et a réalisé partiellement la séance de lundi (S20). Contracture ischio-jambiers non résolue.",
    date: "2026-05-14",
    severity: "modérée",
    isRead: true,
  },
  {
    id: 4,
    type: "performance",
    athleteId: 2,
    title: "Performance inhabituelle — Liana",
    description:
      "Liana a réalisé son meilleur saut de la saison en séance (6.01m). Contexte favorable : ACWR = 0.92, forme ascendante. Envisager une compétition.",
    date: "2026-05-14",
    severity: "info",
    isRead: false,
  },
];

// ─────────────────────────────────────────────
// MESSAGES (fil coach ↔ athlète)
// ─────────────────────────────────────────────
export const messages = [
  {
    id: 1,
    senderId: "c1",   // Benoît
    receiverId: 1,    // Samuel
    content:
      "Samuel, belle séance de perche hier soir. Pense à bien gérer le genou ce week-end — pas de footing si la douleur dépasse 3/10.",
    date: "2026-05-13T09:30:00",
    isRead: true,
  },
  {
    id: 2,
    senderId: 1,
    receiverId: "c1",
    content:
      "Merci Benoît. Genou à 2/10 ce matin, kiné demain. Je ferai juste du vélo doux ce week-end.",
    date: "2026-05-13T10:05:00",
    isRead: true,
  },
  {
    id: 3,
    senderId: "c1",
    receiverId: 7,    // Gaël
    content:
      "Gaël, j'ai vu ton signalement pour l'épaule. Je prends un RDV ortho pour toi la semaine prochaine. D'ici là, pas de développé couché ni de presse.",
    date: "2026-05-12T18:45:00",
    isRead: false,
  },
  {
    id: 4,
    senderId: "c2",   // Vincent
    receiverId: 5,    // Baptiste
    content:
      "Baptiste, comment tu te sens sur l'ischio ? Tu peux tenter les blocs vendredi à 70% ?",
    date: "2026-05-14T08:00:00",
    isRead: false,
  },
  {
    id: 5,
    senderId: 5,
    receiverId: "c2",
    content:
      "Ça va mieux mais encore tendu. Je préfère attendre lundi pour réévaluer avec Benoît.",
    date: "2026-05-14T08:35:00",
    isRead: false,
  },
];

// ─────────────────────────────────────────────
// DONNÉES DASHBOARD — Charge groupe (6 dernières semaines)
// Ces valeurs sont des moyennes brutes du groupe par semaine,
// utilisées uniquement pour le BarChart du dashboard.
// ─────────────────────────────────────────────
export const groupWeeklyLoad = [
  { label: "S-5 (S15)", avgLoad: 380 },
  { label: "S-4 (S16)", avgLoad: 235 },
  { label: "S-3 (S17)", avgLoad: 270 },
  { label: "S-2 (S18)", avgLoad: 355 },
  { label: "S-1 (S19)", avgLoad: 440 },
  { label: "S0 (S20)",  avgLoad: 373 },
];

// ─────────────────────────────────────────────
// COULEURS DES TYPES DE SÉANCES (pour le Planning)
// ─────────────────────────────────────────────
export const sessionTypeColors = {
  sprint:       { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", label: "Sprint" },
  haies:        { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95", label: "Haies" },
  force:        { bg: "#DCFCE7", border: "#16A34A", text: "#14532D", label: "Musculation" },
  saut:         { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8", label: "Saut" },
  lancer:       { bg: "#FFEDD5", border: "#F97316", text: "#9A3412", label: "Lancer" },
  endurance:    { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", label: "Endurance" },
  technique:    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B", label: "Technique" },
  mobilite:     { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", label: "Mobilité" },
  recuperation: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569", label: "Récupération" },
};

// ─────────────────────────────────────────────
// STATUTS DE FORME (seuils pour badges UI)
// ─────────────────────────────────────────────
export const statusThresholds = {
  optimal:    { readinessMin: 75, fatigueMax: 45, label: "Optimal",        color: "#1D9E75" },
  modere:     { readinessMin: 55, fatigueMax: 65, label: "Modéré",         color: "#EF9F27" },
  fatigue:    { readinessMin: 40, fatigueMax: 80, label: "Fatigue élevée", color: "#EF9F27" },
  surcharge:  { readinessMin: 0,  fatigueMax: 100, label: "Surcharge",     color: "#E24B4A" },
  recuperation: { label: "Récupération",                                   color: "#378ADD" },
};