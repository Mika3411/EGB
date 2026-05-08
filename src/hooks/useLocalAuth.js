import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getProjectMetaForUser,
  getSessionUser,
  isAdminAccount,
  isPasswordRecoverySession,
  loadProjectForUser,
  loadProjectRecordsForUser,
  loginUser,
  logoutUser,
  registerUser,
  saveProjectRecordsForUser,
  sendPasswordResetEmail,
  supabaseUserToAccount,
  updateCurrentUserPassword,
} from '../lib/authStorage';
import { getAuthorProfile, saveAuthorProfile } from '../lib/authorProfiles';
import { getSupabaseClient, hasSupabaseConfig } from '../supabaseStorage';
import { migrateProjectAssetReferences } from '../lib/assetManager';

const PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';
const ACTIVE_PROJECT_KEY_PREFIX = 'escapeGameBuilder.activeProject';
const PROJECTS_DB_NAME = 'escape-game-builder-projects';
const PROJECTS_DB_STORE = 'project-lists';
const PROJECT_PUBLICATION_ENDPOINT = import.meta.env.VITE_PROJECT_PUBLICATION_ENDPOINT || '/api/projects/publication';

const nowIso = () => new Date().toISOString();
const PROJECT_MODE_RANKS = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const getProjectsKey = (userId) => `${PROJECTS_KEY_PREFIX}.${userId}`;
const getActiveProjectKey = (userId) => `${ACTIVE_PROJECT_KEY_PREFIX}.${userId}`;

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const openProjectsDb = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB indisponible'));
    return;
  }
  const request = indexedDB.open(PROJECTS_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(PROJECTS_DB_STORE)) {
      db.createObjectStore(PROJECTS_DB_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible'));
});

const readProjectsFromIndexedDb = async (userId) => {
  if (!userId) return [];
  try {
    const db = await openProjectsDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_DB_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_DB_STORE);
      const request = store.get(userId);
      request.onsuccess = () => {
        const value = request.result;
        resolve(Array.isArray(value) ? value.map(normalizeProjectRecord) : []);
      };
      request.onerror = () => reject(request.error || new Error('Lecture IndexedDB impossible'));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch {
    return [];
  }
};

const writeProjectsToIndexedDb = async (userId, projects) => {
  if (!userId) return false;
  try {
    const db = await openProjectsDb();
    const storableProjects = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_DB_STORE, 'readwrite');
      const store = transaction.objectStore(PROJECTS_DB_STORE);
      const request = store.put(storableProjects, userId);
      request.onerror = () => reject(request.error || new Error('Ecriture IndexedDB impossible'));
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error('Transaction IndexedDB impossible'));
      };
    });
  } catch (error) {
    console.warn('Sauvegarde IndexedDB impossible.', error);
    return false;
  }
};

const getProjectTitle = (project, fallback = 'Projet sans titre') =>
  project?.title?.trim?.() || project?.name?.trim?.() || fallback;

const cloneProjectData = (data) => JSON.parse(JSON.stringify(data || {}));

const LARGE_MEDIA_FIELD_PATTERN = /^(backgroundData|imageData|objectImageData|popupImageData|popupBackgroundData|musicData|soundData|videoData|videoPoster|audioData)$/i;
const LARGE_EMBEDDED_MEDIA_LENGTH = 200_000;

const stripLargeMediaForLocalCache = (value) => {
  if (Array.isArray(value)) return value.map(stripLargeMediaForLocalCache);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (LARGE_MEDIA_FIELD_PATTERN.test(key) || /^(src|originalSrc)$/i.test(key)) {
      return [key, typeof entry === 'string' && entry.startsWith('http') ? entry : ''];
    }
    return [key, stripLargeMediaForLocalCache(entry)];
  }));
};

const hasLargeEmbeddedMedia = (value, key = '') => {
  if (typeof value === 'string') {
    return value.length > LARGE_EMBEDDED_MEDIA_LENGTH
      && (value.startsWith('data:') || LARGE_MEDIA_FIELD_PATTERN.test(key) || /^(src|originalSrc)$/i.test(key));
  }
  if (Array.isArray(value)) return value.some((entry) => hasLargeEmbeddedMedia(entry, key));
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([entryKey, entry]) => hasLargeEmbeddedMedia(entry, entryKey));
};

