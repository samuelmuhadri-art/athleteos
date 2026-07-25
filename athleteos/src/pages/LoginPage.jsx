// ============================================================
// AthleteOS — src/pages/LoginPage.jsx  ★ DARK MODE
// ============================================================

import { useState } from "react";
import { Zap, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ onSignupClick }) {
  const { signIn, sendPasswordReset } = useAuth();

  const [mode,     setMode]     = useState("login"); // "login" | "forgot"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      const msg =
        authError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : authError.message === "Email not confirmed"
          ? "Confirme ton adresse email avant de te connecter."
          : authError.message;
      setError(msg);
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: resetError } = await sendPasswordReset(email.trim());
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setResetSent(true);
  };

  const inputCls = [
    "w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px]",
    "focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all",
  ].join(" ");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--c-bg)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
          >
            <Zap size={24} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>AthleteOS</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
              {mode === "forgot" ? "Récupère l'accès à ton compte" : "Connecte-toi pour accéder à ton espace"}
            </p>
          </div>
        </div>

        {/* ── Mot de passe oublié ──────────────────────────────────────── */}
        {mode === "forgot" ? (
          <form
            onSubmit={handleForgotSubmit}
            className="rounded-2xl shadow-sm p-6 space-y-4"
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
          >
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)" }}>
                <AlertCircle size={15} color="#F19A9A" className="flex-shrink-0 mt-0.5" />
                <p className="text-[13px]" style={{ color: "#F19A9A" }}>{error}</p>
              </div>
            )}
            {resetSent ? (
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.2)" }}>
                <CheckCircle size={15} color="#4DC9A0" className="flex-shrink-0 mt-0.5" />
                <p className="text-[13px]" style={{ color: "#4DC9A0" }}>
                  Email envoyé à {email} — clique sur le lien qu'il contient pour choisir un nouveau mot de passe.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                    <input
                      type="email" autoComplete="email" placeholder="coach@club.be"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" }}
                      required disabled={loading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold text-white transition-all tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Envoi…
                    </>
                  ) : "Envoyer le lien de réinitialisation"}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setMode("login"); setError(null); setResetSent(false); }}
              className="block text-center text-[12px] w-full tap-feedback" style={{ color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer" }}>
              ← Retour à la connexion
            </button>
          </form>
        ) : (
        <>
        {/* ── Formulaire ───────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl shadow-sm p-6 space-y-4"
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
        >
          {/* Erreur auth */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)" }}>
              <AlertCircle size={15} color="#F19A9A" className="flex-shrink-0 mt-0.5" />
              <p className="text-[13px]" style={{ color: "#F19A9A" }}>{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
              <input
                type="email"
                autoComplete="email"
                placeholder="coach@club.be"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" }}
                required
                disabled={loading}
              />
            </div>
            <button type="button" onClick={() => { setMode("forgot"); setError(null); }}
              className="block text-[11.5px] tap-feedback" style={{ color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer" }}>
              Mot de passe oublié ?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg",
              "text-[14px] font-semibold text-white transition-all tap-feedback",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
            style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        {onSignupClick ? (
          <button onClick={onSignupClick} className="block text-center text-[12px] mt-6 mx-auto tap-feedback"
            style={{ color: "var(--c-accent)", background: "none", border: "none", cursor: "pointer" }}>
            Pas encore de compte ? Créer mon club ou rejoindre avec un code →
          </button>
        ) : (
          <p className="text-center text-[11px] mt-6" style={{ color: "var(--c-text-4)" }}>
            Accès réservé aux membres — contacte ton coach ou ton club pour un compte.
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}