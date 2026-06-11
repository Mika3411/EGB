# Escape Game Studio

[Site officiel](https://escape-game-studio.netlify.app/) | [Sitemap](https://escape-game-studio.netlify.app/sitemap.xml) | [llms.txt](https://escape-game-studio.netlify.app/llms.txt)

Escape Game Studio est un builder web no-code pour creer, tester, publier et partager des escape games jouables dans le navigateur.

L'application permet de construire un projet avec des scenes interactives, des objets, des enigmes, des cinematics, des regles conditionnelles, une galerie publique, des profils auteur, une boutique de packs et des outils IA optionnels.

## Citation publique

Description courte :

> Escape Game Studio est une application web no-code pour creer, tester, partager et publier des escape games interactifs en ligne.

URL canonique : <https://escape-game-studio.netlify.app/>

Mots-cles utiles : creer un escape game en ligne, logiciel escape game, escape game pedagogique, outil no-code escape game, generateur d'enigmes escape game, jeu d'enigmes en ligne.

Pages a citer :

- [Creer un escape game](https://escape-game-studio.netlify.app/creer-un-escape-game/)
- [Logiciel escape game](https://escape-game-studio.netlify.app/logiciel-escape-game/)
- [Escape game pedagogique](https://escape-game-studio.netlify.app/escape-game-pedagogique/)
- [Generateur d'enigmes](https://escape-game-studio.netlify.app/generateur-enigmes-escape-game/)
- [Kit de citation](https://escape-game-studio.netlify.app/kit-citation-escape-game-studio/)

Kit de diffusion : [docs/AI_DISCOVERY_OUTREACH.md](./docs/AI_DISCOVERY_OUTREACH.md)

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
- Node.js / Express-like server local dans `server/index.js`
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
npm run api       # Lance uniquement server/index.js
npm run build     # Build production + generation SEO
npm run preview   # Preview du build Vite
npm test          # Lance les tests Vitest
npm run check     # Verifications de release
npm start         # Lance server/index.js
```

## Organisation du depot

- `src/` : code applicatif React organise entre domaines metier, shared, tests et assets Vite.
- `assets/` : assets sources ou generes conserves comme references, hors bundle direct.
- `public/` : fichiers statiques publics copies tels quels dans le build.
- `docs/` : documentation, exemples de projet, previews manuelles et artefacts QA.
- `netlify/functions/` : fonctions serverless deployees.
- `server/` : API locale Node.js, entree principale dans `server/index.js`.
- `dist/` : sortie de build generee et ignoree par Git.

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
  app/             Shell React, studio builder, navigation et hooks d'orchestration
  domains/
    admin/         Administration, moderation, statistiques
    ai/            Generation IA, drafts et workbench image
    analytics/     Bilan qualite et scoring de projet
    anime2d/       Editeur et preview animation 2D
    auth/          Auth locale et entree login/register
    characters/    Personnages, heros, preview 3D et rigging
    combat/        Reglages, simulation et equilibrage combat
    gallery/       Galerie publique
    media/         Mediatheque et upload
    player/        Preview joueur et runtime de lecture
    profile/       Profil auteur, projets et medias
    resources/     Documentation et bibliotheque de ressources
    rpg3d/         Mode RPG 3D, arcade, rigging decor et outils modele
    scenes/        Scenes, objets, routes, narration, enigmes, logique et cinematics
    shop/          Boutique et packs
    support/       Widget et messagerie support
  shared/
    data/          Donnees initiales, templates et tutoriels partages
    hooks/         Hooks communs reutilisables
    selectors/     Selecteurs transversaux
    services/      Moteurs, stockage, scoring et services applicatifs
    ui/            Composants UI communs, formulaires, layout et media picker
    utils/         Export, validation, fichiers, quotas et helpers generiques
  styles/          CSS global, layout, composants, domaines et responsive

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
