import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIsoWeekContext, localDateInTimeZone } from "../_shared/isoWeek.ts";

type Session = {
  athleteIds: number[];
  validations: { athleteId: number; status: string | null }[];
};

type Athlete = { id: number; name: string };

const MAX_BODY_BYTES = 2_000;

function computeWeeklyStats(athleteId: number, sessions: Session[]) {
  const relevant = sessions.filter((session) => session.athleteIds.includes(athleteId));
  let done = 0;
  let partial = 0;
  let none = 0;
  for (const session of relevant) {
    const validation = session.validations.find((row) => row.athleteId === athleteId);
    if (validation?.status === "done") done += 1;
    else if (validation?.status === "partial") partial += 1;
    else if (validation?.status === "none") none += 1;
  }
  return { total: relevant.length, done, partial, none };
}

async function requireData<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  operation: string,
): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`${operation}: ${error.message}`);
  return data as T;
}

async function sendPush(
  supabaseUrl: string,
  serviceKey: string,
  payload: { title: string; body: string; tag: string },
  athleteIds: number[],
  userIds: number[],
  dryRun: boolean,
  log: string[],
) {
  log.push(`push athletes=${athleteIds.length} users=${userIds.length} tag=${payload.tag}`);
  if (dryRun) return;
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({ athleteIds, userIds, ...payload }),
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? "unknown";
    throw new Error(`send-push HTTP ${response.status}, request=${requestId}`);
  }
}

serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    console.error("weekly-cron: configuration Supabase manquante");
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
  const week = getIsoWeekContext(localDateInTimeZone(new Date(), "Europe/Brussels"));
  const log: string[] = [];
  const clubSummaries: { athletes: number }[] = [];

  try {
    const clubs = await requireData<Array<{ id: number }>>(
      admin.from("clubs").select("id"),
      "chargement clubs",
    ) ?? [];

    for (const club of clubs) {
      const athletes = await requireData<Athlete[]>(
        admin.from("athletes").select("id, name").eq("club_id", club.id),
        "chargement athlètes",
      ) ?? [];
      if (!athletes.length) continue;

      const coach = await requireData<{ id: number } | null>(
        admin.from("users").select("id")
          .eq("club_id", club.id).eq("role", "head_coach").limit(1).maybeSingle(),
        "chargement head coach",
      );

      const sessionsRaw = await requireData<Array<{
        session_athletes: Array<{ athlete_id: number; status: string | null }> | null;
      }>>(
        admin.from("sessions")
          .select("session_athletes(athlete_id, status)")
          .eq("club_id", club.id)
          .gte("session_date", week.startDate)
          .lte("session_date", week.endDate)
          .neq("lifecycle_status", "cancelled"),
        "chargement séances",
      ) ?? [];
      const sessions: Session[] = sessionsRaw.map((session) => {
        const rows = session.session_athletes ?? [];
        return {
          athleteIds: rows.map((row) => row.athlete_id),
          validations: rows.map((row) => ({ athleteId: row.athlete_id, status: row.status })),
        };
      });

      let totalAll = 0;
      let doneAll = 0;
      const concerns: string[] = [];
      const statsByAthlete = new Map<number, ReturnType<typeof computeWeeklyStats>>();
      for (const athlete of athletes) {
        const stats = computeWeeklyStats(athlete.id, sessions);
        statsByAthlete.set(athlete.id, stats);
        totalAll += stats.total;
        doneAll += stats.done;
        if (stats.total > 0 && (stats.partial > 0 || stats.none > 0)) {
          concerns.push(`${athlete.name.split(" ")[0]} (${stats.done}/${stats.total})`);
        }
      }

      if (totalAll > 0) {
        const pct = Math.round((doneAll / totalAll) * 100);
        const title = `📊 Récap S${week.week} · ${week.year}`;
        const description = `${doneAll}/${totalAll} séances réalisées (${pct}%).`
          + (concerns.length ? ` À suivre : ${concerns.join(", ")}.` : " Toute l'équipe est à jour.");
        const dedupeKey = `coach-recap-${week.key}`;
        let inserted = true;
        if (!dryRun) {
          const rows = await requireData<Array<{ id: number }>>(
            admin.from("alerts").upsert({
              club_id: club.id,
              athlete_id: null,
              type: "recap",
              title,
              description,
              severity: concerns.length ? "modérée" : "info",
              is_read: false,
              dedupe_key: dedupeKey,
            }, { onConflict: "club_id,type,dedupe_key", ignoreDuplicates: true }).select("id"),
            "création récap coach",
          ) ?? [];
          inserted = rows.length > 0;
        }
        if (inserted && coach?.id) {
          await sendPush(supabaseUrl, serviceKey, { title, body: description, tag: dedupeKey }, [], [coach.id], dryRun, log);
        }
      }

      const recapRows = athletes.flatMap((athlete) => {
        const stats = statsByAthlete.get(athlete.id);
        if (!stats || stats.total === 0) return [];
        const title = `📊 Ta semaine — S${week.week} · ${week.year}`;
        const description = `${stats.done}/${stats.total} séance${stats.total > 1 ? "s" : ""} réalisée${stats.done > 1 ? "s" : ""}`
          + (stats.partial ? `, ${stats.partial} partielle${stats.partial > 1 ? "s" : ""}` : "")
          + (stats.none ? `, ${stats.none} manquée${stats.none > 1 ? "s" : ""}` : "") + ".";
        return [{
          athlete_id: athlete.id,
          club_id: club.id,
          type: "weekly_recap",
          title,
          description,
          is_read: false,
          dedupe_key: `athlete-recap-${week.key}`,
        }];
      });
      let insertedRecaps = recapRows;
      if (!dryRun && recapRows.length) {
        insertedRecaps = await requireData<typeof recapRows>(
          admin.from("athlete_notifications")
            .upsert(recapRows, { onConflict: "athlete_id,type,dedupe_key", ignoreDuplicates: true })
            .select("athlete_id, club_id, type, title, description, is_read, dedupe_key"),
          "création récaps athlètes",
        ) ?? [];
      }
      for (const row of insertedRecaps) {
        await sendPush(
          supabaseUrl,
          serviceKey,
          { title: row.title, body: row.description, tag: row.dedupe_key },
          [row.athlete_id],
          [],
          dryRun,
          log,
        );
      }

      const reportTitle = `📄 Rapports S${week.week} · ${week.year} disponibles — ${athletes.length} athlète${athletes.length > 1 ? "s" : ""}`;
      const reportDescription = "Les rapports hebdomadaires de tous les athlètes sont prêts dans le module Rapports.";
      const reportDedupeKey = `coach-report-${week.key}`;
      let reportInserted = true;
      if (!dryRun) {
        const rows = await requireData<Array<{ id: number }>>(
          admin.from("alerts").upsert({
            club_id: club.id,
            athlete_id: null,
            type: "weekly_report",
            title: reportTitle,
            description: reportDescription,
            severity: "info",
            is_read: false,
            dedupe_key: reportDedupeKey,
          }, { onConflict: "club_id,type,dedupe_key", ignoreDuplicates: true }).select("id"),
          "création rapport coach",
        ) ?? [];
        reportInserted = rows.length > 0;
      }
      if (reportInserted && coach?.id) {
        await sendPush(supabaseUrl, serviceKey, {
          title: reportTitle,
          body: reportDescription,
          tag: reportDedupeKey,
        }, [], [coach.id], dryRun, log);
      }

      const athleteReportRows = athletes.map((athlete) => ({
        athlete_id: athlete.id,
        club_id: club.id,
        type: "weekly_report",
        title: `📄 Ton rapport de la semaine — S${week.week} · ${week.year}`,
        description: "Ton rapport de la semaine est disponible dans Mes performances.",
        is_read: false,
        dedupe_key: `athlete-report-${week.key}`,
      }));
      let insertedReports = athleteReportRows;
      if (!dryRun) {
        insertedReports = await requireData<typeof athleteReportRows>(
          admin.from("athlete_notifications")
            .upsert(athleteReportRows, { onConflict: "athlete_id,type,dedupe_key", ignoreDuplicates: true })
            .select("athlete_id, club_id, type, title, description, is_read, dedupe_key"),
          "création rapports athlètes",
        ) ?? [];
      }
      for (const row of insertedReports) {
        await sendPush(
          supabaseUrl,
          serviceKey,
          { title: row.title, body: row.description, tag: row.dedupe_key },
          [row.athlete_id],
          [],
          dryRun,
          log,
        );
      }

      clubSummaries.push({ athletes: athletes.length });
    }

    return new Response(JSON.stringify({
      ok: true,
      dryRun,
      week: week.key,
      clubsProcessed: clubSummaries.length,
      clubSummaries,
      log,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("weekly-cron error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "weekly_cron_failed", week: week.key }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
