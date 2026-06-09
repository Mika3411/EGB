import { normalizeAnime2dLayer, normalizeAnime2dSpec } from './anime2dEngine';

export const CINEMATIC_TYPES = ['slides', 'video', 'anime2d'];
export const CINEMATIC_END_ACTIONS = ['none', 'act', 'scene', 'item', 'project_link'];
export const CINEMATIC_TRANSITIONS = ['none', 'fade', 'slide', 'zoom', 'cut', 'dissolve'];
export const CINEMATIC_STEP_TYPES = ['text', 'image', 'audio', 'video', 'animation', 'wait', 'transition', 'anime2d'];

export const DEFAULT_SLIDE_DURATION_MS = 4500;
export const DEFAULT_TRANSITION_DURATION_MS = 450;
export const DEFAULT_VIDEO_DURATION_MS = 0;

const toFiniteNumber = (value, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

export const secondsToMs = (seconds, fallbackSeconds = 0) => (
  Math.max(0, Math.round(toFiniteNumber(seconds, fallbackSeconds) * 1000))
);

export const clampDurationMs = (value, fallback = DEFAULT_SLIDE_DURATION_MS) => (
  Math.max(0, Math.round(toFiniteNumber(value, fallback)))
);

export const normalizeCinematicType = (type) => (
  CINEMATIC_TYPES.includes(type) ? type : 'slides'
);

export const normalizeCinematicTransition = (transition = 'fade') => (
  CINEMATIC_TRANSITIONS.includes(transition) ? transition : 'fade'
);

export const normalizeCinematicEndAction = (action = 'none') => (
  CINEMATIC_END_ACTIONS.includes(action) ? action : 'none'
);

export const normalizeCinematicStepType = (type = 'text') => (
  CINEMATIC_STEP_TYPES.includes(type) ? type : 'text'
);

export function createCinematicStep(type = 'text', patch = {}) {
  return normalizeCinematicStep({
    type,
    ...patch,
  });
}

export function normalizeCinematicSlide(slide = {}, index = 0) {
  const durationMs = slide.durationMs ?? secondsToMs(slide.durationSeconds, DEFAULT_SLIDE_DURATION_MS / 1000);
  return {
    ...slide,
    id: slide.id || `slide-${index + 1}`,
    imageData: slide.imageData || '',
    imageName: slide.imageName || '',
    narration: slide.narration || '',
    audioData: slide.audioData || '',
    audioName: slide.audioName || '',
    durationMs: clampDurationMs(durationMs, DEFAULT_SLIDE_DURATION_MS),
    transition: normalizeCinematicTransition(slide.transition || 'fade'),
    transitionDurationMs: clampDurationMs(slide.transitionDurationMs, DEFAULT_TRANSITION_DURATION_MS),
  };
}

export function slideToCinematicSteps(slide = {}, index = 0) {
  const normalizedSlide = normalizeCinematicSlide(slide, index);
  const steps = [];

  if (normalizedSlide.imageData) {
    steps.push(createCinematicStep('image', {
      id: `${normalizedSlide.id}:image`,
      src: normalizedSlide.imageData,
      name: normalizedSlide.imageName,
      transition: normalizedSlide.transition,
      duration: normalizedSlide.transitionDurationMs,
    }));
  }

  if (normalizedSlide.narration) {
    steps.push(createCinematicStep('text', {
      id: `${normalizedSlide.id}:text`,
      content: normalizedSlide.narration,
    }));
  }

  if (normalizedSlide.audioData) {
    steps.push(createCinematicStep('audio', {
      id: `${normalizedSlide.id}:audio`,
      src: normalizedSlide.audioData,
      name: normalizedSlide.audioName,
    }));
  }

  steps.push(createCinematicStep('wait', {
    id: `${normalizedSlide.id}:wait`,
    duration: normalizedSlide.durationMs,
  }));

  return steps;
}

export function legacyEndActionToTransitionStep(cinematic = {}) {
  const action = normalizeCinematicEndAction(cinematic.onEndType || 'none');
  if (action === 'scene' && cinematic.targetSceneId) {
    return createCinematicStep('transition', {
      id: `${cinematic.id || 'cinematic'}:end-scene`,
      toScene: cinematic.targetSceneId,
    });
  }
  if (action === 'act' && cinematic.targetActId) {
    return createCinematicStep('transition', {
      id: `${cinematic.id || 'cinematic'}:end-act`,
      toAct: cinematic.targetActId,
    });
  }
  if (action === 'item' && cinematic.rewardItemId) {
    return createCinematicStep('transition', {
      id: `${cinematic.id || 'cinematic'}:end-item`,
      rewardItem: cinematic.rewardItemId,
    });
  }
  return null;
}

export function legacyCinematicToSteps(cinematic = {}) {
  const cinematicType = normalizeCinematicType(cinematic.cinematicType || 'slides');
  const steps = [];

  if (cinematicType === 'video') {
    steps.push(createCinematicStep('video', {
      id: `${cinematic.id || 'cinematic'}:vidéo`,
      src: cinematic.videoData || '',
      name: cinematic.videoName || '',
      autoplay: cinematic.videoAutoplay !== false,
      controls: cinematic.videoControls !== false,
      duration: clampDurationMs(cinematic.videoDurationMs, DEFAULT_VIDEO_DURATION_MS),
    }));
  } else if (cinematicType === 'anime2d') {
    steps.push(createCinematicStep('anime2d', {
      id: `${cinematic.id || 'cinematic'}:anime2d`,
      spec: cinematic.anime2dSpec || null,
      name: cinematic.anime2dName || '',
    }));
  } else {
    const slides = Array.isArray(cinematic.slides) && cinematic.slides.length ? cinematic.slides : [normalizeCinematicSlide()];
    slides.forEach((slide, index) => {
      steps.push(...slideToCinematicSteps(slide, index));
    });
  }

  const endStep = legacyEndActionToTransitionStep(cinematic);
  if (endStep) steps.push(endStep);
  return steps;
}

export function normalizeCinematicStep(step = {}, index = 0) {
  const type = normalizeCinematicStepType(step.type || 'text');
  const base = {
    ...step,
    id: step.id || `step-${index + 1}`,
    type,
  };

  if (type === 'text') {
    return {
      ...base,
      content: step.content ?? step.text ?? step.narration ?? '',
    };
  }

  if (type === 'image' || type === 'audio' || type === 'video') {
    return {
      ...base,
      src: step.src || step.imageData || step.audioData || step.videoData || '',
      name: step.name || step.imageName || step.audioName || step.videoName || '',
      autoplay: type === 'video' ? step.autoplay !== false : Boolean(step.autoplay),
      controls: type === 'video' ? step.controls !== false : Boolean(step.controls),
      duration: clampDurationMs(step.duration ?? step.durationMs, type === 'video' ? DEFAULT_VIDEO_DURATION_MS : 0),
    };
  }

  if (type === 'animation') {
    return {
      ...base,
      target: step.target || '',
      action: step.action || 'fadeIn',
      duration: clampDurationMs(step.duration ?? step.durationMs, DEFAULT_TRANSITION_DURATION_MS),
      delay: clampDurationMs(step.delay ?? step.delayMs, 0),
      easing: step.easing || 'ease',
    };
  }

  if (type === 'wait') {
    return {
      ...base,
      duration: clampDurationMs(step.duration ?? step.durationMs, DEFAULT_SLIDE_DURATION_MS),
    };
  }

  if (type === 'transition') {
    return {
      ...base,
      transition: normalizeCinematicTransition(step.transition || step.effect || 'fade'),
      duration: clampDurationMs(step.duration ?? step.durationMs, DEFAULT_TRANSITION_DURATION_MS),
      toScene: step.toScene || step.targetSceneId || '',
      toAct: step.toAct || step.targetActId || '',
      rewardItem: step.rewardItem || step.rewardItemId || '',
    };
  }

  if (type === 'anime2d') {
    return {
      ...base,
      spec: step.spec && typeof step.spec === 'object' ? step.spec : null,
      name: step.name || '',
    };
  }

  return base;
}

export function normalizeCinematicSteps(steps = [], cinematic = {}) {
  const sourceSteps = Array.isArray(steps) && steps.length ? steps : legacyCinematicToSteps(cinematic);
  return sourceSteps.map(normalizeCinematicStep);
}

export function normalizeCinematic(cinematic = {}) {
  const cinematicType = normalizeCinematicType(cinematic.cinematicType || 'slides');
  const slides = Array.isArray(cinematic.slides) && cinematic.slides.length
    ? cinematic.slides.map(normalizeCinematicSlide)
    : [normalizeCinematicSlide()];
  const steps = normalizeCinematicSteps(cinematic.steps, {
    ...cinematic,
    cinematicType,
    slides,
  });

  return {
    ...cinematic,
    id: cinematic.id || '',
    name: cinematic.name || 'Nouvelle cinematic',
    cinematicType,
    slides,
    steps,
    videoData: cinematic.videoData || '',
    videoName: cinematic.videoName || '',
    videoAutoplay: cinematic.videoAutoplay !== false,
    videoControls: cinematic.videoControls !== false,
    anime2dSpec: cinematic.anime2dSpec && typeof cinematic.anime2dSpec === 'object' ? cinematic.anime2dSpec : null,
    anime2dName: cinematic.anime2dName || '',
    onEndType: normalizeCinematicEndAction(cinematic.onEndType || 'none'),
    targetActId: cinematic.targetActId || '',
    targetSceneId: cinematic.targetSceneId || '',
    targetProjectId: cinematic.targetProjectId || '',
    targetProjectUserId: cinematic.targetProjectUserId || '',
    rewardItemId: cinematic.rewardItemId || '',
  };
}

export function normalizeAnime2dSpecForCinematic(payload) {
  const normalized = normalizeAnime2dSpec({
    ...payload,
    kind: payload?.kind || 'escape-game-builder-2d-animation',
  });

  if (!normalized) return null;

  return {
    ...normalized,
    sceneName: payload?.sceneName || '2D Anime',
    layers: Array.isArray(payload?.layers) ? payload.layers.map(normalizeAnime2dLayer).filter(Boolean) : [],
  };
}

export function createCinematicFromAnime2dPayload(payload, options = {}) {
  if (payload?.kind !== 'escape-game-builder-2d-animation' || !Array.isArray(payload.cinematicSteps)) {
    throw new Error('Ce JSON ne vient pas de l’éditeur 2D Anime.');
  }

  const {
    fileName = '',
    idFactory = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  } = options;
  const anime2dSpec = normalizeAnime2dSpecForCinematic(payload);
  if (!anime2dSpec) throw new Error('JSON 2D Anime invalide.');

  return normalizeCinematic({
    id: idFactory('cinematic-anime2d'),
    name: anime2dSpec.sceneName || fileName.replace(/\.json$/i, '') || '2D Anime',
    cinematicType: 'anime2d',
    slides: [{
      id: idFactory('slide'),
      narration: anime2dSpec.cinematicSteps.find((step) => step.narration)?.narration || '',
    }],
    steps: [
      createCinematicStep('anime2d', {
        id: idFactory('step-anime2d'),
        spec: anime2dSpec,
        name: fileName,
      }),
    ],
    anime2dSpec,
    anime2dName: fileName,
    videoAutoplay: true,
    videoControls: true,
    onEndType: 'none',
  });
}

export function createStepTimeline(steps = []) {
  let cursorMs = 0;
  return steps.map((step, index) => {
    const normalizedStep = normalizeCinematicStep(step, index);
    const startMs = cursorMs + clampDurationMs(normalizedStep.delay, 0);
    const durationMs = clampDurationMs(normalizedStep.duration, normalizedStep.type === 'wait' ? DEFAULT_SLIDE_DURATION_MS : 0);
    const endMs = startMs + durationMs;

    if (['wait', 'transition', 'video', 'anime2d'].includes(normalizedStep.type)) {
      cursorMs = endMs;
    }

    return {
      id: normalizedStep.id,
      type: normalizedStep.type,
      index,
      step: normalizedStep,
      startMs,
      endMs,
      durationMs,
      transition: normalizedStep.transition || '',
      events: [
        { type: `${normalizedStep.type}:start`, atMs: startMs, stepId: normalizedStep.id, index, step: normalizedStep },
        { type: `${normalizedStep.type}:end`, atMs: endMs, stepId: normalizedStep.id, index, step: normalizedStep },
      ],
    };
  });
}

export function createSlideTimeline(slides = []) {
  let cursorMs = 0;
  return slides.map((slide, index) => {
    const normalizedSlide = normalizeCinematicSlide(slide, index);
    const startMs = cursorMs;
    const endMs = startMs + normalizedSlide.durationMs;
    cursorMs = endMs;

    return {
      id: normalizedSlide.id,
      type: 'slide',
      index,
      slide: normalizedSlide,
      startMs,
      endMs,
      durationMs: normalizedSlide.durationMs,
      transition: normalizedSlide.transition,
      transitionDurationMs: normalizedSlide.transitionDurationMs,
      events: [
        { type: 'slide:enter', atMs: startMs, slideId: normalizedSlide.id, index },
        ...(normalizedSlide.audioData ? [{ type: 'audio:start', atMs: startMs, slideId: normalizedSlide.id, src: normalizedSlide.audioData }] : []),
        { type: 'slide:exit', atMs: endMs, slideId: normalizedSlide.id, index },
      ],
    };
  });
}

export function createAnime2dTimeline(spec = {}) {
  const steps = Array.isArray(spec?.cinematicSteps) ? spec.cinematicSteps : [];
  return steps
    .map((step, index) => {
      const startMs = secondsToMs(step.at, 0);
      const durationMs = secondsToMs(step.duration, 0);
      return {
        id: step.id || `anime-step-${index + 1}`,
        type: 'anime2d-step',
        index,
        step,
        startMs,
        endMs: startMs + durationMs,
        durationMs,
        transition: normalizeCinematicTransition(step.transition || 'fade'),
        exitTransition: normalizeCinematicTransition(step.exitTransition || 'fade'),
        events: [
          { type: 'anime2d:step-start', atMs: startMs, stepId: step.id || `anime-step-${index + 1}`, index },
          { type: 'anime2d:step-end', atMs: startMs + durationMs, stepId: step.id || `anime-step-${index + 1}`, index },
        ],
      };
    })
    .sort((left, right) => left.startMs - right.startMs);
}

export function createCinematicTimeline(cinematic = {}) {
  const normalized = normalizeCinematic(cinematic);
  const tracks = createStepTimeline(normalized.steps);

  const durationMs = Math.max(0, ...tracks.map((track) => track.endMs || 0));
  const events = [
    { type: 'cinematic:start', atMs: 0, cinematicId: normalized.id },
    ...tracks.flatMap((track) => track.events || []),
    { type: 'cinematic:end', atMs: durationMs, cinematicId: normalized.id, action: getCinematicEndEvent(normalized) },
  ].sort((left, right) => left.atMs - right.atMs);

  return {
    cinematic: normalized,
    type: normalized.cinematicType,
    tracks,
    events,
    durationMs,
  };
}

export function getCinematicDebugState(cinematic = {}, timeMs = 0) {
  const timeline = createCinematicTimeline(cinematic);
  const durationMs = timeline.durationMs;
  const rawTimeMs = Math.round(toFiniteNumber(timeMs, 0));
  const currentTimeMs = Math.max(0, Math.min(rawTimeMs, durationMs));
  const currentTrack = timeline.tracks.find((track) => {
    const isInstantStep = track.durationMs === 0 && currentTimeMs === track.startMs;
    return isInstantStep || (currentTimeMs >= track.startMs && currentTimeMs < track.endMs);
  }) || timeline.tracks.find((track) => track.startMs >= currentTimeMs) || null;
  const currentEvent = [...timeline.events]
    .reverse()
    .find((event) => event.atMs <= currentTimeMs) || null;
  const nextEvent = timeline.events.find((event) => event.atMs > currentTimeMs) || null;

  let state = 'idle';
  if (durationMs > 0 && currentTimeMs >= durationMs) {
    state = 'ended';
  } else if (currentTrack && currentTimeMs < currentTrack.startMs) {
    state = 'waiting';
  } else if (currentTrack) {
    state = 'playing';
  }

  return {
    state,
    timeMs: currentTimeMs,
    durationMs,
    progress: durationMs > 0 ? currentTimeMs / durationMs : 0,
    currentStep: currentTrack?.step || null,
    currentStepId: currentTrack?.id || '',
    currentStepIndex: currentTrack?.index ?? -1,
    currentTrack,
    currentEvent,
    nextEvent,
    eventCount: timeline.events.length,
    trackCount: timeline.tracks.length,
  };
}

export function getCinematicEndEvent(cinematic = {}) {
  const normalized = normalizeCinematic(cinematic);
  const transitionStep = [...normalized.steps].reverse().find((step) => step.type === 'transition') || null;
  if (transitionStep?.toScene) {
    return {
      type: 'scene',
      targetActId: '',
      targetSceneId: transitionStep.toScene,
      rewardItemId: '',
    };
  }
  if (transitionStep?.toAct) {
    return {
      type: 'act',
      targetActId: transitionStep.toAct,
      targetSceneId: '',
      rewardItemId: '',
    };
  }
  if (transitionStep?.rewardItem) {
    return {
      type: 'item',
      targetActId: '',
      targetSceneId: '',
      rewardItemId: transitionStep.rewardItem,
    };
  }

  const action = normalizeCinematicEndAction(normalized.onEndType);
  return {
    type: action,
    targetActId: action === 'act' ? normalized.targetActId || '' : '',
    targetSceneId: action === 'scene' ? normalized.targetSceneId || '' : '',
    rewardItemId: action === 'item' ? normalized.rewardItemId || '' : '',
    targetProjectId: action === 'project_link' ? normalized.targetProjectId || '' : '',
    targetProjectUserId: action === 'project_link' ? normalized.targetProjectUserId || '' : '',
  };
}

export function resolveCinematicEnd(cinematic = {}, project = {}, options = {}) {
  const event = getCinematicEndEvent(cinematic);
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  if (event.type === 'scene' && event.targetSceneId) {
    return {
      ...event,
      sceneId: event.targetSceneId,
      dialogue: 'Nouvelle scène débloquée.',
    };
  }

  if (event.type === 'act' && event.targetActId) {
    const actScenes = scenes.filter((scene) => scene.actId === event.targetActId);
    const scene = actScenes.find((entry) => !entry.parentSceneId) || actScenes[0] || null;
    return {
      ...event,
      sceneId: scene?.id || '',
      dialogue: 'Un nouvel acte commence.',
    };
  }

  if (event.type === 'item' && event.rewardItemId) {
    const getItemById = options.getItemById || ((itemId) => (project.items || []).find((entry) => entry.id === itemId));
    const rewardItem = getItemById(event.rewardItemId) || null;
    return {
      ...event,
      itemId: event.rewardItemId,
      rewardItem,
      dialogue: `Tu obtiens ${rewardItem?.name || 'un nouvel objet'}.`,
    };
  }

  return event;
}

export function getNextCinematicSlideIndex(cinematic = {}, currentIndex = 0) {
  const normalized = normalizeCinematic(cinematic);
  const total = normalized.slides.length;
  if (normalized.cinematicType !== 'slides' || currentIndex + 1 >= total) return null;
  return currentIndex + 1;
}

export function getCinematicVideoStep(cinematic = {}) {
  const normalized = normalizeCinematic(cinematic);
  return normalized.steps.find((step) => step.type === 'video') || null;
}

export function getCinematicAnime2dStep(cinematic = {}) {
  const normalized = normalizeCinematic(cinematic);
  return normalized.steps.find((step) => step.type === 'anime2d') || null;
}

export function getCinematicPlaybackModel(cinematic = {}, slideIndex = 0) {
  const normalized = normalizeCinematic(cinematic);
  const timeline = createCinematicTimeline(normalized);
  const videoStep = getCinematicVideoStep(normalized);
  const anime2dStep = getCinematicAnime2dStep(normalized);

  return {
    cinematic: normalized,
    timeline,
    type: normalized.cinematicType,
    currentSlide: normalized.slides[slideIndex] || null,
    video: videoStep ? {
      src: videoStep.src || normalized.videoData || '',
      controls: videoStep.controls !== false,
      autoplay: videoStep.autoplay !== false,
      name: videoStep.name || normalized.videoName || normalized.name,
    } : null,
    anime2d: anime2dStep ? {
      spec: anime2dStep.spec || normalized.anime2dSpec,
      name: anime2dStep.name || normalized.anime2dName || normalized.name,
    } : null,
  };
}

export function applyProjectStartType(draft, type, fallbackRootScenes = []) {
  if (!draft.start) draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
  draft.start.type = type === 'cinematic' ? 'cinematic' : 'scene';

  if (draft.start.type === 'cinematic' && !draft.start.targetCinematicId) {
    draft.start.targetCinematicId = draft.cinematics?.[0]?.id || '';
  }

  if (draft.start.type === 'scene' && !draft.start.targetSceneId) {
    const rootScenes = fallbackRootScenes.length ? fallbackRootScenes : (draft.scenes || []).filter((scene) => !scene.parentSceneId);
    draft.start.targetSceneId = rootScenes[0]?.id || draft.scenes?.[0]?.id || '';
  }
}

export function deleteCinematicFromProject(draft, cinematicId) {
  if (!draft || !cinematicId) return '';

  draft.cinematics = (draft.cinematics || []).filter((cine) => cine.id !== cinematicId);
  const nextSelectedCinematicId = draft.cinematics[0]?.id || '';

  if (!draft.start) draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
  if (draft.start.targetCinematicId === cinematicId) {
    draft.start.targetCinematicId = nextSelectedCinematicId;
    if (!nextSelectedCinematicId && draft.start.type === 'cinematic') {
      draft.start.type = 'scene';
      const rootScenes = (draft.scenes || []).filter((scene) => !scene.parentSceneId);
      draft.start.targetSceneId = draft.start.targetSceneId || rootScenes[0]?.id || draft.scenes?.[0]?.id || '';
    }
  }

  return nextSelectedCinematicId;
}
