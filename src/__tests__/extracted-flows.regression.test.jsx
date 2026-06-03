import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useAccessibleDialog } from '../components/AccessibleDialog';
import MediaSourceModal from '../components/MediaSourceModal.jsx';
import { createInitialProject } from '../data/projectData';
import { useAccountStorage } from '../hooks/useAccountStorage';
import { useBuilderProfileNavigation } from '../hooks/useBuilderProfileNavigation';
import { useBuilderProjectFileActions } from '../hooks/useBuilderProjectFileActions';
import { getProjectSaveStatus, useAutosaveProject } from '../hooks/useAutosaveProject';
import { useProfileProjectActions } from '../hooks/useProfileProjectActions';
import { useProjectSaveAcknowledger } from '../hooks/useProjectSaveAcknowledger';
import { MB } from '../lib/storageQuota';
import { fileToDataURL, uploadFileToSupabase } from '../utils/fileHelpers';
import { removeMediaAssetsFromProject } from '../utils/mediaProjectHelpers';
import { uploadToStorage } from '../supabaseStorage';

vi.mock('../supabaseStorage', () => ({
  buildStoragePath: (...segments) => segments
    .filter(Boolean)
    .map((segment) => String(segment).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset')
    .join('/'),
  generateStorageFilename: (filename) => `12345-${String(filename).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')}`,
  getPublicStorageUploadResult: (path) => ({
    path,
    publicUrl: `https://cdn.test/${path}`,
    visibility: 'public',
  }),
  isStorageObjectAlreadyExistsError: (error) => error?.code === 'already-exists',
  uploadToStorage: vi.fn(async (path, file, options) => ({
    path,
    publicUrl: `https://cdn.test/${path}`,
    receivedFile: file,
    receivedOptions: options,
  })),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
});

function AccessibleDialogHarness({ onResult }) {
  const { confirm, dialog } = useAccessibleDialog();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          onResult(await confirm({
            title: 'Supprimer le projet',
            message: 'Confirmer la suppression ?',
            confirmLabel: 'Supprimer',
            variant: 'danger',
          }));
        }}
      >
        Ouvrir
      </button>
      {dialog}
    </>
  );
}

function AccessibleDialogDismissHarness({ onResult }) {
  const { confirm, dialog } = useAccessibleDialog();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          onResult(await confirm({
            title: 'Exporter le jeu',
            message: 'Inclure les médias ?',
            confirmLabel: 'Inclure',
            cancelLabel: 'Exporter sans inclure',
            cancelValue: false,
            dismissLabel: 'Annuler',
            dismissValue: null,
          }));
        }}
      >
        Ouvrir export
      </button>
      {dialog}
    </>
  );
}

