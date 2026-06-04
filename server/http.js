import { AsyncLocalStorage } from 'node:async_hooks';
import { makeCorsHeaders } from '../src/shared/utils/corsConfig.js';

export const requestContext = new AsyncLocalStorage();
export const getActiveRequest = () => requestContext.getStore();
export const getJsonHeaders = (req = getActiveRequest()) => makeCorsHeaders(req?.headers || {}, process.env, {
  'Content-Type': 'application/json; charset=utf-8',
});

export const sendJson = (res, status, payload) => {
  res.writeHead(status, getJsonHeaders());
  res.end(JSON.stringify(payload));
};

export const defaultJsonBodyLimitBytes = 20 * 1024 * 1024;

const makeHttpBodyError = (message, status, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

export const readJsonBody = (req, options = {}) => new Promise((resolveBody, rejectBody) => {
  const maxBytes = Number.isFinite(Number(options.maxBytes))
    ? Math.max(0, Number(options.maxBytes))
    : defaultJsonBodyLimitBytes;
  let raw = '';
  let settled = false;

  const rejectOnce = (error) => {
    if (settled) return;
    settled = true;
    rejectBody(error);
  };

  req.on('data', (chunk) => {
    if (settled) return;
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) {
      raw = '';
      req.resume?.();
      rejectOnce(makeHttpBodyError('Payload trop volumineux.', 413, 'PAYLOAD_TOO_LARGE'));
    }
  });
  req.on('end', () => {
    if (settled) return;
    settled = true;
    try {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!raw) {
        resolveBody({});
        return;
      }
      if (contentType.includes('application/x-www-form-urlencoded')) {
        resolveBody(Object.fromEntries(new URLSearchParams(raw)));
        return;
      }
      resolveBody(JSON.parse(raw));
    } catch {
      rejectBody(makeHttpBodyError('Payload invalide.', 400, 'PAYLOAD_INVALID'));
    }
  });
  req.on('error', rejectOnce);
});

export const imageDataToBlob = (imageData = '') => {
  const value = String(imageData);
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    const error = new Error('Image invalide.');
    error.status = 400;
    throw error;
  }

  const mimeType = match[1] || 'image/png';
  const buffer = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]));
  return new Blob([buffer], { type: mimeType });
};
