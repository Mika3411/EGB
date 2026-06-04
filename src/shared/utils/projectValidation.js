import { normalizeProject } from '../data/projectData';
import { getLogicActionCompletionIssues, getLogicRuleCompletionIssues, getSceneTimerCompletionIssues } from '../services/logicCompletion';
import { validateProjectSafety } from './projectSafetyValidation';

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

const SCENE_OBJECT_BLOCK_TYPES = new Set(['object', 'text', 'image', 'button', 'input', 'code', 'hint']);

const getSceneObjectBlockType = (object = {}) => (
  SCENE_OBJECT_BLOCK_TYPES.has(object.blockType) ? object.blockType : 'object'
);

const getConversationReplyIds = (hotspot = {}) => (
  (hotspot.conversation?.nodes || []).flatMap((node) => (
    (node.replies || []).map((reply) => reply.id).filter(Boolean)
  ))
);

const validateAdvancedConditionRefs = (condition = {}, ids, errors, prefix) => {
  requireRef(ids.itemIds, errors, condition.itemId || condition.conditionItemId, `${prefix} objet testé`);
  requireRef(ids.sceneIds, errors, condition.sceneId || condition.conditionSceneId, `${prefix} scène visitée`);
  requireRef(ids.actionTargetIds, errors, condition.hotspotId || condition.conditionHotspotId, `${prefix} zone utilisée`);
  requireRef(ids.enigmaIds, errors, condition.enigmaId || condition.conditionEnigmaId, `${prefix} énigme réussie`);
  requireRef(ids.replyIds, errors, condition.replyId || condition.conditionReplyId, `${prefix} réponse choisie`);
};

const addCompletionWarnings = (warnings, issues, prefix) => {
  issues.forEach((issue) => warnings.push(`${prefix}: configuration incomplète - ${issue}.`));
};

const validateLogicRuleRefs = (rule = {}, ids, errors, warnings, prefix) => {
  requireRef(ids.itemIds, errors, rule.itemId, `${prefix} objet testé`);
  requireRef(ids.sceneIds, errors, rule.conditionSceneId || rule.sceneId, `${prefix} scène visitée`);
  requireRef(ids.actionTargetIds, errors, rule.hotspotId, `${prefix} zone franchie`);
  requireRef(ids.enigmaIds, errors, rule.conditionEnigmaId, `${prefix} énigme réussie`);
  requireRef(ids.cinematicIds, errors, rule.cinematicId, `${prefix} cinematic lancée`);
  requireRef(ids.combinationIds, errors, rule.combinationId, `${prefix} combinaison réalisée`);
  requireRef(ids.replyIds, errors, rule.conditionReplyId || rule.replyId, `${prefix} réponse choisie`);
  requireRef(ids.itemIds, errors, rule.rewardItemId, `${prefix} objet donné`);
  requireRef(ids.sceneIds, errors, rule.targetSceneId, `${prefix} scène cible`);
  requireRef(ids.cinematicIds, errors, rule.targetCinematicId, `${prefix} cinematic cible`);
  requireRef(ids.enigmaIds, errors, rule.enigmaId, `${prefix} énigme liée`);
  requireRef(ids.blockTargetIds, errors, rule.targetBlockId, `${prefix} bloc cible`);

  (rule.advancedConditions || []).forEach((condition, index) => {
    validateAdvancedConditionRefs(condition, ids, errors, `${prefix} condition avancée ${index + 1}`);
  });

  addCompletionWarnings(warnings, getLogicRuleCompletionIssues(rule, ids), prefix);
};

const validateActionTargetRefs = (target = {}, ids, errors, warnings, prefix) => {
  requireRef(ids.itemIds, errors, target.requiredItemId, `${prefix} objet requis`);
  requireRef(ids.itemIds, errors, target.rewardItemId, `${prefix} objet donné`);
  requireRef(ids.sceneIds, errors, target.targetSceneId, `${prefix} scène cible`);
  requireRef(ids.cinematicIds, errors, target.targetCinematicId, `${prefix} cinematic cible`);
  requireRef(ids.enigmaIds, errors, target.enigmaId, `${prefix} énigme liée`);
  requireRef(ids.actionTargetIds, errors, target.requiredHotspotId, `${prefix} zone requise`);
  requireRef(ids.blockTargetIds, errors, target.targetBlockId, `${prefix} bloc cible`);

  (target.logicRules || []).forEach((rule) => {
    validateLogicRuleRefs(rule, ids, errors, warnings, `${prefix} règle "${rule.name || rule.id}"`);
  });

  addCompletionWarnings(warnings, getLogicActionCompletionIssues(target, ids), prefix);
};

