# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK — le seul échec était une clé mal collée localement lors du test manuel du chemin cron, pas un bug).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**. Détails ci-dessous.

## Tâche active
- Numéro : 3 (clôturée)
- Objectif : Durcir l'inscription publique (`signup`) contre le spam, la création massive de comptes et la fuite d'informations, sans casser les deux parcours (créer un club / rejoindre par code).

## Décisions prises
- **Anti-bot : honeypot + délai minimum, pas de CAPTCHA tiers.** Décision prise avec vous : évite de dépendre d'un compte Cloudflare externe, déployable immédiatement. Champ caché `company` + rejet si soumission < 1.5s après chargement du formulaire.
- **Rate limiting** : table `signup_attempts` (migration), fenêtre glissante — 8 tentatives/15min par IP, 3/60min par email. Toute tentative comptabilisée dès qu'elle passe la vérification elle-même (empêche un contournement en alternant requêtes valides/invalides). Nettoyage automatique des lignes >24h à chaque appel.
- **`x-forwarded-for` : la PREMIÈRE valeur de la liste, confirmé via les vrais logs de la fonction déployée (pas une supposition).** J'avais d'abord écrit "dernière valeur" par prudence théorique (craignant qu'un client puisse falsifier l'en-tête), mais le test réel a montré que le rate limiting ne se déclenchait jamais. En inspectant les logs, la première valeur était stable et identique entre deux appels de la même machine (`85.x.x.x, 85.x.x.x, 99.x.x.x` puis `85.x.x.x, 85.x.x.x, 3.x.x.x` — seul le dernier segment changeait, correspondant à un nœud d'infrastructure interne Supabase qui change à chaque requête). Corrigé pour prendre la première valeur ; rate limiting vérifié fonctionnel ensuite (déclenchement d'un vrai 429 après plusieurs tentatives).
- **Anti-énumération d'email** : si l'email existe déjà, la fonction répond **exactement** comme un succès (même statut 200, même forme), sans rien créer. Le `signInWithPassword` client tranche ensuite silencieusement. Vérifié en conditions réelles : aucun doublon créé, réponse identique à un succès.
- **Atomicité** : RPC Postgres `signup_create_account` (`SECURITY DEFINER`) — club + users + athletes en une seule transaction SQL. Corrige un vrai bug de l'ancienne version : un échec sur l'insert `athletes` ne nettoyait jamais la ligne `users` déjà créée. Compensation réduite à un seul cas (suppression du compte Auth si le RPC échoue après coup) — vérifié en conditions réelles avec le hook de test (`SIGNUP_TEST_MODE`).
- **Stratégie email pilote : `email_confirm:true` conservé** (accès immédiat, aucun email de vérification) — décision documentée, pas un oubli. Aucun fournisseur SMTP configuré dans Supabase Auth ; je ne peux ni le configurer ni le vérifier depuis ici. Pour activer une vraie vérification : Dashboard → Authentication → Settings → configurer un fournisseur SMTP, puis repasser `email_confirm` à `false`.
- **Codes HTTP réels** (400/403/405/413/429/500) + `correlationId` dans chaque réponse/log. A nécessité une mise à jour de `SignupPage.jsx` (vérifié le comportement exact de `FunctionsHttpError` dans le code source installé de `@supabase/functions-js` plutôt que deviné).
- **Hook de test `SIGNUP_TEST_MODE`** : utilisé une fois pour vérifier réellement la compensation, puis laissé désactivé (variable non définie dans les secrets — comportement par défaut sûr).

## Bugs trouvés et corrigés pendant la vérification post-déploiement
Le premier déploiement s'est révélé cassé à 100% dès le premier test réel — corrigé en trois passes, chacune re-testée en conditions réelles :
1. **`.catch()` appelé sur une requête `postgrest-js`** (`admin.from(...).delete()...catch(() => {})`) — ces objets n'exposent que `.then()` (thenable), pas `.catch()`. Ça faisait planter la toute première ligne de la fonction, donc **100% des appels** échouaient en 500 avant même d'atteindre la logique métier. Confirmé en lisant le code source installé de `postgrest-js` plutôt qu'en re-devinant. Corrigé dans `signup/index.ts` et dans `test_signup_regression.mjs` (même erreur présente dans le script de nettoyage).
2. **`x-forwarded-for`** : voir "Décisions prises" ci-dessus — deviné à l'envers une première fois, corrigé après preuve par les logs.
3. **Bug dans le script de test lui-même** : le code d'invitation fabriqué pour le test (`SGN` + chiffres d'un timestamp) pouvait contenir un `0` ou un `1`, exclus de l'alphabet réel des codes club (`CODE_CHARS`, sans 0/O/1/I/L). La validation serveur rejetait donc à raison un code mal formé — pas un bug de `signup`, mais du test. Corrigé en générant un code de test dans le bon alphabet.

Ces trois bugs illustrent une limite du processus : les tests écrits par un LLM sans exécution réelle contre l'infrastructure de production peuvent être plausibles mais faux. Le déploiement + test immédiat par vous a permis de les attraper avant qu'ils causent un incident (une fonction publique cassée à 100%).

## Fichiers modifiés (état final, après corrections)
- `supabase/migrations/20260727030000_signup_rate_limit_and_atomic_rpc.sql` : table `signup_attempts` + fonction `signup_create_account`. Appliquée en prod (`supabase db push`).
- `supabase/functions/signup/index.ts` : réécrit, puis corrigé 2 fois post-déploiement (bug `.catch()`, sens de lecture `x-forwarded-for`). Déployé dans sa version finale.
- `src/pages/SignupPage.jsx` : honeypot, `maxLength`, gestion d'erreur HTTP réelle.
- `test_signup_regression.mjs` : corrigé 2 fois (bug `.catch()`, alphabet du code de test).

## Vérifications exécutées
- [x] `npm run build` — succès.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [x] `node --check` sur `test_signup_regression.mjs` — syntaxe JS valide.
- [x] **`test_signup_regression.mjs` exécuté en conditions réelles contre la fonction déployée : 9/9 OK.** Couvre : création club valide, adhésion par code valide (bon club + bon rôle), code invalide rejeté, email existant traité comme un succès sans doublon, honeypot rejeté, soumission trop rapide rejetée, rate limit IP déclenché (429 réel obtenu).
- [x] Test de compensation (`SIGNUP_TEST_MODE=true`) exécuté une fois manuellement : compte Auth et ligne `users` correctement absents après un échec forcé du RPC. Variable retirée ensuite.
- [ ] Vérification par le compilateur Deno — Deno CLI non installé dans cet environnement.

## Résultats et limites
- Commité, poussé, migration appliquée, fonction déployée, **vérifié en conditions réelles**.
- `isDuplicateEmailError` (détection "email déjà utilisé") a été implicitement validée par le test "email existant -> aucun doublon créé" qui est passé — la heuristique fonctionne contre la vraie réponse de GoTrue de ce projet.
- Table `signup_attempts` : contient désormais des lignes issues de nos tests manuels répétés (IP réelle de votre machine). Sans conséquence — ce sont des métadonnées techniques (IP/email/date), pas des données de compte. Se videra automatiquement sous 24h (nettoyage intégré à chaque appel), ou peut être vidée manuellement (`DELETE FROM signup_attempts;`) sans risque.
- Dette non traitée (hors périmètre tâche 3) : pas de vraie vérification email (choix pilote documenté) ; pas de CAPTCHA tiers (choix produit) ; rate limiting en base plutôt qu'en cache distribué — suffisant à l'échelle actuelle, à revoir si le trafic grossit significativement.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 3 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
