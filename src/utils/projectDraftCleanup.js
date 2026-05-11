import { deleteIndexedDrafts } from './indexedDraftStorage';
import {
  canUseLocalStorage,
  getAnime2dDraftStorageKey,
  getAnime2dStorageId,
  removeStorageKey,
} from './storageHelpers';

export const AI_DRAFT_DB_NAME = 'escape-game-builder-ai-drafts';
export const ANIME_2D_DRAFT_DB_NAME = 'escape-game-builder-2d-anime-drafts';

const compactUniqueStrings = (values) => [...new Set(values
  .filter((value) => typeof value === 'string')
  .map((value) => value.trim())
  .filter(Boolean))];

const canUseIndexedDraftDb = () => (
  typeof window !== 'undefined'
  && typeof window.indexedDB !== 'undefined'
);

export const getProjectAiDraftIds = (projectId, project = {}) => compactUniqueStrings([
  projectId ? `ai-draft:${projectId}` : '',
  project?.title ? `ai-draft:${project.title}` : '',
  project?.start?.targetSceneId ? `ai-draft:${project.start.targetSceneId}` : '',
]);

export const getProjectAnime2dDraftIds = (projectId, project = {}) => compactUniqueStrings([
  getAnime2dDraftStorageKey(getAnime2dStorageId(projectId, project)),
  getAnime2dStorageId(projectId, project),
  projectId ? `project:${projectId}` : '',
]);

const removeLocalDraftKeys = (draftIds) => {
  if (!canUseLocalStorage()) return 0;
  return draftIds.reduce((removedCount, draftId) => {
    const exists = window.localStorage.getItem(draftId) !== null;
    const removed = removeStorageKey(draftId);
    return removedCount + (exists && removed ? 1 : 0);
  }, 0);
};

export const deleteProjectLocalDrafts = async (projectId, project = {}) => {
  const aiDraftIds = getProjectAiDraftIds(projectId, project);
  const anime2dDraftIds = getProjectAnime2dDraftIds(projectId, project);
  const anime2dLocalDraftsDeleted = removeLocalDraftKeys(anime2dDraftIds);

  const [aiDrafts, anime2dDrafts] = canUseIndexedDraftDb()
    ? await Promise.allSettled([
      deleteIndexedDrafts(AI_DRAFT_DB_NAME, aiDraftIds),
      deleteIndexedDrafts(ANIME_2D_DRAFT_DB_NAME, anime2dDraftIds),
    ])
    : [
      { status: 'fulfilled', value: 0 },
      { status: 'fulfilled', value: 0 },
    ];

  return {
    aiDraftsDeleted: aiDrafts.status === 'fulfilled' ? aiDrafts.value : 0,
    anime2dDraftsDeleted: anime2dDrafts.status === 'fulfilled' ? anime2dDrafts.value : 0,
    anime2dLocalDraftsDeleted,
    errors: [aiDrafts, anime2dDrafts]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason),
  };
};
