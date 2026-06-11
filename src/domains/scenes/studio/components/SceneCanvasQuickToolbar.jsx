import {
  BringToFront,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MousePointerClick,
  Pencil,
  Play,
  SendToBack,
  SlidersHorizontal,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSceneObjectBlockType, getSceneObjectClickMode } from '../../../../shared/services/sceneObjectBlocks';
import { PRO_PROMOTION_PROJECT_MODE } from '../../../../shared/services/proPromotion';
import { clampPercent, getLayerZIndex } from '../../../../shared/services/sceneRender.js';

const CLASSIC_ACTION_MODES = [PRO_PROMOTION_PROJECT_MODE, 'beginner', 'intermediate', 'expert', 'adventure', 'hero_adventure'];
const INVENTORY_ACTION_MODES = CLASSIC_ACTION_MODES.filter((mode) => mode !== PRO_PROMOTION_PROJECT_MODE);
const CINEMATIC_ACTION_MODES = ['intermediate', 'expert', 'adventure', 'hero_adventure'];
const NARRATIVE_ACTION_MODES = ['adventure', 'hero_adventure'];
const HERO_ACTION_MODES = ['hero_adventure'];
const TOOLBAR_EDGE_PADDING = 6;
const TOOLBAR_VERTICAL_GAP = 10;

const HOTSPOT_ACTION_OPTIONS = [
  { value: 'none', label: 'Aucun', modes: [PRO_PROMOTION_PROJECT_MODE] },
  { value: 'dialogue', label: 'Dialogue', modes: CLASSIC_ACTION_MODES },
  { value: 'dialogue_item', label: 'Dialogue + objet', modes: INVENTORY_ACTION_MODES },
  { value: 'external_link', label: 'Lien externe', modes: [PRO_PROMOTION_PROJECT_MODE] },
  { value: 'project_link', label: 'Projet cible', modes: CLASSIC_ACTION_MODES, requiresProAccount: true },
  { value: 'scene', label: 'Changer de scène', modes: CLASSIC_ACTION_MODES.filter((mode) => mode !== PRO_PROMOTION_PROJECT_MODE) },
  { value: 'cinematic', label: 'Lancer une cinématique', modes: CINEMATIC_ACTION_MODES },
  { value: 'conversation', label: 'Conversation texte', modes: NARRATIVE_ACTION_MODES },
  { value: 'skill_check', label: 'Test de compétence', modes: HERO_ACTION_MODES },
  { value: 'hero_combat', label: 'Combat simple', modes: HERO_ACTION_MODES },
];

const SCENE_OBJECT_ACTION_OPTIONS = [
  { value: 'none', label: 'Aucun', modes: [PRO_PROMOTION_PROJECT_MODE] },
  { value: 'dialogue', label: 'Dialogue', modes: CLASSIC_ACTION_MODES },
  { value: 'dialogue_item', label: 'Dialogue + objet', modes: INVENTORY_ACTION_MODES },
  { value: 'external_link', label: 'Lien externe', modes: [PRO_PROMOTION_PROJECT_MODE] },
  { value: 'project_link', label: 'Projet cible', modes: CLASSIC_ACTION_MODES, requiresProAccount: true },
  { value: 'scene', label: 'Changer de scène', modes: CLASSIC_ACTION_MODES.filter((mode) => mode !== PRO_PROMOTION_PROJECT_MODE) },
  { value: 'cinematic', label: 'Lancer une cinématique', modes: CINEMATIC_ACTION_MODES },
];

const normalizeProjectMode = (mode = '') => {
  if (mode === 'adventure_choices') return 'adventure';
  return CLASSIC_ACTION_MODES.includes(mode) ? mode : 'expert';
};

const getActionOptionsForMode = (options, mode, { canUseProPages = false } = {}) => {
  const projectMode = normalizeProjectMode(mode);
  return options.filter((option) => (
    option.modes.includes(projectMode)
    && (!option.requiresProAccount || canUseProPages)
  ));
};

export const getContainedToolbarOffsetX = ({
  anchorX = 0,
  containerWidth = 0,
  toolbarWidth = 0,
  padding = TOOLBAR_EDGE_PADDING,
} = {}) => {
  const safeAnchorX = Number(anchorX) || 0;
  const safeContainerWidth = Number(containerWidth) || 0;
  const safeToolbarWidth = Number(toolbarWidth) || 0;
  const safePadding = Math.max(0, Number(padding) || 0);

  if (!safeContainerWidth || !safeToolbarWidth) return -safeToolbarWidth / 2;

  const centeredLeft = safeAnchorX - safeToolbarWidth / 2;
  const minLeft = safePadding;
  const maxLeft = Math.max(minLeft, safeContainerWidth - safeToolbarWidth - safePadding);
  const containedLeft = Math.min(Math.max(centeredLeft, minLeft), maxLeft);

  return containedLeft - safeAnchorX;
};

