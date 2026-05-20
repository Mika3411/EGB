import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import {
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  MODEL_ERASER_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  clamp,
  getActionZoneHeight,
  getActionZoneWidth,
  getCharacterModelScale,
  getHexColor,
  getPropHeight,
  getPropWidth,
  getReliefHeight,
  getReliefWidth,
  getModelEraserRadius,
  getTerrainPaintRadius,
  getTerrainPaintShape,
} from '../../utils/rpg3dDomain.js';
import {
  DEFAULT_ENGINE,
  EDIT_MODEL_ANIMATION_FRAME_MS,
  EDIT_RENDER_PIXEL_RATIO_MAX,
  ENEMY_RADIUS,
  FLOOR_VISUAL_PADDING_WORLD,
  PLAY_RENDER_PIXEL_RATIO_MAX,
  SHADOW_CAMERA_MIN_EXTENT,
  SHADOW_MAP_SIZE,
  WORLD_SCALE,
  addActionZone,
  addActor,
  addBullet,
  addParticle,
  addPickup,
  addProp,
  addRelief,
  addStaticSelectionOverlays,
  addTerrainPaintLayer,
  addWall,
  buildContinuousFloorUvMap,
  clearGroup,
  configureSunShadowCamera,
  createFloorTexture,
  createSupportSurfaceHeightResolver,
  createTerrainPaintPreview,
  disposeObject,
  fromScenePosition,
  getActorVisualSignature,
  getCameraDistance,
  getCameraHeightForDistance,
  getCharacterPreset,
  getCharacterRenderMode,
  getEnemyCharacterId,
  getEngine,
  getEntityKey,
  getEntityLift,
  getEntityLiftHeight,
  getHeroCharacterId,
  getSelectionOverlaySignature,
  getStaticSceneSignature,
  getTerrainPaintLayerSignature,
  isSelectionActive,
  readEntity,
  removeGroupChild,
  toScenePosition,
  updateDynamicTransforms,
  updateSceneLighting,
} from './rpg3dSceneBuilders.js';
import {
  createCachedModelGetter,
  createCachedTextureGetter,
  getActorMovementFacingTarget,
  hashString,
} from './rpg3dRuntimeModels.js';
import {
  DYNAMIC_SELECTION_TYPES,
  applyTransformPreview,
  createTransformGuide,
  createWorldBoxPoints,
  findSelectedPosition,
  getCameraTargetPoint,
  getProjectedBounds,
  getTransformDescriptor,
  getTransformPreviewRoots,
  isCameraTargetEntity,
  isDraggableEntity,
  isSameEntity,
  normalizeScreenRect,
  resetTransformPreview,
  screenRectsIntersect,
} from './rpg3dViewportPicking.js';

const MODEL_ERASER_PREVIEW_COLOR = '#fb923c';

const getEntityRootObject = (object, entity) => {
  let current = object;
  let root = null;
  while (current) {
    if (isSameEntity(readEntity(current), entity)) root = current;
    else if (root) break;
    current = current.parent;
  }
  return root;
};

const createModelEraserSurfacePreview = (radiusWorld, color = MODEL_ERASER_PREVIEW_COLOR) => {
  const radius = Math.max(0.025, Number(radiusWorld) || 0.025);
  const group = new THREE.Group();
  group.userData.previewRadius = radius;
  group.userData.previewColor = color;

  const fill = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      depthTest: false,
    }),
  );
  fill.renderOrder = 97;
  group.add(fill);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(radius, 16, 8)),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    }),
  );
  wire.renderOrder = 98;
  group.add(wire);

  return group;
};

