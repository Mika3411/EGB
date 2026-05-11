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
} from '../lib/enigmaEngine';
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
} from '../lib/anime2dEngine';
import { COLOR_OPTIONS, POPUP_OVERLAY_GRADIENTS } from '../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../data/playerConfig';
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
} from '../lib/gameEngine';
import {
  CINEMATIC_END_ACTIONS,
  CINEMATIC_TYPES,
  normalizeCinematicEndAction,
  normalizeCinematicType,
} from '../lib/cinematicEngine';
import {
  combineItems,
  getCombinationItem1,
  getCombinationItem2,
  getCombinationResult,
} from '../lib/combinationEngine';
import {
  evaluateCondition,
  evaluateLogicRuleCondition,
  evaluateReplyCondition,
  evaluateStoryVariableCondition,
  getConditionArray,
  getConditionItemIds,
  getReplyCondition,
  hasConditionValue,
  isHeroAdventureEnabled,
  isHeroLogicCondition,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
} from '../lib/conditionEngine';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const serializeForScript = (value) => JSON.stringify(value).replace(/<\/script/gi, '<\\/script');

const serializeFunctionMap = (name, handlers) => {
  const entries = Object.entries(handlers).map(([key, handler]) => `${JSON.stringify(key)}: ${handler.toString()}`);
  return `const ${name} = {\n${entries.join(',\n')}\n};`;
};

const serializeValueForScript = (value) => {
  if (typeof value === 'function') return value.toString();
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
  `const getConfiguredPieceCount = ${getConfiguredPieceCount.toString()};`,
  `const getContextAnswer = ${getContextAnswer.toString()};`,
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
  `const normalizeCinematicEndAction = ${normalizeCinematicEndAction.toString()};`,
  `const normalizeCinematicType = ${normalizeCinematicType.toString()};`,
  createSceneTransitionOverlay,
  getHotspotRewardItemId,
  consumeInventoryItem,
  addRewardItemToInventory,
  selectRewardInventoryItem,
  createHotspotViewerImage,
  applyHotspotBlockState,
  hasConditionToken,
  isConditionMet,
  getConditionArray,
  hasConditionValue,
  getConditionItemIds,
  evaluateStoryVariableCondition,
  evaluateCondition,
  isHeroLogicCondition,
  isHeroAdventureEnabled,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
  evaluateLogicRuleCondition,
  `const sharedResolveHotspotInteraction = ${sharedResolveHotspotInteraction.toString()};`,
  getReplyCondition,
  evaluateReplyCondition,
  getCombinationItem1,
  getCombinationItem2,
  getCombinationResult,
  combineItems,
].map((entry) => (typeof entry === 'function' ? entry.toString() : entry)).join('\n\n'));

