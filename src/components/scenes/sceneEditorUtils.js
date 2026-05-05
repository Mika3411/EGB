export const clampPercent = (value) => Math.max(0, Math.min(100, value));

export const clampFullscreenZoom = (value) => Math.min(2.5, Math.max(0.55, Number(value) || 1));

export const gridOverlayStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 16,
  backgroundImage: 'linear-gradient(rgba(96,165,250,.24) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,.24) 1px, transparent 1px)',
  backgroundSize: '5% 5%',
};

export const getLayerZIndex = (entry, type) => Number(entry.zIndex ?? (type === 'hotspot' ? 20 : 18));

export const SHAPE_CORNER_KEYS = ['nw', 'ne', 'se', 'sw'];

export const getElementShapeCorners = (entry = {}) => {
  const corners = entry.shapeCorners || {};
  return {
    nw: {
      x: Number.isFinite(Number(corners.nw?.x)) ? Number(corners.nw.x) : 0,
      y: Number.isFinite(Number(corners.nw?.y)) ? Number(corners.nw.y) : 0,
    },
    ne: {
      x: Number.isFinite(Number(corners.ne?.x)) ? Number(corners.ne.x) : 100,
      y: Number.isFinite(Number(corners.ne?.y)) ? Number(corners.ne.y) : 0,
    },
    se: {
      x: Number.isFinite(Number(corners.se?.x)) ? Number(corners.se.x) : 100,
      y: Number.isFinite(Number(corners.se?.y)) ? Number(corners.se.y) : 100,
    },
    sw: {
      x: Number.isFinite(Number(corners.sw?.x)) ? Number(corners.sw.x) : 0,
      y: Number.isFinite(Number(corners.sw?.y)) ? Number(corners.sw.y) : 100,
    },
  };
};

export const makeRegularShapePoints = (count = 4) => {
  const safeCount = Math.max(3, Math.min(16, Math.round(Number(count) || 4)));
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / safeCount) * Math.PI * 2;
    return {
      x: Number((50 + Math.cos(angle) * 50).toFixed(2)),
      y: Number((50 + Math.sin(angle) * 50).toFixed(2)),
    };
  });
};

export const getElementShapeType = (entry = {}) => (
  ['rectangle', 'ellipse', 'free'].includes(entry.shapeType)
    ? entry.shapeType
    : ((Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) || entry.shapeCorners ? 'free' : 'rectangle')
);

export const getElementShapePoints = (entry = {}) => {
  if (Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) {
    return entry.shapePoints.map((point) => ({
      x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 50,
      y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 50,
    }));
  }
  if (entry.shapeCorners) {
    const corners = getElementShapeCorners(entry);
    return [corners.nw, corners.ne, corners.se, corners.sw];
  }
  return makeRegularShapePoints(Number(entry.shapePointCount) || 4);
};

export const getElementShapeClipPath = (entry) => {
  const shapeType = getElementShapeType(entry);
  if (shapeType === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (shapeType !== 'free') return '';
  const points = getElementShapePoints(entry);
  return `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(', ')})`;
};

export const getElementShapeStyle = (entry) => ({
  ...(getElementShapeClipPath(entry) ? { clipPath: getElementShapeClipPath(entry) } : {}),
});

export const getSceneObjectStyle = (obj) => ({
  left: `${obj.x}%`,
  top: `${obj.y}%`,
  width: `${obj.width}%`,
  height: `${obj.height}%`,
  zIndex: getLayerZIndex(obj, 'sceneObject'),
  overflow: 'hidden',
  padding: 0,
  margin: 0,
  border: 0,
  boxSizing: 'border-box',
  background: 'transparent',
  transform: 'translate(-50%, -50%)',
  transformOrigin: 'center center',
  lineHeight: 0,
  ...getElementShapeStyle(obj),
});

export const getSceneObjectImageStyle = () => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center center',
  pointerEvents: 'none',
  display: 'block',
});

export const shouldIgnoreEditorShortcut = (event) => {
  const target = event.target;
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
};