function QuickToolbarFrame({
  toolbarX,
  toolbarTopPosition,
  toolbarZIndex,
  verticalClass,
  horizontalClass,
  measureKey = '',
  stopToolbarEvent,
  children,
}) {
  const toolbarRef = useRef(null);
  const [containedOffsetX, setContainedOffsetX] = useState(null);

  const updateToolbarPosition = useCallback(() => {
    const toolbarNode = toolbarRef.current;
    const parentNode = toolbarNode?.offsetParent || toolbarNode?.parentElement;
    if (!toolbarNode || !parentNode) return;

    const containerWidth = parentNode.clientWidth || parentNode.getBoundingClientRect?.().width || 0;
    const toolbarWidth = toolbarNode.offsetWidth || toolbarNode.getBoundingClientRect?.().width || 0;
    if (!containerWidth || !toolbarWidth) return;

    const anchorX = (clampPercent(toolbarX) / 100) * containerWidth;
    const nextOffsetX = getContainedToolbarOffsetX({ anchorX, containerWidth, toolbarWidth });
    setContainedOffsetX((currentOffsetX) => (
      currentOffsetX === null || Math.abs(currentOffsetX - nextOffsetX) > 0.5
        ? nextOffsetX
        : currentOffsetX
    ));
  }, [toolbarX]);

  useLayoutEffect(() => {
    const toolbarNode = toolbarRef.current;
    if (!toolbarNode || typeof window === 'undefined') return undefined;

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateToolbarPosition);
    };

    scheduleUpdate();

    const parentNode = toolbarNode.offsetParent || toolbarNode.parentElement;
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null;
    resizeObserver?.observe(toolbarNode);
    if (parentNode) resizeObserver?.observe(parentNode);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [measureKey, updateToolbarPosition]);

  const verticalOffset = verticalClass.includes('--above')
    ? `calc(-100% - ${TOOLBAR_VERTICAL_GAP}px)`
    : `${TOOLBAR_VERTICAL_GAP}px`;
  const transform = containedOffsetX === null
    ? undefined
    : `translate(${containedOffsetX}px, ${verticalOffset})`;

  return (
    <div
      ref={toolbarRef}
      className={`scene-canvas-quick-toolbar ${verticalClass} ${horizontalClass}`}
      style={{
        left: `${toolbarX}%`,
        top: `${toolbarTopPosition}%`,
        zIndex: toolbarZIndex,
        transform,
      }}
      role="toolbar"
      aria-label="Actions rapides de la sélection"
      onPointerDown={stopToolbarEvent}
      onMouseDown={stopToolbarEvent}
      onClick={stopToolbarEvent}
      onContextMenu={stopToolbarEvent}
    >
      {children}
    </div>
  );
}

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

