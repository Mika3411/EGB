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
import { getAiAuthHeaders } from './aiAuthHeaders';

const endpoint = import.meta.env.VITE_AI_GENERATION_ENDPOINT || '/api/generate';
const jobEndpoint = import.meta.env.VITE_AI_JOB_ENDPOINT || '/api/ai-job';

const makeAiHeaders = async () => ({
  'Content-Type': 'application/json',
  ...(await getAiAuthHeaders()),
});

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
};

const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
};

const difficultyLabel = {
  easy: 'facile',
  normal: 'intermediaire',
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
  items: (project.items || []).map((item) => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    heroItemType: item.heroItemType,
    heroItemBonusTarget: item.heroItemBonusTarget,
    heroItemSkillId: item.heroItemSkillId,
    heroItemBonus: item.heroItemBonus,
    heroItemAmount: item.heroItemAmount,
  })),
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
    items: (project.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      heroItemType: item.heroItemType,
      heroItemBonusTarget: item.heroItemBonusTarget,
      heroItemSkillId: item.heroItemSkillId,
      heroItemBonus: item.heroItemBonus,
      heroItemAmount: item.heroItemAmount,
    })),
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
- Dans routeMap, chaque canvas contient 15 rooms maximum; si un acte dépasse 15 scènes ou sous-scènes, crée un canvas supplémentaire et renseigne room.canvasId.
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
      "actionType": "dialogue"|"dialogue_item"|"scene"|"cinematic"${brief.adventureChoicesBrief ? '|"conversation"' : ''},
      "dialogue": string,
      "requiredItemId": string,
      "rewardItemId": string,
      "targetSceneId": string,
      "targetCinematicId": string,
      "enigmaId": string,
      "lockedMessage": string,
