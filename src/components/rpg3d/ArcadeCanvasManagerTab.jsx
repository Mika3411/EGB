import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Map as MapIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_RPG3D_ACT_ID,
  getActiveRpg3DCanvas,
  getRpg3DCanvasStructure,
} from '../../utils/rpg3dStudioProject.js';
import {
  DEFAULT_ARCADE_CONFIG,
  cloneConfig,
} from '../../utils/rpg3dDomain.js';
import {
  getArcadeObjectCount,
} from './rpg3dModeShared.js';

function ArcadeCanvasManagerTab({
  studioProject,
  currentConfig,
  activeCanvasId,
  onCreateAct,
  onRenameAct,
  onDeleteAct,
  onCreateCanvas,
  onRenameCanvas,
  onMoveCanvasToAct,
  onSelectCanvas,
  onDeleteCanvas,
  onKeepOnlyActiveCanvas,
  onOpenCanvas,
}) {
  const structure = useMemo(() => getRpg3DCanvasStructure(studioProject), [studioProject]);
  const canvases = useMemo(() => (
    structure.canvases.map((canvas) => (
      canvas.id === activeCanvasId ? { ...canvas, config: cloneConfig(currentConfig) } : canvas
    ))
  ), [activeCanvasId, currentConfig, structure.canvases]);
  const canvasCount = canvases.length;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId)
    || canvases[0]
    || getActiveRpg3DCanvas(studioProject);
  const activeConfig = activeCanvas?.config || currentConfig || DEFAULT_ARCADE_CONFIG;
  const [collapsedActIds, setCollapsedActIds] = useState(() => new Set());
  const [selectedActId, setSelectedActId] = useState(activeCanvas?.actId || structure.acts[0]?.id || '');

  useEffect(() => {
    if (!structure.acts.length) return;
    const nextSelectedId = structure.acts.some((act) => act.id === selectedActId)
      ? selectedActId
      : activeCanvas?.actId || structure.acts[0]?.id || '';
    if (nextSelectedId !== selectedActId) setSelectedActId(nextSelectedId);
  }, [activeCanvas?.actId, selectedActId, structure.acts]);

  const selectedAct = structure.acts.find((act) => act.id === selectedActId)
    || structure.acts.find((act) => act.id === activeCanvas?.actId)
    || structure.acts[0]
    || null;
  const canvasesByAct = useMemo(() => {
    const grouped = new Map(structure.acts.map((act) => [act.id, []]));
    const fallbackActId = structure.acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
    canvases.forEach((canvas) => {
      const targetActId = grouped.has(canvas.actId) ? canvas.actId : fallbackActId;
      if (!grouped.has(targetActId)) grouped.set(targetActId, []);
      grouped.get(targetActId).push(canvas);
    });
    return grouped;
  }, [canvases, structure.acts]);
  const selectedActCanvasCount = selectedAct ? (canvasesByAct.get(selectedAct.id) || []).length : 0;
  const activeObjectCount = getArcadeObjectCount(activeConfig);
  const activeCanvasCanDelete = canvasCount > 1;
  const selectedActCanDelete = Boolean(selectedAct && structure.acts.length > 1 && selectedActCanvasCount === 0);

  const createAct = () => {
    const nextActId = onCreateAct?.();
    if (nextActId) setSelectedActId(nextActId);
  };

  const createCanvasInAct = (actId = selectedAct?.id || structure.acts[0]?.id || DEFAULT_RPG3D_ACT_ID) => {
    setSelectedActId(actId);
    onCreateCanvas?.({ actId });
  };

  const deleteSelectedAct = () => {
    if (!selectedActCanDelete || !selectedAct) return;
    const fallbackAct = structure.acts.find((act) => act.id !== selectedAct.id) || structure.acts[0];
    if (fallbackAct) setSelectedActId(fallbackAct.id);
    onDeleteAct?.(selectedAct.id);
  };

  return (
    <section className="arcade-canvas-manager-tab" aria-label="Gestion des scenes RPG 3D">
      <section className="panel side panel-nav-pro scene-left-nav arcade-canvas-nav">
        <div className="scene-nav-section">
          <div className="scene-nav-section-head">
            <div>
              <span className="section-kicker">Navigation</span>
              <h2>Scenes</h2>
              <small>{structure.acts.length} acte{structure.acts.length > 1 ? 's' : ''} - {canvasCount} canevas</small>
            </div>
            <div className="toolbar compact-toolbar scene-nav-actions arcade-canvas-nav-actions">
              <button type="button" onClick={createAct}>
                + Acte
              </button>
              <button type="button" onClick={() => createCanvasInAct()}>
                + Canevas
              </button>
            </div>
          </div>

          <div className="scene-nav-list arcade-canvas-nav-list">
            {structure.acts.map((act) => {
              const actCanvases = canvasesByAct.get(act.id) || [];
              const collapsed = collapsedActIds.has(act.id);
              const actIsSelected = selectedAct?.id === act.id;
              return (
                <details
                  key={act.id}
                  className={`act-group arcade-canvas-act-group ${actIsSelected ? 'selected' : ''}`}
                  open={!collapsed}
                  onToggle={(event) => {
                    setCollapsedActIds((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.open) next.delete(act.id);
                      else next.add(act.id);
                      return next;
                    });
                  }}
                >
                  <summary
                    className="act-heading arcade-canvas-act-heading"
                    onClick={() => setSelectedActId(act.id)}
                  >
                    <strong>{act.name || 'Acte'}</strong>
                    <span className="act-heading-meta">{actCanvases.length} canevas</span>
                    <span className="scene-collapse-spacer" />
                  </summary>
                  <div className="arcade-canvas-act-tools">
                    <button type="button" className="secondary-action" onClick={() => createCanvasInAct(act.id)}>
                      Nouveau canevas
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        setSelectedActId(act.id);
                        onDeleteAct?.(act.id);
                      }}
                      disabled={structure.acts.length <= 1 || actCanvases.length > 0}
                    >
                      Supprimer acte
                    </button>
                  </div>
                  <div className="scene-tree-menu arcade-canvas-file-list">
                    {actCanvases.length ? actCanvases.map((canvas) => {
                      const isActive = canvas.id === activeCanvasId;
                      const canvasConfig = isActive ? currentConfig : canvas.config;
                      const objectCount = getArcadeObjectCount(canvasConfig || DEFAULT_ARCADE_CONFIG);
                      return (
                        <div key={canvas.id} className={`arcade-canvas-file-row ${isActive ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="arcade-canvas-file-select"
                            onClick={() => {
                              setSelectedActId(act.id);
                              onSelectCanvas?.(canvas.id);
                            }}
                          >
                            <MapIcon aria-hidden="true" size={14} />
                            <span>
                              <strong>{canvas.name || 'Canevas'}</strong>
                              <small>{objectCount} objet{objectCount > 1 ? 's' : ''}</small>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="arcade-canvas-file-delete"
                            title={`Supprimer ${canvas.name || 'ce canevas'}`}
                            aria-label={`Supprimer ${canvas.name || 'ce canevas'}`}
                            onClick={() => onDeleteCanvas?.(canvas.id)}
                            disabled={canvasCount <= 1}
                          >
                            <Trash2 aria-hidden="true" size={13} />
                          </button>
                        </div>
                      );
                    }) : (
                      <p className="small-note">Aucun canevas dans cet acte.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel main panel-main-pro arcade-canvas-main">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Edition</span>
            <h2>Actes & canevas</h2>
          </div>
          {selectedAct ? <span className="status-badge soft">{selectedAct.name || 'Acte'}</span> : null}
        </div>

        <div className="editor-stack">
          <div className="subpanel scene-compact-card">
            <div className="subpanel-head">
              <h3>Acte sélectionné</h3>
              <div className="inline-actions end">
                <button type="button" className="secondary-action" onClick={createAct}>
                  Nouvel acte
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={deleteSelectedAct}
                  disabled={!selectedActCanDelete}
                >
                  Supprimer acte
                </button>
              </div>
            </div>
            <div className="arcade-canvas-edit-grid">
              <label>
                <span>Nom de l'acte</span>
                <input
                  type="text"
                  value={selectedAct?.name || ''}
                  placeholder="Acte"
                  onChange={(event) => selectedAct && onRenameAct?.(selectedAct.id, event.target.value)}
                />
              </label>
              <div>
                <small>Canevas dans l'acte</small>
                <strong>{selectedActCanvasCount}</strong>
              </div>
            </div>
          </div>

          <div className="subpanel scene-compact-card">
            <div className="subpanel-head">
              <h3>Canevas actif</h3>
              <div className="inline-actions end">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => createCanvasInAct(selectedAct?.id || activeCanvas?.actId)}
                >
                  Nouveau canevas
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => activeCanvas?.id && onDeleteCanvas?.(activeCanvas.id)}
                  disabled={!activeCanvasCanDelete}
                >
                  Supprimer
                </button>
                {activeCanvasCanDelete ? (
                  <button type="button" className="danger-button" onClick={onKeepOnlyActiveCanvas}>
                    Garder ce canevas
                  </button>
                ) : null}
              </div>
            </div>

            <div className="arcade-canvas-edit-grid">
              <label>
                <span>Nom du canevas</span>
                <input
                  type="text"
                  value={activeCanvas?.name || ''}
                  placeholder="Canevas"
                  onChange={(event) => activeCanvas?.id && onRenameCanvas?.(activeCanvas.id, event.target.value)}
                />
              </label>
              <label>
                <span>Acte</span>
                <select
                  value={activeCanvas?.actId || selectedAct?.id || ''}
                  onChange={(event) => {
                    setSelectedActId(event.target.value);
                    if (activeCanvas?.id) onMoveCanvasToAct?.(activeCanvas.id, event.target.value);
                  }}
                >
                  {structure.acts.map((act) => (
                    <option key={act.id} value={act.id}>{act.name || 'Acte'}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="arcade-canvas-detail-grid">
              <div>
                <small>Taille</small>
                <strong>{activeConfig?.world?.width || DEFAULT_ARCADE_CONFIG.world.width} x {activeConfig?.world?.height || DEFAULT_ARCADE_CONFIG.world.height}</strong>
              </div>
              <div>
                <small>Objets</small>
                <strong>{activeObjectCount}</strong>
              </div>
              <div>
                <small>Acte</small>
                <strong>{structure.acts.find((act) => act.id === activeCanvas?.actId)?.name || selectedAct?.name || 'Acte'}</strong>
              </div>
            </div>

            <div className="inline-actions">
              <button
                type="button"
                className="button like"
                onClick={() => {
                  if (activeCanvas?.id) onSelectCanvas?.(activeCanvas.id);
                  onOpenCanvas?.();
                }}
              >
                <MapIcon aria-hidden="true" size={15} />
                Ouvrir dans Carte RPG 3D
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

export default ArcadeCanvasManagerTab;
