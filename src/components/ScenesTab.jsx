import { useEffect, useRef, useState } from 'react';
import {
  EditorToolbarMenus,
  HelpLabel,
} from './scenes/SceneEditorChrome.jsx';
import Anime2DPreview from './Anime2DPreview.jsx';
import NumberInput from './forms/NumberInput.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import { showConfirm } from './AccessibleDialog';
import { makeLogicRule } from '../data/projectData';
import SceneSidebar from './scenes/SceneSidebar.jsx';
import SceneFullscreenEditor from './scenes/SceneFullscreenEditor.jsx';
import SceneCanvasContextMenu from './scenes/SceneCanvasContextMenu.jsx';
import SceneCanvasQuickToolbar from './scenes/SceneCanvasQuickToolbar.jsx';
import SceneEditorDrawer, { SceneCanvasDrawerButton } from './scenes/SceneEditorDrawer.jsx';
import HotspotInspectorPanel from './scenes/HotspotInspectorPanel.jsx';
import SceneObjectInspector, { SceneObjectBlockContent, getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';
import QuickLogicModal from './scenes/QuickLogicModal.jsx';
import SceneContextPanel from './scenes/SceneContextPanel.jsx';
import SceneMainLayout from './scenes/SceneMainLayout.jsx';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import { useSceneEditorCreation } from './scenes/useSceneEditorCreation.js';
import { useSceneEditorSceneState } from './scenes/useSceneEditorSceneState.js';
import { useSceneEditorShapes } from './scenes/useSceneEditorShapes.js';
import { useSceneFullscreenEditor } from './scenes/useSceneFullscreenEditor.js';
import { useSceneEditorSelection } from './scenes/useSceneEditorSelection.js';
import { useSceneEditorDragResize } from './scenes/useSceneDragResize.js';
import { useSceneEditorCommands } from './scenes/useSceneEditorCommands.js';
import {
  clampFullscreenZoom,
  clampPercent,
  getElementShapeStyle,
  getLayerZIndex,
  getSceneObjectStyle,
  gridOverlayStyle,
} from './scenes/sceneEditorUtils.js';

const FALLBACK_HERO_SKILLS = [
  { id: 'force', name: 'Force', value: 3, manaCost: 0 },
  { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
  { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
];

const parseBranchTags = (value = '') => (
  String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean)
);

export default function ScenesTab(props) {
  const {
    project,
    actsWithScenes,
    addAct,
    deleteAct,
    addScene,
    addItem,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    selectedScene,
    selectedSceneId,
    setSelectedSceneId,
    setTab,
    deleteScene,
    previewScene,
    patchProject,
    rememberProjectState,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    selectedHotspotId,
    setSelectedHotspotId,
    handleUpload,
    mediaLibrary = [],
    getActById,
    getSceneById,
    getSceneDepth,
    addSubsceneToSelectedScene,
    childScenes,
    addHotspot,
    selectedHotspot,
    deleteItem,
    deleteHotspot,
    getSceneLabel,
    collapsedNavigationActIds,
    setNavigationActCollapsed,
    collapsedNavigationSceneIds,
    toggleNavigationSceneCollapsed,
  } = props;

  const canvasRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const fullscreenContentRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [snapGridEnabled, setSnapGridEnabled] = useState(false);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const [conversationEditorOpen, setConversationEditorOpen] = useState(false);
  const [sceneContextMenu, setSceneContextMenu] = useState(null);
  const [sceneClipboard, setSceneClipboard] = useState(null);
  const [sceneDrawerMode, setSceneDrawerMode] = useState(null);
  useEffect(() => {
    const rawFocus = window.sessionStorage.getItem('adventureConversationFocus');
    if (!rawFocus || !selectedHotspotId) return;
    try {
      const focus = JSON.parse(rawFocus);
      if (focus?.hotspotId === selectedHotspotId) {
        setConversationEditorOpen(true);
      }
    } catch {
      window.sessionStorage.removeItem('adventureConversationFocus');
    }
  }, [selectedHotspotId]);

  useEffect(() => {
    if (!conversationEditorOpen) return;
    const rawFocus = window.sessionStorage.getItem('adventureConversationFocus');
    if (!rawFocus) return;
    let focus = null;
    try {
      focus = JSON.parse(rawFocus);
    } catch {
      window.sessionStorage.removeItem('adventureConversationFocus');
      return;
    }
    if (focus?.hotspotId !== selectedHotspotId || !focus.replyId) return;
    window.setTimeout(() => {
      document.querySelector(`[data-conversation-reply-id="${focus.replyId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.sessionStorage.removeItem('adventureConversationFocus');
    }, 80);
  }, [conversationEditorOpen, selectedHotspotId]);
  const {
    isEditorFullscreen,
    fullscreenZoom,
    fullscreenPan,
    minimapViewport,
    isPanningFullscreen,
    setClampedFullscreenZoom,
    enterEditorFullscreen,
    closeEditorFullscreen,
    resetFullscreenView,
    handleFullscreenWheel,
    beginFullscreenPan,
    moveFullscreenPan,
    stopFullscreenPan,
  } = useSceneFullscreenEditor({
    fullscreenViewportRef,
    fullscreenCanvasRef,
  });
  const {
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    selectedVisualEffectZoneId,
    setSelectedVisualEffectZoneId,
    selectedHotspotIds,
    setSelectedHotspotIds,
    selectedSceneObjectIds,
    setSelectedSceneObjectIds,
    activeHotspotIds,
    activeSceneObjectIds,
    activeVisualEffectZoneIds,
    activeSelectionCount,
    clearSceneEditorSelection,
    selectHotspot,
    selectSceneObject,
    selectVisualEffectZone,
  } = useSceneEditorSelection({
    dragMovedRef,
    multiSelectEnabled,
    selectedHotspotId,
    setSelectedHotspotId,
    setSelectedItemId,
  });

  const selectedEditorType = activeVisualEffectZoneIds.length ? 'visualEffectZone' : (activeSceneObjectIds.length ? 'sceneObject' : (activeHotspotIds.length ? 'hotspot' : ''));
  const snapValue = (value) => (snapGridEnabled ? Math.round(value / 5) * 5 : value);
  const isBeginnerMode = project.creationMode === 'beginner';
  const isIntermediateMode = project.creationMode === 'intermediate';
  const canUseQuickLogic = !isBeginnerMode && !isIntermediateMode;
  const isHeroAdventureProject = project.creationMode === 'hero_adventure' || Boolean(project.heroAdventure?.enabled);
  const heroSkills = project.heroAdventure?.hero.skills?.length ? project.heroAdventure.hero.skills : FALLBACK_HERO_SKILLS;
  const openMediaTab = () => setTab?.('media');
  const handleCanvasBackgroundClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    const interactiveTarget = event.target?.closest?.([
      '.editor-hotspot',
      '.editor-resize-handle',
      '.scene-canvas-quick-toolbar',
      '.scene-canvas-drawer-button',
      '.editor-minimap',
      '.scene-media-link-placeholder',
      '.scene-inline-viewer',
      '.scene-canvas-context-menu',
      'button',
      'input',
      'select',
      'textarea',
      'a',
      'label',
    ].join(','));
    if (interactiveTarget) return;

    clearSceneEditorSelection();
    setSceneContextMenu(null);
  };
  const handleSceneImagePlaceholderKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openMediaTab();
  };
  const getCanvasPointFromEvent = (event, source = 'main') => {
    const activeCanvas = source === 'fullscreen' ? fullscreenContentRef.current : canvasRef.current;
    const rect = activeCanvas?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return { x: 50, y: 50 };
    return {
      x: Number(clampPercent(snapValue(((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)),
      y: Number(clampPercent(snapValue(((event.clientY - rect.top) / rect.height) * 100)).toFixed(2)),
    };
  };
  const {
    quickLogicTarget,
    setQuickLogicTarget,
    selectedSceneObject,
    selectedVisualEffectZone,
    sceneAspectRatio,
    getLinkedItem,
    getSceneObjectDisplayImage,
    openQuickLogicForTarget,
    importSceneObjectAnime2d,
    toggleSceneChildren,
    selectSceneFromTree,
    selectSceneInFullscreen,
    selectActInFullscreen,
    rememberSceneBackgroundAspectRatio,
    updateSceneBackground,
  } = useSceneEditorSceneState({
    project,
    selectedScene,
    selectedSceneId,
    selectedSceneObjectId,
    selectedVisualEffectZoneId,
    selectedHotspotId,
    setSelectedSceneId,
    setSelectedHotspotId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    setSelectedItemId,
    patchProject,
    toggleNavigationSceneCollapsed,
  });

  const {
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    renderShapeOutline,
    getShapeClassName,
    getResizeHandleStyle,
    renderShapeControls,
  } = useSceneEditorShapes({
    selectedScene,
    selectedSceneId,
    patchProject,
    isBeginnerMode,
  });

  const {
    draggingHotspotId,
    draggingSceneObjectId,
    draggingVisualEffectZoneId,
    isDragLocked,
    beginDrag,
    beginObjectDrag,
    beginVisualEffectZoneDrag,
    stopDragging,
    beginResize,
    stopResizing,
    updateHotspotPosition,
    updateElementSize,
    renderResizeHandles,
    renderShapePointHandles,
  } = useSceneEditorDragResize({
    canvasRef,
    fullscreenCanvasRef,
    fullscreenContentRef,
    dragMovedRef,
    selectedScene,
    selectedSceneId,
    selectedHotspotIds,
    selectedSceneObjectIds,
    multiSelectEnabled,
    patchProject,
    rememberProjectState,
    snapValue,
    setSelectedHotspotId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedItemId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    getResizeHandleStyle,
  });

  const {
    addSceneObject,
    addInvisibleSceneObject,
    addAnimationObject,
    addInteractiveBlock,
    addVisualEffectZone,
  } = useSceneEditorCreation({
    project,
    selectedSceneId,
    selectedItem,
    selectedItemId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedItemId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    patchProject,
  });

  const {
    duplicateSelectedEditorItems,
    deleteSelectedEditorItems,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  } = useSceneEditorCommands({
    selectedSceneId,
    activeSelectionCount,
    selectedEditorType,
    activeHotspotIds,
    activeSceneObjectIds,
    selectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedVisualEffectZoneId,
    patchProject,
    isEditorFullscreen,
    closeEditorFullscreen,
    setClampedFullscreenZoom,
    setSnapGridEnabled,
    setMultiSelectEnabled,
    undoProjectChange,
    redoProjectChange,
  });

  const selectContextTarget = (type, id) => {
    if (!id) return;
    if (type === 'hotspot') {
      const preserveMultiSelection = activeHotspotIds.includes(id) && activeHotspotIds.length > 1;
      setSelectedHotspotId(id);
      setSelectedSceneObjectId('');
      setSelectedVisualEffectZoneId('');
      setSelectedItemId('');
      if (!preserveMultiSelection) setSelectedHotspotIds([id]);
      setSelectedSceneObjectIds([]);
      return;
    }
    if (type === 'sceneObject') {
      const preserveMultiSelection = activeSceneObjectIds.includes(id) && activeSceneObjectIds.length > 1;
      setSelectedSceneObjectId(id);
      setSelectedHotspotId('');
      setSelectedVisualEffectZoneId('');
      setSelectedItemId('');
      if (!preserveMultiSelection) setSelectedSceneObjectIds([id]);
      setSelectedHotspotIds([]);
    }
  };

  const openSceneCanvasContextMenu = (event, type = 'canvas', id = '', source = 'main') => {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'hotspot' || type === 'sceneObject') selectContextTarget(type, id);
    const menuWidth = 260;
    const menuHeight = canUseQuickLogic ? 600 : 520;
    const clientX = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth));
    const clientY = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight));
    setSceneContextMenu({
      clientX,
      clientY,
      type,
      id,
      source,
      canvasPoint: getCanvasPointFromEvent(event, source),
    });
  };

  const copySceneEntry = (type, id) => {
    if (!selectedScene || !id || !['hotspot', 'sceneObject'].includes(type)) return;
    const sourceList = type === 'hotspot' ? (selectedScene.hotspots || []) : (selectedScene.sceneObjects || []);
    const entry = sourceList.find((item) => item.id === id);
    if (!entry) return;
    const copy = typeof structuredClone === 'function' ? structuredClone(entry) : JSON.parse(JSON.stringify(entry));
    setSceneClipboard({ type, entry: copy });
  };

  const pasteSceneEntry = (canvasPoint = { x: 50, y: 50 }) => {
    if (!sceneClipboard || !selectedSceneId) return;
    const nextId = `${sceneClipboard.type === 'hotspot' ? 'hotspot' : 'scene-object'}-${Math.random().toString(36).slice(2, 10)}`;
    const nextType = sceneClipboard.type;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (nextType === 'hotspot' && !Array.isArray(scene.hotspots)) scene.hotspots = [];
      if (nextType === 'sceneObject' && !Array.isArray(scene.sceneObjects)) scene.sceneObjects = [];
      const list = nextType === 'hotspot' ? scene.hotspots : scene.sceneObjects;
      const zValues = [
        ...(scene.sceneObjects || []).map((entry) => getLayerZIndex(entry, 'sceneObject')),
        ...(scene.hotspots || []).map((entry) => getLayerZIndex(entry, 'hotspot')),
      ];
      const pasted = {
        ...sceneClipboard.entry,
        id: nextId,
        name: `${sceneClipboard.entry.name || (nextType === 'hotspot' ? 'Zone' : 'Objet')} copie`,
        x: Number(clampPercent(canvasPoint.x ?? 50).toFixed(2)),
        y: Number(clampPercent(canvasPoint.y ?? 50).toFixed(2)),
        isHidden: false,
        isLocked: false,
        zIndex: Math.max(...zValues, 0) + 1,
      };
      delete pasted.tutorialCreated;
      list.push(pasted);
    });
    if (nextType === 'hotspot') {
      setSelectedHotspotId(nextId);
      setSelectedHotspotIds([nextId]);
      setSelectedSceneObjectId('');
      setSelectedSceneObjectIds([]);
      setSelectedVisualEffectZoneId('');
      setSelectedItemId('');
      return;
    }
    setSelectedSceneObjectId(nextId);
    setSelectedSceneObjectIds([nextId]);
    setSelectedHotspotId('');
    setSelectedHotspotIds([]);
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
  };

  const createLogicRuleFromTarget = (type, id) => {
    if (!canUseQuickLogic || !id || !['hotspot', 'sceneObject'].includes(type)) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      const target = type === 'sceneObject'
        ? scene?.sceneObjects?.find((entry) => entry.id === id)
        : scene?.hotspots?.find((entry) => entry.id === id);
      if (!target) return;
      if (!Array.isArray(target.logicRules)) target.logicRules = [];
      target.logicRules.push({
        ...makeLogicRule(),
        name: 'Règle créée depuis la zone',
      });
    });
    openQuickLogicForTarget(type, id);
  };

  useEffect(() => {
    if (!sceneContextMenu) return undefined;
    const closeMenu = () => setSceneContextMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sceneContextMenu]);

  const editorToolbarProps = {
    selectedSceneId,
    previewScene,
    deleteScene,
    closeEditorFullscreen,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    duplicateSelectedEditorItems,
    activeSelectionCount,
    multiSelectEnabled,
    setMultiSelectEnabled,
    deleteSelectedEditorItems,
    enterEditorFullscreen,
    setFullscreenZoom: setClampedFullscreenZoom,
    clampFullscreenZoom,
    resetFullscreenView,
    snapGridEnabled,
    setSnapGridEnabled,
    addHotspot,
    addSceneObject,
    addAnimationObject,
    addInvisibleSceneObject,
    addInteractiveBlock,
    addVisualEffectZone,
    isBeginnerMode,
    isIntermediateMode,
  };

  const layersPanelProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedItemId,
    getLayerZIndex,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };

  const miniMapProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    minimapViewport,
    clampPercent,
    isCollapsed: isMiniMapCollapsed,
    setIsCollapsed: setIsMiniMapCollapsed,
  };
  const sceneContextTitle = selectedSceneObject
    ? ((selectedSceneObject.anime2dSpec || selectedSceneObject.anime2dName || selectedSceneObject.name === 'Animation') ? 'Animation selectionnee' : selectedSceneObject.isInvisible ? 'Objet invisible selectionne' : (getSceneObjectClickMode(selectedSceneObject) === 'action' ? "Zone d'action selectionnee" : 'Objet visible selectionne'))
    : selectedVisualEffectZone ? 'Zone visuelle selectionnee' : 'Zone selectionnee';
  const isSceneObjectSelectedOnCanvas = (obj) => obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id);
  const isHotspotSelectedOnCanvas = (spot) => spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id);
  const addConversationQuestion = () => patchProject((draft) => {
    const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
    if (!spot) return;
    const nodeId = `node-${Math.random().toString(36).slice(2, 8)}`;
    spot.conversation = spot.conversation || { startNodeId: nodeId, nodes: [] };
    spot.conversation.nodes = [...(spot.conversation.nodes || []), { id: nodeId, speaker: 'PNJ', text: 'Nouvelle question.', replies: [] }];
    spot.conversation.startNodeId = spot.conversation.startNodeId || nodeId;
  });

  return (
    <div className="layout scenes-layout-pro ultra-editor">
      <SceneSidebar
        project={project}
        actsWithScenes={actsWithScenes}
        addAct={addAct}
        deleteAct={deleteAct}
        addScene={addScene}
        selectedSceneId={selectedSceneId}
        collapsedActIds={collapsedNavigationActIds}
        setActCollapsed={setNavigationActCollapsed}
        collapsedSceneIds={collapsedNavigationSceneIds}
        toggleSceneChildren={toggleSceneChildren}
        selectSceneFromTree={selectSceneFromTree}
      />

      <SceneMainLayout selectedScene={selectedScene} actName={selectedScene ? getActById(selectedScene.actId)?.name : ''}>
        {selectedScene ? (
          <div className="editor-stack">
            <div className="subpanel scene-compact-card">
                <div className="subpanel-head">
                  <h3>Général & structure</h3>
                  <div className="inline-actions end">
                    <button type="button" className="secondary-action" data-tour="scene-preview-button" onClick={() => previewScene?.(selectedSceneId)}>
                      Prévisualiser
                    </button>
                    <button type="button" className="danger-button" onClick={() => deleteScene(selectedSceneId)}>
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="scene-compact-grid">
                  <div data-tour="scene-name">
                    <HelpLabel help="Nom affiché dans la navigation de l’éditeur et dans les listes de choix. Garde-le court si plusieurs scènes se ressemblent.">Nom de la scène</HelpLabel>
                    <input value={selectedScene.name} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.name = e.target.value;
                    })} />
                  </div>
                  <div data-tour="scene-act">
                    <HelpLabel help="Regroupe la scène dans un chapitre. Changer d’acte peut retirer une scène parente qui n’appartient plus au même acte.">Acte</HelpLabel>
                    <select value={selectedScene.actId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                      if (scene) {
                        scene.actId = e.target.value;
                        if (scene.parentSceneId) {
                          const parent = draft.scenes.find((s) => s.id === scene.parentSceneId);
                          if (parent && parent.actId !== e.target.value) scene.parentSceneId = '';
                        }
                      }
                    })}>
                      {project.acts.map((act) => <option key={act.id} value={act.id}>{act.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Transforme cette scène en sous-scène d’une autre. Utile pour les gros plans, tiroirs, portes ou variantes d’une même pièce.">Scène parente</HelpLabel>
                    <select value={selectedScene.parentSceneId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.parentSceneId = e.target.value;
                    })}>
                      <option value="">Scène principale</option>
                      {project.scenes.filter((scene) => scene.id !== selectedSceneId && scene.actId === selectedScene.actId).map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneDepth(scene) ? '— '.repeat(getSceneDepth(scene)) : ''}{scene.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="scene-intro-field" data-tour="scene-intro">
                    <HelpLabel help="Texte montré à l’entrée de la scène, avant que le joueur interagisse. Sert à poser l’ambiance ou l’objectif local.">Texte d’introduction</HelpLabel>
                    <input value={selectedScene.introText} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.introText = e.target.value;
                    })} />
                  </div>
                </div>
              </div>

            <div className="subpanel canvas-subpanel">
              <div className="subpanel-head">
                <div>
                  <h3>Plan de scène</h3>
                </div>
                <div className="scene-canvas-head-actions">
                  <div className="editor-toolbar-wrap">
                    <EditorToolbarMenus {...editorToolbarProps} />
                  </div>
                </div>
              </div>

              <div className="preview-editor" data-tour="scene-canvas">
                <div className="scene-canvas-column">
                  <div
                    ref={canvasRef}
                    className="editor-canvas editor-canvas-pro"
                    style={{ aspectRatio: sceneAspectRatio }}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                    onClick={handleCanvasBackgroundClick}
                    onContextMenu={(event) => openSceneCanvasContextMenu(event, 'canvas', '', 'main')}
                  >
                  {selectedScene.backgroundData ? <img src={selectedScene.backgroundData} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} /> : (
                    <div
                      className="placeholder scene-media-link-placeholder"
                      role="button"
                      tabIndex={0}
                      onClick={openMediaTab}
                      onKeyDown={handleSceneImagePlaceholderKeyDown}
                    >
                      Ajoute une image de scène
                    </div>
                  )}
                  <SceneCanvasDrawerButton drawerMode={sceneDrawerMode} setDrawerMode={setSceneDrawerMode} />
                  <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                  {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden || zone.id === selectedVisualEffectZoneId).map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      data-tour={zone.tutorialCreated ? 'visual-zone-on-canvas' : undefined}
                      className={`editor-hotspot editor-visual-zone ${getShapeClassName(zone)} ${zone.isHidden ? 'editor-hidden-on-canvas' : ''} ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer), ...getElementShapeStyle(zone) }}
                      onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id)}
                      onClick={() => selectVisualEffectZone(zone.id)}
                    >
                      <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                      <span>{zone.name}</span>
                      {renderShapeOutline(zone, zone.id === selectedVisualEffectZoneId)}
                      {renderResizeHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                      {renderShapePointHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                    </button>
                  ))}
                  {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                  {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden || isSceneObjectSelectedOnCanvas(obj)).map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      data-tour={obj.tutorialCreated ? 'scene-object-on-canvas' : undefined}
                      className={`editor-hotspot editor-scene-object ${getShapeClassName(obj)} ${obj.isInvisible ? 'editor-scene-object-invisible' : ''} ${obj.isHidden ? 'editor-hidden-on-canvas' : ''} ${isSceneObjectSelectedOnCanvas(obj) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                      style={getSceneObjectStyle(obj)}
                      onPointerDown={(event) => beginObjectDrag(event, obj.id)}
                      onClick={(event) => selectSceneObject(obj.id, event)}
                      onContextMenu={(event) => openSceneCanvasContextMenu(event, 'sceneObject', obj.id, 'main')}
                    >
                      {obj.anime2dSpec && !obj.isInvisible ? (
                        <Anime2DPreview spec={obj.anime2dSpec} />
                      ) : !obj.isInvisible ? (
                        <SceneObjectBlockContent object={obj} displayImage={getSceneObjectDisplayImage(obj)} linkedItem={getLinkedItem(obj.linkedItemId)} />
                      ) : <span>{`${obj.name || 'Objet'} (invisible)`}</span>}
                      {renderShapeOutline(obj, isSceneObjectSelectedOnCanvas(obj))}
                      {renderResizeHandles('sceneObject', obj.id, isSceneObjectSelectedOnCanvas(obj))}
                      {renderShapePointHandles('sceneObject', obj.id, isSceneObjectSelectedOnCanvas(obj))}
                    </button>
                  ))}
                  {selectedScene.hotspots.filter((spot) => !spot.isHidden || isHotspotSelectedOnCanvas(spot)).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      data-tour={spot.tutorialCreated ? 'hotspot-on-canvas' : undefined}
                      className={`editor-hotspot ${getShapeClassName(spot)} ${spot.isHidden ? 'editor-hidden-on-canvas' : ''} ${isHotspotSelectedOnCanvas(spot) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}
                      onPointerDown={(event) => beginDrag(event, spot.id)}
                      onClick={(event) => selectHotspot(spot.id, event)}
                      onContextMenu={(event) => openSceneCanvasContextMenu(event, 'hotspot', spot.id, 'main')}
                    >
                      <span>{spot.name}</span>
                      {renderShapeOutline(spot, isHotspotSelectedOnCanvas(spot))}
                      {renderResizeHandles('hotspot', spot.id, isHotspotSelectedOnCanvas(spot))}
                      {renderShapePointHandles('hotspot', spot.id, isHotspotSelectedOnCanvas(spot))}
                    </button>
                  ))}
                  <SceneCanvasQuickToolbar
                    selectedScene={selectedScene}
                    selectedSceneId={selectedSceneId}
                    selectedHotspotId={selectedHotspotId}
                    selectedHotspotIds={selectedHotspotIds}
                    selectedSceneObjectId={selectedSceneObjectId}
                    selectedSceneObjectIds={selectedSceneObjectIds}
                    duplicateSelectedEditorItems={duplicateSelectedEditorItems}
                    deleteSelectedEditorItems={deleteSelectedEditorItems}
                    patchLayerItem={patchLayerItem}
                    sendLayerToEdge={sendLayerToEdge}
                    previewScene={previewScene}
                    canUseQuickLogic={canUseQuickLogic}
                    openQuickLogicForTarget={openQuickLogicForTarget}
                    isBeginnerMode={isBeginnerMode}
                    projectMode={project.creationMode}
                  />
                  </div>
                </div>
                <SceneContextPanel title={sceneContextTitle}>
                  {false ? (
                    <>
                      <div className="icon-preview inventory-object-preview">{selectedItem.imageData ? <img src={selectedItem.imageData} alt={selectedItem.name} /> : <span>{selectedItem.icon || '📦'}</span>}</div>
                      <HelpLabel help="Nom de l’objet dans l’inventaire. C’est le libellé que le joueur voit lorsqu’il obtient ou consulte cet objet.">Nom de l’objet</HelpLabel>
                      <input data-tour="object-name" value={selectedItem.name} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.name = e.target.value;
                      })} />
                      <HelpLabel help="Image utilisée comme miniature d’inventaire. Si elle est absente, l’emoji de secours est utilisé à la place.">Image de l’objet</HelpLabel>
                      <MediaSourcePicker
                        className="button like full secondary-action"
                        accept="image/*"
                        assetScope="object-image"
                        handleUpload={handleUpload}
                        mediaLibrary={mediaLibrary}
                        onSelect={(data, name) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (item) {
                            item.imageData = data;
                            item.imageName = name;
                          }
                        })}
                        tourId="object-image"
                      >
                        {selectedItem.imageName || 'Importer une image objet'}
                      </MediaSourcePicker>
                      <HelpLabel help="Symbole affiché quand aucune image d’inventaire n’est fournie, ou comme repère visuel léger dans les listes.">Emoji de secours</HelpLabel>
                      <input value={selectedItem.icon} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.icon = e.target.value;
                      })} />
                      {isHeroAdventureProject ? (
                      <div className="nested-editor-card hero-skill-check-editor">
                        <HelpLabel help="Effet applique en Preview quand le joueur clique cet objet dans l'inventaire. Aucun effet garde l'objet comme indice classique.">Effet héros</HelpLabel>
                        <select value={selectedItem.heroItemType || 'none'} onChange={(event) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (!item) return;
                          item.heroItemType = event.target.value;
                          if (event.target.value === 'health_potion') {
                            item.heroItemAmount = item.heroItemAmount || 4;
                            item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                          }
                          if (event.target.value === 'mana_potion') {
                            item.heroItemAmount = item.heroItemAmount || 3;
                            item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                          }
                          if (event.target.value === 'equipment') {
                            item.heroItemBonus = item.heroItemBonus || 1;
                            item.heroItemBonusTarget = item.heroItemBonusTarget || 'skill';
                            item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                            item.heroItemConsumeOnUse = false;
                          }
                        })}>
                          <option value="none">Aucun effet</option>
                          <option value="health_potion">Potion de soin</option>
                          <option value="mana_potion">Potion de mana</option>
                          <option value="equipment">Equipement avec bonus</option>
                        </select>

                        {['health_potion', 'mana_potion'].includes(selectedItem.heroItemType || 'none') ? (
                          <>
              <HelpLabel help="Nombre de PV ou de mana rendus. La jauge ne dépasse jamais le maximum configuré dans l'onglet Héros.">Quantité restaurée</HelpLabel>
                            <NumberInput
                              min="1"
                              max="99"
                              value={selectedItem.heroItemAmount || 4}
                              onValueChange={(nextValue) => patchProject((draft) => {
                                const item = draft.items.find((entry) => entry.id === selectedItemId);
                                if (item) item.heroItemAmount = nextValue;
                              })}
                            />
                            <label className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={selectedItem.heroItemConsumeOnUse ?? true}
                                onChange={(event) => patchProject((draft) => {
                                  const item = draft.items.find((entry) => entry.id === selectedItemId);
                                  if (item) item.heroItemConsumeOnUse = event.target.checked;
                                })}
                              />
                              Consommer après utilisation
                            </label>
                          </>
                        ) : null}

                        {(selectedItem.heroItemType || 'none') === 'equipment' ? (
                          <>
                            <HelpLabel help="Statistique augmentée quand le joueur équipe cet objet. Choisis une compétence pour les jets de dé, PV max pour rendre le héros plus résistant, ou mana max pour lancer plus de tests magiques.">Bonus appliqué à</HelpLabel>
                            <select value={selectedItem.heroItemBonusTarget || 'skill'} onChange={(event) => patchProject((draft) => {
                              const item = draft.items.find((entry) => entry.id === selectedItemId);
                              if (!item) return;
                              item.heroItemBonusTarget = event.target.value;
                              if (event.target.value === 'skill') item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                            })}>
                              <option value="skill">Compétence</option>
                              <option value="maxHealth">Points de vie max</option>
                              <option value="maxMana">Mana max</option>
                            </select>
                            {(selectedItem.heroItemBonusTarget || 'skill') === 'skill' ? (
                              <>
                                <HelpLabel help="Compétence qui gagne le bonus quand le joueur équipe cet objet. L'équipement s'applique une seule fois par partie.">Compétence boostée</HelpLabel>
                                <select value={selectedItem.heroItemSkillId || heroSkills[0]?.id || ''} onChange={(event) => patchProject((draft) => {
                                  const item = draft.items.find((entry) => entry.id === selectedItemId);
                                  if (item) item.heroItemSkillId = event.target.value;
                                })}>
                                  {heroSkills.map((skill) => (
                                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            <HelpLabel help="Valeur ajoutée à la statistique choisie, par exemple +1 Force, +3 PV max ou +2 mana max. Une valeur négative peut servir pour un objet maudit.">Bonus</HelpLabel>
                            <NumberInput
                              min="-20"
                              max="20"
                              value={selectedItem.heroItemBonus || 1}
                              onValueChange={(nextValue) => patchProject((draft) => {
                                const item = draft.items.find((entry) => entry.id === selectedItemId);
                                if (item) item.heroItemBonus = nextValue;
                              })}
                            />
                            <p className="small-note">En jeu, cet objet passe dans la zone <strong>Objets portes</strong> de la page personnage. Il ne reste pas affiche dans l'inventaire transporte.</p>
                          </>
                        ) : null}
                      </div>
                      ) : null}
                      <p className="small-note">Conseil : choisis une image lisible en petit format, avec un fond simple si possible.</p>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        deleteItem(selectedItemId);
                        setSelectedItemId('');
                      }}>Supprimer l’objet</button>
                    </>
                  ) : selectedSceneObject ? (
                    <SceneObjectInspector
                      project={project}
                      selectedSceneId={selectedSceneId}
                      selectedSceneObject={selectedSceneObject}
                      selectedSceneObjectId={selectedSceneObjectId}
                      patchProject={patchProject}
                      renderShapeControls={renderShapeControls}
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      importSceneObjectAnime2d={importSceneObjectAnime2d}
                      getSceneLabel={getSceneLabel}
                      setSelectedSceneObjectId={setSelectedSceneObjectId}
                      onOpenLogic={() => openQuickLogicForTarget('sceneObject', selectedSceneObjectId)}
                    />
                  ) : selectedVisualEffectZone ? (
                    <>
                      <HelpLabel help="Nom interne de la zone visuelle. Il aide à la retrouver dans les calques et dans l'éditeur.">Nom</HelpLabel>
                      <input value={selectedVisualEffectZone.name} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap">
                        <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l'image.">X</HelpLabel><NumberInput value={selectedVisualEffectZone.x} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.x = nextValue; })} /></div>
                        <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l'image.">Y</HelpLabel><NumberInput value={selectedVisualEffectZone.y} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.y = nextValue; })} /></div>
                        <div><HelpLabel help="Largeur de la zone d'effet, en pourcentage de la largeur de la scène.">Largeur</HelpLabel><NumberInput value={selectedVisualEffectZone.width} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.width = nextValue; })} /></div>
                        <div><HelpLabel help="Hauteur de la zone d'effet, en pourcentage de la hauteur de la scène.">Hauteur</HelpLabel><NumberInput value={selectedVisualEffectZone.height} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.height = nextValue; })} /></div>
                      </div>
                      {renderShapeControls('visualEffectZone', selectedVisualEffectZoneId)}
                      <HelpLabel help="Effet visuel applique uniquement dans cette zone. Ce menu reprend les mêmes familles que l'onglet Média.">Effet de zone</HelpLabel>
                      <div className="scene-zone-effect-picker" data-tour="visual-zone-effect">
                        <VisualEffectCascadeMenu
                          value={selectedVisualEffectZone.effect || 'sparkles'}
                          onChange={(nextEffect) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.effect = nextEffect;
                          })}
                        />
                      </div>
                      <HelpLabel help="Force de l'effet dans cette zone.">Intensite</HelpLabel>
                      <select value={selectedVisualEffectZone.intensity || 'normal'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.intensity = e.target.value;
                      })}>
                        {VISUAL_EFFECT_INTENSITY_OPTIONS.map((intensity) => (
                          <option key={intensity.value} value={intensity.value}>{intensity.label}</option>
                        ))}
                      </select>
                      <HelpLabel help="Plan d'affichage de l'effet par rapport aux autres elements de la scène.">Calque</HelpLabel>
                      <select value={selectedVisualEffectZone.layer || 'behind'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.layer = e.target.value;
                      })}>
                        <option value="behind">Arriere-plan</option>
                        <option value="between">Entre objets et zones</option>
                        <option value="front">Premier plan</option>
                      </select>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedVisualEffectZone.isHidden)}
                          onChange={(e) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.isHidden = e.target.checked;
                          })}
                        />
                        Masquer cette zone
                      </label>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Supprimer la zone visuelle',
                          message: `Supprimer la zone visuelle "${selectedVisualEffectZone.name}" ?`,
                          confirmLabel: 'Supprimer',
                          variant: 'danger',
                        });
                        if (!confirmed) return;
                        patchProject((draft) => {
                          const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                          if (!scene?.visualEffectZones) return;
                          scene.visualEffectZones = scene.visualEffectZones.filter((entry) => entry.id !== selectedVisualEffectZoneId);
                        });
                        setSelectedVisualEffectZoneId('');
                      }}>Supprimer la zone visuelle</button>
                    </>
                  ) : selectedHotspot ? (
                    <HotspotInspectorPanel
                      selectedHotspot={selectedHotspot}
                      selectedHotspotId={selectedHotspotId}
                      selectedSceneId={selectedSceneId}
                      project={project}
                      patchProject={patchProject}
                      renderShapeControls={renderShapeControls}
                      isBeginnerMode={isBeginnerMode}
                      conversationEditorOpen={conversationEditorOpen}
                      setConversationEditorOpen={setConversationEditorOpen}
                      addConversationQuestion={addConversationQuestion}
                      getSceneLabel={getSceneLabel}
                      mediaLibrary={mediaLibrary}
                      handleUpload={handleUpload}
                      isHeroAdventureProject={isHeroAdventureProject}
                      heroSkills={heroSkills}
                    />
                  ) : (
                    <div className="placeholder small">Sélectionne une zone, un objet visible ou un objet d’inventaire.</div>
                  )}
                </SceneContextPanel>
              </div>

              {isEditorFullscreen ? (
                <SceneFullscreenEditor
                  selectedScene={selectedScene}
                  selectedSceneId={selectedSceneId}
                  selectedItem={null}
                  selectedItemId=""
                  selectedSceneObject={selectedSceneObject}
                  selectedSceneObjectId={selectedSceneObjectId}
                  selectedHotspot={selectedHotspot}
                  selectedHotspotId={selectedHotspotId}
                  project={project}
                  fullscreenViewportRef={fullscreenViewportRef}
                  fullscreenCanvasRef={fullscreenCanvasRef}
                  fullscreenContentRef={fullscreenContentRef}
                  selectActInFullscreen={selectActInFullscreen}
                  selectSceneInFullscreen={selectSceneInFullscreen}
                  getSceneDepth={getSceneDepth}
                  editorToolbarProps={editorToolbarProps}
                  fullscreenZoom={fullscreenZoom}
                  sceneAspectRatio={sceneAspectRatio}
                  isPanningFullscreen={isPanningFullscreen}
                  beginFullscreenPan={beginFullscreenPan}
                  moveFullscreenPan={moveFullscreenPan}
                  stopFullscreenPan={stopFullscreenPan}
                  handleFullscreenWheel={handleFullscreenWheel}
                  fullscreenPan={fullscreenPan}
                  isDragLocked={isDragLocked}
                  snapGridEnabled={snapGridEnabled}
                  updateHotspotPosition={updateHotspotPosition}
                  stopDragging={stopDragging}
                  selectedSceneObjectIds={selectedSceneObjectIds}
                  draggingSceneObjectId={draggingSceneObjectId}
                  beginObjectDrag={beginObjectDrag}
                  selectSceneObject={selectSceneObject}
                  selectedHotspotIds={selectedHotspotIds}
                  draggingHotspotId={draggingHotspotId}
                  beginDrag={beginDrag}
                  selectHotspot={selectHotspot}
                  selectedVisualEffectZoneId={selectedVisualEffectZoneId}
                  draggingVisualEffectZoneId={draggingVisualEffectZoneId}
                  beginVisualEffectZoneDrag={beginVisualEffectZoneDrag}
                  selectVisualEffectZone={selectVisualEffectZone}
                  renderResizeHandles={renderResizeHandles}
                  renderShapePointHandles={renderShapePointHandles}
                  renderShapeControls={renderShapeControls}
                  renderShapeOutline={renderShapeOutline}
                  getShapeClassName={getShapeClassName}
                  miniMapProps={miniMapProps}
                  setSelectedItemId={() => {}}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  importSceneObjectAnime2d={importSceneObjectAnime2d}
                  patchProject={patchProject}
                  deleteItem={() => {}}
                  setSelectedSceneObjectId={setSelectedSceneObjectId}
                  getSceneLabel={getSceneLabel}
                  setTab={setTab}
                  openQuickLogicForTarget={openQuickLogicForTarget}
                  duplicateSelectedEditorItems={duplicateSelectedEditorItems}
                  deleteSelectedEditorItems={deleteSelectedEditorItems}
                  patchLayerItem={patchLayerItem}
                  sendLayerToEdge={sendLayerToEdge}
                  previewScene={previewScene}
                  onCanvasContextMenu={openSceneCanvasContextMenu}
                  onCanvasBackgroundClick={handleCanvasBackgroundClick}
                  drawerMode={sceneDrawerMode}
                  setDrawerMode={setSceneDrawerMode}
                  conversationEditorOpen={conversationEditorOpen}
                  setConversationEditorOpen={setConversationEditorOpen}
                  addConversationQuestion={addConversationQuestion}
                  isHeroAdventureProject={isHeroAdventureProject}
                  heroSkills={heroSkills}
                />
              ) : null}
              {canUseQuickLogic ? (
                <QuickLogicModal
                  project={project}
                  selectedSceneId={selectedSceneId}
                  targetRef={quickLogicTarget}
                  patchProject={patchProject}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  onClose={() => setQuickLogicTarget(null)}
                  getSceneLabel={getSceneLabel}
                />
              ) : null}
            </div>
          </div>
        ) : <div className="empty-state-inline">Sélectionne une scène dans la colonne de gauche pour commencer.</div>}
      </SceneMainLayout>

      <SceneCanvasContextMenu
        menu={sceneContextMenu}
        clipboard={sceneClipboard}
        duplicateSelectedEditorItems={duplicateSelectedEditorItems}
        deleteSelectedEditorItems={deleteSelectedEditorItems}
        nudgeLayerZIndex={nudgeLayerZIndex}
        sendLayerToEdge={sendLayerToEdge}
        copySceneEntry={copySceneEntry}
        pasteSceneEntry={pasteSceneEntry}
        createLogicRuleFromTarget={createLogicRuleFromTarget}
        canUseQuickLogic={canUseQuickLogic}
        onClose={() => setSceneContextMenu(null)}
      />

      <SceneEditorDrawer
        drawerMode={sceneDrawerMode}
        onClose={() => setSceneDrawerMode(null)}
        project={project}
        selectedScene={selectedScene}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        addItem={addItem}
        addSceneObject={addSceneObject}
        setTab={setTab}
        activeSceneObjectIds={activeSceneObjectIds}
        activeHotspotIds={activeHotspotIds}
        selectedVisualEffectZoneId={selectedVisualEffectZoneId}
        selectSceneObject={selectSceneObject}
        selectHotspot={selectHotspot}
        selectVisualEffectZone={selectVisualEffectZone}
        getLayerZIndex={getLayerZIndex}
        patchLayerItem={patchLayerItem}
        patchProject={patchProject}
        selectedSceneId={selectedSceneId}
        nudgeLayerZIndex={nudgeLayerZIndex}
        sendLayerToEdge={sendLayerToEdge}
      />

    </div>
  );
}
