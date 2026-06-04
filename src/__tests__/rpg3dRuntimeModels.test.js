import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  createActorAnimationController,
  createCachedModelGetter,
  disposeRuntimeModelObject,
} from '../domains/rpg3d/arcade/rpg3dRuntimeModels.js';

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

  it('disposes runtime model textures with cached model templates', () => {
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const object = new THREE.Mesh(geometry, material);
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeTexture = vi.spyOn(texture, 'dispose');

    disposeRuntimeModelObject(object);

    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });

  it('does not cache async models after the viewport cache token is inactive', () => {
    const cache = new Map();
    const pending = new Set();
    const failed = new Set();
    const onLoaded = vi.fn();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const getModel = createCachedModelGetter(cache, pending, failed, onLoaded, {
      isActive: () => false,
      loadModelFromSource: (source, model, onLoad) => onLoad({ object, animations: [], format: 'glb' }),
      loadModelAnimationClipMap: async () => ({}),
    });

    expect(getModel('hero.glb', { modelFormat: 'glb' })).toBeNull();

    expect(cache.size).toBe(0);
    expect(pending.size).toBe(0);
    expect(onLoaded).not.toHaveBeenCalled();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
  });
});
