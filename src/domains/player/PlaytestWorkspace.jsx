import { useRef, useState } from 'react';
import { POPUP_OVERLAY_GRADIENTS } from '../../shared/data/enigmaConfig';
import {
  createInventoryViewerImage as createGameInventoryViewerImage,
  getSceneAmbientSoundUrl,
  getSceneBackgroundUrl,
  getSceneMusicUrl,
} from '../../shared/services/gameEngine';
import { resolveAssetUrl } from '../../shared/services/assetManager';
import { getElementShapeStyle, getLayerZIndex } from '../../shared/services/sceneRender';
import {
  getSceneObjectBlockType,
  getSceneObjectClickMode,
} from '../../shared/services/sceneObjectBlocks';
import { showPrompt } from '../../shared/ui/AccessibleDialog';
import Anime2DPreview from '../anime2d/Anime2DPreview.jsx';
import PreviewAdventureInventoryContent from './components/PreviewAdventureInventoryContent.jsx';
import PreviewAdventureJournal from './components/PreviewAdventureJournal.jsx';
import PreviewCinematicOverlay from './components/PreviewCinematicOverlay.jsx';
import PreviewCombatOverlay from './components/PreviewCombatOverlay.jsx';
import PreviewEnigmaModal from './components/PreviewEnigmaModal.jsx';
import PreviewHeroSetupOverlay from './components/PreviewHeroSetupOverlay.jsx';
import PreviewHeroPanel from './components/PreviewHeroPanel.jsx';
import PreviewObjectiveChecklist from './components/PreviewObjectiveChecklist.jsx';
import PreviewPauseOverlay from './components/PreviewPauseOverlay.jsx';
import PreviewSidePanel from './components/PreviewSidePanel.jsx';
import PreviewStagePanel from './components/PreviewStagePanel.jsx';
import PreviewStoryOverlays from './components/PreviewStoryOverlays.jsx';
import { usePreviewBrowserEffects } from './components/usePreviewBrowserEffects.js';

import {
  HERO_POWER_TYPE_LABELS,
  HERO_RESISTANCE_SUMMARY_FIELDS,
  getCombatEntryValue,
  getCombatActorMedia,
  getHeroForceSkill,
} from './components/previewCombatSummaryHelpers.js';

