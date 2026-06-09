import { showConfirm } from '../../../../shared/ui/AccessibleDialog';
import { isProPromotionProject } from '../../../../shared/services/proPromotion';

function SceneTree({
  scenes,
  allScenes,
  selectedSceneId,
  collapsedSceneIds,
  toggleSceneChildren,
  selectSceneFromTree,
  depth = 0,
}) {
  const getDirectChildScenes = (sceneId) => allScenes.filter((scene) => scene.parentSceneId === sceneId);

  return (
    <div className={depth ? 'scene-children-list' : ''}>
      {scenes.map((scene) => {
        const children = getDirectChildScenes(scene.id);
        const hasChildren = children.length > 0;
        const collapsed = collapsedSceneIds.has(scene.id);
        return (
          <div key={scene.id} className={`scene-tree-node ${hasChildren ? 'has-children' : ''}`} style={{ '--scene-depth': depth }}>
            <div className={`scene-summary ${scene.id === selectedSceneId ? 'selected' : ''}`}>
              {hasChildren ? (
                <button type="button" className="scene-collapse-button" aria-label={collapsed ? 'Afficher les sous-scènes' : 'Masquer les sous-scènes'} aria-expanded={!collapsed} onClick={(event) => toggleSceneChildren(event, scene.id)}>
                  {collapsed ? '▸' : '▾'}
                </button>
              ) : (
                <span className="scene-collapse-spacer" />
              )}
              <button type="button" className="scene-select-button" onClick={() => selectSceneFromTree(scene)}>
                <span className="scene-title-line">
                  <strong>{scene.name}{scene.aiGenerated ? <em className="ai-editor-badge">IA</em> : null}</strong>
                  <small>{hasChildren ? `${children.length} sous-scène(s)` : 'Aucune sous-scène'}</small>
                </span>
              </button>
            </div>
            {hasChildren && !collapsed ? (
              <div className="scene-children">
                <SceneTree
                  scenes={children}
                  allScenes={allScenes}
                  selectedSceneId={selectedSceneId}
                  collapsedSceneIds={collapsedSceneIds}
                  toggleSceneChildren={toggleSceneChildren}
                  selectSceneFromTree={selectSceneFromTree}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SceneSidebar({
  project,
  actsWithScenes,
  addAct,
  deleteAct,
  addScene,
  selectedSceneId,
  collapsedActIds,
  setActCollapsed,
  collapsedSceneIds,
  toggleSceneChildren,
  selectSceneFromTree,
}) {
  const sceneCount = project.scenes?.length || 0;
  const isProPromotionMode = isProPromotionProject(project);

  if (isProPromotionMode) return null;

  return (
    <section className="panel side panel-nav-pro scene-left-nav" data-tour="scene-navigation">
      <div className="scene-nav-section">
        <div className="scene-nav-section-head">
          <div>
            <span className="section-kicker">Navigation</span>
            <h2>Scènes</h2>
            <small>{sceneCount} scène{sceneCount > 1 ? 's' : ''}</small>
          </div>
          <div className="toolbar compact-toolbar scene-nav-actions">
            <button type="button" onClick={addAct}>+ Acte</button>
            <button type="button" data-tour="scene-create-button" onClick={addScene}>+ Scène</button>
          </div>
        </div>

        <div className="scene-nav-list">
          {actsWithScenes.map((act) => {
            const rootScenes = act.scenes.filter((scene) => !scene.parentSceneId);
            const canDeleteAct = act.scenes.length === 0 && project.acts.length > 1;
            const collapsed = collapsedActIds?.has(act.id);
            return (
              <details
                key={act.id}
                className="act-group"
                open={!collapsed}
                onToggle={(event) => setActCollapsed?.(act.id, !event.currentTarget.open)}
              >
                <summary className="act-heading">
                  <strong>{act.name}</strong>
                  <span className="act-heading-meta">{act.scenes.length} scène(s)</span>
                  <button
                    type="button"
                    className="act-delete-button"
                    disabled={!canDeleteAct}
                    title={canDeleteAct ? 'Supprimer cet acte vide' : 'Supprime les scènes avant de retirer cet acte'}
                    aria-label={`Supprimer ${act.name}`}
                    onClick={async (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const confirmed = await showConfirm({
                        title: "Supprimer l'acte",
                        message: `Supprimer l'acte "${act.name}" ?`,
                        confirmLabel: 'Supprimer',
                        variant: 'danger',
                      });
                      if (!confirmed) return;
                      deleteAct?.(act.id);
                    }}
                  >
                    ×
                  </button>
                </summary>
                <div className="scene-tree-menu">
                  {rootScenes.length ? (
                    <SceneTree
                      scenes={rootScenes}
                      allScenes={project.scenes}
                      selectedSceneId={selectedSceneId}
                      collapsedSceneIds={collapsedSceneIds}
                      toggleSceneChildren={toggleSceneChildren}
                      selectSceneFromTree={selectSceneFromTree}
                    />
                  ) : <p className="small-note">Aucune scène dans cet acte.</p>}
                </div>
              </details>
            );
          })}
        </div>
      </div>

    </section>
  );
}
