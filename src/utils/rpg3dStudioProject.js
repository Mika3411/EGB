import {
  DEFAULT_ARCADE_CONFIG,
  cloneActionZoneArray,
  cloneConfig,
  clonePlainObjectArray,
  clonePropArray,
  cloneTerrainPaintArray,
} from './rpg3dDomain.js';

export const DEFAULT_RPG3D_ACT_ID = 'rpg3d-act-1';
export const DEFAULT_RPG3D_SCENE_ID = 'rpg3d-scene-1';
export const DEFAULT_RPG3D_CANVAS_ID = 'rpg3d-canvas-1';

const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const getDefaultRpg3DActs = () => [{ id: DEFAULT_RPG3D_ACT_ID, name: 'Acte I' }];

export const getDefaultRpg3DScenes = () => [{
  id: DEFAULT_RPG3D_SCENE_ID,
  name: 'Scene 1',
  actId: DEFAULT_RPG3D_ACT_ID,
  parentSceneId: '',
}];

export const createConfigFromSavedAssets = (savedConfig = null) => {
  const next = cloneConfig(DEFAULT_ARCADE_CONFIG);
  if (!savedConfig || typeof savedConfig !== 'object') return next;
  next.world = { ...next.world, ...(savedConfig.world || {}) };
  next.engine = { ...next.engine, ...(savedConfig.engine || {}) };
  next.player = { ...next.player, ...(savedConfig.player || {}) };
  next.ai = { ...next.ai, ...(savedConfig.ai || {}) };
  next.obstacles = clonePlainObjectArray(savedConfig.obstacles);
  next.reliefs = clonePlainObjectArray(savedConfig.reliefs);
  next.heroes = clonePlainObjectArray(savedConfig.heroes);
  next.props = clonePropArray(savedConfig.props);
  next.enemies = clonePlainObjectArray(savedConfig.enemies);
  next.pickups = clonePlainObjectArray(savedConfig.pickups);
  next.actionZones = cloneActionZoneArray(savedConfig.actionZones);
  next.terrainPaintStrokes = cloneTerrainPaintArray(savedConfig.terrainPaintStrokes);
  return next;
};

export const createFallbackRpg3DCanvas = (config = DEFAULT_ARCADE_CONFIG) => ({
  id: DEFAULT_RPG3D_CANVAS_ID,
  name: 'Canevas 1',
  actId: DEFAULT_RPG3D_ACT_ID,
  sceneId: DEFAULT_RPG3D_CANVAS_ID,
  config: cloneConfig(config),
  createdAt: '',
  updatedAt: '',
});

const cloneStuntAnimationArray = (items = []) => (
  Array.isArray(items)
    ? items.map((clip) => ({
      ...(clip || {}),
      keyframes: clonePlainObjectArray(clip?.keyframes || []),
      rigFrames: clonePlainObjectArray(clip?.rigFrames || []),
    }))
    : []
);

export const getSourceProjectActs = (sourceProject = null) => (
  Array.isArray(sourceProject?.acts) && sourceProject.acts.length
    ? sourceProject.acts
    : []
);

export const getSourceProjectScenes = (sourceProject = null) => (
  Array.isArray(sourceProject?.scenes) && sourceProject.scenes.length
    ? sourceProject.scenes
    : []
);

export const normalizeRpg3DActs = (acts = [], sourceProject = null) => {
  const rawActs = Array.isArray(acts) && acts.length ? acts : [];
  const normalized = (Array.isArray(rawActs) ? rawActs : [])
    .map((act, index) => ({
      id: act?.id || `rpg3d-act-${index + 1}`,
      name: act?.name || `Acte ${index + 1}`,
    }))
    .filter((act) => act.id);
  return normalized.length ? normalized : getDefaultRpg3DActs();
};

export const normalizeRpg3DScenes = (scenes = [], acts = getDefaultRpg3DActs(), sourceProject = null) => {
  const rawScenes = Array.isArray(scenes) && scenes.length ? scenes : [];
  const fallbackActId = acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
  const actIds = new Set(acts.map((act) => act.id));
  const normalized = (Array.isArray(rawScenes) ? rawScenes : [])
    .map((scene, index) => ({
      id: scene?.id || `rpg3d-scene-${index + 1}`,
      name: scene?.name || `Scene ${index + 1}`,
      actId: actIds.has(scene?.actId) ? scene.actId : fallbackActId,
      parentSceneId: scene?.parentSceneId || '',
    }))
    .filter((scene) => scene.id);
  return normalized.length ? normalized : getDefaultRpg3DScenes().map((scene) => ({ ...scene, actId: fallbackActId }));
};

export const normalizeRpg3DCanvases = (canvases = [], fallbackConfig = null, acts = getDefaultRpg3DActs(), scenes = getDefaultRpg3DScenes()) => {
  const fallbackActId = acts[0]?.id || DEFAULT_RPG3D_ACT_ID;
  const actIds = new Set(acts.map((act) => act.id));
  const normalized = (Array.isArray(canvases) ? canvases : [])
    .map((canvas, index) => {
      const scene = scenes.find((entry) => entry.id === canvas?.sceneId);
      const actId = actIds.has(canvas?.actId)
        ? canvas.actId
        : scene?.actId || fallbackActId;
      const canvasId = canvas?.id || `rpg3d-canvas-${index + 1}`;
      return {
        id: canvasId,
        name: canvas?.name || `Canevas ${index + 1}`,
        actId,
        sceneId: canvasId,
        config: createConfigFromSavedAssets(canvas?.config || (index === 0 ? fallbackConfig : null)),
        createdAt: canvas?.createdAt || '',
        updatedAt: canvas?.updatedAt || '',
      };
    })
    .filter((canvas) => canvas.id);
  if (normalized.length) return normalized;
  const fallbackCanvas = createFallbackRpg3DCanvas(fallbackConfig || DEFAULT_ARCADE_CONFIG);
  return [{
    ...fallbackCanvas,
    actId: fallbackActId,
    sceneId: fallbackCanvas.id,
  }];
};

