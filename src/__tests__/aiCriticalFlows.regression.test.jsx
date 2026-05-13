import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AiTab from '../components/AiTab.jsx';
import { createInitialProject } from '../data/projectData';
import { generateAiProject } from '../utils/aiProjectGenerator';
import { showConfirm } from '../components/AccessibleDialog';

const draftStorage = vi.hoisted(() => ({
  read: vi.fn(async () => null),
  write: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  removeMany: vi.fn(async () => undefined),
}));

vi.mock('../utils/aiProjectGenerator', () => ({
  generateAiProject: vi.fn(),
}));

vi.mock('../utils/aiAuthHeaders', () => ({
  getAiAuthHeaders: vi.fn(async () => ({})),
}));

vi.mock('../utils/indexedDraftStorage', () => ({
  createIndexedDraftStorage: () => draftStorage,
}));

vi.mock('../components/AccessibleDialog', () => ({
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
    <AiTab
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

describe('AI critical flows', () => {
  beforeEach(() => {
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
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('runs generation, saves a draft and applies the generated project', async () => {
    const { container, onApplyProject, onSaveAiDraft } = renderAiTab();

    await waitFor(() => expect(screen.getByText('100')).toBeTruthy());

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
    const generateButton = container.querySelector('[data-tour="ai-generate-button"]');

    expect(generateButton.disabled).toBe(true);
    fireEvent.click(generateButton);
    expect(generateAiProject).not.toHaveBeenCalled();
  });
});
