import { useCallback } from 'react';
import { writeBuilderUiState } from '../../../shared/utils/storageHelpers';
import { getProjectSaveStatus } from '../../../app/builder/hooks/useAutosaveProject';

export function useBuilderProfileNavigation({
  alertDialog,
  auth,
  editor,
  hydratedProjectRef,
  onExitToProfile,
  saveProjectAndAcknowledge,
  setSaveStatus,
  setScreen,
}) {
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
    setSaveStatus,
    setScreen,
  ]);

  return {
    openProfileFromBuilder,
  };
}