export default function PlaytestWorkspace(props) {
  const {
    playScene,
    viewerImage,
    setViewerImage,
    playingCinematic,
    playingSlideIndex,
    currentSlide,
    setPlayingSlideIndex,
    closeCinematic,
    advanceCinematic,
    audioRef,
    onSceneTimerEnd,
    triggerHotspot,
    resetPreview,
    saveGameState,
    loadGameState,
    restoreLastChoiceSnapshot,
    getSceneLabel,
    dialogue,
    inventory,
    visitedSceneIds = [],
    storyVariables = {},
    adventureJournalEntries = [],
    chosenConversationReplyIds = [],
    hiddenConversationReplyIds = [],
    completedHotspotIds = [],
    addInventoryItem,
    removeInventoryItem,
    playerLives = 3,
    heroAdventure = { enabled: false },
    heroState = null,
    heroSetupComplete = true,
    activeHeroCombat = null,
    heroCombatStates = {},
    attackActiveHeroCombat,
    rollActiveEnemyCombat,
    attemptSurvivalHeroCombat,
    attemptEscapeHeroCombat,
    closeHeroCombat,
    equippedHeroItemIds = [],
    equippedHeroSlotMap = {},
    lastChoiceSnapshot = null,
    adjustHeroStat,
    lastDiceRoll,
    rollHeroDie,
    selectHeroCharacter,
    rollHeroSetupSkills,
    completeHeroSetup,
    sceneTimerResetKey = 0,
    setInventory,
    setSelectedInventoryIds,
    usedSceneObjectIds = [],
    revealedSceneObjectIds = [],
    sceneObjectTextOverrides = {},
    markSceneObjectUsed,
    markHotspotCompleted,
    project,
    selectedInventoryIds,
    openInventoryItem,
    equipHeroItem,
    unequipHeroItem,
    setDraggedInventoryId,
    draggedInventoryId,
    combineInventoryItems,
    setDialogue,
    activeEnigma,
    activeConversation,
    activeEnding,
    choiceEffectNotices = [],
    closeConversation,
    closeEnding,
    clearChoiceEffectNotices,
    isConversationReplyAvailable,
    getConversationReplyLockReason,
    chooseConversationReply,
    heroCharacterPreviewRequestKey = 0,
    enigmaCodeInput,
    setEnigmaCodeInput,
    enigmaColorAttempt,
    setEnigmaColorAttempt,
    pushEnigmaColor,
    closeEnigma,
    submitEnigma,
    enigmaPuzzleOrder,
    enigmaPuzzleSelectedIndex,
    clickPuzzlePiece,
    enigmaDragBank,
    enigmaDragSlots,
    enigmaDraggedPiece,
    setEnigmaDraggedPiece,
    moveDragPieceToSlot,
    returnDragPieceToBank,
    enigmaRotationAngles,
    rotatePuzzlePiece,
    simonPlaybackIndex,
    simonPlayerTurn,
    startSimonPlayback,
    sharedPlayerMode = false,
  } = props;

  const sceneAudioRef = useRef(null);
  const sceneAudioSourceRef = useRef('');
  const ambientAudioRef = useRef(null);
  const ambientAudioSourceRef = useRef('');
  const hotspotAudioRef = useRef(null);
  const heroIntroAudioRef = useRef(null);
  const heroIntroAudioSourceRef = useRef('');
  const playerShellRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const previousSceneRef = useRef(playScene);
  const transitionTimerRef = useRef(null);
  const sceneTimerIntervalRef = useRef(null);
  const expiredSceneTimerKeyRef = useRef('');
  const onSceneTimerEndRef = useRef(onSceneTimerEnd);
  const loadedActIdRef = useRef(playScene?.actId || '');
  const mediaPreloadRef = useRef({ images: [], audios: [] });
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isHeroPanelOpen, setIsHeroPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedSceneAspectRatio, setLoadedSceneAspectRatio] = useState(0);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isObjectiveOpen, setIsObjectiveOpen] = useState(false);
  const [showInteractionHints, setShowInteractionHints] = useState(true);
  const [isNarrationCollapsed, setIsNarrationCollapsed] = useState(false);
  const [sceneTransitionOverlay, setSceneTransitionOverlay] = useState(null);
  const [sceneTimerRemaining, setSceneTimerRemaining] = useState(0);
  const [actPreloadStatus, setActPreloadStatus] = useState({ isLoading: false, progress: 100, label: '' });
  const [debugInventoryItemId, setDebugInventoryItemId] = useState(project.items?.[0]?.id || '');
  const [isHeroSetupRolling, setIsHeroSetupRolling] = useState(false);
  const [heroSetupRollingIndex, setHeroSetupRollingIndex] = useState(-1);
  const [heroSetupDiceFaces, setHeroSetupDiceFaces] = useState([]);
  const [heroSetupFinalRolls, setHeroSetupFinalRolls] = useState([]);
  const [heroSetupResultsRevealed, setHeroSetupResultsRevealed] = useState(false);
  const [heroSetupSelectionConfirmed, setHeroSetupSelectionConfirmed] = useState(false);
  const [heroSetupGalleryIndex, setHeroSetupGalleryIndex] = useState(0);
  const [heroPanelRollingSkillId, setHeroPanelRollingSkillId] = useState(null);
  const [heroPanelDieFace, setHeroPanelDieFace] = useState(1);
  const [heroRewardNotice, setHeroRewardNotice] = useState(null);
  const [selectedHeroCombatPowerId, setSelectedHeroCombatPowerId] = useState('');
  const [heroCombatRolling, setHeroCombatRolling] = useState(false);
  const [heroCombatDieFace, setHeroCombatDieFace] = useState(1);
  const [heroCombatEffectLocked, setHeroCombatEffectLocked] = useState(false);
  const heroSetupRollTimerRef = useRef(null);
  const heroSetupRollIntervalRef = useRef(null);
  const heroSetupDiceFacesRef = useRef([]);
  const heroPanelRollIntervalRef = useRef(null);
  const heroPanelDieFaceRef = useRef(1);
  const heroCombatRollIntervalRef = useRef(null);
  const heroCombatAutoStopTimeoutRef = useRef(null);
  const heroCombatEffectLockTimeoutRef = useRef(null);
  const heroCombatDieFaceRef = useRef(1);
  const heroRewardNoticeTimerRef = useRef(null);
  const draggedInventoryIdRef = useRef(null);
  const sceneAspectRatio = Number(loadedSceneAspectRatio || playScene?.backgroundAspectRatio) > 0 ?
     Number(loadedSceneAspectRatio || playScene.backgroundAspectRatio)
    : 1.6;
  const playSceneBackgroundUrl = getSceneBackgroundUrl(project, playScene);
  const playSceneMusicUrl = getSceneMusicUrl(project, playScene);
  const playSceneAmbientSoundUrl = getSceneAmbientSoundUrl(project, playScene);
  const transitionPreviousBackgroundUrl = getSceneBackgroundUrl(project, sceneTransitionOverlay?.previousScene);
  const isHeroAdventure = Boolean(heroAdventure?.enabled && heroState);
  const isChoiceAdventure = !isHeroAdventure && ['adventure', 'adventure_choices'].includes(project?.creationMode);
  const usesImmersiveAdventurePlayer = isHeroAdventure || isChoiceAdventure;
  const isHeroSetupOpen = Boolean(isHeroAdventure && !heroSetupComplete);
  const isHeroDefeated = Boolean(isHeroAdventure && Number(heroState?.health || 0) <= 0);
  const isCustomHeroDefeatScene = Boolean(isHeroDefeated && heroAdventure?.hero?.defeatSceneId && playScene?.id === heroAdventure.hero.defeatSceneId);
  const heroDiceSkin = heroAdventure?.dice?.skin || 'classic';
  const heroSetupBackgroundImageData = heroAdventure?.hero?.setupBackgroundImageData || heroState?.setupBackgroundImageData || '';
  const heroSetupMusicData = heroAdventure?.hero?.setupMusicData || heroState?.setupMusicData || '';
  const currentGameTitle = String(project?.title || 'Escape game').trim() || 'Escape game';
  const playerButtonStyle = ['modern', 'parchment', 'arcane', 'stone', 'neon', 'blood'].includes(project?.ui?.buttonStyle)
    ? project.ui.buttonStyle
    : 'modern';
  const playerButtonFont = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.buttonFont)
    ? project.ui.buttonFont
    : 'system';
  const playerNarrationFont = ['system', 'serif', 'story', 'fantasy', 'medieval', 'gothic', 'mono'].includes(project?.ui?.narrationFont)
    ? project.ui.narrationFont
    : 'system';
  const playerNarrationBackground = project?.ui?.narrationBackground || 'rgba(2, 6, 23, .62)';

  const {
    addDebugInventoryItem,
    handleShellMouseMove,
    removeDebugInventoryItem,
    revealControls,
    toggleFullscreen,
  } = usePreviewBrowserEffects({
    activeHeroCombat,
    actPreloadStatus,
    addInventoryItem,
    ambientAudioRef,
    ambientAudioSourceRef,
    controlsTimerRef,
    debugInventoryItemId,
    dialogue,
    draggedInventoryId,
    draggedInventoryIdRef,
    expiredSceneTimerKeyRef,
    heroAdventure,
    heroCharacterPreviewRequestKey,
    heroCombatAutoStopTimeoutRef,
    heroCombatEffectLockTimeoutRef,
    heroCombatRollIntervalRef,
    heroIntroAudioRef,
    heroIntroAudioSourceRef,
    heroPanelRollIntervalRef,
    heroRewardNoticeTimerRef,
    heroSetupDiceFacesRef,
    heroSetupMusicData,
    heroSetupRollIntervalRef,
    heroSetupRollTimerRef,
    heroState,
    hotspotAudioRef,
    isFullscreen,
    isHeroAdventure,
    isHeroSetupOpen,
    loadedActIdRef,
    mediaPreloadRef,
    onSceneTimerEnd,
    onSceneTimerEndRef,
    playScene,
    playSceneAmbientSoundUrl,
    playSceneBackgroundUrl,
    playSceneMusicUrl,
    playerShellRef,
    previousSceneRef,
    project,
    removeInventoryItem,
    sceneAudioRef,
    sceneAudioSourceRef,
    sceneTimerIntervalRef,
    sceneTimerResetKey,
    setActPreloadStatus,
    setAreControlsVisible,
    setDebugInventoryItemId,
    setDialogue,
    setHeroCombatEffectLocked,
    setHeroCombatRolling,
    setHeroSetupDiceFaces,
    setHeroSetupFinalRolls,
    setHeroSetupGalleryIndex,
    setHeroSetupResultsRevealed,
    setHeroSetupRollingIndex,
    setHeroSetupSelectionConfirmed,
    setInventory,
    setIsFullscreen,
    setIsHeroPanelOpen,
    setIsHeroSetupRolling,
    setIsInventoryOpen,
    setIsNarrationCollapsed,
    setIsPauseOpen,
    setLoadedSceneAspectRatio,
    setSceneTimerRemaining,
    setSceneTransitionOverlay,
    setSelectedHeroCombatPowerId,
    setSelectedInventoryIds,
    setViewerImage,
    sharedPlayerMode,
    transitionTimerRef,
    viewerImage,
  });
  const handleHotspotClick = (event, spot) => {
    event.stopPropagation();

    triggerHotspot(spot);
  };


  const handleSceneObjectClick = async (event, obj) => {
    event.stopPropagation();
    if (!obj) return;
    const clickMode = getSceneObjectClickMode(obj);
    if (clickMode === 'none') return;
    if (clickMode === 'action') {
      handleHotspotClick(event, obj);
      return;
    }
    setViewerImage(null);
    const objectSoundUrl = resolveAssetUrl(project, obj.soundId, obj.soundData);
    if (objectSoundUrl) {
      if (hotspotAudioRef.current) {
        hotspotAudioRef.current.pause();
        hotspotAudioRef.current.currentTime = 0;
      }
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = objectSoundUrl;
      audio.volume = typeof obj.soundVolume === 'number' ? obj.soundVolume : 0.8;
      audio.play().catch(() => {});
      hotspotAudioRef.current = audio;
    }

    const blockType = getSceneObjectBlockType(obj);
    if (['input', 'code'].includes(blockType)) {
      const answer = await showPrompt({
        title: blockType === 'code' ? 'Code' : 'Réponse',
        message: obj.placeholder || (blockType === 'code' ? 'Entre le code.' : 'Entre ta réponse.'),
        inputLabel: blockType === 'code' ? 'Code' : 'Réponse',
        confirmLabel: 'Valider',
      });
      if (answer === null) return;
      const normalize = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const isCorrect = normalize(answer) === normalize(obj.expectedAnswer);
      setDialogue(isCorrect
        ? (obj.successDialogue || obj.dialogue || 'Bonne réponse.')
        : (obj.failureDialogue || 'Ce n est pas la bonne réponse.'));
      if (isCorrect) markHotspotCompleted?.(obj.id);
      if (isCorrect && (obj.logicRules || []).length) {
        triggerHotspot(obj);
      }
      if (isCorrect && obj.removeAfterUse) markSceneObjectUsed?.(obj.id);
      return;
    }

    if ((obj.logicRules || []).length) {
      triggerHotspot(obj);
      return;
    }

    const mode = obj.interactionMode || 'popup';
    const linkedItem = obj.linkedItemId ?
       project.items.find((entry) => entry.id === obj.linkedItemId)
      : null;
    const linkedItemViewer = createGameInventoryViewerImage(project, linkedItem);
    const popupSrc = resolveAssetUrl(project, obj.popupImageId, obj.popupImageData || obj.popupImage)
      || resolveAssetUrl(project, obj.objectImageId, obj.objectImageData)
      || resolveAssetUrl(project, obj.imageId, obj.imageData)
      || linkedItemViewer?.src
      || '';
    const fallbackViewer = linkedItemViewer || (obj.linkedItemId ? createGameInventoryViewerImage(project, obj.linkedItemId) : null);

    if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
      let wasAdded = false;
      if (addInventoryItem) {
        wasAdded = addInventoryItem(obj.linkedItemId);
      } else {
        setInventory?.((prev) => (prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId]));
        setSelectedInventoryIds?.((prev) => (
          prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId].slice(-2)
        ));
        wasAdded = true;
      }
      if (!wasAdded && fallbackViewer) setViewerImage(fallbackViewer);
      setDialogue(obj.dialogue || `Tu obtiens ${linkedItem?.name || obj.name || 'un objet'}.`);
    } else if (obj.dialogue) {
      setDialogue(obj.dialogue);
    }

    if ((mode === 'popup' || mode === 'both') && popupSrc) {
      setViewerImage({
        id: obj.linkedItemId || obj.id,
        src: popupSrc,
        name: obj.name || linkedItem?.name || obj.popupImageName || 'Objet',
        caption: obj.dialogue || obj.name || linkedItem?.name || '',
      });
    } else if ((mode === 'popup' || mode === 'both') && fallbackViewer) {
      setViewerImage({
        ...fallbackViewer,
        caption: obj.dialogue || obj.name || linkedItem?.name || fallbackViewer.name || '',
      });
    }

    if (obj.removeAfterUse) {
      markSceneObjectUsed?.(obj.id);
    }
    markHotspotCompleted?.(obj.id);
  };

  const enigma = activeEnigma?.enigma || null;
  const endingLabel = activeEnding?.label || 'Fin';
  const storyVariableEntries = Object.entries(storyVariables || {});
  const visibleStoryVariableEntries = storyVariableEntries.filter(([key]) => {
    const definition = (project.storyVariables || []).find((variable) => variable.key === key);
    return definition ? definition.journalVisible !== false : true;
  });
  const getStoryVariableJournalLabel = (key) => (
    (project.storyVariables || []).find((variable) => variable.key === key)?.journalLabel || key
  );
  const getJournalItemLabel = (itemId) => {
    const item = (project.items || []).find((entry) => entry.id === itemId);
    return item ? `${item.icon || ''} ${item.name || 'Objet'}`.trim() : 'Objet';
  };
  const objectiveChecklist = heroAdventure?.objectiveChecklist || project?.heroAdventure?.objectiveChecklist || null;
  const objectiveConditionContext = {
    inventory,
    completedHotspotIds,
    chosenConversationReplyIds,
    storyVariables,
    project,
    getItemById: (itemId) => (project.items || []).find((entry) => entry.id === itemId),
    getStoryVariableLabel: getStoryVariableJournalLabel,
  };
  const conversationReplies = (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((spot) => spot.actionType === 'conversation')
      .flatMap((spot) => (spot.conversation?.nodes || []).flatMap((node) => node.replies || []))
  ));
  const endingReplies = conversationReplies.filter((reply) => reply.actionType === 'ending');
  const hiddenReplies = conversationReplies.filter((reply) => (reply.conditionType || 'none') !== 'none');
  const getItemById = (itemId) => (project.items || []).find((entry) => entry.id === itemId);
  const getItemImageUrl = (item = null) => (
    item ? resolveAssetUrl(project, item.imageId, item.imageData) : ''
  );
  const equippedHeroItems = isHeroAdventure
    ? equippedHeroItemIds.map((itemId) => getItemById(itemId)).filter(Boolean)
    : [];
  const carriedInventoryIds = isHeroAdventure
    ? inventory.filter((itemId) => !equippedHeroItemIds.includes(itemId))
    : inventory;
  const getHeroEquipmentBonusLabel = (item) => {
    const bonus = Number(item?.heroItemBonus) || 1;
    const sign = bonus >= 0 ? '+' : '';
    if ((item?.heroItemBonusTarget || 'skill') === 'maxHealth') return `PV max ${sign}${bonus}`;
    if ((item?.heroItemBonusTarget || 'skill') === 'maxMana') return `Mana max ${sign}${bonus}`;
    const skill = (heroState?.skills || []).find((entry) => entry.id === item?.heroItemSkillId);
    return `${skill?.name || 'Compétence'} ${sign}${bonus}`;
  };
  const getHeroRewardBonusLabel = (item) => {
    if (!isHeroAdventure || !item) return '';
    if ((item.heroItemType || 'none') === 'equipment') return getHeroEquipmentBonusLabel(item);
    if (item.heroItemType === 'health_potion') return `PV +${Math.max(1, Number(item.heroItemAmount) || 4)}`;
    if (item.heroItemType === 'mana_potion') return `Mana +${Math.max(1, Number(item.heroItemAmount) || 3)}`;
    return '';
  };
  const showHeroRewardNotice = (itemId) => {
    const item = project.items?.find((entry) => entry.id === itemId);
    if (!item) return;
    if (heroRewardNoticeTimerRef.current) window.clearTimeout(heroRewardNoticeTimerRef.current);
    setHeroRewardNotice({
      id: `${item.id}-${Date.now()}`,
      name: item.name || 'Objet obtenu',
      icon: item.icon || '+',
      imageData: getItemImageUrl(item),
      bonus: getHeroRewardBonusLabel(item),
    });
    heroRewardNoticeTimerRef.current = window.setTimeout(() => {
      setHeroRewardNotice(null);
      heroRewardNoticeTimerRef.current = null;
    }, 2600);
  };
  const handleConversationReplyClick = (reply) => {
    if (reply?.rewardItemId) showHeroRewardNotice(reply.rewardItemId);
    chooseConversationReply?.(reply);
  };
  const heroEquipmentSlotCount = Math.max(1, Math.min(8, Number(heroAdventure?.hero?.equipmentSlotCount || 6)));
  const normalizedHeroSlotMap = equippedHeroSlotMap && typeof equippedHeroSlotMap === 'object' ? equippedHeroSlotMap : {};
  const mappedHeroSlotIds = Array.from({ length: heroEquipmentSlotCount }, (_, index) => normalizedHeroSlotMap[String(index)] || '');
  const mappedHeroSlotIdSet = new Set(mappedHeroSlotIds.filter(Boolean));
  const overflowEquippedHeroItems = equippedHeroItems.filter((item) => !mappedHeroSlotIdSet.has(item.id));
  const heroEquipmentSlots = Array.from({ length: Math.max(heroEquipmentSlotCount, equippedHeroItems.length) }, (_, index) => {
    const mappedItem = mappedHeroSlotIds[index] ? getItemById(mappedHeroSlotIds[index]) : null;
    return mappedItem || overflowEquippedHeroItems.shift() || null;
  });
  const defaultHeroEquipmentSlotLabels = ['Casque', 'Bouclier', 'Arme', 'Armure', 'Anneau', 'Jambieres', 'Amulette', 'Sac'];
  const heroEquipmentSlotLabels = defaultHeroEquipmentSlotLabels.map((label, index) => (
    heroAdventure?.hero?.equipmentSlotLabels?.[index] || label
  ));
  const getHeroSlotLabel = (item, index) => {
    if (!item) return heroEquipmentSlotLabels[index % heroEquipmentSlotLabels.length];
    if ((item.heroItemBonusTarget || 'skill') === 'maxHealth') return 'PV';
    if ((item.heroItemBonusTarget || 'skill') === 'maxMana') return 'Mana';
    const skill = (heroState?.skills || []).find((entry) => entry.id === item.heroItemSkillId);
    return skill?.name || 'Bonus';
  };
  const setDraggedHeroItem = (event, itemId) => {
    draggedInventoryIdRef.current = itemId || null;
    setDraggedInventoryId(itemId || null);
    if (event?.dataTransfer && itemId) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
      event.dataTransfer.setData('application/x-hero-item-id', itemId);
    }
  };
  const clearDraggedHeroItem = () => {
    draggedInventoryIdRef.current = null;
    setDraggedInventoryId(null);
  };
  const getDraggedHeroItemId = (event) => (
    event?.dataTransfer?.getData('application/x-hero-item-id')
    || event?.dataTransfer?.getData('text/plain')
    || draggedInventoryIdRef.current
    || draggedInventoryId
    || ''
  );
  const dropHeroEquipment = (event, slotItem = null, slotIndex = null) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedItemId = getDraggedHeroItemId(event);
    const draggedItem = getItemById(draggedItemId);
    if (!draggedItem) {
      clearDraggedHeroItem();
      return;
    }
    if ((draggedItem.heroItemType || 'none') !== 'equipment') {
      setDialogue?.('Cet objet ne se porte pas.');
      clearDraggedHeroItem();
      return;
    }
    if (slotItem && slotItem.id !== draggedItem.id) unequipHeroItem?.(slotItem.id);
    equipHeroItem?.(draggedItem.id, slotIndex);
    clearDraggedHeroItem();
  };
  const dropHeroInventory = (event) => {
    event.preventDefault();
    const draggedItemId = getDraggedHeroItemId(event);
    if (draggedItemId && equippedHeroItemIds.includes(draggedItemId)) {
      unequipHeroItem?.(draggedItemId);
    }
    clearDraggedHeroItem();
  };
  const equipHeroItemFromEmptySlot = (slotIndex = null) => {
    const selectedEquipmentId = selectedInventoryIds.find((itemId) => {
      const item = getItemById(itemId);
      return item && (item.heroItemType || 'none') === 'equipment' && !equippedHeroItemIds.includes(itemId);
    });
    const firstCarriedEquipmentId = carriedInventoryIds.find((itemId) => {
      const item = getItemById(itemId);
      return item && (item.heroItemType || 'none') === 'equipment';
    });
    const itemId = selectedEquipmentId || firstCarriedEquipmentId || '';
    if (!itemId) {
      setDialogue?.("Aucun équipement disponible dans l'inventaire.");
      return;
    }
    equipHeroItem?.(itemId, slotIndex);
  };
  const conversationNode = activeConversation?.conversation?.nodes?.find((node) => node.id === activeConversation.nodeId) || null;
  const visibleConversationReplies = conversationNode
    ? (conversationNode.replies || []).filter((reply) => isConversationReplyAvailable?.(reply) !== false)
    : [];
  const lockedConversationReplies = usesImmersiveAdventurePlayer && conversationNode
    ? (conversationNode.replies || []).filter((reply) => {
      const isConsumed = reply.id && (
        hiddenConversationReplyIds.includes(reply.id)
        || (reply.hideAfterChosen && chosenConversationReplyIds.includes(reply.id))
      );
      return isConversationReplyAvailable?.(reply) === false && reply.showWhenLocked && !isConsumed;
    })
    : [];
  const displayedConversationReplies = [...visibleConversationReplies, ...lockedConversationReplies];
  const visibleChoiceEffectNotices = choiceEffectNotices.filter((notice = {}) => {
    const normalizedTitle = String(notice.title || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    return normalizedTitle !== 'nouvelle scene';
  });
  const renderChoiceEffectSummary = (compact = false) => {
    if (!visibleChoiceEffectNotices.length) return null;
    return (
      <div className={`choice-effect-summary ${compact ? 'compact' : ''}`}>
        <div className="choice-effect-summary-head">
          <strong>Conséquences du choix</strong>
          {clearChoiceEffectNotices ? (
            <button type="button" className="secondary-action" onClick={clearChoiceEffectNotices}>
              Masquer
            </button>
          ) : null}
        </div>
        <div className="choice-effect-list">
          {visibleChoiceEffectNotices.map((notice, index) => (
            <span key={`${notice.type || 'effect'}-${index}`} className={`choice-effect-pill choice-effect-${notice.type || 'effect'}`}>
              <strong>{notice.title || 'Effet'}</strong>
              {notice.detail ? <small>{notice.detail}</small> : null}
            </span>
          ))}
        </div>
      </div>
    );
  };
  const renderAdventureJournal = (compact = false) => (
    <PreviewAdventureJournal
      compact={compact}
      adventureJournalEntries={adventureJournalEntries}
      inventory={inventory}
      visibleStoryVariableEntries={visibleStoryVariableEntries}
      activeEnding={activeEnding}
      endingLabel={endingLabel}
      getJournalItemLabel={getJournalItemLabel}
      getStoryVariableJournalLabel={getStoryVariableJournalLabel}
    />
  );
  const renderObjectiveChecklist = (compact = false) => (
    <PreviewObjectiveChecklist
      checklist={objectiveChecklist}
      conditionContext={objectiveConditionContext}
      compact={compact}
    />
  );
  const renderAdventureInventoryContent = (compact = false) => (
    <PreviewAdventureInventoryContent
      compact={compact}
      sharedPlayerMode={sharedPlayerMode}
      chosenConversationReplyIds={chosenConversationReplyIds}
      hiddenReplies={hiddenReplies}
      visibleStoryVariableEntries={visibleStoryVariableEntries}
      endingReplies={endingReplies}
      activeEnding={activeEnding}
      endingLabel={endingLabel}
      getStoryVariableJournalLabel={getStoryVariableJournalLabel}
      renderAdventureJournal={renderAdventureJournal}
      debugInventoryItemId={debugInventoryItemId}
      setDebugInventoryItemId={setDebugInventoryItemId}
      project={project}
      addDebugInventoryItem={addDebugInventoryItem}
      removeDebugInventoryItem={removeDebugInventoryItem}
      inventory={inventory}
      selectedInventoryIds={selectedInventoryIds}
      setDialogue={setDialogue}
      combineInventoryItems={combineInventoryItems}
      openInventoryItem={openInventoryItem}
      setDraggedInventoryId={setDraggedInventoryId}
      draggedInventoryId={draggedInventoryId}
    />
  );
  const enigmaOverlayStyle = enigma?.popupBackgroundData ? {
    backgroundImage: `${POPUP_OVERLAY_GRADIENTS[enigma.popupBackgroundOverlay || 'dark'] || POPUP_OVERLAY_GRADIENTS.dark}, url(${enigma.popupBackgroundData})`,
    backgroundSize: `${Math.round((Number(enigma.popupBackgroundZoom) || 1) * 100)}%`,
    backgroundPosition: `${Number(enigma.popupBackgroundX) || 50}% ${Number(enigma.popupBackgroundY) || 50}%`,
    backgroundRepeat: 'no-repeat',
  } : undefined;
  const getSceneObjectStyle = (obj) => ({
    left: `${obj.x}%`,
    top: `${obj.y}%`,
    width: `${obj.width}%`,
    height: `${obj.height}%`,
    zIndex: getLayerZIndex(obj, 'sceneObject'),
    overflow: 'hidden',
    padding: 0,
    margin: 0,
    border: 0,
    boxSizing: 'border-box',
    background: 'transparent',
    transform: 'translate(-50%, -50%)',
    transformOrigin: 'center center',
    lineHeight: 0,
    ...getElementShapeStyle(obj),
  });

  const startHeroPanelRoll = (skillId = '') => {
    if (!isHeroAdventure || isHeroDefeated || heroPanelRollingSkillId !== null) return;
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const initialFace = Number(lastDiceRoll?.raw) || Math.floor(Math.random() * sides) + 1;
    heroPanelDieFaceRef.current = Math.max(1, Math.min(sides, initialFace));
    setHeroPanelDieFace(heroPanelDieFaceRef.current);
    setHeroPanelRollingSkillId(skillId || '');
    if (heroPanelRollIntervalRef.current) window.clearInterval(heroPanelRollIntervalRef.current);
    heroPanelRollIntervalRef.current = window.setInterval(() => {
      const nextFace = Math.floor(Math.random() * sides) + 1;
      heroPanelDieFaceRef.current = nextFace;
      setHeroPanelDieFace(nextFace);
    }, 80);
  };

  const stopHeroPanelRoll = () => {
    if (heroPanelRollingSkillId === null) return;
    if (heroPanelRollIntervalRef.current) window.clearInterval(heroPanelRollIntervalRef.current);
    heroPanelRollIntervalRef.current = null;
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalRaw = Math.max(1, Math.min(sides, Number(heroPanelDieFaceRef.current) || 1));
    rollHeroDie?.(heroPanelRollingSkillId || '', { raw: finalRaw });
    setHeroPanelRollingSkillId(null);
  };

  const toggleHeroPanelRoll = (skillId = '') => {
    if (heroPanelRollingSkillId !== null) {
      stopHeroPanelRoll();
      return;
    }
    startHeroPanelRoll(skillId);
  };

  const renderHeroAdventurePanel = (compact = false) => (
    <PreviewHeroPanel
      compact={compact}
      isHeroAdventure={isHeroAdventure}
      heroAdventure={heroAdventure}
      heroState={heroState}
      isHeroDefeated={isHeroDefeated}
      heroPanelRollingSkillId={heroPanelRollingSkillId}
      heroPanelDieFace={heroPanelDieFace}
      lastDiceRoll={lastDiceRoll}
      heroDiceSkin={heroDiceSkin}
      adjustHeroStat={adjustHeroStat}
      startHeroPanelRoll={startHeroPanelRoll}
      stopHeroPanelRoll={stopHeroPanelRoll}
      toggleHeroPanelRoll={toggleHeroPanelRoll}
    />
  );

  const renderHeroRewardNotice = () => {
    if (!heroRewardNotice) return null;
    return (
      <div className="hero-reward-notice" key={heroRewardNotice.id}>
        <span className="hero-reward-notice-media">
          {heroRewardNotice.imageData ? (
            <img src={heroRewardNotice.imageData} alt={heroRewardNotice.name} />
          ) : (
            <strong>{heroRewardNotice.icon}</strong>
          )}
        </span>
        <span className="hero-reward-notice-copy">
          <small>Objet obtenu</small>
          <strong>{heroRewardNotice.name}</strong>
          {heroRewardNotice.bonus ? <em>{heroRewardNotice.bonus}</em> : null}
        </span>
      </div>
    );
  };

  const renderHeroCombatOverlay = () => (
    <PreviewCombatOverlay
      activeHeroCombat={activeHeroCombat}
      heroCombatStates={heroCombatStates}
      isHeroAdventure={isHeroAdventure}
      heroAdventure={heroAdventure}
      heroState={heroState}
      playSceneBackgroundUrl={playSceneBackgroundUrl}
      lastDiceRoll={lastDiceRoll}
      inventory={inventory}
      selectedHeroCombatPowerId={selectedHeroCombatPowerId}
      setSelectedHeroCombatPowerId={setSelectedHeroCombatPowerId}
      heroCombatEffectLocked={heroCombatEffectLocked}
      isHeroDefeated={isHeroDefeated}
      heroCombatRolling={heroCombatRolling}
      heroCombatDieFace={heroCombatDieFace}
      heroDiceSkin={heroDiceSkin}
      heroCombatRollIntervalRef={heroCombatRollIntervalRef}
      heroCombatAutoStopTimeoutRef={heroCombatAutoStopTimeoutRef}
      heroCombatDieFaceRef={heroCombatDieFaceRef}
      setHeroCombatDieFace={setHeroCombatDieFace}
      setHeroCombatRolling={setHeroCombatRolling}
      attemptSurvivalHeroCombat={attemptSurvivalHeroCombat}
      rollActiveEnemyCombat={rollActiveEnemyCombat}
      attackActiveHeroCombat={attackActiveHeroCombat}
      attemptEscapeHeroCombat={attemptEscapeHeroCombat}
      closeHeroCombat={closeHeroCombat}
      openInventoryItem={openInventoryItem}
      project={project}
      Anime2DPreviewComponent={Anime2DPreview}
      getCombatEntryValue={getCombatEntryValue}
      getCombatActorMedia={getCombatActorMedia}
    />
  );

  const renderInventoryTiles = (itemIds, emptyLabel = 'Aucun objet.') => (
    <div className="inventory-grid">
      {itemIds.length ? itemIds.map((itemId) => {
        const item = project.items.find((entry) => entry.id === itemId);
        if (!item) return null;
        const itemImageUrl = getItemImageUrl(item);
        return (
          <button
            key={itemId}
            type="button"
            className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
            draggable
            onClick={() => openInventoryItem(itemId, { previewOnly: true })}
            onDragStart={(event) => setDraggedHeroItem(event, itemId)}
            onDragEnd={clearDraggedHeroItem}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const draggedItemId = getDraggedHeroItemId(event);
              if (draggedItemId && draggedItemId !== itemId) {
                combineInventoryItems(draggedItemId, itemId);
              }
              clearDraggedHeroItem();
            }}
          >
            <div className="inventory-thumb">
              {itemImageUrl ? <img src={itemImageUrl} alt={item.name} /> : <span>{item.icon || '📦'}</span>}
            </div>
            <strong>{item.name}</strong>
            {isHeroAdventure && item.heroItemType === 'equipment' ? <small className="inventory-item-badge">A porter</small> : null}
            {isHeroAdventure && ['health_potion', 'mana_potion'].includes(item.heroItemType || '') ? <small className="inventory-item-badge">Consommable</small> : null}
          </button>
        );
      }) : <p>{emptyLabel}</p>}
    </div>
  );

  const renderHeroCharacterPage = (compact = false) => {
    const heroBackgroundStyle = heroState?.backgroundImageData
      ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.28), rgba(2,6,23,.88)), url(${heroState.backgroundImageData})` }
      : undefined;
    const heroSkills = heroState?.skills || [];
    const heroPowers = heroState?.powers || [];
    const forceSkill = getHeroForceSkill(heroSkills);
    const heroForceDamage = Math.max(0, Number(forceSkill?.value) || 0);
    const activeRules = heroState?.rules || heroAdventure?.rules || {};
    const criticalSuccess = Math.max(1, Number(activeRules.criticalSuccess) || Number(heroAdventure?.dice?.sides) || 20);
    const criticalChance = Math.max(0, Math.min(100, Number(activeRules.criticalChance) || 0));
    const criticalMultiplier = Math.max(1, Number(activeRules.criticalMultiplier) || 2);
    const strongestPower = heroPowers.reduce((best, power) => (
      Math.max(0, Number(power.force) || 0) > Math.max(0, Number(best?.force) || 0) ? power : best
    ), null);
    const strongestMagicDamage = strongestPower ? heroForceDamage + Math.max(0, Number(strongestPower.force) || 0) : heroForceDamage;
    return (
      <div className={`hero-character-page ${compact ? 'hero-character-page--compact' : ''}`} style={heroBackgroundStyle}>
        <div className="hero-paper-doll">
          <div className="hero-equipment-slot-grid" aria-label="Équipement porté">
            {heroEquipmentSlots.map((item, index) => (
              <button
                key={item?.id || `empty-${index}`}
                type="button"
                className={`hero-equipment-slot slot-${index % 8} ${item ? 'is-filled' : 'is-empty'}`}
                title={item ? `${item.name} - glisser vers l'inventaire pour retirer` : 'Déposer un équipement ici'}
                draggable={Boolean(item)}
                onClick={() => {
                  if (item) unequipHeroItem?.(item.id);
                  else equipHeroItemFromEmptySlot(index);
                }}
                onDragStart={(event) => item && setDraggedHeroItem(event, item.id)}
                onDragEnd={clearDraggedHeroItem}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropHeroEquipment(event, item, index)}
              >
                <span className="hero-equipment-slot-thumb">
                  {getItemImageUrl(item) ? <img src={getItemImageUrl(item)} alt={item.name} /> : <span>{item?.icon || '+'}</span>}
                </span>
                <small>{getHeroSlotLabel(item, index)}</small>
              </button>
            ))}
          </div>

          <div className="hero-character-core">
            <div className="hero-character-portrait">
              {heroState?.characterImageData ? <img src={heroState.characterImageData} alt={heroState.name || 'Héros'} /> : <span>{heroState?.name?.slice(0, 1) || 'H'}</span>}
            </div>
            <span className="eyebrow">Personnage</span>
            <h3>{heroState?.name || 'Héros'}</h3>
            <small>{heroAdventure.dice?.label || 'de'} principal</small>
            <div className="hero-character-core-stats">
              <span>Force {heroForceDamage}</span>
              <span>Crit {criticalChance}% x{criticalMultiplier}</span>
              <span>Magie {strongestMagicDamage}</span>
            </div>
          </div>
        </div>

        <div className="hero-character-skills">
          {heroSkills.map((skill) => (
            <span key={skill.id}><strong>{skill.name}</strong> +{skill.value}</span>
          ))}
        </div>

        <div className="hero-character-combat">
          <div className="hero-character-combat-stats">
            <span>
              <small>Attaque</small>
              <strong>{heroForceDamage}</strong>
              <em>force</em>
            </span>
            <span>
              <small>Critique</small>
              <strong>{criticalChance}%</strong>
              <em>sur {criticalSuccess}, x{criticalMultiplier}</em>
            </span>
            <span>
              <small>Magie max</small>
              <strong>{strongestMagicDamage}</strong>
              <em>{strongestPower?.name || 'sans pouvoir'}</em>
            </span>
            <span>
              <small>Armure</small>
              <strong>{Math.max(0, Number(heroState?.armor) || 0)}</strong>
              <em>réduction</em>
            </span>
            <span>
              <small>Initiative</small>
              <strong>{Math.max(-999, Math.min(999, Number(heroState?.initiative) || 0))}</strong>
              <em>ordre</em>
            </span>
            <span>
              <small>Esquive</small>
              <strong>{Math.max(0, Math.min(100, Number(heroState?.dodgeChance) || 0))}%</strong>
              <em>annulation</em>
            </span>
          </div>

          {heroPowers.length ? (
            <div className="hero-character-power-list">
              {heroPowers.map((power) => {
                const manaCost = Math.max(0, Number(power.manaCost) || 0);
                const powerForce = Math.max(0, Number(power.force) || 0);
                const healHealth = Math.max(0, Number(power.healHealth) || 0);
                const healMana = Math.max(0, Number(power.healMana) || 0);
                const recoveryText = [healHealth ? `+${healHealth} PV` : '', healMana ? `+${healMana} mana` : ''].filter(Boolean).join(' · ');
                return (
                  <article className="hero-character-power" key={power.id}>
                    <strong>{power.name || 'Pouvoir'}</strong>
                    <span>{HERO_POWER_TYPE_LABELS[power.type] || power.type || 'Pouvoir'}</span>
                    <small>{manaCost} mana · +{powerForce} force · {heroForceDamage + powerForce} dégâts{recoveryText ? ` · ${recoveryText}` : ''}</small>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="hero-character-resistances">
            {HERO_RESISTANCE_SUMMARY_FIELDS.map((resistance) => (
              <span key={resistance.id}>
                <strong>{resistance.label}</strong>
                <em>{Math.max(0, Math.min(100, Number(heroState?.[resistance.field]) || 0))}%</em>
              </span>
            ))}
          </div>
        </div>

        <div className="hero-character-section">
          <h4>Objets portes <small>bonus actifs</small></h4>
          <div className="hero-equipped-list">
            {equippedHeroItems.length ? equippedHeroItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="hero-equipped-item"
                  draggable
                  onClick={() => unequipHeroItem?.(item.id)}
                  onDragStart={(event) => setDraggedHeroItem(event, item.id)}
                  onDragEnd={clearDraggedHeroItem}
                >
                  {getItemImageUrl(item) ? <img src={getItemImageUrl(item)} alt={item.name} /> : <span>{item.icon || '◆'}</span>}
                  <strong>{item.name}</strong>
                  <small>{getHeroEquipmentBonusLabel(item)}</small>
                </button>
            )) : <p>Aucun équipement porté.</p>}
          </div>
        </div>

        <div
          className={`hero-character-section hero-inventory-dropzone ${carriedInventoryIds.length ? 'has-items' : 'is-empty'}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropHeroInventory}
        >
          <h4>Inventaire <small>objets transportes</small></h4>
          {renderInventoryTiles(carriedInventoryIds, "Aucun objet dans l'inventaire.")}
        </div>
      </div>
    );
  };

  const resetHeroSetupSkillResults = () => {
    setHeroSetupFinalRolls([]);
    setHeroSetupDiceFaces([]);
    heroSetupDiceFacesRef.current = [];
    setHeroSetupRollingIndex(-1);
    setHeroSetupResultsRevealed(false);
  };

  const renderHeroSetupScreen = () => (
    <PreviewHeroSetupOverlay
      isOpen={isHeroSetupOpen}
      heroAdventure={heroAdventure}
      heroState={heroState}
      heroDiceSkin={heroDiceSkin}
      heroSetupBackgroundImageData={heroSetupBackgroundImageData}
      heroSetupSelectionConfirmed={heroSetupSelectionConfirmed}
      heroSetupGalleryIndex={heroSetupGalleryIndex}
      heroSetupResultsRevealed={heroSetupResultsRevealed}
      heroSetupFinalRolls={heroSetupFinalRolls}
      heroSetupDiceFaces={heroSetupDiceFaces}
      heroSetupRollingIndex={heroSetupRollingIndex}
      isHeroSetupRolling={isHeroSetupRolling}
      setHeroSetupGalleryIndex={setHeroSetupGalleryIndex}
      setHeroSetupSelectionConfirmed={setHeroSetupSelectionConfirmed}
      selectHeroCharacter={selectHeroCharacter}
      resetHeroSetupRollState={resetHeroSetupRollState}
      resetHeroSetupSkillResults={resetHeroSetupSkillResults}
      startHeroSetupRoll={startHeroSetupRoll}
      stopHeroSetupRoll={stopHeroSetupRoll}
      revealHeroSetupSkills={revealHeroSetupSkills}
      completeHeroSetup={completeHeroSetup}
    />
  );

  const playHeroIntroMusic = () => {
    if (isHeroSetupOpen && heroIntroAudioRef.current) {
      heroIntroAudioRef.current.play().catch(() => {});
    }
  };

  const startHeroSetupRoll = (requestedIndex = heroSetupFinalRolls.length) => {
    if (isHeroSetupRolling) return;
    playHeroIntroMusic();
    const skillCount = Math.max(1, (heroState?.skills || []).length);
    const index = Math.max(0, Math.min(skillCount - 1, Number(requestedIndex) || 0));
    if (index !== heroSetupFinalRolls.length) return;
    if (heroSetupFinalRolls.length >= skillCount) return;
    setIsHeroSetupRolling(true);
    setHeroSetupRollingIndex(index);
    const initialFaces = Array.from({ length: skillCount }, (_, faceIndex) => (
      heroSetupDiceFacesRef.current[faceIndex] || heroSetupDiceFaces[faceIndex] || ((faceIndex % 6) + 1)
    ));
    heroSetupDiceFacesRef.current = initialFaces;
    setHeroSetupDiceFaces(initialFaces);
    if (heroSetupRollTimerRef.current) window.clearTimeout(heroSetupRollTimerRef.current);
    if (heroSetupRollIntervalRef.current) window.clearInterval(heroSetupRollIntervalRef.current);

    heroSetupRollIntervalRef.current = window.setInterval(() => {
      setHeroSetupDiceFaces((faces) => {
        const nextFaces = faces.map((face, faceIndex) => (
          faceIndex === index ? Math.floor(Math.random() * 6) + 1 : face
        ));
        heroSetupDiceFacesRef.current = nextFaces;
        return nextFaces;
      });
    }, 75);
  };

  const stopHeroSetupRoll = () => {
    if (!isHeroSetupRolling || heroSetupRollingIndex < 0) return;
    playHeroIntroMusic();
    if (heroSetupRollTimerRef.current) window.clearTimeout(heroSetupRollTimerRef.current);
    if (heroSetupRollIntervalRef.current) window.clearInterval(heroSetupRollIntervalRef.current);
    heroSetupRollTimerRef.current = null;
    heroSetupRollIntervalRef.current = null;
    const index = heroSetupRollingIndex;
    const finalRoll = Math.max(1, Math.min(6, Number(heroSetupDiceFacesRef.current[index] || heroSetupDiceFaces[index]) || 1));
    setHeroSetupDiceFaces((faces) => {
      const nextFaces = faces.map((face, faceIndex) => (faceIndex === index ? finalRoll : face));
      heroSetupDiceFacesRef.current = nextFaces;
      return nextFaces;
    });
    setHeroSetupFinalRolls((rolls) => {
      const nextRolls = rolls.slice();
      nextRolls[index] = finalRoll;
      return nextRolls;
    });
    setHeroSetupRollingIndex(-1);
    setIsHeroSetupRolling(false);
  };

  const revealHeroSetupSkills = () => {
    const skillCount = Math.max(1, (heroState?.skills || []).length);
    if (heroSetupFinalRolls.length < skillCount || isHeroSetupRolling) return;
    playHeroIntroMusic();
    rollHeroSetupSkills?.(heroSetupFinalRolls);
    setHeroSetupFinalRolls([]);
    setHeroSetupResultsRevealed(true);
  };

  const resetHeroSetupRollState = () => {
    setHeroSetupFinalRolls([]);
    setHeroSetupDiceFaces([]);
    heroSetupDiceFacesRef.current = [];
    setHeroSetupRollingIndex(-1);
    setIsHeroSetupRolling(false);
    setHeroSetupResultsRevealed(false);
    if (heroSetupRollTimerRef.current) window.clearTimeout(heroSetupRollTimerRef.current);
    if (heroSetupRollIntervalRef.current) window.clearInterval(heroSetupRollIntervalRef.current);
    heroSetupRollTimerRef.current = null;
    heroSetupRollIntervalRef.current = null;
  };



  return (
    <div
      ref={playerShellRef}
      data-tour="preview-player"
      className={`player-shell player-button-style-${playerButtonStyle} player-button-font-${playerButtonFont} player-narration-font-${playerNarrationFont} ${isChoiceAdventure ? 'is-choice-adventure' : ''} ${usesImmersiveAdventurePlayer ? 'is-immersive-adventure' : ''} ${isFullscreen ? 'is-fullscreen' : ''} ${sharedPlayerMode ? 'is-shared-player' : ''} ${showInteractionHints ? 'show-hints' : 'hide-hints'} ${!areControlsVisible ? 'controls-hidden' : ''}`}
      style={{ '--player-narration-bg': playerNarrationBackground }}
      onMouseMove={handleShellMouseMove}
      onFocus={() => {
        if (!isFullscreen && !sharedPlayerMode) revealControls();
      }}
    >
      <PreviewStagePanel
        playScene={playScene}
        project={project}
        getSceneLabel={getSceneLabel}
        setIsPauseOpen={setIsPauseOpen}
        resetPreview={resetPreview}
        saveGameState={saveGameState}
        loadGameState={loadGameState}
        showInteractionHints={showInteractionHints}
        setShowInteractionHints={setShowInteractionHints}
        toggleFullscreen={toggleFullscreen}
        sceneAspectRatio={sceneAspectRatio}
        viewerImage={viewerImage}
        setViewerImage={setViewerImage}
        heroSetupOverlay={renderHeroSetupScreen()}
        heroRewardNotice={renderHeroRewardNotice()}
        heroCombatOverlay={renderHeroCombatOverlay()}
        playSceneBackgroundUrl={playSceneBackgroundUrl}
        setLoadedSceneAspectRatio={setLoadedSceneAspectRatio}
        usedSceneObjectIds={usedSceneObjectIds}
        revealedSceneObjectIds={revealedSceneObjectIds}
        sceneObjectTextOverrides={sceneObjectTextOverrides}
        getSceneObjectStyle={getSceneObjectStyle}
        handleSceneObjectClick={handleSceneObjectClick}
        handleHotspotClick={handleHotspotClick}
        actPreloadStatus={actPreloadStatus}
        sceneTransitionOverlay={sceneTransitionOverlay}
        transitionPreviousBackgroundUrl={transitionPreviousBackgroundUrl}
        sceneTimerRemaining={sceneTimerRemaining}
        playerLives={playerLives}
        isNarrationCollapsed={isNarrationCollapsed}
        setIsNarrationCollapsed={setIsNarrationCollapsed}
        dialogue={dialogue}
        isHeroAdventure={isHeroAdventure}
        isChoiceAdventure={isChoiceAdventure}
        isHeroPanelOpen={isHeroPanelOpen}
        isInventoryOpen={isInventoryOpen}
        isObjectiveOpen={isObjectiveOpen}
        usesImmersiveAdventurePlayer={usesImmersiveAdventurePlayer}
        currentGameTitle={currentGameTitle}
        inventory={inventory}
        selectedInventoryIds={selectedInventoryIds}
        debugInventoryItemId={debugInventoryItemId}
        sharedPlayerMode={sharedPlayerMode}
        draggedInventoryId={draggedInventoryId}
        setIsHeroPanelOpen={setIsHeroPanelOpen}
        setIsInventoryOpen={setIsInventoryOpen}
        setIsObjectiveOpen={setIsObjectiveOpen}
        setDebugInventoryItemId={setDebugInventoryItemId}
        setDialogue={setDialogue}
        setDraggedInventoryId={setDraggedInventoryId}
        addDebugInventoryItem={addDebugInventoryItem}
        removeDebugInventoryItem={removeDebugInventoryItem}
        combineInventoryItems={combineInventoryItems}
        openInventoryItem={openInventoryItem}
        renderHeroAdventurePanel={renderHeroAdventurePanel}
        renderHeroCharacterPage={renderHeroCharacterPage}
        renderAdventureInventoryContent={renderAdventureInventoryContent}
        objectiveChecklistContent={objectiveChecklist ? renderObjectiveChecklist(false) : null}
        choiceEffectOverlay={!conversationNode && !activeEnding && !activeHeroCombat ? renderChoiceEffectSummary(false) : null}
      />

      <PreviewSidePanel
        isChoiceAdventure={isChoiceAdventure}
        playScene={playScene}
        getSceneLabel={getSceneLabel}
        dialogue={dialogue}
        renderHeroAdventurePanel={renderHeroAdventurePanel}
        isHeroAdventure={isHeroAdventure}
        renderHeroCharacterPage={renderHeroCharacterPage}
        selectedInventoryIds={selectedInventoryIds}
        setDialogue={setDialogue}
        combineInventoryItems={combineInventoryItems}
        sharedPlayerMode={sharedPlayerMode}
        debugInventoryItemId={debugInventoryItemId}
        setDebugInventoryItemId={setDebugInventoryItemId}
        project={project}
        addDebugInventoryItem={addDebugInventoryItem}
        removeDebugInventoryItem={removeDebugInventoryItem}
        inventory={inventory}
        chosenConversationReplyIds={chosenConversationReplyIds}
        hiddenReplies={hiddenReplies}
        storyVariableEntries={storyVariableEntries}
        endingReplies={endingReplies}
        visibleStoryVariableEntries={visibleStoryVariableEntries}
        getStoryVariableJournalLabel={getStoryVariableJournalLabel}
        activeEnding={activeEnding}
        endingLabel={endingLabel}
        renderAdventureJournal={renderAdventureJournal}
        openInventoryItem={openInventoryItem}
        setDraggedInventoryId={setDraggedInventoryId}
        draggedInventoryId={draggedInventoryId}
      />

      <PreviewCinematicOverlay
        playingCinematic={playingCinematic}
        playingSlideIndex={playingSlideIndex}
        currentSlide={currentSlide}
        project={project}
        audioRef={audioRef}
        closeCinematic={closeCinematic}
        advanceCinematic={advanceCinematic}
        setPlayingSlideIndex={setPlayingSlideIndex}
      />

      <PreviewStoryOverlays
        conversationNode={conversationNode}
        isChoiceAdventure={usesImmersiveAdventurePlayer}
        activeConversation={activeConversation}
        closeConversation={closeConversation}
        renderChoiceEffectSummary={renderChoiceEffectSummary}
        displayedConversationReplies={displayedConversationReplies}
        isConversationReplyAvailable={isConversationReplyAvailable}
        getConversationReplyLockReason={getConversationReplyLockReason}
        handleConversationReplyClick={handleConversationReplyClick}
        activeEnding={activeEnding}
        endingLabel={endingLabel}
        closeEnding={closeEnding}
        resetPreview={resetPreview}
        isHeroDefeated={isHeroDefeated}
        activeHeroCombat={activeHeroCombat}
        isCustomHeroDefeatScene={isCustomHeroDefeatScene}
        loadGameState={loadGameState}
        restoreLastChoiceSnapshot={restoreLastChoiceSnapshot}
        lastChoiceSnapshot={lastChoiceSnapshot}
        visitedSceneIds={visitedSceneIds}
      />

      <PreviewEnigmaModal
        enigma={enigma}
        overlayStyle={enigmaOverlayStyle}
        closeEnigma={closeEnigma}
        project={project}
        controls={props}
      />

      <PreviewPauseOverlay
        isOpen={isPauseOpen}
        projectTitle={project.title}
        chosenConversationReplyCount={chosenConversationReplyIds.length}
        completedHotspotCount={completedHotspotIds.length}
        visibleStoryVariableCount={visibleStoryVariableEntries.length}
        hasActiveEnding={Boolean(activeEnding)}
        isFullscreen={isFullscreen}
        showInteractionHints={showInteractionHints}
        renderAdventureJournal={renderAdventureJournal}
        saveGameState={saveGameState}
        loadGameState={loadGameState}
        resetPreview={resetPreview}
        setShowInteractionHints={setShowInteractionHints}
        onClose={() => setIsPauseOpen(false)}
      />
    </div>
  );
}
