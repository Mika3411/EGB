import {
  getDecorModelScale as getPropModelScale,
  getEntityZ as getEntityLift,
  getFloorZeroZ,
  getModelEraserStrokes,
  getPropHeight,
  getPropModelHeight,
  getPropModelSource,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  normalizeModelRotation as normalizeModelRotationDegrees,
} from '../../utils/rpg3dDomain.js';

import {
  getImageSignature,
  getModelResourcesSignature,
} from './rpg3dRuntimeModels.js';

import {
  addActionZone,
  getActionZoneSceneDimensions,
  getActionZoneStructureSignature,
  getActionZoneTransformSignature,
} from './rpg3dSceneActionZones.js';

import {
  addProp,
  addRelief,
  addWall,
  applyModelEraserToGltfModel,
  applyPropModelOrientation,
  getModelEraserVisualSignature,
  getObstacleSceneDimensions,
  getPropSceneDimensions,
  getReliefSceneDimensions,
} from './rpg3dSceneProps.js';

import {
  collectStaticAnimationMixers,
  DEFAULT_ENGINE,
  degreesToRadians,
  getEngine,
  getEntityLiftHeight,
  removeGroupChild,
  scaleRootFromBase,
  toScenePosition,
} from './rpg3dSceneShared.js';

import {
  buildContinuousFloorUvMap,
} from './rpg3dSceneTerrain.js';

const getStaticEngineSignature = (engine = {}) => [
  Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight,
  Number(engine.reliefScale) || DEFAULT_ENGINE.reliefScale,
  Number(engine.propHeight) || DEFAULT_ENGINE.propHeight,
].join(':');

const getObstacleVisualSignature = (obstacle = {}) => [
  obstacle.id || '',
  Number(obstacle.x) || 0,
  Number(obstacle.y) || 0,
  Math.round(getEntityLift(obstacle)),
  Number(obstacle.w) || 0,
  Number(obstacle.h) || 0,
].join(':');

const getObstacleStructureSignature = (obstacle = {}) => [
  obstacle.id || '',
].join(':');

const getObstacleTransformSignature = (obstacle = {}) => [
  obstacle.id || '',
  Number(obstacle.x) || 0,
  Number(obstacle.y) || 0,
  Math.round(getEntityLift(obstacle)),
  Number(obstacle.w) || 0,
  Number(obstacle.h) || 0,
].join(':');

const getReliefVisualSignature = (relief = {}) => [
  relief.id || '',
  Number(relief.x) || 0,
  Number(relief.y) || 0,
  Math.round(getEntityLift(relief)),
  getReliefWidth(relief),
  getReliefHeight(relief),
  getReliefElevation(relief),
  relief.style || 'plateau',
  relief.blocksMovement ? 1 : 0,
].join(':');

const getReliefStructureSignature = (relief = {}) => [
  relief.id || '',
  relief.style || 'plateau',
  relief.blocksMovement ? 1 : 0,
  getReliefElevation(relief) >= 0 ? 'up' : 'down',
].join(':');

const getReliefTransformSignature = (relief = {}) => [
  relief.id || '',
  Number(relief.x) || 0,
  Number(relief.y) || 0,
  Math.round(getEntityLift(relief)),
  getReliefWidth(relief),
  getReliefHeight(relief),
  getReliefElevation(relief),
].join(':');

const getPropVisualSignature = (prop = {}) => [
  prop.id || '',
  prop.name || '',
  Number(prop.x) || 0,
  Number(prop.y) || 0,
  Math.round(getEntityLift(prop)),
  Math.round(Number(prop.rotation) || 0),
  getPropWidth(prop),
  getPropHeight(prop),
  getPropModelHeight(prop),
  getPropRenderMode(prop),
  prop.decorKind || '',
  getPropModelScale(prop),
  prop.decorModel3dId || '',
  prop.decorModelName || '',
  getImageSignature(getPropModelSource(prop)),
  getModelResourcesSignature(prop),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationX || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationY || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationZ || 0)),
  prop.modelCenterOnOrigin ? 1 : 0,
  prop.modelFlushToGround ? 1 : 0,
  getModelEraserVisualSignature(prop),
  prop.imageName || '',
  getImageSignature(prop.imageData),
  prop.repeatTexture ? 1 : 0,
  prop.baseColor || '',
  prop.floorColor || '',
  getFloorZeroZ(prop),
].join(':');

