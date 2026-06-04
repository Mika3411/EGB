import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping as ThreeACESFilmicToneMapping,
  AmbientLight as ThreeAmbientLight,
  Box3 as ThreeBox3,
  CanvasTexture as ThreeCanvasTexture,
  Color as ThreeColor,
  DirectionalLight as ThreeDirectionalLight,
  Fog as ThreeFog,
  GridHelper as ThreeGridHelper,
  Group as ThreeGroup,
  HemisphereLight as ThreeHemisphereLight,
  MathUtils as ThreeMathUtils,
  Matrix3 as ThreeMatrix3,
  Mesh as ThreeMesh,
  PCFShadowMap as ThreePCFShadowMap,
  PMREMGenerator as ThreePMREMGenerator,
  PerspectiveCamera as ThreePerspectiveCamera,
  Plane as ThreePlane,
  PlaneGeometry as ThreePlaneGeometry,
  Raycaster as ThreeRaycaster,
  RepeatWrapping as ThreeRepeatWrapping,
  SRGBColorSpace as ThreeSRGBColorSpace,
  Scene as ThreeScene,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
  WebGLRenderer as ThreeWebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../../../shared/utils/three/clickTargetCameraControls.js';
import {
  clearGroup,
  createPreviewFloorCanvas,
  disposeThreeObject,
  getDecorModelSources,
  loadThreeDecor,
  makePreviewStandardMaterial,
} from '../../../shared/utils/rpg3dModelImport';

import {
  getDecorSizeSignature,
  getDecorPoseSignature,
  getDecorAppearanceSignature,
  getDecorPreviewModelSignature,
  getRigNodePath,
  getArmorManipulationLines,
  ARMOR_PAINT_POINT_LIMIT,
  ARMOR_PAINT_RADIUS,
  ARMOR_PAINT_HOLD_INTERVAL_MS,
  DECOR_CAMERA_ZOOM_MIN_DISTANCE,
  DECOR_CAMERA_ZOOM_MAX_DISTANCE,
  roundGripValue,
  normalizeArmorContourSegment,
  normalizeArmorPaintSurfaceNormal,
  normalizeArmorPaintSectionPlane,
  normalizeArmorContourPoint,
  normalizeArmorPaintRadius,
  normalizeArmorCutContours,
  normalizeArmorCutPaintStrokes,
  mergeArmorPaintStroke,
  getArmorCutContoursSignature,
  getArmorCutPaintSignature,
  isCanvasPointInGripTray,
  getGripTrayReferencePoint,
  getGripTrayWorldPosition,
  createWeaponGripMarker,
  disposeWeaponGripMarkers,
  disposeRigCutPreviewObjects,
  disposeArmorCutContourObjects,
  disposeArmorPaintBrushPreview,
  disposeArmorManipulationGuides,
  setRigCutSourceVisible,
  updateRigCutPreviewMaterial,
  updateArmorCutPaintObjectsAppearance,
  getArmorCutMarkerOffsets,
  getArmorCutSignature,
  buildArmorCutPreviewMeshes,
  buildArmorCutContourObjects,
  updateArmorCutContourObjectsAppearance,
  getArmorPaintBrushPointerCircle,
  warmArmorPaintTriangleCaches,
  buildArmorCutPaintObjects,
  appendArmorCutPaintPatchObjects,
  constrainArmorManipulationMarkerPosition,
  createArmorManipulationGuide,
  updateArmorManipulationGuide,
  getDecorGripSpace,
  getArmorCutArmPreviewMatrix,
  getWeaponGripWorldPosition,
  getWeaponGripOffsetFromWorld,
  applyDecorPreviewPose,
  applyDecorPreviewAppearance,
  frameDecorPreviewObject,
  getDecorCameraZoomPercent,
  applyDecorCameraZoomDelta,
  applyArmorSectionClipping,
  getArmorSectionLocalPaintPlane,
  applyDecorPreviewSize,
} from './Decor3DPreviewRuntime.js';

export { __decor3dPreviewRigTestUtils } from './Decor3DPreviewRuntime.js';

