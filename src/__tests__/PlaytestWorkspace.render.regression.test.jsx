import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PlaytestWorkspace from '../domains/player/PlaytestWorkspace.jsx';

const noop = vi.fn();

afterEach(() => {
  cleanup();
});

const makeProject = (overrides = {}) => ({
  title: 'Preview render',
  creationMode: 'beginner',
  ui: {},
  acts: [],
  items: [],
  scenes: [{
    id: 'scene-1',
    name: 'Salle blanche',
    introText: 'Le preview est stable.',
    hotspots: [],
    sceneObjects: [],
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
  ...overrides,
});

const makeProps = (overrides = {}) => {
  const project = overrides.project || makeProject();
  return {
    playScene: project.scenes[0],
    viewerImage: null,
    setViewerImage: noop,
    playingCinematic: null,
    playingSlideIndex: 0,
    currentSlide: null,
    setPlayingCinematic: noop,
    setPlayingSlideIndex: noop,
    closeCinematic: noop,
    advanceCinematic: noop,
    audioRef: { current: null },
    onSceneTimerEnd: noop,
    triggerHotspot: noop,
    resetPreview: noop,
    saveGameState: noop,
    loadGameState: noop,
    restoreLastChoiceSnapshot: noop,
    getSceneLabel: () => 'Salle blanche',
    dialogue: 'Le preview est stable.',
    inventory: [],
    storyVariables: {},
    adventureJournalEntries: [],
    chosenConversationReplyIds: [],
    hiddenConversationReplyIds: [],
    completedHotspotIds: [],
    addInventoryItem: noop,
    removeInventoryItem: noop,
    playerLives: 3,
    heroAdventure: { enabled: false },
    heroState: null,
    heroSetupComplete: true,
    activeHeroCombat: null,
    attackActiveHeroCombat: noop,
    rollActiveEnemyCombat: noop,
    attemptSurvivalHeroCombat: noop,
    attemptEscapeHeroCombat: noop,
    closeHeroCombat: noop,
    equippedHeroItemIds: [],
    equippedHeroSlotMap: {},
    lastChoiceSnapshot: null,
    adjustHeroStat: noop,
    lastDiceRoll: null,
    rollHeroDie: noop,
    selectHeroCharacter: noop,
    rollHeroSetupSkills: noop,
    completeHeroSetup: noop,
    sceneTimerResetKey: 0,
    setInventory: noop,
    setSelectedInventoryIds: noop,
    usedSceneObjectIds: [],
    revealedSceneObjectIds: [],
    sceneObjectTextOverrides: {},
    markSceneObjectUsed: noop,
    markHotspotCompleted: noop,
    project,
    selectedInventoryIds: [],
    openInventoryItem: noop,
    equipHeroItem: noop,
    unequipHeroItem: noop,
    setDraggedInventoryId: noop,
    draggedInventoryId: null,
    combineInventoryItems: noop,
    setDialogue: noop,
    activeEnigma: null,
    activeConversation: null,
    activeEnding: null,
    choiceEffectNotices: [],
    closeConversation: noop,
    closeEnding: noop,
    clearChoiceEffectNotices: noop,
    isConversationReplyAvailable: () => true,
    getConversationReplyLockReason: () => '',
    chooseConversationReply: noop,
    heroCharacterPreviewRequestKey: 0,
    enigmaCodeInput: '',
    setEnigmaCodeInput: noop,
    enigmaColorAttempt: [],
    setEnigmaColorAttempt: noop,
    pushEnigmaColor: noop,
    closeEnigma: noop,
    submitEnigma: noop,
    enigmaPuzzleOrder: [],
    enigmaPuzzleSelectedIndex: null,
    clickPuzzlePiece: noop,
    enigmaDragBank: [],
    enigmaDragSlots: [],
    enigmaDraggedPiece: null,
    setEnigmaDraggedPiece: noop,
    moveDragPieceToSlot: noop,
    returnDragPieceToBank: noop,
    enigmaRotationAngles: [],
    rotatePuzzlePiece: noop,
    simonPlaybackIndex: -1,
    simonPlayerTurn: false,
    startSimonPlayback: noop,
    sharedPlayerMode: false,
    ...overrides,
    project,
  };
};

describe('PlaytestWorkspace render regressions', () => {
  test('rend le preview sans enigme active', () => {
    render(<PlaytestWorkspace {...makeProps()} />);

    expect(screen.getAllByText('Le preview est stable.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Valider l’enigme')).toBeNull();
  });

  test('affiche le lien discret vers le builder', () => {
    render(<PlaytestWorkspace {...makeProps()} />);

    const builderLink = screen.getByRole('link', { name: 'Créé avec Escape Game Studio' });
    expect(builderLink.getAttribute('href')).toBe('https://escape-game-studio.netlify.app/');
    expect(builderLink.className).toContain('player-builder-credit');
  });

  test('rend une enigme active avec contenu de saisie', () => {
    const setEnigmaCodeInput = vi.fn();
    render(<PlaytestWorkspace
      {...makeProps({
        activeEnigma: {
          enigma: {
            id: 'enigma-code',
            name: 'Code de la porte',
            question: 'Entre le code observe.',
            type: 'code',
            codeSkin: 'digicode',
            solutionText: '1234',
          },
        },
        enigmaCodeInput: '12',
        setEnigmaCodeInput,
      })}
    />);

    expect(screen.getByText('Code de la porte')).toBeTruthy();
    expect(screen.getByText('Digicode')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(setEnigmaCodeInput).toHaveBeenCalledWith('123');
  });

  test('rend une fin active dans les overlays narratifs', () => {
    render(<PlaytestWorkspace
      {...makeProps({
        activeEnding: {
          type: 'secret',
          label: 'Fin secrete',
          title: 'La verite revelee',
          message: 'Le dossier est complet.',
          summary: 'Le mystere est resolu.',
        },
        choiceEffectNotices: [{ type: 'ending', title: 'Fin declenchee', detail: 'Sortie narrative' }],
      })}
    />);

    expect(screen.getByText('La verite revelee')).toBeTruthy();
    expect(screen.getByText('Le mystere est resolu.')).toBeTruthy();
    expect(screen.getByText('Sortie narrative')).toBeTruthy();
  });

  test('rend une seule synthese de consequences hors conversation', () => {
    const detail = 'Vous plantez vos pieds dans la boue et levez votre arme. Les loups arrivent ensemble.';
    render(<PlaytestWorkspace
      {...makeProps({
        choiceEffectNotices: [
          { type: 'message', title: 'Message affiche', detail },
          { type: 'route', title: 'Nouvelle scène', detail: 'Gorge des cerfs' },
        ],
      })}
    />);

    expect(screen.getAllByText('Conséquences du choix')).toHaveLength(1);
    expect(screen.getByText(detail)).toBeTruthy();
    expect(screen.queryByText('Nouvelle scène')).toBeNull();
    expect(screen.queryByText('Gorge des cerfs')).toBeNull();
  });

  test('met en avant continuer apres un combat termine', () => {
    const closeHeroCombat = vi.fn();
    const project = makeProject({
      scenes: [
        {
          id: 'scene-1',
          name: 'Marais des lanternes',
          introText: 'La boue retient les pas.',
          hotspots: [],
          sceneObjects: [],
        },
        {
          id: 'scene-2',
          name: 'Tour des guetteurs',
          introText: 'La suite vous attend.',
          hotspots: [],
          sceneObjects: [],
        },
      ],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
        heroAdventure: {
          enabled: true,
          dice: { sides: 20, label: 'd20' },
          combat: { showDice: true, enemyName: 'Goule du marais', enemyMaxMana: 4 },
        },
        heroState: {
          name: 'Beren',
          health: 20,
          maxHealth: 20,
          mana: 8,
          maxMana: 8,
          force: 9,
          initiative: 0,
          skills: [{ id: 'force', name: 'Force', bonus: 9 }],
          powers: [],
        },
        activeHeroCombat: {
          id: 'combat-1',
          status: 'victory',
          phase: 'hero',
          round: 2,
          enemyName: 'Goule du marais',
          enemyHealth: 0,
          enemyMaxHealth: 13,
          enemyMana: 0,
          enemyMaxMana: 4,
          heroInitiative: 0,
          enemyInitiative: 0,
          pendingSceneId: 'scene-2',
          message: 'Goule vaincue. La tour des guetteurs vous attend.',
          history: ['Jet du heros 29 total.'],
          entry: {
            id: 'combat-entry',
            combatSkillId: 'force',
            combatEnemyName: 'Goule du marais',
            combatShowDice: true,
          },
        },
        closeHeroCombat,
      })}
    />);

    const continueButtons = screen.getAllByRole('button', { name: /continuer/i });
    expect(continueButtons).toHaveLength(2);
    const primaryContinue = continueButtons.find((button) => button.className.includes('hero-combat-end-button--primary'));
    expect(primaryContinue).toBeTruthy();
    expect(screen.getByText("Suite de l'aventure")).toBeTruthy();
    expect(screen.queryByText('Combat terminé.')).toBeNull();

    fireEvent.click(primaryContinue);
    expect(closeHeroCombat).toHaveBeenCalledTimes(1);
  });

  test('affiche un objet sans image dans le visualiseur', () => {
    render(<PlaytestWorkspace
      {...makeProps({
        viewerImage: {
          id: 'note',
          src: '',
          name: 'Note froissee',
          icon: 'NOTE',
        },
      })}
    />);

    expect(screen.getByRole('img', { name: 'Note froissee' }).textContent).toBe('NOTE');
    expect(screen.getByText('Note froissee')).toBeTruthy();
  });

  test('affiche un objet de scene depuis son item lie dans la mediatheque', () => {
    const setViewerImage = vi.fn();
    const project = makeProject({
      assets: [{ id: 'asset-note', type: 'image', url: 'data:image/png;base64,bm90ZQ==' }],
      items: [{ id: 'note', name: 'Note froissee', imageId: 'asset-note', icon: 'NOTE' }],
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [],
        sceneObjects: [{
          id: 'scene-note',
          name: 'Note sur table',
          blockType: 'image',
          interactionMode: 'popup',
          linkedItemId: 'note',
          x: 45,
          y: 45,
          width: 16,
          height: 12,
        }],
      }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
        setViewerImage,
      })}
    />);

    expect(screen.getByAltText('Note sur table').getAttribute('src')).toBe('data:image/png;base64,bm90ZQ==');

    fireEvent.click(screen.getByRole('button', { name: 'Note sur table' }));
    expect(setViewerImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note',
      src: 'data:image/png;base64,bm90ZQ==',
      name: 'Note sur table',
    }));
  });

  test('affiche l image associee a une zone dans le preview joueur', () => {
    const project = makeProject({
      assets: [{ id: 'asset-room', type: 'image', url: 'data:image/png;base64,cm9vbQ==' }],
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [{
          id: 'room-link',
          name: 'Salle 2',
          actionType: 'project_link',
          objectImageId: 'asset-room',
          x: 60,
          y: 45,
          width: 18,
          height: 12,
        }],
        sceneObjects: [],
      }],
    });
    const { container } = render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
      })}
    />);

    const hotspot = screen.getByRole('button', { name: 'Salle 2' });
    expect(hotspot.className).toContain('player-hotspot-with-image');
    const image = container.querySelector('.player-hotspot-image');
    expect(image?.getAttribute('src')).toBe('data:image/png;base64,cm9vbQ==');
  });

  test('ouvre la fiche fallback d un objet de scene lie sans image', () => {
    const setViewerImage = vi.fn();
    const project = makeProject({
      items: [{ id: 'note', name: 'Note froissee', icon: 'NOTE' }],
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [],
        sceneObjects: [{
          id: 'scene-note',
          name: 'Note sur table',
          interactionMode: 'popup',
          linkedItemId: 'note',
          x: 45,
          y: 45,
          width: 16,
          height: 12,
        }],
      }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
        setViewerImage,
      })}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Note sur table' }));
    expect(setViewerImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note',
      src: '',
      name: 'Note froissee',
      icon: 'NOTE',
      caption: 'Note sur table',
    }));
  });

  test('affiche le pop-up d un objet de scene sans objet d inventaire lie', () => {
    const setViewerImage = vi.fn();
    const project = makeProject({
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [],
        sceneObjects: [{
          id: 'painting',
          name: 'Tableau fissure',
          imageData: 'data:image/png;base64,dmlzaWJsZQ==',
          popupImageData: 'data:image/png;base64,cG9wdXA=',
          popupImageName: 'Detail du tableau',
          interactionMode: 'popup',
          linkedItemId: '',
          x: 45,
          y: 45,
          width: 16,
          height: 12,
        }],
      }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
        setViewerImage,
      })}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Tableau fissure' }));
    expect(setViewerImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'painting',
      src: 'data:image/png;base64,cG9wdXA=',
      name: 'Tableau fissure',
      caption: 'Tableau fissure',
    }));
  });

  test('affiche l image objet d un objet de scene sans objet d inventaire lie', () => {
    const setViewerImage = vi.fn();
    const project = makeProject({
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [],
        sceneObjects: [{
          id: 'lens',
          name: 'Lentille observee',
          imageData: 'data:image/png;base64,dmlzaWJsZQ==',
          objectImageData: 'data:image/png;base64,b2JqZWN0',
          objectImageName: 'Detail de lentille',
          interactionMode: 'popup',
          linkedItemId: '',
          x: 45,
          y: 45,
          width: 16,
          height: 12,
        }],
      }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
        setViewerImage,
      })}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Lentille observee' }));
    expect(setViewerImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'lens',
      src: 'data:image/png;base64,b2JqZWN0',
      name: 'Lentille observee',
      caption: 'Lentille observee',
    }));
  });

  test('affiche une miniature d inventaire venant de la mediatheque', () => {
    const openInventoryItem = vi.fn();
    const project = makeProject({
      assets: [{ id: 'asset-watch', type: 'image', url: 'data:image/png;base64,d2F0Y2g=' }],
      items: [{ id: 'watch', name: 'Montre arretee', imageId: 'asset-watch', icon: '⌚' }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        inventory: ['watch'],
        openInventoryItem,
      })}
    />);

    fireEvent.click(screen.getByRole('button', { name: /inventaire \(1\)/i }));

    const watchImages = screen.getAllByAltText('Montre arretee');
    expect(watchImages.length).toBeGreaterThanOrEqual(1);
    expect(watchImages.every((image) => image.getAttribute('src') === 'data:image/png;base64,d2F0Y2g=')).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: /Montre arretee/i })[0]);
    expect(openInventoryItem).toHaveBeenCalledWith('watch', { previewOnly: true });
  });

  test('rend les objets invisibles comme zones cliquables de preview', () => {
    const project = makeProject({
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [],
        sceneObjects: [{
          id: 'hidden-watch',
          name: 'Montre cachee',
          isInvisible: true,
          interactionMode: 'inventory',
          linkedItemId: 'watch',
          x: 40,
          y: 40,
          width: 14,
          height: 14,
        }],
      }],
      items: [{ id: 'watch', name: 'Montre arretee', icon: '⌚' }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        playScene: project.scenes[0],
      })}
    />);

    const invisibleObject = screen.getByRole('button', { name: 'Montre cachee' });
    expect(invisibleObject.className).toContain('player-scene-object-invisible');
  });

  test('rend le carnet aventure avec inventaire et variables', () => {
    const project = makeProject({
      creationMode: 'adventure_choices',
      items: [{ id: 'map', name: 'Carte ancienne', icon: 'M' }],
      storyVariables: [{ key: 'trust', name: 'Confiance', journalLabel: 'Confiance' }],
      scenes: [{
        id: 'scene-1',
        name: 'Salle blanche',
        introText: 'Le preview est stable.',
        hotspots: [{
          id: 'talk',
          name: 'Parler',
          actionType: 'conversation',
          conversation: {
            nodes: [{
              id: 'node-1',
              replies: [{
                id: 'reply-ending',
                label: 'Conclure',
                actionType: 'ending',
              }, {
                id: 'reply-locked',
                label: 'Secret',
                conditionType: 'story_variable',
              }],
            }],
          },
        }],
        sceneObjects: [],
      }],
    });

    render(<PlaytestWorkspace
      {...makeProps({
        project,
        inventory: ['map'],
        storyVariables: { trust: 2 },
        chosenConversationReplyIds: ['reply-ending'],
        hiddenConversationReplyIds: ['reply-locked'],
      })}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Carnet \(1\)/ }));

    expect(screen.getByText('Progression')).toBeTruthy();
    expect(screen.getByText('Carte ancienne')).toBeTruthy();
    expect(screen.getAllByText('Confiance').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => (
        element?.tagName === 'SPAN'
        && element.textContent?.replace(/\s+/g, ' ').trim() === 'Confiance = 2'
      )).length,
    ).toBeGreaterThan(0);
  });
});
