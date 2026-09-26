// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { scheduleUpdateSchema } from '../../../shared/schemas';
import type { ToDoRecord } from '../../../shared/types';
import { sampleProject } from '../../testing/mockFetch';
import {
  detailsFromProject, detailsToInput, emptyDetails, firstStepWithIssue, phasesToInput, removedItems,
  scheduleFromProject, scheduleToInput, stepOfIssue, type PhaseDraft,
} from './projectDraft';

describe('projectDraft', () => {
  it('turns the four tables into one scope item list, in table order', () => {
    const d = emptyDetails();
    d.scope.objective = [{ text: 'Faster' }];
    d.scope.scope = [{ id: 5, text: 'Payments' }, { text: 'Accounts' }];
    expect(detailsToInput(d).scopeItems).toEqual([
      { id: 5, kind: 'scope', text: 'Payments' },
      { kind: 'scope', text: 'Accounts' },
      { kind: 'objective', text: 'Faster' },
    ]);
  });

  it('loads a saved project into a draft, sorting items and keeping their ids', () => {
    const d = detailsFromProject(sampleProject({
      jiraKey: null,
      projectManager: { id: 70, name: 'Sara' },
      projectType: { id: 2, name: 'Customer' },
      scopeItems: [
        { id: 7, kind: 'scope', text: 'Second', order: 1, dateAdded: '2026-09-24' },
        { id: 6, kind: 'scope', text: 'First', order: 0, dateAdded: '2026-09-24' },
      ],
    }));
    expect(d).toMatchObject({ jiraKey: '', projectManagerId: 70, projectTypeId: 2, mainProjectId: null });
    expect(d.scope.scope).toEqual([{ id: 6, text: 'First' }, { id: 7, text: 'Second' }]);
  });

  it('maps each error to the wizard step that owns the field', () => {
    expect(stepOfIssue({ path: 'name', message: '' })).toBe(0);
    expect(stepOfIssue({ path: 'departmentId', message: '' })).toBe(0);
    expect(stepOfIssue({ path: 'scopeItems.2.text', message: '' })).toBe(1);
    expect(stepOfIssue({ path: 'phases.0.durationDays', message: '' })).toBe(2);
    expect(stepOfIssue({ path: '', message: '' })).toBe(-1);
    expect(firstStepWithIssue([{ path: 'phases', message: '' }, { path: 'summary', message: '' }])).toBe(1);
    expect(firstStepWithIssue([{ path: '', message: 'Server down' }])).toBeNull();
  });

  it('sends each phase with its people, a row with no person as 0 so the server asks for one', () => {
    expect(phasesToInput([
      { name: 'Build', durationDays: 5, assignments: [{ resourceId: 71, allocation: 60, role: 'responsible' }, { resourceId: null, allocation: 100, role: 'contributor' }] },
      { name: 'QA', durationDays: 3 },
    ])).toEqual([
      { name: 'Build', durationDays: 5, assignments: [{ resourceId: 71, allocation: 60, role: 'responsible' }, { resourceId: 0, allocation: 100, role: 'contributor' }], subPhases: [] },
      { name: 'QA', durationDays: 3, assignments: [], subPhases: [] },
    ]);
  });

  it('sends people errors to the People step', () => {
    expect(stepOfIssue({ path: 'phases.2.assignments.0.resourceId', message: '' })).toBe(3);
    expect(stepOfIssue({ path: 'phases.2.name', message: '' })).toBe(2);
  });

  it('sends a sub-phase person error to the People step too', () => {
    expect(stepOfIssue({ path: 'phases.2.subPhases.0.assignments.1.resourceId', message: 'x' })).toBe(3);
  });

  it('maps a sub-phase draft assignment with no person chosen to resourceId 0', () => {
    const result = phasesToInput([
      {
        name: 'Development', durationDays: 10,
        subPhases: [
          {
            name: 'Increment 1', durationDays: 5, withPrevious: false,
            assignments: [{ resourceId: null, allocation: 50, role: 'contributor' }],
          },
        ],
      },
    ]);
    expect(result[0].subPhases).toEqual([
      { name: 'Increment 1', durationDays: 5, withPrevious: false, assignments: [{ resourceId: 0, allocation: 50, role: 'contributor' }] },
    ]);
  });

  it('round-trips a project with sub-phases through scheduleFromProject and scheduleToInput', () => {
    const p = sampleProject({
      startDate: '2026-10-05',
      phases: [
        {
          id: 12, name: 'Development', order: 0, durationDays: 10, start: '2026-10-05', end: '2026-10-16',
          subPhases: [
            { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
            { id: 22, name: 'Increment 2', order: 1, durationDays: 5, start: '2026-10-12', end: '2026-10-16', withPrevious: false },
          ],
        },
      ],
    });
    const draft = scheduleFromProject(p);
    expect(draft.startDate).toBe('2026-10-05');
    const input = scheduleToInput(draft.startDate, draft.phases);
    expect(input).toEqual({
      startDate: '2026-10-05',
      phases: [
        {
          id: 12, name: 'Development', durationDays: 10,
          subPhases: [
            { id: 21, name: 'Increment 1', durationDays: 5, withPrevious: false },
            { id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false },
          ],
        },
      ],
    });
  });

  describe('removedItems', () => {
    const project = sampleProject({
      phases: [
        {
          id: 12, name: 'Development', order: 0, durationDays: 10, start: '2026-10-05', end: '2026-10-16',
          subPhases: [
            { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
            { id: 22, name: 'Increment 2', order: 1, durationDays: 5, start: '2026-10-12', end: '2026-10-16', withPrevious: false },
          ],
        },
        { id: 13, name: 'QA', order: 1, durationDays: 5, start: '2026-10-19', end: '2026-10-23', subPhases: [] },
      ],
      assignments: [
        { id: 900, phaseId: 22, resource: { id: 71, name: 'Fatima Noor' }, allocation: 50, role: 'contributor' },
        { id: 901, phaseId: 22, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'contributor' },
      ],
    });
    const todo = (overrides: Partial<ToDoRecord> & Pick<ToDoRecord, 'id'>): ToDoRecord => ({
      projectId: 1, projectName: 'Portal', title: 'x', note: null, assignee: null, dueDate: null, done: false,
      doneDate: null, phase: null, formerPhase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z', ...overrides,
    });

    it('lists a removed sub-phase with its people', () => {
      const phases: PhaseDraft[] = [
        { id: 12, name: 'Development', durationDays: 5, subPhases: [{ id: 21, name: 'Increment 1', durationDays: 5, withPrevious: false }] },
        { id: 13, name: 'QA', durationDays: 5 },
      ];
      expect(removedItems(project, phases, [])).toEqual([{ label: 'Development › Increment 2', people: 2, openToDos: 0, doneToDos: 0 }]);
    });

    it('does not list a sub-phase moved under another phase', () => {
      const phases: PhaseDraft[] = [
        { id: 12, name: 'Development', durationDays: 5, subPhases: [{ id: 21, name: 'Increment 1', durationDays: 5, withPrevious: false }] },
        { id: 13, name: 'QA', durationDays: 5, subPhases: [{ id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false }] },
      ];
      expect(removedItems(project, phases, [])).toEqual([]);
    });

    it('does not list a removed phase that has no people and no to-dos', () => {
      const phases: PhaseDraft[] = [
        {
          id: 12, name: 'Development', durationDays: 10,
          subPhases: [
            { id: 21, name: 'Increment 1', durationDays: 5, withPrevious: false },
            { id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false },
          ],
        },
      ];
      expect(removedItems(project, phases, [])).toEqual([]);
    });

    it('counts open and done to-dos separately, and lists a removed sub-phase that has to-dos but no people', () => {
      // Removes sub-phase 21 (Increment 1) but keeps 22 (Increment 2), so only 21's to-dos should count.
      const phases: PhaseDraft[] = [
        { id: 12, name: 'Development', durationDays: 5, subPhases: [{ id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false }] },
        { id: 13, name: 'QA', durationDays: 5 },
      ];
      const todos = [
        todo({ id: 300, phase: { id: 21, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' } }),
        todo({ id: 301, phase: { id: 21, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' }, done: true, doneDate: '2026-10-01' }),
      ];
      expect(removedItems(project, phases, todos)).toEqual([
        { label: 'Development › Increment 1', people: 0, openToDos: 1, doneToDos: 1 },
      ]);
    });

    it('lists a removed sub-phase that has only done to-dos', () => {
      const phases: PhaseDraft[] = [
        { id: 12, name: 'Development', durationDays: 5, subPhases: [{ id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false }] },
        { id: 13, name: 'QA', durationDays: 5 },
      ];
      const todos = [
        todo({ id: 300, phase: { id: 21, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' }, done: true, doneDate: '2026-10-01' }),
      ];
      expect(removedItems(project, phases, todos)).toEqual([
        { label: 'Development › Increment 1', people: 0, openToDos: 0, doneToDos: 1 },
      ]);
    });
  });

  describe('phases with sub-phases', () => {
    it('phasesToInput sends the derived span for a phase with NaN duration and valid sub-phases', () => {
      const result = phasesToInput([
        {
          name: 'Dev',
          durationDays: NaN,
          subPhases: [
            { name: 'A', durationDays: 5, withPrevious: false },
            { name: 'B', durationDays: 3, withPrevious: false },
          ],
        },
      ]);
      expect(result[0].durationDays).toBe(8);
    });

    it('scheduleToInput sends the derived span for a phase with NaN duration and valid sub-phases', () => {
      const phases: PhaseDraft[] = [
        {
          name: 'Dev',
          durationDays: NaN,
          subPhases: [
            { name: 'A', durationDays: 5, withPrevious: false },
            { name: 'B', durationDays: 3, withPrevious: false },
          ],
        },
      ];
      const result = scheduleToInput('2026-10-05', phases);
      expect(result.phases[0].durationDays).toBe(8);
      expect(scheduleUpdateSchema.safeParse(result).success).toBe(true);
    });

    it('phasesToInput sends durationDays: 1 for a phase with all invalid sub-phases', () => {
      const result = phasesToInput([
        {
          name: 'Dev',
          durationDays: NaN,
          subPhases: [
            { name: '', durationDays: NaN, withPrevious: false },
            { name: '', durationDays: 0, withPrevious: false },
          ],
        },
      ]);
      expect(result[0].durationDays).toBe(1);
    });

    it('phasesToInput keeps the original durationDays for a phase without sub-phases', () => {
      const result = phasesToInput([
        { name: 'QA', durationDays: 7 },
      ]);
      expect(result[0].durationDays).toBe(7);
    });
  });
});
