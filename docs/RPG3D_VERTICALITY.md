# RPG 3D Verticality Audit

Cette note complete `docs/RPG3D_ARCHITECTURE.md`. Elle distingue ce qui est
deja rendu en 3D de ce qui reste, cote gameplay, un systeme 2D avec des
hauteurs visuelles.

## Conclusion courte

Le viewport Three.js affiche bien des volumes, des lifts, des floors sureleves,
des reliefs et des zones d'action en 3D. Le runtime, lui, raisonne encore
majoritairement en `x/y`:

- collisions par rectangles/cercle 2D;
- pathfinding sur empreintes 2D;
- pickups, projectiles et action zones declenches par distance ou footprint 2D;
- `z`, `modelHeight`, `floorZeroZ` et `elevation` utilises surtout pour le rendu,
  les gizmos et l'edition.

## Carte du systeme actuel

| Domaine | Ce qui est 3D aujourd'hui | Ce qui reste 2D en gameplay |
| --- | --- | --- |
| Coordonnees | `toScenePosition` convertit `x/y/z` vers `scene.x/scene.z/scene.y`. | `fromScenePosition` retourne seulement `x/y`; les clics de jeu retombent sur le plan sol. |
| Collisions | Les obstacles, props et reliefs ont une hauteur visuelle. | `getBlockingObstacles`, `resolveRuntimeMapCollision` et les bullets testent des empreintes rect/cercle sans intervalle de hauteur. |
| Pathfinding | Les murs et props visibles peuvent etre hauts. | `findPlayerPath` construit un chemin autour de rectangles 2D; pas de couche, pente, marche, pont ou sous-sol. |
| Reliefs | `getReliefElevation` donne une boite 3D dans la scene. | Un relief est soit bloquant sur tout son footprint, soit non bloquant; son elevation ne devient pas une surface praticable. |
| Floor tiles | Les props de type floor peuvent relever visuellement les acteurs via `getSupportSurfaceHeightAtPoint`. | Le runtime ne stocke pas de `groundZ`/`floorId`; le support ne participe pas aux collisions ni au pathfinding. |
| Terrain paint | Les layers peints sont rendus comme texture/plane. | Aucun cout de deplacement, collider, pente ou hauteur de terrain. |
| Action zones | `modelHeight`, `topVertices` et les handles forment un volume editable. | `isPointInActionZone` et `getActiveRuntimeActionZone` testent le footprint `x/y` uniquement. |
| Actors | Joueur et ennemis sont dessines sur un support visuel et avec un lift `z`. | La boucle de jeu met a jour `x/y`, `vx/vy`; pas de `vz`, gravite, step height, collision verticale ou etat de surface. |
| Pickups et bullets | Ils sont rendus a une hauteur fixe ou avec un lift visuel. | La collecte et les impacts se font par distance 2D. |
| Selection/editing | Les volumes et handles 3D existent pour certaines entites, surtout zones et model eraser. | La selection marquee, les bounds et la plupart des placements utilisent les footprints 2D. |

## Ou les hauteurs sont seulement visuelles

- `z` / `getEntityZ`: sert au lift visuel dans Three.js. Le runtime initialise
  certaines entites avec cette valeur, mais ne resout pas de physique verticale.
- `modelHeight`: dimensionne les props, fallbacks, gizmos et zones. Il ne cree pas
  encore de collider vertical dans la boucle de jeu.
- `elevation` des reliefs: produit une geometrie haute, mais pas une surface
  franchissable ni un niveau de navigation.
- `floorZeroZ`: aide a placer visuellement les flat tiles et les acteurs sur leur
  support. Le chemin et les collisions restent sur le plan `x/y`.
- `topVertices` des action zones: editable et visible, mais ignore au moment du
  trigger runtime.
- Terrain paint: purement visuel pour l'instant.

## Plan concret sans reecrire le moteur

1. Introduire un adaptateur runtime vertical, pur et testable.
   - Nouveau helper de derivation, par exemple `buildRpg3DVerticalRuntimeMap(config)`.
   - Il produit des `surfaces`, `colliders` et `actionVolumes` depuis les donnees
     existantes, sans migration de sauvegarde au depart.
   - Chaque entree expose `x/y` bounds, `zMin`, `zMax`, `walkable`,
     `blocksMovement`, `sourceType` et `sourceId`.

