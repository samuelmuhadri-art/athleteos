import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Copy, Link2, Mail, Plus, RefreshCw, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildInviteUrl } from "../../utils/clubBranding";

const STATUS_META = Object.freeze({
  sent: { label: "Envoyée", className: "chip-neutral" },
  opened: { label: "Ouverte", className: "chip-info" },
  accepted: { label: "Acceptée", className: "chip-success" },
  expired: { label: "Expirée", className: "chip-warning" },
  revoked: { label: "Révoquée", className: "chip-danger" },
});

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-BE", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

function feedbackError(error, fallback) {
  if (typeof error?.message === "string" && error.message.trim() && error.message !== "[object Object]") return error.message;
  if (typeof error === "string" && error.trim() && error !== "[object Object]") return error;
  return fallback;
}

export default function ClubInvitationCenter({ callAdmin, clubName }) {
  const [invitations, setInvitations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ recipientName: "", recipientEmail: "", expiresInDays: "7" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: "list_club_invitations" });
      setInvitations(data.invitations ?? []);
      setSelectedId((current) => current ?? data.invitations?.[0]?.id ?? null);
      if (data.migrationPending) setFeedback({ type: "error", text: "La migration des invitations doit encore être appliquée." });
    } catch (error) {
      setFeedback({ type: "error", text: feedbackError(error, "Les invitations n’ont pas pu être chargées. Réessaie dans un instant.") });
    } finally {
      setLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => { loadInvitations(); }, [loadInvitations]);

  const selected = useMemo(
    () => invitations.find((invitation) => invitation.id === selectedId) ?? null,
    [invitations, selectedId],
  );
  const selectedUrl = buildInviteUrl(selected?.code);

  const createInvitation = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setFeedback(null);
    try {
      const data = await callAdmin({
        action: "create_club_invitation",
        recipientName: form.recipientName.trim() || null,
        recipientEmail: form.recipientEmail.trim() || null,
        expiresInDays: Number(form.expiresInDays),
        idempotencyKey: crypto.randomUUID(),
      });
      setInvitations((current) => [data.invitation, ...current]);
      setSelectedId(data.invitation.id);
      setForm({ recipientName: "", recipientEmail: "", expiresInDays: "7" });
      setFeedback({ type: "success", text: "Invitation individuelle prête à être envoyée." });
    } catch (error) {
      setFeedback({ type: "error", text: feedbackError(error, "L’invitation n’a pas pu être créée. Réessaie dans un instant.") });
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (invitation = selected) => {
    const url = buildInviteUrl(invitation?.code);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setFeedback({ type: "success", text: "Lien d’invitation copié." });
    } catch {
      setFeedback({ type: "error", text: "La copie automatique n’est pas disponible sur cet appareil." });
    }
  };

  const shareInvitation = async (invitation = selected) => {
    const url = buildInviteUrl(invitation?.code);
    if (!url) return;
    if (!navigator.share) {
      await copyLink(invitation);
      return;
    }
    try {
      await navigator.share({
        title: `Invitation ${clubName || "AthleteOS"}`,
        text: `${invitation.recipientName ? `${invitation.recipientName}, rejoins` : "Rejoins"} ${clubName || "ton club"} sur AthleteOS.`,
        url,
      });
      setFeedback({ type: "success", text: "Invitation partagée." });
    } catch (error) {
      if (error?.name !== "AbortError") setFeedback({ type: "error", text: "Le partage n’a pas pu être ouvert." });
    }
  };

  const revokeInvitation = async (invitationId) => {
    setRevokingId(invitationId);
    setFeedback(null);
    try {
      await callAdmin({
        action: "revoke_club_invitation",
        invitationId,
        idempotencyKey: crypto.randomUUID(),
      });
      setInvitations((current) => current.map((invitation) => (
        invitation.id === invitationId ? { ...invitation, status: "revoked", revokedAt: new Date().toISOString() } : invitation
      )));
      setConfirmRevokeId(null);
      setFeedback({ type: "success", text: "Invitation révoquée. Son lien ne permet plus de rejoindre le club." });
    } catch (error) {
      setFeedback({ type: "error", text: feedbackError(error, "L’invitation n’a pas pu être révoquée. Réessaie dans un instant.") });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="card overflow-hidden" aria-labelledby="club-invitation-center-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--c-border)" }}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(var(--club-accent-rgb),0.12)", color: "var(--club-accent)" }}>
            <Send size={18} aria-hidden="true" />
          </span>
          <div>
            <h4 id="club-invitation-center-title" className="card-title">Invitations individuelles</h4>
            <p className="card-subtitle mt-1">Un lien unique par athlète, visible jusqu’à son acceptation.</p>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={loadInvitations} disabled={loading} style={{ minHeight: 36 }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Actualiser
        </button>
      </header>

      <form onSubmit={createInvitation} className="grid gap-3 border-b p-4 md:grid-cols-2" style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}>
        <label className="block">
          <span className="club-field-label"><UserRound size={14} aria-hidden="true" /> Nom de l’athlète <small>(facultatif)</small></span>
          <input className="input-premium mt-2 w-full" value={form.recipientName} maxLength={100} placeholder="Ex. Alice Martin"
            onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} />
        </label>
        <label className="block">
          <span className="club-field-label"><Mail size={14} aria-hidden="true" /> Email <small>(facultatif)</small></span>
          <input className="input-premium mt-2 w-full" type="email" value={form.recipientEmail} maxLength={254} placeholder="alice@club.be"
            onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))} />
        </label>
        <label className="block">
          <span className="club-field-label"><Clock3 size={14} aria-hidden="true" /> Durée de validité</span>
          <select className="input-premium mt-2 w-full" value={form.expiresInDays}
            onChange={(event) => setForm((current) => ({ ...current, expiresInDays: event.target.value }))}>
            <option value="1">24 heures</option>
            <option value="3">3 jours</option>
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={creating}>
            {creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />} {creating ? "Création…" : "Créer l’invitation"}
          </button>
        </div>
      </form>

      {feedback && (
        <div role={feedback.type === "error" ? "alert" : "status"} className="mx-4 mt-4 rounded-xl border px-3 py-2.5 text-[13px]"
          style={{ color: feedback.type === "error" ? "#F29B9A" : "#7BD8B4", borderColor: feedback.type === "error" ? "rgba(226,75,74,0.24)" : "rgba(29,158,117,0.24)", background: feedback.type === "error" ? "rgba(226,75,74,0.08)" : "rgba(29,158,117,0.08)" }}>
          {feedback.text}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="p-4 lg:border-r" style={{ borderColor: "var(--c-border)" }}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 secondary-text"><RefreshCw size={17} className="animate-spin" /> Chargement…</div>
          ) : invitations.length === 0 ? (
            <div className="py-10 text-center">
              <ShieldCheck size={26} className="mx-auto mb-3" style={{ color: "var(--club-accent)" }} />
              <p className="card-title">Aucune invitation individuelle</p>
              <p className="secondary-text mt-1">Crée la première avec le formulaire ci-dessus.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation) => {
                const status = STATUS_META[invitation.status] ?? STATUS_META.sent;
                const selectedRow = invitation.id === selectedId;
                return (
                  <button key={invitation.id} type="button" onClick={() => setSelectedId(invitation.id)}
                    className="tap-feedback w-full rounded-xl border p-3 text-left"
                    style={{ borderColor: selectedRow ? "rgba(var(--club-accent-rgb),0.42)" : "var(--c-border)", background: selectedRow ? "rgba(var(--club-accent-rgb),0.08)" : "var(--c-surface-2)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{invitation.recipientName || invitation.recipientEmail || "Invitation sans destinataire"}</p>
                        <p className="meta-text mt-1">{invitation.recipientEmail || `Code ${invitation.code}`}</p>
                      </div>
                      <span className={`chip ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="meta-text mt-2">Créée le {formatDate(invitation.createdAt)} · expire le {formatDate(invitation.expiresAt)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="p-4" aria-label="Détail de l’invitation sélectionnée">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="card-title">{selected.recipientName || "Invitation individuelle"}</p>
                  <p className="meta-text mt-1">Code {selected.code}</p>
                </div>
                <span className={`chip ${(STATUS_META[selected.status] ?? STATUS_META.sent).className}`}>{(STATUS_META[selected.status] ?? STATUS_META.sent).label}</span>
              </div>

              <div className="mx-auto w-fit rounded-2xl bg-white p-3" aria-label="QR code de l’invitation individuelle">
                <QRCodeSVG value={selectedUrl} size={150} level="M" marginSize={1} bgColor="#FFFFFF" fgColor="#07120C" title={`QR code invitation ${selected.code}`} />
              </div>

              <div className="rounded-xl border p-3" style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}>
                <div className="flex items-center gap-2"><Link2 size={15} style={{ color: "var(--club-accent)" }} /><p className="meta-text truncate">{selectedUrl}</p></div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-secondary" onClick={() => copyLink(selected)}><Copy size={15} /> Copier</button>
                  <button type="button" className="btn-primary" onClick={() => shareInvitation(selected)} disabled={["expired", "revoked", "accepted"].includes(selected.status)}><Send size={15} /> Renvoyer</button>
                </div>
              </div>

              <div className="space-y-2 text-[12px]" style={{ color: "var(--c-text-2)" }}>
                <p><strong style={{ color: "var(--c-text-1)" }}>Créée :</strong> {formatDate(selected.createdAt, true)}</p>
                <p><strong style={{ color: "var(--c-text-1)" }}>Ouverte :</strong> {formatDate(selected.openedAt, true)}</p>
                <p><strong style={{ color: "var(--c-text-1)" }}>Acceptée :</strong> {formatDate(selected.acceptedAt, true)}</p>
                <p><strong style={{ color: "var(--c-text-1)" }}>Expiration :</strong> {formatDate(selected.expiresAt, true)}</p>
              </div>

              {!["accepted", "expired", "revoked"].includes(selected.status) && (
                confirmRevokeId === selected.id ? (
                  <div className="rounded-xl border p-3" style={{ borderColor: "rgba(226,75,74,0.28)", background: "rgba(226,75,74,0.07)" }}>
                    <p className="secondary-text">Ce lien cessera immédiatement de fonctionner.</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmRevokeId(null)}><X size={15} /> Annuler</button>
                      <button type="button" className="btn-secondary flex-1" style={{ color: "#F29B9A", borderColor: "rgba(226,75,74,0.35)" }} onClick={() => revokeInvitation(selected.id)} disabled={revokingId === selected.id}>
                        {revokingId === selected.id ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />} Confirmer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost w-full" onClick={() => setConfirmRevokeId(selected.id)} style={{ color: "#F29B9A" }}>
                    Révoquer cette invitation
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-center secondary-text">Sélectionne une invitation pour afficher son QR et ses actions.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
