#!/usr/bin/env node
// ============================================================
// AthleteOS — test_send_push_regression.mjs
//
// Vérifie l'autorisation de l'Edge Function send-push (tâche 2) :
//   - un appel sans authentification est refusé (401)
//   - un athlète ne peut pas cibler un athlète d'un autre club (403)
//   - un athlète PEUT cibler lui-même, un coéquipier de son club, ou le
//     coach de son club (200) — cas réels : auto-notif récap hebdo,
//     messagerie inter-athlètes, post club, message au coach
//   - un athlète ne peut pas cibler un user non-coach par userIds (403)
//   - un coach du club A ne peut pas cibler un athlète du club B (403)
//   - un coach du club A peut cibler ses propres athlètes (200)
//   - un payload surdimensionné est refusé (400/413)
//   - une origine navigateur non autorisée est refusée (403, CORS)
//   - le chemin cron (secret service_role) fonctionne toujours (200)
//
// Crée deux clubs + un coach + un athlète (avec compte de connexion) +
// un athlète cible dans l'autre club, appelle la fonction déployée en
// HTTP direct (comme le fait weekly-cron), puis nettoie tout.
//
// Prérequis : la fonction send-push doit être déployée sur le projet
// Supabase ciblé par VITE_SUPABASE_URL (ce script ne déploie rien).
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_send_push_regression.mjs
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

const SUPABASE_URL    = process.env.VITE_SUPABASE_URL;
const ANON_KEY        = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY " +
    "(dans .env) et SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
  );
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-push`;

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

async function getAccessToken(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email} : ${error.message}`);
  return { token: data.session.access_token, client };
}

