import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Box,
  Home,
  Image as ImageIcon,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Mountain,
  PanelLeftOpen,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { attachClickTargetCameraControls } from './three/clickTargetCameraControls.js';
import { makeDecor3DModel } from '../data/projectData';
import { fileToDataURL } from '../utils/fileHelpers';
import { formatBytes, optimizeCharacterGlbFile } from '../utils/glbOptimizer';
import {
  applyTextureToGltfModel,
  fitObjectToHeight,
  getGltfModelSource,
  getGltfModelSources,
  loadGltfFromSource,
  prepareGltfModel,
  snapObjectToGround,
} from '../utils/threeGltfUtils';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import HelpLabel from './forms/HelpLabel.jsx';

const KIND_OPTIONS = [
  { id: 'decor', label: 'décors', icon: Mountain, renderKind: 'decor' },
  { id: 'road', label: 'sol', icon: MapIcon, renderKind: 'road' },
  { id: 'water', label: 'eau', icon: ImageIcon, renderKind: 'water' },
  { id: 'wall', label: 'mur', icon: Box, renderKind: 'wall' },
  { id: 'house', label: 'habitions', icon: Home, renderKind: 'house' },
];

const DECOR_FIELD_HELP = {
  name: 'Nom interne de cet objet 3D. Il sert a le retrouver dans la bibliotheque et sur la carte.',
  rotationX: 'Incline le modele vers l avant ou l arriere. Utile pour coucher une image ou corriger un GLB importe.',
  rotationY: 'Tourne le modele autour de l axe vertical pour orienter sa face principale.',
  rotationZ: 'Incline le modele sur le cote pour ajuster un objet mal aligne.',
  floorTileSize: 'Largeur et profondeur de la dalle au sol. Les deux valeurs restent identiques pour garder un carre.',
  floorZeroZ: 'Hauteur de reference ou les personnages marchent sur cette dalle. Ajuste-la si le sol semble flotter ou avaler les pieds.',
  baseColor: 'Couleur principale du sol ou de l objet procedural quand aucune texture ne la remplace.',
  accentColor: 'Couleur secondaire utilisee pour les details visibles: lignes, reflets ou reperes.',
  tileTexture: 'Image appliquee comme texture de dalle. Elle remplace le rendu procedural pour ce sol.',
  glbImport: 'Charge ou remplace un modele 3D au format .glb pour cet objet.',
  glbTexture: 'Image appliquee sur le modele GLB importe, pratique pour tester une variation de materiau.',
  repeatTexture: 'Repete l image sur le modele au lieu de l etirer une seule fois.',
};

const DecorHelpLabel = ({ children, help }) => (
  <HelpLabel as="span" className="builder3d-help-label" help={help}>{children}</HelpLabel>
);

const LEGACY_KIND_MAP = {
  billboard: 'decor',
  crate: 'wall',
  rock: 'decor',
  tree: 'decor',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DEFAULT_FLOOR_ZERO_Z = 2.5;
const FLOOR_ZERO_Z_MIN = -120;
const FLOOR_ZERO_Z_MAX = 120;
const DECOR_MODEL_SCALE_MIN = 0.5;
const DECOR_MODEL_SCALE_MAX = 5;
const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
const colorValue = (value, fallback) => (isHexColor(value) ? value : fallback);
const numberValue = (value, fallback, min, max) => clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max);
const getDecorKindId = (kind = '') => LEGACY_KIND_MAP[kind] || kind || 'decor';
const getDecorKindConfig = (kind = '') => KIND_OPTIONS.find((option) => option.id === getDecorKindId(kind)) || KIND_OPTIONS[0];
const getDecorRenderKind = (kind = '') => getDecorKindConfig(kind).renderKind || getDecorKindId(kind);
const isFloorTileKind = (kind = '') => ['road', 'water'].includes(getDecorKindId(kind));
const getFloorTileSize = (model = {}) => numberValue(Math.max(Number(model.width) || 0, Number(model.depth) || 0), 2.2, 0.4, 8);
const getFloorZeroZ = (model = {}) => numberValue(model.floorZeroZ, DEFAULT_FLOOR_ZERO_Z, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
const getModelRotationX = (model = {}) => numberValue(model.modelRotationX, 0, -180, 180);
const getModelRotationY = (model = {}) => numberValue(model.modelRotationY, 0, -180, 180);
const getModelRotationZ = (model = {}) => numberValue(model.modelRotationZ, 0, -180, 180);
const applyModelRotation = (object, model = {}) => {
  object.rotation.set(
    THREE.MathUtils.degToRad(getModelRotationX(model)),
    THREE.MathUtils.degToRad(getModelRotationY(model)),
    THREE.MathUtils.degToRad(getModelRotationZ(model)),
  );
};
const centerObjectHorizontallyOnOrigin = (object) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x) || !Number.isFinite(box.min.z) || !Number.isFinite(box.max.z)) return false;
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.updateMatrixWorld(true);
  return true;
};
const alignObjectTopToGround = (object, groundY = 0.018) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (!Number.isFinite(box.max.y)) return false;
  object.position.y += groundY - box.max.y;
  object.updateMatrixWorld(true);
  return true;
};

