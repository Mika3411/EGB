import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  window.localStorage.clear();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('auth session account type refresh', () => {
  test('relit le type de compte frais depuis Supabase plutot que la session locale', async () => {
    const staleSessionUser = {
      id: 'user-1',
      email: 'player@example.com',
      app_metadata: {},
      user_metadata: { accountType: 'particulier' },
    };
    const freshUser = {
      ...staleSessionUser,
      user_metadata: { accountType: 'pro' },
    };
    const getSession = vi.fn(async () => ({
      data: { session: { user: staleSessionUser } },
      error: null,
    }));
    const getUser = vi.fn(async () => ({
      data: { user: freshUser },
      error: null,
    }));

    vi.doMock('../shared/storage/supabaseStorage', () => ({
      buildStoragePath: (...segments) => segments.filter(Boolean).join('/'),
      deleteStorageFile: vi.fn(),
      downloadTextFile: vi.fn(),
      getSupabaseClient: () => ({ auth: { getSession, getUser } }),
      hasSupabaseAuthConfig: () => true,
      hasSupabaseStorageConfig: () => false,
      isStorageNotFoundError: () => false,
      uploadToStorage: vi.fn(),
    }));

    const { getSessionUser } = await import('../shared/services/authStorage');
    const account = await getSessionUser();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(account).toMatchObject({
      id: 'user-1',
      accountType: 'pro',
    });
  });
});
