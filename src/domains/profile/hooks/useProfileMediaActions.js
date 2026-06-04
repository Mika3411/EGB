import { useCallback } from 'react';
import {
  formatMediaDeletionUsage,
  removeMediaAssetsFromProject,
} from '../../../shared/utils/mediaProjectHelpers';
import { formatStorageSize } from '../../../shared/services/storageQuota';
import { getSupabaseAuthHeaders } from '../../../shared/services/remoteSession';

const STORAGE_UPGRADE_ENDPOINT = import.meta.env.VITE_STORAGE_UPGRADE_ENDPOINT || '/api/storage-upgrade';

export function useProfileMediaActions({
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
}) {
  const deleteMediaFromProfile = useCallback(async (asset) => {
    if (!asset?.url) return;
    const urlsToDelete = [...new Set([asset.url, ...(asset.urls || [])].filter(Boolean))];
    const assetIdsToDelete = [...new Set([asset.assetId, ...(asset.assetIds || [])].filter(Boolean))];
    const usageLabel = formatMediaDeletionUsage(asset);
    if (asset.usages?.length) {
      const confirmed = await confirmDialog({
        title: 'Supprimer ce média',
        message: `Cet asset est utilisé dans ${usageLabel}.\n\n`
          + 'Le supprimer retirera ce média partout où il est référencé.\n'
          + 'Continuer ?',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!confirmed) {
        setSaveStatus('Suppression annulée : asset utilisé.');
        return;
      }
    } else {
      const confirmed = await confirmDialog({
        title: 'Supprimer ce média',
        message: 'Cet asset est inactif et conservé en mémoire. Le supprimer définitivement ?',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    const projectsForDeletion = [
      ...auth.projects,
      auth.projects.some((projectRecord) => projectRecord.id === auth.activeProjectId)
        ? null
        : {
          id: auth.activeProjectId,
          data: editor.project,
          uiState: {
            tab: editor.tab,
            selectedSceneId: editor.selectedSceneId,
          },
        },
    ].filter((projectRecord) => projectRecord?.data);

    const updatedProjects = projectsForDeletion.map((projectRecord) => {
      const sourceRecord = projectRecord.id === auth.activeProjectId
        ? { ...projectRecord, data: editor.project }
        : projectRecord;
      const serializedProject = JSON.stringify(sourceRecord.data || {});
      const isAffected = urlsToDelete.some((url) => serializedProject.includes(url))
        || assetIdsToDelete.some((assetId) => serializedProject.includes(assetId));
      if (!isAffected) return { ...sourceRecord, isAffected: false };
      return {
        ...sourceRecord,
        isAffected: true,
        data: removeMediaAssetsFromProject(sourceRecord.data, {
          urls: urlsToDelete,
          assetIds: assetIdsToDelete,
        }),
      };
    });

    const affectedProjects = updatedProjects.filter((projectRecord) => projectRecord.isAffected);
    const persistedProjects = updatedProjects
      .filter((projectRecord) => projectRecord.id)
      .map(({ isAffected, ...projectRecord }) => projectRecord);
    if (persistedProjects.length && auth.saveProjects) {
      await auth.saveProjects(persistedProjects, auth.activeProjectId);
    } else {
      for (const projectRecord of affectedProjects) {
        if (projectRecord.id) await saveProjectAndAcknowledge(projectRecord.data, projectRecord.id, projectRecord.uiState || {});
      }
    }

    const activeProject = updatedProjects.find((projectRecord) => projectRecord.id === auth.activeProjectId && projectRecord.isAffected);
    if (activeProject) {
      editor.loadProject(activeProject.data);
      preview.syncWithProject(activeProject.data);
    }
    invalidateStorageUsage();
    setSaveStatus(`Asset supprimé de ${affectedProjects.length} projet${affectedProjects.length > 1 ? 's' : ''}`);
  }, [
    auth.activeProjectId,
    auth.projects,
    auth.saveProjects,
    confirmDialog,
    editor.loadProject,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    invalidateStorageUsage,
    preview.syncWithProject,
    saveProjectAndAcknowledge,
  ]);

  const buyStorageFromProfile = useCallback(async ({ credits = 0, bytes = 0, label = '' } = {}) => {
    const storageCredits = Math.max(0, Math.round(Number(credits || 0)));
    if (!storageCredits) return;
    if (aiCreditBalance < storageCredits) {
      setSaveStatus(`Crédits insuffisants : ${aiCreditBalance}/${storageCredits}.`);
      return;
    }

    const storageBytes = Math.max(0, Math.round(Number(bytes || 0)));
    const storageLabel = label || formatStorageSize(storageBytes);
    const confirmed = await confirmDialog({
      title: 'Acheter du stockage',
      message: `Dépenser ${storageCredits} crédits pour augmenter le stockage à ${storageLabel} ?`,
      confirmLabel: 'Acheter',
    });
    if (!confirmed) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getSupabaseAuthHeaders()),
      };
      const response = await fetch(STORAGE_UPGRADE_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ credits: storageCredits, userId: auth.user?.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Achat stockage impossible.');

      setAiCreditBalance(Number(payload.balance ?? Math.max(0, aiCreditBalance - storageCredits)));
      updateStorageQuotaBytes(payload.storageQuotaBytes || storageBytes);
      setSaveStatus(`Stockage augmenté à ${storageLabel}.`);
    } catch (error) {
      setSaveStatus(error.message || 'Achat stockage impossible.');
      await alertDialog({
        title: 'Achat stockage impossible',
        message: error.message || 'Achat stockage impossible.',
      });
    }
  }, [
    aiCreditBalance,
    alertDialog,
    auth.user?.id,
    confirmDialog,
    updateStorageQuotaBytes,
  ]);


  return {
    buyStorageFromProfile,
    deleteMediaFromProfile,
  };
}
