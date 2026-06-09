import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutList } from 'lucide-react';
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
import { isProPromotionProject } from '../../shared/services/proPromotion';
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
}) {
  const [activeProfileTab, setActiveProfileTab] = useState('new-project');
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isProfileTabsMenuOpen, setIsProfileTabsMenuOpen] = useState(false);
  const [isMobileProfileNav, setIsMobileProfileNav] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 620px)').matches
  ));
  const tutorialMenuRef = useRef(null);
  const profileTabsMenuRef = useRef(null);
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
  const profileTabLabels = {
    'new-project': 'Nouveau projet',
    projects: 'Projets',
    publication: 'Publication',
    media: 'Médias',
    messages: 'Messagerie',
    settings: 'Profil',
    badges: 'Badges',
    pro: 'Pro',
  };
  const activeProfileTabLabel = profileTabLabels[activeProfileTab] || 'Section';
  const selectProfileTab = (tab) => {
    setActiveProfileTab(tab);
    setIsProfileTabsMenuOpen(false);
  };

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
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 620px)');
    const handleChange = () => setIsMobileProfileNav(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.('change', handleChange);
    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
    };
  }, []);

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
    if (!isProfileTutorialActive || !profileTabsMenuRef.current) return;
    const selector = `${profileTutorialStep?.selector || ''} ${profileTutorialStep?.fallbackSelector || ''}`;
    if (/profile-tab-/.test(selector)) {
      setIsProfileTabsMenuOpen(true);
    }
  }, [
    isProfileTutorialActive,
    profileTutorialStep?.fallbackSelector,
    profileTutorialStep?.selector,
  ]);

  useEffect(() => {
    if (!isProfileTabsMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!profileTabsMenuRef.current?.contains(event.target)) {
        setIsProfileTabsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick, true);
    };
  }, [isProfileTabsMenuOpen]);

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

  const profileSectionMenu = (
    <section
      ref={profileTabsMenuRef}
      className={`panel profile-section-tabs ${isProfileTabsMenuOpen ? 'is-open' : ''}`}
      aria-label="Navigation profil"
      data-tour="profile-section-tabs"
    >
      <button
        type="button"
        className="profile-dropdown-trigger profile-section-tabs-trigger"
        aria-expanded={isProfileTabsMenuOpen}
        aria-controls="profile-section-tab-list"
        aria-label={`Sections du profil, section active : ${activeProfileTabLabel}`}
        onClick={() => setIsProfileTabsMenuOpen((isOpen) => !isOpen)}
      >
        <LayoutList className="profile-dropdown-icon" aria-hidden="true" />
      </button>
      <div id="profile-section-tab-list" className="profile-section-tab-list">
        <button
          type="button"
          className={activeProfileTab === 'new-project' ? 'active' : ''}
          onClick={() => selectProfileTab('new-project')}
          data-tour="profile-tab-new-project"
        >
          Nouveau projet
        </button>
        <button
          type="button"
          className={activeProfileTab === 'projects' ? 'active' : ''}
          onClick={() => selectProfileTab('projects')}
          data-tour="profile-tab-projects"
        >
          Projets
        </button>
        <button
          type="button"
          className={activeProfileTab === 'publication' ? 'active' : ''}
          onClick={() => selectProfileTab('publication')}
          data-tour="profile-tab-publication"
        >
          Publication
        </button>
        <button
          type="button"
          className={activeProfileTab === 'media' ? 'active' : ''}
          onClick={() => selectProfileTab('media')}
          data-tour="profile-tab-media"
        >
          Médias
        </button>
        <button
          type="button"
          className={activeProfileTab === 'messages' ? 'active' : ''}
          onClick={() => selectProfileTab('messages')}
          data-tour="profile-tab-messages"
        >
          Messagerie
        </button>
        <button
          type="button"
          className={activeProfileTab === 'settings' ? 'active' : ''}
          onClick={() => selectProfileTab('settings')}
          data-tour="profile-tab-settings"
        >
          Profil
        </button>
        <button
          type="button"
          className={activeProfileTab === 'badges' ? 'active' : ''}
          onClick={() => selectProfileTab('badges')}
          data-tour="profile-tab-badges"
        >
          Badges
        </button>
        {isProAccount ? (
          <button
            type="button"
            className={activeProfileTab === 'pro' ? 'active' : ''}
            onClick={() => selectProfileTab('pro')}
            data-tour="profile-tab-pro"
          >
            Pro
          </button>
        ) : null}
      </div>
    </section>
  );

  return (
    <main className="layout">
      <ProfileHeader
        user={user}
        authorProfile={authorProfile}
        canOpenAdmin={canOpenAdmin}
        ordersCount={orders.length}
        isBusy={isBusy}
        isProfileTutorialActive={isProfileTutorialActive}
        tutorialMenuRef={tutorialMenuRef}
        mobileSectionMenu={isMobileProfileNav ? profileSectionMenu : null}
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

      {isMobileProfileNav ? null : profileSectionMenu}

      {activeProfileTab === 'new-project' ? (
        <CreateProjectPanel
          isBusy={isBusy}
          onCreateProject={onCreateProject}
          onImportProject={onImportProject}
        />
      ) : null}

      {activeProfileTab === 'projects' ? (
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
      ) : null}

      {activeProfileTab === 'badges' ? (
        <ProfileBadgesPanel
          projects={classicProjects}
          mediaLibrary={mediaLibrary}
          authorProfile={authorProfile}
          badgeEvents={badgeEvents}
          followersCount={followersCount}
          userKey={shopUserId}
        />
      ) : null}

      {activeProfileTab === 'media' ? (
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
      ) : null}

      {activeProfileTab === 'publication' ? (
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
      ) : null}

      {activeProfileTab === 'pro' && isProAccount ? (
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
          onUpdateAccountProfile={onUpdateAccountProfile}
          onUpdatePassword={onUpdatePassword}
        />
      ) : null}
    </main>
  );
}
