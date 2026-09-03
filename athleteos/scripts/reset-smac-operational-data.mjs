/* global process, URL, console */
import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertLocalUrl(value) {
  const parsed = new URL(value);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(`Refus de sécurité : l’URL Supabase doit être locale, reçu ${parsed.hostname}.`);
  }
}

if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL/VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
assertLocalUrl(supabaseUrl);
if (execute && process.env.CONFIRM_RESET_CLUB_DATA !== "SMAC") {
  throw new Error("Pour exécuter, définis exactement CONFIRM_RESET_CLUB_DATA=SMAC.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const { data: clubs, error: clubError } = await supabase.from("clubs").select("id, name").ilike("name", "SMAC");
if (clubError) throw clubError;
if (clubs?.length !== 1) throw new Error(`Un unique club SMAC est requis, trouvé : ${clubs?.length ?? 0}.`);
const club = clubs[0];

const { data: preview, error: previewError } = await supabase.rpc("preview_club_operational_reset", { p_club_id: club.id });
if (previewError) throw previewError;
console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", preview }, null, 2));

if (execute) {
  const { data: result, error } = await supabase.rpc("reset_club_operational_data", {
    p_club_id: club.id,
    p_confirmation: "SMAC",
  });
  if (error) throw error;
  console.log(JSON.stringify(result, null, 2));
}
