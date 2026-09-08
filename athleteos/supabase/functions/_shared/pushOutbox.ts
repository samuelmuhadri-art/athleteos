// Aucun champ texte/destinataire du navigateur n'est utilisé pour construire une Push.
export const PUSH_EVENT_TEMPLATES = {
  rule_wellness: { title: "Suivi du bien-être", body: "Un point est à consulter dans les alertes AthleteOS.", moduleKey: "wellness", url: "/" },
  rule_feedback: { title: "Retour de séance à compléter", body: "Un point est à consulter dans les alertes AthleteOS.", moduleKey: "session_feedback", url: "/" },
  rule_competition: { title: "Préparation de compétition", body: "Un point est à consulter dans les alertes AthleteOS.", moduleKey: "performances", url: "/" },
  rule_load: { title: "Suivi de la charge", body: "Un point est à consulter dans les alertes AthleteOS.", moduleKey: "training_load", url: "/" },
  message_received: { title: "Nouveau message", body: "Ouvre la messagerie pour le lire.", moduleKey: "messaging", url: "/" },
  session_changed: { title: "Ton planning a été mis à jour", body: "Consulte ton planning pour voir ta séance.", moduleKey: "planning", url: "/planning" },
  session_proposed: { title: "Nouvelle séance proposée", body: "Une séance attend ta vérification dans le planning.", moduleKey: "planning", url: "/planning" },
  session_response: { title: "Nouvelle réponse à une séance", body: "Ouvre le planning pour lire la réponse de ton athlète.", moduleKey: "planning", url: "/planning" },
  social_post: { title: "Nouveau partage dans le club", body: "Ouvre AthleteOS pour découvrir ce partage.", moduleKey: "social", url: "/" },
  result_added: { title: "Un résultat a été ajouté", body: "Ouvre tes performances pour le consulter.", moduleKey: "performances", url: "/" },
  goal_achieved: { title: "Objectif atteint", body: "Retrouve ton objectif dans tes performances.", moduleKey: "performances", url: "/" },
  competition_reminder: { title: "Ta compétition approche", body: "Consulte les informations de ta compétition dans AthleteOS.", moduleKey: "performances", url: "/" },
  feedback_reminder: { title: "Ton retour de séance manque", body: "Ouvre ta séance pour indiquer ton effort ressenti.", moduleKey: "session_feedback", url: "/planning" },
  weekly_recap: { title: "Ton récapitulatif hebdomadaire", body: "Ouvre AthleteOS pour consulter le bilan de la semaine.", moduleKey: "session_feedback", url: "/" },
  weekly_report: { title: "Ton rapport hebdomadaire", body: "Ouvre AthleteOS pour consulter le rapport de la semaine.", moduleKey: "reports", url: "/" },
} as const;

type EventRow = { id: number; club_id: number; actor_user_id: number; event_type: string; entity_id: number; athlete_ids: number[]; user_ids: number[]; claimed_at: string };
type Payload = { clubId: number; athleteIds: number[]; userIds: number[]; title: string; body: string; moduleKey: string; url: string; tag: string };
type UpdateQuery = PromiseLike<{ error: unknown }> & { eq: (column: string, value: unknown) => UpdateQuery };
type PushOutboxAdmin = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: EventRow[] | null; error: unknown }>;
  from: (table: string) => { update: (values: Record<string, unknown>) => UpdateQuery };
};

export function trustedPushPayload(event: EventRow): Payload {
  if (!Object.hasOwn(PUSH_EVENT_TEMPLATES, event.event_type)) throw new Error("Unknown push event");
  const template = PUSH_EVENT_TEMPLATES[event.event_type as keyof typeof PUSH_EVENT_TEMPLATES];
  return { ...template, clubId: event.club_id, athleteIds: event.athlete_ids, userIds: event.user_ids, tag: `event-${event.id}` };
}

// Compatibilité avec les navigateurs déjà installés : seuls les tags de rappels
// servent d'intention. L'autorisation, la date et les cibles sont vérifiées en SQL.
export function reminderIntent(body: Record<string, unknown>) {
  if (["competition_reminder", "feedback_reminder"].includes(String(body.eventType)) && Number.isSafeInteger(body.entityId) && Number(body.entityId) > 0) {
    return { eventType: String(body.eventType), entityId: Number(body.entityId) };
  }
  const match = typeof body.tag === "string" ? /^(comp|session-feedback)-(\d+)$/.exec(body.tag) : null;
  if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) <= 0) return null;
  return { eventType: match[1] === "comp" ? "competition_reminder" : "feedback_reminder", entityId: Number(match[2]) };
}

// Le client Supabase concret est fourni par l'Edge Function. L'envoi est injecté
// pour tester les erreurs, reprises et frontières sans fournisseur Push externe.
export async function dispatchTrustedPushEvents(
  admin: PushOutboxAdmin,
  actorId: number,
  deliver: (payload: Payload) => Promise<{ sent?: number; failed?: number; cleaned?: number }>,
) {
  const { data: events, error } = await admin.rpc("claim_trusted_push_events", { p_actor_user_id: actorId });
  if (error) throw error; // Migration absente : échec fermé, jamais de retour au payload libre.
  const totals = { sent: 0, failed: 0, cleaned: 0, events: 0 };
  for (const event of events ?? []) {
    if (event.actor_user_id !== actorId) throw new Error("Invalid event owner");
    const payload = trustedPushPayload(event);
    // La file conserve tout l'effectif ; les appels de livraison restent bornés à 300 cibles.
    const targets = [...payload.athleteIds.map(id => ({ athlete: id })), ...payload.userIds.map(id => ({ user: id }))];
    for (let offset = 0; offset < targets.length; offset += 300) {
      const batch = targets.slice(offset, offset + 300);
      const result = await deliver({ ...payload, athleteIds: batch.flatMap(target => 'athlete' in target ? [target.athlete] : []), userIds: batch.flatMap(target => 'user' in target ? [target.user] : []) });
      totals.sent += result.sent ?? 0; totals.failed += result.failed ?? 0; totals.cleaned += result.cleaned ?? 0;
    }
    const { error: completeError } = await admin.from("push_event_outbox").update({ completed_at: new Date().toISOString() })
      .eq("id", event.id).eq("actor_user_id", actorId).eq("claimed_at", event.claimed_at);
    if (completeError) throw completeError;
    totals.events += 1;
  }
  return totals;
}
