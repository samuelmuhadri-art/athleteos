# Preuves visuelles de l’audit

Ces captures ont été générées le 1er août 2026 avec Chromium et le build local de production.

## Matrice réellement exécutée

- Écran public d’authentification, thèmes clair et sombre : 320, 360, 375, 390, 768, 1024, 1280 et 1440 px.
- Écran public d’authentification, thème sombre : zoom navigateur à 200 %.
- Écran public d’invitation, thème sombre : 320 px.

Le test automatisé permanent est `e2e/audit-visual.spec.js`. Résultat final : 18 captures sur 18 générées sans échec.

## Limites

- Les fichiers sont des preuves **après correction**. Aucune capture « avant » fiable n’avait été enregistrée au début de l’audit ; aucune comparaison artificielle n’est donc présentée.
- Les pages coach et athlète authentifiées nécessitent les fixtures Supabase locales. Docker étant indisponible sur cette machine, elles n’ont pas été capturées et restent à vérifier sur un staging isolé.
- Les captures vérifient le rendu et les débordements visibles. Elles ne remplacent pas une revue manuelle complète au lecteur d’écran.

Les noms de fichiers encodent la page, le thème et la largeur, par exemple `auth-dark-320.png`.
