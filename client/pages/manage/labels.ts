import type { Category, Priority, ScopeKind } from '../../../shared/types';

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const CATEGORY_LABEL: Record<Category, string> = { strategic: 'Strategic', operational: 'Operational' };

/** The four scope tables, in the order the wizard and project page show them. */
export const SCOPE_TABLES: { kind: ScopeKind; title: string; noun: string }[] = [
  { kind: 'scope', title: 'Scope', noun: 'Scope item' },
  { kind: 'out-of-scope', title: 'Out of scope', noun: 'Out-of-scope item' },
  { kind: 'problem', title: 'Problem statements', noun: 'Problem statement' },
  { kind: 'objective', title: 'Objectives', noun: 'Objective' },
];
