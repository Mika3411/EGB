function MenuItem({ children, shortcut = '', onClick, disabled = false, active = false, danger = false }) {
  return (
    <button
      type="button"
      className={`editor-menu-item ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        event.currentTarget.closest('details')?.removeAttribute('open');
      }}
    >
      <span>{children}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

export function HelpLabel({ children, help }) {
  return (
    <label className="label-with-help">
      <span>{children}</span>
      <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
    </label>
  );
}

export function EditorToolbarMenus({
  fullscreen = false,
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
  alignSelectedEditorItems,
  enterEditorFullscreen,
  setFullscreenZoom,
  clampFullscreenZoom,
  resetFullscreenView,
  snapGridEnabled,
  setSnapGridEnabled,
  addHotspot,
  addSceneObject,
  addVisualEffectZone,
}) {
  return (
    <nav className="editor-menu-bar" aria-label="Menus de l'éditeur de scène">
      <details className="editor-menu">
        <summary>Fichier</summary>
        <div className="editor-menu-popover">
          <MenuItem onClick={() => previewScene?.(selectedSceneId)}>Prévisualiser</MenuItem>
          <MenuItem danger onClick={() => deleteScene(selectedSceneId)}>Supprimer la scène</MenuItem>
          {fullscreen ? <MenuItem shortcut="Esc" onClick={closeEditorFullscreen}>Fermer ? le plein écran</MenuItem> : null}
        </div>
      </details>

      <details className="editor-menu">
        <summary>Édition</summary>
        <div className="editor-menu-popover">
          <MenuItem shortcut="Ctrl+Z" onClick={undoProjectChange} disabled={!canUndoProjectChange}>Annuler</MenuItem>
          <MenuItem shortcut="Ctrl+Y" onClick={redoProjectChange} disabled={!canRedoProjectChange}>Rétablir</MenuItem>
          <MenuItem shortcut="Ctrl+D" disabled={!activeSelectionCount} onClick={duplicateSelectedEditorItems}>Dupliquer</MenuItem>
          <MenuItem shortcut="M" active={multiSelectEnabled} onClick={() => setMultiSelectEnabled((value) => !value)}>Sélection multiple</MenuItem>
          <MenuItem shortcut="Suppr" danger disabled={!activeSelectionCount} onClick={deleteSelectedEditorItems}>Supprimer la sélection</MenuItem>
          <MenuItem disabled={activeSelectionCount < 2} onClick={() => alignSelectedEditorItems('left')}>Aligner à gauche</MenuItem>
          <MenuItem disabled={activeSelectionCount < 2} onClick={() => alignSelectedEditorItems('center')}>Aligner au centre</MenuItem>
          <MenuItem disabled={activeSelectionCount < 2} onClick={() => alignSelectedEditorItems('right')}>Aligner à droite</MenuItem>
          <MenuItem disabled={activeSelectionCount < 3} onClick={() => alignSelectedEditorItems('distribute-horizontal')}>Répartir horizontalement</MenuItem>
          <MenuItem disabled={activeSelectionCount < 2} onClick={() => alignSelectedEditorItems('same-size')}>Même taille</MenuItem>
        </div>
      </details>

      {!fullscreen ? (
        <button type="button" className="editor-menu-button" onClick={enterEditorFullscreen}>
          Mode édition
        </button>
      ) : (
        <details className="editor-menu">
          <summary>Affichage</summary>
          <div className="editor-menu-popover">
            <MenuItem shortcut="-" onClick={() => setFullscreenZoom((value) => clampFullscreenZoom(value - 0.1))}>Zoom -</MenuItem>
            <MenuItem shortcut="+" onClick={() => setFullscreenZoom((value) => clampFullscreenZoom(value + 0.1))}>Zoom +</MenuItem>
            <MenuItem onClick={resetFullscreenView}>Reinitialiser la vue</MenuItem>
            <MenuItem shortcut="G" active={snapGridEnabled} onClick={() => setSnapGridEnabled((value) => !value)}>Grille magnetique</MenuItem>
          </div>
        </details>
      )}


      <details className="editor-menu">
        <summary>Ajouter</summary>
        <div className="editor-menu-popover">
          <MenuItem onClick={addHotspot}>Zone d'action</MenuItem>
          <MenuItem onClick={addSceneObject}>Objet visible</MenuItem>
          <MenuItem onClick={addVisualEffectZone}>Zone visuelle</MenuItem>
        </div>
      </details>
    </nav>
  );
}

export function MiniMap({
  selectedScene,
  activeSceneObjectIds,
  activeHotspotIds,
  minimapViewport,
  clampPercent,
  isCollapsed = false,
  setIsCollapsed,
}) {
  if (!selectedScene) return null;
  if (isCollapsed) {
    return (
      <button
        type="button"
        className="editor-minimap editor-minimap-toggle"
        aria-label="Afficher la mini-map"
        onClick={() => setIsCollapsed?.(false)}
      >
        Carte
      </button>
    );
  }
  return (
    <div className="editor-minimap" aria-label="Mini-map de la scène">
      <button
        type="button"
        className="editor-minimap-collapse"
        aria-label="Réduire la mini-map"
        onClick={() => setIsCollapsed?.(true)}
      >
        –
      </button>
      <div className="editor-minimap-stage">
        {selectedScene.backgroundData ? <img src={selectedScene.backgroundData} alt="" /> : null}
        {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
          <span
            key={obj.id}
            className={`editor-minimap-object ${activeSceneObjectIds.includes(obj.id) ? 'selected' : ''}`}
            style={{
              left: `${clampPercent(obj.x - obj.width / 2)}%`,
              top: `${clampPercent(obj.y - obj.height / 2)}%`,
              width: `${Math.max(2, obj.width)}%`,
              height: `${Math.max(2, obj.height)}%`,
            }}
          />
        ))}
        {(selectedScene.hotspots || []).filter((spot) => !spot.isHidden).map((spot) => (
          <span
            key={spot.id}
            className={`editor-minimap-hotspot ${activeHotspotIds.includes(spot.id) ? 'selected' : ''}`}
            style={{
              left: `${clampPercent(spot.x - spot.width / 2)}%`,
              top: `${clampPercent(spot.y - spot.height / 2)}%`,
              width: `${Math.max(2, spot.width)}%`,
              height: `${Math.max(2, spot.height)}%`,
            }}
          />
        ))}
        <span
          className="editor-minimap-viewport"
          style={{
            left: `${minimapViewport.x}%`,
            top: `${minimapViewport.y}%`,
            width: `${minimapViewport.width}%`,
            height: `${minimapViewport.height}%`,
          }}
        />
      </div>
    </div>
  );
}

export function LayersPanel({
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
}) {
  if (!selectedScene) return null;
  const layers = [
    ...(selectedScene.sceneObjects || []).map((entry) => ({ entry, type: 'sceneObject', label: 'Objet' })),
    ...(selectedScene.hotspots || []).map((entry) => ({ entry, type: 'hotspot', label: 'Zone' })),
  ].sort((a, b) => getLayerZIndex(b.entry, b.type) - getLayerZIndex(a.entry, a.type));

  const selectLayer = (layer) => {
    if (layer.type === 'sceneObject') {
      setSelectedSceneObjectId(layer.entry.id);
      setSelectedSceneObjectIds([layer.entry.id]);
      setSelectedHotspotId('');
      setSelectedHotspotIds([]);
      setSelectedItemId('');
      return;
    }
    setSelectedHotspotId(layer.entry.id);
    setSelectedHotspotIds([layer.entry.id]);
    setSelectedSceneObjectId('');
    setSelectedSceneObjectIds([]);
    setSelectedItemId('');
  };

  return (
    <div className="layers-panel">
      <div className="panel-head side-editor-head"><h3>Calques</h3></div>
      {layers.length ? layers.map((layer) => {
        const selected = layer.type === 'sceneObject' ?
           activeSceneObjectIds.includes(layer.entry.id)
          : activeHotspotIds.includes(layer.entry.id);
        return (
          <div key={`${layer.type}-${layer.entry.id}`} className={`layer-row ${selected ? 'selected' : ''} ${layer.entry.isHidden ? 'hidden-layer' : ''}`}>
            <button type="button" className="layer-main" onClick={() => selectLayer(layer)}>
              <strong>{layer.entry.name || layer.label}</strong>
              <span>{layer.label} z {getLayerZIndex(layer.entry, layer.type)}</span>
            </button>
            <div className="layer-actions">
              <button type="button" title="Afficher / masquer" onClick={() => patchLayerItem(layer.type, layer.entry.id, (item) => { item.isHidden = !item.isHidden; })}>
                {layer.entry.isHidden ? 'Masqué' : 'Visible'}
              </button>
              <button type="button" title="Verrouiller / déverrouiller" onClick={() => patchLayerItem(layer.type, layer.entry.id, (item) => { item.isLocked = !item.isLocked; })}>
                {layer.entry.isLocked ? 'Verrouillé' : 'Libre'}
              </button>
              <button type="button" title="Reculer" onClick={() => nudgeLayerZIndex(layer.type, layer.entry.id, -1)}>−</button>
              <button type="button" title="Avancer" onClick={() => nudgeLayerZIndex(layer.type, layer.entry.id, 1)}>+</button>
              <button type="button" title="Tout devant" onClick={() => sendLayerToEdge(layer.type, layer.entry.id, 'front')}>Haut</button>
              <button type="button" title="Tout derrière" onClick={() => sendLayerToEdge(layer.type, layer.entry.id, 'back')}>Bas</button>
            </div>
          </div>
        );
      }) : <div className="empty-state-inline">Aucun calque pour le moment.</div>}
    </div>
  );
}
