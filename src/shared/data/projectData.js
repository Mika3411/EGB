import { normalizeCinematicSteps } from '../services/cinematicEngine';
import { migrateProjectAssetReferences } from '../services/assetManager';
import { PRO_PROMOTION_PROJECT_MODE } from '../services/proPromotion';
import {
  SCENE_OBJECT_FONT_FAMILY_OPTIONS,
  clampSceneObjectBackgroundOpacity,
  hasSceneObjectBackgroundOpacityOverride,
  normalizeSceneObjectHexColor,
} from '../services/sceneObjectBlocks';
import { ensureSewerAct2 } from './projectDataSewerAct.js';
import {
  makeCharacter3DModel,
  makeDecor3DModel,
  normalizeCharacter3DModel,
  normalizeDecor3DModel,
} from './projectData3d.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const VISUAL_EFFECT_VALUES = ['sparkles', 'stars', 'snow', 'blizzard', 'fog', 'smoke', 'hearts', 'glow', 'fireflies', 'rain', 'storm', 'magic', 'embers', 'flames', 'bubbles', 'aurora', 'vignette', 'scanlines', 'glitch', 'confetti', 'beauty-lens', 'dream-lens', 'neon-lens', 'night-vision', 'thermal', 'comic-lens', 'noir-lens'];
const VISUAL_EFFECT_INTENSITY_VALUES = ['subtle', 'normal', 'strong'];
const SCENE_TRANSITION_VALUES = ['none', 'fade', 'blur', 'dissolve', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'zoom', 'zoom-spin', 'iris', 'flip', 'rotate', 'curtain', 'split-horizontal', 'split-vertical', 'cinematic-bars', 'glitch', 'pixel', 'burn', 'flash'];
const SCENE_TIMER_ACTION_VALUES = ['none', 'scene', 'restart-scene', 'restart-preview', 'damage-life', 'dialogue', 'cinematic'];
const ADVANCED_CONDITION_VALUES = ['has_item', 'visited_scene', 'completed_hotspot', 'solved_enigma', 'chose_reply', 'story_variable'];
const CONVERSATION_EFFECT_VALUES = ['message', 'add_item', 'remove_item', 'heal_health', 'heal_mana', 'set_variable', 'increment_variable', 'decrement_variable', 'journal', 'next_node', 'scene', 'cinematic', 'enigma', 'ending'];
const CONVERSATION_REPLY_ACTION_VALUES = ['node', 'dialogue', 'item', 'multiple', 'skill_check', 'hero_combat', 'scene', 'cinematic', 'enigma', 'ending', 'end'];
const CONVERSATION_CONDITION_VALUES = ['none', 'has_item', 'visited_scene', 'completed_hotspot', 'solved_enigma', 'chose_reply', 'story_variable', 'advanced'];
const HOTSPOT_ACTION_VALUES = ['none', 'dialogue', 'conversation', 'skill_check', 'hero_combat', 'dialogue_item', 'scene', 'cinematic', 'external_link', 'project_link'];
const PRO_PROMOTION_TEXT_ACTION_VALUES = ['none', 'dialogue', 'external_link', 'project_link'];
const LOGIC_RULE_CONDITION_VALUES = ['always', 'has_item', 'missing_item', 'visited_scene', 'completed_hotspot', 'solved_enigma', 'launched_cinematic', 'completed_combination', 'chose_reply', 'story_variable', 'advanced', 'second_click', 'hero_health_below', 'hero_mana_at_least', 'hero_last_roll_success', 'hero_skill_used'];
const LOGIC_RULE_ACTION_VALUES = ['default', 'dialogue', 'dialogue_item', 'scene', 'cinematic', 'block'];
const BLOCK_ACTION_VALUES = ['show', 'hide', 'update_text'];
const SCENE_OBJECT_FONT_FAMILY_VALUES = SCENE_OBJECT_FONT_FAMILY_OPTIONS.map((option) => option.value);
const CINEMATIC_END_VALUES = ['none', 'act', 'scene', 'item', 'project_link'];
const ENIGMA_UNLOCK_VALUES = ['none', 'scene', 'cinematic', 'project_link'];
const LEGACY_TECHNICAL_VALUE_MAP = {
  ['sc\u00e8ne']: 'scene',
  ['restart-sc\u00e8ne']: 'restart-scene',
  ['visited_sc\u00e8ne']: 'visited_scene',
  ['firefli\u00e9s']: 'fireflies',
};

const normalizeLegacyTechnicalValue = (value) => LEGACY_TECHNICAL_VALUE_MAP[value] || value;
const normalizeAllowedValue = (value, allowedValues, fallback) => {
  const normalizedValue = normalizeLegacyTechnicalValue(value);
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
};
const clampNumber = (value, fallback, min, max) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.min(max, numericValue));
};

