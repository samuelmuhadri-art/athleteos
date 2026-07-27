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
// Stratégie email pilote : email_confirm=true (accès immédiat, pas de mail
// de vérification envoyé) — décision documentée, pas un oubli. Ce projet n'a
// pour l'instant aucun fournisseur SMTP configuré dans Supabase Auth ; activer
// une vraie vérification demande de configurer ça côté dashboard (Auth >
// Settings > SMTP) puis de repasser email_confirm à false ici. Tant que ça
// n'est pas fait, le rate limiting + l'anti-bot sont la principale défense
// contre la création massive de comptes.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES     = 5_000;
const MAX_NAME_LEN       = 100;
const MAX_EMAIL_LEN      = 254;
const MIN_PASSWORD_LEN   = 8;
const MAX_PASSWORD_LEN   = 128;
const MAX_CLUB_NAME_LEN  = 100;
const INVITE_CODE_LEN    = 8;
const MIN_SUBMIT_MS      = 1500; // en dessous, personne ne remplit un vrai formulaire

const RATE_LIMIT_IP_MAX        = 8;   // tentatives
const RATE_LIMIT_IP_WINDOW_MIN = 15;
const RATE_LIMIT_EMAIL_MAX        = 3;
const RATE_LIMIT_EMAIL_WINDOW_MIN = 60;
const ATTEMPT_RETENTION_HOURS = 24;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I/L
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{${INVITE_CODE_LEN}}$`);

const DEFAULT_ALLOWED_ORIGINS = [
  "https://athleteos-by-samuelmuhadri.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  function fail(status: number, error: string) {
    console.error(`signup[${correlationId}] ${status} — ${error}`);
    return new Response(JSON.stringify({ success: false, error, correlationId }), {
      status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
  // "Faux succès" volontaire — utilisé uniquement pour l'anti-énumération
  // d'email (voir en-tête de fichier). N'affiche pas les détails internes.
  function fakeSuccess() {
    return new Response(JSON.stringify({ success: true, correlationId }), {
      status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  let createdAuthUserId: string | null = null;

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) return fail(413, "Payload trop volumineux.");
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody || "{}"); } catch { return fail(400, "JSON invalide."); }

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
    // `formLoadedAt` : timestamp posé au montage du formulaire côté client.
    if (typeof body.company === "string" && body.company.trim() !== "") {
      return fail(400, "Requête invalide.");
    }
    const formLoadedAt = Number(body.formLoadedAt);
    if (!Number.isFinite(formLoadedAt) || Date.now() - formLoadedAt < MIN_SUBMIT_MS) {
      return fail(400, "Requête invalide.");
    }

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
    if (mode === "create_club") {
      clubName = typeof body.clubName === "string" ? body.clubName.trim() : "";
      if (!clubName || clubName.length > MAX_CLUB_NAME_LEN) return fail(400, "Nom du club invalide.");
    } else {
      inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
      if (!CODE_RE.test(inviteCode)) return fail(400, "Code d'invitation invalide.");

      const { data: club, error: clubErr } = await admin
        .from("clubs").select("id").eq("invite_code", inviteCode).maybeSingle();
      if (clubErr) return fail(500, "Erreur serveur.");
      if (!club) return fail(400, "Code d'invitation invalide.");
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
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: emailRaw,
      password,
      email_confirm: true, // pilote : voir stratégie documentée en en-tête de fichier
    });
    if (authErr) {
      if (isDuplicateEmailError(authErr)) return fakeSuccess(); // anti-énumération
      console.error(`signup[${correlationId}] createUser error:`, authErr.message);
      return fail(400, "Impossible de créer le compte.");
    }
    createdAuthUserId = authData.user.id;

    // ── Test uniquement : force un échec après création Auth, pour vérifier
    // la compensation. Double verrou : sans SIGNUP_TEST_MODE=true dans les
    // secrets de la fonction, ce bloc est totalement inerte quel que soit le
    // contenu du body — NE JAMAIS définir SIGNUP_TEST_MODE=true en prod.
    if (Deno.env.get("SIGNUP_TEST_MODE") === "true" && body.__test_force_db_failure === true) {
      throw new Error("test_forced_db_failure");
    }

    // ── club + users + athletes, atomique (migration 20260727030000) ────
    const { error: rpcErr } = await admin.rpc("signup_create_account", {
      p_mode: mode, p_club_name: clubName, p_invite_code: inviteCode,
      p_auth_uid: authData.user.id, p_name: name, p_email: emailRaw,
    });
    if (rpcErr) throw rpcErr;

    return new Response(JSON.stringify({ success: true, correlationId }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (err) {
    // Compensation : le compte Auth ne doit jamais survivre seul, sans les
    // lignes club/users/athletes qui vont avec (club+users+athletes eux-
    // mêmes sont déjà tout-ou-rien grâce au RPC).
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
    console.error(`signup[${correlationId}] error:`, err instanceof Error ? err.message : err);
    return fail(500, "Erreur serveur.");
  }
});
