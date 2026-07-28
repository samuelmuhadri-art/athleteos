#!/usr/bin/env node
// ============================================================
// AthleteOS — test_competition_transactions.mjs
//
// Vérifie les RPC transactionnelles de la tâche 14
// (create_competition_with_athletes / add_competition_result /
// create_solo_competition_result / mark_notification_outbox_sent) en
// conditions réelles, contre les fonctions DÉPLOYÉES :
//   1. Un coach crée une compétition avec plusieurs athlètes en un seul
//      appel — la compétition ET tous les participants existent, ou rien.
//   2. Un coach ajoute un résultat : record créé/mis à jour, outbox
//      écrite, notifications dépêchées après coup.
//   3. Un athlète déclare seul une compétition + son résultat en un seul
//      appel (compétition + lien + résultat + performance + record).
//   4. Autorisation directe sur RPC : un athlète ne peut pas appeler
//      add_competition_result (réservé coach), un coach d'un autre club
//      ne peut pas viser une compétition/un athlète qui n'est pas le
//      sien, un athlète ne peut pas créer une compétition pour un tiers.
//   5. Rejeu de la même clé d'idempotence : pas de second résultat, pas
//      de second effet sur le record.
//   6. Deux résultats CONCURRENTS battant le même record (Promise.all) :
//      un seul record final cohérent, aucune ligne dupliquée dans
//      `records`.
//
// Crée deux clubs, comptes et fixtures éphémères ; nettoie tout à la fin.
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_competition_transactions.mjs
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

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
const ANON_KEY         = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY " +
    "(dans .env) et SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

async function makeUser(email, password, clubId, role, name) {
  const { data: a, error: ea } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ea) throw new Error(`createUser ${email} : ${ea.message}`);
  const userRow = await insertOrThrow("users", { club_id: clubId, name, email, role, auth_uid: a.user.id });
  const athleteRow = await insertOrThrow("athletes", { club_id: clubId, name, user_id: userRow.id });
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: es } = await client.auth.signInWithPassword({ email, password });
  if (es) throw new Error(`signIn ${email} : ${es.message}`);
  return { auth: a.user, user: userRow, athlete: athleteRow, client };
}

