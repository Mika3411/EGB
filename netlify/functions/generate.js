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
  withErrors,
} from './_shared.js';

const makeJobId = () => `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const invokeBackgroundGeneration = async (event, jobId, body) => {
  const host = event.headers.host || event.headers.Host;
  const protocol = event.headers['x-forwarded-proto'] || 'https';
  const baseUrl = host ? `${protocol}://${host}` : process.env.URL;
  if (!baseUrl) {
    const error = new Error('URL Netlify introuvable pour lancer la generation asynchrone.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${baseUrl}/.netlify/functions/generate-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, body }),
  });

  if (!response.ok && response.status !== 202) {
    const error = new Error(`Impossible de lancer la generation asynchrone (${response.status}).`);
    error.statusCode = 502;
    throw error;
  }
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const userId = getCreditUserId(event, body);
  const cost = calculateTextCreditCost(body);
  const supabase = getSupabaseAdminClient();
  const shouldRunAsync = body.responseFormat === 'escape-game-project-json' && body.mode !== 'repair_item_names' && !body.runInline;
  if (shouldRunAsync) {
    const jobId = makeJobId();
    await writeAiJob(supabase, {
      id: jobId,
      userId,
      status: 'pending',
      mode: body.mode || 'generate',
      cost,
      createdAt: new Date().toISOString(),
    });
    await invokeBackgroundGeneration(event, jobId, body);
    return json(202, {
      jobId,
      status: 'pending',
      message: 'Generation IA lancee en arriere-plan.',
      credits: { cost, costs: aiCreditCosts },
    });
  }

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