export function buildStandaloneHtml(project) {
  const safeTitle = escapeHtml(project?.title || 'Escape Game');
  const serializedProject = serializeForScript(project);
  const serializedColorOptions = serializeForScript(COLOR_OPTIONS);
  const serializedPopupOverlayGradients = serializeForScript(POPUP_OVERLAY_GRADIENTS);
  const serializedCodeKeypadKeys = serializeForScript(CODE_KEYPAD_KEYS);
  const serializedGameActions = serializeForScript(SHARED_GAME_ACTIONS);
  const serializedGameActionCreators = serializeFunctionMap('gameActions', SHARED_GAME_ACTION_CREATORS);
  const serializedSceneAudioHelpers = [
    `const getSharedSceneMusicKey = ${sharedGetSceneMusicKey.toString()};`,
    `const getSharedSceneAmbientSoundKey = ${sharedGetSceneAmbientSoundKey.toString()};`,
    `const getSharedFormatTimerSeconds = ${sharedFormatTimerSeconds.toString()};`,
  ].join('\n');
  const standaloneGameEngineScript = buildStandaloneGameEngineScript();

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Inter,Arial,sans-serif;background:
radial-gradient(circle at top left, rgba(79,140,255,.14), transparent 28%),
radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 22%),
linear-gradient(180deg, #08101c 0%, #09111f 100%);color:#eef4ff}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.app-shell{max-width:none;margin:0;padding:0}
.app-shell>.topbar{display:none}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px}
.brand-block{max-width:760px}
.topbar h1{margin:0 0 10px;font-size:40px;line-height:1.04;letter-spacing:-.03em}
.topbar p{margin:0;color:#9fb0cc;line-height:1.6}
.status-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(79,140,255,0.12);border:1px solid rgba(96,165,250,0.2);color:#d9e7ff;font-weight:700;font-size:12px}
.topbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fullscreen-toggle{border:1px solid rgba(96,165,250,.25);background:rgba(18,31,56,.95);color:#fff;padding:11px 16px;border-radius:14px;box-shadow:none}
body.game-fullscreen{background:#000}
body.game-fullscreen .app-shell{max-width:none;width:100%;padding:0}
body.game-fullscreen .topbar{display:none}
body.game-fullscreen .layout{grid-template-columns:1fr;min-height:100vh;place-items:center}
body.game-fullscreen .side{display:none}
body.game-fullscreen .main{padding:0;border:none;border-radius:0;background:#000;box-shadow:none;display:grid;place-items:center;width:100%;min-height:100vh}
body.game-fullscreen .scene-player{width:min(100vw,calc(100vh * var(--scene-aspect,1.6)));height:min(100vh,calc(100vw / var(--scene-aspect,1.6)));aspect-ratio:var(--scene-aspect,1.6);min-height:0;border:none;border-radius:0}
body.game-fullscreen .inventory-actions{display:none}
body.game-fullscreen .scene-inline-viewer{padding:40px}
.fullscreen-hud{display:none!important}
.inventory-drawer{display:none}
.player-shell{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px}
.player-shell.is-shared-player{width:100vw;min-height:100vh;grid-template-columns:1fr;gap:0;padding:0;background:#020617;place-items:center}
.player-stage-panel{min-width:0}
.player-shell.is-shared-player .player-stage-panel{width:100%;height:100vh;border-radius:0;border:0;padding:0;background:#020617;box-shadow:none;display:grid;place-items:center}
.player-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;pointer-events:none;transition:opacity .2s ease,transform .2s ease}
.player-topbar button{pointer-events:auto}
.player-shell.controls-hidden .player-topbar{opacity:0;transform:translateY(-10px);pointer-events:none}
.player-shell.controls-hidden .player-topbar button{pointer-events:none}
.player-topbar strong{display:block;margin-top:4px;color:#f8fbff}
.player-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.player-actions button{min-height:36px;padding:8px 12px;border-radius:12px}
.player-actions .secondary-action{color:#eaf2ff!important;background:rgba(18,31,56,.96)!important;border-color:rgba(148,163,184,.22)!important;box-shadow:none!important}
.player-actions .secondary-action:hover{background:rgba(30,48,82,.98)!important;border-color:rgba(96,165,250,.36)!important}
.player-shell.is-shared-player .player-side-panel,.player-shell.is-shared-player .inventory-actions,.player-shell.is-shared-player .player-reset-button{display:none}
.player-shell.is-shared-player .player-topbar{position:fixed;top:14px;left:14px;right:14px;z-index:35;padding:10px 12px;border-radius:16px;background:rgba(2,6,23,.32);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);pointer-events:none}
.player-shell.is-shared-player .scene-player{width:min(100vw,calc(100vh * var(--scene-aspect,1.6)));height:min(100vh,calc(100vw / var(--scene-aspect,1.6)));aspect-ratio:var(--scene-aspect,1.6);border-radius:0;border:0}
.player-narration-bar{position:absolute;left:18px;right:18px;bottom:18px;z-index:24;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;pointer-events:none}
.player-shell.is-shared-player .player-narration-bar{left:24px;right:24px;bottom:24px}
.player-narration-bar p{max-width:min(780px,72%);margin:0;padding:12px 15px;border-radius:16px;background:var(--player-narration-bg,rgba(2,6,23,.42));border:1px solid rgba(255,255,255,.10);color:#fff;line-height:1.55;box-shadow:0 16px 42px rgba(0,0,0,.28);backdrop-filter:blur(8px);pointer-events:auto;cursor:pointer}
.player-shell.is-shared-player .player-narration-bar p{font-size:20px;max-width:min(860px,72vw)}
.player-narration-bar.is-collapsed{justify-content:flex-end}
.narration-discreet-button,.inventory-discreet-button{pointer-events:auto;min-height:38px;padding:9px 13px;border-radius:999px;background:rgba(15,23,42,.42)!important;border:1px solid rgba(148,163,184,.20)!important;color:#eaf2ff!important;box-shadow:0 12px 30px rgba(0,0,0,.22)!important}
.narration-discreet-button{min-height:34px;padding:7px 12px;background:rgba(15,23,42,.34)!important;color:#dbeafe!important}
.player-shell :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){font-family:var(--player-button-font,inherit)}
.player-shell :is(.player-narration-bar p,.dialogue-box,.narration,.anime2d-player-narration,.enigma-overlay-question){font-family:var(--player-narration-font,inherit)}
.player-button-font-system{--player-button-font:Inter,Arial,sans-serif}.player-button-font-serif{--player-button-font:Georgia,"Times New Roman",serif}.player-button-font-story{--player-button-font:"Palatino Linotype",Palatino,Georgia,serif}.player-button-font-fantasy{--player-button-font:Copperplate,Papyrus,Georgia,serif}.player-button-font-medieval{--player-button-font:"Book Antiqua","Palatino Linotype",Palatino,Georgia,serif}.player-button-font-gothic{--player-button-font:"Old English Text MT","UnifrakturCook","Blackletter",Georgia,serif}.player-button-font-mono{--player-button-font:"Courier New",Consolas,monospace}
.player-narration-font-system{--player-narration-font:Inter,Arial,sans-serif}.player-narration-font-serif{--player-narration-font:Georgia,"Times New Roman",serif}.player-narration-font-story{--player-narration-font:"Palatino Linotype",Palatino,Georgia,serif}.player-narration-font-fantasy{--player-narration-font:Copperplate,Papyrus,Georgia,serif}.player-narration-font-medieval{--player-narration-font:"Book Antiqua","Palatino Linotype",Palatino,Georgia,serif}.player-narration-font-gothic{--player-narration-font:"Old English Text MT","UnifrakturCook","Blackletter",Georgia,serif}.player-narration-font-mono{--player-narration-font:"Courier New",Consolas,monospace}
.player-inventory-drawer{position:absolute;top:14px;right:14px;bottom:72px;z-index:30;width:min(360px,86%);overflow:auto;padding:14px;border-radius:18px;background:rgba(8,16,30,.94);border:1px solid rgba(148,163,184,.18);box-shadow:0 24px 70px rgba(0,0,0,.36);backdrop-filter:blur(12px)}
.player-inventory-drawer--adventure{position:fixed!important;top:50%!important;left:50%!important;right:auto!important;bottom:auto!important;z-index:120!important;width:min(920px,calc(100vw - 56px))!important;max-height:calc(100vh - 56px)!important;transform:translate(-50%,-50%)!important}
.conversation-player-card{width:min(980px,calc(100vw - 40px));display:grid;gap:16px;padding:18px;border-color:rgba(147,197,253,.28);background:rgba(8,16,30,.94)}
.conversation-player-card .panel-head{align-items:flex-start;gap:14px}.conversation-player-card .panel-head>div{min-width:0;flex:1 1 auto}.conversation-player-card h2{margin:0 0 6px}.conversation-player-card .small-note{margin:0;color:#f8fbff;font-size:18px;line-height:1.45}
.conversation-player-replies{display:grid;gap:10px}.conversation-player-replies-2{grid-template-columns:repeat(2,minmax(0,1fr))}.conversation-player-replies-3{grid-template-columns:repeat(3,minmax(0,1fr))}.conversation-player-replies .secondary-action{display:grid;gap:4px;min-height:54px;justify-content:center;white-space:normal;line-height:1.25}.conversation-player-replies .secondary-action small{color:#cbd5e1;font-size:11px;font-weight:800}.conversation-player-replies .conversation-reply-locked,.conversation-player-replies .conversation-reply-locked:disabled{cursor:not-allowed;opacity:.68;color:#cbd5e1!important;background:rgba(15,23,42,.72)!important;border-color:rgba(148,163,184,.28)!important;box-shadow:none!important;transform:none!important}
.choice-effect-floating{position:absolute;left:18px;right:18px;top:78px;z-index:42;display:flex;justify-content:center;pointer-events:none}.choice-effect-floating .choice-effect-summary{width:min(760px,100%);pointer-events:auto}.choice-effect-summary{display:grid;gap:10px;padding:12px;border:1px solid rgba(147,197,253,.24);border-radius:12px;color:#f8fbff;background:rgba(8,16,30,.9);box-shadow:0 18px 48px rgba(0,0,0,.28);backdrop-filter:blur(10px)}.choice-effect-summary.compact{padding:10px;box-shadow:none}.choice-effect-summary-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.choice-effect-summary-head strong{font-size:13px;letter-spacing:.02em;text-transform:uppercase}.choice-effect-summary-head button{min-height:30px;padding:5px 9px;font-size:12px}.choice-effect-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.choice-effect-pill{display:grid;gap:3px;min-width:0;padding:9px 10px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:rgba(15,23,42,.74)}.choice-effect-pill strong,.choice-effect-pill small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.choice-effect-pill strong{color:#eaf2ff;font-size:13px}.choice-effect-pill small{color:#cbd7ea;font-size:12px}.choice-effect-item{border-color:rgba(251,191,36,.36)}.choice-effect-variable{border-color:rgba(34,197,94,.34)}.choice-effect-journal{border-color:rgba(96,165,250,.34)}.choice-effect-route{border-color:rgba(168,85,247,.32)}.choice-effect-ending{border-color:rgba(248,113,113,.38)}.choice-effect-media{border-color:rgba(45,212,191,.34)}
@media (max-width:820px){.conversation-player-replies-2,.conversation-player-replies-3{grid-template-columns:1fr}.player-inventory-drawer--adventure{width:min(520px,calc(100vw - 28px))!important;max-height:calc(100vh - 28px)!important}}
.player-combine-button{width:100%;justify-content:center;margin-bottom:12px}
.player-pause-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.48);backdrop-filter:blur(8px)}
.player-pause-menu{width:min(680px,92vw);max-height:min(760px,90vh);overflow:auto;padding:22px;border-radius:22px;background:rgba(8,16,30,.94);border:1px solid rgba(148,163,184,.2);box-shadow:0 30px 90px rgba(0,0,0,.42);color:#fff}
.player-pause-menu h2{margin:8px 0 18px;font-size:28px}
.player-pause-actions{display:grid;gap:10px}
.player-pause-actions button{justify-content:center;min-height:42px;border-radius:13px}
.player-shell.player-button-style-modern :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:12px!important;color:#f8fbff!important;background:linear-gradient(180deg,#3b82f6,#1d4ed8)!important;border-color:rgba(147,197,253,.42)!important;box-shadow:0 14px 30px rgba(37,99,235,.24)!important}
.player-shell.player-button-style-parchment :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:7px!important;color:#2c1a08!important;background:linear-gradient(180deg,#f6e7bd,#b98b45)!important;border-color:rgba(255,237,178,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.62),0 10px 24px rgba(73,46,15,.28)!important}
.player-shell.player-button-style-arcane :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:999px!important;color:#faf5ff!important;background:linear-gradient(135deg,#4c1d95,#7c3aed 48%,#0891b2)!important;border-color:rgba(216,180,254,.56)!important;box-shadow:0 0 0 1px rgba(168,85,247,.16),0 16px 34px rgba(76,29,149,.32)!important}
.player-shell.player-button-style-stone :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:4px!important;color:#f8fafc!important;background:linear-gradient(180deg,#64748b,#334155 58%,#1e293b)!important;border-color:rgba(203,213,225,.34)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 12px 22px rgba(2,6,23,.36)!important}
.player-shell.player-button-style-neon :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:10px!important;color:#cffafe!important;background:linear-gradient(180deg,#06111f,#0f172a)!important;border-color:rgba(34,211,238,.78)!important;box-shadow:0 0 0 1px rgba(34,211,238,.22),0 0 22px rgba(34,211,238,.22)!important;text-shadow:0 0 8px rgba(103,232,249,.72)}
.player-shell.player-button-style-blood :is(.player-actions button,.secondary-action,.secondary-button,.code-primary-button,.code-secondary-button,.code-key-button,.inventory-discreet-button,.narration-discreet-button,.inventory-item,.player-pause-actions button,.overlay-card .panel-head button,.overlay-card .inline-actions button){border-radius:9px!important;color:#fff7ed!important;background:linear-gradient(180deg,#7f1d1d,#450a0a)!important;border-color:rgba(248,113,113,.42)!important;box-shadow:0 14px 28px rgba(69,10,10,.34)!important}
.adventure-state-card{display:grid;gap:10px;margin:0 0 14px;padding:10px;border:1px solid rgba(147,197,253,.18);border-radius:12px;background:rgba(15,23,42,.45)}
.adventure-state-card>strong{color:#f8fafc;font-size:13px}
.adventure-state-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.adventure-state-grid span{display:grid;gap:2px;min-width:0;padding:7px;border:1px solid rgba(148,163,184,.16);border-radius:8px;background:rgba(2,6,23,.45);color:#cbd5e1;font-size:11px;text-align:center}
.adventure-state-grid strong{color:#f8fafc;font-size:15px}
.adventure-state-list{display:grid;gap:5px;max-height:110px;overflow:auto}
.adventure-state-list span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfdbfe;font-size:12px}
.adventure-state-list strong{color:#f8fafc}
.adventure-journal-card{display:grid;gap:10px;margin:0 0 14px;padding:10px;border:1px solid rgba(147,197,253,.18);border-radius:12px;background:rgba(15,23,42,.45)}
.adventure-journal-card>strong{color:#f8fafc;font-size:13px}
.adventure-journal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.adventure-journal-grid section{display:grid;gap:7px;min-width:0}
.adventure-journal-grid section>strong{color:#f8fafc;font-size:12px}
.adventure-journal-list{display:grid;gap:6px;max-height:140px;overflow:auto}
.adventure-journal-list span{display:grid;gap:2px;min-width:0;padding:7px;border:1px solid rgba(148,163,184,.14);border-radius:8px;background:rgba(2,6,23,.45);color:#cbd5e1;font-size:12px}
.adventure-journal-list strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f8fafc}
.adventure-journal-list small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}
@media (max-width:720px){.adventure-journal-grid{grid-template-columns:1fr}}
.conversation-portrait{width:76px;height:76px;object-fit:cover;border-radius:12px;border:1px solid rgba(147,197,253,.25);background:#020617}
body.game-fullscreen .fullscreen-hud{display:flex;position:fixed;left:20px;right:20px;bottom:20px;z-index:35;align-items:flex-end;justify-content:space-between;gap:16px;pointer-events:none}
body.game-fullscreen .fullscreen-dialogue{max-width:min(70vw,900px);padding:16px 20px;border-radius:20px;background:rgba(3,10,24,.72);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,.35);font-size:28px;line-height:1.5;color:#fff}
body.game-fullscreen .fullscreen-actions{display:flex;gap:12px;pointer-events:auto}
body.game-fullscreen .hud-button{border:1px solid rgba(96,165,250,.25);background:rgba(18,31,56,.95);color:#fff;padding:12px 18px;border-radius:14px;box-shadow:none}
body.game-fullscreen .inventory-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);z-index:45;background:linear-gradient(180deg, rgba(12,20,37,.98) 0%, rgba(8,16,30,.98) 100%);border-left:1px solid rgba(148,163,184,.16);box-shadow:-20px 0 60px rgba(0,0,0,.34);padding:20px;overflow:auto}
body.game-fullscreen .inventory-drawer.open{display:block}
body.game-fullscreen .inventory-drawer__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
body.game-fullscreen .inventory-drawer__head h3{margin:0}
body.game-fullscreen .inventory-drawer__backdrop{position:fixed;inset:0;z-index:44;background:rgba(0,0,0,.45)}
.layout{display:grid;gap:18px;grid-template-columns:1fr 360px}
.panel{background:linear-gradient(180deg, rgba(12,20,37,.96) 0%, rgba(8,16,30,.96) 100%);border:1px solid rgba(148,163,184,.16);box-shadow:0 20px 60px rgba(0,0,0,.34);border-radius:28px;padding:20px}
.scene-player{position:relative;aspect-ratio:var(--scene-aspect,1.6);border-radius:24px;overflow:hidden;background:#020617;border:1px solid rgba(148,163,184,.12)}
.scene-player img.bg{width:100%;height:100%;object-fit:cover;display:block}
.scene-timer-hud{position:absolute;top:14px;right:14px;z-index:32;display:flex;align-items:center;gap:10px;min-height:38px;padding:8px 11px;border-radius:8px;color:#fff;background:rgba(2,6,23,.72);border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.28);backdrop-filter:blur(10px);pointer-events:none}.scene-timer-hud strong{font-variant-numeric:tabular-nums;font-size:18px;line-height:1}.scene-timer-hud span{color:#cbd7ea;font-size:12px;white-space:nowrap}
.act-preload-overlay{position:absolute;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);pointer-events:auto}.act-preload-card{width:min(420px,88%);display:grid;gap:12px;padding:22px;border-radius:8px;color:#f8fbff;background:rgba(8,16,30,.94);border:1px solid rgba(148,163,184,.22);box-shadow:0 28px 80px rgba(0,0,0,.42)}.act-preload-card strong{font-size:22px;line-height:1.15}.act-preload-card small{color:#cbd7ea}.act-preload-bar{height:12px;overflow:hidden;border-radius:999px;background:rgba(15,23,42,.92);border:1px solid rgba(147,197,253,.22)}.act-preload-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#4ade80);transition:width .18s ease}
.scene-transition-overlay{position:absolute;inset:0;z-index:90;pointer-events:none;overflow:hidden;background:#020617}
.scene-transition-overlay img,.scene-transition-overlay .placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;animation:sceneTransitionFadeOut var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--slide-left img,.scene-transition-overlay--slide-left .placeholder{animation-name:sceneTransitionSlideLeft}
.scene-transition-overlay--slide-right img,.scene-transition-overlay--slide-right .placeholder{animation-name:sceneTransitionSlideRight}
.scene-transition-overlay--slide-up img,.scene-transition-overlay--slide-up .placeholder{animation-name:sceneTransitionSlideUp}
.scene-transition-overlay--slide-down img,.scene-transition-overlay--slide-down .placeholder{animation-name:sceneTransitionSlideDown}
.scene-transition-overlay--wipe-left img,.scene-transition-overlay--wipe-left .placeholder{animation-name:sceneTransitionWipeLeft}
.scene-transition-overlay--wipe-right img,.scene-transition-overlay--wipe-right .placeholder{animation-name:sceneTransitionWipeRight}
.scene-transition-overlay--wipe-up img,.scene-transition-overlay--wipe-up .placeholder{animation-name:sceneTransitionWipeUp}
.scene-transition-overlay--wipe-down img,.scene-transition-overlay--wipe-down .placeholder{animation-name:sceneTransitionWipeDown}
.scene-transition-overlay--zoom img,.scene-transition-overlay--zoom .placeholder{animation-name:sceneTransitionZoomOut}
.scene-transition-overlay--zoom-spin img,.scene-transition-overlay--zoom-spin .placeholder{animation-name:sceneTransitionZoomSpin}
.scene-transition-overlay--iris img,.scene-transition-overlay--iris .placeholder{animation-name:sceneTransitionIris}
.scene-transition-overlay--blur img,.scene-transition-overlay--blur .placeholder{animation-name:sceneTransitionBlur}
.scene-transition-overlay--dissolve img,.scene-transition-overlay--dissolve .placeholder{animation-name:sceneTransitionDissolve}
.scene-transition-overlay--flip img,.scene-transition-overlay--flip .placeholder{animation-name:sceneTransitionFlip;backface-visibility:hidden;transform-origin:center}
.scene-transition-overlay--rotate img,.scene-transition-overlay--rotate .placeholder{animation-name:sceneTransitionRotate}
.scene-transition-overlay--glitch img,.scene-transition-overlay--glitch .placeholder{animation-name:sceneTransitionGlitchOut}
.scene-transition-overlay--pixel img,.scene-transition-overlay--pixel .placeholder{animation-name:sceneTransitionPixelOut;image-rendering:pixelated}
.scene-transition-overlay--burn img,.scene-transition-overlay--burn .placeholder{animation-name:sceneTransitionBurnOut}
.scene-transition-overlay--curtain img,.scene-transition-overlay--curtain .placeholder{animation-name:sceneTransitionCurtainOut}
.scene-transition-overlay--split-horizontal img,.scene-transition-overlay--split-horizontal .placeholder{animation-name:sceneTransitionSplitHorizontal}
.scene-transition-overlay--split-vertical img,.scene-transition-overlay--split-vertical .placeholder{animation-name:sceneTransitionSplitVertical}
.scene-transition-overlay--flash::after{content:"";position:absolute;inset:0;z-index:4;background:#fff;animation:sceneTransitionFlash var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--glitch::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,transparent 3px 9px),linear-gradient(90deg,rgba(239,68,68,.24),transparent,rgba(56,189,248,.24));mix-blend-mode:screen;animation:sceneTransitionGlitchFlash var(--scene-transition-duration,700ms) steps(2,end) both}
.scene-transition-overlay--pixel::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(2,6,23,.38) 0 8px,transparent 8px 16px),repeating-linear-gradient(0deg,rgba(2,6,23,.34) 0 8px,transparent 8px 16px);animation:sceneTransitionPixelGrid var(--scene-transition-duration,700ms) steps(5,end) both}
.scene-transition-overlay--burn::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95),rgba(250,204,21,.78) 18%,rgba(249,115,22,.35) 32%,transparent 54%);mix-blend-mode:screen;animation:sceneTransitionBurnGlow var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--curtain::before,.scene-transition-overlay--curtain::after,.scene-transition-overlay--cinematic-bars::before,.scene-transition-overlay--cinematic-bars::after{content:"";position:absolute;z-index:5;pointer-events:none;background:#020617}
.scene-transition-overlay--curtain::before{inset:0 50% 0 0;animation:sceneTransitionCurtainLeft var(--scene-transition-duration,700ms) ease both}.scene-transition-overlay--curtain::after{inset:0 0 0 50%;animation:sceneTransitionCurtainRight var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--cinematic-bars::before{left:0;right:0;top:0;height:50%;animation:sceneTransitionBarsTop var(--scene-transition-duration,700ms) ease both}.scene-transition-overlay--cinematic-bars::after{left:0;right:0;bottom:0;height:50%;animation:sceneTransitionBarsBottom var(--scene-transition-duration,700ms) ease both}
@keyframes sceneTransitionFadeOut{from{opacity:1}to{opacity:0}}
@keyframes sceneTransitionSlideLeft{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(-100%,0,0)}}
@keyframes sceneTransitionSlideRight{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(100%,0,0)}}
@keyframes sceneTransitionSlideUp{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(0,-100%,0)}}
@keyframes sceneTransitionSlideDown{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(0,100%,0)}}
@keyframes sceneTransitionWipeLeft{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 100% 0 0)}}@keyframes sceneTransitionWipeRight{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 0 100%)}}@keyframes sceneTransitionWipeUp{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(100% 0 0 0)}}@keyframes sceneTransitionWipeDown{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 100% 0)}}
@keyframes sceneTransitionZoomOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.16)}}
@keyframes sceneTransitionZoomSpin{from{opacity:1;transform:scale(1) rotate(0deg)}to{opacity:0;transform:scale(1.28) rotate(7deg)}}@keyframes sceneTransitionIris{from{clip-path:circle(75% at 50% 50%)}to{clip-path:circle(0% at 50% 50%)}}@keyframes sceneTransitionBlur{from{opacity:1;filter:blur(0) saturate(1);transform:scale(1)}to{opacity:0;filter:blur(18px) saturate(1.35);transform:scale(1.06)}}@keyframes sceneTransitionDissolve{0%{opacity:1;filter:contrast(1)}40%{opacity:.72;filter:contrast(1.8) brightness(1.12)}70%{opacity:.28;filter:contrast(2.6) brightness(1.24)}100%{opacity:0;filter:contrast(3) brightness(1.35)}}@keyframes sceneTransitionFlip{from{opacity:1;transform:perspective(900px) rotateY(0deg)}to{opacity:0;transform:perspective(900px) rotateY(88deg)}}@keyframes sceneTransitionRotate{from{opacity:1;transform:scale(1) rotate(0deg)}to{opacity:0;transform:scale(.72) rotate(-10deg)}}@keyframes sceneTransitionGlitchOut{0%,100%{opacity:1;transform:translate3d(0,0,0)}18%{transform:translate3d(-12px,0,0);filter:hue-rotate(60deg)}34%{transform:translate3d(10px,-2px,0);opacity:.86}52%{transform:translate3d(-7px,3px,0);filter:saturate(2)}74%{transform:translate3d(5px,0,0);opacity:.38}100%{opacity:0;transform:translate3d(0,0,0)}}@keyframes sceneTransitionGlitchFlash{0%,15%,62%,100%{opacity:0}20%,48%{opacity:.78}70%{opacity:.35}}@keyframes sceneTransitionPixelOut{from{opacity:1;filter:contrast(1);transform:scale(1)}to{opacity:0;filter:contrast(2.2);transform:scale(1.04)}}@keyframes sceneTransitionPixelGrid{from{opacity:0;background-size:6px 6px}45%{opacity:.8;background-size:12px 12px}to{opacity:0;background-size:24px 24px}}@keyframes sceneTransitionBurnOut{from{opacity:1;filter:brightness(1) saturate(1)}55%{opacity:.8;filter:brightness(1.45) saturate(1.5)}to{opacity:0;filter:brightness(2.4) saturate(2)}}@keyframes sceneTransitionBurnGlow{from{opacity:0;transform:scale(.2)}45%{opacity:.85;transform:scale(1.1)}to{opacity:0;transform:scale(1.8)}}@keyframes sceneTransitionCurtainOut{from{opacity:1}55%{opacity:1}to{opacity:0}}@keyframes sceneTransitionCurtainLeft{from{transform:translateX(-100%)}48%{transform:translateX(0)}to{transform:translateX(0)}}@keyframes sceneTransitionCurtainRight{from{transform:translateX(100%)}48%{transform:translateX(0)}to{transform:translateX(0)}}@keyframes sceneTransitionSplitHorizontal{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(50% 0 50% 0)}}@keyframes sceneTransitionSplitVertical{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 50% 0 50%)}}@keyframes sceneTransitionBarsTop{from{transform:translateY(-100%)}55%,to{transform:translateY(0)}}@keyframes sceneTransitionBarsBottom{from{transform:translateY(100%)}55%,to{transform:translateY(0)}}
@keyframes sceneTransitionFlash{0%{opacity:0}18%{opacity:.92}100%{opacity:0}}
.placeholder{width:100%;height:100%;min-height:220px;display:flex;align-items:center;justify-content:center;color:#7f92b2;padding:24px;text-align:center;background:rgba(10,18,33,.6)}
.player-hotspot{position:absolute;transform:translate(-50%,-50%);background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important;padding:0!important;margin:0!important;border-radius:0!important;appearance:none;-webkit-appearance:none;z-index:20;pointer-events:auto;display:block}
.player-hotspot:hover,.player-hotspot:focus,.player-hotspot:active{background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important}
.player-scene-object{position:absolute!important;transform:translate(-50%,-50%)!important;transform-origin:center center!important;z-index:18;cursor:pointer;display:block!important;pointer-events:auto;padding:0!important;margin:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;overflow:hidden!important;appearance:none!important;-webkit-appearance:none!important;line-height:0!important;box-sizing:border-box!important;min-width:0!important;min-height:0!important}
.player-scene-object:hover,.player-scene-object:focus,.player-scene-object:active{transform:translate(-50%,-50%)!important;padding:0!important;margin:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important}
.player-scene-object-invisible,.player-scene-object-invisible:hover,.player-scene-object-invisible:focus,.player-scene-object-invisible:active{color:transparent!important;background:transparent!important}
.player-scene-object img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important;display:block!important;pointer-events:none!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
.interactive-block{position:absolute!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;padding:8px 10px;border:1px solid rgba(226,232,240,.34);border-radius:8px;background:rgba(15,23,42,.82);color:#f8fafc;font-size:13px;line-height:1.25;text-align:center;box-sizing:border-box;overflow:hidden;pointer-events:none;transform:none!important}.interactive-block span{position:static!important;inset:auto!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;max-width:100%!important;background:transparent!important;padding:0!important;border-radius:0!important;transform:none!important;line-height:inherit!important}.interactive-block strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.interactive-block small{display:block;max-width:100%;color:#cbd5e1;font-size:11px;line-height:1.25}.interactive-block--text{align-items:flex-start;justify-content:flex-start;text-align:left;white-space:pre-wrap}.interactive-block--hint{border-color:rgba(250,204,21,.55);background:rgba(67,56,202,.82)}.interactive-block--button{border-color:rgba(96,165,250,.58);background:linear-gradient(135deg,rgba(37,99,235,.96),rgba(79,70,229,.96));font-weight:800}.interactive-block--field{align-items:stretch;background:rgba(248,250,252,.94);color:#0f172a}.interactive-block--field small{padding:6px 8px;border:1px solid rgba(15,23,42,.18);border-radius:6px;background:#fff;color:#64748b}.interactive-block--code span{font-size:20px;letter-spacing:2px}.interactive-block--image{border-style:dashed;background:rgba(30,41,59,.74)}
.scene-visual-effect{position:absolute;inset:0;z-index:12;overflow:hidden;pointer-events:none}
.scene-visual-effect-zone{inset:auto;transform:translate(-50%,-50%)}
.scene-visual-effect--subtle{opacity:.48}.scene-visual-effect--normal{opacity:1}.scene-visual-effect--strong{opacity:1.45;filter:saturate(1.25) contrast(1.08)}
.scene-visual-effect--sparkles:before,.scene-visual-effect--sparkles:after{content:"";position:absolute;inset:-10%;background-image:radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 2px),radial-gradient(circle,rgba(191,219,254,.9) 0 1px,transparent 2px),radial-gradient(circle,rgba(250,204,21,.72) 0 1px,transparent 2px);background-size:130px 110px,190px 170px,240px 210px;background-position:12px 18px,80px 55px,140px 90px;opacity:.55;animation:sceneSparkleTwinkle 3.2s ease-in-out infinite alternate}
.scene-visual-effect--sparkles:after{filter:blur(.4px);opacity:.35;transform:translate3d(0,0,0) scale(1.05);animation-duration:4.7s;animation-delay:-1.2s}
@keyframes sceneSparkleTwinkle{0%{opacity:.18;transform:translate3d(-4px,2px,0) scale(1)}45%{opacity:.72}100%{opacity:.32;transform:translate3d(5px,-3px,0) scale(1.02)}}
.scene-visual-effect--snow:before,.scene-visual-effect--snow:after{content:"";position:absolute;inset:-40% -8% -10%;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1px,transparent 2px),radial-gradient(circle,rgba(219,234,254,.78) 0 1.5px,transparent 3px),radial-gradient(circle,rgba(255,255,255,.62) 0 2px,transparent 4px);background-size:90px 90px,140px 130px,220px 190px;background-position:12px 8px,65px 42px,120px 90px;opacity:.74;animation:sceneSnowFall 14s linear infinite}.scene-visual-effect--snow:after{opacity:.42;filter:blur(.6px);animation-duration:22s;animation-delay:-9s}@keyframes sceneSnowFall{from{transform:translate3d(-2%,-16%,0)}to{transform:translate3d(3%,24%,0)}}
.scene-visual-effect--fog:before,.scene-visual-effect--fog:after{content:"";position:absolute;inset:-24%;background:radial-gradient(ellipse at 18% 48%,rgba(226,232,240,.24),transparent 34%),radial-gradient(ellipse at 56% 42%,rgba(203,213,225,.20),transparent 32%),radial-gradient(ellipse at 88% 58%,rgba(226,232,240,.18),transparent 36%),linear-gradient(90deg,transparent,rgba(226,232,240,.13),transparent);filter:blur(18px);opacity:.78;animation:sceneFogDrift 18s ease-in-out infinite alternate}.scene-visual-effect--fog:after{opacity:.45;animation-duration:26s;animation-delay:-7s;transform:scale(1.2)}@keyframes sceneFogDrift{from{transform:translate3d(-8%,2%,0) scale(1.05)}to{transform:translate3d(8%,-2%,0) scale(1.18)}}
.scene-visual-effect--hearts:before,.scene-visual-effect--hearts:after{content:"";position:absolute;inset:-18% 0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='30' viewBox='0 0 34 30'%3E%3Cpath fill='%23fb7185' fill-opacity='.72' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='22' viewBox='0 0 34 30'%3E%3Cpath fill='%23f472b6' fill-opacity='.64' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='16' viewBox='0 0 34 30'%3E%3Cpath fill='%23fecdd3' fill-opacity='.78' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E");background-repeat:repeat;background-size:150px 130px,210px 180px,270px 220px;background-position:12px 10px,82px 46px,142px 88px;opacity:.72;animation:sceneHeartsFloat 10s linear infinite}.scene-visual-effect--hearts:after{background-size:230px 190px,310px 260px,360px 300px;opacity:.42;filter:blur(.15px);animation-duration:16s;animation-delay:-6s}@keyframes sceneHeartsFloat{from{transform:translate3d(-1%,20%,0)}to{transform:translate3d(2%,-24%,0)}}
.scene-visual-effect--glow:before,.scene-visual-effect--glow:after{content:"";position:absolute;inset:-16%;background:radial-gradient(circle at 50% 48%,rgba(250,250,210,.56),transparent 18%),radial-gradient(circle at 50% 50%,rgba(96,165,250,.35),transparent 42%),radial-gradient(circle at 50% 50%,rgba(255,255,255,.24),transparent 66%);mix-blend-mode:screen;opacity:.78;animation:sceneGlowPulse 4.8s ease-in-out infinite alternate}.scene-visual-effect--glow:after{filter:blur(20px);opacity:.42;animation-duration:7s}@keyframes sceneGlowPulse{from{transform:scale(.92);opacity:.42}to{transform:scale(1.08);opacity:.88}}
.scene-visual-effect--fireflies:before,.scene-visual-effect--fireflies:after{content:"";position:absolute;inset:-10%;background-image:radial-gradient(circle,rgba(254,240,138,.95) 0 2px,rgba(250,204,21,.34) 3px,transparent 8px),radial-gradient(circle,rgba(187,247,208,.9) 0 1.5px,rgba(74,222,128,.26) 3px,transparent 7px),radial-gradient(circle,rgba(255,255,255,.85) 0 1px,transparent 4px);background-size:160px 130px,230px 190px,310px 250px;background-position:24px 22px,95px 80px,180px 120px;filter:drop-shadow(0 0 8px rgba(250,204,21,.75));opacity:.62;animation:sceneFireflies 7s ease-in-out infinite alternate}.scene-visual-effect--fireflies:after{opacity:.36;animation-duration:11s;animation-delay:-4s}@keyframes sceneFireflies{from{transform:translate3d(-3%,2%,0);opacity:.24}45%{opacity:.82}to{transform:translate3d(4%,-3%,0);opacity:.52}}
.scene-visual-effect--rain:before,.scene-visual-effect--rain:after{content:"";position:absolute;inset:-30% -10%;background-image:repeating-linear-gradient(105deg,rgba(191,219,254,0) 0 16px,rgba(191,219,254,.44) 17px 19px,rgba(191,219,254,0) 20px 34px);background-size:90px 90px;opacity:.42;transform:skewX(-14deg);animation:sceneRainFall .85s linear infinite}.scene-visual-effect--rain:after{opacity:.22;filter:blur(.7px);animation-duration:1.25s}@keyframes sceneRainFall{from{background-position:0 -90px}to{background-position:0 90px}}
.scene-visual-effect--magic:before,.scene-visual-effect--magic:after{content:"";position:absolute;inset:-12%;background:radial-gradient(circle at 20% 26%,rgba(216,180,254,.9) 0 1px,transparent 7px),radial-gradient(circle at 72% 34%,rgba(125,211,252,.86) 0 2px,transparent 8px),radial-gradient(circle at 42% 72%,rgba(244,114,182,.78) 0 1.5px,transparent 7px),conic-gradient(from 90deg at 50% 50%,transparent,rgba(168,85,247,.18),transparent,rgba(14,165,233,.16),transparent);mix-blend-mode:screen;opacity:.72;animation:sceneMagicSwirl 8s ease-in-out infinite}.scene-visual-effect--magic:after{filter:blur(8px);opacity:.34;animation-duration:12s;animation-direction:reverse}@keyframes sceneMagicSwirl{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(9deg) scale(1.08)}100%{transform:rotate(0deg) scale(1)}}
.scene-visual-effect--embers:before,.scene-visual-effect--embers:after{content:"";position:absolute;inset:-14% 0;background-image:radial-gradient(circle,rgba(251,146,60,.92) 0 2px,rgba(239,68,68,.26) 3px,transparent 8px),radial-gradient(circle,rgba(254,215,170,.82) 0 1px,transparent 5px),radial-gradient(circle,rgba(248,113,113,.78) 0 1.5px,transparent 6px);background-size:120px 150px,190px 210px,260px 260px;background-position:18px 120px,76px 180px,150px 220px;filter:drop-shadow(0 0 8px rgba(249,115,22,.7));opacity:.58;animation:sceneEmbersRise 12s linear infinite}.scene-visual-effect--embers:after{opacity:.32;filter:blur(.8px);animation-duration:18s;animation-delay:-7s}@keyframes sceneEmbersRise{from{transform:translate3d(0,18%,0)}to{transform:translate3d(4%,-26%,0)}}
.scene-visual-effect--stars:before,.scene-visual-effect--stars:after{content:"";position:absolute;inset:-8%;background-image:radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 2px),radial-gradient(circle,rgba(191,219,254,.72) 0 1px,transparent 3px),radial-gradient(circle,rgba(250,204,21,.55) 0 1.5px,transparent 4px);background-size:80px 70px,150px 130px,240px 210px;background-position:10px 18px,70px 44px,132px 92px;opacity:.64;animation:sceneStarsTwinkle 4.4s ease-in-out infinite alternate}.scene-visual-effect--stars:after{opacity:.32;filter:blur(.5px);animation-duration:7s;animation-delay:-2s}@keyframes sceneStarsTwinkle{0%{opacity:.24;transform:scale(1)}55%{opacity:.86}100%{opacity:.38;transform:scale(1.03)}}
.scene-visual-effect--blizzard:before,.scene-visual-effect--blizzard:after{content:"";position:absolute;inset:-50% -18%;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1.5px,transparent 3px),radial-gradient(circle,rgba(219,234,254,.72) 0 2px,transparent 4px);background-size:55px 55px,95px 85px;opacity:.76;transform:skewX(-14deg);animation:sceneBlizzard 4.2s linear infinite}.scene-visual-effect--blizzard:after{opacity:.42;filter:blur(1px);animation-duration:6s;animation-delay:-2s}@keyframes sceneBlizzard{from{background-position:-120px -120px;transform:translate3d(-10%,-20%,0) skewX(-14deg)}to{background-position:120px 120px;transform:translate3d(12%,22%,0) skewX(-14deg)}}
.scene-visual-effect--smoke:before,.scene-visual-effect--smoke:after{content:"";position:absolute;inset:-24%;background:radial-gradient(ellipse at 24% 70%,rgba(148,163,184,.28),transparent 34%),radial-gradient(ellipse at 56% 78%,rgba(71,85,105,.32),transparent 36%),radial-gradient(ellipse at 82% 68%,rgba(203,213,225,.18),transparent 30%);filter:blur(20px);opacity:.7;animation:sceneSmokeCurl 15s ease-in-out infinite alternate}.scene-visual-effect--smoke:after{opacity:.42;animation-duration:22s;animation-delay:-8s}@keyframes sceneSmokeCurl{from{transform:translate3d(-5%,8%,0) scale(1)}to{transform:translate3d(6%,-8%,0) scale(1.18)}}
.scene-visual-effect--storm:before{content:"";position:absolute;inset:-30% -10%;background-image:repeating-linear-gradient(105deg,rgba(147,197,253,0) 0 12px,rgba(147,197,253,.34) 13px 16px,rgba(147,197,253,0) 17px 30px);background-size:70px 80px;opacity:.5;animation:sceneRainFall .62s linear infinite}.scene-visual-effect--storm:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 46%,rgba(255,255,255,.9) 47%,rgba(147,197,253,.25) 49%,transparent 52% 100%);opacity:0;animation:sceneLightning 5.8s steps(1,end) infinite}@keyframes sceneLightning{0%,88%,94%,100%{opacity:0}89%{opacity:.85}90%{opacity:.12}92%{opacity:.62}}
.scene-visual-effect--flames:before,.scene-visual-effect--flames:after{content:"";position:absolute;inset:38% -8% -20%;background:radial-gradient(ellipse at 20% 100%,rgba(239,68,68,.62),transparent 38%),radial-gradient(ellipse at 44% 92%,rgba(249,115,22,.72),transparent 34%),radial-gradient(ellipse at 64% 100%,rgba(253,224,71,.45),transparent 28%),radial-gradient(ellipse at 84% 96%,rgba(220,38,38,.5),transparent 36%);filter:blur(8px);mix-blend-mode:screen;opacity:.72;animation:sceneFlames 2.2s ease-in-out infinite alternate}.scene-visual-effect--flames:after{opacity:.38;filter:blur(18px);animation-duration:3.6s;animation-delay:-1.4s}@keyframes sceneFlames{from{transform:translate3d(-2%,2%,0) scaleY(.94)}to{transform:translate3d(2%,-4%,0) scaleY(1.08)}}
.scene-visual-effect--bubbles:before,.scene-visual-effect--bubbles:after{content:"";position:absolute;inset:-12%;background-image:radial-gradient(circle,rgba(186,230,253,.18) 0 8px,rgba(186,230,253,.72) 9px 10px,transparent 11px),radial-gradient(circle,rgba(224,242,254,.16) 0 5px,rgba(224,242,254,.62) 6px 7px,transparent 8px);background-size:150px 160px,230px 220px;background-position:18px 130px,110px 190px;opacity:.7;animation:sceneBubblesRise 13s linear infinite}.scene-visual-effect--bubbles:after{opacity:.36;filter:blur(.4px);animation-duration:19s;animation-delay:-7s}@keyframes sceneBubblesRise{from{transform:translate3d(0,18%,0)}to{transform:translate3d(3%,-24%,0)}}
.scene-visual-effect--aurora:before,.scene-visual-effect--aurora:after{content:"";position:absolute;inset:-22%;background:conic-gradient(from 180deg at 50% 38%,transparent,rgba(34,211,238,.28),rgba(74,222,128,.22),rgba(168,85,247,.24),transparent);filter:blur(22px);mix-blend-mode:screen;opacity:.68;animation:sceneAuroraWave 11s ease-in-out infinite alternate}.scene-visual-effect--aurora:after{opacity:.38;animation-duration:17s;animation-delay:-6s}@keyframes sceneAuroraWave{from{transform:translate3d(-8%,-4%,0) rotate(-4deg) scale(1.05)}to{transform:translate3d(8%,3%,0) rotate(5deg) scale(1.18)}}
.scene-visual-effect--vignette:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,transparent 0 42%,rgba(2,6,23,.42) 72%,rgba(0,0,0,.72) 100%);opacity:.85}
.scene-visual-effect--scanlines:before,.scene-visual-effect--scanlines:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 2px 5px);opacity:.32;animation:sceneScanlines 1.2s linear infinite}.scene-visual-effect--scanlines:after{background:linear-gradient(90deg,rgba(239,68,68,.09),transparent 35%,rgba(59,130,246,.09));mix-blend-mode:screen;opacity:.5;animation:none}@keyframes sceneScanlines{from{background-position:0 0}to{background-position:0 10px}}
.scene-visual-effect--glitch:before,.scene-visual-effect--glitch:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(239,68,68,.18),transparent 22%,rgba(14,165,233,.16)),repeating-linear-gradient(0deg,transparent 0 18px,rgba(255,255,255,.14) 19px 21px,transparent 22px 42px);mix-blend-mode:screen;opacity:.36;animation:sceneGlitch 2.8s steps(2,end) infinite}.scene-visual-effect--glitch:after{background:linear-gradient(90deg,rgba(14,165,233,.16),transparent,rgba(244,63,94,.18));animation-delay:-1.3s}@keyframes sceneGlitch{0%,82%,100%{transform:translate3d(0,0,0);opacity:.18}84%{transform:translate3d(-10px,0,0);opacity:.64}86%{transform:translate3d(8px,0,0);opacity:.3}88%{transform:translate3d(0,0,0);opacity:.5}}
.scene-visual-effect--confetti:before,.scene-visual-effect--confetti:after{content:"";position:absolute;inset:-30% 0;background-image:linear-gradient(45deg,#facc15 0 6px,transparent 7px),linear-gradient(-30deg,#38bdf8 0 6px,transparent 7px),linear-gradient(20deg,#fb7185 0 6px,transparent 7px),linear-gradient(70deg,#4ade80 0 6px,transparent 7px);background-size:90px 90px,130px 130px,170px 150px,210px 190px;background-position:10px 10px,60px 40px,110px 75px,160px 120px;opacity:.58;animation:sceneConfetti 8s linear infinite}.scene-visual-effect--confetti:after{opacity:.32;animation-duration:13s;animation-delay:-5s}@keyframes sceneConfetti{from{transform:translate3d(0,-12%,0) rotate(0deg)}to{transform:translate3d(2%,24%,0) rotate(8deg)}}
.scene-visual-effect--beauty-lens{backdrop-filter:brightness(1.08) contrast(1.04) saturate(1.14) blur(.25px)}.scene-visual-effect--beauty-lens:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.16),transparent 34%),linear-gradient(180deg,rgba(244,114,182,.08),rgba(125,211,252,.08));mix-blend-mode:screen;opacity:.7}
.scene-visual-effect--dream-lens{backdrop-filter:brightness(1.08) saturate(1.28) blur(.7px)}.scene-visual-effect--dream-lens:before,.scene-visual-effect--dream-lens:after{content:"";position:absolute;inset:-16%;background:radial-gradient(circle at 24% 30%,rgba(244,114,182,.28),transparent 26%),radial-gradient(circle at 78% 34%,rgba(96,165,250,.24),transparent 30%),radial-gradient(circle at 52% 78%,rgba(250,204,21,.16),transparent 30%);mix-blend-mode:screen;opacity:.62;animation:sceneDreamLens 9s ease-in-out infinite alternate}.scene-visual-effect--dream-lens:after{filter:blur(16px);opacity:.36;animation-duration:14s;animation-delay:-5s}@keyframes sceneDreamLens{from{transform:translate3d(-3%,-2%,0) scale(1)}to{transform:translate3d(4%,3%,0) scale(1.08)}}
.scene-visual-effect--neon-lens{backdrop-filter:saturate(1.55) contrast(1.16) brightness(1.04)}.scene-visual-effect--neon-lens:before,.scene-visual-effect--neon-lens:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(236,72,153,.22),transparent 34%,rgba(34,211,238,.22)),radial-gradient(circle at 50% 50%,transparent 0 52%,rgba(14,165,233,.24) 78%,rgba(236,72,153,.26));mix-blend-mode:screen;opacity:.72}.scene-visual-effect--neon-lens:after{filter:blur(14px);opacity:.38}
.scene-visual-effect--night-vision{backdrop-filter:grayscale(1) contrast(1.42) brightness(.95) sepia(.25) hue-rotate(68deg) saturate(2.8)}.scene-visual-effect--night-vision:before,.scene-visual-effect--night-vision:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(74,222,128,.2),transparent 42%,rgba(0,0,0,.42) 100%),repeating-linear-gradient(0deg,rgba(187,247,208,.08) 0 1px,transparent 2px 5px);mix-blend-mode:screen;opacity:.72;animation:sceneScanlines 1.4s linear infinite}.scene-visual-effect--night-vision:after{background:radial-gradient(circle at 50% 50%,transparent 0 45%,rgba(0,0,0,.58) 82%,rgba(0,0,0,.82));animation:none;mix-blend-mode:multiply}
.scene-visual-effect--thermal{backdrop-filter:saturate(2.2) contrast(1.45) brightness(1.05)}.scene-visual-effect--thermal:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(14,165,233,.34),rgba(34,197,94,.22) 30%,rgba(250,204,21,.26) 52%,rgba(249,115,22,.3) 70%,rgba(239,68,68,.34)),radial-gradient(circle at 55% 42%,rgba(255,255,255,.24),transparent 22%);mix-blend-mode:color;opacity:.72}
.scene-visual-effect--comic-lens{backdrop-filter:contrast(1.34) saturate(1.55) brightness(1.03)}.scene-visual-effect--comic-lens:before,.scene-visual-effect--comic-lens:after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.18) 0 1px,transparent 1.8px);background-size:7px 7px;mix-blend-mode:multiply;opacity:.46}.scene-visual-effect--comic-lens:after{background:linear-gradient(90deg,rgba(250,204,21,.12),transparent,rgba(239,68,68,.10));mix-blend-mode:overlay;opacity:.7}
.scene-visual-effect--noir-lens{backdrop-filter:grayscale(1) contrast(1.35) brightness(.92)}.scene-visual-effect--noir-lens:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 44%,transparent 0 46%,rgba(0,0,0,.58) 86%,rgba(0,0,0,.82)),linear-gradient(180deg,rgba(255,255,255,.08),transparent 45%,rgba(0,0,0,.22));opacity:.9}
.scene-inline-viewer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000;pointer-events:auto}
.scene-inline-viewer__backdrop{position:absolute;inset:0;background:rgba(2,6,23,.62)}
.scene-inline-viewer__card{position:relative;z-index:1;max-width:min(86vw,760px);max-height:82%;display:flex;flex-direction:column;gap:12px;align-items:center}
.scene-inline-viewer__image{width:auto;max-width:min(82vw,720px);height:auto;max-height:68vh;object-fit:contain;border-radius:18px;background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.35);display:block}
.scene-inline-viewer__name{align-self:stretch;padding:12px 16px;border-radius:16px;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.08);font-weight:700;text-align:left;color:#fff}
.inventory-actions{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
button,.button-like{border:1px solid transparent;background:linear-gradient(180deg, #4f8cff 0%, #2f6fe4 100%);color:white;padding:11px 16px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;text-décoration:none;box-shadow:0 10px 24px rgba(47,111,228,.22)}
.secondary-button{background:rgba(18,31,56,.95)!important;border-color:rgba(148,163,184,.16)!important;box-shadow:none!important}
.danger-button{background:linear-gradient(180deg, #d14b4b 0%, #a92c2c 100%)!important;color:#fff;border-color:rgba(255,255,255,.06)!important;box-shadow:0 12px 24px rgba(169,44,44,.24)!important}
.badge-line{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(37,99,235,.15);border:1px solid rgba(96,165,250,.3);color:#bfdbfe;margin-bottom:12px}
.dialogue-box{line-height:1.7;background:rgba(12,21,39,.92);border-radius:18px;padding:14px;border:1px solid rgba(148,163,184,.16)}
.small-note{color:#9fb0cc;font-size:13px;line-height:1.55}
.panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px}
.panel-head h3{margin:0}
.inventory-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.inventory-tile{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;border:1px solid rgba(148,163,184,.16);padding:10px;background:#1e293b;border-radius:16px;color:#fff}
.inventory-tile.selected{outline:2px solid #60a5fa;background:#1d4ed8}
.inventory-thumb{width:72px;height:72px;border-radius:14px;background:#0f172a;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:28px}
.inventory-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:20px;z-index:40}
.overlay-card{width:min(92vw,980px);max-height:90vh;overflow:auto;border-radius:24px;padding:18px;background:linear-gradient(180deg, rgba(12,20,37,.98) 0%, rgba(8,16,30,.98) 100%);border:1px solid rgba(148,163,184,.16);box-shadow:0 20px 60px rgba(0,0,0,.34)}
.ending-card{width:min(92vw,560px);display:grid;gap:14px;text-align:center}
.ending-card h2{margin:0;font-size:30px}
.ending-card p{margin:0;color:#e5edf8;line-height:1.6}
.ending-badge{justify-self:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.28);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#dbeafe;background:rgba(15,23,42,.76)}
.ending-card-good{border-color:rgba(34,197,94,.36);box-shadow:0 20px 60px rgba(0,0,0,.34),0 0 32px rgba(34,197,94,.12)}
.ending-card-bad{border-color:rgba(248,113,113,.42);box-shadow:0 20px 60px rgba(0,0,0,.34),0 0 32px rgba(248,113,113,.13)}
.ending-card-secret{border-color:rgba(168,85,247,.5);box-shadow:0 20px 60px rgba(0,0,0,.34),0 0 38px rgba(168,85,247,.16)}
.overlay-media{width:100%;max-height:62vh;object-fit:contain;display:block;border-radius:16px;background:#020617}
.narration{font-size:18px;line-height:1.8}
.anime2d-player{position:relative;width:100%;aspect-ratio:16 / 10;overflow:hidden;border-radius:16px;background:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(180deg,#101827 0%,#182033 62%,#273040 63%,#111827 100%);background-size:40px 40px,40px 40px,auto}
.anime2d-player-layer{position:absolute;transform:translate(-50%,-50%)}
.anime2d-player-layer img{width:100%;height:100%;object-fit:contain;display:block}
.anime2d-player-narration{position:absolute;left:24px;right:24px;bottom:22px;z-index:100;margin:0;padding:13px 16px;border-radius:12px;background:rgba(2,6,23,.74);color:#fff;font-size:18px;line-height:1.35;font-weight:800;pointer-events:none}
.anime2d-player-empty{position:absolute;inset:0;display:grid;place-items:center;margin:0;color:#bfdbfe;font-weight:800;text-align:center;padding:24px}
@keyframes anime2dPlayerFade{from{opacity:0;filter:blur(2px)}to{opacity:1;filter:blur(0)}}
.anime2d-embedded{position:absolute;inset:0;display:block;overflow:hidden;pointer-events:none;background:transparent;line-height:1}
.anime2d-embedded-layer{position:absolute;display:block;transform:translate(-50%,-50%)}
.anime2d-embedded-animated{display:block;width:100%;height:100%;transform-origin:center bottom}
.anime2d-embedded-animated img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 8px 10px rgba(0,0,0,.28))}
.anime2d-embedded-empty{position:absolute;inset:0;display:grid;place-items:center;color:#bfdbfe;font-size:12px;font-weight:800}
.anime2d-preset-idle-breathe{animation-name:anime2dBreathe;animation-timing-function:ease-in-out}.anime2d-preset-float{animation-name:anime2dFloat;animation-timing-function:ease-in-out}.anime2d-preset-shake{animation-name:anime2dShake;animation-timing-function:linear}.anime2d-preset-blink{animation-name:anime2dBlink;animation-timing-function:step-end}.anime2d-preset-reveal{animation-name:anime2dReveal;animation-timing-function:cubic-bezier(.2,.8,.2,1)}.anime2d-preset-talk{animation-name:anime2dTalk;animation-timing-function:ease-in-out}.anime2d-preset-glow,.anime2d-preset-embers{animation-name:anime2dGlow;animation-timing-function:ease-in-out}.anime2d-preset-look-around{animation-name:anime2dLook;animation-timing-function:ease-in-out}
@keyframes anime2dBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035,.965)}}@keyframes anime2dFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7%)}}@keyframes anime2dShake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-3%) rotate(-1.2deg)}75%{transform:translateX(3%) rotate(1.2deg)}}@keyframes anime2dBlink{0%,100%{opacity:1}50%{opacity:.35}}@keyframes anime2dReveal{0%{opacity:0;transform:scale(.88)}100%{opacity:1;transform:scale(1)}}@keyframes anime2dTalk{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-1.5%) scale(1.018)}70%{transform:translateY(1%) scale(.995)}}@keyframes anime2dGlow{0%,100%{filter:drop-shadow(0 0 0 rgba(56,189,248,0))}50%{filter:drop-shadow(0 0 16px rgba(56,189,248,.72))}}@keyframes anime2dLook{0%,100%{transform:rotate(0)}35%{transform:rotate(-2.2deg)}70%{transform:rotate(2.2deg)}}
.player-scene-object-not-clickable{cursor:default;pointer-events:none}
.color-picker-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:10px}
.color-picker-button{height:52px;border-radius:14px;border:2px solid rgba(255,255,255,.18)!important}
.color-attempt-row{display:flex;gap:10px;flex-wrap:wrap;min-height:42px;align-items:center;margin-top:6px}
.color-chip{width:34px;height:34px;border-radius:999px;border:2px solid rgba(255,255,255,.28);display:inline-block}
.enigma-grid{display:grid;gap:8px;margin-top:12px}
.puzzle-piece,.puzzle-slot{aspect-ratio:1 / 1;border-radius:14px;border:1px solid rgba(255,255,255,.12);background-color:#0b1324;background-repeat:no-repeat;background-origin:border-box;overflow:hidden}
.puzzle-piece.selected{outline:3px solid #60a5fa;transform:scale(.97)}
.puzzle-piece.static{display:block;width:100%;height:100%;pointer-events:none}
.puzzle-slot{padding:0;display:flex;align-items:center;justify-content:center;background:#020617}
.slot-index{color:#64748b;font-weight:700}
.dragdrop-layout{display:grid;grid-template-columns:2fr 1fr;gap:18px;align-items:start}
.bank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.simon-grid .simon-pad{min-height:110px;font-size:28px;font-weight:800;color:rgba(255,255,255,.85)}
.simon-pad.active{box-shadow:0 0 0 4px rgba(255,255,255,.38),0 0 36px rgba(255,255,255,.45);transform:scale(1.04)}
@media (max-width:1200px){.layout{grid-template-columns:1fr}}
@media (max-width:900px){.app-shell{padding:18px}.topbar{flex-direction:column}.topbar h1{font-size:32px}.dragdrop-layout{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="app-shell">
  <div class="topbar" hidden>
    <div class="brand-block">
      <div class="status-badge">🎮 Export prêt à jouer</div>
      <h1>${safeTitle}</h1>
      <p>Version standalone générée depuis le preview du builder.</p>
    </div>
    <div class="topbar-actions">
      <button class="fullscreen-toggle" type="button">Sauvegarder</button>
      <button class="fullscreen-toggle" type="button">Charger</button>
      <button class="fullscreen-toggle" type="button">Effacer sauvegarde</button>
      <button class="fullscreen-toggle" type="button">Plein écran</button>
      <span id="save-status" class="small-note" style="align-self:center"></span>
    </div>
  </div>
  <div id="game-root"></div>
</div>

<script>
const project = ${serializedProject};
const root = document.getElementById('game-root');
const GAME_TITLE = String(project?.title || 'Escape game').trim() || 'Escape game';
const PLAYER_BUTTON_STYLE = ['modern', 'parchment', 'arcane', 'stone', 'neon', 'blood'].includes(project?.ui?.buttonStyle) ? project.ui.buttonStyle : 'modern';
const PLAYER_BUTTON_FONT = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.buttonFont) ? project.ui.buttonFont : 'system';
const PLAYER_NARRATION_FONT = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.narrationFont) ? project.ui.narrationFont : 'system';
const PLAYER_NARRATION_BACKGROUND = project?.ui?.narrationBackground || 'rgba(2, 6, 23, .62)';
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
    narrationCollapsed: false,
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

const SAVE_STORAGE_KEY = 'escapeGameSave:' + String(project?.id || project?.title || 'default');

function getSerializableState() {
  return {
    playSceneId: state.playSceneId,
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    visitedSceneIds: Array.isArray(state.visitedSceneIds) ? state.visitedSceneIds : [],
    storyVariables: state.storyVariables && typeof state.storyVariables === 'object' ? state.storyVariables : {},
    adventureJournalEntries: Array.isArray(state.adventureJournalEntries) ? state.adventureJournalEntries : [],
    dialogue: state.dialogue || '',
    viewerImage: state.viewerImage || null,
    playerLives: Number.isFinite(Number(state.playerLives)) ? Number(state.playerLives) : 3,
    playingCinematicId: state.playingCinematicId || null,
    playingSlideIndex: Number(state.playingSlideIndex) || 0,
    selectedInventoryIds: Array.isArray(state.selectedInventoryIds) ? state.selectedInventoryIds : [],
    completedHotspotIds: Array.isArray(state.completedHotspotIds) ? state.completedHotspotIds : [],
    solvedEnigmaIds: Array.isArray(state.solvedEnigmaIds) ? state.solvedEnigmaIds : [],
    chosenConversationReplyIds: Array.isArray(state.chosenConversationReplyIds) ? state.chosenConversationReplyIds : [],
    askedConversationNodeIds: Array.isArray(state.askedConversationNodeIds) ? state.askedConversationNodeIds : [],
    hiddenConversationReplyIds: Array.isArray(state.hiddenConversationReplyIds) ? state.hiddenConversationReplyIds : [],
    launchedCinematicIds: Array.isArray(state.launchedCinematicIds) ? state.launchedCinematicIds : [],
    completedCombinationIds: Array.isArray(state.completedCombinationIds) ? state.completedCombinationIds : [],
    usedLogicRuleIds: Array.isArray(state.usedLogicRuleIds) ? state.usedLogicRuleIds : [],
    removedSceneObjectIds: Array.isArray(state.removedSceneObjectIds) ? state.removedSceneObjectIds : [],
    revealedSceneObjectIds: Array.isArray(state.revealedSceneObjectIds) ? state.revealedSceneObjectIds : [],
    sceneObjectTextOverrides: state.sceneObjectTextOverrides && typeof state.sceneObjectTextOverrides === 'object' ? state.sceneObjectTextOverrides : {},
    activeEnding: state.activeEnding && typeof state.activeEnding === 'object' ? state.activeEnding : null,
    choiceEffectNotices: Array.isArray(state.choiceEffectNotices) ? state.choiceEffectNotices : [],
  };
}

function saveGame(manual = false) {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
    updateSaveStatus(manual ? 'Sauvegardé.' : '');
    if (manual) {
      state.dialogue = 'Partie sauvegardée.';
      render(false);
    }
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde', error);
    updateSaveStatus('Sauvegarde impossible.');
    if (manual) {
      state.dialogue = 'Impossible dé sauvegarder la partie.';
      render(false);
    }
    return false;
  }
}

function loadGame(manual = false) {
  try {
    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!rawSave) {
      updateSaveStatus('Aucune sauvegarde.');
      if (manual) {
        state.dialogue = 'Aucune sauvegarde trouvée.';
        render(false);
      }
      return false;
    }

    const savedState = JSON.parse(rawSave);
    stopSceneTimer();
    expiredSceneTimerKey = '';
    Object.assign(state, DEFAULT_STATE(), savedState, {
      inventory: Array.isArray(savedState.inventory) ? savedState.inventory : [],
      visitedSceneIds: Array.isArray(savedState.visitedSceneIds) ? savedState.visitedSceneIds : [],
      storyVariables: { ...DEFAULT_STATE().storyVariables, ...(savedState.storyVariables && typeof savedState.storyVariables === 'object' ? savedState.storyVariables : {}) },
      adventureJournalEntries: Array.isArray(savedState.adventureJournalEntries) ? savedState.adventureJournalEntries : [],
      playerLives: Number.isFinite(Number(savedState.playerLives)) ? Math.max(0, Number(savedState.playerLives)) : 3,
      selectedInventoryIds: Array.isArray(savedState.selectedInventoryIds) ? savedState.selectedInventoryIds : [],
      completedHotspotIds: Array.isArray(savedState.completedHotspotIds) ? savedState.completedHotspotIds : [],
      solvedEnigmaIds: Array.isArray(savedState.solvedEnigmaIds) ? savedState.solvedEnigmaIds : [],
      chosenConversationReplyIds: Array.isArray(savedState.chosenConversationReplyIds) ? savedState.chosenConversationReplyIds : [],
      askedConversationNodeIds: Array.isArray(savedState.askedConversationNodeIds) ? savedState.askedConversationNodeIds : [],
      hiddenConversationReplyIds: Array.isArray(savedState.hiddenConversationReplyIds) ? savedState.hiddenConversationReplyIds : [],
      launchedCinematicIds: Array.isArray(savedState.launchedCinematicIds) ? savedState.launchedCinematicIds : [],
      completedCombinationIds: Array.isArray(savedState.completedCombinationIds) ? savedState.completedCombinationIds : [],
      usedLogicRuleIds: Array.isArray(savedState.usedLogicRuleIds) ? savedState.usedLogicRuleIds : [],
      removedSceneObjectIds: Array.isArray(savedState.removedSceneObjectIds) ? savedState.removedSceneObjectIds : [],
      revealedSceneObjectIds: Array.isArray(savedState.revealedSceneObjectIds) ? savedState.revealedSceneObjectIds : [],
      sceneObjectTextOverrides: savedState.sceneObjectTextOverrides && typeof savedState.sceneObjectTextOverrides === 'object' ? savedState.sceneObjectTextOverrides : {},
      inventoryDrawerOpen: false,
      activeEnigma: null,
      activeEnding: savedState.activeEnding && typeof savedState.activeEnding === 'object' ? savedState.activeEnding : null,
      choiceEffectNotices: Array.isArray(savedState.choiceEffectNotices) ? savedState.choiceEffectNotices : [],
      enigmaCodeInput: '',
      enigmaColorAttempt: [],
      enigmaPuzzleOrder: [],
      enigmaPuzzleSelectedIndex: null,
      enigmaDragBank: [],
      enigmaDragSlots: [],
      enigmaDraggedPiece: null,
      enigmaRotationAngles: [],
      sceneTimerRemaining: 0,
      simonPlaybackIndex: -1,
      simonPlayerTurn: false,
    });
    updateSaveStatus('Chargé.');

    if (manual) {
      state.dialogue = 'Sauvegarde chargée.';
    }

    beginActPreload(getPlayScene());
    render(false);
    return true;
  } catch (error) {
    console.error('Erreur chargement sauvegarde', error);
    updateSaveStatus('Chargement impossible.');
    if (manual) {
      state.dialogue = 'Impossible dé charger cette sauvegarde.';
      render(false);
    }
    return false;
  }
}

function deleteSave(manual = false) {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    localStorage.removeItem(SAVE_STORAGE_KEY + ':name');
    localStorage.removeItem(SAVE_STORAGE_KEY + ':lastPayload');
    updateSaveStatus(manual ? 'Sauvegarde supprimée.' : '');
    if (manual) state.dialogue = 'Sauvegarde supprimée.';
  } catch (error) {
    console.error('Erreur suppression sauvegarde', error);
    updateSaveStatus('Suppression impossible.');
    if (manual) state.dialogue = 'Impossible dé supprimer la sauvegarde.';
  }
  if (manual) render(false);
}

function clearGameSave() {
  deleteSave(true);
}

function buildSavePayload(saveName = '') {
  return {
    type: 'escape-game-save',
    version: 1,
    name: String(saveName || '').trim() || 'Sauvegarde',
    projectId: String(project?.id || ''),
    projectTitle: String(project?.title || ''),
    exportedAt: new Date().toISOString(),
    state: getSerializableState(),
  };
}

function safeSaveFilename(value = 'sauvegarde') {
  return String(value || 'sauvegarde')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'sauvegarde';
}

function downloadSaveFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeSaveFilename(payload.name) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSaveAsJson() {
  const defaultName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const saveName = window.prompt('Nom de la sauvegarde · exporter :', defaultName);
  if (saveName === null) return;

  const payload = buildSavePayload(saveName);
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', payload.name);
  } catch (error) {
    console.warn('Nom non enregistré localement', error);
  }

  downloadSaveFile(payload);
  state.dialogue = 'Sauvegarde exportée : ' + payload.name + '.';
  render(false);
}

function renameCurrentSave() {
  const currentName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const nextName = window.prompt('Nouveau nom de la sauvegarde :', currentName);
  if (nextName === null) return;

  const cleanName = String(nextName).trim() || 'Sauvegarde';
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', cleanName);

    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (rawSave) {
      const payload = buildSavePayload(cleanName);
      localStorage.setItem(SAVE_STORAGE_KEY + ':lastPayload', JSON.stringify(payload));
    }

    state.dialogue = 'Sauvegarde renommée : ' + cleanName + '.';
  } catch (error) {
    console.error('Erreur renommage sauvegarde', error);
    state.dialogue = 'Impossible dé renommer la sauvegarde localement.';
  }
  render(false);
}

