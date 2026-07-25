import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sans caractères ambigus (0/O, 1/I/l) — un code que quelqu'un peut recopier
// depuis un écran ou dicter à l'oral sans se planter.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let createdClubId: number | null = null;
  let createdAuthUserId: string | null = null;

  try {
    const body = await req.json();
    const { mode, email, password, name } = body;

    if (!email?.trim() || !password || !name?.trim()) throw new Error("Champs manquants.");
    if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
    if (mode !== "create_club" && mode !== "join_club") throw new Error("Mode invalide.");

    let clubId: number;

    if (mode === "create_club") {
      const clubName = (body.clubName ?? "").trim();
      if (!clubName) throw new Error("Nom du club manquant.");

      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        code = genCode();
        const { data: exists } = await admin.from("clubs").select("id").eq("invite_code", code).maybeSingle();
        if (!exists) break;
      }

      const { data: club, error: clubErr } = await admin
        .from("clubs")
        .insert({ name: clubName, invite_code: code })
        .select()
        .single();
      if (clubErr) throw clubErr;
      clubId = club.id;
      createdClubId = club.id;
    } else {
      const inviteCode = (body.inviteCode ?? "").trim().toUpperCase();
      if (!inviteCode) throw new Error("Code d'invitation manquant.");

      const { data: club, error: clubErr } = await admin
        .from("clubs").select("id").eq("invite_code", inviteCode).maybeSingle();
      if (clubErr) throw clubErr;
      if (!club) throw new Error("Code d'invitation invalide.");
      clubId = club.id;
    }

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // accès immédiat, pas d'email à confirmer
    });
    if (authErr) throw authErr;
    createdAuthUserId = authData.user.id;

    const role = mode === "create_club" ? "head_coach" : "athlete";
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .insert({ auth_uid: authData.user.id, name: name.trim(), email: email.trim(), role, club_id: clubId })
      .select()
      .single();
    if (userErr) throw userErr;

    if (mode === "join_club") {
      const { error: athErr } = await admin
        .from("athletes")
        .insert({ club_id: clubId, name: name.trim(), user_id: userRow.id });
      if (athErr) throw athErr;
    }

    return new Response(JSON.stringify({ success: true, clubId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Rollback best-effort : on ne laisse pas de compte auth orphelin sans
    // ligne `users`, ni de club vide si la création complète a échoué.
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
    if (createdClubId) await admin.from("clubs").delete().eq("id", createdClubId).catch(() => {});
    console.error("signup error:", err.message);
    // Toujours 200 côté HTTP : le client lit juste `success`/`error` dans le
    // corps — évite les ambiguïtés de supabase-js sur le parsing des
    // réponses non-2xx pour functions.invoke().
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
