import {
  makeAct,
  makeCinematic,
  makeCinematicSlide,
  makeCombination,
  makeEnigma,
  makeHotspot,
  makeItem,
  makeLogicRule,
  makeScene,
  normalizeProject,
} from '../data/projectData';

const endpoint = import.meta.env.VITE_AI_GENERATION_ENDPOINT || '/api/generate';
const jobEndpoint = import.meta.env.VITE_AI_JOB_ENDPOINT || '/api/ai-job';

const makeAiHeaders = (userId) => ({
  'Content-Type': 'application/json',
  ...(userId ? { 'X-AI-User-Id': userId } : {}),
});

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
};

const difficultyLabel = {
  easy: 'facile',
  normal: 'intermédiaire',
  hard: 'difficile',
};

const compactHotspotForPrompt = (hotspot = {}) => ({
  id: hotspot.id,
  name: hotspot.name,
  actionType: hotspot.actionType,
  dialogue: hotspot.dialogue,
  requiredItemId: hotspot.requiredItemId,
  rewardItemId: hotspot.rewardItemId,
  targetSceneId: hotspot.targetSceneId,
  targetCinematicId: hotspot.targetCinematicId,
  enigmaId: hotspot.enigmaId,
  secondActionType: hotspot.hasSecondAction ? hotspot.secondActionType : undefined,
  secondDialogue: hotspot.hasSecondAction ? hotspot.secondDialogue : undefined,
  secondRequiredItemId: hotspot.secondRequiredItemId,
  secondRewardItemId: hotspot.secondRewardItemId,
  secondTargetSceneId: hotspot.secondTargetSceneId,
  secondTargetCinematicId: hotspot.secondTargetCinematicId,
  secondEnigmaId: hotspot.secondEnigmaId,
  logicRules: (hotspot.logicRules || []).map((rule) => ({
    id: rule.id,
    name: rule.name,
    conditionType: rule.conditionType,
    itemId: rule.itemId,
    hotspotId: rule.hotspotId,
    conditionEnigmaId: rule.conditionEnigmaId,
    cinematicId: rule.cinematicId,
    combinationId: rule.combinationId,
    actionType: rule.actionType,
    dialogue: rule.dialogue,
    rewardItemId: rule.rewardItemId,
    targetSceneId: rule.targetSceneId,
    targetCinematicId: rule.targetCinematicId,
    enigmaId: rule.enigmaId,
  })),
});

const truncatePromptText = (value, maxLength = 500) => {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
};

const compactProjectForPrompt = (project = {}) => ({
  title: project.title,
  acts: (project.acts || []).map((act) => ({ id: act.id, name: act.name })),
  start: project.start,
  scenes: (project.scenes || []).map((scene) => ({
    id: scene.id,
    name: scene.name,
    actId: scene.actId,
    parentSceneId: scene.parentSceneId,
    introText: scene.introText,
    hotspots: (scene.hotspots || []).map(compactHotspotForPrompt),
  })),
  items: (project.items || []).map((item) => ({ id: item.id, name: item.name, icon: item.icon })),
  combinations: (project.combinations || []).map((combo) => ({
    id: combo.id,
    itemAId: combo.itemAId,
    itemBId: combo.itemBId,
    resultItemId: combo.resultItemId,
    message: combo.message,
  })),
  enigmas: (project.enigmas || []).map((enigma) => ({
    id: enigma.id,
    name: enigma.name,
    type: enigma.type,
    question: enigma.question,
    solutionText: enigma.solutionText,
    solutionColors: enigma.solutionColors,
    unlockType: enigma.unlockType,
    targetSceneId: enigma.targetSceneId,
    targetCinematicId: enigma.targetCinematicId,
  })),
  cinematics: (project.cinematics || []).map((cinematic) => ({
    id: cinematic.id,
    name: cinematic.name,
    cinematicType: cinematic.cinematicType,
    onEndType: cinematic.onEndType,
    targetSceneId: cinematic.targetSceneId,
    rewardItemId: cinematic.rewardItemId,
    slides: (cinematic.slides || []).map((slide) => ({
      id: slide.id,
      narration: slide.narration,
    })),
  })),
});

const compactProjectForExtendPrompt = (project = {}, continuationSceneId = '') => {
  const scenes = project.scenes || [];
  const anchorScene = scenes.find((scene) => scene.id === continuationSceneId)
    || getNarrativeEndScene(project)
    || scenes[scenes.length - 1]
    || null;

  return {
    title: project.title,
    acts: (project.acts || []).map((act) => ({ id: act.id, name: act.name })),
    start: project.start,
    scenes: scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      actId: scene.actId,
      parentSceneId: scene.parentSceneId,
      introText: truncatePromptText(scene.introText, 260),
      exits: (scene.hotspots || [])
        .filter((hotspot) => hotspot.targetSceneId || hotspot.secondTargetSceneId)
        .map((hotspot) => ({
          id: hotspot.id,
          name: hotspot.name,
          targetSceneId: hotspot.targetSceneId,
          secondTargetSceneId: hotspot.secondTargetSceneId,
          requiredItemId: hotspot.requiredItemId,
          enigmaId: hotspot.enigmaId,
        })),
    })),
    anchorScene: anchorScene ? {
      id: anchorScene.id,
      name: anchorScene.name,
      actId: anchorScene.actId,
      parentSceneId: anchorScene.parentSceneId,
      introText: truncatePromptText(anchorScene.introText, 900),
      hotspots: (anchorScene.hotspots || []).map((hotspot) => ({
        ...compactHotspotForPrompt(hotspot),
        dialogue: truncatePromptText(hotspot.dialogue, 380),
        secondDialogue: truncatePromptText(hotspot.secondDialogue, 260),
        logicRules: (hotspot.logicRules || []).map((rule) => ({
          id: rule.id,
          name: rule.name,
          conditionType: rule.conditionType,
          actionType: rule.actionType,
          dialogue: truncatePromptText(rule.dialogue, 240),
          itemId: rule.itemId,
          rewardItemId: rule.rewardItemId,
          targetSceneId: rule.targetSceneId,
          enigmaId: rule.enigmaId,
        })),
      })),
    } : null,
    items: (project.items || []).map((item) => ({ id: item.id, name: item.name, icon: item.icon })),
    combinations: (project.combinations || []).map((combo) => ({
      id: combo.id,
      itemAId: combo.itemAId,
      itemBId: combo.itemBId,
      resultItemId: combo.resultItemId,
      message: truncatePromptText(combo.message, 180),
    })),
    enigmas: (project.enigmas || []).map((enigma) => ({
      id: enigma.id,
      name: enigma.name,
      type: enigma.type,
      question: truncatePromptText(enigma.question, 220),
      unlockType: enigma.unlockType,
      targetSceneId: enigma.targetSceneId,
      targetCinematicId: enigma.targetCinematicId,
    })),
    cinematics: (project.cinematics || []).map((cinematic) => ({
      id: cinematic.id,
      name: cinematic.name,
      onEndType: cinematic.onEndType,
      targetSceneId: cinematic.targetSceneId,
      rewardItemId: cinematic.rewardItemId,
    })),
  };
};

