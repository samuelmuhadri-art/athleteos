// ============================================================
// AthleteOS — src/utils/notifications.js
// ============================================================

import { supabase } from "./supabaseClient";

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
  // API conservée pour ne pas casser les appels du Dashboard. La génération
  // automatique d'alertes ACWR est volontairement désactivée : ce ratio
  // expérimental ne permet pas d'inférer un risque individuel.
  void clubId;
  void athletes;
  void weeklyCharge;
  void currentWeek;
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

// ── Tâche 14 : dispatch de l'outbox de notifications ──────────────────────
// Les RPC create_solo_competition_result/add_competition_result (voir
// migration 20260730010000) écrivent leurs événements dans
// notification_outbox DANS LA MÊME TRANSACTION que le résultat/record —
// ce n'est qu'APRÈS le retour en succès du RPC (donc après COMMIT
// confirmé) qu'on dépêche ici les vraies notifications, puis qu'on marque
// les événements traités (mark_notification_outbox_sent, la seule façon
// autorisée de modifier notification_outbox depuis le client). Un échec
// de dispatch pour un événement (push indisponible, etc.) n'empêche pas
// les autres de partir — chacun est traité indépendamment.
export async function dispatchOutboxNotifications(notifications) {
  if (!notifications?.length) return;
  const sentIds = [];
  for (const evt of notifications) {
    const p = evt.payload ?? {};
    try {
      if (evt.type === "competition_new_record") {
        await alertNewRecord(p.clubId, { id: p.athleteId, name: p.athleteName }, p.discipline, p.result, p.competitionName);
        await postClubCelebration(p.clubId, p.athleteId, "record",
          `${p.athleteName?.split(" ")[0] ?? "Un athlète"} a battu son record en ${p.discipline} : ${p.result} !`);
      } else if (evt.type === "competition_result_added") {
        await notifyAthleteResult(p.clubId, p.athleteId, p.discipline, p.result, p.competitionName ?? "");
      }
      sentIds.push(evt.outboxId);
    } catch (err) {
      console.warn("Échec dispatch notification outbox:", evt.type, err.message ?? err);
    }
  }
  if (sentIds.length) {
    const { error } = await supabase.rpc("mark_notification_outbox_sent", { p_ids: sentIds });
    if (error) console.warn("mark_notification_outbox_sent :", error.message);
  }
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

export async function notifyAthleteSessionUpdated(clubId, athleteIds, session) {
  if (!athleteIds?.length) return;
  const dateStr = session.sessionDate
    ? new Date(`${String(session.sessionDate).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" })
    : "prochainement";
  const title = `Séance modifiée — ${session.title}`;
  const description = `Le coach a mis à jour cette séance prévue ${dateStr}${session.time ? ` à ${String(session.time).slice(0, 5)}` : ""}.`;
  const recent = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: existing } = await supabase.from("athlete_notifications").select("athlete_id")
    .eq("club_id", clubId).eq("type", "session_updated").eq("title", title)
    .in("athlete_id", athleteIds).gte("created_at", recent);
  const alreadyNotified = new Set((existing ?? []).map(row => row.athlete_id));
  const targets = athleteIds.filter(id => !alreadyNotified.has(id));
  if (!targets.length) return;
  await supabase.from("athlete_notifications").insert(targets.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "session_updated", title, description, is_read: false,
  })));
  await sendWebPush(targets, { title, body: description, url: "/planning", tag: `session-update-${session.id ?? session.title}` });
}

export async function notifyAthleteFeedbackReminder(clubId, athleteIds, session) {
  if (!athleteIds?.length) return;
  const title = `Ton retour manque — ${session.title}`;
  const description = "Indique ta présence, la durée réellement effectuée et ton effort ressenti. Cela prend moins d’une minute.";
  const recent = new Date(Date.now() - 12 * 60 * 60_000).toISOString();
  const { data: existing } = await supabase.from("athlete_notifications").select("athlete_id")
    .eq("club_id", clubId).eq("type", "session_feedback_reminder").eq("title", title)
    .in("athlete_id", athleteIds).gte("created_at", recent);
  const alreadyNotified = new Set((existing ?? []).map(row => row.athlete_id));
  const targets = athleteIds.filter(id => !alreadyNotified.has(id));
  if (!targets.length) return;
  await supabase.from("athlete_notifications").insert(targets.map(athleteId => ({
    athlete_id: athleteId, club_id: clubId, type: "session_feedback_reminder", title, description, is_read: false,
  })));
  await sendWebPush(targets, { title, body: description, url: "/planning", tag: `session-feedback-${session.id ?? session.title}` });
}

export async function notifyCoachSessionResponse(clubId, coachUserId, athlete, session, response, note = "") {
  if (response === "going") return;
  const responseLabel = response === "unavailable" ? "ne pourra pas participer" : "n’est pas encore certain de participer";
  const title = `Réponse séance — ${athlete.name}`;
  const cleanNote = String(note ?? "").trim().slice(0, 500);
  const description = `${athlete.name} ${responseLabel} à « ${session.title} ».${cleanNote ? ` Message : « ${cleanNote} »` : ""}`;
  const { data: existing } = await supabase.from("alerts").select("id")
    .eq("club_id", clubId).eq("athlete_id", athlete.id).eq("type", "session_response")
    .eq("session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const alertPayload = {
    club_id: clubId, athlete_id: athlete.id, session_id: session.id, type: "session_response", title, description,
    severity: response === "unavailable" ? "modérée" : "info", is_read: false, created_at: new Date().toISOString(),
  };
  if (existing?.id) await supabase.from("alerts").update(alertPayload).eq("id", existing.id);
  else await supabase.from("alerts").insert(alertPayload);
  if (coachUserId) await sendWebPush([], { title, body: description, url: "/planning", tag: `session-response-${session.id}` }, [coachUserId]);
}

export async function notifyCoachAthleteSession(clubId, coachUserId, athlete, session) {
  const date = session.sessionDate
    ? new Date(`${String(session.sessionDate).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })
    : "prochainement";
  const title = `Séance proposée par ${athlete.name}`;
  const description = `${athlete.name} a ajouté « ${session.title} » le ${date}. Elle attend ta vérification dans le planning.`;
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, session_id: session.id, type: "athlete_session",
    title, description, severity: "info", is_read: false,
  });
  if (coachUserId) await sendWebPush([], { title, body: description, url: "/planning", tag: `athlete-session-${session.id}` }, [coachUserId]);
}

export async function notifyCoachClubPost(clubId, coachUserId, athlete, { hasPhoto = false, caption = "" } = {}) {
  const title = `${hasPhoto ? "Nouvelle photo" : "Nouveau partage"} — ${athlete.name}`;
  const cleanCaption = String(caption ?? "").trim().slice(0, 160);
  const description = cleanCaption || `${athlete.name} a partagé un moment d’entraînement avec le club.`;
  await supabase.from("alerts").insert({
    club_id: clubId, athlete_id: athlete.id, type: "social_post",
    title, description, severity: "info", is_read: false,
  });
  if (coachUserId) await sendWebPush([], { title, body: description, url: "/", tag: `club-post-${athlete.id}` }, [coachUserId]);
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
