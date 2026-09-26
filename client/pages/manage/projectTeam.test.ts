import { describe, expect, it } from 'vitest';
import { sampleProject, samplePeople, sampleToDos } from '../../testing/mockFetch';
import { buildTeamBlocks, personAssignments } from './projectTeam';

const TODAY = '2026-09-29';

function project() {
  return sampleProject({
    projectManager: { id: 70, name: 'Sara Ahmed' },
    businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: null, email: null },
    assignments: [
      { id: 300, phaseId: 120, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' },
      { id: 301, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 40, role: 'contributor' },
    ],
  });
}

describe('personAssignments', () => {
  it('labels a sub-phase assignment "Phase › Sub-phase" with its own dates and allocation', () => {
    const [a] = personAssignments(project(), 71, TODAY);
    expect(a.label).toBe('Development › Increment 1');
    expect(a.start).toBe('2026-09-28');
    expect(a.end).toBe('2026-09-30');
    expect(a.allocation).toBe(60);
    expect(a.finished).toBe(false);
  });

  it('flags an assignment as finished once its end date is before today', () => {
    const [a] = personAssignments(project(), 72, TODAY); // Requirements ends 2026-09-25, before TODAY
    expect(a.label).toBe('Requirements');
    expect(a.finished).toBe(true);
  });

  it('sorts current/upcoming assignments before finished ones', () => {
    const p = project();
    p.assignments.push({ id: 302, phaseId: 120, resource: { id: 72, name: 'Rami Saleh' }, allocation: 20, role: 'contributor' });
    const list = personAssignments(p, 72, TODAY);
    expect(list.map((a) => a.finished)).toEqual([false, true]);
  });

  it('returns nothing for a person with no assignments on this project', () => {
    expect(personAssignments(project(), 999, TODAY)).toEqual([]);
  });
});

describe('buildTeamBlocks', () => {
  it('includes the tech PM, business PM, assigned people and to-do assignees, each once', () => {
    const blocks = buildTeamBlocks(project(), samplePeople(), sampleToDos(), TODAY);
    const ids = blocks.map((b) => b.id);
    // 70 (tech PM), 80 (business PM, also a to-do assignee), 71 and 72 (assigned to phases).
    expect(ids.sort()).toEqual([70, 71, 72, 80]);
  });

  it('sorts PMs first — tech PM before business PM — then everyone else by name', () => {
    const blocks = buildTeamBlocks(project(), samplePeople(), sampleToDos(), TODAY);
    expect(blocks.map((b) => b.name)).toEqual(['Sara Ahmed', 'Mariam Al Suwaidi', 'Fatima Noor', 'Rami Saleh']);
    expect(blocks[0].isPm).toBe(true);
    expect(blocks[1].isBusinessPm).toBe(true);
  });

  it('does not duplicate a PM who is also assigned to a phase', () => {
    const p = project();
    p.assignments.push({ id: 303, phaseId: 11, resource: { id: 70, name: 'Sara Ahmed' }, allocation: 20, role: 'contributor' });
    const blocks = buildTeamBlocks(p, samplePeople(), sampleToDos(), TODAY);
    expect(blocks.filter((b) => b.id === 70)).toHaveLength(1);
    expect(blocks.find((b) => b.id === 70)!.assignments).toHaveLength(1);
  });

  it('attaches each person\'s own to-dos on this project, and only those', () => {
    const blocks = buildTeamBlocks(project(), samplePeople(), sampleToDos(), TODAY);
    const mariam = blocks.find((b) => b.id === 80)!;
    expect(mariam.todos.map((t) => t.title)).toEqual(['Get sign-off from the business']);
    const sara = blocks.find((b) => b.id === 70)!;
    expect(sara.todos).toEqual([]);
  });

  it('resolves each block to the matching Resources record, for role, side and outsourced status', () => {
    const blocks = buildTeamBlocks(project(), samplePeople(), sampleToDos(), TODAY);
    const fatima = blocks.find((b) => b.id === 71)!;
    expect(fatima.resource?.role?.name).toBe('Developer');
  });
});
