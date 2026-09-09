// ============================================================
// AthleteOS — supabase/functions/signup/index.ts
//
// Sécurité (tâche 3) : inscription publique, donc directement exposée aux
// bots/abus. Défenses, dans l'ordre où elles s'appliquent :
//   1. CORS restreint (ALLOWED_ORIGINS + domaine de prod par défaut).
//   2. Taille de payload bornée.
//   3. Rate limiting par IP et par email (fenêtre glissante, table
//      signup_attempts) — AVANT tout travail coûteux (Auth, DB).
//   4. Anti-bot léger sans dépendance externe : honeypot (champ que seul un
//      bot remplit) + délai minimum entre chargement du formulaire et
//      soumission (un humain ne peut pas remplir le form en <1.5s).
//   5. Validation des champs (présence, format, tailles max).
//   6. Anti-énumération d'email : si l'email existe déjà, on répond EXACTEMENT
//      comme un succès (même forme, même statut) sans rien créer — le client
//      tentera ensuite un signInWithPassword qui échoue de façon générique
//      si ce n'était pas le vrai propriétaire du compte. Aucune différence
//      observable entre "email nouveau" et "email déjà pris".
//   7. Création : compte Auth d'abord (seul appel hors transaction SQL),
//      puis club+users+athletes en une seule transaction Postgres via le RPC
//      signup_create_account (migration 20260727030000) — beaucoup moins de
//      scénarios de compensation à gérer qu'avec des inserts séparés. Si le
//      RPC échoue, on supprime le compte Auth qu'on vient de créer.
//
// Activation progressive : SIGNUP_REQUIRE_EMAIL_CONFIRMATION=true uniquement
// après configuration et test du SMTP ET activation Confirm email dans Auth.
// Le mode pilote historique reste inchangé tant que ce prérequis manque.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signupFormProblem } from "../_shared/signupFormCheck.ts";

const MAX_BODY_BYTES     = 5_000;
const MAX_NAME_LEN       = 100;
const MAX_EMAIL_LEN      = 254;
const MIN_PASSWORD_LEN   = 8;
const MAX_PASSWORD_LEN   = 128;
const MAX_CLUB_NAME_LEN  = 100;
const INVITE_CODE_LEN    = 8;

const RATE_LIMIT_IP_MAX        = 8;   // tentatives
const RATE_LIMIT_IP_WINDOW_MIN = 15;
const RATE_LIMIT_EMAIL_MAX        = 3;
const RATE_LIMIT_EMAIL_WINDOW_MIN = 60;
const ATTEMPT_RETENTION_HOURS = 24;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I/L
// Les nouveaux codes évitent les caractères ambigus. La lecture accepte
// aussi 0/1/I/L/O car les premiers clubs ont reçu un code issu d'un MD5.
const CODE_RE = new RegExp(`^[A-Z0-9]{${INVITE_CODE_LEN}}$`);

const DEFAULT_ALLOWED_ORIGINS = [
  "https://athleteos-by-samuelmuhadri.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];
const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])];

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function genCode(): string {
  let s = "";
  for (let i = 0; i < INVITE_CODE_LEN; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function normalizeInviteCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "") : "";
}

