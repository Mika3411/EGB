import React, { useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  Gift,
  Megaphone,
  Pencil,
  QrCode,
  Trash2,
} from 'lucide-react';
import { getProjectName, getProjectStats } from '../../../shared/services/projectAnalysis';
import {
  getProPromotionConfig,
  getProPromotionProjectKind,
  isProPromotionProject,
} from '../../../shared/services/proPromotion';
import { formatDate } from './profileUtils';

const proActions = [
  {
    kind: 'promote',
    icon: Megaphone,
    buttonLabel: 'Promouvoir',
    copy: 'Démarrer une extension à placer avant la venue des joueurs : teaser, prologue, dossier d’enquête ou opération spéciale.',
  },
  {
    kind: 'extend',
    icon: Gift,
    buttonLabel: 'Prolonger',
    copy: 'Démarrer une extension à placer après la partie : épilogue, bonus, remerciements ou fidélisation.',
  },
];

const extensionFormats = [
  ['Prologue', 'Prépare les joueurs avant leur venue.'],
  ['Dossier d’enquête', 'Distribue des indices avant la réservation.'],
  ['Campagne', 'Anime un événement ou une opération spéciale.'],
  ['Épilogue', 'Prolonge l’aventure après la partie.'],
];

const extensionFilters = [
  ['all', 'Toutes les extensions'],
  ['promote', 'Avant la partie'],
  ['extend', 'Après la partie'],
];

function ProfileProExtensionCard({
  project,
  isActive = false,
  isBusy = false,
  onCopyProjectLink,
  onDeleteProject,
  onDuplicateProject,
  onOpenProject,
  onRenameProject,
  onSaveProjectQrCode,
  onTestProject,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(getProjectName(project));
  const kind = getProPromotionProjectKind(project);
  const config = getProPromotionConfig(kind);
  const projectName = getProjectName(project);
  const stats = getProjectStats(project);
  const Icon = kind === 'extend' ? Gift : Megaphone;

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
  projects = [],
  onCopyProjectLink,
  onDeleteProject,
  onDuplicateProject,
  onOpenProject,
  onRenameProject,
  onSaveProjectQrCode,
  onStartProPromotion,
  onTestProject,
}) {
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [search, setSearch] = useState('');

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
      return !query || getProjectName(project).toLowerCase().includes(query);
    });
  }, [extensionFilter, extensionProjects, search]);

  const summary = useMemo(() => (
    extensionProjects.reduce((totals, project) => {
      const kind = getProPromotionProjectKind(project);
      return {
        ...totals,
        [kind]: (totals[kind] || 0) + 1,
      };
    }, { promote: 0, extend: 0 })
  ), [extensionProjects]);

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

      <div className="profile-pro-intro">
        <strong>Avant et après le jeu</strong>
        <p>
          Une extension d’expérience sert à préparer, teaser, remercier ou prolonger l’aventure. Elle va droit au but :
          scènes, médias, quelques interactions, aperçu joueur et lien rapide. Le plan, les énigmes complexes,
          l’inventaire complet et le graphe de validation restent hors de ce mode.
        </p>
      </div>

      <div className="profile-pro-format-list" aria-label="Formats d’extension possibles" data-tour="profile-pro-formats">
        {extensionFormats.map(([label, description]) => (
          <div key={label} className="profile-pro-format-item">
            <strong>{label}</strong>
            <span>{description}</span>
          </div>
        ))}
      </div>

      <div className="profile-pro-action-grid" data-tour="profile-pro-actions">
        {proActions.map(({ kind, icon: Icon, buttonLabel, copy }) => {
          const config = getProPromotionConfig(kind);
          return (
            <article key={kind} className="profile-pro-action-card">
              <div className="profile-pro-action-head">
                <Icon aria-hidden="true" size={18} />
                <div>
                  <strong>{config.title}</strong>
                  <span>{config.intentLabel}</span>
                </div>
              </div>
              <p>{copy}</p>
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
          <div className="profile-pro-summary" aria-label="Synthèse des extensions">
            <span><strong>{summary.promote}</strong> avant</span>
            <span><strong>{summary.extend}</strong> après</span>
          </div>
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
                onRenameProject={onRenameProject}
                onSaveProjectQrCode={onSaveProjectQrCode}
                onTestProject={onTestProject}
              />
            ))
          ) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucune extension dans ce filtre</strong>
                <p className="small-note">Crée une promotion ou un prolongement depuis les cartes ci-dessus.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
