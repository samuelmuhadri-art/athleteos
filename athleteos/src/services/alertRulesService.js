import { normalizeAlertRules } from "../domain/alertRules";
import { supabase } from "../utils/supabaseClient";

export async function fetchAlertRules() {
  const { data, error } = await supabase.rpc("get_club_alert_rules");
  if (error) throw error;
  return normalizeAlertRules(data);
}

export async function saveAlertRules(rules) {
  const normalized = normalizeAlertRules(rules);
  const { data, error } = await supabase.rpc("configure_club_alert_rules", { p_rules:normalized });
  if (error) throw error;
  return normalizeAlertRules(data);
}

export async function evaluateAlertRules() {
  const { data, error } = await supabase.rpc("evaluate_club_alert_rules", {
    p_club_id:null,
    p_dry_run:false,
  });
  if (error) throw error;
  return data;
}
