import React from 'react';

const DEFAULT_RETRIES = 2;
const DEFAULT_DELAY_MS = 250;

const RETRYABLE_IMPORT_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /chunkloaderror/i,
  /loading chunk \d+ failed/i,
  /networkerror/i,
  /load failed/i,
];

const delay = (milliseconds) => new Promise((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

const getErrorText = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return [error.name, error.message, error.stack].filter(Boolean).map(String).join('\n');
};

export function isRetryableLazyImportError(error) {
  const text = getErrorText(error);
  return RETRYABLE_IMPORT_PATTERNS.some((pattern) => pattern.test(text));
}

export async function retryLazyImport(importer, options = {}) {
  const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : DEFAULT_RETRIES;
  const delayMs = Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : DEFAULT_DELAY_MS;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableLazyImportError(error)) throw error;
      await delay(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}

export function lazyWithRetry(importer, options) {
  return React.lazy(() => retryLazyImport(importer, options));
}

export function preloadLazyImport(importer, options) {
  return retryLazyImport(importer, options).catch((error) => {
    console.warn('Préchargement de module impossible.', error);
    return null;
  });
}
