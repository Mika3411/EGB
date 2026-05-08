import { HelpLabel } from './SceneEditorChrome.jsx';
import MediaSourcePicker from '../MediaSourcePicker.jsx';

export const SCENE_OBJECT_BLOCK_TYPES = [
  { value: 'object', label: 'Objet visible' },
  { value: 'text', label: 'Texte' },
  { value: 'image', label: 'Image' },
  { value: 'button', label: 'Bouton' },
  { value: 'input', label: 'Champ de saisie' },
  { value: 'code', label: 'Code' },
  { value: 'hint', label: 'Indice' },
];

export const getSceneObjectBlockType = (obj) => (
  SCENE_OBJECT_BLOCK_TYPES.some((type) => type.value === obj?.blockType) ? obj.blockType : 'object'
);

export const getSceneObjectFontSize = (obj) => {
  const value = Number(obj?.fontSize);
  return Number.isFinite(value) ? Math.max(8, Math.min(48, value)) : 13;
};

export const getSceneObjectClickMode = (obj) => {
  if (!obj) return 'object';
  if (obj.clickMode) return obj.clickMode;
  if (obj.isClickable === false) return 'none';
  return 'object';
};

export function SceneObjectBlockContent({ object, displayImage = '', linkedItem = null }) {
  const blockType = getSceneObjectBlockType(object);
  const title = object.blockLabel || object.name || linkedItem?.name || 'Bloc';
  const text = object.blockText || object.dialogue || title;

  const blockStyle = { fontSize: `${getSceneObjectFontSize(object)}px` };

  if (blockType === 'text') {
    return <span className="interactive-block interactive-block--text" style={blockStyle}>{text}</span>;
  }
  if (blockType === 'hint') {
    return (
      <span className="interactive-block interactive-block--hint" style={blockStyle}>
        <strong>{title || 'Indice'}</strong>
        <small>{text || 'Un indice est disponible.'}</small>
      </span>
    );
  }
  if (blockType === 'button') {
    return <span className="interactive-block interactive-block--button" style={blockStyle}>{object.buttonLabel || title || 'Bouton'}</span>;
  }
  if (blockType === 'input') {
    return (
      <span className="interactive-block interactive-block--field" style={blockStyle}>
        <strong>{title || 'Réponse'}</strong>
        <small>{object.placeholder || 'Saisir une réponse...'}</small>
      </span>
    );
  }
  if (blockType === 'code') {
    const slots = Math.max(3, Math.min(8, String(object.expectedAnswer || '0000').length || 4));
    return (
      <span className="interactive-block interactive-block--code" style={blockStyle}>
        <strong>{title || 'Code'}</strong>
        <span>{Array.from({ length: slots }, () => '•').join(' ')}</span>
      </span>
    );
  }
  if (blockType === 'image' && !displayImage) {
    return <span className="interactive-block interactive-block--image" style={blockStyle}>{title || 'Image'}</span>;
  }
  if (displayImage) return <img src={displayImage} alt={title} />;
  return <span>{object.isInvisible ? `${object.name || 'Objet'} (invisible)` : title}</span>;
}

