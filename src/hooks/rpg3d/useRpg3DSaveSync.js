import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createArcadeAssetsPayload,
  rememberArcadeAssetsLocally,
  restoreLocalArcadeAssetsSources,
  syncConfigModelReferences,
} from '../../utils/rpg3dAssetsCore.js';
import {
  createConfigFromSavedAssets,
  createStudioProjectFromSavedAssets,
  getActiveRpg3DCanvas,
  syncStudioProjectActiveCanvasConfig,
} from '../../utils/rpg3dStudioProject.js';

const RPG3D_LOGIN_REQUIRED_STATUS = 'Connecte-toi pour sauvegarder dans Supabase.';
const RPG3D_LOCAL_SESSION_FALLBACK_STATUS = 'Sauvegarde locale terminee. Connecte-toi pour synchroniser Supabase.';

let rpg3DAssetsStorageModulePromise = null;

const loadRpg3DAssetsStorage = () => {
  if (!rpg3DAssetsStorageModulePromise) {
    rpg3DAssetsStorageModulePromise = import('../../utils/rpg3dAssetsStorage.js');
  }
  return rpg3DAssetsStorageModulePromise;
};

const hasRpg3DAssetsSupabaseConfig = () => {
  const env = import.meta.env || {};
  const storageBucket = env.VITE_SUPABASE_STORAGE_BUCKET || '';
  return Boolean(
    env.VITE_SUPABASE_URL
    && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)
    && (env.VITE_SUPABASE_PUBLIC_ASSETS_BUCKET || storageBucket)
    && (env.VITE_SUPABASE_PRIVATE_DATA_BUCKET || storageBucket),
  );
};

const isDisconnectedSaveStatus = (status = '') => (
  status === RPG3D_LOGIN_REQUIRED_STATUS
  || status === RPG3D_LOCAL_SESSION_FALLBACK_STATUS
);

