import proPromotionShowcaseTemplate from '../data/proPromotionShowcaseTemplate.json';
import proPromotionStoryTemplate from '../data/proPromotionStoryTemplate.json';
import { withTemplateSceneBackground } from './templateBackgrounds';

export const PRO_PROMOTION_PROJECT_MODE = 'pro_promo';

const cloneTemplateValue = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const getStoryTemplateScene = () => cloneTemplateValue(proPromotionStoryTemplate.scenes?.[0] || {});
const getShowcaseTemplateScene = () => cloneTemplateValue(proPromotionShowcaseTemplate.scenes?.[0] || {});
const getProPromotionTemplateScene = (kind) => {
  const normalizedKind = getProPromotionKind(kind);
  if (normalizedKind === 'story') return getStoryTemplateScene();
  if (normalizedKind === 'showcase') return getShowcaseTemplateScene();
  return null;
};

export const PRO_PROMOTION_KINDS = {
  promote: {
    title: 'Prologue',
    sceneName: 'Page prologue',
    intentLabel: 'Prologue',
    description: 'Page d’avant-jeu à partager avant la venue des joueurs : accroche, informations pratiques, consigne de départ et accès vers l’expérience principale.',
  },
  extend: {
    title: 'Épilogue',
    sceneName: 'Page épilogue',
    intentLabel: 'Épilogue',
    description: 'Page d’après-jeu à débloquer après la partie : conclusion, bonus, remerciements, suite de l’histoire et appel à rejouer.',
  },
  story: {
    title: 'Prologue / Épilogue',
    sceneName: 'Page prologue / épilogue',
    intentLabel: 'Prologue / Épilogue',
    description: 'Page complémentaire à placer avant ou après la partie : accroche, consignes, conclusion, bonus et accès vers l’expérience principale.',
  },
  showcase: {
    title: 'Vitrine',
    sceneName: 'Page vitrine',
    intentLabel: 'Vitrine',
    description: 'Page de présentation publique : enseigne, promesse, infos pratiques, réservation et sélection de projets à mettre en avant.',
  },
};

const PRO_PROMOTION_KIND_ALIASES = {
  after_game: 'extend',
  story: 'story',
  prologue_epilogue: 'story',
  prologue_epilogue_page: 'story',
  showcase: 'showcase',
  vitrine: 'showcase',
  presentation: 'showcase',
  présentation: 'showcase',
  promotion: 'promote',
  prologue: 'promote',
  briefing: 'promote',
  investigation_file: 'promote',
  seasonal_teaser: 'promote',
  epilogue: 'extend',
  loyalty: 'extend',
  treasure_hunt: 'extend',
};

const DEFAULT_PROJECT_TITLES = new Set(['Escape Game Builder', 'Nouveau projet', 'Projet vide']);
const DEFAULT_SCENE_NAMES = new Set(['Salon', 'Scène de départ']);
const DEFAULT_SCENE_INTROS = new Set([
  'Tu entrès dans le salon. Explore la pièce.',
  'Décris ici le point de départ de ton escape game.',
]);

const shouldUseExtensionValue = (value, defaults) => {
  const normalizedValue = String(value || '').trim();
  return !normalizedValue || defaults.has(normalizedValue);
};

const makeProTemplateText = ({
  id,
  name,
  x,
  y,
  width,
  height,
  blockText,
  fontSize = 15,
  fontFamily = 'system',
  textColor = '#ffffff',
  backgroundColor = '#071426',
  backgroundOpacity = 70,
  zIndex = 10,
  isLocked = false,
}) => ({
  id,
  name,
  blockType: 'text',
  imageData: '',
  imageName: '',
  popupImage: '',
  popupImageData: '',
  popupImageName: '',
  objectImageData: '',
  objectImageName: '',
  soundData: '',
  soundName: '',
  x,
  y,
  width,
  height,
  isInvisible: false,
  isHidden: false,
  isLocked,
  clickMode: 'none',
  interactionMode: 'popup',
  linkedItemId: '',
  removeAfterUse: true,
  actionType: 'dialogue',
  dialogue: blockText,
  blockLabel: '',
  blockText,
  buttonLabel: '',
  placeholder: '',
  expectedAnswer: '',
  successDialogue: '',
  failureDialogue: '',
  fontSize,
  fontFamily,
  textColor,
  backgroundColor,
  backgroundOpacity,
  requiredItemId: '',
  consumeRequiredItemOnUse: false,
  rewardItemId: '',
  targetSceneId: '',
  targetCinematicId: '',
  externalUrl: '',
  targetProjectId: '',
  targetProjectUserId: '',
  accessCodeEnabled: false,
  accessCode: '',
  enigmaId: '',
  lockedMessage: '',
  anime2dSpec: null,
  anime2dName: '',
  logicRules: [],
  zIndex,
  tutorialCreated: false,
});

