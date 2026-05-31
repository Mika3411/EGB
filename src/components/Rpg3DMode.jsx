import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Crosshair,
  Cuboid,
  FolderOpen,
  HeartPulse,
  List,
  Magnet,
  Map as MapIcon,
  Mountain,
  PanelLeftOpen,
  PanelRightOpen,
  Wrench,
} from 'lucide-react';

import Rpg3DHeader from './rpg3d/Rpg3DHeader.jsx';
import Rpg3DInspector from './rpg3d/Rpg3DInspector.jsx';
import Rpg3DMapPanel from './rpg3d/Rpg3DMapPanel.jsx';
import Rpg3DNpcChoiceOverlay from './rpg3d/Rpg3DNpcChoiceOverlay.jsx';
import Rpg3DStage from './rpg3d/Rpg3DStage.jsx';
import ArcadeCanvasManagerTab from './rpg3d/ArcadeCanvasManagerTab.jsx';
import ArcadeHeroTab from './rpg3d/ArcadeHeroTab.jsx';
import ArcadeManagementTab from './rpg3d/ArcadeManagementTab.jsx';
import ArcadeMapAssetExplorer from './rpg3d/ArcadeMapAssetExplorer.jsx';
import Rpg3DWorkspaceTabs from './rpg3d/Rpg3DWorkspaceTabs.jsx';

import useRpg3DGameLoop from '../hooks/useRpg3DGameLoop.js';
import useRpg3DProjectState from '../hooks/useRpg3DProjectState.js';
import useRpg3DActionZoneEditing from '../hooks/rpg3d/useRpg3DActionZoneEditing.js';
import useRpg3DCanvasManagement from '../hooks/rpg3d/useRpg3DCanvasManagement.js';
import useRpg3DDeleteShortcut from '../hooks/rpg3d/useRpg3DDeleteShortcut.js';
import useRpg3DEditingCommands from '../hooks/rpg3d/useRpg3DEditingCommands.js';
import useRpg3DMapHandlers from '../hooks/rpg3d/useRpg3DMapHandlers.js';
import useRpg3DModeActions from '../hooks/rpg3d/useRpg3DModeActions.js';
import useRpg3DPlacement from '../hooks/rpg3d/useRpg3DPlacement.js';
import useRpg3DSaveSync from '../hooks/rpg3d/useRpg3DSaveSync.js';
import useRpg3DSelectionState from '../hooks/rpg3d/useRpg3DSelectionState.js';
import useRpg3DStudioAssets from '../hooks/rpg3d/useRpg3DStudioAssets.js';
import useRpg3DTerrainPaint from '../hooks/rpg3d/useRpg3DTerrainPaint.js';
import {
  getStudioModelSource,
} from '../utils/rpg3dAssetsCore.js';
import { lazyWithRetry } from '../utils/lazyImportRetry.js';
import {
  canResizeSelectionEntity,
  clampArcadeEntitiesToWorld,
  getSelectedEntity,
  getSelectionEntities,
  moveMapEntityByDelta,
  moveMapEntityToPoint,
  resizeActionZoneGeometry,
  scaleSelectionEntity,
  snapFlatTileToNeighbors,
  snapFlatTileToWorldEdges,
} from '../utils/rpg3dMapEditing.js';
import {
  ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
  ACTION_ZONE_DEFAULT_OPACITY,
  DEFAULT_ARCADE_CONFIG,
  ENTITY_Z_MAX,
  ENTITY_Z_MIN,
  FLOOR_ZERO_Z_MAX,
  FLOOR_ZERO_Z_MIN,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  MODEL_ERASER_DEFAULT_RADIUS,
  MODEL_ERASER_MAX_RADIUS,
  MODEL_ERASER_MAX_STROKES,
  MODEL_ERASER_MIN_RADIUS,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  TERRAIN_PAINT_MAX_RADIUS,
  TERRAIN_PAINT_MIN_RADIUS,
  clamp,
  createModelEraserSurfaceStroke,
  getActionZoneHeight,
  getActionZoneType,
  getActionZoneWidth,
  getEntityZ,
  getFloorTileWorldSize,
  getFloorZeroZ,
  getModelEraserRadius,
  getModelEraserStrokes,
  getPropRenderMode,
  getSelectionBoundsFromEntities,
  getTerrainPaintColor,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  getWorldCoverTileSize,
  isFlatTileLikeProp,
  isFloorTileProp,
  normalizeDegrees,
} from '../utils/rpg3dDomain.js';
import {
  CAMERA_DISTANCE_MIN,
  CAMERA_DISTANCE_MAX,
  CAMERA_ZOOM_DRAG_SENSITIVITY,
  RPG3D_ACTION_LOADING_DURATION_MS,
  RPG3D_FIELD_HELP,
  RELIEF_STYLE_OPTIONS,
  NUMERIC_ENTITY_FIELDS,
  TERRAIN_PAINT_SHAPE_OPTIONS,
  ROTATABLE_ENTITY_TYPES,
  isEditableShortcutTarget,
  isProtectedMapEntity,
  getDeletableSelectionEntities,
  isDuplicableSelectionEntity,
  createNewArcadeConfig,
  modelEraserHitDistance,
  normalizeModelEraserHit,
  createId,
  getModelRotationValue,
  getEntityRotation,
  getArcadeObjectCount,
  canEntityLevitate,
  getSelectedEntityTypeLabel,
  canMultiSelectEntity,
  getStudioCharacterRenderMode,
  getDecorImportRenderMode,
  getDecorModelWorldSize,
  getPlacementCameraDistance,
  applyCharacterModelToActor,
  getRigObjectEquipmentType,
  ensureRigObjectEquipmentDefaults,
  guessCharacterRenderMode,
  readArcadeImageFile,
  createNpcChoice,
  createDefaultNpcChoices,
  getNpcInteractionMode,
  getNpcChoiceItems,
  getNpcQuestionText,
  getActionZoneNpcLabel,
  guessPropRenderMode,
  shouldPropBlockByMode,
  getReliefStyle,
  getCommonSelectionNumericValue,
  getSelectionDuplicateOffset,
} from './rpg3d/rpg3dModeShared.js';

const Character3DTab = lazyWithRetry(() => import('./Character3DTab.jsx'));
const CharacterRiggingTab = lazyWithRetry(() => import('./CharacterRiggingTab.jsx'));
const Decor3DTab = lazyWithRetry(() => import('./Decor3DTab.jsx'));
const ModelToolsTab = lazyWithRetry(() => import('./ModelToolsTab.jsx'));
const ObjectRiggingTab = lazyWithRetry(() => import('./ObjectRiggingTab.jsx'));
const StuntAnimationTab = lazyWithRetry(() => import('./StuntAnimationTab.jsx'));

