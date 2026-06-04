export const THUMBNAIL_CROPS = {
  wide: { label: '16:9', aspect: 16 / 9, width: 1280, height: 720 },
  square: { label: 'Carré', aspect: 1, width: 900, height: 900 },
};

export const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => resolve({
      src: reader.result,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    image.onerror = reject;
    image.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const makeCroppedThumbnailFile = async ({ src, sourceName, sourceWidth, sourceHeight, cropMode, zoom, panX, panY }) => {
  const crop = THUMBNAIL_CROPS[cropMode] || THUMBNAIL_CROPS.wide;
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = src;
  });

  const naturalWidth = sourceWidth || image.naturalWidth || image.width;
  const naturalHeight = sourceHeight || image.naturalHeight || image.height;
  const imageAspect = naturalWidth / naturalHeight;
  const baseWidth = imageAspect > crop.aspect ? naturalHeight * crop.aspect : naturalWidth;
  const baseHeight = imageAspect > crop.aspect ? naturalHeight : naturalWidth / crop.aspect;
  const sourceWidthCropped = Math.max(1, baseWidth / zoom);
  const sourceHeightCropped = Math.max(1, baseHeight / zoom);
  const maxOffsetX = Math.max(0, (naturalWidth - sourceWidthCropped) / 2);
  const maxOffsetY = Math.max(0, (naturalHeight - sourceHeightCropped) / 2);
  const sx = Math.max(0, Math.min(naturalWidth - sourceWidthCropped, (naturalWidth - sourceWidthCropped) / 2 + (panX / 100) * maxOffsetX));
  const sy = Math.max(0, Math.min(naturalHeight - sourceHeightCropped, (naturalHeight - sourceHeightCropped) / 2 + (panY / 100) * maxOffsetY));

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Recadrage impossible dans ce navigateur.');
  context.drawImage(image, sx, sy, sourceWidthCropped, sourceHeightCropped, 0, 0, crop.width, crop.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('Impossible dé générer la miniature.');
  const safeName = String(sourceName || 'miniature').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase() || 'miniature';
  return new File([blob], `${safeName}-${crop.label.replace(':', 'x')}.webp`, { type: 'image/webp' });
};