const PRO_TEMPLATE_COPY = {
  promote: {
    title: 'Nom de votre salle + titre du prologue',
    pitch: 'Expliquez ici ce que les joueurs vont vivre avant la venue.\nIndiquez le rapport avec la salle physique.\nTerminez par l’action attendue : commencer, réserver ou lire le dossier.',
    audience: 'Décrivez ici le public conseillé, la durée estimée, le niveau et ce que les joueurs doivent avoir sous la main.',
    practical: 'Infos pratiques\nAjoutez ici horaires, adresse, consignes d’arrivée ou conditions de réservation.',
    address: 'Adresse ou point de rendez-vous\nRemplacez ce texte par vos informations utiles.',
    prologueLabel: 'Accès prologue\nAjoutez ensuite la zone d’accès au projet cible.',
    epilogueLabel: 'Accès épilogue\nIndiquez que cette zone sera disponible après la partie si besoin.',
    cta: 'Texte du bouton : réserver, commencer ou recevoir les infos',
    footer: 'Mention courte : réservation conseillée, contact, âge minimum ou rappel important.',
  },
  extend: {
    title: 'Nom de votre salle + titre de l’épilogue',
    pitch: 'Résumez ici la conclusion de l’aventure.\nExpliquez ce que les joueurs débloquent après la salle.\nAjoutez une phrase qui donne envie de découvrir le bonus.',
    audience: 'Décrivez ici le bonus proposé : score, souvenir, suite narrative, photo, réduction ou invitation à rejouer.',
    practical: 'Après la partie\nAjoutez ici les consignes pour utiliser le code donné en salle et accéder au contenu bonus.',
    address: 'Contact ou prochaine étape\nRemplacez ce texte par vos infos utiles.',
    prologueLabel: 'Rappel prologue\nAjoutez une zone vers le contenu d’avant-jeu seulement si utile.',
    epilogueLabel: 'Accès épilogue\nAjoutez ensuite la zone d’accès au projet cible, avec code si nécessaire.',
    cta: 'Texte du bouton : débloquer le bonus, laisser un avis ou réserver la suite',
    footer: 'Mention courte : remerciements, réseaux sociaux, offre de retour ou information légale.',
  },
  story: {
    title: 'Nom de votre salle + titre de la page complémentaire',
    pitch: 'Expliquez ici le rôle de cette page : préparer les joueurs avant la partie ou prolonger l’aventure après la salle.\nIndiquez ce qu’ils doivent comprendre, faire ou débloquer.',
    audience: 'Décrivez ici le public, la durée, le niveau, les consignes utiles et les éléments à garder sous la main.',
    practical: 'Infos pratiques\nAjoutez ici horaires, adresse, consignes d’arrivée, code remis en salle ou étape suivante.',
    address: 'Adresse ou contact\nRemplacez ce texte par vos informations utiles.',
    prologueLabel: 'Zone prologue\nAjoutez ici l’accès au contenu d’avant-jeu si cette page sert de départ.',
    epilogueLabel: 'Zone épilogue\nAjoutez ici l’accès au contenu d’après-jeu ou au bonus débloqué.',
    cta: 'Texte du bouton : commencer, réserver, débloquer le bonus ou contacter la salle',
    footer: 'Mention courte : réservation conseillée, âge minimum, remerciements ou contact.',
  },
  showcase: {
    title: 'Titre / Enseigne / Logo\nSlogan',
    pitch: 'Présentez ici votre salle comme une vraie vitrine : univers, promesse, public visé et raisons de réserver.',
    hours: 'Horaires\nRemplacez ce texte par vos jours d’ouverture, horaires et durée moyenne des sessions.',
    address: 'Adresse\nAjoutez ici l’adresse, le parking, les transports ou le point de rendez-vous.',
    projectOne: 'Projet à mettre en avant 1\nExpliquez ici le scénario, le niveau, la durée et le public conseillé.',
    projectTwo: 'Projet à mettre en avant 2\nExpliquez ici ce qui différencie cette expérience et à qui elle s’adresse.',
    projectThree: 'Projet à mettre en avant 3\nExpliquez ici le thème, l’objectif joueur et le type d’ambiance.',
    map: 'Emplacement carte ou accès\nAjoutez une image de plan si besoin, puis reliez la zone manuellement.',
    cta: 'Texte du bouton : réserver une session ou contacter la salle',
    footer: 'Mention courte : briefing sur place, réservation conseillée, âge minimum ou contact.',
  },
};