const PLAYABILITY_AND_COHERENCE_RULES = `
Règles de logique et de jouabilité à respecter dans toutes les générations:
- Évite le parcours en ligne droite: une création complète, progressive ou ajoutée doit proposer des branches, des scènes pivot, des liens multiples et des retours utiles quand le volume demandé le permet.
- Le retour arrière doit servir à quelque chose: nouvel usage d'objet, nouvelle lecture d'indice, nouvel état, passage débloqué ou dialogue modifié.
- Les actes doivent rester séparés: après une transition vers un acte suivant, aucun hotspot ni aucune règle ne doit permettre de revenir à un acte précédent.
- Toute transition inter-acte doit être à sens unique et signalée dans routeMap.connections avec allowOneWay: true quand routeMap est renvoyé.
- Dans routeMap, relie toutes les scènes qui partagent une zone d'action, une transition directe ou un passage à sens unique. Marque locked: true si le lien dépend d'un objet, d'une énigme, d'une cinématique, d'une combinaison ou d'une logicRule.
- Aucune impasse bloquante: tout objet requis doit être obtenable avant son usage; toute énigme doit avoir ses indices avant sa résolution; aucun objet consommé ne doit être nécessaire plus tard sauf solution alternative explicite.
- Les indices d'une énigme ne doivent pas être dans la même scène que l'énigme. Place-les dans une ou plusieurs autres scènes et renseigne clueSceneIds et logicNotes quand tu crées ou modifies une énigme.
- Interdit aux énigmes évidentes: pas de solution écrite telle quelle dans le décor puis répétée dans la narration; pas de question qui donne directement le code ou l'ordre. Les indices doivent demander déduction, comparaison, ordre, transformation ou croisement entre scènes.
- Les scènes créées ou enrichies doivent avoir des consignes concrètes dans instructions quand le champ est renvoyé.
- Les prompts de scène doivent être en français et décrire lieu, ambiance, zones d'action et indices non-inventaire visibles.
- Très important: les prompts d'image de scène ne doivent pas citer ni montrer les objets d'inventaire, car l'utilisateur les cachera lui-même dans l'image.
- Les objets créés doivent avoir imagePrompt en français, isolé sur fond transparent ou neutre.
- Les slides de cinématique créées doivent avoir imagePrompt en français, cohérent avec les scènes et sans contradiction narrative.
- Tout doit rester cohérent entre scènes, cinématiques, objets, énigmes, routeMap, combinations et logicRules.
`.trim();

const makeGeneratePrompt = (brief) => `
Tu es un concepteur d'escape game narratif.
Génère uniquement un JSON compatible avec cette structure:
{
  "title": string,
  "acts": [{"id": string, "name": string}],
  "scenes": [{
    "id": string,
    "name": string,
    "actId": string,
    "parentSceneId": string,
    "imagePrompt": string,
    "introText": string,
    "instructions": string[],
    "hotspots": [{
      "id": string,
      "name": string,
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "actionType": "dialogue"|"dialogue_item"|"scene"|"cinematic",
      "dialogue": string,
      "requiredItemId": string,
      "rewardItemId": string,
      "targetSceneId": string,
      "targetCinematicId": string,
      "enigmaId": string,
      "lockedMessage": string,
      "logicRules": [{
        "id": string,
        "name": string,
        "conditionType": "has_item"|"used_hotspot"|"solved_enigma"|"launched_cinematic"|"made_combination",
        "itemId": string,
        "hotspotId": string,
        "conditionEnigmaId": string,
        "cinematicId": string,
        "combinationId": string,
        "actionType": "dialogue"|"dialogue_item"|"scene"|"cinematic",
        "dialogue": string,
        "rewardItemId": string,
        "targetSceneId": string,
        "targetCinematicId": string,
        "enigmaId": string
      }]
    }]
  }],
  "items": [{"id": string, "name": string, "icon": string, "imagePrompt": string}],
  "combinations": [{"id": string, "itemAId": string, "itemBId": string, "resultItemId": string, "message": string}],
  "enigmas": [{
    "id": string,
    "name": string,
    "type": "code"|"colors"|"misc",
    "question": string,
    "solutionText": string,
    "solutionColors": string[],
    "successMessage": string,
    "failMessage": string,
    "unlockType": "none"|"scene"|"cinematic",
    "targetSceneId": string,
    "targetCinematicId": string,
    "clueSceneIds": string[],
    "logicNotes": string
  }],
  "cinematics": [{"id": string, "name": string, "cinematicType": "slides", "slides": [{"id": string, "narration": string, "imagePrompt": string}], "onEndType": "none"|"scene", "targetSceneId": string}],
  "routeMap": {
    "rooms": [{"id": string, "name": string, "sceneId": string, "x": number, "y": number, "type": "start"|"room"|"end"}],
    "connections": [{"id": string, "fromRoomId": string, "toRoomId": string, "label": string, "locked": boolean, "allowOneWay": boolean}],
    "notes": string
  },
  "start": {"type": "scene", "targetSceneId": string, "targetCinematicId": ""},
  "designNotes": {
    "actLocks": string,
    "backtracking": string[],
    "antiSoftLock": string[],
    "imagePromptRules": string
  }
}

Contraintes:
- Thème: ${brief.theme}
- Difficulté: ${difficultyLabel[brief.difficulty] || brief.difficulty}
- Actes: ${brief.actCount}
- Scènes principales: ${brief.sceneCount}
- Sous-scènes: ${brief.subsceneCount}
- Objets: ${brief.itemCount}
- Énigmes: ${brief.enigmaCount}
- Cinématiques: ${brief.cinematicCount}
- Ton: ${brief.tone || 'immersif'}
- Durée visée: ${brief.duration || '30 minutes'}
- Les IDs doivent être stables, simples, uniques, sans espaces.
- Les noms visibles des objets doivent être des noms français naturels et concrets. Interdit d'utiliser un ID, une chaîne aléatoire ou un code technique comme name.
- Chaque item doit avoir un name lisible par un joueur et une icon cohérente.
- Les zones doivent relier les scènes, objets, énigmes et cinématiques.
- Les conditions de déblocage doivent utiliser logicRules si une interaction dépend d'un état de jeu.
- Si Actes = 3 et Scènes principales = 24, produis exactement 8 scènes par acte. Plus généralement, répartis les scènes de façon équilibrée entre les actes.
- Structure chaque acte comme un mini-labyrinthe logique non linéaire: au moins une scène pivot, au moins deux branches, au moins deux scènes reliées à plusieurs autres scènes, et au moins un retour utile vers une scène déjà visitée.
- Le joueur doit parfois revenir en arrière dans le même acte pour utiliser un objet, une information ou un état obtenu ailleurs.
- Sépare strictement les actes: une fois l'acte suivant atteint, aucune zone ne doit permettre de revenir à un acte précédent. Les transitions inter-actes doivent être à sens unique dans routeMap.connections avec allowOneWay: true.
- Dans routeMap, relie toutes les scènes qui ont une zone d'action commune ou une transition directe. Marque locked: true si le lien dépend d'un objet, d'une énigme, d'une cinématique ou d'une règle logique.
- Aucune impasse bloquante: tout objet requis doit être obtenable avant son usage, toute énigme doit avoir ses indices avant d'être résolue, et aucune ressource consommée ne doit être indispensable plus tard sauf si une autre solution existe.
- Les indices d'une énigme ne doivent jamais être dans la même scène que l'énigme. Utilise clueSceneIds et explique la logique dans logicNotes.
- Interdit aux énigmes évidentes: pas de code écrit tel quel dans le décor puis redonné par la narration; pas de solution immédiatement visible dans la question. Les indices doivent demander déduction, comparaison, ordre, transformation ou croisement entre scènes.
- Chaque scène doit avoir instructions: 2 à 5 consignes de gameplay concrètes pour le créateur, scène par scène.
- Chaque scène doit avoir imagePrompt en français. Le prompt doit décrire le lieu, l'ambiance, les zones d'action visibles et les indices non-inventaire visibles.
- Très important: les prompts d'image de scène ne doivent pas citer ni montrer les objets d'inventaire à cacher par l'utilisateur. N'inclus donc pas les noms des items dans scene.imagePrompt.
- Chaque objet doit avoir item.imagePrompt en français, isolé sur fond transparent ou neutre.
- Chaque slide de cinématique doit avoir imagePrompt en français, cohérent avec la révélation et sans contradiction avec les scènes.
- Tout doit être cohérent entre scènes, cinématiques, objets, énigmes, routeMap et logicRules.
${PLAYABILITY_AND_COHERENCE_RULES}
- Réponds uniquement avec le JSON, sans Markdown.
`.trim();

