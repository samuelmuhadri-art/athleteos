# Création de club : chargement infini — 6 septembre 2026

## Constats et correction

La capture montre `PGRST116` / HTTP 406 lors de la recherche du profil, puis un chargement permanent. Le code racine affichait effectivement un loader sans issue pour toute session dont le profil était absent. `.single()` exigeait également exactement une ligne. `.maybeSingle()` accepte désormais l'absence, mais ne masque ni une erreur d'accès ni des doublons : ces cas affichent une erreur guidée, sans créer de données de remplacement.

Le provider exécutait aussi une requête Supabase attendue dans un callback Auth asynchrone. Les requêtes sont maintenant réalisées dans un effet distinct ; le callback reste synchrone. Ce schéma est cohérent avec le [diagnostic de blocage documenté par Supabase](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). Il ne prouve pas que le verrou explique à lui seul la capture.

AVANT → APRÈS :

- Profil absent / erreur 406 : attente sans fin → explication, Réessayer, retour à la connexion.
- Réponse réseau manquante : attente sans borne → 12 secondes pour session/profil, 20 secondes pour inscription/connexion automatique. Une création distante peut avoir abouti malgré le timeout ; le message invite à essayer de se connecter avant de recommencer.
- Changement de compte : réponse asynchrone ancienne susceptible d'écraser le profil → requêtes annulées et réponses obsolètes ignorées. Renouvellement du token et changement d'utilisateur continuent d'actualiser le profil.
- Inscription terminée : bouton pouvant rester occupé → état d'attente terminé dans `finally`.

Fichiers : `src/context/AuthContext.jsx`, `src/App.jsx`, `src/components/auth/AuthAccessError.jsx`, `src/pages/SignupPage.jsx`, `src/utils/authTimeout.js`.

## Vérifications

- Tests unitaires du provider : callback synchrone, profil absent puis réessai, sessions concurrentes, déconnexion pendant une requête, expiration, erreur réseau, renouvellement du token et récupération du mot de passe.
- Tests du formulaire et de ses délais : création normale conservée, formulaire débloqué en cas d'attente excessive.
- Playwright : création → configuration du club, profil absent → réessai sans seconde inscription, erreur 406 → retour à la connexion, en 320×568, 768×1024 et 1440×900. Les API de ces tests navigateur sont interceptées.
- `test_signup_regression.mjs` : 15 contrôles sur Supabase local, dont une vraie inscription puis connexion et lecture du profil / club avec les droits du nouveau coach, et non service_role. Les comptes de test sont nettoyés.

## Limites et déploiement

Aucun compte existant, aucune donnée historique, aucune règle RLS et aucune migration ne sont modifiés par ce correctif. La création de club est confirmée sur l'environnement local, pas sur le compte de la capture. La cause de l'absence du profil de ce compte nécessite une vérification ciblée en production (adresse déjà utilisée, ligne absente, plusieurs lignes ou accès refusé). Ne pas reconstruire automatiquement un profil ni supprimer un compte à partir de cette capture.

Ce lot modifie le frontend et les tests uniquement. Il ne nécessite pas de nouvelle migration ou fonction serveur. Après déploiement du frontend, recharger l'application puis essayer de se connecter avant de refaire une inscription. Si le nouvel écran signale toujours un profil introuvable, identifier le compte concerné et vérifier ses données côté serveur avec l'autorisation appropriée.
