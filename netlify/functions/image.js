import {
  aiCreditCosts,
  assertAiGeneratedImageAllowed,
  assertAiImagePromptAllowed,
  assertAiRequestRateLimit,
  calculateImageCreditCost,
  ensureCreditAccount,
  getSupabaseAdminClient,
  json,
  openaiFetch,
  parseBody,
  releaseImageCreditReservation,
  resolveCreditUserId,
  reserveImageCredits,
  withErrors,
} from './_shared.js';

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const userId = await resolveCreditUserId(event);
  const supabase = getSupabaseAdminClient();

  await assertAiRequestRateLimit(event, userId, 'image', supabase);
  await assertAiImagePromptAllowed(body.prompt);
  const reservation = await reserveImageCredits(supabase, userId, body);
  const cost = reservation.cost;

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
    await releaseImageCreditReservation(supabase, userId, reservation, `failed_image:${body.type || 'image'}`).catch(() => null);
    throw error;
  }

  const image = payload.data?.[0] || {};
  const imageData = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url;
  if (!imageData) {
    await releaseImageCreditReservation(supabase, userId, reservation, `failed_image:${body.type || 'image'}`).catch(() => null);
    const error = new Error("OpenAI n'a pas renvoye d'image.");
    error.statusCode = 502;
    throw error;
  }

  let account;
  try {
    await assertAiGeneratedImageAllowed(imageData, body.prompt);
    account = await ensureCreditAccount(supabase, userId);
  } catch (error) {
    await releaseImageCreditReservation(supabase, userId, reservation, `failed_image:${body.type || 'image'}`).catch(() => null);
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
