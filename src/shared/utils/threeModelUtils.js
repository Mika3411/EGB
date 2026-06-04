export const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
export const isDataUrl = (value = '') => String(value || '').startsWith('data:');

const THREE_MODEL_FORMATS = new Set(['glb', 'fbx', 'obj']);
const THREE_MODEL_ARCHIVE_FORMATS = new Set(['zip']);
const THREE_MODEL_MIME_FORMATS = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'glb',
  'model/obj': 'obj',
  'application/vnd.autodesk.fbx': 'fbx',
  'model/vnd.fbx': 'fbx',
};
const THREE_MODEL_MIME_TYPES = {
  glb: 'model/gltf-binary',
  fbx: 'application/octet-stream',
  obj: 'model/obj',
};
const THREE_MODEL_FORMAT_LABELS = {
  glb: 'GLB',
  fbx: 'FBX',
  obj: 'OBJ',
};
const THREE_MODEL_ARCHIVE_MIME_FORMATS = {
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

export const THREE_MODEL_ACCEPT = [
  '.glb',
  '.fbx',
  '.obj',
  '.zip',
  'model/gltf-binary',
  'model/obj',
  'application/vnd.autodesk.fbx',
  'model/vnd.fbx',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
].join(',');

const getDataUrlMimeType = (source = '') => (
  String(source || '').match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || ''
);

const getSourceExtension = (source = '') => {
  const withoutQuery = String(source || '').split(/[?#]/)[0];
  const extension = withoutQuery.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return THREE_MODEL_FORMATS.has(extension) ? extension : '';
};

export const getThreeModelMimeType = (format = '') => (
  THREE_MODEL_MIME_TYPES[String(format || '').toLowerCase()] || 'application/octet-stream'
);

export const getThreeModelFormatLabel = (format = '') => (
  THREE_MODEL_FORMAT_LABELS[String(format || '').toLowerCase()] || '3D'
);

export const getThreeModelFormat = (modelOrSource = {}, source = '') => {
  const candidates = [];
  if (modelOrSource && typeof modelOrSource === 'object') {
    candidates.push(
      modelOrSource.modelFormat,
      modelOrSource.modelName,
      modelOrSource.characterModelName,
      modelOrSource.decorModelName,
      modelOrSource.modelUrl,
      modelOrSource.modelData,
      modelOrSource.characterModelUrl,
      modelOrSource.decorModelUrl,
      modelOrSource.decorModelData,
      modelOrSource.name,
    );
  } else {
    candidates.push(modelOrSource);
  }
  candidates.push(source);

  for (const candidate of candidates.filter(Boolean).map(String)) {
    const explicitFormat = candidate.toLowerCase();
    if (THREE_MODEL_FORMATS.has(explicitFormat)) return explicitFormat;

    const dataMimeType = getDataUrlMimeType(candidate);
    if (THREE_MODEL_MIME_FORMATS[dataMimeType]) return THREE_MODEL_MIME_FORMATS[dataMimeType];

    const extension = getSourceExtension(candidate);
    if (extension) return extension;

    const mimeFormat = THREE_MODEL_MIME_FORMATS[explicitFormat];
    if (mimeFormat) return mimeFormat;
  }
  return '';
};

export const getThreeModelFileFormat = (file = null) => {
  if (!file) return '';
  return getThreeModelFormat(file.name || '') || getThreeModelFormat(file.type || '');
};

export const isThreeModelFile = (file = null) => Boolean(getThreeModelFileFormat(file));

export const getThreeModelArchiveFileFormat = (file = null) => {
  if (!file) return '';
  const extension = String(file.name || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  if (THREE_MODEL_ARCHIVE_FORMATS.has(extension)) return extension;
  return THREE_MODEL_ARCHIVE_MIME_FORMATS[String(file.type || '').toLowerCase()] || '';
};

export const isThreeModelArchiveFile = (file = null) => Boolean(getThreeModelArchiveFileFormat(file));

export const normalizeThreeModelFile = (file = null, format = '') => {
  if (!file) return file;
  const modelFormat = format || getThreeModelFileFormat(file);
  const mimeType = getThreeModelMimeType(modelFormat);
  if (!modelFormat || file.type === mimeType || typeof File === 'undefined') return file;
  const fileName = file.name || `modele.${modelFormat}`;
  return new File([file], fileName, {
    type: mimeType,
    lastModified: file.lastModified || Date.now(),
  });
};

export const getGltfModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  if (isDataUrl(model.modelData) && (isBlobUrl(model.modelUrl) || model.modelUrl)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};

export const getGltfModelSources = (model = {}) => {
  const primarySource = getGltfModelSource(model);
  const sources = isBlobUrl(model.modelUrl)
    ? [model.modelUrl, model.modelData]
    : [primarySource, model.modelUrl, model.modelData];
  return [...new Set(sources)];
};

export const normalizeResourcePath = (value = '') => {
  const withoutQuery = String(value || '').split(/[?#]/)[0].replace(/\\/g, '/');
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
};

export const getResourcePathKeys = (value = '') => {
  const normalized = normalizeResourcePath(value).replace(/^\.\/+/, '').replace(/^\/+/, '');
  const basename = normalized.split('/').filter(Boolean).pop() || normalized;
  return [normalized, basename]
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
};

export const getResourceExtension = (value = '') => (
  normalizeResourcePath(value).match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || ''
);

export const getThreeModelResourceEntries = (model = {}) => (
  [
    ...(Array.isArray(model.modelResources) ? model.modelResources : []),
    ...(Array.isArray(model.characterModelResources) ? model.characterModelResources : []),
    ...(Array.isArray(model.decorModelResources) ? model.decorModelResources : []),
  ]
    .filter((resource) => resource && (resource.data || resource.url) && (resource.path || resource.name))
);

export const hasThreeModelResources = (model = {}) => getThreeModelResourceEntries(model).length > 0;

export const getThreeModelSource = getGltfModelSource;
export const getThreeModelSources = getGltfModelSources;