${brief.heroAdventureBrief ? `
      "heroMalusHealthLoss": number,
      "heroMalusManaLoss": number,
      "heroMalusMessage": string,
` : ''}
${brief.adventureChoicesBrief ? `
      "conversation": {
        "startNodeId": string,
        "nodes": [{
          "id": string,
          "speaker": string,
          "text": string,
          "authorNote": string,
          "replies": [{
            "id": string,
            "label": string,
            "branchTags": string[],
            "authorNote": string,
            "actionType": "node"|"dialogue"|"item"|"multiple"|"scene"|"cinematic"|"enigma"|"ending"|"end",
            "nextNodeId": string,
            "dialogue": string,
            "conditionType": "none"|"has_item"|"visited_scene"|"completed_hotspot"|"solved_enigma"|"chose_reply"|"story_variable"|"advanced",
            "advancedConditionMode": "all"|"any",
            "advancedConditions": [{"type": string, "itemId": string, "sceneId": string, "hotspotId": string, "enigmaId": string, "replyId": string, "variableKey": string, "operator": string, "value": string}],
            "storyVariableOperation": "none"|"set"|"increment"|"decrement",
            "storyVariableKey": string,
            "storyVariableValue": string|number|boolean,
            "rewardItemId": string,
            "targetSceneId": string,
            "targetCinematicId": string,
            "enigmaId": string,
            "endingType": "good"|"bad"|"secret"|"neutral",
            "endingTitle": string,
            "endingSummary": string,
            "responseImagePrompt": string,
            "npcPortraitPrompt": string,
            "ambienceSoundPrompt": string
          }]
        }]
      },
` : ''}
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
  "items": [{
    "id": string,
    "name": string,
    "icon": string,
    "imagePrompt": string${brief.heroAdventureBrief ? `,
    "heroItemType": "none"|"health_potion"|"mana_potion"|"equipment",
    "heroItemAmount": number,
    "heroItemConsumeOnUse": boolean,
    "heroItemBonusTarget": "skill"|"maxHealth"|"maxMana",
    "heroItemSkillId": string,
    "heroItemBonus": number` : ''}
  }],
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
${brief.adventureChoicesBrief ? '  "storyVariables": [{"id": string, "key": string, "type": "number"|"boolean"|"text", "defaultValue": string|number|boolean, "description": string, "journalLabel": string, "journalVisible": boolean}],' : ''}
  "routeMap": {
    "canvases": [{"id": string, "name": string}],
    "rooms": [{"id": string, "name": string, "sceneId": string, "canvasId": string, "x": number, "y": number, "type": "start"|"room"|"end"}],
    "connections": [{"id": string, "fromRoomId": string, "toRoomId": string, "label": string, "locked": boolean, "allowOneWay": boolean}],
    "actMaps": {"actId": {"canvases": [{"id": string, "name": string}], "rooms": [{"id": string, "name": string, "sceneId": string, "canvasId": string, "x": number, "y": number, "type": "start"|"room"|"end"}], "connections": [{"id": string, "fromRoomId": string, "toRoomId": string, "label": string, "locked": boolean, "allowOneWay": boolean}], "notes": string}},
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
${brief.heroAdventureBrief || brief.adventureChoicesBrief || brief.expertBrief ? `
- Nom du jeu demande: ${brief.title || 'vide: invente un titre'}
`.trim() : ''}
- Thème: ${brief.theme}
${brief.heroAdventureBrief || brief.adventureChoicesBrief || brief.expertBrief ? `
- Histoire fournie: ${brief.story || 'vide: invente une histoire complete'}
- Personnages fournis: ${brief.characters || 'vide: invente les personnages necessaires'}
- Lieux ou univers fournis: ${brief.places || 'vide: choisis les lieux'}
- Contraintes libres: ${brief.constraints || 'vide: choix aleatoires coherents'}
`.trim() : ''}
${brief.adventureChoicesBrief ? `
- Mode obligatoire: aventure a choix multiples.
- Interdit dans ce mode: heroAdventure, heroItemType, heroBonus, tests de competences, combats, mana, PV et champs heroMalus.
- Crée au moins une zone actionType "conversation" dans la scène de départ.
- Les conversations doivent contenir des questions PNJ, 2 a 4 réponses par question quand c'est utile, des conséquences differentes et au moins une branche qui rejoint une autre question.
- Utilise conditionType et advancedConditions pour les réponses cachées: objet possède, scène visitee, énigme résolue, choix précédent ou variable d'histoire.
- Declare toutes les variables utilisées dans storyVariables avec type, valeur de départ, description, journalLabel et journalVisible.
- Utilise storyVariableOperation sur certaines réponses pour créer des conséquences plus tard.
- Crée plusieurs fins via reply.actionType "ending": au moins une bonne fin, une mauvaise fin ou neutre selon le volume demande, et une fin secrete si la structure le permet.
- Chaque fin doit avoir endingTitle et endingSummary.
- Ajoute branchTags et authorNote sur les réponses importantes pour aider l'auteur a filtrer et comprendre le graphe.
- Pour les médias par réponse, fournis responseImagePrompt, npcPortraitPrompt ou ambienceSoundPrompt quand’une réponse doit afficher une image, changer un portrait ou lancer une ambiance.
`.trim() : ''}
${brief.beginnerBrief ? `
- Mode obligatoire: debutant.
- Cree uniquement le contenu disponible en mode debutant: scenes, objets, enigmes et zones d'interaction.
- N'utilise pas les cinematics, combinations, heroAdventure, cartes d'actes, logique avancee ou mecanismes reserves aux modes superieurs.
- Interdit en debutant: logicRules, advancedConditions, conditionType, actionType "conversation", storyVariables, endings a choix multiples, heroItemType, heroItemBonus, tests de competences, combats, mana, PV, routeMap avancee.
`.trim() : ''}
${brief.intermediateBrief ? `
- Mode obligatoire: intermediaire.
- Cree uniquement le contenu disponible en mode intermediaire: scenes, objets, enigmes, cinematics et plan simple.
- Interdit en intermediaire: logicRules, advancedConditions, actionType "conversation", storyVariables, endings a choix multiples, heroAdventure, heroItemType, heroItemBonus, tests de competences, combats, mana, PV, combinations, animation et logique avancee.
`.trim() : ''}
${brief.expertBrief ? `
- Mode obligatoire: expert classique.
- Cree uniquement le contenu expert classique: scenes, objets, enigmes, cinematics, combinaisons, logicRules et plan/routeMap.
- Interdit en expert classique: aventure a choix multiples, actionType "conversation", storyVariables, endings a choix multiples, heroAdventure, heroItemType, heroItemBonus, tests de competences, combats, mana et PV.
`.trim() : ''}
- Difficulté: ${difficultyLabel[brief.difficulty] || brief.difficulty}
${brief.beginnerBrief ? '- Structure: parcours debutant simple, sans actes visibles.' : `- Actes: exactement ${brief.actCount}`}
- Scènes totales: exactement ${brief.sceneCount}. Ne dépasse jamais ce nombre, car chaque scène peut coûter des crédits image à l'utilisateur.
${!brief.beginnerBrief ? `- Sous-scenes: maximum ${brief.subsceneCount}, incluses dans le total de scenes si tu en utilises.` : ''}
- Objets: exactement ${brief.itemCount}. Ne crée pas d'objets supplémentaires.
- Énigmes: exactement ${brief.enigmaCount}. Ne crée pas d'énigmes supplémentaires.
${brief.heroAdventureBrief || brief.adventureChoicesBrief || brief.expertBrief ? `
- Combinaisons: exactement ${brief.combinationCount || 0}. Ne crée pas de combinaisons supplémentaires.
`.trim() : ''}
${!brief.beginnerBrief ? `- Cinematiques: exactement ${brief.cinematicCount}. Ne cree pas de cinematics supplementaires.` : ''}
- Les quantités demandées sont un contrat de coût: les dépasser est interdit.
- Ton: ${brief.tone || 'immersif'}
- Durée visée: ${brief.duration || '30 minutes'}
- Les IDs doivent être stables, simples, uniques, sans espaces.
- Les noms visibles des objets doivent être des noms français naturels et concrets. Interdit d'utiliser un ID, une chaîne aléatoire ou un code technique comme name.
- Chaque item doit avoir un name lisible par un joueur et une icon cohérente.
${brief.heroBonusObjects ? `
- Mode Hero aventure: crée une repartition utile d'objets héros dans les ${brief.itemCount} objets demandés, sans dépasser ce nombre.
- Utilise heroItemType:
  - "health_potion" pour une potion de soin avec heroItemAmount > 0 et heroItemConsumeOnUse: true.
  - "mana_potion" pour une potion de mana avec heroItemAmount > 0 et heroItemConsumeOnUse: true.
  - "equipment" pour un objet porté avec heroItemConsumeOnUse: false.
  - "none" pour un objet narratif classique.
- Pour un équipement, renseigne heroItemBonusTarget:
  - "skill" avec heroItemSkillId = "force", "ruse" ou "magie" et heroItemBonus entre 1 et 4.
  - "maxHealth" pour augmenter les PV max, heroItemBonus entre 2 et 8.
  - "maxMana" pour augmenter la mana max, heroItemBonus entre 1 et 5.
- Les équipements doivent avoir un nom naturel qui explique le bonus: Gants de force, Amulette de vitalité, Bague de mana, Cape de ruse.
- Dans les scènes et conversations, place ces objets comme récompenses trouvables avant les tests ou combats ou ils deviennent utiles.
`.trim() : ''}
${brief.beginnerBrief ? `
- Les zones doivent seulement relier les scenes, objets et enigmes du mode debutant.
- Parcours simple: quelques allers-retours lisibles sont possibles, mais sans logique avancee, sans actes visibles, sans routeMap avancee et sans choix multiples.
- Les deblocages doivent rester simples et comprehensibles depuis les onglets debutant; n'ajoute pas de regles cachees ou de conditions composees.
`.trim() : brief.intermediateBrief ? `
- Les zones doivent relier les scenes, objets, enigmes et cinematics du mode intermediaire.
- Le plan doit rester simple: rooms et connections utiles pour visualiser les transitions, sans routeMap avancee ni verrous logiques complexes.
- Les deblocages doivent rester accessibles depuis les onglets intermediaires: objet requis ou enigme liee, sans logicRules ni conditions composees.
- Les actes peuvent organiser le parcours, mais sans logique narrative avancee, choix multiples ou variables.
`.trim() : `
- Les zones doivent relier les sc?nes, objets, ?nigmes et cin?matiques.
- Les conditions de d?blocage doivent utiliser logicRules si une interaction d?pend d'un ?tat de jeu.
- Si Actes = 3 et Sc?nes totales maximum = 24, produis au plus 8 sc?nes par acte. Plus g?n?ralement, r?partis les sc?nes de fa?on ?quilibr?e entre les actes sans d?passer le total demand?.
- Structure chaque acte comme un mini-labyrinthe logique non lin?aire: au moins une sc?ne pivot, au moins deux branches, au moins deux sc?nes reli?es ? plusieurs autres sc?nes, et au moins un retour utile vers une sc?ne d?j? visit?e.
- Le joueur doit parfois revenir en arri?re dans le m?me acte pour utiliser un objet, une information ou un ?tat obtenu ailleurs.
- S?pare strictement les actes: une fois l'acte suivant atteint, aucune zone ne doit permettre de revenir ? un acte pr?c?dent. Les transitions inter-actes doivent ?tre ? sens unique dans routeMap.connections avec allowOneWay: true.
- Dans routeMap, relie toutes les sc?nes qui ont une zone d'action commune ou une transition directe. Marque locked: true si le lien d?pend d'un objet, d'une ?nigme, d'une cin?matique ou d'une r?gle logique.
- Dans routeMap, chaque canvas contient 15 rooms maximum; si un acte d?passe 15 sc?nes ou sous-sc?nes, cr?e un canvas suppl?mentaire et renseigne room.canvasId.
`.trim()}
- Aucune impasse bloquante: tout objet requis doit être obtenable avant son usage, toute énigme doit avoir ses indices avant d'être résolue, et aucune ressource consommée ne doit être indispensable plus tard sauf si une autre solution existe.
- Les indices d'une énigme ne doivent jamais être dans la même scène que l'énigme. Utilise clueSceneIds et explique la logique dans logicNotes.
- Interdit aux énigmes évidentes: pas de code écrit tel quel dans le décor puis redonné par la narration; pas de solution immédiatement visible dans la question. Les indices doivent demander déduction, comparaison, ordre, transformation ou croisement entre scènes.
- Chaque scène doit avoir instructions: 2 à 5 consignes de gameplay concrètes pour le créateur, scène par scène.
- Chaque scène doit avoir imagePrompt en français. Le prompt doit décrire le lieu, l'ambiance, les zones d'action visibles et les indices non-inventaire visibles.
- Très important: les prompts d'image de scène ne doivent pas citer ni montrer les objets d'inventaire à cacher par l'utilisateur. N'inclus donc pas les noms des items dans scene.imagePrompt.
- Chaque objet doit avoir item.imagePrompt en français, isolé sur fond transparent ou neutre.
${!brief.beginnerBrief ? `- Chaque slide de cinématique doit avoir imagePrompt en français, cohérent avec la révélation et sans contradiction avec les scènes.` : ''}
${brief.beginnerBrief ? '- Tout doit etre coherent entre scenes, objets et enigmes uniquement.' : brief.intermediateBrief ? '- Tout doit etre coherent entre scenes, cinematics, objets, enigmes et plan simple, sans logicRules.' : '- Tout doit etre coherent entre scenes, cinematics, objets, enigmes, routeMap et logicRules.'}
${PLAYABILITY_AND_COHERENCE_RULES}
- Réponds uniquement avec le JSON, sans Markdown.
`.trim();

const makeImprovePrompt = ({ currentProject, target, instruction, beginnerMode = false, intermediateMode = false, expertMode = false }) => {
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
- Ne modifié que la scène cible.
- Tu peux modifier uniquement:
  - introText pour l'ambiance
  - dialogues des hotspots existants
  - objets d'inventaire liés à cette scène, si nécessaire
- Ne déplace aucune zone: conserve x, y, width, height.
- Ne change pas les actions, les scènes cibles, les énigmes ou les cinematics liées.
${beginnerMode ? '- Mode debutant: ne cree pas et ne modifie pas de logique avancee, hero, choix multiples, conversation branchee, variable, cinematique, combinaison ou routeMap.' : intermediateMode ? '- Mode intermediaire: ne cree pas et ne modifie pas de logique avancee, hero, choix multiples, conversation branchee, variable, combinaison, animation ou routeMap avancee.' : expertMode ? '- Mode expert classique: ne cree pas et ne modifie pas de heroAdventure, hero, choix multiples, conversation branchee, variable narrative, combat, mana ou PV.' : ''}
- Conserve les IDs existants.
- Ne crée pas de nouvelle zone.
- Ne crée pas de référence vers une scène, un objet, une énigme, une cinématique ou une combinaison qui n'existe pas.
- Si tu ajoutes ou modifiés un objet dans items, ajoute aussi imagePrompt.
- Si tu enrichis un texte ou un dialogue, ne transforme jamais un indice subtil en solution directe.
- Préserve la logique existante: ne place pas l'indice d'une énigme dans la même scène que l'énigme et ne casse pas les retours arrière déjà prévus.
${PLAYABILITY_AND_COHERENCE_RULES}
- Format attendu: {"scenes":[{"id":"id_scene_existante","introText":"...","hotspots":[{"id":"id_zone_existante","dialogue":"..."}]}],"items":[...optionnel]}
- Si tu modifiés les hotspots, renvoie seulement leurs IDs et leurs nouveaux dialogues.
`.trim();
};

