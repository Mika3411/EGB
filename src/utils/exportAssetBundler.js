import { COMBAT_EFFECT_SLOTS, getCombatEffectFieldBase } from '../lib/combatDefaults';

const slugify = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'asset';

const dataUrlToBytes = (dataUrl) => {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || '');
  if (!match) return null;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { mimeType, bytes };
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new TextEncoder().encode(decoded);
  return { mimeType, bytes };
};

const extensionFromMime = (mimeType = '') => {
  const mapping = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
  };
  if (mapping[mimeType]) return mapping[mimeType];
  const raw = mimeType.split('/')[1] || 'bin';
  return raw.replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'bin';
};

const deepClone = (value) => JSON.parse(JSON.stringify(value || {}));

const ROUTE_CANVAS_ROOM_LIMIT = 15;
const DEFAULT_ROUTE_CANVAS_ID = 'route_canvas_1';

const makeDefaultCanvas = (index = 0) => ({
  id: index === 0 ? DEFAULT_ROUTE_CANVAS_ID : `route_canvas_${index + 1}`,
  name: `Canvas ${index + 1}`,
});

export const normalizeRouteMapCanvasesForExport = (routeMap) => {
  if (!routeMap || typeof routeMap !== 'object') return;

  const sourceCanvases = Array.isArray(routeMap.canvases) && routeMap.canvases.length
    ? routeMap.canvases
    : [makeDefaultCanvas(0)];
  const usedCanvasIds = new Set();

  routeMap.canvases = sourceCanvases.map((canvas, index) => {
    const fallback = makeDefaultCanvas(index);
    const source = canvas && typeof canvas === 'object' ? canvas : {};
    let id = typeof source.id === 'string' && source.id.trim() ? source.id : fallback.id;
    let dedupeIndex = index + 1;

    while (usedCanvasIds.has(id)) {
      id = `route_canvas_${dedupeIndex + 1}`;
      dedupeIndex += 1;
    }

    usedCanvasIds.add(id);
    return {
      ...source,
      id,
      name: typeof source.name === 'string' && source.name.trim() ? source.name : fallback.name,
    };
  });

  const ensureCanvas = (canvasId) => {
    if (routeMap.canvases.some((canvas) => canvas.id === canvasId)) return;
    routeMap.canvases.push({ id: canvasId, name: `Canvas ${routeMap.canvases.length + 1}` });
  };

  const rooms = Array.isArray(routeMap.rooms) ? routeMap.rooms : [];
  rooms.forEach((room, index) => {
    if (!room || typeof room !== 'object') return;
    const fallbackCanvasIndex = Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT);
    const fallbackCanvas = routeMap.canvases[fallbackCanvasIndex] || makeDefaultCanvas(fallbackCanvasIndex);

    if (!routeMap.canvases[fallbackCanvasIndex]) {
      routeMap.canvases.push(fallbackCanvas);
    }

    const canvasId = typeof room.canvasId === 'string' && room.canvasId.trim()
      ? room.canvasId
      : fallbackCanvas.id;
    room.canvasId = canvasId;
    ensureCanvas(canvasId);
  });

  if (routeMap.actMaps && typeof routeMap.actMaps === 'object') {
    Object.values(routeMap.actMaps).forEach(normalizeRouteMapCanvasesForExport);
  }
};