const makeItem = (name = 'Nouvel objet', icon = '📦') => ({ id: uid(), name, icon, imageData: '', imageName: '' });
const makeCombination = () => ({
  id: uid(),
  itemAId: '',
  itemBId: '',
  resultItemId: '',
  message: 'Les objets se combinent.',
  consume: true,
  conditions: [],
  failMessage: '',
});
const makeStoryVariable = (overrides = {}) => ({
  id: uid(),
  key: 'nouvelle_variable',
  type: 'boolean',
  defaultValue: false,
  description: '',
  journalLabel: '',
  journalVisible: true,
  ...overrides,
});
const makeLogicRule = () => ({
  id: uid(),
  name: 'Nouvelle règle',
  conditionType: 'always',
  itemId: '',
  conditionSceneId: '',
  hotspotId: '',
  conditionEnigmaId: '',
  conditionReplyId: '',
  conditionVariableKey: '',
  conditionVariableOperator: 'equals',
  conditionVariableValue: '',
  advancedConditionMode: 'all',
  advancedConditions: [],
  cinematicId: '',
  combinationId: '',
  heroHealthThreshold: 5,
  heroManaThreshold: 1,
  heroSkillId: '',
  actionType: 'dialogue',
  dialogue: 'La zone réagit autrement.',
  failureDialogue: '',
  successSoundData: '',
  successSoundName: '',
  failureSoundData: '',
  failureSoundName: '',
  consumeRequiredItemOnUse: false,
  disableAfterUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  externalUrl: '',
  targetProjectId: '',
  targetProjectUserId: '',
  accessCodeEnabled: false,
  accessCode: '',
  enigmaId: '',
  blockActionType: 'show',
  targetBlockId: '',
  targetBlockText: '',
});
const makeHotspot = () => ({
  id: uid(),
  name: 'Nouvelle zone',
  x: 50,
  y: 50,
  width: 14,
  height: 12,
  actionType: 'dialogue',
  dialogue: 'Quelque chose attire ton attention.',
  requiredItemId: '',
  consumeRequiredItemOnUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  externalUrl: '',
  targetProjectId: '',
  targetProjectUserId: '',
  accessCodeEnabled: false,
  accessCode: '',
  enigmaId: '',
  requiredHotspotId: '',
  lockedMessage: '',
  objectImageData: '',
  objectImageName: '',
  hasSecondAction: false,
  secondActionType: 'dialogue',
  secondDialogue: 'Il n’y a plus rien ici.',
  secondRequiredItemId: '',
  secondConsumeRequiredItemOnUse: false,
  secondRewardItemId: '',
  secondTargetSceneId: '',
  secondTargetCinematicId: '',
  secondExternalUrl: '',
  secondTargetProjectId: '',
  secondTargetProjectUserId: '',
  secondEnigmaId: '',
  secondObjectImageData: '',
  secondObjectImageName: '',
  conversation: {
    startNodeId: 'start',
    nodes: [{
      id: 'start',
      speaker: 'PNJ',
      text: 'Bonjour. Que veux-tu savoir ?',
      replies: [
        { id: uid(), label: 'Qui es-tu ?', nextNodeId: 'identity', actionType: 'node', dialogue: '' },
        { id: uid(), label: 'Au revoir.', nextNodeId: '', actionType: 'end', dialogue: 'La conversation se termine.' },
      ],
    }, {
      id: 'identity',
      speaker: 'PNJ',
      text: 'Je garde cet endroit depuis longtemps.',
      replies: [
        { id: uid(), label: 'Retour', nextNodeId: 'start', actionType: 'node', dialogue: '' },
      ],
    }],
  },
  skillCheckSkillId: '',
  skillCheckDifficulty: 10,
  skillCheckManaCost: 0,
  skillCheckSuccessDialogue: 'Test réussi.',
  skillCheckSuccessNextNodeId: '',
  skillCheckSuccessTargetSceneId: '',
  skillCheckFailureDialogue: 'Test raté.',
  skillCheckFailureNextNodeId: '',
  skillCheckFailureTargetSceneId: '',
  skillCheckFailureHealthLoss: 0,
  skillCheckSuccessRewardItemId: '',
  combatEnemyName: 'Ennemi',
  combatEnemyMaxHealth: 8,
  combatHeroAttackType: 'physical',
  combatSkillId: '',
  combatAttackDifficulty: 10,
  combatDamage: 3,
  combatHeroDieDamagePercent: 100,
  combatEnemyInitiative: 0,
  combatEnemyStrength: 2,
  combatEnemyDamage: 2,
  combatEnemyDieDamagePercent: 100,
  combatEnemyCunning: 10,
  combatEnemyChaos: 10,
  combatEnemyArmor: 0,
  combatEnemyDodgeChance: 0,
  combatEnemyMaxMana: 0,
  combatEnemyPowerName: 'Pouvoir',
  combatEnemyPowerType: 'fire',
  combatEnemyPowerManaCost: 3,
  combatEnemyPowerDamage: 4,
  combatEnemyPowerUsageChance: 25,
  combatEnemyAiMode: 'tactical',
  combatEnemyCriticalChance: 5,
  combatEnemyCriticalMultiplier: 2,
  combatEnemyResistanceWater: 0,
  combatEnemyResistanceEarth: 0,
  combatEnemyResistanceFire: 0,
  combatEnemyResistanceLightning: 0,
  combatManaCost: 0,
  combatVictoryDialogue: 'Victoire.',
  combatDefeatDialogue: 'Défaite.',
  combatVictoryTargetSceneId: '',
  combatDefeatTargetSceneId: '',
  combatRewardItemId: '',
  combatTurnMode: true,
  combatShowDice: true,
  combatBackgroundImageData: '',
  combatBackgroundImageName: '',
  combatHeroMediaType: 'image',
  combatHeroImageData: '',
  combatHeroImageName: '',
  combatHeroAnime2dSpec: null,
  combatHeroAnime2dName: '',
  combatEnemyMediaType: 'image',
  combatEnemyImageData: '',
  combatEnemyImageName: '',
  combatEnemyAnime2dSpec: null,
  combatEnemyAnime2dName: '',
  logicRules: [],
});
const makeAct = (name = 'Acte I') => ({ id: uid(), name });
const makeEnigma = (overrides = {}) => ({
  id: uid(),
  name: 'Nouvelle énigme',
  type: 'code',
  question: 'Entre le bon code pour continuer.',
  solutionText: '1234',
  solutionColors: ['red', 'blue', 'green'],
  miscMode: 'free-answer',
  miscChoices: ['Réponse A', 'Réponse B', 'Réponse C'],
  miscCorrectChoices: [],
  miscPairs: [
    { left: 'Symbole', right: 'Signification' },
    { left: 'Clé', right: 'Serrure' },
  ],
  miscMin: '',
  miscMax: '',
  miscTargetItemId: '',
    successMessage: 'Bonne réponse. Quelque chose se débloque.',
  failMessage: 'Ce n’est pas la bonne réponse.',
  unlockType: 'none',
  targetSceneId: '',
  targetCinematicId: '',
  targetProjectId: '',
  targetProjectUserId: '',
  imageData: '',
  imageName: '',
  popupBackgroundData: '',
  popupBackgroundName: '',
  popupBackgroundZoom: 1,
  popupBackgroundX: 50,
  popupBackgroundY: 50,
  popupBackgroundOverlay: 'dark',
  gridRows: 3,
  gridCols: 3,
  ...overrides,
});
const makeScene = (overrides = {}) => ({
  id: uid(),
  name: 'Nouvelle scène',
  actId: '',
  parentSceneId: '',
  backgroundId: '',
  backgroundData: '',
  backgroundName: '',
  backgroundWidth: 0,
  backgroundHeight: 0,
  visualEffect: 'none',
  visualEffectIntensity: 'normal',
  sceneTransition: 'none',
  sceneTransitionDuration: 700,
  timerEnabled: false,
  timerSeconds: 60,
  timerEndAction: 'none',
  timerTargetSceneId: '',
  timerTargetCinematicId: '',
  timerLifeLoss: 1,
  timerEndMessage: 'Le temps est écoulé.',
  visualEffectZones: [],
  musicId: '',
  musicData: '',
  musicName: '',
  musicLoop: true,
  ambientSoundId: '',
  ambientSoundData: '',
  ambientSoundName: '',
  ambientSoundLoop: false,
  introText: 'Décris l’ambiance de cette scène.',
  hotspots: [makeHotspot()],
  sceneObjects: [],
  ...overrides,
});
const makeCinematicSlide = () => ({
  id: uid(),
  imageData: '',
  imageName: '',
  narration: 'Une nouvelle image apparaît…',
  audioData: '',
  audioName: '',
});
const makeCinematic = () => ({
  id: uid(),
  name: 'Nouvelle cinématique',
  cinematicType: 'slides',
  slides: [makeCinematicSlide()],
  steps: [
    { id: uid(), type: 'text', content: 'Une nouvelle image apparaît...' },
    { id: uid(), type: 'wait', duration: 4500 },
  ],
  videoData: '',
  videoName: '',
  videoAutoplay: true,
  videoControls: true,
  onEndType: 'none',
  targetActId: '',
  targetSceneId: '',
  targetProjectId: '',
  targetProjectUserId: '',
  rewardItemId: '',
});

const makeRouteMap = () => ({
  rows: 16,
  cols: 24,
  cells: [],
  rooms: [],
  connections: [],
  canvases: [{ id: 'route_canvas_1', name: 'Canvas 1' }],
  actMaps: {},
  notes: '',
});

const normalizeRouteMapCell = (cell, rows, cols) => {
  const type = ['path', 'wall', 'start', 'end', 'checkpoint'].includes(cell?.type) ? cell.type : 'path';
  return {
    id: cell?.id || uid(),
    x: Number.isFinite(Number(cell?.x)) ? Math.max(0, Math.min(cols - 1, Number(cell.x))) : 0,
    y: Number.isFinite(Number(cell?.y)) ? Math.max(0, Math.min(rows - 1, Number(cell.y))) : 0,
    type,
    label: cell?.label || '',
    sceneId: cell?.sceneId || '',
  };
};

