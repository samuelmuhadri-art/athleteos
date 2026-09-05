# Étude du logo AthleteOS

## Identité active — Piste 03, validée en septembre 2026

**Piste 03 a été validée par le porteur du projet et remplace Orbit AO.** Le composant partagé, le favicon, les SVG d'icônes et leurs quatre PNG utilisent maintenant ce dessin. Les logos personnalisés des clubs ne sont pas modifiés.

Les PNG sont générés localement depuis `public/icon.svg` et `public/icon-maskable.svg` avec `node scripts/generate-brand-icons.mjs` depuis `athleteos/`. Ajouter `--check` vérifie leur conformité sans les écrire. Le manifeste et les URL existants sont conservés ; l'affichage d'une nouvelle icône installée dépend du rafraîchissement du navigateur et du système.

## Exploration conservée pour comparaison

Ouvrir [`logo-preview.html`](logo-preview.html) dans un navigateur : trois propositions vectorielles, sélectionnables au clavier ou au clic, avec comparaison dans une navigation coach, une connexion et une icône téléphone. Il s'agit de maquettes isolées, pas des écrans fonctionnels de l'application. Aucun serveur, compte ou téléchargement de ressource externe n'est nécessaire.

- **A — Élan** (`concepts/elan-v2.svg`) : A plein asymétrique, sans cercle ; lecture du nom et mouvement. Point de vigilance : proximité possible avec les nombreux monogrammes sportifs en A.
- **B — Piste, affinée** (`concepts/piste-v3.svg`) : direction préférée par le porteur du projet, retravaillée après le retour « ressemble à un arobase ». Deux anneaux fermés, ovales à lignes droites, espacés régulièrement, inclinés de 28° ; une traverse évoque la ligne de départ. Le crochet central et la silhouette verticale ont été supprimés. L'ancienne `piste-v2.svg` reste archivée pour comparaison. Point de vigilance : détails à 16 px et identification à confirmer sans expliquer le symbole.
- **C — Relais** (`concepts/relais-v2.svg`) : deux rubans complémentaires ; relation coach–athlète. Point de vigilance : sens moins immédiat, silhouette pouvant rappeler un éclair.

Même vert, même nom et mêmes contextes pour comparer les symboles sans biais de palette. Versions monochromes et petites tailles visibles sur chaque carte. **Piste est présélectionnée dans la planche et son dessin a été validé.** La [comparaison avant/après](piste-preview.html) présente la révision et ses déclinaisons. La validation du dessin n'est pas une étude utilisateur ni une garantie de disponibilité juridique.

Les autres propositions restent des archives, non utilisées dans l'application. La vérification de distinctivité de marque reste indépendante de cette intégration.

### Vérification locale de la planche

Depuis `athleteos/` : `node docs/brand/verify-logo-preview.mjs`. Le contrôle teste la sélection initiale Piste, les trois sélections au clavier, les images et l'absence de débordement des deux planches à 320, 768 et 1440 px, puis produit des captures locales dans `test-results/brand-preview/`.

## Étude précédente — historique

Cette étude applique la phase 16 du document `AthleteOS_Redesign_UI_UX_Premium_2026.pdf`.

### Ancienne direction retenue (remplacée par Piste 03)

La direction **A — Orbit AO** avait été sélectionnée lors de cette première étude. Elle est conservée ci-dessous à titre historique uniquement.

## Pourquoi l’éclair actuel doit évoluer

- Il s’agit de l’icône `Zap` de Lucide, donc d’un pictogramme d’interface non propriétaire.
- Il évoque surtout l’énergie et se différencie peu des nombreuses applications sportives ou électriques.
- Le symbole et le mot-symbole ne forment pas encore un système de marque cohérent.
- Les icônes PWA actuelles reprennent le même éclair et ne sont pas `maskable`.

## Les quatre directions

### A — Orbit AO

Un monogramme construit autour du `A` de Athlete et du `O` de OS. Le cercle ouvert évoque un système vivant et une progression continue.

- Force : la direction la plus distinctive et la plus équilibrée entre sport et produit numérique.
- Vigilance : conserver une ouverture suffisante dans l’anneau à 16 px.

### B — Lane

Deux trajectoires accélèrent vers un même point. Le mouvement rappelle une piste sans dessiner littéralement un stade ou un coureur.

- Force : la lecture la plus immédiatement sportive.
- Vigilance : peut être perçue comme une marque d’équipement si le wordmark n’est pas présent.

### C — Signal

Un noyau de performance entouré de deux ondes asymétriques. Le symbole représente une donnée captée, comprise puis transformée en décision.

- Force : traduit très bien le suivi, le wellness et la dimension scientifique.
- Vigilance : éviter une apparence trop médicale ou trop proche d’un signal radio.

### D — Apex

Deux formes géométriques montantes construisent un sommet et une ouverture centrale. La progression est exprimée sans flèche ni éclair.

- Force : la direction la plus statutaire et la plus premium.
- Vigilance : sa signification sportive est moins immédiate sans le nom AthleteOS.

## Décision

`A — Orbit AO` avait été retenue lors de cette étude. Ces quatre premières pistes sont désormais archivées ; seule Piste 03 est utilisée dans l'application.

## Fichiers

- `logo-directions.svg` : planche comparative sombre, claire, monochrome et petites tailles.
- `concepts/orbit-ao.svg`
- `concepts/lane.svg`
- `concepts/signal.svg`
- `concepts/apex.svg`

Chaque concept utilise des formes SVG simples, sans filtre et avec `currentColor`. La couleur peut donc être remplacée par du blanc, du noir ou une couleur monochrome lors de l’intégration finale.

## Validation avant intégration

1. Observer les quatre symboles sans lire leur explication.
2. Choisir les deux plus mémorisables.
3. Les comparer à 16, 24, 32, 48, 192 et 512 px.
4. Les montrer à cinq personnes sans donner le concept.
5. Vérifier après intégration que le même dessin est utilisé dans les shells, l’authentification, le favicon et les assets PWA.
