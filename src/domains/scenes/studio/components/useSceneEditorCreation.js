export function useSceneEditorCreation({
  project,
  selectedSceneId,
  selectedItem,
  selectedItemId,
  setSelectedSceneObjectId,
  setSelectedVisualEffectZoneId,
  setSelectedHotspotId,
  setSelectedItemId,
  setSelectedHotspotIds,
  setSelectedSceneObjectIds,
  patchProject,
}) {
  const addSceneObject = ({
    invisible = false,
    animation = false,
    blockType = 'object',
    sourceItem: requestedSourceItem = null,
  } = {}) => {
    if (!selectedSceneId) return;
    const nextId = `scene-object-${Math.random().toString(36).slice(2, 10)}`;
    const sourceItem = requestedSourceItem || selectedItem || project.items?.find((item) => item.id === selectedItemId) || project.items?.[0];
    const isTutorialObject = Boolean(document.body.classList.contains('tutorial-active'));
    const blockDefaults = {
      text: {
        name: 'Texte',
        blockLabel: 'Texte',
        blockText: 'Un message apparait dans la scène.',
        dialogue: 'Un message apparait dans la scène.',
        width: 28,
        height: 12,
        clickMode: 'none',
      },
      image: {
        name: 'Image',
        blockLabel: 'Image',
        dialogue: 'Tu observes cette image.',
        width: 18,
        height: 18,
        clickMode: 'object',
      },
      button: {
        name: 'Bouton',
        blockLabel: 'Bouton',
        buttonLabel: 'Action',
        dialogue: 'Le bouton réagit.',
        width: 18,
        height: 10,
        clickMode: 'object',
      },
      input: {
        name: 'Champ de saisie',
        blockLabel: 'Réponse',
        placeholder: 'Saisir une réponse...',
        expectedAnswer: 'secret',
        successDialogue: 'Bonne réponse.',
        failureDialogue: 'Ce n est pas la bonne réponse.',
        width: 26,
        height: 12,
        clickMode: 'object',
      },
      code: {
        name: 'Code',
        blockLabel: 'Code',
        placeholder: 'Entrer le code...',
        expectedAnswer: '1234',
        successDialogue: 'Le code est correct.',
        failureDialogue: 'Le code est incorrect.',
        width: 22,
        height: 12,
        clickMode: 'object',
      },
      hint: {
        name: 'Indice',
        blockLabel: 'Indice',
        blockText: 'Un indice utile se cache ici.',
        dialogue: 'Un indice utile se cache ici.',
        width: 24,
        height: 13,
        clickMode: 'object',
      },
    }[blockType] || {};
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (!Array.isArray(scene.sceneObjects)) scene.sceneObjects = [];
      scene.sceneObjects.push({
        id: nextId,
        name: animation ? 'Animation' : (invisible ? 'Objet invisible' : (sourceItem?.name || 'Nouvel objet visible')),
        blockType,
        imageData: '',
        imageName: '',
        popupImage: '',
        popupImageName: '',
        x: 50,
        y: 50,
        width: 14,
        height: 14,
        isInvisible: invisible,
        clickMode: 'object',
        interactionMode: animation ? 'popup' : (sourceItem?.id ? 'inventory' : 'popup'),
        linkedItemId: animation ? '' : (sourceItem?.id || ''),
        removeAfterUse: !animation,
        dialogue: animation ? '' : (sourceItem?.name ? `Tu as trouvé ${sourceItem.name}.` : ''),
        tutorialCreated: isTutorialObject,
        fontSize: 13,
        ...blockDefaults,
      });
    });
    setSelectedSceneObjectId(nextId);
    setSelectedHotspotId('');
    setSelectedItemId('');
  };

  const addInvisibleSceneObject = () => addSceneObject({ invisible: true });
  const addAnimationObject = () => addSceneObject({ animation: true });
  const addInteractiveBlock = (blockType) => addSceneObject({ blockType });

  const addVisualEffectZone = () => {
    if (!selectedSceneId) return;
    const nextId = `visual-zone-${Math.random().toString(36).slice(2, 10)}`;
    const isTutorialZone = Boolean(document.body.classList.contains('tutorial-active'));
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (!Array.isArray(scene.visualEffectZones)) scene.visualEffectZones = [];
      scene.visualEffectZones.push({
        id: nextId,
        name: 'Zone scintillante',
        effect: 'sparkles',
        intensity: 'normal',
        x: 50,
        y: 50,
        width: 24,
        height: 18,
        layer: 'behind',
        isHidden: false,
        tutorialCreated: isTutorialZone,
      });
    });
    setSelectedVisualEffectZoneId(nextId);
    setSelectedSceneObjectId('');
    setSelectedHotspotId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
  };

  return {
    addSceneObject,
    addInvisibleSceneObject,
    addAnimationObject,
    addInteractiveBlock,
    addVisualEffectZone,
  };
}
