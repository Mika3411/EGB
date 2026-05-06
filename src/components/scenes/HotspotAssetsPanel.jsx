import { HelpLabel } from './SceneEditorChrome.jsx';

export default function HotspotAssetsPanel({
  selectedHotspot,
  selectedSceneId,
  selectedHotspotId,
  patchProject,
  handleUpload,
  className = '',
}) {
  if (!selectedHotspot) return null;

  const patchSelectedHotspot = (updater) => {
    patchProject((draft) => {
      const spot = draft.scenes
        .find((scene) => scene.id === selectedSceneId)
        ?.hotspots.find((hotspot) => hotspot.id === selectedHotspotId);
      if (spot) updater(spot);
    });
  };

  return (
    <div className={`hotspot-assets-card ${className}`.trim()}>
      <div className="hotspot-assets-field">
        <HelpLabel help="Son joue au moment ou cette zone est utilisee. Garde-le court pour ne pas couvrir la musique ou les dialogues.">Son de la zone</HelpLabel>
        <label className="button like full secondary-action" data-tour="hotspot-sound">
          {selectedHotspot.soundName || 'Importer un son unique'}
          <input
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => handleUpload(event, (data, name) => patchSelectedHotspot((spot) => {
              spot.soundData = data;
              spot.soundName = name;
            }))}
          />
        </label>
        {selectedHotspot.soundData && (
          <div className="hotspot-audio-compact">
            <audio controls preload="metadata" src={selectedHotspot.soundData} />
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (!window.confirm('Supprimer le son de cette zone ?')) return;
                patchSelectedHotspot((spot) => {
                  spot.soundData = '';
                  spot.soundName = '';
                });
              }}
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="hotspot-assets-field">
        <HelpLabel help="Image associee a l'action principale de cette zone, souvent utilisee pour montrer un objet trouve ou un indice visuel.">Image objet</HelpLabel>
        <label className="button like full secondary-action" data-tour="hotspot-object-image">
          {selectedHotspot.objectImageName ? "Remplacer l'image objet" : 'Importer une image objet'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleUpload(event, (data, name) => patchSelectedHotspot((spot) => {
              spot.objectImageData = data;
              spot.objectImageName = name;
            }))}
          />
        </label>
        {selectedHotspot.objectImageData && (
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              if (!window.confirm("Supprimer l'image de cette zone ?")) return;
              patchSelectedHotspot((spot) => {
                spot.objectImageData = '';
                spot.objectImageName = '';
              });
            }}
          >
            Supprimer l'image
          </button>
        )}
      </div>
    </div>
  );
}