const makeProgressivePrompt = (brief, { currentProject, stage, enrichmentType }) => `
  Tu es un concepteur d'escape game narratif.
  Génération progressive demandée: ${stage}.
  Numéro d'acte à produire: ${String(stage || '').match(/^act(\d+)$/)?.[1] || '1'}.

Brief global:
- Thème: ${brief.theme}
- Difficulté: ${difficultyLabel[brief.difficulty] || brief.difficulty}
- Ton: ${brief.tone || 'immersif'}
- Durée visée: ${brief.duration || '30 minutes'}
${brief.heroAdventureBrief ? `- Document IA Hero aventure: titre=${brief.title || 'aléatoire'}, histoire=${brief.story || 'aléatoire'}, personnages=${brief.characters || 'aléatoire'}, lieux=${brief.places || 'aléatoire'}, contraintes=${brief.constraints || 'aucune'}.` : ''}
${brief.adventureChoicesBrief ? `- Document IA aventure a choix multiples: titre=${brief.title || 'aléatoire'}, histoire=${brief.story || 'aléatoire'}, personnages=${brief.characters || 'aléatoire'}, lieux=${brief.places || 'aléatoire'}, contraintes=${brief.constraints || 'aucune'}.` : ''}
${brief.intermediateBrief ? `- Mode intermediaire: progression autorisee avec scenes, objets, enigmes, cinematics et plan simple. Interdit: logicRules, advancedConditions, conversations branchees, storyVariables, hero, choix multiples et combinations.` : ''}
${brief.expertBrief ? `- Mode expert classique: progression autorisee avec scenes, objets, enigmes, cinematics, combinaisons, logicRules et plan. Interdit: heroAdventure, heroItemType, actionType "conversation", storyVariables, choix multiples, combats, mana et PV.` : ''}
- Plafonds de coût à respecter strictement: ${brief.actCount} acte(s), ${brief.sceneCount} scène(s) maximum, ${brief.itemCount} objet(s) maximum, ${brief.enigmaCount} énigme(s) maximum, ${brief.heroAdventureBrief || brief.adventureChoicesBrief || brief.expertBrief ? `${brief.combinationCount || 0} combinaison(s) maximum, ` : ''}${brief.cinematicCount} cinematic(s) maximum.
- Ne crée jamais plus de contenu que ces plafonds, car l'utilisateur paieraus images associées.
${brief.heroBonusObjects ? `
- Mode Hero aventure: parmi les objets de l'acte, ajoute des potions et équipements avec bonus sans dépasser le plafond d'objets.
- Champs à utiliser: heroItemType ("health_potion", "mana_potion", "equipment" ou "none"), heroItemAmount, heroItemConsumeOnUse, heroItemBonusTarget ("skill", "maxHealth", "maxMana"), heroItemSkillId ("force", "ruse", "magie"), heroItemBonus.
- Les équipements doivent être placés avant les tests ou combats où leur bonus devient utile.
`.trim() : ''}

  Projet actuel:
  ${JSON.stringify(compactProjectForPrompt(currentProject || {}), null, 2)}
  
  Règles:
  - Step act1: crée uniquement l'Acte 1 comme projet jouable dé départ.
  - Step act2, act3, act4, etc.: ajoute uniquement l'acte demandé et ses scènes, objets, énigmes, cinematics utiles.
  - Pour tout acte après l'Acte 1, réponds avec un JSON partiel compatible patch.
  - Chaque acte doit avoir une structure non linéaire: scène pivot, branches, retour utile, objets et indices placés avant leurs usages.
  - Le passage depuis l'acte précédent doit être à sens unique: ne crée aucun lien de retour vers l'acte précédent.
  - Si tu ajoutes routeMap ou modifiés des zones de navigation, mets à jour les canvases, rooms et connexions concernés.
  - Si tu ajoutes une scène, donne-lui imagePrompt et instructions.
- Si tu ajoutes un objet ou une cinématique, donné aussi item.imagePrompt ou slide.imagePrompt.
  ${brief.heroBonusObjects ? '- Si tu ajoutes un équipement Hero aventure, renseigne heroItemType:"equipment", heroItemBonusTarget, heroItemSkillId si besoin, heroItemBonus et heroItemConsumeOnUse:false. Si tu ajoutes une potion, renseigne heroItemType, heroItemAmount et heroItemConsumeOnUse:true.' : ''}
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
${brief.intermediateBrief ? '- Mode intermediaire: reste limite aux scenes, objets, enigmes, cinematics et plan simple. N ajoute pas de logicRules, advancedConditions, conversations branchees, storyVariables, hero, choix multiples, combinations ou logique avancee.' : ''}
${brief.expertBrief ? '- Mode expert classique: reste limite aux outils expert classiques. N ajoute pas de heroAdventure, heroItemType, actionType "conversation", storyVariables, choix multiples, combats, mana ou PV.' : ''}
- Réponds uniquement avec un JSON partiel compatible patch, sans Markdown.
- Conserve les IDs existants.
- Ne supprime aucun acte, scène, objet, énigme, cinematic ou zone existante.
- Ne change la structure existante que si l'action le démande explicitement.
- Toutes les nouvelles références doivent pointer vers des IDs existants ou créés dans ce patch.
- Tous les nouveaux objets doivent avoir un name français naturel et concret, jamais un ID ou une chaîne aléatoire.
- Continue l'histoire avec cohérence: mêmes lieux, mêmes enjeux, même style.
- Pour continue_story et add_scenes, la première nouvelle scène doit être reliée depuis la scène de départ obligatoire.
- La chronologie canonique prime sur l'ordre technique du tableau scènes. La suite doit partir de la dernière scène numérotée, ou de la scène de départ obligatoire si elle est fournie.
- Ajoute ou modifié une zone dans la scène de départ obligatoire pour pointer vers la nouvelle scène.
- Ne pars pas d'une autre scène, sauf si l'utilisateur le démande explicitement.
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
${brief.heroBonusObjects ? `
- Si un nouvel objet est une potion ou un équipement Hero aventure, renseigne ses champs de bonus:
  heroItemType, heroItemAmount, heroItemConsumeOnUse, heroItemBonusTarget, heroItemSkillId, heroItemBonus.
