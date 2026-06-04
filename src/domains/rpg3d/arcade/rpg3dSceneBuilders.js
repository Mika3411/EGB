export {
  DEFAULT_ENGINE,
  EDIT_MODEL_ANIMATION_FRAME_MS,
  ENEMY_RADIUS,
  FLOOR_VISUAL_PADDING_WORLD,
  SHADOW_CAMERA_MIN_EXTENT,
  SHADOW_MAP_SIZE,
  WORLD_SCALE,
  clearGroup,
  configureSunShadowCamera,
  createSelectionRing,
  createSupportSurfaceHeightResolver,
  degreesToRadians,
  disposeObject,
  fromScenePosition,
  getCameraDistance,
  getCameraHeightForDistance,
  getEngine,
  getEntityKey,
  getFlatTileSceneDimensions,
  getFlatTileSurfaceHeight,
  getEntityLiftHeight,
  getSupportSurfaceHeightAtPoint,
  isSelectionActive,
  readEntity,
  removeGroupChild,
  toScenePosition,
  updateSceneLighting,
} from './rpg3dSceneShared.js';

export {
  getEntityZ as getEntityLift,
} from '../../../shared/utils/rpg3dDomain.js';

export {
  addActor,
  addBullet,
  addParticle,
  addPickup,
  getActorVisualSignature,
  getCharacterPreset,
  getCharacterRenderMode,
  getEnemyCharacterId,
  getHeroCharacterId,
  addEquippedArmorToActorModel,
  syncEditableDynamicEntities,
  updateDynamicTransforms,
} from './rpg3dSceneActors.js';

export {
  findArmorArmSocket,
  findArmorSocket,
  getEquippedArmorItem,
  updateFingerTipsWeaponSockets,
} from './rpg3dActorRigging.js';

export {
  addProp,
  addRelief,
  addWall,
} from './rpg3dSceneProps.js';

export {
  addTerrainPaintLayer,
  buildContinuousFloorUvMap,
  createFloorTexture,
  createTerrainPaintPreview,
  getTerrainPaintLayerSignature,
} from './rpg3dSceneTerrain.js';

export {
  addActionZone,
  updateActionZoneHoverHighlight,
} from './rpg3dSceneActionZones.js';

export {
  addStaticSelectionOverlays,
  getSelectionOverlaySignature,
} from './rpg3dSceneSelection.js';

export {
  getStaticModelEraserSignature,
  getStaticSceneSignature,
  getStaticSceneTransformSignature,
  syncStaticModelErasers,
  syncStaticSceneEntities,
  updateStaticEntityTransforms,
} from './rpg3dSceneSignatures.js';
