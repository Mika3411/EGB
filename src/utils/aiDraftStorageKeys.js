const AI_DRAFT_FALLBACK_STORAGE_PREFIX = 'escapeGameBuilder.aiDraft.v1';

export const getAiDraftFallbackStorageKey = (aiDraftKey = 'default') => {
  const safeKey = String(aiDraftKey || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'default';
  return `${AI_DRAFT_FALLBACK_STORAGE_PREFIX}.${safeKey}`;
};
