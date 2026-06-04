import { afterEach, describe, expect, it } from 'vitest';
import { getShopPacks, saveShopPacks } from '../shared/services/shopPacksStorage';
import { readShopPurchases } from '../shared/services/shopPurchases';

const SHOP_PACKS_KEY = 'escapeGameBuilder.shopPacks.v1';
const SHOP_PURCHASES_KEY = 'escapeGameBuilder.shopPurchases.user-1';

afterEach(() => {
  window.localStorage.clear();
});

describe('shop storage helpers migration', () => {
  it('keeps normalizing shop packs after reading local storage', () => {
    window.localStorage.setItem(SHOP_PACKS_KEY, JSON.stringify([
      { id: 'pack-1', title: '  Pack test  ', costCredits: '12', screenshots: [{ src: 'cover.png' }, {}] },
    ]));

    expect(getShopPacks()).toEqual([
      expect.objectContaining({
        id: 'pack-1',
        title: 'Pack test',
        costCredits: 12,
        screenshots: [{ src: 'cover.png' }],
      }),
    ]);
  });

  it('persists shop packs through shared storage helpers', () => {
    const saved = saveShopPacks([{ id: 'pack-1', title: 'Pack test' }]);

    expect(saved).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(SHOP_PACKS_KEY))).toHaveLength(1);
  });

  it('keeps the shop purchases fallback as an empty array', () => {
    window.localStorage.setItem(SHOP_PURCHASES_KEY, '{broken');

    expect(readShopPurchases('user-1')).toEqual([]);
    window.localStorage.setItem(SHOP_PURCHASES_KEY, JSON.stringify({ invalid: true }));
    expect(readShopPurchases('user-1')).toEqual([]);
  });
});
