import { describe, expect, it } from 'vitest';
import {
  acceptToMediaType,
  assetMatchesMediaType,
  dedupeLibraryItems,
  matchesAssetScope,
} from '../hooks/useMediaSourcePicker';

describe('media source picker filters', () => {
  it('accepts imported mp3 assets for scene music even without a music role', () => {
    const asset = {
      id: 'asset_library_audio_123',
      type: 'audio',
      url: 'data:audio/mpeg;base64,AAAA',
      name: '0422.MP3',
      meta: {},
    };

    expect(acceptToMediaType('audio/*')).toBe('audio');
    expect(assetMatchesMediaType(asset, 'audio')).toBe(true);
    expect(matchesAssetScope(asset, 'scene-music')).toBe(true);
  });

  it('recognizes audio files from their filename or url when the stored type is unknown', () => {
    const asset = {
      id: 'asset_library_unknown_123',
      type: 'unknown',
      url: 'https://example.test/storage/track.mp3?token=abc',
      name: 'track',
      meta: {},
    };

    expect(assetMatchesMediaType(asset, 'audio')).toBe(true);
    expect(matchesAssetScope(asset, 'scene-ambient')).toBe(true);
  });

  it('deduplicates repeated audio assets created by multiple usages', () => {
    const items = [
      { id: 'a', type: 'audio', url: 'data:audio/mpeg;base64,AAA', name: '0422.MP3' },
      { id: 'b', type: 'audio', url: 'data:audio/mpeg;base64,BBB', name: '0422.MP3' },
      { id: 'c', type: 'audio', url: 'data:audio/mpeg;base64,CCC', name: '0505(5).MP3' },
      { id: 'd', type: 'audio', url: 'data:audio/mpeg;base64,DDD', name: '0505.MP3' },
    ];

    expect(dedupeLibraryItems(items, 'audio').map((asset) => asset.name)).toEqual(['0422.MP3', '0505(5).MP3']);
  });
});