function normalizeImportedSave(data) {
  if (!data || typeof data !== 'object') return null;

  // Format v5 : fichier complet avec métadonnées.
  if (data.type === 'escape-game-save' && data.state && typeof data.state === 'object') {
    return {
      name: String(data.name || 'Sauvegarde importée'),
      state: data.state,
    };
  }

  // Compatibilité : si l'utilisateur importe directement un ancien state.
  if (data.playSceneId || Array.isArray(data.inventory) || Array.isArray(data.completedHotspotIds)) {
    return {
      name: 'Sauvegarde importée',
      state: data,
    };
  }

  return null;
}

function importSaveFromJsonFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      const imported = normalizeImportedSave(data);

      if (!imported) {
        state.dialogue = 'Ce fichier ne ressemble pas · une sauvegarde valide.';
        render(false);
        return;
      }

      const importedState = imported.state || {};
      stopSceneTimer();
      expiredSceneTimerKey = '';
      Object.assign(state, DEFAULT_STATE(), importedState);

      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
        localStorage.setItem(SAVE_STORAGE_KEY + ':name', imported.name || 'Sauvegarde importée');
      } catch (storageError) {
        console.warn('Sauvegarde locale impossible après import', storageError);
      }

      state.dialogue = 'Sauvegarde importée : ' + (imported.name || 'Sauvegarde importée') + '.';
      render(false);
    } catch (error) {
      console.error('Erreur import sauvegarde', error);
      state.dialogue = 'Impossible dé lire ce fichier JSON.';
      render(false);
    }
  };

  reader.onerror = () => {
    state.dialogue = 'Impossible d’ouvrir ce fichier.';
    render(false);
  };

  reader.readAsText(file);
}

