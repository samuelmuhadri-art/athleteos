import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, body: msgBody, url, tag } = body;
    const athleteIds = (body.athleteIds ?? []).map((id: unknown) => Number(id));
    const userIds    = (body.userIds ?? []).map((id: unknown) => String(id));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    webpush.setVapidDetails(
      "mailto:contact@athleteos.app",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // Bug trouvé en construisant le cron serveur : userIds (notifs coach)
    // n'était jamais lu ici — seul athleteIds l'était. Toute notif push
    // destinée au coach (récap, message d'un athlète, rapports dispo...)
    // créait bien la ligne d'alerte en base mais n'envoyait jamais de vraie
    // push, silencieusement.
    let subs: { endpoint: string; p256dh: string; auth: string }[] = [];
    if (athleteIds.length) {
      const { data } = await supabase.from("push_subscriptions").select("*").in("athlete_id", athleteIds);
      subs = subs.concat(data ?? []);
    }
    if (userIds.length) {
      const { data } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
      subs = subs.concat(data ?? []);
    }

    console.log("Envoi à", subs?.length, "abonnements");

    const payload = JSON.stringify({ title, body: msgBody, url: url ?? "/", tag });

    const results = await Promise.allSettled(
      (subs ?? []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    const sent   = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    console.log("Résultat:", sent, "envoyés,", failed, "échoués");

    // ── Nettoyage : un abonnement en 404/410 est mort côté navigateur
    // (permission révoquée, service worker désinstallé...) — on le retire
    // de la base pour ne plus essayer de lui envoyer de notifs.
    const deadEndpoints = results
      .map((r: PromiseSettledResult<unknown>, i: number) => ({ r, endpoint: subs?.[i]?.endpoint }))
      .filter(({ r }: { r: PromiseSettledResult<unknown> }) =>
        r.status === "rejected" && [404, 410].includes((r as PromiseRejectedResult).reason?.statusCode)
      )
      .map(({ endpoint }: { endpoint: string | undefined }) => endpoint)
      .filter(Boolean);

    if (deadEndpoints.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
      console.log("Abonnements expirés supprimés:", deadEndpoints.length);
    }

    return new Response(JSON.stringify({ sent, failed, cleaned: deadEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erreur:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});