import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// AthleteOS — supabase/functions/admin-actions/index.ts
//
// Tâche 4 — matrice d'autorisation par action, protection du dernier
// head coach, validation de payload, idempotence et journal d'audit
// (table public.audit_logs). Toujours vérifier le rôle CÔTÉ SERVEUR ici
// — l'UI (AccountSettingsModal.jsx) masque les actions interdites mais
// ne doit jamais être le seul rempart, l'appel direct à cette fonction
// (Postman, curl...) doit rester bloqué de la même façon.
//
// Rôle minimal par action :
//   - update_profile        : n'importe quel compte connecté, sur SOI-MÊME uniquement. Pas audité (pas structurel).
//   - rename_club            : head_coach uniquement.
//   - update_club_branding   : head_coach uniquement.
//   - regenerate_invite_code : head_coach uniquement.
//   - remove_user            : head_coach uniquement.
//   - change_role            : head_coach uniquement.
//
// Chaque tentative sur une action "sensible" (toutes sauf update_profile) est
// auditée UNE SEULE FOIS, ici, dans le bloc catch/succès final — jamais
// à la fois inline dans une branche ET dans le catch, pour ne pas
// dupliquer les entrées.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

const VALID_ROLES = ["head_coach", "coach", "athlete"];
const SENSITIVE_ACTIONS = ["rename_club", "update_club_branding", "regenerate_invite_code", "remove_user", "change_role"];
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const CLUB_IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i;

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Erreur "attendue" (autorisation refusée, payload invalide, règle
// métier) — distincte d'une exception inattendue, pour choisir le bon
// `result` ('denied' vs 'error') dans le journal d'audit.
class DeniedError extends Error {}

function requireString(value: unknown, label: string, { max = 200 } = {}): string {
  if (typeof value !== "string" || !value.trim()) throw new DeniedError(`${label} manquant.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new DeniedError(`${label} trop long (max ${max} caractères).`);
  return trimmed;
}

function requirePositiveInt(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new DeniedError(`${label} invalide.`);
  return n;
}

function optionalAccentColor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new DeniedError("Couleur d'accent invalide.");
  const normalized = value.trim().toUpperCase();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    throw new DeniedError("Couleur d'accent invalide (format attendu : #RRGGBB).");
  }
  return normalized;
}

function optionalClubImagePath(
  value: unknown,
  label: string,
  clubId: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const imagePath = requireString(value, label, { max: 500 });
  const segments = imagePath.split("/");
  const hasUnsafeSegment = segments.some((segment) => !segment || segment === "." || segment === "..");
  if (
    segments.length < 2
    || segments[0] !== String(clubId)
    || hasUnsafeSegment
    || /[\\?#]/.test(imagePath)
    || !CLUB_IMAGE_PATTERN.test(imagePath)
  ) {
    throw new DeniedError(
      `${label} invalide : l'image doit appartenir au dossier du club et être au format PNG, JPEG ou WebP.`,
    );
  }
  return imagePath;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Contexte mutable rempli au fil de l'exécution, utilisé par le SEUL
  //    site d'écriture du journal d'audit (succès en fin de bloc try, ou
  //    catch) — évite toute double écriture. ──────────────────────────────
  let caller: { id: number; club_id: number; role: string } | null = null;
  let currentAction: string | null = null;
  let idempotencyKey: string | null = null;
  let targetUserId: number | null = null;
  let targetClubId: number | null = null;
  let auditPayload: Record<string, unknown> | null = null;

  async function logAudit(result: "success" | "denied" | "error", errorMessage: string | null) {
    if (!currentAction || !SENSITIVE_ACTIONS.includes(currentAction)) return;
    const { error } = await admin.from("audit_logs").insert({
      actor_user_id: caller?.id ?? null,
      actor_club_id: caller?.club_id ?? null,
      action: currentAction,
      target_user_id: targetUserId,
      target_club_id: targetClubId,
      payload: auditPayload,
      result,
      error_message: errorMessage,
      idempotency_key: idempotencyKey,
    });
    // Un échec d'écriture d'audit ne doit jamais faire planter l'action
    // elle-même (déjà exécutée ou déjà refusée à ce stade) — juste tracé
    // côté serveur pour investigation.
    if (error) console.error("audit_logs insert failed:", error.message);
  }

  // Ne rejoue PAS une action déjà exécutée avec succès sous la même clé
  // d'idempotence (ex: double-clic, retry réseau). Un échec/refus
  // précédent avec la même clé peut en revanche être retenté normalement
  // (pas d'effet à dupliquer) — voir l'index partiel de la migration
  // 20260729010000 (unique seulement sur les lignes result='success').
  async function findCachedSuccess(): Promise<Record<string, unknown> | null> {
    if (!idempotencyKey || !currentAction) return null;
    const { data } = await admin
      .from("audit_logs")
      .select("payload")
      .eq("action", currentAction)
      .eq("idempotency_key", idempotencyKey)
      .eq("result", "success")
      .maybeSingle();
    return (data?.payload as Record<string, unknown>) ?? null;
  }

  try {
    // Identifie l'appelant via son propre JWT (transmis automatiquement par
    // supabase.functions.invoke) — jamais faire confiance à un id envoyé
    // dans le corps de la requête pour savoir "qui appelle".
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await callerClient.auth.getUser();
    if (!authUser) throw new DeniedError("Non authentifié.");

    const { data: callerRow, error: callerErr } = await admin
      .from("users").select("id, club_id, role").eq("auth_uid", authUser.id).single();
    if (callerErr || !callerRow) throw new DeniedError("Profil introuvable.");
    caller = callerRow;
    const isHeadCoach = caller.role === "head_coach";

    const body = await req.json().catch(() => { throw new DeniedError("Corps de requête invalide."); });
    currentAction = typeof body.action === "string" ? body.action : null;
    if (!currentAction) throw new DeniedError("Action manquante.");
    idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 100)
        : null;

    // ── update_profile : n'importe quel rôle, jamais audité (pas une
    //    action structurelle — modifie toujours SA PROPRE ligne, userId
    //    du corps ignoré volontairement) ─────────────────────────────────
    if (currentAction === "update_profile") {
      const name = requireString(body.name, "Nom");
      const { error } = await admin.from("users").update({ name }).eq("id", caller.id);
      if (error) throw error;
      return ok({});
    }

    // ── Actions réservées au head coach ─────────────────────────────────
    if (!isHeadCoach) throw new DeniedError("Action réservée au head coach.");

    if (currentAction === "rename_club") {
      targetClubId = caller.club_id;
      const cached = await findCachedSuccess();
      if (cached) return ok(cached);

      const clubName = requireString(body.clubName, "Nom du club", { max: 100 });
      const { error } = await admin.from("clubs").update({ name: clubName }).eq("id", caller.club_id);
      if (error) throw error;

      auditPayload = { clubName };
      await logAudit("success", null);
      return ok({});
    }

    if (currentAction === "update_club_branding") {
      targetClubId = caller.club_id;
      const cached = await findCachedSuccess();
      if (cached) return ok(cached);

      const logoPath = optionalClubImagePath(body.logoPath, "Chemin du logo", caller.club_id);
      const coverPath = optionalClubImagePath(body.coverPath, "Chemin de la couverture", caller.club_id);
      const accentColor = optionalAccentColor(body.accentColor);
      if (logoPath === undefined && coverPath === undefined && accentColor === undefined) {
        throw new DeniedError("Aucune personnalisation à mettre à jour.");
      }

      const updates: Record<string, string | null> = {};
      if (logoPath !== undefined) updates.logo_path = logoPath;
      if (coverPath !== undefined) updates.cover_path = coverPath;
      if (accentColor !== undefined) updates.accent_color = accentColor;

      const { data: updatedClub, error } = await admin
        .from("clubs")
        .update(updates)
        .eq("id", caller.club_id)
        .select("logo_path, cover_path, accent_color")
        .single();
      if (error || !updatedClub) throw error ?? new Error("Club introuvable.");

      const branding = {
        logoPath: updatedClub.logo_path,
        coverPath: updatedClub.cover_path,
        accentColor: updatedClub.accent_color,
      };
      auditPayload = { branding };
      await logAudit("success", null);
      return ok({ branding });
    }

    if (currentAction === "regenerate_invite_code") {
      targetClubId = caller.club_id;
      const cached = await findCachedSuccess();
      if (cached) return ok(cached);

      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        code = genCode();
        const { data: exists } = await admin.from("clubs").select("id").eq("invite_code", code).maybeSingle();
        if (!exists) break;
      }
      const { error } = await admin.from("clubs").update({ invite_code: code }).eq("id", caller.club_id);
      if (error) throw error;

      auditPayload = { inviteCode: code };
      await logAudit("success", null);
      return ok({ inviteCode: code });
    }

    if (currentAction === "remove_user") {
      const cached = await findCachedSuccess();
      if (cached) return ok({});

      const userId = requirePositiveInt(body.userId, "Identifiant utilisateur");
      const { data: targetRow } = await admin.from("users").select("id, club_id, auth_uid, role, name, email").eq("id", userId).single();
      if (!targetRow) throw new DeniedError("Utilisateur introuvable.");
      targetClubId = targetRow.club_id;
      if (targetRow.club_id !== caller.club_id) throw new DeniedError("Cet utilisateur n'est pas dans ton club.");
      if (targetRow.id === caller.id) throw new DeniedError("Tu ne peux pas te retirer toi-même.");

      // Note : comme seul un head coach peut appeler remove_user (voir plus
      // haut) et que l'auto-suppression est bloquée juste au-dessus, ce
      // garde-fou ne peut se déclencher aujourd'hui QUE si caller === target
      // — un cas déjà intercepté avant. Gardé quand même en défense en
      // profondeur (le jour où l'auto-suppression serait autorisée, ou pour
      // un futur appel service-to-service qui ne passerait pas par cette
      // fonction) : si jamais retiré plus tard sans plus y penser, ce
      // contrôle protège encore.
      if (targetRow.role === "head_coach") {
        const { count } = await admin.from("users")
          .select("id", { count: "exact", head: true })
          .eq("club_id", caller.club_id).eq("role", "head_coach").neq("id", targetRow.id);
        if (!count) {
          auditPayload = { targetUserId: targetRow.id, targetName: targetRow.name };
          throw new DeniedError("Impossible de supprimer le dernier head coach du club. Transfère d'abord le rôle à un autre membre (change_role).");
        }
      }

      // Snapshot avant suppression : une fois la ligne `users` supprimée,
      // target_user_id ne peut plus être référencé par l'audit (contrainte
      // de clé étrangère) — on garde l'essentiel dans `payload`.
      auditPayload = { targetUserId: targetRow.id, targetName: targetRow.name, targetEmail: targetRow.email, targetRole: targetRow.role };

      await admin.from("athletes").delete().eq("user_id", targetRow.id);
      await admin.from("users").delete().eq("id", targetRow.id);
      if (targetRow.auth_uid) await admin.auth.admin.deleteUser(targetRow.auth_uid).catch(() => {});

      await logAudit("success", null);
      return ok({});
    }

    if (currentAction === "change_role") {
      const cached = await findCachedSuccess();
      if (cached) return ok({});

      const userId = requirePositiveInt(body.userId, "Identifiant utilisateur");
      const role = requireString(body.role, "Rôle", { max: 20 });
      if (!VALID_ROLES.includes(role)) throw new DeniedError("Rôle invalide.");

      const { data: targetRow } = await admin.from("users").select("id, club_id, role, name").eq("id", userId).single();
      if (!targetRow) throw new DeniedError("Utilisateur introuvable.");
      targetUserId = targetRow.id;
      targetClubId = targetRow.club_id;
      if (targetRow.club_id !== caller.club_id) throw new DeniedError("Cet utilisateur n'est pas dans ton club.");
      if (targetRow.id === caller.id) throw new DeniedError("Tu ne peux pas changer ton propre rôle depuis cet écran.");
      if (targetRow.role === role) throw new DeniedError("Ce membre a déjà ce rôle.");

      // Même remarque que dans remove_user : avec l'auto-cible déjà bloquée
      // juste au-dessus, ce garde-fou ne peut mathématiquement se déclencher
      // que si caller === target — déjà intercepté. Gardé en défense en
      // profondeur.
      if (targetRow.role === "head_coach" && role !== "head_coach") {
        const { count } = await admin.from("users")
          .select("id", { count: "exact", head: true })
          .eq("club_id", caller.club_id).eq("role", "head_coach").neq("id", targetRow.id);
        if (!count) {
          auditPayload = { targetName: targetRow.name, fromRole: targetRow.role, toRole: role };
          throw new DeniedError("Impossible de rétrograder le dernier head coach du club. Promeus d'abord un autre membre.");
        }
      }

      const { error } = await admin.from("users").update({ role }).eq("id", targetRow.id);
      if (error) throw error;

      auditPayload = { targetName: targetRow.name, fromRole: targetRow.role, toRole: role };
      await logAudit("success", null);
      return ok({});
    }

    throw new DeniedError("Action inconnue.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAudit(err instanceof DeniedError ? "denied" : "error", message).catch(() => {});
    console.error("admin-actions error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
