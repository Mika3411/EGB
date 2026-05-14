import { describe, expect, test } from 'vitest';
import { toPublicModerationAction } from '../../server/moderation.js';

describe('server moderation payload', () => {
  test('retire les champs internes du payload public', () => {
    expect(toPublicModerationAction({
      target_type: 'game',
      target_id: 'user-1:project-1',
      action: 'hidden',
      reason: 'internal note',
      created_at: '2026-05-13T20:00:00.000Z',
      updated_at: '2026-05-13T20:05:00.000Z',
    })).toEqual({
      target_type: 'game',
      target_id: 'user-1:project-1',
      action: 'hidden',
    });
  });
});
