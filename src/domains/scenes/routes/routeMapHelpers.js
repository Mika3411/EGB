import { getSceneTransitions as getProjectSceneTransitions } from '../../../shared/services/projectTransitions';

export const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const ROUTE_CANVAS_ROOM_LIMIT = 15;
export const DEFAULT_ROUTE_CANVAS_ID = 'route_canvas_1';

export const makeDefaultCanvas = (index = 0) => ({
  id: index === 0 ? DEFAULT_ROUTE_CANVAS_ID : `route_canvas_${index + 1}`,
  name: `Canvas ${index + 1}`,
});

export const getDefaultCanvases = () => [makeDefaultCanvas(0)];

const asArray = (value) => (Array.isArray(value) ? value : []);

export const getDefaultMap = () => ({
  rows: 16,
  cols: 24,
  cells: [],
  rooms: [],
  connections: [],
  canvases: getDefaultCanvases(),
  notes: '',
});

export const FIELD_HELP = {
  startType: "Détermine le premier écran du joueur au lancement: une scène jouable ou une cinématique d'introduction.",
  startScene: "Scène ouverte au début du jeu si le démarrage est règle sur une scène.",
  startCinematic: "Cinématique jouee au début du jeu si le démarrage est règle sur une cinématique.",
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const cloneRouteMap = (routeMap = getDefaultMap()) => ({
  rows: routeMap.rows || 16,
  cols: routeMap.cols || 24,
  cells: Array.isArray(routeMap.cells) ? routeMap.cells.map((cell) => ({ ...cell })) : [],
  rooms: Array.isArray(routeMap.rooms) ? routeMap.rooms.map((room) => ({ ...room })) : [],
  connections: Array.isArray(routeMap.connections) ? routeMap.connections.map((connection) => ({ ...connection })) : [],
  canvases: Array.isArray(routeMap.canvases) && routeMap.canvases.length
    ? routeMap.canvases.map((canvas, index) => ({
      id: canvas.id || makeDefaultCanvas(index).id,
      name: canvas.name || makeDefaultCanvas(index).name,
    }))
    : getDefaultCanvases(),
  gameplayState: routeMap.gameplayState ? {
    playerRoomId: routeMap.gameplayState.playerRoomId || '',
    playerPath: Array.isArray(routeMap.gameplayState.playerPath) ? [...routeMap.gameplayState.playerPath] : [],
    playerItemIds: Array.isArray(routeMap.gameplayState.playerItemIds) ? [...routeMap.gameplayState.playerItemIds] : [],
  } : undefined,
  notes: routeMap.notes || '',
});

const getSceneActId = (project, sceneId) => (
  (project.scenes || []).find((scene) => scene.id === sceneId)?.actId || ''
);

export const getRouteMapForAct = (project, routeMap, actId) => {
  const actMap = routeMap?.actMaps?.[actId];
  if (actMap) return cloneRouteMap(actMap);

  const sourceMap = routeMap || getDefaultMap();
  const canvases = Array.isArray(sourceMap.canvases) && sourceMap.canvases.length
    ? sourceMap.canvases.map((canvas, index) => ({
      id: canvas.id || makeDefaultCanvas(index).id,
      name: canvas.name || makeDefaultCanvas(index).name,
    }))
    : getDefaultCanvases();
  const rooms = (sourceMap.rooms || [])
    .filter((room) => room.sceneId && getSceneActId(project, room.sceneId) === actId)
    .map((room) => ({ ...room }));
  const roomIds = new Set(rooms.map((room) => room.id));
  const connections = (sourceMap.connections || [])
    .filter((connection) => roomIds.has(connection.fromRoomId) && roomIds.has(connection.toRoomId))
    .map((connection) => ({ ...connection }));

  return {
    rows: sourceMap.rows || 16,
    cols: sourceMap.cols || 24,
    cells: [],
    rooms,
    connections,
    canvases,
    notes: sourceMap.notes || '',
  };
};

export const roomLabel = (room, project, getSceneLabel) => {
  if (room.sceneId) return getSceneLabel(room.sceneId);
  return room.name || 'Pièce sans nom';
};

export const sameStringArray = (left = [], right = []) => (
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index])
);

