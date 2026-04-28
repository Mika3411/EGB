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