const getKindDefaults = (kind, current = {}) => {
  const nextKind = getDecorKindId(kind);
  if (nextKind === 'road') {
    const tileSize = getFloorTileSize(current);
    return {
      kind: 'road',
      width: tileSize,
      depth: tileSize,
      height: Math.min(Number(current.height) || 0.05, 0.08),
      floorZeroZ: getFloorZeroZ(current),
      collision: false,
      repeatTexture: false,
      modelUrl: '',
      modelData: '',
      modelName: '',
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#334155' : current.baseColor,
    };
  }
  if (nextKind === 'water') {
    const tileSize = getFloorTileSize(current);
    return {
      kind: 'water',
      width: tileSize,
      depth: tileSize,
      height: Math.min(Number(current.height) || 0.05, 0.08),
      floorZeroZ: getFloorZeroZ(current),
      collision: false,
      repeatTexture: false,
      modelUrl: '',
      modelData: '',
      modelName: '',
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#2563eb' : current.baseColor,
      accentColor: current.accentColor === '#f59e0b' || !current.accentColor ? '#67e8f9' : current.accentColor,
    };
  }
  if (nextKind === 'wall') {
    return {
      kind: 'wall',
      height: Math.max(Number(current.height) || 1.2, 1.4),
      collision: true,
      repeatTexture: false,
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#475569' : current.baseColor,
    };
  }
  if (nextKind === 'house') {
    return {
      kind: 'house',
      height: Math.max(Number(current.height) || 1.2, 1.6),
      collision: true,
      repeatTexture: false,
    };
  }
  return {
    kind: 'decor',
    collision: true,
    repeatTexture: false,
  };
};

const getDecorBuildSignature = (model = {}) => [
  model.id || '',
  model.kind || '',
  model.modelUrl || '',
  model.modelData || '',
  model.modelName || '',
  model.imageData || '',
  model.imageName || '',
  model.width || '',
  model.depth || '',
  model.height || '',
  model.scale || '',
  model.elevation || '',
  model.modelRotationX || '',
  model.modelRotationY || '',
  model.modelRotationZ || '',
  model.modelCenterOnOrigin ? 'center' : '',
  model.modelFlushToGround ? 'flush' : '',
  model.baseColor || '',
  model.accentColor || '',
  model.roofColor || '',
  model.collision ? 'collision' : '',
  model.repeatTexture ? 'repeat' : '',
].join('|');

const ensureDecorModels = (draft) => {
  if (!Array.isArray(draft.decorModels3d)) draft.decorModels3d = [];
  return draft.decorModels3d;
};

const disposeMaterial = (material) => {
  if (!material) return;
  if (material.userData?.disposeTextures) {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) value.dispose();
    });
  }
  material.dispose?.();
};

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(disposeMaterial);
  });
};

const clearGroup = (group) => {
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
};

const createTexture = (src, repeat = false) => {
  if (!src) return null;
  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
  }
  return texture;
};

const makeMaterial = (color, options = {}) => {
  const texture = options.texture || null;
  const created = new THREE.MeshStandardMaterial({
    color: texture ? '#ffffff' : color,
    map: texture,
    roughness: options.roughness ?? 0.68,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive || '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
  });
  if (texture) created.userData.disposeTextures = true;
  return created;
};

const addMesh = (group, geometry, meshMaterial, position, rotation = null, scale = null) => {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const hashString = (value = '') => [...String(value)].reduce((hash, char) => (((hash << 5) - hash + char.charCodeAt(0)) | 0), 0);

const createRockGeometry = (seedValue) => {
  const geometry = new THREE.DodecahedronGeometry(1, 2);
  const seed = Math.abs(hashString(seedValue)) + 1;
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    const jitter = 0.78 + (((Math.sin(seed * (index + 5) * 10.318) * 41237.42) % 1 + 1) % 1) * 0.36;
    vertex.multiplyScalar(jitter);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

const addImagePanel = (group, texture, width, height, y, z) => {
  if (!texture) return;
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.98,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
  });
  panelMaterial.userData.disposeTextures = true;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), panelMaterial);
  panel.position.set(0, y, z);
  panel.renderOrder = 8;
  group.add(panel);
};

