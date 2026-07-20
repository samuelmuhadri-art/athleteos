// ============================================================
// AthleteOS — src/hooks/usePushNotifications.jsx
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
        return reg.pushManager.getSubscription();
      })
      .then((sub) => { setSubscribed(!!sub); })
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
      if (!sub) return;

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

      // Sinon on supprime l'ancienne et on réinsère avec les bons ids
      await supabase.from("push_subscriptions").delete().eq("endpoint", subJson.endpoint);
      const { error } = await supabase.from("push_subscriptions").insert({
        club_id:    clubId,
        endpoint:   subJson.endpoint,
        p256dh:     subJson.keys?.p256dh,
        auth:       subJson.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        athlete_id: athleteId ?? null,
        user_id:    userId    ?? null,
      });

      if (!error) {
        console.log("Push subscription corrigée en base ✅");
        setSubscribed(true);
      }
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
      const subJson = sub.toJSON();

      await supabase.from("push_subscriptions").delete().eq("endpoint", subJson.endpoint);
      const { error } = await supabase.from("push_subscriptions").insert({
        club_id:    clubId,
        endpoint:   subJson.endpoint,
        p256dh:     subJson.keys?.p256dh,
        auth:       subJson.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        athlete_id: athleteId ?? null,
        user_id:    userId    ?? null,
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
export function PushToggleButton({ subscribed, onToggle, permissionState }) {
  const noSupport = !("serviceWorker" in navigator) || !("PushManager" in window);
  if (noSupport) return null;

  return (
    <button
      onClick={onToggle}
      disabled={subscribed}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all",
        subscribed
          ? "bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default"
          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
      ].join(" ")}
    >
      <span>{subscribed ? "🔔" : "🔕"}</span>
      <span>{subscribed ? "Notifs actives" : "Activer les notifs"}</span>
    </button>
  );
}