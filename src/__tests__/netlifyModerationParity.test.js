import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { toPublicModerationAction } from '../../netlify/functions/moderation.js';

describe('Netlify moderation parity', () => {
  test('routes admin moderation to the admin-only function', () => {
    const netlifyToml = readFileSync(join(process.cwd(), 'netlify.toml'), 'utf8');

    expect(netlifyToml).toMatch(/from = "\/api\/admin\/moderation"\s+to = "\/\.netlify\/functions\/admin-moderation"/);
    expect(netlifyToml).toMatch(/from = "\/api\/moderation"\s+to = "\/\.netlify\/functions\/moderation"/);
  });

  test('strips internal moderation fields from the public Netlify payload', () => {
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
