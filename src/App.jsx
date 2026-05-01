import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import ScenesTab from './components/ScenesTab';
import MediaTab from './components/MediaTab';
import RouteMapTab from './components/RouteMapTab';
import CinematicsTab from './components/CinematicsTab';
import CombinationsTab from './components/CombinationsTab';
import EnigmasTab from './components/EnigmasTab';
import LogicTab from './components/LogicTab';
import ScoreTab from './components/ScoreTab';
import AiTab from './components/AiTab';
import ShopTab from './components/ShopTab';
import HelpTab from './components/HelpTab';
import PreviewPlayerPanel from './components/PreviewPlayerPanel';
import BuilderTutorial from './components/BuilderTutorial';
import AuthPanel from './components/AuthPanel';
import LandingPage from './components/LandingPage';
import ProfilePage from './components/ProfilePage';
import AdminPage from './components/AdminPage';
import PublicGallery from './components/PublicGallery';
import { createInitialProject, normalizeProject } from './data/projectData';
import {
  BUILDER_TUTORIAL_STEPS,
  BUILDER_TUTORIAL_TABS,
  getFakeWindowImageOptions,
  getTutorialName,
  getTutorialStepIndexes,
  prepareProjectForTutorial,
} from './data/tutorialSteps';
import { fileToDataURL, uploadFileToSupabase } from './utils/fileHelpers';
import { exportProjectJson, exportStandalone } from './utils/exporters';
import { mergeProjectPatch, validateProject } from './utils/projectValidation';
import { calculateProjectScore } from './utils/projectScore';
import { useProjectEditor } from './hooks/useProjectEditor.jsx';
import { usePreviewPlayer } from './hooks/usePreviewPlayer';
import { useSharedPlayableRoute } from './hooks/useSharedPlayableRoute';
import { collectDescendantSceneIds } from './lib/sceneHelpers';
import { applyCreationTemplate } from './lib/projectTemplates';
import { useLocalAuth } from './hooks/useLocalAuth';
import { normalizeEmail } from './lib/authStorage';
import { buildStoragePath, hasSupabaseConfig, uploadToStorage } from './supabaseStorage';

const ADMIN_EMAIL = 'thorez.m@hotmail.fr';
const PROFILE_TUTORIAL_SEEN_KEY_PREFIX = 'escapeGameBuilder.profileTutorialSeen';

const isAdminUser = (user) => normalizeEmail(user?.email) === ADMIN_EMAIL;
const getProfileTutorialSeenKey = (userId) => `${PROFILE_TUTORIAL_SEEN_KEY_PREFIX}.${userId}`;

const dataUrlToBlob = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const extensionFromMime = (mimeType = '') => {
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('svg')) return 'svg';
  return 'png';
};

