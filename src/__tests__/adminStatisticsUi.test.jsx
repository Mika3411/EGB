import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const adminApiMocks = vi.hoisted(() => ({
  loadAdminDashboard: vi.fn(),
  prepareAdminShopPackScreenshots: vi.fn(async () => []),
  prepareAdminShopPackZip: vi.fn(),
  toggleStoredLocalAccountStatus: vi.fn(),
  updateAdminCredits: vi.fn(),
  updateAdminModeration: vi.fn(),
  updateAdminUser: vi.fn(),
}));

const supportMocks = vi.hoisted(() => ({
  loadAdminSupportThreads: vi.fn(),
  replyToSupportThread: vi.fn(),
  updateSupportThreadStatus: vi.fn(),
}));

vi.mock('../shared/ui/AccessibleDialog', () => ({
  showConfirm: vi.fn(async () => true),
}));

vi.mock('../shared/storage/supabaseStorage', () => ({
  buildStoragePath: (...segments) => segments.filter(Boolean).join('/'),
  generateStorageFilename: (filename) => filename,
  getSupabaseClient: () => null,
  getPublicStorageUploadResult: (path) => ({ path, publicUrl: '', visibility: 'public' }),
  hasSupabaseAuthConfig: () => false,
  hasSupabaseConfig: () => false,
  hasSupabaseStorageConfig: () => false,
  isStorageObjectAlreadyExistsError: () => false,
  uploadToStorage: vi.fn(),
}));

vi.mock('../shared/services/supportMessages', () => ({
  SUPPORT_STATUSES: [
    ['open', 'Ouvert'],
    ['answered', 'Répondu'],
    ['closed', 'Fermé'],
  ],
  getSupportCategoryLabel: (value) => value || 'Support',
  getSupportStatusLabel: (value) => value || 'Ouvert',
  loadAdminSupportThreads: supportMocks.loadAdminSupportThreads,
  replyToSupportThread: supportMocks.replyToSupportThread,
  updateSupportThreadStatus: supportMocks.updateSupportThreadStatus,
}));

vi.mock('../shared/services/shopPacksStorage', () => ({
  createEmptyShopPack: () => ({
    id: '',
    title: '',
    description: '',
    costCredits: 0,
    rating: 0,
    screenshots: [],
  }),
  archiveSharedShopPack: vi.fn(),
  deleteSharedShopPack: vi.fn(),
  getShopPacks: () => [],
  loadSharedShopPacks: vi.fn(async () => []),
  relistSharedShopPack: vi.fn(),
  upsertSharedShopPack: vi.fn(async () => []),
}));

vi.mock('../shared/services/adminApi', async () => {
  const actual = await vi.importActual('../shared/services/adminApi');
  return {
    ...actual,
    canUseRemoteAdminApi: () => false,
    loadAdminDashboard: adminApiMocks.loadAdminDashboard,
    prepareAdminShopPackScreenshots: adminApiMocks.prepareAdminShopPackScreenshots,
    prepareAdminShopPackZip: adminApiMocks.prepareAdminShopPackZip,
    toggleStoredLocalAccountStatus: adminApiMocks.toggleStoredLocalAccountStatus,
    updateAdminCredits: adminApiMocks.updateAdminCredits,
    updateAdminModeration: adminApiMocks.updateAdminModeration,
    updateAdminUser: adminApiMocks.updateAdminUser,
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('admin statistics tab', () => {
  it('renders the statistics overview from admin data', async () => {
    const now = Date.now();
    adminApiMocks.loadAdminDashboard.mockResolvedValue({
      accounts: [
        {
          id: 'user-1',
          name: 'Alice Demo',
          email: 'alice@example.com',
          provider: 'local',
          status: 'active',
          createdAt: new Date(now - 2 * 86400000).toISOString(),
          lastLoginAt: new Date(now - 3 * 3600000).toISOString(),
        },
        {
          id: 'user-2',
          name: 'Bruno Demo',
          email: 'bruno@example.com',
          provider: 'local',
          status: 'disabled',
          createdAt: new Date(now - 40 * 86400000).toISOString(),
          lastLoginAt: new Date(now - 8 * 86400000).toISOString(),
        },
      ],
      supabaseUsers: [],
      creditUsers: [
        { userId: 'user-1', balance: 15, transactions: [{ amount: -5 }] },
      ],
      projectCounts: {},
      publicGames: [
        { key: 'user-1:project-1', userId: 'user-1', plays: 7, feedback: { votes: 2, comments: [] } },
      ],
      visitorAnalytics: {
        builder: { visitors: 12, visitors24h: 2 },
        gallery: { visitors: 34, visitors24h: 5 },
      },
      moderation: { games: new Set(), blogs: new Set(), comments: new Set(), actions: [] },
    });
    supportMocks.loadAdminSupportThreads.mockResolvedValue([
      { id: 'support-1', status: 'open', messages: [{ authorRole: 'user' }] },
    ]);
    window.localStorage.setItem('escapeGameBuilder.projects.user-1', JSON.stringify([{ id: 'project-1' }]));

    const { default: AdminConsole } = await import('../domains/admin/AdminConsole.jsx');
    render(<AdminConsole user={{ id: 'admin', email: 'admin@example.com' }} onBack={vi.fn()} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Statistiques' }));

    await waitFor(() => {
      expect(screen.getByText('Connexions uniques')).toBeTruthy();
      expect(screen.getByText('Dernières connexions')).toBeTruthy();
      expect(screen.getByText('Alice Demo')).toBeTruthy();
      expect(screen.getByText('Parties jouées')).toBeTruthy();
      expect(screen.getByText(/visiteurs builder/)).toBeTruthy();
      expect(screen.getByText(/visiteurs galerie/)).toBeTruthy();
      expect(screen.getByText('Support ouvert')).toBeTruthy();
    });
  }, 10000);
});
