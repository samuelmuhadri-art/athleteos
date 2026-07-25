import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Identifie l'appelant via son propre JWT (transmis automatiquement par
    // supabase.functions.invoke) — jamais faire confiance à un id envoyé
    // dans le corps de la requête pour savoir "qui appelle".
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Non authentifié.");

    const { data: callerRow, error: callerErr } = await admin
      .from("users").select("id, club_id, role").eq("auth_uid", caller.id).single();
    if (callerErr || !callerRow) throw new Error("Profil introuvable.");
    const isCoach = callerRow.role === "head_coach" || callerRow.role === "coach";

    const body = await req.json();
    const { action } = body;

    if (action === "rename_club") {
      if (!isCoach) throw new Error("Action réservée au coach.");
      const clubName = (body.clubName ?? "").trim();
      if (!clubName) throw new Error("Nom manquant.");
      const { error } = await admin.from("clubs").update({ name: clubName }).eq("id", callerRow.club_id);
      if (error) throw error;
      return ok({});
    }

    if (action === "regenerate_invite_code") {
      if (!isCoach) throw new Error("Action réservée au coach.");
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        code = genCode();
        const { data: exists } = await admin.from("clubs").select("id").eq("invite_code", code).maybeSingle();
        if (!exists) break;
      }
      const { error } = await admin.from("clubs").update({ invite_code: code }).eq("id", callerRow.club_id);
      if (error) throw error;
      return ok({ inviteCode: code });
    }

    if (action === "remove_user") {
      if (!isCoach) throw new Error("Action réservée au coach.");
      const { userId } = body;
      const { data: targetRow } = await admin.from("users").select("id, club_id, auth_uid").eq("id", userId).single();
      if (!targetRow) throw new Error("Utilisateur introuvable.");
      if (targetRow.club_id !== callerRow.club_id) throw new Error("Cet utilisateur n'est pas dans ton club.");
      if (targetRow.id === callerRow.id) throw new Error("Tu ne peux pas te retirer toi-même.");

      await admin.from("athletes").delete().eq("user_id", targetRow.id);
      await admin.from("users").delete().eq("id", targetRow.id);
      if (targetRow.auth_uid) await admin.auth.admin.deleteUser(targetRow.auth_uid).catch(() => {});
      return ok({});
    }

    if (action === "update_profile") {
      // N'importe quel utilisateur connecté peut modifier SON PROPRE nom —
      // on ignore tout userId envoyé par le client, on modifie toujours
      // callerRow.id (déterminé côté serveur depuis le JWT).
      const name = (body.name ?? "").trim();
      if (!name) throw new Error("Nom manquant.");
      const { error } = await admin.from("users").update({ name }).eq("id", callerRow.id);
      if (error) throw error;
      return ok({});
    }

    throw new Error("Action inconnue.");
  } catch (err) {
    console.error("admin-actions error:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
