import { describe, expect, test } from 'vitest';
import {
  getGumroadBuyerEmail,
  getGumroadPack,
  getGumroadUserId,
} from '../../server/creditsGumroad.js';

describe('Gumroad payload helpers', () => {
  test('reads user ids from Gumroad url params', () => {
    expect(getGumroadUserId({
      'url_params[user_id]': 'user-123',
      email: 'buyer@example.com',
    })).toBe('user-123');
  });

  test('normalizes buyer email aliases', () => {
    expect(getGumroadBuyerEmail({ buyer_email: ' BUYER@EXAMPLE.COM ' })).toBe('buyer@example.com');
  });

  test('matches packs from short product ids', () => {
    expect(getGumroadPack({ short_product_id: 'BLFVPJ' })?.credits).toBe(100);
  });
});
