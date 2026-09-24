import { describe, expect, it } from 'vitest';
import { overlapsYear, portfolioStats, projectStatus } from './portfolio';

const today = '2026-09-24';
const p = (start: string, end: string) => ({ phases: [{ start, end }] });

describe('projectStatus', () => {
  it('classifies by today', () => {
    expect(projectStatus({ start: '2026-10-01', end: '2026-12-01' }, today)).toBe('planned');
    expect(projectStatus({ start: '2026-09-24', end: '2026-12-01' }, today)).toBe('active');
    expect(projectStatus({ start: '2026-01-01', end: '2026-09-24' }, today)).toBe('active');
    expect(projectStatus({ start: '2026-01-01', end: '2026-09-23' }, today)).toBe('done');
  });
});

describe('overlapsYear', () => {
  it('detects any overlap with the calendar year', () => {
    expect(overlapsYear({ start: '2025-11-01', end: '2026-01-05' }, 2026)).toBe(true);
    expect(overlapsYear({ start: '2025-01-01', end: '2025-12-31' }, 2026)).toBe(false);
  });
});

describe('portfolioStats', () => {
  it('counts active, finished this year and starting this year', () => {
    const projects = [
      p('2026-01-05', '2026-01-09'), // done in 2026
      p('2025-03-03', '2025-03-07'), // done in 2025
      p('2026-09-01', '2026-11-30'), // active
      p('2026-11-02', '2026-11-13'), // planned, starts 2026
      p('2027-02-01', '2027-03-01'), // planned, starts 2027
      { phases: [] },                // no phases: ignored
    ];
    expect(portfolioStats(projects, 2026, today)).toEqual({ active: 1, finishedThisYear: 1, startingThisYear: 1 });
    expect(portfolioStats(projects, 2027, today)).toEqual({ active: 1, finishedThisYear: 0, startingThisYear: 1 });
  });
});
