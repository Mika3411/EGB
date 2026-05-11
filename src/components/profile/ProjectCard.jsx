import React, { useState } from 'react';
import { showConfirm } from '../AccessibleDialog';
import { formatDate } from './profileUtils';
import {
  getAvailableUpgradeModes,
  getProjectCompletion,
  getProjectModeLabel,
  getProjectName,
  getProjectStats,
} from '../../lib/projectAnalysis';

export default function ProjectCard({
  project,
  isActive,
  syncStatus = 'offline',
  onOpenProject,
  onTestProject,
  onRenameProject,
  onUpdateProjectMode,
  onDuplicateProject,
  onDeleteProject,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(getProjectName(project));
  const stats = getProjectStats(project);
  const completion = getProjectCompletion(project);
  const upgradeModes = getAvailableUpgradeModes(project);

  const submitRename = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    await onRenameProject?.(project.id, nextName);
    setIsRenaming(false);
  };

  const handleDelete = () => {
    const label = getProjectName(project);
    onDeleteProject?.(project.id, label);
  };

  const handleModeUpgrade = async (nextMode, nextLabel) => {
    const confirmed = await showConfirm({
      title: 'Changer de mode',
      message: `Passer ce projet en mode ${nextLabel} ? Cette évolution est irréversible : tu ne pourras pas revenir à un mode inférieur ensuite.`,
      confirmLabel: 'Changer',
    });
    if (confirmed) onUpdateProjectMode?.(project.id, nextMode);
  };

  const galleryThumbnail = project.shareState?.galleryThumbnail || project.thumbnail;
  const projectName = getProjectName(project);
  const placeholderInitial = projectName.trim().charAt(0).toUpperCase() || 'P';
  const syncLabel = syncStatus === 'syncing' ? 'Synchronisation...' : syncStatus === 'synced' ? 'Synchronisé' : 'Hors ligne';
  const syncIcon = syncStatus === 'syncing' ? '⏳' : syncStatus === 'synced' ? '☁' : '⚠';

  return (
    <article className={`list-card ${isActive ? 'selected' : ''}`} data-tour="profile-project-card">
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

            <div className="toolbar" data-tour="profile-project-actions">
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
            Mode {getProjectModeLabel(project)} · {stats.scenes} scène{stats.scenes > 1 ? 's' : ''} · {stats.enigmas} énigme{stats.enigmas > 1 ? 's' : ''} ·{' '}
            {stats.cinematics} cinématique{stats.cinematics > 1 ? 's' : ''}
          </p>

          {upgradeModes.length > 0 ? (
            <div className="project-mode-upgrade">
              <span>Faire évoluer ce projet</span>
              <div className="toolbar">
                {upgradeModes.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="secondary-action"
                    onClick={() => handleModeUpgrade(value, label)}
                  >
                    Passer en {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="project-completion-box" aria-label="Indicateur de complétion">
            <div className="project-completion-row ok">
              <span aria-hidden="true">✓</span>
              <strong>{completion.scenes}</strong>
              <em>scène{completion.scenes > 1 ? 's' : ''}</em>
            </div>
            <div className={`project-completion-row ${completion.unlinkedHotspots ? 'warn' : 'ok'}`}>
              <span aria-hidden="true">{completion.unlinkedHotspots ? '⚠' : '✓'}</span>
              <strong>{completion.unlinkedHotspots}</strong>
              <em>hotspot{completion.unlinkedHotspots > 1 ? 's' : ''} non relié{completion.unlinkedHotspots > 1 ? 's' : ''}</em>
            </div>
            <div className={`project-completion-row ${completion.enigmasWithoutSolution ? 'danger' : 'ok'}`}>
              <span aria-hidden="true">{completion.enigmasWithoutSolution ? '✕' : '✓'}</span>
              <strong>{completion.enigmasWithoutSolution}</strong>
              <em>énigme{completion.enigmasWithoutSolution > 1 ? 's' : ''} sans solution</em>
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
          </div>
        </div>
      </div>
    </article>
  );
}
