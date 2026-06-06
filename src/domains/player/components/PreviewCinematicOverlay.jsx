import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createAnime2dPreviewFrame,
  createAnime2dPreviewModel,
} from '../../../shared/services/anime2dEngine';
import { getCinematicPlaybackModel } from '../../../shared/services/cinematicEngine';
import { findAssetById, resolveAssetUrl } from '../../../shared/services/assetManager';

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

export default function PreviewCinematicOverlay({
  playingCinematic = null,
  playingSlideIndex = 0,
  currentSlide = null,
  project = {},
  audioRef,
  closeCinematic,
  advanceCinematic,
  setPlayingSlideIndex,
}) {
  const cinematicPlayback = useMemo(
    () => (playingCinematic ? getCinematicPlaybackModel(playingCinematic, playingSlideIndex || 0) : null),
    [playingCinematic, playingSlideIndex],
  );
  const displaySlide = cinematicPlayback?.currentSlide || currentSlide;

  if (!playingCinematic) return null;

  return (
    <div
      className="overlay preview-cinematic-overlay"
      data-testid="preview-cinematic-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) closeCinematic(); }}
    >
      <div className="overlay-card wide preview-cinematic-card">
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
        ) : displaySlide && (
          <>
            {displaySlide.imageData ? <img className="overlay-media" loading="eager" decoding="async" src={displaySlide.imageData} alt={displaySlide.imageName || displaySlide.narration || 'Cinématique'} /> : null}
            {displaySlide.audioData ? <audio ref={audioRef} autoPlay src={displaySlide.audioData} style={{ display: 'none' }} /> : null}
            <p className="narration">{displaySlide.narration}</p>
            <div className="panel-head">
              <button className="secondary-button" onClick={() => setPlayingSlideIndex((index) => Math.max(0, index - 1))}>Précédent</button>
              <button onClick={advanceCinematic}>Suivant</button>
              <button className="secondary-button" onClick={closeCinematic}>Terminer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
