import { useState } from "react";
import { ArrowLeft, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import {
  AuthFeedback,
  AuthField,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTrustNote,
} from "../components/auth/AuthFormControls";
import { translateAuthError } from "../components/auth/authFormUtils";

export default function LoginPage({ onSignupClick }) {
  const { signIn, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resetSent, setResetSent] = useState(false);

  const updateEmail = (value) => {
    setEmail(value);
    if (error) setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) {
        setError(translateAuthError(authError));
        setLoading(false);
      }
    } catch (authError) {
      setError(translateAuthError(authError));
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await sendPasswordReset(email.trim());
      setLoading(false);
      if (resetError) {
        setError(translateAuthError(resetError, "Le lien n’a pas pu être envoyé. Réessaie dans un instant."));
        return;
      }
      setResetSent(true);
    } catch (resetError) {
      setLoading(false);
      setError(translateAuthError(resetError, "Le lien n’a pas pu être envoyé. Réessaie dans un instant."));
    }
  };

  const returnToLogin = () => {
    setMode("login");
    setError(null);
    setResetSent(false);
  };

  const footer = mode === "login" && onSignupClick ? (
    <button type="button" onClick={onSignupClick} className="auth-text-action">
      Pas encore de compte ? Créer ou rejoindre un club
    </button>
  ) : null;

  return (
    <AuthShell
      eyebrow={mode === "forgot" ? "Récupération" : "Bon retour"}
      title={mode === "forgot" ? "Retrouve l’accès à ton compte" : "Connecte-toi à ton espace"}
      description={mode === "forgot"
        ? "Indique ton email. Nous t’enverrons un lien pour choisir un nouveau mot de passe."
        : "Retrouve ton planning, ton groupe et les actions qui comptent aujourd’hui."}
      footer={footer}
    >
      {mode === "forgot" ? (
        <form className="auth-form" onSubmit={handleForgotSubmit} noValidate>
          {error && <AuthFeedback>{error}</AuthFeedback>}
          {resetSent ? (
            <>
              <AuthFeedback type="success">
                Email envoyé à <strong>{email}</strong>. Ouvre le lien reçu pour choisir ton nouveau mot de passe.
              </AuthFeedback>
              <button type="button" onClick={returnToLogin} className="auth-submit tap-feedback">
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
              <AuthField
                id="reset-email"
                label="Adresse email"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="coach@club.be"
                value={email}
                onChange={(event) => updateEmail(event.target.value)}
                disabled={loading}
                required
              />
              <AuthSubmitButton loading={loading} loadingLabel="Envoi du lien…" disabled={loading || !email.trim()}>
                Envoyer le lien de réinitialisation
              </AuthSubmitButton>
              <button type="button" onClick={returnToLogin} className="auth-text-action subtle">
                <ArrowLeft size={15} aria-hidden="true" /> Retour à la connexion
              </button>
            </>
          )}
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <AuthFeedback>{error}</AuthFeedback>}

          <AuthField
            id="login-email"
            label="Adresse email"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="coach@club.be"
            value={email}
            onChange={(event) => updateEmail(event.target.value)}
            disabled={loading}
            required
          />

          <div>
            <AuthPasswordField
              id="login-password"
              label="Mot de passe"
              icon={Lock}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); }}
              className="auth-text-action auth-forgot-link"
            >
              Mot de passe oublié ?
            </button>
          </div>

          <AuthSubmitButton
            loading={loading}
            loadingLabel="Connexion…"
            disabled={loading || !email.trim() || !password}
          >
            Se connecter
          </AuthSubmitButton>

          <AuthTrustNote>
            Tu seras automatiquement dirigé vers ton espace coach ou athlète.
          </AuthTrustNote>
        </form>
      )}
    </AuthShell>
  );
}
