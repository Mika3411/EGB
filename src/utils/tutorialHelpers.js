const PROFILE_TUTORIAL_SEEN_KEY_PREFIX = 'escapeGameBuilder.profileTutorialSeen';

const BUILDER_TABS = ['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'map', 'adventure', 'hero', 'combat', 'cinematics', 'combinations', 'enigmas', 'logic', 'ai', 'shop', 'preview', 'animation', 'stunts', 'help', 'score'];
const BEGINNER_BUILDER_TABS = ['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'enigmas', 'stunts', 'ai', 'shop', 'preview', 'help'];
const INTERMEDIATE_BUILDER_TABS = ['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'map', 'cinematics', 'enigmas', 'stunts', 'ai', 'shop', 'preview', 'help'];
const ADVENTURE_BUILDER_TABS = ['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'map', 'adventure', 'hero', 'cinematics', 'enigmas', 'logic', 'shop', 'preview', 'animation', 'stunts', 'help', 'score'];
const HERO_ADVENTURE_BUILDER_TABS = ['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'map', 'adventure', 'hero', 'combat', 'cinematics', 'enigmas', 'logic', 'shop', 'preview', 'animation', 'stunts', 'help', 'score'];
const PROJECT_MODES = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'];

export const getProfileTutorialSeenKey = (userId) => `${PROFILE_TUTORIAL_SEEN_KEY_PREFIX}.${userId}`;

export const isBuilderTab = (tab) => BUILDER_TABS.includes(tab);

export const getProjectMode = (project) => (
  PROJECT_MODES.includes(project?.creationMode) ? project.creationMode : 'expert'
);

export const isTabAllowedForProject = (tab, project) => {
  const mode = getProjectMode(project);
  if (mode === 'expert') return true;
  if (mode === 'hero_adventure') return HERO_ADVENTURE_BUILDER_TABS.includes(tab);
  if (mode === 'adventure') return ADVENTURE_BUILDER_TABS.includes(tab);
  if (mode === 'intermediate') return INTERMEDIATE_BUILDER_TABS.includes(tab);
  return BEGINNER_BUILDER_TABS.includes(tab);
};

export const getSafeBuilderTab = (tab, project) => (
  isBuilderTab(tab) && isTabAllowedForProject(tab, project) ? tab : 'scenes'
);