const getPropStructureSignature = (prop = {}) => [
  prop.id || '',
  getPropRenderMode(prop),
  prop.decorKind || '',
  prop.decorModel3dId || '',
  prop.decorModelName || '',
  getImageSignature(getPropModelSource(prop)),
  getModelResourcesSignature(prop),
  prop.modelCenterOnOrigin ? 1 : 0,
  prop.modelFlushToGround ? 1 : 0,
  prop.imageName || '',
  getImageSignature(prop.imageData),
  prop.repeatTexture ? 1 : 0,
  prop.baseColor || '',
  prop.floorColor || '',
].join(':');

const getPropTransformSignature = (prop = {}) => [
  prop.id || '',
  Number(prop.x) || 0,
  Number(prop.y) || 0,
  Math.round(getEntityLift(prop)),
  Math.round(Number(prop.rotation) || 0),
  getPropWidth(prop),
  getPropHeight(prop),
  getPropModelHeight(prop),
  getPropModelScale(prop),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationX || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationY || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationZ || 0)),
  getFloorZeroZ(prop),
].join(':');

const getStaticSceneSignature = (config = {}) => {
  const world = config.world || {};
  return [
    Number(world.width) || 0,
    Number(world.height) || 0,
    Number(world.grid) || 0,
    (config.obstacles || []).map(getObstacleStructureSignature).join(';'),
    (config.reliefs || []).map(getReliefStructureSignature).join(';'),
    (config.actionZones || []).map(getActionZoneStructureSignature).join(';'),
    (config.props || []).map(getPropStructureSignature).join(';'),
  ].join('|');
};

const getStaticSceneTransformSignature = (config = {}) => {
  const engine = getEngine(config);
  return [
    getStaticEngineSignature(engine),
    (config.obstacles || []).map(getObstacleTransformSignature).join(';'),
    (config.reliefs || []).map(getReliefTransformSignature).join(';'),
    (config.actionZones || []).map(getActionZoneTransformSignature).join(';'),
    (config.props || []).map(getPropTransformSignature).join(';'),
  ].join('|');
};

const getStaticModelEraserSignature = (config = {}) => (
  (config.props || [])
    .filter((prop) => getPropRenderMode(prop) === 'glb')
    .map((prop) => [
      prop.id || '',
      getModelEraserVisualSignature(prop),
    ].join(':'))
    .join('|')
);

const findStaticEntityRoot = (group, type, id) => (
  group?.children.find((child) => child.userData?.entityType === type && child.userData?.entityId === id) || null
);

const updateObstacleTransform = (root, config, obstacle, engine) => {
  if (!root || !obstacle) return false;
  const dimensions = getObstacleSceneDimensions(obstacle, engine);
  const width = Number(obstacle.w) || 0;
  const height = Number(obstacle.h) || 0;
  root.position.copy(toScenePosition(
    config,
    (Number(obstacle.x) || 0) + width / 2,
    (Number(obstacle.y) || 0) + height / 2,
    getEntityLiftHeight(obstacle),
  ));
  root.rotation.set(0, 0, 0);
  return scaleRootFromBase(root, dimensions);
};

const updateReliefTransform = (root, config, relief, engine) => {
  if (!root || !relief) return false;
  root.position.copy(toScenePosition(config, relief.x, relief.y, getEntityLiftHeight(relief)));
  root.rotation.set(0, 0, 0);
  return scaleRootFromBase(root, getReliefSceneDimensions(relief, engine));
};

const updateActionZoneTransform = (root, config, zone) => {
  if (!root || !zone) return false;
  root.position.copy(toScenePosition(config, zone.x, zone.y, 0));
  root.rotation.set(0, 0, 0);
  return scaleRootFromBase(root, getActionZoneSceneDimensions(zone));
};

const updatePropTransform = (root, config, prop, engine) => {
  if (!root || !prop) return false;
  root.position.copy(toScenePosition(config, prop.x, prop.y, getEntityLiftHeight(prop)));
  root.rotation.y = degreesToRadians(prop.rotation || 0);
  applyPropModelOrientation(root, prop);
  return scaleRootFromBase(root, getPropSceneDimensions(prop, engine));
};

const updateStaticEntityTransforms = (group, config = {}) => {
  if (!group || !config) return false;
  const engine = getEngine(config);
  let didUpdate = false;
  (config.obstacles || []).forEach((obstacle) => {
    didUpdate = updateObstacleTransform(findStaticEntityRoot(group, 'obstacle', obstacle.id), config, obstacle, engine) || didUpdate;
  });
  (config.reliefs || []).forEach((relief) => {
    didUpdate = updateReliefTransform(findStaticEntityRoot(group, 'relief', relief.id), config, relief, engine) || didUpdate;
  });
  (config.actionZones || []).forEach((zone) => {
    didUpdate = updateActionZoneTransform(findStaticEntityRoot(group, 'actionZone', zone.id), config, zone) || didUpdate;
  });
  (config.props || []).forEach((prop) => {
    didUpdate = updatePropTransform(findStaticEntityRoot(group, 'prop', prop.id), config, prop, engine) || didUpdate;
  });
  return didUpdate;
};

