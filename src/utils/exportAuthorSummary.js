import { downloadBlob } from './fileHelpers';

const slugify = (value = 'scénario') => (
  String(value || 'scénario')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'scénario'
);

const line = (value = '') => String(value ?? '').replace(/\r?\n/g, ' ').trim();

const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const htmlList = (entries, emptyText = 'Aucun element.') => (
  entries.length ? `<ul>${entries.map((entry) => `<li>${entry}</li>`).join('')}</ul>` : `<p class="muted">${escapeHtml(emptyText)}</p>`
);

const getAllHotspots = (project = {}) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || []).map((hotspot) => ({ ...hotspot, sceneId: scene.id, sceneName: scene.name }))
  ))
);

const getSceneLabel = (project, sceneId) => (
  (project.scenes || []).find((scene) => scene.id === sceneId)?.name || sceneId || 'non choisi'
);

const getItemLabel = (project, itemId) => {
  const item = (project.items || []).find((entry) => entry.id === itemId);
  return item ? `${item.icon || ''} ${item.name || 'Objet'}`.trim() : itemId || 'non choisi';
};

const getEnigmaLabel = (project, enigmaId) => (
  (project.enigmas || []).find((entry) => entry.id === enigmaId)?.name || enigmaId || 'non choisie'
);

const getCinematicLabel = (project, cinematicId) => (
  (project.cinematics || []).find((entry) => entry.id === cinematicId)?.name || cinematicId || 'non choisie'
);

const getHotspotLabel = (project, hotspotId) => {
  const hotspot = getAllHotspots(project).find((entry) => entry.id === hotspotId);
  return hotspot ? `${hotspot.sceneName || 'Scene'} / ${hotspot.name || 'Zone'}` : hotspotId || 'non choisie';
};

const getReplyLabel = (conversation, replyId) => {
  const reply = (conversation?.nodes || []).flatMap((node) => node.replies || []).find((entry) => entry.id === replyId);
  return reply?.label || replyId || 'non choisi';
};

const getNodeLabel = (conversation, nodeId) => {
  const node = (conversation?.nodes || []).find((entry) => entry.id === nodeId);
  return node ? `${node.speaker || 'PNJ'} - ${line(node.text).slice(0, 80)}` : nodeId || 'non choisie';
};

const conditionToText = (project, condition = {}, conversation = null) => {
  const operators = { equals: '=', not_equals: '!=', greater_or_equal: '>=', less_or_equal: '<=', truthy: 'est vrai/rempli', falsy: 'est faux/vide' };
  if (condition.type === 'has_item') return `objet possède: ${getItemLabel(project, condition.itemId)}`;
  if (condition.type === 'visited_scene') return `scène visitee: ${getSceneLabel(project, condition.sceneId)}`;
  if (condition.type === 'completed_hotspot') return `zone utilisée: ${getHotspotLabel(project, condition.hotspotId)}`;
  if (condition.type === 'solved_enigma') return `énigme résolue: ${getEnigmaLabel(project, condition.enigmaId)}`;
  if (condition.type === 'chose_reply') return `choix précédent: ${getReplyLabel(conversation, condition.replyId)}`;
  if (condition.type === 'story_variable') {
    const operator = condition.operator || 'equals';
    const suffix = ['truthy', 'falsy'].includes(operator) ? '' : ` ${condition.value ?? ''}`;
    return `${condition.variableKey || 'variable'} ${operators[operator] || '='}${suffix}`;
  }
  return 'condition non definie';
};

