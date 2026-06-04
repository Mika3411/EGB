import { makeEnigma, makeHotspot, makeItem, makeScene, normalizeProject } from '../data/projectData';

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

const applyBookHeroTemplate = (project, name) => {
  const actId = project.acts[0]?.id || '';
  const scenes = project.scenes.slice(0, 3);
  while (scenes.length < 5) {
    scenes.push(makeScene({ actId, hotspots: [] }));
  }

  const [road, gate, market, catacombs, throne] = scenes;
  const silverBookmark = makeItem('Marque-page d argent', '[]');
  const lantern = makeItem('Lanterne sourde', 'O');
  const riddle = makeEnigma({
    name: 'Le serment de la citadelle',
    type: 'misc',
    miscMode: 'multiple-choice',
    question: 'La porte demande: "Je guide sans marcher, je parle sans bouche, je garde ta page quand tu hesites."',
    miscChoices: ['Le marque-page', 'La cle', 'Le vent'],
    solutionText: 'Le marque-page',
    successMessage: 'La pierre reconnait ton serment et une voie s ouvre vers la salle du trone.',
    failMessage: 'La porte reste froide. Il faut revenir avec le bon symbole.',
    unlockType: 'scene',
    targetSceneId: throne?.id || '',
  });

  project.title = name || 'La Citadelle des Brumes';
  project.creationMode = 'hero_adventure';
  project.heroAdventure = {
    enabled: true,
    dice: { sides: 10, label: 'd10', skin: 'bone' },
    hero: {
      name: 'Rodeur des Brumes',
      description: 'Un heros de livre-jeu: habilete pour toucher, endurance pour survivre, discipline pour lire les indices.',
      health: 22,
      maxHealth: 22,
      mana: 0,
      maxMana: 0,
      initiative: 1,
      armor: 1,
      dodgeChance: 5,
      equipmentSlotCount: 4,
      equipmentSlotLabels: ['Arme', 'Cape', 'Talisman', 'Sac'],
      skills: [
        { id: 'force', name: 'Habilete', value: 5, baseValue: 5, rolledValue: 0, rollFormula: '', manaCost: 0 },
        { id: 'survie', name: 'Endurance', value: 3, baseValue: 3, rolledValue: 0, rollFormula: '', manaCost: 0 },
        { id: 'ruse', name: 'Discipline', value: 2, baseValue: 2, rolledValue: 0, rollFormula: '', manaCost: 0 },
      ],
      powers: [],
    },
    rules: {
      criticalSuccess: 10,
      criticalFailure: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
    },
    combat: {
      turnMode: true,
      showDice: true,
      enemyAutoTurn: false,
      enemyName: 'Gardien de brume',
      heroAttackType: 'physical',
      heroDieDamagePercent: 30,
      enemyStrength: 3,
      enemyDieDamagePercent: 20,
      enemyCunning: 8,
      enemyChaos: 8,
      enemyArmor: 0,
      enemyDodgeChance: 0,
      enemyMaxMana: 0,
      enemyPowerUsageChance: 0,
      enemyAiMode: 'tactical',
      enemyCriticalChance: 5,
      enemyCriticalMultiplier: 2,
    },
  };
  project.acts = [{ ...project.acts[0], name: 'Livre I' }];
  project.items = [silverBookmark, lantern];
  project.combinations = [];
  project.cinematics = [];
  project.enigmas = [riddle];
  project.storyVariables = [
    {
      id: 'book_hero_courage',
      key: 'courage',
      type: 'number',
      defaultValue: 0,
      description: 'Mesure les choix directs et risqués du lecteur.',
      journalLabel: 'Courage',
      journalVisible: true,
    },
    {
      id: 'book_hero_lucidite',
      key: 'lucidite',
      type: 'number',
      defaultValue: 0,
      description: 'Mesure les choix prudents, l observation et les indices compris.',
      journalLabel: 'Lucidite',
      journalVisible: true,
    },
  ];

  road.name = 'Page 1 - La route brumeuse';
  road.actId = actId;
  road.parentSceneId = '';
  road.visualEffect = 'fog';
  road.introText = 'Tu avances sur une route blanche de brume. Au loin, la Citadelle des Brumes attend. Chaque choix te renverra vers une nouvelle page.';
  road.hotspots = [{
    ...makeHotspot(),
    name: 'Ouvrir le livre',
    x: 47,
    y: 50,
    width: 24,
    height: 18,
    actionType: 'conversation',
    dialogue: 'Le livre attend ton premier choix.',
    conversation: {
      startNodeId: 'page_1',
      nodes: [
        {
          id: 'page_1',
          speaker: 'Le livre',
          text: 'La route se divise devant toi. Vas-tu affronter la porte noire, contourner par le marche abandonne, ou lire la note glissee dans la couverture ?',
          replies: [
            {
              id: 'page_1_gate',
              label: 'Aller a la porte noire. Rendez-vous page 12.',
              actionType: 'scene',
              targetSceneId: gate.id,
              storyVariableKey: 'courage',
              storyVariableOperation: 'increment',
              storyVariableValue: '1',
              dialogue: 'Tu choisis le chemin le plus direct.',
            },
            {
              id: 'page_1_market',
              label: 'Contourner par le marche abandonne. Rendez-vous page 27.',
              actionType: 'scene',
              targetSceneId: market.id,
              storyVariableKey: 'lucidite',
              storyVariableOperation: 'increment',
              storyVariableValue: '1',
              dialogue: 'Tu preferes comprendre le lieu avant de frapper a sa porte.',
            },
            {
              id: 'page_1_bookmark',
              label: 'Lire la note cachee dans la couverture.',
              actionType: 'multiple',
              rewardItemId: silverBookmark.id,
              storyVariableKey: 'lucidite',
              storyVariableOperation: 'increment',
              storyVariableValue: '1',
              nextNodeId: 'page_1_note',
              dialogue: 'Tu trouves un marque-page d argent grave d une phrase: "La vraie porte repond a celui qui se souvient."',
            },
          ],
        },
        {
          id: 'page_1_note',
          speaker: 'Le livre',
          text: 'Le marque-page pese presque rien, mais la brume recule autour de lui.',
          replies: [
            {
              id: 'page_1_note_gate',
              label: 'Garder le marque-page et aller a la porte noire.',
              actionType: 'scene',
              targetSceneId: gate.id,
              storyVariableKey: 'courage',
              storyVariableOperation: 'increment',
              storyVariableValue: '1',
            },
            {
              id: 'page_1_note_market',
              label: 'Chercher d autres indices au marche.',
              actionType: 'scene',
              targetSceneId: market.id,
            },
          ],
        },
      ],
    },
  }];

  gate.name = 'Page 12 - La porte noire';
  gate.actId = actId;
  gate.parentSceneId = road.id;
  gate.visualEffect = 'vignette';
  gate.introText = 'La porte noire n a ni poignee ni serrure. Trois mots sont graves dans la pierre: preuve, serment, sacrifice.';
  gate.hotspots = [{
    ...makeHotspot(),
    name: 'Interroger la porte',
    x: 50,
    y: 44,
    width: 24,
    height: 20,
    actionType: 'conversation',
    conversation: {
      startNodeId: 'gate',
      nodes: [{
        id: 'gate',
        speaker: 'La porte',
        text: 'Montre ce qui garde ta place dans l histoire, ou accepte de perdre ton chemin.',
        replies: [
          {
            id: 'gate_riddle',
            label: 'Presenter le bon symbole et repondre a l enigme.',
            actionType: 'enigma',
            enigmaId: riddle.id,
            conditionType: 'has_item',
            conditionItemId: silverBookmark.id,
            showWhenLocked: true,
            lockedLabel: 'Il manque le symbole qui garde ta page.',
          },
          {
            id: 'gate_force',
            label: 'Forcer la porte. Rendez-vous a une mauvaise fin.',
            actionType: 'ending',
            endingType: 'bad',
            endingTitle: 'Fin 3 - La page dechiree',
            endingSummary: 'La porte cede, mais le livre se referme sur une version incomplete de ton aventure.',
            storyVariableKey: 'courage',
            storyVariableOperation: 'increment',
            storyVariableValue: '1',
          },
          {
            id: 'gate_market',
            label: 'Revenir chercher un indice. Rendez-vous page 27.',
            actionType: 'scene',
            targetSceneId: market.id,
          },
        ],
      }],
    },
  }];

  market.name = 'Page 27 - Le marche abandonne';
  market.actId = actId;
  market.parentSceneId = road.id;
  market.visualEffect = 'rain';
  market.introText = 'Des etals vides grincent sous la pluie. Une lanterne eteinte pend au-dessus d une carte dechiree.';
  market.hotspots = [{
    ...makeHotspot(),
    name: 'Explorer les etals',
    x: 42,
    y: 58,
    width: 28,
    height: 18,
    actionType: 'conversation',
    conversation: {
      startNodeId: 'market',
      nodes: [{
        id: 'market',
        speaker: 'La carte dechiree',
        text: 'Deux chemins restent lisibles: les catacombes sous la ville, ou le retour vers la porte noire.',
        replies: [
          {
            id: 'market_lantern',
            label: 'Prendre la lanterne sourde.',
            actionType: 'multiple',
            rewardItemId: lantern.id,
            storyVariableKey: 'lucidite',
            storyVariableOperation: 'increment',
            storyVariableValue: '1',
            nextNodeId: 'market_after_lantern',
            dialogue: 'La lanterne ne brille pas. Elle absorbe plutot les mensonges de la brume.',
          },
          {
            id: 'market_catacombs',
            label: 'Descendre vers les catacombes. Rendez-vous page 44.',
            actionType: 'scene',
            targetSceneId: catacombs.id,
          },
          {
            id: 'market_gate',
            label: 'Retourner a la porte noire. Rendez-vous page 12.',
            actionType: 'scene',
            targetSceneId: gate.id,
          },
        ],
      }, {
        id: 'market_after_lantern',
        speaker: 'La carte dechiree',
        text: 'Avec la lanterne, les passages effaces deviennent presque lisibles.',
        replies: [
          {
            id: 'market_after_catacombs',
            label: 'Suivre le passage efface. Rendez-vous page 44.',
            actionType: 'scene',
            targetSceneId: catacombs.id,
          },
          {
            id: 'market_after_gate',
            label: 'Retourner a la porte avec tes indices.',
            actionType: 'scene',
            targetSceneId: gate.id,
          },
        ],
      }],
    },
  }];

  catacombs.name = 'Page 44 - Les catacombes';
  catacombs.actId = actId;
  catacombs.parentSceneId = market.id;
  catacombs.visualEffect = 'embers';
  catacombs.introText = 'Sous la ville, les murs portent les noms des lecteurs qui ont choisi trop vite.';
  catacombs.hotspots = [{
    ...makeHotspot(),
    name: 'Suivre les noms',
    x: 52,
    y: 48,
    width: 24,
    height: 18,
    actionType: 'conversation',
    conversation: {
      startNodeId: 'catacombs',
      nodes: [{
        id: 'catacombs',
        speaker: 'Les murs',
        text: 'La lanterne revele une phrase: "Le trone n appartient pas au vainqueur, mais au lecteur qui revient changer son choix."',
        replies: [
          {
            id: 'catacombs_combat',
            label: 'Affronter le gardien de brume. Combat de livre-jeu.',
            actionType: 'hero_combat',
            combatEnemyName: 'Gardien de brume',
            combatEnemyMaxHealth: 14,
            combatSkillId: 'force',
            combatAttackDifficulty: 9,
            combatHeroAttackType: 'physical',
            combatHeroDieDamagePercent: 30,
            combatEnemyInitiative: 0,
            combatEnemyStrength: 3,
            combatEnemyDamage: 3,
            combatEnemyDieDamagePercent: 20,
            combatEnemyCunning: 8,
            combatEnemyChaos: 8,
            combatEnemyArmor: 0,
            combatEnemyDodgeChance: 0,
            combatEnemyMaxMana: 0,
            combatEnemyPowerUsageChance: 0,
            combatEnemyAiMode: 'tactical',
            combatVictoryDialogue: 'Le gardien se dissout. Tu gagnes le droit d ouvrir la page du trone.',
            combatDefeatDialogue: 'Tu survis de justesse, mais la brume te rejette a la premiere page.',
            combatVictoryTargetSceneId: throne.id,
            combatDefeatTargetSceneId: road.id,
            dialogue: 'Le gardien surgit entre les colonnes. Lance le de et compare ton Habilete a sa defense.',
          },
          {
            id: 'catacombs_secret',
            label: 'Lever la lanterne et chercher la voie cachee.',
            actionType: 'ending',
            conditionType: 'has_item',
            conditionItemId: lantern.id,
            endingType: 'secret',
            endingTitle: 'Fin 7 - Le chapitre invisible',
            endingSummary: 'Tu trouves une page que personne n avait encore lue. La citadelle ne tombe pas: elle t accepte comme auteur.',
            showWhenLocked: true,
            lockedLabel: 'Il faut une lumiere capable de lire la brume.',
          },
          {
            id: 'catacombs_throne',
            label: 'Monter vers la salle du trone. Rendez-vous page 60.',
            actionType: 'scene',
            targetSceneId: throne.id,
          },
          {
            id: 'catacombs_gate',
            label: 'Retourner a la porte noire.',
            actionType: 'scene',
            targetSceneId: gate.id,
          },
        ],
      }],
    },
  }];

  throne.name = 'Page 60 - La salle du trone';
  throne.actId = actId;
  throne.parentSceneId = gate.id;
  throne.visualEffect = 'stars';
  throne.introText = 'Le trone est vide. Au-dessus de lui flotte une plume noire, suspendue comme une question.';
  throne.hotspots = [{
    ...makeHotspot(),
    name: 'Choisir la derniere page',
    x: 50,
    y: 44,
    width: 28,
    height: 18,
    actionType: 'conversation',
    conversation: {
      startNodeId: 'throne',
      nodes: [{
        id: 'throne',
        speaker: 'La plume noire',
        text: 'Tu peux t asseoir, repartir, ou reecrire la premiere ligne.',
        replies: [
          {
            id: 'throne_good',
            label: 'T asseoir sans couronne.',
            actionType: 'ending',
            endingType: 'good',
            endingTitle: 'Fin 1 - Le gardien des pages',
            endingSummary: 'Tu refuses la couronne et deviens le gardien des choix des prochains lecteurs.',
            conditionType: 'advanced',
            advancedConditionMode: 'all',
            advancedConditions: [
              { id: 'throne_good_bookmark', type: 'has_item', itemId: silverBookmark.id },
              { id: 'throne_good_lucidite', type: 'story_variable', variableKey: 'lucidite', operator: 'greater_or_equal', value: '1' },
            ],
            showWhenLocked: true,
            lockedLabel: 'Il faut avoir compris au moins un indice avant de conclure.',
          },
          {
            id: 'throne_neutral',
            label: 'Quitter la citadelle vivant.',
            actionType: 'ending',
            endingType: 'neutral',
            endingTitle: 'Fin 2 - La route du retour',
            endingSummary: 'Tu repars avec ton histoire intacte, mais la citadelle garde encore plusieurs pages fermees.',
          },
          {
            id: 'throne_bad',
            label: 'Prendre la couronne.',
            actionType: 'ending',
            endingType: 'bad',
            endingTitle: 'Fin 4 - La couronne de brume',
            endingSummary: 'La couronne est legere, beaucoup trop legere: elle efface ton nom du livre.',
          },
        ],
      }],
    },
  }];

  project.scenes = scenes.filter(Boolean);
  project.routeMap = {
    rows: 16,
    cols: 24,
    cells: [],
    rooms: [
      { id: 'book_room_road', name: 'Page 1', sceneId: road.id, x: 12, y: 50, type: 'start' },
      { id: 'book_room_gate', name: 'Page 12', sceneId: gate.id, x: 38, y: 32, type: 'room' },
      { id: 'book_room_market', name: 'Page 27', sceneId: market.id, x: 38, y: 68, type: 'room' },
      { id: 'book_room_catacombs', name: 'Page 44', sceneId: catacombs.id, x: 66, y: 70, type: 'room' },
      { id: 'book_room_throne', name: 'Page 60', sceneId: throne.id, x: 88, y: 44, type: 'end' },
    ],
    connections: [
      { id: 'book_connection_gate', fromRoomId: 'book_room_road', toRoomId: 'book_room_gate', label: 'Porte noire', locked: false, allowOneWay: false },
      { id: 'book_connection_market', fromRoomId: 'book_room_road', toRoomId: 'book_room_market', label: 'Marche', locked: false, allowOneWay: false },
      { id: 'book_connection_catacombs', fromRoomId: 'book_room_market', toRoomId: 'book_room_catacombs', label: 'Catacombes', locked: false, allowOneWay: false },
      { id: 'book_connection_throne_gate', fromRoomId: 'book_room_gate', toRoomId: 'book_room_throne', label: 'Serment', locked: true, allowOneWay: true },
      { id: 'book_connection_throne_catacombs', fromRoomId: 'book_room_catacombs', toRoomId: 'book_room_throne', label: 'Passage bas', locked: false, allowOneWay: true },
    ],
    actMaps: {},
    notes: 'Template livre dont vous etes le heros: chaque scene correspond a une page, les reponses indiquent la page suivante, et les fins multiples recompensent les objets/variables.',
  };
  project.start = { type: 'scene', targetSceneId: road.id, targetCinematicId: '' };
  return normalizeProject(project);
};

