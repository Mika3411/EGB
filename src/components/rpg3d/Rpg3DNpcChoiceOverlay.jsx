import { MousePointerClick } from 'lucide-react';

export default function Rpg3DNpcChoiceOverlay({
  choiceState,
  onClose,
  onSelectChoice,
}) {
  if (!choiceState) return null;

  return (
    <div className="overlay arcade-npc-choice-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="overlay-card wide arcade-npc-choice-card">
        <div className="panel-head">
          <div>
            <span className="section-kicker"><MousePointerClick size={14} /> PNJ</span>
            <h2>{choiceState.speaker || 'PNJ'}</h2>
            <p className="small-note">{choiceState.question || 'Que veux-tu demander ?'}</p>
          </div>
          <button type="button" className="danger-button" onClick={onClose}>Fermer</button>
        </div>
        <div className={`arcade-npc-choice-buttons arcade-npc-choice-buttons-${Math.min(3, Math.max(1, choiceState.choices?.length || 1))}`}>
          {(choiceState.choices || []).map((choice) => (
            <button key={choice.id || choice.label} type="button" className="secondary-action" onClick={() => onSelectChoice(choice)}>
              <span>{choice.label || 'Repondre'}</span>
            </button>
          ))}
          {!choiceState.choices?.length ? (
            <button type="button" className="code-primary-button" onClick={onClose}>Continuer</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
