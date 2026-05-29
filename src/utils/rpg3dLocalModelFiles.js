export const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
export const isDataUrl = (value = '') => String(value || '').startsWith('data:');

const localBlobFileCache = new Map();
const localModelObjectUrlCache = new Map();
const LOCAL_MODEL_DB_NAME = 'escape-game-builder:rpg3d-local-models';
const LOCAL_MODEL_DB_VERSION = 1;
const LOCAL_MODEL_STORE_NAME = 'modelFiles';
const LOCAL_MODEL_FILE_ID_FIELD_PATTERN = /(^localModelFileId$|LocalModelFileId$)/;

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openLocalModelDb = () => new Promise((resolve, reject) => {
  if (!canUseIndexedDb()) {
    resolve(null);
    return;
  }
  const request = window.indexedDB.open(LOCAL_MODEL_DB_NAME, LOCAL_MODEL_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(LOCAL_MODEL_STORE_NAME)) db.createObjectStore(LOCAL_MODEL_STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Stockage local 3D indisponible.'));
});

const runLocalModelStore = async (mode, runner) => {
  const db = await openLocalModelDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    let requestResult = null;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      db.close();
      callback(value);
    };
    const transaction = db.transaction(LOCAL_MODEL_STORE_NAME, mode);
    const request = runner(transaction.objectStore(LOCAL_MODEL_STORE_NAME));
    request.onsuccess = () => {
      requestResult = request.result || null;
    };
    request.onerror = () => finish(reject, request.error || new Error('Operation de stockage local impossible.'));
    transaction.oncomplete = () => finish(resolve, requestResult);
    transaction.onerror = () => finish(reject, transaction.error || new Error('Transaction de stockage local impossible.'));
    transaction.onabort = () => finish(reject, transaction.error || new Error('Transaction de stockage local interrompue.'));
  });
};

const normalizeLocalModelFileIds = (ids = []) => [
  ...new Set((Array.isArray(ids) ? ids : [ids])
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean)),
];

const normalizeLocalModelScopeValue = (value = '') => (typeof value === 'string' ? value.trim() : '');

const normalizeLocalModelFileRecord = (record = null) => {
  if (typeof record === 'string') return { id: record.trim() };
  if (!record || typeof record !== 'object') return null;
  const id = normalizeLocalModelScopeValue(record.id);
  if (!id) return null;
  const projectId = normalizeLocalModelScopeValue(record.projectId);
  const userId = normalizeLocalModelScopeValue(record.userId);
  return {
    ...record,
    id,
    ...(projectId ? { projectId } : {}),
    ...(userId ? { userId } : {}),
  };
};

const normalizeLocalModelFileRecords = (records = []) => (
  (Array.isArray(records) ? records : [records])
    .map(normalizeLocalModelFileRecord)
    .filter(Boolean)
);

const normalizeLocalModelScope = (scope = {}) => ({
  projectId: normalizeLocalModelScopeValue(scope.projectId),
  userId: normalizeLocalModelScopeValue(scope.userId),
});

const isRecordScopedToCleanupTarget = (record = {}, scope = {}) => {
  const recordScope = normalizeLocalModelScope(record);
  const targetScope = normalizeLocalModelScope(scope);
  if (!recordScope.projectId || !targetScope.projectId) return false;
  if (recordScope.projectId !== targetScope.projectId) return false;
  if (recordScope.userId && targetScope.userId && recordScope.userId !== targetScope.userId) return false;
  return true;
};

const forgetLocalModelFileIdCaches = (localModelFileId = '') => {
  const objectUrl = localModelObjectUrlCache.get(localModelFileId);
  if (!objectUrl) return;
  localModelObjectUrlCache.delete(localModelFileId);
  localBlobFileCache.delete(objectUrl);
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && isBlobUrl(objectUrl)) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Cache cleanup should never block IndexedDB cleanup.
    }
  }
};

export const listRpg3DLocalModelFileIds = async () => {
  const keys = await runLocalModelStore('readonly', (store) => store.getAllKeys());
  return normalizeLocalModelFileIds(keys);
};

export const listRpg3DLocalModelFileRecords = async () => {
  const records = await runLocalModelStore('readonly', (store) => store.getAll());
  return normalizeLocalModelFileRecords(records);
};

export const deleteRpg3DLocalModelFiles = async (localModelFileIds = []) => {
  const ids = normalizeLocalModelFileIds(localModelFileIds);
  if (!ids.length) return 0;
  const db = await openLocalModelDb();
  if (!db) return 0;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_MODEL_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LOCAL_MODEL_STORE_NAME);
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => {
      db.close();
      ids.forEach(forgetLocalModelFileIdCaches);
      resolve(ids.length);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Suppression des modeles locaux impossible.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Suppression des modeles locaux interrompue.'));
    };
  });
};

export const collectReferencedRpg3DLocalModelFileIds = ({ config = null, studioProject = null } = {}) => {
  const referencedIds = new Set();
  const seenObjects = new WeakSet();
  const collectFromValue = (value, key = '') => {
    if (typeof value === 'string') {
      if (LOCAL_MODEL_FILE_ID_FIELD_PATTERN.test(key) && value.trim()) referencedIds.add(value.trim());
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry) => collectFromValue(entry));
      return;
    }
    Object.entries(value).forEach(([entryKey, entryValue]) => collectFromValue(entryValue, entryKey));
  };
  collectFromValue(studioProject);
  collectFromValue(config);
  return referencedIds;
};

