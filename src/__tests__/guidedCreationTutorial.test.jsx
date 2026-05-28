import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BUILDER_TUTORIAL_STEPS } from '../data/tutorialStepData';
import {
  isTutorialStepComplete,
  prepareProjectForGuidedCreation,
} from '../data/tutorialSteps';
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

vi.mock('../components/BuilderTutorial.jsx', async () => {
  const ReactModule = await import('react');
  const { useEffect: useReactEffect } = ReactModule;
  return {
    default: ({ step, onNext }) => {
      useReactEffect(() => {
        document.body.classList.add('tutorial-active');
        return () => document.body.classList.remove('tutorial-active');
      }, [step]);

      return ReactModule.createElement(
        'aside',
        {
          'data-testid': 'tutorial-step',
          'data-selector': step.selector,
        },
        ReactModule.createElement('strong', null, step.title),
        ReactModule.createElement('button', { type: 'button', onClick: onNext }, 'Etape suivante'),
      );
    },
  };
});

vi.mock('../components/Tabs.jsx', async () => {
  const ReactModule = await import('react');
  const tabs = [
    ['scenes', 'Scenes'],
    ['media', 'Media'],
    ['preview', 'Preview'],
  ];
  return {
    default: ({ value, onChange, onProfile }) => ReactModule.createElement(
      'nav',
      { className: 'tabs', 'aria-label': 'Navigation builder classique' },
      ...tabs.map(([tabValue, label]) => ReactModule.createElement(
        'button',
        {
          key: tabValue,
          type: 'button',
          'data-testid': `tab-${tabValue}`,
          'data-tour-tab': tabValue,
          'aria-pressed': value === tabValue,
          onClick: () => onChange(tabValue),
        },
        label,
      )),
      ReactModule.createElement('button', { type: 'button', onClick: onProfile }, 'Profil'),
    ),
  };
});

