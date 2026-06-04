export const hasDurableProjectSave = (syncStatus = {}) => Boolean(
  syncStatus.localSaved || syncStatus.remoteSaved,
);

export const getProjectSaveStatus = (syncStatus = {}) => (
  syncStatus.remoteSaved
    ? 'Sauvegardé sur Supabase'
    : syncStatus.remoteAttempted
      ? syncStatus.localSaved
        ? 'Supabase non synchronisé'
        : syncStatus.localCacheSaved
          ? 'Sauvegarde locale incomplète'
          : 'Erreur de sauvegarde'
      : syncStatus.localSaved
        ? 'Sauvegardé localement'
        : syncStatus.localCacheSaved
          ? 'Sauvegarde locale incomplète'
          : 'Erreur de sauvegarde'
);

export const createNonDurableProjectSaveError = (syncStatus = {}) => {
  const error = new Error('Aucune sauvegarde durable du projet n’a abouti.');
  error.name = 'ProjectSaveError';
  error.code = 'non-durable-project-save';
  error.syncStatus = syncStatus;
  error.statusMessage = getProjectSaveStatus(syncStatus);
  return error;
};

export const assertDurableProjectSave = (syncStatus = {}) => {
  if (hasDurableProjectSave(syncStatus)) return;
  throw createNonDurableProjectSaveError(syncStatus);
};
