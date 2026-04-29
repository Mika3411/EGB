import React, { useEffect, useMemo, useState } from 'react';
import { getAllAccounts, normalizeEmail, updateStoredAccount } from '../lib/authStorage';
import { getPublicGames } from '../lib/publicGalleryStorage';
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

export default function AdminPage({
  user,
  onBack,
  onLogout,
}) {
  const [accounts, setAccounts] = useState([]);
  const [supabaseUsers, setSupabaseUsers] = useState([]);
  const [creditUsers, setCreditUsers] = useState([]);
  const [publicGames, setPublicGames] = useState([]);
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

    const [usersPayload, creditsPayload, games] = await Promise.all([
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
      getPublicGames().catch(() => []),
    ]);

    setSupabaseUsers(Array.isArray(usersPayload.users) ? usersPayload.users : []);
    setCreditUsers(Array.isArray(creditsPayload.users) ? creditsPayload.users : []);
    setPublicGames(games.filter((game) => normalizeEmail(game.authorEmail) !== ADMIN_EMAIL));
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
                <span className="status-badge soft">{game.plays || 0} parties</span>
              </div>
              <p className="small-note">
                {game.category} - {game.ageRating} - {game.feedback?.votes || 0} vote{game.feedback?.votes > 1 ? 's' : ''}
              </p>
            </article>
          ))}
          {publicGames.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucun jeu public tiers trouve.</strong>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
