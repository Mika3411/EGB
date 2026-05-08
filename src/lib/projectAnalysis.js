export const CREATION_MODES = [
  ['beginner', 'Debutant'],
  ['intermediate', 'Intermediaire'],
  ['expert', 'Expert'],
];

export const MODE_RANKS = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
};

export const getProjectName = (project) =>
  project?.name || project?.data?.title || project?.data?.name || 'Projet sans titre';

export const getProjectStats = (project) => {
  const data = project?.data || {};
  return {
    scenes: Array.isArray(data.scenes) ? data.scenes.length : 0,
    enigmas: Array.isArray(data.enigmas) ? data.enigmas.length : 0,
    cinematics: Array.isArray(data.cinematics) ? data.cinematics.length : 0,
  };
};

export const getProjectModeLabel = (project) => (
  CREATION_MODES.find(([value]) => value === project?.data?.creationMode)?.[1] || 'Debutant'
);

export const getProjectMode = (project) => (
  Object.prototype.hasOwnProperty.call(MODE_RANKS, project?.data?.creationMode) ? project.data.creationMode : 'beginner'
);

export const getAvailableUpgradeModes = (project) => {
  const currentRank = MODE_RANKS[getProjectMode(project)] ?? 0;
  return CREATION_MODES.filter(([value]) => (MODE_RANKS[value] ?? 0) > currentRank);
};

export const getProjectCompletion = (project) => {
  const data = project?.data || {};
  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  const cinematics = Array.isArray(data.cinematics) ? data.cinematics : [];
  const enigmas = Array.isArray(data.enigmas) ? data.enigmas : [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const cinematicIds = new Set(cinematics.map((cinematic) => cinematic.id));
  const enigmaIds = new Set(enigmas.map((enigma) => enigma.id));

  const isMissingLink = (hotspot, prefix = '') => {
    const actionType = hotspot?.[`${prefix}ActionType`] || 'dialogue';
    const sceneId = hotspot?.[`${prefix}TargetSceneId`] || '';
    const cinematicId = hotspot?.[`${prefix}TargetCinematicId`] || '';
    const enigmaId = hotspot?.[`${prefix}EnigmaId`] || '';

    return (
      (actionType === 'scene' && (!sceneId || !sceneIds.has(sceneId)))
      || (actionType === 'cinematic' && (!cinematicId || !cinematicIds.has(cinematicId)))
      || (enigmaId && !enigmaIds.has(enigmaId))
    );
  };

  const unlinkedHotspots = scenes.reduce((count, scene) => (
    count + (scene.hotspots || []).filter((hotspot) => (
      isMissingLink(hotspot) || (hotspot.hasSecondAction && isMissingLink(hotspot, 'second'))
    )).length
  ), 0);

  const enigmasWithoutSolution = enigmas.filter((enigma) => {
    if (enigma.type === 'code') return !String(enigma.solutionText || '').trim();
    if (enigma.type === 'misc') {
      const miscMode = enigma.miscMode || 'free-answer';
      if (['free-answer', 'multiple-choice', 'true-false', 'fill-blank', 'exact-number'].includes(miscMode)) return !String(enigma.solutionText || '').trim();
      if (miscMode === 'numeric-range') return !String(enigma.miscMin ?? '').trim() || !String(enigma.miscMax ?? '').trim();
      if (miscMode === 'item-select') return !enigma.miscTargetItemId;
      if (miscMode === 'accepted-answers') return !Array.isArray(enigma.miscChoices) || enigma.miscChoices.length === 0;
      if (miscMode === 'matching') return !Array.isArray(enigma.miscPairs) || enigma.miscPairs.length === 0;
      if (miscMode === 'multi-select') return !Array.isArray(enigma.miscCorrectChoices) || enigma.miscCorrectChoices.length === 0;
      if (miscMode === 'ordering') return !Array.isArray(enigma.miscChoices) || enigma.miscChoices.length === 0;
    }
    if (enigma.type === 'colors' || enigma.type === 'simon') return !Array.isArray(enigma.solutionColors) || enigma.solutionColors.length === 0;
    if (['puzzle', 'rotation', 'dragdrop'].includes(enigma.type)) return !enigma.imageData;
    return false;
  }).length;

  return {
    scenes: scenes.length,
    unlinkedHotspots,
    enigmasWithoutSolution,
  };
};
