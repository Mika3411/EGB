import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Copy,
  Eye,
  Gift,
  Megaphone,
  Pencil,
  QrCode,
  Send,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { getProjectName, getProjectStats } from '../../../shared/services/projectAnalysis';
import { loadProClickAnalytics as defaultLoadProClickAnalytics } from '../../../shared/services/proClickAnalytics';
import {
  getProPromotionConfig,
  getProPromotionProjectKind,
  isProPromotionProject,
} from '../../../shared/services/proPromotion';
import { formatDate } from './profileUtils';

const proStoryAction = {
  kind: 'story',
  icon: Megaphone,
  buttonLabel: 'Créer un prologue / épilogue',
  copy: 'Créer une page complémentaire à placer avant ou après l’expérience : accroche, consignes, conclusion, bonus ou code d’accès.',
};

const proShowcaseAction = {
  kind: 'showcase',
  icon: Store,
  buttonLabel: 'Créer une vitrine',
  copy: 'Démarrer une page publique de présentation : enseigne, pitch, infos pratiques, réservation et projets mis en avant.',
};

const extensionFilters = [
  ['all', 'Toutes les pages Pro'],
  ['showcase', 'Vitrines'],
  ['story', 'Prologues / Épilogues'],
];

const getProExtensionIcon = (kind) => {
  if (kind === 'extend') return Gift;
  if (kind === 'showcase') return Store;
  return Megaphone;
};

const proStatsFilters = [
  ['7d', '7 jours'],
  ['30d', '30 jours'],
  ['total', 'Total'],
];

const getStatsCount = (entry = {}, filter = 'total') => {
  if (filter === '7d') return Number(entry.clicks7d || 0);
  if (filter === '30d') return Number(entry.clicks30d || 0);
  return Number(entry.clicks || 0);
};

