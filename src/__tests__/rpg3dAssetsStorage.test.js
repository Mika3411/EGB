import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';
import { createDefaultStudioProject } from '../utils/rpg3dStudioProject.js';
import {
  ARCADE_ASSETS_BACKUP_STORAGE_KEY,
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
  getArcadeAssetsContentScore,
  rememberRpg3DLocalBlobFile,
  rememberArcadeAssetsLocally,
  selectPreferredArcadeAssets,
  stripVolatileModelData,
  syncConfigModelReferences,
} from '../utils/rpg3dAssetsStorage.js';

const toDataUrl = (mimeType, text) => `data:${mimeType};base64,${btoa(text)}`;

afterEach(() => {
  window.localStorage.clear();
});

describe('rpg3d assets storage helpers', () => {
  it('keeps the persisted arcade assets format identifiers stable', () => {
    expect(ARCADE_ASSETS_STORAGE_KEY).toBe('escape-game-builder:arcade-assets:v1');
    expect(ARCADE_ASSETS_BACKUP_STORAGE_KEY).toBe('escape-game-builder:arcade-assets-backups:v1');
    expect(ARCADE_ASSETS_REMOTE_VERSION).toBe(2);
  });

  it('keeps the richer RPG 3D save instead of replacing it with a thinner one', () => {
    const richSave = {
      savedAt: '2026-05-21T10:00:00.000Z',
      config: {
        ...cloneConfig(DEFAULT_ARCADE_CONFIG),
        props: [{ id: 'prop-1' }, { id: 'prop-2' }],
        actionZones: [{ id: 'zone-1' }],
      },
      studioProject: {
        ...createDefaultStudioProject(),
        characterModels3d: [{ id: 'hero-model' }],
        decorModels3d: [{ id: 'door-model' }],
      },
    };
    const thinSave = {
      savedAt: '2026-05-22T10:00:00.000Z',
      config: cloneConfig(DEFAULT_ARCADE_CONFIG),
      studioProject: {
        ...createDefaultStudioProject(),
        decorModels3d: [{ id: 'single-object' }],
      },
    };

    expect(getArcadeAssetsContentScore(richSave)).toBeGreaterThan(getArcadeAssetsContentScore(thinSave));
    expect(selectPreferredArcadeAssets(thinSave, richSave)).toBe(richSave);
    expect(selectPreferredArcadeAssets(richSave, thinSave)).toBe(richSave);
  });

  it('backs up the previous local RPG 3D save before replacing it', () => {
    const previousSave = {
      savedAt: '2026-05-21T10:00:00.000Z',
      config: {
        ...cloneConfig(DEFAULT_ARCADE_CONFIG),
        props: [{ id: 'prop-1' }],
      },
      studioProject: createDefaultStudioProject(),
    };
    const nextSave = {
      savedAt: '2026-05-22T10:00:00.000Z',
      config: {
        ...cloneConfig(DEFAULT_ARCADE_CONFIG),
        props: [{ id: 'prop-2' }],
      },
      studioProject: createDefaultStudioProject(),
    };

    window.localStorage.setItem(ARCADE_ASSETS_STORAGE_KEY, JSON.stringify(previousSave));

    expect(rememberArcadeAssetsLocally(nextSave)).toBe(true);

    const backups = JSON.parse(window.localStorage.getItem(ARCADE_ASSETS_BACKUP_STORAGE_KEY) || '[]');
    expect(backups[0].payload.config.props).toEqual([{ id: 'prop-1' }]);
    expect(JSON.parse(window.localStorage.getItem(ARCADE_ASSETS_STORAGE_KEY)).config.props).toEqual([{ id: 'prop-2' }]);
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

  it('syncs equipped character inventory models onto placed actors', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        inventory: [{
          id: 'hero-sword-slot',
          name: 'Epee de test',
          type: 'weapon',
          equipped: true,
          weaponModel3dId: 'sword-model',
          weaponModelScale: 1.4,
          weaponOffsetY: 0.2,
          weaponRotationZ: 45,
          weaponGripHand: 'left',
        }],
      }],
      decorModels3d: [{
        id: 'sword-model',
        kind: 'inventory-weapon',
        name: 'Epee inventaire',
        modelUrl: 'https://cdn.example.com/sword.glb',
        modelName: 'sword.glb',
        modelFormat: 'glb',
        modelFileSize: 321,
        width: 0.5,
        depth: 0.1,
        height: 2,
        modelRotationX: -90,
        modelRotationY: 15,
        modelRotationZ: 45,
        modelResources: [{ name: 'sword.png', url: 'https://cdn.example.com/sword.png' }],
        weaponGripLeftEnabled: true,
        weaponGripLeftY: -0.35,
        weaponGripLeftRotationZ: 90,
      }],
    };

    const synced = syncConfigModelReferences(config, studioProject);
    const weapon = synced.config.player.inventory.find((item) => item.type === 'weapon');

    expect(synced.changed).toBe(true);
    expect(weapon).toMatchObject({
      name: 'Epee de test',
      equipped: true,
      weaponModel3dId: 'sword-model',
      weaponModelUrl: 'https://cdn.example.com/sword.glb',
      weaponModelName: 'sword.glb',
      weaponModelFormat: 'glb',
      weaponModelFileSize: 321,
      weaponModelScale: 1.4,
      weaponModelSourceScale: 2,
      weaponModelRotationX: -90,
      weaponModelRotationY: 15,
      weaponModelRotationZ: 45,
      weaponOffsetY: 0.2,
      weaponRotationZ: 45,
      weaponGripHand: 'left',
      weaponGripReferenceScale: 2,
      weaponGripLeftEnabled: true,
      weaponGripLeftY: -0.35,
      weaponGripLeftRotationZ: 90,
      sourceCharacterEquipment: true,
      sourceCharacterModel3dId: 'hero-model',
    });
    expect(weapon.weaponModelResources).toEqual([{ name: 'sword.png', url: 'https://cdn.example.com/sword.png' }]);
  });

  it('updates linked character equipment size from resized inventory models', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        inventory: [{
          id: 'hero-shield-slot',
          name: 'Bouclier de test',
          type: 'shield',
          equipped: true,
          weaponModel3dId: 'shield-model',
        }],
      }],
      decorModels3d: [{
        id: 'shield-model',
        kind: 'inventory-shield',
        name: 'Bouclier inventaire',
        modelUrl: 'https://cdn.example.com/shield.glb',
        width: 0.4,
        depth: 0.08,
        height: 0.6,
      }],
    };

    const synced = syncConfigModelReferences(config, studioProject);
    let shield = synced.config.player.inventory.find((item) => item.type === 'shield');
    expect(shield.weaponModelScale).toBe(0.6);
    expect(shield.weaponModelSourceScale).toBe(0.6);

    const resizedProject = {
      ...studioProject,
      decorModels3d: [{
        ...studioProject.decorModels3d[0],
        width: 0.001,
        depth: 0.001,
        height: 0.001,
      }],
    };

    const resized = syncConfigModelReferences(synced.config, resizedProject);
    shield = resized.config.player.inventory.find((item) => item.type === 'shield');
    expect(shield.weaponModelScale).toBe(0.001);
    expect(shield.weaponModelSourceScale).toBe(0.001);
  });

  it('ignores stale direct character equipment urls without a linked inventory model', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        inventory: [{
          id: 'hero-stale-sword',
          name: 'Ancienne epee',
          type: 'weapon',
          equipped: true,
          weaponModel3dId: '',
          weaponModelUrl: 'https://cdn.example.com/old-sword.glb',
        }],
      }],
      decorModels3d: [],
    };

    const synced = syncConfigModelReferences(config, studioProject);

    expect(synced.config.player.inventory.some((item) => item.sourceCharacterEquipment)).toBe(false);
    expect(synced.config.player.inventory.some((item) => item.weaponModelUrl === 'https://cdn.example.com/old-sword.glb')).toBe(false);
  });

  it('syncs legacy named equipment models even when their kind is still decor', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        inventory: [{
          id: 'hero-sword-slot',
          name: 'Epee heritee',
          type: 'weapon',
          equipped: true,
          weaponModel3dId: 'legacy-sword',
        }],
      }],
      decorModels3d: [{
        id: 'legacy-sword',
        kind: 'decor',
        name: 'Legacy sword',
        modelUrl: 'https://cdn.example.com/legacy-sword.glb',
      }],
    };

    const synced = syncConfigModelReferences(config, studioProject);
    const weapon = synced.config.player.inventory.find((item) => item.type === 'weapon');

    expect(weapon).toMatchObject({
      sourceCharacterEquipment: true,
      weaponModel3dId: 'legacy-sword',
      weaponModelUrl: 'https://cdn.example.com/legacy-sword.glb',
    });
  });

  it('preserves placed object overrides while syncing model asset references', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.player.characterModel3dId = 'hero-model';
    config.player.characterModelUrl = 'old-hero.glb';
    config.player.characterModelScale = 2.4;
    config.player.characterModelScaleX = 1.5;
    config.player.characterModelScaleY = 2.4;
    config.player.characterModelScaleZ = 0.8;
    config.player.characterMaterialBrightness = 0.45;
    config.props = [{
      id: 'statue-prop',
      x: 120,
      y: 240,
      decorModel3dId: 'statue-model',
      decorModelUrl: 'old-statue.glb',
      renderMode: 'glb',
      w: 320,
      h: 180,
      r: 220,
      modelHeight: 260,
      blocksMovement: false,
      materialBrightness: 0.4,
      decorModelScale: 2.25,
      modelRotationX: 25,
      modelRotationY: -35,
      modelRotationZ: 12,
      modelCenterOnOrigin: false,
      modelFlushToGround: false,
    }];

    const studioProject = {
      ...createDefaultStudioProject(),
      characterModels3d: [{
        id: 'hero-model',
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        materialBrightness: 1.3,
        characterModelScaleX: 0.7,
        characterModelScaleY: 0.8,
        characterModelScaleZ: 0.9,
      }],
      decorModels3d: [{
        id: 'statue-model',
        kind: 'wall',
        modelUrl: 'https://cdn.example.com/statue.glb',
        modelName: 'statue.glb',
        width: 5,
        depth: 4,
        height: 3,
        materialBrightness: 1.2,
        decorModelScale: 1,
        modelRotationX: -90,
        modelRotationY: 90,
        modelRotationZ: 45,
        modelCenterOnOrigin: true,
        modelFlushToGround: true,
        collision: true,
      }],
    };

    const synced = syncConfigModelReferences(config, studioProject);

    expect(synced.config.player).toMatchObject({
      characterModelUrl: 'https://cdn.example.com/hero.glb',
      characterModelScale: 2.4,
      characterModelScaleX: 1.5,
      characterModelScaleY: 2.4,
      characterModelScaleZ: 0.8,
      characterMaterialBrightness: 0.45,
    });
    expect(synced.config.props[0]).toMatchObject({
      decorModelUrl: 'https://cdn.example.com/statue.glb',
      decorModelName: 'statue.glb',
      renderMode: 'glb',
      w: 320,
      h: 180,
      r: 220,
      modelHeight: 260,
      blocksMovement: false,
      materialBrightness: 0.4,
      decorModelScale: 2.25,
      modelRotationX: 25,
      modelRotationY: -35,
      modelRotationZ: 12,
      modelCenterOnOrigin: false,
      modelFlushToGround: false,
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
          modelData: toDataUrl('model/gltf-binary', 'hero-glb'),
          localModelFileId: 'local-hero-file',
          modelAnimations: {
            walk: {
              modelUrl: 'blob:http://localhost/walk',
              modelData: toDataUrl('application/vnd.autodesk.fbx', 'walk-fbx'),
              localModelFileId: 'local-walk-file',
            },
          },
        }],
        decorModels3d: [{
          id: 'floor-model',
          modelUrl: 'blob:http://localhost/floor',
          modelData: toDataUrl('model/gltf-binary', 'floor-glb'),
          localModelFileId: 'local-floor-file',
        }],
      },
    });

    expect(snapshot.studioProject.characterModels3d[0]).toMatchObject({
      modelUrl: '',
      modelData: '',
      localModelFileId: 'local-hero-file',
      modelAnimations: {
        walk: {
          modelUrl: '',
          modelData: '',
          localModelFileId: 'local-walk-file',
        },
      },
    });
    expect(snapshot.studioProject.decorModels3d[0]).toMatchObject({
      modelUrl: '',
      modelData: '',
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
