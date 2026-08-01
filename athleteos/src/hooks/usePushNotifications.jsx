// ============================================================
// AthleteOS — src/hooks/usePushNotifications.jsx
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { persistCurrentPushSubscription } from "../utils/pushSubscriptions";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications(athleteId, clubId, userId = null) {
  const [subscribed,      setSubscribed]      = useState(false);
  const [permissionState, setPermissionState] = useState("default");
  const [swReady,         setSwReady]         = useState(false);
  const [registration,    setRegistration]    = useState(null);

  // ── Enregistrement du Service Worker ──────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        setSwReady(true);
        setPermissionState(Notification.permission);
        // La présence d'un abonnement dans le navigateur ne prouve pas qu'il
        // appartient au compte courant. L'effet d'identité ci-dessous fait la
        // vérification avant d'afficher l'état actif.
        setSubscribed(false);
      })
      .catch(console.error);
  }, []);

  // ── Correction automatique : subscription navigateur sans athlete_id en base ──
  // Si une subscription existe dans le navigateur mais pas en base avec le bon
  // athlete_id (ou user_id), on la réinsère automatiquement.
  // C'est ce qui se passe quand Samuel avait une sub mais athlete_id=NULL en base.
  useEffect(() => {
    if (!swReady || !registration || !clubId) return;
    if (Notification.permission !== "granted") return;

    const fixSubscription = async () => {
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }

      const subJson = sub.toJSON();

      // Cherche en base
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id, athlete_id, user_id")
        .eq("endpoint", subJson.endpoint)
        .maybeSingle();

      // Si la ligne existe avec les bons ids → tout va bien
      if (existing) {
        const athleteOk = athleteId ? existing.athlete_id === athleteId : true;
        const userOk    = userId    ? existing.user_id    === userId    : true;
        if (athleteOk && userOk) {
          setSubscribed(true);
          return;
        }
      }

      const applicationServerKey = VAPID_PUBLIC_KEY ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : null;
      const { error } = await persistCurrentPushSubscription({
        supabaseClient: supabase,
        registration,
        subscription: sub,
        applicationServerKey,
        clubId,
        athleteId,
        userId,
      });
      if (error) throw error;
      setSubscribed(true);
    };

    fixSubscription().catch(console.error);
  }, [swReady, registration, clubId, athleteId, userId]);

  // ── Abonnement manuel (bouton) ─────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReady || !registration || !VAPID_PUBLIC_KEY) return;
    if (subscribed) return;
    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== "granted") return;

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const { error } = await persistCurrentPushSubscription({
        supabaseClient: supabase,
        registration,
        subscription: sub,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        clubId,
        athleteId,
        userId,
      });
      if (error) throw error;
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription error:", err);
    }
  }, [swReady, registration, athleteId, clubId, userId, subscribed]);

  return { subscribed, subscribe, permissionState, swReady };
}

// ── Bouton toggle ──────────────────────────────────────────────────────────
export function PushToggleButton({ subscribed, onToggle, permissionState, compact = false }) {
  const noSupport = !("serviceWorker" in navigator) || !("PushManager" in window);
  if (noSupport) return null;
  const denied = permissionState === "denied";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={subscribed || denied}
      aria-label={compact ? (subscribed ? "Notifications actives" : denied ? "Notifications bloquées par le navigateur" : "Activer les notifications") : undefined}
      title={compact ? (subscribed ? "Notifications actives" : denied ? "Notifications bloquées" : "Activer les notifications") : undefined}
      className={[
        "flex items-center justify-center rounded-xl text-[12px] font-semibold border transition-all",
        compact ? "w-11 h-11 p-0" : "gap-2 px-3 py-2",
        subscribed || denied ? "cursor-default" : "hover:border-[var(--c-border-strong)]",
      ].join(" ")}
      style={
        subscribed
          ? { background: "rgba(29,158,117,0.12)", borderColor: "rgba(29,158,117,0.30)", color: "var(--tone-success)" }
          : denied
            ? { background: "rgba(224,82,82,0.08)", borderColor: "rgba(224,82,82,0.18)", color: "var(--tone-danger)" }
            : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-2)" }
      }
    >
      <span aria-hidden={compact ? "true" : undefined}>{subscribed ? "🔔" : "🔕"}</span>
      {!compact && <span>{subscribed ? "Notifs actives" : denied ? "Bloquées par le navigateur" : "Activer les notifs"}</span>}
    </button>
  );
}
