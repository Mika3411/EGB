const SCORE_MAX = 10;

const SCORE_WEIGHTS = {
  structure: 4,
  map: 3.7,
  content: 2,
  polish: 0.3,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roundTo = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const hasText = (value) => String(value || '').trim().length > 0;

const getActStartSceneId = (project, actId) => {
  const actScenes = asArray(project.scenes).filter((scene) => scene.actId === actId);
  return actScenes.find((scene) => !scene.parentSceneId)?.id || actScenes[0]?.id || '';
};

const getCinematicTargetSceneIds = (project, cinematicId) => {
  const cinematic = asArray(project.cinematics).find((entry) => entry.id === cinematicId);
  if (!cinematic) return [];
  if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) return [cinematic.targetSceneId];
  if (cinematic.onEndType === 'act' && cinematic.targetActId) {
    const targetSceneId = getActStartSceneId(project, cinematic.targetActId);
    return targetSceneId ? [targetSceneId] : [];
  }
  return [];
};

const getEnigmaTargetSceneIds = (project, enigmaId) => {
  const enigma = asArray(project.enigmas).find((entry) => entry.id === enigmaId);
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
    const targets = getEnigmaTargetSceneIds(project, action.enigmaId);
    if (targets.length) return targets;
  }
  if (action.actionType === 'scene' && action.targetSceneId) return [action.targetSceneId];
  if (action.actionType === 'cinematic' && action.targetCinematicId) {
    return getCinematicTargetSceneIds(project, action.targetCinematicId);
  }
  return [];
};

const getSecondaryAction = (entry) => (entry?.hasSecondAction ? {
  actionType: entry.secondActionType,
  targetSceneId: entry.secondTargetSceneId,
  targetCinematicId: entry.secondTargetCinematicId,
  enigmaId: entry.secondEnigmaId,
} : null);

const getEntryActions = (entry) => [
  entry,
  getSecondaryAction(entry),
  ...asArray(entry?.logicRules).map((rule) => (rule.actionType === 'default' ? entry : rule)),
].filter(Boolean);

export const getSceneTransitions = (project = {}) => (
  asArray(project.scenes).flatMap((scene) => {
    const interactiveEntries = [
      ...asArray(scene.hotspots),
      ...asArray(scene.sceneObjects).filter((object) => object.clickMode !== 'none'),
    ];

    return interactiveEntries.flatMap((entry) => (
      getEntryActions(entry).flatMap((action) => (
        getActionTargetSceneIds(project, action)
          .filter((targetSceneId) => targetSceneId && targetSceneId !== scene.id)
          .map((targetSceneId) => ({ fromSceneId: scene.id, toSceneId: targetSceneId }))
      ))
    ));
  })
);

const getRouteMapRoomsAndConnections = (routeMap = {}) => {
  const actMaps = routeMap.actMaps && typeof routeMap.actMaps === 'object' ? Object.values(routeMap.actMaps) : [];
  const maps = actMaps.length ? actMaps : [routeMap];
  return {
    rooms: maps.flatMap((map) => asArray(map.rooms)),
    connections: maps.flatMap((map) => asArray(map.connections)),
  };
};

const getStartSceneId = (project, rooms = []) => {
  if (project.start?.type === 'scene' && project.start?.targetSceneId) return project.start.targetSceneId;
  if (project.start?.type === 'cinematic' && project.start?.targetCinematicId) {
    return getCinematicTargetSceneIds(project, project.start.targetCinematicId)[0] || '';
  }
  return rooms.find((room) => room.type === 'start' && room.sceneId)?.sceneId || asArray(project.scenes)[0]?.id || '';
};

const getConnectionStatus = (rooms, connection, transitions) => {
  const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
  const toRoom = rooms.find((room) => room.id === connection.toRoomId);
  if (!fromRoom?.sceneId || !toRoom?.sceneId) return 'neutral';

  const forward = transitions.some((transition) => (
    transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId
  ));
  const reverse = transitions.some((transition) => (
    transition.fromSceneId === toRoom.sceneId && transition.toSceneId === fromRoom.sceneId
  ));

  if (forward && reverse) return 'ok';
  if (forward || reverse) return connection.allowOneWay ? 'accepted' : 'partial';
  return 'missing';
};

const getConnectionScore = (status) => {
  if (status === 'ok') return 1;
  if (status === 'accepted') return 0.9;
  if (status === 'partial') return 0.55;
  if (status === 'neutral') return 0.25;
  return 0;
};

const hasUsefulAction = (entry) => getEntryActions(entry).some((action) => (
  action.actionType !== 'dialogue'
  || action.targetSceneId
  || action.targetCinematicId
  || action.enigmaId
  || action.rewardItemId
  || action.requiredItemId
));

