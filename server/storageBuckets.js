export const LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE = [
  'SUPABASE_STORAGE_BUCKET / VITE_SUPABASE_STORAGE_BUCKET is deprecated and only kept as a legacy fallback.',
  'Configure SUPABASE_PUBLIC_ASSETS_BUCKET and SUPABASE_PRIVATE_DATA_BUCKET on the server,',
  'plus VITE_SUPABASE_PUBLIC_ASSETS_BUCKET and VITE_SUPABASE_PRIVATE_DATA_BUCKET for the browser.',
].join(' ');

const readEnv = (env, key) => String(env?.[key] || '').trim();

const firstConfiguredEnv = (env, keys) => (
  keys.map((key) => readEnv(env, key)).find(Boolean) || ''
);

export const resolveSupabaseStorageBuckets = (env = process.env) => {
  const explicitPublicAssetsBucket = firstConfiguredEnv(env, [
    'SUPABASE_PUBLIC_ASSETS_BUCKET',
    'VITE_SUPABASE_PUBLIC_ASSETS_BUCKET',
  ]);
  const explicitPrivateDataBucket = firstConfiguredEnv(env, [
    'SUPABASE_PRIVATE_DATA_BUCKET',
    'VITE_SUPABASE_PRIVATE_DATA_BUCKET',
  ]);
  const legacyStorageBucket = firstConfiguredEnv(env, [
    'SUPABASE_STORAGE_BUCKET',
    'VITE_SUPABASE_STORAGE_BUCKET',
  ]);

  return {
    legacyStorageBucket,
    publicAssetsBucket: explicitPublicAssetsBucket || legacyStorageBucket,
    privateDataBucket: explicitPrivateDataBucket || legacyStorageBucket,
    explicitPublicAssetsBucket,
    explicitPrivateDataBucket,
    usesLegacyStorageBucketFallback: Boolean(
      legacyStorageBucket && (!explicitPublicAssetsBucket || !explicitPrivateDataBucket),
    ),
  };
};

let didWarnLegacyStorageBucketFallback = false;

export const warnLegacyStorageBucketFallback = (
  buckets = resolveSupabaseStorageBuckets(),
  logger = console,
) => {
  if (!buckets.usesLegacyStorageBucketFallback || didWarnLegacyStorageBucketFallback) return false;
  didWarnLegacyStorageBucketFallback = true;
  logger?.warn?.('[supabase-storage]', LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE);
  return true;
};

export const getServerStorageBuckets = (env = process.env, logger = console) => {
  const buckets = resolveSupabaseStorageBuckets(env);
  warnLegacyStorageBucketFallback(buckets, logger);
  return buckets;
};

export const createMissingStorageBucketError = () => {
  const error = new Error(
    'Configuration Supabase Storage manquante. Configure SUPABASE_PUBLIC_ASSETS_BUCKET et SUPABASE_PRIVATE_DATA_BUCKET, ou garde SUPABASE_STORAGE_BUCKET uniquement comme fallback legacy temporaire.',
  );
  error.status = 500;
  error.statusCode = 500;
  error.code = 'SUPABASE_STORAGE_BUCKET_MISSING';
  return error;
};
