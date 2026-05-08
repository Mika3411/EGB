import React from 'react';
import { PROFILE_TUTORIAL_OPTIONS } from './profileUtils';

export default function ProfileHeader({
  user,
  canOpenAdmin,
  statusMessage,
  ordersCount,
  isBusy,
  isProfileTutorialActive,
  tutorialMenuRef,
  onOpenAdmin,
  onOpenPublicGallery,
  onOpenOrders,
  onStartTutorial,
  onLogout,
}) {
  return (
    <section className="panel" data-tour="profile-header">
      <div className="panel-head panel-head-stack">
        <div>
          <span className="eyebrow">Profil</span>
          <h2>Salut {user?.name || user?.email || 'créateur'} 👋</h2>
          <p className="small-note">
            Gère tes jeux, reprends un projet Supabase existant ou importe une sauvegarde JSON.
          </p>
        </div>

        <div className="toolbar">
          <span className="status-badge soft" data-tour="profile-status">{statusMessage || 'Profil prêt'}</span>
          {canOpenAdmin ? (
            <button type="button" className="secondary-action" onClick={onOpenAdmin}>
              Admin
            </button>
          ) : null}
          <button type="button" className="secondary-action" onClick={onOpenPublicGallery} data-tour="profile-gallery">
            Galerie publique
          </button>
          <button type="button" className="secondary-action" onClick={onOpenOrders}>
            Commandes{ordersCount ? ` (${ordersCount})` : ''}
          </button>
          <details
            ref={tutorialMenuRef}
            className="profile-tutorial-menu"
            data-tour="profile-tutorial-menu"
            onClickCapture={(event) => {
              if (!isProfileTutorialActive) return;
              event.preventDefault();
              tutorialMenuRef.current.open = false;
            }}
            onToggle={() => {
              if (isProfileTutorialActive && tutorialMenuRef.current) {
                tutorialMenuRef.current.open = false;
              }
            }}
          >
            <summary className="profile-action-button profile-tutorial-button">Didacticiel</summary>
            <div className="profile-tutorial-popover">
              {PROFILE_TUTORIAL_OPTIONS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => onStartTutorial?.(value)} disabled={isBusy}>
                  {label}
                </button>
              ))}
            </div>
          </details>
          <button type="button" className="secondary-action" onClick={onLogout} data-tour="profile-logout">
            Déconnexion
          </button>
        </div>
      </div>
    </section>
  );
}
