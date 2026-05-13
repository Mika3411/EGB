import { AsyncLocalStorage } from 'node:async_hooks';
import { makeCorsHeaders } from '../src/utils/corsConfig.js';

export const requestContext = new AsyncLocalStorage();
export const getActiveRequest = () => requestContext.getStore();
export const getJsonHeaders = (req = getActiveRequest()) => makeCorsHeaders(req?.headers || {}, process.env, {
  'Content-Type': 'application/json; charset=utf-8',
});

export const sendJson = (res, status, payload) => {
  res.writeHead(status, getJsonHeaders());
  res.end(JSON.stringify(payload));
};

export const readJsonBody = (req) => new Promise((resolveBody, rejectBody) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 20 * 1024 * 1024) {
      req.destroy();
      rejectBody(new Error('Payload trop volumineux.'));
    }
  });
  req.on('end', () => {
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
      rejectBody(new Error('Payload invalide.'));
    }
  });
  req.on('error', rejectBody);
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
