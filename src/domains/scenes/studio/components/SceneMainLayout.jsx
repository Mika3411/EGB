export default function SceneMainLayout({
  selectedScene,
  actName,
  showActBadge = true,
  title = 'Editeur de scene',
  className = '',
  headerActions = null,
  children,
}) {
  return (
    <section className={`panel main panel-main-pro ${className}`.trim()}>
      <div className={`panel-head panel-main-header ${headerActions ? 'has-header-actions' : ''}`.trim()}>
        <div>
          <span className="section-kicker">Edition</span>
          <h2>{title}</h2>
        </div>
        {headerActions ? <div className="panel-main-header-actions">{headerActions}</div> : null}
        {selectedScene && showActBadge ? <span className="status-badge soft">{actName || 'Sans acte'}</span> : null}
      </div>
      {children}
    </section>
  );
}
