import React, { useRef, useState } from 'react';
import { BookOpen, ListChecks } from 'lucide-react';
import HelpLabel, { positionHelpBubble } from '../../../shared/ui/forms/HelpLabel';
import { CREATION_MODES } from '../../../shared/services/projectAnalysis';
import { PRO_PROMOTION_PROJECT_MODE } from '../../../shared/services/proPromotion';
import { CREATION_TEMPLATES } from './profileUtils';

const ADVENTURE_TEMPLATE_IDS = new Set([
  'book_hero',
  'adventure_choices',
  'hero_adventure',
  'narrative_investigation',
  'magic_forest',
  'survival_choices',
  'npc_dialogue',
  'negotiation',
  'narrative_maze',
]);

const CREATION_MODE_HELPS = {
  beginner: "Mode le plus simple : scènes, médias et interactions essentielles. Idéal pour démarrer vite sans trop d'outils.",
  intermediate: "Ajoute plus d'options de construction tout en gardant une interface lisible pour un projet plus complet.",
  expert: "Débloque toute la construction classique : logique avancée, combinaisons, énigmes, cinématiques, publication et bilan.",
  adventure: "Expert + : pensé pour les narrations à choix multiples avec branches narratives, variables, choix cachés et fins.",
  hero_adventure: "Expert ++ : ajoute les outils d'aventure de héros avec fiche personnage, PV, mana, compétences, jets et combats.",
};

const PROFILE_CREATION_MODES = CREATION_MODES.filter(([value]) => value !== PRO_PROMOTION_PROJECT_MODE);

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

  const handleCreate = async (event, options = {}) => {
    event.preventDefault();
    const templateLabel = CREATION_TEMPLATES.find(([value]) => value === creationTemplate)?.[1] || 'Nouveau projet';
    const effectiveCreationMode = creationTemplate === 'hero_adventure' || creationTemplate === 'book_hero'
      ? 'hero_adventure'
      : ADVENTURE_TEMPLATE_IDS.has(creationTemplate) ? 'adventure' : creationMode;
    await onCreateProject?.(newProjectName.trim() || templateLabel, creationTemplate, effectiveCreationMode, options);
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
        <form onSubmit={(event) => handleCreate(event)}>
          <div className="profile-create-name-row">
            <div className="profile-create-name-field">
              <HelpLabel help="Nom visible dans ton profil et dans l'éditeur. Tu peux le modifier plus tard depuis la gestion des projets.">Nouveau projet</HelpLabel>
              <input
                id="new-project-name"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Nom du jeu"
                disabled={isBusy}
              />
            </div>
            <div className="profile-import-block" data-tour="profile-import-section">
              <HelpLabel help="Recharge un projet exporté en JSON. L'import crée ou remplace le projet selon le flux choisi dans ton profil.">Importer</HelpLabel>
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
          <div className="profile-create-mode-block" data-tour="profile-mode-picker">
            <HelpLabel help="Débutant affiche l'essentiel. Intermédiaire ajoute plus d'outils. Expert débloque toute la construction classique. Narration à choix multiples correspond à Expert +. Aventure de héros correspond à Expert ++. Tu peux commencer en Débutant puis améliorer le projet plus tard dans la gestion des projets.">Mode de création</HelpLabel>
            <div className="profile-mode-picker" id="creation-mode">
              {PROFILE_CREATION_MODES.map(([value, label]) => (
                <div key={value} className="profile-mode-option">
                  <button
                    type="button"
                    className={creationMode === value ? 'selected' : ''}
                    onClick={() => setCreationMode(value)}
                    disabled={isBusy}
                  >
                    {label}
                  </button>
                  <span
                    className="help-dot profile-mode-help"
                    data-help={CREATION_MODE_HELPS[value]}
                    aria-label={CREATION_MODE_HELPS[value]}
                    tabIndex={0}
                    onMouseEnter={positionHelpBubble}
                    onFocus={positionHelpBubble}
                  >
                    ?
                  </span>
                </div>
              ))}
            </div>
            <p className="small-note">Tu peux commencer en Débutant pour aller vite, puis upgrader le projet plus tard depuis la gestion des projets.</p>
          </div>
          <div className="profile-create-template-block">
            <HelpLabel help="Point de départ du projet. Certains templates narratifs activent automatiquement un mode avancé adapté à leur structure.">Template de départ</HelpLabel>
            <div className="template-picker profile-template-picker" id="creation-template" data-tour="profile-template-picker">
              {CREATION_TEMPLATES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={creationTemplate === value ? 'selected' : ''}
                  onClick={() => {
                    setCreationTemplate(value);
                    if (value === 'hero_adventure' || value === 'book_hero') setCreationMode('hero_adventure');
                    else if (ADVENTURE_TEMPLATE_IDS.has(value)) setCreationMode('adventure');
                  }}
                  disabled={isBusy}
                  title={
                    value === 'adventure'
                      ? 'Expert + : ajoute la structure narration à choix multiples.'
                      : value === 'hero_adventure'
                        ? "Expert ++ : ajoute les outils d'aventure de héros."
                        : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-create-actions">
            <button type="submit" className="profile-action-button" disabled={isBusy} data-tour="profile-create-button">
              + Créer
            </button>
            <button
              type="button"
              className="profile-action-button secondary-action"
              disabled={isBusy}
              onClick={(event) => handleCreate(event, { startCreationGuide: true })}
              data-tour="profile-guided-create-button"
            >
              <ListChecks aria-hidden="true" size={17} />
              <span>Créer avec aide guidée</span>
            </button>
          </div>
        </form>

        <div className="profile-create-side">
          <aside className="profile-builder-overview-card" aria-labelledby="classic-builder-overview-title">
            <div className="profile-builder-overview-head">
              <BookOpen aria-hidden="true" size={18} />
              <div>
                <span className="section-kicker">Builder classique</span>
                <h3 id="classic-builder-overview-title">Créer un escape game en scènes</h3>
              </div>
            </div>
            <p>
              Construis une aventure 2D avec des lieux illustrés, objets cliquables, inventaire, énigmes, dialogues, cinématiques et règles logiques.
            </p>
            <ul>
              <li>Structure le parcours avec Scènes, Plan et Narration.</li>
              <li>Ajoute médias, sons, objets, combinaisons et zones d'action.</li>
              <li>Teste dans Preview, corrige avec Bilan, puis exporte ou publie.</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
