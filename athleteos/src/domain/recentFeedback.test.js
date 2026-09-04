import { describe, expect, it } from "vitest";
import { getRecentFeedbacks } from "./recentFeedback";

describe("feedbacks récents coach", () => {
  it("garde au plus 6 retours des 7 derniers jours et les trie par soumission", () => {
    const athletes = [{ id:1, name:"A" }];
    const sessions = Array.from({ length:9 }, (_, index) => ({
      id:index, sessionDate:`2026-09-${String(index + 1).padStart(2, "0")}`,
      validations:[{ athleteId:1, feeling:4, feedbackSubmittedAt:`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z` }],
    }));
    const result = getRecentFeedbacks(sessions, athletes, { now:new Date("2026-09-09T18:00:00Z") });
    expect(result).toHaveLength(6);
    expect(result.map(item => item.session.id)).toEqual([8, 7, 6, 5, 4, 3]);
  });
});
