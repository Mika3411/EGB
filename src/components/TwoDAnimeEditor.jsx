import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Copy,
  Download,
  Eye,
  FilePlus2,
  ImagePlus,
  Layers,
  Lock,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Unlock,
  Undo2,
  Redo2,
  Wand2,
} from 'lucide-react';
import '../styles/2d-anime.css';
import { getAiAuthHeaders } from '../utils/aiAuthHeaders';
import { createIndexedDraftStorage } from '../utils/indexedDraftStorage';
import { getAnime2dDraftStorageKey } from '../utils/storageHelpers';
import { showConfirm } from './AccessibleDialog';

const ANIMATION_PRESETS = [
  { id: 'none', label: 'Aucun', description: 'Aucune animation.', duration: 1000 },
  { id: 'idle-breathe', label: 'Respiration', description: 'Léger scale vertical pour donner vie à un personnage.', duration: 2400 },
  { id: 'float', label: 'Flottement', description: 'Mouvement doux vers le haut et le bas.', duration: 3200 },
  { id: 'shake', label: 'Tremblement', description: 'Secousse courte pour peur, impact ou surprise.', duration: 650 },
  { id: 'blink', label: 'Clignotement', description: 'Variation rapide d opacite pour écran, lumière ou apparition.', duration: 900 },
  { id: 'reveal', label: 'Apparition', description: 'Entree progressive avec zoom et fondu.', duration: 1100 },
  { id: 'talk', label: 'Parle', description: 'Micro mouvement pour accompagner un dialogue.', duration: 520 },
  { id: 'glow', label: 'Aura', description: 'Halo pulse pour objet magique ou indice important.', duration: 1800 },
  { id: 'embers', label: 'Braises', description: 'Lueur chaude et petites particules qui montent sur les bords brules.', duration: 2200 },
  { id: 'look-around', label: 'Regard', description: 'Balancement léger de tête ou silhouette.', duration: 1600 },
];

const TRANSITION_EFFECTS = [
  { id: 'fade', label: 'Fondu' },
  { id: 'zoom-in', label: 'Zoom doux' },
  { id: 'slide-up', label: 'Montee' },
  { id: 'slide-left', label: 'Glisse gauche' },
  { id: 'flash', label: 'Flash' },
  { id: 'none', label: 'Aucune' },
];

const CHARACTER_STATES = [
  'neutre',
  'parle',
  'peur',
  'colere',
  'surprise',
  'montre',
  'disparait',
];

const BACKDROP_PRESETS = [
  ['room', 'Pièce sombre'],
  ['school', 'Salle dé classe'],
  ['forest', 'Forêt'],
  ['lab', 'Laboratoire'],
];

const FIELD_HELP = {
  stepStart: "Moment où cette étape commence dans la séquence. 0 correspond au début de l’animation.",
  stepDuration: "Temps pendant lequel cette étape reste active. Une durée courte donne un rythme rapide, une durée longue laisse le joueur lire.",
  stepAction: "Choisit ce que l'étape fait aux images : continuer la scène, afficher un calque ou remplacer l’image visible.",
  stepImage: "Calque utilisé par cette étape. Tu peux choisir une image existante ou en ajouter une nouvelle.",
  stepTransitionIn: "Effet utilisé quand l’image apparait pendant cette étape.",
  stepTransitionOut: "Effet utilisé quand l’image disparait ou laisse la place à la suite.",
  stepNarration: "Texte affiché pendant l'étape. Garde-le court pour accompagner l’image sans ralentir la lecture.",
  layerName: "Nom interne du calque. Utilise un nom clair pour le retrouver dans la timeline et le storyboard.",
  layerX: "Position horizontale du centre du calque en pourcentage du canvas.",
  layerY: "Position verticale du centre du calque en pourcentage du canvas.",
  layerSize: "Largeur du calque en pourcentage du canvas. La hauteur suit automatiquement le format de l’image.",
  layerOpacity: "Transparence du calque. 100 est totalement visible, 0 est invisible.",
  layerDuration: "Vitesse du preset d animation du calque, en millisecondes.",
  layerDelay: "Retard avant le lancement du mouvement du calque, en millisecondes.",
  layerLoop: "Repété le mouvement en continu. Utile pour respiration, aura ou flottement.",
  brushSize: "Taille du pinceau utilisé pour gommer ou restaurer l’image sélectionnée.",
  cropLeft: "Position du bord gauche du recadrage dans l’image.",
  cropTop: "Position du bord haut du recadrage dans l’image.",
  cropWidth: "Largeur de la zone conservee par le recadrage.",
  cropHeight: "Hauteur de la zone conservee par le recadrage.",
};

const LEGACY_DRAFT_STORAGE_KEY = 'escapeGameBuilder.2dAnimeDraft.v1';
const ANIME_DRAFT_DB = 'escape-game-builder-2d-anime-drafts';
const animeDraftStorage = createIndexedDraftStorage(ANIME_DRAFT_DB);
const LAYER_SIZE_MIN = 6;
const LAYER_SIZE_MAX = 180;
const LAYER_HEIGHT_MIN = 6;
const LAYER_HEIGHT_MAX = 260;
const CANVAS_ASPECT_RATIO = 16 / 10;
const EXPORT_CANVAS_WIDTH = 1600;
const EXPORT_CANVAS_HEIGHT = 1000;

const defaultLayers = [
  {
    id: 'guide',
    name: 'Personnage exemple',
    type: 'character',
    src: '',
    originalSrc: '',
    preset: 'idle-breathe',
    state: 'neutre',
    x: 50,
    y: 58,
    width: 24,
    height: 38.4,
    opacity: 100,
    duration: 2400,
    delay: 0,
    loop: true,
    visible: true,
    visibleAtStart: true,
    locked: false,
  },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const dataUrlToBlob = async (src) => {
  const response = await fetch(src);
  return response.blob();
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const makeSafeFilename = (value = 'image') => (
  String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'image'
);

const readBestAnimeDraft = async (id) => {
  const exactDraft = await animeDraftStorage.read(id).catch(() => null);
  if (exactDraft?.layers?.length) return exactDraft;
  const localDraft = readStoredDraft(id);
  if (localDraft?.layers?.length) return localDraft;
  return null;
};

const writeBestAnimeDraft = async (id, value) => {
  let indexedSaved = false;
  let localSaved = false;
  try {
    await animeDraftStorage.write(id, value);
    indexedSaved = true;
  } catch {
    indexedSaved = false;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(id, JSON.stringify(value));
      localSaved = true;
    } catch {
      localSaved = false;
    }
  }
  if (!indexedSaved && !localSaved) {
    throw new Error('Sauvegarde du brouillon 2D impossible.');
  }
};

const deleteBestAnimeDraft = async (id) => {
  await animeDraftStorage.remove(id).catch(() => {});
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(id);
    } catch {
      // Ignore browsers that block localStorage.
    }
  }
};

const saveProjectDraftBestEffort = async (onSaveDraft, draft) => {
  if (!onSaveDraft) return true;
  try {
    await onSaveDraft(draft);
    return true;
  } catch (error) {
    console.warn('Copie projet 2D Anime impossible.', error);
    return false;
  }
};

const colorDistance = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
};

const softenAlphaMask = async (src, originalSrc = '') => {
  const image = await loadImage(src);
  const originalImage = originalSrc ? await loadImage(originalSrc) : null;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return src;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  let originalData = null;
  if (originalImage) {
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = canvas.width;
    originalCanvas.height = canvas.height;
    const originalContext = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (originalContext) {
      originalContext.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      originalData = originalContext.getImageData(0, 0, canvas.width, canvas.height).data;
    }
  }
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = data[(index * 4) + 3];
  }

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixelIndex = (y * canvas.width) + x;
      const currentAlpha = alpha[pixelIndex];
      const radius = currentAlpha === 0 ? 14 : 3;
      let total = currentAlpha * 2;
      let count = 2;
      let maxNeighborAlpha = currentAlpha;
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) continue;
          const neighborAlpha = alpha[(ny * canvas.width) + nx];
          total += neighborAlpha;
          maxNeighborAlpha = Math.max(maxNeighborAlpha, neighborAlpha);
          count += 1;
        }
      }
      const restoredEdgeAlpha = currentAlpha === 0 && maxNeighborAlpha > 120 ? 235 : currentAlpha;
      const nextAlpha = Math.max(restoredEdgeAlpha, Math.round(total / count));
      if (originalData && nextAlpha > currentAlpha) {
        const dataIndex = pixelIndex * 4;
        data[dataIndex] = originalData[dataIndex];
        data[dataIndex + 1] = originalData[dataIndex + 1];
        data[dataIndex + 2] = originalData[dataIndex + 2];
      }
      data[(pixelIndex * 4) + 3] = nextAlpha;
    }
  }

  context.putImageData(frame, 0, 0);
  return canvas.toDataURL('image/png');
};

const removeImageBackgroundWithRemoveBg = async (src, onProgress) => {
  onProgress?.('Envoi vers remove.bg...');
  const response = await fetch('/api/remove-background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAiAuthHeaders()),
    },
    body: JSON.stringify({ imageData: src }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `remove.bg a repondu ${response.status}.`);
  }
  if (!payload.imageData) {
    throw new Error('remove.bg n a pas renvoye d image.');
  }
  onProgress?.('Réception du detourage remove.bg...');
  return payload.imageData;
};

const removeImageBackgroundWithAi = async (src, onProgress) => {
  const module = await import('@imgly/background-removal');
  const removeBackground = module.default || module.removeBackground;
  if (typeof removeBackground !== 'function') {
    throw new Error('Module dé detourage IA indisponible.');
  }

  const blob = await removeBackground(src, {
    model: 'isnet',
    output: {
      format: 'image/png',
      quality: 0.9,
      type: 'foreground',
    },
    progress: (key, current, total) => {
      if (!total) {
        onProgress?.('Téléchargement du modele IA...');
        return;
      }
      const percent = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
      onProgress?.(`Modele IA ${percent}%`);
    },
  });

  onProgress?.('Adoucissement des contours...');
  return softenAlphaMask(await blobToDataUrl(blob), src);
};

