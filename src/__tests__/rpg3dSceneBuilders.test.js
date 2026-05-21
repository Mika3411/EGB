import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_ENGINE,
  WORLD_SCALE,
  addProp,
  addActor,
  addStaticSelectionOverlays,
  getStaticModelEraserSignature,
  getStaticSceneSignature,
  getStaticSceneTransformSignature,
  syncEditableDynamicEntities,
  syncStaticModelErasers,
  syncStaticSceneEntities,
  toScenePosition,
  updateActionZoneHoverHighlight,
  updateDynamicTransforms,
  updateSceneLighting,
  updateStaticEntityTransforms,
} from '../components/arcade/rpg3dSceneBuilders.js';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';

const createSceneConfig = () => {
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.world = { width: 500, height: 400, grid: 100 };
  config.props = [];
  return config;
};

const createModelTemplate = () => {
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  ));
  template.userData.modelFormat = 'glb';
  return template;
};

describe('rpg3d scene builders', () => {
  it('keeps floor textures in repeated mode on the map', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const getTexture = vi.fn(() => new THREE.Texture());
    const floor = {
      id: 'floor-texture-1',
      x: 250,
      y: 200,
      w: 240,
      h: 160,
      r: 120,
      renderMode: 'floor',
      imageData: 'data:image/png;base64,texture',
      repeatTexture: false,
    };

    addProp(group, config, floor, DEFAULT_ENGINE, false, getTexture, () => null);

    expect(getTexture).toHaveBeenCalledWith(floor.imageData, true);
  });

  it('draws discreet draggable handles on every action zone vertex', () => {
    const config = createSceneConfig();
    config.actionZones = [{
      id: 'zone-1',
      x: 250,
      y: 200,
      w: 120,
      h: 100,
      vertices: [
        { x: 190, y: 150 },
        { x: 310, y: 150 },
        { x: 310, y: 250 },
        { x: 190, y: 250 },
      ],
      topVertices: [
        { x: 190, y: 150, z: 180 },
        { x: 310, y: 150, z: 240 },
        { x: 310, y: 250, z: 300 },
        { x: 190, y: 250, z: 240 },
      ],
    }];
    const group = new THREE.Group();

    addStaticSelectionOverlays(group, config, { type: 'actionZone', id: 'zone-1' }, []);

    const handleMarkers = [];
    const edgeHandles = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dActionZoneVertexHandle) handleMarkers.push(object);
      if (object.type === 'Group' && object.userData?.entityType === 'actionZoneEdge') edgeHandles.push(object);
    });
    expect(handleMarkers).toHaveLength(8);
    expect(handleMarkers.every((object) => object.isPoints)).toBe(true);
    expect(handleMarkers.every((object) => object.material.map?.isDataTexture)).toBe(true);
    expect(handleMarkers.every((object) => object.material.size === 10)).toBe(true);
    expect(handleMarkers.every((object) => object.material.sizeAttenuation === false)).toBe(true);
    const topHandleHeights = handleMarkers
      .filter((object) => object.userData.entityVertexLayer === 'top')
      .map((object) => object.parent.position.y);
    expect(Math.min(...topHandleHeights)).toBeCloseTo(180 * WORLD_SCALE + 0.14);
    expect(Math.max(...topHandleHeights)).toBeCloseTo(300 * WORLD_SCALE + 0.14);
    expect([...new Set(handleMarkers.map((object) => object.userData.entityVertexIndex))]).toEqual([0, 1, 2, 3]);
    expect([...new Set(handleMarkers.map((object) => object.userData.entityVertexLayer))]).toEqual(['bottom', 'top']);
    expect(handleMarkers.every((object) => object.userData.entityType === 'actionZoneVertex')).toBe(true);
    expect(edgeHandles).toHaveLength(8);
    expect([...new Set(edgeHandles.map((object) => object.userData.entityEdgeIndex))]).toEqual([0, 1, 2, 3]);
    expect([...new Set(edgeHandles.map((object) => object.userData.entityVertexLayer))]).toEqual(['bottom', 'top']);
  });

  it('hides action zones in play until the pointer hovers them', () => {
    const config = createSceneConfig();
    config.actionZones = [{
      id: 'zone-1',
      x: 250,
      y: 200,
      w: 120,
      h: 100,
      visibleInPlay: true,
    }];
    const group = new THREE.Group();

    syncStaticSceneEntities(group, config, { playMode: true });

    const hoverVisuals = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dActionZoneHoverHighlight) hoverVisuals.push(object);
    });
    expect(hoverVisuals.length).toBeGreaterThan(0);
    expect(hoverVisuals.every((object) => object.visible === false)).toBe(true);

    expect(updateActionZoneHoverHighlight(group, 'zone-1')).toBe(true);
    expect(hoverVisuals.every((object) => object.visible === true)).toBe(true);

    expect(updateActionZoneHoverHighlight(group, '')).toBe(true);
    expect(hoverVisuals.every((object) => object.visible === false)).toBe(true);
  });

  it('keeps studio GLB textures attached when the model has no embedded maps', () => {
    const config = createSceneConfig();
    config.props = [{
      id: 'house-1',
      decorModel3dId: 'decor-house',
      decorModelUrl: 'house.glb',
      x: 250,
      y: 200,
      w: 120,
      h: 120,
      modelHeight: 100,
      renderMode: 'glb',
    }];
    const group = new THREE.Group();
    const template = createModelTemplate();
    const studioTexture = new THREE.Texture();
    const getTexture = vi.fn((src) => (src ? studioTexture : null));
    const getModel = vi.fn(() => template);
    getModel.getStatus = vi.fn(() => 'loaded');

    syncStaticSceneEntities(group, config, {
      getTexture,
      getModel,
      studioDecorTextureById: new Map([['decor-house', {
        imageData: 'data:image/png;base64,preview',
        imageName: 'preview.png',
      }]]),
    });

    const root = group.children.find((child) => child.userData?.entityId === 'house-1');
    const mesh = root.getObjectByProperty('isMesh', true);
    expect(getTexture).toHaveBeenCalledWith('data:image/png;base64,preview', false);
    expect(mesh.material.map).toBe(studioTexture);
  });

  it('keeps embedded GLB texture maps instead of overriding them with prop image data', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const embeddedTexture = new THREE.Texture();
    const overrideTexture = new THREE.Texture();
    const template = new THREE.Group();
    template.userData.modelFormat = 'glb';
    template.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff', map: embeddedTexture }),
    ));

    addProp(
      group,
      config,
      {
        id: 'house-1',
        x: 250,
        y: 200,
        w: 120,
        h: 120,
        modelHeight: 100,
        renderMode: 'glb',
        decorModelUrl: 'house.glb',
        imageData: 'data:image/png;base64,texture',
      },
      DEFAULT_ENGINE,
      false,
      (src) => (src ? overrideTexture : null),
      () => template,
    );

    const root = group.children.find((child) => child.userData?.entityId === 'house-1');
    const mesh = root.getObjectByProperty('isMesh', true);
    expect(mesh.material.map).toBe(embeddedTexture);
  });

  it('keeps GLB material brightness out of the static rebuild signature', () => {
    const config = createSceneConfig();
    config.props = [{
      id: 'statue-1',
      x: 250,
      y: 200,
      w: 120,
      h: 120,
      decorModelUrl: 'statue.glb',
      materialBrightness: 0.55,
    }];
    const signature = getStaticSceneSignature(config);

    config.props[0].materialBrightness = 1.2;

    expect(getStaticSceneSignature(config)).toBe(signature);
  });

  it('focuses the sun shadow camera around the active viewport target', () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight('#ffffff', 1);
    scene.add(sun);
    scene.add(sun.target);
    scene.userData.sun = sun;

    updateSceneLighting(scene, DEFAULT_ENGINE, {
      shadowTarget: new THREE.Vector3(4, 1, -3),
      shadowExtent: 12,
    });

    expect(sun.target.position).toEqual(new THREE.Vector3(4, 1, -3));
    expect(sun.shadow.camera.left).toBe(-12);
    expect(sun.shadow.camera.right).toBe(12);
    expect(sun.shadow.camera.top).toBe(12);
    expect(sun.shadow.camera.bottom).toBe(-12);
    expect(sun.shadow.needsUpdate).toBe(true);
  });

  it('renders image props as real shadow-casting meshes', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const texture = new THREE.Texture();
    const prop = {
      id: 'poster-1',
      x: 250,
      y: 200,
      w: 100,
      h: 80,
      modelHeight: 80,
      imageData: 'data:image/png;base64,prop',
    };

    addProp(group, config, prop, DEFAULT_ENGINE, false, () => texture, () => null);

    const root = group.children.find((child) => child.userData?.entityId === 'poster-1');
    const imageMesh = root.getObjectByProperty('isMesh', true);

    expect(imageMesh).toBeTruthy();
    expect(imageMesh.isSprite).not.toBe(true);
    expect(imageMesh.castShadow).toBe(true);
    expect(imageMesh.receiveShadow).toBe(true);
    expect(imageMesh.material.map).toBe(texture);
    expect(imageMesh.material.alphaTest).toBeGreaterThan(0);
  });

  it('updates prop movement, rotation and resize without rebuilding the root object', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const prop = {
      id: 'crate-1',
      x: 250,
      y: 200,
      w: 100,
      h: 80,
      modelHeight: 60,
      renderMode: 'box',
    };
    config.props = [prop];
    addProp(group, config, prop, DEFAULT_ENGINE, false, () => null, () => null);
    const root = group.children[0];
    const staticSignature = getStaticSceneSignature(config);
    const transformSignature = getStaticSceneTransformSignature(config);

    Object.assign(config.props[0], {
      x: 300,
      y: 240,
      rotation: 45,
      w: 200,
      h: 160,
      modelHeight: 120,
    });

    expect(getStaticSceneSignature(config)).toBe(staticSignature);
    expect(getStaticSceneTransformSignature(config)).not.toBe(transformSignature);
    expect(updateStaticEntityTransforms(group, config)).toBe(true);
    expect(group.children[0]).toBe(root);
    expect(root.position).toEqual(toScenePosition(config, 300, 240, 0));
    expect(root.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(root.scale.x).toBeCloseTo(2);
    expect(root.scale.y).toBeCloseTo(2);
    expect(root.scale.z).toBeCloseTo(2);
  });

  it('adds duplicated static props without rebuilding existing roots', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    config.props = [{
      id: 'crate-1',
      x: 250,
      y: 200,
      w: 100,
      h: 80,
      modelHeight: 60,
      renderMode: 'box',
    }];

    expect(syncStaticSceneEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(true);
    const originalRoot = group.children.find((child) => child.userData?.entityId === 'crate-1');
    const signature = getStaticSceneSignature(config);

    config.props.push({
      ...config.props[0],
      id: 'crate-2',
      x: 320,
      y: 240,
    });

    expect(getStaticSceneSignature(config)).not.toBe(signature);
    expect(syncStaticSceneEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(true);
    expect(group.children.find((child) => child.userData?.entityId === 'crate-1')).toBe(originalRoot);
    expect(group.children.some((child) => child.userData?.entityId === 'crate-2')).toBe(true);
  });

  it('applies model eraser strokes without rebuilding the GLB root', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const template = createModelTemplate();
    const getModel = () => template;
    config.props = [{
      id: 'statue-1',
      x: 250,
      y: 200,
      w: 100,
      h: 100,
      modelHeight: 60,
      decorModelUrl: 'statue.glb',
    }];

    expect(syncStaticSceneEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);
    const root = group.children.find((child) => child.userData?.entityId === 'statue-1');
    const mesh = root.getObjectByProperty('isMesh', true);
    const initialIndexCount = mesh.geometry.index.count;
    const staticSignature = getStaticSceneSignature(config);
    const eraserSignature = getStaticModelEraserSignature(config);

    config.props[0].modelEraserStrokes = [{
      id: 'erase-1',
      surfaceIndex: 0,
      materialIndex: 0,
      localMeshX: 0.5,
      localMeshY: 0,
      localMeshZ: 0,
      radius: 20,
    }];

    expect(getStaticSceneSignature(config)).toBe(staticSignature);
    expect(getStaticModelEraserSignature(config)).not.toBe(eraserSignature);
    expect(syncStaticModelErasers(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);
    expect(group.children.find((child) => child.userData?.entityId === 'statue-1')).toBe(root);
    expect(mesh.geometry.index.count).toBeLessThan(initialIndexCount);
  });

  it('adds placed characters without rebuilding existing dynamic roots', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    config.heroes = [{
      id: 'hero-1',
      x: 250,
      y: 200,
      z: 0,
      rotation: 0,
      character: 'runner',
      characterRenderMode: 'capsule',
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(true);
    const originalRoot = group.children.find((child) => child.userData?.entityId === 'hero-1');

    config.enemies.push({
      id: 'enemy-1',
      x: 320,
      y: 240,
      z: 0,
      rotation: 0,
      role: 'rifle',
      character: 'guard',
      characterRenderMode: 'capsule',
    });

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(true);
    expect(group.children.find((child) => child.userData?.entityId === 'hero-1')).toBe(originalRoot);
    expect(group.children.some((child) => child.userData?.entityId === 'enemy-1')).toBe(true);
  });

  it('adds a real shadow caster for sprite actors', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const texture = new THREE.Texture();

    addActor(group, config, {
      id: 'hero-1',
      x: 250,
      y: 200,
      character: 'runner',
      characterRenderMode: 'sprite',
      characterImageData: 'data:image/png;base64,hero',
    }, {
      type: 'hero',
      id: 'hero-1',
      radius: 18,
      preset: { body: '#ffffff', accent: '#67e8f9', weapon: '#f8fafc' },
      selected: false,
      active: false,
      imageData: 'data:image/png;base64,hero',
      renderMode: 'sprite',
      modelScale: 1,
      getTexture: () => texture,
      getModel: () => null,
    });

    const root = group.children.find((child) => child.userData?.entityId === 'hero-1');
    const visualSprite = root.children.find((child) => child.isSprite);
    const shadowCaster = root.children.find((child) => child.userData?.rpg3dImageShadowCaster);

    expect(visualSprite).toBeTruthy();
    expect(shadowCaster).toBeTruthy();
    expect(shadowCaster.parent).toBe(root);
    expect(shadowCaster.isMesh).toBe(true);
    expect(shadowCaster.castShadow).toBe(true);
    expect(shadowCaster.material.map).toBe(texture);
    expect(shadowCaster.material.alphaTest).toBeGreaterThan(0);
    expect(shadowCaster.material.colorWrite).toBe(false);
  });

  it('attaches equipped weapons and shields to separate rig sockets', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const rightHand = new THREE.Bone();
    const leftForearm = new THREE.Bone();
    rightHand.name = 'RightHand';
    leftForearm.name = 'LeftForeArm';
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);
    characterTemplate.add(leftForearm);
    const weaponTemplate = createModelTemplate();
    const shieldTemplate = createModelTemplate();
    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
      if (source === 'shield.glb') return shieldTemplate;
      return null;
    });
    getModel.getStatus = vi.fn(() => 'loaded');

    config.heroes = [{
      id: 'hero-1',
      x: 250,
      y: 200,
      character: 'runner',
      characterRenderMode: 'glb',
      characterModelUrl: 'hero.glb',
      inventory: [
        {
          id: 'weapon-1',
          type: 'weapon',
          equipped: true,
          weaponModelUrl: 'sword.glb',
          weaponModelScale: 1,
        },
        {
          id: 'shield-1',
          type: 'shield',
          equipped: true,
          weaponModelUrl: 'shield.glb',
          weaponModelScale: 1,
        },
      ],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    const equippedShield = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
      if (object.userData?.rpg3dEquippedShield) equippedShield.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    expect(equippedShield).toHaveLength(1);
    expect(equippedWeapon[0].parent.name).toBe('RightHand');
    expect(equippedShield[0].parent.name).toBe('LeftForeArm');
  });

  it('updates placed character transform, resize and map light without rebuilding the root object', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    config.heroes = [{
      id: 'hero-1',
      x: 250,
      y: 200,
      z: 0,
      rotation: 0,
      character: 'runner',
      characterRenderMode: 'capsule',
      characterModelScale: 1,
      characterModelScaleX: 1,
      characterModelScaleY: 1,
      characterModelScaleZ: 1,
      characterMaterialBrightness: 1,
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(true);
    const root = group.children.find((child) => child.userData?.entityId === 'hero-1');
    const managedMesh = root.children.find((child) => child.isMesh && child.material?.userData?.rpg3dActorAppearanceManaged);
    const initialRed = managedMesh.material.color.r;

    Object.assign(config.heroes[0], {
      x: 300,
      y: 240,
      z: 20,
      rotation: 90,
      characterModelScale: 1.5,
      characterModelScaleX: 1.5,
      characterModelScaleY: 1.5,
      characterModelScaleZ: 1.5,
      characterMaterialBrightness: 0.5,
    });

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel: () => null,
    })).toBe(false);
    expect(group.children.find((child) => child.userData?.entityId === 'hero-1')).toBe(root);
    expect(root.position).toEqual(toScenePosition(config, 300, 240, 20 * WORLD_SCALE));
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(root.scale.x).toBeCloseTo(1.5);
    expect(root.scale.y).toBeCloseTo(1.5);
    expect(root.scale.z).toBeCloseTo(1.5);
    expect(managedMesh.material.color.r).toBeLessThan(initialRed);
  });

  it('moves the controlled hero root from runtime player state in play mode', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    config.player = {
      ...config.player,
      x: 120,
      y: 140,
      character: 'runner',
      characterRenderMode: 'capsule',
    };
    config.heroes = [{
      id: 'hero-1',
      x: 250,
      y: 200,
      z: 0,
      rotation: 0,
      character: 'runner',
      characterRenderMode: 'capsule',
    }];
    config.enemies = [];
    config.pickups = [];
    const state = {
      time: 1,
      player: {
        ...config.player,
        ...config.heroes[0],
        controlledHeroId: 'hero-1',
        x: 300,
        y: 240,
        vx: 120,
        vy: 0,
      },
      enemies: [],
      pickups: [],
      bullets: [],
      particles: [],
    };

    addActor(group, config, state.player, {
      type: 'hero',
      id: 'hero-1',
      radius: 18,
      preset: { body: '#ffffff', accent: '#67e8f9', weapon: '#f8fafc' },
      selected: false,
      active: false,
      imageData: '',
      renderMode: 'capsule',
      modelScale: 1,
      getTexture: () => null,
      getModel: () => null,
    });
    const root = group.children.find((child) => child.userData?.entityType === 'hero' && child.userData?.entityId === 'hero-1');

    state.player.x = 360;
    state.player.y = 260;
    updateDynamicTransforms(group, config, state, { playMode: true });

    expect(root.position).toEqual(toScenePosition(config, 360, 260, 0));
  });
});
