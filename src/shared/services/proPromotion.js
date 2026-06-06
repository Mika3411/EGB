export const PRO_PROMOTION_PROJECT_MODE = 'pro_promo';

export const PRO_PROMOTION_KINDS = {
  promote: {
    title: 'Extension d’expérience - promotion',
    sceneName: 'Page de promotion',
    intentLabel: 'Promouvoir',
    description: 'Point de départ d’une extension d’expérience à placer avant la venue des joueurs : teaser, prologue, dossier d’enquête ou campagne.',
  },
  extend: {
    title: 'Extension d’expérience - prolongement',
    sceneName: 'Page de prolongement',
    intentLabel: 'Prolonger',
    description: 'Point de départ d’une extension d’expérience à placer après la partie : épilogue, bonus, remerciements ou fidélisation.',
  },
};

const PRO_PROMOTION_KIND_ALIASES = {
  after_game: 'extend',
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
