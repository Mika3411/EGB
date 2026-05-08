import { normalizeCinematicSteps } from '../lib/cinematicEngine';
import { migrateProjectAssetReferences } from '../lib/assetManager';

const uid = () => Math.random().toString(36).slice(2, 10);
const VISUAL_EFFECT_VALUES = ['sparkles', 'stars', 'snow', 'blizzard', 'fog', 'smoke', 'hearts', 'glow', 'firefliés', 'rain', 'storm', 'magic', 'embers', 'flames', 'bubbles', 'aurora', 'vignette', 'scanlines', 'glitch', 'confetti', 'beauty-lens', 'dream-lens', 'neon-lens', 'night-vision', 'thermal', 'comic-lens', 'noir-lens'];
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
  consume: true,
  conditions: [],
  failMessage: '',
});
const makeLogicRule = () => ({
  id: uid(),
  name: 'Nouvelle règle',
  conditionType: 'always',
  itemId: '',
  hotspotId: '',
  conditionEnigmaId: '',
  cinematicId: '',
  combinationId: '',
  actionType: 'dialogue',
  dialogue: 'La zone réagit autrement.',
  failureDialogue: '',
  successSoundData: '',
  successSoundName: '',
  failureSoundData: '',
  failureSoundName: '',
  consumeRequiredItemOnUse: false,
  disableAfterUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  enigmaId: '',
  blockActionType: 'show',
  targetBlockId: '',
  targetBlockText: '',
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
  name: 'Nouvelle enigme',
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
  successMessage: 'Bonne réponse. Quelque chose se débloqué.',
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
  name: 'Nouvelle scene',
  actId: '',
  parentSceneId: '',
  backgroundId: '',
  backgroundData: '',
  backgroundName: '',
  backgroundWidth: 0,
  backgroundHeight: 0,
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
  musicId: '',
  musicData: '',
  musicName: '',
  musicLoop: true,
  ambientSoundId: '',
  ambientSoundData: '',
  ambientSoundName: '',
  ambientSoundLoop: false,
  introText: 'Décris l’ambiance de cette scene.',
  hotspots: [makeHotspot()],
  sceneObjects: [],
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
  name: 'Nouvelle cinematic',
  cinematicType: 'slides',
  slides: [makeCinematicSlide()],
  steps: [
    { id: uid(), type: 'text', content: 'Une nouvelle image apparaît...' },
    { id: uid(), type: 'wait', duration: 4500 },
  ],
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
  actMaps: {},
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

const normalizeRouteMapShape = (rawRouteMap = makeRouteMap()) => {
  const routeRows = Number.isFinite(Number(rawRouteMap.rows)) ? Math.max(8, Math.min(32, Number(rawRouteMap.rows))) : 16;
  const routeCols = Number.isFinite(Number(rawRouteMap.cols)) ? Math.max(8, Math.min(40, Number(rawRouteMap.cols))) : 24;
  const seenRouteCells = new Set();
  return {
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
      name: room?.name || `Piece ${index + 1}`,
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
      condition: connection?.condition || '',
      locked: Boolean(connection?.locked),
      allowOneWay: Boolean(connection?.allowOneWay),
    })),
  };
};

const makeImportedHotspot = ({
  id,
  name,
  x,
  y,
  width,
  height,
  actionType = 'dialogue',
  dialogue = '',
  targetSceneId = '',
  targetCinematicId = '',
  enigmaId = '',
  requiredItemId = '',
  rewardItemId = '',
  lockedMessage = '',
}) => ({
  ...makeHotspot(),
  id,
  name,
  x,
  y,
  width,
  height,
  actionType,
  dialogue,
  targetSceneId,
  targetCinematicId,
  enigmaId,
  requiredItemId,
  rewardItemId,
  lockedMessage,
});

const makeImportedScene = ({ id, name, actId, introText, hotspots, visualEffect = 'none' }) => ({
  ...makeScene({ actId, hotspots }),
  id,
  name,
  actId,
  introText,
  visualEffect,
  sceneTransition: 'fade',
  sceneTransitionDuration: 900,
  ambientSoundLoop: true,
  musicLoop: true,
  sceneObjects: [],
  backgroundAspectRatio: 1.5,
});

