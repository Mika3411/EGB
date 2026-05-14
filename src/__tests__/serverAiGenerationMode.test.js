import { describe, expect, test } from 'vitest';
import { shouldRunTextGenerationAsync } from '../../server/aiGenerationMode.js';

describe('server AI generation mode', () => {
  test('utilise le mode async pour les generations longues de projet', () => {
    expect(shouldRunTextGenerationAsync({
      responseFormat: 'escape-game-project-json',
      mode: 'generate',
    })).toBe(true);
  });

  test('garde le mode inline pour les reparations et les demandes explicites', () => {
    expect(shouldRunTextGenerationAsync({
      responseFormat: 'escape-game-project-json',
      mode: 'repair_item_names',
    })).toBe(false);
    expect(shouldRunTextGenerationAsync({
      responseFormat: 'escape-game-project-json',
      runInline: true,
    })).toBe(false);
    expect(shouldRunTextGenerationAsync({
      responseFormat: 'item-name-map-json',
      mode: 'generate',
    })).toBe(false);
  });
});