const removeImageBackground = async (src, tolerance = 42, softness = 18) => {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  const maxSide = 1400;
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height) || 1;
  const ratio = Math.min(1, maxSide / longestSide);
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Detourage impossible dans ce navigateur.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  const { width, height } = canvas;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const removeMask = new Uint8Array(pixelCount);
  const queue = [];

  const readColor = (pixelIndex) => {
    const index = pixelIndex * 4;
    return [data[index], data[index + 1], data[index + 2]];
  };

  const seedPixels = [];
  for (let x = 0; x < width; x += 1) {
    seedPixels.push(x, ((height - 1) * width) + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    seedPixels.push(y * width, (y * width) + width - 1);
  }

  const seedColors = seedPixels
    .filter((pixelIndex) => data[(pixelIndex * 4) + 3] > 0)
    .map(readColor);
  const background = seedColors.length ? seedColors.reduce((sum, sample) => [
    sum[0] + sample[0],
    sum[1] + sample[1],
    sum[2] + sample[2],
  ], [0, 0, 0]).map((value) => value / seedColors.length) : [0, 0, 0];

  seedPixels.forEach((pixelIndex) => {
    if (!visited[pixelIndex]) {
      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    }
  });

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const pixelIndex = queue[queueIndex];
    queueIndex += 1;
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      removeMask[pixelIndex] = 1;
    } else {
      const distance = colorDistance([data[dataIndex], data[dataIndex + 1], data[dataIndex + 2]], background);
      if (distance > tolerance) continue;
      removeMask[pixelIndex] = 1;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const neighbors = [
      x > 0 ? pixelIndex - 1 : -1,
      x < width - 1 ? pixelIndex + 1 : -1,
      y > 0 ? pixelIndex - width : -1,
      y < height - 1 ? pixelIndex + width : -1,
    ];

    neighbors.forEach((neighborIndex) => {
      if (neighborIndex < 0 || visited[neighborIndex]) return;
      visited[neighborIndex] = 1;
      queue.push(neighborIndex);
    });
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (!removeMask[pixelIndex]) continue;
    data[(pixelIndex * 4) + 3] = 0;
  }

  if (softness > 0) {
    const nextAlpha = new Uint8ClampedArray(pixelCount);
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      nextAlpha[pixelIndex] = data[(pixelIndex * 4) + 3];
    }

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      if (removeMask[pixelIndex]) continue;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const touchesRemoved = (
        (x > 0 && removeMask[pixelIndex - 1])
        || (x < width - 1 && removeMask[pixelIndex + 1])
        || (y > 0 && removeMask[pixelIndex - width])
        || (y < height - 1 && removeMask[pixelIndex + width])
      );
      if (touchesRemoved) nextAlpha[pixelIndex] = Math.round(nextAlpha[pixelIndex] * 0.78);
    }

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      data[(pixelIndex * 4) + 3] = nextAlpha[pixelIndex];
    }
  }

  context.putImageData(frame, 0, 0);
  return canvas.toDataURL('image/png');
};

const getPreset = (presetId) => ANIMATION_PRESETS.find((preset) => preset.id === presetId) || ANIMATION_PRESETS[0];

const getLayerTransitionClass = (layer) => {
  if (!layer.__cinematicStepId) return '';
  const phase = layer.__transitionPhase || 'enter';
  return `anime-transition-${phase} anime-transition-${phase}-${layer.__transition || 'fade'}`;
};

const getStageViewportTransform = (pan, zoom) => {
  const normalizedZoom = Number(zoom) || 1;
  const panX = Math.abs(Number(pan.x) || 0) < 0.5 ? 0 : Number(pan.x) || 0;
  const panY = Math.abs(Number(pan.y) || 0) < 0.5 ? 0 : Number(pan.y) || 0;
  return panX || panY
    ? `translate3d(${panX}px, ${panY}px, 0) scale(${normalizedZoom})`
    : `scale(${normalizedZoom})`;
};

const getLayerHeight = (layer) => Number.isFinite(Number(layer?.height))
  ? Number(layer.height)
  : Number(layer?.width || 0) * CANVAS_ASPECT_RATIO;

const normalizeLayerDimensions = (layer) => ({
  ...layer,
  height: getLayerHeight(layer),
});

const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const makeLayer = (file, src) => {
  const preset = getPreset('idle-breathe');
  return {
    id: `anime-layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file?.name?.replace(/\.[^.]+$/, '') || 'Nouveau calque',
    type: 'character',
    src,
    originalSrc: src,
    preset: preset.id,
    state: 'neutre',
    x: 50,
    y: 56,
    width: 28,
    height: 44.8,
    opacity: 100,
    duration: preset.duration,
    delay: 0,
    loop: true,
    visible: true,
    visibleAtStart: false,
    locked: false,
  };
};

const makeCinematicStep = (overrides = {}) => ({
  id: `cine-step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  at: 0,
  duration: 2,
  narration: 'Une nouvelle image apparait...',
  mode: 'add',
  layerId: '',
  transition: 'fade',
  exitTransition: 'fade',
  ...overrides,
});

const getLayerVisibleFrame = (layer) => {
  const width = Number(layer.width || 0);
  const height = getLayerHeight(layer);
  const left = Number(layer.x || 0) - (width / 2);
  const right = Number(layer.x || 0) + (width / 2);
  const top = Number(layer.y || 0) - (height / 2);
  const bottom = Number(layer.y || 0) + (height / 2);
  const clippedLeft = clamp(left, 0, 100);
  const clippedRight = clamp(right, 0, 100);
  const clippedTop = clamp(top, 0, 100);
  const clippedBottom = clamp(bottom, 0, 100);
  const isVisibleInCanvas = clippedRight > clippedLeft && clippedBottom > clippedTop;

  return {
    isVisibleInCanvas,
    frame: {
      left,
      top,
      right,
      bottom,
      width,
      height,
    },
    visibleFrame: {
      left: clippedLeft,
      top: clippedTop,
      right: clippedRight,
      bottom: clippedBottom,
      width: Math.max(0, clippedRight - clippedLeft),
      height: Math.max(0, clippedBottom - clippedTop),
    },
    clippedByCanvas: left < 0 || right > 100 || top < 0 || bottom > 100,
  };
};

const isStepActiveAtTime = (step, time) => {
  const start = Number(step.at || 0);
  const duration = Number(step.duration || 0);
  const end = start + Math.max(0, duration);
  return time >= start && time < end;
};

const getStepPhaseAtTime = (step, time) => {
  const start = Number(step.at || 0);
  const duration = Math.max(0, Number(step.duration || 0));
  const end = start + duration;
  const transitionWindow = Math.min(0.9, Math.max(0.22, duration * 0.28));
  if (time >= end - transitionWindow) return 'exit';
  return 'enter';
};

const exportSpec = ({ layers, selectedBackdrop, sceneName, cinematicSteps }) => ({
  version: 1,
  kind: 'escape-game-builder-2d-animation',
  sceneName,
  backdrop: selectedBackdrop,
  canvas: {
    aspectRatio: '16:10',
    width: 1600,
    height: 1000,
    clipOverflow: true,
  },
  cinematicSteps,
  layers: layers
    .map((layer, index) => ({ layer, index, visibility: getLayerVisibleFrame(layer) }))
    .filter(({ layer, visibility }) => layer.visible && visibility.isVisibleInCanvas)
    .map(({ layer, index, visibility }) => ({
        order: index,
        id: layer.id,
        name: layer.name,
      type: layer.type,
      preset: layer.preset,
      state: layer.state,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: getLayerHeight(layer),
      opacity: layer.opacity,
      duration: layer.duration,
      delay: layer.delay,
      loop: layer.loop,
        locked: layer.locked,
        visible: layer.visible,
        visibleAtStart: layer.visibleAtStart,
        src: layer.src,
        hasEmbeddedImage: Boolean(layer.src),
      })),
});

const serializeDraft = ({
  layers,
  selectedBackdrop,
  sceneName,
  cinematicSteps,
  selectedLayerId,
  selectedCinematicStepId,
  currentTime,
}) => ({
  layers,
  selectedBackdrop,
  sceneName,
  cinematicSteps,
  selectedLayerId,
  selectedCinematicStepId,
  currentTime,
  savedAt: new Date().toISOString(),
});

const getDraftDirtySignature = (draft = {}) => JSON.stringify({
  layers: draft.layers || [],
  selectedBackdrop: draft.selectedBackdrop || 'room',
  sceneName: draft.sceneName || '',
  cinematicSteps: draft.cinematicSteps || [],
});

const readStoredDraft = (storageKey = LEGACY_DRAFT_STORAGE_KEY) => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = JSON.parse(stored || 'null');
    if (!parsed || !Array.isArray(parsed.layers)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const normalizeImportedLayer = (entry, index) => {
  const layer = entry?.layer || entry;
  if (!layer || typeof layer !== 'object') return null;
  const preset = getPreset(layer.preset || 'idle-breathe');
  const src = layer.src || layer.imageData || '';
  return {
    ...makeLayer(null, src),
    id: layer.id || `anime-layer-import-${Date.now()}-${index}`,
    name: layer.name || `Image ${index + 1}`,
    type: layer.type || 'character',
    preset: preset.id,
    state: layer.state || 'neutre',
    x: clamp(layer.x ?? 50, -200, 300),
    y: clamp(layer.y ?? 56, -200, 300),
    width: clamp(layer.width ?? 28, LAYER_SIZE_MIN, LAYER_SIZE_MAX),
    height: clamp(layer.height ?? ((layer.width ?? 28) * CANVAS_ASPECT_RATIO), LAYER_HEIGHT_MIN, LAYER_HEIGHT_MAX),
    opacity: clamp(layer.opacity ?? 100, 0, 100),
    duration: Number(layer.duration || preset.duration),
    delay: Number(layer.delay || 0),
    loop: layer.loop !== false,
    src,
    originalSrc: '',
    visible: layer.visible !== false,
    visibleAtStart: layer.visibleAtStart === true || (!layer.src && layer.visibleAtStart !== false),
    locked: Boolean(layer.locked),
  };
};

const normalizeImportedDraft = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const rawLayers = Array.isArray(payload.layers) ? payload.layers : [];
  const importedLayers = rawLayers
    .map(normalizeImportedLayer)
    .filter(Boolean);
  if (!importedLayers.length) return null;
  return {
    layers: importedLayers,
    selectedBackdrop: payload.selectedBackdrop || payload.backdrop || 'room',
    sceneName: payload.sceneName || 'Scène animee',
    cinematicSteps: Array.isArray(payload.cinematicSteps) && payload.cinematicSteps.length
      ? payload.cinematicSteps
      : [makeCinematicStep({ mode: 'scene', narration: '' })],
  };
};

