import { useCallback, useEffect, useRef } from 'react';
import { isBuilderTab } from '../utils/tutorialHelpers';

export function useAutosaveProject({
  activeProjectId,
  hydratedProjectRef,
  project,
  saveProject,
  screen,
  selectedSceneId,
  setSaveStatus,
  tab,
  userId,
  writeBuilderUiState,
}) {
  const saveProjectRef = useRef(saveProject);
  const latestRequestRef = useRef(null);
  const isSavingRef = useRef(false);
  const isMountedRef = useRef(false);
  const sequenceRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    saveProjectRef.current = saveProject;
  }, [saveProject]);

  const runLatestSave = useCallback(async () => {
    if (isSavingRef.current) return;

    const request = latestRequestRef.current;
    latestRequestRef.current = null;
    if (!request) return;

    isSavingRef.current = true;
    try {
      await saveProjectRef.current(request.project, request.activeProjectId, {
        tab: request.tab,
        selectedSceneId: request.selectedSceneId,
        autosaveRevision: request.autosaveRevision,
      });
      if (
        isMountedRef.current
        && request.sequence === sequenceRef.current
        && !latestRequestRef.current
      ) {
        setSaveStatus('Sauvegardé localement');
      }
    } catch (error) {
      console.error('Erreur de sauvegarde du projet', error);
      if (
        isMountedRef.current
        && request.sequence === sequenceRef.current
        && !latestRequestRef.current
      ) {
        setSaveStatus('Erreur de sauvegarde');
      }
    } finally {
      isSavingRef.current = false;
      if (latestRequestRef.current) {
        runLatestSave();
      }
    }
  }, [setSaveStatus]);

  useEffect(() => {
    if (screen === 'editor' && userId && activeProjectId && isBuilderTab(tab)) {
      writeBuilderUiState(userId, activeProjectId, {
        screen: 'editor',
        tab,
        selectedSceneId,
      });
    }

    const saveTimer = window.setTimeout(() => {
      if (!userId) return;
      if (screen !== 'editor') return;
      if (!activeProjectId) return;
      if (hydratedProjectRef.current !== activeProjectId) return;

      sequenceRef.current += 1;
      latestRequestRef.current = {
        activeProjectId,
        autosaveRevision: (Date.now() * 1000) + sequenceRef.current,
        project,
        selectedSceneId,
        sequence: sequenceRef.current,
        tab,
      };
      runLatestSave();
    }, 900);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [
    activeProjectId,
    hydratedProjectRef,
    project,
    runLatestSave,
    screen,
    selectedSceneId,
    tab,
    userId,
    writeBuilderUiState,
  ]);
}
