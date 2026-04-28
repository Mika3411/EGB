const uid = () => Math.random().toString(36).slice(2, 10);
const VISUAL_EFFECT_VALUES = ['sparkles', 'stars', 'snow', 'blizzard', 'fog', 'smoke', 'hearts', 'glow', 'fireflies', 'rain', 'storm', 'magic', 'embers', 'flames', 'bubbles', 'aurora', 'vignette', 'scanlines', 'glitch', 'confetti', 'beauty-lens', 'dream-lens', 'neon-lens', 'night-vision', 'thermal', 'comic-lens', 'noir-lens'];
const VISUAL_EFFECT_INTENSITY_VALUES = ['subtle', 'normal', 'strong'];
const SCENE_TRANSITION_VALUES = ['none', 'fade', 'blur', 'dissolve', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'zoom', 'zoom-spin', 'iris', 'flip', 'rotate', 'curtain', 'split-horizontal', 'split-vertical', 'cinematic-bars', 'glitch', 'pixel', 'burn', 'flash'];
const SCENE_TIMER_ACTION_VALUES = ['none', 'scene', 'restart-scene', 'restart-preview', 'damage-life', 'dialogue', 'cinematic'];

const makeItem = (name = 'Nouvel objet', icon = '📦') => ({ id: uid(), name, icon, imageData: '', imageName: '' });
const makeCombination = () => ({
  id: uid(),
  itemAId: '',
  itemBId: '',
  resultItemId: '',
  message: 'Les objets se combinent.',
});
const makeLogicRule = () => ({
  id: uid(),
  name: 'Nouvelle règle',
  conditionType: 'has_item',
  itemId: '',
  hotspotId: '',
  conditionEnigmaId: '',
  cinematicId: '',
  combinationId: '',
  actionType: 'dialogue',
  dialogue: 'La zone réagit autrement.',
  consumeRequiredItemOnUse: false,
  disableAfterUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  enigmaId: '',
});
const makeHotspot = () => ({
  id: uid(),
  name: 'Nouvelle zone',
  x: 50,
  y: 50,
  width: 14,
  height: 12,
  actionType: 'dialogue',
  dialogue: 'Quelque chose attire ton attention.',
  requiredItemId: '',
  consumeRequiredItemOnUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  enigmaId: '',
  requiredHotspotId: '',
  lockedMessage: '',
  objectImageData: '',
  objectImageName: '',
  hasSecondAction: false,
  secondActionType: 'dialogue',
  secondDialogue: 'Il n’y a plus rien ici.',
  secondRequiredItemId: '',
  secondConsumeRequiredItemOnUse: false,
  secondRewardItemId: '',
  secondTargetSceneId: '',
  secondTargetCinematicId: '',
  secondEnigmaId: '',
  secondObjectImageData: '',
  secondObjectImageName: '',
  logicRules: [],
});
const makeAct = (name = 'Acte I') => ({ id: uid(), name });
const makeEnigma = (overrides = {}) => ({
  id: uid(),
  name: 'Nouvelle énigme',
  type: 'code',
  question: 'Entre le bon code pour continuer.',
  solutionText: '1234',
  solutionColors: ['red', 'blue', 'green'],
  miscMode: 'free-answer',
  miscChoices: ['Réponse A', 'Réponse B', 'Réponse C'],
  miscCorrectChoices: [],
  miscPairs: [
    { left: 'Symbole', right: 'Signification' },
    { left: 'Clé', right: 'Serrure' },
  ],
  miscMin: '',
  miscMax: '',
  miscTargetItemId: '',
  successMessage: 'Bonne réponse. Quelque chose se débloque.',
  failMessage: 'Ce n’est pas la bonne réponse.',
  unlockType: 'none',
  targetSceneId: '',
  targetCinematicId: '',
  imageData: '',
  imageName: '',
  popupBackgroundData: '',
  popupBackgroundName: '',
  popupBackgroundZoom: 1,
  popupBackgroundX: 50,
  popupBackgroundY: 50,
  popupBackgroundOverlay: 'dark',
  gridRows: 3,
  gridCols: 3,
  ...overrides,
});
const makeScene = (overrides = {}) => ({
  id: uid(),
  name: 'Nouvelle scène',
  actId: '',
  parentSceneId: '',
  backgroundData: '',
  backgroundName: '',
  visualEffect: 'none',
  visualEffectIntensity: 'normal',
  sceneTransition: 'none',
  sceneTransitionDuration: 700,
  timerEnabled: false,
  timerSeconds: 60,
  timerEndAction: 'none',
  timerTargetSceneId: '',
  timerTargetCinematicId: '',
  timerLifeLoss: 1,
  timerEndMessage: 'Le temps est ecoule.',
  visualEffectZones: [],
  introText: 'Décris l’ambiance de cette scène.',
  hotspots: [makeHotspot()],
  ...overrides,
});
const makeCinematicSlide = () => ({
  id: uid(),
  imageData: '',
  imageName: '',
  narration: 'Une nouvelle image apparaît…',
  audioData: '',
  audioName: '',
});
const makeCinematic = () => ({
  id: uid(),
  name: 'Nouvelle cinématique',
  cinematicType: 'slides',
  slides: [makeCinematicSlide()],
  videoData: '',
  videoName: '',
  videoAutoplay: true,
  videoControls: true,
  onEndType: 'none',
  targetActId: '',
  targetSceneId: '',
  rewardItemId: '',
});

