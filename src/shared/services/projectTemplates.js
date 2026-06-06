import { makeEnigma, makeHotspot, makeItem, makeScene, normalizeProject } from '../data/projectData';
import { applyBookHeroTemplate } from './projectTemplatesBookHero';
import { NARRATIVE_TEMPLATE_CONFIGS } from './projectTemplatesNarrativeConfigs';

const TEMPLATE_TITLES = {
  empty: 'Projet vide',
  book_hero: 'Livre dont vous etes le heros',
  adventure_choices: 'Aventure choix multiples',
  hero_adventure: 'Hero Adventure',
  narrative_investigation: 'Enquête narrative',
  magic_forest: 'Forêt magique',
  survival_choices: 'Survie',
  npc_dialogue: 'Dialogue PNJ',
  negotiation: 'Négociation',
  narrative_maze: 'Labyrinthe narratif',
  manor: 'Manoir hanté',
  investigation: 'Enquête policière',
  laboratory: 'Laboratoire',
  museum: 'Musée',
};

const CLASSIC_TEMPLATE_CONFIGS = {
  manor: {
    actName: 'Nuit I',
    scenes: ['Hall du manoir', 'Bibliotheque interdite', 'Chambre verrouillee'],
    intros: [
      'La porte du manoir grince derriere toi. Une horloge arretee, un portrait lacere et une bibliotheque fermee donnent deja trois pistes.',
      'Les rayonnages montent jusqu au plafond. Un pupitre, une etiquette de cave et un portrait retournable cachent le code de la chambre.',
      'La chambre semble intacte, mais le lit froid, le miroir voile et le coffret scelle racontent la derniere nuit de la maison.',
    ],
    itemNames: ['Clef de la bibliotheque', 'Portrait dechire', 'Sceau de cire noire'],
    itemIcons: ['[]', '[]', 'O'],
    startObjectName: 'Horloge du hall',
    startObjectDialogue: 'Derriere l horloge, tu trouves la clef de la bibliotheque.',
    startClueName: 'Portrait lacere',
    startClueDialogue: 'Le portrait montre trois dates. La seconde a ete rayee plus profondement que les autres.',
    branchEntryName: 'Porte de la bibliotheque',
    branchEntryDialogue: 'La clef tourne avec difficulte. La bibliotheque s ouvre.',
    branchLockedMessage: 'La porte est verrouillee. Il faut fouiller le hall.',
    enigmaName: 'Portrait aux trois dates',
    enigmaQuestion: 'Quelle date ouvre le passage de la chambre ?',
    enigmaChoices: ['1894', '1912', '1931'],
    enigmaSolution: '1912',
    enigmaSuccess: 'La bibliotheque tremble. Un panneau coulisse vers la chambre.',
    enigmaFail: 'Le portrait reste muet. La date rayee est la cle.',
    branchObjectName: 'Portrait retourne',
    branchObjectDialogue: 'Au dos du portrait, un morceau manquant confirme la date de 1912.',
    finalObjectName: 'Coffret scelle',
    finalObjectDialogue: 'Le coffret s ouvre. Le sceau de cire noire prouve que la chambre etait condamnee volontairement.',
    conclusionSpeaker: 'La maison',
    conclusionText: 'Le manoir attend que tu relies le portrait, la date et le sceau.',
    goodEndingTitle: 'Le secret du manoir',
    goodEndingSummary: 'Tu comprends qui a ferme la chambre et pourquoi le manoir refusait d oublier.',
    neutralEndingTitle: 'Sortie prudente',
    neutralEndingSummary: 'Tu quittes le manoir avec des indices, mais la chambre garde une partie de son histoire.',
    routeLabels: ['Clef trouvee', '1912'],
    routeNotes: 'Plan: Hall -> Bibliotheque -> Chambre. Objets: clef, portrait, sceau. Enigme: date du portrait.',
  },
  investigation: {
    actName: 'Dossier I',
    scenes: ['Bureau de l inspecteur', 'Scene de crime', 'Archives du commissariat'],
    intros: [
      'Un dossier urgent attend sur le bureau. La victime, un temoin absent et une preuve mal classee dessinent deja une fausse piste.',
      'La scene de crime est calme, trop calme. Une empreinte, un ticket humide et une fenetre forcee contredisent le rapport.',
      'Les archives contiennent les noms que personne ne veut revoir. La bonne cote peut transformer un soupcon en preuve.',
    ],
    itemNames: ['Badge de scene', 'Ticket humide', 'Dossier classe C-17'],
    itemIcons: ['[]', '[]', 'C17'],
    startObjectName: 'Dossier urgent',
    startObjectDialogue: 'Tu prends le badge de scene. Sans lui, personne ne te laissera approcher les preuves.',
    startClueName: 'Note du standard',
    startClueDialogue: 'La note mentionne un appel a 23h40, mais le rapport officiel parle de minuit.',
    branchEntryName: 'Ruban de police',
    branchEntryDialogue: 'Le badge suffit a passer le ruban. La scene de crime devient accessible.',
    branchLockedMessage: 'Un agent bloque l entree: badge obligatoire.',
    enigmaName: 'Chronologie impossible',
    enigmaQuestion: 'Quelle heure contredit le rapport officiel ?',
    enigmaChoices: ['22h15', '23h40', '00h30'],
    enigmaSolution: '23h40',
    enigmaSuccess: 'La chronologie se recale. Les archives C-17 deviennent la prochaine piste.',
    enigmaFail: 'Cette heure ne colle pas avec la note du standard.',
    branchObjectName: 'Ticket humide',
    branchObjectDialogue: 'Le ticket humide porte la meme heure: 23h40.',
    finalObjectName: 'Dossier C-17',
    finalObjectDialogue: 'Le dossier C-17 relie le temoin absent a la scene de crime.',
    conclusionSpeaker: 'Inspecteur',
    conclusionText: 'Il faut choisir quoi faire de la preuve.',
    goodEndingTitle: 'Affaire bouclee',
    goodEndingSummary: 'La chronologie, le ticket et le dossier C-17 suffisent a innocenter la mauvaise personne.',
    neutralEndingTitle: 'Piste a verifier',
    neutralEndingSummary: 'Tu gardes le ticket, mais le dossier reste trop fragile pour conclure.',
    routeLabels: ['Badge', '23h40'],
    routeNotes: 'Plan: Bureau -> Scene de crime -> Archives. Objets: badge, ticket, dossier. Enigme: chronologie.',
  },
  laboratory: {
    actName: 'Protocole I',
    scenes: ['Sas d entree', 'Salle des experiences', 'Reacteur instable'],
    intros: [
      'Les neons clignotent. Le protocole d urgence est actif et le sas ne repond plus aux cartes ordinaires.',
      'Des instruments bourdonnent autour d une experience inachevee. Trois fioles colorent encore la paillasse.',
      'Le reacteur pulse lentement. La bonne sequence peut le stabiliser; une erreur peut verrouiller tout le laboratoire.',
    ],
    itemNames: ['Carte de securite', 'Echantillon bleu', 'Module de controle'],
    itemIcons: ['[]', '[]', 'MOD'],
    startObjectName: 'Casier de securite',
    startObjectDialogue: 'Dans le casier, tu trouves une carte de securite encore active.',
    startClueName: 'Journal de garde',
    startClueDialogue: 'Le journal repete une consigne: bleu avant vert, rouge jamais en premier.',
    branchEntryName: 'Lecteur du sas',
    branchEntryDialogue: 'La carte deverrouille la salle des experiences.',
    branchLockedMessage: 'Le lecteur refuse l acces sans carte de securite.',
    enigmaName: 'Sequence des fioles',
    enigmaQuestion: 'Quelle sequence respecte le protocole de stabilisation ?',
    enigmaChoices: ['Rouge bleu vert', 'Bleu vert rouge', 'Vert rouge bleu'],
    enigmaSolution: 'Bleu vert rouge',
    enigmaSuccess: 'Les fioles s alignent. Le reacteur accepte le module de controle.',
    enigmaFail: 'La sequence est rejetee. Relis la consigne du journal.',
    branchObjectName: 'Fiole bleue',
    branchObjectDialogue: 'Tu prends l echantillon bleu, encore froid malgre les alarmes.',
    finalObjectName: 'Module de controle',
    finalObjectDialogue: 'Le module s extrait de la console. Le reacteur peut etre stabilise.',
    conclusionSpeaker: 'Console',
    conclusionText: 'Le reacteur demande une confirmation finale.',
    goodEndingTitle: 'Reacteur stabilise',
    goodEndingSummary: 'La carte, la sequence et le module remettent le laboratoire sous controle.',
    neutralEndingTitle: 'Confinement maintenu',
    neutralEndingSummary: 'Tu stoppes l urgence immediate, mais le protocole complet reste a documenter.',
    routeLabels: ['Carte', 'Sequence'],
    routeNotes: 'Plan: Sas -> Salle des experiences -> Reacteur. Objets: carte, echantillon, module. Enigme: sequence des fioles.',
  },
  museum: {
    actName: 'Nuit au musee',
    scenes: ['Galerie principale', 'Reserve secrete', 'Salle des artefacts'],
    intros: [
      'Le musee est ferme, mais une vitrine vient de s ouvrir. Un cartel manquant et une trace de poussiere pointent vers la reserve.',
      'La reserve conserve les pieces que le public ne doit jamais voir. Une caisse ouverte porte un symbole incomplet.',
      'La salle des artefacts attend dans le silence. Le socle vide reclame le bon objet et le bon symbole.',
    ],
    itemNames: ['Clef de reserve', 'Cartel ancien', 'Medaille solaire'],
    itemIcons: ['[]', '[]', 'SUN'],
    startObjectName: 'Vitrine ouverte',
    startObjectDialogue: 'Sous le velours de la vitrine, tu trouves la clef de reserve.',
    startClueName: 'Trace de poussiere',
    startClueDialogue: 'La poussiere dessine un soleil a huit branches.',
    branchEntryName: 'Porte de reserve',
    branchEntryDialogue: 'La clef ouvre la reserve secrete.',
    branchLockedMessage: 'La reserve est fermee. La vitrine a peut-etre laisse un indice.',
    enigmaName: 'Symbole du socle',
    enigmaQuestion: 'Quel symbole manque sur le socle de l artefact ?',
    enigmaChoices: ['Lune', 'Soleil', 'Couronne'],
    enigmaSolution: 'Soleil',
    enigmaSuccess: 'Le socle reconnait le symbole. La salle des artefacts s ouvre.',
    enigmaFail: 'Le socle reste eteint. La trace de poussiere indiquait autre chose.',
    branchObjectName: 'Cartel ancien',
    branchObjectDialogue: 'Le cartel nomme l artefact: Medaille solaire.',
    finalObjectName: 'Medaille solaire',
    finalObjectDialogue: 'La medaille solaire retrouve son socle. L alarme cesse enfin.',
    conclusionSpeaker: 'Conservatrice',
    conclusionText: 'La disparition peut etre classee comme vol ou comme restitution.',
    goodEndingTitle: 'Artefact restitue',
    goodEndingSummary: 'La clef, le cartel et la medaille prouvent que l objet a ete deplace pour etre protege.',
    neutralEndingTitle: 'Alarme suspendue',
    neutralEndingSummary: 'Tu interromps l alarme, mais le rapport du musee reste incomplet.',
    routeLabels: ['Clef', 'Soleil'],
    routeNotes: 'Plan: Galerie -> Reserve -> Salle des artefacts. Objets: clef, cartel, medaille. Enigme: symbole du socle.',
  },
};

