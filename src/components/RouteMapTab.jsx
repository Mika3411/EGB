import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Brain, CheckCircle2, Clapperboard, DoorOpen, ExternalLink, EyeOff, Gamepad2, Link, Lock, MapPin, Maximize2, Minimize2, MousePointerClick, Pencil, Play, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const getDefaultMap = () => ({ rows: 16, cols: 24, cells: [], rooms: [], connections: [], notes: '' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const cloneRouteMap = (routeMap = getDefaultMap()) => ({
  rows: routeMap.rows || 16,
  cols: routeMap.cols || 24,
  cells: Array.isArray(routeMap.cells) ? routeMap.cells.map((cell) => ({ ...cell })) : [],
  rooms: Array.isArray(routeMap.rooms) ? routeMap.rooms.map((room) => ({ ...room })) : [],
  connections: Array.isArray(routeMap.connections) ? routeMap.connections.map((connection) => ({ ...connection })) : [],
  notes: routeMap.notes || '',
});

const getSceneActId = (project, sceneId) => (
  (project.scenes || []).find((scene) => scene.id === sceneId)?.actId || ''
);

const getRouteMapForAct = (project, routeMap, actId) => {
  const actMap = routeMap?.actMaps?.[actId];
  if (actMap) return cloneRouteMap(actMap);

  const sourceMap = routeMap || getDefaultMap();
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
    notes: sourceMap.notes || '',
  };
};

const roomLabel = (room, project, getSceneLabel) => {
  if (room.sceneId) return getSceneLabel(room.sceneId);
  return room.name || 'Piece sans nom';
};

const getActStartSceneId = (project, actId) => {
  const actScenes = (project.scenes || []).filter((scene) => scene.actId === actId);
  return actScenes.find((scene) => !scene.parentSceneId)?.id || actScenes[0]?.id || '';
};

const getCinematicTargetSceneIds = (project, cinematicId) => {
  const cinematic = (project.cinematics || []).find((entry) => entry.id === cinematicId);
  if (!cinematic) return [];
  if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) return [cinematic.targetSceneId];
  if (cinematic.onEndType === 'act' && cinematic.targetActId) {
    const targetSceneId = getActStartSceneId(project, cinematic.targetActId);
    return targetSceneId ? [targetSceneId] : [];
  }
  return [];
};

const getEnigmaTargetSceneIds = (project, enigmaId) => {
  const enigma = (project.enigmas || []).find((entry) => entry.id === enigmaId);
  if (!enigma) return [];
  if (enigma.unlockType === 'scene' && enigma.targetSceneId) return [enigma.targetSceneId];
  if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
    return getCinematicTargetSceneIds(project, enigma.targetCinematicId);
  }
  return [];
};

const getActionTargetSceneIds = (project, action) => {
  if (!action) return [];
  if (action.enigmaId) {
    const enigmaTargets = getEnigmaTargetSceneIds(project, action.enigmaId);
    if (enigmaTargets.length) return enigmaTargets;
  }
  if (action.actionType === 'scene' && action.targetSceneId) return [action.targetSceneId];
  if (action.actionType === 'cinematic' && action.targetCinematicId) {
    return getCinematicTargetSceneIds(project, action.targetCinematicId);
  }
  return [];
};

