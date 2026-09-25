import type { ISODate } from '../../../shared/calendar';
import type { MessageKey } from '../../../shared/i18n/en';
import { translate } from '../../../shared/i18n/translate';
import type { Lang } from '../../../shared/i18n/types';
import type { AssignmentRole, Category, Priority, ScopeKind, Side, Specialisation } from '../../../shared/types';
import { formatDate as formatDay } from '../../i18n/format';

/** Catalogue keys for each priority; `PRIORITY_LABEL` is their English text. */
export const PRIORITY_KEY: Record<Priority, MessageKey> = {
  high: 'project.priorityHigh',
  medium: 'project.priorityMedium',
  low: 'project.priorityLow',
};

/** Catalogue keys for each categorisation; `CATEGORY_LABEL` is their English text. */
export const CATEGORY_KEY: Record<Category, MessageKey> = {
  strategic: 'project.categoryStrategic',
  operational: 'project.categoryOperational',
};

const english = <K extends string>(keys: Record<K, MessageKey>) =>
  Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, translate('en', key as MessageKey)])) as Record<K, string>;

export const PRIORITY_LABEL: Record<Priority, string> = english(PRIORITY_KEY);

export const CATEGORY_LABEL: Record<Category, string> = english(CATEGORY_KEY);

/** The four scope tables, in the order the wizard and project page show them, as catalogue keys. */
export const SCOPE_TABLES: { kind: ScopeKind; title: MessageKey; noun: MessageKey }[] = [
  { kind: 'scope', title: 'project.scopeTitle', noun: 'project.scopeNoun' },
  { kind: 'out-of-scope', title: 'project.outOfScopeTitle', noun: 'project.outOfScopeNoun' },
  { kind: 'problem', title: 'project.problemTitle', noun: 'project.problemNoun' },
  { kind: 'objective', title: 'project.objectiveTitle', noun: 'project.objectiveNoun' },
];

export function requesterLabel(r: { internal: boolean; external: boolean }, lang: Lang = 'en'): string {
  if (r.internal && r.external) return translate(lang, 'project.requesterBoth');
  if (r.internal) return translate(lang, 'project.requesterInternal');
  if (r.external) return translate(lang, 'project.requesterExternal');
  return '—';
}

export function beneficiaryLabel(b: { employees: boolean; customers: boolean }, lang: Lang = 'en'): string {
  if (b.employees && b.customers) return translate(lang, 'project.beneficiaryBoth');
  if (b.employees) return translate(lang, 'project.beneficiaryEmployees');
  if (b.customers) return translate(lang, 'project.beneficiaryCustomers');
  return '—';
}

/** Catalogue keys for each side; their English text is available via `translate('en', ...)`. */
export const SIDE_KEY: Record<Side, MessageKey> = { tech: 'person.sideTech', business: 'person.sideBusiness' };

/** Catalogue keys for each specialisation; their English text is available via `translate('en', ...)`. */
export const SPECIALISATION_KEY: Record<Specialisation, MessageKey> = {
  'front-end': 'person.specFrontEnd',
  'back-end': 'person.specBackEnd',
  'full-stack': 'person.specFullStack',
};

/** "Mon 12 Oct 2026". English; the language-aware form is `formatDate` in `i18n/format`. */
export function formatDate(d: ISODate): string {
  return formatDay('en', d);
}

/** Catalogue keys for each assignment role; `ASSIGNMENT_ROLE_LABEL` is their English text. */
export const ASSIGNMENT_ROLE_KEY: Record<AssignmentRole, MessageKey> = {
  responsible: 'project.roleResponsible',
  contributor: 'project.roleContributor',
};

export const ASSIGNMENT_ROLE_LABEL: Record<AssignmentRole, string> = english(ASSIGNMENT_ROLE_KEY);
