import { describe, expect, it } from 'vitest';
import {
  acceptToMediaType,
  assetMatchesMediaType,
  dedupeLibraryItems,
  filterLibraryItems,
  matchesAssetScope,
} from '../shared/hooks/useMediaSourcePicker';

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

  it('deduplicates repeated image assets that point to the same remote storage object', () => {
    const items = [
      {
        id: 'public-watch',
        type: 'image',
        url: 'https://project.supabase.co/storage/v1/object/public/game-media/users/42/images/watch-photo.webp?v=1',
        name: 'watch-photo.png',
      },
      {
        id: 'signed-watch',
        type: 'image',
        url: 'https://project.supabase.co/storage/v1/object/sign/game-media/users/42/images/watch-photo.webp?token=abc&expires=123',
        name: 'watch-photo.png',
      },
    ];

    expect(dedupeLibraryItems(items, 'image').map((asset) => asset.id)).toEqual(['public-watch']);
  });

  it('deduplicates repeated imported images when their filename and file signature match', () => {
    const items = [
      { id: 'photo-a', type: 'image', url: 'https://cdn.test/uploads/a.webp', name: 'photo.png', size: 2048, width: 800, height: 600 },
      { id: 'photo-b', type: 'image', url: 'https://cdn.test/uploads/b.webp', name: 'photo(1).png', size: 2048, width: 800, height: 600 },
      { id: 'photo-c', type: 'image', url: 'https://cdn.test/uploads/c.webp', name: 'photo.png', size: 4096, width: 800, height: 600 },
    ];

    expect(dedupeLibraryItems(items, 'image').map((asset) => asset.id)).toEqual(['photo-a', 'photo-c']);
  });

  it('deduplicates same-name remote image references like the standalone export', () => {
    const items = [
      { id: 'generated-a', type: 'image', url: 'https://cdn.test/generated/a.webp', name: 'ChatGPT Image.png' },
      { id: 'generated-b', type: 'image', url: 'https://cdn.test/generated/b.webp', name: 'ChatGPT Image.png' },
    ];

    expect(dedupeLibraryItems(items, 'image').map((asset) => asset.id)).toEqual(['generated-a']);
  });

  it('keeps same-name local images when no file signature can prove they are duplicates', () => {
    const items = [
      { id: 'generated-a', type: 'image', url: 'data:image/png;base64,AAAA', name: 'ChatGPT Image.png' },
      { id: 'generated-b', type: 'image', url: 'data:image/png;base64,BBBB', name: 'ChatGPT Image.png' },
    ];

    expect(dedupeLibraryItems(items, 'image').map((asset) => asset.id)).toEqual(['generated-a', 'generated-b']);
  });

  it('filters library items to the current project and requested media folder', () => {
    const items = [
      {
        id: 'asset_item_current',
        type: 'image',
        url: 'https://cdn.test/current-object.png',
        name: 'Current object',
        projectId: 'project-current',
        usedIn: ['item:key'],
      },
      {
        id: 'asset_scene_current_background',
        type: 'image',
        url: 'https://cdn.test/current-scene.png',
        name: 'Current scene',
        projectId: 'project-current',
        meta: { role: 'background' },
        usedIn: ['scène:hall'],
      },
      {
        id: 'asset_item_other',
        type: 'image',
        url: 'https://cdn.test/other-object.png',
        name: 'Other project object',
        projectId: 'project-other',
        usedIn: ['item:key'],
      },
    ];

    expect(filterLibraryItems(items, {
      assetScope: 'object-image',
      mediaType: 'image',
      projectId: 'project-current',
    }).map((asset) => asset.name)).toEqual(['Current object']);
  });

  it('keeps scene objects out of the scene background scope even when they reference a scene', () => {
    const items = [
      {
        id: 'asset_scene_object_image',
        type: 'image',
        url: 'https://cdn.test/object.png',
        name: 'Scene object',
        usedIn: ['scène:hall', 'sceneObject:door'],
      },
      {
        id: 'asset_scene_background',
        type: 'image',
        url: 'https://cdn.test/background.png',
        name: 'Background',
        meta: { role: 'background' },
        usedIn: ['scène:hall'],
      },
    ];

    expect(filterLibraryItems(items, {
      assetScope: 'scene-background',
      mediaType: 'image',
    }).map((asset) => asset.name)).toEqual(['Background']);
  });
});
