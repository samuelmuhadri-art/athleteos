// ============================================================
// AthleteOS — src/main.jsx
// AuthProvider wrappé autour de App pour que useAuth()
// soit disponible partout dans l'arbre de composants.
// ============================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);