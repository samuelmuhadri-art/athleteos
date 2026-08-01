// ============================================================
// AthleteOS — supabase/functions/send-push/index.ts
//
// Sécurité (tâche 2) : cette fonction utilise la clé service_role, qui
// contourne toute RLS — la protection doit donc être entièrement gérée
// ici, en code applicatif :
//   - Chemin cron (weekly-cron) : Authorization = Bearer <SERVICE_ROLE_KEY>,
//     déjà vérifié en amont par weekly-cron/index.ts. Accès total,
//     inchangé.
//   - Chemin utilisateur (app) : JWT extrait du header Authorization,
//     résolu vers users(id, club_id, role) comme le fait déjà
//     admin-actions/index.ts. Les destinataires (athleteIds/userIds)
//     envoyés par le client ne sont JAMAIS utilisés tels quels : ils
//     sont re-résolus côté serveur contre le club de l'appelant.
//     - athleteIds : toujours limité aux athlètes du club de l'appelant
//       (coach ou athlete) — un athlète a des cas d'usage légitimes vers
//       d'autres athlètes de son club (post club diffusé à l'équipe via
//       notifyClubNewPost, messagerie inter-athlètes via
//       notifyAthleteMessage) et vers lui-même (récap hebdo). La seule
//       limite pour ce vecteur est le club, pas le rôle.
//     - userIds : head_coach/coach peuvent cibler n'importe quel user de
//       leur club ; athlete uniquement les coachs (head_coach/coach) de
//       son club (cas du message à son coach) — jamais un autre athlète
//       par ce vecteur.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

const MAX_BODY_BYTES          = 20_000; // taille brute du JSON reçu
const MAX_TITLE_LEN           = 150;
const MAX_MESSAGE_LEN         = 500;
const MAX_TAG_LEN             = 100;
const MAX_URL_LEN             = 200;
const MAX_REQUESTED_RECIPIENTS = 300; // largement au-dessus de la taille d'un club réel
const MAX_USER_REQUESTS_PER_MINUTE = 20;
const MAX_USER_REQUESTS_PER_DAY = 200;

