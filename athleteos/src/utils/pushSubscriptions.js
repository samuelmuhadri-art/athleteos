function subscriptionPayload(subscription, { clubId, athleteId, userId }) {
  const value = subscription.toJSON();
  return {
    club_id: clubId,
    endpoint: value.endpoint,
    p256dh: value.keys?.p256dh,
    auth: value.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 200),
    athlete_id: athleteId ?? null,
    user_id: userId ?? null,
  };
}

async function replaceDatabaseSubscription(supabaseClient, subscription, identity) {
  const payload = subscriptionPayload(subscription, identity);
  await supabaseClient.from("push_subscriptions").delete().eq("endpoint", payload.endpoint);
  const { error } = await supabaseClient.from("push_subscriptions").insert(payload);
  return { error, payload };
}

// Réattribue l'abonnement du navigateur au compte courant. Si un ancien compte
// possède encore le même endpoint et que la RLS empêche sa suppression, on
// révoque cet endpoint côté push puis on en crée un nouveau : l'ancien compte
// ne peut ainsi plus recevoir de notification sur cet appareil partagé.
export async function persistCurrentPushSubscription({
  supabaseClient,
  registration,
  subscription,
  applicationServerKey,
  clubId,
  athleteId = null,
  userId = null,
}) {
  const identity = { clubId, athleteId, userId };
  let current = subscription;
  let result = await replaceDatabaseSubscription(supabaseClient, current, identity);

  if (result.error?.code === "23505" && applicationServerKey) {
    await current.unsubscribe();
    current = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    result = await replaceDatabaseSubscription(supabaseClient, current, identity);
  }

  return { subscription: current, error: result.error ?? null };
}

// À appeler avant supabase.auth.signOut(), tant que la RLS reconnaît encore
// le propriétaire de la ligne. Même si la suppression DB échoue, la révocation
// navigateur invalide l'endpoint ; send-push le nettoiera ensuite sur 404/410.
export async function revokeCurrentPushSubscription(supabaseClient, serviceWorkerContainer = navigator.serviceWorker) {
  if (!serviceWorkerContainer?.getRegistration) return { found: false, databaseError: null, browserRevoked: false };

  const registration = await serviceWorkerContainer.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return { found: false, databaseError: null, browserRevoked: false };

  const endpoint = subscription.endpoint ?? subscription.toJSON?.().endpoint;
  let databaseError = null;
  if (endpoint) {
    const result = await supabaseClient.from("push_subscriptions").delete().eq("endpoint", endpoint);
    databaseError = result.error ?? null;
  }

  const browserRevoked = await subscription.unsubscribe();
  return { found: true, databaseError, browserRevoked };
}
