import { useState } from 'react';
import { readAnime2dJsonFile } from '../../../anime2d/Anime2DPreview.jsx';

export function useSceneEditorSceneState({
  project,
  selectedScene,
  selectedSceneId,
  selectedSceneObjectId,
  selectedVisualEffectZoneId,
  selectedHotspotId,
  setSelectedSceneId,
  setSelectedHotspotId,
  setSelectedSceneObjectId,
  setSelectedVisualEffectZoneId,
  setSelectedHotspotIds,
  setSelectedSceneObjectIds,
  setSelectedItemId,
  patchProject,
  toggleNavigationSceneCollapsed,
}) {
  const selectedSceneObject = selectedScene?.sceneObjects?.find((obj) => obj.id === selectedSceneObjectId) || null;
  const selectedVisualEffectZone = selectedScene?.visualEffectZones?.find((zone) => zone.id === selectedVisualEffectZoneId) || null;
  const sceneAspectRatio = Number(selectedScene?.backgroundAspectRatio) > 0 ? Number(selectedScene.backgroundAspectRatio) : 1.6;
  const getLinkedItem = (itemId) => project.items?.find((item) => item.id === itemId) || null;
  const getSceneObjectDisplayImage = (obj) => obj?.imageData || getLinkedItem(obj?.linkedItemId)?.imageData || '';
  const [quickLogicTarget, setQuickLogicTarget] = useState(null);

  const openQuickLogicForTarget = (type, id) => {
    if (!id) return;
    setQuickLogicTarget({ type, id });
  };

  const importSceneObjectAnime2d = async (event, objectId = selectedSceneObjectId) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !objectId) return;
    try {
      const anime2dSpec = await readAnime2dJsonFile(file);
      patchProject((draft) => {
        const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === objectId);
        if (!obj) return;
        obj.anime2dSpec = anime2dSpec;
        obj.anime2dName = file.name;
        obj.imageData = '';
        obj.imageName = '';
        obj.linkedItemId = '';
        obj.isInvisible = false;
        obj.name = obj.name || anime2dSpec.sceneName || 'Animation 2D';
      });
    } catch (error) {
      window.alert(error.message || 'Import JSON 2D Anime impossible.');
    }
  };

  const toggleSceneChildren = (event, sceneId) => {
    event.preventDefault();
    event.stopPropagation();
    toggleNavigationSceneCollapsed?.(sceneId);
  };

  const selectSceneFromTree = (scene) => {
    setSelectedSceneId(scene.id);
    setSelectedHotspotId(scene.hotspots?.[0]?.id || '');
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedSceneObjectIds([]);
    setSelectedHotspotIds(scene.hotspots?.[0]?.id ? [scene.hotspots[0].id] : []);
    setSelectedItemId('');
  };

  const selectSceneInFullscreen = (sceneId) => {
    const scene = project.scenes.find((entry) => entry.id === sceneId);
    if (!scene) return;
    setSelectedSceneId(scene.id);
    setSelectedHotspotId(scene.hotspots?.[0]?.id || '');
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
  };

  const selectActInFullscreen = (actId) => {
    const scene = project.scenes.find((entry) => entry.actId === actId && !entry.parentSceneId)
      || project.scenes.find((entry) => entry.actId === actId);
    if (scene) selectSceneInFullscreen(scene.id);
  };

  const rememberSceneBackgroundAspectRatio = (image, sceneId = selectedSceneId) => {
    if (!image?.naturalWidth || !image?.naturalHeight || !sceneId) return;
    const nextRatio = Number((image.naturalWidth / image.naturalHeight).toFixed(4));
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return;
    const currentRatio = Number(project.scenes.find((scene) => scene.id === sceneId)?.backgroundAspectRatio);
    if (Math.abs((currentRatio || 0) - nextRatio) < 0.0001) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      if (scene) scene.backgroundAspectRatio = nextRatio;
    }, { rememberHistory: false });
  };

  const updateSceneBackground = (data, name) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      if (scene) {
        scene.backgroundData = data;
        scene.backgroundName = name;
        scene.backgroundAspectRatio = 1.6;
      }
    });

    const image = new Image();
    image.onload = () => rememberSceneBackgroundAspectRatio(image);
    image.src = data;
  };

  return {
    quickLogicTarget,
    setQuickLogicTarget,
    selectedSceneObject,
    selectedVisualEffectZone,
    sceneAspectRatio,
    getLinkedItem,
    getSceneObjectDisplayImage,
    openQuickLogicForTarget,
    importSceneObjectAnime2d,
    toggleSceneChildren,
    selectSceneFromTree,
    selectSceneInFullscreen,
    selectActInFullscreen,
    rememberSceneBackgroundAspectRatio,
    updateSceneBackground,
  };
}
