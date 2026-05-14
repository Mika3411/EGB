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

function combatStatusBadgeClass(type = '') {
  return String(type || 'status').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function getCombatStatusParts(effect = {}) {
  const type = effect.type || effect.statusType || '';
  const label = getStatusEffectLabel(type) || 'Statut';
  const amount = Math.max(0, Number(effect.amount) || 0);
  const duration = Math.max(0, Number(effect.duration) || 0);
  const details = [
    type && type !== 'stun' && amount ? String(amount) : '',
    duration ? duration + 't' : '',
  ].filter(Boolean);
  return {
    type,
    label,
    meta: details.join(' · '),
  };
}

function formatCombatStatusBadge(effect = {}) {
  const status = getCombatStatusParts(effect);
  return status.meta ? status.label + ' ' + status.meta : status.label;
}

function renderCombatActor(media, label, actor, stats = {}) {
  const health = Math.max(0, Number(stats.health) || 0);
  const maxHealth = Math.max(1, Number(stats.maxHealth) || 1);
  const mana = Math.max(0, Number(stats.mana) || 0);
  const maxMana = Math.max(0, Number(stats.maxMana) || 0);
  const initiative = Number.isFinite(Number(stats.initiative)) ? Number(stats.initiative) : 0;
  const statusEffects = Array.isArray(stats.statusEffects) ? stats.statusEffects : [];
  const statusBadges = statusEffects.length
    ? statusEffects.map((effect) => {
      const status = getCombatStatusParts(effect);
      const statusClass = combatStatusBadgeClass(status.type);
      return '<span class="hero-combat-status-badge hero-combat-status-badge--' + safeHtml(statusClass) + '" title="' + safeHtml(formatCombatStatusBadge(effect)) + '"><span class="hero-combat-status-icon hero-combat-status-icon--' + safeHtml(statusClass) + '" aria-hidden="true"></span><span class="hero-combat-status-copy"><strong>' + safeHtml(status.label) + '</strong>' + (status.meta ? '<small>' + safeHtml(status.meta) + '</small>' : '') + '</span></span>';
    }).join('')
    : '<span class="hero-combat-status-badge is-empty">Aucun statut</span>';
  const effectBadge = stats.activeEffectLabel
    ? '<span class="hero-combat-status-badge hero-combat-status-badge--effect">' + safeHtml(stats.activeEffectLabel) + '</span>'
    : '';
  const mediaBody = media?.mediaType === 'anime2d' && media.anime2dSpec
    ? renderAnime2dEmbedded(media.anime2dSpec, 0)
    : media?.imageData
      ? '<img src="' + escapeMediaAttr(media.imageData, 'image') + '" alt="' + escapeAttr(label) + '" />'
      : '<span>' + safeHtml(String(label || actor || '?').slice(0, 1).toUpperCase()) + '</span>';
  return '<div class="hero-combat-actor hero-combat-actor--' + safeHtml(actor) + '">'
    + '<div class="hero-combat-actor-head"><span><small>' + safeHtml(actor === 'hero' ? 'Héros' : 'Adversaire') + '</small><strong>' + safeHtml(label) + '</strong></span><em class="' + (stats.isActive ? 'is-active' : '') + '">' + safeHtml(stats.isActive ? 'À jouer' : 'Init ' + initiative) + '</em></div>'
    + '<div class="hero-combat-actor-bars">'
    + '<span class="hero-combat-actor-bar hero-combat-actor-bar--health" title="' + safeHtml(health + '/' + maxHealth + ' PV') + '"><span>PV</span><strong>' + health + '/' + maxHealth + '</strong><i style="width:' + combatBarPercent(health, maxHealth) + '%"></i></span>'
    + '<span class="hero-combat-actor-bar hero-combat-actor-bar--mana" title="' + safeHtml(mana + '/' + maxMana + ' mana') + '"><span>Mana</span><strong>' + mana + '/' + maxMana + '</strong><i style="width:' + combatBarPercent(mana, Math.max(1, maxMana)) + '%"></i></span>'
    + '</div>'
    + '<div class="hero-combat-actor-status-row">' + statusBadges + effectBadge + '</div>'
    + '<div class="hero-combat-actor-media">' + mediaBody + '</div>'
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
  const diceSides = Math.max(2, Number(project?.heroAdventure?.dice?.sides) || 20);
  const heroSkills = Array.isArray(hero.skills) ? hero.skills : [];
  const selectedCombatSkill = heroSkills.find((skill) => skill.id === entry.combatSkillId) || heroSkills[0] || null;
  const heroForce = getHeroForceValue(hero, selectedCombatSkill?.id || '');
  const heroDieDamagePercent = Math.max(0, Number(getCombatEntryValue(entry, 'combatHeroDieDamagePercent', combatSettings.heroDieDamagePercent || 0)) || 0);
  const estimatedDieDamage = Math.max(0, Math.round(((diceSides + 1) / 2) * (heroDieDamagePercent / 100)));
  const estimatePowerDamage = (power = null) => Math.max(0, heroForce + estimatedDieDamage + Math.max(0, Number(power?.force) || 0));
  const formatManaCost = (value) => Math.max(0, Number(value) || 0) + ' mana';
  const formatDamageEstimate = (value) => '~' + Math.max(0, Number(value) || 0) + ' dégâts';
  const describePowerEffect = (power = {}) => {
    if (power.statusType === 'shield') return 'Bouclier ' + Math.max(0, Number(power.statusAmount) || Number(power.force) || 0);
    if (Number(power.healHealth) > 0 || Number(power.healMana) > 0) {
      return [
        Number(power.healHealth) > 0 ? 'PV +' + Math.max(0, Number(power.healHealth) || 0) : '',
        Number(power.healMana) > 0 ? 'Mana +' + Math.max(0, Number(power.healMana) || 0) : '',
      ].filter(Boolean).join(' · ');
    }
    if (power.statusType) return getStatusEffectLabel(power.statusType) + ' ' + Math.max(0, Number(power.statusAmount) || 0);
    return formatDamageEstimate(estimatePowerDamage(power));
  };
  const currentCombatState = (state.heroCombatStates || {})[combat.id] || {};
  const heroStatusEffects = Array.isArray(currentCombatState.heroStatusEffects) ? currentCombatState.heroStatusEffects : Array.isArray(combat.heroStatusEffects) ? combat.heroStatusEffects : [];
  const enemyStatusEffects = Array.isArray(currentCombatState.enemyStatusEffects) ? currentCombatState.enemyStatusEffects : Array.isArray(combat.enemyStatusEffects) ? combat.enemyStatusEffects : [];
  const heroInitiative = Number.isFinite(Number(combat.heroInitiative)) ? Number(combat.heroInitiative) : Math.max(-999, Math.min(999, Number(hero.initiative) || 0));
  const enemyInitiativeValue = getCombatEntryValue(entry, 'combatEnemyInitiative', combatSettings.enemyInitiative || 0);
  const enemyInitiative = Number.isFinite(Number(combat.enemyInitiative)) ? Number(combat.enemyInitiative) : Math.max(-999, Math.min(999, Number(enemyInitiativeValue) || 0));
  const combatEffects = Array.isArray(combat.visualEffects) ? combat.visualEffects : [];
  const getActorEffectLabel = (actor) => {
    const list = combatEffects.filter((effect) => effect.target === actor);
    return list.find((effect) => effect.type === 'critical')?.text || list.find((effect) => effect.text)?.text || '';
  };
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
  const combatRollEffects = combatEffects;
  const combatRollActionType = lastCombatRoll?.actionType || (isEnemyTurn ? 'enemy_combat' : isSurvivalTurn ? 'hero_combat_survival' : 'hero_combat');
  const combatRollActor = combatRollActionType === 'enemy_combat' ? 'enemy' : 'hero';
  const combatRollTarget = combatRollActionType === 'enemy_combat' ? 'hero' : combatRollActionType === 'hero_combat_survival' ? 'hero' : 'enemy';
  const combatRollImpactEffect = lastCombatRoll ? combatRollEffects.find((effect) => effect?.target === combatRollTarget && ['damage', 'death', 'critical', 'heal'].includes(effect.type || '') && effect.text) : null;
  const combatRollHasCritical = Boolean(lastCombatRoll?.isCriticalSuccess || lastCombatRoll?.heroCritical || combatRollEffects.some((effect) => effect.type === 'critical'));
  const combatRollHasFailure = Boolean(lastCombatRoll?.isCriticalFailure || lastCombatRoll?.success === false);
  const combatRollImpactText = combatRollImpactEffect?.text || (combatRollHasFailure ? 'Raté' : combatRollHasCritical ? 'Critique' : '');
  const combatRollResultValue = lastCombatRoll ? (Number.isFinite(Number(lastCombatRoll.total)) ? lastCombatRoll.total : lastCombatRoll.raw) : '';
  const diceSpotlightClass = [
    'hero-combat-dice-spotlight',
    lastCombatRoll ? 'has-result' : '',
    combatRollHasCritical ? 'is-critical' : '',
    combatRollHasFailure ? 'is-failure' : '',
    'hero-combat-dice-spotlight--' + combatRollActor,
    'hero-combat-dice-spotlight--target-' + combatRollTarget,
  ].filter(Boolean).join(' ');
  const diceResultHtml = lastCombatRoll
    ? '<span class="hero-combat-dice-result-burst" aria-hidden="true">' + safeHtml(combatRollResultValue) + '</span><span class="hero-combat-dice-impact-trail" aria-hidden="true">' + (combatRollImpactText ? '<span>' + safeHtml(combatRollImpactText) + '</span>' : '') + '</span>'
    : '';
  const d20FaceTransforms = [
    ['f01', 'matrix3d(0.80902,-0.5,0.30902,0,0.11026,0.6455,0.75576,0,-0.57735,-0.57735,0.57735,0,-48.84346,-30.18692,-8.34346,1)', '252 66% 24%'],
    ['f02', 'matrix3d(0.5,-0.30902,-0.80902,0,0.86603,0.17841,0.46709,0,0,-0.93417,0.35682,0,-40.5,-35.34346,21.84346,1)', '260 66% 24%'],
    ['f03', 'matrix3d(-0.5,0.30902,-0.80902,0,0.86603,0.17841,-0.46709,0,0,-0.93417,-0.35682,0,-13.5,-52.03038,21.84346,1)', '268 66% 24%'],
    ['f04', 'matrix3d(-0.80902,0.5,0.30902,0,0.11026,0.6455,-0.75576,0,-0.57735,-0.57735,-0.57735,0,-5.15654,-57.18692,-8.34346,1)', '276 66% 24%'],
    ['f05', 'matrix3d(0,0,1,0,-0.35682,0.93417,0,0,-0.93417,-0.35682,0,0,-27,-43.68692,-27,1)', '284 66% 24%'],
    ['f06', 'matrix3d(0.80902,0.5,-0.30902,0,-0.11026,0.6455,0.75576,0,0.57735,-0.57735,0.57735,0,5.15654,-57.18692,8.34346,1)', '292 66% 24%'],
    ['f07', 'matrix3d(0.80902,0.5,0.30902,0,-0.46709,0.86603,-0.17841,0,-0.35682,0,0.93417,0,-21.84346,-40.5,35.34346,1)', '300 66% 24%'],
    ['f08', 'matrix3d(0.30902,0.80902,0.5,0,0.17841,0.46709,-0.86603,0,-0.93417,0.35682,0,0,-52.03038,-21.84346,13.5,1)', '252 66% 24%'],
    ['f09', 'matrix3d(0,1,0,0,0.93417,0,-0.35682,0,-0.35682,0,-0.93417,0,-43.68692,-27,-27,1)', '260 66% 24%'],
    ['f10', 'matrix3d(0.30902,0.80902,-0.5,0,0.75576,0.11026,0.6455,0,0.57735,-0.57735,-0.57735,0,-8.34346,-48.84346,-30.18692,1)', '268 66% 24%'],
    ['f11', 'matrix3d(-0.80902,0.5,0.30902,0,-0.11026,-0.6455,0.75576,0,0.57735,0.57735,0.57735,0,48.84346,30.18692,-8.34346,1)', '276 66% 24%'],
    ['f12', 'matrix3d(-0.5,0.30902,-0.80902,0,-0.86603,-0.17841,0.46709,0,0,0.93417,0.35682,0,40.5,35.34346,21.84346,1)', '284 66% 24%'],
    ['f13', 'matrix3d(0.5,-0.30902,-0.80902,0,-0.86603,-0.17841,-0.46709,0,0,0.93417,-0.35682,0,13.5,52.03038,21.84346,1)', '292 66% 24%'],
    ['f14', 'matrix3d(0.80902,-0.5,0.30902,0,-0.11026,-0.6455,-0.75576,0,0.57735,0.57735,-0.57735,0,5.15654,57.18692,-8.34346,1)', '300 66% 24%'],
    ['f15', 'matrix3d(0,0,1,0,0.35682,-0.93417,0,0,0.93417,0.35682,0,0,27,43.68692,-27,1)', '252 66% 24%'],
    ['f16', 'matrix3d(-0.80902,-0.5,0.30902,0,0.46709,-0.86603,-0.17841,0,0.35682,0,0.93417,0,21.84346,40.5,35.34346,1)', '260 66% 24%'],
    ['f17', 'matrix3d(-0.80902,-0.5,-0.30902,0,0.11026,-0.6455,0.75576,0,-0.57735,0.57735,0.57735,0,-5.15654,57.18692,8.34346,1)', '268 66% 24%'],
    ['f18', 'matrix3d(-0.30902,-0.80902,-0.5,0,-0.75576,-0.11026,0.6455,0,-0.57735,0.57735,-0.57735,0,8.34346,48.84346,-30.18692,1)', '276 66% 24%'],
    ['f19', 'matrix3d(0,-1,0,0,-0.93417,0,-0.35682,0,0.35682,0,-0.93417,0,43.68692,27,-27,1)', '284 66% 24%'],
    ['f20', 'matrix3d(-0.30902,-0.80902,0.5,0,-0.17841,-0.46709,-0.86603,0,0.93417,-0.35682,0,0,52.03038,21.84346,13.5,1)', '292 66% 24%'],
  ];
  const d20PrimaryValue = Math.max(1, Math.min(20, Number(lastCombatRoll?.raw) || 20));
  const d20FallbackValues = Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== d20PrimaryValue);
  let d20FallbackIndex = 0;
  const d20FaceHtml = d20FaceTransforms.map(([id, transform, tone]) => {
    const value = id === 'f16' ? d20PrimaryValue : d20FallbackValues[d20FallbackIndex++ % d20FallbackValues.length];
    return '<span class="hero-d20-face ' + (id === 'f16' ? 'hero-d20-face--result' : '') + '" style="--face-transform:' + escapeAttr(transform) + ';--face-tone:' + escapeAttr(tone) + '"><span>' + safeHtml(value) + '</span></span>';
  }).join('');
  const d20SvgFaces = [
    ['top-left', '60,4 27,17 42,36', 43, 20, '268 64% 31%'],
    ['top-center', '60,4 42,36 78,36', 60, 26, '276 66% 35%'],
    ['top-right', '60,4 78,36 93,17', 77, 20, '258 62% 27%'],
    ['left-upper', '27,17 9,48 42,36', 27, 35, '286 62% 29%'],
    ['right-upper', '93,17 78,36 111,48', 93, 35, '252 58% 23%'],
    ['left-middle', '9,48 22,86 60,70', 30, 67, '282 66% 25%'],
    ['left-core', '9,48 60,70 42,36', 38, 52, '270 72% 33%'],
    ['result', '42,36 60,70 78,36', 60, 48, '265 74% 38%'],
    ['right-core', '78,36 60,70 111,48', 82, 52, '260 70% 28%'],
    ['right-middle', '111,48 60,70 98,86', 90, 67, '250 62% 20%'],
    ['bottom-left', '22,86 60,108 60,70', 48, 88, '272 72% 23%'],
    ['bottom-right', '60,70 60,108 98,86', 72, 88, '262 70% 18%'],
  ];
  let d20SvgFallbackIndex = 0;
  const d20SvgValues = d20SvgFaces.map(([id]) => {
    if (id === 'result') return d20PrimaryValue;
    const value = d20FallbackValues[d20SvgFallbackIndex % d20FallbackValues.length];
    d20SvgFallbackIndex += 1;
    return value;
  });
  const d20SvgHtml = '<svg class="hero-d20-svg" viewBox="0 0 120 112" focusable="false">'
    + d20SvgFaces.map((face) => '<polygon class="hero-d20-svg-face ' + (face[0] === 'result' ? 'hero-d20-svg-face--result' : '') + '" points="' + escapeAttr(face[1]) + '" style="--face-tone:' + escapeAttr(face[4]) + '"></polygon>').join('')
    + '<polyline class="hero-d20-svg-ridge" points="60,4 42,36 9,48 60,70 22,86 60,108 98,86 60,70 111,48 78,36 60,4"></polyline>'
    + '<polyline class="hero-d20-svg-ridge" points="27,17 42,36 78,36 93,17"></polyline>'
    + d20SvgFaces.map(([id,, x, y], index) => '<text class="hero-d20-svg-text ' + (id === 'result' ? 'hero-d20-svg-text--result' : '') + '" x="' + safeHtml(x) + '" y="' + safeHtml(y) + '" text-anchor="middle" dominant-baseline="middle">' + safeHtml(d20SvgValues[index]) + '</text>').join('')
    + '</svg>';
  const actionLabel = isSurvivalTurn
    ? 'Lancer Survie'
    : isEnemyTurn
    ? 'Lancer la riposte'
    : selectedPower
      ? 'Utiliser ' + (selectedPower.name || 'Pouvoir')
      : 'Attaque normale';
  const actionDisabled = isEnded || (!isEnemyTurn && !isSurvivalTurn && (selectedPowerMissing || manaUnavailable));
  const primaryActionLabel = isEnded ? 'Combat terminé' : actionLabel;
  const primaryActionClass = [
    'hero-combat-main-action',
    isEnemyTurn ? 'is-enemy' : '',
    isSurvivalTurn ? 'is-survival' : '',
  ].filter(Boolean).join(' ');
  const closeCombatLabel = isEnded ? 'Revenir à la scène' : 'Fuir';
  const enemyCunning = Math.max(1, Number(getCombatEntryValue(entry, 'combatEnemyCunning', combatSettings.enemyCunning || 10)) || 10);
  const attackPowers = heroPowers.filter((power) => power.statusType !== 'shield');
  const defensePowers = heroPowers.filter((power) => power.statusType === 'shield');
  const firstAvailablePower = attackPowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const firstDefensePower = defensePowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const isSelectedDefensePower = selectedPower?.statusType === 'shield';
  const inventoryItems = Array.isArray(state.inventory) ? state.inventory.map((itemId) => getItemById(itemId)).filter(Boolean) : [];
  const usableCombatItems = inventoryItems.filter((item) => (
    (item.heroItemType === 'health_potion' && heroHealth < heroMaxHealth)
    || (item.heroItemType === 'mana_potion' && heroMana < heroMaxMana)
  ));
  const firstUsableCombatItem = usableCombatItems[0] || null;
  const canChooseHeroAction = !isEnded && !isEnemyTurn && !isSurvivalTurn;
  const describeCombatItem = (item = {}) => {
    if (item.heroItemType === 'health_potion') return 'PV +' + Math.max(1, Number(item.heroItemAmount) || 4);
    if (item.heroItemType === 'mana_potion') return 'Mana +' + Math.max(1, Number(item.heroItemAmount) || 3);
    return 'Objet';
  };
  const makeActionButton = (id, label, meta, icon, options = {}) => {
    const classes = ['hero-combat-action-button', options.active ? 'active' : '', options.danger ? 'is-danger' : ''].filter(Boolean).join(' ');
    const disabled = Boolean(options.disabled);
    const attributes = [
      'type="button"',
      'class="' + escapeAttr(classes) + '"',
      'data-hero-combat-action="' + escapeAttr(id) + '"',
    ];
    if (Object.prototype.hasOwnProperty.call(options, 'powerId')) attributes.push('data-hero-combat-power="' + escapeAttr(options.powerId || '') + '"');
    if (options.itemId) attributes.push('data-hero-combat-item="' + escapeAttr(options.itemId) + '"');
    if (options.flee) attributes.push('data-hero-combat-flee="true"');
    if (disabled) attributes.push('disabled');
    if (options.title) attributes.push('title="' + escapeAttr(options.title) + '"');
    return '<button ' + attributes.join(' ') + '><span class="hero-combat-action-glyph" aria-hidden="true">' + safeHtml(icon) + '</span><strong>' + safeHtml(label) + '</strong><span>' + safeHtml(meta) + '</span></button>';
  };
  const heroPowerStripHtml = heroPowers.length
    ? '<div class="hero-combat-power-strip" aria-label="Pouvoirs du héros">' + heroPowers.map((power) => {
      const manaCost = Math.max(0, Number(power.manaCost) || 0);
      const totalManaCost = combatManaCost + manaCost;
      const disabled = !canChooseHeroAction || totalManaCost > heroMana;
      const classes = ['hero-combat-power-chip', state.selectedHeroCombatPowerId === power.id ? 'active' : '', power.statusType === 'shield' ? 'is-defense' : ''].filter(Boolean).join(' ');
      return '<button type="button" class="' + escapeAttr(classes) + '" data-hero-combat-power="' + escapeAttr(power.id || '') + '"' + (disabled ? ' disabled title="Mana insuffisante"' : ' title="' + escapeAttr(describePowerEffect(power)) + '"') + '><strong>' + safeHtml(power.name || 'Pouvoir') + '</strong><span>' + safeHtml(formatManaCost(totalManaCost) + ' · ' + describePowerEffect(power)) + '</span></button>';
    }).join('') + '</div>'
    : '';
  const heroActionPanelHtml = canChooseHeroAction
    ? '<div class="hero-combat-action-panel"><div class="hero-combat-action-bar" aria-label="Barre d\\'action du héros">'
      + makeActionButton('attack', 'Attaque', formatManaCost(combatManaCost) + ' · ' + formatDamageEstimate(estimatePowerDamage(null)), 'd20', {
        active: !selectedPower,
        disabled: combatManaCost > heroMana,
        title: combatManaCost > heroMana ? 'Mana insuffisante' : 'Attaque normale',
        powerId: '',
      })
      + makeActionButton('power', 'Pouvoir', attackPowers.length ? (firstAvailablePower ? formatManaCost(combatManaCost + Math.max(0, Number(firstAvailablePower.manaCost) || 0)) + ' · ' + describePowerEffect(firstAvailablePower) : 'Mana insuffisante') : 'Aucun pouvoir', 'PVR', {
        active: Boolean(selectedPower && !isSelectedDefensePower),
        disabled: !attackPowers.length || !firstAvailablePower,
        title: !attackPowers.length ? 'Aucun pouvoir offensif' : !firstAvailablePower ? 'Mana insuffisante' : 'Choisir un pouvoir',
        powerId: firstAvailablePower?.id || '',
      })
      + makeActionButton('item', 'Objet', firstUsableCombatItem ? (firstUsableCombatItem.name || 'Objet') + ' · ' + describeCombatItem(firstUsableCombatItem) : 'Aucun objet', 'OBJ', {
        disabled: !firstUsableCombatItem,
        title: firstUsableCombatItem ? 'Utiliser ' + (firstUsableCombatItem.name || 'objet') : 'Aucun objet utile maintenant',
        itemId: firstUsableCombatItem?.id || '',
      })
      + makeActionButton('defense', 'Défense', defensePowers.length ? (firstDefensePower ? formatManaCost(combatManaCost + Math.max(0, Number(firstDefensePower.manaCost) || 0)) + ' · ' + describePowerEffect(firstDefensePower) : 'Mana insuffisante') : 'Aucun bouclier', 'DEF', {
        active: Boolean(isSelectedDefensePower),
        disabled: !defensePowers.length || !firstDefensePower,
        title: !defensePowers.length ? 'Aucun pouvoir de bouclier' : !firstDefensePower ? 'Mana insuffisante' : 'Choisir une défense',
        powerId: firstDefensePower?.id || '',
      })
      + makeActionButton('flee', 'Fuir', 'Ruse vs ' + enemyCunning, 'FUI', {
        danger: true,
        title: 'Tenter de fuir',
        flee: true,
      })
      + '</div>' + heroPowerStripHtml + '</div>'
    : '';
  const combatJournalMessage = String(combat.message || 'Le combat commence.').replace(/\s+/g, ' ').trim();
  const combatJournalHistory = (Array.isArray(combat.history) && combat.history.length ? combat.history : [combatJournalMessage])
    .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-8);
  const combatJournalSentences = (combatJournalMessage.match(/[^.!?]+[.!?]?/g) || [combatJournalMessage]).map((entry) => entry.trim()).filter(Boolean);
  const combatJournalDetail = combatJournalSentences.length > 1 ? combatJournalSentences.slice(1).join(' ') : combatJournalMessage;
  const rawCombatJournalHeadline = isEnded
    ? combat.status === 'victory'
      ? 'Victoire remportée.'
      : 'Le héros tombe.'
    : combatRollImpactText
      || (isEnemyTurn ? 'La riposte se prépare.' : isSurvivalTurn ? 'Dernier souffle.' : selectedPower ? (selectedPower.name || 'Pouvoir') + ' est prêt.' : 'À toi de jouer.');
  const combatJournalHeadline = rawCombatJournalHeadline.length <= 72
    ? rawCombatJournalHeadline
    : rawCombatJournalHeadline.slice(0, 69).replace(/\s+\S*$/, '') + '...';
  const combatJournalHtml = '<div class="hero-combat-journal" role="status" aria-live="polite">'
    + '<span class="hero-combat-journal-kicker">Journal</span>'
    + '<strong class="hero-combat-journal-headline">' + safeHtml(combatJournalHeadline) + '</strong>'
    + (combatJournalDetail ? '<p>' + safeHtml(combatJournalDetail) + '</p>' : '')
    + (combatJournalHistory.length ? '<details class="hero-combat-journal-history"><summary>Historique (' + combatJournalHistory.length + ')</summary><ol>' + [...combatJournalHistory].reverse().map((entry) => '<li>' + safeHtml(entry) + '</li>').join('') + '</ol></details>' : '')
    + '</div>';
  const topCloseHtml = isEnded ? '<button id="close-hero-combat" type="button" class="secondary-action compact">' + safeHtml(closeCombatLabel) + '</button>' : '';

  return '<div class="hero-combat-overlay hero-combat-overlay--' + safeHtml(combat.status || 'active') + (isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : '') + '"' + overlayStyle + '>'
    + '<div class="hero-combat-topline"><span>' + safeHtml(isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : 'Tour ' + (combat.round || 1)) + '</span><strong>' + safeHtml(enemyLabel) + '</strong>' + topCloseHtml + '</div>'
    + '<div class="hero-combat-stage">'
    + renderCombatActor(heroMedia, heroLabel, 'hero', { health: heroHealth, maxHealth: heroMaxHealth, mana: heroMana, maxMana: heroMaxMana, initiative: heroInitiative, isActive: !isEnemyTurn && !isSurvivalTurn && !isEnded, statusEffects: heroStatusEffects, activeEffectLabel: getActorEffectLabel('hero') })
    + (showDice ? '<div class="' + safeHtml(diceSpotlightClass) + '"><span class="hero-combat-dice-aura" aria-hidden="true"></span><button id="hero-combat-action" type="button" class="hero-combat-die-button' + (lastCombatRoll ? ' has-result' : '') + '"' + (actionDisabled ? ' disabled' : '') + '><span class="hero-combat-die hero-d20' + (lastCombatRoll ? ' has-result' : '') + '"><span class="hero-d20-core" aria-hidden="true">' + d20SvgHtml + '</span><span class="hero-roll-die-value">' + safeHtml(lastCombatRoll?.raw || '?') + '</span></span></button>' + diceResultHtml + '<strong><span class="hero-combat-dice-kicker">' + safeHtml(lastCombatRoll ? 'Résultat' : project?.heroAdventure?.dice?.label || 'Dé') + '</span>' + safeHtml(lastCombatRoll ? lastCombatRoll.total + ' total' : project?.heroAdventure?.dice?.label || 'Dé') + '</strong><small>' + safeHtml(isEnded ? 'Combat terminé' : actionLabel) + '</small></div>' : '<div></div>')
    + renderCombatActor(enemyMedia, enemyLabel, 'enemy', { health: enemyHealth, maxHealth: enemyMaxHealth, mana: enemyMana, maxMana: enemyMaxMana, initiative: enemyInitiative, isActive: isEnemyTurn && !isEnded, statusEffects: enemyStatusEffects, activeEffectLabel: getActorEffectLabel('enemy') })
    + '</div>'
    + renderCombatVisualEffects(combat.visualEffects)
    + '<div class="hero-combat-hud">'
    + '<div class="hero-combat-meter"><span>' + safeHtml(heroLabel) + '</span><strong>' + heroHealth + '/' + heroMaxHealth + ' PV</strong><i style="width:' + combatBarPercent(heroHealth, heroMaxHealth) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--hero-mana"><span>Mana héros</span><strong>' + heroMana + '/' + heroMaxMana + '</strong><i style="width:' + combatBarPercent(heroMana, Math.max(1, heroMaxMana)) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--enemy"><span>' + safeHtml(enemyLabel) + '</span><strong>' + enemyHealth + '/' + enemyMaxHealth + ' PV</strong><i style="width:' + combatBarPercent(enemyHealth, enemyMaxHealth) + '%"></i></div>'
    + '<div class="hero-combat-meter hero-combat-meter--mana"><span>Mana ennemi</span><strong>' + enemyMana + '/' + enemyMaxMana + '</strong><i style="width:' + combatBarPercent(enemyMana, Math.max(1, enemyMaxMana)) + '%"></i></div>'
    + '</div>'
    + '<div class="hero-combat-log">' + combatJournalHtml
    + heroActionPanelHtml
    + '<div class="inline-actions"><button id="hero-combat-action" type="button" class="' + primaryActionClass + '"' + (actionDisabled ? ' disabled' : '') + '><span class="hero-combat-action-die" aria-hidden="true">d20</span><span>' + safeHtml(primaryActionLabel) + '</span></button></div>'
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
