import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useAccessibleDialog } from '../components/AccessibleDialog';
import MediaSourceModal from '../components/MediaSourceModal.jsx';
import { createInitialProject } from '../data/projectData';
import { useAccountStorage } from '../hooks/useAccountStorage';
import { useAutosaveProject } from '../hooks/useAutosaveProject';
import { useProfileProjectActions } from '../hooks/useProfileProjectActions';
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
    const activeProject = {
      title: 'Actif',
      assets: [{ id: 'a', url: 'https://cdn.test/a.png', size: 5 * MB }],
    };
    const projects = [
      { id: 'active', data: { title: 'Ancienne version', assets: [{ id: 'old', url: 'old', size: 100 * MB }] } },
      { id: 'other', data: { title: 'Autre', assets: [{ id: 'b', url: 'https://cdn.test/b.png', size: 2 * MB }] } },
      { id: 'duplicate', data: { title: 'Doublon', assets: [{ id: 'a-copy', url: 'https://cdn.test/a.png', size: 5 * MB }] } },
    ];

    const { result } = renderHook(() => useAccountStorage({
      activeProject,
      activeProjectId: 'active',
      autoExact: true,
      projects,
    }));

    expect(result.current.estimatedStorageUsageBytes).toBe(7 * MB);
    expect(result.current.storageSummary).toMatchObject({
      isExact: false,
      quotaBytes: 250 * MB,
      usedBytes: 7 * MB,
      usedLabel: '7,0 Mo env.',
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
      await flushPromises();
    });
    expect(result.current.storageSummary.isExact).toBe(true);
    expect(result.current.storageSummary.usedBytes).toBe(7 * MB);

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
});
