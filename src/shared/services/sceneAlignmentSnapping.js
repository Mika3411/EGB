export const SCENE_ALIGNMENT_SNAP_THRESHOLD_PERCENT = 1.25;

const clampPercentValue = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
};

const numberValue = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getElementBounds = (entry = {}) => {
  const x = numberValue(entry.x, 50);
  const y = numberValue(entry.y, 50);
  const width = Math.max(0, numberValue(entry.width, 0));
  const height = Math.max(0, numberValue(entry.height, 0));
  return {
    x,
    y,
    width,
    height,
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
};

const findSceneEntry = (scene = {}, type = '', id = '') => {
  if (type === 'hotspot') return (scene.hotspots || []).find((entry) => entry.id === id) || null;
  if (type === 'sceneObject') return (scene.sceneObjects || []).find((entry) => entry.id === id) || null;
  if (type === 'visualEffectZone') return (scene.visualEffectZones || []).find((entry) => entry.id === id) || null;
  return null;
};

const getSceneAlignmentEntries = (scene = {}) => [
  ...(scene.hotspots || []).map((entry) => ({ type: 'hotspot', entry })),
  ...(scene.sceneObjects || []).map((entry) => ({ type: 'sceneObject', entry })),
  ...(scene.visualEffectZones || []).map((entry) => ({ type: 'visualEffectZone', entry })),
];

const addTarget = (targets, coordinate, source) => {
  if (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100) return;
  targets.push({ coordinate, ...source });
};

const getAxisTargets = (scene, axis, activeType, movedIds) => {
  const targets = [];
  addTarget(targets, 50, { sourceType: 'image', sourceId: 'image-center', alignment: 'center' });

  getSceneAlignmentEntries(scene).forEach(({ type, entry }) => {
    if (!entry?.id || entry.isHidden) return;
    if (type === activeType && movedIds.includes(entry.id)) return;

    const bounds = getElementBounds(entry);
    if (axis === 'x') {
      addTarget(targets, bounds.x, { sourceType: type, sourceId: entry.id, alignment: 'center' });
      addTarget(targets, bounds.left, { sourceType: type, sourceId: entry.id, alignment: 'start' });
      addTarget(targets, bounds.right, { sourceType: type, sourceId: entry.id, alignment: 'end' });
      return;
    }
    addTarget(targets, bounds.y, { sourceType: type, sourceId: entry.id, alignment: 'center' });
    addTarget(targets, bounds.top, { sourceType: type, sourceId: entry.id, alignment: 'start' });
    addTarget(targets, bounds.bottom, { sourceType: type, sourceId: entry.id, alignment: 'end' });
  });

  return targets;
};

const getActiveAxisPoints = (entry, axis, proposedCenter) => {
  const bounds = getElementBounds(entry);
  const size = axis === 'x' ? bounds.width : bounds.height;
  if (size <= 0) return [{ coordinate: proposedCenter, alignment: 'center' }];
  return [
    { coordinate: proposedCenter, alignment: 'center' },
    { coordinate: proposedCenter - size / 2, alignment: 'start' },
    { coordinate: proposedCenter + size / 2, alignment: 'end' },
  ];
};

const findAxisSnap = ({ entry, axis, proposedCenter, targets, threshold }) => {
  let best = null;
  getActiveAxisPoints(entry, axis, proposedCenter).forEach((point) => {
    targets.forEach((target) => {
      const distance = Math.abs(point.coordinate - target.coordinate);
      if (distance > threshold) return;
      if (!best || distance < best.distance) {
        best = {
          distance,
          coordinate: target.coordinate,
          center: proposedCenter + target.coordinate - point.coordinate,
          activeAlignment: point.alignment,
          targetAlignment: target.alignment,
          sourceType: target.sourceType,
          sourceId: target.sourceId,
        };
      }
    });
  });
  return best;
};

const findCoordinateSnap = ({ coordinate, targets, threshold }) => {
  let best = null;
  targets.forEach((target) => {
    const distance = Math.abs(coordinate - target.coordinate);
    if (distance > threshold) return;
    if (!best || distance < best.distance) {
      best = {
        distance,
        coordinate: target.coordinate,
        activeAlignment: 'handle',
        targetAlignment: target.alignment,
        sourceType: target.sourceType,
        sourceId: target.sourceId,
      };
    }
  });
  return best;
};

export const getSceneDragSnapPosition = ({
  scene = {},
  type = '',
  id = '',
  x = 0,
  y = 0,
  movedIds = [],
  threshold = SCENE_ALIGNMENT_SNAP_THRESHOLD_PERCENT,
}) => {
  const entry = findSceneEntry(scene, type, id);
  const fallback = {
    x: clampPercentValue(x),
    y: clampPercentValue(y),
    guides: { vertical: null, horizontal: null },
  };
  if (!entry) return fallback;

  const activeMovedIds = movedIds.length ? movedIds : [id];
  const xSnap = findAxisSnap({
    entry,
    axis: 'x',
    proposedCenter: fallback.x,
    targets: getAxisTargets(scene, 'x', type, activeMovedIds),
    threshold,
  });
  const ySnap = findAxisSnap({
    entry,
    axis: 'y',
    proposedCenter: fallback.y,
    targets: getAxisTargets(scene, 'y', type, activeMovedIds),
    threshold,
  });

  return {
    x: clampPercentValue(xSnap ? xSnap.center : fallback.x),
    y: clampPercentValue(ySnap ? ySnap.center : fallback.y),
    guides: {
      vertical: xSnap ? { position: Number(xSnap.coordinate.toFixed(2)), ...xSnap } : null,
      horizontal: ySnap ? { position: Number(ySnap.coordinate.toFixed(2)), ...ySnap } : null,
    },
  };
};

export const getSceneResizeSnapPosition = ({
  scene = {},
  type = '',
  id = '',
  x = 0,
  y = 0,
  axes = { x: true, y: true },
  movedIds = [],
  threshold = SCENE_ALIGNMENT_SNAP_THRESHOLD_PERCENT,
}) => {
  const entry = findSceneEntry(scene, type, id);
  const fallback = {
    x: clampPercentValue(x),
    y: clampPercentValue(y),
    guides: { vertical: null, horizontal: null },
  };
  if (!entry) return fallback;

  const activeMovedIds = movedIds.length ? movedIds : [id];
  const xSnap = axes.x ? findCoordinateSnap({
    coordinate: fallback.x,
    targets: getAxisTargets(scene, 'x', type, activeMovedIds),
    threshold,
  }) : null;
  const ySnap = axes.y ? findCoordinateSnap({
    coordinate: fallback.y,
    targets: getAxisTargets(scene, 'y', type, activeMovedIds),
    threshold,
  }) : null;

  return {
    x: clampPercentValue(xSnap ? xSnap.coordinate : fallback.x),
    y: clampPercentValue(ySnap ? ySnap.coordinate : fallback.y),
    guides: {
      vertical: xSnap ? { position: Number(xSnap.coordinate.toFixed(2)), ...xSnap } : null,
      horizontal: ySnap ? { position: Number(ySnap.coordinate.toFixed(2)), ...ySnap } : null,
    },
  };
};
