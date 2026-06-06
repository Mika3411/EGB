import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';
import { prepareProjectForTutorial } from '../shared/data/tutorialSteps';
import { isTabAllowedForProject } from '../shared/utils/tutorialHelpers';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const extractTourSelectors = (step) => [
  step.selector,
  step.fallbackSelector,
  ...(Array.isArray(step.fallbackSelectors) ? step.fallbackSelectors : []),
].filter(Boolean);

const makeScoreProject = (creationMode = 'beginner') => ({
  creationMode,
  acts: [],
  scenes: [],
  items: [],
  enigmas: [],
  cinematics: [],
});

describe('didacticiel Bilan', () => {
  test('reference uniquement des cibles presentes dans la nouvelle UI Bilan', () => {
    const source = [
      'src/app/builder/navigation/BuilderDomainNav.jsx',
      'src/app/builder/navigation/domainTabs.jsx',
      'src/domains/analytics/project-score/ProjectScoreDashboard.jsx',
    ].map(readSource).join('\n');
    const missing = [];

    BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'score')
      .flatMap(extractTourSelectors)
      .forEach((selector) => {
        const tourMatch = selector.match(/\[data-tour="([^"]+)"\]/);
        const tabMatch = selector.match(/\[data-tour-tab="([^"]+)"\]/);
        if (
          tourMatch
          && !source.includes(`data-tour="${tourMatch[1]}"`)
          && !source.includes(`tour="${tourMatch[1]}"`)
        ) {
          missing.push(selector);
        }
        if (tabMatch && !source.includes(`score: { component: ProjectScoreDashboard`)) missing.push(selector);
      });

    expect(missing).toEqual([]);
  });

  test('prepare un projet temporaire qui peut ouvrir Bilan depuis un mode simplifie', () => {
    const preparedBeginnerProject = prepareProjectForTutorial(makeScoreProject('beginner'), 'score');
    const preparedHeroProject = prepareProjectForTutorial(makeScoreProject('hero_adventure'), 'score');

    expect(preparedBeginnerProject.creationMode).toBe('expert');
    expect(isTabAllowedForProject('score', preparedBeginnerProject)).toBe(true);
    expect(preparedHeroProject.creationMode).toBe('hero_adventure');
    expect(isTabAllowedForProject('score', preparedHeroProject)).toBe(true);
  });
});