const getReplyConditions = (reply = {}) => {
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

const getConditionText = (project, reply = {}, conversation = null) => {
  const conditions = getReplyConditions(reply);
  if (!conditions.length) return 'visible tout de suite';
  const mode = (reply.conditionType || 'none') === 'advanced' && (reply.advancedConditionMode || 'all') === 'any' ? ' OU ' : ' ET ';
  return conditions.map((condition) => conditionToText(project, condition, conversation)).join(mode);
};

const getTargetText = (project, reply = {}, conversation = null) => {
  const actionType = reply.actionType || (reply.nextNodeId ? 'node' : 'end');
  if (['node', 'dialogue', 'multiple'].includes(actionType)) {
    const targetNode = (conversation?.nodes || []).find((node) => node.id === reply.nextNodeId);
    return targetNode ? `question: ${targetNode.speaker || 'PNJ'} - ${line(targetNode.text).slice(0, 80)}` : 'fin de conversation';
  }
  if (actionType === 'item') return `donne objet: ${getItemLabel(project, reply.rewardItemId)}`;
  if (actionType === 'scene') return `scène: ${getSceneLabel(project, reply.targetSceneId)}`;
  if (actionType === 'cinematic') return `cinématique: ${getCinematicLabel(project, reply.targetCinematicId)}`;
  if (actionType === 'enigma') return `énigme: ${getEnigmaLabel(project, reply.enigmaId)}`;
  if (actionType === 'ending') return `fin ${reply.endingType || 'neutre'}: ${reply.endingTitle || 'sans titre'}`;
  if (actionType === 'skill_check') return `test: ${reply.skillCheckSkillId || 'competence'} ${reply.skillCheckDifficulty || ''}`.trim();
  if (actionType === 'hero_combat') return `combat: ${reply.enemyName || 'adversaire'}`;
  return 'fin de conversation';
};

const getVariableEffectText = (reply = {}) => {
  const operation = reply.storyVariableOperation || 'none';
  if (operation === 'none' || !reply.storyVariableKey) return '';
  if (operation === 'increment') return `${reply.storyVariableKey} +${reply.storyVariableValue || 1}`;
  if (operation === 'decrement') return `${reply.storyVariableKey} -${reply.storyVariableValue || 1}`;
  return `${reply.storyVariableKey} = ${reply.storyVariableValue ?? ''}`;
};

const getConversationEffectText = (project, effect = {}, conversation = null) => {
  const type = effect.type || 'message';
  if (type === 'message') return `message: ${line(effect.message) || 'vide'}`;
  if (type === 'add_item') return `objet ajoute: ${getItemLabel(project, effect.itemId)}`;
  if (type === 'remove_item') return `objet retire: ${getItemLabel(project, effect.itemId)}`;
  if (type === 'set_variable') return `variable: ${effect.variableKey || 'non choisie'} = ${effect.value ?? ''}`;
  if (type === 'increment_variable') return `variable: ${effect.variableKey || 'non choisie'} +${effect.value || 1}`;
  if (type === 'decrement_variable') return `variable: ${effect.variableKey || 'non choisie'} -${effect.value || 1}`;
  if (type === 'journal') {
    const title = line(effect.journalTitle || effect.message || 'Entree journal');
    const detail = line(effect.journalDetail);
    return `journal: ${detail ? `${title} - ${detail}` : title}`;
  }
  if (type === 'next_node') return `aller vers question: ${getNodeLabel(conversation, effect.nextNodeId)}`;
  if (type === 'scene') return `aller vers scène: ${getSceneLabel(project, effect.targetSceneId)}`;
  if (type === 'cinematic') return `lancer cinématique: ${getCinematicLabel(project, effect.targetCinematicId)}`;
  if (type === 'enigma') return `ouvrir énigme: ${getEnigmaLabel(project, effect.enigmaId)}`;
  if (type === 'ending') return `fin ${effect.endingType || 'neutral'}: ${effect.endingTitle || 'sans titre'}`;
  return `effet: ${type}`;
};

const getConversationEffectTexts = (project, reply = {}, conversation = null) => (
  (Array.isArray(reply.effects) ? reply.effects : [])
    .map((effect) => getConversationEffectText(project, effect, conversation))
    .filter(Boolean)
);

const getConversationEffectEndings = (allReplies) => allReplies.flatMap(({ scene, hotspot, node, reply }) => (
  (Array.isArray(reply.effects) ? reply.effects : [])
    .filter((effect) => (effect.type || '') === 'ending')
    .map((effect) => ({ scene, hotspot, node, reply, ending: effect, source: 'Effet multiple' }))
));

const getAllEndingEntries = (allReplies) => [
  ...allReplies
    .filter(({ reply }) => (reply.actionType || '') === 'ending')
    .map((entry) => ({ ...entry, ending: entry.reply, source: 'Suite principale' })),
  ...getConversationEffectEndings(allReplies),
];

const getStoryVariableRanges = (project, allReplies) => {
  const ranges = new Map();
  const ensureRange = (key) => {
    if (!key) return null;
    if (!ranges.has(key)) {
      const definition = (project.storyVariables || []).find((variable) => variable.key === key);
      const defaultValue = Number(definition?.defaultValue);
      const startValue = Number.isFinite(defaultValue) ? defaultValue : 0;
      ranges.set(key, { minBase: startValue, maxBase: startValue, positiveDelta: 0, negativeDelta: 0, hasNumericSignal: definition?.type === 'number' || Number.isFinite(defaultValue) });
    }
    return ranges.get(key);
  };
  allReplies.forEach(({ reply }) => {
    getReplyConditions(reply).forEach((condition) => {
      if (condition.type === 'story_variable') ensureRange(condition.variableKey);
    });
    const range = ensureRange(reply.storyVariableKey);
    if (range && (reply.storyVariableOperation || 'none') !== 'none') {
      const numericValue = Number(reply.storyVariableValue);
      const amount = Number.isFinite(numericValue) ? numericValue : 1;
      range.hasNumericSignal = range.hasNumericSignal || Number.isFinite(numericValue) || ['increment', 'decrement'].includes(reply.storyVariableOperation || 'none');
      if (reply.storyVariableOperation === 'increment') {
        if (amount >= 0) range.positiveDelta += amount;
        else range.negativeDelta += amount;
      }
      if (reply.storyVariableOperation === 'decrement') {
        if (amount >= 0) range.negativeDelta -= amount;
        else range.positiveDelta -= amount;
      }
      if (reply.storyVariableOperation === 'set' && Number.isFinite(numericValue)) {
        range.minBase = Math.min(range.minBase, numericValue);
        range.maxBase = Math.max(range.maxBase, numericValue);
      }
    }
    (Array.isArray(reply.effects) ? reply.effects : []).forEach((effect) => {
      if (!['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '')) return;
      const effectRange = ensureRange(effect.variableKey);
      if (!effectRange) return;
      const effectNumericValue = Number(effect.value);
      const effectAmount = Number.isFinite(effectNumericValue) ? effectNumericValue : 1;
      effectRange.hasNumericSignal = effectRange.hasNumericSignal || Number.isFinite(effectNumericValue) || ['increment_variable', 'decrement_variable'].includes(effect.type || '');
      if (effect.type === 'increment_variable') {
        if (effectAmount >= 0) effectRange.positiveDelta += effectAmount;
        else effectRange.negativeDelta += effectAmount;
      }
      if (effect.type === 'decrement_variable') {
        if (effectAmount >= 0) effectRange.negativeDelta -= effectAmount;
        else effectRange.positiveDelta -= effectAmount;
      }
      if (effect.type === 'set_variable' && Number.isFinite(effectNumericValue)) {
        effectRange.minBase = Math.min(effectRange.minBase, effectNumericValue);
        effectRange.maxBase = Math.max(effectRange.maxBase, effectNumericValue);
      }
    });
  });
  return new Map([...ranges.entries()].map(([key, range]) => [key, {
    min: range.minBase + range.negativeDelta,
    max: range.maxBase + range.positiveDelta,
    hasNumericSignal: range.hasNumericSignal,
  }]));
};

const getConversationEntries = (project = {}) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((hotspot) => hotspot.actionType === 'conversation')
      .map((hotspot) => ({ scene, hotspot, conversation: hotspot.conversation || { nodes: [] } }))
  ))
);