// Origines autorisées pour les appels navigateur (CORS). Domaine de
// production connu inclus par défaut (URL publique, pas un secret) + ports
// Vite locaux pour le dev. Surchargeable/complétable sans redéploiement via
// la variable d'env ALLOWED_ORIGINS (liste séparée par des virgules) dans
// les secrets de la fonction Supabase — utile si un autre domaine
// (custom domain, preview Vercel...) doit être ajouté plus tard.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://athleteos-by-samuelmuhadri.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];
const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
// Additif, pas un remplacement : ALLOWED_ORIGINS sert à AJOUTER un domaine
// (custom domain, preview...), pas à retirer le domaine de prod par défaut.
const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])];

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  // Pas d'Origin (appel serveur à serveur, ex. weekly-cron) : pas concerné
  // par CORS, on ne pose pas l'en-tête. Origin présent : on ne l'autorise
  // que s'il est dans la liste configurée.
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(status: number, origin: string | null, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// IDs positifs uniquement, dédupliqués — toute valeur non entière/négative
// est silencieusement écartée plutôt que de casser la requête .in().
function toPositiveIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<number>();
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return [...out];
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, origin, { error: "Méthode non autorisée." });
  }
  if (origin && !allowedOrigins.includes(origin)) {
    return json(403, origin, { error: "Origine non autorisée." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("send-push: configuration Supabase manquante");
    return json(503, origin, { error: "Service indisponible." });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // ── Taille du payload brut, avant tout parsing ──────────────────
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json(413, origin, { error: "Payload trop volumineux." });
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return json(400, origin, { error: "JSON invalide." });
    }

    const requestedAthleteIds = toPositiveIntArray(body.athleteIds);
    const requestedUserIds    = toPositiveIntArray(body.userIds);
    const requestedRecipientCount = requestedAthleteIds.length + requestedUserIds.length;

    if (!requestedRecipientCount) return json(400, origin, { error: "Aucun destinataire." });
    if (requestedRecipientCount > MAX_REQUESTED_RECIPIENTS) {
      return json(413, origin, { error: "Trop de destinataires." });
    }

    // ── Authentification : cron (secret serveur) ou utilisateur (JWT) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCronCall = authHeader === `Bearer ${serviceKey}`;

    let athleteIds: number[] = [];
    let userIds: number[] = [];
    let logCaller = "cron";

    if (isCronCall) {
      // Déjà authentifié via le secret service_role ci-dessus : c'est un
      // appel serveur (weekly-cron) sur toute la base, pas un client —
      // les IDs sont pris tels quels.
      athleteIds = requestedAthleteIds;
      userIds = requestedUserIds;
    } else {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
      if (authError || !caller) return json(401, origin, { error: "Non authentifié." });

      const { data: callerRow, error: callerError } = await admin
        .from("users").select("id, club_id, role").eq("auth_uid", caller.id).maybeSingle();
      if (callerError || !callerRow) return json(401, origin, { error: "Profil introuvable." });
      logCaller = `role:${callerRow.role}`;

      const isCoach = callerRow.role === "head_coach" || callerRow.role === "coach";
      const isAthlete = callerRow.role === "athlete";
      if (!isCoach && !isAthlete) {
        return json(403, origin, { error: "Rôle non autorisé." });
      }

      // Une requête peut cibler tout un groupe, elle compte donc comme une
      // seule action utilisateur. Les crons service_role ne passent pas ici.
      const minuteAgo = new Date(Date.now() - 60_000).toISOString();
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const [minuteCount, dayCount] = await Promise.all([
        admin.from("push_delivery_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", callerRow.id).gte("created_at", minuteAgo),
        admin.from("push_delivery_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", callerRow.id).gte("created_at", dayAgo),
      ]);
      if (minuteCount.error || dayCount.error) throw minuteCount.error ?? dayCount.error;
      if ((minuteCount.count ?? 0) >= MAX_USER_REQUESTS_PER_MINUTE || (dayCount.count ?? 0) >= MAX_USER_REQUESTS_PER_DAY) {
        return json(429, origin, { error: "Trop de notifications envoyées. Réessaie plus tard." });
      }
      const { error: attemptError } = await admin.from("push_delivery_attempts").insert({
        user_id: callerRow.id,
        recipient_count: requestedRecipientCount,
      });
      if (attemptError) throw attemptError;

      // athleteIds : toujours limité au club de l'appelant, coach ET athlete
      // (un athlète a des usages légitimes vers ses coéquipiers — post club,
      // messagerie inter-athlètes — et vers lui-même).
      if (requestedAthleteIds.length) {
        const { data, error } = await admin.from("athletes").select("id")
          .eq("club_id", callerRow.club_id).in("id", requestedAthleteIds);
        if (error) throw error;
        athleteIds = (data ?? []).map((r: { id: number }) => r.id);
      }

      // userIds : coach peut cibler n'importe quel user de son club ;
      // athlete uniquement les coachs (head_coach/coach) de son club.
      if (requestedUserIds.length) {
        let query = admin.from("users").select("id")
          .eq("club_id", callerRow.club_id).in("id", requestedUserIds);
        if (isAthlete) query = query.in("role", ["head_coach", "coach"]);
        const { data, error } = await query;
        if (error) throw error;
        userIds = (data ?? []).map((r: { id: number }) => r.id);
      }

      if (athleteIds.length !== requestedAthleteIds.length || userIds.length !== requestedUserIds.length) {
        return json(403, origin, { error: "Certains destinataires ne font pas partie de ton club, ou ne sont pas autorisés pour ce rôle." });
      }
    }

    if (!athleteIds.length && !userIds.length) {
      return json(400, origin, { error: "Aucun destinataire." });
    }

    // ── Validation du contenu de la notification ─────────────────────
    const title   = typeof body.title === "string" ? body.title.trim() : "";
    const msgBody = typeof body.body  === "string" ? body.body.trim()  : "";
    const url     = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "/";
    const tag     = typeof body.tag === "string" && body.tag.trim() ? body.tag.trim() : "athleteos";

    if (!title || title.length > MAX_TITLE_LEN)     return json(400, origin, { error: "Titre invalide." });
    if (!msgBody || msgBody.length > MAX_MESSAGE_LEN) return json(400, origin, { error: "Corps du message invalide." });
    if (!url.startsWith("/") || url.length > MAX_URL_LEN) return json(400, origin, { error: "URL invalide." });
    if (tag.length > MAX_TAG_LEN)                    return json(400, origin, { error: "Tag invalide." });

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("send-push: configuration VAPID manquante");
      return json(503, origin, { error: "Notifications indisponibles." });
    }
    webpush.setVapidDetails(
      "mailto:contact@athleteos.app",
      vapidPublicKey,
      vapidPrivateKey,
    );

    // Bug trouvé en construisant le cron serveur : userIds (notifs coach)
    // n'était jamais lu ici — seul athleteIds l'était. Toute notif push
    // destinée au coach (récap, message d'un athlète, rapports dispo...)
    // créait bien la ligne d'alerte en base mais n'envoyait jamais de vraie
    // push, silencieusement.
    let subs: { endpoint: string; p256dh: string; auth: string }[] = [];
    if (athleteIds.length) {
      const { data, error } = await admin.from("push_subscriptions")
        .select("endpoint, p256dh, auth").in("athlete_id", athleteIds);
      if (error) throw error;
      subs = subs.concat(data ?? []);
    }
    if (userIds.length) {
      const { data, error } = await admin.from("push_subscriptions")
        .select("endpoint, p256dh, auth").in("user_id", userIds);
      if (error) throw error;
      subs = subs.concat(data ?? []);
    }

    // Journalisation : compteurs et identité de l'appelant uniquement,
    // jamais le titre/corps du message (contenu potentiellement sensible :
    // messages, blessures, alertes de charge...).
    console.log("send-push caller=", logCaller, "athletes=", athleteIds.length, "users=", userIds.length, "subs=", subs.length);

    const payload = JSON.stringify({ title, body: msgBody, url, tag });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    console.log("Résultat:", sent, "envoyés,", failed, "échoués");

    // ── Nettoyage : un abonnement en 404/410 est mort côté navigateur
    // (permission révoquée, service worker désinstallé...) — on le retire
    // de la base pour ne plus essayer de lui envoyer de notifs.
    const deadEndpoints = results
      .map((r: PromiseSettledResult<unknown>, i: number) => ({ r, endpoint: subs[i]?.endpoint }))
      .filter(({ r }: { r: PromiseSettledResult<unknown> }) =>
        r.status === "rejected" && [404, 410].includes((r as PromiseRejectedResult).reason?.statusCode)
      )
      .map(({ endpoint }: { endpoint: string | undefined }) => endpoint)
      .filter(Boolean) as string[];

    if (deadEndpoints.length) {
      const { error: cleanupError } = await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
      if (cleanupError) throw cleanupError;
      console.log("Abonnements expirés supprimés:", deadEndpoints.length);
    }

    // Nettoyage borné et non critique de l'historique de quota.
    if (isCronCall) {
      const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const { error: pruneError } = await admin.from("push_delivery_attempts").delete().lt("created_at", cutoff);
      if (pruneError) console.error("send-push quota cleanup:", pruneError.message);
    }

    return json(200, origin, { sent, failed, cleaned: deadEndpoints.length });
  } catch (err) {
    // Message générique côté client : on ne renvoie pas err.message (peut
    // contenir des détails internes), seulement en log serveur.
    console.error("send-push error:", err instanceof Error ? err.message : err);
    return json(500, origin, { error: "Erreur serveur." });
  }
});