const getItemLabel = (project, itemId) => {
  const item = (project.items || []).find((entry) => entry.id === itemId);
  return item ? `${item.icon || ''} ${item.name || 'Objet'}`.trim() : 'Objet';
};

const getNarrativeVariableLabel = (entry = {}) => {
  const operation = entry.storyVariableOperation || 'none';
  if (operation === 'none' || !entry.storyVariableKey) return '';
  if (operation === 'increment') return `${entry.storyVariableKey} +${entry.storyVariableValue || 1}`;
  if (operation === 'decrement') return `${entry.storyVariableKey} -${entry.storyVariableValue || 1}`;
  return `${entry.storyVariableKey} = ${entry.storyVariableValue ?? ''}`;
};

const getNarrativeEffectBadges = (entry = {}, project) => {
  const badges = [];
  const pushBadge = (type, label) => {
    if (!label) return;
    badges.push({ type, label });
  };
  if (entry.rewardItemId) pushBadge('item', `+ ${getItemLabel(project, entry.rewardItemId)}`);
  const variableLabel = getNarrativeVariableLabel(entry);
  if (variableLabel) pushBadge('variable', variableLabel);
  if (entry.responseImageData) pushBadge('media', 'image');
  if (entry.responseSoundData || entry.ambienceSoundData) pushBadge('media', 'son');
  if ((entry.actionType || '') === 'ending') pushBadge('ending', entry.endingTitle || 'fin');
  (entry.effects || []).forEach((effect) => {
    const type = effect.type || 'message';
    if (type === 'message' && effect.message) pushBadge('message', 'message');
    if (type === 'add_item' && effect.itemId) pushBadge('item', `+ ${getItemLabel(project, effect.itemId)}`);
    if (type === 'remove_item' && effect.itemId) pushBadge('item', `- ${getItemLabel(project, effect.itemId)}`);
    if (type === 'set_variable' && effect.variableKey) pushBadge('variable', `${effect.variableKey} = ${effect.value ?? ''}`);
    if (type === 'increment_variable' && effect.variableKey) pushBadge('variable', `${effect.variableKey} +${effect.value || 1}`);
    if (type === 'decrement_variable' && effect.variableKey) pushBadge('variable', `${effect.variableKey} -${effect.value || 1}`);
    if (type === 'journal') pushBadge('journal', effect.journalTitle || 'journal');
    if (type === 'next_node') pushBadge('route', 'question');
    if (type === 'scene') pushBadge('route', 'scène');
    if (type === 'cinematic') pushBadge('media', 'cinématique');
    if (type === 'enigma') pushBadge('route', 'énigme');
    if (type === 'ending') pushBadge('ending', effect.endingTitle || 'fin');
  });
  return badges.slice(0, 6);
};

const getTransitionUiLabel = (transition = {}) => {
  const sourceName = transition.sourceName || 'Zone';
  if (transition.actionKind === 'secondary') return `${sourceName} (2e action)`;
  if (transition.actionKind === 'logic') return `${sourceName} · ${transition.ruleName || 'Règle'}`;
  if (transition.actionKind === 'conversation_reply') return `${sourceName} · ${transition.replyLabel || 'Réponse'}`;
  return sourceName;
};

export const getRouteSceneTransitions = (project) => (
  getProjectSceneTransitions(project, { includeInactiveObjects: true }).map((transition) => ({
    ...transition,
    label: getTransitionUiLabel(transition),
  }))
);

const getUniqueCanvasId = (candidateId, existingIds, fallbackIndex) => {
  let id = candidateId || makeDefaultCanvas(fallbackIndex).id;
  let nextIndex = fallbackIndex;
  while (existingIds.has(id)) {
    nextIndex += 1;
    id = makeDefaultCanvas(nextIndex).id;
  }
  return id;
};

const getUniqueCanvas = (canvases, index) => {
  const canvas = makeDefaultCanvas(index);
  const existingIds = new Set(canvases.map((entry) => entry.id).filter(Boolean));
  const id = getUniqueCanvasId(canvas.id, existingIds, index);
  return { ...canvas, id };
};

