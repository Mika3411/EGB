import { describe, expect, it } from 'vitest';
import { optimizeCharacterGlbFile } from '../shared/utils/glbOptimizer';

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const GLB_MAGIC = 0x46546c67;

const align4 = (value) => (value + 3) & ~3;

const makeGlbFile = (json, filename = 'model.glb') => {
  const jsonSource = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonSource);
  const paddedJson = new Uint8Array(align4(jsonBytes.byteLength));
  paddedJson.fill(0x20);
  paddedJson.set(jsonBytes);
  const binBytes = new Uint8Array(4);
  const totalLength = 12 + 8 + paddedJson.byteLength + 8 + binBytes.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJson.byteLength, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  bytes.set(paddedJson, 20);
  const binHeader = 20 + paddedJson.byteLength;
  view.setUint32(binHeader, binBytes.byteLength, true);
  view.setUint32(binHeader + 4, BIN_CHUNK_TYPE, true);
  bytes.set(binBytes, binHeader + 8);

  return new File([buffer], filename, { type: 'model/gltf-binary' });
};

describe('optimizeCharacterGlbFile', () => {
  it('skips Meshopt/WebP GLBs instead of rewriting extension-dependent texture data', async () => {
    const file = makeGlbFile({
      asset: { version: '2.0' },
      extensionsUsed: ['EXT_meshopt_compression', 'EXT_texture_webp'],
      extensionsRequired: ['EXT_meshopt_compression', 'EXT_texture_webp'],
      buffers: [{ byteLength: 4 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
      images: [{ mimeType: 'image/webp', bufferView: 0 }],
    });

    const result = await optimizeCharacterGlbFile(file, { minFileSize: 0 });

    expect(result.optimized).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('extensions');
    expect(result.file).toBe(file);
  });
});
