export const standaloneHeroRuntime = `function getCombatEntryValue(entry, key, fallback) {
  return entry?.[key] === undefined || entry?.[key] === '' || entry?.[key] === null ? fallback : entry[key];
}

function getStandaloneCombatSettings() {
  const combat = project?.heroAdventure?.combat && typeof project.heroAdventure.combat === 'object' ? project.heroAdventure.combat : {};
  return {
    ...DEFAULT_COMBAT_SETTINGS,
    ...combat,
  };
}

function getStandaloneCombatStats(entry = {}) {
  return getCombatSimulationStats({
    ...project,
    heroAdventure: {
      ...(project.heroAdventure || {}),
      hero: state.heroState || getInitialHeroState(),
      rules: (state.heroState || getInitialHeroState()).rules || project.heroAdventure?.rules || {},
    },
  }, entry, getStandaloneCombatSettings());
}

function getHeroPowerById(powerId = '') {
  return ((state.heroState?.powers || []).find((power) => power.id === powerId) || null);
}

function getCombatPowerTypeLabel(type) {
  return getPowerTypeLabel(type).toLowerCase();
}

function setHeroCombatState(combatId, nextCombatState) {
  if (!combatId) return {};
  const currentStates = state.heroCombatStates && typeof state.heroCombatStates === 'object' ? state.heroCombatStates : {};
  state.heroCombatStates = {
    ...currentStates,
    [combatId]: {
      ...(currentStates[combatId] || {}),
      ...nextCombatState,
    },
  };
  return state.heroCombatStates[combatId];
}

function applyHeroHealthLoss(loss = 0, options = {}) {
  const damage = Math.max(0, Number(loss) || 0);
  const currentHero = state.heroState || getInitialHeroState();
  if (!damage) return currentHero;
  state.heroState = {
    ...currentHero,
    health: Math.max(0, (Number(currentHero.health) || 0) - damage),
  };
  if (options.triggerDefeatScene !== false) triggerHeroDefeatScene(state.heroState);
  return state.heroState;
}

function applyHeroMalus(entry = {}, baseMessage = '') {
  if (!IS_HERO_ADVENTURE) return baseMessage;
  const healthLoss = Math.max(0, Number(entry.heroMalusHealthLoss) || 0);
  const manaLoss = Math.max(0, Number(entry.heroMalusManaLoss) || 0);
  if (!healthLoss && !manaLoss) return baseMessage;

  const currentHero = state.heroState || getInitialHeroState();
  const maxHealth = Math.max(0, Number(currentHero.maxHealth) || 0);
  const maxMana = Math.max(0, Number(currentHero.maxMana) || 0);
  const nextHero = {
    ...currentHero,
    health: Math.max(0, Math.min(maxHealth, (Number(currentHero.health) || 0) - healthLoss)),
    mana: Math.max(0, Math.min(maxMana, (Number(currentHero.mana) || 0) - manaLoss)),
  };
  state.heroState = nextHero;
  triggerHeroDefeatScene(nextHero);
  const lossParts = [
    healthLoss ? '-' + healthLoss + ' PV' : '',
    manaLoss ? '-' + manaLoss + ' mana' : '',
  ].filter(Boolean);
  const malusMessage = entry.heroMalusMessage || ('Mauvais chemin: ' + lossParts.join(', ') + '.');
  const statusMessage = 'Hero: ' + nextHero.health + '/' + nextHero.maxHealth + ' PV, ' + nextHero.mana + '/' + nextHero.maxMana + ' mana.';
  return [baseMessage, malusMessage, statusMessage].filter(Boolean).join(' ');
}

function recoverHero(healthGain = 0, manaGain = 0) {
  const currentHero = state.heroState || getInitialHeroState();
  const recovery = applyRecovery({
    health: currentHero.health,
    maxHealth: currentHero.maxHealth,
    mana: currentHero.mana,
    maxMana: currentHero.maxMana,
    healthGain,
    manaGain,
  });
  state.heroState = { ...currentHero, health: recovery.health, mana: recovery.mana };
  return { hero: state.heroState, recovery };
}

function addInventoryItem(itemId) {
  if (!itemId) return false;
  if (!state.inventory.includes(itemId)) {
    state.inventory = addRewardItemToInventory(state.inventory, itemId);
  }
  if (!state.selectedInventoryIds.includes(itemId)) {
    state.selectedInventoryIds = selectRewardInventoryItem(state.selectedInventoryIds, itemId);
  }
  return true;
}

function consumeHeroInventoryItem(itemId) {
  if (!itemId) return;
  state.inventory = consumeInventoryItem(state.inventory || [], itemId);
  state.selectedInventoryIds = (state.selectedInventoryIds || []).filter((id) => id !== itemId);
  if (state.viewerImage?.id === itemId) state.viewerImage = null;
}

function normalizeEquippedHeroSlotMap(value = {}) {
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, itemId]) => itemId))
    : {};
}

function getHeroEquipmentSlotCount() {
  return Math.max(1, Math.min(8, Number(project?.heroAdventure?.hero?.equipmentSlotCount || 6)));
}

function getNextEquippedHeroSlotMap(itemId, slotIndex) {
  const currentMap = normalizeEquippedHeroSlotMap(state.equippedHeroSlotMap || {});
  const nextMap = Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
  const slotCount = getHeroEquipmentSlotCount();
  const hasRequestedSlot = slotIndex !== null && slotIndex !== undefined && slotIndex !== '';
  const requestedSlot = Number(slotIndex);
  const targetSlot = hasRequestedSlot && Number.isFinite(requestedSlot)
    ? Math.max(0, Math.min(slotCount - 1, Math.round(requestedSlot)))
    : Array.from({ length: slotCount }, (_, index) => index).find((index) => !nextMap[String(index)]);
  if (targetSlot !== undefined && targetSlot !== null) nextMap[String(targetSlot)] = itemId;
  return nextMap;
}

function removeItemFromEquippedHeroSlotMap(itemId) {
  const currentMap = normalizeEquippedHeroSlotMap(state.equippedHeroSlotMap || {});
  return Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
}

function getHeroEquipmentBonusLabel(item = {}) {
  const bonus = Number(item.heroItemBonus) || 1;
  const sign = bonus >= 0 ? '+' : '';
  const bonusTarget = item.heroItemBonusTarget || 'skill';
  if (bonusTarget === 'maxHealth') return 'PV max ' + sign + bonus;
  if (bonusTarget === 'maxMana') return 'Mana max ' + sign + bonus;
  const hero = state.heroState || getInitialHeroState();
  const skill = (hero.skills || []).find((entry) => entry.id === item.heroItemSkillId) || (hero.skills || [])[0];
  return (skill?.name || 'Competence') + ' ' + sign + bonus;
}

function getHeroItemBadgeLabel(item = {}) {
  if (!IS_HERO_ADVENTURE) return '';
  const itemType = item.heroItemType || 'none';
  if (itemType === 'equipment') {
    return (state.equippedHeroItemIds || []).includes(item.id) ? 'Equipe' : 'A porter';
  }
  if (itemType === 'health_potion' || itemType === 'mana_potion') return 'Consommable';
  return '';
}

function applyHeroItem(item, slotIndex = null) {
  if (!item || !IS_HERO_ADVENTURE) return false;
  const itemType = item.heroItemType || 'none';
  if (itemType === 'none') return false;

  if (itemType === 'health_potion') {
    const amount = Math.max(1, Number(item.heroItemAmount) || 4);
    const currentHero = state.heroState || getInitialHeroState();
    const recovery = applyRecovery({
      health: currentHero.health,
      maxHealth: currentHero.maxHealth,
      mana: currentHero.mana,
      maxMana: currentHero.maxMana,
      healthGain: amount,
    });
    state.heroState = { ...currentHero, health: recovery.health, mana: recovery.mana };
    if (item.heroItemConsumeOnUse ?? true) consumeHeroInventoryItem(item.id);
    state.dialogue = (item.name || 'Potion') + ' utilisee: +' + (recovery.healthRecovered || 0) + ' PV (' + state.heroState.health + '/' + state.heroState.maxHealth + ').';
    return true;
  }

  if (itemType === 'mana_potion') {
    const amount = Math.max(1, Number(item.heroItemAmount) || 3);
    const currentHero = state.heroState || getInitialHeroState();
    const recovery = applyRecovery({
      health: currentHero.health,
      maxHealth: currentHero.maxHealth,
      mana: currentHero.mana,
      maxMana: currentHero.maxMana,
      manaGain: amount,
    });
    state.heroState = { ...currentHero, health: recovery.health, mana: recovery.mana };
    if (item.heroItemConsumeOnUse ?? true) consumeHeroInventoryItem(item.id);
    state.dialogue = (item.name || 'Potion') + ' utilisee: +' + (recovery.manaRecovered || 0) + ' mana (' + state.heroState.mana + '/' + state.heroState.maxMana + ').';
    return true;
  }

  if (itemType === 'equipment') {
    const currentEquippedIds = Array.isArray(state.equippedHeroItemIds) ? state.equippedHeroItemIds : [];
    if (currentEquippedIds.includes(item.id)) {
      state.equippedHeroSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
      state.dialogue = (item.name || 'Equipement') + ' deplace.';
      return true;
    }

    const currentHero = state.heroState || getInitialHeroState();
    const bonusTarget = item.heroItemBonusTarget || 'skill';
    const skillId = item.heroItemSkillId || currentHero.skills?.[0]?.id || '';
    const bonus = Number(item.heroItemBonus) || 1;
    let nextHero = currentHero;
    if (bonusTarget === 'maxHealth') {
      const nextMaxHealth = Math.max(1, (Number(currentHero.maxHealth) || 1) + bonus);
      nextHero = {
        ...currentHero,
        maxHealth: nextMaxHealth,
        health: Math.max(0, Math.min(nextMaxHealth, (Number(currentHero.health) || 0) + Math.max(0, bonus))),
      };
    } else if (bonusTarget === 'maxMana') {
      const nextMaxMana = Math.max(0, (Number(currentHero.maxMana) || 0) + bonus);
      nextHero = {
        ...currentHero,
        maxMana: nextMaxMana,
        mana: Math.max(0, Math.min(nextMaxMana, (Number(currentHero.mana) || 0) + Math.max(0, bonus))),
      };
    } else {
      nextHero = {
        ...currentHero,
        skills: (currentHero.skills || []).map((skill) => (
          skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) + bonus } : skill
        )),
      };
    }

    state.heroState = nextHero;
    state.equippedHeroItemIds = [...currentEquippedIds, item.id];
    state.equippedHeroSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
    state.dialogue = (item.name || 'Equipement') + ' equipe: ' + getHeroEquipmentBonusLabel(item) + '.';
    return true;
  }

  return false;
}

function equipHeroItem(itemId, slotIndex = null) {
  if (blockDefeatedHeroAction()) return false;
  const item = getItemById(itemId);
  if (!item || (item.heroItemType || 'none') !== 'equipment') return false;
  return applyHeroItem(item, slotIndex);
}

function unequipHeroItem(itemId) {
  if (blockDefeatedHeroAction()) return false;
  const item = getItemById(itemId);
  if (!item || !IS_HERO_ADVENTURE || (item.heroItemType || 'none') !== 'equipment') return false;
  const currentEquippedIds = Array.isArray(state.equippedHeroItemIds) ? state.equippedHeroItemIds : [];
  if (!currentEquippedIds.includes(itemId)) return false;

  const currentHero = state.heroState || getInitialHeroState();
  const bonusTarget = item.heroItemBonusTarget || 'skill';
  const bonus = Number(item.heroItemBonus) || 1;
  let nextHero = currentHero;
  if (bonusTarget === 'maxHealth') {
    const nextMaxHealth = Math.max(1, (Number(currentHero.maxHealth) || 1) - bonus);
    nextHero = {
      ...currentHero,
      maxHealth: nextMaxHealth,
      health: Math.max(0, Math.min(nextMaxHealth, Number(currentHero.health) || 0)),
    };
  } else if (bonusTarget === 'maxMana') {
    const nextMaxMana = Math.max(0, (Number(currentHero.maxMana) || 0) - bonus);
    nextHero = {
      ...currentHero,
      maxMana: nextMaxMana,
      mana: Math.max(0, Math.min(nextMaxMana, Number(currentHero.mana) || 0)),
    };
  } else {
    const skillId = item.heroItemSkillId || currentHero.skills?.[0]?.id || '';
    nextHero = {
      ...currentHero,
      skills: (currentHero.skills || []).map((skill) => (
        skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) - bonus } : skill
      )),
    };
  }

  state.heroState = nextHero;
  state.equippedHeroItemIds = currentEquippedIds.filter((id) => id !== itemId);
  state.equippedHeroSlotMap = removeItemFromEquippedHeroSlotMap(itemId);
  const label = bonusTarget === 'maxHealth'
    ? 'PV max'
    : bonusTarget === 'maxMana'
      ? 'mana max'
      : ((nextHero.skills || []).find((entry) => entry.id === item.heroItemSkillId)?.name || 'competence');
  state.dialogue = (item.name || 'Equipement') + ' retire: ' + label + ' ' + (bonus >= 0 ? '-' : '+') + Math.abs(bonus) + '.';
  return true;
}

function renderStandaloneHeroEquipmentSummary() {
  if (!IS_HERO_ADVENTURE) return '';
  const equippedIds = Array.isArray(state.equippedHeroItemIds) ? state.equippedHeroItemIds : [];
  const equippedItems = equippedIds.map((itemId) => getItemById(itemId)).filter(Boolean);
  if (!equippedItems.length) return '';
  return '<div class="hero-equipment-summary"><strong>Objets portes</strong><div class="hero-equipped-list">'
    + equippedItems.map((item) => {
      const itemImageUrl = resolveAssetUrl(item.imageId, item.imageData);
      return '<button type="button" class="hero-equipped-item" data-hero-unequip-id="' + escapeAttr(item.id || '') + '">'
        + (itemImageUrl ? '<img src="' + escapeMediaAttr(itemImageUrl, 'image') + '" alt="' + escapeAttr(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '*') + '</span>')
        + '<strong>' + safeHtml(item.name || 'Equipement') + '</strong>'
        + '<small>' + safeHtml(getHeroEquipmentBonusLabel(item)) + '</small></button>';
    }).join('')
    + '</div></div>';
}

function isHeroDefeated() {
  return Boolean(IS_HERO_ADVENTURE && Number((state.heroState || getInitialHeroState()).health || 0) <= 0);
}

function triggerHeroDefeatScene(nextHero = state.heroState || getInitialHeroState()) {
  const defeatSceneId = project?.heroAdventure?.hero?.defeatSceneId || '';
  if (!IS_HERO_ADVENTURE || !defeatSceneId || Number(nextHero.health || 0) > 0) return false;
  if (state.playSceneId === defeatSceneId) return false;
  return goToScene(defeatSceneId, 'Le héros tombe à 0 PV.');
}

function blockDefeatedHeroAction() {
  if (!isHeroDefeated()) return false;
  state.dialogue = 'Le héros est à 0 PV. Les actions sont bloquées.';
  return true;
}

`;
