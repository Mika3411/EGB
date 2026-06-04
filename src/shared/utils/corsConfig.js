const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

const splitList = (value = '') => String(value || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

export const normalizeCorsOrigin = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/g, '');
  }
};

const isLocalCorsAllowed = (env = {}) => {
  if (String(env.CORS_ALLOW_LOCALHOST || '').toLowerCase() === 'false') return false;
  if (String(env.CORS_ALLOW_LOCALHOST || '').toLowerCase() === 'true') return true;
  return String(env.NODE_ENV || '').toLowerCase() !== 'production'
    && String(env.NETLIFY || '').toLowerCase() !== 'true';
};

const isLoopbackOrigin = (origin = '') => {
  try {
    const { hostname, protocol } = new URL(origin);
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return ['http:', 'https:'].includes(protocol)
      && (
        normalizedHostname === 'localhost'
        || normalizedHostname === '::1'
        || normalizedHostname.startsWith('127.')
      );
  } catch {
    return false;
  }
};

const isPrivateNetworkOrigin = (origin = '') => {
  try {
    const { hostname, protocol } = new URL(origin);
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!['http:', 'https:'].includes(protocol)) return false;
    if (normalizedHostname === 'localhost' || normalizedHostname === '::1' || normalizedHostname.startsWith('127.')) return true;
    if (normalizedHostname.startsWith('10.')) return true;
    if (normalizedHostname.startsWith('192.168.')) return true;
    const private172 = normalizedHostname.match(/^172\.(\d{1,2})\./);
    return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
  } catch {
    return false;
  }
};

export const getAllowedCorsOrigins = (env = {}) => {
  const explicitOrigins = [
    ...splitList(env.CORS_ALLOWED_ORIGINS),
    ...splitList(env.CORS_ORIGIN),
  ];
  const deploymentOrigins = [
    env.SITE_URL,
    env.VITE_SITE_URL,
    env.URL,
    env.DEPLOY_URL,
  ];
  const localOrigins = isLocalCorsAllowed(env) ? DEFAULT_LOCAL_ORIGINS : [];
  return [...new Set([...explicitOrigins, ...deploymentOrigins, ...localOrigins]
    .map(normalizeCorsOrigin)
    .filter(Boolean))];
};

export const getHeaderValue = (headers = {}, key = '') => {
  if (!headers || !key) return '';
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || '';
};

export const getRequestOrigin = (headers = {}) => normalizeCorsOrigin(getHeaderValue(headers, 'origin'));

export const isCorsOriginAllowed = (headers = {}, env = {}) => {
  const origin = getRequestOrigin(headers);
  if (!origin) return true;
  if (String(env.CORS_ALLOW_ANY_ORIGIN || '').toLowerCase() === 'true') return true;
  if (isLocalCorsAllowed(env) && isLoopbackOrigin(origin)) return true;
  if (isLocalCorsAllowed(env) && isPrivateNetworkOrigin(origin)) return true;
  return getAllowedCorsOrigins(env).includes(origin);
};

export const resolveCorsAllowOrigin = (headers = {}, env = {}) => {
  const origin = getRequestOrigin(headers);
  if (String(env.CORS_ALLOW_ANY_ORIGIN || '').toLowerCase() === 'true') return origin || '*';
  if (origin && isCorsOriginAllowed(headers, env)) return origin;
  if (origin) return '';
  return getAllowedCorsOrigins(env)[0] || '';
};

export const makeCorsHeaders = (headers = {}, env = {}, baseHeaders = {}) => {
  const allowOrigin = resolveCorsAllowOrigin(headers, env);
  const allowPrivateNetwork = isCorsOriginAllowed(headers, env)
    && String(getHeaderValue(headers, 'access-control-request-private-network') || '').toLowerCase() === 'true';
  return {
    ...baseHeaders,
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-AI-User-Id',
    ...(allowPrivateNetwork ? { 'Access-Control-Allow-Private-Network': 'true' } : {}),
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

export const assertCorsRequestAllowed = (headers = {}, env = {}) => {
  if (isCorsOriginAllowed(headers, env)) return;
  const origin = getRequestOrigin(headers);
  const error = new Error(`Origine CORS refusee${origin ? `: ${origin}` : ''}.`);
  error.statusCode = 403;
  error.status = 403;
  error.code = 'CORS_ORIGIN_FORBIDDEN';
  throw error;
};
