import { describe, expect, it } from 'vitest';
import type { ProjectRecord } from '../../shared/types';
import { phaseRows, portfolioRows, rangeFor } from './rows';

const project: ProjectRecord = {
  id: 1, name: 'Portal', jiraKey: null, color: '#3b82f6', startDate: '2026-02-10',
  phases: [
    { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-02-10', end: '2026-02-11' },
    { id: 12, name: 'Development', order: 1, durationDays: 30, start: '2026-02-12', end: '2026-03-25' },
  ],
};

describe('rows', () => {
  it('makes one row per phase', () => {
    const rows = phaseRows(project);
    expect(rows.map((r) => r.label)).toEqual(['Requirements', 'Development']);
    expect(rows[1].bars[0]).toMatchObject({ id: '12', start: '2026-02-12', end: '2026-03-25', color: '#3b82f6' });
  });
  it('uses the phase order as id for unsaved phases', () => {
    const rows = phaseRows({ color: '#000000', phases: [{ order: 0, name: 'A', start: '2026-01-01', end: '2026-01-02' }] });
    expect(rows[0].id).toBe('0');
  });
  it('makes one row per project with a bar per phase', () => {
    const rows = portfolioRows([project]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '1', label: 'Portal' });
    expect(rows[0].bars.map((b) => b.label)).toEqual(['Requirements', 'Development']);
  });
  it('computes a month-padded range over all bars', () => {
    expect(rangeFor(phaseRows(project), '2030-01-01')).toEqual({ start: '2026-02-01', end: '2026-03-31' });
    expect(rangeFor([], '2026-09-24')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});
