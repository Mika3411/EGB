const gumroadPacks = [
  {
    credits: Number(process.env.GUMROAD_PACK_100_CREDITS || 100),
    productId: process.env.GUMROAD_PACK_100_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_100_PERMALINK || 'BLFVPJ',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_250_CREDITS || 250),
    productId: process.env.GUMROAD_PACK_250_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_250_PERMALINK || 'lvnjan',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_500_CREDITS || 500),
    productId: process.env.GUMROAD_PACK_500_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_500_PERMALINK || 'ojrsxa',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_1000_CREDITS || 1000),
    productId: process.env.GUMROAD_PACK_1000_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_1000_PERMALINK || 'zyedcq',
  },
].filter((pack) => pack.credits > 0);

export const parseGumroadCustomFields = (body = {}) => {
  if (body.custom_fields && typeof body.custom_fields === 'object') return body.custom_fields;
  if (typeof body.custom_fields === 'string') {
    try {
      return JSON.parse(body.custom_fields);
    } catch {
      return {};
    }
  }

  return Object.fromEntries(Object.entries(body)
    .filter(([key]) => key.startsWith('custom_fields['))
    .map(([key, value]) => [key.match(/^custom_fields\[(.+)\]$/)?.[1] || key, value]));
};

export const getGumroadUserId = (body = {}) => {
  const customFields = parseGumroadCustomFields(body);
  return body.user_id
    || body.userId
    || body.purchase_id
    || body['url_params[user_id]']
    || body['url_params[purchase_id]']
    || customFields.user_id
    || customFields.userId
    || customFields['Identifiant achat']
    || customFields['identifiant achat']
    || getGumroadBuyerEmail(body)
    || '';
};

export const getGumroadBuyerEmail = (body = {}) => (
  String(body.email || body.email_address || body.buyer_email || '').trim().toLowerCase()
);

const normalizeGumroadPermalink = (value = '') => (
  String(value).trim().split('/').filter(Boolean).pop() || ''
);

export const getGumroadPack = (body = {}) => {
  const productId = String(body.product_id || '').trim();
  const permalink = normalizeGumroadPermalink(
    body.product_permalink || body.permalink || body.short_product_id,
  ).toLowerCase();
  const productName = String(body.product_name || body.product || '').toLowerCase();
  return gumroadPacks.find((pack) => (
    (pack.productId && pack.productId === productId)
    || (pack.permalink && pack.permalink.toLowerCase() === permalink)
    || (pack.permalink && productName.includes(pack.permalink.toLowerCase()))
    || (pack.credits && new RegExp(`\\bpack\\s+${pack.credits}\\b`, 'i').test(productName))
  ));
};