const applyNarrativeTemplate = (project, templateId) => {
  const config = NARRATIVE_TEMPLATE_CONFIGS[templateId];
  if (!config) return null;
  const scenes = project.scenes.slice(0, 3);
  const [startScene, branchScene, endScene] = scenes;
  const actId = project.acts[0]?.id || '';
  const item = makeItem(config.itemName, config.itemIcon);
  const supportItem = makeItem(config.supportItemName, config.supportItemIcon);
  const finalItem = makeItem(config.finalItemName, config.finalItemIcon);
  const enigma = makeEnigma({
    name: config.enigmaName,
    type: 'misc',
    miscMode: 'multiple-choice',
    question: config.enigmaQuestion,
    miscChoices: config.choices,
    solutionText: config.solution,
    successMessage: 'Le bon choix debloque la conclusion du parcours.',
    failMessage: 'Cette piste affaiblit ta position.',
    unlockType: 'scene',
    targetSceneId: endScene?.id || '',
  });

  project.acts = [{ ...project.acts[0], name: config.actName }];
  project.items = [item, supportItem, finalItem];
  project.combinations = [];
  project.cinematics = [];
  project.enigmas = [enigma];
  project.storyVariables = [{
    id: `${templateId}_variable_${config.variableKey}`,
    key: config.variableKey,
    type: 'number',
    defaultValue: 0,
    description: `Mesure la confiance ou progression narrative du template ${TEMPLATE_TITLES[templateId]}.`,
  }];

  if (startScene) {
    startScene.name = config.scenes[0];
    startScene.actId = actId;
    startScene.parentSceneId = '';
    startScene.introText = config.intros[0];
    startScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.npc,
        x: 46,
        y: 52,
        width: 22,
        height: 20,
        actionType: 'conversation',
        dialogue: config.opening,
        conversation: {
          startNodeId: 'start',
          nodes: [
            {
              id: 'start',
              speaker: config.npc,
              text: config.opening,
              replies: [
                { id: 'reply_careful', label: 'Je pose une question prudente.', actionType: 'node', nextNodeId: 'trust', dialogue: 'La discussion devient possible.', storyVariableKey: config.variableKey, storyVariableOperation: 'increment', storyVariableValue: '1' },
                { id: 'reply_direct', label: 'Je force une reponse immediate.', actionType: 'ending', endingType: 'bad', endingTitle: config.badTitle, endingSummary: "Tu obtiens une reponse trop vite, mais tu perds la branche importante de l'histoire.", dialogue: 'La tension monte et la discussion se ferme.' },
                { id: 'reply_item', label: 'Je cherche un indice utile.', actionType: 'multiple', rewardItemId: item.id, nextNodeId: 'after_item', dialogue: `${config.npc} te remet: ${config.itemName}.` },
              ],
            },
            {
              id: 'trust',
              speaker: config.npc,
              text: 'Tu ecoutes vraiment. Je peux te montrer une voie moins evidente.',
              replies: [
                { id: 'reply_branch', label: 'Je suis cette piste.', actionType: 'scene', targetSceneId: branchScene?.id || '', dialogue: 'Tu prends la branche narrative secondaire.' },
                { id: 'reply_secret', label: 'Je tente la voie cachee.', branchTags: ['secret'], actionType: 'ending', conditionType: 'has_item', conditionItemId: item.id, endingType: 'secret', endingTitle: config.secretTitle, endingSummary: 'L indice change le sens de la scene. Tu atteins une conclusion alternative.', dialogue: 'Le detail cache fait basculer la conversation.', showWhenLocked: true, lockedLabel: `Il faut obtenir: ${config.itemName}.` },
                { id: 'reply_verify', label: 'Je verifie la piste principale.', branchTags: ['voie_principale'], actionType: 'scene', targetSceneId: branchScene?.id || '', dialogue: 'Tu pars confirmer ce que le dialogue a revele.' },
              ],
            },
            {
              id: 'after_item',
              speaker: config.npc,
              text: 'Cet objet ne sert que si tu comprends son contexte.',
              replies: [
                { id: 'reply_enigma', label: "Je veux verifier l'indice.", actionType: 'enigma', enigmaId: enigma.id, dialogue: "L'indice demande une interpretation precise." },
                { id: 'reply_branch_with_item', label: 'Je vais confronter cet indice sur place.', actionType: 'scene', targetSceneId: branchScene?.id || '', dialogue: 'Tu pars chercher la preuve qui manque.' },
                { id: 'reply_neutral', label: 'Je m arrete avec cet indice.', actionType: 'ending', endingType: 'neutral', endingTitle: 'Fin neutre', endingSummary: 'Tu conserves une partie de la verite, mais l histoire garde ses zones d ombre.', dialogue: 'Tu choisis de ne pas pousser plus loin.' },
              ],
            },
          ],
        },
      },
      {
        ...makeHotspot(),
        name: config.itemName,
        x: 22,
        y: 66,
        width: 18,
        height: 14,
        actionType: 'dialogue_item',
        dialogue: `Tu recuperes un indice de depart: ${config.itemName}.`,
        rewardItemId: item.id,
      },
    ];
  }

  if (branchScene) {
    branchScene.name = config.scenes[1];
    branchScene.actId = actId;
    branchScene.parentSceneId = startScene?.id || '';
    branchScene.introText = config.intros[1];
    branchScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.enigmaName,
        x: 46,
        y: 42,
        width: 22,
        height: 18,
        actionType: 'dialogue',
        dialogue: 'Cette etape valide ce que le dialogue a prepare.',
        enigmaId: enigma.id,
      },
      {
        ...makeHotspot(),
        name: config.supportItemName,
        x: 58,
        y: 64,
        width: 18,
        height: 14,
        actionType: 'dialogue_item',
        dialogue: `Tu trouves une preuve de contexte: ${config.supportItemName}.`,
        rewardItemId: supportItem.id,
      },
      {
        ...makeHotspot(),
        name: 'Continuer',
        x: 78,
        y: 70,
        width: 16,
        height: 12,
        actionType: 'scene',
        dialogue: 'Tu avances vers la conclusion avec la preuve en main.',
        requiredItemId: supportItem.id,
        lockedMessage: `Il faut d abord recuperer: ${config.supportItemName}.`,
        targetSceneId: endScene?.id || '',
      },
      {
        ...makeHotspot(),
        name: 'Retour',
        x: 10,
        y: 78,
        width: 14,
        height: 12,
        actionType: 'scene',
        dialogue: 'Tu reviens au point de depart pour verifier une autre piste.',
        targetSceneId: startScene?.id || '',
      },
    ];
  }

  if (endScene) {
    endScene.name = config.scenes[2];
    endScene.actId = actId;
    endScene.parentSceneId = branchScene?.id || startScene?.id || '';
    endScene.introText = config.intros[2];
    endScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.finalItemName,
        x: 34,
        y: 60,
        width: 20,
        height: 16,
        actionType: 'dialogue_item',
        dialogue: `La derniere piece du parcours est la: ${config.finalItemName}.`,
        requiredItemId: supportItem.id,
        rewardItemId: finalItem.id,
        lockedMessage: `Il manque encore: ${config.supportItemName}.`,
      },
      {
        ...makeHotspot(),
        name: 'Resume final',
        x: 58,
        y: 48,
        width: 24,
        height: 18,
        actionType: 'conversation',
        dialogue: 'Il reste a choisir comment cette histoire se termine.',
        conversation: {
          startNodeId: 'final',
          nodes: [{
            id: 'final',
            speaker: config.npc,
            text: 'Il reste a choisir comment cette histoire se termine.',
            replies: [
              {
                id: 'final_good',
                label: 'Assumer la meilleure issue.',
                actionType: 'ending',
                conditionType: 'advanced',
                advancedConditionMode: 'all',
                advancedConditions: [
                  { id: `${templateId}_final_item`, type: 'has_item', itemId: finalItem.id },
                  { id: `${templateId}_final_enigma`, type: 'solved_enigma', enigmaId: enigma.id },
                  { id: `${templateId}_final_variable`, type: 'story_variable', variableKey: config.variableKey, operator: 'greater_or_equal', value: '1' },
                ],
                showWhenLocked: true,
                lockedLabel: 'Il faut la preuve finale, l enigme resolue et assez de confiance.',
                endingType: 'good',
                endingTitle: config.goodTitle,
                endingSummary: 'Tu as suivi les indices, structure le plan et garde la maitrise de la conclusion.',
              },
              {
                id: 'final_secret',
                label: 'Reveler la voie cachee.',
                actionType: 'ending',
                conditionType: 'advanced',
                advancedConditionMode: 'all',
                advancedConditions: [
                  { id: `${templateId}_secret_item`, type: 'has_item', itemId: item.id },
                  { id: `${templateId}_secret_support`, type: 'has_item', itemId: supportItem.id },
                ],
                showWhenLocked: true,
                lockedLabel: 'Il faut l indice de depart et la preuve de contexte.',
                endingType: 'secret',
                endingTitle: config.secretTitle,
                endingSummary: 'Les objets obtenus plus tot revelent une fin alternative.',
              },
              {
                id: 'final_neutral',
                label: 'Conclure sans tout prouver.',
                actionType: 'ending',
                endingType: 'neutral',
                endingTitle: 'Fin neutre',
                endingSummary: 'Le parcours reste jouable, mais il manque encore une preuve ou une enigme resolue.',
              },
            ],
          }],
        },
      },
      {
        ...makeHotspot(),
        name: 'Retour',
        x: 10,
        y: 78,
        width: 14,
        height: 12,
        actionType: 'scene',
        dialogue: 'Tu retournes vers la scene precedente.',
        targetSceneId: branchScene?.id || '',
      },
    ];
  }

  project.scenes = scenes.filter(Boolean);
  project.routeMap = {
    rows: 16,
    cols: 24,
    cells: [],
    rooms: [
      { id: `${templateId}_room_start`, name: config.scenes[0], sceneId: startScene?.id || '', x: 20, y: 48, type: 'start' },
      { id: `${templateId}_room_branch`, name: config.scenes[1], sceneId: branchScene?.id || '', x: 52, y: 34, type: 'room' },
      { id: `${templateId}_room_end`, name: config.scenes[2], sceneId: endScene?.id || '', x: 80, y: 58, type: 'end' },
    ],
    connections: [
      { id: `${templateId}_connection_branch`, fromRoomId: `${templateId}_room_start`, toRoomId: `${templateId}_room_branch`, label: 'Choix principal', locked: false, allowOneWay: false },
      { id: `${templateId}_connection_end`, fromRoomId: `${templateId}_room_branch`, toRoomId: `${templateId}_room_end`, label: config.enigmaName, locked: true, allowOneWay: true },
    ],
    actMaps: {},
    notes: `Template narratif: ${TEMPLATE_TITLES[templateId]}. Plan: ${config.scenes[0]} -> ${config.scenes[1]} -> ${config.scenes[2]}. Objets: ${config.itemName}, ${config.supportItemName}, ${config.finalItemName}. Enigme: ${config.enigmaName}. La bonne fin demande l'objet final, l'enigme resolue et une variable de confiance positive.`,
  };
  project.start = { type: 'scene', targetSceneId: startScene?.id || '', targetCinematicId: '' };
  return normalizeProject(project);
};