const STATIC_ENTITY_TYPES = new Set(['obstacle', 'relief', 'actionZone', 'prop']);

const getStaticEntityRootKey = (type, id) => (type && id ? `${type}:${id}` : '');

const getStaticRootKey = (root) => getStaticEntityRootKey(root?.userData?.entityType, root?.userData?.entityId);

const getFloorUvStructureSignature = (mapping = null) => {
  if (!mapping) return '';
  return [
    mapping.minX,
    mapping.minY,
    mapping.maxX,
    mapping.maxY,
    mapping.width,
    mapping.height,
    mapping.tileCenterX,
    mapping.tileCenterY,
  ].map((value) => Math.round((Number(value) || 0) * 10)).join(',');
};

const getStaticEntityStructureSignature = (type, item, context = {}) => {
  if (type === 'obstacle') return getObstacleStructureSignature(item);
  if (type === 'relief') return getReliefStructureSignature(item);
  if (type === 'actionZone') return [
    getActionZoneStructureSignature(item),
    context.playMode ? 1 : 0,
  ].join(':');
  if (type === 'prop') return [
    getPropStructureSignature(item),
    getPropRenderMode(item) === 'floor' ? getFloorUvStructureSignature(context.floorUv) : '',
    context.modelStatus || '',
  ].join('|');
  return '';
};

const getRenderedStaticProps = (config = {}, studioDecorTextureById = null) => (
  (config.props || []).map((prop) => {
    const studioTexture = prop.decorModel3dId && !prop.imageData
      ? studioDecorTextureById?.get?.(prop.decorModel3dId)
      : null;
    return studioTexture ? { ...prop, ...studioTexture } : prop;
  })
);

const getStaticEntityDescriptors = (config = {}, options = {}) => {
  const engine = getEngine(config);
  const playMode = Boolean(options.playMode);
  const getTexture = options.getTexture || (() => null);
  const getModel = options.getModel || (() => null);
  const descriptors = [];

  (config.obstacles || []).forEach((obstacle) => {
    descriptors.push({
      type: 'obstacle',
      id: obstacle.id,
      signature: getStaticEntityStructureSignature('obstacle', obstacle),
      add: (group) => addWall(group, config, obstacle, engine, false),
    });
  });

  (config.reliefs || []).forEach((relief) => {
    descriptors.push({
      type: 'relief',
      id: relief.id,
      signature: getStaticEntityStructureSignature('relief', relief),
      add: (group) => addRelief(group, config, relief, engine, false),
    });
  });

  (config.actionZones || []).forEach((zone) => {
    descriptors.push({
      type: 'actionZone',
      id: zone.id,
      signature: getStaticEntityStructureSignature('actionZone', zone, { playMode }),
      add: (group) => addActionZone(group, config, zone, { playMode }),
    });
  });

  const renderedProps = getRenderedStaticProps(config, options.studioDecorTextureById || null);
  const continuousFloorUvMap = buildContinuousFloorUvMap(renderedProps);
  renderedProps.forEach((prop) => {
    const modelSource = getPropModelSource(prop);
    const modelStatus = getPropRenderMode(prop) === 'glb' ? getModel?.getStatus?.(modelSource, prop) || '' : '';
    const floorUv = continuousFloorUvMap.get(prop.id) || null;
    descriptors.push({
      type: 'prop',
      id: prop.id,
      signature: getStaticEntityStructureSignature('prop', prop, { floorUv, modelStatus }),
      modelEraserSignature: getModelEraserVisualSignature(prop),
      modelEraserStrokeCount: getModelEraserStrokes(prop).length,
      add: (group) => addProp(
        group,
        config,
        prop,
        engine,
        false,
        getTexture,
        getModel,
        { floorUv },
      ),
    });
  });

  return descriptors;
};

