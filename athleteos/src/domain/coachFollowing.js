// Following is organisational, never an authorisation decision.
export function followedAthletes(athletes, coach) {
  if (!coach || coach.role === "head_coach" || coach.mode !== "assigned") return athletes;
  const groups = new Set(coach.groups ?? []);
  const ids = new Set((coach.athleteIds ?? []).map(String));
  return athletes.filter((athlete) => groups.has(athlete.group) || ids.has(String(athlete.id)));
}
