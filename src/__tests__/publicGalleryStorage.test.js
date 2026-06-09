import { afterEach, describe, expect, it } from 'vitest';
import {
  commentPublicGame,
  getPublicGames,
  incrementPublicGamePlay,
  loadPublicProject,
  ratePublicGame,
  readPublicFeedback,
  readPublicStats,
} from '../shared/services/publicGalleryStorage';

const ACCOUNTS_KEY = 'escape_builder_accounts_v1';
const FEEDBACK_KEY = 'escapeGameBuilder.publicFeedback.v1';
const STATS_KEY = 'escapeGameBuilder.publicStats.v1';
const PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';

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

  it('serves the published snapshot while the editor draft keeps changing', async () => {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([
      { id: 'creator-1', name: 'Alice', email: 'alice@example.test' },
    ]));
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([
      {
        id: 'project-1',
        name: 'Nom brouillon',
        data: {
          title: 'Titre brouillon',
          description: 'Description modifiee dans l editeur',
          scenes: [{ id: 'scene-1', name: 'Scene brouillon' }],
          enigmas: [],
        },
        shareState: {
          isPublic: true,
          publishedAt: '2026-01-01T00:00:00.000Z',
          publishedData: {
            title: 'Titre publie',
            description: 'Description visible en galerie',
            scenes: [{ id: 'scene-1', name: 'Scene publiee' }],
            enigmas: [],
          },
        },
      },
    ]));

    await expect(loadPublicProject('creator-1', 'project-1')).resolves.toMatchObject({
      title: 'Titre publie',
      description: 'Description visible en galerie',
    });

    const games = await getPublicGames();
    const game = games.find((entry) => entry.userId === 'creator-1' && entry.projectId === 'project-1');
    expect(game).toMatchObject({
      title: 'Titre publie',
      description: 'Description visible en galerie',
    });
  });

  it('marks games published by professional accounts', async () => {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([
      { id: 'creator-pro', name: 'Pro Studio', email: 'pro@example.test', accountType: 'pro', country: 'France', city: 'Lyon' },
      { id: 'creator-personal', name: 'Bob', email: 'bob@example.test', accountType: 'particulier' },
    ]));
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-pro`, JSON.stringify([
      {
        id: 'project-pro',
        name: 'Mission pro',
        data: { title: 'Mission pro', scenes: [], enigmas: [] },
        shareState: {
          isPublic: true,
          publishedAt: '2026-01-01T00:00:00.000Z',
          publishedData: { title: 'Mission pro', scenes: [], enigmas: [] },
        },
      },
    ]));
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-personal`, JSON.stringify([
      {
        id: 'project-personal',
        name: 'Mission perso',
        data: { title: 'Mission perso', scenes: [], enigmas: [] },
        shareState: {
          isPublic: true,
          publishedAt: '2026-01-02T00:00:00.000Z',
          publishedData: { title: 'Mission perso', scenes: [], enigmas: [] },
        },
      },
    ]));

    const games = await getPublicGames();
    const proGame = games.find((entry) => entry.key === 'creator-pro:project-pro');
    const personalGame = games.find((entry) => entry.key === 'creator-personal:project-personal');

    expect(proGame).toMatchObject({
      accountType: 'pro',
      isProfessionalAuthor: true,
      authorCountry: 'France',
      authorCity: 'Lyon',
    });
    expect(personalGame).toMatchObject({
      accountType: 'particulier',
      isProfessionalAuthor: false,
    });
  });
});