const applyClassicTemplate = (project, templateId) => {
  const config = CLASSIC_TEMPLATE_CONFIGS[templateId];
  if (!config) return null;

  const scenes = project.scenes.slice(0, 3);
  const [startScene, branchScene, endScene] = scenes;
  const actId = project.acts[0]?.id || '';
  const [accessItem, clueItem, finalItem] = config.itemNames.map((itemName, index) => (
    makeItem(itemName, config.itemIcons[index] || '[]')
  ));
  const enigma = makeEnigma({
    name: config.enigmaName,
    type: 'misc',
    miscMode: 'multiple-choice',
    question: config.enigmaQuestion,
    miscChoices: config.enigmaChoices,
    solutionText: config.enigmaSolution,
    successMessage: config.enigmaSuccess,
    failMessage: config.enigmaFail,
    unlockType: 'scene',
    targetSceneId: endScene?.id || '',
  });

  project.acts = [{ ...project.acts[0], name: config.actName }];
  project.items = [accessItem, clueItem, finalItem];
  project.combinations = [];
  project.cinematics = [];
  project.enigmas = [enigma];
  project.storyVariables = [];

  if (startScene) {
    startScene.name = config.scenes[0];
    startScene.actId = actId;
    startScene.parentSceneId = '';
    startScene.introText = config.intros[0];
    startScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.startObjectName,
        x: 24,
        y: 58,
        width: 18,
        height: 14,
        actionType: 'dialogue_item',
        dialogue: config.startObjectDialogue,
        rewardItemId: accessItem.id,
      },
      {
        ...makeHotspot(),
        name: config.startClueName,
        x: 56,
        y: 42,
        width: 20,
        height: 16,
        actionType: 'dialogue',
        dialogue: config.startClueDialogue,
      },
      {
        ...makeHotspot(),
        name: config.branchEntryName,
        x: 78,
        y: 58,
        width: 16,
        height: 18,
        actionType: 'scene',
        dialogue: config.branchEntryDialogue,
        requiredItemId: accessItem.id,
        lockedMessage: config.branchLockedMessage,
        targetSceneId: branchScene?.id || '',
      },
    ];
  }

  if (branchScene) {
    branchScene.name = config.scenes[1];
    branchScene.actId = actId;
    branchScene.parentSceneId = startScene?.id || '';
    branchScene.introText = config.intros[1];
    branchScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.enigmaName,
        x: 46,
        y: 44,
        width: 24,
        height: 18,
        actionType: 'dialogue',
        dialogue: config.enigmaQuestion,
        enigmaId: enigma.id,
      },
      {
        ...makeHotspot(),
        name: config.branchObjectName,
        x: 62,
        y: 66,
        width: 18,
        height: 14,
        actionType: 'dialogue_item',
        dialogue: config.branchObjectDialogue,
        rewardItemId: clueItem.id,
      },
      {
        ...makeHotspot(),
        name: 'Retour',
        x: 10,
        y: 78,
        width: 14,
        height: 12,
        actionType: 'scene',
        dialogue: 'Tu reviens au point de depart pour verifier tes indices.',
        targetSceneId: startScene?.id || '',
      },
    ];
  }

  if (endScene) {
    endScene.name = config.scenes[2];
    endScene.actId = actId;
    endScene.parentSceneId = branchScene?.id || startScene?.id || '';
    endScene.introText = config.intros[2];
    endScene.hotspots = [
      {
        ...makeHotspot(),
        name: config.finalObjectName,
        x: 42,
        y: 58,
        width: 20,
        height: 16,
        actionType: 'dialogue_item',
        dialogue: config.finalObjectDialogue,
        requiredItemId: clueItem.id,
        rewardItemId: finalItem.id,
        lockedMessage: 'Il manque encore l indice de la scene precedente.',
      },
      {
        ...makeHotspot(),
        name: 'Conclusion',
        x: 64,
        y: 42,
        width: 22,
        height: 18,
        actionType: 'conversation',
        dialogue: config.conclusionText,
        conversation: {
          startNodeId: 'final',
          nodes: [{
            id: 'final',
            speaker: config.conclusionSpeaker,
            text: config.conclusionText,
            replies: [
              {
                id: `${templateId}_final_good`,
                label: 'Relier tous les indices.',
                actionType: 'ending',
                conditionType: 'advanced',
                advancedConditionMode: 'all',
                advancedConditions: [
                  { id: `${templateId}_condition_item`, type: 'has_item', itemId: finalItem.id },
                  { id: `${templateId}_condition_enigma`, type: 'solved_enigma', enigmaId: enigma.id },
                ],
                showWhenLocked: true,
                lockedLabel: 'Il faut resoudre l enigme et recuperer le dernier objet.',
                endingType: 'good',
                endingTitle: config.goodEndingTitle,
                endingSummary: config.goodEndingSummary,
              },
              {
                id: `${templateId}_final_neutral`,
                label: 'Sortir avec les indices actuels.',
                actionType: 'ending',
                endingType: 'neutral',
                endingTitle: config.neutralEndingTitle,
                endingSummary: config.neutralEndingSummary,
              },
              {
                id: `${templateId}_final_back`,
                label: 'Retourner chercher un detail.',
                actionType: 'scene',
                targetSceneId: branchScene?.id || startScene?.id || '',
              },
            ],
          }],
        },
      },
      {
        ...makeHotspot(),
        name: 'Retour',
        x: 10,
        y: 78,
        width: 14,
        height: 12,
        actionType: 'scene',
        dialogue: 'Tu retournes vers la scene precedente.',
        targetSceneId: branchScene?.id || '',
      },
    ];
  }

  project.scenes = scenes.filter(Boolean);
  project.routeMap = {
    rows: 16,
    cols: 24,
    cells: [],
    rooms: [
      { id: `${templateId}_room_start`, name: config.scenes[0], sceneId: startScene?.id || '', x: 18, y: 54, type: 'start' },
      { id: `${templateId}_room_branch`, name: config.scenes[1], sceneId: branchScene?.id || '', x: 50, y: 38, type: 'room' },
      { id: `${templateId}_room_end`, name: config.scenes[2], sceneId: endScene?.id || '', x: 82, y: 58, type: 'end' },
    ],
    connections: [
      { id: `${templateId}_connection_branch`, fromRoomId: `${templateId}_room_start`, toRoomId: `${templateId}_room_branch`, label: config.routeLabels[0], locked: true, allowOneWay: false },
      { id: `${templateId}_connection_end`, fromRoomId: `${templateId}_room_branch`, toRoomId: `${templateId}_room_end`, label: config.routeLabels[1], locked: true, allowOneWay: true },
    ],
    actMaps: {},
    notes: config.routeNotes,
  };
  project.start = { type: 'scene', targetSceneId: startScene?.id || '', targetCinematicId: '' };
  return normalizeProject(project);
};

