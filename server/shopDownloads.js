import { createStorageSignedUrl, privateDataBucket, publicAssetsBucket } from './storage.js';

const shopPackSignedUrlExpiresIn = 60 * 60;

export const hasShopPackDownload = (pack = {}) => Boolean(
  String(pack.downloadUrl || '').trim()
  || String(pack.downloadStoragePath || '').trim()
);

export const toPublicShopPackDownloadState = (pack = {}) => {
  const {
    downloadUrl,
    downloadStoragePath,
    downloadBucket,
    downloadStorageBucket,
    ...publicPack
  } = pack;

  return {
    ...publicPack,
    hasDownload: hasShopPackDownload(pack),
  };
};

export const getShopPackDownloadBuckets = (pack = {}) => {
  const configuredBuckets = [
    pack.downloadStorageBucket,
    pack.downloadBucket,
  ].map((bucket) => String(bucket || '').trim()).filter(Boolean);
  const defaultBuckets = pack.downloadMode === 'supabase'
    ? [publicAssetsBucket, privateDataBucket]
    : [privateDataBucket, publicAssetsBucket];

  return [...new Set([...configuredBuckets, ...defaultBuckets])];
};

export const resolveShopPackDownload = async (pack = {}, options = {}) => {
  const downloadUrl = String(pack.downloadUrl || '').trim();
  if (downloadUrl) return { downloadUrl };

  const downloadStoragePath = String(pack.downloadStoragePath || '').trim();
  if (!downloadStoragePath) return null;

  const createSignedUrl = options.createSignedUrl || createStorageSignedUrl;
  return {
    downloadUrl: await createSignedUrl(downloadStoragePath, {
      buckets: options.buckets || getShopPackDownloadBuckets(pack),
      expiresIn: options.expiresIn || shopPackSignedUrlExpiresIn,
    }),
  };
};
