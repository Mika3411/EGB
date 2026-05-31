import {
  Plane as ThreePlane,
  Vector3 as ThreeVector3,
} from 'three';
import {
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  getActionZoneHeight,
  getActionZoneWidth,
  getPropHeight,
  getPropWidth,
  getReliefHeight,
  getReliefWidth,
} from '../../utils/rpg3dDomain.js';
import {
  ENEMY_RADIUS,
  fromScenePosition,
  readEntity,
} from './rpg3dSceneBuilders.js';
import {
  ACTION_ZONE_VERTEX_POINTS_RAY_THRESHOLD,
  getActionZonePointForEntity,
  getEntityRootObject,
  resolveActionZoneShapeControl,
} from './rpg3dViewportInteraction.js';
import {
  createWorldBoxPoints,
  getProjectedBounds,
  isSameEntity,
  screenRectsIntersect,
} from './rpg3dViewportPicking.js';

export const getViewportScreenPoint = (event, renderer) => {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    screenX: event.clientX - rect.left,
    screenY: event.clientY - rect.top,
    viewport: { width: rect.width, height: rect.height },
  };
};

export const resolveViewportPointer = ({
  camera,
  config,
  dynamicGroup,
  event,
  multiSelected,
  pickEntity = false,
  pointer,
  raycaster,
  renderer,
  scene,
  selected,
  selectionGroup,
  staticGroup,
}) => {
  if (!renderer || !camera || !scene || !config) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const entityHit = pickEntity
    ? (() => {
      const previousPointsThreshold = raycaster.params.Points?.threshold;
      if (raycaster.params.Points) {
        raycaster.params.Points.threshold = ACTION_ZONE_VERTEX_POINTS_RAY_THRESHOLD;
      }
      const hitEntities = raycaster
        .intersectObjects([staticGroup, selectionGroup, dynamicGroup].filter(Boolean), true)
        .map((hit) => readEntity(hit.object))
        .filter(Boolean);
      if (raycaster.params.Points) {
        if (typeof previousPointsThreshold === 'number') raycaster.params.Points.threshold = previousPointsThreshold;
        else delete raycaster.params.Points.threshold;
      }
      return hitEntities.find((entity) => entity.type === 'actionZoneVertex')
        || hitEntities.find((entity) => entity.type === 'actionZoneEdge')
        || hitEntities[0]
        || null;
    })()
    : null;
  let point = null;
  if (!point) {
    const groundPoint = new ThreeVector3();
    const hitGround = raycaster.ray.intersectPlane(new ThreePlane(new ThreeVector3(0, 1, 0), 0), groundPoint);
    if (hitGround) point = fromScenePosition(config, groundPoint);
  }
  if (!point && ['actionZoneVertex', 'actionZoneEdge'].includes(entityHit?.type)) {
    point = getActionZonePointForEntity(config, entityHit);
  }
  if (!point) return null;
  const actionZoneControlHit = pickEntity
    && entityHit?.type !== 'actionZoneVertex'
    && entityHit?.type !== 'actionZoneEdge'
      ? resolveActionZoneShapeControl(config, selected, multiSelected, point)
      : null;
  return {
    point,
    entity: actionZoneControlHit || entityHit,
    screenX: event.clientX - rect.left,
    screenY: event.clientY - rect.top,
  };
};

export const resolveViewportSelectedModelHit = ({
  camera,
  config,
  event,
  pointer,
  raycaster,
  renderer,
  selected,
  staticGroup,
}) => {
  if (!renderer || !camera || !staticGroup || !config?.world || selected?.type !== 'prop' || !selected.id) {
    return null;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster
    .intersectObjects([staticGroup], true)
    .find((candidate) => (
      (candidate.object?.isMesh || candidate.object?.isSkinnedMesh)
      && candidate.object?.userData?.rpg3dModelEraserSurface === true
      && isSameEntity(readEntity(candidate.object), selected)
    ));
  if (!hit?.point) return null;
  const root = getEntityRootObject(hit.object, selected);
  root?.updateWorldMatrix?.(true, false);
  hit.object?.updateWorldMatrix?.(true, false);
  const localScenePoint = root?.worldToLocal?.(hit.point.clone()) || null;
  const localMeshPoint = hit.object?.worldToLocal?.(hit.point.clone()) || null;
  const point = fromScenePosition(config, hit.point);
  return {
    point,
    entity: { type: selected.type, id: selected.id },
    x: point.x,
    y: point.y,
    sceneX: hit.point.x,
    sceneY: hit.point.y,
    sceneZ: hit.point.z,
    localSceneX: localScenePoint?.x,
    localSceneY: localScenePoint?.y,
    localSceneZ: localScenePoint?.z,
    localMeshX: localMeshPoint?.x,
    localMeshY: localMeshPoint?.y,
    localMeshZ: localMeshPoint?.z,
    surfaceIndex: hit.object?.userData?.rpg3dModelEraserSurfaceIndex,
    materialIndex: hit.face?.materialIndex ?? 0,
    uvX: hit.uv?.x,
    uvY: hit.uv?.y,
    screenX: event.clientX - rect.left,
    screenY: event.clientY - rect.top,
  };
};

export const getViewportEntitiesInMarquee = ({
  camera,
  config,
  rect,
  renderer,
}) => {
  if (!renderer || !camera || !config || !rect) return [];
  const viewport = renderer.domElement.getBoundingClientRect();
  if (!viewport.width || !viewport.height) return [];
  const selectedEntities = [];
  const addIfInside = (entity, points) => {
    const bounds = getProjectedBounds(config, camera, viewport, points);
    if (bounds && screenRectsIntersect(bounds, rect)) selectedEntities.push(entity);
  };

  (config.heroes || []).forEach((hero) => {
    addIfInside({ type: 'hero', id: hero.id }, createWorldBoxPoints(hero.x, hero.y, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2));
  });
  (config.enemies || []).forEach((enemy) => {
    addIfInside({ type: 'enemy', id: enemy.id }, createWorldBoxPoints(enemy.x, enemy.y, ENEMY_RADIUS * 2, ENEMY_RADIUS * 2));
  });
  (config.pickups || []).forEach((pickup) => {
    addIfInside({ type: 'pickup', id: pickup.id }, createWorldBoxPoints(pickup.x, pickup.y, PICKUP_RADIUS * 2, PICKUP_RADIUS * 2));
  });
  (config.obstacles || []).forEach((obstacle) => {
    addIfInside(
      { type: 'obstacle', id: obstacle.id },
      createWorldBoxPoints(
        (Number(obstacle.x) || 0) + getPropWidth(obstacle) / 2,
        (Number(obstacle.y) || 0) + getPropHeight(obstacle) / 2,
        getPropWidth(obstacle),
        getPropHeight(obstacle),
      ),
    );
  });
  (config.reliefs || []).forEach((relief) => {
    addIfInside({ type: 'relief', id: relief.id }, createWorldBoxPoints(relief.x, relief.y, getReliefWidth(relief), getReliefHeight(relief)));
  });
  (config.actionZones || []).forEach((zone) => {
    addIfInside({ type: 'actionZone', id: zone.id }, createWorldBoxPoints(zone.x, zone.y, getActionZoneWidth(zone), getActionZoneHeight(zone)));
  });
  (config.props || []).forEach((prop) => {
    addIfInside({ type: 'prop', id: prop.id }, createWorldBoxPoints(prop.x, prop.y, getPropWidth(prop), getPropHeight(prop)));
  });

  return selectedEntities;
};