function Rpg3DMode({ user = null, authorProfile = null, authReady = true, project = null, projectId = '' }) {
  const wrapperRef = useRef(null);
  const multiDragRef = useRef(null);
  const lastFrameRef = useRef(0);
  const actionZoneTriggerRef = useRef({ key: '', cooldownUntil: 0 });
  const activateRpg3DCanvasPortalRef = useRef(() => false);
  const loadingBarSequenceRef = useRef(0);
  const modelEraserSessionRef = useRef(null);
  const modelEraserLastPointRef = useRef(null);
  const [mode, setMode] = useState('edit');
  const [tool, setTool] = useState('select');
  const [dragMode, setDragMode] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [cameraTargetPickMode, setCameraTargetPickMode] = useState(false);
  const [cameraZoomDragMode, setCameraZoomDragMode] = useState(false);
  const [actionZoneEdgeInsertMode, setActionZoneEdgeInsertMode] = useState(false);
  const [cameraToolsHidden, setCameraToolsHidden] = useState(false);
  const [transformTool, setTransformTool] = useState('');
  const [scaleProportionalAxes, setScaleProportionalAxes] = useState({ x: true, y: true, z: true });
  const [modelEraserRadiusDraft, setModelEraserRadiusDraft] = useState(MODEL_ERASER_DEFAULT_RADIUS);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [activeNpcChoice, setActiveNpcChoice] = useState(null);
  const [rpg3DLoadingBar, setRpg3DLoadingBar] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('arcade');
  const [rigCharacterEquipmentTest, setRigCharacterEquipmentTest] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false);
  const localModelScope = useMemo(() => ({
    projectId: projectId || project?.id || project?.projectId || '',
    userId: user?.id || '',
  }), [project?.id, project?.projectId, projectId, user?.id]);

  const {
    handleMarqueeSelect,
    multiSelected,
    selectSingleEntity,
    selected,
    selectedRef,
    setMultiSelected,
    setSelected,
    toggleMultiSelectedEntity,
  } = useRpg3DSelectionState({
    canMultiSelectEntity,
    setIsPaused,
    setMode,
    setTool,
  });
  const modeRef = useRef(mode);

  modeRef.current = mode;

  const showRpg3DLoadingBar = useCallback((options = {}) => {
    loadingBarSequenceRef.current += 1;
    const durationMs = Math.max(400, Number(options.durationMs) || RPG3D_ACTION_LOADING_DURATION_MS);
    setRpg3DLoadingBar({
      key: `rpg3d-loading-${loadingBarSequenceRef.current}`,
      tone: options.tone || 'action',
      label: options.label || 'Activation',
      detail: options.detail || '',
      durationMs,
    });
  }, []);

  useEffect(() => {
    if (!rpg3DLoadingBar) return undefined;
    const timeoutId = window.setTimeout(() => {
      setRpg3DLoadingBar((current) => (
        current?.key === rpg3DLoadingBar.key ? null : current
      ));
    }, rpg3DLoadingBar.durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [rpg3DLoadingBar]);

  useEffect(() => {
    if (mode !== 'play') setRpg3DLoadingBar(null);
  }, [mode]);

  const {
    autosaveVersionRef,
    clearHistoryStacks,
    config,
    configRef,
    initialArcadeAssets,
    lastSavedAutosaveVersionRef,
    markAutosaveDirty,
    patchConfig,
    patchConfigWithoutHistory,
    patchStudioProject,
    pushHistorySnapshot,
    redoProjectChange,
    redoStack,
    resetGame,
    setConfig,
    setSnapshot: setGameSnapshot,
    setStudioProject,
    snapshot: projectRuntimeSnapshot,
    stateRef: projectStateRef,
    studioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    undoProjectChange,
    undoStack,
  } = useRpg3DProjectState({
    project,
    selectedRef,
    modeRef,
    actionZoneTriggerRef,
    lastFrameRef,
    setActiveNpcChoice,
  });

  const savedArcadeAssets = initialArcadeAssets.saved;

  const {
    isSavingAssets,
    managementSaveStatus,
    saveArcadeAssets,
  } = useRpg3DSaveSync({
    authReady,
    autosaveVersionRef,
    clearHistoryStacks,
    configRef,
    lastSavedAutosaveVersionRef,
    project,
    projectId: localModelScope.projectId,
    resetGame,
    savedArcadeAssets,
    setConfig,
    setStudioProject,
    studioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    user,
    workspaceTab,
  });

  useEffect(() => {
    if (workspaceTab !== 'arcade') {
      setMapFullscreen(false);
      setMapDrawerOpen(false);
    }
  }, [workspaceTab]);

  useEffect(() => {
    if (mode === 'edit' && tool === 'modelEraser') return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
  }, [mode, tool]);

  const patchViewportEngineConfig = useCallback((recipe) => {
    const currentConfig = configRef.current || DEFAULT_ARCADE_CONFIG;
    const currentEngine = { ...DEFAULT_ARCADE_CONFIG.engine, ...(currentConfig.engine || {}) };
    const nextEngine = { ...currentEngine };
    recipe(nextEngine);
    const changed = Object.keys(nextEngine).some((key) => nextEngine[key] !== currentEngine[key]);
    if (!changed) return;
    const nextConfig = { ...currentConfig, engine: nextEngine };
    configRef.current = nextConfig;
    syncActiveCanvasConfigInRef(nextConfig);
    setConfig(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, syncActiveCanvasConfigInRef]);

  const handleCameraZoomDrag = useCallback((deltaY) => {
    const movement = Number(deltaY) || 0;
    if (!movement) return;
    patchViewportEngineConfig((engine) => {
      const currentDistance = Number(engine.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
      engine.cameraDistance = clamp(
        currentDistance + movement * CAMERA_ZOOM_DRAG_SENSITIVITY,
        CAMERA_DISTANCE_MIN,
        CAMERA_DISTANCE_MAX,
      );
    });
  }, [patchViewportEngineConfig]);

  useEffect(() => {
    if (workspaceTab !== 'canvases') return;
    syncActiveCanvasConfigInRef(configRef.current, { updateState: true });
  }, [syncActiveCanvasConfigInRef, workspaceTab]);

  const handleActionZoneTriggered = useCallback((zone, context = {}) => {
    const actionType = context.actionType || getActionZoneType(zone);
    if (actionType === 'portal') return;
    const zoneName = String(zone?.name || zone?.message || '').trim();
    showRpg3DLoadingBar({
      tone: 'action',
      label: actionType === 'npcAction' ? 'Action PNJ' : 'Zone d action',
      detail: zoneName || 'Activation de la zone',
      durationMs: RPG3D_ACTION_LOADING_DURATION_MS,
    });
  }, [showRpg3DLoadingBar]);

  const activateRpg3DCanvasPortalForLoop = useCallback((canvasId) => (
    activateRpg3DCanvasPortalRef.current?.(canvasId) || false
  ), []);

  const {
    clearInputState,
    pointerRef,
    setPlayerMoveTarget,
    setPointerShooting,
    snapshot,
    stateRef,
    updateWorldPointer,
  } = useRpg3DGameLoop({
    activateRpg3DCanvasPortal: activateRpg3DCanvasPortalForLoop,
    actionZoneTriggerRef,
    configRef,
    getActionZoneNpcLabel,
    getNpcChoiceItems,
    getNpcInteractionMode,
    getNpcQuestionText,
    isPaused,
    lastFrameRef,
    mode,
    onActionZoneTriggered: handleActionZoneTriggered,
    setActiveNpcChoice,
    setIsPaused,
    setSnapshot: setGameSnapshot,
    snapshot: projectRuntimeSnapshot,
    stateRef: projectStateRef,
    workspaceTab,
  });

  const {
    beginEntityPlacement,
    commitPendingPlacement,
    getCurrentPlacementPoint,
    pendingPlacement,
    setPendingPlacement,
  } = useRpg3DPlacement({
    canMultiSelectEntity,
    configRef,
    getPlacementCameraDistance,
    patchConfigWithoutHistory,
    patchViewportEngineConfig,
    pointerRef,
    setCameraTargetPickMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setSelected,
    setTool,
  });

  const {
    createStudioCharacter,
    createStudioDecor,
    deleteStudioCharacter,
    deleteStudioDecor,
    editStudioCharacter,
    editStudioDecor,
    handleStudioUpload,
    importStudioCharacterToCanvas,
    importStudioDecorToCanvas,
    renameStudioCharacter,
    renameStudioDecor,
    setSelectedPropImage,
    setStudioSelection,
    studioSelection,
  } = useRpg3DStudioAssets({
    applyCharacterModelToActor,
    beginEntityPlacement,
    createId,
    getCurrentPlacementPoint,
    getDecorImportRenderMode,
    getDecorModelWorldSize,
    getModelRotationValue,
    getStudioCharacterRenderMode,
    guessCharacterRenderMode,
    guessPropRenderMode,
    markAutosaveDirty,
    patchConfig,
    patchStudioProject,
    pushHistorySnapshot,
    readArcadeImageFile,
    selected,
    setMediaError,
    setStudioProject,
    setWorkspaceTab,
    shouldPropBlockByMode,
    studioProject,
    studioProjectRef,
  });

  const {
    addFlatGroundToCanvas,
    clearTerrainPaint,
    flatGroundColorValue,
    handleTerrainPaintEnd,
    handleTerrainPaintMove,
    handleTerrainPaintStart,
    handleToggleTerrainPaint,
    terrainPaintDraft,
    terrainPaintStrokeCount,
    updateFlatGroundColor,
    updateTerrainPaintDraft,
  } = useRpg3DTerrainPaint({
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
  });

  const {
    activeRpg3DCanvas,
    activeRpg3DCanvasId,
    activateRpg3DCanvasPortal,
    createRpg3DAct,
    createRpg3DCanvas,
    deleteRpg3DAct,
    deleteRpg3DCanvas,
    keepOnlyActiveRpg3DCanvas,
    moveRpg3DCanvasToAct,
    renameRpg3DAct,
    renameRpg3DCanvas,
    rpg3DCanvasOptions,
    selectRpg3DCanvas,
  } = useRpg3DCanvasManagement({
    actionZoneTriggerRef,
    configRef,
    createId,
    markAutosaveDirty,
    playMode: mode === 'play',
    pushHistorySnapshot,
    resetGame,
    setConfig,
    setIsPaused,
    setMode,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    showRpg3DLoadingBar,
    studioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  });

  activateRpg3DCanvasPortalRef.current = activateRpg3DCanvasPortal;

  const {
    handleCameraTargetPick,
    handlePauseOrReset,
    handleTogglePlayMode,
    toggleCameraTargetPickMode,
  } = useRpg3DModeActions({
    clearInputState,
    configRef,
    mode,
    modeRef,
    resetGame,
    selected,
    setCameraTargetPickMode,
    setCameraZoomDragMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setPendingPlacement,
    setTool,
    setTransformTool,
    stateRef,
    workspaceTab,
  });

  const {
    addSelectedNpcChoice,
    closeNpcChoice,
    handleActionZoneEdgeDrag,
    handleActionZoneEdgeDragStart,
    handleActionZoneEdgeInsert,
    handleActionZoneTypeChange,
    handleActionZoneVertexDrag,
    handleActionZoneVertexDragStart,
    handleNpcChoiceSelect,
    handleNpcInteractionModeChange,
    handleSelectActionZoneTool,
    handleToggleActionZoneEdgeInsertMode,
    removeSelectedNpcChoice,
    updateSelectedNpcChoice,
  } = useRpg3DActionZoneEditing({
    actionZoneEdgeInsertMode,
    createDefaultNpcChoices,
    createNpcChoice,
    getNpcChoiceItems,
    mode,
    modeRef,
    patchConfig,
    patchConfigWithoutHistory,
    pushHistorySnapshot,
    selected,
    selectedRef,
    setActionZoneEdgeInsertMode,
    setActiveNpcChoice,
    setCameraTargetPickMode,
    setCameraZoomDragMode,
    setDragMode,
    setGameSnapshot,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setTool,
    setTransformTool,
    stateRef,
    studioProjectRef,
  });

  const testRigObjectOnCharacter = useCallback(({ decorModelId = '', characterModelId = '' } = {}) => {
    const currentProject = studioProjectRef.current || studioProject;
    const sourceModel = (currentProject.decorModels3d || []).find((model) => model.id === decorModelId);
    const targetCharacter = (currentProject.characterModels3d || []).find((model) => model.id === characterModelId);
    if (!sourceModel || !targetCharacter) return;
    const equipmentType = getRigObjectEquipmentType(sourceModel);
    patchStudioProject((draft) => {
      const decorModel = (draft.decorModels3d || []).find((model) => model.id === sourceModel.id);
      if (!decorModel) return;
      ensureRigObjectEquipmentDefaults(decorModel, equipmentType);
    }, { rememberHistory: false });
    setRigCharacterEquipmentTest({
      decorModelId: sourceModel.id,
      characterModelId: targetCharacter.id,
      type: equipmentType,
    });
    setStudioSelection((current) => ({
      ...current,
      characterModelId: targetCharacter.id,
      decorModelId: sourceModel.id,
    }));
    setWorkspaceTab('characters3d');
  }, [patchStudioProject, setStudioSelection, setWorkspaceTab, studioProject, studioProjectRef]);

  useEffect(() => {
    if (rigCharacterEquipmentTest && workspaceTab !== 'characters3d') {
      setRigCharacterEquipmentTest(null);
    }
  }, [rigCharacterEquipmentTest, workspaceTab]);

  const createNewProject = useCallback(() => {
    if (!window.confirm('Creer un nouveau projet RPG 3D ? La carte actuelle sera remplacee.')) return;
    const next = createNewArcadeConfig();
    pushHistorySnapshot();
    configRef.current = next;
    setConfig(next);
    markAutosaveDirty();
    setMode('edit');
    setIsPaused(false);
    setSelected(null);
    setTool('select');
    setWorkspaceTab('arcade');
    resetGame(next);
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame]);

  const updateArcadeWorldField = useCallback((field, rawValue) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const limits = {
      width: { min: 1200, max: 9000, shouldReset: true },
      height: { min: 900, max: 7000, shouldReset: true },
      grid: { min: 40, max: 240, shouldReset: false },
    }[field];
    if (!limits) return;
    patchConfig((next) => {
      next.world[field] = clamp(Math.round(value), limits.min, limits.max);
      if (field !== 'grid') clampArcadeEntitiesToWorld(next);
    }, limits.shouldReset);
  }, [patchConfig]);

  const appendModelEraserStroke = useCallback((point, entity, withHistory = false) => {
    if (!point || !entity?.id || entity.type !== 'prop') return false;
    let didAppend = false;
    const recipe = (next) => {
      const currentProp = getSelectedEntity(next, entity);
      if (!currentProp?.item || getPropRenderMode(currentProp.item) !== 'glb') return;
      const radius = getModelEraserRadius({
        modelEraserRadius: currentProp.item.modelEraserRadius ?? modelEraserRadiusDraft,
      });
      const stroke = createModelEraserSurfaceStroke(point, radius, createId('erase'));
      if (!stroke) return;
      currentProp.item.modelEraserRadius = radius;
      currentProp.item.modelEraserStrokes = [
        ...getModelEraserStrokes(currentProp.item),
        stroke,
      ].slice(-MODEL_ERASER_MAX_STROKES);
      didAppend = true;
    };
    if (withHistory) patchConfig(recipe, false);
    else patchConfigWithoutHistory(recipe, false);
    if (didAppend) modelEraserLastPointRef.current = normalizeModelEraserHit(point);
    return didAppend;
  }, [modelEraserRadiusDraft, patchConfig, patchConfigWithoutHistory]);

  const handleModelEraseStart = useCallback((point) => {
    if (!point || modeRef.current !== 'edit') return;
    const target = selectedRef.current;
    const currentProp = getSelectedEntity(configRef.current, target);
    if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
    modelEraserSessionRef.current = { entity: { type: target.type, id: target.id } };
    modelEraserLastPointRef.current = null;
    setMultiSelected([]);
    appendModelEraserStroke(point, target, true);
  }, [appendModelEraserStroke, configRef]);

  const handleModelEraseMove = useCallback((point) => {
    const session = modelEraserSessionRef.current;
    if (!session?.entity || !point) return;
    const currentProp = getSelectedEntity(configRef.current, session.entity);
    if (!currentProp?.item || getPropRenderMode(currentProp.item) !== 'glb') return;
    const radius = getModelEraserRadius(currentProp.item);
    const previousPoint = modelEraserLastPointRef.current;
    const spacing = Math.max(8, radius * 0.2);
    if (previousPoint && modelEraserHitDistance(previousPoint, point) < spacing) return;
    appendModelEraserStroke(point, session.entity, false);
  }, [appendModelEraserStroke, configRef]);

  const handleModelEraseEnd = useCallback(() => {
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
  }, []);

  const updateEntity = useCallback((field, rawValue) => {
    const value = NUMERIC_ENTITY_FIELDS.has(field) ? Number(rawValue) : rawValue;
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, selected);
      if (!selectedEntity?.item) return;
      if (selectedEntity.type === 'actionZone' && ['x', 'y', 'w', 'h'].includes(field)) {
        if (field === 'x' || field === 'y') {
          moveMapEntityToPoint(next, selected, {
            x: field === 'x' ? value : Number(selectedEntity.item.x) || 0,
            y: field === 'y' ? value : Number(selectedEntity.item.y) || 0,
          });
          return;
        }
        resizeActionZoneGeometry(selectedEntity.item, next.world, {
          width: field === 'w' ? value : getActionZoneWidth(selectedEntity.item),
          height: field === 'h' ? value : getActionZoneHeight(selectedEntity.item),
        });
        return;
      }
      selectedEntity.item[field] = field === 'rotation' ? normalizeDegrees(value) : value;
      if (field === 'x') selectedEntity.item.x = clamp(value, 0, next.world.width);
      if (field === 'y') selectedEntity.item.y = clamp(value, 0, next.world.height);
      if (field === 'z') selectedEntity.item.z = clamp(value, ENTITY_Z_MIN, ENTITY_Z_MAX);
      if (field === 'floorZeroZ') selectedEntity.item.floorZeroZ = clamp(value, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
      if (field === 'characterModelScale') {
        const scale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
        selectedEntity.item.characterModelScale = scale;
        selectedEntity.item.characterModelScaleY = scale;
        if (selectedEntity.item.characterModelScaleProportional !== false) {
          selectedEntity.item.characterModelScaleX = scale;
          selectedEntity.item.characterModelScaleZ = scale;
        }
      }
      if (field === 'characterModelScaleX' || field === 'characterModelScaleY' || field === 'characterModelScaleZ') {
        selectedEntity.item[field] = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
        if (field === 'characterModelScaleY') selectedEntity.item.characterModelScale = selectedEntity.item[field];
      }
      if (field === 'characterMaterialBrightness') selectedEntity.item.characterMaterialBrightness = clamp(value, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
      if (field === 'decorModelScale') selectedEntity.item.decorModelScale = clamp(value, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
      if (field === 'materialBrightness') selectedEntity.item.materialBrightness = clamp(value, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
      if (field === 'modelRotationX' || field === 'modelRotationY' || field === 'modelRotationZ') {
        selectedEntity.item[field] = clamp(value, -180, 180);
      }
      if (selectedEntity.type === 'prop' && isFloorTileProp(selectedEntity.item) && ['w', 'h', 'r'].includes(field)) {
        const maxTileSize = getWorldCoverTileSize(next.world);
        const tileSize = field === 'r'
          ? Math.round(clamp((Number(value) || 6) * 2, 12, maxTileSize))
          : Math.round(clamp(Number(value) || getFloorTileWorldSize(selectedEntity.item), 12, maxTileSize));
        selectedEntity.item.w = tileSize;
        selectedEntity.item.h = tileSize;
        selectedEntity.item.r = Math.round(tileSize / 2);
        selectedEntity.item.modelHeight = 12;
        selectedEntity.item.blocksMovement = false;
      }
      if (selectedEntity.type === 'prop' && isFlatTileLikeProp(selectedEntity.item) && ['x', 'y'].includes(field)) {
        snapFlatTileToNeighbors(selectedEntity.item, next.props || [], next.world);
        snapFlatTileToWorldEdges(selectedEntity.item, next.world);
      }
      if (selectedEntity.type === 'actionZone') {
        if (field === 'modelHeight') selectedEntity.item.modelHeight = Math.round(clamp(Number(value) || ACTION_ZONE_DEFAULT_MODEL_HEIGHT, 60, 900));
        if (field === 'opacity') selectedEntity.item.opacity = clamp(Number(value) || ACTION_ZONE_DEFAULT_OPACITY, 0.05, 0.95);
      }
    });
  }, [patchConfig, selected]);

  const updateSelectionEntities = useCallback((field, rawValue) => {
    if (NUMERIC_ENTITY_FIELDS.has(field) && rawValue === '') return;
    const value = NUMERIC_ENTITY_FIELDS.has(field) ? Number(rawValue) : rawValue;
    const numericValue = Number(value);
    if (NUMERIC_ENTITY_FIELDS.has(field) && !Number.isFinite(numericValue)) return;
    patchConfig((next) => {
      const targets = getSelectionEntities(next, selected, multiSelected);
      if (targets.length <= 1) {
        const selectedEntity = getSelectedEntity(next, selected);
        if (!selectedEntity?.item) return;
        selectedEntity.item[field] = field === 'rotation' ? normalizeDegrees(value) : value;
        if (field === 'floorZeroZ') selectedEntity.item.floorZeroZ = clamp(numericValue, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
        return;
      }

      if (field === 'x' || field === 'y') {
        const bounds = getSelectionBoundsFromEntities(targets);
        if (!bounds) return;
        const world = next.world || DEFAULT_ARCADE_CONFIG.world;
        const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
        const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
        const targetCenterX = field === 'x'
          ? clamp(numericValue, bounds.width / 2, Math.max(bounds.width / 2, worldWidth - bounds.width / 2))
          : bounds.centerX;
        const targetCenterY = field === 'y'
          ? clamp(numericValue, bounds.height / 2, Math.max(bounds.height / 2, worldHeight - bounds.height / 2))
          : bounds.centerY;
        const delta = {
          x: targetCenterX - bounds.centerX,
          y: targetCenterY - bounds.centerY,
        };
        targets.forEach((target) => {
          moveMapEntityByDelta(next, target, delta, { snap: false });
        });
        return;
      }

      if (field === 'z') {
        targets.forEach(({ type, item }) => {
          if (canEntityLevitate(type)) item.z = clamp(numericValue, ENTITY_Z_MIN, ENTITY_Z_MAX);
        });
        return;
      }

      if (field === 'floorZeroZ') {
        targets.forEach(({ type, item }) => {
          if (type === 'prop' && isFlatTileLikeProp(item)) item.floorZeroZ = clamp(numericValue, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
        });
        return;
      }

      if (field === 'rotation') {
        targets.forEach(({ type, item }) => {
          if (ROTATABLE_ENTITY_TYPES.has(type)) item.rotation = normalizeDegrees(numericValue);
        });
      }
    });
  }, [multiSelected, patchConfig, selected]);

  const handleSelectionTransformCommit = useCallback((payload = {}) => {
    const {
      entity,
      mode: transformMode,
      rotationDelta = {},
      scaleDelta = {},
      proportionalAxes = scaleProportionalAxes,
    } = payload;
    if (!entity?.type || !entity.id) return;
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, entity);
      if (!selectedEntity?.item) return;
      const item = selectedEntity.item;
      if (transformMode === 'rotate') {
        const deltaY = Number(rotationDelta.y) || 0;
        if (ROTATABLE_ENTITY_TYPES.has(selectedEntity.type) && Math.abs(deltaY) > 0.01) {
          item.rotation = normalizeDegrees((Number(item.rotation) || 0) + deltaY);
        }
        if (selectedEntity.type === 'prop' && getPropRenderMode(item) === 'glb') {
          const deltaX = Number(rotationDelta.x) || 0;
          const deltaZ = Number(rotationDelta.z) || 0;
          if (Math.abs(deltaX) > 0.01) item.modelRotationX = clamp(getModelRotationValue(item, 'modelRotationX') + deltaX, -180, 180);
          if (Math.abs(deltaZ) > 0.01) item.modelRotationZ = clamp(getModelRotationValue(item, 'modelRotationZ') + deltaZ, -180, 180);
        }
        return;
      }
      if (transformMode === 'scale') {
        scaleSelectionEntity(next, {
          type: selectedEntity.type,
          id: entity.id,
          item,
        }, scaleDelta, { proportionalAxes });
      }
    }, false);
  }, [patchConfig, scaleProportionalAxes]);

  const {
    centerSelectedPropModel,
    deleteMapEntity,
    deleteSelected,
    duplicateSelected,
    duplicateSelectedTile,
    editMapEntity,
    flattenSelectedProp,
    flushSelectedPropToGround,
    renameMapEntity,
    resetSelectedPropOrientation,
    snapSelectedTileToNeighbor,
  } = useRpg3DEditingCommands({
    configRef,
    createId,
    getDeletableSelectionEntities,
    getSelectionDuplicateOffset,
    isDuplicableSelectionEntity,
    isProtectedMapEntity,
    multiSelected,
    patchConfig,
    selected,
    setIsPaused,
    setMode,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setTool,
    setWorkspaceTab,
  });

  useRpg3DDeleteShortcut({
    configRef,
    deleteSelected,
    getDeletableSelectionEntities,
    isEditableShortcutTarget,
    mode,
    multiSelected,
    selected,
  });

  const {
    handleMoveHoldChange,
    handleWorldClick,
    handleWorldDrag,
    handleWorldDragStart,
    handleWorldDrop,
    resolveWorldDragPoint,
  } = useRpg3DMapHandlers({
    canMultiSelectEntity,
    commitPendingPlacement,
    configRef,
    createDefaultNpcChoices,
    createId,
    duplicateSelectedTile,
    mode,
    multiDragRef,
    multiSelected,
    multiSelectMode,
    patchConfig,
    pendingPlacement,
    selectSingleEntity,
    setIsPaused,
    setMode,
    setMultiSelected,
    setPlayerMoveTarget,
    setSelected,
    setTool,
    studioProjectRef,
    toggleMultiSelectedEntity,
    tool,
  });

  const selectedEntity = useMemo(() => getSelectedEntity(config, selected), [config, selected]);
  const inspectorSelectionEntities = useMemo(
    () => getSelectionEntities(config, selected, multiSelected),
    [config, multiSelected, selected],
  );
  const hasMultiInspectorSelection = inspectorSelectionEntities.length > 1;
  const inspectorSelectionBounds = useMemo(
    () => getSelectionBoundsFromEntities(inspectorSelectionEntities),
    [inspectorSelectionEntities],
  );
  const playMode = mode === 'play';
  const engineConfig = { ...DEFAULT_ARCADE_CONFIG.engine, ...(config.engine || {}) };
  const lightIntensityValue = Number.isFinite(Number(engineConfig.lightIntensity))
    ? Number(engineConfig.lightIntensity)
    : DEFAULT_ARCADE_CONFIG.engine.lightIntensity;
  const lightOrientationValue = Number.isFinite(Number(engineConfig.lightOrientation))
    ? Number(engineConfig.lightOrientation)
    : DEFAULT_ARCADE_CONFIG.engine.lightOrientation;
  const cameraDistance = clamp(Number(engineConfig.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
  const cameraZoomPercent = Math.round((DEFAULT_ARCADE_CONFIG.engine.cameraDistance / cameraDistance) * 100);
  const selectedReliefStyle = selectedEntity?.type === 'relief'
    ? getReliefStyle(selectedEntity.item.style)
    : null;
  const studioMediaLibrary = studioProject.mediaAssets || [];
  const studioImportCharacters = studioProject.characterModels3d || [];
  const studioImportDecors = studioProject.decorModels3d || [];
  const studioCharacterModels = (studioProject.characterModels3d || []).filter((model) => getStudioModelSource(model));
  const studioHeroModels = studioCharacterModels.filter((model) => (model.role || 'hero') === 'hero');
  const studioWeaponModels = (studioProject.decorModels3d || []).filter((model) => getStudioModelSource(model));
  const actionZoneNpcTargets = [
    ...(config.heroes || []).map((hero, index) => ({
      id: hero.id,
      label: hero.name || `Heros ${index + 1}`,
    })),
    ...(config.enemies || []).map((enemy, index) => ({
      id: enemy.id,
      label: enemy.combatEnemyName || enemy.name || `Personnage ${index + 1}`,
    })),
  ];
  const workspaceTabs = [
    { id: 'arcade', label: 'Carte RPG 3D', icon: MapIcon },
    { id: 'heroes', label: 'Heros', icon: HeartPulse },
    { id: 'canvases', label: 'Canevas', icon: FolderOpen },
    { id: 'management', label: 'Gestion', icon: List },
    { id: 'characters3d', label: 'Personnages 3D', icon: Cuboid },
    { id: 'decors3d', label: 'Objets 3D', icon: Mountain },
    {
      id: 'tools',
      label: 'Outils',
      icon: Wrench,
      children: [
        { id: 'characterRigging', label: 'Rig personnage', icon: Crosshair },
        { id: 'objectRigging', label: 'Rig objets', icon: Magnet },
        { id: 'stunts', label: 'Cascadeur', icon: Activity },
        { id: 'modelTools', label: 'Outils GLB', icon: Wrench },
      ],
    },
  ];
  const showArcadeMapCard = true;
  const showArcadeInspector = true;
  const arcadeObjectCount = getArcadeObjectCount(config);
  const selectedCanRotate = ROTATABLE_ENTITY_TYPES.has(selectedEntity?.type);
  const selectedCanLevitate = canEntityLevitate(selectedEntity?.type);
  const quickSelectionCanRotate = inspectorSelectionEntities.length === 1
    && inspectorSelectionEntities.every(({ type }) => ROTATABLE_ENTITY_TYPES.has(type));
  const quickSelectionCanResize = inspectorSelectionEntities.length === 1
    && inspectorSelectionEntities.every(canResizeSelectionEntity);
  const activeTransformTool = (
    (transformTool === 'rotate' && quickSelectionCanRotate)
    || (transformTool === 'scale' && quickSelectionCanResize)
  ) ? transformTool : '';
  useEffect(() => {
    if ((transformTool === 'rotate' && !quickSelectionCanRotate)
      || (transformTool === 'scale' && !quickSelectionCanResize)) {
      setTransformTool('');
    }
  }, [quickSelectionCanResize, quickSelectionCanRotate, transformTool]);

  useEffect(() => {
    if (!cameraZoomDragMode) return;
    if (
      mode !== 'edit'
      || tool !== 'select'
      || dragMode
      || multiSelectMode
      || cameraTargetPickMode
      || pendingPlacement
      || activeTransformTool
    ) {
      setCameraZoomDragMode(false);
    }
  }, [
    activeTransformTool,
    cameraTargetPickMode,
    cameraZoomDragMode,
    dragMode,
    mode,
    multiSelectMode,
    pendingPlacement,
    tool,
  ]);
  const multiSelectionCanLevitate = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type }) => canEntityLevitate(type));
  const multiSelectionCanRotate = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type }) => ROTATABLE_ENTITY_TYPES.has(type));
  const multiSelectionCanEditActions = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(isDuplicableSelectionEntity);
  const multiSelectionAllFlatTiles = hasMultiInspectorSelection
    && inspectorSelectionEntities.every(({ type, item }) => type === 'prop' && isFlatTileLikeProp(item));
  const multiSelectionZValue = multiSelectionCanLevitate
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getEntityZ(item))
    : '';
  const multiSelectionRotationValue = multiSelectionCanRotate
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getEntityRotation(item))
    : '';
  const multiSelectionFloorZeroValue = multiSelectionAllFlatTiles
    ? getCommonSelectionNumericValue(inspectorSelectionEntities, ({ item }) => getFloorZeroZ(item), 1)
    : '';
  const selectedPropRenderMode = selectedEntity?.type === 'prop' ? getPropRenderMode(selectedEntity.item) : '';
  const selectedPropIsFloorTile = selectedEntity?.type === 'prop' && selectedPropRenderMode === 'floor';
  const selectedPropIsFlatTile = selectedEntity?.type === 'prop' && isFlatTileLikeProp(selectedEntity.item);
  const selectedPropTileSize = selectedPropIsFloorTile ? getFloorTileWorldSize(selectedEntity.item) : 0;
  const selectedPropCanEraseModel = selectedEntity?.type === 'prop' && selectedPropRenderMode === 'glb';
  const selectedModelEraserRadius = selectedPropCanEraseModel
    ? getModelEraserRadius(selectedEntity.item)
    : modelEraserRadiusDraft;
  const selectedModelEraserCount = selectedPropCanEraseModel
    ? getModelEraserStrokes(selectedEntity.item).length
    : 0;
  useEffect(() => {
    if (tool !== 'modelEraser') return;
    if (mode === 'edit' && selectedPropCanEraseModel) return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
    setTool('select');
  }, [mode, selectedPropCanEraseModel, tool]);
  const canUndoRpg3D = undoStack.length > 0;
  const canRedoRpg3D = redoStack.length > 0;
  const positionRowClassName = [
    'arcade-position-row',
    selectedCanLevitate ? 'with-z' : '',
    selectedCanRotate ? 'with-orientation' : '',
  ].filter(Boolean).join(' ');
  const multiPositionRowClassName = [
    'arcade-position-row',
    multiSelectionCanLevitate ? 'with-z' : '',
    multiSelectionCanRotate ? 'with-orientation' : '',
  ].filter(Boolean).join(' ');
  const arcadeShellClassName = [
    'arcade-shell',
    'arcade-builder-shell',
    `arcade-workspace-${workspaceTab}`,
    mapFullscreen ? 'arcade-fullscreen-active' : '',
    mapFullscreen && mapDrawerOpen ? 'arcade-map-drawer-open' : '',
    mapFullscreen && inspectorDrawerOpen ? 'arcade-inspector-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const arcadeBuilderLayoutClassName = [
    'arcade-builder-layout',
    'arcade-builder-layout-with-inspector',
    mapFullscreen ? 'arcade-builder-layout-fullscreen' : '',
  ].filter(Boolean).join(' ');
  const toggleMapFullscreen = () => {
    setMapFullscreen((current) => {
      const next = !current;
      if (!next) {
        setMapDrawerOpen(false);
        setInspectorDrawerOpen(false);
      }
      return next;
    });
  };
  const handleLightIntensityChange = (value) => {
    patchViewportEngineConfig((engine) => {
      engine.lightIntensity = value;
    });
  };
  const handleLightOrientationChange = (value) => {
    patchViewportEngineConfig((engine) => {
      engine.lightOrientation = value;
    });
  };
  const handleToggleModelEraser = () => {
    const currentProp = getSelectedEntity(configRef.current, selectedRef.current);
    if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
    setMode('edit');
    setIsPaused(false);
    setTool((current) => (current === 'modelEraser' ? 'select' : 'modelEraser'));
    setTransformTool('');
    setPendingPlacement(null);
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setActionZoneEdgeInsertMode(false);
  };
  const handleModelEraserRadiusChange = (value) => {
    const radius = getModelEraserRadius({ modelEraserRadius: value });
    setModelEraserRadiusDraft(radius);
    patchConfigWithoutHistory((next) => {
      const currentProp = getSelectedEntity(next, selectedRef.current);
      if (!currentProp?.item || currentProp.type !== 'prop' || getPropRenderMode(currentProp.item) !== 'glb') return;
      currentProp.item.modelEraserRadius = radius;
    }, false);
  };
  const handleClearModelEraser = () => {
    const currentProp = getSelectedEntity(configRef.current, selectedRef.current);
    if (!currentProp?.item || currentProp.type !== 'prop' || !getModelEraserStrokes(currentProp.item).length) return;
    modelEraserSessionRef.current = null;
    modelEraserLastPointRef.current = null;
    patchConfig((next) => {
      const nextProp = getSelectedEntity(next, selectedRef.current);
      if (!nextProp?.item || nextProp.type !== 'prop') return;
      nextProp.item.modelEraserStrokes = [];
    }, false);
  };
  const handleToggleDragMode = () => {
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setActionZoneEdgeInsertMode(false);
    setDragMode((current) => !current);
  };
  const handleToggleMultiSelectMode = () => {
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setActionZoneEdgeInsertMode(false);
    setMultiSelectMode((current) => {
      const next = !current;
      setMultiSelected(next && canMultiSelectEntity(selected) ? [selected] : []);
      return next;
    });
  };
  const handleToggleCameraZoomDragMode = () => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setTransformTool('');
    setPendingPlacement(null);
    setActionZoneEdgeInsertMode(false);
    setCameraZoomDragMode((current) => !current);
  };
  const handleToggleRotateTransform = () => {
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(null);
    setActionZoneEdgeInsertMode(false);
    setTransformTool((current) => (current === 'rotate' ? '' : 'rotate'));
  };
  const handleToggleScaleTransform = () => {
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(null);
    setActionZoneEdgeInsertMode(false);
    setTransformTool((current) => (current === 'scale' ? '' : 'scale'));
  };
  const handleToggleScaleProportionalAxis = useCallback((axis) => {
    if (!['x', 'y', 'z'].includes(axis)) return;
    setScaleProportionalAxes((current) => ({
      ...current,
      [axis]: !current[axis],
    }));
  }, []);
  const handleReliefCollisionChange = (value) => {
    patchConfig((next) => {
      const currentRelief = getSelectedEntity(next, selected);
      if (currentRelief?.item) currentRelief.item.blocksMovement = value === 'blocked';
    });
  };
  const handleClearPropImage = () => {
    setMediaError('');
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.imageData = '';
      currentProp.item.imageName = '';
    });
  };
  const handlePropCollisionChange = (value) => {
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (currentProp?.item) currentProp.item.blocksMovement = value === 'blocked';
    });
  };

  return (
    <main className={arcadeShellClassName}>
      {mapFullscreen ? (
        <>
          <button
            type="button"
            className="arcade-fullscreen-drawer-toggle arcade-fullscreen-drawer-toggle-left"
            title={mapDrawerOpen ? 'Fermer le tiroir carte' : 'Ouvrir le tiroir carte'}
            aria-label={mapDrawerOpen ? 'Fermer le tiroir carte' : 'Ouvrir le tiroir carte'}
            aria-pressed={mapDrawerOpen}
            onClick={() => setMapDrawerOpen((open) => !open)}
          >
            <PanelLeftOpen size={17} />
          </button>
          <button
            type="button"
            className="arcade-fullscreen-drawer-toggle arcade-fullscreen-drawer-toggle-right"
            title={inspectorDrawerOpen ? 'Fermer le tiroir inspecteur' : 'Ouvrir le tiroir inspecteur'}
            aria-label={inspectorDrawerOpen ? 'Fermer le tiroir inspecteur' : 'Ouvrir le tiroir inspecteur'}
            aria-pressed={inspectorDrawerOpen}
            onClick={() => setInspectorDrawerOpen((open) => !open)}
          >
            <PanelRightOpen size={17} />
          </button>
        </>
      ) : null}
      <Rpg3DHeader
        authorProfile={authorProfile}
        isPaused={isPaused}
        isSavingAssets={isSavingAssets}
        managementSaveStatus={managementSaveStatus}
        playMode={playMode}
        user={user}
        workspaceTab={workspaceTab}
        onPauseOrReset={handlePauseOrReset}
        onSave={saveArcadeAssets}
        onSelectWorkspace={setWorkspaceTab}
        onTogglePlayMode={handleTogglePlayMode}
      />

      {!mapFullscreen ? (
        <Rpg3DWorkspaceTabs
          tabs={workspaceTabs}
          activeTabId={workspaceTab}
          onSelectTab={setWorkspaceTab}
        />
      ) : null}

      {workspaceTab === 'canvases' ? (
        <ArcadeCanvasManagerTab
          studioProject={studioProject}
          currentConfig={config}
          activeCanvasId={activeRpg3DCanvasId}
          onCreateAct={createRpg3DAct}
          onRenameAct={renameRpg3DAct}
          onDeleteAct={deleteRpg3DAct}
          onCreateCanvas={createRpg3DCanvas}
          onRenameCanvas={renameRpg3DCanvas}
          onMoveCanvasToAct={moveRpg3DCanvasToAct}
          onSelectCanvas={selectRpg3DCanvas}
          onDeleteCanvas={deleteRpg3DCanvas}
          onKeepOnlyActiveCanvas={keepOnlyActiveRpg3DCanvas}
          onOpenCanvas={() => setWorkspaceTab('arcade')}
        />
      ) : workspaceTab === 'heroes' ? (
        <ArcadeHeroTab
          config={config}
          selected={selected}
          mediaError={mediaError}
          studioHeroModels={studioHeroModels}
          studioWeaponModels={studioWeaponModels}
          onPatchConfig={patchConfig}
          onSetMediaError={setMediaError}
        />
      ) : workspaceTab === 'management' ? (
        <ArcadeManagementTab
          config={config}
          selected={selected}
          studioProject={studioProject}
          onCreateStudioCharacter={createStudioCharacter}
          onCreateStudioDecor={createStudioDecor}
          onRenameStudioCharacter={renameStudioCharacter}
          onRenameStudioDecor={renameStudioDecor}
          onDeleteStudioCharacter={deleteStudioCharacter}
          onDeleteStudioDecor={deleteStudioDecor}
          onEditStudioCharacter={editStudioCharacter}
          onEditStudioDecor={editStudioDecor}
          onRenameMapEntity={renameMapEntity}
          onDeleteMapEntity={deleteMapEntity}
          onEditMapEntity={editMapEntity}
        />
      ) : workspaceTab === 'characters3d' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <Character3DTab
            project={studioProject}
            patchProject={patchStudioProject}
            handleUpload={handleStudioUpload}
            mediaLibrary={studioMediaLibrary}
            selectedModelId={studioSelection.characterModelId || undefined}
            onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, characterModelId: modelId }))}
            previewEquipmentTest={rigCharacterEquipmentTest}
            onPreviewEquipmentTestClear={() => setRigCharacterEquipmentTest(null)}
            onSaveAssets={saveArcadeAssets}
            localModelScope={localModelScope}
            saveStatus=""
            saveInProgress={isSavingAssets}
          />
        </React.Suspense>
      ) : workspaceTab === 'decors3d' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <Decor3DTab
            project={studioProject}
            patchProject={patchStudioProject}
            handleUpload={handleStudioUpload}
            mediaLibrary={studioMediaLibrary}
            selectedModelId={studioSelection.decorModelId || undefined}
            onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, decorModelId: modelId }))}
            onSaveAssets={saveArcadeAssets}
            onTestOnCharacter={testRigObjectOnCharacter}
            localModelScope={localModelScope}
            saveStatus={managementSaveStatus}
            saveInProgress={isSavingAssets}
          />
        </React.Suspense>
      ) : workspaceTab === 'objectRigging' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <ObjectRiggingTab
            project={studioProject}
            patchProject={patchStudioProject}
            selectedModelId={studioSelection.decorModelId || undefined}
            onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, decorModelId: modelId }))}
            onSaveAssets={saveArcadeAssets}
            onTestOnCharacter={testRigObjectOnCharacter}
            saveStatus={managementSaveStatus}
            saveInProgress={isSavingAssets}
          />
        </React.Suspense>
      ) : workspaceTab === 'characterRigging' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <CharacterRiggingTab
            project={studioProject}
            patchProject={patchStudioProject}
            selectedModelId={studioSelection.characterModelId || undefined}
            onSelectedModelIdChange={(modelId) => setStudioSelection((current) => ({ ...current, characterModelId: modelId }))}
            onSaveAssets={saveArcadeAssets}
            saveStatus={managementSaveStatus}
            saveInProgress={isSavingAssets}
          />
        </React.Suspense>
      ) : workspaceTab === 'stunts' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <StuntAnimationTab
            project={studioProject}
            patchProject={patchStudioProject}
          />
        </React.Suspense>
      ) : workspaceTab === 'modelTools' ? (
        <React.Suspense fallback={<div className="arcade-tab-loading" />}>
          <ModelToolsTab />
        </React.Suspense>
      ) : (
      <section className={arcadeBuilderLayoutClassName}>
        {showArcadeMapCard ? (
          <Rpg3DMapPanel
            AssetExplorerComponent={ArcadeMapAssetExplorer}
            arcadeObjectCount={arcadeObjectCount}
            characters={studioImportCharacters}
            decors={studioImportDecors}
            fieldHelp={RPG3D_FIELD_HELP}
            flatGroundColorValue={flatGroundColorValue}
            lightIntensityValue={lightIntensityValue}
            lightOrientationValue={lightOrientationValue}
            paintBrushColor={getTerrainPaintColor(terrainPaintDraft)}
            paintBrushRadius={getTerrainPaintRadius(terrainPaintDraft)}
            paintBrushShape={getTerrainPaintShape(terrainPaintDraft)}
            terrainPaintMaxRadius={TERRAIN_PAINT_MAX_RADIUS}
            terrainPaintMinRadius={TERRAIN_PAINT_MIN_RADIUS}
            terrainPaintShapeOptions={TERRAIN_PAINT_SHAPE_OPTIONS}
            terrainPaintStrokeCount={terrainPaintStrokeCount}
            tool={tool}
            world={config.world}
            onAddFlatGround={addFlatGroundToCanvas}
            onClearTerrainPaint={clearTerrainPaint}
            onImportCharacter={importStudioCharacterToCanvas}
            onImportDecor={importStudioDecorToCanvas}
            onLightIntensityChange={handleLightIntensityChange}
            onLightOrientationChange={handleLightOrientationChange}
            onSelectActionZoneTool={handleSelectActionZoneTool}
            onTerrainPaintDraftChange={updateTerrainPaintDraft}
            onToggleTerrainPaint={handleToggleTerrainPaint}
            onUpdateFlatGroundColor={updateFlatGroundColor}
            onWorldFieldCommit={updateArcadeWorldField}
          />
        ) : null}

        <Rpg3DStage
          activeTransformTool={activeTransformTool}
          actionMessage={playMode ? snapshot.actionMessage : ''}
          actionZoneEdgeInsertMode={actionZoneEdgeInsertMode}
          cameraTargetPickMode={cameraTargetPickMode}
          cameraToolsHidden={cameraToolsHidden}
          cameraZoomDragMode={cameraZoomDragMode}
          cameraZoomPercent={cameraZoomPercent}
          canRedo={canRedoRpg3D}
          canUndo={canUndoRpg3D}
          config={config}
          configRef={configRef}
          dragMode={dragMode}
          loadingState={playMode ? rpg3DLoadingBar : null}
          mapFullscreen={mapFullscreen}
          mode={mode}
          modelEraserMode={tool === 'modelEraser' && selectedPropCanEraseModel}
          modelEraserRadius={selectedModelEraserRadius}
          multiSelected={multiSelected}
          multiSelectMode={multiSelectMode}
          paintBrushColor={getTerrainPaintColor(terrainPaintDraft)}
          paintBrushRadius={getTerrainPaintRadius(terrainPaintDraft)}
          paintBrushShape={getTerrainPaintShape(terrainPaintDraft)}
          pendingPlacement={pendingPlacement}
          playMode={playMode}
          quickSelectionCanResize={quickSelectionCanResize}
          quickSelectionCanRotate={quickSelectionCanRotate}
          scaleProportionalAxes={scaleProportionalAxes}
          selected={selected}
          stateRef={stateRef}
          studioProject={studioProject}
          tool={tool}
          wrapperRef={wrapperRef}
          onCameraTargetPick={handleCameraTargetPick}
          onCameraZoomDrag={handleCameraZoomDrag}
          onHideCameraTools={() => setCameraToolsHidden(true)}
          onMarqueeSelect={handleMarqueeSelect}
          onMoveHoldChange={handleMoveHoldChange}
          onRedo={redoProjectChange}
          onSelectionTransformCommit={handleSelectionTransformCommit}
          onShootChange={setPointerShooting}
          onShowCameraTools={() => setCameraToolsHidden(false)}
          onToggleCameraTargetPickMode={toggleCameraTargetPickMode}
          onToggleCameraZoomDragMode={handleToggleCameraZoomDragMode}
          onToggleDragMode={handleToggleDragMode}
          onToggleFullscreen={toggleMapFullscreen}
          onToggleMultiSelectMode={handleToggleMultiSelectMode}
          onToggleRotateTransform={handleToggleRotateTransform}
          onToggleScaleProportionalAxis={handleToggleScaleProportionalAxis}
          onToggleScaleTransform={handleToggleScaleTransform}
          onUndo={undoProjectChange}
          onWorldClick={handleWorldClick}
          onWorldDrag={handleWorldDrag}
          onWorldDragStart={handleWorldDragStart}
          onWorldDrop={handleWorldDrop}
          onActionZoneEdgeDrag={handleActionZoneEdgeDrag}
          onActionZoneEdgeDragStart={handleActionZoneEdgeDragStart}
          onActionZoneEdgeInsert={handleActionZoneEdgeInsert}
          onActionZoneVertexDrag={handleActionZoneVertexDrag}
          onActionZoneVertexDragStart={handleActionZoneVertexDragStart}
          onModelEraseEnd={handleModelEraseEnd}
          onModelEraseMove={handleModelEraseMove}
          onModelEraseStart={handleModelEraseStart}
          onWorldPaintEnd={handleTerrainPaintEnd}
          onWorldPaintMove={handleTerrainPaintMove}
          onWorldPaintStart={handleTerrainPaintStart}
          onWorldPointer={updateWorldPointer}
          resolveWorldDragPoint={resolveWorldDragPoint}
        />

        {showArcadeInspector ? (
          <Rpg3DInspector
            actionZoneEdgeInsertMode={actionZoneEdgeInsertMode}
            actionZoneNpcTargets={actionZoneNpcTargets}
            activeCanvasId={activeRpg3DCanvasId}
            config={config}
            fieldHelp={RPG3D_FIELD_HELP}
            getEntityRotation={getEntityRotation}
            getModelRotationValue={getModelRotationValue}
            getNpcChoiceItems={getNpcChoiceItems}
            getNpcInteractionMode={getNpcInteractionMode}
            getNpcQuestionText={getNpcQuestionText}
            getSelectedEntityTypeLabel={getSelectedEntityTypeLabel}
            hasMultiInspectorSelection={hasMultiInspectorSelection}
            inspectorSelectionBounds={inspectorSelectionBounds}
            inspectorSelectionEntities={inspectorSelectionEntities}
            mediaError={mediaError}
            modelEraserActive={tool === 'modelEraser' && selectedPropCanEraseModel}
            modelEraserMaxRadius={MODEL_ERASER_MAX_RADIUS}
            modelEraserMinRadius={MODEL_ERASER_MIN_RADIUS}
            modelEraserRadius={selectedModelEraserRadius}
            multiPositionRowClassName={multiPositionRowClassName}
            multiSelectionAllFlatTiles={multiSelectionAllFlatTiles}
            multiSelectionCanEditActions={multiSelectionCanEditActions}
            multiSelectionCanLevitate={multiSelectionCanLevitate}
            multiSelectionCanRotate={multiSelectionCanRotate}
            multiSelectionFloorZeroValue={multiSelectionFloorZeroValue}
            multiSelectionRotationValue={multiSelectionRotationValue}
            multiSelectionZValue={multiSelectionZValue}
            positionRowClassName={positionRowClassName}
            reliefStyleOptions={RELIEF_STYLE_OPTIONS}
            rpg3DCanvasOptions={rpg3DCanvasOptions}
            selectedCanLevitate={selectedCanLevitate}
            selectedCanRotate={selectedCanRotate}
            selectedEntity={selectedEntity}
            selectedPropIsFlatTile={selectedPropIsFlatTile}
            selectedPropIsFloorTile={selectedPropIsFloorTile}
            selectedPropRenderMode={selectedPropRenderMode}
            selectedPropTileSize={selectedPropTileSize}
            selectedReliefStyle={selectedReliefStyle}
            selectedModelEraserCount={selectedModelEraserCount}
            onActionZoneTypeChange={handleActionZoneTypeChange}
            onAddSelectedNpcChoice={addSelectedNpcChoice}
            onClearPropImage={handleClearPropImage}
            onDeleteSelected={deleteSelected}
            onDuplicateSelected={duplicateSelected}
            onClearModelEraser={handleClearModelEraser}
            onModelEraserRadiusChange={handleModelEraserRadiusChange}
            onNpcInteractionModeChange={handleNpcInteractionModeChange}
            onPropCollisionChange={handlePropCollisionChange}
            onReliefCollisionChange={handleReliefCollisionChange}
            onRemoveSelectedNpcChoice={removeSelectedNpcChoice}
            onSnapSelectedTileToNeighbor={snapSelectedTileToNeighbor}
            onToggleActionZoneEdgeInsertMode={handleToggleActionZoneEdgeInsertMode}
            onToggleModelEraser={handleToggleModelEraser}
            onUpdateEntity={updateEntity}
            onUpdateSelectedNpcChoice={updateSelectedNpcChoice}
            onUpdateSelectionEntities={updateSelectionEntities}
          />
        ) : null}
      </section>
      )}

      <Rpg3DNpcChoiceOverlay
        choiceState={activeNpcChoice}
        onClose={closeNpcChoice}
        onSelectChoice={handleNpcChoiceSelect}
      />

    </main>
  );
}

export default Rpg3DMode;
