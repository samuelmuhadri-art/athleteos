export function fetchPrimaryHeadCoach(client, clubId) {
  return client
    .from("users")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("role", "head_coach")
    .order("id", { ascending:true })
    .limit(1);
}
