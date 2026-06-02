export const standaloneNavigationOverrides = `
function applyEnterSceneAction(sceneId, fallbackText = 'Nouvelle scène.') {
  const nextScene = getSceneById(sceneId);
  if (!nextScene) return false;
  const objectiveContext = {
    inventory: state.inventory,
    visitedSceneIds: state.visitedSceneIds,
    completedHotspotIds: state.completedHotspotIds,
    solvedEnigmaIds: state.solvedEnigmaIds,
    chosenConversationReplyIds: state.chosenConversationReplyIds,
    storyVariables: state.storyVariables,
    project,
  };
  if (shouldBlockObjectiveFinalScene(sceneId, objectiveContext)) {
    const blockMessage = getObjectiveFinalSceneBlockMessage(objectiveContext, { sceneId });
    state.dialogue = [fallbackText, blockMessage].filter(Boolean).join(' ');
    return false;
  }
  const currentScene = getPlayScene();
  const transitionOverlay = createSceneTransitionOverlay(currentScene, nextScene);
  if (transitionOverlay) {
    state.sceneTransitionOverlay = {
      type: transitionOverlay.type,
      duration: transitionOverlay.duration,
      scene: transitionOverlay.previousScene,
    };
  }
  if (currentScene?.id !== nextScene.id) expiredSceneTimerKey = '';
  const changesAct = (currentScene?.actId || '') !== (nextScene.actId || '');
  state.playSceneId = nextScene.id;
  state.dialogue = nextScene.introText || fallbackText;
  if (changesAct) beginActPreload(nextScene);
  return true;
}

function goToScene(sceneId, fallbackText = 'Nouvelle scène.') {
  const result = dispatch({ ...gameActions.enterScene(sceneId), fallbackText });
  if (result && sceneId && !state.visitedSceneIds.includes(sceneId)) {
    state.visitedSceneIds = [...state.visitedSceneIds, sceneId];
  }
  return result;
}
`;
