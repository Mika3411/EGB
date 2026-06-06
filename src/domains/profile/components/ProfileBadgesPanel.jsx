import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CloudUpload,
  FolderPlus,
  Gamepad2,
  LayoutGrid,
  Lock,
  Puzzle,
  Star,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  PROFILE_BADGE_EVENT_PLAY_GAME,
  readProfileBadgeProgress,
  writeProfileBadgeProgress,
} from '../../../shared/services/profileBadges';
import { calculateProjectScore } from '../../../shared/services/projectScoreEngine';
import { collectProfileMedia } from './ProfileMediaPanel';

const DEFAULT_LEVELS = [
  { id: 'bronze', label: 'Bronze', target: 1 },
  { id: 'silver', label: 'Argent', target: 3 },
  { id: 'gold', label: 'Or', target: 10 },
  { id: 'platinum', label: 'Platine', target: 25 },
];

const makeLevels = (targets = []) => DEFAULT_LEVELS.map((level, index) => ({
  ...level,
  target: Math.max(1, Number(targets[index]) || level.target),
}));

const clampProgress = (value, target) => Math.min(target, Math.max(0, Number(value) || 0));

const getUnitLabel = (unit, value) => {
  if (unit && typeof unit === 'object') {
    return Math.abs(Number(value) || 0) > 1 ? unit.plural : unit.singular;
  }
  const label = String(unit || 'élément');
  return Math.abs(Number(value) || 0) > 1 ? `${label}s` : label;
};

const formatProgress = (value, target, unit, nextLevel = null) => {
  const safeValue = clampProgress(value, target);
  const targetLabel = getUnitLabel(unit, target);
  const suffix = nextLevel ? ` vers ${nextLevel.label}` : '';
  return `${safeValue}/${target} ${targetLabel}${suffix}`;
};

const formatScoreValue = (value = 0) => {
  const score = Number(value) || 0;
  const label = Number.isInteger(score) ? String(score) : score.toFixed(1);
  return label.replace('.', ',');
};

const getLevelState = (value = 0, levels = DEFAULT_LEVELS) => {
  const safeValue = Math.max(0, Number(value) || 0);
  let currentLevelIndex = -1;

  levels.forEach((level, index) => {
    if (safeValue >= level.target) currentLevelIndex = index;
  });

  const currentLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex] : null;
  const nextLevel = levels[currentLevelIndex + 1] || null;
  const progressTarget = nextLevel?.target || currentLevel?.target || levels[0]?.target || 1;
  const unlockedLevelCount = levels.filter((level) => safeValue >= level.target).length;

  return {
    currentLevel,
    currentLevelIndex,
    isUnlocked: Boolean(currentLevel),
    isMaxed: currentLevelIndex === levels.length - 1,
    nextLevel,
    progressPercent: Math.round((clampProgress(safeValue, progressTarget) / progressTarget) * 100),
    progressTarget,
    safeValue,
    unlockedLevelCount,
  };
};

const buildBadgeProgressSnapshot = (badgeStates = []) => badgeStates.reduce((snapshot, badge) => ({
  ...snapshot,
  [badge.id]: badge.levelState.unlockedLevelCount,
}), {});

const findNewBadgeLevels = (badgeStates = [], previousProgress = {}) => badgeStates.flatMap((badge) => {
  const previousCount = Math.max(0, Number(previousProgress?.[badge.id]) || 0);
  const currentCount = badge.levelState.unlockedLevelCount;
  if (currentCount <= previousCount) return [];

  const level = badge.levels[Math.min(currentCount - 1, badge.levels.length - 1)];
  if (!level) return [];

  return [{
    id: badge.id,
    title: badge.title,
    levelId: level.id,
    levelIndex: Math.min(currentCount - 1, badge.levels.length - 1),
    levelLabel: level.label,
    isFirstLevel: previousCount === 0,
  }];
});

const BADGE_ANNOUNCEMENT_COPY = {
  bronze: {
    icon: '🥉',
    title: 'Badge obtenu',
  },
  silver: {
    icon: '🥈',
    title: 'Nouveau niveau atteint',
  },
  gold: {
    icon: '🥇',
    title: 'Félicitations !',
  },
  platinum: {
    icon: '✨',
    title: 'Badge Platine débloqué',
    detail: "Ton projet atteint un niveau d'excellence.",
  },
};

