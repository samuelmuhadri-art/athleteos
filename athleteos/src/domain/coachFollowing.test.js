import { describe, expect, it } from "vitest";
import { followedAthletes } from "./coachFollowing";
const athletes=[{id:1,group:"Sprint"},{id:2,group:"Sauts"},{id:3,group:null}];
describe("Suivi organisationnel", () => {
  it("préserve le club pour le responsable et sans configuration", () => {
    expect(followedAthletes(athletes,null)).toBe(athletes);
    expect(followedAthletes(athletes,{role:"head_coach",mode:"assigned"})).toBe(athletes);
  });
  it("combine groupes et exceptions sans doublons", () => {
    expect(followedAthletes(athletes,{mode:"assigned",groups:["Sprint"],athleteIds:["1",3]})).toEqual([athletes[0],athletes[2]]);
  });
  it("suit un changement de groupe et accepte un suivi vide", () => {
    expect(followedAthletes(athletes,{mode:"assigned",groups:["Demi-fond"]})).toEqual([]);
    expect(followedAthletes(athletes,{mode:"assigned",groups:[],athleteIds:[]})).toEqual([]);
  });
});
