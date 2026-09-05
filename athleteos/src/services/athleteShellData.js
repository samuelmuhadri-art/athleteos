// @ts-check
/** @typedef {import('@supabase/supabase-js').SupabaseClient<import('../types/database.types').Database>} DataClient */

/** @param {DataClient} client @param {number} clubId */
export function fetchPrimaryHeadCoach(client, clubId) {
  return client
    .from("users")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("role", "head_coach")
    .order("id", { ascending:true })
    .limit(1);
}

// Filtrer le parent avec une seconde relation : on garde les autres participants
// utiles à l'affichage, sans télécharger les séances/compétitions des autres groupes.
/** @param {DataClient} client @param {number} clubId @param {number} athleteId */
export function fetchAthleteSessions(client, clubId, athleteId) {
  return client.from("sessions")
    .select("*, membership:session_athletes!inner(athlete_id), session_athletes(*), session_documents(visibility, documents(*), session_document_recipients(athlete_id))")
    .eq("club_id", clubId).eq("membership.athlete_id", athleteId);
}

/** @param {DataClient} client @param {number} clubId @param {number} athleteId */
export function fetchAthleteCompetitions(client, clubId, athleteId) {
  return client.from("competitions")
    .select("*, membership:competition_athletes!inner(athlete_id), competition_athletes(*), competition_results(*)")
    .eq("club_id", clubId).eq("membership.athlete_id", athleteId);
}

/** @param {DataClient} client @param {number} clubId @param {number} athleteId */
export function fetchAthletePlanningEvents(client, clubId, athleteId) {
  return client.from("planning_events")
    .select("*, membership:planning_event_athletes!inner(athlete_id), planning_event_athletes(athlete_id), planning_event_documents(document_id, documents(*))")
    .eq("club_id", clubId).eq("membership.athlete_id", athleteId);
}
