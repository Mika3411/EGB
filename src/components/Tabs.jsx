import { useEffect, useRef } from 'react';
import { TABS, getTabValue } from './TabRegistry.jsx';
import {
  Activity,
  Bot,
  Brush,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  ClipboardCheck,
  Cuboid,
  GitBranch,
  Image,
  LayoutGrid,
  Link2,
  Map,
  Mountain,
  Package,
  Play,
  Puzzle,
  ShoppingBag,
  Shield,
  Swords,
  User,
  Workflow,
} from 'lucide-react';

const primaryTabKeys = ['scenes', 'media', 'plan', 'adventure', 'hero', 'combat', 'preview'];
const creationTabKeys = ['objects', 'characters3d', 'decors3d', 'cinematics', 'enigmas', 'combinations', 'logic', 'animation', 'stunts'];
const assistantTabKeys = ['ai'];
const mainTabKeys = [...primaryTabKeys, ...creationTabKeys, ...assistantTabKeys];

const utilityTabKeys = ['shop', 'help', 'score'];
const beginnerTabs = new Set(['scenes', 'media', 'objects', 'characters3d', 'decors3d', 'enigmas', 'stunts', 'ai', 'preview']);
const beginnerUtilityTabs = new Set(['shop', 'help']);
const intermediateTabs = new Set(['scenes', 'media', 'map', 'objects', 'characters3d', 'decors3d', 'cinematics', 'enigmas', 'stunts', 'ai', 'preview']);
const intermediateUtilityTabs = new Set(['shop', 'help']);
const adventureTabs = new Set(['scenes', 'media', 'map', 'adventure', 'objects', 'characters3d', 'decors3d', 'cinematics', 'enigmas', 'logic', 'preview', 'animation', 'stunts']);
const heroAdventureTabs = new Set(['scenes', 'media', 'map', 'adventure', 'hero', 'combat', 'objects', 'characters3d', 'decors3d', 'cinematics', 'enigmas', 'logic', 'preview', 'animation', 'stunts', 'ai']);
const adventureUtilityTabs = new Set(['shop', 'help', 'score']);

const getTabEntries = (tabKeys) => tabKeys.map((tabKey) => [getTabValue(tabKey), TABS[tabKey]]);

const tabIcons = {
  scenes: LayoutGrid,
  media: Image,
  objects: Package,
  map: Map,
  adventure: GitBranch,
  cinematics: Clapperboard,
  combinations: Link2,
  enigmas: Puzzle,
  logic: Workflow,
  hero: Shield,
  combat: Swords,
  characters3d: Cuboid,
  decors3d: Mountain,
  ai: Bot,
  preview: Play,
  animation: Brush,
  stunts: Activity,
  shop: ShoppingBag,
  help: CircleHelp,
  score: ClipboardCheck,
};

function TabButton({ tabValue, tabConfig, active, onClick }) {
  const Icon = tabIcons[tabValue] || LayoutGrid;

  return (
    <button
      type="button"
      data-tour-tab={tabValue}
      className={active ? 'active' : ''}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{tabConfig.label}</span>
    </button>
  );
}

