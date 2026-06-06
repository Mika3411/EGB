import { describe, expect, test } from 'vitest';
import {
  ACCOUNT_TYPE_PRO,
  getAccountType,
  getAccountTypeLabel,
  isProfessionalAccount,
} from '../shared/services/accountPlans';
import {
  ACCOUNT_FREE_STORAGE_BYTES,
  ACCOUNT_PRO_STORAGE_BYTES,
  MB,
  getStorageQuotaBytes,
} from '../shared/services/storageQuota';

describe('account plans', () => {
  test('normalise les comptes particuliers et pro', () => {
    expect(getAccountType({ accountType: 'professional' })).toBe(ACCOUNT_TYPE_PRO);
    expect(isProfessionalAccount({ account_type: 'professionnel' })).toBe(true);
    expect(getAccountTypeLabel({ accountType: 'pro' })).toBe('Compte Pro');
    expect(getAccountTypeLabel({})).toBe('Compte particulier');
  });

  test('applique un quota media de base plus haut aux comptes pro', () => {
    expect(getStorageQuotaBytes()).toBe(ACCOUNT_FREE_STORAGE_BYTES);
    expect(getStorageQuotaBytes({ account: { accountType: 'pro' } })).toBe(ACCOUNT_PRO_STORAGE_BYTES);
    expect(getStorageQuotaBytes({
      account: { accountType: 'pro' },
      storageQuotaBytes: ACCOUNT_FREE_STORAGE_BYTES,
    })).toBe(ACCOUNT_PRO_STORAGE_BYTES);
    expect(getStorageQuotaBytes({
      account: { accountType: 'pro' },
      storageQuotaBytes: 2 * 1024 * MB,
    })).toBe(2 * 1024 * MB);

    expect(getStorageQuotaBytes({
      account: {},
      accountType: 'pro',
      storageQuotaBytes: ACCOUNT_FREE_STORAGE_BYTES,
    })).toBe(ACCOUNT_PRO_STORAGE_BYTES);
  });
});