loadGame(false);
const sceneAudio = new Audio();
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
let simonTimeouts = [];

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenUi() {
  document.body.classList.toggle('game-fullscreen', isFullscreenActive());
  const button = root.querySelector('#fullscreen-toggle');
  if (button) {
    button.textContent = isFullscreenActive() ? 'Quitter le plein écran' : 'Plein écran';
  }
}

function setSceneAspectFromImage(image) {
  if (!image?.naturalWidth || !image?.naturalHeight || !image.parentElement) return;
  image.parentElement.style.setProperty('--scene-aspect', String(image.naturalWidth / image.naturalHeight));
}

function getVisualEffectZoneZIndex(layer) {
  if (layer === 'front') return 26;
  if (layer === 'between') return 19;
  return 13;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    document.body.classList.toggle('game-fullscreen');
    syncFullscreenUi();
  }
}

document.addEventListener('fullscreenchange', syncFullscreenUi);

function safeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value = '') {
  return safeHtml(String(value).replace(/[\\x00-\\x1f\\x7f]/g, ''))
    .replace(/'/g, '&#39;')
    .replaceAll(String.fromCharCode(96), '&#96;');
}

function isInternalAssetUrl(value = '') {
  return /^(?:\\.\\/)?assets\\/[a-z0-9._~!$&()*+,;=:@%\\/-]+$/i.test(value);
}

function isAllowedDataMediaUrl(raw = '', kind = 'image') {
  return kind === 'image' && raw.toLowerCase().startsWith('data:image/');
}

function safeMediaUrl(value = '', kind = 'image') {
  const raw = String(value || '').trim();
  if (!raw || /[\\x00-\\x1f\\x7f]/.test(raw)) return '';
  if (isInternalAssetUrl(raw)) return raw;
  if (isAllowedDataMediaUrl(raw, kind)) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function escapeMediaAttr(value = '', kind = 'image') {
  return escapeAttr(safeMediaUrl(value, kind));
}

function cssMediaUrl(value = '', kind = 'image') {
  const url = safeMediaUrl(value, kind);
  return url ? 'url(&quot;' + escapeAttr(url) + '&quot;)' : 'none';
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function getElementShapeCorners(entry = {}) {
  const corners = entry.shapeCorners || {};
  return {
    nw: { x: Number.isFinite(Number(corners.nw?.x)) ? Number(corners.nw.x) : 0, y: Number.isFinite(Number(corners.nw?.y)) ? Number(corners.nw.y) : 0 },
    ne: { x: Number.isFinite(Number(corners.ne?.x)) ? Number(corners.ne.x) : 100, y: Number.isFinite(Number(corners.ne?.y)) ? Number(corners.ne.y) : 0 },
    se: { x: Number.isFinite(Number(corners.se?.x)) ? Number(corners.se.x) : 100, y: Number.isFinite(Number(corners.se?.y)) ? Number(corners.se.y) : 100 },
    sw: { x: Number.isFinite(Number(corners.sw?.x)) ? Number(corners.sw.x) : 0, y: Number.isFinite(Number(corners.sw?.y)) ? Number(corners.sw.y) : 100 },
  };
}

function getElementShapeType(entry = {}) {
  if (['rectangle', 'ellipse', 'free'].includes(entry.shapeType)) return entry.shapeType;
  return (Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) || entry.shapeCorners ? 'free' : 'rectangle';
}

function getElementShapePoints(entry = {}) {
  if (Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) {
    return entry.shapePoints.map((point) => ({
      x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 50,
      y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 50,
    }));
  }
  const corners = getElementShapeCorners(entry);
  return [corners.nw, corners.ne, corners.se, corners.sw];
}

function getElementShapeStyle(entry = {}) {
  const shapeType = getElementShapeType(entry);
  if (shapeType === 'ellipse') return 'clip-path:ellipse(50% 50% at 50% 50%);';
  if (shapeType !== 'free') return '';
  const points = getElementShapePoints(entry);
  return 'clip-path:polygon(' + points.map((point) => (
    clampPercent(point.x) + '% ' + clampPercent(point.y) + '%'
  )).join(',') + ');';
}

function isPointInsidePolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 0.0001) + currentPoint.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointerInsideElementShape(event, entry, element) {
  const shapeType = getElementShapeType(entry);
  if (shapeType === 'rectangle') return true;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return true;
  const point = {
    x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((event.clientY - rect.top) / rect.height) * 100),
  };
  if (shapeType === 'ellipse') {
    const x = (point.x - 50) / 50;
    const y = (point.y - 50) / 50;
    return (x * x + y * y) <= 1;
  }
  return isPointInsidePolygon(point, getElementShapePoints(entry));
}

${standaloneGameEngineScript}

function makePieceStyle(imageData, rows, cols, pieceIndex, rotation = 0) {
  const row = Math.floor(pieceIndex / cols);
  const col = pieceIndex % cols;
  return [
    'background-image:' + cssMediaUrl(imageData, 'image'),
    'background-size:' + (cols * 100) + '% ' + (rows * 100) + '%',
    'background-position:' + (cols === 1 ? 0 : (col / (cols - 1)) * 100) + '% ' + (rows === 1 ? 0 : (row / (rows - 1)) * 100) + '%',
    'transform:rotate(' + rotation + 'deg)',
  ].join(';');
}

function getProjectItem(id) {
  return project.items.find((item) => item.id === id) || null;
}

function findAssetById(assetId) {
  return (project.assets || []).find((asset) => asset.id === assetId) || null;
}

function resolveAssetUrl(assetId, fallbackUrl = '', kind = 'image') {
  return safeMediaUrl(findAssetById(assetId)?.url, kind) || safeMediaUrl(fallbackUrl, kind);
}

function resolveAnime2dLayerSrc(layer) {
  if (!layer) return '';
  const rawSrc = layer.src || layer.imageData || layer.layer?.src || layer.layer?.imageData || '';
  return resolveAssetUrl(layer.assetId || layer.imageId || layer.srcId || (findAssetById(rawSrc) ? rawSrc : ''), rawSrc);
}

function getItemById(id) {
  return getProjectItem(id);
}

function getProjectScene(id) {
  return project.scenes.find((scene) => scene.id === id) || null;
}

function getSceneById(id) {
  return getProjectScene(id);
}

function getActById(id) {
  return (project.acts || []).find((act) => act.id === id) || null;
}

function getSceneLabel(id) {
  const scene = getSceneById(id);
  if (!scene) return 'Aucune scène';
  const act = getActById(scene.actId);
  return (act?.name ? act.name + ' · ' : '') + (scene.parentSceneId ? 'Sous-scène · ' : 'Scène · ') + scene.name;
}

function getProjectCinematic(id) {
  return (project.cinematics || []).find((entry) => entry.id === id) || null;
}

function getCinematicById(id) {
  return getProjectCinematic(id);
}

function getProjectEnigma(id) {
  return (project.enigmas || []).find((entry) => entry.id === id) || null;
}

function getEnigmaById(id) {
  return getProjectEnigma(id);
}

function getCombinationContext() {
  return {
    inventory: state.inventory,
    solvedEnigmaIds: state.solvedEnigmaIds,
    completedHotspotIds: state.completedHotspotIds,
    completedCombinationIds: state.completedCombinationIds,
    launchedCinematicIds: state.launchedCinematicIds,
  };
}

function getCombinationForItems(firstId, secondId) {
  if (!firstId || !secondId) return null;
  return combineItems(firstId, secondId, project.combinations, getCombinationContext());
}

function getPlayScene() {
  return getSceneById(state.playSceneId) || project.scenes[0] || null;
}

function getCurrentCinematic() {
  return state.playingCinematicId ? getCinematicById(state.playingCinematicId) : null;
}

function getCurrentSlide() {
  const cinematic = getCurrentCinematic();
  return cinematic?.slides?.[state.playingSlideIndex] || null;
}

function getAnime2dSpec(cinematic) {
  const stepSpec = (cinematic?.steps || []).find((step) => step.type === 'anime2d' && step.spec)?.spec || null;
  return createAnime2dPreviewModel(cinematic?.anime2dSpec || stepSpec);
}

function getAnime2dTimelineMarkers(model) {
  return [...new Set([
    0,
    ...model.steps.flatMap((step) => [
      Number(step.at || 0),
      Number(step.at || 0) + Math.max(0, Number(step.duration || 0)),
    ]),
    model.duration,
  ])]
    .filter((marker) => marker >= 0 && marker <= model.duration)
    .sort((a, b) => a - b);
}

function renderAnime2dEmbedded(spec, time = 0) {
  const model = createAnime2dPreviewModel(spec);
  const { layers } = model;
  const frameTime = model.duration > 0 ? time % model.duration : 0;
  const { visibleLayers } = createAnime2dPreviewFrame(model, frameTime);
  if (!layers.length) return '<span class="anime2d-embedded"><span class="anime2d-embedded-empty">JSON 2D</span></span>';
  return '<span class="anime2d-embedded">'
    + visibleLayers.map((layer) => '<span class="anime2d-embedded-layer" style="left:' + safeHtml(layer.x || 50) + '%;top:' + safeHtml(layer.y || 50) + '%;width:' + safeHtml(layer.width || 28) + '%;height:' + safeHtml(layer.height || ((layer.width || 28) * 1.6)) + '%;opacity:' + safeHtml((Number(layer.opacity || 100) / 100).toFixed(3)) + ';z-index:' + safeHtml(layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2) + '">'
      + '<span class="anime2d-embedded-animated anime2d-preset-' + safeHtml(layer.preset || 'none') + '" style="animation-duration:' + safeHtml(layer.duration || 1000) + 'ms;animation-delay:' + safeHtml(layer.delay || 0) + 'ms;animation-iteration-count:' + (layer.loop === false ? '1' : 'infinite') + '">'
      + (resolveAnime2dLayerSrc(layer) ? '<img src="' + escapeMediaAttr(resolveAnime2dLayerSrc(layer), 'image') + '" alt="' + escapeAttr(layer.name || '') + '" />' : '')
      + '</span></span>').join('')
    + '</span>';
}

function ensureAnime2dStarted(cinematic) {
  if (!cinematic) return;
  if (anime2dActiveCinematicId !== cinematic.id) {
    anime2dActiveCinematicId = cinematic.id;
    anime2dStartedAt = Date.now();
  }
}

function clearAnime2dTimer() {
  if (anime2dTimer) {
    clearTimeout(anime2dTimer);
    anime2dTimer = null;
  }
}

function getAnime2dElapsed(cinematic) {
  ensureAnime2dStarted(cinematic);
  return Math.max(0, (Date.now() - anime2dStartedAt) / 1000);
}

function ensureSceneAnime2dStarted(scene) {
  if (!scene) return;
  if (sceneAnime2dActiveSceneId !== scene.id) {
    sceneAnime2dActiveSceneId = scene.id;
    sceneAnime2dStartedAt = Date.now();
  }
}

function getSceneAnime2dElapsed(scene) {
  ensureSceneAnime2dStarted(scene);
  return Math.max(0, (Date.now() - sceneAnime2dStartedAt) / 1000);
}

function getNextAnime2dModelRenderDelay(model, elapsed, loop = true) {
  if (!model.steps.some((step) => isAnime2dImageStep(step) || String(step.narration || '').trim())) return null;
  const time = loop ? elapsed % model.duration : Math.min(model.duration, elapsed);
  if (!loop && time >= model.duration) return null;
  const nextMarker = getAnime2dTimelineMarkers(model).find((marker) => marker > time);
  const secondsUntilNextMarker = nextMarker === undefined ? model.duration - time : nextMarker - time;
  return Math.max(16, Math.round(secondsUntilNextMarker * 1000));
}

function getNextSceneAnime2dRenderDelay(scene) {
  if (!scene || getCurrentCinematic()) return null;
  const animeObjects = (scene.sceneObjects || []).filter((obj) => (
    !state.removedSceneObjectIds.includes(obj.id)
    && (!obj.isHidden || state.revealedSceneObjectIds.includes(obj.id))
    && !obj.isInvisible
    && obj.anime2dSpec
  ));
  if (!animeObjects.length) return null;
  const elapsed = getSceneAnime2dElapsed(scene);
  const delays = animeObjects
    .map((obj) => getNextAnime2dModelRenderDelay(createAnime2dPreviewModel(obj.anime2dSpec), elapsed, true))
    .filter((delay) => delay !== null);
  return delays.length ? Math.min(...delays) : null;
}

function getNextAnime2dRenderDelay(cinematic) {
  const { steps, duration } = getAnime2dSpec(cinematic);
  const elapsed = getAnime2dElapsed(cinematic);
  if (elapsed >= duration) return 0;
  const boundaries = [duration];
  steps.forEach((step) => {
    const start = Number(step.at || 0);
    const end = start + Math.max(0, Number(step.duration || 0));
    if (start > elapsed) boundaries.push(start);
    if (end > elapsed) boundaries.push(end);
  });
  const nextBoundary = Math.min(...boundaries.filter((value) => value > elapsed));
  return Math.max(16, Math.round((nextBoundary - elapsed) * 1000));
}

function getFirstSceneForAct(actId) {
  if (!actId) return null;
  const actScenes = project.scenes.filter((scene) => scene.actId === actId);
  if (!actScenes.length) return null;
  return actScenes.find((scene) => !scene.parentSceneId) || actScenes[0];
}

function isPreloadableUrl(value) {
  return typeof value === 'string' && value.trim() && !value.startsWith('#');
}

function addPreloadUrl(set, value) {
  if (isPreloadableUrl(value)) set.add(value);
}

function collectSceneMediaUrls(scene, imageUrls, audioUrls) {
  if (!scene) return;
  addPreloadUrl(imageUrls, resolveAssetUrl(scene.backgroundId, scene.backgroundData));
  addPreloadUrl(audioUrls, resolveAssetUrl(scene.musicId, scene.musicData, 'audio'));
  addPreloadUrl(audioUrls, resolveAssetUrl(scene.ambientSoundId, scene.ambientSoundData, 'audio'));
  (scene.sceneObjects || []).forEach((object) => {
    addPreloadUrl(imageUrls, resolveAssetUrl(object.imageId, object.imageData));
    addPreloadUrl(imageUrls, resolveAssetUrl(object.popupImageId, object.popupImageData || object.popupImage));
    addPreloadUrl(imageUrls, resolveAssetUrl(object.objectImageId, object.objectImageData));
    addPreloadUrl(audioUrls, resolveAssetUrl(object.soundId, object.soundData, 'audio'));
    (object.logicRules || []).forEach((rule) => {
      addPreloadUrl(audioUrls, resolveAssetUrl(rule.successSoundId, rule.successSoundData, 'audio'));
      addPreloadUrl(audioUrls, resolveAssetUrl(rule.failureSoundId, rule.failureSoundData, 'audio'));
    });
    (object.anime2dSpec?.layers || []).forEach((layer) => addPreloadUrl(imageUrls, resolveAnime2dLayerSrc(normalizeAnime2dLayer(layer))));
  });
  (scene.hotspots || []).forEach((spot) => {
    addPreloadUrl(imageUrls, resolveAssetUrl(spot.objectImageId, spot.objectImageData));
    addPreloadUrl(imageUrls, resolveAssetUrl(spot.secondObjectImageId, spot.secondObjectImageData));
    addPreloadUrl(audioUrls, resolveAssetUrl(spot.soundId, spot.soundData, 'audio'));
    (spot.conversation?.nodes || []).forEach((node) => {
      (node.replies || []).forEach((reply) => {
        addPreloadUrl(imageUrls, safeMediaUrl(reply.responseImageData, 'image'));
        addPreloadUrl(imageUrls, safeMediaUrl(reply.npcPortraitData, 'image'));
        addPreloadUrl(audioUrls, safeMediaUrl(reply.responseSoundData, 'audio'));
        addPreloadUrl(audioUrls, safeMediaUrl(reply.ambienceSoundData, 'audio'));
      });
    });
    (spot.logicRules || []).forEach((rule) => {
      addPreloadUrl(audioUrls, resolveAssetUrl(rule.successSoundId, rule.successSoundData, 'audio'));
      addPreloadUrl(audioUrls, resolveAssetUrl(rule.failureSoundId, rule.failureSoundData, 'audio'));
    });
  });
}

function collectSceneMedia(scene, imageUrls, audioUrls) {
  return collectSceneMediaUrls(scene, imageUrls, audioUrls);
}

function collectCinematicMediaUrls(cinematic, imageUrls, audioUrls, videoUrls) {
  if (!cinematic) return;
  addPreloadUrl(videoUrls, resolveAssetUrl(cinematic.videoId, cinematic.videoData, 'video'));
  if (cinematic.cinematicType === 'anime2d') {
    (cinematic.anime2dSpec?.layers || []).forEach((layer) => {
      addPreloadUrl(imageUrls, resolveAnime2dLayerSrc(normalizeAnime2dLayer(layer)));
    });
    (cinematic.steps || []).forEach((step) => {
      if (step.type !== 'anime2d') return;
      (step.spec?.layers || []).forEach((layer) => {
        addPreloadUrl(imageUrls, resolveAnime2dLayerSrc(normalizeAnime2dLayer(layer)));
      });
    });
  }
  (cinematic.slides || []).forEach((slide) => {
    addPreloadUrl(imageUrls, resolveAssetUrl(slide.imageId, slide.imageData));
    addPreloadUrl(audioUrls, resolveAssetUrl(slide.audioId, slide.audioData, 'audio'));
  });
}

function collectCinematicMedia(cinematic, imageUrls, audioUrls, videoUrls) {
  return collectCinematicMediaUrls(cinematic, imageUrls, audioUrls, videoUrls);
}

function collectActMediaUrls(projectOrActId, maybeActId) {
  const sourceProject = maybeActId === undefined ? project : projectOrActId;
  const actId = maybeActId === undefined ? projectOrActId : maybeActId;
  const imageUrls = new Set();
  const audioUrls = new Set();
  const videoUrls = new Set();
  const enigmaIds = new Set();
  const cinematicIds = new Set();
  const itemIds = new Set();
  const scenes = (sourceProject.scenes || []).filter((scene) => (scene.actId || '') === (actId || ''));

  scenes.forEach((scene) => {
    collectSceneMediaUrls(scene, imageUrls, audioUrls);
    if (scene.timerTargetCinematicId) cinematicIds.add(scene.timerTargetCinematicId);
    (scene.sceneObjects || []).forEach((object) => {
      if (object.linkedItemId) itemIds.add(object.linkedItemId);
    });
    (scene.hotspots || []).forEach((spot) => {
      if (spot.enigmaId) enigmaIds.add(spot.enigmaId);
      if (spot.targetCinematicId) cinematicIds.add(spot.targetCinematicId);
      if (spot.secondEnigmaId) enigmaIds.add(spot.secondEnigmaId);
      if (spot.secondTargetCinematicId) cinematicIds.add(spot.secondTargetCinematicId);
      if (spot.rewardItemId) itemIds.add(spot.rewardItemId);
      if (spot.secondRewardItemId) itemIds.add(spot.secondRewardItemId);
      (spot.logicRules || []).forEach((rule) => {
        if (rule.enigmaId) enigmaIds.add(rule.enigmaId);
        if (rule.targetCinematicId) cinematicIds.add(rule.targetCinematicId);
        if (rule.rewardItemId) itemIds.add(rule.rewardItemId);
      });
    });
  });

  (sourceProject.enigmas || []).forEach((enigma) => {
    if (!enigmaIds.has(enigma.id)) return;
    addPreloadUrl(imageUrls, resolveAssetUrl(enigma.imageId, enigma.imageData));
    addPreloadUrl(imageUrls, resolveAssetUrl(enigma.popupBackgroundId, enigma.popupBackgroundData));
    if (enigma.targetCinematicId) cinematicIds.add(enigma.targetCinematicId);
  });
  (sourceProject.cinematics || []).forEach((cinematic) => {
    if (cinematicIds.has(cinematic.id)) collectCinematicMediaUrls(cinematic, imageUrls, audioUrls, videoUrls);
  });
  (sourceProject.items || []).forEach((item) => {
    if (itemIds.has(item.id) || scenes.length === 0) addPreloadUrl(imageUrls, resolveAssetUrl(item.imageId, item.imageData));
  });

  return {
    imageUrls: Array.from(imageUrls),
    audioUrls: Array.from(audioUrls),
    videoUrls: Array.from(videoUrls),
  };
}

function collectActMedia(actId) {
  return collectActMediaUrls(actId);
}

function preloadImageUrl(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = url;
    if (image.decode) image.decode().then(resolve).catch(resolve);
  });
}

function preloadMediaUrl(url, tagName) {
  return new Promise((resolve) => {
    const node = document.createElement(tagName);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeoutId);
      node.oncanplaythrough = null;
      node.onloadeddata = null;
      node.onerror = null;
      node.removeAttribute('src');
      node.load();
      resolve();
    };
    const timeoutId = setTimeout(finish, 8000);
    node.preload = 'auto';
    node.oncanplaythrough = finish;
    node.onloadeddata = finish;
    node.onerror = finish;
    node.src = url;
    node.load();
  });
}

function beginActPreload(scene) {
  const actId = scene?.actId || '';
  if (loadedActId === actId) return false;
  loadedActId = actId;
  const act = (project.acts || []).find((entry) => entry.id === actId);
  const label = act?.name || scene?.name || 'Acte suivant';
  const media = collectActMedia(actId);
  const tasks = [
    ...media.imageUrls.map((url) => () => preloadImageUrl(url)),
    ...media.audioUrls.map((url) => () => preloadMediaUrl(url, 'audio')),
    ...media.videoUrls.map((url) => () => preloadMediaUrl(url, 'video')),
  ];

  if (!tasks.length) {
    state.actPreload = { active: false, progress: 100, label };
    return false;
  }

  const runId = ++actPreloadRunId;
  let completed = 0;
  state.actPreload = { active: true, progress: 0, label };
  stopSceneTimer();

  Promise.all(tasks.map((runTask) => (
    runTask().catch(() => {}).then(() => {
      if (runId !== actPreloadRunId) return;
      completed += 1;
      state.actPreload = {
        active: completed < tasks.length,
        progress: Math.round((completed / tasks.length) * 100),
        label,
      };
      render(false);
    })
  ))).then(() => {
    if (runId !== actPreloadRunId) return;
    state.actPreload = { active: false, progress: 100, label };
    render(false);
  });

  return true;
}

function applyEnterSceneAction(sceneId, fallbackText = 'Nouvelle scene.') {
  const nextScene = getSceneById(sceneId);
  if (!nextScene) return false;
  const currentScene = getPlayScene();
  const transitionOverlay = createSceneTransitionOverlay(currentScene, nextScene);
  if (transitionOverlay) {
    state.sceneTransitionOverlay = {
      type: transitionOverlay.type,
      duration: transitionOverlay.duration,
      scene: transitionOverlay.previousScene,
    };
  }
  if (currentScene?.id !== nextScene.id) expiredSceneTimerKey = '';
  const changesAct = (currentScene?.actId || '') !== (nextScene.actId || '');
  state.playSceneId = nextScene.id;
  state.dialogue = nextScene.introText || fallbackText;
  if (changesAct) beginActPreload(nextScene);
  return true;
}

function goToScene(sceneId, fallbackText = 'Nouvelle scene.') {
  const result = dispatch({ ...gameActions.enterScene(sceneId), fallbackText });
  if (sceneId && !state.visitedSceneIds.includes(sceneId)) {
    state.visitedSceneIds = [...state.visitedSceneIds, sceneId];
  }
  return result;
}

