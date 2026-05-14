import { describe, expect, test } from 'vitest';
import { isLocalCreditAuthAllowed } from '../../server/credits.js';

describe('server credit auth', () => {
  test('n autorise le fallback local que sur opt-in explicite', () => {
    expect(isLocalCreditAuthAllowed({})).toBe(false);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'false' })).toBe(false);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'true' })).toBe(true);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: '1' })).toBe(true);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'yes' })).toBe(true);
  });
});
