import { useState } from 'react';
import bannerImage from '../assets/header-banner.png';
import { getUserDisplayName } from '../utils/userDisplayName';

export default function Header({
  projectTitle,
  onImportJson,
  onExportStandalone,
  onExportAuthorSummary,
  user,
  authorProfile = null,
  onLogout,
  saveStatus,
  projectMode = 'expert',
}) {
  const isBeginnerMode = projectMode === 'beginner';
  const isIntermediateMode = projectMode === 'intermediate';
  const isAdventureMode = projectMode === 'adventure';
  const [exportOfflineAssets, setExportOfflineAssets] = useState(false);
  const [standaloneExportMessage, setStandaloneExportMessage] = useState('');
  const [standaloneExportWarning, setStandaloneExportWarning] = useState('');
  const modeLabel = isBeginnerMode
    ? 'Mode debutant'
    : isIntermediateMode ? 'Mode intermediaire' : isAdventureMode ? 'Mode narration' : 'Mode expert';
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const userEmail = String(user?.email || '').trim();
  const handleStandaloneExport = async () => {
    setStandaloneExportMessage('');
    setStandaloneExportWarning('');

    const result = exportOfflineAssets
      ? await onExportStandalone?.({ exportOfflineAssets: true })
      : await onExportStandalone?.();
    const summary = result?.offlineAssetsSummary || null;
    const onlineCount = Number(summary?.onlineCount || 0);

    if (result?.offlineAssetsMessage) {
      setStandaloneExportMessage(result.offlineAssetsMessage);
    }
    if (exportOfflineAssets && onlineCount > 0) {
      const mediaLabel = onlineCount > 1 ? 'médias restent' : 'média reste';
      const continuation = onlineCount > 1
        ? 'Ils seront chargés par URL si une connexion est disponible.'
        : 'Il sera chargé par URL si une connexion est disponible.';
      setStandaloneExportWarning(`${onlineCount} ${mediaLabel} en ligne. ${continuation}`);
    }
  };

  return (
    <header className="topbar topbar-pro">
      <div className="brand-block brand-block-banner">
        <div className="brand-banner-wrap">
          <img
            src={bannerImage}
            alt="Escape Game Studio"
            className="brand-banner"
          />
        </div>
      </div>

      <div className="project-actions-card">
        <div className="project-actions-head">
          <span className={`mode-badge ${projectMode}`}>
            {modeLabel}
          </span>
        </div>
        {!isBeginnerMode && !isIntermediateMode ? (
          <div className="project-actions-body">
            <div className="toolbar project-actions">
              <label className="button like secondary-action">
                Importer JSON
                <input type="file" accept="application/json" onChange={onImportJson} hidden />
              </label>
              <button className="ghost-action" onClick={handleStandaloneExport}>
                Exporter jeu
              </button>
              <button className="ghost-action" onClick={onExportAuthorSummary}>
                Fiche auteur HTML
              </button>
            </div>
            <div className="standalone-export-options">
              <label className="standalone-export-checkbox">
                <input
                  type="checkbox"
                  checked={exportOfflineAssets}
                  onChange={(event) => setExportOfflineAssets(event.target.checked)}
                />
                <span>Inclure les médias dans le fichier pour jouer hors ligne</span>
              </label>
              <p className="small-note standalone-export-help">
                Le fichier sera plus lourd, mais les images et sons intégrés resteront jouables sans connexion quand c’est possible.
              </p>
              {standaloneExportMessage ? (
                <p className="standalone-export-status" role="status">
                  {standaloneExportMessage}
                </p>
              ) : null}
              {standaloneExportWarning ? (
                <p className="standalone-export-warning" role="alert">
                  {standaloneExportWarning}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {user ? (
        <div className="user-chip user-chip-pro">
          <div>
            <small>Utilisateur</small>
            <strong>{userDisplayName}</strong>
            {userEmail && userEmail !== userDisplayName ? <small>{userEmail}</small> : null}
          </div>
          <div className="user-chip-actions">
            <span className="status-badge">{saveStatus || 'Sauvegardé'}</span>
            <button type="button" className="danger-button" onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
