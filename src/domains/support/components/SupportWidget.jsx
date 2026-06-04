import React, { useMemo, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import {
  SUPPORT_CATEGORIES,
  createSupportTicket,
  getSupportUserName,
} from '../../../shared/services/supportMessages';

const initialDraft = {
  category: 'problem',
  subject: '',
  body: '',
};

const isPlayerSurface = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search || '');
  return Boolean(params.get('playUser') && params.get('playProject'));
};

export default function SupportWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userName = useMemo(() => getSupportUserName(user), [user]);

  if (!user || isPlayerSurface()) return null;

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submitSupportTicket = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('');
    try {
      await createSupportTicket({
        ...draft,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        context: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }, user);
      setDraft(initialDraft);
      setStatus('Message envoyé. Tu recevras la réponse dans Profil > Messagerie.');
    } catch (error) {
      setStatus(error?.message || 'Envoi impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="support-widget">
      {isOpen ? (
        <section className="support-panel" role="dialog" aria-modal="false" aria-label="Contacter le support">
          <div className="support-panel-head">
            <div>
              <span className="eyebrow">Message</span>
              <h2>Contacter le support</h2>
            </div>
            <button type="button" className="support-icon-button" onClick={() => setIsOpen(false)} aria-label="Fermer le support">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form className="support-form" onSubmit={submitSupportTicket}>
            <label>
              Catégorie
              <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)}>
                {SUPPORT_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              Sujet
              <input
                value={draft.subject}
                maxLength={140}
                placeholder="Ex: Inventaire, export, combat..."
                onChange={(event) => updateDraft('subject', event.target.value)}
              />
            </label>

            <label>
              Message
              <textarea
                value={draft.body}
                maxLength={2400}
                placeholder={`Bonjour ${userName}, explique ce que tu veux signaler.`}
                onChange={(event) => updateDraft('body', event.target.value)}
              />
            </label>

            {status ? <p className="support-status" role="status">{status}</p> : null}

            <div className="support-actions">
              <button type="button" className="secondary-action" onClick={() => setIsOpen(false)}>
                Masquer
              </button>
              <button type="submit" className="profile-action-button" disabled={isSubmitting}>
                <Send size={16} aria-hidden="true" />
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button type="button" className="support-launcher" onClick={() => setIsOpen(true)}>
          <MessageCircle size={18} aria-hidden="true" />
          Message
        </button>
      )}
    </div>
  );
}
