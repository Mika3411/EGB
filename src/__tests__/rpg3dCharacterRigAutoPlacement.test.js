import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  getCharacterRigAutoAnchorMap,
  getCharacterRigAutoWorldPosition,
  isDefaultCharacterRigPointPlacement,
} from '../shared/utils/rpg3dCharacterRigAutoPlacement.js';
import { normalizeCharacterRigPoint } from '../shared/utils/rpg3dCharacterRig.js';

const makeRiggedRoot = () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.position.set(0, 1, 0);
  root.add(mesh);

  const rightHand = new THREE.Bone();
  rightHand.name = 'mixamorigRightHand';
  rightHand.position.set(0.92, 1.18, 0.14);
  root.add(rightHand);

  const rightIndex2 = new THREE.Bone();
  rightIndex2.name = 'mixamorigRightHandIndex2';
  rightIndex2.position.set(0.12, -0.08, 0.04);
  rightHand.add(rightIndex2);

  const rightKnee = new THREE.Bone();
  rightKnee.name = 'mixamorigRightLeg';
  rightKnee.position.set(0.34, 0.56, 0.05);
  root.add(rightKnee);

  const rightAnkle = new THREE.Bone();
  rightAnkle.name = 'mixamorigRightFoot';
  rightAnkle.position.set(0.02, -0.42, 0.03);
  rightKnee.add(rightAnkle);

  const rightFoot = new THREE.Bone();
  rightFoot.name = 'mixamorigRightToeBase';
  rightFoot.position.set(0.01, -0.03, -0.16);
  rightAnkle.add(rightFoot);

  root.updateMatrixWorld(true);
  return { root, rightHand, rightIndex2, rightKnee, rightAnkle, rightFoot };
};

describe('rpg3dCharacterRigAutoPlacement', () => {
  it('places default body and phalange points on matching character bones', () => {
    const { root, rightHand, rightIndex2, rightKnee, rightAnkle, rightFoot } = makeRiggedRoot();
    const bounds = new THREE.Box3().setFromObject(root);
    const anchors = getCharacterRigAutoAnchorMap(root, bounds);

    expect(anchors.has('right-hand')).toBe(true);
    expect(anchors.has('right-phalange-index-2')).toBe(true);
    expect(anchors.has('right-knee')).toBe(true);
    expect(anchors.has('right-ankle')).toBe(true);
    expect(anchors.has('right-foot')).toBe(true);

    const handPoint = normalizeCharacterRigPoint({ id: 'right-hand' });
    const handWorld = getCharacterRigAutoWorldPosition(root, handPoint, bounds, anchors);
    expect(handWorld.distanceTo(rightHand.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.0001);

    const phalangePoint = normalizeCharacterRigPoint({ id: 'right-phalange-index-2' });
    const phalangeWorld = getCharacterRigAutoWorldPosition(root, phalangePoint, bounds, anchors);
    expect(phalangeWorld.distanceTo(rightIndex2.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.0001);

    const kneePoint = normalizeCharacterRigPoint({ id: 'right-knee' });
    const kneeWorld = getCharacterRigAutoWorldPosition(root, kneePoint, bounds, anchors);
    expect(kneeWorld.distanceTo(rightKnee.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.0001);

    const anklePoint = normalizeCharacterRigPoint({ id: 'right-ankle' });
    const ankleWorld = getCharacterRigAutoWorldPosition(root, anklePoint, bounds, anchors);
    expect(ankleWorld.distanceTo(rightAnkle.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.0001);

    const footPoint = normalizeCharacterRigPoint({ id: 'right-foot' });
    const footWorld = getCharacterRigAutoWorldPosition(root, footPoint, bounds, anchors);
    expect(footWorld.distanceTo(rightFoot.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.0001);
  });

  it('keeps user-moved rig points manual', () => {
    const { root } = makeRiggedRoot();
    const bounds = new THREE.Box3().setFromObject(root);
    const anchors = getCharacterRigAutoAnchorMap(root, bounds);
    const movedPoint = normalizeCharacterRigPoint({
      id: 'right-hand',
      enabled: true,
      x: 0.82,
      y: 0.5,
      z: 0.7,
    });

    expect(isDefaultCharacterRigPointPlacement(movedPoint)).toBe(false);
    expect(getCharacterRigAutoWorldPosition(root, movedPoint, bounds, anchors)).toBeNull();
  });
});
