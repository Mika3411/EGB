import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../shared/ui/layout/Header';
import Tabs from './builder/navigation/BuilderDomainNav';
import { TABS, getTabKey, preloadBuilderTabs } from './builder/navigation/domainTabs.jsx';
import { useAccessibleDialog } from '../shared/ui/AccessibleDialog';
import CenterScreenNotice from '../shared/ui/CenterScreenNotice';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';
import {
  BUILDER_TUTORIAL_TABS,
  getFakeWindowImageOptions,
  getTutorialName,
  prepareProjectForGuidedCreation,
  prepareProjectForTutorial,
} from '../shared/data/tutorialSteps';
import {
  getAnime2dDraftMeta,
  getAnime2dStorageId,
  readBuilderUiState,
  writeAppUiState,
  writeBuilderUiState,
} from '../shared/utils/storageHelpers';
import {
  getProfileTutorialSeenKey,
  getProjectMode,
  getSafeBuilderTab,
  isBuilderTab,
  isTabAllowedForProject,
} from '../shared/utils/tutorialHelpers';
import { mergeProjectPatch, validateProject } from '../shared/utils/projectValidation';
import { calculateProjectScore } from '../shared/services/projectScoreEngine';
import { useProjectEditor } from './builder/hooks/useProjectEditor.jsx';
import { usePreviewPlayer } from '../domains/player/hooks/usePreviewPlayer';
import { useSharedPlayableRoute } from '../domains/player/hooks/useSharedPlayableRoute';
import { useAutosaveProject } from './builder/hooks/useAutosaveProject';
import { useAccountStorage } from '../domains/auth/hooks/useAccountStorage';
import { useBuilderMediaUpload } from '../domains/media/hooks/useBuilderMediaUpload';
import { useBuilderProfileNavigation } from '../domains/profile/hooks/useBuilderProfileNavigation';
import { useBuilderProjectFileActions } from './builder/hooks/useBuilderProjectFileActions';
import { useProfileProjectActions } from '../domains/profile/hooks/useProfileProjectActions';
import { useProfileMediaActions } from '../domains/profile/hooks/useProfileMediaActions';
import { useProjectSaveAcknowledger } from './builder/hooks/useProjectSaveAcknowledger';
import { collectDescendantSceneIds } from '../shared/services/sceneHelpers';
import { collectProjectAssets } from '../shared/services/assetManager';
import { PRO_PROMOTION_PROJECT_MODE } from '../shared/services/proPromotion';
import { isProfessionalAccount } from '../shared/services/accountPlans';
import { isAdminAccount } from '../shared/services/authStorage';
import { trackVisitorSurface } from '../shared/services/visitorAnalytics';
import { getOfflineExportEstimateMessage } from '../shared/utils/offlineExportEstimate';
import { getAuthorProfileSlugFromPath } from '../shared/utils/publicProjectLinks';
import { lazyWithRetry } from '../shared/utils/lazyImportRetry';
import {
  getSupabaseAuthHeaders,
  hasRemoteStorageConfig,
} from '../shared/services/remoteSession';
import {
  canStoreProjectAssetsRemotely,
  uploadGeneratedProjectImageAsset,
} from '../shared/services/projectAssetStorage';

const AI_CREDITS_ENDPOINT = import.meta.env.VITE_AI_CREDITS_ENDPOINT || '/api/ai-credits';
const PROJECT_AUTOSAVE_ENABLED = true;

const LandingExperience = lazyWithRetry(() => import('../domains/landing/LandingExperience'));
const BuilderGuide = lazyWithRetry(() => import('./tutorial/BuilderGuide'));
const AuthEntry = lazyWithRetry(() => import('../domains/auth/AuthEntry'));
const ProfileWorkspace = lazyWithRetry(() => import('../domains/profile/ProfileWorkspace'));
const AdminConsole = lazyWithRetry(() => import('../domains/admin/AdminConsole'));
const GalleryBrowser = lazyWithRetry(() => import('../domains/gallery/GalleryBrowser'));

