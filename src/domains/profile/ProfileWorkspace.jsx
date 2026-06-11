import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  FolderOpen,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  Plus,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import CreateProjectPanel from './components/CreateProjectPanel';
import OrdersPanel from './components/OrdersPanel';
import ProfileBadgesPanel from './components/ProfileBadgesPanel';
import ProfileHeader from './components/ProfileHeader';
import ProfileMediaPanel, { collectProfileMedia } from './components/ProfileMediaPanel';
import ProfileMessagesPanel from './components/ProfileMessagesPanel';
import ProfileProPanel from './components/ProfileProPanel';
import ProfileSettingsPanel from './components/ProfileSettingsPanel';
import PublicationPanel from './components/PublicationPanel';
import ProjectList from './components/ProjectList';
import { PROFILE_TUTORIAL_CARDS } from './components/profileUtils';
import { readShopPurchases } from '../../shared/services/shopPurchases';
import { isProfessionalAccount } from '../../shared/services/accountPlans';
import { getFollowersForCreator } from '../../shared/services/creatorFollows';
import { isProPromotionProject } from '../../shared/services/proPromotion';
import {
  PROFILE_BADGE_EVENT_PLAY_GAME,
  PROFILE_BADGE_EVENTS_UPDATED_EVENT,
  markProfileBadgeEvent,
  readProfileBadgeEvents,
} from '../../shared/services/profileBadges';
import { useI18n } from '../../shared/i18n';

const getProfileTutorialPage = (step = {}) => {
  const selector = `${step?.selector || ''} ${step?.fallbackSelector || ''} ${(step?.fallbackSelectors || []).join(' ')}`;
  if (/profile-(tab-|section-tabs|header|gallery|orders|logout)/.test(selector)) {
    return '';
  }
  if (/profile-(back-to-cards|create-section|mode-picker|template-picker|create-button|guided-create-button|import-section)/.test(selector)) {
    return 'new-project';
  }
  if (/profile-(projects-section|project-filters|project-list|project-card|project-actions|project-test)/.test(selector)) {
    return 'projects';
  }
  if (/profile-(badges-section|badge-summary|badge-grid)/.test(selector)) {
    return 'badges';
  }
  if (/profile-(media-section|media-stats|media-search|storage-upgrades|media-folders|media-grid|media-browser|media-results)/.test(selector)) {
    return 'media';
  }
  if (/profile-(publication-section|project-publish|public-settings)/.test(selector)) {
    return 'publication';
  }
  if (/profile-(messages-section|messages-refresh|messages-layout|messages-list|messages-conversation|messages-reply)/.test(selector)) {
    return 'messages';
  }
  if (/profile-(settings-section|public-identity|security-form|save-public-identity)/.test(selector)) {
    return 'settings';
  }
  if (/profile-(pro-section|pro-formats|pro-actions|pro-manager)/.test(selector)) {
    return 'pro';
  }
  return '';
};

const PROFILE_RIGHT_ACTION_CARD_IDS = new Set(['media', 'messages', 'settings', 'badges']);

