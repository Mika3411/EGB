import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Cuboid,
  Download,
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
  Trash2,
  Undo2,
} from 'lucide-react';
import ArcadeThreeViewport from './arcade/ArcadeThreeViewport';
import Character3DTab from './Character3DTab.jsx';
import Decor3DTab from './Decor3DTab.jsx';
import HelpLabel from './forms/HelpLabel.jsx';
import { ARCADE_3D_CHARACTER_MODELS, ARCADE_3D_DECOR_MODELS } from '../data/arcade3dAssets';
import { makeCharacter3DModel, makeDecor3DModel } from '../data/projectData';
import {
  buildStoragePath,
  downloadTextFile,
  generateStorageFilename,
  hasSupabaseConfig,
  isStorageNotFoundError,
  uploadToStorage,
} from '../supabaseStorage';

const PLAYER_RADIUS = 18;
const ENEMY_RADIUS = 16;
const BULLET_RADIUS = 4;
const DASH_DURATION = 0.16;
const PICKUP_RADIUS = 15;
const ARCADE_WORLD_SCALE = 0.018;
const ARCADE_ASSETS_STORAGE_KEY = 'escape-game-builder:arcade-assets:v1';
const ARCADE_ASSETS_REMOTE_VERSION = 2;
const ARCADE_MANIFEST_MAX_BYTES = 5 * 1024 * 1024;
const ARCADE_GLB_MAX_BYTES = 80 * 1024 * 1024;
const ARCADE_GLB_MIME_TYPES = ['model/gltf-binary', 'application/octet-stream'];
const ARCADE_TEXTURE_MAX_BYTES = 15 * 1024 * 1024;
const ARCADE_TEXTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const ARCADE_UPLOAD_MB = 1024 * 1024;
const ARCADE_MANIFEST_UPLOAD_TIMEOUT_MS = 90000;
const ARCADE_GLB_UPLOAD_TIMEOUT = {
  minMs: 180000,
  maxMs: 900000,
  msPerMb: 12000,
};
const ARCADE_MEDIA_UPLOAD_TIMEOUT = {
  minMs: 90000,
  maxMs: 240000,
  msPerMb: 6000,
};
const FLOOR_TILE_OVERLAP = 20;
const FLOOR_TILE_EDGE_SNAP_DISTANCE = 56;
const RPG3D_HISTORY_LIMIT = 60;
const RPG3D_HISTORY_DATA_URL_MAX_CHARS = 512 * 1024;
const ENTITY_Z_MIN = -900;
const ENTITY_Z_MAX = 900;
const DEFAULT_FLOOR_ZERO_Z = 2.5;
const FLOOR_ZERO_Z_MIN = -120;
const FLOOR_ZERO_Z_MAX = 120;
const MODEL_SCALE_MIN = 0.4;
const MODEL_SCALE_MAX = 5;
const ACTION_ZONE_MIN_SIZE = 40;
const ACTION_ZONE_DEFAULT_WIDTH = 260;
const ACTION_ZONE_DEFAULT_HEIGHT = 180;
const ACTION_ZONE_DEFAULT_MODEL_HEIGHT = 240;
const ACTION_ZONE_DEFAULT_OPACITY = 0.32;

const RPG3D_FIELD_HELP = {
  mapWidth: 'Largeur totale de la carte en unites du builder. Augmente-la pour donner plus d espace horizontal au parcours.',
  mapHeight: 'Hauteur totale de la carte en unites du builder. Augmente-la pour construire une zone plus profonde.',
  mapGrid: 'Pas de la grille utilise pour aligner les placements et garder des distances regulieres.',
  mapObjects: 'Nombre total d elements places sur le canevas actif.',
  actionZoneTool: 'Active le placement d un cube transparent 3D: clique ensuite sur la carte pour le poser.',
  assetFiles: 'Fichiers 3D crees dans les ateliers Personnages 3D et Objets 3D, prets a etre importes sur la carte.',
  activeView: 'Mode de rendu de la carte. Le builder RPG 3D utilise ici le viewport WebGL.',
  cameraHeight: 'Hauteur de la camera au-dessus du sol pendant l edition et le test.',
  cameraDistance: 'Distance de recul de la camera par rapport au centre vise.',
  wallHeight: 'Hauteur visuelle des murs et obstacles dans le rendu 3D.',
  reliefScale: 'Amplifie ou reduit le volume des reliefs pour rendre le terrain plus lisible.',
  propHeight: 'Hauteur par defaut des decors simples quand aucun modele 3D precis ne la remplace.',
  lightIntensity: 'Puissance globale de l eclairage dans la carte 3D.',
  playerCharacter: 'Preset de personnage utilise par le heros quand aucun GLB ou sprite personnalise ne le remplace.',
  characterRenderMode: 'Choisit si le personnage s affiche en volume procedural, GLB, sprite vertical ou forme stylisee.',
  characterModel: 'Modele GLB issu de l atelier Personnages 3D a appliquer au heros.',
  characterScale: 'Taille du modele 3D du heros sur la carte.',
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
  decorScale: 'Echelle appliquee au modele GLB de cet objet 3D.',
  rotationX: 'Inclinaison avant/arriere du modele selectionne.',
  rotationY: 'Rotation verticale du modele selectionne.',
  rotationZ: 'Inclinaison laterale du modele selectionne.',
  floorTileSize: 'Taille de la dalle plate selectionnee.',
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
  { id: 'glb', label: 'Modele GLB' },
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
  'decorModelScale',
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

const DEFAULT_ARCADE_CONFIG = {
  meta: {
    title: 'Mission RPG 3D',
  },
  world: {
    width: 4200,
    height: 2800,
    grid: 120,
  },
  engine: {
    defaultView: '3d',
    cameraHeight: 20,
    cameraDistance: 30,
    wallHeight: 2.4,
    reliefScale: 1,
    propHeight: 1,
    lightIntensity: 1.15,
  },
  player: {
    x: 2100,
    y: 1400,
    z: 0,
    character: 'runner',
    characterImageData: '',
    characterImageName: '',
    characterModel3dId: '',
    characterModelUrl: '',
    characterModelName: '',
    characterRenderMode: 'capsule',
    characterModelScale: 1,
    health: 18,
    maxHealth: 18,
    mana: 10,
    maxMana: 10,
    speed: 260,
    dashSpeed: 680,
    dashCooldown: 0.9,
    bulletSpeed: 680,
    fireRate: 0.13,
    skills: [
      { id: 'force', name: 'Force', value: 3, manaCost: 0 },
      { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
      { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
    ],
    powers: [
      { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 2, force: 4 },
    ],
  },
  ai: {
    visionRange: 850,
    obstacleAvoidance: 56,
    aggression: 1,
  },
  obstacles: [],
  reliefs: [],
  heroes: [],
  props: [],
  enemies: [],
  pickups: [],
  actionZones: [],
};

const TOOL_OPTIONS = [
  { id: 'select', label: 'Selection', icon: MousePointer2 },
  { id: 'obstacle', label: 'Mur', icon: Square },
  { id: 'enemy', label: 'Ennemi', icon: Crosshair },
  { id: 'pickup', label: 'Bonus', icon: HeartPulse },
  { id: 'relief', label: 'Relief', icon: Mountain },
  { id: 'prop', label: 'Image 3D', icon: Box },
  { id: 'actionZone', label: 'Zone', icon: MousePointerClick },
  { id: 'spawn', label: 'Depart', icon: Shield },
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
  house: 'habitions',
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
const ASSET_IMPORT_SOURCE_GROUPS = [
  { id: 'glb', label: 'Modeles GLB' },
  { id: 'image', label: 'Images et textures' },
  { id: 'procedural', label: 'Formes simples' },
];
const DECOR_IMPORT_KIND_MAP = {
  billboard: 'decor',
  crate: 'wall',
  rock: 'decor',
  tree: 'decor',
};
const SELECTED_ENTITY_TYPE_LABELS = {
  spawn: 'HEROS',
  hero: 'HEROS',
  enemy: 'ENNEMI',
  prop: 'OBJET',
  relief: 'RELIEF',
  obstacle: 'MUR',
  pickup: 'BONUS',
  actionZone: 'ZONE',
};
const MULTI_SELECT_ENTITY_TYPES = new Set(['spawn', 'hero', 'enemy', 'prop', 'relief', 'obstacle', 'pickup', 'actionZone']);
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
const MAP_ENTITY_COLLECTIONS = {
  hero: 'heroes',
  enemy: 'enemies',
  prop: 'props',
  relief: 'reliefs',
  obstacle: 'obstacles',
  pickup: 'pickups',
  actionZone: 'actionZones',
};

const isEditableShortcutTarget = (target) => Boolean(
  target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'),
);
const getDeletableSelectionEntities = (selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  const seen = new Set();
  return selection.filter((entity) => {
    if (!entity?.id || entity.type === 'spawn' || !MAP_ENTITY_COLLECTIONS[entity.type]) return false;
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const isDuplicableSelectionEntity = (entity = {}) => Boolean(
  entity?.id && entity.type !== 'spawn' && MAP_ENTITY_COLLECTIONS[entity.type],
);

const clonePlainObjectArray = (items = []) => (Array.isArray(items) ? items.map((item) => ({ ...(item || {}) })) : []);
const cloneActionZoneArray = (items = []) => clonePlainObjectArray(items).map((zone) => ({
  ...zone,
  npcChoices: clonePlainObjectArray(zone.npcChoices || []),
}));
const clonePlayerConfig = (player = DEFAULT_ARCADE_CONFIG.player) => ({
  ...(player || {}),
  skills: clonePlainObjectArray(player?.skills || []),
  powers: clonePlainObjectArray(player?.powers || []),
});
const cloneConfig = (config = DEFAULT_ARCADE_CONFIG) => ({
  meta: { ...(config.meta || {}) },
  world: { ...(config.world || DEFAULT_ARCADE_CONFIG.world) },
  engine: { ...(config.engine || DEFAULT_ARCADE_CONFIG.engine) },
  player: clonePlayerConfig(config.player || DEFAULT_ARCADE_CONFIG.player),
  obstacles: clonePlainObjectArray(config.obstacles || []),
  reliefs: clonePlainObjectArray(config.reliefs || []),
  heroes: clonePlainObjectArray(config.heroes || []),
  props: clonePlainObjectArray(config.props || []),
  enemies: clonePlainObjectArray(config.enemies || []),
  pickups: clonePlainObjectArray(config.pickups || []),
  actionZones: cloneActionZoneArray(config.actionZones || []),
});
const DEFAULT_RPG3D_ACT_ID = 'rpg3d-act-1';
const DEFAULT_RPG3D_SCENE_ID = 'rpg3d-scene-1';
const DEFAULT_RPG3D_CANVAS_ID = 'rpg3d-canvas-1';
const getDefaultRpg3DActs = () => [{ id: DEFAULT_RPG3D_ACT_ID, name: 'Acte I' }];
const getDefaultRpg3DScenes = () => [{
  id: DEFAULT_RPG3D_SCENE_ID,
  name: 'Scene 1',
  actId: DEFAULT_RPG3D_ACT_ID,
  parentSceneId: '',
}];
const createFallbackRpg3DCanvas = (config = DEFAULT_ARCADE_CONFIG) => ({
  id: DEFAULT_RPG3D_CANVAS_ID,
  name: 'Canevas 1',
  actId: DEFAULT_RPG3D_ACT_ID,
  sceneId: DEFAULT_RPG3D_CANVAS_ID,
  config: cloneConfig(config),
  createdAt: '',
  updatedAt: '',
});
const getSourceProjectActs = (sourceProject = null) => (
  Array.isArray(sourceProject?.acts) && sourceProject.acts.length
    ? sourceProject.acts
    : []
);
const getSourceProjectScenes = (sourceProject = null) => (
  Array.isArray(sourceProject?.scenes) && sourceProject.scenes.length
    ? sourceProject.scenes
    : []
);
const normalizeRpg3DActs = (acts = [], sourceProject = null) => {
  const rawActs = Array.isArray(acts) && acts.length ? acts : [];
  const normalized = (Array.isArray(rawActs) ? rawActs : [])
    .map((act, index) => ({
      id: act?.id || `rpg3d-act-${index + 1}`,
      name: act?.name || `Acte ${index + 1}`,
    }))
    .filter((act) => act.id);
  return normalized.length ? normalized : getDefaultRpg3DActs();
};
const normalizeRpg3DScenes = (scenes = [], acts = getDefaultRpg3DActs(), sourceProject = null) => {
  const rawScenes = Array.isArray(scenes) && scenes.length ? scenes : [];
  const fallbackActId = acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
  const actIds = new Set(acts.map((act) => act.id));
  const normalized = (Array.isArray(rawScenes) ? rawScenes : [])
    .map((scene, index) => ({
      id: scene?.id || `rpg3d-scene-${index + 1}`,
      name: scene?.name || `Scene ${index + 1}`,
      actId: actIds.has(scene?.actId) ? scene.actId : fallbackActId,
      parentSceneId: scene?.parentSceneId || '',
    }))
    .filter((scene) => scene.id);
  return normalized.length ? normalized : getDefaultRpg3DScenes().map((scene) => ({ ...scene, actId: fallbackActId }));
};
const normalizeRpg3DCanvases = (canvases = [], fallbackConfig = null, acts = getDefaultRpg3DActs(), scenes = getDefaultRpg3DScenes()) => {
  const fallbackActId = acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
  const actIds = new Set(acts.map((act) => act.id));
  const normalized = (Array.isArray(canvases) ? canvases : [])
    .map((canvas, index) => {
      const scene = scenes.find((entry) => entry.id === canvas?.sceneId);
      const actId = actIds.has(canvas?.actId)
        ? canvas.actId
        : scene?.actId || fallbackActId;
      const canvasId = canvas?.id || `rpg3d-canvas-${index + 1}`;
      return {
        id: canvasId,
        name: canvas?.name || `Canevas ${index + 1}`,
        actId,
        sceneId: canvasId,
        config: createConfigFromSavedAssets(canvas?.config || (index === 0 ? fallbackConfig : null)),
        createdAt: canvas?.createdAt || '',
        updatedAt: canvas?.updatedAt || '',
      };
    })
    .filter((canvas) => canvas.id);
  if (normalized.length) return normalized;
  const fallbackCanvas = createFallbackRpg3DCanvas(fallbackConfig || DEFAULT_ARCADE_CONFIG);
  return [{
    ...fallbackCanvas,
    actId: fallbackActId,
    sceneId: fallbackCanvas.id,
  }];
};
const cloneStudioProjectForEdit = (studioProject = null, fallbackConfig = null, sourceProject = null) => {
  const acts = normalizeRpg3DActs(studioProject?.rpg3dActs || [], sourceProject);
  const scenes = normalizeRpg3DScenes(studioProject?.rpg3dScenes || [], acts, sourceProject);
  const canvases = normalizeRpg3DCanvases(studioProject?.rpg3dCanvases || [], fallbackConfig, acts, scenes);
  const activeCanvasId = canvases.some((canvas) => canvas.id === studioProject?.rpg3dActiveCanvasId)
    ? studioProject.rpg3dActiveCanvasId
    : canvases[0]?.id || DEFAULT_RPG3D_CANVAS_ID;
  return {
    ...createDefaultStudioProject(),
    ...(studioProject && typeof studioProject === 'object' ? studioProject : {}),
    characterModels3d: clonePlainObjectArray(studioProject?.characterModels3d || []),
    decorModels3d: clonePlainObjectArray(studioProject?.decorModels3d || []),
    mediaAssets: clonePlainObjectArray(studioProject?.mediaAssets || []),
    rpg3dActs: acts,
    rpg3dScenes: scenes,
    rpg3dCanvases: canvases,
    rpg3dActiveCanvasId: activeCanvasId,
  };
};
const createDefaultStudioProject = () => ({
  title: 'RPG 3D Builder',
  characterModels3d: [],
  decorModels3d: [],
  mediaAssets: [],
  rpg3dActs: getDefaultRpg3DActs(),
  rpg3dScenes: getDefaultRpg3DScenes(),
  rpg3dCanvases: [createFallbackRpg3DCanvas()],
  rpg3dActiveCanvasId: DEFAULT_RPG3D_CANVAS_ID,
});
const createConfigFromSavedAssets = (savedConfig = null) => {
  const next = cloneConfig(DEFAULT_ARCADE_CONFIG);
  if (!savedConfig || typeof savedConfig !== 'object') return next;
  next.world = { ...next.world, ...(savedConfig.world || {}) };
  next.engine = { ...next.engine, ...(savedConfig.engine || {}) };
  next.player = { ...next.player, ...(savedConfig.player || {}) };
  next.obstacles = clonePlainObjectArray(savedConfig.obstacles);
  next.reliefs = clonePlainObjectArray(savedConfig.reliefs);
  next.heroes = clonePlainObjectArray(savedConfig.heroes);
  next.props = clonePlainObjectArray(savedConfig.props);
  next.enemies = clonePlainObjectArray(savedConfig.enemies);
  next.pickups = clonePlainObjectArray(savedConfig.pickups);
  next.actionZones = cloneActionZoneArray(savedConfig.actionZones);
  return next;
};
const createStudioProjectFromSavedAssets = (savedStudioProject = null, savedConfig = null, sourceProject = null) => (
  cloneStudioProjectForEdit(savedStudioProject, savedConfig, sourceProject)
);
const getActiveRpg3DCanvas = (studioProject = null) => {
  const project = cloneStudioProjectForEdit(studioProject);
  return project.rpg3dCanvases.find((canvas) => canvas.id === project.rpg3dActiveCanvasId)
    || project.rpg3dCanvases[0]
    || createFallbackRpg3DCanvas();
};
const getDefaultPortalTargetCanvasId = (studioProject = null) => {
  const project = cloneStudioProjectForEdit(studioProject);
  const activeId = project.rpg3dActiveCanvasId || project.rpg3dCanvases[0]?.id || '';
  return (project.rpg3dCanvases || []).find((canvas) => canvas.id && canvas.id !== activeId)?.id || '';
};
const syncStudioProjectActiveCanvasConfig = (studioProject = null, config = DEFAULT_ARCADE_CONFIG, canvasId = '') => {
  const next = cloneStudioProjectForEdit(studioProject);
  const activeCanvasId = canvasId || next.rpg3dActiveCanvasId || next.rpg3dCanvases[0]?.id || DEFAULT_RPG3D_CANVAS_ID;
  const targetIndex = next.rpg3dCanvases.findIndex((canvas) => canvas.id === activeCanvasId);
  if (targetIndex >= 0) {
    next.rpg3dCanvases[targetIndex] = {
      ...next.rpg3dCanvases[targetIndex],
      config: cloneConfig(config),
      updatedAt: new Date().toISOString(),
    };
    next.rpg3dActiveCanvasId = activeCanvasId;
  }
  return next;
};
const getRpg3DCanvasStructure = (studioProject = null, legacyStudioProject = null) => {
  const targetProject = legacyStudioProject || studioProject;
  const normalizedProject = cloneStudioProjectForEdit(targetProject, null, null);
  const acts = normalizeRpg3DActs(normalizedProject.rpg3dActs);
  const scenes = normalizeRpg3DScenes(normalizedProject.rpg3dScenes, acts);
  return {
    acts,
    scenes,
    canvases: normalizeRpg3DCanvases(normalizedProject.rpg3dCanvases, null, acts, scenes),
  };
};
const createRpg3DCanvasDraft = ({ index = 0, actId = DEFAULT_RPG3D_ACT_ID, sceneId = '', sceneName = '' } = {}) => {
  const id = createId('rpg3d-canvas');
  const name = sceneName || `Scene ${index + 1}`;
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.meta = { ...(config.meta || {}), title: name };
  return {
    id,
    name,
    actId,
    sceneId: sceneId || id,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
const readSavedArcadeAssets = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ARCADE_ASSETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};
const getArcadeAssetsRemotePath = (userId) => buildStoragePath('users', userId, 'arcade-assets', 'assets.json');
const getArcadeModelRemotePath = (userId, modelType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, filename)
);
const getArcadeTextureRemotePath = (userId, modelType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, 'textures', filename)
);
const getArcadeMediaRemotePath = (userId, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', 'media', filename)
);
const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
const isDataUrl = (value = '') => String(value || '').startsWith('data:');
const createArcadeAssetsPayload = (config, studioProject) => ({
  version: ARCADE_ASSETS_REMOTE_VERSION,
  savedAt: new Date().toISOString(),
  config: {
    ...cloneConfig(config),
  },
  studioProject: cloneStudioProjectForEdit(studioProject),
});
const getPersistedModelSource = (model = {}) => {
  if (isDataUrl(model.modelData)) return model.modelData;
  if (model.modelData && isBlobUrl(model.modelUrl)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};
const stripVolatileModelData = (model = {}) => {
  const next = { ...model };
  if (isDataUrl(next.modelData) && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelUrl = '';
  if (isBlobUrl(next.modelUrl) && !next.modelData) next.modelUrl = '';
  if (next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelData = '';
  return next;
};
const createLocalArcadeAssetsSnapshot = (payload = {}) => ({
  ...payload,
  studioProject: {
    ...createDefaultStudioProject(),
    ...(payload.studioProject || {}),
    characterModels3d: (payload.studioProject?.characterModels3d || []).map(stripVolatileModelData),
    decorModels3d: (payload.studioProject?.decorModels3d || []).map(stripVolatileModelData),
    mediaAssets: clonePlainObjectArray(payload.studioProject?.mediaAssets || []),
  },
});
const rememberArcadeAssetsLocally = (payload) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(ARCADE_ASSETS_STORAGE_KEY);
    window.localStorage.setItem(ARCADE_ASSETS_STORAGE_KEY, JSON.stringify(createLocalArcadeAssetsSnapshot(payload)));
    return true;
  } catch {
    return false;
  }
};
const getExtensionForMimeType = (mimeType = '') => ({
  'model/gltf-binary': 'glb',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}[String(mimeType).toLowerCase()] || 'bin');
const dataUrlToFile = (dataUrl, fallbackName = 'asset.bin', options = {}) => {
  const [header = '', encoded = ''] = String(dataUrl || '').split(',');
  const mimeType = header.match(/^data:([^;,]+)/i)?.[1] || options.mimeType || 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const sourceName = fallbackName || options.defaultName || 'asset';
  const extension = options.extension || getExtensionForMimeType(mimeType);
  const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
  return new File([bytes], fileName, { type: mimeType });
};
const getSizedUploadTimeoutMs = (file, profile = ARCADE_MEDIA_UPLOAD_TIMEOUT) => {
  const sizeMb = Math.max(0, (Number(file?.size) || 0) / ARCADE_UPLOAD_MB);
  const minMs = Number(profile.minMs) || ARCADE_MEDIA_UPLOAD_TIMEOUT.minMs;
  const maxMs = Number(profile.maxMs) || ARCADE_MEDIA_UPLOAD_TIMEOUT.maxMs;
  const msPerMb = Number(profile.msPerMb) || ARCADE_MEDIA_UPLOAD_TIMEOUT.msPerMb;
  return Math.round(Math.min(maxMs, Math.max(minMs, sizeMb * msPerMb)));
};
const mapArcadeAssetsSequentially = async (items = [], mapper) => {
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    results.push(await mapper(items[index], index));
  }
  return results;
};
const uploadModelTextureDataToSupabase = async (model, userId, modelType) => {
  const next = { ...model };
  if (!isDataUrl(next.imageData)) return next;
  const file = dataUrlToFile(next.imageData, next.imageName || `${next.name || modelType}-texture`, { mimeType: 'image/png' });
  const filename = generateStorageFilename(file.name || `${modelType}-texture.${getExtensionForMimeType(file.type)}`);
  const uploadResult = await uploadToStorage(getArcadeTextureRemotePath(userId, modelType, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || 'image/png',
    maxFileSize: ARCADE_TEXTURE_MAX_BYTES,
    allowMimeTypes: ARCADE_TEXTURE_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MEDIA_UPLOAD_TIMEOUT),
  });
  return {
    ...next,
    imageData: uploadResult.publicUrl || '',
    imageName: next.imageName || file.name,
    imageStorageMode: 'supabase',
    imageStoragePath: uploadResult.path,
    imageStorageBucket: uploadResult.bucket,
  };
};
const uploadMediaAssetDataToSupabase = async (asset, userId, index = 0) => {
  const next = { ...(asset || {}) };
  if (!isDataUrl(next.url)) return next;
  const file = dataUrlToFile(next.url, next.name || `media-${index + 1}`, { mimeType: 'image/png' });
  const filename = generateStorageFilename(file.name || `media-${index + 1}.${getExtensionForMimeType(file.type)}`);
  const uploadResult = await uploadToStorage(getArcadeMediaRemotePath(userId, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || 'image/png',
    maxFileSize: ARCADE_TEXTURE_MAX_BYTES,
    allowMimeTypes: ARCADE_TEXTURE_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MEDIA_UPLOAD_TIMEOUT),
  });
  return {
    ...next,
    url: uploadResult.publicUrl || '',
    name: next.name || file.name,
    storageMode: 'supabase',
    storagePath: uploadResult.path,
    storageBucket: uploadResult.bucket,
  };
};
const uploadModelDataToSupabase = async (model, userId, modelType) => {
  const next = { ...model };
  const modelData = isDataUrl(model.modelData) ? model.modelData : (isDataUrl(model.modelUrl) ? model.modelUrl : '');
  if (!modelData && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) {
    next.modelData = '';
    return uploadModelTextureDataToSupabase(next, userId, modelType);
  }

  if (!modelData) {
    if (isBlobUrl(next.modelUrl)) next.modelUrl = next.modelData || '';
    return uploadModelTextureDataToSupabase(stripVolatileModelData(next), userId, modelType);
  }

  const sourceName = next.modelName || next.name || `${modelType}.glb`;
  const file = dataUrlToFile(modelData, sourceName, { mimeType: 'model/gltf-binary', extension: 'glb' });
  const filename = generateStorageFilename(file.name || `${modelType}.glb`);
  const uploadResult = await uploadToStorage(getArcadeModelRemotePath(userId, modelType, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || 'model/gltf-binary',
    maxFileSize: ARCADE_GLB_MAX_BYTES,
    allowMimeTypes: ARCADE_GLB_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_GLB_UPLOAD_TIMEOUT),
  });

  return uploadModelTextureDataToSupabase({
    ...next,
    modelUrl: uploadResult.publicUrl || '',
    modelData: '',
    modelName: next.modelName || file.name,
    modelStorageMode: 'supabase',
    modelStoragePath: uploadResult.path,
    modelStorageBucket: uploadResult.bucket,
  }, userId, modelType);
};
const persistStudioModelsToSupabase = async (studioProject, userId) => ({
  ...createDefaultStudioProject(),
  ...(studioProject || {}),
  characterModels3d: await mapArcadeAssetsSequentially(studioProject?.characterModels3d || [], (model) => (
    uploadModelDataToSupabase(model, userId, 'characters')
  )),
  decorModels3d: await mapArcadeAssetsSequentially(studioProject?.decorModels3d || [], (model) => (
    uploadModelDataToSupabase(model, userId, 'objects')
  )),
  mediaAssets: await mapArcadeAssetsSequentially(studioProject?.mediaAssets || [], (asset, index) => (
    uploadMediaAssetDataToSupabase(asset, userId, index)
  )),
});
const syncConfigModelReferences = (config, studioProject) => {
  const next = createConfigFromSavedAssets(config);
  let changed = false;
  const characterModels = new Map((studioProject.characterModels3d || []).map((model) => [model.id, model]));
  const decorModels = new Map((studioProject.decorModels3d || []).map((model) => [model.id, model]));
  const setField = (target, field, value) => {
    if (!target || target[field] === value) return;
    target[field] = value;
    changed = true;
  };
  const syncActor = (actor) => {
    if (!actor) return;
    const model = characterModels.get(actor.characterModel3dId);
    if (model) {
      const source = getPersistedModelSource(model);
      if (source) {
        setField(actor, 'characterModelUrl', source);
        setField(actor, 'characterModelName', model.modelName || model.name || actor.characterModelName || '');
        setField(actor, 'characterRenderMode', 'glb');
        return;
      }
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', getStudioCharacterRenderMode(model));
    } else if (actor.characterModel3dId || isBlobUrl(actor.characterModelUrl)) {
      setField(actor, 'characterModel3dId', '');
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', 'capsule');
    }
  };
  syncActor(next.player);
  (next.heroes || []).forEach(syncActor);
  (next.enemies || []).forEach(syncActor);
  (next.props || []).forEach((prop) => {
    const model = decorModels.get(prop.decorModel3dId);
    if (model) {
      setField(prop, 'modelRotationX', getModelRotationValue(model, 'modelRotationX'));
      setField(prop, 'modelRotationY', getModelRotationValue(model, 'modelRotationY'));
      setField(prop, 'modelRotationZ', getModelRotationValue(model, 'modelRotationZ'));
      setField(prop, 'modelCenterOnOrigin', Boolean(model.modelCenterOnOrigin));
      setField(prop, 'modelFlushToGround', Boolean(model.modelFlushToGround));
      const source = getPersistedModelSource(model);
      if (source) {
        setField(prop, 'decorModelUrl', source);
        setField(prop, 'decorModelName', model.modelName || model.name || prop.decorModelName || '');
        setField(prop, 'renderMode', 'glb');
        if (!prop.imageData || prop.imageData === model.imageData || prop.imageName === model.imageName) {
          setField(prop, 'imageData', '');
          setField(prop, 'imageName', '');
          setField(prop, 'repeatTexture', false);
        }
        return;
      }
      setField(prop, 'decorModelUrl', '');
      setField(prop, 'decorModelName', '');
      if (prop.renderMode === 'glb') setField(prop, 'renderMode', getDecorImportRenderMode(model));
    } else if (isBlobUrl(prop.decorModelUrl)) {
      setField(prop, 'decorModelUrl', '');
    }
  });
  return { config: changed ? next : config, changed };
};
const syncConfigModelUrls = (config, studioProject) => syncConfigModelReferences(config, studioProject).config;
const compactHistoryDataUrl = (value = '') => (
  isDataUrl(value) && value.length > RPG3D_HISTORY_DATA_URL_MAX_CHARS ? '' : value
);
const compactHistoryModel = (model = {}) => stripVolatileModelData({
  ...model,
  modelData: compactHistoryDataUrl(model.modelData || ''),
  modelUrl: isDataUrl(model.modelUrl || '') ? compactHistoryDataUrl(model.modelUrl) : (model.modelUrl || ''),
  imageData: compactHistoryDataUrl(model.imageData || ''),
});
const createHistoryStudioProjectSnapshot = (studioProject = null) => ({
  ...createDefaultStudioProject(),
  ...(studioProject && typeof studioProject === 'object' ? studioProject : {}),
  characterModels3d: (studioProject?.characterModels3d || []).map(compactHistoryModel),
  decorModels3d: (studioProject?.decorModels3d || []).map(compactHistoryModel),
  mediaAssets: (studioProject?.mediaAssets || []).map((asset) => ({
    ...(asset || {}),
    url: compactHistoryDataUrl(asset?.url || ''),
  })),
});
const createRpg3DHistorySnapshot = (config, studioProject) => ({
  config: cloneConfig(config),
  studioProject: createHistoryStudioProjectSnapshot(studioProject),
});
const createSupabaseArcadeAssetsPayload = async (config, studioProject, userId) => {
  const persistedStudioProject = await persistStudioModelsToSupabase(studioProject, userId);
  const persistedConfig = syncConfigModelUrls(config, persistedStudioProject);
  return createArcadeAssetsPayload(persistedConfig, persistedStudioProject);
};
const uploadArcadeAssetsManifest = async (payload, userId) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  await uploadToStorage(getArcadeAssetsRemotePath(userId), blob, {
    visibility: 'private',
    upsert: true,
    cacheControl: '0',
    contentType: 'application/json',
    maxFileSize: ARCADE_MANIFEST_MAX_BYTES,
    timeoutMs: ARCADE_MANIFEST_UPLOAD_TIMEOUT_MS,
  });
};
const loadArcadeAssetsFromSupabase = async (userId) => {
  const text = await downloadTextFile(getArcadeAssetsRemotePath(userId), { visibility: 'private' });
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' ? parsed : null;
};
const mergeById = (current = [], additions = []) => {
  const seen = new Set(current.map((item) => item.id).filter(Boolean));
  const nextItems = additions
    .filter((item) => item?.id && !seen.has(item.id))
    .map((item) => structuredClone(item));
  return [...current, ...nextItems];
};
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
  next.player.x = Math.round(next.world.width * 0.5);
  next.player.y = Math.round(next.world.height * 0.5);
  next.player.health = next.player.maxHealth;
  next.player.mana = next.player.maxMana;
  return next;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clampWithFloor = (value, min, max) => clamp(value, min, Math.max(min, max));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};
const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const normalizeDegrees = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric % 360) + 360) % 360;
};
const getModelRotationValue = (item = {}, field = 'modelRotationX') => {
  const numeric = Number(item[field]);
  return clamp(Number.isFinite(numeric) ? numeric : 0, -180, 180);
};
const normalizeModelRotation = (value = 0) => {
  const normalized = normalizeDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
};
const getEntityRotation = (item = {}) => normalizeDegrees(item.rotation || 0);
const getArcadeObjectCount = (config = {}) => (config.obstacles?.length || 0)
  + (config.reliefs?.length || 0)
  + (config.heroes?.length || 0)
  + (config.props?.length || 0)
  + (config.enemies?.length || 0)
  + (config.pickups?.length || 0)
  + (config.actionZones?.length || 0);
