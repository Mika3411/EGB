import { describe, expect, it } from 'vitest';
import {
  buildGltfTransformOptimizeArgs,
  buildGltfTransformMeshoptArgs,
  buildGltfTransformWebpArgs,
  assertModelToolRateLimit,
  assertModelToolZipBudget,
  getQualityTextureVariants,
  getModelToolLimits,
  getModelToolQualitySettings,
  getModelToolOutputOversize,
  resetModelToolRateLimitBuckets,
  scoreQualityCandidateSize,
} from '../../server/modelTools';

describe('model tools quality presets', () => {
  it('keeps the source-meshopt preset texture-safe for local FBX character imports', () => {
    const settings = getModelToolQualitySettings('source-meshopt');
    const args = buildGltfTransformMeshoptArgs('in.glb', 'out.glb', settings);

    expect(settings.outputSuffix).toBe('source-meshopt');
    expect(settings.meshoptOnly).toBe(true);
    expect(settings.textureCompression).toBe(false);
    expect(settings.simplify).toBe(false);
    expect(args).toEqual([
      'meshopt',
      'in.glb',
      'out.glb',
      '--level',
      'high',
    ]);
  });

  it('keeps the source preset uncompressed for local FBX character imports', () => {
    const settings = getModelToolQualitySettings('source');
    const args = buildGltfTransformOptimizeArgs('in.glb', 'out.glb', settings);

    expect(settings.outputSuffix).toBe('source');
    expect(settings.skipOptimization).toBe(true);
    expect(settings.allowOutputLargerThanInput).toBe(true);
    expect(args[args.indexOf('--compress') + 1]).toBe('false');
    expect(args[args.indexOf('--texture-compress') + 1]).toBe('false');
    expect(args[args.indexOf('--simplify') + 1]).toBe('false');
  });

  it('exports animation-only imports without mesh compression', () => {
    const settings = getModelToolQualitySettings('animation-source-v2');

    expect(settings.outputSuffix).toBe('animation-source-v2');
    expect(settings.animationOnly).toBe(true);
    expect(settings.skipOptimization).toBe(true);
    expect(settings.textureCompression).toBe(false);
    expect(settings.compression).toBe(false);
    expect(settings.simplify).toBe(false);
  });

  it('keeps the quality preset high fidelity instead of web-compressing it', () => {
    const settings = getModelToolQualitySettings('quality');
    const args = buildGltfTransformOptimizeArgs('in.glb', 'out.glb', settings);

    expect(settings.outputSuffix).toBe('quality');
    expect(args).toContain('--compress');
    expect(args).toContain('--texture-compress');
    expect(args).toContain('--texture-size');
    expect(args).toContain('--simplify');
    expect(settings.texturePipeline).toBe('webp-quality');
    expect(settings.targetOutputRatio).toBe(0.6);
    expect(settings.minOutputRatio).toBe(0.85);
    expect(settings.maxOutputRatio).toBe(1.15);
    expect(settings.minTargetOutputBytes).toBe(48 * 1024 * 1024);
    expect(args[args.indexOf('--compress') + 1]).toBe('meshopt');
    expect(args[args.indexOf('--texture-compress') + 1]).toBe('false');
    expect(args[args.indexOf('--texture-size') + 1]).toBe('2048');
    expect(args[args.indexOf('--simplify') + 1]).toBe('false');
    expect(args[args.indexOf('--meshopt-level') + 1]).toBe('high');

    const webpArgs = buildGltfTransformWebpArgs('in.glb', 'out.glb', settings);
    expect(webpArgs[webpArgs.indexOf('--quality') + 1]).toBe('92');
    expect(webpArgs[webpArgs.indexOf('--effort') + 1]).toBe('85');
    const losslessWebpArgs = buildGltfTransformWebpArgs('in.glb', 'out.glb', {
      ...settings,
      textureQuality: 100,
      textureLossless: true,
    });
    expect(losslessWebpArgs).toEqual(expect.arrayContaining(['--lossless', 'true']));
    expect(buildGltfTransformMeshoptArgs('in.glb', 'out.glb', settings)).toEqual([
      'meshopt',
      'in.glb',
      'out.glb',
      '--level',
      'high',
    ]);

    expect(getQualityTextureVariants(settings)).toEqual([
      expect.objectContaining({ textureSize: 4096, textureEncoding: 'source', compression: false }),
      expect.objectContaining({ textureSize: 3072, textureEncoding: 'source', compression: false }),
      expect.objectContaining({ textureSize: 2048, textureEncoding: 'source', compression: false }),
      expect.objectContaining({ textureSize: 1536, textureEncoding: 'source', compression: false }),
      expect.objectContaining({ textureSize: 1024, textureEncoding: 'source', compression: false }),
      expect.objectContaining({ textureSize: 4096, textureEncoding: 'source', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 3072, textureEncoding: 'source', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureEncoding: 'source', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 1536, textureEncoding: 'source', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 100, textureEncoding: 'webp', compression: 'meshopt', textureLossless: true }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 100, textureEncoding: 'webp', compression: 'meshopt', textureNearLossless: true }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 100, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 99, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 98, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 97, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 96, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 94, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 92, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 88, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 4096, textureQuality: 80, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 3072, textureQuality: 90, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 3072, textureQuality: 84, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureQuality: 96, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureQuality: 92, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureQuality: 88, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureQuality: 84, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 2048, textureQuality: 82, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 1536, textureQuality: 92, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 1536, textureQuality: 86, textureEncoding: 'webp', compression: 'meshopt' }),
      expect.objectContaining({ textureSize: 1536, textureQuality: 80, textureEncoding: 'webp', compression: 'meshopt' }),
    ]);
  });

  it('keeps web and lite presets compressed for runtime use', () => {
    const webArgs = buildGltfTransformOptimizeArgs(
      'in.glb',
      'out.glb',
      getModelToolQualitySettings('web'),
    );
    const liteArgs = buildGltfTransformOptimizeArgs(
      'in.glb',
      'out.glb',
      getModelToolQualitySettings('lite'),
    );

    expect(webArgs[webArgs.indexOf('--compress') + 1]).toBe('meshopt');
    expect(webArgs[webArgs.indexOf('--texture-compress') + 1]).toBe('webp');
    expect(liteArgs[liteArgs.indexOf('--texture-size') + 1]).toBe('512');
    expect(liteArgs[liteArgs.indexOf('--simplify-ratio') + 1]).toBe('0.55');
  });

  it('rejects huge quality outputs before undersized compressed candidates', () => {
    const settings = {
      targetOutputBytes: 50 * 1024 * 1024,
      minOutputBytes: 42 * 1024 * 1024,
      maxOutputBytes: 58 * 1024 * 1024,
      maxOutputBytesFromInput: 83 * 1024 * 1024,
    };

    const exactTarget = scoreQualityCandidateSize(50 * 1024 * 1024, settings);
    const compressedCandidate = scoreQualityCandidateSize(30 * 1024 * 1024, settings);
    const hugeCandidate = scoreQualityCandidateSize(617 * 1024 * 1024, settings);

    expect(exactTarget).toBeLessThan(compressedCandidate);
    expect(compressedCandidate).toBeLessThan(hugeCandidate);
    expect(hugeCandidate).toBe(Number.POSITIVE_INFINITY);
  });

  it('flags FBX outputs that are larger than the input file', () => {
    expect(getModelToolOutputOversize(617 * 1024 * 1024, {
      originalInputBytes: 83 * 1024 * 1024,
      maxOutputBytesFromInput: 83 * 1024 * 1024,
    })).toMatchObject({
      outputSize: 617 * 1024 * 1024,
      originalSize: 83 * 1024 * 1024,
    });

    expect(getModelToolOutputOversize(30 * 1024 * 1024, {
      originalInputBytes: 83 * 1024 * 1024,
      maxOutputBytesFromInput: 83 * 1024 * 1024,
    })).toBeNull();
  });

  it('uses safer defaults for upload and ZIP extraction budgets', () => {
    expect(getModelToolLimits({})).toMatchObject({
      maxUploadBytes: 200 * 1024 * 1024,
      zipMaxUncompressedBytes: 512 * 1024 * 1024,
      zipMaxEntries: 512,
      maxActiveJobs: 1,
      maxActiveJobsPerUser: 1,
    });
  });

  it('rejects ZIP extraction entries beyond configured budgets', () => {
    const limits = {
      maxUploadBytes: 10,
      zipMaxUncompressedBytes: 100,
      zipMaxEntries: 2,
      maxActiveJobs: 1,
      maxActiveJobsPerUser: 1,
    };

    expect(() => assertModelToolZipBudget({
      entrySize: 60,
      nextEntryCount: 2,
      currentUncompressedBytes: 30,
      limits,
    })).not.toThrow();
    expect(() => assertModelToolZipBudget({
      entrySize: 60,
      nextEntryCount: 2,
      currentUncompressedBytes: 50,
      limits,
    })).toThrow(/ZIP trop volumineux/);
    expect(() => assertModelToolZipBudget({
      entrySize: 1,
      nextEntryCount: 3,
      currentUncompressedBytes: 0,
      limits,
    })).toThrow(/maximum 2/);
  });

  it('rate-limits model tool job creation by admin and IP', () => {
    resetModelToolRateLimitBuckets();
    const env = {
      MODEL_TOOL_RATE_LIMIT_WINDOW_MS: '1000',
      MODEL_TOOL_RATE_LIMIT_USER_PER_WINDOW: '1',
      MODEL_TOOL_RATE_LIMIT_IP_PER_WINDOW: '5',
    };
    const req = { headers: { 'x-forwarded-for': '192.0.2.10' } };
    const user = { id: 'admin-1' };

    expect(() => assertModelToolRateLimit({ req, user, env, now: 1000 })).not.toThrow();
    expect(() => assertModelToolRateLimit({ req, user, env, now: 1200 })).toThrow(/Trop de conversions 3D/);
    expect(() => assertModelToolRateLimit({ req, user, env, now: 2201 })).not.toThrow();
  });
});