const getBadgeAnnouncementCopy = (announcement = {}) => {
  const copy = BADGE_ANNOUNCEMENT_COPY[announcement.levelId] || BADGE_ANNOUNCEMENT_COPY.bronze;
  return {
    ...copy,
    summary: `${announcement.title} - ${announcement.levelLabel}`,
  };
};

const hasPlayedGameTrace = (projects = []) => projects.some((project) => {
  const shareState = project?.shareState || {};
  const uiState = project?.uiState || {};
  return Boolean(
    shareState.playedAt
    || shareState.lastPlayedAt
    || Number(shareState.playCount || shareState.plays || 0) > 0
    || uiState.playedAt
    || uiState.lastPlayedAt
    || Number(uiState.playCount || uiState.plays || 0) > 0
  );
});

const countProfileFields = (authorProfile = null) => {
  const socialLinkCount = Array.isArray(authorProfile?.socialLinks)
    ? authorProfile.socialLinks.filter((link) => String(link?.url || '').trim()).length
    : 0;

  return [
    authorProfile?.displayName,
    authorProfile?.avatar,
    authorProfile?.banner,
    authorProfile?.bio,
    authorProfile?.tagline,
    authorProfile?.website,
  ].filter(Boolean).length + socialLinkCount;
};

const isPublishedProject = (project) => Boolean(
  project?.shareState?.isPublic
  || project?.shareState?.publishedAt
  || project?.shareState?.copiedAt
);

const getBestProjectScore = (projects = []) => projects.reduce((bestScore, project) => {
  const score = calculateProjectScore(project?.data || project || {}).score;
  return Math.max(bestScore, Number.isFinite(score) ? score : 0);
}, 0);

const buildBadges = ({
  projects = [],
  mediaLibrary = [],
  authorProfile = null,
  badgeEvents = {},
  followersCount = 0,
}) => {
  const totalScenes = projects.reduce((total, project) => (
    total + (Array.isArray(project?.data?.scenes) ? project.data.scenes.length : 0)
  ), 0);
  const totalEnigmas = projects.reduce((total, project) => (
    total + (Array.isArray(project?.data?.enigmas) ? project.data.enigmas.length : 0)
  ), 0);
  const mediaCount = collectProfileMedia(projects, mediaLibrary).length;
  const publishedProjectCount = projects.filter(isPublishedProject).length;
  const profileFieldCount = countProfileFields(authorProfile);
  const safeFollowersCount = Math.max(0, Number(followersCount) || 0);
  const bestProjectScore = getBestProjectScore(projects);
  const playGameCount = Math.max(
    Number(badgeEvents?.[PROFILE_BADGE_EVENT_PLAY_GAME]?.count || 0),
    hasPlayedGameTrace(projects) ? 1 : 0,
  );

  return [
    {
      id: 'projects-created',
      title: 'Projets créés',
      description: 'Créer plusieurs jeux dans ton espace.',
      value: projects.length,
      unit: { singular: 'projet', plural: 'projets' },
      levels: makeLevels([1, 3, 10, 25]),
      Icon: FolderPlus,
    },
    {
      id: 'scenes-created',
      title: 'Scènes créées',
      description: 'Construire des scènes jouables pour tes aventures.',
      value: totalScenes,
      unit: { singular: 'scène', plural: 'scènes' },
      levels: makeLevels([1, 5, 15, 40]),
      Icon: LayoutGrid,
    },
    {
      id: 'published-games',
      title: 'Jeux publiés',
      description: 'Publier tes jeux ou générer leurs liens publics.',
      value: publishedProjectCount,
      unit: { singular: 'jeu publié', plural: 'jeux publiés' },
      levels: makeLevels([1, 3, 10, 25]),
      Icon: CloudUpload,
    },
    {
      id: 'played-games',
      title: 'Parties jouées',
      description: 'Jouer ou tester des jeux depuis ton espace.',
      value: playGameCount,
      unit: { singular: 'partie', plural: 'parties' },
      levels: makeLevels([1, 5, 20, 50]),
      Icon: Gamepad2,
    },
    {
      id: 'media-imported',
      title: 'Médias importés',
      description: 'Importer des images, sons ou vidéos.',
      value: mediaCount,
      unit: { singular: 'média', plural: 'médias' },
      levels: makeLevels([1, 10, 30, 100]),
      Icon: Upload,
    },
    {
      id: 'enigmas-created',
      title: 'Énigmes créées',
      description: 'Ajouter des énigmes dans tes projets.',
      value: totalEnigmas,
      unit: { singular: 'énigme', plural: 'énigmes' },
      levels: makeLevels([1, 5, 15, 40]),
      Icon: Puzzle,
    },
    {
      id: 'multi-scene-adventure',
      title: 'Aventure étoffée',
      description: 'Construire des parcours avec de nombreuses scènes.',
      value: totalScenes,
      unit: { singular: 'scène', plural: 'scènes' },
      levels: makeLevels([3, 10, 25, 50]),
      Icon: Trophy,
    },
    {
      id: 'author-profile',
      title: 'Profil auteur',
      description: 'Compléter ton identité publique.',
      value: profileFieldCount,
      unit: { singular: 'élément de profil', plural: 'éléments de profil' },
      levels: makeLevels([1, 2, 4, 6]),
      Icon: UserCheck,
    },
    {
      id: 'project-score',
      title: 'Note de bilan',
      description: 'Obtenir une bonne note globale dans le Bilan.',
      value: bestProjectScore,
      unit: { singular: 'point', plural: 'points' },
      levels: makeLevels([5, 7, 8.5, 9.5]),
      Icon: Star,
      formatLevelTarget: formatScoreValue,
      formatProgressLabel: ({ safeValue, progressTarget, nextLevel }) => (
        `${formatScoreValue(safeValue)}/${formatScoreValue(progressTarget)} sur 10 vers ${nextLevel.label}`
      ),
      formatMaxLabel: ({ currentLevel, safeValue }) => (
        `${currentLevel.label} atteint · ${formatScoreValue(safeValue)}/10`
      ),
    },
    {
      id: 'followers',
      title: 'Followers',
      description: 'Faire grandir ton audience publique.',
      value: safeFollowersCount,
      unit: { singular: 'follower', plural: 'followers' },
      levels: makeLevels([1, 10, 50, 100]),
      Icon: Users,
    },
  ];
};

