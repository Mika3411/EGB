import { describe, expect, it } from 'vitest';
import {
  getVisitorHash,
  recordVisitorAnalytics,
  summarizeVisitorAnalytics,
} from '../../server/visitorAnalytics.js';

describe('visitor analytics', () => {
  it('deduplicates unique visitors while counting one visit per day and surface', () => {
    const day1 = new Date('2026-06-03T09:00:00.000Z').getTime();
    const day1Later = new Date('2026-06-03T18:00:00.000Z').getTime();
    const day2 = new Date('2026-06-04T09:00:00.000Z').getTime();

    const firstRecord = recordVisitorAnalytics({}, {
      scope: 'builder',
      visitorId: 'browser-1',
    }, day1);
    const sameDayRecord = recordVisitorAnalytics(firstRecord, {
      scope: 'builder',
      visitorId: 'browser-1',
    }, day1Later);
    const nextDayRecord = recordVisitorAnalytics(sameDayRecord, {
      scope: 'builder',
      visitorId: 'browser-1',
    }, day2);
    const galleryRecord = recordVisitorAnalytics(nextDayRecord, {
      scope: 'gallery',
      visitorId: 'browser-1',
    }, day2);

    const builder = galleryRecord.surfaces.builder;
    expect(builder.uniqueVisitors).toBe(1);
    expect(builder.visits).toBe(2);
    expect(Object.keys(builder.visitors)).toHaveLength(1);

    const summary = summarizeVisitorAnalytics(galleryRecord, day2);
    expect(summary.builder).toMatchObject({
      visitors: 1,
      visitors24h: 1,
      visits: 2,
    });
    expect(summary.gallery).toMatchObject({
      visitors: 1,
      visitors24h: 1,
      visits: 1,
    });
  });

  it('hashes explicit visitor ids without exposing the raw id', () => {
    const visitorHash = getVisitorHash({ visitorId: 'visitor-secret' });

    expect(visitorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(visitorHash).not.toContain('visitor-secret');
  });
});