describe('media helpers', () => {
  test('supprime un asset référencé dans plusieurs projets sans toucher aux autres médias', () => {
    const deletedUrl = 'https://cdn.test/deleted.png';
    const deletedAudioUrl = 'https://cdn.test/deleted.mp3';
    const deletedAssetId = 'asset-deleted';
    const keptUrl = 'https://cdn.test/kept.png';
    const projects = [
      {
        title: 'Projet A',
        assets: [
          { id: deletedAssetId, url: deletedUrl, type: 'image', size: 100 },
          { id: 'asset-kept', url: keptUrl, type: 'image', size: 75 },
        ],
        scenes: [{
          id: 'scene-a',
          name: 'Scene A',
          backgroundId: deletedAssetId,
          backgroundData: deletedUrl,
          backgroundName: 'deleted.png',
          musicData: keptUrl,
          musicName: 'kept.png',
          hotspots: [{
            id: 'hotspot-a',
            objectImageId: deletedAssetId,
            objectImageData: deletedUrl,
            objectImageName: 'deleted.png',
          }],
        }],
        items: [{ id: 'item-a', imageData: keptUrl, imageName: 'kept.png' }],
      },
      {
        title: 'Projet B',
        assets: [{ id: 'asset-audio', url: deletedAudioUrl, type: 'audio', size: 55 }],
        items: [{
          id: 'item-b',
          imageId: deletedAssetId,
          imageData: deletedUrl,
          imageName: 'deleted.png',
        }],
        cinematics: [{
          id: 'cinematic-b',
          slides: [{
            id: 'slide-b',
            audioData: deletedAudioUrl,
            audioName: 'deleted.mp3',
          }],
        }],
      },
    ];

    const cleanedProjects = projects.map((project) => removeMediaAssetsFromProject(project, {
      urls: [deletedUrl, deletedAudioUrl],
      assetIds: [deletedAssetId],
    }));

    expect(cleanedProjects[0].scenes[0].backgroundData).toBe('');
    expect(cleanedProjects[0].scenes[0].backgroundId).toBe('');
    expect(cleanedProjects[0].scenes[0].hotspots[0].objectImageData).toBe('');
    expect(cleanedProjects[0].scenes[0].musicData).toBe(keptUrl);
    expect(cleanedProjects[0].assets.some((asset) => asset.id === deletedAssetId)).toBe(false);
    expect(cleanedProjects[1].items[0].imageData).toBe('');
    expect(cleanedProjects[1].items[0].imageId).toBe('');
    expect(cleanedProjects[1].cinematics[0].slides[0].audioData).toBe('');
    expect(cleanedProjects[1].assets.some((asset) => asset.url === deletedAudioUrl)).toBe(false);
  });

  test('couvre l’import local en data URL et l’upload Supabase mocké', async () => {
    const localFile = new File(['bonjour'], 'message.txt', { type: 'text/plain' });

    await expect(fileToDataURL(localFile)).resolves.toBe('data:text/plain;base64,Ym9uam91cg==');

    vi.spyOn(Date, 'now').mockReturnValue(12345);
    const remoteFile = new File(['remote-bytes'], 'Mon Image.png', { type: 'image/png' });
    const uploaded = await uploadFileToSupabase(remoteFile, {
      userId: 'User 42',
      folder: 'Profile Media',
      optimizeImage: false,
    });

    expect(uploadToStorage).toHaveBeenCalledTimes(1);
    expect(uploadToStorage.mock.calls[0][0]).toBe('users/user-42/profile-media/12345-mon-image.png');
    expect(uploadToStorage.mock.calls[0][2]).toMatchObject({
      cacheControl: '31536000',
      contentType: 'image/png',
    });
    expect(uploaded).toMatchObject({
      filename: '12345-mon-image.png',
      originalName: 'Mon Image.png',
      originalSize: remoteFile.size,
      optimized: false,
      publicUrl: 'https://cdn.test/users/user-42/profile-media/12345-mon-image.png',
    });
  });
});

