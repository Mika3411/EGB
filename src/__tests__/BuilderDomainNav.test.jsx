import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Tabs from '../app/builder/navigation/BuilderDomainNav.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('navigation builder', () => {
  test('ouvre le bilan depuis le bouton de note', () => {
    const onChange = vi.fn();

    render(
      <Tabs
        value="scenes"
        onChange={onChange}
        onProfile={vi.fn()}
        projectScore={{ label: '8.4', tone: 'good', summary: 'Projet solide' }}
        projectMode="expert"
      />,
    );

    const scoreButton = screen.getByRole('button', {
      name: 'Ouvrir le bilan du projet, note 8.4',
    });

    expect(scoreButton.className).toContain('project-score-badge');
    fireEvent.click(scoreButton);

    expect(onChange).toHaveBeenCalledWith('score');
  });

  test('masque la note dans les extensions Pro', () => {
    render(
      <Tabs
        value="scenes"
        onChange={vi.fn()}
        onProfile={vi.fn()}
        projectScore={{ label: '2,4/10', tone: 'danger', summary: 'Projet incomplet' }}
        projectMode="pro_promo"
      />,
    );

    expect(screen.queryByRole('button', { name: /Ouvrir le bilan du projet/i })).toBeNull();
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.queryByText('2,4/10')).toBeNull();
  });
});
