import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SceneObjectEditPanel from '../domains/scenes/studio/components/SceneObjectEditPanel.jsx';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';

vi.mock('../shared/ui/media/MediaSourcePicker.jsx', () => ({
  default: ({ children, onSelect, tourId }) => (
    <button
      type="button"
      data-tour={tourId}
      onClick={() => onSelect?.('data:image/png;base64,bmV3LWltYWdl', 'new-zone.png')}
    >
      {children}
    </button>
  ),
}));

afterEach(() => cleanup());

describe('SceneObjectEditPanel images', () => {
  test("remplace l'image visible d'une image-zone en mode action", () => {
    const project = normalizeProject(createInitialProject());
    const selectedSceneObject = {
      id: 'zone-1',
      name: 'Zone cliquable',
      x: 30,
      y: 30,
      width: 20,
      height: 16,
      clickMode: 'action',
      actionType: 'dialogue',
      imageId: 'old-visible-asset',
      imageData: 'data:image/png;base64,b2xkLXpvbmU=',
      imageName: 'old-zone.png',
      objectImageData: 'data:image/png;base64,cG9wdXA=',
      objectImageName: 'popup.png',
    };
    project.scenes[0].sceneObjects = [selectedSceneObject];
    const patchProject = (updater) => updater(project);

    render(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId={project.scenes[0].id}
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId={selectedSceneObject.id}
        patchProject={patchProject}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
        getSceneLabel={(id) => id}
        setSelectedSceneObjectId={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: "Remplacer l'image" }));

    expect(project.scenes[0].sceneObjects[0].imageData).toBe('data:image/png;base64,bmV3LWltYWdl');
    expect(project.scenes[0].sceneObjects[0].imageName).toBe('new-zone.png');
    expect(project.scenes[0].sceneObjects[0].imageId).toBe('');
    expect(project.scenes[0].sceneObjects[0].objectImageData).toBe('data:image/png;base64,cG9wdXA=');
    expect(screen.getByText('Image pop-up')).toBeTruthy();
  });
});
