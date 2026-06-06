import React from 'react';
import {
  SUPPORT_STATUSES,
  getSupportCategoryLabel,
  getSupportStatusLabel,
} from '../../shared/services/supportMessages';
import { formatDate } from './adminConsoleFormatters';

export default function AdminSupportPanel({
  isBusy,
  openSupportThreads,
  refreshSupportThreads,
  selectedSupportThread,
  setSelectedSupportThreadId,
  setSupportReplyDraft,
  setSupportStatus,
  submitSupportReply,
  supportReplyDraft,
  supportThreads,
}) {
  return (
    <section className="panel admin-support-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Messagerie</span>
          <h2>Support utilisateurs</h2>
          <p className="small-note">{supportThreads.length} conversation{supportThreads.length > 1 ? 's' : ''}, dont {openSupportThreads.length} ouverte{openSupportThreads.length > 1 ? 's' : ''}.</p>
        </div>
        <button type="button" className="secondary-action" onClick={refreshSupportThreads} disabled={isBusy}>
          Actualiser
        </button>
      </div>

      {supportThreads.length ? (
        <div className="admin-support-layout">
          <aside className="support-thread-list admin-support-thread-list" aria-label="Messages support">
            {supportThreads.map((thread) => {
              const lastMessage = thread.messages?.[thread.messages.length - 1];
              return (
                <button
                  type="button"
                  key={thread.id}
                  className={`support-thread-button ${selectedSupportThread?.id === thread.id ? 'active' : ''}`}
                  onClick={() => setSelectedSupportThreadId(thread.id)}
                >
                  <span>{getSupportCategoryLabel(thread.category)}</span>
                  <strong>{thread.subject}</strong>
                  <small>{thread.userName} - {thread.userEmail || thread.userId}</small>
                  <em>{getSupportStatusLabel(thread.status)} - {formatDate(thread.updatedAt)}</em>
                  {lastMessage?.authorRole === 'user' && thread.status !== 'closed' ? (
                    <b>À répondre</b>
                  ) : null}
                </button>
              );
            })}
          </aside>

          <article className="support-conversation admin-support-conversation">
            <div className="support-conversation-head">
              <div>
                <span className="status-badge soft">{selectedSupportThread ? getSupportCategoryLabel(selectedSupportThread.category) : 'Support'}</span>
                <h3>{selectedSupportThread?.subject || 'Conversation'}</h3>
                <p className="small-note">
                  {selectedSupportThread?.userName || 'Utilisateur'} - {selectedSupportThread?.userEmail || selectedSupportThread?.userId || ''}
                </p>
              </div>
              <span className={`support-status-pill status-${selectedSupportThread?.status || 'open'}`}>
                {getSupportStatusLabel(selectedSupportThread?.status)}
              </span>
            </div>

            {selectedSupportThread?.pageUrl ? (
              <a className="support-context-link" href={selectedSupportThread.pageUrl} target="_blank" rel="noreferrer">
                Ouvrir la page signalée
              </a>
            ) : null}

            <div className="support-message-list">
              {(selectedSupportThread?.messages || []).map((message) => (
                <div
                  key={message.id}
                  className={`support-message-bubble ${message.authorRole === 'admin' ? 'is-admin' : 'is-user'}`}
                >
                  <div>
                    <strong>{message.authorRole === 'admin' ? 'Support' : message.authorName}</strong>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>

            <form className="support-reply-form" onSubmit={submitSupportReply}>
              <label>
                Réponse admin
                <textarea
                  value={supportReplyDraft}
                  maxLength={2400}
                  placeholder="Répondre à l'utilisateur..."
                  onChange={(event) => setSupportReplyDraft(event.target.value)}
                />
              </label>
              <div className="admin-support-actions">
                <button type="submit" className="profile-action-button" disabled={!supportReplyDraft.trim() || isBusy}>
                  Envoyer la réponse
                </button>
                <select
                  value={selectedSupportThread?.status || 'open'}
                  onChange={(event) => setSupportStatus(event.target.value)}
                  disabled={!selectedSupportThread || isBusy}
                  aria-label="Statut de la conversation"
                >
                  {SUPPORT_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </form>
          </article>
        </div>
      ) : (
        <div className="empty-state-inline">
          <strong>Aucun message support.</strong>
        </div>
      )}
    </section>
  );
}
