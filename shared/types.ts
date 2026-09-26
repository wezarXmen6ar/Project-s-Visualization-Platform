import type { ISODate, WorkCalendar } from './calendar';
import type { CapacityAssignment, CapacityResource } from './capacity';
import type { PortfolioStats } from './portfolio';

/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase', 'role', 'attachmentType'] as const;
export type ListName = (typeof LIST_NAMES)[number];

export interface ListValue {
  id: number;
  list: ListName;
  name: string;
  /** The Arabic name, edited alongside `name` in Settings; null when none has been set. */
  nameAr: string | null;
  order: number;
}

export type Lists = Record<ListName, ListValue[]>;

/** A reference to a list value, with its name resolved for display. */
export interface Ref {
  id: number;
  name: string;
  /** Set only when this reference is to a list value (mainProject, projectType, goal, department); null/absent for people. */
  nameAr?: string | null;
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

/**
 * A project a person is on: assigned to one of its phases, or its tech or business PM. `finished` is true only
 * when they have no current link to it, and it is their most recently ended one.
 */
export interface PersonProject {
  id: number;
  name: string;
  finished: boolean;
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
  /** Ordered by name. Empty when they have no current or past link to any project. */
  projects: PersonProject[];
}

/** A business-side contact as a project shows them. */
export interface BusinessContact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
}

export const ASSIGNMENT_ROLES = ['responsible', 'contributor'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

/** A tech-team person working on a phase for part of their week. */
export interface AssignmentRecord {
  id: number;
  phaseId: number;
  resource: Ref;
  /** % of the person's day. */
  allocation: number;
  role: AssignmentRole;
}

export const OVERLOAD_DECISIONS = ['split', 'reassign', 'accept'] as const;
export type OverloadDecisionKind = (typeof OVERLOAD_DECISIONS)[number];

/** A recorded answer to an overbooked week. */
export interface OverloadDecision {
  id: number;
  resourceId: number;
  /** Monday of the overbooked week. */
  weekStart: ISODate;
  decision: OverloadDecisionKind;
  note: string | null;
  /** When the decision was made. */
  date: ISODate;
}

export interface WorkloadAssignment extends CapacityAssignment {
  role: AssignmentRole;
  /** The top-level phase's stored name (the phase itself, or a sub-phase's parent), so the client can translate it. */
  topPhaseName: string;
  /** A sub-phase's own name (never translated), or null for a top-level phase. */
  subPhaseName: string | null;
}

/** Everything the workload heatmap and the live warnings need; the browser runs computeWorkload on it. */
export interface WorkloadData {
  calendar: WorkCalendar;
  /** Active tech-team people only. */
  resources: CapacityResource[];
  assignments: WorkloadAssignment[];
  decisions: OverloadDecision[];
}

export interface SubPhaseRecord {
  id: number;
  name: string;
  order: number;
  durationDays: number;
  start: ISODate;
  end: ISODate;
  withPrevious: boolean;
}

export interface PhaseRecord {
  id: number;
  name: string;
  order: number;
  durationDays: number;
  start: ISODate;
  end: ISODate;
  /** Ordered by order. A sub-phase's dates sit inside its phase. */
  subPhases: SubPhaseRecord[];
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
  /** Who works on which phase; each has the phaseId it belongs to. Ordered by phase, then id. */
  assignments: AssignmentRecord[];
  phases: PhaseRecord[];
}

/** The result of PUT /api/projects/:id/schedule. `addedPhaseIds` holds the ids of new top-level phases only. */
export interface ScheduleSaved {
  project: ProjectRecord;
  addedPhaseIds: number[];
}

export interface ToDoRecord {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  note: string | null;
  assignee: Ref | null;
  dueDate: ISODate | null;
  done: boolean;
  /** The day it was ticked off. */
  doneDate: ISODate | null;
  /**
   * The phase or sub-phase it belongs to; a sub-phase's `name` reads "Phase › Sub-phase". `phaseName` is the
   * top-level phase's stored name (translatable) and `subPhaseName` a sub-phase's own name (never translated).
   */
  phase: (Ref & PhaseNameParts) | null;
  /** Set when the phase it was linked to was removed and the to-do was kept; cleared once it is linked again. */
  formerPhase: ({ name: string; removedOn: ISODate } & PhaseNameParts) | null;
  /** The meeting or update this follow-up to-do came from, when it still has that link (M7); null otherwise. */
  sourceEntry: { id: number; title: string; effectiveDate: ISODate } | null;
  createdAt: string;
}

/** A meeting or an update recorded against a project (M7). */
export const ENTRY_TYPES = ['meeting', 'update'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export interface EntryRecord {
  id: number;
  projectId: number;
  type: EntryType;
  /** The day it happened; may be in the past. */
  effectiveDate: ISODate;
  createdAt: string;
  title: string;
  body: string;
  highlight: boolean;
  /** Phase or sub-phase, with the structured names (M6). */
  phase: (Ref & PhaseNameParts) | null;
  /** Meetings only; [] for updates, ordered by name. */
  attendees: Ref[];
  /** Filled from Task 2 on; [] until then. */
  attachmentIds: number[];
  followUpToDoIds: number[];
}

/** A phase reference's name in parts: the top-level phase's stored name, and a sub-phase's own name (or null). */
export interface PhaseNameParts { phaseName: string; subPhaseName: string | null }

/** A file uploaded against a project (M7): a meeting/update attachment, or a standalone project document. */
export interface AttachmentRecord {
  id: number;
  projectId: number;
  /** Phase or sub-phase, with the structured names (M6). */
  phase: (Ref & PhaseNameParts) | null;
  /** The meeting or update it is attached to, when it is linked to one; null for a standalone project attachment. */
  entryId: number | null;
  type: Ref | null;
  /** The original file name, kept for downloads. */
  name: string;
  mime: string;
  size: number;
  documentDate: ISODate | null;
  uploadedAt: string;
  /** True for application/pdf and image/*, so the client can offer an inline preview. */
  previewable: boolean;
}

/** Who "I am" is: the PM using the tool. */
export interface Me { resourceId: number | null; name: string | null }

/** The daily database backup: the newest one taken, and how many are kept. */
export interface BackupStatus { latest: ISODate | null; count: number }

/** A starter to-do kept against a Phases-list value, so a rename in Settings keeps its checklist. */
export interface StarterToDo { id: number; phaseListId: number; title: string; order: number }

/** A starter item offered for one of a project's top-level phases. */
export interface StarterSuggestion { phaseId: number; phaseName: string; title: string }

export interface PortfolioResponse {
  year: number;
  today: ISODate;
  stats: PortfolioStats;
  projects: ProjectRecord[];
}
