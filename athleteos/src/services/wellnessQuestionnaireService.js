import { normalizeWellnessQuestionnaire } from "../domain/wellnessQuestionnaire";
import { supabase } from "../utils/supabaseClient";

export async function fetchWellnessQuestionnaire(date) {
  const { data, error } = await supabase.rpc("get_wellness_questionnaire", { p_date:date });
  if (error) throw error;
  return normalizeWellnessQuestionnaire(data);
}

export async function saveWellnessQuestionnaire(configuration) {
  const normalized = normalizeWellnessQuestionnaire(configuration);
  const { data, error } = await supabase.rpc("configure_wellness_questionnaire", {
    p_questions:normalized.questions,
    p_active_days:normalized.activeDays,
    p_response_visibility:normalized.responseVisibility,
  });
  if (error) throw error;
  return data;
}

export async function submitWellnessResponse({ answers, notes, date }) {
  const { data, error } = await supabase.rpc("submit_wellness_response", {
    p_answers:answers,
    p_notes:notes || null,
    p_date:date,
  });
  if (error) throw error;
  return data;
}
