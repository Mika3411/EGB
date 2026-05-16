import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  fitObjectToHeight,
  getGltfAnimationClips,
  getGltfModelSource,
  getGltfModelSources,
  loadGltfFromSource,
  playGltfAnimations,
  prepareGltfModel,
} from '../utils/threeGltfUtils';

describe('prepareGltfModel', () => {
  it('restores visible texture color for generated all-metal GLB materials', () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 1,
      roughness: 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh, { restoreTextureColor: true });

    expect(material.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.envMapIntensity).toBeGreaterThanOrEqual(1.45);
    expect(material.metalness).toBeLessThanOrEqual(0.12);
    expect(material.roughness).toBeLessThanOrEqual(0.78);
  });

  it('keeps authored metalness unless texture color recovery is requested', () => {
    const material = new THREE.MeshStandardMaterial({
      map: new THREE.Texture(),
      metalness: 1,
      roughness: 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh);

    expect(material.metalness).toBe(1);
    expect(material.roughness).toBe(1);
  });

  it('parses data URL GLB sources without routing them through fetch', () => {
    const onLoad = vi.fn();
    const onError = vi.fn();
    const loader = {
      load: vi.fn(),
      parse: vi.fn((buffer, path, done) => done({ buffer, path })),
    };

    loadGltfFromSource(loader, 'data:model/gltf-binary;base64,Z2xURg==', onLoad, onError);

    expect(loader.load).not.toHaveBeenCalled();
    expect(loader.parse).toHaveBeenCalledOnce();
    expect(onLoad).toHaveBeenCalledWith({
      buffer: expect.any(ArrayBuffer),
      path: '',
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('prefers persisted data over stale blob URLs for a single source', () => {
    const model = {
      modelUrl: 'blob:http://localhost/stale-model',
      modelData: 'data:model/gltf-binary;base64,Z2xURg==',
    };

    expect(getGltfModelSource(model)).toBe(model.modelData);
    expect(getGltfModelSources(model)).toEqual([model.modelData, model.modelUrl]);
  });

  it('keeps a newly imported data GLB ahead of an older public URL', () => {
    const model = {
      modelUrl: 'https://cdn.example.com/old-character.glb',
      modelData: 'data:model/gltf-binary;base64,bmV3LWdsYg==',
    };

    expect(getGltfModelSource(model)).toBe(model.modelData);
    expect(getGltfModelSources(model)).toEqual([model.modelData, model.modelUrl]);
  });

  it('fits imported GLB objects directly onto the floor plane', () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial());
    object.position.set(2, 5, -3);

    expect(fitObjectToHeight(object, 2, { groundY: 0 })).toBe(true);

    const box = new THREE.Box3().setFromObject(object);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(2, 5);
  });

  it('extracts and plays GLB animation clips', () => {
    const object = new THREE.Object3D();
    const clip = new THREE.AnimationClip('Idle', 2, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 2], [0, 2]),
    ]);

    expect(getGltfAnimationClips({ animations: [clip] })).toEqual([clip]);
    const mixer = playGltfAnimations(object, [clip], { timeOffset: 1 });

    expect(mixer).toBeTruthy();
    mixer.update(0.25);
    expect(object.position.x).toBeGreaterThan(1);
    mixer.stopAllAction();
  });
});