const buildProShowcaseSceneObjects = () => {
  const copy = PRO_TEMPLATE_COPY.showcase;
  return [
    makeProTemplateText({
      id: 'pro_template_title',
      name: 'Titre principal',
      x: 29.9,
      y: 11.6,
      width: 36.9,
      height: 15,
      blockText: copy.title,
      fontSize: 30,
      fontFamily: 'condensed',
      backgroundOpacity: 0,
      zIndex: 24,
    }),
    makeProTemplateText({
      id: 'showcase_template_pitch',
      name: 'Pitch vitrine',
      x: 35,
      y: 32,
      width: 54.9,
      height: 16,
      blockText: copy.pitch,
      fontSize: 17,
      backgroundOpacity: 0,
      zIndex: 23,
    }),
    makeProTemplateText({
      id: 'showcase_template_hours',
      name: 'Horaires',
      x: 82,
      y: 32,
      width: 23.2,
      height: 16,
      blockText: copy.hours,
      fontSize: 15,
      backgroundOpacity: 36,
      zIndex: 22,
    }),
    makeProTemplateText({
      id: 'showcase_template_address',
      name: 'Adresse',
      x: 70.9,
      y: 13.8,
      width: 16.9,
      height: 12,
      blockText: copy.address,
      fontSize: 14,
      backgroundOpacity: 0,
      zIndex: 21,
    }),
    makeProTemplateText({
      id: 'showcase_template_map',
      name: 'Carte ou accès',
      x: 89.9,
      y: 13.8,
      width: 13.6,
      height: 18.5,
      blockText: copy.map,
      fontSize: 12,
      backgroundOpacity: 62,
      zIndex: 20,
      isLocked: true,
    }),
    makeProTemplateText({
      id: 'showcase_template_project_1',
      name: 'Projet vitrine 1',
      x: 18.9,
      y: 63.6,
      width: 22.8,
      height: 27.3,
      blockText: copy.projectOne,
      fontSize: 14,
      backgroundOpacity: 72,
      zIndex: 19,
      isLocked: true,
    }),
    makeProTemplateText({
      id: 'showcase_template_project_2',
      name: 'Projet vitrine 2',
      x: 50,
      y: 57.3,
      width: 22.8,
      height: 27.2,
      blockText: copy.projectTwo,
      fontSize: 14,
      backgroundOpacity: 72,
      zIndex: 18,
      isLocked: true,
    }),
    makeProTemplateText({
      id: 'showcase_template_project_3',
      name: 'Projet vitrine 3',
      x: 81.8,
      y: 63.6,
      width: 22.8,
      height: 27.3,
      blockText: copy.projectThree,
      fontSize: 14,
      backgroundOpacity: 72,
      zIndex: 17,
      isLocked: true,
    }),
    makeProTemplateText({
      id: 'showcase_template_cta',
      name: 'Bouton principal',
      x: 50,
      y: 82.4,
      width: 28,
      height: 9,
      blockText: copy.cta,
      fontSize: 20,
      fontFamily: 'condensed',
      backgroundColor: '#093bae',
      backgroundOpacity: 58,
      zIndex: 34,
    }),
    makeProTemplateText({
      id: 'showcase_template_footer',
      name: 'Note finale',
      x: 48.4,
      y: 93.7,
      width: 52.5,
      height: 4.6,
      blockText: copy.footer,
      fontSize: 11,
      backgroundOpacity: 0,
      zIndex: 16,
      isLocked: true,
    }),
  ];
};