const isAdminUser = (user) => isAdminAccount(user);
const TabLoadingFallback = () => (
  <section className="panel">
    <p className="small-note">Chargement de l'onglet...</p>
  </section>
);
const isTutorialStepAvailableForAccount = (step, user) => !step?.requiresProAccount || isProfessionalAccount(user);
const getTutorialStepIndexesFromSteps = (steps, tab, user = null) => (steps || [])
  .map((step, index) => ({ step, index }))
  .filter(({ step }) => (
    (step.tutorial || step.tab) === tab
    && isTutorialStepAvailableForAccount(step, user)
  ))
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

function BuilderStudio({
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
  const [centerNotice, setCenterNotice] = useState('');
  const [screen, setScreen] = useState(initialScreen);
  const [projectScore, setProjectScore] = useState(null);
  const [showAuthEntry, setShowAuthEntry] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const preload = () => preloadBuilderTabs();
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(idleId);
    }
    const timerId = window.setTimeout(preload, 1200);
    return () => window.clearTimeout(timerId);
  }, []);
  const activeBuilderProjectId = hydratedProjectRef.current || auth.activeProjectId || initialProjectId || '';
  useEffect(() => {
    if (screen === 'editor') trackVisitorSurface('builder', { userId: auth.user?.id });
  }, [auth.user?.id, screen]);

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
    setShowAuthEntry(true);
  }, []);

  const showCenterNotice = useCallback((message) => {
    setCenterNotice(String(message || ''));
  }, []);
  const openRegisterPanel = useCallback(() => {
    setAuthEntryMode('register');
    setShowAuthEntry(true);
  }, []);
  const closeAuthEntry = useCallback(() => setShowAuthEntry(false), []);
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
      tutorialStepsPromiseRef.current = import('../shared/data/tutorialStepData').then((module) => module.BUILDER_TUTORIAL_STEPS || []);
    }
    const steps = await tutorialStepsPromiseRef.current;
    setTutorialSteps(steps);
    return steps;
  }, [tutorialSteps]);
  const activeTutorialIndexes = useMemo(() => (
    tutorialStepIndex === null ? [] : getTutorialStepIndexesFromSteps(tutorialSteps, selectedTutorialTab, auth.user)
  ), [auth.user, selectedTutorialTab, tutorialStepIndex, tutorialSteps]);
  const activeTutorialPosition = activeTutorialIndexes.indexOf(tutorialStepIndex);
  const activeTutorialStep = tutorialStepIndex === null ? null : tutorialSteps[tutorialStepIndex] || null;
  const tutorialUserName = getTutorialName(auth.user);
  useEffect(() => {
    const safeTab = getSafeBuilderTab(editor.tab, editor.project);
    if (safeTab !== editor.tab) editor.setTab(safeTab);
  }, [editor.project, editor.setTab, editor.tab]);
  const profileProjects = useMemo(() => (auth.projects || []).map((projectRecord) => (
    projectRecord.id === auth.activeProjectId ? { ...projectRecord, data: editor.project } : projectRecord
  )), [auth.activeProjectId, auth.projects, editor.project]);
  const {
    accountStorageQuotaBytes,
    exactStorageAssetSizesByUrl,
    getCurrentStorageAssetSizesByUrl,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    storageSummary,
    updateStorageQuotaBytes,
  } = useAccountStorage({
    activeProject: editor.project,
    activeProjectId: auth.activeProjectId,
    projects: profileProjects,
    user: auth.user,
  });
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
    if (selectedTutorialTab === 'guided_creation' && step?.tab === 'preview') {
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
      setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, 'profile', auth.user)[0] ?? null);
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

  const saveProjectAndAcknowledge = useProjectSaveAcknowledger({
    activeProjectId: auth.activeProjectId,
    markProjectSaveFailed,
    markProjectSaveStarted,
    markProjectSaved,
    saveProject: auth.saveProject,
  });

  const {
    handleExportAuthorSummary,
    handleExportProjectJson,
    handleExportStandalone,
    importProjectJson,
  } = useBuilderProjectFileActions({
    activeProjectId: auth.activeProjectId,
    editor,
    preview,
    saveProjectAndAcknowledge,
    setSaveStatus,
  });

  const {
    openProfileFromBuilder,
  } = useBuilderProfileNavigation({
    alertDialog,
    auth,
    editor,
    hydratedProjectRef,
    onExitToProfile,
    saveProjectAndAcknowledge,
    setSaveStatus,
    setScreen,
  });

  const {
    handleUpload,
    importProfileMediaFile,
    uploadGalleryThumbnail,
  } = useBuilderMediaUpload({
    accountStorageQuotaBytes,
    activeProjectId: auth.activeProjectId,
    alertDialog,
    editor,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    preview,
    saveProjectAndAcknowledge,
    setSaveStatus,
    userId: auth.user?.id,
  });

  useEffect(() => {
    if (!auth.user?.id) {
      setAiCreditBalance(0);
      updateStorageQuotaBytes();
      return undefined;
    }

    let cancelled = false;
    const refreshCredits = async () => {
      try {
        const headers = await getSupabaseAuthHeaders();
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

  const {
    createProjectFromProfile,
    deleteProjectFromProfile,
    duplicateProjectFromProfile,
    importProjectFromProfile,
    openProjectInEditor,
    publishProjectFromProfile,
    renameProjectFromProfile,
    shareProjectFromProfile,
    downloadProjectQrCodeFromProfile,
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
    showCenterNotice,
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
      setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, 'profile', auth.user)[0] ?? null);
      return;
    }
    const startTab = tutorialTab;
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
    setTutorialStepIndex(getTutorialStepIndexesFromSteps(steps, tutorialTab, auth.user)[0] ?? 0);
  }, [
    auth.activeProjectId,
    auth.loadProject,
    auth.projects,
    auth.user,
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

  const startProPromotionFromProfile = useCallback(async ({ kind = 'promote', title = '' } = {}) => {
    const record = await createProjectFromProfile(title || 'Extension d’expérience', 'empty', PRO_PROMOTION_PROJECT_MODE, {
      initialTab: 'scenes',
      proPromotionKind: kind,
    });
    if (record?.id) setSaveStatus('Extension d’expérience créée');
    return record;
  }, [createProjectFromProfile]);

  const openPublicGalleryWindow = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('gallery', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, []);

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

    if (canStoreProjectAssetsRemotely() && typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      try {
        const uploadedImage = await uploadGeneratedProjectImageAsset({
          imageData,
          imageName: nextPatch[imageNameField],
          projectId: auth.activeProjectId,
          slideId: nextPatch.slideId,
          targetId: id,
          type,
          userId: auth.user?.id,
        });
        if (uploadedImage?.publicUrl) {
          const imageVariants = Array.isArray(nextPatch.aiImageVariants) ?
            nextPatch.aiImageVariants.map((variant) => (
              variant?.imageData === imageData ? { ...variant, imageData: uploadedImage.publicUrl, imageName: variant.imageName || nextPatch[imageNameField] } : variant
            ))
            : nextPatch.aiImageVariants;
          nextPatch = {
            ...nextPatch,
            [imageField]: uploadedImage.publicUrl,
            [imageNameField]: uploadedImage.imageName,
            imageStoragePath: uploadedImage.path,
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
  const activeMediaProjectId = auth.activeProjectId || activeBuilderProjectId || 'active-project';
  const mediaLibrary = useMemo(() => {
    if (screen !== 'editor') return [];

    const activeProject = auth.projects.find((projectRecord) => projectRecord.id === auth.activeProjectId);
    const sourceProjects = [{
      id: activeMediaProjectId,
      name: activeProject?.name || activeProject?.data?.title || editor.project?.title,
      data: editor.project,
      isActive: true,
    }].filter((entry) => entry?.data);

    return [
      ...new Map(sourceProjects.flatMap((entry) => (
        collectProjectAssets(entry.data).map((asset) => ({
          ...asset,
          projectId: entry.id,
          projectName: entry.name || entry.data?.title,
        }))
      ))
        .filter((asset) => asset.url)
        .map((asset) => [asset.url, asset])).values(),
    ];
  }, [activeMediaProjectId, auth.activeProjectId, auth.projects, editor.project, screen]);
  const offlineExportKnownAssets = useMemo(() => ([
    ...mediaLibrary,
    ...[...exactStorageAssetSizesByUrl.entries()].map(([url, storageBytes]) => ({
      url,
      storageBytes,
    })),
  ]), [exactStorageAssetSizesByUrl, mediaLibrary]);
  const offlineExportEstimateMessage = useMemo(
    () => getOfflineExportEstimateMessage(editor.project, { knownAssets: offlineExportKnownAssets }),
    [editor.project, offlineExportKnownAssets],
  );
  const getFreshOfflineExportEstimateMessage = useCallback(async () => {
    const sizesByUrl = await getCurrentStorageAssetSizesByUrl();
    const exactAssets = [...sizesByUrl.entries()].map(([url, storageBytes]) => ({
      url,
      storageBytes,
    }));
    return getOfflineExportEstimateMessage(editor.project, {
      knownAssets: [...mediaLibrary, ...exactAssets],
    });
  }, [editor.project, getCurrentStorageAssetSizesByUrl, mediaLibrary]);
  const registerAnime2dSaveBeforeLeave = useCallback((saveHandler) => {
    anime2dSaveBeforeLeaveRef.current = saveHandler;
  }, []);
  const tabContext = useMemo(() => ({
    editor,
    preview,
    heroCharacterPreviewRequestKey,
    user: auth.user,
    activeProjectId: auth.activeProjectId,
    projects: profileProjects,
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
    profileProjects,
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
      <BuilderGuide
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
        <GalleryBrowser
          user={auth.user}
          authorProfile={auth.authorProfile}
          initialGameKey={window.__escapeInitialGalleryGame || ''}
          initialCreatorId={window.__escapeInitialGalleryCreator || ''}
          initialCreatorSlug={window.__escapeInitialGalleryCreatorSlug || getAuthorProfileSlugFromPath()}
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
    if (!showAuthEntry && !auth.isPasswordRecovery) {
      return (
        <Suspense fallback={<LandingLoadingFallback />}>
          <LandingExperience
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
          <AuthEntry
            onLogin={auth.login}
            onRegister={auth.register}
            onRequestPasswordReset={auth.requestPasswordReset}
            onUpdatePassword={auth.updatePassword}
            onBack={closeAuthEntry}
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
          <ProfileWorkspace
            user={auth.user}
            canOpenAdmin={isAdminUser(auth.user)}
            projects={profileProjects}
            activeProjectId={auth.activeProjectId}
            authorProfile={auth.authorProfile}
            isBusy={auth.isBusy}
            statusMessage={saveStatus}
            syncStatus={auth.isBusy ? 'syncing' : hasRemoteStorageConfig() ? 'synced' : 'offline'}
            onCreateProject={createProjectFromProfile}
            onOpenProject={openProjectInEditor}
            onTestProject={testProjectFromProfile}
            onCopyProjectLink={shareProjectFromProfile}
            onSaveProjectQrCode={downloadProjectQrCodeFromProfile}
            onPublishProject={publishProjectFromProfile}
            onUnpublishProject={unpublishProjectFromProfile}
            onUpdatePublicSettings={updatePublicSettingsFromProfile}
            onUploadGalleryThumbnail={uploadGalleryThumbnail}
            onOpenPublicGallery={openPublicGalleryWindow}
            onOpenAdmin={openAdminScreen}
            onStartProPromotion={startProPromotionFromProfile}
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
            profileTutorialStep={selectedTutorialTab === 'profile' ? activeTutorialStep : null}
          />
        </Suspense>
        <CenterScreenNotice message={centerNotice} onDone={() => setCenterNotice('')} />
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
          <AdminConsole
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
        confirmStandaloneOfflineExport={confirmDialog}
        offlineExportEstimateMessage={offlineExportEstimateMessage}
        getOfflineExportEstimateMessage={getFreshOfflineExportEstimateMessage}
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

export default BuilderStudio;