const getConversationPaths = (project, entry) => {
  const nodes = entry.conversation?.nodes || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const startNodeId = entry.conversation?.startNodeId || nodes[0]?.id || '';
  const paths = [];
  const walk = (nodeId, trail, visited, depth) => {
    const node = nodeById.get(nodeId);
    if (!node || depth > 12) {
      paths.push({ trail, result: depth > 12 ? 'arret: boucle ou chemin trop long' : 'question manquante' });
      return;
    }
    const replies = node.replies || [];
    if (!replies.length) {
      paths.push({ trail: [...trail, `Question sans réponse: ${line(node.text).slice(0, 80)}`], result: 'impasse' });
      return;
    }
    replies.forEach((reply) => {
      const actionType = reply.actionType || (reply.nextNodeId ? 'node' : 'end');
      const effectTexts = getConversationEffectTexts(project, reply, entry.conversation);
      const step = `${reply.label || 'Réponse'} [${getConditionText(project, reply, entry.conversation)}]${effectTexts.length ? ` {effets: ${effectTexts.join('; ')}}` : ''}`;
      const effectNextNodeId = (reply.effects || []).find((effect) => (effect.type || '') === 'next_node' && effect.nextNodeId)?.nextNodeId;
      const nextNodeId = effectNextNodeId || reply.nextNodeId;
      if (['node', 'dialogue', 'multiple'].includes(actionType) && nextNodeId && !visited.has(nextNodeId)) {
        walk(nextNodeId, [...trail, step], new Set([...visited, nextNodeId]), depth + 1);
        return;
      }
      paths.push({ trail: [...trail, step], result: getTargetText(project, reply, entry.conversation) });
    });
  };
  if (startNodeId) walk(startNodeId, [], new Set([startNodeId]), 0);
  return paths;
};

