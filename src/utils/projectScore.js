const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
  if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) return getCinematicTargetSceneIds(project, enigma.targetCinematicId);
  return [];
};

const getActionTargetSceneIds = (project, action) => {
  if (!action) return [];
  if (action.enigmaId) {
    const targets = getEnigmaTargetSceneIds(project, action.enigmaId);
    if (targets.length) return targets;
  }
  if (action.actionType === 'scene' && action.targetSceneId) return [action.targetSceneId];
  if (action.actionType === 'cinematic' && action.targetCinematicId) return getCinematicTargetSceneIds(project, action.targetCinematicId);
  return [];
};

const getSceneTransitions = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || []).flatMap((hotspot) => {
      const actions = [
        hotspot,
        hotspot.hasSecondAction ? {
          actionType: hotspot.secondActionType,
          targetSceneId: hotspot.secondTargetSceneId,
          targetCinematicId: hotspot.secondTargetCinematicId,
          enigmaId: hotspot.secondEnigmaId,
        } : null,
        ...(hotspot.logicRules || []).map((rule) => (
          rule.actionType === 'default' ? hotspot : rule
        )),
      ].filter(Boolean);

      return actions.flatMap((action) => (
        getActionTargetSceneIds(project, action)
          .filter((targetSceneId) => targetSceneId && targetSceneId !== scene.id)
          .map((targetSceneId) => ({ fromSceneId: scene.id, toSceneId: targetSceneId }))
      ));
    })
  ))
);

const getConnectionStatus = (project, rooms, connection, transitions) => {
  const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
  const toRoom = rooms.find((room) => room.id === connection.toRoomId);
  if (!fromRoom?.sceneId || !toRoom?.sceneId) return 'neutral';
  const forward = transitions.some((transition) => transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId);
  const reverse = transitions.some((transition) => transition.fromSceneId === toRoom.sceneId && transition.toSceneId === fromRoom.sceneId);
  if (forward && reverse) return 'ok';
  if (forward || reverse) return connection.allowOneWay ? 'accepted' : 'partial';
  return 'missing';
};

