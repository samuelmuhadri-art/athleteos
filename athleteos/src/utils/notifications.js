// ============================================================
// AthleteOS — src/utils/notifications.js
// ============================================================

import { supabase } from "./supabaseClient";
import { getAthleteMetricsForWeek } from "./chargeCalculations";

// ── Envoi push générique ──────────────────────────────────────
// Supporte athleteIds (pour les athlètes) ET userIds (pour les coaches)
async function sendWebPush(athleteIds, payload, userIds = []) {
  const hasAthletes = athleteIds?.length > 0;
  const hasUsers    = userIds?.length > 0;
  if (!hasAthletes && !hasUsers) return;

  console.log("sendWebPush appelé — athleteIds:", athleteIds, "userIds:", userIds, payload.title);
  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        athleteIds: athleteIds ?? [],
        userIds:    userIds    ?? [],
        title: payload.title,
        body:  payload.body,
        url:   payload.url ?? "/",
        tag:   payload.tag ?? "athleteos",
      },
    });
    console.log("send-push response:", data, error);
    if (error) console.warn("Web Push error:", error.message);
  } catch (err) {
    console.warn("Web Push non disponible:", err.message);
  }
}

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
  const today     = new Date();
  const in7days   = new Date(today.getTime() + 7*86400000);
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

export async function notifyAthleteNewSession(clubId, athleteIds, session) {
  if (!athleteIds?.length) return;
  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })
    : session.day ?? "";
  const title       = `📋 Nouvelle séance — ${session.title}`;
  const description = `Le coach a planifié "${session.title}" le ${dateStr}.`;
  const rows = athleteIds.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "new_session",
    title, description, is_read: false,
  }));
  await supabase.from("athlete_notifications").insert(rows);
  await sendWebPush(athleteIds, { title, body: description, url: "/", tag: `session-${session.title}` });
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
  // Notif push vers l'athlète (par athlete_id)
  await sendWebPush([athleteId], { title, body: description, url: "/", tag: "message" });
}

// ── NOUVEAU : notif push vers le coach quand un athlète envoie un message ──
// coachUserId = users.id du coach (ex: 1 pour Benoît)
export async function notifyCoachMessage(coachUserId, athleteName, preview) {
  if (!coachUserId) return;
  const title       = `💬 Message de ${athleteName}`;
  const description = preview ? preview.slice(0, 100) : "Tu as reçu un nouveau message.";
  // Pas d'insertion dans athlete_notifications (c'est pour les athlètes)
  // On envoie uniquement la push par user_id
  await sendWebPush([], { title, body: description, url: "/", tag: "message" }, [coachUserId]);
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

  // Pas de rappel en double pour la même compétition dans les dernières 24h
  // (le coach peut recharger le dashboard plusieurs fois par jour, ce qui
  // redéclenche cette vérification à chaque fois).
  const { data: existing } = await supabase.from("athlete_notifications")
    .select("athlete_id")
    .eq("club_id", clubId).eq("type", "competition_reminder")
    .ilike("title", `%${competition.name}%`)
    .in("athlete_id", competition.athleteIds)
    .gte("created_at", new Date(Date.now() - 86400000).toISOString());
  const alreadyNotified = new Set((existing ?? []).map(r => r.athlete_id));
  const targetIds = competition.athleteIds.filter(id => !alreadyNotified.has(id));
  if (!targetIds.length) return;

  const rows = targetIds.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "competition_reminder",
    title, description, is_read: false,
  }));
  await supabase.from("athlete_notifications").insert(rows);
  await sendWebPush(targetIds, { title, body: description, tag: `comp-${competition.id}` });
}

// ── Récap hebdomadaire (lundi → samedi, envoyé le samedi soir) ─────────────
// Déclenché côté client (dans fetchAll du dashboard coach et de l'appli
// athlète) — pas de vrai cron serveur pour l'instant, donc ça part dès que
// quelqu'un ouvre l'app entre samedi 18h et dimanche minuit. Le dédoublonnage
// se fait sur le numéro de semaine dans le titre.
function isRecapWindow() {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche, 6 = samedi
  return (day === 6 && now.getHours() >= 18) || day === 0;
}

function computeWeeklyStats(athleteId, sessions) {
  const relevant = (sessions ?? []).filter(s => s.athleteIds?.includes(athleteId) && s.day !== "Dimanche");
  let done = 0, partial = 0, none = 0;
  relevant.forEach(s => {
    const v = s.validations?.find(x => x.athleteId === athleteId);
    if (v?.status === "done") done++;
    else if (v?.status === "partial") partial++;
    else if (v?.status === "none") none++;
  });
  return { total: relevant.length, done, partial, none };
}

// Notif individuelle — utilisée à la fois par le récap coach (en boucle,
// un par athlète) et par l'appli athlète elle-même (au cas où le coach n'a
// pas ouvert son dashboard le samedi soir).
export async function notifyAthleteWeeklyRecap(clubId, athlete, sessions, currentWeek) {
  if (!isRecapWindow()) return;
  const stats = computeWeeklyStats(athlete.id, sessions);
  if (stats.total === 0) return;

  const { data: existing } = await supabase.from("athlete_notifications").select("id")
    .eq("athlete_id", athlete.id).eq("type", "weekly_recap")
    .ilike("title", `%S${currentWeek}%`).limit(1);
  if (existing?.length) return;

  const title = `📊 Ta semaine — S${currentWeek}`;
  const description = `${stats.done}/${stats.total} séance${stats.total > 1 ? "s" : ""} réalisée${stats.done > 1 ? "s" : ""}` +
    (stats.partial ? `, ${stats.partial} partielle${stats.partial > 1 ? "s" : ""}` : "") +
    (stats.none ? `, ${stats.none} manquée${stats.none > 1 ? "s" : ""}` : "") + ".";

  await supabase.from("athlete_notifications").insert({
    athlete_id: athlete.id, club_id: clubId, type: "weekly_recap", title, description, is_read: false,
  });
  await sendWebPush([athlete.id], { title, body: description, tag: `recap-${currentWeek}` });
}

