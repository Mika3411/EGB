import { useCallback } from 'react';
import { createInitialProject, normalizeProject } from '../../../shared/data/projectData';
import { prepareProjectForTutorial } from '../../../shared/data/tutorialSteps';
import { getProjectName } from '../../../shared/services/projectAnalysis';
import { applyCreationTemplate } from '../../../shared/services/projectTemplates';
import { showPrompt } from '../../../shared/ui/AccessibleDialog';
import { getSafeBuilderTab } from '../../../shared/utils/tutorialHelpers';
import { readBuilderUiState } from '../../../shared/utils/storageHelpers';
import {
  formatProjectImportError,
  importProjectFromJsonText,
} from '../../../shared/utils/projectJsonImport';

export function useProfileProjectActions({
  auth,
  confirmDialog,
  editor,
  hydratedProjectRef,
  preview,
  saveProject = auth.saveProject,
  setSaveStatus,
  showCenterNotice,
  setScreen,
  startCreationGuide,
}) {
  const openProjectInEditor = useCallback(async (projectId, options = {}) => {
    try {
      const savedProject = await auth.loadProject(projectId);
      const savedRecord = auth.projects.find((project) => project.id === projectId);
      const normalizedSavedProject = normalizeProject(savedProject || createInitialProject());
      if (normalizedSavedProject.isTemporaryTutorial && !options.tutorialTab) {
        delete normalizedSavedProject.isTemporaryTutorial;
        if (normalizedSavedProject.title === 'Projet didacticiel temporaire') {
          normalizedSavedProject.title = savedRecord?.name || 'Projet';
        }
        if (projectId) {
          await saveProject(normalizedSavedProject, projectId, {
            tab: 'animation',
            selectedSceneId: normalizedSavedProject.scenes?.[0]?.id || '',
          });
        }
        setSaveStatus('Projet récupéré');
      }
      const projectToLoad = prepareProjectForTutorial(
        normalizedSavedProject,
        options.tutorialTab,
      );
      const resumeState = auth.getProjectResumeState(projectId);
      const localResumeState = readBuilderUiState(auth.user?.id, projectId);
      const requestedTab = options.tab || localResumeState?.tab || resumeState?.tab;
      const resumeTab = getSafeBuilderTab(requestedTab, projectToLoad);
      const requestedSceneId = localResumeState?.selectedSceneId || resumeState?.selectedSceneId;
      const resumeSceneId = projectToLoad.scenes?.some((scene) => scene.id === requestedSceneId) ?
         requestedSceneId
        : projectToLoad.scenes?.[0]?.id || '';
      editor.loadProject(projectToLoad);
      editor.setTab(resumeTab);
      if (resumeSceneId) editor.setSelectedSceneId(resumeSceneId);
      preview.syncWithProject(projectToLoad);
      hydratedProjectRef.current = projectId || auth.activeProjectId;
      setScreen('editor');
      setSaveStatus(savedProject ? 'Projet chargé' : 'Nouveau projet');
      if (options.tutorialTab && projectId) {
        await saveProject(projectToLoad, projectId, {
          tab: resumeTab,
          selectedSceneId: resumeSceneId,
        });
      }
      return projectToLoad;
    } catch (error) {
      console.error('Erreur de chargement du projet', error);
      setSaveStatus('Erreur de chargement');
      return null;
    }
  }, [
    auth.activeProjectId,
    auth.getProjectResumeState,
    auth.loadProject,
    auth.projects,
    auth.user?.id,
    editor.loadProject,
    editor.setSelectedSceneId,
    editor.setTab,
    hydratedProjectRef,
    preview.syncWithProject,
    saveProject,
    setSaveStatus,
    setScreen,
  ]);

  const createProjectFromProfile = useCallback(async (name, templateId = 'empty', creationMode = 'beginner', options = {}) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, name);
    project.creationMode = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'].includes(creationMode) ? creationMode : 'beginner';
    const record = await auth.createProject(project, name || project.title);
    if (record?.id) {
      const projectToGuide = await openProjectInEditor(record.id, options.startCreationGuide ? { tab: 'scenes' } : {});
      if (options.startCreationGuide) await startCreationGuide?.(projectToGuide || project);
    }
    return record;
  }, [auth.createProject, openProjectInEditor, startCreationGuide]);

  const renameProjectFromProfile = useCallback(async (projectId, name) => {
    await auth.renameProject(projectId, name);
    if (projectId === auth.activeProjectId) {
      editor.patchProject((draft) => {
        draft.title = name;
      });
    }
    setSaveStatus('Projet renommé');
  }, [auth.activeProjectId, auth.renameProject, editor.patchProject, setSaveStatus]);

  const updateProjectModeFromProfile = useCallback(async (projectId, creationMode) => {
    const updatedProject = await auth.updateProjectMode(projectId, creationMode);
    if (updatedProject?.data && projectId === auth.activeProjectId) {
      editor.loadProject(normalizeProject(updatedProject.data));
    } else if (projectId === auth.activeProjectId) {
      editor.patchProject((draft) => {
        draft.creationMode = creationMode;
      }, { rememberHistory: false });
    }
    setSaveStatus('Mode du projet mis à jour');
  }, [auth.activeProjectId, auth.updateProjectMode, editor.loadProject, editor.patchProject, setSaveStatus]);

  const duplicateProjectFromProfile = useCallback(async (projectId) => {
    const copy = await auth.duplicateProject(projectId);
    setSaveStatus(copy ? 'Projet dupliqué' : 'Duplication impossible');
  }, [auth.duplicateProject, setSaveStatus]);

  const deleteProjectFromProfile = useCallback(async (projectId, label = '') => {
    const projectLabel = label
      || auth.projects.find((projectRecord) => projectRecord.id === projectId)?.name
      || auth.projects.find((projectRecord) => projectRecord.id === projectId)?.data?.title
      || 'ce projet';
    const confirmed = await confirmDialog({
      title: 'Supprimer le projet',
      message: `Supprimer "${projectLabel}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    await auth.deleteProject(projectId);
    if (hydratedProjectRef.current === projectId) {
      hydratedProjectRef.current = '';
      setScreen('profile');
    }
    setSaveStatus('Projet supprimé');
  }, [auth.deleteProject, auth.projects, confirmDialog, hydratedProjectRef, setSaveStatus, setScreen]);

  const testProjectFromProfile = useCallback(async (projectId) => {
    await openProjectInEditor(projectId, { tab: 'preview' });
  }, [openProjectInEditor]);

  const shareProjectFromProfile = useCallback(async (projectId) => {
    if (!auth.user?.id || !projectId) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('playUser', auth.user.id);
    url.searchParams.set('playProject', projectId);

    try {
      if (projectId === auth.activeProjectId && hydratedProjectRef.current === projectId) {
        await saveProject(editor.project, projectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
      }
      await auth.markProjectLinkCopied(projectId);
      await navigator.clipboard.writeText(url.toString());
      setSaveStatus('Lien joueur public copié');
    } catch (error) {
      console.error('Erreur de génération du lien jouable', error);
      await showPrompt({
        title: 'Lien jouable',
        message: 'Copie ce lien pour partager le projet.',
        defaultValue: url.toString(),
        confirmLabel: 'Fermer',
      });
      setSaveStatus('Lien joueur public généré');
    }
  }, [
    auth.activeProjectId,
    auth.markProjectLinkCopied,
    auth.user?.id,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    hydratedProjectRef,
    saveProject,
    setSaveStatus,
  ]);

  const publishProjectFromProfile = useCallback(async (projectId) => {
    const existingProject = auth.projects.find((project) => project.id === projectId);
    const isUpdate = Boolean(existingProject?.shareState?.isPublic);
    if (projectId === auth.activeProjectId && hydratedProjectRef.current === projectId) {
      await saveProject(editor.project, projectId, {
        tab: editor.tab,
        selectedSceneId: editor.selectedSceneId,
      });
    }
    const publishedProject = await auth.publishProject(projectId);
    const projectName = getProjectName(publishedProject || existingProject);
    const statusMessage = isUpdate
      ? `${projectName} est mis à jour dans la galerie publique`
      : 'Jeu publié dans la galerie';
    setSaveStatus(statusMessage);
    if (isUpdate) showCenterNotice?.(statusMessage);
  }, [
    auth.activeProjectId,
    auth.projects,
    auth.publishProject,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    hydratedProjectRef,
    saveProject,
    setSaveStatus,
    showCenterNotice,
  ]);

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
  }, [auth.unpublishProject, confirmDialog, setSaveStatus]);

  const updatePublicSettingsFromProfile = useCallback(async (projectId, settings) => {
    await auth.updateProjectShareSettings(projectId, settings);
    setSaveStatus('Paramètres publics mis à jour');
  }, [auth.updateProjectShareSettings, setSaveStatus]);

  const importProjectFromProfile = useCallback(async (file) => {
    try {
      const text = await file.text();
      const parsed = importProjectFromJsonText(text).project;
      const record = await auth.importProject(parsed, parsed.title || file.name.replace(/\.json$/i, ''));
      if (record?.id) await openProjectInEditor(record.id);
      setSaveStatus('Projet importé');
    } catch (error) {
      setSaveStatus(formatProjectImportError(error));
      throw error;
    }
  }, [auth.importProject, openProjectInEditor, setSaveStatus]);

  return {
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
  };
}
