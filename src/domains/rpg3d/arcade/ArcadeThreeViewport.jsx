import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Raycaster as ThreeRaycaster,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
} from 'three';
import {
  MODEL_ERASER_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  clamp,
  getActionZoneHeight,
  getActionZoneWidth,
  getDecorMaterialBrightness,
  getPropRenderMode,
  isFloorDecorKind,
} from '../../../shared/utils/rpg3dDomain.js';
import {
  EDIT_MODEL_ANIMATION_FRAME_MS,
  WORLD_SCALE,
  clearGroup,
  createSupportSurfaceHeightResolver,
  disposeObject,
  getCameraDistance,
  getCameraHeightForDistance,
  getEngine,
  getEntityKey,
  getSelectionOverlaySignature,
  getStaticModelEraserSignature,
  getStaticSceneSignature,
  getStaticSceneTransformSignature,
  getTerrainPaintLayerSignature,
  removeGroupChild,
  toScenePosition,
  updateActionZoneHoverHighlight,
  updateSceneLighting,
} from './rpg3dSceneBuilders.js';
import {
  createCachedModelGetter,
  createCachedTextureGetter,
  disposeRuntimeModelObject,
} from './rpg3dRuntimeModels.js';
import { syncViewportDynamicScene } from './rpg3dViewportDynamicSync.js';
import {
  addArcadeSceneLights,
  attachArcadeCameraControls,
  createArcadeCamera,
  createArcadeOrbitControls,
  createArcadeRenderer,
  createArcadeSceneEnvironment,
  createArcadeSceneGroups,
  createArcadeTransformProxy,
} from './rpg3dViewportSetup.js';
import {
  ACTION_ZONE_VIEW_MODES,
  getNesoViewEntity,
  getSelectedActionZone,
  syncArcadeShadowMapForFrame,
} from './rpg3dViewportInteraction.js';
import {
  hideViewportPreview,
  updateViewportModelEraserPreview,
  updateViewportPaintPreview,
} from './rpg3dViewportPaintEraser.js';
import {
  getViewportEntitiesInMarquee,
  getViewportScreenPoint,
  resolveViewportPointer,
  resolveViewportSelectedModelHit,
} from './rpg3dViewportPickingRuntime.js';
import {
  createTransformGuide,
  findSelectedPosition,
  getCameraTargetPoint,
  getTransformDescriptor,
  isCameraTargetEntity,
  isDraggableEntity,
  isSameEntity,
  resetTransformPreview,
} from './rpg3dViewportPicking.js';
import { createArcadeTransformControls } from './rpg3dViewportTransformControls.js';
import {
  syncViewportPropMaterialAppearance,
  syncViewportSelectionOverlay,
  syncViewportStaticModelErasers,
  syncViewportStaticScene,
  syncViewportStaticTransforms,
  syncViewportTerrainPaintLayer,
} from './rpg3dViewportSceneSync.js';
import useArcadeViewportPointerHandlers from './useArcadeViewportPointerHandlers.js';
import { syncViewportCameraForFrame } from './rpg3dViewportCameraFrame.js';

