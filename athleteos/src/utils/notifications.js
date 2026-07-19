// ============================================================
// AthleteOS — src/utils/notifications.js
// Notifications centralisées :
// - Alertes coach (table alerts)
// - Notifications athlète (table athlete_notifications)
// - Web Push système via Supabase Edge Function (nouveau)
// ============================================================

import { supabase } from "./supabaseClient";
import { getAthleteMetricsForWeek } from "./chargeCalculations";

// ─── WEB PUSH — envoi via Edge Function ───────────────────────

/**
 * Envoie une notification push système sur le téléphone des athlètes.
 * Requiert la table push_subscriptions et l'Edge Function send-push.
 *
 * @param {number[]} athleteIds - IDs des athlètes à notifier
 * @param {object}   payload    - { title, body, url?, tag? }
 */
async function sendWebPush(athleteIds, payload) {
  if (!athleteIds?.length) return;

  try {
    // Appel de l'Edge Function Supabase
    const { error } = await supabase.functions.invoke("send-push", {
      body: {
        athleteIds,
        title: payload.title,
        body:  payload.body,
        url:   payload.url ?? "/",
        tag:   payload.tag ?? "athleteos",
      },
    });
    if (error) console.warn("Web Push error:", error.message);
  } catch (err) {
    // Non bloquant : si le push échoue, l'app continue
    console.warn("Web Push non disponible:", err.message);
  }
}

// ─── ALERTES COACH ────────────────────────────────────────────

export async function checkAndAlertACWR(clubId, athletes, weeklyCharge, currentWeek) {
  for (const athlete of athletes) {
    const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek);

    if (metrics.acwr > 1.3) {
      const { data: existing } = await supabase.from("alerts").select("id")
        .eq("club_id", clubId).eq("athlete_id", athlete.id).eq("type", "charge")
        .gte("created_at", new Date(Date.now() - 7*86400000).toISOString()).limit(1);
      if (!existing?.length) {
        await supabase.from("alerts").insert({
          club_id: clubId, athlete_id: athlete.id, type: "charge",
          title: `⚠️ Surcharge — ${athlete.name}`,
          description: `ACWR de ${metrics.acwr.toFixed(2)} (seuil 1.30). Risque élevé de blessure. Envisage une récupération.`,
          severity: "élevée", is_read: false,
        });
      }
    }

    if (metrics.acwr < 0.8 && metrics.acwr > 0) {
      const { data: existing } = await supabase.from("alerts").select("id")
        .eq("club_id", clubId).eq("athlete_id", athlete.id).eq("type", "charge")
        .ilike("title", "%sous-charge%")
        .gte("created_at", new Date(Date.now() - 7*86400000).toISOString()).limit(1);
      if (!existing?.length) {
        await supabase.from("alerts").insert({
          club_id: clubId, athlete_id: athlete.id, type: "charge",
          title: `📉 Sous-charge — ${athlete.name}`,
          description: `ACWR de ${metrics.acwr.toFixed(2)} (seuil 0.80). Risque de déconditionnement.`,
          severity: "légère", is_read: false,
        });
      }
    }
  }
}

export async function alertSessionAbsence(clubId, athlete, session) {
  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })
    : session.day ?? "";
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, type: "absence",
    title: `❌ Absence — ${athlete.name}`,
    description: `${athlete.name} n'a pas réalisé "${session.title}" du ${dateStr}.`,
    severity: "modérée", is_read: false,
  });
}

export async function alertNewInjury(clubId, athlete, injury) {
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, type: "blessure",
    title: `🩺 Blessure signalée — ${athlete.name}`,
    description: `${athlete.name} a signalé : ${injury.name} (${injury.location}), intensité ${injury.intensity}/10.`,
    severity: injury.intensity >= 7 ? "élevée" : injury.intensity >= 4 ? "modérée" : "légère",
    is_read: false,
  });
}

export async function alertAthleteSession(clubId, athlete, session) {
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, type: "performance",
    title: `📋 Séance planifiée par ${athlete.name}`,
    description: `${athlete.name} a planifié "${session.title}" le ${
      new Date(session.sessionDate || Date.now()).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })
    }.`,
    severity: "légère", is_read: false,
  });
}

export async function alertNewRecord(clubId, athlete, discipline, result, compName) {
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, type: "performance",
    title: `🏆 Nouveau record — ${athlete.name}`,
    description: `${athlete.name} a établi un nouveau record en ${discipline} : ${result}${compName ? ` lors de "${compName}"` : ""}.`,
    severity: "info", is_read: false,
  });
}

