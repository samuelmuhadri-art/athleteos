#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function loadDotEnv(filePath) {
  let source;
  try { source = readFileSync(filePath, "utf8"); } catch { return; }
  for (const rawLine of source.split("\n")) {
    const match = rawLine.replace(/\r$/, "").match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.API_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Variables Supabase locales manquantes (URL, anon key et service-role key). ");
}

const hostname = new URL(SUPABASE_URL).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error(`Test refusé : la cible Supabase doit être locale, reçu ${hostname}.`);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = Date.now();
const results = [];

function record(label, pass, detail = "") {
  results.push({ label, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function insertOne(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`Insertion ${table}: ${error.message}`);
  return data;
}

async function makeAuthenticatedUser(clubId, role, label) {
  const email = `modules-${label}-${runId}@example.invalid`;
  const password = `Modules-${runId}-Aa!`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw authError;
  const row = await insertOne("users", {
    club_id: clubId,
    name: `Modules ${label}`,
    email,
    role,
    auth_uid: authData.user.id,
  });
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { auth: authData.user, row, client };
}

async function main() {
  let club;
  let otherClub;
  let athlete;
  let otherAthlete;
  const identities = [];

  try {
    const { count: existingSmac, error: existingError } = await admin
      .from("clubs")
      .select("id", { count: "exact", head: true })
      .ilike("name", "SMAC");
    if (existingError) throw existingError;
    if (existingSmac !== 0) throw new Error("Un club SMAC existe déjà dans la base locale; test annulé sans modification.");

    club = await insertOne("clubs", { name: "SMAC", invite_code: `SM${String(runId).slice(-6)}` });
    otherClub = await insertOne("clubs", { name: `Modules Other ${runId}` });
    const head = await makeAuthenticatedUser(club.id, "head_coach", "head"); identities.push(head);
    const coach = await makeAuthenticatedUser(club.id, "coach", "coach"); identities.push(coach);
    const athleteIdentity = await makeAuthenticatedUser(club.id, "athlete", "athlete"); identities.push(athleteIdentity);
    athlete = await insertOne("athletes", {
      club_id: club.id,
      user_id: athleteIdentity.row.id,
      name: "Athlète modules",
    });
    otherAthlete = await insertOne("athletes", { club_id: otherClub.id, name: "Athlète hors club" });

    const { data: initialClubModules, error: initialClubError } = await head.client
      .from("club_modules")
      .select("module_key, enabled")
      .eq("club_id", club.id);
    record(
      "Nouveau club rétrocompatible : 10 modules actifs",
      !initialClubError && initialClubModules?.length === 10 && initialClubModules.every((row) => row.enabled),
      initialClubError?.message,
    );

    const clubSelection = ["planning", "session_feedback", "wellness", "health", "messaging", "reports", "gamification"];
    const { error: configureClubError } = await head.client.rpc("configure_my_club_modules", {
      p_enabled_module_keys: clubSelection,
    });
    record("Le head coach configure les modules du club", !configureClubError, configureClubError?.message);

    const { data: configuredClub } = await admin
      .from("clubs")
      .select("modules_configured_at")
      .eq("id", club.id)
      .single();
    record("L’onboarding est marqué comme terminé", Boolean(configuredClub?.modules_configured_at));

    const { error: dependencyError } = await head.client.rpc("configure_my_club_modules", {
      p_enabled_module_keys: ["planning", "training_load"],
    });
    record("La charge sans feedback est refusée", Boolean(dependencyError), dependencyError?.message);

    const { error: coachClubError } = await coach.client.rpc("configure_my_club_modules", {
      p_enabled_module_keys: ["planning"],
    });
    record("Un coach simple ne reconfigure pas le club", Boolean(coachClubError), coachClubError?.message);

    const athleteSelection = ["planning", "session_feedback", "health"];
    const { error: configureAthleteError } = await coach.client.rpc("configure_athlete_modules", {
      p_athlete_ids: [athlete.id],
      p_enabled_module_keys: athleteSelection,
    });
    record("Le coach configure un athlète individuellement", !configureAthleteError, configureAthleteError?.message);

    const { error: configureByToolError } = await coach.client.rpc("configure_module_athletes", {
      p_module_key: "gamification",
      p_enabled_athlete_ids: [athlete.id],
    });
    const { data: gamificationState } = await admin.from("athlete_modules")
      .select("enabled")
      .eq("athlete_id", athlete.id)
      .eq("module_key", "gamification")
      .single();
    record(
      "Le parcours outil vers athlètes utilise la même matrice",
      !configureByToolError && gamificationState?.enabled === true,
      configureByToolError?.message,
    );

    const { error: foreignAthleteError } = await coach.client.rpc("configure_athlete_modules", {
      p_athlete_ids: [otherAthlete.id],
      p_enabled_module_keys: athleteSelection,
    });
    record("Le coach ne configure pas un athlète d’un autre club", Boolean(foreignAthleteError), foreignAthleteError?.message);

    const { error: athleteConfigureError } = await athleteIdentity.client.rpc("configure_athlete_modules", {
      p_athlete_ids: [athlete.id],
      p_enabled_module_keys: athleteSelection,
    });
    record("L’athlète ne modifie pas lui-même sa matrice", Boolean(athleteConfigureError), athleteConfigureError?.message);

    const { data: ownMatrix, error: ownMatrixError } = await athleteIdentity.client
      .from("athlete_modules")
      .select("athlete_id, module_key, enabled");
    record(
      "L’athlète lit uniquement sa propre matrice",
      !ownMatrixError && ownMatrix?.length === 10 && ownMatrix.every((row) => row.athlete_id === athlete.id),
      ownMatrixError?.message,
    );

    const { data: directUpdate, error: directUpdateError } = await coach.client
      .from("athlete_modules")
      .update({ enabled: true })
      .eq("athlete_id", athlete.id)
      .eq("module_key", "wellness")
      .select();
    record(
      "Le contournement direct de la RPC est bloqué",
      Boolean(directUpdateError) || (directUpdate ?? []).length === 0,
      directUpdateError?.message,
    );

    const { error: wellnessWriteError } = await athleteIdentity.client.from("athlete_wellness").insert({
      athlete_id: athlete.id,
      club_id: club.id,
      date: "2026-09-02",
      sleep: 4,
      energy: 4,
      soreness: 3,
      mood: 4,
      stress: 2,
    });
    record("Une écriture wellness désactivée est bloquée côté serveur", Boolean(wellnessWriteError), wellnessWriteError?.message);

    const { error: socialWriteError } = await athleteIdentity.client.from("social_posts").insert({
      athlete_id: athlete.id,
      club_id: club.id,
      content: "Cette publication doit être bloquée",
    });
    record("Une écriture sociale désactivée au club est bloquée", Boolean(socialWriteError), socialWriteError?.message);

    const { error: suppressedError } = await admin.from("athlete_notifications").insert({
      athlete_id: athlete.id,
      club_id: club.id,
      type: "wellness",
      title: "Notification supprimée",
    });
    const { count: suppressedCount } = await admin
      .from("athlete_notifications")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("title", "Notification supprimée");
    record("Les notifications d’un module désactivé sont supprimées", !suppressedError && suppressedCount === 0, suppressedError?.message);

    await insertOne("athlete_notifications", {
      athlete_id: athlete.id,
      club_id: club.id,
      type: "new_session",
      title: "Notification planning conservée",
    });
    const session = await insertOne("sessions", {
      club_id: club.id,
      title: "Séance à nettoyer",
      category: "sprint",
      week: 36,
      duration_minutes: 60,
      created_by: head.row.id,
    });
    await insertOne("session_athletes", { session_id: session.id, athlete_id: athlete.id, status: "planned" });
    await insertOne("athlete_wellness", {
      athlete_id: athlete.id,
      club_id: club.id,
      date: "2026-09-01",
      sleep: 3,
      energy: 3,
      soreness: 3,
      mood: 3,
      stress: 3,
    });
    await insertOne("push_subscriptions", {
      club_id: club.id,
      athlete_id: athlete.id,
      endpoint: `https://example.invalid/modules-${runId}`,
    });

    const { error: unauthorizedResetError } = await head.client.rpc("reset_club_operational_data", {
      p_club_id: club.id,
      p_confirmation: "SMAC",
    });
    record("Le reset est inaccessible sans service role", Boolean(unauthorizedResetError), unauthorizedResetError?.message);

    const { data: preview, error: previewError } = await admin.rpc("preview_club_operational_reset", {
      p_club_id: club.id,
    });
    record(
      "Le dry-run inventorie les données sans les modifier",
      !previewError && preview?.counts?.sessions === 1 && preview?.counts?.wellness === 1,
      previewError?.message,
    );

    const { data: resetResult, error: resetError } = await admin.rpc("reset_club_operational_data", {
      p_club_id: club.id,
      p_confirmation: "SMAC",
    });
    const afterCounts = Object.values(resetResult?.after?.counts ?? {});
    record(
      "Le reset opérationnel local est atomique et complet",
      !resetError && afterCounts.length > 0 && afterCounts.every((count) => count === 0),
      resetError?.message,
    );

    const [{ count: clubCount }, { count: userCount }, { count: athleteCount }, { count: moduleCount }, { count: pushCount }] = await Promise.all([
      admin.from("clubs").select("id", { count: "exact", head: true }).eq("id", club.id),
      admin.from("users").select("id", { count: "exact", head: true }).eq("club_id", club.id),
      admin.from("athletes").select("id", { count: "exact", head: true }).eq("club_id", club.id),
      admin.from("athlete_modules").select("id", { count: "exact", head: true }).eq("athlete_id", athlete.id),
      admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("athlete_id", athlete.id),
    ]);
    record(
      "Le reset préserve club, comptes, athlète, modules et abonnement push",
      clubCount === 1 && userCount === 3 && athleteCount === 1 && moduleCount === 10 && pushCount === 1,
      `club=${clubCount}, users=${userCount}, athlete=${athleteCount}, modules=${moduleCount}, push=${pushCount}`,
    );
  } finally {
    for (const identity of identities) await identity.client.auth.signOut().catch(() => {});
    if (athlete) await admin.from("athletes").delete().eq("id", athlete.id);
    if (otherAthlete) await admin.from("athletes").delete().eq("id", otherAthlete.id);
    for (const identity of identities) {
      await admin.from("users").delete().eq("id", identity.row.id);
      await admin.auth.admin.deleteUser(identity.auth.id).catch(() => {});
    }
    if (club) await admin.from("clubs").delete().eq("id", club.id);
    if (otherClub) await admin.from("clubs").delete().eq("id", otherClub.id);
  }

  const failures = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failures.length}/${results.length} vérifications modules/reset OK`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error("Erreur fatale modules/reset:", error.message ?? error);
  process.exit(1);
});
