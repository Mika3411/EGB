import { HelpLabel } from './SceneEditorChrome.jsx';

export const getSceneObjectClickMode = (obj) => {
  if (!obj) return 'object';
  if (obj.clickMode) return obj.clickMode;
  if (obj.isClickable === false) return 'none';
  return 'object';
};

export default function SceneObjectInspector({
  project,
  selectedSceneId,
  selectedSceneObject,
  selectedSceneObjectId,
  patchProject,
  renderShapeControls,
  handleUpload,
  importSceneObjectAnime2d,
  getSceneLabel,
  setSelectedSceneObjectId,
}) {
  const clickMode = getSceneObjectClickMode(selectedSceneObject);
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
      <HelpLabel help="Nom interne de l'objet visible. Il aide a le retrouver dans les calques et les listes de l'editeur.">Nom</HelpLabel>
      <input value={selectedSceneObject.name} onChange={(event) => patchObject((obj) => { obj.name = event.target.value; })} />
      <div className="grid-two small-gap">
        <div><HelpLabel help="Position horizontale du centre de l'objet, en pourcentage de la largeur de l'image.">X</HelpLabel><input type="number" value={selectedSceneObject.x} onChange={(event) => patchObject((obj) => { obj.x = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Position verticale du centre de l'objet, en pourcentage de la hauteur de l'image.">Y</HelpLabel><input type="number" value={selectedSceneObject.y} onChange={(event) => patchObject((obj) => { obj.y = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Largeur de l'image visible et, si active, de la zone cliquable.">Largeur</HelpLabel><input type="number" value={selectedSceneObject.width} onChange={(event) => patchObject((obj) => { obj.width = Number(event.target.value); })} /></div>
        <div><HelpLabel help="Hauteur de l'image visible et, si active, de la zone cliquable.">Hauteur</HelpLabel><input type="number" value={selectedSceneObject.height} onChange={(event) => patchObject((obj) => { obj.height = Number(event.target.value); })} /></div>
      </div>
      {renderShapeControls?.('sceneObject', selectedSceneObjectId)}

      <HelpLabel help="Choisis si cette image est seulement decorative, si elle se comporte comme un objet ramassable, ou si elle declenche une action comme une zone.">Cliquable</HelpLabel>
      <select value={clickMode} onChange={(event) => patchObject((obj) => {
        obj.clickMode = event.target.value;
        if (event.target.value === 'action') {
          obj.actionType = obj.actionType || 'dialogue';
          obj.dialogue = obj.dialogue || '';
        }
        if (event.target.value === 'object') {
          obj.interactionMode = obj.interactionMode || (obj.linkedItemId ? 'inventory' : 'popup');
        }
      })}>
        <option value="none">Non cliquable</option>
        <option value="object">Objet</option>
        <option value="action">Zone d'action</option>
      </select>

      <HelpLabel help="Image fixe ou JSON exporte depuis l'onglet Animation. Un JSON 2D Anime reste anime directement sur la scene.">Image visible</HelpLabel>
      <label className="button like full secondary-action">
        {selectedSceneObject.imageName || 'Importer une image fixe'}
        <input type="file" accept="image/*" hidden onChange={(event) => handleUpload(event, (data, name) => patchObject((obj) => {
          obj.imageData = data;
          obj.imageName = name;
          obj.anime2dSpec = null;
          obj.anime2dName = '';
          obj.linkedItemId = '';
          obj.isInvisible = false;
        }))} />
      </label>
      <label className="button like full secondary-action">
        {selectedSceneObject.anime2dName || 'Importer JSON 2D Anime'}
        <input type="file" accept="application/json,.json" hidden onChange={(event) => importSceneObjectAnime2d?.(event, selectedSceneObjectId)} />
      </label>
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

      {clickMode === 'object' ? (
        <>
          <HelpLabel help="Definit ce qui se passe au clic : montrer un pop-up, ajouter l'objet lie a l'inventaire, ou faire les deux.">Mode d'interaction</HelpLabel>
          <select value={selectedSceneObject.interactionMode || 'popup'} onChange={(event) => patchObject((obj) => { obj.interactionMode = event.target.value; })}>
            <option value="popup">Pop-up uniquement</option>
            <option value="inventory">Inventaire uniquement</option>
            <option value="both">Pop-up + inventaire</option>
          </select>
          <HelpLabel help="Objet ajoute a l'inventaire si le mode inclut l'inventaire. Sans selection, le clic ne donne aucun objet.">Objet d'inventaire lie</HelpLabel>
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
          <HelpLabel help="Texte affiche quand le joueur interagit avec cet objet visible.">Dialogue</HelpLabel>
          <textarea value={selectedSceneObject.dialogue || ''} onChange={(event) => patchObject((obj) => { obj.dialogue = event.target.value; })} />
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(selectedSceneObject.removeAfterUse)} onChange={(event) => patchObject((obj) => { obj.removeAfterUse = event.target.checked; })} />
            Retirer l'objet visible apres interaction ?
          </label>
          <p className="small-note help-inline-note">Quand c'est active, l'objet disparait de la scene apres son utilisation reussie.</p>
        </>
      ) : null}

      {clickMode === 'action' ? (
        <>
          <HelpLabel help="Action principale declenchee par cette image apres validation des prerequis eventuels.">Action</HelpLabel>
          <select value={selectedSceneObject.actionType || 'dialogue'} onChange={(event) => patchObject((obj) => { obj.actionType = event.target.value; })}>
            <option value="dialogue">Dialogue</option>
            <option value="dialogue_item">Dialogue + objet</option>
            <option value="scene">Changer de scene</option>
            <option value="cinematic">Lancer une cinematique</option>
          </select>
          <HelpLabel help="Texte affiche lors de l'interaction principale.">Dialogue</HelpLabel>
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
          <HelpLabel help="Objet donne au joueur si l'action reussit.">Objet donne</HelpLabel>
          <select value={selectedSceneObject.rewardItemId || ''} onChange={(event) => patchObject((obj) => { obj.rewardItemId = event.target.value; })}>
            <option value="">Aucun</option>
            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
          <HelpLabel help="Destination utilisee si l'action est Changer de scene.">Scene cible</HelpLabel>
          <select value={selectedSceneObject.targetSceneId || ''} onChange={(event) => patchObject((obj) => { obj.targetSceneId = event.target.value; })}>
            <option value="">Aucune</option>
            {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
          <HelpLabel help="Cinematique lancee apres l'interaction reussie.">Cinematique cible</HelpLabel>
          <select value={selectedSceneObject.targetCinematicId || ''} onChange={(event) => patchObject((obj) => { obj.targetCinematicId = event.target.value; })}>
            <option value="">Aucune</option>
            {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
          <HelpLabel help="Enigme a resoudre avant d'executer l'action.">Enigme liee</HelpLabel>
          <select value={selectedSceneObject.enigmaId || ''} onChange={(event) => patchObject((obj) => { obj.enigmaId = event.target.value; })}>
            <option value="">Aucune</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
          <HelpLabel help="Son joue au moment ou cette image-zone est utilisee.">Son de la zone</HelpLabel>
          <label className="button like full secondary-action">
            {selectedSceneObject.soundName || 'Importer un son unique'}
            <input type="file" accept="audio/*" hidden onChange={(event) => handleUpload(event, (data, name) => patchObject((obj) => {
              obj.soundData = data;
              obj.soundName = name;
            }))} />
          </label>
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
          <HelpLabel help="Image montree en pop-up quand cette action reussit.">Image objet</HelpLabel>
          <label className="button like full secondary-action">
            {selectedSceneObject.objectImageName ? "Remplacer l'image objet" : 'Importer une image objet'}
            <input type="file" accept="image/*" hidden onChange={(event) => handleUpload(event, (data, name) => patchObject((obj) => {
              obj.objectImageData = data;
              obj.objectImageName = name;
            }))} />
          </label>
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
        <p className="small-note help-inline-note">Cette image reste visible dans la scene, mais aucun clic joueur ne declenche d'action.</p>
      ) : null}

      <button className="danger-button" style={{ marginTop: 12 }} onClick={removeObject}>Supprimer l'objet visible</button>
    </>
  );
}
