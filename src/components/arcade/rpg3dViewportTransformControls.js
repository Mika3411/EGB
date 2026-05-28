import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  applyTransformPreview,
  getTransformPreviewRoots,
} from './rpg3dViewportPicking.js';

export const createArcadeTransformControls = ({
  camera,
  canUseOrbitControls,
  clickStartRef,
  controlsRef,
  domElement,
  findEntityRoots,
  invalidateRenderRef,
  latestRef,
  scene,
  transformControlsRef,
  transformDescriptorRef,
  transformPointerActiveRef,
  transformProxyRef,
  transformSessionRef,
}) => {
  const transformControls = new TransformControls(camera, domElement);
  transformControls.enabled = false;
  transformControls.setSpace('local');
  transformControls.getHelper().visible = false;
  transformControls.addEventListener('change', () => {
    invalidateRenderRef.current({ followupFrames: 2 });
  });
  transformControls.addEventListener('mouseDown', () => {
    const descriptor = transformDescriptorRef.current;
    transformPointerActiveRef.current = true;
    clickStartRef.current = null;
    if (!descriptor || !transformProxyRef.current) return;
    transformSessionRef.current = {
      entity: descriptor.entity,
      mode: latestRef.current.transformMode,
      startRotation: transformProxyRef.current.rotation.clone(),
      startScale: transformProxyRef.current.scale.clone(),
      startProxyQuaternion: transformProxyRef.current.quaternion.clone(),
      startProxyScale: transformProxyRef.current.scale.clone(),
      proportionalAxes: latestRef.current.scaleProportionalAxes,
      previewRoots: getTransformPreviewRoots(findEntityRoots(descriptor.entity), descriptor),
    };
    if (controlsRef.current) controlsRef.current.enabled = false;
  });
  transformControls.addEventListener('objectChange', () => {
    applyTransformPreview(transformSessionRef.current, transformProxyRef.current);
    invalidateRenderRef.current({ followupFrames: 1 });
  });
  transformControls.addEventListener('mouseUp', () => {
    const session = transformSessionRef.current;
    const proxy = transformProxyRef.current;
    if (session && proxy) {
      const scaleRatio = (axis) => {
        const start = Math.max(0.001, session.startScale[axis]);
        const value = proxy.scale[axis] / start;
        return Number.isFinite(value) ? value : 1;
      };
      latestRef.current.onSelectionTransformCommit?.({
        entity: session.entity,
        mode: session.mode,
        rotationDelta: {
          x: THREE.MathUtils.radToDeg(proxy.rotation.x - session.startRotation.x),
          y: THREE.MathUtils.radToDeg(proxy.rotation.y - session.startRotation.y),
          z: THREE.MathUtils.radToDeg(proxy.rotation.z - session.startRotation.z),
        },
        scaleDelta: {
          x: scaleRatio('x'),
          y: scaleRatio('y'),
          z: scaleRatio('z'),
        },
        proportionalAxes: session.proportionalAxes,
      });
    }
    transformSessionRef.current = null;
    window.setTimeout(() => {
      transformPointerActiveRef.current = false;
    }, 0);
    invalidateRenderRef.current({ followupFrames: 2 });
  });
  transformControls.addEventListener('dragging-changed', (event) => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !event.value && canUseOrbitControls();
    }
  });
  scene.add(transformControls.getHelper());
  transformControlsRef.current = transformControls;
  return transformControls;
};
