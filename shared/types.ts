import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase', 'role'] as const;
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

/** 'tech': your team, counted in workload and assignable to phases. 'business': business-side contacts, not counted. */
export const SIDES = ['tech', 'business'] as const;
export type Side = (typeof SIDES)[number];

export const SPECIALISATIONS = ['front-end', 'back-end', 'full-stack'] as const;
export type Specialisation = (typeof SPECIALISATIONS)[number];

export interface LeaveRecord {
  id: number;
  start: ISODate;
  end: ISODate;
  note: string | null;
}

export interface ResourceRecord {
  id: number;
  name: string;
  side: Side;
  /** Tech side only. */
  role: Ref | null;
  /** Tech side only. */
  specialisation: Specialisation | null;
  email: string | null;
  /** Normalised UAE mobile, "+971 5X XXX XXXX". */
  phone: string | null;
  /** % of a full working week this person can give (tech side; business contacts are always 100). */
  capacity: number;
  active: boolean;
  /** Ordered by start date. */
  leave: LeaveRecord[];
}

/** A business-side contact as a project shows them. */
export interface BusinessContact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
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
  /** From the tech team (Resources, tech side). */
  projectManager: Ref | null;
  /** The business owner's representative (Resources, business side), who runs the project with the tech PM. */
  businessPm: BusinessContact | null;
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
