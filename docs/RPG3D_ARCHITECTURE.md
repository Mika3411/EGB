# RPG 3D Architecture

Document court pour reprendre le module RPG 3D sans devoir relire toute la carte.

## Vue d'ensemble

Le point d'entree UI est `src/components/Rpg3DStudio.jsx`. Il assemble les panneaux, l'etat projet, la boucle de jeu et le viewport Three.js.

Les blocs principaux sont :

- Domaine et defaults : `src/utils/rpg3dDomain.js`
- Edition carte : `src/utils/rpg3dMapEditing.js`
- Projet multi-canevas : `src/utils/rpg3dStudioProject.js`
- Sauvegarde locale/Supabase : `src/hooks/rpg3d/useRpg3DSaveSync.js`, `src/utils/rpg3dAssetsCore.js`, `src/utils/rpg3dAssetsStorage.js`
- Boucle runtime : `src/hooks/useRpg3DGameLoop.js`
- Viewport Three.js : `src/components/arcade/ArcadeThreeViewport.jsx`
- Scene Three.js decoupee : `src/components/arcade/rpg3dScene*.js`
- Imports modeles : `src/utils/rpg3dModelImport.js`, `src/utils/rpg3dModelImportCore.js`, `src/utils/threeGltfUtils.js`

## Flux Edit / Play

En mode edit, `Rpg3DStudio` modifie `config` via les hooks `useRpg3DMapHandlers`, `useRpg3DActionZoneEditing`, `useRpg3DPlacement`, `useRpg3DEditingCommands`, etc. Les edits passent par `patchConfig` ou `patchConfigWithoutHistory`; les changements structurants doivent pousser un snapshot d'historique.

En mode play, `useRpg3DGameLoop` lit `configRef.current` et mute `stateRef.current` a chaque frame : joueur, ennemis, pickups, projectiles, particules, score, victoire/defaite et messages. La UI ne lit pas directement chaque mutation : elle recoit des snapshots periodiques via `createRuntimeUiSnapshot`.

Le passage entre canevas RPG 3D passe par `useRpg3DCanvasManagement`. Les portails changent `rpg3dActiveCanvasId`, rechargent le `config` du canevas cible et reset le runtime.

## Coordonnees Carte vs Scene Three.js

Le gameplay travaille en coordonnees carte 2D :

- `x/y` = position dans le monde RPG 3D, en unites de carte.
- `z` = hauteur/lift gameplay ou hauteur de vertex selon l'entite.
- obstacles rectangulaires et polygons de zones d'action sont testes en 2D.

Three.js travaille en scene 3D :

- Conversion centralisee dans `toScenePosition` / `fromScenePosition` (`rpg3dSceneShared.js`).
- `WORLD_SCALE` convertit les unites carte vers les metres scene.
- La carte `x/y` devient generalement `scene.x/scene.z`.
- La hauteur carte devient `scene.y`.

Ne melange pas les deux systemes dans un meme helper. Les helpers domaine/map restent en unites carte; les builders Three.js convertissent au dernier moment.

## Persistance Locale et Supabase

Le payload RPG 3D sauvegarde `config` + `studioProject`.

Stockage local :

- Manifest localStorage : `escape-game-builder:arcade-assets:v1`
- Backups localStorage : `escape-game-builder:arcade-assets-backups:v1`
- Gros fichiers locaux IndexedDB : `escape-game-builder:rpg3d-local-models`

Supabase :

- Manifest prive : `users/{userId}/arcade-assets/assets.json`
- Modeles personnages : `users/{userId}/arcade-assets/characters/...`
- Modeles objets : `users/{userId}/arcade-assets/objects/...`
- Textures, ressources et animations ont leurs sous-dossiers.

`useRpg3DSaveSync` choisit entre local et Supabase selon la config et l'utilisateur. En cas d'echec Supabase, il tente une sauvegarde locale de secours. `syncConfigModelReferences` garde les references `config` alignees avec les modeles du `studioProject`.

## Rendu Statique / Dynamique

Le viewport Three.js est volontairement separe en groupes :

