// ============================================================
// AthleteOS — src/pages/ResetPasswordPage.jsx
// Affiché quand AuthContext détecte l'événement PASSWORD_RECOVERY
// (l'utilisateur vient de cliquer le lien reçu par email) — tant que
// ce nouveau mot de passe n'est pas défini, on ne route jamais vers
// le dashboard normal.
// ============================================================

import { useState } from "react";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AthleteOSBadge } from "../components/brand/AthleteOSLogo";

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [done,      setDone]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true); setError(null);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  };

  const inputCls = [
    "w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px]",
    "focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all",
  ].join(" ");
  const inputStyle = { background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--c-bg)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <AthleteOSBadge size={56} />
          <div className="text-center">
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Nouveau mot de passe</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-3)" }}>Choisis un mot de passe pour ton compte</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl shadow-sm p-6 space-y-4" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)" }}>
              <AlertCircle size={15} color="#F19A9A" className="flex-shrink-0 mt-0.5" />
              <p className="text-[13px]" style={{ color: "#F19A9A" }}>{error}</p>
            </div>
          )}

          {done ? (
            <>
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.2)" }}>
                <CheckCircle size={15} color="#4DC9A0" className="flex-shrink-0 mt-0.5" />
                <p className="text-[13px]" style={{ color: "#4DC9A0" }}>Mot de passe mis à jour. Reconnecte-toi avec le nouveau.</p>
              </div>
              <button type="button" onClick={signOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold text-white transition-all tap-feedback"
                style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}>
                Aller à la connexion
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                  <input type="password" autoComplete="new-password" placeholder="8 caractères minimum"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className={inputCls} style={inputStyle} required disabled={loading} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>Confirme-le</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                  <input type="password" autoComplete="new-password" placeholder="••••••••"
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    className={inputCls} style={inputStyle} required disabled={loading} />
                </div>
              </div>
              <button type="submit" disabled={loading || !password || !confirm}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold text-white transition-all tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Mise à jour…
                  </>
                ) : "Définir le mot de passe"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
