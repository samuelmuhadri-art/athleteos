import { useCallback, useEffect, useMemo, useState } from "react";
import { PwaInstallContext } from "./pwaInstallState";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.matchMedia?.("(display-mode: minimal-ui)")?.matches
    || window.navigator?.standalone === true;
}

function detectPlatform() {
  if (typeof navigator === "undefined") return { isIos: false, isMobile: false };
  const userAgent = navigator.userAgent ?? "";
  const isIos = /iPad|iPhone|iPod/i.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    isIos,
    isMobile: isIos || /Android|Mobile/i.test(userAgent),
  };
}

export function PwaInstallProvider({ children }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay);
  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayChange = () => setInstalled(isStandaloneDisplay());
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery?.addEventListener?.("change", handleDisplayChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery?.removeEventListener?.("change", handleDisplayChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return { outcome: "unavailable" };
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice?.outcome === "accepted") setInstalled(true);
    return choice ?? { outcome: "dismissed" };
  }, [installPrompt]);

  const share = useCallback(async () => {
    const url = window.location.origin;
    const data = {
      title: "AthleteOS",
      text: "Rejoins-moi sur AthleteOS, la plateforme de suivi sportif du club.",
      url,
    };

    if (navigator.share) {
      await navigator.share(data);
      return "shared";
    }
    if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
    await navigator.clipboard.writeText(url);
    return "copied";
  }, []);

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
    await navigator.clipboard.writeText(window.location.origin);
  }, []);

  const value = useMemo(() => ({
    canInstall: Boolean(installPrompt) && !installed,
    installed,
    install,
    share,
    copyLink,
    ...platform,
  }), [copyLink, install, installPrompt, installed, platform, share]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}
