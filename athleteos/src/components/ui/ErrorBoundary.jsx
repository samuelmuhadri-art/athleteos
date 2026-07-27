// ============================================================
// AthleteOS — src/components/ui/ErrorBoundary.jsx
// Filet de sécurité React : sans ça, une exception de rendu
// (donnée inattendue, etc.) fait planter toute l'app en écran
// blanc. Ici on affiche un message récupérable à la place.
// ============================================================

import { Component } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { captureError } from "../../utils/sentry";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary a intercepté une erreur:", error, info);
    captureError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--c-bg)" }}>
        <div className="card p-8 max-w-sm w-full text-center">
          <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", background: "rgba(224,82,82,0.10)" }}>
            <AlertTriangle size={26} color="#E05252" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text-1)", marginBottom: 6 }}>
            Une erreur inattendue s'est produite
          </p>
          <p style={{ fontSize: 12.5, color: "var(--c-text-3)", marginBottom: 22, lineHeight: 1.6 }}>
            L'application a rencontré un problème et ne peut pas continuer. Recharge la page — si ça se reproduit, préviens ton coach ou le support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{ marginInline: "auto" }}
          >
            <RefreshCw size={14} /> Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
