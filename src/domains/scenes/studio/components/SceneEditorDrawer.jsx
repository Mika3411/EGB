import { useEffect } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MousePointerClick,
  PanelRight,
  Pencil,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { getVisualEffectZoneZIndex } from '../../../../shared/ui/scene/SceneVisualEffect.jsx';

function DrawerIconButton({ label, onClick, disabled = false, active = false, children }) {
  return (
    <button
      type="button"
      className={`scene-drawer-icon-button ${active ? 'active' : ''}`.trim()}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getLayerLabel(layer) {
  if (layer.type === 'hotspot') return 'Zone';
  if (layer.type === 'visualEffectZone') return 'Zone visuelle';
  if (layer.entry.blockType === 'text') return 'Texte';
  if (layer.entry.isInvisible) return 'Objet invisible';
  return 'Objet';
}

function getLayerZIndexValue(layer, getLayerZIndex) {
  if (layer.type === 'visualEffectZone') return getVisualEffectZoneZIndex(layer.entry.layer);
  return getLayerZIndex(layer.entry, layer.type);
}

export function SceneCanvasDrawerButton({ drawerMode, setDrawerMode }) {
  const isOpen = drawerMode === 'layers';
  const stopCanvasEvent = (event) => {
    event.stopPropagation();
    if (event.type === 'contextmenu') event.preventDefault();
  };
  const toggleDrawer = (event) => {
    event.stopPropagation();
    setDrawerMode?.((currentMode) => (currentMode === 'layers' ? null : 'layers'));
  };

  return (
    <button
      type="button"
      className={`scene-canvas-drawer-button ${isOpen ? 'active' : ''}`.trim()}
      data-tour="scene-canvas-drawer"
      title="Zones et objets du canevas"
      aria-label="Ouvrir les zones et objets du canevas"
      aria-pressed={isOpen}
      onPointerDown={stopCanvasEvent}
      onMouseDown={stopCanvasEvent}
      onClick={toggleDrawer}
      onContextMenu={stopCanvasEvent}
    >
      <PanelRight aria-hidden="true" size={16} />
    </button>
  );
}

export default function SceneEditorDrawer({
  drawerMode,
  onClose,
  project,
  selectedScene,
  selectedItemId,
  setSelectedItemId,
  addItem,
  addSceneObject,
  setTab,
  activeSceneObjectIds,
  activeHotspotIds,
  selectedVisualEffectZoneId,
  selectSceneObject,
  selectHotspot,
  selectVisualEffectZone,
  getLayerZIndex,
  patchLayerItem,
  patchProject,
  selectedSceneId,
  nudgeLayerZIndex,
  sendLayerToEdge,
}) {
  useEffect(() => {
    if (!drawerMode) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [drawerMode, onClose]);

  if (!drawerMode) return null;

  const items = project.items || [];
  const layers = selectedScene ? [
    ...(selectedScene.sceneObjects || []).map((entry) => ({ entry, type: 'sceneObject' })),
    ...(selectedScene.hotspots || []).map((entry) => ({ entry, type: 'hotspot' })),
    ...(selectedScene.visualEffectZones || []).map((entry) => ({ entry, type: 'visualEffectZone' })),
  ].sort((a, b) => getLayerZIndexValue(b, getLayerZIndex) - getLayerZIndexValue(a, getLayerZIndex)) : [];

  const selectLayer = (layer) => {
    if (layer.type === 'sceneObject') {
      selectSceneObject?.(layer.entry.id);
      return;
    }
    if (layer.type === 'hotspot') {
      selectHotspot?.(layer.entry.id);
      return;
    }
    selectVisualEffectZone?.(layer.entry.id);
  };

  const patchVisualEffectZone = (zoneId, updater) => patchProject?.((draft) => {
    const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
    const zone = scene?.visualEffectZones?.find((entry) => entry.id === zoneId);
    if (zone) updater(zone);
  });

  return (
    <aside className="scene-editor-drawer" data-tour="scene-canvas-drawer-panel" aria-label={drawerMode === 'objects' ? "Liste d'objets" : 'Liste des zones et objets du canevas'}>
      <div className="scene-editor-drawer-head">
        <div>
          <span className="section-kicker">{drawerMode === 'objects' ? 'Inventaire projet' : 'Canevas'}</span>
          <h3>{drawerMode === 'objects' ? 'Objets' : 'Zones et objets'}</h3>
          <small>
            {drawerMode === 'objects'
              ? `${items.length} objet${items.length > 1 ? 's' : ''}`
              : `${layers.length} élément${layers.length > 1 ? 's' : ''}`}
          </small>
        </div>
        <button type="button" className="scene-editor-drawer-close" aria-label="Fermer le tiroir" onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </div>

      {drawerMode === 'objects' ? (
        <div className="scene-editor-drawer-body">
          <button type="button" className="scene-drawer-create-button" onClick={addItem}>
            <Plus aria-hidden="true" size={15} />
            <span>Nouvel objet</span>
          </button>
          <div className="scene-drawer-list" aria-label="Objets du projet">
            {items.length ? items.map((item) => (
              <article key={item.id} className={`scene-drawer-object-row ${item.id === selectedItemId ? 'selected' : ''}`}>
                <button type="button" className="scene-drawer-object-main" onClick={() => setSelectedItemId?.(item.id)}>
                  <span className="scene-drawer-object-thumb">
                    {item.imageData ? <img src={item.imageData} alt="" /> : <span>{item.icon || '?'}</span>}
                  </span>
                  <span className="scene-drawer-object-copy">
                    <strong>{item.name || 'Objet sans nom'}</strong>
                    <small>{item.imageName || 'Objet d’inventaire'}</small>
                  </span>
                </button>
                <div className="scene-drawer-row-actions">
                  <DrawerIconButton label="Modifier dans l’onglet Objets" onClick={() => {
                    setSelectedItemId?.(item.id);
                    setTab?.('objects');
                    onClose?.();
                  }}>
                    <Pencil aria-hidden="true" size={14} />
                  </DrawerIconButton>
                  <DrawerIconButton label="Placer dans la scène" disabled={!selectedScene} onClick={() => addSceneObject?.({ sourceItem: item })}>
                    <MousePointerClick aria-hidden="true" size={14} />
                  </DrawerIconButton>
                </div>
              </article>
            )) : (
              <div className="empty-state-inline">Aucun objet pour l’instant.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="scene-editor-drawer-body">
          <div className="scene-drawer-list" aria-label="Calques de la scène">
            {layers.length ? layers.map((layer) => {
              const label = getLayerLabel(layer);
              const selected = layer.type === 'sceneObject'
                ? activeSceneObjectIds.includes(layer.entry.id)
                : layer.type === 'hotspot'
                  ? activeHotspotIds.includes(layer.entry.id)
                  : selectedVisualEffectZoneId === layer.entry.id;
              const hidden = Boolean(layer.entry.isHidden);
              const canReorder = layer.type !== 'visualEffectZone';
              return (
                <article key={`${layer.type}-${layer.entry.id}`} className={`layer-row scene-drawer-layer-row ${selected ? 'selected' : ''} ${hidden ? 'hidden-layer' : ''}`}>
                  <button type="button" className="layer-main" onClick={() => selectLayer(layer)}>
                    <strong>{layer.entry.name || label}</strong>
                    <span>{label} z {getLayerZIndexValue(layer, getLayerZIndex)}</span>
                  </button>
                  <div className="scene-drawer-layer-meta">
                    {layer.type === 'visualEffectZone' ? <Sparkles aria-hidden="true" size={13} /> : null}
                    <span>{hidden ? 'Masqué' : 'Visible'}{layer.entry.isLocked ? ' · verrouillé' : ''}</span>
                  </div>
                  <div className="layer-actions scene-drawer-row-actions">
                    <DrawerIconButton
                      label={hidden ? 'Afficher' : 'Masquer'}
                      active={hidden}
                      onClick={() => {
                        if (layer.type === 'visualEffectZone') {
                          patchVisualEffectZone(layer.entry.id, (zone) => { zone.isHidden = !zone.isHidden; });
                          return;
                        }
                        patchLayerItem?.(layer.type, layer.entry.id, (item) => { item.isHidden = !item.isHidden; });
                      }}
                    >
                      {hidden ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
                    </DrawerIconButton>
                    <DrawerIconButton
                      label={layer.entry.isLocked ? 'Déverrouiller' : 'Verrouiller'}
                      active={Boolean(layer.entry.isLocked)}
                      disabled={layer.type === 'visualEffectZone'}
                      onClick={() => patchLayerItem?.(layer.type, layer.entry.id, (item) => { item.isLocked = !item.isLocked; })}
                    >
                      {layer.entry.isLocked ? <Lock aria-hidden="true" size={14} /> : <LockOpen aria-hidden="true" size={14} />}
                    </DrawerIconButton>
                    {canReorder ? (
                      <>
                        <DrawerIconButton label="Reculer" onClick={() => nudgeLayerZIndex?.(layer.type, layer.entry.id, -1)}>
                          <ArrowDown aria-hidden="true" size={14} />
                        </DrawerIconButton>
                        <DrawerIconButton label="Avancer" onClick={() => nudgeLayerZIndex?.(layer.type, layer.entry.id, 1)}>
                          <ArrowUp aria-hidden="true" size={14} />
                        </DrawerIconButton>
                        <DrawerIconButton label="Mettre derrière" onClick={() => sendLayerToEdge?.(layer.type, layer.entry.id, 'back')}>
                          <ChevronsDown aria-hidden="true" size={14} />
                        </DrawerIconButton>
                        <DrawerIconButton label="Mettre devant" onClick={() => sendLayerToEdge?.(layer.type, layer.entry.id, 'front')}>
                          <ChevronsUp aria-hidden="true" size={14} />
                        </DrawerIconButton>
                      </>
                    ) : (
                      <select
                        className="scene-drawer-layer-select"
                        value={layer.entry.layer || 'behind'}
                        aria-label="Plan de la zone visuelle"
                        onChange={(event) => patchVisualEffectZone(layer.entry.id, (zone) => { zone.layer = event.target.value; })}
                      >
                        <option value="behind">Arrière</option>
                        <option value="between">Milieu</option>
                        <option value="front">Avant</option>
                      </select>
                    )}
                  </div>
                </article>
              );
            }) : (
              <div className="empty-state-inline">Aucune zone ni calque pour le moment.</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
