# AthleteOS

AthleteOS est une plateforme web de suivi d’entraînement et de performance pour les clubs, entraîneurs et athlètes. Elle réunit planning, réponses aux séances, charge déclarée, bien-être, performances, compétitions, rapports, messagerie et notifications dans une PWA responsive.

Le code applicatif se trouve dans [`athleteos/`](athleteos/). La documentation technique complète — installation, variables d’environnement, Supabase local, tests et déploiement — est disponible dans [`athleteos/README.md`](athleteos/README.md).

## Démarrage rapide

```bash
cd athleteos
npm ci
cp .env.example .env
npm run dev
```

Le frontend nécessite une URL Supabase et une clé publique `anon`. Pour un environnement reproductible avec base locale, Docker Desktop et le CLI Supabase sont requis ; voir le guide détaillé.

## Propriété intellectuelle

AthleteOS est conçu et développé par **Samuel Muhadri**.

**Tous droits réservés © 2026 Samuel Muhadri.** Ce dépôt est publié pour présentation de portfolio, évaluation académique et référencement. Toute copie, modification, redistribution ou exploitation commerciale non autorisée est interdite.
