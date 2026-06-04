import { afterEach, describe, expect, it } from 'vitest';
import { getAuthorProfile, saveAuthorProfile, toggleAuthorBlogPostLike } from '../shared/services/authorProfiles';

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

  it('normalizes legacy stored profiles without media or social links', () => {
    window.localStorage.setItem(AUTHOR_PROFILES_KEY, JSON.stringify({
      'legacy-user': {
        displayName: 'Ancien auteur',
        tagline: 'Profil avant médias',
        bio: 'Bio existante',
        website: 'https://legacy.example.test',
        blogPosts: [{ id: 'post-1', title: 'Actu', body: 'Texte' }],
      },
    }));

    const profile = getAuthorProfile('legacy-user');

    expect(profile).toMatchObject({
      displayName: 'Ancien auteur',
      tagline: 'Profil avant médias',
      bio: 'Bio existante',
      website: 'https://legacy.example.test',
      avatar: '',
      banner: '',
      blogPosts: [{ id: 'post-1', title: 'Actu', body: 'Texte' }],
    });
    expect(profile.blogPosts[0]).toMatchObject({
      likes: 0,
      likedBy: [],
    });
    expect(profile.socialLinks).toEqual(expect.arrayContaining([
      { type: 'site', url: 'https://legacy.example.test' },
      { type: 'instagram', url: '' },
      { type: 'youtube', url: '' },
      { type: 'tiktok', url: '' },
      { type: 'discord', url: '' },
      { type: 'x-twitter', url: '' },
      { type: 'linkedin', url: '' },
    ]));
  });

  it('saves and reloads normalized profiles', () => {
    const saved = saveAuthorProfile('user-1', {
      displayName: 'Mika',
      tagline: 'Auteur',
      website: 'https://legacy.example.test',
      avatar: 'https://cdn.example.test/mika.png',
      banner: 'https://cdn.example.test/mika-banner.png',
      socialLinks: [
        { type: 'site', url: 'https://mika.example.test' },
        { type: 'instagram', url: 'https://instagram.example.test/mika' },
      ],
      blogPosts: 'not-an-array',
    });

    expect(saved).toMatchObject({
      displayName: 'Mika',
      tagline: 'Auteur',
      website: 'https://mika.example.test',
      avatar: 'https://cdn.example.test/mika.png',
      banner: 'https://cdn.example.test/mika-banner.png',
      blogPosts: [],
    });
    expect(getAuthorProfile('user-1')).toMatchObject({
      displayName: 'Mika',
      tagline: 'Auteur',
      website: 'https://mika.example.test',
      avatar: 'https://cdn.example.test/mika.png',
      banner: 'https://cdn.example.test/mika-banner.png',
      blogPosts: [],
    });
    expect(saved.socialLinks).toEqual(expect.arrayContaining([
      { type: 'site', url: 'https://mika.example.test' },
      { type: 'instagram', url: 'https://instagram.example.test/mika' },
      { type: 'youtube', url: '' },
    ]));
  });

  it('keeps legacy website as the site social link', () => {
    expect(saveAuthorProfile('user-1', {
      displayName: 'Mika',
      website: 'https://legacy.example.test',
    })).toMatchObject({
      website: 'https://legacy.example.test',
      socialLinks: expect.arrayContaining([
        { type: 'site', url: 'https://legacy.example.test' },
      ]),
    });
  });

  it('normalizes new media fields and social link aliases safely', () => {
    const saved = saveAuthorProfile('user-1', {
      displayName: 'Mika',
      avatar: '  https://cdn.example.test/avatar.png  ',
      banner: '  data:image/png;base64,banner  ',
      socialLinks: [
        { type: 'twitter', url: '  https://x.example.test/mika  ' },
        { type: 'unknown', url: 'https://ignored.example.test' },
        { type: 'discord', url: 42 },
      ],
    });

    expect(saved).toMatchObject({
      avatar: 'https://cdn.example.test/avatar.png',
      banner: 'data:image/png;base64,banner',
      website: '',
    });
    expect(saved.socialLinks).toEqual(expect.arrayContaining([
      { type: 'x-twitter', url: 'https://x.example.test/mika' },
      { type: 'discord', url: '42' },
    ]));
    expect(saved.socialLinks.find((link) => link.type === 'unknown')).toBeUndefined();
  });

  it('toggles likes on author news while keeping legacy posts valid', () => {
    saveAuthorProfile('user-1', {
      displayName: 'Mika',
      blogPosts: [{ id: 'post-1', title: 'Actu', body: 'Texte' }],
    });

    const liked = toggleAuthorBlogPostLike('user-1', 'post-1', 'visitor-1');
    expect(liked).toMatchObject({
      liked: true,
      post: {
        id: 'post-1',
        likes: 1,
        likedBy: ['visitor-1'],
      },
    });
    expect(getAuthorProfile('user-1').blogPosts[0]).toMatchObject({
      likes: 1,
      likedBy: ['visitor-1'],
    });

    const unliked = toggleAuthorBlogPostLike('user-1', 'post-1', 'visitor-1');
    expect(unliked).toMatchObject({
      liked: false,
      post: {
        id: 'post-1',
        likes: 0,
        likedBy: [],
      },
    });
  });

  it('normalizes malformed author news likes', () => {
    const saved = saveAuthorProfile('user-1', {
      displayName: 'Mika',
      blogPosts: [{
        id: 'post-1',
        title: 'Actu',
        body: 'Texte',
        likes: 'beaucoup',
        likedBy: ['visitor-1', 'visitor-1', ''],
      }],
    });

    expect(saved.blogPosts[0]).toMatchObject({
      likes: 1,
      likedBy: ['visitor-1'],
    });
  });
});