const actionHasBrokenReference = (action, { sceneIds, cinematicIds, enigmaIds }) => {
  if (!action) return false;
  if (action.actionType === 'scene' && (!action.targetSceneId || !sceneIds.has(action.targetSceneId))) return true;
  if (action.actionType === 'cinematic' && (!action.targetCinematicId || !cinematicIds.has(action.targetCinematicId))) return true;
  if (action.enigmaId && !enigmaIds.has(action.enigmaId)) return true;
  return false;
};

const countDeadEndActions = ({ scenes, enigmas, cinematics }) => {
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const cinematicIds = new Set(cinematics.map((cinematic) => cinematic.id));
  const enigmaIds = new Set(enigmas.map((enigma) => enigma.id));
  const referenceSets = { sceneIds, cinematicIds, enigmaIds };

  return scenes.reduce((total, scene) => {
    const interactiveEntries = [
      ...asArray(scene.hotspots),
      ...asArray(scene.sceneObjects).filter((object) => object.clickMode !== 'none'),
    ];
    return total + interactiveEntries.filter((entry) => (
      getEntryActions(entry).some((action) => actionHasBrokenReference(action, referenceSets))
    )).length;
  }, 0);
};

const collectInteractiveEntries = (scene) => [
  ...asArray(scene.hotspots),
  ...asArray(scene.sceneObjects).filter((object) => object.clickMode !== 'none'),
];

const collectProjectActions = (scenes) => (
  scenes.flatMap((scene) => (
    collectInteractiveEntries(scene).flatMap((entry) => (
      getEntryActions(entry).map((action) => ({ scene, entry, action }))
    ))
  ))
);

const getReachableSceneIds = ({ startSceneId, scenes, transitions }) => {
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  if (!startSceneId || !sceneIds.has(startSceneId)) return new Set();
  const reachable = new Set([startSceneId]);
  const queue = [startSceneId];

  while (queue.length) {
    const currentSceneId = queue.shift();
    transitions
      .filter((transition) => transition.fromSceneId === currentSceneId)
      .forEach((transition) => {
        if (!sceneIds.has(transition.toSceneId) || reachable.has(transition.toSceneId)) return;
        reachable.add(transition.toSceneId);
        queue.push(transition.toSceneId);
      });
  }

  return reachable;
};

const estimateEnigmaDifficulty = (enigma) => {
  if (!enigma) return 0;
  if (enigma.type === 'colors') return Math.min(8, 3 + asArray(enigma.solutionColors).length);
  if (enigma.type === 'puzzle') return clamp(Math.round(((Number(enigma.gridRows) || 3) * (Number(enigma.gridCols) || 3)) / 2), 4, 9);
  if (enigma.type === 'simon') return 7;
  if (enigma.type === 'rotation' || enigma.type === 'dragdrop') return 6;
  if (enigma.type === 'misc') {
    const modeScores = {
      'true-false': 2,
      'multiple-choice': 3,
      'free-answer': 4,
      'fill-blank': 4,
      'exact-number': 4,
      'accepted-answers': 4,
      'item-select': 5,
      'numeric-range': 5,
      'multi-select': 6,
      ordering: 7,
      matching: 7,
    };
    return modeScores[enigma.miscMode || 'free-answer'] || 4;
  }
  if (enigma.type === 'code') return Math.min(8, Math.max(3, String(enigma.solutionText || '').trim().length));
  return 4;
};

