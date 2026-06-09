import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { usePreviewPlayer } from '../domains/player/hooks/usePreviewPlayer';

const readBeaconPayload = async (sendBeacon, callIndex = 0) => JSON.parse(await sendBeacon.mock.calls[callIndex][1].text());

const makeProProject = () => ({
  id: 'pro-page-1',
  title: 'Vitrine Montpellier',
  creationMode: 'pro_promo',
  proPage: { kind: 'showcase' },
  start: { type: 'scene', targetSceneId: 'scene-1' },
  acts: [],
  items: [],
  scenes: [{
    id: 'scene-1',
    name: 'Accueil',
    introText: '',
    hotspots: [
      {
        id: 'hotspot-reserve',
        name: 'Réserver une session',
        actionType: 'external_link',
        externalUrl: 'https://example.com/reserver',
      },
      {
        id: 'hotspot-prologue',
        name: 'Accéder au prologue',
        actionType: 'project_link',
        targetProjectUserId: 'user-2',
        targetProjectId: 'project-2',
      },
    ],
    sceneObjects: [
      {
        id: 'block-reserve',
        name: 'CTA interne',
        blockType: 'button',
        blockLabel: 'Bouton',
        buttonLabel: 'Réserver une session',
        clickMode: 'action',
        actionType: 'external_link',
        externalUrl: 'https://example.com/reserver',
      },
    ],
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const renderPreview = () => {
  const project = makeProProject();
  return {
    project,
    ...renderHook(() => usePreviewPlayer(project, {
      getItemById: (itemId) => project.items.find((item) => item.id === itemId),
    })),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('preview player pro click analytics', () => {
  test('tracks external_link zone clicks before opening the target', async () => {
    const sendBeacon = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ opener: null }));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    const { project, result } = renderPreview();

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });

    expect(openSpy).toHaveBeenCalledWith('https://example.com/reserver', '_blank', 'noopener,noreferrer');
    const payload = await readBeaconPayload(sendBeacon);
    expect(payload).toMatchObject({
      scope: 'pro_click',
      projectId: 'pro-page-1',
      projectTitle: 'Vitrine Montpellier',
      sceneId: 'scene-1',
      sceneName: 'Accueil',
      elementId: 'hotspot-reserve',
      elementName: 'Réserver une session',
      actionType: 'external_link',
      targetType: 'external',
      targetUrl: 'https://example.com/reserver',
    });
  });

  test('tracks project_link zone clicks before opening the target project', async () => {
    const sendBeacon = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ opener: null }));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    const { project, result } = renderPreview();

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[1]);
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const payload = await readBeaconPayload(sendBeacon);
    expect(payload).toMatchObject({
      elementId: 'hotspot-prologue',
      elementName: 'Accéder au prologue',
      actionType: 'project_link',
      targetType: 'project',
      targetProjectId: 'project-2',
      targetProjectUserId: 'user-2',
    });
    expect(payload.targetUrl).toContain('playUser=user-2');
    expect(payload.targetUrl).toContain('playProject=project-2');
  });

  test('tracks clickable showcase text and block actions with the visible label', async () => {
    const sendBeacon = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ opener: null }));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    const { project, result } = renderPreview();

    act(() => {
      result.current.triggerHotspot(project.scenes[0].sceneObjects[0]);
    });

    expect(openSpy).toHaveBeenCalledWith('https://example.com/reserver', '_blank', 'noopener,noreferrer');
    const payload = await readBeaconPayload(sendBeacon);
    expect(payload).toMatchObject({
      elementId: 'block-reserve',
      elementName: 'Réserver une session',
      actionType: 'external_link',
      targetType: 'external',
      targetUrl: 'https://example.com/reserver',
    });
  });
});
