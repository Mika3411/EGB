import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { isProfessionalAccount } from '../../../shared/services/accountPlans';
import { getUserDisplayName } from '../../../shared/utils/userDisplayName';
import { useI18n } from '../../../shared/i18n';
import LanguageSwitcher from '../../../shared/ui/LanguageSwitcher';

export default function ProfileHeader({
  user,
  authorProfile = null,
  canOpenAdmin,
  ordersCount,
  mobileSectionMenu = null,
  onOpenAdmin,
  onOpenPublicGallery,
  onOpenOrders,
  onLogout,
  onLanguageChange,
}) {
  const { t } = useI18n();
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const isProAccount = isProfessionalAccount(user);
  const accountTypeLabel = isProAccount ? t('profile.header.accountPro') : t('profile.header.accountPersonal');
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
          <span className="eyebrow">{t('profile.header.eyebrow')}</span>
          <h2>{t('profile.header.greeting', { name: userDisplayName })}</h2>
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
              aria-label={t('profile.header.actions')}
              onClick={() => setIsActionsMenuOpen((isOpen) => !isOpen)}
            >
              <SlidersHorizontal className="profile-dropdown-icon" aria-hidden="true" />
            </button>
            <div id="profile-header-actions-list" className="profile-header-action-list">
              {canOpenAdmin ? (
                <button type="button" className="secondary-action" onClick={() => runProfileAction(onOpenAdmin)}>
                  {t('common.admin')}
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onOpenPublicGallery)}
                data-tour="profile-gallery"
              >
                {t('common.publicGallery')}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onOpenOrders)}
                data-tour="profile-orders"
              >
                {t('profile.header.orders', { count: ordersCount ? ` (${ordersCount})` : '' })}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => runProfileAction(onLogout)}
                data-tour="profile-logout"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
          <LanguageSwitcher compact onLanguageChange={onLanguageChange} />
          {mobileSectionMenu}
        </div>
      </div>
    </section>
  );
}
