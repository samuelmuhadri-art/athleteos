// ============================================================
// AthleteOS — e2e/global-setup.mjs
//
// Crée 2 comptes éphémères RÉELS (auth + profil) avant les specs E2E
// authentifiées (coach-journey, athlete-journey) — le seed Supabase
// (supabase/seed.sql, tâche 5) contient des lignes `users` de démo mais
// AUCUN compte auth.users/mot de passe associé (décision assumée à la
// tâche 5, "pas de compte de connexion réel dans le seed"), donc rien
// à quoi se connecter par mot de passe sans cette étape.
//
// Ne tourne QUE contre un Supabase LOCAL éphémère (CI, `supabase start`
// — jamais la production) : ce script n'est déclenché que si
// E2E_WITH_AUTH est positionné (voir playwright.config.js), lui-même
// réservé au job CI qui vient de démarrer une instance locale jetable.
// Écrit les identifiants dans e2e/.auth-fixtures.json (gitignored),
// lus ensuite par coach-journey.spec.js / athlete-journey.spec.js.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL    = process.env.VITE_SUPABASE_URL ?? process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function assertLocalSupabase(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("e2e/global-setup.mjs : URL Supabase locale invalide.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (parsed.protocol !== "http:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error(
      "e2e/global-setup.mjs : refus de créer des fixtures sur une instance Supabase non locale."
    );
  }
}

