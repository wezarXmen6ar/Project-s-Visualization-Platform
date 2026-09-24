// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sampleProject } from '../testing/mockFetch';
import { PHASE_PALETTE, groupedPortfolioRows, phaseColorFor, phaseRows, portfolioRows, rangeFor } from './rows';

const project = sampleProject({
  id: 1, name: 'Portal', jiraKey: null, startDate: '2026-02-10',
  phases: [
    { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-02-10', end: '2026-02-11' },
    { id: 12, name: 'Development', order: 1, durationDays: 30, start: '2026-02-12', end: '2026-03-25' },
  ],
});

describe('rows', () => {
  it('makes one row per phase, colouring and labelling bars by phase name', () => {
    const rows = phaseRows(project);
    expect(rows.map((r) => r.label)).toEqual(['Requirements', 'Development']);
    expect(rows[1].bars[0]).toMatchObject({
      id: '12',
      start: '2026-02-12',
      end: '2026-03-25',
      color: phaseColorFor('Development'),
      label: 'Development',
    });
  });
  it('uses the phase order as id for unsaved phases', () => {
    const rows = phaseRows({ phases: [{ order: 0, name: 'A', start: '2026-01-01', end: '2026-01-02' }] });
    expect(rows[0].id).toBe('0');
  });
  it('makes one row per project with a bar per phase, coloured by phase name', () => {
    const rows = portfolioRows([project]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '1', label: 'Portal' });
    expect(rows[0].bars.map((b) => b.label)).toEqual(['Requirements', 'Development']);
    expect(rows[0].bars.map((b) => b.color)).toEqual([phaseColorFor('Requirements'), phaseColorFor('Development')]);
  });
  it('computes a month-padded range over all bars', () => {
    expect(rangeFor(phaseRows(project), '2030-01-01')).toEqual({ start: '2026-02-01', end: '2026-03-31' });
    expect(rangeFor([], '2026-09-24')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  describe('phaseColorFor', () => {
    it('is case-insensitive', () => {
      expect(phaseColorFor('Requirements')).toBe(phaseColorFor('requirements'));
    });
    it('treats a known alias as the same phase', () => {
      expect(phaseColorFor('Gathering Requirements')).toBe(phaseColorFor('Requirements'));
    });
    it('gives different known phases different colours', () => {
      expect(phaseColorFor('Requirements')).not.toBe(phaseColorFor('Development'));
    });
    it('derives a stable, palette colour for unknown phase names', () => {
      const a = phaseColorFor('Data Migration');
      const b = phaseColorFor('Rollback Planning');
      expect(phaseColorFor('Data Migration')).toBe(a);
      expect(a).not.toBe(b);
      expect(PHASE_PALETTE).toContain(a);
      expect(PHASE_PALETTE).toContain(b);
    });
  });

  it('groups projects under their main project with a summary bar, standalone projects last', () => {
    const phase = (start: string, end: string) => [{ id: 1, name: 'Development', order: 0, durationDays: 5, start, end }];
    const digital = { id: 20, name: 'Digital' };
    const a = sampleProject({ id: 1, name: 'A', mainProject: digital, phases: phase('2026-02-02', '2026-02-06') });
    const b = sampleProject({ id: 2, name: 'B', mainProject: null, phases: phase('2026-01-05', '2026-01-09') });
    const c = sampleProject({ id: 3, name: 'C', mainProject: digital, phases: phase('2026-03-02', '2026-03-20') });

    const rows = groupedPortfolioRows([a, b, c]);
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['group-20', 'group'],
      ['1', 'child'],
      ['3', 'child'],
      ['2', undefined],
    ]);
    expect(rows[0].label).toBe('Digital');
    expect(rows[0].bars).toEqual([
      expect.objectContaining({ id: 'group-20', start: '2026-02-02', end: '2026-03-20' }),
    ]);
  });
});