describe('extracted hooks', () => {
  test('statuts de sauvegarde projet cohérents', () => {
    expect(getProjectSaveStatus({ remoteSaved: true })).toBe('Sauvegardé sur Supabase');
    expect(getProjectSaveStatus({ remoteAttempted: true, localSaved: true, remoteSaved: false })).toBe('Supabase non synchronisé');
    expect(getProjectSaveStatus({ localSaved: true, remoteAttempted: false, remoteSaved: false })).toBe('Sauvegardé localement');
    expect(getProjectSaveStatus({ localCacheSaved: true, localSaved: false, remoteAttempted: false })).toBe('Sauvegarde locale incomplète');
    expect(getProjectSaveStatus({ localSaved: false, remoteAttempted: false })).toBe('Erreur de sauvegarde');
  });

  test('sauvegarde manuelle ack les marqueurs autosave', async () => {
    const project = { title: 'Projet manuel' };
    const saveProject = vi.fn(async () => ({
      syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false },
    }));
    const markProjectSaveFailed = vi.fn();
    const markProjectSaveStarted = vi.fn();
    const markProjectSaved = vi.fn();

    const { result } = renderHook(() => useProjectSaveAcknowledger({
      activeProjectId: 'project-1',
      markProjectSaveFailed,
      markProjectSaveStarted,
      markProjectSaved,
      saveProject,
    }));

    await act(async () => {
      await result.current(project, undefined, { tab: 'scenes' }, { localOnly: true });
    });

    expect(markProjectSaveStarted).toHaveBeenCalledWith(project, 'project-1');
    expect(saveProject).toHaveBeenCalledWith(project, 'project-1', { tab: 'scenes' }, { localOnly: true });
    expect(markProjectSaved).toHaveBeenCalledWith(project, 'project-1', {
      localSaved: true,
      remoteAttempted: false,
      remoteSaved: false,
    });
    expect(markProjectSaveFailed).not.toHaveBeenCalled();
  });

  test('sauvegarde manuelle refuse un cache local incomplet comme succes durable', async () => {
    const project = { title: 'Projet quota' };
    const syncStatus = {
      localCacheSaved: true,
      localPartial: true,
      localSaved: false,
      remoteAttempted: false,
      remoteSaved: false,
    };
    const saveProject = vi.fn(async () => ({ syncStatus }));
    const markProjectSaveFailed = vi.fn();
    const markProjectSaveStarted = vi.fn();
    const markProjectSaved = vi.fn();

    const { result } = renderHook(() => useProjectSaveAcknowledger({
      activeProjectId: 'project-1',
      markProjectSaveFailed,
      markProjectSaveStarted,
      markProjectSaved,
      saveProject,
    }));

    await expect(act(async () => {
      await result.current(project, undefined, { tab: 'scenes' });
    })).rejects.toMatchObject({
      code: 'non-durable-project-save',
      syncStatus,
    });

    expect(markProjectSaveStarted).toHaveBeenCalledWith(project, 'project-1');
    expect(markProjectSaved).not.toHaveBeenCalled();
    expect(markProjectSaveFailed).toHaveBeenCalledWith(project, 'project-1', { tab: 'scenes' });
  });

  test('importe un JSON projet depuis les actions fichier du builder', async () => {
    const importedProject = {
      ...createInitialProject(),
      title: 'Projet JSON header',
      scenes: [{ id: 'scene-json', name: 'Scene JSON', hotspots: [] }],
      start: { type: 'scene', targetSceneId: 'scene-json', targetCinematicId: '' },
      enigmas: [],
      cinematics: [],
      combinations: [],
    };
    const editor = {
      loadProject: vi.fn(),
      project: createInitialProject(),
    };
    const preview = {
      syncWithProject: vi.fn(),
    };
    const saveProjectAndAcknowledge = vi.fn(async () => ({
      syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false },
    }));
    const setSaveStatus = vi.fn();
    const file = new File([JSON.stringify(importedProject)], 'projet.json', {
      type: 'application/json',
    });
    const event = {
      target: {
        files: [file],
        value: 'projet.json',
      },
    };

    const { result } = renderHook(() => useBuilderProjectFileActions({
      activeProjectId: 'project-1',
      editor,
      preview,
      saveProjectAndAcknowledge,
      setSaveStatus,
    }));

    await act(async () => {
      await result.current.importProjectJson(event);
    });

    expect(editor.loadProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet JSON header',
    }));
    expect(preview.syncWithProject).toHaveBeenCalledWith(expect.objectContaining({
      scenes: [expect.objectContaining({ id: 'scene-json' })],
    }));
    expect(saveProjectAndAcknowledge).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet JSON header',
    }), 'project-1');
    expect(setSaveStatus).toHaveBeenCalledWith('Projet importé et sauvegardé');
    expect(event.target.value).toBe('');
  });

  test('import JSON builder ne signale pas un succes quand la sauvegarde durable echoue', async () => {
    const importedProject = {
      ...createInitialProject(),
      title: 'Projet JSON quota',
      scenes: [{ id: 'scene-json', name: 'Scene JSON', hotspots: [] }],
      start: { type: 'scene', targetSceneId: 'scene-json', targetCinematicId: '' },
      enigmas: [],
      cinematics: [],
      combinations: [],
    };
    const editor = {
      loadProject: vi.fn(),
      project: createInitialProject(),
    };
    const preview = {
      syncWithProject: vi.fn(),
    };
    const saveError = Object.assign(new Error('Sauvegarde incomplete'), {
      code: 'non-durable-project-save',
    });
    const saveProjectAndAcknowledge = vi.fn(async () => {
      throw saveError;
    });
    const setSaveStatus = vi.fn();
    const file = new File([JSON.stringify(importedProject)], 'projet.json', {
      type: 'application/json',
    });
    const event = {
      target: {
        files: [file],
        value: 'projet.json',
      },
    };

    const { result } = renderHook(() => useBuilderProjectFileActions({
      activeProjectId: 'project-1',
      editor,
      preview,
      saveProjectAndAcknowledge,
      setSaveStatus,
    }));

    await expect(act(async () => {
      await result.current.importProjectJson(event);
    })).rejects.toThrow('Sauvegarde incomplete');

    expect(editor.loadProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet JSON quota',
    }));
    expect(preview.syncWithProject).toHaveBeenCalled();
    expect(setSaveStatus).toHaveBeenCalledWith('Erreur de sauvegarde');
    expect(setSaveStatus).not.toHaveBeenCalledWith('Projet importé et sauvegardé');
    expect(event.target.value).toBe('');
  });

  test('import JSON builder refuse un fichier corrompu sans charger le projet', async () => {
    const editor = {
      loadProject: vi.fn(),
      project: createInitialProject(),
    };
    const preview = {
      syncWithProject: vi.fn(),
    };
    const saveProjectAndAcknowledge = vi.fn();
    const setSaveStatus = vi.fn();
    const event = {
      target: {
        files: [new File(['{"title":"Cassé",'], 'broken.json', { type: 'application/json' })],
        value: 'broken.json',
      },
    };

    const { result } = renderHook(() => useBuilderProjectFileActions({
      activeProjectId: 'project-1',
      editor,
      preview,
      saveProjectAndAcknowledge,
      setSaveStatus,
    }));

    await expect(act(async () => {
      await result.current.importProjectJson(event);
    })).rejects.toMatchObject({
      code: 'PROJECT_IMPORT_INVALID_JSON',
    });

    expect(editor.loadProject).not.toHaveBeenCalled();
    expect(preview.syncWithProject).not.toHaveBeenCalled();
    expect(saveProjectAndAcknowledge).not.toHaveBeenCalled();
    expect(setSaveStatus).toHaveBeenCalledWith(expect.stringContaining('JSON illisible'));
    expect(event.target.value).toBe('');
  });

  test('retour profil bloque une sauvegarde de sortie non durable', async () => {
    const project = {
      title: 'Projet sortie quota',
      scenes: [{ id: 'scene-1', name: 'Scene 1', hotspots: [] }],
    };
    const syncStatus = {
      localCacheSaved: true,
      localPartial: true,
      localSaved: false,
      remoteAttempted: false,
      remoteSaved: false,
    };
    const saveProject = vi.fn(async () => ({ syncStatus }));
    const markProjectSaveFailed = vi.fn();
    const markProjectSaveStarted = vi.fn();
    const markProjectSaved = vi.fn();
    const setSaveStatus = vi.fn();
    const alertDialog = vi.fn(async () => true);
    const onExitToProfile = vi.fn();
    const setScreen = vi.fn();

    const { result: saveResult } = renderHook(() => useProjectSaveAcknowledger({
      activeProjectId: 'project-1',
      markProjectSaveFailed,
      markProjectSaveStarted,
      markProjectSaved,
      saveProject,
    }));
    const { result } = renderHook(() => useBuilderProfileNavigation({
      alertDialog,
      auth: {
        activeProjectId: 'project-1',
        user: { id: 'user-1' },
      },
      editor: {
        project,
        selectedSceneId: 'scene-1',
        tab: 'scenes',
      },
      hydratedProjectRef: { current: 'project-1' },
      onExitToProfile,
      saveProjectAndAcknowledge: saveResult.current,
      setSaveStatus,
      setScreen,
    }));

    await act(async () => {
      await result.current.openProfileFromBuilder();
    });

    expect(setSaveStatus).toHaveBeenCalledWith('Sauvegarde du projet...');
    expect(setSaveStatus).toHaveBeenCalledWith('Erreur de sauvegarde');
    expect(alertDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sauvegarde impossible',
      variant: 'danger',
    }));
    expect(markProjectSaved).not.toHaveBeenCalled();
    expect(markProjectSaveFailed).toHaveBeenCalledWith(project, 'project-1', {
      tab: 'scenes',
      selectedSceneId: 'scene-1',
    });
    expect(onExitToProfile).not.toHaveBeenCalled();
    expect(setScreen).not.toHaveBeenCalledWith('profile');
  });

  test('autosave peut etre desactive sans lancer de sauvegarde projet', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } }));
    const setSaveStatus = vi.fn();

    renderHook(() => useAutosaveProject({
      activeProjectId: 'project-1',
      enabled: false,
      hydratedProjectRef: { current: 'project-1' },
      project: { title: 'projet lourd' },
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'scenes',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    }));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await flushPromises();
    });

    expect(saveProject).not.toHaveBeenCalled();
    expect(setSaveStatus).not.toHaveBeenCalled();
  });

  test('autosave concurrent: seule la sauvegarde la plus récente marque le statut final', async () => {
    vi.useFakeTimers();
    const firstSave = deferred();
    const secondSave = deferred();
    const saveProject = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const setSaveStatus = vi.fn();
    const hydratedProjectRef = { current: 'project-1' };
    const baseProps = {
      activeProjectId: 'project-1',
      hydratedProjectRef,
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'scenes',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    };

    const { rerender } = renderHook((props) => useAutosaveProject(props), {
      initialProps: {
        ...baseProps,
        project: { title: 'ancien projet' },
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveProject).toHaveBeenCalledTimes(1);

    rerender({
      ...baseProps,
      project: { title: 'nouveau projet' },
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } });
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(2);
    expect(saveProject.mock.calls.map((call) => call[0].title)).toEqual(['ancien projet', 'nouveau projet']);
    expect(saveProject.mock.calls[1][2].autosaveRevision).toBeGreaterThan(saveProject.mock.calls[0][2].autosaveRevision);
    expect(setSaveStatus).not.toHaveBeenCalledWith('Sauvegardé localement');

    await act(async () => {
      secondSave.resolve({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } });
      await flushPromises();
    });
    expect(setSaveStatus).toHaveBeenCalledWith('Sauvegardé localement');
  });

  test('autosave groupe la synchronisation distante apres les brouillons locaux', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } }));
    const setSaveStatus = vi.fn();
    const hydratedProjectRef = { current: 'project-1' };
    const baseProps = {
      activeProjectId: 'project-1',
      hydratedProjectRef,
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'scenes',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    };

    const { rerender } = renderHook((props) => useAutosaveProject(props), {
      initialProps: {
        ...baseProps,
        project: { title: 'premier brouillon' },
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(900);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(saveProject.mock.calls[0][3]).toMatchObject({ localOnly: true });

    rerender({
      ...baseProps,
      project: { title: 'brouillon final' },
    });

    await act(async () => {
      vi.advanceTimersByTime(900);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(2);
    expect(saveProject.mock.calls[1][0].title).toBe('brouillon final');
    expect(saveProject.mock.calls[1][3]).toMatchObject({ localOnly: true });

    await act(async () => {
      vi.advanceTimersByTime(9099);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(3);
    expect(saveProject.mock.calls[2][0].title).toBe('brouillon final');
    expect(saveProject.mock.calls[2][3]).toMatchObject({ localOnly: false });
  });

  test('autosave signale un cache local incomplet sans afficher sauvegarde locale', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({
      syncStatus: {
        localCacheSaved: true,
        localPartial: true,
        localSaved: false,
        remoteAttempted: false,
        remoteSaved: false,
      },
    }));
    const setSaveStatus = vi.fn();

    renderHook(() => useAutosaveProject({
      activeProjectId: 'project-1',
      hydratedProjectRef: { current: 'project-1' },
      project: { title: 'projet lourd' },
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'scenes',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    }));

    await act(async () => {
      vi.advanceTimersByTime(900);
      await flushPromises();
    });

    expect(setSaveStatus).toHaveBeenCalledWith('Sauvegarde locale incomplète');
    expect(setSaveStatus).not.toHaveBeenCalledWith('Sauvegardé localement');
    expect(saveProject.mock.calls[0][3]).toMatchObject({
      allowPartial: true,
      localOnly: true,
    });
  });

  test('autosave retry quand aucune ecriture locale ou distante ne reussit', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({
      syncStatus: {
        localCacheSaved: false,
        localSaved: false,
        remoteAttempted: false,
        remoteSaved: false,
      },
    }));
    const setSaveStatus = vi.fn();

    renderHook(() => useAutosaveProject({
      activeProjectId: 'project-1',
      hydratedProjectRef: { current: 'project-1' },
      project: { title: 'projet impossible a sauver' },
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'scenes',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    }));

    await act(async () => {
      vi.advanceTimersByTime(900);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(setSaveStatus).toHaveBeenCalledWith('Erreur de sauvegarde');

    await act(async () => {
      vi.advanceTimersByTime(1_999);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushPromises();
    });
    expect(saveProject).toHaveBeenCalledTimes(2);
  });

  test('autosave ne rejoue pas une sauvegarde manuelle deja ack', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } }));
    const setSaveStatus = vi.fn();
    const projectInEditor = {
      title: 'Projet importe',
      scenes: [{ id: 'scene-1', name: 'Scene 1', hotspots: [] }],
    };
    const savedProjectClone = structuredClone(projectInEditor);

    const { result } = renderHook(() => useAutosaveProject({
      activeProjectId: 'project-1',
      hydratedProjectRef: { current: 'project-1' },
      project: projectInEditor,
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'ai',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    }));

    act(() => {
      result.current.markProjectSaveStarted(savedProjectClone, 'project-1');
      result.current.markProjectSaved(savedProjectClone, 'project-1', {
        localSaved: true,
        remoteAttempted: false,
        remoteSaved: false,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await flushPromises();
    });

    expect(saveProject).not.toHaveBeenCalled();
  });

  test('autosave rejoue une sauvegarde manuelle ack sans ecriture durable', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn(async () => ({ syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false } }));
    const setSaveStatus = vi.fn();
    const projectInEditor = {
      title: 'Projet importe',
      scenes: [{ id: 'scene-1', name: 'Scene 1', hotspots: [] }],
    };
    const savedProjectClone = structuredClone(projectInEditor);

    const { result } = renderHook(() => useAutosaveProject({
      activeProjectId: 'project-1',
      hydratedProjectRef: { current: 'project-1' },
      project: projectInEditor,
      saveProject,
      screen: 'editor',
      selectedSceneId: 'scene-1',
      setSaveStatus,
      tab: 'ai',
      userId: 'user-1',
      writeBuilderUiState: vi.fn(),
    }));

    act(() => {
      result.current.markProjectSaveStarted(savedProjectClone, 'project-1');
      result.current.markProjectSaved(savedProjectClone, 'project-1', {
        localCacheSaved: false,
        localSaved: false,
        remoteAttempted: false,
        remoteSaved: false,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(900);
      await flushPromises();
    });

    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  test('calcule quota, usage estimé/exact et storageSummary après debounce', async () => {
    vi.useFakeTimers();
    const signedAudioUrlA = 'https://project.supabase.co/storage/v1/object/sign/game-media/audio/0422.mp3?token=aaa&expires=111';
    const signedAudioUrlB = 'https://project.supabase.co/storage/v1/object/sign/game-media/audio/0422.mp3?token=bbb&expires=222';
    const activeProject = {
      title: 'Actif',
      assets: [
        { id: 'a', url: 'https://cdn.test/a.png', size: 5 * MB },
        { id: 'signed-a', url: signedAudioUrlA, size: 3 * MB },
      ],
    };
    const projects = [
      { id: 'active', data: { title: 'Ancienne version', assets: [{ id: 'old', url: 'old', size: 100 * MB }] } },
      {
        id: 'other',
        data: {
          title: 'Autre',
          assets: [
            { id: 'b', url: 'https://cdn.test/b.png', size: 2 * MB },
            { id: 'signed-b', url: signedAudioUrlB, size: 3 * MB },
          ],
        },
      },
      { id: 'duplicate', data: { title: 'Doublon', assets: [{ id: 'a-copy', url: 'https://cdn.test/a.png', size: 5 * MB }] } },
    ];

    const { result } = renderHook(() => useAccountStorage({
      activeProject,
      activeProjectId: 'active',
      autoExact: true,
      projects,
    }));

    expect(result.current.estimatedStorageUsageBytes).toBe(10 * MB);
    expect(result.current.storageSummary).toMatchObject({
      isExact: false,
      quotaBytes: 250 * MB,
      usedBytes: 10 * MB,
      usedLabel: '10 Mo env.',
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
      await flushPromises();
    });
    expect(result.current.storageSummary.isExact).toBe(true);
    expect(result.current.storageSummary.usedBytes).toBe(10 * MB);
    expect(result.current.exactStorageAssetSizesByUrl.get('https://cdn.test/a.png')).toBe(5 * MB);
    expect(result.current.exactStorageAssetSizesByUrl.get('https://cdn.test/b.png')).toBe(2 * MB);
    expect(result.current.exactStorageAssetSizesByUrl.get(signedAudioUrlA)).toBe(3 * MB);
    expect(result.current.exactStorageAssetSizesByUrl.has(signedAudioUrlB)).toBe(false);
    await expect(result.current.getCurrentStorageAssetSizesByUrl()).resolves.toEqual(new Map([
      ['https://cdn.test/a.png', 5 * MB],
      ['https://cdn.test/b.png', 2 * MB],
      [signedAudioUrlA, 3 * MB],
    ]));

    act(() => {
      result.current.updateStorageQuotaBytes(512 * MB);
    });
    expect(result.current.storageSummary.quotaBytes).toBe(512 * MB);
    expect(result.current.storageSummary.quotaLabel).toBe('512 Mo');
  });
});

