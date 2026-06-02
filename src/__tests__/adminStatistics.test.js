import { describe, expect, it } from 'vitest';
import { buildAdminStatistics } from '../lib/adminApi';

describe('admin statistics', () => {
  it('builds the admin overview from known account and activity data', () => {
    const now = new Date('2026-06-02T12:00:00.000Z').getTime();
    const hours = (value) => value * 60 * 60 * 1000;
    const days = (value) => value * 24 * 60 * 60 * 1000;
    const isoAgo = (milliseconds) => new Date(now - milliseconds).toISOString();

    const stats = buildAdminStatistics({
      now,
      managedUsers: [
        {
          userId: 'u1',
          provider: 'supabase',
          status: 'active',
          email: 'a@example.com',
          createdAt: isoAgo(days(10)),
          lastSignInAt: isoAgo(hours(2)),
          projects: [{ id: 'p1' }, { id: 'p2' }],
        },
        {
          userId: 'u2',
          provider: 'supabase',
          status: 'disabled',
          email: 'b@example.com',
          createdAt: isoAgo(days(2)),
          lastSignInAt: isoAgo(days(3)),
          projectCount: 1,
        },
        {
          userId: 'u3',
          provider: 'local',
          status: 'active',
          email: 'c@example.com',
          createdAt: isoAgo(days(40)),
          updatedAt: isoAgo(days(20)),
        },
        {
          userId: 'u4',
          provider: 'credits',
          status: 'active',
        },
      ],
      creditUsers: [
        { userId: 'u1', balance: 12, transactions: [{ amount: -2 }, { amount: 10 }] },
        { userId: 'u4', balance: 8 },
      ],
      publicGames: [
        { userId: 'u1', plays: 5, feedback: { votes: 2, comments: [{ id: 'c1' }] } },
        { userId: 'u2', plays: 3, feedback: { votes: 0, comments: [] } },
      ],
      moderation: { actions: [{ id: 'hide-1' }] },
      supportThreads: [
        { id: 's1', status: 'open', messages: [{ authorRole: 'user' }] },
        { id: 's2', status: 'answered', messages: [{ authorRole: 'admin' }] },
        { id: 's3', status: 'closed', messages: [{ authorRole: 'user' }] },
      ],
    });

    expect(stats).toMatchObject({
      totalUsers: 4,
      activeUsers: 3,
      disabledUsers: 1,
      uniqueConnections: 3,
      connectedLast24Hours: 1,
      connectedLast7Days: 2,
      connectedLast30Days: 3,
      neverConnectedUsers: 1,
      newUsersLast30Days: 2,
      totalProjectCount: 3,
      usersWithProjects: 2,
      publicGameCount: 2,
      publicAuthorCount: 2,
      totalPlays: 8,
      totalVotes: 2,
      totalComments: 1,
      totalCreditBalance: 20,
      creditAccountCount: 2,
      recentCreditTransactions: 2,
      moderationActions: 1,
      supportOpen: 2,
      supportWaitingReply: 1,
      supportClosed: 1,
    });
    expect(stats.recentConnections.map((entry) => entry.userId)).toEqual(['u1', 'u2', 'u3']);
  });
});
