# Étude du logo AthleteOS

Cette étude applique la phase 16 du document `AthleteOS_Redesign_UI_UX_Premium_2026.pdf` sans modifier le logo actif de l’application.

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

## Recommandation de départ

`A — Orbit AO` est la piste la plus complète pour AthleteOS : elle est propriétaire, compacte, lisible, compatible avec une icône d’application et associe naturellement le nom au symbole. `B — Lane` est la meilleure alternative si la marque doit paraître plus sportive que technologique.

Cette recommandation n’est pas encore une sélection. Le PDF demande un choix humain explicite avant de remplacer le logo actif, le favicon ou les icônes PWA.

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
5. Retenir une direction, puis seulement générer les assets actifs et remplacer `Zap` dans les shells et les pages d’authentification.
