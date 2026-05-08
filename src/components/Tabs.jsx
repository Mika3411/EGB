import { TABS, getTabValue } from './TabRegistry.jsx';

const mainTabKeys = [
  'scenes',
  'media',
  'plan',
  'cinematics',
  'combinations',
  'enigmas',
  'logic',
  'ai',
  'preview',
  'animation',
];

const utilityTabKeys = ['shop', 'help', 'score'];
const beginnerTabs = new Set(['scenes', 'media', 'enigmas', 'preview']);
const beginnerUtilityTabs = new Set(['shop', 'help']);
const intermediateTabs = new Set(['scenes', 'media', 'map', 'cinematics', 'enigmas', 'preview']);
const intermediateUtilityTabs = new Set(['shop', 'help', 'score']);

const getTabEntries = (tabKeys) => tabKeys.map((tabKey) => [getTabValue(tabKey), TABS[tabKey]]);

export default function Tabs({ value, onChange, onProfile, projectScore, projectMode = 'expert' }) {
  const isBeginnerMode = projectMode === 'beginner';
  const isIntermediateMode = projectMode === 'intermediate';
  const tabs = getTabEntries(mainTabKeys);
  const utilityTabs = getTabEntries(utilityTabKeys);
  const visibleTabs = isBeginnerMode
    ? tabs.filter(([tabValue]) => beginnerTabs.has(tabValue))
    : isIntermediateMode ? tabs.filter(([tabValue]) => intermediateTabs.has(tabValue)) : tabs;
  const visibleUtilityTabs = isBeginnerMode
    ? utilityTabs.filter(([tabValue]) => beginnerUtilityTabs.has(tabValue))
    : isIntermediateMode ? utilityTabs.filter(([tabValue]) => intermediateUtilityTabs.has(tabValue)) : utilityTabs;

  return (
    <nav className={`tabs tabs-pro ${isBeginnerMode ? 'beginner-tabs' : ''} ${isIntermediateMode ? 'intermediate-tabs' : ''}`}>
      {visibleTabs.map(([tabValue, tabConfig]) => (
        <button
          key={tabValue}
          data-tour-tab={tabValue}
          className={value === tabValue ? 'active' : ''}
          onClick={() => onChange(tabValue)}
        >
          <span>{tabConfig.label}</span>
        </button>
      ))}
      <div className="tabs-profile-cluster">
        {visibleUtilityTabs.map(([tabValue, tabConfig]) => (
          <button
            key={tabValue}
            data-tour-tab={tabValue}
            className={value === tabValue ? 'active' : ''}
            onClick={() => onChange(tabValue)}
          >
            <span>{tabConfig.label}</span>
          </button>
        ))}
        {!isBeginnerMode && projectScore ? (
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
