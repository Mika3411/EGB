import { applyRecovery } from '../../lib/combatEngine.js';
import {
  evaluateReplyCondition,
  getReplyConditionLockReason,
} from '../../lib/conditionEngine.js';

export function createPreviewConversationActions({
  project,
  activeConversation,
  askedConversationNodeIds,
  hiddenConversationReplyIds,
  chosenConversationReplyIds,
  heroState,
  engineRef,
  hotspotAudioRef,
  responseAmbienceAudioRef,
  getItemById,
  getPreviewConditionContext,
  addInventoryItem,
  removeInventoryItem,
  addAdventureJournalEntry,
  getJournalItemName,
  getStoryVariableLabel,
  getTargetLabel,
  applyHeroMalus,
  blockDefeatedHeroAction,
  captureLastChoiceSnapshot,
  markHotspotCompleted,
  goToScene,
  launchCinematic,
  getEnigmaById,
  openEnigma,
  runSkillCheckAction,
  runHeroCombatAction,
  setters,
}) {
  const {
    setActiveConversation,
    setActiveEnding,
    setChoiceEffectNotices,
    setDialogue,
    setStoryVariables,
    setViewerImage,
    setChosenConversationReplyIds,
    setAskedConversationNodeIds,
    setHiddenConversationReplyIds,
    setHeroState,
  } = setters;

  const playConversationReplyAudio = (audioData = '', { ambience = false } = {}) => {
    if (!audioData) return;
    const targetRef = ambience ? responseAmbienceAudioRef : hotspotAudioRef;
    if (targetRef.current) {
      targetRef.current.pause();
      targetRef.current.currentTime = 0;
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioData;
    audio.volume = ambience ? 0.45 : 0.85;
    audio.loop = Boolean(ambience);
    audio.play().catch(() => {});
    targetRef.current = audio;
  };

  const openConversation = (spot) => {
    const nodes = Array.isArray(spot?.conversation?.nodes) ? spot.conversation.nodes : [];
    const startNodeId = spot?.conversation?.startNodeId || nodes[0]?.id || '';
    const node = nodes.find((entry) => entry.id === startNodeId) || nodes[0] || null;
    if (!node) {
      if (spot?.dialogue) setDialogue(spot.dialogue);
      return false;
    }
    if (node.askOnce && askedConversationNodeIds.includes(node.id)) {
      setDialogue(spot?.dialogue || 'Cette question a déjà été posée.');
      return false;
    }
    setActiveConversation({
      sourceHotspotId: spot.id,
      conversation: spot.conversation,
      nodeId: node.id,
    });
    setAskedConversationNodeIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
    setDialogue(node.text || spot.dialogue || '');
    return true;
  };

  const closeConversation = () => {
    setActiveConversation(null);
  };

  const closeEnding = () => {
    setActiveEnding(null);
  };

  const clearChoiceEffectNotices = () => {
    setChoiceEffectNotices([]);
  };

  const openEnding = (reply = {}) => {
    const typeLabels = {
      good: 'Bonne fin',
      bad: 'Mauvaise fin',
      secret: 'Fin secrete',
      neutral: 'Fin neutre',
    };
    setActiveEnding({
      type: reply.endingType || 'neutral',
      label: typeLabels[reply.endingType || 'neutral'] || 'Fin',
      title: reply.endingTitle || typeLabels[reply.endingType || 'neutral'] || 'Fin',
      summary: reply.endingSummary || reply.dialogue || 'Ton aventure se termine ici.',
      message: reply.dialogue || '',
    });
  };

  const isConversationReplyAvailable = (reply = {}) => {
    if (reply.id && hiddenConversationReplyIds.includes(reply.id)) return false;
    if (reply.hideAfterChosen && reply.id && chosenConversationReplyIds.includes(reply.id)) return false;
    return evaluateReplyCondition(reply, getPreviewConditionContext());
  };

  const getConversationReplyLockReason = (reply = {}) => {
    if (isConversationReplyAvailable(reply)) return '';
    if (reply.id && hiddenConversationReplyIds.includes(reply.id)) return 'Choix masqué par une autre réponse';
    if (reply.hideAfterChosen && reply.id && chosenConversationReplyIds.includes(reply.id)) return 'Choix déjà utilisé';
    return getReplyConditionLockReason(reply, {
      ...getPreviewConditionContext(),
      project,
      getItemById,
      getStoryVariableLabel,
    });
  };

  const applyStoryVariableEffect = (reply = {}) => {
    if (!reply.storyVariableKey || (reply.storyVariableOperation || 'none') === 'none') return;
    setStoryVariables((prev) => {
      const key = reply.storyVariableKey.trim();
      if (!key) return prev;
      const operation = reply.storyVariableOperation || 'none';
      const rawValue = reply.storyVariableValue;
      if (operation === 'increment' || operation === 'decrement') {
        const amount = Number(rawValue) || 1;
        const current = Number(prev[key]) || 0;
        return { ...prev, [key]: operation === 'increment' ? current + amount : current - amount };
      }
      let nextValue = rawValue;
      if (rawValue === 'true') nextValue = true;
      if (rawValue === 'false') nextValue = false;
      return { ...prev, [key]: nextValue };
    });
  };

  const applyStoryVariableValue = (key, operation, rawValue) => {
    const variableKey = String(key || '').trim();
    if (!variableKey) return;
    setStoryVariables((prev) => {
      if (operation === 'increment' || operation === 'decrement') {
        const amount = Number(rawValue) || 1;
        const current = Number(prev[variableKey]) || 0;
        return { ...prev, [variableKey]: operation === 'increment' ? current + amount : current - amount };
      }
      let nextValue = rawValue;
      if (rawValue === 'true') nextValue = true;
      if (rawValue === 'false') nextValue = false;
      return { ...prev, [variableKey]: nextValue };
    });
  };

  const makeVariableEffectNotice = (key, operation, rawValue) => {
    const variableKey = String(key || '').trim();
    if (!variableKey || operation === 'none') return null;
    const label = getStoryVariableLabel(variableKey);
    if (operation === 'increment') return { type: 'variable', title: 'Variable', detail: `${label} +${Number(rawValue) || 1}` };
    if (operation === 'decrement') return { type: 'variable', title: 'Variable', detail: `${label} -${Number(rawValue) || 1}` };
    return { type: 'variable', title: 'Variable', detail: `${label} = ${String(rawValue)}` };
  };

  const applyConversationReplyEffects = (reply = {}) => {
    const effects = Array.isArray(reply.effects) ? reply.effects : [];
    const result = { messages: [], notices: [], nextNodeId: '', targetSceneId: '', targetCinematicId: '', enigmaId: '', ending: null };
    effects.forEach((effect) => {
      const type = effect.type || 'message';
      if (type === 'message' && effect.message) {
        result.messages.push(effect.message);
        result.notices.push({ type: 'message', title: 'Message', detail: effect.message });
      }
      if (type === 'add_item' && effect.itemId) {
        addInventoryItem(effect.itemId);
        const itemName = getJournalItemName(effect.itemId);
        addAdventureJournalEntry({ type: 'item', title: itemName, detail: effect.journalDetail || 'Objet obtenu.' });
        result.notices.push({ type: 'item', title: 'Objet obtenu', detail: itemName });
      }
      if (type === 'remove_item' && effect.itemId) {
        removeInventoryItem(effect.itemId);
        result.notices.push({ type: 'item', title: 'Objet retiré', detail: getJournalItemName(effect.itemId) });
      }
      if (type === 'heal_health' || type === 'heal_mana') {
        const amount = Math.max(0, Number(effect.value) || 0);
        const currentHero = engineRef.current.getState().heroState || heroState;
        const recovery = applyRecovery({
          health: currentHero.health,
          maxHealth: currentHero.maxHealth,
          mana: currentHero.mana,
          maxMana: currentHero.maxMana,
          healthGain: type === 'heal_health' ? amount : 0,
          manaGain: type === 'heal_mana' ? amount : 0,
        });
        const nextHero = { ...currentHero, health: recovery.health, mana: recovery.mana };
        engineRef.current.setState({ heroState: nextHero });
        setHeroState(nextHero);
        const detail = type === 'heal_health'
          ? `+${recovery.healthRecovered} PV (${nextHero.health}/${nextHero.maxHealth})`
          : `+${recovery.manaRecovered} mana (${nextHero.mana}/${nextHero.maxMana})`;
        result.notices.push({ type: 'hero', title: 'Récupération', detail });
      }
      if (type === 'set_variable') {
        applyStoryVariableValue(effect.variableKey, 'set', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'set', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'increment_variable') {
        applyStoryVariableValue(effect.variableKey, 'increment', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'increment', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'decrement_variable') {
        applyStoryVariableValue(effect.variableKey, 'decrement', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'decrement', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'journal') {
        const title = effect.journalTitle || 'Note';
        const detail = effect.journalDetail || effect.message || '';
        addAdventureJournalEntry({ type: 'note', title, detail });
        result.notices.push({ type: 'journal', title: 'Journal mis à jour', detail: [title, detail].filter(Boolean).join(' - ') });
      }
      if (type === 'next_node') {
        result.nextNodeId = effect.nextNodeId || result.nextNodeId;
        const node = (activeConversation?.conversation?.nodes || []).find((entry) => entry.id === effect.nextNodeId);
        result.notices.push({ type: 'route', title: 'Suite', detail: node?.text || node?.speaker || 'Autre question' });
      }
      if (type === 'scene') {
        result.targetSceneId = effect.targetSceneId || result.targetSceneId;
      }
      if (type === 'cinematic') {
        result.targetCinematicId = effect.targetCinematicId || result.targetCinematicId;
        result.notices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], effect.targetCinematicId, 'Cinématique') });
      }
      if (type === 'enigma') {
        result.enigmaId = effect.enigmaId || result.enigmaId;
        result.notices.push({ type: 'route', title: 'Enigme', detail: getTargetLabel(project.enigmas || [], effect.enigmaId, 'Enigme') });
      }
      if (type === 'ending') {
        result.ending = {
          endingType: effect.endingType || reply.endingType || 'neutral',
          endingTitle: effect.endingTitle || reply.endingTitle || '',
          endingSummary: effect.endingSummary || reply.endingSummary || '',
          dialogue: effect.message || reply.dialogue || '',
        };
        result.notices.push({ type: 'ending', title: 'Fin déclenchée', detail: effect.endingTitle || reply.endingTitle || 'Fin' });
      }
    });
    return result;
  };

  const chooseConversationReply = createChooseConversationReplyAction({
    project,
    activeConversation,
    askedConversationNodeIds,
    blockDefeatedHeroAction,
    isConversationReplyAvailable,
    captureLastChoiceSnapshot,
    addAdventureJournalEntry,
    getJournalItemName,
    addInventoryItem,
    playConversationReplyAudio,
    applyStoryVariableEffect,
    applyConversationReplyEffects,
    applyHeroMalus,
    makeVariableEffectNotice,
    markHotspotCompleted,
    closeConversation,
    openEnding,
    getTargetLabel,
    goToScene,
    launchCinematic,
    getEnigmaById,
    openEnigma,
    runSkillCheckAction,
    runHeroCombatAction,
    setters: {
      setViewerImage,
      setChosenConversationReplyIds,
      setHiddenConversationReplyIds,
      setChoiceEffectNotices,
      setAskedConversationNodeIds,
      setActiveConversation,
      setDialogue,
    },
  });

  return {
    openConversation,
    closeConversation,
    closeEnding,
    clearChoiceEffectNotices,
    isConversationReplyAvailable,
    getConversationReplyLockReason,
    chooseConversationReply,
  };
}

