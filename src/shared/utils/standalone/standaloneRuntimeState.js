export function buildStandaloneRuntimeState({
  serializedProject,
  serializedColorOptions,
  serializedPopupOverlayGradients,
  serializedCodeKeypadKeys,
  serializedGameActions,
  serializedGameActionCreators,
  serializedSceneAudioHelpers,
  standaloneSaveSystem,
}) {
  return `const project = ${serializedProject};
const root = document.getElementById('game-root');
const GAME_TITLE = String(project?.title || 'Escape game').trim() || 'Escape game';
const PLAYER_BUTTON_STYLE = ['modern', 'parchment', 'arcane', 'stone', 'neon', 'blood'].includes(project?.ui?.buttonStyle) ? project.ui.buttonStyle : 'modern';
const PLAYER_BUTTON_FONT = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.buttonFont) ? project.ui.buttonFont : 'system';
const PLAYER_NARRATION_FONT = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.narrationFont) ? project.ui.narrationFont : 'system';
const PLAYER_NARRATION_BACKGROUND = safeCssColor(project?.ui?.narrationBackground, 'rgba(2, 6, 23, .62)');
let hasRenderedOnce = false;
let sceneTransitionTimer = null;
let sceneTimerInterval = null;
let controlsTimer = null;
let anime2dTimer = null;
let anime2dStartedAt = 0;
let anime2dActiveCinematicId = '';
let sceneAnime2dStartedAt = 0;
let sceneAnime2dActiveSceneId = '';
let activeSceneTimerKey = '';
let expiredSceneTimerKey = '';
let loadedActId = '';
let actPreloadRunId = 0;

const PREVIEW_COLOR_OPTIONS = ${serializedColorOptions};
const POPUP_OVERLAY_GRADIENTS = ${serializedPopupOverlayGradients};
const CODE_KEYPAD_KEYS = ${serializedCodeKeypadKeys};
const IS_HERO_ADVENTURE = Boolean(project?.heroAdventure?.enabled || project?.creationMode === 'hero_adventure');
const IS_CHOICE_ADVENTURE = !IS_HERO_ADVENTURE && ['adventure', 'adventure_choices'].includes(project?.creationMode);
const IS_PRO_PROMOTION = project?.creationMode === 'pro_promo' || Boolean(project?.proPage);

function getStandaloneMobileClickMode(entry) {
  if (!entry) return 'object';
  if (entry.clickMode) return entry.clickMode;
  if (entry.isClickable === false) return 'none';
  return 'object';
}

function isDenseMobileScene(scene = null) {
  if (!scene) return false;
  const sceneObjects = Array.isArray(scene.sceneObjects) ? scene.sceneObjects : [];
  const hotspots = Array.isArray(scene.hotspots) ? scene.hotspots : [];
  const zones = Array.isArray(scene.visualEffectZones) ? scene.visualEffectZones : [];
  const mobileSceneDensity = sceneObjects.length + hotspots.length + zones.length;
  const mobileActionDensity = sceneObjects.filter((entry) => (
    getStandaloneMobileClickMode(entry) !== 'none'
    || ['external_link', 'project_link'].includes(entry.actionType)
  )).length + hotspots.filter((entry) => ['external_link', 'project_link'].includes(entry.actionType)).length;
  return Boolean(IS_PRO_PROMOTION || mobileSceneDensity >= 12 || mobileActionDensity >= 5);
}

function isMobileViewport(maxWidth = 900) {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') return window.matchMedia('(max-width: ' + maxWidth + 'px)').matches;
  return window.innerWidth <= maxWidth;
}

function shouldShowInventoryToggle() {
  return Boolean(IS_HERO_ADVENTURE || IS_CHOICE_ADVENTURE || state.inventory.length || !IS_PRO_PROMOTION);
}

function syncDenseMobileSceneState(scene = null) {
  if (!scene?.id || !isDenseMobileScene(scene) || !isMobileViewport()) return;
  if (state.denseMobileNarrationSceneId !== scene.id) {
    state.narrationCollapsed = true;
    state.denseMobileNarrationSceneId = scene.id;
  }
}

function getHeroChoices() {
  const heroes = Array.isArray(project?.heroAdventure?.heroes) && project.heroAdventure.heroes.length
    ? project.heroAdventure.heroes
    : [project?.heroAdventure?.hero || {}];
  return heroes.filter((hero) => hero && typeof hero === 'object');
}

function getInitialHeroState(sourceHero) {
  const hero = sourceHero && typeof sourceHero === 'object'
    ? sourceHero
    : project?.heroAdventure?.hero || getHeroChoices()[0] || {};
  const activeRules = hero.rules || project?.heroAdventure?.rules || {};
  const maxHealth = Math.max(1, Number(hero.maxHealth) || Number(hero.health) || 12);
  const maxMana = Math.max(0, Number(hero.maxMana) || Number(hero.mana) || 0);
  return {
    ...hero,
    id: hero.id || 'hero_1',
    name: hero.name ?? 'Héros',
    health: Math.max(0, Math.min(maxHealth, Number(hero.health) || maxHealth)),
    maxHealth,
    mana: Math.max(0, Math.min(maxMana, Number(hero.mana) || maxMana)),
    maxMana,
    initiative: Math.max(-999, Math.min(999, Number(hero.initiative) || 0)),
    armor: Math.max(0, Math.min(999, Number(hero.armor) || 0)),
    dodgeChance: Math.max(0, Math.min(100, Number(hero.dodgeChance) || 0)),
    skills: Array.isArray(hero.skills) ? hero.skills.map((skill, index) => ({
      ...skill,
      id: skill.id || 'skill_' + index,
      name: skill.name ?? ('Compétence ' + (index + 1)),
      value: Number.isFinite(Number(skill.baseValue)) ? Number(skill.baseValue) : Number(skill.value) || 0,
      baseValue: Number.isFinite(Number(skill.baseValue)) ? Number(skill.baseValue) : (Number(skill.value) || 0) - (Number(skill.rolledValue) || 0),
      rolledValue: 0,
      rollFormula: '',
    })) : [],
    powers: Array.isArray(hero.powers) ? hero.powers : [],
    resistanceWater: Math.max(0, Math.min(100, Number(hero.resistanceWater) || 0)),
    resistanceEarth: Math.max(0, Math.min(100, Number(hero.resistanceEarth) || 0)),
    resistanceFire: Math.max(0, Math.min(100, Number(hero.resistanceFire) || 0)),
    resistanceLightning: Math.max(0, Math.min(100, Number(hero.resistanceLightning) || 0)),
    rules: {
      criticalSuccess: Math.max(1, Math.min(Number(project?.heroAdventure?.dice?.sides) || 20, Number(activeRules.criticalSuccess) || Number(project?.heroAdventure?.dice?.sides) || 20)),
      criticalFailure: Math.max(1, Math.min(Number(project?.heroAdventure?.dice?.sides) || 20, Number(activeRules.criticalFailure) || 1)),
      criticalChance: Math.max(0, Math.min(100, Number(activeRules.criticalChance) || 0)),
      criticalMultiplier: Math.max(1, Math.min(20, Number(activeRules.criticalMultiplier) || 2)),
    },
  };
}

const DEFAULT_STATE = () => {
  const start = project.start || { type: 'scene', targetSceneId: project.scenes?.[0]?.id || '', targetCinematicId: '' };
  const initialScene = project.scenes.find((scene) => scene.id === start.targetSceneId) || project.scenes[0] || null;
  const initialCinematic = start.type === 'cinematic' && start.targetCinematicId ?
     (project.cinematics || []).find((entry) => entry.id === start.targetCinematicId) || null
    : null;
  const initialStoryVariables = Object.fromEntries((project.storyVariables || []).filter((variable) => variable.key).map((variable) => [variable.key, variable.defaultValue]));

  return {
    playSceneId: initialScene?.id || '',
    inventory: [],
    visitedSceneIds: initialScene?.id ? [initialScene.id] : [],
    storyVariables: initialStoryVariables,
    adventureJournalEntries: [],
    playerLives: 3,
    dialogue: initialScene?.introText || '',
    viewerImage: null,
    playingCinematicId: initialCinematic?.id || null,
    playingSlideIndex: 0,
    selectedInventoryIds: [],
    draggedInventoryId: null,
    inventoryDrawerOpen: false,
    objectiveDrawerOpen: false,
    narrationCollapsed: false,
    denseMobileNarrationSceneId: '',
    mobileActionsOpen: false,
    pauseOpen: false,
    showInteractionHints: true,
    controlsVisible: false,
    activeEnigma: null,
    activeConversation: null,
    activeEnding: null,
    choiceEffectNotices: [],
    enigmaCodeInput: '',
    enigmaColorAttempt: [],
    enigmaPuzzleOrder: [],
    enigmaPuzzleSelectedIndex: null,
    enigmaDragBank: [],
    enigmaDragSlots: [],
    enigmaDraggedPiece: null,
    enigmaRotationAngles: [],
    completedHotspotIds: [],
    solvedEnigmaIds: [],
    chosenConversationReplyIds: [],
    askedConversationNodeIds: [],
    hiddenConversationReplyIds: [],
    launchedCinematicIds: initialCinematic?.id ? [initialCinematic.id] : [],
    completedCombinationIds: [],
    usedLogicRuleIds: [],
    removedSceneObjectIds: [],
    revealedSceneObjectIds: [],
    sceneObjectTextOverrides: {},
    heroState: getInitialHeroState(),
    heroSetupComplete: !IS_HERO_ADVENTURE,
    heroSetupSelectionConfirmed: !IS_HERO_ADVENTURE,
    heroSetupGalleryIndex: 0,
    lastDiceRoll: null,
    equippedHeroItemIds: [],
    equippedHeroSlotMap: {},
    heroCombatStates: {},
    activeHeroCombat: null,
    selectedHeroCombatPowerId: '',
    sceneTransitionOverlay: null,
    actPreload: { active: false, progress: 100, label: '' },
    sceneTimerRemaining: 0,
    simonPlaybackIndex: -1,
    simonPlayerTurn: false,
  };
};


function updateSaveStatus(message = '') {
  const status = document.getElementById('save-status');
  if (status) status.textContent = message;
}

const state = DEFAULT_STATE();
const ENGINE_VERSION = "1.0.0";
const GAME_ACTIONS = ${serializedGameActions};
${serializedGameActionCreators}
${serializedSceneAudioHelpers}

function createStandaloneEngine({ version, actions, handlers }) {
  return {
    version,
    actions,
    dispatch(action = {}) {
      const handler = handlers[action.type];
      return handler ? handler(action) : false;
    },
  };
}

const STANDALONE_ACTION_HANDLERS = {
  [GAME_ACTIONS.COMBINE]: (action) => applyCombineAction(action.itemA, action.itemB),
  [GAME_ACTIONS.SOLVE_ENIGMA]: (action) => applySolveEnigmaAction(action),
  [GAME_ACTIONS.ENTER_SCENE]: (action) => applyEnterSceneAction(action.id, action.fallbackText),
  [GAME_ACTIONS.TRIGGER_HOTSPOT]: (action) => applyTriggerHotspotAction(action.id),
};

const standaloneEngine = createStandaloneEngine({
  version: ENGINE_VERSION,
  actions: GAME_ACTIONS,
  handlers: STANDALONE_ACTION_HANDLERS,
});

${standaloneSaveSystem}const sceneAudio = new Audio();
  sceneAudio.preload = 'auto';
let sceneAudioSource = '';
const ambientAudio = new Audio();
ambientAudio.preload = 'auto';
let ambientAudioSource = '';
const hotspotAudio = new Audio();
hotspotAudio.preload = 'auto';
const responseAmbienceAudio = new Audio();
responseAmbienceAudio.preload = 'auto';
let cinematicAudio = null;
let simonTimeouts = [];`;
}
