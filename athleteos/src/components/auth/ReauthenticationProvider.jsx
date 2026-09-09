import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReauthenticationContext } from "../../context/ReauthenticationContext";
import { useAuth } from "../../hooks/useAuth";
import { useModalAccessibility } from "../../hooks/useModalAccessibility";
import { supabase } from "../../utils/supabaseClient";
import { withAuthTimeout } from "../../utils/authTimeout";
import { AuthFeedback, AuthPasswordField, AuthSubmitButton } from "./AuthFormControls";
import "./auth-security.css";

export default function ReauthenticationProvider({ children }) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);
  const dialogRef = useRef(null);
  const passwordRef = useRef(null);
  const identityRef = useRef(user?.id);
  identityRef.current = user?.id;
  const cancel = useCallback(() => {
    requestRef.current?.reject(new Error("Vérification annulée. Aucune action effectuée."));
    requestRef.current = null;
    setPending(false);
    setPassword("");
  }, []);
  useEffect(() => {
    setPending(false); setPassword(""); setBusy(false); setError(null);
    return () => {
      requestRef.current?.reject(new Error("La session a changé. Reconnecte-toi."));
      requestRef.current = null;
    };
  }, [user?.id]);
  const request = useCallback(() => {
    if (!user?.id || !user?.email) return Promise.reject(new Error("Reconnecte-toi pour poursuivre."));
    if (requestRef.current) return requestRef.current.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requestRef.current = { promise, resolve, reject };
    setPassword(""); setError(null); setPending(true);
    return promise;
  }, [user?.id, user?.email]);
  useModalAccessibility({ dialogRef, initialFocusRef: passwordRef, onClose: cancel, enabled: pending, closeDisabled: busy });
  const verify = async (event) => {
    event.preventDefault();
    if (busy || !password) return;
    const expectedId = user?.id;
    setBusy(true); setError(null);
    try {
      const { data, error: authError } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email: user.email, password }),
        "La vérification prend trop de temps. Réessaie dans un instant.",
      );
      if (authError) throw new Error("Mot de passe incorrect ou vérification indisponible. Réessaie.");
      if (data.user?.id !== expectedId || identityRef.current !== expectedId) {
        throw new Error("La session a changé. Reconnecte-toi avant de poursuivre.");
      }
      requestRef.current?.resolve();
      requestRef.current = null;
      setPending(false); setPassword("");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <ReauthenticationContext.Provider value={request}>
    {children}
    {pending && createPortal(
      <div className="club-modal-backdrop" style={{ zIndex: 20000 }}>
        <section ref={dialogRef} data-reauth-dialog className="club-invite-dialog reauth-dialog" role="dialog" aria-modal="true" aria-labelledby="reauth-title" tabIndex={-1}>
          <h2 id="reauth-title">Confirme que c’est bien toi</h2>
          <p className="text-sm my-3">Cette action touche à ton compte ou à des données personnelles. Ton mot de passe n’est pas conservé par AthleteOS.</p>
          <form onSubmit={verify} className="auth-form">
            <input type="text" name="username" autoComplete="username" value={user?.email ?? ""} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
            <AuthPasswordField ref={passwordRef} id="reauth-password" label="Mot de passe actuel" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} />
            {error && <AuthFeedback>{error}</AuthFeedback>}
            <AuthSubmitButton loading={busy} disabled={busy || !password} loadingLabel="Vérification…">Confirmer et poursuivre</AuthSubmitButton>
            <button type="button" className="btn-secondary" onClick={cancel} disabled={busy}>Annuler</button>
          </form>
        </section>
      </div>, document.body,
    )}
  </ReauthenticationContext.Provider>;
}
