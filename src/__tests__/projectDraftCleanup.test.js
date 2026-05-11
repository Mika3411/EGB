import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/indexedDraftStorage', () => ({
  deleteIndexedDrafts: vi.fn(async (_dbName, ids) => ids.length),
}));

import { deleteIndexedDrafts } from '../utils/indexedDraftStorage';
import {
  AI_DRAFT_DB_NAME,
  ANIME_2D_DRAFT_DB_NAME,
  deleteProjectLocalDrafts,
  getProjectAiDraftIds,
  getProjectAnime2dDraftIds,
} from '../utils/projectDraftCleanup';
import { getAnime2dDraftStorageKey } from '../utils/storageHelpers';

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'indexedDB', {
    value: {},
    configurable: true,
  });
  vi.mocked(deleteIndexedDrafts).mockImplementation(async (_dbName, ids) => ids.length);
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  Object.defineProperty(window, 'indexedDB', {
    value: undefined,
    configurable: true,
  });
});

describe('project draft cleanup', () => {
  it('builds AI draft ids from the project id and legacy project fallbacks', () => {
    expect(getProjectAiDraftIds('project-1', {
      title: 'Escape lunaire',
      start: { targetSceneId: 'scene-start' },
    })).toEqual([
      'ai-draft:project-1',
      'ai-draft:Escape lunaire',
      'ai-draft:scene-start',
    ]);
  });

  it('builds 2D draft ids from the same storage helper used by the editor', () => {
    expect(getProjectAnime2dDraftIds('project-1', { title: 'Escape lunaire' })).toEqual([
      'escapeGameBuilder.2dAnimeDraft.v2.project-project-1',
      'project:project-1',
    ]);
    expect(getProjectAnime2dDraftIds('project-1', {
      isTemporaryTutorial: true,
      title: 'Tutoriel',
    })).toEqual([
      'escapeGameBuilder.2dAnimeDraft.v2.temporary-tutoriel',
      'temporary:Tutoriel',
      'project:project-1',
    ]);
  });

  it('deletes AI and 2D drafts for a removed project', async () => {
    const result = await deleteProjectLocalDrafts('project-1', {
      title: 'Escape lunaire',
      start: { targetSceneId: 'scene-start' },
    });

    expect(deleteIndexedDrafts).toHaveBeenNthCalledWith(1, AI_DRAFT_DB_NAME, [
      'ai-draft:project-1',
      'ai-draft:Escape lunaire',
      'ai-draft:scene-start',
    ]);
    expect(deleteIndexedDrafts).toHaveBeenNthCalledWith(2, ANIME_2D_DRAFT_DB_NAME, [
      'escapeGameBuilder.2dAnimeDraft.v2.project-project-1',
      'project:project-1',
    ]);
    expect(result).toEqual({
      aiDraftsDeleted: 3,
      anime2dDraftsDeleted: 2,
      anime2dLocalDraftsDeleted: 0,
      errors: [],
    });
  });

  it('removes 2D localStorage fallback drafts for a removed project', async () => {
    const storageKey = getAnime2dDraftStorageKey('project:project-1');
    window.localStorage.setItem(storageKey, JSON.stringify({ layers: [{ id: 'layer-1' }] }));
    window.localStorage.setItem('project:project-1', JSON.stringify({ layers: [{ id: 'legacy-layer' }] }));

    await expect(deleteProjectLocalDrafts('project-1', {})).resolves.toMatchObject({
      anime2dLocalDraftsDeleted: 2,
    });

    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(window.localStorage.getItem('project:project-1')).toBeNull();
  });

  it('skips IndexedDB cleanup when unavailable but still removes localStorage fallbacks', async () => {
    const storageKey = getAnime2dDraftStorageKey('project:project-1');
    window.localStorage.setItem(storageKey, JSON.stringify({ layers: [{ id: 'layer-1' }] }));
    Object.defineProperty(window, 'indexedDB', {
      value: undefined,
      configurable: true,
    });

    await expect(deleteProjectLocalDrafts('project-1', {})).resolves.toEqual({
      aiDraftsDeleted: 0,
      anime2dDraftsDeleted: 0,
      anime2dLocalDraftsDeleted: 1,
      errors: [],
    });
    expect(deleteIndexedDrafts).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it('returns cleanup errors without blocking the project deletion flow', async () => {
    const error = new Error('IndexedDB blocked');
    vi.mocked(deleteIndexedDrafts)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(2);

    await expect(deleteProjectLocalDrafts('project-1', {})).resolves.toEqual({
      aiDraftsDeleted: 0,
      anime2dDraftsDeleted: 2,
      anime2dLocalDraftsDeleted: 0,
      errors: [error],
    });
  });
});
