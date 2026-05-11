import { afterEach, describe, expect, it } from 'vitest';
import {
  commentPublicGame,
  incrementPublicGamePlay,
  ratePublicGame,
  readPublicFeedback,
  readPublicStats,
} from '../lib/publicGalleryStorage';

const FEEDBACK_KEY = 'escapeGameBuilder.publicFeedback.v1';
const STATS_KEY = 'escapeGameBuilder.publicStats.v1';

afterEach(() => {
  window.localStorage.clear();
});

describe('public gallery storage', () => {
  it('falls back when stored feedback or stats JSON is malformed', () => {
    window.localStorage.setItem(FEEDBACK_KEY, '{broken');
    window.localStorage.setItem(STATS_KEY, '{broken');

    expect(readPublicFeedback()).toEqual({});
    expect(readPublicStats()).toEqual({});
  });

  it('persists feedback and play stats through shared storage helpers', () => {
    const ratingSummary = ratePublicGame({ gameKey: 'user-1:project-1', userId: 'player-1', rating: 4 });
    const commentSummary = commentPublicGame({
      gameKey: 'user-1:project-1',
      userId: 'player-1',
      authorName: 'Alice',
      text: 'Super ambiance',
    });
    incrementPublicGamePlay('user-1:project-1');

    expect(ratingSummary.votes).toBe(1);
    expect(commentSummary.comments).toHaveLength(1);
    expect(readPublicFeedback()['user-1:project-1']).toMatchObject({
      ratings: [{ userId: 'player-1', gameKey: 'user-1:project-1', rating: 4 }],
    });
    expect(readPublicStats()['user-1:project-1']).toMatchObject({
      plays: 1,
    });
  });
});
