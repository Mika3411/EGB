import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import { formatBytes } from '../../utils/glbOptimizer';
import {
  clearGroup,
  createPreviewFloorCanvas,
  disposeThreeObject,
  getCharacterBuildSignature,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelSources,
  getPreviewAnimationOptions,
  getPreviewAnimationSlot,
  getPreviewLightIntensity,
  getPreviewLightOrientation,
  isHeavyLocalFbxAsset,
  loadCharacterAnimationClips,
  loadThreeCharacter,
  summarizeEmbeddedAnimationClips,
} from '../../utils/rpg3dModelImport';
import {
  applyObjectAxisScaleRatios,
  fitObjectToHeight,
  playGltfAnimations,
  resetObjectBaseTransform,
  updateGltfModelMaterialAppearance,
} from '../../utils/threeGltfUtils';

const applyPreviewLighting = (model, renderer, lights) => {
  if (!renderer || !lights) return;
  const intensity = getPreviewLightIntensity(model);
  const orientation = THREE.MathUtils.degToRad(getPreviewLightOrientation(model));
  const keyRadius = 6.2;
  const fillRadius = 6.6;
  const rimRadius = 5.4;

  renderer.toneMappingExposure = 0.98 + intensity * 0.18;
  lights.hemi.intensity = 0.72 + intensity * 0.3;
  lights.key.intensity = 1.55 + intensity * 0.86;
  lights.frontFill.intensity = 0.28 + intensity * 0.3;
  lights.rim.intensity = 0.08 + intensity * 0.1;
  lights.ambient.intensity = 0.18 + intensity * 0.18;

  lights.key.position.set(Math.sin(orientation) * keyRadius, 5.8, Math.cos(orientation) * keyRadius);
  lights.frontFill.position.set(Math.sin(orientation + Math.PI * 0.58) * fillRadius, 2.4, Math.cos(orientation + Math.PI * 0.58) * fillRadius);
  lights.rim.position.set(Math.sin(orientation + Math.PI) * rimRadius, 3.8, Math.cos(orientation + Math.PI) * rimRadius);
};

const getCharacterSizeSignature = (model = {}) => {
  const axisScale = getCharacterModelAxisScale(model);
  return `${axisScale.x}:${axisScale.y}:${axisScale.z}`;
};
const getCharacterAppearanceSignature = (model = {}) => `${getCharacterMaterialBrightness(model)}`;

const applyCharacterPreviewSize = (object, model = {}) => {
  if (!object) return;
  resetObjectBaseTransform(object);
  const axisScale = getCharacterModelAxisScale(model);
  fitObjectToHeight(object, 2 * axisScale.y, { groundY: 0 });
  applyObjectAxisScaleRatios(object, axisScale, axisScale.y, { groundY: 0 });
};