async function callSendPush(token, payload) {
  const headers = { "Content-Type": "application/json", apikey: ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(FUNCTION_URL, { method: "POST", headers, body: JSON.stringify(payload) });
  let body = null;
  try { body = await res.json(); } catch { /* pas de corps JSON */ }
  return { status: res.status, body };
}

async function main() {
  let clubA, clubB, coachAuth, athleteAuth, coachUser, athleteUser, athleteA, athleteB, athleteC;
  let coachAClient, athleteAClient;

  try {
    // ── Setup : deux clubs, un coach + un athlète (club A), un athlète cible (club B) ──
    clubA = await insertOrThrow("clubs", { name: `SendPush Test Club A ${RUN_ID}` });
    clubB = await insertOrThrow("clubs", { name: `SendPush Test Club B ${RUN_ID}` });

    const coachEmail   = `send-push-test-coach-${RUN_ID}@example.invalid`;
    const athleteEmail = `send-push-test-athlete-${RUN_ID}@example.invalid`;
    const password = `SendPush-Test-${RUN_ID}-Aa!`;

    const { data: ca, error: caErr } = await admin.auth.admin.createUser({ email: coachEmail, password, email_confirm: true });
    if (caErr) throw new Error(`createUser coach : ${caErr.message}`);
    coachAuth = ca.user;
    const { data: aa, error: aaErr } = await admin.auth.admin.createUser({ email: athleteEmail, password, email_confirm: true });
    if (aaErr) throw new Error(`createUser athlete : ${aaErr.message}`);
    athleteAuth = aa.user;

    coachUser = await insertOrThrow("users", { club_id: clubA.id, name: "Coach (test send-push)", email: coachEmail, role: "head_coach", auth_uid: coachAuth.id });
    athleteUser = await insertOrThrow("users", { club_id: clubA.id, name: "Athlete (test send-push)", email: athleteEmail, role: "athlete", auth_uid: athleteAuth.id });

    athleteA = await insertOrThrow("athletes", { club_id: clubA.id, name: "Athlete A (test send-push)", user_id: athleteUser.id });
    athleteB = await insertOrThrow("athletes", { club_id: clubB.id, name: "Athlete B (test send-push)" });
    // Coéquipier d'athleteA, même club — cible légitime pour la messagerie
    // inter-athlètes et le post club (notifyClubNewPost/notifyAthleteMessage).
    athleteC = await insertOrThrow("athletes", { club_id: clubA.id, name: "Athlete C, teammate (test send-push)" });

    // Abonnement factice pour athleteA — l'envoi web-push échouera (endpoint
    // invalide) mais ça n'affecte pas le code HTTP retourné par la fonction
    // (Promise.allSettled avale l'échec individuel), donc suffisant pour
    // vérifier l'autorisation sans dépendre d'un vrai navigateur.
    await insertOrThrow("push_subscriptions", {
      club_id: clubA.id, athlete_id: athleteA.id,
      endpoint: `https://example.invalid/push/${RUN_ID}`, p256dh: "x", auth: "y",
    });

    const coachSession   = await getAccessToken(coachEmail, password);
    const athleteSession = await getAccessToken(athleteEmail, password);
    coachAClient   = coachSession.client;
    athleteAClient = athleteSession.client;
    const coachToken   = coachSession.token;
    const athleteToken = athleteSession.token;

    const basePayload = { title: "Test send-push", body: "Vérification autorisation." };

    // ── 1. Appel sans authentification -> 401 ────────────────────────
    {
      const { status } = await callSendPush(null, { ...basePayload, athleteIds: [athleteA.id] });
      record("Appel sans auth -> 401", status === 401, `status=${status}`);
    }

    // ── 2. Athlète tentant un envoi arbitraire (athleteIds hors club) -> 403 ──
    {
      const { status } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteB.id] });
      record("Athlète envoi arbitraire (athlète club B) -> 403", status === 403, `status=${status}`);
    }

    // ── 2bis. Cas légitimes : athlète vers lui-même / vers un coéquipier (même club) -> succès ──
    // (auto-notif de récap hebdo, messagerie inter-athlètes, post club — voir
    // src/AthleteApp.jsx, src/athlete/views/AthleteMsgerie.jsx et AthleteClub.jsx)
    {
      const { status } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteA.id] });
      record("Athlète -> lui-même (même club) -> 200", status === 200, `status=${status}`);
    }
    {
      const { status } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteC.id] });
      record("Athlète -> coéquipier (même club) -> 200", status === 200, `status=${status}`);
    }
    {
      const { status } = await callSendPush(athleteToken, { ...basePayload, userIds: [coachUser.id] });
      record("Athlète -> coach de son club (userIds) -> 200", status === 200, `status=${status}`);
    }
    {
      const { status } = await callSendPush(athleteToken, { ...basePayload, userIds: [athleteUser.id] });
      record("Athlète -> userIds d'un non-coach -> 403", status === 403, `status=${status}`);
    }

    // ── 3. Coach club A ciblant un athlète du club B -> 403 ──────────
    {
      const { status } = await callSendPush(coachToken, { ...basePayload, athleteIds: [athleteB.id] });
      record("Coach club A -> athlète club B -> 403", status === 403, `status=${status}`);
    }

    // ── 4. Coach club A ciblant ses propres athlètes -> succès ───────
    {
      const { status } = await callSendPush(coachToken, { ...basePayload, athleteIds: [athleteA.id] });
      record("Coach club A -> son athlète -> 200", status === 200, `status=${status}`);
    }

    // ── 5. Payload surdimensionné -> 400/413 ──────────────────────────
    {
      const { status } = await callSendPush(coachToken, {
        ...basePayload, athleteIds: [athleteA.id], title: "x".repeat(50_000),
      });
      record("Payload surdimensionné -> 400/413", status === 400 || status === 413, `status=${status}`);
    }

    // ── Bonus : chemin cron (secret service_role) toujours fonctionnel ──
    {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ ...basePayload, athleteIds: [athleteA.id] }),
      });
      record("Cron (Bearer service_role) -> 200", res.status === 200, `status=${res.status}`);
    }

    // ── Bonus : origine navigateur non autorisée -> 403 (CORS) ──────
    {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", apikey: ANON_KEY,
          Authorization: `Bearer ${coachToken}`, Origin: "https://evil-untrusted-origin.example",
        },
        body: JSON.stringify({ ...basePayload, athleteIds: [athleteA.id] }),
      });
      record("Origine non autorisée -> 403", res.status === 403, `status=${res.status}`);
    }

  } finally {
    console.log("\nNettoyage...");
    if (coachAClient)   await coachAClient.auth.signOut().catch(() => {});
    if (athleteAClient) await athleteAClient.auth.signOut().catch(() => {});
    // Cascade FK sur athlete_id : nettoie push_subscriptions automatiquement.
    if (athleteA)    await admin.from("athletes").delete().eq("id", athleteA.id);
    if (athleteB)    await admin.from("athletes").delete().eq("id", athleteB.id);
    if (athleteC)    await admin.from("athletes").delete().eq("id", athleteC.id);
    if (coachUser)   await admin.from("users").delete().eq("id", coachUser.id);
    if (athleteUser) await admin.from("users").delete().eq("id", athleteUser.id);
    if (coachAuth)   await admin.auth.admin.deleteUser(coachAuth.id).catch(() => {});
    if (athleteAuth) await admin.auth.admin.deleteUser(athleteAuth.id).catch(() => {});
    if (clubA)       await admin.from("clubs").delete().eq("id", clubA.id);
    if (clubB)       await admin.from("clubs").delete().eq("id", clubB.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) send-push détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nAucune fuite d'autorisation détectée sur send-push.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
