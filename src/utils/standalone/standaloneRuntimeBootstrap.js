import {
  isFlexibleAnswerMatch,
  normalizeAnswer,
  parseJsonValue,
  randomRotations,
  sameColorSequence,
  sameNormalizedList,
  sameNormalizedSet,
  shuffledIndices,
  usesImage,
  createEnigmaRuntime,
  enigmaHandlers,
  miscAnswerHandlers,
  validateEnigmaAnswer,
  validateMiscAnswer,
} from '../../lib/enigmaEngine';
import {
  createAnime2dPreviewFrame,
  createAnime2dPreviewModel,
  getAnime2dNarrationAtTime,
  getAnime2dStepStart,
  getVisibleAnime2dLayers,
  isAnime2dImageStep,
  isAnime2dStepActive,
  normalizeAnime2dLayer,
  normalizeAnime2dSpec,
  sortAnime2dStepsByTime,
} from '../../lib/anime2dEngine';
import { COLOR_OPTIONS, POPUP_OVERLAY_GRADIENTS } from '../../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../../data/playerConfig';
import {
  GAME_ACTIONS as SHARED_GAME_ACTIONS,
  addRewardItemToInventory,
  applyHotspotBlockState,
  consumeInventoryItem,
  createHotspotViewerImage,
  createSceneTransitionOverlay,
  formatTimerSeconds as sharedFormatTimerSeconds,
  gameActions as SHARED_GAME_ACTION_CREATORS,
  getHotspotRewardItemId,
  getSceneAmbientSoundKey as sharedGetSceneAmbientSoundKey,
  getSceneMusicKey as sharedGetSceneMusicKey,
  resolveHotspotInteraction as sharedResolveHotspotInteraction,
  selectRewardInventoryItem,
} from '../../lib/gameEngine';
import {
  CINEMATIC_END_ACTIONS,
  CINEMATIC_TYPES,
  normalizeCinematicEndAction,
  normalizeCinematicType,
} from '../../lib/cinematicEngine';
import {
  combineItems,
  getCombinationItem1,
  getCombinationItem2,
  getCombinationResult,
} from '../../lib/combinationEngine';
import {
  evaluateCondition,
  evaluateLogicRuleCondition,
  evaluateReplyCondition,
  evaluateStoryVariableCondition,
  getConditionArray,
  getConditionCollectionSize,
  getConditionEnigmaId,
  getConditionFailureReasons,
  getConditionHotspotId,
  getConditionItemId,
  getConditionItemIds,
  getConditionItemLabel,
  getConditionOperatorLabel,
  getConditionReplyId,
  getConditionRequirementLabel,
  getConditionSceneId,
  getConditionStoryVariableLabel,
  getConditionType,
  getConditionVariableKey,
  getObjectiveChecklist,
  getObjectiveFinalSceneBlockMessage,
  getObjectiveRouteStatuses,
  getProjectEntry,
  getReplyTargetSceneId,
  getReplyConditionFailureReasons,
  getReplyConditionFailureSummary,
  getReplyConditionLockReason,
  getReplyCondition,
  normalizeUnvisitedReturnLabel,
  getVisitedAwareReplyLabel,
  hasReadyObjectiveRoute,
  hasOwn,
  hasConditionValue,
  isHeroAdventureEnabled,
  isHeroLogicCondition,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
  shouldBlockObjectiveFinalScene,
} from '../../lib/conditionEngine';
import { DEFAULT_COMBAT_SETTINGS } from '../../lib/combatDefaults.js';
import {
  applyArmor,
  addStatusEffect,
  applyShield,
  applyResistance,
  clampDecimal,
  clampNumber,
  getCombatEnemyStats,
  getCombatSimulationStats,
  getElementResistance,
  getEntryValue,
  getHeroForceSkill,
  getHeroForceValue,
  getHeroSkillValue,
  getPowerTypeLabel,
  getShieldAmount,
  getStatusEffectLabel,
  getStatusEffectTarget,
  getStatusModifiers,
  hasStatusEffect,
  normalizeHeroAttackType,
  normalizePowerType,
  normalizeStatusEffect,
  normalizeStatusEffectType,
  normalizeStatKey,
  numberValue,
  applyRecovery,
  createStatusEffectFromPower,
  tickStatusEffects,
  resolveCombatInitiative,
  resolveCombatVictoryReward,
  resolveCritical,
  resolveEnemyCombatAttack,
  resolveEnemyPowerDecision,
  resolveHeroCombatAttack,
  resolveRollOutcome,
  rollDodge,
  rollDie,
  spendMana,
} from '../../lib/combatEngine.js';
import {
  clampHeroRuntimeNumber,
  heroRuntimeNumber,
  isPlainHeroRuntimeObject,
  normalizeEquippedHeroState,
  normalizeHeroCombatStates,
  normalizeHeroRuntimePower,
  normalizeHeroRuntimeRules,
  normalizeHeroRuntimeSaveState,
  normalizeHeroRuntimeSkill,
  normalizeHeroRuntimeState,
  normalizeHeroStatusEffects,
  normalizeLastDiceRoll,
} from '../../lib/heroRuntimeState.js';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const serializeForScript = (value) => JSON.stringify(value).replace(/<\/script/gi, '<\\/script');