const clampArcadeEntitiesToWorld = (config) => {
  const width = Number(config.world?.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const height = Number(config.world?.height) || DEFAULT_ARCADE_CONFIG.world.height;
  if (config.player) {
    config.player.x = clampWithFloor(Number(config.player.x) || width / 2, PLAYER_RADIUS, width - PLAYER_RADIUS);
    config.player.y = clampWithFloor(Number(config.player.y) || height / 2, PLAYER_RADIUS, height - PLAYER_RADIUS);
  }
  (config.obstacles || []).forEach((obstacle) => {
    const obstacleWidth = Math.max(0, Number(obstacle.w) || 0);
    const obstacleHeight = Math.max(0, Number(obstacle.h) || 0);
    obstacle.x = clampWithFloor(Number(obstacle.x) || 0, 0, width - obstacleWidth);
    obstacle.y = clampWithFloor(Number(obstacle.y) || 0, 0, height - obstacleHeight);
  });
  ['reliefs', 'heroes', 'props', 'enemies', 'pickups'].forEach((collectionName) => {
    (config[collectionName] || []).forEach((item) => {
      item.x = clamp(Number(item.x) || 0, 0, width);
      item.y = clamp(Number(item.y) || 0, 0, height);
    });
  });
  (config.actionZones || []).forEach((zone) => {
    const zoneWidth = getActionZoneWidth(zone);
    const zoneHeight = getActionZoneHeight(zone);
    zone.w = Math.round(zoneWidth);
    zone.h = Math.round(zoneHeight);
    zone.x = Math.round(clamp(Number(zone.x) || width / 2, zoneWidth / 2, Math.max(zoneWidth / 2, width - zoneWidth / 2)));
    zone.y = Math.round(clamp(Number(zone.y) || height / 2, zoneHeight / 2, Math.max(zoneHeight / 2, height - zoneHeight / 2)));
  });
};
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
const getPowerColor = (type = 'fire') => ({
  lightning: '#c4b5fd',
  water: '#67e8f9',
  earth: '#86efac',
  fire: '#f97316',
}[type] || '#f97316');
const getCharacterRenderMode = (actor = {}) => actor.characterRenderMode || 'capsule';
const getCharacterRenderLabel = (actor = {}) => CHARACTER_RENDER_OPTIONS.find((option) => option.id === getCharacterRenderMode(actor))?.label || 'Personnage volume';
const getCharacterModelScale = (actor = {}) => clamp(Number(actor.characterModelScale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
const getHeroCharacterId = (hero = {}) => hero.character || 'runner';
const getEntityZ = (item = {}) => clamp(Number(item.z) || 0, ENTITY_Z_MIN, ENTITY_Z_MAX);
const getFloorZeroZ = (item = {}) => {
  const value = Number(item.floorZeroZ);
  return clamp(Number.isFinite(value) ? value : DEFAULT_FLOOR_ZERO_Z, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
};
const canEntityLevitate = (type = '') => ['spawn', 'hero', 'enemy', 'prop', 'pickup', 'obstacle'].includes(type);
const getSelectedEntityTypeLabel = (selectedEntity = {}) => (
  SELECTED_ENTITY_TYPE_LABELS[selectedEntity.type] || String(selectedEntity.type || '').toUpperCase()
);
const getEntityKey = (entity = {}) => (entity?.type && entity?.id ? `${entity.type}:${entity.id}` : '');
const canMultiSelectEntity = (entity = {}) => Boolean(entity?.id && MULTI_SELECT_ENTITY_TYPES.has(entity.type));
const isSameEntity = (a = {}, b = {}) => a?.type === b?.type && a?.id === b?.id;
const getStudioModelSource = (model = {}) => {
  if (isDataUrl(model.modelData)) return model.modelData;
  if (model.modelData && String(model.modelUrl || '').startsWith('blob:')) return model.modelData;
  return model.modelUrl || model.modelData || '';
};
const getStudioCharacterRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.shape === 'robot') return 'block';
  if (model.shape === 'creature') return 'boss';
  return 'capsule';
};
const getDecorImportRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.kind === 'road' || model.kind === 'water') return 'floor';
  if (model.kind === 'wall') return 'box';
  if (model.kind === 'house') return 'house';
  if (model.imageData) return 'billboard';
  return 'rock';
};
const getDecorModelWorldSize = (model = {}) => {
  const width = Math.round(clamp((Number(model.width) || 2.2) / ARCADE_WORLD_SCALE, 24, 1400));
  const depth = Math.round(clamp((Number(model.depth) || 2.2) / ARCADE_WORLD_SCALE, 24, 1400));
  const height = Math.round(clamp((Number(model.height) || 1.2) / ARCADE_WORLD_SCALE, 12, 900));
  if (model.kind === 'road' || model.kind === 'water') {
    const tileSize = Math.max(width, depth);
    return { width: tileSize, depth: tileSize, height: Math.max(12, height) };
  }
  return { width, depth, height };
};
const applyCharacterModelToActor = (actor, model = null) => {
  if (!model || !getStudioModelSource(model)) {
    actor.characterModel3dId = '';
    actor.characterModelUrl = '';
    actor.characterModelName = '';
    actor.characterRenderMode = model ? getStudioCharacterRenderMode(model) : 'capsule';
    return;
  }
  actor.characterModel3dId = model.id || '';
  actor.characterModelUrl = getStudioModelSource(model);
  actor.characterModelName = model.modelName || model.name || 'modele.glb';
  actor.characterRenderMode = 'glb';
  actor.characterModelScale = clamp(Number(actor.characterModelScale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
};
const getDecorModelScale = (prop = {}) => clamp(Number(prop.decorModelScale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
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

const getCachedImage = (cache, src) => {
  if (!src) return null;
  const cached = cache.get(src);
  if (cached) return cached.complete && cached.naturalWidth ? cached : null;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {};
  image.onerror = () => cache.delete(src);
  image.src = src;
  cache.set(src, image);
  return null;
};

const getPropWidth = (prop = {}) => Math.max(12, Number(prop.w) || (Number(prop.r) || 34) * 2);
const getPropHeight = (prop = {}) => Math.max(12, Number(prop.h) || (Number(prop.r) || 34) * 2);
const getPropModelHeight = (prop = {}) => Math.max(12, Number(prop.modelHeight) || getPropHeight(prop));
const getPropRenderMode = (prop = {}) => prop.renderMode || (prop.imageData ? 'billboard' : 'rock');
const isFloorTileProp = (prop = {}) => getPropRenderMode(prop) === 'floor';
const isFlatTileLikeProp = (prop = {}) => {
  if (isFloorTileProp(prop)) return true;
  if (getPropRenderMode(prop) !== 'glb') return false;
  const rotationX = Math.abs(normalizeModelRotation(prop.modelRotationX || 0));
  return rotationX >= 30 && rotationX <= 150;
};
const getFloorTileWorldSize = (prop = {}) => Math.max(12, Math.round(Math.max(getPropWidth(prop), getPropHeight(prop))));
const getFlatTileWorldDimensions = (prop = {}) => {
  if (getPropRenderMode(prop) === 'glb') {
    const footprint = Math.max(12, Math.round(getPropModelHeight(prop) * getDecorModelScale(prop)));
    return { width: footprint, height: footprint };
  }
  return {
    width: Math.max(12, Math.round(getPropWidth(prop))),
    height: Math.max(12, Math.round(getPropHeight(prop))),
  };
};
const getActionZoneWidth = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.w) || ACTION_ZONE_DEFAULT_WIDTH);
const getActionZoneHeight = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.h) || ACTION_ZONE_DEFAULT_HEIGHT);
const getActionZoneModelHeight = (zone = {}) => Math.max(60, Number(zone.modelHeight) || ACTION_ZONE_DEFAULT_MODEL_HEIGHT);
const getActionZoneOpacity = (zone = {}) => clamp(Number(zone.opacity) || ACTION_ZONE_DEFAULT_OPACITY, 0.05, 0.95);
const getActionZoneColor = (zone = {}) => {
  const value = String(zone.color || '').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : (getActionZoneType(zone) === 'portal' ? '#38bdf8' : '#facc15');
};
const getActionZoneRect = (zone = {}) => ({
  x: (Number(zone.x) || 0) - getActionZoneWidth(zone) / 2,
  y: (Number(zone.y) || 0) - getActionZoneHeight(zone) / 2,
  w: getActionZoneWidth(zone),
  h: getActionZoneHeight(zone),
});
const isPointInActionZone = (zone, point) => {
  const rect = getActionZoneRect(zone);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};
