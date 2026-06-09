import { afterEach, describe, expect, test, vi } from 'vitest';
import { shouldStartDemoInPlayerPreview } from '../app/ShellApp.jsx';

const mockMatchMedia = (matches) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: '',
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lancement de la démo', () => {
  test('ouvre un aperçu joueur sur téléphone', () => {
    mockMatchMedia(true);

    expect(shouldStartDemoInPlayerPreview()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 720px), (max-width: 900px) and (orientation: landscape) and (pointer: coarse)');
  });

  test('garde le studio complet sur desktop', () => {
    mockMatchMedia(false);

    expect(shouldStartDemoInPlayerPreview()).toBe(false);
  });
});