export function createChooseConversationReplyAction({
  project,
  activeConversation,
  askedConversationNodeIds,
  blockDefeatedHeroAction,
  isConversationReplyAvailable,
  captureLastChoiceSnapshot,
  addAdventureJournalEntry,
  getJournalItemName,
  addInventoryItem,
  playConversationReplyAudio,
  applyStoryVariableEffect,
  applyConversationReplyEffects,
  applyHeroMalus,
  makeVariableEffectNotice,
  markHotspotCompleted,
  closeConversation,
  openEnding,
  getTargetLabel,
  goToScene,
  launchCinematic,
  getEnigmaById,
  openEnigma,
  runSkillCheckAction,
  runHeroCombatAction,
  setters,
}) {
  const {
    setViewerImage,
    setChosenConversationReplyIds,
    setHiddenConversationReplyIds,
    setChoiceEffectNotices,
    setAskedConversationNodeIds,
    setActiveConversation,
    setDialogue,
  } = setters;

  return (reply = {}) => {
    if (blockDefeatedHeroAction()) return false;
    if (!activeConversation?.conversation) return false;
    if (!isConversationReplyAvailable(reply)) return false;
    captureLastChoiceSnapshot(reply.label || 'Avant réponse');
    const currentNode = (activeConversation.conversation.nodes || []).find((node) => node.id === activeConversation.nodeId);
    addAdventureJournalEntry({
      type: 'choice',
      title: reply.label || 'Choix',
      detail: currentNode?.text || '',
    });
    if (reply.responseImageData) {
      setViewerImage({
        src: reply.responseImageData,
        name: reply.responseImageName || reply.label || 'Image',
        caption: reply.dialogue || reply.label || '',
      });
    }
    if (reply.responseSoundData) playConversationReplyAudio(reply.responseSoundData);
    if (reply.ambienceSoundData) playConversationReplyAudio(reply.ambienceSoundData, { ambience: true });
    applyStoryVariableEffect(reply);
    const effectResult = applyConversationReplyEffects(reply);
    if (reply.id) {
      setChosenConversationReplyIds((prev) => (prev.includes(reply.id) ? prev : [...prev, reply.id]));
    }
    const replyIdsToHide = Array.isArray(reply.hideReplyIdsAfterChosen) ? reply.hideReplyIdsAfterChosen.filter(Boolean) : [];
    if (replyIdsToHide.length) {
      setHiddenConversationReplyIds((prev) => [...new Set([...prev, ...replyIdsToHide])]);
    }
    const actionType = reply.actionType || (reply.nextNodeId ? 'node' : 'end');
    const message = applyHeroMalus(reply, reply.dialogue || reply.label || '');
    const combinedMessage = [message, ...effectResult.messages].filter(Boolean).join(' ');
    if (combinedMessage) setDialogue(combinedMessage);

    const legacyVariableNotice = makeVariableEffectNotice(
      reply.storyVariableKey,
      reply.storyVariableOperation || 'none',
      reply.storyVariableValue,
    );
    const nextChoiceNotices = [
      combinedMessage ? { type: 'message', title: 'Message affiché', detail: combinedMessage } : null,
      reply.responseImageData ? { type: 'media', title: 'Image affichée', detail: reply.responseImageName || reply.label || 'Image de réponse' } : null,
      reply.responseSoundData ? { type: 'media', title: 'Son joué', detail: 'Effet sonore' } : null,
      reply.ambienceSoundData ? { type: 'media', title: 'Ambiance lancée', detail: 'Son d’ambiance' } : null,
      legacyVariableNotice,
      ...effectResult.notices,
    ].filter(Boolean);

    if (reply.rewardItemId) {
      addInventoryItem(reply.rewardItemId);
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemName(reply.rewardItemId),
        detail: 'Indice ou objet obtenu.',
      });
      nextChoiceNotices.push({ type: 'item', title: 'Objet obtenu', detail: getJournalItemName(reply.rewardItemId) });
    }
    if (effectResult.ending) {
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      openEnding(effectResult.ending);
      return true;
    }
    if (actionType === 'skill_check') {
      setChoiceEffectNotices(nextChoiceNotices);
      return runSkillCheckAction(reply, {
        closeConversation: true,
        conversation: activeConversation.conversation,
        sourceHotspotId: activeConversation.sourceHotspotId,
      });
    }
    if (actionType === 'hero_combat') {
      setChoiceEffectNotices(nextChoiceNotices);
      return runHeroCombatAction(reply, {
        closeConversation: true,
        conversation: activeConversation.conversation,
        sourceHotspotId: activeConversation.sourceHotspotId,
      });
    }
    const targetSceneId = effectResult.targetSceneId || reply.targetSceneId;
    if (targetSceneId && (actionType === 'scene' || effectResult.targetSceneId)) {
      setChoiceEffectNotices(nextChoiceNotices);
      closeConversation();
      return goToScene(targetSceneId, combinedMessage || 'Nouvelle scène.');
    }
    const targetCinematicId = effectResult.targetCinematicId || reply.targetCinematicId;
    if (targetCinematicId && (actionType === 'cinematic' || effectResult.targetCinematicId)) {
      if (!effectResult.targetCinematicId) {
        nextChoiceNotices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], targetCinematicId, 'Cinématique') });
      }
      setChoiceEffectNotices(nextChoiceNotices);
      closeConversation();
      return launchCinematic(targetCinematicId);
    }
    const targetEnigmaId = effectResult.enigmaId || reply.enigmaId;
    if (targetEnigmaId && (actionType === 'enigma' || effectResult.enigmaId)) {
      const enigma = getEnigmaById(targetEnigmaId);
      if (enigma) {
        if (!effectResult.enigmaId) {
          nextChoiceNotices.push({ type: 'route', title: 'Enigme', detail: enigma.name || 'Enigme' });
        }
        setChoiceEffectNotices(nextChoiceNotices);
        closeConversation();
        openEnigma(enigma, null);
        return true;
      }
    }
    if (actionType === 'ending') {
      nextChoiceNotices.push({ type: 'ending', title: 'Fin déclenchée', detail: reply.endingTitle || 'Fin' });
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      openEnding(reply);
      return true;
    }
    if (actionType === 'end') {
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      return true;
    }

    const nextNodeId = effectResult.nextNodeId || reply.nextNodeId;
    const nextNode = (activeConversation.conversation.nodes || []).find((node) => node.id === nextNodeId);
    if (nextNode) {
      if (nextNode.askOnce && askedConversationNodeIds.includes(nextNode.id)) {
        setChoiceEffectNotices(nextChoiceNotices);
        setDialogue(combinedMessage || 'Cette question a déjà été posée.');
        closeConversation();
        return true;
      }
      if (!effectResult.nextNodeId) {
        nextChoiceNotices.push({ type: 'route', title: 'Suite', detail: nextNode.text || nextNode.speaker || 'Autre question' });
      }
      setChoiceEffectNotices(nextChoiceNotices);
      setAskedConversationNodeIds((prev) => (prev.includes(nextNode.id) ? prev : [...prev, nextNode.id]));
      setActiveConversation((current) => ({
        ...current,
        nodeId: nextNode.id,
        portraitData: reply.npcPortraitData || current?.portraitData || '',
        portraitName: reply.npcPortraitName || current?.portraitName || '',
      }));
      setDialogue([combinedMessage, nextNode.text].filter(Boolean).join(' '));
      return true;
    }
    setChoiceEffectNotices(nextChoiceNotices);
    closeConversation();
    return true;
  };
}
