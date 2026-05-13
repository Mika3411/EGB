export default function PreviewInventoryDrawer({
  isHeroPanelOpen = false,
  isInventoryOpen = false,
  usesImmersiveAdventurePlayer = false,
  isHeroAdventure = false,
  isChoiceAdventure = false,
  currentGameTitle = '',
  inventory = [],
  selectedInventoryIds = [],
  project = {},
  debugInventoryItemId = '',
  sharedPlayerMode = false,
  draggedInventoryId = null,
  setIsHeroPanelOpen,
  setIsInventoryOpen,
  setDebugInventoryItemId,
  setDialogue,
  setDraggedInventoryId,
  addDebugInventoryItem,
  removeDebugInventoryItem,
  combineInventoryItems,
  openInventoryItem,
  renderHeroAdventurePanel,
  renderHeroCharacterPage,
  renderAdventureInventoryContent,
}) {
  return (
    <>
      {isHeroPanelOpen && isHeroAdventure && (
        <>
          <button
            type="button"
            className="player-inventory-backdrop"
            aria-label="Fermer le panneau hero aventure"
            onClick={() => setIsHeroPanelOpen(false)}
          />
          <div className="player-inventory-drawer player-inventory-drawer--hero-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <h3>{currentGameTitle}</h3>
              <button type="button" className="secondary-button" onClick={() => setIsHeroPanelOpen(false)}>Fermer</button>
            </div>
            {renderHeroAdventurePanel(true)}
          </div>
        </>
      )}

      {isInventoryOpen && (
        <>
          {usesImmersiveAdventurePlayer ? (
            <button
              type="button"
              className="player-inventory-backdrop"
              aria-label={isHeroAdventure ? 'Fermer la fiche personnage' : 'Fermer le carnet'}
              onClick={() => setIsInventoryOpen(false)}
            />
          ) : null}
          <div className={`player-inventory-drawer ${isHeroAdventure ? 'player-inventory-drawer--hero' : isChoiceAdventure ? 'player-inventory-drawer--adventure' : ''}`} onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <h3>{isHeroAdventure ? 'Personnage' : isChoiceAdventure ? 'Carnet d aventure' : 'Inventaire'}</h3>
              <button type="button" className="secondary-button" onClick={() => setIsInventoryOpen(false)}>Fermer</button>
            </div>
            {isHeroAdventure ? renderHeroCharacterPage(true) : isChoiceAdventure ? renderAdventureInventoryContent(true) : (
              <>
                <button
                  type="button"
                  className="secondary-action player-combine-button"
                  onClick={() => {
                    if (selectedInventoryIds.length !== 2) {
                      setDialogue('Selectionne 2 objets a combiner.');
                      return;
                    }
                    combineInventoryItems(selectedInventoryIds[0], selectedInventoryIds[1]);
                  }}
                >
                  Combiner les 2 objets
                </button>
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
                <div className="inventory-grid">
                  {inventory.length ? inventory.map((itemId) => {
                    const item = (project.items || []).find((entry) => entry.id === itemId);
                    if (!item) return null;
                    return (
                      <button
                        key={itemId}
                        type="button"
                        className={`inventory-item inventory-tile ${selectedInventoryIds.includes(itemId) ? 'selected' : ''}`}
                        draggable
                        onClick={() => openInventoryItem(itemId)}
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
                          {item.imageData ? <img src={item.imageData} alt={item.name} /> : <span>{item.icon || 'Objet'}</span>}
                        </div>
                        <strong>{item.name}</strong>
                      </button>
                    );
                  }) : <p>Aucun objet.</p>}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