2. Ajouter un etat vertical compatible dans le runtime.
   - Etendre joueur/ennemis avec champs optionnels: `groundZ`, `surfaceId`,
     `verticalState`, puis plus tard `vz` si saut/chute.
   - Valeurs par defaut a `0` pour garantir que les maps actuelles gardent le
     comportement 2D existant.
   - Garder les APIs de mouvement `x/y` actuelles; la resolution verticale se fait
     en couche supplementaire.

3. Rendre les collisions sensibles a la hauteur.
   - Remplacer progressivement `getBlockingObstacles(config)` par une requete du
     type `getBlockingCollidersAtZ(verticalMap, actor)`.
   - Les obstacles historiques peuvent etre traites comme des bloqueurs au sol
     ou infinis verticalement tant qu'ils n'ont pas de bornes explicites.
   - Les flat tiles deviennent des surfaces walkables, pas des obstacles.

4. Filtrer action zones, pickups et projectiles par volume.
   - Une action zone se declenche si le joueur est dans le footprint et dans
     l'intervalle vertical.
   - Les pickups gagnent une bande de collecte verticale avec fallback large pour
     preserver les maps existantes.
   - Les bullets gardent d'abord leur trajectoire `x/y`, mais portent une hauteur
     d'impact compatible avec les colliders.

5. Garder le pathfinding simple par couches.
   - Conserver l'algorithme actuel autour des rectangles pour chaque layer
     walkable.
   - Connecter deux surfaces seulement si le delta vertical est franchissable
     (`stepHeight`) ou via une entite explicite: rampe, escalier, portail,
     ascenseur.
   - Reporter un vrai navmesh 3D; il n'est pas necessaire pour debloquer les
     interactions verticales de base.

6. Ajuster picking et editor apres le runtime.
   - Le click-to-move doit choisir une surface cible sous le curseur quand
     plusieurs floors se superposent.
   - L'editor doit afficher la surface cible, la hauteur effective et les volumes
     de collision derives.
   - Les handles 3D des action zones peuvent rester la base pour editer les
     volumes.

## Risques

- Compatibilite: une map 2D existante doit continuer a jouer exactement comme
  avant si tous les champs verticaux sont absents.
- Ambiguite: plusieurs flat tiles ou zones empilees au meme `x/y` demandent une
  regle stable de priorite.
- Performance: recalculer les volumes a chaque frame serait couteux; l'adaptateur
  doit etre cache par signature de config.
- UX: le sol clique par le joueur peut differer du sol visible si le raycast reste
  attache au plan `y=0`.
- IA: les ennemis peuvent rester bloques si le pathfinding ne comprend pas les
  liaisons entre couches.
- Persistance: les nouveaux champs doivent rester optionnels jusqu'a une migration
  explicite.

## Tests a ajouter

- Unitaires domaine/runtime:
  - construit une vertical map depuis obstacles, reliefs, floors et action zones;
  - confirme qu'une map sans hauteur garde les colliders 2D historiques;
  - verifie qu'un actor sur une surface surelevee ignore un bloqueur sous lui si
    les intervalles `z` ne se croisent pas;
  - verifie qu'une action zone ne trigger pas hors de son intervalle vertical;
  - verifie qu'un pickup haut n'est collecte que si la bande verticale correspond.

- Unitaires pathfinding:
  - bloque un chemin par un obstacle sur le meme layer;
  - autorise un passage au-dessus/en-dessous quand les colliders ne se croisent
    pas verticalement;
  - connecte deux floors seulement via marche/rampe/portail explicite.

- Unitaires editor/scene:
  - conserve et clamp `z`, `modelHeight`, `topVertices` et `floorZeroZ`;
  - verifie que les supports visuels et les volumes derives ont la meme hauteur
    attendue.

- E2E RPG 3D:
  - scene avec deux floors empiles, props bloquants, relief, pickup haut et zone
    d'action haute;
  - selection edit, passage play, click-to-move sur la surface cible;
  - canvas WebGL non vide et comportement 2D historique inchange sur une map sans
    verticalite.
