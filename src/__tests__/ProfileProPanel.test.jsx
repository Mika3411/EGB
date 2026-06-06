import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import ProfileProPanel from '../domains/profile/components/ProfileProPanel';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';
import { applyProPromotionProjectSetup } from '../shared/services/proPromotion';

const makeProExtensionRecord = (overrides = {}) => {
  const data = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
  return {
    id: 'extension-1',
    name: 'Extension test',
    updatedAt: '2026-06-06T10:56:00.000Z',
    data,
    shareState: { isPublic: true, category: 'Enquête', ageRating: '+18 ans' },
    ...overrides,
  };
};

afterEach(() => cleanup());

describe('ProfileProPanel', () => {
  test('masque les reglages et actions de publication sur les extensions pro', () => {
    render(<ProfileProPanel projects={[makeProExtensionRecord()]} />);

    expect(screen.getByText('Extension test')).toBeTruthy();
    expect(screen.queryByText('Catégorie')).toBeNull();
    expect(screen.queryByText("Mention d'âge")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mettre à jour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
    expect(screen.queryByText('Publié')).toBeNull();
    expect(screen.queryByText('Privé')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Publiées' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Non publiées' })).toBeNull();
  });
});
