import { useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";

// Les filtres évitent les événements inutiles ; la confidentialité reste assurée par la RLS serveur.
export function useMessageRealtime({ userId, onMessage, onCatchUp }) {
  const callbacks = useRef({ onMessage, onCatchUp });
  useEffect(() => { callbacks.current = { onMessage, onCatchUp }; }, [onMessage, onCatchUp]);
  useEffect(() => {
    if (!userId) return undefined;
    let disposed = false;
    const receive = payload => {
      const row = payload.new;
      if (disposed || !row?.id || (row.sender_id !== userId && row.receiver_id !== userId)) return;
      callbacks.current.onMessage?.(row, payload.eventType);
    };
    const catchUp = () => {
      if (!disposed && document.visibilityState !== "hidden") callbacks.current.onCatchUp?.();
    };
    const channel = supabase.channel(`coach-messaging-${userId}`);
    for (const event of ["INSERT", "UPDATE"]) {
      for (const field of ["sender_id", "receiver_id"]) {
        channel.on("postgres_changes", { event, schema: "public", table: "messages", filter: `${field}=eq.${userId}` }, receive);
      }
    }
    channel.on("system", {}, payload => {
      if (payload.extension === "postgres_changes" && payload.status === "ok") catchUp();
    });
    channel.subscribe(status => { if (status === "SUBSCRIBED") catchUp(); });
    // Rattrapage après retour sur l'onglet, y compris après une coupure réseau.
    window.addEventListener("focus", catchUp);
    window.addEventListener("online", catchUp);
    return () => {
      disposed = true;
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("online", catchUp);
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
