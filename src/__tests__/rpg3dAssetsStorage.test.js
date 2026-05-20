import { describe, expect, it } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';
import { createDefaultStudioProject } from '../utils/rpg3dStudioProject.js';
import {
  ARCADE_ASSETS_REMOTE_VERSION,
  ARCADE_ASSETS_STORAGE_KEY,
  blobUrlToFile,
  createLocalArcadeAssetsSnapshot,
  dataUrlToFile,
  forgetRpg3DLocalBlobFile,
  getArcadeAssetsRemotePath,
  getArcadeMediaRemotePath,
  getArcadeModelAnimationRemotePath,
  getArcadeModelAnimationResourceRemotePath,
  getArcadeModelRemotePath,
  getArcadeModelResourceRemotePath,
  getArcadeTextureRemotePath,
  rememberRpg3DLocalBlobFile,
  stripVolatileModelData,
  syncConfigModelReferences,
} from '../utils/rpg3dAssetsStorage.js';

const toDataUrl = (mimeType, text) => `data:${mimeType};base64,${btoa(text)}`;

describe('rpg3d assets storage helpers', () => {
  it('keeps the persisted arcade assets format identifiers stable', () => {
    expect(ARCADE_ASSETS_STORAGE_KEY).toBe('escape-game-builder:arcade-assets:v1');
    expect(ARCADE_ASSETS_REMOTE_VERSION).toBe(2);
  });

  it('converts data URLs to files with the existing mime and naming fallbacks', async () => {
    const glbFile = dataUrlToFile(toDataUrl('application/octet-stream', 'glb-data'), 'hero', {
      mimeType: 'model/gltf-binary',
      extension: 'glb',
    });
    const pngFile = dataUrlToFile(toDataUrl('image/png', 'png-data'), 'texture');

    expect(glbFile).toBeInstanceOf(File);
    expect(glbFile.name).toBe('hero.glb');
    expect(glbFile.type).toBe('model/gltf-binary');
    expect(await glbFile.text()).toBe('glb-data');
    expect(pngFile.name).toBe('texture.png');
    expect(pngFile.type).toBe('image/png');
    expect(await pngFile.text()).toBe('png-data');
  });

  it('keeps local blob imports uploadable after their object URL is no longer fetchable', async () => {
    const blobUrl = 'blob:http://localhost/local-fbx';
    const sourceFile = new File(['fbx-data'], 'floor.fbx', { type: 'application/vnd.autodesk.fbx' });

    expect(rememberRpg3DLocalBlobFile(blobUrl, sourceFile)).toBe(true);

    const restoredFile = await blobUrlToFile(blobUrl, 'floor.fbx', {
      mimeType: 'application/vnd.autodesk.fbx',
      extension: 'fbx',
    });

    expect(restoredFile.name).toBe('floor.fbx');
    expect(restoredFile.type).toBe('application/vnd.autodesk.fbx');
    expect(await restoredFile.text()).toBe('fbx-data');
    expect(forgetRpg3DLocalBlobFile(blobUrl)).toBe(true);
  });

  it('strips volatile model data without changing saved field names', () => {
    const stripped = stripVolatileModelData({
      modelUrl: 'https://cdn.example.com/hero.glb',
      modelData: toDataUrl('model/gltf-binary', 'inline-glb'),
      imageData: toDataUrl('image/png', 'preview'),
      modelAnimations: {
        idle: {
          modelUrl: 'blob:http://localhost/idle',
          modelData: '',
        },
        run: {
          modelUrl: 'https://cdn.example.com/run.fbx',
          modelData: toDataUrl('application/vnd.autodesk.fbx', 'inline-fbx'),
        },
      },
    });

    expect(stripped).toMatchObject({
      modelUrl: '',
      modelData: expect.stringMatching(/^data:model\/gltf-binary/),
      imageData: expect.stringMatching(/^data:image\/png/),
      modelAnimations: {
        idle: {
          modelUrl: '',
          modelData: '',
        },
        run: {
          modelUrl: '',
          modelData: expect.stringMatching(/^data:application\/vnd\.autodesk\.fbx/),
        },
      },
    });

    expect(stripVolatileModelData({
      modelUrl: 'https://cdn.example.com/already-uploaded.glb',
      modelData: 'legacy-inline-or-empty',
    })).toMatchObject({
      modelUrl: 'https://cdn.example.com/already-uploaded.glb',
      modelData: '',
    });
  });

  it('builds stable Supabase remote paths for manifests, models, resources and media', () => {
    expect(getArcadeAssetsRemotePath('user123')).toBe('users/user123/arcade-assets/assets.json');
    expect(getArcadeModelRemotePath('user123', 'characters', 'hero.glb')).toBe('users/user123/arcade-assets/characters/hero.glb');
    expect(getArcadeTextureRemotePath('user123', 'objects', 'floor.png')).toBe('users/user123/arcade-assets/objects/textures/floor.png');
    expect(getArcadeModelResourceRemotePath('user123', 'objects', 'mat.mtl')).toBe('users/user123/arcade-assets/objects/resources/mat.mtl');
    expect(getArcadeModelAnimationRemotePath('user123', 'characters', 'walk', 'walk.fbx')).toBe('users/user123/arcade-assets/characters/animations/walk/walk.fbx');
    expect(getArcadeModelAnimationResourceRemotePath('user123', 'characters', 'walk', 'walk.png')).toBe('users/user123/arcade-assets/characters/animations/walk/resources/walk.png');
    expect(getArcadeMediaRemotePath('user123', 'poster.webp')).toBe('users/user123/arcade-assets/media/poster.webp');
  });

  it('syncs config model references from studio assets before local or remote persistence', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';
    config.player.characterRenderMode = 'capsule';
    config.props = [{
      id: 'floor-prop',
      x: 100,
      y: 200,
      decorModel3dId: 'floor-model',
      renderMode: 'rock',
      imageData: 'preview',
      imageName: 'preview.png',
    }];

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        modelName: 'hero.glb',
        modelFormat: 'glb',
        modelFileSize: 1234,
        modelResources: [{ name: 'hero.png', url: 'https://cdn.example.com/hero.png' }],
        modelAnimations: {
          idle: { modelUrl: 'https://cdn.example.com/idle.fbx', modelName: 'idle.fbx' },
        },
        materialBrightness: 1.2,
      }],
      decorModels3d: [{
        id: 'floor-model',
        kind: 'road',
        modelUrl: 'https://cdn.example.com/floor.glb',
        modelName: 'floor.glb',
        modelFormat: 'glb',
        modelFileSize: 4321,
        modelResources: [{ name: 'floor.png', url: 'https://cdn.example.com/floor.png' }],
        width: 1.8,
        depth: 3.6,
        height: 0.2,
        materialBrightness: 0.7,
        modelRotationX: 200,
        modelRotationY: -200,
        modelRotationZ: 45,
        modelCenterOnOrigin: true,
        modelFlushToGround: true,
        imageData: 'preview',
        imageName: 'preview.png',
        collision: false,
      }],
    };

    const synced = syncConfigModelReferences(config, studioProject);

    expect(synced.changed).toBe(true);
    expect(synced.config.player).toMatchObject({
      characterModelUrl: 'https://cdn.example.com/hero.glb',
      characterModelName: 'hero.glb',
      characterModelFormat: 'glb',
      characterModelFileSize: 1234,
      characterRenderMode: 'glb',
      characterMaterialBrightness: 1.2,
      characterModelAnimations: {
        idle: {
          modelUrl: 'https://cdn.example.com/idle.fbx',
          modelName: 'idle.fbx',
        },
      },
    });
    expect(synced.config.props[0]).toMatchObject({
      decorKind: 'road',
      decorModelUrl: 'https://cdn.example.com/floor.glb',
      decorModelName: 'floor.glb',
      modelFormat: 'glb',
      modelFileSize: 4321,
      renderMode: 'glb',
      w: 100,
      h: 200,
      r: 100,
      modelHeight: 12,
      blocksMovement: false,
      materialBrightness: 0.7,
      modelRotationX: 180,
      modelRotationY: -180,
      modelRotationZ: 45,
      modelCenterOnOrigin: true,
      modelFlushToGround: true,
      imageData: '',
      imageName: '',
      repeatTexture: false,
    });
  });

  it('strips stale local model blob URLs from saved snapshots while keeping recovery ids', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';
    config.player.characterModelUrl = 'blob:http://localhost/hero';
    config.player.characterRenderMode = 'glb';
    config.props = [{
      id: 'floor-prop',
      x: 100,
      y: 200,
      decorModel3dId: 'floor-model',
      decorModelUrl: 'blob:http://localhost/floor',
      renderMode: 'glb',
    }];

    const snapshot = createLocalArcadeAssetsSnapshot({
      config,
      studioProject: {
        ...createDefaultStudioProject(),
        characterModels3d: [{
          id: 'hero-model',
          modelUrl: 'blob:http://localhost/hero',
          localModelFileId: 'local-hero-file',
          modelAnimations: {
            walk: {
              modelUrl: 'blob:http://localhost/walk',
              localModelFileId: 'local-walk-file',
            },
          },
        }],
        decorModels3d: [{
          id: 'floor-model',
          modelUrl: 'blob:http://localhost/floor',
          localModelFileId: 'local-floor-file',
        }],
      },
    });

    expect(snapshot.studioProject.characterModels3d[0]).toMatchObject({
      modelUrl: '',
      localModelFileId: 'local-hero-file',
      modelAnimations: {
        walk: {
          modelUrl: '',
          localModelFileId: 'local-walk-file',
        },
      },
    });
    expect(snapshot.studioProject.decorModels3d[0]).toMatchObject({
      modelUrl: '',
      localModelFileId: 'local-floor-file',
    });
    expect(snapshot.config.player).toMatchObject({
      characterModelUrl: '',
      characterLocalModelFileId: 'local-hero-file',
    });
    expect(snapshot.config.props[0]).toMatchObject({
      decorModelUrl: '',
      decorLocalModelFileId: 'local-floor-file',
    });
  });
});
