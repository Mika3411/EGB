import { useEffect, useMemo, useState } from 'react';

const getStepStart = (step) => Number(step?.at || 0);

const sortStepsByTime = (steps = []) => [...steps].sort((a, b) => getStepStart(a) - getStepStart(b));

export const normalizeAnime2dLayer = (entry = {}) => {
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
};

export const normalizeAnime2dSpec = (payload = {}) => {
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
};

export const readAnime2dJsonFile = async (file) => {
  const payload = JSON.parse(await file.text());
  const spec = normalizeAnime2dSpec(payload);
  if (!spec) throw new Error('JSON 2D Anime invalide.');
  return spec;
};

const isStepActive = (step, time) => {
  const start = getStepStart(step);
  const duration = Math.max(0, Number(step.duration || 0));
  return time >= start && time < start + duration;
};

export default function Anime2DPreview({ spec, className = '', showNarration = false, loop = true }) {
  const normalizedSpec = useMemo(() => normalizeAnime2dSpec(spec) || spec || {}, [spec]);
  const steps = useMemo(() => sortStepsByTime(Array.isArray(normalizedSpec.cinematicSteps) ? normalizedSpec.cinematicSteps : []), [normalizedSpec]);
  const layers = useMemo(() => (Array.isArray(normalizedSpec.layers) ? normalizedSpec.layers.map(normalizeAnime2dLayer) : []), [normalizedSpec]);
  const duration = Math.max(1, ...steps.map((step) => Number(step.at || 0) + Number(step.duration || 0)));
  const [time, setTime] = useState(0);

  useEffect(() => {
    setTime(0);
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setTime(loop ? elapsed % duration : Math.min(duration, elapsed));
    }, 80);
    return () => window.clearInterval(timer);
  }, [duration, loop]);

  const imageSteps = steps.filter((step) => ['add', 'replace'].includes(step.mode) && step.layerId && isStepActive(step, time));
  const replaceStep = [...imageSteps].reverse().find((step) => step.mode === 'replace');
  const eventLayerIds = new Set(steps.filter((step) => ['add', 'replace'].includes(step.mode) && step.layerId).map((step) => step.layerId));
  const baseLayers = layers.filter((layer) => layer.visible !== false && !eventLayerIds.has(layer.id) && (layer.visibleAtStart === true || !layer.src));
  const visibleLayers = replaceStep
    ? layers.filter((layer) => layer.visible !== false && layer.id === replaceStep.layerId)
    : [
        ...baseLayers,
        ...imageSteps
          .filter((step) => step.mode === 'add')
          .map((step) => layers.find((layer) => layer.visible !== false && layer.id === step.layerId))
          .filter(Boolean),
      ];
  const currentNarrationStep = [...steps]
    .reverse()
    .find((step) => String(step.narration || '').trim() && getStepStart(step) <= time)
    || null;
  const narration = String(currentNarrationStep?.narration || '').trim();

  return (
    <span className={`anime2d-embedded ${className}`}>
      {!layers.some((layer) => layer.src) ? (
        <span className="anime2d-embedded-empty">JSON 2D</span>
      ) : null}
      {visibleLayers.map((layer) => (
        <span
          key={layer.id}
          className="anime2d-embedded-layer"
          style={{
            left: `${layer.x || 50}%`,
            top: `${layer.y || 50}%`,
            width: `${layer.width || 28}%`,
            height: `${layer.height || ((layer.width || 28) * 1.6)}%`,
            opacity: Number(layer.opacity || 100) / 100,
            zIndex: layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2,
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
            {layer.src ? <img src={layer.src} alt={layer.name || ''} /> : null}
          </span>
        </span>
      ))}
      {showNarration && narration ? <span className="anime2d-embedded-narration">{narration}</span> : null}
    </span>
  );
}
