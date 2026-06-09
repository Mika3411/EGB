import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PROFILE_TUTORIAL_OPTIONS } from './profileUtils';
import { getAccountTypeLabel, isProfessionalAccount } from '../../../shared/services/accountPlans';
import { getUserDisplayName } from '../../../shared/utils/userDisplayName';

export default function ProfileHeader({
  user,
  authorProfile = null,
  canOpenAdmin,
  ordersCount,
  isBusy,
  isProfileTutorialActive,
  tutorialMenuRef,
  mobileSectionMenu = null,
  onOpenAdmin,
  onOpenPublicGallery,
  onOpenOrders,
  onStartTutorial,
  onLogout,
}) {
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const accountTypeLabel = getAccountTypeLabel(user);
  const isProAccount = isProfessionalAccount(user);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);

  useEffect(() => {
    if (!isActionsMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!actionsMenuRef.current?.contains(event.target)) {
        setIsActionsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick, true);
    };
  }, [isActionsMenuOpen]);

  const runProfileAction = (action) => {
    setIsActionsMenuOpen(false);
    action?.();
  };

  return (
    <section className="panel" data-tour="profile-header">
      <div className="panel-head panel-head-stack">
        <div>
          <span className="eyebrow">Profil</span>
          <h2>Salut {userDisplayName} 👋</h2>
          <p className="small-note">
            Gère tes jeux, reprends un projet Supabase existant ou importe une sauvegarde JSON.
          </p>
        </div>

        <div className="toolbar profile-header-toolbar">
          <div className="profile-status-strip">
            <span className={`status-badge ${isProAccount ? 'warning' : 'soft'}`}>{accountTypeLabel}</span>
          </div>
          <div ref={actionsMenuRef} className={`profile-header-actions-menu ${isActionsMenuOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="profile-dropdown-trigger profile-header-actions-trigger"
              aria-expanded={isActionsMenuOpen}
              aria-controls="profile-header-actions-list"
              aria-label="Actions du profil"
              onClick={() => setIsActionsMenuOpen((isOpen) => !isOpen)}
            >
              <SlidersHorizontal className="profile-dropdown-icon" aria-hidden="true" />
            </button>
            <div id="profile-header-actions-list" className="profile-header-action-list">
              {canOpenAdmin ? (
                <button type="button" className="secondary-action" onClick={() => runProfileAction(onOpenAdmin)}>
                  Admin
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onOpenPublicGallery)}
                data-tour="profile-gallery"
              >
                Galerie publique
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onOpenOrders)}
                data-tour="profile-orders"
              >
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
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        onStartTutorial?.(value);
                      }}
                      disabled={isBusy}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </details>
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onLogout)}
                data-tour="profile-logout"
              >
                Déconnexion
              </button>
            </div>
          </div>
          {mobileSectionMenu}
        </div>
      </div>
    </section>
  );
}
