import { createIndexedDraftStorage } from './indexedDraftStorage';
import { getAnime2dDraftStorageKey } from './storageHelpers';

const LEGACY_DRAFT_STORAGE_KEY = 'escapeGameBuilder.2dAnimeDraft.v1';
const ANIME_DRAFT_DB = 'escape-game-builder-2d-anime-drafts';

const animeDraftStorage = createIndexedDraftStorage(ANIME_DRAFT_DB);

const isUsableAnimeDraft = (draft) => Boolean(draft?.layers?.length);

const getAnimeDraftSavedTime = (draft = {}) => {
  const time = Date.parse(draft?.savedAt || '');
  return Number.isFinite(time) ? time : null;
};

const selectPreferredAnimeDraft = (drafts = []) => {
  const candidates = drafts.filter(isUsableAnimeDraft);
  if (!candidates.length) return null;
  return candidates.reduce((best, candidate) => {
    const candidateTime = getAnimeDraftSavedTime(candidate);
    const bestTime = getAnimeDraftSavedTime(best);
    if (candidateTime !== null && (bestTime === null || candidateTime > bestTime)) return candidate;
    return best;
  }, candidates[0]);
};

export const readStoredAnimeDraft = (storageKey = LEGACY_DRAFT_STORAGE_KEY) => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = JSON.parse(stored || 'null');
    if (!parsed || !Array.isArray(parsed.layers)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const readBestAnimeDraft = async (id, projectDraft = null) => {
  const exactDraft = await animeDraftStorage.read(id).catch(() => null);
  const localDraft = readStoredAnimeDraft(id);
  return selectPreferredAnimeDraft([exactDraft, localDraft, projectDraft]);
};

export const writeBestAnimeDraft = async (id, value) => {
  let indexedSaved = false;
  let localSaved = false;
  try {
    await animeDraftStorage.write(id, value);
    indexedSaved = true;
  } catch {
    indexedSaved = false;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(id, JSON.stringify(value));
      localSaved = true;
    } catch {
      localSaved = false;
    }
  }
  if (!indexedSaved && !localSaved) {
    throw new Error('Sauvegarde du brouillon 2D impossible.');
  }
};

export const deleteBestAnimeDraft = async (id) => {
  await animeDraftStorage.remove(id).catch(() => {});
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(id);
    } catch {
      // Ignore browsers that block localStorage.
    }
  }
};

export const saveProjectDraftBestEffort = async (onSaveDraft, draft) => {
  if (!onSaveDraft) return true;
  try {
    await onSaveDraft(draft);
    return true;
  } catch (error) {
    console.warn('Copie projet 2D Anime impossible.', error);
    return false;
  }
};

export const getDraftDirtySignature = (draft = {}) => JSON.stringify({
  layers: draft.layers || [],
  selectedBackdrop: draft.selectedBackdrop || 'room',
  sceneName: draft.sceneName || '',
  cinematicSteps: draft.cinematicSteps || [],
});

export const isDraftSaveVerified = (savedDraft, expectedDraft) => {
  if (!isUsableAnimeDraft(savedDraft)) return false;
  if (getDraftDirtySignature(savedDraft) === getDraftDirtySignature(expectedDraft)) return true;
  const savedTime = getAnimeDraftSavedTime(savedDraft);
  const expectedTime = getAnimeDraftSavedTime(expectedDraft);
  return savedTime !== null && expectedTime !== null && savedTime >= expectedTime;
};

export { getAnime2dDraftStorageKey };
