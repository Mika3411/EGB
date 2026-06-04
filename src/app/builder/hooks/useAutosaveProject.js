import { useCallback, useEffect, useRef } from 'react';
import { isBuilderTab } from '../../../shared/utils/tutorialHelpers';
import {
  getProjectSaveStatus,
  hasDurableProjectSave,
} from '../../../shared/utils/projectPersistenceStatus';

export {
  getProjectSaveStatus,
  hasDurableProjectSave,
} from '../../../shared/utils/projectPersistenceStatus';

const AUTOSAVE_BASE_DELAY_MS = 900;
const AUTOSAVE_REMOTE_IDLE_DELAY_MS = 10_000;
const AUTOSAVE_REMOTE_MAX_DELAY_MS = 30_000;
const AUTOSAVE_BACKOFF_BASE_MS = 2_000;
const AUTOSAVE_BACKOFF_MAX_MS = 60_000;
const LARGE_STRING_FINGERPRINT_LENGTH = 200_000;
const STRING_HASH_SAMPLE = 4096;
const LARGE_MEDIA_FIELD_PATTERN = /^(backgroundData|imageData|objectImageData|popupImageData|popupBackgroundData|musicData|soundData|videoData|videoPoster|audioData|responseImageData|responseSoundData|ambienceSoundData|setupMusicData|setupBackgroundImageData|characterImageData|backgroundImageData|src|originalSrc|url)$/i;

const registerAutosaveBackoff = (failedSaveCountRef, nextSaveAllowedAtRef) => {
  const failedSaveCount = Math.min(failedSaveCountRef.current + 1, 6);
  failedSaveCountRef.current = failedSaveCount;
  nextSaveAllowedAtRef.current = Date.now() + Math.min(
    AUTOSAVE_BACKOFF_MAX_MS,
    AUTOSAVE_BACKOFF_BASE_MS * (2 ** (failedSaveCount - 1)),
  );
};

const mixHash = (hash, value) => Math.imul(hash ^ value, 16777619) >>> 0;