describe('accessible UI hardening', () => {
  test('AccessibleDialog confirme au clavier et restaure le focus', async () => {
    const onResult = vi.fn();
    render(<AccessibleDialogHarness onResult={onResult} />);

    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Supprimer le projet' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await act(async () => {
      await flushPromises();
    });
    expect(onResult).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(opener);
  });

  test('AccessibleDialog distingue annulation et action secondaire', async () => {
    const onResult = vi.fn();
    render(<AccessibleDialogDismissHarness onResult={onResult} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter sans inclure' }));

    await act(async () => {
      await flushPromises();
    });
    expect(onResult).toHaveBeenCalledWith(false);

    onResult.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    await act(async () => {
      await flushPromises();
    });
    expect(onResult).toHaveBeenCalledWith(null);
  });

  test('MediaSourceModal expose un label accessible, ferme sur Escape et restaure le focus', async () => {
    function MediaModalHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Choisir</button>
          {open ? (
            <MediaSourceModal
              libraryItems={[{ id: 'asset-1', name: 'Image test', type: 'image', url: 'https://cdn.test/image.png' }]}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      );
    }

    render(<MediaModalHarness />);
    const opener = screen.getByRole('button', { name: 'Choisir' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Importer depuis' });
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Image test')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await act(async () => {
      await flushPromises();
    });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(document.activeElement).toBe(opener);
  });
});