const syncStaticSceneEntities = (group, config = {}, options = {}) => {
  if (!group || !config) return false;
  const descriptors = getStaticEntityDescriptors(config, options);
  const descriptorByKey = new Map(descriptors.map((descriptor) => [
    getStaticEntityRootKey(descriptor.type, descriptor.id),
    descriptor,
  ]));
  const existingByKey = new Map();
  let didChange = false;

  [...group.children].forEach((root) => {
    const rootKey = getStaticRootKey(root);
    if (!rootKey || !STATIC_ENTITY_TYPES.has(root.userData?.entityType)) return;
    const descriptor = descriptorByKey.get(rootKey);
    if (!descriptor || root.userData?.staticStructureSignature !== descriptor.signature) {
      removeGroupChild(group, root);
      didChange = true;
      return;
    }
    existingByKey.set(rootKey, root);
  });

  descriptors.forEach((descriptor) => {
    const key = getStaticEntityRootKey(descriptor.type, descriptor.id);
    if (existingByKey.has(key)) return;
    const beforeCount = group.children.length;
    descriptor.add(group);
    const root = group.children[beforeCount] || group.children[group.children.length - 1];
    if (root) {
      root.userData.staticStructureSignature = descriptor.signature;
      if (descriptor.type === 'prop') {
        root.userData.modelEraserSignature = descriptor.modelEraserSignature || '';
        root.userData.modelEraserStrokeCount = descriptor.modelEraserStrokeCount || 0;
      }
    }
    didChange = true;
  });

  group.userData.animationMixers = collectStaticAnimationMixers(group);
  updateStaticEntityTransforms(group, config);
  return didChange;
};

const syncStaticModelErasers = (group, config = {}, options = {}) => {
  if (!group || !config) return false;
  const descriptors = getStaticEntityDescriptors(config, options);
  const propDescriptorsById = new Map(
    descriptors
      .filter((descriptor) => descriptor.type === 'prop')
      .map((descriptor) => [descriptor.id, descriptor]),
  );
  let didChange = false;

  (config.props || []).forEach((prop) => {
    if (getPropRenderMode(prop) !== 'glb') return;
    const root = findStaticEntityRoot(group, 'prop', prop.id);
    if (!root) return;
    const nextSignature = getModelEraserVisualSignature(prop);
    const appliedSignature = root.userData?.modelEraserSignature || '';
    const strokes = getModelEraserStrokes(prop);
    const appliedStrokeCount = Math.max(0, Number(root.userData?.modelEraserStrokeCount) || 0);
    if (nextSignature === appliedSignature) return;

    const canAppend = (
      strokes.length >= appliedStrokeCount
      && (
        !appliedSignature
        || nextSignature.startsWith(`${appliedSignature};`)
      )
    );
    if (canAppend) {
      const nextStrokes = strokes.slice(appliedStrokeCount);
      const didClip = applyModelEraserToGltfModel(root, { ...prop, modelEraserStrokes: nextStrokes }, config);
      root.userData.modelEraserSignature = nextSignature;
      root.userData.modelEraserStrokeCount = strokes.length;
      didChange = didClip || didChange;
      return;
    }

    const descriptor = propDescriptorsById.get(prop.id);
    if (!descriptor) return;
    removeGroupChild(group, root);
    const beforeCount = group.children.length;
    descriptor.add(group);
    const nextRoot = group.children[beforeCount] || group.children[group.children.length - 1];
    if (nextRoot) {
      nextRoot.userData.staticStructureSignature = descriptor.signature;
      nextRoot.userData.modelEraserSignature = descriptor.modelEraserSignature || '';
      nextRoot.userData.modelEraserStrokeCount = descriptor.modelEraserStrokeCount || 0;
    }
    didChange = true;
  });

  if (didChange) {
    group.userData.animationMixers = collectStaticAnimationMixers(group);
    updateStaticEntityTransforms(group, config);
  }
  return didChange;
};

export {
  getStaticEngineSignature,
  getObstacleVisualSignature,
  getObstacleStructureSignature,
  getObstacleTransformSignature,
  getReliefVisualSignature,
  getReliefStructureSignature,
  getReliefTransformSignature,
  getPropVisualSignature,
  getPropStructureSignature,
  getPropTransformSignature,
  getStaticSceneSignature,
  getStaticSceneTransformSignature,
  getStaticModelEraserSignature,
  findStaticEntityRoot,
  updateObstacleTransform,
  updateReliefTransform,
  updateActionZoneTransform,
  updatePropTransform,
  updateStaticEntityTransforms,
  STATIC_ENTITY_TYPES,
  getStaticEntityRootKey,
  getStaticRootKey,
  getFloorUvStructureSignature,
  getStaticEntityStructureSignature,
  getRenderedStaticProps,
  getStaticEntityDescriptors,
  syncStaticSceneEntities,
  syncStaticModelErasers,
};
