const BUILDER_UI_STATE_KEY_PREFIX = 'escapeGameBuilder.builderUiState';

export const getBuilderUiStateKey = (userId, projectId) => `${BUILDER_UI_STATE_KEY_PREFIX}.${userId || 'anonymous'}.${projectId || 'default'}`;

export const readBuilderUiState = (userId, projectId) => {
  if (!userId || !projectId || typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getBuilderUiStateKey(userId, projectId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const writeBuilderUiState = (userId, projectId, state) => {
  if (!userId || !projectId || typeof window === 'undefined') return;
  window.localStorage.setItem(getBuilderUiStateKey(userId, projectId), JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  }));
};

export const getAnime2dStorageId = (projectId, project = {}) => (
  project?.isTemporaryTutorial
    ? `temporary:${project.title || 'tutorial'}`
    : `project:${projectId || 'unsaved'}`
);

export const getAnime2dDraftMeta = (draft) => draft ? {
  savedAt: draft.savedAt || new Date().toISOString(),
  title: draft.sceneName || draft.projectName || 'Projet 2D Anime',
  layerCount: Array.isArray(draft.layers) ? draft.layers.length : 0,
  stepCount: Array.isArray(draft.cinematicSteps) ? draft.cinematicSteps.length : 0,
} : null;

export const stripAnime2dDraftFromProject = (project = {}) => {
  const { anime2dDraft, ...projectWithoutDraft } = project || {};
  if (!anime2dDraft) return projectWithoutDraft;
  return {
    ...projectWithoutDraft,
    anime2dDraftMeta: getAnime2dDraftMeta(anime2dDraft),
  };
};