const ensureSewerAct2 = (draft) => {
  const hasTutorialCave = draft.scenes?.some((scene) => scene.id === 'xq7f2yy0')
    && draft.cinematics?.some((cinematic) => cinematic.id === 'sgbbc0sn');
  if (!hasTutorialCave || draft.acts?.some((act) => act.id === 'act2_egouts_sous_sols')) return;

  const act2Id = 'act2_egouts_sous_sols';
  const watchId = 'bfh2n8m8';
  const rustKeyId = 'act2_clé_rouillée';
  const mapId = 'act2_plan_egouts';
  const valveId = 'act2_manivelle';
  const redBadgeId = 'act2_badge_rouge';
  const ratCinematicId = 'act2_cine_rat_temps';
  const finalCinematicId = 'act2_cine_porte_rouge';

  draft.acts.push({ id: act2Id, name: 'Acte II - Les egouts figes' });

  [
    makeItem('clé rouillée des egouts', '[]'),
    makeItem('plan humide des sous-sols', '[]'),
    makeItem('manivelle froide', '[]'),
    makeItem('badge de la porte rouge', '[]'),
  ].forEach((item, index) => {
    item.id = [rustKeyId, mapId, valveId, redBadgeId][index];
    if (!draft.items.some((entry) => entry.id === item.id)) draft.items.push(item);
  });

  const act2Entry = draft.cinematics.find((cinematic) => cinematic.id === 'sgbbc0sn');
  if (act2Entry) {
    act2Entry.name = 'Acte II - Sous la maison';
    act2Entry.onEndType = 'act';
    act2Entry.targetActId = act2Id;
    act2Entry.targetSceneId = '';
    if (act2Entry.slides?.[0]) {
      act2Entry.slides[0].narration = "La torche traversé l'endroit sombre de la cave. Le mur du fond n'est pas un mur: c'est une ouverture humide qui descend vers les egouts. Le silence est trop parfait. La montre arrêtée indique toujours 10h09.";
    }
  }

  draft.cinematics.push({
    ...makeCinematic(),
    id: ratCinematicId,
    name: 'Le rat qui reprend sa course',
    slides: [{
      ...makeCinematicSlide(),
      id: `${ratCinematicId}_slide_01`,
      narration: "Elle s'approche d'un rat fige au milieu d'une flaque noire. Pendant une seconde, rien ne bouge. Puis ses moustaches fremissent, ses pattes grattent le beton, et il detale dans un tuyau comme si le temps venait de reprendre son cours autour d'elle.",
    }],
    onEndType: 'scene',
    targetSceneId: 'act2_scene_bouche_egout',
  }, {
    ...makeCinematic(),
    id: finalCinematicId,
    name: 'La porte rouge metallique',
    slides: [{
      ...makeCinematicSlide(),
      id: `${finalCinematicId}_slide_01`,
      narration: "La porte rouge metallique s'ouvre dans un grincement lourd. Derriere, il n'y a ni cave ni maison: seulement un couloir impossible, baigne dans une lumière immobile. Elle franchit le seuil. A 10h09, quelque chose l'attend.",
    }],
    onEndType: 'none',
  });

  draft.enigmas.push({
    ...makeEnigma(),
    id: 'act2_enig_grille_1009',
    name: 'Cadran de la grille',
    question: "Le cadran rouille ne demande pas une date. Il demande l'heure exacte qui refusé d'avancer.",
    solutionText: '1009',
    successMessage: 'Les quatre chiffres s enfoncent. La grille du collecteur se souleve lentement.',
    failMessage: "Le mecanisme reste bloqué. Ce n'est pas un code trouvé ici, c'est l'heure qui poursuit l'histoire.",
    unlockType: 'scene',
    targetSceneId: 'act2_scene_collecteur',
  }, {
    ...makeEnigma(),
    id: 'act2_enig_pression',
    name: 'Pression des vannes',
    question: "Règle la pression avec l'ordre donné par le plan humide: gauche, centre, droite, centre.",
    solutionText: '1323',
    successMessage: 'Les tuyaux cessent de vibrer. La porte technique des sous-sols se deverrouille.',
    failMessage: "La pression remonte brutalement. L'ordre est ailleurs, pas sur ce panneau.",
    unlockType: 'scene',
    targetSceneId: 'act2_scene_sous_sol_technique',
  }, {
    ...makeEnigma(),
    id: 'act2_enig_porte_rouge',
    name: 'Verrou rouge',
    question: "Le verrou rouge exige l'heure morte, mais seulement si le badge est en place.",
    solutionText: '1009',
    successMessage: 'Le verrou reconnait l heure. La porte rouge metallique peut être franchie.',
    failMessage: "Le rouge reste éteint. Sans le badge et l'heure, le passage refuse de s'ouvrir.",
    unlockType: 'cinematic',
    targetCinematicId: finalCinematicId,
  });

  draft.scenes.push(
    makeImportedScene({
      id: 'act2_scene_bouche_egout',
      name: "Bouche d'egout sous la cave",
      actId: act2Id,
      introText: "Là descente s'ouvre sous l'endroit sombre de la cave. L'air sent la pierre mouillee et le metal ancien. La montre reste bloquée a 10h09.",
      visualEffect: 'fog',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_grille', name: 'Grille a cadran', x: 52, y: 46, width: 18, height: 16, dialogue: "Le cadran attend l'heure morte.", enigmaId: 'act2_enig_grille_1009', requiredItemId: watchId, lockedMessage: "Sans la montre arrêtée, ce cadran n'a aucun sens." }),
        makeImportedHotspot({ id: 'act2_h_ratsilence', name: 'Rat fige', x: 33, y: 62, width: 14, height: 10, actionType: 'cinematic', dialogue: 'Le rat ne respire même pas.', targetCinematicId: ratCinematicId }),
        makeImportedHotspot({ id: 'act2_h_cléf', name: 'Crochet rouille', x: 72, y: 70, width: 10, height: 10, actionType: 'dialogue_item', dialogue: "Une clé rouillée pend au crochet, comme si quelqu'un venait juste de la poser.", rewardItemId: rustKeyId }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_collecteur',
      name: 'Collecteur principal',
      actId: act2Id,
      introText: "Un long collecteur traversé les egouts. L'eau ne coule prèsque pas, puis repart par petites secousses quand elle avance.",
      visualEffect: 'rain',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_bouche', name: 'Retour vers la bouche', x: 10, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: "Revenir près de l'ouverture de la cave.", targetSceneId: 'act2_scene_bouche_egout' }),
        makeImportedHotspot({ id: 'act2_h_canal_est', name: 'Canal est', x: 82, y: 55, width: 16, height: 18, actionType: 'scene', dialogue: 'Le canal est descend vers les sous-sols.', targetSceneId: 'act2_scene_canal_est', requiredItemId: rustKeyId, lockedMessage: 'La grille laterale est fermee par une serrure rouillée.' }),
        makeImportedHotspot({ id: 'act2_h_plan', name: 'Plan colle au mur', x: 48, y: 38, width: 16, height: 12, actionType: 'dialogue_item', dialogue: 'Le papier dêtrempe montre un itineraire incomplet: 1-3-2-3.', rewardItemId: mapId }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_canal_est',
      name: 'Canal est des egouts',
      actId: act2Id,
      introText: 'Le canal devient plus bas. Des marques rouges apparaissent sur les tuyaux, mais elles semblent peintes depuis des annees.',
      visualEffect: 'fog',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_collecteur', name: 'Retour collecteur', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Retourner au collecteur.', targetSceneId: 'act2_scene_collecteur' }),
        makeImportedHotspot({ id: 'act2_h_vannes', name: 'Salle des vannes', x: 78, y: 48, width: 15, height: 18, actionType: 'scene', dialogue: 'Une salle de vannes coupe le passage.', targetSceneId: 'act2_scene_vannes', requiredItemId: mapId, lockedMessage: 'Sans plan, elle risque de tourner en rond dans les conduites.' }),
        makeImportedHotspot({ id: 'act2_h_ombre', name: "Ombre dans l'eau", x: 46, y: 65, width: 18, height: 10, dialogue: "L'ombre file a contre-courant. Le rat a ouvert quelque chose plus loin." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_vannes',
      name: 'Salle des vannes',
      actId: act2Id,
      introText: "Quatre volants de metal bloquént la pression. Un tic-tac se fait entendre, mais aucune horloge ne bouge.",
      visualEffect: 'smoke',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_canal_retour', name: 'Retour canal est', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au canal est.', targetSceneId: 'act2_scene_canal_est' }),
        makeImportedHotspot({ id: 'act2_h_manivelle', name: 'Manivelle tombee', x: 38, y: 64, width: 12, height: 10, actionType: 'dialogue_item', dialogue: 'Une manivelle froide roule sous la grille.', rewardItemId: valveId }),
        makeImportedHotspot({ id: 'act2_h_pression', name: 'Panneau de pression', x: 58, y: 42, width: 20, height: 16, dialogue: "Les vannes doivent suivre l'ordre du plan humide.", enigmaId: 'act2_enig_pression', requiredItemId: valveId, lockedMessage: 'Il manque une manivelle pour regler les vannes.' }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_sous_sol_technique',
      name: 'Sous-sol technique',
      actId: act2Id,
      introText: 'Les egouts debouchent sous la maison. Ici, les murs sont en beton, les portes en acier, et chaque lampe tremble a 10h09.',
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_vannes_retour', name: 'Retour salle des vannes', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Retourner vers les vannes.', targetSceneId: 'act2_scene_vannes' }),
        makeImportedHotspot({ id: 'act2_h_local', name: 'Local electrique', x: 46, y: 50, width: 16, height: 18, actionType: 'scene', dialogue: 'Un local electrique bourdonné derriere une porte basse.', targetSceneId: 'act2_scene_local_electrique' }),
        makeImportedHotspot({ id: 'act2_h_couloir_rouge', name: 'Couloir rouge', x: 82, y: 48, width: 14, height: 18, actionType: 'scene', dialogue: "Un couloir peint de traces rouges s'enfonce plus bas.", targetSceneId: 'act2_scene_couloir_rouge' }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_local_electrique',
      name: 'Local electrique',
      actId: act2Id,
      introText: "Les fusibles sont intacts, mais un voyant rouge pulse comme un coeur. Quelqu'un alimente encore la porte finale.",
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_soussol', name: 'Retour sous-sol', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au sous-sol technique.', targetSceneId: 'act2_scene_sous_sol_technique' }),
        makeImportedHotspot({ id: 'act2_h_badge_rouge', name: 'Boitier rouge', x: 54, y: 45, width: 16, height: 16, actionType: 'dialogue_item', dialogue: "Le boitier s'ouvre avec la clé rouillée. A l'interieur: un badge rouge metallique.", requiredItemId: rustKeyId, rewardItemId: redBadgeId, lockedMessage: 'Le boitier est ferme par une serrure rouillée.' }),
        makeImportedHotspot({ id: 'act2_h_note', name: 'Etiquette de maintenance', x: 68, y: 62, width: 14, height: 10, dialogue: "L'etiquette indique: alimentation maintenue tant que l'heure reste 10h09." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_couloir_rouge',
      name: 'Couloir des sous-sols',
      actId: act2Id,
      introText: "Le couloir est etroit. Les traces rouges ne sont pas du sang: c'est de la peinture industrielle, ecaillee par l'humidite.",
      visualEffect: 'vignette',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_soussol2', name: 'Retour sous-sol', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au sous-sol technique.', targetSceneId: 'act2_scene_sous_sol_technique' }),
        makeImportedHotspot({ id: 'act2_h_porte_finale', name: 'Porte rouge metallique', x: 78, y: 38, width: 18, height: 34, actionType: 'scene', dialogue: 'La porte rouge attend au bout du couloir.', targetSceneId: 'act2_scene_porte_rouge', requiredItemId: redBadgeId, lockedMessage: 'Le lecteur de la porte reste noir. Il faut le badge rouge.' }),
        makeImportedHotspot({ id: 'act2_h_rat_trace', name: 'Trace du rat', x: 36, y: 66, width: 14, height: 10, dialogue: "Les petites pattes s'arrétént net devant la porte rouge, puis reprennent de l'autre côté." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_porte_rouge',
      name: 'Porte rouge metallique',
      actId: act2Id,
      introText: 'La porte rouge metallique ferme tout le sous-sol. Elle est chaude au toucher. La montre arrêtée vibre enfin dans sa poche.',
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_couloir', name: 'Retour couloir', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir dans le couloir rouge.', targetSceneId: 'act2_scene_couloir_rouge' }),
        makeImportedHotspot({ id: 'act2_h_franchir', name: 'Franchir la porte rouge', x: 50, y: 46, width: 24, height: 36, dialogue: "Le verrou demande l'heure morte: 10h09.", enigmaId: 'act2_enig_porte_rouge', requiredItemId: redBadgeId, lockedMessage: "Le badge rouge doit être prèsente avant d'entrer l'heure." }),
      ],
    }),
  );

  draft.routeMap.rooms.push(
    { id: 'room_act2_scene_bouche_egout', name: "Bouche d'egout sous la cave", sceneId: 'act2_scene_bouche_egout', x: 58, y: 28, type: 'room' },
    { id: 'room_act2_scene_collecteur', name: 'Collecteur principal', sceneId: 'act2_scene_collecteur', x: 70, y: 28, type: 'room' },
    { id: 'room_act2_scene_canal_est', name: 'Canal est des egouts', sceneId: 'act2_scene_canal_est', x: 82, y: 28, type: 'room' },
    { id: 'room_act2_scene_vannes', name: 'Salle des vannes', sceneId: 'act2_scene_vannes', x: 82, y: 46, type: 'room' },
    { id: 'room_act2_scene_sous_sol_technique', name: 'Sous-sol technique', sceneId: 'act2_scene_sous_sol_technique', x: 70, y: 58, type: 'room' },
    { id: 'room_act2_scene_local_electrique', name: 'Local electrique', sceneId: 'act2_scene_local_electrique', x: 56, y: 58, type: 'room' },
    { id: 'room_act2_scene_couloir_rouge', name: 'Couloir des sous-sols', sceneId: 'act2_scene_couloir_rouge', x: 82, y: 66, type: 'room' },
    { id: 'room_act2_scene_porte_rouge', name: 'Porte rouge metallique', sceneId: 'act2_scene_porte_rouge', x: 92, y: 82, type: 'end' },
  );
  draft.routeMap.connections.push(
    { id: 'connection_act2_01', fromRoomId: 'room_kuvbonw8', toRoomId: 'room_act2_scene_bouche_egout', label: 'Endroit sombre: passage acte II', locked: false, allowOneWay: true },
    { id: 'connection_act2_02', fromRoomId: 'room_act2_scene_bouche_egout', toRoomId: 'room_act2_scene_collecteur', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_03', fromRoomId: 'room_act2_scene_collecteur', toRoomId: 'room_act2_scene_canal_est', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_04', fromRoomId: 'room_act2_scene_canal_est', toRoomId: 'room_act2_scene_vannes', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_05', fromRoomId: 'room_act2_scene_vannes', toRoomId: 'room_act2_scene_sous_sol_technique', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_06', fromRoomId: 'room_act2_scene_sous_sol_technique', toRoomId: 'room_act2_scene_local_electrique', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_07', fromRoomId: 'room_act2_scene_sous_sol_technique', toRoomId: 'room_act2_scene_couloir_rouge', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_08', fromRoomId: 'room_act2_scene_couloir_rouge', toRoomId: 'room_act2_scene_porte_rouge', label: '', locked: false, allowOneWay: false },
  );
  draft.routeMap.notes = `${draft.routeMap.notes || ''}\nActe II: commence après l'endroit sombre de la cave, descend dans les egouts puis les sous-sols, et se terminé en franchissant la porte rouge metallique. Temps bloqué: 10h09. Rat fige: reprise temporaire du temps.`.trim();
};

