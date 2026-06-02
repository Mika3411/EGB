import { resolveAssetUrl } from '../../lib/assetManager';

export default function PreviewSidePanel({
  isChoiceAdventure,
  playScene,
  getSceneLabel,
  dialogue,
  renderHeroAdventurePanel,
  isHeroAdventure,
  renderHeroCharacterPage,
  selectedInventoryIds,
  setDialogue,
  combineInventoryItems,
  sharedPlayerMode,
  debugInventoryItemId,
  setDebugInventoryItemId,
  project,
  addDebugInventoryItem,
  removeDebugInventoryItem,
  inventory,
  chosenConversationReplyIds,
  hiddenReplies,
  storyVariableEntries,
  endingReplies,
  visibleStoryVariableEntries,
  getStoryVariableJournalLabel,
  activeEnding,
  endingLabel,
  renderAdventureJournal,
  openInventoryItem,
  setDraggedInventoryId,
  draggedInventoryId,
}) {
  if (isChoiceAdventure) return null;

  return (
    <section className="panel side player-side-panel">
      <div className="badge-line">{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</div>
      <div className="dialogue-box"><p>{dialogue || 'Aucun message.'}</p></div>
      {renderHeroAdventurePanel()}

      {isHeroAdventure ? renderHeroCharacterPage() : (
        <>
          <div className="panel-head panel-head-spaced">
            <h3>Inventaire</h3>
            <button
              onClick={() => {
                if (selectedInventoryIds.length !== 2) {
                  setDialogue('Sélectionne 2 objets à combiner.');
                  return;
                }
                combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
              }}
            >
              Combiner les 2 objets
            </button>
          </div>
          {!sharedPlayerMode ? (
            <div className="combo-card subtle-card inventory-test-tools">
              <div className="panel-head">
                <h3>Test inventaire</h3>
              </div>
              <select value={debugInventoryItemId} onChange={(event) => setDebugInventoryItemId(event.target.value)}>
                {(project.items || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
                ))}
              </select>
              <div className="inline-actions">
                <button type="button" className="secondary-action" disabled={!debugInventoryItemId} onClick={addDebugInventoryItem}>
                  Ajouter
                </button>
                <button type="button" className="danger-button" disabled={!debugInventoryItemId || !inventory.includes(debugInventoryItemId)} onClick={removeDebugInventoryItem}>
                  Retirer
                </button>
              </div>
            </div>
          ) : null}
          {!sharedPlayerMode ? (
            <div className="combo-card subtle-card adventure-state-card">
              <div className="panel-head">
                <h3>État aventure</h3>
              </div>
              <div className="adventure-state-grid">
                <span><strong>{chosenConversationReplyIds.length}</strong> choix faits</span>
                <span><strong>{hiddenReplies.length}</strong> réponses cachées</span>
                <span><strong>{storyVariableEntries.length}</strong> variables</span>
                <span><strong>{endingReplies.length}</strong> fins prevues</span>
              </div>
              <div className="adventure-state-list">
                {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.map(([key, value]) => (
                  <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
                )) : <span>Aucune variable d'histoire modifiée.</span>}
                {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
              </div>
            </div>
          ) : null}
          {!sharedPlayerMode ? renderAdventureJournal(false) : null}
          <div className="inventory-grid">
            {inventory.length ? inventory.map((itemId) => {
              const item = project.items.find((entry) => entry.id === itemId);
              if (!item) return null;
              const itemImageUrl = resolveAssetUrl(project, item.imageId, item.imageData);
              return (
                <button
                  key={itemId}
                  type="button"
                  className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
                  draggable
                  onClick={() => openInventoryItem(itemId, { previewOnly: true })}
                  onDragStart={() => setDraggedInventoryId(itemId)}
                  onDragEnd={() => setDraggedInventoryId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedInventoryId && draggedInventoryId !== itemId) {
                      combineInventoryItems(draggedInventoryId, itemId);
                    }
                    setDraggedInventoryId(null);
                  }}
                >
                  <div className="inventory-thumb">
                    {itemImageUrl ? <img src={itemImageUrl} alt={item.name} /> : <span>{item.icon || '📦'}</span>}
                  </div>
                  <strong>{item.name}</strong>
                </button>
              );
            }) : <p>Aucun objet dans l’inventaire.</p>}
          </div>
          <p className="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p>
        </>
      )}
    </section>
  );
}
