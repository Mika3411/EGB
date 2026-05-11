import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseLocalStorage,
  readBuilderUiState,
  readJsonStorage,
  removeStorageKey,
  safeParseJson,
  writeBuilderUiState,
  writeJsonStorage,
} from '../utils/storageHelpers';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('storage helpers', () => {
  it('parses JSON with a fallback for empty or invalid values', () => {
    expect(safeParseJson('{"ok":true}', {})).toEqual({ ok: true });
    expect(safeParseJson('', { fallback: true })).toEqual({ fallback: true });
    expect(safeParseJson('{invalid', [])).toEqual([]);
  });

  it('falls back when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(canUseLocalStorage()).toBe(false);
    expect(readJsonStorage('settings', ['fallback'])).toEqual(['fallback']);
    expect(writeJsonStorage('settings', { volume: 7 })).toBe(false);
    expect(removeStorageKey('settings')).toBe(false);
  });

  it('reads, writes, and removes JSON from localStorage', () => {
    expect(canUseLocalStorage()).toBe(true);
    expect(readJsonStorage('missing-key', ['fallback'])).toEqual(['fallback']);

    expect(writeJsonStorage('settings', { volume: 7 })).toBe(true);
    expect(readJsonStorage('settings', {})).toEqual({ volume: 7 });

    expect(removeStorageKey('settings')).toBe(true);
    expect(readJsonStorage('settings', null)).toBeNull();
  });

  it('returns false when localStorage writes fail', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    expect(writeJsonStorage('blocked', { ok: true })).toBe(false);
  });

  it('keeps builder UI state resilient to malformed storage', () => {
    window.localStorage.setItem('escapeGameBuilder.builderUiState.user-1.project-1', '{broken');

    expect(readBuilderUiState('user-1', 'project-1')).toEqual({});
    expect(writeBuilderUiState('user-1', 'project-1', { screen: 'editor', tab: 'scenes' })).toBe(true);
    expect(readBuilderUiState('user-1', 'project-1')).toMatchObject({
      screen: 'editor',
      tab: 'scenes',
    });
  });
});
