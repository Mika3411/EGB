export const AUTHOR_MEDIA_TARGETS = {
  avatar: {
    label: 'Avatar',
    width: 512,
    height: 512,
    aspect: 1,
    quality: 0.86,
    mimeType: 'image/webp',
  },
  banner: {
    label: 'Bannière',
    width: 1600,
    height: 320,
    aspect: 5,
    quality: 0.84,
    mimeType: 'image/webp',
  },
};

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    resolve({ image, objectUrl });
  };
  image.onerror = (error) => {
    URL.revokeObjectURL(objectUrl);
    reject(error || new Error('Image illisible.'));
  };
  image.src = objectUrl;
});

const loadImageFromSrc = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = (error) => reject(error || new Error('Image illisible.'));
  image.src = src;
});

const clampAuthorProfilePan = (value = 0) => Math.max(-100, Math.min(100, Number(value) || 0));

export const readAuthorProfileImageFile = (file) => new Promise((resolve, reject) => {
  if (!file || !file.type?.startsWith('image/')) {
    reject(new Error("Le fichier sélectionné n'est pas une image."));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => resolve({
      src: reader.result,
      name: file.name || 'image',
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    image.onerror = (error) => reject(error || new Error('Image illisible.'));
    image.src = reader.result;
  };
  reader.onerror = () => reject(new Error('Image illisible.'));
  reader.readAsDataURL(file);
});

export async function cropAuthorProfileImage({
  src,
  sourceWidth = 0,
  sourceHeight = 0,
  target = 'avatar',
  zoom = 1,
  panX = 0,
  panY = 0,
} = {}) {
  if (!src) throw new Error('Image manquante.');

  const options = AUTHOR_MEDIA_TARGETS[target] || AUTHOR_MEDIA_TARGETS.avatar;
  const image = await loadImageFromSrc(src);
  const naturalWidth = sourceWidth || image.naturalWidth || image.width || options.width;
  const naturalHeight = sourceHeight || image.naturalHeight || image.height || options.height;
  const imageAspect = naturalWidth / naturalHeight;
  const safeZoom = Math.max(1, Math.min(3, Number(zoom) || 1));
  const baseDrawWidth = imageAspect > options.aspect ? options.height * imageAspect : options.width;
  const baseDrawHeight = imageAspect > options.aspect ? options.height : options.width / imageAspect;
  const drawWidth = baseDrawWidth * safeZoom;
  const drawHeight = baseDrawHeight * safeZoom;
  const overflowX = Math.max(0, (drawWidth - options.width) / 2);
  const overflowY = Math.max(0, (drawHeight - options.height) / 2);
  const dx = (options.width - drawWidth) / 2 + (clampAuthorProfilePan(panX) / 100) * overflowX;
  const dy = (options.height - drawHeight) / 2 + (clampAuthorProfilePan(panY) / 100) * overflowY;

  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error("Le navigateur ne permet pas de recadrer l'image.");
  context.fillStyle = '#020617';
  if (typeof context.fillRect === 'function') context.fillRect(0, 0, options.width, options.height);

  context.drawImage(
    image,
    0,
    0,
    naturalWidth,
    naturalHeight,
    dx,
    dy,
    drawWidth,
    drawHeight,
  );

  return canvas.toDataURL(options.mimeType, options.quality);
}

export async function resizeAuthorProfileImage(file, target = 'avatar') {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error("Le fichier sélectionné n'est pas une image.");
  }

  const options = AUTHOR_MEDIA_TARGETS[target] || AUTHOR_MEDIA_TARGETS.avatar;
  const { image, objectUrl } = await loadImageFromFile(file);
  try {
    const naturalWidth = image.naturalWidth || image.width || options.width;
    const naturalHeight = image.naturalHeight || image.height || options.height;
    return await cropAuthorProfileImage({
      src: objectUrl,
      sourceWidth: naturalWidth,
      sourceHeight: naturalHeight,
      target,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