export async function checkUpcomingCompetitions(clubId, competitions) {
  const today   = new Date();
  const in7days = new Date(today.getTime() + 7*86400000);
  const yesterday = new Date(today.getTime() - 86400000);

  for (const comp of competitions) {
    const compDate = new Date(comp.date);
    if (compDate > yesterday && compDate <= in7days) {
      const { data: existing } = await supabase.from("alerts").select("id")
        .eq("club_id", clubId).eq("type", "competition")
        .ilike("title", `%${comp.name}%`)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString()).limit(1);
      if (!existing?.length) {
        const days = Math.round((compDate - today) / 86400000);
        await supabase.from("alerts").insert({
          club_id: clubId, athlete_id: null, type: "competition",
          title: `🏟️ ${comp.name} — dans ${days === 0 ? "aujourd'hui" : `${days} jour${days>1?"s":""}`}`,
          description: `${comp.athleteIds?.length ?? 0} athlète${(comp.athleteIds?.length??0)>1?"s":""} engagé${(comp.athleteIds?.length??0)>1?"s":""}. Vérifier l'état de forme du groupe.`,
          severity: days <= 2 ? "élevée" : "modérée", is_read: false,
        });
      }
    }
  }
}

// ─── NOTIFICATIONS ATHLÈTE ────────────────────────────────────

/**
 * Notifie les athlètes d'une nouvelle séance planifiée par le coach.
 * DOUBLE NOTIFICATION :
 * 1. Insertion en BDD (athlete_notifications) → badge dans l'app
 * 2. Web Push système → notification sur le téléphone
 */
export async function notifyAthleteNewSession(clubId, athleteIds, session) {
  if (!athleteIds?.length) return;

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })
    : session.day ?? "";

  const title = `📋 Nouvelle séance — ${session.title}`;
  const description = `Le coach a planifié "${session.title}" le ${dateStr}.`;

  // 1. Notification in-app (BDD)
  const rows = athleteIds.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "new_session",
    title,
    description,
    is_read: false,
  }));
  await supabase.from("athlete_notifications").insert(rows);

  // 2. Web Push système (non bloquant)
  await sendWebPush(athleteIds, {
    title,
    body: description,
    url:  "/",
    tag:  `session-${session.title}`,
  });
}

export async function notifyAthleteResult(clubId, athleteId, discipline, result, compName) {
  const title       = `🏆 Résultat saisi — ${discipline}`;
  const description = `Ton résultat en ${discipline} lors de "${compName}" : ${result}.`;

  await supabase.from("athlete_notifications").insert({
    athlete_id: athleteId, club_id: clubId, type: "result_added",
    title, description, is_read: false,
  });

  await sendWebPush([athleteId], { title, body: description, tag: "result" });
}

export async function notifyAthleteMessage(clubId, athleteId, coachName, preview) {
  const title       = `💬 Message de ${coachName ?? "ton coach"}`;
  const description = preview ? preview.slice(0, 100) : "Tu as reçu un nouveau message.";

  await supabase.from("athlete_notifications").insert({
    athlete_id: athleteId, club_id: clubId, type: "message",
    title, description, is_read: false,
  });

  // Push prioritaire pour les messages
  await sendWebPush([athleteId], {
    title,
    body: description,
    url:  "/",
    tag:  "message", // remplace la notif précédente du même tag
  });
}

export async function notifyGoalAchieved(clubId, athleteId, discipline, targetValue) {
  const title       = `🎯 Objectif atteint — ${discipline}`;
  const description = `Tu as atteint ton objectif de ${targetValue} en ${discipline}. Félicitations !`;

  await supabase.from("athlete_notifications").insert({
    athlete_id: athleteId, club_id: clubId, type: "goal_achieved",
    title, description, is_read: false,
  });

  await sendWebPush([athleteId], { title, body: description, tag: "goal" });
}

export async function notifyAthleteCompetitionReminder(clubId, competition) {
  if (!competition.athleteIds?.length) return;
  const days        = Math.round((new Date(competition.date) - new Date()) / 86400000);
  const title       = `🏟️ ${competition.name} dans ${days} jour${days>1?"s":""}`;
  const description = `La compétition a lieu le ${new Date(competition.date).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })}. Reste concentré !`;

  const rows = competition.athleteIds.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "competition_reminder",
    title, description, is_read: false,
  }));
  await supabase.from("athlete_notifications").insert(rows);

  await sendWebPush(competition.athleteIds, {
    title,
    body: description,
    tag:  `comp-${competition.id}`,
  });
}