const buildDecorObject = (model) => {
  const root = new THREE.Group();
  const group = new THREE.Group();
  const kind = getDecorRenderKind(model.kind);
  const width = numberValue(model.width, 2.2, 0.4, 8);
  const depth = numberValue(model.depth, 2.2, 0.4, 8);
  const height = numberValue(model.height, kind === 'road' ? 0.05 : 1.2, 0.05, 6);
  const scale = numberValue(model.scale, 1, DECOR_MODEL_SCALE_MIN, DECOR_MODEL_SCALE_MAX);
  const elevation = numberValue(model.elevation, 0, -1, 3);
  const baseColor = colorValue(model.baseColor, '#64748b');
  const accentColor = colorValue(model.accentColor, '#f59e0b');
  const roofColor = colorValue(model.roofColor, '#7f1d1d');
  const texture = createTexture(model.imageData, Boolean(model.repeatTexture || kind === 'road'));
  const baseMaterial = makeMaterial(baseColor, { texture, roughness: kind === 'road' ? 0.86 : 0.64 });
  const accentMaterial = makeMaterial(accentColor, { roughness: 0.48, emissive: accentColor, emissiveIntensity: 0.06 });
  const roofMaterial = makeMaterial(roofColor, { roughness: 0.72 });

  group.scale.setScalar(scale);
  applyModelRotation(group, model);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(width, depth) * 0.58, 40),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: kind === 'road' ? 0.08 : 0.2 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  if (kind === 'road') {
    addMesh(group, new THREE.BoxGeometry(width, Math.max(0.035, height), depth), baseMaterial, [0, Math.max(0.018, height / 2), 0]);
    addMesh(group, new THREE.BoxGeometry(width * 0.08, 0.022, depth * 0.08), accentMaterial, [-width * 0.22, height + 0.025, 0]);
    addMesh(group, new THREE.BoxGeometry(width * 0.08, 0.022, depth * 0.08), accentMaterial, [0, height + 0.025, 0]);
    addMesh(group, new THREE.BoxGeometry(width * 0.08, 0.022, depth * 0.08), accentMaterial, [width * 0.22, height + 0.025, 0]);
  } else if (kind === 'water') {
    const waterMaterial = makeMaterial(baseColor, {
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      emissive: accentColor,
      emissiveIntensity: 0.12,
    });
    addMesh(group, new THREE.BoxGeometry(width, Math.max(0.035, height), depth), waterMaterial, [0, Math.max(0.018, height / 2), 0]);
    addMesh(group, new THREE.TorusGeometry(Math.max(width, depth) * 0.24, 0.018, 8, 48), accentMaterial, [0, height + 0.035, 0], [Math.PI / 2, 0, 0]);
  } else if (kind === 'wall') {
    addMesh(group, new THREE.BoxGeometry(width, height, Math.max(0.12, depth * 0.28)), baseMaterial, [0, height / 2, 0]);
    addMesh(group, new THREE.BoxGeometry(width * 1.02, 0.05, Math.max(0.14, depth * 0.3)), accentMaterial, [0, height * 0.52, 0]);
    addMesh(group, new THREE.BoxGeometry(0.05, height * 0.86, Math.max(0.15, depth * 0.32)), accentMaterial, [-width * 0.22, height * 0.5, 0]);
    addMesh(group, new THREE.BoxGeometry(0.05, height * 0.86, Math.max(0.15, depth * 0.32)), accentMaterial, [width * 0.22, height * 0.5, 0]);
  } else if (kind === 'house') {
    const bodyHeight = height * 0.68;
    addMesh(group, new THREE.BoxGeometry(width, bodyHeight, depth), baseMaterial, [0, bodyHeight / 2, 0]);
    const roof = addMesh(group, new THREE.ConeGeometry(Math.max(width, depth) * 0.72, height * 0.42, 4), roofMaterial, [0, bodyHeight + height * 0.18, 0], [0, Math.PI / 4, 0]);
    roof.scale.z = Math.max(0.72, depth / Math.max(width, 0.1));
    addMesh(group, new THREE.BoxGeometry(width * 0.22, bodyHeight * 0.46, 0.035), accentMaterial, [0, bodyHeight * 0.23, depth / 2 + 0.025]);
    addMesh(group, new THREE.BoxGeometry(width * 0.18, bodyHeight * 0.18, 0.036), roofMaterial, [-width * 0.28, bodyHeight * 0.56, depth / 2 + 0.026]);
    addMesh(group, new THREE.BoxGeometry(width * 0.18, bodyHeight * 0.18, 0.036), roofMaterial, [width * 0.28, bodyHeight * 0.56, depth / 2 + 0.026]);
  } else if (kind === 'tree') {
    addMesh(group, new THREE.CylinderGeometry(width * 0.12, width * 0.16, height * 0.48, 14), makeMaterial('#7c4a22', { roughness: 0.82 }), [0, height * 0.24, 0]);
    addMesh(group, new THREE.SphereGeometry(Math.max(width, depth) * 0.32, 22, 16), baseMaterial, [0, height * 0.65, 0]);
    addMesh(group, new THREE.ConeGeometry(Math.max(width, depth) * 0.38, height * 0.45, 18), accentMaterial, [0, height * 0.92, 0]);
    addImagePanel(group, texture, width * 0.72, height * 0.5, height * 0.7, depth * 0.23);
  } else if (kind === 'crate') {
    addMesh(group, new THREE.BoxGeometry(width, height, depth), baseMaterial, [0, height / 2, 0]);
    addMesh(group, new THREE.BoxGeometry(width * 1.02, 0.04, depth * 0.1), accentMaterial, [0, height * 0.52, depth * 0.51]);
    addMesh(group, new THREE.BoxGeometry(width * 0.1, 0.04, depth * 1.02), accentMaterial, [0, height * 0.52, 0], [0, 0, Math.PI / 2]);
  } else if (kind === 'billboard') {
    addImagePanel(group, texture, width, height, height / 2, 0.04);
    addMesh(group, new THREE.BoxGeometry(width, height, 0.08), texture ? makeMaterial('#1e293b', { transparent: true, opacity: 0.12 }) : baseMaterial, [0, height / 2, 0]);
    addMesh(group, new THREE.BoxGeometry(width * 0.1, height * 0.25, 0.12), accentMaterial, [0, height * 0.125, -0.05]);
  } else {
    addMesh(group, createRockGeometry(model.id || model.name), baseMaterial, [0, height * 0.48, 0], null, [width * 0.42, height * 0.48, depth * 0.42]);
    addMesh(group, new THREE.SphereGeometry(Math.min(width, depth) * 0.12, 12, 8), accentMaterial, [-width * 0.12, height * 0.72, depth * 0.18]);
    addImagePanel(group, texture, width * 0.72, height * 0.6, height * 0.52, depth * 0.42);
  }

  if (model.collision) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(width, depth) * 0.52, 0.018, 8, 52),
      new THREE.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.42 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.045;
    root.add(ring);
  }

  root.add(group);
  if (model.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(group);
  snapObjectToGround(group, elevation);
  if (model.modelFlushToGround) alignObjectTopToGround(group, elevation + 0.018);
  return root;
};

