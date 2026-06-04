import { COMBAT_EFFECT_SLOTS, getCombatEffectFieldBase } from '../services/combatDefaults';

export const EXPORT_ASSET_SOURCE_KINDS = Object.freeze({
  DATA_URL: 'data-url',
  REMOTE_URL: 'remote-url',
  RELATIVE: 'relative',
  EMPTY_OR_INVALID: 'empty/invalid',
});

const DATA_URL_PATTERN = /^data:[^,]*,/i;
const REMOTE_URL_PATTERN = /^(?:https?:)?\/\//i;
const ABSOLUTE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const asArray = (value) => (Array.isArray(value) ? value : []);

const appendPathKey = (basePath, key) => {
  const nextKey = String(key);
  const property = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(nextKey)
    ? `.${nextKey}`
    : `[${JSON.stringify(nextKey)}]`;
  return basePath ? `${basePath}${property}` : nextKey;
};

const appendPathIndex = (basePath, index) => `${basePath}[${index}]`;

export const classifyExportAssetSourceKind = (value) => {
  if (typeof value !== 'string') return EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID;
  const trimmed = value.trim();
  if (!trimmed) return EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID;
  if (trimmed.toLowerCase().startsWith('data:')) {
    return DATA_URL_PATTERN.test(trimmed)
      ? EXPORT_ASSET_SOURCE_KINDS.DATA_URL
      : EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID;
  }
  if (REMOTE_URL_PATTERN.test(trimmed)) return EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL;
  if (ABSOLUTE_SCHEME_PATTERN.test(trimmed)) return EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID;
  return EXPORT_ASSET_SOURCE_KINDS.RELATIVE;
};

const mediaTypeFromMime = (mimeType = '') => {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  if (
    normalized.startsWith('model/')
    || normalized === 'application/octet-stream'
    || normalized === 'application/vnd.autodesk.fbx'
  ) {
    return 'model';
  }
  return '';
};

const mediaTypeFromValue = (value) => {
  if (typeof value !== 'string') return '';
  const dataMatch = /^data:([^;,]+)?/i.exec(value.trim());
  if (dataMatch) return mediaTypeFromMime(dataMatch[1] || '');

  let pathname = value;
  try {
    pathname = new URL(value, 'https://example.invalid').pathname;
  } catch {
    pathname = value;
  }

  const extension = pathname.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(extension)) return 'image';
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'webm'].includes(extension)) return 'audio';
  if (['mp4', 'mov', 'ogv', 'm4v'].includes(extension)) return 'video';
  if (['glb', 'gltf', 'fbx', 'obj'].includes(extension)) return 'model';
  return '';
};

const inferMediaType = ({ field = '', mediaType = '', value, path = '' }) => {
  if (mediaType) return mediaType;

  const fromValue = mediaTypeFromValue(value);
  if (fromValue) return fromValue;

  if (path.includes('modelResources')) return 'model-resource';

  const normalizedField = String(field).toLowerCase();
  if (normalizedField === 'videoposter') return 'image';
  if (normalizedField.includes('music') || normalizedField.includes('sound') || normalizedField.includes('audio')) return 'audio';
  if (normalizedField.includes('video')) return 'video';
  if (normalizedField.includes('model')) return 'model';
  if (
    normalizedField.includes('image')
    || normalizedField.includes('background')
    || normalizedField.includes('portrait')
    || normalizedField.includes('popup')
    || normalizedField.includes('thumbnail')
    || normalizedField === 'src'
  ) {
    return 'image';
  }

  return 'asset';
};

const targetFolderForAssetType = (type = '') => {
  if (type === 'image') return 'images';
  if (type === 'audio') return 'audio';
  if (type === 'video') return 'video';
  if (type === 'model') return 'models';
  return 'assets';
};

const preferredNameFrom = (target, nameKeys = [], fallbackName = '') => {
  const keys = Array.isArray(nameKeys) ? nameKeys : [nameKeys];
  const found = keys
    .map((key) => (key && target ? target[key] : ''))
    .find((value) => typeof value === 'string' && value.trim());
  return found || fallbackName || '';
};

const dedupeKeyFor = ({ path, value, sourceKind }) => {
  if (sourceKind === EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID) return `invalid:${path}`;
  return `${sourceKind}:${String(value)}`;
};

