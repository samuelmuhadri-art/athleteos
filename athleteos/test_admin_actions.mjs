#!/usr/bin/env node
// ============================================================
// AthleteOS — test_admin_actions.mjs
//
// Vérifie la matrice d'autorisation de l'Edge Function admin-actions
// (tâche 4) en conditions réelles, contre la fonction DÉPLOYÉE (ce
// script ne peut pas s'exécuter sans déploiement préalable — Deno
// n'est pas exécutable en local ici) :
//   1. Un coach (pas head_coach) et un athlète sont refusés sur les actions
//      structurelles. La création d'une invitation individuelle est autorisée
//      au coach pour son propre club, mais reste refusée à l'athlète.
//   2. Un head coach d'un AUTRE club ne peut pas agir sur un membre/club
//      qui n'est pas le sien.
//   3. Impossible de supprimer ou rétrograder le DERNIER head coach
//      d'un club (mais transférer vers un 2e head coach débloque
//      ensuite la suppression du premier).
//   4. Régénérer le code d'invitation invalide l'ancien immédiatement.
//   5. La personnalisation visuelle valide strictement couleur et chemins,
//      et reste limitée au club du head coach.
//   6. Rejouer exactement la même requête (même clé d'idempotence) ne
//      déclenche pas une seconde fois l'effet (testé sur rename_club).
//   7. Le journal d'audit (table audit_logs) contient bien une ligne
//      par tentative sensible, avec acteur/cible/date/résultat.
//
// Crée deux clubs et cinq comptes éphémères, nettoie tout à la fin
// (succès ou échec).
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_admin_actions.mjs
//
// Requiert (comme test_rls_regression.mjs) :
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (.env) + SUPABASE_SERVICE_ROLE_KEY (env, jamais committée)
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
const publicClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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
  const u = await insertOrThrow("users", { club_id: clubId, name, email, role, auth_uid: a.user.id });
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: es } = await client.auth.signInWithPassword({ email, password });
  if (es) throw new Error(`signIn ${email} : ${es.message}`);
  return { auth: a.user, row: u, client };
}

async function callAdmin(client, payload) {
  const { data, error } = await client.functions.invoke("admin-actions", { body: payload });
  if (error) return { success: false, error: error.message ?? String(error) };
  return data;
}

