import { useEffect, useMemo, useState } from 'react';
import {
  createAnime2dPreviewFrame,
  createAnime2dPreviewModel,
  normalizeAnime2dLayer,
  normalizeAnime2dSpec,
} from '../lib/anime2dEngine';
import { findAssetById, resolveAssetUrl } from '../lib/assetManager';

const PREVIEW_TIME_PRECISION = 1000;

const normalizePreviewTime = (time) => Math.round(Math.max(0, Number(time || 0)) * PREVIEW_TIME_PRECISION) / PREVIEW_TIME_PRECISION;

export const readAnime2dJsonFile = async (file) => {
  const payload = JSON.parse(await file.text());
  const spec = normalizeAnime2dSpec(payload);
  if (!spec) throw new Error('JSON 2D Anime invalide.');
  return spec;
};

export { createAnime2dPreviewFrame, createAnime2dPreviewModel, normalizeAnime2dLayer, normalizeAnime2dSpec };

const resolveLayerSrc = (project, layer) => {
  const rawSrc = layer?.src || layer?.imageData || layer?.layer?.src || layer?.layer?.imageData || '';
  const sourceProject = project || {};
  const assetId = layer?.assetId || layer?.imageId || layer?.srcId || (findAssetById(sourceProject, rawSrc) ? rawSrc : '');
  return resolveAssetUrl(sourceProject, assetId, rawSrc);
};

const createTimelineMarkers = (steps, duration) => {
  const timelineMarkers = [...new Set([
    0,
    ...steps.flatMap((step) => [
      normalizePreviewTime(step.at),
      normalizePreviewTime(Number(step.at || 0) + Number(step.duration || 0)),
    ]),
    duration,
  ])]
    .filter((marker) => marker >= 0 && marker <= duration)
    .sort((a, b) => a - b);
  return timelineMarkers;
};

export default function Anime2DPreview({ spec, project = null, className = '', showNarration = false, loop = true }) {
  const previewModel = useMemo(() => createAnime2dPreviewModel(spec), [spec]);
  const { hasValidSpec, steps, layers, duration } = previewModel;
  const timelineMarkers = useMemo(() => createTimelineMarkers(steps, duration), [steps, duration]);
  const layerZIndexes = useMemo(() => new Map(layers.map((layer, index) => [layer.id, layers.length - index + 2])), [layers]);
  const [time, setTime] = useState(0);

  useEffect(() => {
    setTime(0);
    const startedAt = performance.now();
    let timer = null;

    const scheduleNextMarker = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const currentTime = normalizePreviewTime(loop ? elapsed % duration : Math.min(duration, elapsed));
      setTime(currentTime);

      if (!loop && currentTime >= duration) return;

      const nextMarker = timelineMarkers.find((marker) => marker > currentTime);
      const secondsUntilNextMarker = nextMarker === undefined
        ? duration - currentTime
        : nextMarker - currentTime;
      const delay = Math.max(16, secondsUntilNextMarker * 1000);
      timer = window.setTimeout(scheduleNextMarker, delay);
    };

    scheduleNextMarker();
    return () => window.clearTimeout(timer);
  }, [duration, loop, timelineMarkers]);

  const { visibleLayers, narration } = useMemo(() => createAnime2dPreviewFrame(previewModel, time), [previewModel, time]);

  return (
    <span className={`anime2d-embedded ${className}`}>
      {!hasValidSpec || !layers.some((layer) => resolveLayerSrc(project, layer)) ? (
        <span className="anime2d-embedded-empty">JSON 2D</span>
      ) : null}
      {visibleLayers.map((layer) => {
        const layerSrc = resolveLayerSrc(project, layer);
        return (
          <span
            key={layer.id}
            className="anime2d-embedded-layer"
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
          </span>
        );
      })}
      {showNarration && narration ? <span className="anime2d-embedded-narration">{narration}</span> : null}
    </span>
  );
}