const buildAdvancedAnalysis = ({ project, scenes, items, enigmas, cinematics, map, content, transitions }) => {
  const startSceneId = getStartSceneId(project, map.details.rooms);
  const reachableSceneIds = getReachableSceneIds({ startSceneId, scenes, transitions });
  const endSceneIds = new Set(map.details.rooms.filter((room) => room.type === 'end' && room.sceneId).map((room) => room.sceneId));
  const outgoingBySceneId = transitions.reduce((byScene, transition) => ({
    ...byScene,
    [transition.fromSceneId]: (byScene[transition.fromSceneId] || 0) + 1,
  }), {});

  const unreachableScenes = scenes.filter((scene) => scenes.length > 1 && !reachableSceneIds.has(scene.id));
  const deadPathScenes = scenes.filter((scene) => (
    scenes.length > 1
    && reachableSceneIds.has(scene.id)
    && !endSceneIds.has(scene.id)
    && !outgoingBySceneId[scene.id]
  ));

  const actions = collectProjectActions(scenes);
  const rewardedItemIds = new Set([
    ...actions.map(({ action }) => action.rewardItemId).filter(Boolean),
    ...cinematics.map((cinematic) => cinematic.rewardItemId).filter(Boolean),
  ]);
  const itemIds = new Set(items.map((item) => item.id));
  const obtainableItemIds = new Set([...itemIds].filter((itemId) => rewardedItemIds.has(itemId)));
  const missingRequiredItems = actions.filter(({ action }) => (
    action.requiredItemId && itemIds.has(action.requiredItemId) && !obtainableItemIds.has(action.requiredItemId)
  ));
  const impossibleLogicRules = actions.filter(({ action }) => (
    (action.conditionType === 'item' && action.itemId && !obtainableItemIds.has(action.itemId))
    || (action.conditionType === 'enigma' && action.conditionEnigmaId && !enigmas.some((enigma) => enigma.id === action.conditionEnigmaId && hasPlayableEnigmaSolution(enigma)))
    || (action.conditionType === 'combination' && action.combinationId && !asArray(project.combinations).some((combo) => combo.id === action.combinationId))
  ));

  const enigmaTypes = new Set(enigmas.map((enigma) => enigma.type || 'code'));
  const miscModes = new Set(enigmas.filter((enigma) => enigma.type === 'misc').map((enigma) => enigma.miscMode || 'free-answer'));
  const actionTypes = new Set(actions.map(({ action }) => action.actionType || 'dialogue'));
  const dominantEnigmaTypeCount = Math.max(0, ...Object.values(enigmas.reduce((counts, enigma) => ({
    ...counts,
    [enigma.type || 'code']: (counts[enigma.type || 'code'] || 0) + 1,
  }), {})));
  const lacksVariety = (
    enigmas.length >= 3 && (enigmaTypes.size < 2 || dominantEnigmaTypeCount / enigmas.length > 0.75)
  ) || (
    actions.length >= 6 && actionTypes.size < 3
  );

  const difficultyScores = enigmas.map(estimateEnigmaDifficulty);
  const averageDifficulty = difficultyScores.length
    ? difficultyScores.reduce((total, value) => total + value, 0) / difficultyScores.length
    : 0;
  const difficultySpread = difficultyScores.length
    ? Math.max(...difficultyScores) - Math.min(...difficultyScores)
    : 0;
  const timedScenePressure = scenes.filter((scene) => scene.timerEnabled && Number(scene.timerSeconds) > 0 && Number(scene.timerSeconds) < 30).length;
  const difficultyIncoherent = (
    difficultySpread >= 5
    || (enigmas.length <= 2 && averageDifficulty >= 7)
    || (enigmas.length >= 5 && averageDifficulty <= 3)
    || timedScenePressure > 0
  );

  return {
    startSceneId,
    deadPaths: {
      count: deadPathScenes.length,
      sceneIds: deadPathScenes.map((scene) => scene.id),
    },
    blockedProgression: {
      count: unreachableScenes.length + missingRequiredItems.length + impossibleLogicRules.length,
      unreachableSceneIds: unreachableScenes.map((scene) => scene.id),
      missingRequiredItems: missingRequiredItems.length,
      impossibleLogicRules: impossibleLogicRules.length,
    },
    variety: {
      lacksVariety,
      enigmaTypes: enigmaTypes.size,
      miscModes: miscModes.size,
      actionTypes: actionTypes.size,
      dominantEnigmaTypeRatio: enigmas.length ? roundTo(dominantEnigmaTypeCount / enigmas.length, 2) : 0,
    },
    difficulty: {
      incoherent: difficultyIncoherent,
      average: roundTo(averageDifficulty),
      spread: difficultySpread,
      timedScenePressure,
    },
    route: {
      reachableScenes: reachableSceneIds.size,
      unreachableScenes: unreachableScenes.length,
      transitions: transitions.length,
    },
    logic: {
      impossibleRules: impossibleLogicRules.length,
      missingRequiredItems: missingRequiredItems.length,
      deadEndActions: content.details.deadEndActions,
    },
  };
};

const hasPlayableEnigmaSolution = (enigma) => {
  if (!enigma) return false;
  if (enigma.type === 'code') return hasText(enigma.solutionText);
  if (enigma.type === 'colors' || enigma.type === 'simon') return asArray(enigma.solutionColors).length > 0;
  if (['puzzle', 'rotation', 'dragdrop'].includes(enigma.type)) return hasText(enigma.imageData) || hasText(enigma.imageName);
  if (enigma.type !== 'misc') return hasText(enigma.solutionText) || asArray(enigma.solutionColors).length > 0;

  const miscMode = enigma.miscMode || 'free-answer';
  if (['free-answer', 'multiple-choice', 'true-false', 'fill-blank', 'exact-number'].includes(miscMode)) {
    return hasText(enigma.solutionText);
  }
  if (miscMode === 'numeric-range') return hasText(enigma.miscMin) && hasText(enigma.miscMax);
  if (miscMode === 'item-select') return hasText(enigma.miscTargetItemId);
  if (miscMode === 'accepted-answers') return asArray(enigma.miscChoices).length > 0;
  if (miscMode === 'matching') return asArray(enigma.miscPairs).length > 0;
  if (miscMode === 'multi-select') return asArray(enigma.miscCorrectChoices).length > 0;
  if (miscMode === 'ordering') return asArray(enigma.miscChoices).length > 0;
  return hasText(enigma.solutionText);
};

