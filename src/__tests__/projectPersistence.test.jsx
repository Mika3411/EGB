import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createInitialProject } from '../data/projectData';
import { useLocalAuth } from '../hooks/useLocalAuth';

vi.mock('../supabaseStorage', () => ({
  buildStoragePath: (...segments) => segments.filter(Boolean).join('/'),
  deleteStorageFile: vi.fn(),
  downloadTextFile: vi.fn(),
  getPublicStorageUploadResult: vi.fn((path) => ({ path, publicUrl: '', visibility: 'public' })),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
  hasSupabaseAuthConfig: vi.fn(() => false),
  hasSupabaseStorageConfig: vi.fn(() => false),
  isStorageObjectAlreadyExistsError: vi.fn(() => false),
  isStorageNotFoundError: vi.fn(() => false),
  uploadToStorage: vi.fn(),
}));

const makeLargeMediaProject = (title = 'Projet media lourd') => {
  const project = createInitialProject();
  project.title = title;
  project.scenes[0].backgroundData = `data:image/png;base64,${'a'.repeat(210_000)}`;
  return project;
};

const cloneValue = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const createMemoryIndexedDb = () => {
  const databases = new Map();

  const makeRequest = (transaction, runner) => {
    const request = {};
    transaction._pending += 1;
    queueMicrotask(() => {
      try {
        request.result = runner();
        request.onsuccess?.();
      } catch (error) {
        request.error = error;
        transaction.error = error;
        request.onerror?.();
        transaction.onerror?.();
      } finally {
        transaction._pending -= 1;
        transaction._scheduleComplete();
      }
    });
    return request;
  };

  const createStoreApi = (store, options, transaction) => {
    const getKey = (value, key) => {
      if (typeof key !== 'undefined') return key;
      if (options?.keyPath) return value?.[options.keyPath];
      return undefined;
    };

    return {
      delete: (key) => makeRequest(transaction, () => {
        store.delete(key);
        return undefined;
      }),
      get: (key) => makeRequest(transaction, () => cloneValue(store.get(key))),
      getAllKeys: () => makeRequest(transaction, () => Array.from(store.keys())),
      openCursor: () => {
        const request = {};
        const entries = Array.from(store.entries());
        let index = 0;
        transaction._pending += 1;
        const advance = () => {
          queueMicrotask(() => {
            if (index >= entries.length) {
              request.result = null;
              request.onsuccess?.();
              transaction._pending -= 1;
              transaction._scheduleComplete();
              return;
            }
            const [key, value] = entries[index];
            index += 1;
            request.result = {
              key,
              value: cloneValue(value),
              continue: advance,
            };
            request.onsuccess?.();
          });
        };
        advance();
        return request;
      },
      put: (value, key) => makeRequest(transaction, () => {
        const resolvedKey = getKey(value, key);
        if (typeof resolvedKey === 'undefined') throw new Error('IndexedDB key missing');
        store.set(resolvedKey, cloneValue(value));
        return resolvedKey;
      }),
    };
  };

  const createDbHandle = (dbData) => ({
    close: vi.fn(),
    createObjectStore: (storeName, options = {}) => {
      if (!dbData.stores.has(storeName)) dbData.stores.set(storeName, new Map());
      dbData.storeOptions.set(storeName, options);
      return {};
    },
    objectStoreNames: {
      contains: (storeName) => dbData.stores.has(storeName),
    },
    transaction: (storeName) => {
      const store = dbData.stores.get(storeName);
      const options = dbData.storeOptions.get(storeName) || {};
      if (!store) throw new Error(`Object store not found: ${storeName}`);
      const transaction = {
        _completed: false,
        _pending: 0,
        _scheduleComplete() {
          queueMicrotask(() => {
            if (this._completed || this._pending > 0 || this.error) return;
            this._completed = true;
            this.oncomplete?.();
          });
        },
        error: null,
        objectStore: () => createStoreApi(store, options, transaction),
      };
      return transaction;
    },
  });

  const indexedDb = {
    getStore: (dbName, storeName) => databases.get(dbName)?.stores.get(storeName) || new Map(),
    open: (dbName, version) => {
      const request = {};
      queueMicrotask(() => {
        const isNew = !databases.has(dbName);
        if (isNew) {
          databases.set(dbName, {
            stores: new Map(),
            storeOptions: new Map(),
            version,
          });
        }
        const dbData = databases.get(dbName);
        request.result = createDbHandle(dbData);
        if (isNew) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };

  return indexedDb;
};

const useMemoryIndexedDb = () => {
  const indexedDb = createMemoryIndexedDb();
  vi.stubGlobal('indexedDB', indexedDb);
  return indexedDb;
};

const getProjectsStorageKey = (userId) => `escapeGameBuilder.projects.${userId}`;

const readLocalProjectCache = (userId) => (
  JSON.parse(window.localStorage.getItem(getProjectsStorageKey(userId)) || '[]')
);

const writeLocalProjectCache = (userId, projects) => {
  window.localStorage.setItem(getProjectsStorageKey(userId), JSON.stringify(projects));
};

const registerLocalUser = async (result, email = 'persistence@example.com') => {
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  await act(async () => {
    await result.current.register({
      name: 'Persistence',
      email,
      password: 'secret-123',
    });
  });
  await waitFor(() => {
    expect(result.current.user?.id).toBeTruthy();
  });
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('indexedDB', undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('project persistence outside RPG 3D', () => {
  test('useLocalAuth refuse une creation explicite quand seul un cache local incomplet existe', async () => {
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result);
    const userId = result.current.user.id;

    await expect(act(async () => {
      await result.current.createProject(makeLargeMediaProject(), 'Projet quota');
    })).rejects.toMatchObject({
      code: 'non-durable-project-save',
      syncStatus: expect.objectContaining({
        localCacheSaved: true,
        localPartial: true,
        localSaved: false,
        remoteSaved: false,
      }),
    });

    expect(result.current.projects).toEqual([]);
    const partialCache = JSON.parse(
      window.localStorage.getItem(`escapeGameBuilder.projects.${userId}`),
    );
    expect(partialCache[0].data.scenes[0].backgroundData).toBe('');
  });

  test('useLocalAuth garde allowPartial pour autosave afin de signaler puis retenter', async () => {
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'autosave-partial@example.com');

    await act(async () => {
      await result.current.createProject(createInitialProject(), 'Projet durable');
    });
    await waitFor(() => {
      expect(result.current.activeProjectId).toBeTruthy();
    });

    let saveResult = null;
    await act(async () => {
      saveResult = await result.current.saveProject(
        makeLargeMediaProject('Projet autosave lourd'),
        result.current.activeProjectId,
        { tab: 'scenes' },
        { allowPartial: true, localOnly: true },
      );
    });

    expect(saveResult.syncStatus).toMatchObject({
      localCacheSaved: true,
      localPartial: true,
      localSaved: false,
      remoteSaved: false,
    });
    expect(result.current.projects[0].data.scenes[0].backgroundData).toMatch(/^data:image\/png;base64,/);
  });

  test('fusionne les projets en gardant IndexedDB quand il est plus recent que localStorage', async () => {
    useMemoryIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'idb-newer@example.com');
    let createdProject = null;

    await act(async () => {
      createdProject = await result.current.createProject(createInitialProject(), 'Projet initial');
    });

    const indexedProject = createInitialProject();
    indexedProject.title = 'Version IndexedDB recente';
    await act(async () => {
      await result.current.saveProject(indexedProject, createdProject.id, {
        autosaveRevision: 5,
        tab: 'scenes',
      });
    });

    const userId = result.current.user.id;
    const cache = readLocalProjectCache(userId);
    writeLocalProjectCache(userId, cache.map((project) => (
      project.id === createdProject.id
        ? {
          ...project,
          data: { ...project.data, title: 'Version localStorage ancienne' },
          name: 'Version localStorage ancienne',
          uiState: { ...(project.uiState || {}), autosaveRevision: 1 },
          updatedAt: '2020-01-01T00:00:00.000Z',
        }
        : project
    )));

    await act(async () => {
      await result.current.refreshProjects(userId);
    });

    expect(result.current.projects.find((project) => project.id === createdProject.id)?.data.title)
      .toBe('Version IndexedDB recente');
  });

  test('fusionne les projets en gardant localStorage quand il est plus recent que IndexedDB', async () => {
    useMemoryIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'local-newer@example.com');
    let createdProject = null;

    await act(async () => {
      createdProject = await result.current.createProject(createInitialProject(), 'Projet initial');
    });

    const indexedProject = createInitialProject();
    indexedProject.title = 'Version IndexedDB ancienne';
    await act(async () => {
      await result.current.saveProject(indexedProject, createdProject.id, {
        autosaveRevision: 2,
        tab: 'scenes',
      });
    });

    const userId = result.current.user.id;
    const cache = readLocalProjectCache(userId);
    writeLocalProjectCache(userId, cache.map((project) => (
      project.id === createdProject.id
        ? {
          ...project,
          data: { ...project.data, title: 'Version localStorage recente' },
          name: 'Version localStorage recente',
          uiState: { ...(project.uiState || {}), autosaveRevision: 9 },
          updatedAt: '2030-01-01T00:00:00.000Z',
        }
        : project
    )));

    await act(async () => {
      await result.current.refreshProjects(userId);
    });

    expect(result.current.projects.find((project) => project.id === createdProject.id)?.data.title)
      .toBe('Version localStorage recente');
  });

  test('garde un fallback localStorage utilisable si IndexedDB devient indisponible apres sauvegarde', async () => {
    useMemoryIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'idb-then-local@example.com');
    let createdProject = null;

    await act(async () => {
      createdProject = await result.current.createProject(createInitialProject(), 'Projet initial');
    });

    const latestProject = createInitialProject();
    latestProject.title = 'Version fallback localStorage';
    await act(async () => {
      await result.current.saveProject(
        latestProject,
        createdProject.id,
        { autosaveRevision: 7, tab: 'scenes' },
        { localOnly: true },
      );
    });

    const userId = result.current.user.id;
    vi.stubGlobal('indexedDB', undefined);

    await act(async () => {
      await result.current.refreshProjects(userId);
    });

    expect(result.current.projects.find((project) => project.id === createdProject.id)?.data.title)
      .toBe('Version fallback localStorage');
  });

  test('conserve les gros medias dans IndexedDB tout en gardant localStorage slim', async () => {
    const indexedDb = useMemoryIndexedDb();
    const { result } = renderHook(() => useLocalAuth());
    await registerLocalUser(result, 'large-media-idb@example.com');
    let createdProject = null;

    await act(async () => {
      createdProject = await result.current.createProject(makeLargeMediaProject(), 'Projet media durable');
    });

    const userId = result.current.user.id;
    const localProject = readLocalProjectCache(userId).find((project) => project.id === createdProject.id);
    expect(localProject.data.scenes[0].backgroundData).toBe('');

    const indexedProject = indexedDb
      .getStore('escape-game-builder-projects', 'project-lists')
      .get(`project:${userId}:${createdProject.id}`);
    expect(indexedProject.data.scenes[0].backgroundData).toMatch(/^data:image\/png;base64,/);
  });
});
