import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
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

  test('hides QR code save action for non-pro accounts', () => {
    render(<PublicationPanel projects={[makeProject()]} />);

    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer le QR code' })).toBeNull();
  });

  test('shows QR code save action for pro accounts', () => {
    const onSaveProjectQrCode = vi.fn();
    render(
      <PublicationPanel
        canSaveProjectQrCode
        projects={[makeProject()]}
        onSaveProjectQrCode={onSaveProjectQrCode}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le QR code' }));

    expect(onSaveProjectQrCode).toHaveBeenCalledWith('project-1');
  });

  test('shows Update for already public projects', () => {
    render(<PublicationPanel projects={[makeProject({ shareState: { isPublic: true } })]} />);

    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeTruthy();
  });
});
