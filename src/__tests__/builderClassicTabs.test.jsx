import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Tabs from '../app/builder/navigation/BuilderDomainNav.jsx';
import { getSafeBuilderTab, isBuilderTab, isTabAllowedForProject } from '../shared/utils/tutorialHelpers.js';
import { getClassicBuilderTabValuesForMode } from '../shared/utils/classicBuilderTabs.js';

const hiddenClassicTabs = ['Personnages 3D', 'Objets 3D', 'Cascadeur'];
const hiddenClassicTabIds = ['characters3d', 'decors3d', 'stunts'];
const hiddenExpertTabs = ['Narration', 'Héros', 'Combat'];
const hiddenExpertTabIds = ['adventure', 'hero', 'combat'];
const projectModes = ['beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'];
const expectedTabsByMode = {
  beginner: ['scenes', 'media', 'preview', 'objects', 'enigmas', 'ai', 'shop', 'resources', 'help'],
  intermediate: ['scenes', 'media', 'map', 'preview', 'objects', 'cinematics', 'enigmas', 'ai', 'shop', 'resources', 'help'],
  expert: ['scenes', 'media', 'map', 'preview', 'objects', 'cinematics', 'enigmas', 'combinations', 'logic', 'animation', 'ai', 'shop', 'resources', 'help', 'score'],
  adventure: ['scenes', 'media', 'map', 'adventure', 'preview', 'objects', 'cinematics', 'enigmas', 'logic', 'animation', 'shop', 'resources', 'help', 'score'],
  hero_adventure: ['scenes', 'media', 'map', 'adventure', 'hero', 'combat', 'preview', 'objects', 'cinematics', 'enigmas', 'logic', 'animation', 'ai', 'shop', 'resources', 'help', 'score'],
};
const classicTabIds = [...new Set(Object.values(expectedTabsByMode).flat())];

const getRenderedTabIds = (container) => (
  Array.from(container.querySelectorAll('[data-tour-tab]')).map((entry) => entry.getAttribute('data-tour-tab'))
);

describe('classic builder tabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows and allows exactly the expected tabs for every classic creation mode', () => {
    Object.entries(expectedTabsByMode).forEach(([projectMode, expectedTabs]) => {
      cleanup();
      const { container } = render(
        <Tabs
          value="scenes"
          onChange={() => {}}
          onProfile={() => {}}
          projectMode={projectMode}
        />,
      );

      expect(getRenderedTabIds(container)).toEqual(expectedTabs);
      expect(getClassicBuilderTabValuesForMode(projectMode)).toEqual(expectedTabs);
      classicTabIds.forEach((tabId) => {
        const shouldBeAllowed = expectedTabs.includes(tabId);
        expect(isBuilderTab(tabId)).toBe(true);
        expect(isTabAllowedForProject(tabId, { creationMode: projectMode })).toBe(shouldBeAllowed);
        expect(getSafeBuilderTab(tabId, { creationMode: projectMode })).toBe(shouldBeAllowed ? tabId : 'scenes');
      });
    });
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