const getSceneTransitions = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || []).flatMap((hotspot) => {
      const actions = [
        {
          label: hotspot.name || 'Zone',
          actionType: hotspot.actionType,
          targetSceneId: hotspot.targetSceneId,
          targetCinematicId: hotspot.targetCinematicId,
          enigmaId: hotspot.enigmaId,
          requiredItemId: hotspot.requiredItemId,
        },
        hotspot.hasSecondAction ? {
          label: `${hotspot.name || 'Zone'} (2e action)`,
          actionType: hotspot.secondActionType,
          targetSceneId: hotspot.secondTargetSceneId,
          targetCinematicId: hotspot.secondTargetCinematicId,
          enigmaId: hotspot.secondEnigmaId,
          requiredItemId: hotspot.secondRequiredItemId,
        } : null,
        ...(hotspot.logicRules || []).map((rule) => (
          rule.actionType === 'default'
            ? {
              label: `${hotspot.name || 'Zone'} · ${rule.name || 'Règle'}`,
              actionType: hotspot.actionType,
              targetSceneId: hotspot.targetSceneId,
              targetCinematicId: hotspot.targetCinematicId,
              enigmaId: hotspot.enigmaId,
              requiredItemId: rule.itemId || hotspot.requiredItemId,
            }
            : {
              label: `${hotspot.name || 'Zone'} · ${rule.name || 'Règle'}`,
              actionType: rule.actionType,
              targetSceneId: rule.targetSceneId,
              targetCinematicId: rule.targetCinematicId,
              enigmaId: rule.enigmaId,
              requiredItemId: rule.itemId,
            }
        )),
      ].filter(Boolean);

      return actions.flatMap((action) => (
        getActionTargetSceneIds(project, action)
          .filter((targetSceneId) => targetSceneId && targetSceneId !== scene.id)
          .map((targetSceneId) => ({
            fromSceneId: scene.id,
            toSceneId: targetSceneId,
            label: action.label,
            actionType: action.actionType,
            enigmaId: action.enigmaId,
            targetCinematicId: action.targetCinematicId,
            requiredItemId: action.requiredItemId,
          }))
      ));
    })
  ))
);