vi.mock('../components/TabRegistry.jsx', async () => {
  const ReactModule = await import('react');

  const getFirstScene = (project) => project?.scenes?.[0] || null;
  const getSelectedScene = (project, selectedSceneId) => (
    project?.scenes?.find((scene) => scene.id === selectedSceneId) || getFirstScene(project)
  );
  const getGuidedHotspotScene = (project) => (
    project?.scenes?.find((scene) => (scene.hotspots || []).some((hotspot) => hotspot.tutorialCreated)) || null
  );
  const getSelectedHotspot = (project, editor) => {
    const selectedScene = getSelectedScene(project, editor.selectedSceneId);
    return (selectedScene?.hotspots || []).find((hotspot) => hotspot.id === editor.selectedHotspotId)
      || (selectedScene?.hotspots || []).find((hotspot) => hotspot.tutorialCreated)
      || null;
  };
  const updateSelectedHotspot = (editor, updater) => {
    editor.patchProject((draft) => {
      const scene = getSelectedScene(draft, editor.selectedSceneId);
      const hotspot = (scene?.hotspots || []).find((entry) => entry.id === editor.selectedHotspotId)
        || (scene?.hotspots || []).find((entry) => entry.tutorialCreated);
      if (hotspot) updater(hotspot, scene, draft);
    });
  };

  const ScenesTab = ({ project, tabContext }) => {
    const { editor } = tabContext;
    const firstScene = getFirstScene(project);
    const secondScene = project.scenes?.[1] || null;
    const guidedHotspotScene = getGuidedHotspotScene(project);
    const selectedHotspot = getSelectedHotspot(project, editor);
    const guidedHotspotCount = project.scenes?.reduce((count, scene) => (
      count + (scene.hotspots || []).filter((hotspot) => hotspot.tutorialCreated).length
    ), 0) || 0;

    return ReactModule.createElement(
      'section',
      {
        'data-testid': 'scenes-tab',
        'data-first-scene': firstScene?.id || '',
        'data-second-scene': secondScene?.id || '',
        'data-selected-scene': editor.selectedSceneId,
        'data-selected-hotspot': editor.selectedHotspotId,
        'data-scenes-count': String(project.scenes?.length || 0),
        'data-guided-hotspot-count': String(guidedHotspotCount),
        'data-guided-hotspot-scene': guidedHotspotScene?.id || '',
        'data-hotspot-target': selectedHotspot?.targetSceneId || '',
      },
      ReactModule.createElement('button', { type: 'button', 'data-tour': 'scene-create-button', onClick: editor.addScene }, '+ Scene'),
      ReactModule.createElement(
        'details',
        { 'data-tour': 'scene-add-menu', open: true },
        ReactModule.createElement('summary', null, 'Ajouter'),
        ReactModule.createElement('button', { type: 'button', 'data-tour': 'scene-add-hotspot', onClick: editor.addHotspot }, 'Zone action'),
      ),
      selectedHotspot?.tutorialCreated ? ReactModule.createElement(
        'button',
        {
          type: 'button',
          'data-tour': 'hotspot-on-canvas',
          onClick: () => updateSelectedHotspot(editor, (hotspot) => {
            hotspot.x = 62;
            hotspot.y = 58;
          }),
        },
        'Zone guidee',
      ) : null,
      ReactModule.createElement(
        'select',
        {
          'aria-label': 'Action de la zone guidee',
          'data-tour': 'hotspot-action',
          value: selectedHotspot?.actionType || 'dialogue',
          onChange: (event) => updateSelectedHotspot(editor, (hotspot) => {
            hotspot.actionType = event.target.value;
          }),
        },
        ReactModule.createElement('option', { value: 'dialogue' }, 'Dialogue'),
        ReactModule.createElement('option', { value: 'scene' }, 'Changer de scene'),
      ),
      ReactModule.createElement(
        'select',
        {
          'aria-label': 'Scene cible guidee',
          'data-tour': 'hotspot-target-scene',
          value: selectedHotspot?.targetSceneId || '',
          onChange: (event) => updateSelectedHotspot(editor, (hotspot) => {
            hotspot.targetSceneId = event.target.value;
          }),
        },
        ReactModule.createElement('option', { value: '' }, 'Choisir'),
        ...(project.scenes || []).map((scene) => ReactModule.createElement('option', { key: scene.id, value: scene.id }, scene.name)),
      ),
    );
  };

  const MediaTab = ({ project, tabContext }) => {
    const { editor } = tabContext;
    return ReactModule.createElement(
      'section',
      { 'data-testid': 'media-tab', 'data-selected-scene': editor.selectedSceneId },
      ReactModule.createElement('button', {
        type: 'button',
        'data-tour': 'media-background-image',
        onClick: () => editor.patchProject((draft) => {
          const scene = getSelectedScene(draft, editor.selectedSceneId);
          if (scene) {
            scene.backgroundData = 'data:image/png;base64,guide';
            scene.backgroundName = 'guide.png';
          }
        }),
      }, 'Importer une image'),
      ReactModule.createElement(
        'span',
        { 'data-testid': 'first-scene-background' },
        getFirstScene(project)?.backgroundData || '',
      ),
    );
  };

  const PreviewTab = ({ project, tabContext }) => {
    const { preview } = tabContext;
    const playScene = project.scenes?.find((scene) => scene.id === preview.playSceneId) || getFirstScene(project);
    const guidedHotspot = (playScene?.hotspots || []).find((hotspot) => hotspot.tutorialCreated)
      || (playScene?.hotspots || []).find((hotspot) => hotspot.actionType === 'scene')
      || null;

    return ReactModule.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'preview-player',
        'data-tour': 'preview-player',
        'data-play-scene': preview.playSceneId,
        onClick: () => {
          if (guidedHotspot) preview.triggerHotspot(guidedHotspot);
        },
      },
      playScene?.name || 'Preview',
    );
  };

  return {
    TABS: {
      scenes: { component: ScenesTab, label: 'Scenes' },
      media: { component: MediaTab, label: 'Media' },
      preview: { component: PreviewTab, label: 'Preview' },
    },
    getTabKey: (value) => value || 'scenes',
    getTabValue: (value) => value,
  };
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const guidedSteps = BUILDER_TUTORIAL_STEPS.filter((step) => step.tutorial === 'guided_creation');

const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const makeOneSceneProject = () => {
  const project = createInitialProject();
  const firstScene = structuredClone(project.scenes[0]);
  firstScene.backgroundData = '';
  firstScene.backgroundName = '';
  firstScene.hotspots = [{
    ...(firstScene.hotspots?.[0] || {}),
    id: 'legacy-guided-hotspot',
    name: 'Ancienne zone guidee',
    tutorialCreated: true,
    actionType: 'scene',
    targetSceneId: 'stale-scene-id',
    x: 70,
    y: 70,
  }];

  return {
    ...project,
    title: 'Projet guide',
    creationMode: 'beginner',
    scenes: [firstScene],
    start: {
      type: 'scene',
      targetSceneId: firstScene.id,
      targetCinematicId: '',
    },
  };
};

const makeMinimalGuideProject = () => ({
  scenes: [{
    id: 'scene-a',
    name: 'Depart',
    backgroundData: '',
    backgroundId: '',
    hotspots: [],
    sceneObjects: [],
    visualEffectZones: [],
  }],
});