const normalizeCanvases = (canvases = []) => {
  const sourceCanvases = asArray(canvases).length ? canvases : getDefaultCanvases();
  const seenIds = new Set();
  return sourceCanvases.map((canvas, index) => {
    const fallback = makeDefaultCanvas(index);
    const id = getUniqueCanvasId(canvas?.id || fallback.id, seenIds, index);
    seenIds.add(id);
    return {
      id,
      name: canvas?.name || fallback.name,
    };
  });
};

const ensureRouteMapShape = (routeMap = {}) => {
  const nextMap = cloneRouteMap(routeMap);
  nextMap.rooms = asArray(nextMap.rooms);
  nextMap.connections = asArray(nextMap.connections);
  nextMap.canvases = normalizeCanvases(nextMap.canvases);
  return nextMap;
};

const getRoomPositionForCanvasCount = (countInCanvas) => ({
  x: clamp(16 + (countInCanvas % 5) * 16, 8, 90),
  y: clamp(18 + Math.floor(countInCanvas / 5) * 20, 10, 86),
});

const getCanvasRoomCounts = (routeMap) => {
  const canvasIds = routeMap.canvases.map((canvas) => canvas.id);
  const canvasCounts = new Map(routeMap.canvases.map((canvas) => [canvas.id, 0]));
  routeMap.rooms.forEach((room, index) => {
    if (!room.canvasId || !canvasCounts.has(room.canvasId)) {
      room.canvasId = canvasIds[Math.min(Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT), canvasIds.length - 1)] || DEFAULT_ROUTE_CANVAS_ID;
    }
    canvasCounts.set(room.canvasId, (canvasCounts.get(room.canvasId) || 0) + 1);
  });
  return canvasCounts;
};

const findCanvasForNewRoom = (routeMap, canvasCounts, preferredCanvasId = DEFAULT_ROUTE_CANVAS_ID) => {
  const preferredCanvas = routeMap.canvases.find((canvas) => canvas.id === preferredCanvasId);
  if (preferredCanvas && (canvasCounts.get(preferredCanvas.id) || 0) < ROUTE_CANVAS_ROOM_LIMIT) {
    return preferredCanvas;
  }
  const availableCanvas = routeMap.canvases.find((canvas) => (
    (canvasCounts.get(canvas.id) || 0) < ROUTE_CANVAS_ROOM_LIMIT
  ));
  if (availableCanvas) return availableCanvas;

  const canvas = getUniqueCanvas(routeMap.canvases, routeMap.canvases.length);
  routeMap.canvases.push(canvas);
  canvasCounts.set(canvas.id, 0);
  return canvas;
};

const getSceneRoomsBySceneId = (rooms = []) => {
  const roomsBySceneId = new Map();
  rooms.forEach((room) => {
    if (!room.sceneId || roomsBySceneId.has(room.sceneId)) return;
    roomsBySceneId.set(room.sceneId, room);
  });
  return roomsBySceneId;
};

const isNonAlwaysCondition = (conditionType = '') => {
  const normalizedCondition = String(conditionType || '').trim();
  return Boolean(normalizedCondition && normalizedCondition !== 'always' && normalizedCondition !== 'none');
};

const hasConditionalLogicRule = (rule = {}) => (
  isNonAlwaysCondition(rule.conditionType)
  || Boolean(rule.requiredItemId || rule.itemId)
  || Boolean(rule.requiredHotspotId || rule.hotspotId)
  || Boolean(rule.conditionEnigmaId)
  || Boolean(rule.conditionCinematicId || rule.cinematicId)
  || Boolean(rule.conditionCombinationId || rule.combinationId)
  || Boolean(rule.conditionReplyId)
  || Boolean(rule.conditionVariableKey)
  || (Array.isArray(rule.advancedConditions) && rule.advancedConditions.length > 0)
);