function App() {
  const editor = useProjectEditor();
  const preview = usePreviewPlayer(editor.project, { getItemById: editor.getItemById });
  const projectScore = calculateProjectScore(editor.project);
  const auth = useLocalAuth();
  const [saveStatus, setSaveStatus] = useState('');
  const [screen, setScreen] = useState('profile');
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState('login');
  const [sharedLoadStatus, setSharedLoadStatus] = useState('');
  const [tutorialStepIndex, setTutorialStepIndex] = useState(null);
  const [selectedTutorialTab, setSelectedTutorialTab] = useState('scenes');
  const hydratedProjectRef = useRef('');
  const profileTutorialAutoStartedRef = useRef('');
  const sharedRouteRef = useSharedPlayableRoute({
    editor,
    preview,
    setScreen,
    setSharedLoadStatus,
  });
  const activeTutorialIndexes = tutorialStepIndex === null ? [] : getTutorialStepIndexes(selectedTutorialTab);
  const activeTutorialPosition = activeTutorialIndexes.indexOf(tutorialStepIndex);
  const activeTutorialStep = tutorialStepIndex === null ? null : BUILDER_TUTORIAL_STEPS[tutorialStepIndex];
  const tutorialUserName = getTutorialName(auth.user);

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
    if (tutorialStepIndex === null) return;
    const step = BUILDER_TUTORIAL_STEPS[tutorialStepIndex];
    if (step?.tab && step.tab !== 'profile' && editor.tab !== step.tab) editor.setTab(step.tab);
    if (selectedTutorialTab === 'editor' && step?.tab === 'preview') {
      const scene = editor.project.scenes.find((entry) => entry.id === editor.selectedSceneId) || editor.project.scenes[0];
      if (!scene) return;
      preview.setPlayingCinematic(null);
      preview.setViewerImage(null);
      preview.setPlaySceneId(scene.id);
      preview.setDialogue(scene.introText || '');
    }
  }, [tutorialStepIndex, selectedTutorialTab, editor, preview]);

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
    if (screen === 'admin' && auth.user && !isAdminUser(auth.user)) {
      setScreen('profile');
    }
  }, [screen, auth.user]);

  useEffect(() => {
    if (!auth.isReady || !auth.user?.id) return;
    if (screen !== 'profile') return;
    if (tutorialStepIndex !== null) return;
    if (profileTutorialAutoStartedRef.current === auth.user.id) return;

    const seenKey = getProfileTutorialSeenKey(auth.user.id);
    if (window.localStorage.getItem(seenKey) === '1') return;

    profileTutorialAutoStartedRef.current = auth.user.id;
    window.localStorage.setItem(seenKey, '1');
    setSelectedTutorialTab('profile');
    setTutorialStepIndex(getTutorialStepIndexes('profile')[0] ?? null);
  }, [auth.isReady, auth.user, screen, tutorialStepIndex]);

  useEffect(() => {
    let isCancelled = false;
    let saveTimer = null;

    async function persistProject() {
      if (!auth.user?.id) return;
      if (screen !== 'editor') return;
      if (!auth.activeProjectId) return;
      if (hydratedProjectRef.current !== auth.activeProjectId) return;

      try {
        await auth.saveProject(editor.project, auth.activeProjectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
        if (!isCancelled) {
          setSaveStatus(hasSupabaseConfig() ? 'SauvegardÃ© dans Supabase' : 'SauvegardÃ© localement');
        }
      } catch (error) {
        console.error('Erreur de sauvegarde du projet', error);
        if (!isCancelled) {
          setSaveStatus('Erreur de sauvegarde');
        }
      }
    }

    saveTimer = window.setTimeout(persistProject, 900);

    return () => {
      isCancelled = true;
      if (saveTimer) window.clearTimeout(saveTimer);
    };
  }, [auth.user, auth.activeProjectId, editor.project, editor.tab, editor.selectedSceneId, screen]);

  const handleUpload = async (event, callback) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { publicUrl } = await uploadFileToSupabase(file, {
        userId: auth.user?.id,
        folder: file.type?.startsWith('image/') ?
           'images'
          : file.type?.startsWith('audio/') ?
             'audio'
            : file.type?.startsWith('video/') ?
               'video'
              : 'files',
        optimizeImage: file.type?.startsWith('image/'),
        imageOptions: {
          maxDimension: 1600,
          quality: 0.82,
        },
      });

      callback(publicUrl, file.name);
      setSaveStatus(`${file.type?.startsWith('video/') ? 'VidÃ©o' : file.type?.startsWith('audio/') ? 'Son' : 'MÃ©dia'} importÃ©${file.type?.startsWith('image/') ? 'e' : ''} dans Supabase : ${file.name}`);
    } catch (error) {
      console.error('Erreur import mÃ©dia', error);
      alert(
        hasSupabaseConfig() ?
           "Impossible d'envoyer ce fichier vers Supabase Storage. VÃ©rifie le bucket et les policies."
          : 'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) et Ã©ventuellement VITE_SUPABASE_STORAGE_BUCKET.',
      );
    } finally {
      event.target.value = '';
    }
  };

  const uploadGalleryThumbnail = async (file) => {
    if (!file) throw new Error('Aucune miniature Ã  envoyer.');

    if (!hasSupabaseConfig()) {
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
  };

  const handleDeleteItem = (itemId) => {
    const item = editor.project.items.find((entry) => entry.id === itemId);
    if (!window.confirm(`Supprimer l'objet "${item?.name || 'sÃ©lectionnÃ©'}" ?`)) return;
    preview.removeInventoryItemReferences(itemId);
    editor.deleteItem(itemId);
  };

  const handleDeleteScene = (sceneId) => {
    const deletedSceneIds = collectDescendantSceneIds(editor.project.scenes, sceneId);
    const scene = editor.project.scenes.find((entry) => entry.id === sceneId);
    const suffix = deletedSceneIds.size > 1 ? ` et ses ${deletedSceneIds.size - 1} sous-scÃ¨ne(s)` : '';
    if (!window.confirm(`Supprimer la scÃ¨ne "${scene?.name || 'sÃ©lectionnÃ©e'}"${suffix} ?`)) return;
    const remainingScenes = editor.project.scenes.filter((scene) => !deletedSceneIds.has(scene.id));
    const fallbackScene = remainingScenes[0] || null;
    editor.deleteScene(sceneId);
    preview.removeDeletedSceneReferences(deletedSceneIds, fallbackScene);
  };

  const handleDeleteEnigma = (enigmaId) => {
    const enigma = editor.project.enigmas.find((entry) => entry.id === enigmaId);
    if (!window.confirm(`Supprimer l'Ã©nigme "${enigma?.name || 'sÃ©lectionnÃ©e'}" ?`)) return;
    editor.deleteEnigma(enigmaId);
  };

  const handlePreviewScene = (sceneId) => {
    const scene = editor.project.scenes.find((entry) => entry.id === sceneId);
    if (!scene) return;

    preview.setPlayingCinematic(null);
    preview.setViewerImage(null);
    preview.setPlaySceneId(scene.id);
    preview.setDialogue(scene.introText || '');
    editor.setTab('preview');
  };

  const handlePreviewEnigma = (enigmaId) => {
    const enigma = editor.project.enigmas.find((entry) => entry.id === enigmaId);
    if (!enigma) return;

    preview.setPlayingCinematic(null);
    preview.setViewerImage(null);
    preview.openEnigma(enigma);
    editor.setTab('preview');
  };

  const handleExportProjectJson = () => exportProjectJson(editor.project);
  const handleExportStandalone = async () => exportStandalone(editor.project);

  const openProjectInEditor = async (projectId, options = {}) => {
    try {
      const savedProject = await auth.loadProject(projectId);
      const projectToLoad = prepareProjectForTutorial(
        normalizeProject(savedProject || createInitialProject()),
        options.tutorialTab,
      );
      const resumeState = auth.getProjectResumeState(projectId);
      const requestedTab = options.tab || resumeState?.tab;
      const resumeTab = ['scenes', 'media', 'map', 'cinematics', 'combinations', 'enigmas', 'logic', 'score', 'ai', 'shop', 'help', 'preview'].includes(requestedTab) ?
         requestedTab
        : 'scenes';
      const resumeSceneId = projectToLoad.scenes?.some((scene) => scene.id === resumeState?.selectedSceneId) ?
         resumeState.selectedSceneId
        : projectToLoad.scenes?.[0]?.id || '';
      editor.loadProject(projectToLoad);
      editor.setTab(resumeTab);
      if (resumeSceneId) editor.setSelectedSceneId(resumeSceneId);
      preview.syncWithProject(projectToLoad);
      hydratedProjectRef.current = projectId || auth.activeProjectId;
      setScreen('editor');
      setSaveStatus(savedProject ? 'Projet chargÃ©' : 'Nouveau projet');
      if (options.tutorialTab && projectId) {
        await auth.saveProject(projectToLoad, projectId, {
          tab: resumeTab,
          selectedSceneId: resumeSceneId,
        });
      }
    } catch (error) {
      console.error('Erreur de chargement du projet', error);
      setSaveStatus('Erreur de chargement');
    }
  };

  const createProjectFromProfile = async (name, templateId = 'empty') => {
    const project = applyCreationTemplate(createInitialProject(), templateId, name);
    const record = await auth.createProject(project, name || project.title);
    if (record?.id) await openProjectInEditor(record.id);
  };

  const startBuilderTutorialFromProfile = async (requestedTab = 'scenes') => {
    const tutorialTab = BUILDER_TUTORIAL_TABS.includes(requestedTab) ? requestedTab : 'scenes';
    if (tutorialTab === 'profile') {
      if (auth.user?.id) {
        window.localStorage.setItem(getProfileTutorialSeenKey(auth.user.id), '1');
      }
      setScreen('profile');
      setSelectedTutorialTab('profile');
      setTutorialStepIndex(getTutorialStepIndexes('profile')[0] ?? null);
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
    setSaveStatus('Didacticiel temporaire : non enregistre');
    setSelectedTutorialTab(tutorialTab);
    setTutorialStepIndex(getTutorialStepIndexes(tutorialTab)[0] ?? 0);
  };

  const applyFakeTutorialImage = ({ name, dataUrl, target = 'object' }) => {
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
  };

  const renameProjectFromProfile = async (projectId, name) => {
    await auth.renameProject(projectId, name);
    if (projectId === auth.activeProjectId) {
      editor.patchProject((draft) => {
        draft.title = name;
      });
    }
    setSaveStatus('Projet renommÃ©');
  };

  const duplicateProjectFromProfile = async (projectId) => {
    const copy = await auth.duplicateProject(projectId);
    setSaveStatus(copy ? 'Projet dupliquÃ©' : 'Duplication impossible');
  };

  const deleteProjectFromProfile = async (projectId) => {
    await auth.deleteProject(projectId);
    if (hydratedProjectRef.current === projectId) {
      hydratedProjectRef.current = '';
      setScreen('profile');
    }
    setSaveStatus('Projet supprimÃ©');
  };

  const testProjectFromProfile = async (projectId) => {
    await openProjectInEditor(projectId, { tab: 'preview' });
  };

  const shareProjectFromProfile = async (projectId) => {
    if (!auth.user?.id || !projectId) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('playUser', auth.user.id);
    url.searchParams.set('playProject', projectId);

    try {
      if (projectId === auth.activeProjectId && hydratedProjectRef.current === projectId) {
        await auth.saveProject(editor.project, projectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
      }
      await auth.markProjectLinkCopied(projectId);
      await navigator.clipboard.writeText(url.toString());
      setSaveStatus('Lien joueur public copiÃ©');
    } catch (error) {
      console.error('Erreur de gÃ©nÃ©ration du lien jouable', error);
      window.prompt('Lien jouable', url.toString());
      setSaveStatus('Lien joueur public gÃ©nÃ©rÃ©');
    }
  };

  const publishProjectFromProfile = async (projectId) => {
    if (projectId === auth.activeProjectId && hydratedProjectRef.current === projectId) {
      await auth.saveProject(editor.project, projectId, {
        tab: editor.tab,
        selectedSceneId: editor.selectedSceneId,
      });
    }
    await shareProjectFromProfile(projectId);
    setSaveStatus('Jeu publiÃ© dans la galerie');
  };

  const updatePublicSettingsFromProfile = async (projectId, settings) => {
    await auth.updateProjectShareSettings(projectId, settings);
    setSaveStatus('ParamÃ¨tres publics mis Ã  jour');
  };

  const updateAuthorProfileFromProfile = async (profile) => {
    await auth.updateAuthorProfile(profile);
    setSaveStatus('Profil auteur mis Ã  jour');
  };

  const openPublicGalleryWindow = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('gallery', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const importProjectFromProfile = async (file) => {
    const text = await file.text();
    const parsed = normalizeProject(JSON.parse(text));
    const record = await auth.importProject(parsed, parsed.title || file.name.replace(/\.json$/i, ''));
    if (record?.id) await openProjectInEditor(record.id);
    setSaveStatus('Projet importÃ©');
  };

  const importProjectJson = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = normalizeProject(JSON.parse(text));
    editor.loadProject(parsed);
    preview.syncWithProject(parsed);
    if (auth.activeProjectId) await auth.saveProject(parsed, auth.activeProjectId);
    setSaveStatus('Projet importÃ© et sauvegardÃ©');
    event.target.value = '';
  };

  const applyAiProject = async (generatedProject, options = {}) => {
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

    const projectToLoad = validation.project;
    const selectedSceneId = projectToLoad.scenes?.some((scene) => scene.id === options.selectedSceneId) ?
       options.selectedSceneId
      : projectToLoad.scenes?.[0]?.id || '';
    editor.loadProject(projectToLoad);
    editor.setSelectedSceneId(selectedSceneId);
    editor.setSelectedHotspotId(projectToLoad.scenes?.find((scene) => scene.id === selectedSceneId)?.hotspots?.[0]?.id || '');
    preview.syncWithProject(projectToLoad);
    editor.setTab('ai');
    if (auth.activeProjectId) {
      await auth.saveProject(projectToLoad, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId,
      });
    }
    setSaveStatus(options.isPatch || options.mode === 'improve' ? 'AmÃ©lioration IA appliquÃ©e' : 'Projet IA appliquÃ©');
    return validation;
  };

  const saveAiDraft = async (draft) => {
    if (!draft) {
      const nextProject = structuredClone(editor.project);
      delete nextProject.aiDraft;
      delete nextProject.__aiDraft;
      editor.patchProject((current) => {
        delete current.aiDraft;
        delete current.__aiDraft;
      }, { rememberHistory: false });
      if (auth.activeProjectId) {
        await auth.saveProject(nextProject, auth.activeProjectId, {
          tab: 'ai',
          selectedSceneId: editor.selectedSceneId,
        });
      }
      setSaveStatus('Brouillon IA effacÃ©');
      return null;
    }
    const nextProject = structuredClone(editor.project);
    nextProject.aiDraft = draft;
    editor.patchProject((current) => {
      current.aiDraft = draft;
    }, { rememberHistory: false });

    if (auth.activeProjectId) {
      await auth.saveProject(nextProject, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId: editor.selectedSceneId,
      });
    }
    setSaveStatus('Brouillon IA sauvegardÃ©');
    return draft;
  };

  const persistAiImage = async ({ type, id, patch }) => {
    if (!type || !id || !patch) return null;
    let nextPatch = { ...patch };

    const imageField = type === 'scene' ? 'backgroundData' : 'imageData';
    const imageNameField = type === 'scene' ? 'backgroundName' : 'imageName';
    const imageData = nextPatch[imageField];

    if (auth.activeProjectId && hasSupabaseConfig() && typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      try {
        const blob = dataUrlToBlob(imageData);
        if (blob) {
          const extension = extensionFromMime(blob.type);
          const storageId = type === 'cinematicSlide' && nextPatch.slideId ? `${id}-${nextPatch.slideId}` : id;
          const version = Date.now().toString(36);
          const path = buildStoragePath('users', auth.user?.id, 'projects', auth.activeProjectId, 'ai-images', type, `${storageId}-${version}.${extension}`);
          const uploaded = await uploadToStorage(path, blob, {
            contentType: blob.type,
            cacheControl: '3600',
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
        setSaveStatus(`Image gÃ©nÃ©rÃ©e, mais upload Supabase impossible: ${error.message}`);
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
      await auth.saveProject(nextProject, auth.activeProjectId, {
        tab: 'ai',
        selectedSceneId: type === 'scene' ? id : editor.selectedSceneId,
      });
    }

    setSaveStatus(type === 'scene' ? 'Image de scÃ¨ne sauvegardÃ©e' : 'Image dâ€™objet sauvegardÃ©e');
    return { project: nextProject, patch: nextPatch };
  };

  const previewPanel = (
    <PreviewPlayerPanel editor={editor} preview={preview} sharedPlayerMode={screen === 'shared-preview'} />
  );

  const handleTutorialNext = () => setTutorialStepIndex((index) => (
    index === null || activeTutorialPosition >= activeTutorialIndexes.length - 1 ? null : activeTutorialIndexes[activeTutorialPosition + 1]
  ));

  const renderTutorialOverlay = () => activeTutorialStep ? (
    <BuilderTutorial
      step={activeTutorialStep}
      stepNumber={Math.max(0, activeTutorialPosition) + 1}
      totalSteps={activeTutorialIndexes.length || 1}
      canPrevious={activeTutorialPosition > 0}
      userName={tutorialUserName}
      project={editor.project}
      fakeFileOptions={getFakeWindowImageOptions(editor.project, activeTutorialStep?.completeWhen?.target)}
      onFakeFileChosen={applyFakeTutorialImage}
      onNext={handleTutorialNext}
      onPrevious={() => setTutorialStepIndex(activeTutorialIndexes[Math.max(0, activeTutorialPosition - 1)] ?? null)}
      onClose={() => setTutorialStepIndex(null)}
    />
  ) : null;

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
      </div>
    );
  }

  if (screen === 'gallery') {
    return (
      <PublicGallery
        user={auth.user}
        authorProfile={auth.authorProfile}
        initialGameKey={window.__escapeInitialGalleryGame || ''}
        initialCreatorId={window.__escapeInitialGalleryCreator || ''}
        onUpdateAuthorProfile={updateAuthorProfileFromProfile}
        onSignup={() => setScreen('profile')}
        onClose={auth.user ? () => setScreen('profile') : null}
      />
    );
  }

  if (!auth.isReady) {
    return <div className="app-shell"><div className="panel">Chargement du compteâ€¦</div></div>;
  }

  if (!auth.user) {
    if (!showAuthPanel && !auth.isPasswordRecovery) {
      return (
        <LandingPage
          onLogin={() => {
            setAuthEntryMode('login');
            setShowAuthPanel(true);
          }}
          onRegister={() => {
            setAuthEntryMode('register');
            setShowAuthPanel(true);
          }}
          onOpenGallery={() => setScreen('gallery')}
        />
      );
    }

    return (
      <div className="app-shell">
        <AuthPanel
          onLogin={auth.login}
          onRegister={auth.register}
          onRequestPasswordReset={auth.requestPasswordReset}
          onUpdatePassword={auth.updatePassword}
          onBack={() => setShowAuthPanel(false)}
          initialMode={authEntryMode}
          isPasswordRecovery={auth.isPasswordRecovery}
          isBusy={auth.isBusy}
          errorMessage={auth.authError}
        />
      </div>
    );
  }

  if (screen === 'profile') {
    return (
      <div className="app-shell">
        <ProfilePage
          user={auth.user}
          canOpenAdmin={isAdminUser(auth.user)}
          projects={auth.projects}
          activeProjectId={auth.activeProjectId}
          isBusy={auth.isBusy}
          statusMessage={saveStatus}
          syncStatus={auth.isBusy ? 'syncing' : hasSupabaseConfig() ? 'synced' : 'offline'}
          onCreateProject={createProjectFromProfile}
          onOpenProject={openProjectInEditor}
          onTestProject={testProjectFromProfile}
          onCopyProjectLink={shareProjectFromProfile}
          onPublishProject={publishProjectFromProfile}
          onUpdatePublicSettings={updatePublicSettingsFromProfile}
          onUploadGalleryThumbnail={uploadGalleryThumbnail}
          onOpenPublicGallery={openPublicGalleryWindow}
          onOpenAdmin={() => setScreen('admin')}
          onStartTutorial={startBuilderTutorialFromProfile}
          onRenameProject={renameProjectFromProfile}
          onDuplicateProject={duplicateProjectFromProfile}
          onDeleteProject={deleteProjectFromProfile}
          onImportProject={importProjectFromProfile}
          onLogout={auth.logout}
          isProfileTutorialActive={selectedTutorialTab === 'profile' && Boolean(activeTutorialStep)}
        />
        {selectedTutorialTab === 'profile' ? renderTutorialOverlay() : null}
      </div>
    );
  }

  if (screen === 'admin') {
    if (!isAdminUser(auth.user)) {
      return null;
    }

    return (
      <div className="app-shell">
        <AdminPage
          user={auth.user}
          projects={auth.projects}
          onBack={() => setScreen('profile')}
          onLogout={auth.logout}
          onOpenProject={openProjectInEditor}
        />
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
        user={auth.user}
        onLogout={auth.logout}
        saveStatus={saveStatus || 'Sauvegarde active'}
      />

      <Tabs value={editor.tab} onChange={editor.setTab} onProfile={() => setScreen('profile')} projectScore={projectScore} />

      {editor.tab === 'scenes' && (
        <ScenesTab
          project={editor.project}
          actsWithScenes={editor.actsWithScenes}
          renderSceneTree={editor.renderSceneTree}
          addAct={editor.addAct}
          deleteAct={editor.deleteAct}
          addScene={editor.addScene}
          addItem={editor.addItem}
          selectedItemId={editor.selectedItemId}
          setSelectedItemId={editor.setSelectedItemId}
          selectedItem={editor.selectedItem}
          selectedScene={editor.selectedScene}
          selectedSceneId={editor.selectedSceneId}
          setSelectedSceneId={editor.setSelectedSceneId}
          setTab={editor.setTab}
          deleteScene={handleDeleteScene}
          previewScene={handlePreviewScene}
          patchProject={editor.patchProject}
          rememberProjectState={editor.rememberProjectState}
          undoProjectChange={editor.undoProjectChange}
          redoProjectChange={editor.redoProjectChange}
          canUndoProjectChange={editor.canUndoProjectChange}
          canRedoProjectChange={editor.canRedoProjectChange}
          selectedHotspotId={editor.selectedHotspotId}
          setSelectedHotspotId={editor.setSelectedHotspotId}
          handleUpload={handleUpload}
          getActById={editor.getActById}
          getSceneById={editor.getSceneById}
          getSceneDepth={editor.getSceneDepth}
          addSubsceneToSelectedScene={editor.addSubsceneToSelectedScene}
          childScenes={editor.childScenes}
          addHotspot={editor.addHotspot}
          selectedHotspot={editor.selectedHotspot}
          deleteItem={handleDeleteItem}
          deleteHotspot={editor.deleteHotspot}
          getSceneLabel={editor.getSceneLabel}
        />
      )}

      {editor.tab === 'media' && (
        <MediaTab
          project={editor.project}
          selectedScene={editor.selectedScene}
          selectedSceneId={editor.selectedSceneId}
          setSelectedSceneId={editor.setSelectedSceneId}
          setSelectedHotspotId={editor.setSelectedHotspotId}
          patchProject={editor.patchProject}
          handleUpload={handleUpload}
          getSceneLabel={editor.getSceneLabel}
        />
      )}

      {editor.tab === 'map' && (
        <RouteMapTab
          project={editor.project}
          patchProject={editor.patchProject}
          getSceneLabel={editor.getSceneLabel}
        />
      )}

      {editor.tab === 'cinematics' && (
        <CinematicsTab
          project={editor.project}
          selectedCinematicId={editor.selectedCinematicId}
          setSelectedCinematicId={editor.setSelectedCinematicId}
          selectedCinematic={editor.selectedCinematic}
          addCinematic={editor.addCinematic}
          addSlide={editor.addSlide}
          patchProject={editor.patchProject}
          handleUpload={handleUpload}
        />
      )}

      {editor.tab === 'combinations' && (
        <CombinationsTab
          project={editor.project}
          addCombination={editor.addCombination}
          getItemById={editor.getItemById}
          patchProject={editor.patchProject}
        />
      )}

      {editor.tab === 'enigmas' && (
        <EnigmasTab
          project={editor.project}
          selectedEnigmaId={editor.selectedEnigmaId}
          setSelectedEnigmaId={editor.setSelectedEnigmaId}
          selectedEnigma={editor.selectedEnigma}
          addEnigma={editor.addEnigma}
          deleteEnigma={handleDeleteEnigma}
          patchProject={editor.patchProject}
          getSceneLabel={editor.getSceneLabel}
          handleUpload={handleUpload}
          previewEnigma={handlePreviewEnigma}
        />
      )}

      {editor.tab === 'logic' && (
        <LogicTab
          project={editor.project}
          patchProject={editor.patchProject}
          getSceneLabel={editor.getSceneLabel}
          selectedSceneId={editor.selectedSceneId}
        />
      )}

      {editor.tab === 'score' && (
        <ScoreTab project={editor.project} />
      )}

      {editor.tab === 'ai' && (
        <AiTab
          project={editor.project}
          user={auth.user}
          getSceneLabel={editor.getSceneLabel}
          onApplyProject={applyAiProject}
          onSaveAiDraft={saveAiDraft}
          onPersistAiImage={persistAiImage}
          projectStorageKey={auth.activeProjectId || editor.project?.title || 'default'}
        />
      )}

      {editor.tab === 'shop' && (
        <ShopTab user={auth.user} />
      )}

      {editor.tab === 'help' && (
        <HelpTab onStartTutorial={startBuilderTutorialFromProfile} />
      )}

      {editor.tab === 'preview' && (
        <PreviewPlayerPanel editor={editor} preview={preview} />
      )}

      {selectedTutorialTab !== 'profile' ? renderTutorialOverlay() : null}
    </div>
  );
}

export default App;
