import { useRef, useState } from "react";
import { ArrowLeft, Building2, KeyRound, Lock, Mail, User, UsersRound } from "lucide-react";
import { supabase } from "../utils/supabaseClient";
import AuthShell from "../components/auth/AuthShell";
import {
  AuthFeedback,
  AuthField,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTrustNote,
} from "../components/auth/AuthFormControls";
import { translateAuthError } from "../components/auth/authFormUtils";

const SIGNUP_MODES = Object.freeze([
  {
    id: "create_club",
    role: "Coach",
    title: "Créer mon club",
    description: "Démarre un nouvel espace et invite ensuite tes athlètes.",
    icon: Building2,
  },
  {
    id: "join_club",
    role: "Athlète",
    title: "Rejoindre mon club",
    description: "Utilise le code transmis par ton coach pour retrouver ton groupe.",
    icon: UsersRound,
  },
]);

export default function SignupPage({ onBack, initialInviteCode = "" }) {
  const normalizedInviteCode = initialInviteCode.trim().toUpperCase().slice(0, 8);
  const [mode, setMode] = useState(normalizedInviteCode ? "join_club" : "create_club");
  const [form, setForm] = useState({ name: "", email: "", password: "", clubName: "", inviteCode: normalizedInviteCode });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [honeypot, setHoneypot] = useState("");
  const formLoadedAt = useRef(Date.now());

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError(null);
  };

  const canSubmit = Boolean(
    form.name.trim()
    && form.email.trim()
    && form.password.length >= 8
    && (mode === "create_club" ? form.clubName.trim() : form.inviteCode.trim()),
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("signup", {
        body: {
          mode,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          clubName: form.clubName.trim(),
          inviteCode: form.inviteCode.trim(),
          company: honeypot,
          formLoadedAt: formLoadedAt.current,
        },
      });
      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error ?? "Une erreur est survenue.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInError) throw signInError;
    } catch (signupError) {
      let message = translateAuthError(signupError);
      if (signupError?.context?.json) {
        try {
          const body = await signupError.context.json();
          if (body?.error) message = body.error;
        } catch {
          // Le corps n'est pas du JSON : le message normalisé reste affiché.
        }
      }
      setError(message);
      setLoading(false);
    }
  };

  const footer = (
    <button type="button" onClick={onBack} className="auth-text-action subtle">
      <ArrowLeft size={15} aria-hidden="true" /> J’ai déjà un compte
    </button>
  );

  return (
    <AuthShell
      eyebrow="Premiers pas"
      title="Commence avec le bon espace"
      description="Choisis ton rôle, puis renseigne uniquement les informations nécessaires pour démarrer."
      footer={footer}
    >
      <fieldset className="auth-role-fieldset" disabled={loading}>
        <legend>Je souhaite utiliser AthleteOS comme</legend>
        <div className="auth-role-picker">
          {SIGNUP_MODES.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={["auth-role-option", selected ? "active" : ""].join(" ")}
                onClick={() => { setMode(option.id); setError(null); }}
                aria-pressed={selected}
                aria-label={`${option.role} — ${option.title}`}
              >
                <span className="auth-role-icon"><Icon size={19} aria-hidden="true" /></span>
                <span>
                  <strong>{option.role}</strong>
                  <small>{option.title}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="auth-role-description">
          {SIGNUP_MODES.find((option) => option.id === mode)?.description}
        </p>
      </fieldset>

      <form className="auth-form auth-signup-form" onSubmit={handleSubmit} noValidate>
        {error && <AuthFeedback>{error}</AuthFeedback>}

        <div className="auth-honeypot" aria-hidden="true">
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        {mode === "create_club" ? (
          <AuthField
            id="signup-club-name"
            label="Nom du club"
            icon={Building2}
            autoComplete="organization"
            placeholder="Ex. Athletic Club Namur"
            value={form.clubName}
            maxLength={100}
            onChange={(event) => setField("clubName", event.target.value)}
            disabled={loading}
            required
          />
        ) : (
          <AuthField
            id="signup-invite-code"
            label="Code d’invitation"
            icon={KeyRound}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder="Ex. A3F7K9P2"
            hint="Ce code de 8 caractères est disponible auprès de ton coach."
            value={form.inviteCode}
            maxLength={8}
            onChange={(event) => setField("inviteCode", event.target.value.toUpperCase())}
            disabled={loading}
            required
          />
        )}

        <AuthField
          id="signup-name"
          label="Prénom et nom"
          icon={User}
          autoComplete="name"
          placeholder="Prénom Nom"
          value={form.name}
          maxLength={100}
          onChange={(event) => setField("name", event.target.value)}
          disabled={loading}
          required
        />

        <AuthField
          id="signup-email"
          label="Adresse email"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="toi@exemple.be"
          value={form.email}
          maxLength={254}
          onChange={(event) => setField("email", event.target.value)}
          disabled={loading}
          required
        />

        <AuthPasswordField
          id="signup-password"
          label="Mot de passe"
          icon={Lock}
          autoComplete="new-password"
          placeholder="8 caractères minimum"
          value={form.password}
          maxLength={128}
          onChange={(event) => setField("password", event.target.value)}
          disabled={loading}
          required
          showStrength
        />

        <AuthSubmitButton loading={loading} loadingLabel="Création de l’espace…" disabled={loading || !canSubmit}>
          {mode === "create_club" ? "Créer mon club" : "Rejoindre mon club"}
        </AuthSubmitButton>

        <AuthTrustNote>
          Aucune permission de notification ou de montre ne sera demandée pendant cette inscription.
        </AuthTrustNote>
      </form>
    </AuthShell>
  );
}
