import React, { useEffect, useRef, useState } from 'react';
import CreateProjectPanel from './components/CreateProjectPanel';
import OrdersPanel from './components/OrdersPanel';
import ProfileBadgesPanel from './components/ProfileBadgesPanel';
import ProfileHeader from './components/ProfileHeader';
import ProfileMediaPanel from './components/ProfileMediaPanel';
import ProfileMessagesPanel from './components/ProfileMessagesPanel';
import ProfileProPanel from './components/ProfileProPanel';
import ProfileSettingsPanel from './components/ProfileSettingsPanel';
import PublicationPanel from './components/PublicationPanel';
import ProjectList from './components/ProjectList';
import { readShopPurchases } from '../../shared/services/shopPurchases';
import { isProfessionalAccount } from '../../shared/services/accountPlans';
import { getFollowersForCreator } from '../../shared/services/creatorFollows';
import {
  PROFILE_BADGE_EVENT_PLAY_GAME,
  PROFILE_BADGE_EVENTS_UPDATED_EVENT,
  markProfileBadgeEvent,
  readProfileBadgeEvents,
} from '../../shared/services/profileBadges';

const getProfileTutorialTab = (step = {}) => {
  const selector = `${step?.selector || ''} ${step?.fallbackSelector || ''}`;
  if (/profile-(create-section|mode-picker|template-picker|create-button|guided-create-button|import-section)/.test(selector)) {
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

export default function ProfileWorkspace({
  user,
  canOpenAdmin = false,
  projects = [],
  activeProjectId = '',
  authorProfile = null,
  isBusy = false,
  statusMessage = '',
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
  onUpdatePassword,
  onRefreshStorageUsage,
  mediaLibrary = [],
  storageSummary = null,
  aiCreditBalance = 0,
  onBuyStorage,
  onLogout,
  isProfileTutorialActive = false,
  profileTutorialStep = null,
}) {
  const [activeProfileTab, setActiveProfileTab] = useState('new-project');
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const tutorialMenuRef = useRef(null);
  const shopUserId = user?.id || user?.email || 'anonymous';
  const isProAccount = isProfessionalAccount(user);
  const [orders, setOrders] = useState(() => readShopPurchases(shopUserId));
  const [badgeEvents, setBadgeEvents] = useState(() => readProfileBadgeEvents(shopUserId));
  const followersCount = getFollowersForCreator(user?.id).length;

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

  useEffect(() => {
    if (isProfileTutorialActive && tutorialMenuRef.current) {
      tutorialMenuRef.current.open = false;
    }
  }, [isProfileTutorialActive]);

  useEffect(() => {
    if (!isProfileTutorialActive) return;
    const tutorialTab = getProfileTutorialTab(profileTutorialStep);
    if (tutorialTab && tutorialTab !== activeProfileTab) {
      setActiveProfileTab(tutorialTab);
    }
  }, [
    activeProfileTab,
    isProfileTutorialActive,
    profileTutorialStep?.fallbackSelector,
    profileTutorialStep?.selector,
  ]);

  useEffect(() => {
    if (activeProfileTab === 'pro' && !isProAccount) {
      setActiveProfileTab('new-project');
    }
  }, [activeProfileTab, isProAccount]);

  useEffect(() => {
    const closeTutorialMenuOnOutsideClick = (event) => {
      if (!tutorialMenuRef.current?.contains(event.target)) {
        tutorialMenuRef.current?.removeAttribute('open');
      }
    };

    document.addEventListener('pointerdown', closeTutorialMenuOnOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', closeTutorialMenuOnOutsideClick, true);
    };
  }, []);

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

  return (
    <main className="layout">
      <ProfileHeader
        user={user}
        authorProfile={authorProfile}
        canOpenAdmin={canOpenAdmin}
        statusMessage={statusMessage}
        ordersCount={orders.length}
        isBusy={isBusy}
        isProfileTutorialActive={isProfileTutorialActive}
        tutorialMenuRef={tutorialMenuRef}
        onOpenAdmin={onOpenAdmin}
        onOpenPublicGallery={onOpenPublicGallery}
        onOpenOrders={() => {
          refreshOrders();
          setIsOrdersOpen(true);
        }}
        onStartTutorial={onStartTutorial}
        onLogout={onLogout}
      />

      {isOrdersOpen ? (
        <OrdersPanel
          orders={orders}
          onClose={() => setIsOrdersOpen(false)}
        />
      ) : null}

      <section className="panel profile-section-tabs" aria-label="Navigation profil" data-tour="profile-section-tabs">
        <button
          type="button"
          className={activeProfileTab === 'new-project' ? 'active' : ''}
          onClick={() => setActiveProfileTab('new-project')}
          data-tour="profile-tab-new-project"
        >
          Nouveau projet
        </button>
        <button
          type="button"
          className={activeProfileTab === 'projects' ? 'active' : ''}
          onClick={() => setActiveProfileTab('projects')}
          data-tour="profile-tab-projects"
        >
          Projets
        </button>
        <button
          type="button"
          className={activeProfileTab === 'publication' ? 'active' : ''}
          onClick={() => setActiveProfileTab('publication')}
          data-tour="profile-tab-publication"
        >
          Publication
        </button>
        <button
          type="button"
          className={activeProfileTab === 'media' ? 'active' : ''}
          onClick={() => setActiveProfileTab('media')}
          data-tour="profile-tab-media"
        >
          Médias
        </button>
        <button
          type="button"
          className={activeProfileTab === 'messages' ? 'active' : ''}
          onClick={() => setActiveProfileTab('messages')}
          data-tour="profile-tab-messages"
        >
          Messagerie
        </button>
        <button
          type="button"
          className={activeProfileTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveProfileTab('settings')}
          data-tour="profile-tab-settings"
        >
          Profil
        </button>
        <button
          type="button"
          className={activeProfileTab === 'badges' ? 'active' : ''}
          onClick={() => setActiveProfileTab('badges')}
          data-tour="profile-tab-badges"
        >
          Badges
        </button>
        {isProAccount ? (
          <button
            type="button"
            className={activeProfileTab === 'pro' ? 'active' : ''}
            onClick={() => setActiveProfileTab('pro')}
            data-tour="profile-tab-pro"
          >
            Pro
          </button>
        ) : null}
      </section>

      {activeProfileTab === 'new-project' ? (
        <CreateProjectPanel
          isBusy={isBusy}
          onCreateProject={onCreateProject}
          onImportProject={onImportProject}
        />
      ) : null}

      {activeProfileTab === 'projects' ? (
        <ProjectList
          projects={projects}
          activeProjectId={activeProjectId}
          syncStatus={syncStatus}
          onOpenProject={onOpenProject}
          onTestProject={handleTestProject}
          onRenameProject={onRenameProject}
          onUpdateProjectMode={onUpdateProjectMode}
          onDuplicateProject={onDuplicateProject}
          onDeleteProject={onDeleteProject}
        />
      ) : null}

      {activeProfileTab === 'badges' ? (
        <ProfileBadgesPanel
          projects={projects}
          mediaLibrary={mediaLibrary}
          authorProfile={authorProfile}
          badgeEvents={badgeEvents}
          followersCount={followersCount}
          userKey={shopUserId}
        />
      ) : null}

      {activeProfileTab === 'media' ? (
        <ProfileMediaPanel
          projects={projects}
          mediaLibrary={mediaLibrary}
          onImportMediaFile={onImportMediaFile}
          onDeleteMedia={onDeleteMedia}
          onRefreshStorageUsage={onRefreshStorageUsage}
          storageSummary={storageSummary}
          aiCreditBalance={aiCreditBalance}
          onBuyStorage={onBuyStorage}
          mediaOrganizationKey={shopUserId}
        />
      ) : null}

      {activeProfileTab === 'publication' ? (
        <PublicationPanel
          projects={projects}
          onCopyProjectLink={onCopyProjectLink}
          onSaveProjectQrCode={onSaveProjectQrCode}
          onPublishProject={onPublishProject}
          onUnpublishProject={onUnpublishProject}
          onUpdatePublicSettings={onUpdatePublicSettings}
          onUploadGalleryThumbnail={onUploadGalleryThumbnail}
        />
      ) : null}

      {activeProfileTab === 'pro' && isProAccount ? (
        <ProfileProPanel
          projects={projects}
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
      ) : null}

      {activeProfileTab === 'messages' ? (
        <ProfileMessagesPanel user={user} />
      ) : null}

      {activeProfileTab === 'settings' ? (
        <ProfileSettingsPanel
          user={user}
          authorProfile={authorProfile}
          isBusy={isBusy}
          onUpdateAuthorProfile={onUpdateAuthorProfile}
          onUpdatePassword={onUpdatePassword}
        />
      ) : null}
    </main>
  );
}
