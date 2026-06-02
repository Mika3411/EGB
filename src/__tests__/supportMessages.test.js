import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSupportMessages = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  return import('../lib/supportMessages');
};

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllEnvs();
});

describe('support messages', () => {
  it('stores a local support thread and lists it for the user', async () => {
    const {
      createSupportTicket,
      getSupportCategoryLabel,
      loadUserSupportThreads,
    } = await loadSupportMessages();

    const user = { id: 'user-1', email: 'mika@example.com', name: 'Mika' };
    const thread = await createSupportTicket({
      category: 'suggestion',
      subject: 'Ajouter un raccourci',
      body: 'Ce serait utile dans le builder.',
      pageUrl: 'http://localhost/profile',
    }, user);

    expect(thread).toMatchObject({
      userId: 'user-1',
      userEmail: 'mika@example.com',
      userName: 'Mika',
      category: 'suggestion',
      subject: 'Ajouter un raccourci',
      status: 'open',
    });
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]).toMatchObject({
      authorRole: 'user',
      body: 'Ce serait utile dans le builder.',
    });
    expect(getSupportCategoryLabel(thread.category)).toBe('Suggestion');

    const userThreads = await loadUserSupportThreads(user);
    expect(userThreads).toHaveLength(1);
    expect(userThreads[0].id).toBe(thread.id);
  });

  it('keeps admin replies visible in the user profile thread', async () => {
    const {
      createSupportTicket,
      loadUserSupportThreads,
      replyToSupportThread,
      updateSupportThreadStatus,
    } = await loadSupportMessages();

    const user = { id: 'user-2', email: 'nina@example.com', name: 'Nina' };
    const admin = { id: 'admin-1', email: 'admin@example.com', name: 'Admin' };
    const thread = await createSupportTicket({
      category: 'problem',
      subject: 'Combat bloqué',
      body: 'Le bouton continuer ne répond pas.',
    }, user);

    const answered = await replyToSupportThread({
      threadId: thread.id,
      body: 'Je regarde le combat et je te réponds ici.',
    }, admin);
    expect(answered.status).toBe('answered');
    expect(answered.messages.at(-1)).toMatchObject({
      authorRole: 'admin',
      authorName: 'Support',
    });

    const closed = await updateSupportThreadStatus({ threadId: thread.id, status: 'closed' });
    expect(closed.status).toBe('closed');

    const userThreads = await loadUserSupportThreads(user);
    expect(userThreads[0].messages).toHaveLength(2);
    expect(userThreads[0].messages[1].body).toContain('Je regarde');
  });
});
