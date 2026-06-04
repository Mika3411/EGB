export const standaloneCombatRender = `function getCombatActorMedia(entry, combat, actor, fallbackImage = '') {
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
    return '<span class="hero-combat-fx-visual hero-combat-fx-visual--' + safeClassToken(media.visualEffect, 'none') + '"></span>' + audio;
  }
  return audio;
}

function renderCombatVisualEffects(effects = []) {
  const list = Array.isArray(effects) ? effects.filter(Boolean) : [];
  if (!list.length) return '';
  return '<div class="hero-combat-fx-layer">'
    + list.map((effect) => '<span class="hero-combat-fx hero-combat-fx--' + safeClassToken(effect.type || 'damage', 'damage') + (effect.media ? ' hero-combat-fx--has-media' : '') + '">'
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
      return '<span class="hero-combat-status-badge hero-combat-status-badge--' + safeClassToken(statusClass, 'status') + '" title="' + escapeAttr(formatCombatStatusBadge(effect)) + '"><span class="hero-combat-status-icon hero-combat-status-icon--' + safeClassToken(statusClass, 'status') + '" aria-hidden="true"></span><span class="hero-combat-status-copy"><strong>' + safeHtml(status.label) + '</strong>' + (status.meta ? '<small>' + safeHtml(status.meta) + '</small>' : '') + '</span></span>';
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
  return '<div class="hero-combat-actor hero-combat-actor--' + safeClassToken(actor, 'actor') + '">'
    + '<div class="hero-combat-actor-head"><span><small>' + safeHtml(actor === 'hero' ? 'Héros' : 'Adversaire') + '</small><strong>' + safeHtml(label) + '</strong></span><em class="' + (stats.isActive ? 'is-active' : '') + '">' + safeHtml(stats.isActive ? 'À jouer' : 'Init ' + initiative) + '</em></div>'
    + '<div class="hero-combat-actor-bars">'
    + '<span class="hero-combat-actor-bar hero-combat-actor-bar--health" title="' + escapeAttr(health + '/' + maxHealth + ' PV') + '"><span>PV</span><strong>' + health + '/' + maxHealth + '</strong><i style="width:' + combatBarPercent(health, maxHealth) + '%"></i></span>'
    + '<span class="hero-combat-actor-bar hero-combat-actor-bar--mana" title="' + escapeAttr(mana + '/' + maxMana + ' mana') + '"><span>Mana</span><strong>' + mana + '/' + maxMana + '</strong><i style="width:' + combatBarPercent(mana, Math.max(1, maxMana)) + '%"></i></span>'
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
    'hero-combat-dice-spotlight--' + safeClassToken(combatRollActor, 'hero'),
    'hero-combat-dice-spotlight--target-' + safeClassToken(combatRollTarget, 'enemy'),
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
    return '<span class="hero-d20-face ' + (id === 'f16' ? 'hero-d20-face--result' : '') + '" style="--face-transform:' + escapeAttr(transform) + ';--face-tone:' + safeCssColor(tone, '260 66% 24%') + '"><span>' + safeHtml(value) + '</span></span>';
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
    + d20SvgFaces.map((face) => '<polygon class="hero-d20-svg-face ' + (face[0] === 'result' ? 'hero-d20-svg-face--result' : '') + '" points="' + escapeAttr(face[1]) + '" style="--face-tone:' + safeCssColor(face[4], '260 66% 24%') + '"></polygon>').join('')
    + '<polyline class="hero-d20-svg-ridge" points="60,4 42,36 9,48 60,70 22,86 60,108 98,86 60,70 111,48 78,36 60,4"></polyline>'
    + '<polyline class="hero-d20-svg-ridge" points="27,17 42,36 78,36 93,17"></polyline>'
    + d20SvgFaces.map(([id,, x, y], index) => '<text class="hero-d20-svg-text ' + (id === 'result' ? 'hero-d20-svg-text--result' : '') + '" x="' + escapeAttr(x) + '" y="' + escapeAttr(y) + '" text-anchor="middle" dominant-baseline="middle">' + safeHtml(d20SvgValues[index]) + '</text>').join('')
    + '</svg>';
  const actionLabel = isSurvivalTurn
    ? 'Lancer Survie'
    : isEnemyTurn
    ? 'Lancer la riposte'
    : selectedPower
      ? 'Utiliser ' + (selectedPower.name || 'Pouvoir')
      : 'Attaque normale';
  const actionDisabled = isEnded || (!isEnemyTurn && !isSurvivalTurn && (selectedPowerMissing || manaUnavailable));
  const actionDisabledReason = !actionDisabled
    ? ''
    : isEnded
    ? 'Combat terminé.'
    : selectedPowerMissing
    ? 'Pouvoir indisponible.'
    : manaUnavailable
    ? 'Mana insuffisante: ' + heroMana + '/' + selectedManaCost + '.'
    : 'Action indisponible pendant ce tour.';
  const primaryActionLabel = isEnded ? 'Combat terminé' : actionLabel;
  const primaryActionClass = [
    'hero-combat-main-action',
    isEnemyTurn ? 'is-enemy' : '',
    isSurvivalTurn ? 'is-survival' : '',
  ].filter(Boolean).join(' ');
  const closeCombatLabel = isEnded ? (combat.pendingSceneId ? 'Continuer' : 'Revenir à la scène') : 'Fuir';
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
  const topCloseHtml = isEnded ? '<button id="close-hero-combat" type="button" class="hero-combat-end-button hero-combat-end-button--top"><span>' + safeHtml(closeCombatLabel) + '</span><span aria-hidden="true">&rarr;</span></button>' : '';
  const endActionHtml = isEnded
    ? '<div class="hero-combat-end-panel"><span>Suite de l\\'aventure</span><button type="button" class="hero-combat-end-button hero-combat-end-button--primary" data-close-hero-combat="true"><span>' + safeHtml(closeCombatLabel) + '</span><span aria-hidden="true">&rarr;</span></button></div>'
    : '<div class="inline-actions"><button id="hero-combat-action" type="button" class="' + escapeAttr(primaryActionClass) + '"' + (actionDisabled ? ' disabled title="' + escapeAttr(actionDisabledReason || 'Action indisponible') + '"' : '') + '><span class="hero-combat-action-die" aria-hidden="true">d20</span><span>' + safeHtml(primaryActionLabel) + '</span></button></div>';

  return '<div class="hero-combat-overlay hero-combat-overlay--' + safeClassToken(combat.status || 'active', 'active') + (isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : '') + '"' + overlayStyle + '>'
    + '<div class="hero-combat-topline"><span>' + safeHtml(isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : 'Tour ' + (combat.round || 1)) + '</span><strong>' + safeHtml(enemyLabel) + '</strong>' + topCloseHtml + '</div>'
    + '<div class="hero-combat-stage">'
    + renderCombatActor(heroMedia, heroLabel, 'hero', { health: heroHealth, maxHealth: heroMaxHealth, mana: heroMana, maxMana: heroMaxMana, initiative: heroInitiative, isActive: !isEnemyTurn && !isSurvivalTurn && !isEnded, statusEffects: heroStatusEffects, activeEffectLabel: getActorEffectLabel('hero') })
    + (showDice ? '<div class="' + escapeAttr(diceSpotlightClass) + '"><span class="hero-combat-dice-aura" aria-hidden="true"></span><button id="hero-combat-action" type="button" class="hero-combat-die-button' + (lastCombatRoll ? ' has-result' : '') + '"' + (actionDisabled ? ' disabled title="' + escapeAttr(actionDisabledReason || 'Action indisponible') + '"' : '') + '><span class="hero-combat-die hero-d20' + (lastCombatRoll ? ' has-result' : '') + '"><span class="hero-d20-core" aria-hidden="true">' + d20SvgHtml + '</span><span class="hero-roll-die-value">' + safeHtml(lastCombatRoll?.raw || '?') + '</span></span></button>' + diceResultHtml + '<strong><span class="hero-combat-dice-kicker">' + safeHtml(lastCombatRoll ? 'Résultat' : project?.heroAdventure?.dice?.label || 'Dé') + '</span>' + safeHtml(lastCombatRoll ? lastCombatRoll.total + ' total' : project?.heroAdventure?.dice?.label || 'Dé') + '</strong><small>' + safeHtml(isEnded ? 'Combat terminé' : actionLabel) + '</small></div>' : '<div></div>')
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
    + (actionDisabledReason && !isEnded ? '<p class="hero-combat-action-disabled-reason" role="status">' + safeHtml(actionDisabledReason) + '</p>' : '')
    + endActionHtml
    + '</div></div>';
}

`;