export function calculateProjectScore(project = {}) {
  const acts = project.acts || [];
  const scenes = project.scenes || [];
  const items = project.items || [];
  const enigmas = project.enigmas || [];
  const cinematics = project.cinematics || [];
  const routeMap = project.routeMap || {};
  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const transitions = getSceneTransitions(project);

  const structurePoints =
    (acts.length ? 0.7 : 0) +
    Math.min(1.1, scenes.length / 6 * 1.1) +
    Math.min(0.8, items.length / 6 * 0.8) +
    Math.min(0.9, enigmas.length / 4 * 0.9) +
    Math.min(0.5, cinematics.length / 2 * 0.5);

  const startValid = project.start?.type === 'cinematic'
    ? cinematics.some((cinematic) => cinematic.id === project.start?.targetCinematicId)
    : scenes.some((scene) => scene.id === project.start?.targetSceneId);

  const mappedSceneCount = new Set(rooms.map((room) => room.sceneId).filter(Boolean)).size;
  const mappedRatio = scenes.length ? mappedSceneCount / scenes.length : 0;
  const validConnections = connections.filter((connection) => (
    rooms.some((room) => room.id === connection.fromRoomId) && rooms.some((room) => room.id === connection.toRoomId)
  ));
  const connectionStatuses = validConnections.map((connection) => getConnectionStatus(project, rooms, connection, transitions));
  const connectionCounts = connectionStatuses.reduce((counts, status) => ({
    ...counts,
    [status]: (counts[status] || 0) + 1,
  }), {});
  const connectionQuality = connectionStatuses.length
    ? connectionStatuses.reduce((total, status) => {
      if (status === 'ok') return total + 1;
      if (status === 'accepted') return total + 0.9;
      if (status === 'partial') return total + 0.55;
      if (status === 'neutral') return total + 0.25;
      return total;
    }, 0) / connectionStatuses.length
    : 0;
  const hasStartRoom = rooms.some((room) => room.type === 'start');
  const mapPoints = mappedRatio * 1.3 + connectionQuality * 2 + (hasStartRoom ? 0.4 : 0);

  const scenesWithAction = scenes.filter((scene) => (scene.hotspots || []).some((hotspot) => (
    hotspot.actionType !== 'dialogue' || hotspot.targetSceneId || hotspot.targetCinematicId || hotspot.enigmaId || hotspot.rewardItemId
  ))).length;
  const actionRatio = scenes.length ? scenesWithAction / scenes.length : 0;
  const solvedEnigmas = enigmas.filter((enigma) => (
    String(enigma.solutionText || '').trim() || (Array.isArray(enigma.solutionColors) && enigma.solutionColors.length)
  )).length;
  const enigmaRatio = enigmas.length ? solvedEnigmas / enigmas.length : 1;
  const contentPoints = actionRatio * 1 + enigmaRatio * 0.7 + (startValid ? 0.3 : 0);
  const estimatedMinutes = Math.max(5, Math.round(
    scenes.length * 2.5
    + enigmas.length * 5
    + cinematics.length * 1.5
    + items.length * 0.8
    + Math.max(0, validConnections.length - scenes.length) * 1.2,
  ));
  const playtimeRange = {
    min: Math.max(5, Math.round(estimatedMinutes * 0.75)),
    max: Math.max(8, Math.round(estimatedMinutes * 1.25)),
  };

  const rawScore = structurePoints + mapPoints + contentPoints;
  const score = clamp(Math.round(rawScore * 10) / 10, 0, 10);
  const advice = [];

  if (!acts.length) advice.push('Crée au moins un acte pour structurer le parcours.');
  if (scenes.length < 4) advice.push('Ajoute quelques scènes pour donner plus de matière au parcours.');
  if (items.length < 3) advice.push('Ajoute des objets d’inventaire pour enrichir les interactions.');
  if (enigmas.length < 2) advice.push('Ajoute des énigmes pour renforcer la progression du joueur.');
  if (!cinematics.length) advice.push('Ajoute une cinématique d’introduction, de transition ou de fin.');
  if (!startValid) advice.push('Vérifie le point de départ du jeu.');
  if (mappedRatio < 1 && scenes.length) advice.push('Associe toutes les scènes importantes à une pièce du plan.');
  if (!hasStartRoom) advice.push('Marque une pièce comme départ dans le plan.');
  if (connectionCounts.missing) advice.push('Corrige les liaisons rouges: aucune zone d’action ne relie ces pièces.');
  if (connectionCounts.partial) advice.push('Valide les allers simples voulus ou ajoute la zone d’action de retour.');
  if (actionRatio < 0.75 && scenes.length) advice.push('Ajoute des zones d’action utiles dans les scènes encore peu interactives.');
  if (enigmaRatio < 1) advice.push('Complète les solutions des énigmes incomplètes.');
  if (!advice.length) advice.push('Le projet est cohérent. Les dernières améliorations seront surtout du polish: ambiance, médias, rythme et tests joueur.');

  const conclusion = score >= 9
    ? 'Projet très solide: le parcours est lisible, cohérent et presque prêt à être testé en conditions réelles.'
    : score >= 7
      ? 'Bonne base: le jeu est jouable, avec quelques points de cohérence ou de contenu à renforcer.'
      : score >= 5
        ? 'Projet prometteur: la structure existe, mais le plan et les interactions doivent encore être consolidés.'
        : 'Projet encore en construction: commence par relier les scènes, poser le départ et ajouter des interactions clés.';

  return {
    score,
    label: `${score.toFixed(1).replace('.', ',')}/10`,
    tone: score >= 8 ? 'good' : score >= 6 ? 'warn' : 'danger',
    advice,
    conclusion,
    metrics: {
      acts: acts.length,
      scenes: scenes.length,
      items: items.length,
      enigmas: enigmas.length,
      cinematics: cinematics.length,
      estimatedMinutes,
      playtimeRange,
      mappedScenes: mappedSceneCount,
      connections: validConnections.length,
      connectionCounts,
      scenesWithAction,
      startValid,
    },
    sections: {
      structure: Math.round(structurePoints * 10) / 10,
      map: Math.round(mapPoints * 10) / 10,
      content: Math.round(contentPoints * 10) / 10,
    },
    summary: [
      `Structure: ${structurePoints.toFixed(1)}/4`,
      `Plan: ${mapPoints.toFixed(1)}/3,7`,
      `Contenu: ${contentPoints.toFixed(1)}/2`,
      `${acts.length} acte(s), ${scenes.length} scène(s), ${items.length} objet(s), ${enigmas.length} énigme(s), ${cinematics.length} cinématique(s)`,
    ].join(' · '),
  };
}
