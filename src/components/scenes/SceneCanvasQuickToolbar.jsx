import {
  BringToFront,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MousePointerClick,
  Play,
  SendToBack,
  SlidersHorizontal,
  Trash2,
  Workflow,
} from 'lucide-react';
import { getSceneObjectClickMode } from '../../lib/sceneObjectBlocks';
import { clampPercent, getLayerZIndex } from './sceneEditorUtils.js';

const HOTSPOT_ACTION_OPTIONS = [
  { value: 'dialogue', label: 'Dialogue', beginner: true },
  { value: 'conversation', label: 'Conversation texte' },
  { value: 'skill_check', label: 'Test de compétence' },
  { value: 'hero_combat', label: 'Combat simple' },
  { value: 'dialogue_item', label: 'Dialogue + objet', beginner: true },
  { value: 'scene', label: 'Changer de scène', beginner: true },
  { value: 'cinematic', label: 'Lancer une cinématique' },
];

const SCENE_OBJECT_ACTION_OPTIONS = [
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'dialogue_item', label: 'Dialogue + objet' },
  { value: 'scene', label: 'Changer de scène' },
  { value: 'cinematic', label: 'Lancer une cinématique' },
];

function ToolbarButton({ label, onClick, disabled = false, danger = false, active = false, children }) {
  return (
    <button
      type="button"
      className={`scene-canvas-toolbar-button ${danger ? 'danger' : ''} ${active ? 'active' : ''}`.trim()}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function SceneCanvasQuickToolbar({
  selectedScene,
  selectedSceneId,
  selectedHotspotId,
  selectedHotspotIds = [],
  selectedSceneObjectId,
  selectedSceneObjectIds = [],
  duplicateSelectedEditorItems,
  deleteSelectedEditorItems,
  patchLayerItem,
  sendLayerToEdge,
  previewScene,
  canUseQuickLogic = false,
  openQuickLogicForTarget,
  isBeginnerMode = false,
  onBeforePreview,
}) {
  if (!selectedScene || !selectedSceneId) return null;

  const activeHotspotIds = selectedHotspotIds.length ? selectedHotspotIds : (selectedHotspotId ? [selectedHotspotId] : []);
  const activeSceneObjectIds = selectedSceneObjectIds.length ? selectedSceneObjectIds : (selectedSceneObjectId ? [selectedSceneObjectId] : []);
  const selectionCount = activeHotspotIds.length + activeSceneObjectIds.length;

  if (selectionCount !== 1) return null;

  const type = activeSceneObjectIds.length ? 'sceneObject' : 'hotspot';
  const id = type === 'sceneObject' ? activeSceneObjectIds[0] : activeHotspotIds[0];
  const entry = type === 'sceneObject'
    ? (selectedScene.sceneObjects || []).find((item) => item.id === id)
    : (selectedScene.hotspots || []).find((item) => item.id === id);

  if (!entry) return null;

  const isHotspot = type === 'hotspot';
  const isSceneObjectAction = type === 'sceneObject' && getSceneObjectClickMode(entry) === 'action';
  const showActionSelect = isHotspot || isSceneObjectAction;
  const actionOptions = isHotspot
    ? HOTSPOT_ACTION_OPTIONS.filter((option) => !isBeginnerMode || option.beginner)
    : SCENE_OBJECT_ACTION_OPTIONS;
  const currentAction = entry.actionType || 'dialogue';
  const displayedAction = actionOptions.some((option) => option.value === currentAction)
    ? currentAction
    : actionOptions[0]?.value || 'dialogue';
  const toolbarX = clampPercent(Number(entry.x) || 50);
  const toolbarTop = clampPercent((Number(entry.y) || 50) - (Number(entry.height) || 0) / 2);
  const toolbarBottom = clampPercent((Number(entry.y) || 50) + (Number(entry.height) || 0) / 2);
  const verticalClass = toolbarTop > 15 ? 'scene-canvas-quick-toolbar--above' : 'scene-canvas-quick-toolbar--below';
  const horizontalClass = toolbarX < 18
    ? 'scene-canvas-quick-toolbar--align-left'
    : toolbarX > 82 ? 'scene-canvas-quick-toolbar--align-right' : 'scene-canvas-quick-toolbar--align-center';
  const toolbarTopPosition = verticalClass.includes('above') ? toolbarTop : toolbarBottom;
  const toolbarZIndex = Math.max(2300, getLayerZIndex(entry, type) + 300);

  const patchEntry = (updater) => patchLayerItem?.(type, id, updater);
  const stopToolbarEvent = (event) => {
    event.stopPropagation();
    if (event.type === 'contextmenu') event.preventDefault();
  };
  const toggleHiddenLabel = entry.isHidden ? 'Afficher' : 'Masquer';
  const toggleLockLabel = entry.isLocked ? 'Déverrouiller' : 'Verrouiller';

  const handleActionChange = (event) => {
    const nextActionType = event.target.value;
    patchEntry((item) => {
      if (type === 'sceneObject') item.clickMode = 'action';
      item.actionType = nextActionType;
    });
  };

  const handlePreview = () => {
    onBeforePreview?.();
    previewScene?.(selectedSceneId);
  };

  return (
    <div
      className={`scene-canvas-quick-toolbar ${verticalClass} ${horizontalClass}`}
      style={{ left: `${toolbarX}%`, top: `${toolbarTopPosition}%`, zIndex: toolbarZIndex }}
      role="toolbar"
      aria-label="Actions rapides de la sélection"
      onPointerDown={stopToolbarEvent}
      onMouseDown={stopToolbarEvent}
      onClick={stopToolbarEvent}
      onContextMenu={stopToolbarEvent}
    >
      <ToolbarButton label="Dupliquer" onClick={() => duplicateSelectedEditorItems?.()}>
        <Copy size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Supprimer" danger onClick={() => { void deleteSelectedEditorItems?.(); }}>
        <Trash2 size={15} aria-hidden="true" />
      </ToolbarButton>
      <span className="scene-canvas-toolbar-separator" aria-hidden="true" />
      <ToolbarButton label={toggleHiddenLabel} active={Boolean(entry.isHidden)} onClick={() => patchEntry((item) => { item.isHidden = !item.isHidden; })}>
        {entry.isHidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
      </ToolbarButton>
      <ToolbarButton label={toggleLockLabel} active={Boolean(entry.isLocked)} onClick={() => patchEntry((item) => { item.isLocked = !item.isLocked; })}>
        {entry.isLocked ? <LockOpen size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
      </ToolbarButton>
      <ToolbarButton label="Mettre devant" onClick={() => sendLayerToEdge?.(type, id, 'front')}>
        <BringToFront size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Mettre derrière" onClick={() => sendLayerToEdge?.(type, id, 'back')}>
        <SendToBack size={15} aria-hidden="true" />
      </ToolbarButton>
      {(canUseQuickLogic && openQuickLogicForTarget) || showActionSelect || previewScene ? (
        <span className="scene-canvas-toolbar-separator" aria-hidden="true" />
      ) : null}
      {canUseQuickLogic && openQuickLogicForTarget ? (
        <ToolbarButton label="Ouvrir logique" onClick={() => openQuickLogicForTarget(type, id)}>
          <Workflow size={15} aria-hidden="true" />
        </ToolbarButton>
      ) : null}
      {showActionSelect ? (
        <label className="scene-canvas-toolbar-select" title="Changer action">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <select value={displayedAction} aria-label="Changer action" onChange={handleActionChange}>
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}
      {previewScene ? (
        <ToolbarButton label="Tester la zone" onClick={handlePreview}>
          {isHotspot ? <MousePointerClick size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </ToolbarButton>
      ) : null}
    </div>
  );
}
