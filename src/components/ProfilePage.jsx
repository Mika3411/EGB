import React, { useEffect, useRef, useState } from 'react';
import CreateProjectPanel from './profile/CreateProjectPanel';
import OrdersPanel from './profile/OrdersPanel';
import ProfileHeader from './profile/ProfileHeader';
import ProfileMediaTab from './profile/ProfileMediaTab';
import PublicationPanel from './profile/PublicationPanel';
import ProjectList from './profile/ProjectList';
import { readShopPurchases } from '../lib/shopPurchases';

export default function ProfilePage({
  user,
  canOpenAdmin = false,
  projects = [],
  activeProjectId = '',
  isBusy = false,
  statusMessage = '',
  syncStatus = 'offline',
  onCreateProject,
  onOpenProject,
  onTestProject,
  onCopyProjectLink,
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
  mediaLibrary = [],
  storageSummary = null,
  aiCreditBalance = 0,
  onBuyStorage,
  onLogout,
  isProfileTutorialActive = false,
}) {
  const [activeProfileTab, setActiveProfileTab] = useState('projects');
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

      <section className="panel profile-section-tabs" aria-label="Navigation profil">
        <button
          type="button"
          className={activeProfileTab === 'projects' ? 'active' : ''}
          onClick={() => setActiveProfileTab('projects')}
        >
          Projets
        </button>
        <button
          type="button"
          className={activeProfileTab === 'media' ? 'active' : ''}
          onClick={() => setActiveProfileTab('media')}
        >
          Medias
        </button>
        <button
          type="button"
          className={activeProfileTab === 'publication' ? 'active' : ''}
          onClick={() => setActiveProfileTab('publication')}
        >
          Publication
        </button>
      </section>

      {activeProfileTab === 'projects' ? (
        <>
          <CreateProjectPanel
            isBusy={isBusy}
            onCreateProject={onCreateProject}
            onImportProject={onImportProject}
          />

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
        </>
      ) : null}

      {activeProfileTab === 'media' ? (
        <ProfileMediaTab
          projects={projects}
          mediaLibrary={mediaLibrary}
          onImportMediaFile={onImportMediaFile}
          onDeleteMedia={onDeleteMedia}
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
          onPublishProject={onPublishProject}
          onUnpublishProject={onUnpublishProject}
          onUpdatePublicSettings={onUpdatePublicSettings}
          onUploadGalleryThumbnail={onUploadGalleryThumbnail}
        />
      ) : null}
    </main>
  );
}
