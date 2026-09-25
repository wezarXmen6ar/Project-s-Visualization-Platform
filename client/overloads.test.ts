// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { overloadsWith, phaseWarnings, shortDate } from './overloads';
import { sampleWorkload } from './testing/mockFetch';

const fatimaAt = (allocation: number, start = '2026-10-05', end = '2026-10-16') =>
  ({ resourceId: 71, start, end, allocation, projectName: 'Portal', phaseName: 'Requirements' });

describe('overloads', () => {
  it('writes short dates', () => {
    expect(shortDate('2026-10-05')).toBe('5 Oct');
    expect(shortDate('2026-12-31')).toBe('31 Dec');
  });

  it('adds planned work to what is already booked and keeps only the overbooked weeks', () => {
    // Fatima is already 100% on HR QA until 9 Oct.
    const overloads = overloadsWith(sampleWorkload(), [fatimaAt(50)]);
    expect([...overloads.keys()]).toEqual([71]);
    expect(overloads.get(71)!.map((w) => [w.weekStart, w.load])).toEqual([['2026-10-05', 150]]);
  });

  it('leaves out saved assignments that are being replaced', () => {
    expect(overloadsWith(sampleWorkload(), [fatimaAt(50)], [500]).size).toBe(0);
  });

  it('checks nothing when nothing is planned', () => {
    expect(overloadsWith(sampleWorkload(), []).size).toBe(0);
  });

  it("writes one line per overbooked week that touches the phase, mentioning leave", () => {
    const data = sampleWorkload();
    // Rami: 60% on Case Management until 16 Oct, capacity 80, on leave 19–20 Oct.
    const rami = { resourceId: 72, start: '2026-10-05', end: '2026-10-23', allocation: 40, projectName: 'Portal', phaseName: 'Dev' };
    const overloads = overloadsWith(data, [rami]);
    expect(phaseWarnings(overloads, { start: '2026-10-05', end: '2026-10-23' }).get(72)).toEqual([
      'Week of 5 Oct: 100% booked, 80% available',
      'Week of 12 Oct: 100% booked, 80% available',
    ]);
    const heavy = overloadsWith(data, [{ ...rami, allocation: 80 }]);
    expect(phaseWarnings(heavy, { start: '2026-10-19', end: '2026-10-23' }).get(72)).toEqual([
      'Week of 19 Oct: 80% booked, 48% available (2 days of leave)',
    ]);
  });
});
