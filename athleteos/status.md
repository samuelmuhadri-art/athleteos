# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** (`supabase functions deploy send-push`) et vérifiée en conditions réelles (10/11 tests automatisés OK — le seul échec était une clé mal collée localement lors du test manuel du chemin cron, pas un bug).

## Tâche active
- Numéro : 3
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Durcir l'inscription publique (`signup`) contre le spam, la création massive de comptes et la fuite d'informations, sans casser les deux parcours (créer un club / rejoindre par code).
- Risques : Fonction publique, sans authentification préalable par nature — surface d'attaque directement exposée à Internet.

## Décisions prises
- **Anti-bot : honeypot + délai minimum, pas de CAPTCHA tiers.** Décision prise avec vous : évite de dépendre d'un compte Cloudflare externe et reste déployable immédiatement. Champ caché `company` (les bots de spam le remplissent, un humain ne le voit jamais) + rejet si la soumission arrive moins de 1.5s après le chargement du formulaire. Moins robuste qu'un vrai CAPTCHA face à un bot sophistiqué ciblant spécifiquement ce site, mais couplé au rate limiting, largement suffisant pour le profil de risque d'une appli club à faible trafic.
- **Rate limiting** : nouvelle table `signup_attempts` (migration), fenêtre glissante — 8 tentatives/15min par IP, 3/60min par email. Toute tentative (réussie ou non) est comptabilisée dès qu'elle passe la vérification de débit elle-même, pour empêcher un contournement en alternant volontairement requêtes valides/invalides. Nettoyage automatique des lignes de plus de 24h à chaque appel (pas de pg_cron dédié, table à faible volume).
- **`x-forwarded-for`** : je prends la **dernière** valeur de la liste (pas la première) — un attaquant peut injecter son propre en-tête falsifié, qui se retrouve alors en tête ; seule la valeur ajoutée par l'infrastructure Supabase elle-même est fiable, et elle se trouve en fin de liste dans le cas d'un seul proxy de confiance. **Je n'ai pas pu vérifier ce comportement contre l'infrastructure réelle de Supabase (Deno Deploy)** — à confirmer en observant les logs de la fonction déployée avec de vraies requêtes.
- **Anti-énumération d'email** : si l'email existe déjà, la fonction répond **exactement** comme un succès (même statut 200, même forme de réponse), sans rien créer ni modifier. Le `signInWithPassword` qui suit côté client tranche ensuite silencieusement (échec générique si ce n'était pas le bon mot de passe — identique à n'importe quel échec de connexion classique, aucune information supplémentaire fuitée). Aucun changement de flux nécessaire côté frontend pour ce cas précis.
- **Atomicité** : nouveau RPC Postgres `signup_create_account` (`SECURITY DEFINER`) qui fait club + users + athletes en **une seule transaction SQL**. Corrige au passage un vrai bug de l'ancienne version : si l'insertion `athletes` échouait en mode `join_club`, la ligne `users` déjà créée juste avant n'était **jamais** nettoyée (orpheline). Le compte Auth (appel HTTP séparé, ne peut pas participer à une transaction SQL) reste compensé manuellement — mais un seul scénario de compensation subsiste désormais (au lieu de trois avant), pour toujours le même geste : supprimer le compte Auth si le RPC échoue après coup.
- **Stratégie email pilote : je garde `email_confirm:true`** (accès immédiat, aucun email de vérification envoyé) — décision documentée, pas un oubli. Ce projet n'a aujourd'hui aucun fournisseur SMTP configuré dans Supabase Auth (dashboard) ; je ne peux ni le configurer ni le vérifier depuis ici. Pour activer une vraie vérification plus tard : Dashboard Supabase → Authentication → Settings → configurer un fournisseur SMTP, puis repasser `email_confirm` à `false` dans `signup/index.ts`. Tant que ce n'est pas fait, le rate limiting + l'anti-bot restent la principale défense contre la création massive de comptes.
- **Codes HTTP réels** au lieu de toujours 200 (400/403/405/413/429/500 selon le cas) + un `correlationId` (UUID) dans chaque réponse et chaque ligne de log serveur, pour pouvoir corréler un rapport utilisateur avec les logs sans exposer de détail interne. Ce changement de contrat a nécessité une mise à jour de `SignupPage.jsx` (`supabase-js` lève une `FunctionsHttpError` sur un statut non-2xx ; j'ai vérifié le comportement exact dans le code source installé de `@supabase/functions-js` plutôt que de le deviner — `error.context` est la `Response` brute, pas encore lue, donc `.json()` dessus donne directement notre message).
- **Hook de test pour la compensation** : `body.__test_force_db_failure === true`, actif uniquement si la variable d'env `SIGNUP_TEST_MODE=true` est explicitement définie dans les secrets de la fonction (double verrou). Sans cette variable, le champ du body est totalement ignoré, y compris en prod si quelqu'un le découvre. Permet de vérifier réellement la compensation (DoD "échec simulé après création Auth") sans quoi ce test n'aurait été qu'une relecture de code, pas une vérification.

## Fichiers modifiés
- `supabase/migrations/20260727030000_signup_rate_limit_and_atomic_rpc.sql` (créé) : table `signup_attempts` (RLS activée, aucune policy — accès service_role uniquement) + fonction `signup_create_account`.
- `supabase/functions/signup/index.ts` (réécrit) : CORS restreint, rate limiting, anti-bot, validations, anti-énumération, création via RPC atomique + compensation réduite à un seul cas, vrais codes HTTP, correlationId, hook de test de compensation.
- `src/pages/SignupPage.jsx` : champ honeypot invisible + timestamp de chargement, `maxLength` sur les champs (miroir des limites serveur), gestion d'erreur adaptée aux vrais codes HTTP.
- `test_signup_regression.mjs` (créé) : script de non-régression HTTP couvrant tous les cas obligatoires de la tâche.

## Vérifications exécutées
- [x] `npm run build` — succès, exécuté deux fois (avant et après l'ajout du champ honeypot en JSX), aucune erreur.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [x] `node --check` sur `test_signup_regression.mjs` — syntaxe JS valide.
- [ ] **`test_signup_regression.mjs` — écrit mais PAS exécuté.** Nécessite que la migration soit appliquée et que `signup` soit déployée (interdiction de déployer/migrer en base dans cette tâche), plus des secrets Supabase live que je n'ai pas. À exécuter par vous après déploiement (voir section suivante).
- [x] Relecture du diff comme reviewer hostile — a trouvé et corrigé 3 bugs réels avant de conclure : (1) troncature silencieuse de l'email à 254 caractères qui rendait le contrôle de longueur inopérant, corrigée en rejet explicite ; (2) `x-forwarded-for` lu en prenant la première valeur (spoofable par le client), corrigé en dernière valeur ; (3) ordre des tests dans le script où le test de rate-limit épuisait le quota IP juste avant le test de compensation, qui aurait alors toujours été bloqué en 429 — tests réordonnés.
- [ ] Vérification par le compilateur Deno — **Deno CLI non installé dans cet environnement** (cf. tâche 2), je n'ai pas pu faire tourner `deno check`.

## Résultats et limites
- **Rien n'a été commité, poussé, ni déployé/migré.** Tout est en working tree, prêt à être relu.
- **Ordre de déploiement obligatoire** (contrairement aux tâches précédentes, celle-ci a une dépendance stricte) :
  1. Appliquer la migration : `supabase db push` (depuis `athleteos/`) — crée `signup_attempts` et la fonction `signup_create_account`. Sans ça, la fonction `signup` déployée plantera à l'appel du RPC.
  2. Déployer la fonction : `supabase functions deploy signup`.
  3. (Optionnel, pour tester la compensation) Ajouter `SIGNUP_TEST_MODE=true` dans les secrets de la fonction, lancer `node test_signup_regression.mjs`, puis **retirer immédiatement** cette variable.
- **Aucun test réellement exécuté** — le script existe et couvre tous les cas obligatoires (création valide, adhésion valide, code invalide, email existant, honeypot, soumission rapide, rate limit, compensation) mais requiert migration + déploiement + secrets live. Je ne prétends pas qu'il passe.
- **Incertitude non résolue** : le comportement exact de `x-forwarded-for` sur l'infrastructure Supabase (Deno Deploy) — j'ai pris la décision la plus prudente (dernière valeur de la liste) mais sans pouvoir la confirmer contre des logs réels. Si le rate limiting par IP se révèle inefficace ou trop agressif une fois en prod, c'est le premier endroit à vérifier.
- **`isDuplicateEmailError`** (détection de l'erreur "email déjà utilisé" renvoyée par `admin.auth.admin.createUser`) repose sur plusieurs heuristiques (`code`, `status`, message) faute de pouvoir tester contre la vraie réponse de GoTrue depuis ici — à vérifier avec le test "email existant" une fois déployé (DoD : la réponse doit être identique à un succès).
- Dette non traitée (hors périmètre tâche 3) : pas de vraie vérification email (documenté comme choix pilote assumé) ; pas de CAPTCHA tiers (choix produit assumé) ; le rate limiting est en mémoire base de données, pas dans un cache distribué — largement suffisant à l'échelle actuelle (quelques clubs), à revoir si le trafic grossit significativement.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 3 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
