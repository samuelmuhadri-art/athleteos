import { describe, it, expect } from "vitest";
import { normalizeDashboardPreferences, scopeDashboardData } from "./dashboardPreferences";

describe("dashboard preferences", () => {
  it("preserves the existing default order and seven-day feedback window", () => {
    expect(normalizeDashboardPreferences(null)).toEqual({ order:["priorities","wellness","overview","followup"], hidden:[], defaultGroup:null, feedbackDays:7 });
  });
  it("normalizes obsolete, duplicate and malformed preferences", () => {
    expect(normalizeDashboardPreferences({ order:["overview","unknown","overview"], hidden:["goals","unknown","goals"], defaultGroup:12, feedbackDays:365 })).toEqual({ order:["overview","priorities","wellness","followup"], hidden:["goals"], defaultGroup:null, feedbackDays:7 });
    expect(normalizeDashboardPreferences([])).toEqual(normalizeDashboardPreferences(null));
  });
  it("keeps supported periods and group names", () => {
    for (const feedbackDays of [7,14,28]) expect(normalizeDashboardPreferences({ feedbackDays,defaultGroup:"Sauts" })).toMatchObject({ feedbackDays,defaultGroup:"Sauts" });
  });
  it("scopes every dataset, shared sessions and competitions without mutating club data", () => {
    const data = { athletes:[{id:1,group:"Sprint"},{id:2,group:"Sauts"}], sessions:[{athleteIds:[1,2],validations:[{athleteId:1},{athleteId:2}]},{athleteIds:[2],validations:[]}], competitions:[{athleteIds:[1,2]}], weeklyCharge:[{athleteId:1},{athleteId:2}], wellnessRows:[{athleteId:1},{athleteId:2}], injuries:[{athleteId:2}], goals:[{athlete_id:1},{athlete_id:2}], alerts:[{athlete_id:1},{athlete_id:2},{athlete_id:null}] };
    const result = scopeDashboardData(data,"Sprint");
    expect(result.athletes).toHaveLength(1);
    expect(result.sessions).toEqual([{athleteIds:[1],validations:[{athleteId:1}]}]);
    expect(result.competitions).toEqual([{athleteIds:[1]}]);
    expect(result.weeklyCharge).toEqual([{athleteId:1}]);
    expect(result.wellnessRows).toEqual([{athleteId:1}]);
    expect(result.injuries).toEqual([]);
    expect(result.goals).toEqual([{athlete_id:1}]);
    expect(result.alerts).toEqual([{athlete_id:1},{athlete_id:null}]);
    expect(data.sessions[0].athleteIds).toEqual([1,2]);
    expect(scopeDashboardData(data,null)).toBe(data);
  });
});
