const BUILDER_UI_STATE_KEY_PREFIX = 'escapeGameBuilder.builderUiState';
const ANIME_2D_DRAFT_STORAGE_KEY_PREFIX = 'escapeGameBuilder.2dAnimeDraft.v2';

export const safeParseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const canUseLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export const readJsonStorage = (key, fallback) => {
  if (!key || !canUseLocalStorage()) return fallback;
  return safeParseJson(window.localStorage.getItem(key), fallback);
};

export const writeJsonStorage = (key, value) => {
  if (!key || !canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const removeStorageKey = (key) => {
  if (!key || !canUseLocalStorage()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const getBuilderUiStateKey = (userId, projectId) => `${BUILDER_UI_STATE_KEY_PREFIX}.${userId || 'anonymous'}.${projectId || 'default'}`;

export const readBuilderUiState = (userId, projectId) => {
  if (!userId || !projectId) return {};
  const parsed = readJsonStorage(getBuilderUiStateKey(userId, projectId), {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

export const writeBuilderUiState = (userId, projectId, state) => {
  if (!userId || !projectId) return false;
  return writeJsonStorage(getBuilderUiStateKey(userId, projectId), {
    ...state,
    updatedAt: new Date().toISOString(),
  });
};

export const getAnime2dStorageId = (projectId, project = {}) => (
  project?.isTemporaryTutorial
    ? `temporary:${project.title || 'tutorial'}`
    : `project:${projectId || 'unsaved'}`
);

export const getAnime2dDraftStorageKey = (value = 'default') => {
  const safeValue = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'default';
  return `${ANIME_2D_DRAFT_STORAGE_KEY_PREFIX}.${safeValue}`;
};

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
