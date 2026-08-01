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
//   - upload_club_branding   : head_coach uniquement, stockage validé côté serveur.
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

function normalizeInviteCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "") : "";
}

const VALID_ROLES = ["head_coach", "coach", "athlete"];
const SENSITIVE_ACTIONS = ["rename_club", "create_club_invitation", "revoke_club_invitation", "upload_club_branding", "update_club_branding", "regenerate_invite_code", "remove_user", "change_role"];
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLUB_IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i;
const BRAND_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BRAND_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 7_500_000;

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readableErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() && error.message !== "[object Object]") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() && error !== "[object Object]") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const code = typeof value.code === "string" ? value.code : "";
    if (code === "42P01") return "La mise à jour des invitations n’est pas encore appliquée à la base de données.";
    if (code === "23505") return "Ce code d’invitation existe déjà. Réessaie dans un instant.";
    for (const key of ["message", "details", "hint", "error_description"]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim() && candidate !== "[object Object]") return candidate;
    }
  }
  return "Une erreur technique est survenue. Réessaie dans un instant.";
}

// Erreur "attendue" (autorisation refusée, payload invalide, règle
// métier) — distincte d'une exception inattendue, pour choisir le bon
// `result` ('denied' vs 'error') dans le journal d'audit.
class DeniedError extends Error {}
class PayloadTooLargeError extends DeniedError {}

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

