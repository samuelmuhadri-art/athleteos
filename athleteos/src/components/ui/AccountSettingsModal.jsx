import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Lock,
  Mail,
  Image as ImageIcon,
  MonitorDown,
  Palette,
  RefreshCw,
  Settings,
  LogOut,
  Upload,
  User,
  X,
} from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import {
  AuthFeedback,
  AuthField,
  AuthPasswordField,
} from "../auth/AuthFormControls";
import { translateAuthError } from "../auth/authFormUtils";
import { loadClubBranding } from "../../hooks/useClubBranding";
import { CLUB_ACCENT_PRESETS, DEFAULT_CLUB_ACCENT } from "../../utils/clubBranding";
import ClubInvitationCenter from "../club/ClubInvitationCenter";
import PwaAccessCard from "../pwa/PwaAccess";
import { ConfirmDialog } from "./premium";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const BRAND_IMAGE_TYPES = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
});

function readableAdminError(value, fallback = "Une erreur est survenue. Réessaie dans un instant.") {
  const candidates = value && typeof value === "object"
    ? [value.message, value.error, value.details, value.error_description]
    : [value];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && candidate !== "[object Object]") return candidate;
    if (candidate && typeof candidate === "object" && typeof candidate.message === "string"
      && candidate.message.trim() && candidate.message !== "[object Object]") return candidate.message;
  }
  return fallback;
}
const MAX_BRAND_IMAGE_SIZE = 5 * 1024 * 1024;

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = [];
  const chunkSize = 32_768;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function SettingsSectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="settings-section-header">
      <span><Icon size={18} aria-hidden="true" /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ActionRow({ children, action }) {
  return (
    <div className="settings-action-row">
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}

export default function AccountSettingsModal({ onClose, initialSection = "account", onClubUpdated }) {
  const { user, profile, clubId, signOut } = useAuth();
  const isHeadCoach = profile?.role === "head_coach";
  const initialActiveSection = initialSection === "application"
    ? "application"
    : initialSection === "club" && isHeadCoach ? "club" : "account";
  const [activeSection, setActiveSection] = useState(initialActiveSection);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [logoPath, setLogoPath] = useState(null);
  const [coverPath, setCoverPath] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [accentColor, setAccentColor] = useState(DEFAULT_CLUB_ACCENT);
  const [savedAccentColor, setSavedAccentColor] = useState(DEFAULT_CLUB_ACCENT);
  const [clubLoading, setClubLoading] = useState(Boolean(clubId));
  const [copied, setCopied] = useState(false);
  const [confirmRegeneration, setConfirmRegeneration] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(null);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(typeof document !== "undefined" ? document.activeElement : null);

  const requestClose = () => {
    if (!busy) onClose();
  };

  useEffect(() => {
    if (!clubId) {
      setClubLoading(false);
      return;
    }

    let active = true;
    setClubLoading(true);
    loadClubBranding(supabase, clubId)
      .then((data) => {
        if (!active) return;
        setClubName(data.name ?? "");
        setInviteCode(data.inviteCode ?? null);
        setInviteStatus(data.inviteStatus ?? null);
        setLogoPath(data.logoPath ?? null);
        setCoverPath(data.coverPath ?? null);
        setLogoPreview(data.logoUrl ?? null);
        setCoverPreview(data.coverUrl ?? null);
        setAccentColor(data.accentColor);
        setSavedAccentColor(data.accentColor);
      })
      .catch(() => {
        if (active) setMessage({ type: "error", text: "Les informations du club n’ont pas pu être chargées." });
      })
      .finally(() => { if (active) setClubLoading(false); });
    return () => { active = false; };
  }, [clubId]);

  useEffect(() => () => {
    if (logoPreview?.startsWith("blob:")) globalThis.URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => () => {
    if (coverPreview?.startsWith("blob:")) globalThis.URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    const previousFocus = restoreFocusRef.current;
    return () => previousFocus?.focus?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const callAdmin = useCallback(async (payload) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body: payload });
    if (error) {
      if (error.context?.json) {
        try {
          const body = await error.context.json();
          if (body?.error) throw new Error(readableAdminError(body.error));
        } catch (contextError) {
          if (contextError instanceof Error && contextError.message !== "Unexpected end of JSON input") throw contextError;
        }
      }
      throw new Error(readableAdminError(error));
    }
    if (!data?.success) throw new Error(readableAdminError(data?.error));
    return data;
  }, []);

  const runAction = async (key, action, successText) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ type: "success", text: successText });
    } catch (actionError) {
      setMessage({ type: "error", text: translateAuthError(actionError) });
    } finally {
      setBusy(null);
    }
  };

  const saveName = () => {
    if (!name.trim()) return;
    runAction(
      "name",
      () => callAdmin({ action: "update_profile", name: name.trim() }),
      "Ton nom a bien été mis à jour.",
    );
  };

  const saveEmail = () => {
    if (!email.trim() || email.trim() === user?.email) return;
    runAction("email", async () => {
      const normalizedEmail = email.trim();
      const { error } = await supabase.auth.updateUser({ email: normalizedEmail });
      if (error) throw error;
      await supabase.from("users").update({ email: normalizedEmail }).eq("id", profile.id);
    }, "Vérifie ta boîte mail pour confirmer la nouvelle adresse.");
  };

  const savePassword = () => {
    if (password.length < 8) {
      setMessage({ type: "error", text: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    runAction("password", async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
    }, "Ton mot de passe a bien été mis à jour.");
  };

  const saveClubName = () => {
    if (!clubName.trim()) return;
    runAction(
      "club",
      async () => {
        await callAdmin({
          action: "rename_club",
          clubName: clubName.trim(),
          idempotencyKey: crypto.randomUUID(),
        });
        await onClubUpdated?.();
      },
      "Le nom du club a bien été mis à jour.",
    );
  };

  const selectBrandImage = (kind, file) => {
    if (!file) return;
    if (!BRAND_IMAGE_TYPES[file.type]) {
      setMessage({ type: "error", text: "Utilise une image PNG, JPEG ou WebP." });
      return;
    }
    if (file.size > MAX_BRAND_IMAGE_SIZE) {
      setMessage({ type: "error", text: "L’image doit peser moins de 5 Mo." });
      return;
    }
    const preview = globalThis.URL.createObjectURL(file);
    setMessage(null);
    if (kind === "logo") {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setCoverFile(file);
      setCoverPreview(preview);
    }
  };

  const uploadBrandImage = async (kind, file) => {
    const data = await callAdmin({
      action: "upload_club_branding",
      kind,
      contentType: file.type,
      fileBase64: await fileToBase64(file),
    });
    if (!data.path) throw new Error("L’image n’a pas pu être enregistrée.");
    return data.path;
  };

  const saveClubBranding = () => {
    const dirty = logoFile || coverFile || accentColor !== savedAccentColor;
    if (!dirty) return;
    runAction("branding", async () => {
      const nextLogoPath = logoFile ? await uploadBrandImage("logo", logoFile) : logoPath;
      const nextCoverPath = coverFile ? await uploadBrandImage("cover", coverFile) : coverPath;

      await callAdmin({
        action: "update_club_branding",
        logoPath: nextLogoPath,
        coverPath: nextCoverPath,
        accentColor,
        idempotencyKey: crypto.randomUUID(),
      });
      setLogoPath(nextLogoPath);
      setCoverPath(nextCoverPath);
      setSavedAccentColor(accentColor);
      setLogoFile(null);
      setCoverFile(null);
      await onClubUpdated?.();
    }, "L’identité visuelle du club a bien été mise à jour.");
  };

  const regenerateCode = () => {
    runAction("code", async () => {
      const data = await callAdmin({
        action: "regenerate_invite_code",
        idempotencyKey: crypto.randomUUID(),
      });
      setInviteCode(data.inviteCode);
      setInviteStatus({ active: true, useCount: 0, lastUsedAt: null, expiresAt: null, createdAt: new Date().toISOString() });
      setConfirmRegeneration(false);
    }, "Nouveau code généré. L’ancien code ne fonctionne plus.");
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ type: "error", text: "Le code n’a pas pu être copié. Sélectionne-le manuellement." });
    }
  };

  const switchSection = (section) => {
    setActiveSection(section);
    setMessage(null);
    setConfirmRegeneration(false);
  };

  const handleSignOut = async () => {
    setBusy("signout");
    setMessage(null);
    try {
      await signOut();
      setConfirmSignOut(false);
      onClose();
    } catch (signOutError) {
      setMessage({ type: "error", text: translateAuthError(signOutError) });
      setBusy(null);
    }
  };

  return (
    <div
      className="account-settings-backdrop modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <section
        ref={dialogRef}
        className="account-settings-dialog modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        aria-describedby="account-settings-description"
        aria-busy={Boolean(busy)}
      >
        <header className="account-settings-header">
          <div className="account-settings-heading">
            <span><Settings size={18} aria-hidden="true" /></span>
            <div>
              <p className="meta-text">ESPACE PERSONNEL</p>
              <h2 id="account-settings-title">Réglages</h2>
              <p id="account-settings-description">Gère ton compte et les informations de ton club.</p>
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={requestClose}
            disabled={Boolean(busy)}
            className="icon-btn"
            aria-label="Fermer les réglages"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <nav
          className="account-settings-tabs"
          role="tablist"
          aria-label="Sections des réglages"
          style={{ gridTemplateColumns: `repeat(${isHeadCoach ? 3 : 2}, minmax(0, 1fr))` }}
        >
            <button
              type="button"
              role="tab"
              id="settings-account-tab"
              aria-selected={activeSection === "account"}
              aria-controls="settings-account-panel"
              className={activeSection === "account" ? "active" : ""}
              onClick={() => switchSection("account")}
            >
              <User size={16} aria-hidden="true" /> Compte
            </button>
            <button
              type="button"
              role="tab"
              id="settings-application-tab"
              aria-selected={activeSection === "application"}
              aria-controls="settings-application-panel"
              className={activeSection === "application" ? "active" : ""}
              onClick={() => switchSection("application")}
            >
              <MonitorDown size={16} aria-hidden="true" /> Application
            </button>
            {isHeadCoach && <button
              type="button"
              role="tab"
              id="settings-club-tab"
              aria-selected={activeSection === "club"}
              aria-controls="settings-club-panel"
              className={activeSection === "club" ? "active" : ""}
              onClick={() => switchSection("club")}
            >
              <Building2 size={16} aria-hidden="true" /> Club
            </button>}
        </nav>

        <div className="account-settings-content">
          {message && <AuthFeedback type={message.type}>{message.text}</AuthFeedback>}

          {activeSection === "account" ? (
            <div
              id="settings-account-panel"
              role={isHeadCoach ? "tabpanel" : undefined}
              aria-labelledby={isHeadCoach ? "settings-account-tab" : undefined}
              className="settings-panel"
            >
              <SettingsSectionHeader
                icon={User}
                title="Informations du compte"
                description="Ces informations identifient ton profil dans AthleteOS."
              />

              <ActionRow action={(
                <button type="button" onClick={saveName} disabled={Boolean(busy) || !name.trim() || name.trim() === profile?.name} className="btn-secondary">
                  {busy === "name" ? "Enregistrement…" : "Enregistrer"}
                </button>
              )}>
                <AuthField
                  id="settings-name"
                  label="Prénom et nom"
                  icon={User}
                  autoComplete="name"
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  disabled={Boolean(busy)}
                />
              </ActionRow>

              <ActionRow action={(
                <button type="button" onClick={saveEmail} disabled={Boolean(busy) || !email.trim() || email.trim() === user?.email} className="btn-secondary">
                  {busy === "email" ? "Envoi…" : "Changer l’email"}
                </button>
              )}>
                <AuthField
                  id="settings-email"
                  label="Adresse email"
                  icon={Mail}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  hint="La nouvelle adresse devra être confirmée par email."
                  value={email}
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={Boolean(busy)}
                />
              </ActionRow>

              <ActionRow action={(
                <button type="button" onClick={savePassword} disabled={Boolean(busy) || !password} className="btn-secondary">
                  {busy === "password" ? "Mise à jour…" : "Changer le mot de passe"}
                </button>
              )}>
                <AuthPasswordField
                  id="settings-password"
                  label="Nouveau mot de passe"
                  icon={Lock}
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                  value={password}
                  maxLength={128}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={Boolean(busy)}
                  showStrength
                />
              </ActionRow>

              <section className="settings-signout-card" aria-labelledby="settings-signout-title">
                <div>
                  <h3 id="settings-signout-title">Fin de session</h3>
                  <p>Déconnecte ce compte d’AthleteOS sur cet appareil.</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary settings-signout-button"
                  onClick={() => setConfirmSignOut(true)}
                  disabled={Boolean(busy)}
                >
                  <LogOut size={16} aria-hidden="true" /> Se déconnecter
                </button>
              </section>
            </div>
          ) : activeSection === "application" ? (
            <div
              id="settings-application-panel"
              role="tabpanel"
              aria-labelledby="settings-application-tab"
              className="settings-panel"
            >
              <SettingsSectionHeader
                icon={MonitorDown}
                title="Installer AthleteOS"
                description="Ajoute l’application à cet appareil ou partage son lien."
              />
              <PwaAccessCard />
            </div>
          ) : (
            <div
              id="settings-club-panel"
              role="tabpanel"
              aria-labelledby="settings-club-tab"
              className="settings-panel"
            >
              <SettingsSectionHeader
                icon={Building2}
                title="Identité du club"
                description="Ces actions sont réservées au head coach."
              />

              {clubLoading ? (
                <div className="settings-loading" role="status">
                  <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                  Chargement des informations du club…
                </div>
              ) : (
                <>
                  <ActionRow action={(
                    <button type="button" onClick={saveClubName} disabled={Boolean(busy) || !clubName.trim()} className="btn-secondary">
                      {busy === "club" ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  )}>
                    <AuthField
                      id="settings-club-name"
                      label="Nom du club"
                      icon={Building2}
                      autoComplete="organization"
                      value={clubName}
                      maxLength={100}
                      onChange={(event) => setClubName(event.target.value)}
                      disabled={Boolean(busy)}
                    />
                  </ActionRow>

                  <section className="settings-branding-card" aria-labelledby="settings-branding-title">
                    <div className="settings-branding-heading">
                      <span><Palette size={18} aria-hidden="true" /></span>
                      <div>
                        <h4 id="settings-branding-title">Identité visuelle</h4>
                        <p>Le logo, la couverture et la couleur apparaissent subtilement dans l’espace du club.</p>
                      </div>
                    </div>

                    <div className="settings-brand-assets">
                      <div className="settings-logo-editor">
                        <p className="club-field-label">Logo du club</p>
                        <div className="settings-logo-preview">
                          {logoPreview ? <img src={logoPreview} alt="Aperçu du logo du club" /> : <ImageIcon size={24} aria-hidden="true" />}
                        </div>
                        <label className="btn-secondary settings-file-button">
                          <Upload size={15} aria-hidden="true" /> {logoPreview ? "Remplacer" : "Choisir un logo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => selectBrandImage("logo", event.target.files?.[0])}
                            disabled={Boolean(busy)}
                          />
                        </label>
                        <small>Format carré recommandé · 5 Mo max.</small>
                      </div>

                      <div className="settings-cover-editor">
                        <p className="club-field-label">Photo de couverture</p>
                        <div className="settings-cover-preview">
                          {coverPreview ? <img src={coverPreview} alt="Aperçu de la couverture du club" /> : <><ImageIcon size={24} aria-hidden="true" /><span>Une image horizontale crée une signature discrète.</span></>}
                        </div>
                        <label className="btn-secondary settings-file-button">
                          <Upload size={15} aria-hidden="true" /> {coverPreview ? "Remplacer" : "Choisir une couverture"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => selectBrandImage("cover", event.target.files?.[0])}
                            disabled={Boolean(busy)}
                          />
                        </label>
                        <small>Image horizontale recommandée · 5 Mo max.</small>
                      </div>
                    </div>

                    <fieldset className="settings-accent-picker" disabled={Boolean(busy)}>
                      <legend>Couleur d’accent</legend>
                      <p>Elle colore uniquement les actions et repères importants.</p>
                      <div>
                        {CLUB_ACCENT_PRESETS.map((preset) => (
                          <label key={preset.value} title={preset.label}>
                            <input
                              type="radio"
                              name="club-accent"
                              value={preset.value}
                              checked={accentColor === preset.value}
                              onChange={() => setAccentColor(preset.value)}
                            />
                            <span style={{ background: preset.value }} aria-hidden="true" />
                            <small>{preset.label}</small>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="settings-branding-save">
                      <p>Les images restent privées et accessibles uniquement aux membres du club.</p>
                      <button
                        type="button"
                        onClick={saveClubBranding}
                        disabled={Boolean(busy) || (!logoFile && !coverFile && accentColor === savedAccentColor)}
                        className="btn-primary"
                      >
                        {busy === "branding" ? "Enregistrement…" : "Enregistrer l’identité"}
                      </button>
                    </div>
                  </section>

                  <div className="settings-invite-card">
                    <div className="settings-invite-copy">
                      <span><KeyRound size={18} aria-hidden="true" /></span>
                      <div>
                        <h4>Code d’invitation</h4>
                        <p>Partage ce code avec les athlètes qui doivent rejoindre ton club.</p>
                      </div>
                    </div>
                    <div className="settings-code-row">
                      <output aria-label="Code d’invitation actuel">{inviteCode ?? "Indisponible"}</output>
                      <button type="button" onClick={copyCode} disabled={!inviteCode || Boolean(busy)} className="icon-btn" aria-label="Copier le code d’invitation">
                        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRegeneration(true)}
                        disabled={Boolean(busy)}
                        className="icon-btn"
                        aria-label="Générer un nouveau code"
                      >
                        <RefreshCw size={18} aria-hidden="true" />
                      </button>
                    </div>
                    {inviteCode && (
                      <div className="flex flex-wrap items-center gap-2 mt-3" aria-label="État de l’invitation">
                        <span className={`chip ${inviteStatus?.active === false ? "chip-danger" : "chip-success"}`}>
                          {inviteStatus?.active === false ? "Expirée" : "Active"}
                        </span>
                        <span className="chip chip-neutral">
                          {inviteStatus?.useCount > 0
                            ? `Utilisée ${inviteStatus.useCount} fois`
                            : "Pas encore utilisée"}
                        </span>
                        <span className="meta-text">
                          {inviteStatus?.expiresAt ? `Expire le ${new Date(inviteStatus.expiresAt).toLocaleDateString("fr-BE")}` : "Sans expiration automatique"}
                        </span>
                      </div>
                    )}
                  </div>

                  {confirmRegeneration && (
                    <div className="settings-confirm" role="alert" aria-labelledby="regenerate-code-title">
                      <div>
                        <h4 id="regenerate-code-title">Remplacer le code actuel ?</h4>
                        <p>L’ancien code sera invalidé immédiatement.</p>
                      </div>
                      <div>
                        <button type="button" className="btn-ghost" onClick={() => setConfirmRegeneration(false)} disabled={Boolean(busy)}>Annuler</button>
                        <button type="button" className="btn-secondary" onClick={regenerateCode} disabled={Boolean(busy)}>
                          {busy === "code" ? "Génération…" : "Générer le nouveau code"}
                        </button>
                      </div>
                    </div>
                  )}

                  <ClubInvitationCenter callAdmin={callAdmin} clubName={clubName} />
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmSignOut}
        title="Se déconnecter d’AthleteOS ?"
        description="Tu devras saisir à nouveau ton adresse email et ton mot de passe pour revenir."
        confirmLabel="Se déconnecter"
        loadingLabel="Déconnexion…"
        loading={busy === "signout"}
        icon={LogOut}
        onConfirm={handleSignOut}
        onClose={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
