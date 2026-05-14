import { assertAiContentAllowed, makeImageModerationInput } from '../src/utils/aiModeration.js';
import { assertAiRateLimit, getClientIpFromHeaders } from '../src/utils/aiRateLimit.js';
import { assertProjectSafety, parseProjectJsonPayload } from '../src/utils/projectSafetyValidation.js';
import { imageDataToBlob, readJsonBody, sendJson } from './http.js';
import { shouldRunTextGenerationAsync } from './aiGenerationMode.js';
import {
  cleanupAiJobs,
  getAiJobCleanupIntervalMs,
  getAiJobMaxRuntimeMs,
  getAiJobTtlMs,
} from './aiJobStore.js';
import {
  aiCreditCosts,
  calculateImageCreditCost,
  calculateTextCreditCost,
  getCreditAccount,
  refundCredits,
  releaseImageCreditReservation,
  reserveImageCredits,
  resolveCreditUserId,
  spendCredits,
} from './credits.js';

const aiJobs = new Map();
const aiJobTtlMs = getAiJobTtlMs(process.env);
const aiJobMaxRuntimeMs = getAiJobMaxRuntimeMs(process.env);
const cleanupAiJobsNow = () => cleanupAiJobs(aiJobs, {
  ttlMs: aiJobTtlMs,
  maxRuntimeMs: aiJobMaxRuntimeMs,
});
const aiJobCleanupInterval = setInterval(cleanupAiJobsNow, getAiJobCleanupIntervalMs(aiJobTtlMs));
aiJobCleanupInterval.unref?.();

const defaultAiUpstreamTimeoutMs = 8 * 60 * 1000;

export const getAiUpstreamTimeoutMs = (env = process.env) => {
  const timeoutMs = Number(env.AI_UPSTREAM_TIMEOUT_MS || env.AI_FETCH_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : defaultAiUpstreamTimeoutMs;
};

const isAbortLikeError = (error) => ['AbortError', 'TimeoutError'].includes(error?.name);

const makeTimeoutSignal = (timeoutMs) => (
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
);

const fetchWithTimeout = async (url, options = {}, timeoutMs = getAiUpstreamTimeoutMs()) => {
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || makeTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    if (!isAbortLikeError(error)) throw error;

    const timeoutError = new Error('Delai depasse pour le service IA externe.');
    timeoutError.status = 504;
    timeoutError.code = 'AI_UPSTREAM_TIMEOUT';
    throw timeoutError;
  }
};

const openaiFetch = async (path, body) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY manquant.');
    error.status = 500;
    throw error;
  }

  const response = await fetchWithTimeout(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || `Erreur OpenAI ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const buildTextGenerationInput = (body = {}) => [
  'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
  body.prompt,
].filter(Boolean).join('\n\n');

const assertServerAiContentAllowed = (input, stage) => assertAiContentAllowed({
  input,
  openaiFetch,
  env: process.env,
  stage,
});

const assertServerAiRateLimit = (req, userId, kind = 'text') => assertAiRateLimit({
  kind,
  userId,
  ip: getClientIpFromHeaders(req?.headers || {}),
  env: process.env,
});

const extractOutputText = (payload) => {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
};

const makeAiJobId = () => `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getPublicCreditPayload = (account, cost) => ({
  balance: account.balance || 0,
  cost,
  costs: aiCreditCosts,
  nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
});

const runTextGeneration = async (body, userId, cost) => {
  const input = buildTextGenerationInput(body);

  let charged = false;
  try {
    await assertServerAiContentAllowed(input, 'input_text');
    spendCredits(userId, cost, `text:${body.mode || 'generate'}`);
    charged = cost > 0;

    const payload = await openaiFetch('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.2',
      input,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 30000),
    });

    const outputText = extractOutputText(payload);
    if (!outputText) {
      const error = new Error('OpenAI n\'a pas renvoye de texte exploitable.');
      error.status = 502;
      throw error;
    }
    await assertServerAiContentAllowed(outputText, 'output_text');
    if (body.responseFormat === 'escape-game-project-json') {
      try {
        const project = parseProjectJsonPayload(outputText);
        assertProjectSafety(project, { mode: 'ai' });
      } catch (validationError) {
        const error = new Error(validationError.message || 'OpenAI a renvoye un JSON invalide ou incomplet. Credits rembourses.');
        error.status = 502;
        error.code = validationError.code || 'AI_INVALID_JSON';
        throw error;
      }
    }

    const account = getCreditAccount(userId);
    return {
      output_text: outputText,
      requestId: payload.id,
      credits: getPublicCreditPayload(account, cost),
    };
  } catch (error) {
    if (charged) {
      refundCredits(userId, cost, `failed_text:${body.mode || 'generate'}`);
    }
    throw error;
  }
};

