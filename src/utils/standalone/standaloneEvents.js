export const standaloneEvents = `function bindEvents() {
  root.querySelector('#fullscreen-toggle')?.addEventListener('click', toggleFullscreen);
  root.querySelectorAll('#save-game, [data-player-action="save-game"]').forEach((button) => button.addEventListener('click', () => saveGame(true)));
  root.querySelectorAll('#load-game, [data-player-action="load-game"]').forEach((button) => button.addEventListener('click', () => loadGame(true)));
  document.getElementById('delete-save')?.addEventListener('click', () => deleteSave(true));
  document.getElementById('export-save-json')?.addEventListener('click', exportSaveAsJson);
  document.getElementById('import-save-json')?.addEventListener('click', () => document.getElementById('import-save-file')?.click());
  document.getElementById('import-save-file')?.addEventListener('change', (event) => {
    importSaveFromJsonFile(event.target.files?.[0]);
    event.target.value = '';
  });
  document.getElementById('rename-save')?.addEventListener('click', renameCurrentSave);
  document.getElementById('clear-save')?.addEventListener('click', clearGameSave);
  root.querySelectorAll('[data-hero-select]').forEach((button) => {
    button.addEventListener('click', () => selectStandaloneHero(button.dataset.heroSelect || ''));
  });
  root.querySelectorAll('[data-hero-gallery-shift]').forEach((button) => {
    button.addEventListener('click', () => moveStandaloneHeroGallery(Number(button.dataset.heroGalleryShift) || 0));
  });
  root.querySelector('#hero-setup-change-character')?.addEventListener('click', changeStandaloneHeroSelection);
  root.querySelector('#hero-setup-roll')?.addEventListener('click', rollStandaloneHeroSetupSkills);
  root.querySelector('#hero-setup-start')?.addEventListener('click', completeStandaloneHeroSetup);
  root.querySelector('.player-shell')?.addEventListener('mousemove', (event) => {
    if (event.clientY <= 8) {
      if (!state.controlsVisible) revealControls(false);
    } else if (event.clientY > 96 && state.controlsVisible) {
      state.controlsVisible = false;
      clearControlsTimer();
      render(false);
    }
  });
  root.querySelectorAll('#open-inventory-drawer, [data-player-action="open-inventory-drawer"]').forEach((button) => button.addEventListener('click', () => {
    state.inventoryDrawerOpen = true;
    render();
  }));
  root.querySelectorAll('#close-inventory-drawer, [data-player-action="close-inventory-drawer"]').forEach((button) => button.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  }));
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
  root.querySelectorAll('#close-hero-combat').forEach((button) => button.addEventListener('click', closeHeroCombat));
  root.querySelectorAll('[data-hero-combat-power]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedHeroCombatPowerId = button.dataset.heroCombatPower || '';
      render();
    });
  });
  root.querySelectorAll('[data-hero-combat-item]').forEach((button) => {
    button.addEventListener('click', () => {
      openInventoryItem(button.dataset.heroCombatItem || '');
    });
  });
  root.querySelectorAll('[data-hero-combat-flee]').forEach((button) => {
    button.addEventListener('click', closeHeroCombat);
  });
  root.querySelectorAll('[data-hero-unequip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      unequipHeroItem(button.dataset.heroUnequipId || '');
      render();
    });
  });
  root.querySelectorAll('#hero-combat-action').forEach((button) => button.addEventListener('click', () => {
    if (state.activeHeroCombat?.phase === 'survival') {
      attemptSurvivalHeroCombat();
    } else if (state.activeHeroCombat?.phase === 'enemy') {
      rollActiveEnemyCombat();
    } else {
      attackActiveHeroCombat(state.selectedHeroCombatPowerId || '');
    }
  }));
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
  const sceneBackground = root.querySelector('.scene-player img.bg');
  sceneBackground?.addEventListener('load', () => setSceneAspectFromImage(sceneBackground));
  if (sceneBackground?.complete) setSceneAspectFromImage(sceneBackground);

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

`;
