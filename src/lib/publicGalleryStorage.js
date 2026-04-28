import { getAllAccounts, loadProjectRecordsForUser } from './authStorage';
import { getAuthorProfile } from './authorProfiles';

const LOCAL_PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';
const FEEDBACK_KEY = 'escapeGameBuilder.publicFeedback.v1';
const STATS_KEY = 'escapeGameBuilder.publicStats.v1';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readJson = (key, fallback) => {
  if (!canUseStorage()) return fallback;
  return safeParse(window.localStorage.getItem(key), fallback);
};

const countSince = (dates = [], since) => dates.filter((value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= since;
}).length;

const writeJson = (key, value) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const getLocalProjectsKey = (userId) => `${LOCAL_PROJECTS_KEY_PREFIX}.${userId}`;

const getProjectTitle = (project, record) =>
  record?.name || project?.title || project?.name || 'Escape game sans titre';

const getProjectThumbnail = (project = {}, record = {}) => {
  const startScene = Array.isArray(project.scenes) ?
     project.scenes.find((scene) => scene.id === project.start?.targetSceneId)
    : null;
  const candidates = [
    record.shareState?.galleryThumbnail,
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

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getProjectSearchText = (project = {}, record = {}) => normalizeText([
  record.name,
  project.title,
  project.name,
  project.description,
  project.story,
  ...(project.scenes || []).flatMap((scene) => [scene.name, scene.introText]),
  ...(project.enigmas || []).map((enigma) => enigma.name),
].filter(Boolean).join(' '));

const detectCategory = (project = {}, record = {}) => {
  const explicitCategory = record.shareState?.category || project.category || project.genre;
  if (explicitCategory) return String(explicitCategory);

  const text = getProjectSearchText(project, record);
  const rules = [
    ['Horreur', ['horreur', 'hante', 'manoir', 'fantome', 'demon', 'cauchemar', 'sang']],
    ['Enquete', ['enquete', 'police', 'inspecteur', 'crime', 'preuve', 'suspect', 'archives']],
    ['Aventure', ['temple', 'tresor', 'exploration', 'jungle', 'ile', 'pirate']],
    ['Science-fiction', ['laboratoire', 'reacteur', 'station', 'vaisseau', 'robot', 'futur']],
    ['Fantastique', ['magie', 'artefact', 'sort', 'royaume', 'musee', 'relique']],
    ['Historique', ['chateau', 'medieval', 'antique', 'histoire', 'guerre']],
  ];
  const match = rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  return match?.[0] || 'Autre';
};

const detectAgeRating = (project = {}, record = {}) => {
  const explicitRating = record.shareState?.ageRating || project.ageRating;
  if (explicitRating) return String(explicitRating);
  if (record.shareState?.mature || project.mature) return '+18 ans';

  const text = getProjectSearchText(project, record);
  const matureKeywords = ['+18', 'adulte', 'gore', 'sanglant', 'torture', 'nudite', 'sexual', 'drogue', 'suicide'];
  return matureKeywords.some((keyword) => text.includes(keyword)) ? '+18 ans' : 'Tout public';
};

const normalizeRecord = (record = {}) => {
  const data = record.data || record.project || record;
  return {
    ...record,
    id: record.id,
    name: record.name || getProjectTitle(data, record),
    thumbnail: getProjectThumbnail(data, record),
    data,
    shareState: record.shareState || record.share_state || {},
  };
};

export const getGameKey = (userId, projectId) => `${userId}:${projectId}`;

export const readPublicFeedback = () => readJson(FEEDBACK_KEY, {});

export const readPublicStats = () => readJson(STATS_KEY, {});

export const getWeightedScore = (average = 0, votes = 0) => {
  if (!votes) return 0;
  return ((average * votes) + (3 * 5)) / (votes + 5);
};

export const getFeedbackSummary = (gameKey) => {
  const feedback = readPublicFeedback()[gameKey] || { ratings: [], comments: [] };
  const ratings = Array.isArray(feedback.ratings) ? feedback.ratings : [];
  const comments = Array.isArray(feedback.comments) ? feedback.comments : [];
  const votes = ratings.length;
  const average = votes ? ratings.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / votes : 0;

  return {
    ratings,
    comments,
    votes,
    average,
    score: getWeightedScore(average, votes),
  };
};

export const ratePublicGame = ({ gameKey, userId, rating }) => {
  const safeRating = Math.max(1, Math.min(5, Number(rating) || 0));
  if (!gameKey || !userId || !safeRating) return getFeedbackSummary(gameKey);

  const feedback = readPublicFeedback();
  const gameFeedback = feedback[gameKey] || { ratings: [], comments: [] };
  const ratings = (gameFeedback.ratings || []).filter((entry) => entry.userId !== userId);
  ratings.push({
    userId,
    gameKey,
    rating: safeRating,
    createdAt: new Date().toISOString(),
  });

  feedback[gameKey] = { ...gameFeedback, ratings };
  writeJson(FEEDBACK_KEY, feedback);
  return getFeedbackSummary(gameKey);
};

export const commentPublicGame = ({ gameKey, userId, authorName, text }) => {
  const cleanText = String(text || '').trim().slice(0, 180);
  if (!gameKey || !userId || !cleanText) return getFeedbackSummary(gameKey);

  const feedback = readPublicFeedback();
  const gameFeedback = feedback[gameKey] || { ratings: [], comments: [] };
  const comments = [
    {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      authorName: authorName || 'Joueur',
      text: cleanText,
      createdAt: new Date().toISOString(),
    },
    ...(gameFeedback.comments || []),
  ].slice(0, 30);

  feedback[gameKey] = { ...gameFeedback, comments };
  writeJson(FEEDBACK_KEY, feedback);
  return getFeedbackSummary(gameKey);
};

export const incrementPublicGamePlay = (gameKey) => {
  if (!gameKey) return;
  const stats = readPublicStats();
  const gameStats = stats[gameKey] || { plays: 0, completions: 0 };
  const now = new Date().toISOString();
  const recentPlays = [...(gameStats.recentPlays || []), now].filter((value) => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= Date.now() - 1000 * 60 * 60 * 24 * 14;
  });
  stats[gameKey] = {
    ...gameStats,
    plays: Number(gameStats.plays || 0) + 1,
    recentPlays,
    lastPlayedAt: now,
  };
  writeJson(STATS_KEY, stats);
};

export async function getPublicGames() {
  const accounts = getAllAccounts();
  const stats = readPublicStats();

  const gamesByKey = new Map();

  await Promise.all(accounts.map(async (account) => {
    const authorProfile = getAuthorProfile(account.id, account);
    const localRecords = readJson(getLocalProjectsKey(account.id), []);
    const remoteRecords = await loadProjectRecordsForUser(account.id).catch(() => null);
    const records = Array.isArray(remoteRecords) && remoteRecords.length ? remoteRecords : localRecords;

    records.map(normalizeRecord).forEach((record) => {
      if (!record.id || !record.shareState?.isPublic) return;
      const gameKey = getGameKey(account.id, record.id);
      const summary = getFeedbackSummary(gameKey);
      const projectStats = stats[gameKey] || {};
      const recentPlays = Array.isArray(projectStats.recentPlays) ? projectStats.recentPlays : [];
      const plays24h = countSince(recentPlays, Date.now() - 1000 * 60 * 60 * 24);
      const plays7d = countSince(recentPlays, Date.now() - 1000 * 60 * 60 * 24 * 7);
      const data = record.data || {};
      const scenes = Array.isArray(data.scenes) ? data.scenes.length : 0;
      const enigmas = Array.isArray(data.enigmas) ? data.enigmas.length : 0;
      const difficulty = record.shareState?.difficulty || (enigmas >= 5 ? 'difficile' : enigmas >= 2 ? 'intermédiaire' : 'facile');
      const durationMinutes = Number(record.shareState?.durationMinutes) || Math.max(15, Math.min(90, 15 + scenes * 8 + enigmas * 5));
      const category = detectCategory(data, record);
      const ageRating = detectAgeRating(data, record);
      const badges = [];

      if (ageRating === '+18 ans') badges.push('+18 ans');
      if (plays24h >= 3) badges.push('🔥 tendance');
      if ((projectStats.plays || 0) >= 10) badges.push('🔥 populaire');
      if (summary.votes >= 3 && summary.average >= 4.4) badges.push('⭐ très bien noté');
      if (difficulty === 'difficile') badges.push('🧠 difficile');
      if ((data.cinematics || []).length >= 2 || String(data.story || data.description || '').length > 120) badges.push('🎬 narratif');

      gamesByKey.set(gameKey, {
        key: gameKey,
        userId: account.id,
        projectId: record.id,
        title: getProjectTitle(data, record),
        author: authorProfile.displayName || account.name || account.email || 'Créateur',
        authorProfile,
        authorEmail: account.email || '',
        image: getProjectThumbnail(data, record),
        description: data.description || data.story || data.start?.introText || data.scenes?.[0]?.introText || '',
        createdAt: record.createdAt || record.created_at || '',
        updatedAt: record.updatedAt || record.updated_at || '',
        publishedAt: record.shareState?.publishedAt || record.shareState?.copiedAt || record.updatedAt || '',
        durationMinutes,
        difficulty,
        category,
        ageRating,
        isMature: ageRating === '+18 ans',
        scenes,
        enigmas,
        plays: Number(projectStats.plays || 0),
        plays24h,
        plays7d,
        completions: Number(projectStats.completions || 0),
        badges,
        feedback: summary,
        project: data,
      });
    });
  }));

  return Array.from(gamesByKey.values());
}

export async function loadPublicProject(userId, projectId) {
  if (!userId || !projectId) return null;
  const remoteRecords = await loadProjectRecordsForUser(userId).catch(() => null);
  const localRecords = readJson(getLocalProjectsKey(userId), []);
  const records = Array.isArray(remoteRecords) && remoteRecords.length ? remoteRecords : localRecords;
  const record = records.map(normalizeRecord).find((entry) => entry.id === projectId);

  if (!record?.shareState?.isPublic) return null;
  return record.data || null;
}