- Un équipement peut augmenter "force", "ruse", "magie", "maxHealth" ou "maxMana"; place-le comme récompense avant son usage logique.
`.trim() : ''}
- Toute nouvelle cinematic ou slide doit avoir imagePrompt en français.
${brief.intermediateBrief ? '- Toute nouvelle enigme doit rester simple, avec indices places hors de la scene de resolution quand c est utile, sans logique avancee.' : '- Toute nouvelle enigme doit renseigner clueSceneIds et logicNotes si ces champs sont utiles; les indices doivent etre places hors de la scene de resolution.'}
${brief.intermediateBrief ? '- Si tu ajoutes ou modifies des passages entre scenes, garde un plan simple avec rooms et connections lisibles, sans verrous logiques complexes.' : '- Si tu ajoutes ou modifies des passages entre scenes, ajoute ou complete routeMap.canvases, routeMap.rooms avec canvasId et routeMap.connections pour les scenes concernees.'}
- Si la suite passe dans un nouvel acte, le passage doit être à sens unique et aucune nouvelle zone ne doit revenir vers l'acte précédent.
- Si tu ajoutes 2 ou 3 scènes, ne les aligne pas simplement A -> B -> C: crée au moins une branche, un lien de retour utile ou une scène qui connecte plusieurs chemins.
${PLAYABILITY_AND_COHERENCE_RULES}

Actions:
- continue_story: ajoute obligatoirement 1 à 3 nouvelles scènes de suite, avec au moins une zone de navigation depuis une scène existante vers une nouvelle scène. Ne te contente jamais de réécrire les scènes existantes.
- add_scenes: ajoute obligatoirement 1 à 3 nouvelles scènes et les zones de navigation nécessaires. Ne renvoie pas seulement les scènes existantes.
- add_enigmas: ajoute obligatoirement au moins une nouvelle énigme reliée à une zone ou scène existante.
${brief.intermediateBrief ? '- enrich_interactions: enrichis zones, objets et dialogues sans ajouter de conditions avancees.' : '- enrich_interactions: enrichis zones, objets, dialogues et conditions sans changer l\'architecture globale.'}
`.trim();
};

