import { getSceneTransitions as getProjectSceneTransitions } from '../lib/projectTransitions';

export const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const ROUTE_CANVAS_ROOM_LIMIT = 15;
export const DEFAULT_ROUTE_CANVAS_ID = 'route_canvas_1';

const makeDefaultCanvas = (index = 0) => ({
  id: index === 0 ? DEFAULT_ROUTE_CANVAS_ID : `route_canvas_${index + 1}`,
  name: `Canvas ${index + 1}`,
});

const getDefaultCanvases = () => [makeDefaultCanvas(0)];

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