const getActionZoneType = (zone = {}) => zone.actionType || 'portal';
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
const getFlatTileSnapOverlap = (dimension = 0) => {
  const size = Math.max(0, Number(dimension) || 0);
  return Math.min(FLOOR_TILE_OVERLAP, Math.max(0, size / 2 - 1));
};
const getFlatTileWorldBounds = (tiles = []) => {
  let bounds = null;
  tiles.forEach((tile) => {
    if (!tile) return;
    const { width, height } = getFlatTileWorldDimensions(tile);
    const x = Number(tile.x) || 0;
    const y = Number(tile.y) || 0;
    const tileBounds = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minY: y - height / 2,
      maxY: y + height / 2,
    };
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, tileBounds.minX),
        maxX: Math.max(bounds.maxX, tileBounds.maxX),
        minY: Math.min(bounds.minY, tileBounds.minY),
        maxY: Math.max(bounds.maxY, tileBounds.maxY),
      }
      : tileBounds;
  });
  return bounds;
};
const getFlatTileEdgeSnapDistance = (width = 0, height = 0) => (
  Math.min(92, Math.max(FLOOR_TILE_EDGE_SNAP_DISTANCE, Math.min(width, height) * 0.35))
);
const snapFlatTileToWorldEdges = (tile, world = {}, options = {}) => {
  if (!tile || !isFlatTileLikeProp(tile)) return false;
  const { width, height } = getFlatTileWorldDimensions(tile);
  const worldWidth = Math.max(width, Number(world.width) || width);
  const worldHeight = Math.max(height, Number(world.height) || height);
  const minX = width / 2;
  const maxX = worldWidth - width / 2;
  const minY = height / 2;
  const maxY = worldHeight - height / 2;
  const snapDistance = options.force ? Infinity : getFlatTileEdgeSnapDistance(width, height);
  const currentX = Number(tile.x) || 0;
  const currentY = Number(tile.y) || 0;
  let nextX = currentX;
  let nextY = currentY;

  if (Math.abs(currentX - minX) <= snapDistance) nextX = minX;
  else if (Math.abs(currentX - maxX) <= snapDistance) nextX = maxX;
  if (Math.abs(currentY - minY) <= snapDistance) nextY = minY;
  else if (Math.abs(currentY - maxY) <= snapDistance) nextY = maxY;

  if (nextX === currentX && nextY === currentY) return false;
  tile.x = Math.round(clamp(nextX, minX, maxX));
  tile.y = Math.round(clamp(nextY, minY, maxY));
  tile.blocksMovement = false;
  return true;
};
const getFlatTileGroupEdgeSnapOffset = (config = {}, dragState = {}, delta = {}) => {
  const items = dragState.items || [];
  if (items.length <= 1) return { x: 0, y: 0 };
  const props = config.props || [];
  const projectedTiles = items.map(({ entity, start }) => {
    if (entity?.type !== 'prop' || !start) return null;
    const prop = props.find((item) => item.id === entity.id);
    if (!prop || !isFlatTileLikeProp(prop)) return null;
    return {
      ...prop,
      x: start.x + (Number(delta.x) || 0),
      y: start.y + (Number(delta.y) || 0),
    };
  }).filter(Boolean);
  if (!projectedTiles.length) return { x: 0, y: 0 };
  const bounds = getFlatTileWorldBounds(projectedTiles);
  if (!bounds) return { x: 0, y: 0 };
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const snapDistance = getFlatTileEdgeSnapDistance(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const offset = { x: 0, y: 0 };

  if (Math.abs(bounds.minX) <= snapDistance) offset.x = -bounds.minX;
  else if (Math.abs(worldWidth - bounds.maxX) <= snapDistance) offset.x = worldWidth - bounds.maxX;
  if (Math.abs(bounds.minY) <= snapDistance) offset.y = -bounds.minY;
  else if (Math.abs(worldHeight - bounds.maxY) <= snapDistance) offset.y = worldHeight - bounds.maxY;

  return offset;
};
const getRangeGap = (minA, maxA, minB, maxB) => {
  if (maxA < minB) return minB - maxA;
  if (maxB < minA) return minA - maxB;
  return 0;
};
const getFlatTileGroupNeighborSnapOffset = (config = {}, dragState = {}, delta = {}) => {
  const items = dragState.items || [];
  if (items.length <= 1) return { x: 0, y: 0 };
  const props = config.props || [];
  const selectedIds = new Set(items
    .filter(({ entity, start }) => entity?.type === 'prop' && start)
    .map(({ entity }) => entity.id));
  if (!selectedIds.size) return { x: 0, y: 0 };

  const projectedTiles = items.map(({ entity, start }) => {
    if (entity?.type !== 'prop' || !start) return null;
    const prop = props.find((item) => item.id === entity.id);
    if (!prop || !isFlatTileLikeProp(prop)) return null;
    return {
      ...prop,
      x: start.x + (Number(delta.x) || 0),
      y: start.y + (Number(delta.y) || 0),
    };
  }).filter(Boolean);
  if (!projectedTiles.length) return { x: 0, y: 0 };

  const bounds = getFlatTileWorldBounds(projectedTiles);
  if (!bounds) return { x: 0, y: 0 };
  const groupWidth = bounds.maxX - bounds.minX;
  const groupHeight = bounds.maxY - bounds.minY;
  const snapDistance = Math.max(48, Math.min(groupWidth, groupHeight) * 0.85);
  let best = null;

  (props || []).forEach((target) => {
    if (!target || selectedIds.has(target.id) || !isFlatTileLikeProp(target)) return;
    const targetBounds = getFlatTileWorldBounds([target]);
    if (!targetBounds) return;
    const targetWidth = targetBounds.maxX - targetBounds.minX;
    const targetHeight = targetBounds.maxY - targetBounds.minY;
    const overlapX = getFlatTileSnapOverlap(Math.min(groupWidth, targetWidth));
    const overlapY = getFlatTileSnapOverlap(Math.min(groupHeight, targetHeight));
    const verticalGap = getRangeGap(bounds.minY, bounds.maxY, targetBounds.minY, targetBounds.maxY);
    const horizontalGap = getRangeGap(bounds.minX, bounds.maxX, targetBounds.minX, targetBounds.maxX);
    const candidates = [];

    if (verticalGap <= snapDistance) {
      candidates.push(
        { x: targetBounds.minX + overlapX - bounds.maxX, y: 0 },
        { x: targetBounds.maxX - overlapX - bounds.minX, y: 0 },
      );
    }
    if (horizontalGap <= snapDistance) {
      candidates.push(
        { x: 0, y: targetBounds.minY + overlapY - bounds.maxY },
        { x: 0, y: targetBounds.maxY - overlapY - bounds.minY },
      );
    }

    candidates.forEach((candidate) => {
      const distance = Math.hypot(candidate.x, candidate.y);
      if (distance > snapDistance) return;
      if (!best || distance < best.distance) best = { ...candidate, distance };
    });
  });

  return best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
};
const snapFlatTileToNeighbors = (tile, props = [], world = {}, options = {}) => {
  if (!tile || !isFlatTileLikeProp(tile)) return false;
  const { width, height } = getFlatTileWorldDimensions(tile);
  const snapDistance = options.force ? Infinity : Math.max(48, Math.min(width, height) * 0.85);
  let best = null;
  (props || []).forEach((target) => {
    if (!target || target.id === tile.id || !isFlatTileLikeProp(target)) return;
    const targetSize = getFlatTileWorldDimensions(target);
    const overlapX = getFlatTileSnapOverlap(Math.min(width, targetSize.width));
    const overlapY = getFlatTileSnapOverlap(Math.min(height, targetSize.height));
    const candidates = [
      {
        x: (Number(target.x) || 0) - (targetSize.width + width) / 2 + overlapX,
        y: Number(target.y) || 0,
      },
      {
        x: (Number(target.x) || 0) + (targetSize.width + width) / 2 - overlapX,
        y: Number(target.y) || 0,
      },
      {
        x: Number(target.x) || 0,
        y: (Number(target.y) || 0) - (targetSize.height + height) / 2 + overlapY,
      },
      {
        x: Number(target.x) || 0,
        y: (Number(target.y) || 0) + (targetSize.height + height) / 2 - overlapY,
      },
    ];
    candidates.forEach((candidate) => {
      const distance = Math.hypot((Number(tile.x) || 0) - candidate.x, (Number(tile.y) || 0) - candidate.y);
      if (!best || distance < best.distance) best = { ...candidate, distance };
    });
  });
  if (!best || best.distance > snapDistance) return false;
  tile.x = Math.round(clamp(best.x, width / 2, (Number(world.width) || width) - width / 2));
  tile.y = Math.round(clamp(best.y, height / 2, (Number(world.height) || height) - height / 2));
  tile.blocksMovement = false;
  return true;
};
const getPropRect = (prop = {}) => ({
  x: prop.x - getPropWidth(prop) / 2,
  y: prop.y - getPropHeight(prop) / 2,
  w: getPropWidth(prop),
  h: getPropHeight(prop),
});
const guessPropRenderMode = (fileName = '') => {
  const name = fileName.toLowerCase();
  if (/(route|road|chemin|path|rue|street|sol|floor|terrain)/.test(name)) return 'floor';
  if (/(maison|house|cabane|hut|building|batiment)/.test(name)) return 'house';
  if (/(rocher|rock|stone|pierre|boulder)/.test(name)) return 'rock';
  return 'billboard';
};
const shouldPropBlockByMode = (mode) => ['box', 'rock', 'house'].includes(mode);
const getReliefWidth = (relief = {}) => Math.max(40, Number(relief.w) || 300);
const getReliefHeight = (relief = {}) => Math.max(40, Number(relief.h) || 180);
const getReliefElevation = (relief = {}) => {
  const elevation = Number(relief.elevation);
  return clamp(Number.isFinite(elevation) ? elevation : 24, -80, 120);
};
const getReliefStyle = (id = 'plateau') => RELIEF_STYLE_OPTIONS.find((option) => option.id === id) || RELIEF_STYLE_OPTIONS[0];

const isPointInProp = (prop, point) => {
  const rect = getPropRect(prop);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};

const getReliefRect = (relief = {}) => ({
  x: relief.x - getReliefWidth(relief) / 2,
  y: relief.y - getReliefHeight(relief) / 2,
  w: getReliefWidth(relief),
  h: getReliefHeight(relief),
});

const isPointInRelief = (relief, point) => {
  const rect = getReliefRect(relief);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};

const getBlockingObstacles = (config = {}) => [
  ...(config.obstacles || []),
  ...((config.reliefs || []).filter((relief) => relief.blocksMovement).map(getReliefRect)),
  ...((config.props || []).filter((prop) => prop.blocksMovement).map(getPropRect)),
];

const rectCircleOverlap = (rect, circle) => {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.r;
};

const pushCircleOutOfRect = (circle, rect) => {
  if (!rectCircleOverlap(rect, circle)) return circle;
  const left = Math.abs(circle.x - rect.x);
  const right = Math.abs(rect.x + rect.w - circle.x);
  const top = Math.abs(circle.y - rect.y);
  const bottom = Math.abs(rect.y + rect.h - circle.y);
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { ...circle, x: rect.x - circle.r };
  if (min === right) return { ...circle, x: rect.x + rect.w + circle.r };
  if (min === top) return { ...circle, y: rect.y - circle.r };
  return { ...circle, y: rect.y + rect.h + circle.r };
};

const hasLineOfSight = (from, to, obstacles) => {
  const steps = Math.max(8, Math.ceil(distance(from, to) / 42));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      r: 7,
    };
    if (obstacles.some((obstacle) => rectCircleOverlap(obstacle, point))) return false;
  }
  return true;
};

const getEnemyStats = (enemy = {}) => {
  const role = enemy.role || 'rifle';
  const base = role === 'sniper'
    ? { healthScale: 7, speed: 98, range: 560, delay: 1.45, bulletSpeed: 560, spread: 0.02, score: 130 }
    : role === 'brute'
      ? { healthScale: 9, speed: 92, range: 260, delay: 0.95, bulletSpeed: 390, spread: 0.16, score: 160 }
      : { healthScale: 7, speed: 112, range: 380, delay: 0.72, bulletSpeed: 430, spread: 0.08, score: 100 };
  const maxHealth = Math.max(1, Number(enemy.combatEnemyMaxHealth) || 8);
  const strength = Math.max(0, Number(enemy.combatEnemyStrength) || 2);
  const attackSpeed = clamp(Number(enemy.combatEnemyAttackSpeed) || (1 / base.delay), 0.1, 8);
  return {
    ...base,
    speed: clamp(Number(enemy.combatEnemySpeed) || base.speed, 20, 420),
    attackSpeed,
    delay: 1 / attackSpeed,
    hp: maxHealth * base.healthScale,
    damage: Math.max(1, strength * 4),
    powerDamage: Math.max(0, Number(enemy.combatEnemyPowerDamage) || 0) * 5,
    maxMana: Math.max(0, Number(enemy.combatEnemyMaxMana) || 0),
    powerManaCost: Math.max(0, Number(enemy.combatEnemyPowerManaCost) || 3),
    powerUsageChance: Math.max(0, Math.min(100, Number(enemy.combatEnemyPowerUsageChance) || 25)),
    criticalChance: clamp(Number(enemy.combatEnemyCriticalChance) || 0, 0, 100),
    criticalMultiplier: clamp(Number(enemy.combatEnemyCriticalMultiplier) || 1.5, 1, 8),
  };
};

const createEnemyRuntime = (enemy, index) => {
  const stats = getEnemyStats(enemy);
  return {
    ...enemy,
    vx: 0,
    vy: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mana: stats.maxMana,
    maxMana: stats.maxMana,
    shootTimer: 0.25 + (index % 4) * 0.18,
    strafeTimer: 0,
    strafeDir: index % 2 === 0 ? 1 : -1,
    alert: 0,
  };
};

const createInitialState = (config) => ({
  player: {
    x: config.player.x,
    y: config.player.y,
    z: getEntityZ(config.player),
    vx: 0,
    vy: 0,
    hp: config.player.health,
    maxHp: config.player.maxHealth,
    mana: config.player.mana,
    maxMana: config.player.maxMana,
    dash: 0,
    dashCooldown: 0,
    shootCooldown: 0,
    powerCooldown: 0,
    moveTarget: null,
  },
  bullets: [],
  enemies: config.enemies.map(createEnemyRuntime),
  pickups: config.pickups.map((pickup) => ({ ...pickup })),
  particles: [],
  score: 0,
  time: 0,
  actionMessage: '',
  actionMessageTimer: 0,
  gameOver: false,
  victory: false,
});