const collectAuthorSummary = (project = {}) => {
  const conversations = getConversationEntries(project);
  const allReplies = conversations.flatMap((entry) => (
    (entry.conversation.nodes || []).flatMap((node) => (
      (node.replies || []).map((reply) => ({ ...entry, node, reply }))
    ))
  ));
  const requiredItemIds = new Set();
  const variableKeys = new Set((project.storyVariables || []).map((entry) => entry.key).filter(Boolean));
  allReplies.forEach(({ reply }) => {
    getReplyConditions(reply).forEach((condition) => {
      if (condition.type === 'has_item' && condition.itemId) requiredItemIds.add(condition.itemId);
      if (condition.type === 'story_variable' && condition.variableKey) variableKeys.add(condition.variableKey);
    });
    if (reply.storyVariableKey) variableKeys.add(reply.storyVariableKey);
    (Array.isArray(reply.effects) ? reply.effects : []).forEach((effect) => {
      if (['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '') && effect.variableKey) variableKeys.add(effect.variableKey);
      if (['add_item', 'remove_item'].includes(effect.type || '') && effect.itemId) requiredItemIds.add(effect.itemId);
    });
  });
  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      if (hotspot.requiredItemId) requiredItemIds.add(hotspot.requiredItemId);
      (hotspot.logicRules || []).forEach((rule) => {
        if (rule.conditionType === 'has_item' && rule.itemId) requiredItemIds.add(rule.itemId);
      });
    });
  });
  return { conversations, allReplies, requiredItemIds, variableKeys };
};

