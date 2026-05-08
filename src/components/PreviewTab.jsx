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
import { SceneObjectBlockContent, getSceneObjectBlockType, getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';
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
    getSceneLabel,
    dialogue,
    inventory,
    addInventoryItem,
    removeInventoryItem,
    playerLives = 3,
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
    setDraggedInventoryId,
    draggedInventoryId,
    combineInventoryItems,
    setDialogue,
    activeEnigma,
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
  }, [playSceneMusicUrl, playScene?.musicLoop, playScene?.musicVolume, actPreloadStatus.isLoading]);

  useEffect(() => {
    const nextAmbientKey = getSceneAmbientSoundKey(playScene) || playSceneAmbientSoundUrl;

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
  }, [playSceneAmbientSoundUrl, playScene?.ambientSoundLoop, playScene?.ambientSoundVolume, actPreloadStatus.isLoading]);

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


  const handleSceneObjectClick = (event, obj) => {
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
      const answer = window.prompt(obj.placeholder || (blockType === 'code' ? 'Entre le code.' : 'Entre ta réponse.'));
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

  return (
    <div
      ref={playerShellRef}
      data-tour="preview-player"
      className={`player-shell ${isFullscreen ? 'is-fullscreen' : ''} ${sharedPlayerMode ? 'is-shared-player' : ''} ${showInteractionHints ? 'show-hints' : 'hide-hints'} ${!areControlsVisible ? 'controls-hidden' : ''}`}
      onMouseMove={handleShellMouseMove}
      onFocus={() => {
        if (!isFullscreen && !sharedPlayerMode) revealControls();
      }}
    >
      <section className="panel player-stage-panel">
        <div className="player-topbar">
          <div>
            <span className="eyebrow">Player</span>
            <strong>{playScene ? getSceneLabel(playScene.id) : 'Aucune scene'}</strong>
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
            <div className="placeholder">Ajoute un fond pour jouer la scene.</div>
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
              const objectForRender = sceneObjectTextOverrides[obj.id]
                ? { ...obj, blockText: sceneObjectTextOverrides[obj.id], dialogue: sceneObjectTextOverrides[obj.id] }
                : obj;
              const linkedItem = obj.linkedItemId ? project.items.find((entry) => entry.id === obj.linkedItemId) : null;
              const displayImage = obj.imageData || linkedItem?.imageData || '';
              return (
                <button
                  key={obj.id}
                  type="button"
                  className={`player-scene-object ${obj.isInvisible ? 'player-scene-object-invisible' : ''} ${getSceneObjectClickMode(obj) === 'none' ? 'player-scene-object-not-clickable' : ''}`}
                  style={getSceneObjectStyle(obj)}
                  onClick={(event) => handleSceneObjectClick(event, obj)}
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
                <small>{actPreloadStatus.progress}% des medias de l'acte sont prêts</small>
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
              ) : <div className="placeholder">Scene precedente</div>}
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
            <button type="button" className="inventory-discreet-button" onClick={(event) => {
              event.stopPropagation();
              setIsInventoryOpen((value) => !value);
            }}>
              Inventaire {inventory.length ? `(${inventory.length})` : ''}
            </button>
          </div>

          {isInventoryOpen && (
            <div className="player-inventory-drawer" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <h3>Inventaire</h3>
                <button type="button" className="secondary-button" onClick={() => setIsInventoryOpen(false)}>Fermer</button>
              </div>
              <button
                type="button"
                className="secondary-action player-combine-button"
                onClick={() => {
                  if (selectedInventoryIds.length !== 2) {
                    setDialogue('Selectionne 2 objets à combiner.');
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
            </div>
          )}
        </div>

      </section>

      <section className="panel side player-side-panel">
        <div className="badge-line">{playScene ? getSceneLabel(playScene.id) : 'Aucune scene'}</div>
        <div className="dialogue-box"><p>{dialogue || 'Aucun message.'}</p></div>

        <div className="panel-head panel-head-spaced">
          <h3>Inventaire</h3>
          <button
            onClick={() => {
              if (selectedInventoryIds.length !== 2) {
                setDialogue('Selectionne 2 objets à combiner.');
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
      </section>

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
                {cinematicPlayback.video?.src ? (
                  <video
                    className="overlay-media"
                    src={cinematicPlayback.video.src}
                    controls={cinematicPlayback.video.controls}
                    autoPlay={cinematicPlayback.video.autoplay}
                    preload="auto"
                    onEnded={closeCinematic}
                  />
                ) : <p className="small-note">Ajoute une vidéo dans l’éditeur de cinematic.</p>}
                <p className="narration">{cinematicPlayback.video?.name || playingCinematic.name}</p>
                <div className="panel-head">
                  <button onClick={closeCinematic}>Terminer</button>
                </div>
              </>
            ) : (cinematicPlayback?.currentSlide || currentSlide) && (
              <>
                {(cinematicPlayback?.currentSlide || currentSlide).imageData ? <img className="overlay-media" loading="eager" decoding="async" src={(cinematicPlayback?.currentSlide || currentSlide).imageData} alt={(cinematicPlayback?.currentSlide || currentSlide).imageName || (cinematicPlayback?.currentSlide || currentSlide).narration || 'Cinematic'} /> : null}
                {(cinematicPlayback?.currentSlide || currentSlide).audioData ? <audio ref={audioRef} className="overlay-media" controls autoPlay src={(cinematicPlayback?.currentSlide || currentSlide).audioData} /> : null}
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
                  <button className="code-primary-button" onClick={submitEnigma}>Valider l’enigme</button>
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
                    <label>Selectionne toutes les bonnes réponses</label>
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
                  <button className="code-primary-button" onClick={submitEnigma}>Valider l’enigme</button>
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
                  <button onClick={submitEnigma}>Valider l’enigme</button>
                </div>
              </div>
            )}

            {enigma.type === 'simon' && (
              <div>
                <p className="small-note">{simonPlayerTurn ? 'À toi de rejouer la sequence.' : 'Observe la sequence…'}</p>
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
                  <button className="secondary-button" onClick={() => startSimonPlayback(enigma)}>Rejouer la sequence</button>
                </div>
              </div>
            )}

            {enigma.type === 'puzzle' && enigma.imageData && (
              <div>
                <p className="small-note">Clique une piece, puis une deuxième pour les échanger.</p>
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
                <p className="small-note">Clique sur chaque piece pour la remettre à l’endroit.</p>
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
                <p className="small-note">Glisse les pieces vers la bonne case. Clique une case remplie pour renvoyer sa piece dans la réserve.</p>
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
                    <h3>Pieces</h3>
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
              <p className="small-note">Ajoute une image dans l’onglet Enigmes pour jouer cette enigme.</p>
            )}
          </div>
        </div>
      )}

      {isPauseOpen && (
        <div className="player-pause-overlay" onClick={() => setIsPauseOpen(false)}>
          <div className="player-pause-menu" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Pause</span>
            <h2>{project.title || 'Escape game'}</h2>
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
