import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import {
  getSupportCategoryLabel,
  getSupportStatusLabel,
  loadUserSupportThreads,
  sendUserSupportMessage,
} from '../../lib/supportMessages';

const formatMessageDate = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

export default function ProfileMessagesPanel({ user }) {
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const refreshThreads = async () => {
    setIsLoading(true);
    try {
      const nextThreads = await loadUserSupportThreads(user);
      setThreads(nextThreads);
      setSelectedThreadId((currentId) => (
        currentId && nextThreads.some((thread) => thread.id === currentId)
          ? currentId
          : nextThreads[0]?.id || ''
      ));
      setStatus('');
    } catch (error) {
      setStatus(error?.message || 'Messagerie indisponible.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshThreads();
    const handleUpdate = () => refreshThreads();
    window.addEventListener('support-messages-updated', handleUpdate);
    return () => window.removeEventListener('support-messages-updated', handleUpdate);
  }, [user?.id, user?.email]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null,
    [selectedThreadId, threads],
  );

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selectedThread?.id || !replyDraft.trim()) return;
    setIsSending(true);
    try {
      const updatedThread = await sendUserSupportMessage({
        threadId: selectedThread.id,
        body: replyDraft,
      }, user);
      setThreads((currentThreads) => [
        updatedThread,
        ...currentThreads.filter((thread) => thread.id !== updatedThread.id),
      ]);
      setSelectedThreadId(updatedThread.id);
      setReplyDraft('');
      setStatus('Réponse envoyée.');
    } catch (error) {
      setStatus(error?.message || 'Réponse impossible.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="panel profile-messages-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Messagerie</span>
          <h2>Messages support</h2>
          <p className="small-note">Tes signalements, suggestions, demandes d'aide et réponses reçues.</p>
        </div>
        <button type="button" className="secondary-action" onClick={refreshThreads} disabled={isLoading}>
          {isLoading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {status ? <p className="status-badge soft" role="status">{status}</p> : null}

      {threads.length ? (
        <div className="profile-messages-layout">
          <aside className="support-thread-list" aria-label="Conversations support">
            {threads.map((thread) => {
              const lastMessage = thread.messages?.[thread.messages.length - 1];
              return (
                <button
                  type="button"
                  key={thread.id}
                  className={`support-thread-button ${selectedThread?.id === thread.id ? 'active' : ''}`}
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  <span>{getSupportCategoryLabel(thread.category)}</span>
                  <strong>{thread.subject}</strong>
                  <small>{lastMessage?.body || 'Aucun message.'}</small>
                  <em>{getSupportStatusLabel(thread.status)} · {formatMessageDate(thread.updatedAt)}</em>
                </button>
              );
            })}
          </aside>

          <article className="support-conversation">
            <div className="support-conversation-head">
              <div>
                <span className="status-badge soft">{selectedThread ? getSupportCategoryLabel(selectedThread.category) : 'Support'}</span>
                <h3>{selectedThread?.subject || 'Conversation'}</h3>
              </div>
              <span className={`support-status-pill status-${selectedThread?.status || 'open'}`}>
                {getSupportStatusLabel(selectedThread?.status)}
              </span>
            </div>

            <div className="support-message-list">
              {(selectedThread?.messages || []).map((message) => (
                <div
                  key={message.id}
                  className={`support-message-bubble ${message.authorRole === 'admin' ? 'is-admin' : 'is-user'}`}
                >
                  <div>
                    <strong>{message.authorRole === 'admin' ? 'Support' : message.authorName}</strong>
                    <span>{formatMessageDate(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>

            <form className="support-reply-form" onSubmit={submitReply}>
              <label>
                Répondre
                <textarea
                  value={replyDraft}
                  maxLength={2400}
                  placeholder="Ajoute une précision ou réponds au support."
                  onChange={(event) => setReplyDraft(event.target.value)}
                />
              </label>
              <button type="submit" className="profile-action-button" disabled={!replyDraft.trim() || isSending}>
                <Send size={16} aria-hidden="true" />
                {isSending ? 'Envoi...' : 'Envoyer'}
              </button>
            </form>
          </article>
        </div>
      ) : (
        <div className="empty-state-inline support-empty-state">
          <MessageCircle size={24} aria-hidden="true" />
          <strong>Aucun message pour le moment.</strong>
          <span>Utilise le bouton Message en bas à droite pour envoyer une demande.</span>
        </div>
      )}
    </section>
  );
}
