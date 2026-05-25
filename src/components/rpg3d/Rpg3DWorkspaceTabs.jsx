import { ChevronDown } from 'lucide-react';

export default function Rpg3DWorkspaceTabs({
  tabs,
  activeTabId,
  onSelectTab,
}) {
  return (
    <nav className="arcade-workspace-tabs" aria-label="Ateliers RPG 3D">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const childTabs = Array.isArray(tab.children) ? tab.children : [];
        if (childTabs.length) {
          const isActive = childTabs.some((child) => child.id === activeTabId);
          return (
            <details key={tab.id} className={`arcade-workspace-menu ${isActive ? 'active' : ''}`}>
              <summary aria-current={isActive ? 'page' : undefined}>
                <Icon aria-hidden="true" size={16} />
                <span>{tab.label}</span>
                <ChevronDown aria-hidden="true" size={15} />
              </summary>
              <div className="arcade-workspace-menu-popover">
                {childTabs.map((child) => {
                  const ChildIcon = child.icon;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className={activeTabId === child.id ? 'active' : ''}
                      aria-current={activeTabId === child.id ? 'page' : undefined}
                      onClick={(event) => {
                        onSelectTab(child.id);
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                    >
                      <ChildIcon aria-hidden="true" size={16} />
                      <span>{child.label}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        }

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
