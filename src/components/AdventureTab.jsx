import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, EyeOff, Flag, GitBranch, ListChecks, Plus, Search, SlidersHorizontal, Trash2, Variable } from 'lucide-react';
import { showConfirm } from './AccessibleDialog';
import HelpLabel from './forms/HelpLabel.jsx';

const ENDING_TYPE_LABELS = {
  good: 'Bonne fin',
  bad: 'Mauvaise fin',
  secret: 'Fin secrète',
  neutral: 'Fin neutre',
};

const CONDITION_LABELS = {
  has_item: 'Objet requis',
  visited_scene: 'Scène visitée',
  completed_hotspot: 'Zone utilisée',
  solved_enigma: 'Énigme résolue',
  chose_reply: 'Choix précédent',
  story_variable: 'Variable',
  advanced: 'Conditions avancées',
};

const ACTION_LABELS = {
  node: 'Autre question',
  dialogue: 'Message',
  item: 'Objet',
  multiple: 'Actions multiples',
  skill_check: 'Test de compétence',
  hero_combat: 'Combat simple',
  scene: 'Scène',
  cinematic: 'Cinématique',
  enigma: 'Énigme',
  ending: 'Fin',
  end: 'Fin conversation',
};

const VARIABLE_TYPE_LABELS = {
  number: 'Nombre',
  boolean: 'Booleen',
  text: 'Texte',
};

const makeVariableId = () => `story_variable_${Math.random().toString(36).slice(2, 10)}`;

const normalizeVariableDefaultValue = (type, value) => {
  if (type === 'number') return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (type === 'boolean') return value === true || value === 'true';
  return String(value ?? '');
};

const getAllHotspots = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || []).map((hotspot) => ({ ...hotspot, sceneId: scene.id, sceneName: scene.name }))
  ))
);

const getConversationEntries = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((hotspot) => hotspot.actionType === 'conversation')
      .flatMap((hotspot) => (
        (hotspot.conversation?.nodes || []).flatMap((node, nodeIndex) => (
          (node.replies || []).map((reply, replyIndex) => ({
            scene,
            hotspot,
            node,
            nodeIndex,
            reply,
            replyIndex,
            id: `${scene.id}-${hotspot.id}-${node.id}-${reply.id}`,
          }))
        ))
      ))
  ))
);

const getConversationNodes = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((hotspot) => hotspot.actionType === 'conversation')
      .flatMap((hotspot) => (
        (hotspot.conversation?.nodes || []).map((node) => ({ scene, hotspot, node }))
      ))
  ))
);

