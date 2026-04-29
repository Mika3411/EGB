import { useEffect, useRef, useState } from 'react';
import { COLOR_OPTIONS, POPUP_OVERLAY_GRADIENTS } from '../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../data/playerConfig';
import { parseJsonValue } from '../lib/gameEngine';
import { getLayerZIndex } from './scenes/sceneEditorUtils';
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

const formatTimerSeconds = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

const isPreloadableUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const addUrl = (set, value) => {
  if (isPreloadableUrl(value)) set.add(value);
};

const collectSceneMediaUrls = (scene, imageUrls, audioUrls) => {
  if (!scene) return;
  addUrl(imageUrls, scene.backgroundData);
  addUrl(audioUrls, scene.musicData);
  (scene.sceneObjects || []).forEach((object) => {
    addUrl(imageUrls, object.imageData);
    addUrl(imageUrls, object.popupImageData || object.popupImage);
  });
  (scene.hotspots || []).forEach((spot) => {
    addUrl(imageUrls, spot.objectImageData);
    addUrl(imageUrls, spot.secondObjectImageData);
    addUrl(audioUrls, spot.soundData);
  });
};

export default function PreviewTab(props) {
  const {
    playScene,
    viewerImage,
    setViewerImage,
    playingCinematic,
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
    playerLives = 3,
    sceneTimerResetKey = 0,
    setInventory,
    setSelectedInventoryIds,
    usedSceneObjectIds = [],
    markSceneObjectUsed,
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
  const hotspotAudioRef = useRef(null);
  const playerShellRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const previousSceneRef = useRef(playScene);
  const transitionTimerRef = useRef(null);
  const sceneTimerIntervalRef = useRef(null);
  const expiredSceneTimerKeyRef = useRef('');
  const onSceneTimerEndRef = useRef(onSceneTimerEnd);
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
  const [debugInventoryItemId, setDebugInventoryItemId] = useState(project.items?.[0]?.id || '');
  const sceneAspectRatio = Number(loadedSceneAspectRatio || playScene?.backgroundAspectRatio) > 0 ?
     Number(loadedSceneAspectRatio || playScene.backgroundAspectRatio)
    : 1.6;

  useEffect(() => {
    onSceneTimerEndRef.current = onSceneTimerEnd;
  }, [onSceneTimerEnd]);

  useEffect(() => {
    setLoadedSceneAspectRatio(0);
  }, [playScene?.id, playScene?.backgroundData]);

  useEffect(() => {
    mediaPreloadRef.current.audios.forEach((audio) => {
      audio.removeAttribute('src');
      audio.load();
    });

    if (!playScene) {
      mediaPreloadRef.current = { images: [], audios: [] };
      return undefined;
    }

    const scenesById = new Map((project.scenes || []).map((scene) => [scene.id, scene]));
    const nearbySceneIds = new Set([
      playScene.id,
      playScene.timerTargetSceneId,
      ...(playScene.hotspots || []).flatMap((spot) => [
        spot.targetSceneId,
        spot.secondTargetSceneId,
      ]),
    ].filter(Boolean));

    const imageUrls = new Set();
    const audioUrls = new Set();
    nearbySceneIds.forEach((sceneId) => collectSceneMediaUrls(scenesById.get(sceneId), imageUrls, audioUrls));
    collectSceneMediaUrls(playScene, imageUrls, audioUrls);

    const images = Array.from(imageUrls).slice(0, 16).map((url) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      return image;
    });

    const audios = Array.from(audioUrls).slice(0, 5).map((url) => {
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

    const timerSeconds = Number(playScene?.timerSeconds) || 0;
    if (!playScene?.timerEnabled || timerSeconds <= 0) {
      setSceneTimerRemaining(0);
      expiredSceneTimerKeyRef.current = '';
      return undefined;
    }

    const timerKey = `${playScene.id}:${timerSeconds}:${playScene.timerEndAction || 'none'}:${playScene.timerTargetSceneId || ''}:${playScene.timerTargetCinematicId || ''}`;
    expiredSceneTimerKeyRef.current = '';
    setSceneTimerRemaining(timerSeconds);

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
  ]);

  useEffect(() => {
    const previousScene = previousSceneRef.current;
    if (!playScene?.id || !previousScene?.id || previousScene.id === playScene.id) {
      previousSceneRef.current = playScene;
      return undefined;
    }

    const transition = previousScene.sceneTransition || 'none';
    const duration = Number(previousScene.sceneTransitionDuration) || 700;
    if (transition !== 'none') {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      setSceneTransitionOverlay({
        key: `${previousScene.id}-${playScene.id}-${Date.now()}`,
        type: transition,
        duration,
        previousScene,
      });
      transitionTimerRef.current = window.setTimeout(() => {
        setSceneTransitionOverlay(null);
        transitionTimerRef.current = null;
      }, duration + 80);
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
    setInventory?.((prev) => (prev.includes(debugInventoryItemId) ? prev : [...prev, debugInventoryItemId]));
    setSelectedInventoryIds?.((prev) => (
      prev.includes(debugInventoryItemId) ? prev : [...prev, debugInventoryItemId].slice(-2)
    ));
    setDialogue?.(`${item.name || 'Objet'} ajouté à l’inventaire de test.`);
  };

  const removeDebugInventoryItem = () => {
    if (!debugInventoryItemId) return;
    const item = project.items.find((entry) => entry.id === debugInventoryItemId);
    setInventory?.((prev) => prev.filter((itemId) => itemId !== debugInventoryItemId));
    setSelectedInventoryIds?.((prev) => prev.filter((itemId) => itemId !== debugInventoryItemId));
    if (viewerImage?.id === debugInventoryItemId) setViewerImage?.(null);
    setDialogue?.(`${item?.name || 'Objet'} retiré de l’inventaire de test.`);
  };

  useEffect(() => {
    const nextMusicData = playScene?.musicData || '';
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

    if (sceneAudioRef.current && sceneAudioSourceRef.current === nextMusicData) {
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
    sceneAudioSourceRef.current = nextMusicData;

    return undefined;
  }, [playScene?.musicData, playScene?.musicLoop, playScene?.musicVolume]);

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

    if (spot.soundData) {
      if (hotspotAudioRef.current) {
        hotspotAudioRef.current.pause();
        hotspotAudioRef.current.currentTime = 0;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = spot.soundData;
      audio.volume = typeof spot.soundVolume === 'number' ? spot.soundVolume : 0.8;
      audio.play().catch(() => {});
      hotspotAudioRef.current = audio;
    }

    triggerHotspot(spot);
  };


  const handleSceneObjectClick = (event, obj) => {
    event.stopPropagation();
    if (!obj) return;

    const mode = obj.interactionMode || 'popup';
    const popupSrc = obj.popupImageData || obj.popupImage || obj.imageData || '';
    const linkedItem = obj.linkedItemId ?
       project.items.find((entry) => entry.id === obj.linkedItemId)
      : null;

    if ((mode === 'popup' || mode === 'both') && popupSrc) {
      setViewerImage({
        id: obj.linkedItemId || obj.id,
        src: popupSrc,
        name: obj.name || linkedItem?.name || obj.popupImageName || 'Objet',
        caption: obj.dialogue || obj.name || linkedItem?.name || '',
      });
    }

    if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
      setInventory?.((prev) => (prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId]));
      setSelectedInventoryIds?.((prev) => (
        prev.includes(obj.linkedItemId) ? prev : [...prev, obj.linkedItemId].slice(-2)
      ));
      setDialogue(obj.dialogue || `Tu obtiens ${linkedItem?.name || obj.name || 'un objet'}.`);
    } else if (obj.dialogue) {
      setDialogue(obj.dialogue);
    }

    if (obj.removeAfterUse) {
      markSceneObjectUsed?.(obj.id);
    }
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
          {playScene?.backgroundData ? (
            <img
              className="scene-background"
              src={playScene.backgroundData}
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
              }}
            />
          ))}

          {(playScene?.sceneObjects || [])
            .filter((obj) => !usedSceneObjectIds.includes(obj.id))
            .map((obj) => (
              <button
                key={obj.id}
                type="button"
                className="player-scene-object"
                style={getSceneObjectStyle(obj)}
                onClick={(event) => handleSceneObjectClick(event, obj)}
                title={obj.name}
              >
                {obj.imageData ? (
                  <img src={obj.imageData} alt={obj.name || 'Objet'} />
                ) : (
                  <span>{obj.name || 'Objet'}</span>
                )}
              </button>
            ))}

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

          {sceneTransitionOverlay ? (
            <div
              key={sceneTransitionOverlay.key}
              className={`scene-transition-overlay scene-transition-overlay--${sceneTransitionOverlay.type}`}
              style={{ '--scene-transition-duration': `${sceneTransitionOverlay.duration}ms` }}
            >
              {sceneTransitionOverlay.previousScene?.backgroundData ? (
                <img
                  src={sceneTransitionOverlay.previousScene.backgroundData}
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
              Inventaire ? {inventory.length ? `(${inventory.length})` : ''}
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
                    setDialogue('Sélectionne 2 objets à combiner.');
                    return;
                  }
                  combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
                }}
              >
                Combiner les 2 objets ?
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
        <div className="badge-line">{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</div>
        <div className="dialogue-box"><p>{dialogue || 'Aucun message.'}</p></div>

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
            Combiner les 2 objets ?
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
            {(playingCinematic.cinematicType || 'slides') === 'video' ? (
              <>
                {playingCinematic.videoData ? (
                  <video
                    className="overlay-media"
                    src={playingCinematic.videoData}
                    controls={playingCinematic.videoControls !== false}
                    autoPlay={playingCinematic.videoAutoplay !== false}
                    preload="auto"
                    onEnded={closeCinematic}
                  />
                ) : <p className="small-note">Ajoute une vidéo dans l’éditeur de cinématique.</p>}
                <p className="narration">{playingCinematic.name}</p>
                <div className="panel-head">
                  <button onClick={closeCinematic}>Terminer</button>
                </div>
              </>
            ) : currentSlide && (
              <>
                {currentSlide.imageData ? <img className="overlay-media" loading="eager" decoding="async" src={currentSlide.imageData} alt={currentSlide.imageName || currentSlide.narration || 'Cinématique'} /> : null}
                {currentSlide.audioData ? <audio ref={audioRef} className="overlay-media" controls autoPlay src={currentSlide.audioData} /> : null}
                <p className="narration">{currentSlide.narration}</p>
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

                <div className="inventory-actions inline-actions">
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
                <div className="inventory-actions">
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
