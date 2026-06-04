import {
  getClassicBuilderProjectMode,
  isClassicBuilderTab,
  isClassicBuilderTabVisibleForMode,
} from './classicBuilderTabs';

const PROFILE_TUTORIAL_SEEN_KEY_PREFIX = 'escapeGameBuilder.profileTutorialSeen';

export const getProfileTutorialSeenKey = (userId) => `${PROFILE_TUTORIAL_SEEN_KEY_PREFIX}.${userId}`;

export const isBuilderTab = isClassicBuilderTab;

export const getProjectMode = (project) => (
  getClassicBuilderProjectMode(project?.creationMode)
);

export const isTabAllowedForProject = (tab, project) => {
  const mode = getProjectMode(project);
  return isBuilderTab(tab) && isClassicBuilderTabVisibleForMode(tab, mode);
};

export const getSafeBuilderTab = (tab, project) => (
  isBuilderTab(tab) && isTabAllowedForProject(tab, project) ? tab : 'scenes'
);