function toggleInventorySelection(itemId) {
  const exists = state.selectedInventoryIds.includes(itemId);
  if (exists) {
    state.selectedInventoryIds = state.selectedInventoryIds.filter((id) => id !== itemId);
    return;
  }
  if (state.selectedInventoryIds.length >= 2) {
    state.selectedInventoryIds = [state.selectedInventoryIds[1], itemId];
    return;
  }
  state.selectedInventoryIds = [...state.selectedInventoryIds, itemId];
}

function getSceneMusicKey(scene) {
  return getSharedSceneMusicKey(scene);
}

function getSceneAmbientSoundKey(scene) {
  return getSharedSceneAmbientSoundKey(scene);
}

function playSceneMusic() {
  const playScene = getPlayScene();
  const nextMusicData = resolveAssetUrl(playScene?.musicId, playScene?.musicData, 'audio');
  const nextMusicKey = getSceneMusicKey(playScene);
  if (!nextMusicData) {
    sceneAudio.pause();
    sceneAudio.removeAttribute('src');
    sceneAudio.load();
    sceneAudioSource = '';
    return;
  }

  if (sceneAudioSource !== nextMusicKey) {
    sceneAudio.pause();
    sceneAudio.currentTime = 0;
    sceneAudio.preload = 'auto';
    sceneAudio.src = nextMusicData;
    sceneAudioSource = nextMusicKey;
  }
  sceneAudio.loop = playScene.musicLoop !== false;
  sceneAudio.volume = typeof playScene.musicVolume === 'number' ? playScene.musicVolume : 0.5;
  sceneAudio.play().catch(() => {});
}

function playSceneAmbientSound() {
  const playScene = getPlayScene();
  const nextSoundData = resolveAssetUrl(playScene?.ambientSoundId, playScene?.ambientSoundData, 'audio');
  const nextSoundKey = getSceneAmbientSoundKey(playScene);
  if (!nextSoundData) {
    ambientAudio.pause();
    ambientAudio.removeAttribute('src');
    ambientAudio.load();
    ambientAudioSource = '';
    return;
  }

  if (ambientAudioSource !== nextSoundKey) {
    ambientAudio.pause();
    ambientAudio.currentTime = 0;
    ambientAudio.preload = 'auto';
    ambientAudio.src = nextSoundData;
    ambientAudioSource = nextSoundKey;
  }
  ambientAudio.loop = Boolean(playScene.ambientSoundLoop);
  ambientAudio.volume = typeof playScene.ambientSoundVolume === 'number' ? playScene.ambientSoundVolume : 0.75;
  ambientAudio.play().catch(() => {});
}

function playHotspotSound(spot) {
  const soundUrl = resolveAssetUrl(spot?.soundId, spot?.soundData, 'audio');
  if (!soundUrl) return;
  hotspotAudio.pause();
  hotspotAudio.currentTime = 0;
  hotspotAudio.preload = 'auto';
  hotspotAudio.src = soundUrl;
  hotspotAudio.volume = typeof spot.soundVolume === 'number' ? spot.soundVolume : 0.8;
  hotspotAudio.play().catch(() => {});
}

function playConversationReplyAudio(audioData = '', options = {}) {
  const safeAudioData = safeMediaUrl(audioData, 'audio');
  if (!safeAudioData) return;
  const audio = options.ambience ? responseAmbienceAudio : hotspotAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.preload = 'auto';
  audio.src = safeAudioData;
  audio.volume = options.ambience ? 0.45 : 0.85;
  audio.loop = Boolean(options.ambience);
  audio.play().catch(() => {});
}

function formatSceneTimerSeconds(seconds = 0) {
  return getSharedFormatTimerSeconds(seconds);
}

function stopSceneTimer() {
  if (sceneTimerInterval) {
    clearInterval(sceneTimerInterval);
    sceneTimerInterval = null;
  }
  activeSceneTimerKey = '';
}

function updateSceneTimerHud(seconds) {
  const node = document.getElementById('scene-timer-count');
  if (node) node.textContent = formatSceneTimerSeconds(seconds);
}

function applySceneTimerEnd(scene) {
  if (!scene) return;
  const action = scene.timerEndAction || 'none';
  const message = scene.timerEndMessage || 'Le temps est ecoule.';

  if (action === 'scene' && scene.timerTargetSceneId) {
    goToScene(scene.timerTargetSceneId, message);
    render();
    return;
  }

  if (action === 'restart-scene') {
    expiredSceneTimerKey = '';
    goToScene(scene.id, message || scene.introText || 'La scene recommence.');
    render();
    return;
  }

  if (action === 'restart-preview') {
    resetPreview();
    state.dialogue = message || 'Le jeu recommence.';
    render(false);
    return;
  }

  if (action === 'damage-life') {
    const loss = Math.max(1, Number(scene.timerLifeLoss) || 1);
    state.playerLives = Math.max(0, (Number(state.playerLives) || 0) - loss);
    state.dialogue = message || ('Temps ecoule: -' + loss + ' vie' + (loss > 1 ? 's' : '') + '.');
    if (state.playerLives <= 0 && scene.timerTargetSceneId) {
      goToScene(scene.timerTargetSceneId, state.dialogue);
    }
    render();
    return;
  }

  if (action === 'dialogue') {
    state.dialogue = message || 'Le temps est ecoule.';
    render();
    return;
  }

  if (action === 'cinematic' && scene.timerTargetCinematicId) {
    if (message) state.dialogue = message;
    launchCinematic(scene.timerTargetCinematicId);
    render();
    return;
  }

  if (message) {
    state.dialogue = message;
    render();
  }
}

function scheduleSceneTimer() {
  const scene = getPlayScene();
  const timerSeconds = Number(scene?.timerSeconds) || 0;
  if (!scene?.timerEnabled || timerSeconds <= 0) {
    stopSceneTimer();
    return;
  }

  const timerKey = [
    scene.id,
    timerSeconds,
    scene.timerEndAction || 'none',
    scene.timerTargetSceneId || '',
    scene.timerTargetCinematicId || '',
  ].join(':');

  if (activeSceneTimerKey === timerKey && sceneTimerInterval) {
    updateSceneTimerHud(state.sceneTimerRemaining);
    return;
  }

  if (expiredSceneTimerKey === timerKey) {
    updateSceneTimerHud(0);
    return;
  }

  stopSceneTimer();
  activeSceneTimerKey = timerKey;
  state.sceneTimerRemaining = timerSeconds;
  updateSceneTimerHud(state.sceneTimerRemaining);

  sceneTimerInterval = setInterval(() => {
    state.sceneTimerRemaining = Math.max(0, (Number(state.sceneTimerRemaining) || 0) - 1);
    updateSceneTimerHud(state.sceneTimerRemaining);
    if (state.sceneTimerRemaining <= 0) {
      expiredSceneTimerKey = activeSceneTimerKey;
      stopSceneTimer();
      applySceneTimerEnd(scene);
    }
  }, 1000);
}

function clearSimonPlayback() {
  simonTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  simonTimeouts = [];
  state.simonPlaybackIndex = -1;
}

function startSimonPlayback(enigma) {
  clearSimonPlayback();
  state.simonPlayerTurn = false;
  state.enigmaColorAttempt = [];
  const sequence = enigma.solutionColors || [];
  sequence.forEach((color, index) => {
    const showId = window.setTimeout(() => {
      state.simonPlaybackIndex = index;
      render();
    }, index * 800 + 250);
    const hideId = window.setTimeout(() => {
      state.simonPlaybackIndex = -1;
      render();
    }, index * 800 + 700);
    simonTimeouts.push(showId, hideId);
  });
  const endId = window.setTimeout(() => {
    state.simonPlaybackIndex = -1;
    state.simonPlayerTurn = true;
    render();
  }, sequence.length * 800 + 750);
  simonTimeouts.push(endId);
}

function launchCinematic(cinematicId) {
  const cinematic = getCinematicById(cinematicId);
  if (!cinematic) return;
  const cinematicType = normalizeCinematicType(cinematic.cinematicType || 'slides');
  if (!state.launchedCinematicIds.includes(cinematic.id)) {
    state.launchedCinematicIds = [...state.launchedCinematicIds, cinematic.id];
  }
  state.playingCinematicId = cinematic.id;
  state.playingSlideIndex = 0;
  if (cinematicType === 'anime2d') {
    anime2dActiveCinematicId = '';
    anime2dStartedAt = 0;
    clearAnime2dTimer();
  }
}

function markHotspotCompleted(hotspotId) {
  if (!hotspotId || state.completedHotspotIds.includes(hotspotId)) return;
  state.completedHotspotIds = [...state.completedHotspotIds, hotspotId];
}

function markLogicRuleUsed(ruleId) {
  if (!ruleId || state.usedLogicRuleIds.includes(ruleId)) return;
  state.usedLogicRuleIds = [...state.usedLogicRuleIds, ruleId];
}

function getStandaloneConditionContext() {
  return {
    inventory: state.inventory,
    visitedSceneIds: state.visitedSceneIds,
    completedHotspotIds: state.completedHotspotIds,
    solvedEnigmaIds: state.solvedEnigmaIds,
    chosenConversationReplyIds: state.chosenConversationReplyIds,
    storyVariables: state.storyVariables,
  };
}

function resolveHotspotInteraction(spot) {
  if (!spot) return null;
  return sharedResolveHotspotInteraction(spot, {
    ...getStandaloneConditionContext(),
    usedLogicRuleIds: state.usedLogicRuleIds,
    launchedCinematicIds: state.launchedCinematicIds,
    completedCombinationIds: state.completedCombinationIds,
    heroState: state.heroState || {},
    lastDiceRoll: state.lastDiceRoll || {},
    heroAdventureEnabled: IS_HERO_ADVENTURE,
    completedHotspotIds: state.completedHotspotIds,
    hotspotId: spot.id,
  });
}

function applyHotspotSideEffects(spot, sourceHotspotId = spot?.id) {
  if (!spot) return;

  if (spot.consumeRequiredItemOnUse && spot.requiredItemId) {
    state.inventory = consumeInventoryItem(state.inventory, spot.requiredItemId);
    state.selectedInventoryIds = state.selectedInventoryIds.filter((id) => id !== spot.requiredItemId);
    if (state.viewerImage?.id === spot.requiredItemId) {
      state.viewerImage = null;
    }
  }

  const spotObjectImageUrl = resolveAssetUrl(spot.objectImageId, spot.objectImageData);
  if (spotObjectImageUrl) {
    state.viewerImage = createHotspotViewerImage(spot, spotObjectImageUrl);
  }

  if (spot.dialogue) state.dialogue = spot.dialogue;

  const rewardItemId = getHotspotRewardItemId(spot);
  if (rewardItemId && !state.inventory.includes(rewardItemId)) {
    state.inventory = addRewardItemToInventory(state.inventory, rewardItemId);
    if (!state.selectedInventoryIds.includes(rewardItemId)) {
      state.selectedInventoryIds = selectRewardInventoryItem(state.selectedInventoryIds, rewardItemId);
    }
    addAdventureJournalEntry({
      type: 'item',
      title: getJournalItemLabel(rewardItemId),
      detail: spot.name || 'Zone exploree',
    });
  }

  Object.assign(state, applyHotspotBlockState(state, spot, { removedKey: 'removedSceneObjectIds' }));

  if (!spot.logicRuleFailed) markHotspotCompleted(sourceHotspotId || spot.id);
  if (spot.disableAfterUse && spot.logicRuleId) markLogicRuleUsed(spot.logicRuleId);
}

function applyHotspotAction(spot, sourceHotspotId = spot?.id) {
  if (!spot) return;

  applyHotspotSideEffects(spot, sourceHotspotId);

  if (spot.actionType === 'scene' && spot.targetSceneId) {
    goToScene(spot.targetSceneId, spot.dialogue || 'Nouvelle scene.');
  }

  if (spot.actionType === 'cinematic' && spot.targetCinematicId) {
    launchCinematic(spot.targetCinematicId);
  }
}

function openConversation(spot) {
  const nodes = Array.isArray(spot?.conversation?.nodes) ? spot.conversation.nodes : [];
  const startNodeId = spot?.conversation?.startNodeId || nodes[0]?.id || '';
  const node = nodes.find((entry) => entry.id === startNodeId) || nodes[0] || null;
  if (!node) {
    if (spot?.dialogue) state.dialogue = spot.dialogue;
    return false;
  }
  if (node.askOnce && state.askedConversationNodeIds.includes(node.id)) {
    state.dialogue = spot?.dialogue || 'Cette question a déjà été posée.';
    return false;
  }
  state.activeConversation = {
    sourceHotspotId: spot.id,
    conversation: spot.conversation,
    nodeId: node.id,
  };
  if (!state.askedConversationNodeIds.includes(node.id)) state.askedConversationNodeIds = [...state.askedConversationNodeIds, node.id];
  state.dialogue = node.text || spot.dialogue || state.dialogue;
  return true;
}

function closeConversation() {
  state.activeConversation = null;
}

function isSingleConversationConditionAvailable(condition = {}) {
  return evaluateCondition(condition, getStandaloneConditionContext());
}

function isConversationReplyAvailable(reply = {}) {
  if (reply.id && state.hiddenConversationReplyIds.includes(reply.id)) return false;
  if (reply.hideAfterChosen && reply.id && state.chosenConversationReplyIds.includes(reply.id)) return false;
  return evaluateReplyCondition(reply, getStandaloneConditionContext());
}

function getSingleConversationConditionReason(condition = {}) {
  const conditionType = condition.type || 'none';
  if (conditionType === 'none' || isSingleConversationConditionAvailable(condition)) return '';
  if (conditionType === 'has_item') return 'Nécessite: ' + (getItemById(condition.itemId)?.name || 'objet manquant');
  if (conditionType === 'visited_scene') return 'Nécessite une scene visitee';
  if (conditionType === 'completed_hotspot') return 'Nécessite une action faite';
  if (conditionType === 'solved_enigma') return 'Nécessite une énigme resolue';
  if (conditionType === 'chose_reply') return 'Nécessite un choix précédent';
  if (conditionType === 'story_variable') {
    const operators = { equals: '=', not_equals: '!=', greater_or_equal: '>=', less_or_equal: '<=', truthy: 'vrai', falsy: 'faux' };
    const operator = condition.operator || 'equals';
    const suffix = ['truthy', 'falsy'].includes(operator) ? operators[operator] : (operators[operator] || '=') + ' ' + (condition.value ?? '');
    return 'Nécessite: ' + (condition.variableKey || 'variable') + ' ' + suffix;
  }
  return 'Condition non remplie';
}

function getConversationReplyLockReason(reply = {}) {
  if (isConversationReplyAvailable(reply)) return '';
  if (reply.id && state.hiddenConversationReplyIds.includes(reply.id)) return 'Choix masque par une autre réponse';
  if (reply.hideAfterChosen && reply.id && state.chosenConversationReplyIds.includes(reply.id)) return 'Choix déjà utilisé';
  if (reply.lockedLabel) return reply.lockedLabel;
  const conditionType = reply.conditionType || 'none';
  if (conditionType === 'has_item') return getSingleConversationConditionReason({ type: 'has_item', itemId: reply.conditionItemId });
  if (conditionType === 'visited_scene') return getSingleConversationConditionReason({ type: 'visited_scene', sceneId: reply.conditionSceneId });
  if (conditionType === 'completed_hotspot') return getSingleConversationConditionReason({ type: 'completed_hotspot', hotspotId: reply.conditionHotspotId });
  if (conditionType === 'solved_enigma') return getSingleConversationConditionReason({ type: 'solved_enigma', enigmaId: reply.conditionEnigmaId });
  if (conditionType === 'chose_reply') return getSingleConversationConditionReason({ type: 'chose_reply', replyId: reply.conditionReplyId });
  if (conditionType === 'story_variable') return getSingleConversationConditionReason({ type: 'story_variable', variableKey: reply.conditionVariableKey, operator: reply.conditionVariableOperator, value: reply.conditionVariableValue });
  if (conditionType === 'advanced') {
    const conditions = Array.isArray(reply.advancedConditions) ? reply.advancedConditions : [];
    const missing = conditions.map(getSingleConversationConditionReason).filter(Boolean);
    if ((reply.advancedConditionMode || 'all') === 'any') return missing.length === conditions.length ? 'Il faut au moins une condition: ' + missing.slice(0, 2).join(' ou ') : '';
    return missing.slice(0, 3).join(' + ') || 'Condition non remplie';
  }
  return 'Condition non remplie';
}

function applyStoryVariableEffect(reply = {}) {
  if (!reply.storyVariableKey || (reply.storyVariableOperation || 'none') === 'none') return;
  const key = String(reply.storyVariableKey || '').trim();
  if (!key) return;
  const operation = reply.storyVariableOperation || 'none';
  const rawValue = reply.storyVariableValue;
  if (!state.storyVariables || typeof state.storyVariables !== 'object') state.storyVariables = {};
  if (operation === 'increment' || operation === 'decrement') {
    const amount = Number(rawValue) || 1;
    const current = Number(state.storyVariables[key]) || 0;
    state.storyVariables = { ...state.storyVariables, [key]: operation === 'increment' ? current + amount : current - amount };
    return;
  }
  let nextValue = rawValue;
  if (rawValue === 'true') nextValue = true;
  if (rawValue === 'false') nextValue = false;
  state.storyVariables = { ...state.storyVariables, [key]: nextValue };
}

function applyStoryVariableValue(key, operation, rawValue) {
  const variableKey = String(key || '').trim();
  if (!variableKey) return;
  if (!state.storyVariables || typeof state.storyVariables !== 'object') state.storyVariables = {};
  if (operation === 'increment' || operation === 'decrement') {
    const amount = Number(rawValue) || 1;
    const current = Number(state.storyVariables[variableKey]) || 0;
    state.storyVariables = { ...state.storyVariables, [variableKey]: operation === 'increment' ? current + amount : current - amount };
    return;
  }
  let nextValue = rawValue;
  if (rawValue === 'true') nextValue = true;
  if (rawValue === 'false') nextValue = false;
  state.storyVariables = { ...state.storyVariables, [variableKey]: nextValue };
}

function getTargetLabel(collection = [], id = '', fallback = 'Cible') {
  const entry = collection.find((item) => item.id === id);
  return entry?.name || entry?.title || fallback;
}

function makeVariableEffectNotice(key, operation, rawValue) {
  const variableKey = String(key || '').trim();
  if (!variableKey || operation === 'none') return null;
  const label = getStoryVariableJournalLabel(variableKey);
  if (operation === 'increment') return { type: 'variable', title: 'Variable', detail: label + ' +' + (Number(rawValue) || 1) };
  if (operation === 'decrement') return { type: 'variable', title: 'Variable', detail: label + ' -' + (Number(rawValue) || 1) };
  return { type: 'variable', title: 'Variable', detail: label + ' = ' + String(rawValue) };
}

function applyConversationReplyEffects(reply = {}) {
  const effects = Array.isArray(reply.effects) ? reply.effects : [];
  const result = { messages: [], notices: [], nextNodeId: '', targetSceneId: '', targetCinematicId: '', enigmaId: '', ending: null };
  effects.forEach((effect) => {
    const type = effect.type || 'message';
    if (type === 'message' && effect.message) {
      result.messages.push(effect.message);
      result.notices.push({ type: 'message', title: 'Message', detail: effect.message });
    }
    if (type === 'add_item' && effect.itemId && !state.inventory.includes(effect.itemId)) {
      state.inventory = [...state.inventory, effect.itemId];
      state.selectedInventoryIds = [...state.selectedInventoryIds.filter((id) => id !== effect.itemId), effect.itemId].slice(-2);
      const itemLabel = getJournalItemLabel(effect.itemId);
      addAdventureJournalEntry({ type: 'item', title: itemLabel, detail: effect.journalDetail || 'Objet obtenu.' });
      result.notices.push({ type: 'item', title: 'Objet obtenu', detail: itemLabel });
    }
    if (type === 'remove_item' && effect.itemId) {
      state.inventory = state.inventory.filter((itemId) => itemId !== effect.itemId);
      state.selectedInventoryIds = state.selectedInventoryIds.filter((itemId) => itemId !== effect.itemId);
      result.notices.push({ type: 'item', title: 'Objet retire', detail: getJournalItemLabel(effect.itemId) });
    }
    if (type === 'set_variable') {
      applyStoryVariableValue(effect.variableKey, 'set', effect.value);
      const notice = makeVariableEffectNotice(effect.variableKey, 'set', effect.value);
      if (notice) result.notices.push(notice);
    }
    if (type === 'increment_variable') {
      applyStoryVariableValue(effect.variableKey, 'increment', effect.value);
      const notice = makeVariableEffectNotice(effect.variableKey, 'increment', effect.value);
      if (notice) result.notices.push(notice);
    }
    if (type === 'decrement_variable') {
      applyStoryVariableValue(effect.variableKey, 'decrement', effect.value);
      const notice = makeVariableEffectNotice(effect.variableKey, 'decrement', effect.value);
      if (notice) result.notices.push(notice);
    }
    if (type === 'journal') {
      const title = effect.journalTitle || 'Note';
      const detail = effect.journalDetail || effect.message || '';
      addAdventureJournalEntry({ type: 'note', title, detail });
      result.notices.push({ type: 'journal', title: 'Journal mis a jour', detail: [title, detail].filter(Boolean).join(' - ') });
    }
    if (type === 'next_node') {
      result.nextNodeId = effect.nextNodeId || result.nextNodeId;
      const node = (state.activeConversation?.conversation?.nodes || []).find((entry) => entry.id === effect.nextNodeId);
      result.notices.push({ type: 'route', title: 'Suite', detail: node?.text || node?.speaker || 'Autre question' });
    }
    if (type === 'scene') {
      result.targetSceneId = effect.targetSceneId || result.targetSceneId;
      result.notices.push({ type: 'route', title: 'Nouvelle scene', detail: getTargetLabel(project.scenes || [], effect.targetSceneId, 'Scene') });
    }
    if (type === 'cinematic') {
      result.targetCinematicId = effect.targetCinematicId || result.targetCinematicId;
      result.notices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], effect.targetCinematicId, 'Cinématique') });
    }
    if (type === 'enigma') {
      result.enigmaId = effect.enigmaId || result.enigmaId;
      result.notices.push({ type: 'route', title: 'Énigme', detail: getTargetLabel(project.enigmas || [], effect.enigmaId, 'Énigme') });
    }
    if (type === 'ending') {
      result.ending = { endingType: effect.endingType || reply.endingType || 'neutral', endingTitle: effect.endingTitle || reply.endingTitle || '', endingSummary: effect.endingSummary || reply.endingSummary || '', dialogue: effect.message || reply.dialogue || '' };
      result.notices.push({ type: 'ending', title: 'Fin déclenchée', detail: effect.endingTitle || reply.endingTitle || 'Fin' });
    }
  });
  return result;
}

function addAdventureJournalEntry(entry = {}) {
  if (!entry.title && !entry.detail) return;
  const nextEntry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    type: entry.type || 'note',
    title: entry.title || '',
    detail: entry.detail || '',
  };
  state.adventureJournalEntries = [nextEntry].concat(Array.isArray(state.adventureJournalEntries) ? state.adventureJournalEntries : []).slice(0, 60);
}

function getStoryVariableJournalLabel(key) {
  const variable = (project.storyVariables || []).find((entry) => entry.key === key);
  return variable?.journalLabel || key;
}

function getJournalItemLabel(itemId) {
  const item = getItemById(itemId);
  return item ? ((item.icon || '') + ' ' + (item.name || 'Objet')).trim() : 'Objet';
}

function openEnding(reply = {}) {
  const typeLabels = {
    good: 'Bonne fin',
    bad: 'Mauvaise fin',
    secret: 'Fin secrete',
    neutral: 'Fin neutre',
  };
  const endingType = reply.endingType || 'neutral';
  state.activeEnding = {
    type: endingType,
    label: typeLabels[endingType] || 'Fin',
    title: reply.endingTitle || typeLabels[endingType] || 'Fin',
    summary: reply.endingSummary || reply.dialogue || 'Ton aventure se termine ici.',
    message: reply.dialogue || '',
  };
}