function ArcadeThreeViewport({
  config,
  configRef,
  studioProject = null,
  stateRef,
  mode,
  selected,
  multiSelected = [],
  multiSelectMode = false,
  cameraTargetPickMode = false,
  cameraZoomDragMode = false,
  transformMode = '',
  placementEntity = null,
  dragEnabled = false,
  paintMode = false,
  paintBrushColor = TERRAIN_PAINT_DEFAULT_COLOR,
  paintBrushRadius = TERRAIN_PAINT_DEFAULT_RADIUS,
  paintBrushShape = TERRAIN_PAINT_DEFAULT_SHAPE,
  modelEraserMode = false,
  modelEraserRadius = MODEL_ERASER_DEFAULT_RADIUS,
  onWorldPointer,
  onWorldClick,
  onWorldPaintStart,
  onWorldPaintMove,
  onWorldPaintEnd,
  onModelEraseStart,
  onModelEraseMove,
  onModelEraseEnd,
  onCameraTargetPick,
  onCameraZoomDrag,
  onSelectionTransformCommit,
  resolveWorldDragPoint,
  onWorldDragStart,
  onWorldDrag,
  onWorldDrop,
  onMarqueeSelect,
  onShootChange,
  onUnavailable,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const staticGroupRef = useRef(null);
  const terrainPaintGroupRef = useRef(null);
  const selectionGroupRef = useRef(null);
  const dynamicGroupRef = useRef(null);
  const transformProxyRef = useRef(null);
  const transformGuideRef = useRef(null);
  const transformControlsRef = useRef(null);
  const transformDescriptorRef = useRef(null);
  const transformSessionRef = useRef(null);
  const transformPointerActiveRef = useRef(false);
  const groundRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const aimPointRef = useRef(null);
  const invalidateRenderRef = useRef(() => {});
  const clickStartRef = useRef(null);
  const heldMoveRef = useRef(null);
  const dragRef = useRef(null);
  const paintRef = useRef(null);
  const modelEraserRef = useRef(null);
  const cameraZoomDragRef = useRef(null);
  const playCameraPanOffsetRef = useRef(new THREE.Vector3());
  const playCameraPanStartOffsetRef = useRef(new THREE.Vector3());
  const paintPreviewRef = useRef(null);
  const modelEraserPreviewRef = useRef(null);
  const placementPreviewRef = useRef(null);
  const marqueeRef = useRef(null);
  const textureCacheRef = useRef(new Map());
  const modelCacheRef = useRef(new Map());
  const modelPendingRef = useRef(new Set());
  const modelFailedRef = useRef(new Set());
  const latestRef = useRef({
    config,
    mode,
    selected,
    multiSelected,
    multiSelectMode,
    cameraTargetPickMode,
    cameraZoomDragMode,
    transformMode,
    placementEntity,
    dragEnabled,
    paintMode,
    paintBrushColor,
    paintBrushRadius,
    paintBrushShape,
    modelEraserMode,
    modelEraserRadius,
    onWorldPointer,
    onWorldClick,
    onWorldPaintStart,
    onWorldPaintMove,
    onWorldPaintEnd,
    onModelEraseStart,
    onModelEraseMove,
    onModelEraseEnd,
    onCameraTargetPick,
    onCameraZoomDrag,
    onSelectionTransformCommit,
    resolveWorldDragPoint,
    onWorldDragStart,
    onWorldDrag,
    onWorldDrop,
    onMarqueeSelect,
    onShootChange,
    onUnavailable,
  });
  const cameraReadyRef = useRef(false);
  const lastEditCameraDistanceRef = useRef(null);
  const dynamicFrameRef = useRef({ lastTime: 0, signature: '', forceSignature: '' });
  const [webglError, setWebglError] = useState('');
  const [staticAssetVersion, setStaticAssetVersion] = useState(0);
  const [marqueeRect, setMarqueeRect] = useState(null);
  const studioDecorTextureById = React.useMemo(() => {
    const entries = (studioProject?.decorModels3d || [])
      .filter((model) => model?.id && model.imageData)
      .map((model) => [model.id, {
        imageData: model.imageData,
        imageName: model.imageName || '',
        repeatTexture: Boolean(model.repeatTexture),
      }]);
    return new Map(entries);
  }, [studioProject]);
  const staticSceneSignature = React.useMemo(() => getStaticSceneSignature(config), [
    config.world,
    config.engine?.wallHeight,
    config.engine?.reliefScale,
    config.engine?.propHeight,
    config.obstacles,
    config.reliefs,
    config.actionZones,
    config.props,
  ]);
  const terrainPaintLayerSignature = React.useMemo(() => getTerrainPaintLayerSignature(config), [
    config.world,
    config.terrainPaintStrokes,
  ]);
  const selectionOverlaySignature = React.useMemo(
    () => getSelectionOverlaySignature(config, selected, multiSelected),
    [
      config.world,
      config.engine?.wallHeight,
      config.engine?.reliefScale,
      config.engine?.propHeight,
      config.obstacles,
      config.reliefs,
      config.actionZones,
      config.props,
      selected,
      multiSelected,
    ],
  );

  latestRef.current = {
    config,
    mode,
    selected,
    multiSelected,
    multiSelectMode,
    cameraTargetPickMode,
    cameraZoomDragMode,
    transformMode,
    placementEntity,
    dragEnabled,
    paintMode,
    paintBrushColor,
    paintBrushRadius,
    paintBrushShape,
    modelEraserMode,
    modelEraserRadius,
    onWorldPointer,
    onWorldClick,
    onWorldPaintStart,
    onWorldPaintMove,
    onWorldPaintEnd,
    onModelEraseStart,
    onModelEraseMove,
    onModelEraseEnd,
    onCameraTargetPick,
    onCameraZoomDrag,
    onSelectionTransformCommit,
    resolveWorldDragPoint,
    onWorldDragStart,
    onWorldDrag,
    onWorldDrop,
    onMarqueeSelect,
    onShootChange,
    onUnavailable,
  };

  const getScreenPoint = useCallback((event) => {
    const renderer = rendererRef.current;
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
      viewport: { width: rect.width, height: rect.height },
    };
  }, []);

  const resolvePointer = useCallback((event, { pickEntity = false } = {}) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!renderer || !camera || !scene || !liveConfig) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(pointerRef.current, camera);

    const entityHit = pickEntity
      ? raycaster
        .intersectObjects([staticGroupRef.current, selectionGroupRef.current, dynamicGroupRef.current].filter(Boolean), true)
        .map((hit) => readEntity(hit.object))
        .find(Boolean)
      : null;
    const groundPoint = new THREE.Vector3();
    const hitGround = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), groundPoint);
    if (!hitGround) return null;
    return {
      point: fromScenePosition(liveConfig, groundPoint),
      entity: entityHit,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    };
  }, [configRef]);

  const resolveSelectedModelHit = useCallback((event) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const staticGroup = staticGroupRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    const selectedEntity = latestRef.current.selected;
    if (!renderer || !camera || !staticGroup || !liveConfig?.world || selectedEntity?.type !== 'prop' || !selectedEntity.id) {
      return null;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(pointerRef.current, camera);
    const hit = raycaster
      .intersectObjects([staticGroup], true)
      .find((candidate) => (
        (candidate.object?.isMesh || candidate.object?.isSkinnedMesh)
        && candidate.object?.userData?.rpg3dModelEraserSurface === true
        && isSameEntity(readEntity(candidate.object), selectedEntity)
      ));
    if (!hit?.point) return null;
    const root = getEntityRootObject(hit.object, selectedEntity);
    root?.updateWorldMatrix?.(true, false);
    hit.object?.updateWorldMatrix?.(true, false);
    const localScenePoint = root?.worldToLocal?.(hit.point.clone()) || null;
    const localMeshPoint = hit.object?.worldToLocal?.(hit.point.clone()) || null;
    const point = fromScenePosition(liveConfig, hit.point);
    return {
      point,
      entity: { type: selectedEntity.type, id: selectedEntity.id },
      x: point.x,
      y: point.y,
      sceneX: hit.point.x,
      sceneY: hit.point.y,
      sceneZ: hit.point.z,
      localSceneX: localScenePoint?.x,
      localSceneY: localScenePoint?.y,
      localSceneZ: localScenePoint?.z,
      localMeshX: localMeshPoint?.x,
      localMeshY: localMeshPoint?.y,
      localMeshZ: localMeshPoint?.z,
      surfaceIndex: hit.object?.userData?.rpg3dModelEraserSurfaceIndex,
      materialIndex: hit.face?.materialIndex ?? 0,
      uvX: hit.uv?.x,
      uvY: hit.uv?.y,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    };
  }, [configRef]);

  const hidePaintPreview = useCallback(() => {
    if (!paintPreviewRef.current) return;
    removeGroupChild(sceneRef.current, paintPreviewRef.current);
    paintPreviewRef.current = null;
    invalidateRenderRef.current({ followupFrames: 1 });
  }, []);

  const updatePaintPreview = useCallback((point) => {
    const scene = sceneRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    const latest = latestRef.current;
    if (!scene || !liveConfig || !point || latest.mode === 'play' || !latest.paintMode) {
      hidePaintPreview();
      return;
    }
    const color = getHexColor(latest.paintBrushColor, TERRAIN_PAINT_DEFAULT_COLOR);
    const radius = getTerrainPaintRadius({ radius: latest.paintBrushRadius });
    const shape = getTerrainPaintShape({ shape: latest.paintBrushShape });
    const radiusWorld = radius * WORLD_SCALE;
    const current = paintPreviewRef.current;
    const shouldRebuild = !current
      || Math.abs((current.userData.previewRadius || 0) - radiusWorld) > 0.001
      || current.userData.previewColor !== color
      || current.userData.previewShape !== shape;
    if (shouldRebuild) {
      if (current) removeGroupChild(scene, current);
      paintPreviewRef.current = createTerrainPaintPreview(radius, color, shape);
      scene.add(paintPreviewRef.current);
    }
    paintPreviewRef.current.position.copy(toScenePosition(liveConfig, point.x, point.y, 0.092));
    paintPreviewRef.current.visible = true;
    invalidateRenderRef.current({ followupFrames: 1 });
  }, [configRef, hidePaintPreview]);

  const hideModelEraserPreview = useCallback(() => {
    if (!modelEraserPreviewRef.current) return;
    removeGroupChild(sceneRef.current, modelEraserPreviewRef.current);
    modelEraserPreviewRef.current = null;
    invalidateRenderRef.current({ followupFrames: 1 });
  }, []);

  const updateModelEraserPreview = useCallback((hit) => {
    const scene = sceneRef.current;
    const latest = latestRef.current;
    const sceneX = Number(hit?.sceneX);
    const sceneY = Number(hit?.sceneY);
    const sceneZ = Number(hit?.sceneZ);
    if (
      !scene
      || !Number.isFinite(sceneX)
      || !Number.isFinite(sceneY)
      || !Number.isFinite(sceneZ)
      || latest.mode === 'play'
      || !latest.modelEraserMode
    ) {
      hideModelEraserPreview();
      return;
    }
    const color = MODEL_ERASER_PREVIEW_COLOR;
    const radius = getModelEraserRadius({ modelEraserRadius: latest.modelEraserRadius });
    const radiusWorld = radius * WORLD_SCALE;
    const current = modelEraserPreviewRef.current;
    const shouldRebuild = !current
      || Math.abs((current.userData.previewRadius || 0) - radiusWorld) > 0.001
      || current.userData.previewColor !== color;
    if (shouldRebuild) {
      if (current) removeGroupChild(scene, current);
      modelEraserPreviewRef.current = createModelEraserSurfacePreview(radiusWorld, color);
      scene.add(modelEraserPreviewRef.current);
    }
    modelEraserPreviewRef.current.position.set(sceneX, sceneY, sceneZ);
    modelEraserPreviewRef.current.visible = true;
    invalidateRenderRef.current({ followupFrames: 1 });
  }, [hideModelEraserPreview]);

  const getEntitiesInMarquee = useCallback((rect) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!renderer || !camera || !liveConfig || !rect) return [];
    const viewport = renderer.domElement.getBoundingClientRect();
    if (!viewport.width || !viewport.height) return [];
    const selectedEntities = [];
    const addIfInside = (entity, points) => {
      const bounds = getProjectedBounds(liveConfig, camera, viewport, points);
      if (bounds && screenRectsIntersect(bounds, rect)) selectedEntities.push(entity);
    };

    (liveConfig.heroes || []).forEach((hero) => {
      addIfInside({ type: 'hero', id: hero.id }, createWorldBoxPoints(hero.x, hero.y, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2));
    });
    (liveConfig.enemies || []).forEach((enemy) => {
      addIfInside({ type: 'enemy', id: enemy.id }, createWorldBoxPoints(enemy.x, enemy.y, ENEMY_RADIUS * 2, ENEMY_RADIUS * 2));
    });
    (liveConfig.pickups || []).forEach((pickup) => {
      addIfInside({ type: 'pickup', id: pickup.id }, createWorldBoxPoints(pickup.x, pickup.y, PICKUP_RADIUS * 2, PICKUP_RADIUS * 2));
    });
    (liveConfig.obstacles || []).forEach((obstacle) => {
      addIfInside(
        { type: 'obstacle', id: obstacle.id },
        createWorldBoxPoints(
          (Number(obstacle.x) || 0) + getPropWidth(obstacle) / 2,
          (Number(obstacle.y) || 0) + getPropHeight(obstacle) / 2,
          getPropWidth(obstacle),
          getPropHeight(obstacle),
        ),
      );
    });
    (liveConfig.reliefs || []).forEach((relief) => {
      addIfInside({ type: 'relief', id: relief.id }, createWorldBoxPoints(relief.x, relief.y, getReliefWidth(relief), getReliefHeight(relief)));
    });
    (liveConfig.actionZones || []).forEach((zone) => {
      addIfInside({ type: 'actionZone', id: zone.id }, createWorldBoxPoints(zone.x, zone.y, getActionZoneWidth(zone), getActionZoneHeight(zone)));
    });
    (liveConfig.props || []).forEach((prop) => {
      addIfInside({ type: 'prop', id: prop.id }, createWorldBoxPoints(prop.x, prop.y, getPropWidth(prop), getPropHeight(prop)));
    });

    return selectedEntities;
  }, [configRef]);

  const setCameraTargetFromEntity = useCallback((entity) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!camera || !controls || !liveConfig || !isCameraTargetEntity(entity)) return false;
    const targetPoint = getCameraTargetPoint(liveConfig, entity, getEngine(liveConfig));
    if (!targetPoint) return false;
    const engine = getEngine(liveConfig);
    const nextTarget = toScenePosition(liveConfig, targetPoint.x, targetPoint.y, targetPoint.height ?? 0.65);
    const viewOffset = camera.position.clone().sub(controls.target);
    const desiredDistance = getCameraDistance(engine);
    if (viewOffset.lengthSq() < 0.0001) {
      const height = getCameraHeightForDistance(engine, desiredDistance);
      viewOffset.set(-desiredDistance * 0.65, height, desiredDistance * 0.78);
    } else if (viewOffset.length() < desiredDistance) {
      viewOffset.normalize().multiplyScalar(desiredDistance);
    }
    controls.target.copy(nextTarget);
    camera.position.copy(nextTarget).add(viewOffset);
    controls.update();
    cameraReadyRef.current = true;
    invalidateRenderRef.current({ followupFrames: 8 });
    return true;
  }, [configRef]);

  const findEntityRoots = useCallback((entity) => {
    if (!isDraggableEntity(entity)) return [];
    const roots = [];
    [staticGroupRef.current, selectionGroupRef.current, dynamicGroupRef.current].filter(Boolean).forEach((group) => {
      group.children.forEach((child) => {
        if (child.userData?.entityType === entity.type && child.userData?.entityId === entity.id) {
          roots.push(child);
        }
      });
    });
    return roots;
  }, []);

  const createDragPreviewTargets = useCallback((draggedEntity) => {
    const latest = latestRef.current;
    const liveConfig = configRef.current || latest.config;
    const activeEntity = { type: draggedEntity?.type, id: draggedEntity?.id };
    const dragEntities = latest.multiSelected?.some((entry) => isSameEntity(entry, activeEntity))
      ? latest.multiSelected.filter(isDraggableEntity)
      : [activeEntity].filter(isDraggableEntity);

    return dragEntities
      .map((entity) => {
        const startWorld = findSelectedPosition(liveConfig, entity);
        if (!startWorld) return null;
        return {
          entity,
          roots: findEntityRoots(entity).map((root) => ({
            root,
            startPosition: root.position.clone(),
          })),
          startWorld,
        };
      })
      .filter(Boolean);
  }, [configRef, findEntityRoots]);

  const applyDragPreview = useCallback((drag, point) => {
    if (!drag || !point) return;
    const delta = {
      x: point.x - drag.anchor.x,
      y: point.y - drag.anchor.y,
    };
    const sceneDelta = new THREE.Vector3(delta.x * WORLD_SCALE, 0, delta.y * WORLD_SCALE);

    drag.previewTargets.forEach((target) => {
      const activeRoots = target.roots.filter(({ root }) => root.parent);
      if (activeRoots.length !== target.roots.length || activeRoots.length === 0) {
        target.roots = findEntityRoots(target.entity).map((root) => ({
          root,
          startPosition: root.position.clone(),
        }));
      }
      target.roots.forEach(({ root, startPosition }) => {
        root.position.copy(startPosition).add(sceneDelta);
      });
    });
  }, [findEntityRoots]);

  const resetDragPreview = useCallback((drag) => {
    drag?.previewTargets?.forEach((target) => {
      target.roots.forEach(({ root, startPosition }) => {
        if (root.parent) root.position.copy(startPosition);
      });
    });
  }, []);

  const applyPlacementPreview = useCallback((entity, point) => {
    if (!entity?.type || !entity.id || !point) return;
    const key = getEntityKey(entity);
    const liveConfig = configRef.current || latestRef.current.config;
    if (!key || !liveConfig) return;
    if (placementPreviewRef.current?.key !== key) {
      resetDragPreview(placementPreviewRef.current);
      placementPreviewRef.current = {
        key,
        entity,
        anchor: findSelectedPosition(liveConfig, entity) || point,
        previewTargets: createDragPreviewTargets(entity),
      };
    }
    applyDragPreview(placementPreviewRef.current, point);
    invalidateRenderRef.current({ followupFrames: 1 });
  }, [applyDragPreview, configRef, createDragPreviewTargets, resetDragPreview]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('La vue 3D est indisponible pour le moment.');
      latestRef.current.onUnavailable?.();
      return undefined;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor('#081521', 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'arcade-three-canvas';
    const handleContextLost = (event) => {
      event.preventDefault();
      setWebglError('La vue 3D a ete suspendue par le navigateur.');
      latestRef.current.onUnavailable?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#081521');
    scene.fog = new THREE.FogExp2('#081521', 0.012);
    sceneRef.current = scene;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
    camera.position.set(-18, 16, 18);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 2.6;
      controls.maxDistance = 90;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;
    const canUseOrbitControls = () => {
      const latest = latestRef.current;
      return latest.mode !== 'play'
        && !latest.dragEnabled
        && !latest.multiSelectMode
        && !latest.cameraTargetPickMode
        && !latest.cameraZoomDragMode
        && !latest.placementEntity
        && !latest.paintMode
        && !latest.modelEraserMode
        && !dragRef.current
        && !paintRef.current
        && !modelEraserRef.current
        && !marqueeRef.current
        && !transformPointerActiveRef.current
        && !transformSessionRef.current
        && !transformControlsRef.current?.dragging;
    };
    const canUseRightButtonPanControls = () => true;
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
      enabled: canUseRightButtonPanControls,
      onPanStart: () => {
        playCameraPanStartOffsetRef.current.copy(playCameraPanOffsetRef.current);
      },
      onPanMove: (offset) => {
        if (latestRef.current.mode !== 'play') return;
        playCameraPanOffsetRef.current.copy(playCameraPanStartOffsetRef.current).add(offset);
      },
    });

    const staticGroup = new THREE.Group();
    const terrainPaintGroup = new THREE.Group();
    const selectionGroup = new THREE.Group();
    const dynamicGroup = new THREE.Group();
    staticGroupRef.current = staticGroup;
    terrainPaintGroupRef.current = terrainPaintGroup;
    selectionGroupRef.current = selectionGroup;
    dynamicGroupRef.current = dynamicGroup;
    scene.add(staticGroup);
    scene.add(terrainPaintGroup);
    scene.add(selectionGroup);
    scene.add(dynamicGroup);

    const hemi = new THREE.HemisphereLight('#fff7ea', '#211814', 1.02);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e6', 1.95);
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
    const frontFill = new THREE.DirectionalLight('#f7f3ec', 0.55);
    frontFill.position.set(18, 14, 24);
    scene.add(frontFill);
    const rim = new THREE.DirectionalLight('#ffe0bd', 0.16);
    rim.position.set(20, 18, -24);
    scene.add(rim);
    const ambient = new THREE.AmbientLight('#fff3e0', 0.08);
    scene.add(ambient);
    scene.userData.hemi = hemi;
    scene.userData.sun = sun;
    scene.userData.frontFill = frontFill;
    scene.userData.rim = rim;
    scene.userData.ambient = ambient;

    const transformProxy = new THREE.Object3D();
    transformProxy.visible = false;
    scene.add(transformProxy);
    transformProxyRef.current = transformProxy;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.enabled = false;
    transformControls.setSpace('local');
    transformControls.getHelper().visible = false;
    transformControls.addEventListener('change', () => {
      invalidateRenderRef.current({ followupFrames: 2 });
    });
    transformControls.addEventListener('mouseDown', () => {
      const descriptor = transformDescriptorRef.current;
      transformPointerActiveRef.current = true;
      clickStartRef.current = null;
      if (!descriptor || !transformProxyRef.current) return;
      transformSessionRef.current = {
        entity: descriptor.entity,
        mode: latestRef.current.transformMode,
        startRotation: transformProxyRef.current.rotation.clone(),
        startScale: transformProxyRef.current.scale.clone(),
        startProxyQuaternion: transformProxyRef.current.quaternion.clone(),
        startProxyScale: transformProxyRef.current.scale.clone(),
        previewRoots: getTransformPreviewRoots(findEntityRoots(descriptor.entity), descriptor),
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
    });
    transformControls.addEventListener('objectChange', () => {
      applyTransformPreview(transformSessionRef.current, transformProxyRef.current);
      invalidateRenderRef.current({ followupFrames: 1 });
    });
    transformControls.addEventListener('mouseUp', () => {
      const session = transformSessionRef.current;
      const proxy = transformProxyRef.current;
      if (session && proxy) {
        const scaleRatio = (axis) => {
          const start = Math.max(0.001, session.startScale[axis]);
          const value = proxy.scale[axis] / start;
          return Number.isFinite(value) ? value : 1;
        };
        latestRef.current.onSelectionTransformCommit?.({
          entity: session.entity,
          mode: session.mode,
          rotationDelta: {
            x: THREE.MathUtils.radToDeg(proxy.rotation.x - session.startRotation.x),
            y: THREE.MathUtils.radToDeg(proxy.rotation.y - session.startRotation.y),
            z: THREE.MathUtils.radToDeg(proxy.rotation.z - session.startRotation.z),
          },
          scaleDelta: {
            x: scaleRatio('x'),
            y: scaleRatio('y'),
            z: scaleRatio('z'),
          },
        });
      }
      transformSessionRef.current = null;
      window.setTimeout(() => {
        transformPointerActiveRef.current = false;
      }, 0);
      invalidateRenderRef.current({ followupFrames: 2 });
    });
    transformControls.addEventListener('dragging-changed', (event) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value && canUseOrbitControls();
      }
    });
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    let frameId = 0;
    let renderQueued = false;
    let editFollowupFrames = 0;
    let lastResizeCheck = 0;
    let previousAnimationTime = 0;
    let editAnimationTimer = 0;
    const resize = (timestamp = 0) => {
      if (timestamp && timestamp - lastResizeCheck < 250) return;
      lastResizeCheck = timestamp;
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(280, container.clientHeight);
      const canvas = renderer.domElement;
      if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    const queueRender = ({ followupFrames = 0 } = {}) => {
      editFollowupFrames = Math.max(editFollowupFrames, followupFrames);
      if (editAnimationTimer) {
        window.clearTimeout(editAnimationTimer);
        editAnimationTimer = 0;
      }
      if (renderQueued) return;
      renderQueued = true;
      frameId = requestAnimationFrame(render);
    };
    invalidateRenderRef.current = queueRender;

    const hasAnimationMixers = () => Boolean(
      staticGroup.userData.animationMixers?.length
      || dynamicGroup.userData.animationMixers?.length,
    );

    const queueEditAnimationRender = (timestamp = 0) => {
      if (renderQueued || editAnimationTimer) return;
      const elapsed = previousAnimationTime ? timestamp - previousAnimationTime : EDIT_MODEL_ANIMATION_FRAME_MS;
      const delay = Math.max(0, EDIT_MODEL_ANIMATION_FRAME_MS - elapsed);
      editAnimationTimer = window.setTimeout(() => {
        editAnimationTimer = 0;
        queueRender();
      }, delay);
    };

    const handleControlsChange = () => {
      if (latestRef.current.mode !== 'play') queueRender({ followupFrames: 10 });
    };
    controls.addEventListener('change', handleControlsChange);

    const render = (timestamp = 0) => {
      renderQueued = false;
      const liveConfig = configRef.current || latestRef.current.config;
      const state = stateRef.current;
      const latest = latestRef.current;
      const playMode = latest.mode === 'play';
      if (!liveConfig || !state) {
        if (playMode) queueRender();
        return;
      }
      const hasMixers = hasAnimationMixers();
      const shouldAnimate = playMode || editFollowupFrames > 0 || hasMixers;
      const maxAnimationDelta = playMode ? 0.05 : 0.15;
      const animationDelta = shouldAnimate && previousAnimationTime
        ? Math.min(maxAnimationDelta, (timestamp - previousAnimationTime) / 1000)
        : 0;
      previousAnimationTime = timestamp;
      staticGroup.userData.animationMixers?.forEach((mixer) => mixer.update(animationDelta));
      dynamicGroup.userData.animationMixers?.forEach((mixer) => mixer.update(animationDelta));
      const engine = getEngine(liveConfig);
      const player = playMode ? state.player : liveConfig.player;
      const getActorSupportHeight = createSupportSurfaceHeightResolver(liveConfig);
      const selectedPosition = !playMode ? findSelectedPosition(liveConfig, latest.selected) : null;
      const editFocus = { x: liveConfig.world.width * 0.5, y: liveConfig.world.height * 0.48 };
      const selectedEditFocus = selectedPosition ? {
        x: clamp(selectedPosition.x, liveConfig.world.width * 0.22, liveConfig.world.width * 0.78),
        y: clamp(selectedPosition.y, liveConfig.world.height * 0.22, liveConfig.world.height * 0.78),
      } : null;
      const focus = playMode ? player : (selectedEditFocus || editFocus);
      const focusHeight = playMode
        ? getActorSupportHeight(player) + getEntityLiftHeight(player) + 0.72
        : 0.65;
      const target = toScenePosition(liveConfig, focus.x, focus.y, focusHeight);
      const playCameraTarget = playMode ? target.clone().add(playCameraPanOffsetRef.current) : target;

      const nextPixelRatio = Math.min(window.devicePixelRatio || 1, playMode ? PLAY_RENDER_PIXEL_RATIO_MAX : EDIT_RENDER_PIXEL_RATIO_MAX);
      if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);
      renderer.shadowMap.autoUpdate = !playMode;
      if (!playMode) renderer.shadowMap.needsUpdate = true;
      resize(timestamp);
      updateSceneLighting(scene, engine);
      controls.enabled = canUseOrbitControls();

      if (playMode) {
        const distance = getCameraDistance(engine);
        const height = getCameraHeightForDistance(engine, distance);
        const offset = new THREE.Vector3(-distance * 0.48, height, distance * 0.72);
        controls.target.copy(playCameraTarget);
        camera.position.lerp(playCameraTarget.clone().add(offset), 0.12);
        camera.lookAt(playCameraTarget);
        lastEditCameraDistanceRef.current = null;
      } else {
        const distance = getCameraDistance(engine);
        if (!cameraReadyRef.current) {
          const height = getCameraHeightForDistance(engine, distance);
          camera.position.copy(target.clone().add(new THREE.Vector3(-distance * 0.65, height, distance * 0.78)));
          controls.target.copy(target);
          cameraReadyRef.current = true;
          lastEditCameraDistanceRef.current = distance;
        } else if (lastEditCameraDistanceRef.current !== distance) {
          const direction = camera.position.clone().sub(controls.target);
          if (direction.lengthSq() < 0.0001) direction.set(-0.45, 0.42, 0.68);
          direction.normalize();
          camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
          lastEditCameraDistanceRef.current = distance;
        }
      }
      controls.update();

      const now = performance.now();
      const dynamicSelectedKey = [
        DYNAMIC_SELECTION_TYPES.has(latest.selected?.type) ? `${latest.selected.type}:${latest.selected.id}` : 'none',
        (latest.multiSelected || [])
          .filter((entry) => DYNAMIC_SELECTION_TYPES.has(entry?.type))
          .map(getEntityKey)
          .sort()
          .join(','),
      ].join('|');
      const controlledHeroId = playMode ? state.player?.controlledHeroId : '';
      const dynamicHeroes = (liveConfig.heroes || []).filter((hero) => hero.id !== controlledHeroId);
      const dynamicEnemies = playMode ? state.enemies : liveConfig.enemies;
      const dynamicPickups = playMode ? state.pickups : liveConfig.pickups;
      if (playMode) {
        updateDynamicTransforms(dynamicGroup, liveConfig, state, {
          playMode,
          getSupportHeight: getActorSupportHeight,
        });
      }
      const heroVisualSignature = dynamicHeroes.map((hero) => [
        getActorVisualSignature(hero),
        playMode ? '' : `${Math.round(hero.x)}:${Math.round(hero.y)}`,
      ].join(':')).join(';');
      const enemyVisualSignature = dynamicEnemies.map((enemy) => [
        enemy.id,
        enemy.alert ? 1 : 0,
        playMode ? '' : `${Math.round(enemy.x)}:${Math.round(enemy.y)}`,
        getActorVisualSignature(enemy),
      ].join(':')).join(';');
      const pickupVisualSignature = dynamicPickups.map((pickup) => [
        pickup.id,
        pickup.type,
        Math.round(getEntityLift(pickup)),
        playMode ? '' : `${Math.round(pickup.x)}:${Math.round(pickup.y)}`,
      ].join(':')).join(';');
      const forceSignature = [
        latest.mode,
        dynamicSelectedKey,
        controlledHeroId,
        playMode ? getActorVisualSignature(state.player) : '',
        heroVisualSignature,
        enemyVisualSignature,
        pickupVisualSignature,
      ].join('|');
      const dynamicSignature = forceSignature;
      const minInterval = playMode ? 90 : 1000;
      const shouldRefreshDynamic = dynamicFrameRef.current.forceSignature !== forceSignature
        || (
          dynamicFrameRef.current.signature !== dynamicSignature
          && now - dynamicFrameRef.current.lastTime > minInterval
        );

      if (shouldRefreshDynamic) {
        dynamicFrameRef.current = { signature: dynamicSignature, forceSignature, lastTime: now };
        const getTexture = createCachedTextureGetter(textureCacheRef.current);
        const getModel = createCachedModelGetter(modelCacheRef.current, modelPendingRef.current, modelFailedRef.current, () => {
          dynamicFrameRef.current.forceSignature = '';
          queueRender({ followupFrames: 2 });
        });
        clearGroup(dynamicGroup);

        dynamicPickups.forEach((pickup) => addPickup(dynamicGroup, liveConfig, pickup, isSelectionActive('pickup', pickup.id, latest.selected, latest.multiSelected), state.time || 0));

        state.bullets.forEach((bullet) => addBullet(dynamicGroup, liveConfig, bullet));
        state.particles.forEach((particle, index) => addParticle(dynamicGroup, liveConfig, particle, index));

        dynamicHeroes.forEach((hero) => {
          addActor(dynamicGroup, liveConfig, hero, {
            type: 'hero',
            id: hero.id,
            radius: PLAYER_RADIUS,
            preset: getCharacterPreset(getHeroCharacterId(hero), 'runner'),
            selected: isSelectionActive('hero', hero.id, latest.selected, latest.multiSelected),
            active: false,
            imageData: hero.characterImageData,
            renderMode: getCharacterRenderMode(hero),
            modelScale: getCharacterModelScale(hero),
            animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(hero.id || 'hero')) * 0.001,
            aimTarget: playMode ? state.player : liveConfig.player,
            getTexture,
            getModel,
            useStoredRotation: true,
            editMode: !playMode,
            supportHeight: getActorSupportHeight(hero),
          });
        });

        dynamicEnemies.forEach((enemy) => {
          const enemyPreset = getCharacterPreset(getEnemyCharacterId(enemy), 'guard');
          const aimTarget = playMode ? state.player : liveConfig.player;
          addActor(dynamicGroup, liveConfig, enemy, {
            type: 'enemy',
            id: enemy.id,
            radius: ENEMY_RADIUS,
            preset: enemyPreset,
            selected: isSelectionActive('enemy', enemy.id, latest.selected, latest.multiSelected),
            active: Boolean(enemy.alert),
            imageData: enemy.characterImageData,
            renderMode: getCharacterRenderMode(enemy),
            modelScale: getCharacterModelScale(enemy),
            animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(enemy.id || 'enemy')) * 0.001,
            aimTarget,
            getTexture,
            getModel,
            useStoredRotation: !playMode,
            editMode: !playMode,
            supportHeight: getActorSupportHeight(enemy),
          });
        });

        if (playMode) {
          const playerVisualActor = { ...liveConfig.player, ...player };
          const playerEntityType = controlledHeroId ? 'hero' : 'player';
          const playerEntityId = controlledHeroId || 'player';
          addActor(dynamicGroup, liveConfig, playerVisualActor, {
            type: playerEntityType,
            id: playerEntityId,
            radius: PLAYER_RADIUS,
            preset: getCharacterPreset(getHeroCharacterId(playerVisualActor), 'runner'),
            selected: isSelectionActive(playerEntityType, playerEntityId, latest.selected, latest.multiSelected),
            active: player.dash > 0,
            imageData: playerVisualActor.characterImageData,
            renderMode: getCharacterRenderMode(playerVisualActor),
            modelScale: getCharacterModelScale(playerVisualActor),
            animationTime: state.time || timestamp * 0.001,
            aimTarget: getActorMovementFacingTarget(playerVisualActor),
            getTexture,
            getModel,
            editMode: false,
            supportHeight: getActorSupportHeight(playerVisualActor),
          });
        }
      }

      renderer.render(scene, camera);
      if (playMode) {
        queueRender();
      } else {
        if (editFollowupFrames > 0) editFollowupFrames -= 1;
        if (editFollowupFrames > 0) {
          queueRender();
        } else if (hasMixers) {
          queueEditAnimationRender(timestamp);
        }
      }
    };

    queueRender({ followupFrames: 2 });

    return () => {
      heldMoveRef.current = null;
      clickStartRef.current = null;
      latestRef.current.onShootChange?.(false);
      cancelAnimationFrame(frameId);
      if (editAnimationTimer) window.clearTimeout(editAnimationTimer);
      invalidateRenderRef.current = () => {};
      controls.removeEventListener('change', handleControlsChange);
      detachCameraControls();
      controls.dispose();
      clearGroup(staticGroup);
      clearGroup(terrainPaintGroup);
      clearGroup(selectionGroup);
      clearGroup(dynamicGroup);
      textureCacheRef.current.forEach((texture) => texture.dispose());
      textureCacheRef.current.clear();
      modelCacheRef.current.forEach((object) => disposeObject(object));
      modelCacheRef.current.clear();
      modelPendingRef.current.clear();
      modelFailedRef.current.clear();
      transformControls.detach();
      scene.remove(transformControls.getHelper());
      transformControls.dispose();
      transformControlsRef.current = null;
      if (transformGuideRef.current) {
        transformProxy.remove(transformGuideRef.current);
        disposeObject(transformGuideRef.current);
        transformGuideRef.current = null;
      }
      if (paintPreviewRef.current) {
        removeGroupChild(scene, paintPreviewRef.current);
        paintPreviewRef.current = null;
      }
      scene.remove(transformProxy);
      transformProxyRef.current = null;
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      staticGroupRef.current = null;
      terrainPaintGroupRef.current = null;
      selectionGroupRef.current = null;
      dynamicGroupRef.current = null;
    };
  }, [configRef, stateRef]);

  useEffect(() => {
    playCameraPanOffsetRef.current.set(0, 0, 0);
    playCameraPanStartOffsetRef.current.set(0, 0, 0);
    if (mode === 'play') return;
    heldMoveRef.current = null;
    clickStartRef.current = null;
    latestRef.current.onShootChange?.(false);
  }, [mode]);

  useEffect(() => {
    if (mode === 'edit' && paintMode) return;
    if (paintRef.current) latestRef.current.onWorldPaintEnd?.();
    paintRef.current = null;
    hidePaintPreview();
  }, [hidePaintPreview, mode, paintMode]);

  useEffect(() => {
    if (mode === 'edit' && modelEraserMode) return;
    if (modelEraserRef.current) latestRef.current.onModelEraseEnd?.();
    modelEraserRef.current = null;
    hideModelEraserPreview();
  }, [hideModelEraserPreview, mode, modelEraserMode]);

  useEffect(() => {
    if (mode !== 'edit' || !paintMode) {
      hidePaintPreview();
      return;
    }
    if (aimPointRef.current) updatePaintPreview(aimPointRef.current);
  }, [hidePaintPreview, mode, paintBrushColor, paintBrushRadius, paintBrushShape, paintMode, updatePaintPreview]);

  useEffect(() => {
    if (mode !== 'edit' || !modelEraserMode) {
      hideModelEraserPreview();
      return;
    }
    hideModelEraserPreview();
  }, [hideModelEraserPreview, mode, modelEraserMode, modelEraserRadius]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const scene = sceneRef.current;
    const staticGroup = staticGroupRef.current;
    if (!scene || !staticGroup || !liveConfig) return;
    const engine = getEngine(liveConfig);
    configureSunShadowCamera(scene.userData.sun, liveConfig);
    const getTexture = createCachedTextureGetter(textureCacheRef.current);
    const getModel = createCachedModelGetter(modelCacheRef.current, modelPendingRef.current, modelFailedRef.current, () => {
      setStaticAssetVersion((version) => version + 1);
      invalidateRenderRef.current({ followupFrames: 2 });
    });
    clearGroup(staticGroup);

    const floorTexture = createFloorTexture();
    const floorVisualPadding = Math.max(
      FLOOR_VISUAL_PADDING_WORLD,
      (Number(liveConfig.world?.width) || 0) * 0.75,
      (Number(liveConfig.world?.height) || 0) * 0.75,
    );
    const floorVisualWidth = Math.max(1, (Number(liveConfig.world?.width) || 1) + floorVisualPadding * 2);
    const floorVisualHeight = Math.max(1, (Number(liveConfig.world?.height) || 1) + floorVisualPadding * 2);
    floorTexture.repeat.set(
      Math.max(1, floorVisualWidth / Math.max(240, liveConfig.world.grid * 2)),
      Math.max(1, floorVisualHeight / Math.max(240, liveConfig.world.grid * 2)),
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.92,
      metalness: 0,
      emissive: '#071016',
      emissiveIntensity: 0.08,
    });
    floorMaterial.userData.disposeTextures = true;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorVisualWidth * WORLD_SCALE, floorVisualHeight * WORLD_SCALE),
      floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.ground = true;
    groundRef.current = floor;
    staticGroup.add(floor);

    const gridSize = Math.max(liveConfig.world.width, liveConfig.world.height) * WORLD_SCALE;
    const grid = new THREE.GridHelper(
      gridSize,
      Math.max(8, Math.round(Math.max(liveConfig.world.width, liveConfig.world.height) / liveConfig.world.grid)),
      '#67e8f9',
      '#314052',
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    grid.material.depthWrite = false;
    grid.material.depthFunc = THREE.LessDepth;
    grid.position.y = 0.018;
    staticGroup.add(grid);

    liveConfig.obstacles.forEach((obstacle) => {
      addWall(staticGroup, liveConfig, obstacle, engine, false);
    });

    (liveConfig.reliefs || []).forEach((relief) => {
      addRelief(staticGroup, liveConfig, relief, engine, false);
    });

    (liveConfig.actionZones || []).forEach((zone) => {
      addActionZone(staticGroup, liveConfig, zone, { playMode: mode === 'play' });
    });

    const renderedProps = liveConfig.props.map((prop) => {
      const studioTexture = prop.decorModel3dId && !prop.imageData
        ? studioDecorTextureById.get(prop.decorModel3dId)
        : null;
      return studioTexture ? { ...prop, ...studioTexture } : prop;
    });
    const continuousFloorUvMap = buildContinuousFloorUvMap(renderedProps);

    renderedProps.forEach((renderedProp) => {
      addProp(
        staticGroup,
        liveConfig,
        renderedProp,
        engine,
        false,
        getTexture,
        getModel,
        { floorUv: continuousFloorUvMap.get(renderedProp.id) || null },
      );
    });
    dynamicFrameRef.current.signature = '';
    dynamicFrameRef.current.forceSignature = '';
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [configRef, mode, staticAssetVersion, staticSceneSignature, studioDecorTextureById]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const terrainPaintGroup = terrainPaintGroupRef.current;
    if (!terrainPaintGroup || !liveConfig) return;
    clearGroup(terrainPaintGroup);
    addTerrainPaintLayer(terrainPaintGroup, liveConfig);
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [configRef, terrainPaintLayerSignature]);

  useEffect(() => {
    const scene = sceneRef.current;
    const liveConfig = configRef.current || config;
    if (!scene || !liveConfig) return;
    updateSceneLighting(scene, getEngine(liveConfig));
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [configRef, config.engine?.lightIntensity, config.engine?.lightOrientation]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const selectionGroup = selectionGroupRef.current;
    if (!selectionGroup || !liveConfig) return;
    clearGroup(selectionGroup);
    addStaticSelectionOverlays(selectionGroup, liveConfig, selected, multiSelected);
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [configRef, selectionOverlaySignature]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const proxy = transformProxyRef.current;
    const controls = transformControlsRef.current;
    if (!proxy || !controls || !liveConfig) return;
    const clearTransformGizmo = () => {
      transformDescriptorRef.current = null;
      if (transformGuideRef.current) {
        proxy.remove(transformGuideRef.current);
        disposeObject(transformGuideRef.current);
        transformGuideRef.current = null;
      }
      controls.detach();
      controls.enabled = false;
      controls.getHelper().visible = false;
      controls.axis = null;
      proxy.visible = false;
    };

    const transformToolActive = mode === 'edit' && (transformMode === 'rotate' || transformMode === 'scale');
    if (!transformToolActive) {
      resetTransformPreview(transformSessionRef.current);
      transformSessionRef.current = null;
      transformPointerActiveRef.current = false;
      clearTransformGizmo();
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }

    if (transformSessionRef.current) return;

    const descriptor = getTransformDescriptor(liveConfig, selected, multiSelected, transformMode);
    transformDescriptorRef.current = descriptor;

    if (transformGuideRef.current) {
      proxy.remove(transformGuideRef.current);
      disposeObject(transformGuideRef.current);
      transformGuideRef.current = null;
    }

    if (!descriptor) {
      clearTransformGizmo();
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }

    proxy.visible = true;
    proxy.position.copy(descriptor.center);
    proxy.rotation.copy(descriptor.rotation);
    proxy.scale.set(1, 1, 1);
    const guide = createTransformGuide(descriptor, transformMode);
    proxy.add(guide);
    transformGuideRef.current = guide;
    controls.attach(proxy);
    controls.setMode(transformMode === 'scale' ? 'scale' : 'rotate');
    controls.setSpace('local');
    controls.size = descriptor.controlSize;
    controls.enabled = true;
    controls.getHelper().visible = true;
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [
    configRef,
    config.world,
    config.engine?.wallHeight,
    config.engine?.reliefScale,
    config.engine?.propHeight,
    config.obstacles,
    config.reliefs,
    config.actionZones,
    config.props,
    config.player,
    config.heroes,
    config.enemies,
    mode,
    multiSelected,
    selected,
    transformMode,
  ]);

  useEffect(() => {
    const activeKey = getEntityKey(placementEntity);
    if (activeKey && placementPreviewRef.current?.key === activeKey) return;
    resetDragPreview(placementPreviewRef.current);
    placementPreviewRef.current = null;
    invalidateRenderRef.current({ followupFrames: 1 });
  }, [placementEntity, resetDragPreview]);

  useEffect(() => {
    if (!placementEntity || mode === 'play') return undefined;
    const frame = window.requestAnimationFrame(() => {
      setCameraTargetFromEntity(placementEntity);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, placementEntity, setCameraTargetFromEntity]);

  useEffect(() => {
    invalidateRenderRef.current({ followupFrames: mode === 'play' ? 0 : 2 });
  }, [mode, dragEnabled, multiSelectMode, cameraTargetPickMode, cameraZoomDragMode, transformMode]);

  const isTransformInteractionActive = useCallback(() => Boolean(
    transformPointerActiveRef.current
    || transformControlsRef.current?.dragging
    || transformControlsRef.current?.axis,
  ), []);

  const handlePointerMove = useCallback((event) => {
    if (transformControlsRef.current?.dragging) {
      event.preventDefault();
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    const cameraZoomDrag = cameraZoomDragRef.current;
    if (cameraZoomDrag && cameraZoomDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const deltaY = event.clientY - cameraZoomDrag.lastY;
      cameraZoomDrag.lastY = event.clientY;
      latestRef.current.onCameraZoomDrag?.(deltaY);
      invalidateRenderRef.current({ followupFrames: 4 });
      return;
    }
    const eraserMode = latestRef.current.modelEraserMode && latestRef.current.mode !== 'play';
    const resolved = resolvePointer(event);
    const modelHit = eraserMode ? resolveSelectedModelHit(event) : null;
    const screenPoint = resolved || modelHit || getScreenPoint(event);
    if (!resolved && latestRef.current.paintMode) hidePaintPreview();
    if (eraserMode) {
      if (modelHit) updateModelEraserPreview(modelHit);
      else hideModelEraserPreview();
    }
    if (!resolved && !screenPoint) return;
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
      if (latestRef.current.placementEntity && latestRef.current.mode !== 'play') {
        applyPlacementPreview(latestRef.current.placementEntity, resolved.point);
      }
      if (latestRef.current.paintMode && latestRef.current.mode !== 'play') {
        updatePaintPreview(resolved.point);
      }
    }
    if (modelEraserRef.current) {
      event.preventDefault();
      if (modelHit) latestRef.current.onModelEraseMove?.(modelHit);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (paintRef.current && resolved) {
      event.preventDefault();
      latestRef.current.onWorldPaintMove?.(resolved.point);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    const heldMove = heldMoveRef.current;
    if (
      resolved
      && latestRef.current.mode === 'play'
      && heldMove
      && heldMove.pointerId === event.pointerId
    ) {
      event.preventDefault();
      latestRef.current.onWorldClick?.(resolved.point, resolved.entity, 0);
      return;
    }
    if (marqueeRef.current && screenPoint) {
      event.preventDefault();
      marqueeRef.current.currentX = screenPoint.screenX;
      marqueeRef.current.currentY = screenPoint.screenY;
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      return;
    }
    if (dragRef.current) {
      event.preventDefault();
      const drag = dragRef.current;
      const rawPoint = {
        x: resolved.point.x - drag.offsetX,
        y: resolved.point.y - drag.offsetY,
      };
      const point = latestRef.current.resolveWorldDragPoint?.(drag.entity, rawPoint) || rawPoint;
      applyDragPreview(drag, point);
      latestRef.current.onWorldDrag?.(drag.entity, point);
      invalidateRenderRef.current({ followupFrames: 1 });
    }
  }, [applyDragPreview, applyPlacementPreview, getScreenPoint, hideModelEraserPreview, hidePaintPreview, resolvePointer, resolveSelectedModelHit, updateModelEraserPreview, updatePaintPreview]);

  const handlePointerDown = useCallback((event) => {
    if (event.button === 0 && isTransformInteractionActive()) {
      event.preventDefault();
      clickStartRef.current = null;
      return;
    }
    const eraserMode = event.button === 0 && latestRef.current.modelEraserMode && latestRef.current.mode === 'edit';
    const resolved = resolvePointer(event, { pickEntity: true });
    const modelHit = eraserMode ? resolveSelectedModelHit(event) : null;
    const screenPoint = resolved || modelHit || getScreenPoint(event);
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
    }
    if (event.button === 0) {
      clickStartRef.current = resolved ? {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
      } : null;
    }
    if (event.button === 2) {
      event.preventDefault();
      latestRef.current.onShootChange?.(false);
      return;
    }
    if (event.button === 0 && latestRef.current.cameraZoomDragMode && latestRef.current.mode === 'edit') {
      event.preventDefault();
      window.getSelection?.()?.removeAllRanges?.();
      clickStartRef.current = null;
      cameraZoomDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (eraserMode) {
      event.preventDefault();
      clickStartRef.current = null;
      if (!modelHit) {
        hideModelEraserPreview();
        return;
      }
      modelEraserRef.current = { pointerId: event.pointerId };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateModelEraserPreview(modelHit);
      latestRef.current.onModelEraseStart?.(modelHit);
      return;
    }
    if (event.button !== 0 || !resolved) return;
    if (latestRef.current.mode === 'play') {
      event.preventDefault();
      window.getSelection?.()?.removeAllRanges?.();
      clickStartRef.current = null;
      heldMoveRef.current = { pointerId: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onWorldClick?.(resolved.point, resolved.entity, event.button);
      return;
    }
    if (latestRef.current.placementEntity) {
      event.preventDefault();
      return;
    }
    if (latestRef.current.paintMode && latestRef.current.mode === 'edit') {
      event.preventDefault();
      clickStartRef.current = null;
      paintRef.current = { pointerId: event.pointerId };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updatePaintPreview(resolved.point);
      latestRef.current.onWorldPaintStart?.(resolved.point);
      return;
    }
    if (latestRef.current.cameraTargetPickMode) {
      event.preventDefault();
      clickStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
        cameraTargetPick: true,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (latestRef.current.dragEnabled && isDraggableEntity(resolved.entity)) {
      event.preventDefault();
      const position = findSelectedPosition(configRef.current || latestRef.current.config, resolved.entity) || resolved.point;
      dragRef.current = {
        entity: resolved.entity,
        anchor: position,
        offsetX: resolved.point.x - position.x,
        offsetY: resolved.point.y - position.y,
        previewTargets: createDragPreviewTargets(resolved.entity),
      };
      clickStartRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onWorldDragStart?.(resolved.entity);
      return;
    }
    if (latestRef.current.multiSelectMode && latestRef.current.mode === 'edit' && screenPoint) {
      event.preventDefault();
      marqueeRef.current = {
        startX: screenPoint.screenX,
        startY: screenPoint.screenY,
        currentX: screenPoint.screenX,
        currentY: screenPoint.screenY,
      };
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }, [configRef, createDragPreviewTargets, getScreenPoint, hideModelEraserPreview, isTransformInteractionActive, resolvePointer, resolveSelectedModelHit, updateModelEraserPreview, updatePaintPreview]);

  const handlePointerUp = useCallback((event) => {
    const cameraZoomDrag = cameraZoomDragRef.current;
    if (event.button === 0 && cameraZoomDrag && cameraZoomDrag.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      cameraZoomDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      invalidateRenderRef.current({ followupFrames: 3 });
      return;
    }
    const heldMove = heldMoveRef.current;
    if (event.button === 0 && heldMove && heldMove.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      heldMoveRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && isTransformInteractionActive()) {
      event.preventDefault();
      clickStartRef.current = null;
      return;
    }
    if (event.button === 0 && modelEraserRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      modelEraserRef.current = null;
      latestRef.current.onModelEraseEnd?.();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && paintRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      paintRef.current = null;
      latestRef.current.onWorldPaintEnd?.();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && clickStartRef.current?.cameraTargetPick) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement < 6 && isCameraTargetEntity(start.entity)) {
        const success = setCameraTargetFromEntity(start.entity);
        latestRef.current.onCameraTargetPick?.(start.entity, success);
      } else {
        latestRef.current.onCameraTargetPick?.(null, false);
      }
      return;
    }
    if (event.button === 0 && dragRef.current) {
      const drag = dragRef.current;
      const resolved = resolvePointer(event);
      dragRef.current = null;
      if (resolved) {
        const rawPoint = {
          x: resolved.point.x - drag.offsetX,
          y: resolved.point.y - drag.offsetY,
        };
        const point = latestRef.current.resolveWorldDragPoint?.(drag.entity, rawPoint) || rawPoint;
        latestRef.current.onWorldDrop?.(drag.entity, point);
      } else {
        resetDragPreview(drag);
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && marqueeRef.current) {
      const screenPoint = getScreenPoint(event);
      if (screenPoint) {
        marqueeRef.current.currentX = screenPoint.screenX;
        marqueeRef.current.currentY = screenPoint.screenY;
      }
      const rect = normalizeScreenRect(marqueeRef.current);
      const start = clickStartRef.current;
      const movement = Math.hypot(
        marqueeRef.current.currentX - marqueeRef.current.startX,
        marqueeRef.current.currentY - marqueeRef.current.startY,
      );
      marqueeRef.current = null;
      setMarqueeRect(null);
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (movement >= 6) {
        latestRef.current.onMarqueeSelect?.(getEntitiesInMarquee(rect));
      } else if (start && latestRef.current.mode !== 'play') {
        latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
      return;
    }
    if (event.button === 0) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      if (start) {
        const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (movement < 6) latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
    }
    if (event.button === 2) latestRef.current.onShootChange?.(false);
  }, [getEntitiesInMarquee, getScreenPoint, isTransformInteractionActive, resetDragPreview, resolvePointer, setCameraTargetFromEntity]);

  return (
    <div
      ref={containerRef}
      className={[
        'arcade-three-viewport',
        dragEnabled && mode !== 'play' ? 'drag-enabled' : '',
        cameraTargetPickMode && mode !== 'play' ? 'camera-target-pick-enabled' : '',
        cameraZoomDragMode && mode !== 'play' ? 'camera-zoom-drag-enabled' : '',
        placementEntity && mode !== 'play' ? 'placement-enabled' : '',
        paintMode && mode !== 'play' ? 'terrain-paint-enabled' : '',
        modelEraserMode && mode !== 'play' ? 'model-eraser-enabled' : '',
      ].filter(Boolean).join(' ')}
      role="application"
      aria-label="Editeur RPG 3D WebGL"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (marqueeRef.current) return;
        clickStartRef.current = null;
        if (!paintRef.current) hidePaintPreview();
        if (!modelEraserRef.current) hideModelEraserPreview();
        if (!dragRef.current) latestRef.current.onShootChange?.(false);
      }}
      onPointerCancel={(event) => {
        clickStartRef.current = null;
        if (paintRef.current?.pointerId === event.pointerId) {
          paintRef.current = null;
          latestRef.current.onWorldPaintEnd?.();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (modelEraserRef.current?.pointerId === event.pointerId) {
          modelEraserRef.current = null;
          latestRef.current.onModelEraseEnd?.();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        hidePaintPreview();
        hideModelEraserPreview();
        if (heldMoveRef.current?.pointerId === event.pointerId) {
          heldMoveRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (cameraZoomDragRef.current?.pointerId === event.pointerId) {
          cameraZoomDragRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (marqueeRef.current) {
          marqueeRef.current = null;
          setMarqueeRect(null);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (dragRef.current) {
          resetDragPreview(dragRef.current);
          dragRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        latestRef.current.onShootChange?.(false);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {webglError ? (
        <div className="arcade-three-fallback" role="status">{webglError}</div>
      ) : null}
      {marqueeRect && marqueeRect.width + marqueeRect.height > 2 ? (
        <div
          className="arcade-three-marquee"
          aria-hidden="true"
          style={{
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
          }}
        />
      ) : null}
      <div className="arcade-three-badge">WebGL 3D</div>
    </div>
  );
}

export default ArcadeThreeViewport;
