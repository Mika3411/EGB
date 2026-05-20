export default function Rpg3DWorkspaceTabs({
  tabs,
  activeTabId,
  onSelectTab,
}) {
  return (
    <nav className="arcade-workspace-tabs" aria-label="Ateliers RPG 3D">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            className={activeTabId === tab.id ? 'active' : ''}
            aria-current={activeTabId === tab.id ? 'page' : undefined}
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon aria-hidden="true" size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
