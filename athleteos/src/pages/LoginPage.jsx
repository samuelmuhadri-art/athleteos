// ============================================================
// AthleteOS — src/pages/LoginPage.jsx
//
// Page de connexion email + mot de passe.
// Utilise supabase.auth.signInWithPassword() via useAuth().signIn().
// Après connexion réussie, AuthContext met à jour `user` → App.jsx
// rend l'application à la place de cette page (pas de react-router).
// ============================================================

import { useState } from "react";
import { Zap, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      // Messages d'erreur lisibles en français
      const msg =
        authError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : authError.message === "Email not confirmed"
          ? "Confirme ton adresse email avant de te connecter."
          : authError.message;
      setError(msg);
      setLoading(false);
      // En cas de succès, loading reste true : AuthContext va changer
      // `user`, App.jsx va unmount cette page, donc inutile de setLoading(false).
    }
  };

  const inputCls = [
    "w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] text-slate-700",
    "border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400",
    "placeholder:text-slate-300 transition-all",
  ].join(" ");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#F5F5F2", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
          >
            <Zap size={22} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">AthleteOS</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Connecte-toi pour accéder à ton espace</p>
          </div>
        </div>

        {/* ── Formulaire ───────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4"
        >
          {/* Erreur auth */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-3">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="email"
                autoComplete="email"
                placeholder="coach@club.be"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg",
              "text-[14px] font-semibold text-white transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
            style={{ background: "#1D9E75" }}
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

        {/* ── Note bas de page ──────────────────────────────────────────── */}
        <p className="text-center text-[11px] text-slate-300 mt-5">
          Accès réservé aux coachs — contacte l'administrateur pour un compte
        </p>
      </div>
    </div>
  );
}