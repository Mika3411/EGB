export const standaloneCinematicRender = `function renderCinematic(cinematic, slide) {
  if (!cinematic) return '';
  if (cinematic.cinematicType === 'anime2d') {
    const model = getAnime2dSpec(cinematic);
    const { layers, duration } = model;
    const time = Math.min(duration, getAnime2dElapsed(cinematic));
    const { visibleLayers, narration: frameNarration } = createAnime2dPreviewFrame(model, time);
    const fallbackNarration = cinematic.slides?.find((entry) => String(entry?.narration || '').trim())?.narration || '';
    const narration = frameNarration || fallbackNarration;

    return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card wide">'
      + '<div class="anime2d-player">'
      + (!layers.some((layer) => resolveAnime2dLayerSrc(layer)) ? '<p class="anime2d-player-empty">Aucune image embarquée dans ce JSON 2D Anime.</p>' : '')
      + visibleLayers.map((layer) => '<div class="anime2d-player-layer" style="left:' + cssNumber(layer.x, 50, -1000, 1000) + '%;top:' + cssNumber(layer.y, 50, -1000, 1000) + '%;width:' + cssNumber(layer.width, 28, 0, 1000) + '%;height:' + cssNumber(layer.height, (Number(layer.width) || 28) * 1.6, 0, 1000) + '%;opacity:' + cssNumber(Number(layer.opacity || 100) / 100, 1, 0, 1) + ';z-index:' + cssNumber(layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2, 2, 0, 1000) + '">'
        + '<span class="anime2d-embedded-animated anime2d-preset-' + safeClassToken(layer.preset || 'none', 'none') + '" style="animation-duration:' + cssNumber(layer.duration, 1000, 0, 600000) + 'ms;animation-delay:' + cssNumber(layer.delay, 0, -600000, 600000) + 'ms;animation-iteration-count:' + (layer.loop === false ? '1' : 'infinite') + '">'
        + (resolveAnime2dLayerSrc(layer) ? '<img src="' + escapeMediaAttr(resolveAnime2dLayerSrc(layer), 'image') + '" alt="' + escapeAttr(layer.name || '') + '" loading="eager" decoding="sync" />' : '')
        + '</span>'
        + '</div>').join('')
      + (narration ? '<p class="anime2d-player-narration">' + safeHtml(narration) + '</p>' : '')
      + '</div>'
      + '<p class="small-note">' + safeHtml(duration.toFixed(1)) + 's</p>'
      + '<div class="panel-head"><span></span><button id="close-cinematic" class="secondary-button">Terminer</button></div>'
      + '</div></div>';
  }
  if ((cinematic.cinematicType || 'slides') === 'video') {
    const videoSrc = resolveAssetUrl(cinematic.videoId, cinematic.videoData, 'video');
    return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
      + (videoSrc ?
         '<video id="cinematic-video" class="overlay-media" preload="auto" src="' + escapeMediaAttr(videoSrc, 'video') + '" '
          + (cinematic.videoControls === false ? '' : 'controls ') + (cinematic.videoAutoplay === false ? '' : 'autoplay ')
          + '></video>'
        : '<p class="small-note">Ajoute une vidéo dans l’éditeur de cinematic.</p>')
      + '<p class="narration">' + safeHtml(cinematic.name || 'Cinématique') + '</p>'
      + '<div class="panel-head"><span></span><button id="close-cinematic">Terminer</button></div></div></div>';
  }

  if (!slide) return '';
  const slideImageSrc = resolveAssetUrl(slide.imageId, slide.imageData, 'image');
  const slideAudioSrc = resolveAssetUrl(slide.audioId, slide.audioData, 'audio');

  return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
    + (slideImageSrc ? '<img class="overlay-media" loading="eager" decoding="async" src="' + escapeMediaAttr(slideImageSrc, 'image') + '" alt="' + escapeAttr(slide.imageName || slide.narration || 'Cinématique') + '" />' : '')
    + (slideAudioSrc ? '<audio id="cinematic-audio" autoplay src="' + escapeMediaAttr(slideAudioSrc, 'audio') + '" style="display:none"></audio>' : '')
    + '<p class="narration">' + safeHtml(slide.narration || '') + '</p>'
    + '<div class="panel-head">'
    + '<button id="prev-cinematic" class="secondary-button">Précédent</button>'
    + '<button id="advance-cinematic">Suivant</button>'
    + '<button id="close-cinematic" class="secondary-button">Terminer</button>'
    + '</div></div></div>';
}

`;