async function main() {
  let clubA, clubB, compA;
  const auths = [];
  const password = `Comp-Test-${RUN_ID}-Aa!`;

  try {
    clubA = await insertOrThrow("clubs", { name: `Comp Test Club A ${RUN_ID}` });
    clubB = await insertOrThrow("clubs", { name: `Comp Test Club B ${RUN_ID}` });

    const coachA   = await makeUser(`comp-test-coacha-${RUN_ID}@example.invalid`,   password, clubA.id, "head_coach", "Coach A"); auths.push(coachA);
    const athleteA = await makeUser(`comp-test-athletea-${RUN_ID}@example.invalid`, password, clubA.id, "athlete",    "Athlete A"); auths.push(athleteA);
    const athleteA2= await makeUser(`comp-test-athletea2-${RUN_ID}@example.invalid`,password, clubA.id, "athlete",    "Athlete A2"); auths.push(athleteA2);
    const headB    = await makeUser(`comp-test-headb-${RUN_ID}@example.invalid`,    password, clubB.id, "head_coach", "Head B"); auths.push(headB);

    // ── 1. Coach crée une compétition avec plusieurs athlètes (atomique) ───
    {
      const { data, error } = await coachA.client.rpc("create_competition_with_athletes", {
        p_name: `Meeting Test ${RUN_ID}`, p_date: "2026-08-15", p_location: "Stade", p_type: "Régionale",
        p_athlete_entries: [{ athleteId: athleteA.athlete.id, plannedEvent: "100m" }, { athleteId: athleteA2.athlete.id, plannedEvent: "Longueur" }],
        p_idempotency_key: crypto.randomUUID(),
      });
      record("create_competition_with_athletes (coach, positif)", !error && !!data?.competitionId, error?.message);
      compA = data;
      const { data: links } = await admin.from("competition_athletes").select("athlete_id").eq("competition_id", data?.competitionId);
      record("les 2 athlètes sont bien liés à la compétition", (links ?? []).length === 2, `${links?.length ?? 0} lien(s)`);
    }

    // Tous les tests suivants ont besoin d'une compétition valide — si le
    // test 1 a échoué, mieux vaut s'arrêter proprement ici (et nettoyer)
    // que de planter en cascade sur `compA.competitionId` undefined,
    // ce qui masquerait le vrai échec derrière une erreur JS confuse.
    if (!compA?.competitionId) {
      record("Arrêt anticipé : pas de compétition valide, tests suivants ignorés", false, "voir l'échec ci-dessus");
      return;
    }

    // ── 4a. Un athlète ne peut pas appeler add_competition_result ──────────
    {
      const { error } = await athleteA.client.rpc("add_competition_result", {
        p_competition_id: compA.competitionId, p_athlete_id: athleteA.athlete.id, p_event: "100m",
        p_result: "11.50", p_result_value: 11.5, p_higher_is_better: false,
      });
      record("add_competition_result refusé pour un athlète", !!error, error ? "bloqué, OK" : "AUTORISÉ !");
    }

    // ── 4b. Un coach d'un AUTRE club ne peut pas viser cette compétition ───
    {
      const { error } = await headB.client.rpc("add_competition_result", {
        p_competition_id: compA.competitionId, p_athlete_id: athleteA.athlete.id, p_event: "100m",
        p_result: "11.50", p_result_value: 11.5, p_higher_is_better: false,
      });
      record("add_competition_result refusé (coach club B sur compétition club A)", !!error, error ? "bloqué, OK" : "AUTORISÉ !");
    }

    // ── 4c. Un athlète ne peut pas créer une compétition pour un tiers ──────
    {
      const { error } = await athleteA.client.rpc("create_competition_with_athletes", {
        p_name: "Triche", p_date: "2026-08-16", p_location: null, p_type: "Régionale",
        p_athlete_entries: [{ athleteId: athleteA2.athlete.id, plannedEvent: null }],
      });
      record("create_competition_with_athletes refusé (athlète engage un tiers)", !!error, error ? "bloqué, OK" : "AUTORISÉ !");
    }

    // ── 2. Coach ajoute un résultat (positif) — 1er résultat pour cette
    //    discipline = record automatique ──────────────────────────────────
    let firstResultRecordId;
    {
      const { data, error } = await coachA.client.rpc("add_competition_result", {
        p_competition_id: compA.competitionId, p_athlete_id: athleteA.athlete.id, p_event: "100m",
        p_result: "11.50", p_result_value: 11.5, p_higher_is_better: false, p_idempotency_key: crypto.randomUUID(),
      });
      record("add_competition_result (coach, positif)", !error && !!data?.resultId, error?.message);
      record("1er résultat = nouveau record automatique", data?.isNewRecord === true, `isNewRecord=${data?.isNewRecord}`);
      record("outbox contient les 2 événements attendus", (data?.notifications ?? []).length === 2, `${data?.notifications?.length ?? 0} événement(s)`);
      firstResultRecordId = data?.recordId;

      const { data: rec } = await admin.from("records").select("pr, pr_value").eq("id", firstResultRecordId).single();
      record("le record en base correspond au résultat", rec?.pr === "11.50" && Number(rec?.pr_value) === 11.5, JSON.stringify(rec));
    }

    // ── 5. Idempotence : rejouer la même clé ne duplique pas le résultat ────
    {
      const key = crypto.randomUUID();
      const r1 = await coachA.client.rpc("add_competition_result", {
        p_competition_id: compA.competitionId, p_athlete_id: athleteA2.athlete.id, p_event: "Longueur",
        p_result: "5.80", p_result_value: 5.8, p_higher_is_better: true, p_idempotency_key: key,
      });
      const r2 = await coachA.client.rpc("add_competition_result", {
        p_competition_id: compA.competitionId, p_athlete_id: athleteA2.athlete.id, p_event: "Longueur",
        p_result: "5.80", p_result_value: 5.8, p_higher_is_better: true, p_idempotency_key: key,
      });
      record("rejeu idempotent : les deux appels réussissent", !r1.error && !r2.error, `${r1.error?.message ?? ""} ${r2.error?.message ?? ""}`.trim());
      record("rejeu idempotent : même resultId renvoyé (pas de second insert)", r1.data?.resultId === r2.data?.resultId, `${r1.data?.resultId} vs ${r2.data?.resultId}`);
      const { count } = await admin.from("competition_results").select("id", { count: "exact", head: true })
        .eq("competition_id", compA.competitionId).eq("athlete_id", athleteA2.athlete.id).eq("event", "Longueur");
      record("un seul competition_results créé malgré le rejeu", count === 1, `count=${count}`);
    }

    // ── 6. Deux résultats CONCURRENTS battant le même record ────────────────
    // athleteA (100m, record actuel 11.50) : deux coachs (ici le même coach,
    // deux appels simultanés) soumettent 11.20 et 11.10 en même temps.
    {
      const [ra, rb] = await Promise.all([
        coachA.client.rpc("add_competition_result", {
          p_competition_id: compA.competitionId, p_athlete_id: athleteA.athlete.id, p_event: "100m",
          p_result: "11.20", p_result_value: 11.2, p_higher_is_better: false, p_idempotency_key: crypto.randomUUID(),
        }),
        coachA.client.rpc("add_competition_result", {
          p_competition_id: compA.competitionId, p_athlete_id: athleteA.athlete.id, p_event: "100m",
          p_result: "11.10", p_result_value: 11.1, p_higher_is_better: false, p_idempotency_key: crypto.randomUUID(),
        }),
      ]);
      record("les deux résultats concurrents réussissent (pas de deadlock/erreur)", !ra.error && !rb.error, `${ra.error?.message ?? ""} ${rb.error?.message ?? ""}`.trim());

      const { data: recRows } = await admin.from("records").select("id, pr, pr_value").eq("athlete_id", athleteA.athlete.id).eq("discipline", "100m");
      record("une seule ligne records pour cet athlète+discipline après la course", (recRows ?? []).length === 1, `${recRows?.length ?? 0} ligne(s)`);
      record("le record final est bien le meilleur temps (11.10, le plus petit)", recRows?.[0]?.pr === "11.10" && Number(recRows?.[0]?.pr_value) === 11.1, JSON.stringify(recRows));

      const { count: resCount } = await admin.from("competition_results").select("id", { count: "exact", head: true })
        .eq("competition_id", compA.competitionId).eq("athlete_id", athleteA.athlete.id).eq("event", "100m");
      record("les deux résultats concurrents sont bien tous les deux enregistrés (pas juste le record)", resCount === 3, `count=${resCount} (attendu 3 : 11.50 initial + 11.20 + 11.10)`);
    }

    // ── 3. Athlète déclare seul une compétition + résultat (atomique) ──────
    {
      const { data, error } = await athleteA2.client.rpc("create_solo_competition_result", {
        p_name: `Meeting solo ${RUN_ID}`, p_date: "2026-08-20", p_location: null, p_type: "Préparation",
        p_event: "400m", p_result: "58.00", p_result_value: 58, p_higher_is_better: false,
        p_idempotency_key: crypto.randomUUID(),
      });
      record("create_solo_competition_result (athlète, positif)", !error && !!data?.resultId && !!data?.performanceId, error?.message);
      const { data: perf } = await admin.from("athlete_performances").select("id").eq("id", data?.performanceId).maybeSingle();
      record("la performance solo est bien journalisée (Évolution)", !!perf, "introuvable");
    }

    // ── mark_notification_outbox_sent : accessible et scoping club ─────────
    {
      const { data: pending } = await admin.from("notification_outbox").select("id").eq("club_id", clubA.id).eq("status", "pending").limit(5);
      const ids = (pending ?? []).map(r => r.id);
      if (ids.length) {
        const { error } = await coachA.client.rpc("mark_notification_outbox_sent", { p_ids: ids });
        record("mark_notification_outbox_sent réussit pour son propre club", !error, error?.message);
        const { data: after } = await admin.from("notification_outbox").select("status").in("id", ids);
        record("les événements marqués sont bien 'sent'", (after ?? []).every(r => r.status === "sent"), JSON.stringify(after?.map(r=>r.status)));
      } else {
        record("mark_notification_outbox_sent (aucun événement pending à tester)", true, "ignoré");
      }
    }
    {
      // headB (club B) ne doit pas pouvoir marquer des événements du club A.
      const { data: pending } = await admin.from("notification_outbox").select("id").eq("club_id", clubA.id).eq("status", "pending").limit(1);
      if (pending?.length) {
        const { error } = await headB.client.rpc("mark_notification_outbox_sent", { p_ids: [pending[0].id] });
        const { data: still } = await admin.from("notification_outbox").select("status").eq("id", pending[0].id).single();
        record("mark_notification_outbox_sent (club B) ne touche pas les événements du club A", !error && still?.status === "pending", `error=${error?.message} status=${still?.status}`);
      } else {
        record("mark_notification_outbox_sent scoping club (aucun événement à tester)", true, "ignoré");
      }
    }

  } finally {
    console.log("\nNettoyage...");
    for (const u of auths) {
      if (!u) continue;
      await u.client.auth.signOut().catch(() => {});
    }
    if (compA?.competitionId) {
      await admin.from("competition_results").delete().eq("competition_id", compA.competitionId);
      await admin.from("competition_athletes").delete().eq("competition_id", compA.competitionId);
      await admin.from("competitions").delete().eq("id", compA.competitionId);
    }
    // Retrouve et nettoie aussi la compétition solo + celle de la tentative refusée (jamais créée, rien à faire).
    const { data: soloComps } = await admin.from("competitions").select("id").in("club_id", [clubA?.id, clubB?.id].filter(Boolean));
    for (const c of soloComps ?? []) {
      await admin.from("competition_results").delete().eq("competition_id", c.id);
      await admin.from("competition_athletes").delete().eq("competition_id", c.id);
    }
    if (soloComps?.length) await admin.from("competitions").delete().in("id", soloComps.map(c => c.id));

    await admin.from("notification_outbox").delete().in("club_id", [clubA?.id, clubB?.id].filter(Boolean));
    await admin.from("rpc_idempotency").delete().in("actor_user_id", auths.map(u => u?.user?.id).filter(Boolean));
    for (const u of auths) {
      if (!u) continue;
      await admin.from("records").delete().eq("athlete_id", u.athlete.id);
      await admin.from("athlete_performances").delete().eq("athlete_id", u.athlete.id);
      await admin.from("athletes").delete().eq("id", u.athlete.id);
      await admin.from("users").delete().eq("id", u.user.id);
      await admin.auth.admin.deleteUser(u.auth.id).catch(() => {});
    }
    if (clubA) await admin.from("clubs").delete().eq("id", clubA.id);
    if (clubB) await admin.from("clubs").delete().eq("id", clubB.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nRPC de compétitions/résultats conformes.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
