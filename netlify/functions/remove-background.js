import {
  aiCreditCosts,
  getSupabaseAdminClient,
  json,
  parseBody,
  refundCredits,
  resolveCreditUserId,
  spendCredits,
  withErrors,
} from './_shared.js';

const imageDataToBlob = (imageData = '') => {
  const value = String(imageData);
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    const error = new Error('Image invalide.');
    error.statusCode = 400;
    throw error;
  }

  const mimeType = match[1] || 'image/png';
  const buffer = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]));
  return new Blob([buffer], { type: mimeType });
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const apiKey = process.env.REMOVE_BG_API_KEY || '';
  if (!apiKey) return json(500, { error: 'Cle remove.bg manquante cote serveur.' });

  const body = parseBody(event);
  const userId = await resolveCreditUserId(event);
  const cost = Math.max(0, Math.round(Number(aiCreditCosts.removeBackground || 0)));
  if (!body.imageData) return json(400, { error: 'Image manquante.' });

  const formData = new FormData();
  formData.append('image_file', imageDataToBlob(body.imageData), 'image.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');

  const supabase = getSupabaseAdminClient();
  let charged = false;
  let account = null;

  try {
    account = await spendCredits(supabase, userId, cost, 'remove_background:remove.bg');
    charged = cost > 0;

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(errorText || `remove.bg a repondu ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageData = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    return json(200, {
      imageData,
      credits: {
        balance: Number(account.balance || 0),
        cost,
        costs: aiCreditCosts,
      },
    });
  } catch (error) {
    if (charged) await refundCredits(supabase, userId, cost, 'failed_remove_background:remove.bg');
    throw error;
  }
});
