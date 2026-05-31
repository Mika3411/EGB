import { describe, expect, it, vi } from 'vitest';
import { isRetryableLazyImportError, retryLazyImport } from '../utils/lazyImportRetry';

describe('lazy import retry', () => {
  it('detects dynamic import load errors', () => {
    expect(isRetryableLazyImportError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isRetryableLazyImportError(new Error('ChunkLoadError: Loading chunk 9 failed.'))).toBe(true);
    expect(isRetryableLazyImportError(new Error('Erreur de rendu classique'))).toBe(false);
  });

  it('retries transient lazy import failures', async () => {
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: () => null });

    await expect(retryLazyImport(importer, { retries: 2, delayMs: 0 }))
      .resolves.toEqual({ default: expect.any(Function) });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('does not retry ordinary module errors', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('Syntax issue in component'));

    await expect(retryLazyImport(importer, { retries: 2, delayMs: 0 }))
      .rejects.toThrow('Syntax issue in component');
    expect(importer).toHaveBeenCalledTimes(1);
  });
});