// Récap squad-wide pour le coach — une alerte + push, plus le récap
// individuel de chaque athlète (déjà en boucle ici, pas besoin que chacun
// ouvre son appli pour recevoir le sien).
export async function checkWeeklyRecap(clubId, athletes, sessions, currentWeek, coachUserId) {
  if (!isRecapWindow()) return;

  const { data: existing } = await supabase.from("alerts").select("id")
    .eq("club_id", clubId).eq("type", "recap")
    .ilike("title", `%semaine ${currentWeek}%`).limit(1);

  if (!existing?.length) {
    let totalAll = 0, doneAll = 0;
    const concerns = [];
    athletes.forEach(a => {
      const s = computeWeeklyStats(a.id, sessions);
      totalAll += s.total; doneAll += s.done;
      if (s.total > 0 && (s.partial > 0 || s.none > 0)) concerns.push(`${a.name.split(" ")[0]} (${s.done}/${s.total})`);
    });
    if (totalAll > 0) {
      const pct   = Math.round((doneAll / totalAll) * 100);
      const title = `📊 Récap semaine ${currentWeek}`;
      const description = `${doneAll}/${totalAll} séances réalisées (${pct}%).` +
        (concerns.length ? ` À suivre : ${concerns.join(", ")}.` : " Toute l'équipe est à jour.");
      await supabase.from("alerts").insert({
        club_id: clubId, athlete_id: null, type: "recap", title, description,
        severity: concerns.length ? "modérée" : "info", is_read: false,
      });
      if (coachUserId) await sendWebPush([], { title, body: description, tag: `recap-${currentWeek}` }, [coachUserId]);
    }
  }

  for (const a of athletes) {
    await notifyAthleteWeeklyRecap(clubId, a, sessions, currentWeek);
  }
}

// ── Rapports hebdomadaires (générés à la volée, pas de table dédiée) ───────
// Fenêtre de déclenchement dimanche 18h → lundi 6h — distincte de la
// fenêtre du récap ci-dessus (samedi 18h → dimanche minuit), ce sont deux
// features séparées avec leurs propres types de notif ("weekly_report" vs
// "weekly_recap") donc pas de dédoublonnage croisé possible.
function isReportWindow() {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche, 1 = lundi
  return (day === 0 && now.getHours() >= 18) || (day === 1 && now.getHours() < 6);
}

export async function notifyAthleteWeeklyReport(clubId, athlete, currentWeek) {
  if (!isReportWindow()) return;

  const { data: existing } = await supabase.from("athlete_notifications").select("id")
    .eq("athlete_id", athlete.id).eq("type", "weekly_report")
    .ilike("title", `%S${currentWeek}%`).limit(1);
  if (existing?.length) return;

  const title       = `📄 Ton rapport de la semaine — S${currentWeek}`;
  const description = "Ton rapport de la semaine est disponible dans Mes performances.";
  await supabase.from("athlete_notifications").insert({
    athlete_id: athlete.id, club_id: clubId, type: "weekly_report", title, description, is_read: false,
  });
  await sendWebPush([athlete.id], { title, body: description, tag: `report-${currentWeek}` });
}

// Déclenché côté coach (boucle sur tous les athlètes du club + push perso).
export async function checkWeeklyReports(clubId, athletes, currentWeek, coachUserId) {
  if (!isReportWindow()) return;

  const { data: existing } = await supabase.from("alerts").select("id")
    .eq("club_id", clubId).eq("type", "weekly_report")
    .ilike("title", `%semaine ${currentWeek}%`).limit(1);

  if (!existing?.length && athletes.length > 0) {
    const title       = `📄 Rapports semaine ${currentWeek} disponibles — ${athletes.length} athlète${athletes.length > 1 ? "s" : ""}`;
    const description = "Les rapports hebdomadaires de tous les athlètes sont prêts dans le module Rapports.";
    await supabase.from("alerts").insert({
      club_id: clubId, athlete_id: null, type: "weekly_report", title, description,
      severity: "info", is_read: false,
    });
    if (coachUserId) await sendWebPush([], { title, body: description, tag: `report-${currentWeek}` }, [coachUserId]);
  }

  for (const a of athletes) {
    await notifyAthleteWeeklyReport(clubId, a, currentWeek);
  }
}

// ── Post auto-généré dans le fil du club (record battu / objectif atteint) ──
// Donne du contenu au fil "Mon club" même quand personne ne partage de photo
// manuellement. auto_type distingue ces posts des posts manuels côté UI.
export async function postClubCelebration(clubId, athleteId, autoType, content) {
  await supabase.from("social_posts").insert({
    athlete_id: athleteId, club_id: clubId, session_id: null,
    content, image_url: null, auto_type: autoType,
  });
}

// <-- AJOUT POUR LES PHOTOS BEREAL DU CLUB
export async function notifyClubNewPost(clubId, authorName, allAthleteIds) {
  if (!allAthleteIds?.length) return;
  const title = `📸 Nouveau post de ${authorName}`;
  const description = `${authorName} a partagé une séance dans le club !`;
  
  await sendWebPush(allAthleteIds, { 
    title, 
    body: description, 
    url: "/", 
    tag: "social" 
  });
}