const getTargetLabel = (entry, project, getSceneLabel) => {
  const { reply } = entry;
  const actionType = reply.actionType || 'node';
  if (actionType === 'node' || actionType === 'dialogue' || actionType === 'multiple') {
    const targetNode = (entry.hotspot.conversation?.nodes || []).find((node) => node.id === reply.nextNodeId);
    return targetNode ? `Question: ${targetNode.speaker || 'PNJ'} - ${(targetNode.text || 'Sans texte').slice(0, 42)}` : 'Ferme la conversation';
  }
  if (actionType === 'scene') return `Scène: ${getSceneLabel(reply.targetSceneId) || 'non choisie'}`;
  if (actionType === 'cinematic') return `Cinématique: ${(project.cinematics || []).find((cine) => cine.id === reply.targetCinematicId)?.name || 'non choisie'}`;
  if (actionType === 'enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === reply.enigmaId)?.name || 'non choisie'}`;
  if (actionType === 'item') return `Objet: ${(project.items || []).find((item) => item.id === reply.rewardItemId)?.name || 'non choisi'}`;
  if (actionType === 'skill_check') {
    const skill = project.heroAdventure?.hero?.skills?.find((entrySkill) => entrySkill.id === reply.skillCheckSkillId);
    return `Test: ${skill?.name || 'compétence'} ${reply.skillCheckDifficulty || 10}+`;
  }
  if (actionType === 'ending') return `${ENDING_TYPE_LABELS[reply.endingType || 'neutral'] || 'Fin'}: ${reply.endingTitle || 'sans titre'}`;
  return ACTION_LABELS[actionType] || actionType;
};

const getAdvancedConditionLabel = (condition = {}, project, getSceneLabel, hotspot) => {
  if (condition.type === 'has_item') return `Objet: ${(project.items || []).find((item) => item.id === condition.itemId)?.name || 'non choisi'}`;
  if (condition.type === 'visited_scene') return `Scène: ${getSceneLabel(condition.sceneId) || 'non choisie'}`;
  if (condition.type === 'completed_hotspot') {
    const conditionHotspot = getAllHotspots(project).find((candidate) => candidate.id === condition.hotspotId);
    return `Zone: ${conditionHotspot?.name || 'non choisie'}`;
  }
  if (condition.type === 'solved_enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === condition.enigmaId)?.name || 'non choisie'}`;
  if (condition.type === 'chose_reply') {
    const conditionReply = (hotspot?.conversation?.nodes || []).flatMap((node) => node.replies || []).find((candidate) => candidate.id === condition.replyId);
    return `Choix: ${conditionReply?.label || 'non choisi'}`;
  }
  if (condition.type === 'story_variable') {
    const operator = condition.operator || 'equals';
    const operatorLabel = {
      equals: '=',
      not_equals: '!=',
      greater_or_equal: '>=',
      less_or_equal: '<=',
      lower_or_equal: '<=',
      truthy: 'vrai',
      falsy: 'faux',
    }[operator] || '=';
    const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${condition.value ?? ''}`;
    return `${condition.variableKey || 'variable'} ${operatorLabel}${valueLabel}`;
  }
  return 'Condition';
};

const getReplyConditionEntries = (reply = {}) => {
  const conditionType = reply.conditionType || 'none';
  if (conditionType === 'advanced') return Array.isArray(reply.advancedConditions) ? reply.advancedConditions : [];
  if (conditionType === 'has_item') return [{ type: 'has_item', itemId: reply.conditionItemId }];
  if (conditionType === 'visited_scene') return [{ type: 'visited_scene', sceneId: reply.conditionSceneId }];
  if (conditionType === 'completed_hotspot') return [{ type: 'completed_hotspot', hotspotId: reply.conditionHotspotId }];
  if (conditionType === 'solved_enigma') return [{ type: 'solved_enigma', enigmaId: reply.conditionEnigmaId }];
  if (conditionType === 'chose_reply') return [{ type: 'chose_reply', replyId: reply.conditionReplyId }];
  if (conditionType === 'story_variable') {
    return [{
      type: 'story_variable',
      variableKey: reply.conditionVariableKey,
      operator: reply.conditionVariableOperator,
      value: reply.conditionVariableValue,
    }];
  }
  return [];
};

const getConditionLabel = (entry, project, getSceneLabel) => {
  const { reply, hotspot } = entry;
  const conditionType = reply.conditionType || 'none';
  if (conditionType === 'none') return '';
  if (conditionType === 'has_item') return `Objet: ${(project.items || []).find((item) => item.id === reply.conditionItemId)?.name || 'non choisi'}`;
  if (conditionType === 'visited_scene') return `Scène: ${getSceneLabel(reply.conditionSceneId) || 'non choisie'}`;
  if (conditionType === 'completed_hotspot') {
    const conditionHotspot = getAllHotspots(project).find((candidate) => candidate.id === reply.conditionHotspotId);
    return `Zone: ${conditionHotspot?.name || 'non choisie'}`;
  }
  if (conditionType === 'solved_enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === reply.conditionEnigmaId)?.name || 'non choisie'}`;
  if (conditionType === 'chose_reply') {
    const conditionReply = (hotspot.conversation?.nodes || []).flatMap((node) => node.replies || []).find((candidate) => candidate.id === reply.conditionReplyId);
    return `Choix: ${conditionReply?.label || 'non choisi'}`;
  }
  if (conditionType === 'story_variable') {
    const operator = reply.conditionVariableOperator || 'equals';
    const operatorLabel = {
      equals: '=',
      not_equals: '!=',
      greater_or_equal: '>=',
      lower_or_equal: '<=',
      truthy: 'vrai',
      falsy: 'faux',
    }[operator] || '=';
    const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${reply.conditionVariableValue ?? ''}`;
    return `${reply.conditionVariableKey || 'variable'} ${operatorLabel}${valueLabel}`;
  }
  if (conditionType === 'advanced') {
    const mode = (reply.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
    const labels = getReplyConditionEntries(reply).map((condition) => getAdvancedConditionLabel(condition, project, getSceneLabel, hotspot));
    return labels.length ? `${mode}: ${labels.join(` ${mode} `)}` : 'Aucune condition ajoutée';
  }
  return CONDITION_LABELS[conditionType] || conditionType;
};

const getVariableEffectLabel = (reply) => {
  const operation = reply.storyVariableOperation || 'none';
  if (operation === 'none' || !reply.storyVariableKey) return '';
  if (operation === 'increment') return `${reply.storyVariableKey} +${reply.storyVariableValue || 1}`;
  if (operation === 'decrement') return `${reply.storyVariableKey} -${reply.storyVariableValue || 1}`;
  return `${reply.storyVariableKey} = ${reply.storyVariableValue ?? ''}`;
};

const coerceComparableValue = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  if (value === '' || value === null || value === undefined) return '';
  if (Number.isFinite(Number(value))) return Number(value);
  return String(value);
};

const compareStoryVariable = (currentValue, expectedValue, operator = 'equals') => {
  const current = coerceComparableValue(currentValue);
  const expected = coerceComparableValue(expectedValue);
  if (operator === 'truthy') return Boolean(current);
  if (operator === 'falsy') return !current;
  if (operator === 'not_equals') return current !== expected;
  if (operator === 'greater_or_equal') return Number(current) >= Number(expected);
  if (operator === 'less_or_equal' || operator === 'lower_or_equal') return Number(current) <= Number(expected);
  return current === expected;
};

const getStoryVariableRanges = (project, entries) => {
  const rangeMap = new Map();
  const ensureRange = (key) => {
    if (!key) return null;
    if (!rangeMap.has(key)) {
      const definition = (project.storyVariables || []).find((variable) => variable.key === key);
      const defaultValue = Number(definition?.defaultValue);
      const startValue = Number.isFinite(defaultValue) ? defaultValue : 0;
      rangeMap.set(key, {
        key,
        minBase: startValue,
        maxBase: startValue,
        positiveDelta: 0,
        negativeDelta: 0,
        hasNumericSignal: definition?.type === 'number' || Number.isFinite(defaultValue),
      });
    }
    return rangeMap.get(key);
  };

  entries.forEach((entry) => {
    const reply = entry.reply || {};
    getReplyConditionEntries(reply).forEach((condition) => {
      if (condition.type === 'story_variable') ensureRange(condition.variableKey);
    });
    const key = reply.storyVariableKey;
    const operation = reply.storyVariableOperation || 'none';
    if (!key || operation === 'none') return;
    const range = ensureRange(key);
    if (!range) return;
    const numericValue = Number(reply.storyVariableValue);
    const amount = Number.isFinite(numericValue) ? numericValue : 1;
    range.hasNumericSignal = range.hasNumericSignal || Number.isFinite(numericValue) || ['increment', 'decrement'].includes(operation);
    if (operation === 'increment') {
      if (amount >= 0) range.positiveDelta += amount;
      else range.negativeDelta += amount;
    }
    if (operation === 'decrement') {
      if (amount >= 0) range.negativeDelta -= amount;
      else range.positiveDelta -= amount;
    }
    if (operation === 'set' && Number.isFinite(numericValue)) {
      range.minBase = Math.min(range.minBase, numericValue);
      range.maxBase = Math.max(range.maxBase, numericValue);
    }
    (reply.effects || []).forEach((effect) => {
      if (!['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '') || !effect.variableKey) return;
      const effectRange = ensureRange(effect.variableKey);
      if (!effectRange) return;
      const effectValue = Number(effect.value);
      const effectAmount = Number.isFinite(effectValue) ? effectValue : 1;
      effectRange.hasNumericSignal = effectRange.hasNumericSignal || Number.isFinite(effectValue) || ['increment_variable', 'decrement_variable'].includes(effect.type || '');
      if (effect.type === 'increment_variable') {
        if (effectAmount >= 0) effectRange.positiveDelta += effectAmount;
        else effectRange.negativeDelta += effectAmount;
      }
      if (effect.type === 'decrement_variable') {
        if (effectAmount >= 0) effectRange.negativeDelta -= effectAmount;
        else effectRange.positiveDelta -= effectAmount;
      }
      if (effect.type === 'set_variable' && Number.isFinite(effectValue)) {
        effectRange.minBase = Math.min(effectRange.minBase, effectValue);
        effectRange.maxBase = Math.max(effectRange.maxBase, effectValue);
      }
    });
  });

  return new Map([...rangeMap.entries()].map(([key, range]) => [key, {
    key,
    min: range.minBase + range.negativeDelta,
    max: range.maxBase + range.positiveDelta,
    hasNumericSignal: range.hasNumericSignal,
  }]));
};

const getImpossibleVariableConditionDetail = (condition, variableRanges) => {
  if (condition.type !== 'story_variable' || !condition.variableKey) return '';
  const operator = condition.operator || 'equals';
  if (!['equals', 'greater_or_equal', 'less_or_equal'].includes(operator)) return '';
  const expected = Number(condition.value);
  if (!Number.isFinite(expected)) return '';
  const range = variableRanges.get(condition.variableKey);
  if (!range?.hasNumericSignal) return '';
  if (operator === 'greater_or_equal' && range.max < expected) {
    return `${condition.variableKey} demande >= ${expected}, mais le maximum détecté est ${range.max}.`;
  }
  if (operator === 'less_or_equal' && range.min > expected) {
    return `${condition.variableKey} demande <= ${expected}, mais le minimum détecté est ${range.min}.`;
  }
  if (operator === 'equals' && (expected < range.min || expected > range.max)) {
    return `${condition.variableKey} demande = ${expected}, mais la plage détectée est ${range.min} à ${range.max}.`;
  }
  return '';
};

const getInitialSimulatorVariables = (project) => Object.fromEntries(
  (project.storyVariables || [])
    .filter((variable) => variable.key)
    .map((variable) => [variable.key, variable.defaultValue])
);

const addUniqueValue = (values = [], value = '') => (
  value && !values.includes(value) ? [...values, value] : values
);

const removeValue = (values = [], value = '') => values.filter((entry) => entry !== value);

const getProjectItemLabel = (project, itemId) => {
  const item = (project.items || []).find((entry) => entry.id === itemId);
  return item ? `${item.icon || ''} ${item.name || 'Objet'}`.trim() : 'Objet inconnu';
};

const getProjectTargetName = (collection = [], id = '', fallback = 'Cible') => (
  collection.find((entry) => entry.id === id)?.name
  || collection.find((entry) => entry.id === id)?.title
  || fallback
);

const clipDebugText = (value = '', maxLength = 72) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const getDebugReplyTitle = (entry) => clipDebugText(entry?.reply?.label || 'Réponse sans libellé', 80);

const getDebugNodeTitle = (node = {}) => (
  `${node.speaker || 'PNJ'} - ${clipDebugText(node.text || 'Question sans texte', 90)}`
);

const findReplyEntry = (entries = [], replyId = '', hotspotId = '') => (
  entries.find((entry) => entry.reply?.id === replyId && (!hotspotId || entry.hotspot?.id === hotspotId))
  || entries.find((entry) => entry.reply?.id === replyId)
  || null
);

const getDebugReplyReference = (entry) => {
  if (!entry) return 'réponse introuvable';
  return `${getDebugReplyTitle(entry)} (${clipDebugText(entry.node?.text || entry.node?.speaker || 'Question', 42)})`;
};

const getDebugVariableEffectLabel = (key = '', operation = 'set', rawValue = '') => {
  if (!key || operation === 'none') return '';
  if (operation === 'increment') return `${key} +${rawValue || 1}`;
  if (operation === 'decrement') return `${key} -${rawValue || 1}`;
  return `${key} = ${rawValue ?? ''}`;
};

const getDebugConditionDetail = (condition = {}, entry, project, getSceneLabel, entries = []) => {
  if (!condition?.type) return { label: 'Condition', dependencyEntry: null };
  if (condition.type === 'chose_reply') {
    const dependencyEntry = findReplyEntry(entries, condition.replyId, entry?.hotspot?.id || '');
    return {
      label: `Choix précédent: ${getDebugReplyReference(dependencyEntry)}`,
      dependencyEntry,
    };
  }
  return {
    label: getAdvancedConditionLabel(condition, project, getSceneLabel, entry?.hotspot),
    dependencyEntry: null,
  };
};

const getDebugEffectLabel = (effect = {}, entry, project, getSceneLabel) => {
  const type = effect.type || 'message';
  if (type === 'message') return effect.message ? `Message: ${clipDebugText(effect.message, 90)}` : 'Message vide';
  if (type === 'add_item') return `Donne objet: ${getProjectItemLabel(project, effect.itemId)}`;
  if (type === 'remove_item') return `Retire objet: ${getProjectItemLabel(project, effect.itemId)}`;
  if (type === 'heal_health') return `Soigne PV: +${Number(effect.value) || 0}`;
  if (type === 'heal_mana') return `Rend mana: +${Number(effect.value) || 0}`;
  if (type === 'set_variable') return getDebugVariableEffectLabel(effect.variableKey, 'set', effect.value);
  if (type === 'increment_variable') return getDebugVariableEffectLabel(effect.variableKey, 'increment', effect.value);
  if (type === 'decrement_variable') return getDebugVariableEffectLabel(effect.variableKey, 'decrement', effect.value);
  if (type === 'journal') return `Journal: ${effect.journalTitle || effect.journalDetail || 'note'}`;
  if (type === 'next_node') {
    const targetNode = (entry.hotspot?.conversation?.nodes || []).find((node) => node.id === effect.nextNodeId);
    return `Va vers question: ${targetNode ? getDebugNodeTitle(targetNode) : 'non choisie'}`;
  }
  if (type === 'scene') return `Va vers scène: ${getSceneLabel(effect.targetSceneId) || 'non choisie'}`;
  if (type === 'cinematic') return `Lance cinématique: ${getProjectTargetName(project.cinematics || [], effect.targetCinematicId, 'Cinématique')}`;
  if (type === 'enigma') return `Ouvre énigme: ${getProjectTargetName(project.enigmas || [], effect.enigmaId, 'Énigme')}`;
  if (type === 'ending') return `Déclenche fin: ${effect.endingTitle || ENDING_TYPE_LABELS[effect.endingType || 'neutral'] || 'Fin'}`;
  return ACTION_LABELS[type] || type;
};

const getDebugReplyBadges = (entry, project, getSceneLabel, entries = []) => {
  const badges = [];
  const reply = entry.reply || {};
  const conditionLabel = getConditionLabel(entry, project, getSceneLabel);
  if (conditionLabel) badges.push({ kind: 'condition', label: `Cachée si condition fausse: ${conditionLabel}` });
  if (reply.showWhenLocked) badges.push({ kind: 'condition', label: `Visible verrouillée: ${reply.lockedLabel || 'raison automatique'}` });
  if (reply.hideAfterChosen) badges.push({ kind: 'hide', label: 'Se masque après sélection' });
  (reply.hideReplyIdsAfterChosen || []).forEach((replyId) => {
    const targetEntry = findReplyEntry(entries, replyId, entry.hotspot?.id || '');
    badges.push({ kind: 'hide', label: `Cache: ${getDebugReplyReference(targetEntry)}` });
  });
  if (reply.rewardItemId) badges.push({ kind: 'item', label: `Donne: ${getProjectItemLabel(project, reply.rewardItemId)}` });
  const variableEffect = getVariableEffectLabel(reply);
  if (variableEffect) badges.push({ kind: 'variable', label: variableEffect });
  (reply.effects || []).forEach((effect) => {
    const type = effect.type || 'message';
    const kind = ['add_item', 'remove_item'].includes(type)
      ? 'item'
      : ['heal_health', 'heal_mana'].includes(type)
        ? 'hero'
      : ['set_variable', 'increment_variable', 'decrement_variable'].includes(type)
        ? 'variable'
        : ['next_node', 'scene', 'enigma'].includes(type)
          ? 'route'
          : type === 'ending'
            ? 'ending'
            : type === 'cinematic'
              ? 'media'
              : type;
    badges.push({ kind, label: getDebugEffectLabel(effect, entry, project, getSceneLabel) });
  });
  const actionType = reply.actionType || 'node';
  if (!['item', 'multiple'].includes(actionType)) {
    badges.push({ kind: actionType === 'ending' ? 'ending' : 'route', label: `Suite: ${getTargetLabel(entry, project, getSceneLabel)}` });
  }
  if (reply.responseImageData) badges.push({ kind: 'media', label: `Image: ${reply.responseImageName || reply.label || 'réponse'}` });
  if (reply.responseSoundData || reply.ambienceSoundData) badges.push({ kind: 'media', label: 'Son après réponse' });
  return badges;
};

const buildLogicDebugger = (project, audit, getSceneLabel) => {
  const entries = audit.entries || [];
  const statements = [];
  const askOnceNodes = [];
  const hiddenRules = [];
  const dependencyRules = [];
  const itemRules = [];
  const variableRules = [];

  const addStatement = (statement) => {
    statements.push({
      id: `logic-debug-${statements.length}`,
      ...statement,
    });
  };

  (audit.nodes || []).forEach((nodeEntry) => {
    if (!nodeEntry.node?.askOnce) return;
    askOnceNodes.push(nodeEntry);
    addStatement({
      kind: 'askOnce',
      title: 'Question askOnce',
      detail: `${getDebugNodeTitle(nodeEntry.node)} ne sera posee qu'une seule fois.`,
      entry: nodeEntry,
    });
  });

  entries.forEach((entry) => {
    const reply = entry.reply || {};
    const replyTitle = getDebugReplyTitle(entry);

    if ((reply.conditionType || 'none') !== 'none') {
      const mode = (reply.conditionType || 'none') === 'advanced' && (reply.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
      const conditions = getReplyConditionEntries(reply);
      if (!conditions.length) {
        addStatement({
          kind: 'condition',
          title: `${replyTitle} a une condition vide`,
          detail: 'La réponse est configurée comme conditionnelle mais aucune condition lisible n est renseignee.',
          entry,
        });
      }
      conditions.forEach((condition, conditionIndex) => {
        const conditionDetail = getDebugConditionDetail(condition, entry, project, getSceneLabel, entries);
        const isChoiceDependency = condition.type === 'chose_reply';
        dependencyRules.push({ entry, condition, conditionIndex, dependencyEntry: conditionDetail.dependencyEntry });
        addStatement({
          kind: isChoiceDependency ? 'choice' : 'condition',
          title: isChoiceDependency ? `${replyTitle} dépend d'un choix précédent` : `${replyTitle} a une condition`,
          detail: `${mode}: ${conditionDetail.label}`,
          entry,
          sourceEntry: conditionDetail.dependencyEntry,
        });
      });
    }

    if (reply.showWhenLocked) {
      addStatement({
        kind: 'condition',
        title: `${replyTitle} reste visible verrouillée`,
        detail: reply.lockedLabel || 'Le joueur voit le bouton bloqué même si la condition est fausse.',
        entry,
      });
    }

    if (reply.hideAfterChosen) {
      hiddenRules.push({ entry, targetEntry: entry, self: true });
      addStatement({
        kind: 'hide',
        title: `${replyTitle} se masque après sélection`,
        detail: 'Le joueur ne reverra plus cette réponse une fois cliquée.',
        entry,
      });
    }

    (reply.hideReplyIdsAfterChosen || []).forEach((replyId) => {
      const targetEntry = findReplyEntry(entries, replyId, entry.hotspot?.id || '');
      hiddenRules.push({ entry, targetEntry, self: false });
      addStatement({
        kind: 'hide',
        title: `${replyTitle} cache ${getDebugReplyReference(targetEntry)}`,
        detail: 'Cette relation est appliquée après le clic sur la réponse source.',
        entry,
        sourceEntry: targetEntry,
      });
    });

    if (reply.rewardItemId) {
      itemRules.push({ entry, itemId: reply.rewardItemId, operation: 'add' });
      addStatement({
        kind: 'item',
        title: `${replyTitle} donne un objet`,
        detail: getProjectItemLabel(project, reply.rewardItemId),
        entry,
      });
    }

    if ((reply.storyVariableOperation || 'none') !== 'none' && reply.storyVariableKey) {
      variableRules.push({ entry, key: reply.storyVariableKey, operation: reply.storyVariableOperation });
      addStatement({
        kind: 'variable',
        title: `${replyTitle} modifie une variable`,
        detail: getVariableEffectLabel(reply),
        entry,
      });
    }

    if (['scene', 'cinematic', 'enigma', 'ending', 'skill_check', 'hero_combat'].includes(reply.actionType || '')) {
      addStatement({
        kind: (reply.actionType || '') === 'ending' ? 'ending' : (reply.actionType || '') === 'cinematic' ? 'media' : 'route',
        title: `${replyTitle} déclenche une suite`,
        detail: getTargetLabel(entry, project, getSceneLabel),
        entry,
      });
    }

    (reply.effects || []).forEach((effect) => {
      const type = effect.type || 'message';
      if (['add_item', 'remove_item'].includes(type) && effect.itemId) {
        itemRules.push({ entry, itemId: effect.itemId, operation: type === 'add_item' ? 'add' : 'remove' });
        addStatement({
          kind: 'item',
          title: `${replyTitle} ${type === 'add_item' ? 'donne' : 'retire'} un objet`,
          detail: getProjectItemLabel(project, effect.itemId),
          entry,
        });
      }
      if (['set_variable', 'increment_variable', 'decrement_variable'].includes(type) && effect.variableKey) {
        const operation = type === 'set_variable' ? 'set' : type === 'increment_variable' ? 'increment' : 'decrement';
        variableRules.push({ entry, key: effect.variableKey, operation });
        addStatement({
          kind: 'variable',
          title: `${replyTitle} modifie une variable`,
          detail: getDebugVariableEffectLabel(effect.variableKey, operation, effect.value),
          entry,
        });
      }
      if (['next_node', 'scene', 'cinematic', 'enigma', 'ending'].includes(type)) {
        addStatement({
          kind: type === 'ending' ? 'ending' : type === 'cinematic' ? 'media' : 'route',
          title: `${replyTitle} déclenche une suite`,
          detail: getDebugEffectLabel(effect, entry, project, getSceneLabel),
          entry,
        });
      }
    });
  });

  const conversationMap = new Map();
  (audit.nodes || []).forEach((nodeEntry) => {
    const key = `${nodeEntry.scene?.id || 'scene'}:${nodeEntry.hotspot?.id || 'hotspot'}`;
    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        id: key,
        scene: nodeEntry.scene,
        hotspot: nodeEntry.hotspot,
        nodes: [],
      });
    }
    const nodeEntries = entries.filter((entry) => (
      entry.scene?.id === nodeEntry.scene?.id
      && entry.hotspot?.id === nodeEntry.hotspot?.id
      && entry.node?.id === nodeEntry.node?.id
    ));
    conversationMap.get(key).nodes.push({
      ...nodeEntry,
      entries: nodeEntries,
    });
  });

  return {
    statements,
    conversations: [...conversationMap.values()],
    askOnceNodes,
    hiddenRules,
    dependencyRules,
    itemRules,
    variableRules,
  };
};

