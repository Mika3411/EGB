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
  writeAiJob,
} from './_shared.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const payload = parseBody(event);
  const body = payload.body || {};
  const jobId = String(payload.jobId || '').trim();
  if (!jobId) return json(400, { error: 'Job IA manquant.' });

  const supabase = getSupabaseAdminClient();
  const userId = getCreditUserId(event, body);
  const cost = calculateTextCreditCost(body);
  const input = [
    'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
    body.prompt,
  ].filter(Boolean).join('\n\n');

  let charged = false;
  try {
    await writeAiJob(supabase, {
      id: jobId,
      userId,
      status: 'running',
      mode: body.mode || 'generate',
      cost,
      createdAt: payload.createdAt || new Date().toISOString(),
    });

    await spendCredits(supabase, userId, cost, `text:${body.mode || 'generate'}`);
    charged = cost > 0;

    const openaiPayload = await openaiFetch('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.2',
      input,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 30000),
    });

    const outputText = extractOutputText(openaiPayload);
    if (!outputText) {
      const error = new Error("OpenAI n'a pas renvoye de texte exploitable.");
      error.statusCode = 502;
      throw error;
    }

    if (body.responseFormat === 'escape-game-project-json') {
      JSON.parse(outputText);
    }

    const account = await ensureCreditAccount(supabase, userId);
    await writeAiJob(supabase, {
      id: jobId,
      userId,
      status: 'complete',
      mode: body.mode || 'generate',
      output_text: outputText,
      requestId: openaiPayload.id,
      credits: {
        balance: Number(account.balance || 0),
        cost,
        costs: aiCreditCosts,
        nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
        nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
      },
      createdAt: payload.createdAt || new Date().toISOString(),
    });
  } catch (error) {
    if (charged) await refundCredits(supabase, userId, cost, `failed_text:${body.mode || 'generate'}`);
    await writeAiJob(supabase, {
      id: jobId,
      userId,
      status: 'error',
      mode: body.mode || 'generate',
      error: error.message || 'Erreur IA.',
      code: error.code,
      createdAt: payload.createdAt || new Date().toISOString(),
    });
  }

  return json(202, { ok: true, jobId });
};