export function buildAuthorSummaryMarkdown(project = {}) {
  const { conversations, allReplies, requiredItemIds, variableKeys } = collectAuthorSummary(project);
  const variableRanges = getStoryVariableRanges(project, allReplies);
  const endings = getAllEndingEntries(allReplies);
  const hiddenReplies = allReplies.filter(({ reply }) => (reply.conditionType || 'none') !== 'none');
  const effectsCount = allReplies.reduce((count, { reply }) => count + (Array.isArray(reply.effects) ? reply.effects.length : 0), 0);
  const lines = [
    `# Fiche auteur - ${project.title || 'Projet escape game'}`,
    '',
    `Généré le ${new Date().toLocaleString('fr-FR')}.`,
    '',
    '## Vue globale',
    '',
    `- Scènes: ${(project.scenes || []).length}`,
    `- Conversations: ${conversations.length}`,
    `- Réponses de conversation: ${allReplies.length}`,
    `- Réponses conditionnelles: ${hiddenReplies.length}`,
    `- Effets multiples: ${effectsCount}`,
    `- Variables d'histoire: ${variableKeys.size}`,
    `- Fins: ${endings.length}`,
    `- Objets cites par conditions/effets: ${requiredItemIds.size}`,
    '',
    '## Variables d’histoire',
    '',
  ];

  if (variableKeys.size) {
    [...variableKeys].sort().forEach((key) => {
      const variable = (project.storyVariables || []).find((entry) => entry.key === key);
      const range = variableRanges.get(key);
      const rangeText = range?.hasNumericSignal ? ` | plage détectée : ${range.min} à ${range.max}` : '';
      lines.push(`- ${key} | type: ${variable?.type || 'non déclarée'} | départ: ${variable?.defaultValue ?? ''}${rangeText}${variable?.description ? ` | ${line(variable.description)}` : ''}`);
    });
  } else {
    lines.push('- Aucune variable détectée.');
  }

  lines.push('', '## Objets cites', '');
  if (requiredItemIds.size) {
    [...requiredItemIds].sort().forEach((itemId) => lines.push(`- ${getItemLabel(project, itemId)}`));
  } else {
    lines.push('- Aucun objet cite par condition ou effet.');
  }

  lines.push('', '## Fins', '');
  if (endings.length) {
    endings.forEach(({ scene, hotspot, node, reply, ending, source }, index) => {
      lines.push(`${index + 1}. ${ending.endingTitle || 'Fin sans titre'} (${ending.endingType || 'neutral'})`);
      lines.push(`   - Scène: ${scene.name || 'Scene'}`);
      lines.push(`   - Conversation: ${hotspot.name || 'Conversation'}`);
      lines.push(`   - Source: ${source}`);
      lines.push(`   - Question: ${line(node.text).slice(0, 120)}`);
      if (node.authorNote) lines.push(`   - Note question: ${line(node.authorNote)}`);
      lines.push(`   - Réponse: ${reply.label || 'Réponse'}`);
      if (reply.authorNote) lines.push(`   - Note réponse: ${line(reply.authorNote)}`);
      lines.push(`   - Condition: ${getConditionText(project, reply, hotspot.conversation)}`);
      lines.push(`   - Résumé: ${line(ending.endingSummary || ending.message || reply.dialogue || 'Aucun résumé')}`);
    });
  } else {
    lines.push('- Aucune fin configurée.');
  }

  lines.push('', '## Branches de conversation', '');
  if (conversations.length) {
    conversations.forEach((entry, index) => {
      lines.push(`### ${index + 1}. ${entry.scene.name || 'Scene'} / ${entry.hotspot.name || 'Conversation'}`);
      (entry.conversation.nodes || []).forEach((node, nodeIndex) => {
        lines.push('');
        lines.push(`Question ${nodeIndex + 1}: ${node.speaker || 'PNJ'} - ${line(node.text) || 'Sans texte'}`);
        if (node.authorNote) lines.push(`Note auteur question: ${line(node.authorNote)}`);
        if ((node.replies || []).length) {
          (node.replies || []).forEach((reply) => {
            const effect = getVariableEffectText(reply);
            const effectTexts = getConversationEffectTexts(project, reply, entry.conversation);
            lines.push(`- ${reply.label || 'Réponse'} -> ${getTargetText(project, reply, entry.conversation)}`);
            if (reply.authorNote) lines.push(`  - Note auteur: ${line(reply.authorNote)}`);
            lines.push(`  - Condition: ${getConditionText(project, reply, entry.conversation)}`);
            if (reply.dialogue) lines.push(`  - Message: ${line(reply.dialogue)}`);
            if (reply.rewardItemId) lines.push(`  - Objet donne: ${getItemLabel(project, reply.rewardItemId)}`);
            if (effect) lines.push(`  - Variable: ${effect}`);
            if (effectTexts.length) lines.push(`  - Effets multiples: ${effectTexts.join(' | ')}`);
            if ((reply.branchTags || []).length) lines.push(`  - Tags: ${(reply.branchTags || []).join(', ')}`);
            if (reply.responseImageName || reply.responseSoundName || reply.npcPortraitName || reply.ambienceSoundName) {
              lines.push(`  - Médias: ${[reply.responseImageName, reply.responseSoundName, reply.npcPortraitName, reply.ambienceSoundName].filter(Boolean).join(', ')}`);
            }
          });
        } else {
          lines.push('- Aucune réponse.');
        }
      });
    });
  } else {
    lines.push('- Aucune conversation.');
  }

  lines.push('', '## Chemins possibles detectes', '');
  if (conversations.length) {
    conversations.forEach((entry, index) => {
      lines.push(`### ${index + 1}. ${entry.scene.name || 'Scene'} / ${entry.hotspot.name || 'Conversation'}`);
      const paths = getConversationPaths(project, entry);
      if (paths.length) {
        paths.forEach((path, pathIndex) => {
          lines.push(`${pathIndex + 1}. ${path.trail.join(' -> ') || 'Départ'} => ${path.result}`);
        });
      } else {
        lines.push('- Aucun chemin détecté.');
      }
    });
  } else {
    lines.push('- Aucun chemin détecté.');
  }

  lines.push('', '## Transitions de scènes', '');
  (project.scenes || []).forEach((scene) => {
    const transitions = (scene.hotspots || []).filter((hotspot) => hotspot.targetSceneId || hotspot.secondTargetSceneId);
    if (!transitions.length) return;
    lines.push(`### ${scene.name || 'Scene'}`);
    transitions.forEach((hotspot) => {
      if (hotspot.targetSceneId) lines.push(`- ${hotspot.name || 'Zone'} -> ${getSceneLabel(project, hotspot.targetSceneId)}${hotspot.requiredItemId ? ` | requis: ${getItemLabel(project, hotspot.requiredItemId)}` : ''}`);
      if (hotspot.secondTargetSceneId) lines.push(`- ${hotspot.name || 'Zone'} (2e action) -> ${getSceneLabel(project, hotspot.secondTargetSceneId)}${hotspot.secondRequiredItemId ? ` | requis: ${getItemLabel(project, hotspot.secondRequiredItemId)}` : ''}`);
    });
  });

  return `${lines.join('\n')}\n`;
}

