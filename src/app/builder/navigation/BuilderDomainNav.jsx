import { useEffect, useRef } from 'react';
import { TABS, getTabKey } from './domainTabs.jsx';
import {
  getClassicBuilderProjectMode,
  getClassicBuilderTabGroupsForMode,
} from '../../../shared/utils/classicBuilderTabs.js';
import {
  Bot,
  Brush,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  ClipboardCheck,
  GitBranch,
  Image,
  LayoutGrid,
  Link2,
  Map,
  Package,
  Play,
  Puzzle,
  ShoppingBag,
  Shield,
  Swords,
  User,
  Wrench,
  Workflow,
} from 'lucide-react';

const getTabEntries = (tabValues) => tabValues
  .map((tabValue) => [tabValue, TABS[getTabKey(tabValue)]])
  .filter(([, tabConfig]) => Boolean(tabConfig));

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
  ai: Bot,
  preview: Play,
  animation: Brush,
  shop: ShoppingBag,
  resources: Wrench,
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
  const effectiveProjectMode = getClassicBuilderProjectMode(projectMode);
  const isProPromotionMode = effectiveProjectMode === 'pro_promo';
  const isBeginnerMode = effectiveProjectMode === 'beginner';
  const isIntermediateMode = effectiveProjectMode === 'intermediate';
  const isAdventureMode = effectiveProjectMode === 'adventure' || effectiveProjectMode === 'hero_adventure';
  const visibleTabGroups = getClassicBuilderTabGroupsForMode(effectiveProjectMode);
  const visiblePrimaryTabs = getTabEntries(visibleTabGroups.primary);
  const visibleCreationTabs = getTabEntries(visibleTabGroups.creation);
  const visibleAssistantTabs = getTabEntries(visibleTabGroups.assistant);
  const visibleUtilityTabs = getTabEntries(visibleTabGroups.utility);

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
        {!isBeginnerMode && !isProPromotionMode && projectScore ? (
          <button
            type="button"
            className={`project-score-badge ${projectScore.tone || 'warn'}`}
            title={projectScore.summary || 'Ouvrir le bilan du projet'}
            onClick={() => onChange('score')}
            aria-current={value === 'score' ? 'page' : undefined}
            aria-label={`Ouvrir le bilan du projet, note ${projectScore.label}`}
          >
            <span>Note</span>
            <strong>{projectScore.label}</strong>
          </button>
        ) : null}
        <button type="button" className="tabs-profile-button secondary-action" onClick={onProfile}>
          <User aria-hidden="true" size={16} strokeWidth={2.2} />
          <span>Profil</span>
        </button>
      </div>
    </nav>
  );
}
