import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import PublicationPanel from '../domains/profile/components/PublicationPanel';

const makeProject = (overrides = {}) => ({
  id: 'project-1',
  name: 'Projet test',
  data: {
    title: 'Projet test',
    scenes: [],
    enigmas: [],
  },
  shareState: {},
  ...overrides,
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PublicationPanel', () => {
  test('shows Publish for private projects', () => {
    render(<PublicationPanel projects={[makeProject()]} />);

    expect(screen.getByRole('button', { name: 'Publier' })).toBeTruthy();
  });

  test('shows Update for already public projects', () => {
    render(<PublicationPanel projects={[makeProject({ shareState: { isPublic: true } })]} />);

    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeTruthy();
  });
});
