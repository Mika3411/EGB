import React from 'react';
import { formatDate } from './profileUtils';

export default function OrdersPanel({ orders, onClose }) {
  return (
    <div className="profile-orders-overlay" role="presentation" onClick={onClose}>
      <section
        className="profile-orders-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-orders-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <div>
            <span className="eyebrow">Commandes</span>
            <h2 id="profile-orders-title">Suivi des achats</h2>
            <p className="small-note">
              Tes packs achetés et leurs liens de téléchargement disponibles.
            </p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="profile-orders-list">
          {orders.length > 0 ? (
            orders.map((order, index) => {
              const hasDownload = Boolean(order.downloadUrl);
              const orderKey = `${order.packId || order.title || 'order'}-${order.purchasedAt || index}`;

              return (
                <article key={orderKey} className="profile-order-card">
                  <div className="profile-order-head">
                    <div>
                      <h3>{order.title || 'Pack boutique'}</h3>
                      <p className="small-note">Commande du {formatDate(order.purchasedAt)}</p>
                    </div>
                    <span className={`profile-order-status ${hasDownload ? 'ready' : 'pending'}`}>
                      {hasDownload ? 'Téléchargement disponible' : 'En préparation'}
                    </span>
                  </div>

                  <div className="profile-order-meta">
                    <span>{Number(order.costCredits || 0)} credits</span>
                    <span>Suivi: achat valide</span>
                  </div>

                  {hasDownload ? (
                    <a
                      className="profile-action-button profile-order-download"
                      href={order.downloadUrl}
                      download={order.downloadFileName || ''}
                    >
                      Télécharger le pack
                    </a>
                  ) : (
                    <p className="small-note">Le lien apparaitra ici quand le fichier sera ajouté.</p>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucune commande</strong>
                <p className="small-note">Les packs achetés dans la boutique apparaitront ici.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
