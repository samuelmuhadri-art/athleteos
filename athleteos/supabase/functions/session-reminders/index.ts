import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { localDateInTimeZone } from "../_shared/isoWeek.ts";
import { dispatchTrustedPushEvents } from "../_shared/pushOutbox.ts";

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
    // The existing daily task also evaluates configured coach rules when no session is planned today.
    const { data: ruleClubs, error: ruleError } = await admin.from("club_alert_rules").select("club_id").eq("enabled", true);
    if (ruleError) throw ruleError;
    for (const clubId of [...new Set((ruleClubs ?? []).map(row => row.club_id))]) {
      const { error: evaluationError } = await admin.rpc("evaluate_club_alert_rules", {
        p_club_id: clubId, p_as_of: today, p_dry_run: dryRun,
      });
      if (evaluationError) throw evaluationError;
    }
    // Retry the durable existing outbox, including alerts generated from the dashboard.
    if (!dryRun) {
      const { data: pending, error: pendingError } = await admin.from("push_event_outbox")
        .select("actor_user_id").in("event_type", ["rule_wellness", "rule_feedback", "rule_competition", "rule_load"])
        .is("completed_at", null);
      if (pendingError) throw pendingError;
      for (const actorId of [...new Set((pending ?? []).map(row => row.actor_user_id).filter(Boolean))]) {
        for (let batch = 0; batch < 50; batch++) {
          const dispatched = await dispatchTrustedPushEvents(admin, actorId, async payload => {
            const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`send-push HTTP ${response.status}`);
            return await response.json();
          });
          if (dispatched.events < 20) break;
        }
      }
    }
    const { data: sessions, error } = await admin.from("sessions")
      .select("id, club_id, title, time, lifecycle_status, session_athletes(athlete_id)")
      .eq("session_date", today)
      .in("lifecycle_status", ["planned", "live"]);
    if (error) throw error;
    const sessionAthleteIds = [...new Set((sessions ?? []).flatMap((session) =>
      (session.session_athletes ?? []).map((row: { athlete_id: number }) => row.athlete_id)
    ))];
    const sessionClubIds = [...new Set((sessions ?? []).map((session) => session.club_id))];
    const [clubConfig, athleteConfig] = await Promise.all([
      sessionClubIds.length ? admin.from("club_modules").select("club_id, enabled").eq("module_key", "planning").in("club_id", sessionClubIds) : Promise.resolve({ data: [], error: null }),
      sessionAthleteIds.length ? admin.from("athlete_modules").select("athlete_id, enabled").eq("module_key", "planning").in("athlete_id", sessionAthleteIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (clubConfig.error || athleteConfig.error) throw clubConfig.error ?? athleteConfig.error;
    const clubPlanning = new Map((clubConfig.data ?? []).map((row: { club_id: number; enabled: boolean }) => [row.club_id, row.enabled]));
    const athletePlanning = new Map((athleteConfig.data ?? []).map((row: { athlete_id: number; enabled: boolean }) => [row.athlete_id, row.enabled]));

    for (const session of sessions ?? []) {
      if (clubPlanning.get(session.club_id) === false) continue;
      const athleteIds = [...new Set(
        (session.session_athletes ?? []).map((row: { athlete_id: number }) => row.athlete_id),
      )].filter((athleteId) => athletePlanning.get(athleteId) !== false);
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
          moduleKey: "planning",
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
