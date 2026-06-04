import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const logicSource = () => readSource('src/domains/scenes/logic/LogicRulesWorkspace.jsx');

const logicSteps = () => BUILDER_TUTORIAL_STEPS
  .filter((step) => (step.tutorial || step.tab) === 'logic');

const extractTourSelectors = (step) => [
  step.selector,
  step.fallbackSelector,
  ...(Array.isArray(step.fallbackSelectors) ? step.fallbackSelectors : []),
  step.completedWhen?.selector,
]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

describe('didacticiel logique', () => {
  test('reference uniquement des data-tour presents dans la nouvelle UI logique', () => {
    const source = logicSource();
    const missing = [...new Set(
      logicSteps()
        .flatMap(extractTourSelectors)
        .filter((tour) => !source.includes(tour)),
    )];

    expect(missing).toEqual([]);
  });

  test('suit le flux scene, timer, regles, si, alors, sinon et objets visibles', () => {
    const selectors = logicSteps().map((step) => step.selector);
    const indexOf = (selector) => selectors.indexOf(selector);

    [
      '[data-tour="logic-scene-tree"]',
      '[data-tour="logic-scene-timer"]',
      '[data-tour="logic-timer-toggle"]',
      '[data-tour="logic-timer-action"]',
      '[data-tour="logic-zones"]',
      '[data-tour="logic-rule-card"]',
      '[data-tour="logic-condition-step"]',
      '[data-tour="logic-action-step"]',
      '[data-tour="logic-target-scene"]',
      '[data-tour="logic-failure-step"]',
      '[data-tour="logic-options-step"]',
      '[data-tour="logic-visible-objects"]',
    ].forEach((selector) => {
      expect(indexOf(selector)).toBeGreaterThanOrEqual(0);
    });

    expect(indexOf('[data-tour="logic-scene-tree"]')).toBeLessThan(indexOf('[data-tour="logic-scene-timer"]'));
    expect(indexOf('[data-tour="logic-scene-timer"]')).toBeLessThan(indexOf('[data-tour="logic-zones"]'));
    expect(indexOf('[data-tour="logic-zones"]')).toBeLessThan(indexOf('[data-tour="logic-rule-card"]'));
    expect(indexOf('[data-tour="logic-condition-step"]')).toBeLessThan(indexOf('[data-tour="logic-action-step"]'));
    expect(indexOf('[data-tour="logic-action-step"]')).toBeLessThan(indexOf('[data-tour="logic-failure-step"]'));
    expect(indexOf('[data-tour="logic-failure-step"]')).toBeLessThan(indexOf('[data-tour="logic-options-step"]'));
    expect(indexOf('[data-tour="logic-options-step"]')).toBeLessThan(indexOf('[data-tour="logic-visible-objects"]'));
  });
});
