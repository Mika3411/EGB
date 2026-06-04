export const REMOTE_URL_PATTERN = /^(?:https?:)?\/\//i;

export const SENSITIVE_ASSET_URL_PARAMS = new Set([
  'token',
  'signature',
  'expires',
  'access_token',
  'refresh_token',
  'key',
  'apikey',
]);

export const REMOTE_MEDIA_URL_KEYS = ['url', 'src', 'data', 'downloadUrl', 'thumbnailUrl'];

export const MEDIA_FILE_NAME_PATTERN = /\.(?:png|jpe?g|webp|gif|svg|bmp|mp3|wav|ogg|oga|m4a|aac|webm|mp4|mov|ogv|m4v|glb|gltf|fbx|obj)$/i;

const KNOWN_MEDIA_SIZE_KEYS = [
  'storageBytes',
  'sizeBytes',
  'fileSizeBytes',
  'byteSize',
  'bytes',
  'contentLengthBytes',
  'contentLength',
];

const sortQueryEntries = (entries) => entries.sort(([leftName, leftValue], [rightName, rightValue]) => (
  leftName === rightName ? String(leftValue).localeCompare(String(rightValue)) : String(leftName).localeCompare(String(rightName))
));

const encodeQueryEntry = ([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

export const getRemoteAssetDedupeKey = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value, 'https://example.invalid');
    const supabaseObjectMatch = parsed.pathname.match(/^(.*\/storage\/v1\/object)\/(?:public|sign|authenticated)\/(.+)$/);
    if (supabaseObjectMatch) {
      const objectPath = decodeURIComponent(supabaseObjectMatch[2]);
      return `${parsed.origin}${supabaseObjectMatch[1]}/${objectPath}`;
    }

    const queryEntries = [];
    parsed.searchParams.forEach((entryValue, entryName) => {
      if (!SENSITIVE_ASSET_URL_PARAMS.has(entryName.toLowerCase())) {
        queryEntries.push([entryName, entryValue]);
      }
    });
    const query = sortQueryEntries(queryEntries).map(encodeQueryEntry).join('&');
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return value;
  }
};

export const normalizeDuplicateMediaName = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/\s*\(\d+\)(?=\.[a-z0-9]+$)/i, '');

export const normalizePositiveByteSize = (value) => {
  const size = typeof value === 'string' && value.trim()
    ? Number(value)
    : value;
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.ceil(size);
};

export const getKnownAssetDuplicateName = (asset = {}) => (
  asset.name
  || asset.fileName
  || asset.filename
  || asset.label
  || ''
);

export const getKnownAssetByteSize = (value = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;

  for (const key of KNOWN_MEDIA_SIZE_KEYS) {
    const size = normalizePositiveByteSize(value[key]);
    if (size > 0) return size;
  }

  const assetSize = normalizePositiveByteSize(value.size);
  if (
    assetSize > 0
    && REMOTE_MEDIA_URL_KEYS.some((key) => (
      typeof value[key] === 'string'
      && REMOTE_URL_PATTERN.test(value[key].trim())
    ))
  ) {
    return assetSize;
  }

  return 0;
};

export const getKnownDuplicateMediaKey = ({
  mediaType = '',
  name = '',
  byteSize = 0,
  requireFileName = false,
} = {}) => {
  const normalizedName = normalizeDuplicateMediaName(name);
  const normalizedSize = normalizePositiveByteSize(byteSize);
  if (!normalizedName || normalizedSize <= 0) return '';
  if (requireFileName && !MEDIA_FILE_NAME_PATTERN.test(normalizedName)) return '';
  return `known-media:${mediaType || 'asset'}:${normalizedName}:${normalizedSize}`;
};

export const getReferenceDuplicateMediaKey = ({
  mediaType = '',
  name = '',
  requireFileName = true,
} = {}) => {
  const normalizedName = normalizeDuplicateMediaName(name);
  if (!normalizedName) return '';
  if (requireFileName && !MEDIA_FILE_NAME_PATTERN.test(normalizedName)) return '';
  return `reference-media:${mediaType || 'asset'}:${normalizedName}`;
};
