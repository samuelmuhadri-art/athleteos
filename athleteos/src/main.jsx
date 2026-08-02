// ============================================================
// AthleteOS — src/main.jsx
// AuthProvider wrappé autour de App pour que useAuth()
// soit disponible partout dans l'arbre de composants.
// ============================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/club/club-experience.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { initSentry, captureError } from "./utils/sentry";
import { PwaInstallProvider } from "./context/PwaInstallContext";
import AppStatusBanner from "./components/pwa/AppStatusBanner";
import ToastProvider from "./components/ui/ToastProvider";

initSentry();
// Les rejets de promesse non gérés (fetch échoué non catché, etc.) ne
// passent pas par l'ErrorBoundary React — on les capture séparément.
window.addEventListener("unhandledrejection", (e) => captureError(e.reason));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <PwaInstallProvider>
            <App />
            <AppStatusBanner />
          </PwaInstallProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