function TabMenu({ label, entries, activeValue, onChange, onToggle }) {
  if (!entries.length) return null;
  const isActive = entries.some(([tabValue]) => tabValue === activeValue);

  return (
    <details className={`tabs-menu ${isActive ? 'active' : ''}`} onToggle={onToggle}>
      <summary>
        <span>{label}</span>
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2.3} />
      </summary>
      <div className="tabs-menu-popover">
        {entries.map(([tabValue, tabConfig]) => (
          <TabButton
            key={tabValue}
            tabValue={tabValue}
            tabConfig={tabConfig}
            active={activeValue === tabValue}
            onClick={(event) => {
              onChange(tabValue);
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
          />
        ))}
      </div>
    </details>
  );
}

export default function Tabs({ value, onChange, onProfile, projectScore, projectMode = 'expert' }) {
  const navRef = useRef(null);
  const isBeginnerMode = projectMode === 'beginner';
  const isIntermediateMode = projectMode === 'intermediate';
  const isHeroAdventureMode = projectMode === 'hero_adventure';
  const isAdventureMode = projectMode === 'adventure' || isHeroAdventureMode;
  const primaryTabs = getTabEntries(primaryTabKeys);
  const creationTabs = getTabEntries(creationTabKeys);
  const assistantTabs = getTabEntries(assistantTabKeys);
  const tabs = getTabEntries(mainTabKeys);
  const utilityTabs = getTabEntries(utilityTabKeys);
  const visibleTabs = isBeginnerMode
    ? tabs.filter(([tabValue]) => beginnerTabs.has(tabValue))
    : isIntermediateMode
      ? tabs.filter(([tabValue]) => intermediateTabs.has(tabValue))
      : isHeroAdventureMode
        ? tabs.filter(([tabValue]) => heroAdventureTabs.has(tabValue))
        : isAdventureMode ? tabs.filter(([tabValue]) => adventureTabs.has(tabValue)) : tabs;
  const visiblePrimaryTabs = primaryTabs.filter(([tabValue]) => visibleTabs.some(([visibleTabValue]) => visibleTabValue === tabValue));
  const visibleCreationTabs = creationTabs.filter(([tabValue]) => visibleTabs.some(([visibleTabValue]) => visibleTabValue === tabValue));
  const visibleAssistantTabs = assistantTabs.filter(([tabValue]) => visibleTabs.some(([visibleTabValue]) => visibleTabValue === tabValue));
  const visibleUtilityTabs = isBeginnerMode
    ? utilityTabs.filter(([tabValue]) => beginnerUtilityTabs.has(tabValue))
    : isIntermediateMode
      ? utilityTabs.filter(([tabValue]) => intermediateUtilityTabs.has(tabValue))
      : isAdventureMode ? utilityTabs.filter(([tabValue]) => adventureUtilityTabs.has(tabValue)) : utilityTabs;

  const handleMenuToggle = (event) => {
    if (!event.currentTarget.open) return;
    navRef.current?.querySelectorAll('details[open]').forEach((menu) => {
      if (menu !== event.currentTarget) menu.removeAttribute('open');
    });
  };

  useEffect(() => {
    const closeOpenMenus = (event) => {
      if (navRef.current?.contains(event.target)) return;
      navRef.current?.querySelectorAll('details[open]').forEach((menu) => {
        menu.removeAttribute('open');
      });
    };

    document.addEventListener('pointerdown', closeOpenMenus);
    return () => document.removeEventListener('pointerdown', closeOpenMenus);
  }, []);

  return (
    <nav ref={navRef} className={`tabs tabs-pro ${isBeginnerMode ? 'beginner-tabs' : ''} ${isIntermediateMode ? 'intermediate-tabs' : ''} ${isAdventureMode ? 'adventure-tabs' : ''}`}>
      {visiblePrimaryTabs.map(([tabValue, tabConfig]) => (
        <TabButton
          key={tabValue}
          tabValue={tabValue}
          tabConfig={tabConfig}
          active={value === tabValue}
          onClick={() => onChange(tabValue)}
        />
      ))}
      {visibleCreationTabs.length ? (
        <TabMenu label="Créer" entries={visibleCreationTabs} activeValue={value} onChange={onChange} onToggle={handleMenuToggle} />
      ) : null}
      {visibleAssistantTabs.map(([tabValue, tabConfig]) => (
        <TabButton
          key={tabValue}
          tabValue={tabValue}
          tabConfig={tabConfig}
          active={value === tabValue}
          onClick={() => onChange(tabValue)}
        />
      ))}
      <div className="tabs-profile-cluster">
        {isBeginnerMode ? (
          visibleUtilityTabs.map(([tabValue, tabConfig]) => (
            <TabButton
              key={tabValue}
              tabValue={tabValue}
              tabConfig={tabConfig}
              active={value === tabValue}
              onClick={() => onChange(tabValue)}
            />
          ))
        ) : <TabMenu label="Outils" entries={visibleUtilityTabs} activeValue={value} onChange={onChange} onToggle={handleMenuToggle} />}
        {!isBeginnerMode && projectScore ? (
          <div className={`project-score-badge ${projectScore.tone || 'warn'}`} title={projectScore.summary || ''}>
            <span>Note</span>
            <strong>{projectScore.label}</strong>
          </div>
        ) : null}
        <button type="button" className="tabs-profile-button secondary-action" onClick={onProfile}>
          <User aria-hidden="true" size={16} strokeWidth={2.2} />
          <span>Profil</span>
        </button>
      </div>
    </nav>
  );
}
