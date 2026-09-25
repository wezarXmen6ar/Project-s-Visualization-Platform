import { z } from 'zod';
import { dayOfWeek, isISODate } from './calendar';
import { ASSIGNMENT_ROLES, CATEGORIES, OVERLOAD_DECISIONS, PRIORITIES, SCOPE_KINDS, SIDES, SPECIALISATIONS } from './types';

export const isoDate = z.string().refine(isISODate, 'Must be a valid date (YYYY-MM-DD)');

/** Optional free text: blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Optional reference to a list value. */
const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null);

/**
 * Normalises a UAE mobile number to "+971 5X XXX XXXX". Accepts +971, 00971, 971 or 0 in front of 5X XXX XXXX, with
 * any spaces or dashes. Returns null when the input is not a UAE mobile number.
 */
export function normalizeUaeMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const match = /^(?:\+971|00971|971|0)(5\d)(\d{3})(\d{4})$/.exec(digits);
  return match ? `+971 ${match[1]} ${match[2]} ${match[3]}` : null;
}

/** Optional UAE mobile: blank becomes null, anything else must be a UAE mobile and is stored normalised. */
const optionalUaeMobile = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizeUaeMobile(v);
    if (normalized === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a UAE mobile number, e.g. +971 50 123 4567' });
      return z.NEVER;
    }
    return normalized;
  });

/** Optional email: blank becomes null. */
const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'Enter a valid email address');

export const assignmentInputSchema = z.object({
  resourceId: z
    .number({ required_error: 'Choose a person', invalid_type_error: 'Choose a person' })
    .int('Choose a person')
    .positive('Choose a person'),
  allocation: z
    .number({ invalid_type_error: 'Allocation must be a number' })
    .int('Allocation must be a whole number')
    .min(1, 'Allocation must be between 1% and 100%')
    .max(100, 'Allocation must be between 1% and 100%'),
  role: z.enum(ASSIGNMENT_ROLES).default('contributor'),
});

/** A phase's people: each person at most once. */
export const phaseAssignmentsSchema = z
  .array(assignmentInputSchema)
  .max(50)
  .superRefine((list, ctx) => {
    const seen = new Set<number>();
    list.forEach((a, i) => {
      if (seen.has(a.resourceId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The same person is assigned twice to this phase', path: [i, 'resourceId'] });
      }
      seen.add(a.resourceId);
    });
  });

const workingDays = z
  .number({ invalid_type_error: 'Duration must be a number' })
  .int('Duration must be a whole number of days')
  .min(1, 'Duration must be at least 1 working day')
  .max(2000, 'Duration is too long');

const phaseName = z.string().trim().min(1, 'Phase name is required').max(200);
const subPhaseName = z.string().trim().min(1, 'Sub-phase name is required').max(200);
const existingId = z.number().int().positive().optional();

export const subPhaseInputSchema = z.object({
  name: subPhaseName,
  durationDays: workingDays,
  withPrevious: z.boolean().default(false),
  assignments: phaseAssignmentsSchema.default([]),
});

export const phaseInputSchema = z.object({
  name: phaseName,
  durationDays: workingDays,
  assignments: phaseAssignmentsSchema.default([]),
  subPhases: z.array(subPhaseInputSchema).max(100, 'A phase can have at most 100 sub-phases').default([]),
});

export type SubPhaseInputData = z.output<typeof subPhaseInputSchema>;

export const scheduleSubPhaseSchema = z.object({
  id: existingId,
  name: subPhaseName,
  durationDays: workingDays,
  withPrevious: z.boolean().default(false),
});

export const schedulePhaseSchema = z.object({
  id: existingId,
  name: phaseName,
  durationDays: workingDays,
  subPhases: z.array(scheduleSubPhaseSchema).max(100, 'A phase can have at most 100 sub-phases').default([]),
});

export const scheduleUpdateSchema = z.object({
  startDate: isoDate,
  phases: z.array(schedulePhaseSchema).min(1, 'Add at least one phase'),
});

export type ScheduleUpdateInput = z.input<typeof scheduleUpdateSchema>;
export type ScheduleUpdate = z.output<typeof scheduleUpdateSchema>;

export const scopeItemInputSchema = z.object({
  /** Sent when editing an item that is already saved, so it keeps its date added. */
  id: z.number().int().positive().optional(),
  kind: z.enum(SCOPE_KINDS),
  text: z.string().trim().min(1, 'Item text cannot be empty').max(2000),
});

/** Everything about a project except its schedule (start date and phases). Used by create and by edit. */
export const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  jiraKey: optionalText(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #3b82f6'),
  priority: z.enum(PRIORITIES).default('medium'),
  projectManagerId: optionalId,
  businessPmId: optionalId,
  mainProjectId: optionalId,
  category: z
    .enum(CATEGORIES)
    .nullish()
    .transform((v) => v ?? null),
  projectTypeId: optionalId,
  goalId: optionalId,
  departmentId: optionalId,
  requester: z.object({ internal: z.boolean(), external: z.boolean() }).default({ internal: false, external: false }),
  beneficiary: z.object({ employees: z.boolean(), customers: z.boolean() }).default({ employees: false, customers: false }),
  background: z.string().trim().max(10000).default(''),
  summary: z.string().trim().max(10000).default(''),
  scopeItems: z.array(scopeItemInputSchema).max(1000).default([]),
});

