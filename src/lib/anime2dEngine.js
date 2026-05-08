export function getAnime2dStepStart(step) {
  return Number(step?.at || 0);
}

export function sortAnime2dStepsByTime(steps = []) {
  return [...steps].sort((a, b) => getAnime2dStepStart(a) - getAnime2dStepStart(b));
}

export function normalizeAnime2dLayer(entry = {}) {
  const source = entry.layer && typeof entry.layer === 'object' ? entry.layer : {};
  return {
    ...source,
    ...entry,
    id: entry.id || source.id || '',
    name: entry.name || source.name || '',
    src: entry.src || entry.imageData || source.src || source.imageData || '',
    x: Number(entry.x ?? source.x ?? 50),
    y: Number(entry.y ?? source.y ?? 50),
    width: Number(entry.width ?? source.width ?? 28),
    height: Number(entry.height ?? source.height ?? (Number(entry.width ?? source.width ?? 28) * 1.6)),
    opacity: Number(entry.opacity ?? source.opacity ?? 100),
    preset: entry.preset || source.preset || 'none',
    duration: Number(entry.duration ?? source.duration ?? 1000),
    delay: Number(entry.delay ?? source.delay ?? 0),
    loop: entry.loop ?? source.loop ?? true,
    visible: entry.visible ?? source.visible ?? true,
    visibleAtStart: entry.visibleAtStart ?? source.visibleAtStart ?? false,
  };
}

export function normalizeAnime2dSpec(payload = {}) {
  if (payload?.kind !== 'escape-game-builder-2d-animation') return null;
  const layers = Array.isArray(payload.layers) ? payload.layers.map(normalizeAnime2dLayer).filter((layer) => layer.id) : [];
  return {
    version: payload.version || 1,
    kind: 'escape-game-builder-2d-animation',
    sceneName: payload.sceneName || 'Animation 2D',
    backdrop: payload.backdrop || payload.selectedBackdrop || 'room',
    canvas: payload.canvas || {
      aspectRatio: '16:10',
      width: 1600,
      height: 1000,
      clipOverflow: true,
    },
    cinematicSteps: Array.isArray(payload.cinematicSteps) ? payload.cinematicSteps.map((step, index) => ({
      id: step.id || `anime-step-${index + 1}`,
      at: Number(step.at || 0),
      duration: Number(step.duration || 2),
      narration: step.narration || '',
      mode: step.mode || 'scene',
      layerId: step.layerId || '',
      transition: step.transition || 'fade',
      exitTransition: step.exitTransition || 'fade',
    })) : [],
    layers,
  };
}

export function isAnime2dStepActive(step, time) {
  const start = getAnime2dStepStart(step);
  const duration = Math.max(0, Number(step.duration || 0));
  return time >= start && time < start + duration;
}

export function isAnime2dImageStep(step) {
  return ['add', 'replace'].includes(step.mode) && step.layerId;
}

export function getActiveAnime2dImageSteps(steps, time) {
  return steps.filter((step) => isAnime2dImageStep(step) && isAnime2dStepActive(step, time));
}

export function getVisibleAnime2dLayers(layers, steps, time) {
  const activeImageSteps = getActiveAnime2dImageSteps(steps, time);
  const replaceStep = [...activeImageSteps].reverse().find((step) => step.mode === 'replace');

  if (replaceStep) {
    return layers.filter((layer) => layer.visible !== false && layer.id === replaceStep.layerId);
  }

  const eventLayerIds = new Set(steps.filter(isAnime2dImageStep).map((step) => step.layerId));
  const baseLayers = layers.filter((layer) => (
    layer.visible !== false
    && !eventLayerIds.has(layer.id)
    && (layer.visibleAtStart === true || !layer.src)
  ));

  const addedLayers = activeImageSteps
    .filter((step) => step.mode === 'add')
    .map((step) => layers.find((layer) => layer.visible !== false && layer.id === step.layerId))
    .filter(Boolean);

  return [...baseLayers, ...addedLayers];
}

export function getAnime2dNarrationAtTime(steps, time) {
  const currentNarrationStep = [...steps]
    .reverse()
    .find((step) => String(step.narration || '').trim() && getAnime2dStepStart(step) <= time)
    || null;

  return String(currentNarrationStep?.narration || '').trim();
}

export function createAnime2dPreviewFrame(model, time) {
  return {
    visibleLayers: getVisibleAnime2dLayers(model.layers, model.steps, time),
    narration: getAnime2dNarrationAtTime(model.steps, time),
  };
}

export function createAnime2dPreviewModel(spec) {
  const normalizedSpec = normalizeAnime2dSpec(spec);
  const steps = sortAnime2dStepsByTime(Array.isArray(normalizedSpec?.cinematicSteps) ? normalizedSpec.cinematicSteps : []);
  const layers = Array.isArray(normalizedSpec?.layers) ? normalizedSpec.layers.map(normalizeAnime2dLayer) : [];
  const duration = Math.max(1, ...steps.map((step) => Number(step.at || 0) + Number(step.duration || 0)));

  return {
    hasValidSpec: Boolean(normalizedSpec),
    steps,
    layers,
    duration,
  };
}
