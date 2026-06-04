import { afterEach, describe, expect, test, vi } from 'vitest';

const loadAuthStorage = async (env = {}) => {
  vi.resetModules();
  vi.stubEnv('VITE_ADMIN_EMAIL', '');
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../shared/services/authStorage');
};

const loadShared = async (env = {}) => {
  vi.resetModules();
  vi.stubEnv('ADMIN_EMAIL', '');
  vi.stubEnv('VITE_ADMIN_EMAIL', '');
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../netlify/functions/_shared.js');
};

const loadServerAuth = async (env = {}) => {
  vi.resetModules();
  vi.stubEnv('ADMIN_EMAIL', '');
  vi.stubEnv('VITE_ADMIN_EMAIL', '');
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../server/auth.js');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin authorization', () => {
  test('le client ne promeut pas un email sans configuration explicite', async () => {
    const { isAdminAccount, supabaseUserToAccount } = await loadAuthStorage();

    const account = supabaseUserToAccount({
      id: 'user-1',
      email: 'admin@example.com',
      app_metadata: {},
      user_metadata: {},
    });

    expect(isAdminAccount(account)).toBe(false);
  });

  test('le client accepte les roles Supabase admin', async () => {
    const { isAdminAccount, supabaseUserToAccount } = await loadAuthStorage();

    const account = supabaseUserToAccount({
      id: 'user-1',
      email: 'player@example.com',
      app_metadata: { roles: ['admin'] },
      user_metadata: {},
    });

    expect(isAdminAccount(account)).toBe(true);
  });

  test('le client refuse user_metadata et le fallback email pour les comptes Supabase', async () => {
    const { isAdminAccount, supabaseUserToAccount } = await loadAuthStorage({
      VITE_ADMIN_EMAIL: 'admin@example.com',
    });

    const metadataAccount = supabaseUserToAccount({
      id: 'user-1',
      email: 'player@example.com',
      app_metadata: {},
      user_metadata: {
        isAdmin: true,
        is_admin: true,
        role: 'admin',
        roles: ['admin'],
      },
    });
    const emailAccount = supabaseUserToAccount({
      id: 'user-1',
      email: 'admin@example.com',
      app_metadata: {},
      user_metadata: {},
    });

    expect(isAdminAccount(metadataAccount)).toBe(false);
    expect(isAdminAccount(emailAccount)).toBe(false);
  });

  test('les fonctions serveur acceptent seulement app_metadata pour Supabase', async () => {
    const noEmailFallback = await loadShared();
    expect(noEmailFallback.ADMIN_EMAIL).toBe('');
    expect(noEmailFallback.isAdminUser({
      email: 'admin@example.com',
      app_metadata: {},
      user_metadata: {},
    })).toBe(false);
    expect(noEmailFallback.isAdminUser({
      email: 'player@example.com',
      app_metadata: { role: 'admin' },
      user_metadata: {},
    })).toBe(true);
    expect(noEmailFallback.isAdminUser({
      email: 'player@example.com',
      app_metadata: {},
      user_metadata: {
        isAdmin: true,
        is_admin: true,
        role: 'admin',
        roles: ['admin'],
      },
    })).toBe(false);

    const withEmailFallback = await loadShared({ ADMIN_EMAIL: 'admin@example.com' });
    expect(withEmailFallback.ADMIN_EMAIL).toBe('admin@example.com');
    expect(withEmailFallback.isAdminUser({
      email: 'admin@example.com',
      app_metadata: {},
      user_metadata: {},
    })).toBe(false);
  });

  test('les helpers auth extraits du serveur gardent la meme autorisation admin', async () => {
    const serverAuth = await loadServerAuth({ ADMIN_EMAIL: 'admin@example.com' });

    expect(serverAuth.isAdminUser({
      email: 'player@example.com',
      app_metadata: { roles: ['admin'] },
      user_metadata: {},
    })).toBe(true);
    expect(serverAuth.isAdminUser({
      email: 'admin@example.com',
      app_metadata: {},
      user_metadata: {},
    })).toBe(false);
    expect(serverAuth.isAdminUser({
      email: 'player@example.com',
      app_metadata: {},
      user_metadata: { roles: ['admin'], is_admin: true },
    })).toBe(false);
  });
});
