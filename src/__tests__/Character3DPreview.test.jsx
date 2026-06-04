import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Character3DPreview from '../domains/characters/preview/Character3DPreview.jsx';
import { disposeThreeObject, loadCharacterAnimationAsset, loadThreeCharacter } from '../shared/utils/rpg3dModelImport';
import { loadThreeModelFromSource, playGltfAnimations } from '../shared/utils/threeGltfUtils';

const orbitControlInstances = vi.hoisted(() => []);

vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  class FakeWebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.shadowMap = {};
      this.toneMappingExposure = 1;
      this.pixelRatio = 1;
    }

    setPixelRatio(value) {
      this.pixelRatio = value;
    }

    getPixelRatio() {
      return this.pixelRatio;
    }

    setSize(width, height) {
      this.domElement.width = width;
      this.domElement.height = height;
    }

    render() {}

    dispose() {}

    forceContextLoss() {}
  }

  class FakePMREMGenerator {
    fromScene() {
      return { texture: new actual.Texture() };
    }

    dispose() {}
  }

  return {
    ...actual,
    PMREMGenerator: FakePMREMGenerator,
    WebGLRenderer: FakeWebGLRenderer,
  };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', async () => {
  const actual = await vi.importActual('three');
  return {
    OrbitControls: class {
      constructor() {
        this.target = new actual.Vector3();
        this.enabled = true;
        orbitControlInstances.push(this);
      }

      update() {}

      addEventListener() {}

      removeEventListener() {}

      dispose() {}
    },
  };
});

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: class {
    dispose() {}
  },
}));

vi.mock('../shared/utils/three/clickTargetCameraControls.js', () => ({
  attachClickTargetCameraControls: () => vi.fn(),
}));

vi.mock('../shared/utils/rpg3dModelImport', async () => {
  const THREE = await vi.importActual('three');
  return {
    clearGroup: (group) => group?.clear?.(),
    createPreviewFloorCanvas: () => document.createElement('canvas'),
    disposeThreeObject: vi.fn(),
    getAnimationBaseSlotId: (slot = '') => {
      const text = String(slot || '');
      if (text.startsWith('idle')) return 'idle';
      if (text.startsWith('walk')) return 'walk';
      if (text.startsWith('attack')) return 'attack';
      return '';
    },
    getCharacterBuildSignature: () => 'model-signature',
    getCharacterMaterialBrightness: () => 1,
    getCharacterModelAxisScale: () => ({ x: 1, y: 1, z: 1 }),
    getCharacterModelSources: () => ['blob:character-model'],
    getPreviewAnimationOptions: (slot = '') => ({ preferredNames: [slot].filter(Boolean), fallbackToFirst: true }),
    getPreviewAnimationSlot: (_model, requestedSlot = '') => requestedSlot,
    getPreviewLightIntensity: () => 1,
    getPreviewLightOrientation: () => 0,
    isHeavyLocalFbxAsset: () => false,
    loadCharacterAnimationAsset: vi.fn(),
    loadThreeCharacter: vi.fn((_sources, _model, onLoaded) => {
      const object = new THREE.Object3D();
      object.userData.previewSource = 'character';
      onLoaded(object, [
        new THREE.AnimationClip('Idle', 1, [
          new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
        ]),
      ]);
    }),
    summarizeEmbeddedAnimationClips: () => [],
  };
});

vi.mock('../shared/utils/threeGltfUtils', async () => {
  const THREE = await vi.importActual('three');
  return {
    applyObjectAxisScaleRatios: vi.fn(),
    fitObjectToHeight: vi.fn(),
    getRuntimeModelPrepareOptions: vi.fn(() => ({})),
    hasThreeModelResources: vi.fn(() => false),
    loadThreeModelFromSource: vi.fn((source, payload, onLoaded) => {
      const object = new THREE.Group();
      object.name = source;
      onLoaded({ object, format: payload?.modelFormat || 'glb' });
    }),
    playGltfAnimations: vi.fn(() => ({ stopAllAction: vi.fn(), update: vi.fn() })),
    prepareGltfModel: vi.fn(),
    resetObjectBaseTransform: vi.fn(),
    updateGltfModelMaterialAppearance: vi.fn(),
  };
});