export function buildAuthorSummaryHtml(project = {}) {
  const { conversations, allReplies, requiredItemIds, variableKeys } = collectAuthorSummary(project);
  const variableRanges = getStoryVariableRanges(project, allReplies);
  const endings = getAllEndingEntries(allReplies);
  const hiddenReplies = allReplies.filter(({ reply }) => (reply.conditionType || 'none') !== 'none');
  const effectsCount = allReplies.reduce((count, { reply }) => count + (Array.isArray(reply.effects) ? reply.effects.length : 0), 0);
  const branchTags = [...new Set(allReplies.flatMap(({ reply }) => reply.branchTags || []))].sort();
  const generatedAt = new Date().toLocaleString('fr-FR');
  const statCards = [
    ['Scenes', (project.scenes || []).length],
    ['Conversations', conversations.length],
    ['Réponses', allReplies.length],
    ['Conditionnelles', hiddenReplies.length],
    ['Effets', effectsCount],
    ['Variables', variableKeys.size],
    ['Fins', endings.length],
    ['Objets cites', requiredItemIds.size],
  ];

  const variablesHtml = variableKeys.size ? [...variableKeys].sort().map((key) => {
    const variable = (project.storyVariables || []).find((entry) => entry.key === key);
    const range = variableRanges.get(key);
    return `<article class="card variable-card">
      <div><strong>${escapeHtml(key)}</strong><span>${escapeHtml(variable?.type || 'non déclarée')}</span></div>
      <p><b>Départ</b> ${escapeHtml(variable?.defaultValue ?? '')}</p>
      ${range?.hasNumericSignal ? `<p><b>Plage détectée</b> ${escapeHtml(range.min)} à ${escapeHtml(range.max)}</p>` : ''}
      ${variable?.description ? `<p>${escapeHtml(line(variable.description))}</p>` : ''}
    </article>`;
  }).join('') : '<p class="muted">Aucune variable détectée.</p>';

  const endingsHtml = endings.length ? endings.map(({ scene, hotspot, node, reply, ending, source }, index) => (
    `<article class="card ending-card ending-${escapeHtml(ending.endingType || 'neutral')}">
      <span class="index">${index + 1}</span>
      <div>
        <h3>${escapeHtml(ending.endingTitle || 'Fin sans titre')}</h3>
        <p><b>Type</b> ${escapeHtml(ending.endingType || 'neutral')}</p>
        <p><b>Source</b> ${escapeHtml(source)}</p>
        <p><b>Scène</b> ${escapeHtml(scene.name || 'Scene')} / ${escapeHtml(hotspot.name || 'Conversation')}</p>
        <p><b>Question</b> ${escapeHtml(line(node.text).slice(0, 140))}</p>
        ${node.authorNote ? `<p class="author-note"><b>Note question</b> ${escapeHtml(line(node.authorNote))}</p>` : ''}
        <p><b>Réponse</b> ${escapeHtml(reply.label || 'Réponse')}</p>
        ${reply.authorNote ? `<p class="author-note"><b>Note réponse</b> ${escapeHtml(line(reply.authorNote))}</p>` : ''}
        <p><b>Condition</b> ${escapeHtml(getConditionText(project, reply, hotspot.conversation))}</p>
        ${(reply.branchTags || []).length ? `<p><b>Tags</b> ${escapeHtml((reply.branchTags || []).join(', '))}</p>` : ''}
        <p><b>Resume</b> ${escapeHtml(line(ending.endingSummary || ending.message || reply.dialogue || 'Aucun résumé'))}</p>
      </div>
    </article>`
  )).join('') : '<p class="muted">Aucune fin configurée.</p>';

  const conversationsHtml = conversations.length ? conversations.map((entry, conversationIndex) => {
    const nodesHtml = (entry.conversation.nodes || []).map((node, nodeIndex) => {
      const repliesHtml = (node.replies || []).length ? (node.replies || []).map((reply) => {
        const effect = getVariableEffectText(reply);
        const effectTexts = getConversationEffectTexts(project, reply, entry.conversation);
        const medias = [reply.responseImageName, reply.responseSoundName, reply.npcPortraitName, reply.ambienceSoundName].filter(Boolean);
        const tags = reply.branchTags || [];
        return `<article class="reply" data-tags="${escapeHtml(tags.join(' '))}">
          <h4>${escapeHtml(reply.label || 'Réponse')}</h4>
          ${tags.length ? `<div class="tag-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          ${reply.authorNote ? `<p class="author-note"><b>Note auteur</b> ${escapeHtml(line(reply.authorNote))}</p>` : ''}
          <p><b>Suite</b> ${escapeHtml(getTargetText(project, reply, entry.conversation))}</p>
          <p><b>Condition</b> ${escapeHtml(getConditionText(project, reply, entry.conversation))}</p>
          ${reply.dialogue ? `<p><b>Message</b> ${escapeHtml(line(reply.dialogue))}</p>` : ''}
          ${reply.rewardItemId ? `<p><b>Objet donne</b> ${escapeHtml(getItemLabel(project, reply.rewardItemId))}</p>` : ''}
          ${effect ? `<p><b>Variable</b> ${escapeHtml(effect)}</p>` : ''}
          ${effectTexts.length ? `<div class="effect-list"><b>Effets multiples</b>${effectTexts.map((entry) => `<span>${escapeHtml(entry)}</span>`).join('')}</div>` : ''}
          ${medias.length ? `<p><b>Médias</b> ${escapeHtml(medias.join(', '))}</p>` : ''}
        </article>`;
      }).join('') : '<p class="muted">Aucune réponse.</p>';
      return `<section class="question">
        <div class="question-head">
          <span>Question ${nodeIndex + 1}</span>
          <strong>${escapeHtml(node.speaker || 'PNJ')}</strong>
        </div>
        <p class="question-text">${escapeHtml(line(node.text) || 'Sans texte')}</p>
        ${node.authorNote ? `<p class="author-note"><b>Note auteur question</b> ${escapeHtml(line(node.authorNote))}</p>` : ''}
        <div class="reply-grid">${repliesHtml}</div>
      </section>`;
    }).join('');
    return `<section class="section-block">
      <h2>${conversationIndex + 1}. ${escapeHtml(entry.scene.name || 'Scene')} / ${escapeHtml(entry.hotspot.name || 'Conversation')}</h2>
      ${nodesHtml}
    </section>`;
  }).join('') : '<p class="muted">Aucune conversation.</p>';

  const pathsHtml = conversations.length ? conversations.map((entry, index) => {
    const paths = getConversationPaths(project, entry);
    const pathItems = paths.map((path) => `<span class="path-trail">${escapeHtml(path.trail.join(' -> ') || 'Départ')}</span><span class="path-result">${escapeHtml(path.result)}</span>`);
    return `<section class="section-block compact">
      <h2>${index + 1}. ${escapeHtml(entry.scene.name || 'Scene')} / ${escapeHtml(entry.hotspot.name || 'Conversation')}</h2>
      ${htmlList(pathItems, 'Aucun chemin détecté.')}
    </section>`;
  }).join('') : '<p class="muted">Aucun chemin détecté.</p>';

  const transitionGroups = (project.scenes || []).map((scene) => {
    const transitions = (scene.hotspots || []).filter((hotspot) => hotspot.targetSceneId || hotspot.secondTargetSceneId);
    if (!transitions.length) return '';
    const items = transitions.flatMap((hotspot) => [
      hotspot.targetSceneId ? `${escapeHtml(hotspot.name || 'Zone')} -> ${escapeHtml(getSceneLabel(project, hotspot.targetSceneId))}${hotspot.requiredItemId ? ` <em>requis: ${escapeHtml(getItemLabel(project, hotspot.requiredItemId))}</em>` : ''}` : '',
      hotspot.secondTargetSceneId ? `${escapeHtml(hotspot.name || 'Zone')} (2e action) -> ${escapeHtml(getSceneLabel(project, hotspot.secondTargetSceneId))}${hotspot.secondRequiredItemId ? ` <em>requis: ${escapeHtml(getItemLabel(project, hotspot.secondRequiredItemId))}</em>` : ''}` : '',
    ].filter(Boolean));
    return `<section class="section-block compact"><h2>${escapeHtml(scene.name || 'Scene')}</h2>${htmlList(items)}</section>`;
  }).filter(Boolean).join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fiche auteur - ${escapeHtml(project.title || 'Projet escape game')}</title>
  <style>
    :root{color-scheme:light;--ink:#172033;--muted:#657083;--line:#d9e1ec;--soft:#f4f7fb;--blue:#2563eb;--green:#138a55;--red:#c2413b;--violet:#7c3aed;--amber:#b7791f}
    *{box-sizing:border-box} body{margin:0;background:#eef3f8;color:var(--ink);font:14px/1.55 Inter,Segoe UI,Arial,sans-serif}
    .page{max-width:1120px;margin:0 auto;padding:28px}.hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:28px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 20px 50px #17203314}
    h1{margin:0;font-size:34px;line-height:1.05}.subtitle{margin:10px 0 0;color:var(--muted)}.actions{display:flex;gap:8px;flex-wrap:wrap}.print{border:0;border-radius:10px;background:var(--blue);color:#fff;padding:10px 14px;font-weight:800;cursor:pointer}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin:18px 0}.stat{padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff}.stat strong{display:block;font-size:24px}.stat span{color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}
    .section-block{margin:18px 0;padding:20px;border:1px solid var(--line);border-radius:16px;background:#fff}.section-block.compact{padding:16px}h2{margin:0 0 14px;font-size:20px}h3,h4{margin:0 0 8px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{position:relative;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}.card p,.reply p{margin:4px 0}.card span{color:var(--muted)}.variable-card div{display:flex;justify-content:space-between;gap:10px}
    .ending-card{display:grid;grid-template-columns:auto 1fr;gap:12px;border-left:5px solid var(--violet)}.ending-good{border-left-color:var(--green)}.ending-bad{border-left-color:var(--red)}.ending-secret{border-left-color:var(--violet)}.ending-neutral{border-left-color:var(--amber)}.index{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#172033;color:#fff;font-weight:900}
    .question{break-inside:avoid;margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fbfdff}.question-head{display:flex;justify-content:space-between;color:var(--muted);font-weight:900;text-transform:uppercase;font-size:12px}.question-text{margin:8px 0 12px;font-size:15px}.reply-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.reply{padding:12px;border:1px solid #dbe7f5;border-radius:12px;background:#fff}
    .tag-filter,.tag-list{display:flex;flex-wrap:wrap;gap:6px}.tag-filter{margin:18px 0}.tag-filter button,.tag-list span{border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1d4ed8;padding:5px 9px;font-size:12px;font-weight:800}.tag-filter button{cursor:pointer}.tag-filter button.active{background:#2563eb;color:#fff;border-color:#2563eb}.reply.is-hidden{display:none}
    .effect-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.effect-list b{width:100%;font-size:12px;text-transform:uppercase;color:var(--muted)}.effect-list span{border:1px solid #c7d2fe;border-radius:999px;background:#eef2ff;color:#3730a3;padding:5px 8px;font-size:12px;font-weight:800}
    .author-note{padding:8px 10px;border-left:3px solid #8b5cf6;border-radius:8px;background:#f5f3ff;color:#4c1d95}
    ul{margin:0;padding-left:20px}li{margin:7px 0}.muted{color:var(--muted)}.path-trail{display:block;font-weight:800}.path-result{display:block;color:var(--muted)}em{color:var(--blue);font-style:normal;font-weight:800}
    @média(max-width:900px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.grid,.reply-grid{grid-template-columns:1fr}.hero{display:block}.actions{margin-top:14px}}
    @média print{body{background:#fff}.page{max-width:none;padding:0}.hero,.section-block,.stat,.card,.question,.reply{box-shadow:none;break-inside:avoid}.actions{display:none}.stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div>
        <h1>${escapeHtml(project.title || 'Projet escape game')}</h1>
        <p class="subtitle">Fiche auteur générée le ${escapeHtml(generatedAt)}. Document de debug, relecture et impression.</p>
      </div>
      <div class="actions"><button class="print" type="button" onclick="window.print()">Imprimer / PDF</button></div>
    </header>
    ${branchTags.length ? `<nav class="tag-filter" aria-label="Filtrer par tag"><button type="button" class="active" data-tag-filter="">Tous</button>${branchTags.map((tag) => `<button type="button" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</nav>` : ''}
    <section class="stats">${statCards.map(([label, value]) => `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</section>
    <section class="section-block"><h2>Variables d'histoire</h2><div class="grid">${variablesHtml}</div></section>
    <section class="section-block"><h2>Objets cites</h2>${htmlList([...requiredItemIds].sort().map((itemId) => escapeHtml(getItemLabel(project, itemId))), 'Aucun objet cite par condition ou effet.')}</section>
    <section class="section-block"><h2>Fins</h2><div class="grid">${endingsHtml}</div></section>
    <section class="section-block"><h2>Branches de conversation</h2>${conversationsHtml}</section>
    <section class="section-block"><h2>Chemins possibles detectes</h2>${pathsHtml}</section>
    <section class="section-block"><h2>Transitions de scènes</h2>${transitionGroups || '<p class="muted">Aucune transition de scène détectée.</p>'}</section>
  </main>
  <script>
    document.querySelectorAll('[data-tag-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const tag = button.dataset.tagFilter || '';
        document.querySelectorAll('[data-tag-filter]').forEach((entry) => entry.classList.toggle('active', entry === button));
        document.querySelectorAll('.reply[data-tags]').forEach((reply) => {
          reply.classList.toggle('is-hidden', Boolean(tag) && !String(reply.dataset.tags || '').split(' ').includes(tag));
        });
      });
    });
  </script>
</body>
</html>`;
}

export function exportAuthorSummary(project = {}) {
  const html = buildAuthorSummaryHtml(project);
  const filename = `${slugify(project.title || 'scénario')}-fiche-auteur.html`;
  downloadBlob(filename, new Blob([html], { type: 'text/html;charset=utf-8' }));
}
