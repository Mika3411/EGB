import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Sword,
} from 'lucide-react';
import Rpg3DHelpLabel from './Rpg3DHelpLabel.jsx';
import {
  RPG3D_FIELD_HELP,
  CHARACTER_IMPORT_GROUPS,
  DECOR_IMPORT_GROUPS,
  normalizeAssetExplorerText,
  countExplorerAssets,
  getExplorerCountLabel,
  getCharacterImportRoleId,
  getDecorImportKindId,
  getCharacterImportSubtitle,
  getDecorImportSubtitle,
  makeAssetExplorerAsset,
  buildAssetExplorerRoot,
  filterAssetExplorerNode,
} from './rpg3dModeShared.js';

function ArcadeMapAssetExplorerNode({
  node,
  depth = 0,
  openFolders,
  forceOpen = false,
  onToggleFolder,
}) {
  if (node.type === 'asset') {
    const Icon = node.icon || Box;
    const label = node.label || 'Fichier';
    return (
      <button
        type="button"
        className="arcade-map-explorer-row arcade-map-explorer-file"
        style={{ '--asset-depth': depth }}
        onClick={() => node.onImport?.(node.model)}
        aria-label={`Importer ${label} dans le canvas`}
        title={`Importer ${label} dans le canvas`}
      >
        <span className="arcade-map-explorer-elbow" aria-hidden="true" />
        <span className={`arcade-map-import-thumb ${node.tone}`}>
          {node.tone === 'decor' && node.model?.imageData ? <img src={node.model.imageData} alt="" /> : <Icon aria-hidden="true" size={14} />}
        </span>
        <span className="arcade-map-explorer-label">
          <strong>{label}</strong>
          <small>{node.subtitle}</small>
        </span>
        <span className="arcade-map-explorer-add" aria-hidden="true"><Plus size={14} /></span>
      </button>
    );
  }

  const isOpen = forceOpen || openFolders.has(node.id);
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className="arcade-map-explorer-branch">
      <button
        type="button"
        className="arcade-map-explorer-row arcade-map-explorer-folder"
        style={{ '--asset-depth': depth }}
        onClick={() => onToggleFolder(node.id)}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Fermer' : 'Ouvrir'} ${node.label}`}
      >
        <ChevronIcon className="arcade-map-explorer-chevron" aria-hidden="true" size={14} />
        <span className={`arcade-map-explorer-folder-icon ${node.tone}`}>
          <FolderIcon aria-hidden="true" size={16} />
        </span>
        <span className="arcade-map-explorer-label">
          <strong>{node.label}</strong>
        </span>
        <small className="arcade-map-explorer-count">{getExplorerCountLabel(node.count)}</small>
      </button>
      {isOpen ? (
        <div className="arcade-map-explorer-children">
          {node.children.map((child) => (
            <ArcadeMapAssetExplorerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openFolders={openFolders}
              forceOpen={forceOpen}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArcadeMapAssetExplorer({
  characters,
  decors,
  onImportCharacter,
  onImportDecor,
}) {
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState(() => new Set(['characters', 'decors']));
  const normalizedQuery = useMemo(() => normalizeAssetExplorerText(query.trim()), [query]);
  const roots = useMemo(() => {
    const characterRoot = buildAssetExplorerRoot({
      id: 'characters',
      label: 'Personnages crees',
      tone: 'character',
      items: characters,
      groupOptions: CHARACTER_IMPORT_GROUPS,
      getGroupId: getCharacterImportRoleId,
      createAsset: (model, pathLabel) => makeAssetExplorerAsset({
        id: `character:${model.id}`,
        label: model.name || 'Personnage 3D',
        subtitle: getCharacterImportSubtitle(model),
        tone: 'character',
        icon: Sword,
        model,
        onImport: onImportCharacter,
        pathLabel,
      }),
    });
    const decorRoot = buildAssetExplorerRoot({
      id: 'decors',
      label: 'Objets crees',
      tone: 'decor',
      items: decors,
      groupOptions: DECOR_IMPORT_GROUPS,
      getGroupId: getDecorImportKindId,
      showEmptyGroups: true,
      createAsset: (model, pathLabel) => makeAssetExplorerAsset({
        id: `decor:${model.id}`,
        label: model.name || 'Objet 3D',
        subtitle: getDecorImportSubtitle(model),
        tone: 'decor',
        icon: Box,
        model,
        onImport: onImportDecor,
        pathLabel,
      }),
    });
    return [characterRoot, decorRoot].filter((root) => root.count > 0);
  }, [characters, decors, onImportCharacter, onImportDecor]);
  const visibleRoots = useMemo(() => (
    roots.map((root) => filterAssetExplorerNode(root, normalizedQuery)).filter(Boolean)
  ), [normalizedQuery, roots]);
  const assetCount = countExplorerAssets(roots);
  const visibleAssetCount = countExplorerAssets(visibleRoots);
  const forceOpen = Boolean(normalizedQuery);
  const toggleFolder = useCallback((folderId) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  return (
    <div className="arcade-map-imports" aria-label="Importer des elements crees dans le canvas">
      <div className="arcade-map-explorer-head">
        <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.assetFiles}>Fichiers</Rpg3DHelpLabel>
        <small>{normalizedQuery ? getExplorerCountLabel(visibleAssetCount) : getExplorerCountLabel(assetCount)}</small>
      </div>
      <label className="arcade-map-explorer-search">
        <Search aria-hidden="true" size={14} />
        <input
          type="search"
          value={query}
          aria-label="Rechercher un fichier"
          placeholder="Rechercher un fichier"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {assetCount ? (
        visibleRoots.length ? (
          <div className="arcade-map-explorer-tree">
            {visibleRoots.map((root) => (
              <ArcadeMapAssetExplorerNode
                key={root.id}
                node={root}
                openFolders={openFolders}
                forceOpen={forceOpen}
                onToggleFolder={toggleFolder}
              />
            ))}
          </div>
        ) : (
          <p className="arcade-map-import-empty">Aucun fichier trouve.</p>
        )
      ) : (
        <p className="arcade-map-import-empty">Aucun fichier cree.</p>
      )}
    </div>
  );
}

export default ArcadeMapAssetExplorer;
