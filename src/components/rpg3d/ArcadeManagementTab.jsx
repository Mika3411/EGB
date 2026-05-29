import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  ChevronDown,
  ChevronRight,
  Cuboid,
  Folder,
  FolderOpen,
  List,
  Mountain,
  MousePointer2,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  STUDIO_CHARACTER_ROLE_LABELS,
  CHARACTER_IMPORT_GROUPS,
  DECOR_IMPORT_GROUPS,
  MAP_ENTITY_META,
  MAP_CHARACTER_MANAGEMENT_GROUPS,
  MAP_OBJECT_MANAGEMENT_GROUPS,
  MANAGEMENT_DEFAULT_OPEN_FOLDERS,
  getCountedMapProps,
  getMapEntityEditableName,
  getMapEntityFallbackName,
  getMapEntitySubtitle,
  normalizeAssetExplorerText,
  getUniqueManagementEntities,
  decorModelMatchesManagementGroup,
  findManagementNode,
  getCharacterImportRoleId,
  getCharacterImportSubtitle,
  getDecorImportSubtitle,
} from './rpg3dModeShared.js';

function ArcadeManagementRow({
  Icon,
  tone = 'neutral',
  active = false,
  label,
  name,
  subtitle = '',
  placeholder,
  thumbnail,
  onEdit,
  onDelete,
}) {
  const displayName = name || placeholder || label;
  return (
    <article className={`arcade-management-row ${active ? 'active' : ''}`}>
      <span className={`arcade-management-thumb ${tone}`}>
        {thumbnail ? <img src={thumbnail} alt="" /> : <Icon aria-hidden="true" size={18} />}
      </span>
      <div className="arcade-management-main">
        <strong>{displayName}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      <div className="arcade-management-actions">
        <button type="button" className="secondary-action compact" onClick={onEdit}>
          <MousePointer2 aria-hidden="true" size={15} />
          <span>Editer</span>
        </button>
        <button type="button" className="danger-button compact" onClick={onDelete}>
          <Trash2 aria-hidden="true" size={15} />
          <span>Supprimer</span>
        </button>
      </div>
    </article>
  );
}

