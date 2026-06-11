import {
  buildStoragePath,
  generateStorageFilename,
  getPublicStorageUploadResult,
  isStorageObjectAlreadyExistsError,
  uploadToStorage,
} from '../storage/supabaseStorage';

const IMAGE_UPLOAD_OPTIMIZATION = {
  maxDimension: 1920,
  quality: 0.8,
  mimeType: 'image/webp',
};

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error || new Error("Impossible dé charger cette image."));
    };
    image.src = objectUrl;
  });
}

async function imageFileToOptimizedBlob(file, options = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error("Le fichier sélectionné n'est pas une image.");
  }

  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const {
    maxDimension = IMAGE_UPLOAD_OPTIMIZATION.maxDimension,
    quality = IMAGE_UPLOAD_OPTIMIZATION.quality,
    mimeType = IMAGE_UPLOAD_OPTIMIZATION.mimeType,
  } = { ...IMAGE_UPLOAD_OPTIMIZATION, ...options };

  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height) || 1;
  const ratio = Math.min(1, maxDimension / longestSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Le navigateur ne permet pas de traiter cette image.');
  }

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

  if (blob) return blob;

  const fallbackBlob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });

  if (!fallbackBlob) {
    throw new Error("Impossible d'optimiser cette image.");
  }

  return fallbackBlob;
}

function getExtensionFromType(fileOrBlob, fallbackName = 'asset') {
  const mimeType = fileOrBlob?.type || '';
  const match = /\/([a-zA-Z0-9.+-]+)$/.exec(mimeType);
  const fromType = match?.[1]?.replace('jpeg', 'jpg').replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  const fromName = String(fallbackName).split('.').pop()?.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  return fromType || fromName || 'bin';
}

async function calculateBlobSha256(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') {
    throw new Error('Fichier invalide pour calculer son empreinte.');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new Error('Le navigateur ne permet pas de calculer le hash du fichier.');
  }

  const digest = await subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function renameBlob(blob, filename) {
  if (blob instanceof File) return blob;
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

async function uploadFileToSupabase(file, {
  userId,
  folder = 'uploads',
  optimizeImage = true,
  imageOptions = IMAGE_UPLOAD_OPTIMIZATION,
  cacheControl = '31536000',
  dedupePublicMedia = false,
  visibility = 'public',
  maxFileSize,
  allowMimeTypes,
  timeoutMs,
  retries,
  retryDelayMs,
  signal,
} = {}) {
  if (!file) {
    throw new Error('Aucun fichier à envoyer.');
  }

  if (!userId) {
    throw new Error('Utilisateur introuvable.');
  }

  const preparedBlob = file.type?.startsWith('image/') && optimizeImage ?
     await imageFileToOptimizedBlob(file, { ...IMAGE_UPLOAD_OPTIMIZATION, ...imageOptions })
    : file;

  const extension = getExtensionFromType(preparedBlob, file.name);
  const originalBaseName = String(file.name || 'asset').replace(/\.[^.]+$/, '') || 'asset';
  const sha256 = dedupePublicMedia ? await calculateBlobSha256(preparedBlob) : '';
  const filename = dedupePublicMedia
    ? `${sha256}.${extension}`
    : generateStorageFilename(`${originalBaseName}.${extension}`);
  const uploadFile = renameBlob(preparedBlob, filename);
  const path = dedupePublicMedia
    ? buildStoragePath('users', userId, folder, 'deduped', filename)
    : buildStoragePath('users', userId, folder, filename);

  let result;
  try {
    result = await uploadToStorage(path, uploadFile, {
      allowExistingObject: dedupePublicMedia,
      upsert: false,
      contentType: uploadFile.type || file.type || 'application/octet-stream',
      cacheControl,
      visibility,
      maxFileSize,
      allowMimeTypes,
      timeoutMs,
      retries,
      retryDelayMs,
      signal,
    });
  } catch (error) {
    if (!dedupePublicMedia || !isStorageObjectAlreadyExistsError(error)) throw error;
    result = getPublicStorageUploadResult(path);
  }

  return {
    ...result,
    filename,
    sha256,
    originalName: file.name,
    contentType: uploadFile.type || file.type || 'application/octet-stream',
    originalSize: file.size || 0,
    optimizedSize: uploadFile.size || preparedBlob.size || file.size || 0,
    optimized: preparedBlob !== file,
    deduped: Boolean(dedupePublicMedia),
  };
}

async function imageFileToOptimizedDataURL(file, options = {}) {
  const optimizedBlob = await imageFileToOptimizedBlob(file, { ...IMAGE_UPLOAD_OPTIMIZATION, ...options });
  return fileToDataURL(optimizedBlob instanceof File ? optimizedBlob : new File([optimizedBlob], file.name, { type: optimizedBlob.type || file.type }));
}

export {
  IMAGE_UPLOAD_OPTIMIZATION,
  downloadBlob,
  fileToDataURL,
  imageFileToOptimizedBlob,
  imageFileToOptimizedDataURL,
  calculateBlobSha256,
  uploadFileToSupabase,
};