function ProfileProStatsModal({
  filter,
  isLoading = false,
  project,
  stats,
  error = '',
  onClose,
  onFilterChange,
}) {
  if (!project) return null;
  const projectName = getProjectName(project);
  const elements = [...(stats?.elements || [])]
    .map((element) => ({ ...element, visibleClicks: getStatsCount(element, filter) }))
    .filter((element) => element.visibleClicks > 0 || filter === 'total')
    .sort((a, b) => b.visibleClicks - a.visibleClicks);
  const total = getStatsCount(stats, filter);

  return (
    <div className="accessible-dialog-overlay profile-pro-stats-overlay" role="presentation">
      <section className="accessible-dialog-panel profile-pro-stats-modal" role="dialog" aria-modal="true" aria-labelledby="profile-pro-stats-title">
        <div className="profile-pro-stats-head">
          <div>
            <span className="eyebrow">Statistiques</span>
            <h2 id="profile-pro-stats-title">{projectName}</h2>
          </div>
          <button type="button" className="profile-pro-icon-button" onClick={onClose} aria-label="Fermer les statistiques">
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="profile-pro-stats-filters" role="group" aria-label="Filtre des statistiques">
          {proStatsFilters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'active' : ''}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="profile-pro-stats-total">
          <span>Total</span>
          <strong>{isLoading ? '...' : total}</strong>
          <small>clic{total > 1 ? 's' : ''}</small>
        </div>

        {error ? <p className="small-note profile-pro-stats-error">{error}</p> : null}
        {!error && isLoading ? <p className="small-note">Chargement des statistiques...</p> : null}

        {!error && !isLoading ? (
          <div className="profile-pro-stats-details">
            <h3>Détail par bouton/zone</h3>
            {elements.length ? (
              <div className="profile-pro-stats-list">
                {elements.map((element) => (
                  <div key={element.key || element.elementId || element.elementName} className="profile-pro-stats-row">
                    <div>
                      <strong>{element.elementName || 'Zone cliquée'}</strong>
                      <span>{element.actionType === 'project_link' ? 'Projet cible' : 'Lien externe'}</span>
                    </div>
                    <b>{element.visibleClicks}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small-note">Aucun clic enregistré pour ce filtre.</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProfileProExtensionCard({
  project,
  isActive = false,
  isBusy = false,
  onCopyProjectLink,
  onDeleteProject,
  onDuplicateProject,
  onOpenProject,
  onOpenProjectStats,
  onPublishProject,
  onRenameProject,
  onSaveProjectQrCode,
  onTestProject,
  onUnpublishProject,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(getProjectName(project));
  const kind = getProPromotionProjectKind(project);
  const config = getProPromotionConfig(kind);
  const projectName = getProjectName(project);
  const stats = getProjectStats(project);
  const Icon = getProExtensionIcon(kind);

  const submitRename = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    await onRenameProject?.(project.id, nextName);
    setIsRenaming(false);
  };

  const startRename = () => {
    setName(projectName);
    setIsRenaming(true);
  };

  return (
    <article className={`profile-pro-extension-card ${isActive ? 'selected' : ''}`}>
      <div className="profile-pro-extension-head">
        <div className="profile-pro-extension-title">
          <Icon aria-hidden="true" size={18} />
          <div>
            {isRenaming ? (
              <form className="profile-pro-rename-form" onSubmit={submitRename}>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setName(projectName);
                      setIsRenaming(false);
                    }
                  }}
                />
                <button type="submit" disabled={isBusy}>Valider</button>
              </form>
            ) : (
              <>
                <strong>{projectName}</strong>
                <span>
                  {config.intentLabel} · {stats.scenes} scène{stats.scenes > 1 ? 's' : ''} · Modifié le {formatDate(project.updatedAt)}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="profile-pro-icon-button"
          disabled={isBusy}
          onClick={() => onOpenProjectStats?.(project)}
          aria-label={`Statistiques de ${projectName}`}
          title="Statistiques"
        >
          <BarChart3 aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="profile-pro-extension-actions">
        <button type="button" className="profile-resume-button" disabled={isBusy} onClick={() => onOpenProject?.(project.id, { tab: 'scenes' })}>
          <Pencil aria-hidden="true" size={16} />
          Éditer
        </button>
        <button type="button" className="secondary-action profile-test-button" disabled={isBusy} onClick={() => onTestProject?.(project.id)}>
          <Eye aria-hidden="true" size={16} />
          Aperçu
        </button>
        <button type="button" className="secondary-action profile-share-button" disabled={isBusy} onClick={() => onCopyProjectLink?.(project.id)}>
          <Copy aria-hidden="true" size={16} />
          Copier le lien
        </button>
        <button type="button" className="profile-publish-button" disabled={isBusy} onClick={() => onPublishProject?.(project.id)}>
          <Send aria-hidden="true" size={16} />
          {project.shareState?.isPublic ? 'Mettre à jour' : 'Publier'}
        </button>
      </div>

      <div className="profile-pro-extension-actions secondary-row">
        <button type="button" className="secondary-action" disabled={isBusy} onClick={startRename}>
          <Pencil aria-hidden="true" size={15} />
          Renommer
        </button>
        <button type="button" className="secondary-action" disabled={isBusy} onClick={() => onDuplicateProject?.(project.id)}>
          <Copy aria-hidden="true" size={15} />
          Dupliquer
        </button>
        <button type="button" className="secondary-action profile-qr-button" disabled={isBusy} onClick={() => onSaveProjectQrCode?.(project.id)}>
          <QrCode aria-hidden="true" size={15} />
          QR code
        </button>
        {project.shareState?.isPublic ? (
          <button type="button" className="secondary-action" disabled={isBusy} onClick={() => onUnpublishProject?.(project.id)}>
            Retirer
          </button>
        ) : null}
        <button type="button" className="danger-button" disabled={isBusy} onClick={() => onDeleteProject?.(project.id, projectName)}>
          <Trash2 aria-hidden="true" size={15} />
          Supprimer
        </button>
      </div>
    </article>
  );
}

export default function ProfileProPanel({
  activeProjectId = '',
  isBusy = false,
  loadProClickAnalytics = defaultLoadProClickAnalytics,
  projects = [],
  onCopyProjectLink,
  onDeleteProject,
  onDuplicateProject,
  onOpenProject,
  onPublishProject,
  onRenameProject,
  onSaveProjectQrCode,
  onStartProPromotion,
  onTestProject,
  onUnpublishProject,
}) {
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statsFilter, setStatsFilter] = useState('7d');
  const [statsProject, setStatsProject] = useState(null);
  const [statsByProjectId, setStatsByProjectId] = useState({});
  const [statsLoadingProjectId, setStatsLoadingProjectId] = useState('');
  const [statsError, setStatsError] = useState('');

  const extensionProjects = useMemo(() => (
    [...(projects || [])]
      .filter(isProPromotionProject)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  ), [projects]);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return extensionProjects.filter((project) => {
      const kind = getProPromotionProjectKind(project);
      if (extensionFilter === 'promote' && kind !== 'promote') return false;
      if (extensionFilter === 'extend' && kind !== 'extend') return false;
      if (extensionFilter === 'story' && kind !== 'story') return false;
      if (extensionFilter === 'showcase' && kind !== 'showcase') return false;
      return !query || getProjectName(project).toLowerCase().includes(query);
    });
  }, [extensionFilter, extensionProjects, search]);

  const openStatsModal = async (project) => {
    if (!project?.id) return;
    setStatsProject(project);
    setStatsError('');
    if (statsByProjectId[project.id]) return;
    setStatsLoadingProjectId(project.id);
    try {
      const summary = await loadProClickAnalytics({ projectId: project.id });
      setStatsByProjectId((current) => ({
        ...current,
        [project.id]: summary,
      }));
    } catch (error) {
      setStatsError(error?.message || 'Statistiques indisponibles.');
    } finally {
      setStatsLoadingProjectId('');
    }
  };

  return (
    <section className="panel profile-pro-panel" data-tour="profile-pro-section">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Espace Pro</span>
          <h2>Extensions d’expérience</h2>
          <p className="small-note">
            Une salle ne crée pas seulement un jeu : elle peut aussi gérer ce qui se passe avant et après la partie.
            Ces extensions sont des pages interactives légères reliées à un escape game existant, une campagne ou un
            scénario déjà en salle.
          </p>
        </div>
        <span className="status-badge soft">
          {extensionProjects.length} extension{extensionProjects.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="profile-pro-action-grid" data-tour="profile-pro-actions">
        <article className="profile-pro-action-card">
          <div className="profile-pro-action-copy">
            <div className="profile-pro-action-head">
              <Megaphone aria-hidden="true" size={18} />
              <div>
                <strong>Prologue / Épilogue</strong>
                <span>Avant et après la partie</span>
              </div>
            </div>
            <p>{proStoryAction.copy}</p>
          </div>
          <button
            type="button"
            className="profile-action-button"
            disabled={isBusy}
            onClick={() => onStartProPromotion?.({
              kind: proStoryAction.kind,
              title: getProPromotionConfig(proStoryAction.kind).title,
            })}
          >
            <Megaphone aria-hidden="true" size={17} />
            <span>{proStoryAction.buttonLabel}</span>
          </button>
        </article>

        {[proShowcaseAction].map(({ kind, icon: Icon, buttonLabel, copy }) => {
          const config = getProPromotionConfig(kind);
          return (
            <article key={kind} className="profile-pro-action-card">
              <div className="profile-pro-action-copy">
                <div className="profile-pro-action-head">
                  <Icon aria-hidden="true" size={18} />
                  <div>
                    <strong>{config.title}</strong>
                    <span>{config.intentLabel}</span>
                  </div>
                </div>
                <p>{copy}</p>
              </div>
              <button
                type="button"
                className="profile-action-button"
                disabled={isBusy}
                onClick={() => onStartProPromotion?.({ kind, title: config.title })}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{buttonLabel}</span>
              </button>
            </article>
          );
        })}
      </div>

      <div className="profile-pro-manager" data-tour="profile-pro-manager">
        <div className="profile-pro-manager-head">
          <div>
            <h3>Gérer les extensions</h3>
            <p className="small-note">Ouvrir, prévisualiser et partager les pages créées pour l’avant et l’après-jeu.</p>
          </div>
          <div className="profile-pro-manager-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une extension"
            />
            <select value={extensionFilter} onChange={(event) => setExtensionFilter(event.target.value)}>
              {extensionFilters.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="profile-pro-extension-list">
          {visibleProjects.length > 0 ? (
            visibleProjects.map((project) => (
              <ProfileProExtensionCard
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isBusy={isBusy}
                onCopyProjectLink={onCopyProjectLink}
                onDeleteProject={onDeleteProject}
                onDuplicateProject={onDuplicateProject}
                onOpenProject={onOpenProject}
                onOpenProjectStats={openStatsModal}
                onPublishProject={onPublishProject}
                onRenameProject={onRenameProject}
                onSaveProjectQrCode={onSaveProjectQrCode}
                onTestProject={onTestProject}
                onUnpublishProject={onUnpublishProject}
              />
            ))
          ) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucune extension dans ce filtre</strong>
                <p className="small-note">Crée une vitrine, un prologue ou un épilogue depuis les cartes ci-dessus.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <ProfileProStatsModal
        project={statsProject}
        stats={statsProject ? statsByProjectId[statsProject.id] : null}
        filter={statsFilter}
        isLoading={Boolean(statsProject?.id && statsLoadingProjectId === statsProject.id)}
        error={statsError}
        onClose={() => {
          setStatsProject(null);
          setStatsError('');
        }}
        onFilterChange={setStatsFilter}
      />
    </section>
  );
}
