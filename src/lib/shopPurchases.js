const SHOP_PURCHASES_KEY_PREFIX = 'escapeGameBuilder.shopPurchases';

const getShopPurchasesKey = (userId) => `${SHOP_PURCHASES_KEY_PREFIX}.${userId || 'anonymous'}`;

export const readShopPurchases = (userId) => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(getShopPurchasesKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
