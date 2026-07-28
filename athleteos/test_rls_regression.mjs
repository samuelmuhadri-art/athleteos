#!/usr/bin/env node
// ============================================================
// AthleteOS — test_rls_regression.mjs
//
// Vérifie l'isolation par club ET l'isolation par propriétaire à
// l'intérieur d'un même club (tâche 6) :
//   1. Un coach authentifié du club A ne doit pouvoir ni lire ni
//      modifier ni supprimer aucune donnée du club B.
//   2. À l'intérieur du MÊME club, un athlète ne doit pouvoir lire/
//      modifier ni le wellness, ni les blessures, ni l'abonnement push
//      d'un coéquipier — uniquement les siens (le coach, lui, garde un
//      accès en lecture à tout le club).
//   3. Un athlète ne peut pas s'auto-attribuer un rôle différent
//      (role/club_id verrouillés côté serveur).
//   4. Un compte non-authentifié (anon) ne voit aucune donnée métier.
//   5. Les RPC (get_my_club_id/get_my_role/get_my_athlete_id) renvoient
//      la bonne valeur pour le bon appelant, directement via REST.
//
// Crée deux clubs, deux comptes coach et deux comptes athlète (même
// club A) éphémères, seed une ligne de test dans chacune des tables
// couvertes, se connecte avec la clé anon (comme le fait vraiment le
// frontend), tente les accès interdits, puis nettoie tout — succès ou
// échec.
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_rls_regression.mjs
//
// Requiert dans l'environnement (ou .env à la racine du dossier) :
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (déjà dans .env)
//   SUPABASE_SERVICE_ROLE_KEY                  (secret, jamais committé —
//                                                variable d'env locale ou
//                                                secret CI)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function loadDotEnv(filePath) {
  let text;
  try { text = readFileSync(filePath, "utf8"); } catch { return; }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL;
const ANON_KEY           = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY " +
    "(dans .env) et SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now();
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function insertOrThrow(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`seed ${table} : ${error.message}`);
  return data;
}

