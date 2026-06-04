import { readJsonStorage } from '../utils/storageHelpers';

const SHOP_PURCHASES_KEY_PREFIX = 'escapeGameBuilder.shopPurchases';

const getShopPurchasesKey = (userId) => `${SHOP_PURCHASES_KEY_PREFIX}.${userId || 'anonymous'}`;

export const readShopPurchases = (userId) => {
  const parsed = readJsonStorage(getShopPurchasesKey(userId), []);
  return Array.isArray(parsed) ? parsed : [];
};