const buildProStorySceneObjects = (kind) => {
  const templateScene = getProPromotionTemplateScene(kind);
  if (templateScene) {
    return cloneTemplateValue(templateScene.sceneObjects || []);
  }

  const copy = PRO_TEMPLATE_COPY[getProPromotionKind(kind)];
  return [
    makeProTemplateText({
      id: 'pro_template_title',
      name: 'Titre principal',
      x: 26.5,
      y: 13.5,
      width: 42,
      height: 19,
      blockText: copy.title,
      fontSize: 30,
      fontFamily: 'handwritten',
      backgroundOpacity: 0,
      zIndex: 24,
    }),
    makeProTemplateText({
      id: 'pro_template_pitch',
      name: 'Promesse et déroulé',
      x: 27.8,
      y: 32.9,
      width: 44.4,
      height: 16.5,
      blockText: copy.pitch,
      fontSize: 18,
      fontFamily: 'handwritten',
      backgroundOpacity: 76,
      zIndex: 23,
      isLocked: true,
    }),
    makeProTemplateText({
      id: 'pro_template_audience',
      name: 'Public et durée',
      x: 50,
      y: 56.3,
      width: 30.6,
      height: 15.6,
      blockText: copy.audience,
      fontSize: 15,
      fontFamily: 'handwritten',
      backgroundOpacity: 82,
      zIndex: 22,
      isLocked: true,
    }),
    makeProTemplateText({ id: 'pro_template_practical', name: 'Infos pratiques', x: 71.7, y: 32.9, width: 18.4, height: 15, blockText: copy.practical, fontSize: 13, backgroundOpacity: 70, zIndex: 25 }),
    makeProTemplateText({ id: 'pro_template_contact', name: 'Adresse ou contact', x: 71.7, y: 13.5, width: 17.9, height: 11.5, blockText: copy.address, fontSize: 13, backgroundOpacity: 70, zIndex: 21, isLocked: true }),
    makeProTemplateText({ id: 'pro_template_prologue_label', name: 'Emplacement prologue', x: 16.9, y: 48.5, width: 16, height: 9, blockText: copy.prologueLabel, fontSize: 18, fontFamily: 'handwritten', textColor: '#a7f349', backgroundOpacity: 64, zIndex: 19, isLocked: true }),
    makeProTemplateText({ id: 'pro_template_epilogue_label', name: 'Emplacement épilogue', x: 82, y: 48.5, width: 16, height: 9, blockText: copy.epilogueLabel, fontSize: 18, fontFamily: 'handwritten', textColor: '#a7f349', backgroundOpacity: 64, zIndex: 20, isLocked: true }),
    makeProTemplateText({ id: 'pro_template_cta', name: 'Bouton principal', x: 50.6, y: 76.9, width: 29.4, height: 6.8, blockText: copy.cta, fontSize: 16, fontFamily: 'condensed', backgroundColor: '#093bae', backgroundOpacity: 70, zIndex: 34 }),
    makeProTemplateText({ id: 'pro_template_footer', name: 'Note finale', x: 50, y: 92.2, width: 36.8, height: 5, blockText: copy.footer, fontSize: 11, backgroundOpacity: 70, zIndex: 18, isLocked: true }),
  ];
};

const buildProStoryHotspots = (kind) => (
  getProPromotionTemplateScene(kind)
    ? cloneTemplateValue(getProPromotionTemplateScene(kind).hotspots || [])
    : []
);

const buildProPromotionSceneObjects = (kind) => (
  getProPromotionKind(kind) === 'showcase'
    ? buildProStorySceneObjects(kind)
    : buildProStorySceneObjects(kind)
);

