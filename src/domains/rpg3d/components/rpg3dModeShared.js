import {
  Box,
  Circle,
  Crosshair,
  HeartPulse,
  Mountain,
  MousePointer2,
  MousePointerClick,
  Paintbrush,
  Shield,
  Sparkles,
  Square,
  Triangle,
} from 'lucide-react';
import {
  getPersistedModelAnimations,
  getStudioModelSource,
} from '../../../shared/utils/rpg3dAssetsCore.js';
import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
  normalizeCharacterRigPoints,
} from '../../../shared/utils/rpg3dCharacterRig.js';
import {
  MAP_ENTITY_COLLECTIONS,
} from '../../../shared/utils/rpg3dMapEditing.js';
import {
  DEFAULT_ARCADE_CONFIG,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  clamp,
  cloneConfig,
  getCharacterModelAxisScale,
  getDecorModelScale,
  getPropRenderMode,
  getReliefHeight,
  getReliefWidth,
  getStudioDecorKindId,
  isFlatGroundPlateauProp,
  isFloorDecorKind,
  normalizeDegrees,
} from '../../../shared/utils/rpg3dDomain.js';

const ARCADE_WORLD_SCALE = 0.018;
const CHARACTER_PLACEMENT_CAMERA_DISTANCE = 16;
const CAMERA_DISTANCE_MIN = 3.5;
const CAMERA_DISTANCE_MAX = 60;
const CAMERA_ZOOM_DRAG_SENSITIVITY = 0.08;
const RPG3D_ACTION_LOADING_DURATION_MS = 900;

const RPG3D_FIELD_HELP = {
  mapWidth: 'Largeur totale de la carte en unités du builder. Augmente-la pour donner plus d espace horizontal au parcours.',
  mapHeight: 'Hauteur totale de la carte en unités du builder. Augmente-la pour construire une zone plus profonde.',
  mapGrid: 'Pas de la grille utilisé pour aligner les placements et garder des distances régulières.',
  mapObjects: 'Nombre total d éléments placés sur le canevas actif.',
  actionZoneTool: 'Active le placement d une zone d action 3D: clique ensuite sur la carte pour la poser.',
  flatGroundTool: 'Ajoute un sol plat opaque qui cache la grille technique et sert de base au terrain.',
  flatGroundColor: 'Couleur de base du plateau plat placé sous la peinture du terrain.',
  terrainPaintTool: 'Active la peinture du terrain: maintiens le clic gauche sur le sol pour dessiner une zone colorée.',
  terrainPaintColor: 'Couleur appliquée aux nouvelles traces peintes au sol.',
  terrainPaintBrush: 'Largeur de la brosse utilisée pour dessiner les zones de terrain.',
  terrainPaintShape: 'Forme de la brosse utilisée pour peindre le terrain.',
  terrainPaintClear: 'Retire toutes les traces de peinture du terrain actuel.',
  assetFiles: 'Fichiers 3D créés dans les ateliers Personnages 3D et Objets 3D, prêts à être importés sur la carte.',
  cameraHeight: 'Hauteur de la caméra au-dessus du sol pendant l édition et le test.',
  cameraDistance: 'Distance de recul de la caméra par rapport au centre visé.',
  wallHeight: 'Hauteur visuelle des murs et obstacles dans le rendu 3D.',
  reliefScale: 'Amplifie ou réduit le volume des reliefs pour rendre le terrain plus lisible.',
  propHeight: 'Hauteur par défaut des décors simples quand aucun modèle 3D précis ne la remplace.',
  lightIntensity: 'Puissance globale de l éclairage dans la carte 3D.',
  lightOrientation: 'Direction du soleil et des ombres dans la scène 3D.',
  playerCharacter: 'Preset de personnage utilisé par le héros quand aucun modèle 3D ou sprite personnalisé ne le remplace.',
  characterRenderMode: 'Choisit si le personnage s affiche en volume procédural, modèle 3D, sprite vertical ou forme stylisée.',
  characterModel: 'Modèle 3D issu de l atelier Personnages 3D à appliquer au héros.',
  characterScale: 'Taille du modèle 3D du héros sur la carte.',
  characterMaterialBrightness: 'Luminosité propre à ce personnage sur la carte RPG 3D.',
  playerImage: 'Image verticale utilisée comme apparence du héros en mode sprite.',
  currentHealth: 'Points de vie actuels du héros au lancement du test.',
  maxHealth: 'Réserve maximale de points de vie du héros.',
  currentMana: 'Mana disponible au lancement du test.',
  maxMana: 'Réserve maximale de mana du héros.',
  playerSpeed: 'Vitesse de déplacement du héros dans la carte.',
  attackSkill: 'Nom affiché pour l attaque principale du héros.',
  attackBonus: 'Bonus numérique ajouté aux calculs de l attaque principale.',
  attackManaCost: 'Mana dépensée à chaque attaque principale.',
  powerName: 'Nom affiché pour le pouvoir principal du héros.',
  powerForce: 'Puissance de base du pouvoir avant les ajustements de combat.',
  powerManaCost: 'Mana dépensée quand le pouvoir est utilisé.',
  powerElement: 'Élément du pouvoir, utile pour différencier les effets et futures résistances.',
  enemyVision: 'Distance à partir de laquelle les ennemis détectent le héros.',
  aiAggression: 'Tendance des ennemis à poursuivre et attaquer rapidement.',
  positionX: 'Position horizontale du centre de la sélection sur la carte.',
  positionY: 'Position verticale du centre de la sélection sur la carte.',
  positionZ: 'Hauteur de la sélection par rapport au sol. Utile pour faire flotter ou poser un objet.',
  orientation: 'Rotation de la sélection autour de l axe vertical.',
  floorZeroZ: 'Hauteur de référence où les personnages marchent sur une dalle plate.',
  width: 'Largeur de l élément sélectionné.',
  height: 'Hauteur ou longueur de l élément sélectionné selon son type.',
  heroName: 'Nom du héros affiché dans les listes et futurs retours de jeu.',
  enemyHealth: 'Points de vie de départ de cet ennemi.',
  enemyStrength: 'Dégâts de base ou force offensive de cet ennemi.',
  enemySpeed: 'Vitesse de déplacement de cet ennemi.',
  enemyAttackSpeed: 'Fréquence à laquelle cet ennemi peut attaquer.',
  enemyCriticalChance: 'Chance de coup critique de cet ennemi.',
  enemyCriticalMultiplier: 'Multiplicateur appliqué quand cet ennemi fait un critique.',
  enemyMana: 'Réserve de mana disponible pour les pouvoirs ennemis.',
  enemyPowerDamage: 'Dégâts de base du pouvoir ennemi.',
  enemyPowerChance: 'Probabilité que l ennemi choisisse son pouvoir au lieu d une attaque simple.',
  pickupType: 'Type de bonus ramassé par le joueur: soin, mana ou recharge de dash.',
  reliefName: 'Nom interne du relief pour le retrouver dans la gestion des objets.',
  reliefStyle: 'Forme visuelle du relief: plateau, crête ou fosse.',
  reliefDepth: 'Profondeur ou longueur du relief sur la carte.',
  reliefElevation: 'Hauteur visuelle du relief. Une valeur négative crée un creux.',
  collision: 'Indique si cet élément bloque physiquement le passage du joueur.',
  decorScale: 'Échelle appliquée au modèle 3D de cet objet.',
  materialBrightness: 'Luminosité propre à cet objet sur la carte RPG 3D.',
  modelEraserRadius: 'Largeur de la gomme appliquée uniquement au modèle GLB sélectionné.',
  rotationX: 'Inclinaison avant/arrière du modèle sélectionné.',
  rotationY: 'Rotation verticale du modèle sélectionné.',
  rotationZ: 'Inclinaison latérale du modèle sélectionné.',
  floorTileSize: 'Taille de la dalle plate sélectionnée.',
  floorColor: 'Couleur de base d une dalle de sol plate sans texture.',
  propWidth: 'Largeur visible de l image ou du décor sélectionné.',
  propDepth: 'Profondeur ou longueur visible de l image ou du décor sélectionné.',
  propModelHeight: 'Hauteur 3D utilisée pour le rendu de cet objet.',
  actionZoneName: 'Nom interne du cube transparent pour le retrouver dans la gestion de carte.',
  actionZoneType: 'Choisit si la zone envoie vers un autre canevas ou déclenche une action liée à un PNJ.',
  actionZoneColor: 'Couleur du voile transparent affiché dans le cube 3D.',
  actionZoneOpacity: 'Transparence du voile: monte-la pour mieux voir le volume, baisse-la pour le rendre plus discret.',
  actionZoneWidth: 'Largeur du cube transparent que le joueur peut traverser pour déclencher l action.',
  actionZoneDepth: 'Profondeur du cube transparent que le joueur peut traverser pour déclencher l action.',
  actionZoneModelHeight: 'Hauteur visible du cube transparent 3D.',
  actionZoneAddEdge: 'Active le prochain clic sur une arête de la zone pour ajouter un nouveau sommet à cet endroit.',
  targetCanvas: 'Canevas de destination utilisé quand le joueur entre dans cette zone portail.',
  targetNpc: 'Personnage de carte concerné par l action PNJ déclenchée dans cette zone.',
  zoneMessage: 'Texte ou clé d action associée à la zone, utile pour un dialogue, une interaction ou un script.',
  npcInteractionMode: 'Choisit entre un simple message PNJ et une question à choix multiples.',
  npcQuestion: 'Question affichée au joueur quand il déclenche cette action PNJ.',
  npcChoice: 'Réponse sélectionnable par le joueur dans le QCM du PNJ.',
  npcChoiceResponse: 'Retour affiché après le choix. Il servira plus tard de conséquence narrative.',
  zoneVisibility: 'En test, la zone reste invisible et se met en surbrillance quand le curseur la survole.',
};

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
  { id: 'glb', label: 'Modèle 3D' },
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

