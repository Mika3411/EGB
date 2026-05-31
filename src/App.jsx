import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { useAccessibleDialog } from './components/AccessibleDialog';
import { useAccountStorage } from './hooks/useAccountStorage';
import { useLocalAuth } from './hooks/useLocalAuth';
import { upsertProjectAsset } from './lib/assetManager';
import { isAdminAccount } from './lib/authStorage';
import { hasSupabaseStorageConfig } from './supabaseStorage';
import { readAppUiState, writeAppUiState } from './utils/storageHelpers';
import { lazyWithRetry } from './utils/lazyImportRetry';

const LandingPage = lazyWithRetry(() => import('./components/LandingPage'));
const AuthPanel = lazyWithRetry(() => import('./components/AuthPanel'));
const ProfilePage = lazyWithRetry(() => import('./components/ProfilePage'));
const AdminPage = lazyWithRetry(() => import('./components/AdminPage'));
const PublicGallery = lazyWithRetry(() => import('./components/PublicGallery'));
const BuilderApp = lazyWithRetry(() => import('./BuilderApp.jsx'));
const BuilderTutorial = lazyWithRetry(() => import('./components/BuilderTutorial'));
const Rpg3DMode = lazyWithRetry(() => import('./components/Rpg3DMode'));
const StuntAnimationPage = lazyWithRetry(() => import('./components/StuntAnimationPage.jsx'));

const TabLoadingFallback = () => (
  <section className="panel">
    <p className="small-note">Chargement...</p>
  </section>
);

const LandingLoadingFallback = () => (
  <main
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
      background: '#030712',
      color: '#f8fbff',
    }}
  >
    <section
      style={{
        width: 'min(420px, 100%)',
        display: 'grid',
        gap: '10px',
        padding: '22px',
        border: '1px solid rgba(96, 165, 250, .28)',
        borderRadius: '18px',
        background: 'rgba(8, 16, 30, .94)',
        boxShadow: '0 24px 70px rgba(0, 0, 0, .42)',
        textAlign: 'center',
      }}
    >
      <strong style={{ fontSize: '18px' }}>Escape Game Studio</strong>
      <span style={{ color: '#a9bdd8', fontSize: '14px' }}>Chargement...</span>
    </section>
  </main>
);

const createShellInitialScreen = () => {
  if (typeof window === 'undefined') return 'profile';
  const params = new URLSearchParams(window.location.search);
  if (params.get('stunt') === '1') return 'stunts';
  if (params.get('arcade') === '1') return 'arcade';
  if (params.get('playUser') && params.get('playProject')) return 'shared-preview';
  if (params.get('gallery') === '1' || window.__escapeInitialGalleryGame) return 'gallery';
  const savedState = readAppUiState();
  if (savedState.screen === 'builder' && savedState.builderScreen !== 'shared-preview') return 'builder';
  return 'profile';
};

const createInitialBuilderLaunch = () => {
  const savedState = readAppUiState();
  const shouldResumeBuilder = savedState.screen === 'builder' && savedState.builderScreen !== 'shared-preview';
  return {
    projectId: shouldResumeBuilder ? savedState.projectId || '' : '',
    tab: shouldResumeBuilder ? savedState.tab || '' : '',
    tutorialTab: '',
    screen: createShellInitialScreen() === 'shared-preview' ? 'shared-preview' : 'editor',
    key: 0,
  };
};

