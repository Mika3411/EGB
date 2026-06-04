import {
  Vector3 as ThreeVector3,
} from 'three';
import { clamp } from '../../../shared/utils/rpg3dDomain.js';
import {
  getCameraDistance,
  getCameraHeightForDistance,
  getEngine,
  getEntityLiftHeight,
  toScenePosition,
} from './rpg3dSceneBuilders.js';
import { findSelectedPosition } from './rpg3dViewportPicking.js';
import {
  ACTION_ZONE_VIEW_BY_ID,
  getActionZoneCurrentViewDistance,
  getNesoCameraTarget,
  getNesoFallbackViewDistance,
  getNesoViewEntity,
} from './rpg3dViewportInteraction.js';

export const syncViewportCameraForFrame = ({
  camera,
  cameraReadyRef,
  controls,
  getActorSupportHeight,
  lastEditCameraDistanceRef,
  latest,
  liveConfig,
  playCameraFollowReadyRef,
  playCameraFollowTargetRef,
  playCameraPanOffsetRef,
  playMode,
  player,
}) => {
  const engine = getEngine(liveConfig);
  const selectedPosition = !playMode ? findSelectedPosition(liveConfig, latest.selected) : null;
  const editFocus = { x: liveConfig.world.width * 0.5, y: liveConfig.world.height * 0.48 };
  const selectedEditFocus = selectedPosition ? {
    x: clamp(selectedPosition.x, liveConfig.world.width * 0.22, liveConfig.world.width * 0.78),
    y: clamp(selectedPosition.y, liveConfig.world.height * 0.22, liveConfig.world.height * 0.78),
  } : null;
  const focus = playMode ? player : (selectedEditFocus || editFocus);
  const focusHeight = playMode
    ? getActorSupportHeight(player) + getEntityLiftHeight(player) + 0.72
    : 0.65;
  const target = toScenePosition(liveConfig, focus.x, focus.y, focusHeight);
  const playCameraTarget = playMode ? target.clone().add(playCameraPanOffsetRef.current) : target;
  const selectedNesoEntity = !playMode && latest.actionZoneViewMode
    ? getNesoViewEntity(latest.selected, latest.multiSelected)
    : null;
  const nesoSideView = selectedNesoEntity ? ACTION_ZONE_VIEW_BY_ID[latest.actionZoneViewMode] : null;
  const cameraDistanceSetting = getCameraDistance(engine);

  if (playMode) {
    const distance = cameraDistanceSetting;
    const height = getCameraHeightForDistance(engine, distance);
    const offset = new ThreeVector3(-distance * 0.48, height, distance * 0.72);
    const cameraFollowTarget = playCameraFollowTargetRef.current;
    if (!playCameraFollowReadyRef.current || cameraFollowTarget.distanceToSquared(playCameraTarget) > 144) {
      cameraFollowTarget.copy(playCameraTarget);
      playCameraFollowReadyRef.current = true;
    } else {
      cameraFollowTarget.lerp(playCameraTarget, 0.08);
    }
    controls.target.copy(cameraFollowTarget);
    camera.position.lerp(cameraFollowTarget.clone().add(offset), 0.12);
    camera.lookAt(cameraFollowTarget);
    lastEditCameraDistanceRef.current = null;
  } else if (nesoSideView && selectedNesoEntity) {
    const sideTarget = getNesoCameraTarget(liveConfig, selectedNesoEntity, engine) || target;
    const sideDirection = nesoSideView.direction.clone().normalize();
    const sideDistance = getActionZoneCurrentViewDistance(
      camera,
      controls,
      getNesoFallbackViewDistance(liveConfig, selectedNesoEntity, cameraDistanceSetting),
    );
    camera.position.copy(sideTarget).add(sideDirection.multiplyScalar(sideDistance));
    camera.lookAt(sideTarget);
    controls.target.copy(sideTarget);
    lastEditCameraDistanceRef.current = null;
  } else {
    const distance = cameraDistanceSetting;
    if (!cameraReadyRef.current) {
      const height = getCameraHeightForDistance(engine, distance);
      camera.position.copy(target.clone().add(new ThreeVector3(-distance * 0.65, height, distance * 0.78)));
      controls.target.copy(target);
      cameraReadyRef.current = true;
      lastEditCameraDistanceRef.current = distance;
    } else if (lastEditCameraDistanceRef.current !== distance) {
      const direction = camera.position.clone().sub(controls.target);
      if (direction.lengthSq() < 0.0001) direction.set(-0.45, 0.42, 0.68);
      direction.normalize();
      camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
      lastEditCameraDistanceRef.current = distance;
    }
  }
  if (!nesoSideView) controls.update();
  return engine;
};