const SCENE_THEMES = {
  manor: ['Hall du manoir', 'Bibliothèque interdite', 'Chambre verrouillée'],
  investigation: ['Bureau dé l’inspecteur', 'Scène de crime', 'Archives du commissariat'],
  laboratory: ['Sas d’entrée', 'Salle dés expériences', 'Réacteur instable'],
  museum: ['Galerie principale', 'Réserve secrète', 'Salle dés artefacts'],
};

const SCENE_INTROS = {
  manor: [
    'La porte du manoir grince derrière toi. Quelque chose t’observé.',
    'Des livres anciens cachent peut-être le premier indice.',
    'La chambre semble intacte, mais la serrure raconte autre chose.',
  ],
  investigation: [
    'Un dossier urgent t’attend sur le bureau.',
    'Chaque détail de la pièce peut devenir une preuve.',
    'Les archives contiennent des noms que personne ne veut revoir.',
  ],
  laboratory: [
    'Les néons clignotent. Le protocole d’urgence est actif.',
    'Des instruments bourdonnént autour d’une expérience inachevée.',
    'Le réacteur pulse lentement, comme un compte à rebours.',
  ],
  museum: [
    'Le musée est fermé, mais une vitrine vient de s’ouvrir.',
    'La réserve conserve les pièces que le public ne doit jamais voir.',
    'Un artefact manque. Sa place vide semble prèsque lumineuse.',
  ],
};