const buildStructureSection = ({ acts, scenes, items, enigmas, cinematics }) => {
  const criteria = [
    { id: 'acts', label: 'Actes', score: acts.length ? 0.7 : 0, max: 0.7 },
    { id: 'scenes', label: 'Scenes', score: Math.min(1.1, (scenes.length / 6) * 1.1), max: 1.1 },
    { id: 'items', label: 'Objets', score: Math.min(0.8, (items.length / 6) * 0.8), max: 0.8 },
    { id: 'enigmas', label: 'Enigmes', score: Math.min(0.9, (enigmas.length / 4) * 0.9), max: 0.9 },
    { id: 'cinematics', label: 'Cinematics', score: Math.min(0.5, (cinematics.length / 2) * 0.5), max: 0.5 },
  ];

  return {
    score: criteria.reduce((total, criterion) => total + criterion.score, 0),
    max: SCORE_WEIGHTS.structure,
    criteria,
  };
};

const buildMapSection = ({ scenes, routeMap, transitions }) => {
  const { rooms, connections } = getRouteMapRoomsAndConnections(routeMap);
  const mappedSceneCount = new Set(rooms.map((room) => room.sceneId).filter(Boolean)).size;
  const mappedRatio = scenes.length ? mappedSceneCount / scenes.length : 0;
  const validConnections = connections.filter((connection) => (
    rooms.some((room) => room.id === connection.fromRoomId)
    && rooms.some((room) => room.id === connection.toRoomId)
  ));
  const connectionStatuses = validConnections.map((connection) => getConnectionStatus(rooms, connection, transitions));
  const connectionCounts = connectionStatuses.reduce((counts, status) => ({
    ...counts,
    [status]: (counts[status] || 0) + 1,
  }), {});
  const connectionQuality = connectionStatuses.length
    ? connectionStatuses.reduce((total, status) => total + getConnectionScore(status), 0) / connectionStatuses.length
    : 0;
  const hasStartRoom = rooms.some((room) => room.type === 'start');

  const criteria = [
    { id: 'mappedScenes', label: 'Scenes mappees', score: mappedRatio * 1.3, max: 1.3 },
    { id: 'connections', label: 'Liaisons jouables', score: connectionQuality * 2, max: 2 },
    { id: 'startRoom', label: 'Depart sur le plan', score: hasStartRoom ? 0.4 : 0, max: 0.4 },
  ];

  return {
    score: criteria.reduce((total, criterion) => total + criterion.score, 0),
    max: SCORE_WEIGHTS.map,
    criteria,
    details: {
      rooms,
      validConnections,
      mappedSceneCount,
      mappedRatio,
      connectionCounts,
      connectionQuality,
      hasStartRoom,
    },
  };
};

const buildContentSection = ({ project, scenes, enigmas, cinematics }) => {
  const startValid = project.start?.type === 'cinematic'
    ? cinematics.some((cinematic) => cinematic.id === project.start?.targetCinematicId)
    : scenes.some((scene) => scene.id === project.start?.targetSceneId);

  const scenesWithAction = scenes.filter((scene) => {
    const interactiveEntries = [
      ...asArray(scene.hotspots),
      ...asArray(scene.sceneObjects).filter((object) => object.clickMode !== 'none'),
    ];
    return interactiveEntries.some(hasUsefulAction);
  }).length;
  const actionRatio = scenes.length ? scenesWithAction / scenes.length : 0;
  const solvedEnigmas = enigmas.filter(hasPlayableEnigmaSolution).length;
  const enigmaRatio = enigmas.length ? solvedEnigmas / enigmas.length : 0;
  const deadEndActions = countDeadEndActions({ scenes, enigmas, cinematics });

  const criteria = [
    { id: 'actions', label: 'Scenes interactives', score: actionRatio * 1, max: 1 },
    { id: 'enigmaSolutions', label: 'Solutions enigmes', score: enigmaRatio * 0.7, max: 0.7 },
    { id: 'start', label: 'Point de depart', score: startValid ? 0.3 : 0, max: 0.3 },
  ];

  return {
    score: criteria.reduce((total, criterion) => total + criterion.score, 0),
    max: SCORE_WEIGHTS.content,
    criteria,
    details: {
      startValid,
      scenesWithAction,
      actionRatio,
      solvedEnigmas,
      enigmaRatio,
      deadEndActions,
    },
  };
};

