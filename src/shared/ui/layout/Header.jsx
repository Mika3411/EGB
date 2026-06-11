import { useState } from 'react';
import bannerImage from '../../../assets/header-banner.png';
import { getUserDisplayName } from '../../utils/userDisplayName';
import { useI18n } from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';

const buildOfflineExportConfirmMessage = (estimateMessage = '', t) => {
  const lines = [
    t('header.offlineQuestion'),
    '',
  ];
  if (estimateMessage) lines.push(estimateMessage, '');
  lines.push(t('header.offlineExplanation'));
  return lines.join('\n');
};

const normalizeSaveStatus = (status = '') => String(status || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getSaveStatusBadgeTone = (status = '') => {
  const normalizedStatus = normalizeSaveStatus(status);
  if (!normalizedStatus) return 'success';
  if (
    normalizedStatus.includes('erreur')
    || normalizedStatus.includes('impossible')
    || normalizedStatus.includes('invalide')
    || normalizedStatus.includes('insuffisant')
  ) {
    return 'danger';
  }
  if (
    normalizedStatus.includes('non synchronise')
    || normalizedStatus.includes('incomplete')
    || normalizedStatus.includes('annule')
  ) {
    return 'warning';
  }
  if (normalizedStatus.includes('localement')) return 'soft';
  return 'success';
};

export default function Header({
  projectTitle,
  onImportJson,
  onExportStandalone,
  onExportAuthorSummary,
  user,
  authorProfile = null,
  onLogout,
  saveStatus,
  projectMode = 'expert',
  confirmStandaloneOfflineExport = async () => false,
  offlineExportEstimateMessage = '',
  getOfflineExportEstimateMessage = null,
  onLanguageChange,
}) {
  const { t } = useI18n();
  const isBeginnerMode = projectMode === 'beginner';
  const isIntermediateMode = projectMode === 'intermediate';
  const isAdventureMode = projectMode === 'adventure';
  const [standaloneExportMessage, setStandaloneExportMessage] = useState('');
  const [standaloneExportWarning, setStandaloneExportWarning] = useState('');
  const modeLabel = isBeginnerMode
    ? t('header.modeBeginner')
    : isIntermediateMode ? t('header.modeIntermediate') : isAdventureMode ? t('header.modeAdventure') : t('header.modeExpert');
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const userEmail = String(user?.email || '').trim();
  const saveStatusText = saveStatus || t('header.saved');
  const saveStatusTone = getSaveStatusBadgeTone(saveStatusText);
  const saveStatusClassName = [
    'status-badge',
    saveStatusTone === 'success' ? '' : saveStatusTone,
  ].filter(Boolean).join(' ');
  const handleStandaloneExport = async () => {
    setStandaloneExportMessage('');
    setStandaloneExportWarning('');
    const nextOfflineExportEstimateMessage = typeof getOfflineExportEstimateMessage === 'function'
      ? await getOfflineExportEstimateMessage()
      : offlineExportEstimateMessage;

    const includeOfflineAssets = await confirmStandaloneOfflineExport({
      title: t('header.exportDialogTitle'),
      message: buildOfflineExportConfirmMessage(nextOfflineExportEstimateMessage, t),
      confirmLabel: t('header.exportDialogConfirm'),
      cancelLabel: t('header.exportDialogCancel'),
      cancelValue: false,
      dismissLabel: t('header.exportDialogDismiss'),
      dismissValue: null,
    });
    if (includeOfflineAssets === null) return;
    const result = includeOfflineAssets
      ? await onExportStandalone?.({ exportOfflineAssets: true })
      : await onExportStandalone?.();
    const summary = result?.offlineAssetsSummary || null;
    const onlineCount = Number(summary?.onlineCount || 0);

    if (result?.offlineAssetsMessage) {
      setStandaloneExportMessage(result.offlineAssetsMessage);
    }
    if (includeOfflineAssets && onlineCount > 0) {
      const mediaLabel = onlineCount > 1 ? t('header.mediaPlural') : t('header.mediaSingular');
      const continuation = onlineCount > 1
        ? t('header.mediaPluralContinuation')
        : t('header.mediaSingularContinuation');
      setStandaloneExportWarning(t('header.onlineMediaWarning', { count: onlineCount, mediaLabel, continuation }));
    }
  };

  return (
    <header className="topbar topbar-pro">
      <div className="brand-block brand-block-banner">
        <div className="brand-banner-wrap">
          <img
            src={bannerImage}
            alt="Escape Game Studio"
            className="brand-banner"
          />
        </div>
      </div>

      <div className="project-actions-card">
        <div className="project-actions-head">
          <span className={`mode-badge ${projectMode}`}>
            {modeLabel}
          </span>
        </div>
        {!isBeginnerMode && !isIntermediateMode ? (
          <div className="project-actions-body">
            <div className="toolbar project-actions">
              <label className="button like secondary-action">
                {t('header.importJson')}
                <input type="file" accept="application/json" onChange={onImportJson} hidden />
              </label>
              <button className="ghost-action" onClick={handleStandaloneExport}>
                {t('header.exportGame')}
              </button>
              <button className="ghost-action" onClick={onExportAuthorSummary}>
                {t('header.authorSummary')}
              </button>
            </div>
            {standaloneExportMessage || standaloneExportWarning ? (
              <div className="standalone-export-feedback">
                {standaloneExportMessage ? (
                  <p className="standalone-export-status" role="status">
                    {standaloneExportMessage}
                  </p>
                ) : null}
                {standaloneExportWarning ? (
                  <p className="standalone-export-warning" role="alert">
                    {standaloneExportWarning}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {user ? (
        <div className="user-chip user-chip-pro">
          <div className="user-chip-identity">
            <small>{t('header.user')}</small>
            <strong>{userDisplayName}</strong>
            {userEmail && userEmail !== userDisplayName ? <small>{userEmail}</small> : null}
          </div>
          <div className="user-chip-actions">
            <span className={saveStatusClassName} title={saveStatusText}>{saveStatusText}</span>
            <LanguageSwitcher compact onLanguageChange={onLanguageChange} />
            <button type="button" className="danger-button" onClick={onLogout}>
              {t('common.logout')}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