const normalizeRouteMapShape = (rawRouteMap = makeRouteMap()) => {
  const routeRows = Number.isFinite(Number(rawRouteMap.rows)) ? Math.max(8, Math.min(32, Number(rawRouteMap.rows))) : 16;
  const routeCols = Number.isFinite(Number(rawRouteMap.cols)) ? Math.max(8, Math.min(40, Number(rawRouteMap.cols))) : 24;
  const seenRouteCells = new Set();
  return {
    rows: routeRows,
    cols: routeCols,
    notes: rawRouteMap.notes || '',
    cells: (Array.isArray(rawRouteMap.cells) ? rawRouteMap.cells : [])
      .map((cell) => normalizeRouteMapCell(cell, routeRows, routeCols))
      .filter((cell) => {
        const key = `${cell.x}:${cell.y}`;
        if (seenRouteCells.has(key)) return false;
        seenRouteCells.add(key);
        return true;
      }),
    rooms: (Array.isArray(rawRouteMap.rooms) ? rawRouteMap.rooms : []).map((room, index) => ({
      id: room?.id || uid(),
      name: room?.name || `Pièce ${index + 1}`,
      sceneId: room?.sceneId || '',
      canvasId: room?.canvasId || `route_canvas_${Math.floor(index / 15) + 1}`,
      x: Number.isFinite(Number(room?.x)) ? Math.max(4, Math.min(96, Number(room.x))) : Math.min(84, 16 + index * 10),
      y: Number.isFinite(Number(room?.y)) ? Math.max(6, Math.min(94, Number(room.y))) : Math.min(82, 18 + index * 8),
      type: ['start', 'end', 'room'].includes(room?.type) ? room.type : 'room',
    })),
    connections: (Array.isArray(rawRouteMap.connections) ? rawRouteMap.connections : []).map((connection) => ({
      id: connection?.id || uid(),
      fromRoomId: connection?.fromRoomId || '',
      toRoomId: connection?.toRoomId || '',
      label: connection?.label || '',
      condition: connection?.condition || '',
      locked: Boolean(connection?.locked),
      allowOneWay: Boolean(connection?.allowOneWay),
    })),
    canvases: Array.isArray(rawRouteMap.canvases) && rawRouteMap.canvases.length
      ? rawRouteMap.canvases.map((canvas, index) => ({
        id: canvas?.id || `route_canvas_${index + 1}`,
        name: canvas?.name || `Canvas ${index + 1}`,
      }))
      : [{ id: 'route_canvas_1', name: 'Canvas 1' }],
  };
};

const PRO_PROMOTION_SCENE_REF_KEYS = new Set([
  'targetActId',
  'targetSceneId',
  'secondTargetSceneId',
  'timerTargetSceneId',
  'skillCheckSuccessTargetSceneId',
  'skillCheckFailureTargetSceneId',
  'combatVictoryTargetSceneId',
  'combatDefeatTargetSceneId',
  'conditionSceneId',
  'sceneId',
]);

const PRO_PROMOTION_ENIGMA_REF_KEYS = new Set([
  'enigmaId',
  'secondEnigmaId',
  'conditionEnigmaId',
]);

const PRO_PROMOTION_INVENTORY_REF_KEYS = new Set([
  'linkedItemId',
  'requiredItemId',
  'rewardItemId',
  'skillCheckSuccessRewardItemId',
  'combatRewardItemId',
]);

const PRO_PROMOTION_TECHNICAL_VALUE_FALLBACKS = {
  actionType: { fallback: 'dialogue', values: new Set(['scene', 'act', 'enigma', 'dialogue_item']) },
  secondActionType: { fallback: 'dialogue', values: new Set(['scene', 'act', 'enigma', 'dialogue_item']) },
  onEndType: { fallback: 'none', values: new Set(['scene', 'act']) },
  type: { fallback: 'message', values: new Set(['scene', 'act', 'enigma']) },
  unlockType: { fallback: 'none', values: new Set(['scene', 'act']) },
  timerEndAction: { fallback: 'none', values: new Set(['scene', 'act']) },
  conditionType: { fallback: 'none', values: new Set(['visited_scene', 'solved_enigma']) },
};

const clearProPromotionSceneLinks = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => clearProPromotionSceneLinks(entry, seen));
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    if (PRO_PROMOTION_SCENE_REF_KEYS.has(key)) {
      value[key] = '';
      return;
    }

    if (PRO_PROMOTION_ENIGMA_REF_KEYS.has(key)) {
      value[key] = '';
      return;
    }

    if (PRO_PROMOTION_INVENTORY_REF_KEYS.has(key)) {
      value[key] = '';
      return;
    }

    const technicalFallback = PRO_PROMOTION_TECHNICAL_VALUE_FALLBACKS[key];
    if (technicalFallback?.values?.has(entry)) {
      value[key] = technicalFallback.fallback;
      return;
    }

    clearProPromotionSceneLinks(entry, seen);
  });
};

const normalizeProPromotionProjectPage = (draft) => {
  if (draft.creationMode !== PRO_PROMOTION_PROJECT_MODE) return;

  const technicalAct = draft.acts?.[0] || makeAct('Extension');
  draft.acts = [technicalAct];

  const pageScene = draft.scenes?.[0] || makeScene({
    actId: technicalAct.id,
    name: 'Page d’extension',
    parentSceneId: '',
  });
  pageScene.actId = technicalAct.id || '';
  pageScene.parentSceneId = '';
  clearProPromotionSceneLinks(pageScene);
  pageScene.sceneObjects = (Array.isArray(pageScene.sceneObjects) ? pageScene.sceneObjects : [])
    .filter((object) => object?.blockType === 'text')
    .map((object) => {
      const actionType = PRO_PROMOTION_TEXT_ACTION_VALUES.includes(object.actionType)
        ? object.actionType
        : 'dialogue';
      const hasTextAction = actionType !== 'none' && (
        object.clickMode === 'action'
        || ['external_link', 'project_link'].includes(actionType)
      );

      return {
        ...object,
        blockType: 'text',
        isInvisible: false,
        clickMode: hasTextAction ? 'action' : 'none',
        actionType,
        interactionMode: 'popup',
        linkedItemId: '',
        targetSceneId: '',
        targetCinematicId: '',
        externalUrl: object.externalUrl || '',
        targetProjectId: object.targetProjectId || '',
        targetProjectUserId: object.targetProjectUserId || '',
        rewardItemId: '',
        requiredItemId: '',
        enigmaId: '',
        logicRules: [],
        anime2dSpec: null,
        anime2dName: '',
        fontFamily: SCENE_OBJECT_FONT_FAMILY_VALUES.includes(object.fontFamily) ? object.fontFamily : 'system',
      };
    });

  draft.scenes = [pageScene];
  clearProPromotionSceneLinks(draft.cinematics);
  clearProPromotionSceneLinks(draft.enigmas);
  draft.routeMap = makeRouteMap();
  draft.start = {
    type: 'scene',
    targetSceneId: pageScene.id,
    targetCinematicId: '',
  };
};

const makeImportedHotspot = ({
  id,
  name,
  x,
  y,
  width,
  height,
  actionType = 'dialogue',
  dialogue = '',
  targetSceneId = '',
  targetCinematicId = '',
  externalUrl = '',
  targetProjectId = '',
  targetProjectUserId = '',
  accessCodeEnabled = false,
  accessCode = '',
  enigmaId = '',
  requiredItemId = '',
  rewardItemId = '',
  lockedMessage = '',
}) => ({
  ...makeHotspot(),
  id,
  name,
  x,
  y,
  width,
  height,
  actionType,
  dialogue,
  targetSceneId,
  targetCinematicId,
  externalUrl,
  targetProjectId,
  targetProjectUserId,
  accessCodeEnabled: Boolean(accessCodeEnabled),
  accessCode,
  enigmaId,
  requiredItemId,
  rewardItemId,
  lockedMessage,
});

