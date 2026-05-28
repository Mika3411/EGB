import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Tabs from '../components/Tabs.jsx';
import { getSafeBuilderTab, isBuilderTab, isTabAllowedForProject } from '../utils/tutorialHelpers.js';

const hiddenClassicTabs = ['Personnages 3D', 'Objets 3D', 'Cascadeur'];
const hiddenClassicTabIds = ['characters3d', 'decors3d', 'stunts'];
const hiddenExpertTabs = ['Narration', 'Héros', 'Combat'];
const hiddenExpertTabIds = ['adventure', 'hero', 'combat'];
const projectModes = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'];

describe('classic builder tabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps 3D workshops out of every classic creation mode', () => {
    projectModes.forEach((projectMode) => {
      cleanup();
      render(
        <Tabs
          value="scenes"
          onChange={() => {}}
          onProfile={() => {}}
          projectMode={projectMode}
        />,
      );

      expect(screen.getByText('Objets')).toBeTruthy();
      hiddenClassicTabs.forEach((label) => {
        expect(screen.queryByText(label)).toBeNull();
      });
    });
  });

  it('refuses saved 3D workshop tabs in classic projects', () => {
    projectModes.forEach((creationMode) => {
      hiddenClassicTabIds.forEach((tabId) => {
        expect(isBuilderTab(tabId)).toBe(false);
        expect(isTabAllowedForProject(tabId, { creationMode })).toBe(false);
        expect(getSafeBuilderTab(tabId, { creationMode })).toBe('scenes');
      });
    });
  });

  it('keeps narration, hero and combat out of expert mode', () => {
    render(
      <Tabs
        value="scenes"
        onChange={() => {}}
        onProfile={() => {}}
        projectMode="expert"
      />,
    );

    expect(screen.getByText('Scènes')).toBeTruthy();
    hiddenExpertTabs.forEach((label) => {
      expect(screen.queryByText(label)).toBeNull();
    });

    hiddenExpertTabIds.forEach((tabId) => {
      expect(isBuilderTab(tabId)).toBe(true);
      expect(isTabAllowedForProject(tabId, { creationMode: 'expert' })).toBe(false);
      expect(getSafeBuilderTab(tabId, { creationMode: 'expert' })).toBe('scenes');
    });
  });
});
