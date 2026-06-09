import { makeEnigma, makeHotspot, makeItem, makeScene, normalizeProject } from '../data/projectData';
import { applyTemplateBackgrounds, withTemplateItemImages } from './templateBackgrounds';

export const applyBookHeroTemplate = (project, name) => {
  const actId = project.acts[0]?.id || '';
  const scenes = project.scenes.slice(0, 3);
  while (scenes.length < 5) {
    scenes.push(makeScene({ actId, hotspots: [] }));
  }

  const [road, gate, market, catacombs, throne] = scenes;
  const silverBookmark = makeItem('Marque-page d argent', '🔖');
  const lantern = makeItem('Lanterne sourde', '🏮');
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
  project.items = withTemplateItemImages([silverBookmark, lantern], 'book_hero');
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

  project.scenes = applyTemplateBackgrounds(scenes.filter(Boolean), 'book_hero');
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
