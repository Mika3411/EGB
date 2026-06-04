import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createInitialProject } from '../shared/data/projectData';
import { useProjectEditor } from '../app/builder/hooks/useProjectEditor.jsx';

describe('project editor history', () => {
  test('keeps several undo steps on media-heavy projects', () => {
    const mediaHeavyProject = createInitialProject();
    const largeImage = `data:image/png;base64,${'a'.repeat(9 * 1024 * 1024)}`;
    mediaHeavyProject.title = 'Depart';
    mediaHeavyProject.scenes[0].backgroundData = largeImage;

    const { result } = renderHook(() => useProjectEditor());

    act(() => {
      result.current.loadProject(mediaHeavyProject);
    });
    act(() => {
      result.current.patchProject((draft) => {
        draft.title = 'Premier geste';
      });
    });
    act(() => {
      result.current.patchProject((draft) => {
        draft.title = 'Deuxieme geste';
      });
    });
    act(() => {
      result.current.patchProject((draft) => {
        draft.title = 'Troisieme geste';
      });
    });

    expect(result.current.project.title).toBe('Troisieme geste');

    act(() => {
      result.current.undoProjectChange();
    });
    expect(result.current.project.title).toBe('Deuxieme geste');

    act(() => {
      result.current.undoProjectChange();
    });
    expect(result.current.project.title).toBe('Premier geste');

    act(() => {
      result.current.undoProjectChange();
    });
    expect(result.current.project.title).toBe('Depart');
    expect(result.current.project.scenes[0].backgroundData).toBe(largeImage);
  });

  test('preserves scene creation, deletion, hotspots, visible objects and redo', () => {
    const baseProject = createInitialProject();
    const { result } = renderHook(() => useProjectEditor());

    act(() => {
      result.current.loadProject(baseProject);
    });
    const initialSceneCount = result.current.project.scenes.length;

    act(() => {
      result.current.addScene();
    });
    const createdSceneId = result.current.selectedSceneId;
    expect(result.current.project.scenes).toHaveLength(initialSceneCount + 1);
    expect(result.current.project.scenes.some((scene) => scene.id === createdSceneId)).toBe(true);

    act(() => {
      result.current.addHotspot();
    });
    const sceneWithHotspot = result.current.project.scenes.find((scene) => scene.id === createdSceneId);
    expect(sceneWithHotspot.hotspots).toHaveLength(2);
    expect(sceneWithHotspot.hotspots.some((hotspot) => hotspot.id === result.current.selectedHotspotId)).toBe(true);

    act(() => {
      result.current.addSceneObject();
    });
    const createdObjectId = result.current.selectedSceneObjectId;
    expect(result.current.project.scenes.find((scene) => scene.id === createdSceneId).sceneObjects).toEqual([
      expect.objectContaining({
        id: createdObjectId,
        name: 'Objet visible 1',
        interactionMode: 'both',
      }),
    ]);

    act(() => {
      result.current.undoProjectChange();
    });
    expect(result.current.project.scenes.find((scene) => scene.id === createdSceneId).sceneObjects).toEqual([]);

    act(() => {
      result.current.redoProjectChange();
    });
    expect(result.current.project.scenes.find((scene) => scene.id === createdSceneId).sceneObjects).toEqual([
      expect.objectContaining({ id: createdObjectId }),
    ]);

    act(() => {
      result.current.deleteSceneObject(createdSceneId, createdObjectId);
    });
    expect(result.current.project.scenes.find((scene) => scene.id === createdSceneId).sceneObjects).toEqual([]);

    act(() => {
      result.current.undoProjectChange();
    });
    expect(result.current.project.scenes.find((scene) => scene.id === createdSceneId).sceneObjects).toEqual([
      expect.objectContaining({ id: createdObjectId }),
    ]);

    act(() => {
      result.current.deleteScene(createdSceneId);
    });
    expect(result.current.project.scenes.some((scene) => scene.id === createdSceneId)).toBe(false);

    act(() => {
      result.current.undoProjectChange();
    });
    const restoredScene = result.current.project.scenes.find((scene) => scene.id === createdSceneId);
    expect(restoredScene).toBeTruthy();
    expect(restoredScene.hotspots).toHaveLength(2);
    expect(restoredScene.sceneObjects).toEqual([expect.objectContaining({ id: createdObjectId })]);

    act(() => {
      result.current.redoProjectChange();
    });
    expect(result.current.project.scenes.some((scene) => scene.id === createdSceneId)).toBe(false);
  });
});
