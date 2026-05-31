import { COLOR_OPTIONS } from '../../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../../data/playerConfig';
import { parseJsonValue } from '../../lib/enigmaEngine';

const makePieceStyle = (imageData, rows, cols, pieceIndex, rotation = 0) => {
  const row = Math.floor(pieceIndex / cols);
  const col = pieceIndex % cols;
  return {
    backgroundImage: `url(${imageData})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(cols === 1 ? 0 : (col / (cols - 1)) * 100)}% ${(rows === 1 ? 0 : (row / (rows - 1)) * 100)}%`,
    transform: `rotate(${rotation}deg)`,
  };
};

export default function PreviewEnigmaContent({
  enigma,
  project,
  enigmaCodeInput,
  setEnigmaCodeInput,
  submitEnigma,
  enigmaColorAttempt,
  setEnigmaColorAttempt,
  pushEnigmaColor,
  simonPlayerTurn,
  simonPlaybackIndex,
  startSimonPlayback,
  enigmaPuzzleOrder,
  enigmaPuzzleSelectedIndex,
  clickPuzzlePiece,
  enigmaRotationAngles,
  rotatePuzzlePiece,
  enigmaDragSlots,
  returnDragPieceToBank,
  moveDragPieceToSlot,
  enigmaDraggedPiece,
  setEnigmaDraggedPiece,
  enigmaDragBank,
}) {
  if (!enigma) return null;

  const rows = Number(enigma?.gridRows) || 3;
  const cols = Number(enigma?.gridCols) || 3;
  const pieceCount = rows * cols;
  const codeSkin = enigma?.codeSkin || 'safe-wheels';
  const codeLength = Math.max(4, String(enigma?.solutionText || '').length || 4);
  const codeSlots = Array.from({ length: Math.min(codeLength, 8) }, (_, index) => enigmaCodeInput[index] || '');
  const miscMode = enigma?.miscMode || 'free-answer';
  const miscOrderingSelection = miscMode === 'ordering' ? parseJsonValue(enigmaCodeInput, []) : [];
  const miscMatchingAnswers = miscMode === 'matching' ? parseJsonValue(enigmaCodeInput, {}) : {};
  const miscMultiSelection = miscMode === 'multi-select' ? parseJsonValue(enigmaCodeInput, []) : [];
  const toggleMiscSelection = (choice) => {
    const next = miscMultiSelection.includes(choice) ?
       miscMultiSelection.filter((entry) => entry !== choice)
      : [...miscMultiSelection, choice];
    setEnigmaCodeInput(JSON.stringify(next));
  };
  const setCodeCharAt = (index, value) => {
    const chars = codeSlots.slice();
    chars[index] = value.slice(-1).toUpperCase();
    setEnigmaCodeInput(chars.join('').trimEnd());
  };
  const pressCodeKey = (key) => {
    if (key === '⌫' || key === '←') {
      setEnigmaCodeInput((enigmaCodeInput || '').slice(0, -1));
      return;
    }
    setEnigmaCodeInput(`${enigmaCodeInput || ''}${key}`.slice(0, codeSlots.length));
  };

  return (
    <>
      {enigma.type === 'code' && (
        <div>
          {codeSkin === 'safe-wheels' ? (
            <>
              <label>Roulettes du coffre</label>
              <div className="code-slot-row">
                {codeSlots.map((char, index) => (
                  <input
                    key={index}
                    aria-label={`Caractère ${index + 1}`}
                    value={char}
                    maxLength={1}
                    onChange={(event) => setCodeCharAt(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitEnigma();
                    }}
                    className="code-slot-input"
                  />
                ))}
              </div>
            </>
          ) : null}

          {codeSkin === 'digicode' ? (
            <>
              <label>Digicode</label>
              <div className="digicode-display">
                {codeSlots.map((char, index) => (
                  <span key={index} className="digicode-slot">
                    {char || '•'}
                  </span>
                ))}
              </div>
              <div className="digicode-grid">
                {CODE_KEYPAD_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="secondary-action code-key-button"
                    onClick={() => pressCodeKey(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {codeSkin === 'boxes' ? (
            <>
              <label>Cases du code</label>
              <div className="code-slot-row">
                {codeSlots.map((char, index) => (
                  <input
                    key={index}
                    aria-label={`Case ${index + 1}`}
                    value={char}
                    maxLength={1}
                    onChange={(event) => setCodeCharAt(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitEnigma();
                    }}
                    className="code-box-input"
                  />
                ))}
              </div>
            </>
          ) : null}

          {codeSkin === 'paper-strip' ? (
            <>
              <label>Bande papier</label>
              <input
                value={enigmaCodeInput}
                onChange={(event) => setEnigmaCodeInput(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitEnigma();
                }}
                className="paper-code-input"
              />
            </>
          ) : null}

          {!['safe-wheels', 'digicode', 'boxes', 'paper-strip'].includes(codeSkin) ? (
            <>
              <label>Code</label>
              <input value={enigmaCodeInput} onChange={(event) => setEnigmaCodeInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') submitEnigma();
              }} />
            </>
          ) : null}

          <div className="enigma-actions inline-actions">
            {codeSkin === 'digicode' ? <button type="button" className="secondary-button code-secondary-button" onClick={() => setEnigmaCodeInput('')}>Effacer</button> : null}
            <button className="code-primary-button" onClick={submitEnigma}>Valider l’énigme</button>
          </div>
        </div>
      )}

      {enigma.type === 'misc' && (
        <div>
          {miscMode === 'multiple-choice' ? (
            <>
              <label>Choisis une réponse</label>
              <div className="stack-10">
                {(enigma.miscChoices || []).map((choice, index) => (
                  <button
                    key={`${choice}-${index}`}
                    type="button"
                    className={enigmaCodeInput === choice ? 'code-primary-button' : 'secondary-action code-secondary-button'}
                    onClick={() => setEnigmaCodeInput(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {miscMode === 'true-false' ? (
            <>
              <label>Choisis une réponse</label>
              <div className="inline-actions">
                {['vrai', 'faux'].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setEnigmaCodeInput(choice)}
                    className={enigmaCodeInput === choice ? 'code-primary-button' : 'code-secondary-button'}
                  >
                    {choice === 'vrai' ? 'Vrai' : 'Faux'}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {miscMode === 'ordering' ? (
            <>
              <label>Remets dans l’ordre</label>
              <div className="stack-10">
                <div className="color-attempt-row">
                  {miscOrderingSelection.length ? miscOrderingSelection.map((choice, index) => (
                    <button key={`${choice}-${index}`} type="button" className="secondary-action code-secondary-button" onClick={() => {
                      const next = miscOrderingSelection.filter((_, entryIndex) => entryIndex !== index);
                      setEnigmaCodeInput(JSON.stringify(next));
                    }}>
                      {index + 1}. {choice}
                    </button>
                  )) : <span className="small-note">Clique les éléments dans le bon ordre.</span>}
                </div>
                {(enigma.miscChoices || []).filter((choice) => !miscOrderingSelection.includes(choice)).map((choice) => (
                  <button key={choice} type="button" className="secondary-action code-secondary-button" onClick={() => {
                    setEnigmaCodeInput(JSON.stringify([...miscOrderingSelection, choice]));
                  }}>{choice}</button>
                ))}
              </div>
            </>
          ) : null}

          {miscMode === 'matching' ? (
            <>
              <label>Associe les paires</label>
              <div className="stack-10">
                {(enigma.miscPairs || []).map((pair) => (
                  <div key={pair.left} className="matching-row">
                    <strong>{pair.left}</strong>
                    <select value={miscMatchingAnswers[pair.left] || ''} onChange={(event) => {
                      setEnigmaCodeInput(JSON.stringify({ ...miscMatchingAnswers, [pair.left]: event.target.value }));
                    }}>
                      <option value="">Choisir</option>
                      {(enigma.miscPairs || []).map((entry) => <option key={entry.right} value={entry.right}>{entry.right}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {['numeric-range', 'exact-number'].includes(miscMode) ? (
            <>
              <label>{miscMode === 'exact-number' ? 'Nombre exact' : 'Nombre'}</label>
              <input
                type="number"
                value={enigmaCodeInput}
                onChange={(event) => setEnigmaCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitEnigma();
                }}
              />
              <p className="small-note">
                {miscMode === 'exact-number' ?
                   'La réponse doit correspondre au nombre attendu.'
                  : `La réponse doit être comprise entre ${enigma.miscMin} et ${enigma.miscMax}.`}
              </p>
            </>
          ) : null}

          {miscMode === 'item-select' ? (
            <>
              <label>Choisis l’objet</label>
              <div className="stack-10">
                {(project.items || []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEnigmaCodeInput(item.id)}
                    className={enigmaCodeInput === item.id ? 'code-primary-button' : 'code-secondary-button'}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {miscMode === 'multi-select' ? (
            <>
              <label>Sélectionne toutes les bonnes réponses</label>
              <div className="stack-10">
                {(enigma.miscChoices || []).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => toggleMiscSelection(choice)}
                    className={miscMultiSelection.includes(choice) ? 'code-primary-button' : 'code-secondary-button'}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {['free-answer', 'fill-blank', 'accepted-answers'].includes(miscMode) ? (
            <>
              <label>{miscMode === 'fill-blank' ? 'Mot manquant' : 'Réponse'}</label>
              <input
                value={enigmaCodeInput}
                onChange={(event) => setEnigmaCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitEnigma();
                }}
                placeholder="Écris ta réponse..."
              />
              <p className="small-note">La réponse est acceptée même avec des majuscules différentes ou des mots en plus.</p>
            </>
          ) : null}
          <div className="enigma-actions">
            <button className="code-primary-button" onClick={submitEnigma}>Valider l’énigme</button>
          </div>
        </div>
      )}

      {enigma.type === 'colors' && (
        <div>
          <label>Suite en cours</label>
          <div className="color-attempt-row">
            {enigmaColorAttempt.length ? enigmaColorAttempt.map((color, index) => (
              <span key={`${color}-${index}`} className="color-chip" style={{ background: color }} />
            )) : <span className="small-note">Aucune couleur choisie.</span>}
          </div>
          <div className="color-picker-grid">
            {COLOR_OPTIONS.map(([value, label]) => (
              <button key={value} type="button" className="color-picker-button" style={{ background: value }} title={label} onClick={() => pushEnigmaColor(value)} />
            ))}
          </div>
          <div className="panel-head panel-head-loose">
            <button className="secondary-button" onClick={() => setEnigmaColorAttempt([])}>Effacer la suite</button>
            <button onClick={submitEnigma}>Valider l’énigme</button>
          </div>
        </div>
      )}

      {enigma.type === 'simon' && (
        <div>
          <p className="small-note">{simonPlayerTurn ? 'À toi de rejouer la séquence.' : 'Observe la séquence…'}</p>
          <div className="color-picker-grid simon-grid">
            {COLOR_OPTIONS.slice(0, 4).map(([value, label], index) => {
              const solutionColor = (enigma.solutionColors || [])[simonPlaybackIndex];
              const lit = solutionColor === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`color-picker-button simon-pad ${lit ? 'active' : ''}`}
                  style={{ background: value }}
                  title={label}
                  disabled={!simonPlayerTurn}
                  onClick={() => pushEnigmaColor(value)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="color-attempt-row panel-head-spaced">
            {enigmaColorAttempt.map((color, index) => <span key={`${color}-${index}`} className="color-chip" style={{ background: color }} />)}
          </div>
          <div className="enigma-actions">
            <button className="secondary-button" onClick={() => startSimonPlayback(enigma)}>Rejouer la séquence</button>
          </div>
        </div>
      )}

      {enigma.type === 'puzzle' && enigma.imageData && (
        <div>
          <p className="small-note">Clique une pièce, puis une deuxième pour les échanger.</p>
          <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {enigmaPuzzleOrder.map((pieceIndex, index) => (
              <button
                key={`${pieceIndex}-${index}`}
                type="button"
                className={`puzzle-piece ${enigmaPuzzleSelectedIndex === index ? 'selected' : ''}`}
                style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)}
                onClick={() => clickPuzzlePiece(index)}
              />
            ))}
          </div>
        </div>
      )}

      {enigma.type === 'rotation' && enigma.imageData && (
        <div>
          <p className="small-note">Clique sur chaque pièce pour la remettre à l’endroit.</p>
          <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: pieceCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className="puzzle-piece"
                style={makePieceStyle(enigma.imageData, rows, cols, index, enigmaRotationAngles[index] || 0)}
                onClick={() => rotatePuzzlePiece(index)}
              />
            ))}
          </div>
        </div>
      )}

      {enigma.type === 'dragdrop' && enigma.imageData && (
        <div>
          <p className="small-note">Glisse les pièces vers la bonne case. Clique une case remplie pour renvoyer sa pièce dans la réserve.</p>
          <div className="dragdrop-layout">
            <div>
              <h3>Plateau</h3>
              <div className="enigma-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {enigmaDragSlots.map((pieceIndex, slotIndex) => (
                  <button
                    key={`slot-${slotIndex}`}
                    type="button"
                    className="puzzle-slot"
                    onClick={() => returnDragPieceToBank(slotIndex)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveDragPieceToSlot(enigmaDraggedPiece, slotIndex);
                      setEnigmaDraggedPiece(null);
                    }}
                  >
                    {pieceIndex !== null && pieceIndex !== undefined ? (
                      <span className="puzzle-piece static" style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)} />
                    ) : <span className="slot-index">{slotIndex + 1}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>Pièces</h3>
              <div className="bank-grid">
                {enigmaDragBank.map((pieceIndex) => (
                  <button
                    key={`bank-${pieceIndex}`}
                    type="button"
                    className="puzzle-piece"
                    draggable
                    style={makePieceStyle(enigma.imageData, rows, cols, pieceIndex)}
                    onDragStart={() => setEnigmaDraggedPiece(pieceIndex)}
                    onDragEnd={() => setEnigmaDraggedPiece(null)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {['puzzle', 'rotation', 'dragdrop'].includes(enigma.type) && !enigma.imageData && (
        <p className="small-note">Ajoute une image dans l’onglet Énigmes pour jouer cette énigme.</p>
      )}
    </>
  );
}