export const isRouteTransitionLocked = (transition = {}) => (
  Boolean(transition.requiredItemId)
  || Boolean(transition.conditionItemId && isNonAlwaysCondition(transition.conditionType))
  || Boolean(transition.requiredHotspotId || transition.conditionHotspotId)
  || Boolean(transition.enigmaId || transition.conditionEnigmaId)
  || Boolean(transition.conditionCinematicId)
  || Boolean(transition.conditionCombinationId || transition.combinationId)
  || Boolean(transition.conditionReplyId || transition.conditionVariableKey)
  || isNonAlwaysCondition(transition.conditionType)
  || (Array.isArray(transition.advancedConditions) && transition.advancedConditions.length > 0)
  || asArray(transition.interceptRules).some(hasConditionalLogicRule)
);

const getUniqueTransitionLabels = (transitions = []) => {
  const labels = [];
  const seenLabels = new Set();
  transitions.forEach((transition) => {
    const label = String(transition.label || transition.sourceName || '').trim();
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    labels.push(label);
  });
  return labels;
};

const getAutoConnectionLabel = (transitions = []) => {
  const labels = getUniqueTransitionLabels(transitions);
  if (!labels.length) return 'Action détectée';
  if (labels.length <= 2) return labels.join(' / ');
  return `${labels[0]} / ${labels[1]} +${labels.length - 2}`;
};

const getItemName = (project, itemId) => (
  asArray(project.items).find((item) => item.id === itemId)?.name || ''
);

const getEnigmaName = (project, enigmaId) => (
  asArray(project.enigmas).find((enigma) => enigma.id === enigmaId)?.name || ''
);

const getCinematicName = (project, cinematicId) => (
  asArray(project.cinematics).find((cinematic) => cinematic.id === cinematicId)?.name || ''
);

const getReadableConditionLabel = (project, transition = {}) => {
  const itemName = getItemName(project, transition.requiredItemId || transition.conditionItemId);
  if (itemName) return `Objet requis: ${itemName}`;

  const enigmaName = getEnigmaName(project, transition.conditionEnigmaId || transition.enigmaId);
  if (enigmaName) return `Énigme: ${enigmaName}`;

  const cinematicName = getCinematicName(project, transition.conditionCinematicId);
  if (cinematicName) return `Cinématique: ${cinematicName}`;

  if (transition.requiredHotspotId || transition.conditionHotspotId) return 'Action requise avant cette liaison';
  if (transition.conditionCombinationId || transition.combinationId) return 'Combinaison requise';
  if (transition.conditionReplyId) return 'Réponse précédente requise';
  if (transition.conditionVariableKey) return `Variable: ${transition.conditionVariableKey}`;
  if (transition.actionKind === 'logic' && isNonAlwaysCondition(transition.conditionType)) return transition.ruleName || 'Règle logique';
  if (asArray(transition.interceptRules).some(hasConditionalLogicRule)) return 'Règle logique';
  if (isNonAlwaysCondition(transition.conditionType)) return 'Condition de jeu';
  return '';
};

const getAutoConnectionCondition = (project, transitions = []) => {
  const labels = [];
  const seenLabels = new Set();
  transitions.forEach((transition) => {
    if (!isRouteTransitionLocked(transition)) return;
    const label = getReadableConditionLabel(project, transition);
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    labels.push(label);
  });
  if (labels.length <= 2) return labels.join(' / ');
  return `${labels[0]} / ${labels[1]} +${labels.length - 2}`;
};

const getPreferredStartSceneId = (project, actScenes = []) => {
  const configuredSceneId = project.start?.targetSceneId || '';
  if (configuredSceneId && actScenes.some((scene) => scene.id === configuredSceneId)) return configuredSceneId;
  return actScenes[0]?.id || '';
};

const applySingleStartRoom = (routeMap, roomsBySceneId, startSceneId) => {
  const startRoom = roomsBySceneId.get(startSceneId);
  if (!startRoom) return;
  routeMap.rooms.forEach((room) => {
    if (room.id === startRoom.id) {
      room.type = 'start';
      return;
    }
    if (room.type === 'start') room.type = 'room';
  });
};

const END_SCENE_NAME_PATTERN = /(fin|final|epilogue|épilogue|sortie|victoire|défaite|defaite|conclusion|end)/i;

