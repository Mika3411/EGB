import { useEffect, useLayoutEffect } from 'react';
import {
  collectActMediaUrls,
  collectNearbySceneMediaUrls,
  createSceneTransitionOverlay,
  getSceneAmbientSoundKey,
  getSceneMusicKey,
  getSceneTimerConfig,
} from '../../lib/gameEngine';

const HERO_COMBAT_EFFECT_LOCK_MS = 3000;

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

export function usePreviewBrowserEffects({
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
}) {
  useEffect(() => {
    if (!isHeroAdventure || !heroCharacterPreviewRequestKey) return;
    setIsInventoryOpen(true);
    setIsHeroPanelOpen(false);
  }, [heroCharacterPreviewRequestKey, isHeroAdventure]);

  useEffect(() => {
    if (!isHeroSetupOpen) {
      setHeroSetupSelectionConfirmed(false);
      setHeroSetupGalleryIndex(0);
      return;
    }
    const heroChoices = Array.isArray(heroAdventure?.heroes) && heroAdventure.heroes.length
      ? heroAdventure.heroes
      : [];
    const selectedIndex = heroChoices.findIndex((choice) => choice.id === heroState?.id);
    if (selectedIndex >= 0) setHeroSetupGalleryIndex(selectedIndex);
  }, [heroAdventure?.heroes, heroState?.id, isHeroSetupOpen]);

  useEffect(() => {
    if (!isHeroAdventure) setIsHeroPanelOpen(false);
  }, [isHeroAdventure]);

  useEffect(() => {
    if (!activeHeroCombat || activeHeroCombat.phase !== 'hero' || activeHeroCombat.status !== 'active') {
      setSelectedHeroCombatPowerId('');
    }
  }, [activeHeroCombat?.id, activeHeroCombat?.phase, activeHeroCombat?.round, activeHeroCombat?.status]);

  const activeHeroCombatEffectKey = Array.isArray(activeHeroCombat?.visualEffects)
    ? activeHeroCombat.visualEffects.map((effect) => effect?.id).filter(Boolean).join('|')
    : '';

  useEffect(() => {
    if (heroCombatEffectLockTimeoutRef.current) {
      window.clearTimeout(heroCombatEffectLockTimeoutRef.current);
      heroCombatEffectLockTimeoutRef.current = null;
    }
    if (!activeHeroCombatEffectKey) {
      setHeroCombatEffectLocked(false);
      return undefined;
    }
    setHeroCombatEffectLocked(true);
    heroCombatEffectLockTimeoutRef.current = window.setTimeout(() => {
      setHeroCombatEffectLocked(false);
      heroCombatEffectLockTimeoutRef.current = null;
    }, HERO_COMBAT_EFFECT_LOCK_MS);
    return () => {
      if (heroCombatEffectLockTimeoutRef.current) {
        window.clearTimeout(heroCombatEffectLockTimeoutRef.current);
        heroCombatEffectLockTimeoutRef.current = null;
      }
    };
  }, [activeHeroCombatEffectKey]);

  useEffect(() => {
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    setHeroCombatRolling(false);
  }, [activeHeroCombat?.id, activeHeroCombat?.phase, activeHeroCombat?.round, activeHeroCombat?.status]);

  useEffect(() => () => {
    if (heroSetupRollTimerRef.current) window.clearTimeout(heroSetupRollTimerRef.current);
    if (heroSetupRollIntervalRef.current) window.clearInterval(heroSetupRollIntervalRef.current);
    if (heroPanelRollIntervalRef.current) window.clearInterval(heroPanelRollIntervalRef.current);
    if (heroCombatRollIntervalRef.current) window.clearInterval(heroCombatRollIntervalRef.current);
    if (heroCombatAutoStopTimeoutRef.current) window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
    if (heroCombatEffectLockTimeoutRef.current) window.clearTimeout(heroCombatEffectLockTimeoutRef.current);
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

  return {
    addDebugInventoryItem,
    handleShellMouseMove,
    removeDebugInventoryItem,
    revealControls,
    toggleFullscreen,
  };
}
