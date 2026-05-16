import * as THREE from 'three';

const panUp = new THREE.Vector3();
const panOffset = new THREE.Vector3();

const getScreenSpacePanScale = ({ camera, controls, domElement }) => {
  const rect = domElement.getBoundingClientRect();
  const height = Math.max(1, rect.height || domElement.clientHeight || 1);
  const width = Math.max(1, rect.width || domElement.clientWidth || 1);

  if (camera.isPerspectiveCamera) {
    const targetDistance = Math.max(0.001, camera.position.distanceTo(controls.target));
    return {
      x: (2 * targetDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) / height,
      y: (2 * targetDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) / height,
    };
  }

  if (camera.isOrthographicCamera) {
    return {
      x: Math.abs(camera.right - camera.left) / Math.max(0.001, camera.zoom) / width,
      y: Math.abs(camera.top - camera.bottom) / Math.max(0.001, camera.zoom) / height,
    };
  }

  return { x: 0.01, y: 0.01 };
};

export const attachClickTargetCameraControls = ({
  camera,
  controls,
  domElement,
  scene,
  enabled = () => true,
}) => {
  if (!camera || !controls || !domElement || !scene) return () => {};

  const panState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startCamera: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    scale: { x: 0.01, y: 0.01 },
  };

  controls.screenSpacePanning = true;

  const isEnabled = () => (typeof enabled === 'function' ? enabled() : Boolean(enabled));

  const startScreenPan = (event) => {
    if (!isEnabled() || event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    camera.updateMatrixWorld();
    panState.active = true;
    panState.pointerId = event.pointerId;
    panState.startX = event.clientX;
    panState.startY = event.clientY;
    panState.startCamera.copy(camera.position);
    panState.startTarget.copy(controls.target);
    panState.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    panState.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    panState.scale = getScreenSpacePanScale({ camera, controls, domElement });
    domElement.setPointerCapture?.(event.pointerId);
  };

  const moveScreenPan = (event) => {
    if (!panState.active || panState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const deltaX = event.clientX - panState.startX;
    const deltaY = event.clientY - panState.startY;
    panOffset
      .copy(panState.right).multiplyScalar(-deltaX * panState.scale.x)
      .add(panUp.copy(panState.up).multiplyScalar(deltaY * panState.scale.y));
    camera.position.copy(panState.startCamera).add(panOffset);
    controls.target.copy(panState.startTarget).add(panOffset);
    controls.update();
  };

  const endScreenPan = (event) => {
    if (!panState.active || panState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    panState.active = false;
    panState.pointerId = null;
    domElement.releasePointerCapture?.(event.pointerId);
  };

  const preventContextMenu = (event) => {
    if (!isEnabled()) return;
    event.preventDefault();
  };

  domElement.addEventListener('pointerdown', startScreenPan, true);
  domElement.addEventListener('pointermove', moveScreenPan, true);
  domElement.addEventListener('pointerup', endScreenPan, true);
  domElement.addEventListener('pointercancel', endScreenPan, true);
  domElement.addEventListener('contextmenu', preventContextMenu);

  return () => {
    domElement.removeEventListener('pointerdown', startScreenPan, true);
    domElement.removeEventListener('pointermove', moveScreenPan, true);
    domElement.removeEventListener('pointerup', endScreenPan, true);
    domElement.removeEventListener('pointercancel', endScreenPan, true);
    domElement.removeEventListener('contextmenu', preventContextMenu);
  };
};
