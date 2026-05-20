import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import {
  clearGroup,
  createPreviewFloorCanvas,
  disposeThreeObject,
  getDecorBuildSignature,
  getDecorModelDimensions,
  getDecorModelSources,
  loadThreeDecor,
  makePreviewStandardMaterial,
} from '../../utils/rpg3dModelImport';
import {
  fitObjectToDimensions,
  resetObjectBaseTransform,
} from '../../utils/threeGltfUtils';

const getDecorSizeSignature = (model = {}) => {
  const dimensions = getDecorModelDimensions(model);
  return `${dimensions.x}:${dimensions.y}:${dimensions.z}`;
};

const applyDecorPreviewSize = (decorObject, model = {}) => {
  const modelObject = decorObject?.userData?.decorModelObject;
  if (!modelObject) return;
  resetObjectBaseTransform(modelObject);
  const dimensions = getDecorModelDimensions(model);
  fitObjectToDimensions(modelObject, {
    width: dimensions.x,
    height: dimensions.y,
    depth: dimensions.z,
  }, { groundY: 0 });

  const collisionRing = decorObject.userData?.decorCollisionRing;
  if (collisionRing?.userData?.baseRadius) {
    const nextRadius = Math.max(dimensions.x, dimensions.z);
    const baseRadius = Number(collisionRing.userData.baseRadius) || nextRadius;
    collisionRing.scale.setScalar(Math.max(0.001, nextRadius / baseRadius));
  }
};

export default function Decor3DPreview({ model }) {
  const containerRef = useRef(null);
  const decorRootRef = useRef(null);
  const decorObjectRef = useRef(null);
  const latestModelRef = useRef(model);
  const rendererRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const buildSignature = useMemo(() => getDecorBuildSignature(model), [model]);
  const sizeSignature = useMemo(() => getDecorSizeSignature(model), [model]);

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

    const floorTexture = new THREE.CanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#132033',
      oddColor: '#1d2c43',
      evenColor: '#142238',
      cellLineColor: 'rgba(148, 163, 184, .16)',
      markerColor: 'rgba(103, 232, 249, .2)',
      markerLineWidth: 4,
      markerShape: 'square',
      markerRect: { x: 96, y: 96, width: 320, height: 320 },
    }));
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    const floorMaterial = makePreviewStandardMaterial('#172033', { texture: floorTexture, roughness: 0.9 });
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
      decorObjectRef.current = null;
      clearGroup(decorRoot);
      disposeThreeObject(floor);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      decorRootRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyDecorPreviewSize(decorObjectRef.current, latestModelRef.current);
  }, [sizeSignature]);

  useEffect(() => {
    const decorRoot = decorRootRef.current;
    if (!decorRoot || !model) return undefined;
    let cancelled = false;
    decorObjectRef.current = null;
    clearGroup(decorRoot);
    const sources = getDecorModelSources(model);
    if (sources.length) {
      const loadingRoot = new THREE.Group();
      decorRoot.add(loadingRoot);
      loadThreeDecor(sources, model, (object) => {
        if (cancelled || decorRoot.userData?.disposed) {
          disposeThreeObject(object);
          return;
        }
        clearGroup(loadingRoot);
        loadingRoot.add(object);
        decorObjectRef.current = object;
        applyDecorPreviewSize(object, latestModelRef.current);
      }, () => {
        if (cancelled) return;
        clearGroup(loadingRoot);
      });
    } else {
      clearGroup(decorRoot);
    }
    return () => {
      cancelled = true;
      decorObjectRef.current = null;
    };
  }, [buildSignature]);

  return (
    <div ref={containerRef} className="decor3d-canvas-shell">
      {webglError ? <div className="decor3d-webgl-error">{webglError}</div> : null}
    </div>
  );
}
