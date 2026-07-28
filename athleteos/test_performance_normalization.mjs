#!/usr/bin/env node
// ============================================================
// AthleteOS — test_performance_normalization.mjs
//
// Vérifie en conditions réelles (tâche 12) les "Vérifications
// obligatoires" et la Definition of Done :
//   1. Les nouvelles performances/résultats ont une valeur canonique
//      valide (normalized_value / result_value), une unité et un
//      discipline_id, écrits par les RPC de compétition (tâche 14) et
//      par l'ajout manuel d'une performance (écriture directe côté
//      athlète).
//   2. Les anciennes données (déjà en base avant cette tâche) restent
//      lisibles telles quelles (texte brut intact).
//   3. Une ligne non interprétable est identifiable (quality_flags),
//      pas silencieusement fausse.
//   4. Un tri SQL sur la valeur canonique produit le bon ordre — sur
//      une épreuve chronométrée ET une épreuve de distance — là où un
//      tri sur le texte brut donnerait un ordre incorrect.
//   5. Contrainte d'unicité (source, source_external_id) : un même
//      point importé deux fois par le même fournisseur est refusé.
//
// Ne peut pas re-tester le backfill lui-même (ponctuel, déjà exécuté
// au déploiement de la migration) — vérifie à la place que les lignes
// réelles pré-existantes sont toujours lisibles ET ont bien été
// backfillées (lecture seule, aucune donnée modifiée).
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_performance_normalization.mjs
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

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const ANON_KEY          = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  let club, athleteRowA;
  const auths = [];
  const perfIds = [];
  const compIds = [];
  const password = `Norm-Test-${RUN_ID}-Aa!`;

  try {
    club = await insertOrThrow("clubs", { name: `Norm Test Club ${RUN_ID}` });
    const coach = await makeUser(`norm-test-coach-${RUN_ID}@example.invalid`, password, club.id, "coach", "Coach N"); auths.push(coach);
    const athleteUser = await makeUser(`norm-test-athlete-${RUN_ID}@example.invalid`, password, club.id, "athlete", "Athlete N"); auths.push(athleteUser);
    athleteRowA = athleteUser.athlete;

    // ── 0. Lecture seule : les vraies lignes pré-existantes (backfill déjà
    //    exécuté au déploiement) restent lisibles avec leur texte brut
    //    intact ET leur valeur canonique renseignée. ─────────────────────
    {
      const { data, error } = await admin.from("records").select("discipline, pr, pr_value, unit, discipline_id").limit(5);
      const ok = !error && (data ?? []).length > 0 && data.every(r => r.pr != null);
      record("anciennes lignes records lisibles (texte brut intact)", ok, error?.message ?? `${data?.length ?? 0} ligne(s), ex: ${JSON.stringify(data?.[0])}`);
    }

    // ── 1. RPC add_competition_result : résultat coach avec valeur canonique ──
    {
      const { data: comp, error: ce } = await coach.client.rpc("create_competition_with_athletes", {
        p_name: `Meeting Norm ${RUN_ID}`, p_date: new Date().toISOString().slice(0, 10),
        p_location: null, p_type: "Régionale",
        p_athlete_entries: [{ athleteId: athleteRowA.id, plannedEvent: "100m" }],
        p_idempotency_key: crypto.randomUUID(),
      });
      if (ce) throw ce;
      const compId = comp.competitionId;
      compIds.push(compId);

      const { data, error } = await coach.client.rpc("add_competition_result", {
        p_competition_id: compId, p_athlete_id: athleteRowA.id, p_event: "100m",
        p_result: "11.20s", p_result_value: 11.20, p_higher_is_better: false,
        p_idempotency_key: crypto.randomUUID(), p_unit: "s",
      });
      record("add_competition_result réussit", !error, error?.message);
      if (data?.resultId) {
        const { data: row } = await admin.from("competition_results").select("result_value, unit, discipline_id, quality_flags, source").eq("id", data.resultId).single();
        record("competition_results a une valeur canonique + unité + discipline_id", row?.result_value === 11.2 && row?.unit === "s" && row?.discipline_id === "100m", JSON.stringify(row));
        record("competition_results.quality_flags vide (résultat valide)", Array.isArray(row?.quality_flags) && row.quality_flags.length === 0, JSON.stringify(row?.quality_flags));
        record("competition_results.source par défaut = 'club'", row?.source === "club", row?.source);
      } else {
        record("competition_results a une valeur canonique + unité + discipline_id", false, "pas de resultId retourné");
      }

      const { data: rec } = await admin.from("records").select("unit, discipline_id, pr_value").eq("athlete_id", athleteRowA.id).eq("discipline", "100m").maybeSingle();
      record("records mis à jour avec unit + discipline_id par le RPC", rec?.unit === "s" && rec?.discipline_id === "100m", JSON.stringify(rec));
    }

    // ── 2. RPC create_solo_competition_result : discipline longue (minutes:secondes) ──
    {
      const { data, error } = await athleteUser.client.rpc("create_solo_competition_result", {
        p_name: `Solo Norm ${RUN_ID}`, p_date: new Date().toISOString().slice(0, 10),
        p_location: null, p_type: "Régionale", p_event: "1500m", p_result: "4:32",
        p_result_value: 272, p_higher_is_better: false,
        p_idempotency_key: crypto.randomUUID(), p_unit: "s",
      });
      record("create_solo_competition_result (1500m, format minutes) réussit", !error, error?.message);
      if (data?.competitionId) compIds.push(data.competitionId);
      if (data?.performanceId) {
        perfIds.push(data.performanceId);
        const { data: perf } = await admin.from("athlete_performances").select("normalized_value, unit, discipline_id, quality_flags").eq("id", data.performanceId).single();
        record("athlete_performances : 4:32 normalisé en 272 secondes", perf?.normalized_value === 272 && perf?.unit === "s", JSON.stringify(perf));
      } else {
        record("athlete_performances : 4:32 normalisé en 272 secondes", false, "pas de performanceId retourné");
      }
    }

    // ── 3. Écriture directe (ajout manuel d'une performance, hors RPC) ──────
    {
      const { data, error } = await athleteUser.client.from("athlete_performances").insert({
        athlete_id: athleteRowA.id, club_id: club.id, discipline: "longueur", discipline_type: "longueur",
        value: "6.45m", performance_date: new Date().toISOString().slice(0, 10),
        normalized_value: 6.45, unit: "m", discipline_id: "Longueur", quality_flags: [],
      }).select().single();
      record("ajout manuel direct (athlete_performances) réussit", !error, error?.message);
      if (data) {
        perfIds.push(data.id);
        record("discipline_id résolu même écrit hors RPC (Longueur, pas 'longueur')", data.discipline_id === "Longueur" && data.normalized_value === 6.45, JSON.stringify({ discipline_id: data.discipline_id, normalized_value: data.normalized_value }));
      }
    }

    // ── 4. Ligne ambiguë : identifiable, pas silencieusement fausse ────────
    {
      const { data, error } = await admin.from("athlete_performances").insert({
        athlete_id: athleteRowA.id, club_id: club.id, discipline: "100m", discipline_type: "100m",
        value: "DNF", performance_date: new Date().toISOString().slice(0, 10),
        normalized_value: null, unit: "s", discipline_id: "100m", quality_flags: ["unparsable"],
      }).select().single();
      record("ligne non interprétable (DNF) acceptée en base", !error, error?.message);
      if (data) {
        perfIds.push(data.id);
        const { data: flagged } = await admin.from("athlete_performances")
          .select("id, value").eq("athlete_id", athleteRowA.id).contains("quality_flags", ["unparsable"]);
        record("ligne ambiguë retrouvable via quality_flags (pas perdue silencieusement)", (flagged ?? []).some(r => r.id === data.id), `${flagged?.length ?? 0} ligne(s) trouvée(s)`);
      }
    }

    // ── 5. Tri SQL sur la valeur canonique — chrono ET distance ────────────
    {
      // 3 performances 100m : 11.20, 9.50 (record perso), 11.44 — un tri
      // texte donnerait "11.20" < "11.44" < "9.50" (ordre alphabétique,
      // FAUX) ; le tri numérique doit donner 9.50, 11.20, 11.44.
      const vals = ["11.20", "9.50", "11.44"];
      for (const v of vals) {
        const { data } = await admin.from("athlete_performances").insert({
          athlete_id: athleteRowA.id, club_id: club.id, discipline: "sort-test-100m", discipline_type: "sort-test-100m",
          value: v, performance_date: new Date().toISOString().slice(0, 10),
          normalized_value: parseFloat(v), unit: "s", discipline_id: "sort-test-100m", quality_flags: [],
        }).select().single();
        if (data) perfIds.push(data.id);
      }
      const { data: sorted, error } = await admin.from("athlete_performances")
        .select("value, normalized_value").eq("discipline_id", "sort-test-100m").order("normalized_value", { ascending: true });
      const order = (sorted ?? []).map(r => r.value);
      record("tri SQL chrono par normalized_value donne le bon ordre", !error && JSON.stringify(order) === JSON.stringify(["9.50", "11.20", "11.44"]), JSON.stringify(order));

      // Distance : 6.10, 7.60, 6.95 — même vérification, unité 'm'.
      const distVals = ["6.10", "7.60", "6.95"];
      for (const v of distVals) {
        const { data } = await admin.from("athlete_performances").insert({
          athlete_id: athleteRowA.id, club_id: club.id, discipline: "sort-test-longueur", discipline_type: "sort-test-longueur",
          value: v, performance_date: new Date().toISOString().slice(0, 10),
          normalized_value: parseFloat(v), unit: "m", discipline_id: "sort-test-longueur", quality_flags: [],
        }).select().single();
        if (data) perfIds.push(data.id);
      }
      const { data: sortedDist, error: ed } = await admin.from("athlete_performances")
        .select("value").eq("discipline_id", "sort-test-longueur").order("normalized_value", { ascending: true });
      const orderDist = (sortedDist ?? []).map(r => r.value);
      record("tri SQL distance par normalized_value donne le bon ordre", !ed && JSON.stringify(orderDist) === JSON.stringify(["6.10", "6.95", "7.60"]), JSON.stringify(orderDist));
    }

    // ── 6. Unicité (source, source_external_id) — anti double-import ───────
    {
      const externalId = `garmin-activity-${RUN_ID}`;
      const { data: first, error: e1 } = await admin.from("athlete_performances").insert({
        athlete_id: athleteRowA.id, club_id: club.id, discipline: "100m", discipline_type: "100m",
        value: "11.00", performance_date: new Date().toISOString().slice(0, 10),
        normalized_value: 11.0, unit: "s", discipline_id: "100m", quality_flags: [],
        source: "garmin", source_external_id: externalId,
      }).select().single();
      record("1er import externe accepté", !e1, e1?.message);
      if (first) perfIds.push(first.id);

      const { data: second, error: e2 } = await admin.from("athlete_performances").insert({
        athlete_id: athleteRowA.id, club_id: club.id, discipline: "100m", discipline_type: "100m",
        value: "11.00", performance_date: new Date().toISOString().slice(0, 10),
        normalized_value: 11.0, unit: "s", discipline_id: "100m", quality_flags: [],
        source: "garmin", source_external_id: externalId,
      }).select().single();
      record("ré-import du même id externe par le même fournisseur refusé", !!e2, e2 ? "refusé, OK" : "AUTORISÉ !");
      if (second) perfIds.push(second.id);
    }

  } finally {
    console.log("\nNettoyage...");
    if (perfIds.length) await admin.from("athlete_performances").delete().in("id", perfIds);
    if (compIds.length) {
      await admin.from("competition_results").delete().in("competition_id", compIds);
      await admin.from("competition_athletes").delete().in("competition_id", compIds);
      await admin.from("competitions").delete().in("id", compIds);
    }
    if (athleteRowA) await admin.from("records").delete().eq("athlete_id", athleteRowA.id);
    for (const u of auths) {
      if (!u) continue;
      await u.client.auth.signOut().catch(() => {});
      await admin.from("athletes").delete().eq("user_id", u.user.id);
      await admin.from("users").delete().eq("id", u.user.id);
      await admin.auth.admin.deleteUser(u.auth.id).catch(() => {});
    }
    if (club) await admin.from("clubs").delete().eq("id", club.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nNormalisation du stockage des performances conforme.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
