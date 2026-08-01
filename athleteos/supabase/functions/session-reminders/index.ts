import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { localDateInTimeZone } from "../_shared/isoWeek.ts";

const MAX_BODY_BYTES = 2_000;

serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    console.error("session-reminders: configuration Supabase manquante");
    return new Response(JSON.stringify({ error: "configuration_error" }), { status: 503 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }
  if ((req.headers.get("Authorization") ?? "") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let dryRun = false;
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413 });
    }
    dryRun = rawBody ? Boolean(JSON.parse(rawBody)?.dry_run) : false;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const today = localDateInTimeZone(new Date(), "Europe/Brussels");
  const log: string[] = [];

  try {
    const { data: sessions, error } = await admin.from("sessions")
      .select("id, club_id, title, time, lifecycle_status, session_athletes(athlete_id)")
      .eq("session_date", today)
      .in("lifecycle_status", ["planned", "live"]);
    if (error) throw error;

    for (const session of sessions ?? []) {
      const athleteIds = [...new Set(
        (session.session_athletes ?? []).map((row: { athlete_id: number }) => row.athlete_id),
      )];
      if (!athleteIds.length) continue;

      const time = session.time ? String(session.time).slice(0, 5) : null;
      const title = `Séance aujourd’hui — ${session.title}`;
      const description = time
        ? `Ta séance commence à ${time}. Pense à confirmer ta présence.`
        : "Ta séance est prévue aujourd’hui. Pense à confirmer ta présence.";
      const dedupeKey = `session-day-${session.id}`;
      const rows = athleteIds.map((athleteId: number) => ({
        athlete_id: athleteId,
        club_id: session.club_id,
        session_id: session.id,
        type: "session_day_reminder",
        title,
        description,
        is_read: false,
        dedupe_key: dedupeKey,
      }));

      let targets = athleteIds;
      if (!dryRun) {
        const { data: inserted, error: insertError } = await admin
          .from("athlete_notifications")
          .upsert(rows, { onConflict: "athlete_id,type,dedupe_key", ignoreDuplicates: true })
          .select("athlete_id");
        if (insertError) throw insertError;
        targets = (inserted ?? []).map((row: { athlete_id: number }) => row.athlete_id);
      }
      if (!targets.length) continue;

      log.push(`sessionReminder athletes=${targets.length}`);
      if (dryRun) continue;
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({
          athleteIds: targets,
          userIds: [],
          title,
          body: description,
          url: "/planning",
          tag: dedupeKey,
        }),
      });
      if (!pushResponse.ok) {
        throw new Error(`send-push HTTP ${pushResponse.status}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, dryRun, date: today, log }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("session-reminders error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "session_reminders_failed", date: today }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
