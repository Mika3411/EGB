import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createActorAnimationController } from '../components/arcade/rpg3dRuntimeModels.js';

describe('rpg3d runtime models', () => {
  it('builds actor animation controllers without root motion moving the placed model', () => {
    const object = new THREE.Object3D();
    const template = new THREE.Object3D();
    const walkClip = new THREE.AnimationClip('walk-forward', 1, [
      new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 8, 0, 0]),
      new THREE.QuaternionKeyframeTrack('.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    template.userData.gltfAnimationClips = [walkClip];

    const controller = createActorAnimationController(object, template, 'walk', 0);

    expect(controller).toBeTruthy();
    expect(controller.actions.walk.clip.tracks.map((track) => track.name)).toEqual(['.quaternion']);
    controller.mixer.update(1);
    expect(object.position.x).toBe(0);
  });
});
