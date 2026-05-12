import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COLOR_OPTIONS, POPUP_OVERLAY_GRADIENTS } from '../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../data/playerConfig';
import {
  createAnime2dPreviewFrame,
  createAnime2dPreviewModel,
} from '../lib/anime2dEngine';
import {
  collectActMediaUrls,
  collectNearbySceneMediaUrls,
  createSceneTransitionOverlay,
  formatTimerSeconds,
  getSceneAmbientSoundUrl,
  getSceneBackgroundUrl,
  getSceneAmbientSoundKey,
  getSceneMusicUrl,
  getSceneMusicKey,
  getSceneTimerConfig,
} from '../lib/gameEngine';
import { getCinematicPlaybackModel } from '../lib/cinematicEngine';
import { parseJsonValue } from '../lib/enigmaEngine';
import { findAssetById, resolveAssetUrl } from '../lib/assetManager';
import { getElementShapeStyle, getLayerZIndex } from './scenes/sceneEditorUtils';
import {
  applySceneObjectTextOverride,
  SceneObjectBlockContent,
  getSceneObjectBlockType,
  getSceneObjectClickMode,
} from './scenes/SceneObjectInspector.jsx';
import { showPrompt } from './AccessibleDialog';
import Anime2DPreview from './Anime2DPreview.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from './SceneVisualEffect';

const makePieceStyle = (imageData, rows, cols, pieceIndex, rotation = 0) => {
  const row = Math.floor(pieceIndex / cols);
  const col = pieceIndex % cols;
  return {
    backgroundImage: `url(${imageData})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(cols === 1 ? 0 : (col / (cols - 1)) * 100)}% ${(rows === 1 ? 0 : (row / (rows - 1)) * 100)}%`,
    transform: `rotate(${rotation}deg)`,
  };
};

const resolveAnime2dLayerSrc = (project, layer) => {
  const rawSrc = layer?.src || layer?.imageData || layer?.layer?.src || layer?.layer?.imageData || '';
  const sourceProject = project || {};
  const assetId = layer?.assetId || layer?.imageId || layer?.srcId || (findAssetById(sourceProject, rawSrc) ? rawSrc : '');
  return resolveAssetUrl(sourceProject, assetId, rawSrc);
};

const getCombatEntryValue = (entry, key, fallback) => (
  entry?.[key] === undefined || entry?.[key] === '' || entry?.[key] === null ? fallback : entry[key]
);

const HERO_POWER_TYPE_LABELS = {
  water: 'Eau',
  earth: 'Terre',
  fire: 'Feu',
  lightning: 'Foudre',
};

const HERO_RESISTANCE_SUMMARY_FIELDS = [
  { id: 'water', label: 'Eau', field: 'resistanceWater' },
  { id: 'earth', label: 'Terre', field: 'resistanceEarth' },
  { id: 'fire', label: 'Feu', field: 'resistanceFire' },
  { id: 'lightning', label: 'Foudre', field: 'resistanceLightning' },
];

const normalizeHeroStatKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getHeroForceSkill = (skills = []) => (
  skills.find((skill) => (
    normalizeHeroStatKey(skill.id) === 'force'
    || normalizeHeroStatKey(skill.name) === 'force'
  )) || skills[0] || null
);

const getCombatActorMedia = (entry, combat, actor, fallbackImage = '') => {
  const entryPrefix = actor === 'hero' ? 'combatHero' : 'combatEnemy';
  const globalPrefix = actor;
  const mediaType = getCombatEntryValue(entry, `${entryPrefix}MediaType`, combat?.[`${globalPrefix}MediaType`] || 'image');
  return {
    mediaType: mediaType === 'anime2d' ? 'anime2d' : 'image',
    imageData: entry?.[`${entryPrefix}ImageData`] || combat?.[`${globalPrefix}ImageData`] || fallbackImage || '',
    anime2dSpec: entry?.[`${entryPrefix}Anime2dSpec`] || combat?.[`${globalPrefix}Anime2dSpec`] || null,
  };
};

function Anime2DCinematicPlayer({ cinematic, spec, project, onEnd }) {
  const previewModel = useMemo(() => createAnime2dPreviewModel(spec || cinematic?.anime2dSpec), [cinematic?.anime2dSpec, spec]);
  const { layers, duration } = previewModel;
  const layerZIndexes = useMemo(() => new Map(layers.map((layer, index) => [layer.id, layers.length - index + 2])), [layers]);
  const [time, setTime] = useState(0);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    setTime(0);
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextTime = (performance.now() - startedAt) / 1000;
      if (nextTime >= duration) {
        window.clearInterval(timer);
        setTime(duration);
        onEndRef.current?.();
      } else {
        setTime(nextTime);
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [duration]);

  const { visibleLayers, narration: frameNarration } = useMemo(() => createAnime2dPreviewFrame(previewModel, time), [previewModel, time]);
  const fallbackNarration = cinematic?.slides?.find((slide) => String(slide?.narration || '').trim())?.narration || '';
  const narration = frameNarration || fallbackNarration;

  return (
    <>
      <div className="anime2d-player">
        {!layers.some((layer) => resolveAnime2dLayerSrc(project, layer)) ? (
          <p className="anime2d-player-empty">Aucune image embarquee dans ce JSON 2D Anime.</p>
        ) : null}
        {visibleLayers.map((layer) => {
          const layerSrc = resolveAnime2dLayerSrc(project, layer);
          return (
            <div
              key={layer.id}
              className="anime2d-player-layer"
              style={{
                left: `${layer.x || 50}%`,
                top: `${layer.y || 50}%`,
                width: `${layer.width || 28}%`,
                height: `${layer.height || ((layer.width || 28) * 1.6)}%`,
                opacity: Number(layer.opacity || 100) / 100,
                zIndex: layerZIndexes.get(layer.id) || 2,
              }}
            >
              <span
                className={`anime2d-embedded-animated anime2d-preset-${layer.preset || 'none'}`}
                style={{
                  animationDuration: `${layer.duration || 1000}ms`,
                  animationDelay: `${layer.delay || 0}ms`,
                  animationIterationCount: layer.loop === false ? 1 : 'infinite',
                }}
              >
                {layerSrc ? <img src={layerSrc} alt={layer.name || ''} /> : null}
              </span>
            </div>
          );
        })}
        {narration ? <p className="anime2d-player-narration">{narration}</p> : null}
      </div>
      <p className="small-note">{Math.min(duration, time).toFixed(1)}s / {duration.toFixed(1)}s</p>
    </>
  );
}

const preloadImage = (url) => new Promise((resolve) => {
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => resolve();
  image.onerror = () => resolve();
  image.src = url;
  if (image.decode) image.decode().then(resolve).catch(resolve);
});

const preloadMediaElement = (url, tagName = 'audio') => new Promise((resolve) => {
  const node = document.createElement(tagName);
  let isDone = false;
  const done = () => {
    if (isDone) return;
    isDone = true;
    node.oncanplaythrough = null;
    node.onloadeddata = null;
    node.onerror = null;
    node.removeAttribute('src');
    node.load();
    resolve();
  };
  const timeoutId = window.setTimeout(done, 8000);
  const finish = () => {
    window.clearTimeout(timeoutId);
    done();
  };
  node.preload = 'auto';
  node.oncanplaythrough = finish;
  node.onloadeddata = finish;
  node.onerror = finish;
  node.src = url;
  node.load();
});

