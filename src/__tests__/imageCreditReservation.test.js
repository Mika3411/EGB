import { describe, expect, it } from 'vitest';
import { releaseImageCreditReservation } from '../../netlify/functions/_shared.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeSupabaseStub = ({ account, transactions = [] }) => {
  const state = {
    account: { ...account },
    transactions: [...transactions],
  };

  const makeQuery = (table, operation = 'select', payload = null) => {
    const filters = [];
    const query = {
      select: () => query,
      eq: (column, value) => {
        filters.push([column, value]);
        return query;
      },
      limit: () => query,
      maybeSingle: async () => runQuery(false),
      single: async () => runQuery(true),
    };

    const matches = (row) => filters.every(([column, value]) => row?.[column] === value);

    const runQuery = async () => {
      if (table === 'ai_credits') {
        if (operation === 'update') {
          if (!matches(state.account)) return { data: null, error: null };
          state.account = { ...state.account, ...payload };
        }
        return { data: clone(state.account), error: null };
      }

      if (table === 'ai_credit_transactions') {
        const transaction = state.transactions.find(matches) || null;
        return { data: transaction ? clone(transaction) : null, error: null };
      }

      return { data: null, error: null };
    };

    return query;
  };

  return {
    state,
    from: (table) => ({
      select: () => makeQuery(table),
      update: (patch) => makeQuery(table, 'update', patch),
      insert: async (row) => {
        state.transactions.push({ id: state.transactions.length + 1, ...row });
        return { error: null };
      },
    }),
  };
};

describe('image credit reservations', () => {
  it('refunds a paid reservation even when another image advanced the batch counter', async () => {
    const supabase = makeSupabaseStub({
      account: {
        user_id: 'user-1',
        balance: 7,
        object_images_in_current_batch: 2,
      },
    });

    const account = await releaseImageCreditReservation(supabase, 'user-1', {
      id: 'reservation-paid',
      cost: 3,
      advancesBatch: true,
      batchSize: 4,
      previousBatchCount: 0,
      nextBatchCount: 1,
    }, 'failed_image:item');

    expect(account.balance).toBe(10);
    expect(account.object_images_in_current_batch).toBe(1);
    expect(supabase.state.transactions).toContainEqual(expect.objectContaining({
      type: 'refund',
      amount: 3,
      reason: 'failed_image:item:reservation:reservation-paid',
    }));
  });

  it('does not refund the same traced reservation twice', async () => {
    const supabase = makeSupabaseStub({
      account: {
        user_id: 'user-1',
        balance: 7,
        object_images_in_current_batch: 0,
      },
    });
    const reservation = {
      id: 'reservation-repeat',
      cost: 3,
      advancesBatch: false,
      batchSize: 4,
      previousBatchCount: 0,
      nextBatchCount: 0,
    };

    await releaseImageCreditReservation(supabase, 'user-1', reservation, 'failed_image:item');
    await releaseImageCreditReservation(supabase, 'user-1', reservation, 'failed_image:item');

    expect(supabase.state.account.balance).toBe(10);
    expect(supabase.state.transactions.filter((entry) => entry.type === 'refund')).toHaveLength(1);
  });
});