function ArcadeManagementFolderNode({
  node,
  depth = 0,
  activeFilter,
  openFolders,
  onSelect,
  onToggle,
}) {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const isActive = activeFilter === node.id;
  const isOpen = hasChildren && openFolders.has(node.id);
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const LeafIcon = node.icon || Folder;
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <div className="arcade-management-folder-branch">
      <button
        type="button"
        className={`arcade-map-explorer-row arcade-management-folder-row ${isActive ? 'active' : ''}`}
        style={{ '--asset-depth': depth }}
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) onToggle(node.id);
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={hasChildren ? isOpen : undefined}
      >
        {hasChildren ? (
          <ChevronIcon className="arcade-map-explorer-chevron" aria-hidden="true" size={14} />
        ) : (
          <span className="arcade-map-explorer-elbow" aria-hidden="true" />
        )}
        <span className={`arcade-map-explorer-folder-icon ${node.tone || 'neutral'}`}>
          {hasChildren ? <FolderIcon aria-hidden="true" size={16} /> : <LeafIcon aria-hidden="true" size={15} />}
        </span>
        <span className="arcade-map-explorer-label">
          <strong>{node.label}</strong>
          {node.subtitle ? <small>{node.subtitle}</small> : null}
        </span>
        <small className="arcade-map-explorer-count">{node.count}</small>
      </button>
      {isOpen ? (
        <div className="arcade-map-explorer-children">
          {children.map((child) => (
            <ArcadeManagementFolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFilter={activeFilter}
              openFolders={openFolders}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArcadeManagementSection({ title, count, actions = null, emptyLabel, children }) {
  return (
    <section className="panel arcade-management-panel">
      <div className="panel-head">
        <div>
          <span className="section-kicker">{count}</span>
          <h2>{title}</h2>
        </div>
        {actions ? <div className="arcade-management-section-actions">{actions}</div> : null}
      </div>
      {count ? (
        <div className="arcade-management-list">{children}</div>
      ) : (
        <div className="empty-state-inline">{emptyLabel}</div>
      )}
    </section>
  );
}

function ArcadeManagementTab({
  config,
  selected,
  studioProject,
  onCreateStudioCharacter,
  onCreateStudioDecor,
  onRenameStudioCharacter,
  onRenameStudioDecor,
  onDeleteStudioCharacter,
  onDeleteStudioDecor,
  onEditStudioCharacter,
  onEditStudioDecor,
  onRenameMapEntity,
  onDeleteMapEntity,
  onEditMapEntity,
}) {
  const studioCharacters = studioProject.characterModels3d || [];
  const studioDecors = studioProject.decorModels3d || [];
  const mapCharacters = [
    ...(config.heroes || []).map((item, index) => ({ type: 'hero', item, index })),
    ...(config.enemies || []).map((item, index) => ({ type: 'enemy', item, index })),
  ];
  const mapObjects = [
    ...getCountedMapProps(config).map((item, index) => ({ type: 'prop', item, index })),
    ...(config.reliefs || []).map((item, index) => ({ type: 'relief', item, index })),
    ...(config.obstacles || []).map((item, index) => ({ type: 'obstacle', item, index })),
    ...(config.pickups || []).map((item, index) => ({ type: 'pickup', item, index })),
    ...(config.actionZones || []).map((item, index) => ({ type: 'actionZone', item, index })),
  ];
  const visibleMapCharacters = getUniqueManagementEntities(mapCharacters, selected);
  const visibleMapObjects = getUniqueManagementEntities(mapObjects, selected);
  const [managementFilter, setManagementFilter] = useState('all');
  const [managementQuery, setManagementQuery] = useState('');
  const [openManagementFolders, setOpenManagementFolders] = useState(() => new Set(MANAGEMENT_DEFAULT_OPEN_FOLDERS));
  const normalizedManagementQuery = useMemo(
    () => normalizeAssetExplorerText(managementQuery.trim()),
    [managementQuery],
  );
  const totalManagementCount = studioCharacters.length + studioDecors.length + visibleMapCharacters.length + visibleMapObjects.length;

  const managementFolderTree = useMemo(() => {
    const countStudioCharactersByRole = (roleId) => (
      studioCharacters.filter((model) => getCharacterImportRoleId(model) === roleId).length
    );
    const buildDecorNode = (group) => {
      const children = (group.children || []).map(buildDecorNode);
      const count = children.length
        ? children.reduce((sum, child) => sum + child.count, 0)
        : studioDecors.filter((model) => decorModelMatchesManagementGroup(model, group.id)).length;
      return {
        id: `studioDecors:${group.id}`,
        label: group.label,
        tone: 'decor',
        icon: Mountain,
        count,
        children,
      };
    };
    const countMapEntitiesByType = (entries, type) => entries.filter((entry) => entry.type === type).length;
    const studioCount = studioCharacters.length + studioDecors.length;
    const mapCount = visibleMapCharacters.length + visibleMapObjects.length;

    return [
      {
        id: 'all',
        label: 'Tout',
        subtitle: 'Bibliotheque et carte',
        tone: 'neutral',
        icon: List,
        count: totalManagementCount,
      },
      {
        id: 'studio',
        label: 'Bibliotheque 3D',
        subtitle: 'Fichiers crees',
        tone: 'character',
        count: studioCount,
        children: [
          {
            id: 'studioCharacters',
            label: 'Personnages 3D',
            tone: 'character',
            icon: Cuboid,
            count: studioCharacters.length,
            children: CHARACTER_IMPORT_GROUPS.map((group) => ({
              id: `studioCharacters:${group.id}`,
              label: group.label,
              tone: 'character',
              icon: Cuboid,
              count: countStudioCharactersByRole(group.id),
            })),
          },
          {
            id: 'studioDecors',
            label: 'Objets 3D',
            tone: 'decor',
            icon: Mountain,
            count: studioDecors.length,
            children: DECOR_IMPORT_GROUPS.map(buildDecorNode),
          },
        ],
      },
      {
        id: 'map',
        label: 'Carte active',
        subtitle: 'Elements poses',
        tone: 'decor',
        count: mapCount,
        children: [
          {
            id: 'mapCharacters',
            label: 'Personnages carte',
            tone: 'character',
            icon: Shield,
            count: visibleMapCharacters.length,
            children: MAP_CHARACTER_MANAGEMENT_GROUPS.map((group) => ({
              id: `mapCharacters:${group.id}`,
              label: group.label,
              tone: 'character',
              icon: group.icon,
              count: countMapEntitiesByType(visibleMapCharacters, group.id),
            })),
          },
          {
            id: 'mapObjects',
            label: 'Objets carte',
            tone: 'decor',
            icon: Box,
            count: visibleMapObjects.length,
            children: MAP_OBJECT_MANAGEMENT_GROUPS.map((group) => ({
              id: `mapObjects:${group.id}`,
              label: group.label,
              tone: MAP_ENTITY_META[group.id]?.tone || 'decor',
              icon: group.icon,
              count: countMapEntitiesByType(visibleMapObjects, group.id),
            })),
          },
        ],
      },
    ];
  }, [studioCharacters, studioDecors, totalManagementCount, visibleMapCharacters, visibleMapObjects]);

  const toggleManagementFolder = useCallback((folderId) => {
    setOpenManagementFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const activeManagementNode = findManagementNode(managementFolderTree, managementFilter);
  const activeManagementLabel = activeManagementNode?.label || 'Tout';
  const showStudioCharacters = ['all', 'studio', 'studioCharacters'].includes(managementFilter)
    || managementFilter.startsWith('studioCharacters:');
  const showStudioDecors = ['all', 'studio', 'studioDecors'].includes(managementFilter)
    || managementFilter.startsWith('studioDecors:');
  const showMapCharacters = ['all', 'map', 'mapCharacters'].includes(managementFilter)
    || managementFilter.startsWith('mapCharacters:');
  const showMapObjects = ['all', 'map', 'mapObjects'].includes(managementFilter)
    || managementFilter.startsWith('mapObjects:');

  const modelMatchesQuery = (parts = []) => (
    !normalizedManagementQuery || normalizeAssetExplorerText(parts.filter(Boolean).join(' ')).includes(normalizedManagementQuery)
  );
  const studioCharacterMatchesFilter = (model) => {
    if (managementFilter.startsWith('studioCharacters:')) {
      return getCharacterImportRoleId(model) === managementFilter.replace('studioCharacters:', '');
    }
    return showStudioCharacters;
  };
  const studioDecorMatchesFilter = (model) => {
    if (managementFilter.startsWith('studioDecors:')) {
      return decorModelMatchesManagementGroup(model, managementFilter.replace('studioDecors:', ''));
    }
    return showStudioDecors;
  };
  const mapEntityMatchesFilter = (entry, sectionId) => {
    if (!managementFilter.startsWith(`${sectionId}:`)) return true;
    return entry.type === managementFilter.replace(`${sectionId}:`, '');
  };
  const filteredStudioCharacters = showStudioCharacters
    ? studioCharacters.filter((model) => (
      studioCharacterMatchesFilter(model)
      && modelMatchesQuery([model.name, getCharacterImportSubtitle(model), STUDIO_CHARACTER_ROLE_LABELS[getCharacterImportRoleId(model)]])
    ))
    : [];
  const filteredStudioDecors = showStudioDecors
    ? studioDecors.filter((model) => (
      studioDecorMatchesFilter(model)
      && modelMatchesQuery([model.name, getDecorImportSubtitle(model), model.modelName, model.imageName])
    ))
    : [];
  const filteredMapCharacters = showMapCharacters
    ? visibleMapCharacters.filter((entry) => (
      mapEntityMatchesFilter(entry, 'mapCharacters')
      && modelMatchesQuery([
        getMapEntityEditableName(entry.type, entry.item),
        getMapEntityFallbackName(entry.type, entry.index),
        getMapEntitySubtitle(entry.type, entry.item),
        MAP_ENTITY_META[entry.type]?.label,
      ])
    ))
    : [];
  const filteredMapObjects = showMapObjects
    ? visibleMapObjects.filter((entry) => (
      mapEntityMatchesFilter(entry, 'mapObjects')
      && modelMatchesQuery([
        getMapEntityEditableName(entry.type, entry.item),
        getMapEntityFallbackName(entry.type, entry.index),
        getMapEntitySubtitle(entry.type, entry.item),
        MAP_ENTITY_META[entry.type]?.label,
      ])
    ))
    : [];
  const displayedManagementCount = filteredStudioCharacters.length
    + filteredStudioDecors.length
    + filteredMapCharacters.length
    + filteredMapObjects.length;
  const visibleManagementSectionCount = [
    showStudioCharacters,
    showStudioDecors,
    showMapCharacters,
    showMapObjects,
  ].filter(Boolean).length;
  const getManagementEmptyLabel = (label) => (
    normalizedManagementQuery ? `${label} ne correspond.` : `${label}.`
  );

  return (
    <section className="arcade-management-tab" aria-label="Gestion des objets et personnages">
      <aside className="panel side panel-nav-pro scene-left-nav arcade-management-nav" aria-label="Dossiers de gestion">
        <div className="scene-nav-section">
          <div className="scene-nav-section-head">
            <div>
              <span className="section-kicker"><FolderOpen aria-hidden="true" size={14} /> Rangement</span>
              <h2>Dossiers</h2>
              <small>
                {normalizedManagementQuery
                  ? `${displayedManagementCount}/${totalManagementCount} visibles`
                  : `${totalManagementCount} element${totalManagementCount > 1 ? 's' : ''}`}
              </small>
            </div>
          </div>

          <label className="arcade-map-explorer-search arcade-management-search">
            <Search aria-hidden="true" size={14} />
            <input
              type="search"
              value={managementQuery}
              aria-label="Rechercher dans la gestion"
              placeholder="Rechercher"
              onChange={(event) => setManagementQuery(event.target.value)}
            />
          </label>

          <div className="arcade-map-explorer-tree arcade-management-folder-tree">
            {managementFolderTree.map((node) => (
              <ArcadeManagementFolderNode
                key={node.id}
                node={node}
                activeFilter={managementFilter}
                openFolders={openManagementFolders}
                onSelect={setManagementFilter}
                onToggle={toggleManagementFolder}
              />
            ))}
          </div>
        </div>
      </aside>

      <div className={`arcade-management-workspace ${visibleManagementSectionCount === 1 ? 'single-section' : ''}`}>
        <section className="panel arcade-management-summary">
          <div>
            <span className="section-kicker"><List aria-hidden="true" size={14} /> Gestion</span>
            <h2>Objets et personnages</h2>
          </div>
          <span className="status-badge soft">{activeManagementLabel}</span>
          <div className="arcade-management-top-actions">
            <button type="button" className="secondary-action" onClick={onCreateStudioCharacter}>
              <Cuboid aria-hidden="true" size={15} />
              <span>Personnage 3D</span>
            </button>
            <button type="button" className="secondary-action" onClick={onCreateStudioDecor}>
              <Mountain aria-hidden="true" size={15} />
              <span>Objet 3D</span>
            </button>
          </div>
        </section>

        {showStudioCharacters ? (
          <ArcadeManagementSection
            title="Personnages 3D crees"
            count={filteredStudioCharacters.length}
            emptyLabel={getManagementEmptyLabel('Aucun personnage 3D')}
          >
            {filteredStudioCharacters.map((model) => (
              <ArcadeManagementRow
                key={model.id}
                Icon={Cuboid}
                tone="character"
                label="Personnage 3D"
                name={model.name || ''}
                subtitle={getCharacterImportSubtitle(model)}
                placeholder="Personnage 3D"
                onEdit={() => onEditStudioCharacter(model.id)}
                onDelete={() => onDeleteStudioCharacter(model.id)}
              />
            ))}
          </ArcadeManagementSection>
        ) : null}

        {showStudioDecors ? (
          <ArcadeManagementSection
            title="Objets 3D crees"
            count={filteredStudioDecors.length}
            emptyLabel={getManagementEmptyLabel('Aucun objet 3D')}
          >
            {filteredStudioDecors.map((model) => (
              <ArcadeManagementRow
                key={model.id}
                Icon={Mountain}
                tone="decor"
                label="Objet 3D"
                name={model.name || ''}
                subtitle={getDecorImportSubtitle(model)}
                placeholder="Objet 3D"
                thumbnail={model.imageData || ''}
                onEdit={() => onEditStudioDecor(model.id)}
                onDelete={() => onDeleteStudioDecor(model.id)}
              />
            ))}
          </ArcadeManagementSection>
        ) : null}

        {showMapCharacters ? (
          <ArcadeManagementSection
            title="Personnages sur la carte"
            count={filteredMapCharacters.length}
            emptyLabel={getManagementEmptyLabel('Aucun personnage place')}
          >
            {filteredMapCharacters.map(({ type, item, index }) => {
              const meta = MAP_ENTITY_META[type];
              const name = getMapEntityEditableName(type, item);
              const placeholder = getMapEntityFallbackName(type, index);
              return (
                <ArcadeManagementRow
                  key={item.id}
                  Icon={meta.icon}
                  tone={meta.tone}
                  active={selected?.type === type && selected.id === item.id}
                  label={meta.label}
                  name={name}
                  subtitle={getMapEntitySubtitle(type, item)}
                  placeholder={placeholder}
                  thumbnail={item.characterImageData || ''}
                  onEdit={() => onEditMapEntity(type, item.id)}
                  onDelete={() => onDeleteMapEntity(type, item.id)}
                />
              );
            })}
          </ArcadeManagementSection>
        ) : null}

        {showMapObjects ? (
          <ArcadeManagementSection
            title="Objets sur la carte"
            count={filteredMapObjects.length}
            emptyLabel={getManagementEmptyLabel('Aucun objet place')}
          >
            {filteredMapObjects.map(({ type, item, index }) => {
              const meta = MAP_ENTITY_META[type];
              const name = getMapEntityEditableName(type, item);
              const placeholder = getMapEntityFallbackName(type, index);
              return (
                <ArcadeManagementRow
                  key={item.id}
                  Icon={meta.icon}
                  tone={meta.tone}
                  active={selected?.type === type && selected.id === item.id}
                  label={meta.label}
                  name={name}
                  subtitle={getMapEntitySubtitle(type, item)}
                  placeholder={placeholder}
                  thumbnail={item.imageData || ''}
                  onEdit={() => onEditMapEntity(type, item.id)}
                  onDelete={() => onDeleteMapEntity(type, item.id)}
                />
              );
            })}
          </ArcadeManagementSection>
        ) : null}
      </div>
    </section>
  );
}

export default ArcadeManagementTab;
