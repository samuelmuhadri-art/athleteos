import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function localDateInBelgium(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  if ((req.headers.get("Authorization") ?? "") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  let dryRun = false;
  try { dryRun = !!(await req.json())?.dry_run; } catch { /* corps facultatif */ }

  const admin = createClient(supabaseUrl, serviceKey);
  const today = localDateInBelgium();
  const log: string[] = [];
  const { data: sessions, error } = await admin.from("sessions")
    .select("id, club_id, title, time, lifecycle_status, session_athletes(athlete_id)")
    .eq("session_date", today)
    .in("lifecycle_status", ["planned", "live"]);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  for (const session of sessions ?? []) {
    const athleteIds = (session.session_athletes ?? []).map((row: { athlete_id: number }) => row.athlete_id);
    if (!athleteIds.length) continue;
    const { data: existing } = await admin.from("athlete_notifications").select("athlete_id")
      .eq("session_id", session.id).eq("type", "session_day_reminder").in("athlete_id", athleteIds);
    const sent = new Set((existing ?? []).map((row: { athlete_id: number }) => row.athlete_id));
    const targets = athleteIds.filter((id: number) => !sent.has(id));
    if (!targets.length) continue;
    const time = session.time ? String(session.time).slice(0, 5) : null;
    const title = `Séance aujourd’hui — ${session.title}`;
    const description = time ? `Ta séance commence à ${time}. Pense à confirmer ta présence.` : "Ta séance est prévue aujourd’hui. Pense à confirmer ta présence.";
    log.push(`session=${session.id} athletes=[${targets}]`);
    if (dryRun) continue;
    const { error: insertError } = await admin.from("athlete_notifications").insert(targets.map((athleteId: number) => ({
      athlete_id: athleteId, club_id: session.club_id, session_id: session.id,
      type: "session_day_reminder", title, description, is_read: false,
    })));
    if (insertError) { log.push(`insert-error=${insertError.message}`); continue; }
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ athleteIds: targets, userIds: [], title, body: description, url: "/planning", tag: `session-day-${session.id}` }),
    });
    if (!pushResponse.ok) log.push(`push-error=${pushResponse.status}`);
  }

  return new Response(JSON.stringify({ ok: true, dryRun, date: today, log }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
