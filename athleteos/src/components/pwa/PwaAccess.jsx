import { useState } from "react";
import { Check, Copy, Download, ExternalLink, MonitorDown, Share2, Smartphone } from "lucide-react";
import { usePwaInstall } from "../../context/pwaInstallState";

export function PwaInstallButton({ expanded = true, onOpenHelp }) {
  const { canInstall, installed, install } = usePwaInstall();
  if (installed) return null;

  const handleClick = async () => {
    if (canInstall) {
      await install();
      return;
    }
    onOpenHelp?.();
  };

  return (
    <button
      type="button"
      className={["pwa-install-quick", expanded ? "" : "compact"].join(" ")}
      onClick={handleClick}
      title={canInstall ? "Installer AthleteOS sur cet appareil" : "Afficher les options d’installation"}
      aria-label={expanded ? undefined : "Installer AthleteOS"}
    >
      <Download size={17} aria-hidden="true" />
      {expanded && <span>Installer AthleteOS</span>}
    </button>
  );
}

export default function PwaAccessCard() {
  const { canInstall, installed, install, share, copyLink, isIos, isMobile } = usePwaInstall();
  const [feedback, setFeedback] = useState("");

  const runInstall = async () => {
    setFeedback("");
    const result = await install();
    if (result?.outcome === "accepted") setFeedback("AthleteOS a bien été ajouté à ton appareil.");
  };

  const runShare = async () => {
    setFeedback("");
    try {
      const result = await share();
      if (result === "copied") setFeedback("Le lien AthleteOS a été copié.");
    } catch (error) {
      if (error?.name !== "AbortError") setFeedback("Le partage n’a pas pu être ouvert.");
    }
  };

  const runCopy = async () => {
    setFeedback("");
    try {
      await copyLink();
      setFeedback("Le lien AthleteOS a été copié.");
    } catch {
      setFeedback("La copie automatique n’est pas disponible dans ce navigateur.");
    }
  };

  let guidance = "Dans le menu de ton navigateur, choisis « Installer AthleteOS » ou « Créer un raccourci » pour l’ajouter au bureau.";
  if (isIos) guidance = "Sur iPhone ou iPad : touche Partager, puis « Sur l’écran d’accueil ».";
  else if (isMobile) guidance = "Dans le menu du navigateur, choisis « Ajouter à l’écran d’accueil » ou « Installer l’application ».";

  return (
    <section className="pwa-access-card" aria-labelledby="pwa-access-title">
      <div className="pwa-access-heading">
        <span>{isMobile ? <Smartphone size={19} aria-hidden="true" /> : <MonitorDown size={19} aria-hidden="true" />}</span>
        <div>
          <h3 id="pwa-access-title">AthleteOS sur ton appareil</h3>
          <p>Installe l’application pour l’ouvrir directement depuis ton écran d’accueil ou ton bureau.</p>
        </div>
      </div>

      {installed ? (
        <div className="pwa-installed-status" role="status">
          <Check size={17} aria-hidden="true" /> L’application est installée sur cet appareil.
        </div>
      ) : canInstall ? (
        <button type="button" className="btn-primary" onClick={runInstall}>
          <Download size={16} aria-hidden="true" /> Installer AthleteOS
        </button>
      ) : (
        <div className="pwa-manual-guidance">
          <ExternalLink size={16} aria-hidden="true" />
          <p>{guidance}</p>
        </div>
      )}

      <div className="pwa-access-actions">
        <button type="button" className="btn-secondary" onClick={runShare}>
          <Share2 size={16} aria-hidden="true" /> Partager AthleteOS
        </button>
        <button type="button" className="btn-ghost" onClick={runCopy}>
          <Copy size={16} aria-hidden="true" /> Copier le lien
        </button>
      </div>
      {feedback && <p className="pwa-access-feedback" role="status">{feedback}</p>}
    </section>
  );
}
