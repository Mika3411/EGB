import { afterEach, describe, expect, it } from 'vitest';
import { getAuthorProfile, saveAuthorProfile } from '../shared/services/authorProfiles';

const AUTHOR_PROFILES_KEY = 'escapeGameBuilder.authorProfiles.v1';

afterEach(() => {
  window.localStorage.clear();
});

describe('author profiles storage', () => {
  it('returns a normalized fallback profile when storage is malformed', () => {
    window.localStorage.setItem(AUTHOR_PROFILES_KEY, '{broken');

    expect(getAuthorProfile('user-1', { name: 'Alice' })).toMatchObject({
      displayName: 'Alice',
      tagline: '',
      bio: '',
      blogPosts: [],
    });
  });

  it('saves and reloads normalized profiles', () => {
    const saved = saveAuthorProfile('user-1', {
      displayName: 'Mika',
      tagline: 'Auteur',
      blogPosts: 'not-an-array',
    });

    expect(saved).toMatchObject({
      displayName: 'Mika',
      tagline: 'Auteur',
      blogPosts: [],
    });
    expect(getAuthorProfile('user-1')).toMatchObject({
      displayName: 'Mika',
      tagline: 'Auteur',
      blogPosts: [],
    });
  });
});