const applySimulatorVariableValue = (variables = {}, key = '', operation = 'set', rawValue = '') => {
  const variableKey = String(key || '').trim();
  if (!variableKey) return variables;
  if (operation === 'increment' || operation === 'decrement') {
    const amount = Number(rawValue) || 1;
    const current = Number(variables[variableKey]) || 0;
    return {
      ...variables,
      [variableKey]: operation === 'increment' ? current + amount : current - amount,
    };
  }
  let nextValue = rawValue;
  if (rawValue === 'true') nextValue = true;
  if (rawValue === 'false') nextValue = false;
  return { ...variables, [variableKey]: nextValue };
};

const getVariableSimulationLabel = (key = '', operation = 'set', rawValue = '') => {
  if (!key || operation === 'none') return '';
  if (operation === 'increment') return `${key} +${Number(rawValue) || 1}`;
  if (operation === 'decrement') return `${key} -${Number(rawValue) || 1}`;
  return `${key} = ${String(rawValue)}`;
};

const getReplyNextNodeId = (reply = {}) => {
  const effectNode = (reply.effects || []).find((effect) => (effect.type || '') === 'next_node' && effect.nextNodeId)?.nextNodeId;
  return effectNode || reply.nextNodeId || '';
};

const applyReplyToSimulator = (current, entry, project) => {
  const reply = entry.reply || {};
  const next = {
    ...current,
    itemIds: [...(current.itemIds || [])],
    sceneIds: [...(current.sceneIds || [])],
    hotspotIds: [...(current.hotspotIds || [])],
    enigmaIds: [...(current.enigmaIds || [])],
    replyIds: addUniqueValue(current.replyIds || [], reply.id),
    variables: { ...(current.variables || {}) },
    journalEntries: [...(current.journalEntries || [])],
    lastEffects: [],
    activeNodeId: current.activeNodeId || '',
    activeHotspotId: current.activeHotspotId || '',
  };
  const addEffect = (type, label) => {
    if (!label) return;
    next.lastEffects.push({ type, label });
    next.journalEntries = [{ type, label, replyLabel: reply.label || 'Réponse' }, ...next.journalEntries].slice(0, 20);
  };

  addEffect('choice', `Choix: ${reply.label || 'Réponse sans libellé'}`);

  if ((reply.storyVariableOperation || 'none') !== 'none' && reply.storyVariableKey) {
    next.variables = applySimulatorVariableValue(next.variables, reply.storyVariableKey, reply.storyVariableOperation || 'set', reply.storyVariableValue);
    addEffect('variable', getVariableSimulationLabel(reply.storyVariableKey, reply.storyVariableOperation || 'set', reply.storyVariableValue));
  }

  if (reply.rewardItemId) {
    next.itemIds = addUniqueValue(next.itemIds, reply.rewardItemId);
    addEffect('item', `Objet obtenu: ${getProjectItemLabel(project, reply.rewardItemId)}`);
  }

  (reply.effects || []).forEach((effect) => {
    const type = effect.type || 'message';
    if (type === 'message' && effect.message) addEffect('message', effect.message);
    if (type === 'add_item' && effect.itemId) {
      next.itemIds = addUniqueValue(next.itemIds, effect.itemId);
      addEffect('item', `Objet obtenu: ${getProjectItemLabel(project, effect.itemId)}`);
    }
    if (type === 'remove_item' && effect.itemId) {
      next.itemIds = removeValue(next.itemIds, effect.itemId);
      addEffect('item', `Objet retiré: ${getProjectItemLabel(project, effect.itemId)}`);
    }
    if (['set_variable', 'increment_variable', 'decrement_variable'].includes(type)) {
      const operation = type === 'set_variable' ? 'set' : type === 'increment_variable' ? 'increment' : 'decrement';
      next.variables = applySimulatorVariableValue(next.variables, effect.variableKey, operation, effect.value);
      addEffect('variable', getVariableSimulationLabel(effect.variableKey, operation, effect.value));
    }
    if (type === 'journal') {
      addEffect('journal', [effect.journalTitle || 'Journal', effect.journalDetail || effect.message || ''].filter(Boolean).join(' - '));
    }
    if (type === 'scene' && effect.targetSceneId) {
      next.sceneIds = addUniqueValue(next.sceneIds, effect.targetSceneId);
      addEffect('route', `Scène visitée: ${getProjectTargetName(project.scenes || [], effect.targetSceneId, 'Scène')}`);
    }
    if (type === 'cinematic' && effect.targetCinematicId) {
      addEffect('media', `Cinématique: ${getProjectTargetName(project.cinematics || [], effect.targetCinematicId, 'Cinématique')}`);
    }
    if (type === 'enigma' && effect.enigmaId) {
      addEffect('route', `Énigme ouverte: ${getProjectTargetName(project.enigmas || [], effect.enigmaId, 'Énigme')}`);
    }
    if (type === 'ending') {
      addEffect('ending', `Fin: ${effect.endingTitle || reply.endingTitle || 'Fin sans titre'}`);
    }
  });

  if ((reply.actionType || '') === 'scene' && reply.targetSceneId) {
    next.sceneIds = addUniqueValue(next.sceneIds, reply.targetSceneId);
    addEffect('route', `Scène visitée: ${getProjectTargetName(project.scenes || [], reply.targetSceneId, 'Scène')}`);
  }
  if ((reply.actionType || '') === 'cinematic' && reply.targetCinematicId) {
    addEffect('media', `Cinématique: ${getProjectTargetName(project.cinematics || [], reply.targetCinematicId, 'Cinématique')}`);
  }
  if ((reply.actionType || '') === 'enigma' && reply.enigmaId) {
    addEffect('route', `Énigme ouverte: ${getProjectTargetName(project.enigmas || [], reply.enigmaId, 'Énigme')}`);
  }
  if ((reply.actionType || '') === 'ending') {
    addEffect('ending', `Fin: ${reply.endingTitle || 'Fin sans titre'}`);
  }
  if (['end', 'ending'].includes(reply.actionType || '')) {
    next.hotspotIds = addUniqueValue(next.hotspotIds, entry.hotspot?.id);
  }

  const nextNodeId = getReplyNextNodeId(reply);
  if (nextNodeId) {
    next.activeNodeId = nextNodeId;
    next.activeHotspotId = entry.hotspot?.id || next.activeHotspotId;
    const node = (entry.hotspot?.conversation?.nodes || []).find((candidate) => candidate.id === nextNodeId);
    addEffect('route', `Question suivante: ${node?.text || node?.speaker || 'Autre question'}`);
  }

  return next;
};

const isEntryVisibleInSimulation = (entry, simulator) => {
  const reply = entry.reply || {};
  const conditionType = reply.conditionType || 'none';
  if (conditionType === 'none') return true;
  if (conditionType === 'has_item') return Boolean(reply.conditionItemId && simulator.itemIds.includes(reply.conditionItemId));
  if (conditionType === 'visited_scene') return Boolean(reply.conditionSceneId && simulator.sceneIds?.includes(reply.conditionSceneId));
  if (conditionType === 'completed_hotspot') return Boolean(reply.conditionHotspotId && simulator.hotspotIds?.includes(reply.conditionHotspotId));
  if (conditionType === 'solved_enigma') return Boolean(reply.conditionEnigmaId && simulator.enigmaIds.includes(reply.conditionEnigmaId));
  if (conditionType === 'chose_reply') return Boolean(reply.conditionReplyId && simulator.replyIds?.includes(reply.conditionReplyId));
  if (conditionType === 'story_variable') {
    if (!reply.conditionVariableKey) return false;
    return compareStoryVariable(
      simulator.variables?.[reply.conditionVariableKey],
      reply.conditionVariableValue,
      reply.conditionVariableOperator || 'equals'
    );
  }
  if (conditionType === 'advanced') {
    const conditions = getReplyConditionEntries(reply);
    if (!conditions.length) return false;
    const isConditionVisible = (condition) => {
      if (condition.type === 'has_item') return Boolean(condition.itemId && simulator.itemIds.includes(condition.itemId));
      if (condition.type === 'visited_scene') return Boolean(condition.sceneId && simulator.sceneIds?.includes(condition.sceneId));
      if (condition.type === 'completed_hotspot') return Boolean(condition.hotspotId && simulator.hotspotIds?.includes(condition.hotspotId));
      if (condition.type === 'solved_enigma') return Boolean(condition.enigmaId && simulator.enigmaIds.includes(condition.enigmaId));
      if (condition.type === 'chose_reply') return Boolean(condition.replyId && simulator.replyIds?.includes(condition.replyId));
      if (condition.type === 'story_variable') {
        if (!condition.variableKey) return false;
        return compareStoryVariable(simulator.variables?.[condition.variableKey], condition.value, condition.operator || 'equals');
      }
      return false;
    };
    return (reply.advancedConditionMode || 'all') === 'any' ? conditions.some(isConditionVisible) : conditions.every(isConditionVisible);
  }
  return false;
};

