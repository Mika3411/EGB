import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Brain, CheckCircle2, Clapperboard, DoorOpen, ExternalLink, EyeOff, Gamepad2, Link, Lock, MapPin, Maximize2, Minimize2, MousePointerClick, Pencil, Play, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { applyProjectStartType } from '../lib/cinematicEngine';
import { getSceneActionSources } from '../lib/projectTransitions';
import { showAlert, showConfirm } from './AccessibleDialog';
import planBuildPreviewUrl from '../assets/route-construction-preview.svg';
import planTestPreviewUrl from '../assets/route-test-preview.png';
import routePlayerCharacterUrl from '../assets/route-player-character.png';
import {
  DEFAULT_ROUTE_CANVAS_ID,
  FIELD_HELP,
  ROUTE_CANVAS_ROOM_LIMIT,
  clamp,
  getConnectionNarrativeBadges,
  getDefaultMap,
  getNarrativePlan,
  getRouteMapForAct,
  getRouteSceneTransitions,
  makeId,
  roomLabel,
  sameStringArray,
} from './routeMapHelpers.js';

const getSceneMechanics = (project, sceneId) => {
  const scene = (project.scenes || []).find((entry) => entry.id === sceneId);
  if (!scene) return { enigma: false, cinematic: false, logic: false };
  return getSceneActionSources(scene).reduce((flags, hotspot) => {
    const actions = [
      hotspot,
      hotspot.hasSecondAction ? {
        actionType: hotspot.secondActionType,
        targetCinematicId: hotspot.secondTargetCinematicId,
        enigmaId: hotspot.secondEnigmaId,
      } : null,
      ...(hotspot.logicRules || []),
    ].filter(Boolean);

    actions.forEach((action) => {
      if (action.enigmaId) flags.enigma = true;
      if (action.actionType === 'cinematic' || action.targetCinematicId) flags.cinematic = true;
    });
    if ((hotspot.logicRules || []).length) flags.logic = true;
    return flags;
  }, { enigma: false, cinematic: false, logic: false });
};

const getRoomMechanics = (project, room) => (
  room?.sceneId ? getSceneMechanics(project, room.sceneId) : { enigma: false, cinematic: false, logic: false }
);

const scenePairKey = (sceneA = '', sceneB = '') => [sceneA, sceneB].sort().join('<>');

const pushUnique = (messages, message) => {
  if (!messages.includes(message)) messages.push(message);
};

const getConnectionActionStatus = (project, rooms, connection, getSceneLabel) => {
  const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
  const toRoom = rooms.find((room) => room.id === connection.toRoomId);
  if (!fromRoom || !toRoom) return null;
  if (!fromRoom.sceneId || !toRoom.sceneId) {
    return {
      connectionId: connection.id,
      status: 'neutral',
      message: 'Lie les deux pièces à des scènes pour vérifier les zones d’action.',
    };
  }

  const transitions = getRouteSceneTransitions(project);
  const forwardExists = transitions.some((transition) => (
    transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId
  ));
  const reverseExists = transitions.some((transition) => (
    transition.fromSceneId === toRoom.sceneId && transition.toSceneId === fromRoom.sceneId
  ));
  const fromLabel = roomLabel(fromRoom, project, getSceneLabel);
  const toLabel = roomLabel(toRoom, project, getSceneLabel);

  if (forwardExists && reverseExists) {
    return {
      connectionId: connection.id,
      status: 'ok',
      message: `${fromLabel} ↔ ${toLabel}: zones d’action dans les deux sens.`,
    };
  }

  if (forwardExists || reverseExists) {
    return {
      connectionId: connection.id,
      status: 'partial',
      message: forwardExists
        ? `${fromLabel} → ${toLabel} existe, mais il manque ${toLabel} → ${fromLabel}.`
        : `${toLabel} → ${fromLabel} existe, mais il manque ${fromLabel} → ${toLabel}.`,
    };
  }

  return {
    connectionId: connection.id,
    status: 'missing',
    message: `${fromLabel} ↔ ${toLabel}: aucune zone d’action ne relié ces deux pièces.`,
  };
};