const makeImprovePrompt = ({ currentProject, target, instruction }) => {
  const targetScene = currentProject?.scenes?.find((scene) => scene.id === target?.id);
  return `
Tu es un concepteur d'escape game narratif.
Tu dois AMÉLIORER uniquement une petite partie d'un projet existant.

Instruction utilisateur:
${instruction || 'Améliore la scène ciblée.'}

Scène cible:
${JSON.stringify(targetScene || target || {}, null, 2)}

Règles strictes:
- Réponds uniquement avec un JSON partiel, sans Markdown.
- Ne renvoie pas tout le projet.
- Ne modifie que la scène cible.
- Tu peux modifier uniquement:
  - introText pour l'ambiance
  - dialogues des hotspots existants
  - objets d'inventaire liés à cette scène, si nécessaire
- Ne déplace aucune zone: conserve x, y, width, height.
- Ne change pas les actions, les scènes cibles, les énigmes ou les cinématiques liées.
- Conserve les IDs existants.
- Ne crée pas de nouvelle zone.
- Ne crée pas de référence vers une scène, un objet, une énigme, une cinématique ou une combinaison qui n'existe pas.
- Si tu ajoutes ou modifies un objet dans items, ajoute aussi imagePrompt.
- Si tu enrichis un texte ou un dialogue, ne transforme jamais un indice subtil en solution directe.
- Préserve la logique existante: ne place pas l'indice d'une énigme dans la même scène que l'énigme et ne casse pas les retours arrière déjà prévus.
${PLAYABILITY_AND_COHERENCE_RULES}
- Format attendu: {"scenes":[{"id":"id_scene_existante","introText":"...","hotspots":[{"id":"id_zone_existante","dialogue":"..."}]}],"items":[...optionnel]}
- Si tu modifies les hotspots, renvoie seulement leurs IDs et leurs nouveaux dialogues.
`.trim();
};

const makeProgressivePrompt = (brief, { currentProject, stage, enrichmentType }) => `
Tu es un concepteur d'escape game narratif.
Génération progressive demandée: ${stage}.

Brief global:
- Thème: ${brief.theme}
- Difficulté: ${difficultyLabel[brief.difficulty] || brief.difficulty}
- Ton: ${brief.tone || 'immersif'}
- Durée visée: ${brief.duration || '30 minutes'}

Projet actuel:
${JSON.stringify(compactProjectForPrompt(currentProject || {}), null, 2)}

Règles:
- Étape act1: crée une base jouable pour l'Acte 1.
- Étape improveAct1: conserve la structure de l'Acte 1 existant et raffine seulement textes, dialogues, indices et ambiance.
- Étape act2: ajoute seulement l'Acte 2 et ses scènes, objets, énigmes, cinématiques utiles.
- Étape act2_continuity: continue l'histoire en respectant strictement l'Acte 1. Ne crée pas de contradictions.
- Étape enrich: enrichis le projet existant sans casser la structure. Type d'enrichissement: ${enrichmentType || 'dialogues, détails visuels et interactions'}.
- En act1, crée déjà une structure non linéaire dans l'acte: scène pivot, branches, retour utile, objets et indices placés avant leurs usages.
- En act2 et act2_continuity, le passage depuis l'acte précédent doit être à sens unique: ne crée aucun lien de retour vers l'acte précédent.
- En add/enrich, si tu ajoutes routeMap ou modifies des zones de navigation, mets à jour les connexions concernées.
- En add/enrich, si tu ajoutes une scène, donne-lui imagePrompt et instructions.
- En add/enrich, si tu ajoutes un objet ou une cinématique, donne aussi item.imagePrompt ou slide.imagePrompt.
- En improveAct1, act2, act2_continuity et enrich, réponds avec un JSON partiel compatible patch.
- Conserve les IDs existants et ne crée aucune référence invalide.
${PLAYABILITY_AND_COHERENCE_RULES}
- Réponds uniquement avec le JSON, sans Markdown.
`.trim();

const makeExtendPrompt = (brief, {
  currentProject,
  stage,
  instruction,
  storySummary,
  sceneChronology,
  continuationWish,
  continuationSceneId,
}) => {
  const continuationScene = (currentProject?.scenes || []).find((scene) => scene.id === continuationSceneId)
    || currentProject?.scenes?.[currentProject.scenes.length - 1]
    || null;

  return `
Tu es un concepteur d'escape game narratif.
Tu dois continuer ou enrichir un projet existant SANS casser ce qui existe.

Action demandée: ${stage}
Résumé de l'histoire déjà posée:
${storySummary || 'Aucun résumé fourni: déduis la continuité depuis le projet existant.'}

Chronologie canonique des scènes, fournie ou validée par l'utilisateur:
${sceneChronology || 'Aucune chronologie fournie.'}

Scène de départ OBLIGATOIRE pour la suite:
${JSON.stringify(continuationScene || {}, null, 2)}

Direction souhaitée par l'utilisateur:
${continuationWish || instruction || 'Aucune direction imposée: propose une suite aléatoire mais cohérente avec la scène de départ et le résumé.'}

Projet existant:
${JSON.stringify(compactProjectForExtendPrompt(currentProject || {}, continuationSceneId), null, 2)}

Règles strictes:
- Réponds uniquement avec un JSON partiel compatible patch, sans Markdown.
- Conserve les IDs existants.
- Ne supprime aucun acte, scène, objet, énigme, cinématique ou zone existante.
- Ne change la structure existante que si l'action le demande explicitement.
- Toutes les nouvelles références doivent pointer vers des IDs existants ou créés dans ce patch.
- Tous les nouveaux objets doivent avoir un name français naturel et concret, jamais un ID ou une chaîne aléatoire.
- Continue l'histoire avec cohérence: mêmes lieux, mêmes enjeux, même style.
- Pour continue_story et add_scenes, la première nouvelle scène doit être reliée depuis la scène de départ obligatoire.
- La chronologie canonique prime sur l'ordre technique du tableau scenes. La suite doit partir de la dernière scène numérotée, ou de la scène de départ obligatoire si elle est fournie.
- Ajoute ou modifie une zone dans la scène de départ obligatoire pour pointer vers la nouvelle scène.
- Ne pars pas d'une autre scène, sauf si l'utilisateur le demande explicitement.
- Utilise le résumé comme canon narratif: la suite doit répondre à ce qui vient de se passer, pas inventer un nouveau départ.
- La suite doit apporter un vrai nouvel événement narratif: révélation, choix, menace, objectif ou retournement.
- Interdit de nommer une scène "Suite de ...", "Suite - ...", "Nouvelle pièce", "Pièce secrète" ou un objet "Indice ...".
- Interdit d'utiliser des zones génériques comme "Indice caché", "Nouvelle piste" ou "Passage verrouillé" sans détail narratif concret.
- Interdit de répondre avec une scène générique qui dit seulement que la suite reprend les enjeux.
- Les dialogues et introText doivent contenir des détails concrets liés au résumé, à la chronologie et à la scène de départ.
- Pour continue_story, crée au moins une nouvelle scène avec un nom spécifique de lieu ou d'événement, un enjeu clair, 2 zones interactives concrètes minimum, et une interaction qui fait avancer l'histoire.
- Pour continue_story, ne renvoie pas les scènes existantes sauf la scène de départ obligatoire si tu lui ajoutes une zone vers la nouvelle scène.
- Toute nouvelle scène doit avoir imagePrompt en français et instructions.
- Tout nouvel objet doit avoir imagePrompt en français.
- Toute nouvelle cinématique ou slide doit avoir imagePrompt en français.
- Toute nouvelle énigme doit renseigner clueSceneIds et logicNotes si ces champs sont utiles; les indices doivent être placés hors de la scène de résolution.
- Si tu ajoutes ou modifies des passages entre scènes, ajoute ou complète routeMap.rooms et routeMap.connections pour les scènes concernées.
- Si la suite passe dans un nouvel acte, le passage doit être à sens unique et aucune nouvelle zone ne doit revenir vers l'acte précédent.
- Si tu ajoutes 2 ou 3 scènes, ne les aligne pas simplement A -> B -> C: crée au moins une branche, un lien de retour utile ou une scène qui connecte plusieurs chemins.
${PLAYABILITY_AND_COHERENCE_RULES}

Actions:
- continue_story: ajoute obligatoirement 1 à 3 nouvelles scènes de suite, avec au moins une zone de navigation depuis une scène existante vers une nouvelle scène. Ne te contente jamais de réécrire les scènes existantes.
- add_scenes: ajoute obligatoirement 1 à 3 nouvelles scènes et les zones de navigation nécessaires. Ne renvoie pas seulement les scènes existantes.
- add_enigmas: ajoute obligatoirement au moins une nouvelle énigme reliée à une zone ou scène existante.
- enrich_interactions: enrichis zones, objets, dialogues et conditions sans changer l'architecture globale.
`.trim();
};

