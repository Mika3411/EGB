import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Cuboid,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  Plus,
  Save,
  Shield,
  Swords,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { attachClickTargetCameraControls } from './three/clickTargetCameraControls.js';
import { makeCharacter3DModel } from '../data/projectData';
import { fileToDataURL } from '../utils/fileHelpers';
import { formatBytes, optimizeCharacterGlbFile } from '../utils/glbOptimizer';
import {
  fitObjectToHeight,
  getGltfAnimationClips,
  getGltfModelSource,
  getGltfModelSources,
  loadGltfFromSource,
  playGltfAnimations,
  prepareGltfModel,
} from '../utils/threeGltfUtils';
import HelpLabel from './forms/HelpLabel.jsx';

const ROLE_OPTIONS = [
  { id: 'hero', label: 'Heros', icon: Shield },
  { id: 'enemy', label: 'Ennemi', icon: Swords },
  { id: 'npc', label: 'PNJ', icon: User },
];

const SHAPE_OPTIONS = [
  { id: 'humanoid', label: 'Humanoide' },
  { id: 'glb', label: 'Modele GLB' },
  { id: 'dark-knight', label: 'Chevalier noir' },
  { id: 'robot', label: 'Robot' },
  { id: 'creature', label: 'Creature' },
  { id: 'mage', label: 'Mage' },
];

const CHARACTER_FIELD_HELP = {
  name: 'Nom interne et visible du personnage dans les listes du builder 3D.',
  glbImport: 'Charge ou remplace le modele 3D du personnage au format .glb. Le fichier est optimise avant d etre stocke.',
  previewLightIntensity: 'Regle la puissance de l eclairage dans l apercu personnage. Cela aide a verifier les volumes et les textures.',
  previewLightOrientation: 'Tourne la lumiere principale autour du personnage pour controler les ombres dans l apercu.',
};

const CharacterHelpLabel = ({ children, help }) => (
  <HelpLabel as="span" className="builder3d-help-label" help={help}>{children}</HelpLabel>
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numberValue = (value, fallback, min, max) => clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max);
const getPreviewLightIntensity = (model = {}) => numberValue(model.previewLightIntensity, 1, 0.2, 2.5);
const getPreviewLightOrientation = (model = {}) => numberValue(model.previewLightOrientation, -35, -180, 180);

const getCharacterBuildSignature = (model = {}) => [
  model.id || '',
  model.shape || '',
  model.modelUrl || '',
  model.modelData || '',
  model.modelName || '',
].join('|');

const applyPreviewLighting = (model, renderer, lights) => {
  if (!renderer || !lights) return;
  const intensity = getPreviewLightIntensity(model);
  const orientation = THREE.MathUtils.degToRad(getPreviewLightOrientation(model));
  const keyRadius = 6.2;
  const fillRadius = 6.6;
  const rimRadius = 5.4;

  renderer.toneMappingExposure = 0.88 + intensity * 0.2;
  lights.hemi.intensity = 0.82 + intensity * 0.34;
  lights.key.intensity = 1.3 + intensity * 0.82;
  lights.frontFill.intensity = 0.38 + intensity * 0.46;
  lights.rim.intensity = 0.24 + intensity * 0.22;
  lights.ambient.intensity = 0.14 + intensity * 0.16;

  lights.key.position.set(Math.sin(orientation) * keyRadius, 5.8, Math.cos(orientation) * keyRadius);
  lights.frontFill.position.set(Math.sin(orientation + Math.PI * 0.58) * fillRadius, 2.4, Math.cos(orientation + Math.PI * 0.58) * fillRadius);
  lights.rim.position.set(Math.sin(orientation + Math.PI) * rimRadius, 3.8, Math.cos(orientation + Math.PI) * rimRadius);
};