describe('Character3DPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    loadCharacterAnimationAsset.mockReset();
    loadThreeCharacter.mockClear();
    loadThreeModelFromSource.mockClear();
    disposeThreeObject.mockClear();
    playGltfAnimations.mockClear();
    orbitControlInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not fall back to the embedded model animation when the requested attack clip is unreadable', async () => {
    loadCharacterAnimationAsset.mockResolvedValueOnce({ clips: [], object: null });

    render(
      <Character3DPreview
        animationSlot="attack"
        model={{
          id: 'hero',
          modelAnimations: {
            attack: { modelUrl: 'blob:attack-fbx', modelName: 'att.fbx', modelFormat: 'fbx' },
          },
        }}
      />,
    );

    await screen.findByText('Animation attaque non chargée: aucun clip lisible.');

    expect(playGltfAnimations).not.toHaveBeenCalled();
    await waitFor(() => expect(loadCharacterAnimationAsset).toHaveBeenCalledTimes(1));
  });

  it('keeps the displayed character when an attack animation file contains its own mesh', async () => {
    const THREE = await import('three');
    const externalObject = new THREE.Object3D();
    externalObject.userData.previewSource = 'animation-source';
    externalObject.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    const attackClip = new THREE.AnimationClip('counter_atk02', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
    ]);
    loadCharacterAnimationAsset.mockResolvedValueOnce({ clips: [attackClip], object: externalObject, format: 'fbx' });

    render(
      <Character3DPreview
        animationSlot="attack"
        model={{
          id: 'hero',
          modelAnimations: {
            attack: { modelUrl: 'blob:attack-fbx', modelName: 'att.fbx', modelFormat: 'fbx' },
          },
        }}
      />,
    );

    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(1));

    const [playedObject, playedClips, playOptions] = playGltfAnimations.mock.calls[0];
    expect(playedObject.userData.previewSource).toBe('character');
    expect(playedObject).not.toBe(externalObject);
    expect(playedClips).toEqual([attackClip]);
    expect(playOptions).toMatchObject({
      convertFbxRootQuaternionTracks: true,
      stripObjectPositionScaleTracks: true,
    });
    expect(disposeThreeObject).toHaveBeenCalledWith(externalObject);
  });

  it('does not auto-load an external animation when model preview mode is explicit', async () => {
    render(
      <Character3DPreview
        autoPreviewAnimation={false}
        animationSlot=""
        model={{
          id: 'hero',
          modelAnimations: {
            walk: { modelUrl: 'blob:walk-fbx', modelName: 'walk.fbx', modelFormat: 'fbx' },
          },
        }}
      />,
    );

    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(1));

    expect(loadCharacterAnimationAsset).not.toHaveBeenCalled();
    expect(playGltfAnimations.mock.calls[0][1][0].name).toBe('Idle');
  });

  it('can keep embedded model animations stopped for static previews', async () => {
    const onAnimationClipsLoaded = vi.fn();

    render(
      <Character3DPreview
        autoPreviewAnimation={false}
        playEmbeddedAnimations={false}
        animationSlot=""
        onAnimationClipsLoaded={onAnimationClipsLoaded}
        model={{ id: 'hero' }}
      />,
    );

    await waitFor(() => expect(onAnimationClipsLoaded).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(loadCharacterAnimationAsset).not.toHaveBeenCalled();
    expect(playGltfAnimations).not.toHaveBeenCalled();
  });

  it('does not keep the old close zoom cap on the rig camera', async () => {
    render(
      <Character3DPreview
        autoPreviewAnimation={false}
        playEmbeddedAnimations={false}
        initialCameraZoom={4}
        model={{ id: 'hero' }}
      />,
    );

    await waitFor(() => expect(orbitControlInstances).toHaveLength(1));
    expect(orbitControlInstances[0].minDistance).toBeLessThan(0.1);
    expect(orbitControlInstances[0].maxDistance).toBeGreaterThan(1000);
  });

  it('switches preview animations without reloading the character model', async () => {
    const THREE = await import('three');
    const walkClip = new THREE.AnimationClip('walk', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
    ]);
    const attackClip = new THREE.AnimationClip('attack', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
    ]);
    const baseModel = {
      id: 'hero',
      modelUrl: 'blob:character-model',
      modelName: 'hero.glb',
      modelFormat: 'glb',
      modelAnimations: {
        walk: { modelUrl: 'blob:walk-fbx', modelName: 'walk.fbx', modelFormat: 'fbx' },
        attack: { modelUrl: 'blob:attack-fbx', modelName: 'attack.fbx', modelFormat: 'fbx' },
      },
    };
    loadCharacterAnimationAsset
      .mockResolvedValueOnce({ clips: [walkClip], object: null, format: 'fbx' })
      .mockResolvedValueOnce({ clips: [attackClip], object: null, format: 'fbx' });

    const { rerender } = render(
      <Character3DPreview
        autoPreviewAnimation={false}
        animationSlot=""
        model={baseModel}
      />,
    );

    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(1));
    expect(loadThreeCharacter).toHaveBeenCalledTimes(1);

    rerender(
      <Character3DPreview
        autoPreviewAnimation={false}
        animationSlot="walk"
        model={baseModel}
      />,
    );

    await waitFor(() => expect(loadCharacterAnimationAsset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(2));
    expect(loadThreeCharacter).toHaveBeenCalledTimes(1);
    expect(playGltfAnimations.mock.calls[1][1]).toEqual([walkClip]);

    rerender(
      <Character3DPreview
        autoPreviewAnimation={false}
        animationSlot="attack"
        model={{
          ...baseModel,
          modelAnimations: {
            ...baseModel.modelAnimations,
            attack: { ...baseModel.modelAnimations.attack, modelName: 'attack-v2.fbx' },
          },
        }}
      />,
    );

    await waitFor(() => expect(loadCharacterAnimationAsset).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(3));
    expect(loadThreeCharacter).toHaveBeenCalledTimes(1);
    expect(playGltfAnimations.mock.calls[2][1]).toEqual([attackClip]);

    rerender(
      <Character3DPreview
        autoPreviewAnimation={false}
        animationSlot="walk"
        model={{
          ...baseModel,
          modelAnimations: {
            ...baseModel.modelAnimations,
            attack: { ...baseModel.modelAnimations.attack, modelName: 'attack-v2.fbx' },
          },
        }}
      />,
    );

    await waitFor(() => expect(playGltfAnimations).toHaveBeenCalledTimes(4));
    expect(loadCharacterAnimationAsset).toHaveBeenCalledTimes(2);
    expect(loadThreeCharacter).toHaveBeenCalledTimes(1);
    expect(playGltfAnimations.mock.calls[3][1]).toEqual([walkClip]);
  });

  it('rebuilds only the changed preview equipment slot', async () => {
    const baseModel = {
      id: 'hero',
      modelUrl: 'blob:character-model',
      modelName: 'hero.glb',
      modelFormat: 'glb',
      inventory: [
        {
          id: 'weapon-slot',
          type: 'weapon',
          equipped: true,
          weaponModelUrl: 'blob:sword',
          weaponModelName: 'sword.glb',
          weaponModelScale: 1,
        },
        {
          id: 'shield-slot',
          type: 'shield',
          equipped: true,
          weaponModelUrl: 'blob:shield',
          weaponModelName: 'shield.glb',
          weaponModelScale: 1,
        },
      ],
    };

    const { rerender } = render(
      <Character3DPreview
        autoPreviewAnimation={false}
        playEmbeddedAnimations={false}
        model={baseModel}
      />,
    );

    await waitFor(() => expect(loadThreeModelFromSource).toHaveBeenCalledTimes(2));
    expect(loadThreeModelFromSource.mock.calls.map(([source]) => source).sort()).toEqual(['blob:shield', 'blob:sword']);
    loadThreeModelFromSource.mockClear();

    rerender(
      <Character3DPreview
        autoPreviewAnimation={false}
        playEmbeddedAnimations={false}
        model={{
          ...baseModel,
          inventory: [
            {
              ...baseModel.inventory[0],
              weaponModelUrl: 'blob:axe',
              weaponModelName: 'axe.glb',
            },
            baseModel.inventory[1],
          ],
        }}
      />,
    );

    await waitFor(() => expect(loadThreeModelFromSource).toHaveBeenCalledTimes(1));
    expect(loadThreeModelFromSource.mock.calls[0][0]).toBe('blob:axe');
  });
});