function decodeBrandImage(value: unknown): Uint8Array {
  const encoded = requireString(value, "Image", { max: 7_100_000 });
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new DeniedError("Image encodée invalide.");
  let binary = "";
  try { binary = atob(encoded); } catch { throw new DeniedError("Image encodée invalide."); }
  if (!binary.length || binary.length > MAX_BRAND_IMAGE_SIZE) {
    throw new DeniedError("L’image doit peser moins de 5 Mo.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function ensureBrandingBucket(admin: ReturnType<typeof createClient>) {
  const { data: bucket } = await admin.storage.getBucket("club-branding");
  if (!bucket) {
    const { error } = await admin.storage.createBucket("club-branding", {
      public: false,
      fileSizeLimit: MAX_BRAND_IMAGE_SIZE,
      allowedMimeTypes: Object.keys(BRAND_IMAGE_TYPES),
    });
    if (error && !/already exists/i.test(error.message ?? "")) throw error;
    return;
  }
  const { error } = await admin.storage.updateBucket("club-branding", {
    public: false,
    fileSizeLimit: MAX_BRAND_IMAGE_SIZE,
    allowedMimeTypes: Object.keys(BRAND_IMAGE_TYPES),
  });
  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Méthode non autorisée." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ success: false, error: "Payload trop volumineux." }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !serviceRoleKey || !anonKey) {
    console.error("admin-actions: configuration Supabase manquante");
    return new Response(JSON.stringify({ success: false, error: "Service temporairement indisponible." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, serviceRoleKey);

  // ── Contexte mutable rempli au fil de l'exécution, utilisé par le SEUL
  //    site d'écriture du journal d'audit (succès en fin de bloc try, ou
  //    catch) — évite toute double écriture. ──────────────────────────────
  let caller: { id: number; club_id: number; role: string; email: string | null } | null = null;
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
    const { data, error } = await admin
      .from("audit_logs")
      .select("payload")
      .eq("action", currentAction)
      .eq("idempotency_key", idempotencyKey)
      .eq("result", "success")
      .maybeSingle();
    if (error) throw error;
    return (data?.payload as Record<string, unknown>) ?? null;
  }

  try {
    // Identifie l'appelant via son propre JWT (transmis automatiquement par
    // supabase.functions.invoke) — jamais faire confiance à un id envoyé
    // dans le corps de la requête pour savoir "qui appelle".
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !authUser) throw new DeniedError("Non authentifié.");

    const { data: callerRow, error: callerErr } = await admin
      .from("users").select("id, club_id, role, email").eq("auth_uid", authUser.id).single();
    if (callerErr || !callerRow) throw new DeniedError("Profil introuvable.");
    caller = callerRow;
    const isHeadCoach = caller.role === "head_coach";

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError("Payload trop volumineux.");
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody || "{}"); }
    catch { throw new DeniedError("Corps de requête invalide."); }
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

    // Un compte déjà existant peut ouvrir un lien d'invitation. Avec le
    // modèle actuel (un compte = un club), on confirme son club sans déplacer
    // silencieusement ses données vers une autre structure.
    if (currentAction === "accept_club_invitation") {
      const inviteCode = normalizeInviteCode(body.inviteCode);
      if (!/^[A-Z0-9]{8}$/.test(inviteCode)) {
        throw new DeniedError("Le code doit contenir 8 caractères.");
      }
      const { data: individualInvitation, error: individualError } = await admin
        .from("club_invitations")
        .select("id")
        .ilike("code", inviteCode)
        .maybeSingle();
      if (individualError && individualError.code !== "42P01") throw individualError;

      if (individualInvitation) {
        const { data: acceptance, error: acceptError } = await admin.rpc(
          "accept_existing_member_club_invitation",
          { p_invitation_id: individualInvitation.id, p_user_id: caller.id, p_email: caller.email ?? "" },
        );
        if (acceptError) throw acceptError;
        const status = typeof acceptance?.status === "string" ? acceptance.status : "invalid";
        if (status === "revoked") throw new DeniedError("Cette invitation a été révoquée. Demande un nouveau lien à ton coach.");
        if (status === "expired") throw new DeniedError("Cette invitation a expiré. Demande un nouveau lien à ton coach.");
        if (status === "email_mismatch") throw new DeniedError("Cette invitation a été préparée pour une autre adresse email.");
        if (status === "different_club") throw new DeniedError("Ton compte appartient déjà à un autre club. Aucun transfert n’a été effectué ; contacte ton coach pour conserver tes données.");
        if (status === "accepted") throw new DeniedError("Cette invitation a déjà été utilisée.");
        if (status !== "accepted_by_caller") throw new DeniedError("Cette invitation n’est plus active. Demande un nouveau lien à ton coach.");
        return ok({ alreadyMember: true, clubName: acceptance.clubName ?? "Ton club" });
      }

      let { data: invitedClub, error: inviteError } = await admin
        .from("clubs")
        .select("id, name, invite_code_expires_at")
        .ilike("invite_code", inviteCode)
        .maybeSingle();
      if (inviteError?.code === "42703") {
        const legacyResult = await admin.from("clubs").select("id, name").ilike("invite_code", inviteCode).maybeSingle();
        invitedClub = legacyResult.data;
        inviteError = legacyResult.error;
      }
      if (inviteError) throw inviteError;
      if (!invitedClub) throw new DeniedError("Cette invitation n’est plus active. Demande un nouveau lien à ton coach.");
      if (invitedClub.invite_code_expires_at && new Date(invitedClub.invite_code_expires_at) <= new Date()) {
        throw new DeniedError("Cette invitation a expiré. Demande un nouveau lien à ton coach.");
      }
      if (Number(invitedClub.id) !== Number(caller.club_id)) {
        throw new DeniedError(`Ton compte appartient déjà à un autre club. Aucun transfert n’a été effectué ; contacte ton coach pour conserver tes données.`);
      }
      return ok({ alreadyMember: true, clubName: invitedClub.name });
    }

    // ── Actions réservées au head coach ─────────────────────────────────
    if (!isHeadCoach) throw new DeniedError("Action réservée au head coach.");

    if (currentAction === "list_club_invitations") {
      const { data: rows, error } = await admin
        .from("club_invitations")
        .select("id, code, recipient_name, recipient_email, status, expires_at, opened_at, accepted_at, revoked_at, created_at")
        .eq("club_id", caller.club_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error?.code === "42P01") return ok({ invitations: [], migrationPending: true });
      if (error) throw error;
      const now = Date.now();
      return ok({ invitations: (rows ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        status: row.status === "revoked"
          ? "revoked"
          : row.accepted_at
            ? "accepted"
            : row.expires_at && new Date(row.expires_at).getTime() <= now
              ? "expired"
              : row.opened_at ? "opened" : "sent",
        expiresAt: row.expires_at,
        openedAt: row.opened_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
      })) });
    }

    if (currentAction === "create_club_invitation") {
      targetClubId = caller.club_id;
      const cached = await findCachedSuccess();
      if (cached?.invitation) return ok(cached);
      const recipientName = typeof body.recipientName === "string" && body.recipientName.trim()
        ? body.recipientName.trim().slice(0, 100)
        : null;
      const recipientEmail = typeof body.recipientEmail === "string" && body.recipientEmail.trim()
        ? body.recipientEmail.trim().toLowerCase()
        : null;
      if (recipientEmail && (recipientEmail.length > 254 || !EMAIL_PATTERN.test(recipientEmail))) {
        throw new DeniedError("Adresse email du destinataire invalide.");
      }
      const expiresInDays = body.expiresInDays == null ? 7 : Number(body.expiresInDays);
      if (![1, 3, 7, 14, 30].includes(expiresInDays)) throw new DeniedError("Durée d’invitation invalide.");
      const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

      let code = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        code = genCode();
        const [clubLookup, invitationLookup] = await Promise.all([
          admin.from("clubs").select("id").eq("invite_code", code).maybeSingle(),
          admin.from("club_invitations").select("id").eq("code", code).maybeSingle(),
        ]);
        if (clubLookup.error) throw clubLookup.error;
        if (invitationLookup.error) throw invitationLookup.error;
        const clubMatch = clubLookup.data;
        const invitationMatch = invitationLookup.data;
        if (!clubMatch && !invitationMatch) break;
      }
      const { data: invitation, error } = await admin.from("club_invitations").insert({
        club_id: caller.club_id,
        code,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        expires_at: expiresAt,
        created_by: caller.id,
      }).select("id, code, recipient_name, recipient_email, expires_at, created_at").single();
      if (error || !invitation) throw error ?? new Error("Invitation non créée.");
      const responseInvitation = {
        id: invitation.id,
        code: invitation.code,
        recipientName: invitation.recipient_name,
        recipientEmail: invitation.recipient_email,
        status: "sent",
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      };
      auditPayload = { invitation: responseInvitation };
      await logAudit("success", null);
      return ok({ invitation: responseInvitation });
    }

    if (currentAction === "revoke_club_invitation") {
      targetClubId = caller.club_id;
      const invitationId = requireString(body.invitationId, "Invitation", { max: 36 });
      if (!UUID_PATTERN.test(invitationId)) throw new DeniedError("Invitation invalide.");
      const { data: invitation, error: invitationError } = await admin.from("club_invitations")
        .select("id, status, accepted_at")
        .eq("id", invitationId).eq("club_id", caller.club_id).maybeSingle();
      if (invitationError) throw invitationError;
      if (!invitation) throw new DeniedError("Invitation introuvable.");
      if (invitation.accepted_at) throw new DeniedError("Une invitation acceptée ne peut plus être révoquée.");
      if (invitation.status === "revoked") return ok({});
      const revokedAt = new Date().toISOString();
      const { data: revoked, error } = await admin.from("club_invitations").update({ status: "revoked", revoked_at: revokedAt })
        .eq("id", invitationId).eq("club_id", caller.club_id)
        .eq("status", "active").is("accepted_at", null)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!revoked) throw new DeniedError("L’invitation a changé d’état. Recharge la liste avant de réessayer.");
      auditPayload = { invitationId, revokedAt };
      await logAudit("success", null);
      return ok({});
    }

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

    if (currentAction === "upload_club_branding") {
      targetClubId = caller.club_id;
      const kind = requireString(body.kind, "Type d’image", { max: 10 });
      if (kind !== "logo" && kind !== "cover") throw new DeniedError("Type d’image invalide.");
      const contentType = requireString(body.contentType, "Format d’image", { max: 50 }).toLowerCase();
      const extension = BRAND_IMAGE_TYPES[contentType];
      if (!extension) throw new DeniedError("Utilise une image PNG, JPEG ou WebP.");
      const bytes = decodeBrandImage(body.fileBase64);

      await ensureBrandingBucket(admin);
      const path = `${caller.club_id}/${kind}-${crypto.randomUUID()}.${extension}`;
      const { error } = await admin.storage.from("club-branding").upload(path, bytes, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      auditPayload = { kind, path, size: bytes.byteLength };
      await logAudit("success", null);
      return ok({ path });
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

      const { data: previousClub } = await admin
        .from("clubs")
        .select("logo_path, cover_path")
        .eq("id", caller.club_id)
        .single();
      const { data: updatedClub, error } = await admin
        .from("clubs")
        .update(updates)
        .eq("id", caller.club_id)
        .select("logo_path, cover_path, accent_color")
        .single();
      if (error || !updatedClub) throw error ?? new Error("Club introuvable.");

      const obsoletePaths = [
        previousClub?.logo_path && previousClub.logo_path !== updatedClub.logo_path ? previousClub.logo_path : null,
        previousClub?.cover_path && previousClub.cover_path !== updatedClub.cover_path ? previousClub.cover_path : null,
      ].filter(Boolean) as string[];
      if (obsoletePaths.length) {
        const { error: cleanupError } = await admin.storage.from("club-branding").remove(obsoletePaths);
        if (cleanupError) console.error("club-branding cleanup failed:", cleanupError.message);
      }

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
        const [clubLookup, invitationLookup] = await Promise.all([
          admin.from("clubs").select("id").eq("invite_code", code).maybeSingle(),
          admin.from("club_invitations").select("id").eq("code", code).maybeSingle(),
        ]);
        if (clubLookup.error && clubLookup.error.code !== "42P01") throw clubLookup.error;
        if (invitationLookup.error && invitationLookup.error.code !== "42P01") throw invitationLookup.error;
        if (!clubLookup.data && !invitationLookup.data) break;
      }
      let { error } = await admin.from("clubs").update({
        invite_code: code,
        invite_code_created_at: new Date().toISOString(),
        invite_code_use_count: 0,
        invite_code_last_used_at: null,
        invite_code_expires_at: null,
      }).eq("id", caller.club_id);
      if (error?.code === "42703") {
        const legacyUpdate = await admin.from("clubs").update({ invite_code: code }).eq("id", caller.club_id);
        error = legacyUpdate.error;
      }
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

      const { data: deletion, error: deletionError } = await admin.rpc("remove_club_user_transactional", {
        p_actor_user_id: caller.id,
        p_target_user_id: targetRow.id,
      });
      if (deletionError) throw deletionError;
      const authUid = deletion?.authUid ?? targetRow.auth_uid;
      if (authUid) {
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUid);
        if (authDeleteError) {
          auditPayload = { ...auditPayload, authCleanupPending: true };
          console.error("Auth user cleanup failed:", authDeleteError.message);
        }
      }

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
    const internalMessage = readableErrorMessage(err);
    const denied = err instanceof DeniedError;
    const clientMessage = denied ? internalMessage : "Une erreur technique est survenue. Réessaie dans un instant.";
    await logAudit(denied ? "denied" : "error", internalMessage).catch((auditError) => {
      console.error(
        "admin-actions audit failure:",
        auditError instanceof Error ? auditError.message : auditError,
      );
    });
    console.error("admin-actions error:", internalMessage);
    return new Response(JSON.stringify({ success: false, error: clientMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