export function buildExportProjectWithAssets(project, zip) {
  const nextProject = deepClone(project);
  normalizeRouteMapCanvasesForExport(nextProject.routeMap);
  const usedPaths = new Map();

  const uniqueAssetPath = (folder, preferredName, mimeType) => {
    const baseName = slugify(preferredName || 'asset');
    const extension = extensionFromMime(mimeType);
    const prefix = folder ? `assets/${folder}/${baseName}` : `assets/${baseName}`;
    const count = usedPaths.get(prefix) || 0;
    usedPaths.set(prefix, count + 1);
    return count === 0 ? `${prefix}.${extension}` : `${prefix}-${count + 1}.${extension}`;
  };

  const exportMediaField = (target, dataKey, nameKey, folder, fallbackName) => {
    if (!target || !target[dataKey] || typeof target[dataKey] !== 'string') return;
    const value = target[dataKey];
    if (!value.startsWith('data:')) return;

    const parsed = dataUrlToBytes(value);
    if (!parsed) return;

    const assetPath = uniqueAssetPath(folder, target[nameKey] || fallbackName, parsed.mimeType);
    zip.file(assetPath, parsed.bytes);
    target[dataKey] = assetPath;
  };

  const exportAnime2dSpecMedia = (spec, folder, fallbackName) => {
    if (!spec || typeof spec !== 'object' || !Array.isArray(spec.layers)) return;
    spec.layers.forEach((layer, layerIndex) => {
      const layerName = `${fallbackName || 'anime2d'}-${layer.name || `layer-${layerIndex + 1}`}`;
      exportMediaField(layer, 'src', 'name', folder, layerName);
      exportMediaField(layer, 'imageData', 'name', folder, layerName);
      exportMediaField(layer, 'originalSrc', 'name', folder, `${layerName}-original`);
      if (layer.layer && typeof layer.layer === 'object') {
        exportMediaField(layer.layer, 'src', 'name', folder, layerName);
        exportMediaField(layer.layer, 'imageData', 'name', folder, layerName);
        exportMediaField(layer.layer, 'originalSrc', 'name', folder, `${layerName}-original`);
      }
    });
  };

  const exportCombatActorMedia = (target, prefix, fallbackName) => {
    if (!target || typeof target !== 'object') return;
    exportMediaField(target, `${prefix}ImageData`, `${prefix}ImageName`, 'combat', `${fallbackName}-image`);
    exportAnime2dSpecMedia(target[`${prefix}Anime2dSpec`], 'animations', `${fallbackName}-anime2d`);
  };

  const exportCombatEntryMedia = (entry, fallbackName) => {
    if (!entry || typeof entry !== 'object') return;
    exportMediaField(entry, 'combatBackgroundImageData', 'combatBackgroundImageName', 'combat', `${fallbackName}-background`);
    exportCombatActorMedia(entry, 'combatHero', `${fallbackName}-hero`);
    exportCombatActorMedia(entry, 'combatEnemy', `${fallbackName}-enemy`);
  };

  const exportCombatSettingsMedia = (combat, fallbackName = 'combat') => {
    if (!combat || typeof combat !== 'object') return;
    exportMediaField(combat, 'backgroundImageData', 'backgroundImageName', 'combat', `${fallbackName}-background`);
    exportCombatActorMedia(combat, 'hero', `${fallbackName}-hero`);
    exportCombatActorMedia(combat, 'enemy', `${fallbackName}-enemy`);

    COMBAT_EFFECT_SLOTS.forEach(({ actor, outcome }) => {
      const base = getCombatEffectFieldBase(actor, outcome);
      const effectName = `${fallbackName}-${actor}-${outcome}`;
      exportMediaField(combat, `${base}ImageData`, `${base}ImageName`, 'combat', `${effectName}-image`);
      exportAnime2dSpecMedia(combat[`${base}Anime2dSpec`], 'animations', `${effectName}-anime2d`);
      exportMediaField(combat, `${base}VideoData`, `${base}VideoName`, 'video', `${effectName}-video`);
      exportMediaField(combat, `${base}AudioData`, `${base}AudioName`, 'audio', `${effectName}-audio`);
    });
  };

  (nextProject.assets || []).forEach((asset, assetIndex) => {
    exportMediaField(asset, 'url', 'name', asset.type === 'image' ? 'images' : asset.type === 'audio' ? 'audio' : asset.type === 'video' ? 'video' : 'assets', asset.name || asset.id || `asset-${assetIndex + 1}`);
  });

  exportCombatSettingsMedia(nextProject.heroAdventure?.combat, 'combat-default');

  (nextProject.scenes || []).forEach((scene, sceneIndex) => {
    exportMediaField(scene, 'backgroundData', 'backgroundName', 'scenes', scene.name || `scene-${sceneIndex + 1}-background`);
    exportMediaField(scene, 'musicData', 'musicName', 'audio', scene.name || `scene-${sceneIndex + 1}-music`);
    exportMediaField(scene, 'ambientSoundData', 'ambientSoundName', 'audio', `${scene.name || `scene-${sceneIndex + 1}`}-secondary-sound`);

    (scene.hotspots || []).forEach((spot, spotIndex) => {
      const hotspotName = `${scene.name || `scene-${sceneIndex + 1}`}-${spot.name || `hotspot-${spotIndex + 1}`}`;
      exportMediaField(spot, 'objectImageData', 'objectImageName', 'hotspots', `${hotspotName}-image`);
      exportMediaField(spot, 'soundData', 'soundName', 'audio', `${hotspotName}-sound`);
      exportMediaField(spot, 'secondObjectImageData', 'secondObjectImageName', 'hotspots', `${hotspotName}-second-image`);
      exportCombatEntryMedia(spot, `${hotspotName}-combat`);
      (spot.logicRules || []).forEach((rule, ruleIndex) => {
        const ruleName = `${hotspotName}-${rule.name || `rule-${ruleIndex + 1}`}`;
        exportMediaField(rule, 'successSoundData', 'successSoundName', 'audio', `${ruleName}-success`);
        exportMediaField(rule, 'failureSoundData', 'failureSoundName', 'audio', `${ruleName}-failure`);
      });
      (spot.conversation?.nodes || []).forEach((node, nodeIndex) => {
        (node.replies || []).forEach((reply, replyIndex) => {
          const replyName = `${hotspotName}-${node.speaker || node.id || `node-${nodeIndex + 1}`}-${reply.label || reply.id || `reply-${replyIndex + 1}`}`;
          exportCombatEntryMedia(reply, `${replyName}-combat`);
        });
      });
    });

    (scene.sceneObjects || []).forEach((obj, objIndex) => {
      const objectName = `${scene.name || `scene-${sceneIndex + 1}`}-object-${objIndex + 1}`;
      exportMediaField(obj, 'imageData', 'name', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-${objIndex + 1}`);
      exportMediaField(obj, 'popupImage', 'popupImageName', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-popup-${objIndex + 1}`);
      exportMediaField(obj, 'popupImageData', 'popupImageName', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-popup-${objIndex + 1}`);
      exportMediaField(obj, 'soundData', 'soundName', 'audio', `${objectName}-sound`);
      exportAnime2dSpecMedia(obj.anime2dSpec, 'animations', `${objectName}-anime2d`);
      (obj.logicRules || []).forEach((rule, ruleIndex) => {
        const ruleName = `${objectName}-${rule.name || `rule-${ruleIndex + 1}`}`;
        exportMediaField(rule, 'successSoundData', 'successSoundName', 'audio', `${ruleName}-success`);
        exportMediaField(rule, 'failureSoundData', 'failureSoundName', 'audio', `${ruleName}-failure`);
      });
    });
  });

  (nextProject.items || []).forEach((item, itemIndex) => {
    exportMediaField(item, 'imageData', 'imageName', 'items', item.name || `item-${itemIndex + 1}`);
  });

  (nextProject.cinematics || []).forEach((cinematic, cinematicIndex) => {
    const cinematicName = cinematic.name || `cinematic-${cinematicIndex + 1}`;
    exportMediaField(cinematic, 'videoData', 'videoName', 'video', cinematic.name || `cinematic-${cinematicIndex + 1}`);
    exportAnime2dSpecMedia(cinematic.anime2dSpec, 'animations', `${cinematicName}-anime2d`);

    (cinematic.steps || []).forEach((step, stepIndex) => {
      exportMediaField(step, 'src', 'name', step.type === 'audio' ? 'audio' : step.type === 'video' ? 'video' : 'cinematics', `${cinematicName}-step-${stepIndex + 1}`);
      exportAnime2dSpecMedia(step.spec, 'animations', `${cinematicName}-step-${stepIndex + 1}-anime2d`);
    });

    (cinematic.slides || []).forEach((slide, slideIndex) => {
      const slideName = `${cinematic.name || `cinematic-${cinematicIndex + 1}`}-slide-${slideIndex + 1}`;
      exportMediaField(slide, 'imageData', 'imageName', 'cinematics', `${slideName}-image`);
      exportMediaField(slide, 'audioData', 'audioName', 'audio', `${slideName}-audio`);
    });
  });

  (nextProject.enigmas || []).forEach((enigma, enigmaIndex) => {
    exportMediaField(enigma, 'imageData', 'imageName', 'enigmas', enigma.name || `enigma-${enigmaIndex + 1}`);
    exportMediaField(enigma, 'popupBackgroundData', 'popupBackgroundName', 'enigmas', `${enigma.name || `enigma-${enigmaIndex + 1}`}-popup-bg`);
  });

  return nextProject;
}