export function validateProject(rawProject) {
  const safety = validateProjectSafety(rawProject);
  const errors = [...safety.errors];
  const warnings = [...safety.warnings];
  const project = normalizeProject(rawProject);

  const actIds = new Set();
  const sceneIds = new Set();
  const itemIds = new Set();
  const cinematicIds = new Set();
  const enigmaIds = new Set();
  const actionTargetIds = new Set();
  const blockTargetIds = new Set();
  const replyIds = new Set();
  const heroSkillIds = new Set();
  const combinationIds = new Set();
  const allIds = new Set();

  (project.acts || []).forEach((act) => {
    addId(allIds, errors, act.id, `Acte "${act.name || 'sans nom'}"`);
    if (act.id) actIds.add(act.id);
  });
  (project.items || []).forEach((item) => {
    addId(allIds, errors, item.id, `Objet "${item.name || 'sans nom'}"`);
    if (item.id) itemIds.add(item.id);
    if (['health_potion', 'mana_potion'].includes(item.heroItemType || 'none') && Number(item.heroItemAmount) <= 0) {
      warnings.push(`Objet "${item.name || 'sans nom'}": potion héros sans quantite.`);
    }
    if ((item.heroItemType || 'none') === 'equipment') {
      const bonusTarget = item.heroItemBonusTarget || 'skill';
      if (!['skill', 'maxHealth', 'maxMana'].includes(bonusTarget)) {
        warnings.push(`Objet "${item.name || 'sans nom'}": type de bonus d’équipement inconnu.`);
      }
      if (!Number.isFinite(Number(item.heroItemBonus)) || Number(item.heroItemBonus) === 0) {
        warnings.push(`Objet "${item.name || 'sans nom'}": équipement sans bonus utile.`);
      }
      const heroSkills = project.heroAdventure?.hero.skills || [];
      if (bonusTarget === 'skill' && (!item.heroItemSkillId || !heroSkills.some((skill) => skill.id === item.heroItemSkillId))) {
        warnings.push(`Objet "${item.name || 'sans nom'}": équipement sans compétence valide.`);
      }
    }
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
  (project.heroAdventure?.hero?.skills || []).forEach((skill) => {
    if (skill.id) heroSkillIds.add(skill.id);
  });
  (project.scenes || []).forEach((scene) => {
    addId(allIds, errors, scene.id, `Scène "${scene.name || 'sans nom'}"`);
    if (scene.id) sceneIds.add(scene.id);
    (scene.hotspots || []).forEach((hotspot) => {
      addId(allIds, errors, hotspot.id, `Zone "${hotspot.name || 'sans nom'}"`);
      if (hotspot.id) actionTargetIds.add(hotspot.id);
      getConversationReplyIds(hotspot).forEach((replyId) => replyIds.add(replyId));
    });
    (scene.sceneObjects || []).forEach((object) => {
      addId(allIds, errors, object.id, `Objet de scène "${object.name || object.blockLabel || 'sans nom'}"`);
      if (object.id) actionTargetIds.add(object.id);
      if (object.id && getSceneObjectBlockType(object) !== 'object') blockTargetIds.add(object.id);
    });
  });

  if (!project.scenes?.length) errors.push('Le projet doit contenir au moins une scène.');
  requireRef(sceneIds, errors, project.start?.targetSceneId, 'Départ du projet');
  requireRef(cinematicIds, errors, project.start?.targetCinematicId, 'Cinématique de départ');

  const referenceIds = {
    itemIds,
    sceneIds,
    cinematicIds,
    enigmaIds,
    actionTargetIds,
    blockTargetIds,
    combinationIds,
    replyIds,
    heroSkillIds,
  };

  (project.scenes || []).forEach((scene) => {
    requireRef(actIds, errors, scene.actId, `Acte de la scène "${scene.name}"`);
    requireRef(sceneIds, errors, scene.parentSceneId, `Scène parente de "${scene.name}"`);
    if (scene.parentSceneId === scene.id) errors.push(`La scène "${scene.name}" ne peut pas être sa propre parente.`);
    addCompletionWarnings(warnings, getSceneTimerCompletionIssues(scene, referenceIds), `Scène "${scene.name}" timer`);

    (scene.hotspots || []).forEach((hotspot) => {
      const prefix = `Zone "${hotspot.name}"`;
      validateActionTargetRefs(hotspot, referenceIds, errors, warnings, prefix);
      requireRef(sceneIds, errors, hotspot.skillCheckSuccessTargetSceneId, `${prefix} scène de réussite du test`);
      requireRef(sceneIds, errors, hotspot.skillCheckFailureTargetSceneId, `${prefix} scène d’échec du test`);
      requireRef(itemIds, errors, hotspot.skillCheckSuccessRewardItemId, `${prefix} objet gagne par test`);
      requireRef(sceneIds, errors, hotspot.combatVictoryTargetSceneId, `${prefix} scène de victoire du combat`);
      requireRef(sceneIds, errors, hotspot.combatDefeatTargetSceneId, `${prefix} scène de défaite du combat`);
      requireRef(itemIds, errors, hotspot.combatRewardItemId, `${prefix} récompense de combat`);
      requireRef(itemIds, errors, hotspot.secondRequiredItemId, `${prefix} second’objet requis`);
      requireRef(itemIds, errors, hotspot.secondRewardItemId, `${prefix} second’objet donné`);
      requireRef(sceneIds, errors, hotspot.secondTargetSceneId, `${prefix} seconde scène cible`);
      requireRef(cinematicIds, errors, hotspot.secondTargetCinematicId, `${prefix} seconde cinematic cible`);
      requireRef(enigmaIds, errors, hotspot.secondEnigmaId, `${prefix} seconde énigme liée`);
    });

    (scene.sceneObjects || []).forEach((object) => {
      const prefix = `Objet de scène "${object.name || object.blockLabel || object.id}"`;
      validateActionTargetRefs(object, referenceIds, errors, warnings, prefix);
      requireRef(itemIds, errors, object.linkedItemId, `${prefix} objet d’inventaire lié`);
    });
  });

  (project.combinations || []).forEach((combo) => {
    requireRef(itemIds, errors, combo.itemAId, 'Combinaison objet 1');
    requireRef(itemIds, errors, combo.itemBId, 'Combinaison objet 2');
    requireRef(itemIds, errors, combo.resultItemId, 'Combinaison result');
  });

  (project.enigmas || []).forEach((enigma) => {
    requireRef(sceneIds, errors, enigma.targetSceneId, `Énigme "${enigma.name}" scène cible`);
    requireRef(cinematicIds, errors, enigma.targetCinematicId, `Énigme "${enigma.name}" cinematic cible`);
    const miscMode = enigma.miscMode || 'free-answer';
    const miscUsesTextSolution = ['free-answer', 'multiple-choice', 'true-false', 'fill-blank', 'exact-number'].includes(miscMode);
    if ((enigma.type === 'code' || (enigma.type === 'misc' && miscUsesTextSolution)) && !String(enigma.solutionText || '').trim()) {
      warnings.push(`Énigme "${enigma.name}": solution vide.`);
    }
    if (enigma.type === 'misc' && miscMode === 'numeric-range' && (!String(enigma.miscMin ?? '').trim() || !String(enigma.miscMax ?? '').trim())) {
      warnings.push(`Énigme "${enigma.name}": plage numérique incomplète.`);
    }
    if (enigma.type === 'misc' && miscMode === 'item-select' && !enigma.miscTargetItemId) {
      warnings.push(`Énigme "${enigma.name}": objet attendu non selectionné.`);
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
    const patchEntries = key === 'scenes' && !Array.isArray(patch.scenes)
      ? patch['sc\u00e8nes']
      : patch[key];
    if (!Array.isArray(patchEntries)) return;
    const existing = Array.isArray(merged[key]) ? merged[key] : [];
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    patchEntries.forEach((entry) => {
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
