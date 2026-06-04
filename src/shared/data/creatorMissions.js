import {
  getEntryActions,
  getSceneActionSources,
  getSceneTransitions,
} from '../services/projectTransitions';

const getScenes = (project) => (Array.isArray(project?.scenes) ? project.scenes : []);
const getItems = (project) => (Array.isArray(project?.items) ? project.items : []);
const getEnigmas = (project) => (Array.isArray(project?.enigmas) ? project.enigmas : []);
const getCinematics = (project) => (Array.isArray(project?.cinematics) ? project.cinematics : []);

const getProjectActions = (project) => getScenes(project).flatMap((scene) => (
  getSceneActionSources(scene, { includeInactiveObjects: false }).flatMap((source) => getEntryActions(source).map((action) => ({
    ...action,
    sceneId: scene.id,
  })))
));

const getAllSceneObjects = (project) => getScenes(project).flatMap((scene) => (
  (Array.isArray(scene.sceneObjects) ? scene.sceneObjects : [])
    .filter((object) => object?.clickMode !== 'none')
    .map((object) => ({
      ...object,
      sceneId: scene.id,
    }))
));

const getConversationReplies = (hotspot) => {
  const nodes = Array.isArray(hotspot?.conversation?.nodes) ? hotspot.conversation.nodes : [];
  return nodes.flatMap((node) => (Array.isArray(node.replies) ? node.replies : []));
};

const getConversationEffects = (reply) => (Array.isArray(reply?.effects) ? reply.effects : []);

const hasText = (value) => String(value || '').trim().length > 0;

const hasValidEnigmaContent = (enigma = {}) => {
  if (!enigma?.id) return false;
  const type = enigma.type || 'code';
  if (type === 'colors') return Array.isArray(enigma.solutionColors) && enigma.solutionColors.length > 0;
  if (type === 'misc') {
    if (hasText(enigma.solutionText)) return true;
    if (Array.isArray(enigma.miscCorrectChoices) && enigma.miscCorrectChoices.length > 0) return true;
    return hasText(enigma.miscTargetItemId);
  }
  return hasText(enigma.solutionText);
};

const hasCinematicContent = (cinematic = {}) => {
  if (!cinematic?.id) return false;
  if (hasText(cinematic.videoData) || hasText(cinematic.videoName)) return true;
  if (Array.isArray(cinematic.steps) && cinematic.steps.some((step) => (
    hasText(step.content)
    || hasText(step.text)
    || hasText(step.imageData)
    || hasText(step.audioData)
    || hasText(step.videoData)
  ))) return true;
  return Array.isArray(cinematic.slides) && cinematic.slides.some((slide) => (
    hasText(slide.narration)
    || hasText(slide.imageData)
    || hasText(slide.audioData)
  ));
};

const getShareState = (project, projectRecord) => ({
  ...(project?.shareState || {}),
  ...(projectRecord?.shareState || {}),
});

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

  return getSceneTransitions(project, { includeInactiveObjects: false }).some((transition) => (
    sceneIds.has(transition.fromSceneId)
    && sceneIds.has(transition.toSceneId)
    && transition.fromSceneId !== transition.toSceneId
  ));
};

export const hasHiddenObject = (project) => {
  const itemIds = new Set(getItems(project).map((item) => item.id).filter(Boolean));
  if (!itemIds.size) return false;

  const actionRewards = getProjectActions(project).some((action) => (
    itemIds.has(action.rewardItemId)
    || itemIds.has(action.skillCheckSuccessRewardItemId)
    || itemIds.has(action.combatRewardItemId)
    || getConversationEffects(action).some((effect) => (
      ['add_item', 'item'].includes(effect.type) && itemIds.has(effect.itemId || effect.rewardItemId)
    ))
  ));

  if (actionRewards) return true;

  const conversationRewards = getScenes(project).some((scene) => (
    (scene.hotspots || []).some((hotspot) => getConversationReplies(hotspot).some((reply) => (
      itemIds.has(reply.rewardItemId)
      || getConversationEffects(reply).some((effect) => (
        ['add_item', 'item'].includes(effect.type) && itemIds.has(effect.itemId || effect.rewardItemId)
      ))
    )))
  ));

  if (conversationRewards) return true;

  if (getAllSceneObjects(project).some((object) => (
    itemIds.has(object.linkedItemId)
    || itemIds.has(object.rewardItemId)
  ))) return true;

  if (getCinematics(project).some((cinematic) => (
    (cinematic.onEndType === 'item' || hasText(cinematic.rewardItemId))
    && itemIds.has(cinematic.rewardItemId)
  ))) return true;

  return false;
};

export const hasCreatedEnigma = (project) => {
  const enigmas = getEnigmas(project).filter(hasValidEnigmaContent);
  return enigmas.length > 0;
};

export const hasCreatedCinematic = (project) => {
  const cinematics = getCinematics(project).filter(hasCinematicContent);
  return cinematics.length > 0;
};

export const hasPublishedProject = (project, projectRecord = null) => Boolean(
  getShareState(project, projectRecord).isPublic
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
