import { useCallback } from 'react';
import { assertDurableProjectSave } from '../../../shared/utils/projectPersistenceStatus';

export function useProjectSaveAcknowledger({
  activeProjectId,
  markProjectSaveFailed,
  markProjectSaveStarted,
  markProjectSaved,
  saveProject,
}) {
  return useCallback(async (projectToSave, projectId = activeProjectId, uiState = {}, saveOptions = {}) => {
    const savedProjectId = projectId || activeProjectId;
    markProjectSaveStarted(projectToSave, savedProjectId);
    try {
      const result = await saveProject(projectToSave, projectId, uiState, saveOptions);
      if (result?.syncStatus) assertDurableProjectSave(result.syncStatus);
      markProjectSaved(projectToSave, savedProjectId, result?.syncStatus || {});
      return result;
    } catch (error) {
      markProjectSaveFailed(projectToSave, savedProjectId, uiState);
      throw error;
    }
  }, [
    activeProjectId,
    markProjectSaveFailed,
    markProjectSaveStarted,
    markProjectSaved,
    saveProject,
  ]);
}
