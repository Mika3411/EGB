import {
  aiJobBucket,
  getSupabaseAdminClient,
  json,
  parseBody,
  verifyUser,
  withErrors,
} from './_shared.js';

const publicProjectsStoragePath = 'public/projects.json';

const sanitizeStorageSegment = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';

const buildStoragePath = (...segments) => segments
  .filter(Boolean)
  .map((segment) => sanitizeStorageSegment(segment))
  .join('/');

const isStorageNotFoundError = (error) => {
  const status = Number(error?.statusCode || error?.status || 0);
  const code = String(error?.code || error?.statusCode || '').toLowerCase();
  return status === 404 || code === '404' || code === 'not_found' || code === 'not-found';
};

const downloadStorageJson = async (supabase, path, fallback) => {
  const { data, error } = await supabase.storage.from(aiJobBucket).download(path);
  if (error) {
    if (isStorageNotFoundError(error)) return fallback;
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text) ?? fallback;
  } catch {
    return fallback;
  }
};

const uploadStorageJson = async (supabase, path, value) => {
  const { error } = await supabase.storage
    .from(aiJobBucket)
    .upload(path, Buffer.from(JSON.stringify(value, null, 2)), {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '0',
    });
  if (error) throw error;
  return value;
};

const cloneProjectData = (data) => (
  typeof structuredClone === 'function'
    ? structuredClone(data || {})
    : JSON.parse(JSON.stringify(data || {}))
);

const getProjectTitle = (project = {}, record = {}) =>
  record?.name || project?.title || project?.name || 'Escape game sans titre';

const getProjectThumbnail = (project = {}, record = {}) => {
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

  return candidates.find((value) => (
    typeof value === 'string'
    && (value.startsWith('data:') ? value.length > 0 : value.trim())
  )) || '';
};

const normalizeProjectRecord = (record = {}) => {
  const { publishedData, ...shareState } = record.shareState || record.share_state || { isPublic: false, copiedAt: '' };
  return {
    ...record,
    shareState,
  };
};

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

const getProjectIndexRecord = (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const { data, project: legacyProject, ...metadata } = project;
  return {
    ...metadata,
    storagePath,
  };
};

const saveProjectRecordForUser = async (supabase, userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const record = { ...project, storagePath };
  await uploadStorageJson(supabase, storagePath, record);
  return record;
};

const loadProjectsForUser = async (supabase, userId) => {
  const projects = await downloadStorageJson(supabase, getProjectsStoragePath(userId), []);
  if (!Array.isArray(projects)) return [];
  return Promise.all(projects.map(async (project) => {
    if (!project?.storagePath) return normalizeProjectRecord(project);
    const fullProject = await downloadStorageJson(supabase, project.storagePath, project);
    return normalizeProjectRecord({ ...project, ...fullProject, storagePath: project.storagePath });
  }));
};

const savePublicProjectIndexForUser = async (supabase, userId, projects = []) => {
  const publicRecords = projects
    .filter((project) => project?.id && project.shareState?.isPublic)
    .map((project) => {
      const { publishedData, ...shareState } = project.shareState || {};
      return {
        ...project,
        shareState,
        userId,
        publicKey: `${userId}:${project.id}`,
      };
    });

  const existingIndex = await downloadStorageJson(supabase, publicProjectsStoragePath, []);
  const safeIndex = Array.isArray(existingIndex) ? existingIndex : [];
  const withoutUser = safeIndex.filter((project) => project.userId !== userId);
  return uploadStorageJson(supabase, publicProjectsStoragePath, [...withoutUser, ...publicRecords]);
};

const saveProjectsForUser = async (supabase, userId, projects = []) => {
  const normalized = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
  const storedProjects = [];
  for (const project of normalized) {
    if (!project?.id) continue;
    storedProjects.push(await saveProjectRecordForUser(supabase, userId, project));
  }
  await uploadStorageJson(supabase, getProjectsStoragePath(userId), storedProjects.map((project) => getProjectIndexRecord(userId, project)));
  await savePublicProjectIndexForUser(supabase, userId, storedProjects);
  return storedProjects;
};

const applyPublicationAction = (sourceProject, action, settings, timestamp) => {
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
    const scenes = sourceProject.data?.scenes?.length || 0;
    const enigmas = sourceProject.data?.enigmas?.length || 0;
    return {
      ...sourceProject,
      shareState: {
        ...(sourceProject.shareState || {}),
        isPublic: true,
        copiedAt: timestamp,
        publishedAt: sourceProject.shareState?.publishedAt || timestamp,
        durationMinutes: sourceProject.shareState?.durationMinutes || Math.max(15, Math.min(90, 15 + scenes * 8 + enigmas * 5)),
        difficulty: sourceProject.shareState?.difficulty || (enigmas >= 5 ? 'difficile' : enigmas >= 2 ? 'intermediaire' : 'facile'),
      },
      updatedAt: timestamp,
    };
  }

  const snapshot = cloneProjectData(sourceProject.data);
  const scenes = snapshot?.scenes?.length || 0;
  const enigmas = snapshot?.enigmas?.length || 0;
  return {
    ...sourceProject,
    shareState: {
      ...(sourceProject.shareState || {}),
      isPublic: true,
      copiedAt: sourceProject.shareState?.copiedAt || timestamp,
      publishedAt: timestamp,
      publishedName: sourceProject.name || getProjectTitle(sourceProject.data),
      publishedThumbnail: sourceProject.shareState?.galleryThumbnail || sourceProject.thumbnail || getProjectThumbnail(snapshot) || '',
      durationMinutes: Math.max(15, Math.min(90, 15 + scenes * 8 + enigmas * 5)),
      difficulty: enigmas >= 5 ? 'difficile' : enigmas >= 2 ? 'intermediaire' : 'facile',
    },
    updatedAt: timestamp,
  };
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const user = await verifyUser(event);
  const body = parseBody(event);
  const action = String(body.action || '').trim();
  const projectId = String(body.projectId || body.project?.id || '').trim();
  const settings = sanitizePublicSettings(body.settings && typeof body.settings === 'object' ? body.settings : {});

  if (!projectId) return json(400, { error: 'Projet manquant.' });
  if (!['markCopied', 'publish', 'unpublish', 'settings'].includes(action)) {
    return json(400, { error: 'Action de publication inconnue.' });
  }

  const supabase = getSupabaseAdminClient();
  const projects = await loadProjectsForUser(supabase, user.id);
  const existing = projects.find((project) => project.id === projectId);
  const provided = body.project?.id === projectId ? normalizeProjectRecord(body.project) : null;
  const sourceProject = normalizeProjectRecord(existing || provided || {});

  if (!sourceProject.id) return json(404, { error: 'Projet introuvable.' });

  const nextProject = applyPublicationAction(sourceProject, action, settings, new Date().toISOString());
  const nextProjects = [
    nextProject,
    ...projects.filter((project) => project.id !== projectId),
  ];

  await saveProjectsForUser(supabase, user.id, nextProjects);
  return json(200, { project: nextProject });
});