const buildPolishSection = ({ scenes, cinematics }) => {
  const scenesWithMood = scenes.filter((scene) => (
    hasText(scene.backgroundData)
    || hasText(scene.backgroundName)
    || hasText(scene.musicData)
    || hasText(scene.musicName)
    || hasText(scene.ambientSoundData)
    || hasText(scene.ambientSoundName)
    || (scene.visualEffect && scene.visualEffect !== 'none')
  )).length;
  const cinematicContentCount = cinematics.filter((cinematic) => (
    hasText(cinematic.videoData)
    || hasText(cinematic.videoName)
    || asArray(cinematic.slides).some((slide) => hasText(slide.imageData) || hasText(slide.imageName) || hasText(slide.narration))
    || asArray(cinematic.steps).some((step) => hasText(step.content) || hasText(step.imageData) || hasText(step.imageName))
  )).length;
  const moodRatio = scenes.length ? scenesWithMood / scenes.length : 0;
  const cinematicRatio = cinematics.length ? cinematicContentCount / cinematics.length : 0;

  const criteria = [
    { id: 'sceneMood', label: 'Ambiance scenes', score: moodRatio * 0.18, max: 0.18 },
    { id: 'cinematicContent', label: 'Cinematics renseignees', score: cinematicRatio * 0.12, max: 0.12 },
  ];

  return {
    score: criteria.reduce((total, criterion) => total + criterion.score, 0),
    max: SCORE_WEIGHTS.polish,
    criteria,
    details: {
      scenesWithMood,
      cinematicContentCount,
      moodRatio,
      cinematicRatio,
    },
  };
};

const getPlaytimeRange = ({ scenes, items, enigmas, cinematics, connections }) => {
  const estimatedMinutes = Math.max(5, Math.round(
    scenes.length * 2.5
    + enigmas.length * 5
    + cinematics.length * 1.5
    + items.length * 0.8
    + Math.max(0, connections - scenes.length) * 1.2
  ));

  return {
    estimatedMinutes,
    playtimeRange: {
      min: Math.max(5, Math.round(estimatedMinutes * 0.75)),
      max: Math.max(8, Math.round(estimatedMinutes * 1.25)),
    },
  };
};

const getBalancedRangeScore = (value, idealMin, idealMax, hardMin, hardMax) => {
  if (value >= idealMin && value <= idealMax) return SCORE_MAX;
  if (value < idealMin) return clamp(roundTo(((value - hardMin) / (idealMin - hardMin)) * SCORE_MAX), 0, SCORE_MAX);
  return clamp(roundTo(((hardMax - value) / (hardMax - idealMax)) * SCORE_MAX), 0, SCORE_MAX);
};

const buildPlayerScore = ({ scenes, items, enigmas, cinematics, transitions, advancedAnalysis, estimatedMinutes, playtimeRange }) => {
  const actions = collectProjectActions(scenes);
  const actionableActions = actions.filter(({ action }) => (
    action.actionType !== 'dialogue'
    || action.targetSceneId
    || action.targetCinematicId
    || action.enigmaId
    || action.rewardItemId
    || action.requiredItemId
  ));
  const logicRuleCount = actions.filter(({ action }) => action.conditionType && action.conditionType !== 'always').length;
  const timedScenes = scenes.filter((scene) => scene.timerEnabled).length;
  const averageDifficulty = advancedAnalysis.difficulty.average || 0;
  const branchDensity = scenes.length ? transitions.length / scenes.length : 0;
  const inventoryPressure = scenes.length ? items.length / scenes.length : 0;
  const enigmaPressure = scenes.length ? enigmas.length / scenes.length : 0;
  const complexity = clamp(roundTo(
    averageDifficulty
    + Math.min(2, logicRuleCount / 4)
    + Math.min(1.5, branchDensity)
    + Math.min(1, inventoryPressure / 2)
    + Math.min(1, enigmaPressure)
    + Math.min(1, timedScenes / 2)
  ), 0, SCORE_MAX);

  const time = getBalancedRangeScore(estimatedMinutes, 20, 55, 5, 100);
  const actionScore = getBalancedRangeScore(actionableActions.length, 8, 28, 0, 55);
  const complexityScore = getBalancedRangeScore(complexity, 4, 7, 0, 10);
  const score = clamp(roundTo((time * 0.35) + (actionScore * 0.3) + (complexityScore * 0.35)), 0, SCORE_MAX);

  return {
    score,
    label: `${score.toFixed(1).replace('.', ',')}/10`,
    time: {
      score: time,
      estimatedMinutes,
      range: playtimeRange,
      label: `${playtimeRange.min}-${playtimeRange.max} min`,
    },
    actions: {
      score: actionScore,
      count: actionableActions.length,
      totalConfigured: actions.length,
      logicRules: logicRuleCount,
    },
    complexity: {
      score: complexityScore,
      value: complexity,
      averageEnigmaDifficulty: averageDifficulty,
      branchDensity: roundTo(branchDensity, 2),
      inventoryPressure: roundTo(inventoryPressure, 2),
      enigmaPressure: roundTo(enigmaPressure, 2),
      timedScenes,
    },
  };
};

const makeBadge = (id, label, description, tone = 'good') => ({ id, label, description, tone });