export default function PreviewTab(props) {
  const {
    playScene,
    viewerImage,
    setViewerImage,
    playingCinematic,
    playingSlideIndex,
    currentSlide,
    setPlayingCinematic,
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
    attackActiveHeroCombat,
    rollActiveEnemyCombat,
    closeHeroCombat,
    equippedHeroItemIds = [],
    equippedHeroSlotMap = {},
    lastChoiceSnapshot = null,
    adjustHeroStat,
    lastDiceRoll,
    rollHeroDie,
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
  const [heroPanelRollingSkillId, setHeroPanelRollingSkillId] = useState(null);
  const [heroPanelDieFace, setHeroPanelDieFace] = useState(1);
  const [heroRewardNotice, setHeroRewardNotice] = useState(null);
  const [selectedHeroCombatPowerId, setSelectedHeroCombatPowerId] = useState('');
  const heroSetupRollTimerRef = useRef(null);
  const heroSetupRollIntervalRef = useRef(null);
  const heroSetupDiceFacesRef = useRef([]);
  const heroPanelRollIntervalRef = useRef(null);
  const heroPanelDieFaceRef = useRef(1);
  const heroRewardNoticeTimerRef = useRef(null);
  const draggedInventoryIdRef = useRef(null);
  const sceneAspectRatio = Number(loadedSceneAspectRatio || playScene?.backgroundAspectRatio) > 0 ?
     Number(loadedSceneAspectRatio || playScene.backgroundAspectRatio)
    : 1.6;
  const cinematicPlayback = useMemo(
    () => (playingCinematic ? getCinematicPlaybackModel(playingCinematic, playingSlideIndex || 0) : null),
    [playingCinematic, playingSlideIndex],
  );
  const playSceneBackgroundUrl = getSceneBackgroundUrl(project, playScene);
  const playSceneMusicUrl = getSceneMusicUrl(project, playScene);
  const playSceneAmbientSoundUrl = getSceneAmbientSoundUrl(project, playScene);
  const transitionPreviousBackgroundUrl = getSceneBackgroundUrl(project, sceneTransitionOverlay?.previousScene);
  const isHeroAdventure = Boolean(heroAdventure?.enabled && heroState);
  const isChoiceAdventure = !isHeroAdventure && ['adventure', 'adventure_choices'].includes(project?.creationMode);
  const usesImmersiveAdventurePlayer = isHeroAdventure || isChoiceAdventure;
  const isHeroSetupOpen = Boolean(isHeroAdventure && !heroSetupComplete);
  const isHeroDefeated = Boolean(isHeroAdventure && Number(heroState?.health || 0) <= 0);
  const isCustomHeroDefeatScene = Boolean(isHeroDefeated && heroAdventure?.hero.defeatSceneId && playScene?.id === heroAdventure.hero.defeatSceneId);
  const heroDiceSkin = heroAdventure?.dice?.skin || 'classic';
  const heroSetupBackgroundImageData = heroAdventure?.hero.setupBackgroundImageData || heroState?.setupBackgroundImageData || '';
  const heroSetupMusicData = heroAdventure?.hero.setupMusicData || heroState?.setupMusicData || '';
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

  useEffect(() => {
    if (!isHeroAdventure || !heroCharacterPreviewRequestKey) return;
    setIsInventoryOpen(true);
    setIsHeroPanelOpen(false);
  }, [heroCharacterPreviewRequestKey, isHeroAdventure]);

  useEffect(() => {
    if (!isHeroAdventure) setIsHeroPanelOpen(false);
  }, [isHeroAdventure]);

  useEffect(() => {
    if (!activeHeroCombat || activeHeroCombat.phase !== 'hero' || activeHeroCombat.status !== 'active') {
      setSelectedHeroCombatPowerId('');
    }
  }, [activeHeroCombat?.id, activeHeroCombat?.phase, activeHeroCombat?.round, activeHeroCombat?.status]);

  useEffect(() => () => {
    if (heroSetupRollTimerRef.current) window.clearTimeout(heroSetupRollTimerRef.current);
    if (heroSetupRollIntervalRef.current) window.clearInterval(heroSetupRollIntervalRef.current);
    if (heroPanelRollIntervalRef.current) window.clearInterval(heroPanelRollIntervalRef.current);
    if (heroRewardNoticeTimerRef.current) window.clearTimeout(heroRewardNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    draggedInventoryIdRef.current = draggedInventoryId || null;
  }, [draggedInventoryId]);

  useEffect(() => {
    if (!isHeroSetupOpen) return;
    setHeroSetupResultsRevealed(false);
    setHeroSetupFinalRolls([]);
    setHeroSetupDiceFaces([]);
    heroSetupDiceFacesRef.current = [];
    setHeroSetupRollingIndex(-1);
    setIsHeroSetupRolling(false);
  }, [isHeroSetupOpen]);

  useEffect(() => {
    onSceneTimerEndRef.current = onSceneTimerEnd;
  }, [onSceneTimerEnd]);

  useEffect(() => {
    setLoadedSceneAspectRatio(0);
  }, [playScene?.id, playSceneBackgroundUrl]);

  useLayoutEffect(() => {
    const nextActId = playScene?.actId || '';
    if (!playScene?.id || loadedActIdRef.current === nextActId) return undefined;

    let isCancelled = false;
    const act = (project.acts || []).find((entry) => entry.id === nextActId);
    const label = act?.name || playScene.name || 'Acte suivant';
    const media = collectActMediaUrls(project, nextActId);
    const tasks = [
      ...media.imageUrls.map((url) => () => preloadImage(url)),
      ...media.audioUrls.map((url) => () => preloadMediaElement(url, 'audio')),
      ...media.videoUrls.map((url) => () => preloadMediaElement(url, 'video')),
    ];

    loadedActIdRef.current = nextActId;

    if (!tasks.length) {
      setActPreloadStatus({ isLoading: false, progress: 100, label });
      return undefined;
    }

    let completed = 0;
    setActPreloadStatus({ isLoading: true, progress: 0, label });

    Promise.all(tasks.map((runTask) => (
      runTask().catch(() => {}).then(() => {
        completed += 1;
        if (!isCancelled) {
          setActPreloadStatus({
            isLoading: completed < tasks.length,
            progress: Math.round((completed / tasks.length) * 100),
            label,
          });
        }
      })
    ))).then(() => {
      if (!isCancelled) setActPreloadStatus({ isLoading: false, progress: 100, label });
    });

    return () => {
      isCancelled = true;
    };
  }, [playScene?.id, playScene?.actId, playScene?.name, project]);

  useEffect(() => {
    mediaPreloadRef.current.audios.forEach((audio) => {
      audio.removeAttribute('src');
      audio.load();
    });

    if (!playScene) {
      mediaPreloadRef.current = { images: [], audios: [] };
      return undefined;
    }

    const { imageUrls, audioUrls } = collectNearbySceneMediaUrls(project, playScene);

    const images = imageUrls.slice(0, 16).map((url) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      return image;
    });

    const audios = audioUrls.slice(0, 5).map((url) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.load();
      return audio;
    });

    mediaPreloadRef.current = { images, audios };

    return () => {
      audios.forEach((audio) => {
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [playScene, project.scenes]);

  useEffect(() => {
    if (sceneTimerIntervalRef.current) {
      window.clearInterval(sceneTimerIntervalRef.current);
      sceneTimerIntervalRef.current = null;
    }

    const timerConfig = getSceneTimerConfig(playScene);
    if (actPreloadStatus.isLoading || !timerConfig.isEnabled) {
      setSceneTimerRemaining(0);
      expiredSceneTimerKeyRef.current = '';
      return undefined;
    }

    const timerKey = timerConfig.key;
    expiredSceneTimerKeyRef.current = '';
    setSceneTimerRemaining(timerConfig.seconds);

    sceneTimerIntervalRef.current = window.setInterval(() => {
      setSceneTimerRemaining((remaining) => {
        if (remaining <= 1) {
          if (sceneTimerIntervalRef.current) {
            window.clearInterval(sceneTimerIntervalRef.current);
            sceneTimerIntervalRef.current = null;
          }
          if (expiredSceneTimerKeyRef.current !== timerKey) {
            expiredSceneTimerKeyRef.current = timerKey;
            window.setTimeout(() => onSceneTimerEndRef.current?.(playScene), 0);
          }
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);

    return () => {
      if (sceneTimerIntervalRef.current) {
        window.clearInterval(sceneTimerIntervalRef.current);
        sceneTimerIntervalRef.current = null;
      }
    };
  }, [
    playScene?.id,
    playScene?.timerEnabled,
    playScene?.timerSeconds,
    playScene?.timerEndAction,
    playScene?.timerTargetSceneId,
    playScene?.timerTargetCinematicId,
    sceneTimerResetKey,
    actPreloadStatus.isLoading,
  ]);

  useEffect(() => {
    const previousScene = previousSceneRef.current;
    if (!playScene?.id || !previousScene?.id || previousScene.id === playScene.id) {
      previousSceneRef.current = playScene;
      return undefined;
    }

    const overlay = createSceneTransitionOverlay(previousScene, playScene);
    if (overlay) {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      setSceneTransitionOverlay(overlay);
      transitionTimerRef.current = window.setTimeout(() => {
        setSceneTransitionOverlay(null);
        transitionTimerRef.current = null;
      }, overlay.duration + 80);
    }

    previousSceneRef.current = playScene;

    return undefined;
  }, [playScene]);

  useEffect(() => {
    setIsNarrationCollapsed(false);
  }, [dialogue]);

  useEffect(() => {
    if (!debugInventoryItemId || !(project.items || []).some((item) => item.id === debugInventoryItemId)) {
      setDebugInventoryItemId(project.items?.[0]?.id || '');
    }
  }, [debugInventoryItemId, project.items]);

  const addDebugInventoryItem = () => {
    if (!debugInventoryItemId) return;
    const item = project.items.find((entry) => entry.id === debugInventoryItemId);
    if (!item) return;
    if (addInventoryItem) addInventoryItem(debugInventoryItemId);
    else {
      setInventory?.((prev) => (prev.includes(debugInventoryItemId) ? prev : [...prev, debugInventoryItemId]));
      setSelectedInventoryIds?.((prev) => (
        prev.includes(debugInventoryItemId) ? prev : [...prev, debugInventoryItemId].slice(-2)
      ));
    }
    setDialogue?.(`${item.name || 'Objet'} ajouté à l’inventaire de test.`);
  };

  const removeDebugInventoryItem = () => {
    if (!debugInventoryItemId) return;
    const item = project.items.find((entry) => entry.id === debugInventoryItemId);
    if (removeInventoryItem) removeInventoryItem(debugInventoryItemId);
    else {
      setInventory?.((prev) => prev.filter((itemId) => itemId !== debugInventoryItemId));
      setSelectedInventoryIds?.((prev) => prev.filter((itemId) => itemId !== debugInventoryItemId));
    }
    if (viewerImage?.id === debugInventoryItemId) setViewerImage?.(null);
    setDialogue?.(`${item?.name || 'Objet'} retiré de l’inventaire de test.`);
  };

  useEffect(() => {
    const nextMusicKey = getSceneMusicKey(playScene) || playSceneMusicUrl;
    const nextAmbientKey = getSceneAmbientSoundKey(playScene) || playSceneAmbientSoundUrl;

    if (isHeroSetupOpen) {
      if (sceneAudioRef.current) {
        sceneAudioRef.current.pause();
        sceneAudioRef.current.currentTime = 0;
        sceneAudioRef.current = null;
      }
      sceneAudioSourceRef.current = '';
      return undefined;
    }

    if (actPreloadStatus.isLoading) {
      const isSameTrack = Boolean(
        sceneAudioRef.current
        && nextMusicKey
        && sceneAudioSourceRef.current === nextMusicKey,
      );

      if (!isSameTrack && sceneAudioRef.current) {
        sceneAudioRef.current.pause();
        sceneAudioRef.current.currentTime = 0;
        sceneAudioRef.current = null;
        sceneAudioSourceRef.current = '';
      }
      const isSameAmbient = Boolean(
        ambientAudioRef.current
        && nextAmbientKey
        && ambientAudioSourceRef.current === nextAmbientKey,
      );
      if (!isSameAmbient && ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
        ambientAudioRef.current = null;
        ambientAudioSourceRef.current = '';
      }
      return undefined;
    }

    const nextMusicData = playSceneMusicUrl;
    const nextLoop = playScene?.musicLoop !== false;
    const nextVolume = typeof playScene?.musicVolume === 'number' ? playScene.musicVolume : 0.5;

    if (!nextMusicData) {
      if (sceneAudioRef.current) {
        sceneAudioRef.current.pause();
        sceneAudioRef.current.currentTime = 0;
        sceneAudioRef.current = null;
      }
      sceneAudioSourceRef.current = '';
      return undefined;
    }

    if (sceneAudioRef.current && sceneAudioSourceRef.current === nextMusicKey) {
      sceneAudioRef.current.loop = nextLoop;
      sceneAudioRef.current.volume = nextVolume;
      sceneAudioRef.current.play().catch(() => {});
      return undefined;
    }

    if (sceneAudioRef.current) {
      sceneAudioRef.current.pause();
      sceneAudioRef.current.currentTime = 0;
      sceneAudioRef.current = null;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = nextMusicData;
    audio.loop = nextLoop;
    audio.volume = nextVolume;
    audio.play().catch(() => {});
    sceneAudioRef.current = audio;
    sceneAudioSourceRef.current = nextMusicKey;

    return undefined;
  }, [playSceneMusicUrl, playScene?.musicLoop, playScene?.musicVolume, actPreloadStatus.isLoading, isHeroSetupOpen]);

  useEffect(() => {
    const nextAmbientKey = getSceneAmbientSoundKey(playScene) || playSceneAmbientSoundUrl;

    if (isHeroSetupOpen) {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
        ambientAudioRef.current = null;
      }
      ambientAudioSourceRef.current = '';
      return undefined;
    }

    if (actPreloadStatus.isLoading) return undefined;

    const nextSoundData = playSceneAmbientSoundUrl;
    const nextLoop = Boolean(playScene?.ambientSoundLoop);
    const nextVolume = typeof playScene?.ambientSoundVolume === 'number' ? playScene.ambientSoundVolume : 0.75;

    if (!nextSoundData) {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
        ambientAudioRef.current = null;
      }
      ambientAudioSourceRef.current = '';
      return undefined;
    }

    if (ambientAudioRef.current && ambientAudioSourceRef.current === nextAmbientKey) {
      ambientAudioRef.current.loop = nextLoop;
      ambientAudioRef.current.volume = nextVolume;
      ambientAudioRef.current.play().catch(() => {});
      return undefined;
    }

    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
      ambientAudioRef.current = null;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = nextSoundData;
    audio.loop = nextLoop;
    audio.volume = nextVolume;
    audio.play().catch(() => {});
    ambientAudioRef.current = audio;
    ambientAudioSourceRef.current = nextAmbientKey;

    return undefined;
  }, [playSceneAmbientSoundUrl, playScene?.ambientSoundLoop, playScene?.ambientSoundVolume, actPreloadStatus.isLoading, isHeroSetupOpen]);

  useEffect(() => {
    if (!isHeroSetupOpen || !heroSetupMusicData) {
      if (heroIntroAudioRef.current) {
        heroIntroAudioRef.current.pause();
        heroIntroAudioRef.current.currentTime = 0;
        heroIntroAudioRef.current = null;
      }
      heroIntroAudioSourceRef.current = '';
      return undefined;
    }

    if (heroIntroAudioRef.current && heroIntroAudioSourceRef.current === heroSetupMusicData) {
      heroIntroAudioRef.current.loop = true;
      heroIntroAudioRef.current.volume = 0.55;
      heroIntroAudioRef.current.play().catch(() => {});
      return undefined;
    }

    if (heroIntroAudioRef.current) {
      heroIntroAudioRef.current.pause();
      heroIntroAudioRef.current.currentTime = 0;
      heroIntroAudioRef.current = null;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = heroSetupMusicData;
    audio.loop = true;
    audio.volume = 0.55;
    audio.play().catch(() => {});
    heroIntroAudioRef.current = audio;
    heroIntroAudioSourceRef.current = heroSetupMusicData;

    return undefined;
  }, [isHeroSetupOpen, heroSetupMusicData]);

  useEffect(() => () => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (sceneTimerIntervalRef.current) {
      window.clearInterval(sceneTimerIntervalRef.current);
      sceneTimerIntervalRef.current = null;
    }
    if (hotspotAudioRef.current) {
      hotspotAudioRef.current.pause();
      hotspotAudioRef.current.currentTime = 0;
      hotspotAudioRef.current = null;
    }
    if (sceneAudioRef.current) {
      sceneAudioRef.current.pause();
      sceneAudioRef.current.currentTime = 0;
      sceneAudioRef.current = null;
      sceneAudioSourceRef.current = '';
    }
    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
      ambientAudioRef.current = null;
      ambientAudioSourceRef.current = '';
    }
    if (heroIntroAudioRef.current) {
      heroIntroAudioRef.current.pause();
      heroIntroAudioRef.current.currentTime = 0;
      heroIntroAudioRef.current = null;
      heroIntroAudioSourceRef.current = '';
    }
  }, []);

  const toggleFullscreen = async () => {
    const node = playerShellRef.current;
    if (!node) return;

    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((value) => !value);
    }
  };

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsPauseOpen((value) => !value);
        if (!isFullscreen && !sharedPlayerMode) revealControls();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, sharedPlayerMode]);

  const revealControls = () => {
    setAreControlsVisible(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    if (isFullscreen || sharedPlayerMode) {
      controlsTimerRef.current = window.setTimeout(() => {
        setAreControlsVisible(false);
      }, 3000);
    }
  };

  const handleShellMouseMove = (event) => {
    if (isFullscreen || sharedPlayerMode) {
      if (event.clientY <= 8) setAreControlsVisible(true);
      else if (event.clientY > 96) setAreControlsVisible(false);
      return;
    }

    revealControls();
  };

  useEffect(() => {
    if (sharedPlayerMode) {
      setAreControlsVisible(false);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      return undefined;
    }

    if (!isFullscreen && !sharedPlayerMode) {
      setAreControlsVisible(true);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      return undefined;
    }

    setAreControlsVisible(false);

    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  }, [isFullscreen, sharedPlayerMode]);

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
    const popupSrc = obj.popupImageData || obj.popupImage || obj.imageData || linkedItem?.imageData || '';

    if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
      if (addInventoryItem) addInventoryItem(obj.linkedItemId);
      else {
        setInventory?.((prev) => (prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId]));
        setSelectedInventoryIds?.((prev) => (
          prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId].slice(-2)
        ));
      }
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
  const conversationReplies = (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((spot) => spot.actionType === 'conversation')
      .flatMap((spot) => (spot.conversation?.nodes || []).flatMap((node) => node.replies || []))
  ));
  const endingReplies = conversationReplies.filter((reply) => reply.actionType === 'ending');
  const hiddenReplies = conversationReplies.filter((reply) => (reply.conditionType || 'none') !== 'none');
  const getItemById = (itemId) => project.items.find((entry) => entry.id === itemId);
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
      imageData: item.imageData || '',
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
  const heroEquipmentSlotCount = Math.max(1, Math.min(8, Number(heroAdventure?.hero.equipmentSlotCount || 6)));
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
    heroAdventure?.hero.equipmentSlotLabels?.[index] || label
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
      setDialogue?.("Aucun equipement disponible dans l'inventaire.");
      return;
    }
    equipHeroItem?.(itemId, slotIndex);
  };
  const conversationNode = activeConversation?.conversation?.nodes?.find((node) => node.id === activeConversation.nodeId) || null;
  const visibleConversationReplies = conversationNode
    ? (conversationNode.replies || []).filter((reply) => isConversationReplyAvailable?.(reply) !== false)
    : [];
  const lockedConversationReplies = isChoiceAdventure && conversationNode
    ? (conversationNode.replies || []).filter((reply) => {
      const isConsumed = reply.id && (
        hiddenConversationReplyIds.includes(reply.id)
        || (reply.hideAfterChosen && chosenConversationReplyIds.includes(reply.id))
      );
      return isConversationReplyAvailable?.(reply) === false && reply.showWhenLocked && !isConsumed;
    })
    : [];
  const displayedConversationReplies = [...visibleConversationReplies, ...lockedConversationReplies];
  const renderChoiceEffectSummary = (compact = false) => {
    if (!choiceEffectNotices.length) return null;
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
          {choiceEffectNotices.map((notice, index) => (
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
    <div className={`adventure-journal-card ${compact ? 'compact' : ''}`}>
      <div className="panel-head">
        <h3>Journal joueur</h3>
      </div>
      <div className="adventure-journal-grid">
        <section>
          <strong>Historique</strong>
          <div className="adventure-journal-list">
            {adventureJournalEntries.length ? adventureJournalEntries.slice(0, compact ? 4 : 8).map((entry) => (
              <span key={entry.id || `${entry.type}-${entry.title}`}>
                <strong>{entry.title || 'Note'}</strong>
                {entry.detail ? <small>{entry.detail}</small> : null}
              </span>
            )) : <span>Aucun choix important note.</span>}
          </div>
        </section>
        <section>
          <strong>Indices et état</strong>
          <div className="adventure-state-list">
            {inventory.length ? inventory.slice(0, compact ? 4 : 8).map((itemId) => (
              <span key={itemId}>{getJournalItemLabel(itemId)}</span>
            )) : <span>Aucun indice obtenu.</span>}
            {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.map(([key, value]) => (
              <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
            )) : null}
            {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
          </div>
        </section>
      </div>
    </div>
  );
  const renderAdventureStateCard = (compact = false) => (
    <div className={`adventure-state-card ${compact ? 'compact' : ''}`}>
      <div className="panel-head">
        <h3>Progression</h3>
      </div>
      <div className="adventure-state-grid">
        <span><strong>{chosenConversationReplyIds.length}</strong> choix</span>
        <span><strong>{hiddenReplies.length}</strong> cachés</span>
        <span><strong>{visibleStoryVariableEntries.length}</strong> variables</span>
        <span><strong>{endingReplies.length}</strong> fins</span>
      </div>
      <div className="adventure-state-list">
        {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.slice(0, compact ? 6 : undefined).map(([key, value]) => (
          <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
        )) : <span>Aucune variable d'histoire modifiée.</span>}
        {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
      </div>
    </div>
  );
  const renderAdventureInventoryContent = (compact = false) => (
    <>
      <div className="player-adventure-drawer-grid">
        {!sharedPlayerMode ? renderAdventureStateCard(compact) : null}
        {!sharedPlayerMode ? renderAdventureJournal(compact) : null}
      </div>
      {!sharedPlayerMode ? (
        <div className="inventory-test-tools">
          <span className="small-note">Test inventaire</span>
          <select value={debugInventoryItemId} onChange={(event) => setDebugInventoryItemId(event.target.value)}>
            {(project.items || []).map((item) => (
              <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
            ))}
          </select>
          <div className="inline-actions">
            <button type="button" className="secondary-action" disabled={!debugInventoryItemId} onClick={addDebugInventoryItem}>
              Ajouter
            </button>
            <button type="button" className="danger-button" disabled={!debugInventoryItemId || !inventory.includes(debugInventoryItemId)} onClick={removeDebugInventoryItem}>
              Retirer
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="secondary-action player-combine-button"
        onClick={() => {
          if (selectedInventoryIds.length !== 2) {
            setDialogue('Sélectionne 2 objets a combiner.');
            return;
          }
          combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
        }}
      >
        Combiner les 2 objets
      </button>
      <div className="inventory-grid">
        {inventory.length ? inventory.map((itemId) => {
          const item = project.items.find((entry) => entry.id === itemId);
          if (!item) return null;
          return (
            <button
              key={itemId}
              type="button"
              className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
              draggable
              onClick={() => openInventoryItem(itemId)}
              onDragStart={() => setDraggedInventoryId(itemId)}
              onDragEnd={() => setDraggedInventoryId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedInventoryId && draggedInventoryId !== itemId) {
                  combineInventoryItems(draggedInventoryId, itemId);
                }
                setDraggedInventoryId(null);
              }}
            >
              <div className="inventory-thumb">
                {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || 'Objet'}</span>}
              </div>
              <strong>{item.name}</strong>
            </button>
          );
        }) : <p>Aucun objet.</p>}
      </div>
      <p className="small-note">Cliquer = voir l'image. Glisser-deposer un objet sur un autre = tenter une combinaison.</p>
    </>
  );
  const rows = Number(enigma?.gridRows) || 3;
  const cols = Number(enigma?.gridCols) || 3;
  const pieceCount = rows * cols;
  const codeSkin = enigma?.codeSkin || 'safe-wheels';
  const codeLength = Math.max(4, String(enigma?.solutionText || '').length || 4);
  const codeSlots = Array.from({ length: Math.min(codeLength, 8) }, (_, index) => enigmaCodeInput[index] || '');
  const miscMode = enigma?.miscMode || 'free-answer';
  const miscOrderingSelection = miscMode === 'ordering' ? parseJsonValue(enigmaCodeInput, []) : [];
  const miscMatchingAnswers = miscMode === 'matching' ? parseJsonValue(enigmaCodeInput, {}) : {};
  const miscMultiSelection = miscMode === 'multi-select' ? parseJsonValue(enigmaCodeInput, []) : [];
  const enigmaOverlayStyle = enigma?.popupBackgroundData ? {
    backgroundImage: `${POPUP_OVERLAY_GRADIENTS[enigma.popupBackgroundOverlay || 'dark'] || POPUP_OVERLAY_GRADIENTS.dark}, url(${enigma.popupBackgroundData})`,
    backgroundSize: `${Math.round((Number(enigma.popupBackgroundZoom) || 1) * 100)}%`,
    backgroundPosition: `${Number(enigma.popupBackgroundX) || 50}% ${Number(enigma.popupBackgroundY) || 50}%`,
    backgroundRepeat: 'no-repeat',
  } : undefined;
  const toggleMiscSelection = (choice) => {
    const next = miscMultiSelection.includes(choice) ?
       miscMultiSelection.filter((entry) => entry !== choice)
      : [...miscMultiSelection, choice];
    setEnigmaCodeInput(JSON.stringify(next));
  };
  const setCodeCharAt = (index, value) => {
    const chars = codeSlots.slice();
    chars[index] = value.slice(-1).toUpperCase();
    setEnigmaCodeInput(chars.join('').trimEnd());
  };
  const pressCodeKey = (key) => {
    if (key === '⌫' || key === '←') {
      setEnigmaCodeInput((enigmaCodeInput || '').slice(0, -1));
      return;
    }
    setEnigmaCodeInput(`${enigmaCodeInput || ''}${key}`.slice(0, codeSlots.length));
  };

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

  const renderHeroAdventurePanel = (compact = false) => {
    if (!isHeroAdventure) return null;
    const healthMax = Number(heroState.maxHealth) || 1;
    const manaMax = Number(heroState.maxMana) || 1;
    const healthPercent = Math.max(0, Math.min(100, (Number(heroState.health || 0) / healthMax) * 100));
    const manaPercent = Math.max(0, Math.min(100, (Number(heroState.mana || 0) / manaMax) * 100));

    return (
      <div className={`hero-adventure-panel ${compact ? 'hero-adventure-panel--compact' : ''}`} data-tour="hero-adventure-panel">
        <div className="hero-adventure-head">
          <div>
            <span className="eyebrow">Hero Adventure</span>
            <strong>{heroState.name || 'Héros'}</strong>
          </div>
          <button
            type="button"
            className="secondary-action hero-dice-button"
            onClick={() => toggleHeroPanelRoll('')}
            disabled={isHeroDefeated}
          >
            {heroPanelRollingSkillId !== null ? 'Arreter le dé' : `Lancer ${heroAdventure.dice?.label || 'de'}`}
          </button>
        </div>

        <div className="hero-stat-grid">
          <div className="hero-meter">
            <span>PV</span>
            <strong>{heroState.health}/{healthMax}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="hero-meter hero-meter--mana">
            <span>Mana</span>
            <strong>{heroState.mana}/{manaMax}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>

        <div className="hero-stat-actions">
          <button type="button" onClick={() => adjustHeroStat?.('health', -1)}>- PV</button>
          <button type="button" onClick={() => adjustHeroStat?.('health', 1)}>+ PV</button>
          <button type="button" onClick={() => adjustHeroStat?.('mana', -1)}>- Mana</button>
          <button type="button" onClick={() => adjustHeroStat?.('mana', 1)}>+ Mana</button>
        </div>

        {isHeroDefeated ? <p className="hero-defeat-note">0 PV: actions joueur bloquées.</p> : null}

        <div className="hero-skill-list">
          {(heroState.skills || []).map((skill) => (
            <button
              key={skill.id}
              type="button"
              className="hero-skill-button"
              onClick={() => startHeroPanelRoll(skill.id)}
              disabled={isHeroDefeated || heroPanelRollingSkillId !== null || (skill.manaCost > 0 && Number(heroState.mana || 0) < skill.manaCost)}
            >
              <span>{skill.name}</span>
              <strong>+{skill.value}</strong>
              {skill.manaCost ? <small>{skill.manaCost} mana</small> : null}
            </button>
          ))}
        </div>

        {(lastDiceRoll || heroPanelRollingSkillId !== null) ? (
          <div className={`hero-roll-result ${heroPanelRollingSkillId !== null ? 'is-rolling' : ''}`}>
            <span>
              {heroPanelRollingSkillId !== null
                ? (heroState.skills || []).find((skill) => skill.id === heroPanelRollingSkillId)?.name || 'Jet libre'
                : lastDiceRoll.skillName || 'Jet libre'}
              {heroPanelRollingSkillId === null && typeof lastDiceRoll.success === 'boolean' ? ` - ${lastDiceRoll.success ? 'Réussi' : 'Échec'}` : ''}
            </span>
            <button
              type="button"
              className={`hero-roll-die-button ${heroPanelRollingSkillId !== null ? 'is-rolling' : ''}`}
              onClick={stopHeroPanelRoll}
              disabled={heroPanelRollingSkillId === null}
              aria-label={heroPanelRollingSkillId !== null ? 'Arreter le dé' : 'Résultat du de'}
            >
              <span className={`hero-roll-die hero-die-face hero-die-face--${heroDiceSkin}`}>
                <span className="hero-roll-die-value">{heroPanelRollingSkillId !== null ? heroPanelDieFace : lastDiceRoll.raw}</span>
              </span>
            </button>
            <small>
              {heroPanelRollingSkillId !== null
                ? 'Clique le dé pour l arreter.'
                : `${lastDiceRoll.die}: ${lastDiceRoll.raw}${lastDiceRoll.modifier ? ` + ${lastDiceRoll.modifier}` : ''} => ${lastDiceRoll.total}${lastDiceRoll.difficulty ? ` / difficulté ${lastDiceRoll.difficulty}` : ''}`}
            </small>
          </div>
        ) : null}
      </div>
    );
  };

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

  const renderHeroCombatEffectMedia = (effect) => {
    const media = effect?.media;
    if (!media) return null;
    const audioNode = media.audioData ? (
      <audio src={media.audioData} autoPlay preload="auto" style={{ display: 'none' }} />
    ) : null;
    if (media.mediaType === 'anime2d' && media.anime2dSpec) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--anime">
            <Anime2DPreview spec={media.anime2dSpec} project={project} />
          </span>
        </>
      );
    }
    if (media.mediaType === 'video' && media.videoData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--video">
            <video src={media.videoData} autoPlay muted playsInline />
          </span>
        </>
      );
    }
    if (media.mediaType === 'image' && media.imageData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--image">
            <img src={media.imageData} alt="" />
          </span>
        </>
      );
    }
    return audioNode;
  };

  const renderHeroCombatActor = (media, label, side, vitals = {}, visualEffects = []) => {
    const maxHealth = Math.max(1, Number(vitals.maxHealth) || 1);
    const health = Math.max(0, Math.min(maxHealth, Number(vitals.health) || 0));
    const maxMana = Math.max(0, Number(vitals.maxMana) || 0);
    const mana = Math.max(0, Math.min(maxMana, Number(vitals.mana) || 0));
    const healthPercent = (health / maxHealth) * 100;
    const manaPercent = maxMana > 0 ? (mana / maxMana) * 100 : 0;
    const actorEffects = visualEffects.filter((effect) => effect.target === side);

    return (
      <div className={`hero-combat-actor hero-combat-actor--${side} ${media.mediaType === 'anime2d' && media.anime2dSpec ? 'has-anime' : media.imageData ? 'has-image' : 'is-empty'}`}>
        <div className="hero-combat-actor-bars" aria-label={`Jauges ${label}`}>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--health">
            <span>PV</span>
            <strong>{health}/{maxHealth}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--mana">
            <span>Mana</span>
            <strong>{mana}/{maxMana}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
        <div className="hero-combat-actor-media">
          {media.mediaType === 'anime2d' && media.anime2dSpec ? (
            <Anime2DPreview spec={media.anime2dSpec} project={project} />
          ) : media.imageData ? (
            <img src={media.imageData} alt={label} />
          ) : (
            <span>{label.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        {actorEffects.length ? (
          <div className="hero-combat-actor-fx" aria-live="polite">
            {actorEffects.map((effect, index) => (
              <span
                key={effect.id}
                className={`hero-combat-fx hero-combat-fx--${effect.type || 'damage'} ${effect.media ? 'hero-combat-fx--has-media' : ''}`}
                style={{ '--fx-delay': `${index * 90}ms`, '--fx-offset': `${index * 12}px` }}
              >
                {renderHeroCombatEffectMedia(effect)}
                <span className="hero-combat-fx-text">{effect.text}</span>
              </span>
            ))}
          </div>
        ) : null}
        <strong>{label}</strong>
      </div>
    );
  };

  const renderHeroCombatOverlay = () => {
    if (!activeHeroCombat || !isHeroAdventure) return null;
    const entry = activeHeroCombat.entry || {};
    const combatSettings = heroAdventure.combat || {};
    const backgroundImageData = entry.combatBackgroundImageData || combatSettings.backgroundImageData || playSceneBackgroundUrl || '';
    const heroMedia = getCombatActorMedia(entry, combatSettings, 'hero', heroState?.characterImageData || '');
    const enemyMedia = getCombatActorMedia(entry, combatSettings, 'enemy');
    const heroLabel = heroState?.name || 'Héros';
    const enemyLabel = activeHeroCombat.enemyName || entry.combatEnemyName || combatSettings.enemyName || 'Ennemi';
    const enemyMaxHealth = Math.max(1, Number(activeHeroCombat.enemyMaxHealth) || Number(entry.combatEnemyMaxHealth) || 1);
    const enemyHealth = Math.max(0, Math.min(enemyMaxHealth, Number(activeHeroCombat.enemyHealth) || 0));
    const enemyMaxMana = Math.max(0, Number(activeHeroCombat.enemyMaxMana) || Number(entry.combatEnemyMaxMana) || Number(combatSettings.enemyMaxMana) || 0);
    const enemyMana = Math.max(0, Math.min(enemyMaxMana, Number(activeHeroCombat.enemyMana) || 0));
    const heroMaxHealth = Math.max(1, Number(heroState?.maxHealth) || 1);
    const heroHealth = Math.max(0, Math.min(heroMaxHealth, Number(heroState?.health) || 0));
    const heroMaxMana = Math.max(0, Number(heroState?.maxMana) || 0);
    const heroMana = Math.max(0, Math.min(heroMaxMana, Number(heroState?.mana) || 0));
    const heroPowers = Array.isArray(heroState?.powers) ? heroState.powers : [];
    const combatManaCost = Math.max(0, Number(entry.combatManaCost) || 0);
    const selectedHeroCombatPower = heroPowers.find((power) => power.id === selectedHeroCombatPowerId) || null;
    const selectedHeroCombatPowerMissing = Boolean(selectedHeroCombatPowerId && !selectedHeroCombatPower);
    const selectedHeroCombatPowerManaCost = selectedHeroCombatPower ? Math.max(0, Number(selectedHeroCombatPower.manaCost) || 0) : 0;
    const selectedHeroCombatManaCost = combatManaCost + selectedHeroCombatPowerManaCost;
    const selectedHeroCombatManaUnavailable = selectedHeroCombatManaCost > heroMana;
    const selectedHeroCombatActionLabel = selectedHeroCombatPower
      ? `Utiliser ${selectedHeroCombatPower.name || 'Pouvoir'}`
      : 'Attaque normale';
    const showDice = getCombatEntryValue(entry, 'combatShowDice', combatSettings.showDice !== false) !== false;
    const lastCombatRoll = activeHeroCombat.lastEnemyRoll
      || activeHeroCombat.lastRoll
      || (['hero_combat', 'enemy_combat'].includes(lastDiceRoll?.actionType) ? lastDiceRoll : null);
    const overlayStyle = backgroundImageData
      ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.18), rgba(2,6,23,.82)), url(${backgroundImageData})` }
      : undefined;
    const isEnded = ['victory', 'defeat'].includes(activeHeroCombat.status);
    const isEnemyTurn = activeHeroCombat.phase === 'enemy';
    const canChooseHeroAction = !isEnded && !isEnemyTurn && !isHeroDefeated;
    const combatActionHandler = isEnemyTurn ? rollActiveEnemyCombat : () => attackActiveHeroCombat?.(selectedHeroCombatPower?.id || '');
    const combatActionDisabled = isEnded
      || isHeroDefeated
      || (isEnemyTurn ? !rollActiveEnemyCombat : !attackActiveHeroCombat)
      || (!isEnemyTurn && (selectedHeroCombatPowerMissing || selectedHeroCombatManaUnavailable));
    const combatVisualEffects = Array.isArray(activeHeroCombat.visualEffects) ? activeHeroCombat.visualEffects : [];

    return (
      <div className={`hero-combat-overlay hero-combat-overlay--${activeHeroCombat.status || 'active'}${isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : ''}`} style={overlayStyle}>
        <div className="hero-combat-topline">
          <span>{isEnemyTurn ? 'Tour ennemi' : `Tour ${activeHeroCombat.round || 1}`}</span>
          <strong>{enemyLabel}</strong>
          <button type="button" className="secondary-action compact" onClick={closeHeroCombat}>
            Fermer
          </button>
        </div>

        <div className="hero-combat-stage">
          {renderHeroCombatActor(heroMedia, heroLabel, 'hero', {
            health: heroHealth,
            maxHealth: heroMaxHealth,
            mana: heroMana,
            maxMana: heroMaxMana,
          }, combatVisualEffects)}

          {showDice ? (
            <div className="hero-combat-dice-spotlight">
              <button
                type="button"
                className="hero-combat-die-button"
                onClick={combatActionHandler}
                disabled={combatActionDisabled}
              >
                <span className={`hero-combat-die hero-die-face hero-die-face--${heroDiceSkin}`}>
                  <span className="hero-roll-die-value">{lastCombatRoll?.raw || '?'}</span>
                </span>
              </button>
              <strong>{lastCombatRoll ? `${lastCombatRoll.total} total` : heroAdventure.dice?.label || 'Dé'}</strong>
              <small>{isEnded ? 'Combat terminé' : isEnemyTurn ? 'Lance le dé ennemi' : selectedHeroCombatActionLabel}</small>
            </div>
          ) : null}

          {renderHeroCombatActor(enemyMedia, enemyLabel, 'enemy', {
            health: enemyHealth,
            maxHealth: enemyMaxHealth,
            mana: enemyMana,
            maxMana: enemyMaxMana,
          }, combatVisualEffects)}
        </div>

        <div className="hero-combat-hud">
          <div className="hero-combat-meter">
            <span>{heroLabel}</span>
            <strong>{heroHealth}/{heroMaxHealth} PV</strong>
            <i style={{ width: `${(heroHealth / heroMaxHealth) * 100}%` }} />
          </div>
          {heroMaxMana > 0 ? (
            <div className="hero-combat-meter hero-combat-meter--hero-mana">
              <span>Mana héros</span>
              <strong>{heroMana}/{heroMaxMana}</strong>
              <i style={{ width: `${(heroMana / heroMaxMana) * 100}%` }} />
            </div>
          ) : null}
          <div className="hero-combat-meter hero-combat-meter--enemy">
            <span>{enemyLabel}</span>
            <strong>{enemyHealth}/{enemyMaxHealth} PV</strong>
            <i style={{ width: `${(enemyHealth / enemyMaxHealth) * 100}%` }} />
          </div>
          {enemyMaxMana > 0 ? (
            <div className="hero-combat-meter hero-combat-meter--mana">
              <span>Mana ennemi</span>
              <strong>{enemyMana}/{enemyMaxMana}</strong>
              <i style={{ width: `${(enemyMana / enemyMaxMana) * 100}%` }} />
            </div>
          ) : null}
        </div>

        <div className="hero-combat-log">
          <p>{activeHeroCombat.message || 'Le combat commence.'}</p>
          {!isEnemyTurn && !isEnded ? (
            <div className="hero-combat-action-choice" aria-label="Action du héros">
              <button
                type="button"
                className={`hero-combat-action-choice-button ${!selectedHeroCombatPowerId ? 'active' : ''}`}
                onClick={() => setSelectedHeroCombatPowerId('')}
                disabled={!canChooseHeroAction}
              >
                <strong>Attaque normale</strong>
                <span>{combatManaCost} mana</span>
              </button>
              {heroPowers.map((power) => {
                const manaCost = Math.max(0, Number(power.manaCost) || 0);
                const totalManaCost = combatManaCost + manaCost;
                const disabled = !canChooseHeroAction || totalManaCost > heroMana;
                return (
                  <button
                    key={power.id}
                    type="button"
                    className={`hero-combat-action-choice-button ${selectedHeroCombatPowerId === power.id ? 'active' : ''}`}
                    onClick={() => setSelectedHeroCombatPowerId(power.id)}
                    disabled={disabled}
                    title={disabled && totalManaCost > heroMana ? 'Mana insuffisante' : `${power.force || 0} force`}
                  >
                    <strong>{power.name || 'Pouvoir'}</strong>
                    <span>{HERO_POWER_TYPE_LABELS[power.type] || power.type || 'Pouvoir'} · {totalManaCost} mana · {power.force || 0}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="inline-actions">
            <button type="button" onClick={combatActionHandler} disabled={combatActionDisabled}>
              {isEnemyTurn ? 'Lancer le dé ennemi' : selectedHeroCombatActionLabel}
            </button>
            <button type="button" className="secondary-action" onClick={closeHeroCombat}>
              {isEnded ? 'Revenir à la scène' : 'Quitter le combat'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryTiles = (itemIds, emptyLabel = 'Aucun objet.') => (
    <div className="inventory-grid">
      {itemIds.length ? itemIds.map((itemId) => {
        const item = project.items.find((entry) => entry.id === itemId);
        if (!item) return null;
        return (
          <button
            key={itemId}
            type="button"
            className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
            draggable
            onClick={() => openInventoryItem(itemId)}
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
              {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || '📦'}</span>}
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
    const criticalSuccess = Math.max(1, Number(heroAdventure?.rules?.criticalSuccess) || Number(heroAdventure?.dice?.sides) || 20);
    const criticalChance = Math.max(0, Math.min(100, Number(heroAdventure?.rules?.criticalChance) || 0));
    const criticalMultiplier = Math.max(1, Number(heroAdventure?.rules?.criticalMultiplier) || 2);
    const strongestPower = heroPowers.reduce((best, power) => (
      Math.max(0, Number(power.force) || 0) > Math.max(0, Number(best?.force) || 0) ? power : best
    ), null);
    const strongestMagicDamage = strongestPower ? heroForceDamage + Math.max(0, Number(strongestPower.force) || 0) : heroForceDamage;
    return (
      <div className={`hero-character-page ${compact ? 'hero-character-page--compact' : ''}`} style={heroBackgroundStyle}>
        <div className="hero-paper-doll">
          <div className="hero-equipment-slot-grid" aria-label="Equipement porte">
            {heroEquipmentSlots.map((item, index) => (
              <button
                key={item?.id || `empty-${index}`}
                type="button"
                className={`hero-equipment-slot slot-${index % 8} ${item ? 'is-filled' : 'is-empty'}`}
                title={item ? `${item.name} - glisser vers l'inventaire pour retirer` : 'Deposer un equipement ici'}
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
                  {item?.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item?.icon || '+'}</span>}
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
          </div>

          {heroPowers.length ? (
            <div className="hero-character-power-list">
              {heroPowers.map((power) => {
                const manaCost = Math.max(0, Number(power.manaCost) || 0);
                const powerForce = Math.max(0, Number(power.force) || 0);
                return (
                  <article className="hero-character-power" key={power.id}>
                    <strong>{power.name || 'Pouvoir'}</strong>
                    <span>{HERO_POWER_TYPE_LABELS[power.type] || power.type || 'Pouvoir'}</span>
                    <small>{manaCost} mana · +{powerForce} force · {heroForceDamage + powerForce} dégâts</small>
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
                  {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || '◆'}</span>}
                  <strong>{item.name}</strong>
                  <small>{getHeroEquipmentBonusLabel(item)}</small>
                </button>
            )) : <p>Aucun equipement porte.</p>}
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

  const getDiePips = (face = 1) => {
    const pipsByFace = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
    };
    return pipsByFace[Math.max(1, Math.min(6, Number(face) || 1))] || pipsByFace[1];
  };

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

  const renderHeroSetupScreen = () => {
    if (!isHeroSetupOpen) return null;
    const hasRolledSkills = heroSetupResultsRevealed && (heroState?.skills || []).some((skill) => skill.rolledValue);
    const skillCount = Math.max(1, (heroState?.skills || []).length);
    const allDiceRolled = heroSetupFinalRolls.length >= skillCount;
    const shouldShowDice = isHeroSetupRolling || !hasRolledSkills || allDiceRolled;
    const setupCardStyle = heroSetupBackgroundImageData
      ? { backgroundImage: `linear-gradient(180deg, rgba(8,16,30,.38), rgba(8,16,30,.66)), url(${heroSetupBackgroundImageData})` }
      : undefined;
    return (
      <div className="hero-setup-overlay">
        <div className={`hero-setup-card ${heroSetupBackgroundImageData ? 'has-hero-setup-background' : ''}`} style={setupCardStyle}>
          <span className="eyebrow">Creation du héros</span>
          <h2>{heroState?.name || 'Héros'}</h2>
          <p>
            Avant de commencer l'aventure, lance les dés pour connaître tes compétences.
            Chaque compétence tire 1d6; le résultat devient le bonus utilisé dans les tests.
          </p>
          {shouldShowDice ? (
          <div
            className={`hero-setup-dice-rack ${isHeroSetupRolling ? 'is-rolling' : ''}`}
          >
            {(heroState?.skills || []).map((skill, index) => {
              const face = heroSetupDiceFaces[index] || ((index % 6) + 1);
              const isCurrentDie = heroSetupRollingIndex === index;
              const isFinalDie = heroSetupFinalRolls[index];
              const isNextDie = index === heroSetupFinalRolls.length;
              return (
                <button
                  type="button"
                  className={`hero-setup-die-wrap ${isCurrentDie ? 'is-current' : ''} ${isFinalDie ? 'is-final' : ''} ${!isFinalDie && !isNextDie ? 'is-locked' : ''}`}
                  key={skill.id}
                  onClick={() => (isCurrentDie ? stopHeroSetupRoll() : startHeroSetupRoll(index))}
                  disabled={isFinalDie || (!isCurrentDie && (isHeroSetupRolling || !isNextDie))}
                >
                  <span className={`hero-die-face hero-die-face--${heroDiceSkin} face-${face}`}>
                    {getDiePips(face).map((position) => <i key={position} className={`pip pip-${position}`} />)}
                  </span>
                  <small>{isFinalDie ? `${skill.name} = ${face}` : skill.name}</small>
                </button>
              );
            })}
            <strong>
              {isHeroSetupRolling
                ? heroSetupRollingIndex >= 0
                  ? `Clique encore pour arreter ${heroState?.skills?.[heroSetupRollingIndex]?.name || 'le dé'}`
                  : 'Résultats obtenus...'
                : allDiceRolled
                  ? 'Les dés ont parlé. Découvre tes compétences.'
                  : `Clique le dé de ${heroState?.skills?.[heroSetupFinalRolls.length]?.name || 'la compétence'}`}
            </strong>
          </div>
          ) : (
          <div className="hero-setup-skill-grid">
            {(heroState?.skills || []).map((skill) => (
              <div key={skill.id} className={skill.rolledValue ? 'is-rolled' : ''}>
                <span>{skill.name}</span>
                <strong>{skill.rolledValue ? `+${skill.value}` : '-'}</strong>
                <small>{skill.rolledValue ? `Jet : ${skill.rolledValue}` : 'A tirer'}</small>
              </div>
            ))}
          </div>
          )}
          <div className="hero-setup-actions">
            {shouldShowDice ? (
              <button type="button" className="secondary-action" onClick={revealHeroSetupSkills} disabled={!allDiceRolled || isHeroSetupRolling}>
                Decouvrir mes compétences
              </button>
            ) : (
              <button type="button" className="secondary-action" onClick={() => {
                setHeroSetupFinalRolls([]);
                setHeroSetupDiceFaces([]);
                heroSetupDiceFacesRef.current = [];
                setHeroSetupRollingIndex(-1);
                setHeroSetupResultsRevealed(false);
              }}>
                Relancer les compétences
              </button>
            )}
            <button type="button" onClick={completeHeroSetup} disabled={!hasRolledSkills || isHeroSetupRolling || shouldShowDice}>
              Commencer l'aventure
            </button>
          </div>
        </div>
      </div>
    );
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
      <section className="panel player-stage-panel">
        <div className="player-topbar">
          <div>
            <span className="eyebrow">Player</span>
            <strong>{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</strong>
          </div>
          <div className="player-actions">
            <button type="button" className="secondary-action" onClick={() => setIsPauseOpen(true)}>Pause</button>
            <button type="button" className="secondary-action player-reset-button" onClick={resetPreview}>Recommencer</button>
            <button type="button" className="secondary-action" onClick={saveGameState}>Sauvegarder</button>
            <button type="button" className="secondary-action" onClick={loadGameState}>Charger</button>
            <button type="button" className="secondary-action" onClick={() => setShowInteractionHints((value) => !value)}>
              {showInteractionHints ? 'Sans aide' : 'Aide visuelle'}
            </button>
            <button type="button" className="secondary-action" onClick={toggleFullscreen}>Plein écran</button>
          </div>
        </div>

        <div className="scene-player" style={{ aspectRatio: sceneAspectRatio, '--scene-aspect': sceneAspectRatio }} onClick={() => viewerImage && setViewerImage(null)}>
          {renderHeroSetupScreen()}
          {renderHeroRewardNotice()}
          {renderHeroCombatOverlay()}

          {playSceneBackgroundUrl ? (
            <img
              className="scene-background"
              src={playSceneBackgroundUrl}
              alt={playScene.name}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight) {
                  setLoadedSceneAspectRatio(Number((image.naturalWidth / image.naturalHeight).toFixed(4)));
                }
              }}
            />
          ) : (
            <div className="placeholder">Ajoute un fond pour jouer la scène.</div>
          )}
          <SceneVisualEffect effect={playScene?.visualEffect} intensity={playScene?.visualEffectIntensity} />
          {(playScene?.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
            <SceneVisualEffect
              key={zone.id}
              effect={zone.effect}
              intensity={zone.intensity}
              className="scene-visual-effect-zone"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                zIndex: getVisualEffectZoneZIndex(zone.layer),
                ...getElementShapeStyle(zone),
              }}
            />
          ))}

          {(playScene?.sceneObjects || [])
            .filter((obj) => !usedSceneObjectIds.includes(obj.id) && (!obj.isHidden || revealedSceneObjectIds.includes(obj.id)))
            .map((obj) => {
              const objectForRender = applySceneObjectTextOverride(obj, sceneObjectTextOverrides[obj.id]);
              const linkedItem = obj.linkedItemId ? project.items.find((entry) => entry.id === obj.linkedItemId) : null;
              const displayImage = obj.imageData || linkedItem?.imageData || '';
              return (
                <button
                  key={obj.id}
                  type="button"
                  className={`player-scene-object ${obj.isInvisible ? 'player-scene-object-invisible' : ''} ${getSceneObjectClickMode(objectForRender) === 'none' ? 'player-scene-object-not-clickable' : ''}`}
                  style={getSceneObjectStyle(obj)}
                  onClick={(event) => handleSceneObjectClick(event, objectForRender)}
                  title={objectForRender.name}
                  aria-label={objectForRender.name || 'Objet invisible'}
                >
                  {!objectForRender.isInvisible && objectForRender.anime2dSpec ? (
                    <Anime2DPreview spec={objectForRender.anime2dSpec} project={project} />
                  ) : !obj.isInvisible && displayImage ? (
                    <SceneObjectBlockContent object={objectForRender} displayImage={displayImage} linkedItem={linkedItem} />
                  ) : !objectForRender.isInvisible ? (
                    <SceneObjectBlockContent object={objectForRender} displayImage="" linkedItem={linkedItem} />
                  ) : null}
                </button>
              );
            })}

          {(playScene?.hotspots || []).map((spot) => (
            <button
              key={spot.id}
              type="button"
              className="player-hotspot"
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${spot.width}%`,
                height: `${spot.height}%`,
                zIndex: getLayerZIndex(spot, 'hotspot'),
                ...getElementShapeStyle(spot),
              }}
              onClick={(event) => handleHotspotClick(event, spot)}
              title={spot.name}
            />
          ))}

          {viewerImage && (
            <div className="scene-inline-viewer">
              <div className="scene-inline-viewer__backdrop" />
              <div className="scene-inline-viewer__card">
                <img className="scene-inline-viewer__image" src={viewerImage.src} alt={viewerImage.name || 'Objet'} />
                <div className="scene-inline-viewer__name">{viewerImage.caption || viewerImage.name || 'Objet'}</div>
              </div>
            </div>
          )}

          {actPreloadStatus.isLoading ? (
            <div className="act-preload-overlay" role="status" aria-live="polite">
              <div className="act-preload-card">
                <span className="eyebrow">Chargement</span>
                <strong>{actPreloadStatus.label}</strong>
                <div className="act-preload-bar" aria-label={`Chargement ${actPreloadStatus.progress}%`}>
                  <span style={{ width: `${actPreloadStatus.progress}%` }} />
                </div>
                <small>{actPreloadStatus.progress}% des médias de l'acte sont prêts</small>
              </div>
            </div>
          ) : null}

          {sceneTransitionOverlay ? (
            <div
              key={sceneTransitionOverlay.key}
              className={`scene-transition-overlay scene-transition-overlay--${sceneTransitionOverlay.type}`}
              style={{ '--scene-transition-duration': `${sceneTransitionOverlay.duration}ms` }}
            >
              {transitionPreviousBackgroundUrl ? (
                <img
                  src={transitionPreviousBackgroundUrl}
                  alt=""
                />
              ) : <div className="placeholder">Scène précédente</div>}
            </div>
          ) : null}

          {playScene?.timerEnabled ? (
            <div className="scene-timer-hud player-scene-timer">
              <strong>{formatTimerSeconds(sceneTimerRemaining)}</strong>
              {playScene.timerEndAction === 'damage-life' ? <span>Vies: {playerLives}</span> : null}
            </div>
          ) : null}

          <div className={`player-narration-bar ${isNarrationCollapsed ? 'is-collapsed' : ''}`}>
            {isNarrationCollapsed ? (
              <button
                type="button"
                className="narration-discreet-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsNarrationCollapsed(false);
                }}
              >
                Texte
              </button>
            ) : (
              <p
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsNarrationCollapsed(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsNarrationCollapsed(true);
                  }
                }}
              >
                {dialogue || 'Aucun message.'}
              </p>
            )}
            <div className="player-drawer-actions">
              {isHeroAdventure ? (
                <button type="button" className="inventory-discreet-button hero-panel-discreet-button" onClick={(event) => {
                  event.stopPropagation();
                  setIsInventoryOpen(false);
                  setIsHeroPanelOpen((value) => !value);
                }}>
                  Hero Adventure
                </button>
              ) : null}
              <button type="button" className="inventory-discreet-button" onClick={(event) => {
                event.stopPropagation();
                setIsHeroPanelOpen(false);
                setIsInventoryOpen((value) => !value);
              }}>
                {isHeroAdventure ? 'Personnage' : isChoiceAdventure ? 'Carnet' : 'Inventaire'} {inventory.length ? `(${inventory.length})` : ''}
              </button>
            </div>
          </div>

          {isHeroPanelOpen && isHeroAdventure && (
            <>
              <button
                type="button"
                className="player-inventory-backdrop"
                aria-label="Fermer le panneau hero aventure"
                onClick={() => setIsHeroPanelOpen(false)}
              />
              <div className="player-inventory-drawer player-inventory-drawer--hero-panel" onClick={(event) => event.stopPropagation()}>
                <div className="panel-head">
                  <h3>{currentGameTitle}</h3>
                  <button type="button" className="secondary-button" onClick={() => setIsHeroPanelOpen(false)}>Fermer</button>
                </div>
                {renderHeroAdventurePanel(true)}
              </div>
            </>
          )}

          {isInventoryOpen && (
            <>
            {usesImmersiveAdventurePlayer ? (
              <button
                type="button"
                className="player-inventory-backdrop"
                aria-label={isHeroAdventure ? 'Fermer la fiche personnage' : 'Fermer le carnet'}
                onClick={() => setIsInventoryOpen(false)}
              />
            ) : null}
            <div className={`player-inventory-drawer ${isHeroAdventure ? 'player-inventory-drawer--hero' : isChoiceAdventure ? 'player-inventory-drawer--adventure' : ''}`} onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <h3>{isHeroAdventure ? 'Personnage' : isChoiceAdventure ? 'Carnet d’aventure' : 'Inventaire'}</h3>
                <button type="button" className="secondary-button" onClick={() => setIsInventoryOpen(false)}>Fermer</button>
              </div>
              {isHeroAdventure ? renderHeroCharacterPage(true) : isChoiceAdventure ? renderAdventureInventoryContent(true) : (
              <>
              <button
                type="button"
                className="secondary-action player-combine-button"
                onClick={() => {
                  if (selectedInventoryIds.length !== 2) {
                    setDialogue('Sélectionne 2 objets à combiner.');
                    return;
                  }
                  combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
                }}
              >
                Combiner les 2 objets
              </button>
              {!sharedPlayerMode ? (
                <div className="inventory-test-tools">
                  <span className="small-note">Test inventaire</span>
                  <select value={debugInventoryItemId} onChange={(event) => setDebugInventoryItemId(event.target.value)}>
                    {(project.items || []).map((item) => (
                      <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
                    ))}
                  </select>
                  <div className="inline-actions">
                    <button type="button" className="secondary-action" disabled={!debugInventoryItemId} onClick={addDebugInventoryItem}>
                      Ajouter
                    </button>
                    <button type="button" className="danger-button" disabled={!debugInventoryItemId || !inventory.includes(debugInventoryItemId)} onClick={removeDebugInventoryItem}>
                      Retirer
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="inventory-grid">
                {inventory.length ? inventory.map((itemId) => {
                  const item = project.items.find((entry) => entry.id === itemId);
                  if (!item) return null;
                  return (
                    <button
                      key={itemId}
                      type="button"
                      className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
                      draggable
                      onClick={() => openInventoryItem(itemId)}
                      onDragStart={() => setDraggedInventoryId(itemId)}
                      onDragEnd={() => setDraggedInventoryId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedInventoryId && draggedInventoryId !== itemId) {
                          combineInventoryItems(draggedInventoryId, itemId);
                        }
                        setDraggedInventoryId(null);
                      }}
                    >
                      <div className="inventory-thumb">
                        {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || '📦'}</span>}
                      </div>
                      <strong>{item.name}</strong>
                    </button>
                  );
                }) : <p>Aucun objet.</p>}
              </div>
              </>
              )}
            </div>
            </>
          )}
        </div>

      </section>

      {!isChoiceAdventure ? (
      <section className="panel side player-side-panel">
        <div className="badge-line">{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</div>
        <div className="dialogue-box"><p>{dialogue || 'Aucun message.'}</p></div>
        {renderHeroAdventurePanel()}

        {isHeroAdventure ? renderHeroCharacterPage() : (
        <>
        <div className="panel-head panel-head-spaced">
          <h3>Inventaire</h3>
          <button
            onClick={() => {
              if (selectedInventoryIds.length !== 2) {
                setDialogue('Sélectionne 2 objets à combiner.');
                return;
              }
              combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
            }}
          >
            Combiner les 2 objets
          </button>
        </div>
        {!sharedPlayerMode ? (
          <div className="combo-card subtle-card inventory-test-tools">
            <div className="panel-head">
              <h3>Test inventaire</h3>
            </div>
            <select value={debugInventoryItemId} onChange={(event) => setDebugInventoryItemId(event.target.value)}>
              {(project.items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
              ))}
            </select>
            <div className="inline-actions">
              <button type="button" className="secondary-action" disabled={!debugInventoryItemId} onClick={addDebugInventoryItem}>
                Ajouter
              </button>
              <button type="button" className="danger-button" disabled={!debugInventoryItemId || !inventory.includes(debugInventoryItemId)} onClick={removeDebugInventoryItem}>
                Retirer
              </button>
            </div>
          </div>
        ) : null}
        {!sharedPlayerMode ? (
          <div className="combo-card subtle-card adventure-state-card">
            <div className="panel-head">
              <h3>État aventure</h3>
            </div>
            <div className="adventure-state-grid">
              <span><strong>{chosenConversationReplyIds.length}</strong> choix faits</span>
              <span><strong>{hiddenReplies.length}</strong> réponses cachées</span>
              <span><strong>{storyVariableEntries.length}</strong> variables</span>
              <span><strong>{endingReplies.length}</strong> fins prevues</span>
            </div>
            <div className="adventure-state-list">
              {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.map(([key, value]) => (
                <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
              )) : <span>Aucune variable d'histoire modifiée.</span>}
              {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
            </div>
          </div>
        ) : null}
        {!sharedPlayerMode ? renderAdventureJournal(false) : null}
        <div className="inventory-grid">
          {inventory.length ? inventory.map((itemId) => {
            const item = project.items.find((entry) => entry.id === itemId);
            if (!item) return null;
            return (
              <button
                key={itemId}
                type="button"
                className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
                draggable
                onClick={() => openInventoryItem(itemId)}
                onDragStart={() => setDraggedInventoryId(itemId)}
                onDragEnd={() => setDraggedInventoryId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedInventoryId && draggedInventoryId !== itemId) {
                    combineInventoryItems(draggedInventoryId, itemId);
                  }
                  setDraggedInventoryId(null);
                }}
              >
                <div className="inventory-thumb">
                  {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || '📦'}</span>}
                </div>
                <strong>{item.name}</strong>
              </button>
            );
          }) : <p>Aucun objet dans l’inventaire.</p>}
        </div>
        <p className="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p>
        </>
        )}
      </section>
      ) : null}

      {playingCinematic && (
        <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) closeCinematic(); }}>
          <div className="overlay-card wide">
            {cinematicPlayback?.type === 'anime2d' ? (
              <>
                <Anime2DCinematicPlayer cinematic={playingCinematic} spec={cinematicPlayback.anime2d?.spec} project={project} onEnd={closeCinematic} />
                <div className="panel-head">
                  <button className="secondary-button" onClick={closeCinematic}>Terminer</button>
                </div>
              </>
            ) : cinematicPlayback?.type === 'video' ? (
              <>
                {cinematicPlayback.video.src ? (
                  <video
                    className="overlay-media"
                    src={cinematicPlayback.video.src}
                    controls={cinematicPlayback.video.controls}
                    autoPlay={cinematicPlayback.video.autoplay}
                    preload="auto"
                    onEnded={closeCinematic}
                  />
                ) : <p className="small-note">Ajoute une vidéo dans l’éditeur de cinematic.</p>}
                <p className="narration">{cinematicPlayback.video.name || playingCinematic.name}</p>
                <div className="panel-head">
                  <button onClick={closeCinematic}>Terminer</button>
                </div>
              </>
            ) : (cinematicPlayback?.currentSlide || currentSlide) && (
              <>
                {(cinematicPlayback?.currentSlide || currentSlide).imageData ? <img className="overlay-media" loading="eager" decoding="async" src={(cinematicPlayback?.currentSlide || currentSlide).imageData} alt={(cinematicPlayback?.currentSlide || currentSlide).imageName || (cinematicPlayback?.currentSlide || currentSlide).narration || 'Cinématique'} /> : null}
                {(cinematicPlayback?.currentSlide || currentSlide).audioData ? <audio ref={audioRef} autoPlay src={(cinematicPlayback?.currentSlide || currentSlide).audioData} style={{ display: 'none' }} /> : null}
                <p className="narration">{(cinematicPlayback?.currentSlide || currentSlide).narration}</p>
                <div className="panel-head">
                  <button className="secondary-button" onClick={() => setPlayingSlideIndex((index) => Math.max(0, index - 1))}>Précédent</button>
                  <button onClick={advanceCinematic}>Suivant</button>
                  <button className="secondary-button" onClick={closeCinematic}>Terminer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {conversationNode ? (
        <div className={`overlay ${isChoiceAdventure ? 'conversation-player-overlay' : ''}`} onClick={(event) => { if (event.target === event.currentTarget) closeConversation?.(); }}>
          <div className={`overlay-card wide ${isChoiceAdventure ? 'conversation-player-card' : ''}`}>
            <div className="panel-head">
              {activeConversation?.portraitData ? (
                <img className="conversation-portrait" src={activeConversation.portraitData} alt={activeConversation.portraitName || conversationNode.speaker || 'Portrait'} />
              ) : null}
              <div>
                <h2>{conversationNode.speaker || 'Conversation'}</h2>
                <p className="small-note enigma-overlay-question">{conversationNode.text}</p>
              </div>
              <button className="danger-button" onClick={closeConversation}>Fermer</button>
            </div>
            {renderChoiceEffectSummary(true)}
            <div className={`stack-10 conversation-player-replies conversation-player-replies-${Math.min(3, Math.max(1, displayedConversationReplies.length || 1))}`}>
              {displayedConversationReplies.map((reply) => {
                const isLocked = isConversationReplyAvailable?.(reply) === false;
                const lockReason = isLocked ? getConversationReplyLockReason?.(reply) : '';
                return (
                  <button
                    key={reply.id}
                    type="button"
                    className={`secondary-action code-secondary-button ${isLocked ? 'conversation-reply-locked' : ''}`}
                    disabled={isLocked}
                    title={lockReason || undefined}
                    onClick={() => handleConversationReplyClick(reply)}
                  >
                    <span>{reply.label || 'Repondre'}</span>
                    {isLocked ? <small>{lockReason || 'Choix verrouillée'}</small> : null}
                  </button>
                );
              })}
              {!displayedConversationReplies.length ? (
                <button type="button" className="code-primary-button" onClick={closeConversation}>
                  Continuer
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {choiceEffectNotices.length && !conversationNode && !activeEnding ? (
        <div className="choice-effect-floating">
          {renderChoiceEffectSummary(false)}
        </div>
      ) : null}

      {activeEnding ? (
        <div className="overlay">
          <div className={`overlay-card ending-card ending-card-${activeEnding.type || 'neutral'}`}>
            <span className="ending-badge">{endingLabel}</span>
            <h2>{activeEnding.title || endingLabel}</h2>
            {activeEnding.message ? <p className="small-note">{activeEnding.message}</p> : null}
            <p>{activeEnding.summary || 'Ton aventure se termine ici.'}</p>
            {renderChoiceEffectSummary(true)}
            <div className="inline-actions">
              <button type="button" className="secondary-action" onClick={closeEnding}>Fermer</button>
              <button type="button" className="code-primary-button" onClick={resetPreview}>Recommencer</button>
            </div>
          </div>
        </div>
      ) : null}

      {isHeroDefeated && !activeEnding && !isCustomHeroDefeatScene ? (
        <div className="overlay hero-defeat-overlay">
          <div className="overlay-card hero-defeat-card">
            <span className="ending-badge">Défaite</span>
            <h2>Le héros tombe à 0 PV</h2>
            <p className="small-note">Les actions joueur sont bloquées tant que les PV restent à 0.</p>
            <p>L’aventure s’arrête ici. Recommence la partie ou charge une sauvegarde pour reprendre avant la chute.</p>
            <div className="inline-actions">
              <button type="button" className="secondary-action" onClick={loadGameState}>Charger</button>
              <button
                type="button"
                className="secondary-action"
                onClick={restoreLastChoiceSnapshot}
                disabled={!lastChoiceSnapshot}
              >
                Retour au dernier choix
              </button>
              <button type="button" className="code-primary-button" onClick={resetPreview}>Recommencer</button>
            </div>
          </div>
        </div>
      ) : null}

      {enigma && (
        <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) closeEnigma(); }}>
          <div className="overlay-card wide" style={enigmaOverlayStyle}>
            <div className="panel-head">
              <div>
                <h2 className="enigma-overlay-title">{enigma.name}</h2>
                <p className="small-note enigma-overlay-question">{enigma.question}</p>
              </div>
              <button className="danger-button" onClick={closeEnigma}>Fermer</button>
            </div>

            {enigma.type === 'code' && (
              <div>
                {codeSkin === 'safe-wheels' ? (
                  <>
                    <label>Roulettes du coffre</label>
                    <div className="code-slot-row">
                      {codeSlots.map((char, index) => (
                        <input
                          key={index}
                          aria-label={`Caractère ${index + 1}`}
                          value={char}
                          maxLength={1}
                          onChange={(event) => setCodeCharAt(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') submitEnigma();
                          }}
                          className="code-slot-input"
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {codeSkin === 'digicode' ? (
                  <>
                    <label>Digicode</label>
                    <div className="digicode-display">
                      {codeSlots.map((char, index) => (
                        <span key={index} className="digicode-slot">
                          {char || '•'}
                        </span>
                      ))}
                    </div>
                    <div className="digicode-grid">
                      {CODE_KEYPAD_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className="secondary-action code-key-button"
                          onClick={() => pressCodeKey(key)}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {codeSkin === 'boxes' ? (
                  <>
                    <label>Cases du code</label>
                    <div className="code-slot-row">
                      {codeSlots.map((char, index) => (
                        <input
                          key={index}
                          aria-label={`Case ${index + 1}`}
                          value={char}
                          maxLength={1}
                          onChange={(event) => setCodeCharAt(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') submitEnigma();
                          }}
                          className="code-box-input"
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {codeSkin === 'paper-strip' ? (
                  <>
                    <label>Bande papier</label>
                    <input
                      value={enigmaCodeInput}
                      onChange={(event) => setEnigmaCodeInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitEnigma();
                      }}
                      className="paper-code-input"
                    />
                  </>
                ) : null}

                {!['safe-wheels', 'digicode', 'boxes', 'paper-strip'].includes(codeSkin) ? (
                  <>
                    <label>Code</label>
                    <input value={enigmaCodeInput} onChange={(event) => setEnigmaCodeInput(event.target.value)} onKeyDown={(event) => {
                      if (event.key === 'Enter') submitEnigma();
                    }} />
                  </>
                ) : null}

                <div className="enigma-actions inline-actions">
                  {codeSkin === 'digicode' ? <button type="button" className="secondary-button code-secondary-button" onClick={() => setEnigmaCodeInput('')}>Effacer</button> : null}
                  <button className="code-primary-button" onClick={submitEnigma}>Valider l’énigme</button>
                </div>
              </div>
            )}

            {enigma.type === 'misc' && (
              <div>
                {miscMode === 'multiple-choice' ? (
                  <>
                    <label>Choisis une réponse</label>
                    <div className="stack-10">
                      {(enigma.miscChoices || []).map((choice, index) => (
                        <button
                          key={`${choice}-${index}`}
                          type="button"
                          className={enigmaCodeInput === choice ? 'code-primary-button' : 'secondary-action code-secondary-button'}
                          onClick={() => setEnigmaCodeInput(choice)}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {miscMode === 'true-false' ? (
                  <>
                    <label>Choisis une réponse</label>
                    <div className="inline-actions">
                      {['vrai', 'faux'].map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setEnigmaCodeInput(choice)}
                          className={enigmaCodeInput === choice ? 'code-primary-button' : 'code-secondary-button'}
                        >
                          {choice === 'vrai' ? 'Vrai' : 'Faux'}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {miscMode === 'ordering' ? (
                  <>
                    <label>Remets dans l’ordre</label>
                    <div className="stack-10">
                      <div className="color-attempt-row">
                        {miscOrderingSelection.length ? miscOrderingSelection.map((choice, index) => (
                          <button key={`${choice}-${index}`} type="button" className="secondary-action code-secondary-button" onClick={() => {
                            const next = miscOrderingSelection.filter((_, entryIndex) => entryIndex !== index);
                            setEnigmaCodeInput(JSON.stringify(next));
                          }}>
                            {index + 1}. {choice}
                          </button>
                        )) : <span className="small-note">Clique les éléments dans le bon ordre.</span>}
                      </div>
                      {(enigma.miscChoices || []).filter((choice) => !miscOrderingSelection.includes(choice)).map((choice) => (
                        <button key={choice} type="button" className="secondary-action code-secondary-button" onClick={() => {
                          setEnigmaCodeInput(JSON.stringify([...miscOrderingSelection, choice]));
                        }}>{choice}</button>
                      ))}
                    </div>
                  </>
                ) : null}

                {miscMode === 'matching' ? (
                  <>
                    <label>Associe les paires</label>
                    <div className="stack-10">
                      {(enigma.miscPairs || []).map((pair) => (
                        <div key={pair.left} className="matching-row">
                          <strong>{pair.left}</strong>
                          <select value={miscMatchingAnswers[pair.left] || ''} onChange={(event) => {
                            setEnigmaCodeInput(JSON.stringify({ ...miscMatchingAnswers, [pair.left]: event.target.value }));
                          }}>
                            <option value="">Choisir</option>
                            {(enigma.miscPairs || []).map((entry) => <option key={entry.right} value={entry.right}>{entry.right}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                {['numeric-range', 'exact-number'].includes(miscMode) ? (
                  <>
                    <label>{miscMode === 'exact-number' ? 'Nombre exact' : 'Nombre'}</label>
                    <input
                      type="number"
                      value={enigmaCodeInput}
                      onChange={(event) => setEnigmaCodeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitEnigma();
                      }}
                    />
                    <p className="small-note">
                      {miscMode === 'exact-number' ?
                         'La réponse doit correspondre au nombre attendu.'
                        : `La réponse doit être comprise entre ${enigma.miscMin} et ${enigma.miscMax}.`}
                    </p>
                  </>
                ) : null}

                {miscMode === 'item-select' ? (
                  <>
                    <label>Choisis l’objet</label>
                    <div className="stack-10">
                      {(project.items || []).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEnigmaCodeInput(item.id)}
                          className={enigmaCodeInput === item.id ? 'code-primary-button' : 'code-secondary-button'}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {miscMode === 'multi-select' ? (
                  <>
                    <label>Sélectionne toutes les bonnes réponses</label>
                    <div className="stack-10">
                      {(enigma.miscChoices || []).map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => toggleMiscSelection(choice)}
                          className={miscMultiSelection.includes(choice) ? 'code-primary-button' : 'code-secondary-button'}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {['free-answer', 'fill-blank', 'accepted-answers'].includes(miscMode) ? (
                  <>
                    <label>{miscMode === 'fill-blank' ? 'Mot manquant' : 'Réponse'}</label>
                    <input
                      value={enigmaCodeInput}
                      onChange={(event) => setEnigmaCodeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitEnigma();
                      }}
                      placeholder="Écris ta réponse..."
                    />
                    <p className="small-note">La réponse est acceptée même avec des majuscules différentes ou des mots en plus.</p>
                  </>
                ) : null}
                <div className="enigma-actions">
                  <button className="code-primary-button" onClick={submitEnigma}>Valider l’énigme</button>
                </div>
              </div>
            )}

            {enigma.type === 'colors' && (
              <div>
                <label>Suite en cours</label>
                <div className="color-attempt-row">
                  {enigmaColorAttempt.length ? enigmaColorAttempt.map((color, index) => (
                    <span key={`${color}-${index}`} className="color-chip" style={{ background: color }} />
                  )) : <span className="small-note">Aucune couleur choisie.</span>}
                </div>
                <div className="color-picker-grid">
                  {COLOR_OPTIONS.map(([value, label]) => (
                    <button key={value} type="button" className="color-picker-button" style={{ background: value }} title={label} onClick={() => pushEnigmaColor(value)} />
                  ))}
                </div>
                <div className="panel-head panel-head-loose">
                  <button className="secondary-button" onClick={() => setEnigmaColorAttempt([])}>Effacer la suite</button>
                  <button onClick={submitEnigma}>Valider l’énigme</button>
                </div>
              </div>
            )}

            {enigma.type === 'simon' && (
              <div>
                <p className="small-note">{simonPlayerTurn ? 'À toi de rejouer la séquence.' : 'Observe la séquence…'}</p>
                <div className="color-picker-grid simon-grid">
                  {COLOR_OPTIONS.slice(0, 4).map(([value, label], index) => {
                    const solutionColor = (enigma.solutionColors || [])[simonPlaybackIndex];
                    const lit = solutionColor === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`color-picker-button simon-pad ${lit ? 'active' : ''}`}
                        style={{ background: value }}
                        title={label}
                        disabled={!simonPlayerTurn}
                        onClick={() => pushEnigmaColor(value)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="color-attempt-row panel-head-spaced">
                  {enigmaColorAttempt.map((color, index) => <span key={`${color}-${index}`} className="color-chip" style={{ background: color }} />)}
                </div>
                <div className="inventory-actions">
                  <button className="secondary-button" onClick={() => startSimonPlayback(enigma)}>Rejouer la séquence</button>
                </div>
              </div>
            )}

            {enigma.type === 'puzzle' && enigma.imageData && (
              <div>
                <p className="small-note">Clique une pièce, puis une deuxième pour les échanger.</p>
                <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {enigmaPuzzleOrder.map((pieceIndex, index) => (
                    <button
                      key={`${pieceIndex}-${index}`}
                      type="button"
                      className={`puzzle-piece ${enigmaPuzzleSelectedIndex === index ? 'selected' : ''}`}
                      style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)}
                      onClick={() => clickPuzzlePiece(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {enigma.type === 'rotation' && enigma.imageData && (
              <div>
                <p className="small-note">Clique sur chaque pièce pour la remettre à l’endroit.</p>
                <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {Array.from({ length: pieceCount }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      className="puzzle-piece"
                      style={makePieceStyle(enigma.imageData, rows, cols, index, enigmaRotationAngles[index] || 0)}
                      onClick={() => rotatePuzzlePiece(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {enigma.type === 'dragdrop' && enigma.imageData && (
              <div>
                <p className="small-note">Glisse les pièces vers la bonne case. Clique une case remplie pour renvoyer sa pièce dans la réserve.</p>
                <div className="dragdrop-layout">
                  <div>
                    <h3>Plateau</h3>
                    <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                      {enigmaDragSlots.map((pieceIndex, slotIndex) => (
                        <button
                          key={`slot-${slotIndex}`}
                          type="button"
                          className="puzzle-slot"
                          onClick={() => returnDragPieceToBank(slotIndex)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            moveDragPieceToSlot(enigmaDraggedPiece, slotIndex);
                            setEnigmaDraggedPiece(null);
                          }}
                        >
                          {pieceIndex !== null && pieceIndex !== undefined ? (
                            <span className="puzzle-piece static" style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)} />
                          ) : <span className="slot-index">{slotIndex + 1}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Pièces</h3>
                    <div className="bank-grid">
                      {enigmaDragBank.map((pieceIndex) => (
                        <button
                          key={`bank-${pieceIndex}`}
                          type="button"
                          className="puzzle-piece"
                          draggable
                          style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)}
                          onDragStart={() => setEnigmaDraggedPiece(pieceIndex)}
                          onDragEnd={() => setEnigmaDraggedPiece(null)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {['puzzle', 'rotation', 'dragdrop'].includes(enigma.type) && !enigma.imageData && (
              <p className="small-note">Ajoute une image dans l’onglet Énigmes pour jouer cette énigme.</p>
            )}
          </div>
        </div>
      )}

      {isPauseOpen && (
        <div className="player-pause-overlay" onClick={() => setIsPauseOpen(false)}>
          <div className="player-pause-menu" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Pause</span>
            <h2>{project.title || 'Escape game'}</h2>
            <div className="adventure-state-card compact">
              <strong>Progression narrative</strong>
              <div className="adventure-state-grid">
                <span><strong>{chosenConversationReplyIds.length}</strong> choix</span>
                <span><strong>{completedHotspotIds.length}</strong> actions</span>
                <span><strong>{visibleStoryVariableEntries.length}</strong> variables</span>
                <span><strong>{activeEnding ? 1 : 0}</strong> fin</span>
              </div>
            </div>
            {renderAdventureJournal(true)}
            <div className="player-pause-actions">
              <button type="button" onClick={() => setIsPauseOpen(false)}>Reprendre</button>
              <button type="button" className="secondary-action" onClick={() => { saveGameState(); setIsPauseOpen(false); }}>Sauvegarder</button>
              <button type="button" className="secondary-action" onClick={() => { loadGameState(); setIsPauseOpen(false); }}>Charger</button>
              <button type="button" className="secondary-action" onClick={() => { resetPreview(); setIsPauseOpen(false); }}>Recommencer</button>
              {isFullscreen ? (
                <button type="button" className="secondary-action" onClick={() => { document.exitFullscreen?.(); setIsPauseOpen(false); }}>Quitter le plein écran</button>
              ) : null}
              <button type="button" className="secondary-action" onClick={() => setShowInteractionHints((value) => !value)}>
                {showInteractionHints ? 'Masquer l’aide visuelle' : 'Afficher l’aide visuelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
