import React from 'react';

const AdminShopPackCard = ({
  pack,
  isArchived = false,
  isBusy = false,
  editShopPack,
  archiveShopPack,
  removeShopPack,
  relistShopPack,
  formatDate,
}) => (
  <article className={`list-card admin-pack-card${isArchived ? ' archived' : ''}`} key={pack.id}>
    {pack.screenshots?.[0]?.src ? <img className="admin-pack-cover" src={pack.screenshots[0].src} alt={pack.title} /> : null}
    <div className="inline-head">
      <div>
        <strong>{pack.title}</strong>
        <span>
          {isArchived
            ? `${pack.costCredits} crédits - ${pack.soldTo ? `vendu a ${pack.soldTo}` : 'archive'}`
            : `${pack.costCredits} crédits - note ${pack.rating}/10`}
        </span>
      </div>
      <span className="status-badge soft">{isArchived ? 'Archive' : (pack.downloadUrl || pack.hasDownload ? 'ZIP prêt' : 'ZIP manquant')}</span>
    </div>
    <p className="small-note">
      {isArchived
        ? (pack.soldAt ? `Vendu le ${formatDate(pack.soldAt)}` : pack.description || 'Pack archive.')
        : pack.description || 'Aucun descriptif.'}
    </p>
    {!isArchived ? (
      <>
        <div className="admin-pack-metrics">
          <span>{pack.scenesCount} scènes</span>
          <span>{pack.objectsCount} objets</span>
          <span>{pack.enigmasCount} énigmes</span>
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
      </>
    ) : null}
    <div className="toolbar">
      <button type="button" className="secondary-action" onClick={() => editShopPack(pack)}>Modifier</button>
      {isArchived ? (
        <button type="button" className="profile-action-button" onClick={() => relistShopPack(pack)} disabled={isBusy}>Remettre en vente</button>
      ) : (
        <button type="button" className="secondary-action" onClick={() => archiveShopPack(pack)} disabled={isBusy}>Archiver</button>
      )}
      <button type="button" className="danger-button" onClick={() => removeShopPack(pack)}>Supprimer</button>
    </div>
  </article>
);

export default function AdminShopPackLists({
  activeShopPacks,
  archivedShopPacks,
  isBusy,
  editShopPack,
  archiveShopPack,
  removeShopPack,
  relistShopPack,
  formatDate,
}) {
  const sharedProps = {
    isBusy,
    editShopPack,
    archiveShopPack,
    removeShopPack,
    relistShopPack,
    formatDate,
  };

  return (
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
            <AdminShopPackCard key={pack.id} pack={pack} {...sharedProps} />
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
            <AdminShopPackCard key={pack.id} pack={pack} isArchived {...sharedProps} />
          ))}
        </div>
        {archivedShopPacks.length === 0 ? (
          <div className="empty-state-inline">
            <strong>Aucune vente archivee.</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
