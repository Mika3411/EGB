import {
  aiCreditCosts,
  calculateImageCreditCost,
  calculateTextCreditCost,
  ensureCreditAccount,
  extractOutputText,
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
  const cost = calculateTextCreditCost(body);
  const supabase = getSupabaseAdminClient();
  const input = [
    'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
    body.prompt,
  ].filter(Boolean).join('\n\n');

  let charged = false;
  try {
    await spendCredits(supabase, userId, cost, `text:${body.mode || 'generate'}`);
    charged = cost > 0;

    const payload = await openaiFetch('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.2',
      input,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 30000),
    });

    const outputText = extractOutputText(payload);
    if (!outputText) {
      const error = new Error("OpenAI n'a pas renvoye de texte exploitable.");
      error.statusCode = 502;
      throw error;
    }

    if (body.responseFormat === 'escape-game-project-json') {
      try {
        JSON.parse(outputText);
      } catch {
        const error = new Error('OpenAI a renvoye un JSON invalide ou incomplet. Credits rembourses.');
        error.statusCode = 502;
        error.code = 'AI_INVALID_JSON';
        throw error;
      }
    }

    const account = await ensureCreditAccount(supabase, userId);
    return json(200, {
      output_text: outputText,
      requestId: payload.id,
      credits: {
        balance: Number(account.balance || 0),
        cost,
        costs: aiCreditCosts,
        nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
        nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
      },
    });
  } catch (error) {
    if (charged) await refundCredits(supabase, userId, cost, `failed_text:${body.mode || 'generate'}`);
    throw error;
  }
});
