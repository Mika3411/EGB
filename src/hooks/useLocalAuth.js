import { useEffect, useMemo, useState } from 'react';
import {
  getProjectMetaForUser,
  getSessionUser,
  isPasswordRecoverySession,
  loadProjectForUser,
  loadProjectRecordsForUser,
  loginUser,
  logoutUser,
  registerUser,
  saveProjectRecordsForUser,
  sendPasswordResetEmail,
  updateCurrentUserPassword,
} from '../lib/authStorage';
import { getAuthorProfile, saveAuthorProfile } from '../lib/authorProfiles';

const PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';
const ACTIVE_PROJECT_KEY_PREFIX = 'escapeGameBuilder.activeProject';

const nowIso = () => new Date().toISOString();

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

const getProjectTitle = (project, fallback = 'Projet sans titre') =>
  project?.title?.trim?.() || project?.name?.trim?.() || fallback;

const stripLargeMediaForLocalCache = (value) => {
  if (Array.isArray(value)) return value.map(stripLargeMediaForLocalCache);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/^(backgroundData|imageData|objectImageData|popupImageData|popupBackgroundData|videoData|audioData)$/i.test(key)) {
      return [key, typeof entry === 'string' && entry.startsWith('http') ? entry : ''];
    }
    return [key, stripLargeMediaForLocalCache(entry)];
  }));
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

const readProjects = (userId) => {
  if (!userId) return [];
  const rawProjects = safeParse(localStorage.getItem(getProjectsKey(userId)), []);
  return Array.isArray(rawProjects) ? rawProjects.map(normalizeProjectRecord) : [];
};

const writeProjects = (userId, projects) => {
  try {
    localStorage.setItem(getProjectsKey(userId), JSON.stringify(projects));
  } catch {
    const slimProjects = projects.map((project) => ({
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
    }));
    localStorage.setItem(getProjectsKey(userId), JSON.stringify(slimProjects));
  }
};

const persistProjects = async (userId, projects) => {
  writeProjects(userId, projects);
  await saveProjectRecordsForUser(userId, projects);
  return projects;
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

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  const refreshProjects = (userId = user?.id) => {
    if (!userId) {
      setProjects([]);
      setActiveProjectId('');
      return [];
    }

    const nextProjects = readProjects(userId).sort(
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
      const sessionUser = await getSessionUser();
      if (!isMounted) return;
      setIsPasswordRecovery(isPasswordRecoverySession());
      setUser(sessionUser);
      if (sessionUser?.id) setAuthorProfile(getAuthorProfile(sessionUser.id, sessionUser));
      setIsReady(true);
    }

    hydrateSession();
    return () => {
      isMounted = false;
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

      let localProjects = readProjects(user.id);
      refreshProjects(user.id);

      try {
        const nextMeta = await getProjectMetaForUser(user.id);
        if (isMounted) setProjectMeta(nextMeta);

        const remoteProjects = await loadProjectRecordsForUser(user.id);
        if (Array.isArray(remoteProjects) && remoteProjects.length > 0) {
          localProjects = remoteProjects.map(normalizeProjectRecord);
          writeProjects(user.id, localProjects);
          await saveProjectRecordsForUser(user.id, localProjects);
        } else if (localProjects.length > 0) {
          await saveProjectRecordsForUser(user.id, localProjects);
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

    const nextProjects = [record, ...readProjects(user.id)];
    await persistProjects(user.id, nextProjects);
    writeActiveProjectId(user.id, record.id);
    setProjects(nextProjects);
    setActiveProjectId(record.id);
    setProjectMeta({ id: record.id, name: record.name, updatedAt: record.updatedAt });
    return record;
  };

  const saveProject = async (project, projectId = activeProjectId, uiState = {}) => {
    if (!user?.id) return null;

    const existingProjects = readProjects(user.id);
    const currentProjectId = projectId || existingProjects[0]?.id || createId();
    const existing = existingProjects.find((item) => item.id === currentProjectId);
    const timestamp = nowIso();
    const record = normalizeProjectRecord({
      ...existing,
      id: currentProjectId,
      name: existing?.name || getProjectTitle(project),
      thumbnail: getProjectThumbnail(project) || existing?.thumbnail || '',
      uiState: { ...(existing?.uiState || {}), ...uiState },
      shareState: existing?.shareState || { isPublic: false, copiedAt: '' },
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      data: project,
    });

    const nextProjects = [record, ...existingProjects.filter((item) => item.id !== currentProjectId)];
    await persistProjects(user.id, nextProjects);
    writeActiveProjectId(user.id, record.id);
    setProjects(nextProjects);
    setActiveProjectId(record.id);

    const nextMeta = { id: record.id, name: record.name, updatedAt: record.updatedAt };
    setProjectMeta(nextMeta);
    return nextMeta;
  };

  const loadProject = async (projectId = activeProjectId) => {
    if (!user?.id) return null;
    const projectsForUser = readProjects(user.id);
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
    return readProjects(user.id).find((project) => project.id === projectId)?.uiState || {};
  };

  const markProjectLinkCopied = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const nextProjects = readProjects(user.id).map((project) => (
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
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return nextProjects.find((project) => project.id === projectId) || null;
  };

  const updateProjectShareSettings = async (projectId, settings = {}) => {
    if (!user?.id || !projectId) return null;
    const timestamp = nowIso();
    const nextProjects = readProjects(user.id).map((project) => (
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
    const nextProjects = readProjects(user.id).map((project) =>
      project.id === projectId ?
         { ...project, name, thumbnail: getProjectThumbnail({ ...project.data, title: name }) || project.thumbnail || '', data: { ...project.data, title: name }, updatedAt: timestamp }
        : project,
    );
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return nextProjects.find((project) => project.id === projectId) || null;
  };

  const duplicateProject = async (projectId) => {
    if (!user?.id || !projectId) return null;
    const source = readProjects(user.id).find((project) => project.id === projectId);
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

    const nextProjects = [copy, ...readProjects(user.id)];
    await persistProjects(user.id, nextProjects);
    setProjects(nextProjects);
    return copy;
  };

  const deleteProject = async (projectId) => {
    if (!user?.id || !projectId) return;
    const nextProjects = readProjects(user.id).filter((project) => project.id !== projectId);
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
    updateProjectShareSettings,
    refreshProjects,
    createProject,
    renameProject,
    duplicateProject,
    deleteProject,
    importProject,
  };
}
