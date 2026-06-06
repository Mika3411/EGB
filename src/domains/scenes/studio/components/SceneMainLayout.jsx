export default function SceneMainLayout({
  selectedScene,
  actName,
  showActBadge = true,
  title = 'Editeur de scene',
  children,
}) {
  return (
    <section className="panel main panel-main-pro">
      <div className="panel-head panel-main-header">
        <div>
          <span className="section-kicker">Edition</span>
          <h2>{title}</h2>
        </div>
        {selectedScene && showActBadge ? <span className="status-badge soft">{actName || 'Sans acte'}</span> : null}
      </div>
      {children}
    </section>
  );
}
