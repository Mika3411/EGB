import React, { useEffect, useMemo, useState } from 'react';
import { showConfirm } from '../../shared/ui/AccessibleDialog';
import { normalizeEmail } from '../../shared/services/authStorage';
import { getBlogModerationId } from '../../shared/services/moderationStorage';
import {
  buildAdminStatistics,
  getDisplayName,
  getAdminProjectCount,
  getManagedUsers,
  canUseRemoteAdminApi,
  createAdminShopPackId,
  loadAdminDashboard,
  prepareAdminShopPackScreenshots,
  prepareAdminShopPackZip,
  deleteAdminCreditAccount,
  toggleStoredLocalAccountStatus,
  updateStoredLocalAccountType,
  updateAdminCredits,
  updateAdminModeration,
  updateAdminStorageQuota,
  updateAdminUser,
} from '../../shared/services/adminApi';
import {
  ACCOUNT_FREE_STORAGE_BYTES,
  formatStorageSize,
} from '../../shared/services/storageQuota';
import {
  ACCOUNT_TYPE_PERSONAL,
  ACCOUNT_TYPE_PRO,
  getAccountType,
  getAccountTypeLabel,
} from '../../shared/services/accountPlans';
import {
  getSupportStatusLabel,
  loadAdminSupportThreads,
  replyToSupportThread,
  updateSupportThreadStatus,
} from '../../shared/services/supportMessages';
import {
  createEmptyShopPack,
  archiveSharedShopPack,
  deleteSharedShopPack,
  getShopPacks,
  loadSharedShopPacks,
  relistSharedShopPack,
  upsertSharedShopPack,
} from '../../shared/services/shopPacksStorage';
import AdminShopPanel from './AdminShopPanel.jsx';
import AdminStatisticsPanel from './AdminStatisticsPanel.jsx';
import AdminSupportPanel from './AdminSupportPanel.jsx';
import {
  MB,
  formatDate,
  formatNumber,
  getAccountStorageQuotaBytes,
  getAccountTypeActionLabel,
  getLastConnectionDate,
  getPresenceLabel,
  getProviderLabel,
  isAccountOnline,
} from './adminConsoleFormatters';

const SHOP_PACK_NUMBER_FIELDS = [
  'costCredits',
  'rating',
  'actsCount',
  'scenesCount',
  'objectsCount',
  'enigmasCount',
  'cinematicsCount',
  'combinationsCount',
];

