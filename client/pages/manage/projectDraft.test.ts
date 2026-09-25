// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../testing/mockFetch';
import { detailsFromProject, detailsToInput, emptyDetails, firstStepWithIssue, phasesToInput, stepOfIssue } from './projectDraft';

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
      { name: 'Build', durationDays: 5, assignments: [{ resourceId: 71, allocation: 60, role: 'responsible' }, { resourceId: 0, allocation: 100, role: 'contributor' }] },
      { name: 'QA', durationDays: 3, assignments: [] },
    ]);
  });

  it('sends people errors to the People step', () => {
    expect(stepOfIssue({ path: 'phases.2.assignments.0.resourceId', message: '' })).toBe(3);
    expect(stepOfIssue({ path: 'phases.2.name', message: '' })).toBe(2);
  });
});
