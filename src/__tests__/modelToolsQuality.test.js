import { describe, expect, it } from 'vitest';
import {
  buildGltfTransformOptimizeArgs,
  buildGltfTransformMeshoptArgs,
  buildGltfTransformWebpArgs,
  getQualityTextureVariants,
  getModelToolQualitySettings,
} from '../../server/modelTools';

describe('model tools quality presets', () => {
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
      { textureSize: 4096, textureQuality: 100, textureLossless: true, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 100, textureLossless: false, textureNearLossless: true },
      { textureSize: 4096, textureQuality: 100, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 99, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 98, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 97, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 96, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 94, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 92, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 88, textureLossless: false, textureNearLossless: false },
      { textureSize: 4096, textureQuality: 80, textureLossless: false, textureNearLossless: false },
      { textureSize: 3072, textureQuality: 90, textureLossless: false, textureNearLossless: false },
      { textureSize: 3072, textureQuality: 84, textureLossless: false, textureNearLossless: false },
      { textureSize: 2048, textureQuality: 96, textureLossless: false, textureNearLossless: false },
      { textureSize: 2048, textureQuality: 92, textureLossless: false, textureNearLossless: false },
      { textureSize: 2048, textureQuality: 88, textureLossless: false, textureNearLossless: false },
      { textureSize: 2048, textureQuality: 84, textureLossless: false, textureNearLossless: false },
      { textureSize: 2048, textureQuality: 82, textureLossless: false, textureNearLossless: false },
      { textureSize: 1536, textureQuality: 92, textureLossless: false, textureNearLossless: false },
      { textureSize: 1536, textureQuality: 86, textureLossless: false, textureNearLossless: false },
      { textureSize: 1536, textureQuality: 80, textureLossless: false, textureNearLossless: false },
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
});
