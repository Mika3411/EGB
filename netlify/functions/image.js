import {
  aiCreditCosts,
  calculateImageCreditCost,
  commitImageCreditUsage,
  ensureCreditAccount,
  getCreditUserId,
  getSupabaseAdminClient,
  json,
  openaiFetch,
  parseBody,
  refundCredits,
  spendCredits,
  withErrors,
} from './_shared.js';

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const userId = getCreditUserId(event, body);
  const supabase = getSupabaseAdminClient();
  const accountBeforeImage = await ensureCreditAccount(supabase, userId);
  const cost = calculateImageCreditCost(accountBeforeImage, body);

  await spendCredits(supabase, userId, cost, `image:${body.type || 'image'}`);

  let payload;
  try {
    const imageRequest = {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: body.prompt,
      size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
      quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
      n: 1,
    };

    if (body.type === 'item') {
      imageRequest.background = 'transparent';
      imageRequest.output_format = 'png';
      if (body.variant === 'thumbnail') {
        imageRequest.model = process.env.OPENAI_ITEM_THUMBNAIL_MODEL || 'gpt-image-1-mini';
        imageRequest.size = process.env.OPENAI_ITEM_THUMBNAIL_SIZE || '1024x1024';
        imageRequest.quality = process.env.OPENAI_ITEM_THUMBNAIL_QUALITY || 'low';
      }
    }

    payload = await openaiFetch('images/generations', imageRequest);
  } catch (error) {
    await refundCredits(supabase, userId, cost, `failed_image:${body.type || 'image'}`);
    throw error;
  }

  const image = payload.data?.[0] || {};
  const imageData = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url;
  if (!imageData) {
    await refundCredits(supabase, userId, cost, `failed_image:${body.type || 'image'}`);
    const error = new Error("OpenAI n'a pas renvoye d'image.");
    error.statusCode = 502;
    throw error;
  }

  let account;
  try {
    account = await commitImageCreditUsage(supabase, userId, body);
  } catch (error) {
    await refundCredits(supabase, userId, cost, `failed_image:${body.type || 'image'}`);
    throw error;
  }

  return json(200, {
    imageData,
    imageName: `${body.type || 'image'}-${body.entity?.id || Date.now()}.png`,
    elements: [],
    credits: {
      balance: Number(account.balance || 0),
      cost,
      costs: aiCreditCosts,
      nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
      nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    },
  });
});
