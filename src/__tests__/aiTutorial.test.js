import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const aiSource = () => [
  'src/domains/ai/AiWorkbench.jsx',
  'src/domains/ai/components/AiBriefForm.jsx',
  'src/domains/ai/components/AiControlsPanel.jsx',
  'src/domains/ai/components/AiDiffPanel.jsx',
  'src/domains/ai/components/AiDraftPreview.jsx',
].map(readSource).join('\n');

const aiSteps = () => BUILDER_TUTORIAL_STEPS
  .filter((step) => (step.tutorial || step.tab) === 'ai');

const extractTourSelectors = (step) => [
  step.selector,
  step.fallbackSelector,
  ...(Array.isArray(step.fallbackSelectors) ? step.fallbackSelectors : []),
  step.completedWhen?.selector,
]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

describe('didacticiel IA', () => {
  test('reference uniquement des data-tour presents dans la nouvelle UI IA', () => {
    const source = aiSource();
    const missing = [...new Set(
      aiSteps()
        .flatMap(extractTourSelectors)
        .filter((tour) => !source.includes(tour)),
    )];

    expect(missing).toEqual([]);
  });

  test('suit le nouvel assistant IA par style, action, parametres et brouillon', () => {
    const selectors = aiSteps().map((step) => step.selector);
    const indexOf = (selector) => selectors.indexOf(selector);

    [
      '[data-tour="ai-credits"]',
      '[data-tour="ai-image-style"]',
      '[data-tour="ai-mode"]',
      '[data-tour="ai-estimate"]',
      '[data-tour="ai-brief-fields"]',
      '[data-tour="ai-visual-options"]',
      '[data-tour="ai-generate-button"]',
      '[data-tour="ai-output"]',
      '[data-tour="ai-diff"]',
      '[data-tour="ai-validation"]',
      '[data-tour="ai-result-preview"]',
      '[data-tour="ai-scene-visual-constraints"]',
      '[data-tour="ai-scene-image-button"]',
      '[data-tour="ai-apply-button"]',
    ].forEach((selector) => {
      expect(indexOf(selector)).toBeGreaterThanOrEqual(0);
    });

    expect(indexOf('[data-tour="ai-credits"]')).toBeLessThan(indexOf('[data-tour="ai-image-style"]'));
    expect(indexOf('[data-tour="ai-image-style"]')).toBeLessThan(indexOf('[data-tour="ai-mode"]'));
    expect(indexOf('[data-tour="ai-mode"]')).toBeLessThan(indexOf('[data-tour="ai-estimate"]'));
    expect(indexOf('[data-tour="ai-estimate"]')).toBeLessThan(indexOf('[data-tour="ai-brief-fields"]'));
    expect(indexOf('[data-tour="ai-brief-fields"]')).toBeLessThan(indexOf('[data-tour="ai-visual-options"]'));
    expect(indexOf('[data-tour="ai-visual-options"]')).toBeLessThan(indexOf('[data-tour="ai-generate-button"]'));
    expect(indexOf('[data-tour="ai-generate-button"]')).toBeLessThan(indexOf('[data-tour="ai-output"]'));
  });
});