const findEntityAt = (config, point) => {
  const obstacle = [...config.obstacles].reverse().find((item) => (
    point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h
  ));
  if (obstacle) return { type: 'obstacle', id: obstacle.id };
  const hero = [...(config.heroes || [])].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 26);
  if (hero) return { type: 'hero', id: hero.id };
  const enemy = [...config.enemies].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 26);
  if (enemy) return { type: 'enemy', id: enemy.id };
  const pickup = [...config.pickups].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 25);
  if (pickup) return { type: 'pickup', id: pickup.id };
  const actionZone = [...(config.actionZones || [])].reverse().find((item) => isPointInActionZone(item, point));
  if (actionZone) return { type: 'actionZone', id: actionZone.id };
  const prop = [...config.props].reverse().find((item) => (
    item.imageData || item.w || item.h
      ? isPointInProp(item, point)
      : Math.hypot(point.x - item.x, point.y - item.y) <= item.r + 8
  ));
  if (prop) return { type: 'prop', id: prop.id };
  const relief = [...(config.reliefs || [])].reverse().find((item) => isPointInRelief(item, point));
  if (relief) return { type: 'relief', id: relief.id };
  if (Math.hypot(point.x - config.player.x, point.y - config.player.y) <= 28) return { type: 'spawn', id: 'player' };
  return null;
};

const getSelectedEntity = (config, selected) => {
  if (!selected) return null;
  if (selected.type === 'spawn') return { type: 'spawn', item: config.player };
  const collectionName = MAP_ENTITY_COLLECTIONS[selected.type] || 'props';
  return { type: selected.type, item: (config[collectionName] || []).find((item) => item.id === selected.id) };
};

const getSelectionEntities = (config, selected, multiSelected = []) => {
  const candidates = Array.isArray(multiSelected) && multiSelected.length ? [...multiSelected] : [];
  if (selected && !candidates.some((entry) => isSameEntity(entry, selected))) candidates.push(selected);
  const seen = new Set();
  return candidates
    .map((entity) => {
      const selectedEntity = getSelectedEntity(config, entity);
      return selectedEntity?.item ? { type: entity.type, id: entity.id, item: selectedEntity.item } : null;
    })
    .filter((entity) => {
      const key = getEntityKey(entity);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getSelectionEntityBounds = ({ type, item } = {}) => {
  if (!item) return null;
  if (type === 'obstacle') {
    const width = Math.max(30, Number(item.w) || 180);
    const height = Math.max(30, Number(item.h) || 70);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x, maxX: x + width, minY: y, maxY: y + height };
  }
  if (type === 'relief') {
    const width = getReliefWidth(item);
    const height = getReliefHeight(item);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
  }
  if (type === 'prop') {
    const dimensions = isFlatTileLikeProp(item)
      ? getFlatTileWorldDimensions(item)
      : { width: getPropWidth(item), height: getPropHeight(item) };
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return {
      minX: x - dimensions.width / 2,
      maxX: x + dimensions.width / 2,
      minY: y - dimensions.height / 2,
      maxY: y + dimensions.height / 2,
    };
  }
  if (type === 'actionZone') {
    const width = getActionZoneWidth(item);
    const height = getActionZoneHeight(item);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
  }
  const radius = type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  return { minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius };
};

const getSelectionBoundsFromEntities = (entities = []) => {
  let bounds = null;
  entities.forEach((entity) => {
    const entityBounds = getSelectionEntityBounds(entity);
    if (!entityBounds) return;
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, entityBounds.minX),
        maxX: Math.max(bounds.maxX, entityBounds.maxX),
        minY: Math.min(bounds.minY, entityBounds.minY),
        maxY: Math.max(bounds.maxY, entityBounds.maxY),
      }
      : entityBounds;
  });
  if (!bounds) return null;
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  return {
    ...bounds,
    width,
    height,
    centerX: bounds.minX + width / 2,
    centerY: bounds.minY + height / 2,
  };
};

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