const startAiJob = (body, userId, cost) => {
  cleanupAiJobsNow();
  const jobId = makeAiJobId();
  aiJobs.set(jobId, {
    id: jobId,
    userId,
    status: 'pending',
    mode: body.mode || 'generate',
    cost,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  setTimeout(async () => {
    const runningJob = aiJobs.get(jobId) || {};
    aiJobs.set(jobId, {
      ...runningJob,
      status: 'running',
      updatedAt: new Date().toISOString(),
    });

    try {
      const result = await runTextGeneration(body, userId, cost);
      const latestJob = aiJobs.get(jobId) || {};
      if (latestJob.status === 'error' && latestJob.code === 'AI_JOB_TIMEOUT') return;
      aiJobs.set(jobId, {
        ...runningJob,
        ...result,
        id: jobId,
        userId,
        status: 'complete',
        mode: body.mode || 'generate',
        cost,
        updatedAt: new Date().toISOString(),
      });
      cleanupAiJobsNow();
    } catch (error) {
      const latestJob = aiJobs.get(jobId) || {};
      if (latestJob.status === 'error' && latestJob.code === 'AI_JOB_TIMEOUT') return;
      aiJobs.set(jobId, {
        ...runningJob,
        id: jobId,
        userId,
        status: 'error',
        mode: body.mode || 'generate',
        cost,
        error: error.message || 'Erreur IA.',
        code: error.code,
        balance: error.balance,
        required: error.required,
        updatedAt: new Date().toISOString(),
      });
      cleanupAiJobsNow();
    }
  }, 0);

  return aiJobs.get(jobId);
};

export const handleGenerate = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const cost = calculateTextCreditCost(body);
  assertServerAiRateLimit(req, userId, 'text');

  if (shouldRunTextGenerationAsync(body)) {
    const job = startAiJob(body, userId, cost);
    sendJson(res, 202, {
      jobId: job.id,
      status: job.status,
      message: 'Generation IA lancee en arriere-plan.',
      credits: { cost, costs: aiCreditCosts },
    });
    return;
  }

  const result = await runTextGeneration(body, userId, cost);
  sendJson(res, 200, result);
};

export const handleAiJob = async (req, res) => {
  cleanupAiJobsNow();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const jobId = String(url.searchParams.get('id') || '').trim();
  if (!jobId) {
    sendJson(res, 400, { error: 'Job IA manquant.' });
    return;
  }

  const job = aiJobs.get(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job IA introuvable.' });
    return;
  }

  const userId = await resolveCreditUserId(req, { userId: url.searchParams.get('userId') });
  if (job.userId && userId !== 'anonymous' && job.userId !== userId) {
    sendJson(res, 403, { error: 'Job IA refuse.' });
    return;
  }

  sendJson(res, 200, job);
};

export const handleImage = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  assertServerAiRateLimit(req, userId, 'image');
  await assertServerAiContentAllowed(String(body.prompt || ''), 'input_image');
  const reservation = reserveImageCredits(userId, body);
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
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    throw error;
  }

  const image = payload.data?.[0] || {};
  const imageData = image.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image.url;

  if (!imageData) {
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    const error = new Error('OpenAI n\'a pas renvoye d\'image.');
    error.status = 502;
    throw error;
  }

  let account;
  try {
    await assertServerAiContentAllowed(makeImageModerationInput(imageData, body.prompt), 'output_image');
    account = getCreditAccount(userId);
  } catch (error) {
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    throw error;
  }
  sendJson(res, 200, {
    imageData,
    imageName: `${body.type || 'image'}-${body.entity?.id || Date.now()}.png`,
    elements: [],
    credits: {
      balance: account.balance || 0,
      cost,
      costs: aiCreditCosts,
      nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
      nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    },
  });
};

export const handleRemoveBackground = async (req, res) => {
  const apiKey = process.env.REMOVE_BG_API_KEY || '';
  if (!apiKey) {
    sendJson(res, 500, { error: 'Cle remove.bg manquante cote serveur.' });
    return;
  }

  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const cost = Math.max(0, Math.round(Number(aiCreditCosts.removeBackground || 0)));
  if (!body.imageData) {
    sendJson(res, 400, { error: 'Image manquante.' });
    return;
  }

  let charged = false;
  let account = null;

  const formData = new FormData();
  formData.append('image_file', imageDataToBlob(body.imageData), 'image.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');

  try {
    account = spendCredits(userId, cost, 'remove_background:remove.bg');
    charged = cost > 0;

    const response = await fetchWithTimeout('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(errorText || `remove.bg a repondu ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageData = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    sendJson(res, 200, {
      imageData,
      credits: {
        balance: account?.balance || 0,
        cost,
        costs: aiCreditCosts,
      },
    });
  } catch (error) {
    if (charged) refundCredits(userId, cost, 'failed_remove_background:remove.bg');
    throw error;
  }
};
