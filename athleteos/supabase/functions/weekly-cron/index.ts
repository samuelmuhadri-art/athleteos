// ============================================================
// AthleteOS — supabase/functions/weekly-cron/index.ts
//
// Cron serveur réel pour les notifs hebdo (récap + rapports).
// Avant ça, ces notifs ne partaient QUE si quelqu'un ouvrait l'app
// dans la bonne fenêtre horaire (checkWeeklyRecap/checkWeeklyReports
// dans src/utils/notifications.js, déclenchés depuis Dashboard.jsx /
// AthleteApp.jsx) — un dimanche soir sans personne connectée = rien
// n'était envoyé, silencieusement.
//
// Planifié par pg_cron (voir migration 20260727020000), qui appelle
// cette fonction une fois par semaine. La logique ci-dessous est le
// pendant serveur de computeWeeklyStats/checkWeeklyRecap/
// checkWeeklyReports côté client — mêmes formats de titre (dédoublonnage
// par "S{semaine}" / "semaine {semaine}"), mêmes tables, donc les deux
// chemins (client et cron) restent mutuellement idempotents.
//
// Sécurité : n'accepte que les appels authentifiés avec le service_role
// key (vérifié en plus de la vérification JWT native de la plateforme).
// Support d'un flag dry_run pour valider la logique sans rien écrire ni
// envoyer de vraie notification.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Session = { day: string | null; athleteIds: number[]; validations: { athleteId: number; status: string | null }[] };

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function computeWeeklyStats(athleteId: number, sessions: Session[]) {
  const relevant = sessions.filter(s => s.athleteIds.includes(athleteId) && s.day !== "Dimanche");
  let done = 0, partial = 0, none = 0;
  relevant.forEach(s => {
    const v = s.validations.find(x => x.athleteId === athleteId);
    if (v?.status === "done") done++;
    else if (v?.status === "partial") partial++;
    else if (v?.status === "none") none++;
  });
  return { total: relevant.length, done, partial, none };
}

async function sendPush(
  supabaseUrl: string, serviceKey: string,
  payload: { title: string; body: string; tag: string },
  athleteIds: number[] = [], userIds: (string | number)[] = [],
  dryRun: boolean, log: string[],
) {
  log.push(`push → athletes=[${athleteIds}] users=[${userIds}] "${payload.title}"`);
  if (dryRun) return;
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({ athleteIds, userIds, ...payload }),
  });
}

serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = !!body?.dry_run;
  } catch { /* pas de body = pas dry_run */ }

  const supabase = createClient(supabaseUrl, serviceKey);
  const currentWeek = getISOWeek(new Date());
  const log: string[] = [];
  const clubSummaries: { clubId: number; athletes: number }[] = [];

  const { data: clubs } = await supabase.from("clubs").select("id");

  for (const club of clubs ?? []) {
    const clubId = club.id as number;

    const { data: athletesData } = await supabase.from("athletes").select("id, name").eq("club_id", clubId);
    const athletes = athletesData ?? [];
    if (athletes.length === 0) continue;

    const { data: coach } = await supabase.from("users").select("id")
      .eq("club_id", clubId).eq("role", "head_coach").maybeSingle();
    const coachUserId = coach?.id ?? null;

    const { data: sessionsRaw } = await supabase.from("sessions")
      .select("day, session_athletes(athlete_id, status)")
      .eq("club_id", clubId).eq("week", currentWeek);
    const sessions: Session[] = (sessionsRaw ?? []).map((s: any) => ({
      day: s.day,
      athleteIds: (s.session_athletes ?? []).map((v: any) => v.athlete_id),
      validations: (s.session_athletes ?? []).map((v: any) => ({ athleteId: v.athlete_id, status: v.status })),
    }));

    // ── Récap hebdo (coach) ────────────────────────────────────────
    const { data: recapExisting } = await supabase.from("alerts").select("id")
      .eq("club_id", clubId).eq("type", "recap").ilike("title", `%semaine ${currentWeek}%`).limit(1);
    if (!recapExisting?.length) {
      let totalAll = 0, doneAll = 0;
      const concerns: string[] = [];
      athletes.forEach((a: any) => {
        const s = computeWeeklyStats(a.id, sessions);
        totalAll += s.total; doneAll += s.done;
        if (s.total > 0 && (s.partial > 0 || s.none > 0)) concerns.push(`${a.name.split(" ")[0]} (${s.done}/${s.total})`);
      });
      if (totalAll > 0) {
        const pct = Math.round((doneAll / totalAll) * 100);
        const title = `📊 Récap semaine ${currentWeek}`;
        const description = `${doneAll}/${totalAll} séances réalisées (${pct}%).` +
          (concerns.length ? ` À suivre : ${concerns.join(", ")}.` : " Toute l'équipe est à jour.");
        log.push(`alert(recap) club=${clubId} "${title}"`);
        if (!dryRun) {
          await supabase.from("alerts").insert({
            club_id: clubId, athlete_id: null, type: "recap", title, description,
            severity: concerns.length ? "modérée" : "info", is_read: false,
          });
        }
        if (coachUserId) await sendPush(supabaseUrl, serviceKey, { title, body: description, tag: `recap-${currentWeek}` }, [], [coachUserId], dryRun, log);
      }
    }

    // ── Récap hebdo (par athlète) ───────────────────────────────────
    for (const a of athletes as any[]) {
      const stats = computeWeeklyStats(a.id, sessions);
      if (stats.total === 0) continue;
      const { data: existing } = await supabase.from("athlete_notifications").select("id")
        .eq("athlete_id", a.id).eq("type", "weekly_recap").ilike("title", `%S${currentWeek}%`).limit(1);
      if (existing?.length) continue;

      const title = `📊 Ta semaine — S${currentWeek}`;
      const description = `${stats.done}/${stats.total} séance${stats.total > 1 ? "s" : ""} réalisée${stats.done > 1 ? "s" : ""}` +
        (stats.partial ? `, ${stats.partial} partielle${stats.partial > 1 ? "s" : ""}` : "") +
        (stats.none ? `, ${stats.none} manquée${stats.none > 1 ? "s" : ""}` : "") + ".";
      log.push(`notif(weekly_recap) athlete=${a.id} "${title}"`);
      if (!dryRun) {
        await supabase.from("athlete_notifications").insert({
          athlete_id: a.id, club_id: clubId, type: "weekly_recap", title, description, is_read: false,
        });
      }
      await sendPush(supabaseUrl, serviceKey, { title, body: description, tag: `recap-${currentWeek}` }, [a.id], [], dryRun, log);
    }

    // ── Rapports hebdo (coach) ──────────────────────────────────────
    const { data: reportExisting } = await supabase.from("alerts").select("id")
      .eq("club_id", clubId).eq("type", "weekly_report").ilike("title", `%semaine ${currentWeek}%`).limit(1);
    if (!reportExisting?.length) {
      const title = `📄 Rapports semaine ${currentWeek} disponibles — ${athletes.length} athlète${athletes.length > 1 ? "s" : ""}`;
      const description = "Les rapports hebdomadaires de tous les athlètes sont prêts dans le module Rapports.";
      log.push(`alert(weekly_report) club=${clubId} "${title}"`);
      if (!dryRun) {
        await supabase.from("alerts").insert({
          club_id: clubId, athlete_id: null, type: "weekly_report", title, description, severity: "info", is_read: false,
        });
      }
      if (coachUserId) await sendPush(supabaseUrl, serviceKey, { title, body: description, tag: `report-${currentWeek}` }, [], [coachUserId], dryRun, log);
    }

    // ── Rapports hebdo (par athlète) ────────────────────────────────
    for (const a of athletes as any[]) {
      const { data: existing } = await supabase.from("athlete_notifications").select("id")
        .eq("athlete_id", a.id).eq("type", "weekly_report").ilike("title", `%S${currentWeek}%`).limit(1);
      if (existing?.length) continue;

      const title = `📄 Ton rapport de la semaine — S${currentWeek}`;
      const description = "Ton rapport de la semaine est disponible dans Mes performances.";
      log.push(`notif(weekly_report) athlete=${a.id} "${title}"`);
      if (!dryRun) {
        await supabase.from("athlete_notifications").insert({
          athlete_id: a.id, club_id: clubId, type: "weekly_report", title, description, is_read: false,
        });
      }
      await sendPush(supabaseUrl, serviceKey, { title, body: description, tag: `report-${currentWeek}` }, [a.id], [], dryRun, log);
    }

    clubSummaries.push({ clubId, athletes: athletes.length });
  }

  return new Response(JSON.stringify({ ok: true, dryRun, week: currentWeek, clubs: clubSummaries, log }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