async function main() {
  let clubA, clubB, userA, userB, authA, authB, athleteA, athleteB, sessionB, competitionB;
  let coachAClient;
  // Tâche 6 — comptes athlète intra-club (ownership) :
  let authX, authY, userX, userY, athleteX, athleteY;
  let athleteXClient, athleteYClient, anonClient;

  try {
    // ── Setup : deux clubs, deux comptes coach ──────────────────────────────
    clubA = await insertOrThrow("clubs", { name: `RLS Test Club A ${RUN_ID}` });
    clubB = await insertOrThrow("clubs", { name: `RLS Test Club B ${RUN_ID}` });

    const emailA = `rls-test-a-${RUN_ID}@example.invalid`;
    const emailB = `rls-test-b-${RUN_ID}@example.invalid`;
    const password = `Rls-Test-${RUN_ID}-Aa!`;

    const { data: aA, error: eaA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    if (eaA) throw new Error(`createUser A : ${eaA.message}`);
    authA = aA.user;
    const { data: aB, error: eaB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (eaB) throw new Error(`createUser B : ${eaB.message}`);
    authB = aB.user;

    // RLS (voir get_my_club_id() et les policies "Club members only") lit
    // users.auth_uid (text), pas users.auth_id (uuid, colonne parallèle non
    // utilisée par le code applicatif — confirmé dans supabase/functions/signup).
    userA = await insertOrThrow("users", { club_id: clubA.id, name: "Coach A (test RLS)", email: emailA, role: "head_coach", auth_uid: authA.id });
    userB = await insertOrThrow("users", { club_id: clubB.id, name: "Coach B (test RLS)", email: emailB, role: "head_coach", auth_uid: authB.id });

    // ── Seed club A : contrôle positif (coach A doit voir SES données) ─────
    athleteA = await insertOrThrow("athletes", { club_id: clubA.id, name: "Athlete A (test RLS)" });

    // ── Seed club B : tout ce que coach A ne doit PAS pouvoir voir ──────────
    // athletes cascade (ON DELETE CASCADE) vers alerts, athlete_goals,
    // athlete_notifications, athlete_wellness, injuries, push_subscriptions,
    // records, session_athletes, social_comments, social_posts,
    // social_reactions — un seul delete suffira au nettoyage pour ces tables.
    athleteB = await insertOrThrow("athletes", { club_id: clubB.id, name: "Athlete B (test RLS)" });
    sessionB = await insertOrThrow("sessions", {
      club_id: clubB.id, title: "Séance test RLS", category: "sprint",
      week: 1, duration_minutes: 60,
    });
    await insertOrThrow("session_athletes", { session_id: sessionB.id, athlete_id: athleteB.id, rpe: 7 });
    await insertOrThrow("injuries", { athlete_id: athleteB.id, name: "Test RLS", status: "actif" });
    await insertOrThrow("records", { athlete_id: athleteB.id, discipline: "100m", sb: "11.20" });
    await insertOrThrow("alerts", { club_id: clubB.id, athlete_id: athleteB.id, type: "charge", title: "Test RLS" });
    await insertOrThrow("athlete_wellness", {
      athlete_id: athleteB.id, club_id: clubB.id, date: "2026-07-20",
      sleep: 3, energy: 3, soreness: 3, mood: 3, stress: 3,
    });
    await insertOrThrow("athlete_goals", { athlete_id: athleteB.id, club_id: clubB.id, discipline: "100m", target_value: "11.00" });
    await insertOrThrow("push_subscriptions", { club_id: clubB.id, athlete_id: athleteB.id, endpoint: `https://example.invalid/push/${RUN_ID}` });
    await insertOrThrow("athlete_notifications", { athlete_id: athleteB.id, club_id: clubB.id, type: "test", title: "Test RLS" });
    await insertOrThrow("social_posts", { athlete_id: athleteB.id, club_id: clubB.id, content: "Test RLS" });
    competitionB = await insertOrThrow("competitions", { club_id: clubB.id, name: "Compétition test RLS", date: "2026-08-01" });

    // ── Seed club A : deux comptes athlète (test d'appartenance intra-club) ─
    // X et Y sont dans le MÊME club (A) — le test n'est plus "un autre club
    // peut-il voir ?" mais "un coéquipier peut-il voir ?".
    const emailX = `rls-test-x-${RUN_ID}@example.invalid`;
    const emailY = `rls-test-y-${RUN_ID}@example.invalid`;
    const passwordXY = `Rls-Test-${RUN_ID}-Xy!`;

    const { data: aX, error: eaX } = await admin.auth.admin.createUser({ email: emailX, password: passwordXY, email_confirm: true });
    if (eaX) throw new Error(`createUser X : ${eaX.message}`);
    authX = aX.user;
    const { data: aY, error: eaY } = await admin.auth.admin.createUser({ email: emailY, password: passwordXY, email_confirm: true });
    if (eaY) throw new Error(`createUser Y : ${eaY.message}`);
    authY = aY.user;

    userX = await insertOrThrow("users", { club_id: clubA.id, name: "Athlete X (test RLS)", email: emailX, role: "athlete", auth_uid: authX.id });
    userY = await insertOrThrow("users", { club_id: clubA.id, name: "Athlete Y (test RLS)", email: emailY, role: "athlete", auth_uid: authY.id });
    athleteX = await insertOrThrow("athletes", { club_id: clubA.id, name: "Athlete X (test RLS)", user_id: userX.id });
    athleteY = await insertOrThrow("athletes", { club_id: clubA.id, name: "Athlete Y (test RLS)", user_id: userY.id });

    // Données appartenant à X uniquement — Y (même club) ne doit rien voir.
    await insertOrThrow("athlete_wellness", {
      athlete_id: athleteX.id, club_id: clubA.id, date: "2026-07-21",
      sleep: 4, energy: 4, soreness: 4, mood: 4, stress: 4,
    });
    await insertOrThrow("injuries", { athlete_id: athleteX.id, name: "Test RLS ownership", status: "actif" });
    await insertOrThrow("push_subscriptions", { club_id: clubA.id, athlete_id: athleteX.id, endpoint: `https://example.invalid/push/own-${RUN_ID}` });

    // ── Connexion en tant que coach A, avec la clé anon (comme le frontend) ─
    coachAClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: signInErr } = await coachAClient.auth.signInWithPassword({ email: emailA, password });
    if (signInErr) throw new Error(`signIn coach A : ${signInErr.message}`);

    // ── Contrôles positifs : coach A doit voir/modifier SES propres données ─
    // (sans ça, un test qui renvoie toujours "invisible" pourrait juste
    // vouloir dire que l'auth est cassée, pas que RLS fonctionne)
    {
      const { data, error } = await coachAClient.from("clubs").select("*").eq("id", clubA.id);
      record("SELECT clubs (club A, positif)", !error && (data ?? []).length === 1, error?.message);
    }
    {
      const { data, error } = await coachAClient.from("athletes").select("*").eq("id", athleteA.id);
      record("SELECT athletes (club A, positif)", !error && (data ?? []).length === 1, error?.message);
    }
    {
      const { data, error } = await coachAClient.from("athletes").update({ name: "Athlete A modifié" }).eq("id", athleteA.id).select();
      record("UPDATE athletes (club A, positif)", !error && (data ?? []).length === 1, error?.message);
    }

    // ── Checks négatifs : coach A ne doit RIEN voir du club B ────────────────
    async function checkNoRead(table, id, label = table) {
      const { data, error } = await coachAClient.from(table).select("*").eq("id", id);
      if (error) { record(`SELECT ${label} (club B)`, false, `erreur inattendue : ${error.message}`); return; }
      const leaked = (data ?? []).length > 0;
      record(`SELECT ${label} (club B)`, !leaked, leaked ? `${data.length} ligne(s) visible(s) !` : "invisible, OK");
    }

    await checkNoRead("clubs", clubB.id);
    await checkNoRead("users", userB.id);
    await checkNoRead("athletes", athleteB.id);
    await checkNoRead("sessions", sessionB.id);
    await checkNoRead("competitions", competitionB.id);
    // weekly_charge est une vue (voir migration 20260726120000/123000) — même
    // principe : sécurisée par le RLS des tables sous-jacentes (security_invoker).
    {
      const { data, error } = await coachAClient.from("weekly_charge").select("*").eq("athlete_id", athleteB.id);
      if (error) record("SELECT weekly_charge (club B)", false, `erreur inattendue : ${error.message}`);
      else record("SELECT weekly_charge (club B)", (data ?? []).length === 0, (data ?? []).length ? "visible !" : "invisible, OK");
    }

    // ── Checks négatifs : coach A ne doit rien pouvoir modifier/supprimer ───
    // (RLS bloque silencieusement — 0 ligne affectée, pas forcément d'erreur)
    async function checkNoUpdate(table, id, patch) {
      const { data, error } = await coachAClient.from(table).update(patch).eq("id", id).select();
      const affected = !error && (data ?? []).length > 0;
      record(`UPDATE ${table} (club B)`, !affected, affected ? "ligne modifiée !" : "bloqué, OK");
    }
    async function checkNoDelete(table, id) {
      const { data, error } = await coachAClient.from(table).delete().eq("id", id).select();
      const affected = !error && (data ?? []).length > 0;
      record(`DELETE ${table} (club B)`, !affected, affected ? "ligne supprimée !" : "bloqué, OK");
    }

    await checkNoUpdate("athletes", athleteB.id, { name: "HACKED" });
    await checkNoUpdate("sessions", sessionB.id, { title: "HACKED" });
    await checkNoDelete("competitions", competitionB.id);

    // ── RPC directs via REST (get_my_club_id / get_my_role) ─────────────────
    {
      const { data, error } = await coachAClient.rpc("get_my_club_id");
      record("RPC get_my_club_id() renvoie le club du coach A", !error && data === clubA.id, error?.message ?? `reçu ${data}`);
    }
    {
      const { data, error } = await coachAClient.rpc("get_my_role");
      record("RPC get_my_role() renvoie head_coach pour coach A", !error && data === "head_coach", error?.message ?? `reçu ${data}`);
    }

    // ── Connexion athlète X et Y (même club A) ──────────────────────────────
    athleteXClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    { const { error } = await athleteXClient.auth.signInWithPassword({ email: emailX, password: passwordXY }); if (error) throw new Error(`signIn X : ${error.message}`); }
    athleteYClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    { const { error } = await athleteYClient.auth.signInWithPassword({ email: emailY, password: passwordXY }); if (error) throw new Error(`signIn Y : ${error.message}`); }

    {
      const { data, error } = await athleteXClient.rpc("get_my_athlete_id");
      record("RPC get_my_athlete_id() renvoie l'athlète X pour X", !error && data === athleteX.id, error?.message ?? `reçu ${data}`);
    }

    // ── Contrôles positifs : X doit voir/modifier SES propres données ──────
    {
      const { data, error } = await athleteXClient.from("athlete_wellness").select("*").eq("athlete_id", athleteX.id);
      record("SELECT athlete_wellness (X, positif)", !error && (data ?? []).length === 1, error?.message);
    }
    {
      const { data, error } = await athleteXClient.from("athlete_wellness")
        .upsert({ athlete_id: athleteX.id, club_id: clubA.id, date: "2026-07-21", sleep: 5, energy: 5, soreness: 5, mood: 5, stress: 5 }, { onConflict: "athlete_id,date" })
        .select();
      record("UPSERT athlete_wellness (X, positif)", !error && (data ?? []).length === 1, error?.message);
    }
    {
      const { data, error } = await athleteXClient.from("injuries").insert({ athlete_id: athleteX.id, name: "Auto-signalement", status: "actif" }).select();
      record("INSERT injuries (X sur soi-même, positif)", !error && (data ?? []).length === 1, error?.message);
      if (data?.[0]) await admin.from("injuries").delete().eq("id", data[0].id);
    }

    // ── Contrôle positif : le coach voit le wellness de tout son club ──────
    {
      const { data, error } = await coachAClient.from("athlete_wellness").select("*").eq("athlete_id", athleteX.id);
      record("SELECT athlete_wellness (coach A sur athlète X, positif)", !error && (data ?? []).length >= 1, error?.message);
    }

    // ── Checks négatifs : Y ne doit RIEN voir/modifier des données de X ────
    // (même club — c'est le coeur de la tâche 6 : isolation par propriétaire,
    // pas seulement par club)
    async function checkNoReadAs(client, label, table, filterCol, filterVal, { allowPermissionDenied = false } = {}) {
      const { data, error } = await client.from(table).select("*").eq(filterCol, filterVal);
      if (error) {
        // "permission denied for table X" = bloqué au niveau GRANT Postgres,
        // avant même que RLS soit évalué — c'est le résultat ATTENDU pour anon
        // depuis que ses droits SELECT/INSERT/UPDATE/DELETE ont été révoqués
        // (tâche 6). Pour un client authentifié (coach/athlète), qui garde
        // ses GRANTs normaux, la même erreur serait en revanche suspecte.
        const isExpectedPermissionDenied = allowPermissionDenied && /permission denied/i.test(error.message);
        record(`SELECT ${label}`, isExpectedPermissionDenied, isExpectedPermissionDenied ? "accès refusé au niveau permissions, OK" : `erreur inattendue : ${error.message}`);
        return;
      }
      const leaked = (data ?? []).length > 0;
      record(`SELECT ${label}`, !leaked, leaked ? `${data.length} ligne(s) visible(s) !` : "invisible, OK");
    }
    await checkNoReadAs(athleteYClient, "athlete_wellness (X, vu par coéquipier Y)", "athlete_wellness", "athlete_id", athleteX.id);
    await checkNoReadAs(athleteYClient, "injuries (X, vu par coéquipier Y)", "injuries", "athlete_id", athleteX.id);
    await checkNoReadAs(athleteYClient, "push_subscriptions (X, vu par coéquipier Y)", "push_subscriptions", "athlete_id", athleteX.id);

    {
      const { data, error } = await athleteYClient.from("athlete_wellness").update({ notes: "HACKED" }).eq("athlete_id", athleteX.id).select();
      const affected = !error && (data ?? []).length > 0;
      record("UPDATE athlete_wellness (X modifié par Y)", !affected, affected ? "ligne modifiée !" : "bloqué, OK");
    }
    {
      const { data, error } = await athleteYClient.from("injuries").update({ status: "guéri" }).eq("athlete_id", athleteX.id).select();
      const affected = !error && (data ?? []).length > 0;
      record("UPDATE injuries (X modifié par Y)", !affected, affected ? "ligne modifiée !" : "bloqué, OK");
    }
    {
      // Y tente de signaler une blessure AU NOM de X (athlete_id forgé).
      const { data, error } = await athleteYClient.from("injuries").insert({ athlete_id: athleteX.id, name: "Forgé par Y", status: "actif" }).select();
      const inserted = !error && (data ?? []).length > 0;
      record("INSERT injuries (Y au nom de X)", !inserted, inserted ? "ligne insérée !" : "bloqué, OK");
      if (data?.[0]) await admin.from("injuries").delete().eq("id", data[0].id);
    }

    // ── Anti-escalation : un athlète ne peut pas s'auto-promouvoir ─────────
    {
      const { data, error } = await athleteYClient.from("users").update({ role: "head_coach" }).eq("id", userY.id).select();
      const escalated = !error && (data ?? []).length > 0 && data[0].role === "head_coach";
      record("UPDATE users.role (auto-promotion Y)", !escalated, escalated ? "rôle changé !" : "bloqué, OK");
    }
    {
      // Reproduction exacte du bug trouvé : forger une ligne users dans le
      // club B avec un rôle élevé, en utilisant sa propre identité (auth_uid).
      const { data, error } = await athleteYClient.from("users").insert({
        club_id: clubB.id, role: "head_coach", auth_uid: authY.id, name: "Y forgé", email: "pwn@example.invalid",
      }).select();
      const forged = !error && (data ?? []).length > 0;
      record("INSERT users (Y se forge head_coach dans club B)", !forged, forged ? "ligne insérée !" : "bloqué, OK");
      if (data?.[0]) await admin.from("users").delete().eq("id", data[0].id);
    }

    // ── anon : aucun accès à la moindre donnée métier ───────────────────────
    anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    await checkNoReadAs(anonClient, "athletes (vu par anon)", "athletes", "id", athleteA.id, { allowPermissionDenied: true });
    await checkNoReadAs(anonClient, "users (vu par anon)", "users", "id", userA.id, { allowPermissionDenied: true });
    await checkNoReadAs(anonClient, "clubs (vu par anon)", "clubs", "id", clubA.id, { allowPermissionDenied: true });

  } finally {
    // ── Nettoyage — succès ou échec, on ne laisse rien traîner ──────────────
    console.log("\nNettoyage...");
    if (coachAClient)   await coachAClient.auth.signOut().catch(() => {});
    if (athleteXClient) await athleteXClient.auth.signOut().catch(() => {});
    if (athleteYClient) await athleteYClient.auth.signOut().catch(() => {});
    // Le cascade FK sur athlete_id nettoie alerts, athlete_goals,
    // athlete_notifications, athlete_wellness, injuries, push_subscriptions,
    // records, session_athletes, social_comments, social_posts,
    // social_reactions automatiquement.
    if (athleteA)     await admin.from("athletes").delete().eq("id", athleteA.id);
    if (athleteB)     await admin.from("athletes").delete().eq("id", athleteB.id);
    if (athleteX)     await admin.from("athletes").delete().eq("id", athleteX.id);
    if (athleteY)     await admin.from("athletes").delete().eq("id", athleteY.id);
    if (sessionB)     await admin.from("sessions").delete().eq("id", sessionB.id);
    if (competitionB) await admin.from("competitions").delete().eq("id", competitionB.id);
    if (userA)        await admin.from("users").delete().eq("id", userA.id);
    if (userB)        await admin.from("users").delete().eq("id", userB.id);
    if (userX)        await admin.from("users").delete().eq("id", userX.id);
    if (userY)        await admin.from("users").delete().eq("id", userY.id);
    if (authA)        await admin.auth.admin.deleteUser(authA.id).catch(() => {});
    if (authB)        await admin.auth.admin.deleteUser(authB.id).catch(() => {});
    if (authX)        await admin.auth.admin.deleteUser(authX.id).catch(() => {});
    if (authY)        await admin.auth.admin.deleteUser(authY.id).catch(() => {});
    if (clubA)        await admin.from("clubs").delete().eq("id", clubA.id);
    if (clubB)        await admin.from("clubs").delete().eq("id", clubB.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) RLS détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nAucune fuite inter-club détectée.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
