// ============================================================
// AthleteOS — src/hooks/usePushNotifications.js
//
// Hook React pour gérer l'abonnement Web Push.
// Usage dans AthleteApp.jsx :
//
//   import { usePushNotifications } from "./hooks/usePushNotifications";
//   const { subscribed, subscribe, permissionState } = usePushNotifications(profile?.id, clubId);
//
// Afficher le bouton d'activation :
//   <PushToggleButton subscribed={subscribed} onToggle={subscribe} />
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

// ── Clé publique VAPID (à mettre dans .env) ──────────────────
// Générer avec : npx web-push generate-vapid-keys
// Ajouter dans .env : VITE_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ── Convertit la clé VAPID base64 → Uint8Array ───────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

// ── Hook principal ────────────────────────────────────────────
export function usePushNotifications(athleteId, clubId) {
  const [subscribed,       setSubscribed]       = useState(false);
  const [permissionState,  setPermissionState]  = useState("default"); // "default" | "granted" | "denied"
  const [swReady,          setSwReady]          = useState(false);
  const [registration,     setRegistration]     = useState(null);

  // ── Enregistrement du Service Worker ─────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        setSwReady(true);
        setPermissionState(Notification.permission);
        // Vérifier si déjà souscrit
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setSubscribed(!!sub);
      })
      .catch(console.error);
  }, []);

  // ── Abonnement / désabonnement ───────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReady || !registration || !VAPID_PUBLIC_KEY) {
      console.warn("Push : SW non prêt ou clé VAPID manquante");
      return;
    }

    try {
      // Demander la permission si nécessaire
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== "granted") return;

      // Vérifier si déjà souscrit
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        // Déjà souscrit → désabonner
        await existingSub.unsubscribe();
        await supabase.from("push_subscriptions")
          .delete()
          .eq("athlete_id", athleteId)
          .eq("endpoint", existingSub.endpoint);
        setSubscribed(false);
        return;
      }

      // Créer l'abonnement
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();

      // Sauvegarder en BDD (table push_subscriptions à créer, voir SQL en bas)
      const { error } = await supabase.from("push_subscriptions").upsert({
        athlete_id: athleteId,
        club_id:    clubId,
        endpoint:   subJson.endpoint,
        p256dh:     subJson.keys?.p256dh,
        auth:       subJson.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: "athlete_id,endpoint" });

      if (error) throw error;
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription error:", err);
    }
  }, [swReady, registration, athleteId, clubId]);

  return { subscribed, subscribe, permissionState, swReady };
}

// ── Composant bouton toggle ───────────────────────────────────
export function PushToggleButton({ subscribed, onToggle, permissionState }) {
  const isBlocked = permissionState === "denied";
  const noSupport = !("serviceWorker" in navigator) || !("PushManager" in window);

  if (noSupport) return null; // iOS Safari < 16.4 : pas supporté

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
      title={isBlocked ? "Notifications bloquées dans les paramètres du navigateur" : undefined}
    >
      <span>{subscribed ? "🔔" : isBlocked ? "🔕" : "🔔"}</span>
      <span>{subscribed ? "Notifs actives" : isBlocked ? "Bloquées" : "Activer les notifs"}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// SQL À EXÉCUTER DANS SUPABASE — Console SQL
// ════════════════════════════════════════════════════════════════
/*
-- Table des abonnements push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  athlete_id  INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  club_id     INT NOT NULL,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT,
  auth        TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (athlete_id, endpoint)
);

-- Index pour récupérer les subs d'un athlète
CREATE INDEX IF NOT EXISTS idx_push_subs_athlete ON push_subscriptions(athlete_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete can manage own push subs"
  ON push_subscriptions FOR ALL
  USING (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "coach can read push subs of club"
  ON push_subscriptions FOR SELECT
  USING (club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1));
*/

// ════════════════════════════════════════════════════════════════
// SUPABASE EDGE FUNCTION — supabase/functions/send-push/index.ts
// Cette fonction est appelée depuis notifications.js pour envoyer
// une vraie notification push système sur le téléphone.
// ════════════════════════════════════════════════════════════════
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

serve(async (req) => {
  const { athleteIds, title, body, url, tag } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  webpush.setVapidDetails(
    "mailto:contact@athleteos.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );

  // Récupérer les subs des athlètes ciblés
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("athlete_id", athleteIds);

  const payload = JSON.stringify({ title, body, url: url ?? "/", tag });

  const results = await Promise.allSettled(
    (subs ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
*/