export default function Character3DPreview({ model, animationSlot = '', onAnimationClipsLoaded }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const characterRootRef = useRef(null);
  const rendererRef = useRef(null);
  const characterObjectRef = useRef(null);
  const latestModelRef = useRef(model);
  const animationMixersRef = useRef([]);
  const lightsRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const [previewStatus, setPreviewStatus] = useState('');
  const buildSignature = useMemo(() => `${getCharacterBuildSignature(model)}|preview:${animationSlot}`, [animationSlot, model]);
  const sizeSignature = useMemo(() => getCharacterSizeSignature(model), [model]);
  const appearanceSignature = useMemo(() => getCharacterAppearanceSignature(model), [model]);

  useEffect(() => {
    latestModelRef.current = model;
  }, [model]);

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
    renderer.setPixelRatio(window.devicePixelRatio || 1);
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

    const hemi = new THREE.HemisphereLight('#fff7ea', '#1f1814', 1.02);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff6e6', 2.25);
    key.position.set(-3.8, 5.8, 4.8);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);
    const frontFill = new THREE.DirectionalLight('#f7f3ec', 0.58);
    frontFill.position.set(3.2, 2.4, 5.4);
    scene.add(frontFill);
    const rim = new THREE.DirectionalLight('#ffe0bd', 0.18);
    rim.position.set(3.4, 3.8, -4.2);
    scene.add(rim);
    const ambient = new THREE.AmbientLight('#fff3e0', 0.28);
    scene.add(ambient);
    lightsRef.current = { hemi, key, frontFill, rim, ambient };
    applyPreviewLighting(model, renderer, lightsRef.current);

    const floorTexture = new THREE.CanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#0f1b2d',
      oddColor: '#172741',
      evenColor: '#101d31',
      cellLineColor: 'rgba(103, 232, 249, .11)',
      markerColor: 'rgba(245, 158, 11, .2)',
      markerLineWidth: 5,
      markerShape: 'circle',
      markerRadius: 132,
    }));
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
      characterObjectRef.current = null;
      clearGroup(characterRoot);
      disposeThreeObject(floor);
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
    applyCharacterPreviewSize(characterObjectRef.current, latestModelRef.current);
  }, [sizeSignature]);

  useEffect(() => {
    updateGltfModelMaterialAppearance(characterObjectRef.current, {
      materialBrightness: getCharacterMaterialBrightness(latestModelRef.current),
    });
  }, [appearanceSignature]);

  useEffect(() => {
    const characterRoot = characterRootRef.current;
    if (!characterRoot || !model) return undefined;
    let cancelled = false;
    animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
    animationMixersRef.current = [];
    characterObjectRef.current = null;
    clearGroup(characterRoot);
    const sources = getCharacterModelSources(model);
    if (sources.length) {
      if (isHeavyLocalFbxAsset(model)) {
        setPreviewStatus(`FBX local lourd (${formatBytes(Number(model.modelFileSize) || 0)}): convertis-le en GLB pour un preview fluide.`);
        return undefined;
      }
      setPreviewStatus('Chargement du modele 3D...');
      const loadingRoot = new THREE.Group();
      characterRoot.add(loadingRoot);
      loadThreeCharacter(sources, model, (object, animationClips) => {
        if (cancelled || characterRoot.userData?.disposed) {
          disposeThreeObject(object);
          return;
        }
        onAnimationClipsLoaded?.(model?.id || '', summarizeEmbeddedAnimationClips(animationClips));
        const previewSlot = getPreviewAnimationSlot(model, animationSlot);
        try {
          applyCharacterPreviewSize(object, latestModelRef.current);
          clearGroup(loadingRoot);
          loadingRoot.add(object);
          characterObjectRef.current = object;
          setPreviewStatus('');
        } catch (error) {
          clearGroup(loadingRoot);
          disposeThreeObject(object);
          setPreviewStatus(error?.message ? `Modele 3D non affiche: ${error.message}` : 'Modele 3D non affiche.');
          return;
        }
        try {
          const mixer = playGltfAnimations(object, animationClips, {
            timeOffset: performance.now() * 0.001,
            ...getPreviewAnimationOptions(''),
          });
          animationMixersRef.current = mixer ? [mixer] : [];
        } catch (error) {
          animationMixersRef.current = [];
          setPreviewStatus(error?.message ? `Animation incluse non jouee: ${error.message}` : 'Animation incluse non jouee.');
        }
        if (previewSlot) {
          setPreviewStatus('Chargement animation...');
          loadCharacterAnimationClips(model.modelAnimations?.[previewSlot] || {}).then((externalClips) => {
            if (cancelled || characterRoot.userData?.disposed) return;
            setPreviewStatus('');
            if (!externalClips.length) return;
            animationMixersRef.current.forEach((currentMixer) => currentMixer.stopAllAction());
            try {
              const externalMixer = playGltfAnimations(object, externalClips, {
                timeOffset: performance.now() * 0.001,
                ...getPreviewAnimationOptions(previewSlot),
              });
              animationMixersRef.current = externalMixer ? [externalMixer] : [];
            } catch (error) {
              animationMixersRef.current = [];
              setPreviewStatus(error?.message ? `Animation ${previewSlot} non jouee: ${error.message}` : `Animation ${previewSlot} non jouee.`);
            }
          });
        }
      }, (error) => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        setPreviewStatus(error?.message ? `Modele 3D non affiche: ${error.message}` : 'Modele 3D non affiche.');
      });
    } else {
      setPreviewStatus('Aucun modele 3D importe.');
    }
    return () => {
      cancelled = true;
      characterObjectRef.current = null;
      animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
      animationMixersRef.current = [];
    };
  }, [buildSignature, onAnimationClipsLoaded]);

  return (
    <div ref={containerRef} className="character3d-canvas-shell">
      {webglError ? <div className="character3d-webgl-error">{webglError}</div> : null}
      {!webglError && previewStatus ? <div className="character3d-preview-status">{previewStatus}</div> : null}
    </div>
  );
}