const NARRATIVE_TEMPLATE_CONFIGS = {
  narrative_investigation: {
    actName: 'Dossier I',
    scenes: ['Bureau dé la detective', 'Appartement du temoin', 'Quai de nuit'],
    intros: ['Une disparition, trois versions, et un dossier qui refuse de se fermer.', 'Le temoin cache une partie de la verite.', 'Le quai attend ta conclusion.'],
    npc: 'Temoin',
    opening: 'Je peux parler, mais je ne veux pas être accuse. Que veux-tu savoir ?',
    itemName: 'Photo froissee',
    itemIcon: '[]',
    variableKey: 'confiance_temoin',
    enigmaName: 'Contradiction du dossier',
    enigmaQuestion: 'Quelle preuve contredit l alibi ?',
    choices: ['La photo froissee', 'La montre cassee', 'Le ticket de train'],
    solution: 'La photo froissee',
    goodTitle: 'Affaire résolue',
    badTitle: 'Fausse piste',
    secretTitle: 'Le temoin protegeait quelqu un',
  },
  magic_forest: {
    actName: 'Clairiere I',
    scenes: ['Lisiere enchantee', 'Arbre oracle', 'Source des lucioles'],
    intros: ['La forêt change de chemin quand on ment.', 'L arbre oracle ecoute les intentions.', 'La source revele une sortie differente selon les promesses faites.'],
    npc: 'Oracle',
    opening: 'Chaque sentier à un prix. Quelle verite apportes-tu ?',
    itemName: 'Graine d argent',
    itemIcon: '*',
    variableKey: 'respect_foret',
    enigmaName: 'Serment des racines',
    enigmaQuestion: 'Quel mot ouvre le passage des lucioles ?',
    choices: ['Merci', 'Pouvoir', 'Silence'],
    solution: 'Merci',
    goodTitle: 'La forêt te laisse passer',
    badTitle: 'Les ronces se referment',
    secretTitle: 'La clairiere cachée',
  },
  survival_choices: {
    actName: 'Jour 1',
    scenes: ['Epave sur la plage', 'Forêt humide', 'Falaise du signal'],
    intros: ['Tu te reveilles pres d’une epave. L eau monte.', 'La forêt donne de quoi survivre, mais chaque detour coute du temps.', 'Depuis la falaise, un signal peut sauver quelqu un ou te trahir.'],
    npc: 'Survivante',
    opening: 'On ne tiendra pas longtemps. On cherche de l eau, un abri ou un signal ?',
    itemName: 'Gourde intacte',
    itemIcon: '[]',
    variableKey: 'energie',
    enigmaName: 'Signal de detresse',
    enigmaQuestion: 'Quel signal international demande de l aide ?',
    choices: ['SOS', 'NORD', 'FEU'],
    solution: 'SOS',
    goodTitle: 'Sauvetage à l’aube',
    badTitle: 'Nuit sans abri',
    secretTitle: 'Le refuge de la falaise',
  },
  npc_dialogue: {
    actName: 'Rencontre I',
    scenes: ['Taverne calme', 'Arriere-salle', 'Porte de la cite'],
    intros: ['Tout commence par une conversation.', 'L arriere-salle garde les secrets du PNJ.', 'La porte juge ce que tu as appris.'],
    npc: 'Archiviste',
    opening: 'Je sais ou est la clé, mais je ne parlé pas aux inconnus presses.',
    itemName: 'Sceau dé confiance',
    itemIcon: '[]',
    variableKey: 'confiance_archiviste',
    enigmaName: 'Question de memoire',
    enigmaQuestion: 'Quel detail l archiviste a-t-il mentionne ?',
    choices: ['La clé', 'La pluie', 'La cloche'],
    solution: 'La clé',
    goodTitle: 'Alliance conclue',
    badTitle: 'Conversation rompue',
    secretTitle: 'Confidence de l archiviste',
  },
  negotiation: {
    actName: 'Table I',
    scenes: ['Salle du conseil', 'Couloir des apartes', 'Balcon du pacte'],
    intros: ['Deux camps attendent une decision.', 'Les vrais accords se font loin des regards.', 'Le pacte final depend de ta credibilite.'],
    npc: 'Ambassadrice',
    opening: 'Tu veux un accord ? Alors dis-moi qui doit ceder en premier.',
    itemName: 'Lettre de garantie',
    itemIcon: '[]',
    variableKey: 'credit_diplomatique',
    enigmaName: 'Clause cachée',
    enigmaQuestion: 'Quelle clause évite la trahison ?',
    choices: ['Temoin neutre', 'Promesse orale', 'Retard volontaire'],
    solution: 'Temoin neutre',
    goodTitle: 'Traite signe',
    badTitle: 'Rupture des pourparlers',
    secretTitle: 'Alliance discrete',
  },
  narrative_maze: {
    actName: 'Boucle I',
    scenes: ['Entree du labyrinthe', 'Salle dés echos', 'Centre mouvant'],
    intros: ['Le labyrinthe ne se traverse pas: il se raconte dans le bon ordre.', 'Les echos repetent tes anciens choix.', 'Le centre attend’une version coherente de ton histoire.'],
    npc: 'Echo',
    opening: 'Tu es déjà venu ici, même si tu ne t en souviens pas. Quelle trace suis-tu ?',
    itemName: 'Fil rouge',
    itemIcon: '~',
    variableKey: 'memoire_labyrinthe',
    enigmaName: 'Ordre des echos',
    enigmaQuestion: 'Quel mot revient a chaque boucle ?',
    choices: ['Retour', 'Victoire', 'Oubli'],
    solution: 'Retour',
    goodTitle: 'Sortie trouvee',
    badTitle: 'Boucle infinie',
    secretTitle: 'Centre revele',
  },
};