const drawStageBackdrop = (context, backdrop, width, height) => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  if (backdrop === 'school') {
    gradient.addColorStop(0, '#edf6ff');
    gradient.addColorStop(0.62, '#dbeafe');
    gradient.addColorStop(0.63, '#b7c7dd');
    gradient.addColorStop(1, '#64748b');
  } else if (backdrop === 'forest') {
    gradient.addColorStop(0, '#13351f');
    gradient.addColorStop(0.56, '#1f5130');
    gradient.addColorStop(0.57, '#34623c');
    gradient.addColorStop(1, '#152014');
  } else if (backdrop === 'lab') {
    gradient.addColorStop(0, '#d9f2ff');
    gradient.addColorStop(0.60, '#93c5fd');
    gradient.addColorStop(0.61, '#475569');
    gradient.addColorStop(1, '#111827');
  } else {
    gradient.addColorStop(0, '#101827');
    gradient.addColorStop(0.62, '#182033');
    gradient.addColorStop(0.63, '#273040');
    gradient.addColorStop(1, '#111827');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
};

const drawPlaceholderLayer = (context, x, y, size) => {
  const gradient = context.createLinearGradient(x, y, x, y + size);
  gradient.addColorStop(0, '#fef3c7');
  gradient.addColorStop(0.48, '#f97316');
  gradient.addColorStop(0.49, '#1d4ed8');
  gradient.addColorStop(1, '#1e293b');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x + (size / 2), y + (size / 2), size / 2, size / 2, 0, 0, Math.PI * 2);
  context.fill();
};

const drawNarration = (context, text, width, height) => {
  if (!text) return;
  const boxX = 36;
  const boxY = height - 150;
  const boxWidth = width - 72;
  const boxHeight = 96;
  context.fillStyle = 'rgba(2, 6, 23, 0.74)';
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.fillStyle = '#ffffff';
  context.font = '800 30px Georgia, serif';
  context.textBaseline = 'top';
  const words = String(text).split(/\s+/);
  let line = '';
  let y = boxY + 24;
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > boxWidth - 44 && line) {
      context.fillText(line, boxX + 28, y);
      line = word;
      y += 38;
    } else {
      line = nextLine;
    }
    if (y > boxY + boxHeight - 34) break;
  }
  if (line && y <= boxY + boxHeight - 34) context.fillText(line, boxX + 28, y);
};

const moveArrayItem = (items, fromIndex, toIndex) => {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
};

const paintLayerImage = async ({ layer, event, brushSize, mode }) => {
  if (!layer?.src) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const image = await loadImage(layer.src);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Retouche impossible dans ce navigateur.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const radius = Math.max(4, (brushSize / 100) * Math.max(canvas.width, canvas.height));
  const x = xRatio * canvas.width;
  const y = yRatio * canvas.height;

  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.closePath();

  if (mode === 'restore' && layer.originalSrc) {
    const originalImage = await loadImage(layer.originalSrc);
    context.clip();
    context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  } else {
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    context.fill();
  }

  context.restore();
  return canvas.toDataURL('image/png');
};