const ensureCharacterModels = (draft) => {
  if (!Array.isArray(draft.characterModels3d)) draft.characterModels3d = [];
  return draft.characterModels3d;
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
  if (object?.userData) object.userData.disposed = true;
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

const material = (color, options = {}) => {
  const texture = options.texture || null;
  const created = new THREE.MeshStandardMaterial({
    color: texture ? '#ffffff' : color,
    map: texture,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.05,
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

const buildCharacterObject = (model) => {
  const root = new THREE.Group();
  const shape = ['humanoid', 'glb', 'dark-knight', 'robot', 'creature', 'mage'].includes(model.shape) ? model.shape : 'humanoid';
  const isDarkKnight = shape === 'dark-knight';
  const faceTint = isDarkKnight ? '#0a0b0d' : '#f0c7a7';
  const bodyTint = isDarkKnight ? '#111318' : shape === 'robot' ? '#334155' : shape === 'creature' ? '#0f766e' : '#2563eb';
  const accentTint = isDarkKnight ? '#b88742' : shape === 'mage' ? '#a78bfa' : '#67e8f9';
  const bladeTint = isDarkKnight ? '#c7b18a' : '#e2e8f0';
  const height = isDarkKnight ? 2.05 : shape === 'robot' ? 1.82 : shape === 'creature' ? 1.55 : 1.75;
  const build = isDarkKnight ? 1.28 : shape === 'creature' ? 1.12 : 1;
  const headRatio = shape === 'creature' ? 1.12 : 1;
  const armRatio = isDarkKnight ? 1.08 : 1;
  const legRatio = isDarkKnight ? 1.04 : 1;

  const legHeight = height * 0.34 * legRatio;
  const torsoHeight = height * (shape === 'creature' ? 0.46 : isDarkKnight ? 0.47 : 0.43);
  const headRadius = height * 0.105 * headRatio;
  const bodyWidth = height * (isDarkKnight ? 0.205 : 0.18) * build;
  const bodyDepth = bodyWidth * (shape === 'robot' || isDarkKnight ? 0.9 : 0.74);
  const footY = 0.06;
  const legY = footY + legHeight / 2;
  const torsoY = footY + legHeight + torsoHeight / 2;
  const headY = footY + legHeight + torsoHeight + headRadius * 1.18;
  const bodyMaterial = material(bodyTint, { roughness: shape === 'robot' || isDarkKnight ? 0.38 : 0.62, metalness: shape === 'robot' || isDarkKnight ? 0.32 : 0.04 });
  const accentMaterial = material(accentTint, { roughness: isDarkKnight ? 0.34 : 0.42, metalness: isDarkKnight ? 0.44 : 0.05, emissive: accentTint, emissiveIntensity: isDarkKnight ? 0.04 : 0.08 });
  const faceMaterial = material(faceTint, { roughness: 0.64 });
  const weaponMaterial = material(bladeTint, { roughness: 0.28, metalness: isDarkKnight ? 0.56 : 0.26, emissive: isDarkKnight ? '#2a1b08' : accentTint, emissiveIntensity: isDarkKnight ? 0.05 : 0.08 });

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(0.55, bodyWidth * 1.55), 40),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.24 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);

  if (shape === 'mage') {
    const magicRing = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(0.55, bodyWidth * 1.55), 0.02, 10, 64),
      new THREE.MeshBasicMaterial({ color: accentTint, transparent: true, opacity: 0.74 }),
    );
    magicRing.rotation.x = Math.PI / 2;
    magicRing.position.y = 0.05;
    root.add(magicRing);
  }

  if (isDarkKnight) {
    const trimMaterial = material(accentTint, { roughness: 0.28, metalness: 0.62, emissive: '#1f1204', emissiveIntensity: 0.08 });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#ef271f' });
    const cloakMaterial = material('#060914', {
      roughness: 0.88,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });

    addMesh(root, new THREE.BoxGeometry(bodyWidth * 1.72, torsoHeight, bodyDepth * 1.16), bodyMaterial, [0, torsoY, 0]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 1.34, torsoHeight * 0.18, bodyDepth * 1.22), trimMaterial, [0, torsoY + torsoHeight * 0.22, bodyDepth * 0.08]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.82, torsoHeight * 0.56, 0.035), trimMaterial, [0, torsoY + torsoHeight * 0.02, bodyDepth * 0.61]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.42, torsoHeight * 0.36, 0.04), bodyMaterial, [0, torsoY - torsoHeight * 0.12, bodyDepth * 0.65]);

    [-1, 1].forEach((side) => {
      const shoulder = addMesh(root, new THREE.ConeGeometry(bodyWidth * 0.62, bodyWidth * 0.54, 4), bodyMaterial, [side * bodyWidth * 1.18, torsoY + torsoHeight * 0.34, 0], [0.22, 0, side * 0.55]);
      shoulder.rotation.y = Math.PI / 4;
      addMesh(root, new THREE.ConeGeometry(bodyWidth * 0.15, bodyWidth * 0.62, 8), trimMaterial, [side * bodyWidth * 1.55, torsoY + torsoHeight * 0.48, 0], [0, 0, -side * 0.78]);
      addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.22, torsoHeight * 0.64 * armRatio, 6, 10), bodyMaterial, [side * bodyWidth * 1.14, torsoY - torsoHeight * 0.1, 0], [0, 0, side * 0.12]);
      addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.34, torsoHeight * 0.22, bodyDepth * 0.62), trimMaterial, [side * bodyWidth * 1.12, torsoY - torsoHeight * 0.26, 0]);
    });

    [-1, 1].forEach((side) => {
      addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.27, legHeight * 0.78 * legRatio, 6, 10), bodyMaterial, [side * bodyWidth * 0.38, legY, 0]);
      addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.5, legHeight * 0.18, bodyDepth * 0.72), trimMaterial, [side * bodyWidth * 0.38, legY - legHeight * 0.18, 0]);
      addMesh(root, new THREE.ConeGeometry(bodyWidth * 0.2, bodyWidth * 0.5, 4), trimMaterial, [side * bodyWidth * 0.38, legY + legHeight * 0.2, bodyDepth * 0.46], [Math.PI / 2, 0, Math.PI / 4]);
    });

    addMesh(root, new THREE.SphereGeometry(headRadius * 1.08, 20, 14), bodyMaterial, [0, headY, 0]);
    addMesh(root, new THREE.ConeGeometry(headRadius * 0.92, headRadius * 1.82, 4), bodyMaterial, [0, headY + headRadius * 0.18, bodyDepth * 0.05], [0, Math.PI / 4, 0]);
    addMesh(root, new THREE.BoxGeometry(headRadius * 1.28, headRadius * 0.08, 0.03), eyeMaterial, [0, headY + headRadius * 0.08, headRadius * 0.98]);
    [-1, 0, 1].forEach((side) => {
      addMesh(root, new THREE.ConeGeometry(headRadius * 0.13, headRadius * (side === 0 ? 1.25 : 0.88), 8), trimMaterial, [side * headRadius * 0.62, headY + headRadius * 0.95, 0], [0, 0, -side * 0.2]);
    });

    const cloak = addMesh(root, new THREE.PlaneGeometry(bodyWidth * 3.4, height * 1.04, 1, 6), cloakMaterial, [0, torsoY - torsoHeight * 0.18, -bodyDepth * 0.84], [0.24, 0, 0]);
    const cloakPositions = cloak.geometry.attributes.position;
    for (let index = 0; index < cloakPositions.count; index += 1) {
      const x = cloakPositions.getX(index);
      const y = cloakPositions.getY(index);
      const rag = Math.sin(index * 2.1) * 0.045 - Math.max(0, -y) * 0.08;
      cloakPositions.setZ(index, rag + Math.abs(x) * 0.04);
    }
    cloakPositions.needsUpdate = true;

    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.15, height * 1.18, bodyWidth * 0.06), weaponMaterial, [-bodyWidth * 1.82, height * 0.46, bodyDepth * 0.9], [0.05, 0, 0.02]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.76, bodyWidth * 0.1, bodyWidth * 0.16), trimMaterial, [-bodyWidth * 1.82, height * 0.78, bodyDepth * 0.92], [0, 0, -0.15]);
    addMesh(root, new THREE.SphereGeometry(bodyWidth * 0.13, 12, 8), trimMaterial, [-bodyWidth * 1.82, height * 0.14, bodyDepth * 0.9]);
    addMesh(root, new THREE.ConeGeometry(bodyWidth * 0.12, bodyWidth * 0.42, 4), weaponMaterial, [-bodyWidth * 1.82, height * 1.08, bodyDepth * 0.9], [0, Math.PI / 4, 0]);
  } else if (shape === 'robot') {
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 1.8, torsoHeight, bodyDepth * 1.42), bodyMaterial, [0, torsoY, 0]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 1.35, headRadius * 1.75, bodyDepth * 1.16), faceMaterial, [0, headY, 0]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.45, legHeight, bodyDepth * 0.58), accentMaterial, [-bodyWidth * 0.43, legY, 0]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.45, legHeight, bodyDepth * 0.58), accentMaterial, [bodyWidth * 0.43, legY, 0]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.38, torsoHeight * 0.78 * armRatio, bodyDepth * 0.46), accentMaterial, [-bodyWidth * 1.25, torsoY + torsoHeight * 0.05, 0], [0, 0, -0.18]);
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.38, torsoHeight * 0.78 * armRatio, bodyDepth * 0.46), accentMaterial, [bodyWidth * 1.25, torsoY + torsoHeight * 0.05, 0], [0, 0, 0.18]);
  } else if (shape === 'creature') {
    addMesh(root, new THREE.SphereGeometry(bodyWidth * 1.12, 24, 18), bodyMaterial, [0, torsoY, 0], null, [1.15, 1.28, 0.92]);
    addMesh(root, new THREE.SphereGeometry(headRadius * 1.32, 20, 14), faceMaterial, [0, headY, bodyDepth * 0.12]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.24, torsoHeight * 0.54 * armRatio, 6, 10), accentMaterial, [-bodyWidth * 1.22, torsoY + torsoHeight * 0.02, 0], [0, 0, -0.42]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.24, torsoHeight * 0.54 * armRatio, 6, 10), accentMaterial, [bodyWidth * 1.22, torsoY + torsoHeight * 0.02, 0], [0, 0, 0.42]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.24, legHeight * 0.58, 5, 10), accentMaterial, [-bodyWidth * 0.42, legY, 0]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.24, legHeight * 0.58, 5, 10), accentMaterial, [bodyWidth * 0.42, legY, 0]);
    [-1, 1].forEach((side) => {
      addMesh(root, new THREE.ConeGeometry(headRadius * 0.25, headRadius * 1.1, 8), weaponMaterial, [side * headRadius * 0.68, headY + headRadius * 0.72, 0], [0, 0, side * 0.42]);
    });
  } else {
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth, Math.max(0.08, torsoHeight - bodyWidth * 1.25), 8, 16), bodyMaterial, [0, torsoY, 0]);
    addMesh(root, new THREE.SphereGeometry(headRadius, 22, 16), faceMaterial, [0, headY, bodyDepth * 0.08]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.22, torsoHeight * 0.7 * armRatio, 6, 12), faceMaterial, [-bodyWidth * 1.05, torsoY + torsoHeight * 0.05, 0], [0, 0, -0.24]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.22, torsoHeight * 0.7 * armRatio, 6, 12), faceMaterial, [bodyWidth * 1.05, torsoY + torsoHeight * 0.05, 0], [0, 0, 0.24]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.23, legHeight * 0.82, 5, 12), bodyMaterial, [-bodyWidth * 0.38, legY, 0]);
    addMesh(root, new THREE.CapsuleGeometry(bodyWidth * 0.23, legHeight * 0.82, 5, 12), bodyMaterial, [bodyWidth * 0.38, legY, 0]);
  }

  if (!isDarkKnight && shape === 'mage') {
    const cloakMaterial = material(accentTint, {
      roughness: 0.7,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      emissive: accentTint,
      emissiveIntensity: 0.06,
    });
    addMesh(root, new THREE.PlaneGeometry(bodyWidth * 2.35, torsoHeight * 1.25), cloakMaterial, [0, torsoY - torsoHeight * 0.02, -bodyDepth * 0.72], [0.12, 0, 0]);
  }

  if (!isDarkKnight && shape === 'robot') {
    addMesh(root, new THREE.SphereGeometry(headRadius * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), accentMaterial, [0, headY + headRadius * 0.08, bodyDepth * 0.02]);
  }

  if (!isDarkKnight) {
    const weaponLength = shape === 'mage' ? torsoHeight * 1.42 : torsoHeight * 0.98;
    addMesh(root, new THREE.BoxGeometry(bodyWidth * 0.12, bodyWidth * 0.12, weaponLength), weaponMaterial, [bodyWidth * 1.34, torsoY + torsoHeight * 0.03, bodyDepth * 0.82], [0.28, 0.08, -0.12]);
    if (shape === 'mage') {
      addMesh(root, new THREE.SphereGeometry(bodyWidth * 0.18, 14, 10), accentMaterial, [bodyWidth * 1.52, torsoY + torsoHeight * 0.48, bodyDepth * 1.24]);
    }
  }

  return root;
};

