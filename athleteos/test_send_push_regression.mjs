#!/usr/bin/env node
// ============================================================
// AthleteOS — test_send_push_regression.mjs
//
// Vérifie l'autorisation de l'Edge Function send-push (tâche 2) :
//   - un appel sans authentification est refusé (401)
//   - les anciens payloads libres sont des no-op compatibles (200, zéro envoi)
//   - seuls des événements métier persistés produisent une notification
//   - un autre acteur ne peut pas réclamer ces événements
//   - les appels concurrents et rejeux ne réclament pas deux fois le même événement
//   - un navigateur ne peut ni écrire ni réclamer directement la file serveur
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
  const messageIds = [];

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

    // Un ancien payload libre ne déclenche plus aucune livraison, quelle que soit sa cible.
    {
      const { status, body } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteB.id] });
      record("Cible arbitraire inter-clubs ignorée sans envoi", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }

    // ── 2bis. Cas légitimes : athlète vers lui-même / vers un coéquipier (même club) -> succès ──
    // (auto-notif de récap hebdo, messagerie inter-athlètes, post club — voir
    // src/AthleteApp.jsx, src/athlete/views/AthleteMsgerie.jsx et AthleteClub.jsx)
    {
      const { status, body } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteA.id] });
      record("Auto-notification inventée ignorée", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }
    {
      const { status, body } = await callSendPush(athleteToken, { ...basePayload, athleteIds: [athleteC.id], moduleKey: "invalid", url: "//evil.example", tag: "system" });
      record("Usurpation vers un coéquipier ignorée même sans module valide", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }
    {
      const { status, body } = await callSendPush(athleteToken, { ...basePayload, userIds: [coachUser.id] });
      record("Push coach inventée ignorée", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }
    {
      const { status, body } = await callSendPush(athleteToken, { ...basePayload, userIds: [athleteUser.id] });
      record("Autre vecteur userIds ignoré", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }

    // ── 3. Coach club A ciblant un athlète du club B -> 403 ──────────
    {
      const { status, body } = await callSendPush(coachToken, { ...basePayload, athleteIds: [athleteB.id] });
      record("Cible arbitraire coach inter-clubs ignorée", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }

    // ── 4. Coach club A ciblant ses propres athlètes -> succès ───────
    {
      const { status, body } = await callSendPush(coachToken, { ...basePayload, athleteIds: [athleteA.id] });
      record("Même un coach ne peut inventer une Push système", status === 200 && body.sent === 0 && body.events === 0, `status=${status}`);
    }

    {
      const forged = await athleteAClient.from("push_event_outbox").insert({ club_id: clubA.id, actor_user_id: athleteUser.id, event_type: "message_received", entity_id: 123, athlete_ids: [athleteC.id], dedupe_key: "forged" });
      const claim = await athleteAClient.rpc("claim_trusted_push_events", { p_actor_user_id: coachUser.id });
      record("File et claim inaccessibles au navigateur", Boolean(forged.error) && Boolean(claim.error));
      const reminder = await callSendPush(athleteToken, { eventType: "feedback_reminder", entityId: 1 });
      record("Athlète ne peut déclencher un rappel staff", reminder.status === 403);
    }
    {
      const { data: message, error } = await coachAClient.from("messages").insert({ sender_id: coachUser.id, receiver_id: athleteUser.id, content: "Détail médical strictement privé", is_read: false }).select().single();
      if (message) messageIds.push(message.id);
      if (error) throw error;
      const { data: queued, error: queueError } = await admin.from("push_event_outbox").select("*").eq("actor_user_id", coachUser.id).eq("event_type", "message_received");
      record("Vrai message -> événement transactionnel sans contenu privé", !queueError && queued?.length === 1 && queued[0].entity_id === message.id && queued[0].athlete_ids.includes(athleteA.id) && !JSON.stringify(queued).includes("médical"));
      const outsider = await callSendPush(athleteToken, { eventType: "dispatch_pending", entityId: queued?.[0]?.id });
      record("Un autre compte ne peut consommer l'événement", outsider.body?.events === 0);
      const results = await Promise.all([callSendPush(coachToken, { eventType: "dispatch_pending" }), callSendPush(coachToken, { eventType: "dispatch_pending" })]);
      record("Claim concurrent : événement consommé une seule fois", results.every(result => result.status === 200) && results.reduce((sum, result) => sum + (result.body?.events ?? 0), 0) === 1);
      const replay = await callSendPush(coachToken, { eventType: "dispatch_pending" });
      record("Rejeu terminé sans nouvelle livraison", replay.status === 200 && replay.body.events === 0);
      await admin.from("messages").delete().eq("id", message.id);
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
    if (messageIds.length) await admin.from("messages").delete().in("id", messageIds);
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
