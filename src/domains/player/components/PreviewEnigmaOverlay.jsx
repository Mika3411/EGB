export default function PreviewEnigmaOverlay({
  enigma = null,
  overlayStyle,
  closeEnigma,
  children,
}) {
  if (!enigma) return null;

  return (
    <div id="enigma-overlay" className="overlay" onClick={(event) => { if (event.target === event.currentTarget) closeEnigma(); }}>
      <div className="overlay-card wide" style={overlayStyle}>
        <div className="panel-head">
          <div>
            <h2 className="enigma-overlay-title">{enigma.name}</h2>
            <p className="small-note enigma-overlay-question">{enigma.question}</p>
          </div>
          <button className="danger-button" onClick={closeEnigma}>Fermer</button>
        </div>
        {children}
      </div>
    </div>
  );
}
