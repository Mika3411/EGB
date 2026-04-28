import bannerImage from '../assets/header-banner.png';

export default function Header({
  projectTitle,
  onExportJson,
  onImportJson,
  onExportStandalone,
  user,
  onLogout,
  saveStatus,
}) {
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
            <div>
              <strong>Projet</strong>
              <small>{saveStatus || 'Sauvegarde active'}</small>
            </div>
          </div>
          <div className="toolbar project-actions">
            <button onClick={onExportJson}>Exporter JSON</button>
            <label className="button like secondary-action">
              Importer JSON
              <input type="file" accept="application/json" onChange={onImportJson} hidden />
            </label>
            <button className="ghost-action" onClick={onExportStandalone}>
              Exporter jeu
            </button>
          </div>
        </div>

        {user ? (
          <div className="user-chip user-chip-pro">
            <div>
              <strong>{user.name || user.email}</strong>
              <small>{user.email}</small>
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
