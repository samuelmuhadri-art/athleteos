import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import {
  AuthFeedback,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTrustNote,
} from "../components/auth/AuthFormControls";
import { translateAuthError } from "../components/auth/authFormUtils";

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const passwordsMatch = Boolean(confirm) && password === confirm;
  const confirmError = confirm && password !== confirm ? "Les deux mots de passe ne correspondent pas." : null;
  const canSubmit = password.length >= 8 && passwordsMatch;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || loading) {
      if (password.length < 8) setError("Le mot de passe doit contenir au moins 8 caractères.");
      else if (!passwordsMatch) setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await updatePassword(password);
      setLoading(false);
      if (updateError) {
        setError(translateAuthError(updateError, "Le mot de passe n’a pas pu être mis à jour."));
        return;
      }
      setDone(true);
    } catch (updateError) {
      setLoading(false);
      setError(translateAuthError(updateError, "Le mot de passe n’a pas pu être mis à jour."));
    }
  };

  return (
    <AuthShell
      eyebrow="Sécurité du compte"
      title={done ? "Ton mot de passe est prêt" : "Choisis un nouveau mot de passe"}
      description={done
        ? "La modification est enregistrée. Reconnecte-toi maintenant avec ton nouveau mot de passe."
        : "Utilise au moins 8 caractères. Une phrase courte et unique est plus facile à retenir."}
    >
      {done ? (
        <div className="auth-form">
          <AuthFeedback type="success">Ton mot de passe a bien été mis à jour.</AuthFeedback>
          <button type="button" onClick={signOut} className="auth-submit tap-feedback">
            Aller à la connexion
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <AuthFeedback>{error}</AuthFeedback>}

          <AuthPasswordField
            id="new-password"
            label="Nouveau mot de passe"
            icon={Lock}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            disabled={loading}
            required
            showStrength
          />

          <AuthPasswordField
            id="confirm-password"
            label="Confirmer le mot de passe"
            icon={Lock}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              if (error) setError(null);
            }}
            error={confirmError}
            disabled={loading}
            required
          />

          <AuthSubmitButton loading={loading} loadingLabel="Mise à jour…" disabled={loading || !canSubmit}>
            Définir le nouveau mot de passe
          </AuthSubmitButton>

          <AuthTrustNote>
            Après la modification, les autres sessions pourront demander une nouvelle connexion.
          </AuthTrustNote>
        </form>
      )}
    </AuthShell>
  );
}