const addReference = (state, reference) => {
  const sourceKind = classifyExportAssetSourceKind(reference.value);
  if (!state.includeEmpty && sourceKind === EXPORT_ASSET_SOURCE_KINDS.EMPTY_OR_INVALID) return;

  const mediaType = inferMediaType({
    field: reference.field,
    mediaType: reference.mediaType,
    value: reference.value,
    path: reference.path,
  });
  const entry = {
    path: reference.path,
    paths: [reference.path],
    value: reference.value,
    mediaType,
    preferredName: reference.preferredName || '',
    targetFolder: reference.targetFolder || targetFolderForAssetType(mediaType),
    sourceKind,
  };

  if (!state.dedupe) {
    state.entries.push(entry);
    return;
  }

  const key = dedupeKeyFor(entry);
  const existing = state.byKey.get(key);

  if (existing) {
    if (!existing.paths.includes(reference.path)) existing.paths.push(reference.path);
    if (!existing.preferredName && entry.preferredName) existing.preferredName = entry.preferredName;
    if (!existing.mediaType && entry.mediaType) existing.mediaType = entry.mediaType;
    if (!existing.targetFolder && entry.targetFolder) existing.targetFolder = entry.targetFolder;
    return;
  }

  state.byKey.set(key, entry);
  state.entries.push(entry);
};

const collectMediaField = (
  state,
  target,
  basePath,
  field,
  {
    nameKeys = [],
    fallbackName = '',
    mediaType = '',
    targetFolder = '',
  } = {},
) => {
  if (!isObject(target) || !hasOwn(target, field)) return;
  addReference(state, {
    path: appendPathKey(basePath, field),
    field,
    value: target[field],
    mediaType,
    preferredName: preferredNameFrom(target, nameKeys, fallbackName),
    targetFolder,
  });
};

const collectModelResources = (state, resources, basePath, fallbackName = 'model-resource') => {
  asArray(resources).forEach((resource, resourceIndex) => {
    if (!isObject(resource)) return;
    const resourcePath = appendPathIndex(basePath, resourceIndex);
    const resourceName = preferredNameFrom(resource, ['name', 'path'], `${fallbackName}-${resourceIndex + 1}`);
    collectMediaField(state, resource, resourcePath, 'url', {
      nameKeys: ['name', 'path'],
      fallbackName: resourceName,
      mediaType: 'model-resource',
      targetFolder: 'model-resources',
    });
    collectMediaField(state, resource, resourcePath, 'data', {
      nameKeys: ['name', 'path'],
      fallbackName: resourceName,
      mediaType: 'model-resource',
      targetFolder: 'model-resources',
    });
    collectMediaField(state, resource, resourcePath, 'src', {
      nameKeys: ['name', 'path'],
      fallbackName: resourceName,
      mediaType: 'model-resource',
      targetFolder: 'model-resources',
    });
    collectMediaField(state, resource, resourcePath, 'downloadUrl', {
      nameKeys: ['name', 'path'],
      fallbackName: resourceName,
      mediaType: 'model-resource',
      targetFolder: 'model-resources',
    });
  });
};