export default async function globalSetup() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "e2e/global-setup.mjs : VITE_SUPABASE_URL/API_URL et SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY " +
      "requis (instance Supabase locale — voir .github/workflows/ci.yml)."
    );
  }

  assertLocalSupabase(SUPABASE_URL);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = Date.now();
  const password = `E2E-Test-${runId}-Aa!`;

  const { data: club, error: ce } = await admin.from("clubs").insert({ name: `E2E Club ${runId}` }).select().single();
  if (ce) throw new Error(`seed club : ${ce.message}`);

  async function makeAccount(clubId, email, name, role) {
    const { data: a, error: ea } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (ea) throw new Error(`createUser ${email} : ${ea.message}`);
    const { data: u, error: eu } = await admin.from("users")
      .insert({ club_id: clubId, name, email, role, auth_uid: a.user.id }).select().single();
    if (eu) throw new Error(`insert users ${email} : ${eu.message}`);
    let athleteId = null;
    if (role === "athlete") {
      const { data: athleteRow, error: eat } = await admin.from("athletes").insert({ club_id: clubId, name, user_id: u.id, group_name: "Sprint", main_discipline: "100m" }).select().single();
      if (eat) throw new Error(`insert athletes ${email} : ${eat.message}`);
      athleteId = athleteRow.id;
    }
    return { email, password, authId: a.user.id, userId: u.id, athleteId };
  }

  const coach   = await makeAccount(club.id, `e2e-coach-${runId}@example.invalid`, "E2E Coach", "head_coach");
  const athlete = await makeAccount(club.id, `e2e-athlete-${runId}@example.invalid`, "E2E Athlete", "athlete");
  const { error: configuredError } = await admin.from("clubs")
    .update({ modules_configured_at: new Date().toISOString() })
    .eq("id", club.id);
  if (configuredError) throw new Error(`configure fixture club : ${configuredError.message}`);

  // Compte isolé réservé au scénario onboarding : il ne partage aucun état
  // avec les parcours de navigation exécutés en parallèle.
  const { data: onboardingClub, error: onboardingClubError } = await admin
    .from("clubs")
    .insert({ name: `E2E Onboarding ${runId}` })
    .select()
    .single();
  if (onboardingClubError) throw new Error(`seed onboarding club : ${onboardingClubError.message}`);
  const onboardingCoach = await makeAccount(
    onboardingClub.id,
    `e2e-onboarding-${runId}@example.invalid`,
    "E2E Onboarding Coach",
    "head_coach",
  );

  // Club isolé pour les tests de découverte des outils et de hiérarchie du
  // dashboard. Les scénarios peuvent modifier ses modules sans perturber les
  // parcours coach/athlète historiques exécutés en parallèle.
  const { data: uxClub, error: uxClubError } = await admin.from("clubs").insert({ name: `E2E UX ${runId}` }).select().single();
  if (uxClubError) throw new Error(`seed ux club : ${uxClubError.message}`);
  const uxCoach = await makeAccount(uxClub.id, `e2e-ux-coach-${runId}@example.invalid`, "Benoît Coach", "head_coach");
  const uxAthlete = await makeAccount(uxClub.id, `e2e-ux-athlete-${runId}@example.invalid`, "Antonin Leroy", "athlete");
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const competitionDate = new Date(today); competitionDate.setDate(competitionDate.getDate() + 10);
  const { data: uxSession, error: uxSessionError } = await admin.from("sessions").insert({
    club_id: uxClub.id, title: "Sprint — vitesse max", category: "sprint", time: "18:00",
    description: "6 × 40 m", instructions: "Récupération 4 min", duration_minutes: 60,
    session_date: todayDate, created_by: uxCoach.userId,
  }).select().single();
  if (uxSessionError) throw new Error(`seed ux session : ${uxSessionError.message}`);
  const { error: uxAssignmentError } = await admin.from("session_athletes").insert({ session_id: uxSession.id, athlete_id: uxAthlete.athleteId, status: "future" });
  if (uxAssignmentError) throw new Error(`seed ux assignment : ${uxAssignmentError.message}`);
  const historicalDate = new Date(today); historicalDate.setDate(historicalDate.getDate() - 7);
  const { data: historicalSession, error: historicalSessionError } = await admin.from("sessions").insert({
    club_id: uxClub.id, title: "Technique départ", category: "sprint", time: "18:00",
    duration_minutes: 45, session_date: historicalDate.toISOString().slice(0, 10), created_by: uxCoach.userId,
  }).select().single();
  if (historicalSessionError) throw new Error(`seed ux historical session : ${historicalSessionError.message}`);
  const { error: historicalAssignmentError } = await admin.from("session_athletes").insert({
    session_id: historicalSession.id, athlete_id: uxAthlete.athleteId, status: "done", rpe: 5,
    actual_duration_minutes: 45, duration_source: "reported",
  });
  if (historicalAssignmentError) throw new Error(`seed ux historical assignment : ${historicalAssignmentError.message}`);
  const { data: uxCompetition, error: uxCompetitionError } = await admin.from("competitions").insert({
    club_id: uxClub.id, name: "Meeting de Bruxelles", date: competitionDate.toISOString().slice(0, 10), location: "Bruxelles",
  }).select().single();
  if (uxCompetitionError) throw new Error(`seed ux competition : ${uxCompetitionError.message}`);
  const { error: uxCompetitionAthleteError } = await admin.from("competition_athletes").insert({ competition_id: uxCompetition.id, athlete_id: uxAthlete.athleteId, planned_event: "100 m" });
  if (uxCompetitionAthleteError) throw new Error(`seed ux competition athlete : ${uxCompetitionAthleteError.message}`);
  const { error: uxMessageError } = await admin.from("messages").insert({ sender_id: uxCoach.userId, receiver_id: uxAthlete.userId, content: "Pense à confirmer ta présence pour ce soir." });
  if (uxMessageError) throw new Error(`seed ux message : ${uxMessageError.message}`);
  const { error: uxConfiguredError } = await admin.from("clubs").update({ modules_configured_at: new Date().toISOString() }).eq("id", uxClub.id);
  if (uxConfiguredError) throw new Error(`configure ux club : ${uxConfiguredError.message}`);

  // Club dédié à la passe post-refonte. Il reste indépendant des tests qui
  // activent/désactivent les modules afin que les assertions responsive soient
  // déterministes, y compris lorsque Playwright parallélise les fichiers.
  const { data: postClub, error: postClubError } = await admin.from("clubs")
    .insert({ name: `E2E Post-refonte ${runId}` }).select().single();
  if (postClubError) throw new Error(`seed post-refonte club : ${postClubError.message}`);
  const postCoach = await makeAccount(postClub.id, `e2e-post-coach-${runId}@example.invalid`, "Benoît Coach", "head_coach");
  const postAthlete = await makeAccount(postClub.id, `e2e-post-athlete-${runId}@example.invalid`, "Antonin Leroy", "athlete");
  const { data: postSession, error: postSessionError } = await admin.from("sessions").insert({
    club_id: postClub.id, title: "Sprint — vitesse max", category: "sprint", time: "18:00",
    description: "6 × 40 m", instructions: "Récupération 4 min", duration_minutes: 60,
    session_date: todayDate, created_by: postCoach.userId,
  }).select().single();
  if (postSessionError) throw new Error(`seed post-refonte session : ${postSessionError.message}`);
  const { error: postAssignmentError } = await admin.from("session_athletes").insert({
    session_id: postSession.id, athlete_id: postAthlete.athleteId, status: "future",
  });
  if (postAssignmentError) throw new Error(`seed post-refonte assignment : ${postAssignmentError.message}`);
  const { data: postCompetition, error: postCompetitionError } = await admin.from("competitions").insert({
    club_id: postClub.id, name: "Meeting de Bruxelles", date: competitionDate.toISOString().slice(0, 10), location: "Bruxelles",
  }).select().single();
  if (postCompetitionError) throw new Error(`seed post-refonte competition : ${postCompetitionError.message}`);
  const { error: postCompetitionAthleteError } = await admin.from("competition_athletes").insert({
    competition_id: postCompetition.id, athlete_id: postAthlete.athleteId, planned_event: "100 m",
  });
  if (postCompetitionAthleteError) throw new Error(`seed post-refonte competition athlete : ${postCompetitionAthleteError.message}`);
  const { error: postMessageError } = await admin.from("messages").insert({
    sender_id: postCoach.userId, receiver_id: postAthlete.userId, content: "Pense à confirmer ta présence pour ce soir.",
  });
  if (postMessageError) throw new Error(`seed post-refonte message : ${postMessageError.message}`);
  const { error: postGoalError } = await admin.from("athlete_goals").insert({
    club_id: postClub.id, athlete_id: postAthlete.athleteId, discipline: "100 m",
    target_value: "10 s 90", deadline: competitionDate.toISOString().slice(0, 10),
  });
  if (postGoalError) throw new Error(`seed post-refonte goal : ${postGoalError.message}`);
  const { error: postConfiguredError } = await admin.from("clubs")
    .update({ modules_configured_at: new Date().toISOString() }).eq("id", postClub.id);
  if (postConfiguredError) throw new Error(`configure post-refonte club : ${postConfiguredError.message}`);

  const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
  writeFileSync(fixturesPath, JSON.stringify({
    runId,
    clubId: club.id,
    coach,
    athlete,
    onboarding: { clubId: onboardingClub.id, coach: onboardingCoach },
    ux: { clubId: uxClub.id, coach: uxCoach, athlete: uxAthlete },
    post: { clubId: postClub.id, coach: postCoach, athlete: postAthlete },
  }, null, 2));

  // Pas de nettoyage automatique ici : l'instance Supabase locale est
  // jetable (détruite en fin de job CI, `supabase stop`), donc ces comptes
  // ne survivent jamais au run — inutile d'ajouter un teardown pour une
  // base qui va disparaître de toute façon.
}
