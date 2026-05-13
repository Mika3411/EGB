export default function ConversationEditorModal({ onClose, onAddQuestion, children }) {
  return (
    <>
      <div className="conversation-editor-backdrop" onClick={onClose} />
      <div className="inspector-subpanel conversation-editor-modal">
        <div className="panel-head">
          <h3>Conversation</h3>
          <div className="toolbar">
            <button type="button" className="secondary-action" onClick={onAddQuestion}>+ Question</button>
            <button type="button" className="danger-button" onClick={onClose}>Fermer</button>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
