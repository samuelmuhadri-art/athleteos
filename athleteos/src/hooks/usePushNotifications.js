import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { persistCurrentPushSubscription } from "../utils/pushSubscriptions";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications(athleteId, clubId, userId = null) {
  const [subscribed, setSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState("default");
  const [swReady, setSwReady] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        setSwReady(true);
        setPermissionState(Notification.permission);
        setSubscribed(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!swReady || !registration || !clubId) return;
    if (Notification.permission !== "granted") return;

    const fixSubscription = async () => {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscribed(false);
        return;
      }

      const subscriptionJson = subscription.toJSON();
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id, athlete_id, user_id")
        .eq("endpoint", subscriptionJson.endpoint)
        .maybeSingle();

      if (existing) {
        const athleteMatches = athleteId ? existing.athlete_id === athleteId : true;
        const userMatches = userId ? existing.user_id === userId : true;
        if (athleteMatches && userMatches) {
          setSubscribed(true);
          return;
        }
      }

      const applicationServerKey = VAPID_PUBLIC_KEY ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : null;
      const { error } = await persistCurrentPushSubscription({
        supabaseClient: supabase,
        registration,
        subscription,
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

  const subscribe = useCallback(async () => {
    if (!swReady || !registration || !VAPID_PUBLIC_KEY || subscribed) return;
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== "granted") return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const { error } = await persistCurrentPushSubscription({
        supabaseClient: supabase,
        registration,
        subscription,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        clubId,
        athleteId,
        userId,
      });
      if (error) throw error;
      setSubscribed(true);
    } catch (error) {
      console.error("Push subscription error:", error);
    }
  }, [swReady, registration, athleteId, clubId, userId, subscribed]);

  return { subscribed, subscribe, permissionState, swReady };
}