const buildMotivationBadges = ({ dimensions, playerScore, advancedAnalysis, scenes, enigmas, cinematics, map, content, polish }) => {
  const badges = [];
  const puzzleCount = enigmas.filter((enigma) => ['puzzle', 'rotation', 'dragdrop', 'simon'].includes(enigma.type)).length;
  const cinematicRatio = cinematics.length ? polish.details.cinematicContentCount / cinematics.length : 0;

  if (
    dimensions.gameplay >= 8
    && dimensions.coherence >= 8
    && !advancedAnalysis.deadPaths.count
    && !advancedAnalysis.blockedProgression.count
  ) {
    badges.push(makeBadge('good-flow', 'Bon flow', 'Le parcours est fluide, lisible et peu susceptible de bloquer le joueur.'));
  }

  if (dimensions.narration >= 8 && cinematicRatio >= 0.75 && scenes.length >= 2) {
    badges.push(makeBadge('strong-narration', 'Narration forte', 'Les scenes et cinematiques donnent une vraie continuité narrative.'));
  }

  if (
    puzzleCount >= 2
    || advancedAnalysis.difficulty.average >= 7
    || (playerScore.complexity.value >= 7 && enigmas.length >= 2)
  ) {
    badges.push(makeBadge('expert-puzzle', 'Puzzle expert', 'Les enigmes proposent une complexite solide pour les joueurs qui aiment reflechir.', 'expert'));
  }

  if (advancedAnalysis.variety.enigmaTypes >= 3 || advancedAnalysis.variety.actionTypes >= 4) {
    badges.push(makeBadge('varied-gameplay', 'Gameplay varie', 'Le projet alterne plusieurs types d interactions et d enigmes.'));
  }

  if (playerScore.time.score >= 8 && playerScore.actions.score >= 8) {
    badges.push(makeBadge('balanced-session', 'Session bien calibree', 'Le temps estime et le nombre d actions semblent confortables cote joueur.'));
  }

  if (map.details.mappedRatio === 1 && map.details.connectionQuality >= 0.9 && content.details.startValid) {
    badges.push(makeBadge('clean-map', 'Plan propre', 'Toutes les scenes importantes sont mappees avec des liaisons solides.'));
  }

  return badges.slice(0, 6);
};

const makeFeedback = (level, label, message, metric = '') => ({ level, label, message, metric });

