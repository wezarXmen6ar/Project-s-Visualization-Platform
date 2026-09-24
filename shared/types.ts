import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase'] as const;
export type ListName = (typeof LIST_NAMES)[number];

export interface ListValue {
  id: number;
  list: ListName;
  name: string;
  order: number;
}

export type Lists = Record<ListName, ListValue[]>;

/** A reference to a list value, with its name resolved for display. */
export interface Ref {
  id: number;
  name: string;
}

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = ['strategic', 'operational'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SCOPE_KINDS = ['scope', 'out-of-scope', 'problem', 'objective'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export interface ScopeItem {
  id: number;
  kind: ScopeKind;
  text: string;
  /** Position within its kind, from 0. */
  order: number;
  /** When the item was first added; kept across edits (feeds scope-growth views later). */
  dateAdded: ISODate;
}

export interface PhaseRecord {
  id: number;
  name: string;
  order: number;
  durationDays: number;
  start: ISODate;
  end: ISODate;
}

export interface ProjectRecord {
  id: number;
  name: string;
  jiraKey: string | null;
  color: string;
  startDate: ISODate;
  priority: Priority;
  projectManager: string | null;
  /** The business owner's representative, who runs the project together with the tech project manager. */
  businessPmName: string | null;
  /** Normalised UAE mobile, "+971 5X XXX XXXX". */
  businessPmPhone: string | null;
  businessPmEmail: string | null;
  mainProject: Ref | null;
  category: Category | null;
  projectType: Ref | null;
  goal: Ref | null;
  department: Ref | null;
  requester: { internal: boolean; external: boolean };
  beneficiary: { employees: boolean; customers: boolean };
  background: string;
  summary: string;
  /** Ordered by kind, then by order within the kind. */
  scopeItems: ScopeItem[];
  phases: PhaseRecord[];
}

export interface PortfolioResponse {
  year: number;
  today: ISODate;
  stats: PortfolioStats;
  projects: ProjectRecord[];
}