const slimProjectForLocalCache = (project) => ({
  ...project,
  thumbnail: typeof project.thumbnail === 'string' && project.thumbnail.startsWith('http') ? project.thumbnail : '',
  data: stripLargeMediaForLocalCache({
    ...(project.data || {}),
    aiDraft: project.data?.aiDraft ? {
      ...project.data.aiDraft,
      generatedProject: null,
      status: project.data.aiDraft.status,
      savedAt: project.data.aiDraft.savedAt,
    } : null,
  }),
});

const getAnime2dDraftMeta = (draft) => draft ? {
  savedAt: draft.savedAt || new Date().toISOString(),
  title: draft.sceneName || draft.projectName || 'Projet 2D Anime',
  layerCount: Array.isArray(draft.layers) ? draft.layers.length : 0,
  stepCount: Array.isArray(draft.cinematicSteps) ? draft.cinematicSteps.length : 0,
} : null;

const stripAnime2dDraftForProjectStorage = (project = {}) => {
  const { anime2dDraft, ...projectWithoutDraft } = project || {};
  if (!anime2dDraft) return projectWithoutDraft;
  return {
    ...projectWithoutDraft,
    anime2dDraftMeta: getAnime2dDraftMeta(anime2dDraft),
  };
};

const getProjectThumbnail = (project = {}) => {
  const startScene = Array.isArray(project.scenes) ?
     project.scenes.find((scene) => scene.id === project.start?.targetSceneId)
    : null;
  const candidates = [
    startScene?.backgroundData,
    ...(project.scenes || []).flatMap((scene) => [
      scene.backgroundData,
      ...(scene.sceneObjects || []).map((object) => object.imageData),
      ...(scene.hotspots || []).map((hotspot) => hotspot.objectImageData),
    ]),
    ...(project.cinematics || []).flatMap((cinematic) => [
      cinematic.videoPoster,
      ...(cinematic.slides || []).map((slide) => slide.imageData),
    ]),
    ...(project.enigmas || []).map((enigma) => enigma.imageData),
    ...(project.items || []).map((item) => item.imageData),
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
};

const normalizeProjectRecord = (record) => {
  const data = record?.data || record?.project || record || {};
  const createdAt = record?.createdAt || record?.created_at || nowIso();
  const updatedAt = record?.updatedAt || record?.updated_at || createdAt;

  return {
    id: record?.id || createId(),
    name: record?.name || getProjectTitle(data),
    thumbnail: record?.thumbnail || record?.thumbnailUrl || record?.thumbnail_url || getProjectThumbnail(data),
    uiState: record?.uiState || record?.ui_state || {},
    shareState: record?.shareState || record?.share_state || { isPublic: false, copiedAt: '' },
    createdAt,
    updatedAt,
    data,
  };
};

const sanitizeProjectRecordForStorage = (record) => {
  const normalized = normalizeProjectRecord(record);
  const data = stripAnime2dDraftForProjectStorage(normalized.data);
  return {
    ...normalized,
    name: normalized.name || getProjectTitle(data),
    thumbnail: getProjectThumbnail(data) || normalized.thumbnail || '',
    data,
  };
};

const readProjects = (userId) => {
  if (!userId) return [];
  const rawProjects = safeParse(localStorage.getItem(getProjectsKey(userId)), []);
  return Array.isArray(rawProjects) ? rawProjects.map(sanitizeProjectRecordForStorage) : [];
};

const readPersistedProjects = async (userId) => {
  const indexedProjects = await readProjectsFromIndexedDb(userId);
  if (indexedProjects.length > 0) return indexedProjects;
  return readProjects(userId);
};

const writeProjects = (userId, projects) => {
  const storableProjects = Array.isArray(projects) ? projects.map(sanitizeProjectRecordForStorage) : [];
  const cacheProjects = storableProjects.some((project) => hasLargeEmbeddedMedia(project.data))
    ? storableProjects.map(slimProjectForLocalCache)
    : storableProjects;
  try {
    localStorage.setItem(getProjectsKey(userId), JSON.stringify(cacheProjects));
    return true;
  } catch {
    const slimProjects = storableProjects.map(slimProjectForLocalCache);
    try {
      localStorage.setItem(getProjectsKey(userId), JSON.stringify(slimProjects));
      return true;
    } catch (error) {
      console.warn('Cache local projets trop volumineux.', error);
      return false;
    }
  }
};

const persistProjects = async (userId, projects, options = {}) => {
  const fullProjects = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
  const storableProjects = fullProjects.map(sanitizeProjectRecordForStorage);
  const remoteProjects = storableProjects.some((project) => hasLargeEmbeddedMedia(project.data))
    ? storableProjects.map(slimProjectForLocalCache)
    : storableProjects;
  const indexedSaved = await writeProjectsToIndexedDb(userId, fullProjects);
  const localSaved = writeProjects(userId, remoteProjects);
  try {
    await saveProjectRecordsForUser(userId, remoteProjects, options);
  } catch (error) {
    if (options.requirePublicIndex || (!indexedSaved && !localSaved)) {
      throw error;
    }
    console.warn('Sauvegarde distante indisponible, brouillon conserve localement.', error);
  }
  return fullProjects;
};

const cacheProjectsLocally = async (userId, projects) => {
  const fullProjects = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
  const storableProjects = fullProjects.map(sanitizeProjectRecordForStorage);
  const cacheProjects = storableProjects.some((project) => hasLargeEmbeddedMedia(project.data))
    ? storableProjects.map(slimProjectForLocalCache)
    : storableProjects;
  await writeProjectsToIndexedDb(userId, fullProjects);
  writeProjects(userId, cacheProjects);
  return fullProjects;
};

const readActiveProjectId = (userId) => localStorage.getItem(getActiveProjectKey(userId)) || '';
const writeActiveProjectId = (userId, projectId) => {
  if (!projectId) localStorage.removeItem(getActiveProjectKey(userId));
  else localStorage.setItem(getActiveProjectKey(userId), projectId);
};

export function useLocalAuth() {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [projectMeta, setProjectMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [authorProfile, setAuthorProfile] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const projectsRef = useRef(projects);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const refreshProjects = async (userId = user?.id) => {
    if (!userId) {
      setProjects([]);
      setActiveProjectId('');
      return [];
    }

    const nextProjects = (await readPersistedProjects(userId)).sort(
      (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    );
    const storedActiveProjectId = readActiveProjectId(userId);
    const nextActiveProjectId = nextProjects.some((project) => project.id === storedActiveProjectId) ?
       storedActiveProjectId
      : nextProjects[0]?.id || '';

    setProjects(nextProjects);
    setActiveProjectId(nextActiveProjectId);
    if (nextActiveProjectId) writeActiveProjectId(userId, nextActiveProjectId);
    return nextProjects;
  };

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const sessionUser = await getSessionUser();
        if (!isMounted) return;
        setIsPasswordRecovery(isPasswordRecoverySession());
        setUser(sessionUser);
        if (sessionUser?.id) setAuthorProfile(getAuthorProfile(sessionUser.id, sessionUser));
      } catch (error) {
        console.warn('Session indisponible au démarrage.', error);
        if (isMounted) {
          setIsPasswordRecovery(isPasswordRecoverySession());
          setUser(null);
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    }

    hydrateSession();

    let subscription = null;
    if (hasSupabaseConfig()) {
      const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        const sessionUser = supabaseUserToAccount(session?.user);
        if (!sessionUser && _event !== 'SIGNED_OUT') return;
        setUser(sessionUser);
        if (sessionUser?.id) setAuthorProfile(getAuthorProfile(sessionUser.id, sessionUser));
        if (_event === 'SIGNED_OUT') {
          setProjects([]);
          setActiveProjectId('');
          setAuthorProfile(null);
        }
      });
      subscription = data?.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateUserProjects() {
      if (!user?.id) {
        if (isMounted) {
          setProjectMeta(null);
          setProjects([]);
          setActiveProjectId('');
        }
        return;
      }

      let localProjects = await readPersistedProjects(user.id);
      await refreshProjects(user.id);

      try {
        const nextMeta = await getProjectMetaForUser(user.id);
        if (isMounted) setProjectMeta(nextMeta);

        if (localProjects.length > 0) {
          await persistProjects(user.id, localProjects);
        } else {
          const remoteProjects = await loadProjectRecordsForUser(user.id);
          if (Array.isArray(remoteProjects) && remoteProjects.length > 0) {
            localProjects = remoteProjects.map(sanitizeProjectRecordForStorage);
            await persistProjects(user.id, localProjects);
          }
        }

        // Migration douce : si la nouvelle liste locale est vide,
        // on récupère l'ancien projet sauvegardé côté Supabase/authStorage
        // pour qu'il apparaisse dans la ProfilePage au lieu d'afficher 0 projet.
        if (localProjects.length === 0) {
          const legacyProject = await loadProjectForUser(user.id);

          if (legacyProject && isMounted) {
            const timestamp = nextMeta?.updatedAt || nextMeta?.updated_at || nowIso();
            const migratedProject = normalizeProjectRecord({
              id: nextMeta?.id || createId(),
              name: nextMeta?.name || getProjectTitle(legacyProject, 'Projet récupéré'),
              createdAt: nextMeta?.createdAt || nextMeta?.created_at || timestamp,
              updatedAt: timestamp,
              data: legacyProject,
            });

            localProjects = [migratedProject];
            await persistProjects(user.id, localProjects);
          }
        }

        if (isMounted) {
          const nextProjects = localProjects.map(normalizeProjectRecord).sort(
            (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
          );
          const storedActiveProjectId = readActiveProjectId(user.id);
          const nextActiveProjectId = nextProjects.some((project) => project.id === storedActiveProjectId) ?
             storedActiveProjectId
            : nextProjects[0]?.id || '';

          setProjects(nextProjects);
          setActiveProjectId(nextActiveProjectId);
          if (nextActiveProjectId) writeActiveProjectId(user.id, nextActiveProjectId);
        }
      } catch {
        if (isMounted) setProjectMeta(null);
      }
    }

    hydrateUserProjects();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const login = async ({ email, password }) => {
    setIsBusy(true);
    setAuthError('');
    try {
      const account = await loginUser({ email, password });
      setUser(account);
      setAuthorProfile(getAuthorProfile(account.id, account));
      return account;
    } catch (error) {
      setAuthError(error.message || 'Connexion impossible.');
      throw error;
    } finally {
      setIsBusy(false);
    }
  };

  const register = async ({ name, email, password }) => {
    setIsBusy(true);
    setAuthError('');
    try {
      const account = await registerUser({ name, email, password });
      if (account.needsEmailConfirmation) {
        return account;
      }
      setUser(account);
      setAuthorProfile(getAuthorProfile(account.id, account));
      return account;
    } catch (error) {
      setAuthError(error.message || 'Inscription impossible.');
      throw error;
    } finally {
      setIsBusy(false);
    }
  };

  const requestPasswordReset = async ({ email }) => {
    setIsBusy(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(email);
      return true;
    } catch (error) {
      setAuthError(error.message || 'Envoi du lien impossible.');
      throw error;
    } finally {
      setIsBusy(false);
    }
  };

  const updatePassword = async ({ password }) => {
    setIsBusy(true);
    setAuthError('');
    try {
      const account = await updateCurrentUserPassword(password);
      setUser(account);
      setAuthorProfile(getAuthorProfile(account.id, account));
      setIsPasswordRecovery(false);
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      return account;
    } catch (error) {
      setAuthError(error.message || 'Mise à jour du mot de passe impossible.');
      throw error;
    } finally {
      setIsBusy(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setProjectMeta(null);
    setProjects([]);
    setActiveProjectId('');
    setAuthorProfile(null);
    setAuthError('');
    setIsPasswordRecovery(false);
  };

  const updateAuthorProfile = async (nextProfile) => {
    if (!user?.id) return null;
    const savedProfile = saveAuthorProfile(user.id, nextProfile, user);
    setAuthorProfile(savedProfile);
    return savedProfile;
  };

  const createProject = async (project, name) => {
    if (!user?.id) return null;
    const timestamp = nowIso();
    const record = normalizeProjectRecord({
      id: createId(),
      name: name || getProjectTitle(project, 'Nouveau projet'),
      thumbnail: getProjectThumbnail(project),
      uiState: { tab: 'scenes', selectedSceneId: project?.scenes?.[0]?.id || '' },
      shareState: { isPublic: false, copiedAt: '' },
      createdAt: timestamp,
      updatedAt: timestamp,
      data: {
        ...project,
        title: project?.title || name || 'Nouveau projet',
      },
    });

    const nextProjects = [record, ...(await readPersistedProjects(user.id))];
    await persistProjects(user.id, nextProjects);
    writeActiveProjectId(user.id, record.id);
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
    setActiveProjectId(record.id);
    setProjectMeta({ id: record.id, name: record.name, updatedAt: record.updatedAt });
    return record;
  };

  const saveProject = async (project, projectId = activeProjectId, uiState = {}) => {
    if (!user?.id) return null;

    const storableProject = project || {};
    const currentProjects = projectsRef.current || [];
    const existingProjects = currentProjects.length ? currentProjects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const currentProjectId = projectId || existingProjects[0]?.id || createId();
    const existing = existingProjects.find((item) => item.id === currentProjectId);
    const incomingAutosaveRevision = Number(uiState.autosaveRevision || 0);
    const existingAutosaveRevision = Number(existing?.uiState?.autosaveRevision || 0);
    if (incomingAutosaveRevision > 0 && existingAutosaveRevision > incomingAutosaveRevision) {
      return existing ? { id: existing.id, name: existing.name, updatedAt: existing.updatedAt } : null;
    }
    const timestamp = nowIso();
    const record = normalizeProjectRecord({
      ...existing,
      id: currentProjectId,
      name: existing?.name || getProjectTitle(storableProject),
      thumbnail: getProjectThumbnail(storableProject) || existing?.thumbnail || '',
      uiState: { ...(existing?.uiState || {}), ...uiState },
      shareState: existing?.shareState || { isPublic: false, copiedAt: '' },
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      data: storableProject,
    });

    const nextProjects = [record, ...existingProjects.filter((item) => item.id !== currentProjectId)];
    await persistProjects(user.id, nextProjects);
    writeActiveProjectId(user.id, record.id);
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
    setActiveProjectId(record.id);

    const nextMeta = { id: record.id, name: record.name, updatedAt: record.updatedAt };
    setProjectMeta(nextMeta);
    return nextMeta;
  };

  const saveProjects = async (projectRecords = [], nextActiveProjectId = activeProjectId) => {
    if (!user?.id) return [];
    const normalizedProjects = Array.isArray(projectRecords)
      ? projectRecords.map(normalizeProjectRecord)
      : [];
    await persistProjects(user.id, normalizedProjects);
    projectsRef.current = normalizedProjects;
    setProjects(normalizedProjects);
    if (nextActiveProjectId) {
      writeActiveProjectId(user.id, nextActiveProjectId);
      setActiveProjectId(nextActiveProjectId);
    }
    const activeRecord = normalizedProjects.find((project) => project.id === nextActiveProjectId) || normalizedProjects[0];
    if (activeRecord) {
      setProjectMeta({ id: activeRecord.id, name: activeRecord.name, updatedAt: activeRecord.updatedAt });
    }
    return normalizedProjects;
  };

  const loadProject = async (projectId = activeProjectId) => {
    if (!user?.id) return null;
    const projectsForUser = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const selected = projectsForUser.find((project) => project.id === projectId);

    if (selected) {
      writeActiveProjectId(user.id, selected.id);
      setActiveProjectId(selected.id);
      return selected.data;
    }

    const remoteProjects = await loadProjectRecordsForUser(user.id);
    const remoteSelected = (remoteProjects || []).map(normalizeProjectRecord).find((project) => project.id === projectId);
    if (remoteSelected) {
      writeActiveProjectId(user.id, remoteSelected.id);
      setActiveProjectId(remoteSelected.id);
      return remoteSelected.data;
    }

    return loadProjectForUser(user.id);
  };

  const getProjectResumeState = (projectId = activeProjectId) => {
    if (!user?.id || !projectId) return {};
    return projects.find((project) => project.id === projectId)?.uiState
      || readProjects(user.id).find((project) => project.id === projectId)?.uiState
      || {};
  };

  const requestBackendPublication = async ({ action, projectId, project, settings }) => {
    if (!hasSupabaseConfig()) return null;
    const { data } = await getSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Session requise pour publier.');

    const response = await fetch(PROJECT_PUBLICATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        projectId,
        project: project ? sanitizeProjectRecordForStorage(project) : undefined,
        settings,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Publication serveur impossible.');
    return payload.project ? normalizeProjectRecord(payload.project) : null;
  };

  const markProjectLinkCopied = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.map((project) => (
      project.id === projectId ?
         {
          ...project,
          shareState: {
            ...(project.shareState || {}),
            isPublic: true,
            copiedAt: timestamp,
            publishedAt: project.shareState?.publishedAt || timestamp,
            durationMinutes: project.shareState?.durationMinutes || Math.max(15, Math.min(90, 15 + (project.data?.scenes?.length || 0) * 8 + (project.data?.enigmas?.length || 0) * 5)),
            difficulty: project.shareState?.difficulty || ((project.data?.enigmas?.length || 0) >= 5 ? 'difficile' : (project.data?.enigmas?.length || 0) >= 2 ? 'intermédiaire' : 'facile'),
          },
          updatedAt: timestamp,
        }
        : project
    ));
    const localProject = nextProjects.find((project) => project.id === projectId) || null;
    const serverProject = await requestBackendPublication({ action: 'markCopied', projectId, project: localProject });
    const finalProjects = serverProject
      ? nextProjects.map((project) => (project.id === projectId ? serverProject : project))
      : await persistProjects(user.id, nextProjects, { requirePublicIndex: true });
    if (serverProject) await cacheProjectsLocally(user.id, finalProjects);
    setProjects(finalProjects);
    return finalProjects.find((project) => project.id === projectId) || null;
  };

  const publishProject = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.map((project) => {
      if (project.id !== projectId) return project;
      const snapshot = migrateProjectAssetReferences(cloneProjectData(project.data));
      return {
        ...project,
        shareState: {
          ...(project.shareState || {}),
          isPublic: true,
          copiedAt: project.shareState?.copiedAt || timestamp,
          publishedAt: timestamp,
          publishedData: snapshot,
          publishedName: project.name || getProjectTitle(project.data),
          publishedThumbnail: project.shareState?.galleryThumbnail || project.thumbnail || getProjectThumbnail(snapshot) || '',
          durationMinutes: Math.max(15, Math.min(90, 15 + (snapshot?.scenes?.length || 0) * 8 + (snapshot?.enigmas?.length || 0) * 5)),
          difficulty: (snapshot?.enigmas?.length || 0) >= 5 ? 'difficile' : (snapshot?.enigmas?.length || 0) >= 2 ? 'intermédiaire' : 'facile',
        },
        updatedAt: timestamp,
      };
    });
    const localProject = nextProjects.find((project) => project.id === projectId) || null;
    const serverProject = await requestBackendPublication({ action: 'publish', projectId, project: localProject });
    const finalProjects = serverProject
      ? nextProjects.map((project) => (project.id === projectId ? serverProject : project))
      : await persistProjects(user.id, nextProjects, { requirePublicIndex: true });
    if (serverProject) await cacheProjectsLocally(user.id, finalProjects);
    setProjects(finalProjects);
    return finalProjects.find((project) => project.id === projectId) || null;
  };

  const unpublishProject = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.map((project) => (
      project.id === projectId ?
         {
          ...project,
          shareState: {
            ...(project.shareState || {}),
            isPublic: false,
            unpublishedAt: timestamp,
          },
          updatedAt: timestamp,
        }
        : project
    ));
    const localProject = nextProjects.find((project) => project.id === projectId) || null;
    const serverProject = await requestBackendPublication({ action: 'unpublish', projectId, project: localProject });
    const finalProjects = serverProject
      ? nextProjects.map((project) => (project.id === projectId ? serverProject : project))
      : await persistProjects(user.id, nextProjects, { requirePublicIndex: true });
    if (serverProject) await cacheProjectsLocally(user.id, finalProjects);
    setProjects(finalProjects);
    return finalProjects.find((project) => project.id === projectId) || null;
  };

  const updateProjectShareSettings = async (projectId, settings = {}) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.map((project) => (
      project.id === projectId ?
         {
          ...project,
          shareState: {
            ...(project.shareState || {}),
            ...settings,
          },
          updatedAt: timestamp,
        }
        : project
    ));
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return nextProjects.find((project) => project.id === projectId) || null;
  };

  const renameProject = async (projectId, name) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.map((project) =>
      project.id === projectId ?
         { ...project, name, thumbnail: getProjectThumbnail({ ...project.data, title: name }) || project.thumbnail || '', data: { ...project.data, title: name }, updatedAt: timestamp }
        : project,
    );
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return nextProjects.find((project) => project.id === projectId) || null;
  };

  const updateProjectMode = async (projectId, creationMode) => {
    if (!user?.id || !projectId) return null;
    if (!Object.prototype.hasOwnProperty.call(PROJECT_MODE_RANKS, creationMode)) return null;

    const timestamp = nowIso();
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const source = sourceProjects.find((project) => project.id === projectId);
    if (!source) return null;

    const currentMode = Object.prototype.hasOwnProperty.call(PROJECT_MODE_RANKS, source.data?.creationMode) ?
       source.data.creationMode
      : 'beginner';
    if (PROJECT_MODE_RANKS[creationMode] <= PROJECT_MODE_RANKS[currentMode]) return source;

    const nextProjects = sourceProjects.map((project) =>
      project.id === projectId ?
         {
          ...project,
          data: {
            ...project.data,
            creationMode,
          },
          updatedAt: timestamp,
        }
        : project,
    );
    const finalProjects = await persistProjects(user.id, nextProjects);
    setProjects(finalProjects);
    return finalProjects.find((project) => project.id === projectId) || null;
  };

  const duplicateProject = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const source = sourceProjects.find((project) => project.id === projectId);
    if (!source) return null;

    const timestamp = nowIso();
    const copy = normalizeProjectRecord({
      ...source,
      id: createId(),
      name: `${source.name || getProjectTitle(source.data)} - copie`,
      thumbnail: getProjectThumbnail(source.data) || source.thumbnail || '',
      uiState: source.uiState || {},
      shareState: { isPublic: false, copiedAt: '' },
      createdAt: timestamp,
      updatedAt: timestamp,
      data: {
        ...source.data,
        title: `${source.name || getProjectTitle(source.data)} - copie`,
      },
    });

    const nextProjects = [copy, ...sourceProjects];
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return copy;
  };

  const deleteProject = async (projectId) => {
    if (!user?.id || !projectId) return;
    const sourceProjects = projects.length ? projects.map(normalizeProjectRecord) : await readPersistedProjects(user.id);
    const nextProjects = sourceProjects.filter((project) => project.id !== projectId);
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);

    if (activeProjectId === projectId) {
      const nextActiveProjectId = nextProjects[0]?.id || '';
      writeActiveProjectId(user.id, nextActiveProjectId);
      setActiveProjectId(nextActiveProjectId);
    }
  };

  const importProject = async (project, name) => createProject(project, name || getProjectTitle(project, 'Projet importé'));

  return {
    user,
    role: user ? (isAdminAccount(user) ? 'admin' : 'user') : '',
    isAdmin: isAdminAccount(user),
    isReady,
    isBusy,
    authError,
    setAuthError,
    login,
    register,
    requestPasswordReset,
    updatePassword,
    isPasswordRecovery,
    logout,
    saveProject,
    saveProjects,
    loadProject,
    projectMeta,
    authorProfile,
    updateAuthorProfile,
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    getProjectResumeState,
    markProjectLinkCopied,
    publishProject,
    unpublishProject,
    updateProjectShareSettings,
    refreshProjects,
    createProject,
    renameProject,
    updateProjectMode,
    duplicateProject,
    deleteProject,
    importProject,
  };
}
