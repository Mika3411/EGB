import React from 'react';
import { getDisplayName } from '../../shared/services/adminApi';
import { formatDate, formatNumber } from './adminConsoleFormatters';

export default function AdminStatisticsPanel({ adminStats }) {
  return (
    <>
      <section className="admin-stats-grid admin-overview-stats">
        <article className="panel admin-stat-card">
          <span>Connexions uniques</span>
          <strong>{formatNumber(adminStats.uniqueConnections)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Actifs 7 jours</span>
          <strong>{formatNumber(adminStats.connectedLast7Days)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Nouveaux 30 jours</span>
          <strong>{formatNumber(adminStats.newUsersLast30Days)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Projets créés</span>
          <strong>{formatNumber(adminStats.totalProjectCount)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Parties jouées</span>
          <strong>{formatNumber(adminStats.totalPlays)}</strong>
        </article>
        <article className="panel admin-stat-card">
          <span>Support ouvert</span>
          <strong>{formatNumber(adminStats.supportOpen)}</strong>
        </article>
      </section>

      <section className="panel admin-statistics-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Statistiques</span>
            <h2>Vue d'ensemble</h2>
            <p className="small-note">
              Les connexions uniques correspondent aux comptes distincts avec une date de connexion connue.
            </p>
          </div>
        </div>

        <div className="admin-statistics-layout">
          <article className="subpanel admin-stat-section">
            <div className="subpanel-head">
              <div>
                <h3>Activité des connexions</h3>
                <p className="small-note">{formatNumber(adminStats.totalUsers)} compte{adminStats.totalUsers > 1 ? 's' : ''} suivi{adminStats.totalUsers > 1 ? 's' : ''}.</p>
              </div>
              <span className="status-badge soft">{formatNumber(adminStats.connectedLast24Hours)} en 24h</span>
            </div>

            <div className="admin-metric-bars">
              {adminStats.connectionWindows.map((metric) => {
                const ratio = adminStats.totalUsers ? Math.min(100, Math.max(0, (metric.count / adminStats.totalUsers) * 100)) : 0;
                return (
                  <div className="admin-metric-row" key={metric.id}>
                    <div>
                      <span>{metric.label}</span>
                      <strong>{formatNumber(metric.count)}</strong>
                    </div>
                    <span className="admin-metric-bar" style={{ '--metric-ratio': `${ratio}%` }}>
                      <span />
                    </span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="subpanel admin-stat-section">
            <div className="subpanel-head">
              <div>
                <h3>Comptes</h3>
                <p className="small-note">Répartition des membres et comptes techniques.</p>
              </div>
            </div>

            <div className="admin-stat-pill-grid">
              <span><strong>{formatNumber(adminStats.activeUsers)}</strong> actifs</span>
              <span><strong>{formatNumber(adminStats.disabledUsers)}</strong> désactivés</span>
              <span><strong>{formatNumber(adminStats.supabaseUsers)}</strong> Supabase</span>
              <span><strong>{formatNumber(adminStats.localUsers)}</strong> locaux</span>
              <span><strong>{formatNumber(adminStats.creditOnlyUsers)}</strong> crédits seuls</span>
            </div>
          </article>
        </div>
      </section>

      <section className="admin-statistics-layout">
        <article className="panel admin-stat-section">
          <div className="panel-head">
            <div>
              <h2>Création et galerie</h2>
              <p className="small-note">{formatNumber(adminStats.publicGameCount)} jeu{adminStats.publicGameCount > 1 ? 'x' : ''} public{adminStats.publicGameCount > 1 ? 's' : ''}.</p>
            </div>
          </div>
          <div className="admin-stat-pill-grid wide">
            <span><strong>{formatNumber(adminStats.usersWithProjects)}</strong> créateurs avec projet</span>
            <span><strong>{formatNumber(adminStats.publicAuthorCount)}</strong> auteurs publiés</span>
            <span>
              <strong>{formatNumber(adminStats.builderVisitors)}</strong>
              visiteurs builder
              <small>{formatNumber(adminStats.builderVisitors24h)} en 24h</small>
            </span>
            <span>
              <strong>{formatNumber(adminStats.galleryVisitors)}</strong>
              visiteurs galerie
              <small>{formatNumber(adminStats.galleryVisitors24h)} en 24h</small>
            </span>
            <span><strong>{formatNumber(adminStats.totalVotes)}</strong> votes</span>
            <span><strong>{formatNumber(adminStats.totalComments)}</strong> avis</span>
            <span><strong>{formatNumber(adminStats.moderationActions)}</strong> éléments masqués</span>
          </div>
        </article>

        <article className="panel admin-stat-section">
          <div className="panel-head">
            <div>
              <h2>Crédits IA et support</h2>
              <p className="small-note">{formatNumber(adminStats.creditAccountCount)} compte{adminStats.creditAccountCount > 1 ? 's' : ''} avec portefeuille IA.</p>
            </div>
          </div>
          <div className="admin-stat-pill-grid wide">
            <span><strong>{formatNumber(adminStats.totalCreditBalance)}</strong> crédits disponibles</span>
            <span><strong>{formatNumber(adminStats.recentCreditTransactions)}</strong> transactions récentes</span>
            <span><strong>{formatNumber(adminStats.supportWaitingReply)}</strong> à répondre</span>
            <span><strong>{formatNumber(adminStats.supportClosed)}</strong> fermés</span>
          </div>
        </article>
      </section>

      <section className="panel admin-stat-section">
        <div className="panel-head">
          <div>
            <h2>Dernières connexions</h2>
            <p className="small-note">Comptes classés par date de connexion connue.</p>
          </div>
        </div>

        <div className="admin-recent-login-list">
          {adminStats.recentConnections.map((entry) => (
            <article className="admin-recent-login-row" key={entry.userId}>
              <div>
                <strong>{getDisplayName(entry)}</strong>
                <span>{entry.email || entry.userId}</span>
              </div>
              <span className="status-badge soft">{entry.provider}</span>
              <time>{formatDate(entry.lastConnectionAt)}</time>
            </article>
          ))}
          {adminStats.recentConnections.length === 0 ? (
            <div className="empty-state-inline">
              <strong>Aucune connexion connue.</strong>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
