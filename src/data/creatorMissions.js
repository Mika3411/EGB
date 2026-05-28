const getScenes = (project) => (Array.isArray(project?.scenes) ? project.scenes : []);
const getItems = (project) => (Array.isArray(project?.items) ? project.items : []);
const getEnigmas = (project) => (Array.isArray(project?.enigmas) ? project.enigmas : []);
const getCinematics = (project) => (Array.isArray(project?.cinematics) ? project.cinematics : []);

const getAllHotspots = (project) => getScenes(project).flatMap((scene) => (
  (Array.isArray(scene.hotspots) ? scene.hotspots : []).map((hotspot) => ({
    ...hotspot,
    sceneId: scene.id,
  }))
));

const getAllSceneObjects = (project) => getScenes(project).flatMap((scene) => (
  (Array.isArray(scene.sceneObjects) ? scene.sceneObjects : []).map((object) => ({
    ...object,
    sceneId: scene.id,
  }))
));

const getConversationReplies = (hotspot) => {
  const nodes = Array.isArray(hotspot?.conversation?.nodes) ? hotspot.conversation.nodes : [];
  return nodes.flatMap((node) => (Array.isArray(node.replies) ? node.replies : []));
};

const getConversationEffects = (reply) => (Array.isArray(reply?.effects) ? reply.effects : []);

export const CREATOR_MISSIONS = [
  {
    id: 'linked_scenes',
    number: 1,
    title: 'Créer deux lieux reliés',
    description: 'Deux scènes existent et une zone d’action envoie vers une autre scène.',
    actionLabel: 'Démarrage guidé',
    tutorialTab: 'guided_creation',
  },
  {
    id: 'hidden_object',
    number: 2,
    title: 'Ajouter un objet caché',
    description: 'Un objet existe et peut être obtenu depuis une zone ou un objet visible.',
  },
  {
    id: 'enigma',
    number: 3,
    title: 'Créer une énigme',
    description: 'Le projet contient au moins une énigme jouable.',
  },
  {
    id: 'cinematic',
    number: 4,
    title: 'Ajouter une cinématique',
    description: 'Une séquence narrative existe dans le projet.',
  },
  {
    id: 'publish',
    number: 5,
    title: 'Publier son premier jeu',
    description: 'Le projet est publié et possède un lien public.',
  },
];

export const hasLinkedScenes = (project) => {
  const scenes = getScenes(project);
  const sceneIds = new Set(scenes.map((scene) => scene.id).filter(Boolean));
  if (scenes.length < 2 || sceneIds.size < 2) return false;

  return getAllHotspots(project).some((hotspot) => (
    (hotspot.actionType === 'scene' || Boolean(hotspot.targetSceneId))
    && hotspot.targetSceneId
    && sceneIds.has(hotspot.targetSceneId)
    && hotspot.targetSceneId !== hotspot.sceneId
  ));
};

export const hasHiddenObject = (project) => {
  const itemIds = new Set(getItems(project).map((item) => item.id).filter(Boolean));
  if (!itemIds.size) return false;

  const hotspotRewards = getAllHotspots(project).some((hotspot) => {
    if (itemIds.has(hotspot.rewardItemId) || itemIds.has(hotspot.secondRewardItemId)) return true;
    return getConversationReplies(hotspot).some((reply) => (
      itemIds.has(reply.rewardItemId)
      || getConversationEffects(reply).some((effect) => (
        ['add_item', 'item'].includes(effect.type) && itemIds.has(effect.itemId || effect.rewardItemId)
      ))
    ));
  });

  if (hotspotRewards) return true;

  return getAllSceneObjects(project).some((object) => (
    itemIds.has(object.linkedItemId)
    || itemIds.has(object.rewardItemId)
  ));
};

export const hasCreatedEnigma = (project) => getEnigmas(project).length > 0;
export const hasCreatedCinematic = (project) => getCinematics(project).length > 0;

export const hasPublishedProject = (project, projectRecord = null) => Boolean(
  projectRecord?.shareState?.isPublic
  || project?.shareState?.isPublic
);

export const getCreatorMissionProgress = (project, projectRecord = null) => {
  const completedById = {
    linked_scenes: hasLinkedScenes(project),
    hidden_object: hasHiddenObject(project),
    enigma: hasCreatedEnigma(project),
    cinematic: hasCreatedCinematic(project),
    publish: hasPublishedProject(project, projectRecord),
  };

  const missions = CREATOR_MISSIONS.map((mission) => ({
    ...mission,
    isComplete: Boolean(completedById[mission.id]),
  }));
  const completedCount = missions.filter((mission) => mission.isComplete).length;

  return {
    missions,
    completedCount,
    totalCount: missions.length,
    allDone: completedCount === missions.length,
    badgeLabel: 'Premier escape game publié',
  };
};