export default function AdminConsole({
  user,
  onBack,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('members');
  const [accounts, setAccounts] = useState([]);
  const [supabaseUsers, setSupabaseUsers] = useState([]);
  const [creditUsers, setCreditUsers] = useState([]);
  const [projectCounts, setProjectCounts] = useState({});
  const [publicGames, setPublicGames] = useState([]);
  const [visitorAnalytics, setVisitorAnalytics] = useState({});
  const [shopPacks, setShopPacks] = useState(() => getShopPacks());
  const [shopPackForm, setShopPackForm] = useState(() => createEmptyShopPack());
  const [moderation, setModeration] = useState({ games: new Set(), blogs: new Set(), comments: new Set(), actions: [] });
  const [supportThreads, setSupportThreads] = useState([]);
  const [selectedSupportThreadId, setSelectedSupportThreadId] = useState('');
  const [supportReplyDraft, setSupportReplyDraft] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [creditAction, setCreditAction] = useState('add');
  const [creditAmount, setCreditAmount] = useState(20);
  const [storageQuotaMb, setStorageQuotaMb] = useState(Math.round(ACCOUNT_FREE_STORAGE_BYTES / MB));
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const refreshAdminData = async () => {
    const dashboard = await loadAdminDashboard();
    setAccounts(dashboard.accounts);
    setSupabaseUsers(dashboard.supabaseUsers);
    setCreditUsers(dashboard.creditUsers);
    setProjectCounts(dashboard.projectCounts || {});
    setPublicGames(dashboard.publicGames);
    setVisitorAnalytics(dashboard.visitorAnalytics || {});
    setModeration(dashboard.moderation);
    if (dashboard.warning) setStatus(dashboard.warning);
    loadSharedShopPacks()
      .then(setShopPacks)
      .catch(() => {});
    loadAdminSupportThreads()
      .then((threads) => {
        setSupportThreads(threads);
        setSelectedSupportThreadId((currentId) => (
          currentId && threads.some((thread) => thread.id === currentId)
            ? currentId
            : threads[0]?.id || ''
        ));
      })
      .catch((error) => {
        setStatus(error.message || 'Messagerie support indisponible.');
      });
  };

  useEffect(() => {
    let isMounted = true;
    setStatus('Chargement admin...');
    refreshAdminData()
      .then(() => {
        if (isMounted) setStatus((current) => (current === 'Chargement admin...' ? '' : current));
      })
      .catch((error) => {
        if (isMounted) setStatus(error.message || 'Chargement admin impossible.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const managedUsers = useMemo(
    () => getManagedUsers({ accounts, supabaseUsers, creditUsers, projectCounts }),
    [accounts, supabaseUsers, creditUsers, projectCounts],
  );

  const selectedUser = managedUsers.find((entry) => entry.userId === selectedUserId) || null;

  const replaceCreditUser = (nextUser) => {
    if (!nextUser?.userId) return;
    setCreditUsers((previous) => {
      const existing = previous.find((entry) => entry.userId === nextUser.userId) || {};
      const merged = { ...existing, ...nextUser };
      return [merged, ...previous.filter((entry) => entry.userId !== nextUser.userId)];
    });
  };

  const replaceSupabaseUser = (nextUser) => {
    if (!nextUser?.id) return;
    setSupabaseUsers((previous) => previous.map((entry) => (
      entry.id === nextUser.id ? { ...entry, ...nextUser } : entry
    )));
  };

  const openUserSheet = (targetUser) => {
    if (!targetUser?.userId) return;
    setSelectedUserId(targetUser.userId);
    setStorageQuotaMb(Math.round(getAccountStorageQuotaBytes(targetUser) / MB));
    setIsUserSheetOpen(true);
  };

  const closeUserSheet = () => {
    setIsUserSheetOpen(false);
  };

  useEffect(() => {
    if (!isUserSheetOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeUserSheet();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserSheetOpen]);

  useEffect(() => {
    if (isUserSheetOpen && !selectedUser) closeUserSheet();
  }, [isUserSheetOpen, selectedUser]);

  const applyCreditChange = async (event) => {
    event.preventDefault();
    if (!selectedUser?.userId) return;
    setIsBusy(true);
    setStatus('');

    try {
      const payload = await updateAdminCredits({
        userId: selectedUser.userId,
        action: creditAction,
        amount: Number(creditAmount || 0),
        reason: `admin:${user?.email || 'admin'}`,
      });

      replaceCreditUser(payload.user);
      setStatus(`Crédits mis à jour pour ${getDisplayName(selectedUser)}.`);
    } catch (error) {
      setStatus(error.message || 'Modification impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const applyStorageQuotaChange = async (event) => {
    event.preventDefault();
    if (!selectedUser?.userId) return;
    const storageQuotaBytes = Math.max(
      ACCOUNT_FREE_STORAGE_BYTES,
      Math.round(Number(storageQuotaMb || 0) * MB),
    );
    setIsBusy(true);
    setStatus('');

    try {
      const payload = await updateAdminStorageQuota({
        userId: selectedUser.userId,
        storageQuotaBytes,
        reason: `admin_storage:${user?.email || 'admin'}`,
      });
      replaceCreditUser(payload.user);
      setStorageQuotaMb(Math.round((payload.user?.storageQuotaBytes || storageQuotaBytes) / MB));
      setStatus(`Stockage média mis à jour pour ${getDisplayName(selectedUser)}.`);
    } catch (error) {
      setStatus(error.message || 'Modification du stockage impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleLocalAccountStatus = (targetUser) => {
    const result = toggleStoredLocalAccountStatus(targetUser);
    if (!result) return;
    setAccounts(result.accounts);
    setStatus(result.nextStatus === 'disabled' ? 'Compte désactivé.' : 'Compte réactivé.');
  };

  const applyAccountTypeChange = async (targetUser) => {
    if (!targetUser?.userId || targetUser.provider === 'credits') return;
    const nextAccountType = getAccountType(targetUser) === ACCOUNT_TYPE_PRO
      ? ACCOUNT_TYPE_PERSONAL
      : ACCOUNT_TYPE_PRO;
    setIsBusy(true);
    setStatus('');

    try {
      if (targetUser.provider === 'supabase') {
        const payload = await updateAdminUser({
          userId: targetUser.userId,
          action: 'set_account_type',
          accountType: nextAccountType,
        });
        replaceSupabaseUser({ ...payload.user, accountType: nextAccountType });
      } else {
        const result = updateStoredLocalAccountType(targetUser, nextAccountType);
        if (!result) throw new Error('Modification du type de compte impossible.');
        setAccounts(result.accounts);
      }

      setStatus(nextAccountType === ACCOUNT_TYPE_PRO
        ? `Compte promu en Pro pour ${getDisplayName(targetUser)}.`
        : `Compte relégué en particulier pour ${getDisplayName(targetUser)}.`);
    } catch (error) {
      setStatus(error.message || 'Modification du type de compte impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const updateSupabaseAccount = async (targetUser, action, options = {}) => {
    if (!targetUser?.userId || targetUser.provider !== 'supabase') return;
    setIsBusy(true);
    setStatus('');

    try {
      const payload = await updateAdminUser({
        userId: targetUser.userId,
        action,
        ...options,
      });

      if (payload.deletedUserId) {
        setSupabaseUsers((previous) => previous.filter((entry) => entry.id !== payload.deletedUserId));
        setCreditUsers((previous) => previous.filter((entry) => entry.userId !== payload.deletedUserId));
        setSelectedUserId('');
        setIsUserSheetOpen(false);
        setStatus('Compte Supabase supprimé.');
        return;
      }

      replaceSupabaseUser(payload.user);
      setStatus(payload.user.isDisabled ? 'Compte Supabase bloqué.' : 'Compte Supabase débloqué.');
    } catch (error) {
      setStatus(error.message || 'Modification utilisateur impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleSupabaseAccountStatus = (targetUser) => updateSupabaseAccount(
    targetUser,
    targetUser?.status === 'disabled' ? 'enable' : 'disable',
  );

  const banSupabaseAccountTemporarily = (targetUser, banDuration) =>
    updateSupabaseAccount(targetUser, 'ban_temp', { banDuration });

  const deleteSupabaseAccount = async (targetUser) => {
    if (!targetUser?.userId || targetUser.provider !== 'supabase') return;
    const label = targetUser.email || targetUser.name || targetUser.userId;
    const confirmed = await showConfirm({
      title: 'Supprimer le compte',
      message: `Supprimer définitivement le compte "${label}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    updateSupabaseAccount(targetUser, 'delete');
  };

  const deleteCreditOnlyAccount = async (targetUser) => {
    if (!targetUser?.userId || targetUser.provider !== 'credits') return;
    const label = targetUser.email || targetUser.name || targetUser.userId;
    const confirmed = await showConfirm({
      title: 'Supprimer le compte crédits',
      message: `Supprimer définitivement le compte crédits "${label}" et ses transactions ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsBusy(true);
    setStatus('');
    try {
      const payload = await deleteAdminCreditAccount({ userId: targetUser.userId });
      const deletedUserId = payload.deletedUserId || targetUser.userId;
      setCreditUsers((previous) => previous.filter((entry) => entry.userId !== deletedUserId));
      if (selectedUserId === deletedUserId) {
        setSelectedUserId('');
        setIsUserSheetOpen(false);
      }
      setStatus(`Compte crédits supprimé pour ${label}.`);
    } catch (error) {
      setStatus(error.message || 'Suppression du compte crédits impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const setModerationTarget = async ({ targetType, targetId, action, reason }) => {
    if (!targetId) return;
    setIsBusy(true);
    setStatus('');
    try {
      await updateAdminModeration({ targetType, targetId, action, reason });
      await refreshAdminData();
      setStatus(action === 'hidden' ? 'Élément masqué dans la galerie.' : 'Élément restauré dans la galerie.');
    } catch (error) {
      setStatus(error.message || 'Moderation impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const updateShopPackForm = (field, value) => {
    setShopPackForm((previous) => ({
      ...previous,
      [field]: SHOP_PACK_NUMBER_FIELDS.includes(field) ? Number(value || 0) : value,
    }));
  };

  const addShopPackScreenshots = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setIsBusy(true);
    setStatus('');
    try {
      const packId = shopPackForm.id || createAdminShopPackId();
      const screenshots = await prepareAdminShopPackScreenshots(files, {
        packId,
        userId: user?.id,
      });
      setShopPackForm((previous) => ({
        ...previous,
        id: previous.id || packId,
        screenshots: [...(previous.screenshots || []), ...screenshots],
      }));
      setStatus('Captures du pack importées.');
    } catch (error) {
      setStatus(error.message || 'Import des captures impossible.');
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const removeShopPackScreenshot = (screenshotId) => {
    setShopPackForm((previous) => ({
      ...previous,
      screenshots: (previous.screenshots || []).filter((entry) => entry.id !== screenshotId),
    }));
  };

  const importShopPackZip = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    try {
      const zipPatch = await prepareAdminShopPackZip({
        file,
        packId: shopPackForm.id,
        userId: user?.id,
      });

      setShopPackForm((previous) => ({
        ...previous,
        ...zipPatch,
      }));
      setStatus('ZIP du pack importe.');
    } catch (error) {
      setStatus(error.message || 'Import ZIP impossible.');
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const saveShopPack = async (event) => {
    event.preventDefault();
    if (!shopPackForm.title.trim()) {
      setStatus('Ajoute un nom au pack boutique.');
      return;
    }
    if (!shopPackForm.downloadUrl && !shopPackForm.downloadStoragePath && !shopPackForm.hasDownload) {
      setStatus('Ajoute un fichier ZIP téléchargeable avant de publier le pack.');
      return;
    }
    setIsBusy(true);
    try {
      const nextPacks = await upsertSharedShopPack(shopPackForm);
      setShopPacks(nextPacks);
      setShopPackForm(createEmptyShopPack());
      setStatus(canUseRemoteAdminApi() ? 'Pack boutique publie.' : 'Pack boutique enregistré localement.');
    } catch (error) {
      setStatus(error.message || 'Enregistrement du pack impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const editShopPack = (pack) => {
    setShopPackForm(pack);
    setStatus(`Edition du pack "${pack.title}".`);
  };

  const removeShopPack = async (pack) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le pack',
      message: `Supprimer le pack "${pack.title}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    setIsBusy(true);
    try {
      const nextPacks = await deleteSharedShopPack(pack.id);
      setShopPacks(nextPacks);
      if (shopPackForm.id === pack.id) setShopPackForm(createEmptyShopPack());
      setStatus('Pack boutique supprimé.');
    } catch (error) {
      setStatus(error.message || 'Suppression du pack impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const archiveShopPack = async (pack) => {
    setIsBusy(true);
    try {
      const nextPacks = await archiveSharedShopPack(pack.id, { archivedReason: 'admin' });
      setShopPacks(nextPacks);
      setStatus('Pack archive.');
    } catch (error) {
      setStatus(error.message || 'Archivage du pack impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const relistShopPack = async (pack) => {
    setIsBusy(true);
    try {
      const nextPacks = await relistSharedShopPack(pack.id);
      setShopPacks(nextPacks);
      setStatus('Pack remis en vente.');
    } catch (error) {
      setStatus(error.message || 'Remise en vente impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const blogPosts = useMemo(() => publicGames.flatMap((game) => (
    (game.authorProfile?.blogPosts || []).map((post) => ({
      ...post,
      moderationId: getBlogModerationId(game.userId, post.id),
      userId: game.userId,
      author: game.author,
      authorEmail: game.authorEmail,
    }))
  )), [publicGames]);

  const comments = useMemo(() => publicGames.flatMap((game) => (
    (game.feedback?.comments || []).map((comment) => ({
      ...comment,
      gameKey: game.key,
      gameTitle: game.title,
      author: comment.authorName || 'Joueur',
    }))
  )), [publicGames]);

  const activeShopPacks = shopPacks.filter((pack) => !pack.archived);
  const archivedShopPacks = shopPacks.filter((pack) => pack.archived);
  const selectedSupportThread = supportThreads.find((thread) => thread.id === selectedSupportThreadId) || supportThreads[0] || null;
  const openSupportThreads = supportThreads.filter((thread) => thread.status !== 'closed');
  const adminStats = useMemo(() => buildAdminStatistics({
    managedUsers,
    creditUsers,
    publicGames,
    visitorAnalytics,
    moderation,
    supportThreads,
  }), [managedUsers, creditUsers, publicGames, visitorAnalytics, moderation, supportThreads]);
  const selectedUserStorageQuotaBytes = getAccountStorageQuotaBytes(selectedUser || {});
  const selectedUserProjectCount = selectedUser ? getAdminProjectCount(selectedUser) : 0;
  const selectedUserLastConnectionAt = getLastConnectionDate(selectedUser || {});
  const selectedUserTransactions = selectedUser?.credits?.transactions || [];
  const selectedUserAccountType = getAccountType(selectedUser || {});

  const refreshSupportThreads = async () => {
    setIsBusy(true);
    try {
      const threads = await loadAdminSupportThreads();
      setSupportThreads(threads);
      setSelectedSupportThreadId((currentId) => (
        currentId && threads.some((thread) => thread.id === currentId)
          ? currentId
          : threads[0]?.id || ''
      ));
      setStatus('Messagerie actualisée.');
    } catch (error) {
      setStatus(error.message || 'Messagerie support indisponible.');
    } finally {
      setIsBusy(false);
    }
  };

  const replaceSupportThread = (thread) => {
    if (!thread?.id) return;
    setSupportThreads((currentThreads) => [
      thread,
      ...currentThreads.filter((entry) => entry.id !== thread.id),
    ]);
    setSelectedSupportThreadId(thread.id);
  };

  const submitSupportReply = async (event) => {
    event.preventDefault();
    if (!selectedSupportThread?.id || !supportReplyDraft.trim()) return;
    setIsBusy(true);
    try {
      const thread = await replyToSupportThread({
        threadId: selectedSupportThread.id,
        body: supportReplyDraft,
        status: 'answered',
      }, user);
      replaceSupportThread(thread);
      setSupportReplyDraft('');
      setStatus('Réponse support envoyée.');
    } catch (error) {
      setStatus(error.message || 'Réponse support impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const setSupportStatus = async (statusValue) => {
    if (!selectedSupportThread?.id) return;
    setIsBusy(true);
    try {
      const thread = await updateSupportThreadStatus({
        threadId: selectedSupportThread.id,
        status: statusValue,
      });
      replaceSupportThread(thread);
      setStatus(`Conversation marquée "${getSupportStatusLabel(statusValue)}".`);
    } catch (error) {
      setStatus(error.message || 'Statut support impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="layout admin-page">
      <section className="panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="eyebrow">Admin</span>
            <h2>Gestion des utilisateurs</h2>
            <p className="small-note">
              Ton compte admin est masqué ici. Cette page sert à gérer les autres comptes et leurs crédits IA.
            </p>
          </div>

          <div className="toolbar">
            {status ? <span className="status-badge soft">{status}</span> : null}
            <button type="button" className="secondary-action" onClick={refreshAdminData}>
              Actualiser
            </button>
            <button type="button" className="secondary-action" onClick={onBack}>
              Retour profil
            </button>
            <button type="button" className="secondary-action" onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </section>

      <section className="panel admin-tabs-panel" aria-label="Navigation admin">
        <div className="admin-tabs">
          {[
            ['statistics', 'Statistiques'],
            ['members', 'Membres'],
            ['gallery', 'Gallerie'],
            ['support', `Messagerie${openSupportThreads.length ? ` (${openSupportThreads.length})` : ''}`],
            ['shop', 'Boutique'],
          ].map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              className={activeTab === tabId ? 'active' : ''}
              onClick={() => setActiveTab(tabId)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'statistics' ? <AdminStatisticsPanel adminStats={adminStats} /> : null}

      {activeTab === 'members' ? (
        <>
      <section className="admin-stats-grid">
        <article className="panel admin-stat-card">
          <span>Utilisateurs gérés</span>
          <strong>{managedUsers.length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Comptes désactivés</span>
          <strong>{managedUsers.filter((entry) => entry.status === 'disabled').length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Crédits distribués</span>
          <strong>{creditUsers.reduce((sum, entry) => sum + Number(entry.balance || 0), 0)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Jeux publics tiers</span>
          <strong>{publicGames.length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Éléments masqués</span>
          <strong>{moderation.actions.length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Messages ouverts</span>
          <strong>{openSupportThreads.length}</strong>
        </article>
      </section>

      <section className="panel admin-control-grid">
        <div className="panel-head">
          <div>
            <h2>Comptes</h2>
            <p className="small-note">Ouvre la fiche d'un utilisateur pour voir ses infos, ajuster le type de compte, les crédits, le blocage et le stockage média.</p>
          </div>
        </div>

        <div className="admin-table" role="table" aria-label="Comptes gérés">
          <div className="admin-table-row admin-table-head" role="row">
            <span role="columnheader">Utilisateur</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Présence</span>
            <span role="columnheader">Dernière connexion</span>
            <span role="columnheader">Crédits</span>
            <span role="columnheader">Action</span>
          </div>
          {managedUsers.map((entry) => {
            const projectCount = getAdminProjectCount(entry);
            const lastConnectionAt = getLastConnectionDate(entry);
            const isOnline = isAccountOnline(entry);
            return (
              <div
                className={`admin-table-row admin-user-row ${entry.userId === selectedUser?.userId && isUserSheetOpen ? 'selected' : ''}`}
                role="row"
                key={entry.userId}
              >
                <span role="cell">
                  <strong>{getDisplayName(entry)}</strong>
                  <small>{getProviderLabel(entry.provider)} - {entry.email || entry.userId}</small>
                </span>
                <span role="cell">
                  <span className={`status-badge ${getAccountType(entry) === ACCOUNT_TYPE_PRO ? 'warning' : 'soft'}`}>
                    {entry.provider === 'credits' ? 'Sans profil' : getAccountTypeLabel(entry)}
                  </span>
                </span>
                <span role="cell">
                  <span className={`admin-presence-badge ${isOnline ? 'online' : 'offline'}`}>
                    {getPresenceLabel(entry)}
                  </span>
                  {entry.status === 'disabled' ? <small>Compte bloqué</small> : null}
                </span>
                <span className="admin-last-connection-cell" role="cell">
                  {lastConnectionAt ? (
                    <time dateTime={lastConnectionAt}>{formatDate(lastConnectionAt)}</time>
                  ) : (
                    <span>Jamais</span>
                  )}
                </span>
                <span role="cell">{entry.credits?.balance ?? 0}</span>
                <span className="admin-account-action-cell" role="cell">
                  {entry.provider === 'credits' ? (
                    <button
                      type="button"
                      className="danger-button admin-account-delete-button"
                      onClick={() => deleteCreditOnlyAccount(entry)}
                      disabled={isBusy}
                    >
                      Supprimer
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-action admin-account-type-button"
                      onClick={() => applyAccountTypeChange(entry)}
                      disabled={isBusy}
                    >
                      {getAccountTypeActionLabel(entry)}
                    </button>
                  )}
                  <button type="button" className="secondary-action admin-sheet-button" onClick={() => openUserSheet(entry)}>
                    Fiche
                  </button>
                  <span className="status-badge soft">
                    {projectCount} projet{projectCount > 1 ? 's' : ''}
                  </span>
                </span>
              </div>
            );
          })}
          {managedUsers.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun autre compte trouvé.</strong>
            </div>
          ) : null}
        </div>
      </section>

      {isUserSheetOpen && selectedUser ? (
        <div className="admin-account-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-account-sheet-title" onMouseDown={closeUserSheet}>
          <section className="admin-account-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-account-sheet-head">
              <div>
                <span className="eyebrow">Fiche compte</span>
                <h2 id="admin-account-sheet-title">{getDisplayName(selectedUser)}</h2>
                <p className="small-note">{selectedUser.email || selectedUser.userId}</p>
              </div>
              <div className="admin-account-sheet-head-actions">
                <span className={`status-badge ${selectedUserAccountType === ACCOUNT_TYPE_PRO ? 'warning' : 'soft'}`}>
                  {selectedUser.provider === 'credits' ? 'Sans profil' : getAccountTypeLabel(selectedUser)}
                </span>
                <span className="status-badge">{selectedUser.credits?.balance ?? 0} crédits</span>
                <button type="button" className="secondary-action" onClick={closeUserSheet}>
                  Fermer
                </button>
              </div>
            </div>

            <div className="admin-account-sheet-body">
              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Informations</h3>
                    <p className="small-note">Vue complète du compte sélectionné.</p>
                  </div>
                  <span className={`admin-presence-badge ${isAccountOnline(selectedUser) ? 'online' : 'offline'}`}>
                    {getPresenceLabel(selectedUser)}
                  </span>
                </div>

                <dl className="admin-account-info-grid">
                  <div>
                    <dt>Identifiant</dt>
                    <dd>{selectedUser.userId}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedUser.email || 'Non renseigné'}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{getProviderLabel(selectedUser.provider)}</dd>
                  </div>
                  <div>
                    <dt>Type de compte</dt>
                    <dd>{selectedUser.provider === 'credits' ? 'Sans profil utilisateur' : getAccountTypeLabel(selectedUser)}</dd>
                  </div>
                  <div>
                    <dt>Profil</dt>
                    <dd>{selectedUser.profileType || selectedUser.organization || 'Non renseigné'}</dd>
                  </div>
                  <div>
                    <dt>Création</dt>
                    <dd>{formatDate(selectedUser.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Dernière connexion</dt>
                    <dd>{formatDate(selectedUserLastConnectionAt)}</dd>
                  </div>
                  <div>
                    <dt>Mise à jour</dt>
                    <dd>{formatDate(selectedUser.updatedAt || selectedUser.credits?.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Projets</dt>
                    <dd>{selectedUserProjectCount} total · {selectedUser.publicProjects || 0} public{selectedUser.publicProjects > 1 ? 's' : ''}</dd>
                  </div>
                  <div>
                    <dt>Stockage médias</dt>
                    <dd>{formatStorageSize(selectedUserStorageQuotaBytes)}</dd>
                  </div>
                  <div>
                    <dt>Compte crédits</dt>
                    <dd>{selectedUser.credits?.createdAt ? `Créé le ${formatDate(selectedUser.credits.createdAt)}` : 'Aucun portefeuille distant'}</dd>
                  </div>
                  <div>
                    <dt>Blocage Supabase</dt>
                    <dd>{selectedUser.bannedUntil ? formatDate(selectedUser.bannedUntil) : 'Aucun blocage daté'}</dd>
                  </div>
                </dl>
              </section>

              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Type de compte</h3>
                    <p className="small-note">Bascule ce membre entre l'accès particulier et les fonctions Pro.</p>
                  </div>
                </div>

                <div className="admin-account-plan-row">
                  <span className={`status-badge ${selectedUserAccountType === ACCOUNT_TYPE_PRO ? 'warning' : 'soft'}`}>
                    {selectedUser.provider === 'credits' ? 'Sans profil utilisateur' : getAccountTypeLabel(selectedUser)}
                  </span>
                  {selectedUser.provider === 'credits' ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteCreditOnlyAccount(selectedUser)}
                      disabled={isBusy}
                    >
                      Supprimer le compte crédits
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="profile-action-button"
                      onClick={() => applyAccountTypeChange(selectedUser)}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Mise à jour...' : getAccountTypeActionLabel(selectedUser)}
                    </button>
                  )}
                </div>
                {selectedUser.provider === 'credits' ? (
                  <p className="small-note">Ce portefeuille de crédits n'est relié à aucun profil authentifié.</p>
                ) : null}
              </section>

              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Crédits IA</h3>
                    <p className="small-note">Solde actuel: {selectedUser.credits?.balance ?? 0} crédit{Number(selectedUser.credits?.balance || 0) > 1 ? 's' : ''}.</p>
                  </div>
                </div>

                <form className="admin-sheet-form" onSubmit={applyCreditChange}>
                  <label>
                    Opération
                    <select value={creditAction} onChange={(event) => setCreditAction(event.target.value)}>
                      <option value="add">Ajouter</option>
                      <option value="subtract">Retirer</option>
                      <option value="set">Fixer le solde</option>
                    </select>
                  </label>
                  <label>
                    Montant
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={creditAmount}
                      onChange={(event) => setCreditAmount(event.target.value)}
                    />
                  </label>
                  <button type="submit" className="profile-action-button" disabled={isBusy}>
                    {isBusy ? 'Mise à jour...' : 'Appliquer aux crédits'}
                  </button>
                </form>
              </section>

              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Stockage médias</h3>
                    <p className="small-note">Quota actuel: {formatStorageSize(selectedUserStorageQuotaBytes)}. Minimum gratuit: {formatStorageSize(ACCOUNT_FREE_STORAGE_BYTES)}.</p>
                  </div>
                </div>

                <form className="admin-sheet-form admin-storage-form" onSubmit={applyStorageQuotaChange}>
                  <label>
                    Quota en Mo
                    <input
                      type="number"
                      min={Math.round(ACCOUNT_FREE_STORAGE_BYTES / MB)}
                      step="1"
                      value={storageQuotaMb}
                      onChange={(event) => setStorageQuotaMb(event.target.value)}
                    />
                  </label>
                  <span className="status-badge soft">
                    {formatStorageSize(Math.max(ACCOUNT_FREE_STORAGE_BYTES, Number(storageQuotaMb || 0) * MB))}
                  </span>
                  <button type="submit" className="profile-action-button" disabled={isBusy}>
                    {isBusy ? 'Mise à jour...' : 'Modifier le stockage'}
                  </button>
                </form>
              </section>

              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Blocage du compte</h3>
                    <p className="small-note">Les comptes Supabase peuvent être bloqués temporairement ou sans limite.</p>
                  </div>
                </div>

                <div className="admin-account-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => toggleLocalAccountStatus(selectedUser)}
                    disabled={isBusy || selectedUser.provider === 'credits' || selectedUser.provider === 'supabase'}
                  >
                    {selectedUser.status === 'disabled' ? 'Réactiver le compte local' : 'Désactiver le compte local'}
                  </button>
                  {selectedUser.provider === 'supabase' ? (
                    <>
                      <div className="admin-ban-grid">
                        <button type="button" className="secondary-action" onClick={() => banSupabaseAccountTemporarily(selectedUser, '24h')} disabled={isBusy}>
                          Bloquer 24h
                        </button>
                        <button type="button" className="secondary-action" onClick={() => banSupabaseAccountTemporarily(selectedUser, '168h')} disabled={isBusy}>
                          Bloquer 7j
                        </button>
                        <button type="button" className="secondary-action" onClick={() => banSupabaseAccountTemporarily(selectedUser, '720h')} disabled={isBusy}>
                          Bloquer 30j
                        </button>
                      </div>
                      <button type="button" className="secondary-action" onClick={() => toggleSupabaseAccountStatus(selectedUser)} disabled={isBusy}>
                        {selectedUser.status === 'disabled' ? 'Débloquer le compte Supabase' : 'Bloquer sans limite'}
                      </button>
                      <button type="button" className="danger-button" onClick={() => deleteSupabaseAccount(selectedUser)} disabled={isBusy}>
                        Supprimer le membre
                      </button>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="admin-sheet-section">
                <div className="subpanel-head">
                  <div>
                    <h3>Dernières transactions</h3>
                    <p className="small-note">Historique récent du portefeuille IA.</p>
                  </div>
                </div>
                <div className="editor-stack">
                  {selectedUserTransactions.slice(0, 8).map((transaction, index) => (
                    <div className="admin-transaction-row" key={`${transaction.at}-${index}`}>
                      <span>{transaction.amount > 0 ? '+' : ''}{transaction.amount}</span>
                      <small>{transaction.reason || transaction.type} - {formatDate(transaction.at)}</small>
                    </div>
                  ))}
                  {!selectedUserTransactions.length ? (
                    <p className="small-note">Aucune transaction de crédits.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
        </>
      ) : null}

      {activeTab === 'gallery' ? (
        <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Jeux publics des autres comptes</h2>
            <p className="small-note">{publicGames.length} publication{publicGames.length > 1 ? 's' : ''} hors compte admin.</p>
          </div>
        </div>

        <div className="admin-public-list">
          {publicGames.slice(0, 10).map((game) => (
            <article className="list-card" key={game.key}>
              <div className="inline-head">
                <div>
                  <strong>{game.title}</strong>
                  <span>{game.author} - {normalizeEmail(game.authorEmail)}</span>
                </div>
                <span className="status-badge soft">
                  {moderation.games.has(game.key) ? 'Masque' : `${game.plays || 0} parties`}
                </span>
              </div>
              <p className="small-note">
                {game.category} - {game.ageRating} - {game.feedback?.votes || 0} vote{game.feedback?.votes > 1 ? 's' : ''}
              </p>
              <div className="toolbar">
                {moderation.games.has(game.key) ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setModerationTarget({ targetType: 'game', targetId: game.key, action: 'visible', reason: 'restore_game' })}
                    disabled={isBusy}
                  >
                    Restaurer
                  </button>
                ) : (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setModerationTarget({ targetType: 'game', targetId: game.key, action: 'hidden', reason: 'hide_game' })}
                    disabled={isBusy}
                  >
                    Masquer le jeu
                  </button>
                )}
              </div>
            </article>
          ))}
          {publicGames.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun jeu public tiers trouvé.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Moderation des blogs</h2>
            <p className="small-note">{blogPosts.length} articlé{blogPosts.length > 1 ? 's' : ''} trouvé{blogPosts.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="admin-public-list">
          {blogPosts.map((post) => (
            <article className="list-card" key={post.moderationId}>
              <div className="inline-head">
                <div>
                  <strong>{post.title}</strong>
                  <span>{post.author} - {normalizeEmail(post.authorEmail)}</span>
                </div>
                <span className="status-badge soft">{moderation.blogs.has(post.moderationId) ? 'Masque' : 'Visible'}</span>
              </div>
              <p className="small-note">{post.body}</p>
              <div className="toolbar">
                {moderation.blogs.has(post.moderationId) ? (
                  <button type="button" className="secondary-action" onClick={() => setModerationTarget({ targetType: 'blog', targetId: post.moderationId, action: 'visible', reason: 'restore_blog' })} disabled={isBusy}>
                    Restaurer
                  </button>
                ) : (
                  <button type="button" className="danger-button" onClick={() => setModerationTarget({ targetType: 'blog', targetId: post.moderationId, action: 'hidden', reason: 'hide_blog' })} disabled={isBusy}>
                    Masquer l'articlé
                  </button>
                )}
              </div>
            </article>
          ))}
          {blogPosts.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun articlé de blog trouvé.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Moderation des avis</h2>
            <p className="small-note">{comments.length} avis trouvé{comments.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="admin-public-list">
          {comments.map((comment) => (
            <article className="list-card" key={comment.id}>
              <div className="inline-head">
                <div>
                  <strong>{comment.author}</strong>
                  <span>{comment.gameTitle}</span>
                </div>
                <span className="status-badge soft">{moderation.comments.has(comment.id) ? 'Masque' : 'Visible'}</span>
              </div>
              <p className="small-note">{comment.text}</p>
              <div className="toolbar">
                {moderation.comments.has(comment.id) ? (
                  <button type="button" className="secondary-action" onClick={() => setModerationTarget({ targetType: 'comment', targetId: comment.id, action: 'visible', reason: 'restore_comment' })} disabled={isBusy}>
                    Restaurer
                  </button>
                ) : (
                  <button type="button" className="danger-button" onClick={() => setModerationTarget({ targetType: 'comment', targetId: comment.id, action: 'hidden', reason: 'hide_comment' })} disabled={isBusy}>
                    Masquer l'avis
                  </button>
                )}
              </div>
            </article>
          ))}
          {comments.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun avis trouvé.</strong>
            </div>
          ) : null}
        </div>
      </section>
        </>
      ) : null}

      {activeTab === 'support' ? (
        <AdminSupportPanel
          isBusy={isBusy}
          openSupportThreads={openSupportThreads}
          refreshSupportThreads={refreshSupportThreads}
          selectedSupportThread={selectedSupportThread}
          setSelectedSupportThreadId={setSelectedSupportThreadId}
          setSupportReplyDraft={setSupportReplyDraft}
          setSupportStatus={setSupportStatus}
          submitSupportReply={submitSupportReply}
          supportReplyDraft={supportReplyDraft}
          supportThreads={supportThreads}
        />
      ) : null}

      {activeTab === 'shop' ? (
        <AdminShopPanel
          activeShopPacks={activeShopPacks}
          addShopPackScreenshots={addShopPackScreenshots}
          archiveShopPack={archiveShopPack}
          archivedShopPacks={archivedShopPacks}
          editShopPack={editShopPack}
          importShopPackZip={importShopPackZip}
          isBusy={isBusy}
          relistShopPack={relistShopPack}
          removeShopPack={removeShopPack}
          removeShopPackScreenshot={removeShopPackScreenshot}
          saveShopPack={saveShopPack}
          setShopPackForm={setShopPackForm}
          status={status}
          shopPackForm={shopPackForm}
          updateShopPackForm={updateShopPackForm}
        />
      ) : null}
    </main>
  );
}
