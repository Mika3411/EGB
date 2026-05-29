import { describe, expect, it } from 'vitest';
import {
  EXPORT_ASSET_SOURCE_KINDS,
  classifyExportAssetSourceKind,
  collectExportAssetReferences,
} from '../utils/exportAssetCollector';

const imageData = (label = 'image') => `data:image/png;base64,${label}`;
const audioData = (label = 'audio') => `data:audio/mpeg;base64,${label}`;
const videoData = (label = 'video') => `data:video/mp4;base64,${label}`;
const modelData = (label = 'model') => `data:model/gltf-binary;base64,${label}`;

const allPaths = (references) => references.flatMap((reference) => reference.paths);
const entryForPath = (references, path) => references.find((reference) => reference.paths.includes(path));
const entriesForValue = (references, value) => references.filter((reference) => reference.value === value);

describe('export asset collector', () => {
  it('classifies source values without fetching or normalizing them', () => {
    expect(classifyExportAssetSourceKind(imageData())).toBe(EXPORT_ASSET_SOURCE_KINDS.DATA_URL);
    expect(classifyExportAssetSourceKind('https://cdn.example.com/file.png')).toBe(EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL);
    expect(classifyExportAssetSourceKind('//cdn.example.com/file.png')).toBe(EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL);
    expect(classifyExportAssetSourceKind('assets/file.png')).toBe(EXPORT_ASSET_SOURCE_KINDS.RELATIVE);
    expect(classifyExportAssetSourceKind('')).toBe(EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID);
    expect(classifyExportAssetSourceKind('blob:http://localhost/file')).toBe(EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID);
    expect(classifyExportAssetSourceKind('data:image/png;base64')).toBe(EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID);
  });

  it('collects classic project media, conversations, hero setup, combat and anime2d paths without mutation', () => {
    const sharedBackgroundUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/hall.png';
    const project = {
      assets: [
        { id: 'asset-bg', type: 'image', name: 'Hall Asset.png', url: sharedBackgroundUrl },
        { id: 'asset-audio', type: 'audio', name: 'Theme.mp3', url: 'assets/theme.mp3' },
      ],
      heroAdventure: {
        hero: {
          name: 'Ariane',
          backgroundImageData: imageData('hero-bg'),
          characterImageData: 'https://cdn.example.com/hero.png',
          setupBackgroundImageData: 'assets/setup.png',
          setupMusicData: audioData('setup'),
          setupMusicName: 'Setup.mp3',
        },
        heroes: [{
          name: 'Boris',
          characterImageData: imageData('boris'),
        }],
        combat: {
          backgroundImageData: imageData('combat-bg'),
          backgroundImageName: 'Arena.png',
          heroImageData: imageData('combat-hero'),
          enemyImageData: imageData('combat-enemy'),
          heroHitEffectVideoData: videoData('hero-hit-video'),
          heroHitEffectAudioData: audioData('hero-hit-audio'),
          enemyDeathEffectImageData: 'https://cdn.example.com/enemy-death.png',
          enemyDeathEffectAnime2dSpec: {
            layers: [{ name: 'Flash', src: imageData('death-flash') }],
          },
        },
      },
      scenes: [{
        name: 'Hall',
        backgroundData: sharedBackgroundUrl,
        backgroundName: 'Hall.png',
        musicData: audioData('music'),
        musicName: 'Hall theme.mp3',
        ambientSoundData: 'sounds/ambience.ogg',
        hotspots: [{
          name: 'Chest',
          objectImageData: imageData('chest'),
          secondObjectImageData: 'assets/chest-open.png',
          soundData: 'https://cdn.example.com/chest.wav',
          combatBackgroundImageData: imageData('hotspot-combat-bg'),
          combatHeroImageData: imageData('hotspot-hero'),
          combatEnemyImageData: imageData('hotspot-enemy'),
          logicRules: [{
            name: 'Rule',
            successSoundData: audioData('success'),
            failureSoundData: 'assets/failure.ogg',
          }],
          conversation: {
            nodes: [{
              id: 'intro',
              speaker: 'Oracle',
              replies: [{
                id: 'reply-1',
                label: 'Ask',
                responseImageData: imageData('response'),
                npcPortraitData: 'https://cdn.example.com/oracle.webp',
                responseSoundData: 'assets/reply.mp3',
                ambienceSoundData: '',
                combatHeroImageData: imageData('reply-hero'),
              }],
            }],
          },
        }],
        sceneObjects: [{
          name: 'Door',
          imageData: 'assets/door.png',
          objectImageData: imageData('door-object'),
          popupImage: 'https://cdn.example.com/popup.png',
          popupImageData: imageData('popup-data'),
          soundData: audioData('door-sound'),
          combatEnemyImageData: imageData('object-enemy'),
          anime2dSpec: {
            layers: [{
              name: 'DoorLayer',
              src: imageData('layer-src'),
              originalSrc: 'https://cdn.example.com/original.png',
              layer: { imageData: 'assets/nested-layer.png' },
            }],
          },
          logicRules: [{
            successSoundData: audioData('object-success'),
          }],
        }],
      }],
      items: [
        { name: 'Key', imageData: 'javascript:alert(1)' },
        { name: 'Map', imageData: imageData('map'), imageName: 'Map.png' },
      ],
      cinematics: [{
        name: 'Intro',
        videoData: 'https://cdn.example.com/intro.mp4',
        videoPoster: imageData('poster'),
        anime2dSpec: { layers: [{ src: 'assets/cinematic-layer.png' }] },
        steps: [
          { type: 'audio', src: audioData('step-src'), audioData: 'https://cdn.example.com/voice.mp3' },
          { type: 'anime2d', spec: { layers: [{ imageData: imageData('step-layer') }] } },
          { type: 'image', imageData: 'assets/step-image.png' },
        ],
        slides: [{
          imageData: imageData('slide'),
          imageName: 'Slide.png',
          audioData: 'assets/slide.mp3',
        }],
      }],
      enigmas: [{
        name: 'Code',
        imageData: imageData('enigma'),
        popupBackgroundData: 'https://cdn.example.com/enigma-bg.png',
      }],
      anime2dDraft: {
        layers: [{ name: 'Draft', src: imageData('draft-layer') }],
      },
    };
    const before = JSON.stringify(project);

    const references = collectExportAssetReferences(project);
    const paths = allPaths(references);

    expect(JSON.stringify(project)).toBe(before);
    expect(paths).toEqual(expect.arrayContaining([
      'assets[0].url',
      'assets[1].url',
      'heroAdventure.hero.backgroundImageData',
      'heroAdventure.hero.characterImageData',
      'heroAdventure.hero.setupBackgroundImageData',
      'heroAdventure.hero.setupMusicData',
      'heroAdventure.heroes[0].characterImageData',
      'heroAdventure.combat.backgroundImageData',
      'heroAdventure.combat.heroImageData',
      'heroAdventure.combat.enemyImageData',
      'heroAdventure.combat.heroHitEffectVideoData',
      'heroAdventure.combat.heroHitEffectAudioData',
      'heroAdventure.combat.enemyDeathEffectImageData',
      'heroAdventure.combat.enemyDeathEffectAnime2dSpec.layers[0].src',
      'scenes[0].backgroundData',
      'scenes[0].musicData',
      'scenes[0].ambientSoundData',
      'scenes[0].hotspots[0].objectImageData',
      'scenes[0].hotspots[0].secondObjectImageData',
      'scenes[0].hotspots[0].soundData',
      'scenes[0].hotspots[0].combatBackgroundImageData',
      'scenes[0].hotspots[0].combatHeroImageData',
      'scenes[0].hotspots[0].combatEnemyImageData',
      'scenes[0].hotspots[0].logicRules[0].successSoundData',
      'scenes[0].hotspots[0].logicRules[0].failureSoundData',
      'scenes[0].hotspots[0].conversation.nodes[0].replies[0].responseImageData',
      'scenes[0].hotspots[0].conversation.nodes[0].replies[0].npcPortraitData',
      'scenes[0].hotspots[0].conversation.nodes[0].replies[0].responseSoundData',
      'scenes[0].hotspots[0].conversation.nodes[0].replies[0].ambienceSoundData',
      'scenes[0].hotspots[0].conversation.nodes[0].replies[0].combatHeroImageData',
      'scenes[0].sceneObjects[0].imageData',
      'scenes[0].sceneObjects[0].objectImageData',
      'scenes[0].sceneObjects[0].popupImage',
      'scenes[0].sceneObjects[0].popupImageData',
      'scenes[0].sceneObjects[0].soundData',
      'scenes[0].sceneObjects[0].combatEnemyImageData',
      'scenes[0].sceneObjects[0].anime2dSpec.layers[0].src',
      'scenes[0].sceneObjects[0].anime2dSpec.layers[0].originalSrc',
      'scenes[0].sceneObjects[0].anime2dSpec.layers[0].layer.imageData',
      'scenes[0].sceneObjects[0].logicRules[0].successSoundData',
      'items[0].imageData',
      'items[1].imageData',
      'cinematics[0].videoData',
      'cinematics[0].videoPoster',
      'cinematics[0].anime2dSpec.layers[0].src',
      'cinematics[0].steps[0].src',
      'cinematics[0].steps[0].audioData',
      'cinematics[0].steps[1].spec.layers[0].imageData',
      'cinematics[0].steps[2].imageData',
      'cinematics[0].slides[0].imageData',
      'cinematics[0].slides[0].audioData',
      'enigmas[0].imageData',
      'enigmas[0].popupBackgroundData',
      'anime2dDraft.layers[0].src',
    ]));

    const shared = entriesForValue(references, sharedBackgroundUrl);
    expect(shared).toHaveLength(1);
    expect(shared[0].paths).toEqual(['assets[0].url', 'scenes[0].backgroundData']);
    expect(shared[0]).toMatchObject({
      mediaType: 'image',
      preferredName: 'Hall Asset.png',
      targetFolder: 'images',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL,
    });

    expect(entryForPath(references, 'heroAdventure.hero.setupMusicData')).toMatchObject({
      mediaType: 'audio',
      preferredName: 'Setup.mp3',
      targetFolder: 'audio',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.DATA_URL,
    });
    expect(entryForPath(references, 'scenes[0].hotspots[0].conversation.nodes[0].replies[0].npcPortraitData')).toMatchObject({
      mediaType: 'image',
      targetFolder: 'portraits',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL,
    });
    expect(entryForPath(references, 'items[0].imageData')).toMatchObject({
      mediaType: 'image',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID,
    });
    expect(entryForPath(references, 'cinematics[0].slides[0].audioData')).toMatchObject({
      mediaType: 'audio',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.RELATIVE,
    });
  });

  it('collects GLB/model references from studio assets and RPG 3D canvas configs', () => {
    const project = {
      characterModels3d: [{
        name: 'Hero model',
        modelUrl: 'https://cdn.example.com/hero.glb',
        modelName: 'hero.glb',
        modelData: modelData('hero-inline'),
        modelResources: [
          { name: 'hero.png', url: 'https://cdn.example.com/hero.png' },
          { name: 'hero.mtl', data: 'data:text/plain;base64,bXRs' },
        ],
        modelAnimations: {
          idle: {
            modelUrl: 'https://cdn.example.com/idle.fbx',
            modelName: 'idle.fbx',
            modelResources: [{ name: 'idle.png', url: 'assets/idle.png' }],
          },
        },
        inventory: [{
          name: 'Sword',
          weaponModelUrl: 'assets/sword.glb',
          weaponModelResources: [{ name: 'sword.png', data: imageData('sword') }],
        }],
      }],
      decorModels3d: [{
        name: 'Floor',
        imageData: imageData('floor-preview'),
        modelUrl: 'https://cdn.example.com/floor.glb',
        modelResources: [{ name: 'floor.bin', url: 'https://cdn.example.com/floor.bin' }],
      }],
      mediaAssets: [{
        type: 'image',
        name: 'Studio poster',
        url: imageData('poster'),
      }],
      rpg3dCanvases: [{
        config: {
          player: {
            name: 'Player',
            characterImageData: imageData('player'),
            characterModelUrl: 'https://cdn.example.com/player.glb',
            characterModelName: 'player.glb',
            characterModelResources: [{ name: 'player.png', url: 'https://cdn.example.com/player.png' }],
            characterModelAnimations: {
              walk: {
                modelData: 'data:application/vnd.autodesk.fbx;base64,d2Fsaw==',
                modelName: 'walk.fbx',
              },
            },
            inventory: [{
              name: 'Player sword',
              weaponModelUrl: 'https://cdn.example.com/player-sword.glb',
            }],
          },
          heroes: [{
            name: 'Ally',
            characterModelUrl: 'assets/ally.glb',
          }],
          enemies: [{
            name: 'Guard',
            characterImageData: 'https://cdn.example.com/guard.png',
          }],
          props: [{
            name: 'Statue',
            imageData: 'assets/statue.png',
            decorModelUrl: 'https://cdn.example.com/statue.glb',
            modelResources: [{ name: 'statue.bin', url: 'https://cdn.example.com/statue.bin' }],
          }],
          mediaAssets: [{
            kind: 'audio',
            name: 'Roar',
            url: 'https://cdn.example.com/roar.mp3',
          }],
        },
      }],
    };

    const references = collectExportAssetReferences(project);
    const paths = allPaths(references);

    expect(paths).toEqual(expect.arrayContaining([
      'characterModels3d[0].modelUrl',
      'characterModels3d[0].modelData',
      'characterModels3d[0].modelResources[0].url',
      'characterModels3d[0].modelResources[1].data',
      'characterModels3d[0].modelAnimations.idle.modelUrl',
      'characterModels3d[0].modelAnimations.idle.modelResources[0].url',
      'characterModels3d[0].inventory[0].weaponModelUrl',
      'characterModels3d[0].inventory[0].weaponModelResources[0].data',
      'decorModels3d[0].imageData',
      'decorModels3d[0].modelUrl',
      'decorModels3d[0].modelResources[0].url',
      'mediaAssets[0].url',
      'rpg3dCanvases[0].config.player.characterImageData',
      'rpg3dCanvases[0].config.player.characterModelUrl',
      'rpg3dCanvases[0].config.player.characterModelResources[0].url',
      'rpg3dCanvases[0].config.player.characterModelAnimations.walk.modelData',
      'rpg3dCanvases[0].config.player.inventory[0].weaponModelUrl',
      'rpg3dCanvases[0].config.heroes[0].characterModelUrl',
      'rpg3dCanvases[0].config.enemies[0].characterImageData',
      'rpg3dCanvases[0].config.props[0].imageData',
      'rpg3dCanvases[0].config.props[0].decorModelUrl',
      'rpg3dCanvases[0].config.props[0].modelResources[0].url',
      'rpg3dCanvases[0].config.mediaAssets[0].url',
    ]));

    expect(entryForPath(references, 'characterModels3d[0].modelUrl')).toMatchObject({
      mediaType: 'model',
      preferredName: 'hero.glb',
      targetFolder: 'models',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL,
    });
    expect(entryForPath(references, 'characterModels3d[0].modelResources[1].data')).toMatchObject({
      mediaType: 'model-resource',
      preferredName: 'hero.mtl',
      targetFolder: 'model-resources',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.DATA_URL,
    });
    expect(entryForPath(references, 'rpg3dCanvases[0].config.player.characterModelAnimations.walk.modelData')).toMatchObject({
      mediaType: 'model',
      preferredName: 'walk.fbx',
      targetFolder: 'models',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.DATA_URL,
    });
    expect(entryForPath(references, 'rpg3dCanvases[0].config.mediaAssets[0].url')).toMatchObject({
      mediaType: 'audio',
      targetFolder: 'audio',
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL,
    });
  });

  it('can omit empty or invalid slots for future bundling callers', () => {
    const project = {
      scenes: [{
        backgroundData: '',
        musicData: audioData('music'),
      }],
      items: [{
        imageData: 'blob:http://localhost/not-exportable',
      }],
    };

    const references = collectExportAssetReferences(project, { includeEmpty: false });

    expect(allPaths(references)).toEqual(['scenes[0].musicData']);
    expect(references[0]).toMatchObject({
      sourceKind: EXPORT_ASSET_SOURCE_KINDS.DATA_URL,
      mediaType: 'audio',
    });
  });

  it('can return duplicate per-path entries for current standalone bundling', () => {
    const sharedImage = imageData('shared');
    const project = {
      assets: [{ type: 'image', name: 'Library.png', url: sharedImage }],
      scenes: [{ name: 'Hall', backgroundData: sharedImage, backgroundName: 'Hall.png' }],
    };

    const deduped = collectExportAssetReferences(project);
    const perPath = collectExportAssetReferences(project, { dedupe: false });

    expect(entriesForValue(deduped, sharedImage)).toHaveLength(1);
    expect(entriesForValue(perPath, sharedImage)).toHaveLength(2);
    expect(entriesForValue(perPath, sharedImage).map((entry) => entry.path)).toEqual([
      'assets[0].url',
      'scenes[0].backgroundData',
    ]);
  });

  it('returns an empty list for non-project inputs', () => {
    expect(collectExportAssetReferences(null)).toEqual([]);
    expect(collectExportAssetReferences([])).toEqual([]);
    expect(collectExportAssetReferences('project')).toEqual([]);
  });
});