const getSceneMechanics = (project, sceneId) => {
  const scene = (project.scenes || []).find((entry) => entry.id === sceneId);
  if (!scene) return { enigma: false, cinematic: false, logic: false };
  return (scene.hotspots || []).reduce((flags, hotspot) => {
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
      message: 'Lie les deux pieces à des scenes pour vérifier les zones d’action.',
    };
  }

  const transitions = getSceneTransitions(project);
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
    message: `${fromLabel} ↔ ${toLabel}: aucune zone d’action ne relie ces deux pieces.`,
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

  if (!rooms.length) problems.push('Aucune piece créée dans le plan.');

  const starts = rooms.filter((room) => room.type === 'start');
  const ends = rooms.filter((room) => room.type === 'end');
  if (starts.length !== 1) problems.push(starts.length ? 'Le plan doit avoir un seul départ.' : 'Ajoute une piece de départ.');
  if (ends.length !== 1) warnings.push(ends.length ? 'Le plan a plusieurs arrivées.' : 'Ajoute une arrivée si le parcours à une fin prévue.');

  rooms.forEach((room) => {
    const degree = connections.filter((connection) => (
      connection.fromRoomId === room.id || connection.toRoomId === room.id
    )).length;
    if (!degree && rooms.length > 1) problems.push(`${roomLabel(room, project, getSceneLabel)} n’est reliée à aucune autre piece.`);
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
      if (!visited.has(room.id)) problems.push(`${roomLabel(room, project, getSceneLabel)} est inaccessible depuis le départ.`);
    });
  }

  const roomsByScene = new Map(rooms.filter((room) => room.sceneId).map((room) => [room.sceneId, room]));
  const mapScenePairs = new Set(connections.map((connection) => {
    const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
    const toRoom = rooms.find((room) => room.id === connection.toRoomId);
    if (!fromRoom?.sceneId || !toRoom?.sceneId) return '';
    return scenePairKey(fromRoom.sceneId, toRoom.sceneId);
  }).filter(Boolean));
  const sceneTransitions = getSceneTransitions(project);

  sceneTransitions.forEach((transition) => {
    if (!roomsByScene.has(transition.fromSceneId) || !roomsByScene.has(transition.toSceneId)) return;
    if (!mapScenePairs.has(scenePairKey(transition.fromSceneId, transition.toSceneId))) {
      pushUnique(warnings, `Une transition du jeu relie ${getSceneLabel(transition.fromSceneId)} et ${getSceneLabel(transition.toSceneId)}, mais cette liaison manque sur le plan.`);
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

const findScenePath = (project, fromSceneId, toSceneId) => {
  if (!fromSceneId || !toSceneId) return null;
  if (fromSceneId === toSceneId) return [];
  const transitions = getSceneTransitions(project);
  const visited = new Set([fromSceneId]);
  const queue = [{ sceneId: fromSceneId, path: [] }];

  while (queue.length) {
    const current = queue.shift();
    const nextTransitions = transitions.filter((transition) => transition.fromSceneId === current.sceneId);
    for (const transition of nextTransitions) {
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
  return (scene.hotspots || []).flatMap((hotspot) => [
    hotspot.rewardItemId,
    hotspot.secondRewardItemId,
    ...(hotspot.logicRules || []).map((rule) => rule.rewardItemId),
  ]).filter(Boolean);
};

const getRoomRewardItemIds = (project, room) => (
  room?.sceneId ? getSceneRewardItemIds(project, room.sceneId) : []
);

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

const buildGameplayState = (project, routeMap, currentRoomId, playerPath, playerItemIds, getSceneLabel) => {
  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const transitions = getSceneTransitions(project);
  const startRoom = rooms.find((room) => room.type === 'start') || rooms[0] || null;
  const activeRoom = rooms.find((room) => room.id === currentRoomId) || startRoom;
  const visitedRoomIds = new Set((playerPath || []).filter(Boolean));
  if (activeRoom?.id) visitedRoomIds.add(activeRoom.id);

  const getMoveForConnection = (connection, fromRoomId) => {
    const fromRoom = rooms.find((room) => room.id === fromRoomId);
    const toRoomId = connection.fromRoomId === fromRoomId
      ? connection.toRoomId
      : connection.toRoomId === fromRoomId
        ? connection.fromRoomId
        : '';
    const toRoom = rooms.find((room) => room.id === toRoomId);
    if (!fromRoom || !toRoom) return null;
    const directTransition = fromRoom.sceneId && toRoom.sceneId
      ? getTransitionBetweenScenes(transitions, fromRoom.sceneId, toRoom.sceneId)
      : null;
    const reverseTransition = fromRoom.sceneId && toRoom.sceneId
      ? getTransitionBetweenScenes(transitions, toRoom.sceneId, fromRoom.sceneId)
      : null;
    const directLabel = directTransition?.label || '';
    const indirectPath = !directLabel && fromRoom.sceneId && toRoom.sceneId
      ? findScenePath(project, fromRoom.sceneId, toRoom.sceneId)
      : null;
    const hasTransition = Boolean(directLabel || indirectPath?.length);
    const indirectLabel = indirectPath?.length
      ? `Chemin indirect via ${indirectPath.map((transition) => transition.label).filter(Boolean).slice(0, 2).join(' + ') || 'actions du jeu'}`
      : '';
    const isLocked = Boolean(connection.locked);
    const missingScene = !fromRoom.sceneId || !toRoom.sceneId;
    const transitionRequiredItemId = directTransition?.requiredItemId
      || reverseTransition?.requiredItemId
      || indirectPath?.find((transition) => transition.requiredItemId)?.requiredItemId
      || '';
    const transitionRequiredItem = transitionRequiredItemId
      ? (project.items || []).find((item) => item.id === transitionRequiredItemId)
      : null;
    const requiredItem = getRequiredItemForConnection(project, connection) || transitionRequiredItem;
    const hasCondition = Boolean(isLocked || String(connection.condition || '').trim() || transitionRequiredItemId);
    const needsMissingItem = Boolean(hasCondition && requiredItem && !playerItemIds.includes(requiredItem.id));
    const needsManualCondition = Boolean(hasCondition && !requiredItem);
    const reason = needsMissingItem
      ? `Objet requis: ${requiredItem.name}`
      : needsManualCondition
        ? (connection.condition || 'Condition non resolue')
        : '';
    const mapOnlyLabel = !hasTransition
      ? `Liaison plan - action ${getSceneLabel(fromRoom.sceneId)} -> ${getSceneLabel(toRoom.sceneId)} non detectee`
      : '';
    return {
      connection,
      fromRoom,
      toRoom,
      label: directLabel || indirectLabel || connection.label || connection.condition || mapOnlyLabel || 'Liaison',
      condition: connection.condition || '',
      requiredItem,
      indirect: Boolean(indirectPath?.length && !directLabel),
      mapOnly: !hasTransition && !missingScene,
      locked: isLocked,
      blocked: needsMissingItem || needsManualCondition,
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

  return {
    activeRoom,
    startRoom,
    availableMoves,
    blockedMoves,
    visitedRoomIds,
    reachableRoomIds,
    pathConnectionIds,
    deadEndRoomIds,
    reachedEnd: Boolean(activeRoom?.type === 'end'),
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
  const [hideSelection, setHideSelection] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerRoomId, setPlayerRoomId] = useState('');
  const [playerPath, setPlayerPath] = useState([]);
  const [playerItemIds, setPlayerItemIds] = useState([]);
  const dragRef = useRef(null);

  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) || null;
  const diagnostics = useMemo(() => buildDiagnostics(project, routeMap, getSceneLabel), [project, routeMap, getSceneLabel]);
  const connectionChecksById = useMemo(() => (
    new Map((diagnostics.connectionChecks || []).map((check) => [check.connectionId, check]))
  ), [diagnostics.connectionChecks]);
  const gameplay = useMemo(
    () => buildGameplayState(project, routeMap, playerRoomId, playerPath, playerItemIds, getSceneLabel),
    [project, routeMap, playerRoomId, playerPath, playerItemIds, getSceneLabel]
  );
  const isGameplayMode = mapMode === 'gameplay';
  const showSelection = !hideSelection;

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
    if (!gameplay.startRoom) {
      setPlayerRoomId('');
      setPlayerPath([]);
      return;
    }
    if (playerRoomId && rooms.some((room) => room.id === playerRoomId)) return;
    setPlayerRoomId(gameplay.startRoom.id);
    setPlayerPath([gameplay.startRoom.id]);
    setPlayerItemIds(getRoomRewardItemIds(project, gameplay.startRoom));
  }, [gameplay.startRoom, playerRoomId, rooms]);

  useEffect(() => {
    if (!gameplay.activeRoom) return;
    const rewardItemIds = getRoomRewardItemIds(project, gameplay.activeRoom);
    if (!rewardItemIds.some((itemId) => !playerItemIds.includes(itemId))) return;
    setPlayerItemIds((itemIds) => [...new Set([...itemIds, ...rewardItemIds])]);
  }, [gameplay.activeRoom, playerItemIds, project]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const patchRouteMap = (updater, options) => {
    patchProject((draft) => {
      if (!draft.routeMap) draft.routeMap = getDefaultMap();
      if (!draft.routeMap.actMaps || typeof draft.routeMap.actMaps !== 'object') draft.routeMap.actMaps = {};
      if (!draft.routeMap.actMaps[activeActId]) {
        draft.routeMap.actMaps[activeActId] = getRouteMapForAct(draft, draft.routeMap, activeActId);
      }
      if (!Array.isArray(draft.routeMap.actMaps[activeActId].rooms)) draft.routeMap.actMaps[activeActId].rooms = [];
      if (!Array.isArray(draft.routeMap.actMaps[activeActId].connections)) draft.routeMap.actMaps[activeActId].connections = [];
      updater(draft.routeMap.actMaps[activeActId]);
    }, options);
  };

  const addRoom = (sceneId = '', position = {}) => {
    const room = {
      id: makeId('room'),
      name: sceneId ? getSceneLabel(sceneId) : `Piece ${rooms.length + 1}`,
      sceneId,
      x: clamp(position.x ?? 18 + rooms.length * 9, 8, 86),
      y: clamp(position.y ?? 20 + rooms.length * 7, 10, 84),
      type: rooms.some((entry) => entry.type === 'start') ? 'room' : 'start',
    };
    patchRouteMap((draftMap) => {
      draftMap.rooms.push(room);
    });
    setSelectedRoomId(room.id);
    setSelectedConnectionId('');
  };

  const duplicateRoom = (roomId) => {
    const sourceRoom = rooms.find((room) => room.id === roomId);
    if (!sourceRoom) return;
    const room = {
      ...sourceRoom,
      id: makeId('room'),
      name: `${sourceRoom.name || 'Piece'} copie`,
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
    patchRouteMap((draftMap) => {
      scenesToAdd.forEach((scene, index) => {
        draftMap.rooms.push({
          id: makeId('room'),
          name: scene.name || `Piece ${draftMap.rooms.length + 1}`,
          sceneId: scene.id,
          x: clamp(16 + (index % 5) * 16, 8, 90),
          y: clamp(18 + Math.floor(index / 5) * 18, 10, 86),
          type: draftMap.rooms.some((room) => room.type === 'start') ? 'room' : 'start',
        });
      });
    });
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

  const deleteRoom = (roomId) => {
    const room = rooms.find((entry) => entry.id === roomId);
    if (!window.confirm(`Supprimer la piece "${room?.name || 'selectionnée'}" et ses liaisons ?`)) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = draftMap.rooms.filter((room) => room.id !== roomId);
      draftMap.connections = draftMap.connections.filter((connection) => (
        connection.fromRoomId !== roomId && connection.toRoomId !== roomId
      ));
    });
    setSelectedRoomId('');
    setConnectFromId('');
  };

  const deleteConnection = (connectionId) => {
    if (!window.confirm('Supprimer cette liaison ?')) return;
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

  const clearMap = () => {
    if (!window.confirm('Effacer le plan de cet acte ?')) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = [];
      draftMap.connections = [];
    });
    setSelectedRoomId('');
    setConnectFromId('');
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
    setPlayerRoomId(startRoomId);
    setPlayerPath(startRoomId ? [startRoomId] : []);
    setPlayerItemIds(startRoom ? getRoomRewardItemIds(project, startRoom) : []);
  };

  const movePlayerToRoom = (roomId) => {
    const move = gameplay.availableMoves.find((entry) => entry.toRoom.id === roomId);
    if (!move) return;
    setPlayerRoomId(roomId);
    const targetRoom = rooms.find((room) => room.id === roomId);
    const rewardItemIds = getRoomRewardItemIds(project, targetRoom);
    if (rewardItemIds.length) {
      setPlayerItemIds((itemIds) => [...new Set([...itemIds, ...rewardItemIds])]);
    }
    setPlayerPath((path) => {
      const basePath = path.length ? path : (gameplay.activeRoom?.id ? [gameplay.activeRoom.id] : []);
      return [...basePath, roomId];
    });
    setSelectedRoomId(roomId);
    setSelectedConnectionId('');
  };

  return (
    <div className="layout route-map-layout">
      <section className="panel side route-map-tools">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Plan</span>
            <h2>Pieces</h2>
          </div>
          <span className={`status-badge ${diagnostics.ok ? '' : 'soft'}`}>{diagnostics.ok ? 'OK' : `${diagnostics.problems.length} souci(s)`}</span>
        </div>

        <label>
          Acte
          <select value={activeActId} onChange={(event) => {
            setSelectedActId(event.target.value);
            setSelectedRoomId('');
            setConnectFromId('');
            setPlayerRoomId('');
            setPlayerPath([]);
            setPlayerItemIds([]);
          }}>
            {acts.map((act) => (
              <option key={act.id} value={act.id}>{act.name}</option>
            ))}
          </select>
        </label>

        <div className="route-mode-switch" role="group" aria-label="Mode carte">
          <button type="button" className={mapMode === 'edit' ? 'active' : ''} onClick={() => setMapMode('edit')}>
            <Pencil size={15} aria-hidden="true" />
            Edition
          </button>
          <button type="button" className={mapMode === 'gameplay' ? 'active' : ''} onClick={() => {
            setMapMode('gameplay');
            if (!playerRoomId) resetGameplay();
          }}>
            <Gamepad2 size={15} aria-hidden="true" />
            Parcours joueur
          </button>
        </div>

        {isGameplayMode ? (
          <div className="route-gameplay-card">
            <strong>{gameplay.activeRoom ? roomLabel(gameplay.activeRoom, project, getSceneLabel) : 'Aucun depart'}</strong>
            <span>{gameplay.reachedEnd ? 'Arrivee atteinte' : `${gameplay.availableMoves.length} sortie(s) jouable(s)`}</span>
            <p>Clique une sortie bleue dans Detail, un node voisin sur la carte, ou une piece marquee dans la liste pour avancer.</p>
            <div className="inline-actions">
              <button type="button" onClick={resetGameplay}>
                <RotateCcw size={15} aria-hidden="true" />
                Rejouer
              </button>
            </div>
          </div>
        ) : null}

        {!isGameplayMode ? <div className="inline-actions" data-tour="map-add-room">
          <button type="button" onClick={() => addRoom()}>
            <Plus size={16} aria-hidden="true" />
            Piece
          </button>
          <button type="button" className="secondary-action" onClick={addMissingSceneRooms}>
            <DoorOpen size={16} aria-hidden="true" />
            Depuis scenes
          </button>
        </div> : null}

        <p className="small-note">{isGameplayMode ? 'Astuce: les sorties jouables sont des boutons. Clique dessus pour faire avancer le joueur.' : 'Double-clic pour ouvrir une scene, glisse les pieces, clique une liaison pour sa condition, clic droit pour les actions rapides.'}</p>

        <div className="route-room-list">
          {rooms.map((room) => {
            const isCurrentPlayerRoom = gameplay.activeRoom?.id === room.id;
            const isNextPlayerRoom = gameplay.availableMoves.some((move) => move.toRoom.id === room.id);
            return (
            <button
              key={room.id}
              type="button"
              className={`list-card ${showSelection && selectedRoomId === room.id ? 'selected' : ''} ${isGameplayMode && isCurrentPlayerRoom ? 'gameplay-current' : ''} ${isGameplayMode && isNextPlayerRoom ? 'gameplay-next' : ''}`}
              onClick={() => {
                if (isGameplayMode) {
                  movePlayerToRoom(room.id);
                  return;
                }
                setSelectedRoomId(room.id);
              }}
              title={isGameplayMode ? (isNextPlayerRoom ? 'Aller vers cette piece' : isCurrentPlayerRoom ? 'Position actuelle' : 'Piece non voisine') : ''}
            >
              <strong>{isGameplayMode && isCurrentPlayerRoom ? 'Position - ' : isGameplayMode && isNextPlayerRoom ? 'Cliquer - ' : ''}{room.name || 'Piece'}</strong>
              <span>{room.sceneId ? getSceneLabel(room.sceneId) : 'Aucune scene liée'}</span>
            </button>
            );
          })}
          {!rooms.length ? <div className="empty-state-inline">Ajoute les pieces du parcours.</div> : null}
        </div>

        <label>
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
      </section>

      <section className={`panel main route-map-main ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="panel-head">
          <div>
            <span className="section-kicker">Connexions</span>
            <h2>Carte des pieces</h2>
          </div>
          <div className="route-map-head-actions">
            <span className="small-note">{connections.length} liaison{connections.length > 1 ? 's' : ''}</span>
            <button type="button" className="icon-button route-fullscreen-button" onClick={() => setIsFullscreen((value) => !value)} title={isFullscreen ? 'Quitter le plein ecran' : 'Mode plein ecran'}>
              {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div
          className={`route-room-board ${isGameplayMode ? 'gameplay-mode' : ''}`}
          data-tour="map-board"
          onClick={() => setContextMenu(null)}
          onContextMenu={(event) => {
            if (isGameplayMode) {
              event.preventDefault();
              return;
            }
            openContextMenu(event, { kind: 'board' });
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
            {connections.map((connection) => {
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
                      openContextMenu(event, { kind: 'connection', connectionId: connection.id });
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {rooms.map((room) => {
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
              className={`route-room-node type-${room.type || 'room'} ${showSelection && selectedRoomId === room.id ? 'selected' : ''} ${showSelection && connectFromId === room.id ? 'connecting' : ''} ${roomGameplayClass}`}
              style={{ left: `${room.x}%`, top: `${room.y}%` }}
              onClick={(event) => {
                event.stopPropagation();
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
                openContextMenu(event, { kind: 'room', roomId: room.id });
              }}
              title={isGameplayMode ? 'Mode parcours joueur' : room.sceneId ? 'Double-clic: ouvrir la scene' : 'Piece sans scene liee'}
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{room.name || 'Piece'}</span>
              {(mechanics.enigma || mechanics.cinematic || mechanics.logic) ? (
                <span className="route-node-badges" aria-label="Mecaniques de scene">
                  {mechanics.enigma ? <Lock size={12} aria-label="Enigme" /> : null}
                  {mechanics.cinematic ? <Clapperboard size={12} aria-label="Cinematique" /> : null}
                  {mechanics.logic ? <Brain size={12} aria-label="Logique" /> : null}
                </span>
              ) : null}
            </button>
          );
          })}

          {contextMenu && !isGameplayMode ? (
            <div
              className="route-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              {contextMenu.kind === 'board' ? (
                <button type="button" onClick={() => {
                  addRoom('', { x: contextMenu.boardX, y: contextMenu.boardY });
                  setContextMenu(null);
                }}>
                  <Plus size={14} aria-hidden="true" />
                  Ajouter ici
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
                      Ouvrir scene
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
                      Definir depart
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

        <div className="route-map-below-canvas">
          <label className="checkbox-line route-hide-selection">
            <input type="checkbox" checked={hideSelection} onChange={(event) => setHideSelection(event.target.checked)} />
            <EyeOff size={14} aria-hidden="true" />
            Masquer la selection
          </label>

          <div className="route-mechanic-legend">
            <span><Lock size={13} aria-hidden="true" /> Enigme</span>
            <span><Clapperboard size={13} aria-hidden="true" /> Cinematique</span>
            <span><Brain size={13} aria-hidden="true" /> Logique</span>
          </div>
        </div>
      </section>

      <section className="panel side route-map-inspector">
        <div className="panel-head">
          <h2>Détail</h2>
        </div>

        {isGameplayMode ? (
          <div className="editor-stack route-gameplay-inspector">
            <div className={`route-selected-connection ${gameplay.reachedEnd ? 'status-ok' : gameplay.availableMoves.length ? 'status-partial' : 'status-missing'}`}>
              <strong>{gameplay.activeRoom ? roomLabel(gameplay.activeRoom, project, getSceneLabel) : 'Aucune position'}</strong>
              <span>{gameplay.reachedEnd ? 'Le joueur a atteint une arrivee.' : gameplay.availableMoves.length ? 'Sorties disponibles depuis cette position.' : 'Blocage: aucune sortie jouable.'}</span>
            </div>

            <div className="route-gameplay-stats">
              <span><strong>{Math.max(0, playerPath.length - 1)}</strong> pas</span>
              <span><strong>{gameplay.reachableRoomIds.size}</strong> atteignables</span>
              <span><strong>{gameplay.blockedMoves.length}</strong> blocages ici</span>
            </div>

            <div className="route-connection-list">
              <strong>Inventaire simule</strong>
              {playerItemIds.map((itemId) => {
                const item = (project.items || []).find((entry) => entry.id === itemId);
                return <span key={itemId}>{item?.name || 'Objet inconnu'}</span>;
              })}
              {!playerItemIds.length ? <span>Aucun objet ramasse.</span> : null}
            </div>

            <div className="route-connection-list">
              <strong>Sorties jouables</strong>
              {gameplay.availableMoves.map((move) => (
                <button key={`${move.connection.id}:${move.toRoom.id}`} type="button" className="route-gameplay-move" onClick={() => movePlayerToRoom(move.toRoom.id)}>
                  <Play size={13} aria-hidden="true" />
                  <span>{roomLabel(move.toRoom, project, getSceneLabel)}</span>
                  <small>{move.mapOnly ? 'Plan - ' : move.indirect ? 'Indirect - ' : ''}{move.locked ? 'Condition - ' : ''}{move.label}{move.condition ? ` - ${move.condition}` : ''}</small>
                </button>
              ))}
              {!gameplay.availableMoves.length ? <span>Aucune sortie jouable depuis cette piece.</span> : null}
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
                    <span>{index + 1}. {room ? roomLabel(room, project, getSceneLabel) : 'Piece supprimee'}</span>
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
                <strong>{fromRoom ? roomLabel(fromRoom, project, getSceneLabel) : 'Piece supprimee'} {'->'} {toRoom ? roomLabel(toRoom, project, getSceneLabel) : 'Piece supprimee'}</strong>
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
                  placeholder="Condition d'acces, item requis, enigme resolue..."
                  onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                    connection.condition = event.target.value;
                  })}
                />
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={!!selectedConnection.locked} onChange={(event) => updateConnection(selectedConnection.id, (connection) => {
                  connection.locked = event.target.checked;
                })} />
                Liaison verrouillee par condition
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
          <div className="editor-stack" data-tour="map-room-détail">
            <label>
              Nom de la piece
              <input value={selectedRoom.name || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.name = event.target.value;
              })} />
            </label>
            <label>
              Scene liée
              <select value={selectedRoom.sceneId || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.sceneId = event.target.value;
              })}>
                <option value="">Aucune scene</option>
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
                <option value="room">Piece normale</option>
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
                    <span>{connection.fromRoomId === selectedRoom.id ? '→' : '←'} {target ? roomLabel(target, project, getSceneLabel) : 'Piece supprimée'}</span>
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
                <span>Aucune liaison pour cette piece.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state-inline">Selectionne une piece pour la nommer, la lier à une scene ou créer une connexion.</div>
        )}

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
            <p className="route-check ok"><CheckCircle2 size={15} aria-hidden="true" />Toutes les pieces sont connectées depuis le départ.</p>
          )}
        </div>
      </section>
    </div>
  );
}
