import { normalizeProject } from '../data/projectData';

const addId = (ids, errors, id, label) => {
  if (!id) {
    errors.push(`${label}: id manquant.`);
    return;
  }
  if (ids.has(id)) errors.push(`ID dupliqué: ${id}.`);
  ids.add(id);
};

const requireRef = (ids, errors, value, label) => {
  if (value && !ids.has(value)) errors.push(`${label}: référence introuvable (${value}).`);
};

export function validateProject(rawProject) {
  const errors = [];
  const warnings = [];
  const project = normalizeProject(rawProject);

  const actIds = new Set();
  const sceneIds = new Set();
  const itemIds = new Set();
  const cinematicIds = new Set();
  const enigmaIds = new Set();
  const hotspotIds = new Set();
  const combinationIds = new Set();
  const allIds = new Set();

  (project.acts || []).forEach((act) => {
    addId(allIds, errors, act.id, `Acte "${act.name || 'sans nom'}"`);
    if (act.id) actIds.add(act.id);
  });
  (project.items || []).forEach((item) => {
    addId(allIds, errors, item.id, `Objet "${item.name || 'sans nom'}"`);
    if (item.id) itemIds.add(item.id);
  });
  (project.cinematics || []).forEach((cinematic) => {
    addId(allIds, errors, cinematic.id, `Cinématique "${cinematic.name || 'sans nom'}"`);
    if (cinematic.id) cinematicIds.add(cinematic.id);
  });
  (project.enigmas || []).forEach((enigma) => {
    addId(allIds, errors, enigma.id, `Énigme "${enigma.name || 'sans nom'}"`);
    if (enigma.id) enigmaIds.add(enigma.id);
  });
  (project.combinations || []).forEach((combo) => {
    addId(allIds, errors, combo.id, 'Combinaison');
    if (combo.id) combinationIds.add(combo.id);
  });
  (project.scenes || []).forEach((scene) => {
    addId(allIds, errors, scene.id, `Scène "${scene.name || 'sans nom'}"`);
    if (scene.id) sceneIds.add(scene.id);
    (scene.hotspots || []).forEach((hotspot) => {
      addId(allIds, errors, hotspot.id, `Zone "${hotspot.name || 'sans nom'}"`);
      if (hotspot.id) hotspotIds.add(hotspot.id);
    });
  });

  if (!project.scenes?.length) errors.push('Le projet doit contenir au moins une scène.');
  requireRef(sceneIds, errors, project.start?.targetSceneId, 'Départ du projet');
  requireRef(cinematicIds, errors, project.start?.targetCinematicId, 'Cinématique de départ');

  (project.scenes || []).forEach((scene) => {
    requireRef(actIds, errors, scene.actId, `Acte de la scène "${scene.name}"`);
    requireRef(sceneIds, errors, scene.parentSceneId, `Scène parente de "${scene.name}"`);
    if (scene.parentSceneId === scene.id) errors.push(`La scène "${scene.name}" ne peut pas être sa propre parente.`);

    (scene.hotspots || []).forEach((hotspot) => {
      const prefix = `Zone "${hotspot.name}"`;
      requireRef(itemIds, errors, hotspot.requiredItemId, `${prefix} objet requis`);
      requireRef(itemIds, errors, hotspot.rewardItemId, `${prefix} objet donné`);
      requireRef(sceneIds, errors, hotspot.targetSceneId, `${prefix} scène cible`);
      requireRef(cinematicIds, errors, hotspot.targetCinematicId, `${prefix} cinématique cible`);
      requireRef(enigmaIds, errors, hotspot.enigmaId, `${prefix} énigme liée`);
      requireRef(hotspotIds, errors, hotspot.requiredHotspotId, `${prefix} zone requise`);
      requireRef(itemIds, errors, hotspot.secondRequiredItemId, `${prefix} second objet requis`);
      requireRef(itemIds, errors, hotspot.secondRewardItemId, `${prefix} second objet donné`);
      requireRef(sceneIds, errors, hotspot.secondTargetSceneId, `${prefix} seconde scène cible`);
      requireRef(cinematicIds, errors, hotspot.secondTargetCinematicId, `${prefix} seconde cinématique cible`);
      requireRef(enigmaIds, errors, hotspot.secondEnigmaId, `${prefix} seconde énigme liée`);

      (hotspot.logicRules || []).forEach((rule) => {
        const rulePrefix = `${prefix} règle "${rule.name || rule.id}"`;
        requireRef(itemIds, errors, rule.itemId, `${rulePrefix} objet testé`);
        requireRef(hotspotIds, errors, rule.hotspotId, `${rulePrefix} zone franchie`);
        requireRef(enigmaIds, errors, rule.conditionEnigmaId, `${rulePrefix} énigme réussie`);
        requireRef(cinematicIds, errors, rule.cinematicId, `${rulePrefix} cinématique lancée`);
        requireRef(combinationIds, errors, rule.combinationId, `${rulePrefix} combinaison réalisée`);
        requireRef(itemIds, errors, rule.rewardItemId, `${rulePrefix} objet donné`);
        requireRef(sceneIds, errors, rule.targetSceneId, `${rulePrefix} scène cible`);
        requireRef(cinematicIds, errors, rule.targetCinematicId, `${rulePrefix} cinématique cible`);
        requireRef(enigmaIds, errors, rule.enigmaId, `${rulePrefix} énigme liée`);
      });
    });
  });

  (project.combinations || []).forEach((combo) => {
    requireRef(itemIds, errors, combo.itemAId, 'Combinaison objet 1');
    requireRef(itemIds, errors, combo.itemBId, 'Combinaison objet 2');
    requireRef(itemIds, errors, combo.resultItemId, 'Combinaison résultat');
  });

  (project.enigmas || []).forEach((enigma) => {
    requireRef(sceneIds, errors, enigma.targetSceneId, `Énigme "${enigma.name}" scène cible`);
    requireRef(cinematicIds, errors, enigma.targetCinematicId, `Énigme "${enigma.name}" cinématique cible`);
    const miscMode = enigma.miscMode || 'free-answer';
    const miscUsesTextSolution = ['free-answer', 'multiple-choice', 'true-false', 'fill-blank', 'exact-number'].includes(miscMode);
    if ((enigma.type === 'code' || (enigma.type === 'misc' && miscUsesTextSolution)) && !String(enigma.solutionText || '').trim()) {
      warnings.push(`Énigme "${enigma.name}": solution vide.`);
    }
    if (enigma.type === 'misc' && miscMode === 'numeric-range' && (!String(enigma.miscMin ?? '').trim() || !String(enigma.miscMax ?? '').trim())) {
      warnings.push(`Énigme "${enigma.name}": plage numérique incomplète.`);
    }
    if (enigma.type === 'misc' && miscMode === 'item-select' && !enigma.miscTargetItemId) {
      warnings.push(`Énigme "${enigma.name}": objet attendu non sélectionné.`);
    }
  });

  (project.cinematics || []).forEach((cinematic) => {
    requireRef(sceneIds, errors, cinematic.targetSceneId, `Cinématique "${cinematic.name}" scène cible`);
    requireRef(itemIds, errors, cinematic.rewardItemId, `Cinématique "${cinematic.name}" objet donné`);
    if (!cinematic.slides?.length && cinematic.cinematicType !== 'video') {
      warnings.push(`Cinématique "${cinematic.name}": aucune slide.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    project,
  };
}

export function mergeProjectPatch(currentProject, patch) {
  if (!patch || typeof patch !== 'object') return currentProject;
  const merged = structuredClone(currentProject);

  if (patch.title) merged.title = patch.title;
  if (patch.start) merged.start = { ...(merged.start || {}), ...patch.start };

  ['acts', 'scenes', 'items', 'combinations', 'enigmas', 'cinematics'].forEach((key) => {
    if (!Array.isArray(patch[key])) return;
    const existing = Array.isArray(merged[key]) ? merged[key] : [];
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    patch[key].forEach((entry) => {
      if (!entry?.id) return;
      const previous = byId.get(entry.id) || {};
      const nextEntry = { ...previous, ...entry };
      if (key === 'scenes' && Array.isArray(entry.hotspots) && Array.isArray(previous.hotspots)) {
        const hotspotsById = new Map(previous.hotspots.map((hotspot) => [hotspot.id, hotspot]));
        entry.hotspots.forEach((hotspot) => {
          if (!hotspot?.id) return;
          hotspotsById.set(hotspot.id, { ...(hotspotsById.get(hotspot.id) || {}), ...hotspot });
        });
        nextEntry.hotspots = Array.from(hotspotsById.values());
      }
      byId.set(entry.id, nextEntry);
    });
    merged[key] = Array.from(byId.values());
  });

  return merged;
}