const cropLayerImage = async (layer, cropRect) => {
  if (!layer?.src || !cropRect) return null;
  const image = await loadImage(layer.src);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sx = Math.round((cropRect.x / 100) * sourceWidth);
  const sy = Math.round((cropRect.y / 100) * sourceHeight);
  const sw = Math.max(1, Math.round((cropRect.width / 100) * sourceWidth));
  const sh = Math.max(1, Math.round((cropRect.height / 100) * sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Rognage impossible dans ce navigateur.');
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
};

function IconButton({ children, title, onClick, active = false, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      className={`anime-icon-button ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function HelpLabel({ children, help }) {
  return (
    <span className="label-with-help anime-help-label">
      <span>{children}</span>
      <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
    </span>
  );
}

function Field({ label, help = '', children, className = '', ...props }) {
  return (
    <label className={`anime-field ${className}`} {...props}>
      {help ? <HelpLabel help={help}>{label}</HelpLabel> : <span>{label}</span>}
      {children}
    </label>
  );
}

function MenuItem({ children, shortcut = '', onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      className={`anime-menu-item ${danger ? 'danger' : ''}`}
      disabled={disabled}
      onClick={(event) => {
        onClick?.();
      }}
    >
      <span>{children}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function MenuFileItem({ children, accept, onChange }) {
  return (
    <label className="anime-menu-item">
      {children}
      <input type="file" accept={accept} hidden onChange={onChange} />
    </label>
  );
}

function Menu({ label, children, activeMenu, setActiveMenu }) {
  const isOpen = activeMenu === label;
  return (
    <div className={`anime-menu ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="anime-menu-summary"
        onClick={(event) => {
          event.stopPropagation();
          setActiveMenu(isOpen ? '' : label);
        }}
      >
        {label}
      </button>
      <div
        className="anime-menu-popover"
        hidden={!isOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (event.target.closest('.anime-menu-item')) setActiveMenu('');
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function TwoDAnimeEditor({
  user = null,
  projectName = '',
  projectDraft = null,
  draftStorageKey = '',
  onSaveDraft = null,
  onDirtyChange = null,
  onRegisterSaveBeforeLeave = null,
  onBackToBuilder = null,
} = {}) {
  const storageKey = getAnime2dDraftStorageKey(draftStorageKey || projectName || user?.id || 'default');
  const initialDraftRef = useRef(readStoredDraft(storageKey));
  const initialProjectDraftRef = useRef(projectDraft);
  const savedDraftSignatureRef = useRef(initialProjectDraftRef.current?.layers?.length
    ? getDraftDirtySignature(initialProjectDraftRef.current)
    : getDraftDirtySignature(initialDraftRef.current || {}));
  const initialLayers = (initialDraftRef.current?.layers?.length ? initialDraftRef.current.layers : defaultLayers).map(normalizeLayerDimensions);
  const fallbackProjectName = projectName || 'Projet 2D Anime';
  const [layers, setLayers] = useState(initialLayers);
  const layersRef = useRef(initialLayers);
  const [selectedLayerId, setSelectedLayerId] = useState(
    initialDraftRef.current?.selectedLayerId && initialLayers.some((layer) => layer.id === initialDraftRef.current.selectedLayerId)
      ? initialDraftRef.current.selectedLayerId
      : initialLayers[0]?.id || '',
  );
  const [selectedBackdrop, setSelectedBackdrop] = useState(initialDraftRef.current?.selectedBackdrop || 'room');
  const [sceneName, setSceneName] = useState(
    initialDraftRef.current?.sceneName && initialDraftRef.current.sceneName !== 'Scène animee'
      ? initialDraftRef.current.sceneName
      : fallbackProjectName,
  );
  const [cinematicSteps, setCinematicSteps] = useState(initialDraftRef.current?.cinematicSteps || [
    makeCinematicStep({
      id: 'cine-step-intro',
      at: 0,
      duration: 2,
      narration: 'La scène commence.',
      mode: 'scene',
    }),
  ]);
  const [selectedCinematicStepId, setSelectedCinematicStepId] = useState(
    initialDraftRef.current?.selectedCinematicStepId
      || initialDraftRef.current?.cinematicSteps?.[0]?.id
      || 'cine-step-intro',
  );
  const [currentTime, setCurrentTime] = useState(Number(initialDraftRef.current?.currentTime || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [backgroundTolerance, setBackgroundTolerance] = useState(42);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [isRemovingBackgroundAi, setIsRemovingBackgroundAi] = useState(false);
  const [aiBackgroundStatus, setAiBackgroundStatus] = useState('');
  const [retouchMode, setRetouchMode] = useState('none');
  const [brushSize, setBrushSize] = useState(7);
  const [cropRect, setCropRect] = useState({ x: 8, y: 8, width: 84, height: 84 });
  const [isPainting, setIsPainting] = useState(false);
  const [stageZoom, setStageZoom] = useState(1);
  const [stagePan, setStagePan] = useState({ x: 0, y: 0 });
  const paintLockRef = useRef(false);
  const [interaction, setInteraction] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeMenu, setActiveMenu] = useState('');
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStepNumbers, setDraftStepNumbers] = useState({});
  const stageRef = useRef(null);
  const canvasTitle = sceneName || fallbackProjectName;

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) || layers[0] || null,
    [layers, selectedLayerId],
  );

  const sortedCinematicSteps = useMemo(
    () => [...cinematicSteps].sort((a, b) => Number(a.at || 0) - Number(b.at || 0)),
    [cinematicSteps],
  );

  const cinematicDuration = useMemo(() => Math.max(6, ...sortedCinematicSteps.map((step) => Number(step.at || 0) + Number(step.duration || 0))), [sortedCinematicSteps]);
  const timelineTicks = useMemo(() => {
    const tickCount = Math.min(9, Math.max(4, Math.ceil(cinematicDuration / 4) + 1));
    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
      return Number((ratio * cinematicDuration).toFixed(cinematicDuration > 10 ? 0 : 1));
    });
  }, [cinematicDuration]);

  const activeCinematicStep = useMemo(
    () => [...sortedCinematicSteps].reverse().find((step) => isStepActiveAtTime(step, currentTime)) || null,
    [currentTime, sortedCinematicSteps],
  );

  const visibleLayers = useMemo(() => {
    const eventLayerIds = new Set(sortedCinematicSteps
      .filter((step) => ['add', 'replace'].includes(step.mode) && step.layerId)
      .map((step) => step.layerId));
    const baseLayers = layers.filter((layer) => (
      layer.visible
      && !eventLayerIds.has(layer.id)
      && (layer.visibleAtStart === true || (!layer.src && layer.visibleAtStart !== false))
    ));
    const activeImageSteps = sortedCinematicSteps.filter((step) => (
      ['add', 'replace'].includes(step.mode)
      && step.layerId
      && isStepActiveAtTime(step, currentTime)
    ));
    const replaceStep = [...activeImageSteps]
      .reverse()
      .find((step) => step.mode === 'replace');

    if (replaceStep) {
        return layers
          .filter((layer) => layer.visible && layer.id === replaceStep.layerId)
          .map((layer) => ({
            ...layer,
            __cinematicStepId: replaceStep.id,
            __transition: getStepPhaseAtTime(replaceStep, currentTime) === 'exit'
              ? (replaceStep.exitTransition || 'fade')
              : (replaceStep.transition || 'fade'),
            __transitionPhase: getStepPhaseAtTime(replaceStep, currentTime),
            __transitionDuration: replaceStep.duration,
          }));
    }

    return [
      ...baseLayers,
      ...activeImageSteps
        .filter((step) => step.mode === 'add')
        .map((step) => {
          const layer = layers.find((entry) => entry.id === step.layerId && entry.visible);
          if (!layer) return null;
            return {
              ...layer,
              __cinematicStepId: step.id,
              __transition: getStepPhaseAtTime(step, currentTime) === 'exit'
                ? (step.exitTransition || 'fade')
                : (step.transition || 'fade'),
              __transitionPhase: getStepPhaseAtTime(step, currentTime),
              __transitionDuration: step.duration,
            };
        })
        .filter(Boolean),
    ];
  }, [currentTime, layers, sortedCinematicSteps]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const restoreDraft = useCallback((draft, label = 'Brouillon restaure.') => {
    if (!draft?.layers?.length) return false;
    const restoredLayers = draft.layers.map(normalizeLayerDimensions);
    setLayers(restoredLayers);
    layersRef.current = restoredLayers;
    setSelectedLayerId(
      draft.selectedLayerId && restoredLayers.some((layer) => layer.id === draft.selectedLayerId)
        ? draft.selectedLayerId
        : restoredLayers[0]?.id || '',
    );
    setSelectedBackdrop(draft.selectedBackdrop || 'room');
    setSceneName(draft.sceneName && draft.sceneName !== 'Scène animee' ? draft.sceneName : fallbackProjectName);
    const nextSteps = Array.isArray(draft.cinematicSteps) && draft.cinematicSteps.length
      ? draft.cinematicSteps
      : [makeCinematicStep({ mode: 'scene', narration: '' })];
    setCinematicSteps(nextSteps);
    setSelectedCinematicStepId(
      draft.selectedCinematicStepId && nextSteps.some((step) => step.id === draft.selectedCinematicStepId)
        ? draft.selectedCinematicStepId
        : nextSteps[0]?.id || '',
    );
    setCurrentTime(Number(draft.currentTime || nextSteps[0]?.at || 0));
    setIsPlaying(false);
    savedDraftSignatureRef.current = getDraftDirtySignature(draft);
    onDirtyChange?.(false);
    setSaveStatus(label);
    return true;
  }, [fallbackProjectName, onDirtyChange]);

  const buildDraftPayload = useCallback(() => serializeDraft({
    layers,
    selectedBackdrop,
    sceneName,
    cinematicSteps,
    selectedLayerId,
    selectedCinematicStepId,
    currentTime,
  }), [cinematicSteps, currentTime, layers, sceneName, selectedBackdrop, selectedCinematicStepId, selectedLayerId]);

  useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty = getDraftDirtySignature(buildDraftPayload()) !== savedDraftSignatureRef.current;
    onDirtyChange(isDirty);
  }, [buildDraftPayload, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const closeMenu = () => setActiveMenu('');
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [activeMenu]);

  useEffect(() => {
    const handleShortcuts = (event) => {
      const target = event.target;
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && key === 's') {
        event.preventDefault();
        saveDraftNow().catch(() => {
          setSaveStatus('Sauvegarde impossible: stockage indisponible.');
        });
        return;
      }

      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (isTyping) return;

      if (ctrl && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoChange();
      } else if ((ctrl && key === 'y') || (ctrl && event.shiftKey && key === 'z')) {
        event.preventDefault();
        redoChange();
      } else if (ctrl && key === 'e') {
        event.preventDefault();
        downloadAnimationSpec();
      } else if (ctrl && key === 'd') {
        event.preventDefault();
        duplicateSelectedLayer();
      } else if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        removeSelectedLayer();
      } else if (key === ' ') {
        event.preventDefault();
        setIsPlaying((value) => !value);
      } else if (key === '+' || key === '=') {
        event.preventDefault();
        changeStageZoom(0.25);
      } else if (key === '-') {
        event.preventDefault();
        changeStageZoom(-0.25);
      } else if (key === '0') {
        event.preventDefault();
        resetStageView();
      } else if (key === 'v') {
        setRetouchMode('none');
      } else if (key === 'g') {
        setRetouchMode('erase');
      } else if (key === 'r') {
        setRetouchMode('restore');
      } else if (key === 'c') {
        setRetouchMode('crop');
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  });

  useEffect(() => {
    let cancelled = false;
    readBestAnimeDraft(storageKey)
      .then((draft) => {
        if (cancelled) return;
        if (draft?.layers?.length) {
          restoreDraft(draft, 'Brouillon restaure.');
        } else if (initialProjectDraftRef.current?.layers?.length) {
          restoreDraft(initialProjectDraftRef.current, 'Brouillon restaure depuis le projet.');
        } else if (initialDraftRef.current?.layers?.length) {
          restoreDraft(initialDraftRef.current, 'Brouillon local restaure.');
        }
      })
      .catch(() => {
        if (!cancelled && initialProjectDraftRef.current?.layers?.length) {
          restoreDraft(initialProjectDraftRef.current, 'Brouillon restaure depuis le projet.');
        } else if (!cancelled && initialDraftRef.current?.layers?.length) {
          restoreDraft(initialDraftRef.current, 'Brouillon local restaure.');
        } else if (!cancelled) {
          setSaveStatus('Sauvegarde du brouillon 2D Anime indisponible sur ce navigateur.');
        }
      })
    return () => {
      cancelled = true;
    };
  }, [restoreDraft, storageKey]);

  const saveDraftNow = useCallback(async () => {
    const draft = buildDraftPayload();
    await writeBestAnimeDraft(storageKey, draft);
    const savedDraft = await readBestAnimeDraft(storageKey);
    if (!savedDraft?.layers?.length) {
      throw new Error('Verification du brouillon 2D impossible.');
    }
    const projectSaved = await saveProjectDraftBestEffort(onSaveDraft, draft);
    initialDraftRef.current = draft;
    initialProjectDraftRef.current = draft;
    savedDraftSignatureRef.current = getDraftDirtySignature(draft);
    onDirtyChange?.(false);
    setSaveStatus(projectSaved
      ? 'Brouillon sauvegarde.'
      : 'Brouillon sauvegarde sur cet appareil.');
  }, [buildDraftPayload, onDirtyChange, onSaveDraft, storageKey]);

  useEffect(() => {
    if (!onRegisterSaveBeforeLeave) return undefined;
    onRegisterSaveBeforeLeave(saveDraftNow);
    return () => onRegisterSaveBeforeLeave(null);
  }, [onRegisterSaveBeforeLeave, saveDraftNow]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const startedAt = performance.now();
    const initialTime = currentTime;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setCurrentTime((initialTime + elapsed) % cinematicDuration);
    }, 80);
    return () => window.clearInterval(timer);
  }, [cinematicDuration, currentTime, isPlaying]);

  useEffect(() => {
    const clearInteraction = () => {
      setIsPainting(false);
      setInteraction(null);
    };
    window.addEventListener('pointerup', clearInteraction);
    window.addEventListener('pointercancel', clearInteraction);
    window.addEventListener('blur', clearInteraction);
    return () => {
      window.removeEventListener('pointerup', clearInteraction);
      window.removeEventListener('pointercancel', clearInteraction);
      window.removeEventListener('blur', clearInteraction);
    };
  }, []);

  const rememberLayers = () => {
    setUndoStack((previous) => [...previous.slice(-39), layersRef.current.map((layer) => ({ ...layer }))]);
    setRedoStack([]);
  };

  const setLayersWithHistory = (updater) => {
    rememberLayers();
    setLayers(updater);
  };

  const undoChange = () => {
    setUndoStack((previous) => {
      if (!previous.length) return previous;
      const restored = previous[previous.length - 1];
      const nextUndo = previous.slice(0, -1);
      setRedoStack((redoPrevious) => [...redoPrevious.slice(-39), layersRef.current.map((layer) => ({ ...layer }))]);
      setLayers(restored);
      setSelectedLayerId((currentId) => restored.some((layer) => layer.id === currentId) ? currentId : restored[0]?.id || '');
      setSaveStatus('Modification annulee.');
      return nextUndo;
    });
  };

  const redoChange = () => {
    setRedoStack((previous) => {
      if (!previous.length) return previous;
      const restored = previous[previous.length - 1];
      const nextRedo = previous.slice(0, -1);
      setUndoStack((undoPrevious) => [...undoPrevious.slice(-39), layersRef.current.map((layer) => ({ ...layer }))]);
      setLayers(restored);
      setSelectedLayerId((currentId) => restored.some((layer) => layer.id === currentId) ? currentId : restored[0]?.id || '');
      setSaveStatus('Modification retablie.');
      return nextRedo;
    });
  };

  const patchSelectedLayer = (patch) => {
    if (!selectedLayer) return;
    setLayersWithHistory((previous) => previous.map((layer) => (
      layer.id === selectedLayer.id ? { ...layer, ...patch } : layer
    )));
  };

  const patchLayer = (layerId, patch, options = {}) => {
    const setter = options.rememberHistory === false ? setLayers : setLayersWithHistory;
    setter((previous) => previous.map((layer) => (
      layer.id === layerId ? { ...layer, ...patch } : layer
    )));
  };

  const addImageLayer = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    const layer = makeLayer(file, src);
    setLayersWithHistory((previous) => [layer, ...previous]);
    setSelectedLayerId(layer.id);
    setCinematicSteps((previous) => previous.map((step) => (
      step.id === selectedCinematicStepId && ['add', 'replace'].includes(step.mode) && !step.layerId
        ? { ...step, layerId: layer.id }
        : step
    )));
    event.target.value = '';
  };

  const addImageLayerToStep = async (event, stepId) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    const layer = makeLayer(file, src);
    const targetStep = cinematicSteps.find((step) => step.id === stepId);
    setLayersWithHistory((previous) => [layer, ...previous]);
    setSelectedLayerId(layer.id);
    setSelectedCinematicStepId(stepId);
    setCurrentTime(Number(targetStep?.at || 0));
    setCinematicSteps((previous) => previous.map((step) => (
      step.id === stepId
        ? {
          ...step,
            mode: step.mode === 'scene' ? 'add' : step.mode,
            layerId: layer.id,
            transition: step.transition || 'fade',
            exitTransition: step.exitTransition || 'fade',
          }
        : step
    )));
    event.target.value = '';
  };

  const applyPreset = (presetId) => {
    const preset = getPreset(presetId);
    patchSelectedLayer({ preset: preset.id, duration: preset.duration });
  };

  const removeSelectedBackground = async () => {
    if (!selectedLayer?.src || isRemovingBackground) return;
    setIsRemovingBackground(true);
    setExportNotice('');
    try {
      const nextSrc = await removeImageBackground(selectedLayer.src, backgroundTolerance);
      patchSelectedLayer({
        src: nextSrc,
        originalSrc: selectedLayer.originalSrc || selectedLayer.src,
        name: selectedLayer.name.replace(/\s*\(detoure\)$/i, '') + ' (detoure)',
      });
      setSaveStatus('Arriere-plan supprime sur le calque sélectionne.');
    } catch (error) {
      setExportNotice(error.message || 'Detourage impossible.');
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const removeSelectedBackgroundAi = async () => {
    if (!selectedLayer?.src || isRemovingBackgroundAi) return;
    setIsRemovingBackgroundAi(true);
    setAiBackgroundStatus('Préparation du detourage IA local...');
    setExportNotice('');
    try {
      const source = selectedLayer.originalSrc || selectedLayer.src;
      const nextSrc = await removeImageBackgroundWithAi(source, setAiBackgroundStatus);
      patchSelectedLayer({
        src: nextSrc,
        originalSrc: source,
        name: selectedLayer.name
          .replace(/\s*\(detoure IA\)$/i, '')
          .replace(/\s*\(detoure\)$/i, '')
          + ' (detoure IA)',
      });
      setRetouchMode('none');
      setSaveStatus('Detourage IA local terminé.');
      setAiBackgroundStatus('Detourage IA terminé.');
    } catch (error) {
      setAiBackgroundStatus('');
      setExportNotice(error.message || 'Detourage IA impossible.');
    } finally {
      setIsRemovingBackgroundAi(false);
    }
  };

  const removeSelectedBackgroundRemoveBg = async () => {
    if (!selectedLayer?.src || isRemovingBackgroundAi) return;
    setIsRemovingBackgroundAi(true);
    setAiBackgroundStatus('Préparation remove.bg...');
    setExportNotice('');
    try {
      const source = selectedLayer.originalSrc || selectedLayer.src;
      const nextSrc = await removeImageBackgroundWithRemoveBg(source, setAiBackgroundStatus);
      patchSelectedLayer({
        src: nextSrc,
        originalSrc: source,
        name: selectedLayer.name
          .replace(/\s*\(remove\.bg\)$/i, '')
          .replace(/\s*\(detoure IA\)$/i, '')
          .replace(/\s*\(detoure\)$/i, '') + ' (remove.bg)',
      });
      setRetouchMode('none');
      setSaveStatus('Detourage remove.bg terminé.');
      setAiBackgroundStatus('Detourage remove.bg terminé.');
    } catch (error) {
      setAiBackgroundStatus('');
      setExportNotice(error.message || 'Detourage remove.bg impossible.');
    } finally {
      setIsRemovingBackgroundAi(false);
    }
  };

  const restoreSelectedOriginal = () => {
    if (!selectedLayer?.originalSrc) return;
    patchSelectedLayer({
      src: selectedLayer.originalSrc,
      name: selectedLayer.name.replace(/\s*\(detoure\)$/i, '').replace(/\s*\(retouche\)$/i, ''),
    });
    setSaveStatus('Image originale restauree.');
  };

  const paintSelectedLayer = async (event, layer) => {
    if (!['erase', 'restore'].includes(retouchMode) || !layer?.src || layer.locked || paintLockRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    paintLockRef.current = true;
    try {
      const nextSrc = await paintLayerImage({ layer, event, brushSize, mode: retouchMode });
      if (nextSrc) {
        patchLayer(layer.id, {
          src: nextSrc,
          originalSrc: layer.originalSrc || layer.src,
          name: layer.name.includes('(retouche)') ? layer.name : `${layer.name} (retouche)`,
        }, { rememberHistory: false });
      }
    } finally {
      paintLockRef.current = false;
    }
  };

  const startRetouchLayer = async (event, layer) => {
    if (!['erase', 'restore'].includes(retouchMode)) return false;
    setSelectedLayerId(layer.id);
    rememberLayers();
    setIsPainting(true);
    await paintSelectedLayer(event, layer);
    return true;
  };

  const applyCropToSelectedLayer = async () => {
    if (!selectedLayer?.src) return;
    try {
      const nextSrc = await cropLayerImage(selectedLayer, cropRect);
      if (!nextSrc) return;
      const nextWidth = Number(clamp(selectedLayer.width * (cropRect.width / 100), LAYER_SIZE_MIN, LAYER_SIZE_MAX).toFixed(1));
      const nextHeight = Number(clamp(getLayerHeight(selectedLayer) * (cropRect.height / 100), LAYER_HEIGHT_MIN, LAYER_HEIGHT_MAX).toFixed(1));
      patchSelectedLayer({
        src: nextSrc,
        originalSrc: selectedLayer.originalSrc || selectedLayer.src,
        width: nextWidth,
        height: nextHeight,
        name: selectedLayer.name.includes('(rogne)') ? selectedLayer.name : `${selectedLayer.name} (rogne)`,
      });
      setRetouchMode('none');
      setCropRect({ x: 8, y: 8, width: 84, height: 84 });
      setSaveStatus('Image rogne.');
    } catch (error) {
      setExportNotice(error.message || 'Rognage impossible.');
    }
  };

  const removeSelectedLayer = () => {
    if (!selectedLayer) return;
    const nextLayers = layers.filter((layer) => layer.id !== selectedLayer.id);
    setLayersWithHistory(() => nextLayers);
    setSelectedLayerId(nextLayers[0]?.id || '');
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const duplicate = {
      ...selectedLayer,
      id: `anime-layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${selectedLayer.name} copie`,
      x: clamp(selectedLayer.x + 5, 0, 100),
      y: clamp(selectedLayer.y + 5, 0, 100),
      height: getLayerHeight(selectedLayer),
      locked: false,
    };
    const selectedIndex = layers.findIndex((layer) => layer.id === selectedLayer.id);
    setLayersWithHistory((previous) => [
      ...previous.slice(0, selectedIndex + 1),
      duplicate,
      ...previous.slice(selectedIndex + 1),
    ]);
    setSelectedLayerId(duplicate.id);
  };

  const moveSelectedLayer = (direction) => {
    if (!selectedLayer) return;
    const selectedIndex = layers.findIndex((layer) => layer.id === selectedLayer.id);
    const nextIndex = direction === 'up' ? selectedIndex - 1 : selectedIndex + 1;
    if (nextIndex < 0 || nextIndex >= layers.length) return;
    setLayersWithHistory((previous) => moveArrayItem(previous, selectedIndex, nextIndex));
  };

  const makeResetCinematicSteps = () => [
    makeCinematicStep({
      id: 'cine-step-intro',
      at: 0,
      duration: 2,
      narration: 'La scène commence.',
      mode: 'scene',
    }),
  ];

  const resetDraft = () => {
    const nextSteps = makeResetCinematicSteps();
    rememberLayers();
    setLayers(defaultLayers);
    setSelectedLayerId(defaultLayers[0].id);
    setSelectedBackdrop('room');
    setSceneName(fallbackProjectName);
    setCinematicSteps(nextSteps);
    setSelectedCinematicStepId('cine-step-intro');
    setCurrentTime(0);
    setSaveStatus('Brouillon remis a zéro.');
  };

  const createNewProject = async () => {
    const confirmed = await showConfirm({
      title: 'Nouveau projet',
      message: 'Nouveau projet ? Le projet en cours sera supprimé. Cette action est irréversible.',
      confirmLabel: 'Créer',
      variant: 'danger',
    });
    if (!confirmed) return;

    resetDraft();
    await deleteBestAnimeDraft(storageKey);
    const projectCleared = await saveProjectDraftBestEffort(onSaveDraft, null);
    initialDraftRef.current = null;
    initialProjectDraftRef.current = null;
    const nextSteps = makeResetCinematicSteps();
    savedDraftSignatureRef.current = getDraftDirtySignature({
      layers: defaultLayers,
      selectedBackdrop: 'room',
      sceneName: fallbackProjectName,
      cinematicSteps: nextSteps,
    });
    onDirtyChange(false);
    setSaveStatus(projectCleared
      ? 'Nouveau projet crée.'
      : 'Nouveau projet crée sur cet appareil.');
  };

  const importJsonProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const draft = normalizeImportedDraft(payload);
      if (!draft) throw new Error('JSON 2D Anime invalide ou incomplet.');
      setUndoStack([]);
      setRedoStack([]);
      setLayers(draft.layers.map(normalizeLayerDimensions));
      setSelectedLayerId(draft.layers[0]?.id || '');
      setSelectedBackdrop(draft.selectedBackdrop);
      setSceneName(draft.sceneName && draft.sceneName !== 'Scène animee' ? draft.sceneName : fallbackProjectName);
      setCinematicSteps(draft.cinematicSteps);
      setSelectedCinematicStepId(draft.cinematicSteps[0]?.id || '');
      setCurrentTime(Number(draft.cinematicSteps[0]?.at || 0));
      setIsPlaying(false);
      setSaveStatus('JSON importe.');
      setExportNotice('');
    } catch (error) {
      setExportNotice(error.message || 'Import JSON impossible.');
    }
  };

  const patchCinematicStep = (stepId, patch, options = {}) => {
    const targetStep = cinematicSteps.find((step) => step.id === stepId);
    setCinematicSteps((previous) => previous.map((step) => (
      step.id === stepId ? {
        ...step,
        ...patch,
        layerId: patch.mode === 'scene' ? '' : (patch.layerId ?? step.layerId),
      } : step
    )));
    if (options.preview !== false && targetStep && selectedCinematicStepId === stepId) {
      setCurrentTime(Number(patch.at ?? targetStep.at ?? 0));
    }
  };

  const patchCinematicStepStart = (stepId, value) => {
    const nextStart = clamp(value, 0, 60);
    patchCinematicStep(stepId, { at: nextStart });
    setCurrentTime(nextStart);
  };

  const getDraftStepNumber = (stepId, key, fallback) => draftStepNumbers[`${stepId}:${key}`] ?? fallback;

  const updateDraftStepNumber = (stepId, key, value, commit) => {
    const draftKey = `${stepId}:${key}`;
    setDraftStepNumbers((previous) => ({ ...previous, [draftKey]: value }));
    if (value === '') return;
    commit(value);
  };

  const commitDraftStepNumber = (stepId, key, fallback, commit) => {
    const draftKey = `${stepId}:${key}`;
    const value = draftStepNumbers[draftKey];
    setDraftStepNumbers((previous) => {
      const next = { ...previous };
      delete next[draftKey];
      return next;
    });
    if (value === '') {
      commit(fallback);
    }
  };

  const seekTimeline = (event) => {
    const lane = event.currentTarget.querySelector('.anime-track-lane');
    const rect = lane?.getBoundingClientRect();
    if (!rect) return;
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    setCurrentTime(Number((ratio * cinematicDuration).toFixed(2)));
  };

  const addCinematicStep = () => {
    const selectedStep = sortedCinematicSteps.find((step) => step.id === selectedCinematicStepId);
    const previousStep = selectedStep || activeCinematicStep || sortedCinematicSteps[sortedCinematicSteps.length - 1];
    const nextStart = previousStep
      ? Number(previousStep.at || 0) + Number(previousStep.duration || 0)
      : currentTime + 1;
    const step = makeCinematicStep({
      at: Number(nextStart.toFixed(1)),
      mode: 'scene',
      layerId: '',
      narration: previousStep?.narration || '',
    });
    setCinematicSteps((previous) => [...previous, step]);
    setSelectedCinematicStepId(step.id);
    setCurrentTime(step.at);
  };

  const removeCinematicStep = (stepId) => {
    setCinematicSteps((previous) => {
      const nextSteps = previous.filter((step) => step.id !== stepId);
      if (selectedCinematicStepId === stepId) setSelectedCinematicStepId(nextSteps[0]?.id || '');
      return nextSteps;
    });
  };

  const previewAnimation = () => {
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const changeStageZoom = (delta) => {
    setStageZoom((value) => clamp(Number((value + delta).toFixed(2)), 0.5, 8));
  };

  const resetStageView = () => {
    setStageZoom(1);
    setStagePan({ x: 0, y: 0 });
  };

  const getStagePoint = (event) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((event.clientX - rect.left - stagePan.x) / (rect.width * stageZoom)) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top - stagePan.y) / (rect.height * stageZoom)) * 100, 0, 100),
    };
  };

  const startPanStage = (event) => {
    if (!event.altKey && event.button !== 1 && event.buttons !== 4) return;
    event.preventDefault();
    setInteraction({
      mode: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: stagePan.x,
      startPanY: stagePan.y,
    });
  };

  const startMoveLayer = (event, layer) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (event.altKey || event.button === 1 || event.buttons === 4) {
      setInteraction({
        mode: 'pan',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: stagePan.x,
        startPanY: stagePan.y,
      });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (layer.locked) return;
    const point = getStagePoint(event);
    if (!point) return;
    rememberLayers();
    setInteraction({
      mode: 'move',
      layerId: layer.id,
      offsetX: point.x - layer.x,
      offsetY: point.y - layer.y,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startResizeLayer = (event, layer, handle = 'se') => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked) return;
    rememberLayers();
    const width = Number(layer.width || LAYER_SIZE_MIN);
    const height = getLayerHeight(layer);
    setInteraction({
      mode: 'resize',
      layerId: layer.id,
      handle,
      left: Number(layer.x || 0) - width / 2,
      right: Number(layer.x || 0) + width / 2,
      top: Number(layer.y || 0) - height / 2,
      bottom: Number(layer.y || 0) + height / 2,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateInteraction = (event) => {
    if (!interaction) return;
    if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.buttons === 0) {
      setIsPainting(false);
      setInteraction(null);
      return;
    }
    const point = getStagePoint(event);
    if (!point) return;

    const layer = layers.find((entry) => entry.id === interaction.layerId);

    if (interaction.mode === 'pan') {
      setStagePan({
        x: interaction.startPanX + (event.clientX - interaction.startClientX),
        y: interaction.startPanY + (event.clientY - interaction.startClientY),
      });
      return;
    }

    if (!layer || layer.locked) return;

    if (interaction.mode === 'move') {
      patchLayer(interaction.layerId, {
        x: Number(clamp(point.x - interaction.offsetX, 0, 100).toFixed(1)),
        y: Number(clamp(point.y - interaction.offsetY, 0, 100).toFixed(1)),
      }, { rememberHistory: false });
    }

    if (interaction.mode === 'resize') {
      let left = interaction.left;
      let right = interaction.right;
      let top = interaction.top;
      let bottom = interaction.bottom;
      if (interaction.handle.includes('w')) left = Math.min(point.x, right - LAYER_SIZE_MIN);
      if (interaction.handle.includes('e')) right = Math.max(point.x, left + LAYER_SIZE_MIN);
      if (interaction.handle.includes('n')) top = Math.min(point.y, bottom - LAYER_HEIGHT_MIN);
      if (interaction.handle.includes('s')) bottom = Math.max(point.y, top + LAYER_HEIGHT_MIN);
      const width = clamp(right - left, LAYER_SIZE_MIN, LAYER_SIZE_MAX);
      const height = clamp(bottom - top, LAYER_HEIGHT_MIN, LAYER_HEIGHT_MAX);
      if (interaction.handle.includes('w') && width === LAYER_SIZE_MAX) left = right - width;
      if (interaction.handle.includes('e') && width === LAYER_SIZE_MAX) right = left + width;
      if (interaction.handle.includes('n') && height === LAYER_HEIGHT_MAX) top = bottom - height;
      if (interaction.handle.includes('s') && height === LAYER_HEIGHT_MAX) bottom = top + height;
      patchLayer(interaction.layerId, {
        x: Number(((left + right) / 2).toFixed(1)),
        y: Number(((top + bottom) / 2).toFixed(1)),
        width: Number(width.toFixed(1)),
        height: Number(height.toFixed(1)),
      }, { rememberHistory: false });
    }
  };

  const stopInteraction = () => setInteraction(null);
  const stopPaintAndInteraction = () => {
    setIsPainting(false);
    stopInteraction();
  };

  const downloadAnimationSpec = () => {
    const payload = exportSpec({ layers, selectedBackdrop, sceneName, cinematicSteps });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'animation-2d-spec.json');
    setExportNotice('Projet exporte dans le cadre visible 16/10.');
  };

  const downloadSelectedImage = async () => {
    try {
      if (!selectedLayer?.src) throw new Error('Sélectionne une image à enregistrer.');
      const blob = await dataUrlToBlob(selectedLayer.src);
      downloadBlob(blob, `${makeSafeFilename(selectedLayer.name || 'image')}.png`);
      setExportNotice('Image sélectionnée enregistrée.');
    } catch (error) {
      setExportNotice(error.message || 'Enregistrement image impossible.');
    }
  };

  const startRenameTitle = () => {
    setDraftTitle(canvasTitle || '');
    setIsRenamingTitle(true);
  };

  const submitRenameTitle = () => {
    const nextName = draftTitle.trim();
    if (nextName) setSceneName(nextName);
    setIsRenamingTitle(false);
  };

  return (
    <div className="anime-editor-shell" data-tour="anime-editor">
      <div className="anime-topbar anime-panel" data-tour="anime-toolbar">
        <nav className="anime-menubar" aria-label="Menus 2D Anime" data-tour="anime-menubar">
          <Menu label="Fichier" activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
            <MenuFileItem accept="image/*" onChange={addImageLayer}>Image</MenuFileItem>
            <MenuFileItem accept="application/json,.json" onChange={importJsonProject}>Importer JSON</MenuFileItem>
            <MenuItem shortcut="Ctrl+S" onClick={() => saveDraftNow().catch(() => setSaveStatus('Sauvegarde impossible: stockage indisponible.'))}>Sauvegarder le brouillon</MenuItem>
            <MenuItem shortcut="Ctrl+E" onClick={downloadAnimationSpec}>Exporter JSON</MenuItem>
            <MenuItem onClick={downloadSelectedImage} disabled={!selectedLayer?.src}>Enregistrer image</MenuItem>
            <MenuItem danger onClick={resetDraft}>Nouveau brouillon</MenuItem>
          </Menu>
          <Menu label="Editer" activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
            <MenuItem shortcut="Ctrl+Z" onClick={undoChange} disabled={!undoStack.length}>Annuler</MenuItem>
            <MenuItem shortcut="Ctrl+Y" onClick={redoChange} disabled={!redoStack.length}>Retablir</MenuItem>
            <MenuItem shortcut="Ctrl+D" onClick={duplicateSelectedLayer} disabled={!selectedLayer}>Dupliquer le calque</MenuItem>
            <MenuItem onClick={() => moveSelectedLayer('up')} disabled={!selectedLayer || layers.findIndex((layer) => layer.id === selectedLayer.id) === 0}>Remonter</MenuItem>
            <MenuItem onClick={() => moveSelectedLayer('down')} disabled={!selectedLayer || layers.findIndex((layer) => layer.id === selectedLayer.id) === layers.length - 1}>Descendre</MenuItem>
            <MenuItem onClick={() => patchSelectedLayer({ locked: !selectedLayer?.locked })} disabled={!selectedLayer}>{selectedLayer?.locked ? 'Deverrouilléer' : 'Verrouiller'}</MenuItem>
            <MenuItem shortcut="Suppr" danger onClick={removeSelectedLayer} disabled={!selectedLayer}>Supprimer</MenuItem>
          </Menu>
          <Menu label="Affichage" activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
            <MenuItem shortcut="-" onClick={() => changeStageZoom(-0.25)}>Zoom -</MenuItem>
            <MenuItem shortcut="+" onClick={() => changeStageZoom(0.25)}>Zoom +</MenuItem>
            <MenuItem shortcut="0" onClick={resetStageView}>Reinitialiser la vue</MenuItem>
            <MenuItem shortcut="Espace" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? 'Pause' : 'Lire'}</MenuItem>
          </Menu>
          <Menu label="Image" activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
            <MenuItem onClick={removeSelectedBackgroundRemoveBg} disabled={!selectedLayer?.src || isRemovingBackgroundAi}>
              {isRemovingBackgroundAi ? 'Detourage en cours...' : 'Detourage remove.bg'}
            </MenuItem>
            <MenuItem onClick={removeSelectedBackgroundAi} disabled={!selectedLayer?.src || isRemovingBackgroundAi}>
              {isRemovingBackgroundAi ? 'Detourage IA en cours...' : 'Detourage IA local'}
            </MenuItem>
            <MenuItem shortcut="V" onClick={() => setRetouchMode('none')}>Déplacer</MenuItem>
            <MenuItem shortcut="G" onClick={() => setRetouchMode('erase')} disabled={!selectedLayer?.src}>Gommer</MenuItem>
            <MenuItem shortcut="R" onClick={() => setRetouchMode('restore')} disabled={!selectedLayer?.originalSrc}>Restaurer</MenuItem>
            <MenuItem shortcut="C" onClick={() => setRetouchMode('crop')} disabled={!selectedLayer?.src}>Rogner</MenuItem>
            <MenuItem onClick={restoreSelectedOriginal} disabled={!selectedLayer?.originalSrc}>Revenir à l original</MenuItem>
          </Menu>
          <Menu label="Animation" activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
            {ANIMATION_PRESETS.map((preset) => (
              <MenuItem key={preset.id} onClick={() => applyPreset(preset.id)} disabled={!selectedLayer}>
                {preset.label}
              </MenuItem>
            ))}
          </Menu>
        </nav>
        <div className="anime-topbar-status">
          <button
            type="button"
            className="anime-builder-link anime-save-button"
            data-tour="anime-new-project"
            onClick={() => createNewProject().catch(() => setSaveStatus('Creation du nouveau projet impossible.'))}
          >
            <FilePlus2 size={14} />
            Nouveau projet
          </button>
          <button
            type="button"
            className="anime-builder-link anime-save-button"
            data-tour="anime-save"
            onClick={() => saveDraftNow().catch(() => setSaveStatus('Sauvegarde impossible: stockage indisponible.'))}
          >
            <Save size={14} />
            Sauvegarder
          </button>
          <button
            type="button"
            className="anime-builder-link anime-save-button"
            data-tour="anime-preview"
            onClick={previewAnimation}
          >
            <Play size={14} />
            Prévisualiser
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="anime-save-banner" role="status" aria-live="polite">
          <Save size={15} />
          <span>{saveStatus}</span>
        </div>
      )}

      <aside className="anime-sidebar anime-panel" data-tour="anime-storyboard">
        <div className="anime-panel-head">
          <div>
            <span className="anime-kicker">Storyboard</span>
            <h2>Cinématique</h2>
          </div>
          <Clapperboard size={20} />
        </div>

        <button type="button" className="anime-tool-button" data-tour="anime-add-step" onClick={addCinematicStep}>
          <Clapperboard size={16} />
          <span>Ajouter une step</span>
        </button>

        <div className="anime-cinematic-list" data-tour="anime-step-list">
          {sortedCinematicSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`anime-cinematic-step ${step.id === selectedCinematicStepId ? 'active' : ''} ${activeCinematicStep?.id === step.id ? 'playing' : ''}`}
              onClick={() => {
                setSelectedCinematicStepId(step.id);
                setCurrentTime(Number(step.at || 0));
              }}
            >
              <strong>{Number(step.at || 0).toFixed(1)}s</strong>
              <span>{step.mode === 'replace' ? 'Remplacer' : step.mode === 'add' ? 'Afficher' : 'Scène'}</span>
              <small>{step.narration || 'Sans narration'}</small>
            </button>
          ))}
        </div>

        {selectedCinematicStepId ? (
          <div className="anime-cinematic-editor" data-tour="anime-step-editor">
            {sortedCinematicSteps.filter((step) => step.id === selectedCinematicStepId).map((step) => (
              <div key={step.id} className="anime-cinematic-form">
                <Field label="Départ" help={FIELD_HELP.stepStart}>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    value={getDraftStepNumber(step.id, 'at', step.at)}
                    onChange={(event) => updateDraftStepNumber(step.id, 'at', event.target.value, (value) => patchCinematicStepStart(step.id, value))}
                    onBlur={() => commitDraftStepNumber(step.id, 'at', 0, (value) => patchCinematicStepStart(step.id, value))}
                  />
                </Field>
                <Field label="Durée" help={FIELD_HELP.stepDuration}>
                  <input
                    type="number"
                    min="0.2"
                    max="20"
                    step="0.1"
                    value={getDraftStepNumber(step.id, 'duration', step.duration)}
                    onChange={(event) => updateDraftStepNumber(step.id, 'duration', event.target.value, (value) => patchCinematicStep(step.id, { duration: clamp(value, 0.2, 20) }))}
                    onBlur={() => commitDraftStepNumber(step.id, 'duration', 0.2, (value) => patchCinematicStep(step.id, { duration: clamp(value, 0.2, 20) }))}
                  />
                </Field>
                <Field label="Action image" help={FIELD_HELP.stepAction} className="anime-field-wide" data-tour="anime-step-action">
                  <select value={step.mode} onChange={(event) => patchCinematicStep(step.id, { mode: event.target.value })}>
                    <option value="scene">Continuer la scène</option>
                    <option value="add">Afficher une image</option>
                    <option value="replace">Remplacer par une image</option>
                  </select>
                </Field>
                <Field label="Image" help={FIELD_HELP.stepImage} className="anime-field-wide">
                  <div className="anime-step-image-picker">
                    {step.mode !== 'scene' ? (
                      <select value={step.layerId || ''} onChange={(event) => patchCinematicStep(step.id, { layerId: event.target.value })}>
                        <option value="">Choisir...</option>
                        {layers.map((layer) => (
                          <option key={layer.id} value={layer.id}>{layer.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="anime-step-image-placeholder">Aucune image sur cette step</span>
                    )}
                    <label className="anime-tool-button anime-step-image-button">
                      <ImagePlus size={15} />
                      <span>Ajouter</span>
                      <input type="file" accept="image/*" hidden onChange={(event) => addImageLayerToStep(event, step.id)} />
                    </label>
                  </div>
                </Field>
                {step.mode !== 'scene' ? (
                  <Field label="Apparition" help={FIELD_HELP.stepTransitionIn} className="anime-field-wide">
                    <select value={step.transition || 'fade'} onChange={(event) => patchCinematicStep(step.id, { transition: event.target.value })}>
                      {TRANSITION_EFFECTS.map((transition) => (
                        <option key={transition.id} value={transition.id}>{transition.label}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {step.mode !== 'scene' ? (
                  <Field label="Disparition" help={FIELD_HELP.stepTransitionOut} className="anime-field-wide">
                    <select value={step.exitTransition || 'fade'} onChange={(event) => patchCinematicStep(step.id, { exitTransition: event.target.value })}>
                      {TRANSITION_EFFECTS.map((transition) => (
                        <option key={transition.id} value={transition.id}>{transition.label}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <Field label="Narration" help={FIELD_HELP.stepNarration} className="anime-field-wide" data-tour="anime-step-narration">
                  <textarea
                    className="anime-narration-input"
                    value={step.narration}
                    onChange={(event) => patchCinematicStep(step.id, { narration: event.target.value }, { preview: false })}
                  />
                </Field>
                <button type="button" className="anime-tool-button danger" onClick={() => removeCinematicStep(step.id)}>
                  <Trash2 size={16} />
                  <span>Supprimer l'étape</span>
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <main className="anime-stage-panel anime-panel" data-tour="anime-canvas-panel">
        <div className="anime-stage-head">
          <div>
            <span className="anime-kicker">Canvas</span>
            {isRenamingTitle ? (
              <input
                className="anime-title-input"
                value={draftTitle}
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={submitRenameTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitRenameTitle();
                  if (event.key === 'Escape') setIsRenamingTitle(false);
                }}
              />
            ) : (
              <button type="button" className="anime-title-button" onClick={startRenameTitle} title="Renommer">
                <span>{canvasTitle}</span>
                <Pencil className="anime-title-edit-icon" size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="anime-stage-actions" data-tour="anime-stage-actions">
            <IconButton title={isPlaying ? 'Pause' : 'Lecture'} onClick={() => setIsPlaying((value) => !value)} active={isPlaying}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </IconButton>
            <IconButton title="Annuler" onClick={undoChange} disabled={!undoStack.length}>
              <Undo2 size={18} />
            </IconButton>
            <IconButton title="Retablir" onClick={redoChange} disabled={!redoStack.length}>
              <Redo2 size={18} />
            </IconButton>
            <button type="button" className="anime-zoom-button" onClick={() => changeStageZoom(-0.25)}>-</button>
            <span className="anime-zoom-readout">{Math.round(stageZoom * 100)}%</span>
            <button type="button" className="anime-zoom-button" onClick={() => changeStageZoom(0.25)}>+</button>
            <IconButton title="Reinitialiser la vue" onClick={resetStageView}>
              <RotateCcw size={18} />
            </IconButton>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`anime-stage anime-backdrop-${selectedBackdrop} ${isPlaying ? 'is-playing' : 'is-paused'} ${interaction ? 'is-interacting' : ''}`}
          data-tour="anime-stage"
          onPointerMove={updateInteraction}
          onPointerUp={stopPaintAndInteraction}
          onPointerCancel={stopPaintAndInteraction}
          onPointerLeave={stopPaintAndInteraction}
          onPointerDown={startPanStage}
        >
          <div
            className="anime-stage-viewport"
            style={{
              transform: getStageViewportTransform(stagePan, stageZoom),
            }}
          >
            <div className="anime-stage-grid" />
            {visibleLayers.map((layer) => (
              <div
                key={`${layer.id}-${layer.__cinematicStepId || 'base'}`}
                role="button"
                tabIndex={0}
                className={`anime-layer-object ${layer.id === selectedLayerId ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.width}%`,
                  height: `${getLayerHeight(layer)}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: layer.opacity / 100,
                  zIndex: layers.length - layers.findIndex((entry) => entry.id === layer.id) + 2,
                  '--anime-entrance-duration': `${Math.min(900, Math.max(220, Number(layer.__transitionDuration || 1) * 360))}ms`,
                  '--anime-layer-opacity': layer.opacity / 100,
                }}
                onClick={() => setSelectedLayerId(layer.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedLayerId(layer.id);
                  }
                }}
                onPointerDown={async (event) => {
                  if (await startRetouchLayer(event, layer)) return;
                  startMoveLayer(event, layer);
                }}
                onPointerMove={(event) => {
                  if (isPainting && selectedLayerId === layer.id) paintSelectedLayer(event, layer);
                }}
              >
                <span className={`anime-layer-transition ${getLayerTransitionClass(layer)}`}>
                  <span
                    className={`anime-layer-animated anime-preset-${layer.preset}`}
                    style={{
                      animationDuration: `${layer.duration}ms`,
                      animationDelay: `${layer.delay}ms`,
                      animationIterationCount: layer.loop ? 'infinite' : 1,
                    }}
                  >
                    {layer.src ? (
                      <img src={layer.src} alt={layer.name} />
                    ) : (
                      <span className="anime-placeholder-character">
                        <span />
                      </span>
                    )}
                  </span>
                </span>
                {layer.id === selectedLayerId ? (
                  <>
                    {retouchMode === 'crop' ? (
                      <span
                        className="anime-crop-frame"
                        style={{
                          left: `${cropRect.x}%`,
                          top: `${cropRect.y}%`,
                          width: `${cropRect.width}%`,
                          height: `${cropRect.height}%`,
                        }}
                      />
                    ) : null}
                    {RESIZE_HANDLES.map((handle) => (
                      <span
                        key={handle}
                        className={`anime-resize-handle anime-resize-handle--${handle}`}
                        role="presentation"
                        onPointerDown={(event) => startResizeLayer(event, layer, handle)}
                      />
                    ))}
                  </>
                ) : null}
              </div>
            ))}
          </div>
          {activeCinematicStep?.narration ? (
            <div className="anime-narration-preview">
              {activeCinematicStep.narration}
            </div>
          ) : null}
          {isRemovingBackgroundAi ? (
            <div className="anime-ai-loading" role="status" aria-live="polite">
              <span className="anime-ai-spinner" />
              <strong>Detourage IA en cours</strong>
              <small>{aiBackgroundStatus || 'Analyse de l’image...'}</small>
            </div>
          ) : null}
        </div>

        <div className="anime-timeline" data-tour="anime-timeline">
          <div
            className="anime-timeline-scale"
            style={{ gridTemplateColumns: `repeat(${timelineTicks.length}, minmax(0, 1fr))` }}
          >
            {timelineTicks.map((tick) => <span key={tick}>{tick}s</span>)}
          </div>
          <div className="anime-track-list">
            <button
              type="button"
              className="anime-track anime-playhead-track"
              onClick={seekTimeline}
            >
              <span>Lecture</span>
              <div className="anime-track-lane">
                <i
                  className="anime-playhead"
                  style={{
                    left: `${(currentTime / cinematicDuration) * 100}%`,
                    width: '2px',
                    top: '3px',
                  }}
                />
              </div>
            </button>
            {layers.map((layer, index) => (
              <button
                key={layer.id}
                type="button"
                className={`anime-track ${layer.id === selectedLayerId ? 'active' : ''}`}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <span>{layer.name}</span>
                <i
                  style={{
                    left: `${Math.min(80, layer.delay / 60)}%`,
                    width: `${Math.max(10, Math.min(70, layer.duration / 75))}%`,
                    top: `${6 + index}px`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </main>

      <aside className="anime-inspector anime-panel" data-tour="anime-inspector">
        <div className="anime-panel-head">
          <div>
            <span className="anime-kicker">Inspecteur</span>
          </div>
          <Eye size={20} />
        </div>

        {selectedLayer ? (
          <>
            <div className="anime-inspector-actions" data-tour="anime-layer-lock">
              <IconButton
                title={selectedLayer.locked ? 'Deverrouilléer l’image' : 'Verrouiller l’image'}
                active={selectedLayer.locked}
                onClick={() => patchSelectedLayer({ locked: !selectedLayer.locked })}
              >
                {selectedLayer.locked ? <Lock size={18} /> : <Unlock size={18} />}
              </IconButton>
              <span className="anime-lock-status">
                {selectedLayer.locked ? 'Image verrouillée' : 'Image modifiable'}
              </span>
            </div>

            <div className="anime-inspector-actions">
              <IconButton
                title="Passer devant"
                onClick={() => moveSelectedLayer('up')}
                disabled={layers.findIndex((layer) => layer.id === selectedLayer.id) === 0}
              >
                <ArrowUp size={18} />
              </IconButton>
              <IconButton
                title="Passer derrière"
                onClick={() => moveSelectedLayer('down')}
                disabled={layers.findIndex((layer) => layer.id === selectedLayer.id) === layers.length - 1}
              >
                <ArrowDown size={18} />
              </IconButton>
              <span className="anime-lock-status">
                Ordre du calque
              </span>
            </div>

            <Field label="Nom" help={FIELD_HELP.layerName}>
              <input value={selectedLayer.name} onChange={(event) => patchSelectedLayer({ name: event.target.value })} />
            </Field>

            {['erase', 'restore'].includes(retouchMode) ? (
              <Field label={`Pinceau ${brushSize}`} help={FIELD_HELP.brushSize}>
                <input
                  type="range"
                  min="2"
                  max="24"
                  value={brushSize}
                  onChange={(event) => setBrushSize(clamp(event.target.value, 2, 24))}
                />
              </Field>
            ) : null}

            {retouchMode === 'crop' ? (
              <div className="anime-crop-controls compact">
                <Field label={`Gauche ${cropRect.x}%`} help={FIELD_HELP.cropLeft}>
                  <input type="range" min="0" max="95" value={cropRect.x} onChange={(event) => setCropRect((rect) => ({ ...rect, x: clamp(event.target.value, 0, 95), width: clamp(rect.width, 5, 100 - clamp(event.target.value, 0, 95)) }))} />
                </Field>
                <Field label={`Haut ${cropRect.y}%`} help={FIELD_HELP.cropTop}>
                  <input type="range" min="0" max="95" value={cropRect.y} onChange={(event) => setCropRect((rect) => ({ ...rect, y: clamp(event.target.value, 0, 95), height: clamp(rect.height, 5, 100 - clamp(event.target.value, 0, 95)) }))} />
                </Field>
                <Field label={`Largeur ${cropRect.width}%`} help={FIELD_HELP.cropWidth}>
                  <input type="range" min="5" max={100 - cropRect.x} value={cropRect.width} onChange={(event) => setCropRect((rect) => ({ ...rect, width: clamp(event.target.value, 5, 100 - rect.x) }))} />
                </Field>
                <Field label={`Hauteur ${cropRect.height}%`} help={FIELD_HELP.cropHeight}>
                  <input type="range" min="5" max={100 - cropRect.y} value={cropRect.height} onChange={(event) => setCropRect((rect) => ({ ...rect, height: clamp(event.target.value, 5, 100 - rect.y) }))} />
                </Field>
                <button type="button" className="anime-tool-button" onClick={applyCropToSelectedLayer} disabled={!selectedLayer.src}>
                  <Wand2 size={16} />
                  <span>Appliquer</span>
                </button>
              </div>
            ) : null}

            <div className="anime-number-grid" data-tour="anime-layer-geometry">
              <Field label="X (%)" help={FIELD_HELP.layerX}>
                <input type="number" min="0" max="100" step="0.1" value={selectedLayer.x} onChange={(event) => patchSelectedLayer({ x: clamp(event.target.value, 0, 100) })} />
              </Field>
              <Field label="Y (%)" help={FIELD_HELP.layerY}>
                <input type="number" min="0" max="100" step="0.1" value={selectedLayer.y} onChange={(event) => patchSelectedLayer({ y: clamp(event.target.value, 0, 100) })} />
              </Field>
              <Field label="Taille (%)" help={FIELD_HELP.layerSize}>
                <input type="number" min={LAYER_SIZE_MIN} max={LAYER_SIZE_MAX} step="0.1" value={selectedLayer.width} onChange={(event) => patchSelectedLayer({ width: clamp(event.target.value, LAYER_SIZE_MIN, LAYER_SIZE_MAX) })} />
              </Field>
              <Field label="Hauteur (%)" help="Hauteur du rectangle dans le canvas.">
                <input type="number" min={LAYER_HEIGHT_MIN} max={LAYER_HEIGHT_MAX} step="0.1" value={getLayerHeight(selectedLayer)} onChange={(event) => patchSelectedLayer({ height: clamp(event.target.value, LAYER_HEIGHT_MIN, LAYER_HEIGHT_MAX) })} />
              </Field>
              <Field label="Opacite (%)" help={FIELD_HELP.layerOpacity}>
                <input type="number" min="0" max="100" step="1" value={selectedLayer.opacity} onChange={(event) => patchSelectedLayer({ opacity: clamp(event.target.value, 0, 100) })} />
              </Field>
              <Field label="Durée (ms)" help={FIELD_HELP.layerDuration}>
                <input type="number" min="250" max="6000" step="50" value={selectedLayer.duration} onChange={(event) => patchSelectedLayer({ duration: clamp(event.target.value, 250, 6000) })} />
              </Field>
              <Field label="Delai (ms)" help={FIELD_HELP.layerDelay}>
                <input type="number" min="0" max="5000" step="50" value={selectedLayer.delay} onChange={(event) => patchSelectedLayer({ delay: clamp(event.target.value, 0, 5000) })} />
              </Field>
            </div>

            <label className="anime-check-row" data-tour="anime-layer-loop">
              <input type="checkbox" checked={selectedLayer.loop} onChange={(event) => patchSelectedLayer({ loop: event.target.checked })} />
              <span>Boucler l’animation</span>
              <span className="help-dot" data-help={FIELD_HELP.layerLoop} aria-label={FIELD_HELP.layerLoop} tabIndex={0}>?</span>
            </label>

          </>
        ) : (
          <p className="anime-empty">Importe une image pour commencer.</p>
        )}
      </aside>
    </div>
  );
}

export { ANIMATION_PRESETS, exportSpec };
