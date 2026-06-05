import React, { useEffect, useRef, useState } from 'react';
import CreateProjectPanel from './components/CreateProjectPanel';
import OrdersPanel from './components/OrdersPanel';
import ProfileHeader from './components/ProfileHeader';
import ProfileMediaPanel from './components/ProfileMediaPanel';
import ProfileMessagesPanel from './components/ProfileMessagesPanel';
import ProfileSettingsPanel from './components/ProfileSettingsPanel';
import PublicationPanel from './components/PublicationPanel';
import ProjectList from './components/ProjectList';
import { readShopPurchases } from '../../shared/services/shopPurchases';

const getProfileTutorialTab = (step = {}) => {
  const selector = `${step?.selector || ''} ${step?.fallbackSelector || ''}`;
  if (/profile-(create-section|mode-picker|template-picker|create-button|guided-create-button|import-section)/.test(selector)) {
    return 'new-project';
  }
  if (/profile-(projects-section|project-filters|project-list|project-card|project-actions|project-test)/.test(selector)) {
    return 'projects';
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
  const [orders, setOrders] = useState(() => readShopPurchases(shopUserId));

  const refreshOrders = () => {
    setOrders(readShopPurchases(shopUserId));
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
          className={activeProfileTab === 'media' ? 'active' : ''}
          onClick={() => setActiveProfileTab('media')}
          data-tour="profile-tab-media"
        >
          Médias
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
          onTestProject={onTestProject}
          onRenameProject={onRenameProject}
          onUpdateProjectMode={onUpdateProjectMode}
          onDuplicateProject={onDuplicateProject}
          onDeleteProject={onDeleteProject}
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
