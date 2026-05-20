import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';
import {
  DEFAULT_RPG3D_ACT_ID,
  DEFAULT_RPG3D_CANVAS_ID,
  DEFAULT_RPG3D_SCENE_ID,
  cloneStudioProjectForEdit,
  createDefaultStudioProject,
  createRpg3DCanvasDraft,
  createStudioProjectFromSavedAssets,
  getActiveRpg3DCanvas,
  getDefaultPortalTargetCanvasId,
  getRpg3DCanvasStructure,
  normalizeRpg3DActs,
  normalizeRpg3DCanvases,
  normalizeRpg3DScenes,
  syncStudioProjectActiveCanvasConfig,
} from '../utils/rpg3dStudioProject.js';

describe('rpg3d studio project helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps fallback project ids and normalizes empty project structure', () => {
    expect(DEFAULT_RPG3D_ACT_ID).toBe('rpg3d-act-1');
    expect(DEFAULT_RPG3D_SCENE_ID).toBe('rpg3d-scene-1');
    expect(DEFAULT_RPG3D_CANVAS_ID).toBe('rpg3d-canvas-1');

    const acts = normalizeRpg3DActs([]);
    const scenes = normalizeRpg3DScenes([], acts);
    const canvases = normalizeRpg3DCanvases([], null, acts, scenes);

    expect(acts).toEqual([{ id: DEFAULT_RPG3D_ACT_ID, name: 'Acte I' }]);
    expect(scenes).toEqual([{
      id: DEFAULT_RPG3D_SCENE_ID,
      name: 'Scene 1',
      actId: DEFAULT_RPG3D_ACT_ID,
      parentSceneId: '',
    }]);
    expect(canvases).toHaveLength(1);
    expect(canvases[0]).toMatchObject({
      id: DEFAULT_RPG3D_CANVAS_ID,
      name: 'Canevas 1',
      actId: DEFAULT_RPG3D_ACT_ID,
      sceneId: DEFAULT_RPG3D_CANVAS_ID,
      createdAt: '',
      updatedAt: '',
    });
    expect(canvases[0].config).toEqual(DEFAULT_ARCADE_CONFIG);
    expect(canvases[0].config).not.toBe(DEFAULT_ARCADE_CONFIG);
  });

  it('normalizes acts, scenes and canvases without changing saved field names', () => {
    const fallbackConfig = cloneConfig(DEFAULT_ARCADE_CONFIG);
    fallbackConfig.meta.title = 'Fallback config';
    fallbackConfig.actionZones = [{ id: 'zone-1', npcChoices: [{ id: 'choice-1', label: 'A' }] }];
    fallbackConfig.terrainPaintStrokes = [{ id: 'paint-1', points: [{ x: 1, y: 2 }] }];

    const acts = normalizeRpg3DActs([{ id: 'act-a', name: 'Act A' }]);
    const scenes = normalizeRpg3DScenes([{ id: 'scene-a', name: 'Scene A', actId: 'missing-act' }], acts);
    const canvases = normalizeRpg3DCanvases([{
      id: 'canvas-a',
      name: 'Canvas A',
      actId: '',
      sceneId: 'scene-a',
      config: fallbackConfig,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    }], null, acts, scenes);

    expect(scenes[0]).toEqual({
      id: 'scene-a',
      name: 'Scene A',
      actId: 'act-a',
      parentSceneId: '',
    });
    expect(canvases[0]).toMatchObject({
      id: 'canvas-a',
      name: 'Canvas A',
      actId: 'act-a',
      sceneId: 'canvas-a',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(canvases[0].config.meta.title).toBe(DEFAULT_ARCADE_CONFIG.meta.title);
    expect(canvases[0].config.actionZones[0].npcChoices[0]).toEqual({ id: 'choice-1', label: 'A' });
    expect(canvases[0].config.terrainPaintStrokes[0].points[0]).toEqual({ x: 1, y: 2 });
    expect(canvases[0].config.actionZones[0].npcChoices[0]).not.toBe(fallbackConfig.actionZones[0].npcChoices[0]);
    expect(canvases[0].config.terrainPaintStrokes[0].points[0]).not.toBe(fallbackConfig.terrainPaintStrokes[0].points[0]);
  });

  it('returns the active RPG 3D canvas and falls back after deletion', () => {
    const project = {
      ...createDefaultStudioProject(),
      rpg3dCanvases: [
        { id: 'canvas-1', name: 'One', actId: DEFAULT_RPG3D_ACT_ID, sceneId: 'canvas-1', config: cloneConfig(DEFAULT_ARCADE_CONFIG) },
        { id: 'canvas-2', name: 'Two', actId: DEFAULT_RPG3D_ACT_ID, sceneId: 'canvas-2', config: cloneConfig(DEFAULT_ARCADE_CONFIG) },
      ],
      rpg3dActiveCanvasId: 'canvas-2',
    };

    expect(getActiveRpg3DCanvas(project).id).toBe('canvas-2');
    expect(getDefaultPortalTargetCanvasId(project)).toBe('canvas-1');

    const afterDeletedActive = {
      ...project,
      rpg3dCanvases: [project.rpg3dCanvases[0]],
      rpg3dActiveCanvasId: 'canvas-2',
    };
    const cloned = cloneStudioProjectForEdit(afterDeletedActive);

    expect(cloned.rpg3dActiveCanvasId).toBe('canvas-1');
    expect(getActiveRpg3DCanvas(afterDeletedActive).id).toBe('canvas-1');
    expect(getDefaultPortalTargetCanvasId(afterDeletedActive)).toBe('');
  });

  it('creates a studio project from saved assets and exposes normalized canvas structure', () => {
    const project = createStudioProjectFromSavedAssets({
      title: 'Saved Studio',
      rpg3dActs: [{ id: 'act-1', name: 'Act 1' }],
      rpg3dScenes: [{ id: 'scene-1', name: 'Scene 1', actId: 'act-1', parentSceneId: 'root' }],
      rpg3dCanvases: [{ id: 'canvas-1', name: 'Canvas 1', actId: 'act-1', sceneId: 'scene-1', config: { meta: { title: 'Canvas title' } } }],
      rpg3dActiveCanvasId: 'canvas-1',
    });
    const structure = getRpg3DCanvasStructure(project);

    expect(project.title).toBe('Saved Studio');
    expect(structure.acts).toEqual([{ id: 'act-1', name: 'Act 1' }]);
    expect(structure.scenes).toEqual([{ id: 'scene-1', name: 'Scene 1', actId: 'act-1', parentSceneId: 'root' }]);
    expect(structure.canvases[0]).toMatchObject({
      id: 'canvas-1',
      name: 'Canvas 1',
      actId: 'act-1',
      sceneId: 'canvas-1',
    });
    expect(structure.canvases[0].config.meta.title).toBe(DEFAULT_ARCADE_CONFIG.meta.title);
  });

  it('syncs active canvas config by canvas id without mutating sibling canvases', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-03T04:05:06.000Z'));

    const firstConfig = cloneConfig(DEFAULT_ARCADE_CONFIG);
    firstConfig.meta.title = 'First';
    const secondConfig = cloneConfig(DEFAULT_ARCADE_CONFIG);
    secondConfig.meta.title = 'Second';
    const nextConfig = cloneConfig(DEFAULT_ARCADE_CONFIG);
    nextConfig.meta.title = 'Updated second';
    nextConfig.obstacles = [{ id: 'wall-1', x: 10, y: 20 }];

    const project = {
      ...createDefaultStudioProject(),
      rpg3dCanvases: [
        { id: 'canvas-1', name: 'One', actId: DEFAULT_RPG3D_ACT_ID, sceneId: 'canvas-1', config: firstConfig, updatedAt: 'old-first' },
        { id: 'canvas-2', name: 'Two', actId: DEFAULT_RPG3D_ACT_ID, sceneId: 'canvas-2', config: secondConfig, updatedAt: 'old-second' },
      ],
      rpg3dActiveCanvasId: 'canvas-1',
    };

    const synced = syncStudioProjectActiveCanvasConfig(project, nextConfig, 'canvas-2');

    expect(synced.rpg3dActiveCanvasId).toBe('canvas-2');
    expect(synced.rpg3dCanvases[0].config.meta.title).toBe(DEFAULT_ARCADE_CONFIG.meta.title);
    expect(synced.rpg3dCanvases[0].updatedAt).toBe('old-first');
    expect(synced.rpg3dCanvases[1].config.meta.title).toBe('Updated second');
    expect(synced.rpg3dCanvases[1].config.obstacles).toEqual([{ id: 'wall-1', x: 10, y: 20 }]);
    expect(synced.rpg3dCanvases[1].updatedAt).toBe('2025-02-03T04:05:06.000Z');
    expect(project.rpg3dActiveCanvasId).toBe('canvas-1');
    expect(project.rpg3dCanvases[1].config.meta.title).toBe('Second');
  });

  it('creates RPG 3D canvas drafts with a fresh config title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-04T05:06:07.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const draft = createRpg3DCanvasDraft({
      index: 2,
      actId: 'act-custom',
      sceneId: 'scene-custom',
      sceneName: 'Hidden room',
    });

    expect(draft.id).toMatch(/^rpg3d-canvas-/);
    expect(draft).toMatchObject({
      name: 'Hidden room',
      actId: 'act-custom',
      sceneId: 'scene-custom',
      createdAt: '2025-03-04T05:06:07.000Z',
      updatedAt: '2025-03-04T05:06:07.000Z',
    });
    expect(draft.config.meta.title).toBe('Hidden room');
    expect(draft.config).not.toBe(DEFAULT_ARCADE_CONFIG);
  });
});