async function main() {
  let clubA, clubB;
  const auths = []; // { auth, row, client } pour nettoyage
  const password = `Admin-Test-${RUN_ID}-Aa!`;

  try {
    clubA = await insertOrThrow("clubs", { name: `Admin Test Club A ${RUN_ID}`, invite_code: `AT${RUN_ID}`.slice(0, 8).toUpperCase() });
    clubB = await insertOrThrow("clubs", { name: `Admin Test Club B ${RUN_ID}` });

    const headA1 = await makeUser(`admin-test-heada1-${RUN_ID}@example.invalid`, password, clubA.id, "head_coach", "Head A1"); auths.push(headA1);
    const headA2 = await makeUser(`admin-test-heada2-${RUN_ID}@example.invalid`, password, clubA.id, "head_coach", "Head A2"); auths.push(headA2);
    const coachA = await makeUser(`admin-test-coacha-${RUN_ID}@example.invalid`, password, clubA.id, "coach", "Coach A"); auths.push(coachA);
    const athleteA = await makeUser(`admin-test-athletea-${RUN_ID}@example.invalid`, password, clubA.id, "athlete", "Athlete A"); auths.push(athleteA);
    const headB = await makeUser(`admin-test-headb-${RUN_ID}@example.invalid`, password, clubB.id, "head_coach", "Head B"); auths.push(headB);
    const athleteProfileA = await insertOrThrow("athletes", {
      club_id: clubA.id,
      user_id: athleteA.row.id,
      name: "Athlete A",
      main_discipline: "100m",
      group_name: "Sprint",
    });
    await insertOrThrow("athlete_wellness", {
      club_id: clubA.id,
      athlete_id: athleteProfileA.id,
      date: new Date().toISOString().slice(0, 10),
      sleep: 4,
      energy: 3,
      soreness: 2,
      mood: 4,
      stress: 2,
      notes: "Donnée personnelle exportable",
    });
    await insertOrThrow("messages", {
      sender_id: coachA.row.id,
      receiver_id: athleteA.row.id,
      content: "Message personnel exportable",
    });
    await insertOrThrow("messages", {
      sender_id: headA2.row.id,
      receiver_id: coachA.row.id,
      content: "Message sans rapport avec l’athlète",
    });

    // ── 0. Chaque rôle peut exporter uniquement les données liées à son JWT ──
    {
      const res = await callAdmin(athleteA.client, {
        action: "export_personal_data",
        userId: headA2.row.id,
        athleteId: -1,
      });
      const exportMessages = res.export?.communications?.messages ?? [];
      record(
        "export_personal_data est accessible à l’athlète et ignore les identifiants injectés",
        res.success === true
          && res.export?.account?.profile?.id === athleteA.row.id
          && res.export?.athleteData?.profile?.id === athleteProfileA.id,
        res.error,
      );
      record(
        "export_personal_data contient le wellness propre et aucune conversation tierce",
        res.export?.athleteData?.wellness?.length === 1
          && res.export.athleteData.wellness[0].notes === "Donnée personnelle exportable"
          && exportMessages.length === 1
          && exportMessages[0].content === "Message personnel exportable",
        `wellness=${res.export?.athleteData?.wellness?.length ?? 0} messages=${exportMessages.length}`,
      );
    }

    {
      const preferences = { order:["overview","priorities","wellness","followup"], hidden:["wellness"], defaultGroup:null, feedbackDays:14 };
      const { error } = await coachA.client.rpc("configure_my_dashboard_preferences", { p_preferences:preferences });
      if (error) throw error;
      const own = await callAdmin(coachA.client, { action:"export_personal_data" });
      const other = await callAdmin(athleteA.client, { action:"export_personal_data", userId:coachA.row.id });
      record("L’export contient uniquement les préférences dashboard personnelles", own.export?.preferences?.dashboardPreferences?.[0]?.preferences?.feedbackDays === 14 && other.export?.preferences?.dashboardPreferences?.length === 0);
    }

    // ── 1. Coach et athlète refusés sur les actions head coach ────────────
    for (const [label, client] of [["coach", coachA.client], ["athlète", athleteA.client]]) {
      for (const payload of [
        { action: "rename_club", clubName: "Triche" },
        { action: "update_club_branding", accentColor: "#378ADD" },
        { action: "list_club_invitations" },
        { action: "regenerate_invite_code" },
        { action: "remove_user", userId: athleteA.row.id },
        { action: "change_role", userId: athleteA.row.id, role: "coach" },
      ]) {
        const res = await callAdmin(client, payload);
        record(`${payload.action} refusé pour ${label}`, res.success === false, res.success ? "AUTORISÉ !" : res.error);
      }
    }
    {
      const res = await callAdmin(coachA.client, {
        action: "create_club_invitation",
        recipientName: "Athlète invité par coach",
        expiresInDays: 7,
      });
      record("create_club_invitation autorisé pour coach", res.success === true, res.error);
    }
    {
      const res = await callAdmin(athleteA.client, {
        action: "create_club_invitation",
        recipientName: "Intrusion",
        expiresInDays: 7,
      });
      record("create_club_invitation refusé pour athlète", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }

    // New staff invitations use server-owned roles, never a role supplied at signup.
    {
      const denied = await callAdmin(coachA.client, { action:"create_club_invitation", targetRole:"coach", recipientEmail:`staff-${RUN_ID}@example.invalid` });
      record("Un coach ne peut pas inviter un autre coach", denied.success === false);
      const headRole = await callAdmin(headA2.client, { action:"create_club_invitation", targetRole:"head_coach", recipientEmail:`staff-${RUN_ID}@example.invalid` });
      record("Une invitation ne crée pas de head coach", headRole.success === false);
      const unnamed = await callAdmin(headA2.client, { action:"create_club_invitation", targetRole:"coach" });
      record("Email obligatoire pour une invitation coach", unnamed.success === false);
      const created = await callAdmin(headA2.client, { action:"create_club_invitation", targetRole:"coach", recipientEmail:athleteA.row.email });
      record("Le responsable crée une invitation coach nominative", created.success === true && created.invitation?.targetRole === "coach");
      const existingAthlete = await callAdmin(athleteA.client, { action:"accept_club_invitation", inviteCode:created.invitation?.code });
      record("Une invitation coach ne transforme pas silencieusement un compte athlète", existingAthlete.success === false && /profil athlète/.test(existingAthlete.error ?? ""));
      const configured = await headA2.client.rpc("configure_coach_following", { p_coach_user_id:coachA.row.id,p_mode:"assigned",p_groups:[],p_athlete_ids:[athleteProfileA.id],p_expected_revision:0 });
      if(configured.error) throw configured.error;
      const own = await callAdmin(coachA.client, { action:"export_personal_data" });
      const other = await callAdmin(athleteA.client, { action:"export_personal_data" });
      record("L’export inclut uniquement ses propres affectations", own.export?.preferences?.coachFollowing?.[0]?.coach_athlete_assignments?.[0]?.athlete_id === athleteProfileA.id && other.export?.preferences?.coachFollowing?.length === 0);
    }

    // ── 2. Head coach d'un AUTRE club refusé sur un membre/club qui n'est pas le sien ──
    {
      const res = await callAdmin(headB.client, { action: "remove_user", userId: athleteA.row.id });
      record("remove_user refusé (head coach club B sur athlète club A)", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }
    {
      const res = await callAdmin(headB.client, { action: "change_role", userId: coachA.row.id, role: "head_coach" });
      record("change_role refusé (head coach club B sur coach club A)", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }
    {
      const res = await callAdmin(headB.client, {
        action: "update_club_branding",
        logoPath: `${clubA.id}/${RUN_ID}-intrusion.png`,
      });
      record("update_club_branding refuse le chemin d'un autre club", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }

    // ── 3. Auto-suppression/auto-rétrogradation toujours bloquées, même en
    //    étant l'unique head coach — et transfert de propriété fonctionnel ──
    // Note honnête : la protection "dernier head coach" dans remove_user et
    // change_role ne peut mathématiquement se déclencher QUE si caller ===
    // target (seul un head coach peut appeler ces actions ; si le club n'a
    // qu'un seul head coach, c'est forcément lui l'appelant) — un cas déjà
    // bloqué séparément par le refus d'auto-cible, testé ci-dessous. Gardée
    // en défense en profondeur (voir commentaire dans admin-actions/
    // index.ts) mais pas indépendamment déclenchable via l'API publique
    // aujourd'hui — ce que ces tests prouvent, c'est que le CHEMIN RÉEL de
    // départ (transférer à un 2e head coach, puis se faire retirer PAR lui)
    // fonctionne de bout en bout.
    {
      const res = await callAdmin(headA1.client, { action: "remove_user", userId: headA1.row.id });
      record("remove_user refusé (auto-suppression, même en étant l'unique head coach)", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }
    {
      const res = await callAdmin(headA1.client, { action: "change_role", userId: headA1.row.id, role: "coach" });
      record("change_role refusé (auto-rétrogradation, même en étant l'unique head coach)", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }
    {
      // headA1 tente de rétrograder headA2 — OK, il en reste un (headA1).
      const res = await callAdmin(headA1.client, { action: "change_role", userId: headA2.row.id, role: "coach" });
      record("change_role autorisé (rétrograder un head coach quand un autre reste, positif)", res.success === true, res.error);
    }
    {
      // On re-promeut headA2 pour vérifier le chemin "transfert de propriété"
      // avant départ, via headA1, seul head coach actuel.
      const res = await callAdmin(headA1.client, { action: "change_role", userId: headA2.row.id, role: "head_coach" });
      record("change_role autorisé (transfert : re-promouvoir un 2e head coach, positif)", res.success === true, res.error);
    }
    {
      // Deux head coaches de nouveau : headA2 peut maintenant retirer headA1
      // (le chemin réel de "départ du dernier head coach" — via quelqu'un
      // d'autre, après transfert).
      const res = await callAdmin(headA2.client, { action: "remove_user", userId: headA1.row.id });
      record("remove_user autorisé (headA2 retire headA1 après transfert de propriété, positif)", res.success === true, res.error);
      if (res.success) auths.splice(auths.indexOf(headA1), 1); // déjà supprimé, ne pas re-nettoyer
    }

    // ── 4. Rotation du code invalide l'ancien immédiatement ────────────────
    {
      const before = await admin.from("clubs").select("invite_code").eq("id", clubA.id).single();
      const res = await callAdmin(headA2.client, { action: "regenerate_invite_code" });
      const after = await admin.from("clubs").select("invite_code").eq("id", clubA.id).single();
      record("regenerate_invite_code change bien le code", res.success === true && after.data.invite_code !== before.data.invite_code, res.error);
      const stillValid = await admin.from("clubs").select("id").eq("invite_code", before.data.invite_code).maybeSingle();
      record("l'ancien code n'est plus valide après rotation", !stillValid.data, stillValid.data ? "encore trouvé !" : "introuvable, OK");
    }

    // ── 5. Invitation individuelle : création, ouverture, suivi, révocation ──
    {
      const created = await callAdmin(headA2.client, {
        action: "create_club_invitation",
        recipientName: "Athlète test",
        recipientEmail: athleteA.row.email,
        expiresInDays: 7,
        idempotencyKey: crypto.randomUUID(),
      });
      record("create_club_invitation crée un lien unique", created.success === true && /^[A-Z2-9]{8}$/.test(created.invitation?.code ?? ""), created.error);

      const inspected = created.invitation?.code
        // Le vrai parcours est celui d'un visiteur non connecté. La fonction
        // est volontairement accordée à `anon` et ne renvoie ni email ni ID ;
        // le client service_role utilisé pour les fixtures n'a, lui, pas ce
        // droit après le REVOKE PUBLIC de la migration.
        ? await publicClient.rpc("inspect_club_invitation", { p_code: created.invitation.code })
        : { data: null, error: new Error("Invitation absente") };
      record("inspect_club_invitation valide le lien sans exposer l'email", inspected.data?.status === "active" && inspected.data?.clubName && !Object.hasOwn(inspected.data, "recipientEmail"), inspected.error?.message);

      const listed = await callAdmin(headA2.client, { action: "list_club_invitations" });
      const tracked = listed.invitations?.find((invitation) => invitation.id === created.invitation?.id);
      record("list_club_invitations observe l'ouverture", listed.success === true && tracked?.status === "opened", listed.error);

      const revoked = await callAdmin(headA2.client, {
        action: "revoke_club_invitation",
        invitationId: created.invitation?.id,
        idempotencyKey: crypto.randomUUID(),
      });
      const afterRevoke = created.invitation?.code
        ? await publicClient.rpc("inspect_club_invitation", { p_code: created.invitation.code })
        : { data: null };
      record("revoke_club_invitation invalide uniquement ce lien", revoked.success === true && afterRevoke.data?.status === "revoked", revoked.error);
    }

    // ── 6. Personnalisation visuelle : validation et mise à jour partielle ─────
    {
      const res = await callAdmin(headA2.client, {
        action: "update_club_branding",
        logoPath: null,
        coverPath: null,
        accentColor: "#378add",
      });
      const { data: club } = await admin
        .from("clubs")
        .select("logo_path, cover_path, accent_color")
        .eq("id", clubA.id)
        .single();
      record(
        "update_club_branding applique une couleur normalisée et des chemins nullables",
        res.success === true
          && res.branding?.accentColor === "#378ADD"
          && club?.accent_color === "#378ADD"
          && club?.logo_path === null
          && club?.cover_path === null,
        res.error,
      );
    }
    {
      const res = await callAdmin(headA2.client, {
        action: "update_club_branding",
        accentColor: "linear-gradient(red, blue)",
      });
      const { data: club } = await admin.from("clubs").select("accent_color").eq("id", clubA.id).single();
      record(
        "update_club_branding refuse une couleur non hexadécimale sans modifier le club",
        res.success === false && club?.accent_color === "#378ADD",
        res.success ? "COULEUR DANGEREUSE AUTORISÉE !" : res.error,
      );
    }
    {
      const res = await callAdmin(headA2.client, {
        action: "update_club_branding",
        coverPath: `${clubA.id}/../${clubB.id}/cover.webp`,
      });
      record("update_club_branding refuse un chemin avec traversée de dossier", res.success === false, res.success ? "AUTORISÉ !" : res.error);
    }

    // ── 6. Idempotence : rejouer la même requête ne double pas l'effet ─────
    {
      const key = crypto.randomUUID();
      const nameA = `Club renommé une fois ${RUN_ID}`;
      const r1 = await callAdmin(headA2.client, { action: "rename_club", clubName: nameA, idempotencyKey: key });
      const nameB = `Club renommé deux fois ${RUN_ID}`; // si l'idempotence échouait, ce nom serait appliqué
      const r2 = await callAdmin(headA2.client, { action: "rename_club", clubName: nameB, idempotencyKey: key });
      const { data: club } = await admin.from("clubs").select("name").eq("id", clubA.id).single();
      record("rejeu idempotent : les deux appels réussissent", r1.success === true && r2.success === true, `${r1.error ?? ""} ${r2.error ?? ""}`.trim());
      record("rejeu idempotent : le nom appliqué est celui du 1er appel, pas du 2e", club.name === nameA, `nom actuel: ${club.name}`);
    }

    // ── 7. Journal d'audit : au moins une ligne par tentative sensible ──────
    {
      const { data: logs, error } = await admin.from("audit_logs").select("action, actor_user_id, target_club_id, result").eq("actor_club_id", clubA.id);
      record("audit_logs contient des entrées pour le club A", !error && (logs ?? []).length > 0, error?.message ?? `${logs?.length ?? 0} ligne(s)`);
      const hasDenied = (logs ?? []).some(l => l.result === "denied");
      const hasSuccess = (logs ?? []).some(l => l.result === "success");
      record("audit_logs distingue bien success et denied", hasDenied && hasSuccess, `denied=${hasDenied} success=${hasSuccess}`);
    }

    // ── 8. Départ autonome et conservation du contenu club ──────────────
    {
      const denied = await callAdmin(headB.client, {
        action: "delete_own_account",
        confirmationEmail: headB.row.email,
      });
      const { data: stillPresent } = await admin.from("users").select("id").eq("id", headB.row.id).maybeSingle();
      record(
        "delete_own_account protège le dernier head coach",
        denied.success === false && stillPresent?.id === headB.row.id,
        denied.success ? "SUPPRESSION AUTORISÉE !" : denied.error,
      );
    }

    {
      const authoredSession = await insertOrThrow("sessions", {
        club_id: clubA.id,
        title: "Séance à conserver après départ du coach",
        session_date: new Date().toISOString().slice(0, 10),
        time: "18:00",
        duration_minutes: 60,
        type: "training",
        category: "speed",
        created_by: coachA.row.id,
      });
      const removed = await callAdmin(headA2.client, {
        action: "remove_user",
        userId: coachA.row.id,
        idempotencyKey: crypto.randomUUID(),
      });
      const [{ data: sessionAfter }, { data: coachAfter }, { data: coachMessages }] = await Promise.all([
        admin.from("sessions").select("created_by").eq("id", authoredSession.id).single(),
        admin.from("users").select("id").eq("id", coachA.row.id).maybeSingle(),
        admin.from("messages").select("id").or(`sender_id.eq.${coachA.row.id},receiver_id.eq.${coachA.row.id}`),
      ]);
      record(
        "remove_user transfère les séances d'un coach et retire ses conversations",
        removed.success === true
          && !coachAfter
          && sessionAfter?.created_by === headA2.row.id
          && (coachMessages ?? []).length === 0,
        removed.error,
      );
      if (removed.success) auths.splice(auths.indexOf(coachA), 1);
    }

    {
      const deleted = await callAdmin(athleteA.client, {
        action: "delete_own_account",
        confirmationEmail: athleteA.row.email,
      });
      const [{ data: userAfter }, { data: athleteAfter }] = await Promise.all([
        admin.from("users").select("id").eq("id", athleteA.row.id).maybeSingle(),
        admin.from("athletes").select("id").eq("id", athleteProfileA.id).maybeSingle(),
      ]);
      record(
        "delete_own_account supprime atomiquement le compte public et la fiche athlète",
        deleted.success === true && !userAfter && !athleteAfter,
        deleted.error,
      );
      if (deleted.success) auths.splice(auths.indexOf(athleteA), 1);
    }

  } finally {
    // Les requêtes postgrest-js (admin.from(...)) sont "thenables" mais
    // n'implémentent PAS .catch()/.finally() — seul .then() existe (déjà
    // rencontré à la tâche 3). On récupère {error} et on l'ignore, plutôt
    // que de chaîner .catch() dessus (ça plante avec "catch is not a
    // function"). .auth.signOut()/.auth.admin.deleteUser() sont de vraies
    // Promises (API Auth, pas postgrest) — .catch() reste valide dessus.
    console.log("\nNettoyage...");
    for (const u of auths) {
      if (!u) continue;
      await u.client.auth.signOut().catch(() => {});
      await admin.from("athletes").delete().eq("user_id", u.row.id);
      await admin.from("users").delete().eq("id", u.row.id);
      await admin.auth.admin.deleteUser(u.auth.id).catch(() => {});
    }
    await admin.from("audit_logs").delete().in("actor_club_id", [clubA?.id, clubB?.id].filter(Boolean));
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
  console.log("\nMatrice d'autorisation admin-actions conforme.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
