import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Crosshair,
  Cuboid,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Hand,
  HeartPulse,
  List,
  Magnet,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Mountain,
  MousePointer2,
  MousePointerClick,
  Orbit,
  PanelLeftOpen,
  PanelRightOpen,
  Pause,
  Paintbrush,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Save,
  Shield,
  Sparkles,
  Square,
  Sword,
  Triangle,
  Trash2,
  Undo2,
  Wrench,
  ZoomIn,
} from 'lucide-react';
import ArcadeThreeViewport from './arcade/ArcadeThreeViewport';
import Character3DTab from './Character3DTab.jsx';
import Decor3DTab from './Decor3DTab.jsx';
import ModelToolsTab from './ModelToolsTab.jsx';
import Rpg3DControls from './rpg3d/Rpg3DControls.jsx';
import Rpg3DHeader from './rpg3d/Rpg3DHeader.jsx';
import Rpg3DInspector from './rpg3d/Rpg3DInspector.jsx';
import Rpg3DMapPanel from './rpg3d/Rpg3DMapPanel.jsx';
import Rpg3DNpcChoiceOverlay from './rpg3d/Rpg3DNpcChoiceOverlay.jsx';
import Rpg3DStage from './rpg3d/Rpg3DStage.jsx';
import Rpg3DWorkspaceTabs from './rpg3d/Rpg3DWorkspaceTabs.jsx';
import HelpLabel from './forms/HelpLabel.jsx';
import { makeCharacter3DModel, makeDecor3DModel } from '../data/projectData';
import useRpg3DGameLoop from '../hooks/useRpg3DGameLoop.js';
import useRpg3DProjectState from '../hooks/useRpg3DProjectState.js';
import {
  createArcadeAssetsPayload,
  createSupabaseArcadeAssetsPayload,
  getPersistedModelAnimations,
  getStudioModelSource,
  hasRpg3DAssetsSupabaseConfig,
  isRpg3DAssetsNotFoundError,
  loadArcadeAssetsFromSupabase,
  rememberArcadeAssetsLocally,
  restoreLocalArcadeAssetsSources,
  syncConfigModelReferences,
  uploadArcadeAssetsManifest,
} from '../utils/rpg3dAssetsStorage.js';
import {
  DEFAULT_RPG3D_ACT_ID,
  DEFAULT_RPG3D_CANVAS_ID,
  cloneStudioProjectForEdit,
  createConfigFromSavedAssets,
  createFallbackRpg3DCanvas,
  createRpg3DCanvasDraft,
  createStudioProjectFromSavedAssets,
  getActiveRpg3DCanvas,
  getDefaultPortalTargetCanvasId,
  getDefaultRpg3DActs,
  getRpg3DCanvasStructure,
  syncStudioProjectActiveCanvasConfig,
} from '../utils/rpg3dStudioProject.js';
import {
  MAP_ENTITY_COLLECTIONS,
  applyGroupDragToConfig,
  canResizeSelectionEntity,
  clampArcadeEntitiesToWorld,
  duplicateMapEntityIntoConfig,
  findEntityAt,
  getEntityCenterPoint,
  getSelectedEntity,
  getSelectionEntities,
  isSameEntity,
  moveMapEntityByDelta,
  moveMapEntityToPoint,
  normalizeTerrainPaintPoint,
  resolveFlatTileDragPoint,
  scaleSelectionEntity,
  snapFlatTileToNeighbors,
  snapFlatTileToWorldEdges,
} from '../utils/rpg3dMapEditing.js';
import {
  ACTION_ZONE_DEFAULT_HEIGHT,
  ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
  ACTION_ZONE_DEFAULT_OPACITY,
  ACTION_ZONE_DEFAULT_WIDTH,
  ACTION_ZONE_MIN_SIZE,
  DEFAULT_ARCADE_CONFIG,
  DEFAULT_FLOOR_ZERO_Z,
  ENTITY_Z_MAX,
  ENTITY_Z_MIN,
  FLAT_GROUND_DEFAULT_COLOR,
  FLOOR_ZERO_Z_MAX,
  FLOOR_ZERO_Z_MIN,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  MODEL_ERASER_DEFAULT_RADIUS,
  MODEL_ERASER_MAX_RADIUS,
  MODEL_ERASER_MAX_STROKES,
  MODEL_ERASER_MIN_RADIUS,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_OPACITY,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  TERRAIN_PAINT_MAX_RADIUS,
  TERRAIN_PAINT_MIN_RADIUS,
  clamp,
  cloneConfig,
  createModelEraserSurfaceStroke,
  getActionZoneColor,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneOpacity,
  getActionZoneType,
  getActionZoneWidth,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelScale,
  getDecorMaterialBrightness,
  getDecorModelScale,
  getEnemyStats,
  getEntityZ,
  getFlatGroundPlateauColor,
  getFlatTileSnapOverlap,
  getFlatTileWorldBounds,
  getFlatTileWorldDimensions,
  getFloorBaseColor,
  getFloorTileWorldSize,
  getFloorZeroZ,
  getHexColor,
  getModelEraserRadius,
  getModelEraserStrokes,
  getPlayableHeroId,
  getPropHeight,
  getPropModelHeight,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  getSelectionBoundsFromEntities,
  getStudioDecorKindId,
  getTerrainPaintColor,
  getTerrainPaintOpacity,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  getWorldCoverTileSize,
  isFlatGroundPlateauProp,
  isFlatTileLikeProp,
  isFloorDecorKind,
  isFloorTileProp,
  normalizeDegrees,
} from '../utils/rpg3dDomain.js';

const ARCADE_WORLD_SCALE = 0.018;
const CHARACTER_PLACEMENT_CAMERA_DISTANCE = 16;
const CAMERA_DISTANCE_MIN = 3.5;
const CAMERA_DISTANCE_MAX = 60;
const CAMERA_ZOOM_DRAG_SENSITIVITY = 0.08;
const TERRAIN_PAINT_FLUSH_INTERVAL_MS = 32;
const RPG3D_LOGIN_REQUIRED_STATUS = 'Connecte-toi pour sauvegarder dans Supabase.';
const RPG3D_LOCAL_SESSION_FALLBACK_STATUS = 'Sauvegarde locale terminee. Connecte-toi pour synchroniser Supabase.';

const getNow = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const isDisconnectedSaveStatus = (status = '') => (
  status === RPG3D_LOGIN_REQUIRED_STATUS
  || status === RPG3D_LOCAL_SESSION_FALLBACK_STATUS
);

const RPG3D_FIELD_HELP = {
  mapWidth: 'Largeur totale de la carte en unites du builder. Augmente-la pour donner plus d espace horizontal au parcours.',
  mapHeight: 'Hauteur totale de la carte en unites du builder. Augmente-la pour construire une zone plus profonde.',
  mapGrid: 'Pas de la grille utilise pour aligner les placements et garder des distances regulieres.',
  mapObjects: 'Nombre total d elements places sur le canevas actif.',
  actionZoneTool: 'Active le placement d une zone d action 3D: clique ensuite sur la carte pour la poser.',
  flatGroundTool: 'Ajoute un sol plat opaque qui cache la grille technique et sert de base au terrain.',
  flatGroundColor: 'Couleur de base du plateau plat place sous la peinture du terrain.',
  terrainPaintTool: 'Active la peinture du terrain: maintiens le clic gauche sur le sol pour dessiner une zone coloree.',
  terrainPaintColor: 'Couleur appliquee aux nouvelles traces peintes au sol.',
  terrainPaintBrush: 'Largeur de la brosse utilisee pour dessiner les zones de terrain.',
  terrainPaintShape: 'Forme de la brosse utilisee pour peindre le terrain.',
  terrainPaintClear: 'Retire toutes les traces de peinture du terrain actuel.',
  assetFiles: 'Fichiers 3D crees dans les ateliers Personnages 3D et Objets 3D, prets a etre importes sur la carte.',
  cameraHeight: 'Hauteur de la camera au-dessus du sol pendant l edition et le test.',
  cameraDistance: 'Distance de recul de la camera par rapport au centre vise.',
  wallHeight: 'Hauteur visuelle des murs et obstacles dans le rendu 3D.',
  reliefScale: 'Amplifie ou reduit le volume des reliefs pour rendre le terrain plus lisible.',
  propHeight: 'Hauteur par defaut des decors simples quand aucun modele 3D precis ne la remplace.',
  lightIntensity: 'Puissance globale de l eclairage dans la carte 3D.',
  lightOrientation: 'Direction du soleil et des ombres dans la scene 3D.',
  playerCharacter: 'Preset de personnage utilise par le heros quand aucun modele 3D ou sprite personnalise ne le remplace.',
  characterRenderMode: 'Choisit si le personnage s affiche en volume procedural, modele 3D, sprite vertical ou forme stylisee.',
  characterModel: 'Modele 3D issu de l atelier Personnages 3D a appliquer au heros.',
  characterScale: 'Taille du modele 3D du heros sur la carte.',
  characterMaterialBrightness: 'Luminosite propre a ce personnage sur la carte RPG 3D.',
  playerImage: 'Image verticale utilisee comme apparence du heros en mode sprite.',
  currentHealth: 'Points de vie actuels du heros au lancement du test.',
  maxHealth: 'Reserve maximale de points de vie du heros.',
  currentMana: 'Mana disponible au lancement du test.',
  maxMana: 'Reserve maximale de mana du heros.',
  playerSpeed: 'Vitesse de deplacement du heros dans la carte.',
  attackSkill: 'Nom affiche pour l attaque principale du heros.',
  attackBonus: 'Bonus numerique ajoute aux calculs de l attaque principale.',
  attackManaCost: 'Mana depensee a chaque attaque principale.',
  powerName: 'Nom affiche pour le pouvoir principal du heros.',
  powerForce: 'Puissance de base du pouvoir avant les ajustements de combat.',
  powerManaCost: 'Mana depensee quand le pouvoir est utilise.',
  powerElement: 'Element du pouvoir, utile pour differencier les effets et futures resistances.',
  enemyVision: 'Distance a partir de laquelle les ennemis detectent le heros.',
  aiAggression: 'Tendance des ennemis a poursuivre et attaquer rapidement.',
  positionX: 'Position horizontale du centre de la selection sur la carte.',
  positionY: 'Position verticale du centre de la selection sur la carte.',
  positionZ: 'Hauteur de la selection par rapport au sol. Utile pour faire flotter ou poser un objet.',
  orientation: 'Rotation de la selection autour de l axe vertical.',
  floorZeroZ: 'Hauteur de reference ou les personnages marchent sur une dalle plate.',
  width: 'Largeur de l element selectionne.',
  height: 'Hauteur ou longueur de l element selectionne selon son type.',
  heroName: 'Nom du heros affiche dans les listes et futurs retours de jeu.',
  enemyHealth: 'Points de vie de depart de cet ennemi.',
  enemyStrength: 'Degats de base ou force offensive de cet ennemi.',
  enemySpeed: 'Vitesse de deplacement de cet ennemi.',
  enemyAttackSpeed: 'Frequence a laquelle cet ennemi peut attaquer.',
  enemyCriticalChance: 'Chance de coup critique de cet ennemi.',
  enemyCriticalMultiplier: 'Multiplicateur applique quand cet ennemi fait un critique.',
  enemyMana: 'Reserve de mana disponible pour les pouvoirs ennemis.',
  enemyPowerDamage: 'Degats de base du pouvoir ennemi.',
  enemyPowerChance: 'Probabilite que l ennemi choisisse son pouvoir au lieu d une attaque simple.',
  pickupType: 'Type de bonus ramasse par le joueur: soin, mana ou recharge de dash.',
  reliefName: 'Nom interne du relief pour le retrouver dans la gestion des objets.',
  reliefStyle: 'Forme visuelle du relief: plateau, crete ou fosse.',
  reliefDepth: 'Profondeur ou longueur du relief sur la carte.',
  reliefElevation: 'Hauteur visuelle du relief. Une valeur negative cree un creux.',
  collision: 'Indique si cet element bloque physiquement le passage du joueur.',
  decorScale: 'Echelle appliquee au modele 3D de cet objet.',
  materialBrightness: 'Luminosite propre a cet objet sur la carte RPG 3D.',
  modelEraserRadius: 'Largeur de la gomme appliquee uniquement au modele GLB selectionne.',
  rotationX: 'Inclinaison avant/arriere du modele selectionne.',
  rotationY: 'Rotation verticale du modele selectionne.',
  rotationZ: 'Inclinaison laterale du modele selectionne.',
  floorTileSize: 'Taille de la dalle plate selectionnee.',
  floorColor: 'Couleur de base d une dalle de sol plate sans texture.',
  propWidth: 'Largeur visible de l image ou du decor selectionne.',
  propDepth: 'Profondeur ou longueur visible de l image ou du decor selectionne.',
  propModelHeight: 'Hauteur 3D utilisee pour le rendu de cet objet.',
  actionZoneName: 'Nom interne du cube transparent pour le retrouver dans la gestion de carte.',
  actionZoneType: 'Choisit si la zone envoie vers un autre canevas ou declenche une action liee a un PNJ.',
  actionZoneColor: 'Couleur du voile transparent affiche dans le cube 3D.',
  actionZoneOpacity: 'Transparence du voile: monte-la pour mieux voir le volume, baisse-la pour le rendre plus discret.',
  actionZoneWidth: 'Largeur du cube transparent que le joueur peut traverser pour declencher l action.',
  actionZoneDepth: 'Profondeur du cube transparent que le joueur peut traverser pour declencher l action.',
  actionZoneModelHeight: 'Hauteur visible du cube transparent 3D.',
  targetCanvas: 'Canevas de destination utilise quand le joueur entre dans cette zone portail.',
  targetNpc: 'Personnage de carte concerne par l action PNJ declenchee dans cette zone.',
  zoneMessage: 'Texte ou cle d action associee a la zone, utile pour un dialogue, une interaction ou un script.',
  npcInteractionMode: 'Choisit entre un simple message PNJ et une question a choix multiples.',
  npcQuestion: 'Question affichee au joueur quand il declenche cette action PNJ.',
  npcChoice: 'Reponse selectionnable par le joueur dans le QCM du PNJ.',
  npcChoiceResponse: 'Retour affiche apres le choix. Il servira plus tard de consequence narrative.',
  zoneVisibility: 'Affiche ou masque le contour de debug au sol en plus du cube transparent.',
};

const Rpg3DHelpLabel = ({ children, help, className = '' }) => (
  <HelpLabel as="span" className={`builder3d-help-label${className ? ` ${className}` : ''}`} help={help}>{children}</HelpLabel>
);

const ARCADE_CHARACTER_PRESETS = [
  { id: 'runner', label: 'Aventurier', body: '#d7b56d', accent: '#67e8f9', face: '#f0c9a5', weapon: '#e0f7ff' },
  { id: 'knight', label: 'Chevalier', body: '#94a3b8', accent: '#f8fafc', face: '#e7c39e', weapon: '#cbd5e1' },
  { id: 'mage', label: 'Mage', body: '#8b5cf6', accent: '#c4b5fd', face: '#f0c9a5', weapon: '#f5d0fe' },
  { id: 'ranger', label: 'Rodeuse', body: '#22c55e', accent: '#86efac', face: '#e7c39e', weapon: '#bbf7d0' },
  { id: 'guard', label: 'Garde rouge', body: '#ef4444', accent: '#fca5a5', face: '#d8a47f', weapon: '#fecaca' },
  { id: 'sniper', label: 'Tireur jaune', body: '#facc15', accent: '#fde68a', face: '#e7c39e', weapon: '#fef3c7' },
  { id: 'brute', label: 'Brute orange', body: '#f97316', accent: '#fed7aa', face: '#c8875c', weapon: '#ffedd5' },
  { id: 'shadow', label: 'Ombre', body: '#64748b', accent: '#a78bfa', face: '#cbd5e1', weapon: '#ddd6fe' },
];

const PLAYER_CHARACTER_IDS = ['runner', 'knight', 'mage', 'ranger', 'shadow'];
const ENEMY_CHARACTER_IDS = ['guard', 'sniper', 'brute', 'shadow', 'knight', 'mage', 'ranger'];
const DEFAULT_ENEMY_CHARACTER_BY_ROLE = {
  rifle: 'guard',
  sniper: 'sniper',
  brute: 'brute',
};

const getCharacterPreset = (id = 'runner', fallbackId = 'runner') => (
  ARCADE_CHARACTER_PRESETS.find((preset) => preset.id === id)
  || ARCADE_CHARACTER_PRESETS.find((preset) => preset.id === fallbackId)
  || ARCADE_CHARACTER_PRESETS[0]
);

const getEnemyCharacterId = (enemy = {}) => enemy.character || DEFAULT_ENEMY_CHARACTER_BY_ROLE[enemy.role] || 'guard';
const getCharacterOptions = (ids) => ids.map((id) => getCharacterPreset(id));
const PLAYER_CHARACTER_OPTIONS = getCharacterOptions(PLAYER_CHARACTER_IDS);
const ENEMY_CHARACTER_OPTIONS = getCharacterOptions(ENEMY_CHARACTER_IDS);
const CHARACTER_RENDER_OPTIONS = [
  { id: 'capsule', label: 'Personnage volume' },
  { id: 'glb', label: 'Modele 3D' },
  { id: 'sprite', label: 'Image verticale' },
  { id: 'block', label: 'Bloc robot' },
  { id: 'boss', label: 'Boss creature' },
];
const RELIEF_STYLE_OPTIONS = [
  { id: 'plateau', label: 'Plateau', top: '#6f4a2e', edge: '#2d1d14', light: '#d19a55', shadow: 'rgba(5, 3, 2, .42)' },
  { id: 'ridge', label: 'Crete', top: '#6b5b45', edge: '#30281e', light: '#e7c16c', shadow: 'rgba(5, 3, 2, .48)' },
  { id: 'basin', label: 'Fosse', top: '#2f2119', edge: '#1a110d', light: '#8f623a', shadow: 'rgba(0, 0, 0, .52)' },
];
const NUMERIC_ENTITY_FIELDS = new Set([
  'x',
  'y',
  'z',
  'floorZeroZ',
  'w',
  'h',
  'r',
  'rotation',
  'characterModelScale',
  'characterModelScaleX',
  'characterModelScaleY',
  'characterModelScaleZ',
  'characterMaterialBrightness',
  'decorModelScale',
  'materialBrightness',
  'modelRotationX',
  'modelRotationY',
  'modelRotationZ',
  'modelHeight',
  'opacity',
  'elevation',
  'combatEnemyMaxHealth',
  'combatEnemyStrength',
  'combatEnemySpeed',
  'combatEnemyAttackSpeed',
  'combatEnemyCriticalChance',
  'combatEnemyCriticalMultiplier',
  'combatEnemyMaxMana',
  'combatEnemyPowerManaCost',
  'combatEnemyPowerDamage',
  'combatEnemyPowerUsageChance',
]);

const TOOL_OPTIONS = [
  { id: 'select', label: 'Selection', icon: MousePointer2 },
  { id: 'obstacle', label: 'Mur', icon: Square },
  { id: 'enemy', label: 'Ennemi', icon: Crosshair },
  { id: 'pickup', label: 'Bonus', icon: HeartPulse },
  { id: 'relief', label: 'Relief', icon: Mountain },
  { id: 'prop', label: 'Image 3D', icon: Box },
  { id: 'actionZone', label: 'Zone', icon: MousePointerClick },
  { id: 'terrainPaint', label: 'Peindre sol', icon: Paintbrush },
];

const TERRAIN_PAINT_SHAPE_OPTIONS = [
  { id: 'round', label: 'Rond', icon: Circle },
  { id: 'square', label: 'Carre', icon: Square },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
];

const STUDIO_CHARACTER_ROLE_LABELS = {
  hero: 'Heros',
  enemy: 'Ennemi',
  npc: 'PNJ',
};
const STUDIO_DECOR_KIND_LABELS = {
  billboard: 'décors',
  crate: 'mur',
  decor: 'décors',
  house: 'habitations',
  road: 'sol',
  rock: 'décors',
  tree: 'décors',
  wall: 'mur',
  water: 'eau',
};
const CHARACTER_IMPORT_GROUPS = [
  { id: 'hero', label: 'Heros' },
  { id: 'enemy', label: 'Ennemis' },
  { id: 'npc', label: 'PNJ' },
];
const DECOR_IMPORT_GROUPS = [
  { id: 'road', label: 'Sol' },
  { id: 'water', label: 'Eau' },
  { id: 'wall', label: 'Mur' },
  { id: 'house', label: 'Habitations' },
  { id: 'decor', label: 'Decors' },
];
const SELECTED_ENTITY_TYPE_LABELS = {
  hero: 'HEROS',
  enemy: 'ENNEMI',
  prop: 'OBJET',
  relief: 'RELIEF',
  obstacle: 'MUR',
  pickup: 'BONUS',
  actionZone: 'ZONE',
};
const MULTI_SELECT_ENTITY_TYPES = new Set(['hero', 'enemy', 'prop', 'relief', 'obstacle', 'pickup', 'actionZone']);
const ROTATABLE_ENTITY_TYPES = new Set(['hero', 'enemy', 'prop', 'actionZone']);
const MAP_ENTITY_META = {
  hero: { label: 'Heros carte', icon: Shield, tone: 'character' },
  enemy: { label: 'Personnage carte', icon: Crosshair, tone: 'character' },
  prop: { label: 'Objet carte', icon: Box, tone: 'decor' },
  relief: { label: 'Relief carte', icon: Mountain, tone: 'decor' },
  obstacle: { label: 'Mur carte', icon: Square, tone: 'neutral' },
  pickup: { label: 'Bonus carte', icon: HeartPulse, tone: 'neutral' },
  actionZone: { label: 'Zone transparente', icon: MousePointerClick, tone: 'neutral' },
};