const buildFeedback = ({ acts, scenes, items, enigmas, cinematics, map, content, polish, advancedAnalysis, playerScore }) => {
  const feedback = [];
  const connectionCounts = map.details.connectionCounts;

  if (map.details.mappedRatio >= 0.85 && map.details.connectionQuality >= 0.8 && scenes.length > 1) {
    feedback.push(makeFeedback('success', 'Bon maillage des scenes', 'Le plan couvre la majorite des scenes et les liaisons sont jouables.'));
  }
  if (content.details.actionRatio >= 0.75 && scenes.length) {
    feedback.push(makeFeedback('success', 'Scenes bien interactives', 'La plupart des scenes proposent au moins une action utile.'));
  }
  if (content.details.startValid) {
    feedback.push(makeFeedback('success', 'Depart valide', 'Le joueur arrive bien sur une scene ou une cinematic existante.'));
  }

  if (!acts.length) feedback.push(makeFeedback('warning', 'Structure absente', 'Cree au moins un acte pour structurer le parcours.'));
  if (scenes.length < 4) feedback.push(makeFeedback('warning', 'Peu de scenes', 'Ajoute quelques scenes pour donner plus de matiere au parcours.', `${scenes.length}/4`));
  if (items.length < 3) feedback.push(makeFeedback('warning', 'Inventaire leger', 'Ajoute des objets d inventaire pour enrichir les interactions.', `${items.length}/3`));
  if (enigmas.length < 2) feedback.push(makeFeedback('warning', 'Trop peu d enigmes', 'Ajoute des enigmes pour renforcer la progression du joueur.', `${enigmas.length}/2`));
  if (!cinematics.length) feedback.push(makeFeedback('warning', 'Pas de cinematic', 'Ajoute une cinematic d introduction, de transition ou de fin.'));
  if (map.details.mappedRatio < 1 && scenes.length) feedback.push(makeFeedback('warning', 'Scenes non mappees', 'Associe toutes les scenes importantes a une piece du plan.', `${map.details.mappedSceneCount}/${scenes.length}`));
  if (connectionCounts.partial) feedback.push(makeFeedback('warning', 'Allers simples a confirmer', 'Valide les allers simples voulus ou ajoute la zone d action de retour.', String(connectionCounts.partial)));
  if (content.details.actionRatio < 0.75 && scenes.length) feedback.push(makeFeedback('warning', 'Interactions inegales', 'Ajoute des zones d action utiles dans les scenes encore peu interactives.'));
  if (content.details.enigmaRatio < 1 && enigmas.length) feedback.push(makeFeedback('warning', 'Enigmes incompletes', 'Complete les solutions des enigmes incompletes.', `${content.details.solvedEnigmas}/${enigmas.length}`));
  if (polish.details.moodRatio < 0.5 && scenes.length) feedback.push(makeFeedback('warning', 'Ambiance a renforcer', 'Ajoute quelques medias, sons ou effets visuels sur les scenes cles.'));
  if (advancedAnalysis.variety.lacksVariety) feedback.push(makeFeedback('warning', 'Manque de variete', 'Varie les types d enigmes, les modes de reponse ou les actions disponibles.', `${advancedAnalysis.variety.enigmaTypes} type(s)`));
  if (advancedAnalysis.difficulty.incoherent) feedback.push(makeFeedback('warning', 'Difficulte incoherente', 'La courbe de difficulte semble brusque: enigmes trop faciles/trop dures ou timer trop agressif.', `moy. ${advancedAnalysis.difficulty.average}/10`));
  if (playerScore.time.score < 6) feedback.push(makeFeedback('warning', 'Rythme joueur a ajuster', 'Le temps estime semble trop court ou trop long pour une session confortable.', playerScore.time.label));
  if (playerScore.actions.score < 6) feedback.push(makeFeedback('warning', 'Volume d actions desequilibre', 'Le parcours contient trop peu ou trop d actions utiles pour le temps estime.', String(playerScore.actions.count)));
  if (playerScore.complexity.score < 6) feedback.push(makeFeedback('warning', 'Complexite joueur a lisser', 'La charge mentale joueur semble trop faible, trop forte ou trop concentree.', `${playerScore.complexity.value}/10`));

  if (!content.details.startValid) feedback.push(makeFeedback('danger', 'Depart introuvable', 'Verifie le point de depart du jeu.'));
  if (!map.details.hasStartRoom) feedback.push(makeFeedback('danger', 'Depart absent du plan', 'Marque une piece comme depart dans le plan.'));
  if (connectionCounts.missing) feedback.push(makeFeedback('danger', 'Liaisons bloquees', 'Certaines liaisons du plan ne correspondent a aucune zone d action.', String(connectionCounts.missing)));
  if (content.details.deadEndActions) feedback.push(makeFeedback('danger', 'Certaines zones ne menent a rien', 'Corrige les zones qui pointent vers une scene, une cinematic ou une enigme manquante.', String(content.details.deadEndActions)));
  if (advancedAnalysis.deadPaths.count) feedback.push(makeFeedback('danger', 'Chemins morts', 'Des scenes atteignables ne proposent aucune suite et ne sont pas marquees comme fin.', String(advancedAnalysis.deadPaths.count)));
  if (advancedAnalysis.blockedProgression.count) feedback.push(makeFeedback('danger', 'Progression bloquee', 'Certaines scenes ou conditions de logique semblent impossibles a atteindre.', String(advancedAnalysis.blockedProgression.count)));

  if (!feedback.length) {
    feedback.push(makeFeedback('success', 'Projet coherent', 'Les dernieres ameliorations seront surtout du polish: ambiance, medias, rythme et tests joueur.'));
  }

  return feedback;
};

const getConclusion = (score) => {
  if (score >= 9) return 'Projet tres solide: le parcours est lisible, coherent et presque pret a etre teste en conditions reelles.';
  if (score >= 7) return 'Bonne base: le jeu est jouable, avec quelques points de coherence ou de contenu a renforcer.';
  if (score >= 5) return 'Projet prometteur: la structure existe, mais le plan et les interactions doivent encore etre consolides.';
  return 'Projet encore en construction: commence par relier les scenes, poser le depart et ajouter des interactions cles.';
};

const normalizeSectionScore = (section) => (
  section?.max ? clamp(roundTo((section.score / section.max) * 10), 0, SCORE_MAX) : 0
);

const buildNarrationDimension = ({ scenes, cinematics, polish }) => {
  const scenesWithIntro = scenes.filter((scene) => hasText(scene.introText)).length;
  const introRatio = scenes.length ? scenesWithIntro / scenes.length : 0;
  const cinematicRatio = cinematics.length ? polish.details.cinematicContentCount / cinematics.length : 0;
  return clamp(roundTo((introRatio * 4) + (cinematicRatio * 4) + (polish.details.moodRatio * 2)), 0, SCORE_MAX);
};

const buildGameplayDimension = ({ content, transitions, scenes }) => {
  const transitionRatio = scenes.length > 1 ? clamp(transitions.length / scenes.length, 0, 1) : 0;
  return clamp(roundTo(
    (content.details.actionRatio * 4)
    + (content.details.enigmaRatio * 3)
    + (content.details.startValid ? 1 : 0)
    + (transitionRatio * 2)
  ), 0, SCORE_MAX);
};

