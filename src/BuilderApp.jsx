import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import { TABS, getTabKey } from './components/TabRegistry.jsx';
import { useAccessibleDialog } from './components/AccessibleDialog';
import { createInitialProject, normalizeProject } from './data/projectData';
import {
  BUILDER_TUTORIAL_TABS,
  getFakeWindowImageOptions,
  getTutorialName,
  prepareProjectForGuidedCreation,
  prepareProjectForTutorial,
} from './data/tutorialSteps';
import {
  IMAGE_UPLOAD_OPTIMIZATION,
  fileToDataURL,
  imageFileToOptimizedBlob,
  uploadFileToSupabase,
} from './utils/fileHelpers';
import {
  dataUrlToBlob,
  extensionFromMime,
} from './utils/mediaProjectHelpers';
import {
  getAnime2dDraftMeta,
  getAnime2dStorageId,
  readBuilderUiState,
  writeAppUiState,
  writeBuilderUiState,
} from './utils/storageHelpers';
import {
  getProfileTutorialSeenKey,
  getProjectMode,
  getSafeBuilderTab,
  isBuilderTab,
  isTabAllowedForProject,
} from './utils/tutorialHelpers';
import { exportProjectJson } from './utils/exportProjectJson';
import { exportAuthorSummary } from './utils/exportAuthorSummary';
import { mergeProjectPatch, validateProject } from './utils/projectValidation';
import { calculateProjectScore } from './lib/projectScoreEngine';
import { useProjectEditor } from './hooks/useProjectEditor.jsx';
import { usePreviewPlayer } from './hooks/usePreviewPlayer';
import { useSharedPlayableRoute } from './hooks/useSharedPlayableRoute';
import { getProjectSaveStatus, useAutosaveProject } from './hooks/useAutosaveProject';
import { useAccountStorage } from './hooks/useAccountStorage';
import { useProfileProjectActions } from './hooks/useProfileProjectActions';
import { useProfileMediaActions } from './hooks/useProfileMediaActions';
import { collectDescendantSceneIds } from './lib/sceneHelpers';
import { collectProjectAssetManifest, collectProjectAssets, upsertProjectAsset } from './lib/assetManager';
import { formatStorageSize } from './lib/storageQuota';
import { isAdminAccount } from './lib/authStorage';
import {
  buildStoragePath,
  generateStorageFilename,
  getSupabaseClient,
  hasSupabaseAuthConfig,
  hasSupabaseStorageConfig,
  uploadToStorage,
} from './supabaseStorage';

const AI_CREDITS_ENDPOINT = import.meta.env.VITE_AI_CREDITS_ENDPOINT || '/api/ai-credits';
const PROJECT_AUTOSAVE_ENABLED = true;

const LandingPage = React.lazy(() => import('./components/LandingPage'));
const BuilderTutorial = React.lazy(() => import('./components/BuilderTutorial'));
const AuthPanel = React.lazy(() => import('./components/AuthPanel'));
const ProfilePage = React.lazy(() => import('./components/ProfilePage'));
const AdminPage = React.lazy(() => import('./components/AdminPage'));
const PublicGallery = React.lazy(() => import('./components/PublicGallery'));

const isAdminUser = (user) => isAdminAccount(user);
const TabLoadingFallback = () => (
  <section className="panel">
    <p className="small-note">Chargement de l'onglet...</p>
  </section>
);
const getTutorialStepIndexesFromSteps = (steps, tab) => (steps || [])
  .map((step, index) => ({ step, index }))
  .filter(({ step }) => (step.tutorial || step.tab) === tab)
  .map(({ index }) => index);
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

const getWindowScrollPosition = () => {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.round(window.scrollX || window.pageXOffset || document.documentElement?.scrollLeft || 0)),
    y: Math.max(0, Math.round(window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0)),
  };
};

const restoreWindowScrollPosition = (position) => {
  if (typeof window === 'undefined' || !position) return;
  const x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0;
  const y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0;
  window.scrollTo(x, y);
};

const EDITOR_SCROLL_SELECTORS = [
  '.panel-nav-pro',
  '.panel-context-pro',
  '.scene-left-nav',
  '.side-editor-pro',
];

const getEditorScrollPosition = () => {
  if (typeof document === 'undefined') return { window: getWindowScrollPosition(), elements: [] };
  const elements = EDITOR_SCROLL_SELECTORS.flatMap((selector) => (
    Array.from(document.querySelectorAll(selector)).map((element, index) => ({
      selector,
      index,
      left: Math.max(0, Math.round(element.scrollLeft || 0)),
      top: Math.max(0, Math.round(element.scrollTop || 0)),
    }))
  ));
  return {
    window: getWindowScrollPosition(),
    elements,
  };
};

const restoreEditorScrollPosition = (position) => {
  if (!position) return;
  restoreWindowScrollPosition(position.window || position);
  if (typeof document === 'undefined' || !Array.isArray(position.elements)) return;
  position.elements.forEach(({ selector, index, left = 0, top = 0 }) => {
    const element = document.querySelectorAll(selector)?.[index];
    if (element) {
      element.scrollLeft = left;
      element.scrollTop = top;
    }
  });
};