const isEditableShortcutTarget = (target) => Boolean(
  target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'),
);
const isProtectedMapEntity = (config = {}, entity = {}) => {
  if (entity?.type !== 'prop' || !entity.id) return false;
  const prop = (config.props || []).find((item) => item.id === entity.id);
  return isFlatGroundPlateauProp(prop, config.world);
};
const getDeletableSelectionEntities = (config, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  const seen = new Set();
  return selection.filter((entity) => {
    if (!entity?.id || !MAP_ENTITY_COLLECTIONS[entity.type]) return false;
    if (isProtectedMapEntity(config, entity)) return false;
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const isDuplicableSelectionEntity = (entity = {}) => Boolean(
  entity?.id
  && MAP_ENTITY_COLLECTIONS[entity.type]
  && !(entity.type === 'prop' && isFlatGroundPlateauProp(entity.item)),
);

const createNewArcadeConfig = () => {
  const next = cloneConfig(DEFAULT_ARCADE_CONFIG);
  next.meta.title = 'Nouveau projet';
  next.obstacles = [];
  next.reliefs = [];
  next.heroes = [];
  next.props = [];
  next.enemies = [];
  next.pickups = [];
  next.actionZones = [];
  next.terrainPaintStrokes = [];
  next.player.x = Math.round(next.world.width * 0.5);
  next.player.y = Math.round(next.world.height * 0.5);
  next.player.health = next.player.maxHealth;
  next.player.mana = next.player.maxMana;
  return next;
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const vectorDistanceByFields = (a = {}, b = {}, fields = []) => {
  const values = fields.flatMap((field) => [Number(a[field]), Number(b[field])]);
  if (!values.every(Number.isFinite)) return null;
  return Math.hypot(
    Number(a[fields[0]]) - Number(b[fields[0]]),
    Number(a[fields[1]]) - Number(b[fields[1]]),
    Number(a[fields[2]]) - Number(b[fields[2]]),
  );
};
const modelEraserHitDistance = (a = {}, b = {}) => {
  const localSceneDistance = vectorDistanceByFields(a, b, ['localSceneX', 'localSceneY', 'localSceneZ']);
  if (localSceneDistance !== null) return localSceneDistance / ARCADE_WORLD_SCALE;
  const sceneDistance = vectorDistanceByFields(a, b, ['sceneX', 'sceneY', 'sceneZ']);
  if (sceneDistance !== null) return sceneDistance / ARCADE_WORLD_SCALE;
  return distance(a, b);
};
const normalizeModelEraserHit = (point = {}) => {
  const normalized = {
    x: Number(point.x),
    y: Number(point.y),
  };
  const sceneX = Number(point.sceneX);
  const sceneY = Number(point.sceneY);
  const sceneZ = Number(point.sceneZ);
  if ([sceneX, sceneY, sceneZ].every(Number.isFinite)) {
    normalized.sceneX = sceneX;
    normalized.sceneY = sceneY;
    normalized.sceneZ = sceneZ;
  }
  const localSceneX = Number(point.localSceneX);
  const localSceneY = Number(point.localSceneY);
  const localSceneZ = Number(point.localSceneZ);
  if ([localSceneX, localSceneY, localSceneZ].every(Number.isFinite)) {
    normalized.localSceneX = localSceneX;
    normalized.localSceneY = localSceneY;
    normalized.localSceneZ = localSceneZ;
  }
  const localMeshX = Number(point.localMeshX);
  const localMeshY = Number(point.localMeshY);
  const localMeshZ = Number(point.localMeshZ);
  if ([localMeshX, localMeshY, localMeshZ].every(Number.isFinite)) {
    normalized.localMeshX = localMeshX;
    normalized.localMeshY = localMeshY;
    normalized.localMeshZ = localMeshZ;
  }
  const surfaceIndex = Number(point.surfaceIndex);
  if (Number.isFinite(surfaceIndex)) normalized.surfaceIndex = Math.round(surfaceIndex);
  const materialIndex = Number(point.materialIndex);
  if (Number.isFinite(materialIndex)) normalized.materialIndex = Math.round(materialIndex);
  const uvX = Number(point.uvX);
  const uvY = Number(point.uvY);
  if (Number.isFinite(uvX) && Number.isFinite(uvY)) {
    normalized.uvX = uvX;
    normalized.uvY = uvY;
  }
  return normalized;
};
const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const getModelRotationValue = (item = {}, field = 'modelRotationX') => {
  const numeric = Number(item[field]);
  return clamp(Number.isFinite(numeric) ? numeric : 0, -180, 180);
};
const shouldAppendTerrainPaintPoint = (stroke = {}, point = {}) => {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  const previous = points[points.length - 1];
  if (!previous) return true;
  const spacing = Math.max(10, getTerrainPaintRadius(stroke) * 0.18);
  return distance(previous, point) >= spacing;
};
const getEntityRotation = (item = {}) => normalizeDegrees(item.rotation || 0);
const isCountedMapProp = (prop = {}, config = {}) => !isFlatGroundPlateauProp(prop, config.world);
const getCountedMapProps = (config = {}) => (config.props || []).filter((prop) => isCountedMapProp(prop, config));
const getArcadeObjectCount = (config = {}) => (config.obstacles?.length || 0)
  + (config.reliefs?.length || 0)
  + (config.heroes?.length || 0)
  + getCountedMapProps(config).length
  + (config.enemies?.length || 0)
  + (config.pickups?.length || 0)
  + (config.actionZones?.length || 0);
const getArcadeImportPoint = (config, index = 0) => {
  const grid = Math.max(90, Number(config.world?.grid) || DEFAULT_ARCADE_CONFIG.world.grid);
  const angle = (index % 8) * (Math.PI / 4);
  const radius = grid * (1.25 + Math.floor(index / 8) * 0.45);
  const baseX = Number(config.player?.x) || (config.world.width / 2);
  const baseY = Number(config.player?.y) || (config.world.height / 2);
  return {
    x: Math.round(clamp(baseX + Math.cos(angle) * radius, 40, config.world.width - 40)),
    y: Math.round(clamp(baseY + Math.sin(angle) * radius, 40, config.world.height - 40)),
  };
};
const getCharacterRenderMode = (actor = {}) => actor.characterRenderMode || 'capsule';
const getCharacterRenderLabel = (actor = {}) => CHARACTER_RENDER_OPTIONS.find((option) => option.id === getCharacterRenderMode(actor))?.label || 'Personnage volume';
const getStudioMaterialBrightness = (model = {}) => {
  const value = Number(model.materialBrightness);
  return clamp(Number.isFinite(value) ? value : 1, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
};
const getHeroCharacterId = (hero = {}) => hero.character || 'runner';
const canEntityLevitate = (type = '') => ['hero', 'enemy', 'prop', 'pickup', 'obstacle'].includes(type);
const getSelectedEntityTypeLabel = (selectedEntity = {}) => (
  SELECTED_ENTITY_TYPE_LABELS[selectedEntity.type] || String(selectedEntity.type || '').toUpperCase()
);
const canMultiSelectEntity = (entity = {}) => Boolean(entity?.id && MULTI_SELECT_ENTITY_TYPES.has(entity.type));
const getStudioCharacterRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.shape === 'robot') return 'block';
  if (model.shape === 'creature') return 'boss';
  return 'capsule';
};
const getDecorImportRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (isFloorDecorKind(model.kind)) return 'floor';
  if (model.kind === 'wall') return 'box';
  if (model.kind === 'house') return 'house';
  if (model.imageData) return 'billboard';
  return 'rock';
};
const getDecorModelWorldSize = (model = {}) => {
  const modelScale = getDecorModelScale(model);
  const width = Math.round(clamp(((Number(model.width) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const depth = Math.round(clamp(((Number(model.depth) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const modelHeight = Number(model.height) || 1.2;
  const height = Math.round(clamp((modelHeight * modelScale) / ARCADE_WORLD_SCALE, 12, 9000));
  if (isFloorDecorKind(model.kind) && !getStudioModelSource(model)) {
    const tileSize = Math.max(width, depth);
    return { width: tileSize, depth: tileSize, height: Math.max(12, height) };
  }
  return { width, depth, height };
};
const getPlacementCameraDistance = (config = {}, entity = null) => {
  const defaultDistance = DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
  if (!entity?.type || !entity.id) return defaultDistance;
  const selectedEntity = getSelectedEntity(config, entity);
  if (!selectedEntity?.item) return defaultDistance;
  if (['hero', 'enemy'].includes(entity.type)) return CHARACTER_PLACEMENT_CAMERA_DISTANCE;
  return defaultDistance;
};
const applyCharacterModelScaleToActor = (actor, model = null) => {
  const axisScale = model ? getCharacterModelAxisScale(model) : { x: 1, y: 1, z: 1 };
  actor.characterModelScale = axisScale.y;
  actor.characterModelScaleX = axisScale.x;
  actor.characterModelScaleY = axisScale.y;
  actor.characterModelScaleZ = axisScale.z;
  actor.characterModelScaleProportional = model ? model.characterModelScaleProportional !== false : true;
};
const applyCharacterModelToActor = (actor, model = null) => {
  if (!model || !getStudioModelSource(model)) {
    actor.characterModel3dId = '';
    actor.characterModelUrl = '';
    actor.characterModelName = '';
    actor.characterModelFormat = '';
    actor.characterModelFileSize = 0;
    actor.characterModelResources = [];
    actor.characterModelAnimations = {};
    actor.characterLocalModelFileId = '';
    actor.characterRenderMode = model ? getStudioCharacterRenderMode(model) : 'capsule';
    applyCharacterModelScaleToActor(actor, model);
    actor.characterMaterialBrightness = model ? getStudioMaterialBrightness(model) : 1;
    return;
  }
  actor.characterModel3dId = model.id || '';
  actor.characterModelUrl = getStudioModelSource(model);
  actor.characterModelName = model.modelName || model.name || 'modele.glb';
  actor.characterModelFormat = model.modelFormat || '';
  actor.characterModelFileSize = Number(model.modelFileSize) || 0;
  actor.characterModelResources = Array.isArray(model.modelResources) ? model.modelResources : [];
  actor.characterModelAnimations = getPersistedModelAnimations(model, { preferLocalBlob: true });
  actor.characterLocalModelFileId = model.localModelFileId || '';
  actor.characterRenderMode = 'glb';
  applyCharacterModelScaleToActor(actor, model);
  actor.characterMaterialBrightness = getStudioMaterialBrightness(model);
};
const guessCharacterRenderMode = (fileName = '') => {
  const name = fileName.toLowerCase();
  if (/(boss|dragon|monster|monstre|creature|golem|geant|giant)/.test(name)) return 'boss';
  if (/(robot|mecha|android|armure|armor|drone)/.test(name)) return 'block';
  if (/(sprite|flat|portrait|icone|icon|token)/.test(name)) return 'sprite';
  return 'capsule';
};
const ensureEngineConfig = (config) => {
  config.engine = { ...DEFAULT_ARCADE_CONFIG.engine, ...(config.engine || {}) };
  return config.engine;
};

const readArcadeImageFile = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve('');
  if (!file.type?.startsWith('image/')) return reject(new Error('Le fichier selectionne doit etre une image.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(reader.error || new Error("Impossible de charger l'image."));
  reader.readAsDataURL(file);
});

const createNpcChoice = (label = 'Reponse', response = '') => ({
  id: createId('npc-choice'),
  label,
  response,
});
const createDefaultNpcChoices = () => [
  createNpcChoice('Demander un indice', 'Le PNJ donne un indice.'),
  createNpcChoice('Poser une question', 'Le PNJ repond avec prudence.'),
  createNpcChoice('Partir', 'La discussion se termine.'),
];
const getNpcInteractionMode = (zone = {}) => (
  zone.npcInteractionMode || (Array.isArray(zone.npcChoices) && zone.npcChoices.length ? 'multipleChoice' : 'message')
);
const getNpcChoiceItems = (zone = {}) => {
  const choices = Array.isArray(zone.npcChoices) ? zone.npcChoices : [];
  if (!choices.length) {
    return [
      { id: `${zone.id || 'npc'}-choice-1`, label: 'Demander un indice', response: zone.message || 'Le PNJ donne un indice.' },
      { id: `${zone.id || 'npc'}-choice-2`, label: 'Poser une question', response: 'Le PNJ repond avec prudence.' },
      { id: `${zone.id || 'npc'}-choice-3`, label: 'Partir', response: 'La discussion se termine.' },
    ];
  }
  return choices.map((choice, index) => {
    if (typeof choice === 'string') {
      return { id: `${zone.id || 'npc'}-choice-${index + 1}`, label: choice, response: '' };
    }
    return {
      id: choice.id || `${zone.id || 'npc'}-choice-${index + 1}`,
      label: choice.label || `Reponse ${index + 1}`,
      response: choice.response || '',
    };
  });
};
const getNpcQuestionText = (zone = {}) => (
  zone.npcQuestion || zone.message || 'Que veux-tu demander ?'
);
const getActionZoneNpcLabel = (config = {}, targetNpcId = '') => {
  const hero = (config.heroes || []).find((item) => item.id === targetNpcId);
  if (hero) return hero.name || 'Heros';
  const enemy = (config.enemies || []).find((item) => item.id === targetNpcId);
  if (enemy) return enemy.combatEnemyName || enemy.name || 'Personnage';
  return 'PNJ';
};
const guessPropRenderMode = (fileName = '') => {
  const name = fileName.toLowerCase();
  if (/(route|road|chemin|path|rue|street|sol|floor|terrain)/.test(name)) return 'floor';
  if (/(maison|house|cabane|hut|building|batiment)/.test(name)) return 'house';
  if (/(rocher|rock|stone|pierre|boulder)/.test(name)) return 'rock';
  return 'billboard';
};
const shouldPropBlockByMode = (mode) => ['box', 'rock', 'house'].includes(mode);
const getReliefStyle = (id = 'plateau') => RELIEF_STYLE_OPTIONS.find((option) => option.id === id) || RELIEF_STYLE_OPTIONS[0];

const getCommonSelectionNumericValue = (entities = [], getter = () => 0, precision = 0) => {
  if (!entities.length) return '';
  const factor = 10 ** Math.max(0, Number(precision) || 0);
  const values = entities.map((entity) => {
    const value = Number(getter(entity));
    const finiteValue = Number.isFinite(value) ? value : 0;
    return Math.round(finiteValue * factor) / factor;
  });
  const first = values[0];
  return values.every((value) => value === first) ? first : '';
};

const getSelectionDuplicateOffset = (entities = [], world = {}) => {
  const baseOffset = Math.max(48, Number(world.grid) || DEFAULT_ARCADE_CONFIG.world.grid);
  const bounds = getSelectionBoundsFromEntities(entities);
  if (!bounds) return { x: baseOffset, y: baseOffset };
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const fitOffset = (proposed, min, max, limit) => {
    let nextOffset = proposed;
    if (max + nextOffset > limit) nextOffset = limit - max;
    if (min + nextOffset < 0) nextOffset = -min;
    return Math.round(nextOffset);
  };
  return {
    x: fitOffset(baseOffset, bounds.minX, bounds.maxX, worldWidth),
    y: fitOffset(baseOffset, bounds.minY, bounds.maxY, worldHeight),
  };
};

const getMapEntityEditableName = (type, item = {}) => (
  type === 'enemy' ? (item.combatEnemyName || item.name || '') : (item.name || '')
);

const getMapEntityFallbackName = (type, index) => ({
  hero: `Heros ${index + 1}`,
  enemy: `Ennemi ${index + 1}`,
  prop: `Decor ${index + 1}`,
  relief: `Relief ${index + 1}`,
  obstacle: `Mur ${index + 1}`,
  pickup: `Bonus ${index + 1}`,
  actionZone: `Zone ${index + 1}`,
}[type] || `Element ${index + 1}`);

const getMapEntitySubtitle = (type, item = {}) => {
  if (type === 'hero') {
    const preset = getCharacterPreset(getHeroCharacterId(item), 'runner');
    const visual = item.characterModelName
      || (item.characterImageData ? item.characterImageName || 'Image personnalisee' : getCharacterRenderLabel(item));
    return `${preset.label} - ${visual}`;
  }
  if (type === 'enemy') {
    const preset = getCharacterPreset(getEnemyCharacterId(item), 'guard');
    const visual = item.characterModelName
      || (item.characterImageData ? item.characterImageName || 'Image personnalisee' : getCharacterRenderLabel(item));
    return `${preset.label} - ${visual}`;
  }
  if (type === 'prop') {
    return `${getPropRenderMode(item)} - ${item.blocksMovement ? 'Bloquant' : 'Traversable'}`;
  }
  if (type === 'relief') {
    return `${item.style || 'plateau'} - ${Math.round(getReliefWidth(item))} x ${Math.round(getReliefHeight(item))}`;
  }
  if (type === 'obstacle') {
    return `${Math.round(Number(item.w) || 0)} x ${Math.round(Number(item.h) || 0)}`;
  }
  if (type === 'pickup') {
    return item.type === 'mana' ? 'Mana' : 'Soin';
  }
  if (type === 'actionZone') {
    return getActionZoneType(item) === 'npcAction' ? 'Action PNJ' : 'Portail canevas';
  }
  return 'Element';
};

const normalizeAssetExplorerText = (value = '') => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getUniqueManagementEntities = (entities = [], selected = null) => {
  const orderedKeys = [];
  const entitiesByKey = new Map();
  entities.forEach((entry) => {
    const name = getMapEntityEditableName(entry.type, entry.item).trim();
    const key = name
      ? `${entry.type}:${normalizeAssetExplorerText(name)}`
      : `${entry.type}:${entry.item?.id || entry.index}`;
    const current = entitiesByKey.get(key);
    if (!current) orderedKeys.push(key);
    if (!current || (selected?.type === entry.type && selected.id === entry.item?.id)) {
      entitiesByKey.set(key, entry);
    }
  });
  return orderedKeys.map((key) => entitiesByKey.get(key)).filter(Boolean);
};

const countExplorerAssets = (nodes = []) => nodes.reduce((count, node) => (
  count + (node.type === 'asset' ? 1 : node.count || 0)
), 0);

const getExplorerCountLabel = (count) => `${count} fichier${count > 1 ? 's' : ''}`;
const getImportGroup = (groups, groupId, fallbackLabel) => (
  groups.find((group) => group.id === groupId) || { id: groupId, label: fallbackLabel }
);
const getCharacterImportRoleId = (model = {}) => (
  CHARACTER_IMPORT_GROUPS.some((group) => group.id === model.role) ? model.role : 'npc'
);
const getDecorImportKindId = (model = {}) => {
  const kind = getStudioDecorKindId(model.kind);
  if (DECOR_IMPORT_GROUPS.some((group) => group.id === kind) && kind !== 'decor') return kind;
  const haystack = normalizeAssetExplorerText([
    model.name,
    model.modelName,
    model.imageName,
    model.kind,
  ].filter(Boolean).join(' '));
  if (/(eau|water|river|riviere|lac|lake|mer|sea|ocean|canal|mare|pool|bassin)/.test(haystack)) return 'water';
  if (/(maison|house|cabane|hut|building|batiment|cottage|habitation|stonegate)/.test(haystack)) return 'house';
  if (/(mur|wall|brick|brique|stone|pierre|beton|concrete|fence|barriere|rempart|cloison)/.test(haystack)) return 'wall';
  if (/(sol|floor|ground|terrain|terre|soil|herbe|grass|gazon|route|road|chemin|path|dalle|pave|tile|square|verdant|brown_soil|brown soil)/.test(haystack)) return 'road';
  return DECOR_IMPORT_GROUPS.some((group) => group.id === kind) ? kind : 'decor';
};
const getCharacterImportSubtitle = (model = {}) => (
  `${STUDIO_CHARACTER_ROLE_LABELS[model.role] || 'Heros'} - ${getStudioModelSource(model) ? (model.modelName || 'Modele 3D') : 'Personnage volume'}`
);
const getDecorImportSubtitle = (model = {}) => {
  const renderMode = getDecorImportRenderMode(model);
  const kindLabel = STUDIO_DECOR_KIND_LABELS[getStudioDecorKindId(model.kind)] || renderMode;
  return getStudioModelSource(model)
    ? `${kindLabel} - ${model.modelName || 'Modele 3D'}`
    : kindLabel;
};
const compareAssetExplorerNodes = (left, right) => (
  String(left.label || '').localeCompare(String(right.label || ''), 'fr', { sensitivity: 'base' })
);

const makeAssetExplorerAsset = ({ id, label, subtitle, tone, icon, model, onImport, pathLabel }) => ({
  type: 'asset',
  id,
  label,
  subtitle,
  tone,
  icon,
  model,
  onImport,
  searchText: normalizeAssetExplorerText([
    label,
    subtitle,
    pathLabel,
    model?.modelName,
    model?.imageName,
  ].filter(Boolean).join(' ')),
});

const makeAssetExplorerFolder = ({ id, label, tone, children }) => {
  const count = countExplorerAssets(children);
  return {
    type: 'folder',
    id,
    label,
    tone,
    children,
    count,
    searchText: normalizeAssetExplorerText([label, ...children.map((child) => child.searchText || child.label)].join(' ')),
  };
};

const buildAssetExplorerRoot = ({
  id,
  label,
  tone,
  items = [],
  groupOptions,
  getGroupId,
  createAsset,
  showEmptyGroups = false,
}) => {
  const groups = new Map();
  items.forEach((item) => {
    const groupId = getGroupId(item);
    if (!groups.has(groupId)) groups.set(groupId, []);
    const group = getImportGroup(groupOptions, groupId, 'Autres');
    groups.get(groupId).push(createAsset(item, group.label));
  });

  const children = groupOptions
    .map((group) => {
      const assets = (groups.get(group.id) || []).sort(compareAssetExplorerNodes);
      if (!assets.length) {
        return showEmptyGroups
          ? makeAssetExplorerFolder({
            id: `${id}:${group.id}`,
            label: group.label,
            tone,
            children: [],
          })
          : null;
      }
      return makeAssetExplorerFolder({
        id: `${id}:${group.id}`,
        label: group.label,
        tone,
        children: assets,
      });
    })
    .filter(Boolean);

  return makeAssetExplorerFolder({ id, label, tone, children });
};

const filterAssetExplorerNode = (node, query) => {
  if (!query) return node;
  if (node.type === 'asset') return node.searchText.includes(query) ? node : null;
  const folderMatches = normalizeAssetExplorerText(node.label).includes(query);
  const children = folderMatches
    ? node.children
    : node.children.map((child) => filterAssetExplorerNode(child, query)).filter(Boolean);
  if (!children.length) return null;
  return { ...node, children, count: countExplorerAssets(children) };
};

function ArcadeManagementRow({
  Icon,
  tone = 'neutral',
  active = false,
  label,
  name,
  placeholder,
  thumbnail,
  onEdit,
  onDelete,
}) {
  const displayName = name || placeholder || label;
  return (
    <article className={`arcade-management-row ${active ? 'active' : ''}`}>
      <span className={`arcade-management-thumb ${tone}`}>
        {thumbnail ? <img src={thumbnail} alt="" /> : <Icon aria-hidden="true" size={18} />}
      </span>
      <div className="arcade-management-main">
        <strong>{displayName}</strong>
      </div>
      <div className="arcade-management-actions">
        <button type="button" className="secondary-action compact" onClick={onEdit}>
          <MousePointer2 aria-hidden="true" size={15} />
          <span>Editer</span>
        </button>
        <button type="button" className="danger-button compact" onClick={onDelete}>
          <Trash2 aria-hidden="true" size={15} />
          <span>Supprimer</span>
        </button>
      </div>
    </article>
  );
}

function ArcadeManagementSection({ title, count, actions = null, emptyLabel, children }) {
  return (
    <section className="panel arcade-management-panel">
      <div className="panel-head">
        <div>
          <span className="section-kicker">{count}</span>
          <h2>{title}</h2>
        </div>
        {actions ? <div className="arcade-management-section-actions">{actions}</div> : null}
      </div>
      {count ? (
        <div className="arcade-management-list">{children}</div>
      ) : (
        <div className="empty-state-inline">{emptyLabel}</div>
      )}
    </section>
  );
}

function ArcadeMapAssetExplorerNode({
  node,
  depth = 0,
  openFolders,
  forceOpen = false,
  onToggleFolder,
}) {
  if (node.type === 'asset') {
    const Icon = node.icon || Box;
    const label = node.label || 'Fichier';
    return (
      <button
        type="button"
        className="arcade-map-explorer-row arcade-map-explorer-file"
        style={{ '--asset-depth': depth }}
        onClick={() => node.onImport?.(node.model)}
        aria-label={`Importer ${label} dans le canvas`}
        title={`Importer ${label} dans le canvas`}
      >
        <span className="arcade-map-explorer-elbow" aria-hidden="true" />
        <span className={`arcade-map-import-thumb ${node.tone}`}>
          {node.tone === 'decor' && node.model?.imageData ? <img src={node.model.imageData} alt="" /> : <Icon aria-hidden="true" size={14} />}
        </span>
        <span className="arcade-map-explorer-label">
          <strong>{label}</strong>
          <small>{node.subtitle}</small>
        </span>
        <span className="arcade-map-explorer-add" aria-hidden="true"><Plus size={14} /></span>
      </button>
    );
  }

  const isOpen = forceOpen || openFolders.has(node.id);
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className="arcade-map-explorer-branch">
      <button
        type="button"
        className="arcade-map-explorer-row arcade-map-explorer-folder"
        style={{ '--asset-depth': depth }}
        onClick={() => onToggleFolder(node.id)}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Fermer' : 'Ouvrir'} ${node.label}`}
      >
        <ChevronIcon className="arcade-map-explorer-chevron" aria-hidden="true" size={14} />
        <span className={`arcade-map-explorer-folder-icon ${node.tone}`}>
          <FolderIcon aria-hidden="true" size={16} />
        </span>
        <span className="arcade-map-explorer-label">
          <strong>{node.label}</strong>
        </span>
        <small className="arcade-map-explorer-count">{getExplorerCountLabel(node.count)}</small>
      </button>
      {isOpen ? (
        <div className="arcade-map-explorer-children">
          {node.children.map((child) => (
            <ArcadeMapAssetExplorerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openFolders={openFolders}
              forceOpen={forceOpen}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArcadeMapAssetExplorer({
  characters,
  decors,
  onImportCharacter,
  onImportDecor,
}) {
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState(() => new Set(['characters', 'decors']));
  const normalizedQuery = useMemo(() => normalizeAssetExplorerText(query.trim()), [query]);
  const roots = useMemo(() => {
    const characterRoot = buildAssetExplorerRoot({
      id: 'characters',
      label: 'Personnages crees',
      tone: 'character',
      items: characters,
      groupOptions: CHARACTER_IMPORT_GROUPS,
      getGroupId: getCharacterImportRoleId,
      createAsset: (model, pathLabel) => makeAssetExplorerAsset({
        id: `character:${model.id}`,
        label: model.name || 'Personnage 3D',
        subtitle: getCharacterImportSubtitle(model),
        tone: 'character',
        icon: Sword,
        model,
        onImport: onImportCharacter,
        pathLabel,
      }),
    });
    const decorRoot = buildAssetExplorerRoot({
      id: 'decors',
      label: 'Objets crees',
      tone: 'decor',
      items: decors,
      groupOptions: DECOR_IMPORT_GROUPS,
      getGroupId: getDecorImportKindId,
      showEmptyGroups: true,
      createAsset: (model, pathLabel) => makeAssetExplorerAsset({
        id: `decor:${model.id}`,
        label: model.name || 'Objet 3D',
        subtitle: getDecorImportSubtitle(model),
        tone: 'decor',
        icon: Box,
        model,
        onImport: onImportDecor,
        pathLabel,
      }),
    });
    return [characterRoot, decorRoot].filter((root) => root.count > 0);
  }, [characters, decors, onImportCharacter, onImportDecor]);
  const visibleRoots = useMemo(() => (
    roots.map((root) => filterAssetExplorerNode(root, normalizedQuery)).filter(Boolean)
  ), [normalizedQuery, roots]);
  const assetCount = countExplorerAssets(roots);
  const visibleAssetCount = countExplorerAssets(visibleRoots);
  const forceOpen = Boolean(normalizedQuery);
  const toggleFolder = useCallback((folderId) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  return (
    <div className="arcade-map-imports" aria-label="Importer des elements crees dans le canvas">
      <div className="arcade-map-explorer-head">
        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.assetFiles}>Fichiers</Rpg3DHelpLabel>
        <small>{normalizedQuery ? getExplorerCountLabel(visibleAssetCount) : getExplorerCountLabel(assetCount)}</small>
      </div>
      <label className="arcade-map-explorer-search">
        <Search aria-hidden="true" size={14} />
        <input
          type="search"
          value={query}
          aria-label="Rechercher un fichier"
          placeholder="Rechercher un fichier"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {assetCount ? (
        visibleRoots.length ? (
          <div className="arcade-map-explorer-tree">
            {visibleRoots.map((root) => (
              <ArcadeMapAssetExplorerNode
                key={root.id}
                node={root}
                openFolders={openFolders}
                forceOpen={forceOpen}
                onToggleFolder={toggleFolder}
              />
            ))}
          </div>
        ) : (
          <p className="arcade-map-import-empty">Aucun fichier trouve.</p>
        )
      ) : (
        <p className="arcade-map-import-empty">Aucun fichier cree.</p>
      )}
    </div>
  );
}

function ArcadeCanvasManagerTreeLegacy({
  sourceProject,
  studioProject,
  currentConfig,
  activeCanvasId,
  onCreateCanvas,
  onSelectCanvas,
  onDeleteCanvas,
  onKeepOnlyActiveCanvas,
  onOpenCanvas,
}) {
  const structure = useMemo(
    () => getRpg3DCanvasStructure(sourceProject, studioProject),
    [sourceProject, studioProject],
  );
  const canvases = useMemo(() => (
    structure.canvases.map((canvas) => (
      canvas.id === activeCanvasId ? { ...canvas, config: cloneConfig(currentConfig) } : canvas
    ))
  ), [activeCanvasId, currentConfig, structure.canvases]);
  const canvasCount = canvases.length;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId) || canvases[0] || getActiveRpg3DCanvas(studioProject);
  const activeConfig = activeCanvas?.config || currentConfig || DEFAULT_ARCADE_CONFIG;
  const [collapsedActIds, setCollapsedActIds] = useState(() => new Set());
  const [collapsedSceneIds, setCollapsedSceneIds] = useState(() => new Set());
  const [focusedSceneId, setFocusedSceneId] = useState(activeCanvas?.sceneId || structure.scenes[0]?.id || '');
  const sceneIdsWithCanvas = useMemo(() => new Set(canvases.map((canvas) => canvas.sceneId).filter(Boolean)), [canvases]);

  useEffect(() => {
    if (activeCanvas?.sceneId) setFocusedSceneId(activeCanvas.sceneId);
  }, [activeCanvas?.sceneId]);

  const selectedScene = structure.scenes.find((scene) => scene.id === focusedSceneId)
    || structure.scenes.find((scene) => scene.id === activeCanvas?.sceneId)
    || structure.scenes[0]
    || null;
  const selectedAct = structure.acts.find((act) => act.id === selectedScene?.actId)
    || structure.acts.find((act) => act.id === activeCanvas?.actId)
    || structure.acts[0]
    || null;
  const activeObjectCount = getArcadeObjectCount(activeConfig);
  const activeCanvasCanDelete = canvasCount > 1;

  const toggleSceneCollapsed = (event, sceneId) => {
    event.stopPropagation();
    setCollapsedSceneIds((current) => {
      const next = new Set(current);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const renderSceneTree = (actScenes, parentSceneId = '', depth = 0) => {
    const nodes = actScenes.filter((scene) => (scene.parentSceneId || '') === parentSceneId);
    if (!nodes.length) return null;
    return (
      <div className={depth ? 'scene-children-list' : ''}>
        {nodes.map((scene) => {
          const sceneCanvases = canvases.filter((canvas) => canvas.sceneId === scene.id);
          const childScenes = actScenes.filter((entry) => entry.parentSceneId === scene.id);
          const hasChildren = childScenes.length > 0 || sceneCanvases.length > 0;
          const collapsed = collapsedSceneIds.has(scene.id);
          const sceneIsSelected = selectedScene?.id === scene.id || sceneCanvases.some((canvas) => canvas.id === activeCanvasId);
          return (
            <div key={scene.id} className={`scene-tree-node ${hasChildren ? 'has-children' : ''}`} style={{ '--scene-depth': depth }}>
              <div className={`scene-summary arcade-canvas-scene-summary ${sceneIsSelected ? 'selected' : ''}`}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="scene-collapse-button"
                    aria-label={collapsed ? 'Afficher les canevas' : 'Masquer les canevas'}
                    aria-expanded={!collapsed}
                    onClick={(event) => toggleSceneCollapsed(event, scene.id)}
                  >
                    {collapsed ? '▸' : '▾'}
                  </button>
                ) : (
                  <span className="scene-collapse-spacer" />
                )}
                <button
                  type="button"
                  className="scene-select-button"
                  onClick={() => {
                    setFocusedSceneId(scene.id);
                    if (sceneCanvases[0]) onSelectCanvas(sceneCanvases[0].id);
                  }}
                >
                  <span className="scene-title-line">
                    <strong>{scene.name}</strong>
                    <small>{sceneCanvases.length} canevas</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="arcade-canvas-scene-add"
                  title={`Creer un canevas dans ${scene.name}`}
                  aria-label={`Creer un canevas dans ${scene.name}`}
                  onClick={() => {
                    setFocusedSceneId(scene.id);
                    onCreateCanvas({ actId: scene.actId, sceneId: scene.id, sceneName: scene.name });
                  }}
                >
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
              {hasChildren && !collapsed ? (
                <div className="scene-children arcade-canvas-scene-children">
                  {sceneCanvases.length ? (
                    <div className="arcade-canvas-file-list">
                      {sceneCanvases.map((canvas) => {
                        const isActive = canvas.id === activeCanvasId;
                        const canvasConfig = isActive ? currentConfig : canvas.config;
                        const objectCount = getArcadeObjectCount(canvasConfig || DEFAULT_ARCADE_CONFIG);
                        return (
                          <div key={canvas.id} className={`arcade-canvas-file-row ${isActive ? 'active' : ''}`}>
                            <button
                              type="button"
                              className="arcade-canvas-file-select"
                              onClick={() => {
                                setFocusedSceneId(scene.id);
                                onSelectCanvas(canvas.id);
                              }}
                            >
                              <MapIcon aria-hidden="true" size={14} />
                              <span>
                                <strong>{canvas.name || 'Canevas'}</strong>
                                <small>{objectCount} objet{objectCount > 1 ? 's' : ''}</small>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="arcade-canvas-file-delete"
                              title={`Supprimer ${canvas.name || 'ce canevas'}`}
                              aria-label={`Supprimer ${canvas.name || 'ce canevas'}`}
                              onClick={() => onDeleteCanvas(canvas.id)}
                              disabled={canvasCount <= 1}
                            >
                              <Trash2 aria-hidden="true" size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {renderSceneTree(actScenes, scene.id, depth + 1)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="arcade-canvas-manager-tab" aria-label="Gestion des canevas RPG 3D">
      <section className="panel side panel-nav-pro scene-left-nav arcade-canvas-nav">
        <div className="scene-nav-section">
          <div className="scene-nav-section-head">
            <div>
              <span className="section-kicker">Navigation</span>
              <h2>Canevas</h2>
              <small>{canvasCount} canevas</small>
            </div>
            <div className="toolbar compact-toolbar scene-nav-actions">
              <button
                type="button"
                onClick={() => onCreateCanvas({
                  actId: selectedAct?.id || structure.acts[0]?.id,
                  sceneId: selectedScene?.id || structure.scenes[0]?.id,
                  sceneName: selectedScene?.name || '',
                })}
              >
                + Canevas
              </button>
            </div>
          </div>

          <div className="scene-nav-list arcade-canvas-nav-list">
            {structure.acts.map((act) => {
              const actScenes = structure.scenes.filter((scene) => scene.actId === act.id && sceneIdsWithCanvas.has(scene.id));
              const actCanvasCount = canvases.filter((canvas) => canvas.actId === act.id).length;
              if (!actCanvasCount && !actScenes.length) return null;
              const collapsed = collapsedActIds.has(act.id);
              return (
                <details
                  key={act.id}
                  className="act-group"
                  open={!collapsed}
                  onToggle={(event) => {
                    setCollapsedActIds((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.open) next.delete(act.id);
                      else next.add(act.id);
                      return next;
                    });
                  }}
                >
                  <summary className="act-heading arcade-canvas-act-heading">
                    <strong>{act.name}</strong>
                    <span className="act-heading-meta">{actCanvasCount} canevas</span>
                    <span className="scene-collapse-spacer" />
                  </summary>
                  <div className="scene-tree-menu">
                    {actScenes.length ? renderSceneTree(actScenes) : <p className="small-note">Aucune scene dans cet acte.</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel main panel-main-pro arcade-canvas-main">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Edition</span>
            <h2>Canevas RPG 3D</h2>
          </div>
          {selectedAct ? <span className="status-badge soft">{selectedAct.name}</span> : null}
        </div>

        <div className="editor-stack">
          <div className="subpanel scene-compact-card">
            <div className="subpanel-head">
              <h3>General & structure</h3>
              <div className="inline-actions end">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => onCreateCanvas({
                    actId: selectedAct?.id || activeCanvas?.actId,
                    sceneId: selectedScene?.id || activeCanvas?.sceneId,
                    sceneName: selectedScene?.name || '',
                  })}
                >
                  Nouveau canevas
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeleteCanvas(activeCanvas.id)}
                  disabled={!activeCanvasCanDelete}
                >
                  Supprimer
                </button>
                {activeCanvasCanDelete ? (
                  <button type="button" className="danger-button" onClick={onKeepOnlyActiveCanvas}>
                    Garder ce canevas
                  </button>
                ) : null}
              </div>
            </div>

            <div className="arcade-canvas-detail-grid">
              <div>
                <small>Canevas actif</small>
                <strong>{activeCanvas?.name || 'Canevas'}</strong>
              </div>
              <div>
                <small>Acte</small>
                <strong>{selectedAct?.name || 'Sans acte'}</strong>
              </div>
              <div>
                <small>Scene</small>
                <strong>{selectedScene?.name || 'Sans scene'}</strong>
              </div>
              <div>
                <small>Taille</small>
                <strong>{activeConfig?.world?.width || DEFAULT_ARCADE_CONFIG.world.width} x {activeConfig?.world?.height || DEFAULT_ARCADE_CONFIG.world.height}</strong>
              </div>
              <div>
                <small>Objets</small>
                <strong>{activeObjectCount}</strong>
              </div>
            </div>

            <div className="inline-actions">
              <button
                type="button"
                className="button like"
                onClick={() => {
                  if (activeCanvas?.id) onSelectCanvas(activeCanvas.id);
                  onOpenCanvas?.();
                }}
              >
                <MapIcon aria-hidden="true" size={15} />
                Ouvrir dans Carte RPG 3D
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function ArcadeCanvasManagerTab({
  studioProject,
  currentConfig,
  activeCanvasId,
  onCreateAct,
  onRenameAct,
  onDeleteAct,
  onCreateCanvas,
  onRenameCanvas,
  onMoveCanvasToAct,
  onSelectCanvas,
  onDeleteCanvas,
  onKeepOnlyActiveCanvas,
  onOpenCanvas,
}) {
  const structure = useMemo(() => getRpg3DCanvasStructure(studioProject), [studioProject]);
  const canvases = useMemo(() => (
    structure.canvases.map((canvas) => (
      canvas.id === activeCanvasId ? { ...canvas, config: cloneConfig(currentConfig) } : canvas
    ))
  ), [activeCanvasId, currentConfig, structure.canvases]);
  const canvasCount = canvases.length;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId)
    || canvases[0]
    || getActiveRpg3DCanvas(studioProject);
  const activeConfig = activeCanvas?.config || currentConfig || DEFAULT_ARCADE_CONFIG;
  const [collapsedActIds, setCollapsedActIds] = useState(() => new Set());
  const [selectedActId, setSelectedActId] = useState(activeCanvas?.actId || structure.acts[0]?.id || '');

  useEffect(() => {
    if (!structure.acts.length) return;
    const nextSelectedId = structure.acts.some((act) => act.id === selectedActId)
      ? selectedActId
      : activeCanvas?.actId || structure.acts[0]?.id || '';
    if (nextSelectedId !== selectedActId) setSelectedActId(nextSelectedId);
  }, [activeCanvas?.actId, selectedActId, structure.acts]);

  const selectedAct = structure.acts.find((act) => act.id === selectedActId)
    || structure.acts.find((act) => act.id === activeCanvas?.actId)
    || structure.acts[0]
    || null;
  const canvasesByAct = useMemo(() => {
    const grouped = new Map(structure.acts.map((act) => [act.id, []]));
    const fallbackActId = structure.acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
    canvases.forEach((canvas) => {
      const targetActId = grouped.has(canvas.actId) ? canvas.actId : fallbackActId;
      if (!grouped.has(targetActId)) grouped.set(targetActId, []);
      grouped.get(targetActId).push(canvas);
    });
    return grouped;
  }, [canvases, structure.acts]);
  const selectedActCanvasCount = selectedAct ? (canvasesByAct.get(selectedAct.id) || []).length : 0;
  const activeObjectCount = getArcadeObjectCount(activeConfig);
  const activeCanvasCanDelete = canvasCount > 1;
  const selectedActCanDelete = Boolean(selectedAct && structure.acts.length > 1 && selectedActCanvasCount === 0);

  const createAct = () => {
    const nextActId = onCreateAct?.();
    if (nextActId) setSelectedActId(nextActId);
  };

  const createCanvasInAct = (actId = selectedAct?.id || structure.acts[0]?.id || DEFAULT_RPG3D_ACT_ID) => {
    setSelectedActId(actId);
    onCreateCanvas?.({ actId });
  };

  const deleteSelectedAct = () => {
    if (!selectedActCanDelete || !selectedAct) return;
    const fallbackAct = structure.acts.find((act) => act.id !== selectedAct.id) || structure.acts[0];
    if (fallbackAct) setSelectedActId(fallbackAct.id);
    onDeleteAct?.(selectedAct.id);
  };

  return (
    <section className="arcade-canvas-manager-tab" aria-label="Gestion des scenes RPG 3D">
      <section className="panel side panel-nav-pro scene-left-nav arcade-canvas-nav">
        <div className="scene-nav-section">
          <div className="scene-nav-section-head">
            <div>
              <span className="section-kicker">Navigation</span>
              <h2>Scenes</h2>
              <small>{structure.acts.length} acte{structure.acts.length > 1 ? 's' : ''} - {canvasCount} canevas</small>
            </div>
            <div className="toolbar compact-toolbar scene-nav-actions arcade-canvas-nav-actions">
              <button type="button" onClick={createAct}>
                + Acte
              </button>
              <button type="button" onClick={() => createCanvasInAct()}>
                + Canevas
              </button>
            </div>
          </div>

          <div className="scene-nav-list arcade-canvas-nav-list">
            {structure.acts.map((act) => {
              const actCanvases = canvasesByAct.get(act.id) || [];
              const collapsed = collapsedActIds.has(act.id);
              const actIsSelected = selectedAct?.id === act.id;
              return (
                <details
                  key={act.id}
                  className={`act-group arcade-canvas-act-group ${actIsSelected ? 'selected' : ''}`}
                  open={!collapsed}
                  onToggle={(event) => {
                    setCollapsedActIds((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.open) next.delete(act.id);
                      else next.add(act.id);
                      return next;
                    });
                  }}
                >
                  <summary
                    className="act-heading arcade-canvas-act-heading"
                    onClick={() => setSelectedActId(act.id)}
                  >
                    <strong>{act.name || 'Acte'}</strong>
                    <span className="act-heading-meta">{actCanvases.length} canevas</span>
                    <span className="scene-collapse-spacer" />
                  </summary>
                  <div className="arcade-canvas-act-tools">
                    <button type="button" className="secondary-action" onClick={() => createCanvasInAct(act.id)}>
                      Nouveau canevas
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        setSelectedActId(act.id);
                        onDeleteAct?.(act.id);
                      }}
                      disabled={structure.acts.length <= 1 || actCanvases.length > 0}
                    >
                      Supprimer acte
                    </button>
                  </div>
                  <div className="scene-tree-menu arcade-canvas-file-list">
                    {actCanvases.length ? actCanvases.map((canvas) => {
                      const isActive = canvas.id === activeCanvasId;
                      const canvasConfig = isActive ? currentConfig : canvas.config;
                      const objectCount = getArcadeObjectCount(canvasConfig || DEFAULT_ARCADE_CONFIG);
                      return (
                        <div key={canvas.id} className={`arcade-canvas-file-row ${isActive ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="arcade-canvas-file-select"
                            onClick={() => {
                              setSelectedActId(act.id);
                              onSelectCanvas?.(canvas.id);
                            }}
                          >
                            <MapIcon aria-hidden="true" size={14} />
                            <span>
                              <strong>{canvas.name || 'Canevas'}</strong>
                              <small>{objectCount} objet{objectCount > 1 ? 's' : ''}</small>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="arcade-canvas-file-delete"
                            title={`Supprimer ${canvas.name || 'ce canevas'}`}
                            aria-label={`Supprimer ${canvas.name || 'ce canevas'}`}
                            onClick={() => onDeleteCanvas?.(canvas.id)}
                            disabled={canvasCount <= 1}
                          >
                            <Trash2 aria-hidden="true" size={13} />
                          </button>
                        </div>
                      );
                    }) : (
                      <p className="small-note">Aucun canevas dans cet acte.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel main panel-main-pro arcade-canvas-main">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Edition</span>
            <h2>Actes & canevas</h2>
          </div>
          {selectedAct ? <span className="status-badge soft">{selectedAct.name || 'Acte'}</span> : null}
        </div>

        <div className="editor-stack">
          <div className="subpanel scene-compact-card">
            <div className="subpanel-head">
              <h3>Acte selectionne</h3>
              <div className="inline-actions end">
                <button type="button" className="secondary-action" onClick={createAct}>
                  Nouvel acte
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={deleteSelectedAct}
                  disabled={!selectedActCanDelete}
                >
                  Supprimer acte
                </button>
              </div>
            </div>
            <div className="arcade-canvas-edit-grid">
              <label>
                <span>Nom de l'acte</span>
                <input
                  type="text"
                  value={selectedAct?.name || ''}
                  placeholder="Acte"
                  onChange={(event) => selectedAct && onRenameAct?.(selectedAct.id, event.target.value)}
                />
              </label>
              <div>
                <small>Canevas dans l'acte</small>
                <strong>{selectedActCanvasCount}</strong>
              </div>
            </div>
          </div>

          <div className="subpanel scene-compact-card">
            <div className="subpanel-head">
              <h3>Canevas actif</h3>
              <div className="inline-actions end">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => createCanvasInAct(selectedAct?.id || activeCanvas?.actId)}
                >
                  Nouveau canevas
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => activeCanvas?.id && onDeleteCanvas?.(activeCanvas.id)}
                  disabled={!activeCanvasCanDelete}
                >
                  Supprimer
                </button>
                {activeCanvasCanDelete ? (
                  <button type="button" className="danger-button" onClick={onKeepOnlyActiveCanvas}>
                    Garder ce canevas
                  </button>
                ) : null}
              </div>
            </div>

            <div className="arcade-canvas-edit-grid">
              <label>
                <span>Nom du canevas</span>
                <input
                  type="text"
                  value={activeCanvas?.name || ''}
                  placeholder="Canevas"
                  onChange={(event) => activeCanvas?.id && onRenameCanvas?.(activeCanvas.id, event.target.value)}
                />
              </label>
              <label>
                <span>Acte</span>
                <select
                  value={activeCanvas?.actId || selectedAct?.id || ''}
                  onChange={(event) => {
                    setSelectedActId(event.target.value);
                    if (activeCanvas?.id) onMoveCanvasToAct?.(activeCanvas.id, event.target.value);
                  }}
                >
                  {structure.acts.map((act) => (
                    <option key={act.id} value={act.id}>{act.name || 'Acte'}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="arcade-canvas-detail-grid">
              <div>
                <small>Taille</small>
                <strong>{activeConfig?.world?.width || DEFAULT_ARCADE_CONFIG.world.width} x {activeConfig?.world?.height || DEFAULT_ARCADE_CONFIG.world.height}</strong>
              </div>
              <div>
                <small>Objets</small>
                <strong>{activeObjectCount}</strong>
              </div>
              <div>
                <small>Acte</small>
                <strong>{structure.acts.find((act) => act.id === activeCanvas?.actId)?.name || selectedAct?.name || 'Acte'}</strong>
              </div>
            </div>

            <div className="inline-actions">
              <button
                type="button"
                className="button like"
                onClick={() => {
                  if (activeCanvas?.id) onSelectCanvas?.(activeCanvas.id);
                  onOpenCanvas?.();
                }}
              >
                <MapIcon aria-hidden="true" size={15} />
                Ouvrir dans Carte RPG 3D
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function ArcadeManagementTab({
  config,
  selected,
  studioProject,
  onCreateStudioCharacter,
  onCreateStudioDecor,
  onRenameStudioCharacter,
  onRenameStudioDecor,
  onDeleteStudioCharacter,
  onDeleteStudioDecor,
  onEditStudioCharacter,
  onEditStudioDecor,
  onRenameMapEntity,
  onDeleteMapEntity,
  onEditMapEntity,
}) {
  const studioCharacters = studioProject.characterModels3d || [];
  const studioDecors = studioProject.decorModels3d || [];
  const mapCharacters = [
    ...(config.heroes || []).map((item, index) => ({ type: 'hero', item, index })),
    ...(config.enemies || []).map((item, index) => ({ type: 'enemy', item, index })),
  ];
  const mapObjects = [
    ...getCountedMapProps(config).map((item, index) => ({ type: 'prop', item, index })),
    ...(config.reliefs || []).map((item, index) => ({ type: 'relief', item, index })),
    ...(config.obstacles || []).map((item, index) => ({ type: 'obstacle', item, index })),
    ...(config.pickups || []).map((item, index) => ({ type: 'pickup', item, index })),
    ...(config.actionZones || []).map((item, index) => ({ type: 'actionZone', item, index })),
  ];
  const visibleMapCharacters = getUniqueManagementEntities(mapCharacters, selected);
  const visibleMapObjects = getUniqueManagementEntities(mapObjects, selected);
  const [managementFilter, setManagementFilter] = useState('all');
  const managementFilters = [
    {
      id: 'all',
      label: 'Tout',
      count: studioCharacters.length + studioDecors.length + visibleMapCharacters.length + visibleMapObjects.length,
    },
    { id: 'studioCharacters', label: 'Personnages 3D', count: studioCharacters.length },
    { id: 'studioDecors', label: 'Objets 3D', count: studioDecors.length },
    { id: 'mapCharacters', label: 'Personnages carte', count: visibleMapCharacters.length },
    { id: 'mapObjects', label: 'Objets carte', count: visibleMapObjects.length },
  ];
  const showAllManagement = managementFilter === 'all';

  return (
    <section className="arcade-management-tab" aria-label="Gestion des objets et personnages">
      <section className="panel arcade-management-summary">
        <div>
          <span className="section-kicker"><List aria-hidden="true" size={14} /> Gestion</span>
          <h2>Objets et personnages</h2>
        </div>
        <div className="arcade-management-stats">
          {managementFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={managementFilter === filter.id ? 'active' : ''}
              aria-pressed={managementFilter === filter.id}
              onClick={() => setManagementFilter(filter.id)}
            >
              <strong>{filter.count}</strong>
              <small>{filter.label}</small>
            </button>
          ))}
        </div>
      </section>

      {showAllManagement || managementFilter === 'studioCharacters' ? (
        <ArcadeManagementSection
          title="Personnages 3D crees"
          count={studioCharacters.length}
          emptyLabel="Aucun personnage 3D."
        >
          {studioCharacters.map((model) => (
            <ArcadeManagementRow
              key={model.id}
              Icon={Cuboid}
              tone="character"
              label="Personnage 3D"
              name={model.name || ''}
              placeholder="Personnage 3D"
              onEdit={() => onEditStudioCharacter(model.id)}
              onDelete={() => onDeleteStudioCharacter(model.id)}
            />
          ))}
        </ArcadeManagementSection>
      ) : null}

      {showAllManagement || managementFilter === 'studioDecors' ? (
        <ArcadeManagementSection
          title="Objets 3D crees"
          count={studioDecors.length}
          emptyLabel="Aucun objet 3D."
        >
          {studioDecors.map((model) => (
            <ArcadeManagementRow
              key={model.id}
              Icon={Mountain}
              tone="decor"
              label="Objet 3D"
              name={model.name || ''}
              placeholder="Objet 3D"
              thumbnail={model.imageData || ''}
              onEdit={() => onEditStudioDecor(model.id)}
              onDelete={() => onDeleteStudioDecor(model.id)}
            />
          ))}
        </ArcadeManagementSection>
      ) : null}

      {showAllManagement || managementFilter === 'mapCharacters' ? (
        <ArcadeManagementSection
          title="Personnages sur la carte"
          count={visibleMapCharacters.length}
          emptyLabel="Aucun personnage place."
        >
          {visibleMapCharacters.map(({ type, item, index }) => {
            const meta = MAP_ENTITY_META[type];
            const name = getMapEntityEditableName(type, item);
            const placeholder = getMapEntityFallbackName(type, index);
            return (
              <ArcadeManagementRow
                key={item.id}
                Icon={meta.icon}
                tone={meta.tone}
                active={selected?.type === type && selected.id === item.id}
                label={meta.label}
                name={name}
                placeholder={placeholder}
                thumbnail={item.characterImageData || ''}
                onEdit={() => onEditMapEntity(type, item.id)}
                onDelete={() => onDeleteMapEntity(type, item.id)}
              />
            );
          })}
        </ArcadeManagementSection>
      ) : null}

      {showAllManagement || managementFilter === 'mapObjects' ? (
        <ArcadeManagementSection
          title="Objets sur la carte"
          count={visibleMapObjects.length}
          emptyLabel="Aucun objet place."
        >
          {visibleMapObjects.map(({ type, item, index }) => {
            const meta = MAP_ENTITY_META[type];
            const name = getMapEntityEditableName(type, item);
            const placeholder = getMapEntityFallbackName(type, index);
            return (
              <ArcadeManagementRow
                key={item.id}
                Icon={meta.icon}
                tone={meta.tone}
                active={selected?.type === type && selected.id === item.id}
                label={meta.label}
                name={name}
                placeholder={placeholder}
                thumbnail={item.imageData || ''}
                onEdit={() => onEditMapEntity(type, item.id)}
                onDelete={() => onDeleteMapEntity(type, item.id)}
              />
            );
          })}
        </ArcadeManagementSection>
      ) : null}
    </section>
  );
}

function Rpg3DMode({ user = null, authReady = true, project = null }) {
  const wrapperRef = useRef(null);
  const multiDragRef = useRef(null);
  const isSavingAssetsRef = useRef(false);
  const projectRef = useRef(project);
  const remoteAssetsLoadKeyRef = useRef('');
  const lastFrameRef = useRef(0);
  const actionZoneTriggerRef = useRef({ key: '', cooldownUntil: 0 });
  const terrainPaintSessionRef = useRef(null);
  const terrainPaintPendingPointsRef = useRef([]);
  const terrainPaintLastPointRef = useRef(null);
  const terrainPaintFlushTimerRef = useRef(null);
  const terrainPaintLastFlushRef = useRef(0);
  const modelEraserSessionRef = useRef(null);
  const modelEraserLastPointRef = useRef(null);
  const [mode, setMode] = useState('edit');
  const [tool, setTool] = useState('select');
  const [dragMode, setDragMode] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [cameraTargetPickMode, setCameraTargetPickMode] = useState(false);
  const [cameraZoomDragMode, setCameraZoomDragMode] = useState(false);
  const [cameraToolsHidden, setCameraToolsHidden] = useState(false);
  const [transformTool, setTransformTool] = useState('');
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [terrainPaintDraft, setTerrainPaintDraft] = useState({
    color: TERRAIN_PAINT_DEFAULT_COLOR,
    radius: TERRAIN_PAINT_DEFAULT_RADIUS,
    opacity: TERRAIN_PAINT_DEFAULT_OPACITY,
    shape: TERRAIN_PAINT_DEFAULT_SHAPE,
  });
  const [modelEraserRadiusDraft, setModelEraserRadiusDraft] = useState(MODEL_ERASER_DEFAULT_RADIUS);
  const [flatGroundColorDraft, setFlatGroundColorDraft] = useState(FLAT_GROUND_DEFAULT_COLOR);
  const [multiSelected, setMultiSelected] = useState([]);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(selected);
  const modeRef = useRef(mode);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [activeNpcChoice, setActiveNpcChoice] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('arcade');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false);

  selectedRef.current = selected;
  modeRef.current = mode;

  const {
    autosaveVersionRef,
    clearHistoryStacks,
    config,
    configRef,
    initialArcadeAssets,
    lastSavedAutosaveVersionRef,
    markAutosaveDirty,
    patchConfig,
    patchConfigWithoutHistory,
    patchStudioProject,
    pushHistorySnapshot,
    redoProjectChange,
    redoStack,
    resetGame,
    setConfig,
    setSnapshot: setGameSnapshot,
    setStudioProject,
    snapshot: projectRuntimeSnapshot,
    stateRef: projectStateRef,
    studioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    undoProjectChange,
    undoStack,
  } = useRpg3DProjectState({
    project,
    selectedRef,
    modeRef,
    actionZoneTriggerRef,
    lastFrameRef,
    setActiveNpcChoice,
  });

  const savedArcadeAssets = initialArcadeAssets.saved;
  const [studioSelection, setStudioSelection] = useState({
    characterModelId: '',
    decorModelId: '',
  });

  const [managementSaveStatus, setManagementSaveStatus] = useState(
    savedArcadeAssets ? 'Sauvegarde locale chargee.' : '',
  );
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  useEffect(() => {
    isSavingAssetsRef.current = isSavingAssets;
  }, [isSavingAssets]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const clearTerrainPaintFlushTimer = useCallback(() => {
    if (terrainPaintFlushTimerRef.current === null) return;
    window.clearTimeout(terrainPaintFlushTimerRef.current);
    terrainPaintFlushTimerRef.current = null;
  }, []);

  const flushTerrainPaintPoints = useCallback(() => {
    clearTerrainPaintFlushTimer();
    const strokeId = terrainPaintSessionRef.current;
    const queuedPoints = terrainPaintPendingPointsRef.current;
    terrainPaintPendingPointsRef.current = [];
    terrainPaintLastFlushRef.current = getNow();
    if (!strokeId || !queuedPoints.length) return;
    patchConfigWithoutHistory((next) => {
      const stroke = (next.terrainPaintStrokes || []).find((item) => item.id === strokeId);
      if (!stroke) return;
      stroke.points = Array.isArray(stroke.points) ? stroke.points : [];
      queuedPoints.forEach((paintPoint) => {
        if (shouldAppendTerrainPaintPoint(stroke, paintPoint)) stroke.points.push(paintPoint);
      });
    }, false);
  }, [clearTerrainPaintFlushTimer, patchConfigWithoutHistory]);

  const scheduleTerrainPaintFlush = useCallback(() => {
    if (terrainPaintFlushTimerRef.current !== null) return;
    const wait = Math.max(0, TERRAIN_PAINT_FLUSH_INTERVAL_MS - (getNow() - terrainPaintLastFlushRef.current));
    terrainPaintFlushTimerRef.current = window.setTimeout(() => {
      terrainPaintFlushTimerRef.current = null;
      flushTerrainPaintPoints();
    }, wait);
  }, [flushTerrainPaintPoints]);

  useEffect(() => () => {
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
  }, [clearTerrainPaintFlushTimer]);

  useEffect(() => {
    if (workspaceTab !== 'arcade') {
      setMapFullscreen(false);
      setMapDrawerOpen(false);
    }
  }, [workspaceTab]);

  useEffect(() => {
    if (mode === 'edit' && tool === 'terrainPaint') return;
    flushTerrainPaintPoints();
    terrainPaintSessionRef.current = null;
    terrainPaintLastPointRef.current = null;
    terrainPaintPendingPointsRef.current = [];
  }, [flushTerrainPaintPoints, mode, tool]);

  useEffect(() => {
    if (mode === 'edit' && tool === 'modelEraser') return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
  }, [mode, tool]);

  useEffect(() => {
    if (mode !== 'play') return;
    const selectedHeroId = selected?.type === 'hero' ? selected.id : '';
    const controlledHeroId = getPlayableHeroId(configRef.current, selectedHeroId);
    if (!controlledHeroId) return;
    if (stateRef.current.player?.controlledHeroId === controlledHeroId) return;
    resetGame(configRef.current, { mode: 'play' });
  }, [mode, resetGame, selected?.id, selected?.type]);

  useEffect(() => {
    let cancelled = false;
    restoreLocalArcadeAssetsSources({
      config: configRef.current,
      studioProject: studioProjectRef.current,
    }).then((restored) => {
      if (cancelled || !restored?.changed) return;
      const nextConfig = createConfigFromSavedAssets(restored.config);
      const nextStudioProject = syncStudioProjectActiveCanvasConfig(restored.studioProject, nextConfig);
      configRef.current = nextConfig;
      studioProjectRef.current = nextStudioProject;
      setConfig(nextConfig);
      setStudioProject(nextStudioProject);
      resetGame(nextConfig);
      setManagementSaveStatus((current) => current || 'Modeles 3D locaux restaures.');
    }).catch(() => {
      // Local model recovery is best-effort; missing files fall back to normal asset sync.
    });
    return () => {
      cancelled = true;
    };
  }, [resetGame, setConfig, setStudioProject, syncStudioProjectActiveCanvasConfig]);

  useEffect(() => {
    if (!authReady || !user?.id || !hasRpg3DAssetsSupabaseConfig()) return undefined;
    const loadKey = user.id;
    if (remoteAssetsLoadKeyRef.current === loadKey) return undefined;
    remoteAssetsLoadKeyRef.current = loadKey;
    let cancelled = false;
    setManagementSaveStatus((current) => (
      !current || isDisconnectedSaveStatus(current) ? 'Chargement Supabase...' : current
    ));
    loadArcadeAssetsFromSupabase(user.id)
      .then(async (remoteAssets) => {
        if (cancelled || !remoteAssets) return;
        const remoteStudioProject = createStudioProjectFromSavedAssets(remoteAssets.studioProject, remoteAssets.config, projectRef.current);
        const remoteConfig = createConfigFromSavedAssets(getActiveRpg3DCanvas(remoteStudioProject)?.config || remoteAssets.config);
        const restored = await restoreLocalArcadeAssetsSources({
          config: remoteConfig,
          studioProject: remoteStudioProject,
        });
        if (cancelled) return;
        const nextConfig = createConfigFromSavedAssets(restored.config);
        const nextStudioProject = syncStudioProjectActiveCanvasConfig(restored.studioProject, nextConfig);
        configRef.current = nextConfig;
        studioProjectRef.current = nextStudioProject;
        setConfig(nextConfig);
        setStudioProject(nextStudioProject);
        clearHistoryStacks();
        resetGame(nextConfig);
        rememberArcadeAssetsLocally({
          ...remoteAssets,
          config: nextConfig,
          studioProject: nextStudioProject,
        });
        setManagementSaveStatus(restored.changed
          ? 'Sauvegarde Supabase chargee, modeles locaux restaures.'
          : 'Sauvegarde Supabase chargee.');
      })
      .catch((error) => {
        if (cancelled) return;
        if (isRpg3DAssetsNotFoundError(error)) {
          setManagementSaveStatus((current) => current === 'Chargement Supabase...' ? '' : current);
          return;
        }
        setManagementSaveStatus('Chargement Supabase impossible.');
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, clearHistoryStacks, resetGame, setConfig, setStudioProject, syncStudioProjectActiveCanvasConfig, user?.id]);

  const patchViewportEngineConfig = useCallback((recipe) => {
    const currentConfig = configRef.current || DEFAULT_ARCADE_CONFIG;
    const currentEngine = { ...DEFAULT_ARCADE_CONFIG.engine, ...(currentConfig.engine || {}) };
    const nextEngine = { ...currentEngine };
    recipe(nextEngine);
    const changed = Object.keys(nextEngine).some((key) => nextEngine[key] !== currentEngine[key]);
    if (!changed) return;
    const nextConfig = { ...currentConfig, engine: nextEngine };
    configRef.current = nextConfig;
    syncActiveCanvasConfigInRef(nextConfig);
    setConfig(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, syncActiveCanvasConfigInRef]);

  const handleCameraZoomDrag = useCallback((deltaY) => {
    const movement = Number(deltaY) || 0;
    if (!movement) return;
    patchViewportEngineConfig((engine) => {
      const currentDistance = Number(engine.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
      engine.cameraDistance = clamp(
        currentDistance + movement * CAMERA_ZOOM_DRAG_SENSITIVITY,
        CAMERA_DISTANCE_MIN,
        CAMERA_DISTANCE_MAX,
      );
    });
  }, [patchViewportEngineConfig]);

  const selectSingleEntity = useCallback((entity) => {
    setSelected(entity);
    setMultiSelected(entity && canMultiSelectEntity(entity) ? [entity] : []);
  }, []);

  const toggleMultiSelectedEntity = useCallback((entity) => {
    if (!canMultiSelectEntity(entity)) {
      setSelected(entity || null);
      setMultiSelected([]);
      return;
    }
    setTool('select');
    setMultiSelected((current) => {
      const exists = current.some((entry) => isSameEntity(entry, entity));
      if (exists) {
        const next = current.filter((entry) => !isSameEntity(entry, entity));
        const fallback = next[next.length - 1] || entity;
        setSelected(fallback);
        return next.length ? next : [entity];
      }
      setSelected(entity);
      return [...current, entity];
    });
  }, []);

  const toggleCameraTargetPickMode = useCallback(() => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setPendingPlacement(null);
    setCameraTargetPickMode((current) => !current);
  }, []);

  const handleCameraTargetPick = useCallback((entity, success) => {
    if (success && entity) setCameraTargetPickMode(false);
  }, []);

  useEffect(() => {
    if (mode === 'play') {
      setCameraTargetPickMode(false);
      setTransformTool('');
    }
  }, [mode]);

  useEffect(() => {
    setConfig((current) => {
      const synced = syncConfigModelReferences(current, studioProject, { preferLocalBlob: true });
      if (!synced.changed) return current;
      configRef.current = synced.config;
      syncActiveCanvasConfigInRef(synced.config);
      return synced.config;
    });
  }, [studioProject, syncActiveCanvasConfigInRef]);

  useEffect(() => {
    if (workspaceTab !== 'canvases') return;
    syncActiveCanvasConfigInRef(configRef.current, { updateState: true });
  }, [syncActiveCanvasConfigInRef, workspaceTab]);

  const saveArcadeAssets = useCallback(async (options = {}) => {
    const localOnly = Boolean(options.localOnly);
    const supabaseConfigured = hasRpg3DAssetsSupabaseConfig();
    const saveLocallyBecauseSessionMissing = !localOnly && supabaseConfigured && authReady && !user?.id;
    const effectiveLocalOnly = localOnly || saveLocallyBecauseSessionMissing;
    const savingVersion = autosaveVersionRef.current;
    if (isSavingAssetsRef.current) return;
    if (!effectiveLocalOnly && supabaseConfigured) {
      if (!authReady) {
        setManagementSaveStatus('Compte en cours de chargement...');
        return;
      }
      if (!user?.id) {
        setManagementSaveStatus(RPG3D_LOGIN_REQUIRED_STATUS);
        return;
      }
    }

    isSavingAssetsRef.current = true;
    setIsSavingAssets(true);
    setManagementSaveStatus(
      effectiveLocalOnly ? 'Sauvegarde locale...' : (supabaseConfigured ? 'Sauvegarde Supabase...' : 'Sauvegarde locale...'),
    );
    try {
      const currentConfig = configRef.current;
      const currentStudioProject = syncActiveCanvasConfigInRef(currentConfig, { updateState: workspaceTab === 'canvases' });
      if (effectiveLocalOnly) {
        const localSync = syncConfigModelReferences(currentConfig, currentStudioProject, { preferLocalBlob: true });
        const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
        if (!rememberArcadeAssetsLocally(localPayload)) {
          setManagementSaveStatus('Sauvegarde impossible: stockage local plein.');
          return;
        }
        if (localSync.changed) {
          configRef.current = localSync.config;
          syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
          setConfig(localSync.config);
          resetGame(localSync.config);
        }
        lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
        setManagementSaveStatus(saveLocallyBecauseSessionMissing
          ? RPG3D_LOCAL_SESSION_FALLBACK_STATUS
          : 'Sauvegarde locale terminee.');
        return;
      }

      if (supabaseConfigured && user?.id) {
        const remotePayload = await createSupabaseArcadeAssetsPayload(currentConfig, currentStudioProject, user.id);
        await uploadArcadeAssetsManifest(remotePayload, user.id);
        rememberArcadeAssetsLocally(remotePayload);
        const nextStudioProject = createStudioProjectFromSavedAssets(remotePayload.studioProject, remotePayload.config, project);
        const nextConfig = createConfigFromSavedAssets(getActiveRpg3DCanvas(nextStudioProject)?.config || remotePayload.config);
        lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
        if (autosaveVersionRef.current === savingVersion) {
          configRef.current = nextConfig;
          studioProjectRef.current = syncStudioProjectActiveCanvasConfig(nextStudioProject, nextConfig);
          setConfig(nextConfig);
          setStudioProject(studioProjectRef.current);
          resetGame(nextConfig);
        }
        setManagementSaveStatus('Sauvegarde Supabase terminee.');
        return;
      }

      const localSync = syncConfigModelReferences(currentConfig, currentStudioProject);
      const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
      if (!rememberArcadeAssetsLocally(localPayload)) {
        setManagementSaveStatus('Sauvegarde impossible: stockage local plein.');
        return;
      }
      if (localSync.changed) {
        configRef.current = localSync.config;
        syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
        setConfig(localSync.config);
      }
      lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
      setManagementSaveStatus('Sauvegarde locale terminee.');
    } catch (error) {
      if (!effectiveLocalOnly && supabaseConfigured) {
        try {
          const currentConfig = configRef.current;
          const currentStudioProject = syncActiveCanvasConfigInRef(currentConfig, { updateState: workspaceTab === 'canvases' });
          const localSync = syncConfigModelReferences(currentConfig, currentStudioProject, { preferLocalBlob: true });
          const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
          if (rememberArcadeAssetsLocally(localPayload)) {
            if (localSync.changed) {
              configRef.current = localSync.config;
              syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
              setConfig(localSync.config);
              resetGame(localSync.config);
            }
            lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
            setManagementSaveStatus(`Sauvegarde locale terminee. Supabase inaccessible: ${error?.message || 'upload impossible'}`);
            return;
          }
        } catch {
          // Keep the original Supabase error below if the local fallback also fails.
        }
      }
      const errorPrefix = effectiveLocalOnly
        ? 'Mode local impossible'
        : supabaseConfigured
          ? 'Sauvegarde Supabase impossible'
          : 'Sauvegarde locale impossible';
      setManagementSaveStatus(error?.message ? `${errorPrefix}: ${error.message}` : `${errorPrefix}.`);
    } finally {
      isSavingAssetsRef.current = false;
      setIsSavingAssets(false);
    }
  }, [authReady, project, resetGame, syncActiveCanvasConfigInRef, user?.id, workspaceTab]);

  const selectRpg3DCanvas = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas) return;
    if (syncedProject.rpg3dActiveCanvasId === targetCanvas.id) {
      setStudioProject(syncedProject);
      return;
    }
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActiveCanvasId = targetCanvas.id;
    const nextCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === targetCanvas.id) || targetCanvas;
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject, { preferLocalBlob: true });
    const nextConfig = synced.config;
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, targetCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef, workspaceTab]);

  const activateRpg3DCanvasPortal = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas || syncedProject.rpg3dActiveCanvasId === targetCanvas.id) return false;
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActiveCanvasId = targetCanvas.id;
    const nextCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === targetCanvas.id) || targetCanvas;
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject, { preferLocalBlob: true });
    const nextConfig = synced.config;
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, targetCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    actionZoneTriggerRef.current = { key: 'portal-transition', cooldownUntil: performance.now() + 950 };
    setMode('play');
    setIsPaused(false);
    return true;
  }, [resetGame, syncActiveCanvasConfigInRef, workspaceTab]);

  const {
    clearInputState,
    pointerRef,
    setPlayerMoveTarget,
    setPointerShooting,
    snapshot,
    stateRef,
    updateWorldPointer,
  } = useRpg3DGameLoop({
    activateRpg3DCanvasPortal,
    actionZoneTriggerRef,
    configRef,
    getActionZoneNpcLabel,
    getNpcChoiceItems,
    getNpcInteractionMode,
    getNpcQuestionText,
    isPaused,
    lastFrameRef,
    mode,
    setActiveNpcChoice,
    setIsPaused,
    setSnapshot: setGameSnapshot,
    snapshot: projectRuntimeSnapshot,
    stateRef: projectStateRef,
    workspaceTab,
  });

  useEffect(() => {
    if (workspaceTab === 'arcade') return;
    clearInputState();
    window.getSelection?.()?.removeAllRanges?.();
    if (modeRef.current !== 'play') return;
    setMode('edit');
    setIsPaused(false);
    resetGame(configRef.current, { mode: 'edit' });
  }, [clearInputState, resetGame, workspaceTab]);

  const createRpg3DCanvas = useCallback(({ actId = '' } = {}) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const fallbackAct = nextProject.rpg3dActs[0] || getDefaultRpg3DActs()[0];
    const targetActId = nextProject.rpg3dActs.some((act) => act.id === actId)
      ? actId
      : fallbackAct.id;
    const nextCanvas = createRpg3DCanvasDraft({
      index: nextProject.rpg3dCanvases.length,
      actId: targetActId,
    });
    nextProject.rpg3dCanvases = [...(nextProject.rpg3dCanvases || []), nextCanvas];
    nextProject.rpg3dScenes = [
      ...(nextProject.rpg3dScenes || []),
      { id: nextCanvas.id, name: nextCanvas.name, actId: targetActId, parentSceneId: '' },
    ];
    nextProject.rpg3dActiveCanvasId = nextCanvas.id;
    const nextConfig = createConfigFromSavedAssets(nextCanvas.config);
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, nextCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
    return nextCanvas.id;
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef, workspaceTab]);

  const deleteRpg3DCanvas = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const canvases = syncedProject.rpg3dCanvases || [];
    if (canvases.length <= 1) return;
    if (!canvases.some((canvas) => canvas.id === canvasId)) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const removedCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === canvasId);
    const wasActive = nextProject.rpg3dActiveCanvasId === canvasId;
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.filter((canvas) => canvas.id !== canvasId);
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).filter((scene) => (
      scene.id !== canvasId && scene.id !== removedCanvas?.sceneId
    ));
    let nextConfig = configRef.current;
    if (wasActive) {
      const nextCanvas = nextProject.rpg3dCanvases[0] || createFallbackRpg3DCanvas();
      nextProject.rpg3dActiveCanvasId = nextCanvas.id;
      nextConfig = createConfigFromSavedAssets(nextCanvas.config);
    }
    const finalProject = wasActive
      ? syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, nextProject.rpg3dActiveCanvasId)
      : nextProject;
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    if (wasActive) {
      setSelected(null);
      setMultiSelected([]);
      setPendingPlacement(null);
      resetGame(nextConfig);
    }
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef, workspaceTab]);

  const keepOnlyActiveRpg3DCanvas = useCallback(() => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const activeCanvasId = syncedProject.rpg3dActiveCanvasId || syncedProject.rpg3dCanvases?.[0]?.id || '';
    const activeCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === activeCanvasId);
    if (!activeCanvas || (syncedProject.rpg3dCanvases || []).length <= 1) return;
    pushHistorySnapshot();
    const structure = getRpg3DCanvasStructure(syncedProject);
    const activeAct = structure.acts.find((act) => act.id === activeCanvas.actId) || {
      id: activeCanvas.actId || DEFAULT_RPG3D_ACT_ID,
      name: 'Acte I',
    };
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = [{ id: activeAct.id, name: activeAct.name || 'Acte I' }];
    nextProject.rpg3dScenes = [{
      id: activeCanvas.id,
      name: activeCanvas.name || 'Scene 1',
      actId: activeAct.id,
      parentSceneId: '',
    }];
    nextProject.rpg3dCanvases = [{
      ...activeCanvas,
      actId: activeAct.id,
      sceneId: activeCanvas.id,
      config: cloneConfig(configRef.current),
      updatedAt: new Date().toISOString(),
    }];
    nextProject.rpg3dActiveCanvasId = activeCanvas.id;
    const nextConfig = createConfigFromSavedAssets(nextProject.rpg3dCanvases[0].config);
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, activeCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef, workspaceTab]);

  const createRpg3DAct = useCallback(() => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const nextAct = {
      id: createId('rpg3d-act'),
      name: `Acte ${nextProject.rpg3dActs.length + 1}`,
    };
    nextProject.rpg3dActs = [...(nextProject.rpg3dActs || []), nextAct];
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
    return nextAct.id;
  }, [markAutosaveDirty, pushHistorySnapshot, syncActiveCanvasConfigInRef, workspaceTab]);

  const renameRpg3DAct = useCallback((actId, name) => {
    const nextName = String(name ?? '').slice(0, 80);
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const currentAct = (syncedProject.rpg3dActs || []).find((act) => act.id === actId);
    if (!currentAct || currentAct.name === nextName) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = nextProject.rpg3dActs.map((act) => (
      act.id === actId ? { ...act, name: nextName } : act
    ));
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, syncActiveCanvasConfigInRef, workspaceTab]);

  const deleteRpg3DAct = useCallback((actId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const acts = syncedProject.rpg3dActs || [];
    const canvases = syncedProject.rpg3dCanvases || [];
    if (acts.length <= 1) return;
    if (canvases.some((canvas) => canvas.actId === actId)) return;
    if (!acts.some((act) => act.id === actId)) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = nextProject.rpg3dActs.filter((act) => act.id !== actId);
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).filter((scene) => scene.actId !== actId);
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, syncActiveCanvasConfigInRef, workspaceTab]);

  const renameRpg3DCanvas = useCallback((canvasId, name) => {
    const nextName = String(name ?? '').slice(0, 100);
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas || targetCanvas.name === nextName) return;
    pushHistorySnapshot();
    const renamedAt = new Date().toISOString();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.map((canvas) => {
      if (canvas.id !== canvasId) return canvas;
      const nextCanvasConfig = createConfigFromSavedAssets(canvas.config);
      nextCanvasConfig.meta = {
        ...(nextCanvasConfig.meta || {}),
        title: nextName || nextCanvasConfig.meta?.title || 'Canevas',
      };
      return {
        ...canvas,
        name: nextName,
        sceneId: canvas.id,
        config: nextCanvasConfig,
        updatedAt: renamedAt,
      };
    });
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).map((scene) => (
      scene.id === targetCanvas.sceneId || scene.id === targetCanvas.id
        ? { ...scene, id: targetCanvas.id, name: nextName || scene.name }
        : scene
    ));

    let finalProject = nextProject;
    if (nextProject.rpg3dActiveCanvasId === canvasId) {
      const nextConfig = cloneConfig(configRef.current);
      nextConfig.meta = {
        ...(nextConfig.meta || {}),
        title: nextName || nextConfig.meta?.title || 'Canevas',
      };
      configRef.current = nextConfig;
      setConfig(nextConfig);
      finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, canvasId);
    }
    studioProjectRef.current = finalProject;
    setStudioProject(finalProject);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, syncActiveCanvasConfigInRef, workspaceTab]);

  const moveRpg3DCanvasToAct = useCallback((canvasId, actId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    const targetAct = (syncedProject.rpg3dActs || []).find((act) => act.id === actId);
    if (!targetCanvas || !targetAct || targetCanvas.actId === actId) return;
    pushHistorySnapshot();
    const movedAt = new Date().toISOString();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.map((canvas) => (
      canvas.id === canvasId
        ? { ...canvas, actId, sceneId: canvas.id, updatedAt: movedAt }
        : canvas
    ));
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).map((scene) => (
      scene.id === targetCanvas.sceneId || scene.id === targetCanvas.id
        ? { ...scene, id: targetCanvas.id, actId }
        : scene
    ));
    const finalProject = nextProject.rpg3dActiveCanvasId === canvasId
      ? syncStudioProjectActiveCanvasConfig(nextProject, configRef.current, canvasId)
      : nextProject;
    studioProjectRef.current = finalProject;
    setStudioProject(finalProject);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, syncActiveCanvasConfigInRef, workspaceTab]);

  const createStudioCharacter = useCallback(() => {
    const next = makeCharacter3DModel({
      name: `Personnage 3D ${(studioProject.characterModels3d || []).length + 1}`,
      role: 'npc',
      shape: 'glb',
    });
    patchStudioProject((draft) => {
      draft.characterModels3d = Array.isArray(draft.characterModels3d) ? draft.characterModels3d : [];
      draft.characterModels3d.push(next);
    });
    setStudioSelection((current) => ({ ...current, characterModelId: next.id }));
    setWorkspaceTab('characters3d');
  }, [patchStudioProject, studioProject.characterModels3d]);

  const createStudioDecor = useCallback(() => {
    const next = makeDecor3DModel({
      name: `Objet 3D ${(studioProject.decorModels3d || []).length + 1}`,
      kind: 'decor',
    });
    patchStudioProject((draft) => {
      draft.decorModels3d = Array.isArray(draft.decorModels3d) ? draft.decorModels3d : [];
      draft.decorModels3d.push(next);
    });
    setStudioSelection((current) => ({ ...current, decorModelId: next.id }));
    setWorkspaceTab('decors3d');
  }, [patchStudioProject, studioProject.decorModels3d]);

  const renameStudioCharacter = useCallback((modelId, name) => {
    patchStudioProject((draft) => {
      const model = (draft.characterModels3d || []).find((entry) => entry.id === modelId);
      if (model) model.name = name;
    });
  }, [patchStudioProject]);

  const renameStudioDecor = useCallback((modelId, name) => {
    patchStudioProject((draft) => {
      const model = (draft.decorModels3d || []).find((entry) => entry.id === modelId);
      if (model) model.name = name;
    });
  }, [patchStudioProject]);

  const deleteStudioCharacter = useCallback((modelId) => {
    patchStudioProject((draft) => {
      draft.characterModels3d = (draft.characterModels3d || []).filter((model) => model.id !== modelId);
    });
    patchConfig((next) => {
      if (next.player.characterModel3dId === modelId) applyCharacterModelToActor(next.player, null);
      (next.heroes || []).forEach((hero) => {
        if (hero.characterModel3dId === modelId) applyCharacterModelToActor(hero, null);
      });
      (next.enemies || []).forEach((enemy) => {
        if (enemy.characterModel3dId === modelId) applyCharacterModelToActor(enemy, null);
      });
    }, false);
    setStudioSelection((current) => (
      current.characterModelId === modelId ? { ...current, characterModelId: '' } : current
    ));
  }, [patchConfig, patchStudioProject]);

  const deleteStudioDecor = useCallback((modelId) => {
    patchStudioProject((draft) => {
      draft.decorModels3d = (draft.decorModels3d || []).filter((model) => model.id !== modelId);
    });
    setStudioSelection((current) => (
      current.decorModelId === modelId ? { ...current, decorModelId: '' } : current
    ));
  }, [patchStudioProject]);

  const editStudioCharacter = useCallback((modelId) => {
    setStudioSelection((current) => ({ ...current, characterModelId: modelId }));
    setWorkspaceTab('characters3d');
  }, []);

  const editStudioDecor = useCallback((modelId) => {
    setStudioSelection((current) => ({ ...current, decorModelId: modelId }));
    setWorkspaceTab('decors3d');
  }, []);

  const createNewProject = useCallback(() => {
    if (!window.confirm('Creer un nouveau projet RPG 3D ? La carte actuelle sera remplacee.')) return;
    const next = createNewArcadeConfig();
    pushHistorySnapshot();
    configRef.current = next;
    setConfig(next);
    markAutosaveDirty();
    setMode('edit');
    setIsPaused(false);
    setSelected(null);
    setTool('select');
    setWorkspaceTab('arcade');
    resetGame(next);
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame]);

  const handleStudioUpload = useCallback(async (event, callback) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imageData = await readArcadeImageFile(file);
      const asset = {
        id: createId('arcade-asset'),
        name: file.name || 'image',
        type: 'image',
        url: imageData,
        size: file.size || 0,
        storageMode: 'local',
      };
      pushHistorySnapshot();
      setStudioProject((current) => {
        const next = {
          ...current,
          mediaAssets: [asset, ...(current.mediaAssets || []).filter((item) => item.url !== imageData)],
        };
        studioProjectRef.current = next;
        return next;
      });
      markAutosaveDirty();
      setMediaError('');
      callback?.(imageData, asset.name);
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    } finally {
      event.target.value = '';
    }
  }, [markAutosaveDirty, pushHistorySnapshot]);

  const setPlayerCharacterImage = useCallback(async (file) => {
    if (!file) return;
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        const hadImage = Boolean(next.player.characterImageData);
        next.player.characterImageData = imageData;
        next.player.characterImageName = file.name || 'heros';
        next.player.characterModel3dId = '';
        next.player.characterModelUrl = '';
        next.player.characterModelName = '';
        next.player.characterModelResources = [];
        next.player.characterModelAnimations = {};
        if (!hadImage) next.player.characterRenderMode = guessCharacterRenderMode(file.name || '');
        if (!next.player.characterModelScale) next.player.characterModelScale = 1;
        if (!next.player.characterModelScaleX) next.player.characterModelScaleX = next.player.characterModelScale;
        if (!next.player.characterModelScaleY) next.player.characterModelScaleY = next.player.characterModelScale;
        if (!next.player.characterModelScaleZ) next.player.characterModelScaleZ = next.player.characterModelScale;
        next.player.characterModelScaleProportional = next.player.characterModelScaleProportional !== false;
        next.player.characterMaterialBrightness = 1;
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [patchConfig]);

  const setSelectedPropImage = useCallback(async (file) => {
    if (!file || selected?.type !== 'prop') return;
    const target = { ...selected };
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        const selectedEntity = getSelectedEntity(next, target);
        if (!selectedEntity?.item) return;
        const prop = selectedEntity.item;
        const renderMode = prop.renderMode || guessPropRenderMode(file.name || '');
        prop.imageData = imageData;
        prop.imageName = file.name || 'decor';
        prop.renderMode = renderMode;
        prop.blocksMovement = shouldPropBlockByMode(renderMode);
        if (renderMode === 'floor') {
          const tileSize = getFloorTileWorldSize(prop);
          prop.floorZeroZ = getFloorZeroZ(prop);
          prop.w = tileSize;
          prop.h = tileSize;
          prop.r = Math.round(tileSize / 2);
          prop.modelHeight = 12;
        } else {
          prop.w = Math.round(getPropWidth(prop));
          prop.h = Math.round(getPropHeight(prop));
          prop.modelHeight = Math.round(getPropModelHeight(prop));
        }
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [patchConfig, selected]);

  const updateArcadeWorldField = useCallback((field, rawValue) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const limits = {
      width: { min: 1200, max: 9000, shouldReset: true },
      height: { min: 900, max: 7000, shouldReset: true },
      grid: { min: 40, max: 240, shouldReset: false },
    }[field];
    if (!limits) return;
    patchConfig((next) => {
      next.world[field] = clamp(Math.round(value), limits.min, limits.max);
      if (field !== 'grid') clampArcadeEntitiesToWorld(next);
    }, limits.shouldReset);
  }, [patchConfig]);

  const getCurrentPlacementPoint = useCallback((nextConfig) => {
    const world = nextConfig.world || DEFAULT_ARCADE_CONFIG.world;
    const pointer = pointerRef.current;
    const fallbackX = Number(nextConfig.player?.x) || world.width / 2;
    const fallbackY = Number(nextConfig.player?.y) || world.height / 2;
    return {
      x: clamp(pointer.hasWorldPoint && Number.isFinite(pointer.worldX) ? pointer.worldX : fallbackX, 0, world.width),
      y: clamp(pointer.hasWorldPoint && Number.isFinite(pointer.worldY) ? pointer.worldY : fallbackY, 0, world.height),
    };
  }, []);

  const beginEntityPlacement = useCallback((entity) => {
    if (!entity?.type || !entity.id) return;
    const cameraDistance = getPlacementCameraDistance(configRef.current, entity);
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(entity);
    setSelected(entity);
    setMultiSelected(canMultiSelectEntity(entity) ? [entity] : []);
    if (!['hero', 'enemy'].includes(entity.type)) return;
    patchViewportEngineConfig((engine) => {
      const currentDistance = Number(engine.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
      if (Math.abs(currentDistance - cameraDistance) > 0.5) engine.cameraDistance = cameraDistance;
    });
  }, [patchViewportEngineConfig]);

  const commitPendingPlacement = useCallback((point) => {
    if (!pendingPlacement || !point) return false;
    const entity = pendingPlacement;
    patchConfigWithoutHistory((next) => {
      moveMapEntityToPoint(next, entity, point, { snap: false });
    }, false);
    setPendingPlacement(null);
    setSelected(entity);
    setMultiSelected(canMultiSelectEntity(entity) ? [entity] : []);
    return true;
  }, [patchConfigWithoutHistory, pendingPlacement]);

  const importStudioCharacterToCanvas = useCallback((model) => {
    if (!model) return;
    let placedEntity = null;
    patchConfig((next) => {
      const position = getCurrentPlacementPoint(next);
      const axisScale = getCharacterModelAxisScale(model);
      if ((model.role || 'hero') === 'hero') {
        next.heroes = Array.isArray(next.heroes) ? next.heroes : [];
        const item = {
          id: createId('hero'),
          name: model.name || 'Heros',
          x: position.x,
          y: position.y,
          z: 0,
          rotation: 0,
          character: 'runner',
          characterImageData: '',
          characterImageName: '',
          characterModel3dId: '',
          characterModelUrl: '',
          characterModelName: '',
          characterModelResources: [],
          characterModelAnimations: {},
          characterRenderMode: getStudioCharacterRenderMode(model),
          characterModelScale: axisScale.y,
          characterModelScaleX: axisScale.x,
          characterModelScaleY: axisScale.y,
          characterModelScaleZ: axisScale.z,
          characterModelScaleProportional: model.characterModelScaleProportional !== false,
          characterMaterialBrightness: 1,
          sourceCharacterRole: 'hero',
        };
        if (getStudioModelSource(model)) applyCharacterModelToActor(item, model);
        next.heroes.push(item);
        placedEntity = { type: 'hero', id: item.id };
        return;
      }

      next.enemies = Array.isArray(next.enemies) ? next.enemies : [];
      const item = {
        id: createId('enemy'),
        x: position.x,
        y: position.y,
        z: 0,
        rotation: 0,
        role: 'rifle',
        character: 'guard',
        characterImageData: '',
        characterImageName: '',
        characterModel3dId: '',
        characterModelUrl: '',
        characterModelName: '',
        characterModelResources: [],
        characterModelAnimations: {},
        characterRenderMode: getStudioCharacterRenderMode(model),
        characterModelScale: axisScale.y,
        characterModelScaleX: axisScale.x,
        characterModelScaleY: axisScale.y,
        characterModelScaleZ: axisScale.z,
        characterModelScaleProportional: model.characterModelScaleProportional !== false,
        characterMaterialBrightness: 1,
        sourceCharacterRole: model.role || 'enemy',
        combatEnemyName: model.name || 'Personnage',
        combatEnemyMaxHealth: 8,
        combatEnemyStrength: 2,
        combatEnemyMaxMana: 0,
        combatEnemyPowerManaCost: 3,
        combatEnemyPowerDamage: 0,
        combatEnemyPowerUsageChance: 25,
      };
      if (getStudioModelSource(model)) applyCharacterModelToActor(item, model);
      next.enemies.push(item);
      placedEntity = { type: 'enemy', id: item.id };
    });
    beginEntityPlacement(placedEntity);
  }, [beginEntityPlacement, getCurrentPlacementPoint, patchConfig]);

  const importStudioDecorToCanvas = useCallback((model) => {
    if (!model) return;
    let placedEntity = null;
    patchConfig((next) => {
      next.props = Array.isArray(next.props) ? next.props : [];
      const position = getCurrentPlacementPoint(next);
      const renderMode = getDecorImportRenderMode(model);
      const source = getStudioModelSource(model);
      const size = getDecorModelWorldSize(model);
      const tileSize = renderMode === 'floor' ? Math.max(size.width, size.depth) : 0;
      const item = {
        id: createId('prop'),
        name: model.name || 'Objet 3D',
        decorKind: getStudioDecorKindId(model.kind),
        x: position.x,
        y: position.y,
        z: 0,
        floorZeroZ: getFloorZeroZ(model),
        rotation: 0,
        modelRotationX: getModelRotationValue(model, 'modelRotationX'),
        modelRotationY: getModelRotationValue(model, 'modelRotationY'),
        modelRotationZ: getModelRotationValue(model, 'modelRotationZ'),
        modelCenterOnOrigin: Boolean(model.modelCenterOnOrigin),
        modelFlushToGround: Boolean(model.modelFlushToGround),
        r: Math.round((tileSize || Math.max(size.width, size.depth)) / 2),
        w: tileSize || size.width,
        h: tileSize || size.depth,
        modelHeight: renderMode === 'floor' ? 12 : size.height,
        renderMode,
        blocksMovement: model.collision ?? shouldPropBlockByMode(renderMode),
        imageData: source ? '' : (model.imageData || ''),
        imageName: source ? '' : (model.imageName || ''),
        repeatTexture: source ? false : Boolean(model.repeatTexture),
        decorModel3dId: model.id || '',
        decorModelUrl: source,
        decorModelName: model.modelName || model.name || '',
        decorLocalModelFileId: model.localModelFileId || '',
        modelFormat: model.modelFormat || '',
        modelFileSize: Number(model.modelFileSize) || 0,
        modelResources: Array.isArray(model.modelResources) ? model.modelResources : [],
        materialBrightness: getDecorMaterialBrightness(model),
        decorModelScale: 1,
        baseColor: model.baseColor || '#64748b',
        accentColor: model.accentColor || '#f59e0b',
        roofColor: model.roofColor || '#7f1d1d',
      };
      next.props.push(item);
      placedEntity = { type: 'prop', id: item.id };
    });
    beginEntityPlacement(placedEntity);
  }, [beginEntityPlacement, getCurrentPlacementPoint, patchConfig]);

  const addFlatGroundToCanvas = useCallback(() => {
    const baseColor = getFlatGroundPlateauColor(configRef.current, flatGroundColorDraft);
    patchConfig((next) => {
      const world = next.world || DEFAULT_ARCADE_CONFIG.world;
      const width = Math.max(12, Math.round(Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width));
      const height = Math.max(12, Math.round(Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height));
      next.props = Array.isArray(next.props) ? next.props : [];
      const existingIndex = next.props.findIndex((prop) => isFlatGroundPlateauProp(prop, world));
      const existing = existingIndex >= 0 ? next.props[existingIndex] : null;
      const plateau = {
        ...(existing || {}),
        id: existing?.id || createId('prop'),
        name: 'Sol plat',
        decorKind: 'road',
        x: Math.round(width / 2),
        y: Math.round(height / 2),
        z: 0,
        floorZeroZ: DEFAULT_FLOOR_ZERO_Z,
        rotation: 0,
        modelRotationX: 0,
        modelRotationY: 0,
        modelRotationZ: 0,
        modelCenterOnOrigin: true,
        modelFlushToGround: false,
        r: Math.round(Math.max(width, height) / 2),
        w: width,
        h: height,
        modelHeight: 12,
        renderMode: 'floor',
        blocksMovement: false,
        imageData: '',
        imageName: '',
        repeatTexture: false,
        baseColor,
        floorColor: baseColor,
      };
      if (existingIndex >= 0) {
        const keptProps = next.props
          .filter((prop, index) => index === existingIndex || !isFlatGroundPlateauProp(prop, world));
        const keptIndex = keptProps.findIndex((prop) => prop.id === existing.id);
        keptProps[keptIndex] = plateau;
        next.props = keptProps;
      } else {
        next.props.push(plateau);
      }
      setSelected(null);
      setMultiSelected([]);
    }, false);
    setMode('edit');
    setTool('select');
    setPendingPlacement(null);
    setTransformTool('');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
  }, [flatGroundColorDraft, patchConfig]);

  const updateFlatGroundColor = useCallback((value) => {
    const color = getHexColor(value, FLAT_GROUND_DEFAULT_COLOR);
    setFlatGroundColorDraft(color);
    const liveConfig = configRef.current || DEFAULT_ARCADE_CONFIG;
    const hasPlateau = (liveConfig.props || []).some((prop) => isFlatGroundPlateauProp(prop, liveConfig.world));
    if (!hasPlateau) return;
    patchConfigWithoutHistory((next) => {
      (next.props || []).forEach((prop) => {
        if (!isFlatGroundPlateauProp(prop, next.world)) return;
        prop.baseColor = color;
        prop.floorColor = color;
      });
    }, false);
  }, [patchConfigWithoutHistory]);

  const updateTerrainPaintDraft = useCallback((field, value) => {
    setTerrainPaintDraft((current) => {
      if (field === 'color') return { ...current, color: getHexColor(value, TERRAIN_PAINT_DEFAULT_COLOR) };
      if (field === 'radius') {
        const radius = Number(value);
        return {
          ...current,
          radius: clamp(Number.isFinite(radius) ? radius : TERRAIN_PAINT_DEFAULT_RADIUS, TERRAIN_PAINT_MIN_RADIUS, TERRAIN_PAINT_MAX_RADIUS),
        };
      }
      if (field === 'opacity') {
        const opacity = Number(value);
        return { ...current, opacity: clamp(Number.isFinite(opacity) ? opacity : TERRAIN_PAINT_DEFAULT_OPACITY, 0.12, 1) };
      }
      if (field === 'shape') return { ...current, shape: getTerrainPaintShape({ shape: value }) };
      return current;
    });
  }, []);

  const clearTerrainPaint = useCallback(() => {
    if (!(configRef.current?.terrainPaintStrokes || []).length) return;
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
    terrainPaintLastPointRef.current = null;
    terrainPaintSessionRef.current = null;
    patchConfig((next) => {
      next.terrainPaintStrokes = [];
    }, false);
  }, [clearTerrainPaintFlushTimer, patchConfig]);

  const handleTerrainPaintStart = useCallback((point) => {
    if (!point || modeRef.current !== 'edit') return;
    const strokeId = createId('paint');
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
    terrainPaintSessionRef.current = strokeId;
    setSelected(null);
    setMultiSelected([]);
    patchConfig((next) => {
      const paintPoint = normalizeTerrainPaintPoint(point, next.world);
      terrainPaintLastPointRef.current = paintPoint;
      next.terrainPaintStrokes = Array.isArray(next.terrainPaintStrokes) ? next.terrainPaintStrokes : [];
      next.terrainPaintStrokes.push({
        id: strokeId,
        color: getTerrainPaintColor(terrainPaintDraft),
        radius: getTerrainPaintRadius(terrainPaintDraft),
        opacity: getTerrainPaintOpacity(terrainPaintDraft),
        shape: getTerrainPaintShape(terrainPaintDraft),
        points: [paintPoint],
      });
    }, false);
  }, [clearTerrainPaintFlushTimer, patchConfig, terrainPaintDraft]);

  const handleTerrainPaintMove = useCallback((point) => {
    const strokeId = terrainPaintSessionRef.current;
    if (!strokeId || !point) return;
    const currentStroke = (configRef.current?.terrainPaintStrokes || []).find((stroke) => stroke.id === strokeId);
    if (!currentStroke) return;
    const paintPoint = normalizeTerrainPaintPoint(point, configRef.current?.world);
    const previousPoint = terrainPaintLastPointRef.current
      || currentStroke.points?.[currentStroke.points.length - 1];
    const spacing = Math.max(10, getTerrainPaintRadius(currentStroke) * 0.18);
    if (previousPoint && distance(previousPoint, paintPoint) < spacing) return;
    terrainPaintLastPointRef.current = paintPoint;
    terrainPaintPendingPointsRef.current.push(paintPoint);
    scheduleTerrainPaintFlush();
  }, [scheduleTerrainPaintFlush]);

  const handleTerrainPaintEnd = useCallback(() => {
    flushTerrainPaintPoints();
    terrainPaintSessionRef.current = null;
    terrainPaintLastPointRef.current = null;
  }, [flushTerrainPaintPoints]);

  const appendModelEraserStroke = useCallback((point, entity, withHistory = false) => {
    if (!point || !entity?.id || entity.type !== 'prop') return false;
    let didAppend = false;
    const recipe = (next) => {
      const currentProp = getSelectedEntity(next, entity);
      if (!currentProp?.item || getPropRenderMode(currentProp.item) !== 'glb') return;
      const radius = getModelEraserRadius({
        modelEraserRadius: currentProp.item.modelEraserRadius ?? modelEraserRadiusDraft,
      });
      const stroke = createModelEraserSurfaceStroke(point, radius, createId('erase'));
      if (!stroke) return;
      currentProp.item.modelEraserRadius = radius;
      currentProp.item.modelEraserStrokes = [
        ...getModelEraserStrokes(currentProp.item),
        stroke,
      ].slice(-MODEL_ERASER_MAX_STROKES);
      didAppend = true;
    };
    if (withHistory) patchConfig(recipe, false);
    else patchConfigWithoutHistory(recipe, false);
    if (didAppend) modelEraserLastPointRef.current = normalizeModelEraserHit(point);
    return didAppend;
  }, [modelEraserRadiusDraft, patchConfig, patchConfigWithoutHistory]);

  const handleModelEraseStart = useCallback((point) => {
    if (!point || modeRef.current !== 'edit') return;
    const target = selectedRef.current;
    const currentProp = getSelectedEntity(configRef.current, target);
    if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
    modelEraserSessionRef.current = { entity: { type: target.type, id: target.id } };
    modelEraserLastPointRef.current = null;
    setMultiSelected([]);
    appendModelEraserStroke(point, target, true);
  }, [appendModelEraserStroke, configRef]);

  const handleModelEraseMove = useCallback((point) => {
    const session = modelEraserSessionRef.current;
    if (!session?.entity || !point) return;
    const currentProp = getSelectedEntity(configRef.current, session.entity);
    if (!currentProp?.item || getPropRenderMode(currentProp.item) !== 'glb') return;
    const radius = getModelEraserRadius(currentProp.item);
    const previousPoint = modelEraserLastPointRef.current;
    const spacing = Math.max(8, radius * 0.2);
    if (previousPoint && modelEraserHitDistance(previousPoint, point) < spacing) return;
    appendModelEraserStroke(point, session.entity, false);
  }, [appendModelEraserStroke, configRef]);

  const handleModelEraseEnd = useCallback(() => {
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
  }, []);

  const updateEntity = useCallback((field, rawValue) => {
    const value = NUMERIC_ENTITY_FIELDS.has(field) ? Number(rawValue) : rawValue;
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, selected);
      if (!selectedEntity?.item) return;
      selectedEntity.item[field] = field === 'rotation' ? normalizeDegrees(value) : value;
      if (field === 'x') selectedEntity.item.x = clamp(value, 0, next.world.width);
      if (field === 'y') selectedEntity.item.y = clamp(value, 0, next.world.height);
      if (field === 'z') selectedEntity.item.z = clamp(value, ENTITY_Z_MIN, ENTITY_Z_MAX);
      if (field === 'floorZeroZ') selectedEntity.item.floorZeroZ = clamp(value, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
      if (field === 'characterModelScale') {
        const scale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
        selectedEntity.item.characterModelScale = scale;
        selectedEntity.item.characterModelScaleY = scale;
        if (selectedEntity.item.characterModelScaleProportional !== false) {
          selectedEntity.item.characterModelScaleX = scale;
          selectedEntity.item.characterModelScaleZ = scale;
        }
      }
      if (field === 'characterModelScaleX' || field === 'characterModelScaleY' || field === 'characterModelScaleZ') {
        selectedEntity.item[field] = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
        if (field === 'characterModelScaleY') selectedEntity.item.characterModelScale = selectedEntity.item[field];
      }
      if (field === 'characterMaterialBrightness') selectedEntity.item.characterMaterialBrightness = clamp(value, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
      if (field === 'decorModelScale') selectedEntity.item.decorModelScale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
      if (field === 'materialBrightness') selectedEntity.item.materialBrightness = clamp(value, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
      if (field === 'modelRotationX' || field === 'modelRotationY' || field === 'modelRotationZ') {
        selectedEntity.item[field] = clamp(value, -180, 180);
      }
      if (selectedEntity.type === 'prop' && isFloorTileProp(selectedEntity.item) && ['w', 'h', 'r'].includes(field)) {
        const maxTileSize = getWorldCoverTileSize(next.world);
        const tileSize = field === 'r'
          ? Math.round(clamp((Number(value) || 6) * 2, 12, maxTileSize))
          : Math.round(clamp(Number(value) || getFloorTileWorldSize(selectedEntity.item), 12, maxTileSize));
        selectedEntity.item.w = tileSize;
        selectedEntity.item.h = tileSize;
        selectedEntity.item.r = Math.round(tileSize / 2);
        selectedEntity.item.modelHeight = 12;
        selectedEntity.item.blocksMovement = false;
      }
      if (selectedEntity.type === 'prop' && isFlatTileLikeProp(selectedEntity.item) && ['x', 'y'].includes(field)) {
        snapFlatTileToNeighbors(selectedEntity.item, next.props || [], next.world);
        snapFlatTileToWorldEdges(selectedEntity.item, next.world);
      }
      if (selectedEntity.type === 'actionZone') {
        if (field === 'w') selectedEntity.item.w = Math.round(clamp(Number(value) || ACTION_ZONE_DEFAULT_WIDTH, ACTION_ZONE_MIN_SIZE, next.world.width));
        if (field === 'h') selectedEntity.item.h = Math.round(clamp(Number(value) || ACTION_ZONE_DEFAULT_HEIGHT, ACTION_ZONE_MIN_SIZE, next.world.height));
        if (field === 'modelHeight') selectedEntity.item.modelHeight = Math.round(clamp(Number(value) || ACTION_ZONE_DEFAULT_MODEL_HEIGHT, 60, 900));
        if (field === 'opacity') selectedEntity.item.opacity = clamp(Number(value) || ACTION_ZONE_DEFAULT_OPACITY, 0.05, 0.95);
        const width = getActionZoneWidth(selectedEntity.item);
        const height = getActionZoneHeight(selectedEntity.item);
        selectedEntity.item.x = Math.round(clamp(Number(selectedEntity.item.x) || width / 2, width / 2, Math.max(width / 2, next.world.width - width / 2)));
        selectedEntity.item.y = Math.round(clamp(Number(selectedEntity.item.y) || height / 2, height / 2, Math.max(height / 2, next.world.height - height / 2)));
      }
    });
  }, [patchConfig, selected]);

  const updateSelectionEntities = useCallback((field, rawValue) => {
    if (NUMERIC_ENTITY_FIELDS.has(field) && rawValue === '') return;
    const value = NUMERIC_ENTITY_FIELDS.has(field) ? Number(rawValue) : rawValue;
    const numericValue = Number(value);
    if (NUMERIC_ENTITY_FIELDS.has(field) && !Number.isFinite(numericValue)) return;
    patchConfig((next) => {
      const targets = getSelectionEntities(next, selected, multiSelected);
      if (targets.length <= 1) {
        const selectedEntity = getSelectedEntity(next, selected);
        if (!selectedEntity?.item) return;
        selectedEntity.item[field] = field === 'rotation' ? normalizeDegrees(value) : value;
        if (field === 'floorZeroZ') selectedEntity.item.floorZeroZ = clamp(numericValue, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
        return;
      }

      if (field === 'x' || field === 'y') {
        const bounds = getSelectionBoundsFromEntities(targets);
        if (!bounds) return;
        const world = next.world || DEFAULT_ARCADE_CONFIG.world;
        const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
        const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
        const targetCenterX = field === 'x'
          ? clamp(numericValue, bounds.width / 2, Math.max(bounds.width / 2, worldWidth - bounds.width / 2))
          : bounds.centerX;
        const targetCenterY = field === 'y'
          ? clamp(numericValue, bounds.height / 2, Math.max(bounds.height / 2, worldHeight - bounds.height / 2))
          : bounds.centerY;
        const delta = {
          x: targetCenterX - bounds.centerX,
          y: targetCenterY - bounds.centerY,
        };
        targets.forEach((target) => {
          moveMapEntityByDelta(next, target, delta, { snap: false });
        });
        return;
      }

      if (field === 'z') {
        targets.forEach(({ type, item }) => {
          if (canEntityLevitate(type)) item.z = clamp(numericValue, ENTITY_Z_MIN, ENTITY_Z_MAX);
        });
        return;
      }

      if (field === 'floorZeroZ') {
        targets.forEach(({ type, item }) => {
          if (type === 'prop' && isFlatTileLikeProp(item)) item.floorZeroZ = clamp(numericValue, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
        });
        return;
      }

      if (field === 'rotation') {
        targets.forEach(({ type, item }) => {
          if (ROTATABLE_ENTITY_TYPES.has(type)) item.rotation = normalizeDegrees(numericValue);
        });
      }
    });
  }, [multiSelected, patchConfig, selected]);

  const handleSelectionTransformCommit = useCallback((payload = {}) => {
    const { entity, mode: transformMode, rotationDelta = {}, scaleDelta = {} } = payload;
    if (!entity?.type || !entity.id) return;
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, entity);
      if (!selectedEntity?.item) return;
      const item = selectedEntity.item;
      if (transformMode === 'rotate') {
        const deltaY = Number(rotationDelta.y) || 0;
        if (ROTATABLE_ENTITY_TYPES.has(selectedEntity.type) && Math.abs(deltaY) > 0.01) {
          item.rotation = normalizeDegrees((Number(item.rotation) || 0) + deltaY);
        }
        if (selectedEntity.type === 'prop' && getPropRenderMode(item) === 'glb') {
          const deltaX = Number(rotationDelta.x) || 0;
          const deltaZ = Number(rotationDelta.z) || 0;
          if (Math.abs(deltaX) > 0.01) item.modelRotationX = clamp(getModelRotationValue(item, 'modelRotationX') + deltaX, -180, 180);
          if (Math.abs(deltaZ) > 0.01) item.modelRotationZ = clamp(getModelRotationValue(item, 'modelRotationZ') + deltaZ, -180, 180);
        }
        return;
      }
      if (transformMode === 'scale') {
        scaleSelectionEntity(next, {
          type: selectedEntity.type,
          id: entity.id,
          item,
        }, scaleDelta);
      }
    }, false);
  }, [patchConfig]);

  const updateSelectedNpcChoice = useCallback((choiceId, field, value) => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcChoices = getNpcChoiceItems(currentZone.item).map((choice) => (
        choice.id === choiceId ? { ...choice, [field]: value } : choice
      ));
    }, false);
  }, [patchConfig, selected]);

  const addSelectedNpcChoice = useCallback(() => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcChoices = [
        ...getNpcChoiceItems(currentZone.item),
        createNpcChoice(`Reponse ${getNpcChoiceItems(currentZone.item).length + 1}`, ''),
      ];
    }, false);
  }, [patchConfig, selected]);

  const removeSelectedNpcChoice = useCallback((choiceId) => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      const nextChoices = getNpcChoiceItems(currentZone.item).filter((choice) => choice.id !== choiceId);
      currentZone.item.npcChoices = nextChoices.length ? nextChoices : createDefaultNpcChoices().slice(0, 1);
    }, false);
  }, [patchConfig, selected]);

  const closeNpcChoice = useCallback(() => {
    setActiveNpcChoice(null);
    setIsPaused(false);
  }, []);

  const handleNpcChoiceSelect = useCallback((choice) => {
    const response = choice?.response || choice?.label || 'Choix pris en compte.';
    stateRef.current.actionMessage = response;
    stateRef.current.actionMessageTimer = 3;
    setGameSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
    setActiveNpcChoice(null);
    setIsPaused(false);
  }, []);

  const handleWorldDragStart = useCallback((entity) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected({ type: entity.type, id: entity.id });
    const liveConfig = configRef.current;
    const activeEntity = { type: entity.type, id: entity.id };
    const group = multiSelected.some((entry) => isSameEntity(entry, activeEntity))
      ? multiSelected
      : [activeEntity];
    const anchor = getEntityCenterPoint(liveConfig, activeEntity);
    multiDragRef.current = anchor ? {
      anchor,
      items: group
        .filter(canMultiSelectEntity)
        .map((entry) => ({ entity: entry, start: getEntityCenterPoint(liveConfig, entry) }))
        .filter((entry) => entry.start),
    } : null;
    if (!multiSelected.some((entry) => isSameEntity(entry, activeEntity))) {
      setMultiSelected([activeEntity]);
    }
  }, [multiSelected]);

  const handleWorldDrag = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    if (multiDragRef.current) multiDragRef.current.latestPoint = point;
  }, []);

  const resolveWorldDragPoint = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate' || !multiDragRef.current) return point;
    return resolveFlatTileDragPoint(configRef.current, multiDragRef.current, entity, point, { snap: true });
  }, []);

  const handleWorldDrop = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    patchConfig((next) => {
      if (multiDragRef.current?.items?.length) {
        applyGroupDragToConfig(next, multiDragRef.current, point, { snap: true });
      } else {
        moveMapEntityToPoint(next, entity, point, { snap: true });
      }
    }, false);
    multiDragRef.current = null;
  }, [patchConfig]);

  const duplicateSelected = useCallback(() => {
    const liveTargets = getSelectionEntities(configRef.current, selected, multiSelected);
    if (!liveTargets.length || !liveTargets.every(isDuplicableSelectionEntity)) return;
    patchConfig((next) => {
      const targets = getSelectionEntities(next, selected, multiSelected);
      if (!targets.length || !targets.every(isDuplicableSelectionEntity)) return;
      const commonOffset = targets.length > 1
        ? getSelectionDuplicateOffset(targets, next.world)
        : null;
      const nextSelection = targets
        .map((target) => duplicateMapEntityIntoConfig(next, target, commonOffset))
        .filter(Boolean);
      setSelected(nextSelection[nextSelection.length - 1] || null);
      setMultiSelected(nextSelection);
    });
  }, [multiSelected, patchConfig, selected]);

  const duplicateSelectedTile = useCallback((direction, sourceId = selected?.id) => {
    if (!sourceId) return;
    patchConfig((next) => {
      const collection = next.props || [];
      const selectedTileIds = new Set((multiSelected || [])
        .filter((entry) => entry?.type === 'prop')
        .map((entry) => entry.id));
      const selectedTiles = selectedTileIds.size > 1
        ? collection.filter((item) => selectedTileIds.has(item.id) && isFlatTileLikeProp(item))
        : [];
      if (selectedTiles.length > 1) {
        const bounds = getFlatTileWorldBounds(selectedTiles);
        if (!bounds) return;
        const groupWidth = Math.max(12, bounds.maxX - bounds.minX);
        const groupHeight = Math.max(12, bounds.maxY - bounds.minY);
        const overlapX = getFlatTileSnapOverlap(groupWidth);
        const overlapY = getFlatTileSnapOverlap(groupHeight);
        const offsets = {
          left: { x: -(groupWidth - overlapX), y: 0 },
          right: { x: groupWidth - overlapX, y: 0 },
          up: { x: 0, y: -(groupHeight - overlapY) },
          down: { x: 0, y: groupHeight - overlapY },
        };
        const offset = { ...(offsets[direction] || offsets.right) };
        const worldWidth = Number(next.world?.width) || groupWidth;
        const worldHeight = Number(next.world?.height) || groupHeight;
        if (bounds.minX + offset.x < 0) offset.x += -(bounds.minX + offset.x);
        if (bounds.maxX + offset.x > worldWidth) offset.x -= bounds.maxX + offset.x - worldWidth;
        if (bounds.minY + offset.y < 0) offset.y += -(bounds.minY + offset.y);
        if (bounds.maxY + offset.y > worldHeight) offset.y -= bounds.maxY + offset.y - worldHeight;
        const copies = selectedTiles.map((original) => {
          const { width: tileWidth, height: tileHeight } = getFlatTileWorldDimensions(original);
          const copy = structuredClone(original);
          copy.id = createId('prop');
          copy.name = original.name || 'Dalle sol';
          if (isFloorTileProp(copy)) {
            copy.w = tileWidth;
            copy.h = tileHeight;
            copy.r = Math.round(Math.max(tileWidth, tileHeight) / 2);
            copy.modelHeight = 12;
          }
          copy.blocksMovement = false;
          copy.x = clamp((Number(original.x) || 0) + offset.x, tileWidth / 2, worldWidth - tileWidth / 2);
          copy.y = clamp((Number(original.y) || 0) + offset.y, tileHeight / 2, worldHeight - tileHeight / 2);
          return copy;
        });
        collection.push(...copies);
        next.props = collection;
        const nextSelection = copies.map((copy) => ({ type: 'prop', id: copy.id }));
        setSelected(nextSelection[nextSelection.length - 1] || null);
        setMultiSelected(nextSelection);
        return;
      }
      const original = collection.find((item) => item.id === sourceId);
      if (!original || !isFlatTileLikeProp(original)) return;
      const { width: tileWidth, height: tileHeight } = getFlatTileWorldDimensions(original);
      const overlapX = getFlatTileSnapOverlap(tileWidth);
      const overlapY = getFlatTileSnapOverlap(tileHeight);
      const offsets = {
        left: { x: -(tileWidth - overlapX), y: 0 },
        right: { x: tileWidth - overlapX, y: 0 },
        up: { x: 0, y: -(tileHeight - overlapY) },
        down: { x: 0, y: tileHeight - overlapY },
      };
      const offset = offsets[direction] || offsets.right;
      const copy = structuredClone(original);
      copy.id = createId('prop');
      copy.name = original.name || 'Dalle sol';
      if (isFloorTileProp(copy)) {
        copy.w = tileWidth;
        copy.h = tileHeight;
        copy.r = Math.round(Math.max(tileWidth, tileHeight) / 2);
        copy.modelHeight = 12;
        copy.blocksMovement = false;
      }
      copy.blocksMovement = false;
      copy.x = clamp((Number(original.x) || 0) + offset.x, tileWidth / 2, next.world.width - tileWidth / 2);
      copy.y = clamp((Number(original.y) || 0) + offset.y, tileHeight / 2, next.world.height - tileHeight / 2);
      collection.push(copy);
      next.props = collection;
      setSelected({ type: 'prop', id: copy.id });
      setMultiSelected([{ type: 'prop', id: copy.id }]);
    }, false);
  }, [multiSelected, patchConfig, selected?.id]);

  const snapSelectedTileToNeighbor = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item || !isFloorTileProp(currentProp.item)) return;
      snapFlatTileToNeighbors(currentProp.item, next.props || [], next.world, { force: true });
    }, false);
  }, [patchConfig, selected]);

  const flattenSelectedProp = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      const prop = currentProp.item;
      const renderMode = getPropRenderMode(prop);
      prop.floorZeroZ = getFloorZeroZ(prop);
      if (renderMode === 'floor' || (renderMode === 'billboard' && prop.imageData)) {
        const tileSize = getFloorTileWorldSize(prop);
        prop.renderMode = 'floor';
        prop.w = tileSize;
        prop.h = tileSize;
        prop.r = Math.round(tileSize / 2);
        prop.modelHeight = 12;
        prop.blocksMovement = false;
        prop.modelRotationX = 0;
        prop.modelRotationY = 0;
        prop.modelRotationZ = 0;
        prop.modelCenterOnOrigin = true;
        prop.modelFlushToGround = false;
        return;
      }
      prop.modelRotationX = -90;
      prop.modelRotationY = 0;
      prop.modelRotationZ = 0;
      prop.modelCenterOnOrigin = true;
      prop.modelFlushToGround = true;
    }, false);
  }, [patchConfig, selected]);

  const resetSelectedPropOrientation = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelRotationX = 0;
      currentProp.item.modelRotationY = 0;
      currentProp.item.modelRotationZ = 0;
      currentProp.item.modelFlushToGround = false;
    }, false);
  }, [patchConfig, selected]);

  const centerSelectedPropModel = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelCenterOnOrigin = true;
    }, false);
  }, [patchConfig, selected]);

  const flushSelectedPropToGround = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelFlushToGround = true;
      currentProp.item.z = 0;
    }, false);
  }, [patchConfig, selected]);

  const deleteSelected = useCallback(() => {
    const targets = getDeletableSelectionEntities(configRef.current, selected, multiSelected);
    if (!targets.length) return;
    setPendingPlacement(null);
    patchConfig((next) => {
      targets.forEach((target) => {
        const key = MAP_ENTITY_COLLECTIONS[target.type];
        if (!key) return;
        next[key] = (next[key] || []).filter((item) => item.id !== target.id);
      });
    });
    setSelected(null);
    setMultiSelected([]);
  }, [multiSelected, patchConfig, selected]);

  useEffect(() => {
    const handleDeleteShortcut = (event) => {
      if (!['Delete', 'Backspace'].includes(event.code)) return;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (mode !== 'edit' || isEditableShortcutTarget(event.target)) return;
      if (!getDeletableSelectionEntities(configRef.current, selected, multiSelected).length) return;
      event.preventDefault();
      deleteSelected();
    };
    window.addEventListener('keydown', handleDeleteShortcut);
    return () => window.removeEventListener('keydown', handleDeleteShortcut);
  }, [deleteSelected, mode, multiSelected, selected]);

  const renameMapEntity = useCallback((type, id, name) => {
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, { type, id });
      if (!selectedEntity?.item) return;
      if (type === 'enemy') selectedEntity.item.combatEnemyName = name;
      else selectedEntity.item.name = name;
    }, false);
  }, [patchConfig]);

  const deleteMapEntity = useCallback((type, id) => {
    const collectionName = MAP_ENTITY_COLLECTIONS[type];
    if (!collectionName) return;
    patchConfig((next) => {
      if (isProtectedMapEntity(next, { type, id })) return;
      next[collectionName] = (next[collectionName] || []).filter((item) => item.id !== id);
    });
    setSelected((current) => (current?.type === type && current.id === id ? null : current));
    setMultiSelected((current) => current.filter((entry) => !(entry.type === type && entry.id === id)));
  }, [patchConfig]);

  const editMapEntity = useCallback((type, id) => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected({ type, id });
    setMultiSelected([{ type, id }]);
    setWorkspaceTab('arcade');
  }, []);

  const handleWorldClick = useCallback((point, entity = null, button = 0) => {
    if (mode === 'play') {
      if (button === 0) {
        setPlayerMoveTarget(point);
      }
      return;
    }
    if (mode !== 'edit') return;
    if (pendingPlacement && button === 0) {
      commitPendingPlacement(point);
      return;
    }
    if (entity?.type === 'tileDuplicate') {
      duplicateSelectedTile(entity.direction, entity.id);
      return;
    }
    if (tool === 'select') {
      const target = entity || findEntityAt(configRef.current, point);
      if (multiSelectMode) {
        if (canMultiSelectEntity(target)) toggleMultiSelectedEntity(target);
        else {
          setSelected(null);
          setMultiSelected([]);
        }
        return;
      }
      selectSingleEntity(target);
      return;
    }
    patchConfig((next) => {
      if (tool === 'obstacle') {
        const item = { id: createId('wall'), x: Math.round(point.x - 90), y: Math.round(point.y - 35), z: 0, w: 180, h: 70 };
        next.obstacles.push(item);
        setSelected({ type: 'obstacle', id: item.id });
      }
      if (tool === 'enemy') {
        const item = {
          id: createId('enemy'),
          x: Math.round(point.x),
          y: Math.round(point.y),
          z: 0,
          rotation: 0,
          role: 'rifle',
          character: 'guard',
          characterImageData: '',
          characterImageName: '',
          characterModel3dId: '',
          characterModelUrl: '',
          characterModelName: '',
          characterModelResources: [],
          characterModelAnimations: {},
          characterRenderMode: 'capsule',
          characterModelScale: 1,
          characterMaterialBrightness: 1,
          combatEnemyName: 'Ennemi',
          combatEnemyMaxHealth: 8,
          combatEnemyStrength: 2,
          combatEnemyMaxMana: 0,
          combatEnemyPowerManaCost: 3,
          combatEnemyPowerDamage: 0,
          combatEnemyPowerUsageChance: 25,
        };
        next.enemies.push(item);
        setSelected({ type: 'enemy', id: item.id });
      }
      if (tool === 'pickup') {
        const item = { id: createId('pickup'), x: Math.round(point.x), y: Math.round(point.y), z: 0, type: 'health' };
        next.pickups.push(item);
        setSelected({ type: 'pickup', id: item.id });
      }
      if (tool === 'actionZone') {
        const item = {
          id: createId('zone'),
          name: 'Zone transparente',
          x: Math.round(point.x),
          y: Math.round(point.y),
          rotation: 0,
          w: ACTION_ZONE_DEFAULT_WIDTH,
          h: ACTION_ZONE_DEFAULT_HEIGHT,
          modelHeight: ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
          renderMode: 'volume',
          color: '#38bdf8',
          opacity: ACTION_ZONE_DEFAULT_OPACITY,
          actionType: 'portal',
          targetCanvasId: getDefaultPortalTargetCanvasId(studioProjectRef.current),
          targetNpcId: '',
          npcAction: 'talk',
          npcInteractionMode: 'message',
          npcQuestion: 'Que veux-tu demander ?',
          npcChoices: createDefaultNpcChoices(),
          message: '',
          triggerMode: 'enter',
          visibleInPlay: false,
        };
        next.actionZones = Array.isArray(next.actionZones) ? next.actionZones : [];
        next.actionZones.push(item);
        setSelected({ type: 'actionZone', id: item.id });
      }
      if (tool === 'relief') {
        const item = {
          id: createId('relief'),
          name: 'Relief',
          x: Math.round(point.x),
          y: Math.round(point.y),
          w: 300,
          h: 180,
          elevation: 28,
          style: 'plateau',
          blocksMovement: false,
        };
        next.reliefs = Array.isArray(next.reliefs) ? next.reliefs : [];
        next.reliefs.push(item);
        setSelected({ type: 'relief', id: item.id });
      }
      if (tool === 'prop') {
        const item = {
          id: createId('prop'),
          name: 'Decor',
          x: Math.round(point.x),
          y: Math.round(point.y),
          z: 0,
          rotation: 0,
          modelRotationX: 0,
          modelRotationY: 0,
          modelRotationZ: 0,
          modelCenterOnOrigin: false,
          modelFlushToGround: false,
          r: 34,
          w: 68,
          h: 68,
          modelHeight: 68,
          renderMode: 'rock',
          blocksMovement: true,
          imageData: '',
          imageName: '',
        };
        next.props.push(item);
        setSelected({ type: 'prop', id: item.id });
      }
    });
    if (tool === 'actionZone') setTool('select');
  }, [commitPendingPlacement, duplicateSelectedTile, mode, multiSelectMode, patchConfig, pendingPlacement, selectSingleEntity, setPlayerMoveTarget, toggleMultiSelectedEntity, tool]);

  const handleMarqueeSelect = useCallback((entities = []) => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    const seen = new Set();
    const nextSelection = entities
      .filter(canMultiSelectEntity)
      .filter((entity) => {
        const key = `${entity.type}:${entity.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    setMultiSelected(nextSelection);
    setSelected(nextSelection[nextSelection.length - 1] || null);
  }, []);

  const exportConfig = useCallback(async () => {
    const payload = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  }, [config]);

  const selectedEntity = useMemo(() => getSelectedEntity(config, selected), [config, selected]);
  const inspectorSelectionEntities = useMemo(
    () => getSelectionEntities(config, selected, multiSelected),
    [config, multiSelected, selected],
  );
  const hasMultiInspectorSelection = inspectorSelectionEntities.length > 1;
  const inspectorSelectionBounds = useMemo(
    () => getSelectionBoundsFromEntities(inspectorSelectionEntities),
    [inspectorSelectionEntities],
  );
  const dashReady = snapshot.player.dashCooldown <= 0;
  const playMode = mode === 'play';
  const engineConfig = { ...DEFAULT_ARCADE_CONFIG.engine, ...(config.engine || {}) };
  const lightIntensityValue = Number.isFinite(Number(engineConfig.lightIntensity))
    ? Number(engineConfig.lightIntensity)
    : DEFAULT_ARCADE_CONFIG.engine.lightIntensity;
  const lightOrientationValue = Number.isFinite(Number(engineConfig.lightOrientation))
    ? Number(engineConfig.lightOrientation)
    : DEFAULT_ARCADE_CONFIG.engine.lightOrientation;
  const cameraDistance = clamp(Number(engineConfig.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
  const cameraZoomPercent = Math.round((DEFAULT_ARCADE_CONFIG.engine.cameraDistance / cameraDistance) * 100);
  const forceSkill = config.player.skills[0] || { name: 'Force', value: 0, manaCost: 0 };
  const mainPower = config.player.powers[0] || { name: 'Pouvoir', type: 'fire', manaCost: 0, force: 0 };
  const playerCharacterPreset = getCharacterPreset(config.player.character || 'runner', 'runner');
  const selectedReliefStyle = selectedEntity?.type === 'relief'
    ? getReliefStyle(selectedEntity.item.style)
    : null;
  const studioMediaLibrary = studioProject.mediaAssets || [];
  const studioImportCharacters = studioProject.characterModels3d || [];
  const studioImportDecors = studioProject.decorModels3d || [];
  const studioCharacterModels = (studioProject.characterModels3d || []).filter((model) => getStudioModelSource(model));
  const studioHeroModels = studioCharacterModels.filter((model) => (model.role || 'hero') === 'hero');
  const activeRpg3DCanvas = getActiveRpg3DCanvas(studioProject);
  const activeRpg3DCanvasId = activeRpg3DCanvas?.id || studioProject.rpg3dActiveCanvasId || DEFAULT_RPG3D_CANVAS_ID;
  const rpg3DCanvasOptions = studioProject.rpg3dCanvases || [];
  const actionZoneNpcTargets = [
    ...(config.heroes || []).map((hero, index) => ({
      id: hero.id,
      label: hero.name || `Heros ${index + 1}`,
    })),
    ...(config.enemies || []).map((enemy, index) => ({
      id: enemy.id,
      label: enemy.combatEnemyName || enemy.name || `Personnage ${index + 1}`,
    })),
  ];
  const workspaceTabs = [
    { id: 'arcade', label: 'Carte RPG 3D', icon: MapIcon },
    { id: 'canvases', label: 'Canevas', icon: FolderOpen },
    { id: 'management', label: 'Gestion', icon: List },
    { id: 'characters3d', label: 'Personnages 3D', icon: Cuboid },
    { id: 'decors3d', label: 'Objets 3D', icon: Mountain },
    { id: 'modelTools', label: 'Outils GLB', icon: Wrench },
  ];
  const activeWorkspace = workspaceTabs.find((tab) => tab.id === workspaceTab) || workspaceTabs[0];
  const ActiveWorkspaceIcon = activeWorkspace.icon;
  const showLegacyToolsPanel = false;
  const showArcadeMapCard = true;
  const showArcadeInspector = true;
  const showArcadeElementLibrary = false;
  const arcadeObjectCount = getArcadeObjectCount(config);
  const selectedCanRotate = ROTATABLE_ENTITY_TYPES.has(selectedEntity?.type);
  const selectedCanLevitate = canEntityLevitate(selectedEntity?.type);
  const quickSelectionCanRotate = inspectorSelectionEntities.length === 1
    && inspectorSelectionEntities.every(({ type }) => ROTATABLE_ENTITY_TYPES.has(type));
  const quickSelectionCanResize = inspectorSelectionEntities.length === 1
    && inspectorSelectionEntities.every(canResizeSelectionEntity);
  const activeTransformTool = (
    (transformTool === 'rotate' && quickSelectionCanRotate)
    || (transformTool === 'scale' && quickSelectionCanResize)
  ) ? transformTool : '';
  useEffect(() => {
    if ((transformTool === 'rotate' && !quickSelectionCanRotate)
      || (transformTool === 'scale' && !quickSelectionCanResize)) {
      setTransformTool('');
    }
  }, [quickSelectionCanResize, quickSelectionCanRotate, transformTool]);

  useEffect(() => {
    if (!cameraZoomDragMode) return;
    if (
      mode !== 'edit'
      || tool !== 'select'
      || dragMode
      || multiSelectMode
      || cameraTargetPickMode
      || pendingPlacement
      || activeTransformTool
    ) {
      setCameraZoomDragMode(false);
    }
  }, [
    activeTransformTool,
    cameraTargetPickMode,
    cameraZoomDragMode,
    dragMode,
    mode,
    multiSelectMode,
    pendingPlacement,
    tool,
  ]);
  const multiSelectionCanLevitate = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type }) => canEntityLevitate(type));
  const multiSelectionCanRotate = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type }) => ROTATABLE_ENTITY_TYPES.has(type));
  const multiSelectionCanEditActions = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(isDuplicableSelectionEntity);
  const multiSelectionAllFlatTiles = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type, item }) => type === 'prop' && isFlatTileLikeProp(item));
  const multiSelectionZValue = multiSelectionCanLevitate
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getEntityZ(item))
    : '';
  const multiSelectionRotationValue = multiSelectionCanRotate
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getEntityRotation(item))
    : '';
  const multiSelectionFloorZeroValue = multiSelectionAllFlatTiles
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getFloorZeroZ(item), 1)
    : '';
  const selectedPropRenderMode = selectedEntity?.type === 'prop' ? getPropRenderMode(selectedEntity.item) : '';
  const selectedPropIsFloorTile = selectedEntity?.type === 'prop' && selectedPropRenderMode === 'floor';
  const selectedPropIsFlatTile = selectedEntity?.type === 'prop' && isFlatTileLikeProp(selectedEntity.item);
  const selectedPropTileSize = selectedPropIsFloorTile ? getFloorTileWorldSize(selectedEntity.item) : 0;
  const selectedPropCanEraseModel = selectedEntity?.type === 'prop' && selectedPropRenderMode === 'glb';
  const selectedModelEraserRadius = selectedPropCanEraseModel
    ? getModelEraserRadius(selectedEntity.item)
    : modelEraserRadiusDraft;
  const selectedModelEraserCount = selectedPropCanEraseModel
    ? getModelEraserStrokes(selectedEntity.item).length
    : 0;
  useEffect(() => {
    if (tool !== 'modelEraser') return;
    if (mode === 'edit' && selectedPropCanEraseModel) return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
    setTool('select');
  }, [mode, selectedPropCanEraseModel, tool]);
  const flatGroundColorValue = getFlatGroundPlateauColor(config, flatGroundColorDraft);
  const terrainPaintStrokeCount = config.terrainPaintStrokes?.length || 0;
  const canUndoRpg3D = undoStack.length > 0;
  const canRedoRpg3D = redoStack.length > 0;
  const positionRowClassName = [
    'arcade-position-row',
    selectedCanLevitate ? 'with-z' : '',
    selectedCanRotate ? 'with-orientation' : '',
  ].filter(Boolean).join(' ');
  const multiPositionRowClassName = [
    'arcade-position-row',
    multiSelectionCanLevitate ? 'with-z' : '',
    multiSelectionCanRotate ? 'with-orientation' : '',
  ].filter(Boolean).join(' ');
  const arcadeShellClassName = [
    'arcade-shell',
    'arcade-builder-shell',
    `arcade-workspace-${workspaceTab}`,
    mapFullscreen ? 'arcade-fullscreen-active' : '',
    mapFullscreen && mapDrawerOpen ? 'arcade-map-drawer-open' : '',
    mapFullscreen && inspectorDrawerOpen ? 'arcade-inspector-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const arcadeBuilderLayoutClassName = [
    'arcade-builder-layout',
    'arcade-builder-layout-with-inspector',
    mapFullscreen ? 'arcade-builder-layout-fullscreen' : '',
  ].filter(Boolean).join(' ');
  const toggleMapFullscreen = () => {
    setMapFullscreen((current) => {
      const next = !current;
      if (!next) {
        setMapDrawerOpen(false);
        setInspectorDrawerOpen(false);
      }
      return next;
    });
  };
  const handleTogglePlayMode = () => {
    const nextMode = playMode ? 'edit' : 'play';
    setMode(nextMode);
    setIsPaused(false);
    resetGame(undefined, { mode: nextMode });
  };
  const handlePauseOrReset = () => (playMode ? setIsPaused((paused) => !paused) : resetGame());
  const handleLightIntensityChange = (value) => {
    patchViewportEngineConfig((engine) => {
      engine.lightIntensity = value;
    });
  };
  const handleLightOrientationChange = (value) => {
    patchViewportEngineConfig((engine) => {
      engine.lightOrientation = value;
    });
  };
  const handleToggleTerrainPaint = () => {
    setMode('edit');
    setTool((current) => (current === 'terrainPaint' ? 'select' : 'terrainPaint'));
    setTransformTool('');
    setPendingPlacement(null);
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
  };
  const handleToggleModelEraser = () => {
    const currentProp = getSelectedEntity(configRef.current, selectedRef.current);
    if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
    setMode('edit');
    setIsPaused(false);
    setTool((current) => (current === 'modelEraser' ? 'select' : 'modelEraser'));
    setTransformTool('');
    setPendingPlacement(null);
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
  };
  const handleModelEraserRadiusChange = (value) => {
    const radius = getModelEraserRadius({ modelEraserRadius: value });
    setModelEraserRadiusDraft(radius);
    patchConfigWithoutHistory((next) => {
      const currentProp = getSelectedEntity(next, selectedRef.current);
      if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
      currentProp.item.modelEraserRadius = radius;
    }, false);
  };
  const handleClearModelEraser = () => {
    const currentProp = getSelectedEntity(configRef.current, selectedRef.current);
    if (!currentProp?.item || currentProp.type !== 'prop' || !getModelEraserStrokes(currentProp.item).length) return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
    patchConfig((next) => {
      const nextProp = getSelectedEntity(next, selectedRef.current);
      if (!nextProp?.item || nextProp.type !== 'prop') return;
      nextProp.item.modelEraserStrokes = [];
    }, false);
  };
  const handleSelectActionZoneTool = () => {
    setMode('edit');
    setTool('actionZone');
    setTransformTool('');
    setPendingPlacement(null);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
  };
  const handleToggleDragMode = () => {
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setDragMode((current) => !current);
  };
  const handleToggleMultiSelectMode = () => {
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setMultiSelectMode((current) => {
      const next = !current;
      setMultiSelected(next && canMultiSelectEntity(selected) ? [selected] : []);
      return next;
    });
  };
  const handleToggleCameraZoomDragMode = () => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setTransformTool('');
    setPendingPlacement(null);
    setCameraZoomDragMode((current) => !current);
  };
  const handleToggleRotateTransform = () => {
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(null);
    setTransformTool((current) => (current === 'rotate' ? '' : 'rotate'));
  };
  const handleToggleScaleTransform = () => {
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(null);
    setTransformTool((current) => (current === 'scale' ? '' : 'scale'));
  };
  const handleActionZoneTypeChange = (value) => {
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.actionType = value;
      if (value === 'portal' && !currentZone.item.targetCanvasId) {
        currentZone.item.targetCanvasId = getDefaultPortalTargetCanvasId(studioProjectRef.current);
      }
    });
  };
  const handleNpcInteractionModeChange = (value) => {
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcInteractionMode = value;
      if (value === 'multipleChoice') {
        currentZone.item.npcQuestion = currentZone.item.npcQuestion || currentZone.item.message || 'Que veux-tu demander ?';
        currentZone.item.npcChoices = getNpcChoiceItems(currentZone.item);
      }
    });
  };
  const handleZoneVisibilityChange = (value) => {
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (currentZone?.item) currentZone.item.visibleInPlay = value === 'visible';
    });
  };
  const handleReliefCollisionChange = (value) => {
    patchConfig((next) => {
      const currentRelief = getSelectedEntity(next, selected);
      if (currentRelief?.item) currentRelief.item.blocksMovement = value === 'blocked';
    });
  };
  const handleClearPropImage = () => {
    setMediaError('');
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.imageData = '';
      currentProp.item.imageName = '';
    });
  };
  const handlePropCollisionChange = (value) => {
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (currentProp?.item) currentProp.item.blocksMovement = value === 'blocked';
    });
  };

  return (
    <main className={arcadeShellClassName}>
      {mapFullscreen ? (
        <>
          <button
            type="button"
            className="arcade-fullscreen-drawer-toggle arcade-fullscreen-drawer-toggle-left"
            title={mapDrawerOpen ? 'Fermer le tiroir carte' : 'Ouvrir le tiroir carte'}
            aria-label={mapDrawerOpen ? 'Fermer le tiroir carte' : 'Ouvrir le tiroir carte'}
            aria-pressed={mapDrawerOpen}
            onClick={() => setMapDrawerOpen((open) => !open)}
          >
            <PanelLeftOpen size={17} />
          </button>
          <button
            type="button"
            className="arcade-fullscreen-drawer-toggle arcade-fullscreen-drawer-toggle-right"
            title={inspectorDrawerOpen ? 'Fermer le tiroir inspecteur' : 'Ouvrir le tiroir inspecteur'}
            aria-label={inspectorDrawerOpen ? 'Fermer le tiroir inspecteur' : 'Ouvrir le tiroir inspecteur'}
            aria-pressed={inspectorDrawerOpen}
            onClick={() => setInspectorDrawerOpen((open) => !open)}
          >
            <PanelRightOpen size={17} />
          </button>
        </>
      ) : null}
      <Rpg3DHeader
        isPaused={isPaused}
        isSavingAssets={isSavingAssets}
        managementSaveStatus={managementSaveStatus}
        playMode={playMode}
        workspaceTab={workspaceTab}
        onPauseOrReset={handlePauseOrReset}
        onSave={saveArcadeAssets}
        onSelectWorkspace={setWorkspaceTab}
        onTogglePlayMode={handleTogglePlayMode}
      />

      <Rpg3DWorkspaceTabs
        tabs={workspaceTabs}
        activeTabId={workspaceTab}
        onSelectTab={setWorkspaceTab}
      />

      {workspaceTab === 'canvases' ? (
        <ArcadeCanvasManagerTab
          studioProject={studioProject}
          currentConfig={config}
          activeCanvasId={activeRpg3DCanvasId}
          onCreateAct={createRpg3DAct}
          onRenameAct={renameRpg3DAct}
          onDeleteAct={deleteRpg3DAct}
          onCreateCanvas={createRpg3DCanvas}
          onRenameCanvas={renameRpg3DCanvas}
          onMoveCanvasToAct={moveRpg3DCanvasToAct}
          onSelectCanvas={selectRpg3DCanvas}
          onDeleteCanvas={deleteRpg3DCanvas}
          onKeepOnlyActiveCanvas={keepOnlyActiveRpg3DCanvas}
          onOpenCanvas={() => setWorkspaceTab('arcade')}
        />
      ) : workspaceTab === 'management' ? (
        <ArcadeManagementTab
          config={config}
          selected={selected}
          studioProject={studioProject}
          onCreateStudioCharacter={createStudioCharacter}
          onCreateStudioDecor={createStudioDecor}
          onRenameStudioCharacter={renameStudioCharacter}
          onRenameStudioDecor={renameStudioDecor}
          onDeleteStudioCharacter={deleteStudioCharacter}
          onDeleteStudioDecor={deleteStudioDecor}
          onEditStudioCharacter={editStudioCharacter}
          onEditStudioDecor={editStudioDecor}
          onRenameMapEntity={renameMapEntity}
          onDeleteMapEntity={deleteMapEntity}
          onEditMapEntity={editMapEntity}
        />
      ) : workspaceTab === 'characters3d' ? (
        <Character3DTab
          project={studioProject}
          patchProject={patchStudioProject}
          handleUpload={handleStudioUpload}
          mediaLibrary={studioMediaLibrary}
          selectedModelId={studioSelection.characterModelId || undefined}
          onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, characterModelId: modelId }))}
          onSaveAssets={saveArcadeAssets}
          saveStatus={managementSaveStatus}
          saveInProgress={isSavingAssets}
        />
      ) : workspaceTab === 'decors3d' ? (
        <Decor3DTab
          project={studioProject}
          patchProject={patchStudioProject}
          handleUpload={handleStudioUpload}
          mediaLibrary={studioMediaLibrary}
          selectedModelId={studioSelection.decorModelId || undefined}
          onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, decorModelId: modelId }))}
          onSaveAssets={saveArcadeAssets}
          saveStatus={managementSaveStatus}
          saveInProgress={isSavingAssets}
        />
      ) : workspaceTab === 'modelTools' ? (
        <ModelToolsTab />
      ) : (
      <section className={arcadeBuilderLayoutClassName}>
        {showLegacyToolsPanel ? (
        <aside className="arcade-builder-panel" aria-label="Outils de creation">
          <div className="arcade-panel-section">
            <h2>Outils</h2>
            <div className="arcade-tool-grid">
              {TOOL_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={tool === option.id ? 'active' : ''}
                    onClick={() => {
                      setTool(option.id);
                      if (option.id !== 'select') setMode('edit');
                    }}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="arcade-panel-section">
            <h2>Map</h2>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.mapWidth}>Largeur</Rpg3DHelpLabel>
              <input type="number" min="1200" max="9000" step="100" value={config.world.width} onChange={(event) => patchConfig((next) => { next.world.width = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.mapHeight}>Hauteur</Rpg3DHelpLabel>
              <input type="number" min="900" max="7000" step="100" value={config.world.height} onChange={(event) => patchConfig((next) => { next.world.height = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.mapGrid}>Grille</Rpg3DHelpLabel>
              <input type="number" min="40" max="240" step="20" value={config.world.grid} onChange={(event) => patchConfig((next) => { next.world.grid = Number(event.target.value); }, false)} />
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2><Camera size={14} /> Moteur 3D</h2>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.cameraHeight}>Hauteur camera</Rpg3DHelpLabel>
              <input type="range" min="8" max="28" step="1" value={engineConfig.cameraHeight} onChange={(event) => patchViewportEngineConfig((engine) => { engine.cameraHeight = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.cameraDistance}>Distance camera</Rpg3DHelpLabel>
              <input type="range" min={CAMERA_DISTANCE_MIN} max={CAMERA_DISTANCE_MAX} step="0.5" value={engineConfig.cameraDistance} onChange={(event) => patchViewportEngineConfig((engine) => { engine.cameraDistance = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.wallHeight}>Hauteur murs</Rpg3DHelpLabel>
              <input type="range" min="0.8" max="5" step="0.1" value={engineConfig.wallHeight} onChange={(event) => patchConfig((next) => { ensureEngineConfig(next).wallHeight = Number(event.target.value); }, false)} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.reliefScale}>Volume relief</Rpg3DHelpLabel>
              <input type="range" min="0.4" max="2.4" step="0.1" value={engineConfig.reliefScale} onChange={(event) => patchConfig((next) => { ensureEngineConfig(next).reliefScale = Number(event.target.value); }, false)} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.propHeight}>Hauteur decors</Rpg3DHelpLabel>
              <input type="range" min="0.5" max="2.2" step="0.1" value={engineConfig.propHeight} onChange={(event) => patchConfig((next) => { ensureEngineConfig(next).propHeight = Number(event.target.value); }, false)} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.lightIntensity}>Lumiere ({Math.round(lightIntensityValue * 100)}%)</Rpg3DHelpLabel>
              <input type="range" min="0.25" max="2.6" step="0.05" value={lightIntensityValue} onChange={(event) => patchViewportEngineConfig((engine) => { engine.lightIntensity = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.lightOrientation}>Orientation soleil ({Math.round(lightOrientationValue)} deg)</Rpg3DHelpLabel>
              <input type="range" min="0" max="359" step="1" value={lightOrientationValue} onChange={(event) => patchViewportEngineConfig((engine) => { engine.lightOrientation = Number(event.target.value); })} />
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>Heros</h2>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.playerCharacter}>Personnage principal</Rpg3DHelpLabel>
              <select value={config.player.character || 'runner'} onChange={(event) => patchConfig((next) => { next.player.character = event.target.value; })}>
                {PLAYER_CHARACTER_OPTIONS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <div className="arcade-character-summary">
              <span
                className="arcade-character-token"
                style={{ '--arcade-character-body': playerCharacterPreset.body, '--arcade-character-accent': playerCharacterPreset.accent }}
              >
                {config.player.characterImageData ? <img src={config.player.characterImageData} alt="" /> : null}
              </span>
              <div>
                <strong>{playerCharacterPreset.label}</strong>
                <small>{config.player.characterModelName || (config.player.characterImageData ? `${config.player.characterImageName || 'Image personnalisee'} - ${getCharacterRenderLabel(config.player)}` : getCharacterRenderLabel(config.player))}</small>
              </div>
            </div>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterRenderMode}>Rendu personnage 3D</Rpg3DHelpLabel>
              <select value={getCharacterRenderMode(config.player)} onChange={(event) => patchConfig((next) => { next.player.characterRenderMode = event.target.value; }, false)}>
                {CHARACTER_RENDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterModel}>Modele 3D</Rpg3DHelpLabel>
              <select value={config.player.characterModel3dId || ''} onChange={(event) => patchConfig((next) => {
                const model = studioHeroModels.find((entry) => entry.id === event.target.value);
                applyCharacterModelToActor(next.player, model);
              }, false)}>
                <option value="">Aucun</option>
                {studioHeroModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name || model.modelName || 'Modele 3D'}</option>
                ))}
              </select>
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterScale}>Taille 3D</Rpg3DHelpLabel>
              <input
                type="range"
                min="0.6"
                max={MODEL_SCALE_MAX}
                step="0.1"
                value={getCharacterModelScale(config.player)}
                onChange={(event) => patchConfig((next) => {
                  const scale = clamp(Number(event.target.value), MODEL_SCALE_MIN, MODEL_SCALE_MAX);
                  next.player.characterModelScale = scale;
                  next.player.characterModelScaleY = scale;
                  if (next.player.characterModelScaleProportional !== false) {
                    next.player.characterModelScaleX = scale;
                    next.player.characterModelScaleZ = scale;
                  }
                }, false)}
              />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterMaterialBrightness}>Lumiere carte {Math.round(getCharacterMaterialBrightness(config.player) * 100)}%</Rpg3DHelpLabel>
              <input
                type="range"
                min={MATERIAL_BRIGHTNESS_MIN}
                max={MATERIAL_BRIGHTNESS_MAX}
                step="0.05"
                value={getCharacterMaterialBrightness(config.player)}
                onChange={(event) => patchConfig((next) => {
                  next.player.characterMaterialBrightness = clamp(Number(event.target.value), MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
                }, false)}
              />
            </label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.playerImage}>Image heros</Rpg3DHelpLabel>
            <label className="button like secondary-action arcade-file-button">
              Importer image heros
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  setPlayerCharacterImage(file);
                }}
              />
            </label>
            {config.player.characterImageData ? (
              <button type="button" className="secondary-action" onClick={() => {
                setMediaError('');
                patchConfig((next) => {
                  next.player.characterImageData = '';
                  next.player.characterImageName = '';
                });
              }}>Retirer image heros</button>
            ) : null}
            {config.player.characterModelUrl ? (
              <button type="button" className="secondary-action" onClick={() => {
                setMediaError('');
                patchConfig((next) => {
                  applyCharacterModelToActor(next.player, null);
                }, false);
              }}>Retirer modele 3D</button>
            ) : null}
            {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.currentHealth}>PV actuels</Rpg3DHelpLabel>
              <input type="number" min="0" max={config.player.maxHealth} value={config.player.health} onChange={(event) => patchConfig((next) => { next.player.health = clamp(Number(event.target.value), 0, next.player.maxHealth); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.maxHealth}>PV max</Rpg3DHelpLabel>
              <input type="number" min="1" max="999" value={config.player.maxHealth} onChange={(event) => patchConfig((next) => { next.player.maxHealth = Math.max(1, Number(event.target.value)); next.player.health = clamp(next.player.health, 0, next.player.maxHealth); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.currentMana}>Mana actuelle</Rpg3DHelpLabel>
              <input type="number" min="0" max={config.player.maxMana} value={config.player.mana} onChange={(event) => patchConfig((next) => { next.player.mana = clamp(Number(event.target.value), 0, next.player.maxMana); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.maxMana}>Mana max</Rpg3DHelpLabel>
              <input type="number" min="0" max="999" value={config.player.maxMana} onChange={(event) => patchConfig((next) => { next.player.maxMana = Math.max(0, Number(event.target.value)); next.player.mana = clamp(next.player.mana, 0, next.player.maxMana); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.playerSpeed}>Vitesse joueur</Rpg3DHelpLabel>
              <input type="range" min="140" max="420" value={config.player.speed} onChange={(event) => patchConfig((next) => { next.player.speed = Number(event.target.value); })} />
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>Competence & pouvoir</h2>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackSkill}>Competence attaque</Rpg3DHelpLabel>
              <input value={forceSkill.name} onChange={(event) => patchConfig((next) => { next.player.skills[0].name = event.target.value; })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackBonus}>Bonus competence</Rpg3DHelpLabel>
              <input type="number" min="-20" max="50" value={forceSkill.value} onChange={(event) => patchConfig((next) => { next.player.skills[0].value = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackManaCost}>Cout mana attaque</Rpg3DHelpLabel>
              <input type="number" min="0" max="99" value={forceSkill.manaCost} onChange={(event) => patchConfig((next) => { next.player.skills[0].manaCost = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerName}>Pouvoir</Rpg3DHelpLabel>
              <input value={mainPower.name} onChange={(event) => patchConfig((next) => { next.player.powers[0].name = event.target.value; })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerForce}>Force pouvoir</Rpg3DHelpLabel>
              <input type="number" min="0" max="999" value={mainPower.force} onChange={(event) => patchConfig((next) => { next.player.powers[0].force = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerManaCost}>Cout mana pouvoir</Rpg3DHelpLabel>
              <input type="number" min="0" max="999" value={mainPower.manaCost} onChange={(event) => patchConfig((next) => { next.player.powers[0].manaCost = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerElement}>Element pouvoir</Rpg3DHelpLabel>
              <select value={mainPower.type} onChange={(event) => patchConfig((next) => { next.player.powers[0].type = event.target.value; })}>
                <option value="fire">Feu</option>
                <option value="water">Eau</option>
                <option value="earth">Terre</option>
                <option value="lightning">Foudre</option>
              </select>
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>IA temps reel</h2>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyVision}>Vision ennemis</Rpg3DHelpLabel>
              <input type="range" min="300" max="1400" step="50" value={config.ai.visionRange} onChange={(event) => patchConfig((next) => { next.ai.visionRange = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.aiAggression}>Aggressivite IA</Rpg3DHelpLabel>
              <input type="range" min="0.6" max="1.6" step="0.1" value={config.ai.aggression} onChange={(event) => patchConfig((next) => { next.ai.aggression = Number(event.target.value); })} />
            </label>
          </div>
        </aside>
        ) : null}

        {showArcadeMapCard ? (
          <Rpg3DMapPanel
            AssetExplorerComponent={ArcadeMapAssetExplorer}
            arcadeObjectCount={arcadeObjectCount}
            characters={studioImportCharacters}
            decors={studioImportDecors}
            fieldHelp={RPG3D_FIELD_HELP}
            flatGroundColorValue={flatGroundColorValue}
            lightIntensityValue={lightIntensityValue}
            lightOrientationValue={lightOrientationValue}
            paintBrushColor={getTerrainPaintColor(terrainPaintDraft)}
            paintBrushRadius={getTerrainPaintRadius(terrainPaintDraft)}
            paintBrushShape={getTerrainPaintShape(terrainPaintDraft)}
            terrainPaintMaxRadius={TERRAIN_PAINT_MAX_RADIUS}
            terrainPaintMinRadius={TERRAIN_PAINT_MIN_RADIUS}
            terrainPaintShapeOptions={TERRAIN_PAINT_SHAPE_OPTIONS}
            terrainPaintStrokeCount={terrainPaintStrokeCount}
            tool={tool}
            world={config.world}
            onAddFlatGround={addFlatGroundToCanvas}
            onClearTerrainPaint={clearTerrainPaint}
            onImportCharacter={importStudioCharacterToCanvas}
            onImportDecor={importStudioDecorToCanvas}
            onLightIntensityChange={handleLightIntensityChange}
            onLightOrientationChange={handleLightOrientationChange}
            onSelectActionZoneTool={handleSelectActionZoneTool}
            onTerrainPaintDraftChange={updateTerrainPaintDraft}
            onToggleTerrainPaint={handleToggleTerrainPaint}
            onUpdateFlatGroundColor={updateFlatGroundColor}
            onWorldFieldCommit={updateArcadeWorldField}
          />
        ) : null}

        <Rpg3DStage
          activeTransformTool={activeTransformTool}
          cameraTargetPickMode={cameraTargetPickMode}
          cameraToolsHidden={cameraToolsHidden}
          cameraZoomDragMode={cameraZoomDragMode}
          cameraZoomPercent={cameraZoomPercent}
          canRedo={canRedoRpg3D}
          canUndo={canUndoRpg3D}
          config={config}
          configRef={configRef}
          dragMode={dragMode}
          mapFullscreen={mapFullscreen}
          mode={mode}
          modelEraserMode={tool === 'modelEraser' && selectedPropCanEraseModel}
          modelEraserRadius={selectedModelEraserRadius}
          multiSelected={multiSelected}
          multiSelectMode={multiSelectMode}
          paintBrushColor={getTerrainPaintColor(terrainPaintDraft)}
          paintBrushRadius={getTerrainPaintRadius(terrainPaintDraft)}
          paintBrushShape={getTerrainPaintShape(terrainPaintDraft)}
          pendingPlacement={pendingPlacement}
          playMode={playMode}
          quickSelectionCanResize={quickSelectionCanResize}
          quickSelectionCanRotate={quickSelectionCanRotate}
          selected={selected}
          stateRef={stateRef}
          studioProject={studioProject}
          tool={tool}
          wrapperRef={wrapperRef}
          onCameraTargetPick={handleCameraTargetPick}
          onCameraZoomDrag={handleCameraZoomDrag}
          onHideCameraTools={() => setCameraToolsHidden(true)}
          onMarqueeSelect={handleMarqueeSelect}
          onRedo={redoProjectChange}
          onSelectionTransformCommit={handleSelectionTransformCommit}
          onShootChange={setPointerShooting}
          onShowCameraTools={() => setCameraToolsHidden(false)}
          onToggleCameraTargetPickMode={toggleCameraTargetPickMode}
          onToggleCameraZoomDragMode={handleToggleCameraZoomDragMode}
          onToggleDragMode={handleToggleDragMode}
          onToggleFullscreen={toggleMapFullscreen}
          onToggleMultiSelectMode={handleToggleMultiSelectMode}
          onToggleRotateTransform={handleToggleRotateTransform}
          onToggleScaleTransform={handleToggleScaleTransform}
          onUndo={undoProjectChange}
          onWorldClick={handleWorldClick}
          onWorldDrag={handleWorldDrag}
          onWorldDragStart={handleWorldDragStart}
          onWorldDrop={handleWorldDrop}
          onModelEraseEnd={handleModelEraseEnd}
          onModelEraseMove={handleModelEraseMove}
          onModelEraseStart={handleModelEraseStart}
          onWorldPaintEnd={handleTerrainPaintEnd}
          onWorldPaintMove={handleTerrainPaintMove}
          onWorldPaintStart={handleTerrainPaintStart}
          onWorldPointer={updateWorldPointer}
          resolveWorldDragPoint={resolveWorldDragPoint}
        />

        {showArcadeInspector ? (
          <Rpg3DInspector
            actionZoneNpcTargets={actionZoneNpcTargets}
            activeCanvasId={activeRpg3DCanvasId}
            config={config}
            fieldHelp={RPG3D_FIELD_HELP}
            getEntityRotation={getEntityRotation}
            getModelRotationValue={getModelRotationValue}
            getNpcChoiceItems={getNpcChoiceItems}
            getNpcInteractionMode={getNpcInteractionMode}
            getNpcQuestionText={getNpcQuestionText}
            getSelectedEntityTypeLabel={getSelectedEntityTypeLabel}
            hasMultiInspectorSelection={hasMultiInspectorSelection}
            inspectorSelectionBounds={inspectorSelectionBounds}
            inspectorSelectionEntities={inspectorSelectionEntities}
            mediaError={mediaError}
            modelEraserActive={tool === 'modelEraser' && selectedPropCanEraseModel}
            modelEraserMaxRadius={MODEL_ERASER_MAX_RADIUS}
            modelEraserMinRadius={MODEL_ERASER_MIN_RADIUS}
            modelEraserRadius={selectedModelEraserRadius}
            multiPositionRowClassName={multiPositionRowClassName}
            multiSelectionAllFlatTiles={multiSelectionAllFlatTiles}
            multiSelectionCanEditActions={multiSelectionCanEditActions}
            multiSelectionCanLevitate={multiSelectionCanLevitate}
            multiSelectionCanRotate={multiSelectionCanRotate}
            multiSelectionFloorZeroValue={multiSelectionFloorZeroValue}
            multiSelectionRotationValue={multiSelectionRotationValue}
            multiSelectionZValue={multiSelectionZValue}
            positionRowClassName={positionRowClassName}
            reliefStyleOptions={RELIEF_STYLE_OPTIONS}
            rpg3DCanvasOptions={rpg3DCanvasOptions}
            selectedCanLevitate={selectedCanLevitate}
            selectedCanRotate={selectedCanRotate}
            selectedEntity={selectedEntity}
            selectedPropIsFlatTile={selectedPropIsFlatTile}
            selectedPropIsFloorTile={selectedPropIsFloorTile}
            selectedPropRenderMode={selectedPropRenderMode}
            selectedPropTileSize={selectedPropTileSize}
            selectedReliefStyle={selectedReliefStyle}
            selectedModelEraserCount={selectedModelEraserCount}
            showArcadeElementLibrary={showArcadeElementLibrary}
            onActionZoneTypeChange={handleActionZoneTypeChange}
            onAddSelectedNpcChoice={addSelectedNpcChoice}
            onClearPropImage={handleClearPropImage}
            onDeleteSelected={deleteSelected}
            onDuplicateSelected={duplicateSelected}
            onExportConfig={exportConfig}
            onClearModelEraser={handleClearModelEraser}
            onModelEraserRadiusChange={handleModelEraserRadiusChange}
            onNpcInteractionModeChange={handleNpcInteractionModeChange}
            onPropCollisionChange={handlePropCollisionChange}
            onReliefCollisionChange={handleReliefCollisionChange}
            onRemoveSelectedNpcChoice={removeSelectedNpcChoice}
            onSelectTool={setTool}
            onSnapSelectedTileToNeighbor={snapSelectedTileToNeighbor}
            onToggleModelEraser={handleToggleModelEraser}
            onUpdateEntity={updateEntity}
            onUpdateSelectedNpcChoice={updateSelectedNpcChoice}
            onUpdateSelectionEntities={updateSelectionEntities}
            onZoneVisibilityChange={handleZoneVisibilityChange}
          />
        ) : null}
      </section>
      )}

      <Rpg3DNpcChoiceOverlay
        choiceState={activeNpcChoice}
        onClose={closeNpcChoice}
        onSelectChoice={handleNpcChoiceSelect}
      />

      <Rpg3DControls
        ActiveWorkspaceIcon={ActiveWorkspaceIcon}
        activeWorkspace={activeWorkspace}
        arcadeObjectCount={arcadeObjectCount}
        dashReady={dashReady}
        pendingPlacement={pendingPlacement}
        playMode={playMode}
        snapshot={snapshot}
        studioProject={studioProject}
        tool={tool}
        workspaceTab={workspaceTab}
      />
    </main>
  );
}

export default Rpg3DMode;