const parseProjectResponse = (payload) => {
  if (!payload) throw new Error('Réponse IA vide.');
  if (payload.project) return payload.project;
  if (payload.data?.project) return payload.data.project;
  if (typeof payload.output_text === 'string') return JSON.parse(payload.output_text);
  if (typeof payload.text === 'string') return JSON.parse(payload.text);
  return payload;
};

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const waitForAiJob = async (jobId, userId = '') => {
  const startedAt = Date.now();
  const timeout = Number(import.meta.env.VITE_AI_JOB_TIMEOUT_MS || 8 * 60 * 1000);
  const interval = Number(import.meta.env.VITE_AI_JOB_POLL_INTERVAL_MS || 2500);

  while (Date.now() - startedAt < timeout) {
    await wait(interval);
    const url = new URL(jobEndpoint, window.location.origin);
    url.searchParams.set('id', jobId);
    if (userId) url.searchParams.set('userId', userId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: userId ? { 'X-AI-User-Id': userId } : {},
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Suivi IA indisponible (${response.status}).`);
      error.status = response.status;
      throw error;
    }

    if (payload.status === 'complete') return payload;
    if (payload.status === 'error') {
      const error = new Error(payload.error || 'Generation IA echouee.');
      error.code = payload.code;
      throw error;
    }
  }

  const error = new Error('Generation IA toujours en cours. Reessaie dans quelques instants.');
  error.code = 'AI_JOB_TIMEOUT';
  throw error;
};

const itemNameFromId = (id) => String(id || '')
  .replace(/^it_/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Objet IA';

const isBadGeneratedName = (value) => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^[a-z0-9]{6,10}$/i.test(text)) return true;
  if (/^[a-z]*\d+[a-z0-9]*$/i.test(text) && text.length <= 12) return true;
  if (/^(it|obj|item)[_-]?[a-z0-9]+$/i.test(text)) return true;
  return false;
};

const inferItemNameFromProjectUse = (project, itemId) => {
  const candidates = [];
  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      const usesItem = [
        hotspot.requiredItemId,
        hotspot.rewardItemId,
        hotspot.secondRequiredItemId,
        hotspot.secondRewardItemId,
        ...(hotspot.logicRules || []).flatMap((rule) => [rule.itemId, rule.rewardItemId]),
      ].includes(itemId);
      if (!usesItem) return;
      if (hotspot.name && !isBadGeneratedName(hotspot.name)) candidates.push(hotspot.name);
      const dialogueMatch = String(hotspot.dialogue || '').match(/(?:trouves?|ramasses?|obtiens?|découvres?|utilises?)\s+(?:un|une|le|la|l['’])?\s*([^,.!?;:]+)/i);
      if (dialogueMatch?.[1]) candidates.push(dialogueMatch[1].trim());
    });
  });

  return candidates.find((candidate) => !isBadGeneratedName(candidate) && candidate.length <= 40)
    || itemNameFromId(itemId);
};

const repairBadItemNames = (rawProject) => {
  const project = structuredClone(rawProject || {});
  project.items = (project.items || []).map((item) => {
    if (!isBadGeneratedName(item.name)) return item;
    return {
      ...item,
      name: inferItemNameFromProjectUse(project, item.id),
      aiRenamed: true,
    };
  });
  return project;
};

const getBadItemUsages = (project = {}, itemId) => {
  const usages = [];
  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      const usedAs = [];
      if (hotspot.requiredItemId === itemId) usedAs.push('objet requis');
      if (hotspot.rewardItemId === itemId) usedAs.push('objet donné');
      if (hotspot.secondRequiredItemId === itemId) usedAs.push('second objet requis');
      if (hotspot.secondRewardItemId === itemId) usedAs.push('second objet donné');
      (hotspot.logicRules || []).forEach((rule) => {
        if (rule.itemId === itemId) usedAs.push(`condition règle "${rule.name || rule.id}"`);
        if (rule.rewardItemId === itemId) usedAs.push(`récompense règle "${rule.name || rule.id}"`);
      });
      if (!usedAs.length) return;
      usages.push({
        sceneId: scene.id,
        sceneName: scene.name,
        hotspotName: hotspot.name,
        dialogue: hotspot.dialogue,
        usedAs,
      });
    });
  });
  (project.combinations || []).forEach((combo) => {
    const usedAs = [];
    if (combo.itemAId === itemId) usedAs.push('combinaison objet A');
    if (combo.itemBId === itemId) usedAs.push('combinaison objet B');
    if (combo.resultItemId === itemId) usedAs.push('résultat de combinaison');
    if (usedAs.length) usages.push({ combinationId: combo.id, message: combo.message, usedAs });
  });
  return usages.slice(0, 8);
};

const repairBadItemNamesWithApi = async (project, options = {}) => {
  const badItems = (project.items || []).filter((item) => isBadGeneratedName(item.name));
  if (!badItems.length || !endpoint) return project;

  const prompt = ` ?
Tu es l'assistant de cohérence d'un générateur d'escape game.
Certains objets ont reçu des noms techniques ou aléatoires. Tu dois leur donner de vrais noms en français, courts, concrets et utiles dans un inventaire.

Règles:
- Réponds uniquement avec du JSON valide, sans Markdown.
- Ne change jamais les IDs.
- Chaque name doit être un nom d'objet visible ou manipulable, pas une phrase.
- Interdit: noms aléatoires, IDs, "Objet à renommer", "Objet mystérieux" générique si le contexte permet mieux.
- Choisis une icône simple cohérente.

Objets à renommer:
${JSON.stringify(badItems.map((item) => ({
    id: item.id,
    currentName: item.name,
    currentIcon: item.icon,
    usages: getBadItemUsages(project, item.id),
  })), null, 2)}

Format attendu:
{"items":[{"id":"id_existant","name":"Nom lisible","icon":"🔑"}]}
`.trim();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: makeAiHeaders(options.userId),
    body: JSON.stringify({
      prompt,
      mode: 'repair_item_names',
      userId: options.userId,
      responseFormat: 'item-name-map-json',
    }),
  });

  if (!response.ok) return project;

  const payload = await response.json();
  const parsed = parseProjectResponse(payload);
  const replacements = new Map((parsed.items || [])
    .filter((item) => item?.id && item?.name && !isBadGeneratedName(item.name))
    .map((item) => [item.id, item]));

  if (!replacements.size) return project;

  return {
    ...project,
    items: (project.items || []).map((item) => {
      const replacement = replacements.get(item.id);
      return replacement ?
         { ...item, name: replacement.name, icon: replacement.icon || item.icon || '📦', aiRenamed: true }
        : item;
    }),
  };
};

const repairMissingItemReferences = (rawProject) => {
  const project = structuredClone(rawProject || {});
  const existingItemIds = new Set((project.items || []).map((item) => item?.id).filter(Boolean));
  const missingItemIds = new Set();
  const collectItemRef = (id) => {
    if (id && !existingItemIds.has(id)) missingItemIds.add(id);
  };

  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      collectItemRef(hotspot.requiredItemId);
      collectItemRef(hotspot.rewardItemId);
      collectItemRef(hotspot.secondRequiredItemId);
      collectItemRef(hotspot.secondRewardItemId);
      (hotspot.logicRules || []).forEach((rule) => {
        collectItemRef(rule.itemId);
        collectItemRef(rule.rewardItemId);
      });
    });
  });

  (project.combinations || []).forEach((combo) => {
    collectItemRef(combo.itemAId);
    collectItemRef(combo.itemBId);
    collectItemRef(combo.resultItemId);
  });

  (project.enigmas || []).forEach((enigma) => {
    collectItemRef(enigma.miscTargetItemId);
  });

  (project.cinematics || []).forEach((cinematic) => {
    collectItemRef(cinematic.rewardItemId);
  });

  if (!missingItemIds.size) return project;

  project.items = [
    ...(Array.isArray(project.items) ? project.items : []),
    ...Array.from(missingItemIds).map((id) => ({
      ...makeItem(inferItemNameFromProjectUse(project, id), '📦'),
      id,
      aiGenerated: true,
      aiActionLabel: 'Objet référencé par IA',
    })),
  ];
  return project;
};

const sceneNameFromId = (id) => String(id || '')
  .replace(/^sc[_-]/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Scène IA';

const getNarrativeEndScene = (project = {}) => {
  const scenes = project.scenes || [];
  if (!scenes.length) return null;
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  let current = byId.get(project.start?.targetSceneId) || scenes[0];
  const visited = new Set();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const nextId = (current.hotspots || []).find((hotspot) => (
      hotspot.targetSceneId && byId.has(hotspot.targetSceneId) && !visited.has(hotspot.targetSceneId)
    ))?.targetSceneId;
    if (!nextId) break;
    current = byId.get(nextId);
  }

  return current || scenes[scenes.length - 1] || null;
};

const repairMissingSceneReferences = (rawProject) => {
  const project = structuredClone(rawProject || {});
  const existingSceneIds = new Set((project.scenes || []).map((scene) => scene?.id).filter(Boolean));
  const missingScenes = new Map();
  const firstActId = project.acts?.[0]?.id || '';

  const collectSceneRef = (id, sourceScene, label = '') => {
    if (!id || existingSceneIds.has(id) || missingScenes.has(id)) return;
    missingScenes.set(id, {
      ...makeScene({ actId: sourceScene?.actId || firstActId, parentSceneId: sourceScene?.id || '' }),
      id,
      name: label ? `Suite - ${label}` : sceneNameFromId(id),
      introText: sourceScene?.name ?
         `Cette nouvelle scène prolonge directement "${sourceScene.name}".`
        : 'Cette scène a été ajoutée pour réparer une référence de navigation générée par l’IA.',
      hotspots: [],
      aiGenerated: true,
      aiActionLabel: 'Scène référencée par IA',
    });
  };

  (project.scenes || []).forEach((scene) => {
    if (scene.parentSceneId && !existingSceneIds.has(scene.parentSceneId)) scene.parentSceneId = '';
    (scene.hotspots || []).forEach((hotspot) => {
      collectSceneRef(hotspot.targetSceneId, scene, hotspot.name);
      collectSceneRef(hotspot.secondTargetSceneId, scene, hotspot.name);
      (hotspot.logicRules || []).forEach((rule) => {
        collectSceneRef(rule.targetSceneId, scene, rule.name || hotspot.name);
      });
    });
  });

  (project.enigmas || []).forEach((enigma) => {
    collectSceneRef(enigma.targetSceneId, null, enigma.name);
  });

  (project.cinematics || []).forEach((cinematic) => {
    collectSceneRef(cinematic.targetSceneId, null, cinematic.name);
  });

  if (project.start?.targetSceneId && !existingSceneIds.has(project.start.targetSceneId)) {
    project.start.targetSceneId = project.scenes?.[0]?.id || '';
  }

  if (!missingScenes.size) return project;
  project.scenes = [
    ...(Array.isArray(project.scenes) ? project.scenes : []),
    ...Array.from(missingScenes.values()),
  ];
  return project;
};

const assertExtendPatchAddsRequestedContent = (patch, options = {}) => {
  if (options.mode !== 'extend') return;
  const stage = options.stage || 'continue_story';
  const currentProject = options.currentProject || {};
  const currentSceneIds = new Set((currentProject.scenes || []).map((scene) => scene.id));
  const currentEnigmaIds = new Set((currentProject.enigmas || []).map((enigma) => enigma.id));
  const patchScenes = Array.isArray(patch.scenes) ? patch.scenes : [];
  const patchEnigmas = Array.isArray(patch.enigmas) ? patch.enigmas : [];

  if (stage === 'continue_story' || stage === 'add_scenes') {
    const newScenes = patchScenes.filter((scene) => scene?.id && !currentSceneIds.has(scene.id));
    if (!newScenes.length) {
      throw new Error('La réponse IA ne crée aucune nouvelle scène.');
    }
    const genericScene = newScenes.find((scene) => (
      /^suite\b/i.test(String(scene.name || '').trim())
      || /^nouvelle\s+(pi[eè]ce|zone)/i.test(String(scene.name || '').trim())
      || /pi[eè]ce secr[eè]te/i.test(String(scene.name || '').trim())
      || /la suite reprend directement les enjeux/i.test(String(scene.introText || ''))
    ));
    if (genericScene) {
      throw new Error('La réponse IA produit une suite trop générique.');
    }
    const genericHotspot = newScenes.find((scene) => (scene.hotspots || []).some((hotspot) => (
      /^(indice cach[eé]|nouvelle piste|passage verrouill[eé])$/i.test(String(hotspot.name || '').trim())
      || /trouvent un indice li[eé] à/i.test(String(hotspot.dialogue || ''))
      || /m[eè]ne vers suite/i.test(String(hotspot.dialogue || ''))
    )));
    if (genericHotspot) {
      throw new Error('La réponse IA contient des interactions trop génériques.');
    }
    if (stage === 'continue_story') {
      const hasPlayableScene = newScenes.some((scene) => {
        const intro = String(scene.introText || '').trim();
        const concreteHotspots = (scene.hotspots || []).filter((hotspot) => (
          String(hotspot.name || '').trim().length >= 4
          && String(hotspot.dialogue || '').trim().length >= 30
        ));
        return intro.length >= 80 && concreteHotspots.length >= 2;
      });
      if (!hasPlayableScene) {
        throw new Error('La réponse IA ne crée pas une vraie scène jouable pour continuer l’histoire.');
      }
    }
    const anchorSceneId = options.continuationSceneId || getNarrativeEndScene(currentProject)?.id || '';
    const newSceneIds = new Set(newScenes.map((scene) => scene.id));
    const patchedAnchorScene = patchScenes.find((scene) => scene?.id === anchorSceneId);
    const anchorLinksToNewScene = (patchedAnchorScene?.hotspots || []).some((hotspot) => newSceneIds.has(hotspot.targetSceneId));
    if (anchorSceneId && !anchorLinksToNewScene) {
      throw new Error('La réponse IA ne relie pas la scène de départ à une nouvelle scène.');
    }
  }

  if (stage === 'add_enigmas') {
    const newEnigmas = patchEnigmas.filter((enigma) => enigma?.id && !currentEnigmaIds.has(enigma.id));
    if (!newEnigmas.length) {
      throw new Error('La réponse IA ne crée aucune nouvelle énigme.');
    }
  }
};

const minimizeExtendPatch = (patch, options = {}) => {
  if (options.mode !== 'extend' || !patch || typeof patch !== 'object') return patch;
  const currentProject = options.currentProject || {};
  const stage = options.stage || 'continue_story';
  const currentIds = {
    acts: new Set((currentProject.acts || []).map((entry) => entry.id)),
    scenes: new Set((currentProject.scenes || []).map((entry) => entry.id)),
    items: new Set((currentProject.items || []).map((entry) => entry.id)),
    combinations: new Set((currentProject.combinations || []).map((entry) => entry.id)),
    enigmas: new Set((currentProject.enigmas || []).map((entry) => entry.id)),
    cinematics: new Set((currentProject.cinematics || []).map((entry) => entry.id)),
  };
  const anchorSceneId = options.continuationSceneId || getNarrativeEndScene(currentProject)?.id || '';

  const minimized = {};

  if (Array.isArray(patch.acts)) {
    minimized.acts = patch.acts.filter((entry) => entry?.id && !currentIds.acts.has(entry.id));
  }

  if (Array.isArray(patch.scenes)) {
    minimized.scenes = patch.scenes.filter((scene) => {
      if (!scene?.id) return false;
      if (!currentIds.scenes.has(scene.id)) return true;
      if ((stage === 'continue_story' || stage === 'add_scenes') && scene.id === anchorSceneId) {
        const previous = (currentProject.scenes || []).find((entry) => entry.id === scene.id);
        const previousHotspotIds = new Set((previous?.hotspots || []).map((hotspot) => hotspot.id));
        const hasNewHotspot = (scene.hotspots || []).some((hotspot) => !previousHotspotIds.has(hotspot.id));
        return hasNewHotspot;
      }
      return stage === 'enrich_interactions';
    });
  }

  ['items', 'combinations', 'enigmas', 'cinematics'].forEach((key) => {
    if (!Array.isArray(patch[key])) return;
    minimized[key] = patch[key].filter((entry) => entry?.id && !currentIds[key].has(entry.id));
  });

  Object.keys(minimized).forEach((key) => {
    if (Array.isArray(minimized[key]) && minimized[key].length === 0) delete minimized[key];
  });

  return minimized;
};

export async function generateProjectWithApi(brief, options = {}) {
  if (!endpoint) {
    throw new Error('Aucun endpoint IA configuré.');
  }

  const mode = options.mode || 'generate';
  const prompt = mode === 'improve' ?
     makeImprovePrompt(options)
    : mode === 'progressive' ?
       makeProgressivePrompt(brief, options)
      : mode === 'extend' ?
         makeExtendPrompt(brief, options)
      : makeGeneratePrompt(brief);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: makeAiHeaders(options.userId),
    body: JSON.stringify({
      prompt,
      brief,
      mode,
      userId: options.userId,
      currentProject: mode === 'extend' ?
         compactProjectForExtendPrompt(options.currentProject || {}, options.continuationSceneId)
        : compactProjectForPrompt(options.currentProject || {}),
      stage: options.stage,
      enrichmentType: options.enrichmentType,
      target: options.target,
      instruction: options.instruction,
      storySummary: options.storySummary,
      sceneChronology: options.sceneChronology,
      continuationWish: options.continuationWish,
      continuationSceneId: options.continuationSceneId,
      responseFormat: 'escape-game-project-json',
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `API IA indisponible (${response.status}).`);
    error.status = response.status;
    error.code = payload.code;
    error.balance = payload.balance;
    error.required = payload.required;
    throw error;
  }

  let payload = await response.json();
  if (payload.jobId) {
    payload = await waitForAiJob(payload.jobId, options.userId);
  }
  const parsed = repairMissingSceneReferences(repairMissingItemReferences(parseProjectResponse(payload)));
  const apiRenamed = await repairBadItemNamesWithApi(parsed, options);
  const repaired = repairBadItemNames(apiRenamed);
  assertExtendPatchAddsRequestedContent(repaired, { ...options, mode });
  const output = minimizeExtendPatch(repaired, { ...options, mode });
  return mode === 'improve' || mode === 'extend' || (mode === 'progressive' && options.stage !== 'act1') ? output : normalizeProject(output);
}

export function generateProjectLocally(brief) {
  const actCount = clampNumber(brief.actCount, 1, 6, 2);
  const sceneCount = clampNumber(brief.sceneCount, 1, 24, 6);
  const subsceneCount = clampNumber(brief.subsceneCount, 0, 24, 3);
  const itemCount = clampNumber(brief.itemCount, 1, 40, 8);
  const enigmaCount = clampNumber(brief.enigmaCount, 0, 20, 4);
  const cinematicCount = clampNumber(brief.cinematicCount, 0, 12, 2);
  const theme = String(brief.theme || 'Mystère').trim() || 'Mystère';
  const tone = String(brief.tone || 'immersif').trim() || 'immersif';

  const acts = Array.from({ length: actCount }, (_, index) => makeAct(`Acte ${index + 1}`));
  const items = Array.from({ length: itemCount }, (_, index) => (
    makeItem([
      `Indice ${index + 1}`,
      `Clé ${index + 1}`,
      `Fragment ${index + 1}`,
      `Objet ${theme} ${index + 1}`,
    ][index % 4], ['🔎', '🗝️', '📜', '🧩'][index % 4])
  ));

  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const act = acts[index % acts.length];
    const scene = makeScene({ actId: act.id });
    scene.name = `${theme} - Lieu ${index + 1}`;
    scene.introText = `Dans ce lieu ${tone}, un détail lié à ${theme} semble guider les joueurs vers la suite.`;
    scene.hotspots = [];
    return scene;
  });

  Array.from({ length: subsceneCount }, (_, index) => {
    const parent = scenes[index % scenes.length];
    const scene = makeScene({ actId: parent.actId, parentSceneId: parent.id });
    scene.name = `${parent.name} · détail ${index + 1}`;
    scene.introText = `Cette sous-scène révèle une facette plus précise du mystère: ${theme}.`;
    scene.hotspots = [];
    scenes.push(scene);
    return scene;
  });

  const enigmas = Array.from({ length: enigmaCount }, (_, index) => {
    const targetScene = scenes[(index + 1) % scenes.length];
    return makeEnigma({
      name: `Énigme ${index + 1} - ${theme}`,
      type: index % 2 ? 'colors' : 'code',
      question: index % 2 ?
         `Reproduis la séquence liée à ${theme}.`
        : `Entre le code découvert dans les indices de ${theme}.`,
      solutionText: `${(index + 2) * 137}`.slice(0, 4),
      solutionColors: ['red', 'blue', 'green', 'yellow'].slice(0, 3 + (index % 2)),
      successMessage: 'Le mécanisme réagit et une nouvelle piste devient accessible.',
      failMessage: 'La réponse ne correspond pas aux indices.',
      unlockType: targetScene ? 'scene' : 'none',
      targetSceneId: targetScene?.id || '',
    });
  });

  const cinematics = Array.from({ length: cinematicCount }, (_, index) => {
    const cinematic = makeCinematic();
    cinematic.name = `Cinématique ${index + 1} - révélation`;
    cinematic.slides = [makeCinematicSlide()];
    cinematic.slides[0].narration = `Une révélation fait avancer l'histoire de ${theme}.`;
    cinematic.onEndType = scenes[index + 1] ? 'scene' : 'none';
    cinematic.targetSceneId = scenes[index + 1]?.id || '';
    return cinematic;
  });

  scenes.forEach((scene, index) => {
    const nextScene = scenes[index + 1];
    const rewardItem = items[index % items.length];
    const enigma = enigmas[index % Math.max(1, enigmas.length)] || null;
    const cinematic = cinematics[index % Math.max(1, cinematics.length)] || null;

    const inspectSpot = makeHotspot();
    inspectSpot.name = 'Indice principal';
    inspectSpot.x = 24 + ((index * 13) % 45);
    inspectSpot.y = 38 + ((index * 9) % 32);
    inspectSpot.actionType = rewardItem ? 'dialogue_item' : 'dialogue';
    inspectSpot.dialogue = `Les joueurs trouvent un indice important sur ${theme}.`;
    inspectSpot.rewardItemId = rewardItem?.id || '';

    const progressSpot = makeHotspot();
    progressSpot.name = nextScene ? 'Passage verrouillé' : 'Conclusion';
    progressSpot.x = 70;
    progressSpot.y = 50;
    progressSpot.actionType = nextScene ? 'scene' : 'dialogue';
    progressSpot.dialogue = nextScene ?
       'Le passage s’ouvre grâce aux indices déjà collectés.'
      : `Le fil narratif de ${theme} trouve sa résolution.`;
    progressSpot.targetSceneId = nextScene?.id || '';
    progressSpot.requiredItemId = rewardItem?.id || '';
    progressSpot.enigmaId = enigma?.id || '';

    if (cinematic && index % 3 === 0) {
      const rule = makeLogicRule();
      rule.name = 'Après cinématique';
      rule.conditionType = 'launched_cinematic';
      rule.cinematicId = cinematic.id;
      rule.actionType = nextScene ? 'scene' : 'dialogue';
      rule.dialogue = 'La révélation précédente donne un nouveau sens à cette zone.';
      rule.targetSceneId = nextScene?.id || '';
      progressSpot.logicRules = [rule];
    }

    scene.hotspots = [inspectSpot, progressSpot];
  });

  const combinations = [];
  for (let index = 0; index + 2 < items.length; index += 3) {
    const combo = makeCombination();
    combo.itemAId = items[index].id;
    combo.itemBId = items[index + 1].id;
    combo.resultItemId = items[index + 2].id;
    combo.message = `Les deux éléments se combinent et révèlent ${items[index + 2].name}.`;
    combinations.push(combo);
  }

  return normalizeProject({
    title: `Escape game - ${theme}`,
    acts,
    scenes,
    items,
    combinations,
    enigmas,
    cinematics,
    start: { type: 'scene', targetSceneId: scenes[0]?.id || '', targetCinematicId: '' },
  });
}

