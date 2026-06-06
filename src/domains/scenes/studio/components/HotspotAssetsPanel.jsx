import { HelpLabel } from './SceneEditorChrome.jsx';
import MediaSourcePicker from '../../../../shared/ui/media/MediaSourcePicker.jsx';
import { showConfirm } from '../../../../shared/ui/AccessibleDialog';
import CompactAudioPreview from './CompactAudioPreview.jsx';

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
          assetScope="object-sound"
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
          <CompactAudioPreview
            src={selectedHotspot.soundData}
            name={selectedHotspot.soundName}
            onRemove={async () => {
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
          />
        )}
      </div>

      <div className="hotspot-assets-field">
        <HelpLabel help="Image associée à l'action principale de cette zone, souvent utilisée pour montrer un objet trouvé ou un indice visuel.">Image de la zone</HelpLabel>
        <MediaSourcePicker
          className="button like full secondary-action"
          accept="image/*"
          assetScope="object-image"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={(data, name) => patchSelectedHotspot((spot) => {
            spot.objectImageData = data;
            spot.objectImageName = name;
          })}
          tourId="hotspot-object-image"
        >
          {selectedHotspot.objectImageName ? "Remplacer l'image" : 'Importer une image'}
        </MediaSourcePicker>
        {selectedHotspot.objectImageData && (
          <div className="hotspot-image-preview">
            <img src={selectedHotspot.objectImageData} alt={selectedHotspot.objectImageName || selectedHotspot.name || 'Image de la zone'} />
            <div className="hotspot-image-preview-actions">
              <span title={selectedHotspot.objectImageName || selectedHotspot.name || 'Image de la zone'}>
                {selectedHotspot.objectImageName || selectedHotspot.name || 'Image de la zone'}
              </span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
