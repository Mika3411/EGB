import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PreviewTab from '../components/PreviewTab.jsx';

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

describe('PreviewTab render regressions', () => {
  test('rend le preview sans enigme active', () => {
    render(<PreviewTab {...makeProps()} />);

    expect(screen.getAllByText('Le preview est stable.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Valider l’enigme')).toBeNull();
  });
  test('rend une enigme active avec contenu de saisie', () => {
    const setEnigmaCodeInput = vi.fn();
    render(<PreviewTab
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
    render(<PreviewTab
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

    render(<PreviewTab
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