const makeRouteMap = () => ({
  rows: 16,
  cols: 24,
  cells: [],
  rooms: [],
  connections: [],
  notes: '',
});

const normalizeRouteMapCell = (cell, rows, cols) => {
  const type = ['path', 'wall', 'start', 'end', 'checkpoint'].includes(cell?.type) ? cell.type : 'path';
  return {
    id: cell?.id || uid(),
    x: Number.isFinite(Number(cell?.x)) ? Math.max(0, Math.min(cols - 1, Number(cell.x))) : 0,
    y: Number.isFinite(Number(cell?.y)) ? Math.max(0, Math.min(rows - 1, Number(cell.y))) : 0,
    type,
    label: cell?.label || '',
    sceneId: cell?.sceneId || '',
  };
};

const normalizeProject = (rawProject) => {
  const draft = structuredClone(rawProject || {});
  if (!Array.isArray(draft.items)) draft.items = [];
  if (!Array.isArray(draft.combinations)) draft.combinations = [];
  if (!Array.isArray(draft.scenes)) draft.scenes = [];
  if (!Array.isArray(draft.cinematics)) draft.cinematics = [];
  if (!Array.isArray(draft.enigmas)) draft.enigmas = [];
  if (!Array.isArray(draft.acts) || !draft.acts.length) {
    draft.acts = [makeAct('Acte I')];
  }
  const fallbackActId = draft.acts[0]?.id || '';
  if (!draft.start || typeof draft.start !== 'object') draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
  draft.start = {
    type: draft.start.type === 'cinematic' ? 'cinematic' : 'scene',
    targetSceneId: draft.start.targetSceneId || '',
    targetCinematicId: draft.start.targetCinematicId || '',
  };
  const rawRouteMap = draft.routeMap && typeof draft.routeMap === 'object' ? draft.routeMap : makeRouteMap();
  const routeRows = Number.isFinite(Number(rawRouteMap.rows)) ? Math.max(8, Math.min(32, Number(rawRouteMap.rows))) : 16;
  const routeCols = Number.isFinite(Number(rawRouteMap.cols)) ? Math.max(8, Math.min(40, Number(rawRouteMap.cols))) : 24;
  const seenRouteCells = new Set();
  draft.routeMap = {
    rows: routeRows,
    cols: routeCols,
    notes: rawRouteMap.notes || '',
    cells: (Array.isArray(rawRouteMap.cells) ? rawRouteMap.cells : [])
      .map((cell) => normalizeRouteMapCell(cell, routeRows, routeCols))
      .filter((cell) => {
        const key = `${cell.x}:${cell.y}`;
        if (seenRouteCells.has(key)) return false;
        seenRouteCells.add(key);
        return true;
      }),
    rooms: (Array.isArray(rawRouteMap.rooms) ? rawRouteMap.rooms : []).map((room, index) => ({
      id: room?.id || uid(),
      name: room?.name || `Pièce ${index + 1}`,
      sceneId: room?.sceneId || '',
      x: Number.isFinite(Number(room?.x)) ? Math.max(4, Math.min(96, Number(room.x))) : Math.min(84, 16 + index * 10),
      y: Number.isFinite(Number(room?.y)) ? Math.max(6, Math.min(94, Number(room.y))) : Math.min(82, 18 + index * 8),
      type: ['start', 'end', 'room'].includes(room?.type) ? room.type : 'room',
    })),
    connections: (Array.isArray(rawRouteMap.connections) ? rawRouteMap.connections : []).map((connection) => ({
      id: connection?.id || uid(),
      fromRoomId: connection?.fromRoomId || '',
      toRoomId: connection?.toRoomId || '',
      label: connection?.label || '',
      locked: Boolean(connection?.locked),
      allowOneWay: Boolean(connection?.allowOneWay),
    })),
  };
  draft.scenes = draft.scenes.map((scene) => ({
    ...makeScene({ hotspots: [] }),
    ...scene,
    actId: scene.actId || fallbackActId,
    parentSceneId: scene.parentSceneId || '',
    visualEffect: ['none', ...VISUAL_EFFECT_VALUES].includes(scene.visualEffect) ? scene.visualEffect : 'none',
    visualEffectIntensity: VISUAL_EFFECT_INTENSITY_VALUES.includes(scene.visualEffectIntensity) ? scene.visualEffectIntensity : 'normal',
    sceneTransition: SCENE_TRANSITION_VALUES.includes(scene.sceneTransition) ? scene.sceneTransition : 'none',
    sceneTransitionDuration: Number.isFinite(Number(scene.sceneTransitionDuration)) ?
       Math.max(250, Math.min(2000, Number(scene.sceneTransitionDuration)))
      : 700,
    timerEnabled: Boolean(scene.timerEnabled),
    timerSeconds: Number.isFinite(Number(scene.timerSeconds)) ?
       Math.max(5, Math.min(3600, Math.round(Number(scene.timerSeconds))))
      : 60,
    timerEndAction: SCENE_TIMER_ACTION_VALUES.includes(scene.timerEndAction) ? scene.timerEndAction : 'none',
    timerTargetSceneId: scene.timerTargetSceneId || '',
    timerTargetCinematicId: scene.timerTargetCinematicId || '',
    timerLifeLoss: Number.isFinite(Number(scene.timerLifeLoss)) ?
       Math.max(1, Math.min(9, Math.round(Number(scene.timerLifeLoss))))
      : 1,
    timerEndMessage: scene.timerEndMessage || 'Le temps est ecoule.',
    visualEffectZones: Array.isArray(scene.visualEffectZones) ?
       scene.visualEffectZones.map((zone) => ({
        id: zone.id || uid(),
        name: zone.name || 'Zone visuelle',
        effect: VISUAL_EFFECT_VALUES.includes(zone.effect) ? zone.effect : 'sparkles',
        intensity: VISUAL_EFFECT_INTENSITY_VALUES.includes(zone.intensity) ? zone.intensity : 'normal',
        x: Number.isFinite(Number(zone.x)) ? Number(zone.x) : 50,
        y: Number.isFinite(Number(zone.y)) ? Number(zone.y) : 50,
        width: Number.isFinite(Number(zone.width)) ? Number(zone.width) : 24,
        height: Number.isFinite(Number(zone.height)) ? Number(zone.height) : 18,
        layer: ['behind', 'between', 'front'].includes(zone.layer) ? zone.layer : 'behind',
        isHidden: Boolean(zone.isHidden),
      }))
      : [],
    hotspots: Array.isArray(scene.hotspots) && scene.hotspots.length ?
       scene.hotspots.map((spot) => ({
        ...makeHotspot(),
        ...spot,
        logicRules: Array.isArray(spot.logicRules) ?
           spot.logicRules.map((rule) => ({ ...makeLogicRule(), ...rule }))
          : [],
      }))
      : [makeHotspot()],
  }));
  draft.cinematics = draft.cinematics.map((cinematic) => ({
    ...makeCinematic(),
    ...cinematic,
    cinematicType: cinematic.cinematicType === 'video' ? 'video' : 'slides',
    slides: Array.isArray(cinematic.slides) && cinematic.slides.length ?
       cinematic.slides.map((slide) => ({ ...makeCinematicSlide(), ...slide }))
      : [makeCinematicSlide()],
    videoData: cinematic.videoData || '',
    videoName: cinematic.videoName || '',
    videoAutoplay: cinematic.videoAutoplay !== false,
    videoControls: cinematic.videoControls !== false,
    onEndType: ['none', 'act', 'scene', 'item'].includes(cinematic.onEndType) ? cinematic.onEndType : 'none',
    targetActId: cinematic.targetActId || '',
    targetSceneId: cinematic.targetSceneId || '',
    rewardItemId: cinematic.rewardItemId || '',
  }));
  draft.enigmas = draft.enigmas.map((enigma) => ({
    ...makeEnigma(),
    ...enigma,
    solutionColors: Array.isArray(enigma.solutionColors) ? enigma.solutionColors : ['red', 'blue', 'green'],
    miscMode: ['free-answer', 'multiple-choice', 'true-false', 'ordering', 'matching', 'fill-blank', 'numeric-range', 'multi-select', 'accepted-answers', 'item-select', 'exact-number'].includes(enigma.miscMode) ? enigma.miscMode : 'free-answer',
    miscChoices: Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : ['Réponse A', 'Réponse B', 'Réponse C'],
    miscCorrectChoices: Array.isArray(enigma.miscCorrectChoices) ? enigma.miscCorrectChoices : [],
    miscPairs: Array.isArray(enigma.miscPairs) && enigma.miscPairs.length ? enigma.miscPairs : [
      { left: 'Symbole', right: 'Signification' },
      { left: 'Clé', right: 'Serrure' },
    ],
    miscMin: enigma.miscMin ?? '',
    miscMax: enigma.miscMax ?? '',
    miscTargetItemId: enigma.miscTargetItemId || '',
    popupBackgroundData: enigma.popupBackgroundData || '',
    popupBackgroundName: enigma.popupBackgroundName || '',
    popupBackgroundZoom: Number(enigma.popupBackgroundZoom) || 1,
    popupBackgroundX: Number.isFinite(Number(enigma.popupBackgroundX)) ? Math.max(0, Math.min(100, Number(enigma.popupBackgroundX))) : 50,
    popupBackgroundY: Number.isFinite(Number(enigma.popupBackgroundY)) ? Math.max(0, Math.min(100, Number(enigma.popupBackgroundY))) : 50,
    popupBackgroundOverlay: ['light', 'medium', 'dark'].includes(enigma.popupBackgroundOverlay) ? enigma.popupBackgroundOverlay : 'dark',
    gridRows: Number.isFinite(Number(enigma.gridRows)) ? Math.max(2, Math.min(6, Number(enigma.gridRows))) : 3,
    gridCols: Number.isFinite(Number(enigma.gridCols)) ? Math.max(2, Math.min(6, Number(enigma.gridCols))) : 3,
  }));
  return draft;
};

