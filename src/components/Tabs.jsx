const tabs = [
  ['scenes', 'Scenes'],
  ['media', 'Media'],
  ['map', 'Plan'],
  ['cinematics', 'Cinematiques'],
  ['combinations', 'Combinaisons'],
  ['enigmas', 'Enigmes'],
  ['logic', 'Logique'],
  ['ai', 'IA'],
  ['preview', 'Preview'],
  ['animation', 'Animation'],
];

const utilityTabs = [
  ['shop', 'Boutique'],
  ['help', 'Aide'],
  ['score', 'Bilan'],
];

export default function Tabs({ value, onChange, onProfile, projectScore }) {
  return (
    <nav className="tabs tabs-pro">
      {tabs.map(([tabValue, label]) => (
        <button
          key={tabValue}
          data-tour-tab={tabValue}
          className={value === tabValue ? 'active' : ''}
          onClick={() => onChange(tabValue)}
        >
          <span>{label}</span>
        </button>
      ))}
      <div className="tabs-profile-cluster">
        {utilityTabs.map(([tabValue, label]) => (
          <button
            key={tabValue}
            data-tour-tab={tabValue}
            className={value === tabValue ? 'active' : ''}
            onClick={() => onChange(tabValue)}
          >
            <span>{label}</span>
          </button>
        ))}
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