const normalizeAdvancedCondition = (condition = {}) => ({
  id: condition.id || uid(),
  type: normalizeAllowedValue(condition.type, ADVANCED_CONDITION_VALUES, 'has_item'),
  itemId: condition.itemId || '',
  sceneId: condition.sceneId || '',
  hotspotId: condition.hotspotId || '',
  enigmaId: condition.enigmaId || '',
  replyId: condition.replyId || '',
  variableKey: condition.variableKey || '',
  operator: ['equals', 'not_equals', 'greater_or_equal', 'less_or_equal', 'truthy', 'falsy'].includes(condition.operator) ? condition.operator : 'equals',
  value: condition.value ?? '',
});

const normalizeBranchTags = (tags = []) => (
  Array.isArray(tags)
    ? tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : String(tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)
);

const normalizeConversationEffect = (effect = {}) => ({
  id: effect.id || uid(),
  type: normalizeAllowedValue(effect.type, CONVERSATION_EFFECT_VALUES, 'message'),
  message: effect.message || '',
  itemId: effect.itemId || '',
  variableKey: effect.variableKey || '',
  value: effect.value ?? '',
  journalTitle: effect.journalTitle || '',
  journalDetail: effect.journalDetail || '',
  nextNodeId: effect.nextNodeId || '',
  targetSceneId: effect.targetSceneId || '',
  targetCinematicId: effect.targetCinematicId || '',
  enigmaId: effect.enigmaId || '',
  endingType: ['good', 'bad', 'secret', 'neutral'].includes(effect.endingType) ? effect.endingType : 'neutral',
  endingTitle: effect.endingTitle || '',
  endingSummary: effect.endingSummary || '',
});

const normalizeConversationReply = (reply = {}) => ({
  id: reply.id || uid(),
  label: reply.label || 'Réponse',
  hideAfterChosen: Boolean(reply.hideAfterChosen),
  hideReplyIdsAfterChosen: Array.isArray(reply.hideReplyIdsAfterChosen)
    ? reply.hideReplyIdsAfterChosen.filter(Boolean)
    : [],
  branchTags: normalizeBranchTags(reply.branchTags),
  authorNote: reply.authorNote || '',
  nextNodeId: reply.nextNodeId || '',
  actionType: normalizeAllowedValue(reply.actionType, CONVERSATION_REPLY_ACTION_VALUES, 'node'),
  dialogue: reply.dialogue || '',
  responseImageData: reply.responseImageData || '',
  responseImageName: reply.responseImageName || '',
  responseSoundData: reply.responseSoundData || '',
  responseSoundName: reply.responseSoundName || '',
  npcPortraitData: reply.npcPortraitData || '',
  npcPortraitName: reply.npcPortraitName || '',
  ambienceSoundData: reply.ambienceSoundData || '',
  ambienceSoundName: reply.ambienceSoundName || '',
  showWhenLocked: Boolean(reply.showWhenLocked),
  lockedLabel: reply.lockedLabel || '',
  rewardItemId: reply.rewardItemId || '',
  targetSceneId: reply.targetSceneId || '',
  targetCinematicId: reply.targetCinematicId || '',
  enigmaId: reply.enigmaId || '',
  endingType: ['good', 'bad', 'secret', 'neutral'].includes(reply.endingType) ? reply.endingType : 'neutral',
  endingTitle: reply.endingTitle || '',
  endingSummary: reply.endingSummary || '',
  conditionType: normalizeAllowedValue(reply.conditionType, CONVERSATION_CONDITION_VALUES, 'none'),
  conditionItemId: reply.conditionItemId || '',
  conditionSceneId: reply.conditionSceneId || '',
  conditionHotspotId: reply.conditionHotspotId || '',
  conditionEnigmaId: reply.conditionEnigmaId || '',
  conditionReplyId: reply.conditionReplyId || '',
  conditionVariableKey: reply.conditionVariableKey || '',
  conditionVariableOperator: ['equals', 'not_equals', 'greater_or_equal', 'less_or_equal', 'truthy', 'falsy'].includes(reply.conditionVariableOperator) ? reply.conditionVariableOperator : 'equals',
  conditionVariableValue: reply.conditionVariableValue ?? '',
  advancedConditionMode: ['all', 'any'].includes(reply.advancedConditionMode) ? reply.advancedConditionMode : 'all',
  advancedConditions: Array.isArray(reply.advancedConditions) ? reply.advancedConditions.map(normalizeAdvancedCondition) : [],
  storyVariableKey: reply.storyVariableKey || '',
  storyVariableOperation: ['none', 'set', 'increment', 'decrement'].includes(reply.storyVariableOperation) ? reply.storyVariableOperation : 'none',
  storyVariableValue: reply.storyVariableValue ?? '',
  effects: Array.isArray(reply.effects) ? reply.effects.map(normalizeConversationEffect) : [],
  skillCheckSkillId: reply.skillCheckSkillId || '',
  skillCheckDifficulty: Number.isFinite(Number(reply.skillCheckDifficulty)) ? Number(reply.skillCheckDifficulty) : 10,
  skillCheckManaCost: Number.isFinite(Number(reply.skillCheckManaCost)) ? Number(reply.skillCheckManaCost) : 0,
  skillCheckSuccessDialogue: reply.skillCheckSuccessDialogue || '',
  skillCheckSuccessNextNodeId: reply.skillCheckSuccessNextNodeId || '',
  skillCheckSuccessTargetSceneId: reply.skillCheckSuccessTargetSceneId || '',
  skillCheckFailureDialogue: reply.skillCheckFailureDialogue || '',
  skillCheckFailureNextNodeId: reply.skillCheckFailureNextNodeId || '',
  skillCheckFailureTargetSceneId: reply.skillCheckFailureTargetSceneId || '',
  skillCheckFailureHealthLoss: Number.isFinite(Number(reply.skillCheckFailureHealthLoss)) ? Number(reply.skillCheckFailureHealthLoss) : 0,
  skillCheckSuccessRewardItemId: reply.skillCheckSuccessRewardItemId || '',
  combatEnemyName: reply.combatEnemyName || '',
  combatEnemyMaxHealth: Number.isFinite(Number(reply.combatEnemyMaxHealth)) ? Number(reply.combatEnemyMaxHealth) : 8,
  combatHeroAttackType: ['physical', 'water', 'earth', 'fire', 'lightning'].includes(reply.combatHeroAttackType) ? reply.combatHeroAttackType : 'physical',
  combatSkillId: reply.combatSkillId || '',
  combatAttackDifficulty: Number.isFinite(Number(reply.combatAttackDifficulty)) ? Number(reply.combatAttackDifficulty) : 10,
  combatDamage: Number.isFinite(Number(reply.combatDamage)) ? Number(reply.combatDamage) : 3,
  combatHeroDieDamagePercent: Number.isFinite(Number(reply.combatHeroDieDamagePercent)) ? Math.round(Number(reply.combatHeroDieDamagePercent)) : 100,
  combatEnemyInitiative: Number.isFinite(Number(reply.combatEnemyInitiative)) ? Number(reply.combatEnemyInitiative) : 0,
  combatEnemyStrength: Number.isFinite(Number(reply.combatEnemyStrength)) ? Number(reply.combatEnemyStrength) : (Number.isFinite(Number(reply.combatEnemyDamage)) ? Number(reply.combatEnemyDamage) : 2),
  combatEnemyDamage: Number.isFinite(Number(reply.combatEnemyDamage)) ? Number(reply.combatEnemyDamage) : 2,
  combatEnemyDieDamagePercent: Number.isFinite(Number(reply.combatEnemyDieDamagePercent)) ? Math.round(Number(reply.combatEnemyDieDamagePercent)) : 100,
  combatEnemyCunning: Number.isFinite(Number(reply.combatEnemyCunning)) ? Number(reply.combatEnemyCunning) : 10,
  combatEnemyChaos: Number.isFinite(Number(reply.combatEnemyChaos)) ? Number(reply.combatEnemyChaos) : 10,
  combatEnemyArmor: Number.isFinite(Number(reply.combatEnemyArmor)) ? Number(reply.combatEnemyArmor) : 0,
  combatEnemyDodgeChance: Number.isFinite(Number(reply.combatEnemyDodgeChance)) ? Number(reply.combatEnemyDodgeChance) : 0,
  combatEnemyMaxMana: Number.isFinite(Number(reply.combatEnemyMaxMana)) ? Number(reply.combatEnemyMaxMana) : 0,
  combatEnemyPowerName: reply.combatEnemyPowerName || 'Pouvoir',
  combatEnemyPowerType: ['water', 'earth', 'fire', 'lightning'].includes(reply.combatEnemyPowerType) ? reply.combatEnemyPowerType : 'fire',
  combatEnemyPowerManaCost: Number.isFinite(Number(reply.combatEnemyPowerManaCost)) ? Number(reply.combatEnemyPowerManaCost) : 3,
  combatEnemyPowerDamage: Number.isFinite(Number(reply.combatEnemyPowerDamage)) ? Number(reply.combatEnemyPowerDamage) : 4,
  combatEnemyPowerUsageChance: Number.isFinite(Number(reply.combatEnemyPowerUsageChance)) ? Number(reply.combatEnemyPowerUsageChance) : 25,
  combatEnemyAiMode: reply.combatEnemyAiMode === 'random' ? 'random' : 'tactical',
  combatEnemyCriticalChance: Number.isFinite(Number(reply.combatEnemyCriticalChance)) ? Number(reply.combatEnemyCriticalChance) : 5,
  combatEnemyCriticalMultiplier: Number.isFinite(Number(reply.combatEnemyCriticalMultiplier)) ? Number(reply.combatEnemyCriticalMultiplier) : 2,
  combatEnemyResistanceWater: Number.isFinite(Number(reply.combatEnemyResistanceWater)) ? Number(reply.combatEnemyResistanceWater) : 0,
  combatEnemyResistanceEarth: Number.isFinite(Number(reply.combatEnemyResistanceEarth)) ? Number(reply.combatEnemyResistanceEarth) : 0,
  combatEnemyResistanceFire: Number.isFinite(Number(reply.combatEnemyResistanceFire)) ? Number(reply.combatEnemyResistanceFire) : 0,
  combatEnemyResistanceLightning: Number.isFinite(Number(reply.combatEnemyResistanceLightning)) ? Number(reply.combatEnemyResistanceLightning) : 0,
  combatManaCost: Number.isFinite(Number(reply.combatManaCost)) ? Number(reply.combatManaCost) : 0,
  combatVictoryDialogue: reply.combatVictoryDialogue || '',
  combatDefeatDialogue: reply.combatDefeatDialogue || '',
  combatVictoryTargetSceneId: reply.combatVictoryTargetSceneId || '',
  combatDefeatTargetSceneId: reply.combatDefeatTargetSceneId || '',
  combatRewardItemId: reply.combatRewardItemId || '',
  combatTurnMode: reply.combatTurnMode !== false,
  combatShowDice: reply.combatShowDice !== false,
  ...(reply.combatEnemyAutoTurn === false ? { combatEnemyAutoTurn: false } : {}),
  combatBackgroundImageData: reply.combatBackgroundImageData || '',
  combatBackgroundImageName: reply.combatBackgroundImageName || '',
  combatHeroMediaType: ['image', 'anime2d'].includes(reply.combatHeroMediaType) ? reply.combatHeroMediaType : 'image',
  combatHeroImageData: reply.combatHeroImageData || '',
  combatHeroImageName: reply.combatHeroImageName || '',
  combatHeroAnime2dSpec: reply.combatHeroAnime2dSpec && typeof reply.combatHeroAnime2dSpec === 'object' ? reply.combatHeroAnime2dSpec : null,
  combatHeroAnime2dName: reply.combatHeroAnime2dName || '',
  combatEnemyMediaType: ['image', 'anime2d'].includes(reply.combatEnemyMediaType) ? reply.combatEnemyMediaType : 'image',
  combatEnemyImageData: reply.combatEnemyImageData || '',
  combatEnemyImageName: reply.combatEnemyImageName || '',
  combatEnemyAnime2dSpec: reply.combatEnemyAnime2dSpec && typeof reply.combatEnemyAnime2dSpec === 'object' ? reply.combatEnemyAnime2dSpec : null,
  combatEnemyAnime2dName: reply.combatEnemyAnime2dName || '',
});

