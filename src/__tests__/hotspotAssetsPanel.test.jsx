import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HotspotAssetsPanel from '../domains/scenes/studio/components/HotspotAssetsPanel.jsx';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';

vi.mock('../shared/ui/media/MediaSourcePicker.jsx', () => ({
  default: ({ children, onSelect, tourId }) => (
    <button
      type="button"
      data-tour={tourId}
      onClick={() => onSelect?.('data:image/png;base64,bmV3LWhvdHNwb3Q=', 'new-hotspot.png')}
    >
      {children}
    </button>
  ),
}));

afterEach(() => cleanup());

describe('HotspotAssetsPanel', () => {
  test("remplace l'image de zone et décroche l'ancien asset id", () => {
    const project = normalizeProject(createInitialProject());
    const selectedHotspot = {
      id: 'spot-1',
      name: 'Zone',
      objectImageId: 'old-asset-id',
      objectImageData: 'data:image/png;base64,b2xkLWhvdHNwb3Q=',
      objectImageName: 'old-hotspot.png',
    };
    project.scenes[0].hotspots = [selectedHotspot];
    const patchProject = (updater) => updater(project);

    render(
      <HotspotAssetsPanel
        selectedHotspot={selectedHotspot}
        selectedSceneId={project.scenes[0].id}
        selectedHotspotId={selectedHotspot.id}
        patchProject={patchProject}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: "Remplacer l'image" }));

    expect(project.scenes[0].hotspots[0].objectImageData).toBe('data:image/png;base64,bmV3LWhvdHNwb3Q=');
    expect(project.scenes[0].hotspots[0].objectImageName).toBe('new-hotspot.png');
    expect(project.scenes[0].hotspots[0].objectImageId).toBe('');
  });
});
