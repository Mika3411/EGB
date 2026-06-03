import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import FDBObjectStore from 'fake-indexeddb/lib/FDBObjectStore';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AiTab from '../components/AiTab.jsx';
import Character3DTab from '../components/Character3DTab.jsx';
import Decor3DTab from '../components/Decor3DTab.jsx';
import TwoDAnimeEditor from '../components/TwoDAnimeEditor.jsx';
import { readAiDraft, readLocalAiDraft, saveFullAiDraftLocally } from '../components/ai/aiDraftPersistence';
import { createInitialProject } from '../data/projectData';
import useRpg3DSaveSync from '../hooks/rpg3d/useRpg3DSaveSync.js';
import { useLocalAuth } from '../hooks/useLocalAuth';
import { getAiDraftFallbackStorageKey } from '../utils/aiDraftStorageKeys';
import { writeIndexedDraft } from '../utils/indexedDraftStorage';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';
import { createDefaultStudioProject } from '../utils/rpg3dStudioProject.js';
import { getAnime2dDraftStorageKey } from '../utils/storageHelpers';
import {
  cleanupOrphanedRpg3DLocalModelFiles,
  listRpg3DLocalModelFileRecords,
  loadLocalModelFile,
  persistLocalModelFile,
} from '../utils/rpg3dAssetsStorage.js';

const modelImportMocks = vi.hoisted(() => ({
  readCharacterModelImport: vi.fn(async (file) => ({
    zipBundle: null,
    sourceFormat: 'glb',
    isGlb: true,
    optimizedFile: file,
    modelData: '',
    modelFileSize: Number(file?.size) || 0,
  })),
  readDecorModelImport: vi.fn(async (file) => ({
    zipBundle: null,
    sourceFile: file,
    sourceFormat: 'glb',
    isGlb: true,
    optimizedFile: file,
    modelData: '',
    modelDimensions: null,
    modelFileSize: Number(file?.size) || 0,
  })),
}));

vi.mock('../utils/rpg3dModelImport', () => modelImportMocks);

vi.mock('../supabaseStorage', () => ({
  buildStoragePath: (...segments) => segments.filter(Boolean).join('/'),
  deleteStorageFile: vi.fn(),
  downloadTextFile: vi.fn(),
  generateStorageFilename: vi.fn((filename) => filename),
  getPublicStorageUploadResult: vi.fn((path) => ({ path, publicUrl: '', visibility: 'public' })),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
  hasSupabaseAuthConfig: vi.fn(() => false),
  hasSupabaseConfig: vi.fn(() => false),
  hasSupabaseStorageConfig: vi.fn(() => false),
  isStorageObjectAlreadyExistsError: vi.fn(() => false),
  isStorageNotFoundError: vi.fn(() => false),
  uploadToStorage: vi.fn(),
}));

const AI_DRAFT_DB = 'escape-game-builder-ai-drafts';
const ANIME_DRAFT_DB = 'escape-game-builder-2d-anime-drafts';

const installFakeIndexedDb = () => {
  const factory = new FDBFactory();
  vi.stubGlobal('indexedDB', factory);
  vi.stubGlobal('IDBKeyRange', FDBKeyRange);
  Object.defineProperty(window, 'indexedDB', {
    value: factory,
    configurable: true,
  });
  Object.defineProperty(window, 'IDBKeyRange', {
    value: FDBKeyRange,
    configurable: true,
  });
  return factory;
};

const disableIndexedDb = () => {
  vi.stubGlobal('indexedDB', undefined);
  Object.defineProperty(window, 'indexedDB', {
    value: undefined,
    configurable: true,
  });
};

