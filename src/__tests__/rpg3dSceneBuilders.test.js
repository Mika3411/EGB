import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DEFAULT_ENGINE,
  WORLD_SCALE,
  addProp,
  addActor,
  addEquippedArmorToActorModel,
  addStaticSelectionOverlays,
  getStaticModelEraserSignature,
  getStaticSceneSignature,
  getStaticSceneTransformSignature,
  syncEditableDynamicEntities,
  syncStaticModelErasers,
  syncStaticSceneEntities,
  findArmorArmSocket,
  toScenePosition,
  updateActionZoneHoverHighlight,
  updateDynamicTransforms,
  updateFingerTipsWeaponSockets,
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

const createTranslatedBoxGeometry = (width, height, depth, x, y, z) => {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
};

const addSingleBoneSkinAttributes = (geometry) => {
  const vertexCount = geometry.attributes.position.count;
  const skinIndices = [];
  const skinWeights = [];
  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices.push(0, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  return geometry;
};

const createArmorSocketCharacterTemplate = () => {
  const characterTemplate = new THREE.Group();
  const hips = new THREE.Bone();
  const leftArm = new THREE.Bone();
  const rightArm = new THREE.Bone();
  const leftForeArm = new THREE.Bone();
  const rightForeArm = new THREE.Bone();
  hips.name = 'Hips';
  leftArm.name = 'LeftArm';
  rightArm.name = 'RightArm';
  leftForeArm.name = 'LeftForeArm';
  rightForeArm.name = 'RightForeArm';
  leftArm.position.set(-0.45, 1.1, 0);
  rightArm.position.set(0.45, 1.1, 0);
  leftForeArm.position.set(-0.2, -0.5, 0);
  rightForeArm.position.set(0.2, -0.5, 0);
  leftArm.add(leftForeArm);
  rightArm.add(rightForeArm);
  hips.add(leftArm);
  hips.add(rightArm);
  characterTemplate.userData.modelFormat = 'glb';
  characterTemplate.add(new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2, 0.45),
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  ));
  characterTemplate.add(hips);
  return characterTemplate;
};

const createSingleMeshChestplateTemplate = (armOffset = 0.42) => {
  const armorTemplate = new THREE.Group();
  armorTemplate.userData.modelFormat = 'glb';
  const chestplateGeometry = mergeGeometries([
    createTranslatedBoxGeometry(0.72, 1.1, 0.18, 0, 0, 0),
    createTranslatedBoxGeometry(0.16, 0.52, 0.16, -armOffset, 0.3, 0),
    createTranslatedBoxGeometry(0.16, 0.52, 0.16, armOffset, 0.3, 0),
  ], false);
  armorTemplate.add(new THREE.Mesh(
    chestplateGeometry,
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  ));
  return armorTemplate;
};