export function applyCreationTemplate(baseProject, templateId, name) {
  const project = normalizeProject(baseProject);
  project.title = name || TEMPLATE_TITLES[templateId] || 'Nouveau projet';

  if (templateId === 'empty') {
    project.acts = [{ ...project.acts[0], name: 'Acte I' }];
    project.scenes = project.scenes.slice(0, 1).map((scene) => ({
      ...scene,
      name: 'Scène de départ',
      parentSceneId: '',
      introText: 'Décris ici le point de départ de ton escape game.',
      hotspots: [],
    }));
    project.items = [];
    project.combinations = [];
    project.cinematics = [];
    project.enigmas = [];
    project.start = { type: 'scene', targetSceneId: project.scenes[0]?.id || '', targetCinematicId: '' };
    return normalizeProject(project);
  }

  if (templateId === 'book_hero') {
    return applyBookHeroTemplate(project, name);
  }

  if (templateId === 'adventure_choices') {
    const scenes = project.scenes.slice(0, 3);
    const [arrival, forest, tower] = scenes;
    const actId = project.acts[0]?.id || '';
    const guideToken = makeItem('Jeton du guide', '[]');
    const valleyMap = makeItem('Carte de la vallee', 'MAP');
    const watcherSeal = makeItem('Sceau du guetteur', 'O');
    const choiceEnigma = makeEnigma({
      name: 'Decision du vieux panneau',
      type: 'misc',
      miscMode: 'multiple-choice',
      question: 'Le panneau montre trois symboles. Lequel indique un passage sur ?',
      miscChoices: ['La lune', 'La flamme', 'La vague'],
      solutionText: 'La lune',
      successMessage: 'Le symbole dé la lune brille. Un chemin secret apparait.',
      failMessage: 'Le panneau reste silencieux. Ce symbole mene ailleurs.',
      unlockType: 'scene',
      targetSceneId: tower?.id || '',
    });

    project.acts = [{ ...project.acts[0], name: 'Chapitre I' }];
    project.items = [guideToken, valleyMap, watcherSeal];
    project.combinations = [];
    project.cinematics = [];
    project.enigmas = [choiceEnigma];

    if (arrival) {
      arrival.name = 'Croisee des chemins';
      arrival.actId = actId;
      arrival.parentSceneId = '';
      arrival.introText = 'Tu arrives devant une vallee inconnue. Chaque direction change la suite de ton aventure.';
      arrival.hotspots = [
        {
          ...makeHotspot(),
          name: 'Choisir la forêt',
          x: 25,
          y: 58,
          width: 18,
          height: 16,
          actionType: 'scene',
          dialogue: 'Tu suis le sentier sous les branches.',
          targetSceneId: forest?.id || '',
        },
        {
          ...makeHotspot(),
          name: 'Choisir la tour',
          x: 68,
          y: 42,
          width: 18,
          height: 18,
          actionType: 'scene',
          dialogue: 'Tu marches vers la tour au sommet.',
          targetSceneId: tower?.id || '',
          enigmaId: choiceEnigma.id,
        },
        {
          ...makeHotspot(),
          name: 'Guide du carrefour',
          x: 48,
          y: 62,
          width: 18,
          height: 18,
          actionType: 'conversation',
          dialogue: 'Le guide attend ta decision.',
          conversation: {
            startNodeId: 'guide_start',
            nodes: [
              {
                id: 'guide_start',
                speaker: 'Guide',
                text: 'Tu peux prendre la forêt ou viser la tour. Que veux-tu demander ?',
                replies: [
                  {
                    id: 'guide_reply_forest',
                    label: 'Quel chemin est le plus sur ?',
                    actionType: 'node',
                    nextNodeId: 'guide_forest',
                    dialogue: '',
                  },
                  {
                    id: 'guide_reply_token',
                    label: 'As-tu quelque chose pour m aider ?',
                    actionType: 'item',
                    rewardItemId: guideToken.id,
                    dialogue: 'Le guide te donne un jeton grave. Il pourrait servir plus tard.',
                  },
                  {
                    id: 'guide_reply_tower',
                    label: 'Comment atteindre la tour ?',
                    actionType: 'enigma',
                    enigmaId: choiceEnigma.id,
                    dialogue: 'Le guide pointe le vieux panneau. Choisis le bon symbole.',
                  },
                  {
                    id: 'guide_reply_leave',
                    label: 'Je vais explorer seul.',
                    actionType: 'end',
                    dialogue: 'Le guide hoche la tete et te laisse choisir.',
                  },
                ],
              },
              {
                id: 'guide_forest',
                speaker: 'Guide',
                text: 'La forêt est plus lente, mais elle revele le secret du panneau. Veux-tu y aller ?',
                replies: [
                  {
                    id: 'guide_reply_go_forest',
                    label: 'Oui, je prends la forêt.',
                    actionType: 'scene',
                    targetSceneId: forest?.id || '',
                    dialogue: 'Tu suis le conseil du guide et entres sous les arbres.',
                  },
                  {
                    id: 'guide_reply_back',
                    label: 'Je veux poser une autre question.',
                    actionType: 'node',
                    nextNodeId: 'guide_start',
                    dialogue: '',
                  },
                ],
              },
            ],
          },
        },
        {
          ...makeHotspot(),
          name: 'Sac abandonne',
          x: 34,
          y: 76,
          width: 16,
          height: 12,
          actionType: 'dialogue_item',
          dialogue: 'Tu trouves une carte de la vallee. Elle montre que la forêt contourne la tour.',
          rewardItemId: valleyMap.id,
        },
      ];
    }

    if (forest) {
      forest.name = 'Sentier de la forêt';
      forest.actId = actId;
      forest.parentSceneId = arrival?.id || '';
      forest.introText = 'Les arbres se referment derrière toi. Un panneau ancien propose plusieurs symboles.';
      forest.hotspots = [
        {
          ...makeHotspot(),
          name: 'Lire le panneau',
          x: 46,
          y: 48,
          width: 20,
          height: 18,
          actionType: 'dialogue',
          dialogue: 'Le panneau démande de choisir le symbole qui protege le voyageur.',
          enigmaId: choiceEnigma.id,
        },
        {
          ...makeHotspot(),
          name: 'Comparer la carte',
          x: 62,
          y: 62,
          width: 18,
          height: 14,
          actionType: 'dialogue',
          dialogue: 'La carte confirme que le symbole de la lune correspond au passage discret.',
          requiredItemId: valleyMap.id,
          lockedMessage: 'Une carte rendrait ce panneau plus clair.',
        },
        {
          ...makeHotspot(),
          name: 'Retour à la croisee',
          x: 10,
          y: 76,
          width: 16,
          height: 12,
          actionType: 'scene',
          dialogue: 'Tu reviens au point de départ.',
          targetSceneId: arrival?.id || '',
        },
      ];
    }

    if (tower) {
      tower.name = 'Tour du guetteur';
      tower.actId = actId;
      tower.parentSceneId = arrival?.id || '';
      tower.introText = 'La tour domine la vallee. D ici, tu comprends que tes choix tracent la carte.';
      tower.hotspots = [
        {
          ...makeHotspot(),
          name: 'Observer la vallee',
          x: 52,
          y: 35,
          width: 20,
          height: 16,
          actionType: 'dialogue',
          dialogue: 'La prochaine scène pourrait devenir une autre branche de ton histoire.',
        },
        {
          ...makeHotspot(),
          name: 'Coffret du guetteur',
          x: 44,
          y: 58,
          width: 18,
          height: 14,
          actionType: 'dialogue_item',
          dialogue: 'Le coffret contient le sceau du guetteur, preuve que tu as atteint la bonne branche.',
          requiredItemId: guideToken.id,
          rewardItemId: watcherSeal.id,
          lockedMessage: 'Le coffret demande le jeton du guide.',
        },
        {
          ...makeHotspot(),
          name: 'Conclusion',
          x: 68,
          y: 56,
          width: 18,
          height: 14,
          actionType: 'conversation',
          dialogue: 'La tour peut conclure cette branche ou renvoyer vers une autre route.',
          conversation: {
            startNodeId: 'tower_final',
            nodes: [{
              id: 'tower_final',
              speaker: 'Tour du guetteur',
              text: 'Ta route est lisible si tu as garde une preuve du passage.',
              replies: [
                {
                  id: 'tower_final_good',
                  label: 'Montrer le sceau du guetteur.',
                  actionType: 'ending',
                  conditionType: 'advanced',
                  advancedConditionMode: 'all',
                  advancedConditions: [
                    { id: 'tower_condition_seal', type: 'has_item', itemId: watcherSeal.id },
                    { id: 'tower_condition_enigma', type: 'solved_enigma', enigmaId: choiceEnigma.id },
                  ],
                  showWhenLocked: true,
                  lockedLabel: 'Il faut le sceau et la bonne decision du panneau.',
                  endingType: 'good',
                  endingTitle: 'Route du guetteur',
                  endingSummary: 'Tu as construit une branche complete: choix, carte, enigme et preuve finale.',
                },
                {
                  id: 'tower_final_neutral',
                  label: 'Observer encore la vallee.',
                  actionType: 'ending',
                  endingType: 'neutral',
                  endingTitle: 'Branche ouverte',
                  endingSummary: 'La tour donne une vue d ensemble, mais il reste des objets ou enigmes a exploiter.',
                },
              ],
            }],
          },
        },
        {
          ...makeHotspot(),
          name: 'Retour à la croisee',
          x: 12,
          y: 78,
          width: 16,
          height: 12,
          actionType: 'scene',
          dialogue: 'Tu redescends vers le choix initial.',
          targetSceneId: arrival?.id || '',
        },
      ];
    }

    project.scenes = scenes.filter(Boolean);
    project.routeMap = {
      rows: 16,
      cols: 24,
      cells: [],
      rooms: [
        { id: 'adventure_room_start', name: 'Croisee', sceneId: arrival?.id || '', x: 22, y: 48, type: 'start' },
        { id: 'adventure_room_forest', name: 'Forêt', sceneId: forest?.id || '', x: 52, y: 30, type: 'room' },
        { id: 'adventure_room_tower', name: 'Tour', sceneId: tower?.id || '', x: 78, y: 58, type: 'end' },
      ],
      connections: [
        { id: 'adventure_connection_forest', fromRoomId: 'adventure_room_start', toRoomId: 'adventure_room_forest', label: 'Choix forêt', locked: false, allowOneWay: false },
        { id: 'adventure_connection_tower', fromRoomId: 'adventure_room_start', toRoomId: 'adventure_room_tower', label: 'Choix tour', locked: true, allowOneWay: false },
        { id: 'adventure_connection_secret', fromRoomId: 'adventure_room_forest', toRoomId: 'adventure_room_tower', label: 'Panneau: La lune', locked: true, allowOneWay: true },
      ],
      actMaps: {},
      notes: 'Mode aventure: plan Croisee -> Foret -> Tour. Objets: jeton du guide, carte de la vallee, sceau du guetteur. Enigme: Decision du vieux panneau. La bonne fin demande le sceau et l enigme resolue.',
    };
    project.start = { type: 'scene', targetSceneId: arrival?.id || '', targetCinematicId: '' };
    return normalizeProject(project);
  }

  if (templateId === 'hero_adventure') {
    const scenes = project.scenes.slice(0, 3);
    const [camp, ruins, sanctum] = scenes;
    const actId = project.acts[0]?.id || '';
    const relic = makeItem('Relique ancienne', '[]');
    const healthPotion = {
      ...makeItem('Potion de soin', 'PV'),
      heroItemType: 'health_potion',
      heroItemAmount: 6,
      heroItemConsumeOnUse: true,
    };
    const manaPotion = {
      ...makeItem('Potion de mana', 'MP'),
      heroItemType: 'mana_potion',
      heroItemAmount: 4,
      heroItemConsumeOnUse: true,
    };
    const trainingBlade = {
      ...makeItem('Lame d entrainement', '+1'),
      heroItemType: 'equipment',
      heroItemBonusTarget: 'skill',
      heroItemSkillId: 'force',
      heroItemBonus: 1,
      heroItemConsumeOnUse: false,
    };
    const trialEnigma = makeEnigma({
      name: 'Epreuve de bravoure',
      type: 'misc',
      miscMode: 'multiple-choice',
      question: 'Quel attribut aide a franchir le pont instable ?',
      miscChoices: ['Force', 'Ruse', 'Magie'],
      solutionText: 'Force',
      successMessage: 'Tu trouves l elan nécessaire et le pont tient bon.',
      failMessage: 'Le pont craque. Il faut mieux evaluer tes chances.',
      unlockType: 'scene',
      targetSceneId: sanctum?.id || '',
    });

    project.creationMode = 'hero_adventure';
    project.heroAdventure = {
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
    };
    project.acts = [{ ...project.acts[0], name: 'Chapitre I' }];
    project.items = [relic, healthPotion, manaPotion, trainingBlade];
    project.combinations = [];
    project.cinematics = [];
    project.enigmas = [trialEnigma];

    if (camp) {
      camp.name = 'Camp du héros';
      camp.actId = actId;
      camp.parentSceneId = '';
      camp.introText = 'Ton héros arrive au camp. Lance le dé, surveille tes points de vie et choisis comment avancer.';
      camp.hotspots = [
        {
          ...makeHotspot(),
          name: 'Partir vers les ruines',
          x: 58,
          y: 54,
          width: 22,
          height: 18,
          actionType: 'scene',
          dialogue: 'Tu quittes le feu de camp pour suivre les pierres anciennes.',
          targetSceneId: ruins?.id || '',
        },
        {
          ...makeHotspot(),
          name: 'Fouiller le sac',
          x: 24,
          y: 68,
          width: 18,
          height: 14,
          actionType: 'dialogue',
          dialogue: 'Tu prends une relique ancienne et quelques objets utiles.',
          rewardItemId: relic.id,
        },
        {
          ...makeHotspot(),
          name: 'Prendre les potions',
          x: 28,
          y: 48,
          width: 18,
          height: 14,
          actionType: 'dialogue',
          dialogue: 'Tu ranges une potion de soin.',
          rewardItemId: healthPotion.id,
        },
        {
          ...makeHotspot(),
          name: 'Prendre la potion de mana',
          x: 34,
          y: 34,
          width: 16,
          height: 12,
          actionType: 'dialogue',
          dialogue: 'Tu ranges une potion de mana.',
          rewardItemId: manaPotion.id,
        },
        {
          ...makeHotspot(),
          name: 'Equiper la lame',
          x: 16,
          y: 42,
          width: 16,
          height: 12,
          actionType: 'dialogue',
          dialogue: 'Tu prends une lame d entrainement. Clique-la dans l’inventaire pour gagner un bonus.',
          rewardItemId: trainingBlade.id,
        },
      ];
    }

    if (ruins) {
      ruins.name = 'Pont des ruines';
      ruins.actId = actId;
      ruins.parentSceneId = camp?.id || '';
      ruins.introText = 'Un pont instable bloqué la route. Utilise un jet de dé et tes compétences pour raconter le résultat.';
      ruins.timerEnabled = true;
      ruins.timerSeconds = 90;
      ruins.timerEndAction = 'damage-life';
      ruins.timerLifeLoss = 2;
      ruins.timerEndMessage = 'Le pont s effondre partiellement: tu perds 2 PV.';
      ruins.hotspots = [
        {
          ...makeHotspot(),
          name: 'Tenter le passage',
          x: 45,
          y: 46,
          width: 24,
          height: 18,
          actionType: 'dialogue',
          dialogue: 'Fais un jet de Force. Sur 12 ou plus, le passage est ouvert.',
          enigmaId: trialEnigma.id,
        },
        {
          ...makeHotspot(),
          name: 'Retour au camp',
          x: 14,
          y: 76,
          width: 16,
          height: 12,
          actionType: 'scene',
          dialogue: 'Tu retournes reprendre ton souffle.',
          targetSceneId: camp?.id || '',
        },
      ];
    }

    if (sanctum) {
      sanctum.name = 'Sanctuaire oublie';
      sanctum.actId = actId;
      sanctum.parentSceneId = ruins?.id || camp?.id || '';
      sanctum.introText = 'Le sanctuaire s ouvre. Les prochains chapitres peuvent consommer mana, objets et points de vie.';
      sanctum.hotspots = [
        {
          ...makeHotspot(),
          name: 'Examiner l autel',
          x: 48,
          y: 42,
          width: 22,
          height: 18,
          actionType: 'dialogue',
          dialogue: 'L autel reagit aux compétences magiques. Note le résultat du de dans ton histoire.',
        },
      ];
    }

    project.scenes = scenes.filter(Boolean);
    project.routeMap = {
      rows: 16,
      cols: 24,
      cells: [],
      rooms: [
        { id: 'hero_room_camp', name: 'Camp', sceneId: camp?.id || '', x: 18, y: 54, type: 'start' },
        { id: 'hero_room_ruins', name: 'Ruines', sceneId: ruins?.id || '', x: 50, y: 42, type: 'room' },
        { id: 'hero_room_sanctum', name: 'Sanctuaire', sceneId: sanctum?.id || '', x: 82, y: 58, type: 'end' },
      ],
      connections: [
        { id: 'hero_connection_ruins', fromRoomId: 'hero_room_camp', toRoomId: 'hero_room_ruins', label: 'Départ', locked: false, allowOneWay: false },
        { id: 'hero_connection_sanctum', fromRoomId: 'hero_room_ruins', toRoomId: 'hero_room_sanctum', label: 'Epreuve Force', locked: true, allowOneWay: true },
      ],
      actMaps: {},
      notes: 'Mode héros aventure: utilise le HUD héros pour les jets de dé, PV, mana et compétences. Les scènes restent reliées par les choix existants.',
    };
    project.start = { type: 'scene', targetSceneId: camp?.id || '', targetCinematicId: '' };
    return normalizeProject(project);
  }

  const narrativeProject = applyNarrativeTemplate(project, templateId);
  if (narrativeProject) return narrativeProject;

  const classicProject = applyClassicTemplate(project, templateId);
  if (classicProject) return classicProject;

  return normalizeProject(project);
}
