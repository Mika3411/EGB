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
      + visibleLayers.map((layer) => '<div class="anime2d-player-layer" style="left:' + safeHtml(layer.x || 50) + '%;top:' + safeHtml(layer.y || 50) + '%;width:' + safeHtml(layer.width || 28) + '%;height:' + safeHtml(layer.height || ((layer.width || 28) * 1.6)) + '%;opacity:' + safeHtml(Number(layer.opacity || 100) / 100) + ';z-index:' + safeHtml(layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2) + '">'
        + '<span class="anime2d-embedded-animated anime2d-preset-' + safeHtml(layer.preset || 'none') + '" style="animation-duration:' + safeHtml(layer.duration || 1000) + 'ms;animation-delay:' + safeHtml(layer.delay || 0) + 'ms;animation-iteration-count:' + (layer.loop === false ? '1' : 'infinite') + '">'
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

export const standaloneRender = `function getCombatActorMedia(entry, combat, actor, fallbackImage = '') {
  const entryPrefix = actor === 'hero' ? 'combatHero' : 'combatEnemy';
  const globalPrefix = actor;
  const mediaType = getCombatEntryValue(entry, entryPrefix + 'MediaType', combat?.[globalPrefix + 'MediaType'] || 'image');
  return {
    mediaType: mediaType === 'anime2d' ? 'anime2d' : 'image',
    imageData: resolveAssetUrl(entry?.[entryPrefix + 'ImageId'], entry?.[entryPrefix + 'ImageData'] || combat?.[globalPrefix + 'ImageData'] || fallbackImage || ''),
    anime2dSpec: entry?.[entryPrefix + 'Anime2dSpec'] || combat?.[globalPrefix + 'Anime2dSpec'] || null,
  };
}

function getStandaloneCombatEffectFieldBase(actor, outcome) {
  return actor + (outcome === 'death' ? 'Death' : 'Hit') + 'Effect';
}

function getStandaloneCombatEffectMedia(target, outcome) {
  const combatSettings = getStandaloneCombatSettings();
  const base = getStandaloneCombatEffectFieldBase(target, outcome);
  const mediaType = ['none', 'visual', 'image', 'anime2d', 'video'].includes(combatSettings[base + 'MediaType'])
    ? combatSettings[base + 'MediaType']
    : 'none';
  const visualEffect = ['none', 'shake', 'fire', 'lightning', 'wave', 'rockfall', 'horizontal-spin'].includes(combatSettings[base + 'VisualEffect'])
    ? combatSettings[base + 'VisualEffect']
    : 'none';
  const audioData = safeMediaUrl(combatSettings[base + 'AudioData'] || '', 'audio');
  const audioName = combatSettings[base + 'AudioName'] || '';
  const withAudio = (media) => (audioData ? { ...media, audioData, audioName } : media);
  if (mediaType === 'image' && combatSettings[base + 'ImageData']) {
    return withAudio({ mediaType, imageData: resolveAssetUrl('', combatSettings[base + 'ImageData'], 'image'), name: combatSettings[base + 'ImageName'] || '' });
  }
  if (mediaType === 'anime2d' && combatSettings[base + 'Anime2dSpec']) {
    return withAudio({ mediaType, anime2dSpec: combatSettings[base + 'Anime2dSpec'], name: combatSettings[base + 'Anime2dName'] || '' });
  }
  if (mediaType === 'video' && combatSettings[base + 'VideoData']) {
    return withAudio({ mediaType, videoData: safeMediaUrl(combatSettings[base + 'VideoData'], 'video'), name: combatSettings[base + 'VideoName'] || '' });
  }
  if (mediaType === 'visual' && visualEffect !== 'none') {
    return withAudio({ mediaType, visualEffect });
  }
  return audioData ? { mediaType: 'none', audioData, audioName } : null;
}

function makeCombatVisualEffect(target, type, text, media = null) {
  return {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    target,
    type,
    text,
    media,
  };
}

function makeCombatOutcomeEffect(target, outcome, text) {
  return makeCombatVisualEffect(
    target,
    outcome === 'death' ? 'death' : 'damage',
    text,
    getStandaloneCombatEffectMedia(target, outcome)
  );
}

function renderCombatEffectMedia(effect) {
  const media = effect?.media;
  if (!media) return '';
  const audio = media.audioData
    ? '<audio autoplay preload="auto" src="' + escapeMediaAttr(media.audioData, 'audio') + '" style="display:none"></audio>'
    : '';
  if (media.mediaType === 'image' && media.imageData) {
    return '<span class="hero-combat-fx-media"><img src="' + escapeMediaAttr(media.imageData, 'image') + '" alt="' + escapeAttr(media.name || 'Impact') + '" /></span>' + audio;
  }
  if (media.mediaType === 'video' && media.videoData) {
    return '<span class="hero-combat-fx-media"><video src="' + escapeMediaAttr(media.videoData, 'video') + '" autoplay muted playsinline></video></span>' + audio;
  }
  if (media.mediaType === 'anime2d' && media.anime2dSpec) {
    return '<span class="hero-combat-fx-media">' + renderAnime2dEmbedded(media.anime2dSpec, 0) + '</span>' + audio;
  }
  if (media.mediaType === 'visual' && media.visualEffect && media.visualEffect !== 'none') {
    return '<span class="hero-combat-fx-visual hero-combat-fx-visual--' + safeHtml(media.visualEffect) + '"></span>' + audio;
  }
  return audio;
}

function renderCombatVisualEffects(effects = []) {
  const list = Array.isArray(effects) ? effects.filter(Boolean) : [];
  if (!list.length) return '';
  return '<div class="hero-combat-fx-layer">'
    + list.map((effect) => '<span class="hero-combat-fx hero-combat-fx--' + safeHtml(effect.type || 'damage') + (effect.media ? ' hero-combat-fx--has-media' : '') + '">'
      + renderCombatEffectMedia(effect)
      + '<span class="hero-combat-fx-text">' + safeHtml(effect.text || '') + '</span></span>').join('')
    + '</div>';
}

function combatBarPercent(value, maxValue) {
  const max = Math.max(1, Number(maxValue) || 1);
  return Math.max(0, Math.min(100, Math.round(((Number(value) || 0) / max) * 100)));
}

function renderCombatActor(media, label, actor, stats = {}) {
  const health = Math.max(0, Number(stats.health) || 0);
  const maxHealth = Math.max(1, Number(stats.maxHealth) || 1);
  const mana = Math.max(0, Number(stats.mana) || 0);
  const maxMana = Math.max(0, Number(stats.maxMana) || 0);
  const mediaBody = media?.mediaType === 'anime2d' && media.anime2dSpec
    ? renderAnime2dEmbedded(media.anime2dSpec, 0)
    : media?.imageData
      ? '<img src="' + escapeMediaAttr(media.imageData, 'image') + '" alt="' + escapeAttr(label) + '" />'
      : '<span>' + safeHtml(String(label || actor || '?').slice(0, 1).toUpperCase()) + '</span>';
  return '<div class="hero-combat-actor hero-combat-actor--' + safeHtml(actor) + '">'
    + '<div class="hero-combat-actor-bars">'
    + '<span class="hero-combat-actor-bar hero-combat-actor-bar--health" title="' + safeHtml(health + '/' + maxHealth + ' PV') + '"><i style="width:' + combatBarPercent(health, maxHealth) + '%"></i></span>'
    + (maxMana > 0 ? '<span class="hero-combat-actor-bar hero-combat-actor-bar--mana" title="' + safeHtml(mana + '/' + maxMana + ' mana') + '"><i style="width:' + combatBarPercent(mana, maxMana) + '%"></i></span>' : '')
    + '</div>'
    + '<div class="hero-combat-actor-media">' + mediaBody + '</div>'
    + '<strong>' + safeHtml(label) + '</strong>'
    + '</div>';
}

function renderHeroCombatOverlay() {
  const combat = state.activeHeroCombat;
  if (!combat || !IS_HERO_ADVENTURE) return '';
  const entry = combat.entry || {};
  const combatSettings = getStandaloneCombatSettings();
  const playScene = getPlayScene();
  const playSceneBackgroundUrl = resolveAssetUrl(playScene?.backgroundId, playScene?.backgroundData);
  const backgroundImageData = entry.combatBackgroundImageData || combatSettings.backgroundImageData || playSceneBackgroundUrl || '';
  const backgroundImage = backgroundImageData ? cssMediaUrl(backgroundImageData, 'image') : '';
  const overlayStyle = backgroundImage ? ' style="background-image:linear-gradient(180deg,rgba(2,6,23,.18),rgba(2,6,23,.86)), ' + backgroundImage + '"' : '';
  const hero = state.heroState || getInitialHeroState();
  const heroLabel = hero.name || 'Héros';
  const enemyLabel = combat.enemyName || entry.combatEnemyName || combatSettings.enemyName || 'Ennemi';
  const heroMedia = getCombatActorMedia(entry, combatSettings, 'hero', hero.characterImageData || '');
  const enemyMedia = getCombatActorMedia(entry, combatSettings, 'enemy');
  const enemyMaxHealth = Math.max(1, Number(combat.enemyMaxHealth) || Number(entry.combatEnemyMaxHealth) || 1);
  const enemyHealth = Math.max(0, Math.min(enemyMaxHealth, Number(combat.enemyHealth) || 0));
  const enemyMaxMana = Math.max(0, Number(combat.enemyMaxMana) || Number(entry.combatEnemyMaxMana) || Number(combatSettings.enemyMaxMana) || 0);
  const enemyMana = Math.max(0, Math.min(enemyMaxMana, Number(combat.enemyMana) || 0));
  const heroMaxHealth = Math.max(1, Number(hero.maxHealth) || 1);
  const heroHealth = Math.max(0, Math.min(heroMaxHealth, Number(hero.health) || 0));
  const heroMaxMana = Math.max(0, Number(hero.maxMana) || 0);
  const heroMana = Math.max(0, Math.min(heroMaxMana, Number(hero.mana) || 0));
  const heroPowers = Array.isArray(hero.powers) ? hero.powers : [];
  const combatManaCost = Math.max(0, Number(entry.combatManaCost) || 0);
  const selectedPower = heroPowers.find((power) => power.id === state.selectedHeroCombatPowerId) || null;
  const selectedPowerMissing = Boolean(state.selectedHeroCombatPowerId && !selectedPower);
  const selectedPowerManaCost = selectedPower ? Math.max(0, Number(selectedPower.manaCost) || 0) : 0;
  const selectedManaCost = combatManaCost + selectedPowerManaCost;
  const manaUnavailable = selectedManaCost > heroMana;
  const isEnded = ['victory', 'defeat', 'ended'].includes(combat.status);
  const isEnemyTurn = combat.phase === 'enemy';
  const isSurvivalTurn = combat.phase === 'survival';
  const showDice = getCombatEntryValue(entry, 'combatShowDice', combatSettings.showDice !== false) !== false;
  const lastCombatRoll = combat.lastEnemyRoll || combat.lastRoll || (['hero_combat', 'enemy_combat', 'hero_combat_escape', 'hero_combat_survival'].includes(state.lastDiceRoll?.actionType) ? state.lastDiceRoll : null);
  const actionLabel = isSurvivalTurn
    ? 'Lancer Survie'
    : isEnemyTurn
    ? 'Lancer le dé ennemi'
    : selectedPower
      ? 'Utiliser ' + (selectedPower.name || 'Pouvoir')
      : 'Attaque normale';
  const actionDisabled = isEnded || (!isEnemyTurn && !isSurvivalTurn && (selectedPowerMissing || manaUnavailable));

  return '<div class="hero-combat-overlay hero-combat-overlay--' + safeHtml(combat.status || 'active') + (isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : '') + '"' + overlayStyle + '>'
    + '<div class="hero-combat-topline"><span>' + safeHtml(isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : 'Tour ' + (combat.round || 1)) + '</span><strong>' + safeHtml(enemyLabel) + '</strong><button id="close-hero-combat" type="button" class="secondary-action compact"' + (!isEnded && (isEnemyTurn || isSurvivalTurn) ? ' disabled' : '') + '>' + safeHtml(isEnded ? 'Fermer' : 'Fuir') + '</button></div>'
    + '<div class="hero-combat-stage">'
    + renderCombatActor(heroMedia, heroLabel, 'hero', { health: heroHealth, maxHealth: heroMaxHealth, mana: heroMana, maxMana: heroMaxMana })
    + (showDice ? '<div class="hero-combat-dice-spotlight"><button id="hero-combat-action" type="button" class="hero-combat-die-button"' + (actionDisabled ? ' disabled' : '') + '><span class="hero-combat-die"><span>' + safeHtml(lastCombatRoll?.raw || '?') + '</span></span></button><strong>' + safeHtml(lastCombatRoll ? lastCombatRoll.total + ' total' : project?.heroAdventure?.dice?.label || 'Dé') + '</strong><small>' + safeHtml(isEnded ? 'Combat terminé' : actionLabel) + '</small></div>' : '<div></div>')
    + renderCombatActor(enemyMedia, enemyLabel, 'enemy', { health: enemyHealth, maxHealth: enemyMaxHealth, mana: enemyMana, maxMana: enemyMaxMana })
    + '</div>'
    + renderCombatVisualEffects(combat.visualEffects)
    + '<div class="hero-combat-hud">'
    + '<div class="hero-combat-meter"><span>' + safeHtml(heroLabel) + '</span><strong>' + heroHealth + '/' + heroMaxHealth + ' PV</strong><i style="width:' + combatBarPercent(heroHealth, heroMaxHealth) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--hero-mana"><span>Mana héros</span><strong>' + heroMana + '/' + heroMaxMana + '</strong><i style="width:' + combatBarPercent(heroMana, Math.max(1, heroMaxMana)) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--enemy"><span>' + safeHtml(enemyLabel) + '</span><strong>' + enemyHealth + '/' + enemyMaxHealth + ' PV</strong><i style="width:' + combatBarPercent(enemyHealth, enemyMaxHealth) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--mana"><span>Mana ennemi</span><strong>' + enemyMana + '/' + enemyMaxMana + '</strong><i style="width:' + combatBarPercent(enemyMana, Math.max(1, enemyMaxMana)) + '%"></i></div>'
    + '</div>'
    + '<div class="hero-combat-log"><p>' + safeHtml(combat.message || 'Le combat commence.') + '</p>'
    + (!isEnemyTurn && !isSurvivalTurn && !isEnded ? '<div class="hero-combat-action-choice">'
      + '<button type="button" class="hero-combat-action-choice-button ' + (!state.selectedHeroCombatPowerId ? 'active' : '') + '" data-hero-combat-power=""><strong>Attaque normale</strong><span>' + combatManaCost + ' mana</span></button>'
      + heroPowers.map((power) => {
        const manaCost = Math.max(0, Number(power.manaCost) || 0);
        const totalManaCost = combatManaCost + manaCost;
        const disabled = totalManaCost > heroMana;
        return '<button type="button" class="hero-combat-action-choice-button ' + (state.selectedHeroCombatPowerId === power.id ? 'active' : '') + '" data-hero-combat-power="' + safeHtml(power.id || '') + '"' + (disabled ? ' disabled title="Mana insuffisante"' : '') + '><strong>' + safeHtml(power.name || 'Pouvoir') + '</strong><span>' + safeHtml((getPowerTypeLabel(power.type) || power.type || 'Pouvoir') + ' · ' + totalManaCost + ' mana · ' + (power.force || 0)) + '</span></button>';
      }).join('')
      + '</div>' : '')
    + '<div class="inline-actions"><button id="hero-combat-action" type="button"' + (actionDisabled ? ' disabled' : '') + '>' + safeHtml(actionLabel) + '</button><button id="close-hero-combat" type="button" class="secondary-action"' + (!isEnded && (isEnemyTurn || isSurvivalTurn) ? ' disabled' : '') + '>' + safeHtml(isEnded ? 'Revenir à la scène' : 'Fuir') + '</button></div>'
    + '</div></div>';
}

function renderHeroSetupOverlay() {
  if (!IS_HERO_ADVENTURE || state.heroSetupComplete) return '';
  const hero = state.heroState || getInitialHeroState();
  const heroChoices = getHeroChoices();
  const hasRolledSkills = (hero.skills || []).some((skill) => Number(skill.rolledValue) > 0);
  const showCharacterGallery = !state.heroSetupSelectionConfirmed && !hasRolledSkills;
  const galleryIndex = getStandaloneHeroGalleryIndex();
  const activeChoice = heroChoices[galleryIndex] || hero || {};
  const activeSkills = (activeChoice.skills || []).slice(0, 4);
  const activePortrait = resolveAssetUrl(activeChoice.characterImageId, activeChoice.characterImageData) || activeChoice.characterImageData || '';
  const backgroundImage = safeMediaUrl(hero.setupBackgroundImageData || '', 'image');
  const setupStyle = backgroundImage ? ' style="background-image:linear-gradient(180deg,rgba(8,16,30,.44),rgba(8,16,30,.74)),url(' + escapeAttr(backgroundImage) + ')"' : '';
  return '<div class="hero-setup-overlay"><div class="hero-setup-card' + (backgroundImage ? ' has-hero-setup-background' : '') + '"' + setupStyle + '>'
    + '<span class="eyebrow">' + safeHtml(showCharacterGallery ? 'Choix du héros' : 'Création du héros') + '</span>'
    + '<h2>' + safeHtml(showCharacterGallery ? 'Choisis ton personnage' : hero.name || 'Héros') + '</h2>'
    + '<p>' + safeHtml(showCharacterGallery ? 'Parcours les fiches, compare le profil et valide ton héros avant de lancer les compétences.' : 'Lance les dés de départ. Chaque compétence garde sa base et ajoute 1d6.') + '</p>'
    + (showCharacterGallery ? '<div class="hero-setup-gallery">'
      + '<button type="button" class="hero-setup-gallery-arrow" data-hero-gallery-shift="-1"' + (heroChoices.length < 2 ? ' disabled' : '') + ' aria-label="Fiche précédente">&lt;</button>'
      + '<article class="hero-setup-profile-card">'
      + '<div class="hero-setup-profile-portrait">' + (activePortrait ? '<img src="' + escapeMediaAttr(activePortrait, 'image') + '" alt="' + escapeAttr(activeChoice.name || 'Héros') + '" />' : '<span>' + safeHtml(String(activeChoice.name || 'H').trim().slice(0, 1).toUpperCase()) + '</span>') + '</div>'
      + '<div class="hero-setup-profile-content">'
      + '<span class="hero-setup-profile-count">' + safeHtml(String(galleryIndex + 1)) + '/' + safeHtml(String(Math.max(1, heroChoices.length))) + '</span>'
      + '<h3>' + safeHtml(activeChoice.name || 'Héros') + '</h3>'
      + '<p class="hero-setup-character-description">' + safeHtml(String(activeChoice.description || '').trim() || 'Aucun descriptif renseigné pour ce personnage.') + '</p>'
      + '<div class="hero-setup-stat-grid">'
      + '<span><strong>' + safeHtml(activeChoice.health ?? activeChoice.maxHealth ?? 0) + '/' + safeHtml(activeChoice.maxHealth ?? activeChoice.health ?? 0) + '</strong><small>PV</small></span>'
      + '<span><strong>' + safeHtml(activeChoice.mana ?? activeChoice.maxMana ?? 0) + '/' + safeHtml(activeChoice.maxMana ?? activeChoice.mana ?? 0) + '</strong><small>Mana</small></span>'
      + '<span><strong>' + safeHtml(activeChoice.armor ?? 0) + '</strong><small>Armure</small></span>'
      + '<span><strong>' + safeHtml(activeChoice.initiative ?? 0) + '</strong><small>Initiative</small></span>'
      + '<span><strong>' + safeHtml(activeChoice.dodgeChance ?? 0) + '%</strong><small>Esquive</small></span>'
      + '<span><strong>' + safeHtml(activeChoice.rules?.criticalChance ?? project?.heroAdventure?.rules?.criticalChance ?? 0) + '%</strong><small>Critique</small></span>'
      + '</div>'
      + '<div class="hero-setup-skill-preview">'
      + (activeSkills.length ? activeSkills.map((skill) => '<span><strong>' + safeHtml(skill.name || 'Compétence') + '</strong><small>' + safeHtml(skill.value ?? 0) + '</small></span>').join('') : '<span><strong>Force</strong><small>0</small></span>')
      + '</div>'
      + '</div></article>'
      + '<button type="button" class="hero-setup-gallery-arrow" data-hero-gallery-shift="1"' + (heroChoices.length < 2 ? ' disabled' : '') + ' aria-label="Fiche suivante">&gt;</button>'
      + '</div>'
      + '<div class="hero-setup-actions"><button type="button" data-hero-select="' + escapeAttr(activeChoice.id || '') + '">Sélectionner ce personnage</button></div>'
      : '<div class="hero-setup-skill-grid">'
        + (hero.skills || []).map((skill) => '<div class="' + (skill.rolledValue ? 'is-rolled' : '') + '"><span>' + safeHtml(skill.name || 'Compétence') + '</span><strong>' + (skill.rolledValue ? '+' + safeHtml(skill.value) : '-') + '</strong><small>' + (skill.rolledValue ? 'Base ' + safeHtml(skill.baseValue ?? 0) + ' + jet ' + safeHtml(skill.rolledValue) : 'À tirer') + '</small></div>').join('')
        + '</div>'
        + '<div class="hero-setup-actions">'
        + (!hasRolledSkills ? '<button id="hero-setup-change-character" type="button" class="secondary-action">Changer de personnage</button>' : '')
        + '<button id="hero-setup-roll" type="button" class="secondary-action">Tirer les compétences</button>'
        + '<button id="hero-setup-start" type="button"' + (!hasRolledSkills ? ' disabled' : '') + '>Commencer l’aventure</button>'
        + '</div>')
    + '</div></div>';
}

function renderAdventureStateSummary() {
  const variableEntries = Object.entries(state.storyVariables || {}).filter(([key]) => {
    const variable = (project.storyVariables || []).find((entry) => entry.key === key);
    return variable ? variable.journalVisible !== false : true;
  });
  const journalEntries = Array.isArray(state.adventureJournalEntries) ? state.adventureJournalEntries : [];
  const activeEndingCount = state.activeEnding ? 1 : 0;
  return '<div class="adventure-state-card"><strong>Progression narrative</strong>'
    + '<div class="adventure-state-grid">'
    + '<span><strong>' + safeHtml(String(state.chosenConversationReplyIds?.length || 0)) + '</strong> choix</span>'
    + '<span><strong>' + safeHtml(String(state.completedHotspotIds?.length || 0)) + '</strong> actions</span>'
    + '<span><strong>' + safeHtml(String(variableEntries.length)) + '</strong> variables</span>'
    + '<span><strong>' + safeHtml(String(activeEndingCount)) + '</strong> fin</span>'
    + '</div>'
    + '<div class="adventure-state-list">'
    + (variableEntries.length
      ? variableEntries.map(([key, value]) => '<span><strong>' + safeHtml(getStoryVariableJournalLabel(key)) + '</strong> = ' + safeHtml(String(value)) + '</span>').join('')
      : '<span>Aucune variable d’histoire modifiée.</span>')
    + (state.activeEnding ? '<span><strong>Fin active</strong> = ' + safeHtml(state.activeEnding.title || state.activeEnding.label || 'Fin') + '</span>' : '')
    + '</div></div>'
    + '<div class="adventure-journal-card"><strong>Journal joueur</strong><div class="adventure-journal-grid">'
    + '<section><strong>Historique</strong><div class="adventure-journal-list">'
    + (journalEntries.length
      ? journalEntries.slice(0, 4).map((entry) => '<span><strong>' + safeHtml(entry.title || 'Note') + '</strong>' + (entry.detail ? '<small>' + safeHtml(entry.detail) + '</small>' : '') + '</span>').join('')
      : '<span>Aucun choix important note.</span>')
    + '</div></section><section><strong>Indices et état</strong><div class="adventure-state-list">'
    + (state.inventory?.length
      ? state.inventory.slice(0, 4).map((itemId) => '<span>' + safeHtml(getJournalItemLabel(itemId)) + '</span>').join('')
      : '<span>Aucun indice obtenu.</span>')
    + (variableEntries.length
      ? variableEntries.map(([key, value]) => '<span><strong>' + safeHtml(getStoryVariableJournalLabel(key)) + '</strong> = ' + safeHtml(String(value)) + '</span>').join('')
      : '')
    + '</div></section></div></div>';
}

function render(shouldSave = true) {
  const playScene = getPlayScene();
  const cinematic = getCurrentCinematic();
  const currentSlide = getCurrentSlide();
  const enigma = state.activeEnigma?.enigma || null;
  const sceneAspectRatio = Number(playScene?.backgroundAspectRatio) > 0 ? Number(playScene.backgroundAspectRatio) : 1.6;
  const playSceneBackgroundUrl = resolveAssetUrl(playScene?.backgroundId, playScene?.backgroundData);
  const viewerImageSrc = safeMediaUrl(state.viewerImage?.src, 'image');
  const transitionSceneBackgroundUrl = resolveAssetUrl(state.sceneTransitionOverlay?.scene?.backgroundId, state.sceneTransitionOverlay?.scene?.backgroundData);
  const inventoryDrawerTitle = project?.heroAdventure?.enabled ? GAME_TITLE : IS_CHOICE_ADVENTURE ? 'Carnet d’aventure' : 'Inventaire';
  if (!hasRenderedOnce && !loadedActId) loadedActId = playScene?.actId || '';

  root.innerHTML = '<div class="player-shell is-shared-player ' + (IS_CHOICE_ADVENTURE ? 'is-choice-adventure ' : '') + 'player-button-style-' + safeHtml(PLAYER_BUTTON_STYLE) + ' player-button-font-' + safeHtml(PLAYER_BUTTON_FONT) + ' player-narration-font-' + safeHtml(PLAYER_NARRATION_FONT) + ' ' + (state.showInteractionHints ? 'show-hints' : 'hide-hints') + ' ' + (state.controlsVisible ? '' : 'controls-hidden') + '" style="--player-narration-bg:' + safeHtml(PLAYER_NARRATION_BACKGROUND) + '">'
    + '<section class="panel player-stage-panel">'
    + '<div class="player-topbar">'
    + '<div><span class="eyebrow">Player</span><strong>' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</strong></div>'
    + '<div class="player-actions">'
    + '<button id="pause-game" type="button" class="secondary-action">Pause</button>'
    + '<button id="reset-preview" type="button" class="secondary-action player-reset-button">Recommencer</button>'
    + '<button id="save-game" type="button" class="secondary-action">Sauvegarder</button>'
    + '<button id="load-game" type="button" class="secondary-action">Charger</button>'
    + '<button id="toggle-hints" type="button" class="secondary-action">' + (state.showInteractionHints ? 'Sans aide' : 'Aide visuelle') + '</button>'
    + '<button id="fullscreen-toggle" type="button" class="secondary-action">Plein écran</button>'
    + '</div></div>'
    + '<div class="scene-player" id="scene-layer" style="--scene-aspect:' + sceneAspectRatio + '">'
    + (playSceneBackgroundUrl ?
'<img class="bg" src="' + escapeMediaAttr(playSceneBackgroundUrl, 'image') + '" alt="' + escapeAttr(playScene.name || 'Scène') + '" onload="setSceneAspectFromImage(this)" />'
      : '<div class="placeholder">Ajoute un fond pour jouer la scène.</div>')
    + (playScene?.visualEffect && playScene.visualEffect !== 'none' ? '<div class="scene-visual-effect scene-visual-effect--' + safeHtml(playScene.visualEffect) + ' scene-visual-effect--' + safeHtml(playScene.visualEffectIntensity || 'normal') + '"></div>' : '')
    + (playScene?.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => '<div class="scene-visual-effect scene-visual-effect-zone scene-visual-effect--' + safeHtml(zone.effect || 'sparkles') + ' scene-visual-effect--' + safeHtml(zone.intensity || 'normal') + '" style="left:' + zone.x + '%;top:' + zone.y + '%;width:' + zone.width + '%;height:' + zone.height + '%;z-index:' + getVisualEffectZoneZIndex(zone.layer) + ';' + getElementShapeStyle(zone) + '"></div>').join('')
    + (playScene?.hotspots || []).map((spot) => '<button type="button" class="player-hotspot" data-hotspot-id="' + spot.id + '" '
      + 'style="left:' + spot.x + '%;top:' + spot.y + '%;width:' + spot.width + '%;height:' + spot.height + '%;z-index:20;cursor:pointer;' + getElementShapeStyle(spot) + '" title="' + safeHtml(spot.name || '') + '"></button>').join('')
    + (playScene?.sceneObjects || []).filter((obj) => !state.removedSceneObjectIds.includes(obj.id) && (!obj.isHidden || state.revealedSceneObjectIds.includes(obj.id))).map((obj) => {
      const objectTextOverride = state.sceneObjectTextOverrides?.[obj.id];
      const renderObject = applySceneObjectTextOverride(obj, objectTextOverride);
      const linkedItem = obj.linkedItemId ? getItemById(obj.linkedItemId) : null;
      const displayImage = resolveAssetUrl(obj.imageId, obj.imageData) || resolveAssetUrl(linkedItem?.imageId, linkedItem?.imageData);
      const clickMode = getSceneObjectClickMode(renderObject);
      const blockType = getSceneObjectBlockType(renderObject);
      const title = renderObject.blockLabel || renderObject.name || linkedItem?.name || 'Bloc';
      const text = renderObject.blockText || renderObject.dialogue || title;
      const blockStyle = ' style="font-size:' + getSceneObjectFontSize(renderObject) + 'px"';
      let content = '';
      if (!renderObject.isInvisible && renderObject.anime2dSpec) {
        content = renderAnime2dEmbedded(renderObject.anime2dSpec, getSceneAnime2dElapsed(playScene));
      } else if (!renderObject.isInvisible && displayImage) {
        content = '<img src="' + escapeMediaAttr(displayImage, 'image') + '" alt="' + escapeAttr(title) + '" />';
      } else if (!renderObject.isInvisible && blockType === 'text') {
        content = '<span class="interactive-block interactive-block--text"' + blockStyle + '>' + safeHtml(text) + '</span>';
      } else if (!renderObject.isInvisible && blockType === 'hint') {
        content = '<span class="interactive-block interactive-block--hint"' + blockStyle + '><strong>' + safeHtml(title || 'Indice') + '</strong><small>' + safeHtml(text || 'Un indice est disponible.') + '</small></span>';
      } else if (!renderObject.isInvisible && blockType === 'button') {
        content = '<span class="interactive-block interactive-block--button"' + blockStyle + '>' + safeHtml(renderObject.buttonLabel || title || 'Bouton') + '</span>';
      } else if (!renderObject.isInvisible && blockType === 'input') {
        content = '<span class="interactive-block interactive-block--field"' + blockStyle + '><strong>' + safeHtml(title || 'Réponse') + '</strong><small>' + safeHtml(renderObject.placeholder || 'Saisir une réponse...') + '</small></span>';
      } else if (!renderObject.isInvisible && blockType === 'code') {
        const slots = Math.max(3, Math.min(8, String(renderObject.expectedAnswer || '0000').length || 4));
        content = '<span class="interactive-block interactive-block--code"' + blockStyle + '><strong>' + safeHtml(title || 'Code') + '</strong><span>' + Array.from({ length: slots }, () => '&bull;').join(' ') + '</span></span>';
      } else if (!renderObject.isInvisible && blockType === 'image') {
        content = '<span class="interactive-block interactive-block--image"' + blockStyle + '>' + safeHtml(title || 'Image') + '</span>';
      } else if (!renderObject.isInvisible) {
        content = '<span>' + safeHtml(title || 'Objet') + '</span>';
      }
      return '<button type="button" class="player-scene-object' + (obj.isInvisible ? ' player-scene-object-invisible' : '') + (clickMode === 'none' ? ' player-scene-object-not-clickable' : '') + '" data-scene-object-id="' + obj.id + '" '
        + 'style="left:' + obj.x + '%;top:' + obj.y + '%;width:' + obj.width + '%;height:' + obj.height + '%;z-index:18;' + getElementShapeStyle(obj) + '" title="' + safeHtml(obj.name || 'Objet') + '" aria-label="' + safeHtml(obj.name || 'Objet invisible') + '">'
        + content
        + '</button>';
    }).join('')
    + (playScene?.timerEnabled ? '<div class="scene-timer-hud"><strong id="scene-timer-count">' + formatSceneTimerSeconds(state.sceneTimerRemaining || playScene.timerSeconds || 0) + '</strong>'
      + (playScene.timerEndAction === 'damage-life' ? '<span>Vies: ' + safeHtml(state.playerLives ?? 3) + '</span>' : '')
      + '</div>' : '')
    + (viewerImageSrc ? '<div class="scene-inline-viewer"><div class="scene-inline-viewer__backdrop"></div><div class="scene-inline-viewer__card">'
      + '<img class="scene-inline-viewer__image" src="' + escapeMediaAttr(viewerImageSrc, 'image') + '" alt="' + escapeAttr(state.viewerImage.name || 'Objet') + '" />'
      + '<div class="scene-inline-viewer__name">' + safeHtml(state.viewerImage.caption || state.viewerImage.name || 'Objet') + '</div></div></div>' : '')
    + (state.sceneTransitionOverlay ? '<div class="scene-transition-overlay scene-transition-overlay--' + safeHtml(state.sceneTransitionOverlay.type || 'fade') + '" style="--scene-transition-duration:' + (Number(state.sceneTransitionOverlay.duration) || 700) + 'ms">'
      + (transitionSceneBackgroundUrl ?
        '<img src="' + escapeMediaAttr(transitionSceneBackgroundUrl, 'image') + '" alt="" />'
        : '<div class="placeholder">Scène précédente</div>')
      + '</div>' : '')
    + renderHeroCombatOverlay()
    + renderHeroSetupOverlay()
    + (state.actPreload?.active ? '<div class="act-preload-overlay" role="status" aria-live="polite"><div class="act-preload-card"><span class="eyebrow">Chargement</span><strong>'
      + safeHtml(state.actPreload.label || 'Acte suivant') + '</strong><div class="act-preload-bar" aria-label="Chargement ' + safeHtml(state.actPreload.progress || 0) + '%"><span style="width:'
      + safeHtml(state.actPreload.progress || 0) + '%"></span></div><small>' + safeHtml(state.actPreload.progress || 0) + '% des médias de l\\'acte sont prêts</small></div></div>' : '')
    + '<div class="player-narration-bar ' + (state.narrationCollapsed ? 'is-collapsed' : '') + '">'
    + (state.narrationCollapsed ?
       '<button id="open-narration" type="button" class="narration-discreet-button">Texte</button>'
      : '<p id="collapse-narration" role="button" tabindex="0">' + safeHtml(state.dialogue || 'Aucun message.') + '</p>')
    + '<button id="open-inventory-drawer" type="button" class="inventory-discreet-button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + (state.inventory.length ? ' (' + state.inventory.length + ')' : '') + '</button>'
    + '</div>'
    + (state.inventoryDrawerOpen ? '<div class="player-inventory-drawer' + (IS_HERO_ADVENTURE ? ' player-inventory-drawer--hero' : IS_CHOICE_ADVENTURE ? ' player-inventory-drawer--adventure' : '') + '"><div class="panel-head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button id="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div>' + (IS_HERO_ADVENTURE ? renderStandaloneHeroEquipmentSummary() : '') + (IS_CHOICE_ADVENTURE ? renderAdventureStateSummary() : '') + '<button id="combine-items" class="secondary-action player-combine-button" type="button">Combiner les 2 objets</button><div class="inventory-grid">'
      + (state.inventory.length ? state.inventory.map((itemId) => {
        const item = getItemById(itemId);
        if (!item) return '';
        const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
        return '<button type="button" class="inventory-tile'
          + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
          + '<div class="inventory-thumb">'
          + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
          + '</div><strong>' + safeHtml(item.name || '') + '</strong>'
          + (getHeroItemBadgeLabel(item) ? '<small class="inventory-item-badge">' + safeHtml(getHeroItemBadgeLabel(item)) + '</small>' : '')
          + '</button>';
      }).join('') : '<p>Aucun objet.</p>')
      + '</div></div>' : '')
    + '</div></section>'

    + '<section class="panel side player-side-panel">'
    + '<div class="badge-line">' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</div>'
    + '<div class="dialogue-box"><p>' + safeHtml(state.dialogue || 'Aucun message.') + '</p></div>'
    + '<div class="panel-head"><h3>Inventaire</h3><button id="combine-items">Combiner les 2 objets</button></div>'
    + '<div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong>'
        + (getHeroItemBadgeLabel(item) ? '<small class="inventory-item-badge">' + safeHtml(getHeroItemBadgeLabel(item)) + '</small>' : '')
        + '</button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></section>'
    + '</div>'
    + '<div class="fullscreen-hud">'
    + '<div class="fullscreen-dialogue">' + safeHtml(state.dialogue || 'Aucun message.') + '</div>'
    + '<div class="fullscreen-actions"><button id="save-game" class="hud-button" type="button">Sauvegarder</button><button id="load-game" class="hud-button" type="button">Charger</button><button id="export-save-json" class="hud-button" type="button">Exporter JSON</button><button id="import-save-json" class="hud-button" type="button">Importer JSON</button><button id="open-inventory-drawer" class="hud-button" type="button">' + (IS_CHOICE_ADVENTURE ? 'Carnet' : 'Inventaire') + '</button></div>'
    + '</div>'
    + (state.inventoryDrawerOpen ? '<div id="inventory-drawer-backdrop" class="inventory-drawer__backdrop"></div><aside class="inventory-drawer open"><div class="inventory-drawer__head"><h3>' + safeHtml(inventoryDrawerTitle) + '</h3><button id="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div>' + (IS_HERO_ADVENTURE ? renderStandaloneHeroEquipmentSummary() : '') + '<div class="inventory-actions"><button id="combine-items" type="button">Combiner les 2 objets</button></div><div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong>'
        + (getHeroItemBadgeLabel(item) ? '<small class="inventory-item-badge">' + safeHtml(getHeroItemBadgeLabel(item)) + '</small>' : '')
        + '</button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></aside>' : '')
    + (state.pauseOpen ? '<div class="player-pause-overlay"><div class="player-pause-menu"><span class="eyebrow">Pause</span><h2>' + safeHtml(GAME_TITLE) + '</h2>' + renderAdventureStateSummary() + '<div class="player-pause-actions">'
      + '<button id="resume-game" type="button">Reprendre</button>'
      + '<button id="pause-save-game" type="button" class="secondary-action">Sauvegarder</button>'
      + '<button id="pause-load-game" type="button" class="secondary-action">Charger</button>'
      + '<button id="pause-reset-preview" type="button" class="secondary-action">Recommencer</button>'
      + '<button id="pause-toggle-hints" type="button" class="secondary-action">' + (state.showInteractionHints ? 'Masquer l’aide visuelle' : 'Afficher l’aide visuelle') + '</button>'
      + '</div></div></div>' : '')
    + renderCinematic(cinematic, currentSlide)
    + renderConversation()
    + renderChoiceEffectFloating()
    + renderEnding()
    + renderEnigma(enigma);

  bindEvents();
  syncFullscreenUi();
  if (state.actPreload?.active) {
    const playScene = getPlayScene();
    if (sceneAudioSource !== getSceneMusicKey(playScene)) {
      sceneAudio.pause();
      sceneAudio.currentTime = 0;
      sceneAudio.removeAttribute('src');
      sceneAudio.load();
      sceneAudioSource = '';
    }
    if (ambientAudioSource !== getSceneAmbientSoundKey(playScene)) {
      ambientAudio.pause();
      ambientAudio.currentTime = 0;
      ambientAudio.removeAttribute('src');
      ambientAudio.load();
      ambientAudioSource = '';
    }
    stopSceneTimer();
  } else {
    playSceneMusic();
    playSceneAmbientSound();
    scheduleSceneTimer();
  }
  if (sceneTransitionTimer) {
    clearTimeout(sceneTransitionTimer);
    sceneTransitionTimer = null;
  }
  if (state.sceneTransitionOverlay) {
    sceneTransitionTimer = setTimeout(() => {
      state.sceneTransitionOverlay = null;
      sceneTransitionTimer = null;
      render(false);
    }, (Number(state.sceneTransitionOverlay.duration) || 700) + 80);
  }
  clearAnime2dTimer();
  if (cinematic?.cinematicType === 'anime2d') {
    const delay = getNextAnime2dRenderDelay(cinematic);
    anime2dTimer = setTimeout(() => {
      if (getCurrentCinematic()?.id !== cinematic.id) return;
      const { duration } = getAnime2dSpec(cinematic);
      if (getAnime2dElapsed(cinematic) >= duration) {
        closeCinematic();
      } else {
        render(false);
      }
    }, delay);
  } else {
    const delay = getNextSceneAnime2dRenderDelay(playScene);
    if (delay !== null) {
      anime2dTimer = setTimeout(() => {
        if (getPlayScene()?.id !== playScene?.id || getCurrentCinematic()) return;
        render(false);
      }, delay);
    }
  }

  if (shouldSave && hasRenderedOnce) saveGame(false);
  hasRenderedOnce = true;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  const audioNode = root.querySelector('#cinematic-audio');
  if (audioNode) {
    cinematicAudio = audioNode;
  }

}
`;