const normalizeParsedProjectKeys = (project) => {
  if (!project || typeof project !== 'object') return project;
  const legacyScenes = project['sc\u00e8nes'];
  if (!Array.isArray(project.scenes) && Array.isArray(legacyScenes)) {
    return { ...project, scenes: legacyScenes };
  }
  return project;
};

const parseProjectResponse = (payload) => {
  if (!payload) throw new Error('Réponse IA vide.');
  if (payload.project) return normalizeParsedProjectKeys(payload.project);
  if (payload.data?.project) return normalizeParsedProjectKeys(payload.data.project);
  if (typeof payload.output_text === 'string') {
    const parsed = JSON.parse(payload.output_text);
    return normalizeParsedProjectKeys(parsed.project || parsed.data?.project || parsed);
  }
  if (typeof payload.text === 'string') {
    const parsed = JSON.parse(payload.text);
    return normalizeParsedProjectKeys(parsed.project || parsed.data?.project || parsed);
  }
  return normalizeParsedProjectKeys(payload);
};

const assertProjectHasScenes = (project, mode = 'generate') => {
  const sceneCount = Array.isArray(project?.scenes) ? project.scenes.length : 0;
  if (mode === 'improve' || mode === 'extend') return;
  if (sceneCount > 0) return;
  const error = new Error('La génération IA a renvoyé un projet sans scène. Les crédits doivent être remboursés automatiquement.');
  error.code = 'AI_PROJECT_WITHOUT_SCENES';
  throw error;
};

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const waitForAiJob = async (jobId) => {
  const startedAt = Date.now();
  const timeout = Number(import.meta.env.VITE_AI_JOB_TIMEOUT_MS || 20 * 60 * 1000);
  const interval = Number(import.meta.env.VITE_AI_JOB_POLL_INTERVAL_MS || 2500);

  while (Date.now() - startedAt < timeout) {
    await wait(interval);
    const url = new URL(jobEndpoint, window.location.origin);
    url.searchParams.set('id', jobId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await getAiAuthHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Suivi IA indisponible (${response.status}).`);
      error.status = response.status;
      throw error;
    }

    if (payload.status === 'complete') return payload;
    if (payload.status === 'error') {
      const error = new Error(payload.error || 'Generation IA échouée.');
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
      const dialogueMatch = String(hotspot.dialogue || '').match(/(?:trouvés?|ramasses?|obtiens?|découvres?|utilises?)\s+(?:un|une|le|la|l['’])?\s*([^,.!?;:]+)/i);
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
      if (hotspot.secondRequiredItemId === itemId) usedAs.push('second’objet requis');
      if (hotspot.secondRewardItemId === itemId) usedAs.push('second’objet donné');
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
    if (combo.resultItemId === itemId) usedAs.push('result de combinaison');
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
    headers: await makeAiHeaders(),
    body: JSON.stringify({
      prompt,
      mode: 'repair_item_names',
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

const uniqueId = (baseId, usedIds) => {
  const base = String(baseId || 'id').trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'id';
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  let index = 2;
  let candidate = `${base}_${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  usedIds.add(candidate);
  return candidate;
};

const repairDuplicateIds = (rawProject) => {
  const project = structuredClone(rawProject || {});
  const usedIds = new Set();
  const hotspotIdMap = new Map();
  const ruleIdMap = new Map();

  (project.acts || []).forEach((act) => {
    act.id = uniqueId(act.id || 'act', usedIds);
  });
  (project.items || []).forEach((item) => {
    item.id = uniqueId(item.id || 'item', usedIds);
  });
  (project.cinematics || []).forEach((cinematic) => {
    cinematic.id = uniqueId(cinematic.id || 'cinematic', usedIds);
    (cinematic.slides || []).forEach((slide) => {
      slide.id = uniqueId(slide.id || `${cinematic.id}_slide`, usedIds);
    });
  });
  (project.enigmas || []).forEach((enigma) => {
    enigma.id = uniqueId(enigma.id || 'enigma', usedIds);
  });
  (project.combinations || []).forEach((combo) => {
    combo.id = uniqueId(combo.id || 'combination', usedIds);
  });
  (project.scenes || []).forEach((scene) => {
    scene.id = uniqueId(scene.id || 'scene', usedIds);
    (scene.hotspots || []).forEach((hotspot) => {
      const previousId = hotspot.id;
      hotspot.id = uniqueId(hotspot.id || `${scene.id}_hotspot`, usedIds);
      if (previousId && previousId !== hotspot.id && !hotspotIdMap.has(previousId)) {
        hotspotIdMap.set(previousId, hotspot.id);
      }
      (hotspot.logicRules || []).forEach((rule) => {
        const previousRuleId = rule.id;
        rule.id = uniqueId(rule.id || `${hotspot.id}_rule`, usedIds);
        if (previousRuleId && previousRuleId !== rule.id && !ruleIdMap.has(previousRuleId)) {
          ruleIdMap.set(previousRuleId, rule.id);
        }
      });
    });
  });

  const mapHotspotId = (id) => hotspotIdMap.get(id) || id;
  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      hotspot.requiredHotspotId = mapHotspotId(hotspot.requiredHotspotId);
      (hotspot.logicRules || []).forEach((rule) => {
        rule.hotspotId = mapHotspotId(rule.hotspotId);
      });
    });
  });

  return project;
};

const limitArray = (entries, max) => {
  const limit = Number(max);
  if (!Array.isArray(entries)) return [];
  if (!Number.isFinite(limit) || limit < 0) return entries;
  return entries.slice(0, Math.max(0, Math.round(limit)));
};