const applyNarrativeTemplate = (project, templateId) => {
  const config = NARRATIVE_TEMPLATE_CONFIGS[templateId];
  if (!config) return null;
  const scenes = project.scenes.slice(0, 3);
  const [startScene, branchScene, endScene] = scenes;
  const actId = project.acts[0]?.id || '';
  const item = makeItem(config.itemName, config.itemIcon);
  const enigma = makeEnigma({
    name: config.enigmaName,
    type: 'misc',
    miscMode: 'multiple-choice',
    question: config.enigmaQuestion,
    miscChoices: config.choices,
    solutionText: config.solution,
    successMessage: 'Le bon choix débloqué une nouvelle issue.',
    failMessage: 'Cette piste affaiblit ta position.',
    unlockType: 'none',
  });

  project.acts = [{ ...project.acts[0], name: config.actName }];
  project.items = [item];
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
    startScene.hotspots = [{
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
              { id: 'reply_direct', label: 'Je force une réponse immédiate.', actionType: 'ending', endingType: 'bad', endingTitle: config.badTitle, endingSummary: "Tu obtiens une réponse trop vite, mais tu perds la branche importante de l'histoire.", dialogue: 'La tension monte et la discussion se ferme.' },
              { id: 'reply_item', label: 'Je cherche un indice utile.', actionType: 'multiple', rewardItemId: item.id, nextNodeId: 'after_item', dialogue: `${config.npc} te remet: ${config.itemName}.` },
            ],
          },
          {
            id: 'trust',
            speaker: config.npc,
            text: 'Tu ecoutes vraiment. Je peux te montrer une voie moins evidente.',
            replies: [
              { id: 'reply_branch', label: 'Je suis cette piste.', actionType: 'scene', targetSceneId: branchScene?.id || '', dialogue: 'Tu prends la branche narrative secondaire.' },
              { id: 'reply_secret', label: 'Je connais déjà la pièce cachée.', branchTags: ['secret'], actionType: 'ending', conditionType: 'has_item', conditionItemId: item.id, endingType: 'secret', endingTitle: config.secretTitle, endingSummary: 'L indice change le sens de la scène. Tu atteins une conclusion alternative.', dialogue: 'Le detail cache fait basculer la conversation.' },
              { id: 'reply_good', label: 'Je conclus avec ce que j ai appris.', branchTags: ['voie_principale'], actionType: 'ending', conditionType: 'advanced', advancedConditionMode: 'all', advancedConditions: [{ id: 'condition_good_item', type: 'has_item', itemId: item.id }, { id: 'condition_good_variable', type: 'story_variable', variableKey: config.variableKey, operator: 'greater_or_equal', value: '1' }], endingType: 'good', endingTitle: config.goodTitle, endingSummary: 'Tes choix ont construit assez de confiance pour obtenir une issue favorable.', dialogue: 'La derniere decision devient claire.' },
            ],
          },
          {
            id: 'after_item',
            speaker: config.npc,
            text: 'Cet objet ne sert que si tu comprends son contexte.',
            replies: [
              { id: 'reply_enigma', label: "Je veux vérifier l'indice.", actionType: 'enigma', enigmaId: enigma.id, dialogue: "L'indice demande une interprétation précise." },
              { id: 'reply_neutral', label: 'Je m arrete avec cet indice.', actionType: 'ending', endingType: 'neutral', endingTitle: 'Fin neutre', endingSummary: 'Tu conserves une partie de la verite, mais l histoire garde ses zones d ombre.', dialogue: 'Tu choisis de ne pas pousser plus loin.' },
            ],
          },
        ],
      },
    }];
  }

  if (branchScene) {
    branchScene.name = config.scenes[1];
    branchScene.actId = actId;
    branchScene.parentSceneId = startScene?.id || '';
    branchScene.introText = config.intros[1];
    branchScene.hotspots = [
      { ...makeHotspot(), name: config.enigmaName, x: 48, y: 46, width: 22, height: 18, actionType: 'dialogue', dialogue: 'Cette étape valide ce que le dialogue a prepare.', enigmaId: enigma.id },
      { ...makeHotspot(), name: 'Continuer', x: 78, y: 70, width: 16, height: 12, actionType: 'scene', dialogue: 'Tu avances vers la conclusion.', targetSceneId: endScene?.id || '' },
    ];
  }

  if (endScene) {
    endScene.name = config.scenes[2];
    endScene.actId = actId;
    endScene.parentSceneId = branchScene?.id || startScene?.id || '';
    endScene.introText = config.intros[2];
    endScene.hotspots = [{ ...makeHotspot(), name: 'Résumé final', x: 48, y: 48, width: 24, height: 18, actionType: 'conversation', conversation: { startNodeId: 'final', nodes: [{ id: 'final', speaker: config.npc, text: 'Il reste à choisir comment cette histoire se termine.', replies: [{ id: 'final_good', label: 'Assumer la meilleure issue.', actionType: 'ending', endingType: 'good', endingTitle: config.goodTitle, endingSummary: 'Tu as suivi les indices et garde la maîtrise de la conclusion.' }, { id: 'final_secret', label: 'Révéler la voie cachée.', actionType: 'ending', conditionType: 'has_item', conditionItemId: item.id, endingType: 'secret', endingTitle: config.secretTitle, endingSummary: 'L’objet obtenu plus tôt révèle une fin alternative.' }] }] } }];
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
      { id: `${templateId}_connection_end`, fromRoomId: `${templateId}_room_branch`, toRoomId: `${templateId}_room_end`, label: 'Conclusion', locked: false, allowOneWay: false },
    ],
    actMaps: {},
    notes: `Template narratif: ${TEMPLATE_TITLES[templateId]}. Utilise les réponses cachées, variables d'histoire et fins multiples pour prolonger cette base.`,
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
    project.items = [guideToken];
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
      notes: 'Mode aventure: construis le recit avec des scènes reliées par des choix. Utilise les énigmes Divers / choix multiples pour verrouilléer certaines branches.',
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

  const sceneThemes = SCENE_THEMES[templateId];
  if (sceneThemes) {
    project.scenes = project.scenes.slice(0, 3).map((scene, index) => ({
      ...scene,
      name: sceneThemes[index] || scene.name,
      parentSceneId: index === 1 ? project.scenes[0]?.id || '' : '',
      introText: SCENE_INTROS[templateId][index],
    }));
    project.start = { type: 'scene', targetSceneId: project.scenes[0]?.id || '', targetCinematicId: '' };
  }

  return normalizeProject(project);
}