const collectEquippedArmorByRole = (root) => {
  const armorByRole = new Map();
  root.traverse((object) => {
    if (object.userData?.rpg3dEquippedArmor) {
      armorByRole.set(object.userData.rpg3dEquipmentRole, object);
    }
  });
  return armorByRole;
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
      new THREE.BoxGeometry(1, 200, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);
    characterTemplate.add(leftForearm);
    const weaponTemplate = createModelTemplate();
    const weaponGrip = new THREE.Group();
    weaponGrip.name = 'weapon_grip';
    weaponGrip.position.set(0.5, 0, 0);
    weaponTemplate.add(weaponGrip);
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
    expect(equippedWeapon[0].name).toBe('Rpg3DWeaponAttachment');
    expect(equippedWeapon[0].userData.rpg3dEquipmentGripSocket).toBe('weapon_grip');
    expect(equippedWeapon[0].children[0].position.x).toBeCloseTo(-0.5);
    expect(equippedShield[0].parent.name).toBe('LeftForeArm');
  });

  it('attaches equipped helmets to the head bone with object scale and base orientation', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const head = new THREE.Bone();
    head.name = 'Head';
    head.position.set(0, 1.55, 0);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 0.5),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(head);

    const helmetTemplate = new THREE.Group();
    helmetTemplate.userData.modelFormat = 'glb';
    helmetTemplate.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'helmet.glb') return helmetTemplate;
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
          id: 'helmet-1',
          type: 'helmet',
          equipped: true,
          weaponModelUrl: 'helmet.glb',
          weaponModelScale: 1.4,
          weaponModelRotationY: 45,
        },
      ],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedHelmet = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedHelmet) equippedHelmet.push(object);
    });

    expect(equippedHelmet).toHaveLength(1);
    expect(equippedHelmet[0].parent.name).toBe('Head');
    expect(equippedHelmet[0].name).toBe('Rpg3DHelmetAttachment');
    const childScale = equippedHelmet[0].children[0].scale;
    expect(Math.max(childScale.x, childScale.y, childScale.z)).toBeCloseTo(1.4, 3);
    const expectedBaseRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(45), 0));
    expect(equippedHelmet[0].children[0].quaternion.angleTo(expectedBaseRotation)).toBeLessThan(0.001);
  });

  it('uses a virtual grip on long weapons without named grip nodes', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const rightHand = new THREE.Bone();
    rightHand.name = 'RightHand';
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);

    const weaponTemplate = new THREE.Group();
    weaponTemplate.userData.modelFormat = 'glb';
    weaponTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
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
      inventory: [{
        id: 'weapon-1',
        type: 'weapon',
        equipped: true,
        weaponModelUrl: 'sword.glb',
        weaponModelScale: 1,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    expect(equippedWeapon[0].name).toBe('Rpg3DWeaponAttachment');
    expect(equippedWeapon[0].userData.rpg3dEquipmentGripSocket).toBe('auto-blade-base');
    expect(equippedWeapon[0].children[0].position.y).toBeGreaterThan(0.3);
    expect(equippedWeapon[0].rotation.z).toBeCloseTo(Math.PI);
    const worldBox = new THREE.Box3().setFromObject(equippedWeapon[0]);
    const worldSize = worldBox.getSize(new THREE.Vector3());
    expect(Math.max(worldSize.x, worldSize.y, worldSize.z)).toBeGreaterThan(0.8);
  });

  it('uses inventory grip settings for left-hand weapons', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const leftHand = new THREE.Bone();
    leftHand.name = 'LeftHand';
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(leftHand);

    const weaponTemplate = new THREE.Group();
    weaponTemplate.userData.modelFormat = 'glb';
    weaponTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.2, 0.05),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
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
      inventory: [{
        id: 'weapon-1',
        type: 'weapon',
        equipped: true,
        weaponModelUrl: 'sword.glb',
        weaponModelScale: 1,
        weaponGripHand: 'left',
        weaponGripLeftEnabled: true,
        weaponGripLeftY: -0.25,
        weaponGripLeftRotationZ: 90,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    expect(equippedWeapon[0].parent.name).toBe('LeftHand');
    expect(equippedWeapon[0].userData.rpg3dEquipmentGripSocket).toBe('manual-left-hand');
    expect(equippedWeapon[0].rotation.z).toBeCloseTo(Math.PI / 2);
    expect(equippedWeapon[0].children[0].position.y).toBeCloseTo(0.25);
  });

  it('applies inventory model orientation before aligning equipment grip points', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const rightHand = new THREE.Bone();
    rightHand.name = 'RightHand';
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);

    const weaponTemplate = new THREE.Group();
    weaponTemplate.userData.modelFormat = 'glb';
    weaponTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1, 0.05),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
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
      inventory: [{
        id: 'weapon-1',
        type: 'weapon',
        equipped: true,
        weaponModelUrl: 'sword.glb',
        weaponModelScale: 1,
        weaponModelRotationZ: 90,
        weaponGripHand: 'right',
        weaponGripRightEnabled: true,
        weaponGripRightX: 1,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    expect(equippedWeapon[0].children[0].position.x).toBeCloseTo(0);
    expect(equippedWeapon[0].children[0].position.y).toBeCloseTo(-1);
    expect(equippedWeapon[0].children[0].rotation.z).toBeCloseTo(Math.PI / 2);
  });

  it('aligns shield grip points to the hand-elbow arm line', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const leftForearm = new THREE.Bone();
    const leftHand = new THREE.Bone();
    leftForearm.name = 'LeftForeArm';
    leftHand.name = 'LeftHand';
    leftHand.position.set(0, 1, 0);
    leftForearm.add(leftHand);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(leftForearm);

    const shieldTemplate = new THREE.Group();
    shieldTemplate.userData.modelFormat = 'glb';
    shieldTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1, 0.08),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
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
      inventory: [{
        id: 'shield-1',
        type: 'shield',
        equipped: true,
        weaponModelUrl: 'shield.glb',
        weaponModelScale: 1,
        shieldGripArm: 'left',
        shieldGripReferenceScale: 1,
        shieldGripHandEnabled: true,
        shieldGripHandY: -0.4,
        shieldGripElbowEnabled: true,
        shieldGripElbowY: 0.4,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedShield = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedShield) equippedShield.push(object);
    });

    expect(equippedShield).toHaveLength(1);
    expect(equippedShield[0].parent.name).toBe('Rpg3DLeftShieldArmLineSocket');
    expect(equippedShield[0].userData.rpg3dEquipmentGripSocket).toBe('manual-shield-arm-line');

    const equipment = equippedShield[0].children[0];
    const getShieldLine = () => {
      equipment.updateMatrixWorld(true);
      const handPoint = equipment.localToWorld(new THREE.Vector3(0, -0.4, 0));
      const elbowPoint = equipment.localToWorld(new THREE.Vector3(0, 0.4, 0));
      return handPoint.sub(elbowPoint).normalize();
    };
    const getArmLine = () => {
      const socket = equippedShield[0].parent;
      socket.rpg3dShieldHandBone.updateMatrixWorld(true);
      socket.rpg3dShieldElbowBone.updateMatrixWorld(true);
      return socket.rpg3dShieldHandBone.getWorldPosition(new THREE.Vector3())
        .sub(socket.rpg3dShieldElbowBone.getWorldPosition(new THREE.Vector3()))
        .normalize();
    };

    expect(Math.abs(getShieldLine().dot(getArmLine()))).toBeCloseTo(1);
    equippedShield[0].parent.rpg3dShieldHandBone.position.x = 0.6;
    updateFingerTipsWeaponSockets(group);
    expect(Math.abs(getShieldLine().dot(getArmLine()))).toBeCloseTo(1);
  });

  it('aligns armor grip points to shoulders, elbows and lower belly bones', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const hips = new THREE.Bone();
    const leftArm = new THREE.Bone();
    const rightArm = new THREE.Bone();
    const leftForeArm = new THREE.Bone();
    const rightForeArm = new THREE.Bone();
    hips.name = 'Hips';
    leftArm.name = 'LeftArm';
    rightArm.name = 'RightArm';
    leftForeArm.name = 'LeftForeArm';
    rightForeArm.name = 'RightForeArm';
    leftArm.position.set(-0.45, 1.1, 0);
    rightArm.position.set(0.45, 1.1, 0);
    leftForeArm.position.set(-0.2, -0.5, 0);
    rightForeArm.position.set(0.2, -0.5, 0);
    leftArm.add(leftForeArm);
    rightArm.add(rightForeArm);
    hips.add(leftArm);
    hips.add(rightArm);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2, 0.45),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(hips);

    const armorTemplate = new THREE.Group();
    armorTemplate.userData.modelFormat = 'glb';
    armorTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.35, 0.22),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'armor.glb') return armorTemplate;
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
      inventory: [{
        id: 'armor-1',
        type: 'armor',
        equipped: true,
        weaponModelUrl: 'armor.glb',
        weaponModelScale: 1,
        armorGripReferenceScale: 1,
        armorGripLeftShoulderEnabled: true,
        armorGripLeftShoulderX: -0.45,
        armorGripLeftShoulderY: 0.55,
        armorGripRightShoulderEnabled: true,
        armorGripRightShoulderX: 0.45,
        armorGripRightShoulderY: 0.55,
        armorGripLeftElbowEnabled: true,
        armorGripLeftElbowX: -0.65,
        armorGripLeftElbowY: 0.05,
        armorGripRightElbowEnabled: true,
        armorGripRightElbowX: 0.65,
        armorGripRightElbowY: 0.05,
        armorGripLowerBellyEnabled: true,
        armorGripLowerBellyY: -0.55,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedArmor = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedArmor) equippedArmor.push(object);
    });

    expect(equippedArmor).toHaveLength(1);
    expect(equippedArmor[0].parent.name).toBe('Rpg3DArmorBodySocket');
    expect(equippedArmor[0].userData.rpg3dEquipmentGripSocket).toBe('manual-armor-body-frame');

    const socket = equippedArmor[0].parent;
    const equipment = equippedArmor[0].children[0];
    const getSourcePoint = (suffix) => {
      const entry = socket.rpg3dArmorGripEntries.find((item) => item.suffix === suffix);
      return entry.source.getWorldPosition(new THREE.Vector3());
    };
    const getArmorWidthAxis = () => {
      equipment.updateMatrixWorld(true);
      return equipment.localToWorld(new THREE.Vector3(0.45, 0.55, 0))
        .sub(equipment.localToWorld(new THREE.Vector3(-0.45, 0.55, 0)))
        .normalize();
    };
    const getBodyWidthAxis = () => (
      getSourcePoint('RightShoulder')
        .sub(getSourcePoint('LeftShoulder'))
        .normalize()
    );
    const getArmorUpAxis = () => {
      equipment.updateMatrixWorld(true);
      const leftShoulderPoint = equipment.localToWorld(new THREE.Vector3(-0.45, 0.55, 0));
      const rightShoulderPoint = equipment.localToWorld(new THREE.Vector3(0.45, 0.55, 0));
      const lowerBellyPoint = equipment.localToWorld(new THREE.Vector3(0, -0.55, 0));
      return leftShoulderPoint.add(rightShoulderPoint).multiplyScalar(0.5).sub(lowerBellyPoint).normalize();
    };
    const getBodyUpAxis = () => (
      getSourcePoint('LeftShoulder')
        .add(getSourcePoint('RightShoulder'))
        .multiplyScalar(0.5)
        .sub(getSourcePoint('LowerBelly'))
        .normalize()
    );

    expect(Math.abs(getArmorWidthAxis().dot(getBodyWidthAxis()))).toBeGreaterThan(0.98);
    expect(Math.abs(getArmorUpAxis().dot(getBodyUpAxis()))).toBeGreaterThan(0.99);
    const initialSocketQuaternion = socket.quaternion.clone();
    socket.rpg3dArmorGripEntries.find((entry) => entry.suffix === 'RightShoulder').source.position.z = 0.7;
    updateFingerTipsWeaponSockets(group);
    expect(socket.quaternion.angleTo(initialSocketQuaternion)).toBeGreaterThan(0.01);
    expect(Math.abs(getArmorWidthAxis().dot(getBodyWidthAxis()))).toBeGreaterThan(0.98);
    expect(Math.abs(getArmorUpAxis().dot(getBodyUpAxis()))).toBeGreaterThan(0.99);
  });

  it('attaches separated armor arm plates to shoulder-elbow lines', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const hips = new THREE.Bone();
    const leftArm = new THREE.Bone();
    const rightArm = new THREE.Bone();
    const leftForeArm = new THREE.Bone();
    const rightForeArm = new THREE.Bone();
    hips.name = 'Hips';
    leftArm.name = 'LeftArm';
    rightArm.name = 'RightArm';
    leftForeArm.name = 'LeftForeArm';
    rightForeArm.name = 'RightForeArm';
    leftArm.position.set(-0.45, 1.1, 0);
    rightArm.position.set(0.45, 1.1, 0);
    leftForeArm.position.set(-0.2, -0.5, 0);
    rightForeArm.position.set(0.2, -0.5, 0);
    leftArm.add(leftForeArm);
    rightArm.add(rightForeArm);
    hips.add(leftArm);
    hips.add(rightArm);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2, 0.45),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(hips);

    const armorTemplate = new THREE.Group();
    armorTemplate.userData.modelFormat = 'glb';
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.1, 0.18),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    chest.name = 'ChestPlate';
    const leftPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    leftPlate.name = 'LeftPauldronArm';
    leftPlate.position.set(-0.65, 0.32, 0);
    const rightPlate = leftPlate.clone();
    rightPlate.name = 'RightPauldronArm';
    rightPlate.position.set(0.65, 0.32, 0);
    armorTemplate.add(chest, leftPlate, rightPlate);

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'armor.glb') return armorTemplate;
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
      characterRigPoints: [
        { id: 'left-shoulder', enabled: true, x: 0.3, y: 0.8, z: 0.5 },
        { id: 'left-elbow', enabled: true, x: 0.2, y: 0.6, z: 0.5 },
        { id: 'right-shoulder', enabled: true, x: 0.7, y: 0.8, z: 0.5 },
        { id: 'right-elbow', enabled: true, x: 0.8, y: 0.6, z: 0.5 },
      ],
      inventory: [{
        id: 'armor-1',
        type: 'armor',
        equipped: true,
        weaponModelUrl: 'armor.glb',
        weaponModelScale: 1,
        armorGripReferenceScale: 1.58,
        armorGripLeftShoulderEnabled: true,
        armorGripLeftShoulderX: -0.45,
        armorGripLeftShoulderY: 0.55,
        armorGripRightShoulderEnabled: true,
        armorGripRightShoulderX: 0.45,
        armorGripRightShoulderY: 0.55,
        armorGripLeftElbowEnabled: true,
        armorGripLeftElbowX: -1.05,
        armorGripLeftElbowY: 0.05,
        armorGripRightElbowEnabled: true,
        armorGripRightElbowX: 0.65,
        armorGripRightElbowY: 0.05,
        armorGripLowerBellyEnabled: true,
        armorGripLowerBellyY: -0.55,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const armorByRole = new Map();
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedArmor) {
        armorByRole.set(object.userData.rpg3dEquipmentRole, object);
      }
    });

    expect(armorByRole.get('armor')?.parent.name).toBe('Rpg3DArmorBodySocket');
    expect(armorByRole.get('armor-left-arm')?.parent.name).toBe('Rpg3DLeftArmorArmSocket');
    expect(armorByRole.get('armor-right-arm')?.parent.name).toBe('Rpg3DRightArmorArmSocket');
    expect(armorByRole.get('armor-left-arm')?.userData.rpg3dEquipmentGripSocket).toBe('manual-armor-left-arm-line');
    expect(armorByRole.get('armor-right-arm')?.userData.rpg3dEquipmentGripSocket).toBe('manual-armor-right-arm-line');

    const leftSocket = armorByRole.get('armor-left-arm').parent;
    const rightSocket = armorByRole.get('armor-right-arm').parent;
    const leftEquipment = armorByRole.get('armor-left-arm').children[0];
    const getAttachedLeftShoulder = () => {
      leftEquipment.updateMatrixWorld(true);
      return leftEquipment.localToWorld(new THREE.Vector3(-0.45, 0.55, 0));
    };
    const getTargetLeftShoulder = () => {
      leftSocket.rpg3dArmorShoulderBone.updateMatrixWorld(true);
      return leftSocket.rpg3dArmorShoulderBone.getWorldPosition(new THREE.Vector3());
    };
    expect(getAttachedLeftShoulder().distanceTo(getTargetLeftShoulder())).toBeLessThan(0.0001);
    const initialLeftQuaternion = leftSocket.quaternion.clone();
    const initialRightQuaternion = rightSocket.quaternion.clone();
    leftSocket.rpg3dArmorElbowBone.position.z = 0.65;
    updateFingerTipsWeaponSockets(group);
    expect(getAttachedLeftShoulder().distanceTo(getTargetLeftShoulder())).toBeLessThan(0.0001);
    expect(leftSocket.quaternion.angleTo(initialLeftQuaternion)).toBeGreaterThan(0.01);
    expect(rightSocket.quaternion.angleTo(initialRightQuaternion)).toBeCloseTo(0);
  });

  it('canvas-cuts single-mesh chestplates into animated arm segments', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const hips = new THREE.Bone();
    const leftArm = new THREE.Bone();
    const rightArm = new THREE.Bone();
    const leftForeArm = new THREE.Bone();
    const rightForeArm = new THREE.Bone();
    hips.name = 'Hips';
    leftArm.name = 'LeftArm';
    rightArm.name = 'RightArm';
    leftForeArm.name = 'LeftForeArm';
    rightForeArm.name = 'RightForeArm';
    leftArm.position.set(-0.45, 1.1, 0);
    rightArm.position.set(0.45, 1.1, 0);
    leftForeArm.position.set(-0.2, -0.5, 0);
    rightForeArm.position.set(0.2, -0.5, 0);
    leftArm.add(leftForeArm);
    rightArm.add(rightForeArm);
    hips.add(leftArm);
    hips.add(rightArm);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2, 0.45),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(hips);

    const armorTemplate = new THREE.Group();
    armorTemplate.userData.modelFormat = 'glb';
    const chestplateGeometry = mergeGeometries([
      createTranslatedBoxGeometry(0.72, 1.1, 0.18, 0, 0, 0),
      createTranslatedBoxGeometry(0.1, 0.52, 0.16, -0.35, 0.3, 0),
      createTranslatedBoxGeometry(0.1, 0.52, 0.16, 0.35, 0.3, 0),
    ], false);
    armorTemplate.add(new THREE.Mesh(
      chestplateGeometry,
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'armor.glb') return armorTemplate;
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
      inventory: [{
        id: 'armor-1',
        type: 'armor',
        equipped: true,
        weaponModelUrl: 'armor.glb',
        weaponModelScale: 1,
        armorGripReferenceScale: 1,
        armorCanvasCutEnabled: true,
        armorGripLeftShoulderEnabled: true,
        armorGripLeftShoulderX: -0.45,
        armorGripLeftShoulderY: 0.55,
        armorGripRightShoulderEnabled: true,
        armorGripRightShoulderX: 0.45,
        armorGripRightShoulderY: 0.55,
        armorGripLeftElbowEnabled: true,
        armorGripLeftElbowX: -0.65,
        armorGripLeftElbowY: 0.05,
        armorGripRightElbowEnabled: true,
        armorGripRightElbowX: 0.65,
        armorGripRightElbowY: 0.05,
        armorGripLowerBellyEnabled: true,
        armorGripLowerBellyY: -0.55,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const armorByRole = new Map();
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedArmor) {
        armorByRole.set(object.userData.rpg3dEquipmentRole, object);
      }
    });

    expect(armorByRole.get('armor')?.parent.name).toBe('Rpg3DArmorBodySocket');
    expect(armorByRole.get('armor-left-arm')?.parent.name).toBe('Rpg3DLeftArmorArmSocket');
    expect(armorByRole.get('armor-right-arm')?.parent.name).toBe('Rpg3DRightArmorArmSocket');

    const leftSocket = armorByRole.get('armor-left-arm').parent;
    const initialLeftQuaternion = leftSocket.quaternion.clone();
    leftSocket.rpg3dArmorElbowBone.position.z = 0.55;
    updateFingerTipsWeaponSockets(group);
    expect(leftSocket.quaternion.angleTo(initialLeftQuaternion)).toBeGreaterThan(0.01);
  });

  it('keeps canvas-cut arm sockets enabled for legacy armor items', () => {
    const characterTemplate = createArmorSocketCharacterTemplate();
    const armorTemplate = createSingleMeshChestplateTemplate();
    const armorItem = {
      id: 'armor-1',
      type: 'armor',
      equipped: true,
      weaponModelScale: 1,
      armorGripReferenceScale: 1,
      armorCanvasCutEnabled: true,
      armorGripLeftShoulderEnabled: false,
      armorGripRightShoulderEnabled: false,
      armorGripLeftElbowEnabled: false,
      armorGripRightElbowEnabled: false,
      armorGripLowerBellyEnabled: false,
    };

    expect(addEquippedArmorToActorModel(characterTemplate, armorTemplate, armorItem, {})).toBe(true);

    const armorByRole = collectEquippedArmorByRole(characterTemplate);
    expect(armorByRole.get('armor')?.parent.name).toBe('Rpg3DArmorBodySocket');
    expect(armorByRole.get('armor-left-arm')?.parent.name).toBe('Rpg3DLeftArmorArmSocket');
    expect(armorByRole.get('armor-right-arm')?.parent.name).toBe('Rpg3DRightArmorArmSocket');
  });

  it('falls back to the actual mesh scale when canvas-cut armor reference scale is too large', () => {
    const characterTemplate = createArmorSocketCharacterTemplate();
    const armorTemplate = createSingleMeshChestplateTemplate(0.54);
    const armorItem = {
      id: 'armor-1',
      type: 'armor',
      equipped: true,
      weaponModelScale: 8,
      armorGripReferenceScale: 8,
      armorCanvasCutEnabled: true,
      armorGripLeftShoulderEnabled: true,
      armorGripLeftShoulderX: -0.45,
      armorGripLeftShoulderY: 0.55,
      armorGripRightShoulderEnabled: true,
      armorGripRightShoulderX: 0.45,
      armorGripRightShoulderY: 0.55,
      armorGripLeftElbowEnabled: true,
      armorGripLeftElbowX: -0.65,
      armorGripLeftElbowY: 0.05,
      armorGripRightElbowEnabled: true,
      armorGripRightElbowX: 0.65,
      armorGripRightElbowY: 0.05,
      armorGripLowerBellyEnabled: true,
      armorGripLowerBellyY: -0.55,
    };

    expect(addEquippedArmorToActorModel(characterTemplate, armorTemplate, armorItem, {})).toBe(true);

    const armorByRole = collectEquippedArmorByRole(characterTemplate);
    expect(armorByRole.get('armor-left-arm')?.parent.name).toBe('Rpg3DLeftArmorArmSocket');
    expect(armorByRole.get('armor-right-arm')?.parent.name).toBe('Rpg3DRightArmorArmSocket');
  });

  it('canvas-cuts skinned single-mesh chestplates into static arm attachments', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const hips = new THREE.Bone();
    const leftArm = new THREE.Bone();
    const rightArm = new THREE.Bone();
    const leftForeArm = new THREE.Bone();
    const rightForeArm = new THREE.Bone();
    hips.name = 'Hips';
    leftArm.name = 'LeftArm';
    rightArm.name = 'RightArm';
    leftForeArm.name = 'LeftForeArm';
    rightForeArm.name = 'RightForeArm';
    leftArm.position.set(-0.45, 1.1, 0);
    rightArm.position.set(0.45, 1.1, 0);
    leftForeArm.position.set(-0.2, -0.5, 0);
    rightForeArm.position.set(0.2, -0.5, 0);
    leftArm.add(leftForeArm);
    rightArm.add(rightForeArm);
    hips.add(leftArm);
    hips.add(rightArm);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2, 0.45),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(hips);

    const armorTemplate = new THREE.Group();
    armorTemplate.userData.modelFormat = 'glb';
    const armorRootBone = new THREE.Bone();
    armorRootBone.name = 'ArmorRoot';
    const chestplateGeometry = addSingleBoneSkinAttributes(mergeGeometries([
      createTranslatedBoxGeometry(0.72, 1.1, 0.18, 0, 0, 0),
      createTranslatedBoxGeometry(0.1, 0.52, 0.16, -0.35, 0.3, 0),
      createTranslatedBoxGeometry(0.1, 0.52, 0.16, 0.35, 0.3, 0),
    ], false));
    const chestplate = new THREE.SkinnedMesh(
      chestplateGeometry,
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    chestplate.add(armorRootBone);
    chestplate.bind(new THREE.Skeleton([armorRootBone]));
    armorTemplate.add(chestplate);

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'armor.glb') return armorTemplate;
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
      inventory: [{
        id: 'armor-1',
        type: 'armor',
        equipped: true,
        weaponModelUrl: 'armor.glb',
        weaponModelScale: 1,
        armorGripReferenceScale: 1,
        armorCanvasCutEnabled: true,
        armorGripLeftShoulderEnabled: true,
        armorGripLeftShoulderX: -0.45,
        armorGripLeftShoulderY: 0.55,
        armorGripRightShoulderEnabled: true,
        armorGripRightShoulderX: 0.45,
        armorGripRightShoulderY: 0.55,
        armorGripLeftElbowEnabled: true,
        armorGripLeftElbowX: -0.65,
        armorGripLeftElbowY: 0.05,
        armorGripRightElbowEnabled: true,
        armorGripRightElbowX: 0.65,
        armorGripRightElbowY: 0.05,
        armorGripLowerBellyEnabled: true,
        armorGripLowerBellyY: -0.55,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const armorByRole = new Map();
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedArmor) {
        armorByRole.set(object.userData.rpg3dEquipmentRole, object);
      }
    });

    expect(armorByRole.get('armor-left-arm')?.parent.name).toBe('Rpg3DLeftArmorArmSocket');
    expect(armorByRole.get('armor-right-arm')?.parent.name).toBe('Rpg3DRightArmorArmSocket');
    expect(armorByRole.get('armor-left-arm').children[0].children.some((child) => child.isSkinnedMesh)).toBe(false);
  });

  it('uses AccuRig lower arm bones instead of upper-arm twist bones for armor sockets', () => {
    const characterTemplate = new THREE.Group();
    const leftUpperArm = new THREE.Bone();
    const leftLowerArm = new THREE.Bone();
    const leftUpperArmTwist = new THREE.Bone();
    const rightUpperArm = new THREE.Bone();
    const rightUpperArmTwist = new THREE.Bone();
    const rightLowerArm = new THREE.Bone();
    leftUpperArm.name = 'upperarm_l';
    leftLowerArm.name = 'lowerarm_l';
    leftUpperArmTwist.name = 'cc_base_l_upperarmtwist01';
    rightUpperArm.name = 'upperarm_r';
    rightUpperArmTwist.name = 'cc_base_r_upperarmtwist01';
    rightLowerArm.name = 'lowerarm_r';
    leftUpperArm.position.set(-0.45, 1.1, 0);
    rightUpperArm.position.set(0.45, 1.1, 0);
    leftLowerArm.position.set(-0.18, -0.58, 0);
    rightLowerArm.position.set(0.18, -0.58, 0);
    leftUpperArmTwist.position.set(-0.05, -0.2, 0);
    rightUpperArmTwist.position.set(0.05, -0.2, 0);
    leftUpperArm.add(leftLowerArm);
    leftUpperArm.add(leftUpperArmTwist);
    rightUpperArm.add(rightUpperArmTwist);
    rightUpperArm.add(rightLowerArm);
    characterTemplate.add(leftUpperArm);
    characterTemplate.add(rightUpperArm);

    const armorItem = {
      armorGripLeftShoulderEnabled: true,
      armorGripLeftElbowEnabled: true,
      armorGripRightShoulderEnabled: true,
      armorGripRightElbowEnabled: true,
    };
    const leftSocket = findArmorArmSocket(characterTemplate, armorItem, 'left');
    const rightSocket = findArmorArmSocket(characterTemplate, armorItem, 'right');

    expect(leftSocket.rpg3dArmorShoulderBone.name).toBe('upperarm_l');
    expect(leftSocket.rpg3dArmorElbowBone.name).toBe('lowerarm_l');
    expect(rightSocket.rpg3dArmorShoulderBone.name).toBe('upperarm_r');
    expect(rightSocket.rpg3dArmorElbowBone.name).toBe('lowerarm_r');
  });

  it('preserves inventory model rotation while aligning armor grip frame', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const hips = new THREE.Bone();
    const leftArm = new THREE.Bone();
    const rightArm = new THREE.Bone();
    hips.name = 'Hips';
    leftArm.name = 'LeftArm';
    rightArm.name = 'RightArm';
    leftArm.position.set(-0.5, 1, 0);
    rightArm.position.set(0.5, 1, 0);
    hips.add(leftArm);
    hips.add(rightArm);
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2, 0.45),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(hips);

    const armorTemplate = new THREE.Group();
    armorTemplate.userData.modelFormat = 'glb';
    armorTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'armor.glb') return armorTemplate;
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
      inventory: [{
        id: 'armor-1',
        type: 'armor',
        equipped: true,
        weaponModelUrl: 'armor.glb',
        weaponModelScale: 1,
        weaponModelRotationZ: 90,
        armorGripReferenceScale: 1,
        armorGripLeftShoulderEnabled: true,
        armorGripLeftShoulderX: -0.5,
        armorGripRightShoulderEnabled: true,
        armorGripRightShoulderX: 0.5,
        armorGripLowerBellyEnabled: true,
        armorGripLowerBellyY: -1,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedArmor = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedArmor) equippedArmor.push(object);
    });

    expect(equippedArmor).toHaveLength(1);
    const equipment = equippedArmor[0].children[0];
    const expectedRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    expect(equipment.quaternion.angleTo(expectedRotation)).toBeCloseTo(0);
  });

  it('attaches weapons to a socket driven by first phalanx bones, including the thumb', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const rightHand = new THREE.Bone();
    rightHand.name = 'RightHand';
    ['Thumb', 'Index', 'Middle', 'Ring'].forEach((fingerName, index) => {
      const firstPhalanx = new THREE.Bone();
      const secondPhalanx = new THREE.Bone();
      const thirdPhalanx = new THREE.Bone();
      firstPhalanx.name = `${fingerName}1`;
      secondPhalanx.name = `${fingerName}2`;
      thirdPhalanx.name = `${fingerName}3`;
      firstPhalanx.position.set((index - 1.5) * 0.08, 0.22, fingerName === 'Thumb' ? 0.1 : 0.04);
      secondPhalanx.position.set(0, 0.18, 0.01);
      thirdPhalanx.position.set(0, 0.16, 0.01);
      secondPhalanx.add(thirdPhalanx);
      firstPhalanx.add(secondPhalanx);
      rightHand.add(firstPhalanx);
    });
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);

    const weaponTemplate = new THREE.Group();
    weaponTemplate.userData.modelFormat = 'glb';
    weaponTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1, 0.05),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
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
      inventory: [{
        id: 'weapon-1',
        type: 'weapon',
        equipped: true,
        weaponModelUrl: 'sword.glb',
        weaponModelScale: 1,
        weaponGripHand: 'right',
        weaponGripRightEnabled: true,
        weaponGripRightRotationZ: 180,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    const socket = equippedWeapon[0].parent;
    expect(socket.name).toBe('Rpg3DRightFingerBaseWeaponSocket');
    expect(socket.parent.name).toBe('RightHand');
    expect(socket.userData.rpg3dFingerBaseBoneNames).toEqual(['Thumb1', 'Index1', 'Middle1', 'Ring1']);

    const getGripWorldPosition = (name) => (
      socket.rpg3dFingerGripBones
        .find((bone) => bone.name === name)
        .getWorldPosition(new THREE.Vector3())
    );
    const initialFingerWidthAxis = getGripWorldPosition('Ring1')
      .sub(getGripWorldPosition('Index1'))
      .normalize();
    const initialWeaponAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(equippedWeapon[0].getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    expect(Math.abs(initialWeaponAxis.dot(initialFingerWidthAxis))).toBeCloseTo(1);

    const initialSocketQuaternion = socket.quaternion.clone();
    socket.rpg3dFingerGripBones.forEach((bone, index) => {
      bone.rotation.x = 0.8 + index * 0.2;
      bone.rotation.z = -0.4 + index * 0.15;
    });
    updateFingerTipsWeaponSockets(group);
    expect(socket.quaternion.angleTo(initialSocketQuaternion)).toBeCloseTo(0);

    const indexGrip = socket.rpg3dFingerGripBones.find((bone) => bone.name === 'Index1');
    indexGrip.position.x += 0.9;
    updateFingerTipsWeaponSockets(group);
    const expectedLocalCenter = new THREE.Vector3();
    socket.rpg3dFingerGripBones.forEach((bone) => {
      bone.updateMatrixWorld(true);
      expectedLocalCenter.add(socket.parent.worldToLocal(bone.getWorldPosition(new THREE.Vector3())));
    });
    expectedLocalCenter.multiplyScalar(1 / socket.rpg3dFingerGripBones.length);
    const wristToFingerAxis = expectedLocalCenter.clone().normalize();
    expect(socket.position.dot(wristToFingerAxis)).toBeCloseTo(expectedLocalCenter.length());
    expect(socket.position.distanceTo(expectedLocalCenter)).toBeGreaterThan(0.01);
  });

  it('scales inventory grip offsets to the equipped weapon size', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const characterTemplate = new THREE.Group();
    const rightHand = new THREE.Bone();
    rightHand.name = 'RightHand';
    characterTemplate.userData.modelFormat = 'glb';
    characterTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));
    characterTemplate.add(rightHand);

    const weaponTemplate = new THREE.Group();
    weaponTemplate.userData.modelFormat = 'glb';
    weaponTemplate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    ));

    const getModel = vi.fn((source) => {
      if (source === 'hero.glb') return characterTemplate;
      if (source === 'sword.glb') return weaponTemplate;
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
      inventory: [{
        id: 'weapon-1',
        type: 'weapon',
        equipped: true,
        weaponModelUrl: 'sword.glb',
        weaponModelScale: 1,
        weaponGripReferenceScale: 2,
        weaponGripRightEnabled: true,
        weaponGripRightY: 1.4,
        weaponGripRightRotationZ: 180,
      }],
    }];
    config.enemies = [];
    config.pickups = [];

    expect(syncEditableDynamicEntities(group, config, {
      getTexture: () => null,
      getModel,
    })).toBe(true);

    const equippedWeapon = [];
    group.traverse((object) => {
      if (object.userData?.rpg3dEquippedWeapon) equippedWeapon.push(object);
    });

    expect(equippedWeapon).toHaveLength(1);
    expect(equippedWeapon[0].parent.name).toBe('RightHand');
    expect(equippedWeapon[0].userData.rpg3dEquipmentGripSocket).toBe('manual-right-hand');
    expect(equippedWeapon[0].children[0].position.y).toBeCloseTo(-0.7);
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
