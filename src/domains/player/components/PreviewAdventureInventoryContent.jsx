import { resolveAssetUrl } from '../../../shared/services/assetManager';

export default function PreviewAdventureInventoryContent({
  compact = false,
  sharedPlayerMode,
  chosenConversationReplyIds,
  hiddenReplies,
  visibleStoryVariableEntries,
  endingReplies,
  activeEnding,
  endingLabel,
  getStoryVariableJournalLabel,
  renderAdventureJournal,
  debugInventoryItemId,
  setDebugInventoryItemId,
  project,
  addDebugInventoryItem,
  removeDebugInventoryItem,
  inventory,
  selectedInventoryIds,
  setDialogue,
  combineInventoryItems,
  openInventoryItem,
  setDraggedInventoryId,
  draggedInventoryId,
}) {
  return (
    <>
      <div className="player-adventure-drawer-grid">
        {!sharedPlayerMode ? (
          <div className={`adventure-state-card ${compact ? 'compact' : ''}`}>
            <div className="panel-head">
              <h3>Progression</h3>
            </div>
            <div className="adventure-state-grid">
              <span><strong>{chosenConversationReplyIds.length}</strong> choix</span>
              <span><strong>{hiddenReplies.length}</strong> cachés</span>
              <span><strong>{visibleStoryVariableEntries.length}</strong> variables</span>
              <span><strong>{endingReplies.length}</strong> fins</span>
            </div>
            <div className="adventure-state-list">
              {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.slice(0, compact ? 6 : undefined).map(([key, value]) => (
                <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
              )) : <span>Aucune variable d'histoire modifiée.</span>}
              {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
            </div>
          </div>
        ) : null}
        {!sharedPlayerMode ? renderAdventureJournal(compact) : null}
      </div>
      {!sharedPlayerMode ? (
        <div className="inventory-test-tools">
          <span className="small-note">Test inventaire</span>
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
      <button
        type="button"
        className="secondary-action player-combine-button"
        onClick={() => {
          if (selectedInventoryIds.length !== 2) {
            setDialogue('Sélectionne 2 objets a combiner.');
            return;
          }
          combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
        }}
      >
        Combiner les 2 objets
      </button>
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
                {itemImageUrl ? <img src={itemImageUrl} alt={item.name} /> : <span>{item.icon || 'Objet'}</span>}
              </div>
              <strong>{item.name}</strong>
            </button>
          );
        }) : <p>Aucun objet.</p>}
      </div>
      <p className="small-note">Cliquer = voir l'image. Glisser-deposer un objet sur un autre = tenter une combinaison.</p>
    </>
  );
}
