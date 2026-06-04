import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AiWorkbench from '../domains/ai/AiWorkbench.jsx';
import { createInitialProject } from '../shared/data/projectData';
import { generateAiProject } from '../shared/utils/aiProjectGenerator';
import { showConfirm } from '../shared/ui/AccessibleDialog';

const draftStorage = vi.hoisted(() => ({
  read: vi.fn(async () => null),
  write: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  removeMany: vi.fn(async () => undefined),
}));

vi.mock('../shared/utils/aiProjectGenerator', () => ({
  generateAiProject: vi.fn(),
}));

vi.mock('../shared/utils/aiAuthHeaders', () => ({
  getAiAuthHeaders: vi.fn(async () => ({})),
}));

vi.mock('../shared/utils/indexedDraftStorage', () => ({
  createIndexedDraftStorage: () => draftStorage,
}));

vi.mock('../shared/ui/AccessibleDialog', () => ({
  showConfirm: vi.fn(async () => true),
}));

const makeGeneratedProject = () => ({
  id: 'ai-project',
  title: 'Projet IA stable',
  creationMode: 'beginner',
  acts: [{ id: 'act-ai', name: 'Acte IA' }],
  start: { type: 'scene', targetSceneId: 'scene-ai', targetCinematicId: '' },
  scenes: [{
    id: 'scene-ai',
    name: 'Salle IA',
    actId: 'act-ai',
    introText: 'Une salle IA jouable avec une piste claire.',
    hotspots: [{
      id: 'spot-ai',
      name: 'Porte bleue',
      x: 50,
      y: 50,
      width: 12,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'La porte bleue donne un indice important.',
    }],
    sceneObjects: [],
  }],
  items: [{ id: 'item-ai', name: 'Cle IA', icon: 'K' }],
  combinations: [],
  enigmas: [],
  cinematics: [],
  storyVariables: [],
  assets: [],
});

const renderAiTab = ({
  balance = 100,
  onApplyProject = vi.fn(async () => ({ ok: true, errors: [], warnings: [] })),
  onSaveAiDraft = vi.fn(async () => undefined),
} = {}) => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      balance,
      costs: {
        text: 2,
        image: 5,
        improve: 5,
        objectThumbnail: 1,
        projectGeneration: {
          act: 2,
          scene: 1,
          enigma: 1,
          cinematic: 1,
          item: 1,
          combination: 1,
        },
      },
      nextObjectImageCost: 3,
      objectImagesInCurrentBatch: 0,
      objectImageBatchSize: 4,
    }),
  }));

  const project = createInitialProject();
  const view = render(
    <AiWorkbench
      project={project}
      getSceneLabel={(sceneOrId) => (
        typeof sceneOrId === 'string'
          ? project.scenes.find((scene) => scene.id === sceneOrId)?.name || sceneOrId
          : sceneOrId?.name || ''
      )}
      onApplyProject={onApplyProject}
      onSaveAiDraft={onSaveAiDraft}
      projectStorageKey="ai-critical"
    />,
  );

  return { ...view, project, onApplyProject, onSaveAiDraft };
};

const goToDescriptionStep = () => {
  fireEvent.click(screen.getByRole('button', { name: /R.aliste/i }));
  fireEvent.click(screen.getByRole('button', { name: /Nouveau projet/i }));
};

describe('AI critical flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    draftStorage.read.mockResolvedValue(null);
    draftStorage.write.mockResolvedValue(undefined);
    draftStorage.remove.mockResolvedValue(undefined);
    generateAiProject.mockResolvedValue({
      project: makeGeneratedProject(),
      source: 'api',
      isPatch: false,
    });
    showConfirm.mockResolvedValue(true);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('runs generation, saves a draft and applies the generated project', async () => {
    const { container, onApplyProject, onSaveAiDraft } = renderAiTab();

    await waitFor(() => expect(screen.getByText('100')).toBeTruthy());
    goToDescriptionStep();

    fireEvent.click(container.querySelector('[data-tour="ai-generate-button"]'));

    await waitFor(() => expect(generateAiProject).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Projet IA stable')).toBeTruthy());
    expect(screen.getByText(/Validation OK/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder le brouillon IA/i }));
    await waitFor(() => expect(draftStorage.write).toHaveBeenCalled());
    expect(onSaveAiDraft).toHaveBeenCalledWith(expect.objectContaining({
      generatedProject: expect.objectContaining({ title: 'Projet IA stable' }),
    }));

    fireEvent.click(screen.getByRole('button', { name: /Appliquer au projet/i }));
    await waitFor(() => expect(showConfirm).toHaveBeenCalledWith(expect.objectContaining({
      confirmLabel: 'Appliquer',
    })));
    await waitFor(() => expect(onApplyProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Projet IA stable' }),
      expect.objectContaining({
        mode: 'generate',
        isPatch: false,
        selectedSceneId: 'scene-ai',
        aiDraft: expect.objectContaining({
          generatedProject: expect.objectContaining({ title: 'Projet IA stable' }),
        }),
      }),
    ));
  });

  test('blocks text generation when available AI credits are below the announced cost', async () => {
    const { container } = renderAiTab({ balance: 1 });

    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    goToDescriptionStep();
    const generateButton = container.querySelector('[data-tour="ai-generate-button"]');

    expect(generateButton.disabled).toBe(true);
    fireEvent.click(generateButton);
    expect(generateAiProject).not.toHaveBeenCalled();
  });

  test('keeps the AI wizard split into action, details and result steps', async () => {
    renderAiTab();

    await waitFor(() => expect(screen.getByText('100')).toBeTruthy());
    expect(screen.queryByText('Projet IA')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /R.aliste/i }));
    expect(screen.getByText('Action IA')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retour/i })).toBeTruthy();
    expect(screen.queryByDisplayValue('Manoir familial hanté')).toBeNull();
    expect(screen.queryByText('Projet IA')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Nouveau projet/i }));
    expect(screen.getByText(/8 cr.dits/i).classList.contains('ai-field-credit-cost')).toBe(true);
    expect(screen.getByText(/10 cr.dits/i).classList.contains('ai-field-credit-cost')).toBe(true);
    expect(screen.getAllByText(/5 cr.dits/i).some((element) => element.classList.contains('ai-field-credit-cost'))).toBe(true);
    expect(screen.getByText('Paramètres')).toBeTruthy();
    expect(screen.getByDisplayValue('Manoir familial hanté')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Générer le jeu complet/i })).toBeTruthy();
    expect(screen.queryByText('Projet IA')).toBeNull();
  });

  test('shows the AI project panel only during and after generation', async () => {
    let resolveGeneration;
    generateAiProject.mockImplementationOnce(() => new Promise((resolve) => {
      resolveGeneration = resolve;
    }));
    const { container } = renderAiTab();

    await waitFor(() => expect(screen.getByText('100')).toBeTruthy());
    goToDescriptionStep();
    expect(screen.queryByText('Projet IA')).toBeNull();

    fireEvent.click(container.querySelector('[data-tour="ai-generate-button"]'));
    await waitFor(() => expect(screen.getByText('Projet IA')).toBeTruthy());
    expect(screen.getAllByText(/Génération en cours/i).length).toBeGreaterThan(0);

    resolveGeneration({
      project: makeGeneratedProject(),
      source: 'api',
      isPatch: false,
    });
    await waitFor(() => expect(screen.getByText('Projet IA stable')).toBeTruthy());
  });
});