export default function Decor3DPreview({
  children,
  model,
  weaponGripMarkers = [],
  onWeaponGripMarkerChange,
  shieldGripMarkers = [],
  onShieldGripMarkerChange,
  armorCanvasCutEnabled = false,
  armorContourDrawEnabled = false,
  armorPaintDrawEnabled = false,
  armorSectionToolEnabled = false,
  armorPaintBrushRadius = ARMOR_PAINT_RADIUS,
  cameraZoomDragEnabled = false,
  armorCutManipulationEnabled = false,
  armorCutContours = [],
  armorCutPaintStrokes = [],
  armorGripMarkers = [],
  onArmorCutContourChange,
  onArmorCutPaintChange,
  onArmorGripMarkerChange,
  onCameraZoomChange,
  showGrid = true,
  rigMeshPickEnabled = false,
  rigActiveSegment = 'body',
  onRigMeshPick,
}) {
  const containerRef = useRef(null);
  const decorRootRef = useRef(null);
  const decorObjectRef = useRef(null);
  const gripRootRef = useRef(null);
  const rigCutPreviewRootRef = useRef(null);
  const rigCutPreviewObjectsRef = useRef(new Map());
  const rigCutPreviewSignatureRef = useRef('');
  const armorCutContourObjectsRef = useRef(new Map());
  const armorCutContourSignatureRef = useRef('');
  const armorCutPaintObjectsRef = useRef(new Map());
  const armorCutPaintTriangleKeysRef = useRef(new Map());
  const armorCutPaintPatchIdRef = useRef(0);
  const armorCutPaintSignatureRef = useRef('');
  const skipNextArmorCutPaintSignatureRef = useRef('');
  const armorCutPreviewDirtyRef = useRef(true);
  const armorCutContourDirtyRef = useRef(true);
  const armorCutPaintDirtyRef = useRef(true);
  const armorPaintStrokeActiveRef = useRef(false);
  const armorPaintBrushPreviewRef = useRef(null);
  const armorPaintBrushPointRef = useRef(null);
  const armorPaintBrushCanvasPointRef = useRef(null);
  const armorSectionWorldPlaneRef = useRef(null);
  const armorSectionLocalPlaneRef = useRef(null);
  const armorSectionDraftPlaneRef = useRef(null);
  const armorSectionDragRef = useRef(null);
  const armorManipulationGuideObjectsRef = useRef(new Map());
  const gripMarkersRef = useRef(new Map());
  const gripDragRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const previewFloorRef = useRef(null);
  const previewGridRef = useRef(null);
  const showGridRef = useRef(showGrid !== false);
  const latestModelRef = useRef(model);
  const latestWeaponGripMarkersRef = useRef(weaponGripMarkers);
  const latestShieldGripMarkersRef = useRef(shieldGripMarkers);
  const latestArmorCanvasCutEnabledRef = useRef(armorCanvasCutEnabled);
  const latestArmorContourDrawEnabledRef = useRef(armorContourDrawEnabled);
  const latestArmorPaintDrawEnabledRef = useRef(armorPaintDrawEnabled);
  const latestArmorSectionToolEnabledRef = useRef(armorSectionToolEnabled);
  const latestArmorPaintBrushRadiusRef = useRef(normalizeArmorPaintRadius(armorPaintBrushRadius));
  const latestCameraZoomDragEnabledRef = useRef(cameraZoomDragEnabled);
  const latestArmorCutManipulationEnabledRef = useRef(armorCutManipulationEnabled);
  const latestArmorCutContoursRef = useRef(armorCutContours);
  const latestArmorCutPaintStrokesRef = useRef(armorCutPaintStrokes);
  const latestArmorGripMarkersRef = useRef(armorGripMarkers);
  const latestArmorManipulationMarkersRef = useRef(null);
  const latestOnWeaponGripMarkerChangeRef = useRef(onWeaponGripMarkerChange);
  const latestOnShieldGripMarkerChangeRef = useRef(onShieldGripMarkerChange);
  const latestOnArmorCutContourChangeRef = useRef(onArmorCutContourChange);
  const latestOnArmorCutPaintChangeRef = useRef(onArmorCutPaintChange);
  const latestOnArmorGripMarkerChangeRef = useRef(onArmorGripMarkerChange);
  const latestOnCameraZoomChangeRef = useRef(onCameraZoomChange);
  const latestRigMeshPickEnabledRef = useRef(rigMeshPickEnabled);
  const latestRigActiveSegmentRef = useRef(rigActiveSegment);
  const latestOnRigMeshPickRef = useRef(onRigMeshPick);
  const syncWeaponGripMarkersRef = useRef(() => {});
  const syncArmorCutPreviewRef = useRef(() => {});
  const syncArmorCutContoursRef = useRef(() => {});
  const syncArmorCutPaintRef = useRef(() => {});
  const syncArmorPaintBrushPreviewRef = useRef(() => {});
  const syncArmorManipulationGuidesRef = useRef(() => {});
  const rendererRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const [previewStatus, setPreviewStatus] = useState('');
  const [sectionLine, setSectionLine] = useState(null);
  const [sectionStatus, setSectionStatus] = useState('');
  const [paintBrushCircle, setPaintBrushCircle] = useState(null);
  const paintBrushCircleFrameRef = useRef(0);
  const pendingPaintBrushCircleRef = useRef(null);
  const buildSignature = useMemo(() => getDecorPreviewModelSignature(model), [model]);
  const sizeSignature = useMemo(() => getDecorSizeSignature(model), [model]);
  const poseSignature = useMemo(() => getDecorPoseSignature(model), [model]);
  const appearanceSignature = useMemo(() => getDecorAppearanceSignature(model), [model]);

  const commitPaintBrushCircle = useCallback((nextCircle = null) => {
    pendingPaintBrushCircleRef.current = nextCircle;
    if (!nextCircle) {
      if (paintBrushCircleFrameRef.current) {
        cancelAnimationFrame(paintBrushCircleFrameRef.current);
        paintBrushCircleFrameRef.current = 0;
      }
      setPaintBrushCircle(null);
      return;
    }
    if (paintBrushCircleFrameRef.current) return;
    paintBrushCircleFrameRef.current = requestAnimationFrame(() => {
      paintBrushCircleFrameRef.current = 0;
      setPaintBrushCircle(pendingPaintBrushCircleRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (paintBrushCircleFrameRef.current) cancelAnimationFrame(paintBrushCircleFrameRef.current);
  }, []);

  useEffect(() => {
    latestModelRef.current = model;
  }, [model]);

  useEffect(() => {
    latestWeaponGripMarkersRef.current = Array.isArray(weaponGripMarkers) ? weaponGripMarkers : [];
  }, [weaponGripMarkers]);

  useEffect(() => {
    latestShieldGripMarkersRef.current = Array.isArray(shieldGripMarkers) ? shieldGripMarkers : [];
  }, [shieldGripMarkers]);

  useEffect(() => {
    latestArmorGripMarkersRef.current = Array.isArray(armorGripMarkers) ? armorGripMarkers : [];
    latestArmorManipulationMarkersRef.current = null;
    armorCutPreviewDirtyRef.current = true;
  }, [armorGripMarkers]);

  useEffect(() => {
    latestArmorCutContoursRef.current = normalizeArmorCutContours(armorCutContours);
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
  }, [armorCutContours]);

  useEffect(() => {
    const normalizedStrokes = normalizeArmorCutPaintStrokes(armorCutPaintStrokes);
    latestArmorCutPaintStrokesRef.current = normalizedStrokes;
    const decorObject = decorObjectRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    const signature = getArmorCutPaintSignature(normalizedStrokes, modelObject);
    if (
      signature
      && signature === skipNextArmorCutPaintSignatureRef.current
      && signature === armorCutPaintSignatureRef.current
    ) {
      skipNextArmorCutPaintSignatureRef.current = '';
      armorCutPaintDirtyRef.current = false;
      return;
    }
    armorCutPaintDirtyRef.current = true;
  }, [armorCutPaintStrokes]);

  useEffect(() => {
    latestArmorCanvasCutEnabledRef.current = armorCanvasCutEnabled;
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    if (!armorCanvasCutEnabled) {
      armorCutPaintTriangleKeysRef.current.clear();
      armorCutPaintPatchIdRef.current = 0;
      skipNextArmorCutPaintSignatureRef.current = '';
      armorSectionWorldPlaneRef.current = null;
      armorSectionLocalPlaneRef.current = null;
      armorSectionDraftPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, null);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, null);
      setSectionLine(null);
      setSectionStatus('');
    }
  }, [armorCanvasCutEnabled]);

  useEffect(() => {
    latestArmorContourDrawEnabledRef.current = armorContourDrawEnabled;
  }, [armorContourDrawEnabled]);

  useEffect(() => {
    latestArmorPaintDrawEnabledRef.current = armorPaintDrawEnabled;
    syncWeaponGripMarkersRef.current?.(cameraRef.current);
    syncArmorCutPreviewRef.current?.(cameraRef.current);
    syncArmorPaintBrushPreviewRef.current?.();
    if (!armorPaintDrawEnabled) return undefined;
    const warmCacheTimer = window.setTimeout(() => {
      warmArmorPaintTriangleCaches(decorObjectRef.current);
    }, 40);
    return () => window.clearTimeout(warmCacheTimer);
  }, [armorPaintDrawEnabled]);

  useEffect(() => {
    latestArmorSectionToolEnabledRef.current = armorSectionToolEnabled;
    if (armorSectionToolEnabled) {
      setSectionStatus(armorSectionWorldPlaneRef.current
        ? 'Coupe active: trace une nouvelle ligne ou passe en peinture.'
        : 'Trace une ligne de coupe, puis clique la face visible.');
    } else {
      armorSectionDraftPlaneRef.current = null;
      armorSectionDragRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
      containerRef.current?.classList?.remove('is-section-drawing');
      setSectionLine(null);
      setSectionStatus('');
    }
  }, [armorSectionToolEnabled]);

  useEffect(() => {
    latestArmorPaintBrushRadiusRef.current = normalizeArmorPaintRadius(armorPaintBrushRadius);
    syncArmorPaintBrushPreviewRef.current?.();
  }, [armorPaintBrushRadius]);

  useEffect(() => {
    latestCameraZoomDragEnabledRef.current = cameraZoomDragEnabled;
  }, [cameraZoomDragEnabled]);

  useEffect(() => {
    latestArmorCutManipulationEnabledRef.current = armorCutManipulationEnabled;
    armorCutPreviewDirtyRef.current = true;
    if (!armorCutManipulationEnabled) {
      latestArmorManipulationMarkersRef.current = null;
      syncWeaponGripMarkersRef.current?.(cameraRef.current);
      syncArmorManipulationGuidesRef.current?.();
      syncArmorCutPreviewRef.current?.(cameraRef.current);
    }
  }, [armorCutManipulationEnabled]);

  useEffect(() => {
    latestOnWeaponGripMarkerChangeRef.current = onWeaponGripMarkerChange;
  }, [onWeaponGripMarkerChange]);

  useEffect(() => {
    latestOnShieldGripMarkerChangeRef.current = onShieldGripMarkerChange;
  }, [onShieldGripMarkerChange]);

  useEffect(() => {
    latestOnArmorCutContourChangeRef.current = onArmorCutContourChange;
  }, [onArmorCutContourChange]);

  useEffect(() => {
    latestOnArmorCutPaintChangeRef.current = onArmorCutPaintChange;
  }, [onArmorCutPaintChange]);

  useEffect(() => {
    latestOnArmorGripMarkerChangeRef.current = onArmorGripMarkerChange;
  }, [onArmorGripMarkerChange]);

  useEffect(() => {
    latestOnCameraZoomChangeRef.current = onCameraZoomChange;
  }, [onCameraZoomChange]);

  useEffect(() => {
    latestRigMeshPickEnabledRef.current = rigMeshPickEnabled;
  }, [rigMeshPickEnabled]);

  useEffect(() => {
    latestRigActiveSegmentRef.current = rigActiveSegment;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    syncArmorCutPreviewRef.current?.(cameraRef.current);
    syncArmorPaintBrushPreviewRef.current?.();
  }, [rigActiveSegment]);

  useEffect(() => {
    latestOnRigMeshPickRef.current = onRigMeshPick;
  }, [onRigMeshPick]);

  useEffect(() => {
    const visible = showGrid !== false;
    showGridRef.current = visible;
    if (previewFloorRef.current) previewFloorRef.current.visible = visible;
    if (previewGridRef.current) previewGridRef.current.visible = visible;
  }, [showGrid]);

  const syncWeaponGripMarkers = useCallback((camera = cameraRef.current) => {
    const gripRoot = gripRootRef.current;
    const decorObject = decorObjectRef.current;
    if (latestArmorPaintDrawEnabledRef.current) {
      gripMarkersRef.current.forEach((marker) => { marker.visible = false; });
      return;
    }
    const isManipulatingArmor = Boolean(latestArmorCutManipulationEnabledRef.current);
    if (!isManipulatingArmor) latestArmorManipulationMarkersRef.current = null;
    const armorMarkers = isManipulatingArmor
      ? (latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current)
      : latestArmorGripMarkersRef.current;
    const markers = [
      ...latestWeaponGripMarkersRef.current.map((marker) => ({ ...marker, type: 'weapon', key: `weapon-${marker.hand === 'left' ? 'left' : 'right'}` })),
      ...latestShieldGripMarkersRef.current.map((marker) => ({ ...marker, type: 'shield', key: `shield-${marker.id || 'hand'}` })),
      ...armorMarkers.map((marker) => ({ ...marker, type: 'armor', key: `armor-${marker.id || 'lower-belly'}` })),
    ];
    if (!gripRoot || !decorObject || !Array.isArray(markers) || !markers.length) {
      gripMarkersRef.current.forEach((marker) => { marker.visible = false; });
      return;
    }

    const activeMarkers = new Set();
    const inactiveMarkerKeys = markers
      .filter((markerConfig) => !markerConfig.enabled)
      .map((markerConfig) => markerConfig.key);
    const inactiveMarkerIndexByKey = new Map(inactiveMarkerKeys.map((markerKey, index) => [markerKey, index]));
    const trayReferencePoint = getGripTrayReferencePoint(decorObject);
    markers.forEach((markerConfig) => {
      const hand = markerConfig.hand === 'left' ? 'left' : 'right';
      const markerKey = markerConfig.key;
      activeMarkers.add(markerKey);
      let marker = gripMarkersRef.current.get(markerKey);
      if (!marker) {
        marker = createWeaponGripMarker({ ...markerConfig, hand });
        gripMarkersRef.current.set(markerKey, marker);
        gripRoot.add(marker);
      }
      const isDraggingMarker = gripDragRef.current?.key === markerKey;
      const isEnabled = Boolean(markerConfig.enabled || (isDraggingMarker && gripDragRef.current?.activated));
      const trayIndex = inactiveMarkerIndexByKey.get(markerKey);
      const inTray = !isEnabled && Number.isFinite(trayIndex);
      const worldPosition = inTray
        ? getGripTrayWorldPosition(camera, trayIndex, inactiveMarkerKeys.length, trayReferencePoint)
        : getWeaponGripWorldPosition(decorObject, { ...markerConfig, hand, enabled: isEnabled });
      if (!worldPosition) {
        marker.visible = false;
        return;
      }
      marker.visible = true;
      marker.position.copy(worldPosition);
      marker.material.opacity = inTray ? 0.72 : 1;
      marker.userData.weaponGripEnabled = isEnabled;
      marker.userData.gripMarkerInTray = inTray;
      marker.userData.gripTrayIndex = inTray ? trayIndex : -1;
      marker.userData.gripMarkerType = markerConfig.type;
      marker.userData.gripMarkerId = markerConfig.type === 'armor'
        ? (markerConfig.id || 'lower-belly')
        : (markerConfig.type === 'shield' ? (markerConfig.id || 'hand') : hand);
      if (camera) {
        const distance = Math.max(0.1, camera.position.distanceTo(marker.position));
        const markerSize = ThreeMathUtils.clamp(distance * (inTray ? 0.056 : 0.065), 0.07, inTray ? 0.22 : 0.28);
        marker.scale.setScalar(markerSize);
      }
    });

    gripMarkersRef.current.forEach((marker, markerKey) => {
      if (!activeMarkers.has(markerKey)) marker.visible = false;
    });
  }, []);

  syncWeaponGripMarkersRef.current = syncWeaponGripMarkers;

  const syncArmorManipulationGuides = useCallback(() => {
    const root = gripRootRef.current;
    const decorObject = decorObjectRef.current;
    const objects = armorManipulationGuideObjectsRef.current;
    if (
      !root
      || !decorObject
      || !latestArmorCanvasCutEnabledRef.current
      || !latestArmorCutManipulationEnabledRef.current
    ) {
      disposeArmorManipulationGuides(objects);
      return;
    }
    const gripSpace = getDecorGripSpace(decorObject);
    if (!gripSpace?.space || !gripSpace?.modelObject) {
      disposeArmorManipulationGuides(objects);
      return;
    }
    const markers = latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current;
    const markerOffsets = getArmorCutMarkerOffsets(markers);
    const referenceOffsets = getArmorCutMarkerOffsets(latestArmorGripMarkersRef.current);
    const activeKeys = new Set();
    gripSpace.space.updateMatrixWorld?.(true);
    const toWorldPoint = (offset) => gripSpace.space.localToWorld(
      gripSpace.modelObject.position.clone().add(offset || new ThreeVector3()),
    );
    getArmorManipulationLines(markers).forEach((line) => {
      activeKeys.add(line.arm);
      let guide = objects.get(line.arm);
      if (!guide) {
        guide = createArmorManipulationGuide(line);
        objects.set(line.arm, guide);
        root.add(guide);
      }
      const shoulderPoint = toWorldPoint(markerOffsets[line.shoulderKey]);
      const elbowPoint = toWorldPoint(markerOffsets[line.elbowKey]);
      const referenceLength = referenceOffsets[line.shoulderKey]?.distanceTo?.(referenceOffsets[line.elbowKey]) || 0;
      updateArmorManipulationGuide(guide, shoulderPoint, elbowPoint, referenceLength);
    });
    objects.forEach((guide, key) => {
      if (!activeKeys.has(key)) {
        guide.geometry?.dispose?.();
        guide.material?.dispose?.();
        guide.parent?.remove?.(guide);
        objects.delete(key);
      }
    });
  }, []);

  syncArmorManipulationGuidesRef.current = syncArmorManipulationGuides;

  const syncArmorCutPreview = useCallback((camera = cameraRef.current) => {
    const root = rigCutPreviewRootRef.current;
    const decorObject = decorObjectRef.current;
    const markers = latestArmorGripMarkersRef.current;
    const contours = latestArmorCutContoursRef.current;
    const objects = rigCutPreviewObjectsRef.current;
    if (!root || !decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(markers) || !markers.length) {
      disposeRigCutPreviewObjects(objects);
      rigCutPreviewSignatureRef.current = '';
      armorCutPreviewDirtyRef.current = false;
      return;
    }
    const modelObject = decorObject.userData?.decorModelObject || decorObject;
    const deferArmorCutRebuild = gripDragRef.current?.type === 'armor' && objects.size > 0;
    const shouldCheckPreviewBuild = armorCutPreviewDirtyRef.current || !objects.size;
    if (shouldCheckPreviewBuild) {
      const signature = getArmorCutSignature(modelObject, markers, contours);
      if (signature !== rigCutPreviewSignatureRef.current && !deferArmorCutRebuild) {
        disposeRigCutPreviewObjects(objects);
        rigCutPreviewSignatureRef.current = '';
        if (!buildArmorCutPreviewMeshes({ root, objects, decorObject, markers, contours })) {
          armorCutPreviewDirtyRef.current = false;
          return;
        }
        rigCutPreviewSignatureRef.current = signature;
      }
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const manipulationEnabled = Boolean(latestArmorCutManipulationEnabledRef.current);
    if (!manipulationEnabled) latestArmorManipulationMarkersRef.current = null;
    const manipulationMarkers = latestArmorManipulationMarkersRef.current || markers;
    const gripSpace = manipulationEnabled ? getDecorGripSpace(decorObject) : null;
    const syncedSourceMeshes = new Set();
    objects.forEach((object) => {
      const sourceMesh = object.userData?.rigCutSourceMesh;
      if (!sourceMesh?.matrixWorld) {
        object.visible = false;
        return;
      }
      sourceMesh.updateMatrixWorld?.(true);
      if (!syncedSourceMeshes.has(sourceMesh)) {
        setRigCutSourceVisible(sourceMesh, !manipulationEnabled);
        syncedSourceMeshes.add(sourceMesh);
      }
      object.visible = sourceMesh.userData?.rigCutPreviewOriginalVisible !== false;
      const manipulationMatrix = manipulationEnabled
        ? getArmorCutArmPreviewMatrix(
          object.userData?.rigCutSegment || 'body',
          sourceMesh,
          gripSpace,
          manipulationMarkers,
          markers,
        )
        : null;
      object.matrix.copy(manipulationMatrix || sourceMesh.matrixWorld);
      updateRigCutPreviewMaterial(
        object,
        object.userData?.rigCutSegment || 'body',
        activeSegment,
        manipulationEnabled ? 'object' : (latestArmorPaintDrawEnabledRef.current ? 'paint-guide' : 'cut'),
      );
    });
    applyArmorSectionClipping(root, armorSectionWorldPlaneRef.current);
    if (!objects.size && camera) {
      armorCutPreviewDirtyRef.current = false;
      return;
    }
    armorCutPreviewDirtyRef.current = shouldCheckPreviewBuild && Boolean(deferArmorCutRebuild);
  }, []);

  syncArmorCutPreviewRef.current = syncArmorCutPreview;

  const syncArmorCutContours = useCallback(() => {
    const decorObject = decorObjectRef.current;
    const contours = latestArmorCutContoursRef.current;
    const objects = armorCutContourObjectsRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    if (!decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(contours) || !contours.length) {
      disposeArmorCutContourObjects(objects);
      armorCutContourSignatureRef.current = '';
      armorCutContourDirtyRef.current = false;
      return;
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const signature = getArmorCutContoursSignature(contours, modelObject);
    if (signature === armorCutContourSignatureRef.current) {
      updateArmorCutContourObjectsAppearance(objects, activeSegment);
      armorCutContourDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutContourSignatureRef.current = '';
    if (buildArmorCutContourObjects({
      objects,
      decorObject,
      contours,
      activeSegment,
    })) {
      armorCutContourSignatureRef.current = signature;
      updateArmorCutContourObjectsAppearance(objects, activeSegment);
    }
    armorCutContourDirtyRef.current = false;
  }, []);

  syncArmorCutContoursRef.current = syncArmorCutContours;

  const syncArmorCutPaint = useCallback(() => {
    const decorObject = decorObjectRef.current;
    const paintStrokes = latestArmorCutPaintStrokesRef.current;
    const objects = armorCutPaintObjectsRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    if (!decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(paintStrokes) || !paintStrokes.length) {
      disposeArmorCutContourObjects(objects);
      armorCutPaintTriangleKeysRef.current.clear();
      armorCutPaintPatchIdRef.current = 0;
      armorCutPaintSignatureRef.current = '';
      armorCutPaintDirtyRef.current = false;
      return;
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const sectionPlane = armorSectionWorldPlaneRef.current;
    const signature = getArmorCutPaintSignature(paintStrokes, modelObject);
    if (signature === armorCutPaintSignatureRef.current) {
      updateArmorCutPaintObjectsAppearance(objects, activeSegment, sectionPlane);
      armorCutPaintDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutPaintTriangleKeysRef.current.clear();
    armorCutPaintPatchIdRef.current = 0;
    armorCutPaintSignatureRef.current = '';
    if (buildArmorCutPaintObjects({
      objects,
      paintedTriangleKeys: armorCutPaintTriangleKeysRef.current,
      decorObject,
      paintStrokes,
      activeSegment,
      sectionPlane,
    })) {
      armorCutPaintSignatureRef.current = signature;
      updateArmorCutPaintObjectsAppearance(objects, activeSegment, sectionPlane);
    }
    armorCutPaintDirtyRef.current = false;
  }, []);

  syncArmorCutPaintRef.current = syncArmorCutPaint;

  const syncArmorPaintBrushPreview = useCallback(() => {
    const canvasPoint = armorPaintBrushCanvasPointRef.current;
    if (armorPaintBrushPreviewRef.current) armorPaintBrushPreviewRef.current.visible = false;
    if (!latestArmorPaintDrawEnabledRef.current || !canvasPoint) {
      commitPaintBrushCircle(null);
      return;
    }
    const radius = normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current);
    const segment = normalizeArmorContourSegment(latestRigActiveSegmentRef.current || 'body');
    const nextCircle = getArmorPaintBrushPointerCircle({
      canvasPoint,
      radius,
      renderer: rendererRef.current,
      segment,
    });
    if (!nextCircle) {
      commitPaintBrushCircle(null);
      return;
    }
    commitPaintBrushCircle((paintBrushCircle && paintBrushCircle.color === nextCircle?.color
      && Math.abs(paintBrushCircle.x - nextCircle.x) < 0.5
      && Math.abs(paintBrushCircle.y - nextCircle.y) < 0.5
      && Math.abs(paintBrushCircle.radius - nextCircle.radius) < 0.5)
      ? paintBrushCircle
      : nextCircle);
  }, [commitPaintBrushCircle, paintBrushCircle]);

  syncArmorPaintBrushPreviewRef.current = syncArmorPaintBrushPreview;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new ThreeWebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        stencil: true,
      });
    } catch {
      setWebglError('Aperçu 3D indisponible.');
      return undefined;
    }

    renderer.outputColorSpace = ThreeSRGBColorSpace;
    renderer.toneMapping = ThreeACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = ThreePCFShadowMap;
    renderer.domElement.className = 'decor3d-canvas';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new ThreeScene();
    scene.background = new ThreeColor('#07111e');
    scene.fog = new ThreeFog('#07111e', 8, 22);
    const pmremGenerator = new ThreePMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;
    const camera = new ThreePerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(4.2, 3.2, 5.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = DECOR_CAMERA_ZOOM_MIN_DISTANCE;
    controls.maxDistance = DECOR_CAMERA_ZOOM_MAX_DISTANCE;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI - 0.01;
    controls.target.set(0, 0.75, 0);
    controlsRef.current = controls;
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });

    scene.add(new ThreeHemisphereLight('#c9f5ff', '#24160c', 1.15));
    const sun = new ThreeDirectionalLight('#fff0c7', 2.1);
    sun.position.set(-4.5, 6, 5);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);
    scene.add(new ThreeAmbientLight('#4f8cff', 0.28));

    const floorTexture = new ThreeCanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#132033',
      oddColor: '#1d2c43',
      evenColor: '#142238',
      cellLineColor: 'rgba(148, 163, 184, .16)',
      markerColor: 'rgba(103, 232, 249, .2)',
      markerLineWidth: 4,
      markerShape: 'square',
      markerRect: { x: 96, y: 96, width: 320, height: 320 },
    }));
    floorTexture.wrapS = ThreeRepeatWrapping;
    floorTexture.wrapT = ThreeRepeatWrapping;
    floorTexture.repeat.set(5, 5);
    floorTexture.colorSpace = ThreeSRGBColorSpace;
    const floorMaterial = makePreviewStandardMaterial('#172033', { texture: floorTexture, roughness: 0.9 });
    const floor = new ThreeMesh(new ThreePlaneGeometry(8, 8), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = showGridRef.current;
    previewFloorRef.current = floor;
    scene.add(floor);

    const grid = new ThreeGridHelper(8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    grid.position.y = 0.018;
    grid.visible = showGridRef.current;
    previewGridRef.current = grid;
    scene.add(grid);

    const decorRoot = new ThreeGroup();
    decorRootRef.current = decorRoot;
    scene.add(decorRoot);
    const gripRoot = new ThreeGroup();
    gripRoot.name = 'WeaponGripMarkers';
    gripRootRef.current = gripRoot;
    scene.add(gripRoot);
    const rigCutPreviewRoot = new ThreeGroup();
    rigCutPreviewRoot.name = 'ArmorCutPreviewZones';
    rigCutPreviewRootRef.current = rigCutPreviewRoot;
    scene.add(rigCutPreviewRoot);

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
      controls.update();
      syncWeaponGripMarkersRef.current?.(camera);
      syncArmorManipulationGuidesRef.current?.();
      const paintStrokeActive = armorPaintStrokeActiveRef.current;
      if (
        !paintStrokeActive
        && (armorCutPreviewDirtyRef.current || latestArmorCutManipulationEnabledRef.current || gripDragRef.current?.type === 'armor')
      ) {
        syncArmorCutPreviewRef.current?.(camera);
      }
      if (armorCutContourDirtyRef.current) {
        syncArmorCutContoursRef.current?.();
      }
      if (!paintStrokeActive && armorCutPaintDirtyRef.current) {
        syncArmorCutPaintRef.current?.();
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    const raycaster = new ThreeRaycaster();
    const pointer = new ThreeVector2();
    const dragPlane = new ThreePlane();
    const planeNormal = new ThreeVector3();
    const planePoint = new ThreeVector3();
    let rigPickStart = null;
    let contourPickStart = null;
    let paintStroke = null;
    let paintHoldTimer = null;
    let cameraZoomDrag = null;
    let reportedZoomPercent = null;

    const reportCameraZoom = () => {
      const percent = getDecorCameraZoomPercent(camera, controls);
      if (percent === reportedZoomPercent) return;
      reportedZoomPercent = percent;
      latestOnCameraZoomChangeRef.current?.(percent);
    };

    const handleControlsChange = () => {
      reportCameraZoom();
      syncArmorPaintBrushPreviewRef.current?.();
    };
    controls.addEventListener?.('change', handleControlsChange);

    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const getCanvasPoint = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ThreeMathUtils.clamp(event.clientX - rect.left, 0, rect.width),
        y: ThreeMathUtils.clamp(event.clientY - rect.top, 0, rect.height),
        width: rect.width,
        height: rect.height,
      };
    };

    const getSectionRayDirection = (canvasPoint) => {
      const ndc = new ThreeVector3(
        (canvasPoint.x / Math.max(1, canvasPoint.width)) * 2 - 1,
        -((canvasPoint.y / Math.max(1, canvasPoint.height)) * 2 - 1),
        0.5,
      );
      return ndc.unproject(camera).sub(camera.position).normalize();
    };

    const createSectionPlaneFromLine = (start, end) => {
      if (!start || !end || Math.hypot(end.x - start.x, end.y - start.y) < 8) return null;
      const startDirection = getSectionRayDirection(start);
      const endDirection = getSectionRayDirection(end);
      const normal = startDirection.cross(endDirection);
      if (normal.lengthSq() <= 0.000001) return null;
      normal.normalize();
      return new ThreePlane().setFromNormalAndCoplanarPoint(normal, camera.position);
    };

    const isWorldPointVisibleBySection = (point = null) => {
      const plane = armorSectionWorldPlaneRef.current;
      if (!plane || !point) return true;
      return plane.distanceToPoint(point) >= -0.002;
    };

    const getFirstModelHit = (event, options = {}) => {
      const decorObject = decorObjectRef.current;
      const modelObject = decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse) return null;
      updatePointer(event);
      const hits = raycaster.intersectObject(modelObject, true);
      return hits.find((entry) => (
        (entry?.object?.isMesh || entry?.object?.isSkinnedMesh)
        && (options.ignoreSection || isWorldPointVisibleBySection(entry.point))
      )) || null;
    };

    const findGripMarkerHit = (event) => {
      updatePointer(event);
      const markerObjects = Array.from(gripMarkersRef.current.values()).filter((marker) => marker.visible);
      return raycaster.intersectObjects(markerObjects, false)[0] || null;
    };

    const findRigMeshHit = (event) => {
      const decorObject = decorObjectRef.current;
      const modelObject = decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse) return null;
      const hit = getFirstModelHit(event);
      if (!hit?.object) return null;
      modelObject.updateMatrixWorld?.(true);
      hit.object.updateMatrixWorld?.(true);
      const box = new ThreeBox3().setFromObject(hit.object);
      const size = box.getSize(new ThreeVector3());
      const center = modelObject.worldToLocal(box.getCenter(new ThreeVector3()));
      return {
        path: getRigNodePath(hit.object, modelObject),
        name: hit.object.name || hit.object.parent?.name || 'Mesh',
        center: { x: center.x, y: center.y, z: center.z },
        size: { x: size.x, y: size.y, z: size.z },
      };
    };

    const findArmorContourPoint = (event) => {
      const decorObject = decorObjectRef.current;
      const gripSpace = getDecorGripSpace(decorObject);
      const modelObject = gripSpace?.modelObject || decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse || !gripSpace?.space) return null;
      const hit = getFirstModelHit(event);
      if (!hit?.point) return null;
      const gripPoint = hit.point.clone();
      gripSpace.space.worldToLocal(gripPoint);
      gripPoint.sub(gripSpace.modelObject.position);
      const surfaceNormal = hit.face?.normal
        ? (() => {
          const worldNormal = hit.face.normal.clone()
            .applyMatrix3(new ThreeMatrix3().getNormalMatrix(hit.object.matrixWorld))
            .normalize();
          if (worldNormal.lengthSq() <= 0.000001) return {};
          const normalEnd = hit.point.clone().add(worldNormal);
          gripSpace.space.worldToLocal(normalEnd);
          normalEnd.sub(gripSpace.modelObject.position);
          normalEnd.sub(gripPoint);
          if (normalEnd.lengthSq() <= 0.000001) return {};
          normalEnd.normalize();
          return { nx: normalEnd.x, ny: normalEnd.y, nz: normalEnd.z };
        })()
        : {};
      return normalizeArmorContourPoint({
        x: gripPoint.x,
        y: gripPoint.y,
        z: gripPoint.z,
        ...surfaceNormal,
        ...normalizeArmorPaintSectionPlane(armorSectionLocalPlaneRef.current ? {
          cx: armorSectionLocalPlaneRef.current.normal.x,
          cy: armorSectionLocalPlaneRef.current.normal.y,
          cz: armorSectionLocalPlaneRef.current.normal.z,
          cw: armorSectionLocalPlaneRef.current.constant,
        } : {}),
      });
    };

    const setArmorPaintBrushPoint = (point = null) => {
      armorPaintBrushPointRef.current = point
        ? { x: point.x, y: point.y, z: point.z, ...normalizeArmorPaintSurfaceNormal(point) }
        : null;
      syncArmorPaintBrushPreviewRef.current?.();
    };

    const storeArmorPaintBrushSurfacePoint = (point = null) => {
      armorPaintBrushPointRef.current = point
        ? { x: point.x, y: point.y, z: point.z, ...normalizeArmorPaintSurfaceNormal(point) }
        : null;
    };

    const setArmorPaintBrushCanvasPoint = (canvasPoint = null) => {
      armorPaintBrushCanvasPointRef.current = canvasPoint
        ? { x: canvasPoint.x, y: canvasPoint.y }
        : null;
      syncArmorPaintBrushPreviewRef.current?.();
    };

    const selectArmorSectionVisibleSide = (event) => {
      const draftPlane = armorSectionDraftPlaneRef.current;
      if (!draftPlane) return false;
      const hit = getFirstModelHit(event, { ignoreSection: true });
      if (!hit?.point) {
        setSectionStatus('Clique directement sur la face a garder visible.');
        return true;
      }
      const sectionPlane = draftPlane.clone();
      if (sectionPlane.distanceToPoint(hit.point) < 0) sectionPlane.negate();
      sectionPlane.normalize();
      armorSectionWorldPlaneRef.current = sectionPlane;
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, sectionPlane);
      armorSectionDraftPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, sectionPlane);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, sectionPlane);
      armorCutPaintDirtyRef.current = true;
      setSectionLine(null);
      setSectionStatus('Coupe active: la peinture reste sur la face visible.');
      return true;
    };

    const handleArmorSectionPointerDown = (event) => {
      if (event.button !== 0 || !latestArmorSectionToolEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (armorSectionDraftPlaneRef.current) {
        selectArmorSectionVisibleSide(event);
        return;
      }
      const start = getCanvasPoint(event);
      armorSectionWorldPlaneRef.current = null;
      armorSectionLocalPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, null);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, null);
      armorCutPaintDirtyRef.current = true;
      armorSectionDragRef.current = {
        pointerId: event.pointerId,
        start,
        last: start,
      };
      setSectionLine({ ...start, x2: start.x, y2: start.y, pending: false });
      setSectionStatus('Trace la ligne de coupe.');
      controls.enabled = false;
      container.classList.add('is-section-drawing');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in some embedded browsers.
      }
    };

    const handleArmorSectionPointerMove = (event) => {
      const drag = armorSectionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const end = getCanvasPoint(event);
      drag.last = end;
      setSectionLine({ ...drag.start, x2: end.x, y2: end.y, pending: false });
    };

    const endArmorSectionLine = (event) => {
      const drag = armorSectionDragRef.current;
      if (!drag || (event?.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      try {
        renderer.domElement.releasePointerCapture?.(drag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
      armorSectionDragRef.current = null;
      controls.enabled = true;
      container.classList.remove('is-section-drawing');
      const end = drag.last || drag.start;
      const plane = createSectionPlaneFromLine(drag.start, end);
      if (!plane) {
        setSectionLine(null);
        setSectionStatus('Ligne trop courte: recommence la coupe.');
        return;
      }
      armorSectionDraftPlaneRef.current = plane;
      setSectionLine({ ...drag.start, x2: end.x, y2: end.y, pending: true });
      setSectionStatus('Clique la face que tu veux garder visible.');
    };

    const updateLocalArmorGripMarker = (markerId = 'lower-belly', position = {}) => {
      const isManipulatingArmor = Boolean(latestArmorCutManipulationEnabledRef.current);
      const sourceMarkers = isManipulatingArmor
        ? (latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current || [])
        : (latestArmorGripMarkersRef.current || []);
      const nextMarkers = sourceMarkers.map((marker) => (
        marker.id === markerId
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
      if (isManipulatingArmor) latestArmorManipulationMarkersRef.current = nextMarkers;
      else latestArmorGripMarkersRef.current = nextMarkers;
    };

    const updateLocalWeaponGripMarker = (hand = 'right', position = {}) => {
      const gripHand = hand === 'left' ? 'left' : 'right';
      latestWeaponGripMarkersRef.current = (latestWeaponGripMarkersRef.current || []).map((marker) => (
        (marker.hand === 'left' ? 'left' : 'right') === gripHand
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
    };

    const updateLocalShieldGripMarker = (markerId = 'hand', position = {}) => {
      const pointId = markerId || 'hand';
      latestShieldGripMarkersRef.current = (latestShieldGripMarkersRef.current || []).map((marker) => (
        (marker.id || 'hand') === pointId
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
    };

    const commitGripWorldPosition = (markerKey, worldPosition, options = {}) => {
      const offset = getWeaponGripOffsetFromWorld(decorObjectRef.current, worldPosition);
      if (!offset) return null;
      const drag = gripDragRef.current;
      let nextPosition = {
        x: roundGripValue(offset.x),
        y: roundGripValue(offset.y),
        z: roundGripValue(offset.z),
      };
      if (drag?.type === 'armor' && latestArmorCutManipulationEnabledRef.current) {
        nextPosition = constrainArmorManipulationMarkerPosition(
          drag.id || 'lower-belly',
          nextPosition,
          latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current || [],
          latestArmorGripMarkersRef.current || [],
        );
      }
      if (
        drag?.lastPosition
        && drag.lastPosition.x === nextPosition.x
        && drag.lastPosition.y === nextPosition.y
        && drag.lastPosition.z === nextPosition.z
      ) return nextPosition;
      if (drag) drag.lastPosition = nextPosition;
      if (drag?.type === 'shield') {
        updateLocalShieldGripMarker(drag.id || 'hand', nextPosition);
        latestOnShieldGripMarkerChangeRef.current?.(drag.id || 'hand', nextPosition);
        return nextPosition;
      }
      if (drag?.type === 'armor') {
        updateLocalArmorGripMarker(drag.id || 'lower-belly', nextPosition);
        if (options.persist && !latestArmorCutManipulationEnabledRef.current) {
          latestOnArmorGripMarkerChangeRef.current?.(drag.id || 'lower-belly', nextPosition);
        }
        return nextPosition;
      }
      updateLocalWeaponGripMarker(drag?.hand || markerKey, nextPosition);
      latestOnWeaponGripMarkerChangeRef.current?.(drag?.hand || markerKey, nextPosition);
      return nextPosition;
    };

    const endGripDrag = (event) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      if (drag.type === 'armor' && drag.activated && drag.lastPosition && !latestArmorCutManipulationEnabledRef.current) {
        latestOnArmorGripMarkerChangeRef.current?.(drag.id || 'lower-belly', drag.lastPosition);
      }
      gripDragRef.current = null;
      controls.enabled = true;
      container.classList.remove('is-grip-dragging');
      try {
        renderer.domElement.releasePointerCapture?.(drag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    };

    const handleGripPointerDown = (event) => {
      if (
        event.button !== 0
        || latestArmorContourDrawEnabledRef.current
        || latestArmorPaintDrawEnabledRef.current
        || latestCameraZoomDragEnabledRef.current
        || (!latestWeaponGripMarkersRef.current?.length && !latestShieldGripMarkersRef.current?.length && !latestArmorGripMarkersRef.current?.length)
      ) return;
      syncWeaponGripMarkersRef.current?.(camera);
      const hit = findGripMarkerHit(event);
      if (!hit?.object?.userData?.weaponGripMarker) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const marker = hit.object;
      const hand = marker.userData.weaponGripHand === 'left' ? 'left' : 'right';
      const markerType = marker.userData.gripMarkerType === 'armor'
        ? 'armor'
        : (marker.userData.gripMarkerType === 'shield' ? 'shield' : 'weapon');
      const markerId = markerType === 'armor'
        ? (marker.userData.gripMarkerId || 'lower-belly')
        : (markerType === 'shield' ? (marker.userData.gripMarkerId || 'hand') : hand);
      const markerKey = `${markerType}-${markerId}`;
      const fromTray = marker.userData.gripMarkerInTray === true;
      camera.getWorldDirection(planeNormal).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, marker.position);
      updatePointer(event);
      const hitPlane = raycaster.ray.intersectPlane(dragPlane, planePoint);
      gripDragRef.current = {
        hand,
        type: markerType,
        id: markerId,
        key: markerKey,
        pointerId: event.pointerId,
        grabOffset: hitPlane ? marker.position.clone().sub(planePoint) : new ThreeVector3(),
        fromTray,
        activated: !fromTray,
        trayPosition: marker.position.clone(),
        lastPosition: null,
      };
      controls.enabled = false;
      container.classList.add('is-grip-dragging');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
      if (!fromTray) {
        commitGripWorldPosition(markerKey, marker.position, { persist: markerType !== 'armor' });
      }
    };

    const handleGripPointerMove = (event) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      updatePointer(event);
      if (!raycaster.ray.intersectPlane(dragPlane, planePoint)) return;
      const nextWorldPosition = planePoint.clone().add(drag.grabOffset);
      const canvasPoint = getCanvasPoint(event);
      const marker = gripMarkersRef.current.get(drag.key || drag.hand);
      if (drag.fromTray && !drag.activated && isCanvasPointInGripTray(canvasPoint)) {
        if (marker) {
          marker.position.copy(nextWorldPosition);
          marker.material.opacity = 0.72;
        }
        return;
      }
      if (drag.fromTray && !drag.activated) {
        drag.activated = true;
      }
      const resolvedPosition = commitGripWorldPosition(drag.key || drag.hand, nextWorldPosition, { persist: drag.type !== 'armor' });
      if (marker) {
        if (drag.type === 'armor' && resolvedPosition) {
          marker.position.copy(getWeaponGripWorldPosition(decorObjectRef.current, {
            type: 'armor',
            id: drag.id || 'lower-belly',
            enabled: true,
            ...resolvedPosition,
          }) || nextWorldPosition);
        } else {
          marker.position.copy(nextWorldPosition);
        }
      }
    };

    const handleRigPickPointerDown = (event) => {
      if (
        event.button !== 0
        || latestArmorContourDrawEnabledRef.current
        || latestArmorPaintDrawEnabledRef.current
        || latestCameraZoomDragEnabledRef.current
        || !latestRigMeshPickEnabledRef.current
        || !latestOnRigMeshPickRef.current
      ) return;
      rigPickStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    };

    const handleRigPickPointerUp = (event) => {
      if (!rigPickStart || gripDragRef.current || !latestRigMeshPickEnabledRef.current || !latestOnRigMeshPickRef.current) {
        rigPickStart = null;
        return;
      }
      const moved = Math.hypot((event.clientX || 0) - rigPickStart.x, (event.clientY || 0) - rigPickStart.y);
      rigPickStart = null;
      if (moved > 7) return;
      const node = findRigMeshHit(event);
      if (!node?.path) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      latestOnRigMeshPickRef.current?.(node);
    };

    const handleArmorContourPointerDown = (event) => {
      if (
        event.button !== 0
        || latestCameraZoomDragEnabledRef.current
        || !latestArmorContourDrawEnabledRef.current
        || !latestOnArmorCutContourChangeRef.current
      ) return;
      contourPickStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    };

    const handleArmorContourPointerUp = (event) => {
      if (
        !contourPickStart
        || gripDragRef.current
        || !latestArmorContourDrawEnabledRef.current
        || !latestOnArmorCutContourChangeRef.current
      ) {
        contourPickStart = null;
        return;
      }
      const moved = Math.hypot((event.clientX || 0) - contourPickStart.x, (event.clientY || 0) - contourPickStart.y);
      contourPickStart = null;
      if (moved > 7) return;
      const point = findArmorContourPoint(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      latestOnArmorCutContourChangeRef.current?.(latestRigActiveSegmentRef.current || 'body', { action: 'append', point });
    };

    const handleArmorContourPointerCancel = () => {
      contourPickStart = null;
    };

    const getArmorPaintPointerSnapshot = (event) => ({
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    });

    const appendLiveArmorPaintPatch = (points = []) => {
      if (!paintStroke || !Array.isArray(points) || !points.length) return;
      appendArmorCutPaintPatchObjects({
        objects: armorCutPaintObjectsRef.current,
        paintedTriangleKeys: armorCutPaintTriangleKeysRef.current,
        decorObject: decorObjectRef.current,
        stroke: {
          segment: paintStroke.segment,
          radius: paintStroke.radius,
          points,
        },
        activeSegment: latestRigActiveSegmentRef.current || paintStroke.segment,
        sectionPlane: armorSectionWorldPlaneRef.current,
        patchId: armorCutPaintPatchIdRef.current += 1,
      });
      armorCutPaintDirtyRef.current = false;
    };

    const appendArmorPaintPoint = (event, options = {}) => {
      if (paintStroke) paintStroke.lastEvent = getArmorPaintPointerSnapshot(event);
      const previousPointCount = paintStroke?.points?.length || 0;
      if (options.updateCursor !== false) setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
      const point = findArmorContourPoint(event);
      storeArmorPaintBrushSurfacePoint(point);
      if (!point) return null;
      const lastPoint = paintStroke?.lastPoint;
      if (
        lastPoint
        && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y, point.z - lastPoint.z) < 0.035
      ) {
        return lastPoint;
      }
      if (paintStroke) {
        const patchPoints = lastPoint ? [lastPoint, point] : [point];
        paintStroke.lastPoint = point;
        paintStroke.points.push(point);
        if (paintStroke.points.length > ARMOR_PAINT_POINT_LIMIT) {
          paintStroke.points = paintStroke.points.slice(-ARMOR_PAINT_POINT_LIMIT);
        }
        if (paintStroke.points.length !== previousPointCount) appendLiveArmorPaintPatch(patchPoints);
      }
      return point;
    };

    const stopArmorPaintHold = () => {
      if (!paintHoldTimer) return;
      window.clearInterval(paintHoldTimer);
      paintHoldTimer = null;
    };

    const startArmorPaintHold = () => {
      stopArmorPaintHold();
      paintHoldTimer = window.setInterval(() => {
        if (!paintStroke || !latestArmorPaintDrawEnabledRef.current) {
          stopArmorPaintHold();
          return;
        }
        const event = paintStroke.lastEvent;
        if (!event) return;
        appendArmorPaintPoint(event, { force: true, updateCursor: false });
      }, ARMOR_PAINT_HOLD_INTERVAL_MS);
    };

    const handleArmorPaintPointerDown = (event) => {
      if (
        event.button !== 0
        || latestCameraZoomDragEnabledRef.current
        || !latestArmorPaintDrawEnabledRef.current
        || !latestOnArmorCutPaintChangeRef.current
      ) return;
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
      const point = findArmorContourPoint(event);
      if (!point) return;
      storeArmorPaintBrushSurfacePoint(point);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      paintStroke = {
        baseStrokes: normalizeArmorCutPaintStrokes(latestArmorCutPaintStrokesRef.current),
        lastEvent: getArmorPaintPointerSnapshot(event),
        pointerId: event.pointerId,
        lastPoint: point,
        points: [point],
        radius: normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current),
        segment: latestRigActiveSegmentRef.current || 'body',
      };
      appendLiveArmorPaintPatch([point]);
      startArmorPaintHold();
      armorPaintStrokeActiveRef.current = true;
      controls.enabled = false;
      container.classList.add('is-painting');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
    };

    const handleArmorPaintPointerMove = (event) => {
      if (!paintStroke || !latestArmorPaintDrawEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      paintStroke.lastEvent = getArmorPaintPointerSnapshot(event);
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
    };

    const handleArmorPaintPointerHover = (event) => {
      if (paintStroke) return;
      if (!latestArmorPaintDrawEnabledRef.current) {
        setArmorPaintBrushCanvasPoint(null);
        return;
      }
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
    };

    const handleArmorPaintPointerLeave = () => {
      setArmorPaintBrushCanvasPoint(null);
      setArmorPaintBrushPoint(null);
    };

    const endArmorPaint = (event) => {
      if (!paintStroke) return;
      stopArmorPaintHold();
      const completedStroke = paintStroke;
      try {
        renderer.domElement.releasePointerCapture?.(completedStroke.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      appendArmorPaintPoint(event || completedStroke.lastEvent, { force: true, updateCursor: false });
      paintStroke = null;
      armorPaintStrokeActiveRef.current = false;
      controls.enabled = true;
      container.classList.remove('is-painting');
      if (completedStroke.points?.length) {
        const segment = normalizeArmorContourSegment(completedStroke.segment);
        const nextStrokes = mergeArmorPaintStroke(
          completedStroke.baseStrokes,
          segment,
          completedStroke.points,
          completedStroke.radius,
        );
        latestArmorCutPaintStrokesRef.current = nextStrokes;
        const modelObject = decorObjectRef.current?.userData?.decorModelObject || decorObjectRef.current;
        const signature = getArmorCutPaintSignature(nextStrokes, modelObject);
        armorCutPaintSignatureRef.current = signature;
        skipNextArmorCutPaintSignatureRef.current = signature;
        armorCutPaintDirtyRef.current = false;
        latestOnArmorCutPaintChangeRef.current?.(completedStroke.segment, {
          action: 'append',
          points: completedStroke.points,
          radius: completedStroke.radius,
        });
      }
    };

    const handleCameraZoomPointerDown = (event) => {
      if (event.button !== 0 || !latestCameraZoomDragEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.getSelection?.()?.removeAllRanges?.();
      cameraZoomDrag = {
        pointerId: event.pointerId,
        lastY: event.clientY,
      };
      controls.enabled = false;
      container.classList.add('is-camera-zooming');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
    };

    const handleCameraZoomPointerMove = (event) => {
      if (!cameraZoomDrag || cameraZoomDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const deltaY = event.clientY - cameraZoomDrag.lastY;
      cameraZoomDrag.lastY = event.clientY;
      applyDecorCameraZoomDelta(camera, controls, deltaY);
      reportCameraZoom();
    };

    const endCameraZoom = (event) => {
      if (!cameraZoomDrag || (event?.pointerId !== undefined && cameraZoomDrag.pointerId !== event.pointerId)) return;
      try {
        renderer.domElement.releasePointerCapture?.(cameraZoomDrag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      cameraZoomDrag = null;
      controls.enabled = true;
      container.classList.remove('is-camera-zooming');
      reportCameraZoom();
    };

    const hasCanvasPointerInteraction = () => Boolean(
      gripDragRef.current
      || cameraZoomDrag
      || paintStroke
      || armorSectionDragRef.current
      || contourPickStart
      || rigPickStart
    );

    const endCanvasPointerInteractions = (event) => {
      if (!hasCanvasPointerInteraction()) return;
      endGripDrag(event);
      endCameraZoom(event);
      endArmorPaint(event);
      endArmorSectionLine(event);
      handleArmorContourPointerCancel();
      rigPickStart = null;
      controls.enabled = true;
      container.classList.remove('is-grip-dragging', 'is-painting', 'is-camera-zooming', 'is-section-drawing');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endCanvasPointerInteractions();
    };

    renderer.domElement.addEventListener('pointerdown', handleArmorSectionPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleGripPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleCameraZoomPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorPaintPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorContourPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleRigPickPointerDown, true);
    renderer.domElement.addEventListener('pointermove', handleArmorSectionPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerHover, true);
    renderer.domElement.addEventListener('pointermove', handleCameraZoomPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleGripPointerMove, true);
    renderer.domElement.addEventListener('pointerleave', handleArmorPaintPointerLeave, true);
    renderer.domElement.addEventListener('pointerup', endArmorSectionLine, true);
    renderer.domElement.addEventListener('pointerup', endGripDrag, true);
    renderer.domElement.addEventListener('pointerup', endCameraZoom, true);
    renderer.domElement.addEventListener('pointerup', endArmorPaint, true);
    renderer.domElement.addEventListener('pointerup', handleArmorContourPointerUp, true);
    renderer.domElement.addEventListener('pointerup', handleRigPickPointerUp, true);
    renderer.domElement.addEventListener('pointercancel', endArmorSectionLine, true);
    renderer.domElement.addEventListener('pointercancel', endGripDrag, true);
    renderer.domElement.addEventListener('pointercancel', endCameraZoom, true);
    renderer.domElement.addEventListener('pointercancel', endArmorPaint, true);
    renderer.domElement.addEventListener('pointercancel', handleArmorContourPointerCancel, true);
    renderer.domElement.addEventListener('lostpointercapture', endCanvasPointerInteractions);
    window.addEventListener('pointerup', endCanvasPointerInteractions);
    window.addEventListener('pointercancel', endCanvasPointerInteractions);
    window.addEventListener('blur', endCanvasPointerInteractions);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(frameId);
      controls.removeEventListener?.('change', handleControlsChange);
      renderer.domElement.removeEventListener('pointerdown', handleArmorSectionPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleGripPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleCameraZoomPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorPaintPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorContourPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleRigPickPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorSectionPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerHover, true);
      renderer.domElement.removeEventListener('pointermove', handleCameraZoomPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleGripPointerMove, true);
      renderer.domElement.removeEventListener('pointerleave', handleArmorPaintPointerLeave, true);
      renderer.domElement.removeEventListener('pointerup', endArmorSectionLine, true);
      renderer.domElement.removeEventListener('pointerup', endGripDrag, true);
      renderer.domElement.removeEventListener('pointerup', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointerup', endArmorPaint, true);
      renderer.domElement.removeEventListener('pointerup', handleArmorContourPointerUp, true);
      renderer.domElement.removeEventListener('pointerup', handleRigPickPointerUp, true);
      renderer.domElement.removeEventListener('pointercancel', endArmorSectionLine, true);
      renderer.domElement.removeEventListener('pointercancel', endGripDrag, true);
      renderer.domElement.removeEventListener('pointercancel', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointercancel', endArmorPaint, true);
      renderer.domElement.removeEventListener('pointercancel', handleArmorContourPointerCancel, true);
      renderer.domElement.removeEventListener('lostpointercapture', endCanvasPointerInteractions);
      window.removeEventListener('pointerup', endCanvasPointerInteractions);
      window.removeEventListener('pointercancel', endCanvasPointerInteractions);
      window.removeEventListener('blur', endCanvasPointerInteractions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      detachCameraControls();
      controls.dispose();
      decorObjectRef.current = null;
      disposeWeaponGripMarkers(gripMarkersRef.current);
      disposeRigCutPreviewObjects(rigCutPreviewObjectsRef.current);
      disposeArmorCutContourObjects(armorCutContourObjectsRef.current);
      disposeArmorCutContourObjects(armorCutPaintObjectsRef.current);
      disposeArmorPaintBrushPreview(armorPaintBrushPreviewRef.current);
      stopArmorPaintHold();
      armorPaintBrushPreviewRef.current = null;
      disposeArmorManipulationGuides(armorManipulationGuideObjectsRef.current);
      rigCutPreviewRootRef.current = null;
      gripRootRef.current = null;
      clearGroup(decorRoot);
      disposeThreeObject(floor);
      disposeThreeObject(grid);
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      decorRootRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      previewFloorRef.current = null;
      previewGridRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyDecorPreviewSize(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    if (armorSectionWorldPlaneRef.current) {
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, armorSectionWorldPlaneRef.current);
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [sizeSignature]);

  useEffect(() => {
    applyDecorPreviewPose(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    if (armorSectionWorldPlaneRef.current) {
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, armorSectionWorldPlaneRef.current);
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [poseSignature]);

  useEffect(() => {
    applyDecorPreviewAppearance(decorObjectRef.current, latestModelRef.current);
    if (armorSectionWorldPlaneRef.current) {
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
  }, [appearanceSignature]);

  useEffect(() => {
    const decorRoot = decorRootRef.current;
    if (!decorRoot || !model) return undefined;
    let cancelled = false;
    decorObjectRef.current = null;
    disposeArmorPaintBrushPreview(armorPaintBrushPreviewRef.current);
    armorPaintBrushPreviewRef.current = null;
    armorPaintBrushPointRef.current = null;
    disposeArmorCutContourObjects(armorCutPaintObjectsRef.current);
    armorCutPaintTriangleKeysRef.current.clear();
    armorCutPaintPatchIdRef.current = 0;
    armorCutPaintSignatureRef.current = '';
    skipNextArmorCutPaintSignatureRef.current = '';
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    clearGroup(decorRoot);
    const sources = getDecorModelSources(model);
    if (sources.length) {
      setPreviewStatus('Chargement du modèle 3D...');
      const loadingRoot = new ThreeGroup();
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
        applyDecorPreviewAppearance(object, latestModelRef.current);
        frameDecorPreviewObject(object, cameraRef.current, controlsRef.current);
        if (armorSectionWorldPlaneRef.current) {
          armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(object, armorSectionWorldPlaneRef.current);
          applyArmorSectionClipping(object, armorSectionWorldPlaneRef.current);
        }
        armorCutPreviewDirtyRef.current = true;
        armorCutContourDirtyRef.current = true;
        armorCutPaintDirtyRef.current = true;
        latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
        setPreviewStatus('');
      }, (error) => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        setPreviewStatus(error?.message ? `Modèle 3D non affiché: ${error.message}` : 'Modèle 3D non affiché.');
      });
    } else {
      clearGroup(decorRoot);
      setPreviewStatus('');
    }
    return () => {
      cancelled = true;
      decorObjectRef.current = null;
    };
  }, [buildSignature]);

  const sectionLineStyle = sectionLine
    ? {
      left: `${sectionLine.x}px`,
      top: `${sectionLine.y}px`,
      width: `${Math.hypot((sectionLine.x2 || sectionLine.x) - sectionLine.x, (sectionLine.y2 || sectionLine.y) - sectionLine.y)}px`,
      transform: `rotate(${Math.atan2((sectionLine.y2 || sectionLine.y) - sectionLine.y, (sectionLine.x2 || sectionLine.x) - sectionLine.x)}rad)`,
    }
    : null;
  const hasGripMarkers = Boolean(weaponGripMarkers?.length || shieldGripMarkers?.length || armorGripMarkers?.length);

  return (
    <div
      ref={containerRef}
      className={`decor3d-canvas-shell ${hasGripMarkers ? 'decor3d-canvas-shell-grips' : ''} ${armorContourDrawEnabled || armorPaintDrawEnabled ? 'decor3d-canvas-shell-contour' : ''} ${armorSectionToolEnabled ? 'decor3d-canvas-shell-section' : ''} ${cameraZoomDragEnabled ? 'decor3d-canvas-shell-zoom' : ''}`}
    >
      {children}
      {hasGripMarkers ? <div className="decor3d-grip-tray-frame" aria-hidden="true" /> : null}
      {paintBrushCircle ? (
        <div
          className="decor3d-paint-brush-circle"
          style={{
            borderColor: paintBrushCircle.color,
            color: paintBrushCircle.color,
            height: `${paintBrushCircle.radius * 2}px`,
            left: `${paintBrushCircle.x}px`,
            top: `${paintBrushCircle.y}px`,
            width: `${paintBrushCircle.radius * 2}px`,
          }}
        />
      ) : null}
      {sectionLineStyle ? (
        <div
          className={`decor3d-section-line${sectionLine?.pending ? ' is-pending' : ''}`}
          style={sectionLineStyle}
        />
      ) : null}
      {sectionStatus ? <div className="decor3d-section-status">{sectionStatus}</div> : null}
      {webglError ? <div className="decor3d-webgl-error">{webglError}</div> : null}
      {!webglError && previewStatus ? <div className="decor3d-preview-status">{previewStatus}</div> : null}
    </div>
  );
}
