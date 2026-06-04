import {
  MODEL_ERASER_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_COLOR,
  getHexColor,
  getModelEraserRadius,
  getTerrainPaintRadius,
  getTerrainPaintShape,
} from '../../../shared/utils/rpg3dDomain.js';
import {
  WORLD_SCALE,
  createTerrainPaintPreview,
  removeGroupChild,
  toScenePosition,
} from './rpg3dSceneBuilders.js';
import {
  MODEL_ERASER_PREVIEW_COLOR,
  createModelEraserSurfacePreview,
} from './rpg3dViewportInteraction.js';

export const hideViewportPreview = ({
  invalidateRender,
  previewRef,
  scene,
}) => {
  if (!previewRef.current) return;
  removeGroupChild(scene, previewRef.current);
  previewRef.current = null;
  invalidateRender({ followupFrames: 1 });
};

export const updateViewportPaintPreview = ({
  config,
  invalidateRender,
  latest,
  point,
  previewRef,
  scene,
}) => {
  if (!scene || !config || !point || latest.mode === 'play' || !latest.paintMode) {
    hideViewportPreview({ invalidateRender, previewRef, scene });
    return;
  }
  const color = getHexColor(latest.paintBrushColor, TERRAIN_PAINT_DEFAULT_COLOR);
  const radius = getTerrainPaintRadius({ radius: latest.paintBrushRadius });
  const shape = getTerrainPaintShape({ shape: latest.paintBrushShape });
  const radiusWorld = radius * WORLD_SCALE;
  const current = previewRef.current;
  const shouldRebuild = !current
    || Math.abs((current.userData.previewRadius || 0) - radiusWorld) > 0.001
    || current.userData.previewColor !== color
    || current.userData.previewShape !== shape;
  if (shouldRebuild) {
    if (current) removeGroupChild(scene, current);
    previewRef.current = createTerrainPaintPreview(radius, color, shape);
    scene.add(previewRef.current);
  }
  previewRef.current.position.copy(toScenePosition(config, point.x, point.y, 0.092));
  previewRef.current.visible = true;
  invalidateRender({ followupFrames: 1 });
};

export const updateViewportModelEraserPreview = ({
  hit,
  invalidateRender,
  latest,
  previewRef,
  scene,
}) => {
  const sceneX = Number(hit?.sceneX);
  const sceneY = Number(hit?.sceneY);
  const sceneZ = Number(hit?.sceneZ);
  if (
    !scene
    || !Number.isFinite(sceneX)
    || !Number.isFinite(sceneY)
    || !Number.isFinite(sceneZ)
    || latest.mode === 'play'
    || !latest.modelEraserMode
  ) {
    hideViewportPreview({ invalidateRender, previewRef, scene });
    return;
  }
  const color = MODEL_ERASER_PREVIEW_COLOR;
  const radius = getModelEraserRadius({ modelEraserRadius: latest.modelEraserRadius ?? MODEL_ERASER_DEFAULT_RADIUS });
  const radiusWorld = radius * WORLD_SCALE;
  const current = previewRef.current;
  const shouldRebuild = !current
    || Math.abs((current.userData.previewRadius || 0) - radiusWorld) > 0.001
    || current.userData.previewColor !== color;
  if (shouldRebuild) {
    if (current) removeGroupChild(scene, current);
    previewRef.current = createModelEraserSurfacePreview(radiusWorld, color);
    scene.add(previewRef.current);
  }
  previewRef.current.position.set(sceneX, sceneY, sceneZ);
  previewRef.current.visible = true;
  invalidateRender({ followupFrames: 1 });
};