function isDuplicateEmailError(err: { message?: string; code?: string; status?: number } | null): boolean {
  if (!err) return false;
  if (err.code === "email_exists") return true;
  if (err.status === 422 && /already/i.test(err.message ?? "")) return true;
  return /already registered|already exists/i.test(err.message ?? "");
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Méthode non autorisée.", correlationId }), {
      status: 405, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response(JSON.stringify({ success: false, error: "Origine non autorisée.", correlationId }), {
      status: 403, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`signup[${correlationId}] configuration Supabase manquante`);
    return new Response(JSON.stringify({
      success: false,
      error: "Service temporairement indisponible.",
      correlationId,
    }), {
      status: 503,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const confirmationRequired = Deno.env.get("SIGNUP_REQUIRE_EMAIL_CONFIRMATION") === "true";
  const emailRedirectTo = Deno.env.get("APP_URL") || "https://athleteos-by-samuelmuhadri.vercel.app";

  function fail(status: number, error: string, code?: string) {
    console.error(`signup[${correlationId}] ${status} — ${error}`);
    return new Response(JSON.stringify({ success: false, error, correlationId, ...(code ? { code } : {}) }), {
      status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
  // "Faux succès" volontaire — utilisé uniquement pour l'anti-énumération
  // d'email (voir en-tête de fichier). N'affiche pas les détails internes.
  function fakeSuccess() {
    return new Response(JSON.stringify({ success: true, correlationId, confirmationRequired }), {
      status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  let createdAuthUserId: string | null = null;
  let reservedInvitationId: string | null = null;
  let reservationToken: string | null = null;

  async function cleanupAuthUser(authUserId: string, reason: string) {
    try {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) console.error(`signup[${correlationId}] auth cleanup (${reason}):`, error.message);
    } catch (error) {
      console.error(
        `signup[${correlationId}] auth cleanup (${reason}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return fail(413, "Payload trop volumineux.");
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody || "{}"); } catch { return fail(400, "JSON invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Objet JSON requis.");

    // x-forwarded-for sur l'infra Supabase (vérifié en conditions réelles via
    // les logs de la fonction déployée, pas une supposition) : la PREMIÈRE
    // valeur est stable et identique d'un appel à l'autre pour une même
    // source (ex: "85.x.x.x, 85.x.x.x, 99.x.x.x" puis "85.x.x.x, 85.x.x.x,
    // 3.x.x.x" — seul le dernier segment change) — c'est la vraie IP client,
    // posée par l'edge Supabase. Les valeurs suivantes sont des sauts
    // d'infrastructure interne à Supabase, qui changent à chaque requête et
    // ne doivent pas servir de clé de regroupement pour le rate limiting.
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ipParts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = ipParts.length ? ipParts[0] : "unknown";
    const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // ── Nettoyage + rate limiting AVANT tout travail coûteux ──────────
    const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_HOURS * 3_600_000).toISOString();
    // Best-effort : les objets requête de postgrest-js n'exposent que
    // .then() (thenable), pas .catch()/.finally() — une erreur ici se lit
    // dans { error }, elle ne rejette pas la promesse. On l'ignore
    // volontairement (nettoyage non-critique).
    await admin.from("signup_attempts").delete().lt("created_at", cutoff);

    const ipWindowStart = new Date(Date.now() - RATE_LIMIT_IP_WINDOW_MIN * 60_000).toISOString();
    const { count: ipCount } = await admin.from("signup_attempts")
      .select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", ipWindowStart);
    if ((ipCount ?? 0) >= RATE_LIMIT_IP_MAX) {
      await admin.from("signup_attempts").insert({ ip, email: emailRaw || null });
      return fail(429, "Trop de tentatives. Réessaie plus tard.");
    }

    if (emailRaw) {
      const emailWindowStart = new Date(Date.now() - RATE_LIMIT_EMAIL_WINDOW_MIN * 60_000).toISOString();
      const { count: emailCount } = await admin.from("signup_attempts")
        .select("id", { count: "exact", head: true }).eq("email", emailRaw).gte("created_at", emailWindowStart);
      if ((emailCount ?? 0) >= RATE_LIMIT_EMAIL_MAX) {
        await admin.from("signup_attempts").insert({ ip, email: emailRaw });
        return fail(429, "Trop de tentatives. Réessaie plus tard.");
      }
    }

    await admin.from("signup_attempts").insert({ ip, email: emailRaw || null });

    // ── Anti-bot : honeypot + délai minimum ────────────────────────────
    // `company` : champ caché du formulaire, invisible et inatteignable au
    // clavier pour un humain, mais souvent auto-rempli par les bots de spam.
    // Le nouveau client mesure une durée monotone, indépendante de son horloge
    // civile. Le timestamp historique reste accepté pour les anciennes PWA.
    const formProblem = signupFormProblem(body);
    if (formProblem === "form_verification_failed") return fail(400, "Le formulaire n’a pas pu être vérifié. Recharge la page puis réessaie sans remplissage automatique.", formProblem);
    if (formProblem === "form_too_fast") return fail(400, "Attends quelques secondes avant de valider le formulaire.", formProblem);
    if (formProblem) return fail(400, "Le délai du formulaire n’a pas pu être vérifié. Recharge la page et vérifie la date et l’heure de ton appareil.", formProblem);

    // ── Validation des champs ───────────────────────────────────────────
    const mode = body.mode;
    if (mode !== "create_club" && mode !== "join_club") return fail(400, "Mode invalide.");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > MAX_NAME_LEN) return fail(400, "Nom invalide.");

    if (!emailRaw || emailRaw.length > MAX_EMAIL_LEN || !EMAIL_RE.test(emailRaw)) {
      return fail(400, "Email invalide.");
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      return fail(400, `Le mot de passe doit faire entre ${MIN_PASSWORD_LEN} et ${MAX_PASSWORD_LEN} caractères.`);
    }

    let clubName = "";
    let inviteCode = "";
    let individualInvitationId: string | null = null;
    if (mode === "create_club") {
      clubName = typeof body.clubName === "string" ? body.clubName.trim() : "";
      if (!clubName || clubName.length > MAX_CLUB_NAME_LEN) return fail(400, "Nom du club invalide.");
    } else {
      inviteCode = normalizeInviteCode(body.inviteCode);
      if (!CODE_RE.test(inviteCode)) return fail(400, "Le code d’invitation doit contenir 8 caractères.");

      const { data: individualInvitation, error: individualError } = await admin
        .from("club_invitations")
        .select("id, club_id, status, expires_at, accepted_at, recipient_email")
        .ilike("code", inviteCode)
        .maybeSingle();
      if (individualError && individualError.code !== "42P01") return fail(500, "Erreur serveur.");
      if (individualInvitation) {
        if (individualInvitation.status === "revoked") {
          return fail(400, "Cette invitation a été révoquée. Demande un nouveau lien à ton coach.");
        }
        if (individualInvitation.accepted_at) return fail(400, "Cette invitation a déjà été utilisée.");
        if (individualInvitation.recipient_email && individualInvitation.recipient_email.toLowerCase() !== emailRaw) {
          return fail(400, "Cette invitation a été préparée pour une autre adresse email.");
        }
        if (individualInvitation.expires_at && new Date(individualInvitation.expires_at) <= new Date()) {
          return fail(400, "Cette invitation a expiré. Demande un nouveau lien à ton coach.");
        }
        const { data: invitationClub, error: invitationClubError } = await admin
          .from("clubs").select("invite_code").eq("id", individualInvitation.club_id).single();
        if (invitationClubError || !invitationClub?.invite_code) return fail(500, "Club de l’invitation introuvable.");
        individualInvitationId = individualInvitation.id;
        // Le RPC historique rattache par le code général du club. Le code
        // individuel reste celui qui sera marqué comme accepté ci-dessous.
        inviteCode = invitationClub.invite_code;
      }

      if (!individualInvitationId) {
        let { data: club, error: clubErr } = await admin
          .from("clubs").select("id, invite_code_expires_at").ilike("invite_code", inviteCode).maybeSingle();
        if (clubErr?.code === "42703") {
          const legacyResult = await admin.from("clubs").select("id").ilike("invite_code", inviteCode).maybeSingle();
          club = legacyResult.data;
          clubErr = legacyResult.error;
        }
        if (clubErr) return fail(500, "Erreur serveur.");
        if (!club) return fail(400, "Cette invitation n’est plus active. Demande un nouveau lien à ton coach.");
        if (club.invite_code_expires_at && new Date(club.invite_code_expires_at) <= new Date()) {
          return fail(400, "Cette invitation a expiré. Demande un nouveau lien à ton coach.");
        }
      }
    }

    if (mode === "create_club") {
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        code = genCode();
        const { data: exists } = await admin.from("clubs").select("id").eq("invite_code", code).maybeSingle();
        if (!exists) break;
      }
      inviteCode = code;
    }

    // ── Compte Auth (seul appel hors transaction SQL) ───────────────────
    if (confirmationRequired) {
      // Fail closed if the Edge flag and Auth configuration disagree.
      // Checking this before creating anything avoids unusable partial accounts.
      try {
        const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: serviceRoleKey }, signal: AbortSignal.timeout(5000),
        });
        const settings = settingsResponse.ok ? await settingsResponse.json() : null;
        if (settings?.mailer_autoconfirm !== false) {
          return fail(503, "Les inscriptions avec confirmation email sont momentanément indisponibles.");
        }
      } catch { return fail(503, "Les inscriptions avec confirmation email sont momentanément indisponibles."); }
    }
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: emailRaw,
      password,
      email_confirm: !confirmationRequired,
    });
    if (authErr) {
      if (isDuplicateEmailError(authErr)) return fakeSuccess(); // anti-énumération
      console.error(`signup[${correlationId}] createUser error:`, authErr.message);
      return fail(400, "Impossible de créer le compte.");
    }
    createdAuthUserId = authData.user.id;

    if (individualInvitationId) {
      reservationToken = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const reservedUntil = new Date(Date.now() + 5 * 60_000).toISOString();
      const { data: reserved, error: reserveError } = await admin.from("club_invitations").update({
        reservation_token: reservationToken,
        reserved_until: reservedUntil,
      })
        .eq("id", individualInvitationId)
        .eq("status", "active")
        .is("accepted_at", null)
        .or(`reserved_until.is.null,reserved_until.lt.${nowIso}`)
        .select("id")
        .maybeSingle();
      if (reserveError || !reserved) {
        await cleanupAuthUser(createdAuthUserId, "reservation refusée");
        createdAuthUserId = null;
        return fail(409, "Cette invitation est déjà utilisée ou en cours d’utilisation.");
      }
      reservedInvitationId = individualInvitationId;
    }

    // ── Test uniquement : force un échec après création Auth, pour vérifier
    // la compensation. Double verrou : sans SIGNUP_TEST_MODE=true dans les
    // secrets de la fonction, ce bloc est totalement inerte quel que soit le
    // contenu du body — NE JAMAIS définir SIGNUP_TEST_MODE=true en prod.
    if (Deno.env.get("SIGNUP_TEST_MODE") === "true" && body.__test_force_db_failure === true) {
      throw new Error("test_forced_db_failure");
    }

    // ── club + users + athletes, atomique (migration 20260727030000) ────
    const { data: rpcData, error: rpcErr } = await admin.rpc("signup_create_account_with_invitation", {
      p_mode: mode, p_club_name: clubName, p_invite_code: inviteCode,
      p_auth_uid: authData.user.id, p_name: name, p_email: emailRaw,
      p_individual_invitation_id: individualInvitationId,
      p_reservation_token: reservationToken,
    });
    if (rpcErr) throw rpcErr;
    // La transaction métier est validée : un incident SMTP ne doit plus
    // supprimer Auth et laisser un profil orphelin. Le renvoi reste possible.
    createdAuthUserId = null;

    if (individualInvitationId) {
      // La nouvelle RPC a consommé l'invitation dans la même transaction que
      // la création métier. On désarme donc la compensation locale.
      reservedInvitationId = null;
      reservationToken = null;
    } else if (mode === "join_club") {
      const { error: trackingError } = await admin.rpc("mark_club_invitation_used", {
        p_invite_code: inviteCode,
      });
      // Le rattachement est déjà validé et transactionnel. Un éventuel retard
      // de migration du compteur ne doit jamais annuler le compte créé.
      if (trackingError) console.error(`signup[${correlationId}] invitation tracking:`, trackingError.message);
    }

    if (confirmationRequired) {
      try {
        const { error: deliveryError } = await admin.auth.resend({
          type: "signup", email: emailRaw, options: { emailRedirectTo },
        });
        if (deliveryError) console.error(`signup[${correlationId}] confirmation delivery failed`);
      } catch { console.error(`signup[${correlationId}] confirmation delivery unavailable`); }
    }
    return new Response(JSON.stringify({ success: true, correlationId, confirmationRequired }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (err) {
    // Compensation : le compte Auth ne doit jamais survivre seul, sans les
    // lignes club/users/athletes qui vont avec (club+users+athletes eux-
    // mêmes sont déjà tout-ou-rien grâce au RPC).
    if (createdAuthUserId) await cleanupAuthUser(createdAuthUserId, "transaction métier");
    if (reservedInvitationId && reservationToken) {
      const { error: releaseError } = await admin.from("club_invitations")
        .update({ reservation_token: null, reserved_until: null })
        .eq("id", reservedInvitationId).eq("reservation_token", reservationToken);
      if (releaseError) {
        console.error(`signup[${correlationId}] invitation release:`, releaseError.message);
      }
    }
    console.error(`signup[${correlationId}] error:`, err instanceof Error ? err.message : err);
    return fail(500, "Erreur serveur.");
  }
});
