import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseLocalStorage,
  readAppUiState,
  readBuilderUiState,
  readJsonStorage,
  removeStorageKey,
  safeParseJson,
  writeAppUiState,
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

  it('merges app and builder UI state updates', () => {
    expect(writeAppUiState({ screen: 'builder', projectId: 'project-1' })).toBe(true);
    expect(writeAppUiState({ tab: 'media' })).toBe(true);
    expect(readAppUiState()).toMatchObject({
      screen: 'builder',
      projectId: 'project-1',
      tab: 'media',
    });

    expect(writeBuilderUiState('user-1', 'project-1', {
      screen: 'editor',
      tab: 'scenes',
      scrollByTab: { scenes: { window: { x: 0, y: 120 } } },
    })).toBe(true);
    expect(writeBuilderUiState('user-1', 'project-1', { selectedSceneId: 'scene-2' })).toBe(true);
    expect(readBuilderUiState('user-1', 'project-1')).toMatchObject({
      screen: 'editor',
      selectedSceneId: 'scene-2',
      tab: 'scenes',
      scrollByTab: { scenes: { window: { x: 0, y: 120 } } },
    });
  });
});
