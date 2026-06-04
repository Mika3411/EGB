export default function PreviewPauseOverlay({
  isOpen = false,
  projectTitle = '',
  chosenConversationReplyCount = 0,
  completedHotspotCount = 0,
  visibleStoryVariableCount = 0,
  hasActiveEnding = false,
  isFullscreen = false,
  showInteractionHints = false,
  renderAdventureJournal,
  saveGameState,
  loadGameState,
  resetPreview,
  setShowInteractionHints,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="player-pause-overlay" onClick={onClose}>
      <div className="player-pause-menu" onClick={(event) => event.stopPropagation()}>
        <span className="eyebrow">Pause</span>
        <h2>{projectTitle || 'Escape game'}</h2>
        <div className="adventure-state-card compact">
          <strong>Progression narrative</strong>
          <div className="adventure-state-grid">
            <span><strong>{chosenConversationReplyCount}</strong> choix</span>
            <span><strong>{completedHotspotCount}</strong> actions</span>
            <span><strong>{visibleStoryVariableCount}</strong> variables</span>
            <span><strong>{hasActiveEnding ? 1 : 0}</strong> fin</span>
          </div>
        </div>
        {renderAdventureJournal(true)}
        <div className="player-pause-actions">
          <button type="button" onClick={onClose}>Reprendre</button>
          <button type="button" className="secondary-action" onClick={() => { saveGameState(); onClose(); }}>Sauvegarder</button>
          <button type="button" className="secondary-action" onClick={() => { loadGameState(); onClose(); }}>Charger</button>
          <button type="button" className="secondary-action" onClick={() => { resetPreview(); onClose(); }}>Recommencer</button>
          {isFullscreen ? (
            <button type="button" className="secondary-action" onClick={() => { document.exitFullscreen?.(); onClose(); }}>Quitter le plein écran</button>
          ) : null}
          <button type="button" className="secondary-action" onClick={() => setShowInteractionHints((value) => !value)}>
            {showInteractionHints ? 'Masquer l’aide visuelle' : 'Afficher l’aide visuelle'}
          </button>
        </div>
      </div>
    </div>
  );
}
