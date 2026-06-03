# Escape Game Studio

Escape Game Studio est un builder web no-code pour creer, tester, publier et partager des escape games jouables dans le navigateur.

L'application permet de construire un projet avec des scenes interactives, des objets, des enigmes, des cinematics, des regles conditionnelles, une galerie publique, des profils auteur, une boutique de packs et des outils IA optionnels.

## Fonctionnalites

- Creation de projets depuis un template ou une base vide.
- Modes de creation progressifs : debutant, intermediaire, expert, narration a choix multiples et aventure de heros.
- Editeur de scenes avec zones interactives, objets, medias et arborescence.
- Systeme d'inventaire, combinaisons, enigmes, logique conditionnelle et transitions.
- Cinematiques, narration, preview joueur et export jouable.
- Galerie publique avec publication, fiches de jeu, auteurs, notes, avis et compteurs de parties.
- Profil utilisateur avec projets, medias, publication, commandes et parametres auteur.
- Boutique de packs et integrations Gumroad.
- Generation IA optionnelle pour les projets, images et ameliorations.
- Stockage local de secours et synchronisation Supabase quand la configuration est disponible.

## Stack

- React 18
- Vite
- Node.js / Express-like server local dans `server.js`
- Netlify Functions pour les endpoints deployes
- Supabase Auth + Storage
- Vitest + Testing Library
- JSZip, lucide-react et outils image/IA

## Installation

```bash
npm install
```

Copie ensuite le fichier d'exemple d'environnement :

```bash
cp .env.example .env
```

Sous PowerShell, si `npm` est bloque par la policy d'execution, utilise `npm.cmd` :

```powershell
npm.cmd install
```

## Demarrage local

```bash
npm run dev
```

Ce script lance :

- l'API locale sur `http://localhost:8787`, sauf si elle tourne deja ;
- Vite sur le premier port disponible, generalement `http://localhost:5173`.

Sous PowerShell :

```powershell
npm.cmd run dev
```

Tu peux aussi lancer les morceaux separement :

```bash
npm run api
npm run dev:ui
```

## Scripts

```bash
npm run dev       # Lance l'API locale et Vite
npm run dev:ui    # Lance uniquement Vite
npm run api       # Lance uniquement server.js
npm run build     # Build production + generation SEO
npm run preview   # Preview du build Vite
npm test          # Lance les tests Vitest
npm run check     # Verifications de release
npm start         # Lance server.js
```

## Variables d'environnement

Les variables disponibles sont documentees dans [.env.example](./.env.example).

Groupes principaux :

- Supabase client : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Supabase serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Buckets Storage : `VITE_SUPABASE_PUBLIC_ASSETS_BUCKET`, `VITE_SUPABASE_PRIVATE_DATA_BUCKET` cote client, `SUPABASE_PUBLIC_ASSETS_BUCKET`, `SUPABASE_PRIVATE_DATA_BUCKET` cote serveur
- Admin Supabase : role(s) `admin` ou flag `isAdmin` / `is_admin` uniquement dans `app_metadata`
- Outils 3D locaux : `/api/model-tools` reserve aux admins Supabase, avec `MODEL_TOOLS_DISABLED`, limites upload/ZIP et rate-limit dedies
- Site et CORS : `VITE_SITE_URL`, `CORS_ALLOWED_ORIGINS`
- Gumroad : URLs de packs, permalinks, webhook secret
- Credits IA : couts, cle admin et limites d'usage
- OpenAI serveur : `OPENAI_API_KEY`, modeles texte/image/moderation
- Remove.bg : `REMOVE_BG_API_KEY`, cout en credits
- Serveur local : `PORT`

Important : ne cree pas de variable `VITE_OPENAI_API_KEY`. Une variable prefixee par `VITE_` est exposee au navigateur. La cle OpenAI doit rester cote serveur avec `OPENAI_API_KEY`.

## Supabase

La configuration Supabase est optionnelle en local, mais necessaire pour l'authentification reelle, la synchronisation multi-appareils, les assets publics/prives et certaines fonctions de publication.

Voir la documentation dediee :

- [Supabase Storage](./docs/SUPABASE_STORAGE.md)

## Structure du projet

```text
src/
  components/      Interfaces React : builder, profil, galerie, onglets
  hooks/           Etat metier, auth locale, autosave, preview, stockage
  lib/             Moteurs et services : jeu, galerie, scoring, assets, boutique
  utils/           Export, validation, fichiers, IA, quotas et helpers
  data/            Donnees initiales, templates et tutoriels
  styles/          CSS global, layout, composants et features

netlify/functions/ Endpoints serverless de production
supabase/          Scripts SQL et configuration liee a Supabase
scripts/           Scripts de dev, release et generation
docs/              Documentation technique
public/            Assets publics statiques
```

## Tests et verification

```bash
npm test
npm run build
npm run check
```

Etat verifie localement :

- build Vite OK ;
- suite Vitest OK avec 107 tests.

## Deploiement

Le projet contient une configuration Netlify dans [netlify.toml](./netlify.toml) et des fonctions dans [netlify/functions](./netlify/functions).

Avant de deployer :

1. Configure les variables d'environnement cote Netlify.
2. Verifie les buckets Supabase et les politiques d'acces.
3. Lance `npm run build`.
4. Lance `npm run check`.
5. Teste les endpoints sensibles : IA, publication, boutique, webhook Gumroad et stockage.

## Notes de securite

- Garde les cles serveur hors du frontend.
- Controle les origines CORS avec `CORS_ALLOWED_ORIGINS`.
- Active la moderation IA sauf cas de test explicite.
- Ne commite jamais `.env`.
- Verifie les regles Supabase Storage avant une mise en production publique.

## Documentation

- [Supabase Storage](./docs/SUPABASE_STORAGE.md)
- [Mécanique de combat](./docs/COMBAT_ENGINE.md)
