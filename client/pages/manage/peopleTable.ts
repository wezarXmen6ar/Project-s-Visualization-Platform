import { translate } from '../../../shared/i18n/translate';
import type { Lang } from '../../../shared/i18n/types';
import type { ListValue, ResourceRecord } from '../../../shared/types';
import { companyName, roleName } from '../../i18n/listNames';
import { SIDE_KEY, SPECIALISATION_KEY } from './labels';

export type SortKey = 'name' | 'side' | 'role' | 'company' | 'capacity' | 'contact' | 'status' | 'projects';
export type SortDir = 'asc' | 'desc';

/** The Outsourced table's own columns (Task 7). */
export type OutsourcedSortKey = 'name' | 'company' | 'project' | 'start' | 'end' | 'contact';

type Key = string | number | null;

function nonEmpty(s: string | null): string | null {
  return s && s.trim() !== '' ? s : null;
}

/**
 * A null key always sorts last, in both directions; two non-null keys compare in the given direction. Callers
 * break the resulting tie by name.
 */
export function compare(a: Key, b: Key, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const base = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  return dir === 'asc' ? base : -base;
}

/** The Role column's text: the role name, plus the specialisation shown after it; null when no role is set. */
export function roleText(p: ResourceRecord, roles: ListValue[] = [], lang: Lang = 'en'): string | null {
  if (!p.role) return null;
  const name = roleName(p.role, roles, lang);
  return p.specialisation ? `${name} · ${translate(lang, SPECIALISATION_KEY[p.specialisation])}` : name;
}

/** Business contacts show "—" for capacity, so they are treated as empty (last) rather than always 100. */
function capacityKey(p: ResourceRecord): number | null {
  return p.side === 'tech' ? p.capacity : null;
}

/** Matches the Projects column's text: the person's project names, in the order they are already sorted in. */
function projectsKey(p: ResourceRecord): string | null {
  return p.projects.length > 0 ? p.projects.map((pr) => pr.name).join(', ') : null;
}

function primaryCompare(
  a: ResourceRecord, b: ResourceRecord, key: SortKey, dir: SortDir, lang: Lang, roles: ListValue[], companies: ListValue[] = [],
): number {
  const side = (p: ResourceRecord) => translate(lang, SIDE_KEY[p.side]);
  const status = (p: ResourceRecord) => translate(lang, p.active ? 'person.active' : 'person.inactive');
  switch (key) {
    case 'name':
      return compare(a.name, b.name, dir);
    case 'side':
      return compare(side(a), side(b), dir);
    case 'role':
      return compare(roleText(a, roles, lang), roleText(b, roles, lang), dir);
    case 'company':
      return compare(
        a.company ? companyName(a.company, companies, lang) : null,
        b.company ? companyName(b.company, companies, lang) : null,
        dir,
      );
    case 'capacity':
      return compare(capacityKey(a), capacityKey(b), dir);
    case 'contact': {
      // Sorts by phone, then by email — each empty value sorting last, in both directions.
      const byPhone = compare(nonEmpty(a.phone), nonEmpty(b.phone), dir);
      return byPhone !== 0 ? byPhone : compare(nonEmpty(a.email), nonEmpty(b.email), dir);
    }
    case 'status':
      return compare(status(a), status(b), dir);
    case 'projects':
      return compare(projectsKey(a), projectsKey(b), dir);
  }
}

/**
 * Sorts people by the given column, as it reads in `lang` (so Arabic sorts by the Arabic side, role and status),
 * breaking ties by name (ignoring case). `roles` is the Roles list, for the roles' Arabic names.
 */
export function sortPeople(
  people: ResourceRecord[], key: SortKey, dir: SortDir, lang: Lang = 'en', roles: ListValue[] = [], companies: ListValue[] = [],
): ResourceRecord[] {
  return [...people].sort((a, b) => {
    const primary = primaryCompare(a, b, key, dir, lang, roles, companies);
    return primary !== 0 ? primary : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** Whether this person has any link — current or finished — to the given project. */
export function workingOn(person: ResourceRecord, projectId: number): boolean {
  return person.projects.some((p) => p.id === projectId);
}

/** Matches the Contact column's text: phone, then email — each empty value sorting last, in both directions. */
function contactCompare(a: ResourceRecord, b: ResourceRecord, dir: SortDir): number {
  const byPhone = compare(nonEmpty(a.phone), nonEmpty(b.phone), dir);
  return byPhone !== 0 ? byPhone : compare(nonEmpty(a.email), nonEmpty(b.email), dir);
}

function outsourcedCompare(
  a: ResourceRecord, b: ResourceRecord, key: OutsourcedSortKey, dir: SortDir, lang: Lang, companies: ListValue[],
): number {
  switch (key) {
    case 'name':
      return compare(a.name, b.name, dir);
    case 'company':
      return compare(
        a.company ? companyName(a.company, companies, lang) : null,
        b.company ? companyName(b.company, companies, lang) : null,
        dir,
      );
    case 'project':
      return compare(a.engagementProject?.name ?? null, b.engagementProject?.name ?? null, dir);
    case 'start':
      return compare(a.engagementStart, b.engagementStart, dir);
    case 'end':
      return compare(a.engagementEnd, b.engagementEnd, dir);
    case 'contact':
      return contactCompare(a, b, dir);
  }
}

/** Sorts outsourced people by one of the Outsourced table's own columns, breaking ties by name. */
export function sortOutsourced(
  people: ResourceRecord[], key: OutsourcedSortKey, dir: SortDir, lang: Lang = 'en', companies: ListValue[] = [],
): ResourceRecord[] {
  return [...people].sort((a, b) => {
    const primary = outsourcedCompare(a, b, key, dir, lang, companies);
    return primary !== 0 ? primary : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