const buildCompletionDimension = ({ structure, map, content, polish }) => (
  clamp(roundTo(
    normalizeSectionScore(structure) * 0.35
    + normalizeSectionScore(map) * 0.25
    + normalizeSectionScore(content) * 0.25
    + normalizeSectionScore(polish) * 0.15
  ), 0, SCORE_MAX)
);

const buildScoreDimensions = ({ structure, map, content, polish, scenes, cinematics, transitions }) => ({
  structure: normalizeSectionScore(structure),
  gameplay: buildGameplayDimension({ content, transitions, scenes }),
  narration: buildNarrationDimension({ scenes, cinematics, polish }),
  coherence: normalizeSectionScore(map),
  completion: buildCompletionDimension({ structure, map, content, polish }),
});

export function calculateProjectScore(project = {}) {
  const acts = asArray(project.acts);
  const scenes = asArray(project.scenes);
  const items = asArray(project.items);
  const enigmas = asArray(project.enigmas);
  const cinematics = asArray(project.cinematics);
  const transitions = getSceneTransitions(project);

  const structure = buildStructureSection({ acts, scenes, items, enigmas, cinematics });
  const map = buildMapSection({ scenes, routeMap: project.routeMap || {}, transitions });
  const content = buildContentSection({ project, scenes, enigmas, cinematics });
  const polish = buildPolishSection({ scenes, cinematics });
  const rawScore = structure.score + map.score + content.score + polish.score;
  const score = clamp(roundTo(rawScore), 0, SCORE_MAX);
  const { estimatedMinutes, playtimeRange } = getPlaytimeRange({
    scenes,
    items,
    enigmas,
    cinematics,
    connections: map.details.validConnections.length,
  });

  const advancedAnalysis = buildAdvancedAnalysis({
    project,
    scenes,
    items,
    enigmas,
    cinematics,
    map,
    content,
    transitions,
  });
  const playerScore = buildPlayerScore({
    scenes,
    items,
    enigmas,
    cinematics,
    transitions,
    advancedAnalysis,
    estimatedMinutes,
    playtimeRange,
  });
  const feedback = buildFeedback({ acts, scenes, items, enigmas, cinematics, map, content, polish, advancedAnalysis, playerScore });
  const advice = feedback.map((entry) => entry.message);
  const conclusion = getConclusion(score);
  const sections = {
    structure: roundTo(structure.score),
    map: roundTo(map.score),
    content: roundTo(content.score),
    polish: roundTo(polish.score),
  };
  const dimensions = buildScoreDimensions({
    structure,
    map,
    content,
    polish,
    scenes,
    cinematics,
    transitions,
  });
  const badges = buildMotivationBadges({
    dimensions,
    playerScore,
    advancedAnalysis,
    scenes,
    enigmas,
    cinematics,
    map,
    content,
    polish,
  });

  return {
    score,
    label: `${score.toFixed(1).replace('.', ',')}/10`,
    tone: score >= 8 ? 'good' : score >= 6 ? 'warn' : 'danger',
    advice,
    feedback,
    advancedAnalysis,
    playerScore,
    badges,
    conclusion,
    dimensions,
    sections,
    sectionDetails: {
      structure,
      map,
      content,
      polish,
    },
    metrics: {
      acts: acts.length,
      scenes: scenes.length,
      items: items.length,
      enigmas: enigmas.length,
      cinematics: cinematics.length,
      estimatedMinutes,
      playtimeRange,
      playerActions: playerScore.actions.count,
      playerComplexity: playerScore.complexity.value,
      mappedScenes: map.details.mappedSceneCount,
      connections: map.details.validConnections.length,
      connectionCounts: map.details.connectionCounts,
      scenesWithAction: content.details.scenesWithAction,
      startValid: content.details.startValid,
      solvedEnigmas: content.details.solvedEnigmas,
      deadEndActions: content.details.deadEndActions,
      scenesWithMood: polish.details.scenesWithMood,
      transitions: transitions.length,
      deadPaths: advancedAnalysis.deadPaths.count,
      blockedProgression: advancedAnalysis.blockedProgression.count,
      varietyIssues: advancedAnalysis.variety.lacksVariety ? 1 : 0,
      difficultyIssues: advancedAnalysis.difficulty.incoherent ? 1 : 0,
    },
    summary: [
      `Structure: ${sections.structure.toFixed(1)}/4`,
      `Plan: ${sections.map.toFixed(1)}/3,7`,
      `Contenu: ${sections.content.toFixed(1)}/2`,
      `Polish: ${sections.polish.toFixed(1)}/0,3`,
      `${acts.length} acte(s), ${scenes.length} scene(s), ${items.length} objet(s), ${enigmas.length} enigme(s), ${cinematics.length} cinematic(s)`,
    ].join(' - '),
  };
}

export const scoreProject = calculateProjectScore;