const hashTextInto = (hash, text = '') => {
  const value = String(text || '');
  const length = value.length;
  hash = mixHash(hash, length);

  if (length <= STRING_HASH_SAMPLE * 3) {
    for (let index = 0; index < length; index += 1) {
      hash = mixHash(hash, value.charCodeAt(index));
    }
    return hash;
  }

  for (let index = 0; index < STRING_HASH_SAMPLE; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  const middleStart = Math.max(0, Math.floor((length - STRING_HASH_SAMPLE) / 2));
  for (let index = middleStart; index < middleStart + STRING_HASH_SAMPLE; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  for (let index = length - STRING_HASH_SAMPLE; index < length; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  return hash;
};

const getValueFingerprint = (value, key = '', seen = new WeakSet()) => {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'undefined') return 'undefined';
  if (type === 'number' || type === 'boolean' || type === 'bigint') return `${type}:${String(value)}`;
  if (type === 'string') {
    const isLargeMediaString = value.length > LARGE_STRING_FINGERPRINT_LENGTH
      || value.startsWith('data:')
      || LARGE_MEDIA_FIELD_PATTERN.test(key);
    if (!isLargeMediaString) return `s:${value.length}:${value}`;
    return `m:${key}:${value.length}:${hashTextInto(2166136261, value).toString(36)}`;
  }
  if (type !== 'object') return `${type}:${String(value)}`;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return `a:${value.length}:[${value.map((entry) => getValueFingerprint(entry, key, seen)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `o:{${keys.map((entryKey) => `${entryKey}:${getValueFingerprint(value[entryKey], entryKey, seen)}`).join(',')}}`;
};

const getProjectSaveFingerprint = (project) => {
  if (!project) return '';
  try {
    return getValueFingerprint(project);
  } catch {
    return '';
  }
};

export function useAutosaveProject({
  activeProjectId,
  enabled = true,
  hydratedProjectRef,
  project,
  saveProject,
  screen,
  selectedSceneId,
  setSaveStatus,
  skipInitialProjectSave = false,
  tab,
  userId,
  writeBuilderUiState,
}) {
  const saveProjectRef = useRef(saveProject);
  const latestRequestRef = useRef(null);
  const isSavingRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastSavedProjectIdRef = useRef('');
  const lastSavedProjectRef = useRef(null);
  const lastSavedProjectFingerprintRef = useRef('');
  const lastRemoteSavedProjectIdRef = useRef('');
  const lastRemoteSavedProjectRef = useRef(null);
  const lastRemoteSavedProjectFingerprintRef = useRef('');
  const manualSaveProjectIdRef = useRef('');
  const manualSaveProjectRef = useRef(null);
  const manualSaveProjectFingerprintRef = useRef('');
  const remoteDirtySinceRef = useRef(0);
  const sequenceRef = useRef(0);
  const failedSaveCountRef = useRef(0);
  const nextSaveAllowedAtRef = useRef(0);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    saveProjectRef.current = saveProject;
  }, [saveProject]);

  useEffect(() => {
    if (enabled) return;
    latestRequestRef.current = null;
    remoteDirtySinceRef.current = 0;
    failedSaveCountRef.current = 0;
    nextSaveAllowedAtRef.current = 0;
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [enabled]);

  const matchesProjectSnapshot = useCallback((savedProjectId, savedProjectRef, savedFingerprintRef, nextProjectId, nextProject) => {
    if (!nextProjectId || savedProjectId !== nextProjectId) return false;
    if (savedProjectRef === nextProject) return true;
    const savedFingerprint = savedFingerprintRef.current;
    if (!savedFingerprint) return false;
    return getProjectSaveFingerprint(nextProject) === savedFingerprint;
  }, []);

  const markProjectSnapshotSaved = useCallback((savedProject, savedProjectId, syncStatus = {}) => {
    if (!savedProjectId || !savedProject) return;
    if (!hasDurableProjectSave(syncStatus)) return;
    const fingerprint = getProjectSaveFingerprint(savedProject);
    lastSavedProjectIdRef.current = savedProjectId;
    lastSavedProjectRef.current = savedProject;
    lastSavedProjectFingerprintRef.current = fingerprint;

    const remoteSatisfied = syncStatus.remoteSaved || (syncStatus.localSaved && !syncStatus.remoteAttempted);
    if (remoteSatisfied) {
      lastRemoteSavedProjectIdRef.current = savedProjectId;
      lastRemoteSavedProjectRef.current = savedProject;
      lastRemoteSavedProjectFingerprintRef.current = fingerprint;
      remoteDirtySinceRef.current = 0;
    }

    const pendingRequest = latestRequestRef.current;
    if (
      pendingRequest
      && matchesProjectSnapshot(savedProjectId, savedProject, { current: fingerprint }, pendingRequest.activeProjectId, pendingRequest.project)
    ) {
      latestRequestRef.current = null;
    }
  }, [matchesProjectSnapshot]);

  const clearManualSaveSnapshot = useCallback((savedProjectId, savedProject) => {
    if (!savedProjectId) return;
    if (!matchesProjectSnapshot(
      manualSaveProjectIdRef.current,
      manualSaveProjectRef.current,
      manualSaveProjectFingerprintRef,
      savedProjectId,
      savedProject,
    )) return;
    manualSaveProjectIdRef.current = '';
    manualSaveProjectRef.current = null;
    manualSaveProjectFingerprintRef.current = '';
  }, [matchesProjectSnapshot]);

  const runLatestSave = useCallback(async () => {
    if (!enabled) {
      latestRequestRef.current = null;
      return;
    }
    if (isSavingRef.current) return;

    const request = latestRequestRef.current;
    latestRequestRef.current = null;
    if (!request) return;

    isSavingRef.current = true;
    try {
      const savedProject = await saveProjectRef.current(request.project, request.activeProjectId, {
        tab: request.tab,
        selectedSceneId: request.selectedSceneId,
        autosaveRevision: request.autosaveRevision,
      }, {
        allowPartial: true,
        localOnly: request.localOnly,
      });
      const syncStatus = savedProject?.syncStatus || {};
      const durableSaveSucceeded = hasDurableProjectSave(syncStatus);
      const remoteSyncFailed = Boolean(syncStatus.remoteAttempted && !syncStatus.remoteSaved);
      const shouldRetryRequest = !durableSaveSucceeded || (!request.localOnly && remoteSyncFailed);
      if (!durableSaveSucceeded || remoteSyncFailed) {
        registerAutosaveBackoff(failedSaveCountRef, nextSaveAllowedAtRef);
      } else if (!request.localOnly) {
        failedSaveCountRef.current = 0;
        nextSaveAllowedAtRef.current = 0;
      }
      if (durableSaveSucceeded) {
        lastSavedProjectIdRef.current = request.activeProjectId;
        lastSavedProjectRef.current = request.project;
        lastSavedProjectFingerprintRef.current = '';
        if (!request.localOnly && !remoteSyncFailed) {
          lastRemoteSavedProjectIdRef.current = request.activeProjectId;
          lastRemoteSavedProjectRef.current = request.project;
          lastRemoteSavedProjectFingerprintRef.current = '';
          remoteDirtySinceRef.current = 0;
        }
      }
      if (shouldRetryRequest && !latestRequestRef.current) {
        latestRequestRef.current = {
          ...request,
          retryAfterFailure: true,
        };
      }
      if (
        isMountedRef.current
        && request.sequence === sequenceRef.current
        && (!latestRequestRef.current || latestRequestRef.current.retryAfterFailure)
      ) {
        setSaveStatus(getProjectSaveStatus(syncStatus));
      }
    } catch (error) {
      console.error('Erreur de sauvegarde du projet', error);
      registerAutosaveBackoff(failedSaveCountRef, nextSaveAllowedAtRef);
      if (isMountedRef.current && !latestRequestRef.current) {
        latestRequestRef.current = {
          ...request,
          retryAfterFailure: true,
        };
      }
      if (
        isMountedRef.current
        && request.sequence === sequenceRef.current
        && (!latestRequestRef.current || latestRequestRef.current.retryAfterFailure)
      ) {
        setSaveStatus('Erreur de sauvegarde');
      }
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current && latestRequestRef.current) {
        const delayMs = latestRequestRef.current.localOnly && !latestRequestRef.current.retryAfterFailure
          ? 0
          : Math.max(0, nextSaveAllowedAtRef.current - Date.now());
        if (delayMs > 0) {
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            runLatestSave();
          }, delayMs);
        } else {
          runLatestSave();
        }
      }
    }
  }, [enabled, setSaveStatus]);

  const queueSaveRequest = useCallback((request) => {
    if (!enabled) return;
    const pendingRequest = latestRequestRef.current;
    latestRequestRef.current = pendingRequest && pendingRequest.activeProjectId === request.activeProjectId
      ? {
        ...request,
        localOnly: pendingRequest.localOnly && request.localOnly,
      }
      : request;
    runLatestSave();
  }, [enabled, runLatestSave]);

  const markProjectSaveStarted = useCallback((savedProject, savedProjectId = activeProjectId) => {
    if (!savedProjectId || !savedProject) return;
    manualSaveProjectIdRef.current = savedProjectId;
    manualSaveProjectRef.current = savedProject;
    manualSaveProjectFingerprintRef.current = getProjectSaveFingerprint(savedProject);
  }, [activeProjectId]);

  const markProjectSaved = useCallback((savedProject, savedProjectId = activeProjectId, syncStatus = {}) => {
    markProjectSnapshotSaved(savedProject, savedProjectId, syncStatus);
    clearManualSaveSnapshot(savedProjectId, savedProject);
  }, [activeProjectId, clearManualSaveSnapshot, markProjectSnapshotSaved]);

  const markProjectSaveFailed = useCallback((savedProject, savedProjectId = activeProjectId, uiState = {}) => {
    clearManualSaveSnapshot(savedProjectId, savedProject);
    if (!enabled) return;
    if (!userId) return;
    if (screen !== 'editor') return;
    if (!savedProjectId || hydratedProjectRef.current !== savedProjectId) return;
    sequenceRef.current += 1;
    queueSaveRequest({
      activeProjectId: savedProjectId,
      autosaveRevision: (Date.now() * 1000) + sequenceRef.current,
      localOnly: true,
      project: savedProject,
      selectedSceneId: uiState.selectedSceneId || selectedSceneId,
      sequence: sequenceRef.current,
      tab: uiState.tab || tab,
    });
  }, [
    activeProjectId,
    clearManualSaveSnapshot,
    enabled,
    hydratedProjectRef,
    queueSaveRequest,
    screen,
    selectedSceneId,
    tab,
    userId,
  ]);

  useEffect(() => {
    if (screen === 'editor' && userId && activeProjectId && isBuilderTab(tab)) {
      writeBuilderUiState(userId, activeProjectId, {
        screen: 'editor',
        tab,
        selectedSceneId,
      });
    }
  }, [activeProjectId, screen, selectedSceneId, tab, userId, writeBuilderUiState]);

  useEffect(() => {
    if (!enabled) return undefined;
    const saveDelayMs = AUTOSAVE_BASE_DELAY_MS;
    const saveTimer = window.setTimeout(() => {
      if (!userId) return;
      if (screen !== 'editor') return;
      if (!activeProjectId) return;
      if (hydratedProjectRef.current !== activeProjectId) return;
      if (matchesProjectSnapshot(
        manualSaveProjectIdRef.current,
        manualSaveProjectRef.current,
        manualSaveProjectFingerprintRef,
        activeProjectId,
        project,
      )) return;
      if (matchesProjectSnapshot(
        lastSavedProjectIdRef.current,
        lastSavedProjectRef.current,
        lastSavedProjectFingerprintRef,
        activeProjectId,
        project,
      )) return;

      sequenceRef.current += 1;
      queueSaveRequest({
        activeProjectId,
        autosaveRevision: (Date.now() * 1000) + sequenceRef.current,
        localOnly: true,
        project,
        selectedSceneId,
        sequence: sequenceRef.current,
        tab,
      });
    }, saveDelayMs);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [
    activeProjectId,
    enabled,
    hydratedProjectRef,
    matchesProjectSnapshot,
    project,
    queueSaveRequest,
    screen,
    selectedSceneId,
    tab,
    userId,
  ]);

  useEffect(() => {
    if (lastSavedProjectIdRef.current !== activeProjectId) {
      const isHydratedProject = skipInitialProjectSave && hydratedProjectRef.current === activeProjectId;
      lastSavedProjectIdRef.current = activeProjectId || '';
      lastSavedProjectRef.current = isHydratedProject ? project : null;
      lastSavedProjectFingerprintRef.current = '';
      lastRemoteSavedProjectIdRef.current = activeProjectId || '';
      lastRemoteSavedProjectRef.current = isHydratedProject ? project : null;
      lastRemoteSavedProjectFingerprintRef.current = '';
      manualSaveProjectIdRef.current = '';
      manualSaveProjectRef.current = null;
      manualSaveProjectFingerprintRef.current = '';
      remoteDirtySinceRef.current = 0;
    }
  }, [activeProjectId, hydratedProjectRef, project, skipInitialProjectSave]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!userId) return undefined;
    if (screen !== 'editor') return undefined;
    if (!activeProjectId) return undefined;
    if (hydratedProjectRef.current !== activeProjectId) return undefined;
    if (matchesProjectSnapshot(
      manualSaveProjectIdRef.current,
      manualSaveProjectRef.current,
      manualSaveProjectFingerprintRef,
      activeProjectId,
      project,
    )) return undefined;
    if (matchesProjectSnapshot(
      lastRemoteSavedProjectIdRef.current,
      lastRemoteSavedProjectRef.current,
      lastRemoteSavedProjectFingerprintRef,
      activeProjectId,
      project,
    )) {
      remoteDirtySinceRef.current = 0;
      return undefined;
    }

    const now = Date.now();
    if (!remoteDirtySinceRef.current) remoteDirtySinceRef.current = now;
    const elapsedMs = now - remoteDirtySinceRef.current;
    const remoteIdleDelayMs = Math.max(
      0,
      Math.min(AUTOSAVE_REMOTE_IDLE_DELAY_MS, AUTOSAVE_REMOTE_MAX_DELAY_MS - elapsedMs),
    );
    const remoteDelayMs = Math.max(remoteIdleDelayMs, nextSaveAllowedAtRef.current - now);
    const remoteTimer = window.setTimeout(() => {
      if (!userId) return;
      if (screen !== 'editor') return;
      if (!activeProjectId) return;
      if (hydratedProjectRef.current !== activeProjectId) return;
      if (matchesProjectSnapshot(
        manualSaveProjectIdRef.current,
        manualSaveProjectRef.current,
        manualSaveProjectFingerprintRef,
        activeProjectId,
        project,
      )) return;
      if (matchesProjectSnapshot(
        lastRemoteSavedProjectIdRef.current,
        lastRemoteSavedProjectRef.current,
        lastRemoteSavedProjectFingerprintRef,
        activeProjectId,
        project,
      )) return;

      sequenceRef.current += 1;
      queueSaveRequest({
        activeProjectId,
        autosaveRevision: (Date.now() * 1000) + sequenceRef.current,
        localOnly: false,
        project,
        selectedSceneId,
        sequence: sequenceRef.current,
        tab,
      });
    }, remoteDelayMs);

    return () => {
      window.clearTimeout(remoteTimer);
    };
  }, [
    activeProjectId,
    enabled,
    hydratedProjectRef,
    matchesProjectSnapshot,
    project,
    queueSaveRequest,
    screen,
    selectedSceneId,
    tab,
    userId,
  ]);

  return {
    markProjectSaveFailed,
    markProjectSaveStarted,
    markProjectSaved,
  };
}