- Statique : obstacles, reliefs, props, zones d'action, terrain paint. Synchronise par `syncStaticSceneEntities`.
- Dynamique edit : heros, ennemis et pickups editables. Synchronise par `syncEditableDynamicEntities`.
- Dynamique play : joueur, ennemis runtime, pickups, bullets, particles. Le mode play met a jour les transforms frequemment et ne reconstruit que ce qui change de structure.
- Selection : overlays, gizmos, handles de zones d'action.

Les signatures dans `rpg3dSceneSignatures.js` limitent les rebuilds. Les changements de structure recreent les objets; les changements de transform passent par `updateStaticEntityTransforms` ou `updateDynamicTransforms`.

Les caches texture/modele passent par `createCachedTextureGetter`, `createCachedModelGetter` et `createViewportModelGetter`. Toujours disposer geometries, materials et textures via les helpers existants avant de retirer un objet Three.js.

## Imports GLB / FBX / OBJ

Les imports passent par `readModelImport` :

- GLB direct : conserve le fichier original si possible.
- FBX/OBJ : charges via les loaders Three.js et normalises par `threeGltfUtils`.
- ZIP : le premier modele reconnu est pris comme source; les textures/ressources (`png`, `jpg`, `webp`, `gif`, `bmp`, `mtl`) sont attachees comme `modelResources`.

Les petits fichiers peuvent etre inlines en data URL. Les fichiers lourds restent en blob/local IndexedDB ou sont envoyes vers Supabase au moment de la sauvegarde distante.

Les imports decor mesurent les dimensions pour initialiser `w/h/modelHeight`. Les personnages peuvent porter animations, rig points et equipements; les previews reutilisent des caches separes.

## Zones d'Action

Modele :

- Collection : `config.actionZones`
- Types valides : `portal`, `npcAction`
- Footprint : rectangle `x/y/w/h` ou polygon `vertices`
- Volume 3D : `modelHeight`, `topVertices` optionnels
- Style : `color`, `opacity`, `renderMode`, `visibleInPlay`

Edition :

- `isPointInActionZone` teste le footprint polygonal en 2D.
- `moveActionZoneVertex`, `moveActionZoneEdge`, `insertActionZoneVertex` gerent l'edition polygonale.
- Les `topVertices` sont implicites tant que la couche haute n'est pas editee; des `topVertices` explicites restent independants du footprint.
- Les handles 3D sont rendus dans `rpg3dSceneActionZones.js` et transmis au picking via `entityType: actionZoneVertex/actionZoneEdge`.

Runtime :

- `getActiveRuntimeActionZone` choisit la zone active sous le joueur, avec la meme priorite que le picking : derniere zone de la liste en premier.
- `resolveActionZoneEntryTrigger` declenche uniquement a l'entree et garde un cooldown.
- `portal` appelle `activateRpg3DCanvasPortal`.
- `npcAction` affiche soit un message simple, soit l'overlay de choix multiples.

## Tests Utiles

Tests unitaires principaux :

- `src/__tests__/rpg3dDomain.test.js` : defaults, clones, helpers domaine.
- `src/__tests__/rpg3dMapEditing.test.js` : selection, drag, resize, zones d'action, polygons.
- `src/__tests__/useRpg3DGameLoop.test.js` : collisions, pathfinding, runtime actions, snapshots UI.
- `src/__tests__/rpg3dSceneBuilders.test.js` : construction scene, overlays, action zones, props.
- `src/__tests__/ArcadeThreeViewport.test.jsx` : helpers viewport et interactions isolees.
- `src/__tests__/rpg3dRuntimeModels.test.js` : caches/runtime models.
- `tests/e2e/rpg3d-smoke.spec.js` : smoke Playwright du mode RPG 3D.

## Commandes de Verification

Commandes courantes :

```bash
npm.cmd exec -- vitest run src/__tests__/rpg3dDomain.test.js src/__tests__/rpg3dMapEditing.test.js src/__tests__/useRpg3DGameLoop.test.js
npm.cmd exec -- vitest run src/__tests__/rpg3dSceneBuilders.test.js src/__tests__/ArcadeThreeViewport.test.jsx src/__tests__/rpg3dRuntimeModels.test.js
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:rpg3d:smoke
```

Si Windows garde `dist/assets` verrouille pendant un build local, verifier au moins la compilation Vite avec :

```bash
npm.cmd exec -- vite build --emptyOutDir false
```
