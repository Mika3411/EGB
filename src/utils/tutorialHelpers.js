const PROFILE_TUTORIAL_SEEN_KEY_PREFIX = 'escapeGameBuilder.profileTutorialSeen';

const BUILDER_TABS = ['scenes', 'media', 'objects', 'map', 'adventure', 'hero', 'cinematics', 'combinations', 'enigmas', 'logic', 'ai', 'shop', 'preview', 'animation', 'help', 'score'];
const BEGINNER_BUILDER_TABS = ['scenes', 'media', 'objects', 'enigmas', 'ai', 'shop', 'preview', 'help'];
const INTERMEDIATE_BUILDER_TABS = ['scenes', 'media', 'objects', 'map', 'cinematics', 'enigmas', 'ai', 'shop', 'preview', 'help'];
const ADVENTURE_BUILDER_TABS = ['scenes', 'media', 'objects', 'map', 'adventure', 'hero', 'cinematics', 'enigmas', 'logic', 'shop', 'preview', 'animation', 'help', 'score'];
const PROJECT_MODES = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'];

export const getProfileTutorialSeenKey = (userId) => `${PROFILE_TUTORIAL_SEEN_KEY_PREFIX}.${userId}`;

export const isBuilderTab = (tab) => BUILDER_TABS.includes(tab);

export const getProjectMode = (project) => (
  PROJECT_MODES.includes(project?.creationMode) ? project.creationMode : 'expert'
);

export const isTabAllowedForProject = (tab, project) => (
  getProjectMode(project) === 'expert'
    || (['adventure', 'hero_adventure'].includes(getProjectMode(project))
      ? ADVENTURE_BUILDER_TABS.includes(tab)
      : getProjectMode(project) === 'intermediate' ? INTERMEDIATE_BUILDER_TABS.includes(tab) : BEGINNER_BUILDER_TABS.includes(tab))
);

export const getSafeBuilderTab = (tab, project) => (
  isBuilderTab(tab) && isTabAllowedForProject(tab, project) ? tab : 'scenes'
);
