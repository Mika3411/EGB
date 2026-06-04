import { readJsonBody, sendJson } from './http.js';
import { verifySupabaseUserRequest } from './auth.js';
import { buildStoragePath, downloadStorageJson, uploadStorageJson } from './storage.js';

const publicProjectsStoragePath = 'public/projects.json';

const cloneProjectData = (data) => JSON.parse(JSON.stringify(data || {}));

export const getProjectTitle = (project = {}, record = {}) =>
  record?.name || project?.title || project?.name || 'Escape game sans titre';

export const getProjectThumbnail = (project = {}, record = {}) => {
  const startScene = Array.isArray(project.scenes)
    ? project.scenes.find((scene) => scene.id === project.start?.targetSceneId)
    : null;
  const candidates = [
    record.shareState?.galleryThumbnail,
    record.shareState?.publishedThumbnail,
    record.thumbnail,
    startScene?.backgroundData,
    ...(project.scenes || []).map((scene) => scene.backgroundData),
    ...(project.cinematics || []).flatMap((cinematic) => [
      cinematic.videoPoster,
      ...(cinematic.slides || []).map((slide) => slide.imageData),
    ]),
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
};

const normalizeProjectRecord = (record = {}) => {
  const rawShareState = record.shareState || record.share_state || { isPublic: false, copiedAt: '' };
  const publishedData = rawShareState.publishedData || rawShareState.published_data;
  return {
    ...record,
    shareState: {
      ...rawShareState,
      ...(publishedData ? { publishedData } : {}),
    },
  };
};

export const getPublicProjectCounts = (records = []) => (
  (Array.isArray(records) ? records : []).reduce((counts, record) => {
    const userId = record?.userId || '';
    if (userId) counts[userId] = (counts[userId] || 0) + 1;
    return counts;
  }, {})
);

const PUBLIC_SETTINGS_KEYS = new Set([
  'category',
  'ageRating',
  'mature',
  'galleryThumbnail',
  'galleryThumbnailName',
  'galleryThumbnailCrop',
  'galleryThumbnailStorage',
  'durationMinutes',
  'difficulty',
]);

const sanitizePublicSettings = (settings = {}) => Object.fromEntries(
  Object.entries(settings || {}).filter(([key]) => PUBLIC_SETTINGS_KEYS.has(key)),
);

const getProjectsStoragePath = (userId) => buildStoragePath('users', userId, 'projects.json');
const getProjectRecordStoragePath = (userId, projectId) => buildStoragePath('users', userId, 'projects', `${projectId || 'project'}.json`);

export const getStoredProjectCountForUser = async (userId, publicCount = 0) => {
  const records = await downloadStorageJson(getProjectsStoragePath(userId), []);
  const privateCount = Array.isArray(records) ? records.filter((project) => project?.id).length : 0;
  return Math.max(privateCount, Number(publicCount || 0));
};

const getProjectIndexRecord = (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const { data, project: legacyProject, ...metadata } = project;
  return {
    ...metadata,
    storagePath,
  };
};

const saveProjectRecordForUser = async (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const record = { ...project, storagePath };
  await uploadStorageJson(storagePath, record);
  return record;
};

const loadServerProjectsForUser = async (userId) => {
  const projects = await downloadStorageJson(getProjectsStoragePath(userId), []);
  if (!Array.isArray(projects)) return [];
  return Promise.all(projects.map(async (project) => {
    if (!project?.storagePath) return normalizeProjectRecord(project);
    const fullProject = await downloadStorageJson(project.storagePath, project);
    return normalizeProjectRecord({ ...project, ...fullProject, storagePath: project.storagePath });
  }));
};

const savePublicProjectIndexForUser = async (userId, projects = []) => {
  const publicRecords = projects
    .filter((project) => project?.id && project.shareState?.isPublic)
    .map((project) => {
      const { publishedData, ...shareState } = project.shareState || {};
      const publicData = cloneProjectData(publishedData || project.data || project.project || {});
      return {
        ...project,
        data: publicData,
        shareState,
        userId,
        publicKey: `${userId}:${project.id}`,
      };
    });

  const existingIndex = await downloadStorageJson(publicProjectsStoragePath, [], { visibility: 'public' });
  const safeIndex = Array.isArray(existingIndex) ? existingIndex : [];
  const withoutUser = safeIndex.filter((project) => project.userId !== userId);
  return uploadStorageJson(publicProjectsStoragePath, [...withoutUser, ...publicRecords], { visibility: 'public' });
};

const saveServerProjectsForUser = async (userId, projects = []) => {
  const normalized = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
  const storedProjects = [];
  for (const project of normalized) {
    if (!project?.id) continue;
    storedProjects.push(await saveProjectRecordForUser(userId, project));
  }
  await uploadStorageJson(getProjectsStoragePath(userId), storedProjects.map((project) => getProjectIndexRecord(userId, project)));
  await savePublicProjectIndexForUser(userId, storedProjects);
  return storedProjects;
};

export const handleProjectPublication = async (req, res) => {
  const user = await verifySupabaseUserRequest(req);
  const body = await readJsonBody(req);
  const action = String(body.action || '').trim();
  const projectId = String(body.projectId || body.project?.id || '').trim();
  const settings = sanitizePublicSettings(body.settings && typeof body.settings === 'object' ? body.settings : {});

  if (!projectId) {
    sendJson(res, 400, { error: 'Projet manquant.' });
    return;
  }
  if (!['markCopied', 'publish', 'unpublish', 'settings'].includes(action)) {
    sendJson(res, 400, { error: 'Action de publication inconnue.' });
    return;
  }

  const timestamp = new Date().toISOString();
  const projects = await loadServerProjectsForUser(user.id);
  const existing = projects.find((project) => project.id === projectId);
  if (!existing) {
    sendJson(res, 404, { error: 'Projet introuvable.' });
    return;
  }

  const sourceProject = normalizeProjectRecord(existing);

  const nextProject = (() => {
    if (action === 'settings') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          ...settings,
        },
        updatedAt: timestamp,
      };
    }

    if (action === 'unpublish') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          isPublic: false,
          unpublishedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    }

    if (action === 'markCopied') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          isPublic: true,
          copiedAt: timestamp,
          publishedAt: sourceProject.shareState?.publishedAt || timestamp,
          publishedData: sourceProject.shareState?.publishedData || cloneProjectData(sourceProject.data),
          publishedName: sourceProject.shareState?.publishedName || sourceProject.name || getProjectTitle(sourceProject.data),
          publishedThumbnail: sourceProject.shareState?.publishedThumbnail || sourceProject.shareState?.galleryThumbnail || sourceProject.thumbnail || getProjectThumbnail(sourceProject.data) || '',
          durationMinutes: sourceProject.shareState?.durationMinutes || Math.max(15, Math.min(90, 15 + (sourceProject.data?.scenes?.length || 0) * 8 + (sourceProject.data?.enigmas?.length || 0) * 5)),
          difficulty: sourceProject.shareState?.difficulty || ((sourceProject.data?.enigmas?.length || 0) >= 5 ? 'difficile' : (sourceProject.data?.enigmas?.length || 0) >= 2 ? 'intermÃ©diaire' : 'facile'),
        },
        updatedAt: timestamp,
      };
    }

    const snapshot = cloneProjectData(sourceProject.data);
    return {
      ...sourceProject,
      shareState: {
        ...(sourceProject.shareState || {}),
        isPublic: true,
        copiedAt: sourceProject.shareState?.copiedAt || timestamp,
        publishedAt: timestamp,
        publishedData: snapshot,
        publishedName: sourceProject.name || getProjectTitle(sourceProject.data),
        publishedThumbnail: sourceProject.shareState?.galleryThumbnail || sourceProject.thumbnail || getProjectThumbnail(snapshot) || '',
        durationMinutes: Math.max(15, Math.min(90, 15 + (snapshot?.scenes?.length || 0) * 8 + (snapshot?.enigmas?.length || 0) * 5)),
        difficulty: (snapshot?.enigmas?.length || 0) >= 5 ? 'difficile' : (snapshot?.enigmas?.length || 0) >= 2 ? 'intermÃ©diaire' : 'facile',
      },
      updatedAt: timestamp,
    };
  })();

  const nextProjects = [
    nextProject,
    ...projects.filter((project) => project.id !== projectId),
  ];

  await saveServerProjectsForUser(user.id, nextProjects);
  sendJson(res, 200, { project: nextProject });
};