const buildDecorGltfObject = (object, model) => {
  const root = new THREE.Group();
  const group = new THREE.Group();
  const width = numberValue(model.width, 2.2, 0.4, 8);
  const depth = numberValue(model.depth, 2.2, 0.4, 8);
  const height = numberValue(model.height, 1.2, 0.05, 6);
  const scale = numberValue(model.scale, 1, DECOR_MODEL_SCALE_MIN, DECOR_MODEL_SCALE_MAX);
  const elevation = numberValue(model.elevation, 0, -1, 3);
  const texture = createTexture(model.imageData, Boolean(model.repeatTexture));

  applyModelRotation(group, model);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(width, depth) * 0.52, 40),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  prepareGltfModel(object, { restoreTextureColor: true });
  applyTextureToGltfModel(object, texture, { disposeTextureWithMaterial: true });
  fitObjectToHeight(object, height * scale, { groundY: 0 });
  group.add(object);
  root.add(group);
  if (model.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(group);
  snapObjectToGround(group, elevation);
  if (model.modelFlushToGround) alignObjectTopToGround(group, elevation + 0.018);

  if (model.collision) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(width, depth) * 0.52, 0.018, 8, 52),
      new THREE.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.42 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.045;
    root.add(ring);
  }

  return root;
};

const loadGltfDecor = (sources, model, onLoaded, onError) => {
  const loader = new GLTFLoader();
  const sourceList = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const handleLoaded = (gltf) => {
    const object = gltf.scene || gltf.scenes?.[0];
    if (!object) {
      onError?.();
      return;
    }
    onLoaded?.(buildDecorGltfObject(object, model));
  };
  const trySource = (index = 0) => {
    const source = sourceList[index];
    if (!source) {
      onError?.();
      return;
    }
    loadGltfFromSource(loader, source, handleLoaded, () => trySource(index + 1));
  };
  trySource();
};

const createPreviewFloor = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#132033';
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = ((x + y) / 64) % 2 ? '#1d2c43' : '#142238';
      ctx.fillRect(x, y, 64, 64);
      ctx.strokeStyle = 'rgba(148, 163, 184, .16)';
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
    }
  }
  ctx.strokeStyle = 'rgba(103, 232, 249, .2)';
  ctx.lineWidth = 4;
  ctx.strokeRect(96, 96, 320, 320);
  return canvas;
};

