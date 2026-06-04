import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CombatWorkspace from '../domains/combat/CombatWorkspace.jsx';
import { createInitialProject } from '../shared/data/projectData.js';

afterEach(() => {
  cleanup();
});

const makeCombatProject = () => {
  const project = createInitialProject();
  const hotspot = project.scenes[0].hotspots[0];
  hotspot.actionType = 'hero_combat';
  hotspot.combatEnemyName = 'Gardien';
  hotspot.combatEnemyMaxHealth = 8;
  return project;
};

const renderCombatTab = (project) => render(
  <CombatWorkspace
    project={project}
    patchProject={vi.fn()}
    handleUpload={vi.fn()}
    mediaLibrary={[]}
    getSceneLabel={() => 'Salon'}
    setSelectedSceneId={vi.fn()}
    setSelectedHotspotId={vi.fn()}
    setTab={vi.fn()}
    previewHeroCombat={vi.fn()}
  />,
);

describe('CombatWorkspace', () => {
  it('renders when no combat source exists', () => {
    renderCombatTab(createInitialProject());

    expect(screen.getByText('Atelier de combat')).toBeTruthy();
    expect(screen.getByText('Aucun combat simple détecté.')).toBeTruthy();
  });

  it('renders every combat panel for a combat source', () => {
    renderCombatTab(makeCombatProject());

    fireEvent.click(screen.getByRole('button', { name: 'Ennemi' }));
    expect(screen.getByText('Phrase de début')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Équilibrage' }));
    expect(screen.getByText('Mode Équilibrage')).toBeTruthy();
    expect(screen.getAllByText('Gardien').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Compétences' }));
    expect(screen.getByText('Compétences du héros')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Arène' }));
    expect(screen.getByText('Combat sélectionné')).toBeTruthy();
  });
});