const normalizeConversation = (conversation = {}) => {
  const rawNodes = Array.isArray(conversation.nodes) && conversation.nodes.length
    ? conversation.nodes
    : [{
      id: 'start',
      speaker: 'PNJ',
      text: 'Bonjour. Que veux-tu savoir ?',
      replies: [{ label: 'Au revoir.', actionType: 'end', dialogue: 'La conversation se termine.' }],
    }];
const nodes = rawNodes.map((node, index) => ({
  id: node.id || (index === 0 ? 'start' : uid()),
  speaker: node.speaker || '',
  text: node.text || '',
  askOnce: Boolean(node.askOnce),
  authorNote: node.authorNote || '',
  replies: (Array.isArray(node.replies) ? node.replies : []).map(normalizeConversationReply),
}));
  return {
    startNodeId: conversation.startNodeId || nodes[0]?.id || 'start',
    nodes,
  };
};

const normalizeLogicRule = (rule = {}) => ({
  ...makeLogicRule(),
  ...rule,
  conditionType: normalizeAllowedValue(rule.conditionType, LOGIC_RULE_CONDITION_VALUES, 'always'),
  actionType: normalizeAllowedValue(rule.actionType, LOGIC_RULE_ACTION_VALUES, 'dialogue'),
  blockActionType: normalizeAllowedValue(rule.blockActionType, BLOCK_ACTION_VALUES, 'show'),
});

const normalizeHotspot = (spot = {}) => {
  const normalized = {
    ...makeHotspot(),
    ...spot,
    actionType: normalizeAllowedValue(spot.actionType, HOTSPOT_ACTION_VALUES, 'dialogue'),
    secondActionType: normalizeAllowedValue(spot.secondActionType, HOTSPOT_ACTION_VALUES, 'dialogue'),
    accessCodeEnabled: spot.accessCodeEnabled === true,
    accessCode: spot.accessCode || '',
    conversation: normalizeConversation(spot.conversation),
    logicRules: Array.isArray(spot.logicRules) ? spot.logicRules.map(normalizeLogicRule) : [],
  };
  if (!Number.isFinite(Number(spot.combatEnemyStrength)) && Number.isFinite(Number(spot.combatEnemyDamage))) {
    normalized.combatEnemyStrength = Number(spot.combatEnemyDamage);
  }
  return normalized;
};

const makeImportedScene = ({ id, name, actId, introText, hotspots, visualEffect = 'none' }) => ({
  ...makeScene({ actId, hotspots }),
  id,
  name,
  actId,
  introText,
  visualEffect,
  sceneTransition: 'fade',
  sceneTransitionDuration: 900,
  ambientSoundLoop: true,
  musicLoop: true,
  sceneObjects: [],
  backgroundAspectRatio: 1.5,
});