export function improveProjectLocally(currentProject, target, instruction) {
  const scene = currentProject?.scenes?.find((entry) => entry.id === target?.id) || currentProject?.scenes?.[0];
  if (!scene) {
    throw new Error('Aucune scène disponible à améliorer.');
  }

  const lowerInstruction = String(instruction || '').toLowerCase();
  const stressMode = lowerInstruction.includes('stress') || lowerInstruction.includes('angoiss') || lowerInstruction.includes('tension');
  const moodText = stressMode ?
     'L’air semble plus lourd, les sons se rapprochent, et chaque détail donne l’impression que quelque chose vient de bouger hors champ.'
    : `La scène gagne en intensité: ${instruction || 'les indices deviennent plus lisibles et la progression plus nette.'}`;

  const hotspots = (scene.hotspots || []).map((hotspot, index) => ({
    id: hotspot.id,
    dialogue: hotspot.dialogue ?
       `${hotspot.dialogue} ${stressMode ? 'Un silence brutal rend cette découverte encore plus inquiétante.' : 'Ce détail prend maintenant plus de poids dans l’histoire.'}`
      : `${index === 0 ? 'Un indice attire le regard.' : 'La zone réagit différemment.'} ${moodText}`,
  }));

  return {
    scenes: [{
      id: scene.id,
      introText: scene.introText ?
         `${scene.introText}\n\n${moodText}`
        : moodText,
      hotspots,
    }],
  };
}

