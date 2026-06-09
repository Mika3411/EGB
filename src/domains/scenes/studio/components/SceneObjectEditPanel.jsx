import { HelpLabel } from './SceneEditorChrome.jsx';
import MediaSourcePicker from '../../../../shared/ui/media/MediaSourcePicker.jsx';
import NumberInput from '../../../../shared/ui/forms/NumberInput.jsx';
import { showConfirm } from '../../../../shared/ui/AccessibleDialog';
import CompactAudioPreview from './CompactAudioPreview.jsx';
import { getProjectLinkOptions } from './HotspotActionFields.jsx';
import { isProPromotionProject } from '../../../../shared/services/proPromotion';
import { isProfessionalAccount } from '../../../../shared/services/accountPlans';
import {
  getSceneObjectBlockType,
  getSceneObjectBackgroundColor,
  getSceneObjectBackgroundOpacity,
  getSceneObjectClickMode,
  getSceneObjectFontFamilyValue,
  getSceneObjectFontSize,
  getSceneObjectTextColor,
  clampSceneObjectBackgroundOpacity,
  SCENE_OBJECT_BLOCK_TYPES,
  SCENE_OBJECT_FONT_FAMILY_OPTIONS,
} from '../../../../shared/services/sceneObjectBlocks';

export default function SceneObjectEditPanel({
  project,
  selectedSceneId,
  selectedSceneObject,
  selectedSceneObjectId,
  user = null,
  projectLibrary = [],
  activeProjectId = '',
  patchProject,
  renderShapeControls,
  handleUpload,
  mediaLibrary = [],
  importSceneObjectAnime2d,
  getSceneLabel,
  setSelectedSceneObjectId,
  deleteSceneObject,
  onSceneObjectDeleted,
  onOpenLogic,
}) {
  const clickMode = getSceneObjectClickMode(selectedSceneObject);
  const blockType = getSceneObjectBlockType(selectedSceneObject);
  const isBlockObject = blockType !== 'object';
  const isInvisibleObject = Boolean(selectedSceneObject.isInvisible);
  const isAnimationObject = Boolean(
    selectedSceneObject.anime2dSpec
    || selectedSceneObject.anime2dName
    || selectedSceneObject.name === 'Animation',
  );
  const isBeginnerMode = project?.creationMode === 'beginner';
  const isProPromotionMode = isProPromotionProject(project);
  const canUseProPages = isProfessionalAccount(user) || isProPromotionMode;
  const isProTextBlock = isProPromotionMode && blockType === 'text';
  const proTextActionOptions = [
    { value: 'none', label: 'Aucun' },
    { value: 'dialogue', label: 'Dialogue' },
    { value: 'external_link', label: 'Lien externe' },
    { value: 'project_link', label: 'Projet cible' },
  ];
  const proTextActionType = clickMode === 'none'
    ? 'none'
    : (
      proTextActionOptions.some((option) => option.value === selectedSceneObject.actionType)
        ? selectedSceneObject.actionType
        : 'dialogue'
    );
  const proTextProjectLinkOptions = getProjectLinkOptions(projectLibrary, activeProjectId, user);
  const selectedProTextProjectOption = selectedSceneObject.targetProjectId
    && !proTextProjectLinkOptions.some((option) => option.id === selectedSceneObject.targetProjectId)
    ? [{
      id: selectedSceneObject.targetProjectId,
      userId: selectedSceneObject.targetProjectUserId || user?.id || '',
      title: 'Projet sélectionné',
    }]
    : [];
  const displayedProTextProjectLinkOptions = [...selectedProTextProjectOption, ...proTextProjectLinkOptions];
  const canUseQuickLogic = !isProPromotionMode && !isBeginnerMode && project?.creationMode !== 'intermediate';
  const selectedActionType = isProPromotionMode && ['scene', 'dialogue_item'].includes(selectedSceneObject.actionType)
    ? 'dialogue'
    : selectedSceneObject.actionType || 'dialogue';
  const patchObject = (updater) => patchProject((draft) => {
    const obj = draft.scenes.find((scene) => scene.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId);
    if (obj) updater(obj);
  });
  const setVisibleObjectImage = (obj, data, name, asset = null) => {
    obj.imageData = data;
    obj.imageName = name;
    obj.imageId = asset?.id || '';
    obj.anime2dSpec = null;
    obj.anime2dName = '';
    obj.linkedItemId = '';
    obj.isInvisible = false;
  };
  const removeObject = async () => {
    const objectKind = isInvisibleObject ? 'invisible' : 'visible';
    const confirmed = await showConfirm({
      title: "Supprimer l'objet",
      message: `Supprimer l'objet ${objectKind} "${selectedSceneObject.name}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    if (deleteSceneObject) {
      deleteSceneObject(selectedSceneId, selectedSceneObjectId);
    } else {
      patchProject((draft) => {
        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
        if (!scene?.sceneObjects) return;
        scene.sceneObjects = scene.sceneObjects.filter((entry) => entry.id !== selectedSceneObjectId);
      });
      setSelectedSceneObjectId('');
    }
    onSceneObjectDeleted?.();
  };

  return (
    <div className="scene-object-inspector-card" data-tour="scene-object-panel">
      <HelpLabel help="Nom interne de cet element. Il aide au retrouver dans les calques et les listes de l'éditeur.">Nom</HelpLabel>
      <input value={selectedSceneObject.name} onChange={(event) => patchObject((obj) => { obj.name = event.target.value; })} />
      {!isBeginnerMode && !isProPromotionMode ? (
        <>
          <HelpLabel help="Type de bloc affiché dans la scène. Objet visible garde le comportement historique, les autres types ajoutent des blocs interactifs plus lisibles.">Type de bloc</HelpLabel>
          <select value={blockType} onChange={(event) => patchObject((obj) => {
            obj.blockType = event.target.value;
            if (event.target.value === 'object') return;
            obj.linkedItemId = '';
            obj.interactionMode = 'popup';
            obj.clickMode = ['text', 'image'].includes(event.target.value) ? 'none' : 'object';
            obj.blockLabel = obj.blockLabel || obj.name;
          })}>
            {SCENE_OBJECT_BLOCK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.value === 'object' && isInvisibleObject ? 'Objet invisible' : type.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <div className="scene-selection-geometry-grid" data-tour="scene-object-geometry">
        <div><HelpLabel help="Position horizontale du centre de l'objet, en pourcentage de la largeur de l'image.">X</HelpLabel><NumberInput value={selectedSceneObject.x} onValueChange={(nextValue) => patchObject((obj) => { obj.x = nextValue; })} /></div>
        <div><HelpLabel help="Position verticale du centre de l'objet, en pourcentage de la hauteur de l'image.">Y</HelpLabel><NumberInput value={selectedSceneObject.y} onValueChange={(nextValue) => patchObject((obj) => { obj.y = nextValue; })} /></div>
        <div><HelpLabel help="Largeur de l'image visible et, si active, de la zone cliquable.">Largeur</HelpLabel><NumberInput value={selectedSceneObject.width} onValueChange={(nextValue) => patchObject((obj) => { obj.width = nextValue; })} /></div>
        <div><HelpLabel help="Hauteur de l'image visible et, si active, de la zone cliquable.">Hauteur</HelpLabel><NumberInput value={selectedSceneObject.height} onValueChange={(nextValue) => patchObject((obj) => { obj.height = nextValue; })} /></div>
      </div>
      {renderShapeControls?.('sceneObject', selectedSceneObjectId)}
      {canUseQuickLogic && !isInvisibleObject ? (
        <button type="button" className="secondary-action full" onClick={onOpenLogic}>
          Logique
        </button>
      ) : null}

      {!isBeginnerMode && isBlockObject ? (
        <>
          {!isProTextBlock ? (
            <>
              <HelpLabel help="Libellé visible sur le bloc, par exemple le titre d'un indice, le texte du bouton ou le nom du champ.">Libellé du bloc</HelpLabel>
              <input value={selectedSceneObject.blockLabel || ''} onChange={(event) => patchObject((obj) => { obj.blockLabel = event.target.value; })} />
            </>
          ) : null}
          {blockType === 'hint' ? (
            <>
              <HelpLabel help="Texte affiché dans l'indice et repris comme dialogue au clic.">Texte</HelpLabel>
              <textarea value={selectedSceneObject.blockText || ''} onChange={(event) => patchObject((obj) => {
                obj.blockText = event.target.value;
                obj.dialogue = event.target.value;
              })} />
            </>
          ) : null}
          {blockType === 'button' ? (
            <>
              <HelpLabel help="Texte affiché dans le bouton joueur.">Texte du bouton</HelpLabel>
              <input value={selectedSceneObject.buttonLabel || ''} onChange={(event) => patchObject((obj) => { obj.buttonLabel = event.target.value; })} />
            </>
          ) : null}
          {['input', 'code'].includes(blockType) ? (
            <>
              <HelpLabel help="Texte indicatif prèsente au joueur avant la saisie.">Placeholder</HelpLabel>
              <input value={selectedSceneObject.placeholder || ''} onChange={(event) => patchObject((obj) => { obj.placeholder = event.target.value; })} />
              <HelpLabel help="Réponse attendue. La comparaison ignore les majuscules, accents et espaces superflus.">Réponse attendue</HelpLabel>
              <input value={selectedSceneObject.expectedAnswer || ''} onChange={(event) => patchObject((obj) => { obj.expectedAnswer = event.target.value; })} />
              <HelpLabel help="Message affiché si la réponse est correcte.">Message de réussite</HelpLabel>
              <textarea value={selectedSceneObject.successDialogue || ''} onChange={(event) => patchObject((obj) => { obj.successDialogue = event.target.value; })} />
              <HelpLabel help="Message affiché si la réponse est incorrecte.">Message d'échec</HelpLabel>
              <textarea value={selectedSceneObject.failureDialogue || ''} onChange={(event) => patchObject((obj) => { obj.failureDialogue = event.target.value; })} />
            </>
          ) : null}
          {!isProPromotionMode ? (
            <>
              <HelpLabel help="Comportement au clic. Action avancée utilise les mêmes réglages qu'une zone d'action classique.">Comportement</HelpLabel>
              <select value={clickMode} onChange={(event) => patchObject((obj) => { obj.clickMode = event.target.value; })}>
                <option value="none">Decoratif</option>
                <option value="object">Interaction simple</option>
                <option value="action">Action avancee</option>
              </select>
            </>
          ) : null}
          <div className="scene-text-style-grid">
            <div>
              <HelpLabel help="Taille du texte affiché dans le cadre du bloc.">Taille de police</HelpLabel>
              <NumberInput
                min="8"
                max="48"
                value={getSceneObjectFontSize(selectedSceneObject)}
                onValueChange={(nextValue) => patchObject((obj) => { obj.fontSize = nextValue; })}
              />
            </div>
            <div>
              <HelpLabel help="Police utilisée pour le texte affiché dans la scène.">Police</HelpLabel>
              <select
                data-tour="scene-object-font-family"
                value={getSceneObjectFontFamilyValue(selectedSceneObject)}
                onChange={(event) => patchObject((obj) => { obj.fontFamily = event.target.value; })}
              >
                {SCENE_OBJECT_FONT_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="scene-text-color-grid">
            <div>
              <HelpLabel help="Couleur de l'écriture affichée dans ce bloc.">Couleur texte</HelpLabel>
              <input
                type="color"
                className="scene-color-input"
                data-tour="scene-object-text-color"
                value={getSceneObjectTextColor(selectedSceneObject)}
                onChange={(event) => patchObject((obj) => { obj.textColor = event.target.value; })}
              />
            </div>
            <div>
              <HelpLabel help="Couleur du fond derrière le texte de ce bloc.">Couleur fond</HelpLabel>
              <input
                type="color"
                className="scene-color-input"
                data-tour="scene-object-background-color"
                value={getSceneObjectBackgroundColor(selectedSceneObject)}
                onChange={(event) => patchObject((obj) => { obj.backgroundColor = event.target.value; })}
              />
            </div>
            <div className="scene-text-opacity-field">
              <HelpLabel help="Opacité du fond du bloc. 0 rend le fond transparent, 100 le rend opaque.">Opacité fond</HelpLabel>
              <div className="scene-text-opacity-number">
                <NumberInput
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={getSceneObjectBackgroundOpacity(selectedSceneObject)}
                  onValueChange={(nextValue) => patchObject((obj) => {
                    obj.backgroundOpacity = clampSceneObjectBackgroundOpacity(nextValue);
                  })}
                />
                <span className="scene-text-opacity-unit">%</span>
              </div>
            </div>
          </div>
          {isProTextBlock ? (
            <>
              <HelpLabel help="Action déclenchée quand le joueur clique ce texte dans l'extension.">Action du texte</HelpLabel>
              <select
                data-tour="scene-object-pro-text-action"
                value={proTextActionType}
                onChange={(event) => patchObject((obj) => {
                  if (event.target.value === 'none') {
                    obj.clickMode = 'none';
                    obj.actionType = 'dialogue';
                    return;
                  }
                  obj.clickMode = 'action';
                  obj.actionType = event.target.value;
                })}
              >
                {proTextActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {['external_link', 'project_link'].includes(proTextActionType) ? (
                <>
                  <HelpLabel help="Nom utilisé dans les statistiques de clic. Exemple : Réserver une session, Accès prologue ou Voir l’épilogue. Laisse vide pour reprendre le texte visible.">Nom statistique</HelpLabel>
                  <input
                    data-tour="scene-object-analytics-label"
                    value={selectedSceneObject.analyticsLabel || ''}
                    placeholder={selectedSceneObject.buttonLabel || selectedSceneObject.blockText || selectedSceneObject.blockLabel || selectedSceneObject.name || 'Réserver une session'}
                    onChange={(event) => patchObject((obj) => {
                      obj.analyticsLabel = event.target.value;
                    })}
                  />
                </>
              ) : null}

              {proTextActionType === 'dialogue' ? (
                <>
                  <HelpLabel help="Texte affiché quand le joueur clique ce texte.">Dialogue au clic</HelpLabel>
                  <textarea
                    data-tour="scene-object-pro-text-dialogue"
                    value={selectedSceneObject.dialogue || ''}
                    onChange={(event) => patchObject((obj) => {
                      obj.clickMode = 'action';
                      obj.dialogue = event.target.value;
                    })}
                  />
                </>
              ) : null}

              {proTextActionType === 'external_link' ? (
                <>
                  <HelpLabel help="URL ouverte dans un nouvel onglet quand le joueur clique ce texte.">Lien externe</HelpLabel>
                  <input
                    data-tour="scene-object-pro-text-external-url"
                    type="url"
                    value={selectedSceneObject.externalUrl || ''}
                    placeholder="https://ton-site.fr/page"
                    onChange={(event) => patchObject((obj) => {
                      obj.clickMode = 'action';
                      obj.externalUrl = event.target.value;
                    })}
                  />
                </>
              ) : null}

              {proTextActionType === 'project_link' ? (
                <>
                  <HelpLabel help="Projet ouvert dans un nouvel onglet quand ce texte est cliqué.">Projet cible</HelpLabel>
                  <select
                    data-tour="scene-object-pro-text-target-project"
                    value={selectedSceneObject.targetProjectId || ''}
                    onChange={(event) => patchObject((obj) => {
                      const nextProject = displayedProTextProjectLinkOptions.find((option) => option.id === event.target.value);
                      obj.clickMode = 'action';
                      obj.targetProjectId = nextProject?.id || '';
                      obj.targetProjectUserId = nextProject?.userId || '';
                    })}
                  >
                    <option value="">Aucun projet</option>
                    {displayedProTextProjectLinkOptions.map((option) => (
                      <option key={`${option.userId || 'user'}-${option.id}`} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                  {!displayedProTextProjectLinkOptions.length ? (
                    <p className="small-note">Aucun autre projet disponible pour ce compte.</p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {!isInvisibleObject && !isAnimationObject && clickMode !== 'action' && blockType !== 'text' && blockType !== 'hint' && blockType !== 'button' && blockType !== 'input' && blockType !== 'code' ? (
        <MediaSourcePicker
          className="button like full secondary-action"
          accept="image/*"
          assetScope="object-image"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={(data, name, asset) => patchObject((obj) => setVisibleObjectImage(obj, data, name, asset))}
          tourId="scene-object-image"
        >
          {selectedSceneObject.imageName ? "Remplacer l'image visible" : 'Importer une image fixe'}
        </MediaSourcePicker>
      ) : null}
      {!isProTextBlock ? (
        <>
          <HelpLabel help={isAnimationObject ? "Son joué quand le joueur clique sur cette animation." : "Son joué quand le joueur clique sur cet objet."}>{isAnimationObject ? "Son de l'animation" : "Son de l'objet"}</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="audio/*"
            assetScope={isAnimationObject ? 'logic-sound' : 'object-sound'}
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={(data, name) => patchObject((obj) => {
              obj.soundData = data;
              obj.soundName = name;
              if (isAnimationObject) obj.clickMode = 'object';
            })}
          >
            {selectedSceneObject.soundName || 'Importer un son'}
          </MediaSourcePicker>
          {selectedSceneObject.soundData ? (
            <CompactAudioPreview
              src={selectedSceneObject.soundData}
              name={selectedSceneObject.soundName}
              onRemove={() => patchObject((obj) => {
                obj.soundData = '';
                obj.soundName = '';
              })}
            />
          ) : null}
        </>
      ) : null}
      {!isBeginnerMode && isAnimationObject ? (
        <>
          <HelpLabel help="JSON exporte depuis l'onglet Animation. Un JSON 2D Anime reste anime directement sur la scène.">Animation 2D</HelpLabel>
          <label className="button like full secondary-action">
            {selectedSceneObject.anime2dName ? 'Remplacer JSON 2D Anime' : 'Importer JSON 2D Anime'}
            <input type="file" accept="application/json,.json" hidden onChange={(event) => importSceneObjectAnime2d?.(event, selectedSceneObjectId)} />
          </label>
        </>
      ) : null}
      {!isInvisibleObject && (selectedSceneObject.imageData || selectedSceneObject.anime2dSpec) ? (
        <button
          type="button"
          className="danger-button"
          style={{ marginTop: 12 }}
          onClick={() => patchObject((obj) => {
            obj.imageData = '';
            obj.imageName = '';
            obj.anime2dSpec = null;
            obj.anime2dName = '';
          })}
        >
          Retirer l'image visible
        </button>
      ) : null}

      {clickMode === 'object' && !isAnimationObject && !isBlockObject ? (
        <>
          <HelpLabel help="Définit ce qui se passe au clic : montrer un pop-up, ajouter l'objet lié à l'inventaire, ou faire les deux.">Mode d'interaction</HelpLabel>
          <select data-tour="scene-object-interaction" value={selectedSceneObject.interactionMode || 'popup'} onChange={(event) => patchObject((obj) => { obj.interactionMode = event.target.value; })}>
            <option value="popup">Pop-up uniquement</option>
            <option value="inventory">Inventaire uniquement</option>
            <option value="both">Pop-up + inventaire</option>
          </select>
          <HelpLabel help="Objet ajouté à l'inventaire si le mode inclut l'inventaire. Sans sélection, le clic ne donne aucun objet.">Objet d'inventaire lié</HelpLabel>
          <select data-tour="scene-object-linked-item" value={selectedSceneObject.linkedItemId || ''} onChange={(event) => patchObject((obj) => {
            obj.linkedItemId = event.target.value;
            obj.imageData = '';
            obj.imageName = '';
            obj.popupImage = '';
            obj.popupImageName = '';
            obj.anime2dSpec = null;
            obj.anime2dName = '';
          })}>
            <option value="">Aucun</option>
            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
          <HelpLabel help="Texte affiché quand le joueur interagit avec cet objet visible.">Dialogue</HelpLabel>
          <textarea data-tour="scene-object-dialogue" value={selectedSceneObject.dialogue || ''} onChange={(event) => patchObject((obj) => { obj.dialogue = event.target.value; })} />
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(selectedSceneObject.removeAfterUse)} onChange={(event) => patchObject((obj) => { obj.removeAfterUse = event.target.checked; })} />
            Retirer l'objet visible après interaction
          </label>
          <p className="small-note help-inline-note">Quand c'est active, l'objet disparait de la scène après son utilisation réussie.</p>
        </>
      ) : null}

      {clickMode === 'action' && !isProTextBlock ? (
        <>
          <HelpLabel help="Action principale déclénchée par cette image après validation des prerequis eventuels.">Action</HelpLabel>
          <select value={selectedActionType} onChange={(event) => patchObject((obj) => { obj.actionType = event.target.value; })}>
            <option value="dialogue">Dialogue</option>
            {!isProPromotionMode ? <option value="dialogue_item">Dialogue + objet</option> : null}
            {!isProPromotionMode ? <option value="scene">Changer de scène</option> : null}
            <option value="cinematic">Lancer une cinématique</option>
            {canUseProPages ? <option value="project_link">Projet cible</option> : null}
          </select>
          {selectedActionType !== 'project_link' ? (
            <>
              <HelpLabel help="Texte affiché lors de l'interaction principale.">Dialogue</HelpLabel>
              <textarea value={selectedSceneObject.dialogue || ''} onChange={(event) => patchObject((obj) => { obj.dialogue = event.target.value; })} />
            </>
          ) : null}
          <HelpLabel help="Objet requis pour utiliser cette image-zone.">Objet requis</HelpLabel>
          <select value={selectedSceneObject.requiredItemId || ''} onChange={(event) => patchObject((obj) => { obj.requiredItemId = event.target.value; })}>
            <option value="">Aucun</option>
            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(selectedSceneObject.consumeRequiredItemOnUse)} onChange={(event) => patchObject((obj) => { obj.consumeRequiredItemOnUse = event.target.checked; })} />
            Consommer l'objet requis
          </label>
          {!isProPromotionMode ? (
            <>
              <HelpLabel help="Objet donné au joueur si l'action réussit.">Objet donné</HelpLabel>
              <select value={selectedSceneObject.rewardItemId || ''} onChange={(event) => patchObject((obj) => { obj.rewardItemId = event.target.value; })}>
                <option value="">Aucun</option>
                {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
              </select>
            </>
          ) : null}
          {!isProPromotionMode ? (
            <>
              <HelpLabel help="Destination utilisée si l'action est Changer de scène.">Scène cible</HelpLabel>
              <select value={selectedSceneObject.targetSceneId || ''} onChange={(event) => patchObject((obj) => { obj.targetSceneId = event.target.value; })}>
                <option value="">Aucune</option>
                {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
              </select>
            </>
          ) : null}
          {canUseProPages && selectedActionType === 'project_link' ? (
            <>
              <HelpLabel help="Projet ouvert dans un nouvel onglet quand cette image-zone est cliquée.">Projet cible</HelpLabel>
              <select
                data-tour="scene-object-target-pro-page"
                value={selectedSceneObject.targetProjectId || ''}
                onChange={(event) => patchObject((obj) => {
                  const nextProject = displayedProTextProjectLinkOptions.find((option) => option.id === event.target.value);
                  obj.targetProjectId = nextProject?.id || '';
                  obj.targetProjectUserId = nextProject?.userId || '';
                })}
              >
                <option value="">Aucun projet</option>
                {displayedProTextProjectLinkOptions.map((option) => (
                  <option key={`${option.userId || 'user'}-${option.id}`} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
              {!displayedProTextProjectLinkOptions.length ? (
                <p className="small-note">Aucun autre projet disponible pour ce compte.</p>
              ) : null}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(selectedSceneObject.accessCodeEnabled)}
                  onChange={(event) => patchObject((obj) => { obj.accessCodeEnabled = event.target.checked; })}
                />
                Bloquer l'accès par code
              </label>
              {selectedSceneObject.accessCodeEnabled ? (
                <>
                  <HelpLabel help="Code demandé au joueur avant d'ouvrir le projet cible.">Code d'accès</HelpLabel>
                  <input
                    data-tour="scene-object-access-code"
                    type="password"
                    value={selectedSceneObject.accessCode || ''}
                    placeholder="Mot de passe"
                    onChange={(event) => patchObject((obj) => { obj.accessCode = event.target.value; })}
                  />
                </>
              ) : null}
            </>
          ) : null}
          <HelpLabel help="Cinématique lancée après l'interaction réussie.">Cinématique cible</HelpLabel>
          <select value={selectedSceneObject.targetCinematicId || ''} onChange={(event) => patchObject((obj) => { obj.targetCinematicId = event.target.value; })}>
            <option value="">Aucune</option>
            {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
          <HelpLabel help="Énigme a résoudre avant d'executer l'action.">Énigme liée</HelpLabel>
          <select value={selectedSceneObject.enigmaId || ''} onChange={(event) => patchObject((obj) => { obj.enigmaId = event.target.value; })}>
            <option value="">Aucune</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
          <HelpLabel help="Son joué au moment ou cette image-zone est utilisée.">Son de la zone</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="audio/*"
            assetScope="object-sound"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={(data, name) => patchObject((obj) => {
              obj.soundData = data;
              obj.soundName = name;
            })}
          >
            {selectedSceneObject.soundName || 'Importer un son unique'}
          </MediaSourcePicker>
          {selectedSceneObject.soundData ? (
            <CompactAudioPreview
              src={selectedSceneObject.soundData}
              name={selectedSceneObject.soundName}
              onRemove={() => patchObject((obj) => {
                obj.soundData = '';
                obj.soundName = '';
              })}
            />
          ) : null}
          <HelpLabel help="Image visible sur la scène pour cette zone action.">Image de la zone</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="image/*"
            assetScope="object-image"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
          onSelect={(data, name, asset) => patchObject((obj) => setVisibleObjectImage(obj, data, name, asset))}
            tourId="scene-object-image"
          >
            {selectedSceneObject.imageName ? "Remplacer l'image" : 'Importer une image'}
          </MediaSourcePicker>
          <HelpLabel help="Image affichée en pop-up quand cette action réussit.">Image pop-up</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="image/*"
            assetScope="object-image"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={(data, name) => patchObject((obj) => {
              obj.objectImageData = data;
              obj.objectImageName = name;
            })}
          >
            {selectedSceneObject.objectImageName ? "Remplacer l'image pop-up" : 'Importer une image pop-up'}
          </MediaSourcePicker>
          {selectedSceneObject.objectImageData ? (
            <button type="button" className="danger-button" style={{ marginTop: 12 }} onClick={() => patchObject((obj) => {
              obj.objectImageData = '';
              obj.objectImageName = '';
            })}>
              Supprimer l'image pop-up
            </button>
          ) : null}
        </>
      ) : null}

      {clickMode === 'none' ? (
        <p className="small-note help-inline-note">Cette image reste visible dans la scène, mais aucun clic joueur ne déclénche d'action.</p>
      ) : null}

      <button type="button" className="danger-button" style={{ marginTop: 12 }} onClick={removeObject}>
        {isAnimationObject ? "Supprimer l'animation" : `Supprimer l'objet ${isInvisibleObject ? 'invisible' : 'visible'}`}
      </button>
    </div>
  );
}
