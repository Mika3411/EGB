function ContextMenuButton({ children, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      className={`scene-canvas-context-menu-item ${danger ? 'danger' : ''}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ContextMenuSection({ title, children }) {
  return (
    <div className="scene-canvas-context-menu-section">
      {title ? <span className="scene-canvas-context-menu-title">{title}</span> : null}
      {children}
    </div>
  );
}

export default function SceneCanvasContextMenu({
  menu,
  clipboard,
  duplicateSelectedEditorItems,
  deleteSelectedEditorItems,
  nudgeLayerZIndex,
  sendLayerToEdge,
  copySceneEntry,
  pasteSceneEntry,
  createLogicRuleFromTarget,
  canUseQuickLogic = false,
  onClose,
}) {
  if (!menu) return null;

  const hasTarget = menu.type === 'hotspot' || menu.type === 'sceneObject';
  const canPaste = Boolean(clipboard);

  const run = (action) => {
    onClose?.();
    action?.();
  };

  return (
    <div
      className="scene-canvas-context-menu"
      style={{ left: menu.clientX, top: menu.clientY }}
      role="menu"
      aria-label="Menu contextuel de la zone"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuSection>
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(duplicateSelectedEditorItems)}>
          Dupliquer
        </ContextMenuButton>
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => copySceneEntry(menu.type, menu.id))}>
          Copier
        </ContextMenuButton>
        <ContextMenuButton disabled={!canPaste} onClick={() => run(() => pasteSceneEntry(menu.canvasPoint))}>
          Coller ici
        </ContextMenuButton>
        <ContextMenuButton danger disabled={!hasTarget} onClick={() => run(() => { void deleteSelectedEditorItems?.(); })}>
          Supprimer
        </ContextMenuButton>
      </ContextMenuSection>

      <ContextMenuSection title="Empilement">
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => nudgeLayerZIndex?.(menu.type, menu.id, 1))}>
          Avancer
        </ContextMenuButton>
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => nudgeLayerZIndex?.(menu.type, menu.id, -1))}>
          Reculer
        </ContextMenuButton>
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => sendLayerToEdge?.(menu.type, menu.id, 'front'))}>
          Mettre devant
        </ContextMenuButton>
        <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => sendLayerToEdge?.(menu.type, menu.id, 'back'))}>
          Mettre derrière
        </ContextMenuButton>
      </ContextMenuSection>

      {canUseQuickLogic ? (
        <ContextMenuSection title="Logique">
          <ContextMenuButton disabled={!hasTarget} onClick={() => run(() => createLogicRuleFromTarget?.(menu.type, menu.id))}>
            Créer une règle depuis cette zone
          </ContextMenuButton>
        </ContextMenuSection>
      ) : null}
    </div>
  );
}
