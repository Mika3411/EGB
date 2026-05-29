import { standaloneCinematicRender } from './standaloneCinematicRender.js';
import { standaloneCombatRender } from './standaloneCombatRender.js';
import { standaloneHeroSetupRender } from './standaloneHeroSetupRender.js';

export { standaloneCinematicRender, standaloneCombatRender, standaloneHeroSetupRender };

export const standaloneRender = `${standaloneCombatRender}${standaloneHeroSetupRender}function renderAdventureStateSummary() {
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

function renderPlayerTopbar(playScene) {
  return '<div class="player-topbar">'
    + '<div><span class="eyebrow">Player</span><strong>' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</strong></div>'
    + '<div class="player-actions">'
    + '<button id="pause-game" type="button" class="secondary-action">Pause</button>'
    + '<button id="reset-preview" type="button" class="secondary-action player-reset-button">Recommencer</button>'
    + '<button id="save-game" data-player-action="save-game" type="button" class="secondary-action">Sauvegarder</button>'
    + '<button id="load-game" data-player-action="load-game" type="button" class="secondary-action">Charger</button>'
    + '<button id="toggle-hints" type="button" class="secondary-action">' + (state.showInteractionHints ? 'Sans aide' : 'Aide visuelle') + '</button>'
    + '<button id="fullscreen-toggle" type="button" class="secondary-action">Plein écran</button>'
    + '</div></div>';
}

function renderSceneBackground(playScene, playSceneBackgroundUrl) {
  return playSceneBackgroundUrl
    ? '<img class="bg" src="' + escapeMediaAttr(playSceneBackgroundUrl, 'image') + '" alt="' + escapeAttr(playScene.name || 'Scène') + '" />'
    : '<div class="placeholder">Ajoute un fond pour jouer la scène.</div>';
}

function renderVisualEffectZones(playScene) {
  return (playScene?.visualEffectZones || [])
    .filter((zone) => !zone.isHidden)
    .map((zone) => '<div class="scene-visual-effect scene-visual-effect-zone scene-visual-effect--' + safeClassToken(zone.effect || 'sparkles', 'sparkles') + ' scene-visual-effect--' + safeClassToken(zone.intensity || 'normal', 'normal') + '" style="left:' + safeStylePercent(zone.x, 0) + ';top:' + safeStylePercent(zone.y, 0) + ';width:' + safeStylePercent(zone.width, 10) + ';height:' + safeStylePercent(zone.height, 10) + ';z-index:' + getVisualEffectZoneZIndex(zone.layer) + ';' + getElementShapeStyle(zone) + '"></div>')
    .join('');
}

function renderHotspots(playScene) {
  return (playScene?.hotspots || [])
    .map((spot) => '<button type="button" class="player-hotspot" data-hotspot-id="' + safeDataAttr(spot.id) + '" '
      + 'style="left:' + safeStylePercent(spot.x, 0) + ';top:' + safeStylePercent(spot.y, 0) + ';width:' + safeStylePercent(spot.width, 10) + ';height:' + safeStylePercent(spot.height, 10) + ';z-index:20;cursor:pointer;' + getElementShapeStyle(spot) + '" title="' + escapeAttr(spot.name || '') + '"></button>')
    .join('');
}

function renderSceneObjects(playScene) {
  return (playScene?.sceneObjects || [])
    .filter((obj) => !state.removedSceneObjectIds.includes(obj.id) && (!obj.isHidden || state.revealedSceneObjectIds.includes(obj.id)))
    .map((obj) => {
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
      return '<button type="button" class="player-scene-object' + (obj.isInvisible ? ' player-scene-object-invisible' : '') + (clickMode === 'none' ? ' player-scene-object-not-clickable' : '') + '" data-scene-object-id="' + safeDataAttr(obj.id) + '" '
        + 'style="left:' + safeStylePercent(obj.x, 0) + ';top:' + safeStylePercent(obj.y, 0) + ';width:' + safeStylePercent(obj.width, 10) + ';height:' + safeStylePercent(obj.height, 10) + ';z-index:18;' + getElementShapeStyle(obj) + '" title="' + escapeAttr(obj.name || 'Objet') + '" aria-label="' + escapeAttr(obj.name || 'Objet invisible') + '">'
        + content
        + '</button>';
    })
    .join('');
}

function renderInlineViewer(viewerImageSrc) {
  return viewerImageSrc
    ? '<div class="scene-inline-viewer"><div class="scene-inline-viewer__backdrop"></div><div class="scene-inline-viewer__card">'
      + '<img class="scene-inline-viewer__image" src="' + escapeMediaAttr(viewerImageSrc, 'image') + '" alt="' + escapeAttr(state.viewerImage.name || 'Objet') + '" />'
      + '<div class="scene-inline-viewer__name">' + safeHtml(state.viewerImage.caption || state.viewerImage.name || 'Objet') + '</div></div></div>'
    : '';
}

function renderActPreload() {
  return state.actPreload?.active
    ? '<div class="act-preload-overlay" role="status" aria-live="polite"><div class="act-preload-card"><span class="eyebrow">Chargement</span><strong>'
      + safeHtml(state.actPreload.label || 'Acte suivant') + '</strong><div class="act-preload-bar" aria-label="Chargement ' + escapeAttr(cssPercent(state.actPreload.progress, 0)) + '%"><span style="width:'
      + safeStylePercent(state.actPreload.progress, 0) + '"></span></div><small>' + safeHtml(cssPercent(state.actPreload.progress, 0)) + '% des médias de l\\'acte sont prêts</small></div></div>'
    : '';
}

function renderNarrationBar() {
  return '<div class="player-narration-bar ' + (state.narrationCollapsed ? 'is-collapsed' : '') + '">'
    + (state.narrationCollapsed
      ? '<button id="open-narration" type="button" class="narration-discreet-button">Texte</button>'
      : '<p id="collapse-narration" role="button" tabindex="0">' + safeHtml(state.dialogue || 'Aucun message.') + '</p>')
    + '<button id="open-inventory-drawer" data-player-action="open-inventory-drawer" type="button" class="inventory-discreet-button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + (state.inventory.length ? ' (' + state.inventory.length + ')' : '') + '</button>'
    + '</div>';
}

function renderInventoryTile(itemId) {
  const item = getItemById(itemId);
  if (!item) return '';
  const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
  return '<button type="button" class="inventory-tile'
    + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + safeDataAttr(itemId) + '">'
    + '<div class="inventory-thumb">'
    + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
    + '</div><strong>' + safeHtml(item.name || '') + '</strong>'
    + (getHeroItemBadgeLabel(item) ? '<small class="inventory-item-badge">' + safeHtml(getHeroItemBadgeLabel(item)) + '</small>' : '')
    + '</button>';
}

function renderInventoryGrid(emptyHtml) {
  return '<div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map(renderInventoryTile).join('') : emptyHtml)
    + '</div>';
}

function renderInventoryDrawer(inventoryDrawerTitle, variant = 'stage') {
  if (!state.inventoryDrawerOpen) return '';
  if (variant === 'fullscreen') {
    return '<div id="inventory-drawer-backdrop" class="inventory-drawer__backdrop"></div><aside class="inventory-drawer open"><div class="inventory-drawer__head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button data-player-action="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div>' + (IS_HERO_ADVENTURE ? renderStandaloneHeroEquipmentSummary() : '') + '<div class="inventory-actions"><button id="combine-items" type="button">Combiner les 2 objets</button></div>'
      + renderInventoryGrid('<p>Aucun objet dans l’inventaire.</p>')
      + '<p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></aside>';
  }
  return '<div class="player-inventory-drawer' + (IS_HERO_ADVENTURE ? ' player-inventory-drawer--hero' : IS_CHOICE_ADVENTURE ? ' player-inventory-drawer--adventure' : '') + '"><div class="panel-head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button id="close-inventory-drawer" data-player-action="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div>' + (IS_HERO_ADVENTURE ? renderStandaloneHeroEquipmentSummary() : '') + (IS_CHOICE_ADVENTURE ? renderAdventureStateSummary() : '') + '<button id="combine-items" class="secondary-action player-combine-button" type="button">Combiner les 2 objets</button>'
    + renderInventoryGrid('<p>Aucun objet.</p>')
    + '</div>';
}

function renderSceneTransition(transitionSceneBackgroundUrl) {
  return state.sceneTransitionOverlay
    ? '<div class="scene-transition-overlay scene-transition-overlay--' + safeClassToken(state.sceneTransitionOverlay.type || 'fade', 'fade') + '" style="--scene-transition-duration:' + cssNumber(state.sceneTransitionOverlay.duration, 700, 0, 600000) + 'ms">'
      + (transitionSceneBackgroundUrl
        ? '<img src="' + escapeMediaAttr(transitionSceneBackgroundUrl, 'image') + '" alt="" />'
        : '<div class="placeholder">Scène précédente</div>')
      + '</div>'
    : '';
}

function renderSceneLayer({ playScene, sceneAspectRatio, playSceneBackgroundUrl, viewerImageSrc, transitionSceneBackgroundUrl, inventoryDrawerTitle }) {
  return '<div class="scene-player" id="scene-layer" style="--scene-aspect:' + cssNumber(sceneAspectRatio, 1.6, 0.1, 10) + '">'
    + renderSceneBackground(playScene, playSceneBackgroundUrl)
    + (playScene?.visualEffect && playScene.visualEffect !== 'none' ? '<div class="scene-visual-effect scene-visual-effect--' + safeClassToken(playScene.visualEffect, 'none') + ' scene-visual-effect--' + safeClassToken(playScene.visualEffectIntensity || 'normal', 'normal') + '"></div>' : '')
    + renderVisualEffectZones(playScene)
    + renderHotspots(playScene)
    + renderSceneObjects(playScene)
    + (playScene?.timerEnabled ? '<div class="scene-timer-hud"><strong id="scene-timer-count">' + formatSceneTimerSeconds(state.sceneTimerRemaining || playScene.timerSeconds || 0) + '</strong>'
      + (playScene.timerEndAction === 'damage-life' ? '<span>Vies: ' + safeHtml(state.playerLives ?? 3) + '</span>' : '')
      + '</div>' : '')
    + renderInlineViewer(viewerImageSrc)
    + renderSceneTransition(transitionSceneBackgroundUrl)
    + renderHeroCombatOverlay()
    + renderHeroSetupOverlay()
    + renderActPreload()
    + renderNarrationBar()
    + renderInventoryDrawer(inventoryDrawerTitle)
    + '</div>';
}

function renderPlayerShell({ playScene, sceneAspectRatio, playSceneBackgroundUrl, viewerImageSrc, transitionSceneBackgroundUrl, inventoryDrawerTitle }) {
  return '<div class="player-shell is-shared-player ' + (IS_CHOICE_ADVENTURE ? 'is-choice-adventure ' : '') + 'player-button-style-' + safeClassToken(PLAYER_BUTTON_STYLE, 'modern') + ' player-button-font-' + safeClassToken(PLAYER_BUTTON_FONT, 'system') + ' player-narration-font-' + safeClassToken(PLAYER_NARRATION_FONT, 'system') + ' ' + (state.showInteractionHints ? 'show-hints' : 'hide-hints') + ' ' + (state.controlsVisible ? '' : 'controls-hidden') + '" style="--player-narration-bg:' + safeCssColor(PLAYER_NARRATION_BACKGROUND, 'rgba(2, 6, 23, .62)') + '">'
    + '<section class="panel player-stage-panel">'
    + renderPlayerTopbar(playScene)
    + renderSceneLayer({ playScene, sceneAspectRatio, playSceneBackgroundUrl, viewerImageSrc, transitionSceneBackgroundUrl, inventoryDrawerTitle })
    + '</section>'
    + '<section class="panel side player-side-panel">'
    + '<div class="badge-line">' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</div>'
    + '<div class="dialogue-box"><p>' + safeHtml(state.dialogue || 'Aucun message.') + '</p></div>'
    + '<div class="panel-head"><h3>Inventaire</h3><button id="combine-items">Combiner les 2 objets</button></div>'
    + renderInventoryGrid('<p>Aucun objet dans l’inventaire.</p>')
    + '<p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></section>'
    + '</div>';
}

function renderFullscreenHud(inventoryDrawerTitle) {
  return '<div class="fullscreen-hud">'
    + '<div class="fullscreen-dialogue">' + safeHtml(state.dialogue || 'Aucun message.') + '</div>'
    + '<div class="fullscreen-actions"><button data-player-action="save-game" class="hud-button" type="button">Sauvegarder</button><button data-player-action="load-game" class="hud-button" type="button">Charger</button><button id="export-save-json" class="hud-button" type="button">Exporter JSON</button><button id="import-save-json" class="hud-button" type="button">Importer JSON</button><button data-player-action="open-inventory-drawer" class="hud-button" type="button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + '</button></div>'
    + '<input id="import-save-file" type="file" accept=".json,application/json" hidden />'
    + '</div>'
    + renderInventoryDrawer(inventoryDrawerTitle, 'fullscreen');
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

  root.innerHTML = renderPlayerShell({
    playScene,
    sceneAspectRatio,
    playSceneBackgroundUrl,
    viewerImageSrc,
    transitionSceneBackgroundUrl,
    inventoryDrawerTitle,
  })
    + renderFullscreenHud(inventoryDrawerTitle)
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
`;
