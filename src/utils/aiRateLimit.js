const buckets = new Map();

const numberFromEnv = (env, key, fallback) => {
  const value = Number(env?.[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const sanitizeIdentity = (value = '') => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_.:@-]/g, '-')
  .slice(0, 160);

export const getClientIpFromHeaders = (headers = {}) => {
  const raw = headers['x-forwarded-for']
    || headers['X-Forwarded-For']
    || headers['client-ip']
    || headers['Client-Ip']
    || headers['x-real-ip']
    || headers['X-Real-Ip']
    || '';
  return sanitizeIdentity(String(raw).split(',')[0] || 'unknown') || 'unknown';
};

export const getAiRateLimitConfig = (env = {}, kind = 'text') => {
  const normalizedKind = kind === 'image' ? 'IMAGE' : 'TEXT';
  return {
    disabled: String(env.AI_RATE_LIMIT_DISABLED || '').toLowerCase() === 'true',
    windowMs: numberFromEnv(env, 'AI_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    userLimit: numberFromEnv(env, `AI_${normalizedKind}_RATE_LIMIT_USER_PER_WINDOW`, kind === 'image' ? 6 : 20),
    ipLimit: numberFromEnv(env, `AI_${normalizedKind}_RATE_LIMIT_IP_PER_WINDOW`, kind === 'image' ? 20 : 60),
  };
};

const planBucketConsumption = (key, limit, windowMs, now) => {
  const cutoff = now - windowMs;
  const previous = buckets.get(key) || [];
  const entries = previous.filter((timestamp) => timestamp > cutoff);
  if (entries.length >= limit) {
    const retryAfterMs = Math.max(1000, windowMs - (now - entries[0]));
    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
    };
  }
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, limit - entries.length - 1),
    nextEntries: [...entries, now],
  };
};

export const resetAiRateLimitBuckets = () => buckets.clear();

export const assertAiRateLimit = ({
  kind = 'text',
  userId = '',
  ip = '',
  env = {},
  now = Date.now(),
} = {}) => {
  const config = getAiRateLimitConfig(env, kind);
  if (config.disabled) return { ok: true, skipped: true };

  const identities = [
    ['user', sanitizeIdentity(userId || 'anonymous'), config.userLimit],
    ['ip', sanitizeIdentity(ip || 'unknown'), config.ipLimit],
  ].filter(([, identity]) => Boolean(identity));

  let tightest = { remaining: Number.POSITIVE_INFINITY };
  const consumptions = [];
  for (const [scope, identity, limit] of identities) {
    const key = `ai:${kind}:${scope}:${identity}`;
    const result = planBucketConsumption(key, limit, config.windowMs, now);
    if (!result.allowed) {
      const error = new Error('Trop de requetes IA. Reessaie dans un instant.');
      error.statusCode = 429;
      error.status = 429;
      error.code = 'AI_RATE_LIMITED';
      error.retryAfter = Math.ceil(result.retryAfterMs / 1000);
      error.scope = scope;
      throw error;
    }
    consumptions.push([key, result.nextEntries]);
    if (result.remaining < tightest.remaining) tightest = result;
  }

  for (const [key, nextEntries] of consumptions) buckets.set(key, nextEntries);

  return {
    ok: true,
    remaining: Number.isFinite(tightest.remaining) ? tightest.remaining : 0,
  };
};