const loadGltfCharacter = (sources, model, onLoaded, onError) => {
  const loader = new GLTFLoader();
  const sourceList = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const handleLoaded = (gltf) => {
      const object = gltf.scene || gltf.scenes?.[0];
      if (!object) {
        onError?.();
        return;
      }
      prepareGltfModel(object, { restoreTextureColor: true });
      fitObjectToHeight(object, 2, { groundY: 0 });
      onLoaded?.(object, getGltfAnimationClips(gltf));
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

function Character3DPreview({ model }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const characterRootRef = useRef(null);
  const rendererRef = useRef(null);
  const animationMixersRef = useRef([]);
  const lightsRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const buildSignature = useMemo(() => getCharacterBuildSignature(model), [model]);

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'character3d-canvas';
    renderer.domElement.setAttribute('aria-label', 'Apercu personnage 3D');
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111e');
    scene.fog = new THREE.Fog('#07111e', 7, 16);
    sceneRef.current = scene;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
    camera.position.set(2.8, 2.05, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.4;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 1.05, 0);
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });

    const hemi = new THREE.HemisphereLight('#d5f4ff', '#24170f', 1.22);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff2cf', 2.05);
    key.position.set(-3.8, 5.8, 4.8);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);
    const frontFill = new THREE.DirectionalLight('#d8e8ff', 1.05);
    frontFill.position.set(3.2, 2.4, 5.4);
    scene.add(frontFill);
    const rim = new THREE.DirectionalLight('#86f7ff', 0.48);
    rim.position.set(3.4, 3.8, -4.2);
    scene.add(rim);
    const ambient = new THREE.AmbientLight('#7fb7ff', 0.28);
    scene.add(ambient);
    lightsRef.current = { hemi, key, frontFill, rim, ambient };
    applyPreviewLighting(model, renderer, lightsRef.current);

    const floorTexture = new THREE.CanvasTexture(createPreviewFloor());
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.88, metalness: 0 });
    floorMaterial.userData.disposeTextures = true;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.35, 72), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(4.8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    grid.position.y = 0.018;
    scene.add(grid);

    const characterRoot = new THREE.Group();
    characterRootRef.current = characterRoot;
    scene.add(characterRoot);

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
    let previousTime = 0;
    const render = (time = 0) => {
      resize();
      const delta = previousTime ? Math.min(0.05, (time - previousTime) / 1000) : 0;
      previousTime = time;
      animationMixersRef.current.forEach((mixer) => mixer.update(delta));
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      detachCameraControls();
      controls.dispose();
      animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
      animationMixersRef.current = [];
      clearGroup(characterRoot);
      disposeObject(floor);
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      sceneRef.current = null;
      characterRootRef.current = null;
      rendererRef.current = null;
      lightsRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyPreviewLighting(model, rendererRef.current, lightsRef.current);
  }, [model?.previewLightIntensity, model?.previewLightOrientation]);

  useEffect(() => {
    const characterRoot = characterRootRef.current;
    if (!characterRoot || !model) return;
    let cancelled = false;
    animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
    animationMixersRef.current = [];
    clearGroup(characterRoot);
    const sources = getGltfModelSources(model);
    if (sources.length) {
      const loadingRoot = new THREE.Group();
      characterRoot.add(loadingRoot);
      loadingRoot.add(new THREE.Mesh(
        new THREE.CapsuleGeometry(0.36, 1.15, 6, 12),
        new THREE.MeshStandardMaterial({
          color: '#1f2937',
          roughness: 0.68,
          metalness: 0.12,
          emissive: '#0f172a',
          emissiveIntensity: 0.18,
        }),
      ));
      loadingRoot.children[0].position.y = 0.72;
      loadGltfCharacter(sources, model, (object, animationClips) => {
        if (cancelled || characterRoot.userData?.disposed) {
          disposeObject(object);
          return;
        }
        const mixer = playGltfAnimations(object, animationClips, { timeOffset: performance.now() * 0.001 });
        animationMixersRef.current = mixer ? [mixer] : [];
        clearGroup(loadingRoot);
        loadingRoot.add(object);
      }, () => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        loadingRoot.add(buildCharacterObject({ ...model, modelUrl: '', modelData: '', shape: 'dark-knight' }));
      });
    } else {
      characterRoot.add(buildCharacterObject(model));
    }
    return () => {
      cancelled = true;
      animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
      animationMixersRef.current = [];
    };
  }, [buildSignature]);

  return (
    <div ref={containerRef} className="character3d-canvas-shell">
      {webglError ? <div className="character3d-webgl-error">{webglError}</div> : null}
    </div>
  );
}

