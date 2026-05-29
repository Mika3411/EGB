import { beforeEach, describe, expect, test, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(() => null),
}));

vi.mock('../../server/supabase.js', () => ({
  getSupabaseAdminClient: supabaseMock.getSupabaseAdminClient,
}));

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeSupabaseCreditsStub = ({ account, transactions = [], conflictOnce = false } = {}) => {
  const state = {
    account: {
      user_id: 'user-1',
      balance: 10,
      object_images_in_current_batch: 0,
      created_at: '2026-05-29T10:00:00.000Z',
      updated_at: '2026-05-29T10:00:00.000Z',
      ...(account || {}),
    },
    transactions: [...transactions],
    conflictOnce,
  };

  const makeQuery = (table, operation = 'select', payload = null) => {
    const filters = [];
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      like: (column, value) => {
        filters.push([column, value, 'like']);
        return query;
      },
      eq: (column, value) => {
        filters.push([column, value, 'eq']);
        return query;
      },
      maybeSingle: async () => runQuery(false),
      single: async () => runQuery(true),
      then: (resolve, reject) => runQuery(false).then(resolve, reject),
    };

    const matches = (row) => filters.every(([column, value, operator]) => {
      if (operator === 'like') {
        return String(row?.[column] || '').startsWith(String(value).replace(/%$/, ''));
      }
      return row?.[column] === value;
    });

    const runQuery = async () => {
      if (table === 'ai_credits') {
        if (operation === 'insert') {
          state.account = { ...payload };
          return { data: clone(state.account), error: null };
        }
        if (operation === 'update') {
          if (state.conflictOnce) {
            state.conflictOnce = false;
            return { data: null, error: null };
          }
          if (!matches(state.account)) return { data: null, error: null };
          state.account = { ...state.account, ...payload };
        }
        return { data: clone(state.account), error: null };
      }

      if (table === 'ai_credit_transactions') {
        const rows = state.transactions.filter(matches);
        return { data: clone(rows), error: null };
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
      insert: (row) => {
        if (table === 'ai_credit_transactions') {
          state.transactions.push({
            id: state.transactions.length + 1,
            ...row,
          });
          return Promise.resolve({ data: null, error: null });
        }
        return makeQuery(table, 'insert', row);
      },
    }),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.getSupabaseAdminClient.mockReturnValue(null);
});

describe('server credit auth', () => {
  test('n autorise le fallback local que sur opt-in explicite', async () => {
    const { isLocalCreditAuthAllowed } = await import('../../server/credits.js');

    expect(isLocalCreditAuthAllowed({})).toBe(false);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'false' })).toBe(false);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'true' })).toBe(true);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: '1' })).toBe(true);
    expect(isLocalCreditAuthAllowed({ ALLOW_LOCAL_CREDIT_AUTH: 'yes' })).toBe(true);
  });

  test('debite les credits via Supabase avec une garde atomique sur le solde', async () => {
    const supabase = makeSupabaseCreditsStub({ conflictOnce: true });
    supabaseMock.getSupabaseAdminClient.mockReturnValue(supabase);
    const { spendCredits } = await import('../../server/credits.js');

    const account = await spendCredits('user-1', 3, 'text:generate');

    expect(account.balance).toBe(7);
    expect(supabase.state.account.balance).toBe(7);
    expect(supabase.state.transactions).toContainEqual(expect.objectContaining({
      user_id: 'user-1',
      type: 'spend',
      amount: -3,
      reason: 'text:generate',
    }));
  });

  test('refuse une double depense Supabase quand le solde est insuffisant', async () => {
    const supabase = makeSupabaseCreditsStub({
      account: {
        balance: 2,
      },
    });
    supabaseMock.getSupabaseAdminClient.mockReturnValue(supabase);
    const { spendCredits } = await import('../../server/credits.js');

    await expect(spendCredits('user-1', 3, 'text:generate')).rejects.toMatchObject({
      status: 402,
      code: 'AI_CREDITS_EXHAUSTED',
      balance: 2,
      required: 3,
    });
    expect(supabase.state.account.balance).toBe(2);
    expect(supabase.state.transactions).toEqual([]);
  });

  test('requiert Supabase sauf fallback local explicite', async () => {
    const { getCreditAccount } = await import('../../server/credits.js');

    await expect(getCreditAccount('user-1')).rejects.toMatchObject({
      status: 503,
      code: 'SUPABASE_CREDITS_REQUIRED',
    });
  });
});
