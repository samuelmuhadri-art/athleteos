import { useState } from "react";
import AuthShell from "./AuthShell";
import { AuthFeedback } from "./AuthFormControls";
import { withAuthTimeout } from "../../utils/authTimeout";

export default function AuthAccessError({ message, onRetry, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const disconnect = async () => {
    setBusy(true); setError(null);
    try { await withAuthTimeout(onSignOut(), "Déconnexion trop longue.", 12000); }
    catch { setError("La déconnexion a échoué. Vérifie ta connexion puis réessaie."); }
    finally { setBusy(false); }
  };
  return <AuthShell eyebrow="Accès au club" title="Ton club n’a pas pu être chargé" description="Tes données ne sont pas modifiées. Tu peux réessayer ou revenir à la connexion.">
    <AuthFeedback>{error ?? message ?? "Impossible de retrouver ton accès au club."}</AuthFeedback>
    <button type="button" className="auth-submit" disabled={busy} onClick={onRetry}>Réessayer</button>
    {onSignOut && <button type="button" className="auth-text-action" disabled={busy} onClick={disconnect}>{busy ? "Déconnexion…" : "Revenir à la connexion"}</button>}
  </AuthShell>;
}
