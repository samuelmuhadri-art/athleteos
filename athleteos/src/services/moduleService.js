import { supabase } from "../utils/supabaseClient";

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function fetchModuleConfiguration({ clubId, role, profileId }) {
  const requests = [
    supabase.from("clubs").select("id, modules_configured_at").eq("id", clubId).single(),
    supabase.from("club_modules").select("module_key, enabled, config").eq("club_id", clubId),
  ];
  if (role === "athlete") {
    requests.push(supabase.from("athletes").select("id").eq("user_id", profileId).maybeSingle());
  } else {
    requests.push(supabase.from("athletes").select("id, name, group_name").eq("club_id", clubId).order("name"));
  }
  const [clubResult, clubModulesResult, athletesResult] = await Promise.all(requests);
  const club = throwIfError(clubResult);
  const clubModules = throwIfError(clubModulesResult);
  const athletes = role === "athlete"
    ? (athletesResult.data ? [athletesResult.data] : [])
    : throwIfError(athletesResult);
  if (athletesResult.error) throw athletesResult.error;
  const athleteIds = athletes.map((athlete) => athlete.id);
  const athleteModulesResult = athleteIds.length
    ? await supabase.from("athlete_modules").select("athlete_id, module_key, enabled, config").in("athlete_id", athleteIds)
    : { data: [], error: null };
  return {
    configuredAt: club.modules_configured_at,
    clubModules,
    athletes,
    athleteModules: throwIfError(athleteModulesResult),
  };
}

export async function saveClubModules(moduleKeys) {
  const { data, error } = await supabase.rpc("configure_my_club_modules", {
    p_enabled_module_keys: moduleKeys,
  });
  if (error) throw error;
  return data;
}

export async function saveAthleteModules(athleteIds, moduleKeys) {
  const { data, error } = await supabase.rpc("configure_athlete_modules", {
    p_athlete_ids: athleteIds,
    p_enabled_module_keys: moduleKeys,
  });
  if (error) throw error;
  return data;
}

export async function resetModuleOnboarding() {
  const { error } = await supabase.rpc("reset_my_club_module_onboarding");
  if (error) throw error;
}

