import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { withAuthTimeout } from "../../utils/authTimeout";
import { AuthFeedback } from "./AuthFormControls";

export default function EmailConfirmationNotice({ email, onBack }) {
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (!remaining) return undefined;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const resend = async () => {
    if (busy || remaining) return;
    setBusy(true); setMessage(null);
    try {
      const { error } = await withAuthTimeout(supabase.auth.resend({
        type: "signup", email: email.trim(), options: { emailRedirectTo: window.location.origin },
      }), "L’envoi prend trop de temps. Réessaie dans un instant.");
      if (error) throw error;
      setMessage({ type: "success", text: "Si cette adresse correspond à un compte à confirmer, un nouveau lien a été demandé. Vérifie aussi les courriers indésirables." });
    } catch {
      setMessage({ type: "error", text: "L’envoi est indisponible ou trop rapproché. Attends une minute puis réessaie. Ton compte n’est pas supprimé." });
    } finally { setBusy(false); setRemaining(60); }
  };
  return <section className="auth-form" aria-label="Confirmation de l’adresse email">
    <AuthFeedback type="success">Vérifie ta boîte mail à l’adresse <strong>{email}</strong>. Si ton inscription a abouti, ouvre le lien de confirmation pour accéder au club.</AuthFeedback>
    <p className="text-sm">Le lien peut être ouvert sur ton téléphone ou ton ordinateur. Après confirmation, connecte-toi avec ton mot de passe. Ne recrée pas de compte si le mail tarde.</p>
    {message && <AuthFeedback type={message.type}>{message.text}</AuthFeedback>}
    <button type="button" className="btn-secondary" disabled={busy || remaining > 0} onClick={resend}>
      {busy ? "Envoi…" : remaining ? `Renvoyer dans ${remaining} s` : "Renvoyer le lien de confirmation"}
    </button>
    {onBack && <button type="button" className="auth-text-action" onClick={onBack}>Retour à la connexion</button>}
  </section>;
}
