import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const extractTourSelectors = (step) => [step.selector, step.fallbackSelector]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

const hasTourAnchor = (source, tour) => (
  source.includes(`data-tour="${tour}"`)
  || source.includes(`'${tour}'`)
  || source.includes(`"${tour}"`)
);

describe('didacticiel plan', () => {
  test('reference uniquement des data-tour presents dans la nouvelle UI du plan', () => {
    const source = readSource('src/domains/scenes/routes/SceneRouteMap.jsx');
    const missing = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'map')
      .flatMap(extractTourSelectors)
      .filter((tour) => !hasTourAnchor(source, tour));

    expect(missing).toEqual([]);
  });

  test('suit le flux accueil, construction, puis test des liens', () => {
    const selectors = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'map')
      .map((step) => step.selector);

    expect(selectors.indexOf('[data-tour="map-open-builder"]')).toBeGreaterThan(selectors.indexOf('[data-tour="map-home"]'));
    expect(selectors.indexOf('[data-tour="map-start-settings"]')).toBeGreaterThan(selectors.indexOf('[data-tour="map-open-builder"]'));
    expect(selectors.indexOf('[data-tour="map-back-home"]')).toBeGreaterThan(selectors.indexOf('[data-tour="map-room-detail"]'));
    expect(selectors.indexOf('[data-tour="map-open-tests"]')).toBeGreaterThan(selectors.indexOf('[data-tour="map-back-home"]'));
    expect(selectors.indexOf('[data-tour="map-diagnostics"]')).toBeGreaterThan(selectors.indexOf('[data-tour="map-gameplay-detail"]'));
  });
});
