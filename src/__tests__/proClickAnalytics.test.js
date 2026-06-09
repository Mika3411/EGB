import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  makeProClickPayload,
  sendProClickPayload,
  trackProClick,
} from '../shared/services/proClickAnalytics.js';
import {
  recordProClickAnalytics,
  summarizeProClickAnalytics,
} from '../../server/proClickAnalytics.js';

const readBlobJson = async (blob) => JSON.parse(await blob.text());

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('pro click analytics', () => {
  it('builds a pro click payload for external link hotspots', () => {
    const payload = makeProClickPayload({
      id: 'reserve-button',
      name: 'CTA interne',
      buttonLabel: 'Réserver une session',
      actionType: 'external_link',
    }, {
      now: Date.parse('2026-06-08T10:15:00.000Z'),
      targetUrl: 'https://example.com/reserver',
      project: { id: 'project-1', title: 'Vitrine Montpellier', userId: 'user-1' },
      scene: { id: 'scene-1', name: 'Accueil' },
      source: 'preview-player',
    });

    expect(payload).toMatchObject({
      scope: 'pro_click',
      event: 'click',
      clickedAt: '2026-06-08T10:15:00.000Z',
      source: 'preview-player',
      projectId: 'project-1',
      projectTitle: 'Vitrine Montpellier',
      userId: 'user-1',
      sceneId: 'scene-1',
      sceneName: 'Accueil',
      elementId: 'reserve-button',
      elementName: 'Réserver une session',
      actionType: 'external_link',
      targetType: 'external',
      targetUrl: 'https://example.com/reserver',
    });
    expect(payload.visitorId).toBeTruthy();
  });

  it('uses the dedicated analytics label before the visible or internal labels', () => {
    const payload = makeProClickPayload({
      id: 'reserve-button',
      name: 'CTA interne',
      buttonLabel: 'Bouton visible',
      analyticsLabel: 'Réserver une session',
      actionType: 'external_link',
    }, {
      targetUrl: 'https://example.com/reserver',
    });

    expect(payload.elementName).toBe('Réserver une session');
  });

  it('uses sendBeacon when available so the click survives a tab change', async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    expect(sendProClickPayload({ elementName: 'Réserver une session' }, { endpoint: '/api/analytics/click' })).toBe(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe('/api/analytics/click');
    expect(await readBlobJson(sendBeacon.mock.calls[0][1])).toEqual({ elementName: 'Réserver une session' });
  });

  it('falls back to fetch keepalive when sendBeacon is unavailable', () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn(() => false) });
    vi.stubGlobal('fetch', fetchSpy);

    expect(sendProClickPayload({ elementName: 'Réserver une session' }, { endpoint: '/api/analytics/click' })).toBe(true);

    expect(fetchSpy).toHaveBeenCalledWith('/api/analytics/click', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ elementName: 'Réserver une session' }),
      keepalive: true,
    }));
  });

  it('does not send analytics for non-link actions', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    expect(trackProClick({ id: 'note', actionType: 'dialogue' })).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('aggregates server clicks by clickable element', () => {
    const now = Date.parse('2026-06-08T10:15:00.000Z');
    const firstRecord = recordProClickAnalytics({}, {
      visitorId: 'visitor-1',
      userId: 'user-1',
      projectId: 'project-1',
      projectTitle: 'Vitrine Montpellier',
      sceneId: 'scene-1',
      sceneName: 'Accueil',
      elementId: 'reserve-button',
      elementName: 'Réserver une session',
      actionType: 'external_link',
      targetUrl: 'https://example.com/reserver',
    }, now);
    const nextRecord = recordProClickAnalytics(firstRecord, {
      visitorId: 'visitor-2',
      userId: 'user-1',
      projectId: 'project-1',
      projectTitle: 'Vitrine Montpellier',
      sceneId: 'scene-1',
      sceneName: 'Accueil',
      elementId: 'reserve-button',
      elementName: 'Réserver une session',
      actionType: 'external_link',
      targetUrl: 'https://example.com/reserver',
    }, now + 1000);

    const summary = summarizeProClickAnalytics(nextRecord, now + 1000);

    expect(summary.clicks).toBe(2);
    expect(summary.elements).toHaveLength(1);
    expect(summary.elements[0]).toMatchObject({
      projectId: 'project-1',
      elementId: 'reserve-button',
      elementName: 'Réserver une session',
      clicks: 2,
      clicks7d: 2,
      clicks30d: 2,
      uniqueVisitors: 2,
    });
  });
});