const collectModelAnimation = (state, animation, animationPath, fallbackName = 'animation') => {
  if (!isObject(animation)) return;
  collectMediaField(state, animation, animationPath, 'modelUrl', {
    nameKeys: ['modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, animation, animationPath, 'modelData', {
    nameKeys: ['modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, animation, animationPath, 'url', {
    nameKeys: ['modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, animation, animationPath, 'data', {
    nameKeys: ['modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(
    state,
    animation.modelResources || animation.resources,
    appendPathKey(animationPath, animation.modelResources ? 'modelResources' : 'resources'),
    `${fallbackName}-resource`,
  );
};

const collectModelAnimations = (state, animations, basePath, fallbackName = 'animation') => {
  if (!isObject(animations)) return;
  Object.entries(animations).forEach(([slot, animation]) => {
    collectModelAnimation(
      state,
      animation,
      appendPathKey(basePath, slot),
      `${fallbackName}-${slot}`,
    );
  });
};

const collectAnime2dSpecMedia = (state, spec, specPath, targetFolder = 'animations', fallbackName = 'anime2d') => {
  if (!isObject(spec) || !Array.isArray(spec.layers)) return;
  spec.layers.forEach((layer, layerIndex) => {
    if (!isObject(layer)) return;
    const layerPath = `${specPath}.layers[${layerIndex}]`;
    const layerName = `${fallbackName}-${layer.name || `layer-${layerIndex + 1}`}`;
    collectMediaField(state, layer, layerPath, 'src', {
      nameKeys: ['name'],
      fallbackName: layerName,
      mediaType: 'image',
      targetFolder,
    });
    collectMediaField(state, layer, layerPath, 'imageData', {
      nameKeys: ['name'],
      fallbackName: layerName,
      mediaType: 'image',
      targetFolder,
    });
    collectMediaField(state, layer, layerPath, 'originalSrc', {
      nameKeys: ['name'],
      fallbackName: `${layerName}-original`,
      mediaType: 'image',
      targetFolder,
    });

    if (isObject(layer.layer)) {
      const nestedPath = `${layerPath}.layer`;
      collectMediaField(state, layer.layer, nestedPath, 'src', {
        nameKeys: ['name'],
        fallbackName: layerName,
        mediaType: 'image',
        targetFolder,
      });
      collectMediaField(state, layer.layer, nestedPath, 'imageData', {
        nameKeys: ['name'],
        fallbackName: layerName,
        mediaType: 'image',
        targetFolder,
      });
      collectMediaField(state, layer.layer, nestedPath, 'originalSrc', {
        nameKeys: ['name'],
        fallbackName: `${layerName}-original`,
        mediaType: 'image',
        targetFolder,
      });
    }
  });
};

const collectCombatActorMedia = (state, target, targetPath, prefix, fallbackName) => {
  if (!isObject(target)) return;
  collectMediaField(state, target, targetPath, `${prefix}ImageData`, {
    nameKeys: [`${prefix}ImageName`],
    fallbackName: `${fallbackName}-image`,
    mediaType: 'image',
    targetFolder: 'combat',
  });
  collectAnime2dSpecMedia(
    state,
    target[`${prefix}Anime2dSpec`],
    appendPathKey(targetPath, `${prefix}Anime2dSpec`),
    'animations',
    `${fallbackName}-anime2d`,
  );
};

const collectCombatEntryMedia = (state, entry, entryPath, fallbackName) => {
  if (!isObject(entry)) return;
  collectMediaField(state, entry, entryPath, 'combatBackgroundImageData', {
    nameKeys: ['combatBackgroundImageName'],
    fallbackName: `${fallbackName}-background`,
    mediaType: 'image',
    targetFolder: 'combat',
  });
  collectCombatActorMedia(state, entry, entryPath, 'combatHero', `${fallbackName}-hero`);
  collectCombatActorMedia(state, entry, entryPath, 'combatEnemy', `${fallbackName}-enemy`);
};

const collectCombatSettingsMedia = (state, combat, combatPath, fallbackName = 'combat') => {
  if (!isObject(combat)) return;
  collectMediaField(state, combat, combatPath, 'backgroundImageData', {
    nameKeys: ['backgroundImageName'],
    fallbackName: `${fallbackName}-background`,
    mediaType: 'image',
    targetFolder: 'combat',
  });
  collectCombatActorMedia(state, combat, combatPath, 'hero', `${fallbackName}-hero`);
  collectCombatActorMedia(state, combat, combatPath, 'enemy', `${fallbackName}-enemy`);

  COMBAT_EFFECT_SLOTS.forEach(({ actor, outcome }) => {
    const base = getCombatEffectFieldBase(actor, outcome);
    const effectName = `${fallbackName}-${actor}-${outcome}`;
    collectMediaField(state, combat, combatPath, `${base}ImageData`, {
      nameKeys: [`${base}ImageName`],
      fallbackName: `${effectName}-image`,
      mediaType: 'image',
      targetFolder: 'combat',
    });
    collectAnime2dSpecMedia(
      state,
      combat[`${base}Anime2dSpec`],
      appendPathKey(combatPath, `${base}Anime2dSpec`),
      'animations',
      `${effectName}-anime2d`,
    );
    collectMediaField(state, combat, combatPath, `${base}VideoData`, {
      nameKeys: [`${base}VideoName`],
      fallbackName: `${effectName}-video`,
      mediaType: 'video',
      targetFolder: 'video',
    });
    collectMediaField(state, combat, combatPath, `${base}AudioData`, {
      nameKeys: [`${base}AudioName`],
      fallbackName: `${effectName}-audio`,
      mediaType: 'audio',
      targetFolder: 'audio',
    });
  });
};

const collectLogicRuleMedia = (state, rule, rulePath, fallbackName) => {
  if (!isObject(rule)) return;
  collectMediaField(state, rule, rulePath, 'successSoundData', {
    nameKeys: ['successSoundName'],
    fallbackName: `${fallbackName}-success`,
    mediaType: 'audio',
    targetFolder: 'audio',
  });
  collectMediaField(state, rule, rulePath, 'failureSoundData', {
    nameKeys: ['failureSoundName'],
    fallbackName: `${fallbackName}-failure`,
    mediaType: 'audio',
    targetFolder: 'audio',
  });
};

const collectConversationMedia = (state, conversation, conversationPath, fallbackName) => {
  if (!isObject(conversation)) return;
  asArray(conversation.nodes).forEach((node, nodeIndex) => {
    if (!isObject(node)) return;
    const nodePath = `${conversationPath}.nodes[${nodeIndex}]`;
    asArray(node.replies).forEach((reply, replyIndex) => {
      if (!isObject(reply)) return;
      const replyPath = `${nodePath}.replies[${replyIndex}]`;
      const replyName = `${fallbackName}-${node.speaker || node.id || `node-${nodeIndex + 1}`}-${reply.label || reply.id || `reply-${replyIndex + 1}`}`;
      collectMediaField(state, reply, replyPath, 'responseImageData', {
        nameKeys: ['responseImageName'],
        fallbackName: `${replyName}-response`,
        mediaType: 'image',
        targetFolder: 'conversations',
      });
      collectMediaField(state, reply, replyPath, 'npcPortraitData', {
        nameKeys: ['npcPortraitName'],
        fallbackName: `${replyName}-portrait`,
        mediaType: 'image',
        targetFolder: 'portraits',
      });
      collectMediaField(state, reply, replyPath, 'responseSoundData', {
        nameKeys: ['responseSoundName'],
        fallbackName: `${replyName}-response-sound`,
        mediaType: 'audio',
        targetFolder: 'audio',
      });
      collectMediaField(state, reply, replyPath, 'ambienceSoundData', {
        nameKeys: ['ambienceSoundName'],
        fallbackName: `${replyName}-ambience`,
        mediaType: 'audio',
        targetFolder: 'audio',
      });
      collectCombatEntryMedia(state, reply, replyPath, `${replyName}-combat`);
    });
  });
};

const collectHeroSheetMedia = (state, hero, heroPath, fallbackName = 'hero') => {
  if (!isObject(hero)) return;
  collectMediaField(state, hero, heroPath, 'backgroundImageData', {
    nameKeys: ['backgroundImageName', 'name'],
    fallbackName: `${fallbackName}-background`,
    mediaType: 'image',
    targetFolder: 'hero',
  });
  collectMediaField(state, hero, heroPath, 'characterImageData', {
    nameKeys: ['characterImageName', 'name'],
    fallbackName: `${fallbackName}-character`,
    mediaType: 'image',
    targetFolder: 'hero',
  });
  collectMediaField(state, hero, heroPath, 'setupBackgroundImageData', {
    nameKeys: ['setupBackgroundImageName', 'name'],
    fallbackName: `${fallbackName}-setup-background`,
    mediaType: 'image',
    targetFolder: 'hero',
  });
  collectMediaField(state, hero, heroPath, 'setupMusicData', {
    nameKeys: ['setupMusicName', 'name'],
    fallbackName: `${fallbackName}-setup-music`,
    mediaType: 'audio',
    targetFolder: 'audio',
  });
};

const collectHeroAdventureMedia = (state, heroAdventure) => {
  if (!isObject(heroAdventure)) return;
  collectHeroSheetMedia(state, heroAdventure.hero, 'heroAdventure.hero', heroAdventure.hero?.name || 'hero');
  asArray(heroAdventure.heroes).forEach((hero, heroIndex) => {
    collectHeroSheetMedia(
      state,
      hero,
      `heroAdventure.heroes[${heroIndex}]`,
      hero?.name || `hero-${heroIndex + 1}`,
    );
  });
  collectCombatSettingsMedia(state, heroAdventure.combat, 'heroAdventure.combat', 'combat-default');
};

const collectProjectAssetLibrary = (state, assets) => {
  asArray(assets).forEach((asset, assetIndex) => {
    if (!isObject(asset)) return;
    const assetPath = `assets[${assetIndex}]`;
    const assetType = ['image', 'audio', 'video', 'model'].includes(asset.type) ? asset.type : '';
    const folder = targetFolderForAssetType(assetType);
    const fallbackName = asset.name || asset.id || `asset-${assetIndex + 1}`;
    ['url', 'src', 'data'].forEach((field) => {
      collectMediaField(state, asset, assetPath, field, {
        nameKeys: ['name', 'id'],
        fallbackName,
        mediaType: assetType,
        targetFolder: folder,
      });
    });
  });
};

const collectSceneMedia = (state, scene, scenePath, sceneIndex) => {
  if (!isObject(scene)) return;
  const sceneName = scene.name || `scene-${sceneIndex + 1}`;
  collectMediaField(state, scene, scenePath, 'backgroundData', {
    nameKeys: ['backgroundName', 'name'],
    fallbackName: `${sceneName}-background`,
    mediaType: 'image',
    targetFolder: 'scenes',
  });
  collectMediaField(state, scene, scenePath, 'musicData', {
    nameKeys: ['musicName', 'name'],
    fallbackName: `${sceneName}-music`,
    mediaType: 'audio',
    targetFolder: 'audio',
  });
  collectMediaField(state, scene, scenePath, 'ambientSoundData', {
    nameKeys: ['ambientSoundName', 'name'],
    fallbackName: `${sceneName}-secondary-sound`,
    mediaType: 'audio',
    targetFolder: 'audio',
  });

  asArray(scene.hotspots).forEach((spot, spotIndex) => {
    if (!isObject(spot)) return;
    const spotPath = `${scenePath}.hotspots[${spotIndex}]`;
    const spotName = `${sceneName}-${spot.name || `hotspot-${spotIndex + 1}`}`;
    collectMediaField(state, spot, spotPath, 'objectImageData', {
      nameKeys: ['objectImageName'],
      fallbackName: `${spotName}-image`,
      mediaType: 'image',
      targetFolder: 'hotspots',
    });
    collectMediaField(state, spot, spotPath, 'soundData', {
      nameKeys: ['soundName'],
      fallbackName: `${spotName}-sound`,
      mediaType: 'audio',
      targetFolder: 'audio',
    });
    collectMediaField(state, spot, spotPath, 'secondObjectImageData', {
      nameKeys: ['secondObjectImageName'],
      fallbackName: `${spotName}-second-image`,
      mediaType: 'image',
      targetFolder: 'hotspots',
    });
    collectCombatEntryMedia(state, spot, spotPath, `${spotName}-combat`);
    asArray(spot.logicRules).forEach((rule, ruleIndex) => {
      collectLogicRuleMedia(
        state,
        rule,
        `${spotPath}.logicRules[${ruleIndex}]`,
        `${spotName}-${rule?.name || `rule-${ruleIndex + 1}`}`,
      );
    });
    collectConversationMedia(state, spot.conversation, `${spotPath}.conversation`, spotName);
  });

  asArray(scene.sceneObjects).forEach((object, objectIndex) => {
    if (!isObject(object)) return;
    const objectPath = `${scenePath}.sceneObjects[${objectIndex}]`;
    const objectName = `${sceneName}-object-${objectIndex + 1}`;
    collectMediaField(state, object, objectPath, 'imageData', {
      nameKeys: ['name'],
      fallbackName: objectName,
      mediaType: 'image',
      targetFolder: 'scene-objects',
    });
    collectMediaField(state, object, objectPath, 'objectImageData', {
      nameKeys: ['objectImageName'],
      fallbackName: `${objectName}-object-image`,
      mediaType: 'image',
      targetFolder: 'scene-objects',
    });
    collectMediaField(state, object, objectPath, 'popupImage', {
      nameKeys: ['popupImageName', 'name'],
      fallbackName: `${sceneName}-object-popup-${objectIndex + 1}`,
      mediaType: 'image',
      targetFolder: 'scene-objects',
    });
    collectMediaField(state, object, objectPath, 'popupImageData', {
      nameKeys: ['popupImageName', 'name'],
      fallbackName: `${sceneName}-object-popup-${objectIndex + 1}`,
      mediaType: 'image',
      targetFolder: 'scene-objects',
    });
    collectMediaField(state, object, objectPath, 'soundData', {
      nameKeys: ['soundName', 'name'],
      fallbackName: `${objectName}-sound`,
      mediaType: 'audio',
      targetFolder: 'audio',
    });
    collectAnime2dSpecMedia(state, object.anime2dSpec, `${objectPath}.anime2dSpec`, 'animations', `${objectName}-anime2d`);
    collectCombatEntryMedia(state, object, objectPath, `${objectName}-combat`);
    asArray(object.logicRules).forEach((rule, ruleIndex) => {
      collectLogicRuleMedia(
        state,
        rule,
        `${objectPath}.logicRules[${ruleIndex}]`,
        `${objectName}-${rule?.name || `rule-${ruleIndex + 1}`}`,
      );
    });
  });
};

const collectItemMedia = (state, item, itemPath, itemIndex) => {
  if (!isObject(item)) return;
  collectMediaField(state, item, itemPath, 'imageData', {
    nameKeys: ['imageName', 'name'],
    fallbackName: item.name || `item-${itemIndex + 1}`,
    mediaType: 'image',
    targetFolder: 'items',
  });
};

const collectCinematicMedia = (state, cinematic, cinematicPath, cinematicIndex) => {
  if (!isObject(cinematic)) return;
  const cinematicName = cinematic.name || `cinematic-${cinematicIndex + 1}`;
  collectMediaField(state, cinematic, cinematicPath, 'videoData', {
    nameKeys: ['videoName', 'name'],
    fallbackName: cinematicName,
    mediaType: 'video',
    targetFolder: 'video',
  });
  collectMediaField(state, cinematic, cinematicPath, 'videoPoster', {
    nameKeys: ['videoPosterName', 'name'],
    fallbackName: `${cinematicName}-poster`,
    mediaType: 'image',
    targetFolder: 'cinematics',
  });
  collectAnime2dSpecMedia(state, cinematic.anime2dSpec, `${cinematicPath}.anime2dSpec`, 'animations', `${cinematicName}-anime2d`);

  asArray(cinematic.steps).forEach((step, stepIndex) => {
    if (!isObject(step)) return;
    const stepPath = `${cinematicPath}.steps[${stepIndex}]`;
    const stepName = `${cinematicName}-step-${stepIndex + 1}`;
    const sourceMediaType = step.type === 'audio' ? 'audio' : step.type === 'video' ? 'video' : '';
    const sourceFolder = sourceMediaType === 'audio' ? 'audio' : sourceMediaType === 'video' ? 'video' : 'cinematics';
    collectMediaField(state, step, stepPath, 'src', {
      nameKeys: ['name'],
      fallbackName: stepName,
      mediaType: sourceMediaType,
      targetFolder: sourceFolder,
    });
    collectMediaField(state, step, stepPath, 'imageData', {
      nameKeys: ['imageName', 'name'],
      fallbackName: `${stepName}-image`,
      mediaType: 'image',
      targetFolder: 'cinematics',
    });
    collectMediaField(state, step, stepPath, 'audioData', {
      nameKeys: ['audioName', 'name'],
      fallbackName: `${stepName}-audio`,
      mediaType: 'audio',
      targetFolder: 'audio',
    });
    collectMediaField(state, step, stepPath, 'videoData', {
      nameKeys: ['videoName', 'name'],
      fallbackName: `${stepName}-video`,
      mediaType: 'video',
      targetFolder: 'video',
    });
    collectMediaField(state, step, stepPath, 'videoPoster', {
      nameKeys: ['videoPosterName', 'name'],
      fallbackName: `${stepName}-poster`,
      mediaType: 'image',
      targetFolder: 'cinematics',
    });
    collectAnime2dSpecMedia(state, step.spec, `${stepPath}.spec`, 'animations', `${stepName}-anime2d`);
  });

  asArray(cinematic.slides).forEach((slide, slideIndex) => {
    if (!isObject(slide)) return;
    const slidePath = `${cinematicPath}.slides[${slideIndex}]`;
    const slideName = `${cinematicName}-slide-${slideIndex + 1}`;
    collectMediaField(state, slide, slidePath, 'imageData', {
      nameKeys: ['imageName'],
      fallbackName: `${slideName}-image`,
      mediaType: 'image',
      targetFolder: 'cinematics',
    });
    collectMediaField(state, slide, slidePath, 'audioData', {
      nameKeys: ['audioName'],
      fallbackName: `${slideName}-audio`,
      mediaType: 'audio',
      targetFolder: 'audio',
    });
  });
};

const collectEnigmaMedia = (state, enigma, enigmaPath, enigmaIndex) => {
  if (!isObject(enigma)) return;
  const enigmaName = enigma.name || `enigma-${enigmaIndex + 1}`;
  collectMediaField(state, enigma, enigmaPath, 'imageData', {
    nameKeys: ['imageName', 'name'],
    fallbackName: enigmaName,
    mediaType: 'image',
    targetFolder: 'enigmas',
  });
  collectMediaField(state, enigma, enigmaPath, 'popupBackgroundData', {
    nameKeys: ['popupBackgroundName'],
    fallbackName: `${enigmaName}-popup-bg`,
    mediaType: 'image',
    targetFolder: 'enigmas',
  });
};

const collectEquipmentModelMedia = (state, item, itemPath, fallbackName) => {
  if (!isObject(item)) return;
  collectMediaField(state, item, itemPath, 'weaponModelUrl', {
    nameKeys: ['weaponModelName', 'modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, item, itemPath, 'weaponModelData', {
    nameKeys: ['weaponModelName', 'modelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, item, itemPath, 'modelUrl', {
    nameKeys: ['modelName', 'weaponModelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, item, itemPath, 'modelData', {
    nameKeys: ['modelName', 'weaponModelName', 'name'],
    fallbackName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(state, item.weaponModelResources, `${itemPath}.weaponModelResources`, `${fallbackName}-resource`);
  collectModelResources(state, item.modelResources, `${itemPath}.modelResources`, `${fallbackName}-resource`);
};

const collectCharacterModelMedia = (state, model, modelPath, modelIndex) => {
  if (!isObject(model)) return;
  const modelName = model.name || `character-model-${modelIndex + 1}`;
  collectMediaField(state, model, modelPath, 'modelUrl', {
    nameKeys: ['modelName', 'name'],
    fallbackName: modelName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, model, modelPath, 'modelData', {
    nameKeys: ['modelName', 'name'],
    fallbackName: modelName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(state, model.modelResources, `${modelPath}.modelResources`, `${modelName}-resource`);
  collectModelAnimations(state, model.modelAnimations, `${modelPath}.modelAnimations`, modelName);
  asArray(model.inventory).forEach((item, itemIndex) => {
    collectEquipmentModelMedia(
      state,
      item,
      `${modelPath}.inventory[${itemIndex}]`,
      item?.name || `${modelName}-equipment-${itemIndex + 1}`,
    );
  });
};

const collectDecorModelMedia = (state, model, modelPath, modelIndex) => {
  if (!isObject(model)) return;
  const modelName = model.name || `decor-model-${modelIndex + 1}`;
  collectMediaField(state, model, modelPath, 'imageData', {
    nameKeys: ['imageName', 'name'],
    fallbackName: `${modelName}-preview`,
    mediaType: 'image',
    targetFolder: 'model-previews',
  });
  collectMediaField(state, model, modelPath, 'modelUrl', {
    nameKeys: ['modelName', 'name'],
    fallbackName: modelName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, model, modelPath, 'modelData', {
    nameKeys: ['modelName', 'name'],
    fallbackName: modelName,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(state, model.modelResources, `${modelPath}.modelResources`, `${modelName}-resource`);
};

const collectRpg3DActorMedia = (state, actor, actorPath, fallbackName = 'actor') => {
  if (!isObject(actor)) return;
  collectMediaField(state, actor, actorPath, 'characterImageData', {
    nameKeys: ['characterImageName', 'name'],
    fallbackName: `${fallbackName}-character`,
    mediaType: 'image',
    targetFolder: 'rpg3d',
  });
  collectMediaField(state, actor, actorPath, 'characterModelUrl', {
    nameKeys: ['characterModelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, actor, actorPath, 'characterModelData', {
    nameKeys: ['characterModelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(
    state,
    actor.characterModelResources,
    `${actorPath}.characterModelResources`,
    `${fallbackName}-model-resource`,
  );
  collectModelAnimations(
    state,
    actor.characterModelAnimations,
    `${actorPath}.characterModelAnimations`,
    `${fallbackName}-animation`,
  );
  asArray(actor.inventory).forEach((item, itemIndex) => {
    collectEquipmentModelMedia(
      state,
      item,
      `${actorPath}.inventory[${itemIndex}]`,
      item?.name || `${fallbackName}-equipment-${itemIndex + 1}`,
    );
  });
};

const collectRpg3DPropMedia = (state, prop, propPath, fallbackName = 'prop') => {
  if (!isObject(prop)) return;
  collectMediaField(state, prop, propPath, 'imageData', {
    nameKeys: ['imageName', 'name'],
    fallbackName: `${fallbackName}-image`,
    mediaType: 'image',
    targetFolder: 'rpg3d',
  });
  collectMediaField(state, prop, propPath, 'decorModelUrl', {
    nameKeys: ['decorModelName', 'modelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, prop, propPath, 'decorModelData', {
    nameKeys: ['decorModelName', 'modelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, prop, propPath, 'modelUrl', {
    nameKeys: ['modelName', 'decorModelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectMediaField(state, prop, propPath, 'modelData', {
    nameKeys: ['modelName', 'decorModelName', 'name'],
    fallbackName: `${fallbackName}-model`,
    mediaType: 'model',
    targetFolder: 'models',
  });
  collectModelResources(state, prop.modelResources, `${propPath}.modelResources`, `${fallbackName}-resource`);
};

const collectMediaAssets = (state, mediaAssets, basePath, fallbackName = 'media-asset') => {
  asArray(mediaAssets).forEach((asset, assetIndex) => {
    if (!isObject(asset)) return;
    const assetPath = `${basePath}[${assetIndex}]`;
    const assetType = ['image', 'audio', 'video', 'model'].includes(asset.type || asset.kind) ? (asset.type || asset.kind) : '';
    ['url', 'src', 'data', 'thumbnailUrl', 'downloadUrl'].forEach((field) => {
      collectMediaField(state, asset, assetPath, field, {
        nameKeys: ['name', 'label', 'id'],
        fallbackName: asset.name || asset.id || `${fallbackName}-${assetIndex + 1}`,
        mediaType: assetType,
        targetFolder: targetFolderForAssetType(assetType),
      });
    });
  });
};

const collectRpg3DConfigMedia = (state, config, configPath) => {
  if (!isObject(config)) return;
  collectRpg3DActorMedia(state, config.player, `${configPath}.player`, config.player?.name || 'player');
  asArray(config.heroes).forEach((hero, heroIndex) => {
    collectRpg3DActorMedia(state, hero, `${configPath}.heroes[${heroIndex}]`, hero?.name || `hero-${heroIndex + 1}`);
  });
  asArray(config.enemies).forEach((enemy, enemyIndex) => {
    collectRpg3DActorMedia(state, enemy, `${configPath}.enemies[${enemyIndex}]`, enemy?.name || `enemy-${enemyIndex + 1}`);
  });
  asArray(config.props).forEach((prop, propIndex) => {
    collectRpg3DPropMedia(state, prop, `${configPath}.props[${propIndex}]`, prop?.name || `prop-${propIndex + 1}`);
  });
  collectMediaAssets(state, config.mediaAssets, `${configPath}.mediaAssets`, 'rpg3d-media');
};

const collectRpg3DMedia = (state, project) => {
  asArray(project.characterModels3d).forEach((model, modelIndex) => {
    collectCharacterModelMedia(state, model, `characterModels3d[${modelIndex}]`, modelIndex);
  });
  asArray(project.decorModels3d).forEach((model, modelIndex) => {
    collectDecorModelMedia(state, model, `decorModels3d[${modelIndex}]`, modelIndex);
  });
  collectMediaAssets(state, project.mediaAssets, 'mediaAssets', 'media');
  asArray(project.rpg3dCanvases).forEach((canvas, canvasIndex) => {
    if (!isObject(canvas)) return;
    collectRpg3DConfigMedia(state, canvas.config, `rpg3dCanvases[${canvasIndex}].config`);
  });
};

export function collectExportAssetReferences(project, options = {}) {
  const state = {
    includeEmpty: options.includeEmpty !== false,
    dedupe: options.dedupe !== false,
    byKey: new Map(),
    entries: [],
  };

  if (!isObject(project)) return [];

  collectProjectAssetLibrary(state, project.assets);
  collectHeroAdventureMedia(state, project.heroAdventure);

  asArray(project.scenes).forEach((scene, sceneIndex) => {
    collectSceneMedia(state, scene, `scenes[${sceneIndex}]`, sceneIndex);
  });

  asArray(project.items).forEach((item, itemIndex) => {
    collectItemMedia(state, item, `items[${itemIndex}]`, itemIndex);
  });

  asArray(project.cinematics).forEach((cinematic, cinematicIndex) => {
    collectCinematicMedia(state, cinematic, `cinematics[${cinematicIndex}]`, cinematicIndex);
  });

  asArray(project.enigmas).forEach((enigma, enigmaIndex) => {
    collectEnigmaMedia(state, enigma, `enigmas[${enigmaIndex}]`, enigmaIndex);
  });

  collectAnime2dSpecMedia(state, project.anime2dDraft, 'anime2dDraft', 'animations', 'anime2d-draft');
  collectRpg3DMedia(state, project);

  return state.entries.map((entry) => ({
    ...entry,
    paths: [...entry.paths],
  }));
}

export const collectExportAssets = collectExportAssetReferences;
