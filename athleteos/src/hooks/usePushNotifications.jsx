// ============================================================
// AthleteOS — src/hooks/usePushNotifications.jsx
// Supporte à la fois les athlètes (athlete_id) et les coachs (user_id)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

// athleteId : id de la table athletes (pour les athlètes)
// userId    : id de la table users (pour les coachs)
// clubId    : id du club
export function usePushNotifications(athleteId, clubId, userId = null) {
  const [subscribed,      setSubscribed]      = useState(false);
  const [permissionState, setPermissionState] = useState("default");
  const [swReady,         setSwReady]         = useState(false);
  const [registration,    setRegistration]    = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        setSwReady(true);
        setPermissionState(Notification.permission);
        return reg.pushManager.getSubscription();
      })
      .then((sub) => { setSubscribed(!!sub); })
      .catch(console.error);
  }, []);

  const subscribe = useCallback(async () => {
    if (!swReady || !registration || !VAPID_PUBLIC_KEY) return;
    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== "granted") return;

      const existingSub = await registration.pushManager.getSubscription();
if (existingSub) {
  // Supprimer seulement en BDD, garder l'abonnement navigateur intact
  await supabase.from("push_subscriptions")
    .delete()
    .eq("endpoint", existingSub.endpoint);
  setSubscribed(false);
  return;
}

      const sub     = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = sub.toJSON();

      // Upsert avec athlete_id OU user_id selon le type d'utilisateur
      const row = {
        club_id:    clubId,
        endpoint:   subJson.endpoint,
        p256dh:     subJson.keys?.p256dh,
        auth:       subJson.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        athlete_id: athleteId ?? null,
        user_id:    userId ?? null,
      };

     // Supprimer l'ancien si existe, puis insérer
await supabase.from("push_subscriptions").delete().eq("endpoint", subJson.endpoint);
const { error } = await supabase.from("push_subscriptions").insert(row);

      if (error) throw error;
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription error:", err);
    }
  }, [swReady, registration, athleteId, clubId, userId]);

  return { subscribed, subscribe, permissionState, swReady };
}

export function PushToggleButton({ subscribed, onToggle, permissionState }) {
  const isBlocked = permissionState === "denied";
  const noSupport = !("serviceWorker" in navigator) || !("PushManager" in window);
  if (noSupport) return null;

  return (
    <button
      onClick={onToggle}
      disabled={isBlocked}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all",
        subscribed
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : isBlocked
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
      ].join(" ")}
    >
      <span>{subscribed ? "🔔" : "🔕"}</span>
      <span>{subscribed ? "Notifs actives" : isBlocked ? "Bloquées" : "Activer les notifs"}</span>
    </button>
  );
}