export default function ProfileWorkspace({
  user,
  canOpenAdmin = false,
  projects = [],
  activeProjectId = '',
  authorProfile = null,
  isBusy = false,
  syncStatus = 'offline',
  onCreateProject,
  onOpenProject,
  onTestProject,
  onCopyProjectLink,
  onSaveProjectQrCode,
  onPublishProject,
  onUnpublishProject,
  onUpdatePublicSettings,
  onUploadGalleryThumbnail,
  onOpenPublicGallery,
  onOpenAdmin,
  onStartProPromotion,
  onStartTutorial,
  onRenameProject,
  onUpdateProjectMode,
  onDuplicateProject,
  onDeleteProject,
  onDeleteMedia,
  onImportProject,
  onImportMediaFile,
  onUpdateAuthorProfile,
  onUpdateAccountProfile,
  onUpdatePassword,
  onRefreshStorageUsage,
  mediaLibrary = [],
  storageSummary = null,
  aiCreditBalance = 0,
  onBuyStorage,
  onLogout,
  isProfileTutorialActive = false,
  profileTutorialStep = null,
  onLanguageChange,
}) {
  const { t } = useI18n();
  const [activeProfilePage, setActiveProfilePage] = useState('');
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const shopUserId = user?.id || user?.email || 'anonymous';
  const isProAccount = isProfessionalAccount(user);
  const [orders, setOrders] = useState(() => readShopPurchases(shopUserId));
  const [badgeEvents, setBadgeEvents] = useState(() => readProfileBadgeEvents(shopUserId));
  const followersCount = getFollowersForCreator(user?.id).length;
  const classicProjects = useMemo(() => (
    (projects || []).filter((project) => !isProPromotionProject(project))
  ), [projects]);
  const proProjects = useMemo(() => (
    (projects || []).filter(isProPromotionProject)
  ), [projects]);
  const profileMediaCount = useMemo(() => (
    collectProfileMedia(classicProjects, mediaLibrary).length
  ), [classicProjects, mediaLibrary]);
  const profileActionCards = [
    {
      id: 'tutorials',
      label: t('profile.cards.tutorials.label'),
      description: t('profile.cards.tutorials.description'),
      meta: t('profile.cards.tutorials.meta'),
      icon: BookOpenCheck,
      cardTour: 'profile-tab-tutorials',
    },
    {
      id: 'new-project',
      label: t('profile.cards.newProject.label'),
      description: t('profile.cards.newProject.description'),
      meta: t('profile.cards.newProject.meta'),
      icon: Plus,
      targetTour: 'profile-create-section',
      cardTour: 'profile-tab-new-project',
    },
    {
      id: 'projects',
      label: t('profile.cards.projects.label'),
      description: t('profile.cards.projects.description'),
      meta: t('profile.cards.projects.meta', { count: classicProjects.length }),
      icon: FolderOpen,
      targetTour: 'profile-projects-section',
      cardTour: 'profile-tab-projects',
    },
    {
      id: 'publication',
      label: t('profile.cards.publication.label'),
      description: t('profile.cards.publication.description'),
      meta: t('profile.cards.publication.meta'),
      icon: Megaphone,
      targetTour: 'profile-publication-section',
      cardTour: 'profile-tab-publication',
    },
    {
      id: 'media',
      label: t('profile.cards.media.label'),
      description: t('profile.cards.media.description'),
      meta: t('profile.cards.media.meta', { count: profileMediaCount }),
      icon: ImageIcon,
      targetTour: 'profile-media-section',
      cardTour: 'profile-tab-media',
    },
    {
      id: 'messages',
      label: t('profile.cards.messages.label'),
      description: t('profile.cards.messages.description'),
      meta: t('profile.cards.messages.meta'),
      icon: MessageCircle,
      targetTour: 'profile-messages-section',
      cardTour: 'profile-tab-messages',
    },
    {
      id: 'settings',
      label: t('profile.cards.settings.label'),
      description: t('profile.cards.settings.description'),
      meta: t('profile.cards.settings.meta'),
      icon: UserCheck,
      targetTour: 'profile-settings-section',
      cardTour: 'profile-tab-settings',
    },
    {
      id: 'badges',
      label: t('profile.cards.badges.label'),
      description: t('profile.cards.badges.description'),
      meta: t('profile.cards.badges.meta'),
      icon: BadgeCheck,
      targetTour: 'profile-badges-section',
      cardTour: 'profile-tab-badges',
    },
    ...(isProAccount ? [{
      id: 'pro',
      label: t('profile.cards.pro.label'),
      description: t('profile.cards.pro.description'),
      meta: t('profile.cards.pro.meta', { count: proProjects.length }),
      icon: Sparkles,
      targetTour: 'profile-pro-section',
      cardTour: 'profile-tab-pro',
    }] : []),
  ];
  const mainProfileActionCards = profileActionCards.filter((card) => !PROFILE_RIGHT_ACTION_CARD_IDS.has(card.id));
  const sideProfileActionCards = profileActionCards.filter((card) => PROFILE_RIGHT_ACTION_CARD_IDS.has(card.id));

  const refreshOrders = () => {
    setOrders(readShopPurchases(shopUserId));
  };

  const refreshBadgeEvents = () => {
    setBadgeEvents(readProfileBadgeEvents(shopUserId));
  };

  const handleTestProject = async (projectId) => {
    const nextEvents = markProfileBadgeEvent(shopUserId, PROFILE_BADGE_EVENT_PLAY_GAME, {
      projectId,
      source: 'profile-test',
    });
    setBadgeEvents(nextEvents);
    return onTestProject?.(projectId);
  };

  const openProfilePage = (pageId) => {
    setActiveProfilePage(pageId);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.requestAnimationFrame?.(() => (
        document.querySelector('main.layout')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      ));
    }
  };

  const returnToProfileCards = () => openProfilePage('');

  useEffect(() => {
    if (!isProfileTutorialActive) return;
    const tutorialPage = getProfileTutorialPage(profileTutorialStep);
    if (tutorialPage === 'pro' && !isProAccount) return;
    if (tutorialPage !== activeProfilePage) {
      setActiveProfilePage(tutorialPage);
    }
  }, [
    activeProfilePage,
    isProfileTutorialActive,
    isProAccount,
    profileTutorialStep?.fallbackSelector,
    profileTutorialStep?.fallbackSelectors,
    profileTutorialStep?.selector,
  ]);

  useEffect(() => {
    if (activeProfilePage === 'pro' && !isProAccount) {
      setActiveProfilePage('');
    }
  }, [activeProfilePage, isProAccount]);

  useEffect(() => {
    refreshOrders();

    const handleOrdersUpdate = () => refreshOrders();
    window.addEventListener('storage', handleOrdersUpdate);
    window.addEventListener('shop-purchases-updated', handleOrdersUpdate);
    return () => {
      window.removeEventListener('storage', handleOrdersUpdate);
      window.removeEventListener('shop-purchases-updated', handleOrdersUpdate);
    };
  }, [shopUserId]);

  useEffect(() => {
    refreshBadgeEvents();

    const handleBadgeEventsUpdate = (event) => {
      const eventUserKey = event?.detail?.userKey || '';
      if (eventUserKey && eventUserKey !== shopUserId) return;
      refreshBadgeEvents();
    };

    window.addEventListener('storage', handleBadgeEventsUpdate);
    window.addEventListener(PROFILE_BADGE_EVENTS_UPDATED_EVENT, handleBadgeEventsUpdate);
    return () => {
      window.removeEventListener('storage', handleBadgeEventsUpdate);
      window.removeEventListener(PROFILE_BADGE_EVENTS_UPDATED_EVENT, handleBadgeEventsUpdate);
    };
  }, [shopUserId]);

  const renderProfilePage = () => {
    if (activeProfilePage === 'new-project') {
      return (
        <CreateProjectPanel
          isBusy={isBusy}
          onCreateProject={onCreateProject}
          onImportProject={onImportProject}
        />
      );
    }

    if (activeProfilePage === 'tutorials') {
      return (
        <section className="panel profile-tutorials-panel" data-tour="profile-tutorials-section">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Didacticiels</span>
              <h2>Choisir un didacticiel</h2>
              <p className="small-note">Lance un parcours guidé selon ce que tu veux apprendre maintenant.</p>
            </div>
          </div>
          <div className="profile-tutorial-card-grid">
            {PROFILE_TUTORIAL_CARDS.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                className="profile-tutorial-card"
                onClick={() => onStartTutorial?.(value)}
                disabled={isBusy}
                data-tour={`profile-tutorial-card-${value}`}
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (activeProfilePage === 'projects') {
      return (
        <ProjectList
          projects={classicProjects}
          activeProjectId={activeProjectId}
          syncStatus={syncStatus}
          onOpenProject={onOpenProject}
          onTestProject={handleTestProject}
          onRenameProject={onRenameProject}
          onUpdateProjectMode={onUpdateProjectMode}
          onDuplicateProject={onDuplicateProject}
          onDeleteProject={onDeleteProject}
        />
      );
    }

    if (activeProfilePage === 'publication') {
      return (
        <PublicationPanel
          canSaveProjectQrCode={isProAccount}
          projects={classicProjects}
          onCopyProjectLink={onCopyProjectLink}
          onSaveProjectQrCode={onSaveProjectQrCode}
          onPublishProject={onPublishProject}
          onUnpublishProject={onUnpublishProject}
          onUpdatePublicSettings={onUpdatePublicSettings}
          onUploadGalleryThumbnail={onUploadGalleryThumbnail}
        />
      );
    }

    if (activeProfilePage === 'media') {
      return (
        <ProfileMediaPanel
          projects={classicProjects}
          mediaLibrary={mediaLibrary}
          onImportMediaFile={onImportMediaFile}
          onDeleteMedia={onDeleteMedia}
          onRefreshStorageUsage={onRefreshStorageUsage}
          storageSummary={storageSummary}
          aiCreditBalance={aiCreditBalance}
          onBuyStorage={onBuyStorage}
          mediaOrganizationKey={shopUserId}
        />
      );
    }

    if (activeProfilePage === 'messages') {
      return <ProfileMessagesPanel user={user} />;
    }

    if (activeProfilePage === 'settings') {
      return (
        <ProfileSettingsPanel
          user={user}
          authorProfile={authorProfile}
          isBusy={isBusy}
          onUpdateAuthorProfile={onUpdateAuthorProfile}
          onUpdateAccountProfile={onUpdateAccountProfile}
          onUpdatePassword={onUpdatePassword}
        />
      );
    }

    if (activeProfilePage === 'badges') {
      return (
        <ProfileBadgesPanel
          projects={classicProjects}
          mediaLibrary={mediaLibrary}
          authorProfile={authorProfile}
          badgeEvents={badgeEvents}
          followersCount={followersCount}
          userKey={shopUserId}
        />
      );
    }

    if (activeProfilePage === 'pro' && isProAccount) {
      return (
        <ProfileProPanel
          projects={proProjects}
          activeProjectId={activeProjectId}
          isBusy={isBusy}
          onOpenProject={onOpenProject}
          onTestProject={handleTestProject}
          onCopyProjectLink={onCopyProjectLink}
          onSaveProjectQrCode={onSaveProjectQrCode}
          onPublishProject={onPublishProject}
          onUnpublishProject={onUnpublishProject}
          onUpdatePublicSettings={onUpdatePublicSettings}
          onStartProPromotion={onStartProPromotion}
          onRenameProject={onRenameProject}
          onDuplicateProject={onDuplicateProject}
          onDeleteProject={onDeleteProject}
        />
      );
    }

    return null;
  };

  const renderProfileActionCard = (card) => {
    const Icon = card.icon;
    return (
      <button
        key={card.id}
        type="button"
        className={`profile-action-card profile-action-card-${card.id}`}
        onClick={() => (card.onSelect ? card.onSelect() : openProfilePage(card.id))}
        data-tour={card.cardTour}
      >
        <span className="profile-action-card-icon">
          <Icon aria-hidden="true" size={24} />
        </span>
        <span className="profile-action-card-copy">
          <strong>{card.label}</strong>
          <span>{card.description}</span>
        </span>
        <em>{card.meta}</em>
      </button>
    );
  };

  return (
    <main className="layout">
      <ProfileHeader
        user={user}
        authorProfile={authorProfile}
        canOpenAdmin={canOpenAdmin}
        ordersCount={orders.length}
        onOpenAdmin={onOpenAdmin}
        onOpenPublicGallery={onOpenPublicGallery}
        onOpenOrders={() => {
          refreshOrders();
          setIsOrdersOpen(true);
        }}
        onLogout={onLogout}
        onLanguageChange={onLanguageChange}
      />

      {isOrdersOpen ? (
        <OrdersPanel
          orders={orders}
          onClose={() => setIsOrdersOpen(false)}
        />
      ) : null}

      {!activeProfilePage ? (
        <section className="profile-action-hub" aria-label={t('profile.hub.label')} data-tour="profile-section-tabs">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{t('profile.hub.dashboard')}</span>
              <h2>{t('profile.hub.title')}</h2>
            </div>
          </div>
          <div className="profile-action-groups">
            <div className="panel profile-action-group profile-action-group-left" aria-label={t('profile.hub.mainActions')}>
              <div className="profile-action-card-grid">
                {mainProfileActionCards.map(renderProfileActionCard)}
              </div>
            </div>
            <div className="panel profile-action-group profile-action-group-right" aria-label={t('profile.hub.accountTracking')}>
              <div className="profile-action-card-grid">
                {sideProfileActionCards.map(renderProfileActionCard)}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="profile-section-page">
          <button
            type="button"
            className="secondary-action profile-back-button"
            data-tour="profile-back-to-cards"
            onClick={returnToProfileCards}
          >
            <ArrowLeft aria-hidden="true" size={17} />
            {t('profile.hub.back')}
          </button>
          {renderProfilePage()}
        </div>
      )}
    </main>
  );
}