export function generateProgressiveProjectLocally(brief, options = {}) {
  const stage = options.stage || 'act1';
  const currentProject = options.currentProject || {};

  if (stage === 'act1') {
    const project = generateProjectLocally({
      ...brief,
      actCount: 1,
      sceneCount: Math.max(2, Math.ceil(Number(brief.sceneCount || 6) / 2)),
      subsceneCount: Math.max(1, Math.floor(Number(brief.subsceneCount || 2) / 2)),
      itemCount: Math.max(3, Math.ceil(Number(brief.itemCount || 8) / 2)),
      enigmaCount: Math.max(1, Math.ceil(Number(brief.enigmaCount || 4) / 2)),
      cinematicCount: Math.max(1, Math.ceil(Number(brief.cinematicCount || 2) / 2)),
    });
    project.acts[0].name = 'Acte 1';
    project.title = `Escape game progressif - ${brief.theme || 'Mystère'}`;
    return project;
  }

  if (stage === 'improveAct1') {
    const act1Id = currentProject.acts?.[0]?.id;
    return {
      scenes: (currentProject.scenes || [])
        .filter((scene) => !act1Id || scene.actId === act1Id)
        .map((scene) => ({
          ...scene,
          introText: `${scene.introText || ''}\n\nL’ambiance devient plus précise: chaque objet semble avoir été laissé là pour une raison, et le joueur comprend mieux la menace qui s’installe.`.trim(),
          hotspots: (scene.hotspots || []).map((hotspot) => ({
            ...hotspot,
            dialogue: hotspot.dialogue ?
               `${hotspot.dialogue} Un détail supplémentaire rend cette piste plus claire.`
              : 'Un détail discret attire l’attention et renforce la cohérence de l’Acte 1.',
          })),
        })),
    };
  }

  if (stage === 'act2' || stage === 'act2_continuity') {
    const generated = generateProjectLocally({
      ...brief,
      actCount: 1,
      sceneCount: Math.max(2, Math.floor(Number(brief.sceneCount || 6) / 2)),
      subsceneCount: Math.max(1, Math.ceil(Number(brief.subsceneCount || 2) / 2)),
      itemCount: Math.max(3, Math.floor(Number(brief.itemCount || 8) / 2)),
      enigmaCount: Math.max(1, Math.floor(Number(brief.enigmaCount || 4) / 2)),
      cinematicCount: Math.max(1, Math.floor(Number(brief.cinematicCount || 2) / 2)),
    });
    generated.acts[0].name = 'Acte 2';
    generated.scenes.forEach((scene) => {
      scene.name = scene.name.replace('Lieu', 'Acte 2 - Lieu');
      scene.introText = `${scene.introText} Cette partie continue directement les découvertes de l’Acte 1, sans contradiction, et révèle une nouvelle couche du mystère.`;
    });
    return {
      acts: generated.acts,
      scenes: generated.scenes,
      items: generated.items,
      combinations: generated.combinations,
      enigmas: generated.enigmas,
      cinematics: generated.cinematics,
    };
  }

  const enrichmentType = options.enrichmentType || 'all';
  const scenes = (currentProject.scenes || []).slice(0, 8).map((scene, index) => ({
    ...scene,
    introText: enrichmentType === 'visual' || enrichmentType === 'all' ?
       `${scene.introText || ''}\n\nDétail visuel: un élément du décor renforce la tension et donne une direction plus claire aux joueurs.`.trim()
      : scene.introText,
    hotspots: (scene.hotspots || []).map((hotspot, hotspotIndex) => ({
      ...hotspot,
      dialogue: enrichmentType === 'dialogues' || enrichmentType === 'all' ?
         (hotspot.dialogue ?
           `${hotspot.dialogue} ${hotspotIndex === 0 ? 'Un détail discret confirme que cette piste est importante.' : 'Cette interaction prend maintenant plus de sens dans l’ensemble.'}`
          : `Un détail lié à ${brief.theme || 'l’histoire'} attire l’attention.`)
        : hotspot.dialogue,
      placementStatus: hotspot.placementStatus || 'needs_visual_review',
      logicRules: enrichmentType === 'interactions' || enrichmentType === 'all' ?
         (hotspot.logicRules || [])
        : hotspot.logicRules,
    })),
    aiEnrichmentNote: `Enrichissement narratif ${index + 1}`,
  }));

  return { scenes };
}

