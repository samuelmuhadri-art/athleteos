import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";

export default function AppStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const serviceWorker = navigator.serviceWorker;
    let removeRegistrationListener;
    let hadController = Boolean(serviceWorker?.controller);
    const handleControllerChange = () => {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    };

    serviceWorker?.addEventListener?.("controllerchange", handleControllerChange);
    serviceWorker?.ready?.then((registration) => {
      const handleUpdateFound = () => {
        const worker = registration.installing;
        if (!worker) return;
        const handleStateChange = () => {
          if (worker.state === "installed" && serviceWorker.controller) setUpdateAvailable(true);
        };
        worker.addEventListener("statechange", handleStateChange);
      };
      registration.addEventListener?.("updatefound", handleUpdateFound);
      removeRegistrationListener = () => registration.removeEventListener?.("updatefound", handleUpdateFound);
      registration.update?.().catch(() => {});
    }).catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      serviceWorker?.removeEventListener?.("controllerchange", handleControllerChange);
      removeRegistrationListener?.();
    };
  }, []);

  if (!online) {
    return (
      <aside className="app-status-banner offline" role="status">
        <span className="app-status-icon"><WifiOff size={18} aria-hidden="true" /></span>
        <span>
          <strong>Mode hors connexion</strong>
          <small>L’application reste accessible, mais certaines données peuvent être indisponibles.</small>
        </span>
      </aside>
    );
  }

  if (!updateAvailable) return null;

  return (
    <aside className="app-status-banner update" role="status">
      <span className="app-status-icon"><RefreshCw size={18} aria-hidden="true" /></span>
      <span>
        <strong>Nouvelle version prête</strong>
        <small>Actualise AthleteOS pour profiter des dernières améliorations.</small>
      </span>
      <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
        Actualiser
      </button>
      <button type="button" className="app-status-dismiss" onClick={() => setUpdateAvailable(false)} aria-label="Masquer">
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  );
}
