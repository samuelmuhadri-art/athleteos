import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { getPasswordStrength } from "./authFormUtils";

export function AuthField({
  id,
  label,
  icon: Icon,
  hint,
  error,
  className = "",
  endAdornment = null,
  ...inputProps
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["auth-field", className].join(" ")}>
      <label htmlFor={id}>{label}</label>
      <div className={["auth-input-wrap", error ? "has-error" : ""].join(" ")}>
        {Icon && <Icon className="auth-input-icon" size={18} aria-hidden="true" />}
        <input
          id={id}
          className="auth-input"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {endAdornment}
      </div>
      {error ? (
        <p id={`${id}-error`} className="auth-field-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="auth-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function AuthPasswordField({ id, label, showStrength = false, value = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <AuthField
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        endAdornment={(
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
        {...props}
      />
      {showStrength && <PasswordStrength password={value} />}
    </>
  );
}

export function PasswordStrength({ password }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength-track" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span key={level} className={level <= strength.score ? strength.tone : ""} />
        ))}
      </div>
      <div className="password-strength-copy">
        <span>{strength.label}</span>
        <span>{password.length < 8 ? `${8 - password.length} caractère${8 - password.length > 1 ? "s" : ""} restant${8 - password.length > 1 ? "s" : ""}` : "Longueur suffisante"}</span>
      </div>
    </div>
  );
}

export function AuthFeedback({ type = "error", children, id }) {
  const isError = type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      id={id}
      className={["auth-feedback", isError ? "error" : "success"].join(" ")}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <Icon size={18} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

export function AuthSubmitButton({ loading, loadingLabel, children, ...buttonProps }) {
  return (
    <button type="submit" className="auth-submit tap-feedback" aria-busy={loading} {...buttonProps}>
      {loading ? (
        <>
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : children}
    </button>
  );
}

export function AuthTrustNote({ children }) {
  return (
    <div className="auth-trust-note">
      <ShieldCheck size={17} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
