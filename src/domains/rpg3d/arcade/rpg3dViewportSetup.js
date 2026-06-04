import {
  ACESFilmicToneMapping as ThreeACESFilmicToneMapping,
  AmbientLight as ThreeAmbientLight,
  Color as ThreeColor,
  DirectionalLight as ThreeDirectionalLight,
  FogExp2 as ThreeFogExp2,
  Group as ThreeGroup,
  HemisphereLight as ThreeHemisphereLight,
  Object3D as ThreeObject3D,
  PCFShadowMap as ThreePCFShadowMap,
  PMREMGenerator as ThreePMREMGenerator,
  PerspectiveCamera as ThreePerspectiveCamera,
  SRGBColorSpace as ThreeSRGBColorSpace,
  Scene as ThreeScene,
  WebGLRenderer as ThreeWebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../../../shared/utils/three/clickTargetCameraControls.js';
import {
  SHADOW_CAMERA_MIN_EXTENT,
  SHADOW_MAP_SIZE,
} from './rpg3dSceneBuilders.js';

export const createArcadeRenderer = ({
  onContextLost = null,
  preserveDrawingBuffer = false,
} = {}) => {
  const renderer = new ThreeWebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = ThreeSRGBColorSpace;
  renderer.toneMapping = ThreeACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor('#081521', 1);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = ThreePCFShadowMap;
  renderer.domElement.className = 'arcade-three-canvas';
  renderer.domElement.setAttribute('data-testid', 'rpg3d-canvas');
  if (onContextLost) {
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  }
  return renderer;
};

export const createArcadeSceneEnvironment = (renderer) => {
  const scene = new ThreeScene();
  scene.background = new ThreeColor('#081521');
  scene.fog = new ThreeFogExp2('#081521', 0.012);
  const pmremGenerator = new ThreePMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
  roomEnvironment.dispose?.();
  scene.environment = environmentMap;
  return { environmentMap, pmremGenerator, scene };
};

export const createArcadeCamera = () => {
  const camera = new ThreePerspectiveCamera(58, 1, 0.1, 260);
  camera.position.set(-18, 16, 18);
  return camera;
};

export const createArcadeOrbitControls = (camera, domElement) => {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 2.6;
  controls.maxDistance = 90;
  controls.screenSpacePanning = false;
  return controls;
};

export const attachArcadeCameraControls = ({
  camera,
  controls,
  domElement,
  scene,
  onPanMove,
  onPanStart,
}) => attachClickTargetCameraControls({
  camera,
  controls,
  domElement,
  scene,
  groundY: 0,
  enabled: () => true,
  onPanStart,
  onPanMove,
});

export const createArcadeSceneGroups = (scene) => {
  const staticGroup = new ThreeGroup();
  const terrainPaintGroup = new ThreeGroup();
  const selectionGroup = new ThreeGroup();
  const dynamicGroup = new ThreeGroup();
  scene.add(staticGroup);
  scene.add(terrainPaintGroup);
  scene.add(selectionGroup);
  scene.add(dynamicGroup);
  return {
    dynamicGroup,
    selectionGroup,
    staticGroup,
    terrainPaintGroup,
  };
};

export const addArcadeSceneLights = (scene) => {
  const hemi = new ThreeHemisphereLight('#fff7ea', '#211814', 1.02);
  scene.add(hemi);
  const sun = new ThreeDirectionalLight('#fff6e6', 1.95);
  sun.position.set(-16, 32, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.camera.near = 0.8;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -SHADOW_CAMERA_MIN_EXTENT;
  sun.shadow.camera.right = SHADOW_CAMERA_MIN_EXTENT;
  sun.shadow.camera.top = SHADOW_CAMERA_MIN_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_CAMERA_MIN_EXTENT;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);
  scene.add(sun.target);
  const frontFill = new ThreeDirectionalLight('#f7f3ec', 0.55);
  frontFill.position.set(18, 14, 24);
  scene.add(frontFill);
  const rim = new ThreeDirectionalLight('#ffe0bd', 0.16);
  rim.position.set(20, 18, -24);
  scene.add(rim);
  const ambient = new ThreeAmbientLight('#fff3e0', 0.08);
  scene.add(ambient);
  scene.userData.hemi = hemi;
  scene.userData.sun = sun;
  scene.userData.frontFill = frontFill;
  scene.userData.rim = rim;
  scene.userData.ambient = ambient;
  return { ambient, frontFill, hemi, rim, sun };
};

export const createArcadeTransformProxy = (scene) => {
  const transformProxy = new ThreeObject3D();
  transformProxy.visible = false;
  scene.add(transformProxy);
  return transformProxy;
};
