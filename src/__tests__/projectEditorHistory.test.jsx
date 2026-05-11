import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createInitialProject } from '../data/projectData';
import { useProjectEditor } from '../hooks/useProjectEditor.jsx';

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
});
