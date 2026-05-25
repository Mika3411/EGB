import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createActorAnimationController,
  createCachedModelGetter,
} from '../components/arcade/rpg3dRuntimeModels.js';

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

  it('plays a dedicated classic idle import even when its clip has a generic name', () => {
    const object = new THREE.Object3D();
    const template = new THREE.Object3D();
    const idleClip = new THREE.AnimationClip('mixamo.com', 1, [
      new THREE.QuaternionKeyframeTrack('.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    template.userData.gltfAnimationClipMap = {
      idle: [idleClip],
    };
    template.userData.gltfAnimationClips = [];

    const controller = createActorAnimationController(object, template, 'idle', 0);

    expect(controller).toBeTruthy();
    expect(controller.actions.idle.clip.name).toBe('mixamo.com');
    expect(controller.currentState).toBe('idle');
  });

  it('blocks heavy runtime FBX character models before they reach WebGL', () => {
    const getModel = createCachedModelGetter(new Map(), new Set(), new Set());
    const source = 'blob:http://localhost/hero-model';

    expect(getModel.getStatus(source, {
      modelFormat: 'fbx',
      modelFileSize: 20 * 1024 * 1024,
    })).toBe('idle');

    expect(getModel.getStatus(source, {
      modelFormat: 'fbx',
      modelFileSize: 128 * 1024 * 1024,
    })).toBe('unsupported');
  });
});
