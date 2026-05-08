import { useCallback } from 'react';
import { createInitialProject, normalizeProject } from '../data/projectData';
import { prepareProjectForTutorial } from '../data/tutorialSteps';
import { applyCreationTemplate } from '../lib/projectTemplates';
import { getSafeBuilderTab } from '../utils/tutorialHelpers';
import { readBuilderUiState } from '../utils/storageHelpers';

export function useProfileProjectActions({
  auth,
  confirmDialog,
  editor,
  hydratedProjectRef,
  preview,
  setSaveStatus,
  setScreen,
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
          await auth.saveProject(normalizedSavedProject, projectId, {
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
        await auth.saveProject(projectToLoad, projectId, {
          tab: resumeTab,
          selectedSceneId: resumeSceneId,
        });
      }
    } catch (error) {
      console.error('Erreur de chargement du projet', error);
      setSaveStatus('Erreur de chargement');
    }
  }, [
    auth.activeProjectId,
    auth.getProjectResumeState,
    auth.loadProject,
    auth.projects,
    auth.saveProject,
    auth.user?.id,
    editor.loadProject,
    editor.setSelectedSceneId,
    editor.setTab,
    hydratedProjectRef,
    preview.syncWithProject,
    setSaveStatus,
    setScreen,
  ]);

  const createProjectFromProfile = useCallback(async (name, templateId = 'empty', creationMode = 'beginner') => {
    const project = applyCreationTemplate(createInitialProject(), templateId, name);
    project.creationMode = ['beginner', 'intermediate', 'expert'].includes(creationMode) ? creationMode : 'beginner';
    const record = await auth.createProject(project, name || project.title);
    if (record?.id) await openProjectInEditor(record.id);
  }, [auth.createProject, openProjectInEditor]);

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
        await auth.saveProject(editor.project, projectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
      }
      await auth.markProjectLinkCopied(projectId);
      await navigator.clipboard.writeText(url.toString());
      setSaveStatus('Lien joueur public copié');
    } catch (error) {
      console.error('Erreur de génération du lien jouable', error);
      window.prompt('Lien jouable', url.toString());
      setSaveStatus('Lien joueur public généré');
    }
  }, [
    auth.activeProjectId,
    auth.markProjectLinkCopied,
    auth.saveProject,
    auth.user?.id,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    hydratedProjectRef,
    setSaveStatus,
  ]);

  const publishProjectFromProfile = useCallback(async (projectId) => {
    if (projectId === auth.activeProjectId && hydratedProjectRef.current === projectId) {
      await auth.saveProject(editor.project, projectId, {
        tab: editor.tab,
        selectedSceneId: editor.selectedSceneId,
      });
    }
    await auth.publishProject(projectId);
    setSaveStatus('Jeu publié dans la galerie');
  }, [
    auth.activeProjectId,
    auth.publishProject,
    auth.saveProject,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    hydratedProjectRef,
    setSaveStatus,
  ]);

  const unpublishProjectFromProfile = useCallback(async (projectId) => {
    const confirmed = window.confirm('Retirer ce jeu de la galerie publique ? Le projet restera dans ton profil.');
    if (!confirmed) return;
    await auth.unpublishProject(projectId);
    setSaveStatus('Jeu retiré de la galerie');
  }, [auth.unpublishProject, setSaveStatus]);

  const updatePublicSettingsFromProfile = useCallback(async (projectId, settings) => {
    await auth.updateProjectShareSettings(projectId, settings);
    setSaveStatus('Paramètres publics mis à jour');
  }, [auth.updateProjectShareSettings, setSaveStatus]);

  const importProjectFromProfile = useCallback(async (file) => {
    const text = await file.text();
    const parsed = normalizeProject(JSON.parse(text));
    const record = await auth.importProject(parsed, parsed.title || file.name.replace(/\.json$/i, ''));
    if (record?.id) await openProjectInEditor(record.id);
    setSaveStatus('Projet importé');
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
