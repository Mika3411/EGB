import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Anime2DStudio from '../domains/anime2d/Anime2DStudio.jsx';
import { getAnime2dDraftStorageKey } from '../shared/utils/storageHelpers';

const animeDraftStorage = vi.hoisted(() => ({
  read: vi.fn(async () => null),
  write: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  removeMany: vi.fn(async () => undefined),
}));

vi.mock('../shared/utils/indexedDraftStorage', () => ({
  createIndexedDraftStorage: () => animeDraftStorage,
}));

const makeDraft = (sceneName, savedAt) => ({
  layers: [{
    id: `layer-${sceneName}`,
    name: `Layer ${sceneName}`,
    type: 'character',
    src: '',
    originalSrc: '',
    preset: 'idle-breathe',
    state: 'neutre',
    x: 50,
    y: 56,
    width: 28,
    height: 44.8,
    opacity: 100,
    duration: 2400,
    delay: 0,
    loop: true,
    visible: true,
    visibleAtStart: true,
    locked: false,
  }],
  selectedBackdrop: 'room',
  sceneName,
  cinematicSteps: [{
    id: `step-${sceneName}`,
    at: 0,
    duration: 2,
    narration: `Narration ${sceneName}`,
    mode: 'scene',
    layerId: '',
  }],
  selectedLayerId: `layer-${sceneName}`,
  selectedCinematicStepId: `step-${sceneName}`,
  currentTime: 0,
  ...(savedAt ? { savedAt } : {}),
});

const renderEditor = ({
  draftStorageKey = 'project:anime-draft-tests',
  projectDraft = null,
} = {}) => render(
  <Anime2DStudio
    projectName="Projet Anime"
    projectDraft={projectDraft}
    draftStorageKey={draftStorageKey}
  />,
);

const writeLocalDraft = (draftStorageKey, draft) => {
  window.localStorage.setItem(
    getAnime2dDraftStorageKey(draftStorageKey),
    JSON.stringify(draft),
  );
};

const expectCanvasTitle = (container, title) => {
  expect(container.querySelector('.anime-title-button')?.textContent).toContain(title);
};

beforeEach(() => {
  window.localStorage.clear();
  animeDraftStorage.read.mockResolvedValue(null);
  animeDraftStorage.write.mockResolvedValue(undefined);
  animeDraftStorage.remove.mockResolvedValue(undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('Anime2DStudio draft restore', () => {
  test('prefers a newer localStorage draft over a stale IndexedDB draft', async () => {
    const draftStorageKey = 'project:local-newer';
    animeDraftStorage.read.mockResolvedValue(makeDraft('IndexedDB old', '2025-01-01T00:00:00.000Z'));
    writeLocalDraft(draftStorageKey, makeDraft('Local recent', '2025-01-02T00:00:00.000Z'));

    const { container } = renderEditor({ draftStorageKey });

    await waitFor(() => {
      expectCanvasTitle(container, 'Local recent');
    });
  });

  test('prefers a newer project anime2dDraft over local browser drafts', async () => {
    const draftStorageKey = 'project:project-newer';
    animeDraftStorage.read.mockResolvedValue(makeDraft('IndexedDB old', '2025-01-01T00:00:00.000Z'));
    writeLocalDraft(draftStorageKey, makeDraft('Local old', '2025-01-02T00:00:00.000Z'));

    const { container } = renderEditor({
      draftStorageKey,
      projectDraft: makeDraft('Project recent', '2025-01-03T00:00:00.000Z'),
    });

    await waitFor(() => {
      expectCanvasTitle(container, 'Project recent');
    });
  });

  test('restores localStorage when IndexedDB read fails', async () => {
    const draftStorageKey = 'project:idb-fails';
    animeDraftStorage.read.mockRejectedValue(new Error('IndexedDB blocked'));
    writeLocalDraft(draftStorageKey, makeDraft('Local fallback', '2025-01-02T00:00:00.000Z'));

    const { container } = renderEditor({ draftStorageKey });

    await waitFor(() => {
      expectCanvasTitle(container, 'Local fallback');
    });
  });

  test('keeps the previous fallback order when savedAt is absent', async () => {
    const draftStorageKey = 'project:no-saved-at';
    animeDraftStorage.read.mockResolvedValue(makeDraft('IndexedDB no date'));
    writeLocalDraft(draftStorageKey, makeDraft('Local no date'));

    const { container } = renderEditor({
      draftStorageKey,
      projectDraft: makeDraft('Project no date'),
    });

    await waitFor(() => {
      expectCanvasTitle(container, 'IndexedDB no date');
    });
  });
});