const HERO_PROFILE_SECTION_TABS = [
  { id: 'profile', label: 'Profil', meta: 'Identite', icon: Shield },
  { id: 'stats', label: 'Stats', meta: 'Ressources', icon: HeartPulse },
  { id: 'skills', label: 'Compétences', icon: Sparkles },
  { id: 'inventory', label: 'Inventaire', icon: Box },
];
const HERO_INVENTORY_TYPE_OPTIONS = [
  { id: 'item', label: 'Objet' },
  { id: 'weapon', label: 'Arme' },
  { id: 'helmet', label: 'Casque' },
  { id: 'armor', label: 'Armure' },
  { id: 'leggings', label: 'Jambieres' },
  { id: 'shield', label: 'Bouclier' },
  { id: 'key', label: 'Clé' },
  { id: 'consumable', label: 'Consommable' },
  { id: 'quest', label: 'Quête' },
];
const HERO_INVENTORY_TYPE_LABELS = HERO_INVENTORY_TYPE_OPTIONS.reduce((labels, option) => {
  labels[option.id] = option.label;
  return labels;
}, {});

const STUDIO_CHARACTER_ROLE_LABELS = {
  hero: 'Héros',
  enemy: 'Ennemi',
  npc: 'PNJ',
};
const STUDIO_DECOR_KIND_LABELS = {
  billboard: 'décors',
  crate: 'mur',
  decor: 'décors',
  house: 'habitations',
  'inventory-armor': 'armures',
  'inventory-helmet': 'casques',
  'inventory-jewelry': 'bijoux',
  'inventory-leggings': 'jambières',
  'inventory-misc': 'divers',
  'inventory-shield': 'boucliers',
  'inventory-weapon': 'armes',
  road: 'sol',
  rock: 'décors',
  tree: 'décors',
  wall: 'mur',
  water: 'eau',
};
const CHARACTER_IMPORT_GROUPS = [
  { id: 'hero', label: 'Héros' },
  { id: 'enemy', label: 'Ennemis' },
  { id: 'npc', label: 'PNJ' },
];
const DECOR_INVENTORY_IMPORT_GROUPS = [
  { id: 'inventory-weapon', label: 'Armes' },
  { id: 'inventory-armor', label: 'Armures' },
  { id: 'inventory-helmet', label: 'Casques' },
  { id: 'inventory-shield', label: 'Boucliers' },
  { id: 'inventory-leggings', label: 'Jambières' },
  { id: 'inventory-jewelry', label: 'Bijoux' },
  { id: 'inventory-misc', label: 'Divers' },
];
const DECOR_IMPORT_GROUPS = [
  { id: 'road', label: 'Sol' },
  { id: 'water', label: 'Eau' },
  { id: 'wall', label: 'Mur' },
  { id: 'house', label: 'Habitations' },
  { id: 'inventory', label: 'Inventaire', children: DECOR_INVENTORY_IMPORT_GROUPS },
  { id: 'decor', label: 'Decors' },
];
const flattenImportGroups = (groups = []) => groups.flatMap((group) => [
  group,
  ...flattenImportGroups(group.children || []),
]);
const DECOR_IMPORT_GROUP_LOOKUP = flattenImportGroups(DECOR_IMPORT_GROUPS);
const DECOR_IMPORT_GROUP_IDS = new Set(DECOR_IMPORT_GROUP_LOOKUP.map((group) => group.id));
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
const ROTATABLE_ENTITY_TYPES = new Set(['hero', 'enemy', 'prop']);
const MAP_ENTITY_META = {
  hero: { label: 'Héros carte', icon: Shield, tone: 'character' },
  enemy: { label: 'Personnage carte', icon: Crosshair, tone: 'character' },
  prop: { label: 'Objet carte', icon: Box, tone: 'decor' },
  relief: { label: 'Relief carte', icon: Mountain, tone: 'decor' },
  obstacle: { label: 'Mur carte', icon: Square, tone: 'neutral' },
  pickup: { label: 'Bonus carte', icon: HeartPulse, tone: 'neutral' },
  actionZone: { label: 'Zone transparente', icon: MousePointerClick, tone: 'neutral' },
};
const MAP_CHARACTER_MANAGEMENT_GROUPS = [
  { id: 'hero', label: 'Héros', icon: Shield },
  { id: 'enemy', label: 'Ennemis', icon: Crosshair },
];
const MAP_OBJECT_MANAGEMENT_GROUPS = [
  { id: 'prop', label: 'Decors', icon: Box },
  { id: 'relief', label: 'Reliefs', icon: Mountain },
  { id: 'obstacle', label: 'Murs', icon: Square },
  { id: 'pickup', label: 'Bonus', icon: HeartPulse },
  { id: 'actionZone', label: 'Zones', icon: MousePointerClick },
];
const MANAGEMENT_DEFAULT_OPEN_FOLDERS = [];

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
const HERO_PROFILE_PLAYER_ID = 'player';
const cloneHeroProfileItems = (items = []) => (Array.isArray(items) ? items.map((item) => ({ ...(item || {}) })) : []);
const HERO_WEAPON_MODEL_SCALE_MIN = 0.001;
const HERO_WEAPON_MODEL_SCALE_MAX = 8;
const HERO_WEAPON_OFFSET_MIN = -2;
const HERO_WEAPON_OFFSET_MAX = 2;
const getEquipmentHand = (value = '') => (value === 'left' ? 'left' : 'right');
const getEquipmentArm = (value = '') => (value === 'right' ? 'right' : 'left');
const EQUIPMENT_MODEL_TYPES = new Set(['weapon', 'shield', 'armor', 'helmet', 'leggings']);
const isEquipmentModelForType = (model = null, type = '') => (
  Boolean(model && EQUIPMENT_MODEL_TYPES.has(type) && getStudioModelSource(model))
);
const ARMOR_SEGMENT_VALUES = new Set(['body', 'left-arm', 'right-arm']);
const ARMOR_RIG_POINT_IDS = new Set(CHARACTER_RIG_ARMOR_GRIP_POINTS.map((point) => point.rigPointId || point.id));
const getDefaultArmorPieceRigPointId = (segment = 'body') => {
  if (segment === 'left-arm') return 'left-elbow';
  if (segment === 'right-arm') return 'right-elbow';
  return 'lower-belly';
};
const normalizeArmorPieceRigPointId = (value = '', segment = 'body') => {
  const id = String(value || '').trim();
  return ARMOR_RIG_POINT_IDS.has(id) ? id : getDefaultArmorPieceRigPointId(segment);
};
const normalizeArmorPieceId = (value = '') => (
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
);
const normalizeArmorPieceName = (value = '', fallback = '') => {
  const cleanName = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return cleanName || fallback;
};
const normalizeArmorSegmentAssignments = (assignments = []) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => {
      const pieceId = normalizeArmorPieceId(entry?.pieceId);
      const pieceName = normalizeArmorPieceName(entry?.pieceName);
      const segment = ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body';
      return {
        path: String(entry?.path || '').slice(0, 260),
        name: String(entry?.name || '').slice(0, 120),
        segment,
        ...(pieceId ? { pieceId } : {}),
        ...(pieceName ? { pieceName } : {}),
        ...(pieceId ? { rigPointId: normalizeArmorPieceRigPointId(entry?.rigPointId, segment) } : {}),
      };
    }).filter((entry) => entry.path)
    : []
);
const normalizeArmorCustomPieces = (pieces = []) => (
  Array.isArray(pieces)
    ? pieces.map((piece, index) => {
      const id = normalizeArmorPieceId(piece?.id || `piece-${index + 1}`);
      return {
        id,
        name: normalizeArmorPieceName(piece?.name, `Morceau ${index + 1}`),
        segment: ARMOR_SEGMENT_VALUES.has(piece?.segment) ? piece.segment : 'body',
        rigPointId: normalizeArmorPieceRigPointId(piece?.rigPointId, piece?.segment),
      };
    }).filter((piece) => piece.id)
    : []
);
const normalizeArmorCutContourPoint = (point = {}) => ({
  x: clamp(Number(point?.x) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  y: clamp(Number(point?.y) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  z: clamp(Number(point?.z) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  ...normalizeArmorPaintSurfaceNormal(point),
});
const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: nx / length,
    ny: ny / length,
    nz: nz / length,
  };
};
const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 80)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      radius: clamp(Number(entry?.radius) || 0.14, 0.04, 0.5),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 240)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const ARMOR_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const getEquipmentGripReferenceScale = (source = {}) => {
  const legacyScale = Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1;
  const dimensions = [
    Number(source.width) || 0,
    Number(source.height) || 0,
    Number(source.depth) || 0,
  ].map((value) => value * legacyScale).filter((value) => Number.isFinite(value) && value > 0.0001);
  if (dimensions.length) return clamp(Math.max(...dimensions), HERO_WEAPON_MODEL_SCALE_MIN, 120);
  const explicitScale = Number(source.weaponGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, HERO_WEAPON_MODEL_SCALE_MIN, 120)
    : 1;
};
const getShieldGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.shieldGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, HERO_WEAPON_MODEL_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getArmorGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.armorGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, HERO_WEAPON_MODEL_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getEquipmentModelReferenceScale = (source = {}) => (
  clamp(getEquipmentGripReferenceScale(source), HERO_WEAPON_MODEL_SCALE_MIN, HERO_WEAPON_MODEL_SCALE_MAX)
);
const getStoredEquipmentSourceScale = (item = {}) => {
  const sourceScale = Number(item.weaponModelSourceScale);
  return Number.isFinite(sourceScale) && sourceScale > 0
    ? clamp(sourceScale, HERO_WEAPON_MODEL_SCALE_MIN, HERO_WEAPON_MODEL_SCALE_MAX)
    : 0;
};
const resolveLinkedEquipmentModelScale = (item = {}, source = null) => {
  const currentScale = Number(item.weaponModelScale);
  if (!source) {
    return clamp(
      Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1,
      HERO_WEAPON_MODEL_SCALE_MIN,
      HERO_WEAPON_MODEL_SCALE_MAX,
    );
  }
  const sourceScale = getEquipmentModelReferenceScale(source);
  const previousSourceScale = getStoredEquipmentSourceScale(item);
  if (previousSourceScale > 0) {
    const itemScale = Number.isFinite(currentScale) && currentScale > 0 ? currentScale : previousSourceScale;
    return clamp(sourceScale * (itemScale / previousSourceScale), HERO_WEAPON_MODEL_SCALE_MIN, HERO_WEAPON_MODEL_SCALE_MAX);
  }
  if (Number.isFinite(currentScale) && currentScale > 0 && Math.abs(currentScale - 1) > 0.0001) {
    return clamp(currentScale, HERO_WEAPON_MODEL_SCALE_MIN, HERO_WEAPON_MODEL_SCALE_MAX);
  }
  return sourceScale;
};
const getEquipmentModelRotationValue = (source = {}, axis = 'X') => {
  const modelField = `weaponModelRotation${axis}`;
  if (source[modelField] !== undefined && source[modelField] !== null && source[modelField] !== '') {
    return getModelRotationValue(source, modelField);
  }
  return getModelRotationValue(source, `modelRotation${axis}`);
};
const getEquipmentGripFields = (source = {}) => ({
  weaponModelRotationX: getEquipmentModelRotationValue(source, 'X'),
  weaponModelRotationY: getEquipmentModelRotationValue(source, 'Y'),
  weaponModelRotationZ: getEquipmentModelRotationValue(source, 'Z'),
  weaponGripHand: getEquipmentHand(source.weaponGripHand),
  weaponGripReferenceScale: getEquipmentGripReferenceScale(source),
  weaponGripRightEnabled: Boolean(source.weaponGripRightEnabled),
  weaponGripRightX: clamp(Number(source.weaponGripRightX) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripRightY: clamp(Number(source.weaponGripRightY) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripRightZ: clamp(Number(source.weaponGripRightZ) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripRightRotationX: getModelRotationValue(source, 'weaponGripRightRotationX'),
  weaponGripRightRotationY: getModelRotationValue(source, 'weaponGripRightRotationY'),
  weaponGripRightRotationZ: getModelRotationValue(source, 'weaponGripRightRotationZ'),
  weaponGripLeftEnabled: Boolean(source.weaponGripLeftEnabled),
  weaponGripLeftX: clamp(Number(source.weaponGripLeftX) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripLeftY: clamp(Number(source.weaponGripLeftY) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripLeftZ: clamp(Number(source.weaponGripLeftZ) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  weaponGripLeftRotationX: getModelRotationValue(source, 'weaponGripLeftRotationX'),
  weaponGripLeftRotationY: getModelRotationValue(source, 'weaponGripLeftRotationY'),
  weaponGripLeftRotationZ: getModelRotationValue(source, 'weaponGripLeftRotationZ'),
  shieldGripArm: getEquipmentArm(source.shieldGripArm),
  shieldGripReferenceScale: getShieldGripReferenceScale(source),
  shieldGripHandEnabled: Boolean(source.shieldGripHandEnabled),
  shieldGripHandX: clamp(Number(source.shieldGripHandX) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  shieldGripHandY: clamp(Number(source.shieldGripHandY) || -0.35, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  shieldGripHandZ: clamp(Number(source.shieldGripHandZ) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  shieldGripElbowEnabled: Boolean(source.shieldGripElbowEnabled),
  shieldGripElbowX: clamp(Number(source.shieldGripElbowX) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  shieldGripElbowY: clamp(Number(source.shieldGripElbowY) || 0.35, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  shieldGripElbowZ: clamp(Number(source.shieldGripElbowZ) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  armorGripReferenceScale: getArmorGripReferenceScale(source),
  ...ARMOR_GRIP_POINTS.reduce((fields, point) => ({
    ...fields,
    [`armorGrip${point.suffix}Enabled`]: Boolean(source[`armorGrip${point.suffix}Enabled`]),
    [`armorGrip${point.suffix}X`]: clamp(Number(source[`armorGrip${point.suffix}X`]) || point.defaultX, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
    [`armorGrip${point.suffix}Y`]: clamp(Number(source[`armorGrip${point.suffix}Y`]) || point.defaultY, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
    [`armorGrip${point.suffix}Z`]: clamp(Number(source[`armorGrip${point.suffix}Z`]) || point.defaultZ, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
  }), {}),
  armorCanvasCutEnabled: Boolean(source.armorCanvasCutEnabled),
  armorFullCharacterRigEnabled: Boolean(source.armorFullCharacterRigEnabled),
  armorCustomPieces: normalizeArmorCustomPieces(source.armorCustomPieces),
  armorSegmentAssignments: normalizeArmorSegmentAssignments(source.armorSegmentAssignments),
  armorCutContours: normalizeArmorCutContours(source.armorCutContours),
  armorCutPaintStrokes: normalizeArmorCutPaintStrokes(source.armorCutPaintStrokes),
});
const normalizeHeroInventoryItem = (item = {}, index = 0) => {
  const type = HERO_INVENTORY_TYPE_LABELS[item.type] ? item.type : 'item';
  const normalized = {
    id: item.id || `inventory-${index + 1}`,
    name: item.name || '',
    type,
    quantity: Math.max(1, Number(item.quantity) || 1),
    effect: item.effect || '',
  };
  if (!EQUIPMENT_MODEL_TYPES.has(type)) return normalized;
  return {
    ...normalized,
    equipped: Boolean(item.equipped),
    weaponModel3dId: item.weaponModel3dId || item.model3dId || '',
    weaponModelUrl: item.weaponModelUrl || item.modelUrl || '',
    weaponModelName: item.weaponModelName || item.modelName || '',
    weaponModelFormat: item.weaponModelFormat || item.modelFormat || '',
    weaponModelFileSize: Number(item.weaponModelFileSize || item.modelFileSize) || 0,
    weaponModelResources: cloneHeroProfileItems(item.weaponModelResources || item.modelResources || []),
    weaponModelScale: clamp(Number(item.weaponModelScale) || 1, HERO_WEAPON_MODEL_SCALE_MIN, HERO_WEAPON_MODEL_SCALE_MAX),
    weaponModelSourceScale: getStoredEquipmentSourceScale(item),
    weaponOffsetX: clamp(Number(item.weaponOffsetX) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
    weaponOffsetY: clamp(Number(item.weaponOffsetY) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
    weaponOffsetZ: clamp(Number(item.weaponOffsetZ) || 0, HERO_WEAPON_OFFSET_MIN, HERO_WEAPON_OFFSET_MAX),
    weaponRotationX: getModelRotationValue(item, 'weaponRotationX'),
    weaponRotationY: getModelRotationValue(item, 'weaponRotationY'),
    weaponRotationZ: getModelRotationValue(item, 'weaponRotationZ'),
    ...getEquipmentGripFields(item),
  };
};
const getHeroProfileInventory = (source = {}, fallback = {}) => {
  const sourceInventory = Array.isArray(source?.inventory) ? source.inventory : null;
  const fallbackInventory = Array.isArray(fallback?.inventory) ? fallback.inventory : [];
  return (sourceInventory || fallbackInventory).map(normalizeHeroInventoryItem);
};
const getCharacterModelEquipmentInventory = (model = {}, equipmentModels = []) => {
  const equipmentModelById = new Map(
    (Array.isArray(equipmentModels) ? equipmentModels : []).map((entry) => [entry.id, entry]),
  );
  return (Array.isArray(model?.inventory) ? model.inventory : [])
    .filter((item) => EQUIPMENT_MODEL_TYPES.has(item?.type))
    .map((item, index) => {
      const normalized = normalizeHeroInventoryItem({
        ...item,
        equipped: item.equipped !== false,
        quantity: 1,
      }, index);
      const equipmentModel = equipmentModelById.get(normalized.weaponModel3dId);
      if (!isEquipmentModelForType(equipmentModel, normalized.type)) return null;
      const equipmentSource = equipmentModel ? getStudioModelSource(equipmentModel) : '';
      if (!equipmentSource) return null;
      return {
        ...normalized,
        id: `${model.id || 'character'}-${normalized.type}-${normalized.weaponModel3dId || index}`,
        weaponModelUrl: equipmentSource,
        weaponModelName: equipmentModel?.modelName || equipmentModel?.name || normalized.weaponModelName,
        weaponModelFormat: equipmentModel?.modelFormat || normalized.weaponModelFormat,
        weaponModelFileSize: Number(equipmentModel?.modelFileSize || normalized.weaponModelFileSize) || 0,
        weaponModelResources: Array.isArray(equipmentModel?.modelResources)
          ? equipmentModel.modelResources
          : normalized.weaponModelResources,
        weaponModelScale: resolveLinkedEquipmentModelScale(normalized, equipmentModel),
        weaponModelSourceScale: equipmentModel
          ? getEquipmentModelReferenceScale(equipmentModel)
          : normalized.weaponModelSourceScale,
        ...(equipmentModel ? getEquipmentGripFields({
          ...equipmentModel,
          weaponGripHand: normalized.weaponGripHand || equipmentModel.weaponGripHand,
          shieldGripArm: normalized.shieldGripArm || equipmentModel.shieldGripArm,
        }) : getEquipmentGripFields(normalized)),
        sourceCharacterEquipment: true,
        sourceCharacterModel3dId: model.id || '',
      };
    })
    .filter((item) => item && item.equipped && item.weaponModel3dId && item.weaponModelUrl);
};
const applyCharacterEquipmentToActor = (actor, model = null, equipmentModels = []) => {
  if (!actor) return;
  const currentInventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  const baseInventory = currentInventory.filter((item) => !item?.sourceCharacterEquipment);
  const equipment = getCharacterModelEquipmentInventory(model || {}, equipmentModels);
  if (!equipment.length) {
    actor.inventory = baseInventory;
    return;
  }
  const equipmentTypes = new Set(equipment.map((item) => item.type));
  actor.inventory = [
    ...baseInventory.map((item) => (
      equipmentTypes.has(item?.type) ? { ...item, equipped: false } : item
    )),
    ...equipment,
  ];
};
const createDefaultHeroPlayerConfig = () => ({
  ...DEFAULT_ARCADE_CONFIG.player,
  skills: cloneHeroProfileItems(DEFAULT_ARCADE_CONFIG.player.skills),
  powers: cloneHeroProfileItems(DEFAULT_ARCADE_CONFIG.player.powers),
  inventory: cloneHeroProfileItems(DEFAULT_ARCADE_CONFIG.player.inventory),
});
const getHeroProfileNumber = (source = {}, fallback = {}, field, defaultValue = 0) => {
  const candidates = [
    source?.[field],
    fallback?.[field],
    DEFAULT_ARCADE_CONFIG.player?.[field],
    defaultValue,
  ];
  for (const value of candidates) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return Number(defaultValue) || 0;
};
const getHeroProfileSkill = (source = {}, fallback = {}, index = 0) => {
  const defaultSkill = DEFAULT_ARCADE_CONFIG.player.skills?.[index] || {
    id: `skill-${index + 1}`,
    name: 'Competence',
    value: 0,
    manaCost: 0,
  };
  const fallbackSkill = Array.isArray(fallback?.skills) ? fallback.skills[index] : null;
  const sourceSkill = Array.isArray(source?.skills) ? source.skills[index] : null;
  return {
    ...defaultSkill,
    ...(fallbackSkill || {}),
    ...(sourceSkill || {}),
  };
};
const ensureHeroProfileSkill = (target, fallback = {}, index = 0) => {
  const skills = Array.isArray(target.skills) ? target.skills.map((skill) => ({ ...(skill || {}) })) : [];
  while (skills.length <= index) skills.push({});
  skills[index] = {
    ...getHeroProfileSkill(target, fallback, index),
    ...(skills[index] || {}),
  };
  target.skills = skills;
  return target.skills[index];
};
const getHeroProfilePower = (source = {}, fallback = {}, index = 0) => {
  const defaultPower = DEFAULT_ARCADE_CONFIG.player.powers?.[index] || {
    id: `power-${index + 1}`,
    name: 'Pouvoir',
    type: 'fire',
    manaCost: 0,
    force: 0,
  };
  const fallbackPower = Array.isArray(fallback?.powers) ? fallback.powers[index] : null;
  const sourcePower = Array.isArray(source?.powers) ? source.powers[index] : null;
  return {
    ...defaultPower,
    ...(fallbackPower || {}),
    ...(sourcePower || {}),
  };
};
const ensureHeroProfilePower = (target, fallback = {}, index = 0) => {
  const powers = Array.isArray(target.powers) ? target.powers.map((power) => ({ ...(power || {}) })) : [];
  while (powers.length <= index) powers.push({});
  powers[index] = {
    ...getHeroProfilePower(target, fallback, index),
    ...(powers[index] || {}),
  };
  target.powers = powers;
  return target.powers[index];
};
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
const applyCharacterModelToActor = (actor, model = null, equipmentModels = []) => {
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
    actor.characterRigPoints = model ? normalizeCharacterRigPoints(model.characterRigPoints) : [];
    applyCharacterEquipmentToActor(actor, model, equipmentModels);
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
  actor.characterRigPoints = normalizeCharacterRigPoints(model.characterRigPoints);
  applyCharacterEquipmentToActor(actor, model, equipmentModels);
};
const applyWeaponModelToInventoryItem = (item, model = null) => {
  if (!item) return;
  if (!model || !getStudioModelSource(model)) {
    item.weaponModel3dId = '';
    item.weaponModelUrl = '';
    item.weaponModelName = '';
    item.weaponModelFormat = '';
    item.weaponModelFileSize = 0;
    item.weaponModelResources = [];
    item.weaponModelSourceScale = 0;
    return;
  }
  const sourceScale = getEquipmentModelReferenceScale(model);
  item.weaponModel3dId = model.id || '';
  item.weaponModelUrl = getStudioModelSource(model);
  item.weaponModelName = model.modelName || model.name || 'arme.glb';
  item.weaponModelFormat = model.modelFormat || '';
  item.weaponModelFileSize = Number(model.modelFileSize) || 0;
  item.weaponModelResources = Array.isArray(model.modelResources) ? model.modelResources : [];
  item.weaponModelScale = sourceScale;
  item.weaponModelSourceScale = sourceScale;
  Object.assign(item, getEquipmentGripFields({
    ...model,
    weaponGripHand: item.weaponGripHand || model.weaponGripHand,
    shieldGripArm: item.shieldGripArm || model.shieldGripArm,
  }));
};
const getRigObjectEquipmentType = (model = {}) => {
  const kind = getDecorImportKindId(model);
  if (kind === 'inventory-weapon') return 'weapon';
  if (kind === 'inventory-shield') return 'shield';
  if (kind === 'inventory-helmet') return 'helmet';
  if (kind === 'inventory-leggings') return 'leggings';
  return 'armor';
};
const getRigObjectInventoryKind = (type = 'armor') => {
  if (type === 'weapon') return 'inventory-weapon';
  if (type === 'shield') return 'inventory-shield';
  if (type === 'helmet') return 'inventory-helmet';
  if (type === 'leggings') return 'inventory-leggings';
  return 'inventory-armor';
};
const ensureRigObjectEquipmentDefaults = (model, type = 'armor') => {
  if (!model) return;
  model.kind = getRigObjectInventoryKind(type);
  if (type !== 'armor') return;
  const hasAnyArmorGrip = ARMOR_GRIP_POINTS.some((point) => Boolean(model[`armorGrip${point.suffix}Enabled`]));
  model.armorGripReferenceScale = model.armorGripReferenceScale || getArmorGripReferenceScale(model);
  if (hasAnyArmorGrip) return;
  ARMOR_GRIP_POINTS.filter((point) => point.core).forEach((point) => {
    model[`armorGrip${point.suffix}Enabled`] = true;
    model[`armorGrip${point.suffix}X`] = model[`armorGrip${point.suffix}X`] ?? point.defaultX;
    model[`armorGrip${point.suffix}Y`] = model[`armorGrip${point.suffix}Y`] ?? point.defaultY;
    model[`armorGrip${point.suffix}Z`] = model[`armorGrip${point.suffix}Z`] ?? point.defaultZ;
  });
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
  if (!file.type?.startsWith('image/')) return reject(new Error('Le fichier sélectionné doit être une image.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(reader.error || new Error("Impossible de charger l'image."));
  reader.readAsDataURL(file);
});

const createNpcChoice = (label = 'Réponse', response = '') => ({
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
      label: choice.label || `Réponse ${index + 1}`,
      response: choice.response || '',
    };
  });
};
const getNpcQuestionText = (zone = {}) => (
  zone.npcQuestion || zone.message || 'Que veux-tu demander ?'
);
const getActionZoneNpcLabel = (config = {}, targetNpcId = '') => {
  const hero = (config.heroes || []).find((item) => item.id === targetNpcId);
  if (hero) return hero.name || 'Héros';
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
  hero: `Héros ${index + 1}`,
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

const decorModelMatchesManagementGroup = (model = {}, groupId = '') => {
  const kind = getDecorImportKindId(model);
  if (groupId === 'inventory') return kind.startsWith('inventory-');
  return kind === groupId;
};

const findManagementNode = (nodes = [], filterId = '') => {
  for (const node of nodes) {
    if (node.id === filterId) return node;
    const childMatch = findManagementNode(node.children || [], filterId);
    if (childMatch) return childMatch;
  }
  return null;
};

const countExplorerAssets = (nodes = []) => nodes.reduce((count, node) => (
  count + (node.type === 'asset' ? 1 : node.count || 0)
), 0);

const getExplorerCountLabel = (count) => `${count} fichier${count > 1 ? 's' : ''}`;
const getImportGroup = (groups, groupId, fallbackLabel) => (
  flattenImportGroups(groups).find((group) => group.id === groupId) || { id: groupId, label: fallbackLabel }
);
const getCharacterImportRoleId = (model = {}) => (
  CHARACTER_IMPORT_GROUPS.some((group) => group.id === model.role) ? model.role : 'npc'
);
const getDecorImportKindId = (model = {}) => {
  const kind = getStudioDecorKindId(model.kind);
  if (DECOR_IMPORT_GROUP_IDS.has(kind) && kind !== 'decor' && kind !== 'inventory') return kind;
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
  if (/(bouclier|shield|buckler|targe)/.test(haystack)) return 'inventory-shield';
  if (/(arme|weapon|sword|epee|épée|blade|lame|hache|axe|mace|massue|dagger|dague|bow|arc|staff|baton|bâton)/.test(haystack)) return 'inventory-weapon';
  if (/(helmet|casque|helm)/.test(haystack)) return 'inventory-helmet';
  if (/(armure|armor|armour|cuirasse|plastron|chestplate|breastplate)/.test(haystack)) return 'inventory-armor';
  if (/(jambiere|jambière|jambieres|jambières|leggings|greaves|botte|boots|chausses)/.test(haystack)) return 'inventory-leggings';
  if (/(bijou|bijoux|jewel|jewelry|jewellery|ring|anneau|amulet|amulette|collier|necklace|bracelet|gem|gemme)/.test(haystack)) return 'inventory-jewelry';
  if (/(inventaire|inventory|loot|item|objet|potion|cle|clé|key|relique|relic|scroll|parchemin)/.test(haystack)) return 'inventory-misc';
  return DECOR_IMPORT_GROUP_IDS.has(kind) && kind !== 'inventory' ? kind : 'decor';
};
const getCharacterImportSubtitle = (model = {}) => (
  `${STUDIO_CHARACTER_ROLE_LABELS[model.role] || 'Héros'} - ${getStudioModelSource(model) ? (model.modelName || 'Modèle 3D') : 'Personnage volume'}`
);
const getDecorImportSubtitle = (model = {}) => {
  const renderMode = getDecorImportRenderMode(model);
  const kindLabel = STUDIO_DECOR_KIND_LABELS[getStudioDecorKindId(model.kind)] || renderMode;
  return getStudioModelSource(model)
    ? `${kindLabel} - ${model.modelName || 'Modèle 3D'}`
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

  const buildGroupFolder = (group) => {
    const childFolders = (group.children || [])
      .map(buildGroupFolder)
      .filter(Boolean);
    const assets = (groups.get(group.id) || []).sort(compareAssetExplorerNodes);
    if (!assets.length && !childFolders.length && !showEmptyGroups) return null;
    return makeAssetExplorerFolder({
      id: `${id}:${group.id}`,
      label: group.label,
      tone,
      children: [...childFolders, ...assets],
    });
  };

  const children = groupOptions.map(buildGroupFolder).filter(Boolean);

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

export {
  ARCADE_WORLD_SCALE,
  CHARACTER_PLACEMENT_CAMERA_DISTANCE,
  CAMERA_DISTANCE_MIN,
  CAMERA_DISTANCE_MAX,
  CAMERA_ZOOM_DRAG_SENSITIVITY,
  RPG3D_ACTION_LOADING_DURATION_MS,
  RPG3D_FIELD_HELP,
  ARCADE_CHARACTER_PRESETS,
  PLAYER_CHARACTER_IDS,
  ENEMY_CHARACTER_IDS,
  DEFAULT_ENEMY_CHARACTER_BY_ROLE,
  getCharacterPreset,
  getEnemyCharacterId,
  getCharacterOptions,
  PLAYER_CHARACTER_OPTIONS,
  ENEMY_CHARACTER_OPTIONS,
  CHARACTER_RENDER_OPTIONS,
  RELIEF_STYLE_OPTIONS,
  NUMERIC_ENTITY_FIELDS,
  TOOL_OPTIONS,
  TERRAIN_PAINT_SHAPE_OPTIONS,
  HERO_PROFILE_SECTION_TABS,
  HERO_INVENTORY_TYPE_OPTIONS,
  HERO_INVENTORY_TYPE_LABELS,
  STUDIO_CHARACTER_ROLE_LABELS,
  STUDIO_DECOR_KIND_LABELS,
  CHARACTER_IMPORT_GROUPS,
  DECOR_INVENTORY_IMPORT_GROUPS,
  DECOR_IMPORT_GROUPS,
  flattenImportGroups,
  DECOR_IMPORT_GROUP_LOOKUP,
  DECOR_IMPORT_GROUP_IDS,
  SELECTED_ENTITY_TYPE_LABELS,
  MULTI_SELECT_ENTITY_TYPES,
  ROTATABLE_ENTITY_TYPES,
  MAP_ENTITY_META,
  MAP_CHARACTER_MANAGEMENT_GROUPS,
  MAP_OBJECT_MANAGEMENT_GROUPS,
  MANAGEMENT_DEFAULT_OPEN_FOLDERS,
  isEditableShortcutTarget,
  isProtectedMapEntity,
  getDeletableSelectionEntities,
  isDuplicableSelectionEntity,
  createNewArcadeConfig,
  distance,
  vectorDistanceByFields,
  modelEraserHitDistance,
  normalizeModelEraserHit,
  createId,
  getModelRotationValue,
  getEntityRotation,
  isCountedMapProp,
  getCountedMapProps,
  getArcadeObjectCount,
  getArcadeImportPoint,
  getCharacterRenderMode,
  getCharacterRenderLabel,
  HERO_PROFILE_PLAYER_ID,
  cloneHeroProfileItems,
  HERO_WEAPON_MODEL_SCALE_MIN,
  HERO_WEAPON_MODEL_SCALE_MAX,
  HERO_WEAPON_OFFSET_MIN,
  HERO_WEAPON_OFFSET_MAX,
  getEquipmentHand,
  getEquipmentArm,
  EQUIPMENT_MODEL_TYPES,
  isEquipmentModelForType,
  ARMOR_SEGMENT_VALUES,
  ARMOR_RIG_POINT_IDS,
  getDefaultArmorPieceRigPointId,
  normalizeArmorPieceRigPointId,
  normalizeArmorPieceId,
  normalizeArmorPieceName,
  normalizeArmorSegmentAssignments,
  normalizeArmorCustomPieces,
  normalizeArmorCutContourPoint,
  normalizeArmorPaintSurfaceNormal,
  normalizeArmorCutContours,
  normalizeArmorCutPaintStrokes,
  ARMOR_GRIP_POINTS,
  getEquipmentGripReferenceScale,
  getShieldGripReferenceScale,
  getArmorGripReferenceScale,
  getEquipmentModelReferenceScale,
  getStoredEquipmentSourceScale,
  resolveLinkedEquipmentModelScale,
  getEquipmentModelRotationValue,
  getEquipmentGripFields,
  normalizeHeroInventoryItem,
  getHeroProfileInventory,
  getCharacterModelEquipmentInventory,
  applyCharacterEquipmentToActor,
  createDefaultHeroPlayerConfig,
  getHeroProfileNumber,
  getHeroProfileSkill,
  ensureHeroProfileSkill,
  getHeroProfilePower,
  ensureHeroProfilePower,
  getStudioMaterialBrightness,
  getHeroCharacterId,
  canEntityLevitate,
  getSelectedEntityTypeLabel,
  canMultiSelectEntity,
  getStudioCharacterRenderMode,
  getDecorImportRenderMode,
  getDecorModelWorldSize,
  getPlacementCameraDistance,
  applyCharacterModelScaleToActor,
  applyCharacterModelToActor,
  applyWeaponModelToInventoryItem,
  getRigObjectEquipmentType,
  getRigObjectInventoryKind,
  ensureRigObjectEquipmentDefaults,
  guessCharacterRenderMode,
  ensureEngineConfig,
  readArcadeImageFile,
  createNpcChoice,
  createDefaultNpcChoices,
  getNpcInteractionMode,
  getNpcChoiceItems,
  getNpcQuestionText,
  getActionZoneNpcLabel,
  guessPropRenderMode,
  shouldPropBlockByMode,
  getReliefStyle,
  getCommonSelectionNumericValue,
  getSelectionDuplicateOffset,
  getMapEntityEditableName,
  getMapEntityFallbackName,
  getMapEntitySubtitle,
  normalizeAssetExplorerText,
  getUniqueManagementEntities,
  decorModelMatchesManagementGroup,
  findManagementNode,
  countExplorerAssets,
  getExplorerCountLabel,
  getImportGroup,
  getCharacterImportRoleId,
  getDecorImportKindId,
  getCharacterImportSubtitle,
  getDecorImportSubtitle,
  compareAssetExplorerNodes,
  makeAssetExplorerAsset,
  makeAssetExplorerFolder,
  buildAssetExplorerRoot,
  filterAssetExplorerNode,
};
