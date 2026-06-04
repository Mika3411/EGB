export default function PreviewAdventureJournal({
  compact = false,
  adventureJournalEntries = [],
  inventory = [],
  visibleStoryVariableEntries = [],
  activeEnding = null,
  endingLabel = '',
  getJournalItemLabel,
  getStoryVariableJournalLabel,
}) {
  return (
    <div className={`adventure-journal-card ${compact ? 'compact' : ''}`}>
      <div className="panel-head">
        <h3>Journal joueur</h3>
      </div>
      <div className="adventure-journal-grid">
        <section>
          <strong>Historique</strong>
          <div className="adventure-journal-list">
            {adventureJournalEntries.length ? adventureJournalEntries.slice(0, compact ? 4 : 8).map((entry) => (
              <span key={entry.id || `${entry.type}-${entry.title}`}>
                <strong>{entry.title || 'Note'}</strong>
                {entry.detail ? <small>{entry.detail}</small> : null}
              </span>
            )) : <span>Aucun choix important note.</span>}
          </div>
        </section>
        <section>
          <strong>Indices et etat</strong>
          <div className="adventure-state-list">
            {inventory.length ? inventory.slice(0, compact ? 4 : 8).map((itemId) => (
              <span key={itemId}>{getJournalItemLabel(itemId)}</span>
            )) : <span>Aucun indice obtenu.</span>}
            {visibleStoryVariableEntries.length ? visibleStoryVariableEntries.map(([key, value]) => (
              <span key={key}><strong>{getStoryVariableJournalLabel(key)}</strong> = {String(value)}</span>
            )) : null}
            {activeEnding ? <span><strong>Fin active</strong> = {activeEnding.title || endingLabel}</span> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