function Decor3DPreview({ model }) {
  const containerRef = useRef(null);
  const decorRootRef = useRef(null);
  const rendererRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const buildSignature = useMemo(() => getDecorBuildSignature(model), [model]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch {
      setWebglError('Apercu 3D indisponible.');
      return undefined;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'decor3d-canvas';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111e');
    scene.fog = new THREE.Fog('#07111e', 8, 22);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(4.2, 3.2, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.8;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.75, 0);
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });

    scene.add(new THREE.HemisphereLight('#c9f5ff', '#24160c', 1.15));
    const sun = new THREE.DirectionalLight('#fff0c7', 2.1);
    sun.position.set(-4.5, 6, 5);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);
    scene.add(new THREE.AmbientLight('#4f8cff', 0.28));

    const floorTexture = new THREE.CanvasTexture(createPreviewFloor());
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    const floorMaterial = makeMaterial('#172033', { texture: floorTexture, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    grid.position.y = 0.018;
    scene.add(grid);

    const decorRoot = new THREE.Group();
    decorRootRef.current = decorRoot;
    scene.add(decorRoot);

    const resize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(320, container.clientHeight);
      if (renderer.domElement.width !== Math.floor(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    let frameId = 0;
    const render = (time = 0) => {
      resize();
      if (decorRoot.children[0]) {
        decorRoot.children[0].rotation.y = Math.sin(time * 0.00036) * 0.08;
      }
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      detachCameraControls();
      controls.dispose();
      clearGroup(decorRoot);
      disposeObject(floor);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      decorRootRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const decorRoot = decorRootRef.current;
    if (!decorRoot || !model) return;
    let cancelled = false;
    clearGroup(decorRoot);
    const sources = getGltfModelSources(model);
    if (sources.length) {
      const loadingRoot = new THREE.Group();
      decorRoot.add(loadingRoot);
      const placeholderHeight = numberValue(model.height, 1.2, 0.05, 6) * numberValue(model.scale, 1, DECOR_MODEL_SCALE_MIN, DECOR_MODEL_SCALE_MAX);
      loadingRoot.add(new THREE.Mesh(
        new THREE.BoxGeometry(0.9, Math.max(0.18, placeholderHeight), 0.9),
        new THREE.MeshStandardMaterial({
          color: '#1f2937',
          roughness: 0.68,
          metalness: 0.12,
          emissive: '#0f172a',
          emissiveIntensity: 0.18,
        }),
      ));
      loadingRoot.children[0].position.y = Math.max(0.09, placeholderHeight / 2);
      loadGltfDecor(sources, model, (object) => {
        if (cancelled || decorRoot.userData?.disposed) {
          disposeObject(object);
          return;
        }
        clearGroup(loadingRoot);
        loadingRoot.add(object);
      }, () => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        loadingRoot.add(buildDecorObject({ ...model, modelUrl: '', modelData: '', modelName: '' }));
      });
    } else {
      decorRoot.add(buildDecorObject(model));
    }
    return () => {
      cancelled = true;
    };
  }, [buildSignature]);

  return (
    <div ref={containerRef} className="decor3d-canvas-shell">
      {webglError ? <div className="decor3d-webgl-error">{webglError}</div> : null}
    </div>
  );
}

export default function Decor3DTab({
  project,
  patchProject,
  handleUpload,
  mediaLibrary,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  saveStatus,
  saveInProgress = false,
}) {
  const models = project.decorModels3d || [];
  const isSelectionControlled = controlledSelectedModelId !== undefined;
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || models[0]?.id || '');
  const selectedModelId = isSelectionControlled ? controlledSelectedModelId : localSelectedModelId;
  const setSelectedModelId = useCallback((nextModelId) => {
    setLocalSelectedModelId(nextModelId);
    onSelectedModelIdChange?.(nextModelId);
  }, [onSelectedModelIdChange]);
  const [copyStatus, setCopyStatus] = useState('');
  const [activeCardField, setActiveCardField] = useState('');
  const localModelUrlsRef = useRef(new Map());
  const modelFileInputRef = useRef(null);

  useEffect(() => () => {
    localModelUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localModelUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!models.length) {
      if (selectedModelId) setSelectedModelId('');
      return;
    }
    if (!models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId, setSelectedModelId]);

  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const selectedGltfSource = selectedModel ? getGltfModelSource(selectedModel) : '';
  const previewModel = useMemo(() => selectedModel || makeDecor3DModel({ name: 'Nouveau decor' }), [selectedModel]);
  const kindConfig = getDecorKindConfig(previewModel.kind);
  const KindIcon = kindConfig.icon;
  const selectedKindId = getDecorKindId(selectedModel?.kind);
  const selectedIsFloorTile = selectedModel ? isFloorTileKind(selectedModel.kind) : false;

  const patchSelectedModel = useCallback((updater, options) => {
    if (!selectedModelId) return;
    patchProject((draft) => {
      const model = ensureDecorModels(draft).find((entry) => entry.id === selectedModelId);
      if (model) updater(model);
    }, options);
  }, [patchProject, selectedModelId]);

  const setSelectedModelFile = useCallback(async (file) => {
    if (!file || !selectedModelId) return;
    const isGlb = file.name?.toLowerCase().endsWith('.glb') || file.type === 'model/gltf-binary';
    if (!isGlb) {
      setCopyStatus('Choisis un fichier .glb');
      return;
    }
    const previousUrl = localModelUrlsRef.current.get(selectedModelId);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    localModelUrlsRef.current.delete(selectedModelId);
    setCopyStatus('Optimisation GLB...');
    try {
      const optimization = await optimizeCharacterGlbFile(file);
      const optimizedFile = optimization.file || file;
      const modelUrl = URL.createObjectURL(optimizedFile);
      localModelUrlsRef.current.set(selectedModelId, modelUrl);
      const modelData = await fileToDataURL(optimizedFile);
      patchSelectedModel((model) => {
        if (isFloorTileKind(model.kind)) {
          model.kind = 'decor';
          model.height = Math.max(Number(model.height) || 0, 1.2);
          model.collision = true;
          model.repeatTexture = false;
        }
        model.modelUrl = modelUrl;
        model.modelData = modelData || '';
        model.modelName = optimizedFile.name || file.name || 'modele.glb';
      });
      setCopyStatus(optimization.optimized
        ? `GLB allege ${formatBytes(optimization.originalSize)} -> ${formatBytes(optimization.optimizedSize)}`
        : 'GLB charge');
    } catch {
      setCopyStatus('Import GLB impossible');
    }
  }, [patchSelectedModel, selectedModelId]);

  const setSelectedTileSize = useCallback((value) => {
    patchSelectedModel((model) => {
      const size = numberValue(value, getFloorTileSize(model), 0.4, 8);
      model.width = size;
      model.depth = size;
      model.height = Math.min(Number(model.height) || 0.05, 0.08);
      model.floorZeroZ = getFloorZeroZ(model);
      model.collision = false;
    });
  }, [patchSelectedModel]);

  const setSelectedModelRotation = useCallback((field, value) => {
    patchSelectedModel((model) => {
      model[field] = numberValue(value, 0, -180, 180);
    }, false);
  }, [patchSelectedModel]);

  const setSelectedModelFlat = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelRotationX = isFloorTileKind(model.kind) ? 0 : -90;
      model.modelRotationY = 0;
      model.modelRotationZ = 0;
      model.modelCenterOnOrigin = true;
      model.modelFlushToGround = !isFloorTileKind(model.kind);
    }, false);
  }, [patchSelectedModel]);

  const resetSelectedModelOrientation = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelRotationX = 0;
      model.modelRotationY = 0;
      model.modelRotationZ = 0;
      model.modelFlushToGround = false;
    }, false);
  }, [patchSelectedModel]);

  const centerSelectedModelOnOrigin = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelCenterOnOrigin = true;
    }, false);
  }, [patchSelectedModel]);

  const flushSelectedModelToGround = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelFlushToGround = true;
      model.elevation = 0;
    }, false);
  }, [patchSelectedModel]);

  const createModel = (overrides = {}) => {
    const next = makeDecor3DModel({ name: `Objet 3D ${models.length + 1}`, ...getKindDefaults(overrides.kind || 'decor'), ...overrides });
    patchProject((draft) => {
      ensureDecorModels(draft).push(next);
    });
    setCopyStatus('');
    setSelectedModelId(next.id);
    return next;
  };

  const deleteModel = () => {
    if (!selectedModel) return;
    const nextModels = models.filter((model) => model.id !== selectedModel.id);
    setSelectedModelId(nextModels[0]?.id || '');
    patchProject((draft) => {
      draft.decorModels3d = ensureDecorModels(draft).filter((model) => model.id !== selectedModel.id);
    });
  };

  const showLibraryPanel = false;
  const showInspectorPanel = true;
  const showGlbImportControl = Boolean(selectedModel);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const decorTabClassName = [
    'decor3d-tab',
    'decor3d-tab-with-inspector',
    previewFullscreen ? 'decor3d-tab-fullscreen' : '',
    previewFullscreen && previewDrawerOpen ? 'decor3d-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const togglePreviewFullscreen = () => {
    setPreviewFullscreen((current) => {
      const next = !current;
      if (!next) setPreviewDrawerOpen(false);
      return next;
    });
  };
  const setDecorKind = (kindId) => {
    if (selectedModel?.id) {
      setSelectedModelId(selectedModel.id);
      patchSelectedModel((model) => {
        Object.assign(model, getKindDefaults(kindId, model));
      });
    } else {
      createModel({ name: 'Nouveau decor', ...getKindDefaults(kindId) });
    }
    setActiveCardField(kindId);
  };

  return (
    <main className={decorTabClassName}>
      {showLibraryPanel ? (
      <section className="panel decor3d-library-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Atelier</span>
            <h2>Decors 3D</h2>
            <p className="small-note">{models.length} modele{models.length > 1 ? 's' : ''}</p>
          </div>
          <button type="button" className="primary-action" onClick={() => createModel()}>
            <Plus aria-hidden="true" size={16} />
            <span>Decor</span>
          </button>
        </div>

        <div className="decor3d-list" aria-label="Decors 3D">
          {models.map((model) => {
            const modelKind = getDecorKindConfig(model.kind);
            const ModelKindIcon = modelKind.icon;
            return (
              <button
                type="button"
                key={model.id}
                className={`decor3d-list-item ${model.id === selectedModelId ? 'selected' : ''}`}
                onClick={() => setSelectedModelId(model.id)}
              >
                <span className="decor3d-thumb" style={{ '--decor-body': colorValue(model.baseColor, '#64748b'), '--decor-accent': colorValue(model.accentColor, '#f59e0b') }}>
                  {model.imageData ? <img src={model.imageData} alt="" /> : <ModelKindIcon aria-hidden="true" size={19} />}
                </span>
                <span>
                  <strong>{model.name || 'Decor 3D'}</strong>
                  <small>{modelKind.label}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="panel decor3d-side-card" aria-label="Carte decor">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Carte</span>
            <h2>{previewModel.name || 'Decor 3D'}</h2>
          </div>
        </div>
        <div className="decor3d-card-grid">
          {KIND_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            const isActive = (activeCardField || getDecorKindId(previewModel.kind)) === option.id;
            return (
              <button key={option.id} type="button" className={isActive ? 'active' : ''} onClick={() => setDecorKind(option.id)}>
                <OptionIcon aria-hidden="true" size={14} /> {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel decor3d-preview-panel">
        <div className="decor3d-preview-toolbar">
          <div>
            <span className="section-kicker"><KindIcon size={14} /> Modele</span>
            <h2>{previewModel.name || 'Decor 3D'}</h2>
          </div>
          <div className="decor3d-preview-actions">
            {previewFullscreen ? (
              <button
                type="button"
                className={previewDrawerOpen ? 'active' : ''}
                title={previewDrawerOpen ? 'Fermer le tiroir' : 'Ouvrir le tiroir'}
                aria-label={previewDrawerOpen ? 'Fermer le tiroir de navigation' : 'Ouvrir le tiroir de navigation'}
                aria-pressed={previewDrawerOpen}
                onClick={() => setPreviewDrawerOpen((open) => !open)}
              >
                <PanelLeftOpen aria-hidden="true" size={16} />
              </button>
            ) : null}
            <button
              type="button"
              title={previewFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
              aria-label={previewFullscreen ? 'Quitter le plein ecran' : 'Activer le plein ecran'}
              aria-pressed={previewFullscreen}
              onClick={togglePreviewFullscreen}
            >
              {previewFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
            </button>
          </div>
        </div>
        <Decor3DPreview model={previewModel} />

        <div className="decor3d-meta-strip">
          <span><KindIcon aria-hidden="true" size={14} /> {kindConfig.label}</span>
          {copyStatus ? <span><Sparkles aria-hidden="true" size={14} /> {copyStatus}</span> : null}
        </div>
      </section>

      {showInspectorPanel ? (
      <section className="panel decor3d-editor-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Reglages</span>
            <h2>{selectedModel ? 'Fiche decor' : 'Aucun decor'}</h2>
          </div>
          <div className="decor3d-editor-actions">
            <button
              type="button"
              className="secondary-action decor3d-new-button"
              aria-label="Nouvel objet 3D"
              title="Nouvel objet 3D"
              onClick={() => {
                setActiveCardField('');
                createModel();
              }}
            >
              <Plus aria-hidden="true" size={15} />
              <span>Nouveau</span>
            </button>
            {onSaveAssets ? (
              <button
                type="button"
                className="secondary-action decor3d-save-button"
                aria-label="Sauvegarder objet"
                title="Sauvegarder objet"
                onClick={onSaveAssets}
                disabled={saveInProgress}
              >
                <Save aria-hidden="true" size={15} />
                <span>Sauver</span>
              </button>
            ) : null}
            <button type="button" className="danger-button compact" onClick={deleteModel} disabled={!selectedModel || models.length <= 1}>
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
        {saveStatus ? <p className="decor3d-save-status" role="status">{saveStatus}</p> : null}

        {selectedModel ? (
          <div className="decor3d-form">
            <label>
              <DecorHelpLabel help={DECOR_FIELD_HELP.name}>Nom</DecorHelpLabel>
              <input value={selectedModel.name || ''} onChange={(event) => patchSelectedModel((model) => { model.name = event.target.value; })} />
            </label>
            <div className="decor3d-orientation-grid">
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationX}>Inclinaison X</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationX(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationX', event.target.value)}
                />
              </label>
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationY}>Axe Y</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationY(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationY', event.target.value)}
                />
              </label>
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationZ}>Inclinaison Z</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationZ(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationZ', event.target.value)}
                />
              </label>
            </div>
            <div className="decor3d-orientation-actions">
              <button type="button" className="secondary-action" onClick={setSelectedModelFlat}>A plat</button>
              <button type="button" className="secondary-action" onClick={centerSelectedModelOnOrigin}>Centrer</button>
              {selectedGltfSource ? (
                <button type="button" className="secondary-action" onClick={flushSelectedModelToGround}>Niveau sol</button>
              ) : null}
              <button type="button" className="secondary-action" onClick={resetSelectedModelOrientation}>Debout</button>
            </div>

            {selectedIsFloorTile ? (
              <>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.floorTileSize}>Taille carre</DecorHelpLabel>
                  <input
                    type="number"
                    min="0.4"
                    max="8"
                    step="0.1"
                    value={getFloorTileSize(selectedModel)}
                    onChange={(event) => setSelectedTileSize(event.target.value)}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.floorZeroZ}>Z 0 personnages</DecorHelpLabel>
                  <input
                    type="number"
                    min={FLOOR_ZERO_Z_MIN}
                    max={FLOOR_ZERO_Z_MAX}
                    step="0.5"
                    value={getFloorZeroZ(selectedModel)}
                    onChange={(event) => patchSelectedModel((model) => {
                      model.floorZeroZ = numberValue(event.target.value, getFloorZeroZ(model), FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
                    })}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.baseColor}>Couleur sol</DecorHelpLabel>
                  <input
                    type="color"
                    value={colorValue(selectedModel.baseColor, selectedKindId === 'water' ? '#2563eb' : '#334155')}
                    onChange={(event) => patchSelectedModel((model) => { model.baseColor = event.target.value; })}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.accentColor}>Couleur detail</DecorHelpLabel>
                  <input
                    type="color"
                    value={colorValue(selectedModel.accentColor, selectedKindId === 'water' ? '#67e8f9' : '#f59e0b')}
                    onChange={(event) => patchSelectedModel((model) => { model.accentColor = event.target.value; })}
                  />
                </label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.tileTexture}>Texture de dalle</DecorHelpLabel>
                <MediaSourcePicker
                  className="button like full secondary-action decor3d-file-button"
                  accept="image/*"
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  onSelect={(data, name) => patchSelectedModel((model) => {
                    model.imageData = data;
                    model.imageName = name;
                    model.modelUrl = '';
                    model.modelData = '';
                    model.modelName = '';
                    model.repeatTexture = false;
                    model.collision = false;
                  })}
                >
                  <ImageIcon aria-hidden="true" size={16} />
                  <span>{selectedModel.imageName || 'Texture de dalle'}</span>
                </MediaSourcePicker>
                {selectedModel.imageData ? (
                  <button type="button" className="secondary-action full" onClick={() => patchSelectedModel((model) => {
                    model.imageData = '';
                    model.imageName = '';
                  })}>
                    Retirer texture
                  </button>
                ) : null}
              </>
            ) : null}

            {showGlbImportControl ? (
              <>
                <DecorHelpLabel help={DECOR_FIELD_HELP.glbImport}>Modele GLB</DecorHelpLabel>
                <button type="button" className="button like full secondary-action decor3d-file-button" onClick={() => modelFileInputRef.current?.click()}>
                  <Upload aria-hidden="true" size={16} />
                  <span>{selectedModel.modelName ? 'Remplacer GLB' : 'Importer GLB'}</span>
                </button>
                <input
                  ref={modelFileInputRef}
                  type="file"
                  accept=".glb,model/gltf-binary"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    setSelectedModelFile(file);
                  }}
                />
              </>
            ) : null}

            {selectedGltfSource ? (
              <>
                <DecorHelpLabel help={DECOR_FIELD_HELP.glbTexture}>Texture GLB</DecorHelpLabel>
                <MediaSourcePicker
                  className="button like full secondary-action decor3d-file-button"
                  accept="image/*"
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  onSelect={(data, name) => patchSelectedModel((model) => {
                    model.imageData = data;
                    model.imageName = name;
                  })}
                >
                  <ImageIcon aria-hidden="true" size={16} />
                  <span>{selectedModel.imageName || 'Texture GLB'}</span>
                </MediaSourcePicker>
                {selectedModel.imageData ? (
                  <>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedModel.repeatTexture)}
                        onChange={(event) => patchSelectedModel((model) => {
                          model.repeatTexture = event.target.checked;
                        })}
                      />
                      <DecorHelpLabel help={DECOR_FIELD_HELP.repeatTexture}>Repeter texture</DecorHelpLabel>
                    </label>
                    <button type="button" className="secondary-action full" onClick={() => patchSelectedModel((model) => {
                      model.imageData = '';
                      model.imageName = '';
                      model.repeatTexture = false;
                    })}>
                      Retirer texture GLB
                    </button>
                  </>
                ) : null}
              </>
            ) : null}

            {selectedGltfSource ? (
              <button type="button" className="secondary-action full" onClick={() => patchSelectedModel((model) => {
                if (String(model.modelUrl || '').startsWith('blob:')) {
                  const previousUrl = localModelUrlsRef.current.get(model.id);
                  if (previousUrl) URL.revokeObjectURL(previousUrl);
                  localModelUrlsRef.current.delete(model.id);
                }
                model.modelUrl = '';
                model.modelData = '';
                model.modelName = '';
              })}>
                Retirer modele GLB
              </button>
            ) : null}

          </div>
        ) : (
          <div className="empty-state-inline">Aucun decor 3D.</div>
        )}
      </section>
      ) : null}
    </main>
  );
}
