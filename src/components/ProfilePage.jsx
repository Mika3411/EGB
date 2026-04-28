import React, { useMemo, useRef, useState } from 'react';

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

const getProjectName = (project) =>
  project?.name || project?.data?.title || project?.data?.name || 'Projet sans titre';

const CREATION_TEMPLATES = [
  ['empty', 'Projet vide'],
  ['manor', 'Manoir hanté'],
  ['investigation', 'Enquête policière'],
  ['laboratory', 'Laboratoire'],
  ['museum', 'Musée'],
];

const PUBLIC_CATEGORIES = ['Horreur', 'Enquete', 'Aventure', 'Science-fiction', 'Fantastique', 'Historique', 'Autre'];
const AGE_RATINGS = ['Tout public', '+18 ans'];
const THUMBNAIL_CROPS = {
  wide: { label: '16:9', aspect: 16 / 9, width: 1280, height: 720 },
  square: { label: 'Carré', aspect: 1, width: 900, height: 900 },
};

const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => resolve({
      src: reader.result,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    image.onerror = reject;
    image.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const makeCroppedThumbnailFile = async ({ src, sourceName, sourceWidth, sourceHeight, cropMode, zoom, panX, panY }) => {
  const crop = THUMBNAIL_CROPS[cropMode] || THUMBNAIL_CROPS.wide;
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = src;
  });

  const naturalWidth = sourceWidth || image.naturalWidth || image.width;
  const naturalHeight = sourceHeight || image.naturalHeight || image.height;
  const imageAspect = naturalWidth / naturalHeight;
  const baseWidth = imageAspect > crop.aspect ? naturalHeight * crop.aspect : naturalWidth;
  const baseHeight = imageAspect > crop.aspect ? naturalHeight : naturalWidth / crop.aspect;
  const sourceWidthCropped = Math.max(1, baseWidth / zoom);
  const sourceHeightCropped = Math.max(1, baseHeight / zoom);
  const maxOffsetX = Math.max(0, (naturalWidth - sourceWidthCropped) / 2);
  const maxOffsetY = Math.max(0, (naturalHeight - sourceHeightCropped) / 2);
  const sx = Math.max(0, Math.min(naturalWidth - sourceWidthCropped, (naturalWidth - sourceWidthCropped) / 2 + (panX / 100) * maxOffsetX));
  const sy = Math.max(0, Math.min(naturalHeight - sourceHeightCropped, (naturalHeight - sourceHeightCropped) / 2 + (panY / 100) * maxOffsetY));

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Recadrage impossible dans ce navigateur.');
  context.drawImage(image, sx, sy, sourceWidthCropped, sourceHeightCropped, 0, 0, crop.width, crop.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('Impossible de générer la miniature.');
  const safeName = String(sourceName || 'miniature').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase() || 'miniature';
  return new File([blob], `${safeName}-${crop.label.replace(':', 'x')}.webp`, { type: 'image/webp' });
};

const getProjectStats = (project) => {
  const data = project?.data || {};
  return {
    scenes: Array.isArray(data.scenes) ? data.scenes.length : 0,
    enigmas: Array.isArray(data.enigmas) ? data.enigmas.length : 0,
    cinematics: Array.isArray(data.cinematics) ? data.cinematics.length : 0,
  };
};

const getProjectCompletion = (project) => {
  const data = project?.data || {};
  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  const cinematics = Array.isArray(data.cinematics) ? data.cinematics : [];
  const enigmas = Array.isArray(data.enigmas) ? data.enigmas : [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const cinematicIds = new Set(cinematics.map((cinematic) => cinematic.id));
  const enigmaIds = new Set(enigmas.map((enigma) => enigma.id));

  const isMissingLink = (hotspot, prefix = '') => {
    const actionType = hotspot?.[`${prefix}ActionType`] || 'dialogue';
    const sceneId = hotspot?.[`${prefix}TargetSceneId`] || '';
    const cinematicId = hotspot?.[`${prefix}TargetCinematicId`] || '';
    const enigmaId = hotspot?.[`${prefix}EnigmaId`] || '';

    return (
      (actionType === 'scene' && (!sceneId || !sceneIds.has(sceneId)))
      || (actionType === 'cinematic' && (!cinematicId || !cinematicIds.has(cinematicId)))
      || (enigmaId && !enigmaIds.has(enigmaId))
    );
  };

  const unlinkedHotspots = scenes.reduce((count, scene) => (
    count + (scene.hotspots || []).filter((hotspot) => (
      isMissingLink(hotspot) || (hotspot.hasSecondAction && isMissingLink(hotspot, 'second'))
    )).length
  ), 0);

  const enigmasWithoutSolution = enigmas.filter((enigma) => {
    if (enigma.type === 'code') return !String(enigma.solutionText || '').trim();
    if (enigma.type === 'misc') {
      const miscMode = enigma.miscMode || 'free-answer';
      if (['free-answer', 'multiple-choice', 'true-false', 'fill-blank', 'exact-number'].includes(miscMode)) return !String(enigma.solutionText || '').trim();
      if (miscMode === 'numeric-range') return !String(enigma.miscMin ?? '').trim() || !String(enigma.miscMax ?? '').trim();
      if (miscMode === 'item-select') return !enigma.miscTargetItemId;
      if (miscMode === 'accepted-answers') return !Array.isArray(enigma.miscChoices) || enigma.miscChoices.length === 0;
      if (miscMode === 'matching') return !Array.isArray(enigma.miscPairs) || enigma.miscPairs.length === 0;
      if (miscMode === 'multi-select') return !Array.isArray(enigma.miscCorrectChoices) || enigma.miscCorrectChoices.length === 0;
      if (miscMode === 'ordering') return !Array.isArray(enigma.miscChoices) || enigma.miscChoices.length === 0;
    }
    if (enigma.type === 'colors' || enigma.type === 'simon') return !Array.isArray(enigma.solutionColors) || enigma.solutionColors.length === 0;
    if (['puzzle', 'rotation', 'dragdrop'].includes(enigma.type)) return !enigma.imageData;
    return false;
  }).length;

  return {
    scenes: scenes.length,
    unlinkedHotspots,
    enigmasWithoutSolution,
  };
};

function ProjectCard({
  project,
  isActive,
  syncStatus = 'offline',
  onOpenProject,
  onTestProject,
  onCopyProjectLink,
  onPublishProject,
  onUpdatePublicSettings,
  onUploadGalleryThumbnail,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [thumbnailCrop, setThumbnailCrop] = useState(null);
  const [thumbnailCropMode, setThumbnailCropMode] = useState('wide');
  const [thumbnailZoom, setThumbnailZoom] = useState(1);
  const [thumbnailPan, setThumbnailPan] = useState({ x: 0, y: 0 });
  const [isThumbnailBusy, setIsThumbnailBusy] = useState(false);
  const [name, setName] = useState(getProjectName(project));
  const stats = getProjectStats(project);
  const completion = getProjectCompletion(project);

  const submitRename = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    await onRenameProject?.(project.id, nextName);
    setIsRenaming(false);
  };

  const handleDelete = () => {
    const label = getProjectName(project);
    const confirmed = window.confirm(`Supprimer "${label}" Cette action est irréversible.`);
    if (confirmed) onDeleteProject?.(project.id);
  };

  const handlePublish = () => {
    const category = project.shareState?.category || '';
    const ageRating = project.shareState?.ageRating || '';

    if (!category) {
      window.alert('Choisis une catégorie avant de publier ce jeu.');
      return;
    }

    if (!ageRating) {
      window.alert('Choisis une mention d’âge avant de publier ce jeu.');
      return;
    }

    if (ageRating === '+18 ans') {
      const confirmed = window.confirm('Confirmer que ce jeu est réservé aux joueurs de 18 ans et plus ?');
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

  const galleryThumbnail = project.shareState?.galleryThumbnail || project.thumbnail;

  const projectName = getProjectName(project);
  const placeholderInitial = projectName.trim().charAt(0).toUpperCase() || 'P';
  const syncLabel = syncStatus === 'syncing' ? 'Synchronisation...' : syncStatus === 'synced' ? 'Synchronisé' : 'Hors ligne';
  const syncIcon = syncStatus === 'syncing' ? '⏳' : syncStatus === 'synced' ? '☁' : '⚠';
  const copiedRecently = project.shareState?.copiedAt
    && Date.now() - new Date(project.shareState.copiedAt).getTime() < 1000 * 60 * 15;
  const linkStatus = copiedRecently ? 'Copié récemment' : project.shareState?.isPublic ? 'Lien actif' : 'Privé';

  return (
    <article className={`list-card ${isActive ? 'selected' : ''}`}>
      <div className="project-card-layout">
        <div className="project-thumbnail" aria-hidden="true">
          {galleryThumbnail ? <img src={galleryThumbnail} alt="" /> : <span>{placeholderInitial}</span>}
        </div>

        <div className="project-card-body">
      <div className="inline-head">
        <div>
          {isRenaming ? (
            <form onSubmit={submitRename} className="grid-two small-gap">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setName(getProjectName(project));
                    setIsRenaming(false);
                  }
                }}
              />
              <button type="submit">Valider</button>
            </form>
          ) : (
            <>
              <strong>{projectName}</strong>
              <span>
                {isActive ? 'Projet actif · ' : ''}
                Modifié le {formatDate(project.updatedAt)}
              </span>
            </>
          )}
        </div>

        <div className="toolbar">
          <button type="button" className="profile-resume-button" onClick={() => onOpenProject?.(project.id)}>
            <span aria-hidden="true">▶</span>
            Reprendre
          </button>
          <button type="button" className="secondary-action" onClick={() => setIsRenaming(true)}>
            Renommer
          </button>
          <button type="button" className="secondary-action" onClick={() => onDuplicateProject?.(project.id)}>
            Dupliquer
          </button>
          <button type="button" className="danger-button" onClick={handleDelete}>
            Supprimer
          </button>
        </div>
      </div>

      <p className="small-note">
        {stats.scenes} ? scène{stats.scenes > 1 ? 's' : ''} ? {stats.enigmas} énigme{stats.enigmas > 1 ? 's' : ''} ?{' '}
        {stats.cinematics} ? cinématique{stats.cinematics > 1 ? 's' : ''}
      </p>

      <div className="project-completion-box" aria-label="Indicateur de complétion">
        <div className="project-completion-row ok">
          <span aria-hidden="true">✓</span>
          <strong>{completion.scenes}</strong>
          <em>scène{completion.scenes > 1 ? 's' : ''}</em>
        </div>
        <div className={`project-completion-row ${completion.unlinkedHotspots ? 'warn' : 'ok'}`}>
          <span aria-hidden="true">{completion.unlinkedHotspots ? '⚠' : '✓'}</span>
          <strong>{completion.unlinkedHotspots}</strong>
          <em>hotspot{completion.unlinkedHotspots > 1 ? 's' : ''} non ? relié{completion.unlinkedHotspots > 1 ? 's' : ''}</em>
        </div>
        <div className={`project-completion-row ${completion.enigmasWithoutSolution ? 'danger' : 'ok'}`}>
          <span aria-hidden="true">{completion.enigmasWithoutSolution ? '✕' : '✓'}</span>
          <strong>{completion.enigmasWithoutSolution}</strong>
          <em>énigme{completion.enigmasWithoutSolution > 1 ? 's' : ''} sans ? solution</em>
        </div>
      </div>

      <div className="project-card-footer">
        <div className={`project-sync-badge ${syncStatus}`}>
          <span aria-hidden="true">{syncIcon}</span>
          <strong>{syncLabel}</strong>
        </div>
        <button type="button" className="secondary-action profile-test-button" onClick={() => onTestProject?.(project.id)}>
          <span aria-hidden="true">▶</span>
          Tester
        </button>
        <span className={`project-link-status ${copiedRecently ? 'copied' : project.shareState?.isPublic ? 'active' : 'private'}`}>
          {linkStatus}
        </span>
        <button type="button" className="secondary-action profile-share-button" onClick={() => onCopyProjectLink?.(project.id)}>
          <span aria-hidden="true">🔗</span>
          Copier le lien ?
        </button>
        <button type="button" className="profile-publish-button" onClick={handlePublish}>
          Publier
        </button>
      </div>

      <div className="project-public-settings">
        <label>
          Catégorie ?
          <select
            value={project.shareState?.category || ''}
            onChange={(event) => onUpdatePublicSettings?.(project.id, { category: event.target.value })}
          >
            <option value="">Choisir...</option>
            {PUBLIC_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Mention d’âge ?
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
          Miniature galerie ?
          <span className="gallery-thumbnail-control">
            {project.shareState?.galleryThumbnailName || 'Choisir une image'}
            <input type="file" accept="image/*" hidden onChange={handleGalleryThumbnail} />
          </span>
        </label>
        {project.shareState?.galleryThumbnail ? (
          <button type="button" className="secondary-action" onClick={() => onUpdatePublicSettings?.(project.id, { galleryThumbnail: '', galleryThumbnailName: '' })}>
            Miniature auto ?
          </button>
        ) : null}
        {thumbnailError ? <p className="auth-error">{thumbnailError}</p> : null}
      </div>
      {thumbnailCrop ? (
        <div className="thumbnail-crop-overlay" role="dialog" aria-modal="true" aria-label="Recadrer la miniature">
          <div className="thumbnail-crop-panel">
            <div className="panel-head">
              <div>
                <h3>Recadrer la miniature</h3>
                <p className="small-note">Choisis un format propre avant publication.</p>
              </div>
              <button type="button" className="secondary-action" onClick={() => setThumbnailCrop(null)}>Fermer</button>
            </div>
            <div className={`thumbnail-crop-preview ${thumbnailCropMode}`}>
              <img
                src={thumbnailCrop.src}
                alt=""
                style={{
                  transform: `translate(${thumbnailPan.x / 3}%, ${thumbnailPan.y / 3}%) scale(${thumbnailZoom})`,
                }}
              />
            </div>
            <div className="thumbnail-crop-controls">
              <div className="segmented-control compact">
                {Object.entries(THUMBNAIL_CROPS).map(([value, crop]) => (
                  <button
                    key={value}
                    type="button"
                    className={thumbnailCropMode === value ? 'active' : ''}
                    onClick={() => setThumbnailCropMode(value)}
                  >
                    {crop.label}
                  </button>
                ))}
              </div>
              <label>
                Zoom
                <input type="range" min="1" max="3" step="0.05" value={thumbnailZoom} onChange={(event) => setThumbnailZoom(Number(event.target.value))} />
              </label>
              <div className="grid-two small-gap">
                <label>
                  Horizontal
                  <input type="range" min="-100" max="100" step="1" value={thumbnailPan.x} onChange={(event) => setThumbnailPan((pan) => ({ ...pan, x: Number(event.target.value) }))} />
                </label>
                <label>
                  Vertical
                  <input type="range" min="-100" max="100" step="1" value={thumbnailPan.y} onChange={(event) => setThumbnailPan((pan) => ({ ...pan, y: Number(event.target.value) }))} />
                </label>
              </div>
              <button type="button" className="profile-publish-button" onClick={confirmGalleryThumbnail} disabled={isThumbnailBusy}>
                {isThumbnailBusy ? 'Enregistrement...' : 'Valider la miniature'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ProfilePage({
  user,
  canOpenAdmin = false,
  projects = [],
  activeProjectId = '',
  isBusy = false,
  statusMessage = '',
  syncStatus = 'offline',
  onCreateProject,
  onOpenProject,
  onTestProject,
  onCopyProjectLink,
  onPublishProject,
  onUpdatePublicSettings,
  onUploadGalleryThumbnail,
  onOpenPublicGallery,
  onOpenAdmin,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onImportProject,
  onLogout,
}) {
  const [newProjectName, setNewProjectName] = useState('');
  const [creationTemplate, setCreationTemplate] = useState('empty');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('updated-desc');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...projects]
      .filter((project) => !query || getProjectName(project).toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortMode === 'name-asc') return getProjectName(a).localeCompare(getProjectName(b), 'fr');
        if (sortMode === 'created-desc') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
  }, [projects, search, sortMode]);

  const handleCreate = async (event) => {
    event.preventDefault();
    const templateLabel = CREATION_TEMPLATES.find(([value]) => value === creationTemplate)?.[1] || 'Nouveau projet';
    await onCreateProject?.(newProjectName.trim() || templateLabel, creationTemplate);
    setNewProjectName('');
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');

    try {
      await onImportProject?.(file);
    } catch (error) {
      console.error(error);
      setImportError("Import impossible. Vérifie que c'est bien un fichier JSON de projet.");
    } finally {
      event.target.value = '';
    }
  };

  return (
    <main className="layout">
      <section className="panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="eyebrow">Profil</span>
            <h2>Salut {user?.name || user?.email || 'créateur'} 👋</h2>
            <p className="small-note">
              Gère tes jeux, reprends un projet Supabase existant ou importe une sauvegarde JSON.
            </p>
          </div>

          <div className="toolbar">
            {statusMessage ? <span className="status-badge soft">{statusMessage}</span> : null}
            {canOpenAdmin ? (
              <button type="button" className="secondary-action" onClick={onOpenAdmin}>
                Admin
              </button>
            ) : null}
            <button type="button" className="secondary-action" onClick={onOpenPublicGallery}>
              Galerie publique
            </button>
            <button type="button" className="secondary-action" onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="grid-two">
          <form onSubmit={handleCreate}>
            <label htmlFor="new-project-name">Nouveau projet</label>
            <input
              id="new-project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Nom du jeu"
              disabled={isBusy}
            />
            <label htmlFor="creation-template">Template</label>
            <div className="template-picker" id="creation-template">
              {CREATION_TEMPLATES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={creationTemplate === value ? 'selected' : ''}
                  onClick={() => setCreationTemplate(value)}
                  disabled={isBusy}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="submit" className="profile-action-button" disabled={isBusy}>
              + Créer ?
            </button>
          </form>

          <div>
            <label>Importer</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImport}
            />
            <button type="button" className="profile-action-button secondary-action" onClick={() => fileInputRef.current?.click()}>
              Importer un projet JSON ?
            </button>
            {importError ? <p className="auth-error">{importError}</p> : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Mes projets</h2>
            <p className="small-note">
              {projects.length} ? projet{projects.length > 1 ? 's' : ''} ? sauvegardé{projects.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="grid-two small-gap">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un projet"
          />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="updated-desc">Modifiés récemment</option>
            <option value="created-desc">Créés récemment</option>
            <option value="name-asc">Nom A → Z</option>
          </select>
        </div>

        <div className="editor-stack" style={{ marginTop: 12 }}>
          {visibleProjects.length > 0 ? (
            visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                syncStatus={syncStatus}
                onOpenProject={onOpenProject}
                onTestProject={onTestProject}
                onCopyProjectLink={onCopyProjectLink}
                onPublishProject={onPublishProject}
                onUpdatePublicSettings={onUpdatePublicSettings}
                onUploadGalleryThumbnail={onUploadGalleryThumbnail}
                onRenameProject={onRenameProject}
                onDuplicateProject={onDuplicateProject}
                onDeleteProject={onDeleteProject}
              />
            ))
          ) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucun projet trouvé</strong>
                <p className="small-note">
                  Si ton ancien projet est sur Supabase, le hook corrigé le récupère automatiquement au chargement.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
