import { describe, expect, it } from "vitest";
import { buildCoachFeed } from "../utils/coachFeed";

describe("charge synthétique d'un club de 200 athlètes", () => {
  it("construit la file coach sans blocage perceptible", () => {
    const athletes = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, name: `Athlète ${index + 1}` }));
    const weekDates = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
    const sessions = athletes.flatMap(athlete => Array.from({ length: 7 }, (_, day) => ({
      id: athlete.id * 10 + day,
      week: 31,
      sessionDate: weekDates[day],
      athleteIds: [athlete.id],
      validations: [{ athleteId: athlete.id, status: day < 2 ? "none" : "done", rsvpStatus: "going" }],
      category: "technique",
      durationMinutes: 60,
    })));

    const startedAt = performance.now();
    const feed = buildCoachFeed({
      athletes,
      sessions,
      currentWeek: 31,
      currentYear: 2026,
      now: new Date("2026-07-29T10:00:00+02:00"),
    });
    const elapsedMs = performance.now() - startedAt;

    expect(feed.filter(item => item.label === "Absences répétées")).toHaveLength(200);
    expect(elapsedMs).toBeLessThan(3_000);
  });
});
