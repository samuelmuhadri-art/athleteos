import { describe, expect, it } from "vitest";
import { buildCoachFeed } from "./coachFeed";

describe("file d'actions du coach", () => {
  it("place les tâches concrètes avant les analyses descriptives et conserve leur destination", () => {
    const items = buildCoachFeed({
      athletes: [{ id: 7, name: "Alicia Martin" }],
      weeklyCharge: [],
      currentWeek: 31,
      now: new Date("2026-07-29T10:00:00+02:00"),
      alerts: [{ id: 1, is_read: false, severity: "high" }],
      injuries: [{ id: 2, athleteId: 7, name: "Cheville", intensity: 5, status: "actif" }],
      competitions: [{ id: 3, name: "Meeting de Bruxelles", date: "2026-08-03", athleteIds: [7] }],
      sessions: [
        {
          id: 4, week: 31, sessionDate: "2026-08-01", createdByAthlete: true,
          athleteIds: [7], validations: [{ athleteId: 7, rsvpStatus: null, attendanceStatus: null }],
        },
        {
          id: 5, week: 31, sessionDate: "2026-07-28", createdByAthlete: false,
          athleteIds: [7], validations: [{ athleteId: 7, rsvpStatus: "going", attendanceStatus: null }],
        },
      ],
    });

    expect(items.slice(0, 6).map(item => item.label)).toEqual([
      "Alertes à lire",
      "Réponses manquantes",
      "Blessure active",
      "Séances à compléter",
      "Validations",
      "Compétition proche",
    ]);
    expect(items.slice(0, 6).map(item => item.route)).toEqual([
      "alerts", "planning", "athletes", "planning", "planning", "competitions",
    ]);
  });

  it("affiche une file vide quand aucune donnée ne demande d'action", () => {
    expect(buildCoachFeed({ currentWeek: 31, now: new Date("2026-07-29T10:00:00+02:00") })).toEqual([]);
  });

  it("ne présente pas une séance planifiée aujourd'hui comme déjà incomplète", () => {
    const items = buildCoachFeed({
      currentWeek: 31,
      now: new Date("2026-07-29T10:00:00+02:00"),
      sessions: [{
        id: 8, week: 31, sessionDate: "2026-07-29", lifecycleStatus: "planned",
        athleteIds: [7], validations: [{ athleteId: 7, rsvpStatus: "going", attendanceStatus: null }],
      }],
    });

    expect(items.find(item => item.id === "incomplete-sessions")).toBeUndefined();
  });
});