function ActionDropdown({ options, value, onChange, tourId = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  const updateMenuPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 8;
    const gap = 6;
    const menuWidth = Math.min(Math.max(rect.width, 220), window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const estimatedHeight = options.length * 34 + 10;
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const availableAbove = rect.top - gap - viewportPadding;
    const openAbove = availableBelow < estimatedHeight && availableAbove > availableBelow;
    const maxHeight = Math.max(
      80,
      Math.min(estimatedHeight, openAbove ? availableAbove : availableBelow),
    );
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - gap - maxHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - maxHeight);

    setMenuStyle({
      left: `${left}px`,
      top: `${top}px`,
      width: `${menuWidth}px`,
      maxHeight: `${maxHeight}px`,
    });
  }, [options.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      const isInsideTrigger = dropdownRef.current?.contains(event.target);
      const isInsideMenu = menuRef.current?.contains(event.target);
      if (!isInsideTrigger && !isInsideMenu) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const repositionMenu = () => updateMenuPosition();

    updateMenuPosition();
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', repositionMenu);
    window.addEventListener('scroll', repositionMenu, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', repositionMenu);
      window.removeEventListener('scroll', repositionMenu, true);
    };
  }, [isOpen, updateMenuPosition]);

  if (!selectedOption) return null;

  const selectAction = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const toggleMenu = () => {
    if (!isOpen) updateMenuPosition();
    setIsOpen((open) => !open);
  };

  const menu = isOpen && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="scene-canvas-toolbar-select-menu"
        data-tour={tourId ? `${tourId}-menu` : undefined}
        ref={menuRef}
        role="listbox"
        aria-label="Changer action"
        style={menuStyle}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`scene-canvas-toolbar-select-option ${option.value === selectedOption.value ? 'active' : ''}`.trim()}
            role="option"
            aria-selected={option.value === selectedOption.value}
            onClick={() => selectAction(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="scene-canvas-toolbar-select" data-tour={tourId || undefined} ref={dropdownRef}>
      <SlidersHorizontal size={14} aria-hidden="true" />
      <button
        type="button"
        className="scene-canvas-toolbar-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Changer action"
        onClick={toggleMenu}
      >
        <span>{selectedOption.label}</span>
      </button>
      {menu}
    </div>
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
  projectMode = '',
  canUseProPages = false,
  onBeforePreview,
  editingSceneObjectTextId = '',
  onEditSceneObjectText,
  onStopEditingSceneObjectText,
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
  const effectiveProjectMode = projectMode || (isBeginnerMode ? 'beginner' : '');
  const allowProPageActions = Boolean(canUseProPages || effectiveProjectMode === PRO_PROMOTION_PROJECT_MODE);
  const isProTextObject = type === 'sceneObject'
    && effectiveProjectMode === PRO_PROMOTION_PROJECT_MODE
    && getSceneObjectBlockType(entry) === 'text';
  const isSceneObjectAction = type === 'sceneObject' && getSceneObjectClickMode(entry) === 'action';
  const isTextObject = type === 'sceneObject' && getSceneObjectBlockType(entry) === 'text';
  const isEditingText = isTextObject && editingSceneObjectTextId === id;
  const showActionSelect = isHotspot || isSceneObjectAction || isProTextObject;
  const actionOptions = isHotspot
    ? getActionOptionsForMode(HOTSPOT_ACTION_OPTIONS, effectiveProjectMode, { canUseProPages: allowProPageActions })
    : getActionOptionsForMode(SCENE_OBJECT_ACTION_OPTIONS, effectiveProjectMode, { canUseProPages: allowProPageActions });
  const currentAction = type === 'sceneObject' && getSceneObjectClickMode(entry) === 'none'
    ? 'none'
    : entry.actionType || 'dialogue';
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
  const measureKey = [
    type,
    id,
    displayedAction,
    showActionSelect ? actionOptions.length : 0,
    Boolean(canUseQuickLogic && openQuickLogicForTarget),
    Boolean(previewScene),
    Boolean(isTextObject),
    Boolean(isEditingText),
  ].join(':');

  const patchEntry = (updater) => patchLayerItem?.(type, id, updater);
  const stopToolbarEvent = (event) => {
    event.stopPropagation();
    if (event.type === 'contextmenu') event.preventDefault();
  };
  const toggleHiddenLabel = entry.isHidden ? 'Afficher' : 'Masquer';
  const toggleLockLabel = entry.isLocked ? 'Déverrouiller' : 'Verrouiller';

  const handleActionChange = (nextActionType) => {
    patchEntry((item) => {
      if (type === 'sceneObject') {
        item.clickMode = nextActionType === 'none' ? 'none' : 'action';
      }
      item.actionType = nextActionType;
      if (type === 'sceneObject' && nextActionType === 'none') item.actionType = 'dialogue';
    });
  };

  const handlePreview = () => {
    onBeforePreview?.();
    previewScene?.(selectedSceneId);
  };

  const handleEditText = () => {
    if (isEditingText) {
      onStopEditingSceneObjectText?.();
      return;
    }
    onEditSceneObjectText?.(id);
  };

  return (
    <QuickToolbarFrame
      toolbarX={toolbarX}
      toolbarTopPosition={toolbarTopPosition}
      toolbarZIndex={toolbarZIndex}
      verticalClass={verticalClass}
      horizontalClass={horizontalClass}
      measureKey={measureKey}
      stopToolbarEvent={stopToolbarEvent}
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
      {isTextObject ? (
        <ToolbarButton label={isEditingText ? "Terminer l'édition" : 'Modifier le texte'} active={isEditingText} onClick={handleEditText}>
          <Pencil size={15} aria-hidden="true" />
        </ToolbarButton>
      ) : null}
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
        <ActionDropdown
          options={actionOptions}
          value={displayedAction}
          onChange={handleActionChange}
          tourId={isHotspot ? 'hotspot-action' : 'scene-object-action'}
        />
      ) : null}
      {previewScene ? (
        <ToolbarButton label="Tester la zone" onClick={handlePreview}>
          {isHotspot ? <MousePointerClick size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </ToolbarButton>
      ) : null}
    </QuickToolbarFrame>
  );
}
