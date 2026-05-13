import { applyRecovery } from '../../lib/combatEngine.js';
import { clampNumber } from './previewPlayerDefaults.js';

export function createPreviewInventoryActions({
  project,
  heroAdventure,
  heroState,
  equippedHeroItemIds,
  equippedHeroSlotMap,
  viewerImage,
  engineRef,
  getItemById,
  patchPreviewState,
  blockDefeatedHeroAction,
  updateHeroState,
  setters,
}) {
  const {
    setDialogue,
    setInventory,
    setSelectedInventoryIds,
    setViewerImage,
    setEquippedHeroItemIds,
    setEquippedHeroSlotMap,
  } = setters;

  const consumeInventoryItem = (itemId) => {
    if (!itemId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      inventory: (state.inventory || []).filter((id) => id !== itemId),
      selectedInventoryIds: (state.selectedInventoryIds || []).filter((id) => id !== itemId),
      viewerImage: state.viewerImage?.id === itemId ? null : state.viewerImage,
    });
  };

  const normalizeEquippedHeroSlotMap = (value = {}) => (
    value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, itemId]) => itemId))
      : {}
  );

  const getNextEquippedHeroSlotMap = (itemId, slotIndex) => {
    const currentMap = normalizeEquippedHeroSlotMap(
      engineRef.current.getState().equippedHeroSlotMap || equippedHeroSlotMap
    );
    const nextMap = Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
    const slotCount = Math.max(1, Math.min(8, Number(heroAdventure?.hero.equipmentSlotCount || 6)));
    const hasRequestedSlot = slotIndex !== null && slotIndex !== undefined && slotIndex !== '';
    const requestedSlot = Number(slotIndex);
    const targetSlot = hasRequestedSlot && Number.isFinite(requestedSlot)
      ? Math.max(0, Math.min(slotCount - 1, Math.round(requestedSlot)))
      : Array.from({ length: slotCount }, (_, index) => index).find((index) => !nextMap[String(index)]);
    if (targetSlot !== undefined && targetSlot !== null) nextMap[String(targetSlot)] = itemId;
    return nextMap;
  };

  const removeItemFromEquippedHeroSlotMap = (itemId) => {
    const currentMap = normalizeEquippedHeroSlotMap(
      engineRef.current.getState().equippedHeroSlotMap || equippedHeroSlotMap
    );
    return Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
  };

  const applyHeroItem = (item, slotIndex = null) => {
    if (!item || !heroAdventure.enabled) return false;
    const itemType = item.heroItemType || 'none';
    if (itemType === 'none') return false;

    if (itemType === 'health_potion') {
      const amount = Math.max(1, Number(item.heroItemAmount) || 4);
      let recovery = null;
      const nextHero = updateHeroState((current) => {
        recovery = applyRecovery({
          health: current.health,
          maxHealth: current.maxHealth,
          mana: current.mana,
          maxMana: current.maxMana,
          healthGain: amount,
        });
        return { ...current, health: recovery.health, mana: recovery.mana };
      });
      if (item.heroItemConsumeOnUse ?? true) consumeInventoryItem(item.id);
      setDialogue(`${item.name || 'Potion'} utilisée: +${recovery?.healthRecovered || 0} PV (${nextHero.health}/${nextHero.maxHealth}).`);
      return true;
    }

    if (itemType === 'mana_potion') {
      const amount = Math.max(1, Number(item.heroItemAmount) || 3);
      let recovery = null;
      const nextHero = updateHeroState((current) => {
        recovery = applyRecovery({
          health: current.health,
          maxHealth: current.maxHealth,
          mana: current.mana,
          maxMana: current.maxMana,
          manaGain: amount,
        });
        return { ...current, health: recovery.health, mana: recovery.mana };
      });
      if (item.heroItemConsumeOnUse ?? true) consumeInventoryItem(item.id);
      setDialogue(`${item.name || 'Potion'} utilisée: +${recovery?.manaRecovered || 0} mana (${nextHero.mana}/${nextHero.maxMana}).`);
      return true;
    }

    if (itemType === 'equipment') {
      const currentEquippedIds = engineRef.current.getState().equippedHeroItemIds || equippedHeroItemIds || [];
      if (currentEquippedIds.includes(item.id)) {
        const nextSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
        engineRef.current.setState({ equippedHeroSlotMap: nextSlotMap });
        setEquippedHeroSlotMap(nextSlotMap);
        setDialogue(`${item.name || 'Equipement'} deplace.`);
        return true;
      }
      const bonusTarget = item.heroItemBonusTarget || 'skill';
      const skillId = item.heroItemSkillId || heroState.skills?.[0]?.id || '';
      const bonus = Number(item.heroItemBonus) || 1;
      const nextHero = updateHeroState((current) => {
        if (bonusTarget === 'maxHealth') {
          const nextMaxHealth = Math.max(1, (Number(current.maxHealth) || 1) + bonus);
          return {
            ...current,
            maxHealth: nextMaxHealth,
            health: clampNumber((Number(current.health) || 0) + Math.max(0, bonus), 0, nextMaxHealth),
          };
        }
        if (bonusTarget === 'maxMana') {
          const nextMaxMana = Math.max(0, (Number(current.maxMana) || 0) + bonus);
          return {
            ...current,
            maxMana: nextMaxMana,
            mana: clampNumber((Number(current.mana) || 0) + Math.max(0, bonus), 0, nextMaxMana),
          };
        }
        return {
          ...current,
          skills: (current.skills || []).map((skill) => (
            skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) + bonus } : skill
          )),
        };
      });
      const nextEquipped = [...currentEquippedIds, item.id];
      const nextSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
      engineRef.current.setState({ equippedHeroItemIds: nextEquipped, equippedHeroSlotMap: nextSlotMap });
      setEquippedHeroItemIds(nextEquipped);
      setEquippedHeroSlotMap(nextSlotMap);
      const skill = nextHero.skills?.find((entry) => entry.id === skillId);
      const targetLabel = bonusTarget === 'maxHealth'
        ? 'PV max'
        : bonusTarget === 'maxMana'
          ? 'mana max'
          : skill?.name || 'compétence';
      setDialogue(`${item.name || '?quipement'} ?quip?: ${targetLabel} ${bonus >= 0 ? '+' : ''}${bonus}.`);
      return true;
    }

    return false;
  };

  const equipHeroItem = (itemId, slotIndex = null) => {
    if (blockDefeatedHeroAction()) return false;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item || (item.heroItemType || 'none') !== 'equipment') return false;
    return applyHeroItem(item, slotIndex);
  };

  const unequipHeroItem = (itemId) => {
    if (blockDefeatedHeroAction()) return false;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item || !heroAdventure.enabled || (item.heroItemType || 'none') !== 'equipment') return false;
    const currentEquippedIds = engineRef.current.getState().equippedHeroItemIds || equippedHeroItemIds || [];
    if (!currentEquippedIds.includes(itemId)) return false;

    const bonusTarget = item.heroItemBonusTarget || 'skill';
    const bonus = Number(item.heroItemBonus) || 1;
    const nextHero = updateHeroState((current) => {
      if (bonusTarget === 'maxHealth') {
        const nextMaxHealth = Math.max(1, (Number(current.maxHealth) || 1) - bonus);
        return {
          ...current,
          maxHealth: nextMaxHealth,
          health: clampNumber(Number(current.health) || 0, 0, nextMaxHealth),
        };
      }
      if (bonusTarget === 'maxMana') {
        const nextMaxMana = Math.max(0, (Number(current.maxMana) || 0) - bonus);
        return {
          ...current,
          maxMana: nextMaxMana,
          mana: clampNumber(Number(current.mana) || 0, 0, nextMaxMana),
        };
      }
      const skillId = item.heroItemSkillId || current.skills?.[0]?.id || '';
      return {
        ...current,
        skills: (current.skills || []).map((skill) => (
          skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) - bonus } : skill
        )),
      };
    });

    const nextEquipped = currentEquippedIds.filter((id) => id !== itemId);
    const nextSlotMap = removeItemFromEquippedHeroSlotMap(itemId);
    engineRef.current.setState({ equippedHeroItemIds: nextEquipped, equippedHeroSlotMap: nextSlotMap });
    setEquippedHeroItemIds(nextEquipped);
    setEquippedHeroSlotMap(nextSlotMap);
    const skill = nextHero.skills?.find((entry) => entry.id === item.heroItemSkillId);
    const targetLabel = bonusTarget === 'maxHealth'
      ? 'PV max'
      : bonusTarget === 'maxMana'
        ? 'mana max'
        : skill?.name || 'compétence';
    setDialogue(`${item.name || 'Equipement'} retire: ${targetLabel} ${bonus >= 0 ? '-' : '+'}${Math.abs(bonus)}.`);
    return true;
  };

  const openInventoryItem = (itemId) => {
    if (blockDefeatedHeroAction()) return;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (applyHeroItem(item)) return;
    if (item.imageData) {
      setViewerImage({ id: item.id, src: item.imageData, name: item.name });
    }
    setSelectedInventoryIds((prev) => {
      const exists = prev.includes(itemId);
      if (exists) return prev.filter((id) => id !== itemId);
      if (prev.length >= 2) return [prev[1], itemId];
      return [...prev, itemId];
    });
  };

  const removeInventoryItemReferences = (itemId) => {
    engineRef.current.setState({
      inventory: engineRef.current.getState().inventory.filter((id) => id !== itemId),
      selectedInventoryIds: engineRef.current.getState().selectedInventoryIds.filter((id) => id !== itemId),
      viewerImage: engineRef.current.getState().viewerImage?.id === itemId ? null : engineRef.current.getState().viewerImage,
      equippedHeroItemIds: (engineRef.current.getState().equippedHeroItemIds || []).filter((id) => id !== itemId),
      equippedHeroSlotMap: removeItemFromEquippedHeroSlotMap(itemId),
    });
    setInventory((prev) => prev.filter((id) => id !== itemId));
    setSelectedInventoryIds((prev) => prev.filter((id) => id !== itemId));
    setEquippedHeroItemIds((prev) => prev.filter((id) => id !== itemId));
    setEquippedHeroSlotMap((prev) => Object.fromEntries(Object.entries(prev || {}).filter(([, id]) => id !== itemId)));
    if (viewerImage?.id === itemId) setViewerImage(null);
  };

  return {
    equipHeroItem,
    unequipHeroItem,
    openInventoryItem,
    removeInventoryItemReferences,
  };
}
