import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Link2, QrCode, Share2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildInviteUrl } from "../../utils/clubBranding";
import { useModalAccessibility } from "../../hooks/useModalAccessibility";

async function copyText(value) {
  if (!globalThis.navigator?.clipboard) throw new Error("Clipboard unavailable");
  await globalThis.navigator.clipboard.writeText(value);
}

export default function InviteClubModal({ clubName, inviteCode, onClose }) {
  const [copied, setCopied] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const inviteUrl = buildInviteUrl(inviteCode);

  useModalAccessibility({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  const handleCopy = async (kind, value) => {
    try {
      await copyText(value);
      setCopied(kind);
      setFeedback(kind === "code" ? "Code copié." : "Lien d’invitation copié.");
      globalThis.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback("La copie automatique n’est pas disponible. Sélectionne le texte manuellement.");
    }
  };

  const handleShare = async () => {
    if (!globalThis.navigator?.share || !inviteUrl) {
      await handleCopy("link", inviteUrl);
      return;
    }
    try {
      await globalThis.navigator.share({
        title: `Rejoins ${clubName || "mon club"} sur AthleteOS`,
        text: `Utilise le code ${inviteCode} pour rejoindre le club.`,
        url: inviteUrl,
      });
    } catch (error) {
      if (error?.name !== "AbortError") setFeedback("Le partage n’a pas pu être ouvert.");
    }
  };

  return createPortal(
    <div className="club-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="club-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="club-invite-title" tabIndex={-1}>
        <header className="club-dialog-header">
          <div className="club-dialog-heading">
            <span className="club-dialog-icon"><QrCode size={19} aria-hidden="true" /></span>
            <div>
              <p className="meta-text">INVITATION SÉCURISÉE</p>
              <h2 id="club-invite-title">Inviter un athlète</h2>
              <p>{clubName || "Ton club"}</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="icon-btn" aria-label="Fermer l’invitation">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="club-invite-content">
          <div className="club-invite-qr" aria-label="QR code d’invitation">
            {inviteUrl ? (
              <QRCodeSVG
                value={inviteUrl}
                size={184}
                level="M"
                marginSize={3}
                bgColor="#FFFFFF"
                fgColor="#07120C"
                title={`QR code pour rejoindre ${clubName || "le club"}`}
              />
            ) : (
              <div className="club-invite-qr-placeholder">Code indisponible</div>
            )}
          </div>

          <div className="club-invite-details">
            <div>
              <p className="club-field-label">Code du club</p>
              <div className="club-code-output">
                <output aria-label="Code d’invitation actuel">{inviteCode || "Indisponible"}</output>
                <button
                  type="button"
                  onClick={() => handleCopy("code", inviteCode)}
                  disabled={!inviteCode}
                  className="icon-btn"
                  aria-label="Copier le code d’invitation"
                >
                  {copied === "code" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div>
              <p className="club-field-label">Lien direct</p>
              <div className="club-link-output">
                <Link2 size={16} aria-hidden="true" />
                <input value={inviteUrl} readOnly aria-label="Lien direct d’invitation" />
                <button type="button" onClick={() => handleCopy("link", inviteUrl)} disabled={!inviteUrl} className="icon-btn" aria-label="Copier le lien d’invitation">
                  {copied === "link" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <p className="club-invite-help">
              L’athlète scanne le QR code ou ouvre le lien : le bon club et le code sont déjà sélectionnés.
            </p>
            {feedback && <p className="club-copy-feedback" role="status">{feedback}</p>}
          </div>
        </div>

        <footer className="club-dialog-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Fermer</button>
          <button type="button" onClick={handleShare} disabled={!inviteUrl} className="btn-primary">
            <Share2 size={16} aria-hidden="true" /> Partager l’invitation
          </button>
        </footer>
      </section>
    </div>,
    globalThis.document.body,
  );
}
