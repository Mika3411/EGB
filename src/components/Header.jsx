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
  const modeLabel = isBeginnerMode
    ? 'Mode debutant'
    : isIntermediateMode ? 'Mode intermediaire' : isAdventureMode ? 'Mode narration' : 'Mode expert';
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const userEmail = String(user?.email || '').trim();

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
          <div className="toolbar project-actions">
            <label className="button like secondary-action">
              Importer JSON
              <input type="file" accept="application/json" onChange={onImportJson} hidden />
            </label>
            <button className="ghost-action" onClick={onExportStandalone}>
              Exporter jeu
            </button>
            <button className="ghost-action" onClick={onExportAuthorSummary}>
              Fiche auteur HTML
            </button>
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
