import React, { useRef, useState } from 'react';
import { CREATION_MODES } from '../../lib/projectAnalysis';
import { CREATION_TEMPLATES } from './profileUtils';

export default function CreateProjectPanel({
  isBusy,
  onCreateProject,
  onImportProject,
}) {
  const [newProjectName, setNewProjectName] = useState('');
  const [creationTemplate, setCreationTemplate] = useState('empty');
  const [creationMode, setCreationMode] = useState('beginner');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const handleCreate = async (event) => {
    event.preventDefault();
    const templateLabel = CREATION_TEMPLATES.find(([value]) => value === creationTemplate)?.[1] || 'Nouveau projet';
    await onCreateProject?.(newProjectName.trim() || templateLabel, creationTemplate, creationMode);
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
    <section className="panel" data-tour="profile-create-section">
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
          <div className="template-picker" id="creation-template" data-tour="profile-template-picker">
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
          <label htmlFor="creation-mode">Mode</label>
          <div className="template-picker" id="creation-mode">
            {CREATION_MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={creationMode === value ? 'selected' : ''}
                onClick={() => setCreationMode(value)}
                disabled={isBusy}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="submit" className="profile-action-button" disabled={isBusy} data-tour="profile-create-button">
            + Créer
          </button>
        </form>

        <div data-tour="profile-import-section">
          <label>Importer</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImport}
          />
          <button type="button" className="profile-action-button secondary-action" onClick={() => fileInputRef.current?.click()}>
            Importer un projet JSON
          </button>
          {importError ? <p className="auth-error">{importError}</p> : null}
        </div>
      </div>
    </section>
  );
}
