import React, { useMemo, useState } from 'react';
import ProjectCard from './ProjectCard';
import { getProjectName } from '../../lib/projectAnalysis';

export default function ProjectList({
  projects,
  activeProjectId,
  syncStatus,
  onOpenProject,
  onTestProject,
  onRenameProject,
  onUpdateProjectMode,
  onDuplicateProject,
  onDeleteProject,
}) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('updated-desc');

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

  const projectColumns = useMemo(() => (
    visibleProjects.reduce(
      (columns, project, index) => {
        columns[index % 2].push(project);
        return columns;
      },
      [[], []],
    )
  ), [visibleProjects]);

  const renderProjectCard = (project) => (
    <ProjectCard
      key={project.id}
      project={project}
      isActive={project.id === activeProjectId}
      syncStatus={syncStatus}
      onOpenProject={onOpenProject}
      onTestProject={onTestProject}
      onRenameProject={onRenameProject}
      onUpdateProjectMode={onUpdateProjectMode}
      onDuplicateProject={onDuplicateProject}
      onDeleteProject={onDeleteProject}
    />
  );

  return (
    <section className="panel" data-tour="profile-projects-section">
      <div className="panel-head">
        <div>
          <h2>Gestion des projets</h2>
          <p className="small-note">Reprendre, tester, renommer, dupliquer ou supprimer.</p>
        </div>
        <span className="status-badge soft">
          {projects.length} projet{projects.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid-two small-gap" data-tour="profile-project-filters">
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

      <div className="profile-project-grid" data-tour="profile-project-list">
        {visibleProjects.length > 0 ? (
          <>
            <div className="profile-project-columns">
              {projectColumns.map((columnProjects, columnIndex) => (
                <div className="profile-project-column" key={columnIndex}>
                  {columnProjects.map(renderProjectCard)}
                </div>
              ))}
            </div>
            <div className="profile-project-list-mobile">
              {visibleProjects.map(renderProjectCard)}
            </div>
          </>
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
  );
}