function chooseConversationReply(reply = {}) {
  if (!state.activeConversation?.conversation) return;
  if (!isConversationReplyAvailable(reply)) return;
  const currentNode = (state.activeConversation.conversation.nodes || []).find((node) => node.id === state.activeConversation.nodeId);
  addAdventureJournalEntry({
    type: 'choice',
    title: reply.label || 'Choix',
    detail: currentNode?.text || '',
  });
  const replyResponseImageData = safeMediaUrl(reply.responseImageData, 'image');
  const replyResponseSoundData = safeMediaUrl(reply.responseSoundData, 'audio');
  const replyAmbienceSoundData = safeMediaUrl(reply.ambienceSoundData, 'audio');
  if (replyResponseImageData) {
    state.viewerImage = {
      src: replyResponseImageData,
      name: reply.responseImageName || reply.label || 'Image',
      caption: reply.dialogue || reply.label || '',
    };
  }
  if (replyResponseSoundData) playConversationReplyAudio(replyResponseSoundData);
  if (replyAmbienceSoundData) playConversationReplyAudio(replyAmbienceSoundData, { ambience: true });
  applyStoryVariableEffect(reply);
  const effectResult = applyConversationReplyEffects(reply);
  if (reply.id && !state.chosenConversationReplyIds.includes(reply.id)) {
    state.chosenConversationReplyIds = [...state.chosenConversationReplyIds, reply.id];
  }
  const replyIdsToHide = Array.isArray(reply.hideReplyIdsAfterChosen) ? reply.hideReplyIdsAfterChosen.filter(Boolean) : [];
  if (replyIdsToHide.length) {
    state.hiddenConversationReplyIds = [...new Set([...(state.hiddenConversationReplyIds || []), ...replyIdsToHide])];
  }
  const actionType = reply.actionType || (reply.nextNodeId ? 'node' : 'end');
  const message = reply.dialogue || reply.label || '';
  const combinedMessage = [message, ...effectResult.messages].filter(Boolean).join(' ');
  if (combinedMessage) state.dialogue = combinedMessage;
  const legacyVariableNotice = makeVariableEffectNotice(reply.storyVariableKey, reply.storyVariableOperation || 'none', reply.storyVariableValue);
  const nextChoiceNotices = [
    combinedMessage ? { type: 'message', title: 'Message affiché', detail: combinedMessage } : null,
    replyResponseImageData ? { type: 'media', title: 'Image affichée', detail: reply.responseImageName || reply.label || 'Image de réponse' } : null,
    replyResponseSoundData ? { type: 'media', title: 'Son joue', detail: 'Effet sonore' } : null,
    replyAmbienceSoundData ? { type: 'media', title: 'Ambiance lancée', detail: 'Son d’ambiance' } : null,
    legacyVariableNotice,
    ...effectResult.notices,
  ].filter(Boolean);
  if (reply.rewardItemId && !state.inventory.includes(reply.rewardItemId)) {
    state.inventory = [...state.inventory, reply.rewardItemId];
    state.selectedInventoryIds = [...state.selectedInventoryIds.filter((id) => id !== reply.rewardItemId), reply.rewardItemId].slice(-2);
    addAdventureJournalEntry({
      type: 'item',
      title: getJournalItemLabel(reply.rewardItemId),
      detail: 'Indice ou objet obtenu.',
    });
    nextChoiceNotices.push({ type: 'item', title: 'Objet obtenu', detail: getJournalItemLabel(reply.rewardItemId) });
  }
  if (effectResult.ending) {
    state.choiceEffectNotices = nextChoiceNotices;
    markHotspotCompleted(state.activeConversation.sourceHotspotId);
    closeConversation();
    openEnding(effectResult.ending);
    return;
  }
  const targetSceneId = effectResult.targetSceneId || reply.targetSceneId;
  if (targetSceneId && (actionType === 'scene' || effectResult.targetSceneId)) {
    if (!effectResult.targetSceneId) nextChoiceNotices.push({ type: 'route', title: 'Nouvelle scene', detail: getTargetLabel(project.scenes || [], targetSceneId, 'Scene') });
    state.choiceEffectNotices = nextChoiceNotices;
    closeConversation();
    goToScene(targetSceneId, combinedMessage || 'Nouvelle scene.');
    return;
  }
  const targetCinematicId = effectResult.targetCinematicId || reply.targetCinematicId;
  if (targetCinematicId && (actionType === 'cinematic' || effectResult.targetCinematicId)) {
    if (!effectResult.targetCinematicId) nextChoiceNotices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], targetCinematicId, 'Cinématique') });
    state.choiceEffectNotices = nextChoiceNotices;
    closeConversation();
    launchCinematic(targetCinematicId);
    return;
  }
  const targetEnigmaId = effectResult.enigmaId || reply.enigmaId;
  if (targetEnigmaId && (actionType === 'enigma' || effectResult.enigmaId)) {
    const enigma = getEnigmaById(targetEnigmaId);
    if (enigma) {
      if (!effectResult.enigmaId) nextChoiceNotices.push({ type: 'route', title: 'Énigme', detail: enigma.name || 'Énigme' });
      state.choiceEffectNotices = nextChoiceNotices;
      closeConversation();
      openEnigma(enigma, null);
      return;
    }
  }
  if (actionType === 'ending') {
    nextChoiceNotices.push({ type: 'ending', title: 'Fin déclenchée', detail: reply.endingTitle || 'Fin' });
    state.choiceEffectNotices = nextChoiceNotices;
    markHotspotCompleted(state.activeConversation.sourceHotspotId);
    closeConversation();
    openEnding(reply);
    return;
  }
  if (actionType === 'end') {
    state.choiceEffectNotices = nextChoiceNotices;
    markHotspotCompleted(state.activeConversation.sourceHotspotId);
    closeConversation();
    return;
  }
  const nextNodeId = effectResult.nextNodeId || reply.nextNodeId;
  const nextNode = (state.activeConversation.conversation.nodes || []).find((node) => node.id === nextNodeId);
  if (nextNode) {
    if (nextNode.askOnce && state.askedConversationNodeIds.includes(nextNode.id)) {
      state.choiceEffectNotices = nextChoiceNotices;
      state.dialogue = combinedMessage || 'Cette question a déjà été posée.';
      closeConversation();
      return;
    }
    if (!effectResult.nextNodeId) nextChoiceNotices.push({ type: 'route', title: 'Suite', detail: nextNode.text || nextNode.speaker || 'Autre question' });
    state.choiceEffectNotices = nextChoiceNotices;
    if (!state.askedConversationNodeIds.includes(nextNode.id)) state.askedConversationNodeIds = [...state.askedConversationNodeIds, nextNode.id];
    state.activeConversation.nodeId = nextNode.id;
    state.activeConversation.portraitData = safeMediaUrl(reply.npcPortraitData, 'image') || state.activeConversation.portraitData || '';
    state.activeConversation.portraitName = reply.npcPortraitName || state.activeConversation.portraitName || '';
    state.dialogue = [combinedMessage, nextNode.text].filter(Boolean).join(' ');
    return;
  }
  state.choiceEffectNotices = nextChoiceNotices;
  closeConversation();
}

function applyEnigmaSuccess(enigma, hotspot) {
  if (hotspot && enigma.unlockType !== 'none') {
    applyHotspotSideEffects(hotspot);
  }
  if (enigma.successMessage) state.dialogue = enigma.successMessage;

  if (enigma.unlockType === 'scene' && enigma.targetSceneId) {
    goToScene(enigma.targetSceneId, enigma.successMessage || 'Nouvelle scene débloquée.');
  } else if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
    launchCinematic(enigma.targetCinematicId);
  } else if (hotspot) {
    applyHotspotAction(hotspot);
  }
}

function closeEnigma() {
  clearSimonPlayback();
  state.activeEnigma = null;
  state.enigmaCodeInput = '';
  state.enigmaColorAttempt = [];
  state.enigmaPuzzleOrder = [];
  state.enigmaPuzzleSelectedIndex = null;
  state.enigmaDragBank = [];
  state.enigmaDragSlots = [];
  state.enigmaDraggedPiece = null;
  state.enigmaRotationAngles = [];
  state.simonPlayerTurn = false;
}

function solveActiveEnigma() {
  if (!state.activeEnigma?.enigma) return;
  const { enigma, hotspot } = state.activeEnigma;
  if (!state.solvedEnigmaIds.includes(enigma.id)) {
    state.solvedEnigmaIds = [...state.solvedEnigmaIds, enigma.id];
  }
  closeEnigma();
  applyEnigmaSuccess(enigma, hotspot);
  render();
}

function failActiveEnigma() {
  if (!state.activeEnigma?.enigma) return;
  state.dialogue = state.activeEnigma.enigma.failMessage || 'Ce n’est pas la bonne réponse.';
}

function openEnigma(enigma, hotspot = null) {
  const pieceCount = Math.max(4, (Number(enigma.gridRows) || 3) * (Number(enigma.gridCols) || 3));
  state.activeEnigma = { enigma, hotspot };
  state.enigmaCodeInput = '';
  state.enigmaColorAttempt = [];
  state.enigmaPuzzleSelectedIndex = null;
  state.enigmaDraggedPiece = null;
  state.simonPlayerTurn = enigma.type !== 'simon';

  if (enigma.type === 'puzzle') {
    state.enigmaPuzzleOrder = shuffledIndices(pieceCount);
  } else {
    state.enigmaPuzzleOrder = [];
  }

  if (enigma.type === 'dragdrop') {
    state.enigmaDragBank = shuffledIndices(pieceCount);
    state.enigmaDragSlots = Array.from({ length: pieceCount }, () => null);
  } else {
    state.enigmaDragBank = [];
    state.enigmaDragSlots = [];
  }

  if (enigma.type === 'rotation') {
    state.enigmaRotationAngles = randomRotations(pieceCount);
  } else {
    state.enigmaRotationAngles = [];
  }

  if (enigma.type === 'simon') {
    startSimonPlayback(enigma);
  } else {
    clearSimonPlayback();
  }
}

function getActiveEnigmaAnswer() {
  return {
    codeInput: state.enigmaCodeInput,
    colorAttempt: state.enigmaColorAttempt,
    puzzleOrder: state.enigmaPuzzleOrder,
    dragSlots: state.enigmaDragSlots,
    rotationAngles: state.enigmaRotationAngles,
  };
}

function applySolveEnigmaAction(action = {}) {
  if (!state.activeEnigma?.enigma) return false;
  const { enigma } = state.activeEnigma;
  if (action.id && action.id !== enigma.id) return false;
  const isSuccess = validateEnigmaAnswer(enigma, action.answer || getActiveEnigmaAnswer());

  if (!isSuccess) {
    failActiveEnigma();
    if (enigma.type === 'colors') state.enigmaColorAttempt = [];
    render();
    return false;
  }

  solveActiveEnigma();
  return true;
}

function submitEnigma() {
  return dispatch(gameActions.solveEnigma(state.activeEnigma?.enigma?.id));
}

function pushEnigmaColor(colorValue) {
  if (!state.activeEnigma?.enigma) return;
  const expectedLength = state.activeEnigma.enigma.solutionColors?.length || 0;
  const next = [...state.enigmaColorAttempt, colorValue].slice(0, expectedLength || state.enigmaColorAttempt.length + 1);
  state.enigmaColorAttempt = next;

  if (state.activeEnigma.enigma.type === 'simon') {
    const solution = state.activeEnigma.enigma.solutionColors || [];
    const failed = next.some((color, index) => color !== solution[index]);
    if (failed) {
      state.enigmaColorAttempt = [];
      failActiveEnigma();
      startSimonPlayback(state.activeEnigma.enigma);
      render();
      return;
    }
    if (next.length === solution.length) {
      solveActiveEnigma();
      return;
    }
  }

  render();
}

function clickPuzzlePiece(index) {
  if (state.enigmaPuzzleSelectedIndex === null) {
    state.enigmaPuzzleSelectedIndex = index;
    render();
    return;
  }

  const next = [...state.enigmaPuzzleOrder];
  [next[state.enigmaPuzzleSelectedIndex], next[index]] = [next[index], next[state.enigmaPuzzleSelectedIndex]];
  state.enigmaPuzzleOrder = next;
  state.enigmaPuzzleSelectedIndex = null;
  render();

  if (next.every((value, pieceIndex) => value === pieceIndex)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function rotatePuzzlePiece(index) {
  const next = [...state.enigmaRotationAngles];
  next[index] = (((next[index] || 0) + 90) % 360);
  state.enigmaRotationAngles = next;
  render();

  if (next.every((value) => value % 360 === 0)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function moveDragPieceToSlot(pièce, slotIndex) {
  if (pièce === null || pièce === undefined) return;
  const bankWithoutPiece = state.enigmaDragBank.filter((entry) => entry !== pièce);
  const nextSlots = [...state.enigmaDragSlots];
  const previousSlotIndex = nextSlots.findIndex((entry) => entry === pièce);
  if (previousSlotIndex >= 0) nextSlots[previousSlotIndex] = null;
  const displacedPiece = nextSlots[slotIndex];
  nextSlots[slotIndex] = pièce;

  state.enigmaDragSlots = nextSlots;
  state.enigmaDragBank = displacedPiece === null || displacedPiece === undefined ?
     bankWithoutPiece
    : [...bankWithoutPiece, displacedPiece];
  render();

  if (nextSlots.every((entry, index) => entry === index)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function returnDragPieceToBank(slotIndex) {
  const nextSlots = [...state.enigmaDragSlots];
  const pièce = nextSlots[slotIndex];
  if (pièce !== null && pièce !== undefined) {
    nextSlots[slotIndex] = null;
    state.enigmaDragSlots = nextSlots;
    state.enigmaDragBank = [...state.enigmaDragBank, pièce];
    render();
  }
}

function openInventoryItem(itemId) {
  const item = getItemById(itemId);
  if (!item) return;
  const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
  if (itemImageUrl) {
    state.viewerImage = { id: item.id, src: itemImageUrl, name: item.name };
  }
  toggleInventorySelection(itemId);
  render();
}

function applyCombineAction(firstId, secondId) {
  const combo = getCombinationForItems(firstId, secondId);
  const resultItemId = getCombinationResult(combo);
  if (combo?.blocked) {
    state.dialogue = combo.failMessage || 'Les conditions ne sont pas reunies.';
    render();
    return false;
  }
  if (!resultItemId) {
    state.dialogue = 'Ces deux objets ne peuvent pas être combinés.';
    render();
    return false;
  }

  const remaining = [...state.inventory];
  const removeOne = (id) => {
    const index = remaining.indexOf(id);
    if (index >= 0) remaining.splice(index, 1);
  };

  if (combo.consume ?? true) {
    removeOne(firstId);
    removeOne(secondId);
  }
  if (!remaining.includes(resultItemId)) remaining.push(resultItemId);
  state.inventory = remaining;

  const resultItem = getItemById(resultItemId);
  if (!state.completedCombinationIds.includes(combo.id)) {
    state.completedCombinationIds = [...state.completedCombinationIds, combo.id];
  }
  state.dialogue = combo.message || ('Tu obtiens ' + (resultItem?.name || 'un nouvel objet') + '.');
  state.selectedInventoryIds = resultItemId ? [resultItemId] : [];
  const resultItemImageUrl = resolveAssetUrl(resultItem?.imageId, resultItem?.imageData);
  state.viewerImage = resultItemImageUrl ? { id: resultItem.id, src: resultItemImageUrl, name: resultItem.name } : null;
  render();
  return true;
}

function combineInventoryItems(firstId, secondId) {
  return dispatch(gameActions.combine(firstId, secondId));
}

function getSceneObjectClickMode(obj) {
  if (!obj) return 'object';
  if (obj.clickMode) return obj.clickMode;
  if (obj.isClickable === false) return 'none';
  return 'object';
}

function getSceneObjectBlockType(obj) {
  const value = obj?.blockType || 'object';
  return ['object', 'text', 'image', 'button', 'input', 'code', 'hint'].includes(value) ? value : 'object';
}

function applySceneObjectTextOverride(obj, textOverride) {
  if (textOverride === undefined || textOverride === null) return obj;
  const text = String(textOverride);
  const blockType = getSceneObjectBlockType(obj);
  if (blockType === 'button') return { ...obj, buttonLabel: text };
  if (blockType === 'input') return { ...obj, placeholder: text };
  if (blockType === 'code') return { ...obj, blockLabel: text, placeholder: text };
  if (blockType === 'image') return { ...obj, blockLabel: text };
  return { ...obj, blockText: text, dialogue: text };
}

function normalizeBlockAnswer(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSceneObjectFontSize(obj) {
  const value = Number(obj?.fontSize);
  return Number.isFinite(value) ? Math.max(8, Math.min(48, value)) : 13;
}

function triggerSceneObject(objectId) {
  const scene = getPlayScene();
  const sourceObj = scene?.sceneObjects?.find((entry) => entry.id === objectId);
  if (!sourceObj || state.removedSceneObjectIds.includes(sourceObj.id)) return;
  const obj = applySceneObjectTextOverride(sourceObj, state.sceneObjectTextOverrides?.[objectId]);
  const clickMode = getSceneObjectClickMode(obj);
  if (clickMode === 'none') return;
  if (clickMode === 'action') {
    triggerHotspot(objectId);
    return;
  }
  playHotspotSound(obj);

  const blockType = getSceneObjectBlockType(obj);
  if (blockType === 'input' || blockType === 'code') {
    const answer = window.prompt(obj.placeholder || (blockType === 'code' ? 'Entre le code.' : 'Entre ta réponse.'));
    if (answer === null) return;
    const isCorrect = normalizeBlockAnswer(answer) === normalizeBlockAnswer(obj.expectedAnswer);
    state.dialogue = isCorrect
      ? (obj.successDialogue || obj.dialogue || 'Bonne réponse.')
      : (obj.failureDialogue || 'Ce n est pas la bonne réponse.');
    if (isCorrect) markHotspotCompleted(obj.id);
    if (isCorrect && (obj.logicRules || []).length) {
      triggerHotspot(obj.id);
    }
    if (isCorrect && obj.removeAfterUse && !state.removedSceneObjectIds.includes(obj.id)) {
      state.removedSceneObjectIds = [...state.removedSceneObjectIds, obj.id];
    }
    render();
    return;
  }

  if ((obj.logicRules || []).length) {
    triggerHotspot(obj.id);
    return;
  }

  const mode = obj.interactionMode || 'popup';
  const linkedItem = obj.linkedItemId ? getItemById(obj.linkedItemId) : null;
  const popupSrc = resolveAssetUrl(obj.popupImageId, obj.popupImageData || obj.popupImage)
    || resolveAssetUrl(obj.imageId, obj.imageData)
    || resolveAssetUrl(linkedItem?.imageId, linkedItem?.imageData);

  if (mode === 'popup' || mode === 'both') {
    if (popupSrc) {
      state.viewerImage = {
        id: obj.linkedItemId || obj.id,
        src: popupSrc,
        name: obj.name || linkedItem?.name || obj.popupImageName || 'Objet',
        caption: obj.dialogue || obj.name || linkedItem?.name || '',
      };
    }
  }

  if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
    if (!state.inventory.includes(obj.linkedItemId)) {
      state.inventory = [...state.inventory, obj.linkedItemId];
    }
    if (!state.selectedInventoryIds.includes(obj.linkedItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, obj.linkedItemId].slice(-2);
    }
    state.dialogue = obj.dialogue || ('Tu obtiens ' + (linkedItem?.name || obj.name || 'un objet') + '.');
  } else if (obj.dialogue) {
    state.dialogue = obj.dialogue;
  }

  if (obj.removeAfterUse && !state.removedSceneObjectIds.includes(obj.id)) {
    state.removedSceneObjectIds = [...state.removedSceneObjectIds, obj.id];
  }
  markHotspotCompleted(obj.id);

  render();
}

function applyTriggerHotspotAction(spotId) {
  const scene = getPlayScene();
  const spot = scene?.hotspots?.find((entry) => entry.id === spotId)
    || scene?.sceneObjects?.find((entry) => entry.id === spotId);
  if (!spot) return;
  const activeSpot = resolveHotspotInteraction(spot);
  if (!activeSpot) return;

  if (activeSpot.requiredHotspotId && !state.completedHotspotIds.includes(activeSpot.requiredHotspotId)) {
    state.dialogue = activeSpot.lockedMessage || 'Je ne peux pas faire ça maintenant.';
    render();
    return;
  }

  if (activeSpot.requiredItemId && !state.inventory.includes(activeSpot.requiredItemId)) {
    const need = getItemById(activeSpot.requiredItemId);
    state.dialogue = 'Il te faut ' + (need?.name || 'un objet') + ' pour faire ça.';
    render();
    return;
  }

  playHotspotSound(activeSpot);

  if (activeSpot.actionType === 'conversation') {
    openConversation(activeSpot);
    render();
    return;
  }

  if (activeSpot.enigmaId) {
    const enigma = getEnigmaById(activeSpot.enigmaId);
    if (enigma) {
      openEnigma(enigma, activeSpot);
      render();
      return;
    }
  }

  applyHotspotAction(activeSpot, spot.id);
  render();
}

function triggerHotspot(spotId) {
  return dispatch(gameActions.triggerHotspot(spotId));
}

function applyCinematicEnd(cinematic) {
  const endType = normalizeCinematicEndAction(cinematic?.onEndType || 'none');
  if (!cinematic || endType === 'none') return;

  if (endType === 'scene' && cinematic.targetSceneId) {
    goToScene(cinematic.targetSceneId, 'Nouvelle scene débloquée.');
    return;
  }

  if (endType === 'act' && cinematic.targetActId) {
    const actScene = getFirstSceneForAct(cinematic.targetActId);
    if (actScene) goToScene(actScene.id, 'Un nouvel acte commence.');
    return;
  }

  if (endType === 'item' && cinematic.rewardItemId) {
    const rewardItem = getItemById(cinematic.rewardItemId);
    if (!state.inventory.includes(cinematic.rewardItemId)) {
      state.inventory = [...state.inventory, cinematic.rewardItemId];
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemLabel(cinematic.rewardItemId),
        detail: cinematic.name || 'Cinématique',
      });
    }
    if (!state.selectedInventoryIds.includes(cinematic.rewardItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, cinematic.rewardItemId].slice(-2);
    }
    const rewardItemImageUrl = resolveAssetUrl(rewardItem?.imageId, rewardItem?.imageData);
    if (rewardItemImageUrl) {
      state.viewerImage = { id: rewardItem.id, src: rewardItemImageUrl, name: rewardItem.name };
    }
    state.dialogue = 'Tu obtiens ' + (rewardItem?.name || 'un nouvel objet') + '.';
  }
}

function dispatch(action = {}) {
  return standaloneEngine.dispatch(action);
}

function closeCinematic() {
  const cinematic = getCurrentCinematic();
  state.playingCinematicId = null;
  state.playingSlideIndex = 0;
  clearAnime2dTimer();
  anime2dActiveCinematicId = '';
  anime2dStartedAt = 0;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }

  applyCinematicEnd(cinematic);
  render();
}

function advanceCinematic() {
  const cinematic = getCurrentCinematic();
  if (!cinematic) return;
  if (cinematic.cinematicType === 'anime2d') {
    closeCinematic();
    return;
  }
  const total = cinematic.slides?.length || 0;
  if (state.playingSlideIndex + 1 >= total) {
    closeCinematic();
    return;
  }
  state.playingSlideIndex += 1;
  render();
}

function resetPreview() {
  stopSceneTimer();
  clearAnime2dTimer();
  anime2dActiveCinematicId = '';
  anime2dStartedAt = 0;
  sceneAnime2dActiveSceneId = '';
  sceneAnime2dStartedAt = 0;
  expiredSceneTimerKey = '';
  Object.assign(state, DEFAULT_STATE());
  state.inventoryDrawerOpen = false;
  closeEnigma();
  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  responseAmbienceAudio.pause();
  responseAmbienceAudio.removeAttribute('src');
  responseAmbienceAudio.load();
  render();
}

function clearControlsTimer() {
  if (controlsTimer) {
    clearTimeout(controlsTimer);
    controlsTimer = null;
  }
}

function revealControls(autoHide = true) {
  state.controlsVisible = true;
  clearControlsTimer();
  if (autoHide) {
    controlsTimer = setTimeout(() => {
      state.controlsVisible = false;
      render(false);
    }, 3000);
  }
  render(false);
}

function bindEvents() {
  root.querySelector('#fullscreen-toggle')?.addEventListener('click', toggleFullscreen);
  root.querySelector('#save-game')?.addEventListener('click', () => saveGame(true));
  root.querySelector('#load-game')?.addEventListener('click', () => loadGame(true));
  document.getElementById('delete-save')?.addEventListener('click', () => deleteSave(true));
  document.getElementById('export-save-json')?.addEventListener('click', exportSaveAsJson);
  document.getElementById('import-save-json')?.addEventListener('click', () => document.getElementById('import-save-file')?.click());
  document.getElementById('import-save-file')?.addEventListener('change', (event) => {
    importSaveFromJsonFile(event.target.files?.[0]);
    event.target.value = '';
  });
  document.getElementById('rename-save')?.addEventListener('click', renameCurrentSave);
  document.getElementById('clear-save')?.addEventListener('click', clearGameSave);
  root.querySelector('.player-shell')?.addEventListener('mousemove', (event) => {
    if (event.clientY <= 8) {
      if (!state.controlsVisible) revealControls(false);
    } else if (event.clientY > 96 && state.controlsVisible) {
      state.controlsVisible = false;
      clearControlsTimer();
      render(false);
    }
  });
  root.querySelector('#open-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = true;
    render();
  });
  root.querySelector('#close-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#collapse-narration')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.narrationCollapsed = true;
    render();
  });
  root.querySelector('#open-narration')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.narrationCollapsed = false;
    render();
  });
  root.querySelector('#pause-game')?.addEventListener('click', () => {
    state.pauseOpen = true;
    render(false);
  });
  root.querySelector('#resume-game')?.addEventListener('click', () => {
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#toggle-hints')?.addEventListener('click', () => {
    state.showInteractionHints = !state.showInteractionHints;
    render();
  });
  root.querySelector('#pause-toggle-hints')?.addEventListener('click', () => {
    state.showInteractionHints = !state.showInteractionHints;
    state.pauseOpen = false;
    render();
  });
  root.querySelector('#close-conversation')?.addEventListener('click', () => {
    closeConversation();
    render();
  });
  root.querySelector('#close-choice-effects')?.addEventListener('click', () => {
    state.choiceEffectNotices = [];
    render();
  });
  root.querySelector('#close-ending')?.addEventListener('click', () => {
    state.activeEnding = null;
    render();
  });
  root.querySelector('#restart-ending')?.addEventListener('click', resetPreview);
  root.querySelectorAll('[data-conversation-reply]').forEach((button) => {
    button.addEventListener('click', () => {
      const node = state.activeConversation?.conversation?.nodes?.find((entry) => entry.id === state.activeConversation.nodeId);
      const reply = node?.replies?.find((entry) => entry.id === button.dataset.conversationReply);
      chooseConversationReply(reply);
      render();
    });
  });
  root.querySelector('#pause-save-game')?.addEventListener('click', () => {
    saveGame(true);
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#pause-load-game')?.addEventListener('click', () => {
    loadGame(true);
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#pause-reset-preview')?.addEventListener('click', resetPreview);
  root.querySelector('#inventory-drawer-backdrop')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#scene-layer')?.addEventListener('click', () => {
    if (state.viewerImage) {
      state.viewerImage = null;
      render();
    }
  });

  root.querySelectorAll('#reset-preview').forEach((button) => button.addEventListener('click', resetPreview));

  root.querySelectorAll('[data-hotspot-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const scene = getPlayScene();
      const spot = scene?.hotspots?.find((entry) => entry.id === button.dataset.hotspotId);
      if (spot && !isPointerInsideElementShape(event, spot, button)) return;
      event.preventDefault();
      event.stopPropagation();
      triggerHotspot(button.dataset.hotspotId);
    });
  });

  root.querySelectorAll('[data-scene-object-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const scene = getPlayScene();
      const obj = scene?.sceneObjects?.find((entry) => entry.id === el.dataset.sceneObjectId);
      if (obj && !isPointerInsideElementShape(event, obj, el)) return;
      event.preventDefault();
      event.stopPropagation();
      triggerSceneObject(el.dataset.sceneObjectId);
    });
  });

  root.querySelectorAll('[data-item-id]').forEach((button) => {
    button.setAttribute('draggable', 'true');

    button.addEventListener('click', () => openInventoryItem(button.dataset.itemId));
    button.addEventListener('dragstart', () => {
      state.draggedInventoryId = button.dataset.itemId;
    });
    button.addEventListener('dragend', () => {
      state.draggedInventoryId = null;
    });
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      if (state.draggedInventoryId && state.draggedInventoryId !== button.dataset.itemId) {
        combineInventoryItems(state.draggedInventoryId, button.dataset.itemId);
      }
      state.draggedInventoryId = null;
    });
  });

  root.querySelectorAll('#combine-items').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.selectedInventoryIds.length !== 2) {
        state.dialogue = 'Selectionne 2 objets à combiner.';
        render();
        return;
      }
      combineInventoryItems(state.selectedInventoryIds[0], state.selectedInventoryIds[1]);
    });
  });

  root.querySelector('#close-cinematic')?.addEventListener('click', closeCinematic);
  root.querySelector('#advance-cinematic')?.addEventListener('click', advanceCinematic);
  root.querySelector('#prev-cinematic')?.addEventListener('click', () => {
    state.playingSlideIndex = Math.max(0, state.playingSlideIndex - 1);
    render();
  });

  root.querySelector('#cinematic-overlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'cinematic-overlay') closeCinematic();
  });

  root.querySelector('#cinematic-video')?.addEventListener('ended', closeCinematic);

  root.querySelector('#close-enigma')?.addEventListener('click', () => {
    closeEnigma();
    render();
  });

  root.querySelector('#submit-enigma')?.addEventListener('click', submitEnigma);

  root.querySelector('#enigma-input')?.addEventListener('input', (event) => {
    state.enigmaCodeInput = event.target.value;
  });

  root.querySelector('#enigma-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitEnigma();
  });

  root.querySelectorAll('[data-code-index]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const index = Number(input.dataset.codeIndex);
      const length = Number(input.dataset.codeLength) || 4;
      const chars = Array.from({ length }, (_, charIndex) => state.enigmaCodeInput[charIndex] || '');
      chars[index] = event.target.value.slice(-1).toUpperCase();
      state.enigmaCodeInput = chars.join('').trimEnd();
      render();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submitEnigma();
    });
  });

  root.querySelectorAll('[data-code-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.codeKey;
      const length = Number(button.dataset.codeLength) || 4;
      if (key === '?' || key === '?') {
        state.enigmaCodeInput = state.enigmaCodeInput.slice(0, -1);
      } else {
        state.enigmaCodeInput = (state.enigmaCodeInput + key).slice(0, length);
      }
      render();
    });
  });

  root.querySelector('#clear-code')?.addEventListener('click', () => {
    state.enigmaCodeInput = '';
    render();
  });

  root.querySelectorAll('[data-misc-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      state.enigmaCodeInput = button.dataset.miscChoice || '';
      render();
    });
  });

  root.querySelectorAll('[data-misc-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify([...current, button.dataset.miscOrder || '']);
      render();
    });
  });

  root.querySelectorAll('[data-misc-order-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const removeIndex = Number(button.dataset.miscOrderRemove);
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.filter((_, index) => index !== removeIndex));
      render();
    });
  });

  root.querySelectorAll('[data-misc-match-left]').forEach((select) => {
    select.addEventListener('change', () => {
      const current = parseJsonValue(state.enigmaCodeInput, {});
      state.enigmaCodeInput = JSON.stringify({ ...current, [select.dataset.miscMatchLeft]: select.value });
      render();
    });
  });

  root.querySelectorAll('[data-misc-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.miscToggle || '';
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.includes(choice) ?
         current.filter((entry) => entry !== choice)
        : [...current, choice]);
      render();
    });
  });

  root.querySelector('#clear-colors')?.addEventListener('click', () => {
    state.enigmaColorAttempt = [];
    render();
  });

  root.querySelectorAll('[data-enigma-color]').forEach((button) => {
    button.addEventListener('click', () => pushEnigmaColor(button.dataset.enigmaColor));
  });

  root.querySelectorAll('[data-puzzle-index]').forEach((button) => {
    button.addEventListener('click', () => clickPuzzlePiece(Number(button.dataset.puzzleIndex)));
  });

  root.querySelectorAll('[data-rotation-index]').forEach((button) => {
    button.addEventListener('click', () => rotatePuzzlePiece(Number(button.dataset.rotationIndex)));
  });

  root.querySelectorAll('[data-simon-color]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.simonPlayerTurn) return;
      pushEnigmaColor(button.dataset.simonColor);
    });
  });

  root.querySelector('#replay-simon')?.addEventListener('click', () => {
    if (state.activeEnigma?.enigma) startSimonPlayback(state.activeEnigma.enigma);
  });

  root.querySelectorAll('[data-slot-index]').forEach((button) => {
    button.addEventListener('click', () => returnDragPieceToBank(Number(button.dataset.slotIndex)));
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      moveDragPieceToSlot(state.enigmaDraggedPiece, Number(button.dataset.slotIndex));
      state.enigmaDraggedPiece = null;
    });
  });

  root.querySelectorAll('[data-bank-piece]').forEach((button) => {
    button.setAttribute('draggable', 'true');
    button.addEventListener('dragstart', () => {
      state.enigmaDraggedPiece = Number(button.dataset.bankPiece);
    });
    button.addEventListener('dragend', () => {
      state.enigmaDraggedPiece = null;
    });
  });
}

