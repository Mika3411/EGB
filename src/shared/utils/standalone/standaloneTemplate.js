import { buildStandaloneCss } from './standaloneCss.js';
import { buildStandaloneRuntimeState } from './standaloneRuntimeState.js';
import { buildStandaloneSecurityScript } from './standaloneSecurity.js';
import { standaloneConversationCore, standaloneConversationCoreOverrides, standaloneConversationRender, standaloneConversationReply } from './standaloneConversation.js';
import { standaloneConversationRenderOverrides } from './standaloneConversationOverrides.js';
import { standaloneEnigmaActions, standaloneEnigmaPieceStyles, standaloneEnigmaPlayback, standaloneEnigmaRender } from './standaloneEnigmas.js';
import { standaloneHeroRuntime } from './standaloneHeroRuntime.js';
import { standaloneHeroSkillChecks } from './standaloneHeroSkillChecks.js';
import { standaloneHeroCombat } from './standaloneHeroCombat.js';
import { standaloneInventoryActions, standaloneInventorySelection } from './standaloneInventory.js';
import { standaloneCinematicNavigation, standaloneNavigation, standaloneNavigationAudio } from './standaloneNavigation.js';
import { standaloneNavigationOverrides } from './standaloneNavigationOverrides.js';
import { standaloneEvents } from './standaloneEvents.js';
import { standaloneProjectLookups } from './standaloneProjectLookups.js';
import { standaloneSaveSystem } from './standaloneSaveSystem.js';
import { standaloneCinematicRender, standaloneRender } from './standaloneRender.js';
import {
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
} from './standaloneRuntimeBootstrap.js';