export default function SceneObjectInspector({
  project,
  selectedSceneId,
  selectedSceneObject,
  selectedSceneObjectId,
  patchProject,
  renderShapeControls,
  handleUpload,
  mediaLibrary = [],
  importSceneObjectAnime2d,
  getSceneLabel,
  setSelectedSceneObjectId,
  onOpenLogic,
}) {
  const clickMode = getSceneObjectClickMode(selectedSceneObject);
  const blockType = getSceneObjectBlockType(selectedSceneObject);
  const isBlockObject = blockType !== 'object';
  const isAnimationObject = Boolean(
    selectedSceneObject.anime2dSpec
    || selectedSceneObject.anime2dName
    || selectedSceneObject.name === 'Animation',
  );
  const patchObject = (updater) => patchProject((draft) => {
    const obj = draft.scenes.find((scene) => scene.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId);
    if (obj) updater(obj);
  });
  const removeObject = () => {
    if (!window.confirm(`Supprimer l'objet visible "${selectedSceneObject.name}" ?`)) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene?.sceneObjects) return;
      scene.sceneObjects = scene.sceneObjects.filter((entry) => entry.id !== selectedSceneObjectId);
    });
    setSelectedSceneObjectId('');
  };

  return (
    <>
      <HelpLabel help="Nom interne de cet element. Il aide au retrouver dans les calques et les listes de l'éditeur.">Nom</HelpLabel>
      <input value={selectedSceneObject.name} onChange={(event) => patchObject((obj) => { obj.name = event.target.value; })} />
      <HelpLabel help="Type de bloc affiché dans la scene. Objet visible garde le comportement historique, les autres types ajoutent des blocs interactifs plus lisibles.">Type de bloc</HelpLabel>
      <select value={blockType} onChange={(event) => patchObject((obj) => {
        obj.blockType = event.target.value;
        if (event.target.value === 'object') return;
        obj.linkedItemId = '';
        obj.interactionMode = 'popup';
        obj.clickMode = ['text', 'image'].includes(event.target.value) ? 'none' : 'object';
        obj.blockLabel = obj.blockLabel || obj.name;
      })}>
        {SCENE_OBJECT_BLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
      <div className="grid-two small-gap">
        <div><HelpLabel help="Position horizontale du centre de l'objet, en pourcentage de la largeur de l'image.">X</HelpLabel><input type="number" value={selectedSceneObject.x} onChange={(event) => patchObject((obj) => { obj.x = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Position verticale du centre de l'objet, en pourcentage de la hauteur de l'image.">Y</HelpLabel><input type="number" value={selectedSceneObject.y} onChange={(event) => patchObject((obj) => { obj.y = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Largeur de l'image visible et, si active, de la zone cliquable.">Largeur</HelpLabel><input type="number" value={selectedSceneObject.width} onChange={(event) => patchObject((obj) => { obj.width = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Hauteur de l'image visible et, si active, de la zone cliquable.">Hauteur</HelpLabel><input type="number" value={selectedSceneObject.height} onChange={(event) => patchObject((obj) => { obj.height = Number(event.target.value); })} /></div>
      </div>
      {renderShapeControls?.('sceneObject', selectedSceneObjectId)}
      <button type="button" className="secondary-action full" onClick={onOpenLogic}>
        Logique
      </button>

      {isBlockObject ? (
        <>
          <HelpLabel help="Libelle visible sur le bloc, par exemple le titre d'un indice, le texte du bouton ou le nom du champ.">Libelle du bloc</HelpLabel>
          <input value={selectedSceneObject.blockLabel || ''} onChange={(event) => patchObject((obj) => { obj.blockLabel = event.target.value; })} />
          {['text', 'hint'].includes(blockType) ? (
            <>
              <HelpLabel help="Texte affiché directement dans la scene. Pour un indice, il apparait dans le bloc et peut aussi être repris comme dialogue au clic.">Texte</HelpLabel>
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
              <HelpLabel help="Reponse attendue. La comparaison ignore les majuscules, accents et espaces superflus.">Reponse attendue</HelpLabel>
              <input value={selectedSceneObject.expectedAnswer || ''} onChange={(event) => patchObject((obj) => { obj.expectedAnswer = event.target.value; })} />
              <HelpLabel help="Message affiché si la réponse est correcte.">Message de réussite</HelpLabel>
              <textarea value={selectedSceneObject.successDialogue || ''} onChange={(event) => patchObject((obj) => { obj.successDialogue = event.target.value; })} />
              <HelpLabel help="Message affiché si la réponse est incorrecte.">Message d'échec</HelpLabel>
              <textarea value={selectedSceneObject.failureDialogue || ''} onChange={(event) => patchObject((obj) => { obj.failureDialogue = event.target.value; })} />
            </>
          ) : null}
          <HelpLabel help="Comportement au clic. Action avancee utilise les mêmes réglages qu'une zone d'action classique.">Comportement</HelpLabel>
          <select value={clickMode} onChange={(event) => patchObject((obj) => { obj.clickMode = event.target.value; })}>
            <option value="none">Decoratif</option>
            <option value="object">Interaction simple</option>
            <option value="action">Action avancee</option>
          </select>
          <HelpLabel help="Taille du texte affiché dans le cadre du bloc.">Taille de police</HelpLabel>
          <input
            type="number"
            min="8"
            max="48"
            value={getSceneObjectFontSize(selectedSceneObject)}
            onChange={(event) => patchObject((obj) => { obj.fontSize = Number(event.target.value); })}
          />
        </>
      ) : null}

      {!isAnimationObject && blockType !== 'text' && blockType !== 'hint' && blockType !== 'button' && blockType !== 'input' && blockType !== 'code' ? (
        <MediaSourcePicker
          className="button like full secondary-action"
          accept="image/*"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={(data, name) => patchObject((obj) => {
            obj.imageData = data;
            obj.imageName = name;
            obj.anime2dSpec = null;
            obj.anime2dName = '';
            obj.linkedItemId = '';
            obj.isInvisible = false;
          })}
        >
          {selectedSceneObject.imageName || 'Importer une image fixe'}
        </MediaSourcePicker>
      ) : null}
      <HelpLabel help={isAnimationObject ? "Son joué quand le joueur clique sur cette animation." : "Son joué quand le joueur clique sur cet objet."}>{isAnimationObject ? "Son de l'animation" : "Son de l'objet"}</HelpLabel>
      <MediaSourcePicker
        className="button like full secondary-action"
        accept="audio/*"
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
        <div className="hotspot-audio-compact">
          <audio controls preload="metadata" src={selectedSceneObject.soundData} />
          <button type="button" className="danger-button" onClick={() => patchObject((obj) => {
            obj.soundData = '';
            obj.soundName = '';
          })}>
            Supprimer
          </button>
        </div>
      ) : null}
      {isAnimationObject ? (
        <>
          <HelpLabel help="JSON exporte depuis l'onglet Animation. Un JSON 2D Anime reste anime directement sur la scene.">Animation 2D</HelpLabel>
          <label className="button like full secondary-action">
            {selectedSceneObject.anime2dName ? 'Remplacer JSON 2D Anime' : 'Importer JSON 2D Anime'}
            <input type="file" accept="application/json,.json" hidden onChange={(event) => importSceneObjectAnime2d?.(event, selectedSceneObjectId)} />
          </label>
        </>
      ) : null}
      {(selectedSceneObject.imageData || selectedSceneObject.anime2dSpec) ? (
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
          <HelpLabel help="Definit ce qui se passe au clic : montrer un pop-up, ajouter l'objet lie a l'inventaire, ou faire les deux.">Mode d'interaction</HelpLabel>
          <select value={selectedSceneObject.interactionMode || 'popup'} onChange={(event) => patchObject((obj) => { obj.interactionMode = event.target.value; })}>
            <option value="popup">Pop-up uniquement</option>
            <option value="inventory">Inventaire uniquement</option>
            <option value="both">Pop-up + inventaire</option>
          </select>
          <HelpLabel help="Objet ajoute a l'inventaire si le mode inclut l'inventaire. Sans selection, le clic ne donné aucun objet.">Objet d'inventaire lie</HelpLabel>
          <select value={selectedSceneObject.linkedItemId || ''} onChange={(event) => patchObject((obj) => {
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
          <textarea value={selectedSceneObject.dialogue || ''} onChange={(event) => patchObject((obj) => { obj.dialogue = event.target.value; })} />
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(selectedSceneObject.removeAfterUse)} onChange={(event) => patchObject((obj) => { obj.removeAfterUse = event.target.checked; })} />
            Retirer l'objet visible après interaction ?
          </label>
          <p className="small-note help-inline-note">Quand c'est active, l'objet disparait de la scene après son utilisation réussie.</p>
        </>
      ) : null}

      {clickMode === 'action' ? (
        <>
          <HelpLabel help="Action principale déclénchée par cette image après validation des prerequis eventuels.">Action</HelpLabel>
          <select value={selectedSceneObject.actionType || 'dialogue'} onChange={(event) => patchObject((obj) => { obj.actionType = event.target.value; })}>
            <option value="dialogue">Dialogue</option>
            <option value="dialogue_item">Dialogue + objet</option>
            <option value="scene">Changer de scene</option>
            <option value="cinematic">Lancer une cinematic</option>
          </select>
          <HelpLabel help="Texte affiché lors de l'interaction principale.">Dialogue</HelpLabel>
          <textarea value={selectedSceneObject.dialogue || ''} onChange={(event) => patchObject((obj) => { obj.dialogue = event.target.value; })} />
          <HelpLabel help="Objet requis pour utiliser cette image-zone.">Objet requis</HelpLabel>
          <select value={selectedSceneObject.requiredItemId || ''} onChange={(event) => patchObject((obj) => { obj.requiredItemId = event.target.value; })}>
            <option value="">Aucun</option>
            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(selectedSceneObject.consumeRequiredItemOnUse)} onChange={(event) => patchObject((obj) => { obj.consumeRequiredItemOnUse = event.target.checked; })} />
            Consommer l'objet requis
          </label>
          <HelpLabel help="Objet donné au joueur si l'action réussit.">Objet donné</HelpLabel>
          <select value={selectedSceneObject.rewardItemId || ''} onChange={(event) => patchObject((obj) => { obj.rewardItemId = event.target.value; })}>
            <option value="">Aucun</option>
            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
          <HelpLabel help="Destination utilisée si l'action est Changer de scene.">Scene cible</HelpLabel>
          <select value={selectedSceneObject.targetSceneId || ''} onChange={(event) => patchObject((obj) => { obj.targetSceneId = event.target.value; })}>
            <option value="">Aucune</option>
            {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
          <HelpLabel help="Cinematic lancee après l'interaction réussie.">Cinematic cible</HelpLabel>
          <select value={selectedSceneObject.targetCinematicId || ''} onChange={(event) => patchObject((obj) => { obj.targetCinematicId = event.target.value; })}>
            <option value="">Aucune</option>
            {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
          <HelpLabel help="Enigme a résoudre avant d'executer l'action.">Enigme liee</HelpLabel>
          <select value={selectedSceneObject.enigmaId || ''} onChange={(event) => patchObject((obj) => { obj.enigmaId = event.target.value; })}>
            <option value="">Aucune</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
          <HelpLabel help="Son joué au moment ou cette image-zone est utilisée.">Son de la zone</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="audio/*"
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
            <>
              <audio controls preload="metadata" src={selectedSceneObject.soundData} style={{ width: '100%', marginTop: 10 }} />
              <button type="button" className="danger-button" style={{ marginTop: 12 }} onClick={() => patchObject((obj) => {
                obj.soundData = '';
                obj.soundName = '';
              })}>
                Supprimer le son ?
              </button>
            </>
          ) : null}
          <HelpLabel help="Image montree en pop-up quand cette action réussit.">Image objet</HelpLabel>
          <MediaSourcePicker
            className="button like full secondary-action"
            accept="image/*"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={(data, name) => patchObject((obj) => {
              obj.objectImageData = data;
              obj.objectImageName = name;
            })}
          >
            {selectedSceneObject.objectImageName ? "Remplacer l'image objet" : 'Importer une image objet'}
          </MediaSourcePicker>
          {selectedSceneObject.objectImageData ? (
            <button type="button" className="danger-button" style={{ marginTop: 12 }} onClick={() => patchObject((obj) => {
              obj.objectImageData = '';
              obj.objectImageName = '';
            })}>
              Supprimer l'image ?
            </button>
          ) : null}
        </>
      ) : null}

      {clickMode === 'none' ? (
        <p className="small-note help-inline-note">Cette image reste visible dans la scene, mais aucun clic joueur ne déclénche d'action.</p>
      ) : null}

      <button className="danger-button" style={{ marginTop: 12 }} onClick={removeObject}>
        {isAnimationObject ? "Supprimer l'animation" : "Supprimer l'objet visible"}
      </button>
    </>
  );
}
