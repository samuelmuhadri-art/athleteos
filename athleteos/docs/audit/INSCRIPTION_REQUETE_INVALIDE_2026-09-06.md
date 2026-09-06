# Inscription : « Requête invalide » — 6 septembre 2026

## Diagnostic

La version de `signup` téléchargée depuis le projet lié renvoyait exactement ce message dans deux cas : champ caché `company` non vide, ou délai calculé entre l'horloge du navigateur et celle du serveur inférieur à 1 500 ms. Une horloge d'appareil en avance peut donc faire rejeter un vrai formulaire, même rempli lentement. La capture et le texte de l'utilisateur ne permettent pas de choisir avec certitude entre ces deux causes.

Le frontend utilisait en outre un champ HTML nommé `company`, sujet potentiel au remplissage automatique d'une organisation. Ce risque est réduit, sans prétendre contrôler tous les gestionnaires de mots de passe.

## Correctif minimal

- Le nouveau client envoie `formElapsedMs`, mesuré par `performance.now()`, sans dépendre de la date civile de son appareil. Le serveur exige toujours au moins 1 500 ms et refuse les durées invalides. Les anciens clients peuvent encore envoyer `formLoadedAt` ; une durée nouvelle invalide ne déclenche jamais de repli permissif.
- Le formulaire bloque une soumission trop rapide avant l'appel réseau : elle ne consomme pas un essai du quota serveur. Le texte et les champs saisis restent disponibles pour réessayer.
- Le champ HTML caché porte un nom neutre et des attributs d'exclusion de remplissage automatique. Sa valeur reste transmise dans `company` et contrôlée côté serveur ; aucun champ piège rempli n'est silencieusement effacé.
- Les rejets du serveur ont un texte actionnable et un code distinct. Le message de l'ancien serveur reste traduit par le nouveau frontend pendant le déploiement.
- JSON null ou tableau rejeté avant tout accès aux données. Aucune modification des quotas, de l'anti-énumération, de l'authentification, des transactions de création, des comptes, des migrations ou des règles RLS.

La durée reste déclarée par le client, comme l'ancien timestamp : ce n'est ni un CAPTCHA ni une preuve d'humanité. Les protections serveur existantes restent indispensables.

## Vérifications

`test_signup_regression.mjs` vérifie 15 cas réels sur Supabase local, dont création avec horloge avancée d'un jour, accès du nouveau coach à son profil et à son club sous RLS, invitation historique, refus du honeypot, refus d'une durée trop courte, quotas et compensation après erreur. Les données de test sont nettoyées.

Les tests unitaires vérifient les deux formats temporels, les valeurs invalides, la limite de 1 500 ms, le maintien du honeypot, le blocage avant appel réseau et les messages. Playwright vérifie le nouveau contrat envoyé pendant les parcours de création et récupération, en 320×568, 768×1024 et 1440×900 ; la suite UX existante est conservée.

## Publication

Le propriétaire a autorisé explicitement la publication de la seule fonction `signup` après les tests. La version distante 10 a été sauvegardée dans un dossier local ignoré sous `node_modules/.cache/signup-before-deploy-*`. Sa comparaison avec la version à publier ne montre que les changements de validation de ce lot.

Les migrations dont dépend l'inscription sont déjà présentes dans le projet lié. Les deux migrations Push du lot précédent ne sont pas appliquées : elles ne sont pas nécessaires ici et ne sont pas incluses dans cette autorisation. Aucun autre déploiement Supabase n'est effectué par ce lot.

Ordre : tests locaux → publication `signup` avec son helper → contrôle HTTP sans création de compte → commit/push du frontend et de Repomix. La création d'un compte réel de production n'est pas simulée à l'insu du propriétaire.

Résultat : 88 fichiers / 514 tests unitaires, 55 tests Playwright et 15 contrôles d'inscription locaux réussis ; lint, typecheck et build réussis. `signup` est publiée en version **11**, statut **ACTIVE**. Les versions des quatre autres fonctions sont inchangées. Le contrôle HTTP en production confirme CORS et la nouvelle validation JSON (tableau refusé avant tout accès aux données). Aucun compte de production n'a été créé ou modifié pendant cette vérification.
