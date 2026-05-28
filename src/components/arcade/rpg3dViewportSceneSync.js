import * as THREE from 'three';
import {
  FLOOR_VISUAL_PADDING_WORLD,
  WORLD_SCALE,
  addStaticSelectionOverlays,
  addTerrainPaintLayer,
  clearGroup,
  configureSunShadowCamera,
  createFloorTexture,
  syncStaticModelErasers,
  syncStaticSceneEntities,
  updateActionZoneHoverHighlight,
  updateStaticEntityTransforms,
} from './rpg3dSceneBuilders.js';
import {
  getDecorMaterialBrightness,
  getPropRenderMode,
  isFloorDecorKind,
} from '../../utils/rpg3dDomain.js';
import { updateGltfModelMaterialAppearance } from '../../utils/threeGltfUtils.js';

export const syncViewportStaticScene = ({
  actionZoneHoverId = '',
  getModel,
  getTexture,
  groundRef,
  liveConfig,
  mode,
  scene,
  staticGroup,
  staticWorldSignature,
  studioDecorTextureById,
}) => {
  if (!scene || !staticGroup || !liveConfig) return false;
  configureSunShadowCamera(scene.userData.sun, liveConfig);
  const shouldRebuildBase = staticGroup.userData.staticWorldSignature !== staticWorldSignature;
  if (shouldRebuildBase) {
    clearGroup(staticGroup);

    const floorTexture = createFloorTexture();
    const floorVisualPadding = Math.max(
      FLOOR_VISUAL_PADDING_WORLD,
      (Number(liveConfig.world?.width) || 0) * 0.75,
      (Number(liveConfig.world?.height) || 0) * 0.75,
    );
    const floorVisualWidth = Math.max(1, (Number(liveConfig.world?.width) || 1) + floorVisualPadding * 2);
    const floorVisualHeight = Math.max(1, (Number(liveConfig.world?.height) || 1) + floorVisualPadding * 2);
    floorTexture.repeat.set(
      Math.max(1, floorVisualWidth / Math.max(240, liveConfig.world.grid * 2)),
      Math.max(1, floorVisualHeight / Math.max(240, liveConfig.world.grid * 2)),
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.92,
      metalness: 0,
      emissive: '#071016',
      emissiveIntensity: 0.08,
    });
    floorMaterial.userData.disposeTextures = true;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorVisualWidth * WORLD_SCALE, floorVisualHeight * WORLD_SCALE),
      floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.ground = true;
    if (groundRef) groundRef.current = floor;
    staticGroup.add(floor);

    const gridSize = Math.max(liveConfig.world.width, liveConfig.world.height) * WORLD_SCALE;
    const grid = new THREE.GridHelper(
      gridSize,
      Math.max(8, Math.round(Math.max(liveConfig.world.width, liveConfig.world.height) / liveConfig.world.grid)),
      '#67e8f9',
      '#314052',
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    grid.material.depthWrite = false;
    grid.material.depthFunc = THREE.LessDepth;
    grid.position.y = 0.018;
    staticGroup.add(grid);
    staticGroup.userData.staticWorldSignature = staticWorldSignature;
  }

  const didSyncEntities = syncStaticSceneEntities(staticGroup, liveConfig, {
    playMode: mode === 'play',
    getTexture,
    getModel,
    studioDecorTextureById,
  });
  const didUpdateActionZoneHover = updateActionZoneHoverHighlight(
    staticGroup,
    mode === 'play' ? actionZoneHoverId : '',
  );
  return shouldRebuildBase || didSyncEntities || didUpdateActionZoneHover;
};

export const syncViewportTerrainPaintLayer = (terrainPaintGroup, liveConfig) => {
  if (!terrainPaintGroup || !liveConfig) return false;
  clearGroup(terrainPaintGroup);
  addTerrainPaintLayer(terrainPaintGroup, liveConfig);
  return true;
};

export const syncViewportStaticTransforms = (staticGroup, liveConfig) => (
  Boolean(staticGroup && liveConfig && updateStaticEntityTransforms(staticGroup, liveConfig))
);

export const syncViewportStaticModelErasers = ({
  getModel,
  getTexture,
  liveConfig,
  mode,
  staticGroup,
  studioDecorTextureById,
}) => (
  Boolean(staticGroup && liveConfig && syncStaticModelErasers(staticGroup, liveConfig, {
    playMode: mode === 'play',
    getTexture,
    getModel,
    studioDecorTextureById,
  }))
);

export const syncViewportPropMaterialAppearance = (staticGroup, liveConfig) => {
  if (!staticGroup || !liveConfig) return false;
  const propsById = new Map((liveConfig.props || []).map((prop) => [prop.id, prop]));
  let didUpdate = false;
  staticGroup.children.forEach((root) => {
    if (root.userData?.entityType !== 'prop') return;
    const prop = propsById.get(root.userData.entityId);
    if (!prop || getPropRenderMode(prop) !== 'glb') return;
    didUpdate = updateGltfModelMaterialAppearance(root, {
      materialBrightness: getDecorMaterialBrightness(prop),
      maxEnvMapIntensity: isFloorDecorKind(prop.decorKind) ? 0.42 : 1,
      maxEmissiveIntensity: isFloorDecorKind(prop.decorKind) ? 0.03 : 0.18,
    }) || didUpdate;
  });
  return didUpdate;
};

export const syncViewportSelectionOverlay = ({
  liveConfig,
  mode,
  multiSelected,
  selected,
  selectionGroup,
}) => {
  if (!selectionGroup || !liveConfig) return false;
  clearGroup(selectionGroup);
  if (mode !== 'play') {
    addStaticSelectionOverlays(selectionGroup, liveConfig, selected, multiSelected);
  }
  return true;
};
