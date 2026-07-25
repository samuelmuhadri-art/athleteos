// ============================================================
// AthleteOS — src/pages/SignupPage.jsx
// Inscription en libre-service, deux parcours :
//   - "create_club" : un coach crée son propre club (nouvel univers vide)
//   - "join_club"   : un athlète rejoint un club existant via son code
// La création réelle (auth user + club + users + athletes) se fait
// côté serveur (Edge Function "signup", clé service role) — jamais
// directement depuis le client via les tables protégées par RLS.
// ============================================================

import { useState } from "react";
import { Zap, Mail, Lock, User, Building2, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "../utils/supabaseClient";

export default function SignupPage({ onBack }) {
  const [mode, setMode] = useState("create_club"); // "create_club" | "join_club"
  const [form, setForm] = useState({ name: "", email: "", password: "", clubName: "", inviteCode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 8 &&
    (mode === "create_club" ? form.clubName.trim() : form.inviteCode.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("signup", {
        body: {
          mode,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          clubName: form.clubName.trim(),
          inviteCode: form.inviteCode.trim(),
        },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error ?? "Une erreur est survenue.");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(), password: form.password,
      });
      if (signInErr) throw signInErr;
      // AuthContext prend le relais tout seul (onAuthStateChange) et route
      // automatiquement vers l'espace coach ou athlète selon le rôle.
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.");
      setLoading(false);
    }
  };

  const inputCls = [
    "w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px]",
    "focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all",
  ].join(" ");
  const inputStyle = { background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" };
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider mb-1.5";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--c-bg)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
          >
            <Zap size={24} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>AthleteOS</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-3)" }}>Crée ton espace en 30 secondes</p>
          </div>
        </div>

        {/* ── Toggle mode ──────────────────────────────────────────────── */}
        <div className="flex rounded-xl p-1 mb-4" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
          {[
            { id: "create_club", label: "Je crée mon club" },
            { id: "join_club",   label: "J'ai un code d'invitation" },
          ].map(m => (
            <button key={m.id} type="button" onClick={() => { setMode(m.id); setError(null); }}
              className="flex-1 py-2 rounded-lg text-[12.5px] font-semibold transition-all tap-feedback"
              style={mode === m.id
                ? { background: "#1D9E75", color: "white" }
                : { background: "transparent", color: "var(--c-text-3)" }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Formulaire ───────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl shadow-sm p-6 space-y-4"
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
        >
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)" }}>
              <AlertCircle size={15} color="#F19A9A" className="flex-shrink-0 mt-0.5" />
              <p className="text-[13px]" style={{ color: "#F19A9A" }}>{error}</p>
            </div>
          )}

          {mode === "create_club" ? (
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Nom du club</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input placeholder="Ex: Athletic Club Namur" value={form.clubName}
                  onChange={e => set("clubName", e.target.value)}
                  className={inputCls} style={inputStyle} disabled={loading} required />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Code d'invitation</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input placeholder="Ex: A3F7K9P2" value={form.inviteCode}
                  onChange={e => set("inviteCode", e.target.value.toUpperCase())}
                  className={inputCls} style={{ ...inputStyle, letterSpacing: "0.08em", fontWeight: 600 }} disabled={loading} required />
              </div>
              <p className="text-[10.5px]" style={{ color: "var(--c-text-4)" }}>Demande ce code à ton coach.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Ton nom</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
              <input placeholder="Prénom Nom" value={form.name}
                onChange={e => set("name", e.target.value)}
                className={inputCls} style={inputStyle} disabled={loading} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
              <input type="email" autoComplete="email" placeholder="toi@exemple.be" value={form.email}
                onChange={e => set("email", e.target.value)}
                className={inputCls} style={inputStyle} disabled={loading} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Mot de passe</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
              <input type="password" autoComplete="new-password" placeholder="8 caractères minimum" value={form.password}
                onChange={e => set("password", e.target.value)}
                className={inputCls} style={inputStyle} disabled={loading} required />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
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
                Création…
              </>
            ) : mode === "create_club" ? "Créer mon club" : "Rejoindre le club"}
          </button>
        </form>

        <button onClick={onBack} className="flex items-center gap-1.5 justify-center w-full mt-6 text-[12px] tap-feedback"
          style={{ color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={13} /> J'ai déjà un compte
        </button>
      </div>
    </div>
  );
}
