import {
  getCinematicTargetSceneIds,
  getEntryActions,
  getSceneTransitions,
} from './projectTransitions';

export { getSceneTransitions } from './projectTransitions';

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

const makeScenePairKey = (fromSceneId = '', toSceneId = '') => `${fromSceneId}\u0000${toSceneId}`;

const buildTransitionIndexes = (transitions = []) => {
  const pairs = new Set();
  const outgoingBySceneId = new Map();
  transitions.forEach((transition) => {
    if (!transition?.fromSceneId || !transition?.toSceneId) return;
    pairs.add(makeScenePairKey(transition.fromSceneId, transition.toSceneId));
    const outgoing = outgoingBySceneId.get(transition.fromSceneId);
    if (outgoing) outgoing.push(transition);
    else outgoingBySceneId.set(transition.fromSceneId, [transition]);
  });
  return { outgoingBySceneId, pairs };
};

const getConnectionStatus = (roomsById, connection, transitionPairs) => {
  const fromRoom = roomsById.get(connection.fromRoomId);
  const toRoom = roomsById.get(connection.toRoomId);
  if (!fromRoom?.sceneId || !toRoom?.sceneId) return 'neutral';

  const forward = transitionPairs.has(makeScenePairKey(fromRoom.sceneId, toRoom.sceneId));
  const reverse = transitionPairs.has(makeScenePairKey(toRoom.sceneId, fromRoom.sceneId));

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
  || action.externalUrl
  || action.targetProjectId
  || action.enigmaId
  || action.rewardItemId
  || action.requiredItemId
));