function ShellApp() {
  const auth = useLocalAuth();
  const {
    alert: alertDialog,
    confirm: confirmDialog,
    dialog: accessibleDialog,
    prompt: promptDialog,
  } = useAccessibleDialog();
  const [screen, setScreen] = useState(createShellInitialScreen);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState('login');
  const [saveStatus, setSaveStatus] = useState('');
  const [aiCreditBalance] = useState(0);
  const [profileTutorialSteps, setProfileTutorialSteps] = useState([]);
  const [profileTutorialStepIndex, setProfileTutorialStepIndex] = useState(null);
  const [builderLaunch, setBuilderLaunch] = useState(createInitialBuilderLaunch);

  const {
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    storageSummary,
    updateStorageQuotaBytes,
  } = useAccountStorage({
    activeProject: auth.activeProject?.data,
    activeProjectId: auth.activeProjectId,
    projects: auth.projects,
  });

  const openLoginPanel = useCallback(() => {
    setAuthEntryMode('login');
    setShowAuthPanel(true);
  }, []);

  const openRegisterPanel = useCallback(() => {
    setAuthEntryMode('register');
    setShowAuthPanel(true);
  }, []);

  const closeAuthPanel = useCallback(() => {
    setShowAuthPanel(false);
  }, []);

  const openProfileScreen = useCallback((options = {}) => {
    const statusMessage = options && typeof options === 'object' && typeof options.statusMessage === 'string'
      ? options.statusMessage
      : '';
    if (statusMessage) setSaveStatus(statusMessage);
    writeAppUiState({ screen: 'profile' });
    setScreen('profile');
  }, []);

  const openGalleryScreen = useCallback(() => {
    writeAppUiState({ screen: 'gallery' });
    setScreen('gallery');
  }, []);

  const openAdminScreen = useCallback(() => {
    writeAppUiState({ screen: 'admin' });
    setScreen('admin');
  }, []);

  const openPublicGalleryWindow = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('gallery', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, []);

  const startProfileTutorial = useCallback(async () => {
    const { BUILDER_TUTORIAL_STEPS, getTutorialStepIndexes } = await import('./data/tutorialStepData');
    setProfileTutorialSteps(BUILDER_TUTORIAL_STEPS);
    setProfileTutorialStepIndex(getTutorialStepIndexes('profile')[0] ?? null);
  }, []);

  const closeProfileTutorial = useCallback(() => {
    setProfileTutorialStepIndex(null);
  }, []);

  const openBuilder = useCallback((projectId = '', tab = '', builderScreen = 'editor', tutorialTab = '') => {
    writeAppUiState({
      screen: 'builder',
      builderScreen,
      projectId,
      tab,
    });
    setBuilderLaunch((current) => ({
      projectId,
      tab,
      tutorialTab,
      screen: builderScreen,
      key: current.key + 1,
    }));
    setScreen(builderScreen === 'shared-preview' ? 'shared-preview' : 'builder');
  }, []);

  const createProjectFromProfile = useCallback(async (name, templateId = 'empty', creationMode = 'beginner', options = {}) => {
    const [{ createInitialProject }, { applyCreationTemplate }] = await Promise.all([
      import('./data/projectData'),
      import('./lib/projectTemplates'),
    ]);
    const project = applyCreationTemplate(createInitialProject(), templateId, name);
    project.creationMode = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'].includes(creationMode) ? creationMode : 'beginner';
    const record = await auth.createProject(project, name || project.title);
    if (record?.id) openBuilder(record.id, '', 'editor', options.startCreationGuide ? 'guided_creation' : '');
    return record;
  }, [auth.createProject, openBuilder]);

  const openProjectInEditor = useCallback(async (projectId, options = {}) => {
    await auth.loadProject(projectId);
    openBuilder(projectId, options.tab || '');
  }, [auth.loadProject, openBuilder]);

  const testProjectFromProfile = useCallback(async (projectId) => {
    await openProjectInEditor(projectId, { tab: 'preview' });
  }, [openProjectInEditor]);

  const renameProjectFromProfile = useCallback(async (projectId, name) => {
    await auth.renameProject(projectId, name);
    setSaveStatus('Projet renommé');
  }, [auth.renameProject]);

  const updateProjectModeFromProfile = useCallback(async (projectId, creationMode) => {
    await auth.updateProjectMode(projectId, creationMode);
    setSaveStatus('Mode du projet mis à jour');
  }, [auth.updateProjectMode]);

  const duplicateProjectFromProfile = useCallback(async (projectId) => {
    const copy = await auth.duplicateProject(projectId);
    setSaveStatus(copy ? 'Projet dupliqué' : 'Duplication impossible');
  }, [auth.duplicateProject]);

  const deleteProjectFromProfile = useCallback(async (projectId, label = '') => {
    const confirmed = await confirmDialog({
      title: 'Supprimer le projet',
      message: `Supprimer "${label || 'ce projet'}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    await auth.deleteProject(projectId);
    setSaveStatus('Projet supprimé');
  }, [auth.deleteProject, confirmDialog]);

  const shareProjectFromProfile = useCallback(async (projectId) => {
    if (!auth.user?.id || !projectId) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('playUser', auth.user.id);
    url.searchParams.set('playProject', projectId);
    try {
      await auth.markProjectLinkCopied(projectId);
      await navigator.clipboard.writeText(url.toString());
      setSaveStatus('Lien joueur public copié');
    } catch {
      await promptDialog({
        title: 'Lien jouable',
        message: 'Copie ce lien pour partager le projet.',
        defaultValue: url.toString(),
        confirmLabel: 'Fermer',
      });
      setSaveStatus('Lien joueur public généré');
    }
  }, [auth.markProjectLinkCopied, auth.user?.id, promptDialog]);

  const publishProjectFromProfile = useCallback(async (projectId) => {
    await auth.publishProject(projectId);
    setSaveStatus('Jeu publié dans la galerie');
  }, [auth.publishProject]);

  const unpublishProjectFromProfile = useCallback(async (projectId) => {
    const confirmed = await confirmDialog({
      title: 'Retirer de la galerie',
      message: 'Retirer ce jeu de la galerie publique ? Le projet restera dans ton profil.',
      confirmLabel: 'Retirer',
      variant: 'danger',
    });
    if (!confirmed) return;
    await auth.unpublishProject(projectId);
    setSaveStatus('Jeu retiré de la galerie');
  }, [auth.unpublishProject, confirmDialog]);

  const updatePublicSettingsFromProfile = useCallback(async (projectId, settings) => {
    await auth.updateProjectShareSettings(projectId, settings);
    setSaveStatus('Paramètres publics mis à jour');
  }, [auth.updateProjectShareSettings]);

  const uploadGalleryThumbnail = useCallback(async (file) => {
    if (!file) throw new Error('Aucune miniature à envoyer.');
    const { fileToDataURL, uploadFileToSupabase } = await import('./utils/fileHelpers');
    if (!hasSupabaseStorageConfig()) {
      return {
        publicUrl: await fileToDataURL(file),
        storageMode: 'local',
      };
    }
    const result = await uploadFileToSupabase(file, {
      userId: auth.user?.id,
      folder: 'gallery-thumbnails',
      optimizeImage: false,
    });
    return {
      publicUrl: result.publicUrl,
      storageMode: 'supabase',
    };
  }, [auth.user?.id]);

  const importProjectFromProfile = useCallback(async (file) => {
    const { normalizeProject } = await import('./data/projectData');
    const text = await file.text();
    const parsed = normalizeProject(JSON.parse(text));
    const record = await auth.importProject(parsed, parsed.title || file.name.replace(/\.json$/i, ''));
    setSaveStatus('Projet importé');
    if (record?.id) openBuilder(record.id);
  }, [auth.importProject, openBuilder]);

  const importProfileMediaFile = useCallback(async (file) => {
    if (!file) return null;
    const { fileToDataURL } = await import('./utils/fileHelpers');
    const projectRecord = auth.projects.find((project) => project.id === auth.activeProjectId) || auth.projects[0];
    if (!projectRecord?.data) return null;
    const dataUrl = await fileToDataURL(file);
    const nextProject = structuredClone(projectRecord.data);
    const asset = upsertProjectAsset(nextProject, {
      url: dataUrl,
      name: file.name,
      type: file.type?.startsWith('audio/') ? 'audio' : 'image',
      size: file.size || 0,
      storageMode: 'local',
    });
    await auth.saveProject(nextProject, projectRecord.id, projectRecord.uiState || {});
    invalidateStorageUsage();
    setSaveStatus('Média importé');
    return asset || null;
  }, [auth.activeProjectId, auth.projects, auth.saveProject, invalidateStorageUsage]);

  const deleteMediaFromProfile = useCallback(async (asset) => {
    if (!asset?.url) return;
    const confirmed = await confirmDialog({
      title: 'Supprimer ce média',
      message: 'Supprimer ce média des projets où il est référencé ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    const { removeMediaAssetsFromProject } = await import('./utils/mediaProjectHelpers');
    const urlsToDelete = [...new Set([asset.url, ...(asset.urls || [])].filter(Boolean))];
    const assetIdsToDelete = [...new Set([asset.assetId, ...(asset.assetIds || [])].filter(Boolean))];
    const nextProjects = auth.projects.map((projectRecord) => ({
      ...projectRecord,
      data: removeMediaAssetsFromProject(projectRecord.data, { urls: urlsToDelete, assetIds: assetIdsToDelete }),
    }));
    await auth.saveProjects(nextProjects, auth.activeProjectId);
    invalidateStorageUsage();
    setSaveStatus('Média supprimé');
  }, [auth.activeProjectId, auth.projects, auth.saveProjects, confirmDialog, invalidateStorageUsage]);

  const updateAuthorProfileFromProfile = useCallback(async (profile) => {
    await auth.updateAuthorProfile(profile);
    setSaveStatus('Profil auteur mis à jour');
  }, [auth.updateAuthorProfile]);

  const buyStorageFromProfile = useCallback(async () => {
    const usageBytes = await getCurrentStorageUsageBytes();
    updateStorageQuotaBytes(usageBytes + 100 * 1024 * 1024);
    setSaveStatus('Stockage mis à jour');
  }, [getCurrentStorageUsageBytes, updateStorageQuotaBytes]);

  const profileTutorialIndexes = useMemo(() => profileTutorialSteps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => (step.tutorial || step.tab) === 'profile')
    .map(({ index }) => index), [profileTutorialSteps]);
  const profileTutorialPosition = profileTutorialIndexes.indexOf(profileTutorialStepIndex);
  const activeProfileTutorialStep = profileTutorialStepIndex === null ? null : profileTutorialSteps[profileTutorialStepIndex];
  const tutorialUserName = auth.user?.name || auth.user?.pseudo || auth.user?.username || auth.user?.email?.split('@')?.[0] || '';
  const profileTutorialOverlay = activeProfileTutorialStep ? (
    <Suspense fallback={null}>
      <BuilderTutorial
        step={activeProfileTutorialStep}
        stepNumber={Math.max(0, profileTutorialPosition) + 1}
        totalSteps={profileTutorialIndexes.length || 1}
        canPrevious={profileTutorialPosition > 0}
        userName={tutorialUserName}
        project={null}
        fakeFileOptions={[]}
        onFakeFileChosen={() => {}}
        onNext={() => {
          setProfileTutorialStepIndex((index) => (
            index === null || profileTutorialPosition >= profileTutorialIndexes.length - 1
              ? null
              : profileTutorialIndexes[profileTutorialPosition + 1]
          ));
        }}
        onPrevious={() => {
          setProfileTutorialStepIndex(profileTutorialIndexes[Math.max(0, profileTutorialPosition - 1)] ?? null);
        }}
        onClose={closeProfileTutorial}
      />
    </Suspense>
  ) : null;

  const renderAuthEntryScreen = () => {
    if (!showAuthPanel && !auth.isPasswordRecovery) {
      return (
        <Suspense fallback={<LandingLoadingFallback />}>
          <LandingPage
            onLogin={openLoginPanel}
            onRegister={openRegisterPanel}
            onOpenGallery={openGalleryScreen}
          />
        </Suspense>
      );
    }

    return (
      <div className="app-shell">
        <Suspense fallback={<TabLoadingFallback />}>
          <AuthPanel
            onLogin={auth.login}
            onRegister={auth.register}
            onRequestPasswordReset={auth.requestPasswordReset}
            onUpdatePassword={auth.updatePassword}
            onBack={closeAuthPanel}
            initialMode={authEntryMode}
            isPasswordRecovery={auth.isPasswordRecovery}
            isBusy={auth.isBusy}
            errorMessage={auth.authError}
          />
        </Suspense>
        {accessibleDialog}
      </div>
    );
  };

  if (screen === 'builder' || screen === 'shared-preview') {
    return (
      <Suspense fallback={<LandingLoadingFallback />}>
        <BuilderApp
          key={builderLaunch.key}
          auth={auth}
          initialProjectId={builderLaunch.projectId}
          initialTab={builderLaunch.tab}
          initialTutorialTab={builderLaunch.tutorialTab}
          initialScreen={builderLaunch.screen}
          onExitToProfile={openProfileScreen}
        />
      </Suspense>
    );
  }

  if (screen === 'arcade') {
    if (!auth.isReady) {
      return <div className="app-shell"><div className="panel">Chargement du compte...</div></div>;
    }
    return (
      <Suspense fallback={<LandingLoadingFallback />}>
        <Rpg3DMode
          user={auth.user}
          authorProfile={auth.authorProfile}
          authReady={auth.isReady}
          projectId={auth.activeProjectId || auth.activeProject?.id || ''}
          project={auth.activeProject?.data || null}
        />
      </Suspense>
    );
  }

  if (screen === 'stunts') {
    return (
      <Suspense fallback={<LandingLoadingFallback />}>
        <StuntAnimationPage
          onBack={() => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('stunt');
              window.history.replaceState({}, '', url.toString());
            }
            writeAppUiState({ screen: 'profile' });
            setScreen('profile');
          }}
        />
      </Suspense>
    );
  }

  if (screen === 'gallery') {
    return (
      <Suspense fallback={<TabLoadingFallback />}>
        <PublicGallery
          user={auth.user}
          authorProfile={auth.authorProfile}
          initialGameKey={window.__escapeInitialGalleryGame || ''}
          initialCreatorId={window.__escapeInitialGalleryCreator || ''}
          onUpdateAuthorProfile={updateAuthorProfileFromProfile}
          onSignup={openProfileScreen}
          onClose={auth.user ? openProfileScreen : null}
        />
      </Suspense>
    );
  }

  if (!auth.isReady) {
    return <div className="app-shell"><div className="panel">Chargement du compte...</div></div>;
  }

  if (!auth.user) {
    return renderAuthEntryScreen();
  }

  if (screen === 'admin') {
    if (!isAdminAccount(auth.user)) {
      return (
        <div className="app-shell">
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Admin</span>
                <h2>Accès admin refusé</h2>
                <p className="small-note">Reconnecte-toi avec un compte admin pour ouvrir cette zone.</p>
              </div>
              <button type="button" className="secondary-action" onClick={openProfileScreen}>
                Retour profil
              </button>
            </div>
          </section>
          {accessibleDialog}
        </div>
      );
    }

    return (
      <div className="app-shell">
        <Suspense fallback={<TabLoadingFallback />}>
          <AdminPage
            user={auth.user}
            projects={auth.projects}
            onBack={openProfileScreen}
            onLogout={auth.logout}
            onOpenProject={openProjectInEditor}
          />
        </Suspense>
        {accessibleDialog}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<TabLoadingFallback />}>
        <ProfilePage
          user={auth.user}
          canOpenAdmin={isAdminAccount(auth.user)}
          projects={auth.projects}
          activeProjectId={auth.activeProjectId}
          authorProfile={auth.authorProfile}
          isBusy={auth.isBusy}
          statusMessage={saveStatus}
          syncStatus={auth.isBusy ? 'syncing' : hasSupabaseStorageConfig() ? 'synced' : 'offline'}
          onCreateProject={createProjectFromProfile}
          onOpenProject={openProjectInEditor}
          onTestProject={testProjectFromProfile}
          onCopyProjectLink={shareProjectFromProfile}
          onPublishProject={publishProjectFromProfile}
          onUnpublishProject={unpublishProjectFromProfile}
          onUpdatePublicSettings={updatePublicSettingsFromProfile}
          onUploadGalleryThumbnail={uploadGalleryThumbnail}
          onOpenPublicGallery={openPublicGalleryWindow}
          onOpenAdmin={openAdminScreen}
          onStartTutorial={(tab) => {
            if (tab === 'profile') {
              startProfileTutorial();
              return;
            }
            openBuilder(auth.activeProjectId || auth.projects[0]?.id || '', '', 'editor', tab);
          }}
          onRenameProject={renameProjectFromProfile}
          onUpdateProjectMode={updateProjectModeFromProfile}
          onDuplicateProject={duplicateProjectFromProfile}
          onDeleteProject={deleteProjectFromProfile}
          onDeleteMedia={deleteMediaFromProfile}
          onImportProject={importProjectFromProfile}
          onImportMediaFile={importProfileMediaFile}
          onUpdateAuthorProfile={auth.updateAuthorProfile}
          onUpdatePassword={auth.updatePassword}
          onRefreshStorageUsage={getCurrentStorageUsageBytes}
          storageSummary={storageSummary}
          aiCreditBalance={aiCreditBalance}
          onBuyStorage={buyStorageFromProfile}
          onLogout={auth.logout}
          isProfileTutorialActive={Boolean(activeProfileTutorialStep)}
        />
      </Suspense>
      {accessibleDialog}
      {profileTutorialOverlay}
    </div>
  );
}

export default ShellApp;
