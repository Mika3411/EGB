const PROFILE_TUTORIAL_SEEN_KEY_PREFIX = 'escapeGameBuilder.profileTutorialSeen';

const BUILDER_TABS = ['scenes', 'media', 'map', 'cinematics', 'combinations', 'enigmas', 'logic', 'ai', 'shop', 'preview', 'animation', 'help', 'score'];
const BEGINNER_BUILDER_TABS = ['scenes', 'media', 'enigmas', 'shop', 'preview', 'help'];
const INTERMEDIATE_BUILDER_TABS = ['scenes', 'media', 'map', 'cinematics', 'enigmas', 'shop', 'preview', 'help', 'score'];

export const getProfileTutorialSeenKey = (userId) => `${PROFILE_TUTORIAL_SEEN_KEY_PREFIX}.${userId}`;

export const isBuilderTab = (tab) => BUILDER_TABS.includes(tab);

export const getProjectMode = (project) => (
  ['beginner', 'intermediate', 'expert'].includes(project?.creationMode) ? project.creationMode : 'expert'
);

export const isTabAllowedForProject = (tab, project) => (
  getProjectMode(project) === 'expert'
    || (getProjectMode(project) === 'intermediate' ? INTERMEDIATE_BUILDER_TABS.includes(tab) : BEGINNER_BUILDER_TABS.includes(tab))
);

export const getSafeBuilderTab = (tab, project) => (
  isBuilderTab(tab) && isTabAllowedForProject(tab, project) ? tab : 'scenes'
);