const serializeFunctionSource = (handler) => handler.toString().replace(/__vite_ssr_import_\d+__\./g, '');

const serializeFunctionMap = (name, handlers) => {
  const entries = Object.entries(handlers).map(([key, handler]) => `${JSON.stringify(key)}: ${serializeFunctionSource(handler)}`);
  return `const ${name} = {\n${entries.join(',\n')}\n};`;
};

const serializeValueForScript = (value) => {
  if (typeof value === 'function') return serializeFunctionSource(value);
  if (Array.isArray(value)) return `[${value.map(serializeValueForScript).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}:${serializeValueForScript(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

function hasConditionToken(collection, condition) {
  if (!collection) return false;
  if (Array.isArray(collection)) return collection.includes(condition);
  return Boolean(collection[condition]);
}

function isConditionMet(condition, context) {
  if (!condition) return true;
  if (typeof condition === 'function') return Boolean(condition(context));
  if (hasConditionToken(context.conditions, condition)) return true;
  if (hasConditionToken(context.flags, condition)) return true;
  if (hasConditionToken(context.state, condition)) return true;
  if (context.inventory?.includes(condition)) return true;
  if (condition.startsWith('has_')) return context.inventory?.includes(condition.slice(4));
  if (condition.startsWith('solved_')) return context.solvedEnigmaIds?.includes(condition.slice(7));
  if (condition.startsWith('completed_hotspot_')) return context.completedHotspotIds?.includes(condition.slice(18));
  if (condition.startsWith('completed_combination_')) return context.completedCombinationIds?.includes(condition.slice(22));
  if (condition.startsWith('launched_cinematic_')) return context.launchedCinematicIds?.includes(condition.slice(19));
  return false;
}

const getConfiguredPieceCount = (config = {}, state = {}) => (
  Math.max(4, Number(state.pieceCount) || (Number(config.gridRows) || 3) * (Number(config.gridCols) || 3))
);

const getContextAnswer = (answer = {}, key, fallback = '') => (
  answer && typeof answer === 'object' && !Array.isArray(answer) ? answer[key] : fallback
);

const buildStandaloneGameEngineScript = () => ([
  sameColorSequence,
  normalizeAnswer,
  isFlexibleAnswerMatch,
  parseJsonValue,
  sameNormalizedList,
  sameNormalizedSet,
  serializeFunctionMap('miscAnswerHandlers', miscAnswerHandlers),
  validateMiscAnswer,
  `const getConfiguredPieceCount = ${serializeFunctionSource(getConfiguredPieceCount)};`,
  `const getContextAnswer = ${serializeFunctionSource(getContextAnswer)};`,
  `const enigmaHandlers = ${serializeValueForScript(enigmaHandlers)};`,
  'function getEnigmaHandler(type) { return enigmaHandlers[type] || enigmaHandlers.default; }',
  createEnigmaRuntime,
  validateEnigmaAnswer,
  shuffledIndices,
  randomRotations,
  usesImage,
  getAnime2dStepStart,
  sortAnime2dStepsByTime,
  normalizeAnime2dLayer,
  normalizeAnime2dSpec,
  isAnime2dStepActive,
  isAnime2dImageStep,
  getVisibleAnime2dLayers,
  getAnime2dNarrationAtTime,
  createAnime2dPreviewFrame,
  createAnime2dPreviewModel,
  `const CINEMATIC_END_ACTIONS = ${serializeForScript(CINEMATIC_END_ACTIONS)};`,
  `const CINEMATIC_TYPES = ${serializeForScript(CINEMATIC_TYPES)};`,
  `const normalizeCinematicEndAction = ${serializeFunctionSource(normalizeCinematicEndAction)};`,
  `const normalizeCinematicType = ${serializeFunctionSource(normalizeCinematicType)};`,
  createSceneTransitionOverlay,
  `const getHotspotRewardItemId = ${serializeFunctionSource(getHotspotRewardItemId)};`,
  `const consumeInventoryItem = ${serializeFunctionSource(consumeInventoryItem)};`,
  `const addRewardItemToInventory = ${serializeFunctionSource(addRewardItemToInventory)};`,
  `const selectRewardInventoryItem = ${serializeFunctionSource(selectRewardInventoryItem)};`,
  `const createHotspotViewerImage = ${serializeFunctionSource(createHotspotViewerImage)};`,
  `const applyHotspotBlockState = ${serializeFunctionSource(applyHotspotBlockState)};`,
  hasConditionToken,
  isConditionMet,
  getConditionArray,
  hasConditionValue,
  getConditionItemIds,
  getConditionCollectionSize,
  evaluateStoryVariableCondition,
  evaluateCondition,
  getConditionType,
  getConditionItemId,
  getConditionSceneId,
  getConditionHotspotId,
  getConditionEnigmaId,
  getConditionReplyId,
  getConditionVariableKey,
  getProjectEntry,
  getConditionItemLabel,
  getConditionStoryVariableLabel,
  getConditionOperatorLabel,
  hasOwn,
  getConditionRequirementLabel,
  getConditionFailureReasons,
  getObjectiveChecklist,
  getObjectiveRouteStatuses,
  hasReadyObjectiveRoute,
  shouldBlockObjectiveFinalScene,
  getObjectiveFinalSceneBlockMessage,
  isHeroLogicCondition,
  isHeroAdventureEnabled,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
  evaluateLogicRuleCondition,
  `const sharedResolveHotspotInteraction = ${serializeFunctionSource(sharedResolveHotspotInteraction)};`,
  getReplyCondition,
  getReplyTargetSceneId,
  normalizeUnvisitedReturnLabel,
  getVisitedAwareReplyLabel,
  evaluateReplyCondition,
  getReplyConditionFailureReasons,
  getReplyConditionFailureSummary,
  getReplyConditionLockReason,
  getCombinationItem1,
  getCombinationItem2,
  getCombinationResult,
  combineItems,
  `const DEFAULT_COMBAT_SETTINGS = ${serializeForScript(DEFAULT_COMBAT_SETTINGS)};`,
  "const HERO_ATTACK_TYPES = ['physical', 'water', 'earth', 'fire', 'lightning'];",
  "const POWER_TYPES = ['water', 'earth', 'fire', 'lightning'];",
  "const STATUS_EFFECT_TYPES = ['poison', 'burn', 'stun', 'bleed', 'shield', 'force_buff', 'force_debuff', 'difficulty_buff', 'difficulty_debuff', 'resistance_buff', 'resistance_debuff', 'critical_buff', 'critical_debuff'];",
  "const DAMAGING_STATUS_EFFECTS = ['poison', 'burn', 'bleed'];",
  "const BUFF_STATUS_EFFECTS = ['force_buff', 'difficulty_buff', 'resistance_buff', 'critical_buff'];",
  "const DEBUFF_STATUS_EFFECTS = ['force_debuff', 'difficulty_debuff', 'resistance_debuff', 'critical_debuff'];",
  `const numberValue = ${serializeFunctionSource(numberValue)};`,
  `const clampNumber = ${serializeFunctionSource(clampNumber)};`,
  `const clampDecimal = ${serializeFunctionSource(clampDecimal)};`,
  `const normalizeHeroAttackType = ${serializeFunctionSource(normalizeHeroAttackType)};`,
  `const normalizePowerType = ${serializeFunctionSource(normalizePowerType)};`,
  `const getPowerTypeLabel = ${serializeFunctionSource(getPowerTypeLabel)};`,
  `const getShieldAmount = ${serializeFunctionSource(getShieldAmount)};`,
  `const getStatusEffectLabel = ${serializeFunctionSource(getStatusEffectLabel)};`,
  `const normalizeStatusEffectType = ${serializeFunctionSource(normalizeStatusEffectType)};`,
  `const getEntryValue = ${serializeFunctionSource(getEntryValue)};`,
  `const normalizeStatKey = ${serializeFunctionSource(normalizeStatKey)};`,
  `const getHeroForceSkill = ${serializeFunctionSource(getHeroForceSkill)};`,
  `const getHeroForceValue = ${serializeFunctionSource(getHeroForceValue)};`,
  `const getHeroSkillValue = ${serializeFunctionSource(getHeroSkillValue)};`,
  `const getElementResistance = ${serializeFunctionSource(getElementResistance)};`,
  `const applyResistance = ${serializeFunctionSource(applyResistance)};`,
  `const applyArmor = ${serializeFunctionSource(applyArmor)};`,
  `const applyRecovery = ${serializeFunctionSource(applyRecovery)};`,
  `const normalizeStatusEffect = ${serializeFunctionSource(normalizeStatusEffect)};`,
  isPlainHeroRuntimeObject,
  heroRuntimeNumber,
  clampHeroRuntimeNumber,
  normalizeHeroRuntimeRules,
  normalizeHeroRuntimeSkill,
  normalizeHeroRuntimePower,
  normalizeHeroRuntimeState,
  normalizeEquippedHeroState,
  normalizeLastDiceRoll,
  normalizeHeroStatusEffects,
  normalizeHeroCombatStates,
  normalizeHeroRuntimeSaveState,
  `const createStatusEffectFromPower = ${serializeFunctionSource(createStatusEffectFromPower)};`,
  `const getStatusEffectTarget = ${serializeFunctionSource(getStatusEffectTarget)};`,
  `const getStatusModifiers = ${serializeFunctionSource(getStatusModifiers)};`,
  `const hasStatusEffect = ${serializeFunctionSource(hasStatusEffect)};`,
  `const addStatusEffect = ${serializeFunctionSource(addStatusEffect)};`,
  `const applyShield = ${serializeFunctionSource(applyShield)};`,
  `const tickStatusEffects = ${serializeFunctionSource(tickStatusEffects)};`,
  `const rollDodge = ${serializeFunctionSource(rollDodge)};`,
  `const resolveCombatInitiative = ${serializeFunctionSource(resolveCombatInitiative)};`,
  `const spendMana = ${serializeFunctionSource(spendMana)};`,
  `const rollDie = ${serializeFunctionSource(rollDie)};`,
  `const resolveRollOutcome = ${serializeFunctionSource(resolveRollOutcome)};`,
  `const resolveCritical = ${serializeFunctionSource(resolveCritical)};`,
  `const getCombatEnemyStats = ${serializeFunctionSource(getCombatEnemyStats)};`,
  `const getCombatSimulationStats = ${serializeFunctionSource(getCombatSimulationStats)};`,
  `const resolveHeroCombatAttack = ${serializeFunctionSource(resolveHeroCombatAttack)};`,
  `const resolveEnemyPowerDecision = ${serializeFunctionSource(resolveEnemyPowerDecision)};`,
  `const resolveEnemyCombatAttack = ${serializeFunctionSource(resolveEnemyCombatAttack)};`,
  `const resolveCombatVictoryReward = ${serializeFunctionSource(resolveCombatVictoryReward)};`,
].map((entry) => (typeof entry === 'function' ? serializeFunctionSource(entry) : entry)).join('\n\n'));


export {
  COLOR_OPTIONS,
  POPUP_OVERLAY_GRADIENTS,
  CODE_KEYPAD_KEYS,
  SHARED_GAME_ACTIONS,
  SHARED_GAME_ACTION_CREATORS,
  buildStandaloneGameEngineScript,
  escapeHtml,
  serializeForScript,
  serializeFunctionMap,
  serializeFunctionSource,
  sharedFormatTimerSeconds,
  sharedGetSceneAmbientSoundKey,
  sharedGetSceneMusicKey,
};
