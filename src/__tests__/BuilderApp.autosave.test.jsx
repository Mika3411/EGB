import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createInitialProject } from '../data/projectData';
import BuilderApp from '../BuilderApp.jsx';

const autosaveHookMock = vi.hoisted(() => vi.fn(() => ({
  markProjectSaveFailed: vi.fn(),
  markProjectSaveStarted: vi.fn(),
  markProjectSaved: vi.fn(),
})));

vi.mock('../hooks/useAutosaveProject', async () => {
  const actual = await vi.importActual('../hooks/useAutosaveProject');
  return {
    ...actual,
    useAutosaveProject: autosaveHookMock,
  };
});

vi.mock('../components/Tabs.jsx', async () => {
  const ReactModule = await import('react');
  return {
    default: ({ onProfile }) => ReactModule.createElement(
      'nav',
      { 'aria-label': 'Navigation builder classique' },
      ReactModule.createElement('button', { type: 'button', onClick: onProfile }, 'Profil'),
    ),
  };
});

vi.mock('../components/TabRegistry.jsx', async () => {
  const ReactModule = await import('react');
  const ClassicTab = ({ project }) => ReactModule.createElement(
    'section',
    { 'data-testid': 'classic-builder-tab' },
    project?.title || 'Builder classique',
  );
  return {
    TABS: {
      scenes: { component: ClassicTab, label: 'Scènes' },
      preview: { component: ClassicTab, label: 'Preview' },
    },
    getTabKey: (value) => value || 'scenes',
    getTabValue: (value) => value,
  };
});

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

const makeProject = (title = 'Projet classique') => ({
  ...createInitialProject(),
  title,
});

const makeAuth = (overrides = {}) => {
  const project = overrides.project || makeProject();
  const projectId = overrides.activeProjectId || 'project-classic';
  return {
    activeProjectId: projectId,
    authorProfile: null,
    authError: '',
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    duplicateProject: vi.fn(),
    getProjectResumeState: vi.fn(() => ({
      selectedSceneId: project.scenes?.[0]?.id || '',
      tab: 'scenes',
    })),
    importProject: vi.fn(),
    isBusy: false,
    isPasswordRecovery: false,
    isReady: true,
    loadProject: vi.fn(async () => project),
    login: vi.fn(),
    logout: vi.fn(),
    markProjectLinkCopied: vi.fn(),
    projects: [{
      id: projectId,
      name: project.title,
      data: project,
      uiState: {
        selectedSceneId: project.scenes?.[0]?.id || '',
        tab: 'scenes',
      },
    }],
    publishProject: vi.fn(),
    register: vi.fn(),
    renameProject: vi.fn(),
    requestPasswordReset: vi.fn(),
    saveProject: vi.fn(async () => ({
      syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false },
    })),
    saveProjects: vi.fn(),
    unpublishProject: vi.fn(),
    updateAuthorProfile: vi.fn(),
    updatePassword: vi.fn(),
    updateProjectMode: vi.fn(),
    updateProjectShareSettings: vi.fn(),
    user: { id: 'user-classic', email: 'classic@example.com' },
    ...overrides,
  };
};

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
});

describe('BuilderApp autosave classique', () => {
  test('active le hook autosave du builder classique', async () => {
    render(<BuilderApp auth={makeAuth()} initialScreen="editor" />);

    await waitFor(() => {
      expect(autosaveHookMock).toHaveBeenCalled();
    });
    expect(autosaveHookMock.mock.calls.at(-1)?.[0]).toMatchObject({
      activeProjectId: 'project-classic',
      enabled: true,
      screen: 'editor',
      tab: 'scenes',
      userId: 'user-classic',
    });
    expect(screen.getByText('Sauvegarde active')).toBeTruthy();
  });

  test('sauvegarde le projet actif avant de quitter vers le profil', async () => {
    const loadedProject = makeProject('Projet chargé avant profil');
    const save = deferred();
    const auth = makeAuth({
      project: loadedProject,
      saveProject: vi.fn(() => save.promise),
    });
    const onExitToProfile = vi.fn();

    render(
      <BuilderApp
        auth={auth}
        initialProjectId="project-classic"
        initialScreen="editor"
        onExitToProfile={onExitToProfile}
      />,
    );

    await waitFor(() => {
      expect(auth.loadProject).toHaveBeenCalledWith('project-classic');
      expect(screen.getByText('Projet chargé')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Profil' }));

    await waitFor(() => {
      expect(auth.saveProject).toHaveBeenCalledTimes(1);
    });
    expect(auth.saveProject.mock.calls[0][0].title).toBe('Projet chargé avant profil');
    expect(auth.saveProject.mock.calls[0][1]).toBe('project-classic');
    expect(auth.saveProject.mock.calls[0][2]).toMatchObject({
      selectedSceneId: loadedProject.scenes[0].id,
      tab: 'scenes',
    });
    expect(onExitToProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Sauvegarde du projet...')).toBeTruthy();

    save.resolve({
      syncStatus: { localSaved: true, remoteAttempted: false, remoteSaved: false },
    });
    await flushPromises();

    await waitFor(() => {
      expect(onExitToProfile).toHaveBeenCalledWith({ statusMessage: 'Sauvegardé localement' });
    });
  });
});
