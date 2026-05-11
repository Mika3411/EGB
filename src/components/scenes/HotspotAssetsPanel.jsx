import { HelpLabel } from './SceneEditorChrome.jsx';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import { showConfirm } from '../AccessibleDialog';

export default function HotspotAssetsPanel({
  selectedHotspot,
  selectedSceneId,
  selectedHotspotId,
  patchProject,
  handleUpload,
  mediaLibrary = [],
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
        <HelpLabel help="Son joué au moment ou cette zone est utilisée. Garde-le court pour ne pas couvrir la musique ou les dialogues.">Son de la zone</HelpLabel>
        <MediaSourcePicker
          className="button like full secondary-action"
          accept="audio/*"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={(data, name) => patchSelectedHotspot((spot) => {
            spot.soundData = data;
            spot.soundName = name;
          })}
          tourId="hotspot-sound"
        >
          {selectedHotspot.soundName || 'Importer un son unique'}
        </MediaSourcePicker>
        {selectedHotspot.soundData && (
          <div className="hotspot-audio-compact">
            <audio controls preload="metadata" src={selectedHotspot.soundData} />
            <button
              type="button"
              className="danger-button"
              onClick={async () => {
                const confirmed = await showConfirm({
                  title: 'Supprimer le son',
                  message: 'Supprimer le son de cette zone ?',
                  confirmLabel: 'Supprimer',
                  variant: 'danger',
                });
                if (!confirmed) return;
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
        <HelpLabel help="Image associée à l'action principale de cette zone, souvent utilisée pour montrer un objet trouvé ou un indice visuel.">Image objet</HelpLabel>
        <MediaSourcePicker
          className="button like full secondary-action"
          accept="image/*"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={(data, name) => patchSelectedHotspot((spot) => {
            spot.objectImageData = data;
            spot.objectImageName = name;
          })}
          tourId="hotspot-object-image"
        >
          {selectedHotspot.objectImageName ? "Remplacer l'image objet" : 'Importer une image objet'}
        </MediaSourcePicker>
        {selectedHotspot.objectImageData && (
          <button
            type="button"
            className="danger-button"
            onClick={async () => {
              const confirmed = await showConfirm({
                title: "Supprimer l'image",
                message: "Supprimer l'image de cette zone ?",
                confirmLabel: 'Supprimer',
                variant: 'danger',
              });
              if (!confirmed) return;
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