const createPreviewFloor = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1b2d';
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = ((x + y) / 64) % 2 ? '#172741' : '#101d31';
      ctx.fillRect(x, y, 64, 64);
      ctx.strokeStyle = 'rgba(103, 232, 249, .11)';
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
    }
  }
  ctx.strokeStyle = 'rgba(245, 158, 11, .2)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(256, 256, 132, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
};

const FieldRange = ({ label, help, value, min, max, step = 0.05, onChange }) => (
  <label className="character3d-range">
    <span>
      <CharacterHelpLabel help={help}>{label}</CharacterHelpLabel>
      <em>{Number(value).toFixed(step < 1 ? 2 : 0)}</em>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

export default function Character3DTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  saveStatus,
  saveInProgress = false,
}) {
  const models = project.characterModels3d || [];
  const isSelectionControlled = controlledSelectedModelId !== undefined;
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || models[0]?.id || '');
  const selectedModelId = isSelectionControlled ? controlledSelectedModelId : localSelectedModelId;
  const setSelectedModelId = useCallback((nextModelId) => {
    setLocalSelectedModelId(nextModelId);
    onSelectedModelIdChange?.(nextModelId);
  }, [onSelectedModelIdChange]);
  const [, setCopyStatus] = useState('');
  const localModelUrlsRef = useRef(new Map());
  const bootstrappedModelRef = useRef(false);

  useEffect(() => () => {
    localModelUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localModelUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!models.length) {
      if (bootstrappedModelRef.current) return;
      bootstrappedModelRef.current = true;
      const next = makeCharacter3DModel({ name: 'Nouveau personnage', role: 'hero', shape: 'humanoid' });
      patchProject((draft) => {
        const modelList = ensureCharacterModels(draft);
        if (!modelList.length) modelList.push(next);
      });
      setSelectedModelId(next.id);
      return;
    }
    bootstrappedModelRef.current = true;
    if (!models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
  }, [models, patchProject, selectedModelId, setSelectedModelId]);

  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const selectedGltfSource = selectedModel ? getGltfModelSource(selectedModel) : '';
  const previewModel = useMemo(() => selectedModel || makeCharacter3DModel({ name: 'Nouveau personnage' }), [selectedModel]);
  const selectedRole = selectedModel?.role || previewModel.role || 'hero';
  const cardRoleOptions = ['enemy', 'hero', 'npc']
    .map((roleId) => ROLE_OPTIONS.find((option) => option.id === roleId))
    .filter(Boolean);
  const canImportRoleGlb = Boolean(selectedModel);

  const patchSelectedModel = useCallback((updater, options) => {
    if (!selectedModelId) return;
    patchProject((draft) => {
      const model = ensureCharacterModels(draft).find((entry) => entry.id === selectedModelId);
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
        model.shape = 'glb';
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

  const createModel = () => {
    const next = makeCharacter3DModel({ name: `Personnage 3D ${models.length + 1}`, role: 'npc', shape: 'humanoid' });
    patchProject((draft) => {
      ensureCharacterModels(draft).push(next);
    });
    setCopyStatus('');
    setSelectedModelId(next.id);
  };

  const deleteModel = () => {
    if (!selectedModel) return;
    const nextModels = models.filter((model) => model.id !== selectedModel.id);
    setSelectedModelId(nextModels[0]?.id || '');
    patchProject((draft) => {
      draft.characterModels3d = ensureCharacterModels(draft).filter((model) => model.id !== selectedModel.id);
    });
  };

  const showLibraryPanel = false;
  const showInspectorPanel = true;
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const characterTabClassName = [
    'character3d-tab',
    'character3d-tab-with-inspector',
    previewFullscreen ? 'character3d-tab-fullscreen' : '',
    previewFullscreen && previewDrawerOpen ? 'character3d-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const togglePreviewFullscreen = () => {
    setPreviewFullscreen((current) => {
      const next = !current;
      if (!next) setPreviewDrawerOpen(false);
      return next;
    });
  };

  return (
    <main className={characterTabClassName}>
      {showLibraryPanel ? (
      <section className="panel character3d-library-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Atelier</span>
            <h2>Personnages 3D</h2>
            <p className="small-note">{models.length} modele{models.length > 1 ? 's' : ''}</p>
          </div>
          <button type="button" className="primary-action" onClick={createModel}>
            <Plus aria-hidden="true" size={16} />
            <span>Personnage</span>
          </button>
        </div>

        <div className="character3d-list" aria-label="Personnages 3D">
          {models.map((model) => {
            const modelRole = ROLE_OPTIONS.find((option) => option.id === model.role) || ROLE_OPTIONS[0];
            const ModelRoleIcon = modelRole.icon;
            return (
              <button
                type="button"
                key={model.id}
                className={`character3d-list-item ${model.id === selectedModelId ? 'selected' : ''}`}
                onClick={() => setSelectedModelId(model.id)}
              >
                <span className="character3d-thumb" style={{ '--character-body': '#2563eb', '--character-accent': '#67e8f9' }}>
                  {getGltfModelSource(model) ? <Cuboid aria-hidden="true" size={20} /> : <ModelRoleIcon aria-hidden="true" size={19} />}
                </span>
                <span>
                  <strong>{model.name || 'Personnage 3D'}</strong>
                  <small>{modelRole.label} - {model.modelName || SHAPE_OPTIONS.find((option) => option.id === model.shape)?.label || 'Humanoide'}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="panel character3d-side-card" aria-label="Carte personnage">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Carte</span>
            <h2>{previewModel.name || 'Personnage 3D'}</h2>
          </div>
        </div>
        <div className="character3d-card-role-buttons" role="group" aria-label="Role du personnage">
          {cardRoleOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                className={selectedRole === option.id ? 'active' : ''}
                onClick={() => patchSelectedModel((model) => { model.role = option.id; })}
              >
                <OptionIcon aria-hidden="true" size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel character3d-preview-panel">
        <div className="character3d-preview-head">
          <div>
            <span className="section-kicker"><Cuboid size={14} /> Modele</span>
            <h2>{previewModel.name || 'Personnage 3D'}</h2>
          </div>
          <div className="character3d-preview-actions">
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

        <Character3DPreview model={previewModel} />
      </section>

      {showInspectorPanel ? (
      <section className="panel character3d-editor-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Reglages</span>
            <h2>{selectedModel ? 'Fiche personnage' : 'Aucun personnage'}</h2>
          </div>
          <div className="character3d-editor-actions">
            <button
              type="button"
              className="secondary-action character3d-new-button"
              aria-label="Nouveau personnage"
              title="Nouveau personnage"
              onClick={createModel}
            >
              <Plus aria-hidden="true" size={15} />
              <span>Nouveau</span>
            </button>
            {onSaveAssets ? (
              <button
                type="button"
                className="secondary-action character3d-save-button"
                aria-label="Sauvegarder personnage"
                title="Sauvegarder personnage"
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
        {saveStatus ? <p className="character3d-save-status" role="status">{saveStatus}</p> : null}

        {selectedModel ? (
          <div className="character3d-form">
            <label>
              <CharacterHelpLabel help={CHARACTER_FIELD_HELP.name}>Nom</CharacterHelpLabel>
              <input value={selectedModel.name || ''} onChange={(event) => patchSelectedModel((model) => { model.name = event.target.value; })} />
            </label>

            {canImportRoleGlb ? (
              <>
                <CharacterHelpLabel help={CHARACTER_FIELD_HELP.glbImport}>Modele GLB</CharacterHelpLabel>
                <label className="button like full secondary-action character3d-file-button">
                  <Upload aria-hidden="true" size={16} />
                  <span>{selectedModel.modelName ? 'Remplacer GLB' : 'Importer GLB'}</span>
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      setSelectedModelFile(file);
                    }}
                  />
                </label>
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
                if (model.shape === 'glb') model.shape = 'humanoid';
              })}>
                Retirer modele GLB
              </button>
            ) : null}

            <FieldRange
              label="Lumiere"
              help={CHARACTER_FIELD_HELP.previewLightIntensity}
              min="0.2"
              max="2.5"
              step="0.05"
              value={getPreviewLightIntensity(selectedModel)}
              onChange={(value) => patchSelectedModel((model) => { model.previewLightIntensity = value; }, { rememberHistory: false })}
            />
            <FieldRange
              label="Orientation lumiere"
              help={CHARACTER_FIELD_HELP.previewLightOrientation}
              min="-180"
              max="180"
              step="1"
              value={getPreviewLightOrientation(selectedModel)}
              onChange={(value) => patchSelectedModel((model) => { model.previewLightOrientation = value; }, { rememberHistory: false })}
            />
          </div>
        ) : (
          <div className="empty-state-inline">Aucun personnage 3D.</div>
        )}
      </section>
      ) : null}
    </main>
  );
}
