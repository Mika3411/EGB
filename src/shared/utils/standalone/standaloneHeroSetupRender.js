export const standaloneHeroSetupRender = `function renderHeroSetupOverlay() {
  if (!IS_HERO_ADVENTURE || state.heroSetupComplete) return '';
  const hero = state.heroState || getInitialHeroState();
  const heroChoices = getHeroChoices();
  const hasRolledSkills = (hero.skills || []).some((skill) => Number(skill.rolledValue) > 0);
  const showCharacterGallery = !state.heroSetupSelectionConfirmed && !hasRolledSkills;
  const galleryIndex = getStandaloneHeroGalleryIndex();
  const activeChoice = heroChoices[galleryIndex] || hero || {};
  const activeSkills = (activeChoice.skills || []).slice(0, 4);
  const activePortrait = resolveAssetUrl(activeChoice.characterImageId, activeChoice.characterImageData) || activeChoice.characterImageData || '';
  const setupBackgroundImageData = hero.setupBackgroundImageData || '';
  const backgroundImage = safeMediaUrl(setupBackgroundImageData, 'image');
  const setupBackgroundCssImage = cssMediaUrl(setupBackgroundImageData, 'image');
  const setupStyle = backgroundImage ? ' style="background-image:linear-gradient(180deg,rgba(8,16,30,.44),rgba(8,16,30,.74)), ' + setupBackgroundCssImage + '"' : '';
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
      + '<div class="hero-setup-actions"><button type="button" data-hero-select="' + safeDataAttr(activeChoice.id || '') + '">Sélectionner ce personnage</button></div>'
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

`;