function renderCinematic(cinematic, slide) {
  if (!cinematic) return '';
  if (cinematic.cinematicType === 'anime2d') {
    const model = getAnime2dSpec(cinematic);
    const { layers, duration } = model;
    const time = Math.min(duration, getAnime2dElapsed(cinematic));
    const { visibleLayers, narration: frameNarration } = createAnime2dPreviewFrame(model, time);
    const fallbackNarration = cinematic.slides?.find((entry) => String(entry?.narration || '').trim())?.narration || '';
    const narration = frameNarration || fallbackNarration;

    return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card wide">'
      + '<div class="anime2d-player">'
      + (!layers.some((layer) => resolveAnime2dLayerSrc(layer)) ? '<p class="anime2d-player-empty">Aucune image embarquée dans ce JSON 2D Anime.</p>' : '')
      + visibleLayers.map((layer) => '<div class="anime2d-player-layer" style="left:' + safeHtml(layer.x || 50) + '%;top:' + safeHtml(layer.y || 50) + '%;width:' + safeHtml(layer.width || 28) + '%;height:' + safeHtml(layer.height || ((layer.width || 28) * 1.6)) + '%;opacity:' + safeHtml(Number(layer.opacity || 100) / 100) + ';z-index:' + safeHtml(layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2) + '">'
        + '<span class="anime2d-embedded-animated anime2d-preset-' + safeHtml(layer.preset || 'none') + '" style="animation-duration:' + safeHtml(layer.duration || 1000) + 'ms;animation-delay:' + safeHtml(layer.delay || 0) + 'ms;animation-iteration-count:' + (layer.loop === false ? '1' : 'infinite') + '">'
        + (resolveAnime2dLayerSrc(layer) ? '<img src="' + escapeMediaAttr(resolveAnime2dLayerSrc(layer), 'image') + '" alt="' + escapeAttr(layer.name || '') + '" loading="eager" decoding="sync" />' : '')
        + '</span>'
        + '</div>').join('')
      + (narration ? '<p class="anime2d-player-narration">' + safeHtml(narration) + '</p>' : '')
      + '</div>'
      + '<p class="small-note">' + safeHtml(duration.toFixed(1)) + 's</p>'
      + '<div class="panel-head"><span></span><button id="close-cinematic" class="secondary-button">Terminer</button></div>'
      + '</div></div>';
  }
  if ((cinematic.cinematicType || 'slides') === 'video') {
    const videoSrc = resolveAssetUrl(cinematic.videoId, cinematic.videoData, 'video');
    return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
      + (videoSrc ?
         '<video id="cinematic-video" class="overlay-media" preload="auto" src="' + escapeMediaAttr(videoSrc, 'video') + '" '
          + (cinematic.videoControls === false ? '' : 'controls ') + (cinematic.videoAutoplay === false ? '' : 'autoplay ')
          + '></video>'
        : '<p class="small-note">Ajoute une vidéo dans l’éditeur de cinematic.</p>')
      + '<p class="narration">' + safeHtml(cinematic.name || 'Cinématique') + '</p>'
      + '<div class="panel-head"><span></span><button id="close-cinematic">Terminer</button></div></div></div>';
  }

  if (!slide) return '';
  const slideImageSrc = resolveAssetUrl(slide.imageId, slide.imageData, 'image');
  const slideAudioSrc = resolveAssetUrl(slide.audioId, slide.audioData, 'audio');

  return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
    + (slideImageSrc ? '<img class="overlay-media" loading="eager" decoding="async" src="' + escapeMediaAttr(slideImageSrc, 'image') + '" alt="' + escapeAttr(slide.imageName || slide.narration || 'Cinématique') + '" />' : '')
    + (slideAudioSrc ? '<audio id="cinematic-audio" autoplay src="' + escapeMediaAttr(slideAudioSrc, 'audio') + '" style="display:none"></audio>' : '')
    + '<p class="narration">' + safeHtml(slide.narration || '') + '</p>'
    + '<div class="panel-head">'
    + '<button id="prev-cinematic" class="secondary-button">Précédent</button>'
    + '<button id="advance-cinematic">Suivant</button>'
    + '<button id="close-cinematic" class="secondary-button">Terminer</button>'
    + '</div></div></div>';
}

