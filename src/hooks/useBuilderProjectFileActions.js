import { useCallback } from 'react';
import { exportAuthorSummary } from '../utils/exportAuthorSummary';
import { exportProjectJson } from '../utils/exportProjectJson';
import {
  formatProjectImportError,
  importProjectFromJsonText,
} from '../utils/projectJsonImport';

export function useBuilderProjectFileActions({
  activeProjectId,
  editor,
  preview,
  saveProjectAndAcknowledge,
  setSaveStatus,
}) {
  const handleExportProjectJson = useCallback(() => exportProjectJson(editor.project), [editor.project]);
  const handleExportAuthorSummary = useCallback(() => exportAuthorSummary(editor.project), [editor.project]);
  const handleExportStandalone = useCallback(async (options = {}) => {
    const { exportStandalone } = await import('../utils/exportStandalone');
    return exportStandalone(editor.project, options);
  }, [editor.project]);

  const importProjectJson = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let parsed;
    try {
      const text = await file.text();
      parsed = importProjectFromJsonText(text).project;
    } catch (error) {
      setSaveStatus(formatProjectImportError(error));
      event.target.value = '';
      throw error;
    }
    editor.loadProject(parsed);
    preview.syncWithProject(parsed);
    if (activeProjectId) {
      try {
        await saveProjectAndAcknowledge(parsed, activeProjectId);
      } catch (error) {
        setSaveStatus('Erreur de sauvegarde');
        event.target.value = '';
        throw error;
      }
      setSaveStatus('Projet importé et sauvegardé');
    } else {
      setSaveStatus('Projet importé');
    }
    event.target.value = '';
  }, [activeProjectId, editor.loadProject, preview.syncWithProject, saveProjectAndAcknowledge, setSaveStatus]);

  return {
    handleExportAuthorSummary,
    handleExportProjectJson,
    handleExportStandalone,
    importProjectJson,
  };
}
