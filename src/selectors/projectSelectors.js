export function getActById(project, id) {
  return project.acts.find((act) => act.id === id);
}

export function getSceneById(project, id) {
  return project.scenes.find((scene) => scene.id === id);
}

export function getItemById(project, id) {
  return project.items.find((item) => item.id === id);
}

export function getSelectedScene(project, selectedSceneId) {
  return getSceneById(project, selectedSceneId) || null;
}

export function getSelectedHotspot(selectedScene, selectedHotspotId) {
  return selectedScene?.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) || null;
}

export function getSelectedCinematic(project, selectedCinematicId) {
  return project.cinematics.find((cinematic) => cinematic.id === selectedCinematicId) || null;
}

export function getSelectedItem(project, selectedItemId) {
  return getItemById(project, selectedItemId) || null;
}