const normalizeProject = (rawProject) => {
  const draft = structuredClone(rawProject || {});
  if (!Array.isArray(draft.items)) draft.items = [];
  if (!Array.isArray(draft.combinations)) draft.combinations = [];
  if (!Array.isArray(draft.storyVariables)) draft.storyVariables = [];
  const seenStoryVariableKeys = new Set();
  draft.storyVariables = draft.storyVariables
    .map((variable) => {
      const type = ['number', 'boolean', 'text'].includes(variable?.type) ? variable.type : 'boolean';
      const rawDefaultValue = variable?.defaultValue ?? '';
      const defaultValue = type === 'number'
        ? (Number.isFinite(Number(rawDefaultValue)) ? Number(rawDefaultValue) : 0)
        : type === 'boolean'
          ? (rawDefaultValue === true || rawDefaultValue === 'true')
          : String(rawDefaultValue ?? '');
      return {
        id: variable?.id || uid(),
        key: String(variable?.key || '').trim(),
        type,
        defaultValue,
        description: variable?.description || '',
        journalLabel: variable?.journalLabel || '',
        journalVisible: variable?.journalVisible !== false,
      };
    })
    .filter((variable) => {
      if (!variable.key) return true;
      if (seenStoryVariableKeys.has(variable.key)) return false;
      seenStoryVariableKeys.add(variable.key);
      return true;
    });
  draft.combinations = draft.combinations.map((combo) => ({
    ...combo,
    consume: combo.consume ?? true,
    conditions: Array.isArray(combo.conditions) ? combo.conditions : [],
    failMessage: combo.failMessage || '',
  }));
  if (!Array.isArray(draft.scenes)) draft.scenes = [];
  if (!Array.isArray(draft.cinematics)) draft.cinematics = [];
  if (!Array.isArray(draft.enigmas)) draft.enigmas = [];
  if (!Array.isArray(draft.assets)) draft.assets = [];
  draft.characterModels3d = Array.isArray(draft.characterModels3d)
    ? draft.characterModels3d.map(normalizeCharacter3DModel)
    : [];
  draft.decorModels3d = Array.isArray(draft.decorModels3d)
    ? draft.decorModels3d.map(normalizeDecor3DModel)
    : [];
  if (!Array.isArray(draft.acts) || !draft.acts.length) {
    draft.acts = [makeAct('Acte I')];
  }
  const fallbackActId = draft.acts[0]?.id || '';
  if (!draft.start || typeof draft.start !== 'object') draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
  const startType = normalizeLegacyTechnicalValue(draft.start.type);
  draft.start = {
    type: startType === 'cinematic' ? 'cinematic' : 'scene',
    targetSceneId: draft.start.targetSceneId || '',
    targetCinematicId: draft.start.targetCinematicId || '',
  };
  draft.creationMode = [PRO_PROMOTION_PROJECT_MODE, 'beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'].includes(draft.creationMode) ? draft.creationMode : 'beginner';
  draft.anime2dDraft = draft.anime2dDraft && typeof draft.anime2dDraft === 'object' ? draft.anime2dDraft : null;
  const rawRouteMap = draft.routeMap && typeof draft.routeMap === 'object' ? draft.routeMap : makeRouteMap();
  const routeRows = Number.isFinite(Number(rawRouteMap.rows)) ? Math.max(8, Math.min(32, Number(rawRouteMap.rows))) : 16;
  const routeCols = Number.isFinite(Number(rawRouteMap.cols)) ? Math.max(8, Math.min(40, Number(rawRouteMap.cols))) : 24;
  const seenRouteCells = new Set();
  draft.routeMap = {
    rows: routeRows,
    cols: routeCols,
    notes: rawRouteMap.notes || '',
    cells: (Array.isArray(rawRouteMap.cells) ? rawRouteMap.cells : [])
      .map((cell) => normalizeRouteMapCell(cell, routeRows, routeCols))
      .filter((cell) => {
        const key = `${cell.x}:${cell.y}`;
        if (seenRouteCells.has(key)) return false;
        seenRouteCells.add(key);
        return true;
      }),
    rooms: (Array.isArray(rawRouteMap.rooms) ? rawRouteMap.rooms : []).map((room, index) => ({
      id: room?.id || uid(),
      name: room?.name || `Pièce ${index + 1}`,
      sceneId: room?.sceneId || '',
      canvasId: room?.canvasId || `route_canvas_${Math.floor(index / 15) + 1}`,
      x: Number.isFinite(Number(room?.x)) ? Math.max(4, Math.min(96, Number(room.x))) : Math.min(84, 16 + index * 10),
      y: Number.isFinite(Number(room?.y)) ? Math.max(6, Math.min(94, Number(room.y))) : Math.min(82, 18 + index * 8),
      type: ['start', 'end', 'room'].includes(room?.type) ? room.type : 'room',
    })),
    connections: (Array.isArray(rawRouteMap.connections) ? rawRouteMap.connections : []).map((connection) => ({
      id: connection?.id || uid(),
      fromRoomId: connection?.fromRoomId || '',
      toRoomId: connection?.toRoomId || '',
      label: connection?.label || '',
      condition: connection?.condition || '',
      locked: Boolean(connection?.locked),
      allowOneWay: Boolean(connection?.allowOneWay),
    })),
    canvases: Array.isArray(rawRouteMap.canvases) && rawRouteMap.canvases.length
      ? rawRouteMap.canvases.map((canvas, index) => ({
        id: canvas?.id || `route_canvas_${index + 1}`,
        name: canvas?.name || `Canvas ${index + 1}`,
      }))
      : [{ id: 'route_canvas_1', name: 'Canvas 1' }],
  };
  const rawActMaps = rawRouteMap.actMaps && typeof rawRouteMap.actMaps === 'object' ? rawRouteMap.actMaps : {};
  draft.routeMap.actMaps = Object.fromEntries(
    Object.entries(rawActMaps).map(([actId, actMap]) => [actId, normalizeRouteMapShape(actMap)])
  );
  draft.scenes = draft.scenes.map((scene) => ({
    ...makeScene({ hotspots: [] }),
    ...scene,
    actId: scene.actId || fallbackActId,
    parentSceneId: scene.parentSceneId || '',
    backgroundId: scene.backgroundId || '',
    backgroundData: scene.backgroundData || '',
    backgroundName: scene.backgroundName || '',
    backgroundWidth: Math.max(0, Math.round(Number(scene.backgroundWidth) || 0)),
    backgroundHeight: Math.max(0, Math.round(Number(scene.backgroundHeight) || 0)),
    visualEffect: normalizeAllowedValue(scene.visualEffect, ['none', ...VISUAL_EFFECT_VALUES], 'none'),
    visualEffectIntensity: VISUAL_EFFECT_INTENSITY_VALUES.includes(scene.visualEffectIntensity) ? scene.visualEffectIntensity : 'normal',
    sceneTransition: SCENE_TRANSITION_VALUES.includes(scene.sceneTransition) ? scene.sceneTransition : 'none',
    sceneTransitionDuration: Number.isFinite(Number(scene.sceneTransitionDuration)) ?
       Math.max(250, Math.min(2000, Number(scene.sceneTransitionDuration)))
      : 700,
    timerEnabled: Boolean(scene.timerEnabled),
    timerSeconds: Number.isFinite(Number(scene.timerSeconds)) ?
       Math.max(5, Math.min(3600, Math.round(Number(scene.timerSeconds))))
      : 60,
    timerEndAction: normalizeAllowedValue(scene.timerEndAction, SCENE_TIMER_ACTION_VALUES, 'none'),
    timerTargetSceneId: scene.timerTargetSceneId || '',
    timerTargetCinematicId: scene.timerTargetCinematicId || '',
    timerLifeLoss: Number.isFinite(Number(scene.timerLifeLoss)) ?
       Math.max(1, Math.min(9, Math.round(Number(scene.timerLifeLoss))))
      : 1,
    timerEndMessage: scene.timerEndMessage || 'Le temps est écoulé.',
    musicId: scene.musicId || '',
    musicData: scene.musicData || '',
    musicName: scene.musicName || '',
    musicLoop: scene.musicLoop !== false,
    ambientSoundId: scene.ambientSoundId || '',
    ambientSoundData: scene.ambientSoundData || '',
    ambientSoundName: scene.ambientSoundName || '',
    ambientSoundLoop: Boolean(scene.ambientSoundLoop),
    visualEffectZones: Array.isArray(scene.visualEffectZones) ?
       scene.visualEffectZones.map((zone) => ({
        id: zone.id || uid(),
        name: zone.name || 'Zone visuelle',
        effect: normalizeAllowedValue(zone.effect, VISUAL_EFFECT_VALUES, 'sparkles'),
        intensity: VISUAL_EFFECT_INTENSITY_VALUES.includes(zone.intensity) ? zone.intensity : 'normal',
        x: Number.isFinite(Number(zone.x)) ? Number(zone.x) : 50,
        y: Number.isFinite(Number(zone.y)) ? Number(zone.y) : 50,
        width: Number.isFinite(Number(zone.width)) ? Number(zone.width) : 24,
        height: Number.isFinite(Number(zone.height)) ? Number(zone.height) : 18,
        layer: ['behind', 'between', 'front'].includes(zone.layer) ? zone.layer : 'behind',
        isHidden: Boolean(zone.isHidden),
      }))
      : [],
    hotspots: Array.isArray(scene.hotspots) ?
       (scene.hotspots.length ? scene.hotspots.map(normalizeHotspot) : (draft.creationMode === PRO_PROMOTION_PROJECT_MODE ? [] : [makeHotspot()]))
      : [makeHotspot()],
    sceneObjects: Array.isArray(scene.sceneObjects) ?
       scene.sceneObjects.map((object) => ({
        id: object.id || uid(),
        name: object.name || 'Objet visible',
        blockType: ['object', 'text', 'image', 'button', 'input', 'code', 'hint'].includes(object.blockType) ? object.blockType : 'object',
        imageData: object.imageData || '',
        imageName: object.imageName || '',
        popupImage: object.popupImage || '',
        popupImageData: object.popupImageData || '',
        popupImageName: object.popupImageName || '',
        objectImageData: object.objectImageData || '',
        objectImageName: object.objectImageName || '',
        soundData: object.soundData || '',
        soundName: object.soundName || '',
        x: Number.isFinite(Number(object.x)) ? Number(object.x) : 50,
        y: Number.isFinite(Number(object.y)) ? Number(object.y) : 50,
        width: Number.isFinite(Number(object.width)) ? Number(object.width) : 14,
        height: Number.isFinite(Number(object.height)) ? Number(object.height) : 14,
        isInvisible: Boolean(object.isInvisible),
        isHidden: Boolean(object.isHidden),
        isLocked: Boolean(object.isLocked),
        clickMode: ['object', 'action', 'none'].includes(object.clickMode) ? object.clickMode : (object.isClickable === false ? 'none' : 'object'),
        interactionMode: ['popup', 'inventory', 'both'].includes(object.interactionMode) ? object.interactionMode : 'popup',
        linkedItemId: object.linkedItemId || '',
        removeAfterUse: object.removeAfterUse !== false,
        actionType: HOTSPOT_ACTION_VALUES.includes(object.actionType) ? object.actionType : 'dialogue',
        dialogue: object.dialogue || '',
        blockLabel: object.blockLabel || '',
        blockText: object.blockText || '',
        buttonLabel: object.buttonLabel || '',
        placeholder: object.placeholder || '',
        expectedAnswer: object.expectedAnswer || '',
        successDialogue: object.successDialogue || '',
        failureDialogue: object.failureDialogue || '',
        fontSize: Number.isFinite(Number(object.fontSize)) ? Math.max(8, Math.min(48, Number(object.fontSize))) : 13,
        fontFamily: SCENE_OBJECT_FONT_FAMILY_VALUES.includes(object.fontFamily) ? object.fontFamily : 'system',
        ...(normalizeSceneObjectHexColor(object.textColor, '') ? { textColor: normalizeSceneObjectHexColor(object.textColor, '') } : {}),
        ...(normalizeSceneObjectHexColor(object.backgroundColor, '') ? { backgroundColor: normalizeSceneObjectHexColor(object.backgroundColor, '') } : {}),
        ...(hasSceneObjectBackgroundOpacityOverride(object.backgroundOpacity) ? { backgroundOpacity: clampSceneObjectBackgroundOpacity(object.backgroundOpacity) } : {}),
        requiredItemId: object.requiredItemId || '',
        consumeRequiredItemOnUse: Boolean(object.consumeRequiredItemOnUse),
        rewardItemId: object.rewardItemId || '',
        targetSceneId: object.targetSceneId || '',
        targetCinematicId: object.targetCinematicId || '',
        externalUrl: object.externalUrl || '',
        targetProjectId: object.targetProjectId || '',
        targetProjectUserId: object.targetProjectUserId || '',
        accessCodeEnabled: object.accessCodeEnabled === true,
        accessCode: object.accessCode || '',
        enigmaId: object.enigmaId || '',
        lockedMessage: object.lockedMessage || '',
        anime2dSpec: object.anime2dSpec && typeof object.anime2dSpec === 'object' ? object.anime2dSpec : null,
        anime2dName: object.anime2dName || '',
        logicRules: Array.isArray(object.logicRules) ?
           object.logicRules.map(normalizeLogicRule)
          : [],
        zIndex: object.zIndex,
        shapeType: object.shapeType,
        shapeCorners: object.shapeCorners,
        shapePoints: object.shapePoints,
        shapePointCount: object.shapePointCount,
        tutorialCreated: Boolean(object.tutorialCreated),
      }))
      : [],
  }));
  draft.cinematics = draft.cinematics.map((cinematic) => {
    const cinematicType = ['video', 'anime2d'].includes(cinematic.cinematicType) ? cinematic.cinematicType : 'slides';
    const slides = Array.isArray(cinematic.slides) && cinematic.slides.length ?
       cinematic.slides.map((slide) => ({ ...makeCinematicSlide(), ...slide }))
      : [makeCinematicSlide()];
    const normalizedCinematic = {
      ...makeCinematic(),
      ...cinematic,
      cinematicType,
      slides,
      anime2dSpec: cinematic.anime2dSpec && typeof cinematic.anime2dSpec === 'object' ? cinematic.anime2dSpec : null,
      anime2dName: cinematic.anime2dName || '',
      videoData: cinematic.videoData || '',
      videoName: cinematic.videoName || '',
      videoAutoplay: cinematic.videoAutoplay !== false,
      videoControls: cinematic.videoControls !== false,
      onEndType: normalizeAllowedValue(cinematic.onEndType, CINEMATIC_END_VALUES, 'none'),
      targetActId: cinematic.targetActId || '',
      targetSceneId: cinematic.targetSceneId || '',
      targetProjectId: cinematic.targetProjectId || '',
      targetProjectUserId: cinematic.targetProjectUserId || '',
      rewardItemId: cinematic.rewardItemId || '',
    };
    return {
      ...normalizedCinematic,
      steps: normalizeCinematicSteps(cinematic.steps, normalizedCinematic),
    };
  });
  draft.enigmas = draft.enigmas.map((enigma) => ({
    ...makeEnigma(),
    ...enigma,
    solutionColors: Array.isArray(enigma.solutionColors) ? enigma.solutionColors : ['red', 'blue', 'green'],
    miscMode: ['free-answer', 'multiple-choice', 'true-false', 'ordering', 'matching', 'fill-blank', 'numeric-range', 'multi-select', 'accepted-answers', 'item-select', 'exact-number'].includes(enigma.miscMode) ? enigma.miscMode : 'free-answer',
    miscChoices: Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : ['Réponse A', 'Réponse B', 'Réponse C'],
    miscCorrectChoices: Array.isArray(enigma.miscCorrectChoices) ? enigma.miscCorrectChoices : [],
    miscPairs: Array.isArray(enigma.miscPairs) && enigma.miscPairs.length ? enigma.miscPairs : [
      { left: 'Symbole', right: 'Signification' },
      { left: 'Clé', right: 'Serrure' },
    ],
    miscMin: enigma.miscMin ?? '',
    miscMax: enigma.miscMax ?? '',
    miscTargetItemId: enigma.miscTargetItemId || '',
    unlockType: normalizeAllowedValue(enigma.unlockType, ENIGMA_UNLOCK_VALUES, 'none'),
    targetSceneId: enigma.targetSceneId || '',
    targetCinematicId: enigma.targetCinematicId || '',
    targetProjectId: enigma.targetProjectId || '',
    targetProjectUserId: enigma.targetProjectUserId || '',
    popupBackgroundData: enigma.popupBackgroundData || '',
    popupBackgroundName: enigma.popupBackgroundName || '',
    popupBackgroundZoom: Number(enigma.popupBackgroundZoom) || 1,
    popupBackgroundX: Number.isFinite(Number(enigma.popupBackgroundX)) ? Math.max(0, Math.min(100, Number(enigma.popupBackgroundX))) : 50,
    popupBackgroundY: Number.isFinite(Number(enigma.popupBackgroundY)) ? Math.max(0, Math.min(100, Number(enigma.popupBackgroundY))) : 50,
    popupBackgroundOverlay: ['light', 'medium', 'dark'].includes(enigma.popupBackgroundOverlay) ? enigma.popupBackgroundOverlay : 'dark',
    gridRows: Number.isFinite(Number(enigma.gridRows)) ? Math.max(2, Math.min(6, Number(enigma.gridRows))) : 3,
    gridCols: Number.isFinite(Number(enigma.gridCols)) ? Math.max(2, Math.min(6, Number(enigma.gridCols))) : 3,
  }));
  ensureSewerAct2(draft, {
    makeItem,
    makeCinematic,
    makeCinematicSlide,
    makeEnigma,
    makeImportedScene,
    makeImportedHotspot,
  });
  normalizeProPromotionProjectPage(draft);
  migrateProjectAssetReferences(draft);
  return draft;
};

