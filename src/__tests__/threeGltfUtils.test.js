import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { getPreviewAnimationOptions } from '../shared/utils/rpg3dModelImport.js';
import {
  fitObjectToHeight,
  getGltfAnimationClips,
  getGltfModelSource,
  getGltfModelSources,
  getImportedModelPrepareOptions,
  getRuntimeModelPrepareOptions,
  getThreeModelArchiveFileFormat,
  getThreeModelFileFormat,
  getThreeModelFormat,
  hasThreeModelResources,
  loadThreeModelFromSource,
  loadGltfFromSource,
  playGltfAnimations,
  prepareImportedAnimationClipForObject,
  prepareGltfModel,
  stripImportedAnimationTracks,
  THREE_MODEL_ACCEPT,
  updateGltfModelMaterialAppearance,
} from '../shared/utils/threeGltfUtils';

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

  it('updates imported model brightness from the original material state', () => {
    const material = new THREE.MeshStandardMaterial({
      color: '#886644',
      emissive: '#221100',
      emissiveIntensity: 0.8,
      envMapIntensity: 1.4,
    });
    const baseColor = material.color.clone();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh, {
      cloneMaterials: true,
      materialBrightness: 0.5,
      maxEnvMapIntensity: 1,
      maxEmissiveIntensity: 0.3,
    });

    const tunedMaterial = mesh.material;
    expect(tunedMaterial).not.toBe(material);
    expect(tunedMaterial.color.r).toBeCloseTo(baseColor.r * 0.5);
    expect(tunedMaterial.envMapIntensity).toBeCloseTo(1);
    expect(tunedMaterial.emissiveIntensity).toBeCloseTo(0.15);

    updateGltfModelMaterialAppearance(mesh, {
      materialBrightness: 0.8,
      maxEnvMapIntensity: 1,
      maxEmissiveIntensity: 0.3,
    });

    expect(tunedMaterial.color.r).toBeCloseTo(baseColor.r * 0.8);
    expect(tunedMaterial.envMapIntensity).toBeCloseTo(1);
    expect(tunedMaterial.emissiveIntensity).toBeCloseTo(0.24);

    updateGltfModelMaterialAppearance(mesh, {
      materialBrightness: 1,
      maxEnvMapIntensity: 1,
      maxEmissiveIntensity: 0.3,
    });

    expect(tunedMaterial.color.r).toBeCloseTo(baseColor.r);
    expect(tunedMaterial.emissiveIntensity).toBeCloseTo(0.3);
  });

  it('converts unlit GLB materials when real map shadows are required', () => {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffcc66',
      map: new THREE.Texture(),
      transparent: true,
      opacity: 0.72,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh, { forceLitMaterials: true });

    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.material.map).toBe(material.map);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.opacity).toBeCloseTo(0.72);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.userData.convertedToLitMaterial).toBe(true);
  });

  it('preserves authored GLB materials in the RPG runtime path', () => {
    const texture = new THREE.Texture();
    const alphaMap = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: texture,
      alphaMap,
      transparent: true,
      opacity: 0,
      alphaTest: 0.4,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const group = new THREE.Group();
    group.visible = false;
    mesh.visible = false;
    group.add(mesh);

    prepareGltfModel(group, getRuntimeModelPrepareOptions('glb', {
      restoreTextureColor: true,
      forceLitMaterials: true,
      forceVisibleMaterials: true,
      forceVisibleMeshes: true,
      ignoreOpacityTextures: true,
      cloneMaterials: true,
      minimumOpacity: 0.08,
    }));

    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mesh.material).not.toBe(material);
    expect(mesh.material.map).toBe(texture);
    expect(mesh.material.alphaMap).toBe(alphaMap);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.opacity).toBe(0);
    expect(mesh.material.alphaTest).toBe(0.4);
    expect(mesh.material.vertexColors).toBe(true);
    expect(group.visible).toBe(false);
    expect(mesh.visible).toBe(false);
  });

  it('keeps standalone FBX imports visible when external opacity textures are unavailable', () => {
    const material = new THREE.MeshPhongMaterial({
      color: '#111111',
      map: new THREE.Texture(),
      alphaMap: new THREE.Texture(),
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh, getImportedModelPrepareOptions('fbx', {
      restoreTextureColor: true,
      forceLitMaterials: true,
    }));

    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.material.map).toBeNull();
    expect(mesh.material.alphaMap).toBeNull();
    expect(mesh.material.side).toBe(THREE.DoubleSide);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.material.color.getHexString()).toBe('f8fafc');
  });

  it('forces imported character materials visible when a GLB authors them fully transparent', () => {
    const material = new THREE.MeshStandardMaterial({
      color: '#111111',
      alphaMap: new THREE.Texture(),
      transparent: true,
      opacity: 0,
      alphaTest: 1,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const group = new THREE.Group();
    group.visible = false;
    mesh.visible = false;
    group.add(mesh);

    prepareGltfModel(group, {
      forceDoubleSidedMaterials: true,
      forceVisibleMaterials: true,
      forceVisibleMeshes: true,
      ignoreOpacityTextures: true,
      minimumOpacity: 0.08,
    });

    expect(group.visible).toBe(true);
    expect(mesh.visible).toBe(true);
    expect(mesh.material.alphaMap).toBeNull();
    expect(mesh.material.side).toBe(THREE.DoubleSide);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.material.opacity).toBe(1);
    expect(mesh.material.alphaTest).toBe(0.05);
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

  it('keeps live blob URLs ahead of large persisted model data for preview loading', () => {
    const model = {
      modelUrl: 'blob:http://localhost/live-model',
      modelData: 'data:model/gltf-binary;base64,Z2xURg==',
    };

    expect(getGltfModelSource(model)).toBe(model.modelUrl);
    expect(getGltfModelSources(model)).toEqual([model.modelUrl, model.modelData]);
  });

  it('keeps a newly imported data GLB ahead of an older public URL', () => {
    const model = {
      modelUrl: 'https://cdn.example.com/old-character.glb',
      modelData: 'data:model/gltf-binary;base64,bmV3LWdsYg==',
    };

    expect(getGltfModelSource(model)).toBe(model.modelData);
    expect(getGltfModelSources(model)).toEqual([model.modelData, model.modelUrl]);
  });

  it('detects FBX and OBJ model formats from filenames and actor metadata', () => {
    expect(getThreeModelFileFormat(new File(['fbx'], 'hero.fbx'))).toBe('fbx');
    expect(getThreeModelFileFormat(new File(['obj'], 'decor.obj', { type: 'text/plain' }))).toBe('obj');
    expect(getThreeModelFormat({
      characterModelUrl: 'blob:http://localhost/model',
      characterModelName: 'animated-hero.fbx',
    })).toBe('fbx');
    expect(THREE_MODEL_ACCEPT).toContain('.fbx');
    expect(THREE_MODEL_ACCEPT).toContain('.obj');
    expect(THREE_MODEL_ACCEPT).toContain('.zip');
    expect(getThreeModelArchiveFileFormat(new File(['zip'], 'meshy-character.zip', { type: 'application/zip' }))).toBe('zip');
  });

  it('preserves FBX texture maps when a model archive provided resource data', () => {
    const material = new THREE.MeshPhongMaterial({
      color: '#111111',
      map: new THREE.Texture(),
      alphaMap: new THREE.Texture(),
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    prepareGltfModel(mesh, getImportedModelPrepareOptions('fbx', {
      forceLitMaterials: true,
      hasResourceTextures: true,
    }));

    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.material.map).toBeTruthy();
    expect(mesh.material.alphaMap).toBeNull();
    expect(mesh.material.side).toBe(THREE.DoubleSide);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.material.color.getHexString()).toBe('ffffff');
    expect(hasThreeModelResources({
      modelResources: [{ path: 'mage.fbm/Material_001_Diffuse.png', data: 'data:image/png;base64,abc' }],
    })).toBe(true);
  });

  it('loads OBJ data URL sources through the generic 3D loader', async () => {
    const objText = [
      'o Triangle',
      'v 0 0 0',
      'v 1 0 0',
      'v 0 1 0',
      'f 1 2 3',
    ].join('\n');
    const source = `data:model/obj;base64,${btoa(objText)}`;

    const result = await new Promise((resolve, reject) => {
      loadThreeModelFromSource(source, { modelName: 'triangle.obj' }, resolve, reject);
    });

    expect(result.format).toBe('obj');
    expect(result.object.isGroup).toBe(true);
    expect(result.object.children.length).toBeGreaterThan(0);
  });

  it('fits imported GLB objects directly onto the floor plane', () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial());
    object.position.set(2, 5, -3);

    expect(fitObjectToHeight(object, 2, { groundY: 0 })).toBe(true);

    const box = new THREE.Box3().setFromObject(object);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(2, 5);
  });

  it('refreshes clone matrices before fitting animated skinned model copies', () => {
    const object = new THREE.Group();
    const updateMatrixWorld = vi.spyOn(object, 'updateMatrixWorld');
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial()));

    expect(fitObjectToHeight(object, 2, { groundY: 0 })).toBe(true);

    expect(updateMatrixWorld).toHaveBeenCalledWith(true);
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

  it('prefers atk-named clips for attack previews', () => {
    const object = new THREE.Object3D();
    const openerClip = new THREE.AnimationClip('0_Open A_UE5', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
    ]);
    const attackClip = new THREE.AnimationClip('counter_atk02', 1, [
      new THREE.NumberKeyframeTrack('.position[y]', [0, 1], [0, 5]),
    ]);

    const mixer = playGltfAnimations(object, [openerClip, attackClip], {
      ...getPreviewAnimationOptions('attack'),
      timeOffset: 0,
    });

    expect(mixer).toBeTruthy();
    mixer.update(0.5);
    expect(object.position.x).toBe(0);
    expect(object.position.y).toBeGreaterThan(0);
    mixer.stopAllAction();
  });

  it('converts FBX root rotation tracks to the displayed model axis basis', () => {
    const object = new THREE.Object3D();
    const root = new THREE.Bone();
    root.name = 'root';
    root.quaternion.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    object.add(root);
    const sourceRootQuaternion = new THREE.Quaternion(0, 0, -0.4187, 0.9081).normalize();
    const clip = new THREE.AnimationClip('counter_atk02', 1, [
      new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 4, 0, 0]),
      new THREE.VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 0, 0]),
      new THREE.QuaternionKeyframeTrack('root.quaternion', [0, 1], [
        ...sourceRootQuaternion.toArray(),
        ...sourceRootQuaternion.toArray(),
      ]),
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [0, 0, 92, 0, 0, 93]),
      new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, 0.707, 0, 0, 0.707]),
      new THREE.QuaternionKeyframeTrack('hand_r.quaternion', [0, 1], [0, 0, 0, 1, 0.25, 0, 0, 0.968]),
    ]);

    const cleaned = prepareImportedAnimationClipForObject(object, clip, {
      convertFbxRootQuaternionTracks: true,
      stripObjectPositionScaleTracks: true,
    });
    const rootTrack = cleaned.tracks.find((track) => track.name === 'root.quaternion');
    const expectedRootQuaternion = sourceRootQuaternion.clone().premultiply(root.quaternion).normalize();

    expect(cleaned.tracks.map((track) => track.name)).toEqual([
      'root.position',
      'root.quaternion',
      'pelvis.position',
      'pelvis.quaternion',
      'hand_r.quaternion',
    ]);
    Array.from(rootTrack.values.slice(0, 4)).forEach((value, index) => {
      expect(value).toBeCloseTo(expectedRootQuaternion.toArray()[index], 4);
    });
  });

  it('strips only object-level position and scale tracks when requested', () => {
    const clip = new THREE.AnimationClip('move', 1, [
      new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 4, 0, 0]),
      new THREE.VectorKeyframeTrack('.scale', [0, 1], [1, 1, 1, 2, 2, 2]),
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [0, 0, 92, 0, 0, 93]),
    ]);

    const cleaned = stripImportedAnimationTracks(clip, {
      stripObjectPositionScaleTracks: true,
    });

    expect(cleaned.tracks.map((track) => track.name)).toEqual(['pelvis.position']);
  });

  it('can skip fallback animation clips when a preferred idle clip is absent', () => {
    const object = new THREE.Object3D();
    const walkClip = new THREE.AnimationClip('walk-relaxed-loop', 2, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 2], [0, 2]),
    ]);

    const mixer = playGltfAnimations(object, [walkClip], {
      preferredNames: ['idle', 'stand'],
      fallbackToFirst: false,
    });

    expect(mixer).toBeNull();
    expect(object.position.x).toBe(0);
  });

});
