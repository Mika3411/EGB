import { getVisitedAwareReplyLabel } from '../../lib/conditionEngine';

export default function PreviewStoryOverlays({
  conversationNode,
  isChoiceAdventure,
  activeConversation,
  closeConversation,
  renderChoiceEffectSummary,
  displayedConversationReplies,
  isConversationReplyAvailable,
  getConversationReplyLockReason,
  handleConversationReplyClick,
  activeEnding,
  endingLabel,
  closeEnding,
  resetPreview,
  isHeroDefeated,
  activeHeroCombat,
  isCustomHeroDefeatScene,
  loadGameState,
  restoreLastChoiceSnapshot,
  lastChoiceSnapshot,
  visitedSceneIds = [],
}) {
  return (
    <>
      {conversationNode ? (
        <div className={`overlay ${isChoiceAdventure ? 'conversation-player-overlay' : ''}`} onClick={(event) => { if (event.target === event.currentTarget) closeConversation?.(); }}>
          <div className={`overlay-card wide ${isChoiceAdventure ? 'conversation-player-card' : ''}`}>
            <div className="panel-head">
              {activeConversation?.portraitData ? (
                <img className="conversation-portrait" src={activeConversation.portraitData} alt={activeConversation.portraitName || conversationNode.speaker || 'Portrait'} />
              ) : null}
              <div>
                <h2>{conversationNode.speaker || 'Conversation'}</h2>
                <p className="small-note enigma-overlay-question">{conversationNode.text}</p>
              </div>
              <button className="danger-button" onClick={closeConversation}>Fermer</button>
            </div>
            {renderChoiceEffectSummary(true)}
            <div className={`stack-10 conversation-player-replies conversation-player-replies-${Math.min(3, Math.max(1, displayedConversationReplies.length || 1))}`}>
              {displayedConversationReplies.map((reply) => {
                const isLocked = isConversationReplyAvailable?.(reply) === false;
                const lockReason = isLocked ? getConversationReplyLockReason?.(reply) : '';
                const replyLabel = getVisitedAwareReplyLabel(reply, { visitedSceneIds }) || 'Repondre';
                return (
                  <button
                    key={reply.id}
                    type="button"
                    className={`secondary-action code-secondary-button ${isLocked ? 'conversation-reply-locked' : ''}`}
                    disabled={isLocked}
                    title={lockReason || undefined}
                    onClick={() => handleConversationReplyClick(reply)}
                  >
                    <span>{replyLabel}</span>
                    {isLocked ? <small>{lockReason || 'Choix verrouillée'}</small> : null}
                  </button>
                );
              })}
              {!displayedConversationReplies.length ? (
                <button type="button" className="code-primary-button" onClick={closeConversation}>
                  Continuer
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeEnding ? (
        <div className="overlay">
          <div className={`overlay-card ending-card ending-card-${activeEnding.type || 'neutral'}`}>
            <span className="ending-badge">{endingLabel}</span>
            <h2>{activeEnding.title || endingLabel}</h2>
            {activeEnding.message ? <p className="small-note">{activeEnding.message}</p> : null}
            <p>{activeEnding.summary || 'Ton aventure se termine ici.'}</p>
            {renderChoiceEffectSummary(true)}
            <div className="inline-actions">
              <button type="button" className="secondary-action" onClick={closeEnding}>Fermer</button>
              <button type="button" className="code-primary-button" onClick={resetPreview}>Recommencer</button>
            </div>
          </div>
        </div>
      ) : null}

      {isHeroDefeated && !activeHeroCombat && !activeEnding && !isCustomHeroDefeatScene ? (
        <div className="overlay hero-defeat-overlay">
          <div className="overlay-card hero-defeat-card">
            <span className="ending-badge">Défaite</span>
            <h2>Le héros tombe à 0 PV</h2>
            <p className="small-note">Les actions joueur sont bloquées tant que les PV restent à 0.</p>
            <p>L’aventure s’arrête ici. Recommence la partie ou charge une sauvegarde pour reprendre avant la chute.</p>
            <div className="inline-actions">
              <button type="button" className="secondary-action" onClick={loadGameState}>Charger</button>
              <button
                type="button"
                className="secondary-action"
                onClick={restoreLastChoiceSnapshot}
                disabled={!lastChoiceSnapshot}
              >
                Retour au dernier choix
              </button>
              <button type="button" className="code-primary-button" onClick={resetPreview}>Recommencer</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
