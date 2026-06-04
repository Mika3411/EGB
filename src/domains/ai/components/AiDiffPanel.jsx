export default function AiDiffPanel({
  currentDiffLines = [],
  coherenceScore = null,
  getCoherenceLabel,
  aiHistory = [],
  restoreHistory,
  validation = null,
}) {
  return (
    <>
      {currentDiffLines.length ? (
        <div className="combo-card ai-diff-panel" data-tour="ai-diff">
          <strong>Modifications prevues</strong>
          <div>
            {currentDiffLines.map((line) => <span key={line}>{line}</span>)}
          </div>
        </div>
      ) : null}

      {coherenceScore != null ? (
        <div className="combo-card ai-coherence-panel">
          <div>
            <strong>Coherence IA</strong>
            <span>{getCoherenceLabel(coherenceScore)}</span>
          </div>
          <meter min="0" max="10" value={coherenceScore} />
          <b>{coherenceScore.toFixed(1)} / 10</b>
        </div>
      ) : null}

      {aiHistory.length ? (
        <div className="combo-card ai-history-panel">
          <strong>Historique IA</strong>
          {aiHistory.map((entry, index) => (
            <button type="button" key={entry.id} className="secondary-action" onClick={() => restoreHistory(entry)}>
              Version {index + 1} - {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      {validation ? (
        <div data-tour="ai-validation" className={`combo-card ${validation.ok ? 'success-panel' : 'danger-panel'}`}>
          <strong>{validation.ok ? 'Validation OK' : 'Validation bloquee'}</strong>
          {validation.errors?.length ? (
            <ul className="compact-list">
              {validation.errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
          {validation.warnings?.length ? (
            <p className="small-note">{validation.warnings.slice(0, 3).join(' ')}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
