export default function SceneMainLayout({ selectedScene, actName, children }) {
  return (
    <section className="panel main panel-main-pro">
      <div className="panel-head panel-main-header">
        <div>
          <span className="section-kicker">Edition</span>
          <h2>Editeur de scene</h2>
        </div>
        {selectedScene ? <span className="status-badge soft">{actName || 'Sans acte'}</span> : null}
      </div>
      {children}
    </section>
  );
}