const addSecondScene = (project) => ({
  ...structuredClone(project),
  scenes: [
    ...project.scenes,
    {
      id: 'scene-b',
      name: 'Arrivee',
      backgroundData: '',
      backgroundId: '',
      hotspots: [],
      sceneObjects: [],
      visualEffectZones: [],
    },
  ],
});

const withGuidedHotspot = (project, patch = {}) => {
  const nextProject = structuredClone(project);
  nextProject.scenes[0].hotspots = [{
    id: 'hotspot-guide',
    name: 'Sortie',
    tutorialCreated: true,
    actionType: 'dialogue',
    targetSceneId: '',
    x: 50,
    y: 50,
    ...patch,
  }];
  return nextProject;
};

const makeAuth = (project = makeOneSceneProject()) => ({
  activeProjectId: 'project-guided',
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
    id: 'project-guided',
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
  user: { id: 'user-guided', email: 'guided@example.com' },
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  document.body.className = '';
  localStorage.clear();
  vi.clearAllMocks();
});

describe('tutoriel demarrage guide classique', () => {
  test('reference des selectors data-tour presents dans le builder classique', () => {
    const source = [
      'src/components/Tabs.jsx',
      'src/components/MediaTab.jsx',
      'src/components/MediaSourcePicker.jsx',
      'src/components/ScenesTab.jsx',
      'src/components/PreviewTab.jsx',
      'src/components/scenes/SceneSidebar.jsx',
      'src/components/scenes/SceneEditorChrome.jsx',
      'src/components/scenes/HotspotInspectorPanel.jsx',
      'src/components/scenes/HotspotActionFields.jsx',
    ].map(readSource).join('\n');
    const tabSource = readSource('src/components/Tabs.jsx');
    const missing = [];

    guidedSteps.forEach((step) => {
      const selector = step.selector || '';
      const tourMatch = selector.match(/\[data-tour="([^"]+)"\]/);
      const tabMatch = selector.match(/\[data-tour-tab="([^"]+)"\]/);
      if (tourMatch && !source.includes(tourMatch[1])) missing.push(step.selector);
      if (tabMatch) {
        const tabValue = tabMatch[1];
        if (!tabSource.includes('data-tour-tab={tabValue}') || !['media', 'scenes', 'preview'].includes(tabValue)) {
          missing.push(step.selector);
        }
      }
    });

    expect(missing).toEqual([]);
  });

  test('rend chaque completedWhen du demarrage guide validable', () => {
    const [sceneCountStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-scene-count-min');
    const [detailsStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'details-open');
    const [backgroundStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-first-scene-background');
    const [hotspotCreatedStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-hotspot-created');
    const [hotspotMovedStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-hotspot-moved');
    const [hotspotActionStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-guided-hotspot-action');
    const [hotspotTargetStep] = guidedSteps.filter((step) => step.completedWhen?.type === 'project-guided-hotspot-target-scene');
    const oneSceneProject = makeMinimalGuideProject();
    const twoSceneProject = addSecondScene(oneSceneProject);

    guidedSteps
      .filter((step) => step.completedWhen?.type === 'interact')
      .forEach((step) => {
        expect(isTutorialStepComplete(step, new Set([step.selector]), oneSceneProject)).toBe(true);
      });

    document.body.innerHTML = '<details data-tour="scene-add-menu" open></details>';
    expect(isTutorialStepComplete(detailsStep, new Set(), oneSceneProject)).toBe(true);

    expect(isTutorialStepComplete(sceneCountStep, new Set(), oneSceneProject)).toBe(false);
    expect(isTutorialStepComplete(sceneCountStep, new Set(), twoSceneProject)).toBe(true);

    expect(isTutorialStepComplete(backgroundStep, new Set(), oneSceneProject)).toBe(false);
    const projectWithBackground = structuredClone(oneSceneProject);
    projectWithBackground.scenes[0].backgroundData = 'data:image/png;base64,guide';
    expect(isTutorialStepComplete(backgroundStep, new Set(), projectWithBackground)).toBe(true);

    expect(isTutorialStepComplete(hotspotCreatedStep, new Set(), twoSceneProject)).toBe(false);
    const projectWithCenteredHotspot = withGuidedHotspot(twoSceneProject);
    expect(isTutorialStepComplete(hotspotCreatedStep, new Set(), projectWithCenteredHotspot)).toBe(true);
    expect(isTutorialStepComplete(hotspotMovedStep, new Set(), projectWithCenteredHotspot)).toBe(false);
    expect(isTutorialStepComplete(hotspotMovedStep, new Set(), withGuidedHotspot(twoSceneProject, { x: 62 }))).toBe(true);

    expect(isTutorialStepComplete(hotspotActionStep, new Set(), projectWithCenteredHotspot)).toBe(false);
    expect(isTutorialStepComplete(hotspotActionStep, new Set(), withGuidedHotspot(twoSceneProject, { actionType: 'scene' }))).toBe(true);

    expect(isTutorialStepComplete(hotspotTargetStep, new Set(), withGuidedHotspot(twoSceneProject, {
      actionType: 'scene',
      targetSceneId: '',
    }))).toBe(false);
    expect(isTutorialStepComplete(hotspotTargetStep, new Set(), withGuidedHotspot(twoSceneProject, {
      actionType: 'scene',
      targetSceneId: 'scene-a',
    }))).toBe(false);
    expect(isTutorialStepComplete(hotspotTargetStep, new Set(), withGuidedHotspot(twoSceneProject, {
      actionType: 'scene',
      targetSceneId: 'scene-b',
    }))).toBe(true);
  });

  test('rejoue le demarrage guide sur la premiere scene jusqu a la preview', async () => {
    const auth = makeAuth();
    window.scrollTo = vi.fn();
    render(
      <BuilderApp
        auth={auth}
        initialScreen="editor"
        initialTutorialTab="guided_creation"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tutorial-step').textContent).toContain('Deux');
    });

    let scenesPanel = screen.getByTestId('scenes-tab');
    let firstSceneId = '';
    await waitFor(() => {
      scenesPanel = screen.getByTestId('scenes-tab');
      firstSceneId = scenesPanel.dataset.firstScene;
      expect(scenesPanel.dataset.selectedScene).toBe(firstSceneId);
      expect(scenesPanel.dataset.guidedHotspotCount).toBe('0');
    });

    fireEvent.click(screen.getByText('+ Scene'));

    await waitFor(() => {
      scenesPanel = screen.getByTestId('scenes-tab');
      expect(scenesPanel.dataset.scenesCount).toBe('2');
      expect(scenesPanel.dataset.selectedScene).toBe(firstSceneId);
    });
    const secondSceneId = scenesPanel.dataset.secondScene;

    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.click(screen.getByTestId('tab-media'));
    fireEvent.click(screen.getByText('Etape suivante'));

    await waitFor(() => {
      expect(screen.getByTestId('media-tab').dataset.selectedScene).toBe(firstSceneId);
    });
    fireEvent.click(screen.getByText('Importer une image'));
    await waitFor(() => {
      expect(screen.getByTestId('first-scene-background').textContent).toBe('data:image/png;base64,guide');
    });

    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.click(screen.getByTestId('tab-scenes'));
    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.click(screen.getByText('Etape suivante'));

    fireEvent.click(screen.getByText('Zone action'));
    await waitFor(() => {
      scenesPanel = screen.getByTestId('scenes-tab');
      expect(scenesPanel.dataset.selectedScene).toBe(firstSceneId);
      expect(scenesPanel.dataset.guidedHotspotCount).toBe('1');
      expect(scenesPanel.dataset.guidedHotspotScene).toBe(firstSceneId);
    });

    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.click(screen.getByText('Zone guidee'));
    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.change(screen.getByLabelText('Action de la zone guidee'), { target: { value: 'scene' } });
    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.change(screen.getByLabelText('Scene cible guidee'), { target: { value: secondSceneId } });
    await waitFor(() => {
      expect(screen.getByTestId('scenes-tab').dataset.hotspotTarget).toBe(secondSceneId);
    });

    fireEvent.click(screen.getByText('Etape suivante'));
    fireEvent.click(screen.getByTestId('tab-preview'));
    fireEvent.click(screen.getByText('Etape suivante'));

    await waitFor(() => {
      expect(screen.getByTestId('preview-player').dataset.playScene).toBe(firstSceneId);
    });
    fireEvent.click(screen.getByTestId('preview-player'));
    await waitFor(() => {
      expect(screen.getByTestId('preview-player').dataset.playScene).toBe(secondSceneId);
    });
  });

  test('nettoie les anciens marqueurs tutoriel avant le demarrage guide', () => {
    const project = makeOneSceneProject();
    const preparedProject = prepareProjectForGuidedCreation(project);

    expect(project.scenes[0].hotspots[0].tutorialCreated).toBe(true);
    expect(preparedProject.scenes[0].id).toBe(project.scenes[0].id);
    expect(preparedProject.scenes[0].hotspots.some((hotspot) => hotspot.tutorialCreated)).toBe(false);
  });
});