const trimProjectToBriefCounts = (rawProject, brief = {}, mode = 'generate', options = {}) => {
  if (mode === 'improve' || mode === 'extend' || (mode === 'progressive' && options.stage !== 'act1')) {
    return rawProject;
  }

  const project = structuredClone(rawProject || {});
  const maxActs = toCount(brief.actCount);
  const maxScenes = toCount(brief.sceneCount);
  const maxItems = toCount(brief.itemCount);
  const maxEnigmas = toCount(brief.enigmaCount);
  const maxCombinations = toCount(brief.combinationCount);
  const maxCinematics = toCount(brief.cinematicCount);

  project.acts = limitArray(project.acts, maxActs);
  project.scenes = limitArray(project.scenes, maxScenes);
  project.items = limitArray(project.items, maxItems);
  project.enigmas = limitArray(project.enigmas, maxEnigmas);
  project.cinematics = limitArray(project.cinematics, maxCinematics);

  const actIds = new Set((project.acts || []).map((act) => act.id).filter(Boolean));
  const sceneIds = new Set((project.scenes || []).map((scene) => scene.id).filter(Boolean));
  const itemIds = new Set((project.items || []).map((item) => item.id).filter(Boolean));
  const enigmaIds = new Set((project.enigmas || []).map((enigma) => enigma.id).filter(Boolean));
  const cinematicIds = new Set((project.cinematics || []).map((cinematic) => cinematic.id).filter(Boolean));

  (project.scenes || []).forEach((scene) => {
    if (scene.actId && !actIds.has(scene.actId)) scene.actId = project.acts?.[0]?.id || '';
    if (scene.parentSceneId && !sceneIds.has(scene.parentSceneId)) scene.parentSceneId = '';
    scene.hotspots = (scene.hotspots || []).map((hotspot) => ({
      ...hotspot,
      requiredItemId: itemIds.has(hotspot.requiredItemId) ? hotspot.requiredItemId : '',
      rewardItemId: itemIds.has(hotspot.rewardItemId) ? hotspot.rewardItemId : '',
      targetSceneId: sceneIds.has(hotspot.targetSceneId) ? hotspot.targetSceneId : '',
      targetCinematicId: cinematicIds.has(hotspot.targetCinematicId) ? hotspot.targetCinematicId : '',
      enigmaId: enigmaIds.has(hotspot.enigmaId) ? hotspot.enigmaId : '',
      secondRequiredItemId: itemIds.has(hotspot.secondRequiredItemId) ? hotspot.secondRequiredItemId : '',
      secondRewardItemId: itemIds.has(hotspot.secondRewardItemId) ? hotspot.secondRewardItemId : '',
      secondTargetSceneId: sceneIds.has(hotspot.secondTargetSceneId) ? hotspot.secondTargetSceneId : '',
      secondTargetCinematicId: cinematicIds.has(hotspot.secondTargetCinematicId) ? hotspot.secondTargetCinematicId : '',
      secondEnigmaId: enigmaIds.has(hotspot.secondEnigmaId) ? hotspot.secondEnigmaId : '',
      logicRules: (hotspot.logicRules || []).map((rule) => ({
        ...rule,
        itemId: itemIds.has(rule.itemId) ? rule.itemId : '',
        rewardItemId: itemIds.has(rule.rewardItemId) ? rule.rewardItemId : '',
        targetSceneId: sceneIds.has(rule.targetSceneId) ? rule.targetSceneId : '',
        targetCinematicId: cinematicIds.has(rule.targetCinematicId) ? rule.targetCinematicId : '',
        enigmaId: enigmaIds.has(rule.enigmaId) ? rule.enigmaId : '',
        conditionEnigmaId: enigmaIds.has(rule.conditionEnigmaId) ? rule.conditionEnigmaId : '',
        cinematicId: cinematicIds.has(rule.cinematicId) ? rule.cinematicId : '',
      })),
    }));
  });

  project.combinations = limitArray((project.combinations || []).filter((combo) => (
    itemIds.has(combo.itemAId) && itemIds.has(combo.itemBId) && itemIds.has(combo.resultItemId)
  )), maxCombinations);
  (project.enigmas || []).forEach((enigma) => {
    if (enigma.targetSceneId && !sceneIds.has(enigma.targetSceneId)) enigma.targetSceneId = '';
    if (enigma.targetCinematicId && !cinematicIds.has(enigma.targetCinematicId)) enigma.targetCinematicId = '';
  });
  (project.cinematics || []).forEach((cinematic) => {
    if (cinematic.targetSceneId && !sceneIds.has(cinematic.targetSceneId)) cinematic.targetSceneId = '';
    if (cinematic.rewardItemId && !itemIds.has(cinematic.rewardItemId)) cinematic.rewardItemId = '';
  });
  if (project.start?.targetSceneId && !sceneIds.has(project.start.targetSceneId)) {
    project.start.targetSceneId = project.scenes?.[0]?.id || '';
  }
  if (project.start?.targetCinematicId && !cinematicIds.has(project.start.targetCinematicId)) {
    project.start.targetCinematicId = '';
  }

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
      || /trouvént un indice li[eé] à/i.test(String(hotspot.dialogue || ''))
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
      throw new Error('La réponse IA ne relié pas la scène de départ à une nouvelle scène.');
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
    headers: await makeAiHeaders(),
    body: JSON.stringify({
      prompt,
      brief,
      mode,
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
    payload = await waitForAiJob(payload.jobId);
  }
  const parsed = trimProjectToBriefCounts(
    repairDuplicateIds(repairMissingSceneReferences(repairMissingItemReferences(parseProjectResponse(payload)))),
    brief,
    mode,
    options,
  );
  assertProjectHasScenes(parsed, mode);
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
  const combinationCount = clampNumber(brief.combinationCount, 0, 30, Math.floor(itemCount / 3));
  const cinematicCount = clampNumber(brief.cinematicCount, 0, 12, 2);
  const effectiveSubsceneCount = Math.min(subsceneCount, Math.max(0, sceneCount - 1));
  const mainSceneCount = Math.max(1, sceneCount - effectiveSubsceneCount);
  const theme = String(brief.theme || 'Mystère').trim() || 'Mystère';
  const tone = String(brief.tone || 'immersif').trim() || 'immersif';
  const requestedTitle = String(brief.title || '').trim();
  const storySeed = String(brief.story || '').trim();
  const characterSeed = String(brief.characters || '').trim();
  const placeSeed = String(brief.places || '').trim();

  const acts = Array.from({ length: actCount }, (_, index) => makeAct(`Acte ${index + 1}`));
  const items = Array.from({ length: itemCount }, (_, index) => {
    const item = makeItem([
      `Indice ${index + 1}`,
      `Clé ${index + 1}`,
      `Fragment ${index + 1}`,
      `Objet ${theme} ${index + 1}`,
    ][index % 4], ['🔎', '🗝️', '📜', '🧩'][index % 4]);
    item.imagePrompt = `Objet d'inventaire en francais: ${item.name}, isole au centre, fond transparent ou neutre, lisible, style ${tone}, cohérent avec ${theme}.`;
    return item;
  });

  if (brief.heroBonusObjects) {
    const heroItemPresets = [
      {
        name: 'Potion de soin',
        icon: 'PV',
        heroItemType: 'health_potion',
        heroItemAmount: 6,
        heroItemConsumeOnUse: true,
      },
      {
        name: 'Potion de mana',
        icon: 'MP',
        heroItemType: 'mana_potion',
        heroItemAmount: 4,
        heroItemConsumeOnUse: true,
      },
      {
        name: 'Gants de force',
        icon: '+F',
        heroItemType: 'equipment',
        heroItemBonusTarget: 'skill',
        heroItemSkillId: 'force',
        heroItemBonus: 2,
        heroItemConsumeOnUse: false,
      },
      {
        name: 'Amulette de vitalite',
        icon: '+PV',
        heroItemType: 'equipment',
        heroItemBonusTarget: 'maxHealth',
        heroItemBonus: 4,
        heroItemConsumeOnUse: false,
      },
      {
        name: 'Bague de mana',
        icon: '+MP',
        heroItemType: 'equipment',
        heroItemBonusTarget: 'maxMana',
        heroItemBonus: 3,
        heroItemConsumeOnUse: false,
      },
      {
        name: 'Cape de ruse',
        icon: '+R',
        heroItemType: 'equipment',
        heroItemBonusTarget: 'skill',
        heroItemSkillId: 'ruse',
        heroItemBonus: 1,
        heroItemConsumeOnUse: false,
      },
    ];
    items.forEach((item, index) => {
      const preset = heroItemPresets[index % heroItemPresets.length];
      if (index >= Math.max(2, Math.min(itemCount, heroItemPresets.length))) {
        item.heroItemType = 'none';
        return;
      }
      Object.assign(item, preset);
      item.imagePrompt = `Objet Hero aventure en francais: ${item.name}, ${preset.heroItemType === 'equipment' ? 'equipement porte avec bonus' : 'potion consommable'}, isole au centre, fond transparent ou neutre, lisible, style ${tone}, cohérent avec ${theme}.`;
    });
  }

  const scenes = Array.from({ length: mainSceneCount }, (_, index) => {
    const act = acts[index % acts.length];
    const scene = makeScene({ actId: act.id });
    scene.name = placeSeed ? `${placeSeed.split(/[,;\n]/)[index % placeSeed.split(/[,;\n]/).length].trim() || theme} ${index + 1}` : `${theme} - Lieu ${index + 1}`;
    scene.introText = storySeed ?
       `${storySeed} Ici, un détail ${tone} relance l'enquête et pousse les joueurs vers la suite.`
      : `Dans ce lieu ${tone}, un détail lié à ${theme} semble guider les joueurs vers la suite.`;
    scene.imagePrompt = `Scène d'escape game en francais: ${scene.name}, ambiance ${tone}, thème ${theme}, zones d'action visibles, indices non-inventaire lisibles, sans objets d'inventaire cachés.`;
    scene.hotspots = [];
    return scene;
  });

  Array.from({ length: effectiveSubsceneCount }, (_, index) => {
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
         `Reproduis la sequence liée à ${theme}.`
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
    cinematic.slides[0].narration = characterSeed ?
       `${characterSeed.split(/[,;\n]/)[0].trim()} révèle un élément décisif de ${theme}.`
      : `Une révélation fait avancer l'histoire de ${theme}.`;
    cinematic.slides[0].imagePrompt = `Image cinematic en francais: révélation ${index + 1} autour de ${theme}, ambiance ${tone}, composition claire, dramatique et cohérent avec les scènes.`;
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
    inspectSpot.dialogue = `Les joueurs trouvént un indice important sur ${theme}.`;
    inspectSpot.rewardItemId = rewardItem?.id || '';

    const progressSpot = makeHotspot();
    progressSpot.name = nextScene ? 'Passage verrouillé' : 'Conclusion';
    progressSpot.x = 70;
    progressSpot.y = 50;
    progressSpot.actionType = nextScene ? 'scene' : 'dialogue';
    progressSpot.dialogue = nextScene ?
       'Le passage s’ouvre grâce aux indices déjà collectés.'
      : `Le fil narratif de ${theme} trouvé sa résolution.`;
    progressSpot.targetSceneId = nextScene?.id || '';
    progressSpot.requiredItemId = rewardItem?.id || '';
    progressSpot.enigmaId = enigma?.id || '';

    if (!brief.beginnerBrief && !brief.intermediateBrief && cinematic && index % 3 === 0) {
      const rule = makeLogicRule();
      rule.name = 'Après cinematic';
      rule.conditionType = 'launched_cinematic';
      rule.cinematicId = cinematic.id;
      rule.actionType = nextScene ? 'scene' : 'dialogue';
      rule.dialogue = 'La révélation précédente donné un nouveau sens à cette zone.';
      rule.targetSceneId = nextScene?.id || '';
      progressSpot.logicRules = [rule];
    }

    scene.hotspots = [inspectSpot, progressSpot];
  });

  const combinations = [];
  for (let index = 0; index < combinationCount; index += 1) {
    if (items.length < 3) break;
    const combo = makeCombination();
    const itemA = items[index % items.length];
    const itemB = items[(index + 1) % items.length];
    const resultItem = items[(index + 2) % items.length];
    combo.itemAId = itemA.id;
    combo.itemBId = itemB.id;
    combo.resultItemId = resultItem.id;
    combo.message = `Les deux éléments se combinent et révèlent ${resultItem.name}.`;
    combinations.push(combo);
  }

  const storyVariables = brief.adventureChoicesBrief ? [
    {
      id: 'var_confiance_du_guide',
      key: 'confiance_du_guide',
      type: 'number',
      defaultValue: 0,
      description: 'Mesure si le guide fait confiance au joueur.',
      journalLabel: 'Confiance du guide',
      journalVisible: true,
    },
    {
      id: 'var_piste_secrete',
      key: 'piste_secrete',
      type: 'boolean',
      defaultValue: false,
      description: 'Devient vraie si le joueur repere une piste optionnelle.',
      journalLabel: 'Piste secrete',
      journalVisible: true,
    },
  ] : [];

  if (brief.adventureChoicesBrief && scenes[0]) {
    const guideHotspot = makeHotspot();
    guideHotspot.name = 'Guide du carrefour';
    guideHotspot.actionType = 'conversation';
    guideHotspot.dialogue = `Le guide connait plusieurs chemins liés a ${theme}.`;
    guideHotspot.x = 46;
    guideHotspot.y = 52;
    guideHotspot.width = 18;
    guideHotspot.height = 18;
    guideHotspot.conversation = {
      startNodeId: 'start',
      nodes: [
        {
          id: 'start',
          speaker: 'Guide',
          text: storySeed || `Tu peux suivre la voie sure, chercher un indice secret ou viser directement la sortie de ${theme}. Que demandes-tu ?`,
          authorNote: 'Question de départ du mode aventure a choix multiples.',
          replies: [
            {
              id: 'reply_safe_path',
              label: 'Quel chemin est le plus sur ?',
              branchTags: ['voie_principale'],
              authorNote: 'Branche lisible pour guider le joueur.',
              actionType: 'node',
              nextNodeId: 'safe_path',
              dialogue: 'Le guide decrit un passage plus lent mais fiable.',
              storyVariableOperation: 'increment',
              storyVariableKey: 'confiance_du_guide',
              storyVariableValue: 1,
            },
            {
              id: 'reply_secret_path',
              label: 'Je cherche une piste secrete.',
              branchTags: ['secret'],
              authorNote: 'Débloqué une variable qui servira plus tard.',
              actionType: 'node',
              nextNodeId: 'secret_path',
              dialogue: 'Le guide baisse la voix et indique une marque discrete.',
              storyVariableOperation: 'set',
              storyVariableKey: 'piste_secrete',
              storyVariableValue: true,
              responseImagePrompt: `Petit indice visuel discret dans une scène ${tone}, sans texte, cohérent avec ${theme}.`,
            },
            {
              id: 'reply_leave_alone',
              label: 'Je vais explorer seul.',
              branchTags: ['danger'],
              authorNote: 'Mauvais choix possible, utile pour montrer les conséquences.',
              actionType: 'ending',
              dialogue: 'Le guide te laisse partir sans aide. Le silence referme les chemins.',
              endingType: 'bad',
              endingTitle: 'Fin solitaire',
              endingSummary: 'Le joueur part sans soutien et rate la piste principale.',
            },
          ],
        },
        {
          id: 'safe_path',
          speaker: 'Guide',
          text: 'La voie sure demande de prouver que tu sais observer. Veux-tu un objet pour plus tard ?',
          authorNote: 'Exemple dé conséquence objet.',
          replies: [
            {
              id: 'reply_take_token',
              label: 'Oui, donne-moi de quoi prouver ma bonne foi.',
              branchTags: ['objet'],
              actionType: 'item',
              dialogue: 'Le guide te confie un jeton grave.',
              rewardItemId: items[0]?.id || '',
            },
            {
              id: 'reply_good_end',
              label: 'Je connais maintenant la route.',
              branchTags: ['bonne_fin'],
              actionType: 'ending',
              dialogue: 'Tu avances avec méthode et atteins la sortie avant que le lieu ne se referme.',
              conditionType: 'story_variable',
              conditionVariableKey: 'confiance_du_guide',
              conditionVariableOperator: 'greater_or_equal',
              conditionVariableValue: 1,
              endingType: 'good',
              endingTitle: 'Bonne fin',
              endingSummary: 'Le joueur a gagne la confiance du guide et choisi le chemin stable.',
            },
          ],
        },
        {
          id: 'secret_path',
          speaker: 'Guide',
          text: 'Si tu as compris la marque, tu peux tenter le passage secret.',
          authorNote: 'Exemple dé réponse cachée par variable.',
          replies: [
            {
              id: 'reply_secret_end',
              label: 'J utilise la marque cachée.',
              branchTags: ['secret', 'fin_secrete'],
              actionType: 'ending',
              dialogue: 'La marque revele une sortie que personne ne surveillait.',
              conditionType: 'story_variable',
              conditionVariableKey: 'piste_secrete',
              conditionVariableOperator: 'truthy',
              conditionVariableValue: true,
              endingType: 'secret',
              endingTitle: 'Fin secrete',
              endingSummary: 'Le joueur a suivi la piste cachée et trouve une sortie alternative.',
            },
          ],
        },
      ],
    };
    scenes[0].hotspots = [guideHotspot, ...(scenes[0].hotspots || [])].slice(0, 4);
  }

  return normalizeProject({
    title: requestedTitle || `Escape game - ${theme}`,
    creationMode: brief.heroAdventureBrief ? 'hero_adventure' : brief.adventureChoicesBrief ? 'adventure' : brief.beginnerBrief ? 'beginner' : brief.intermediateBrief ? 'intermediate' : undefined,
    heroAdventure: brief.heroAdventureBrief ? {
      enabled: true,
      dice: { sides: 20, label: 'd20' },
      hero: {
        name: 'Aventurier',
        health: 18,
        maxHealth: 18,
        mana: 10,
        maxMana: 10,
        skills: [
          { id: 'force', name: 'Force', value: 3, manaCost: 0 },
          { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
          { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
        ],
      },
    } : undefined,
    acts,
    scenes,
    items,
    combinations,
    enigmas,
    cinematics,
    storyVariables,
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
  const actNumber = Number(String(stage).match(/^act(\d+)$/)?.[1] || 1);

  if (/^act\d+$/.test(stage)) {
    const project = generateProjectLocally({ ...brief, actCount: 1 });
    project.acts[0].name = `Acte ${actNumber}`;
    project.title = `Escape game progressif - ${brief.theme || 'Mystère'}`;
    project.scenes.forEach((scene) => {
      scene.name = scene.name.replace('Lieu', `Acte ${actNumber} - Lieu`);
      if (actNumber > 1) {
        scene.introText = `${scene.introText} Cette partie continue directement les découvertes de l’Acte ${actNumber - 1}, sans contradiction, et révèle une nouvelle couche du mystère.`;
      }
    });
    if (actNumber === 1) return project;
    return {
      acts: project.acts,
      scenes: project.scenes,
      items: project.items,
      combinations: project.combinations,
      enigmas: project.enigmas,
      cinematics: project.cinematics,
    };
  }

  return {};
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
             `${hotspot.dialogue} ${instruction || 'Un détail supplémentaire donné plus de poids à cette interaction.'}`
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
  clueHotspot.dialogue = `Les joueurs trouvént un indice lié à ${newScene.name}.`;
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
      successMessage: 'Le mécanisme se débloqué.',
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