function renderEnigma(enigma) {
  if (!enigma) return '';

  const rows = Number(enigma.gridRows) || 3;
  const cols = Number(enigma.gridCols) || 3;
  const pieceCount = rows * cols;
  const enigmaImageUrl = resolveAssetUrl(enigma.imageId, enigma.imageData);
  const enigmaPopupBackgroundUrl = resolveAssetUrl(enigma.popupBackgroundId, enigma.popupBackgroundData);
  const overlayGradient = POPUP_OVERLAY_GRADIENTS[enigma.popupBackgroundOverlay] || POPUP_OVERLAY_GRADIENTS.dark;
  const overlayStyle = enigmaPopupBackgroundUrl ?
     ' style="background-image:' + overlayGradient + ', ' + cssMediaUrl(enigmaPopupBackgroundUrl, 'image') + ';background-size:' + Math.round((Number(enigma.popupBackgroundZoom) || 1) * 100) + '%;background-position:' + (Number(enigma.popupBackgroundX) || 50) + '% ' + (Number(enigma.popupBackgroundY) || 50) + '%;background-repeat:no-repeat"'
    : '';

  let body = '';

  if (enigma.type === 'code') {
    const codeSkin = enigma.codeSkin || 'safe-wheels';
    const codeLength = Math.min(Math.max(4, String(enigma.solutionText || '').length || 4), 8);
    const codeSlots = Array.from({ length: codeLength }, (_, index) => state.enigmaCodeInput[index] || '');
    const slotInputStyle = 'width:54px;height:64px;text-align:center;font-size:24px;font-weight:900;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(12,21,39,.9);color:white;outline:none';
    const boxInputStyle = 'width:50px;height:50px;text-align:center;font-size:22px;font-weight:900;border-radius:8px;border:2px solid rgba(96,165,250,.75);background:rgba(12,21,39,.9);color:white;outline:none';
    const primaryButtonStyle = 'color:#fff;background:linear-gradient(180deg,#4f8cff 0%,#2f6fe4 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(47,111,228,.24)';
    const keypadKeys = CODE_KEYPAD_KEYS;

    if (codeSkin === 'safe-wheels') {
      body = '<div><label>Roulettes du coffre</label><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
        + codeSlots.map((char, index) => '<input data-code-index="' + index + '" data-code-length="' + codeLength + '" maxlength="1" value="' + safeHtml(char) + '" style="' + slotInputStyle + ';background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.04))" />').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'digicode') {
      body = '<div><label>Digicode</label><div style="display:flex;gap:8px;justify-content:center;margin:10px 0 14px">'
        + codeSlots.map((char) => '<span style="width:42px;height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;font-size:22px;font-weight:900;background:rgba(15,23,42,.68)">' + safeHtml(char || '?') + '</span>').join('')
        + '</div><div style="display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-content:center">'
        + keypadKeys.map((key) => '<button type="button" data-code-key="' + key + '" data-code-length="' + codeLength + '" style="height:52px;font-size:20px;font-weight:900;color:#f8fbff;background:linear-gradient(180deg, rgba(59,130,246,.32), rgba(30,41,59,.96));border:1px solid rgba(147,197,253,.34);box-shadow:0 10px 22px rgba(15,23,42,.28)">' + key + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="clear-code" style="color:#dbeafe;background:rgba(15,23,42,.92);border:1px solid rgba(147,197,253,.28)">Effacer</button><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'boxes') {
      body = '<div><label>Cases du code</label><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
        + codeSlots.map((char, index) => '<input data-code-index="' + index + '" data-code-length="' + codeLength + '" maxlength="1" value="' + safeHtml(char) + '" style="' + boxInputStyle + '" />').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'paper-strip') {
      body = '<div><label>Bande papier</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.92);color:#0f172a;outline:none;text-align:center;font-family:monospace;font-size:24px;font-weight:900;letter-spacing:8px;text-transform:uppercase" />'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else {
      body = '<div><label>Code</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    }
  }

  if (enigma.type === 'colors') {
    body = '<div><label>Suite en cours</label><div class="color-attempt-row">'
      + (state.enigmaColorAttempt.length ?
         state.enigmaColorAttempt.map((color, index) => '<span class="color-chip" style="background:' + color + '"></span>').join('')
        : '<span class="small-note">Aucune couleur choisie.</span>')
      + '</div><div class="color-picker-grid">'
      + PREVIEW_COLOR_OPTIONS.map(([value, label]) => '<button type="button" class="color-picker-button" data-enigma-color="' + value + '" title="' + label + '" style="background:' + value + '"></button>').join('')
      + '</div><div class="panel-head"><button id="clear-colors" class="secondary-button">Effacer la suite</button><button id="submit-enigma">Valider l’énigme</button></div></div>';
  }

  if (enigma.type === 'misc') {
    const miscMode = enigma.miscMode || 'free-answer';
    const primaryButtonStyle = 'color:#fff;background:linear-gradient(180deg,#4f8cff 0%,#2f6fe4 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(47,111,228,.24)';
    const secondaryButtonStyle = 'color:#dbeafe;background:rgba(15,23,42,.92);border:1px solid rgba(147,197,253,.28)';
    if (miscMode === 'multiple-choice') {
      body = '<div><label>Choisis une réponse</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscChoices || []).map((choice) => '<button type="button" data-misc-choice="' + safeHtml(choice) + '" style="' + (state.enigmaCodeInput === choice ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'true-false') {
      body = '<div><label>Choisis une réponse</label><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">'
        + ['vrai', 'faux'].map((choice) => '<button type="button" data-misc-choice="' + choice + '" style="' + (state.enigmaCodeInput === choice ? primaryButtonStyle : secondaryButtonStyle) + '">' + (choice === 'vrai' ? 'Vrai' : 'Faux') + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'ordering') {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      body = '<div><label>Remets dans l’ordre</label><div style="display:grid;gap:10px;margin-top:10px">'
        + '<div class="color-attempt-row">'
        + (current.length ? current.map((choice, index) => '<button type="button" data-misc-order-remove="' + index + '" style="' + secondaryButtonStyle + '">' + (index + 1) + '. ' + safeHtml(choice) + '</button>').join('') : '<span class="small-note">Clique les éléments dans le bon ordre.</span>')
        + '</div>'
        + (enigma.miscChoices || []).filter((choice) => !current.includes(choice)).map((choice) => '<button type="button" data-misc-order="' + safeHtml(choice) + '" style="' + secondaryButtonStyle + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'matching') {
      const answers = parseJsonValue(state.enigmaCodeInput, {});
      body = '<div><label>Associe les paires</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscPairs || []).map((pair) => '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center"><strong>' + safeHtml(pair.left || '') + '</strong><select data-misc-match-left="' + safeHtml(pair.left || '') + '"><option value="">Choisir</option>'
          + (enigma.miscPairs || []).map((entry) => '<option value="' + safeHtml(entry.right || '') + '"' + (answers[pair.left] === entry.right ? ' selected' : '') + '>' + safeHtml(entry.right || '') + '</option>').join('')
          + '</select></div>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'numeric-range' || miscMode === 'exact-number') {
      body = '<div><label>' + (miscMode === 'exact-number' ? 'Nombre exact' : 'Nombre') + '</label><input id="enigma-input" type="number" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<p class="small-note">' + (miscMode === 'exact-number' ? 'La réponse doit correspondre au nombre attendu.' : 'La réponse doit être comprise entre ' + safeHtml(enigma.miscMin ?? '') + ' et ' + safeHtml(enigma.miscMax ?? '') + '.') + '</p>'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'item-select') {
      body = '<div><label>Choisis l’objet</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (project.items || []).map((item) => '<button type="button" data-misc-choice="' + safeHtml(item.id) + '" style="' + (state.enigmaCodeInput === item.id ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(item.name || 'Objet') + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'multi-select') {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      body = '<div><label>Selectionne toutes les bonnes réponses</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscChoices || []).map((choice) => '<button type="button" data-misc-toggle="' + safeHtml(choice) + '" style="' + (current.includes(choice) ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else {
      body = '<div><label>' + (miscMode === 'fill-blank' ? 'Mot manquant' : 'Réponse') + '</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" placeholder="Écris ta réponse..." '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<p class="small-note">La réponse est acceptée même avec des majuscules différentes ou des mots en plus.</p>'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    }
  }

  if (enigma.type === 'simon') {
    body = '<div><p class="small-note">' + (state.simonPlayerTurn ? 'À toi de rejouer la sequence.' : 'Observe la sequence.') + '</p>'
      + '<div class="color-picker-grid simon-grid">'
      + PREVIEW_COLOR_OPTIONS.slice(0, 4).map(([value, label], index) => {
        const solutionColor = (enigma.solutionColors || [])[state.simonPlaybackIndex];
        const lit = solutionColor === value ? ' active' : '';
        return '<button type="button" class="color-picker-button simon-pad' + lit + '" data-simon-color="' + value + '" title="' + label + '" style="background:' + value + '"' + (state.simonPlayerTurn ? '' : ' disabled') + '>' + (index + 1) + '</button>';
      }).join('')
      + '</div><div class="color-attempt-row" style="margin-top:14px">'
      + state.enigmaColorAttempt.map((color) => '<span class="color-chip" style="background:' + color + '"></span>').join('')
      + '</div><div class="inventory-actions"><button id="replay-simon" class="secondary-button">Rejouer la sequence</button></div></div>';
  }

  if (enigma.type === 'puzzle' && enigmaImageUrl) {
    body = '<div><p class="small-note">Clique une pièce, puis une deuxième pour les échanger.</p>'
      + '<div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + state.enigmaPuzzleOrder.map((pieceIndex, index) => '<button type="button" data-puzzle-index="' + index + '" class="puzzle-piece'
        + (state.enigmaPuzzleSelectedIndex === index ? ' selected' : '') + '" style="' + makePieceStyle(enigmaImageUrl, rows, cols, pieceIndex) + '"></button>').join('')
      + '</div></div>';
  }

  if (enigma.type === 'rotation' && enigmaImageUrl) {
    body = '<div><p class="small-note">Clique sur chaque pièce pour la remettre à l’endroit.</p>'
      + '<div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + Array.from({ length: pieceCount }, (_, index) => '<button type="button" data-rotation-index="' + index + '" class="puzzle-piece" style="'
        + makePieceStyle(enigmaImageUrl, rows, cols, index, state.enigmaRotationAngles[index] || 0) + '"></button>').join('')
      + '</div></div>';
  }

  if (enigma.type === 'dragdrop' && enigmaImageUrl) {
    body = '<div><p class="small-note">Glisse les pièces vers la bonne case. Clique une case remplie pour renvoyer sa pièce dans la réserve.</p>'
      + '<div class="dragdrop-layout"><div><h3>Plateau</h3><div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + state.enigmaDragSlots.map((pieceIndex, slotIndex) => '<button type="button" data-slot-index="' + slotIndex + '" class="puzzle-slot">'
        + (pieceIndex !== null && pieceIndex !== undefined ?
           '<span class="puzzle-piece static" style="' + makePieceStyle(enigmaImageUrl, rows, cols, pieceIndex) + '"></span>'
          : '<span class="slot-index">' + (slotIndex + 1) + '</span>') + '</button>').join('')
      + '</div></div><div><h3>Pièces</h3><div class="bank-grid">'
      + state.enigmaDragBank.map((pieceIndex) => '<button type="button" data-bank-piece="' + pieceIndex + '" class="puzzle-piece" draggable="true" style="'
        + makePieceStyle(enigmaImageUrl, rows, cols, pieceIndex) + '"></button>').join('')
      + '</div></div></div></div>';
  }

  if (usesImage(enigma.type) && !enigmaImageUrl) {
    body = '<p class="small-note">Ajoute une image dans l’éditeur d’énigmes pour jouer cette énigme.</p>';
  }

  return '<div class="overlay" id="enigma-overlay"><div class="overlay-card"' + overlayStyle + '><div class="panel-head"><div><h2 style="margin:0">'
    + safeHtml(enigma.name || 'énigme') + '</h2><p class="small-note" style="margin:6px 0 0">'
    + safeHtml(enigma.question || '') + '</p></div><button id="close-enigma" class="danger-button">Fermer</button></div>'
    + body + '</div></div>';
}

function renderConversation() {
  const conversation = state.activeConversation?.conversation;
  const node = conversation?.nodes?.find((entry) => entry.id === state.activeConversation.nodeId);
  if (!node) return '';
  const visibleReplies = (node.replies || []).filter(isConversationReplyAvailable);
  const lockedReplies = IS_CHOICE_ADVENTURE ? (node.replies || []).filter((reply) => {
    const isConsumed = reply.id && (
      state.hiddenConversationReplyIds.includes(reply.id)
      || (reply.hideAfterChosen && state.chosenConversationReplyIds.includes(reply.id))
    );
    return !isConversationReplyAvailable(reply) && reply.showWhenLocked && !isConsumed;
  }) : [];
  const displayedReplies = visibleReplies.concat(lockedReplies);
  const replyColumnClass = 'conversation-player-replies-' + Math.min(3, Math.max(1, displayedReplies.length || 1));
  const portraitSrc = safeMediaUrl(state.activeConversation?.portraitData, 'image');
  return '<div class="overlay' + (IS_CHOICE_ADVENTURE ? ' conversation-player-overlay' : '') + '"><div class="overlay-card wide' + (IS_CHOICE_ADVENTURE ? ' conversation-player-card' : '') + '">'
    + '<div class="panel-head">'
    + (portraitSrc ? '<img class="conversation-portrait" src="' + escapeMediaAttr(portraitSrc, 'image') + '" alt="' + escapeAttr(state.activeConversation.portraitName || node.speaker || 'Portrait') + '" />' : '')
    + '<div><h2>' + safeHtml(node.speaker || 'Conversation') + '</h2><p class="small-note">' + safeHtml(node.text || '') + '</p></div><button id="close-conversation" class="danger-button" type="button">Fermer</button></div>'
    + renderChoiceEffectSummary(true)
    + '<div class="stack-10' + (IS_CHOICE_ADVENTURE ? ' conversation-player-replies ' + replyColumnClass : '') + '">'
    + (displayedReplies.length ? displayedReplies.map((reply) => {
      const isLocked = !isConversationReplyAvailable(reply);
      const reason = isLocked ? getConversationReplyLockReason(reply) : '';
      return '<button type="button" class="secondary-action' + (isLocked ? ' conversation-reply-locked' : '') + '" ' + (isLocked ? 'disabled title="' + safeHtml(reason || 'Choix verrouille') + '"' : 'data-conversation-reply="' + safeHtml(reply.id) + '"') + '><span>' + safeHtml(reply.label || 'Repondre') + '</span>' + (isLocked ? '<small>' + safeHtml(reason || 'Choix verrouille') + '</small>' : '') + '</button>';
    }).join('') : '<button id="close-conversation" type="button">Continuer</button>')
    + '</div></div></div>';
}

function renderChoiceEffectSummary(compact = false) {
  const notices = Array.isArray(state.choiceEffectNotices) ? state.choiceEffectNotices : [];
  if (!notices.length) return '';
  return '<div class="choice-effect-summary' + (compact ? ' compact' : '') + '">'
    + '<div class="choice-effect-summary-head"><strong>Conséquences du choix</strong><button id="close-choice-effects" type="button" class="secondary-action">Masquer</button></div>'
    + '<div class="choice-effect-list">'
    + notices.map((notice, index) => '<span class="choice-effect-pill choice-effect-' + safeHtml(notice.type || 'effect') + '" data-effect-index="' + index + '"><strong>' + safeHtml(notice.title || 'Effet') + '</strong>' + (notice.detail ? '<small>' + safeHtml(notice.detail) + '</small>' : '') + '</span>').join('')
    + '</div></div>';
}

function renderChoiceEffectFloating() {
  if (state.activeConversation || state.activeEnding || !Array.isArray(state.choiceEffectNotices) || !state.choiceEffectNotices.length) return '';
  return '<div class="choice-effect-floating">' + renderChoiceEffectSummary(false) + '</div>';
}

function renderEnding() {
  if (!state.activeEnding) return '';
  const ending = state.activeEnding;
  return '<div class="overlay"><div class="overlay-card ending-card ending-card-' + safeHtml(ending.type || 'neutral') + '">'
    + '<span class="ending-badge">' + safeHtml(ending.label || 'Fin') + '</span>'
    + '<h2>' + safeHtml(ending.title || ending.label || 'Fin') + '</h2>'
    + (ending.message ? '<p class="small-note">' + safeHtml(ending.message) + '</p>' : '')
    + '<p>' + safeHtml(ending.summary || 'Ton aventure se termine ici.') + '</p>'
    + renderChoiceEffectSummary(true)
    + '<div class="inline-actions"><button id="close-ending" type="button" class="secondary-action">Fermer</button><button id="restart-ending" type="button">Recommencer</button></div>'
    + '</div></div>';
}

function renderAdventureStateSummary() {
  const variableEntries = Object.entries(state.storyVariables || {}).filter(([key]) => {
    const variable = (project.storyVariables || []).find((entry) => entry.key === key);
    return variable ? variable.journalVisible !== false : true;
  });
  const journalEntries = Array.isArray(state.adventureJournalEntries) ? state.adventureJournalEntries : [];
  const activeEndingCount = state.activeEnding ? 1 : 0;
  return '<div class="adventure-state-card"><strong>Progression narrative</strong>'
    + '<div class="adventure-state-grid">'
    + '<span><strong>' + safeHtml(String(state.chosenConversationReplyIds?.length || 0)) + '</strong> choix</span>'
    + '<span><strong>' + safeHtml(String(state.completedHotspotIds?.length || 0)) + '</strong> actions</span>'
    + '<span><strong>' + safeHtml(String(variableEntries.length)) + '</strong> variables</span>'
    + '<span><strong>' + safeHtml(String(activeEndingCount)) + '</strong> fin</span>'
    + '</div>'
    + '<div class="adventure-state-list">'
    + (variableEntries.length
      ? variableEntries.map(([key, value]) => '<span><strong>' + safeHtml(getStoryVariableJournalLabel(key)) + '</strong> = ' + safeHtml(String(value)) + '</span>').join('')
      : '<span>Aucune variable d’histoire modifiée.</span>')
    + (state.activeEnding ? '<span><strong>Fin active</strong> = ' + safeHtml(state.activeEnding.title || state.activeEnding.label || 'Fin') + '</span>' : '')
    + '</div></div>'
    + '<div class="adventure-journal-card"><strong>Journal joueur</strong><div class="adventure-journal-grid">'
    + '<section><strong>Historique</strong><div class="adventure-journal-list">'
    + (journalEntries.length
      ? journalEntries.slice(0, 4).map((entry) => '<span><strong>' + safeHtml(entry.title || 'Note') + '</strong>' + (entry.detail ? '<small>' + safeHtml(entry.detail) + '</small>' : '') + '</span>').join('')
      : '<span>Aucun choix important note.</span>')
    + '</div></section><section><strong>Indices et état</strong><div class="adventure-state-list">'
    + (state.inventory?.length
      ? state.inventory.slice(0, 4).map((itemId) => '<span>' + safeHtml(getJournalItemLabel(itemId)) + '</span>').join('')
      : '<span>Aucun indice obtenu.</span>')
    + (variableEntries.length
      ? variableEntries.map(([key, value]) => '<span><strong>' + safeHtml(getStoryVariableJournalLabel(key)) + '</strong> = ' + safeHtml(String(value)) + '</span>').join('')
      : '')
    + '</div></section></div></div>';
}

function render(shouldSave = true) {
  const playScene = getPlayScene();
  const cinematic = getCurrentCinematic();
  const currentSlide = getCurrentSlide();
  const enigma = state.activeEnigma?.enigma || null;
  const sceneAspectRatio = Number(playScene?.backgroundAspectRatio) > 0 ? Number(playScene.backgroundAspectRatio) : 1.6;
  const playSceneBackgroundUrl = resolveAssetUrl(playScene?.backgroundId, playScene?.backgroundData);
  const viewerImageSrc = safeMediaUrl(state.viewerImage?.src, 'image');
  const transitionSceneBackgroundUrl = resolveAssetUrl(state.sceneTransitionOverlay?.scene?.backgroundId, state.sceneTransitionOverlay?.scene?.backgroundData);
  const inventoryDrawerTitle = project?.heroAdventure?.enabled ? GAME_TITLE : IS_CHOICE_ADVENTURE ? 'Carnet d’aventure' : 'Inventaire';
  if (!hasRenderedOnce && !loadedActId) loadedActId = playScene?.actId || '';

  root.innerHTML = '<div class="player-shell is-shared-player ' + (IS_CHOICE_ADVENTURE ? 'is-choice-adventure ' : '') + 'player-button-style-' + safeHtml(PLAYER_BUTTON_STYLE) + ' player-button-font-' + safeHtml(PLAYER_BUTTON_FONT) + ' player-narration-font-' + safeHtml(PLAYER_NARRATION_FONT) + ' ' + (state.showInteractionHints ? 'show-hints' : 'hide-hints') + ' ' + (state.controlsVisible ? '' : 'controls-hidden') + '" style="--player-narration-bg:' + safeHtml(PLAYER_NARRATION_BACKGROUND) + '">'
    + '<section class="panel player-stage-panel">'
    + '<div class="player-topbar">'
    + '<div><span class="eyebrow">Player</span><strong>' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</strong></div>'
    + '<div class="player-actions">'
    + '<button id="pause-game" type="button" class="secondary-action">Pause</button>'
    + '<button id="reset-preview" type="button" class="secondary-action player-reset-button">Recommencer</button>'
    + '<button id="save-game" type="button" class="secondary-action">Sauvegarder</button>'
    + '<button id="load-game" type="button" class="secondary-action">Charger</button>'
    + '<button id="toggle-hints" type="button" class="secondary-action">' + (state.showInteractionHints ? 'Sans aide' : 'Aide visuelle') + '</button>'
    + '<button id="fullscreen-toggle" type="button" class="secondary-action">Plein écran</button>'
    + '</div></div>'
    + '<div class="scene-player" id="scene-layer" style="--scene-aspect:' + sceneAspectRatio + '">'
    + (playSceneBackgroundUrl ?
       '<img class="bg" src="' + escapeMediaAttr(playSceneBackgroundUrl, 'image') + '" alt="' + escapeAttr(playScene.name || 'Scene') + '" onload="setSceneAspectFromImage(this)" />'
      : '<div class="placeholder">Ajoute un fond pour jouer la scène.</div>')
    + (playScene?.visualEffect && playScene.visualEffect !== 'none' ? '<div class="scene-visual-effect scene-visual-effect--' + safeHtml(playScene.visualEffect) + ' scene-visual-effect--' + safeHtml(playScene.visualEffectIntensity || 'normal') + '"></div>' : '')
    + (playScene?.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => '<div class="scene-visual-effect scene-visual-effect-zone scene-visual-effect--' + safeHtml(zone.effect || 'sparkles') + ' scene-visual-effect--' + safeHtml(zone.intensity || 'normal') + '" style="left:' + zone.x + '%;top:' + zone.y + '%;width:' + zone.width + '%;height:' + zone.height + '%;z-index:' + getVisualEffectZoneZIndex(zone.layer) + ';' + getElementShapeStyle(zone) + '"></div>').join('')
    + (playScene?.hotspots || []).map((spot) => '<button type="button" class="player-hotspot" data-hotspot-id="' + spot.id + '" '
      + 'style="left:' + spot.x + '%;top:' + spot.y + '%;width:' + spot.width + '%;height:' + spot.height + '%;z-index:20;cursor:pointer;' + getElementShapeStyle(spot) + '" title="' + safeHtml(spot.name || '') + '"></button>').join('')
    + (playScene?.sceneObjects || []).filter((obj) => !state.removedSceneObjectIds.includes(obj.id) && (!obj.isHidden || state.revealedSceneObjectIds.includes(obj.id))).map((obj) => {
      const objectTextOverride = state.sceneObjectTextOverrides?.[obj.id];
      const renderObject = applySceneObjectTextOverride(obj, objectTextOverride);
      const linkedItem = obj.linkedItemId ? getItemById(obj.linkedItemId) : null;
      const displayImage = resolveAssetUrl(obj.imageId, obj.imageData) || resolveAssetUrl(linkedItem?.imageId, linkedItem?.imageData);
      const clickMode = getSceneObjectClickMode(renderObject);
      const blockType = getSceneObjectBlockType(renderObject);
      const title = renderObject.blockLabel || renderObject.name || linkedItem?.name || 'Bloc';
      const text = renderObject.blockText || renderObject.dialogue || title;
      const blockStyle = ' style="font-size:' + getSceneObjectFontSize(renderObject) + 'px"';
      let content = '';
      if (!renderObject.isInvisible && renderObject.anime2dSpec) {
        content = renderAnime2dEmbedded(renderObject.anime2dSpec, getSceneAnime2dElapsed(playScene));
      } else if (!renderObject.isInvisible && displayImage) {
        content = '<img src="' + escapeMediaAttr(displayImage, 'image') + '" alt="' + escapeAttr(title) + '" />';
      } else if (!renderObject.isInvisible && blockType === 'text') {
        content = '<span class="interactive-block interactive-block--text"' + blockStyle + '>' + safeHtml(text) + '</span>';
      } else if (!renderObject.isInvisible && blockType === 'hint') {
        content = '<span class="interactive-block interactive-block--hint"' + blockStyle + '><strong>' + safeHtml(title || 'Indice') + '</strong><small>' + safeHtml(text || 'Un indice est disponible.') + '</small></span>';
      } else if (!renderObject.isInvisible && blockType === 'button') {
        content = '<span class="interactive-block interactive-block--button"' + blockStyle + '>' + safeHtml(renderObject.buttonLabel || title || 'Bouton') + '</span>';
      } else if (!renderObject.isInvisible && blockType === 'input') {
        content = '<span class="interactive-block interactive-block--field"' + blockStyle + '><strong>' + safeHtml(title || 'Réponse') + '</strong><small>' + safeHtml(renderObject.placeholder || 'Saisir une réponse...') + '</small></span>';
      } else if (!renderObject.isInvisible && blockType === 'code') {
        const slots = Math.max(3, Math.min(8, String(renderObject.expectedAnswer || '0000').length || 4));
        content = '<span class="interactive-block interactive-block--code"' + blockStyle + '><strong>' + safeHtml(title || 'Code') + '</strong><span>' + Array.from({ length: slots }, () => '&bull;').join(' ') + '</span></span>';
      } else if (!renderObject.isInvisible && blockType === 'image') {
        content = '<span class="interactive-block interactive-block--image"' + blockStyle + '>' + safeHtml(title || 'Image') + '</span>';
      } else if (!renderObject.isInvisible) {
        content = '<span>' + safeHtml(title || 'Objet') + '</span>';
      }
      return '<button type="button" class="player-scene-object' + (obj.isInvisible ? ' player-scene-object-invisible' : '') + (clickMode === 'none' ? ' player-scene-object-not-clickable' : '') + '" data-scene-object-id="' + obj.id + '" '
        + 'style="left:' + obj.x + '%;top:' + obj.y + '%;width:' + obj.width + '%;height:' + obj.height + '%;z-index:18;' + getElementShapeStyle(obj) + '" title="' + safeHtml(obj.name || 'Objet') + '" aria-label="' + safeHtml(obj.name || 'Objet invisible') + '">'
        + content
        + '</button>';
    }).join('')
    + (playScene?.timerEnabled ? '<div class="scene-timer-hud"><strong id="scene-timer-count">' + formatSceneTimerSeconds(state.sceneTimerRemaining || playScene.timerSeconds || 0) + '</strong>'
      + (playScene.timerEndAction === 'damage-life' ? '<span>Vies: ' + safeHtml(state.playerLives ?? 3) + '</span>' : '')
      + '</div>' : '')
    + (viewerImageSrc ? '<div class="scene-inline-viewer"><div class="scene-inline-viewer__backdrop"></div><div class="scene-inline-viewer__card">'
      + '<img class="scene-inline-viewer__image" src="' + escapeMediaAttr(viewerImageSrc, 'image') + '" alt="' + escapeAttr(state.viewerImage.name || 'Objet') + '" />'
      + '<div class="scene-inline-viewer__name">' + safeHtml(state.viewerImage.caption || state.viewerImage.name || 'Objet') + '</div></div></div>' : '')
    + (state.sceneTransitionOverlay ? '<div class="scene-transition-overlay scene-transition-overlay--' + safeHtml(state.sceneTransitionOverlay.type || 'fade') + '" style="--scene-transition-duration:' + (Number(state.sceneTransitionOverlay.duration) || 700) + 'ms">'
      + (transitionSceneBackgroundUrl ?
        '<img src="' + escapeMediaAttr(transitionSceneBackgroundUrl, 'image') + '" alt="" />'
        : '<div class="placeholder">Scène précédente</div>')
      + '</div>' : '')
    + (state.actPreload?.active ? '<div class="act-preload-overlay" role="status" aria-live="polite"><div class="act-preload-card"><span class="eyebrow">Chargement</span><strong>'
      + safeHtml(state.actPreload.label || 'Acte suivant') + '</strong><div class="act-preload-bar" aria-label="Chargement ' + safeHtml(state.actPreload.progress || 0) + '%"><span style="width:'
      + safeHtml(state.actPreload.progress || 0) + '%"></span></div><small>' + safeHtml(state.actPreload.progress || 0) + '% des médias de l\\'acte sont prêts</small></div></div>' : '')
    + '<div class="player-narration-bar ' + (state.narrationCollapsed ? 'is-collapsed' : '') + '">'
    + (state.narrationCollapsed ?
       '<button id="open-narration" type="button" class="narration-discreet-button">Texte</button>'
      : '<p id="collapse-narration" role="button" tabindex="0">' + safeHtml(state.dialogue || 'Aucun message.') + '</p>')
    + '<button id="open-inventory-drawer" type="button" class="inventory-discreet-button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + (state.inventory.length ? ' (' + state.inventory.length + ')' : '') + '</button>'
    + '</div>'
    + (state.inventoryDrawerOpen ? '<div class="player-inventory-drawer' + (IS_CHOICE_ADVENTURE ? ' player-inventory-drawer--adventure' : '') + '"><div class="panel-head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button id="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div>' + (IS_CHOICE_ADVENTURE ? renderAdventureStateSummary() : '') + '<button id="combine-items" class="secondary-action player-combine-button" type="button">Combiner les 2 objets</button><div class="inventory-grid">'
      + (state.inventory.length ? state.inventory.map((itemId) => {
        const item = getItemById(itemId);
        if (!item) return '';
        const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
        return '<button type="button" class="inventory-tile'
          + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
          + '<div class="inventory-thumb">'
          + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
          + '</div><strong>' + safeHtml(item.name || '') + '</strong></button>';
      }).join('') : '<p>Aucun objet.</p>')
      + '</div></div>' : '')
    + '</div></section>'

    + '<section class="panel side player-side-panel">'
    + '<div class="badge-line">' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</div>'
    + '<div class="dialogue-box"><p>' + safeHtml(state.dialogue || 'Aucun message.') + '</p></div>'
    + '<div class="panel-head"><h3>Inventaire</h3><button id="combine-items">Combiner les 2 objets</button></div>'
    + '<div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong></button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></section>'
    + '</div>'
    + '<div class="fullscreen-hud">'
    + '<div class="fullscreen-dialogue">' + safeHtml(state.dialogue || 'Aucun message.') + '</div>'
    + '<div class="fullscreen-actions"><button id="save-game" class="hud-button" type="button">Sauvegarder</button><button id="load-game" class="hud-button" type="button">Charger</button><button id="export-save-json" class="hud-button" type="button">Exporter JSON</button><button id="import-save-json" class="hud-button" type="button">Importer JSON</button><button id="open-inventory-drawer" class="hud-button" type="button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + '</button></div>'
    + '</div>'
    + (state.inventoryDrawerOpen ? '<div id="inventory-drawer-backdrop" class="inventory-drawer__backdrop"></div><aside class="inventory-drawer open"><div class="inventory-drawer__head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button id="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div><div class="inventory-actions"><button id="combine-items" type="button">Combiner les 2 objets</button></div><div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong></button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></aside>' : '')
    + (state.pauseOpen ? '<div class="player-pause-overlay"><div class="player-pause-menu"><span class="eyebrow">Pause</span><h2>' + safeHtml(GAME_TITLE) + '</h2>' + renderAdventureStateSummary() + '<div class="player-pause-actions">'
      + '<button id="resume-game" type="button">Reprendre</button>'
      + '<button id="pause-save-game" type="button" class="secondary-action">Sauvegarder</button>'
      + '<button id="pause-load-game" type="button" class="secondary-action">Charger</button>'
      + '<button id="pause-reset-preview" type="button" class="secondary-action">Recommencer</button>'
      + '<button id="pause-toggle-hints" type="button" class="secondary-action">' + (state.showInteractionHints ? 'Masquer l’aide visuelle' : 'Afficher l’aide visuelle') + '</button>'
      + '</div></div></div>' : '')
    + renderCinematic(cinematic, currentSlide)
    + renderConversation()
    + renderChoiceEffectFloating()
    + renderEnding()
    + renderEnigma(enigma);

  bindEvents();
  syncFullscreenUi();
  if (state.actPreload?.active) {
    const playScene = getPlayScene();
    if (sceneAudioSource !== getSceneMusicKey(playScene)) {
      sceneAudio.pause();
      sceneAudio.currentTime = 0;
      sceneAudio.removeAttribute('src');
      sceneAudio.load();
      sceneAudioSource = '';
    }
    if (ambientAudioSource !== getSceneAmbientSoundKey(playScene)) {
      ambientAudio.pause();
      ambientAudio.currentTime = 0;
      ambientAudio.removeAttribute('src');
      ambientAudio.load();
      ambientAudioSource = '';
    }
    stopSceneTimer();
  } else {
    playSceneMusic();
    playSceneAmbientSound();
    scheduleSceneTimer();
  }
  if (sceneTransitionTimer) {
    clearTimeout(sceneTransitionTimer);
    sceneTransitionTimer = null;
  }
  if (state.sceneTransitionOverlay) {
    sceneTransitionTimer = setTimeout(() => {
      state.sceneTransitionOverlay = null;
      sceneTransitionTimer = null;
      render(false);
    }, (Number(state.sceneTransitionOverlay.duration) || 700) + 80);
  }
  clearAnime2dTimer();
  if (cinematic?.cinematicType === 'anime2d') {
    const delay = getNextAnime2dRenderDelay(cinematic);
    anime2dTimer = setTimeout(() => {
      if (getCurrentCinematic()?.id !== cinematic.id) return;
      const { duration } = getAnime2dSpec(cinematic);
      if (getAnime2dElapsed(cinematic) >= duration) {
        closeCinematic();
      } else {
        render(false);
      }
    }, delay);
  } else {
    const delay = getNextSceneAnime2dRenderDelay(playScene);
    if (delay !== null) {
      anime2dTimer = setTimeout(() => {
        if (getPlayScene()?.id !== playScene?.id || getCurrentCinematic()) return;
        render(false);
      }, delay);
    }
  }

  if (shouldSave && hasRenderedOnce) saveGame(false);
  hasRenderedOnce = true;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  const audioNode = root.querySelector('#cinematic-audio');
  if (audioNode) {
    cinematicAudio = audioNode;
  }

}

if (!loadGame(false)) {
  render(false);
}
</script>
</body>
</html>`;
}

export function buildStandaloneModuleFiles(project) {
  const html = buildStandaloneHtml(project);
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.lastIndexOf('</script>');

  if (scriptStart < 0 || scriptEnd < scriptStart) {
    return {
      indexHtml: html,
      engineJs: '',
    };
  }

  const scriptOpenEnd = scriptStart + '<script>'.length;
  const engineJs = `${html.slice(scriptOpenEnd, scriptEnd).trim()}\n`;
  const indexHtml = `${html.slice(0, scriptStart)}<script src="./engine.js"></script>${html.slice(scriptEnd + '</script>'.length)}`;

  return {
    indexHtml,
    engineJs,
  };
}