const findEndSceneId = (actScenes = [], transitions = []) => {
  if (!actScenes.length) return '';
  const outgoingSceneIds = new Set(transitions.map((transition) => transition.fromSceneId).filter(Boolean));
  const incomingSceneIds = new Set(transitions.map((transition) => transition.toSceneId).filter(Boolean));
  const candidates = actScenes.filter((scene) => !outgoingSceneIds.has(scene.id));
  const namedEnd = candidates.find((scene) => END_SCENE_NAME_PATTERN.test(`${scene.name || ''} ${scene.title || ''}`));
  if (namedEnd) return namedEnd.id;
  const reachedDeadEnd = candidates.find((scene) => incomingSceneIds.has(scene.id));
  if (reachedDeadEnd) return reachedDeadEnd.id;
  return candidates[candidates.length - 1]?.id || '';
};

const applyEndRoomIfMissing = (routeMap, roomsBySceneId, endSceneId) => {
  if (!endSceneId || routeMap.rooms.some((room) => room.type === 'end')) return;
  const endRoom = roomsBySceneId.get(endSceneId);
  if (!endRoom || endRoom.type === 'start') return;
  if (endRoom.type && endRoom.type !== 'room') return;
  endRoom.type = 'end';
};

const getDirectedConnectionKey = (fromRoomId, toRoomId) => `${fromRoomId}->${toRoomId}`;

const getAutoConnectionDuplicateKey = (connection = {}) => [
  connection.fromRoomId || '',
  connection.toRoomId || '',
  connection.label || '',
  connection.condition || '',
  connection.locked ? 'locked' : 'open',
  connection.allowOneWay ? 'one-way' : 'two-way',
].join('|');

const removeDuplicateAutoConnections = (routeMap) => {
  const seenAutoConnectionKeys = new Set();
  routeMap.connections = asArray(routeMap.connections).filter((connection) => {
    if (!connection.autoGenerated) return true;
    const duplicateKey = getAutoConnectionDuplicateKey(connection);
    if (seenAutoConnectionKeys.has(duplicateKey)) return false;
    seenAutoConnectionKeys.add(duplicateKey);
    return true;
  });
};

