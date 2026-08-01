import { createContext, useContext } from "react";

export const PwaInstallContext = createContext(null);

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error("usePwaInstall doit être utilisé dans PwaInstallProvider");
  return context;
}
