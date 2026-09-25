import type { ISODate } from '../../../shared/calendar';
import type { AssignmentRole, Category, Priority, ScopeKind, Side, Specialisation } from '../../../shared/types';
import { formatDate as formatDay } from '../../i18n/format';

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const CATEGORY_LABEL: Record<Category, string> = { strategic: 'Strategic', operational: 'Operational' };

/** The four scope tables, in the order the wizard and project page show them. */
export const SCOPE_TABLES: { kind: ScopeKind; title: string; noun: string }[] = [
  { kind: 'scope', title: 'Scope', noun: 'Scope item' },
  { kind: 'out-of-scope', title: 'Out of scope', noun: 'Out-of-scope item' },
  { kind: 'problem', title: 'Problem statements', noun: 'Problem statement' },
  { kind: 'objective', title: 'Objectives', noun: 'Objective' },
];

export function requesterLabel(r: { internal: boolean; external: boolean }): string {
  if (r.internal && r.external) return 'Both (internal and external)';
  if (r.internal) return 'Internal';
  if (r.external) return 'External';
  return '—';
}

export function beneficiaryLabel(b: { employees: boolean; customers: boolean }): string {
  if (b.employees && b.customers) return 'Employees and customers';
  if (b.employees) return 'Employees';
  if (b.customers) return 'Customers';
  return '—';
}

export const SIDE_LABEL: Record<Side, string> = { tech: 'Tech team', business: 'Business side' };

export const SPECIALISATION_LABEL: Record<Specialisation, string> = {
  'front-end': 'Front end',
  'back-end': 'Back end',
  'full-stack': 'Full stack',
};

/** "Mon 12 Oct 2026". English; the language-aware form is `formatDate` in `i18n/format`. */
export function formatDate(d: ISODate): string {
  return formatDay('en', d);
}

export const ASSIGNMENT_ROLE_LABEL: Record<AssignmentRole, string> = { responsible: 'Responsible', contributor: 'Contributor' };