export function useRpg3DSaveSync({
  authReady = true,
  autosaveVersionRef,
  clearHistoryStacks,
  configRef,
  lastSavedAutosaveVersionRef,
  project = null,
  resetGame,
  savedArcadeAssets = null,
  setConfig,
  setStudioProject,
  studioProject,
  studioProjectRef,
  syncActiveCanvasConfigInRef,
  user = null,
  workspaceTab = 'arcade',
} = {}) {
  const isSavingAssetsRef = useRef(false);
  const projectRef = useRef(project);
  const remoteAssetsLoadKeyRef = useRef('');
  const [managementSaveStatus, setManagementSaveStatus] = useState(
    savedArcadeAssets ? 'Sauvegarde locale chargee.' : '',
  );
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  useEffect(() => {
    isSavingAssetsRef.current = isSavingAssets;
  }, [isSavingAssets]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    restoreLocalArcadeAssetsSources({
      config: configRef.current,
      studioProject: studioProjectRef.current,
    }).then((restored) => {
      if (cancelled || !restored?.changed) return;
      const nextConfig = createConfigFromSavedAssets(restored.config);
      const nextStudioProject = syncStudioProjectActiveCanvasConfig(restored.studioProject, nextConfig);
      configRef.current = nextConfig;
      studioProjectRef.current = nextStudioProject;
      setConfig(nextConfig);
      setStudioProject(nextStudioProject);
      resetGame(nextConfig);
      setManagementSaveStatus((current) => current || 'Modeles 3D locaux restaures.');
    }).catch(() => {
      // Local model recovery is best-effort; missing files fall back to normal asset sync.
    });
    return () => {
      cancelled = true;
    };
  }, [configRef, resetGame, setConfig, setStudioProject, studioProjectRef]);

  useEffect(() => {
    if (!authReady || !user?.id || !hasRpg3DAssetsSupabaseConfig()) return undefined;
    const loadKey = user.id;
    if (remoteAssetsLoadKeyRef.current === loadKey) return undefined;
    remoteAssetsLoadKeyRef.current = loadKey;
    let cancelled = false;
    setManagementSaveStatus((current) => (
      !current || isDisconnectedSaveStatus(current) ? 'Chargement Supabase...' : current
    ));
    loadRpg3DAssetsStorage()
      .then(({ loadArcadeAssetsFromSupabase }) => loadArcadeAssetsFromSupabase(user.id))
      .then(async (remoteAssets) => {
        if (cancelled || !remoteAssets) return;
        const remoteStudioProject = createStudioProjectFromSavedAssets(remoteAssets.studioProject, remoteAssets.config, projectRef.current);
        const remoteConfig = createConfigFromSavedAssets(getActiveRpg3DCanvas(remoteStudioProject)?.config || remoteAssets.config);
        const restored = await restoreLocalArcadeAssetsSources({
          config: remoteConfig,
          studioProject: remoteStudioProject,
        });
        if (cancelled) return;
        const nextConfig = createConfigFromSavedAssets(restored.config);
        const nextStudioProject = syncStudioProjectActiveCanvasConfig(restored.studioProject, nextConfig);
        configRef.current = nextConfig;
        studioProjectRef.current = nextStudioProject;
        setConfig(nextConfig);
        setStudioProject(nextStudioProject);
        clearHistoryStacks();
        resetGame(nextConfig);
        rememberArcadeAssetsLocally({
          ...remoteAssets,
          config: nextConfig,
          studioProject: nextStudioProject,
        });
        setManagementSaveStatus(restored.changed
          ? 'Sauvegarde Supabase chargee, modeles locaux restaures.'
          : 'Sauvegarde Supabase chargee.');
      })
      .catch(async (error) => {
        if (cancelled) return;
        const storageModule = await rpg3DAssetsStorageModulePromise?.catch(() => null);
        if (storageModule?.isRpg3DAssetsNotFoundError?.(error)) {
          setManagementSaveStatus((current) => current === 'Chargement Supabase...' ? '' : current);
          return;
        }
        setManagementSaveStatus('Chargement Supabase impossible.');
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, clearHistoryStacks, configRef, resetGame, setConfig, setStudioProject, studioProjectRef, user?.id]);

  useEffect(() => {
    setConfig((current) => {
      const synced = syncConfigModelReferences(current, studioProject, { preferLocalBlob: true });
      if (!synced.changed) return current;
      configRef.current = synced.config;
      syncActiveCanvasConfigInRef(synced.config);
      return synced.config;
    });
  }, [configRef, setConfig, studioProject, syncActiveCanvasConfigInRef]);

  const saveArcadeAssets = useCallback(async (options = {}) => {
    const localOnly = Boolean(options.localOnly);
    const supabaseConfigured = hasRpg3DAssetsSupabaseConfig();
    const saveLocallyBecauseSessionMissing = !localOnly && supabaseConfigured && authReady && !user?.id;
    const effectiveLocalOnly = localOnly || saveLocallyBecauseSessionMissing;
    const savingVersion = autosaveVersionRef.current;
    if (isSavingAssetsRef.current) return;
    if (!effectiveLocalOnly && supabaseConfigured) {
      if (!authReady) {
        setManagementSaveStatus('Compte en cours de chargement...');
        return;
      }
      if (!user?.id) {
        setManagementSaveStatus(RPG3D_LOGIN_REQUIRED_STATUS);
        return;
      }
    }

    isSavingAssetsRef.current = true;
    setIsSavingAssets(true);
    setManagementSaveStatus(
      effectiveLocalOnly ? 'Sauvegarde locale...' : (supabaseConfigured ? 'Sauvegarde Supabase...' : 'Sauvegarde locale...'),
    );
    try {
      const currentConfig = configRef.current;
      const currentStudioProject = syncActiveCanvasConfigInRef(currentConfig, { updateState: workspaceTab === 'canvases' });
      if (effectiveLocalOnly) {
        const localSync = syncConfigModelReferences(currentConfig, currentStudioProject, { preferLocalBlob: true });
        const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
        if (!rememberArcadeAssetsLocally(localPayload)) {
          setManagementSaveStatus('Sauvegarde impossible: stockage local plein.');
          return;
        }
        if (localSync.changed) {
          configRef.current = localSync.config;
          syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
          setConfig(localSync.config);
          resetGame(localSync.config);
        }
        lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
        setManagementSaveStatus(saveLocallyBecauseSessionMissing
          ? RPG3D_LOCAL_SESSION_FALLBACK_STATUS
          : 'Sauvegarde locale terminee.');
        return;
      }

      if (supabaseConfigured && user?.id) {
        const {
          createSupabaseArcadeAssetsPayload,
          uploadArcadeAssetsManifest,
        } = await loadRpg3DAssetsStorage();
        const remotePayload = await createSupabaseArcadeAssetsPayload(currentConfig, currentStudioProject, user.id);
        await uploadArcadeAssetsManifest(remotePayload, user.id);
        rememberArcadeAssetsLocally(remotePayload);
        const nextStudioProject = createStudioProjectFromSavedAssets(remotePayload.studioProject, remotePayload.config, project);
        const nextConfig = createConfigFromSavedAssets(getActiveRpg3DCanvas(nextStudioProject)?.config || remotePayload.config);
        lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
        if (autosaveVersionRef.current === savingVersion) {
          configRef.current = nextConfig;
          studioProjectRef.current = syncStudioProjectActiveCanvasConfig(nextStudioProject, nextConfig);
          setConfig(nextConfig);
          setStudioProject(studioProjectRef.current);
          resetGame(nextConfig);
        }
        setManagementSaveStatus('Sauvegarde Supabase terminee.');
        return;
      }

      const localSync = syncConfigModelReferences(currentConfig, currentStudioProject);
      const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
      if (!rememberArcadeAssetsLocally(localPayload)) {
        setManagementSaveStatus('Sauvegarde impossible: stockage local plein.');
        return;
      }
      if (localSync.changed) {
        configRef.current = localSync.config;
        syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
        setConfig(localSync.config);
      }
      lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
      setManagementSaveStatus('Sauvegarde locale terminee.');
    } catch (error) {
      if (!effectiveLocalOnly && supabaseConfigured) {
        try {
          const currentConfig = configRef.current;
          const currentStudioProject = syncActiveCanvasConfigInRef(currentConfig, { updateState: workspaceTab === 'canvases' });
          const localSync = syncConfigModelReferences(currentConfig, currentStudioProject, { preferLocalBlob: true });
          const localPayload = createArcadeAssetsPayload(localSync.config, currentStudioProject);
          if (rememberArcadeAssetsLocally(localPayload)) {
            if (localSync.changed) {
              configRef.current = localSync.config;
              syncActiveCanvasConfigInRef(localSync.config, { updateState: workspaceTab === 'canvases' });
              setConfig(localSync.config);
              resetGame(localSync.config);
            }
            lastSavedAutosaveVersionRef.current = Math.max(lastSavedAutosaveVersionRef.current, savingVersion);
            setManagementSaveStatus(`Sauvegarde locale terminee. Supabase inaccessible: ${error?.message || 'upload impossible'}`);
            return;
          }
        } catch {
          // Keep the original Supabase error below if the local fallback also fails.
        }
      }
      const errorPrefix = effectiveLocalOnly
        ? 'Mode local impossible'
        : supabaseConfigured
          ? 'Sauvegarde Supabase impossible'
          : 'Sauvegarde locale impossible';
      setManagementSaveStatus(error?.message ? `${errorPrefix}: ${error.message}` : `${errorPrefix}.`);
    } finally {
      isSavingAssetsRef.current = false;
      setIsSavingAssets(false);
    }
  }, [
    authReady,
    autosaveVersionRef,
    configRef,
    lastSavedAutosaveVersionRef,
    project,
    resetGame,
    setConfig,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    user?.id,
    workspaceTab,
  ]);

  return {
    isSavingAssets,
    managementSaveStatus,
    saveArcadeAssets,
    setManagementSaveStatus,
  };
}

export default useRpg3DSaveSync;