export function buildStandaloneEngineJs(project) {
  const serializedProject = serializeForScript(project);
  const serializedColorOptions = serializeForScript(COLOR_OPTIONS);
  const serializedPopupOverlayGradients = serializeForScript(POPUP_OVERLAY_GRADIENTS);
  const serializedCodeKeypadKeys = serializeForScript(CODE_KEYPAD_KEYS);
  const serializedGameActions = serializeForScript(SHARED_GAME_ACTIONS);
  const serializedGameActionCreators = serializeFunctionMap('gameActions', SHARED_GAME_ACTION_CREATORS);
  const serializedSceneAudioHelpers = [
    `const getSharedSceneMusicKey = ${serializeFunctionSource(sharedGetSceneMusicKey)};`,
    `const getSharedSceneAmbientSoundKey = ${serializeFunctionSource(sharedGetSceneAmbientSoundKey)};`,
    `const getSharedFormatTimerSeconds = ${serializeFunctionSource(sharedFormatTimerSeconds)};`,
  ].join('\n');
  const standaloneGameEngineScript = buildStandaloneGameEngineScript();
  const standaloneRuntimeState = buildStandaloneRuntimeState({
    serializedProject,
    serializedColorOptions,
    serializedPopupOverlayGradients,
    serializedCodeKeypadKeys,
    serializedGameActions,
    serializedGameActionCreators,
    serializedSceneAudioHelpers,
    standaloneSaveSystem,
  });

  return `${standaloneRuntimeState}

${buildStandaloneSecurityScript(standaloneGameEngineScript)}

${standaloneEnigmaPieceStyles}${standaloneProjectLookups}${standaloneNavigation}${standaloneNavigationOverrides}${standaloneInventorySelection}${standaloneNavigationAudio}${standaloneEnigmaPlayback}${standaloneCinematicNavigation}${standaloneConversationCore}${standaloneConversationCoreOverrides}${standaloneHeroRuntime}${standaloneHeroSkillChecks}${standaloneHeroCombat}function openEnding(reply = {}) {
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

${standaloneConversationReply}${standaloneEnigmaActions}${standaloneInventoryActions}function getSceneObjectClickMode(obj) {
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

  const hasPopupViewer = (mode === 'popup' || mode === 'both') && popupSrc;
  if (hasPopupViewer) {
    state.viewerImage = {
      id: obj.linkedItemId || obj.id,
      src: popupSrc,
      name: obj.name || linkedItem?.name || obj.popupImageName || 'Objet',
      caption: obj.dialogue || obj.name || linkedItem?.name || '',
    };
  }

  if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
    if (!state.inventory.includes(obj.linkedItemId)) {
      state.inventory = [...state.inventory, obj.linkedItemId];
    }
    if (!state.selectedInventoryIds.includes(obj.linkedItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, obj.linkedItemId].slice(-2);
    }
    if (!hasPopupViewer) showInventoryItem(obj.linkedItemId);
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

  if (activeSpot.actionType === 'hero_combat') {
    runHeroCombatAction(activeSpot, { sourceHotspotId: activeSpot.id });
    render();
    return;
  }

  if (activeSpot.actionType === 'skill_check') {
    runSkillCheckAction(activeSpot, { sourceHotspotId: activeSpot.id });
    render();
    return;
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
goToScene(cinematic.targetSceneId, 'Nouvelle scène débloquée.');
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
  state.objectiveDrawerOpen = false;
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

function getStandaloneHeroGalleryIndex() {
  const choices = getHeroChoices();
  if (!choices.length) return 0;
  return ((Number(state.heroSetupGalleryIndex) || 0) % choices.length + choices.length) % choices.length;
}

function moveStandaloneHeroGallery(delta = 0) {
  const choices = getHeroChoices();
  if (choices.length < 2) return;
  state.heroSetupGalleryIndex = getStandaloneHeroGalleryIndex() + Number(delta || 0);
  render();
}

function selectStandaloneHero(heroId = '') {
  const choices = getHeroChoices();
  const selected = choices.find((hero) => hero.id === heroId) || choices[getStandaloneHeroGalleryIndex()] || choices[0];
  if (!selected) return;
  state.heroState = getInitialHeroState(selected);
  state.heroSetupSelectionConfirmed = true;
  state.lastDiceRoll = null;
  state.dialogue = (state.heroState.name || 'Héros') + ' choisi. Lance les compétences pour commencer.';
  render();
}

function changeStandaloneHeroSelection() {
  state.heroSetupSelectionConfirmed = false;
  state.heroState = getInitialHeroState(getHeroChoices()[getStandaloneHeroGalleryIndex()] || state.heroState);
  state.lastDiceRoll = null;
  render();
}

function rollStandaloneHeroSetupSkills() {
  if (!IS_HERO_ADVENTURE || state.heroSetupComplete) return;
  if (!state.heroSetupSelectionConfirmed) {
    state.dialogue = 'Choisis ton personnage avant de lancer les compétences.';
    render();
    return;
  }
  const rolls = [];
  state.heroState = {
    ...(state.heroState || getInitialHeroState()),
    skills: ((state.heroState || getInitialHeroState()).skills || []).map((skill) => {
      const rawRoll = Math.floor(Math.random() * 6) + 1;
      const baseValue = Number.isFinite(Number(skill.baseValue))
        ? Number(skill.baseValue)
        : (Number(skill.value) || 0) - (Number(skill.rolledValue) || 0);
      rolls.push(rawRoll);
      return {
        ...skill,
        baseValue,
        value: baseValue + rawRoll,
        rolledValue: rawRoll,
        rollFormula: baseValue + ' + 1d6',
      };
    }),
  };
  state.lastDiceRoll = null;
  state.dialogue = 'Compétences tirées. Tu peux commencer l’aventure.';
  render();
}

function completeStandaloneHeroSetup() {
  if (!IS_HERO_ADVENTURE) return;
  const hasRolledSkills = ((state.heroState || {}).skills || []).some((skill) => Number(skill.rolledValue) > 0);
  if (!hasRolledSkills) {
    state.dialogue = 'Lance les compétences avant de commencer.';
    render();
    return;
  }
  state.heroSetupComplete = true;
  state.dialogue = getPlayScene()?.introText || 'L’aventure commence.';
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

${standaloneEvents}${standaloneCinematicRender}${standaloneEnigmaRender}${standaloneConversationRender}${standaloneConversationRenderOverrides}${standaloneRender}
if (!loadGame(false)) {
  render(false);
}
`;
}

export function buildStandaloneStyleCss() {
  return buildStandaloneCss();
}

function buildStandaloneHtmlDocument(project, { headStyles, scriptTag }) {
  const safeTitle = escapeHtml(project?.title || 'Escape Game');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
${headStyles}
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

${scriptTag}
</body>
</html>`;
}

export function buildStandaloneHtml(project) {
  return buildStandaloneHtmlDocument(project, {
    headStyles: `<style>
${buildStandaloneStyleCss()}
</style>`,
    scriptTag: `<script>
${buildStandaloneEngineJs(project)}</script>`,
  });
}

export function buildStandaloneIndexHtml(project) {
  return buildStandaloneHtmlDocument(project, {
    headStyles: '<link rel="stylesheet" href="./style.css">',
    scriptTag: '<script src="./engine.js"></script>',
  });
}

export function buildStandaloneModuleFiles(project) {
  return {
    indexHtml: buildStandaloneIndexHtml(project),
    engineJs: buildStandaloneEngineJs(project),
    styleCss: buildStandaloneStyleCss(),
  };
}
