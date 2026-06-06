import { describe, expect, test } from 'vitest';
import {
  buildAuthorProfileUrl,
  buildPlayableProjectUrl,
  getAuthorProfileRouteSlug,
  getAuthorProfileSlugFromPath,
} from '../shared/utils/publicProjectLinks';

describe('public project links', () => {
  test('builds a unique public author profile URL', () => {
    expect(buildAuthorProfileUrl('creator-1', 'https://example.test/app?foo=bar#old', {
      displayName: 'Mickaël Studio',
    })).toBe(
      'https://example.test/creator/mickael-studio',
    );
  });

  test('adds a stable suffix when author slugs collide', () => {
    const peers = [
      { userId: 'creator-1', displayName: 'Mickaël' },
      { userId: 'creator-2', displayName: 'Mickael' },
    ];

    expect(getAuthorProfileRouteSlug(peers[0], peers)).toBe('mickael-creator-1');
    expect(getAuthorProfileRouteSlug(peers[1], peers)).toBe('mickael-creator-2');
  });

  test('reads public author profile slugs from clean paths', () => {
    expect(getAuthorProfileSlugFromPath('/creator/Micka%C3%ABl_Studio')).toBe('mickael-studio');
    expect(getAuthorProfileSlugFromPath('/gallery')).toBe('');
  });

  test('keeps playable project URLs focused on the player route', () => {
    expect(buildPlayableProjectUrl('user-1', 'project-1', 'https://example.test/app?gallery=1&creator=user-1')).toBe(
      'https://example.test/app?playUser=user-1&playProject=project-1',
    );
  });
});