const installObjectUrlMock = () => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((file) => `blob:http://localhost/${encodeURIComponent(file?.name || 'model')}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
};

const getProjectsStorageKey = (userId) => `escapeGameBuilder.projects.${userId}`;

const readLocalProjectCache = (userId) => (
  JSON.parse(window.localStorage.getItem(getProjectsStorageKey(userId)) || '[]')
);

const writeLocalProjectCache = (userId, projects) => {
  window.localStorage.setItem(getProjectsStorageKey(userId), JSON.stringify(projects));
};

const registerLocalUser = async (result, email = 'indexeddb-integration@example.com') => {
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  await act(async () => {
    await result.current.register({
      name: 'IndexedDB Integration',
      email,
      password: 'secret-123',
    });
  });
  await waitFor(() => {
    expect(result.current.user?.id).toBeTruthy();
  });
};

const findProjectDataTitle = (projects, projectId) => (
  projects.find((project) => project.id === projectId)?.data?.title
);

const makeGeneratedProject = (title) => ({
  ...createInitialProject(),
  title,
});

const makeAiDraft = (title, savedAt) => ({
  generatedProject: makeGeneratedProject(title),
  isPatch: false,
  status: `Brouillon ${title}`,
  imageStatus: '',
  sceneVisualConstraints: {},
  imageStylePreset: 'realistic',
  globalVisualStyle: 'Style visuel test',
  savedAt,
});

const stubAiCreditsFetch = () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      balance: 100,
      costs: {
        text: 2,
        image: 5,
        improve: 5,
        objectThumbnail: 1,
        projectGeneration: {
          act: 2,
          scene: 1,
          enigma: 1,
          cinematic: 1,
          item: 1,
          combination: 1,
        },
      },
      nextObjectImageCost: 3,
      objectImagesInCurrentBatch: 0,
      objectImageBatchSize: 4,
    }),
  })));
};

const renderAiDraftTab = ({
  project = createInitialProject(),
  projectStorageKey = 'ai-indexeddb-integration',
  onSaveAiDraft = vi.fn(async () => undefined),
} = {}) => {
  stubAiCreditsFetch();
  return render(
    <AiTab
      project={project}
      getSceneLabel={(sceneOrId) => (
        typeof sceneOrId === 'string'
          ? project.scenes?.find((scene) => scene.id === sceneOrId)?.name || sceneOrId
          : sceneOrId?.name || ''
      )}
      onApplyProject={vi.fn(async () => ({ ok: true, errors: [], warnings: [] }))}
      onSaveAiDraft={onSaveAiDraft}
      projectStorageKey={projectStorageKey}
    />,
  );
};

const makeAnimeDraft = (sceneName, savedAt) => ({
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

const renderAnimeEditor = ({ draftStorageKey, projectDraft = null }) => render(
  <TwoDAnimeEditor
    projectName="Projet Anime Integration"
    projectDraft={projectDraft}
    draftStorageKey={draftStorageKey}
  />,
);

const cloneValue = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const makePatchProjectState = (setProject) => (recipe) => {
  setProject((current) => {
    const draft = cloneValue(current);
    recipe(draft);
    return draft;
  });
};

const renderCharacterImportTab = ({ localModelScope }) => {
  const initialProject = {
    characterModels3d: [{
      id: 'character-import-model',
      name: 'Personnage import',
      role: 'hero',
      shape: 'glb',
    }],
    decorModels3d: [],
  };
  const Wrapper = () => {
    const [project, setProject] = React.useState(initialProject);
    return (
      <Character3DTab
        project={project}
        patchProject={makePatchProjectState(setProject)}
        selectedModelId="character-import-model"
        onSelectedModelIdChange={vi.fn()}
        localModelScope={localModelScope}
      />
    );
  };
  return render(<Wrapper />);
};

const renderDecorImportTab = ({ localModelScope }) => {
  const initialProject = {
    decorModels3d: [{
      id: 'decor-import-model',
      name: 'Decor import',
      kind: 'decor',
      modelUrl: '',
      modelData: '',
    }],
    characterModels3d: [],
  };
  const Wrapper = () => {
    const [project, setProject] = React.useState(initialProject);
    return (
      <Decor3DTab
        project={project}
        patchProject={makePatchProjectState(setProject)}
        selectedModelId="decor-import-model"
        onSelectedModelIdChange={vi.fn()}
        localModelScope={localModelScope}
      />
    );
  };
  return render(<Wrapper />);
};

const expectAnimeTitle = async (container, title) => {
  await waitFor(() => {
    expect(container.querySelector('.anime-title-button')?.textContent).toContain(title);
  });
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('IndexedDB integration persistence', () => {
  test('projects merge IndexedDB and localStorage by autosave freshness', async () => {
    installFakeIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'projects-freshness@example.com');

    let createdProject = null;
    await act(async () => {
      createdProject = await result.current.createProject(createInitialProject(), 'Projet initial');
    });

    const indexedProject = createInitialProject();
    indexedProject.title = 'Version IndexedDB fraiche';
    await act(async () => {
      await result.current.saveProject(indexedProject, createdProject.id, {
        autosaveRevision: 5,
        tab: 'scenes',
      });
    });

    const userId = result.current.user.id;
    writeLocalProjectCache(userId, readLocalProjectCache(userId).map((project) => (
      project.id === createdProject.id
        ? {
          ...project,
          data: { ...project.data, title: 'Version localStorage ancienne' },
          name: 'Version localStorage ancienne',
          uiState: { ...(project.uiState || {}), autosaveRevision: 1 },
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
        : project
    )));

    await act(async () => {
      await result.current.refreshProjects(userId);
    });
    expect(findProjectDataTitle(result.current.projects, createdProject.id)).toBe('Version IndexedDB fraiche');

    writeLocalProjectCache(userId, readLocalProjectCache(userId).map((project) => (
      project.id === createdProject.id
        ? {
          ...project,
          data: { ...project.data, title: 'Version localStorage fraiche' },
          name: 'Version localStorage fraiche',
          uiState: { ...(project.uiState || {}), autosaveRevision: 9 },
          updatedAt: '2026-02-01T00:00:00.000Z',
        }
        : project
    )));

    await act(async () => {
      await result.current.refreshProjects(userId);
    });
    expect(findProjectDataTitle(result.current.projects, createdProject.id)).toBe('Version localStorage fraiche');
  });

  test('projects remain readable from localStorage when IndexedDB disappears after a save', async () => {
    installFakeIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'projects-no-idb@example.com');

    let createdProject = null;
    await act(async () => {
      createdProject = await result.current.createProject(createInitialProject(), 'Projet initial');
    });

    const latestProject = createInitialProject();
    latestProject.title = 'Projet relu sans IndexedDB';
    await act(async () => {
      await result.current.saveProject(latestProject, createdProject.id, {
        autosaveRevision: 7,
        tab: 'scenes',
      }, { localOnly: true });
    });

    const userId = result.current.user.id;
    disableIndexedDb();

    await act(async () => {
      await result.current.refreshProjects(userId);
    });

    expect(findProjectDataTitle(result.current.projects, createdProject.id)).toBe('Projet relu sans IndexedDB');
  });

  test('AI drafts restore the freshest browser or project draft without mocking IndexedDB helpers', async () => {
    installFakeIndexedDb();
    const projectStorageKey = 'ai-freshness';
    const aiDraftKey = `ai-draft:${projectStorageKey}`;
    const localDraftKey = getAiDraftFallbackStorageKey(aiDraftKey);
    await writeIndexedDraft(AI_DRAFT_DB, aiDraftKey, makeAiDraft('IndexedDB ancien', '2026-01-01T00:00:00.000Z'));
    window.localStorage.setItem(localDraftKey, JSON.stringify(makeAiDraft('localStorage recent', '2026-01-02T00:00:00.000Z')));

    renderAiDraftTab({ projectStorageKey });

    await waitFor(() => {
      expect(screen.getByText('Brouillon localStorage recent')).toBeTruthy();
    });

    cleanup();
    window.localStorage.clear();
    installFakeIndexedDb();
    await writeIndexedDraft(AI_DRAFT_DB, aiDraftKey, makeAiDraft('IndexedDB ancien', '2026-01-01T00:00:00.000Z'));
    window.localStorage.setItem(localDraftKey, JSON.stringify(makeAiDraft('localStorage recent', '2026-01-02T00:00:00.000Z')));

    renderAiDraftTab({
      projectStorageKey,
      project: {
        ...createInitialProject(),
        aiDraft: makeAiDraft('projet plus recent', '2026-01-03T00:00:00.000Z'),
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Brouillon projet plus recent')).toBeTruthy();
    });
  });

  test('AI drafts restore the localStorage fallback when IndexedDB is unavailable', async () => {
    disableIndexedDb();
    const projectStorageKey = 'ai-no-indexeddb';
    const aiDraftKey = `ai-draft:${projectStorageKey}`;
    window.localStorage.setItem(
      getAiDraftFallbackStorageKey(aiDraftKey),
      JSON.stringify(makeAiDraft('fallback sans IndexedDB', '2026-01-04T00:00:00.000Z')),
    );

    renderAiDraftTab({ projectStorageKey });

    await waitFor(() => {
      expect(screen.getByText('Brouillon fallback sans IndexedDB')).toBeTruthy();
    });
  });

  test('AI draft saves keep localStorage current when IndexedDB succeeds', async () => {
    installFakeIndexedDb();
    const aiDraftKey = 'ai-draft:ai-indexeddb-success';
    const draft = makeAiDraft('fallback maintenu', '2026-01-05T00:00:00.000Z');

    await expect(saveFullAiDraftLocally(aiDraftKey, draft)).resolves.toBe(true);
    await expect(readAiDraft(aiDraftKey)).resolves.toMatchObject({
      generatedProject: { title: 'fallback maintenu' },
      savedAt: '2026-01-05T00:00:00.000Z',
    });

    disableIndexedDb();
    expect(readLocalAiDraft(aiDraftKey)).toMatchObject({
      generatedProject: { title: 'fallback maintenu' },
      savedAt: '2026-01-05T00:00:00.000Z',
    });
  });

  test('AI draft deletion reports partial local failures while still clearing project copy', async () => {
    installFakeIndexedDb();
    const projectStorageKey = 'ai-delete-partial';
    const aiDraftKey = `ai-draft:${projectStorageKey}`;
    const localDraftKey = getAiDraftFallbackStorageKey(aiDraftKey);
    const onSaveAiDraft = vi.fn(async () => undefined);
    await writeIndexedDraft(AI_DRAFT_DB, aiDraftKey, makeAiDraft('a supprimer', '2026-01-01T00:00:00.000Z'));
    window.localStorage.setItem(localDraftKey, JSON.stringify(makeAiDraft('a supprimer', '2026-01-01T00:00:00.000Z')));

    const { unmount } = renderAiDraftTab({ projectStorageKey, onSaveAiDraft });
    await waitFor(() => {
      expect(screen.getByText('Brouillon a supprimer')).toBeTruthy();
    });

    const originalRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function removeItem(key) {
      if (key === localDraftKey) throw new Error('localStorage blocked');
      return originalRemoveItem.call(this, key);
    });

    fireEvent.click(screen.getByRole('button', { name: /Nouveau brouillon/i }));

    await waitFor(() => {
      expect(screen.getByText(/suppression incomplete: localStorage/i)).toBeTruthy();
    });
    expect(onSaveAiDraft).toHaveBeenCalledWith(null);
    expect(window.localStorage.getItem(localDraftKey)).not.toBeNull();
    unmount();
  });

  test('2D Anime drafts choose the freshest source and fall back to localStorage without IndexedDB', async () => {
    installFakeIndexedDb();
    const draftStorageId = 'project:anime-freshness';
    const storageKey = getAnime2dDraftStorageKey(draftStorageId);
    await writeIndexedDraft(ANIME_DRAFT_DB, storageKey, makeAnimeDraft('IndexedDB ancien', '2026-01-01T00:00:00.000Z'));
    window.localStorage.setItem(storageKey, JSON.stringify(makeAnimeDraft('localStorage recent', '2026-01-02T00:00:00.000Z')));

    let view = renderAnimeEditor({ draftStorageKey: draftStorageId });
    await expectAnimeTitle(view.container, 'localStorage recent');
    cleanup();
    window.localStorage.clear();

    installFakeIndexedDb();
    await writeIndexedDraft(ANIME_DRAFT_DB, storageKey, makeAnimeDraft('IndexedDB ancien', '2026-01-01T00:00:00.000Z'));
    window.localStorage.setItem(storageKey, JSON.stringify(makeAnimeDraft('localStorage recent', '2026-01-02T00:00:00.000Z')));
    view = renderAnimeEditor({
      draftStorageKey: draftStorageId,
      projectDraft: makeAnimeDraft('projet plus recent', '2026-01-03T00:00:00.000Z'),
    });
    await expectAnimeTitle(view.container, 'projet plus recent');
    cleanup();
    window.localStorage.clear();

    disableIndexedDb();
    window.localStorage.setItem(storageKey, JSON.stringify(makeAnimeDraft('fallback localStorage', '2026-01-04T00:00:00.000Z')));
    view = renderAnimeEditor({ draftStorageKey: draftStorageId });
    await expectAnimeTitle(view.container, 'fallback localStorage');
  });

  test('2D Anime drafts keep IndexedDB first when savedAt is absent', async () => {
    installFakeIndexedDb();
    const draftStorageId = 'project:anime-no-saved-at';
    const storageKey = getAnime2dDraftStorageKey(draftStorageId);
    await writeIndexedDraft(ANIME_DRAFT_DB, storageKey, makeAnimeDraft('IndexedDB sans date'));
    window.localStorage.setItem(storageKey, JSON.stringify(makeAnimeDraft('localStorage sans date')));

    const view = renderAnimeEditor({
      draftStorageKey: draftStorageId,
      projectDraft: makeAnimeDraft('projet sans date'),
    });

    await expectAnimeTitle(view.container, 'IndexedDB sans date');
  });

  test('RPG 3D character and decor imports persist scoped local model records', async () => {
    installFakeIndexedDb();
    installObjectUrlMock();
    const localModelScope = { projectId: 'project-import-scope', userId: 'user-import-scope' };

    const characterView = renderCharacterImportTab({ localModelScope });
    fireEvent.change(characterView.container.querySelector('input[type="file"]'), {
      target: {
        files: [new File(['character-glb'], 'character.glb', { type: 'model/gltf-binary' })],
      },
    });

    await waitFor(async () => {
      const records = await listRpg3DLocalModelFileRecords();
      expect(records.some((record) => (
        record.id.includes('character')
        && record.projectId === localModelScope.projectId
        && record.userId === localModelScope.userId
      ))).toBe(true);
    }, { timeout: 5000 });
    characterView.unmount();

    const decorView = renderDecorImportTab({ localModelScope });
    fireEvent.change(decorView.container.querySelector('input[type="file"]'), {
      target: {
        files: [new File(['decor-glb'], 'decor.glb', { type: 'model/gltf-binary' })],
      },
    });

    await waitFor(async () => {
      const records = await listRpg3DLocalModelFileRecords();
      expect(records.some((record) => (
        record.id.includes('decor')
        && record.projectId === localModelScope.projectId
        && record.userId === localModelScope.userId
      ))).toBe(true);
    }, { timeout: 5000 });
  });

  test('RPG 3D local model cleanup deletes only current scoped orphans in real IndexedDB', async () => {
    installFakeIndexedDb();
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterLocalModelFileId = 'project-a-live';

    await persistLocalModelFile('project-a-live', new File(['live-a'], 'live-a.glb'), {
      projectId: 'project-a',
      userId: 'user-a',
    });
    await persistLocalModelFile('project-a-orphan', new File(['orphan-a'], 'orphan-a.glb'), {
      projectId: 'project-a',
      userId: 'user-a',
    });
    await persistLocalModelFile('project-b-orphan', new File(['orphan-b'], 'orphan-b.glb'), {
      projectId: 'project-b',
      userId: 'user-a',
    });
    await persistLocalModelFile('legacy-unscoped', new File(['legacy'], 'legacy.glb'));

    const result = await cleanupOrphanedRpg3DLocalModelFiles({
      config,
      studioProject: createDefaultStudioProject(),
    }, {
      scope: { projectId: 'project-a', userId: 'user-a' },
    });

    expect(result).toMatchObject({
      deletedCount: 1,
      protectedIds: expect.arrayContaining(['project-b-orphan', 'legacy-unscoped']),
    });
    expect(await loadLocalModelFile('project-a-live')).toBeTruthy();
    expect(await loadLocalModelFile('project-a-orphan')).toBeNull();
    expect(await loadLocalModelFile('project-b-orphan')).toBeTruthy();
    expect(await loadLocalModelFile('legacy-unscoped')).toBeTruthy();
  });

  test('RPG 3D save cleanup uses the active project record id when project data has no id', async () => {
    installFakeIndexedDb();
    const user = { id: 'user-flow-scope' };
    const projectId = 'project-record-a';
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    const studioProject = createDefaultStudioProject();
    const configRef = { current: config };
    const studioProjectRef = { current: studioProject };
    const lastSavedAutosaveVersionRef = { current: 0 };

    await persistLocalModelFile('flow-current-orphan', new File(['current'], 'current.glb'), {
      projectId,
      userId: user.id,
    });
    await persistLocalModelFile('flow-other-project-orphan', new File(['other'], 'other.glb'), {
      projectId: 'project-record-b',
      userId: user.id,
    });

    const { result } = renderHook(() => useRpg3DSaveSync({
      authReady: true,
      autosaveVersionRef: { current: 1 },
      clearHistoryStacks: vi.fn(),
      configRef,
      lastSavedAutosaveVersionRef,
      project: createInitialProject(),
      projectId,
      resetGame: vi.fn(),
      savedArcadeAssets: null,
      setConfig: vi.fn((nextConfig) => {
        configRef.current = typeof nextConfig === 'function' ? nextConfig(configRef.current) : nextConfig;
      }),
      setStudioProject: vi.fn((nextProject) => {
        studioProjectRef.current = typeof nextProject === 'function' ? nextProject(studioProjectRef.current) : nextProject;
      }),
      studioProject,
      studioProjectRef,
      syncActiveCanvasConfigInRef: vi.fn(() => studioProjectRef.current),
      user,
      workspaceTab: 'arcade',
    }));

    await act(async () => {
      await result.current.saveArcadeAssets({ localOnly: true });
    });

    await waitFor(async () => {
      expect(await loadLocalModelFile('flow-current-orphan')).toBeNull();
    }, { timeout: 5000 });
    expect(await loadLocalModelFile('flow-other-project-orphan')).toBeTruthy();
    expect(lastSavedAutosaveVersionRef.current).toBe(1);
  });

  test('RPG 3D local model persistence returns false when a transaction aborts after request success', async () => {
    installFakeIndexedDb();
    const originalPut = FDBObjectStore.prototype.put;
    vi.spyOn(FDBObjectStore.prototype, 'put').mockImplementation(function putWithAbort(...args) {
      const request = originalPut.apply(this, args);
      let successHandler = null;
      Object.defineProperty(request, 'onsuccess', {
        configurable: true,
        get: () => successHandler,
        set: (handler) => {
          successHandler = function wrappedSuccess(event) {
            handler?.call(this, event);
            request.transaction.abort();
          };
        },
      });
      return request;
    });

    await expect(persistLocalModelFile('aborted-model', new File(['aborted'], 'aborted.glb'), {
      projectId: 'project-abort',
      userId: 'user-a',
    })).resolves.toBe(false);

    expect(await loadLocalModelFile('aborted-model')).toBeNull();
  });
});
