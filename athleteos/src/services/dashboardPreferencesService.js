import { supabase } from "../utils/supabaseClient";
import { normalizeDashboardPreferences } from "../domain/dashboardPreferences";

export async function fetchDashboardPreferences() {
  const { data, error } = await supabase.rpc("get_my_dashboard_preferences");
  if (error) throw error;
  return normalizeDashboardPreferences(data);
}
export async function saveDashboardPreferences(preferences) {
  const { data, error } = await supabase.rpc("configure_my_dashboard_preferences", { p_preferences:normalizeDashboardPreferences(preferences) });
  if (error) throw error;
  return normalizeDashboardPreferences(data);
}
