import type { ResourceRecord } from '../../../shared/types';
import { SIDE_LABEL, SPECIALISATION_LABEL } from './labels';

export type SortKey = 'name' | 'side' | 'role' | 'capacity' | 'contact' | 'status' | 'projects';
export type SortDir = 'asc' | 'desc';

type Key = string | number | null;

function nonEmpty(s: string | null): string | null {
  return s && s.trim() !== '' ? s : null;
}

/**
 * A null key always sorts last, in both directions; two non-null keys compare in the given direction. Callers
 * break the resulting tie by name.
 */
function compare(a: Key, b: Key, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const base = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  return dir === 'asc' ? base : -base;
}

/** Matches the Role column's text: the role name, plus the specialisation shown after it. */
function roleKey(p: ResourceRecord): string | null {
  if (!p.role) return null;
  return p.specialisation ? `${p.role.name} · ${SPECIALISATION_LABEL[p.specialisation]}` : p.role.name;
}

/** Business contacts show "—" for capacity, so they are treated as empty (last) rather than always 100. */
function capacityKey(p: ResourceRecord): number | null {
  return p.side === 'tech' ? p.capacity : null;
}

/** Matches the Projects column's text: the person's project names, in the order they are already sorted in. */
function projectsKey(p: ResourceRecord): string | null {
  return p.projects.length > 0 ? p.projects.map((pr) => pr.name).join(', ') : null;
}

function primaryCompare(a: ResourceRecord, b: ResourceRecord, key: SortKey, dir: SortDir): number {
  switch (key) {
    case 'name':
      return compare(a.name, b.name, dir);
    case 'side':
      return compare(SIDE_LABEL[a.side], SIDE_LABEL[b.side], dir);
    case 'role':
      return compare(roleKey(a), roleKey(b), dir);
    case 'capacity':
      return compare(capacityKey(a), capacityKey(b), dir);
    case 'contact': {
      // Sorts by phone, then by email — each empty value sorting last, in both directions.
      const byPhone = compare(nonEmpty(a.phone), nonEmpty(b.phone), dir);
      return byPhone !== 0 ? byPhone : compare(nonEmpty(a.email), nonEmpty(b.email), dir);
    }
    case 'status':
      return compare(a.active ? 'Active' : 'Inactive', b.active ? 'Active' : 'Inactive', dir);
    case 'projects':
      return compare(projectsKey(a), projectsKey(b), dir);
  }
}

/** Sorts people by the given column, breaking ties by name (ignoring case). */
export function sortPeople(people: ResourceRecord[], key: SortKey, dir: SortDir): ResourceRecord[] {
  return [...people].sort((a, b) => {
    const primary = primaryCompare(a, b, key, dir);
    return primary !== 0 ? primary : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** Whether this person has any link — current or finished — to the given project. */
export function workingOn(person: ResourceRecord, projectId: number): boolean {
  return person.projects.some((p) => p.id === projectId);
}
