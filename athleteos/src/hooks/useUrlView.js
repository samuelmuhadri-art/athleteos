// ============================================================
// AthleteOS — src/hooks/useUrlView.jsx
//
// Routing minimal par History API — pas de react-router. La nav de
// l'app est un simple switch entre vues plates (un seul niveau, pas de
// route imbriquée/paramétrée), une lib de routing complète serait
// disproportionnée pour ça.
//
// Avant ça, activeView était un simple useState : rafraîchir la page
// ramenait toujours au dashboard, le bouton retour du navigateur ne
// faisait rien, et il était impossible d'envoyer un lien direct vers
// une vue précise (ex. partager un lien vers "Mes performances").
// ============================================================

import { useState, useCallback, useEffect } from "react";

function resolveView(pathname, validIds, defaultView) {
  const id = pathname.replace(/^\//, "");
  return validIds.includes(id) ? id : defaultView;
}

export function useUrlView(validIds, defaultView) {
  const [activeView, setActiveView] = useState(() => resolveView(window.location.pathname, validIds, defaultView));
  const [viewKey, setViewKey] = useState(0);

  // Recadre l'URL au montage si le chemin ne correspond à aucune vue
  // connue (racine "/", faute de frappe, lien périmé…).
  useEffect(() => {
    const initial = resolveView(window.location.pathname, validIds, defaultView);
    if (window.location.pathname !== `/${initial}`) {
      window.history.replaceState({ view: initial }, "", `/${initial}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bouton précédent/suivant du navigateur.
  useEffect(() => {
    const onPopState = () => {
      setActiveView(resolveView(window.location.pathname, validIds, defaultView));
      setViewKey(k => k + 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [validIds, defaultView]);

  const navigate = useCallback((view) => {
    const v = validIds.includes(view) ? view : defaultView;
    setActiveView(v);
    setViewKey(k => k + 1);
    if (window.location.pathname !== `/${v}`) {
      window.history.pushState({ view: v }, "", `/${v}`);
    }
  }, [validIds, defaultView]);

  return { activeView, navigate, viewKey };
}
