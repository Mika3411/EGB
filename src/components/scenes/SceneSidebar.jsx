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
                <button type="button" className="scene-collapse-button" aria-label={collapsed ? 'Afficher les sous-scenes' : 'Masquer les sous-scenes'} aria-expanded={!collapsed} onClick={(event) => toggleSceneChildren(event, scene.id)}>
                  {collapsed ? '▸' : '▾'}
                </button>
              ) : (
                <span className="scene-collapse-spacer" />
              )}
              <button type="button" className="scene-select-button" onClick={() => selectSceneFromTree(scene)}>
                <span className="scene-title-line">
                  <strong>{scene.name}{scene.aiGenerated ? <em className="ai-editor-badge">IA</em> : null}</strong>
                  <small>{hasChildren ? `${children.length} sous-scene(s)` : 'Aucune sous-scene'}</small>
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
  addItem,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  selectedSceneId,
  collapsedSceneIds,
  toggleSceneChildren,
  selectSceneFromTree,
}) {
  return (
    <section className="panel side panel-nav-pro">
      <div className="panel-head panel-head-stack">
        <div>
          <span className="section-kicker">Navigation</span>
          <h2>Scenes</h2>
        </div>
        <div className="toolbar compact-toolbar">
          <button onClick={addAct}>+ Acte</button>
          <button onClick={addScene}>+ Scene</button>
        </div>
      </div>

      <div className="scene-nav-list">
        {actsWithScenes.map((act) => {
          const rootScenes = act.scenes.filter((scene) => !scene.parentSceneId);
          const canDeleteAct = act.scenes.length === 0 && project.acts.length > 1;
          return (
            <details key={act.id} className="act-group" open>
              <summary className="act-heading">
                <strong>{act.name}</strong>
                <span className="act-heading-meta">{act.scenes.length} scene(s)</span>
                <button
                  type="button"
                  className="act-delete-button"
                  disabled={!canDeleteAct}
                  title={canDeleteAct ? 'Supprimer cet acte vide' : 'Supprime les scenes avant de retirer cet acte'}
                  aria-label={`Supprimer ${act.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!window.confirm(`Supprimer l'acte "${act.name}" ?`)) return;
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
                ) : <p className="small-note">Aucune scene dans cet acte.</p>}
              </div>
            </details>
          );
        })}
      </div>

      <div className="divider-line" />

      <div className="panel-head panel-head-stack">
        <div>
          <span className="section-kicker">Inventaire</span>
          <h2>Objets</h2>
        </div>
        <button onClick={addItem}>+ Objet</button>
      </div>
      <label>Liste des objets</label>
      <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
        <option value="">Choisir un objet...</option>
        {project.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p className="small-note">Selectionne un objet pour ouvrir sa fiche dans le panneau de droite.</p>
      {selectedItem && (
        <button className={`list-card object-picker-card selected ${selectedItem.aiGenerated ? 'ai-editor-glow' : ''}`} onClick={() => setSelectedItemId(selectedItem.id)}>
          <strong>{selectedItem.name}{selectedItem.aiGenerated ? <em className="ai-editor-badge">IA</em> : null}</strong>
          <span>{selectedItem.imageName || 'Aucune image - emoji de secours utilise'}</span>
        </button>
      )}
    </section>
  );
}