const applyProPromotionTemplate = (project, kind) => {
  const normalizedKind = getProPromotionKind(kind);
  const config = getProPromotionConfig(normalizedKind);
  const templateScene = getProPromotionTemplateScene(kind);
  const act = project.acts?.[0] || { id: 'act_pro_template', name: 'Extension Pro' };
  act.name = config.title;
  project.acts = [act];

  const firstScene = project.scenes?.[0] || {};
  const scene = withTemplateSceneBackground({
    ...firstScene,
    ...(templateScene || {}),
    id: firstScene.id || 'scene_pro_template',
    name: config.sceneName,
    actId: act.id || '',
    parentSceneId: '',
    backgroundId: templateScene?.backgroundId || '',
    backgroundData: templateScene?.backgroundData || '',
    backgroundName: templateScene?.backgroundName || '',
    backgroundWidth: templateScene?.backgroundWidth || 0,
    backgroundHeight: templateScene?.backgroundHeight || 0,
    backgroundAspectRatio: templateScene?.backgroundAspectRatio || 1.5988,
    visualEffect: 'vignette',
    visualEffectIntensity: 'subtle',
    sceneTransition: 'fade',
    sceneTransitionDuration: 900,
    timerEnabled: false,
    timerEndAction: 'none',
    timerTargetSceneId: '',
    timerTargetCinematicId: '',
    musicId: '',
    musicData: '',
    musicName: '',
    ambientSoundId: '',
    ambientSoundData: '',
    ambientSoundName: '',
    introText: config.description,
    hotspots: buildProStoryHotspots(kind),
    visualEffectZones: [],
    sceneObjects: buildProPromotionSceneObjects(kind),
  }, normalizedKind);

  project.scenes = [scene];
  project.items = [];
  project.combinations = [];
  project.enigmas = [];
  project.cinematics = [];
  project.assets = [];
  project.routeMap = {
    rows: 16,
    cols: 24,
    cells: [],
    rooms: [],
    connections: [],
    canvases: [{ id: 'route_canvas_1', name: 'Canvas 1' }],
    notes: '',
  };
  project.start = {
    type: 'scene',
    targetSceneId: scene.id,
    targetCinematicId: '',
  };
};

export const getProPromotionKind = (kind = '') => (
  PRO_PROMOTION_KINDS[kind] ? kind : PRO_PROMOTION_KIND_ALIASES[kind] || 'promote'
);

export const getProPromotionConfig = (kind = '') => (
  PRO_PROMOTION_KINDS[getProPromotionKind(kind)]
);

export const getProPromotionProjectKind = (projectOrData = {}) => {
  const data = projectOrData?.data || projectOrData || {};
  return getProPromotionKind(data.proPage?.kind || '');
};

export const isProPromotionProject = (projectOrData = {}) => {
  const data = projectOrData?.data || projectOrData || {};
  return data.creationMode === PRO_PROMOTION_PROJECT_MODE || Boolean(data.proPage);
};

export const applyProPromotionProjectSetup = (project, kind = 'promote') => {
  const config = getProPromotionConfig(kind);
  const nextProject = project || {};
  nextProject.creationMode = PRO_PROMOTION_PROJECT_MODE;
  if (shouldUseExtensionValue(nextProject.title, DEFAULT_PROJECT_TITLES)) {
    nextProject.title = config.title;
  }
  nextProject.proPage = {
    kind: getProPromotionKind(kind),
    intentLabel: config.intentLabel,
    links: [],
    promotions: [],
    notes: '',
    updatedAt: new Date().toISOString(),
  };

  applyProPromotionTemplate(nextProject, kind);

  const firstScene = nextProject.scenes?.[0];
  if (firstScene) {
    if (shouldUseExtensionValue(firstScene.name, DEFAULT_SCENE_NAMES)) {
      firstScene.name = config.sceneName;
    }
    if (shouldUseExtensionValue(firstScene.introText, DEFAULT_SCENE_INTROS)) {
      firstScene.introText = config.description;
    }
  }

  return nextProject;
};
