// ============================================================
// AthleteOS — src/utils/storage.js
// Helpers pour les fichiers en stockage privé (bucket session-pdfs).
// ============================================================

import { supabase } from "./supabaseClient";

const SIGNED_URL_TTL_SECONDS = 60;

// Ouvre un PDF de séance dans un nouvel onglet via une URL signée
// (le bucket est privé, `path` seul ne donne accès à rien). Le tab est
// ouvert de façon synchrone avant l'await pour éviter les bloqueurs de
// popup des navigateurs, puis redirigé une fois l'URL signée obtenue.
export async function openSessionPdf(path) {
  if (!path) return;
  const win = window.open("", "_blank", "noopener,noreferrer");
  const { data, error } = await supabase.storage.from("session-pdfs").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("Erreur génération URL PDF :", error);
    win?.close();
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
