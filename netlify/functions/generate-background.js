import {
  aiCreditCosts,
  assertAiGeneratedTextAllowed,
  assertAiRequestRateLimit,
  assertAiTextPromptAllowed,
  buildTextGenerationInput,
  calculateImageCreditCost,
  calculateTextCreditCost,
  ensureCreditAccount,
  extractOutputText,
  getSupabaseAdminClient,
  json,
  openaiFetch,
  parseOpenAiProjectJson,
  parseBody,
  readAiJob,
  refundCredits,
  resolveCreditUserId,
  spendCredits,
  writeAiJob,
  withErrors,
} from './_shared.js';

const assertEntrypointRateLimitApplied = async (supabase, jobId, userId, rateLimitToken) => {
  if (!rateLimitToken) return false;

  const job = await readAiJob(supabase, jobId);
  if (job.userId !== userId || job.status !== 'pending' || job.rateLimitToken !== rateLimitToken) {
    const error = new Error('Jeton de generation IA asynchrone invalide.');
    error.statusCode = 403;
    error.code = 'AI_ASYNC_TOKEN_INVALID';
    throw error;
  }

  return true;
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const payload = parseBody(event);
  const body = payload.body || {};
  const jobId = String(payload.jobId || '').trim();
  if (!jobId) return json(400, { error: 'Job IA manquant.' });

  const supabase = getSupabaseAdminClient();
  const userId = await resolveCreditUserId(event);
  const cost = calculateTextCreditCost(body);
  const input = buildTextGenerationInput(body);
  const entrypointRateLimitApplied = await assertEntrypointRateLimitApplied(supabase, jobId, userId, payload.rateLimitToken);
  if (!entrypointRateLimitApplied) {
    await assertAiRequestRateLimit(event, userId, 'text', supabase);
  }

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

    await assertAiTextPromptAllowed(input);
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
    await assertAiGeneratedTextAllowed(outputText);

    if (body.responseFormat === 'escape-game-project-json') {
      parseOpenAiProjectJson(outputText);
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
});