const createInitialProject = () => {
  const act1 = makeAct('Acte I');
  const act2 = makeAct('Acte II');
  const key = makeItem('Petite clé', '🔑');
  const note = makeItem('Lettre brûlée', '📜');
  const rag = makeItem('Chiffon', '🧻');
  const fuel = makeItem('Essence', '⛽');
  const soakedRag = makeItem('Chiffon imbibé', '🧴');
  const stick = makeItem('Bâton', '🪵');
  const torch = makeItem('Torche', '🕯️');
  const lighter = makeItem('Briquet', '🔥');
  const litTorch = makeItem('Torche enflammée', '🔥');

  const sceneA = makeScene({ actId: act1.id });
  sceneA.name = 'Salon';
  sceneA.introText = 'Tu entrès dans le salon. Explore la pièce.';

  const sceneB = makeScene({ actId: act1.id, parentSceneId: sceneA.id });
  sceneB.name = 'Tiroir';
  sceneB.introText = 'Le tiroir révèle un nouveau secret.';

  const sceneC = makeScene({ actId: act2.id });
  sceneC.name = 'Couloir';
  sceneC.introText = 'Acte II : le couloir s’ouvre devant toi.';

  const drawerCode = makeEnigma({
    name: 'Code du tiroir',
    type: 'code',
    question: 'Entre le code du tiroir.',
    solutionText: '1947',
    successMessage: 'Le mécanisme clique. Le tiroir s’ouvre.',
    failMessage: 'Le code est incorrect.',
    unlockType: 'scene',
    targetSceneId: sceneB.id,
  });

  const hallwayColors = makeEnigma({
    name: 'Suite de couleurs du couloir',
    type: 'colors',
    question: 'Reproduis la sequence de couleurs.',
    solutionColors: ['red', 'blue', 'green'],
    successMessage: 'Les voyants passent au vert.',
    failMessage: 'Les couleurs ne correspondent pas.',
    unlockType: 'cinematic',
  });

  sceneA.hotspots = [
    {
      ...makeHotspot(),
      name: 'Coussin',
      x: 25,
      y: 70,
      actionType: 'dialogue_item',
      dialogue: 'Sous le coussin, tu trouvés une petite clé.',
      rewardItemId: key.id,
    },
    {
      ...makeHotspot(),
      name: 'Lettre',
      x: 63,
      y: 55,
      actionType: 'dialogue_item',
      dialogue: 'Une lettre brûlée dit : « Pars avant qu’ils arrivent. »',
      rewardItemId: note.id,
    },
    {
      ...makeHotspot(),
      name: 'Tiroir',
      x: 80,
      y: 60,
      width: 10,
      height: 8,
      actionType: 'scene',
      dialogue: 'Tu utilises la clé et le tiroir s’ouvre.',
      requiredItemId: key.id,
      targetSceneId: sceneB.id,
      enigmaId: drawerCode.id,
    },
    {
      ...makeHotspot(),
      name: 'Panneau lumineux',
      x: 56,
      y: 30,
      width: 14,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'Un panneau coloré bloqué un mécanisme.',
      enigmaId: hallwayColors.id,
    },
  ];

  const cinematic = makeCinematic();
  cinematic.name = 'Introduction';
  hallwayColors.targetCinematicId = cinematic.id;
  cinematic.slides[0].narration = 'Le silence pèse sur la pièce. Quelqu’un est parti en vitesse.';
  cinematic.onEndType = 'scene';
  cinematic.targetSceneId = sceneA.id;

  return normalizeProject({
    title: 'Escape Game Builder',
    acts: [act1, act2],
    items: [key, note, rag, fuel, soakedRag, stick, torch, lighter, litTorch],
    combinations: [
      { id: uid(), itemAId: rag.id, itemBId: fuel.id, resultItemId: soakedRag.id, message: "Le chiffon est imbibé d'essence." },
      { id: uid(), itemAId: soakedRag.id, itemBId: stick.id, resultItemId: torch.id, message: 'Tu fabriques une torche.' },
      { id: uid(), itemAId: torch.id, itemBId: lighter.id, resultItemId: litTorch.id, message: "La torche s'enflamme." },
    ],
    scenes: [sceneA, sceneB, sceneC],
    cinematics: [cinematic],
    enigmas: [drawerCode, hallwayColors],
    characterModels3d: [],
    decorModels3d: [],
    start: {
      type: 'scene',
      targetSceneId: sceneA.id,
      targetCinematicId: '',
    },
  });
};

const initialProject = createInitialProject();

export {
  uid,
  makeItem,
  makeCharacter3DModel,
  makeDecor3DModel,
  makeCombination,
  makeStoryVariable,
  makeHotspot,
  makeLogicRule,
  makeAct,
  makeScene,
  makeCinematicSlide,
  makeCinematic,
  makeEnigma,
  makeRouteMap,
  normalizeProject,
  createInitialProject,
  initialProject,
};
