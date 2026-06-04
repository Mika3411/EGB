import React, { useMemo, useState } from 'react';
import { showAlert, showConfirm } from '../../../shared/ui/AccessibleDialog';
import ThumbnailCropper from './ThumbnailCropper';
import { AGE_RATINGS, PUBLIC_CATEGORIES, formatDate } from './profileUtils';
import { getProjectName } from '../../../shared/services/projectAnalysis';
import {
  THUMBNAIL_CROPS,
  makeCroppedThumbnailFile,
  readImageFile,
} from '../../../shared/utils/thumbnailProcessor';

function PublicationCard({
  project,
  onCopyProjectLink,
  onPublishProject,
  onUnpublishProject,
  onUpdatePublicSettings,
  onUploadGalleryThumbnail,
}) {
  const [thumbnailError, setThumbnailError] = useState('');
  const [thumbnailCrop, setThumbnailCrop] = useState(null);
  const [thumbnailCropMode, setThumbnailCropMode] = useState('wide');
  const [thumbnailZoom, setThumbnailZoom] = useState(1);
  const [thumbnailPan, setThumbnailPan] = useState({ x: 0, y: 0 });
  const [isThumbnailBusy, setIsThumbnailBusy] = useState(false);

  const handlePublish = async () => {
    const category = project.shareState?.category || '';
    const ageRating = project.shareState?.ageRating || '';

    if (!category) {
      await showAlert({
        title: 'Publication incomplète',
        message: 'Choisis une catégorie avant de publier ce jeu.',
      });
      return;
    }

    if (!ageRating) {
      await showAlert({
        title: 'Publication incomplète',
        message: "Choisis une mention d'âge avant de publier ce jeu.",
      });
      return;
    }

    if (ageRating === '+18 ans') {
      const confirmed = await showConfirm({
        title: 'Confirmer +18 ans',
        message: 'Confirmer que ce jeu est réservé aux joueurs de 18 ans et plus ?',
        confirmLabel: 'Confirmer',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    onPublishProject?.(project.id);
  };

  const handleGalleryThumbnail = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setThumbnailError('');

    if (!file.type?.startsWith('image/')) {
      setThumbnailError('Choisis une image valide.');
      event.target.value = '';
      return;
    }

    try {
      const image = await readImageFile(file);
      setThumbnailCrop({ ...image, name: file.name });
      setThumbnailCropMode('wide');
      setThumbnailZoom(1);
      setThumbnailPan({ x: 0, y: 0 });
    } catch {
      setThumbnailError('Miniature impossible à charger.');
    } finally {
      event.target.value = '';
    }
  };

  const confirmGalleryThumbnail = async () => {
    if (!thumbnailCrop) return;
    setThumbnailError('');
    setIsThumbnailBusy(true);

    try {
      const croppedFile = await makeCroppedThumbnailFile({
        src: thumbnailCrop.src,
        sourceName: thumbnailCrop.name,
        sourceWidth: thumbnailCrop.width,
        sourceHeight: thumbnailCrop.height,
        cropMode: thumbnailCropMode,
        zoom: thumbnailZoom,
        panX: thumbnailPan.x,
        panY: thumbnailPan.y,
      });
      const uploadResult = await onUploadGalleryThumbnail?.(croppedFile);
      const thumbnailUrl = uploadResult?.publicUrl;
      if (!thumbnailUrl) throw new Error('Upload impossible.');

      onUpdatePublicSettings?.(project.id, {
        galleryThumbnail: thumbnailUrl,
        galleryThumbnailName: croppedFile.name,
        galleryThumbnailCrop: THUMBNAIL_CROPS[thumbnailCropMode].label,
        galleryThumbnailStorage: uploadResult.storageMode || 'supabase',
      });
      setThumbnailCrop(null);
    } catch (error) {
      setThumbnailError(error.message || 'Miniature impossible à enregistrer.');
    } finally {
      setIsThumbnailBusy(false);
    }
  };

  const projectName = getProjectName(project);
  const galleryThumbnail = project.shareState?.galleryThumbnail || project.thumbnail;
  const placeholderInitial = projectName.trim().charAt(0).toUpperCase() || 'P';
  const copiedRecently = project.shareState?.copiedAt
    && Date.now() - new Date(project.shareState.copiedAt).getTime() < 1000 * 60 * 15;
  const linkStatus = copiedRecently ? 'Copié récemment' : project.shareState?.isPublic ? 'Lien actif' : 'Privé';

  return (
    <article className="list-card" data-tour="profile-project-publish">
      <div className="project-card-layout">
        <div className="project-thumbnail" aria-hidden="true">
          {galleryThumbnail ? <img src={galleryThumbnail} alt="" /> : <span>{placeholderInitial}</span>}
        </div>

        <div className="project-card-body">
          <div className="inline-head">
            <div>
              <strong>{projectName}</strong>
              <span>{project.shareState?.publishedAt ? `Publié le ${formatDate(project.shareState.publishedAt)}` : 'Non publié'}</span>
            </div>
            <span className={`project-link-status ${copiedRecently ? 'copied' : project.shareState?.isPublic ? 'active' : 'private'}`}>
              {linkStatus}
            </span>
          </div>

          <div className="project-public-settings" data-tour="profile-public-settings">
            <label>
              Catégorie
              <select
                value={project.shareState?.category || ''}
                onChange={(event) => onUpdatePublicSettings?.(project.id, { category: event.target.value })}
              >
                <option value="">Choisir...</option>
                {PUBLIC_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Mention d'âge
              <select
                value={project.shareState?.ageRating || ''}
                onChange={(event) => onUpdatePublicSettings?.(project.id, {
                  mature: event.target.value === '+18 ans',
                  ageRating: event.target.value,
                })}
              >
                <option value="">Choisir...</option>
                {AGE_RATINGS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
              </select>
            </label>
            <label>
              Miniature galerie
              <span className="gallery-thumbnail-control">
                {project.shareState?.galleryThumbnailName || 'Choisir une image'}
                <input type="file" accept="image/*" hidden onChange={handleGalleryThumbnail} />
              </span>
            </label>
            {project.shareState?.galleryThumbnail ? (
              <button type="button" className="secondary-action" onClick={() => onUpdatePublicSettings?.(project.id, { galleryThumbnail: '', galleryThumbnailName: '' })}>
                Miniature auto
              </button>
            ) : null}
            {thumbnailError ? <p className="auth-error">{thumbnailError}</p> : null}
          </div>

          <div className="project-card-footer">
            <button type="button" className="secondary-action profile-share-button" onClick={() => onCopyProjectLink?.(project.id)}>
              <span aria-hidden="true">🔗</span>
              Copier le lien
            </button>
            <button type="button" className="profile-publish-button" onClick={handlePublish}>
              {project.shareState?.isPublic ? 'Mettre à jour' : 'Publier'}
            </button>
            {project.shareState?.isPublic ? (
              <button type="button" className="danger-button" onClick={() => onUnpublishProject?.(project.id)}>
                Retirer de la galerie
              </button>
            ) : null}
          </div>

          <ThumbnailCropper
            thumbnailCrop={thumbnailCrop}
            thumbnailCropMode={thumbnailCropMode}
            thumbnailZoom={thumbnailZoom}
            thumbnailPan={thumbnailPan}
            isThumbnailBusy={isThumbnailBusy}
            onClose={() => setThumbnailCrop(null)}
            onCropModeChange={setThumbnailCropMode}
            onZoomChange={setThumbnailZoom}
            onPanChange={setThumbnailPan}
            onConfirm={confirmGalleryThumbnail}
          />
        </div>
      </div>
    </article>
  );
}

export default function PublicationPanel({
  projects,
  onCopyProjectLink,
  onPublishProject,
  onUnpublishProject,
  onUpdatePublicSettings,
  onUploadGalleryThumbnail,
}) {
  const [publicationFilter, setPublicationFilter] = useState('all');

  const visibleProjects = useMemo(() => (
    projects.filter((project) => {
      if (publicationFilter === 'published') return project.shareState?.isPublic;
      if (publicationFilter === 'draft') return !project.shareState?.isPublic;
      return true;
    })
  ), [projects, publicationFilter]);

  return (
    <section className="panel" data-tour="profile-publication-section">
      <div className="panel-head">
        <div>
          <h2>Publication</h2>
          <p className="small-note">
            Prépare les informations publiques, le lien et la présence en galerie.
          </p>
        </div>
        <select value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)}>
          <option value="all">Tous les projets</option>
          <option value="published">Publiés</option>
          <option value="draft">Non publiés</option>
        </select>
      </div>

      <div className="editor-stack" style={{ marginTop: 12 }}>
        {visibleProjects.length > 0 ? (
          visibleProjects.map((project) => (
            <PublicationCard
              key={project.id}
              project={project}
              onCopyProjectLink={onCopyProjectLink}
              onPublishProject={onPublishProject}
              onUnpublishProject={onUnpublishProject}
              onUpdatePublicSettings={onUpdatePublicSettings}
              onUploadGalleryThumbnail={onUploadGalleryThumbnail}
            />
          ))
        ) : (
          <div className="empty-state-inline">
            <div>
              <strong>Aucun projet dans ce filtre</strong>
              <p className="small-note">Change le filtre ou crée un projet avant de le publier.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