export function extendProjectLocally(brief, options = {}) {
  const currentProject = normalizeProject(options.currentProject || {});
  const stage = options.stage || 'continue_story';
  const instruction = String(options.continuationWish || options.instruction || '').trim();
  const storySummary = String(options.storySummary || '').trim();
  const theme = brief.theme || currentProject.title || 'mystère';
  const anchorScene = currentProject.scenes?.find((scene) => scene.id === options.continuationSceneId)
    || getNarrativeEndScene(currentProject);
  const defaultActId = anchorScene?.actId || currentProject.acts?.[0]?.id || '';

  if (stage === 'enrich_interactions') {
    return {
      scenes: currentProject.scenes.slice(0, 8).map((scene) => ({
        ...scene,
        hotspots: (scene.hotspots || []).map((hotspot) => ({
          ...hotspot,
          dialogue: hotspot.dialogue ?
             `${hotspot.dialogue} ${instruction || 'Un détail supplémentaire donne plus de poids à cette interaction.'}`
            : instruction || 'Cette zone révèle un nouvel indice utile.',
        })),
      })),
    };
  }

  const newScene = makeScene({ actId: defaultActId });
  newScene.name = stage === 'add_scenes' ?
     (instruction || 'Nouvelle pièce secrète')
    : instruction || `Suite de ${anchorScene?.name || theme}`;
  newScene.introText = stage === 'continue_story' ?
     `Depuis ${anchorScene?.name || 'la scène précédente'}, la suite reprend directement les enjeux établis. ${storySummary ? `Résumé à respecter: ${storySummary.split('\n').slice(0, 3).join(' ')}` : `Nouvelle ? piste: ${instruction || theme}.`}`
    : `Une nouvelle zone s'ajoute à l'exploration depuis ${anchorScene?.name || 'la scène choisie'}: ${instruction || theme}.`;
  newScene.hotspots = [];

  const bridgeHotspot = makeHotspot();
  bridgeHotspot.name = 'Nouvelle piste';
  bridgeHotspot.actionType = 'scene';
  bridgeHotspot.dialogue = `Cette piste mène vers ${newScene.name}.`;
  bridgeHotspot.targetSceneId = newScene.id;
  bridgeHotspot.x = 82;
  bridgeHotspot.y = 52;
  bridgeHotspot.width = 12;
  bridgeHotspot.height = 18;

  const clueItem = makeItem(`Indice ${newScene.name}`, '🔎');
  const clueHotspot = makeHotspot();
  clueHotspot.name = 'Indice caché';
  clueHotspot.actionType = 'dialogue_item';
  clueHotspot.dialogue = `Les joueurs trouvent un indice lié à ${newScene.name}.`;
  clueHotspot.rewardItemId = clueItem.id;
  clueHotspot.x = 42;
  clueHotspot.y = 58;

  newScene.hotspots.push(clueHotspot);

  const patch = {
    scenes: [
      ...(anchorScene ? [{ ...anchorScene, hotspots: [...(anchorScene.hotspots || []), bridgeHotspot] }] : []),
      newScene,
    ],
    items: [clueItem],
  };

  if (stage === 'add_enigmas') {
    const enigma = makeEnigma({
      name: instruction || `Énigme de ${newScene.name}`,
      question: `Résous le mécanisme découvert dans ${newScene.name}.`,
      solutionText: '2413',
      successMessage: 'Le mécanisme se débloque.',
      failMessage: 'Le mécanisme reste immobile.',
      unlockType: 'scene',
      targetSceneId: newScene.id,
    });
    bridgeHotspot.enigmaId = enigma.id;
    patch.enigmas = [enigma];
  }

  return patch;
}

export async function generateAiProject(brief, options = {}) {
  const mode = options.mode || 'generate';
  try {
    return {
      project: await generateProjectWithApi(brief, options),
      source: 'api',
      isPatch: mode === 'improve' || mode === 'extend' || (mode === 'progressive' && options.stage !== 'act1'),
    };
  } catch (error) {
    if (error.code === 'AI_CREDITS_EXHAUSTED' || error.status === 402) {
      throw error;
    }
    if (endpoint) {
      throw error;
    }
    return {
      project: mode === 'improve' ?
         improveProjectLocally(options.currentProject, options.target, options.instruction)
        : mode === 'progressive' ?
           generateProgressiveProjectLocally(brief, options)
          : mode === 'extend' ?
             extendProjectLocally(brief, options)
          : generateProjectLocally(brief),
      source: 'local',
      warning: error.message,
      isPatch: mode === 'improve' || mode === 'extend' || (mode === 'progressive' && options.stage !== 'act1'),
    };
  }
}