export {
  getActionZoneCurrentViewDistance,
  getActionZoneHeightDragDelta,
  getActionZoneHeightDragPoint,
  getNesoCameraTarget,
  getNesoViewEntity,
  syncArcadeShadowMapForFrame,
} from './rpg3dViewportInteraction.js';

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
  scaleProportionalAxes = null,
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
  actionZoneEdgeInsertMode = false,
  onActionZoneEdgeInsert,
  onActionZoneEdgeDrag,
  onActionZoneEdgeDragStart,
  onActionZoneVertexDrag,
  onActionZoneVertexDragStart,
  onMarqueeSelect,
  onMoveHoldChange,
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
  const raycasterRef = useRef(new ThreeRaycaster());
  const pointerRef = useRef(new ThreeVector2());
  const aimPointRef = useRef(null);
  const invalidateRenderRef = useRef(() => {});
  const clickStartRef = useRef(null);
  const heldMoveRef = useRef(null);
  const dragRef = useRef(null);
  const actionZoneVertexDragRef = useRef(null);
  const actionZoneEdgeDragRef = useRef(null);
  const paintRef = useRef(null);
  const modelEraserRef = useRef(null);
  const cameraZoomDragRef = useRef(null);
  const playCameraPanOffsetRef = useRef(new ThreeVector3());
  const playCameraPanStartOffsetRef = useRef(new ThreeVector3());
  const playCameraFollowTargetRef = useRef(new ThreeVector3());
  const playCameraFollowReadyRef = useRef(false);
  const paintPreviewRef = useRef(null);
  const modelEraserPreviewRef = useRef(null);
  const placementPreviewRef = useRef(null);
  const marqueeRef = useRef(null);
  const textureCacheRef = useRef(new Map());
  const modelCacheRef = useRef(new Map());
  const modelPendingRef = useRef(new Set());
  const modelFailedRef = useRef(new Set());
  const modelCacheTokenRef = useRef({ active: true });
  const latestRef = useRef({
    config,
    mode,
    selected,
    multiSelected,
    multiSelectMode,
    cameraTargetPickMode,
    cameraZoomDragMode,
    transformMode,
    scaleProportionalAxes,
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
    actionZoneEdgeInsertMode,
    onActionZoneEdgeInsert,
    onActionZoneEdgeDrag,
    onActionZoneEdgeDragStart,
    onActionZoneVertexDrag,
    onActionZoneVertexDragStart,
    onMarqueeSelect,
    onMoveHoldChange,
    onShootChange,
    onUnavailable,
  });
  const cameraReadyRef = useRef(false);
  const lastEditCameraDistanceRef = useRef(null);
  const dynamicFrameRef = useRef({ lastTime: 0, signature: '', forceSignature: '' });
  const [webglError, setWebglError] = useState('');
  const [staticAssetVersion, setStaticAssetVersion] = useState(0);
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [actionZoneCursorMode, setActionZoneCursorMode] = useState('');
  const [actionZoneViewMode, setActionZoneViewMode] = useState('');
  const [actionZoneHeightMode, setActionZoneHeightMode] = useState(false);
  const actionZoneCursorModeRef = useRef('');
  const actionZoneHoverIdRef = useRef('');
  const getCachedTexture = useCallback(() => createCachedTextureGetter(textureCacheRef.current), []);
  const createViewportModelGetter = useCallback((onLoaded) => {
    const cacheToken = modelCacheTokenRef.current;
    return createCachedModelGetter(
      modelCacheRef.current,
      modelPendingRef.current,
      modelFailedRef.current,
      () => {
        if (!cacheToken.active || modelCacheTokenRef.current !== cacheToken) return;
        onLoaded?.();
      },
      {
        isActive: () => cacheToken.active && modelCacheTokenRef.current === cacheToken,
      },
    );
  }, []);
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
  const staticWorldSignature = React.useMemo(() => [
    Number(config.world?.width) || 0,
    Number(config.world?.height) || 0,
    Number(config.world?.grid) || 0,
  ].join(':'), [config.world]);
  const staticSceneTransformSignature = React.useMemo(() => getStaticSceneTransformSignature(config), [
    config.engine?.wallHeight,
    config.engine?.reliefScale,
    config.engine?.propHeight,
    config.obstacles,
    config.reliefs,
    config.actionZones,
    config.props,
  ]);
  const staticModelEraserSignature = React.useMemo(() => getStaticModelEraserSignature(config), [
    config.props,
  ]);
  const propMaterialAppearanceSignature = React.useMemo(() => (
    (config.props || [])
      .filter((prop) => getPropRenderMode(prop) === 'glb')
      .map((prop) => [
        prop.id || '',
        Math.round(getDecorMaterialBrightness(prop) * 100),
        isFloorDecorKind(prop.decorKind) ? 1 : 0,
      ].join(':'))
      .join(';')
  ), [config.props]);
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
    scaleProportionalAxes,
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
    actionZoneEdgeInsertMode,
    onActionZoneEdgeInsert,
    onActionZoneEdgeDrag,
    onActionZoneEdgeDragStart,
    onActionZoneVertexDrag,
    onActionZoneVertexDragStart,
    actionZoneViewMode,
    actionZoneHeightMode,
    onMarqueeSelect,
    onMoveHoldChange,
    onShootChange,
    onUnavailable,
  };

  const updateActionZoneCursorMode = useCallback((nextMode = '') => {
    if (actionZoneCursorModeRef.current === nextMode) return;
    actionZoneCursorModeRef.current = nextMode;
    setActionZoneCursorMode(nextMode);
  }, []);

  const updateHoveredActionZone = useCallback((nextZoneId = '') => {
    const normalizedId = nextZoneId ? String(nextZoneId) : '';
    if (actionZoneHoverIdRef.current === normalizedId) return;
    actionZoneHoverIdRef.current = normalizedId;
    if (updateActionZoneHoverHighlight(staticGroupRef.current, normalizedId)) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, []);

  const getScreenPoint = useCallback((event) => {
    return getViewportScreenPoint(event, rendererRef.current);
  }, []);

  const resolvePointer = useCallback((event, { pickEntity = false } = {}) => {
    const liveConfig = configRef.current || latestRef.current.config;
    return resolveViewportPointer({
      camera: cameraRef.current,
      config: liveConfig,
      dynamicGroup: dynamicGroupRef.current,
      event,
      multiSelected: latestRef.current.multiSelected,
      pickEntity,
      pointer: pointerRef.current,
      raycaster: raycasterRef.current,
      renderer: rendererRef.current,
      scene: sceneRef.current,
      selected: latestRef.current.selected,
      selectionGroup: selectionGroupRef.current,
      staticGroup: staticGroupRef.current,
    });
  }, [configRef]);

  const resolveSelectedModelHit = useCallback((event) => {
    const liveConfig = configRef.current || latestRef.current.config;
    const selectedEntity = latestRef.current.selected;
    return resolveViewportSelectedModelHit({
      camera: cameraRef.current,
      config: liveConfig,
      event,
      pointer: pointerRef.current,
      raycaster: raycasterRef.current,
      renderer: rendererRef.current,
      selected: selectedEntity,
      staticGroup: staticGroupRef.current,
    });
  }, [configRef]);

  const hidePaintPreview = useCallback(() => {
    hideViewportPreview({
      invalidateRender: invalidateRenderRef.current,
      previewRef: paintPreviewRef,
      scene: sceneRef.current,
    });
  }, []);

  const updatePaintPreview = useCallback((point) => {
    updateViewportPaintPreview({
      config: configRef.current || latestRef.current.config,
      invalidateRender: invalidateRenderRef.current,
      latest: latestRef.current,
      point,
      previewRef: paintPreviewRef,
      scene: sceneRef.current,
    });
  }, [configRef]);

  const hideModelEraserPreview = useCallback(() => {
    hideViewportPreview({
      invalidateRender: invalidateRenderRef.current,
      previewRef: modelEraserPreviewRef,
      scene: sceneRef.current,
    });
  }, []);

  const updateModelEraserPreview = useCallback((hit) => {
    updateViewportModelEraserPreview({
      hit,
      invalidateRender: invalidateRenderRef.current,
      latest: latestRef.current,
      previewRef: modelEraserPreviewRef,
      scene: sceneRef.current,
    });
  }, []);

  const getEntitiesInMarquee = useCallback((rect) => {
    const liveConfig = configRef.current || latestRef.current.config;
    return getViewportEntitiesInMarquee({
      camera: cameraRef.current,
      config: liveConfig,
      rect,
      renderer: rendererRef.current,
    });
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
    const sceneDelta = new ThreeVector3(delta.x * WORLD_SCALE, 0, delta.y * WORLD_SCALE);

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
    const cacheToken = { active: true };
    modelCacheTokenRef.current = cacheToken;

    const handleContextLost = (event) => {
      event.preventDefault();
      setWebglError('La vue 3D a été suspendue par le navigateur.');
      latestRef.current.onUnavailable?.();
    };
    let renderer;
    try {
      renderer = createArcadeRenderer({
        onContextLost: handleContextLost,
        preserveDrawingBuffer: Boolean(window.__escapeGameBuilderRpg3DE2E),
      });
    } catch {
      setWebglError('La vue 3D est indisponible pour le moment.');
      latestRef.current.onUnavailable?.();
      return undefined;
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const { environmentMap, pmremGenerator, scene } = createArcadeSceneEnvironment(renderer);
    sceneRef.current = scene;

    const camera = createArcadeCamera();
    cameraRef.current = camera;

    const controls = createArcadeOrbitControls(camera, renderer.domElement);
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
        && !latest.actionZoneViewMode
        && !latest.actionZoneHeightMode
        && !dragRef.current
        && !actionZoneVertexDragRef.current
        && !actionZoneEdgeDragRef.current
        && !paintRef.current
        && !modelEraserRef.current
        && !marqueeRef.current
        && !transformPointerActiveRef.current
        && !transformSessionRef.current
        && !transformControlsRef.current?.dragging;
    };
    const detachCameraControls = attachArcadeCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      onPanStart: () => {
        playCameraPanStartOffsetRef.current.copy(playCameraPanOffsetRef.current);
      },
      onPanMove: (offset) => {
        if (latestRef.current.mode !== 'play') return;
        playCameraPanOffsetRef.current.copy(playCameraPanStartOffsetRef.current).add(offset);
      },
    });

    const {
      dynamicGroup,
      selectionGroup,
      staticGroup,
      terrainPaintGroup,
    } = createArcadeSceneGroups(scene);
    staticGroupRef.current = staticGroup;
    terrainPaintGroupRef.current = terrainPaintGroup;
    selectionGroupRef.current = selectionGroup;
    dynamicGroupRef.current = dynamicGroup;

    addArcadeSceneLights(scene);

    const transformProxy = createArcadeTransformProxy(scene);
    transformProxyRef.current = transformProxy;

    const transformControls = createArcadeTransformControls({
      camera,
      canUseOrbitControls,
      clickStartRef,
      controlsRef,
      domElement: renderer.domElement,
      findEntityRoots,
      invalidateRenderRef,
      latestRef,
      scene,
      transformControlsRef,
      transformDescriptorRef,
      transformPointerActiveRef,
      transformProxyRef,
      transformSessionRef,
    });

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
      const player = playMode ? state.player : liveConfig.player;
      const getActorSupportHeight = createSupportSurfaceHeightResolver(liveConfig);

      const nextPixelRatio = window.devicePixelRatio || 1;
      if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);
      resize(timestamp);
      controls.enabled = canUseOrbitControls();
      const engine = syncViewportCameraForFrame({
        camera,
        cameraReadyRef,
        controls,
        getActorSupportHeight,
        lastEditCameraDistanceRef,
        latest,
        liveConfig,
        playCameraFollowReadyRef,
        playCameraFollowTargetRef,
        playCameraPanOffsetRef,
        playMode,
        player,
      });
      const lightingNeedsShadowUpdate = updateSceneLighting(scene, engine, {
        shadowTarget: controls.target,
        shadowExtent: clamp(camera.position.distanceTo(controls.target) * 0.72, 10, 36),
      });
      const frameNeedsShadowUpdate = playMode || editFollowupFrames > 0 || hasMixers || lightingNeedsShadowUpdate;

      const didRefreshDynamic = syncViewportDynamicScene({
        createViewportModelGetter,
        dynamicFrameRef,
        dynamicGroup,
        getActorSupportHeight,
        getCachedTexture,
        latest,
        liveConfig,
        player,
        playMode,
        queueRender,
        state,
        timestamp,
      });

      syncArcadeShadowMapForFrame(renderer, frameNeedsShadowUpdate || didRefreshDynamic);
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
      cacheToken.active = false;
      if (heldMoveRef.current) latestRef.current.onMoveHoldChange?.(false);
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
      modelCacheRef.current.forEach((object) => disposeRuntimeModelObject(object));
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
  }, [configRef, createViewportModelGetter, getCachedTexture, stateRef]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return undefined;
    const smokeApi = {
      getConfig: () => configRef.current || latestRef.current.config,
      getMode: () => latestRef.current.mode,
      getSelected: () => latestRef.current.selected || null,
      getRuntimePlayer: () => {
        const player = stateRef.current?.player;
        return player ? { ...player } : null;
      },
      projectWorldToScreen: ({ x = 0, y = 0, z = 0 } = {}) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const liveConfig = configRef.current || latestRef.current.config;
        if (!renderer || !camera || !liveConfig) return null;
        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const projected = toScenePosition(liveConfig, x, y, z).project(camera);
        return {
          x: rect.left + ((projected.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - projected.y) / 2) * rect.height,
          inView: projected.z >= -1 && projected.z <= 1,
        };
      },
    };
    window.__escapeGameBuilderRpg3DSmoke = smokeApi;
    return () => {
      if (window.__escapeGameBuilderRpg3DSmoke === smokeApi) {
        delete window.__escapeGameBuilderRpg3DSmoke;
      }
    };
  }, [configRef, stateRef]);

  useEffect(() => {
    playCameraPanOffsetRef.current.set(0, 0, 0);
    playCameraPanStartOffsetRef.current.set(0, 0, 0);
    playCameraFollowReadyRef.current = false;
    if (mode === 'play') return;
    if (heldMoveRef.current) latestRef.current.onMoveHoldChange?.(false);
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
    const getTexture = getCachedTexture();
    const getModel = createViewportModelGetter(() => {
      setStaticAssetVersion((version) => version + 1);
      invalidateRenderRef.current({ followupFrames: 2 });
    });
    const didSyncScene = syncViewportStaticScene({
      actionZoneHoverId: actionZoneHoverIdRef.current,
      getTexture,
      getModel,
      groundRef,
      liveConfig,
      mode,
      scene,
      staticGroup,
      staticWorldSignature,
      studioDecorTextureById,
    });
    if (mode !== 'play') actionZoneHoverIdRef.current = '';
    if (didSyncScene) {
      dynamicFrameRef.current.signature = '';
      dynamicFrameRef.current.forceSignature = '';
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, createViewportModelGetter, getCachedTexture, mode, staticAssetVersion, staticSceneSignature, staticWorldSignature, studioDecorTextureById]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const terrainPaintGroup = terrainPaintGroupRef.current;
    if (!terrainPaintGroup || !liveConfig) return;
    if (syncViewportTerrainPaintLayer(terrainPaintGroup, liveConfig)) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, terrainPaintLayerSignature]);

  useEffect(() => {
    const staticGroup = staticGroupRef.current;
    const liveConfig = configRef.current || config;
    if (!staticGroup || !liveConfig) return;
    if (syncViewportStaticTransforms(staticGroup, liveConfig)) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, staticSceneTransformSignature]);

  useEffect(() => {
    const staticGroup = staticGroupRef.current;
    const liveConfig = configRef.current || config;
    if (!staticGroup || !liveConfig) return;
    const getTexture = getCachedTexture();
    const getModel = createViewportModelGetter(() => {
      setStaticAssetVersion((version) => version + 1);
      invalidateRenderRef.current({ followupFrames: 2 });
    });
    if (syncViewportStaticModelErasers({
      getTexture,
      getModel,
      liveConfig,
      mode,
      staticGroup,
      studioDecorTextureById,
    })) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, createViewportModelGetter, getCachedTexture, mode, staticModelEraserSignature, studioDecorTextureById]);

  useEffect(() => {
    const scene = sceneRef.current;
    const liveConfig = configRef.current || config;
    if (!scene || !liveConfig) return;
    updateSceneLighting(scene, getEngine(liveConfig));
    invalidateRenderRef.current({ followupFrames: 2 });
  }, [configRef, config.engine?.lightIntensity, config.engine?.lightOrientation]);

  useEffect(() => {
    const staticGroup = staticGroupRef.current;
    const liveConfig = configRef.current || config;
    if (!staticGroup || !liveConfig) return;
    if (syncViewportPropMaterialAppearance(staticGroup, liveConfig)) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, propMaterialAppearanceSignature]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const selectionGroup = selectionGroupRef.current;
    if (!selectionGroup || !liveConfig) return;
    if (syncViewportSelectionOverlay({
      liveConfig,
      mode,
      multiSelected,
      selected,
      selectionGroup,
    })) {
      invalidateRenderRef.current({ followupFrames: 2 });
    }
  }, [configRef, mode, selectionOverlaySignature]);

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

  useEffect(() => {
    const nesoEntity = getNesoViewEntity(selected, multiSelected);
    if (mode !== 'edit' || !nesoEntity) {
      setActionZoneViewMode('');
      setActionZoneHeightMode(false);
    } else if (nesoEntity.type !== 'actionZone' || !getSelectedActionZone(config, nesoEntity, [])) {
      setActionZoneHeightMode(false);
    }
  }, [config, mode, multiSelected, selected?.id, selected?.type]);

  useEffect(() => {
    invalidateRenderRef.current({ followupFrames: actionZoneViewMode || actionZoneHeightMode ? 8 : 2 });
  }, [actionZoneHeightMode, actionZoneViewMode, selected?.id, selected?.type]);

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useArcadeViewportPointerHandlers({
    actionZoneEdgeDragRef,
    actionZoneVertexDragRef,
    aimPointRef,
    applyDragPreview,
    applyPlacementPreview,
    cameraZoomDragRef,
    clickStartRef,
    configRef,
    controlsRef,
    createDragPreviewTargets,
    dragRef,
    getEntitiesInMarquee,
    getScreenPoint,
    heldMoveRef,
    hideModelEraserPreview,
    hidePaintPreview,
    invalidateRenderRef,
    latestRef,
    marqueeRef,
    modelEraserRef,
    paintRef,
    resetDragPreview,
    resolvePointer,
    resolveSelectedModelHit,
    setCameraTargetFromEntity,
    setMarqueeRect,
    transformControlsRef,
    transformPointerActiveRef,
    updateActionZoneCursorMode,
    updateHoveredActionZone,
    updateModelEraserPreview,
    updatePaintPreview,
  });

  const selectedNesoControlEntity = getNesoViewEntity(selected, multiSelected);
  const showNesoViewPole = mode === 'edit' && Boolean(selectedNesoControlEntity);
  const showActionZoneHeightControl = selectedNesoControlEntity?.type === 'actionZone'
    && Boolean(getSelectedActionZone(config, selectedNesoControlEntity, []));

  return (
    <div
      ref={containerRef}
      data-testid="rpg3d-viewport"
      data-rpg3d-mode={mode}
      data-rpg3d-selected={selected?.type && selected?.id ? `${selected.type}:${selected.id}` : ''}
      className={[
        'arcade-three-viewport',
        dragEnabled && mode !== 'play' ? 'drag-enabled' : '',
        cameraTargetPickMode && mode !== 'play' ? 'camera-target-pick-enabled' : '',
        cameraZoomDragMode && mode !== 'play' ? 'camera-zoom-drag-enabled' : '',
        placementEntity && mode !== 'play' ? 'placement-enabled' : '',
        paintMode && mode !== 'play' ? 'terrain-paint-enabled' : '',
        modelEraserMode && mode !== 'play' ? 'model-eraser-enabled' : '',
        actionZoneCursorMode === 'vertex' ? 'action-zone-vertex-hover' : '',
        actionZoneCursorMode === 'edge' ? 'action-zone-edge-hover' : '',
        actionZoneCursorMode === 'edge-insert' ? 'action-zone-edge-insert-hover' : '',
        actionZoneViewMode ? `action-zone-side-view action-zone-side-view-${actionZoneViewMode}` : '',
        actionZoneHeightMode ? 'action-zone-height-mode' : '',
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
        if (!actionZoneVertexDragRef.current && !actionZoneEdgeDragRef.current) updateActionZoneCursorMode('');
        updateHoveredActionZone('');
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
        updateHoveredActionZone('');
        if (heldMoveRef.current?.pointerId === event.pointerId) {
          heldMoveRef.current = null;
          latestRef.current.onMoveHoldChange?.(false);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (cameraZoomDragRef.current?.pointerId === event.pointerId) {
          cameraZoomDragRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (actionZoneVertexDragRef.current?.pointerId === event.pointerId) {
          actionZoneVertexDragRef.current = null;
          updateActionZoneCursorMode('');
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (actionZoneEdgeDragRef.current?.pointerId === event.pointerId) {
          actionZoneEdgeDragRef.current = null;
          updateActionZoneCursorMode('');
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
      {showNesoViewPole ? (
        <div
          className="action-zone-view-pole"
          role="group"
          aria-label="Vues NESO"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {ACTION_ZONE_VIEW_MODES.map((view) => (
            <button
              key={view.id}
              type="button"
              className={actionZoneViewMode === view.id ? 'active' : ''}
              data-view={view.id}
              title={view.title}
              aria-label={view.title}
              aria-pressed={actionZoneViewMode === view.id}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActionZoneViewMode((current) => (current === view.id ? '' : view.id));
              }}
            >
              {view.label}
            </button>
          ))}
          {showActionZoneHeightControl ? (
            <button
              type="button"
              className={actionZoneHeightMode ? 'active' : ''}
              data-view="height"
              title="Modifier uniquement la hauteur"
              aria-label="Modifier uniquement la hauteur"
              aria-pressed={actionZoneHeightMode}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActionZoneHeightMode((current) => !current);
              }}
            >
              Z
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="arcade-three-badge">WebGL 3D</div>
    </div>
  );
}

export default ArcadeThreeViewport;
