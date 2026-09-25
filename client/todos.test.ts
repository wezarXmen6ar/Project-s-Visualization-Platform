// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sampleProject, samplePeople, sampleToDos } from './testing/mockFetch';
import { assigneeChoices, byUrgency, dueLabel, formerPhaseLabel, isOverdue, phaseChoices, toDoToInput } from './todos';
import type { Me } from '../shared/types';

const today = '2026-10-07';

describe('isOverdue', () => {
  it('is true only for the open item due before today', () => {
    const todos = sampleToDos();
    const overdue = todos.find((t) => t.id === 200)!; // dueDate 2026-10-01, open
    const later = todos.find((t) => t.id === 201)!; // dueDate 2026-10-20, open
    const done = todos.find((t) => t.id === 203)!; // done
    const undated = todos.find((t) => t.id === 202)!; // no due date
    expect(isOverdue(overdue, today)).toBe(true);
    expect(isOverdue(later, today)).toBe(false);
    expect(isOverdue(done, today)).toBe(false);
    expect(isOverdue(undated, today)).toBe(false);
  });
});

describe('byUrgency', () => {
  it('orders overdue, then due later, then undated, with ties by id', () => {
    const todos = sampleToDos();
    const ordered = byUrgency(todos);
    expect(ordered.map((t) => t.id)).toEqual([200, 201, 202, 203, 204, 205]);
    // it is a copy, not a mutation of the original array
    expect(ordered).not.toBe(todos);
  });
});

describe('dueLabel', () => {
  it('labels overdue, due today, due later and undated', () => {
    const todos = sampleToDos();
    const overdue = todos.find((t) => t.id === 200)!;
    const undated = todos.find((t) => t.id === 202)!;
    expect(dueLabel(overdue, today)).toBe('Overdue · Thu 1 Oct');
    expect(dueLabel({ ...overdue, dueDate: '2026-10-07' }, today)).toBe('Due today');
    expect(dueLabel({ ...overdue, dueDate: '2026-10-10' }, today)).toBe('Due Sat 10 Oct');
    expect(dueLabel(undated, today)).toBe('');
  });
});

describe('assigneeChoices', () => {
  const project = sampleProject({
    projectManager: { id: 70, name: 'Sara Ahmed' },
    businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: null, email: null },
    assignments: [
      { id: 300, phaseId: 12, resource: { id: 71, name: 'Fatima Noor' }, allocation: 50, role: 'responsible' },
      { id: 301, phaseId: 12, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'contributor' },
    ],
  });

  it('excludes me from managers, and sets me', () => {
    const me: Me = { resourceId: 70, name: 'Sara Ahmed' };
    const choices = assigneeChoices(project, me, null);
    expect(choices.me).toEqual({ id: 70, name: 'Sara Ahmed' });
    expect(choices.managers.some((m) => m.id === 70)).toBe(false);
  });

  it('labels the business PM', () => {
    const me: Me = { resourceId: null, name: null };
    const choices = assigneeChoices(project, me, null);
    expect(choices.managers).toContainEqual({ id: 80, label: 'Mariam Al Suwaidi (business PM)' });
    expect(choices.managers).toContainEqual({ id: 70, label: 'Sara Ahmed (project manager)' });
  });

  it('lists assigned people once each, sorted', () => {
    const me: Me = { resourceId: null, name: null };
    const choices = assigneeChoices(project, me, null);
    expect(choices.team).toEqual([{ id: 71, name: 'Fatima Noor' }, { id: 72, name: 'Rami Saleh' }]);
  });

  it('sets former for an assignee not on the project', () => {
    const me: Me = { resourceId: null, name: null };
    const choices = assigneeChoices(project, me, { id: 80 + 1, name: 'Someone Else' } as any);
    expect(choices.former).toEqual({ id: 81, name: 'Someone Else' });
  });
});

describe('phaseChoices', () => {
  it('lists phases and sub-phases in plan order', () => {
    const project = sampleProject({
      phases: [
        {
          id: 12, name: 'Development', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09',
          subPhases: [{ id: 120, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false }],
        },
      ],
    });
    expect(phaseChoices(project)).toEqual([
      { id: 12, name: 'Development' },
      { id: 120, name: 'Development › Increment 1' },
    ]);
  });
});

describe('toDoToInput', () => {
  it('converts a record to an input, with an optional patch', () => {
    const t = sampleToDos()[0];
    expect(toDoToInput(t)).toEqual({
      title: t.title, note: t.note, assigneeId: t.assignee?.id ?? null, dueDate: t.dueDate, phaseId: t.phase?.id ?? null, done: t.done,
    });
    expect(toDoToInput(t, { done: true })).toEqual({
      title: t.title, note: t.note, assigneeId: t.assignee?.id ?? null, dueDate: t.dueDate, phaseId: t.phase?.id ?? null, done: true,
    });
  });
});

describe('the to-do labels in Arabic', () => {
  const [overdue] = sampleToDos();

  it('writes due labels in Arabic', () => {
    expect(dueLabel(overdue, today, 'ar')).toBe('متأخرة · الخميس 1 أكتوبر');
    expect(dueLabel({ ...overdue, dueDate: '2026-10-07' }, today, 'ar')).toBe('التسليم اليوم');
    expect(dueLabel({ ...overdue, dueDate: '2026-10-10' }, today, 'ar')).toBe('التسليم: السبت 10 أكتوبر');
  });

  it('writes the former phase in Arabic, translating only the phase part', () => {
    const kept = {
      ...overdue,
      formerPhase: { name: 'Development › Increment 2', phaseName: 'Development', subPhaseName: 'Increment 2', removedOn: '2026-09-25' },
    };
    expect(formerPhaseLabel(kept)).toBe('Was on Development › Increment 2 (removed Fri 25 Sep)');
    expect(formerPhaseLabel(kept, 'ar', (n) => (n === 'Development' ? 'التطوير' : n))).toBe(
      'كانت ضمن التطوير › Increment 2 (حُذفت في الجمعة 25 سبتمبر)',
    );
  });

  it('labels the managers in Arabic, and translates phase choices', () => {
    const project = sampleProject({
      projectManager: { id: 70, name: 'Sara Ahmed' },
      businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: null, email: null },
    });
    const choices = assigneeChoices(project, { resourceId: null, name: null }, null, 'ar');
    expect(choices.managers).toEqual([
      { id: 70, label: 'Sara Ahmed (مدير المشروع)' },
      { id: 80, label: 'Mariam Al Suwaidi (مدير مشروع مالك العملية)' },
    ]);
    expect(phaseChoices(project, (n) => (n === 'Development' ? 'التطوير' : n))).toContainEqual({ id: 120, name: 'التطوير › Increment 1' });
  });
});
