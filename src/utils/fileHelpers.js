import { buildStoragePath, uploadToStorage } from '../supabaseStorage';

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
      reject(error || new Error("Impossible de charger cette image."));
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
    maxDimension = 1600,
    quality = 0.82,
    mimeType = 'image/webp',
  } = options;

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

function renameBlob(blob, filename) {
  if (blob instanceof File) return blob;
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

async function uploadFileToSupabase(file, {
  userId,
  folder = 'uploads',
  optimizeImage = true,
  imageOptions,
} = {}) {
  if (!file) {
    throw new Error('Aucun fichier à envoyer.');
  }

  if (!userId) {
    throw new Error('Utilisateur introuvable.');
  }

  const preparedBlob = file.type?.startsWith('image/') && optimizeImage ?
     await imageFileToOptimizedBlob(file, imageOptions)
    : file;

  const extension = getExtensionFromType(preparedBlob, file.name);
  const fileBaseName = String(file.name || 'asset')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';

  const filename = `${Date.now()}-${fileBaseName}.${extension}`;
  const uploadFile = renameBlob(preparedBlob, filename);
  const path = buildStoragePath('users', userId, folder, filename);

  return uploadToStorage(path, uploadFile, {
    contentType: uploadFile.type || file.type || 'application/octet-stream',
  });
}

async function imageFileToOptimizedDataURL(file, options = {}) {
  const optimizedBlob = await imageFileToOptimizedBlob(file, options);
  return fileToDataURL(optimizedBlob instanceof File ? optimizedBlob : new File([optimizedBlob], file.name, { type: optimizedBlob.type || file.type }));
}

export { downloadBlob, fileToDataURL, imageFileToOptimizedBlob, imageFileToOptimizedDataURL, uploadFileToSupabase };