export const newProjectSchema = projectDetailsSchema.extend({
  startDate: isoDate,
  phases: z.array(phaseInputSchema).min(1, 'Add at least one phase'),
});

export const listValueInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});

export type ProjectDetailsInput = z.input<typeof projectDetailsSchema>;
export type ProjectDetails = z.output<typeof projectDetailsSchema>;
export type NewProjectInput = z.input<typeof newProjectSchema>;
export type NewProject = z.output<typeof newProjectSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

export const resourceInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    side: z.enum(SIDES),
    roleId: optionalId,
    specialisation: z
      .enum(SPECIALISATIONS)
      .nullish()
      .transform((v) => v ?? null),
    email: optionalEmail,
    phone: optionalUaeMobile,
    capacity: z
      .number({ invalid_type_error: 'Capacity must be a number' })
      .int('Capacity must be a whole number')
      .min(1, 'Capacity must be between 1% and 100%')
      .max(100, 'Capacity must be between 1% and 100%')
      .default(100),
    active: z.boolean().default(true),
  })
  // Business contacts have no role or specialisation, and are not counted in workload.
  .transform((r) => (r.side === 'business' ? { ...r, roleId: null, specialisation: null, capacity: 100 } : r));

export const leaveInputSchema = z
  .object({ start: isoDate, end: isoDate, note: optionalText(200) })
  .refine((l) => l.end >= l.start, { message: 'End date must be on or after the start date', path: ['end'] });

export type ResourceInput = z.input<typeof resourceInputSchema>;
export type ResourceData = z.output<typeof resourceInputSchema>;
export type LeaveInput = z.input<typeof leaveInputSchema>;
export type LeaveData = z.output<typeof leaveInputSchema>;

export const assignmentsUpdateSchema = z.object({ assignments: phaseAssignmentsSchema });

export const overloadDecisionSchema = z.object({
  resourceId: z.number().int().positive(),
  weekStart: isoDate.refine((d) => !isISODate(d) || dayOfWeek(d) === 1, 'Week must start on a Monday'),
  decision: z.enum(OVERLOAD_DECISIONS),
  note: optionalText(500),
});

export type AssignmentInput = z.input<typeof assignmentInputSchema>;
export type AssignmentData = z.output<typeof assignmentInputSchema>;
export type OverloadDecisionInput = z.input<typeof overloadDecisionSchema>;
export type OverloadDecisionData = z.output<typeof overloadDecisionSchema>;