const buildDiagnostics = (project, routeMap, getSceneLabel) => {
  const rooms = routeMap.rooms || [];
  const roomIds = new Set(rooms.map((room) => room.id));
  const connections = (routeMap.connections || []).filter((connection) => (
    roomIds.has(connection.fromRoomId) && roomIds.has(connection.toRoomId)
  ));
  const problems = [];
  const warnings = [];
  const connectionChecks = connections
    .map((connection) => getConnectionActionStatus(project, rooms, connection, getSceneLabel))
    .filter(Boolean);

  if (!rooms.length) problems.push('Aucune pièce créée dans le plan.');

  const starts = rooms.filter((room) => room.type === 'start');
  const ends = rooms.filter((room) => room.type === 'end');
  if (starts.length !== 1) problems.push(starts.length ? 'Le plan doit avoir un seul départ.' : 'Ajoute une pièce de départ.');
  if (ends.length !== 1) warnings.push(ends.length ? 'Le plan a plusieurs arrivées.' : 'Ajoute une arrivée si le parcours à une fin prévue.');

  rooms.forEach((room) => {
    const degree = connections.filter((connection) => (
      connection.fromRoomId === room.id || connection.toRoomId === room.id
    )).length;
    if (!degree && rooms.length > 1) problems.push(`${roomLabel(room, project, getSceneLabel)} n’est reliée à aucune autre pièce.`);
  });

  if (starts.length === 1) {
    const visited = new Set([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const currentId = queue.shift();
      connections.forEach((connection) => {
        const nextRoomId = connection.fromRoomId === currentId ? connection.toRoomId : connection.toRoomId === currentId ? connection.fromRoomId : '';
        if (!nextRoomId || visited.has(nextRoomId)) return;
        visited.add(nextRoomId);
        queue.push(nextRoomId);
      });
    }
    rooms.forEach((room) => {
      if (!visited.has(room.id)) problems.push(`${roomLabel(room, project, getSceneLabel)} est inaccessible dépuis le départ.`);
    });
  }

  const roomsByScene = new Map(rooms.filter((room) => room.sceneId).map((room) => [room.sceneId, room]));
  const mapScenePairs = new Set(connections.map((connection) => {
    const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
    const toRoom = rooms.find((room) => room.id === connection.toRoomId);
    if (!fromRoom?.sceneId || !toRoom?.sceneId) return '';
    return scenePairKey(fromRoom.sceneId, toRoom.sceneId);
  }).filter(Boolean));
  const sceneTransitions = getRouteSceneTransitions(project);

  sceneTransitions.forEach((transition) => {
    if (!roomsByScene.has(transition.fromSceneId) || !roomsByScene.has(transition.toSceneId)) return;
    if (!mapScenePairs.has(scenePairKey(transition.fromSceneId, transition.toSceneId))) {
      pushUnique(warnings, `Une transition du jeu relié ${getSceneLabel(transition.fromSceneId)} et ${getSceneLabel(transition.toSceneId)}, mais cette liaison manque sur le plan.`);
    }
  });

  connectionChecks.forEach((check) => {
    const connection = connections.find((entry) => entry.id === check.connectionId);
    if (check.status === 'missing') pushUnique(problems, check.message);
    if (check.status === 'partial' && !connection?.allowOneWay) pushUnique(warnings, check.message);
  });

  return {
    problems,
    warnings,
    connectionChecks,
    ok: problems.length === 0,
  };
};

const getTransitionLabel = (transitions, fromSceneId, toSceneId) => (
  transitions.find((transition) => (
    transition.fromSceneId === fromSceneId && transition.toSceneId === toSceneId
  ))?.label || ''
);

const getTransitionBetweenScenes = (transitions, fromSceneId, toSceneId) => (
  transitions.find((transition) => (
    transition.fromSceneId === fromSceneId && transition.toSceneId === toSceneId
  )) || null
);

const findScenePath = (project, fromSceneId, toSceneId, context = null) => {
  if (!fromSceneId || !toSceneId) return null;
  if (fromSceneId === toSceneId) return [];
  const transitions = getRouteSceneTransitions(project);
  const visited = new Set([fromSceneId]);
  const queue = [{ sceneId: fromSceneId, path: [] }];

  while (queue.length) {
    const current = queue.shift();
    const nextTransitions = transitions.filter((transition) => transition.fromSceneId === current.sceneId);
    for (const transition of nextTransitions) {
      if (context && getTransitionConditionStatus(transition, context, project).blocked) continue;
      if (visited.has(transition.toSceneId)) continue;
      const nextPath = [...current.path, transition];
      if (transition.toSceneId === toSceneId) return nextPath;
      visited.add(transition.toSceneId);
      queue.push({ sceneId: transition.toSceneId, path: nextPath });
    }
  }

  return null;
};

const normalizeSearchText = (value = '') => (
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const getSceneRewardItemIds = (project, sceneId) => {
  const scene = (project.scenes || []).find((entry) => entry.id === sceneId);
  if (!scene) return [];
  return (scene.sceneObjects || []).map((object) => object.linkedItemId).filter(Boolean);
};

const getRoomRewardItemIds = (project, room) => (
  room?.sceneId ? getSceneRewardItemIds(project, room.sceneId) : []
);

const resolveCombinationItems = (project, context) => {
  let changed = true;
  while (changed) {
    changed = false;
    (project.combinations || []).forEach((combination) => {
      if (!combination.itemAId || !combination.itemBId || !combination.resultItemId) return;
      if (!context.itemIds.has(combination.itemAId) || !context.itemIds.has(combination.itemBId)) return;
      if (!context.itemIds.has(combination.resultItemId)) {
        context.itemIds.add(combination.resultItemId);
        changed = true;
      }
      if (combination.id && !context.completedCombinationIds.has(combination.id)) {
        context.completedCombinationIds.add(combination.id);
        changed = true;
      }
    });
  }
};

const getRequiredItemForConnection = (project, connection) => {
  const conditionText = normalizeSearchText(`${connection.condition || ''} ${connection.label || ''}`);
  if (!conditionText.trim()) return null;
  const conditionWords = conditionText.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  return (project.items || []).find((item) => (
    item?.name && (
      conditionText.includes(normalizeSearchText(item.name))
      || conditionWords.some((word) => normalizeSearchText(item.name).includes(word))
    )
  )) || null;
};

const getRequiredRoomForConnection = (project, rooms, connection, fromRoom, toRoom, getSceneLabel) => {
  const conditionText = normalizeSearchText(`${connection.condition || ''} ${connection.label || ''}`);
  if (!conditionText.trim()) return null;

  return (rooms || []).find((room) => {
    if (!room?.id || room.id === fromRoom?.id || room.id === toRoom?.id) return false;
    const labels = [
      room.name,
      room.sceneId ? getSceneLabel(room.sceneId) : '',
      room.sceneId ? (project.scenes || []).find((scene) => scene.id === room.sceneId)?.name : '',
    ].map(normalizeSearchText).filter((label) => label.length >= 3);
    return labels.some((label) => conditionText.includes(label));
  }) || null;
};

const isLogicRuleMet = (rule = {}, context = {}) => {
  const conditionType = rule.conditionType || 'has_item';
  if (conditionType === 'always') return true;
  if (conditionType === 'has_item') return Boolean(rule.itemId && context.itemIds?.has(rule.itemId));
  if (conditionType === 'missing_item') return Boolean(rule.itemId && !context.itemIds?.has(rule.itemId));
  if (conditionType === 'completed_hotspot') return Boolean(rule.hotspotId && context.completedHotspotIds?.has(rule.hotspotId));
  if (conditionType === 'launched_cinematic') {
    return rule.cinematicId
      ? Boolean(context.launchedCinematicIds?.has(rule.cinematicId))
      : Boolean(context.launchedCinematicIds?.size);
  }
  if (conditionType === 'solved_enigma') return Boolean(rule.conditionEnigmaId && context.solvedEnigmaIds?.has(rule.conditionEnigmaId));
  if (conditionType === 'completed_combination') return Boolean(rule.combinationId && context.completedCombinationIds?.has(rule.combinationId));
  return false;
};

const getTransitionConditionStatus = (transition = {}, context = {}, project = {}) => {
  const interceptRule = (transition.interceptRules || []).find((rule) => isLogicRuleMet(rule, context));
  if (interceptRule) {
    const item = (project.items || []).find((entry) => entry.id === interceptRule.itemId);
    return {
      blocked: true,
      reason: interceptRule.conditionType === 'missing_item' && item
        ? `Objet requis avant: ${item.name}`
        : interceptRule.dialogue || 'Une règle bloqué cette sortie',
    };
  }
  const conditionType = transition.conditionType || '';
  if (transition.requiredHotspotId && !context.completedHotspotIds?.has(transition.requiredHotspotId)) {
    return { blocked: true, reason: 'Action requise avant: hotspot non franchi' };
  }
  if (!conditionType || conditionType === 'always') return { blocked: false, reason: '' };
  if (conditionType === 'has_item') {
    const itemId = transition.conditionItemId || transition.requiredItemId || '';
    const item = (project.items || []).find((entry) => entry.id === itemId);
    return itemId && context.itemIds?.has(itemId)
      ? { blocked: false, reason: '' }
      : { blocked: true, reason: `Objet requis: ${item?.name || 'objet requis'}` };
  }
  if (conditionType === 'missing_item') {
    const itemId = transition.conditionItemId || transition.requiredItemId || '';
    return itemId && context.itemIds?.has(itemId)
      ? { blocked: true, reason: 'Condition: objet absent requis' }
      : { blocked: false, reason: '' };
  }
  if (conditionType === 'completed_hotspot') {
    return context.completedHotspotIds?.has(transition.conditionHotspotId)
      ? { blocked: false, reason: '' }
      : { blocked: true, reason: 'Action requise avant: hotspot non franchi' };
  }
  if (conditionType === 'launched_cinematic') {
    return context.launchedCinematicIds?.has(transition.conditionCinematicId)
      ? { blocked: false, reason: '' }
      : { blocked: true, reason: 'Cinématique requise avant' };
  }
  if (conditionType === 'solved_enigma') {
    return context.solvedEnigmaIds?.has(transition.conditionEnigmaId)
      ? { blocked: false, reason: '' }
      : { blocked: true, reason: 'Énigme requise avant' };
  }
  if (conditionType === 'completed_combination') {
    return context.completedCombinationIds?.has(transition.conditionCombinationId)
      ? { blocked: false, reason: '' }
      : { blocked: true, reason: 'Combinaison requise avant' };
  }
  return { blocked: true, reason: 'Condition non résolue' };
};

const getRoomCompletionIssues = (project, room, context = {}) => {
  const scene = (project.scenes || []).find((entry) => entry.id === room?.sceneId);
  if (!scene) return [];
  return getSceneActionSources(scene).flatMap((hotspot) => {
    const hasActionRule = (hotspot.logicRules || []).some((rule) => ['scene', 'cinematic', 'dialogue_item', 'block'].includes(rule.actionType));
    if (!['scene', 'cinematic', 'dialogue_item', 'block'].includes(hotspot.actionType) && !hasActionRule) return [];
    if (context.completedHotspotIds?.has(hotspot.id)) return [];
    const item = hotspot.requiredItemId
      ? (project.items || []).find((entry) => entry.id === hotspot.requiredItemId)
      : null;
    if (hotspot.requiredItemId && !context.itemIds?.has(hotspot.requiredItemId)) {
      return [`${hotspot.name || 'Action'}: objet requis ${item?.name || 'objet requis'}`];
    }
    if (hotspot.requiredHotspotId && !context.completedHotspotIds?.has(hotspot.requiredHotspotId)) {
      return [`${hotspot.name || 'Action'}: action précédente requise`];
    }
    const blockingRule = (hotspot.logicRules || []).find((rule) => (
      rule.actionType === 'dialogue' && isLogicRuleMet(rule, context)
    ));
    return blockingRule ? [blockingRule.dialogue || `${hotspot.name || 'Action'}: condition non résolue`] : [];
  });
};

const markTransitionAsPlayed = (context, transition = {}) => {
  if (transition.hotspotId) context.completedHotspotIds.add(transition.hotspotId);
  if (transition.targetCinematicId) context.launchedCinematicIds.add(transition.targetCinematicId);
  if (transition.conditionCinematicId && transition.actionType === 'cinematic') {
    context.launchedCinematicIds.add(transition.conditionCinematicId);
  }
  if (transition.enigmaId) context.solvedEnigmaIds.add(transition.enigmaId);
  if (transition.rewardItemId) context.itemIds.add(transition.rewardItemId);
  if (transition.targetBlockId) context.completedHotspotIds.add(transition.targetBlockId);
};

const markRoomAsExplored = (context, project, room) => {
  const scene = (project.scenes || []).find((entry) => entry.id === room?.sceneId);
  if (!scene) return;
  getSceneRewardItemIds(project, scene.id).forEach((itemId) => context.itemIds.add(itemId));
  resolveCombinationItems(project, context);
  const applyInteractionEffects = (interaction = {}) => {
    let changed = false;
    if (interaction.actionType === 'cinematic' && interaction.targetCinematicId) {
      changed = !context.launchedCinematicIds.has(interaction.targetCinematicId) || changed;
      context.launchedCinematicIds.add(interaction.targetCinematicId);
    }
    if (interaction.enigmaId) {
      changed = !context.solvedEnigmaIds.has(interaction.enigmaId) || changed;
      context.solvedEnigmaIds.add(interaction.enigmaId);
    }
    if (interaction.rewardItemId) {
      changed = !context.itemIds.has(interaction.rewardItemId) || changed;
      context.itemIds.add(interaction.rewardItemId);
    }
    if (interaction.targetBlockId) {
      changed = !context.completedHotspotIds.has(interaction.targetBlockId) || changed;
      context.completedHotspotIds.add(interaction.targetBlockId);
    }
    resolveCombinationItems(project, context);
    return changed;
  };
  const isProgressAction = (actionType = '') => ['scene', 'cinematic', 'dialogue_item', 'block'].includes(actionType);
  let changed = true;
  while (changed) {
    changed = false;
    getSceneActionSources(scene).forEach((hotspot) => {
      if (hotspot.requiredItemId && !context.itemIds.has(hotspot.requiredItemId)) return;
      if (hotspot.requiredHotspotId && !context.completedHotspotIds.has(hotspot.requiredHotspotId)) return;
      const wasCompleted = context.completedHotspotIds.has(hotspot.id);
      let progressed = false;
      if (isProgressAction(hotspot.actionType)) {
        progressed = applyInteractionEffects(hotspot) || !wasCompleted;
      }
      (hotspot.logicRules || []).forEach((rule) => {
        if (!rule.actionType || !isLogicRuleMet(rule, context)) return;
        if (rule.actionType === 'default') {
          progressed = applyInteractionEffects({
            ...hotspot,
            rewardItemId: rule.rewardItemId || hotspot.rewardItemId,
          }) || (!wasCompleted && isProgressAction(hotspot.actionType)) || progressed;
          return;
        }
        if (!isProgressAction(rule.actionType)) return;
        progressed = applyInteractionEffects(rule) || !wasCompleted || progressed;
      });
      if (progressed && !context.completedHotspotIds.has(hotspot.id)) {
        context.completedHotspotIds.add(hotspot.id);
        changed = true;
      }
    });
  }
};

const buildGameplayContext = (project, rooms, transitions, playerPath, playerItemIds) => {
  const context = {
    itemIds: new Set(playerItemIds || []),
    completedHotspotIds: new Set(),
    launchedCinematicIds: new Set(),
    solvedEnigmaIds: new Set(),
    completedCombinationIds: new Set(),
  };
  resolveCombinationItems(project, context);

  (playerPath || []).forEach((roomId, index) => {
    const room = rooms.find((entry) => entry.id === roomId);
    markRoomAsExplored(context, project, room);
    const nextRoomId = playerPath[index + 1];
    if (!nextRoomId) return;
    const fromRoom = room;
    const toRoom = rooms.find((room) => room.id === nextRoomId);
    const directTransitions = fromRoom?.sceneId && toRoom?.sceneId
      ? transitions.filter((transition) => transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId)
      : [];
    const transition = directTransitions.find((candidate) => !getTransitionConditionStatus(candidate, context, project).blocked)
      || directTransitions[0];
    markTransitionAsPlayed(context, transition);
  });

  return context;
};

const buildGameplayState = (project, routeMap, currentRoomId, playerPath, playerItemIds, getSceneLabel) => {
  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const transitions = getRouteSceneTransitions(project);
  const startRoom = rooms.find((room) => room.type === 'start') || rooms[0] || null;
  const activeRoom = rooms.find((room) => room.id === currentRoomId) || startRoom;
  const visitedRoomIds = new Set((playerPath || []).filter(Boolean));
  if (activeRoom?.id) visitedRoomIds.add(activeRoom.id);
  const gameplayContext = buildGameplayContext(project, rooms, transitions, playerPath, playerItemIds);

  const getMoveForConnection = (connection, fromRoomId) => {
    const fromRoom = rooms.find((room) => room.id === fromRoomId);
    const toRoomId = connection.fromRoomId === fromRoomId
      ? connection.toRoomId
      : connection.toRoomId === fromRoomId
        ? connection.fromRoomId
        : '';
    const toRoom = rooms.find((room) => room.id === toRoomId);
    if (!fromRoom || !toRoom) return null;
    const directTransitions = fromRoom.sceneId && toRoom.sceneId
      ? transitions.filter((transition) => transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId)
      : [];
    const fallbackEndTransitions = !directTransitions.length && toRoom.type === 'end' && toRoom.sceneId
      ? transitions.filter((transition) => transition.toSceneId === toRoom.sceneId)
      : [];
    const candidateTransitions = directTransitions.length ? directTransitions : fallbackEndTransitions;
    const directTransition = candidateTransitions.find((transition) => !getTransitionConditionStatus(transition, gameplayContext, project).blocked)
      || candidateTransitions[0]
      || directTransitions[0]
      || null;
    const directTransitionCondition = directTransition
      ? getTransitionConditionStatus(directTransition, gameplayContext, project)
      : { blocked: false, reason: '' };
    const directLabel = directTransition?.label || '';
    const indirectPath = !directLabel && fromRoom.sceneId && toRoom.sceneId
      ? findScenePath(project, fromRoom.sceneId, toRoom.sceneId, gameplayContext)
      : null;
    const hasTransition = Boolean(directLabel || indirectPath?.length);
    const indirectLabel = indirectPath?.length
      ? `Chemin indirect via ${indirectPath.map((transition) => transition.label).filter(Boolean).slice(0, 2).join(' + ') || 'actions du jeu'}`
      : '';
    const isLocked = Boolean(connection.locked);
    const missingScene = !fromRoom.sceneId || !toRoom.sceneId;
    const transitionRequiredItemId = directTransition?.requiredItemId
      || indirectPath?.find((transition) => transition.requiredItemId)?.requiredItemId
      || '';
    const transitionRequiredItem = transitionRequiredItemId
      ? (project.items || []).find((item) => item.id === transitionRequiredItemId)
      : null;
    const requiredItem = getRequiredItemForConnection(project, connection) || transitionRequiredItem;
    const requiredRoom = getRequiredRoomForConnection(project, rooms, connection, fromRoom, toRoom, getSceneLabel);
    const hasCondition = Boolean(isLocked || String(connection.condition || '').trim() || transitionRequiredItemId);
    const missingDirectedAction = Boolean(!missingScene && !directTransition);
    const blockedByTransitionCondition = Boolean(directTransitionCondition.blocked);
    const needsMissingItem = Boolean(hasCondition && requiredItem && !gameplayContext.itemIds.has(requiredItem.id));
    const needsRequiredRoom = Boolean(hasCondition && requiredRoom && !visitedRoomIds.has(requiredRoom.id));
    const needsManualCondition = Boolean(hasCondition && !requiredItem && !requiredRoom);
    const reason = missingDirectedAction
      ? `Aucune action depuis ${getSceneLabel(fromRoom.sceneId)} vers ${getSceneLabel(toRoom.sceneId)}`
      : blockedByTransitionCondition
        ? directTransitionCondition.reason
        : needsMissingItem
          ? `Objet requis: ${requiredItem.name}`
          : needsRequiredRoom
              ? `Pièce requise avant: ${roomLabel(requiredRoom, project, getSceneLabel)}`
              : needsManualCondition
                ? (connection.condition || 'Condition non résolue')
                : '';
    const mapOnlyLabel = !hasTransition
      ? `Liaison plan - action ${getSceneLabel(fromRoom.sceneId)} -> ${getSceneLabel(toRoom.sceneId)} non détectée`
      : '';
    return {
      connection,
      fromRoom,
      toRoom,
      label: directLabel || indirectLabel || connection.label || connection.condition || mapOnlyLabel || 'Liaison',
      condition: connection.condition || '',
      requiredItem,
      requiredRoom,
      indirect: Boolean(indirectPath?.length && !directLabel),
      mapOnly: !hasTransition && !missingScene,
      locked: isLocked,
      blocked: missingDirectedAction || blockedByTransitionCondition || needsMissingItem || needsRequiredRoom || needsManualCondition,
      reason,
    };
  };

  const getMovesFromRoom = (roomId) => connections
    .filter((connection) => connection.fromRoomId === roomId || connection.toRoomId === roomId)
    .map((connection) => getMoveForConnection(connection, roomId))
    .filter(Boolean);

  const currentMoves = activeRoom ? getMovesFromRoom(activeRoom.id) : [];
  const availableMoves = currentMoves.filter((move) => !move.blocked);
  const blockedMoves = currentMoves.filter((move) => move.blocked);
  const reachableRoomIds = new Set(activeRoom?.id ? [activeRoom.id] : []);
  const queue = activeRoom?.id ? [activeRoom.id] : [];
  while (queue.length) {
    const roomId = queue.shift();
    getMovesFromRoom(roomId).forEach((move) => {
      if (move.blocked || reachableRoomIds.has(move.toRoom.id)) return;
      reachableRoomIds.add(move.toRoom.id);
      queue.push(move.toRoom.id);
    });
  }

  const pathConnectionIds = new Set();
  (playerPath || []).forEach((roomId, index) => {
    const nextRoomId = playerPath[index + 1];
    if (!nextRoomId) return;
    const connection = connections.find((entry) => (
      (entry.fromRoomId === roomId && entry.toRoomId === nextRoomId)
      || (entry.fromRoomId === nextRoomId && entry.toRoomId === roomId)
    ));
    if (connection) pathConnectionIds.add(connection.id);
  });

  const deadEndRoomIds = new Set(rooms
    .filter((room) => room.type !== 'end' && getMovesFromRoom(room.id).every((move) => move.blocked))
    .map((room) => room.id));
  const endValidationIssues = activeRoom?.type === 'end'
    ? getRoomCompletionIssues(project, activeRoom, gameplayContext)
    : [];

  return {
    activeRoom,
    startRoom,
    availableMoves,
    blockedMoves,
    visitedRoomIds,
    reachableRoomIds,
    pathConnectionIds,
    deadEndRoomIds,
    atEndRoom: Boolean(activeRoom?.type === 'end'),
    endValidationIssues,
    simulatedItemIds: [...gameplayContext.itemIds],
    reachedEnd: Boolean(activeRoom?.type === 'end' && !endValidationIssues.length),
    blockedCount: connections.reduce((count, connection) => {
      const fromMove = getMoveForConnection(connection, connection.fromRoomId);
      return count + (fromMove?.blocked ? 1 : 0);
    }, 0),
  };
};

export default function RouteMapTab({ project, patchProject, getSceneLabel, setSelectedSceneId, setTab }) {
  const sourceRouteMap = project.routeMap || getDefaultMap();
  const acts = project.acts || [];
  const fallbackActId = acts[0]?.id || '';
  const [selectedActId, setSelectedActId] = useState(fallbackActId);
  const activeActId = acts.some((act) => act.id === selectedActId) ? selectedActId : fallbackActId;
  const activeActScenes = (project.scenes || []).filter((scene) => scene.actId === activeActId);
  const rootSceneOptions = (project.scenes || []).filter((scene) => !scene.parentSceneId);
  const routeMap = useMemo(
    () => getRouteMapForAct(project, sourceRouteMap, activeActId),
    [project, sourceRouteMap, activeActId]
  );
  const [selectedRoomId, setSelectedRoomId] = useState(routeMap.rooms?.[0]?.id || '');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [connectFromId, setConnectFromId] = useState('');
  const [draggingRoomId, setDraggingRoomId] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [mapMode, setMapMode] = useState('edit');
  const [routeSection, setRouteSection] = useState('home');
  const [hideSelection, setHideSelection] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCanvasId, setActiveCanvasId] = useState(DEFAULT_ROUTE_CANVAS_ID);
  const savedGameplayState = routeMap.gameplayState || {};
  const [playerRoomId, setPlayerRoomId] = useState(() => savedGameplayState.playerRoomId || '');
  const [playerPath, setPlayerPath] = useState(() => (
    Array.isArray(savedGameplayState.playerPath) ? savedGameplayState.playerPath : []
  ));
  const [playerItemIds, setPlayerItemIds] = useState(() => (
    Array.isArray(savedGameplayState.playerItemIds) ? savedGameplayState.playerItemIds : []
  ));
  const dragRef = useRef(null);

  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) || null;
  const diagnostics = useMemo(() => buildDiagnostics(project, routeMap, getSceneLabel), [project, routeMap, getSceneLabel]);
  const narrativePlan = useMemo(
    () => getNarrativePlan(project, activeActId, getSceneLabel),
    [project, activeActId, getSceneLabel]
  );
  const connectionChecksById = useMemo(() => (
    new Map((diagnostics.connectionChecks || []).map((check) => [check.connectionId, check]))
  ), [diagnostics.connectionChecks]);
  const gameplay = useMemo(
    () => buildGameplayState(project, routeMap, playerRoomId, playerPath, playerItemIds, getSceneLabel),
    [project, routeMap, playerRoomId, playerPath, playerItemIds, getSceneLabel]
  );
  const isGameplayMode = mapMode === 'gameplay';
  const showSelection = !hideSelection;
  const canvasDefinitions = useMemo(() => {
    const savedCanvases = Array.isArray(routeMap.canvases) && routeMap.canvases.length
      ? routeMap.canvases
      : getDefaultCanvases();
    const definitions = savedCanvases.map((canvas, index) => ({
      id: canvas.id || makeDefaultCanvas(index).id,
      name: canvas.name || makeDefaultCanvas(index).name,
    }));
    rooms.forEach((room) => {
      if (!room.canvasId || definitions.some((canvas) => canvas.id === room.canvasId)) return;
      definitions.push({ id: room.canvasId, name: `Canvas ${definitions.length + 1}` });
    });
    const neededCanvasCount = Math.max(1, Math.ceil(rooms.length / ROUTE_CANVAS_ROOM_LIMIT));
    while (definitions.length < neededCanvasCount) {
      definitions.push(makeDefaultCanvas(definitions.length));
    }
    return definitions;
  }, [routeMap.canvases, rooms]);
  const roomCanvasById = useMemo(() => {
    const canvasIds = canvasDefinitions.map((canvas) => canvas.id);
    return new Map(rooms.map((room, index) => {
      const fallbackCanvasId = canvasIds[Math.min(Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT), canvasIds.length - 1)] || DEFAULT_ROUTE_CANVAS_ID;
      return [room.id, room.canvasId || fallbackCanvasId];
    }));
  }, [canvasDefinitions, rooms]);
  const roomsByCanvasId = useMemo(() => (
    canvasDefinitions.reduce((groups, canvas) => {
      groups.set(canvas.id, rooms.filter((room) => roomCanvasById.get(room.id) === canvas.id));
      return groups;
    }, new Map())
  ), [canvasDefinitions, roomCanvasById, rooms]);
  const activeCanvas = canvasDefinitions.find((canvas) => canvas.id === activeCanvasId) || canvasDefinitions[0] || makeDefaultCanvas(0);
  const activeCanvasRoomCount = roomsByCanvasId.get(activeCanvas.id)?.length || 0;
  const isActiveCanvasFull = activeCanvasRoomCount >= ROUTE_CANVAS_ROOM_LIMIT;

  const patchRouteMap = (updater, options) => {
    patchProject((draft) => {
      if (!draft.routeMap) draft.routeMap = getDefaultMap();
      if (!draft.routeMap.actMaps || typeof draft.routeMap.actMaps !== 'object') draft.routeMap.actMaps = {};
      if (!draft.routeMap.actMaps[activeActId]) {
        draft.routeMap.actMaps[activeActId] = getRouteMapForAct(draft, draft.routeMap, activeActId);
      }
      if (!Array.isArray(draft.routeMap.actMaps[activeActId].rooms)) draft.routeMap.actMaps[activeActId].rooms = [];
      if (!Array.isArray(draft.routeMap.actMaps[activeActId].connections)) draft.routeMap.actMaps[activeActId].connections = [];
      if (!Array.isArray(draft.routeMap.actMaps[activeActId].canvases) || !draft.routeMap.actMaps[activeActId].canvases.length) {
        draft.routeMap.actMaps[activeActId].canvases = getDefaultCanvases();
      }
      const draftCanvases = draft.routeMap.actMaps[activeActId].canvases;
      draft.routeMap.actMaps[activeActId].rooms.forEach((room, index) => {
        if (room.canvasId && draftCanvases.some((canvas) => canvas.id === room.canvasId)) return;
        room.canvasId = draftCanvases[Math.min(Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT), draftCanvases.length - 1)]?.id || DEFAULT_ROUTE_CANVAS_ID;
      });
      updater(draft.routeMap.actMaps[activeActId]);
    }, options);
  };

  const saveGameplayState = (nextState) => {
    patchRouteMap((draftMap) => {
      const state = {
        playerRoomId: nextState.playerRoomId || '',
        playerPath: Array.isArray(nextState.playerPath) ? nextState.playerPath : [],
        playerItemIds: Array.isArray(nextState.playerItemIds) ? nextState.playerItemIds : [],
      };
      const current = draftMap.gameplayState || {};
      if (
        current.playerRoomId === state.playerRoomId
        && sameStringArray(current.playerPath, state.playerPath)
        && sameStringArray(current.playerItemIds, state.playerItemIds)
      ) return;
      draftMap.gameplayState = state;
    }, { rememberHistory: false });
  };

  useEffect(() => {
    if (selectedActId && acts.some((act) => act.id === selectedActId)) return;
    setSelectedActId(fallbackActId);
  }, [acts, fallbackActId, selectedActId]);

  useEffect(() => {
    if (!selectedRoomId || rooms.some((room) => room.id === selectedRoomId)) return;
    setSelectedRoomId(rooms[0]?.id || '');
    setConnectFromId('');
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedConnectionId || connections.some((connection) => connection.id === selectedConnectionId)) return;
    setSelectedConnectionId('');
  }, [connections, selectedConnectionId]);

  useEffect(() => {
    if (canvasDefinitions.some((canvas) => canvas.id === activeCanvasId)) return;
    setActiveCanvasId(canvasDefinitions[0]?.id || DEFAULT_ROUTE_CANVAS_ID);
  }, [activeCanvasId, canvasDefinitions]);

  useEffect(() => {
    const savedState = routeMap.gameplayState || {};
    const savedRoomId = savedState.playerRoomId || '';
    const savedPath = Array.isArray(savedState.playerPath) ? savedState.playerPath : [];
    const savedItems = Array.isArray(savedState.playerItemIds) ? savedState.playerItemIds : [];
    if (savedRoomId && rooms.some((room) => room.id === savedRoomId)) {
      setPlayerRoomId(savedRoomId);
      setPlayerPath(savedPath.length ? savedPath : [savedRoomId]);
      setPlayerItemIds(savedItems);
      return;
    }
    const startRoom = rooms.find((room) => room.type === 'start') || rooms[0] || null;
    const startRoomId = startRoom?.id || '';
    const startItemIds = startRoom ? getRoomRewardItemIds(project, startRoom) : [];
    setPlayerRoomId(startRoomId);
    setPlayerPath(startRoomId ? [startRoomId] : []);
    setPlayerItemIds(startItemIds);
  }, [activeActId]);

  useEffect(() => {
    if (!gameplay.startRoom) {
      setPlayerRoomId('');
      setPlayerPath([]);
      setPlayerItemIds([]);
      return;
    }
    if (playerRoomId && rooms.some((room) => room.id === playerRoomId)) return;
    const startItemIds = getRoomRewardItemIds(project, gameplay.startRoom);
    setPlayerRoomId(gameplay.startRoom.id);
    setPlayerPath([gameplay.startRoom.id]);
    setPlayerItemIds(startItemIds);
  }, [gameplay.startRoom, playerRoomId, rooms]);

  useEffect(() => {
    if (!gameplay.activeRoom) return;
    const rewardItemIds = getRoomRewardItemIds(project, gameplay.activeRoom);
    if (!rewardItemIds.some((itemId) => !playerItemIds.includes(itemId))) return;
    setPlayerItemIds((itemIds) => {
      const nextItemIds = [...new Set([...itemIds, ...rewardItemIds])];
      return nextItemIds;
    });
  }, [gameplay.activeRoom, playerItemIds, project]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const addCanvas = () => {
    let createdCanvas = null;
    patchRouteMap((draftMap) => {
      if (!Array.isArray(draftMap.canvases) || !draftMap.canvases.length) draftMap.canvases = getDefaultCanvases();
      createdCanvas = {
        id: makeId('canvas'),
        name: `Canvas ${draftMap.canvases.length + 1}`,
      };
      draftMap.canvases.push(createdCanvas);
    });
    if (createdCanvas?.id) setActiveCanvasId(createdCanvas.id);
    return createdCanvas;
  };

  const addRoom = (sceneId = '', position = {}, canvasId = activeCanvas.id) => {
    const targetCanvasId = canvasDefinitions.some((canvas) => canvas.id === canvasId)
      ? canvasId
      : activeCanvas.id;
    const canvasRoomCount = roomsByCanvasId.get(targetCanvasId)?.length || 0;
    if (canvasRoomCount >= ROUTE_CANVAS_ROOM_LIMIT) {
      setActiveCanvasId(targetCanvasId);
      showAlert({
        title: 'Canvas plein',
        message: 'Ce canvas contient déjà 15 pièces. Ouvre un autre canvas pour continuer le plan.',
      });
      return;
    }
    const room = {
      id: makeId('room'),
      name: sceneId ? getSceneLabel(sceneId) : `Pièce ${rooms.length + 1}`,
      sceneId,
      canvasId: targetCanvasId,
      x: clamp(position.x ?? 16 + (canvasRoomCount % 5) * 16, 8, 86),
      y: clamp(position.y ?? 18 + Math.floor(canvasRoomCount / 5) * 20, 10, 84),
      type: rooms.some((entry) => entry.type === 'start') ? 'room' : 'start',
    };
    patchRouteMap((draftMap) => {
      draftMap.rooms.push(room);
    });
    setActiveCanvasId(targetCanvasId);
    setSelectedRoomId(room.id);
    setSelectedConnectionId('');
  };

  const duplicateRoom = (roomId) => {
    const sourceRoom = rooms.find((room) => room.id === roomId);
    if (!sourceRoom) return;
    const targetCanvasId = roomCanvasById.get(sourceRoom.id) || activeCanvas.id;
    if ((roomsByCanvasId.get(targetCanvasId)?.length || 0) >= ROUTE_CANVAS_ROOM_LIMIT) {
      setActiveCanvasId(targetCanvasId);
      showAlert({
        title: 'Canvas plein',
        message: 'Ce canvas contient déjà 15 pièces. Ouvre un autre canvas pour dupliquer cette pièce.',
      });
      return;
    }
    const room = {
      ...sourceRoom,
      id: makeId('room'),
      name: `${sourceRoom.name || 'Pièce'} copie`,
      canvasId: targetCanvasId,
      x: clamp((sourceRoom.x || 50) + 6, 8, 86),
      y: clamp((sourceRoom.y || 50) + 6, 10, 84),
      type: 'room',
    };
    patchRouteMap((draftMap) => {
      draftMap.rooms.push(room);
    });
    setSelectedRoomId(room.id);
    setSelectedConnectionId('');
    setContextMenu(null);
  };

  const addMissingSceneRooms = () => {
    const mappedSceneIds = new Set(rooms.map((room) => room.sceneId).filter(Boolean));
    const scenesToAdd = activeActScenes.filter((scene) => !mappedSceneIds.has(scene.id));
    let firstAddedCanvasId = '';
    patchRouteMap((draftMap) => {
      if (!Array.isArray(draftMap.canvases) || !draftMap.canvases.length) draftMap.canvases = getDefaultCanvases();
      const canvasCounts = new Map(draftMap.canvases.map((canvas) => [canvas.id, 0]));
      draftMap.rooms.forEach((room, index) => {
        if (!room.canvasId || !canvasCounts.has(room.canvasId)) {
          room.canvasId = draftMap.canvases[Math.min(Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT), draftMap.canvases.length - 1)]?.id || DEFAULT_ROUTE_CANVAS_ID;
        }
        canvasCounts.set(room.canvasId, (canvasCounts.get(room.canvasId) || 0) + 1);
      });
      scenesToAdd.forEach((scene, index) => {
        let targetCanvas = draftMap.canvases.find((canvas) => (canvasCounts.get(canvas.id) || 0) < ROUTE_CANVAS_ROOM_LIMIT);
        if (!targetCanvas) {
          targetCanvas = {
            id: makeId('canvas'),
            name: `Canvas ${draftMap.canvases.length + 1}`,
          };
          draftMap.canvases.push(targetCanvas);
          canvasCounts.set(targetCanvas.id, 0);
        }
        const countInCanvas = canvasCounts.get(targetCanvas.id) || 0;
        if (!firstAddedCanvasId) firstAddedCanvasId = targetCanvas.id;
        draftMap.rooms.push({
          id: makeId('room'),
          name: scene.name || `Pièce ${draftMap.rooms.length + 1}`,
          sceneId: scene.id,
          canvasId: targetCanvas.id,
          x: clamp(16 + (countInCanvas % 5) * 16, 8, 90),
          y: clamp(18 + Math.floor(countInCanvas / 5) * 20, 10, 86),
          type: draftMap.rooms.some((room) => room.type === 'start') ? 'room' : 'start',
        });
        canvasCounts.set(targetCanvas.id, countInCanvas + 1);
      });
    });
    if (firstAddedCanvasId) setActiveCanvasId(firstAddedCanvasId);
  };

  const updateRoom = (roomId, updater, options) => {
    patchRouteMap((draftMap) => {
      const room = draftMap.rooms.find((entry) => entry.id === roomId);
      if (room) updater(room, draftMap);
    }, options);
  };

  const updateConnection = (connectionId, updater, options) => {
    patchRouteMap((draftMap) => {
      const connection = draftMap.connections.find((entry) => entry.id === connectionId);
      if (connection) updater(connection, draftMap);
    }, options);
  };

  const deleteRoom = async (roomId) => {
    const room = rooms.find((entry) => entry.id === roomId);
    const confirmed = await showConfirm({
      title: 'Supprimer la pièce',
      message: `Supprimer la pièce "${room?.name || 'selectionnée'}" et ses liaisons ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = draftMap.rooms.filter((room) => room.id !== roomId);
      draftMap.connections = draftMap.connections.filter((connection) => (
        connection.fromRoomId !== roomId && connection.toRoomId !== roomId
      ));
    });
    setSelectedRoomId('');
    setConnectFromId('');
  };

  const deleteConnection = async (connectionId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la liaison',
      message: 'Supprimer cette liaison ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    patchRouteMap((draftMap) => {
      draftMap.connections = draftMap.connections.filter((connection) => connection.id !== connectionId);
    });
    setSelectedConnectionId('');
    setContextMenu(null);
  };

  const toggleConnectionOneWayApproval = (connectionId) => {
    patchRouteMap((draftMap) => {
      const connection = draftMap.connections.find((entry) => entry.id === connectionId);
      if (connection) connection.allowOneWay = !connection.allowOneWay;
    });
  };

  const openRoomScene = (room) => {
    if (!room?.sceneId || !setSelectedSceneId || !setTab) return;
    setSelectedSceneId(room.sceneId);
    setTab('scenes');
  };

  const toggleConnection = (toRoomId) => {
    if (!connectFromId) {
      setConnectFromId(toRoomId);
      setSelectedRoomId(toRoomId);
      return;
    }
    if (connectFromId === toRoomId) {
      setConnectFromId('');
      return;
    }
    patchRouteMap((draftMap) => {
      const existing = draftMap.connections.find((connection) => (
        connection.fromRoomId === connectFromId && connection.toRoomId === toRoomId
      ));
      if (existing) {
        draftMap.connections = draftMap.connections.filter((connection) => connection.id !== existing.id);
      } else {
        draftMap.connections.push({
          id: makeId('connection'),
          fromRoomId: connectFromId,
          toRoomId,
          label: '',
          locked: false,
          allowOneWay: false,
        });
      }
    });
    setConnectFromId('');
    setSelectedRoomId(toRoomId);
    setSelectedConnectionId('');
  };

  const clearMap = async () => {
    const confirmed = await showConfirm({
      title: 'Effacer le plan',
      message: 'Effacer le plan de cet acte ?',
      confirmLabel: 'Effacer',
      variant: 'danger',
    });
    if (!confirmed) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = [];
      draftMap.connections = [];
      draftMap.canvases = getDefaultCanvases();
    });
    setSelectedRoomId('');
    setConnectFromId('');
    setActiveCanvasId(DEFAULT_ROUTE_CANVAS_ID);
  };

  const getBoardPosition = (event) => {
    const board = event.currentTarget.closest('.route-room-board');
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      board,
      rect,
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93),
    };
  };

  const handleRoomPointerMove = (event, roomId) => {
    if (draggingRoomId !== roomId || dragRef.current?.roomId !== roomId) return;
    const distance = Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY);
    if (distance > 3) dragRef.current.moved = true;
    const position = getBoardPosition(event);
    if (!position) return;
    updateRoom(roomId, (room) => {
      room.x = position.x;
      room.y = position.y;
    }, { rememberHistory: false });
  };

  const openContextMenu = (event, options) => {
    event.preventDefault();
    event.stopPropagation();
    const position = getBoardPosition(event);
    if (!position) return;
    setContextMenu({
      ...options,
      x: event.clientX - position.rect.left,
      y: event.clientY - position.rect.top,
      boardX: position.x,
      boardY: position.y,
    });
  };

  const selectConnection = (connectionId) => {
    setSelectedConnectionId(connectionId);
    setSelectedRoomId('');
    setConnectFromId('');
    setContextMenu(null);
  };

  const resetGameplay = () => {
    const startRoom = gameplay.startRoom || rooms[0] || null;
    const startRoomId = startRoom?.id || '';
    const nextPath = startRoomId ? [startRoomId] : [];
    const nextItemIds = startRoom ? getRoomRewardItemIds(project, startRoom) : [];
    setPlayerRoomId(startRoomId);
    setPlayerPath(nextPath);
    setPlayerItemIds(nextItemIds);
    saveGameplayState({
      playerRoomId: startRoomId,
      playerPath: nextPath,
      playerItemIds: nextItemIds,
    });
  };

  const movePlayerToRoom = (roomId) => {
    const move = gameplay.availableMoves.find((entry) => entry.toRoom.id === roomId);
    if (!move) return;
    const targetRoom = rooms.find((room) => room.id === roomId);
    const rewardItemIds = getRoomRewardItemIds(project, targetRoom);
    const basePath = playerPath.length ? playerPath : (gameplay.activeRoom?.id ? [gameplay.activeRoom.id] : []);
    const nextPath = [...basePath, roomId];
    const nextItemIds = [...new Set([...playerItemIds, ...rewardItemIds])];
    setPlayerRoomId(roomId);
    setPlayerItemIds(nextItemIds);
    setPlayerPath(nextPath);
    saveGameplayState({
      playerRoomId: roomId,
      playerPath: nextPath,
      playerItemIds: nextItemIds,
    });
    setSelectedRoomId(roomId);
    setSelectedConnectionId('');
  };

  const openBuilderView = () => {
    setRouteSection('builder');
    setMapMode('edit');
    setContextMenu(null);
    setConnectFromId('');
  };

  const openTestsView = () => {
    setRouteSection('tests');
    setMapMode('gameplay');
    setContextMenu(null);
    setConnectFromId('');
    setSelectedConnectionId('');
    if (!playerRoomId) resetGameplay();
  };

  const returnToRouteHome = () => {
    setRouteSection('home');
    setContextMenu(null);
    setConnectFromId('');
    setSelectedConnectionId('');
  };

  if (routeSection === 'home') {
    return (
      <section className="panel route-map-choice-shell">
        <div className="route-choice-head">
          <div>
            <span className="section-kicker">Plan</span>
            <h2>Choisir une action</h2>
          </div>
          <span className={`status-badge ${diagnostics.ok ? '' : 'soft'}`}>
            {diagnostics.ok ? 'Plan OK' : `${diagnostics.problems.length} souci(s)`}
          </span>
        </div>

        <div className="route-choice-grid">
          <button type="button" className="route-choice-card build" onClick={openBuilderView}>
            <span className="route-choice-image">
              <img src={planBuildPreviewUrl} alt="" loading="lazy" />
            </span>
            <span className="route-choice-content">
              <span className="section-kicker">Construction</span>
              <strong>Construire le plan</strong>
              <span>Placer les pièces, relier les scènes et organiser les canvas.</span>
            </span>
          </button>

          <button type="button" className="route-choice-card tests" onClick={openTestsView}>
            <span className="route-choice-image">
              <img src={planTestPreviewUrl} alt="" loading="lazy" />
            </span>
            <span className="route-choice-content">
              <span className="section-kicker">Tests</span>
              <strong>Tester les liens</strong>
              <span>Vérifier les allers-retours, les sens uniques et les blocages.</span>
            </span>
          </button>
        </div>

        <div className="route-choice-summary" aria-label="Résumé du plan">
          <span><strong>{rooms.length}</strong> pièces</span>
          <span><strong>{connections.length}</strong> liaisons</span>
          <span><strong>{diagnostics.warnings.length + diagnostics.problems.length}</strong> alertes</span>
        </div>
      </section>
    );
  }

  return (
    <div className="layout route-map-layout">
      <section className="panel side route-map-tools">
        <div className="panel-head route-view-panel-head">
          <div>
            <button type="button" className="secondary-action route-back-button" onClick={returnToRouteHome}>
              <ArrowLeft size={15} aria-hidden="true" />
              Retour
            </button>
            <span className="section-kicker">Plan</span>
            <h2>{isGameplayMode ? 'Tests des liens' : 'Construire'}</h2>
          </div>
          <span className={`status-badge ${diagnostics.ok ? '' : 'soft'}`}>{diagnostics.ok ? 'OK' : `${diagnostics.problems.length} souci(s)`}</span>
        </div>

        {!isGameplayMode ? (
          <details className="route-start-settings" data-tour="map-start-settings">
            <summary className="route-start-settings-head">
              <strong>Demarrage du jeu</strong>
              <span>{(project.start?.type || 'scene') === 'cinematic' ? 'Intro cinématique' : 'Scène jouable'}</span>
            </summary>
            <label>
              <span className="label-with-help">
                <span>Le jeu commence par</span>
                <span className="help-dot" data-help={FIELD_HELP.startType} aria-label={FIELD_HELP.startType} tabIndex={0}>?</span>
              </span>
              <select
                value={project.start?.type || 'scene'}
                onChange={(event) => patchProject((draft) => {
                  applyProjectStartType(draft, event.target.value);
                })}
              >
                <option value="scene">Une scène</option>
                <option value="cinematic">Une cinematic</option>
              </select>
            </label>

            {(project.start?.type || 'scene') === 'scene' ? (
              <label>
                <span className="label-with-help">
                  <span>Scène de départ</span>
                  <span className="help-dot" data-help={FIELD_HELP.startScene} aria-label={FIELD_HELP.startScene} tabIndex={0}>?</span>
                </span>
                <select
                  value={project.start?.targetSceneId || rootSceneOptions[0]?.id || ''}
                  onChange={(event) => patchProject((draft) => {
                    if (!draft.start) {
                      draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
                    }
                    draft.start.targetSceneId = event.target.value;
                  })}
                >
                  {rootSceneOptions.map((scene) => (
                    <option key={scene.id} value={scene.id}>{scene.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                <span className="label-with-help">
                  <span>Cinématique de départ</span>
                  <span className="help-dot" data-help={FIELD_HELP.startCinematic} aria-label={FIELD_HELP.startCinematic} tabIndex={0}>?</span>
                </span>
                <select
                  value={project.start?.targetCinematicId || project.cinematics?.[0]?.id || ''}
                  onChange={(event) => patchProject((draft) => {
                    if (!draft.start) {
                      draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
                    }
                    draft.start.targetCinematicId = event.target.value;
                  })}
                >
                  {(project.cinematics || []).length ? (
                    project.cinematics.map((cine) => (
                      <option key={cine.id} value={cine.id}>{cine.name}</option>
                    ))
                  ) : (
                    <option value="">Aucune cinématique</option>
                  )}
                </select>
              </label>
            )}
          </details>
        ) : null}

        <label className="route-act-picker">
          Acte
          <select value={activeActId} onChange={(event) => {
            setSelectedActId(event.target.value);
            setSelectedRoomId('');
            setConnectFromId('');
            setActiveCanvasId(DEFAULT_ROUTE_CANVAS_ID);
            setPlayerRoomId('');
            setPlayerPath([]);
            setPlayerItemIds([]);
          }}>
            {acts.map((act) => (
              <option key={act.id} value={act.id}>{act.name}</option>
            ))}
          </select>
        </label>

        <div className={`route-view-status ${isGameplayMode ? 'tests' : 'build'}`} role="status">
          {isGameplayMode ? <Gamepad2 size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
          <span>{isGameplayMode ? 'Mode test des liaisons' : 'Mode construction du plan'}</span>
        </div>

        {isGameplayMode ? (
          <div className={`route-gameplay-card ${gameplay.reachedEnd ? 'gameplay-complete' : ''}`}>
            <strong>{gameplay.activeRoom ? roomLabel(gameplay.activeRoom, project, getSceneLabel) : 'Aucun départ'}</strong>
            <span>
              {gameplay.reachedEnd
                ? 'Arrivee validée'
                : gameplay.atEndRoom
                  ? `${gameplay.endValidationIssues.length} condition(s) restante(s)`
                  : `${gameplay.availableMoves.length} sortie(s) jouable(s)`}
            </span>
            <p>Clique une sortie bleue dans Detail, un node voisin sur la carte, ou une pièce marquee dans la liste pour avancer.</p>
            <div className="inline-actions">
              <button type="button" onClick={resetGameplay}>
                <RotateCcw size={15} aria-hidden="true" />
                Rejouer
              </button>
            </div>
          </div>
        ) : null}

        {!isGameplayMode ? <div className="inline-actions" data-tour="map-add-room">
          <button type="button" disabled={isActiveCanvasFull} onClick={() => addRoom()}>
            <Plus size={16} aria-hidden="true" />
            Pièce
          </button>
          <button type="button" className="secondary-action" onClick={addMissingSceneRooms}>
            <DoorOpen size={16} aria-hidden="true" />
            Depuis scènes
          </button>
        </div> : null}

        {!isGameplayMode ? (
          <div className="route-canvas-picker">
            <label>
              Canvas actif
              <select value={activeCanvas.id} onChange={(event) => setActiveCanvasId(event.target.value)}>
                {canvasDefinitions.map((canvas) => (
                  <option key={canvas.id} value={canvas.id}>
                    {canvas.name} - {roomsByCanvasId.get(canvas.id)?.length || 0}/{ROUTE_CANVAS_ROOM_LIMIT}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-action" onClick={addCanvas}>
              <Plus size={16} aria-hidden="true" />
              Nouveau canvas
            </button>
            {isActiveCanvasFull ? (
              <div className="route-canvas-limit-note" role="status">
                Ce canvas contient 15 pièces. Ouvre un autre canvas pour continuer.
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="small-note">{isGameplayMode ? 'Astuce: les sorties jouables sont des boutons. Clique dessus pour faire avancer le joueur.' : 'Double-clic pour ouvrir une scène, glisse les pièces, clique une liaison pour sa condition, clic droit pour les actions rapides.'}</p>

        {!isGameplayMode ? (
          <>
            <label className="route-notes-field">
              Notes de parcours
              <textarea
                value={routeMap.notes || ''}
                placeholder="Conditions d’accès, ordre prévu, pièges de connexion..."
                onChange={(event) => patchRouteMap((draftMap) => {
                  draftMap.notes = event.target.value;
                })}
              />
            </label>

            <button type="button" className="danger-button route-map-clear" onClick={clearMap}>
              <Trash2 size={16} aria-hidden="true" />
              Effacer le plan
            </button>
          </>
        ) : null}
      </section>

      <section className={`panel main route-map-main ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="panel-head">
          <div>
            <span className="section-kicker">{isGameplayMode ? 'Vérification' : 'Connexions'}</span>
            <h2>{isGameplayMode ? 'Tests des liens' : 'Carte des pièces'}</h2>
          </div>
          <div className="route-map-head-actions">
            <span className="small-note">{connections.length} liaison{connections.length > 1 ? 's' : ''}</span>
            <button type="button" className="icon-button route-fullscreen-button" onClick={() => setIsFullscreen((value) => !value)} title={isFullscreen ? 'Quitter le plein écran' : 'Mode plein écran'}>
              {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="route-canvas-stack">
          {canvasDefinitions.map((canvas, canvasIndex) => {
            const canvasRooms = roomsByCanvasId.get(canvas.id) || [];
            const canvasRoomIds = new Set(canvasRooms.map((room) => room.id));
            const localConnections = connections.filter((connection) => (
              canvasRoomIds.has(connection.fromRoomId) && canvasRoomIds.has(connection.toRoomId)
            ));
            const crossCanvasConnections = connections.filter((connection) => (
              canvasRoomIds.has(connection.fromRoomId) !== canvasRoomIds.has(connection.toRoomId)
            ));
            const canvasPlayerRoom = isGameplayMode
              ? canvasRooms.find((room) => room.id === gameplay.activeRoom?.id)
              : null;
            const isCanvasFull = canvasRooms.length >= ROUTE_CANVAS_ROOM_LIMIT;
            return (
              <div key={canvas.id} className={`route-canvas-section ${activeCanvas.id === canvas.id ? 'active' : ''}`}>
                <div className="route-canvas-section-head">
                  <div>
                    <strong>{canvas.name}</strong>
                    <span>{canvasRooms.length}/{ROUTE_CANVAS_ROOM_LIMIT} pièces</span>
                  </div>
                  <button type="button" className="secondary-action" onClick={() => setActiveCanvasId(canvas.id)}>
                    Utiliser ici
                  </button>
                </div>
                {isCanvasFull ? (
                  <div className="route-canvas-limit-message" role="status">
                    Ce canvas a atteint 15 scènes / sous-scènes.
                    <button type="button" onClick={addCanvas}>
                      <Plus size={14} aria-hidden="true" />
                      Ouvrir un autre canvas
                    </button>
                  </div>
                ) : null}
                <div
                  className={`route-room-board ${isGameplayMode ? 'gameplay-mode' : ''}`}
                  data-tour={canvasIndex === 0 ? 'map-board' : undefined}
                  onClick={() => {
                    setActiveCanvasId(canvas.id);
                    setContextMenu(null);
                  }}
                  onContextMenu={(event) => {
                    if (isGameplayMode) {
                      event.preventDefault();
                      return;
                    }
                    setActiveCanvasId(canvas.id);
                    openContextMenu(event, { kind: 'board', canvasId: canvas.id });
                  }}
                >
          <svg className="route-connection-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="route-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(191, 219, 254, .82)" />
              </marker>
              <marker id="route-arrow-missing" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
              </marker>
              <marker id="route-arrow-partial" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
              </marker>
              <marker id="route-arrow-ok" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#22c55e" />
              </marker>
            </defs>
            {localConnections.map((connection) => {
              const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
              const toRoom = rooms.find((room) => room.id === connection.toRoomId);
              if (!fromRoom || !toRoom) return null;
              const check = connectionChecksById.get(connection.id);
              const status = check?.status || 'neutral';
              const markerId = ['missing', 'partial', 'ok'].includes(status) ? `route-arrow-${status}` : 'route-arrow';
              const gameplayConnectionClass = isGameplayMode
                ? [
                  gameplay.pathConnectionIds.has(connection.id) ? 'gameplay-path' : '',
                  gameplay.availableMoves.some((move) => move.connection.id === connection.id) ? 'gameplay-available' : '',
                  gameplay.blockedMoves.some((move) => move.connection.id === connection.id) ? 'gameplay-blocked' : '',
                ].filter(Boolean).join(' ')
                : '';
              return (
                <g key={connection.id} className={`route-connection-hitbox ${showSelection && selectedConnectionId === connection.id ? 'selected' : ''}`}>
                  <line
                    x1={fromRoom.x}
                    y1={fromRoom.y}
                    x2={toRoom.x}
                    y2={toRoom.y}
                    className={`route-connection-visible status-${status} ${connection.locked ? 'locked' : ''} ${gameplayConnectionClass}`}
                    markerEnd={`url(#${markerId})`}
                  />
                  <line
                    x1={fromRoom.x}
                    y1={fromRoom.y}
                    x2={toRoom.x}
                    y2={toRoom.y}
                    className="route-connection-click-target"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isGameplayMode) {
                        const move = gameplay.availableMoves.find((entry) => entry.connection.id === connection.id);
                        if (move) movePlayerToRoom(move.toRoom.id);
                        return;
                      }
                      selectConnection(connection.id);
                    }}
                    onContextMenu={(event) => {
                      if (isGameplayMode) {
                        event.preventDefault();
                        return;
                      }
                      openContextMenu(event, { kind: 'connection', connectionId: connection.id, canvasId: canvas.id });
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {!isGameplayMode ? (
            <div className="route-connection-badge-layer" aria-hidden="true">
              {localConnections.map((connection) => {
                const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
                const toRoom = rooms.find((room) => room.id === connection.toRoomId);
                if (!fromRoom || !toRoom) return null;
                const narrativeBadges = getConnectionNarrativeBadges(project, fromRoom, toRoom);
                if (!narrativeBadges.length) return null;
                const labelX = ((fromRoom.x || 0) + (toRoom.x || 0)) / 2;
                const labelY = ((fromRoom.y || 0) + (toRoom.y || 0)) / 2;
                return (
                  <div
                    key={`badges-${connection.id}`}
                    className="route-connection-effects"
                    style={{ left: `${labelX}%`, top: `${labelY}%` }}
                  >
                    {narrativeBadges.slice(0, 3).map((badge, index) => (
                      <span key={`${badge.type}-${badge.label}-${index}`} className={`route-effect-badge ${badge.type}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}

          {canvasPlayerRoom ? (
            <img
              className="route-player-marker"
              src={routePlayerCharacterUrl}
              alt=""
              aria-hidden="true"
              style={{
                left: `${canvasPlayerRoom.x}%`,
                top: `${canvasPlayerRoom.y}%`,
                '--route-player-offset-x': canvasPlayerRoom.x > 82 ? '-98px' : '46px',
                '--route-player-offset-y': canvasPlayerRoom.y < 20 ? '10px' : '-86%',
              }}
            />
          ) : null}

          {canvasRooms.map((room) => {
            const mechanics = getRoomMechanics(project, room);
            const roomGameplayClass = isGameplayMode
              ? [
                gameplay.activeRoom?.id === room.id ? 'gameplay-current' : '',
                gameplay.visitedRoomIds.has(room.id) ? 'gameplay-visited' : '',
                gameplay.reachableRoomIds.has(room.id) ? 'gameplay-reachable' : '',
                gameplay.deadEndRoomIds.has(room.id) ? 'gameplay-dead-end' : '',
                gameplay.availableMoves.some((move) => move.toRoom.id === room.id) ? 'gameplay-next' : '',
              ].filter(Boolean).join(' ')
              : '';
            return (
            <button
              key={room.id}
              type="button"
              className={`route-room-node type-${room.type || 'room'} ${showSelection && selectedRoomId === room.id ? 'selected' : ''} ${showSelection && connectFromId === room.id ? 'connecting' : ''} ${roomGameplayClass} ${isGameplayMode && gameplay.reachedEnd && gameplay.activeRoom?.id === room.id ? 'gameplay-complete' : ''}`}
              style={{ left: `${room.x}%`, top: `${room.y}%` }}
              onClick={(event) => {
                event.stopPropagation();
                setActiveCanvasId(canvas.id);
                if (isGameplayMode) {
                  movePlayerToRoom(room.id);
                  return;
                }
                if (dragRef.current?.moved) return;
                if (connectFromId) toggleConnection(room.id);
                else {
                  setSelectedRoomId(room.id);
                  setSelectedConnectionId('');
                }
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openRoomScene(room);
              }}
              onPointerDown={(event) => {
                if (isGameplayMode) return;
                if (event.button === 2) return;
                setActiveCanvasId(canvas.id);
                event.currentTarget.setPointerCapture?.(event.pointerId);
                dragRef.current = {
                  roomId: room.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  moved: false,
                };
                setDraggingRoomId(room.id);
                setSelectedRoomId(room.id);
                setSelectedConnectionId('');
                setContextMenu(null);
              }}
              onPointerMove={(event) => handleRoomPointerMove(event, room.id)}
              onPointerUp={() => {
                setDraggingRoomId('');
                window.setTimeout(() => {
                  dragRef.current = null;
                }, 0);
              }}
              onContextMenu={(event) => {
                if (isGameplayMode) {
                  event.preventDefault();
                  return;
                }
                openContextMenu(event, { kind: 'room', roomId: room.id, canvasId: canvas.id });
              }}
              title={isGameplayMode ? 'Mode parcours joueur' : room.sceneId ? 'Double-clic: ouvrir la scène' : 'Pièce sans scène liée'}
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{room.name || 'Pièce'}</span>
              {(mechanics.enigma || mechanics.cinematic || mechanics.logic) ? (
                <span className="route-node-badges" aria-label="Mécaniques de scène">
                  {mechanics.enigma ? <Lock size={12} aria-label="Énigme" /> : null}
                  {mechanics.cinematic ? <Clapperboard size={12} aria-label="Cinématique" /> : null}
                  {mechanics.logic ? <Brain size={12} aria-label="Logique" /> : null}
                </span>
              ) : null}
            </button>
          );
          })}

          {contextMenu && !isGameplayMode && contextMenu.canvasId === canvas.id ? (
            <div
              className="route-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              {contextMenu.kind === 'board' ? (
                <button type="button" onClick={() => {
                  addRoom('', { x: contextMenu.boardX, y: contextMenu.boardY }, canvas.id);
                  setContextMenu(null);
                }} disabled={isCanvasFull}>
                  <Plus size={14} aria-hidden="true" />
                  {isCanvasFull ? 'Canvas plein' : 'Ajouter ici'}
                </button>
              ) : null}

              {contextMenu.kind === 'room' ? (() => {
                const room = rooms.find((entry) => entry.id === contextMenu.roomId);
                if (!room) return null;
                return (
                  <>
                    <button type="button" disabled={!room.sceneId || !setTab} onClick={() => {
                      openRoomScene(room);
                      setContextMenu(null);
                    }}>
                      <ExternalLink size={14} aria-hidden="true" />
                      Ouvrir scène
                    </button>
                    <button type="button" onClick={() => {
                      setConnectFromId(room.id);
                      setSelectedRoomId(room.id);
                      setSelectedConnectionId('');
                      setContextMenu(null);
                    }}>
                      <Link size={14} aria-hidden="true" />
                      Relier depuis
                    </button>
                    <button type="button" onClick={() => duplicateRoom(room.id)}>
                      <Plus size={14} aria-hidden="true" />
                      Dupliquer
                    </button>
                    <button type="button" onClick={() => {
                      updateRoom(room.id, (entry, draftMap) => {
                        draftMap.rooms.forEach((candidate) => {
                          if (candidate.id !== entry.id && candidate.type === 'start') candidate.type = 'room';
                        });
                        entry.type = 'start';
                      });
                      setContextMenu(null);
                    }}>
                      <MapPin size={14} aria-hidden="true" />
                      Definir départ
                    </button>
                    <button type="button" className="danger-action" onClick={() => deleteRoom(room.id)}>
                      <Trash2 size={14} aria-hidden="true" />
                      Supprimer
                    </button>
                  </>
                );
              })() : null}

              {contextMenu.kind === 'connection' ? (
                <>
                  <button type="button" onClick={() => selectConnection(contextMenu.connectionId)}>
                    <Pencil size={14} aria-hidden="true" />
                    Editer condition
                  </button>
                  <button type="button" onClick={() => {
                    toggleConnectionOneWayApproval(contextMenu.connectionId);
                    setContextMenu(null);
                  }}>
                    <MousePointerClick size={14} aria-hidden="true" />
                    Basculer aller simple
                  </button>
                  <button type="button" className="danger-action" onClick={() => deleteConnection(contextMenu.connectionId)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Supprimer liaison
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
                </div>

                {crossCanvasConnections.length ? (
                  <div className="route-cross-canvas-links" aria-label={`Liaisons inter-canvas ${canvas.name}`}>
                    <strong>Liaisons vers un autre canvas</strong>
                    {crossCanvasConnections.map((connection) => {
                      const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
                      const toRoom = rooms.find((room) => room.id === connection.toRoomId);
                      if (!fromRoom || !toRoom) return null;
                      const localRoom = canvasRoomIds.has(fromRoom.id) ? fromRoom : toRoom;
                      const remoteRoom = localRoom.id === fromRoom.id ? toRoom : fromRoom;
                      const remoteCanvas = canvasDefinitions.find((entry) => entry.id === roomCanvasById.get(remoteRoom.id));
                      const check = connectionChecksById.get(connection.id);
                      return (
                        <button
                          key={`${canvas.id}-${connection.id}`}
                          type="button"
                          className={`route-cross-link status-${check?.status || 'neutral'} ${showSelection && selectedConnectionId === connection.id ? 'selected' : ''}`}
                          onClick={() => selectConnection(connection.id)}
                        >
                          <Link size={13} aria-hidden="true" />
                          <span>{localRoom.name || 'Pièce'} {'->'} {remoteRoom.name || 'Pièce'}</span>
                          <small>{remoteCanvas?.name || 'Autre canvas'}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!isGameplayMode ? (
          <div className="route-map-below-canvas">
            <label className="checkbox-line route-hide-selection">
              <input type="checkbox" checked={hideSelection} onChange={(event) => setHideSelection(event.target.checked)} />
              <EyeOff size={14} aria-hidden="true" />
              Masquer la sélection
            </label>

            <div className="route-mechanic-legend">
              <span><Lock size={13} aria-hidden="true" /> Énigme</span>
              <span><Clapperboard size={13} aria-hidden="true" /> Cinématique</span>
              <span><Brain size={13} aria-hidden="true" /> Logique</span>
            </div>
          </div>
        ) : (
          <div className="route-map-below-canvas">
            <div className="route-test-legend" aria-label="Légende des tests">
              <span className="path">Chemin joué</span>
              <span className="available">Sortie possible</span>
              <span className="blocked">Blocage</span>
            </div>
          </div>
        )}

        {!isGameplayMode && narrativePlan.entries.length ? (
          <div className="route-narrative-strip" aria-label="Résumé narratif">
            <span><strong>{narrativePlan.entries.length}</strong> choix</span>
            <span><strong>{narrativePlan.conditionalEntries.length}</strong> cachés</span>
            <span><strong>{narrativePlan.variableEntries.length}</strong> variables</span>
            <span><strong>{narrativePlan.endingEntries.length}</strong> fins</span>
          </div>
        ) : null}
      </section>

      <section className="panel side route-map-inspector">
        <div className="panel-head">
          <h2>{isGameplayMode ? 'Tests des liens' : 'Détail'}</h2>
        </div>

        {isGameplayMode ? (
          <div className="editor-stack route-gameplay-inspector">
            <div className={`route-selected-connection ${gameplay.reachedEnd ? 'status-ok' : (gameplay.atEndRoom || gameplay.availableMoves.length) ? 'status-partial' : 'status-missing'}`}>
              <strong>{gameplay.activeRoom ? roomLabel(gameplay.activeRoom, project, getSceneLabel) : 'Aucune position'}</strong>
              <span>
                {gameplay.reachedEnd
                  ? 'Le joueur a validé une arrivée.'
                  : gameplay.atEndRoom
                    ? 'Arrivee accessible, mais pas encore validée.'
                    : gameplay.availableMoves.length
                      ? 'Sorties disponibles depuis cette position.'
                      : 'Blocage: aucune sortie jouable.'}
              </span>
            </div>

            {gameplay.reachedEnd ? (
              <div className="route-complete-banner" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>Parcours termine</strong>
                  <span>Toutes les conditions de cette arrivee sont validées.</span>
                </div>
              </div>
            ) : null}

            <div className="route-gameplay-stats">
              <span><strong>{Math.max(0, playerPath.length - 1)}</strong> pas</span>
              <span><strong>{gameplay.reachableRoomIds.size}</strong> atteignables</span>
              <span><strong>{gameplay.blockedMoves.length}</strong> blocages ici</span>
            </div>

            <div className="route-connection-list">
              <strong>Inventaire simule</strong>
              {(gameplay.simulatedItemIds || playerItemIds).map((itemId) => {
                const item = (project.items || []).find((entry) => entry.id === itemId);
                return <span key={itemId}>{item?.name || 'Objet inconnu'}</span>;
              })}
              {!(gameplay.simulatedItemIds || playerItemIds).length ? <span>Aucun objet ramasse.</span> : null}
            </div>

            {gameplay.atEndRoom && gameplay.endValidationIssues.length ? (
              <div className="route-connection-list">
                <strong>Conditions d'arrivee</strong>
                {gameplay.endValidationIssues.map((issue) => (
                  <span key={issue} className="route-connection-status status-missing">
                    <span>{issue}</span>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="route-connection-list">
              <strong>Sorties jouables</strong>
              {gameplay.availableMoves.map((move) => (
                <button key={`${move.connection.id}:${move.toRoom.id}`} type="button" className="route-gameplay-move" onClick={() => movePlayerToRoom(move.toRoom.id)}>
                  <Play size={13} aria-hidden="true" />
                  <span>{roomLabel(move.toRoom, project, getSceneLabel)}</span>
                  <small>{move.mapOnly ? 'Plan - ' : move.indirect ? 'Indirect - ' : ''}{move.locked ? 'Condition - ' : ''}{move.label}{move.condition ? ` - ${move.condition}` : ''}</small>
                </button>
              ))}
              {!gameplay.availableMoves.length ? <span>Aucune sortie jouable dépuis cette pièce.</span> : null}
            </div>

            <div className="route-connection-list">
              <strong>Blocages visibles</strong>
              {gameplay.blockedMoves.map((move) => (
                <span key={`${move.connection.id}:blocked:${move.toRoom.id}`} className="route-connection-status status-missing">
                  <span>{roomLabel(move.toRoom, project, getSceneLabel)} - {move.reason}</span>
                </span>
              ))}
              {!gameplay.blockedMoves.length ? <span>Aucun blocage immediat.</span> : null}
            </div>

            <div className="route-connection-list">
              <strong>Chemin reel</strong>
              {playerPath.map((roomId, index) => {
                const room = rooms.find((entry) => entry.id === roomId);
                return (
                  <span key={`${roomId}:${index}`} className="route-connection-status status-ok">
                    <span>{index + 1}. {room ? roomLabel(room, project, getSceneLabel) : 'Pièce supprimee'}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : selectedConnection ? (() => {
          const fromRoom = rooms.find((room) => room.id === selectedConnection.fromRoomId);
          const toRoom = rooms.find((room) => room.id === selectedConnection.toRoomId);
          const check = connectionChecksById.get(selectedConnection.id);
          return (
            <div className="editor-stack" data-tour="map-connection-detail">
              <div className={`route-selected-connection status-${check?.status || 'neutral'}`}>
                <strong>{fromRoom ? roomLabel(fromRoom, project, getSceneLabel) : 'Pièce supprimee'} {'->'} {toRoom ? roomLabel(toRoom, project, getSceneLabel) : 'Pièce supprimee'}</strong>
                <span>{check?.message || 'Liaison manuelle.'}</span>
              </div>
              <label>
                Nom / action attendue
                <input value={selectedConnection.label || ''} onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                  connection.label = event.target.value;
                })} placeholder="Ex: porte verte, code valide, objet requis..." />
              </label>
              <label>
                Condition
                <textarea
                  value={selectedConnection.condition || ''}
                  placeholder="Condition d'accès, item requis, énigme résolue..."
                  onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                    connection.condition = event.target.value;
                  })}
                />
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={!!selectedConnection.locked} onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                  connection.locked = event.target.checked;
                })} />
                Liaison verrouilléee par condition
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={!!selectedConnection.allowOneWay} onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                  connection.allowOneWay = event.target.checked;
                })} />
                Aller simple valide
              </label>
              <button type="button" className="danger-button" onClick={() => deleteConnection(selectedConnection.id)}>
                <Trash2 size={16} aria-hidden="true" />
                Supprimer la liaison
              </button>
            </div>
          );
        })() : selectedRoom ? (
          <div className="editor-stack" data-tour="map-room-detail">
            <label>
              Nom de la pièce
              <input value={selectedRoom.name || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.name = event.target.value;
              })} />
            </label>
            <label>
              Scène liée
              <select value={selectedRoom.sceneId || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.sceneId = event.target.value;
              })}>
                <option value="">Aucune scène</option>
                {activeActScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                ))}
              </select>
            </label>
            <label>
              Rôle dans le parcours
              <select value={selectedRoom.type || 'room'} onChange={(event) => updateRoom(selectedRoom.id, (room, draftMap) => {
                if (event.target.value === 'start') {
                  draftMap.rooms.forEach((entry) => {
                    if (entry.id !== room.id && entry.type === 'start') entry.type = 'room';
                  });
                }
                room.type = event.target.value;
              })}>
                <option value="room">Pièce normale</option>
                <option value="start">Départ</option>
                <option value="end">Arrivée</option>
              </select>
            </label>

            <div className="inline-actions">
              <button type="button" className={connectFromId === selectedRoom.id ? 'ghost-action' : ''} onClick={() => toggleConnection(selectedRoom.id)}>
                <Link size={16} aria-hidden="true" />
                {connectFromId === selectedRoom.id ? 'Choisis la cible' : 'Relier'}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteRoom(selectedRoom.id)}>
                <Trash2 size={16} aria-hidden="true" />
                Supprimer
              </button>
            </div>

            <label>
              Canvas
              <select value={roomCanvasById.get(selectedRoom.id) || activeCanvas.id} onChange={(event) => {
                const targetCanvasId = event.target.value;
                const currentCanvasId = roomCanvasById.get(selectedRoom.id) || activeCanvas.id;
                if (targetCanvasId !== currentCanvasId && (roomsByCanvasId.get(targetCanvasId)?.length || 0) >= ROUTE_CANVAS_ROOM_LIMIT) {
                  showAlert({
                    title: 'Canvas plein',
                    message: 'Ce canvas contient déjà 15 pièces. Choisis un autre canvas ou ouvre un nouveau canvas.',
                  });
                  return;
                }
                updateRoom(selectedRoom.id, (room) => {
                  room.canvasId = targetCanvasId;
                });
                setActiveCanvasId(targetCanvasId);
              }}>
                {canvasDefinitions.map((canvas) => (
                  <option key={canvas.id} value={canvas.id}>
                    {canvas.name} - {roomsByCanvasId.get(canvas.id)?.length || 0}/{ROUTE_CANVAS_ROOM_LIMIT}
                  </option>
                ))}
              </select>
            </label>

            <div className="route-connection-list">
              <strong>Liaisons</strong>
              {connections.filter((connection) => (
                connection.fromRoomId === selectedRoom.id || connection.toRoomId === selectedRoom.id
              )).map((connection) => {
                const otherRoomId = connection.fromRoomId === selectedRoom.id ? connection.toRoomId : connection.fromRoomId;
                const target = rooms.find((room) => room.id === otherRoomId);
                const check = connectionChecksById.get(connection.id);
                const isAcceptedOneWay = check?.status === 'partial' && connection.allowOneWay;
                return (
                  <span key={connection.id} className={`route-connection-status status-${check?.status || 'neutral'} ${isAcceptedOneWay ? 'accepted' : ''}`}>
                    <span>{connection.fromRoomId === selectedRoom.id ? '→' : '←'} {target ? roomLabel(target, project, getSceneLabel) : 'Pièce supprimée'}</span>
                    {check?.status === 'partial' ? (
                      <button
                        type="button"
                        className={`route-approve-connection ${connection.allowOneWay ? 'active' : ''}`}
                        onClick={() => toggleConnectionOneWayApproval(connection.id)}
                        title={connection.allowOneWay ? 'Remettre en avertissement' : 'Valider cet aller simple'}
                      >
                        {connection.allowOneWay ? 'Validé' : 'Valider'}
                      </button>
                    ) : null}
                    <button type="button" className="danger-button route-delete-connection" onClick={() => deleteConnection(connection.id)} title="Supprimer cette liaison">
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
              {!connections.some((connection) => connection.fromRoomId === selectedRoom.id || connection.toRoomId === selectedRoom.id) ? (
                <span>Aucune liaison pour cette pièce.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state-inline">Sélectionne une pièce pour la nommer, la lier à une scène ou créer une connexion.</div>
        )}

        {isGameplayMode ? (
          <>
            <div className="divider-line" />
            <div className="route-diagnostics" data-tour="map-diagnostics">
              <div className="panel-head">
                <h2>Vérification</h2>
              </div>
              <div className="route-legend">
                <span className="status-missing">Aucune zone</span>
                <span className="status-partial">Un seul sens</span>
                <span className="status-ok">Aller-retour</span>
              </div>
              {diagnostics.problems.length || diagnostics.warnings.length ? (
                <>
                  {diagnostics.problems.map((message) => (
                    <p key={message} className="route-check danger"><XCircle size={15} aria-hidden="true" />{message}</p>
                  ))}
                  {diagnostics.warnings.map((message) => (
                    <p key={message} className="route-check warn"><AlertTriangle size={15} aria-hidden="true" />{message}</p>
                  ))}
                </>
              ) : (
                <p className="route-check ok"><CheckCircle2 size={15} aria-hidden="true" />Toutes les pièces sont connectées depuis le départ.</p>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