export default function ProfileBadgesPanel({
  projects = [],
  mediaLibrary = [],
  authorProfile = null,
  badgeEvents = {},
  followersCount = 0,
  userKey = 'anonymous',
}) {
  const [badgeAnnouncement, setBadgeAnnouncement] = useState(null);
  const badges = useMemo(
    () => buildBadges({
      projects,
      mediaLibrary,
      authorProfile,
      badgeEvents,
      followersCount,
    }),
    [authorProfile, badgeEvents, followersCount, mediaLibrary, projects],
  );
  const badgeStates = useMemo(() => badges.map((badge) => ({
    ...badge,
    levelState: getLevelState(badge.value, badge.levels),
  })), [badges]);
  const unlockedLevelCount = badgeStates.reduce((total, badge) => total + badge.levelState.unlockedLevelCount, 0);
  const totalLevelCount = badgeStates.reduce((total, badge) => total + badge.levels.length, 0);
  const maxedBadgeCount = badgeStates.filter((badge) => badge.levelState.isMaxed).length;
  const completionPercent = Math.round((unlockedLevelCount / Math.max(1, totalLevelCount)) * 100);
  const badgeProgressSignature = badgeStates
    .map((badge) => `${badge.id}:${badge.levelState.unlockedLevelCount}`)
    .join('|');

  useEffect(() => {
    const previousProgress = readProfileBadgeProgress(userKey);
    const nextProgress = buildBadgeProgressSnapshot(badgeStates);

    if (!previousProgress) {
      writeProfileBadgeProgress(userKey, nextProgress);
      return;
    }

    const newLevels = findNewBadgeLevels(badgeStates, previousProgress);
    writeProfileBadgeProgress(userKey, nextProgress);

    if (newLevels.length) {
      const earnedLevel = newLevels.reduce((featuredLevel, level) => (
        level.levelIndex > featuredLevel.levelIndex ? level : featuredLevel
      ), newLevels[0]);
      setBadgeAnnouncement({
        ...earnedLevel,
        extraCount: newLevels.length - 1,
      });
    }
  }, [badgeProgressSignature, badgeStates, userKey]);

  useEffect(() => {
    if (!badgeAnnouncement) return undefined;
    const timeoutId = window.setTimeout(() => {
      setBadgeAnnouncement(null);
    }, 5200);
    return () => window.clearTimeout(timeoutId);
  }, [badgeAnnouncement]);

  const announcementCopy = badgeAnnouncement ? getBadgeAnnouncementCopy(badgeAnnouncement) : null;

  return (
    <section className="panel profile-badges-panel" data-tour="profile-badges-section">
      {badgeAnnouncement && announcementCopy ? (
        <div className={`profile-badge-announcement level-${badgeAnnouncement.levelId}`} role="status" aria-live="polite">
          <span className="profile-badge-announcement-mark" aria-hidden="true">{announcementCopy.icon}</span>
          <span>
            <strong>{announcementCopy.title}</strong>
            <small>{announcementCopy.summary}</small>
            {announcementCopy.detail ? <em>{announcementCopy.detail}</em> : null}
            {badgeAnnouncement.extraCount > 0 ? (
              <small className="profile-badge-announcement-extra">
                +{badgeAnnouncement.extraCount} autre{badgeAnnouncement.extraCount > 1 ? 's' : ''} palier{badgeAnnouncement.extraCount > 1 ? 's' : ''} débloqué{badgeAnnouncement.extraCount > 1 ? 's' : ''}
              </small>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="panel-head">
        <div>
          <span className="eyebrow">Badges</span>
          <h2>Badges créateur</h2>
          <p className="small-note">Tous les badges progressent en Bronze, Argent, Or puis Platine.</p>
        </div>
        <span className="status-badge soft">
          {unlockedLevelCount}/{totalLevelCount} niveaux
        </span>
      </div>

      <div className="profile-badge-summary" data-tour="profile-badge-summary">
        <div className="profile-badge-summary-icon" aria-hidden="true">
          <BadgeCheck size={26} />
        </div>
        <div>
          <strong>{completionPercent}% de collection</strong>
          <span>{maxedBadgeCount} badge{maxedBadgeCount > 1 ? 's' : ''} au niveau Platine</span>
        </div>
        <div className="profile-badge-summary-bar" aria-hidden="true">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      <div className="profile-badge-grid" data-tour="profile-badge-grid">
        {badgeStates.map(({
          id,
          title,
          description,
          value,
          unit,
          levels,
          Icon,
          levelState,
          formatLevelTarget,
          formatMaxLabel,
          formatProgressLabel,
        }) => {
          const {
            currentLevel,
            currentLevelIndex,
            isMaxed,
            isUnlocked,
            nextLevel,
            progressPercent,
            progressTarget,
            safeValue,
          } = levelState;
          const levelClass = currentLevel?.id || 'locked';
          const statusLabel = currentLevel?.label || 'Verrouillé';
          const progressContext = {
            currentLevel,
            nextLevel,
            progressTarget,
            safeValue,
            unit,
            value,
          };
          const progressLabel = isMaxed
            ? (formatMaxLabel
              ? formatMaxLabel(progressContext)
              : `${currentLevel.label} atteint · ${safeValue} ${getUnitLabel(unit, safeValue)}`)
            : (formatProgressLabel
              ? formatProgressLabel(progressContext)
              : formatProgress(safeValue, progressTarget, unit, nextLevel));

          return (
            <article key={id} className={`profile-badge-card ${isUnlocked ? 'unlocked' : 'locked'} level-${levelClass}`}>
              <div className="profile-badge-icon" aria-hidden="true">
                {isUnlocked ? <Icon size={22} /> : <Lock size={20} />}
              </div>
              <div className="profile-badge-body">
                <div className="profile-badge-title-row">
                  <strong>{title}</strong>
                  <span>{statusLabel}</span>
                </div>
                <p>{description}</p>
                <div className="profile-badge-levels" aria-label={`Niveaux ${title}`}>
                  {levels.map((level, index) => (
                    <span
                      key={level.id}
                      className={[
                        `level-${level.id}`,
                        index <= currentLevelIndex ? 'completed' : '',
                        index === currentLevelIndex ? 'current' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {level.label}
                      <small>{formatLevelTarget ? formatLevelTarget(level.target) : level.target}</small>
                    </span>
                  ))}
                </div>
                <div className="profile-badge-progress" aria-label={`Progression ${title}: ${progressLabel}`}>
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <em>{progressLabel}</em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
