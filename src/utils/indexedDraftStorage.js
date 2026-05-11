const DEFAULT_STORE_NAME = 'drafts';
const DEFAULT_VERSION = 1;

export const openIndexedDraftDb = (
  dbName,
  { storeName = DEFAULT_STORE_NAME, version = DEFAULT_VERSION } = {},
) => new Promise((resolve, reject) => {
  if (!dbName) {
    reject(new Error('Nom IndexedDB manquant.'));
    return;
  }
  if (typeof window === 'undefined' || !window.indexedDB) {
    reject(new Error('IndexedDB indisponible.'));
    return;
  }

  const request = window.indexedDB.open(dbName, version);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(storeName)) {
      request.result.createObjectStore(storeName, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const readIndexedDraft = async (dbName, id, options = {}) => {
  const { storeName = DEFAULT_STORE_NAME } = options;
  const db = await openIndexedDraftDb(dbName, options);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Lecture du brouillon interrompue.'));
    };
  });
};

export const writeIndexedDraft = async (dbName, id, value, options = {}) => {
  const { storeName = DEFAULT_STORE_NAME } = options;
  const db = await openIndexedDraftDb(dbName, options);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put({ id, value, updatedAt: Date.now() });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Sauvegarde du brouillon interrompue.'));
    };
  });
};

export const deleteIndexedDraft = async (dbName, id, options = {}) => {
  const { storeName = DEFAULT_STORE_NAME } = options;
  const db = await openIndexedDraftDb(dbName, options);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Suppression du brouillon interrompue.'));
    };
  });
};

export const deleteIndexedDrafts = async (dbName, ids = [], options = {}) => {
  const { storeName = DEFAULT_STORE_NAME } = options;
  const draftIds = [...new Set((Array.isArray(ids) ? ids : [ids])
    .filter((id) => typeof id === 'string' && id.trim()))];
  if (!draftIds.length) return 0;

  const db = await openIndexedDraftDb(dbName, options);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    draftIds.forEach((id) => store.delete(id));
    transaction.oncomplete = () => {
      db.close();
      resolve(draftIds.length);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Suppression des brouillons interrompue.'));
    };
  });
};

export const createIndexedDraftStorage = (dbName, options = {}) => ({
  read: (id) => readIndexedDraft(dbName, id, options),
  write: (id, value) => writeIndexedDraft(dbName, id, value, options),
  remove: (id) => deleteIndexedDraft(dbName, id, options),
  removeMany: (ids) => deleteIndexedDrafts(dbName, ids, options),
});
