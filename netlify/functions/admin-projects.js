import {
  getSupabaseAdminClient,
  json,
  privateDataBucket,
  publicAssetsBucket,
  verifyAdmin,
  withErrors,
} from './_shared.js';
import {
  VISITOR_ANALYTICS_STORAGE_PATH,
  summarizeVisitorAnalytics,
} from '../../server/visitorAnalytics.js';

const publicProjectsStoragePath = 'public/projects.json';

const sanitizeStorageSegment = (value = '') => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const isMissingStorageResource = (error) => Number(error?.statusCode || error?.status) === 404
  || /not found/i.test(String(error?.message || ''));

const getErrorMessage = (error) => error?.message || String(error || 'Erreur inconnue');

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

const getAdminProjectPayload = (record = {}) => {
  const shareState = record.shareState || record.share_state || {};
  const data = shareState.publishedData || record.data || record.project || {};
  const projectId = record.id || record.projectId || '';
  const userId = record.userId || '';
  const key = record.publicKey || (userId && projectId ? `${userId}:${projectId}` : projectId);
  const scenes = Array.isArray(data.scenes) ? data.scenes.length : 0;
  const enigmas = Array.isArray(data.enigmas) ? data.enigmas.length : 0;

  return {
    key,
    userId,
    projectId,
    title: getProjectTitle(data, record),
    author: record.authorName || record.author || record.authorEmail || 'Createur',
    authorEmail: record.authorEmail || '',
    category: shareState.category || data.category || 'Autre',
    ageRating: shareState.ageRating || data.ageRating || 'Tout public',
    thumbnail: shareState.galleryThumbnail || shareState.publishedThumbnail || record.thumbnail || getProjectThumbnail(data, record),
    publishedAt: shareState.publishedAt || shareState.copiedAt || record.updatedAt || '',
    plays: Number(record.plays || 0),
    scenes,
    enigmas,
    feedback: record.feedback || { votes: 0, average: 0, comments: [] },
    authorProfile: record.authorProfile || { blogPosts: [] },
    shareState,
  };
};

const downloadPublicProjects = async (supabase) => {
  const { data, error } = await supabase.storage.from(publicAssetsBucket).download(publicProjectsStoragePath);
  if (error) {
    if (isMissingStorageResource(error)) return [];
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return [];
  let records = [];
  try {
    records = JSON.parse(text);
  } catch (error) {
    console.warn(`Index projets publics illisible: ${getErrorMessage(error)}`);
    return [];
  }
  return Array.isArray(records) ? records : [];
};

const downloadVisitorAnalytics = async (supabase) => {
  const { data, error } = await supabase.storage.from(privateDataBucket).download(VISITOR_ANALYTICS_STORAGE_PATH);
  if (error) {
    if (isMissingStorageResource(error)) return {};
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return {};
  try {
    const record = JSON.parse(text);
    return record && typeof record === 'object' ? record : {};
  } catch (error) {
    console.warn(`Analytics visiteurs illisibles: ${getErrorMessage(error)}`);
    return {};
  }
};

const downloadProjectIndexForUser = async (supabase, userId) => {
  const safeUserId = sanitizeStorageSegment(userId);
  if (!safeUserId) return [];

  const { data, error } = await supabase.storage
    .from(privateDataBucket)
    .download(`users/${safeUserId}/projects.json`);

  if (error) {
    if (isMissingStorageResource(error)) return [];
    console.warn(`Index projets indisponible pour ${userId}: ${getErrorMessage(error)}`);
    return [];
  }

  const text = await data.text();
  if (!text.trim()) return [];
  let records = [];
  try {
    records = JSON.parse(text);
  } catch (error) {
    console.warn(`Index projets illisible pour ${userId}: ${getErrorMessage(error)}`);
    return [];
  }
  return Array.isArray(records) ? records : [];
};

const getProjectCountsByUser = async (supabase) => {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.warn(`Comptage projets indisponible: ${getErrorMessage(error)}`);
    return {};
  }

  const entries = await Promise.all((data.users || []).map(async (user) => {
    const projects = await downloadProjectIndexForUser(supabase, user.id);
    return [user.id, projects.filter((project) => project?.id).length];
  }));

  return Object.fromEntries(entries);
};

export const handler = async (event) => withErrors(event, async () => {
  await verifyAdmin(event);

  if (event.httpMethod !== 'GET') return json(405, { error: 'Methode non autorisee.' });

  const supabase = getSupabaseAdminClient();
  const [records, projectCounts, visitorAnalyticsRecord] = await Promise.all([
    downloadPublicProjects(supabase),
    getProjectCountsByUser(supabase),
    downloadVisitorAnalytics(supabase),
  ]);
  return json(200, {
    projects: records.map(getAdminProjectPayload),
    projectCounts,
    visitorAnalytics: summarizeVisitorAnalytics(visitorAnalyticsRecord),
  });
});