const duplicateMapEntityIntoConfig = (config, entity, offsetOverride = null) => {
  if (!isDuplicableSelectionEntity(entity)) return null;
  const collectionName = MAP_ENTITY_COLLECTIONS[entity.type];
  const collection = config[collectionName] || [];
  const original = collection.find((item) => item.id === entity.id);
  if (!original) return null;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const isFloorTile = entity.type === 'prop' && isFloorTileProp(original);
  const hasOffsetVector = offsetOverride && typeof offsetOverride === 'object';
  const hasNumericOffset = offsetOverride !== null
    && offsetOverride !== undefined
    && Number.isFinite(Number(offsetOverride));
  const fallbackOffset = isFloorTile
    ? getFloorTileWorldSize(original)
    : Math.max(48, Number(world.grid) || DEFAULT_ARCADE_CONFIG.world.grid);
  const offsetX = hasOffsetVector
    ? Number(offsetOverride.x) || 0
    : hasNumericOffset
      ? Number(offsetOverride)
      : fallbackOffset;
  const offsetY = hasOffsetVector
    ? Number(offsetOverride.y) || 0
    : hasNumericOffset
      ? Number(offsetOverride)
      : fallbackOffset;
  const copy = structuredClone(original);
  copy.id = createId(entity.type);
  if (Number.isFinite(Number(copy.x))) copy.x = Number(copy.x) + offsetX;
  if (Number.isFinite(Number(copy.y))) copy.y = Number(copy.y) + offsetY;

  if (isFloorTile) {
    const { width, height } = getFlatTileWorldDimensions(original);
    copy.w = width;
    copy.h = height;
    copy.r = Math.round(Math.max(width, height) / 2);
    copy.modelHeight = 12;
    copy.blocksMovement = false;
  }

  if (entity.type === 'obstacle') {
    const width = Math.max(30, Number(copy.w) || 180);
    const height = Math.max(30, Number(copy.h) || 70);
    copy.x = Math.round(clamp(Number(copy.x) || 0, 0, Math.max(0, worldWidth - width)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, 0, Math.max(0, worldHeight - height)));
  } else if (entity.type === 'relief') {
    const width = getReliefWidth(copy);
    const height = getReliefHeight(copy);
    copy.x = Math.round(clamp(Number(copy.x) || 0, width / 2, Math.max(width / 2, worldWidth - width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, height / 2, Math.max(height / 2, worldHeight - height / 2)));
  } else if (entity.type === 'prop') {
    const dimensions = isFlatTileLikeProp(copy)
      ? getFlatTileWorldDimensions(copy)
      : { width: getPropWidth(copy), height: getPropHeight(copy) };
    copy.x = Math.round(clamp(Number(copy.x) || 0, dimensions.width / 2, Math.max(dimensions.width / 2, worldWidth - dimensions.width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, dimensions.height / 2, Math.max(dimensions.height / 2, worldHeight - dimensions.height / 2)));
  } else if (entity.type === 'actionZone') {
    const width = getActionZoneWidth(copy);
    const height = getActionZoneHeight(copy);
    copy.x = Math.round(clamp(Number(copy.x) || 0, width / 2, Math.max(width / 2, worldWidth - width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, height / 2, Math.max(height / 2, worldHeight - height / 2)));
  } else {
    const radius = entity.type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
    copy.x = Math.round(clamp(Number(copy.x) || 0, radius, Math.max(radius, worldWidth - radius)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, radius, Math.max(radius, worldHeight - radius)));
  }

  if (entity.type === 'enemy') copy.combatEnemyName = `${copy.combatEnemyName || copy.name || 'Personnage'} copie`;
  if (entity.type === 'hero') copy.name = `${copy.name || 'Heros'} copie`;
  if (entity.type === 'prop') copy.name = `${copy.name || 'Objet'} copie`;
  if (entity.type === 'relief') copy.name = `${copy.name || 'Relief'} copie`;
  if (entity.type === 'actionZone') copy.name = `${copy.name || 'Zone'} copie`;

  collection.push(copy);
  config[collectionName] = collection;
  return { type: entity.type, id: copy.id };
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

const moveMapEntityToPoint = (config, selected, point, options = {}) => {
  const selectedEntity = getSelectedEntity(config, selected);
  if (!selectedEntity?.item || !point) return false;
  const item = selectedEntity.item;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const centerX = Number(point.x) || 0;
  const centerY = Number(point.y) || 0;
  if (selectedEntity.type === 'obstacle') {
    const width = Math.max(30, Number(item.w) || 180);
    const height = Math.max(30, Number(item.h) || 70);
    item.x = Math.round(clamp(centerX - width / 2, 0, Math.max(0, world.width - width)));
    item.y = Math.round(clamp(centerY - height / 2, 0, Math.max(0, world.height - height)));
    return true;
  }
  if (selectedEntity.type === 'relief') {
    const width = getReliefWidth(item);
    const height = getReliefHeight(item);
    item.x = Math.round(clamp(centerX, width / 2, Math.max(width / 2, world.width - width / 2)));
    item.y = Math.round(clamp(centerY, height / 2, Math.max(height / 2, world.height - height / 2)));
    return true;
  }
  if (selectedEntity.type === 'prop') {
    const dimensions = isFlatTileLikeProp(item)
      ? getFlatTileWorldDimensions(item)
      : { width: getPropWidth(item), height: getPropHeight(item) };
    item.x = Math.round(clamp(centerX, dimensions.width / 2, Math.max(dimensions.width / 2, world.width - dimensions.width / 2)));
    item.y = Math.round(clamp(centerY, dimensions.height / 2, Math.max(dimensions.height / 2, world.height - dimensions.height / 2)));
    if (options.snap && isFlatTileLikeProp(item)) {
      snapFlatTileToNeighbors(item, config.props || [], world, { force: false });
      snapFlatTileToWorldEdges(item, world, { force: false });
    }
    return true;
  }
  if (selectedEntity.type === 'actionZone') {
    const width = getActionZoneWidth(item);
    const height = getActionZoneHeight(item);
    item.x = Math.round(clamp(centerX, width / 2, Math.max(width / 2, world.width - width / 2)));
    item.y = Math.round(clamp(centerY, height / 2, Math.max(height / 2, world.height - height / 2)));
    return true;
  }
  const radius = selectedEntity.type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
  item.x = Math.round(clamp(centerX, radius, Math.max(radius, world.width - radius)));
  item.y = Math.round(clamp(centerY, radius, Math.max(radius, world.height - radius)));
  if (selectedEntity.type === 'spawn') item.moveTarget = null;
  return true;
};
const getEntityCenterPoint = (config, entity) => {
  const selectedEntity = getSelectedEntity(config, entity);
  if (!selectedEntity?.item) return null;
  const item = selectedEntity.item;
  if (selectedEntity.type === 'obstacle') {
    return {
      x: (Number(item.x) || 0) + (Math.max(30, Number(item.w) || 180) / 2),
      y: (Number(item.y) || 0) + (Math.max(30, Number(item.h) || 70) / 2),
    };
  }
  return { x: Number(item.x) || 0, y: Number(item.y) || 0 };
};
const moveMapEntityByDelta = (config, entity, delta, options = {}) => {
  const point = getEntityCenterPoint(config, entity);
  if (!point) return false;
  return moveMapEntityToPoint(config, entity, {
    x: point.x + (Number(delta?.x) || 0),
    y: point.y + (Number(delta?.y) || 0),
  }, options);
};
const applyGroupDragToConfig = (config, dragState, point, options = {}) => {
  if (!dragState || !point) return false;
  const delta = {
    x: (Number(point.x) || 0) - dragState.anchor.x,
    y: (Number(point.y) || 0) - dragState.anchor.y,
  };
  const isGroupMove = (dragState.items || []).length > 1;
  const groupNeighborOffset = options.snap && isGroupMove
    ? getFlatTileGroupNeighborSnapOffset(config, dragState, delta)
    : { x: 0, y: 0 };
  const neighborSnappedDelta = {
    x: delta.x + groupNeighborOffset.x,
    y: delta.y + groupNeighborOffset.y,
  };
  const groupEdgeOffset = options.snap && isGroupMove && groupNeighborOffset.x === 0 && groupNeighborOffset.y === 0
    ? getFlatTileGroupEdgeSnapOffset(config, dragState, neighborSnappedDelta)
    : { x: 0, y: 0 };
  const groupOffset = {
    x: groupNeighborOffset.x + groupEdgeOffset.x,
    y: groupNeighborOffset.y + groupEdgeOffset.y,
  };
  let moved = false;
  (dragState.items || []).forEach(({ entity, start }) => {
    if (!entity || !start) return;
    moved = moveMapEntityToPoint(config, entity, {
      x: start.x + delta.x + groupOffset.x,
      y: start.y + delta.y + groupOffset.y,
    }, isGroupMove ? { ...options, snap: false } : options) || moved;
  });
  return moved;
};

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const drawWorldFloor = (ctx, config, time = 0) => {
  const tileSize = Math.max(80, config.world.grid);
  ctx.fillStyle = '#17100d';
  ctx.fillRect(0, 0, config.world.width, config.world.height);

  for (let x = 0; x <= config.world.width; x += tileSize) {
    for (let y = 0; y <= config.world.height; y += tileSize) {
      const shade = ((x / tileSize + y / tileSize) % 2) ? 'rgba(45, 31, 25, .5)' : 'rgba(30, 22, 19, .72)';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = 'rgba(112, 74, 45, .16)';
      ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
    }
  }

  ctx.strokeStyle = 'rgba(238, 116, 38, .13)';
  ctx.lineWidth = 2;
  for (let x = 220; x <= config.world.width; x += 520) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(x) * 90, config.world.height);
    ctx.stroke();
  }

  for (let i = 0; i < 42; i += 1) {
    const x = (i * 337) % config.world.width;
    const y = (i * 593) % config.world.height;
    const pulse = 0.45 + Math.sin(time * 2 + i) * 0.18;
    ctx.fillStyle = `rgba(249, 115, 22, ${pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, 12 + (i % 5) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawCharacterImage = (ctx, actor, radius, image, preset, selected, stateIntensity = 0, aim = { x: 1, y: 0 }) => {
  const width = radius * 3.2;
  const height = radius * 3.55;
  ctx.save();
  ctx.shadowBlur = selected ? 24 : 12 + stateIntensity * 8;
  ctx.shadowColor = preset.accent;
  ctx.drawImage(image, actor.x - width / 2, actor.y - height * 0.58, width, height);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = selected ? '#f8fbff' : preset.accent;
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.beginPath();
  ctx.ellipse(actor.x, actor.y - height * 0.08, width * 0.46, height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = preset.weapon;
  ctx.lineWidth = selected ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(actor.x + aim.x * radius * 0.65, actor.y + aim.y * radius * 0.65);
  ctx.lineTo(actor.x + aim.x * radius * 1.9, actor.y + aim.y * radius * 1.9);
  ctx.stroke();
  ctx.restore();
};

const drawArcadeCharacter = (ctx, actor, {
  radius,
  aim,
  preset,
  selected = false,
  active = false,
  image = null,
  time = 0,
}) => {
  const stateIntensity = active ? 1 : 0;
  if (image) {
    drawCharacterImage(ctx, actor, radius, image, preset, selected, stateIntensity, aim);
    return;
  }

  const pulse = active ? Math.sin(time * 8) * 0.12 : 0;
  const angle = Math.atan2(aim.y, aim.x);
  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.rotate(angle);
  ctx.shadowBlur = selected ? 22 : 8 + stateIntensity * 12;
  ctx.shadowColor = preset.accent;

  ctx.fillStyle = selected ? '#f8fbff' : preset.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (1 + pulse), radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = preset.accent;
  ctx.beginPath();
  ctx.ellipse(-radius * 0.16, 0, radius * 0.36, radius * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = preset.face;
  ctx.beginPath();
  ctx.arc(radius * 0.42, -radius * 0.32, radius * 0.47, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(12, 7, 6, .58)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(radius * 0.5, -radius * 0.38);
  ctx.lineTo(radius * 0.86, -radius * 0.4);
  ctx.stroke();

  ctx.strokeStyle = preset.weapon;
  ctx.lineWidth = selected ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(radius * 0.46, radius * 0.2);
  ctx.lineTo(radius * 1.82, radius * 0.28);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, .34)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.04, 0.2, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
};

const drawArcadeProp = (ctx, prop, image, selected = false) => {
  const width = getPropWidth(prop);
  const height = getPropHeight(prop);
  if (image) {
    const x = prop.x - width / 2;
    const y = prop.y - height / 2;
    ctx.save();
    ctx.shadowBlur = selected ? 18 : 8;
    ctx.shadowColor = 'rgba(245, 158, 11, .45)';
    ctx.drawImage(image, x, y, width, height);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = selected ? '#f59e0b' : 'rgba(255, 199, 133, .28)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeRect(x, y, width, height);
    if (prop.blocksMovement) {
      ctx.fillStyle = 'rgba(255, 247, 214, .16)';
      ctx.fillRect(x + 8, y + 8, 22, 5);
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = selected ? 'rgba(214, 160, 76, .92)' : 'rgba(74, 50, 35, .86)';
  ctx.beginPath();
  ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 197, 112, .16)';
  ctx.beginPath();
  ctx.arc(prop.x - 8, prop.y - 7, prop.r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = selected ? '#f59e0b' : 'rgba(255, 199, 133, .22)';
  ctx.lineWidth = selected ? 3 : 1;
  ctx.stroke();
  if (prop.blocksMovement) {
    ctx.fillStyle = 'rgba(255, 247, 214, .16)';
    ctx.fillRect(prop.x - 10, prop.y - prop.r - 8, 20, 5);
  }
};

const drawArcadeRelief = (ctx, relief, selected = false) => {
  const rect = getReliefRect(relief);
  const elevation = getReliefElevation(relief);
  const style = getReliefStyle(relief.style);
  const depth = clamp(Math.abs(elevation) * 0.42, 6, 34);
  const radius = 14;
  const isBasin = relief.style === 'basin' || elevation < 0;

  ctx.save();
  if (isBasin) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    gradient.addColorStop(0, style.light);
    gradient.addColorStop(0.34, style.top);
    gradient.addColorStop(1, style.edge);
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = style.shadow;
    drawRoundedRect(ctx, rect.x + depth, rect.y + depth, Math.max(12, rect.w - depth * 2), Math.max(12, rect.h - depth * 2), radius);
    ctx.strokeStyle = selected ? '#f8fbff' : 'rgba(245, 158, 11, .36)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  } else {
    ctx.fillStyle = style.shadow;
    drawRoundedRect(ctx, rect.x + depth, rect.y + depth, rect.w, rect.h, radius);

    ctx.fillStyle = style.edge;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w, rect.y + depth);
    ctx.lineTo(rect.x + rect.w + depth, rect.y + depth * 1.5);
    ctx.lineTo(rect.x + rect.w + depth, rect.y + rect.h + depth * 1.2);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rect.x + depth, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w + depth, rect.y + rect.h + depth * 1.2);
    ctx.lineTo(rect.x + depth * 1.2, rect.y + rect.h + depth * 1.2);
    ctx.closePath();
    ctx.fill();

    const topGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    topGradient.addColorStop(0, style.light);
    topGradient.addColorStop(0.24, style.top);
    topGradient.addColorStop(1, style.edge);
    ctx.fillStyle = topGradient;
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? '#f8fbff' : 'rgba(255, 229, 168, .28)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  }

  ctx.strokeStyle = 'rgba(255, 244, 214, .18)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const inset = i * Math.min(rect.w, rect.h) * 0.08;
    if (rect.w - inset * 2 > 14 && rect.h - inset * 2 > 14) {
      ctx.strokeRect(rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2);
    }
  }

  if (relief.style === 'ridge') {
    ctx.strokeStyle = 'rgba(255, 238, 184, .42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w * 0.12, rect.y + rect.h * 0.64);
    ctx.lineTo(rect.x + rect.w * 0.32, rect.y + rect.h * 0.36);
    ctx.lineTo(rect.x + rect.w * 0.52, rect.y + rect.h * 0.57);
    ctx.lineTo(rect.x + rect.w * 0.72, rect.y + rect.h * 0.31);
    ctx.lineTo(rect.x + rect.w * 0.9, rect.y + rect.h * 0.52);
    ctx.stroke();
  }

  if (relief.blocksMovement) {
    ctx.fillStyle = 'rgba(255, 247, 214, .1)';
    ctx.fillRect(rect.x + 10, rect.y + 10, 22, 5);
  }

  ctx.restore();
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
  const kind = DECOR_IMPORT_KIND_MAP[model.kind] || model.kind || 'decor';
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
const getCharacterImportSourceId = (model = {}) => (getStudioModelSource(model) ? 'glb' : 'procedural');
const getDecorImportSourceId = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.imageData || model.imageName) return 'image';
  return 'procedural';
};
const getCharacterImportSubtitle = (model = {}) => (
  `${STUDIO_CHARACTER_ROLE_LABELS[model.role] || 'Heros'} - ${getStudioModelSource(model) ? (model.modelName || 'Modele GLB') : 'Personnage volume'}`
);
const getDecorImportSubtitle = (model = {}) => {
  const renderMode = getDecorImportRenderMode(model);
  return getStudioModelSource(model)
    ? (model.modelName || 'Modele GLB')
    : (STUDIO_DECOR_KIND_LABELS[model.kind] || renderMode);
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
  getSourceId,
  createAsset,
  showEmptyGroups = false,
}) => {
  const groups = new Map();
  items.forEach((item) => {
    const groupId = getGroupId(item);
    const sourceId = getSourceId(item);
    if (!groups.has(groupId)) groups.set(groupId, new Map());
    const sources = groups.get(groupId);
    if (!sources.has(sourceId)) sources.set(sourceId, []);
    const group = getImportGroup(groupOptions, groupId, 'Autres');
    const source = getImportGroup(ASSET_IMPORT_SOURCE_GROUPS, sourceId, 'Autres');
    sources.get(sourceId).push(createAsset(item, `${group.label} / ${source.label}`));
  });

  const children = groupOptions
    .map((group) => {
      const sources = groups.get(group.id);
      if (!sources) {
        return showEmptyGroups
          ? makeAssetExplorerFolder({
            id: `${id}:${group.id}`,
            label: group.label,
            tone,
            children: [],
          })
          : null;
      }
      const sourceChildren = ASSET_IMPORT_SOURCE_GROUPS
        .map((source) => {
          const assets = (sources.get(source.id) || []).sort(compareAssetExplorerNodes);
          return assets.length
            ? makeAssetExplorerFolder({
              id: `${id}:${group.id}:${source.id}`,
              label: source.label,
              tone,
              children: assets,
            })
            : null;
        })
        .filter(Boolean);
      return sourceChildren.length
        ? makeAssetExplorerFolder({
          id: `${id}:${group.id}`,
          label: group.label,
          tone,
          children: sourceChildren,
        })
        : (showEmptyGroups
          ? makeAssetExplorerFolder({
            id: `${id}:${group.id}`,
            label: group.label,
            tone,
            children: [],
          })
          : null);
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

function ArcadeMapNumberField({
  label,
  help,
  ariaLabel,
  value,
  min,
  max,
  step,
  onCommit,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const commitDraft = useCallback(() => {
    const nextValue = Number(String(draft).trim());
    if (!Number.isFinite(nextValue)) {
      setDraft(String(value ?? ''));
      return;
    }
    onCommit(nextValue);
  }, [draft, onCommit, value]);

  return (
    <label className="arcade-map-card-field">
      <input
        className="arcade-map-card-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        data-min={min}
        data-max={max}
        data-step={step}
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => {
          if (/^\d*$/.test(event.target.value)) setDraft(event.target.value);
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(value ?? ''));
            event.currentTarget.blur();
          }
        }}
      />
      <Rpg3DHelpLabel className="arcade-map-card-help-label" help={help}>{label}</Rpg3DHelpLabel>
    </label>
  );
}

function ArcadeInspectorNumberInput({
  value,
  onCommit,
  inputMode = 'decimal',
  ...props
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [isEditing, setIsEditing] = useState(false);
  const lastValueRef = useRef(String(value ?? ''));

  useEffect(() => {
    const nextValue = String(value ?? '');
    if (nextValue !== lastValueRef.current) {
      lastValueRef.current = nextValue;
      if (!isEditing) setDraft(nextValue);
      return;
    }
    if (!isEditing && draft !== '') setDraft(nextValue);
  }, [draft, isEditing, value]);

  const resetDraft = useCallback(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const commitDraft = useCallback(() => {
    const trimmed = String(draft).trim();
    const numericValue = Number(trimmed);
    if (trimmed === '') return;
    if (!Number.isFinite(numericValue)) {
      resetDraft();
      return;
    }
    onCommit(numericValue);
  }, [draft, onCommit, resetDraft]);

  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      value={draft}
      onFocus={(event) => {
        setIsEditing(true);
        props.onFocus?.(event);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        setIsEditing(false);
        commitDraft();
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          resetDraft();
          event.currentTarget.blur();
        }
        props.onKeyDown?.(event);
      }}
    />
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
      getSourceId: getCharacterImportSourceId,
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
      getSourceId: getDecorImportSourceId,
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
  onAddPresetAssets,
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
    ...(config.props || []).map((item, index) => ({ type: 'prop', item, index })),
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
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const keysRef = useRef(new Set());
  const pointerRef = useRef({ x: 0, y: 0, shooting: false, worldX: 0, worldY: 0, hasWorldPoint: false });
  const multiDragRef = useRef(null);
  const autosaveVersionRef = useRef(0);
  const lastSavedAutosaveVersionRef = useRef(0);
  const isSavingAssetsRef = useRef(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const animationRef = useRef(0);
  const lastFrameRef = useRef(0);
  const snapshotFrameRef = useRef(0);
  const actionZoneTriggerRef = useRef({ key: '', cooldownUntil: 0 });
  const cameraRef = useRef({ x: 0, y: 0, width: 1, height: 1 });
  const imageCacheRef = useRef(new Map());
  const [initialArcadeAssets] = useState(() => {
    const saved = readSavedArcadeAssets();
    const studio = createStudioProjectFromSavedAssets(saved?.studioProject, saved?.config, project);
    const activeCanvas = getActiveRpg3DCanvas(studio);
    return {
      saved,
      studioProject: studio,
      config: createConfigFromSavedAssets(activeCanvas?.config || saved?.config),
    };
  });
  const savedArcadeAssets = initialArcadeAssets.saved;
  const [config, setConfig] = useState(() => initialArcadeAssets.config);
  const configRef = useRef(config);
  const stateRef = useRef(createInitialState(config));
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [mode, setMode] = useState('edit');
  const [viewMode, setViewMode] = useState('3d');
  const [tool, setTool] = useState('select');
  const [dragMode, setDragMode] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [cameraTargetPickMode, setCameraTargetPickMode] = useState(false);
  const [cameraToolsHidden, setCameraToolsHidden] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [multiSelected, setMultiSelected] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [snapshot, setSnapshot] = useState(() => createInitialState(config));
  const [activeNpcChoice, setActiveNpcChoice] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('arcade');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false);
  const [studioProject, setStudioProject] = useState(() => initialArcadeAssets.studioProject);
  const studioProjectRef = useRef(studioProject);
  const [studioSelection, setStudioSelection] = useState({
    characterModelId: '',
    decorModelId: '',
  });
  const [managementSaveStatus, setManagementSaveStatus] = useState(
    savedArcadeAssets ? 'Sauvegarde locale chargee.' : '',
  );
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    studioProjectRef.current = studioProject;
  }, [studioProject]);

  useEffect(() => {
    isSavingAssetsRef.current = isSavingAssets;
  }, [isSavingAssets]);

  useEffect(() => {
    if (workspaceTab !== 'arcade') {
      setMapFullscreen(false);
      setMapDrawerOpen(false);
    }
  }, [workspaceTab]);

  const markAutosaveDirty = useCallback(() => {
    autosaveVersionRef.current += 1;
  }, []);

  const syncActiveCanvasConfigInRef = useCallback((nextConfig, options = {}) => {
    const nextStudioProject = syncStudioProjectActiveCanvasConfig(studioProjectRef.current, nextConfig);
    studioProjectRef.current = nextStudioProject;
    if (options.updateState) setStudioProject(nextStudioProject);
    return nextStudioProject;
  }, []);

  const resetGame = useCallback((nextConfig = configRef.current) => {
    stateRef.current = createInitialState(nextConfig);
    actionZoneTriggerRef.current = { key: '', cooldownUntil: 0 };
    lastFrameRef.current = 0;
    setActiveNpcChoice(null);
    setSnapshot(stateRef.current);
  }, []);

  const pushHistorySnapshot = useCallback(() => {
    const snapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextUndoStack = [...undoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), snapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = [];
    setUndoStack(nextUndoStack);
    setRedoStack([]);
  }, []);

  const restoreHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    const nextConfig = cloneConfig(snapshot.config);
    const nextStudioProject = syncStudioProjectActiveCanvasConfig(
      cloneStudioProjectForEdit(snapshot.studioProject || createDefaultStudioProject()),
      nextConfig,
    );
    configRef.current = nextConfig;
    studioProjectRef.current = nextStudioProject;
    setConfig(nextConfig);
    setStudioProject(nextStudioProject);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, resetGame]);

  const undoProjectChange = useCallback(() => {
    const previousUndoStack = undoStackRef.current;
    if (!previousUndoStack.length) return;
    const snapshot = previousUndoStack[previousUndoStack.length - 1];
    const currentSnapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextUndoStack = previousUndoStack.slice(0, -1);
    const nextRedoStack = [...redoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), currentSnapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    restoreHistorySnapshot(snapshot);
  }, [restoreHistorySnapshot]);

  const redoProjectChange = useCallback(() => {
    const previousRedoStack = redoStackRef.current;
    if (!previousRedoStack.length) return;
    const snapshot = previousRedoStack[previousRedoStack.length - 1];
    const currentSnapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextRedoStack = previousRedoStack.slice(0, -1);
    const nextUndoStack = [...undoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), currentSnapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    restoreHistorySnapshot(snapshot);
  }, [restoreHistorySnapshot]);

  useEffect(() => {
    if (!user?.id || !hasSupabaseConfig()) return undefined;
    let cancelled = false;
    setManagementSaveStatus((current) => current || 'Chargement Supabase...');
    loadArcadeAssetsFromSupabase(user.id)
      .then((remoteAssets) => {
        if (cancelled || !remoteAssets) return;
        const nextStudioProject = createStudioProjectFromSavedAssets(remoteAssets.studioProject, remoteAssets.config, project);
        const nextConfig = createConfigFromSavedAssets(getActiveRpg3DCanvas(nextStudioProject)?.config || remoteAssets.config);
        configRef.current = nextConfig;
        studioProjectRef.current = syncStudioProjectActiveCanvasConfig(nextStudioProject, nextConfig);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setConfig(nextConfig);
        setStudioProject(studioProjectRef.current);
        setUndoStack([]);
        setRedoStack([]);
        resetGame(nextConfig);
        rememberArcadeAssetsLocally(remoteAssets);
        setManagementSaveStatus('Sauvegarde Supabase chargee.');
      })
      .catch((error) => {
        if (cancelled) return;
        if (isStorageNotFoundError(error)) {
          setManagementSaveStatus((current) => current === 'Chargement Supabase...' ? '' : current);
          return;
        }
        setManagementSaveStatus('Chargement Supabase impossible.');
      });
    return () => {
      cancelled = true;
    };
  }, [project, resetGame, user?.id]);

  const patchConfig = useCallback((recipe, shouldReset = true) => {
    pushHistorySnapshot();
    const next = cloneConfig(configRef.current);
    recipe(next);
    configRef.current = next;
    syncActiveCanvasConfigInRef(next);
    if (shouldReset) resetGame(next);
    setConfig(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef]);

  const patchConfigWithoutHistory = useCallback((recipe, shouldReset = false) => {
    const next = cloneConfig(configRef.current);
    recipe(next);
    configRef.current = next;
    syncActiveCanvasConfigInRef(next);
    if (shouldReset) resetGame(next);
    setConfig(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, resetGame, syncActiveCanvasConfigInRef]);

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

  const adjustCameraZoom = useCallback((direction) => {
    patchViewportEngineConfig((engine) => {
      const currentDistance = Number(engine.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
      engine.cameraDistance = clamp(currentDistance + direction * 4, 10, 44);
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
    setPendingPlacement(null);
    setCameraTargetPickMode((current) => !current);
  }, []);

  const handleCameraTargetPick = useCallback((entity, success) => {
    if (success && entity) setCameraTargetPickMode(false);
  }, []);

  useEffect(() => {
    if (mode === 'play' || viewMode !== '3d') setCameraTargetPickMode(false);
  }, [mode, viewMode]);

  const patchStudioProject = useCallback((recipe) => {
    pushHistorySnapshot();
    const next = cloneStudioProjectForEdit(studioProjectRef.current);
    recipe(next);
    studioProjectRef.current = next;
    setStudioProject(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot]);

  useEffect(() => {
    setConfig((current) => {
      const synced = syncConfigModelReferences(current, studioProject);
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

  const saveArcadeAssets = useCallback(async () => {
    const savingVersion = autosaveVersionRef.current;
    if (isSavingAssetsRef.current) return;
    if (hasSupabaseConfig()) {
      if (!authReady) {
        setManagementSaveStatus('Compte en cours de chargement...');
        return;
      }
      if (!user?.id) {
        setManagementSaveStatus('Connecte-toi pour sauvegarder dans Supabase.');
        return;
      }
    }

    isSavingAssetsRef.current = true;
    setIsSavingAssets(true);
    setManagementSaveStatus(
      hasSupabaseConfig() ? 'Sauvegarde Supabase...' : 'Sauvegarde locale...',
    );
    try {
      const currentConfig = configRef.current;
      const currentStudioProject = syncActiveCanvasConfigInRef(currentConfig, { updateState: workspaceTab === 'canvases' });
      if (hasSupabaseConfig() && user?.id) {
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
      setManagementSaveStatus(error?.message ? `Sauvegarde Supabase impossible: ${error.message}` : 'Sauvegarde Supabase impossible.');
    } finally {
      isSavingAssetsRef.current = false;
      setIsSavingAssets(false);
    }
  }, [authReady, project, resetGame, syncActiveCanvasConfigInRef, user?.id, workspaceTab]);

  const addDownloadedAssets = useCallback(() => {
    patchStudioProject((draft) => {
      draft.characterModels3d = mergeById(draft.characterModels3d || [], ARCADE_3D_CHARACTER_MODELS);
      draft.decorModels3d = mergeById(draft.decorModels3d || [], ARCADE_3D_DECOR_MODELS);
    });
    setMediaError('');
  }, [patchStudioProject]);

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
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject);
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
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject);
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
      shape: 'humanoid',
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
    setViewMode('3d');
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
        if (!hadImage) next.player.characterRenderMode = guessCharacterRenderMode(file.name || '');
        if (!next.player.characterModelScale) next.player.characterModelScale = 1;
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

  const resolveMapCollision = useCallback((entity, radius) => {
    const liveConfig = configRef.current;
    let next = {
      ...entity,
      x: clamp(entity.x, radius, liveConfig.world.width - radius),
      y: clamp(entity.y, radius, liveConfig.world.height - radius),
      r: radius,
    };
    getBlockingObstacles(liveConfig).forEach((obstacle) => {
      next = pushCircleOutOfRect(next, obstacle);
    });
    return { ...entity, x: next.x, y: next.y };
  }, []);

  const spawnParticles = useCallback((x, y, color, count = 8) => {
    const particles = stateRef.current.particles;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
      });
    }
  }, []);

  const fireBullet = useCallback((owner, from, target, speed, damage, color, spread = 0) => {
    const angle = Math.atan2(target.y - from.y, target.x - from.x) + (Math.random() - 0.5) * spread;
    stateRef.current.bullets.push({
      id: `${owner}-${performance.now()}-${Math.random()}`,
      owner,
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      color,
      life: owner === 'player' ? 1.2 : 1.85,
    });
  }, []);

  const updateGame = useCallback((dt) => {
    const liveConfig = configRef.current;
    const state = stateRef.current;
    if (mode !== 'play' || state.gameOver || state.victory) return;
    state.time += dt;
    state.actionMessageTimer = Math.max(0, (Number(state.actionMessageTimer) || 0) - dt);
    if (state.actionMessageTimer <= 0) state.actionMessage = '';
    const blockingObstacles = getBlockingObstacles(liveConfig);
    const player = state.player;
    const keys = keysRef.current;
    const aim = pointerRef.current;

    let inputX = 0;
    let inputY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;
    const hasKeyboardMove = Boolean(inputX || inputY);
    if (!hasKeyboardMove && player.moveTarget) {
      const targetDistance = Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y);
      if (targetDistance < PLAYER_RADIUS + 4) {
        player.moveTarget = null;
      } else {
        inputX = player.moveTarget.x - player.x;
        inputY = player.moveTarget.y - player.y;
      }
    }
    if (hasKeyboardMove) player.moveTarget = null;
    const input = normalize(inputX, inputY);

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.powerCooldown = Math.max(0, player.powerCooldown - dt);
    if (keys.has('Space') && player.dashCooldown <= 0 && (input.x || input.y)) {
      player.dash = DASH_DURATION;
      player.dashCooldown = liveConfig.player.dashCooldown;
    }
    if (player.dash > 0) {
      player.dash -= dt;
      player.vx = input.x * liveConfig.player.dashSpeed;
      player.vy = input.y * liveConfig.player.dashSpeed;
    } else {
      player.vx = input.x * liveConfig.player.speed;
      player.vy = input.y * liveConfig.player.speed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    Object.assign(player, resolveMapCollision(player, PLAYER_RADIUS));

    if ((aim.shooting || keys.has('KeyF')) && player.shootCooldown <= 0) {
      const attackSkill = liveConfig.player.skills?.[0] || { value: 3, manaCost: 0 };
      const manaCost = Math.max(0, Number(attackSkill.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        fireBullet('player', player, { x: aim.worldX, y: aim.worldY }, liveConfig.player.bulletSpeed, Math.max(1, (Number(attackSkill.value) || 0) * 7), '#8df7ff', 0.05);
      }
      player.shootCooldown = liveConfig.player.fireRate;
      spawnParticles(player.x, player.y, '#8df7ff', 2);
    }

    const power = liveConfig.player.powers?.[0];
    if ((keys.has('KeyQ') || keys.has('KeyE')) && power && player.powerCooldown <= 0) {
      const manaCost = Math.max(0, Number(power.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        player.powerCooldown = 0.65;
        const color = getPowerColor(power.type);
        fireBullet('player', player, { x: aim.worldX, y: aim.worldY }, liveConfig.player.bulletSpeed * 0.86, Math.max(1, (Number(power.force) || 0) * 10), color, 0.02);
        spawnParticles(player.x, player.y, color, 12);
      }
    }

    state.pickups = state.pickups.filter((pickup) => {
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 34) return true;
      if (pickup.type === 'health') player.hp = Math.min(player.maxHp, player.hp + 28);
      if (pickup.type === 'mana') player.mana = Math.min(player.maxMana, player.mana + 4);
      if (pickup.type === 'energy') player.dashCooldown = 0;
      spawnParticles(pickup.x, pickup.y, pickup.type === 'health' ? '#7ef29d' : pickup.type === 'mana' ? '#67e8f9' : '#ffdf6c', 14);
      return false;
    });

    const activeActionZone = (liveConfig.actionZones || []).find((zone) => isPointInActionZone(zone, player));
    if (activeActionZone) {
      const now = performance.now();
      const actionType = getActionZoneType(activeActionZone);
      const triggerKey = `${actionType}:${activeActionZone.id || ''}:${activeActionZone.targetCanvasId || ''}:${activeActionZone.targetNpcId || ''}`;
      if (now >= (actionZoneTriggerRef.current.cooldownUntil || 0) && actionZoneTriggerRef.current.key !== triggerKey) {
        actionZoneTriggerRef.current = { key: triggerKey, cooldownUntil: now + 950 };
        if (actionType === 'portal' && activeActionZone.targetCanvasId) {
          spawnParticles(player.x, player.y, '#38bdf8', 18);
          if (activateRpg3DCanvasPortal(activeActionZone.targetCanvasId)) return;
        } else if (actionType === 'npcAction') {
          if (getNpcInteractionMode(activeActionZone) === 'multipleChoice') {
            setActiveNpcChoice({
              zoneId: activeActionZone.id,
              speaker: getActionZoneNpcLabel(liveConfig, activeActionZone.targetNpcId),
              question: getNpcQuestionText(activeActionZone),
              choices: getNpcChoiceItems(activeActionZone).filter((choice) => String(choice.label || '').trim()),
            });
            setIsPaused(true);
            spawnParticles(player.x, player.y, '#facc15', 12);
          } else {
            state.actionMessage = activeActionZone.message || activeActionZone.npcAction || 'Action PNJ';
            state.actionMessageTimer = 2.4;
            spawnParticles(player.x, player.y, '#facc15', 12);
          }
        }
      }
    } else if (actionZoneTriggerRef.current.key) {
      actionZoneTriggerRef.current = { key: '', cooldownUntil: actionZoneTriggerRef.current.cooldownUntil || 0 };
    }

    state.enemies.forEach((enemy) => {
      const stats = getEnemyStats(enemy);
      const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y);
      const playerDistance = distance(enemy, player);
      const canSee = hasLineOfSight(enemy, player, blockingObstacles);
      enemy.alert = canSee && playerDistance < liveConfig.ai.visionRange ? 1 : Math.max(0, enemy.alert - dt * 0.35);
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeTimer = 0.8 + Math.random() * 1.2;
        enemy.strafeDir *= -1;
      }
      const rangeMove = playerDistance > stats.range ? 1 : playerDistance < stats.range - 110 ? -0.8 : 0.1;
      const strafe = enemy.alert ? enemy.strafeDir * 0.68 : 0;
      let moveX = toPlayer.x * rangeMove + -toPlayer.y * strafe;
      let moveY = toPlayer.y * rangeMove + toPlayer.x * strafe;

      blockingObstacles.forEach((obstacle) => {
        const expanded = {
          x: obstacle.x - liveConfig.ai.obstacleAvoidance,
          y: obstacle.y - liveConfig.ai.obstacleAvoidance,
          w: obstacle.w + liveConfig.ai.obstacleAvoidance * 2,
          h: obstacle.h + liveConfig.ai.obstacleAvoidance * 2,
        };
        if (rectCircleOverlap(expanded, { x: enemy.x, y: enemy.y, r: 1 })) {
          const center = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 };
          const away = normalize(enemy.x - center.x, enemy.y - center.y);
          moveX += away.x * 1.1;
          moveY += away.y * 1.1;
        }
      });

      const move = normalize(moveX, moveY);
      enemy.vx = move.x * stats.speed * liveConfig.ai.aggression;
      enemy.vy = move.y * stats.speed * liveConfig.ai.aggression;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      Object.assign(enemy, resolveMapCollision(enemy, ENEMY_RADIUS));

      enemy.shootTimer -= dt;
      if (enemy.alert && canSee && enemy.shootTimer <= 0) {
        const canUsePower = stats.powerDamage > 0 && enemy.mana >= stats.powerManaCost && Math.random() * 100 < stats.powerUsageChance;
        if (canUsePower) enemy.mana -= stats.powerManaCost;
        const baseShotDamage = canUsePower ? stats.powerDamage : stats.damage;
        const isCriticalShot = Math.random() * 100 < stats.criticalChance;
        const shotDamage = Math.max(1, Math.round(baseShotDamage * (isCriticalShot ? stats.criticalMultiplier : 1)));
        fireBullet(
          'enemy',
          enemy,
          player,
          stats.bulletSpeed,
          shotDamage,
          isCriticalShot ? '#fde047' : canUsePower ? '#c4b5fd' : enemy.role === 'brute' ? '#ffb36d' : '#ff776d',
          stats.spread,
        );
        if (enemy.role === 'brute') {
          fireBullet('enemy', enemy, { x: player.x + 40, y: player.y }, 390, 8, '#ffb36d', 0.18);
        }
        enemy.shootTimer = stats.delay;
      }
    });

    state.bullets = state.bullets
      .map((bullet) => ({
        ...bullet,
        x: bullet.x + bullet.vx * dt,
        y: bullet.y + bullet.vy * dt,
        life: bullet.life - dt,
      }))
      .filter((bullet) => {
        if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > liveConfig.world.width || bullet.y > liveConfig.world.height) return false;
        if (blockingObstacles.some((obstacle) => rectCircleOverlap(obstacle, { x: bullet.x, y: bullet.y, r: BULLET_RADIUS }))) {
          spawnParticles(bullet.x, bullet.y, '#9fb0cc', 5);
          return false;
        }
        if (bullet.owner === 'player') {
          const target = state.enemies.find((enemy) => Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < ENEMY_RADIUS + BULLET_RADIUS);
          if (!target) return true;
          target.hp -= bullet.damage;
          state.score += 12;
          spawnParticles(bullet.x, bullet.y, '#8df7ff', 7);
          return false;
        }
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER_RADIUS + BULLET_RADIUS) {
          player.hp -= bullet.damage;
          spawnParticles(bullet.x, bullet.y, '#ff776d', 10);
          if (player.hp <= 0) state.gameOver = true;
          return false;
        }
        return true;
      });

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      state.score += getEnemyStats(enemy).score;
      spawnParticles(enemy.x, enemy.y, '#ffdf6c', 18);
      return false;
    });

    state.particles = state.particles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        life: particle.life - dt,
        vx: particle.vx * 0.92,
        vy: particle.vy * 0.92,
      }))
      .filter((particle) => particle.life > 0);

    if (state.enemies.length === 0) state.victory = true;
  }, [activateRpg3DCanvasPortal, fireBullet, mode, resolveMapCollision, spawnParticles]);

  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    const bounds = wrapper.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(280, Math.floor(bounds.height));
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const liveConfig = configRef.current;
    const state = stateRef.current;
    const actor = mode === 'play' ? state.player : liveConfig.player;
    const camera = {
      x: clamp(actor.x - width / 2, 0, Math.max(0, liveConfig.world.width - width)),
      y: clamp(actor.y - height / 2, 0, Math.max(0, liveConfig.world.height - height)),
      width,
      height,
    };
    cameraRef.current = camera;
    pointerRef.current.worldX = pointerRef.current.x + camera.x;
    pointerRef.current.worldY = pointerRef.current.y + camera.y;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b0706';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawWorldFloor(ctx, liveConfig, state.time);
    ctx.strokeStyle = 'rgba(185, 118, 58, .08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= liveConfig.world.width; x += liveConfig.world.grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, liveConfig.world.height);
      ctx.stroke();
    }
    for (let y = 0; y <= liveConfig.world.height; y += liveConfig.world.grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(liveConfig.world.width, y);
      ctx.stroke();
    }

    (liveConfig.reliefs || []).forEach((relief) => {
      const isSelected = selected?.type === 'relief' && selected.id === relief.id;
      drawArcadeRelief(ctx, relief, isSelected);
    });

    liveConfig.props.forEach((prop) => {
      const isSelected = selected?.type === 'prop' && selected.id === prop.id;
      const propImage = getCachedImage(imageCacheRef.current, prop.imageData);
      drawArcadeProp(ctx, prop, propImage, isSelected);
    });

    liveConfig.obstacles.forEach((obstacle) => {
      const isSelected = selected?.type === 'obstacle' && selected.id === obstacle.id;
      ctx.fillStyle = isSelected ? 'rgba(95, 57, 42, .98)' : 'rgba(38, 31, 29, .96)';
      drawRoundedRect(ctx, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 10);
      ctx.fillStyle = 'rgba(255, 166, 77, .1)';
      drawRoundedRect(ctx, obstacle.x + 8, obstacle.y + 8, Math.max(8, obstacle.w - 16), 8, 4);
      ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(185, 118, 58, .28)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(obstacle.x + 0.5, obstacle.y + 0.5, obstacle.w - 1, obstacle.h - 1);
      ctx.strokeStyle = 'rgba(0, 0, 0, .45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 12, obstacle.y + obstacle.h - 8);
      ctx.lineTo(obstacle.x + obstacle.w - 12, obstacle.y + obstacle.h - 8);
      ctx.stroke();
    });

    (liveConfig.actionZones || []).forEach((zone) => {
      const rect = getActionZoneRect(zone);
      const isSelected = selected?.type === 'actionZone' && selected.id === zone.id;
      const zoneColor = getActionZoneColor(zone);
      const opacity = getActionZoneOpacity(zone);
      ctx.globalAlpha = clamp(opacity, 0.08, 0.8);
      ctx.fillStyle = zoneColor;
      ctx.strokeStyle = isSelected ? '#f8fbff' : zoneColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash([12, 8]);
      drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.setLineDash([]);
    });

    const pickupsToDraw = mode === 'play' ? state.pickups : liveConfig.pickups;
    pickupsToDraw.forEach((pickup) => {
      const isSelected = selected?.type === 'pickup' && selected.id === pickup.id;
      ctx.fillStyle = pickup.type === 'health' ? '#dc2626' : pickup.type === 'mana' ? '#2563eb' : '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, PICKUP_RADIUS + (mode === 'play' ? Math.sin(state.time * 5) * 2 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? '#f8fbff' : 'rgba(255, 224, 178, .62)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    });

    state.bullets.forEach((bullet) => {
      ctx.fillStyle = bullet.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    (liveConfig.heroes || []).forEach((hero) => {
      const isSelected = selected?.type === 'hero' && selected.id === hero.id;
      const heroPreset = getCharacterPreset(getHeroCharacterId(hero), 'runner');
      const heroImage = getCachedImage(imageCacheRef.current, hero.characterImageData);
      const aim = normalize(pointerRef.current.worldX - hero.x, pointerRef.current.worldY - hero.y);
      drawArcadeCharacter(ctx, hero, {
        radius: PLAYER_RADIUS,
        aim,
        preset: heroPreset,
        selected: isSelected,
        active: false,
        image: heroImage,
        time: state.time,
      });
    });

    const enemiesToDraw = mode === 'play' ? state.enemies : liveConfig.enemies;
    enemiesToDraw.forEach((enemy) => {
      const isSelected = selected?.type === 'enemy' && selected.id === enemy.id;
      const enemyPreset = getCharacterPreset(getEnemyCharacterId(enemy), 'guard');
      const enemyImage = getCachedImage(imageCacheRef.current, enemy.characterImageData);
      const target = mode === 'play' ? state.player : liveConfig.player;
      const aim = normalize(target.x - enemy.x, target.y - enemy.y);
      drawArcadeCharacter(ctx, enemy, {
        radius: ENEMY_RADIUS,
        aim,
        preset: enemyPreset,
        selected: isSelected,
        active: Boolean(enemy.alert),
        image: enemyImage,
        time: state.time,
      });
      if (mode === 'play') {
        ctx.fillStyle = 'rgba(0,0,0,.36)';
        ctx.fillRect(enemy.x - 21, enemy.y - 31, 42, 5);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(enemy.x - 21, enemy.y - 31, 42 * (enemy.hp / enemy.maxHp), 5);
      }
    });

    const player = mode === 'play' ? state.player : liveConfig.player;
    const aim = normalize(pointerRef.current.worldX - player.x, pointerRef.current.worldY - player.y);
    if (mode === 'play' && state.player.moveTarget) {
      ctx.strokeStyle = 'rgba(245, 158, 11, .58)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.player.moveTarget.x, state.player.moveTarget.y, 18 + Math.sin(state.time * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.player.moveTarget.x - 9, state.player.moveTarget.y);
      ctx.lineTo(state.player.moveTarget.x + 9, state.player.moveTarget.y);
      ctx.moveTo(state.player.moveTarget.x, state.player.moveTarget.y - 9);
      ctx.lineTo(state.player.moveTarget.x, state.player.moveTarget.y + 9);
      ctx.stroke();
    }
    const playerPreset = getCharacterPreset(liveConfig.player.character || 'runner', 'runner');
    const playerImage = getCachedImage(imageCacheRef.current, liveConfig.player.characterImageData);
    drawArcadeCharacter(ctx, player, {
      radius: PLAYER_RADIUS,
      aim,
      preset: playerPreset,
      selected: mode === 'edit' && selected?.type === 'spawn',
      active: player.dash > 0,
      image: playerImage,
      time: state.time,
    });

    state.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    ctx.strokeStyle = 'rgba(245, 158, 11, .62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointerRef.current.x, pointerRef.current.y, 15, 0, Math.PI * 2);
    ctx.moveTo(pointerRef.current.x - 22, pointerRef.current.y);
    ctx.lineTo(pointerRef.current.x - 8, pointerRef.current.y);
    ctx.moveTo(pointerRef.current.x + 8, pointerRef.current.y);
    ctx.lineTo(pointerRef.current.x + 22, pointerRef.current.y);
    ctx.moveTo(pointerRef.current.x, pointerRef.current.y - 22);
    ctx.lineTo(pointerRef.current.x, pointerRef.current.y - 8);
    ctx.moveTo(pointerRef.current.x, pointerRef.current.y + 8);
    ctx.lineTo(pointerRef.current.x, pointerRef.current.y + 22);
    ctx.stroke();

    ctx.fillStyle = 'rgba(12, 7, 6, .82)';
    drawRoundedRect(ctx, width - 182, 16, 166, 112, 8);
    const mapScaleX = 146 / liveConfig.world.width;
    const mapScaleY = 88 / liveConfig.world.height;
    ctx.fillStyle = 'rgba(245, 158, 11, .1)';
    ctx.fillRect(width - 172, 34, 146, 88);
    (liveConfig.reliefs || []).forEach((relief) => {
      ctx.fillStyle = relief.blocksMovement ? 'rgba(245, 158, 11, .52)' : 'rgba(214, 160, 76, .28)';
      ctx.fillRect(
        width - 172 + (relief.x - getReliefWidth(relief) / 2) * mapScaleX,
        34 + (relief.y - getReliefHeight(relief) / 2) * mapScaleY,
        Math.max(2, getReliefWidth(relief) * mapScaleX),
        Math.max(2, getReliefHeight(relief) * mapScaleY),
      );
    });
    (liveConfig.actionZones || []).forEach((zone) => {
      ctx.fillStyle = getActionZoneType(zone) === 'portal' ? 'rgba(56, 189, 248, .48)' : 'rgba(250, 204, 21, .46)';
      ctx.fillRect(
        width - 172 + (zone.x - getActionZoneWidth(zone) / 2) * mapScaleX,
        34 + (zone.y - getActionZoneHeight(zone) / 2) * mapScaleY,
        Math.max(2, getActionZoneWidth(zone) * mapScaleX),
        Math.max(2, getActionZoneHeight(zone) * mapScaleY),
      );
    });
    liveConfig.enemies.forEach((enemy) => {
      ctx.fillStyle = getCharacterPreset(getEnemyCharacterId(enemy), 'guard').body;
      ctx.fillRect(width - 172 + enemy.x * mapScaleX - 2, 34 + enemy.y * mapScaleY - 2, 4, 4);
    });
    (liveConfig.heroes || []).forEach((hero) => {
      ctx.fillStyle = getCharacterPreset(getHeroCharacterId(hero), 'runner').body;
      ctx.fillRect(width - 172 + hero.x * mapScaleX - 2, 34 + hero.y * mapScaleY - 2, 4, 4);
    });
    ctx.fillStyle = getCharacterPreset(liveConfig.player.character || 'runner', 'runner').body;
    ctx.fillRect(width - 172 + player.x * mapScaleX - 3, 34 + player.y * mapScaleY - 3, 6, 6);

    if (mode === 'play' && state.actionMessage && state.actionMessageTimer > 0) {
      ctx.fillStyle = 'rgba(8, 15, 26, .84)';
      drawRoundedRect(ctx, width / 2 - 190, 26, 380, 42, 8);
      ctx.fillStyle = '#f8fbff';
      ctx.font = '700 14px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(state.actionMessage, width / 2, 52);
      ctx.textAlign = 'start';
    }

    if (mode === 'play' && (state.gameOver || state.victory || isPaused)) {
      ctx.fillStyle = 'rgba(8, 4, 3, .74)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f8fbff';
      ctx.font = '800 28px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(state.victory ? 'Zone nettoyee' : state.gameOver ? 'Signal perdu' : 'Pause', width / 2, height / 2 - 8);
      ctx.font = '600 14px Inter, Arial';
      ctx.fillStyle = '#d6b985';
      ctx.fillText('Reprendre ou relancer depuis le panneau de controle.', width / 2, height / 2 + 22);
      ctx.textAlign = 'start';
    }
  }, [isPaused, mode, selected]);

  useEffect(() => {
    const loop = (timestamp) => {
      const last = lastFrameRef.current || timestamp;
      const dt = Math.min(0.033, (timestamp - last) / 1000);
      lastFrameRef.current = timestamp;
      if (!isPaused) updateGame(dt);
      renderGame();
      if (mode === 'play' && timestamp - snapshotFrameRef.current > 180) {
        snapshotFrameRef.current = timestamp;
        setSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPaused, renderGame, updateGame]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyP') setIsPaused((paused) => !paused);
      keysRef.current.add(event.code);
    };
    const handleKeyUp = (event) => keysRef.current.delete(event.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updatePointer = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = event.clientX - rect.left;
    pointerRef.current.y = event.clientY - rect.top;
  }, []);

  const updateWorldPointer = useCallback(({ x, y, screenX, screenY }) => {
    if (Number.isFinite(screenX)) pointerRef.current.x = screenX;
    if (Number.isFinite(screenY)) pointerRef.current.y = screenY;
    if (Number.isFinite(x)) {
      pointerRef.current.worldX = x;
      pointerRef.current.hasWorldPoint = true;
    }
    if (Number.isFinite(y)) {
      pointerRef.current.worldY = y;
      pointerRef.current.hasWorldPoint = true;
    }
  }, []);

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
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(entity);
    setSelected(entity);
    setMultiSelected(canMultiSelectEntity(entity) ? [entity] : []);
  }, []);

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
          characterRenderMode: getStudioCharacterRenderMode(model),
          characterModelScale: 1,
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
        characterRenderMode: getStudioCharacterRenderMode(model),
        characterModelScale: 1,
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
        decorModelScale: Number(model.scale) || 1,
        baseColor: model.baseColor || '#64748b',
        accentColor: model.accentColor || '#f59e0b',
        roofColor: model.roofColor || '#7f1d1d',
      };
      next.props.push(item);
      placedEntity = { type: 'prop', id: item.id };
    });
    beginEntityPlacement(placedEntity);
  }, [beginEntityPlacement, getCurrentPlacementPoint, patchConfig]);

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
      if (field === 'characterModelScale') selectedEntity.item.characterModelScale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
      if (field === 'decorModelScale') selectedEntity.item.decorModelScale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
      if (field === 'modelRotationX' || field === 'modelRotationY' || field === 'modelRotationZ') {
        selectedEntity.item[field] = clamp(value, -180, 180);
      }
      if (selectedEntity.type === 'prop' && isFloorTileProp(selectedEntity.item) && ['w', 'h', 'r'].includes(field)) {
        const tileSize = field === 'r'
          ? Math.max(12, Math.round((Number(value) || 6) * 2))
          : Math.max(12, Math.round(Number(value) || getFloorTileWorldSize(selectedEntity.item)));
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
    setSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
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
      if (!currentProp?.item || !isFlatTileLikeProp(currentProp.item)) return;
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
    const targets = getDeletableSelectionEntities(selected, multiSelected);
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
      if (!getDeletableSelectionEntities(selected, multiSelected).length) return;
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
        const liveConfig = configRef.current;
        stateRef.current.player.moveTarget = {
          x: clamp(point.x, PLAYER_RADIUS, liveConfig.world.width - PLAYER_RADIUS),
          y: clamp(point.y, PLAYER_RADIUS, liveConfig.world.height - PLAYER_RADIUS),
        };
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
      if (tool === 'spawn') {
        next.player.x = Math.round(point.x);
        next.player.y = Math.round(point.y);
        setSelected({ type: 'spawn', id: 'player' });
      }
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
          characterRenderMode: 'capsule',
          characterModelScale: 1,
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
  }, [commitPendingPlacement, duplicateSelectedTile, mode, multiSelectMode, patchConfig, pendingPlacement, selectSingleEntity, toggleMultiSelectedEntity, tool]);

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

  const handleCanvasClick = useCallback((event) => {
    updatePointer(event);
    const liveConfig = configRef.current;
    const camera = cameraRef.current;
    const point = {
      x: clamp(pointerRef.current.x + camera.x, 0, liveConfig.world.width),
      y: clamp(pointerRef.current.y + camera.y, 0, liveConfig.world.height),
    };
    updateWorldPointer({ x: point.x, y: point.y, screenX: pointerRef.current.x, screenY: pointerRef.current.y });
    handleWorldClick(point, null, event.button);
  }, [handleWorldClick, updatePointer, updateWorldPointer]);

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
  const threeView = viewMode === '3d';
  const engineConfig = config.engine || DEFAULT_ARCADE_CONFIG.engine;
  const cameraDistance = clamp(Number(engineConfig.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance, 10, 44);
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
      <section className="arcade-hud" aria-label="RPG 3D no-code builder">
        <div>
          <span className="arcade-kicker"><Sparkles size={15} /> Moteur RPG 3D no-code</span>
          <h1>RPG 3D Builder</h1>
        </div>
        <div className="arcade-actions">
          {workspaceTab === 'arcade' ? (
            <>
              <button
                type="button"
                className={playMode ? 'secondary-action' : 'button like'}
                onClick={() => {
                  const nextMode = playMode ? 'edit' : 'play';
                  setMode(nextMode);
                  setIsPaused(false);
                  resetGame();
                }}
              >
                {playMode ? <MousePointer2 size={16} /> : <Play size={16} />}
                <span>{playMode ? 'Editer' : 'Tester'}</span>
              </button>
              <button type="button" className="secondary-action" onClick={() => playMode ? setIsPaused((paused) => !paused) : resetGame()}>
                {playMode && !isPaused ? <Pause size={16} /> : <RotateCcw size={16} />}
                <span>{playMode ? (isPaused ? 'Reprendre' : 'Pause') : 'Recharger'}</span>
              </button>
              <button
                type="button"
                className="secondary-action arcade-save-action"
                onClick={saveArcadeAssets}
                disabled={isSavingAssets}
                title={managementSaveStatus || 'Sauvegarder le RPG 3D'}
              >
                <Save size={16} />
                <span>{isSavingAssets ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </button>
            </>
          ) : (
            <button type="button" className="secondary-action" onClick={() => setWorkspaceTab('arcade')}>
              <MapIcon size={16} />
              <span>Retour carte</span>
            </button>
          )}
        </div>
      </section>

      <nav className="arcade-workspace-tabs" aria-label="Ateliers RPG 3D">
        {workspaceTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={workspaceTab === tab.id ? 'active' : ''}
              aria-current={workspaceTab === tab.id ? 'page' : undefined}
              onClick={() => setWorkspaceTab(tab.id)}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

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
          onAddPresetAssets={addDownloadedAssets}
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
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.activeView}>Vue active</Rpg3DHelpLabel>
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
                <option value="3d">Viewport 3D</option>
              </select>
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.cameraHeight}>Hauteur camera</Rpg3DHelpLabel>
              <input type="range" min="8" max="28" step="1" value={engineConfig.cameraHeight} onChange={(event) => patchViewportEngineConfig((engine) => { engine.cameraHeight = Number(event.target.value); })} />
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.cameraDistance}>Distance camera</Rpg3DHelpLabel>
              <input type="range" min="10" max="44" step="1" value={engineConfig.cameraDistance} onChange={(event) => patchViewportEngineConfig((engine) => { engine.cameraDistance = Number(event.target.value); })} />
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
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.lightIntensity}>Lumiere</Rpg3DHelpLabel>
              <input type="range" min="0.5" max="2.2" step="0.05" value={engineConfig.lightIntensity} onChange={(event) => patchViewportEngineConfig((engine) => { engine.lightIntensity = Number(event.target.value); })} />
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
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterModel}>Modele GLB</Rpg3DHelpLabel>
              <select value={config.player.characterModel3dId || ''} onChange={(event) => patchConfig((next) => {
                const model = studioHeroModels.find((entry) => entry.id === event.target.value);
                applyCharacterModelToActor(next.player, model);
              }, false)}>
                <option value="">Aucun</option>
                {studioHeroModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name || model.modelName || 'Modele GLB'}</option>
                ))}
              </select>
            </label>
            <label>
              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterScale}>Taille 3D</Rpg3DHelpLabel>
              <input type="range" min="0.6" max={MODEL_SCALE_MAX} step="0.1" value={getCharacterModelScale(config.player)} onChange={(event) => patchConfig((next) => { next.player.characterModelScale = Number(event.target.value); }, false)} />
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
              }}>Retirer modele GLB</button>
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
        <aside className="arcade-builder-panel arcade-map-card" aria-label="Carte">
          <div className="arcade-panel-section">
            <div className="arcade-map-card-summary">
              <h2><MapIcon size={13} /> Carte</h2>
              <div className="arcade-map-card-grid">
                <ArcadeMapNumberField
                  label="Largeur"
                  help={RPG3D_FIELD_HELP.mapWidth}
                  ariaLabel="Largeur de la carte"
                  min="1200"
                  max="9000"
                  step="100"
                  value={config.world.width}
                  onCommit={(value) => updateArcadeWorldField('width', value)}
                />
                <ArcadeMapNumberField
                  label="Hauteur"
                  help={RPG3D_FIELD_HELP.mapHeight}
                  ariaLabel="Hauteur de la carte"
                  min="900"
                  max="7000"
                  step="100"
                  value={config.world.height}
                  onCommit={(value) => updateArcadeWorldField('height', value)}
                />
                <ArcadeMapNumberField
                  label="Grille"
                  help={RPG3D_FIELD_HELP.mapGrid}
                  ariaLabel="Taille de grille"
                  min="40"
                  max="240"
                  step="20"
                  value={config.world.grid}
                  onCommit={(value) => updateArcadeWorldField('grid', value)}
                />
                <div className="arcade-map-card-field arcade-map-card-object-field">
                  <input
                    className="arcade-map-card-input"
                    type="number"
                    min="0"
                    value={arcadeObjectCount}
                    aria-label="Objets sur la carte"
                    readOnly
                  />
                  <Rpg3DHelpLabel className="arcade-map-card-help-label" help={RPG3D_FIELD_HELP.mapObjects}>Objets</Rpg3DHelpLabel>
                </div>
              </div>
            </div>
            <ArcadeMapAssetExplorer
              characters={studioImportCharacters}
              decors={studioImportDecors}
              onImportCharacter={importStudioCharacterToCanvas}
              onImportDecor={importStudioDecorToCanvas}
            />
            <div className="arcade-map-card-actions">
              <button
                type="button"
                className={`secondary-action arcade-map-zone-button${tool === 'actionZone' ? ' active' : ''}`}
                aria-pressed={tool === 'actionZone'}
                onClick={() => {
                  setMode('edit');
                  setTool('actionZone');
                  setPendingPlacement(null);
                  setMultiSelectMode(false);
                  setCameraTargetPickMode(false);
                }}
              >
                <MousePointerClick size={15} />
                <span>Ajouter zone</span>
              </button>
              <Rpg3DHelpLabel className="arcade-map-card-help-label" help={RPG3D_FIELD_HELP.actionZoneTool}>Portail / PNJ</Rpg3DHelpLabel>
            </div>
          </div>
        </aside>
        ) : null}

        <section className="arcade-stage" ref={wrapperRef}>
          {threeView && cameraToolsHidden ? (
            <button
              type="button"
              className="arcade-stage-tools-toggle"
              title="Afficher les outils camera"
              aria-label="Afficher les outils camera"
              onClick={() => setCameraToolsHidden(false)}
            >
              <Eye size={16} />
            </button>
          ) : null}
          {threeView && !cameraToolsHidden ? (
            <div className="arcade-stage-zoom-control" role="group" aria-label="Outils camera">
              <button
                type="button"
                className="arcade-stage-tools-hide"
                title="Masquer les outils camera"
                aria-label="Masquer les outils camera"
                onClick={() => setCameraToolsHidden(true)}
              >
                <EyeOff size={16} />
              </button>
              <button
                type="button"
                className={dragMode ? 'active' : ''}
                title={dragMode ? 'Main active: glisser les objets' : 'Activer la main pour glisser les objets'}
                aria-label={dragMode ? 'Desactiver le glisser-deposer' : 'Activer le glisser-deposer'}
                aria-pressed={dragMode}
                onClick={() => {
                  setCameraTargetPickMode(false);
                  setDragMode((current) => !current);
                }}
              >
                <Hand size={17} />
              </button>
              <button
                type="button"
                className={multiSelectMode ? 'active' : ''}
                title={multiSelectMode ? 'Selection multiple active' : 'Selectionner plusieurs objets'}
                aria-label={multiSelectMode ? 'Desactiver la selection multiple' : 'Activer la selection multiple'}
                aria-pressed={multiSelectMode}
                onClick={() => {
                  setCameraTargetPickMode(false);
                  setMultiSelectMode((current) => {
                    const next = !current;
                    setMultiSelected(next && canMultiSelectEntity(selected) ? [selected] : []);
                    return next;
                  });
                }}
              >
                <MousePointerClick size={17} />
              </button>
              <button
                type="button"
                className={cameraTargetPickMode ? 'active' : ''}
                title={cameraTargetPickMode ? 'Clique un objet pour centrer l orbite camera' : 'Choisir le centre de rotation camera'}
                aria-label={cameraTargetPickMode ? 'Annuler le choix du centre de rotation camera' : 'Choisir le centre de rotation camera'}
                aria-pressed={cameraTargetPickMode}
                onClick={toggleCameraTargetPickMode}
                disabled={playMode}
              >
                <Orbit size={17} />
              </button>
              <button
                type="button"
                title="Annuler"
                aria-label="Annuler"
                onClick={undoProjectChange}
                disabled={!canUndoRpg3D}
              >
                <Undo2 size={17} />
              </button>
              <button
                type="button"
                title="Retablir"
                aria-label="Retablir"
                onClick={redoProjectChange}
                disabled={!canRedoRpg3D}
              >
                <Redo2 size={17} />
              </button>
              <button
                type="button"
                title={mapFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
                aria-label={mapFullscreen ? 'Quitter le plein ecran' : 'Activer le plein ecran'}
                aria-pressed={mapFullscreen}
                onClick={toggleMapFullscreen}
              >
                {mapFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              <button type="button" title="Zoom avant" onClick={() => adjustCameraZoom(-1)}>
                <span>+</span>
              </button>
              <output aria-label="Zoom actuel">{cameraZoomPercent}%</output>
              <button type="button" title="Zoom arriere" onClick={() => adjustCameraZoom(1)}>
                <span>-</span>
              </button>
            </div>
          ) : null}
          {threeView ? (
            <ArcadeThreeViewport
              config={config}
              configRef={configRef}
              studioProject={studioProject}
              stateRef={stateRef}
              mode={mode}
              selected={selected}
              multiSelected={multiSelected}
              multiSelectMode={multiSelectMode}
              cameraTargetPickMode={cameraTargetPickMode && mode === 'edit'}
              placementEntity={pendingPlacement}
              dragEnabled={dragMode && mode === 'edit'}
              onWorldPointer={updateWorldPointer}
              onWorldClick={handleWorldClick}
              onCameraTargetPick={handleCameraTargetPick}
              onWorldDragStart={handleWorldDragStart}
              onWorldDrag={handleWorldDrag}
              onWorldDrop={handleWorldDrop}
              onMarqueeSelect={handleMarqueeSelect}
              onShootChange={(shooting) => {
                pointerRef.current.shooting = shooting;
              }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              className="arcade-canvas"
              aria-label="Editeur RPG 3D no-code"
              onClick={handleCanvasClick}
              onContextMenu={(event) => event.preventDefault()}
              onMouseMove={updatePointer}
              onMouseDown={(event) => {
                updatePointer(event);
                if (mode === 'play' && event.button === 2) {
                  event.preventDefault();
                  pointerRef.current.shooting = true;
                }
              }}
              onMouseUp={(event) => {
                if (event.button === 2) pointerRef.current.shooting = false;
              }}
              onMouseLeave={() => {
                pointerRef.current.shooting = false;
              }}
            />
          )}
        </section>

        {showArcadeInspector ? (
        <aside className="arcade-builder-panel" aria-label="Inspecteur">
          <div className="arcade-panel-section">
            <h2>Inspecteur</h2>
            {!inspectorSelectionEntities.length ? (
              <p className="arcade-empty-state">Selectionne un objet sur la carte pour modifier ses reglages.</p>
            ) : hasMultiInspectorSelection ? (
              <div className="arcade-inspector">
                <span className="arcade-selected-type">Selection ({inspectorSelectionEntities.length})</span>
                <div className={multiPositionRowClassName}>
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionX}>X</Rpg3DHelpLabel>
                    <ArcadeInspectorNumberInput
                      value={Math.round(inspectorSelectionBounds?.centerX || 0)}
                      onCommit={(value) => updateSelectionEntities('x', value)}
                    />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionY}>Y</Rpg3DHelpLabel>
                    <ArcadeInspectorNumberInput
                      value={Math.round(inspectorSelectionBounds?.centerY || 0)}
                      onCommit={(value) => updateSelectionEntities('y', value)}
                    />
                  </label>
                  {multiSelectionCanLevitate ? (
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionZ}>Z</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput
                        min={ENTITY_Z_MIN}
                        max={ENTITY_Z_MAX}
                        step="10"
                        value={multiSelectionZValue}
                        placeholder="Mixte"
                        onCommit={(value) => updateSelectionEntities('z', value)}
                      />
                    </label>
                  ) : null}
                  {multiSelectionCanRotate ? (
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.orientation}>Orientation</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput
                        min="0"
                        max="359"
                        step="15"
                        value={multiSelectionRotationValue}
                        placeholder="Mixte"
                        onCommit={(value) => updateSelectionEntities('rotation', value)}
                      />
                    </label>
                  ) : null}
                </div>
                {multiSelectionAllFlatTiles ? (
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.floorZeroZ}>Z 0 personnages</Rpg3DHelpLabel>
                    <ArcadeInspectorNumberInput
                      min={FLOOR_ZERO_Z_MIN}
                      max={FLOOR_ZERO_Z_MAX}
                      step="0.5"
                      value={multiSelectionFloorZeroValue}
                      placeholder="Mixte"
                      onCommit={(value) => updateSelectionEntities('floorZeroZ', value)}
                    />
                  </label>
                ) : null}
                {multiSelectionCanEditActions ? (
                  <div className="arcade-inspector-actions">
                    <button type="button" className="secondary-action" onClick={duplicateSelected}>
                      <Copy size={15} />
                      <span>Dupliquer</span>
                    </button>
                    <button type="button" className="danger-button" onClick={deleteSelected}>
                      <Trash2 size={15} />
                      <span>Supprimer</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="arcade-inspector">
                <span className="arcade-selected-type">{getSelectedEntityTypeLabel(selectedEntity)}</span>
                <div className={positionRowClassName}>
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionX}>X</Rpg3DHelpLabel>
                    <ArcadeInspectorNumberInput value={Math.round(selectedEntity.item.x)} onCommit={(value) => updateEntity('x', value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionY}>Y</Rpg3DHelpLabel>
                    <ArcadeInspectorNumberInput value={Math.round(selectedEntity.item.y)} onCommit={(value) => updateEntity('y', value)} />
                  </label>
                  {selectedCanLevitate ? (
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.positionZ}>Z</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min={ENTITY_Z_MIN} max={ENTITY_Z_MAX} step="10" value={Math.round(getEntityZ(selectedEntity.item))} onCommit={(value) => updateEntity('z', value)} />
                    </label>
                  ) : null}
                  {selectedCanRotate ? (
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.orientation}>Orientation</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="0" max="359" step="15" value={Math.round(getEntityRotation(selectedEntity.item))} onCommit={(value) => updateEntity('rotation', value)} />
                    </label>
                  ) : null}
                </div>
                {selectedEntity.type === 'obstacle' && (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.width}>Largeur</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="30" value={Math.round(selectedEntity.item.w)} onCommit={(value) => updateEntity('w', value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.height}>Hauteur</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="30" value={Math.round(selectedEntity.item.h)} onCommit={(value) => updateEntity('h', value)} />
                    </label>
                  </>
                )}
                {selectedEntity.type === 'actionZone' && (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneName}>Nom zone</Rpg3DHelpLabel>
                      <input value={selectedEntity.item.name || ''} onChange={(event) => updateEntity('name', event.target.value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneType}>Action</Rpg3DHelpLabel>
                      <select
                        value={getActionZoneType(selectedEntity.item)}
                        onChange={(event) => patchConfig((next) => {
                          const currentZone = getSelectedEntity(next, selected);
                          if (!currentZone?.item) return;
                          currentZone.item.actionType = event.target.value;
                          if (event.target.value === 'portal' && !currentZone.item.targetCanvasId) {
                            currentZone.item.targetCanvasId = getDefaultPortalTargetCanvasId(studioProjectRef.current);
                          }
                        })}
                      >
                        <option value="portal">Portail vers canevas</option>
                        <option value="npcAction">Action PNJ</option>
                      </select>
                    </label>
                    <div className="arcade-enemy-stat-grid">
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneWidth}>Largeur</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min={ACTION_ZONE_MIN_SIZE} max={config.world.width} value={Math.round(getActionZoneWidth(selectedEntity.item))} onCommit={(value) => updateEntity('w', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneDepth}>Profondeur</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min={ACTION_ZONE_MIN_SIZE} max={config.world.height} value={Math.round(getActionZoneHeight(selectedEntity.item))} onCommit={(value) => updateEntity('h', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="60" max="900" value={Math.round(getActionZoneModelHeight(selectedEntity.item))} onCommit={(value) => updateEntity('modelHeight', value)} />
                      </label>
                    </div>
                    <div className="arcade-action-zone-veil-grid">
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneColor}>Couleur voile</Rpg3DHelpLabel>
                        <input type="color" value={getActionZoneColor(selectedEntity.item)} onChange={(event) => updateEntity('color', event.target.value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.actionZoneOpacity}>Opacite ({Math.round(getActionZoneOpacity(selectedEntity.item) * 100)}%)</Rpg3DHelpLabel>
                        <input type="range" min="0.05" max="0.95" step="0.05" value={getActionZoneOpacity(selectedEntity.item)} onChange={(event) => updateEntity('opacity', event.target.value)} />
                      </label>
                    </div>
                    {getActionZoneType(selectedEntity.item) === 'portal' ? (
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.targetCanvas}>Canevas destination</Rpg3DHelpLabel>
                        <select value={selectedEntity.item.targetCanvasId || ''} onChange={(event) => updateEntity('targetCanvasId', event.target.value)}>
                          <option value="">Aucun canevas</option>
                          {rpg3DCanvasOptions.map((canvasOption) => (
                            <option key={canvasOption.id} value={canvasOption.id} disabled={canvasOption.id === activeRpg3DCanvasId}>
                              {canvasOption.name || 'Canevas'}{canvasOption.id === activeRpg3DCanvasId ? ' (actuel)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.targetNpc}>PNJ cible</Rpg3DHelpLabel>
                          <select value={selectedEntity.item.targetNpcId || ''} onChange={(event) => updateEntity('targetNpcId', event.target.value)}>
                            <option value="">Aucun personnage</option>
                            {actionZoneNpcTargets.map((target) => (
                              <option key={target.id} value={target.id}>{target.label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.npcInteractionMode}>Interaction</Rpg3DHelpLabel>
                          <select
                            value={getNpcInteractionMode(selectedEntity.item)}
                            onChange={(event) => patchConfig((next) => {
                              const currentZone = getSelectedEntity(next, selected);
                              if (!currentZone?.item) return;
                              currentZone.item.npcInteractionMode = event.target.value;
                              if (event.target.value === 'multipleChoice') {
                                currentZone.item.npcQuestion = currentZone.item.npcQuestion || currentZone.item.message || 'Que veux-tu demander ?';
                                currentZone.item.npcChoices = getNpcChoiceItems(currentZone.item);
                              }
                            })}
                          >
                            <option value="message">Message simple</option>
                            <option value="multipleChoice">Question a choix multiples</option>
                          </select>
                        </label>
                        {getNpcInteractionMode(selectedEntity.item) === 'multipleChoice' ? (
                          <div className="arcade-npc-choice-editor">
                            <label>
                              <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.npcQuestion}>Question PNJ</Rpg3DHelpLabel>
                              <textarea
                                rows="3"
                                value={getNpcQuestionText(selectedEntity.item)}
                                onChange={(event) => updateEntity('npcQuestion', event.target.value)}
                              />
                            </label>
                            {getNpcChoiceItems(selectedEntity.item).map((choice, index) => (
                              <div key={choice.id} className="arcade-npc-choice-row">
                                <label>
                                  <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.npcChoice}>Choix {index + 1}</Rpg3DHelpLabel>
                                  <input value={choice.label || ''} onChange={(event) => updateSelectedNpcChoice(choice.id, 'label', event.target.value)} />
                                </label>
                                <label>
                                  <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.npcChoiceResponse}>Retour</Rpg3DHelpLabel>
                                  <input value={choice.response || ''} onChange={(event) => updateSelectedNpcChoice(choice.id, 'response', event.target.value)} />
                                </label>
                                <button
                                  type="button"
                                  className="danger-button compact arcade-npc-choice-remove"
                                  onClick={() => removeSelectedNpcChoice(choice.id)}
                                  aria-label={`Supprimer le choix ${index + 1}`}
                                  disabled={getNpcChoiceItems(selectedEntity.item).length <= 1}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button type="button" className="secondary-action arcade-npc-choice-add" onClick={addSelectedNpcChoice}>
                              <Plus size={15} />
                              <span>Ajouter un choix</span>
                            </button>
                          </div>
                        ) : (
                          <label>
                            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.zoneMessage}>Action / message</Rpg3DHelpLabel>
                            <input value={selectedEntity.item.message || ''} placeholder="dialogue:cle_ou_texte" onChange={(event) => updateEntity('message', event.target.value)} />
                          </label>
                        )}
                      </>
                    )}
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.zoneVisibility}>Visibilite test</Rpg3DHelpLabel>
                      <select
                        value={selectedEntity.item.visibleInPlay ? 'visible' : 'hidden'}
                        onChange={(event) => patchConfig((next) => {
                          const currentZone = getSelectedEntity(next, selected);
                          if (currentZone?.item) currentZone.item.visibleInPlay = event.target.value === 'visible';
                        })}
                      >
                        <option value="hidden">Masquer repere sol</option>
                        <option value="visible">Afficher repere sol</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedEntity.type === 'hero' && (
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.heroName}>Nom heros</Rpg3DHelpLabel>
                    <input value={selectedEntity.item.name || ''} onChange={(event) => updateEntity('name', event.target.value)} />
                  </label>
                )}
                {selectedEntity.type === 'enemy' && (
                  <>
                    <div className="arcade-enemy-stat-grid">
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyHealth}>PV ennemi</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="1" max="999" value={selectedEntity.item.combatEnemyMaxHealth || 8} onCommit={(value) => updateEntity('combatEnemyMaxHealth', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyStrength}>Force</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyStrength || 2} onCommit={(value) => updateEntity('combatEnemyStrength', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemySpeed}>Vitesse</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="20" max="420" step="5" value={Math.round(getEnemyStats(selectedEntity.item).speed)} onCommit={(value) => updateEntity('combatEnemySpeed', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyAttackSpeed}>Vitesse attaque</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0.1" max="8" step="0.1" value={getEnemyStats(selectedEntity.item).attackSpeed.toFixed(1)} onCommit={(value) => updateEntity('combatEnemyAttackSpeed', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyCriticalChance}>% critique</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0" max="100" step="1" value={Math.round(getEnemyStats(selectedEntity.item).criticalChance)} onCommit={(value) => updateEntity('combatEnemyCriticalChance', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyCriticalMultiplier}>Multiplicateur crit.</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="1" max="8" step="0.1" value={getEnemyStats(selectedEntity.item).criticalMultiplier.toFixed(1)} onCommit={(value) => updateEntity('combatEnemyCriticalMultiplier', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyMana}>Mana ennemi</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyMaxMana || 0} onCommit={(value) => updateEntity('combatEnemyMaxMana', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyPowerDamage}>Pouvoir degats</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyPowerDamage || 0} onCommit={(value) => updateEntity('combatEnemyPowerDamage', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.enemyPowerChance}>Tendance %</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="0" max="100" value={selectedEntity.item.combatEnemyPowerUsageChance || 25} onCommit={(value) => updateEntity('combatEnemyPowerUsageChance', value)} />
                      </label>
                    </div>
                  </>
                )}
                {selectedEntity.type === 'pickup' && (
                  <label>
                    <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.pickupType}>Bonus</Rpg3DHelpLabel>
                    <select value={selectedEntity.item.type} onChange={(event) => updateEntity('type', event.target.value)}>
                      <option value="health">Soin</option>
                      <option value="mana">Mana</option>
                      <option value="energy">Dash</option>
                    </select>
                  </label>
                )}
                {selectedEntity.type === 'relief' && (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.reliefName}>Nom relief</Rpg3DHelpLabel>
                      <input value={selectedEntity.item.name || ''} onChange={(event) => updateEntity('name', event.target.value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.reliefStyle}>Type relief</Rpg3DHelpLabel>
                      <select value={selectedEntity.item.style || 'plateau'} onChange={(event) => updateEntity('style', event.target.value)}>
                        {RELIEF_STYLE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="arcade-relief-summary">
                      <span
                        className="arcade-relief-token"
                        style={{
                          '--arcade-relief-top': selectedReliefStyle?.top || '#6f4a2e',
                          '--arcade-relief-light': selectedReliefStyle?.light || '#d19a55',
                        }}
                      >
                        <Mountain size={18} />
                      </span>
                      <div>
                        <strong>{selectedReliefStyle?.label || 'Relief'}</strong>
                        <small>{selectedEntity.item.blocksMovement ? 'Bloque le passage' : 'Relief visuel'}</small>
                      </div>
                    </div>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.width}>Largeur</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="40" max="1400" value={Math.round(getReliefWidth(selectedEntity.item))} onCommit={(value) => updateEntity('w', value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.reliefDepth}>Profondeur</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="40" max="1000" value={Math.round(getReliefHeight(selectedEntity.item))} onCommit={(value) => updateEntity('h', value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.reliefElevation}>Hauteur relief</Rpg3DHelpLabel>
                      <ArcadeInspectorNumberInput min="-80" max="120" value={Math.round(getReliefElevation(selectedEntity.item))} onCommit={(value) => updateEntity('elevation', value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.collision}>Collision</Rpg3DHelpLabel>
                      <select
                        value={selectedEntity.item.blocksMovement ? 'blocked' : 'free'}
                        onChange={(event) => patchConfig((next) => {
                          const currentRelief = getSelectedEntity(next, selected);
                          if (currentRelief?.item) currentRelief.item.blocksMovement = event.target.value === 'blocked';
                        })}
                      >
                        <option value="free">Passage libre</option>
                        <option value="blocked">Bloque le passage</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedEntity.type === 'prop' && (
                  <>
                    {selectedPropRenderMode === 'glb' ? (
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.decorScale}>Echelle 3D ({getDecorModelScale(selectedEntity.item).toFixed(1)}x)</Rpg3DHelpLabel>
                        <input type="range" min={MODEL_SCALE_MIN} max={MODEL_SCALE_MAX} step="0.05" value={getDecorModelScale(selectedEntity.item)} onChange={(event) => updateEntity('decorModelScale', event.target.value)} />
                      </label>
                    ) : null}
                    <div className="arcade-model-orientation-grid">
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.rotationX}>Inclinaison X</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationX')} onCommit={(value) => updateEntity('modelRotationX', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.rotationY}>Axe Y</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationY')} onCommit={(value) => updateEntity('modelRotationY', value)} />
                      </label>
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.rotationZ}>Inclinaison Z</Rpg3DHelpLabel>
                        <ArcadeInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationZ')} onCommit={(value) => updateEntity('modelRotationZ', value)} />
                      </label>
                    </div>
                    {selectedPropIsFlatTile ? (
                      <>
                        {selectedPropIsFloorTile ? (
                          <label>
                            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.floorTileSize}>Taille carre</Rpg3DHelpLabel>
                            <ArcadeInspectorNumberInput min="12" max="1400" value={selectedPropTileSize} onCommit={(value) => updateEntity('w', value)} />
                          </label>
                        ) : null}
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.floorZeroZ}>Z 0 personnages</Rpg3DHelpLabel>
                          <ArcadeInspectorNumberInput
                            min={FLOOR_ZERO_Z_MIN}
                            max={FLOOR_ZERO_Z_MAX}
                            step="0.5"
                            value={getFloorZeroZ(selectedEntity.item)}
                            onCommit={(value) => updateEntity('floorZeroZ', value)}
                          />
                        </label>
                        <button type="button" className="secondary-action arcade-tile-snap-button" onClick={snapSelectedTileToNeighbor}>
                          <Magnet size={15} />
                          <span>Aimant 20</span>
                        </button>
                      </>
                    ) : null}
                    {selectedEntity.item.imageData ? (
                      <button type="button" className="secondary-action" onClick={() => {
                        setMediaError('');
                        patchConfig((next) => {
                          const currentProp = getSelectedEntity(next, selected);
                          if (!currentProp?.item) return;
                          currentProp.item.imageData = '';
                          currentProp.item.imageName = '';
                        });
                      }}>Retirer image decor</button>
                    ) : null}
                    {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
                    {selectedPropIsFloorTile ? null : selectedEntity.item.imageData ? (
                      <>
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.propWidth}>Largeur</Rpg3DHelpLabel>
                          <ArcadeInspectorNumberInput min="12" max="600" value={Math.round(getPropWidth(selectedEntity.item))} onCommit={(value) => updateEntity('w', value)} />
                        </label>
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.propDepth}>Profondeur / longueur</Rpg3DHelpLabel>
                          <ArcadeInspectorNumberInput min="12" max="600" value={Math.round(getPropHeight(selectedEntity.item))} onCommit={(value) => updateEntity('h', value)} />
                        </label>
                        {selectedPropRenderMode !== 'floor' ? (
                          <label>
                            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.propModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                            <ArcadeInspectorNumberInput min="12" max="800" value={Math.round(getPropModelHeight(selectedEntity.item))} onCommit={(value) => updateEntity('modelHeight', value)} />
                          </label>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <label>
                          <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.propModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                          <ArcadeInspectorNumberInput min="12" max="800" value={Math.round(getPropModelHeight(selectedEntity.item))} onCommit={(value) => updateEntity('modelHeight', value)} />
                        </label>
                      </>
                    )}
                    {!selectedPropIsFloorTile ? (
                      <label>
                        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.collision}>Collision</Rpg3DHelpLabel>
                        <select
                          value={selectedEntity.item.blocksMovement ? 'blocked' : 'free'}
                          onChange={(event) => patchConfig((next) => {
                            const currentProp = getSelectedEntity(next, selected);
                            if (currentProp?.item) currentProp.item.blocksMovement = event.target.value === 'blocked';
                          })}
                        >
                          <option value="free">Passage libre</option>
                          <option value="blocked">Bloque le passage</option>
                        </select>
                      </label>
                    ) : null}
                  </>
                )}
                {selectedEntity.type !== 'spawn' && (
                  <div className="arcade-inspector-actions">
                    <button type="button" className="secondary-action" onClick={duplicateSelected}>
                      <Copy size={15} />
                      <span>Dupliquer</span>
                    </button>
                    <button type="button" className="danger-button" onClick={deleteSelected}>
                      <Trash2 size={15} />
                      <span>Supprimer</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {showArcadeElementLibrary ? (
          <div className="arcade-panel-section arcade-library">
            <h2>Elements</h2>
            <button type="button" onClick={() => setTool('obstacle')}><Plus size={15} /> Mur</button>
            <button type="button" onClick={() => setTool('enemy')}><Sword size={15} /> Ennemi</button>
            <button type="button" onClick={() => setTool('pickup')}><HeartPulse size={15} /> Bonus</button>
            <button type="button" onClick={() => setTool('relief')}><Mountain size={15} /> Relief</button>
            <button type="button" onClick={() => setTool('prop')}><Box size={15} /> Image 3D</button>
            <button type="button" onClick={() => setTool('actionZone')}><MousePointerClick size={15} /> Zone</button>
            <button type="button" onClick={exportConfig}><Download size={15} /> Copier JSON</button>
          </div>
          ) : null}
        </aside>
        ) : null}
      </section>
      )}

      {activeNpcChoice ? (
        <div className="overlay arcade-npc-choice-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeNpcChoice(); }}>
          <div className="overlay-card wide arcade-npc-choice-card">
            <div className="panel-head">
              <div>
                <span className="section-kicker"><MousePointerClick size={14} /> PNJ</span>
                <h2>{activeNpcChoice.speaker || 'PNJ'}</h2>
                <p className="small-note">{activeNpcChoice.question || 'Que veux-tu demander ?'}</p>
              </div>
              <button type="button" className="danger-button" onClick={closeNpcChoice}>Fermer</button>
            </div>
            <div className={`arcade-npc-choice-buttons arcade-npc-choice-buttons-${Math.min(3, Math.max(1, activeNpcChoice.choices?.length || 1))}`}>
              {(activeNpcChoice.choices || []).map((choice) => (
                <button key={choice.id || choice.label} type="button" className="secondary-action" onClick={() => handleNpcChoiceSelect(choice)}>
                  <span>{choice.label || 'Repondre'}</span>
                </button>
              ))}
              {!activeNpcChoice.choices?.length ? (
                <button type="button" className="code-primary-button" onClick={closeNpcChoice}>Continuer</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="arcade-controls" aria-label="Controles">
        {workspaceTab === 'arcade' ? (
          <>
            <span><Cuboid size={14} /> Vue 3D: clic sol pour placer</span>
            <span>{pendingPlacement ? 'Placement: deplace la souris, clic gauche pour deposer' : playMode ? 'Clic gauche: deplacement' : 'Selection: choisir un objet'}</span>
            <span>{playMode ? 'Clic droit maintenu: tir' : <><Orbit size={14} /> Orbit: clic gauche maintenu autour du point</>}</span>
            <span>{playMode ? `Espace: dash ${dashReady ? 'pret' : 'en recharge'}` : 'Clic droit maintenu: glisse camera a l ecran'}</span>
            <span>{playMode ? 'Q/E: pouvoir mana' : 'Mode 3D uniquement'}</span>
            {playMode && snapshot.actionMessage ? <span>{snapshot.actionMessage}</span> : null}
            <span>P: pause</span>
          </>
        ) : workspaceTab === 'management' ? (
          <>
            <span><List size={14} /> Gestion</span>
            <span>{(studioProject.characterModels3d || []).length + (studioProject.decorModels3d || []).length} modeles 3D</span>
            <span>{arcadeObjectCount} elements sur la carte</span>
          </>
        ) : (
          <>
            <span><ActiveWorkspaceIcon size={14} /> {activeWorkspace.label}</span>
            <span>Clic gauche maintenu: rotation autour du point clique</span>
            <span>Clic droit maintenu: glisse camera a l ecran</span>
            <span>{workspaceTab === 'decors3d' ? 'Image importee: texture appliquee au modele 3D' : 'GLB importe: modele personnage 3D'}</span>
          </>
        )}
      </section>
    </main>
  );
}

export default Rpg3DMode;
