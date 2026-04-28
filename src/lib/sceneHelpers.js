export function getSceneDepth(scene, getSceneById) {
  let depth = 0;
  let parentId = scene?.parentSceneId;
  const visited = new Set();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = getSceneById(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentSceneId;
  }

  return depth;
}

export function collectDescendantSceneIds(scenes, rootSceneId) {
  const ids = new Set([rootSceneId]);
  let changed = true;

  while (changed) {
    changed = false;
    scenes.forEach((scene) => {
      if (scene.parentSceneId && ids.has(scene.parentSceneId) && !ids.has(scene.id)) {
        ids.add(scene.id);
        changed = true;
      }
    });
  }

  return ids;
}

export function buildSceneLabel(sceneId, getSceneById, getActById) {
  const scene = getSceneById(sceneId);
  if (!scene) return '—';
  const act = getActById(scene.actId);
  return `${act?.name || 'Sans acte'} · ${scene.parentSceneId ? 'Sous-scène' : 'Scène'} · ${scene.name}`;
}
