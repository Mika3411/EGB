import { createIndexedDraftStorage } from '../../utils/indexedDraftStorage';
import { getAiDraftFallbackStorageKey } from '../../utils/aiDraftStorageKeys';

const AI_DRAFT_DB = 'escape-game-builder-ai-drafts';

export const AI_DRAFT_AUTOSAVE_DELAY_MS = 2_500;

const aiDraftStorage = createIndexedDraftStorage(AI_DRAFT_DB);

export const readAiDraft = aiDraftStorage.read;
export const writeAiDraft = aiDraftStorage.write;
export const deleteAiDraft = aiDraftStorage.remove;

export const readLocalAiDraft = (aiDraftKey = '') => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getAiDraftFallbackStorageKey(aiDraftKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeLocalAiDraft = (aiDraftKey = '', draft = null) => {
  if (typeof window === 'undefined' || !window.localStorage || !draft) return false;
  try {
    window.localStorage.setItem(getAiDraftFallbackStorageKey(aiDraftKey), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const deleteLocalAiDraft = (aiDraftKey = '') => {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    window.localStorage.removeItem(getAiDraftFallbackStorageKey(aiDraftKey));
    return true;
  } catch {
    return false;
  }
};

const getAiDraftSavedTime = (draft = {}) => {
  const time = Date.parse(draft?.savedAt || '');
  return Number.isFinite(time) ? time : null;
};

const isUsableAiDraft = (draft) => Boolean(draft?.generatedProject);

export const selectPreferredAiDraft = (candidates = []) => {
  const usableCandidates = candidates.filter((candidate) => isUsableAiDraft(candidate?.draft));
  if (!usableCandidates.length) return null;
  return usableCandidates.reduce((best, candidate) => {
    const candidateTime = getAiDraftSavedTime(candidate.draft);
    const bestTime = getAiDraftSavedTime(best.draft);
    if (candidateTime !== null && (bestTime === null || candidateTime > bestTime)) return candidate;
    return best;
  }, usableCandidates[0]);
};

export const saveFullAiDraftLocally = async (aiDraftKey = '', fullDraft = null) => {
  let indexedSaved = false;
  try {
    await writeAiDraft(aiDraftKey, fullDraft);
    indexedSaved = true;
  } catch {
    indexedSaved = false;
  }
  const localSaved = writeLocalAiDraft(aiDraftKey, fullDraft);
  return indexedSaved || localSaved;
};

export const clearStoredAiDraft = async (aiDraftKey = '', onSaveAiDraft = null) => {
  const cleanupFailures = [];
  const indexedDeleted = await deleteAiDraft(aiDraftKey)
    .then(() => true)
    .catch(() => false);
  const localDeleted = deleteLocalAiDraft(aiDraftKey);
  const projectDeleted = onSaveAiDraft
    ? await onSaveAiDraft(null)
      .then(() => true)
      .catch(() => false)
    : true;
  if (!indexedDeleted) cleanupFailures.push('IndexedDB');
  if (!localDeleted) cleanupFailures.push('localStorage');
  if (!projectDeleted) cleanupFailures.push('copie projet');
  return cleanupFailures;
};