const actionHasBrokenReference = (action, { sceneIds, cinematicIds, enigmaIds }) => {
  if (!action) return false;
  if (action.actionType === 'scene' && (!action.targetSceneId || !sceneIds.has(action.targetSceneId))) return true;
  if (action.actionType === 'cinematic' && (!action.targetCinematicId || !cinematicIds.has(action.targetCinematicId))) return true;
  if (action.actionType === 'external_link' && !String(action.externalUrl || '').trim()) return true;
  if (action.actionType === 'project_link' && (!action.targetProjectId || !action.targetProjectUserId)) return true;
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

const getReachableSceneIds = ({ startSceneId, scenes, transitionIndexes }) => {
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  if (!startSceneId || !sceneIds.has(startSceneId)) return new Set();
  const reachable = new Set([startSceneId]);
  const queue = [startSceneId];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const currentSceneId = queue[queueIndex];
    queueIndex += 1;
    const outgoingTransitions = transitionIndexes.outgoingBySceneId.get(currentSceneId) || [];
    outgoingTransitions.forEach((transition) => {
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

const hasSkillCheckFailureBranch = (check) => (
  hasText(check.skillCheckFailureDialogue)
  || hasText(check.skillCheckFailureTargetSceneId)
  || hasText(check.skillCheckFailureNextNodeId)
  || Number(check.skillCheckFailureHealthLoss) > 0
);

const collectHeroSkillChecks = (project = {}, scenes = []) => {
  const checks = [];
  scenes.forEach((scene) => {
    asArray(scene.hotspots).forEach((hotspot) => {
      if (hotspot.actionType === 'skill_check') {
        checks.push({ source: 'hotspot', scene, entry: hotspot, check: hotspot });
      }
      if (hotspot.actionType === 'conversation') {
        asArray(hotspot.conversation?.nodes).forEach((node) => {
          asArray(node.replies).forEach((reply) => {
            if (reply.actionType === 'skill_check') {
              checks.push({ source: 'conversation', scene, entry: hotspot, node, check: reply });
            }
          });
        });
      }
    });
  });

  const hero = project.heroAdventure?.hero || {};
  const skillIds = new Set(asArray(hero.skills).map((skill) => skill.id).filter(Boolean));
  const maxMana = Math.max(0, Number(hero.maxMana ?? hero.mana ?? 0) || 0);
  const enabled = Boolean(project.heroAdventure?.enabled || project.creationMode === 'hero_adventure');
  const withoutSkill = checks.filter(({ check }) => !check.skillCheckSkillId || !skillIds.has(check.skillCheckSkillId));
  const withoutDifficulty = checks.filter(({ check }) => !Number(check.skillCheckDifficulty));
  const withoutFailureBranch = checks.filter(({ check }) => !hasSkillCheckFailureBranch(check));
  const costly = checks.filter(({ check }) => Number(check.skillCheckManaCost) > maxMana);
  const punishing = checks.filter(({ check }) => Number(check.skillCheckFailureHealthLoss) >= Math.max(1, Number(hero.maxHealth ?? hero.health ?? 0) || 0));

  return {
    enabled,
    count: checks.length,
    checks,
    withoutSkill,
    withoutDifficulty,
    withoutFailureBranch,
    costly,
    punishing,
    maxMana,
  };
};

const getCombatSkillId = (combat = {}, hero = {}) => (
  combat.combatSkillId
  || combat.skillCheckSkillId
  || combat.skillId
  || asArray(hero.skills)[0]?.id
  || ''
);
const readCombatNumber = (values, fallback) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && entry !== '');
  const numberValue = value === undefined ? fallback : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};
const getCombatDifficulty = (combat = {}) => readCombatNumber([combat.combatAttackDifficulty, combat.combatDifficulty, combat.skillCheckDifficulty], 10);
const getCombatEnemyHealth = (combat = {}) => readCombatNumber([combat.combatEnemyMaxHealth, combat.enemyHealth, combat.enemyMaxHealth], 8);
const getCombatRewardItemId = (combat = {}) => combat.combatRewardItemId || combat.rewardItemId || '';
const getCombatVictoryTargetSceneId = (combat = {}) => combat.combatVictoryTargetSceneId || combat.victoryTargetSceneId || combat.targetSceneId || '';
const getCombatDefeatTargetSceneId = (combat = {}) => combat.combatDefeatTargetSceneId || combat.defeatTargetSceneId || '';

const hasCombatNarrativePayoff = (combat = {}) => (
  Boolean(getCombatRewardItemId(combat))
  || hasText(combat.combatVictoryDialogue)
  || hasText(combat.victoryDialogue)
  || hasText(getCombatVictoryTargetSceneId(combat))
);

const collectHeroCombats = (project = {}, scenes = []) => {
  const combats = [];
  scenes.forEach((scene) => {
    asArray(scene.hotspots).forEach((hotspot) => {
      if (hotspot.actionType === 'hero_combat') {
        combats.push({ source: 'hotspot', scene, entry: hotspot, combat: hotspot });
      }
      if (hotspot.actionType === 'conversation') {
        asArray(hotspot.conversation?.nodes).forEach((node) => {
          asArray(node.replies).forEach((reply) => {
            if (reply.actionType === 'hero_combat') {
              combats.push({ source: 'conversation', scene, entry: hotspot, node, combat: reply });
            }
          });
        });
      }
    });
  });

  const hero = project.heroAdventure?.hero || {};
  const skillIds = new Set(asArray(hero.skills).map((skill) => skill.id).filter(Boolean));
  const maxHealth = Math.max(1, Number(hero.maxHealth ?? hero.health ?? 0) || 1);
  const enabled = Boolean(project.heroAdventure?.enabled || project.creationMode === 'hero_adventure');

  const withoutEnemy = combats.filter(({ combat }) => !hasText(combat.combatEnemyName || combat.enemyName || combat.name));
  const withoutEnemyHealth = combats.filter(({ combat }) => getCombatEnemyHealth(combat) <= 0);
  const withoutSkill = combats.filter(({ combat }) => !getCombatSkillId(combat, hero) || !skillIds.has(getCombatSkillId(combat, hero)));
  const withoutDifficulty = combats.filter(({ combat }) => getCombatDifficulty(combat) <= 0);
  const withoutVictoryBranch = combats.filter(({ combat }) => !getCombatVictoryTargetSceneId(combat));
  const withoutDefeatBranch = combats.filter(({ combat }) => !getCombatDefeatTargetSceneId(combat));
  const withoutRewardOrNarrativePayoff = combats.filter(({ combat }) => !hasCombatNarrativePayoff(combat));
  const lethalEnemyDamage = combats.filter(({ combat }) => Number(combat.combatEnemyStrength ?? combat.combatEnemyDamage ?? combat.enemyDamage ?? 0) >= maxHealth);

  return {
    enabled,
    count: combats.length,
    combats,
    withoutEnemy,
    withoutEnemyHealth,
    withoutSkill,
    withoutDifficulty,
    withoutVictoryBranch,
    withoutDefeatBranch,
    withoutRewardOrNarrativePayoff,
    lethalEnemyDamage,
    maxHealth,
  };
};

const getHeroCombatIssueCount = (heroCombat = {}) => (
  asArray(heroCombat.withoutEnemy).length
  + asArray(heroCombat.withoutEnemyHealth).length
  + asArray(heroCombat.withoutSkill).length
  + asArray(heroCombat.withoutDifficulty).length
  + asArray(heroCombat.withoutVictoryBranch).length
  + asArray(heroCombat.withoutDefeatBranch).length
  + asArray(heroCombat.withoutRewardOrNarrativePayoff).length
  + asArray(heroCombat.lethalEnemyDamage).length
);

const getHeroCombatQualityScore = (heroCombat = {}) => {
  if (!heroCombat.enabled) return SCORE_MAX;
  if (!heroCombat.count) return 0;
  const issuesPerCombat = getHeroCombatIssueCount(heroCombat) / Math.max(1, heroCombat.count);
  return clamp(roundTo(SCORE_MAX - Math.min(SCORE_MAX, issuesPerCombat * 2.5)), 0, SCORE_MAX);
};

const estimateHeroCombatMinutes = (heroCombat = {}) => {
  if (!heroCombat.enabled || !heroCombat.count) return 0;
  return heroCombat.combats.reduce((total, { combat }) => {
    const enemyHealth = getCombatEnemyHealth(combat);
    const difficulty = getCombatDifficulty(combat);
    const healthWeight = Math.min(4, enemyHealth / 8);
    const difficultyWeight = Math.max(0, difficulty - 10) * 0.15;
    return total + clamp(2 + healthWeight + difficultyWeight, 2, 8);
  }, 0);
};

const buildAdvancedAnalysis = ({ project, scenes, items, enigmas, cinematics, map, content, transitions, transitionIndexes }) => {
  const startSceneId = getStartSceneId(project, map.details.rooms);
  const reachableSceneIds = getReachableSceneIds({ startSceneId, scenes, transitionIndexes });
  const endSceneIds = new Set(map.details.rooms.filter((room) => room.type === 'end' && room.sceneId).map((room) => room.sceneId));

  const unreachableScenes = scenes.filter((scene) => scenes.length > 1 && !reachableSceneIds.has(scene.id));
  const deadPathScenes = scenes.filter((scene) => (
    scenes.length > 1
    && reachableSceneIds.has(scene.id)
    && !endSceneIds.has(scene.id)
    && !transitionIndexes.outgoingBySceneId.has(scene.id)
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
  let dominantEnigmaTypeCount = 0;
  const enigmaTypeCounts = new Map();
  enigmas.forEach((enigma) => {
    const type = enigma.type || 'code';
    const nextCount = (enigmaTypeCounts.get(type) || 0) + 1;
    enigmaTypeCounts.set(type, nextCount);
    dominantEnigmaTypeCount = Math.max(dominantEnigmaTypeCount, nextCount);
  });
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
  const heroAdventure = collectHeroSkillChecks(project, scenes);
  const heroCombat = collectHeroCombats(project, scenes);
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
    heroAdventure,
    heroCombat,
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
    { id: 'scenes', label: 'Scènes', score: Math.min(1.1, (scenes.length / 6) * 1.1), max: 1.1 },
    { id: 'items', label: 'Objets', score: Math.min(0.8, (items.length / 6) * 0.8), max: 0.8 },
    { id: 'enigmas', label: 'Énigmes', score: Math.min(0.9, (enigmas.length / 4) * 0.9), max: 0.9 },
    { id: 'cinematics', label: 'Cinématiques', score: Math.min(0.5, (cinematics.length / 2) * 0.5), max: 0.5 },
  ];

  return {
    score: criteria.reduce((total, criterion) => total + criterion.score, 0),
    max: SCORE_WEIGHTS.structure,
    criteria,
  };
};

const buildMapSection = ({ scenes, routeMap, transitionIndexes }) => {
  const { rooms, connections } = getRouteMapRoomsAndConnections(routeMap);
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const mappedSceneCount = new Set(rooms.map((room) => room.sceneId).filter(Boolean)).size;
  const mappedRatio = scenes.length ? mappedSceneCount / scenes.length : 0;
  const validConnections = connections.filter((connection) => (
    roomsById.has(connection.fromRoomId)
    && roomsById.has(connection.toRoomId)
  ));
  const connectionStatuses = validConnections.map((connection) => getConnectionStatus(roomsById, connection, transitionIndexes.pairs));
  const connectionCounts = connectionStatuses.reduce((counts, status) => {
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const connectionQuality = connectionStatuses.length
    ? connectionStatuses.reduce((total, status) => total + getConnectionScore(status), 0) / connectionStatuses.length
    : 0;
  const hasStartRoom = rooms.some((room) => room.type === 'start');

  const criteria = [
    { id: 'mappedScenes', label: 'Scènes mappees', score: mappedRatio * 1.3, max: 1.3 },
    { id: 'connections', label: 'Liaisons jouables', score: connectionQuality * 2, max: 2 },
    { id: 'startRoom', label: 'Départ sur le plan', score: hasStartRoom ? 0.4 : 0, max: 0.4 },
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
  const heroCombat = collectHeroCombats(project, scenes);
  const heroCombatQuality = heroCombat.enabled ? getHeroCombatQualityScore(heroCombat) / SCORE_MAX : null;

  const criteria = heroCombat.enabled ? [
    { id: 'actions', label: 'Scènes interactives', score: actionRatio * 0.8, max: 0.8 },
    { id: 'enigmaSolutions', label: 'Solutions énigmes', score: enigmaRatio * 0.5, max: 0.5 },
    { id: 'start', label: 'Point de départ', score: startValid ? 0.3 : 0, max: 0.3 },
    { id: 'heroCombats', label: 'Combats héros', score: heroCombatQuality * 0.4, max: 0.4 },
  ] : [
    { id: 'actions', label: 'Scènes interactives', score: actionRatio * 1, max: 1 },
    { id: 'enigmaSolutions', label: 'Solutions énigmes', score: enigmaRatio * 0.7, max: 0.7 },
    { id: 'start', label: 'Point de départ', score: startValid ? 0.3 : 0, max: 0.3 },
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
      heroCombatQuality: heroCombat.enabled ? roundTo(heroCombatQuality * SCORE_MAX) : null,
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
    { id: 'sceneMood', label: 'Ambiance scènes', score: moodRatio * 0.18, max: 0.18 },
    { id: 'cinematicContent', label: 'Cinématiques renseignees', score: cinematicRatio * 0.12, max: 0.12 },
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

const getPlaytimeRange = ({ scenes, items, enigmas, cinematics, connections, heroCombat }) => {
  const heroCombatMinutes = estimateHeroCombatMinutes(heroCombat);
  const estimatedMinutes = Math.max(5, Math.round(
    scenes.length * 2.5
    + enigmas.length * 5
    + cinematics.length * 1.5
    + items.length * 0.8
    + Math.max(0, connections - scenes.length) * 1.2
    + heroCombatMinutes
  ));

  return {
    estimatedMinutes,
    heroCombatMinutes: roundTo(heroCombatMinutes),
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

const buildExpectedPlayerRanges = ({ acts, scenes, heroCombatCount = 0 }) => {
  const actCount = Math.max(1, acts.length);
  const sceneCount = Math.max(1, scenes.length);
  const combatTimeBoost = heroCombatCount * 3;
  const combatActionBoost = heroCombatCount;
  const timeIdealMin = clamp(Math.round((actCount * 8) + (sceneCount * 2.5) + (combatTimeBoost * 0.7)), 20, 120);
  const timeIdealMax = clamp(Math.round((actCount * 18) + (sceneCount * 6) + (combatTimeBoost * 1.4)), timeIdealMin + 20, 240);
  const actionIdealMin = clamp(Math.round((actCount * 2) + (sceneCount * 1.2) + combatActionBoost), 8, 90);
  const actionIdealMax = clamp(Math.round((actCount * 6) + (sceneCount * 4) + (combatActionBoost * 2)), actionIdealMin + 12, 220);
  const complexityIdealMax = clamp(roundTo(7 + (actCount * 0.25) + (sceneCount * 0.03) + Math.min(1, heroCombatCount * 0.2)), 7, 9.5);

  return {
    time: {
      idealMin: timeIdealMin,
      idealMax: timeIdealMax,
      hardMin: 5,
      hardMax: Math.max(120, Math.round(timeIdealMax * 1.75)),
    },
    actions: {
      idealMin: actionIdealMin,
      idealMax: actionIdealMax,
      hardMin: 0,
      hardMax: Math.max(55, Math.round(actionIdealMax * 1.8)),
    },
    complexity: {
      idealMin: 4,
      idealMax: complexityIdealMax,
      hardMin: 0,
      hardMax: 10,
    },
  };
};

const getExperienceDepthScore = ({ acts, scenes }) => {
  const actCount = Math.max(0, acts.length);
  const sceneCount = Math.max(0, scenes.length);
  return clamp(roundTo(
    2
    + Math.min(3, actCount * 0.9)
    + Math.min(5, sceneCount * 0.45)
  ), 0, SCORE_MAX);
};

const buildPlayerScore = ({ acts, scenes, items, enigmas, cinematics, transitions, advancedAnalysis, estimatedMinutes, playtimeRange }) => {
  const actions = collectProjectActions(scenes);
  const actionableActions = actions.filter(({ action }) => (
    action.actionType !== 'dialogue'
    || action.targetSceneId
    || action.targetCinematicId
    || action.externalUrl
    || action.targetProjectId
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
  const heroCombatCount = advancedAnalysis.heroCombat?.enabled ? advancedAnalysis.heroCombat.count : 0;
  const heroCombatPressure = scenes.length ? heroCombatCount / scenes.length : heroCombatCount;
  const complexity = clamp(roundTo(
    averageDifficulty
    + Math.min(2, logicRuleCount / 4)
    + Math.min(1.5, branchDensity)
    + Math.min(1, inventoryPressure / 2)
    + Math.min(1, enigmaPressure)
    + Math.min(1, timedScenes / 2)
    + Math.min(1.2, heroCombatPressure * 2)
  ), 0, SCORE_MAX);

  const expectedRanges = buildExpectedPlayerRanges({ acts, scenes, heroCombatCount });
  const time = getBalancedRangeScore(
    estimatedMinutes,
    expectedRanges.time.idealMin,
    expectedRanges.time.idealMax,
    expectedRanges.time.hardMin,
    expectedRanges.time.hardMax
  );
  const actionScore = getBalancedRangeScore(
    actionableActions.length,
    expectedRanges.actions.idealMin,
    expectedRanges.actions.idealMax,
    expectedRanges.actions.hardMin,
    expectedRanges.actions.hardMax
  );
  const complexityScore = getBalancedRangeScore(
    complexity,
    expectedRanges.complexity.idealMin,
    expectedRanges.complexity.idealMax,
    expectedRanges.complexity.hardMin,
    expectedRanges.complexity.hardMax
  );
  const depthScore = getExperienceDepthScore({ acts, scenes });
  const score = clamp(roundTo((time * 0.25) + (actionScore * 0.25) + (complexityScore * 0.3) + (depthScore * 0.2)), 0, SCORE_MAX);

  return {
    score,
    label: `${score.toFixed(1).replace('.', ',')}/10`,
    time: {
      score: time,
      estimatedMinutes,
      range: playtimeRange,
      expectedRange: {
        min: expectedRanges.time.idealMin,
        max: expectedRanges.time.idealMax,
      },
      label: `${playtimeRange.min}-${playtimeRange.max} min`,
    },
    actions: {
      score: actionScore,
      count: actionableActions.length,
      expectedRange: {
        min: expectedRanges.actions.idealMin,
        max: expectedRanges.actions.idealMax,
      },
      totalConfigured: actions.length,
      logicRules: logicRuleCount,
    },
    complexity: {
      score: complexityScore,
      value: complexity,
      expectedRange: {
        min: expectedRanges.complexity.idealMin,
        max: expectedRanges.complexity.idealMax,
      },
      averageEnigmaDifficulty: averageDifficulty,
      branchDensity: roundTo(branchDensity, 2),
      inventoryPressure: roundTo(inventoryPressure, 2),
      enigmaPressure: roundTo(enigmaPressure, 2),
      heroCombatPressure: roundTo(heroCombatPressure, 2),
      timedScenes,
    },
    depth: {
      score: depthScore,
      acts: acts.length,
      scenes: scenes.length,
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
    badges.push(makeBadge('good-flow', 'Bon flow', 'Le parcours est fluide, lisible et peu susceptible dé bloquer le joueur.'));
  }

  if (dimensions.narration >= 8 && cinematicRatio >= 0.75 && scenes.length >= 2) {
    badges.push(makeBadge('strong-narration', 'Narration forte', 'Les scènes et cinematiques donnent une vraie continuité narrative.'));
  }

  if (
    puzzleCount >= 2
    || advancedAnalysis.difficulty.average >= 7
    || (playerScore.complexity.value >= 7 && enigmas.length >= 2)
  ) {
    badges.push(makeBadge('expert-puzzle', 'Puzzle expert', 'Les énigmes proposent une complexite solide pour les joueurs qui aiment reflechir.', 'expert'));
  }

  if (advancedAnalysis.variety.enigmaTypes >= 3 || advancedAnalysis.variety.actionTypes >= 4) {
    badges.push(makeBadge('varied-gameplay', 'Gameplay varié', 'Le projet alterne plusieurs types d’interactions et d énigmes.'));
  }

  if (playerScore.time.score >= 8 && playerScore.actions.score >= 8) {
    badges.push(makeBadge('balanced-session', 'Session bien calibree', 'Le temps estime et le nombre d’actions semblent confortables cote joueur.'));
  }

  if (map.details.mappedRatio === 1 && map.details.connectionQuality >= 0.9 && content.details.startValid) {
    badges.push(makeBadge('clean-map', 'Plan propre', 'Toutes les scènes importantes sont mappees avec des liaisons solides.'));
  }

  if (advancedAnalysis.heroCombat.enabled && advancedAnalysis.heroCombat.count && getHeroCombatIssueCount(advancedAnalysis.heroCombat) === 0) {
    badges.push(makeBadge('hero-combat-ready', 'Combats prêts', 'Les combats Hero ont une difficulté, des issues et un gain lisibles.', 'expert'));
  }

  return badges.slice(0, 6);
};

const makeFeedback = (level, label, message, metric = '') => ({ level, label, message, metric });

const buildFeedback = ({ acts, scenes, items, enigmas, cinematics, map, content, polish, advancedAnalysis, playerScore }) => {
  const feedback = [];
  const connectionCounts = map.details.connectionCounts;

  if (map.details.mappedRatio >= 0.85 && map.details.connectionQuality >= 0.8 && scenes.length > 1) {
    feedback.push(makeFeedback('success', 'Bon maillage des scènes', 'Le plan couvre la majorite des scènes et les liaisons sont jouables.'));
  }
  if (content.details.actionRatio >= 0.75 && scenes.length) {
    feedback.push(makeFeedback('success', 'Scènes bien interactives', 'La plupart des scènes proposent au moins une action utile.'));
  }
  if (content.details.startValid) {
    feedback.push(makeFeedback('success', 'Départ valide', 'Le joueur arrive bien sur une scène ou une cinématique existante.'));
  }

  if (!acts.length) feedback.push(makeFeedback('warning', 'Structure absente', 'Crée au moins un acte pour structurer le parcours.'));
  if (scenes.length < 4) feedback.push(makeFeedback('warning', 'Peu de scènes', 'Ajoute quelques scènes pour donner plus de matiere au parcours.', `${scenes.length}/4`));
  if (items.length < 3) feedback.push(makeFeedback('warning', 'Inventaire léger', 'Ajoute des objets d’inventaire pour enrichir les interactions.', `${items.length}/3`));
  if (enigmas.length < 2) feedback.push(makeFeedback('warning', 'Trop peu d énigmes', 'Ajoute des énigmes pour renforcer la progression du joueur.', `${enigmas.length}/2`));
  if (!cinematics.length) feedback.push(makeFeedback('warning', 'Pas de cinematic', 'Ajoute une cinématique d introduction, de transition ou de fin.'));
  if (map.details.mappedRatio < 1 && scenes.length) feedback.push(makeFeedback('warning', 'Scènes non mappees', 'Associe toutes les scènes importantes à une pièce du plan.', `${map.details.mappedSceneCount}/${scenes.length}`));
  if (connectionCounts.partial) feedback.push(makeFeedback('warning', 'Allers simples à confirmer', 'Valide les allers simples voulus ou ajoute la zone d’action de retour.', String(connectionCounts.partial)));
  if (content.details.actionRatio < 0.75 && scenes.length) feedback.push(makeFeedback('warning', 'Interactions inegales', 'Ajoute des zones d’action utiles dans les scènes encore peu interactives.'));
  if (content.details.enigmaRatio < 1 && enigmas.length) feedback.push(makeFeedback('warning', 'Énigmes incompletes', 'Complete les solutions des énigmes incompletes.', `${content.details.solvedEnigmas}/${enigmas.length}`));
  if (polish.details.moodRatio < 0.5 && scenes.length) feedback.push(makeFeedback('warning', 'Ambiance à renforcer', 'Ajoute quelques médias, sons ou effets visuels sur les scènes clés.'));
  if (advancedAnalysis.variety.lacksVariety) feedback.push(makeFeedback('warning', 'Manque de variete', 'Varie les types d énigmes, les modes de réponse ou les actions disponibles.', `${advancedAnalysis.variety.enigmaTypes} type(s)`));
  if (advancedAnalysis.difficulty.incoherent) feedback.push(makeFeedback('warning', 'Difficulté incoherente', 'La courbe de difficulté semble brusque: énigmes trop faciles/trop dures ou timer trop agressif.', `moy. ${advancedAnalysis.difficulty.average}/10`));
  if (advancedAnalysis.heroAdventure.enabled && !advancedAnalysis.heroAdventure.count) {
    feedback.push(makeFeedback('warning', 'Hero Adventure sans test', 'Ajoute au moins un Test de compétence dans une zone ou une réponse de conversation.', '0 test'));
  }
  if (advancedAnalysis.heroAdventure.withoutSkill.length) {
    feedback.push(makeFeedback('danger', 'Test sans compétence valide', 'Certains tests Hero Adventure n’ont pas de compétence existante sélectionnée.', String(advancedAnalysis.heroAdventure.withoutSkill.length)));
  }
  if (advancedAnalysis.heroAdventure.withoutDifficulty.length) {
    feedback.push(makeFeedback('warning', 'Test sans difficulté', 'Certains tests Hero Adventure n’ont pas de difficulté claire. Donne un seuil comme 10, 12 ou 15.', String(advancedAnalysis.heroAdventure.withoutDifficulty.length)));
  }
  if (advancedAnalysis.heroAdventure.withoutFailureBranch.length) {
    feedback.push(makeFeedback('warning', 'Échec sans conséquence', 'Certains tests Hero Adventure n ont ni message, ni perte de PV, ni branche d’échec.', String(advancedAnalysis.heroAdventure.withoutFailureBranch.length)));
  }
  if (advancedAnalysis.heroAdventure.costly.length) {
    feedback.push(makeFeedback('danger', 'Coût mana impossible', 'Certains tests coutent plus de mana que le maximum du héros.', `${advancedAnalysis.heroAdventure.costly.length}/${advancedAnalysis.heroAdventure.maxMana}`));
  }
  if (advancedAnalysis.heroAdventure.punishing.length) {
    feedback.push(makeFeedback('warning', 'Échec trop punitif', "Certains tests peuvent retirer tous les PV du héros en un seul échec. Vérifie que c'est volontaire.", String(advancedAnalysis.heroAdventure.punishing.length)));
  }
  if (advancedAnalysis.heroCombat.enabled && !advancedAnalysis.heroCombat.count) {
    feedback.push(makeFeedback('warning', 'Mode héros sans combat', 'Ajoute au moins un combat Hero pour exploiter les PV, les compétences et les récompenses.', '0 combat'));
  }
  if (advancedAnalysis.heroCombat.withoutSkill.length) {
    feedback.push(makeFeedback('danger', 'Combat sans compétence valide', 'Certains combats Hero n’ont pas de compétence existante sélectionnée.', String(advancedAnalysis.heroCombat.withoutSkill.length)));
  }
  if (advancedAnalysis.heroCombat.withoutDifficulty.length || advancedAnalysis.heroCombat.withoutEnemyHealth.length) {
    feedback.push(makeFeedback('warning', 'Combat incomplet', 'Certains combats manquent de difficulté ou de PV ennemi.', String(advancedAnalysis.heroCombat.withoutDifficulty.length + advancedAnalysis.heroCombat.withoutEnemyHealth.length)));
  }
  if (advancedAnalysis.heroCombat.withoutVictoryBranch.length || advancedAnalysis.heroCombat.withoutDefeatBranch.length) {
    feedback.push(makeFeedback('danger', 'Combat sans issue claire', 'Chaque combat devrait avoir une suite de victoire et une suite de défaite.', String(advancedAnalysis.heroCombat.withoutVictoryBranch.length + advancedAnalysis.heroCombat.withoutDefeatBranch.length)));
  }
  if (advancedAnalysis.heroCombat.withoutRewardOrNarrativePayoff.length) {
    feedback.push(makeFeedback('warning', 'Combat sans gain narratif', 'Ajoute une récompense, une révélation ou une scène de victoire utile aux combats concernes.', String(advancedAnalysis.heroCombat.withoutRewardOrNarrativePayoff.length)));
  }
  if (advancedAnalysis.heroCombat.lethalEnemyDamage.length) {
    feedback.push(makeFeedback('warning', 'Dégâts ennemis trop forts', "Certains ennemis peuvent retirer tous les PV du héros en une attaque. Vérifie que c'est volontaire.", String(advancedAnalysis.heroCombat.lethalEnemyDamage.length)));
  }
  if (playerScore.time.score < 6) feedback.push(makeFeedback('warning', 'Rythme joueur a ajuster', 'Le temps estime semble trop court ou trop long pour une session confortable.', playerScore.time.label));
  if (playerScore.actions.score < 6) feedback.push(makeFeedback('warning', 'Volume d’actions desequilibre', 'Le parcours contient trop peu ou trop d’actions utiles pour le temps estime.', String(playerScore.actions.count)));
  if (playerScore.complexity.score < 6) feedback.push(makeFeedback('warning', 'Complexite joueur a lisser', 'La charge mentale joueur semble trop faible, trop forte ou trop concentree.', `${playerScore.complexity.value}/10`));

  if (!content.details.startValid) feedback.push(makeFeedback('danger', 'Départ introuvable', 'Vérifie le point de départ du jeu.'));
  if (!map.details.hasStartRoom) feedback.push(makeFeedback('danger', 'Départ absent du plan', 'Marque une pièce comme départ dans le plan.'));
  if (connectionCounts.missing) feedback.push(makeFeedback('danger', 'Liaisons bloquées', 'Certaines liaisons du plan ne correspondent a aucune zone d’action.', String(connectionCounts.missing)));
  if (content.details.deadEndActions) feedback.push(makeFeedback('danger', 'Certaines zones ne menent a rien', 'Corrige les zones qui pointent vers une scène, une cinématique ou une énigme manquante.', String(content.details.deadEndActions)));
  if (advancedAnalysis.deadPaths.count) feedback.push(makeFeedback('danger', 'Chemins morts', 'Des scènes atteignables ne proposent aucune suite et ne sont pas marquees comme fin.', String(advancedAnalysis.deadPaths.count)));
  if (advancedAnalysis.blockedProgression.count) feedback.push(makeFeedback('danger', 'Progression bloquée', 'Certaines scènes ou conditions de logique semblent impossibles a atteindre.', String(advancedAnalysis.blockedProgression.count)));

  if (!feedback.length) {
    feedback.push(makeFeedback('success', 'Projet cohérent', 'Les dernières améliorations seront surtout du polish: ambiance, médias, rythme et tests joueur.'));
  }

  return feedback;
};

const getConclusion = (score) => {
  if (score >= 9) return 'Projet très solide: le parcours est lisible, cohérent et presque prêt à être testé en conditions réelles.';
  if (score >= 7) return 'Bonne base: le jeu est jouable, avec quelques points de coherence ou de contenu a renforcer.';
  if (score >= 5) return 'Projet prometteur: la structure existe, mais le plan et les interactions doivent encore être consolides.';
  return 'Projet encore en construction: commence par relier les scènes, poser le départ et ajouter des interactions clés.';
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

const buildGameplayDimension = ({ content, transitions, scenes, advancedAnalysis }) => {
  const transitionRatio = scenes.length > 1 ? clamp(transitions.length / scenes.length, 0, 1) : 0;
  const baseScore = clamp(roundTo(
    (content.details.actionRatio * 4)
    + (content.details.enigmaRatio * 3)
    + (content.details.startValid ? 1 : 0)
    + (transitionRatio * 2)
  ), 0, SCORE_MAX);
  if (!advancedAnalysis?.heroCombat?.enabled) return baseScore;
  return clamp(roundTo((baseScore * 0.85) + (getHeroCombatQualityScore(advancedAnalysis.heroCombat) * 0.15)), 0, SCORE_MAX);
};

const buildCompletionDimension = ({ structure, map, content, polish }) => (
  clamp(roundTo(
    normalizeSectionScore(structure) * 0.35
    + normalizeSectionScore(map) * 0.25
    + normalizeSectionScore(content) * 0.25
    + normalizeSectionScore(polish) * 0.15
  ), 0, SCORE_MAX)
);

const buildScoreDimensions = ({ structure, map, content, polish, scenes, cinematics, transitions, advancedAnalysis }) => ({
  structure: normalizeSectionScore(structure),
  gameplay: buildGameplayDimension({ content, transitions, scenes, advancedAnalysis }),
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
  const transitionIndexes = buildTransitionIndexes(transitions);

  const structure = buildStructureSection({ acts, scenes, items, enigmas, cinematics });
  const map = buildMapSection({ scenes, routeMap: project.routeMap || {}, transitionIndexes });
  const content = buildContentSection({ project, scenes, enigmas, cinematics });
  const polish = buildPolishSection({ scenes, cinematics });
  const rawScore = structure.score + map.score + content.score + polish.score;
  const score = clamp(roundTo(rawScore), 0, SCORE_MAX);
  const advancedAnalysis = buildAdvancedAnalysis({
    project,
    scenes,
    items,
    enigmas,
    cinematics,
    map,
    content,
    transitions,
    transitionIndexes,
  });
  const { estimatedMinutes, heroCombatMinutes, playtimeRange } = getPlaytimeRange({
    scenes,
    items,
    enigmas,
    cinematics,
    connections: map.details.validConnections.length,
    heroCombat: advancedAnalysis.heroCombat,
  });
  const playerScore = buildPlayerScore({
    acts,
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
    advancedAnalysis,
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
      heroCombatMinutes,
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
      heroSkillChecks: advancedAnalysis.heroAdventure.count,
      heroSkillCheckIssues: advancedAnalysis.heroAdventure.withoutSkill.length
        + advancedAnalysis.heroAdventure.withoutDifficulty.length
        + advancedAnalysis.heroAdventure.withoutFailureBranch.length
        + advancedAnalysis.heroAdventure.costly.length
        + advancedAnalysis.heroAdventure.punishing.length,
      heroCombats: advancedAnalysis.heroCombat.count,
      heroCombatIssues: getHeroCombatIssueCount(advancedAnalysis.heroCombat),
    },
    summary: [
      `Structure: ${sections.structure.toFixed(1)}/4`,
      `Plan: ${sections.map.toFixed(1)}/3,7`,
      `Contenu: ${sections.content.toFixed(1)}/2`,
      `Polish: ${sections.polish.toFixed(1)}/0,3`,
      `${acts.length} acte(s), ${scenes.length} scène(s), ${items.length} objet(s), ${enigmas.length} énigme(s), ${cinematics.length} cinematic(s)`,
      advancedAnalysis.heroCombat.enabled ? `${advancedAnalysis.heroCombat.count} combat(s) Hero` : '',
    ].filter(Boolean).join(' - '),
  };
}

export const scoreProject = calculateProjectScore;
