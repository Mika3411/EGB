const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const GLB_HEADER_LENGTH = 12;
const GLB_CHUNK_HEADER_LENGTH = 8;

const DEFAULT_CHARACTER_GLB_OPTIONS = {
  maxTextureSize: 1024,
  jpegQuality: 0.82,
  minFileSize: 6 * 1024 * 1024,
};

const align4 = (value) => (value + 3) & ~3;

const decodeJsonChunk = (bytes) => {
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text.replace(/[\u0000\s]+$/g, ''));
};

const encodeJsonChunk = (json) => {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(align4(encoded.byteLength));
  padded.fill(0x20);
  padded.set(encoded);
  return padded;
};

const parseGlb = (buffer) => {
  const view = new DataView(buffer);
  if (view.byteLength < GLB_HEADER_LENGTH || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('Fichier GLB invalide.');
  }

  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error('Version GLB non supportee.');

  const chunks = [];
  let offset = GLB_HEADER_LENGTH;
  while (offset + GLB_CHUNK_HEADER_LENGTH <= view.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + GLB_CHUNK_HEADER_LENGTH;
    const end = start + length;
    if (end > view.byteLength) throw new Error('Chunk GLB invalide.');
    chunks.push({ type, bytes: new Uint8Array(buffer, start, length) });
    offset = end;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK_TYPE);
  const binChunk = chunks.find((chunk) => chunk.type === BIN_CHUNK_TYPE);
  if (!jsonChunk || !binChunk) throw new Error('GLB incomplet.');

  return {
    json: decodeJsonChunk(jsonChunk.bytes),
    bin: binChunk.bytes,
  };
};

const canvasToBlob = (canvas, mimeType, quality) => {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: mimeType, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
};

const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const resizeImageBytes = async (bytes, mimeType, options) => {
  if (typeof createImageBitmap !== 'function') return null;
  const sourceBlob = new Blob([bytes], { type: mimeType || 'image/jpeg' });
  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const longestSide = Math.max(bitmap.width || 1, bitmap.height || 1);
    if (longestSide <= options.maxTextureSize) return null;

    const ratio = options.maxTextureSize / longestSide;
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);

    const optimizedMimeType = 'image/jpeg';
    const optimizedBlob = await canvasToBlob(canvas, optimizedMimeType, options.jpegQuality);
    if (!optimizedBlob) return null;
    const optimizedBytes = new Uint8Array(await optimizedBlob.arrayBuffer());
    if (optimizedBytes.byteLength >= bytes.byteLength * 0.96) return null;

    return {
      bytes: optimizedBytes,
      mimeType: optimizedMimeType,
      width,
      height,
      originalWidth: bitmap.width,
      originalHeight: bitmap.height,
    };
  } finally {
    bitmap.close?.();
  }
};

const rebuildGlb = (json, bin, replacements) => {
  const bufferViews = Array.isArray(json.bufferViews) ? json.bufferViews : [];
  const nextBinParts = [];
  let nextBinLength = 0;

  bufferViews.forEach((bufferView, index) => {
    if ((bufferView.buffer || 0) !== 0) return;
    const replacement = replacements.get(index);
    const sourceOffset = Number(bufferView.byteOffset) || 0;
    const sourceLength = Number(bufferView.byteLength) || 0;
    const bytes = replacement?.bytes || bin.slice(sourceOffset, sourceOffset + sourceLength);
    const alignedOffset = align4(nextBinLength);
    if (alignedOffset > nextBinLength) {
      nextBinParts.push(new Uint8Array(alignedOffset - nextBinLength));
      nextBinLength = alignedOffset;
    }
    nextBinParts.push(bytes);
    bufferView.byteOffset = nextBinLength;
    bufferView.byteLength = bytes.byteLength;
    nextBinLength += bytes.byteLength;
  });

  const paddedBinLength = align4(nextBinLength);
  const nextBin = new Uint8Array(paddedBinLength);
  let offset = 0;
  nextBinParts.forEach((part) => {
    nextBin.set(part, offset);
    offset += part.byteLength;
  });

  if (json.buffers?.[0]) json.buffers[0].byteLength = nextBin.byteLength;

  const jsonBytes = encodeJsonChunk(json);
  const totalLength = GLB_HEADER_LENGTH
    + GLB_CHUNK_HEADER_LENGTH + jsonBytes.byteLength
    + GLB_CHUNK_HEADER_LENGTH + nextBin.byteLength;
  const output = new ArrayBuffer(totalLength);
  const outputView = new DataView(output);
  const outputBytes = new Uint8Array(output);

  outputView.setUint32(0, GLB_MAGIC, true);
  outputView.setUint32(4, 2, true);
  outputView.setUint32(8, totalLength, true);
  outputView.setUint32(12, jsonBytes.byteLength, true);
  outputView.setUint32(16, JSON_CHUNK_TYPE, true);
  outputBytes.set(jsonBytes, 20);

  const binHeaderOffset = 20 + jsonBytes.byteLength;
  outputView.setUint32(binHeaderOffset, nextBin.byteLength, true);
  outputView.setUint32(binHeaderOffset + 4, BIN_CHUNK_TYPE, true);
  outputBytes.set(nextBin, binHeaderOffset + GLB_CHUNK_HEADER_LENGTH);

  return output;
};

export const formatBytes = (bytes = 0) => {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  if (value >= 1024) return `${Math.round(value / 1024)} Ko`;
  return `${Math.round(value)} o`;
};

export const optimizeCharacterGlbFile = async (file, options = {}) => {
  const settings = { ...DEFAULT_CHARACTER_GLB_OPTIONS, ...options };
  if (!file || file.size < settings.minFileSize) {
    return { file, optimized: false, originalSize: file?.size || 0, optimizedSize: file?.size || 0, imageCount: 0 };
  }

  const parsed = parseGlb(await file.arrayBuffer());
  const images = Array.isArray(parsed.json.images) ? parsed.json.images : [];
  const bufferViews = Array.isArray(parsed.json.bufferViews) ? parsed.json.bufferViews : [];
  const replacements = new Map();
  let imageCount = 0;

  for (const image of images) {
    if (!Number.isInteger(image.bufferView)) continue;
    const bufferView = bufferViews[image.bufferView];
    if (!bufferView || (bufferView.buffer || 0) !== 0) continue;
    const mimeType = image.mimeType || 'image/jpeg';
    if (!mimeType.startsWith('image/')) continue;
    const start = Number(bufferView.byteOffset) || 0;
    const end = start + (Number(bufferView.byteLength) || 0);
    const sourceBytes = parsed.bin.slice(start, end);
    let optimized = null;
    try {
      optimized = await resizeImageBytes(sourceBytes, mimeType, settings);
    } catch {
      optimized = null;
    }
    if (!optimized) continue;
    replacements.set(image.bufferView, optimized);
    image.mimeType = optimized.mimeType;
    imageCount += 1;
  }

  if (!replacements.size) {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, imageCount: 0 };
  }

  const optimizedBuffer = rebuildGlb(parsed.json, parsed.bin, replacements);
  if (optimizedBuffer.byteLength >= file.size * 0.98) {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, imageCount: 0 };
  }

  const optimizedFile = new File([optimizedBuffer], file.name || 'modele.glb', {
    type: file.type || 'model/gltf-binary',
    lastModified: Date.now(),
  });

  return {
    file: optimizedFile,
    optimized: true,
    originalSize: file.size,
    optimizedSize: optimizedFile.size,
    imageCount,
  };
};