const normalizeProject = (rawProject) => {
  const draft = structuredClone(rawProject || {});
  if (!Array.isArray(draft.items)) draft.items = [];
  if (!Array.isArray(draft.combinations)) draft.combinations = [];
  draft.combinations = draft.combinations.map((combo) => ({
    ...combo,
    consume: combo.consume ?? true,
    conditions: Array.isArray(combo.conditions) ? combo.conditions : [],
    failMessage: combo.failMessage || '',
  }));
  if (!Array.isArray(draft.scenes)) draft.scenes = [];
  if (!Array.isArray(draft.cinematics)) draft.cinematics = [];
  if (!Array.isArray(draft.enigmas)) draft.enigmas = [];
  if (!Array.isArray(draft.assets)) draft.assets = [];
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
  draft.creationMode = ['beginner', 'intermediate', 'expert'].includes(draft.creationMode) ? draft.creationMode : 'beginner';
  draft.anime2dDraft = draft.anime2dDraft && typeof draft.anime2dDraft === 'object' ? draft.anime2dDraft : null;
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
      name: room?.name || `Piece ${index + 1}`,
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
  const rawActMaps = rawRouteMap.actMaps && typeof rawRouteMap.actMaps === 'object' ? rawRouteMap.actMaps : {};
  draft.routeMap.actMaps = Object.fromEntries(
    Object.entries(rawActMaps).map(([actId, actMap]) => [actId, normalizeRouteMapShape(actMap)])
  );
  draft.scenes = draft.scenes.map((scene) => ({
    ...makeScene({ hotspots: [] }),
    ...scene,
    actId: scene.actId || fallbackActId,
    parentSceneId: scene.parentSceneId || '',
    backgroundId: scene.backgroundId || '',
    backgroundData: scene.backgroundData || '',
    backgroundName: scene.backgroundName || '',
    backgroundWidth: Math.max(0, Math.round(Number(scene.backgroundWidth) || 0)),
    backgroundHeight: Math.max(0, Math.round(Number(scene.backgroundHeight) || 0)),
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
    musicId: scene.musicId || '',
    musicData: scene.musicData || '',
    musicName: scene.musicName || '',
    musicLoop: scene.musicLoop !== false,
    ambientSoundId: scene.ambientSoundId || '',
    ambientSoundData: scene.ambientSoundData || '',
    ambientSoundName: scene.ambientSoundName || '',
    ambientSoundLoop: Boolean(scene.ambientSoundLoop),
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
    sceneObjects: Array.isArray(scene.sceneObjects) ?
       scene.sceneObjects.map((object) => ({
        id: object.id || uid(),
        name: object.name || 'Objet visible',
        blockType: ['object', 'text', 'image', 'button', 'input', 'code', 'hint'].includes(object.blockType) ? object.blockType : 'object',
        imageData: object.imageData || '',
        imageName: object.imageName || '',
        popupImage: object.popupImage || '',
        popupImageData: object.popupImageData || '',
        popupImageName: object.popupImageName || '',
        objectImageData: object.objectImageData || '',
        objectImageName: object.objectImageName || '',
        soundData: object.soundData || '',
        soundName: object.soundName || '',
        x: Number.isFinite(Number(object.x)) ? Number(object.x) : 50,
        y: Number.isFinite(Number(object.y)) ? Number(object.y) : 50,
        width: Number.isFinite(Number(object.width)) ? Number(object.width) : 14,
        height: Number.isFinite(Number(object.height)) ? Number(object.height) : 14,
        isInvisible: Boolean(object.isInvisible),
        isHidden: Boolean(object.isHidden),
        isLocked: Boolean(object.isLocked),
        clickMode: ['object', 'action', 'none'].includes(object.clickMode) ? object.clickMode : (object.isClickable === false ? 'none' : 'object'),
        interactionMode: ['popup', 'inventory', 'both'].includes(object.interactionMode) ? object.interactionMode : 'popup',
        linkedItemId: object.linkedItemId || '',
        removeAfterUse: object.removeAfterUse !== false,
        dialogue: object.dialogue || '',
        blockLabel: object.blockLabel || '',
        blockText: object.blockText || '',
        buttonLabel: object.buttonLabel || '',
        placeholder: object.placeholder || '',
        expectedAnswer: object.expectedAnswer || '',
        successDialogue: object.successDialogue || '',
        failureDialogue: object.failureDialogue || '',
        fontSize: Number.isFinite(Number(object.fontSize)) ? Math.max(8, Math.min(48, Number(object.fontSize))) : 13,
        requiredItemId: object.requiredItemId || '',
        consumeRequiredItemOnUse: Boolean(object.consumeRequiredItemOnUse),
        rewardItemId: object.rewardItemId || '',
        targetSceneId: object.targetSceneId || '',
        targetCinematicId: object.targetCinematicId || '',
        enigmaId: object.enigmaId || '',
        lockedMessage: object.lockedMessage || '',
        anime2dSpec: object.anime2dSpec && typeof object.anime2dSpec === 'object' ? object.anime2dSpec : null,
        anime2dName: object.anime2dName || '',
        logicRules: Array.isArray(object.logicRules) ?
           object.logicRules.map((rule) => ({ ...makeLogicRule(), ...rule }))
          : [],
        zIndex: object.zIndex,
        shapeType: object.shapeType,
        shapeCorners: object.shapeCorners,
        shapePoints: object.shapePoints,
        shapePointCount: object.shapePointCount,
        tutorialCreated: Boolean(object.tutorialCreated),
      }))
      : [],
  }));
  draft.cinematics = draft.cinematics.map((cinematic) => {
    const cinematicType = ['video', 'anime2d'].includes(cinematic.cinematicType) ? cinematic.cinematicType : 'slides';
    const slides = Array.isArray(cinematic.slides) && cinematic.slides.length ?
       cinematic.slides.map((slide) => ({ ...makeCinematicSlide(), ...slide }))
      : [makeCinematicSlide()];
    const normalizedCinematic = {
      ...makeCinematic(),
      ...cinematic,
      cinematicType,
      slides,
      anime2dSpec: cinematic.anime2dSpec && typeof cinematic.anime2dSpec === 'object' ? cinematic.anime2dSpec : null,
      anime2dName: cinematic.anime2dName || '',
      videoData: cinematic.videoData || '',
      videoName: cinematic.videoName || '',
      videoAutoplay: cinematic.videoAutoplay !== false,
      videoControls: cinematic.videoControls !== false,
      onEndType: ['none', 'act', 'scene', 'item'].includes(cinematic.onEndType) ? cinematic.onEndType : 'none',
      targetActId: cinematic.targetActId || '',
      targetSceneId: cinematic.targetSceneId || '',
      rewardItemId: cinematic.rewardItemId || '',
    };
    return {
      ...normalizedCinematic,
      steps: normalizeCinematicSteps(cinematic.steps, normalizedCinematic),
    };
  });
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
  ensureSewerAct2(draft);
  migrateProjectAssetReferences(draft);
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
  sceneA.introText = 'Tu entrès dans le salon. Explore la piece.';

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
    question: 'Reproduis la sequence de couleurs.',
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
      dialogue: 'Sous le coussin, tu trouvés une petite clé.',
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
      dialogue: 'Un panneau coloré bloqué un mécanisme.',
      enigmaId: hallwayColors.id,
    },
  ];

  const cinematic = makeCinematic();
  cinematic.name = 'Introduction';
  hallwayColors.targetCinematicId = cinematic.id;
  cinematic.slides[0].narration = 'Le silence pèse sur la piece. Quelqu’un est parti en vitesse.';
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