const createInitialProject = () => {
  const act1 = makeAct('Acte I');
  const act2 = makeAct('Acte II');
  const key = makeItem('Petite clé', '🔑');
  const note = makeItem('Lettre brûlée', '📜');
  const rag = makeItem('Chiffon', '🧻');
  const fuel = makeItem('Essence', '⛽');
  const soakedRag = makeItem('Chiffon imbibé', '🧴');
  const stick = makeItem('Bâton', '🪵');
  const torch = makeItem('Torche', '🕯️');
  const lighter = makeItem('Briquet', '🔥');
  const litTorch = makeItem('Torche enflammée', '🔥');

  const sceneA = makeScene({ actId: act1.id });
  sceneA.name = 'Salon';
  sceneA.introText = 'Tu entres dans le salon. Explore la pièce.';

  const sceneB = makeScene({ actId: act1.id, parentSceneId: sceneA.id });
  sceneB.name = 'Tiroir';
  sceneB.introText = 'Le tiroir révèle un nouveau secret.';

  const sceneC = makeScene({ actId: act2.id });
  sceneC.name = 'Couloir';
  sceneC.introText = 'Acte II : le couloir s’ouvre devant toi.';

  const drawerCode = makeEnigma({
    name: 'Code du tiroir',
    type: 'code',
    question: 'Entre le code du tiroir.',
    solutionText: '1947',
    successMessage: 'Le mécanisme clique. Le tiroir s’ouvre.',
    failMessage: 'Le code est incorrect.',
    unlockType: 'scene',
    targetSceneId: sceneB.id,
  });

  const hallwayColors = makeEnigma({
    name: 'Suite de couleurs du couloir',
    type: 'colors',
    question: 'Reproduis la séquence de couleurs.',
    solutionColors: ['red', 'blue', 'green'],
    successMessage: 'Les voyants passent au vert.',
    failMessage: 'Les couleurs ne correspondent pas.',
    unlockType: 'cinematic',
  });

  sceneA.hotspots = [
    {
      ...makeHotspot(),
      name: 'Coussin',
      x: 25,
      y: 70,
      actionType: 'dialogue_item',
      dialogue: 'Sous le coussin, tu trouves une petite clé.',
      rewardItemId: key.id,
    },
    {
      ...makeHotspot(),
      name: 'Lettre',
      x: 63,
      y: 55,
      actionType: 'dialogue_item',
      dialogue: 'Une lettre brûlée dit : « Pars avant qu’ils arrivent. »',
      rewardItemId: note.id,
    },
    {
      ...makeHotspot(),
      name: 'Tiroir',
      x: 80,
      y: 60,
      width: 10,
      height: 8,
      actionType: 'scene',
      dialogue: 'Tu utilises la clé et le tiroir s’ouvre.',
      requiredItemId: key.id,
      targetSceneId: sceneB.id,
      enigmaId: drawerCode.id,
    },
    {
      ...makeHotspot(),
      name: 'Panneau lumineux',
      x: 56,
      y: 30,
      width: 14,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'Un panneau coloré bloque un mécanisme.',
      enigmaId: hallwayColors.id,
    },
  ];

  const cinematic = makeCinematic();
  cinematic.name = 'Introduction';
  hallwayColors.targetCinematicId = cinematic.id;
  cinematic.slides[0].narration = 'Le silence pèse sur la pièce. Quelqu’un est parti en vitesse.';
  cinematic.onEndType = 'scene';
  cinematic.targetSceneId = sceneA.id;

  return normalizeProject({
    title: 'Escape Game Builder',
    acts: [act1, act2],
    items: [key, note, rag, fuel, soakedRag, stick, torch, lighter, litTorch],
    combinations: [
      { id: uid(), itemAId: rag.id, itemBId: fuel.id, resultItemId: soakedRag.id, message: "Le chiffon est imbibé d'essence." },
      { id: uid(), itemAId: soakedRag.id, itemBId: stick.id, resultItemId: torch.id, message: 'Tu fabriques une torche.' },
      { id: uid(), itemAId: torch.id, itemBId: lighter.id, resultItemId: litTorch.id, message: "La torche s'enflamme." },
    ],
    scenes: [sceneA, sceneB, sceneC],
    cinematics: [cinematic],
    enigmas: [drawerCode, hallwayColors],
    start: {
      type: 'scene',
      targetSceneId: sceneA.id,
      targetCinematicId: '',
    },
  });
};

const initialProject = createInitialProject();

export {
  uid,
  makeItem,
  makeCombination,
  makeHotspot,
  makeLogicRule,
  makeAct,
  makeScene,
  makeCinematicSlide,
  makeCinematic,
  makeEnigma,
  makeRouteMap,
  normalizeProject,
  createInitialProject,
  initialProject,
};
