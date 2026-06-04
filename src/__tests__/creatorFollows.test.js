import { afterEach, describe, expect, it } from 'vitest';
import {
  followCreator,
  getCreatorFollowState,
  getCreatorLatestActivityAt,
  getFollowersForCreator,
  getUnreadFollowedCreatorActivity,
  isFollowingCreator,
  markFollowedCreatorActivitySeen,
  unfollowCreator,
} from '../shared/services/creatorFollows';

afterEach(() => {
  window.localStorage.clear();
});

const makeGame = (overrides = {}) => ({
  userId: 'creator-1',
  publishedAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '',
  createdAt: '',
  authorProfile: { blogPosts: [] },
  ...overrides,
});

describe('creator follows', () => {
  it('follows and unfollows creators per account', () => {
    followCreator('follower-1', 'creator-1', '2026-01-01T00:00:00.000Z');

    expect(isFollowingCreator('follower-1', 'creator-1')).toBe(true);
    expect(getFollowersForCreator('creator-1')).toEqual([{
      followerId: 'follower-1',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    }]);
    expect(getCreatorFollowState('follower-1')).toMatchObject({
      followedCreatorIds: ['creator-1'],
      lastSeenAtByCreator: {
        'creator-1': '2026-01-01T00:00:00.000Z',
      },
    });

    unfollowCreator('follower-1', 'creator-1');

    expect(isFollowingCreator('follower-1', 'creator-1')).toBe(false);
    expect(getCreatorFollowState('follower-1').followedCreatorIds).toEqual([]);
  });

  it('detects unread followed activity from games and author news', () => {
    followCreator('follower-1', 'creator-1', '2026-01-01T00:00:00.000Z');
    const games = [
      makeGame({
        publishedAt: '2026-01-02T10:00:00.000Z',
        authorProfile: {
          blogPosts: [{ id: 'post-1', title: 'Actu', body: 'Texte', createdAt: '2026-01-03T10:00:00.000Z' }],
        },
      }),
    ];

    expect(getCreatorLatestActivityAt(games, 'creator-1')).toBe('2026-01-03T10:00:00.000Z');
    expect(getUnreadFollowedCreatorActivity('follower-1', games)).toEqual([
      {
        creatorId: 'creator-1',
        latestAt: '2026-01-03T10:00:00.000Z',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
        unread: true,
      },
    ]);

    markFollowedCreatorActivitySeen('follower-1', games);

    expect(getUnreadFollowedCreatorActivity('follower-1', games)).toEqual([]);
    expect(getCreatorFollowState('follower-1').lastSeenAtByCreator['creator-1']).toBe('2026-01-03T10:00:00.000Z');
  });

  it('starts a new follow at the current creator activity so old content does not notify', () => {
    const games = [makeGame({ publishedAt: '2026-01-02T10:00:00.000Z' })];

    followCreator('follower-1', 'creator-1', getCreatorLatestActivityAt(games, 'creator-1'));

    expect(getUnreadFollowedCreatorActivity('follower-1', games)).toEqual([]);
  });
});