export const createDefaultStudioProject = () => ({
  title: 'RPG 3D Builder',
  characterModels3d: [],
  decorModels3d: [],
  mediaAssets: [],
  stuntAnimations: [],
  rpg3dActs: getDefaultRpg3DActs(),
  rpg3dScenes: getDefaultRpg3DScenes(),
  rpg3dCanvases: [createFallbackRpg3DCanvas()],
  rpg3dActiveCanvasId: DEFAULT_RPG3D_CANVAS_ID,
});

export const cloneStudioProjectForEdit = (studioProject = null, fallbackConfig = null, sourceProject = null) => {
  const acts = normalizeRpg3DActs(studioProject?.rpg3dActs || [], sourceProject);
  const scenes = normalizeRpg3DScenes(studioProject?.rpg3dScenes || [], acts, sourceProject);
  const canvases = normalizeRpg3DCanvases(studioProject?.rpg3dCanvases || [], fallbackConfig, acts, scenes);
  const activeCanvasId = canvases.some((canvas) => canvas.id === studioProject?.rpg3dActiveCanvasId)
    ? studioProject.rpg3dActiveCanvasId
    : canvases[0]?.id || DEFAULT_RPG3D_CANVAS_ID;
  return {
    ...createDefaultStudioProject(),
    ...(studioProject && typeof studioProject === 'object' ? studioProject : {}),
    characterModels3d: clonePlainObjectArray(studioProject?.characterModels3d || []),
    decorModels3d: clonePlainObjectArray(studioProject?.decorModels3d || []),
    mediaAssets: clonePlainObjectArray(studioProject?.mediaAssets || []),
    stuntAnimations: cloneStuntAnimationArray(studioProject?.stuntAnimations || []),
    rpg3dActs: acts,
    rpg3dScenes: scenes,
    rpg3dCanvases: canvases,
    rpg3dActiveCanvasId: activeCanvasId,
  };
};

export const createStudioProjectFromSavedAssets = (savedStudioProject = null, savedConfig = null, sourceProject = null) => (
  cloneStudioProjectForEdit(savedStudioProject, savedConfig, sourceProject)
);

export const getActiveRpg3DCanvas = (studioProject = null) => {
  const project = cloneStudioProjectForEdit(studioProject);
  return project.rpg3dCanvases.find((canvas) => canvas.id === project.rpg3dActiveCanvasId)
    || project.rpg3dCanvases[0]
    || createFallbackRpg3DCanvas();
};

export const getDefaultPortalTargetCanvasId = (studioProject = null) => {
  const project = cloneStudioProjectForEdit(studioProject);
  const activeId = project.rpg3dActiveCanvasId || project.rpg3dCanvases[0]?.id || '';
  return (project.rpg3dCanvases || []).find((canvas) => canvas.id && canvas.id !== activeId)?.id || '';
};

export const syncStudioProjectActiveCanvasConfig = (studioProject = null, config = DEFAULT_ARCADE_CONFIG, canvasId = '') => {
  const next = cloneStudioProjectForEdit(studioProject);
  const activeCanvasId = canvasId || next.rpg3dActiveCanvasId || next.rpg3dCanvases[0]?.id || DEFAULT_RPG3D_CANVAS_ID;
  const targetIndex = next.rpg3dCanvases.findIndex((canvas) => canvas.id === activeCanvasId);
  if (targetIndex >= 0) {
    next.rpg3dCanvases[targetIndex] = {
      ...next.rpg3dCanvases[targetIndex],
      config: cloneConfig(config),
      updatedAt: new Date().toISOString(),
    };
    next.rpg3dActiveCanvasId = activeCanvasId;
  }
  return next;
};

export const getRpg3DCanvasStructure = (studioProject = null, legacyStudioProject = null) => {
  const targetProject = legacyStudioProject || studioProject;
  const normalizedProject = cloneStudioProjectForEdit(targetProject, null, null);
  const acts = normalizeRpg3DActs(normalizedProject.rpg3dActs);
  const scenes = normalizeRpg3DScenes(normalizedProject.rpg3dScenes, acts);
  return {
    acts,
    scenes,
    canvases: normalizeRpg3DCanvases(normalizedProject.rpg3dCanvases, null, acts, scenes),
  };
};

export const createRpg3DCanvasDraft = ({ index = 0, actId = DEFAULT_RPG3D_ACT_ID, sceneId = '', sceneName = '' } = {}) => {
  const id = createId('rpg3d-canvas');
  const name = sceneName || `Scene ${index + 1}`;
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.meta = { ...(config.meta || {}), title: name };
  return {
    id,
    name,
    actId,
    sceneId: sceneId || id,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