function BuilderApp({
  auth,
  initialProjectId = '',
  initialTab = '',
  initialTutorialTab = '',
  initialScreen = 'editor',
  onExitToProfile,
}) {
  const editor = useProjectEditor();
  const preview = usePreviewPlayer(editor.project, { getItemById: editor.getItemById });
  const {
    alert: alertDialog,
    confirm: confirmDialog,
    dialog: accessibleDialog,
  } = useAccessibleDialog();
  const [saveStatus, setSaveStatus] = useState('');
  const [screen, setScreen] = useState(initialScreen);
  const [projectScore, setProjectScore] = useState(null);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState('login');
  const [sharedLoadStatus, setSharedLoadStatus] = useState('');
  const [tutorialStepIndex, setTutorialStepIndex] = useState(null);
  const [selectedTutorialTab, setSelectedTutorialTab] = useState('scenes');
  const [tutorialSteps, setTutorialSteps] = useState([]);
  const [aiCreditBalance, setAiCreditBalance] = useState(0);
  const [heroCharacterPreviewRequestKey, setHeroCharacterPreviewRequestKey] = useState(0);
  const hydratedProjectRef = useRef('');
  const profileTutorialAutoStartedRef = useRef('');
  const tutorialStepsPromiseRef = useRef(null);
  const initialProjectLoadRef = useRef('');
  const initialTutorialStartRef = useRef('');
  const restoredScrollKeyRef = useRef('');
  const saveScrollTimerRef = useRef(null);
  const activeBuilderProjectId = hydratedProjectRef.current || auth.activeProjectId || initialProjectId || '';
  useEffect(() => {
    if (screen !== 'editor') {
      setProjectScore(null);
      return undefined;
    }

    let isCancelled = false;
    setProjectScore(null);
    const calculate = () => {
      if (!isCancelled) setProjectScore(calculateProjectScore(editor.project));
    };
    const idleId = typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback(calculate, { timeout: 1200 })
      : window.setTimeout(calculate, 0);

    return () => {
      isCancelled = true;
      if (typeof window !== 'undefined' && window.cancelIdleCallback && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [editor.project, screen]);
  const openLoginPanel = useCallback(() => {
    setAuthEntryMode('login');
    setShowAuthPanel(true);
  }, []);
  const openRegisterPanel = useCallback(() => {
    setAuthEntryMode('register');
    setShowAuthPanel(true);
  }, []);
  const closeAuthPanel = useCallback(() => setShowAuthPanel(false), []);
  const openGalleryScreen = useCallback(() => setScreen('gallery'), []);
  const openProfileScreen = useCallback(() => setScreen('profile'), []);
  const openAdminScreen = useCallback(() => setScreen('admin'), []);
  const sharedRouteRef = useSharedPlayableRoute({
    editor,
    preview,
    setScreen,
    setSharedLoadStatus,
  });
  const builderResumeAttemptedRef = useRef(false);
  const anime2dSaveBeforeLeaveRef = useRef(null);
  const [anime2dHasUnsavedChanges, setAnime2dHasUnsavedChanges] = useState(false);
  const loadTutorialSteps = useCallback(async () => {
    if (tutorialSteps.length) return tutorialSteps;
    if (!tutorialStepsPromiseRef.current) {
      tutorialStepsPromiseRef.current = import('./data/tutorialStepData').then((module) => module.BUILDER_TUTORIAL_STEPS || []);
    }
    const steps = await tutorialStepsPromiseRef.current;
    setTutorialSteps(steps);
    return steps;
  }, [tutorialSteps]);
  const activeTutorialIndexes = useMemo(() => (
    tutorialStepIndex === null ? [] : getTutorialStepIndexesFromSteps(tutorialSteps, selectedTutorialTab)
  ), [selectedTutorialTab, tutorialStepIndex, tutorialSteps]);
  const activeTutorialPosition = activeTutorialIndexes.indexOf(tutorialStepIndex);
  const activeTutorialStep = tutorialStepIndex === null ? null : tutorialSteps[tutorialStepIndex] || null;
  const tutorialUserName = getTutorialName(auth.user);
  useEffect(() => {
    const safeTab = getSafeBuilderTab(editor.tab, editor.project);
    if (safeTab !== editor.tab) editor.setTab(safeTab);
  }, [editor.project, editor.setTab, editor.tab]);
  const {
    accountStorageQuotaBytes,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    storageSummary,
    updateStorageQuotaBytes,
  } = useAccountStorage({
    activeProject: editor.project,
    activeProjectId: auth.activeProjectId,
    projects: auth.projects,
  });
  const profileProjects = useMemo(() => (auth.projects || []).map((projectRecord) => (
    projectRecord.id === auth.activeProjectId ? { ...projectRecord, data: editor.project } : projectRecord
  )), [auth.activeProjectId, auth.projects, editor.project]);
  const activeProjectRecord = useMemo(() => {
    const record = (auth.projects || []).find((projectRecord) => projectRecord.id === auth.activeProjectId);
    return record ? { ...record, data: editor.project } : null;
  }, [auth.activeProjectId, auth.projects, editor.project]);

  useEffect(() => {
    const placeHelpTooltip = (target) => {
      if (!(target instanceof HTMLElement) || !target.classList.contains('help-dot')) return;
      const rect = target.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(280, Math.max(180, window.innerWidth - margin * 2));
      let left = rect.right + 10;
      if (left + width + margin > window.innerWidth) left = rect.left - width - 10;
      if (left < margin) {
        left = rect.left + (rect.width / 2) - (width / 2);
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

      const estimatedHeight = 112;
      let top = rect.top + (rect.height / 2) - (estimatedHeight / 2);
      top = Math.max(margin, Math.min(top, window.innerHeight - estimatedHeight - margin));

      target.style.setProperty('--help-left', `${Math.round(left)}px`);
      target.style.setProperty('--help-top', `${Math.round(top)}px`);
      target.style.setProperty('--help-width', `${Math.round(width)}px`);
    };

    const handlePointer = (event) => placeHelpTooltip(event.target);
    const handleScrollOrResize = () => {
      const activeHelp = document.querySelector('.help-dot:hover, .help-dot:focus');
      if (activeHelp) placeHelpTooltip(activeHelp);
    };

    document.addEventListener('pointerover', handlePointer);
    document.addEventListener('focusin', handlePointer);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('pointerover', handlePointer);
      document.removeEventListener('focusin', handlePointer);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  useEffect(() => {
    const step = activeTutorialStep;
    if (!step) return;
    if (step?.tab && step.tab !== 'profile' && editor.tab !== step.tab) editor.setTab(step.tab);
    if (selectedTutorialTab === 'guided_creation' && step.sceneTarget === 'first') {
      const firstScene = editor.project.scenes[0];
      if (firstScene?.id && editor.selectedSceneId !== firstScene.id) {
        editor.setSelectedSceneId(firstScene.id);
      }
      const guidedHotspotId = firstScene?.hotspots?.find((hotspot) => hotspot.tutorialCreated)?.id || firstScene?.hotspots?.[0]?.id || '';
      if (step.focusGuidedHotspot && guidedHotspotId && editor.selectedHotspotId !== guidedHotspotId) {
        editor.setSelectedHotspotId(guidedHotspotId);
      }
    }
    if ((selectedTutorialTab === 'editor' || selectedTutorialTab === 'guided_creation') && step?.tab === 'preview') {
      const scene = editor.project.scenes.find((entry) => entry.id === editor.selectedSceneId) || editor.project.scenes[0];
      if (!scene) return;
      preview.setPlayingCinematic(null);
      preview.setViewerImage(null);
      preview.setPlaySceneId(scene.id);
      preview.setDialogue(scene.introText || '');
    }
  }, [
    editor.project.scenes,
    editor.selectedSceneId,
    editor.selectedHotspotId,
    editor.setSelectedHotspotId,
    editor.setSelectedSceneId,
    editor.setTab,
    editor.tab,
    preview.setDialogue,
    preview.setPlaySceneId,
    preview.setPlayingCinematic,
    preview.setViewerImage,
    activeTutorialStep,
    selectedTutorialTab,
  ]);

  useEffect(() => {
    if (sharedRouteRef.current) return;
    if (!auth.user) {
      hydratedProjectRef.current = '';
      setScreen('profile');
    }
  }, [auth.user]);

  useEffect(() => {
    if (!auth.isReady || !auth.user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') !== '1') return;
    setScreen(isAdminUser(auth.user) ? 'admin' : 'profile');
  }, [auth.isReady, auth.user]);

  useEffect(() => {
    if (screen === 'admin' && auth.isReady && (!auth.user || !isAdminUser(auth.user))) {
      setScreen('profile');
    }
  }, [screen, auth.isReady, auth.user]);

  useEffect(() => {
    if (!auth.isReady || !auth.user?.id) return;
    if (screen !== 'profile') return;
    if (tutorialStepIndex !== null) return;
    if (profileTutorialAutoStartedRef.current === auth.user.id) return;

    const seenKey = getProfileTutorialSeenKey(auth.user.id);
    if (window.localStorage.getItem(seenKey) === '1') return;

    let isCancelled = false;
    profileTutorialAutoStartedRef.current = auth.user.id;
    window.localStorage.setItem(seenKey, '1');
    loadTutorialSteps().then((steps) => {
      if (isCancelled) return;
      setSelectedTutorialTab('profile');
      setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, 'profile')[0] ?? null);
    });
    return () => {
      isCancelled = true;
    };
  }, [auth.isReady, auth.user, loadTutorialSteps, screen, tutorialStepIndex]);

  const {
    markProjectSaveFailed,
    markProjectSaveStarted,
    markProjectSaved,
  } = useAutosaveProject({
    activeProjectId: auth.activeProjectId,
    enabled: PROJECT_AUTOSAVE_ENABLED,
    hydratedProjectRef,
    project: editor.project,
    saveProject: auth.saveProject,
    screen,
    selectedSceneId: editor.selectedSceneId,
    setSaveStatus,
    skipInitialProjectSave: true,
    tab: editor.tab,
    userId: auth.user?.id,
    writeBuilderUiState,
  });

  useEffect(() => {
    if (!auth.isReady) return;
    const shellScreen = screen === 'editor' || screen === 'shared-preview' ? 'builder' : screen;
    writeAppUiState({
      screen: shellScreen,
      builderScreen: screen,
      projectId: activeBuilderProjectId,
      selectedSceneId: editor.selectedSceneId,
      tab: editor.tab,
      userId: auth.user?.id || '',
    });
  }, [
    activeBuilderProjectId,
    auth.isReady,
    auth.user?.id,
    editor.selectedSceneId,
    editor.tab,
    screen,
  ]);

  useEffect(() => {
    if (screen !== 'editor') return undefined;
    if (!auth.user?.id || !activeBuilderProjectId || !isBuilderTab(editor.tab)) return undefined;

    const restoreKey = `${auth.user.id}:${activeBuilderProjectId}:${editor.tab}`;
    if (restoredScrollKeyRef.current === restoreKey) return undefined;
    restoredScrollKeyRef.current = restoreKey;

    const state = readBuilderUiState(auth.user.id, activeBuilderProjectId);
    const scrollPosition = state.scrollByTab?.[editor.tab] || null;
    if (!scrollPosition) return undefined;

    let cancelled = false;
    const timers = [0, 80, 260, 650, 1200].map((delay) => window.setTimeout(() => {
      if (!cancelled) restoreEditorScrollPosition(scrollPosition);
    }, delay));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeBuilderProjectId, auth.user?.id, editor.tab, screen]);

  useEffect(() => {
    if (screen !== 'editor') return undefined;
    if (!auth.user?.id || !activeBuilderProjectId || !isBuilderTab(editor.tab)) return undefined;

    const saveScrollPosition = () => {
      const previousState = readBuilderUiState(auth.user.id, activeBuilderProjectId);
      const previousScrollByTab = previousState.scrollByTab && typeof previousState.scrollByTab === 'object'
        ? previousState.scrollByTab
        : {};
      writeBuilderUiState(auth.user.id, activeBuilderProjectId, {
        screen: 'editor',
        selectedSceneId: editor.selectedSceneId,
        tab: editor.tab,
        scrollByTab: {
          ...previousScrollByTab,
          [editor.tab]: getEditorScrollPosition(),
        },
      });
    };

    const scheduleSave = () => {
      if (saveScrollTimerRef.current) window.clearTimeout(saveScrollTimerRef.current);
      saveScrollTimerRef.current = window.setTimeout(() => {
        saveScrollTimerRef.current = null;
        saveScrollPosition();
      }, 140);
    };

    window.addEventListener('scroll', scheduleSave, { passive: true });
    document.addEventListener('scroll', scheduleSave, true);
    window.addEventListener('beforeunload', saveScrollPosition);

    return () => {
      window.removeEventListener('scroll', scheduleSave);
      document.removeEventListener('scroll', scheduleSave, true);
      window.removeEventListener('beforeunload', saveScrollPosition);
      if (saveScrollTimerRef.current) {
        window.clearTimeout(saveScrollTimerRef.current);
        saveScrollTimerRef.current = null;
      }
      saveScrollPosition();
    };
  }, [
    activeBuilderProjectId,
    auth.user?.id,
    editor.selectedSceneId,
    editor.tab,
    screen,
  ]);

  const saveProjectAndAcknowledge = useCallback(async (projectToSave, projectId = auth.activeProjectId, uiState = {}, saveOptions = {}) => {
    const savedProjectId = projectId || auth.activeProjectId;
    markProjectSaveStarted(projectToSave, savedProjectId);
    try {
      const result = await auth.saveProject(projectToSave, projectId, uiState, saveOptions);
      markProjectSaved(projectToSave, savedProjectId, result?.syncStatus || {});
      return result;
    } catch (error) {
      markProjectSaveFailed(projectToSave, savedProjectId, uiState);
      throw error;
    }
  }, [
    auth.activeProjectId,
    auth.saveProject,
    markProjectSaveFailed,
    markProjectSaveStarted,
    markProjectSaved,
  ]);

  useEffect(() => {
    if (!auth.user?.id) {
      setAiCreditBalance(0);
      updateStorageQuotaBytes();
      return undefined;
    }

    let cancelled = false;
    const refreshCredits = async () => {
      try {
        const headers = {};
        if (hasSupabaseAuthConfig()) {
          const { data } = await getSupabaseClient().auth.getSession();
          if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
        }
        const response = await fetch(AI_CREDITS_ENDPOINT, { headers });
        if (!response.ok) throw new Error('Crédits indisponibles');
        const payload = await response.json();
        if (!cancelled) {
          setAiCreditBalance(Number(payload.balance || 0));
          updateStorageQuotaBytes(payload.storageQuotaBytes || payload.storageBytes);
        }
      } catch {
        if (!cancelled) {
          setAiCreditBalance(0);
          updateStorageQuotaBytes();
        }
      }
    };
    refreshCredits();
    return () => {
      cancelled = true;
    };
  }, [auth.user?.id, updateStorageQuotaBytes]);

  const getMediaImportInfo = useCallback((file) => {
    const mimeType = file?.type || '';
    const isImage = mimeType.startsWith('image/');
    const isAudio = mimeType.startsWith('audio/');
    const isVideo = mimeType.startsWith('video/');
    return {
      assetType: isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'unknown',
      folder: isImage ? 'images' : isAudio ? 'audio' : isVideo ? 'video' : 'files',
      isAudio,
      isImage,
      isVideo,
      mediaKind: isVideo ? 'Vidéo' : isAudio ? 'Son' : 'Média',
      shouldOptimizeImage: isImage && !['image/svg+xml', 'image/gif'].includes(mimeType),
    };
  }, []);

  const validateMediaFile = useCallback((file) => {
    if (!file) return '';
    if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
      return 'Ce fichier est vide ou illisible.';
    }
    return '';
  }, []);

  const prepareMediaFileForUpload = useCallback(async (file, mediaInfo) => {
    if (!mediaInfo.shouldOptimizeImage) {
      return {
        file,
        optimized: false,
        originalSize: file.size,
        size: file.size,
      };
    }

    const optimizedBlob = await imageFileToOptimizedBlob(file, IMAGE_UPLOAD_OPTIMIZATION);
    const extension = extensionFromMime(optimizedBlob.type || IMAGE_UPLOAD_OPTIMIZATION.mimeType);
    const optimizedName = /\.[^.]+$/.test(file.name)
      ? file.name.replace(/\.[^.]+$/, `.${extension}`)
      : `${file.name || 'media'}.${extension}`;
    const optimizedFile = optimizedBlob instanceof File
      ? optimizedBlob
      : new File([optimizedBlob], optimizedName, { type: optimizedBlob.type || IMAGE_UPLOAD_OPTIMIZATION.mimeType });
    return {
      file: optimizedFile,
      optimized: true,
      originalSize: file.size,
      size: optimizedFile.size || optimizedBlob.size || file.size,
    };
  }, []);

  const uploadMediaFile = useCallback(async (file, mediaInfo, preparedMedia = null) => {
    const uploadFile = preparedMedia?.file || file;
    const fallbackName = mediaInfo.shouldOptimizeImage
      ? (/\.[^.]+$/.test(file.name) ? file.name.replace(/\.[^.]+$/, '.webp') : `${file.name || 'media'}.webp`)
      : file.name;
    if (!hasSupabaseStorageConfig()) {
      return {
        name: fallbackName,
        optimized: Boolean(preparedMedia?.optimized),
        originalSize: preparedMedia?.originalSize || file.size,
        size: preparedMedia?.size || uploadFile.size || file.size,
        optimizedSize: preparedMedia?.size || uploadFile.size || file.size,
        url: await fileToDataURL(uploadFile),
      };
    }

    const uploaded = await uploadFileToSupabase(uploadFile, {
      userId: auth.user?.id,
      folder: mediaInfo.folder,
      optimizeImage: false,
      imageOptions: IMAGE_UPLOAD_OPTIMIZATION,
    });

    return {
      name: fallbackName,
      optimized: Boolean(preparedMedia?.optimized || uploaded.optimized),
      originalSize: preparedMedia?.originalSize || uploaded.originalSize || file.size,
      size: uploaded.optimizedSize || preparedMedia?.size || uploadFile.size || file.size,
      optimizedSize: uploaded.optimizedSize || preparedMedia?.size || uploadFile.size || file.size,
      url: uploaded.publicUrl,
    };
  }, [auth.user?.id]);

  const importMediaAsset = useCallback(async (file, {
    onImported = null,
    useActiveProjectReload = false,
  } = {}) => {
    const validationMessage = validateMediaFile(file);
    if (!file) return null;
    if (validationMessage) {
      setSaveStatus(validationMessage);
      await alertDialog({
        title: 'Import impossible',
        message: validationMessage,
      });
      return null;
    }

    const mediaInfo = getMediaImportInfo(file);

    try {
      const preparedMedia = await prepareMediaFileForUpload(file, mediaInfo);
      const usageBytes = await getCurrentStorageUsageBytes();
      if (usageBytes + preparedMedia.size > accountStorageQuotaBytes) {
        const message = `Stockage insuffisant : ${formatStorageSize(usageBytes)} / ${formatStorageSize(accountStorageQuotaBytes)} utilisés. Ce fichier pèse ${formatStorageSize(preparedMedia.size)}.`;
        setSaveStatus(message);
        await alertDialog({
          title: 'Stockage insuffisant',
          message: `${message}\n\nSupprime des médias inactifs ou augmente le stockage du compte.`,
          variant: 'danger',
        });
        return null;
      }

      const uploaded = await uploadMediaFile(file, mediaInfo, preparedMedia);
      const assetInput = {
        type: mediaInfo.assetType,
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size,
      };

      if (typeof onImported === 'function') {
        onImported(uploaded.url, uploaded.name);
      }

      if (useActiveProjectReload) {
        const nextProject = structuredClone(editor.project || createInitialProject());
        const asset = upsertProjectAsset(nextProject, assetInput);

        editor.loadProject(nextProject);
        preview.syncWithProject(nextProject);
        if (auth.user?.id) await saveProjectAndAcknowledge(nextProject, auth.activeProjectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
        invalidateStorageUsage();
        setSaveStatus(`Média importé : ${uploaded.name}`);
        return asset;
      }

      editor.patchProject((draft) => {
        upsertProjectAsset(draft, assetInput);
      }, { rememberHistory: false });
      invalidateStorageUsage();

      if (hasSupabaseStorageConfig()) {
        const savedPercent = uploaded.optimized && uploaded.originalSize > 0 && uploaded.optimizedSize > 0
          ? Math.round((1 - uploaded.optimizedSize / uploaded.originalSize) * 100)
          : 0;
        const compressionRatio = savedPercent > 0 ? ` (${savedPercent}% plus léger)` : '';
        setSaveStatus(`${mediaInfo.mediaKind} importé${mediaInfo.isImage ? 'e' : ''} dans Supabase${uploaded.optimized ? ' en WebP optimisé' : ''}${compressionRatio} : ${file.name}`);
      } else {
        setSaveStatus(`${mediaInfo.mediaKind} importé${mediaInfo.isImage ? 'e' : ''} localement${mediaInfo.shouldOptimizeImage ? ' en WebP optimisé' : ''} : ${file.name}`);
      }

      return assetInput;
    } catch (error) {
      console.error('Erreur import média', error);
      setSaveStatus('Import média impossible');
      await alertDialog({
        title: 'Import média impossible',
        message: hasSupabaseStorageConfig() ?
           "Impossible d'envoyer ce fichier vers Supabase Storage. Vérifie le bucket et les policies."
          : 'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY), VITE_SUPABASE_PUBLIC_ASSETS_BUCKET et VITE_SUPABASE_PRIVATE_DATA_BUCKET.',
        variant: 'danger',
      });
      return null;
    }
  }, [
    accountStorageQuotaBytes,
    alertDialog,
    auth.activeProjectId,
    auth.user?.id,
    editor.loadProject,
    editor.patchProject,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    getCurrentStorageUsageBytes,
    getMediaImportInfo,
    invalidateStorageUsage,
    prepareMediaFileForUpload,
    preview.syncWithProject,
    saveProjectAndAcknowledge,
    uploadMediaFile,
    validateMediaFile,
  ]);

  const handleUpload = useCallback(async (event, callback) => {
    try {
      await importMediaAsset(event.target.files?.[0], {
        onImported: callback,
      });
    } finally {
      event.target.value = '';
    }
  }, [importMediaAsset]);

  const importProfileMediaFile = useCallback((file) => importMediaAsset(file, {
    useActiveProjectReload: true,
  }), [importMediaAsset]);

  const uploadGalleryThumbnail = useCallback(async (file) => {
    if (!file) throw new Error('Aucune miniature à envoyer.');

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

  const handleDeleteItem = useCallback(async (itemId) => {
    const item = editor.project.items.find((entry) => entry.id === itemId);
    const confirmed = await confirmDialog({
      title: "Supprimer l'objet",
      message: `Supprimer l'objet "${item?.name || 'sélectionné'}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    preview.removeInventoryItemReferences(itemId);
    editor.deleteItem(itemId);
  }, [confirmDialog, editor.deleteItem, editor.project.items, preview.removeInventoryItemReferences]);

  const handleDeleteScene = useCallback(async (sceneId) => {
    const deletedSceneIds = collectDescendantSceneIds(editor.project.scenes, sceneId);
    const scene = editor.project.scenes.find((entry) => entry.id === sceneId);
    const suffix = deletedSceneIds.size > 1 ? ` et ses ${deletedSceneIds.size - 1} sous-scène(s)` : '';
    const confirmed = await confirmDialog({
      title: 'Supprimer la scène',
      message: `Supprimer la scène "${scene?.name || 'sélectionnée'}"${suffix} ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    const remainingScenes = editor.project.scenes.filter((scene) => !deletedSceneIds.has(scene.id));
    const fallbackScene = remainingScenes[0] || null;
    editor.deleteScene(sceneId);
    preview.removeDeletedSceneReferences(deletedSceneIds, fallbackScene);
  }, [confirmDialog, editor.deleteScene, editor.project.scenes, preview.removeDeletedSceneReferences]);

  const handleDeleteEnigma = useCallback(async (enigmaId) => {
    const enigma = editor.project.enigmas.find((entry) => entry.id === enigmaId);
    const confirmed = await confirmDialog({
      title: "Supprimer l'énigme",
      message: `Supprimer l'énigme "${enigma?.name || 'sélectionnée'}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    editor.deleteEnigma(enigmaId);
  }, [confirmDialog, editor.deleteEnigma, editor.project.enigmas]);

  const handlePreviewScene = useCallback((sceneId) => {
    const scene = editor.project.scenes.find((entry) => entry.id === sceneId);
    if (!scene) return;

    preview.setPlayingCinematic(null);
    preview.setViewerImage(null);
    preview.setPlaySceneId(scene.id);
    preview.setDialogue(scene.introText || '');
    editor.setTab('preview');
  }, [editor.project.scenes, editor.setTab, preview.setDialogue, preview.setPlaySceneId, preview.setPlayingCinematic, preview.setViewerImage]);

  const handlePreviewEnigma = useCallback((enigmaId) => {
    const enigma = editor.project.enigmas.find((entry) => entry.id === enigmaId);
    if (!enigma) return;

    preview.setPlayingCinematic(null);
    preview.setViewerImage(null);
    preview.openEnigma(enigma);
    editor.setTab('preview');
  }, [editor.project.enigmas, editor.setTab, preview.openEnigma, preview.setPlayingCinematic, preview.setViewerImage]);

  const handlePreviewCinematic = useCallback((cinematicId) => {
    const cinematic = editor.project.cinematics.find((entry) => entry.id === cinematicId);
    if (!cinematic) return;
    preview.setViewerImage(null);
    preview.closeEnigma();
    preview.launchCinematic(cinematic.id);
    editor.setTab('preview');
  }, [editor.project.cinematics, editor.setTab, preview.closeEnigma, preview.launchCinematic, preview.setViewerImage]);

  const handlePreviewHeroCharacter = useCallback(() => {
    setHeroCharacterPreviewRequestKey(Date.now());
    editor.setTab('preview');
  }, [editor.setTab]);

  const startLoadedProjectCreationGuide = useCallback(async (projectForGuide = editor.project) => {
    const steps = await loadTutorialSteps();
    const guidedProject = prepareProjectForGuidedCreation(projectForGuide || editor.project);
    const firstScene = guidedProject?.scenes?.[0] || null;
    if (guidedProject) {
      editor.loadProject(guidedProject);
      preview.syncWithProject(guidedProject);
    }
    editor.setTab('scenes');
    if (firstScene?.id) {
      editor.setSelectedSceneId(firstScene.id);
      editor.setSelectedHotspotId(firstScene.hotspots?.[0]?.id || '');
    }
    setScreen('editor');
    setSelectedTutorialTab('guided_creation');
    setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, 'guided_creation')[0] ?? null);
    setSaveStatus('Aide guidée activée sur ce projet');
  }, [
    editor.project,
    editor.loadProject,
    editor.setSelectedHotspotId,
    editor.setSelectedSceneId,
    editor.setTab,
    loadTutorialSteps,
    preview.syncWithProject,
  ]);

  const handleExportProjectJson = useCallback(() => exportProjectJson(editor.project), [editor.project]);
  const handleExportAuthorSummary = useCallback(() => exportAuthorSummary(editor.project), [editor.project]);
  const handleExportStandalone = useCallback(async () => {
    const { exportStandalone } = await import('./utils/exportStandalone');
    await exportStandalone(editor.project);
  }, [editor.project]);

  const {
    createProjectFromProfile,
    deleteProjectFromProfile,
    duplicateProjectFromProfile,
    importProjectFromProfile,
    openProjectInEditor,
    publishProjectFromProfile,
    renameProjectFromProfile,
    shareProjectFromProfile,
    testProjectFromProfile,
    unpublishProjectFromProfile,
    updateProjectModeFromProfile,
    updatePublicSettingsFromProfile,
  } = useProfileProjectActions({
    auth,
    editor,
    confirmDialog,
    hydratedProjectRef,
    preview,
    saveProject: saveProjectAndAcknowledge,
    setSaveStatus,
    setScreen,
    startCreationGuide: startLoadedProjectCreationGuide,
  });

  useEffect(() => {
    if (!auth.isReady || !auth.user?.id || !initialProjectId) return;
    if (initialTutorialTab === 'guided_creation') return;
    const loadKey = `${initialProjectId}:${initialTab || ''}`;
    if (initialProjectLoadRef.current === loadKey) return;
    initialProjectLoadRef.current = loadKey;
    openProjectInEditor(initialProjectId, initialTab ? { tab: initialTab } : {});
  }, [auth.isReady, auth.user?.id, initialProjectId, initialTab, initialTutorialTab, openProjectInEditor]);

  useEffect(() => {
    if (builderResumeAttemptedRef.current) return;
    if (sharedRouteRef.current) return;
    if (initialTutorialTab === 'guided_creation') return;
    if (!auth.isReady || !auth.user?.id || !auth.activeProjectId) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') return;

    const lastBuilderState = readBuilderUiState(auth.user.id, auth.activeProjectId);
    if (lastBuilderState.screen !== 'editor' || !isBuilderTab(lastBuilderState.tab)) return;

    builderResumeAttemptedRef.current = true;
    openProjectInEditor(auth.activeProjectId, { tab: lastBuilderState.tab });
  }, [auth.isReady, auth.user, auth.activeProjectId, initialTutorialTab, openProjectInEditor]);

  const startBuilderTutorialFromProfile = useCallback(async (requestedTab = 'scenes') => {
    const tutorialTab = BUILDER_TUTORIAL_TABS.includes(requestedTab) ? requestedTab : 'scenes';
    const steps = await loadTutorialSteps();
    if (tutorialTab === 'guided_creation') {
      const sourceProjectId = initialProjectId || auth.activeProjectId || auth.projects[0]?.id || '';
      const isSourceProjectLoaded = !sourceProjectId || hydratedProjectRef.current === sourceProjectId;
      if (screen === 'editor' && isSourceProjectLoaded) {
        await startLoadedProjectCreationGuide(editor.project);
        return;
      }
      if (!sourceProjectId) {
        setSaveStatus('Crée ou ouvre un projet avant de lancer le démarrage guidé');
        return;
      }
      try {
        const savedProject = await auth.loadProject(sourceProjectId);
        const projectToGuide = normalizeProject(savedProject || createInitialProject());
        hydratedProjectRef.current = sourceProjectId || auth.activeProjectId;
        await startLoadedProjectCreationGuide(projectToGuide);
      } catch (error) {
        console.error('Erreur de chargement du projet pour le demarrage guide', error);
        setSaveStatus('Erreur de chargement');
      }
      return;
    }
    if (tutorialTab === 'profile') {
      if (auth.user?.id) {
        window.localStorage.setItem(getProfileTutorialSeenKey(auth.user.id), '1');
      }
      setScreen('profile');
      setSelectedTutorialTab('profile');
      setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, 'profile')[0] ?? null);
      return;
    }
    const startTab = tutorialTab === 'editor' ? 'scenes' : tutorialTab;
    const sourceRecord = auth.projects.find((project) => project.id === auth.activeProjectId) || auth.projects[0];
    const sourceProject = sourceRecord?.data ? normalizeProject(sourceRecord.data) : normalizeProject(createInitialProject());
    const tutorialProject = prepareProjectForTutorial({
      ...structuredClone(sourceProject),
      title: 'Projet didacticiel temporaire',
      isTemporaryTutorial: true,
    }, tutorialTab);
    const tutorialSceneId = tutorialProject.scenes?.[0]?.id || '';
    editor.loadProject(tutorialProject);
    editor.setTab(startTab);
    if (tutorialSceneId) editor.setSelectedSceneId(tutorialSceneId);
    preview.syncWithProject(tutorialProject);
    hydratedProjectRef.current = '';
    setScreen('editor');
    setSaveStatus('Didacticiel temporaire : non enregistré');
    setSelectedTutorialTab(tutorialTab);
    setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, tutorialTab)[0] ?? 0);
  }, [
    auth.activeProjectId,
    auth.loadProject,
    auth.projects,
    auth.user?.id,
    editor.loadProject,
    editor.project,
    editor.setSelectedSceneId,
    editor.setTab,
    initialProjectId,
    loadTutorialSteps,
    preview.syncWithProject,
    screen,
    startLoadedProjectCreationGuide,
  ]);

  useEffect(() => {
    if (!auth.isReady || !auth.user?.id || !initialTutorialTab) return;
    const tutorialKey = `${initialProjectId || auth.activeProjectId || 'temporary'}:${initialTutorialTab}`;
    if (initialTutorialStartRef.current === tutorialKey) return;
    initialTutorialStartRef.current = tutorialKey;
    startBuilderTutorialFromProfile(initialTutorialTab);
  }, [
    auth.activeProjectId,
    auth.isReady,
    auth.user?.id,
    initialProjectId,
    initialTutorialTab,
    startBuilderTutorialFromProfile,
  ]);

  const applyFakeTutorialImage = useCallback(({ name, dataUrl, target = 'object' }) => {
    editor.patchProject((draft) => {
      if (target === 'scene-background') {
        const scene = draft.scenes.find((entry) => entry.id === editor.selectedSceneId) || draft.scenes[0];
        if (!scene) return;
        scene.backgroundData = dataUrl;
        scene.backgroundName = name;
        scene.backgroundAspectRatio = 1.6;
        return;
      }
      if (target === 'scene-music') {
        const scene = draft.scenes.find((entry) => entry.id === editor.selectedSceneId) || draft.scenes[0];
        if (!scene) return;
        scene.musicData = dataUrl;
        scene.musicName = name;
        scene.musicLoop = true;
        return;
      }
      const itemId = editor.selectedItemId || draft.items?.[draft.items.length - 1]?.id || draft.items?.[0]?.id || '';
      const item = draft.items?.find((entry) => entry.id === itemId);
      if (!item) return;
      item.imageData = dataUrl;
      item.imageName = name;
    });
  }, [editor.patchProject, editor.selectedItemId, editor.selectedSceneId]);

  const {
    buyStorageFromProfile,
    deleteMediaFromProfile,
  } = useProfileMediaActions({
    aiCreditBalance,
    alertDialog,
    auth,
    confirmDialog,
    editor,
    invalidateStorageUsage,
    preview,
    saveProjectAndAcknowledge,
    setAiCreditBalance,
    setSaveStatus,
    updateStorageQuotaBytes,
  });

  const updateAuthorProfileFromProfile = useCallback(async (profile) => {
    await auth.updateAuthorProfile(profile);
    setSaveStatus('Profil auteur mis à jour');
  }, [auth.updateAuthorProfile]);

  const openPublicGalleryWindow = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('gallery', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, []);

  const openProfileFromBuilder = useCallback(async () => {
    const shouldSaveOnExit = Boolean(
      auth.user?.id
      && auth.activeProjectId
      && hydratedProjectRef.current === auth.activeProjectId,
    );
    const projectToSave = editor.project;
    const projectIdToSave = auth.activeProjectId;
    const uiStateToSave = {
      tab: editor.tab,
      selectedSceneId: editor.selectedSceneId,
    };

    let exitSaveStatus = '';
    if (shouldSaveOnExit) {
      try {
        setSaveStatus('Sauvegarde du projet...');
        const result = await saveProjectAndAcknowledge(projectToSave, projectIdToSave, uiStateToSave);
        exitSaveStatus = getProjectSaveStatus(result?.syncStatus || { localSaved: Boolean(result) });
        setSaveStatus(exitSaveStatus);
      } catch (error) {
        console.error('Sauvegarde du projet avant retour profil impossible', error);
        setSaveStatus('Erreur de sauvegarde');
        await alertDialog({
          title: 'Sauvegarde impossible',
          message: "Le projet n'a pas pu être sauvegardé. Vous restez dans le builder pour éviter de perdre les changements.",
          variant: 'danger',
        });
        return;
      }
    }

    if (auth.user?.id && auth.activeProjectId) {
      writeBuilderUiState(auth.user.id, auth.activeProjectId, {
        screen: 'profile',
        ...uiStateToSave,
      });
    }

    if (onExitToProfile) {
      onExitToProfile(exitSaveStatus ? { statusMessage: exitSaveStatus } : undefined);
    } else {
      setScreen('profile');
    }
  }, [
    alertDialog,
    auth.activeProjectId,
    auth.user?.id,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    hydratedProjectRef,
    onExitToProfile,
    saveProjectAndAcknowledge,
  ]);

  const importProjectJson = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = normalizeProject(JSON.parse(text));
    editor.loadProject(parsed);
    preview.syncWithProject(parsed);
    if (auth.activeProjectId) await saveProjectAndAcknowledge(parsed, auth.activeProjectId);
    setSaveStatus('Projet importé et sauvegardé');
    event.target.value = '';
  }, [auth.activeProjectId, editor.loadProject, preview.syncWithProject, saveProjectAndAcknowledge]);

  const applyAiProject = useCallback(async (generatedProject, options = {}) => {
    const candidateProject = options.isPatch || options.mode === 'improve' ?
       mergeProjectPatch(editor.project, generatedProject)
      : generatedProject;
    const validation = validateProject(candidateProject);
    if (!validation.ok) {
      const error = new Error(validation.errors.slice(0, 5).join('\n') || 'JSON IA invalide.');
      error.validation = validation;
      setSaveStatus('Projet IA invalide');
      throw error;
    }

    const projectToLoad = {
      ...validation.project,
      ...(options.aiDraft ? { aiDraft: options.aiDraft } : {}),
    };
    const selectedSceneId = projectToLoad.scenes?.some((scene) => scene.id === options.selectedSceneId) ?
       options.selectedSceneId
      : projectToLoad.scenes?.[0]?.id || '';
    editor.loadProject(projectToLoad);
    editor.setSelectedSceneId(selectedSceneId);
    editor.setSelectedHotspotId(projectToLoad.scenes?.find((scene) => scene.id === selectedSceneId)?.hotspots?.[0]?.id || '');
    preview.syncWithProject(projectToLoad);
    editor.setTab('ai');
    if (auth.activeProjectId) {
      await saveProjectAndAcknowledge(projectToLoad, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId,
      });
    }
    setSaveStatus(options.isPatch || options.mode === 'improve' ? 'Amélioration IA appliquée' : 'Projet IA appliqué');
    return validation;
  }, [
    auth.activeProjectId,
    editor.loadProject,
    editor.project,
    editor.setSelectedHotspotId,
    editor.setSelectedSceneId,
    editor.setTab,
    preview.syncWithProject,
    saveProjectAndAcknowledge,
  ]);

  const saveAiDraft = useCallback(async (draft) => {
    if (!draft) {
      const nextProject = structuredClone(editor.project);
      delete nextProject.aiDraft;
      delete nextProject.__aiDraft;
      editor.patchProject((current) => {
        delete current.aiDraft;
        delete current.__aiDraft;
      }, { rememberHistory: false });
      if (auth.activeProjectId) {
        await saveProjectAndAcknowledge(nextProject, auth.activeProjectId, {
          tab: 'ai',
          selectedSceneId: editor.selectedSceneId,
        });
      }
      setSaveStatus('Brouillon IA effacé');
      return null;
    }
    const nextProject = structuredClone(editor.project);
    nextProject.aiDraft = draft;
    editor.patchProject((current) => {
      current.aiDraft = draft;
    }, { rememberHistory: false });

    if (auth.activeProjectId) {
      await saveProjectAndAcknowledge(nextProject, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId: editor.selectedSceneId,
      });
    }
    setSaveStatus('Brouillon IA sauvegardé');
    return draft;
  }, [
    auth.activeProjectId,
    editor.patchProject,
    editor.project,
    editor.selectedSceneId,
    saveProjectAndAcknowledge,
  ]);

  const saveAnime2dDraft = useCallback(async (draft) => {
    const { anime2dDraft, anime2dDraftMeta, ...projectWithoutAnimeDraft } = editor.project || {};
    const isTemporaryProject = Boolean(editor.project?.isTemporaryTutorial);
    const nextMeta = getAnime2dDraftMeta(draft);
    const nextProject = nextMeta
      ? { ...projectWithoutAnimeDraft, anime2dDraft: draft, anime2dDraftMeta: nextMeta }
      : projectWithoutAnimeDraft;
    const fallbackProjectDraft = anime2dDraft;
    if (draft) {
      nextProject.anime2dDraft = draft;
      nextProject.anime2dDraftMeta = nextMeta;
    } else {
      delete nextProject.anime2dDraft;
      delete nextProject.anime2dDraftMeta;
    }
    editor.patchProject((current) => {
      if (draft) {
        current.anime2dDraft = draft;
        current.anime2dDraftMeta = nextMeta;
      } else {
        delete current.anime2dDraft;
        delete current.anime2dDraftMeta;
      }
    }, { rememberHistory: false });

    if (isTemporaryProject) {
      setSaveStatus(draft ? 'Brouillon 2D temporaire sauvegardé' : 'Brouillon 2D temporaire effacé');
      return draft;
    }

    if (auth.activeProjectId) {
      try {
        await saveProjectAndAcknowledge(nextProject, auth.activeProjectId, {
          tab: 'animation',
          selectedSceneId: editor.selectedSceneId,
        });
      } catch (error) {
        console.warn('Sauvegarde projet sans brouillon 2D Anime impossible.', error);
        if (fallbackProjectDraft) {
          editor.patchProject((current) => {
            current.anime2dDraft = draft || fallbackProjectDraft;
            if (nextMeta) current.anime2dDraftMeta = nextMeta;
          }, { rememberHistory: false });
        }
      }
    }
    setSaveStatus(draft ? 'Brouillon 2D Anime sauvegardé' : 'Brouillon 2D Anime effacé');
    return draft;
  }, [
    auth.activeProjectId,
    editor.patchProject,
    editor.project,
    editor.selectedSceneId,
    saveProjectAndAcknowledge,
  ]);

  const confirmAnimationExit = useCallback(async () => {
    if (editor.tab !== 'animation' || !anime2dHasUnsavedChanges) return true;
    const shouldSave = await confirmDialog({
      title: 'Sauvegarder 2D Anime',
      message: "Des modifications 2D Anime ne sont pas sauvegardées. Voulez-vous sauvegarder avant de changer d'onglet ?",
      confirmLabel: 'Sauvegarder',
    });
    if (!shouldSave) return false;

    try {
      await anime2dSaveBeforeLeaveRef.current?.();
      setAnime2dHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.warn('Sauvegarde 2D Anime avant sortie impossible.', error);
      await alertDialog({
        title: 'Sauvegarde impossible',
        message: "La sauvegarde 2D Anime a échoué. Vous restez sur l'onglet Animation.",
        variant: 'danger',
      });
      return false;
    }
  }, [alertDialog, anime2dHasUnsavedChanges, confirmDialog, editor.tab]);

  const handleBuilderTabChange = useCallback(async (nextTab) => {
    if (nextTab === editor.tab) return;
    if (!isTabAllowedForProject(nextTab, editor.project)) {
      editor.setTab('scenes');
      return;
    }
    if (!(await confirmAnimationExit())) return;
    editor.setTab(nextTab);
  }, [confirmAnimationExit, editor.project, editor.setTab, editor.tab]);

  const handleBuilderProfileOpen = useCallback(async () => {
    if (!(await confirmAnimationExit())) return;
    await openProfileFromBuilder();
  }, [confirmAnimationExit, openProfileFromBuilder]);

  const persistAiImage = useCallback(async ({ type, id, patch }) => {
    if (!type || !id || !patch) return null;
    let nextPatch = { ...patch };

    const imageField = type === 'scene' ? 'backgroundData' : 'imageData';
    const imageNameField = type === 'scene' ? 'backgroundName' : 'imageName';
    const imageData = nextPatch[imageField];

    if (auth.activeProjectId && hasSupabaseStorageConfig() && typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      try {
          const blob = dataUrlToBlob(imageData);
          if (blob) {
            const extension = extensionFromMime(blob.type);
            const storageId = type === 'cinematicSlide' && nextPatch.slideId ? `${id}-${nextPatch.slideId}` : id;
            const filename = generateStorageFilename(`${storageId}.${extension}`);
            const version = filename.replace(/\.[^.]+$/, '');
            const path = buildStoragePath('users', auth.user?.id, 'projects', auth.activeProjectId, 'ai-images', type, filename);
            const uploaded = await uploadToStorage(path, blob, {
              contentType: blob.type,
              cacheControl: '3600',
              visibility: 'public',
            });
          const publicUrl = `${uploaded.publicUrl}${uploaded.publicUrl.includes('?') ? '&' : '?'}v=${version}`;
          const imageVariants = Array.isArray(nextPatch.aiImageVariants) ?
            nextPatch.aiImageVariants.map((variant) => (
              variant?.imageData === imageData ? { ...variant, imageData: publicUrl, imageName: variant.imageName || nextPatch[imageNameField] } : variant
            ))
            : nextPatch.aiImageVariants;
          nextPatch = {
            ...nextPatch,
            [imageField]: publicUrl,
            [imageNameField]: nextPatch[imageNameField] || `${type}-${id}.${extension}`,
            imageStoragePath: uploaded.path,
            ...(imageVariants ? { aiImageVariants: imageVariants } : {}),
          };
        }
      } catch (error) {
        setSaveStatus(`Image générée, mais upload Supabase impossible: ${error.message}`);
      }
    }

    const nextProject = structuredClone(editor.project);

    if (type === 'scene') {
      nextProject.scenes = (nextProject.scenes || []).map((scene) => (
        scene.id === id ? { ...scene, ...nextPatch } : scene
      ));
    }

    if (type === 'item') {
      nextProject.items = (nextProject.items || []).map((item) => (
        item.id === id ? { ...item, ...nextPatch } : item
      ));
    }

    if (type === 'cinematicSlide') {
      nextProject.cinematics = (nextProject.cinematics || []).map((cinematic) => (
        cinematic.id === id ? {
          ...cinematic,
          slides: (cinematic.slides || []).map((slide) => (
            slide.id === nextPatch.slideId ? { ...slide, ...nextPatch } : slide
          )),
        } : cinematic
      ));
    }

    editor.patchProject((draft) => {
      if (type === 'scene') {
        const scene = draft.scenes.find((entry) => entry.id === id);
        if (scene) Object.assign(scene, nextPatch);
      }
      if (type === 'item') {
        const item = draft.items.find((entry) => entry.id === id);
        if (item) Object.assign(item, nextPatch);
      }
      if (type === 'cinematicSlide') {
        const slide = draft.cinematics
          .find((entry) => entry.id === id)
          ?.slides
          ?.find((entry) => entry.id === nextPatch.slideId);
        if (slide) Object.assign(slide, nextPatch);
      }
    }, { rememberHistory: false });

    if (auth.activeProjectId) {
      await saveProjectAndAcknowledge(nextProject, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId: type === 'scene' ? id : editor.selectedSceneId,
      });
    }

    setSaveStatus(type === 'scene' ? 'Image de scène sauvegardée' : "Image d'objet sauvegardée");
    return { project: nextProject, patch: nextPatch };
  }, [
    auth.activeProjectId,
    auth.user?.id,
    editor.patchProject,
    editor.project,
    editor.selectedSceneId,
    saveProjectAndAcknowledge,
  ]);

  const anime2dStorageId = getAnime2dStorageId(auth.activeProjectId, editor.project);
  const mediaLibrary = useMemo(() => {
    if (screen !== 'editor') return [];

    const sourceProjects = [
      ...auth.projects.map((projectRecord) => ({
        id: projectRecord.id,
        name: projectRecord.name || projectRecord.data?.title,
        data: projectRecord.id === auth.activeProjectId ? editor.project : projectRecord.data,
        isActive: projectRecord.id === auth.activeProjectId,
      })),
      auth.activeProjectId ? null : {
        id: 'active-project',
        name: editor.project?.title,
        data: editor.project,
        isActive: true,
      },
    ].filter((entry) => entry?.data);

    return [
      ...new Map(sourceProjects.flatMap((entry) => (
        (entry.isActive ? collectProjectAssets(entry.data) : collectProjectAssetManifest(entry.data)).map((asset) => ({
          ...asset,
          projectId: entry.id,
          projectName: entry.name || entry.data?.title,
        }))
      ))
        .filter((asset) => asset.url)
        .map((asset) => [asset.url, asset])).values(),
    ];
  }, [auth.activeProjectId, auth.projects, editor.project, screen]);
  const registerAnime2dSaveBeforeLeave = useCallback((saveHandler) => {
    anime2dSaveBeforeLeaveRef.current = saveHandler;
  }, []);
  const tabContext = useMemo(() => ({
    editor,
    preview,
    heroCharacterPreviewRequestKey,
    user: auth.user,
    projectRecord: activeProjectRecord,
    projectStorageKey: auth.activeProjectId || editor.project?.title || 'default',
    anime2dStorageId,
    mediaLibrary,
    actions: {
      applyAiProject,
      deleteEnigma: handleDeleteEnigma,
      deleteItem: handleDeleteItem,
      deleteScene: handleDeleteScene,
      handleUpload,
      persistAiImage,
      previewCinematic: handlePreviewCinematic,
      previewEnigma: handlePreviewEnigma,
      previewHeroCharacter: handlePreviewHeroCharacter,
      previewScene: handlePreviewScene,
      registerAnime2dSaveBeforeLeave,
      saveAiDraft,
      saveAnime2dDraft,
      setAnime2dHasUnsavedChanges,
      startBuilderTutorialFromProfile,
    },
  }), [
    anime2dStorageId,
    applyAiProject,
    activeProjectRecord,
    auth.activeProjectId,
    auth.user,
    editor,
    handleDeleteEnigma,
    handleDeleteItem,
    handleDeleteScene,
    handlePreviewCinematic,
    handlePreviewEnigma,
    handlePreviewHeroCharacter,
    handlePreviewScene,
    heroCharacterPreviewRequestKey,
    handleUpload,
    mediaLibrary,
    persistAiImage,
    preview,
    registerAnime2dSaveBeforeLeave,
    saveAiDraft,
    saveAnime2dDraft,
    startBuilderTutorialFromProfile,
  ]);
  const sharedPreviewProps = useMemo(() => ({
    project: editor.project,
    onUpdateProject: editor.patchProject,
    tabContext,
  }), [editor.patchProject, editor.project, tabContext]);
  const SharedPreviewComponent = TABS.preview.component;
  const previewPanel = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
      <SharedPreviewComponent {...sharedPreviewProps} sharedPlayerMode={screen === 'shared-preview'} />
    </Suspense>
  ), [SharedPreviewComponent, screen, sharedPreviewProps]);
  const handleTutorialNext = useCallback(() => setTutorialStepIndex((index) => (
    index === null || activeTutorialPosition >= activeTutorialIndexes.length - 1 ? null : activeTutorialIndexes[activeTutorialPosition + 1]
  )), [activeTutorialIndexes, activeTutorialPosition]);
  const handleTutorialPrevious = useCallback(() => {
    setTutorialStepIndex(activeTutorialIndexes[Math.max(0, activeTutorialPosition - 1)] ?? null);
  }, [activeTutorialIndexes, activeTutorialPosition]);
  const closeTutorial = useCallback(() => setTutorialStepIndex(null), []);

  const tutorialOverlay = useMemo(() => activeTutorialStep ? (
    <Suspense fallback={<TabLoadingFallback />}>
      <BuilderTutorial
        step={activeTutorialStep}
        stepNumber={Math.max(0, activeTutorialPosition) + 1}
        totalSteps={activeTutorialIndexes.length || 1}
        canPrevious={activeTutorialPosition > 0}
        userName={tutorialUserName}
        project={editor.project}
        fakeFileOptions={getFakeWindowImageOptions(editor.project, activeTutorialStep?.completedWhen?.target)}
        onFakeFileChosen={applyFakeTutorialImage}
        onNext={handleTutorialNext}
        onPrevious={handleTutorialPrevious}
        onClose={closeTutorial}
      />
    </Suspense>
  ) : null, [
    activeTutorialIndexes.length,
    activeTutorialPosition,
    activeTutorialStep,
    applyFakeTutorialImage,
    closeTutorial,
    editor.project,
    handleTutorialNext,
    handleTutorialPrevious,
    tutorialUserName,
  ]);
  const activeTab = getTabKey(editor.tab);
  const ActiveComponent = TABS[activeTab]?.component;
  const activeTabProps = useMemo(() => ({
    project: editor.project,
    onUpdateProject: editor.patchProject,
    tabContext,
  }), [editor.patchProject, editor.project, tabContext]);
  const activeTabRenderKey = activeTab === 'animation'
    ? anime2dStorageId
    : activeTab;

  if (screen === 'shared-preview') {
    return (
      <div className="shared-player-shell">
        {sharedLoadStatus ? (
          <div className="shared-player-loading">
            <span className="eyebrow">Lien jouable</span>
            <h2>{editor.project.title || 'Escape game'}</h2>
            <p>{sharedLoadStatus}</p>
          </div>
        ) : previewPanel}
        {accessibleDialog}
      </div>
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
  }

  if (screen === 'profile') {
    return (
      <div className="app-shell">
        <Suspense fallback={<TabLoadingFallback />}>
          <ProfilePage
            user={auth.user}
            canOpenAdmin={isAdminUser(auth.user)}
            projects={profileProjects}
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
            onStartTutorial={startBuilderTutorialFromProfile}
            onRenameProject={renameProjectFromProfile}
            onUpdateProjectMode={updateProjectModeFromProfile}
            onDuplicateProject={duplicateProjectFromProfile}
            onDeleteProject={deleteProjectFromProfile}
            onDeleteMedia={deleteMediaFromProfile}
            onImportProject={importProjectFromProfile}
            onImportMediaFile={importProfileMediaFile}
            onUpdateAuthorProfile={auth.updateAuthorProfile}
            onUpdatePassword={auth.updatePassword}
            mediaLibrary={mediaLibrary}
            onRefreshStorageUsage={getCurrentStorageUsageBytes}
            storageSummary={storageSummary}
            aiCreditBalance={aiCreditBalance}
            onBuyStorage={buyStorageFromProfile}
            onLogout={auth.logout}
            isProfileTutorialActive={selectedTutorialTab === 'profile' && Boolean(activeTutorialStep)}
          />
        </Suspense>
        {accessibleDialog}
        {selectedTutorialTab === 'profile' ? tutorialOverlay : null}
      </div>
    );
  }

  if (screen === 'admin') {
    if (!isAdminUser(auth.user)) {
      return (
        <div className="app-shell">
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Admin</span>
                <h2>Acces admin refuse</h2>
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
      <Header
        projectTitle={editor.project.title}
        onExportJson={handleExportProjectJson}
        onImportJson={importProjectJson}
        onExportStandalone={handleExportStandalone}
        onExportAuthorSummary={handleExportAuthorSummary}
        user={auth.user}
        authorProfile={auth.authorProfile}
        onLogout={auth.logout}
        saveStatus={saveStatus || 'Sauvegarde active'}
        projectMode={getProjectMode(editor.project)}
      />

      <Tabs
        value={editor.tab}
        onChange={handleBuilderTabChange}
        onProfile={handleBuilderProfileOpen}
        projectScore={projectScore}
        projectMode={getProjectMode(editor.project)}
      />

      <Suspense fallback={<TabLoadingFallback />}>
        {ActiveComponent ? (
          <ActiveComponent key={activeTabRenderKey} {...activeTabProps} />
        ) : null}
      </Suspense>

      {selectedTutorialTab !== 'profile' ? tutorialOverlay : null}
      {accessibleDialog}
    </div>
  );
}

export default BuilderApp;
