const tabs = [
  ['scenes', 'Scenes'],
  ['media', 'Media'],
  ['map', 'Plan'],
  ['cinematics', 'Cinematiques'],
  ['combinations', 'Combinaisons'],
  ['enigmas', 'Enigmes'],
  ['logic', 'Logique'],
  ['ai', 'IA'],
  ['shop', 'Boutique'],
  ['preview', 'Preview'],
];

export default function Tabs({ value, onChange, onProfile, projectScore }) {
  return (
    <nav className="tabs tabs-pro">
      {tabs.map(([tabValue, label]) => (
        <button key={tabValue} className={value === tabValue ? 'active' : ''} onClick={() => onChange(tabValue)}>
          <span>{label}</span>
        </button>
      ))}
      <div className="tabs-profile-cluster">
        <button className={value === 'score' ? 'active' : ''} onClick={() => onChange('score')}>
          <span>Bilan</span>
        </button>
        {projectScore ? (
          <div className={`project-score-badge ${projectScore.tone || 'warn'}`} title={projectScore.summary || ''}>
            <span>Note</span>
            <strong>{projectScore.label}</strong>
          </div>
        ) : null}
        <button type="button" className="tabs-profile-button secondary-action" onClick={onProfile}>
          <span>Profil</span>
        </button>
      </div>
    </nav>
  );
}