export const getOrphanedRpg3DLocalModelFileIds = (storedIds = [], referencedIds = []) => {
  const referencedSet = referencedIds instanceof Set
    ? referencedIds
    : new Set(normalizeLocalModelFileIds(referencedIds));
  return normalizeLocalModelFileIds(storedIds).filter((id) => !referencedSet.has(id));
};

export const cleanupOrphanedRpg3DLocalModelFiles = async (
  { config = null, studioProject = null } = {},
  options = {},
) => {
  const hasLiveReferenceSource = Boolean(
    (config && typeof config === 'object') || (studioProject && typeof studioProject === 'object'),
  );
  const referencedIds = collectReferencedRpg3DLocalModelFileIds({ config, studioProject });
  const cleanupScope = normalizeLocalModelScope(options.scope || options);
  const result = {
    skipped: !hasLiveReferenceSource,
    referencedIds: [...referencedIds],
    storedIds: [],
    orphanedIds: [],
    protectedIds: [],
    deletedCount: 0,
    errors: [],
  };
  if (!hasLiveReferenceSource) return result;
  try {
    const storedRecords = options.storedRecords
      ? normalizeLocalModelFileRecords(options.storedRecords)
      : options.storedIds
        ? normalizeLocalModelFileIds(options.storedIds).map((id) => ({ id }))
        : await listRpg3DLocalModelFileRecords();
    result.storedIds = storedRecords.map((record) => record.id);
    result.orphanedIds = getOrphanedRpg3DLocalModelFileIds(result.storedIds, referencedIds);
    const orphanedSet = new Set(result.orphanedIds);
    const deletableIds = storedRecords
      .filter((record) => orphanedSet.has(record.id))
      .filter((record) => isRecordScopedToCleanupTarget(record, cleanupScope))
      .map((record) => record.id);
    const deletableSet = new Set(deletableIds);
    result.protectedIds = result.orphanedIds.filter((id) => !deletableSet.has(id));
    result.deletableIds = deletableIds;
  } catch (error) {
    result.errors.push(error);
    return result;
  }
  if (options.dryRun || !result.deletableIds.length) return result;
  try {
    const deleteLocalModelFiles = options.deleteLocalModelFiles || deleteRpg3DLocalModelFiles;
    result.deletedCount = await deleteLocalModelFiles(result.deletableIds);
  } catch (error) {
    result.errors.push(error);
  }
  return result;
};

export const createLocalModelFileId = (modelType = 'model', modelId = '', file = null) => (
  [
    'rpg3d',
    modelType || 'model',
    modelId || 'model',
    file?.name || 'asset',
    Number(file?.size) || 0,
    Number(file?.lastModified) || Date.now(),
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join(':')
);

export const persistLocalModelFile = async (localModelFileId = '', file = null, options = {}) => {
  if (!localModelFileId || !file) return false;
  const scope = normalizeLocalModelScope(options.scope || options);
  try {
    await runLocalModelStore('readwrite', (store) => store.put({
      id: localModelFileId,
      file,
      name: file.name || '',
      type: file.type || '',
      size: Number(file.size) || 0,
      updatedAt: Date.now(),
      ...(scope.projectId ? { projectId: scope.projectId } : {}),
      ...(scope.userId ? { userId: scope.userId } : {}),
    }));
    return true;
  } catch {
    return false;
  }
};

export const loadLocalModelFile = async (localModelFileId = '') => {
  if (!localModelFileId) return null;
  try {
    const record = await runLocalModelStore('readonly', (store) => store.get(localModelFileId));
    return record?.file || null;
  } catch {
    return null;
  }
};

export const createLocalModelObjectUrl = async (localModelFileId = '') => {
  if (!localModelFileId) return '';
  const cachedUrl = localModelObjectUrlCache.get(localModelFileId);
  if (cachedUrl) return cachedUrl;
  const file = await loadLocalModelFile(localModelFileId);
  if (!file) return '';
  const objectUrl = URL.createObjectURL(file);
  localModelObjectUrlCache.set(localModelFileId, objectUrl);
  localBlobFileCache.set(objectUrl, file);
  return objectUrl;
};

export const rememberRpg3DLocalBlobFile = (blobUrl = '', file = null, localModelFileId = '', options = {}) => {
  if (!isBlobUrl(blobUrl) || !file) return false;
  localBlobFileCache.set(blobUrl, file);
  if (localModelFileId) {
    localModelObjectUrlCache.set(localModelFileId, blobUrl);
    if (options.persist !== false) persistLocalModelFile(localModelFileId, file, options);
  }
  return true;
};

export const forgetRpg3DLocalBlobFile = (blobUrl = '') => {
  if (!isBlobUrl(blobUrl)) return false;
  return localBlobFileCache.delete(blobUrl);
};

export const getCachedRpg3DLocalBlobFile = (blobUrl = '') => localBlobFileCache.get(blobUrl) || null;
