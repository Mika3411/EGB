import React from 'react';
import { createEmptyShopPack } from '../../shared/services/shopPacksStorage';
import AdminShopPackLists from './AdminShopPackLists.jsx';
import { formatDate } from './adminConsoleFormatters';

export default function AdminShopPanel({
  activeShopPacks,
  addShopPackScreenshots,
  archiveShopPack,
  archivedShopPacks,
  editShopPack,
  importShopPackZip,
  isBusy,
  relistShopPack,
  removeShopPack,
  removeShopPackScreenshot,
  saveShopPack,
  setShopPackForm,
  shopPackForm,
  updateShopPackForm,
}) {
  return (
    <section className="panel admin-shop-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Boutique</span>
          <h2>Packs de jeux</h2>
          <p className="small-note">Crée des fiches produit avec coût en crédits, contenu du pack et screenshots.</p>
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
              <p className="small-note">Les champs numériques alimentent la fiche produit.</p>
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
              Coût en crédits
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
            placeholder="Résumé du pack, ambiance, type d'énigmes, public cible..."
          />

          <div className="admin-pack-metrics-form">
            {[
              ['actsCount', 'Actes'],
              ['scenesCount', 'Scènes'],
              ['objectsCount', 'Objets'],
              ['enigmasCount', 'Énigmes'],
              ['cinematicsCount', 'Cinématiques'],
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
            ZIP téléchargeable
            <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={importShopPackZip} />
          </label>
          {shopPackForm.downloadUrl || shopPackForm.hasDownload ? (
            <div className="admin-pack-download-chip">
              <strong>{shopPackForm.downloadFileName || 'pack.zip'}</strong>
              <span>{shopPackForm.downloadUrl ? (shopPackForm.downloadMode === 'supabase' ? 'Prêt pour les acheteurs' : 'Stockage local') : 'ZIP conservé côté serveur'}</span>
            </div>
          ) : (
            <p className="small-note">Ajoute le dossier ZIP qui sera proposé au téléchargement après achat.</p>
          )}

          <button type="submit" className="profile-action-button">
            {shopPackForm.id ? 'Enregistrer les changements' : 'Ajouter le pack'}
          </button>
        </form>

        <AdminShopPackLists
          activeShopPacks={activeShopPacks}
          archivedShopPacks={archivedShopPacks}
          isBusy={isBusy}
          editShopPack={editShopPack}
          archiveShopPack={archiveShopPack}
          removeShopPack={removeShopPack}
          relistShopPack={relistShopPack}
          formatDate={formatDate}
        />
      </div>
    </section>
  );
}
