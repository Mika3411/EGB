export default function SceneContextPanel({ title, children }) {
  return (
    <section className="panel side panel-context-pro side-editor side-editor-pro" data-tour="selected-zone-panel" style={{ margin: 0, overflow: 'auto' }}>
      <div className="panel-head panel-head-stack">
        <div>
          <span className="section-kicker">Contexte</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
