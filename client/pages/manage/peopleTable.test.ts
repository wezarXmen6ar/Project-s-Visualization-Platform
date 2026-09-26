// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ResourceRecord } from '../../../shared/types';
import { sortPeople, workingOn } from './peopleTable';

function person(p: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'name'>): ResourceRecord {
  return {
    side: 'tech', employment: 'staff', role: null, specialisation: null, email: null, phone: null, capacity: 100, active: true,
    leave: [], projects: [], company: null, engagementProject: null, engagementStart: null, engagementEnd: null, engagement: null,
    residence: null,
    ...p,
  };
}

describe('sortPeople', () => {
  it('groups two people who share a project and puts a person with no projects last, in both directions', () => {
    const rami = person({ id: 1, name: 'Rami Saleh', projects: [{ id: 9, name: 'Case Management', finished: false }] });
    const fatima = person({ id: 2, name: 'Fatima Noor', projects: [{ id: 9, name: 'Case Management', finished: false }] });
    const sara = person({ id: 3, name: 'Sara Ahmed', projects: [{ id: 10, name: 'HR Self-Service', finished: false }] });
    const nobody = person({ id: 4, name: 'Amir Khan', projects: [] });

    const asc = sortPeople([nobody, sara, rami, fatima], 'projects', 'asc');
    // Both are on "Case Management", so Fatima and Rami sit together (name breaks the tie between them), before
    // Sara's "HR Self-Service"; the person with no projects comes last.
    expect(asc.map((p) => p.name)).toEqual(['Fatima Noor', 'Rami Saleh', 'Sara Ahmed', 'Amir Khan']);

    const desc = sortPeople([nobody, sara, rami, fatima], 'projects', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Sara Ahmed', 'Fatima Noor', 'Rami Saleh', 'Amir Khan']);
  });

  it('sorts capacity numerically, not as text', () => {
    const oneHundred = person({ id: 1, name: 'A', capacity: 100 });
    const eighty = person({ id: 2, name: 'B', capacity: 80 });
    expect(sortPeople([oneHundred, eighty], 'capacity', 'asc').map((p) => p.capacity)).toEqual([80, 100]);
    expect(sortPeople([oneHundred, eighty], 'capacity', 'desc').map((p) => p.capacity)).toEqual([100, 80]);
  });

  it('sorts by company, with no-company people last in both directions', () => {
    const techNova = person({ id: 1, name: 'A', company: { id: 200, name: 'TechNova' } });
    const globex = person({ id: 2, name: 'B', company: { id: 201, name: 'Globex' } });
    const none = person({ id: 3, name: 'C', company: null });
    expect(sortPeople([none, techNova, globex], 'company', 'asc').map((p) => p.name)).toEqual(['B', 'A', 'C']);
    expect(sortPeople([none, techNova, globex], 'company', 'desc').map((p) => p.name)).toEqual(['A', 'B', 'C']);
  });

  it('breaks ties by name', () => {
    const zaid = person({ id: 1, name: 'Zaid', side: 'business' });
    const amir = person({ id: 2, name: 'Amir', side: 'business' });
    expect(sortPeople([zaid, amir], 'side', 'asc').map((p) => p.name)).toEqual(['Amir', 'Zaid']);
    expect(sortPeople([zaid, amir], 'side', 'desc').map((p) => p.name)).toEqual(['Amir', 'Zaid']);
  });
});

describe('workingOn', () => {
  it('is true when the project id is in the person\'s list, current or finished', () => {
    const p = person({ id: 1, name: 'X', projects: [{ id: 5, name: 'Old', finished: true }] });
    expect(workingOn(p, 5)).toBe(true);
    expect(workingOn(p, 6)).toBe(false);
  });
});
