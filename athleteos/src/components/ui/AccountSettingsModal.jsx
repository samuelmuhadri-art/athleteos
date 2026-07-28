// ============================================================
// AthleteOS — src/components/ui/AccountSettingsModal.jsx
// Réglages de compte partagés coach + athlète : nom, email, mot de
// passe pour tout le monde ; nom du club + code d'invitation réservés
// au HEAD COACH (tâche 4 — un simple coach ne doit plus voir ces
// actions structurelles). Les actions sensibles (renommer le club,
// régénérer le code) passent par l'Edge Function admin-actions
// (service role, revérifie le rôle côté serveur — cet écran ne fait que
// masquer l'UI, la sécurité réelle est côté serveur).
// ============================================================

import { useState, useEffect } from "react";
import { X, User, Mail, Lock, Building2, RefreshCw, Copy, Check, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthContext";

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all";
const inputStyle = { background: "var(--c-surface-2)", borderColor: "var(--c-border-strong)", color: "var(--c-text-1)" };

export default function AccountSettingsModal({ onClose }) {
  const { user, profile, clubId } = useAuth();
  const isHeadCoach = profile?.role === "head_coach";

  const [name, setName]   = useState(profile?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");

  const [clubName, setClubName]     = useState("");
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied]         = useState(false);

  const [msg, setMsg] = useState(null); // { type: "error"|"success", text }
  const [busy, setBusy] = useState(null); // clé de l'action en cours

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("name, invite_code").eq("id", clubId).single()
      .then(({ data }) => { if (data) { setClubName(data.name ?? ""); setInviteCode(data.invite_code ?? null); } });
  }, [clubId]);

  const callAdmin = async (payload) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body: payload });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? "Une erreur est survenue.");
    return data;
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setBusy("name"); setMsg(null);
    try {
      await callAdmin({ action: "update_profile", name: name.trim() });
      setMsg({ type: "success", text: "Nom mis à jour." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    setBusy(null);
  };

  const saveEmail = async () => {
    if (!email.trim() || email.trim() === user?.email) return;
    setBusy("email"); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      await supabase.from("users").update({ email: email.trim() }).eq("id", profile.id);
      setMsg({ type: "success", text: "Vérifie ta boîte mail pour confirmer le changement d'adresse." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    setBusy(null);
  };

  const savePassword = async () => {
    if (password.length < 8) { setMsg({ type: "error", text: "Le mot de passe doit faire au moins 8 caractères." }); return; }
    setBusy("password"); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setMsg({ type: "success", text: "Mot de passe mis à jour." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    setBusy(null);
  };

  const saveClubName = async () => {
    if (!clubName.trim()) return;
    setBusy("club"); setMsg(null);
    try {
      // Clé d'idempotence : un double-clic ou un retry réseau sur ce
      // même clic ne renomme pas le club une seconde fois côté serveur.
      await callAdmin({ action: "rename_club", clubName: clubName.trim(), idempotencyKey: crypto.randomUUID() });
      setMsg({ type: "success", text: "Nom du club mis à jour." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    setBusy(null);
  };

  const regenerateCode = async () => {
    setBusy("code"); setMsg(null);
    try {
      const data = await callAdmin({ action: "regenerate_invite_code", idempotencyKey: crypto.randomUUID() });
      setInviteCode(data.inviteCode);
      setMsg({ type: "success", text: "Nouveau code généré — l'ancien ne fonctionne plus." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    setBusy(null);
  };

  const copyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard?.writeText(inviteCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col modal-content overflow-hidden"
        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>

        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <h3 className="text-[15px] font-bold" style={{ color: "var(--c-text-1)" }}>Réglages du compte</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--c-surface-3)] transition-colors">
            <X size={16} style={{ color: "var(--c-text-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {msg && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
              style={msg.type === "error"
                ? { background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)" }
                : { background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.2)" }}>
              {msg.type === "error"
                ? <AlertCircle size={15} color="#F19A9A" className="flex-shrink-0 mt-0.5" />
                : <CheckCircle size={15} color="#4DC9A0" className="flex-shrink-0 mt-0.5" />}
              <p className="text-[13px]" style={{ color: msg.type === "error" ? "#F19A9A" : "#4DC9A0" }}>{msg.text}</p>
            </div>
          )}

          <Field label="Ton nom">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <button onClick={saveName} disabled={busy === "name" || !name.trim() || name.trim() === profile?.name}
                className="btn-secondary !px-4 disabled:opacity-40">
                {busy === "name" ? "…" : "Enregistrer"}
              </button>
            </div>
          </Field>

          <Field label="Email">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <button onClick={saveEmail} disabled={busy === "email" || !email.trim() || email.trim() === user?.email}
                className="btn-secondary !px-4 disabled:opacity-40">
                {busy === "email" ? "…" : "Changer"}
              </button>
            </div>
          </Field>

          <Field label="Nouveau mot de passe">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input type="password" placeholder="8 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <button onClick={savePassword} disabled={busy === "password" || !password}
                className="btn-secondary !px-4 disabled:opacity-40">
                {busy === "password" ? "…" : "Changer"}
              </button>
            </div>
          </Field>

          {isHeadCoach && (
            <>
              <div className="pt-1" style={{ borderTop: "1px solid var(--c-border)" }} />
              <Field label="Nom du club">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                    <input value={clubName} onChange={e => setClubName(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <button onClick={saveClubName} disabled={busy === "club" || !clubName.trim()}
                    className="btn-secondary !px-4 disabled:opacity-40">
                    {busy === "club" ? "…" : "Enregistrer"}
                  </button>
                </div>
              </Field>

              <Field label="Code d'invitation">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl px-4 py-2.5 text-center" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
                    <span className="text-[16px] font-bold" style={{ color: "var(--c-text-1)", letterSpacing: "0.1em" }}>{inviteCode ?? "…"}</span>
                  </div>
                  <button onClick={copyCode} className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-all tap-feedback"
                    style={{ background: copied ? "rgba(29,158,117,0.15)" : "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
                    {copied ? <Check size={14} color="#1D9E75" /> : <Copy size={13} style={{ color: "var(--c-text-2)" }} />}
                  </button>
                  <button onClick={regenerateCode} disabled={busy === "code"}
                    className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-all tap-feedback disabled:opacity-40"
                    style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }} title="Générer un nouveau code">
                    <RefreshCw size={13} style={{ color: "var(--c-text-2)" }} className={busy === "code" ? "animate-spin" : ""} />
                  </button>
                </div>
                <p className="text-[10.5px]" style={{ color: "var(--c-text-4)" }}>Régénérer invalide l'ancien code immédiatement.</p>
              </Field>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