const normalizeSearchValue = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const buildNarrativeSearchResults = (project, audit, query, getSceneLabel) => {
  const needle = normalizeSearchValue(query).trim();
  if (!needle) return [];
  const results = [];
  const addResult = (result) => {
    const haystack = normalizeSearchValue([
      result.type,
      result.title,
      result.detail,
      result.meta,
      result.badge,
    ].filter(Boolean).join(' '));
    if (haystack.includes(needle)) results.push(result);
  };

  (project.storyVariables || []).forEach((variable) => {
    addResult({
      type: 'Variable',
      title: variable.key || 'Variable sans nom',
      detail: `${VARIABLE_TYPE_LABELS[variable.type || 'boolean'] || variable.type || 'Type'} - départ: ${variable.defaultValue ?? ''}`,
      meta: variable.description || variable.journalLabel || '',
      badge: 'registre officiel',
    });
  });

  (project.items || []).forEach((item) => {
    addResult({
      type: 'Objet',
      title: `${item.icon || ''} ${item.name || 'Objet'}`.trim(),
      detail: item.description || 'Objet du projet',
      meta: item.id,
      badge: 'inventaire',
    });
  });

  audit.entries.forEach((entry) => {
    const conditionLabel = getConditionLabel(entry, project, getSceneLabel);
    const variableLabel = getVariableEffectLabel(entry.reply);
    const targetLabel = getTargetLabel(entry, project, getSceneLabel);
    const conditionItemNames = getReplyConditionEntries(entry.reply)
      .filter((condition) => condition.type === 'has_item')
      .map((condition) => (project.items || []).find((item) => item.id === condition.itemId)?.name || condition.itemId);
    const effectMeta = (entry.reply.effects || []).map((effect) => [
      effect.type,
      effect.message,
      effect.variableKey,
      effect.value,
      effect.itemId ? getProjectItemLabel(project, effect.itemId) : '',
      effect.journalTitle,
      effect.journalDetail,
      effect.endingTitle,
      effect.endingSummary,
    ].filter(Boolean).join(' ')).join(' ');
    const haystackMeta = [
      entry.node.text,
      entry.node.authorNote,
      entry.reply.label,
      entry.reply.dialogue,
      entry.reply.authorNote,
      entry.reply.endingTitle,
      entry.reply.endingSummary,
      (entry.reply.branchTags || []).join(' '),
      entry.reply.storyVariableKey,
      entry.reply.conditionVariableKey,
      conditionLabel,
      variableLabel,
      targetLabel,
      conditionItemNames.join(' '),
      effectMeta,
      entry.reply.rewardItemId ? (project.items || []).find((item) => item.id === entry.reply.rewardItemId)?.name : '',
    ].filter(Boolean).join(' ');
    addResult({
      type: (entry.reply.actionType || '') === 'ending' ? 'Fin' : 'Réponse',
      title: entry.reply.endingTitle || entry.reply.label || 'Réponse sans libellé',
      detail: `${getSceneLabel(entry.scene.id)} - ${entry.hotspot.name || 'Conversation'} - ${targetLabel}`,
      meta: haystackMeta,
      badge: (entry.reply.branchTags || []).length ? `tags: ${(entry.reply.branchTags || []).join(', ')}` : (conditionLabel ? 'condition' : (variableLabel ? 'variable' : ACTION_LABELS[entry.reply.actionType || 'node'] || 'action')),
      entry,
    });
  });

  audit.diagnostics.forEach((diagnostic) => {
    addResult({
      type: 'Diagnostic',
      title: diagnostic.title,
      detail: diagnostic.detail || [diagnostic.sceneName, diagnostic.hotspotName, diagnostic.replyLabel].filter(Boolean).join(' - '),
      meta: diagnostic.actionType || '',
      badge: diagnostic.severity,
      entry: diagnostic.hotspotId ? diagnostic : null,
    });
  });

  return results.slice(0, 80);
};

