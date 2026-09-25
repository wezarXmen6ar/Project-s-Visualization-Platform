// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sampleProject } from '../testing/mockFetch';
import type { AssignmentRecord } from '../../shared/types';
import { PHASE_PALETTE, assignLanes, groupedPortfolioRows, phaseColorFor, phaseRows, portfolioRows, rangeFor } from './rows';

const project = sampleProject({
  id: 1, name: 'Portal', jiraKey: null, startDate: '2026-02-10',
  phases: [
    { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-02-10', end: '2026-02-11', subPhases: [] },
    { id: 12, name: 'Development', order: 1, durationDays: 30, start: '2026-02-12', end: '2026-03-25', subPhases: [] },
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
    it('gives every standard phase its own colour, with Go-live the same as Launch', () => {
      const standard = [
        'Requirements gathering', 'Business analysis', 'Design', 'Development plan', 'Development', 'QA', 'UAT',
        'Security testing', 'Deployment', 'Launch',
      ];
      expect(new Set(standard.map((name) => phaseColorFor(name))).size).toBe(standard.length);
      expect(phaseColorFor('Go-live')).toBe(phaseColorFor('Launch'));
    });
  });

  it('groups projects under their main project with a summary bar, standalone projects last', () => {
    const phase = (start: string, end: string) => [{ id: 1, name: 'Development', order: 0, durationDays: 5, start, end, subPhases: [] }];
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

describe('assignLanes', () => {
  it('puts a sub-phase that runs alongside another on the next lane', () => {
    const increments = [
      { start: '2026-11-30', end: '2026-12-18' },
      { start: '2026-11-30', end: '2026-12-18' },
      { start: '2026-12-21', end: '2027-01-22' },
      { start: '2027-01-25', end: '2027-02-19' },
    ];
    expect(assignLanes(increments)).toEqual([0, 1, 0, 0]);
  });

  it('keeps sub-phases that run one after another on lane 0', () => {
    expect(assignLanes([
      { start: '2026-10-05', end: '2026-10-09' },
      { start: '2026-10-12', end: '2026-10-16' },
      { start: '2026-10-19', end: '2026-10-23' },
    ])).toEqual([0, 0, 0]);
  });

  it('counts sharing a single day as overlapping', () => {
    expect(assignLanes([
      { start: '2026-10-05', end: '2026-10-09' },
      { start: '2026-10-09', end: '2026-10-16' },
    ])).toEqual([0, 1]);
  });
});

const eServices = {
  phases: [
    { id: 1, order: 0, name: 'Requirements', start: '2026-11-16', end: '2026-11-27', subPhases: [] },
    {
      id: 2, order: 1, name: 'Development', start: '2026-11-30', end: '2027-02-19',
      subPhases: [
        { id: 21, order: 0, name: 'Increment 1 – Sign-in and profile', start: '2026-11-30', end: '2026-12-18' },
        { id: 22, order: 1, name: 'Increment 2 – Service catalogue', start: '2026-11-30', end: '2026-12-18' },
        { id: 23, order: 2, name: 'Increment 3 – Payments', start: '2026-12-21', end: '2027-01-22' },
        { id: 24, order: 3, name: 'Increment 4 – Notifications', start: '2027-01-25', end: '2027-02-19' },
      ],
    },
    {
      id: 3, order: 2, name: 'QA', start: '2027-02-22', end: '2027-03-12',
      subPhases: [
        { id: 31, order: 0, name: 'Round 1', start: '2027-02-22', end: '2027-03-01' },
        { id: 32, order: 1, name: 'Round 2', start: '2027-03-02', end: '2027-03-12' },
      ],
    },
  ],
};

describe('phaseRows with sub-phases', () => {
  it('divides the phase bar into its sequential sub-phases and puts a parallel one on a lane row', () => {
    const rows = phaseRows(eServices);
    expect(rows.map((r) => [r.id, r.kind ?? 'row'])).toEqual([
      ['1', 'row'],
      ['2', 'row'],
      ['2-lane-1', 'lane'],
      ['3', 'row'],
    ]);
    const dev = rows[1].bars[0];
    expect(dev).toMatchObject({ id: '2', start: '2026-11-30', end: '2027-02-19', color: phaseColorFor('Development') });
    expect(dev.segments?.map((s) => s.label)).toEqual([
      'Increment 1 – Sign-in and profile',
      'Increment 3 – Payments',
      'Increment 4 – Notifications',
    ]);
    expect(rows[2].label).toBe('');
    expect(rows[2].bars).toEqual([
      expect.objectContaining({
        id: '22', start: '2026-11-30', end: '2026-12-18', label: 'Increment 2 – Service catalogue', color: phaseColorFor('Development'),
      }),
    ]);
  });

  it('gives a phase with only sequential sub-phases no lane row', () => {
    const rows = phaseRows(eServices);
    expect(rows.filter((r) => r.kind === 'lane').map((r) => r.id)).toEqual(['2-lane-1']);
    expect(rows[3].bars[0].segments?.map((s) => s.label)).toEqual(['Round 1', 'Round 2']);
  });

  it('draws a phase without sub-phases as a plain bar', () => {
    const [req] = phaseRows(eServices);
    expect(req.bars).toHaveLength(1);
    expect(req.bars[0].segments).toBeUndefined();
  });

  it('describes a segment with its full name, dates and working days', () => {
    const dev = phaseRows(eServices)[1].bars[0];
    expect(dev.segments?.[0].detail).toEqual({
      title: 'Development › Increment 1 – Sign-in and profile',
      lines: ['Mon 30 Nov 2026 – Fri 18 Dec 2026 · 15 working days'],
    });
    expect(dev.detail?.title).toBe('Development');
  });

  it('counts working days with the given calendar', () => {
    const calendar = { weekendDays: [0, 6], holidays: [{ start: '2026-12-02', end: '2026-12-02' }] };
    const dev = phaseRows(eServices, { calendar })[1].bars[0];
    expect(dev.segments?.[0].detail?.lines[0]).toBe('Mon 30 Nov 2026 – Fri 18 Dec 2026 · 14 working days');
  });

  it('lists the people on exactly that piece when people are given, and none otherwise', () => {
    const people: AssignmentRecord[] = [
      { id: 1, phaseId: 21, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' },
      { id: 2, phaseId: 2, resource: { id: 72, name: 'Rami Saleh' }, allocation: 30, role: 'contributor' },
      { id: 3, phaseId: 22, resource: { id: 73, name: 'Omar Khalid' }, allocation: 100, role: 'contributor' },
    ];
    const rows = phaseRows(eServices, { people });
    const dev = rows[1].bars[0];
    expect(dev.segments?.[0].detail?.lines.slice(1)).toEqual(['Fatima Noor · 60% · Responsible']);
    expect(dev.segments?.[1].detail?.lines).toHaveLength(1);
    expect(dev.detail?.lines.slice(1)).toEqual(['Rami Saleh · 30% · Contributor']);
    expect(rows[2].bars[0].detail?.lines.slice(1)).toEqual(['Omar Khalid · 100% · Contributor']);

    const anonymous = phaseRows(eServices)[1].bars[0];
    expect(anonymous.detail?.lines).toHaveLength(1);
    expect(anonymous.segments?.[0].detail?.lines).toHaveLength(1);
  });

  it('gives draft sub-phases without ids stable ids', () => {
    const rows = phaseRows({
      phases: [{
        order: 0, name: 'Dev', start: '2026-10-05', end: '2026-10-09',
        subPhases: [
          { order: 0, name: 'S', start: '2026-10-05', end: '2026-10-09' },
          { order: 1, name: 'T', start: '2026-10-05', end: '2026-10-09' },
        ],
      }],
    });
    expect(rows.map((r) => r.id)).toEqual(['0', '0-lane-1']);
    expect(rows[0].bars[0].segments?.map((s) => s.id)).toEqual(['0-0']);
    expect(rows[1].bars.map((b) => b.id)).toEqual(['0-1']);
  });

  it('keeps the portfolio to one bar per top-level phase', () => {
    const [row] = portfolioRows([sampleProject({ phases: eServices.phases.map((p) => ({ ...p, durationDays: 5, subPhases: p.subPhases.map((sp) => ({ ...sp, durationDays: 5, withPrevious: false })) })) })]);
    expect(row.bars).toHaveLength(3);
  });
});
