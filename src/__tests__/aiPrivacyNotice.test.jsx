import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AiTab from '../components/AiTab.jsx';
import { createInitialProject } from '../data/projectData';

vi.mock('../utils/aiAuthHeaders', () => ({
  getAiAuthHeaders: vi.fn(async () => ({})),
}));

vi.mock('../utils/indexedDraftStorage', () => ({
  createIndexedDraftStorage: () => ({
    read: vi.fn(async () => null),
    write: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    removeMany: vi.fn(async () => undefined),
  }),
}));

describe('AiTab privacy notice', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        balance: 100,
        costs: { text: 2, image: 5 },
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('affiche clairement les donnees projet pouvant etre transmises a l IA', () => {
    render(
      <AiTab
        project={createInitialProject()}
        getSceneLabel={(scene) => scene?.name || scene}
        onApplyProject={vi.fn()}
      />,
    );

    expect(screen.getByText('Confidentialité IA')).toBeTruthy();
    expect(screen.getByText(/titres, scènes, dialogues, personnages, contraintes et consignes/i)).toBeTruthy();
    expect(screen.getByText(/fournisseur IA/i)).toBeTruthy();
  });
});