const buildAdventureAudit = (project, getSceneLabel) => {
  const declaredVariableKeys = new Set((project.storyVariables || []).map((variable) => variable.key).filter(Boolean));
  const scenesById = new Set((project.scenes || []).map((scene) => scene.id));
  const itemsById = new Set((project.items || []).map((item) => item.id));
  const enigmasById = new Set((project.enigmas || []).map((enigma) => enigma.id));
  const cinematicsById = new Set((project.cinematics || []).map((cine) => cine.id));
  const hotspotsById = new Set(getAllHotspots(project).map((hotspot) => hotspot.id));
  const entries = getConversationEntries(project);
  const nodes = getConversationNodes(project);
  const replyIds = new Set(entries.map((entry) => entry.reply.id));
  const variableRanges = getStoryVariableRanges(project, entries);
  const modifiedVariableKeys = new Set();
  const testedVariableKeys = new Set();
  const usedVariableKeys = new Set();
  const diagnostics = [];

  const addDiagnostic = (severity, title, entry, detail = '', options = {}) => {
    diagnostics.push({
      id: `${severity}-${diagnostics.length}-${entry?.id || 'global'}`,
      severity,
      title,
      detail,
      sceneId: entry?.scene?.id || '',
      sceneName: entry?.scene ? getSceneLabel(entry.scene.id) : '',
      hotspotName: entry?.hotspot?.name || '',
      replyLabel: entry?.reply?.label || '',
      hotspotId: entry?.hotspot?.id || '',
      nodeId: entry?.node?.id || '',
      replyId: entry?.reply?.id || '',
      actionType: entry?.reply?.actionType || '',
      effectIndex: Number.isInteger(options.effectIndex) ? options.effectIndex : null,
      conditionIndex: Number.isInteger(options.conditionIndex) ? options.conditionIndex : null,
    });
  };

  if (!entries.length) {
    addDiagnostic('warning', 'Aucune conversation à choix multiple', null, 'Ajoute une zone avec action Conversation texte pour utiliser ce mode.');
  }

  nodes.forEach((entry) => {
    if (!(entry.node.replies || []).length) {
      addDiagnostic('warning', 'Question sans réponse', { ...entry, reply: {} }, entry.node.text || 'Question vide');
    }
    if (!entry.node.text) {
      addDiagnostic('info', 'Question sans texte', { ...entry, reply: {} }, 'Le PNJ risque de parler dans le vide.');
    }
  });

  entries.forEach((entry) => {
    const { reply, hotspot } = entry;
    const actionType = reply.actionType || 'node';
    const effects = Array.isArray(reply.effects) ? reply.effects : [];
    const hasVisualEffect = effects.some((effect) => {
      const type = effect.type || 'message';
      if (type === 'message') return Boolean(effect.message);
      if (['add_item', 'remove_item'].includes(type)) return Boolean(effect.itemId);
      if (['set_variable', 'increment_variable', 'decrement_variable'].includes(type)) return Boolean(effect.variableKey);
      if (type === 'journal') return Boolean(effect.journalTitle || effect.journalDetail || effect.message);
      if (type === 'next_node') return Boolean(effect.nextNodeId);
      if (type === 'scene') return Boolean(effect.targetSceneId);
      if (type === 'cinematic') return Boolean(effect.targetCinematicId);
      if (type === 'enigma') return Boolean(effect.enigmaId);
      if (type === 'ending') return Boolean(effect.endingTitle || effect.endingSummary || effect.message);
      return false;
    });
    const hasLegacyEffect = Boolean(
      reply.dialogue
      || reply.rewardItemId
      || ((reply.storyVariableOperation || 'none') !== 'none' && reply.storyVariableKey)
      || reply.responseImageData
      || reply.responseSoundData
      || reply.ambienceSoundData
    );
    const hasSuite = Boolean(
      reply.nextNodeId
      || reply.targetSceneId
      || reply.targetCinematicId
      || reply.enigmaId
      || ['end', 'ending', 'skill_check', 'hero_combat'].includes(actionType)
      || effects.some((effect) => (
        ((effect.type || '') === 'next_node' && effect.nextNodeId)
        || ((effect.type || '') === 'scene' && effect.targetSceneId)
        || ((effect.type || '') === 'cinematic' && effect.targetCinematicId)
        || ((effect.type || '') === 'enigma' && effect.enigmaId)
        || ((effect.type || '') === 'ending')
      ))
    );
    getReplyConditionEntries(reply).forEach((condition) => {
      if (condition.type === 'story_variable' && condition.variableKey) {
        testedVariableKeys.add(condition.variableKey);
        usedVariableKeys.add(condition.variableKey);
      }
    });
    if ((reply.storyVariableOperation || 'none') !== 'none' && reply.storyVariableKey) {
      modifiedVariableKeys.add(reply.storyVariableKey);
      usedVariableKeys.add(reply.storyVariableKey);
    }
    effects.forEach((effect, effectIndex) => {
      if (['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '') && effect.variableKey) {
        modifiedVariableKeys.add(effect.variableKey);
        usedVariableKeys.add(effect.variableKey);
        if (!declaredVariableKeys.has(effect.variableKey)) {
          addDiagnostic('warning', 'Variable inconnue dans un effet', entry, effect.variableKey, { effectIndex });
        }
      }
      if (['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '') && !effect.variableKey) {
        addDiagnostic('error', 'Effet variable sans nom', entry, 'Un effet effects[] modifie une variable sans nom.', { effectIndex });
      }
      if (['add_item', 'remove_item'].includes(effect.type || '') && effect.itemId && !itemsById.has(effect.itemId)) {
        addDiagnostic('error', 'Effet objet introuvable', entry, effect.itemId, { effectIndex });
      }
      if ((effect.type || '') === 'scene' && (!effect.targetSceneId || !scenesById.has(effect.targetSceneId))) {
        addDiagnostic('error', 'Effet scène cible manquante', entry, 'Un effet effects[] pointe vers une scène absente.', { effectIndex });
      }
      if ((effect.type || '') === 'cinematic' && (!effect.targetCinematicId || !cinematicsById.has(effect.targetCinematicId))) {
        addDiagnostic('error', 'Effet cinématique cible manquante', entry, 'Un effet effects[] pointe vers une cinématique absente.', { effectIndex });
      }
      if ((effect.type || '') === 'enigma' && (!effect.enigmaId || !enigmasById.has(effect.enigmaId))) {
        addDiagnostic('error', 'Effet énigme cible manquante', entry, 'Un effet effects[] pointe vers une énigme absente.', { effectIndex });
      }
      if ((effect.type || '') === 'next_node' && effect.nextNodeId) {
        const targetExists = (hotspot.conversation?.nodes || []).some((node) => node.id === effect.nextNodeId);
        if (!targetExists) addDiagnostic('error', 'Cible Aller vers manquante', entry, effect.nextNodeId, { effectIndex });
      }
      if ((effect.type || '') === 'next_node' && !effect.nextNodeId) {
        addDiagnostic('error', 'Cible Aller vers manquante', entry, 'Choisis une question suivante pour cet effet.', { effectIndex });
      }
      if ((effect.type || '') === 'ending' && !effect.endingTitle) {
        addDiagnostic('warning', 'Fin sans titre', entry, 'Un effet de fin devrait avoir un titre lisible.', { effectIndex });
      }
    });

    if (!reply.label) addDiagnostic('info', 'Réponse sans libellé', entry, 'Le bouton joueur sera peu lisible.');
    if (!hasVisualEffect && !hasLegacyEffect && !hasSuite) {
      addDiagnostic('warning', 'Réponse sans effet ni suite', entry, 'Ajoute un message, un objet, une variable, un journal, une cible Aller vers... ou une fin.');
    }
    if (['node', 'dialogue', 'multiple'].includes(actionType) && reply.nextNodeId) {
      const targetExists = (hotspot.conversation?.nodes || []).some((node) => node.id === reply.nextNodeId);
      if (!targetExists) addDiagnostic('error', 'Question suivante introuvable', entry, reply.nextNodeId);
    }
    if (actionType === 'scene' && (!reply.targetSceneId || !scenesById.has(reply.targetSceneId))) {
      addDiagnostic('error', 'Scène cible manquante', entry, 'Cette réponse ne peut pas changer de scène.');
    }
    if (actionType === 'cinematic' && (!reply.targetCinematicId || !cinematicsById.has(reply.targetCinematicId))) {
      addDiagnostic('error', 'Cinématique cible manquante', entry, 'Cette réponse ne peut pas lancer la cinématique.');
    }
    if (actionType === 'enigma' && (!reply.enigmaId || !enigmasById.has(reply.enigmaId))) {
      addDiagnostic('error', 'Énigme liée manquante', entry, "Cette réponse ne peut pas ouvrir l'énigme.");
    }
    if (reply.rewardItemId && !itemsById.has(reply.rewardItemId)) {
      addDiagnostic('error', 'Objet donne introuvable', entry, reply.rewardItemId);
    }
    if (actionType === 'item' && !reply.rewardItemId) {
      addDiagnostic('warning', 'Action objet sans objet', entry, "Choisis un objet à donner ou change le type d'action.");
    }
    if (actionType === 'ending' && !reply.endingTitle) {
      addDiagnostic('warning', 'Fin sans titre', entry, 'Le résumé de fin sera moins clair.');
    }

    if ((reply.conditionType || 'none') === 'has_item' && (!reply.conditionItemId || !itemsById.has(reply.conditionItemId))) {
      addDiagnostic('error', 'Condition objet incomplète', entry, 'La réponse restera probablement cachée.');
    }
    if ((reply.conditionType || 'none') === 'visited_scene' && (!reply.conditionSceneId || !scenesById.has(reply.conditionSceneId))) {
      addDiagnostic('error', 'Condition scène incomplète', entry, 'La réponse restera probablement cachée.');
    }
    if ((reply.conditionType || 'none') === 'completed_hotspot' && (!reply.conditionHotspotId || !hotspotsById.has(reply.conditionHotspotId))) {
      addDiagnostic('error', 'Condition zone incomplète', entry, 'La réponse restera probablement cachée.');
    }
    if ((reply.conditionType || 'none') === 'solved_enigma' && (!reply.conditionEnigmaId || !enigmasById.has(reply.conditionEnigmaId))) {
      addDiagnostic('error', 'Condition énigme incomplète', entry, 'La réponse restera probablement cachée.');
    }
    if ((reply.conditionType || 'none') === 'chose_reply' && (!reply.conditionReplyId || !replyIds.has(reply.conditionReplyId))) {
      addDiagnostic('error', 'Condition choix précédent incomplète', entry, 'La réponse restera probablement cachée.');
    }
    if ((reply.conditionType || 'none') === 'story_variable' && !reply.conditionVariableKey) {
      addDiagnostic('error', 'Condition variable sans nom', entry, 'Indique la variable à tester.');
    }
    if ((reply.conditionType || 'none') === 'advanced') {
      const advancedConditions = getReplyConditionEntries(reply);
      if (!advancedConditions.length) {
        addDiagnostic('error', 'Conditions avancées vides', entry, 'Ajoute au moins une condition ou repasse la réponse en visible tout de suite.');
      }
      advancedConditions.forEach((condition) => {
        if (condition.type === 'has_item' && (!condition.itemId || !itemsById.has(condition.itemId))) {
          addDiagnostic('error', 'Condition avancée objet incomplète', entry, 'Une condition combinée pointe vers un objet absent.');
        }
        if (condition.type === 'visited_scene' && (!condition.sceneId || !scenesById.has(condition.sceneId))) {
          addDiagnostic('error', 'Condition avancée scène incomplète', entry, 'Une condition combinée pointe vers une scène absente.');
        }
        if (condition.type === 'completed_hotspot' && (!condition.hotspotId || !hotspotsById.has(condition.hotspotId))) {
          addDiagnostic('error', 'Condition avancée zone incomplète', entry, 'Une condition combinée pointe vers une zone absente.');
        }
        if (condition.type === 'solved_enigma' && (!condition.enigmaId || !enigmasById.has(condition.enigmaId))) {
          addDiagnostic('error', 'Condition avancée énigme incomplète', entry, 'Une condition combinée pointe vers une énigme absente.');
        }
        if (condition.type === 'chose_reply' && (!condition.replyId || !replyIds.has(condition.replyId))) {
          addDiagnostic('error', 'Condition avancée choix incomplète', entry, 'Une condition combinée pointe vers un choix précédent absent.');
        }
        if (condition.type === 'story_variable' && !condition.variableKey) {
          addDiagnostic('error', 'Condition avancee variable sans nom', entry, 'Une condition combinée teste une variable sans nom.');
        }
      });
    }
    if ((reply.storyVariableOperation || 'none') !== 'none' && !reply.storyVariableKey) {
      addDiagnostic('error', 'Effet variable sans nom', entry, 'Indique la variable à modifier.');
    }

    const variableConditionDetails = getReplyConditionEntries(reply)
      .map((condition) => getImpossibleVariableConditionDetail(condition, variableRanges))
      .filter(Boolean);
    if (variableConditionDetails.length) {
      const title = (reply.actionType || '') === 'ending' ? 'Fin probablement impossible' : 'Chemin probablement impossible';
      const mode = (reply.conditionType || 'none') === 'advanced' && (reply.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
      if (mode === 'ET' || variableConditionDetails.length === getReplyConditionEntries(reply).length) {
        addDiagnostic('warning', title, entry, variableConditionDetails.join(' '));
      }
    }
  });

  testedVariableKeys.forEach((key) => {
    if (!modifiedVariableKeys.has(key)) {
      diagnostics.push({
        id: `variable-unset-${key}`,
        severity: 'warning',
        title: 'Variable testée mais jamais modifiée',
        detail: key,
        sceneId: '',
        sceneName: '',
        hotspotName: '',
        replyLabel: '',
        hotspotId: '',
        nodeId: '',
        replyId: '',
        actionType: '',
      });
    }
  });

  usedVariableKeys.forEach((key) => {
    if (!declaredVariableKeys.has(key)) {
      diagnostics.push({
        id: `variable-unknown-${key}`,
        severity: 'warning',
        title: 'Variable utilisée mais non déclarée',
        detail: key,
        sceneId: '',
        sceneName: '',
        hotspotName: '',
        replyLabel: '',
        hotspotId: '',
        nodeId: '',
        replyId: '',
        actionType: '',
      });
    }
  });

  return {
    entries,
    nodes,
    diagnostics,
    hiddenEntries: entries.filter((entry) => (entry.reply.conditionType || 'none') !== 'none'),
    variableEntries: entries.filter((entry) => (entry.reply.storyVariableOperation || 'none') !== 'none' || getReplyConditionEntries(entry.reply).some((condition) => condition.type === 'story_variable')),
    endings: entries.filter((entry) => (entry.reply.actionType || '') === 'ending'),
    unknownVariableKeys: [...usedVariableKeys].filter((key) => !declaredVariableKeys.has(key)).sort(),
    variables: [...new Set([...declaredVariableKeys, ...modifiedVariableKeys, ...testedVariableKeys])].sort().map((key) => ({
      key,
      declared: declaredVariableKeys.has(key),
      modified: modifiedVariableKeys.has(key),
      tested: testedVariableKeys.has(key),
      range: variableRanges.get(key) || null,
      effects: entries.filter((entry) => (
        entry.reply.storyVariableKey === key
        || (entry.reply.effects || []).some((effect) => effect.variableKey === key)
      )),
      tests: entries.filter((entry) => getReplyConditionEntries(entry.reply).some((condition) => condition.type === 'story_variable' && condition.variableKey === key)),
    })),
  };
};

function EmptyAdventureState() {
  return (
    <div className="empty-state-inline">
      Aucun choix narratif pour l'instant. Crée une zone dans Scènes, choisis "Conversation texte", puis ajoute des réponses.
    </div>
  );
}

export default function AdventureTab({ project, patchProject, getSceneLabel, setSelectedSceneId, setSelectedHotspotId, setTab }) {
  const audit = buildAdventureAudit(project, getSceneLabel);
  const logicDebugger = buildLogicDebugger(project, audit, getSceneLabel);
  const errorCount = audit.diagnostics.filter((entry) => entry.severity === 'error').length;
  const warningCount = audit.diagnostics.filter((entry) => entry.severity === 'warning').length;
  const [activeAdventureTab, setActiveAdventureTab] = useState('overview');
  const [simulator, setSimulator] = useState(() => ({
    itemIds: [],
    sceneIds: [],
    hotspotIds: [],
    enigmaIds: [],
    replyIds: [],
    variables: getInitialSimulatorVariables(project),
    journalEntries: [],
    lastEffects: [],
    activeNodeId: '',
    activeHotspotId: '',
  }));
  const simulatorVariableKeys = useMemo(() => (
    [...new Set([
      ...(project.storyVariables || []).map((variable) => variable.key).filter(Boolean),
      ...audit.variables.map((variable) => variable.key).filter(Boolean),
    ])].sort()
  ), [audit.variables, project.storyVariables]);
  const visibleSimulatorEntries = audit.entries.filter((entry) => isEntryVisibleInSimulation(entry, simulator));
  const hiddenSimulatorEntries = audit.entries.filter((entry) => !isEntryVisibleInSimulation(entry, simulator));
  const accessibleSimulatorEndings = visibleSimulatorEntries.filter((entry) => (entry.reply.actionType || '') === 'ending');
  const narrativeEndingEntries = audit.entries.filter((entry) => (
    (entry.reply.actionType || '') === 'ending'
    || (entry.reply.effects || []).some((effect) => (effect.type || '') === 'ending')
  ));
  const activeSimulatorNode = simulator.activeNodeId
    ? audit.nodes.find((entry) => entry.node.id === simulator.activeNodeId && (!simulator.activeHotspotId || entry.hotspot.id === simulator.activeHotspotId))
    : null;
  const activeSimulatorEntries = activeSimulatorNode
    ? visibleSimulatorEntries.filter((entry) => entry.node.id === activeSimulatorNode.node.id && entry.hotspot.id === activeSimulatorNode.hotspot.id)
    : [];
  const [narrativeSearch, setNarrativeSearch] = useState('');
  const narrativeSearchResults = useMemo(() => (
    buildNarrativeSearchResults(project, audit, narrativeSearch, getSceneLabel)
  ), [audit, getSceneLabel, narrativeSearch, project]);
  const adventureInternalTabs = [
    ['overview', 'Vue d ensemble', errorCount + warningCount],
    ['debugger', 'Analyse des branches', logicDebugger.statements.length],
    ['search', 'Recherche', narrativeSearchResults.length],
    ['simulator', 'Simulateur', visibleSimulatorEntries.length],
    ['diagnostics', 'Diagnostic', errorCount + warningCount],
    ['variables', 'Variables', audit.variables.length],
    ['choices', 'Choix', audit.entries.length],
    ['endings', 'Fins', audit.endings.length],
  ];

  const openScene = (sceneId) => {
    if (!sceneId) return;
    setSelectedSceneId?.(sceneId);
    setTab?.('scenes');
  };

  const openConversation = (entryOrDiagnostic, focusReply = false) => {
    const sceneId = entryOrDiagnostic?.sceneId || entryOrDiagnostic?.scene?.id || '';
    const hotspotId = entryOrDiagnostic?.hotspotId || entryOrDiagnostic?.hotspot?.id || '';
    const replyId = entryOrDiagnostic?.replyId || entryOrDiagnostic?.reply?.id || '';
    if (!sceneId) return;
    if (hotspotId) {
      window.sessionStorage.setItem('adventureConversationFocus', JSON.stringify({
        hotspotId,
        replyId: focusReply ? replyId : '',
      }));
      setSelectedHotspotId?.(hotspotId);
    }
    openScene(sceneId);
  };

  const addStoryVariable = (key = '') => {
    const usedKey = String(key || '').trim();
    patchProject?.((draft) => {
      if (!Array.isArray(draft.storyVariables)) draft.storyVariables = [];
      const existingKeys = new Set(draft.storyVariables.map((variable) => variable.key).filter(Boolean));
      let nextKey = usedKey || 'nouvelle_variable';
      let suffix = 2;
      while (existingKeys.has(nextKey)) {
        nextKey = `${usedKey || 'nouvelle_variable'}_${suffix}`;
        suffix += 1;
      }
      draft.storyVariables.push({
        id: makeVariableId(),
        key: nextKey,
        type: 'boolean',
        defaultValue: false,
        description: '',
        journalLabel: '',
        journalVisible: true,
      });
    });
  };

  const updateStoryVariable = (variableId, patch) => {
    patchProject?.((draft) => {
      if (!Array.isArray(draft.storyVariables)) draft.storyVariables = [];
      const variable = draft.storyVariables.find((entry) => entry.id === variableId);
      if (!variable) return;
      if (Object.prototype.hasOwnProperty.call(patch, 'key')) {
        variable.key = String(patch.key || '').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'type')) {
        variable.type = ['number', 'boolean', 'text'].includes(patch.type) ? patch.type : 'boolean';
        variable.defaultValue = normalizeVariableDefaultValue(variable.type, variable.defaultValue);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'defaultValue')) {
        variable.defaultValue = normalizeVariableDefaultValue(variable.type || 'boolean', patch.defaultValue);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
        variable.description = patch.description || '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'journalLabel')) {
        variable.journalLabel = patch.journalLabel || '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'journalVisible')) {
        variable.journalVisible = Boolean(patch.journalVisible);
      }
    });
  };

  const deleteStoryVariable = async (variableId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la variable',
      message: 'Supprimer cette variable du registre ? Les réponses qui utilisent ce nom ne seront pas modifiées.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    patchProject?.((draft) => {
      draft.storyVariables = (draft.storyVariables || []).filter((variable) => variable.id !== variableId);
    });
  };

  const patchReplyFromDiagnostic = (diagnostic, updater) => {
    patchProject?.((draft) => {
      const scene = (draft.scenes || []).find((entry) => entry.id === diagnostic.sceneId);
      const hotspot = scene?.hotspots?.find((entry) => entry.id === diagnostic.hotspotId);
      const node = hotspot?.conversation?.nodes?.find((entry) => entry.id === diagnostic.nodeId);
      const reply = node?.replies?.find((entry) => entry.id === diagnostic.replyId);
      if (reply) updater(reply, { draft, scene, hotspot, node });
    });
  };

  const patchReplyFromEntry = (entry, updater) => {
    patchReplyFromDiagnostic({
      sceneId: entry.scene?.id || '',
      hotspotId: entry.hotspot?.id || '',
      nodeId: entry.node?.id || '',
      replyId: entry.reply?.id || '',
    }, updater);
  };

  const addEndingTitle = (diagnostic) => {
    patchReplyFromDiagnostic(diagnostic, (reply) => {
      const endingEffect = Number.isInteger(diagnostic.effectIndex)
        ? reply.effects?.[diagnostic.effectIndex]
        : (reply.effects || []).find((effect) => (effect.type || '') === 'ending' && !effect.endingTitle);
      if (endingEffect) {
        endingEffect.endingTitle = 'Nouvelle fin';
        endingEffect.endingSummary = endingEffect.endingSummary || endingEffect.message || reply.dialogue || 'Résumé de cette fin.';
        return;
      }
      reply.endingTitle = reply.endingTitle || 'Nouvelle fin';
      reply.endingSummary = reply.endingSummary || reply.dialogue || 'Résumé de cette fin.';
    });
  };

  const getFallbackNodeId = (hotspot, currentNodeId = '') => (
    (hotspot?.conversation?.nodes || []).find((node) => node.id && node.id !== currentNodeId)?.id
    || (hotspot?.conversation?.nodes || [])[0]?.id
    || ''
  );

  const fixMissingTarget = (diagnostic) => {
    patchReplyFromDiagnostic(diagnostic, (reply, { draft, hotspot, node }) => {
      const effect = Number.isInteger(diagnostic.effectIndex) ? reply.effects?.[diagnostic.effectIndex] : null;
      if (diagnostic.title === 'Question suivante introuvable') {
        reply.nextNodeId = getFallbackNodeId(hotspot, node?.id || diagnostic.nodeId);
        return;
      }
      if (diagnostic.title === 'Cible Aller vers manquante') {
        if (effect) effect.nextNodeId = getFallbackNodeId(hotspot, node?.id || diagnostic.nodeId);
        else reply.nextNodeId = getFallbackNodeId(hotspot, node?.id || diagnostic.nodeId);
        return;
      }
      if (diagnostic.title === 'Scène cible manquante') {
        reply.targetSceneId = (draft.scenes || []).find((scene) => scene.id && scene.id !== diagnostic.sceneId)?.id || (draft.scenes || [])[0]?.id || '';
        return;
      }
      if (diagnostic.title === 'Effet scène cible manquante') {
        if (effect) effect.targetSceneId = (draft.scenes || []).find((scene) => scene.id && scene.id !== diagnostic.sceneId)?.id || (draft.scenes || [])[0]?.id || '';
        return;
      }
      if (diagnostic.title === 'Cinématique cible manquante') {
        reply.targetCinematicId = (draft.cinematics || [])[0]?.id || '';
        return;
      }
      if (diagnostic.title === 'Effet cinématique cible manquante') {
        if (effect) effect.targetCinematicId = (draft.cinematics || [])[0]?.id || '';
        return;
      }
      if (diagnostic.title === 'Énigme liée manquante') {
        reply.enigmaId = (draft.enigmas || [])[0]?.id || '';
        return;
      }
      if (diagnostic.title === 'Effet énigme cible manquante') {
        if (effect) effect.enigmaId = (draft.enigmas || [])[0]?.id || '';
      }
    });
  };

  const getDiagnosticActions = (diagnostic) => {
    const actions = [];
    if (diagnostic.hotspotId) {
      actions.push({ label: 'Ouvrir la conversation', onClick: () => openConversation(diagnostic, false) });
    }
    if (diagnostic.replyId) {
      actions.push({ label: 'Aller à la réponse', onClick: () => openConversation(diagnostic, true) });
    }
    if (['Variable utilisée mais non déclarée', 'Variable inconnue dans un effet'].includes(diagnostic.title) && diagnostic.detail) {
      actions.push({ label: 'Créer la variable', onClick: () => addStoryVariable(diagnostic.detail) });
    }
    if (diagnostic.title === 'Fin sans titre') {
      actions.push({ label: 'Ajouter un titre de fin', onClick: () => addEndingTitle(diagnostic) });
    }
    if (['Scène cible manquante', 'Cinématique cible manquante', 'Énigme liée manquante', 'Question suivante introuvable', 'Cible Aller vers manquante', 'Effet scène cible manquante', 'Effet cinématique cible manquante', 'Effet énigme cible manquante'].includes(diagnostic.title)) {
      actions.push({ label: 'Corriger la cible', onClick: () => fixMissingTarget(diagnostic) });
    }
    return actions;
  };

  const toggleSimulatorValue = (field, value) => {
    setSimulator((current) => {
      const values = current[field] || [];
      return {
        ...current,
        [field]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value],
      };
    });
  };

  const updateSimulatorVariable = (key, value) => {
    setSimulator((current) => ({
      ...current,
      variables: {
        ...(current.variables || {}),
        [key]: value,
      },
    }));
  };

  const resetSimulator = () => {
    setSimulator({
      itemIds: [],
      sceneIds: [],
      hotspotIds: [],
      enigmaIds: [],
      replyIds: [],
      variables: getInitialSimulatorVariables(project),
      journalEntries: [],
      lastEffects: [],
      activeNodeId: '',
      activeHotspotId: '',
    });
  };

  const simulateReply = (entry) => {
    setSimulator((current) => applyReplyToSimulator(current, entry, project));
  };

  return (
    <main className="adventure-tab" data-tour="adventure-dashboard">
      <section className="panel adventure-hero-panel">
        <div>
          <span className="section-kicker">Narration</span>
          <h1>
            Contrôle du scénario à choix multiples
            <span
              className="help-dot adventure-title-help"
              data-help="Tableau de bord narratif. Il ne remplace pas l'édition des conversations : il vérifie les branches, variables, réponses cachées et fins."
              aria-label="Tableau de bord narratif. Il ne remplace pas l'édition des conversations : il vérifie les branches, variables, réponses cachées et fins."
              tabIndex={0}
            >
              ?
            </span>
          </h1>
          <p>Vérifie les conversations, les réponses cachées, les variables d'histoire et les fins avant de tester en Preview.</p>
        </div>
        <div className="toolbar">
          <button type="button" className="secondary-action" onClick={() => setTab?.('map')}>Voir le plan</button>
          <button type="button" className="primary-action" onClick={() => setTab?.('preview')}>Tester</button>
        </div>
      </section>

      <nav className="adventure-internal-tabs" aria-label="Sections narration">
        {adventureInternalTabs.map(([tabValue, label, count]) => (
          <button
            type="button"
            key={tabValue}
            className={activeAdventureTab === tabValue ? 'active' : ''}
            data-tour={`adventure-tab-${tabValue}`}
            onClick={() => setActiveAdventureTab(tabValue)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </nav>

      {activeAdventureTab === 'overview' ? (
      <section className="adventure-stat-grid" aria-label="Resume narration" data-tour="adventure-stats">
        <article className="adventure-stat-card">
          <GitBranch size={18} aria-hidden="true" />
          <span>Choix</span>
          <strong>{audit.entries.length}</strong>
        </article>
        <article className="adventure-stat-card">
          <EyeOff size={18} aria-hidden="true" />
          <span>Réponses cachées</span>
          <strong>{audit.hiddenEntries.length}</strong>
        </article>
        <article className="adventure-stat-card">
          <Variable size={18} aria-hidden="true" />
          <span>Variables</span>
          <strong>{audit.variables.length}</strong>
        </article>
        <article className="adventure-stat-card">
          <Flag size={18} aria-hidden="true" />
          <span>Fins</span>
          <strong>{audit.endings.length}</strong>
        </article>
        <article className={`adventure-stat-card ${errorCount ? 'danger' : warningCount ? 'warning' : 'success'}`}>
          {errorCount || warningCount ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
          <span>À vérifier</span>
          <strong>{errorCount + warningCount}</strong>
        </article>
      </section>
      ) : null}

      {activeAdventureTab === 'overview' ? (
      <section className="panel adventure-panel adventure-narrative-panel" data-tour="adventure-narrative-logic">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Logique narrative</span>
            <HelpLabel className="adventure-help-label" help="Lecture détaillée des choix, variables et fins du scénario. Le plan reste spatial, cette zone rassemble les conséquences narratives.">Choix, variables et fins</HelpLabel>
          </div>
          <button type="button" className="secondary-action compact" onClick={() => setActiveAdventureTab('choices')}>Tout ouvrir</button>
        </div>

        <div className="adventure-narrative-summary">
          <span><strong>{audit.entries.length}</strong> choix</span>
          <span><strong>{audit.hiddenEntries.length}</strong> cachés</span>
          <span><strong>{audit.variables.length}</strong> variables</span>
          <span><strong>{narrativeEndingEntries.length}</strong> fins</span>
        </div>

        {audit.entries.length ? (
          <div className="adventure-narrative-layout">
            <div className="adventure-narrative-feed">
              {audit.entries.slice(0, 12).map((entry) => {
                const conditionLabel = getConditionLabel(entry, project, getSceneLabel);
                const variableLabel = getVariableEffectLabel(entry.reply);
                const badges = getDebugReplyBadges(entry, project, getSceneLabel, audit.entries).slice(0, 6);
                const endingEffect = (entry.reply.effects || []).find((effect) => (effect.type || '') === 'ending');
                const isEnding = (entry.reply.actionType || '') === 'ending' || Boolean(endingEffect);
                const endingType = entry.reply.endingType || endingEffect?.endingType || 'neutral';
                return (
                  <article key={entry.id} className={`adventure-narrative-entry ${isEnding ? `ending-${endingType}` : ''}`}>
                    <div>
                      <strong>{entry.reply.label || 'Réponse sans libellé'}</strong>
                      <small>{getSceneLabel(entry.scene.id)} - {entry.hotspot.name || 'Conversation'}</small>
                    </div>
                    <span>{getTargetLabel(entry, project, getSceneLabel)}</span>
                    {conditionLabel ? <em>{conditionLabel}</em> : null}
                    {variableLabel ? <em>Variable: {variableLabel}</em> : null}
                    {badges.length ? (
                      <div className="adventure-narrative-badges">
                        {badges.map((badge, index) => (
                          <small key={`${entry.id}-${badge.kind}-${index}`} className={badge.kind || 'info'}>{badge.label}</small>
                        ))}
                      </div>
                    ) : null}
                    <button type="button" className="secondary-action compact" onClick={() => openConversation(entry, true)}>Aller a la réponse</button>
                  </article>
                );
              })}
              {audit.entries.length > 12 ? (
                <button type="button" className="secondary-action compact" onClick={() => setActiveAdventureTab('choices')}>
                  Voir les {audit.entries.length - 12} choix restants
                </button>
              ) : null}
            </div>

            <aside className="adventure-narrative-side">
              <section>
                <h3>Variables</h3>
                {audit.variables.length ? audit.variables.slice(0, 8).map((variable) => (
                  <article key={variable.key} className={`adventure-narrative-side-card ${!variable.declared || (!variable.modified && variable.tested) ? 'warning' : ''}`}>
                    <strong>{variable.key}</strong>
                    <span>{variable.declared ? 'Déclarée' : 'Non déclarée'} - {variable.effects.length} modif. - {variable.tests.length} test(s)</span>
                    {variable.range?.hasNumericSignal ? <em>Plage: {variable.range.min} à {variable.range.max}</em> : null}
                  </article>
                )) : <small className="adventure-muted">Aucune variable narrative.</small>}
                {audit.variables.length > 8 ? <button type="button" className="secondary-action compact" onClick={() => setActiveAdventureTab('variables')}>Voir toutes les variables</button> : null}
              </section>

              <section>
                <h3>Fins</h3>
                {narrativeEndingEntries.length ? narrativeEndingEntries.slice(0, 8).map((entry) => {
                  const endingEffect = (entry.reply.effects || []).find((effect) => (effect.type || '') === 'ending');
                  const endingType = entry.reply.endingType || endingEffect?.endingType || 'neutral';
                  return (
                    <article key={`ending-${entry.id}`} className={`adventure-narrative-side-card ending-${endingType}`}>
                      <strong>{entry.reply.endingTitle || endingEffect?.endingTitle || 'Fin sans titre'}</strong>
                      <span>{ENDING_TYPE_LABELS[endingType] || 'Fin neutre'}</span>
                      <em>{getSceneLabel(entry.scene.id)} - {entry.reply.label || 'Réponse'}</em>
                    </article>
                  );
                }) : <small className="adventure-muted">Aucune fin configurée.</small>}
                {narrativeEndingEntries.length > 8 ? <button type="button" className="secondary-action compact" onClick={() => setActiveAdventureTab('endings')}>Voir toutes les fins</button> : null}
              </section>
            </aside>
          </div>
        ) : <EmptyAdventureState />}
      </section>
      ) : null}

      {activeAdventureTab === 'debugger' ? (
      <section className="panel adventure-panel adventure-debugger-panel" data-tour="adventure-debugger">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Analyse</span>
            <HelpLabel className="adventure-help-label" help="Vue compacte de la logique narrative : qui cache quoi, quelles questions sont askOnce, quels objets ou variables sont modifiés, et de quels choix précédents dépendent les conditions.">Branches lisibles d’un coup</HelpLabel>
          </div>
          <div className="adventure-debugger-count">
            <strong>{logicDebugger.statements.length}</strong>
            <span>points analysés</span>
          </div>
        </div>

        <div className="adventure-debugger-summary" aria-label="Résumé de l'analyse des branches">
          <span><strong>{logicDebugger.hiddenRules.length}</strong> relations cachées</span>
          <span><strong>{logicDebugger.askOnceNodes.length}</strong> questions askOnce</span>
          <span><strong>{logicDebugger.itemRules.length}</strong> effets objet</span>
          <span><strong>{logicDebugger.variableRules.length}</strong> effets variable</span>
          <span><strong>{logicDebugger.dependencyRules.length}</strong> conditions</span>
        </div>

        {logicDebugger.statements.length || logicDebugger.conversations.length ? (
          <div className="adventure-debugger-grid">
            <section className="adventure-debugger-feed">
              <h3>Fil des branches</h3>
              {logicDebugger.statements.length ? logicDebugger.statements.map((statement) => (
                <article key={statement.id} className={`adventure-debugger-statement ${statement.kind || 'info'}`}>
                  <span className={`adventure-debugger-kind ${statement.kind || 'info'}`}>
                    {{
                      askOnce: 'askOnce',
                      hide: 'cache',
                      choice: 'choix',
                      condition: 'condition',
                      item: 'objet',
                      variable: 'variable',
                      route: 'suite',
                      media: 'média',
                      ending: 'fin',
                    }[statement.kind] || 'règle'}
                  </span>
                  <strong>{statement.title}</strong>
                  <small>{statement.detail}</small>
                  {statement.entry?.scene ? (
                    <em>{getSceneLabel(statement.entry.scene.id)} - {statement.entry.hotspot?.name || 'Conversation'}</em>
                  ) : null}
                  {statement.entry?.hotspot ? (
                    <div className="adventure-choice-actions">
                      <button type="button" className="secondary-action compact" onClick={() => openConversation(statement.entry, false)}>Ouvrir</button>
                      {statement.entry?.reply?.id ? (
                        <button type="button" className="secondary-action compact" onClick={() => openConversation(statement.entry, true)}>Aller à la réponse</button>
                      ) : null}
                      {statement.sourceEntry?.reply?.id ? (
                        <button type="button" className="secondary-action compact" onClick={() => openConversation(statement.sourceEntry, true)}>Voir le lien</button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )) : <div className="empty-state-inline">Aucune règle speciale détectée.</div>}
            </section>

            <section className="adventure-debugger-conversations">
              <h3>Matrice par conversation</h3>
              {logicDebugger.conversations.length ? logicDebugger.conversations.map((conversation) => (
                <article key={conversation.id} className="adventure-debugger-conversation">
                  <header>
                    <div>
                      <strong>{conversation.hotspot?.name || 'Conversation'}</strong>
                    <small>{conversation.scene ? getSceneLabel(conversation.scene.id) : 'Scène'}</small>
                    </div>
                    <span>{conversation.nodes.reduce((total, nodeEntry) => total + (nodeEntry.entries?.length || 0), 0)} réponse(s)</span>
                  </header>
                  <div className="adventure-debugger-node-list">
                    {conversation.nodes.map((nodeEntry) => (
                      <div key={`${conversation.id}-${nodeEntry.node.id}`} className={`adventure-debugger-node ${nodeEntry.node.askOnce ? 'ask-once' : ''}`}>
                        <div className="adventure-debugger-node-head">
                          <strong>{getDebugNodeTitle(nodeEntry.node)}</strong>
                          {nodeEntry.node.askOnce ? <span>askOnce</span> : null}
                        </div>
                        {nodeEntry.entries.length ? nodeEntry.entries.map((entry) => {
                          const badges = getDebugReplyBadges(entry, project, getSceneLabel, audit.entries);
                          return (
                            <article key={entry.id} className="adventure-debugger-reply">
                              <button type="button" onClick={() => openConversation(entry, true)}>
                                {getDebugReplyTitle(entry)}
                              </button>
                              <div className="adventure-debugger-badges">
                                {badges.length ? badges.slice(0, 8).map((badge, index) => (
                                  <span key={`${entry.id}-${badge.kind}-${index}`} className={badge.kind || 'info'}>{badge.label}</span>
                                )) : <span className="neutral">Visible sans condition speciale</span>}
                              </div>
                            </article>
                          );
                        }) : <small className="adventure-muted">Aucune réponse dans cette question.</small>}
                      </div>
                    ))}
                  </div>
                </article>
              )) : <EmptyAdventureState />}
            </section>
          </div>
        ) : <EmptyAdventureState />}
      </section>
      ) : null}

      {activeAdventureTab === 'search' ? (
      <section className="panel adventure-panel adventure-search-panel" data-tour="adventure-search">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Recherche</span>
            <HelpLabel className="adventure-help-label" help="Cherche une variable, un objet, une fin, une réponse, une condition ou un message pour voir tous les endroits où cet élément apparaît dans le scénario.">Recherche globale narrative</HelpLabel>
          </div>
          {narrativeSearch ? <button type="button" className="secondary-action compact" onClick={() => setNarrativeSearch('')}>Effacer</button> : null}
        </div>
        <label className="adventure-search-input">
          <Search size={16} aria-hidden="true" />
          <input
            value={narrativeSearch}
            placeholder="confiance_du_guide, jeton, fin secrète, forêt..."
            onChange={(event) => setNarrativeSearch(event.target.value)}
          />
        </label>
        {narrativeSearch.trim() ? (
          <div className="adventure-search-results">
            <div className="adventure-search-summary">
              <strong>{narrativeSearchResults.length}</strong>
              <span>résultat(s) trouve(s)</span>
            </div>
            {narrativeSearchResults.length ? narrativeSearchResults.map((result, index) => (
              <article key={`${result.type}-${result.title}-${index}`} className="adventure-search-result">
                <div>
                  <span>{result.type}</span>
                  <strong>{result.title}</strong>
                  <small>{result.detail}</small>
                </div>
                <em>{result.badge}</em>
                {result.entry?.replyId || result.entry?.reply?.id ? (
                  <div className="adventure-choice-actions">
                    <button type="button" className="secondary-action compact" onClick={() => openConversation(result.entry, false)}>Ouvrir</button>
                    <button type="button" className="secondary-action compact" onClick={() => openConversation(result.entry, true)}>Aller à la réponse</button>
                  </div>
                ) : null}
              </article>
            )) : <div className="empty-state-inline">Aucun usage trouve pour cette recherche.</div>}
          </div>
        ) : (
          <p className="adventure-muted">Tape un nom de variable, un objet, une fin, une réponse ou un morceau dé texte.</p>
        )}
      </section>
      ) : null}

      {activeAdventureTab === 'simulator' ? (
      <section className="panel adventure-panel adventure-simulator-panel" data-tour="adventure-simulator">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Simulateur</span>
            <HelpLabel className="adventure-help-label" help="Règle un état de test pour voir quelles réponses deviennent visibles et quelles fins sont accessibles. Ce simulateur ne joue pas automatiquement tout le parcours : il teste les conditions principales.">Branches visibles</HelpLabel>
          </div>
          <button type="button" className="secondary-action compact" onClick={resetSimulator}>Reinitialiser</button>
        </div>

        <div className="adventure-simulator-grid">
          <div className="adventure-simulator-controls">
            <section>
              <HelpLabel help="Objets considérés comme déjà possédés par le joueur pendant ce test.">Objets possédés</HelpLabel>
              {(project.items || []).length ? (
                <div className="adventure-simulator-pill-list">
                  {(project.items || []).map((item) => (
                    <label key={item.id} className="adventure-simulator-pill">
                      <input type="checkbox" checked={simulator.itemIds.includes(item.id)} onChange={() => toggleSimulatorValue('itemIds', item.id)} />
                      <span>{item.icon || ''} {item.name || 'Objet'}</span>
                    </label>
                  ))}
                </div>
              ) : <small className="adventure-muted">Aucun objet dans le projet.</small>}
            </section>

            <section>
              <HelpLabel help="Énigmes considérées comme résolues pour tester les réponses cachées par condition.">Énigmes résolues</HelpLabel>
              {(project.enigmas || []).length ? (
                <div className="adventure-simulator-pill-list">
                  {(project.enigmas || []).map((enigma) => (
                    <label key={enigma.id} className="adventure-simulator-pill">
                      <input type="checkbox" checked={simulator.enigmaIds.includes(enigma.id)} onChange={() => toggleSimulatorValue('enigmaIds', enigma.id)} />
                      <span>{enigma.name || 'Énigme'}</span>
                    </label>
                  ))}
                </div>
              ) : <small className="adventure-muted">Aucune énigme dans le projet.</small>}
            </section>

            <section>
              <HelpLabel help="Choix considérés comme déjà faits. Utile pour tester les conditions combinées qui dépendent d’une réponse précédente.">Choix précédents</HelpLabel>
              {audit.entries.length ? (
                <div className="adventure-simulator-pill-list">
                  {audit.entries.slice(0, 18).map((entry) => (
                    <label key={entry.id} className="adventure-simulator-pill">
                      <input type="checkbox" checked={simulator.replyIds.includes(entry.reply.id)} onChange={() => toggleSimulatorValue('replyIds', entry.reply.id)} />
                      <span>{entry.reply.label || 'Réponse'}</span>
                    </label>
                  ))}
                </div>
              ) : <small className="adventure-muted">Aucun choix à simuler.</small>}
            </section>

            <section>
              <HelpLabel help="Valeurs de variables utilisées uniquement par ce simulateur. Elles n'écrasent pas les valeurs de départ du projet.">Variables de test</HelpLabel>
              {simulatorVariableKeys.length ? (
                <div className="adventure-simulator-variable-list">
                  {simulatorVariableKeys.map((key) => {
                    const definition = (project.storyVariables || []).find((variable) => variable.key === key);
                    const type = definition?.type || 'text';
                    const value = simulator.variables?.[key] ?? definition?.defaultValue ?? '';
                    return (
                      <div key={key} className="adventure-simulator-variable-row">
                        <span>{key}</span>
                        {type === 'boolean' ? (
                          <select value={String(value === true || value === 'true')} onChange={(event) => updateSimulatorVariable(key, event.target.value)}>
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </select>
                        ) : (
                          <input
                            type={type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(event) => updateSimulatorVariable(key, event.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : <small className="adventure-muted">Aucune variable à tester.</small>}
            </section>
          </div>

          <div className="adventure-simulator-results">
            <div className="adventure-simulator-summary">
              <span><strong>{visibleSimulatorEntries.length}</strong> réponses visibles</span>
              <span><strong>{hiddenSimulatorEntries.length}</strong> réponses bloquées</span>
              <span><strong>{accessibleSimulatorEndings.length}</strong> fins accessibles</span>
            </div>

            {(simulator.lastEffects || []).length ? (
              <section className="adventure-simulator-effects">
                <h3>Derniers effets appliqués</h3>
                <div>
                  {(simulator.lastEffects || []).map((effect, index) => (
                    <span key={`${effect.type}-${index}`} className={`adventure-simulator-effect ${effect.type || 'effect'}`}>
                      {effect.label}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="adventure-simulator-state">
              <section>
                <h3>État simule</h3>
                <div className="adventure-state-list">
                  <span><strong>Objets</strong> {(simulator.itemIds || []).length ? simulator.itemIds.map((itemId) => getProjectItemLabel(project, itemId)).join(', ') : 'aucun'}</span>
                  <span><strong>Scènes visitées</strong> {(simulator.sceneIds || []).length ? simulator.sceneIds.map((sceneId) => getProjectTargetName(project.scenes || [], sceneId, 'Scène')).join(', ') : 'aucune'}</span>
                  <span><strong>Choix faits</strong> {(simulator.replyIds || []).length}</span>
                  {activeSimulatorNode ? <span><strong>Question courante</strong> {activeSimulatorNode.node.speaker || 'PNJ'} - {(activeSimulatorNode.node.text || '').slice(0, 80)}</span> : null}
                </div>
              </section>
              <section>
                <h3>Journal de test</h3>
                <div className="adventure-state-list">
                  {(simulator.journalEntries || []).length ? simulator.journalEntries.slice(0, 8).map((entry, index) => (
                    <span key={`${entry.type}-${index}`}><strong>{entry.replyLabel}</strong> {entry.label}</span>
                  )) : <span>Aucun effet joue.</span>}
                </div>
              </section>
            </div>

            {activeSimulatorNode ? (
              <section className="adventure-simulator-current-node">
                <h3>Prochaines réponses visibles</h3>
                {activeSimulatorEntries.length ? activeSimulatorEntries.map((entry) => (
                  <article key={entry.id} className="adventure-simulator-result-card visible">
                    <strong>{entry.reply.label || 'Réponse sans libellé'}</strong>
                    <span>{entry.node.speaker || 'PNJ'} - {(entry.node.text || '').slice(0, 80)}</span>
                    <small>{getTargetLabel(entry, project, getSceneLabel)}</small>
                    <button type="button" className="secondary-action compact" onClick={() => simulateReply(entry)}>Simuler cette réponse</button>
                  </article>
                )) : <small className="adventure-muted">Aucune réponse visible dans cette question.</small>}
              </section>
            ) : null}

            <div className="adventure-simulator-result-columns">
              <section>
                <h3>Réponses visibles</h3>
                {visibleSimulatorEntries.length ? visibleSimulatorEntries.map((entry) => (
                  <article key={entry.id} className="adventure-simulator-result-card visible">
                    <strong>{entry.reply.label || 'Réponse sans libellé'}</strong>
                    <span>{getSceneLabel(entry.scene.id)} - {entry.hotspot.name || 'Conversation'}</span>
                    <small>{getTargetLabel(entry, project, getSceneLabel)}</small>
                    <button type="button" className="secondary-action compact" onClick={() => simulateReply(entry)}>Simuler</button>
                  </article>
                )) : <small className="adventure-muted">Aucune réponse visible avec cet état.</small>}
              </section>

              <section>
                <h3>Fins accessibles</h3>
                {accessibleSimulatorEndings.length ? accessibleSimulatorEndings.map((entry) => (
                  <article key={entry.id} className={`adventure-simulator-result-card ending-${entry.reply.endingType || 'neutral'}`}>
                    <strong>{entry.reply.endingTitle || 'Fin sans titre'}</strong>
                    <span>{ENDING_TYPE_LABELS[entry.reply.endingType || 'neutral'] || 'Fin neutre'}</span>
                    <small>{entry.reply.label || 'Réponse de fin'}</small>
                  </article>
                )) : <small className="adventure-muted">Aucune fin accessible avec cet état.</small>}
              </section>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {activeAdventureTab === 'diagnostics' ? (
      <section className="adventure-dashboard-grid">
        <article className="panel adventure-panel" data-tour="adventure-diagnostics">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Diagnostic</span>
              <HelpLabel className="adventure-help-label" help="Liste les erreurs et avertissements détectés dans les conversations : cible manquante, condition incomplète, variable jamais modifiée, chemin impossible par plage de variable ou fin sans titre. Clique une ligne pour revenir à la scène concernée.">Branches à corriger</HelpLabel>
            </div>
          </div>
          {audit.diagnostics.length ? (
            <div className="adventure-diagnostic-list">
              {audit.diagnostics.map((entry) => {
                const actions = getDiagnosticActions(entry);
                return (
                  <article key={entry.id} className={`adventure-diagnostic ${entry.severity}`}>
                    <button
                      type="button"
                      className="adventure-diagnostic-main"
                      onClick={() => openScene(entry.sceneId)}
                      disabled={!entry.sceneId}
                    >
                      <AlertTriangle size={15} aria-hidden="true" />
                      <span>
                        <strong>{entry.title}</strong>
                        <small>{[entry.sceneName, entry.hotspotName, entry.replyLabel].filter(Boolean).join(' - ') || entry.detail}</small>
                      </span>
                    </button>
                    {actions.length ? (
                      <div className="adventure-diagnostic-actions">
                        {actions.map((action) => (
                          <button key={action.label} type="button" className="secondary-action compact" onClick={action.onClick}>
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-inline">Aucun problème détecté dans les conversations.</div>
          )}
        </article>
      </section>
      ) : null}

      {activeAdventureTab === 'variables' ? (
      <section className="adventure-dashboard-grid">
        <article className="panel adventure-panel" data-tour="adventure-variables">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Variables</span>
              <HelpLabel className="adventure-help-label" help="Liste officielle dés variables d'histoire du projet. Déclare ici leur nom, type, valeur de départ et description pour éviter les fautes de nom dans les conversations.">Variables officielles</HelpLabel>
            </div>
            <button type="button" className="secondary-action compact" onClick={() => addStoryVariable()}>
              <Plus size={14} aria-hidden="true" /> Variable
            </button>
          </div>
          {(project.storyVariables || []).length ? (
            <div className="adventure-variable-editor-list">
              {(project.storyVariables || []).map((variable) => {
                const usage = audit.variables.find((entry) => entry.key === variable.key);
                const duplicateCount = (project.storyVariables || []).filter((entry) => entry.key === variable.key).length;
                return (
                  <div key={variable.id} className={`adventure-variable-editor-row ${audit.unknownVariableKeys.includes(variable.key) ? 'warning' : ''}`}>
                    <div className="adventure-variable-editor-main">
                      <HelpLabel help="Nom exact utilisé dans les conditions et effets des réponses. Exemple : confiance_du_guide.">Nom</HelpLabel>
                      <input value={variable.key || ''} placeholder="confiance_du_guide" onChange={(event) => updateStoryVariable(variable.id, { key: event.target.value })} />
                      <HelpLabel help="Type attendu pour la variable : nombre pour un compteur, booleen pour vrai/faux, texte pour un état narratif.">Type</HelpLabel>
                      <select value={variable.type || 'boolean'} onChange={(event) => updateStoryVariable(variable.id, { type: event.target.value })}>
                        <option value="number">Nombre</option>
                        <option value="boolean">Booleen</option>
                        <option value="text">Texte</option>
                      </select>
                      <HelpLabel help="Valeur au début de la partie, avant que le joueur fasse un choix.">Valeur de départ</HelpLabel>
                      {variable.type === 'boolean' ? (
                        <select value={String(variable.defaultValue === true)} onChange={(event) => updateStoryVariable(variable.id, { defaultValue: event.target.value })}>
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : (
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={variable.defaultValue ?? ''}
                          placeholder={variable.type === 'number' ? '0' : 'départ'}
                          onChange={(event) => updateStoryVariable(variable.id, { defaultValue: event.target.value })}
                        />
                      )}
                      <HelpLabel help="Note interne pour te souvenir de l utilite de cette variable et des choix qui doivent la modifier.">Description</HelpLabel>
                      <textarea value={variable.description || ''} placeholder="Augmente quand le joueur aide le guide." onChange={(event) => updateStoryVariable(variable.id, { description: event.target.value })} />
                      <HelpLabel help="Nom clair affiche dans le journal joueur. Exemple : Confiance du guide au lieu de confiance_du_guide.">Nom dans le journal</HelpLabel>
                      <input value={variable.journalLabel || ''} placeholder="Confiance du guide" onChange={(event) => updateStoryVariable(variable.id, { journalLabel: event.target.value })} />
                      <HelpLabel help="Si activée, cette variable apparaît dans le journal joueur avec sa valeur actuelle. Désactive pour les variables techniques.">Journal joueur</HelpLabel>
                      <label className="adventure-inline-check">
                        <input type="checkbox" checked={variable.journalVisible !== false} onChange={(event) => updateStoryVariable(variable.id, { journalVisible: event.target.checked })} />
                        <span>Afficher</span>
                      </label>
                    </div>
                    <div className="adventure-variable-editor-side">
                      <strong>{VARIABLE_TYPE_LABELS[variable.type || 'boolean']}</strong>
                      <span>{usage?.effects.length || 0} modification(s)</span>
                      <span>{usage?.tests.length || 0} test(s)</span>
                      {usage?.range?.hasNumericSignal ? <span>Plage: {usage.range.min} à {usage.range.max}</span> : null}
                      {duplicateCount > 1 ? <em>Nom en double</em> : null}
                      {!usage?.modified && usage?.tested ? <em>Testée sans modification</em> : null}
                      <button type="button" className="danger-button compact" onClick={() => deleteStoryVariable(variable.id)}>
                        <Trash2 size={13} aria-hidden="true" /> Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyAdventureState />}
          {audit.unknownVariableKeys.length ? (
            <div className="adventure-unknown-variable-list">
              <strong>Variables utilisées mais non déclarées</strong>
              {audit.unknownVariableKeys.map((key) => (
                <div key={key} className="adventure-unknown-variable-row">
                  <span>{key}</span>
                  <button type="button" className="secondary-action compact" onClick={() => addStoryVariable(key)}>Déclarer</button>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>
      ) : null}

      {activeAdventureTab === 'choices' ? (
      <section className="adventure-dashboard-grid wide">
        <article className="panel adventure-panel" data-tour="adventure-choices">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Choix</span>
              <HelpLabel className="adventure-help-label" help="Vue globale dés boutons proposes au joueur, de leur conséquence, de leur condition d affichage et de l’effet sur les variables.">Réponses et conséquences</HelpLabel>
            </div>
          </div>
          {audit.entries.length ? (
            <div className="adventure-choice-grid">
              {audit.entries.map((entry) => {
                const conditionLabel = getConditionLabel(entry, project, getSceneLabel);
                const variableLabel = getVariableEffectLabel(entry.reply);
                const isEnding = (entry.reply.actionType || '') === 'ending';
                return (
                  <article key={entry.id} className={`adventure-choice-card ${isEnding ? `ending-${entry.reply.endingType || 'neutral'}` : ''}`}>
                    <div>
                      <strong>{entry.reply.label || 'Réponse sans libellé'}</strong>
                      <small>{getSceneLabel(entry.scene.id)} - {entry.hotspot.name || 'Conversation'}</small>
                    </div>
                    <span>{ACTION_LABELS[entry.reply.actionType || 'node'] || 'Action'} - {getTargetLabel(entry, project, getSceneLabel)}</span>
                    {(entry.reply.branchTags || []).length ? (
                      <div className="adventure-branch-tags">{entry.reply.branchTags.map((tag) => <small key={tag}>{tag}</small>)}</div>
                    ) : null}
                    {conditionLabel ? <em>{CONDITION_LABELS[entry.reply.conditionType] || 'Condition'}: {conditionLabel}</em> : null}
                    {variableLabel ? <em>Variable: {variableLabel}</em> : null}
                    {entry.reply.authorNote ? <em>Note auteur: {entry.reply.authorNote}</em> : null}
                    <div className="adventure-choice-actions">
                      <button type="button" className="secondary-action compact" onClick={() => openConversation(entry, false)}>Ouvrir la conversation</button>
                      <button type="button" className="secondary-action compact" onClick={() => openConversation(entry, true)}>Aller à la réponse</button>
                      {isEnding && !entry.reply.endingTitle ? (
                        <button type="button" className="secondary-action compact" onClick={() => patchReplyFromEntry(entry, (reply) => {
                          reply.endingTitle = 'Nouvelle fin';
                          reply.endingSummary = reply.endingSummary || reply.dialogue || 'Résumé de cette fin.';
                        })}>Ajouter un titre de fin</button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EmptyAdventureState />}
        </article>
      </section>
      ) : null}

      {activeAdventureTab === 'endings' ? (
      <section className="adventure-dashboard-grid wide">
        <article className="panel adventure-panel" data-tour="adventure-endings">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Fins</span>
              <HelpLabel className="adventure-help-label" help="Toutes les fins déclenchées par les conversations : bonne fin, mauvaise fin, fin secrète ou fin neutre. Chaque fin devrait avoir un titre, un résumé et un chemin testable en Preview.">Issues possibles</HelpLabel>
            </div>
          </div>
          {audit.endings.length ? (
            <div className="adventure-ending-list">
              {audit.endings.map((entry) => (
                <article key={entry.id} className={`adventure-ending-card ending-${entry.reply.endingType || 'neutral'}`}>
                  <Flag size={16} aria-hidden="true" />
                  <div>
                    <strong>{entry.reply.endingTitle || 'Fin sans titre'}</strong>
                    <span>{ENDING_TYPE_LABELS[entry.reply.endingType || 'neutral'] || 'Fin neutre'}</span>
                    <small>{entry.reply.endingSummary || entry.reply.dialogue || 'Aucun résumé de fin.'}</small>
                    <div className="adventure-choice-actions">
                      <button type="button" className="secondary-action compact" onClick={() => openConversation(entry, true)}>Aller à la réponse</button>
                      {!entry.reply.endingTitle ? (
                        <button type="button" className="secondary-action compact" onClick={() => patchReplyFromEntry(entry, (reply) => {
                          reply.endingTitle = 'Nouvelle fin';
                          reply.endingSummary = reply.endingSummary || reply.dialogue || 'Résumé de cette fin.';
                        })}>Ajouter un titre de fin</button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state-inline">Ajoute au moins une bonne fin, une mauvaise fin ou une fin secrète.</div>
          )}
        </article>
      </section>
      ) : null}

      {activeAdventureTab === 'overview' ? (
      <section className="panel adventure-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Prochaines étapes</span>
            <HelpLabel className="adventure-help-label" help="Checklist rapide pour savoir si ta narration a choix multiples est lisible, testable et moins risquee avant export ou publication.">Ce que cet onglet surveille</HelpLabel>
          </div>
        </div>
        <div className="adventure-checklist">
          <span><ListChecks size={15} aria-hidden="true" /> Chaque question importante a plusieurs réponses.</span>
          <span><EyeOff size={15} aria-hidden="true" /> Les réponses cachées ont une condition complète.</span>
          <span><SlidersHorizontal size={15} aria-hidden="true" /> Les variables testées sont aussi modifiées quelque part.</span>
          <span><AlertTriangle size={15} aria-hidden="true" /> Les fins ne demandent pas une valeur impossible à atteindre.</span>
          <span><Flag size={15} aria-hidden="true" /> Les fins ont un titre et un résumé lisible.</span>
        </div>
      </section>
      ) : null}
    </main>
  );
}