export const synchronizeRouteMapFromProject = ({
  project = {},
  routeMap = getDefaultMap(),
  actId = '',
  getSceneLabel = (sceneId) => sceneId,
  activeCanvasId = DEFAULT_ROUTE_CANVAS_ID,
  idFactory = makeId,
} = {}) => {
  const nextMap = ensureRouteMapShape(routeMap);
  const actScenes = asArray(project.scenes).filter((scene) => scene.actId === actId);
  const sceneIdsInAct = new Set(actScenes.map((scene) => scene.id));
  const canvasCounts = getCanvasRoomCounts(nextMap);
  const roomsBySceneId = getSceneRoomsBySceneId(nextMap.rooms);
  removeDuplicateAutoConnections(nextMap);
  const summary = {
    addedRooms: 0,
    addedConnections: 0,
    lockedConnections: 0,
    firstAddedRoomId: '',
    firstAddedCanvasId: '',
  };

  actScenes.forEach((scene) => {
    if (roomsBySceneId.has(scene.id)) return;
    const targetCanvas = findCanvasForNewRoom(nextMap, canvasCounts, summary.firstAddedCanvasId || activeCanvasId);
    const countInCanvas = canvasCounts.get(targetCanvas.id) || 0;
    const position = getRoomPositionForCanvasCount(countInCanvas);
    const room = {
      id: idFactory('room'),
      name: scene.name || getSceneLabel(scene.id) || `Pièce ${nextMap.rooms.length + 1}`,
      sceneId: scene.id,
      canvasId: targetCanvas.id,
      x: position.x,
      y: position.y,
      type: 'room',
    };
    nextMap.rooms.push(room);
    roomsBySceneId.set(scene.id, room);
    canvasCounts.set(targetCanvas.id, countInCanvas + 1);
    summary.addedRooms += 1;
    if (!summary.firstAddedRoomId) summary.firstAddedRoomId = room.id;
    if (!summary.firstAddedCanvasId) summary.firstAddedCanvasId = targetCanvas.id;
  });

  const transitions = getRouteSceneTransitions(project);
  const actTransitions = transitions.filter((transition) => (
    sceneIdsInAct.has(transition.fromSceneId) && sceneIdsInAct.has(transition.toSceneId)
  ));
  const existingConnectionKeys = new Set(asArray(nextMap.connections).map((connection) => (
    getDirectedConnectionKey(connection.fromRoomId, connection.toRoomId)
  )));
  const groupedTransitions = new Map();

  actTransitions.forEach((transition) => {
    const fromRoom = roomsBySceneId.get(transition.fromSceneId);
    const toRoom = roomsBySceneId.get(transition.toSceneId);
    if (!fromRoom || !toRoom || fromRoom.id === toRoom.id) return;
    const key = getDirectedConnectionKey(fromRoom.id, toRoom.id);
    if (existingConnectionKeys.has(key)) return;
    if (!groupedTransitions.has(key)) {
      groupedTransitions.set(key, { fromRoom, toRoom, transitions: [] });
    }
    groupedTransitions.get(key).transitions.push(transition);
  });

  groupedTransitions.forEach(({ fromRoom, toRoom, transitions: pairTransitions }, key) => {
    const reverseTransitionExists = actTransitions.some((transition) => (
      transition.fromSceneId === toRoom.sceneId && transition.toSceneId === fromRoom.sceneId
    ));
    const locked = pairTransitions.some(isRouteTransitionLocked);
    nextMap.connections.push({
      id: idFactory('connection'),
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      label: getAutoConnectionLabel(pairTransitions),
      condition: getAutoConnectionCondition(project, pairTransitions),
      locked,
      allowOneWay: !reverseTransitionExists,
      autoGenerated: true,
    });
    existingConnectionKeys.add(key);
    summary.addedConnections += 1;
    if (locked) summary.lockedConnections += 1;
  });

  const startSceneId = getPreferredStartSceneId(project, actScenes);
  applySingleStartRoom(nextMap, roomsBySceneId, startSceneId);
  applyEndRoomIfMissing(nextMap, roomsBySceneId, findEndSceneId(actScenes, transitions));

  return {
    routeMap: nextMap,
    ...summary,
  };
};

export const getConnectionNarrativeBadges = (project, fromRoom, toRoom) => {
  if (!fromRoom?.sceneId || !toRoom?.sceneId) return [];
  const transitions = getRouteSceneTransitions(project).filter((transition) => (
    transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId
  ));
  const badges = transitions.flatMap((transition) => getNarrativeEffectBadges(transition, project));
  const unique = [];
  const seen = new Set();
  badges.forEach((badge) => {
    const key = `${badge.type}:${badge.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(badge);
  });
  return unique.slice(0, 4);
};

export const getNarrativePlan = (project, actId, getSceneLabel) => {
  const scenes = (project.scenes || []).filter((scene) => scene.actId === actId);
  const entries = scenes.flatMap((scene) => (
    (scene.hotspots || []).filter((hotspot) => hotspot.actionType === 'conversation').flatMap((hotspot) => (
      (hotspot.conversation?.nodes || []).flatMap((node) => (
        (node.replies || []).map((reply) => ({
          id: `${scene.id}:${hotspot.id}:${node.id}:${reply.id}`,
          sceneId: scene.id,
          sceneName: getSceneLabel(scene.id),
          sourceName: hotspot.name || 'Conversation',
          speaker: node.speaker || 'PNJ',
          question: node.text || '',
          replyLabel: reply.label || 'Réponse',
          ...reply,
        }))
      ))
    ))
  ));
  return {
    entries,
    endingEntries: entries.filter((entry) => (
      (entry.actionType || '') === 'ending'
      || (entry.effects || []).some((effect) => (effect.type || '') === 'ending')
    )),
    conditionalEntries: entries.filter((entry) => (entry.conditionType || 'none') !== 'none'),
    variableEntries: entries.filter((entry) => (
      ((entry.storyVariableOperation || 'none') !== 'none' && entry.storyVariableKey)
      || (entry.effects || []).some((effect) => ['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || '') && effect.variableKey)
    )),
  };
};