describe('profile project actions', () => {
  test('importe un fichier projet, crée le record et ouvre le projet importé', async () => {
    const importedProject = {
      ...createInitialProject(),
      title: 'Projet importé',
      scenes: [{ id: 'scene-imported', name: 'Scene importée', hotspots: [] }],
      start: { type: 'scene', targetSceneId: 'scene-imported', targetCinematicId: '' },
      enigmas: [],
      cinematics: [],
      combinations: [],
    };
    const auth = {
      activeProjectId: 'existing-project',
      createProject: vi.fn(),
      deleteProject: vi.fn(),
      duplicateProject: vi.fn(),
      getProjectResumeState: vi.fn(() => ({ tab: 'media', selectedSceneId: 'scene-imported' })),
      importProject: vi.fn(async () => ({ id: 'imported-record' })),
      loadProject: vi.fn(async () => importedProject),
      markProjectLinkCopied: vi.fn(),
      projects: [{ id: 'imported-record', name: 'Projet importé', data: importedProject }],
      publishProject: vi.fn(),
      renameProject: vi.fn(),
      saveProject: vi.fn(),
      unpublishProject: vi.fn(),
      updateProjectMode: vi.fn(),
      updateProjectShareSettings: vi.fn(),
      user: { id: 'user-1' },
    };
    const editor = {
      loadProject: vi.fn(),
      patchProject: vi.fn(),
      project: createInitialProject(),
      selectedSceneId: 'scene-1',
      setSelectedSceneId: vi.fn(),
      setTab: vi.fn(),
      tab: 'scenes',
    };
    const preview = {
      syncWithProject: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const setScreen = vi.fn();
    const file = new File([JSON.stringify(importedProject)], 'Projet importé.json', {
      type: 'application/json',
    });

    const { result } = renderHook(() => useProfileProjectActions({
      auth,
      confirmDialog: vi.fn(async () => true),
      editor,
      hydratedProjectRef: { current: '' },
      preview,
      setSaveStatus,
      setScreen,
    }));

    await act(async () => {
      await result.current.importProjectFromProfile(file);
    });

    expect(auth.importProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet importé',
    }), 'Projet importé');
    expect(auth.loadProject).toHaveBeenCalledWith('imported-record');
    expect(editor.loadProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet importé',
    }));
    expect(editor.setTab).toHaveBeenCalledWith('media');
    expect(editor.setSelectedSceneId).toHaveBeenCalledWith('scene-imported');
    expect(preview.syncWithProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projet importé',
    }));
    expect(setScreen).toHaveBeenCalledWith('editor');
    expect(setSaveStatus).toHaveBeenLastCalledWith('Projet importé');
  });

  test('refuse depuis le profil un projet avec references cassees', async () => {
    const invalidProject = {
      ...createInitialProject(),
      title: 'Projet cassé',
      scenes: [{
        id: 'scene-imported',
        name: 'Scene importée',
        hotspots: [{
          id: 'hotspot-broken',
          name: 'Porte',
          x: 50,
          y: 50,
          width: 12,
          height: 12,
          actionType: 'scene',
          targetSceneId: 'scene-manquante',
        }],
      }],
      start: { type: 'scene', targetSceneId: 'scene-imported', targetCinematicId: '' },
      enigmas: [],
      cinematics: [],
      combinations: [],
    };
    const auth = {
      activeProjectId: 'existing-project',
      createProject: vi.fn(),
      deleteProject: vi.fn(),
      duplicateProject: vi.fn(),
      getProjectResumeState: vi.fn(() => ({})),
      importProject: vi.fn(),
      loadProject: vi.fn(),
      markProjectLinkCopied: vi.fn(),
      projects: [],
      publishProject: vi.fn(),
      renameProject: vi.fn(),
      saveProject: vi.fn(),
      unpublishProject: vi.fn(),
      updateProjectMode: vi.fn(),
      updateProjectShareSettings: vi.fn(),
      user: { id: 'user-1' },
    };
    const editor = {
      loadProject: vi.fn(),
      patchProject: vi.fn(),
      project: createInitialProject(),
      selectedSceneId: 'scene-1',
      setSelectedSceneId: vi.fn(),
      setTab: vi.fn(),
      tab: 'scenes',
    };
    const preview = {
      syncWithProject: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const setScreen = vi.fn();
    const file = new File([JSON.stringify(invalidProject)], 'Projet cassé.json', {
      type: 'application/json',
    });

    const { result } = renderHook(() => useProfileProjectActions({
      auth,
      confirmDialog: vi.fn(async () => true),
      editor,
      hydratedProjectRef: { current: '' },
      preview,
      setSaveStatus,
      setScreen,
    }));

    await expect(act(async () => {
      await result.current.importProjectFromProfile(file);
    })).rejects.toMatchObject({
      code: 'PROJECT_IMPORT_VALIDATION_FAILED',
    });

    expect(auth.importProject).not.toHaveBeenCalled();
    expect(auth.loadProject).not.toHaveBeenCalled();
    expect(editor.loadProject).not.toHaveBeenCalled();
    expect(preview.syncWithProject).not.toHaveBeenCalled();
    expect(setScreen).not.toHaveBeenCalledWith('editor');
    expect(setSaveStatus).toHaveBeenCalledWith(expect.stringContaining('scene-manquante'));
  });
});
