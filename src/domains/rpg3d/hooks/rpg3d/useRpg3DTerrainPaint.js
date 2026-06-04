import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ARCADE_CONFIG,
  DEFAULT_FLOOR_ZERO_Z,
  FLAT_GROUND_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_OPACITY,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  TERRAIN_PAINT_MAX_RADIUS,
  TERRAIN_PAINT_MIN_RADIUS,
  clamp,
  getFlatGroundPlateauColor,
  getHexColor,
  getTerrainPaintColor,
  getTerrainPaintOpacity,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  isFlatGroundPlateauProp,
} from '../../../../shared/utils/rpg3dDomain.js';
import { normalizeTerrainPaintPoint } from '../../../../shared/utils/rpg3dMapEditing.js';

const TERRAIN_PAINT_FLUSH_INTERVAL_MS = 32;

const getNow = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const shouldAppendTerrainPaintPoint = (stroke = {}, point = {}) => {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  const previous = points[points.length - 1];
  if (!previous) return true;
  const spacing = Math.max(10, getTerrainPaintRadius(stroke) * 0.18);
  return distance(previous, point) >= spacing;
};

export function useRpg3DTerrainPaint({
  config,
  configRef,
  createId,
  mode,
  modeRef,
  patchConfig,
  patchConfigWithoutHistory,
  setActionZoneEdgeInsertMode,
  setCameraTargetPickMode,
  setCameraZoomDragMode,
  setDragMode,
  setMode,
  setMultiSelectMode,
  setMultiSelected,
  setPendingPlacement,
  setSelected,
  setTool,
  setTransformTool,
  tool,
} = {}) {
  const terrainPaintSessionRef = useRef(null);
  const terrainPaintPendingPointsRef = useRef([]);
  const terrainPaintLastPointRef = useRef(null);
  const terrainPaintFlushTimerRef = useRef(null);
  const terrainPaintLastFlushRef = useRef(0);
  const [terrainPaintDraft, setTerrainPaintDraft] = useState({
    color: TERRAIN_PAINT_DEFAULT_COLOR,
    radius: TERRAIN_PAINT_DEFAULT_RADIUS,
    opacity: TERRAIN_PAINT_DEFAULT_OPACITY,
    shape: TERRAIN_PAINT_DEFAULT_SHAPE,
  });
  const [flatGroundColorDraft, setFlatGroundColorDraft] = useState(FLAT_GROUND_DEFAULT_COLOR);

  const clearTerrainPaintFlushTimer = useCallback(() => {
    if (terrainPaintFlushTimerRef.current === null) return;
    window.clearTimeout(terrainPaintFlushTimerRef.current);
    terrainPaintFlushTimerRef.current = null;
  }, []);

  const flushTerrainPaintPoints = useCallback(() => {
    clearTerrainPaintFlushTimer();
    const strokeId = terrainPaintSessionRef.current;
    const queuedPoints = terrainPaintPendingPointsRef.current;
    terrainPaintPendingPointsRef.current = [];
    terrainPaintLastFlushRef.current = getNow();
    if (!strokeId || !queuedPoints.length) return;
    patchConfigWithoutHistory((next) => {
      const stroke = (next.terrainPaintStrokes || []).find((item) => item.id === strokeId);
      if (!stroke) return;
      stroke.points = Array.isArray(stroke.points) ? stroke.points : [];
      queuedPoints.forEach((paintPoint) => {
        if (shouldAppendTerrainPaintPoint(stroke, paintPoint)) stroke.points.push(paintPoint);
      });
    }, false);
  }, [clearTerrainPaintFlushTimer, patchConfigWithoutHistory]);

  const scheduleTerrainPaintFlush = useCallback(() => {
    if (terrainPaintFlushTimerRef.current !== null) return;
    const wait = Math.max(0, TERRAIN_PAINT_FLUSH_INTERVAL_MS - (getNow() - terrainPaintLastFlushRef.current));
    terrainPaintFlushTimerRef.current = window.setTimeout(() => {
      terrainPaintFlushTimerRef.current = null;
      flushTerrainPaintPoints();
    }, wait);
  }, [flushTerrainPaintPoints]);

  useEffect(() => () => {
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
  }, [clearTerrainPaintFlushTimer]);

  useEffect(() => {
    if (mode === 'edit' && tool === 'terrainPaint') return;
    flushTerrainPaintPoints();
    terrainPaintSessionRef.current = null;
    terrainPaintLastPointRef.current = null;
    terrainPaintPendingPointsRef.current = [];
  }, [flushTerrainPaintPoints, mode, tool]);

  const addFlatGroundToCanvas = useCallback(() => {
    const baseColor = getFlatGroundPlateauColor(configRef.current, flatGroundColorDraft);
    patchConfig((next) => {
      const world = next.world || DEFAULT_ARCADE_CONFIG.world;
      const width = Math.max(12, Math.round(Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width));
      const height = Math.max(12, Math.round(Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height));
      next.props = Array.isArray(next.props) ? next.props : [];
      const existingIndex = next.props.findIndex((prop) => isFlatGroundPlateauProp(prop, world));
      const existing = existingIndex >= 0 ? next.props[existingIndex] : null;
      const plateau = {
        ...(existing || {}),
        id: existing?.id || createId('prop'),
        name: 'Sol plat',
        decorKind: 'road',
        x: Math.round(width / 2),
        y: Math.round(height / 2),
        z: 0,
        floorZeroZ: DEFAULT_FLOOR_ZERO_Z,
        rotation: 0,
        modelRotationX: 0,
        modelRotationY: 0,
        modelRotationZ: 0,
        modelCenterOnOrigin: true,
        modelFlushToGround: false,
        r: Math.round(Math.max(width, height) / 2),
        w: width,
        h: height,
        modelHeight: 12,
        renderMode: 'floor',
        blocksMovement: false,
        imageData: '',
        imageName: '',
        repeatTexture: false,
        baseColor,
        floorColor: baseColor,
      };
      if (existingIndex >= 0) {
        const keptProps = next.props
          .filter((prop, index) => index === existingIndex || !isFlatGroundPlateauProp(prop, world));
        const keptIndex = keptProps.findIndex((prop) => prop.id === existing.id);
        keptProps[keptIndex] = plateau;
        next.props = keptProps;
      } else {
        next.props.push(plateau);
      }
      setSelected(null);
      setMultiSelected([]);
    }, false);
    setMode('edit');
    setTool('select');
    setPendingPlacement(null);
    setTransformTool('');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
  }, [
    configRef,
    createId,
    flatGroundColorDraft,
    patchConfig,
    setCameraTargetPickMode,
    setDragMode,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setTool,
    setTransformTool,
  ]);

  const updateFlatGroundColor = useCallback((value) => {
    const color = getHexColor(value, FLAT_GROUND_DEFAULT_COLOR);
    setFlatGroundColorDraft(color);
    const liveConfig = configRef.current || DEFAULT_ARCADE_CONFIG;
    const hasPlateau = (liveConfig.props || []).some((prop) => isFlatGroundPlateauProp(prop, liveConfig.world));
    if (!hasPlateau) return;
    patchConfigWithoutHistory((next) => {
      (next.props || []).forEach((prop) => {
        if (!isFlatGroundPlateauProp(prop, next.world)) return;
        prop.baseColor = color;
        prop.floorColor = color;
      });
    }, false);
  }, [configRef, patchConfigWithoutHistory]);

  const updateTerrainPaintDraft = useCallback((field, value) => {
    setTerrainPaintDraft((current) => {
      if (field === 'color') return { ...current, color: getHexColor(value, TERRAIN_PAINT_DEFAULT_COLOR) };
      if (field === 'radius') {
        const radius = Number(value);
        return {
          ...current,
          radius: clamp(Number.isFinite(radius) ? radius : TERRAIN_PAINT_DEFAULT_RADIUS, TERRAIN_PAINT_MIN_RADIUS, TERRAIN_PAINT_MAX_RADIUS),
        };
      }
      if (field === 'opacity') {
        const opacity = Number(value);
        return { ...current, opacity: clamp(Number.isFinite(opacity) ? opacity : TERRAIN_PAINT_DEFAULT_OPACITY, 0.12, 1) };
      }
      if (field === 'shape') return { ...current, shape: getTerrainPaintShape({ shape: value }) };
      return current;
    });
  }, []);

  const clearTerrainPaint = useCallback(() => {
    if (!(configRef.current?.terrainPaintStrokes || []).length) return;
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
    terrainPaintLastPointRef.current = null;
    terrainPaintSessionRef.current = null;
    patchConfig((next) => {
      next.terrainPaintStrokes = [];
    }, false);
  }, [clearTerrainPaintFlushTimer, configRef, patchConfig]);

  const handleTerrainPaintStart = useCallback((point) => {
    if (!point || modeRef.current !== 'edit') return;
    const strokeId = createId('paint');
    clearTerrainPaintFlushTimer();
    terrainPaintPendingPointsRef.current = [];
    terrainPaintSessionRef.current = strokeId;
    setSelected(null);
    setMultiSelected([]);
    patchConfig((next) => {
      const paintPoint = normalizeTerrainPaintPoint(point, next.world);
      terrainPaintLastPointRef.current = paintPoint;
      next.terrainPaintStrokes = Array.isArray(next.terrainPaintStrokes) ? next.terrainPaintStrokes : [];
      next.terrainPaintStrokes.push({
        id: strokeId,
        color: getTerrainPaintColor(terrainPaintDraft),
        radius: getTerrainPaintRadius(terrainPaintDraft),
        opacity: getTerrainPaintOpacity(terrainPaintDraft),
        shape: getTerrainPaintShape(terrainPaintDraft),
        points: [paintPoint],
      });
    }, false);
  }, [
    clearTerrainPaintFlushTimer,
    createId,
    modeRef,
    patchConfig,
    setMultiSelected,
    setSelected,
    terrainPaintDraft,
  ]);

  const handleTerrainPaintMove = useCallback((point) => {
    const strokeId = terrainPaintSessionRef.current;
    if (!strokeId || !point) return;
    const currentStroke = (configRef.current?.terrainPaintStrokes || []).find((stroke) => stroke.id === strokeId);
    if (!currentStroke) return;
    const paintPoint = normalizeTerrainPaintPoint(point, configRef.current?.world);
    const previousPoint = terrainPaintLastPointRef.current
      || currentStroke.points?.[currentStroke.points.length - 1];
    const spacing = Math.max(10, getTerrainPaintRadius(currentStroke) * 0.18);
    if (previousPoint && distance(previousPoint, paintPoint) < spacing) return;
    terrainPaintLastPointRef.current = paintPoint;
    terrainPaintPendingPointsRef.current.push(paintPoint);
    scheduleTerrainPaintFlush();
  }, [configRef, scheduleTerrainPaintFlush]);

  const handleTerrainPaintEnd = useCallback(() => {
    flushTerrainPaintPoints();
    terrainPaintSessionRef.current = null;
    terrainPaintLastPointRef.current = null;
  }, [flushTerrainPaintPoints]);

  const handleToggleTerrainPaint = useCallback(() => {
    setMode('edit');
    setTool((current) => (current === 'terrainPaint' ? 'select' : 'terrainPaint'));
    setTransformTool('');
    setPendingPlacement(null);
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setActionZoneEdgeInsertMode(false);
  }, [
    setActionZoneEdgeInsertMode,
    setCameraTargetPickMode,
    setCameraZoomDragMode,
    setDragMode,
    setMode,
    setMultiSelectMode,
    setPendingPlacement,
    setTool,
    setTransformTool,
  ]);

  return {
    addFlatGroundToCanvas,
    clearTerrainPaint,
    flatGroundColorValue: getFlatGroundPlateauColor(config, flatGroundColorDraft),
    handleTerrainPaintEnd,
    handleTerrainPaintMove,
    handleTerrainPaintStart,
    handleToggleTerrainPaint,
    terrainPaintDraft,
    terrainPaintStrokeCount: config.terrainPaintStrokes?.length || 0,
    updateFlatGroundColor,
    updateTerrainPaintDraft,
  };
}

export default useRpg3DTerrainPaint;
