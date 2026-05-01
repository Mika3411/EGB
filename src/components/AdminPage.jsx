import React, { useEffect, useMemo, useState } from 'react';
import { getAllAccounts, normalizeEmail, updateStoredAccount } from '../lib/authStorage';
import { getPublicGames } from '../lib/publicGalleryStorage';
import { getBlogModerationId, getModerationState, updateModerationAction } from '../lib/moderationStorage';
import {
  createEmptyShopPack,
  archiveSharedShopPack,
  deleteSharedShopPack,
  getShopPacks,
  loadSharedShopPacks,
  relistSharedShopPack,
  upsertSharedShopPack,
} from '../lib/shopPacksStorage';
import { fileToDataURL, uploadFileToSupabase } from '../utils/fileHelpers';
import { getSupabaseClient, hasSupabaseConfig } from '../supabaseStorage';

const ADMIN_EMAIL = 'thorez.m@hotmail.fr';
const AI_CREDITS_ADMIN_ENDPOINT = import.meta.env.VITE_AI_CREDITS_ADMIN_ENDPOINT || '/api/ai-credits/admin';
const ADMIN_USERS_ENDPOINT = import.meta.env.VITE_ADMIN_USERS_ENDPOINT || '/api/admin/users';
const LOCAL_PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const formatDate = (value) => {
  if (!value) return 'Jamais';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Date inconnue';
  }
};

const readLocalProjects = (userId) => {
  if (!userId || typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(`${LOCAL_PROJECTS_KEY_PREFIX}.${userId}`), []);
};

const getDisplayName = (account) =>
  account?.name || account?.email || account?.userId || 'Utilisateur';

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

const createShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function AdminPage({
  user,
  onBack,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('members');
  const [accounts, setAccounts] = useState([]);
  const [supabaseUsers, setSupabaseUsers] = useState([]);
  const [creditUsers, setCreditUsers] = useState([]);
  const [publicGames, setPublicGames] = useState([]);
  const [shopPacks, setShopPacks] = useState(() => getShopPacks());
  const [shopPackForm, setShopPackForm] = useState(() => createEmptyShopPack());
  const [moderation, setModeration] = useState({ games: new Set(), blogs: new Set(), comments: new Set(), actions: [] });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creditAction, setCreditAction] = useState('add');
  const [creditAmount, setCreditAmount] = useState(20);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const getAdminAuthHeaders = async () => {
    if (!hasSupabaseConfig()) return {};
    const { data } = await getSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const refreshAdminData = async () => {
    const localAccounts = getAllAccounts()
      .filter((account) => normalizeEmail(account.email) !== ADMIN_EMAIL);
    setAccounts(localAccounts);
    const authHeaders = await getAdminAuthHeaders();

    const [usersPayload, creditsPayload, games, moderationState] = await Promise.all([
      hasSupabaseConfig()
        ? fetch(ADMIN_USERS_ENDPOINT, { headers: authHeaders }).then((response) => {
          if (!response.ok) throw new Error(`Utilisateurs Supabase indisponibles (${response.status}).`);
          return response.json();
        })
        : Promise.resolve({ users: [] }),
      fetch(AI_CREDITS_ADMIN_ENDPOINT, { headers: authHeaders }).then((response) => {
        if (!response.ok) throw new Error(`Credits indisponibles (${response.status}).`);
        return response.json();
      }),
      getPublicGames({ includeModerated: true }).catch(() => []),
      getModerationState(),
    ]);

    setSupabaseUsers(Array.isArray(usersPayload.users) ? usersPayload.users : []);
    setCreditUsers(Array.isArray(creditsPayload.users) ? creditsPayload.users : []);
    setPublicGames(games.filter((game) => normalizeEmail(game.authorEmail) !== ADMIN_EMAIL));
    setModeration(moderationState);
    loadSharedShopPacks()
      .then(setShopPacks)
      .catch(() => {});
  };

  useEffect(() => {
    let isMounted = true;
    setStatus('Chargement admin...');
    refreshAdminData()
      .then(() => {
        if (isMounted) setStatus('');
      })
      .catch((error) => {
        if (isMounted) setStatus(error.message || 'Chargement admin impossible.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const managedUsers = useMemo(() => {
    const byId = new Map();

    accounts.forEach((account) => {
      const projects = readLocalProjects(account.id);
      byId.set(account.id, {
        userId: account.id,
        name: account.name,
        email: account.email,
        provider: account.provider || 'local',
        status: account.status || 'active',
        createdAt: account.createdAt,
        projects,
        publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
      });
    });

    supabaseUsers.forEach((account) => {
      const projects = readLocalProjects(account.id);
      byId.set(account.id, {
        userId: account.id,
        name: account.name,
        email: account.email,
        provider: 'supabase',
        status: account.isDisabled ? 'disabled' : 'active',
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastSignInAt: account.lastSignInAt,
        projects,
        publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
      });
    });

    creditUsers.forEach((creditAccount) => {
      if (normalizeEmail(creditAccount.userId) === ADMIN_EMAIL) return;
      const existing = byId.get(creditAccount.userId) || {
        userId: creditAccount.userId,
        name: '',
        email: '',
        provider: 'credits',
        status: 'active',
        createdAt: creditAccount.createdAt,
        projects: [],
        publicProjects: 0,
      };
      byId.set(creditAccount.userId, {
        ...existing,
        credits: creditAccount,
      });
    });

    return Array.from(byId.values())
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr'));
  }, [accounts, supabaseUsers, creditUsers]);

  const selectedUser = managedUsers.find((entry) => entry.userId === selectedUserId) || managedUsers[0] || null;

  useEffect(() => {
    if (!selectedUserId && managedUsers[0]?.userId) setSelectedUserId(managedUsers[0].userId);
  }, [managedUsers, selectedUserId]);

  const applyCreditChange = async (event) => {
    event.preventDefault();
    if (!selectedUser?.userId) return;
    setIsBusy(true);
    setStatus('');

    try {
      const response = await fetch(AI_CREDITS_ADMIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAdminAuthHeaders()),
        },
        body: JSON.stringify({
          userId: selectedUser.userId,
          action: creditAction,
          amount: Number(creditAmount || 0),
          reason: `admin:${user?.email || 'admin'}`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Modification impossible.');

      setCreditUsers((previous) => {
        const withoutUser = previous.filter((entry) => entry.userId !== payload.user.userId);
        return [payload.user, ...withoutUser];
      });
      setStatus(`Credits mis a jour pour ${getDisplayName(selectedUser)}.`);
    } catch (error) {
      setStatus(error.message || 'Modification impossible.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleLocalAccountStatus = (targetUser) => {
    if (!targetUser?.userId || targetUser.provider === 'credits' || targetUser.provider === 'supabase') return;
    const nextStatus = targetUser.status === 'disabled' ? 'active' : 'disabled';
    updateStoredAccount(targetUser.userId, { status: nextStatus });
    setAccounts(getAllAccounts().filter((account) => normalizeEmail(account.email) !== ADMIN_EMAIL));
    setStatus(nextStatus === 'disabled' ? 'Compte desactive.' : 'Compte reactive.');
  };

  const updateSupabaseAccount = async (targetUser, action, options = {}) => {
    if (!targetUser?.userId || targetUser.provider !== 'supabase') return;
    setIsBusy(true);
    setStatus('');

    try {
      const response = await fetch(ADMIN_USERS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAdminAuthHeaders()),
        },
        body: JSON.stringify({
          userId: targetUser.userId,
          action,
          ...options,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Modification utilisateur impossible.');

      if (payload.deletedUserId) {
        setSupabaseUsers((previous) => previous.filter((entry) => entry.id !== payload.deletedUserId));
        setCreditUsers((previous) => previous.filter((entry) => entry.userId !== payload.deletedUserId));
        setSelectedUserId('');
        setStatus('Compte Supabase supprime.');
        return;
      }

      setSupabaseUsers((previous) => previous.map((entry) => (
        entry.id === payload.user.id ? payload.user : entry
      )));
      setStatus(payload.user.isDisabled ? 'Compte Supabase bloque.' : 'Compte Supabase debloque.');
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

  const deleteSupabaseAccount = (targetUser) => {
    if (!targetUser?.userId || targetUser.provider !== 'supabase') return;
    const label = targetUser.email || targetUser.name || targetUser.userId;
    const confirmed = window.confirm(`Supprimer definitivement le compte "${label}" ? Cette action est irreversible.`);
    if (!confirmed) return;
    updateSupabaseAccount(targetUser, 'delete');
  };

  const setModerationTarget = async ({ targetType, targetId, action, reason }) => {
    if (!targetId) return;
    setIsBusy(true);
    setStatus('');
    try {
      await updateModerationAction({
        targetType,
        targetId,
        action,
        reason,
        authHeaders: await getAdminAuthHeaders(),
      });
      await refreshAdminData();
      setStatus(action === 'hidden' ? 'Element masque dans la galerie.' : 'Element restaure dans la galerie.');
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
    const screenshots = await Promise.all(files.map(async (file) => ({
      id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      src: await fileToDataURL(file),
    })));
    setShopPackForm((previous) => ({
      ...previous,
      screenshots: [...(previous.screenshots || []), ...screenshots],
    }));
    event.target.value = '';
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
    if (!/\.zip$/i.test(file.name)) {
      setStatus('Importe un fichier ZIP pour le pack.');
      event.target.value = '';
      return;
    }

    setIsBusy(true);
    try {
      const packId = shopPackForm.id || createShopPackId();
      const patch = hasSupabaseConfig() ?
        await uploadFileToSupabase(file, {
          userId: user?.id,
          folder: `shop-packs-${packId}`,
          optimizeImage: false,
          cacheControl: '0',
        }).then((result) => ({
          downloadUrl: result.publicUrl,
          downloadStoragePath: result.path,
          downloadMode: 'supabase',
        }))
        : {
          downloadUrl: await fileToDataURL(file),
          downloadStoragePath: '',
          downloadMode: 'local',
        };

      setShopPackForm((previous) => ({
        ...previous,
        id: packId,
        downloadFileName: file.name,
        ...patch,
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
    setIsBusy(true);
    try {
      const nextPacks = await upsertSharedShopPack(shopPackForm);
      setShopPacks(nextPacks);
      setShopPackForm(createEmptyShopPack());
      setStatus(hasSupabaseConfig() ? 'Pack boutique publie.' : 'Pack boutique enregistre localement.');
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
    if (!window.confirm(`Supprimer le pack "${pack.title}" ?`)) return;
    setIsBusy(true);
    try {
      const nextPacks = await deleteSharedShopPack(pack.id);
      setShopPacks(nextPacks);
      if (shopPackForm.id === pack.id) setShopPackForm(createEmptyShopPack());
      setStatus('Pack boutique supprime.');
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

  return (
    <main className="layout admin-page">
      <section className="panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="eyebrow">Admin</span>
            <h2>Gestion des utilisateurs</h2>
            <p className="small-note">
              Ton compte admin est masque ici. Cette page sert a gerer les autres comptes et leurs credits IA.
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
              Deconnexion
            </button>
          </div>
        </div>
      </section>

      <section className="panel admin-tabs-panel" aria-label="Navigation admin">
        <div className="admin-tabs">
          {[
            ['members', 'Membres'],
            ['gallery', 'Gallerie'],
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

      {activeTab === 'members' ? (
        <>
      <section className="admin-stats-grid">
        <article className="panel admin-stat-card">
          <span>Utilisateurs geres</span>
          <strong>{managedUsers.length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Comptes desactives</span>
          <strong>{managedUsers.filter((entry) => entry.status === 'disabled').length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Credits distribues</span>
          <strong>{creditUsers.reduce((sum, entry) => sum + Number(entry.balance || 0), 0)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Jeux publics tiers</span>
          <strong>{publicGames.length}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Elements masques</span>
          <strong>{moderation.actions.length}</strong>
        </article>
      </section>

      <section className="panel admin-control-grid">
        <div>
          <div className="panel-head">
            <div>
              <h2>Comptes</h2>
              <p className="small-note">Selectionne un utilisateur pour ajuster ses credits.</p>
            </div>
          </div>

          <div className="admin-table" role="table" aria-label="Comptes geres">
            <div className="admin-table-row admin-table-head" role="row">
              <span role="columnheader">Utilisateur</span>
              <span role="columnheader">Statut</span>
              <span role="columnheader">Credits</span>
              <span role="columnheader">Action</span>
            </div>
            {managedUsers.map((entry) => (
              <button
                type="button"
                className={`admin-table-row admin-user-row ${entry.userId === selectedUser?.userId ? 'selected' : ''}`}
                role="row"
                key={entry.userId}
                onClick={() => setSelectedUserId(entry.userId)}
              >
                <span role="cell">
                  <strong>{getDisplayName(entry)}</strong>
                  <small>{entry.provider} - {entry.email || entry.userId}</small>
                </span>
                <span role="cell">{entry.status === 'disabled' ? 'Desactive' : 'Actif'}</span>
                <span role="cell">{entry.credits?.balance ?? 0}</span>
                <span role="cell">
                  <span className="status-badge soft">{entry.projects.length} projet{entry.projects.length > 1 ? 's' : ''}</span>
                </span>
              </button>
            ))}
            {managedUsers.length === 0 ? (
              <div className="empty-state-inline">
                <strong>Aucun autre compte trouve.</strong>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="subpanel admin-credit-editor">
          <div className="subpanel-head">
            <div>
              <h3>{selectedUser ? getDisplayName(selectedUser) : 'Aucun utilisateur'}</h3>
              <p className="small-note">{selectedUser?.email || selectedUser?.userId || ''}</p>
            </div>
            <span className="status-badge">{selectedUser?.credits?.balance ?? 0} credits</span>
          </div>

          <form onSubmit={applyCreditChange}>
            <label>Operation</label>
            <select value={creditAction} onChange={(event) => setCreditAction(event.target.value)}>
              <option value="add">Ajouter</option>
              <option value="subtract">Retirer</option>
              <option value="set">Fixer le solde</option>
            </select>

            <label>Montant</label>
            <input
              type="number"
              min="0"
              step="1"
              value={creditAmount}
              onChange={(event) => setCreditAmount(event.target.value)}
            />

            <button type="submit" className="profile-action-button" disabled={!selectedUser || isBusy}>
              {isBusy ? 'Mise a jour...' : 'Appliquer aux credits'}
            </button>
          </form>

          <div className="admin-account-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => toggleLocalAccountStatus(selectedUser)}
              disabled={!selectedUser || selectedUser.provider === 'credits' || selectedUser.provider === 'supabase'}
            >
              {selectedUser?.status === 'disabled' ? 'Reactiver le compte local' : 'Desactiver le compte local'}
            </button>
            {selectedUser?.provider === 'supabase' ? (
              <>
                <div className="admin-ban-grid">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => banSupabaseAccountTemporarily(selectedUser, '24h')}
                    disabled={isBusy}
                  >
                    Bloquer 24h
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => banSupabaseAccountTemporarily(selectedUser, '168h')}
                    disabled={isBusy}
                  >
                    Bloquer 7j
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => banSupabaseAccountTemporarily(selectedUser, '720h')}
                    disabled={isBusy}
                  >
                    Bloquer 30j
                  </button>
                </div>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => toggleSupabaseAccountStatus(selectedUser)}
                  disabled={isBusy}
                >
                  {selectedUser.status === 'disabled' ? 'Debloquer le compte Supabase' : 'Bloquer sans limite'}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => deleteSupabaseAccount(selectedUser)}
                  disabled={isBusy}
                >
                  Supprimer le membre
                </button>
              </>
            ) : null}
          </div>

          <div className="editor-stack">
            <strong>Dernieres transactions</strong>
            {(selectedUser?.credits?.transactions || []).slice(0, 5).map((transaction, index) => (
              <div className="admin-transaction-row" key={`${transaction.at}-${index}`}>
                <span>{transaction.amount > 0 ? '+' : ''}{transaction.amount}</span>
                <small>{transaction.reason || transaction.type} - {formatDate(transaction.at)}</small>
              </div>
            ))}
            {!selectedUser?.credits?.transactions?.length ? (
              <p className="small-note">Aucune transaction de credits.</p>
            ) : null}
          </div>
        </aside>
      </section>
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
              <strong>Aucun jeu public tiers trouve.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Moderation des blogs</h2>
            <p className="small-note">{blogPosts.length} article{blogPosts.length > 1 ? 's' : ''} trouve{blogPosts.length > 1 ? 's' : ''}</p>
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
                    Masquer l'article
                  </button>
                )}
              </div>
            </article>
          ))}
          {blogPosts.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun article de blog trouve.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Moderation des avis</h2>
            <p className="small-note">{comments.length} avis trouve{comments.length > 1 ? 's' : ''}</p>
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
              <strong>Aucun avis trouve.</strong>
            </div>
          ) : null}
        </div>
      </section>
        </>
      ) : null}

      {activeTab === 'shop' ? (
        <section className="panel admin-shop-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Boutique</span>
              <h2>Packs de jeux</h2>
              <p className="small-note">Cree des fiches produit avec cout en credits, contenu du pack et screenshots.</p>
            </div>
            <button type="button" className="secondary-action" onClick={() => setShopPackForm(createEmptyShopPack())}>
              Nouveau pack
            </button>
          </div>

          <div className="admin-shop-grid">
            <form className="subpanel admin-shop-form" onSubmit={saveShopPack}>
              <div className="subpanel-head">
                <div>
                  <h3>{shopPackForm.id ? 'Modifier le pack' : 'Ajouter un pack'}</h3>
                  <p className="small-note">Les champs numeriques alimentent la fiche produit.</p>
                </div>
              </div>

              <label>Nom du pack</label>
              <input
                value={shopPackForm.title}
                onChange={(event) => updateShopPackForm('title', event.target.value)}
                placeholder="Ex: Manoir victorien"
              />

              <div className="grid-two compact-grid">
                <label>
                  Cout en credits
                  <input type="number" min="0" value={shopPackForm.costCredits} onChange={(event) => updateShopPackForm('costCredits', event.target.value)} />
                </label>
                <label>
                  Note /10
                  <input type="number" min="0" max="10" step="0.1" value={shopPackForm.rating} onChange={(event) => updateShopPackForm('rating', event.target.value)} />
                </label>
              </div>

              <label>Descriptif</label>
              <textarea
                rows={5}
                value={shopPackForm.description}
                onChange={(event) => updateShopPackForm('description', event.target.value)}
                placeholder="Resume du pack, ambiance, type d'enigmes, public cible..."
              />

              <div className="admin-pack-metrics-form">
                {[
                  ['actsCount', 'Actes'],
                  ['scenesCount', 'Scenes'],
                  ['objectsCount', 'Objets'],
                  ['enigmasCount', 'Enigmes'],
                  ['cinematicsCount', 'Cinematiques'],
                  ['combinationsCount', 'Combinaisons'],
                ].map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input type="number" min="0" value={shopPackForm[field]} onChange={(event) => updateShopPackForm(field, event.target.value)} />
                  </label>
                ))}
              </div>

              <label>
                Screenshots
                <input type="file" accept="image/*" multiple onChange={addShopPackScreenshots} />
              </label>

              {shopPackForm.screenshots?.length ? (
                <div className="admin-screenshot-grid">
                  {shopPackForm.screenshots.map((screenshot) => (
                    <figure key={screenshot.id}>
                      <img src={screenshot.src} alt={screenshot.name || 'Screenshot'} />
                      <button type="button" className="secondary-action" onClick={() => removeShopPackScreenshot(screenshot.id)}>
                        Retirer
                      </button>
                    </figure>
                  ))}
                </div>
              ) : null}

              <label>
                ZIP telechargeable
                <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={importShopPackZip} />
              </label>
              {shopPackForm.downloadUrl ? (
                <div className="admin-pack-download-chip">
                  <strong>{shopPackForm.downloadFileName || 'pack.zip'}</strong>
                  <span>{shopPackForm.downloadMode === 'supabase' ? 'Pret pour les acheteurs' : 'Stockage local'}</span>
                </div>
              ) : (
                <p className="small-note">Ajoute le dossier ZIP qui sera propose au telechargement apres achat.</p>
              )}

              <button type="submit" className="profile-action-button">
                {shopPackForm.id ? 'Enregistrer les changements' : 'Ajouter le pack'}
              </button>
            </form>

            <div className="admin-shop-list">
              <div className="admin-shop-list-section">
                <div className="panel-head">
                  <div>
                    <h3>En vente</h3>
                    <p className="small-note">{activeShopPacks.length} pack{activeShopPacks.length > 1 ? 's' : ''} disponible{activeShopPacks.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="admin-shop-card-grid">
              {activeShopPacks.map((pack) => (
                <article className="list-card admin-pack-card" key={pack.id}>
                  {pack.screenshots?.[0]?.src ? <img className="admin-pack-cover" src={pack.screenshots[0].src} alt={pack.title} /> : null}
                  <div className="inline-head">
                    <div>
                      <strong>{pack.title}</strong>
                      <span>{pack.costCredits} credits - note {pack.rating}/10</span>
                    </div>
                    <span className="status-badge soft">{pack.downloadUrl ? 'ZIP pret' : 'ZIP manquant'}</span>
                  </div>
                  <p className="small-note">{pack.description || 'Aucun descriptif.'}</p>
                  <div className="admin-pack-metrics">
                    <span>{pack.scenesCount} scenes</span>
                    <span>{pack.objectsCount} objets</span>
                    <span>{pack.enigmasCount} enigmes</span>
                    <span>{pack.cinematicsCount} cinemat.</span>
                    <span>{pack.combinationsCount} combinaisons</span>
                  </div>
                  {pack.screenshots?.length > 1 ? (
                    <div className="admin-pack-thumbs">
                      {pack.screenshots.slice(1, 5).map((screenshot) => (
                        <img key={screenshot.id} src={screenshot.src} alt={screenshot.name || pack.title} />
                      ))}
                    </div>
                  ) : null}
                  <div className="toolbar">
                    <button type="button" className="secondary-action" onClick={() => editShopPack(pack)}>Modifier</button>
                    <button type="button" className="secondary-action" onClick={() => archiveShopPack(pack)} disabled={isBusy}>Archiver</button>
                    <button type="button" className="danger-button" onClick={() => removeShopPack(pack)}>Supprimer</button>
                  </div>
                </article>
              ))}
                </div>
              {activeShopPacks.length === 0 ? (
                <div className="empty-state-inline">
                  <strong>Aucun pack en vente pour le moment.</strong>
                </div>
              ) : null}
              </div>

              <div className="admin-shop-list-section">
                <div className="panel-head">
                  <div>
                    <h3>Archives de vente</h3>
                    <p className="small-note">{archivedShopPacks.length} pack{archivedShopPacks.length > 1 ? 's' : ''} archive{archivedShopPacks.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="admin-shop-card-grid">
                  {archivedShopPacks.map((pack) => (
                    <article className="list-card admin-pack-card archived" key={pack.id}>
                      {pack.screenshots?.[0]?.src ? <img className="admin-pack-cover" src={pack.screenshots[0].src} alt={pack.title} /> : null}
                      <div className="inline-head">
                        <div>
                          <strong>{pack.title}</strong>
                          <span>{pack.costCredits} credits - {pack.soldTo ? `vendu a ${pack.soldTo}` : 'archive'}</span>
                        </div>
                        <span className="status-badge soft">Archive</span>
                      </div>
                      <p className="small-note">{pack.soldAt ? `Vendu le ${formatDate(pack.soldAt)}` : pack.description || 'Pack archive.'}</p>
                      <div className="toolbar">
                        <button type="button" className="secondary-action" onClick={() => editShopPack(pack)}>Modifier</button>
                        <button type="button" className="profile-action-button" onClick={() => relistShopPack(pack)} disabled={isBusy}>Remettre en vente</button>
                        <button type="button" className="danger-button" onClick={() => removeShopPack(pack)}>Supprimer</button>
                      </div>
                    </article>
                  ))}
                </div>
                {archivedShopPacks.length === 0 ? (
                  <div className="empty-state-inline">
                    <strong>Aucune vente archivee.</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
