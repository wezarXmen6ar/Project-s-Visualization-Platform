import { z } from 'zod';
import { dayOfWeek, isISODate } from './calendar';
import type { MessageKey } from './i18n/en';
import { isMessageKey, translate } from './i18n/translate';
import type { Params } from './i18n/types';
import { ASSIGNMENT_ROLES, CATEGORIES, ENTRY_TYPES, OVERLOAD_DECISIONS, PRIORITIES, SCOPE_KINDS, SIDES, SPECIALISATIONS } from './types';

export const isoDate = z.string().refine(isISODate, 'validation.invalidDate');

/**
 * The message for a `.max(max)` with no message of its own: `validation.tooLong` carries `{max}` (see `toIssues`,
 * which decodes the limit back out of this string), instead of every such field falling through to zod's own
 * English text (shown to the user as `validation.invalid`, "Invalid value", in both languages).
 */
const TOO_LONG_PREFIX = 'validation.tooLong:';
function tooLong(max: number): string {
  return `${TOO_LONG_PREFIX}${max}`;
}

/** Optional free text: blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
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
  .max(30, tooLong(30))
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizeUaeMobile(v);
    if (normalized === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.uaeMobile' });
      return z.NEVER;
    }
    return normalized;
  });

/** Optional email: blank becomes null. */
const optionalEmail = z
  .string()
  .trim()
  .max(200, tooLong(200))
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'validation.email');

export const assignmentInputSchema = z.object({
  resourceId: z
    .number({ required_error: 'validation.choosePerson', invalid_type_error: 'validation.choosePerson' })
    .int('validation.choosePerson')
    .positive('validation.choosePerson'),
  allocation: z
    .number({ invalid_type_error: 'validation.allocationNumber' })
    .int('validation.allocationWholeNumber')
    .min(1, 'validation.allocationRange')
    .max(100, 'validation.allocationRange'),
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.samePersonTwice', path: [i, 'resourceId'] });
      }
      seen.add(a.resourceId);
    });
  });

const workingDays = z
  .number({ invalid_type_error: 'validation.durationNumber' })
  .int('validation.durationWholeNumber')
  .min(1, 'validation.durationMin')
  .max(2000, 'validation.durationTooLong');

const phaseName = z.string().trim().min(1, 'validation.phaseNameRequired').max(200, tooLong(200));
const subPhaseName = z.string().trim().min(1, 'validation.subPhaseNameRequired').max(200, tooLong(200));
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
  subPhases: z.array(subPhaseInputSchema).max(100, 'validation.maxSubPhases').default([]),
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
  subPhases: z.array(scheduleSubPhaseSchema).max(100, 'validation.maxSubPhases').default([]),
});

export const scheduleUpdateSchema = z.object({
  startDate: isoDate,
  phases: z.array(schedulePhaseSchema).min(1, 'validation.addAtLeastOnePhase'),
  removedToDos: z.enum(['keep', 'delete']).default('keep'),
});

export type ScheduleUpdateInput = z.input<typeof scheduleUpdateSchema>;
export type ScheduleUpdate = z.output<typeof scheduleUpdateSchema>;

export const scopeItemInputSchema = z.object({
  /** Sent when editing an item that is already saved, so it keeps its date added. */
  id: z.number().int().positive().optional(),
  kind: z.enum(SCOPE_KINDS),
  text: z.string().trim().min(1, 'validation.itemTextEmpty').max(2000, tooLong(2000)),
});

/** Everything about a project except its schedule (start date and phases). Used by create and by edit. */
export const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, 'validation.projectNameRequired').max(200, tooLong(200)),
  jiraKey: optionalText(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.colorFormat'),
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
  background: z.string().trim().max(10000, tooLong(10000)).default(''),
  summary: z.string().trim().max(10000, tooLong(10000)).default(''),
  scopeItems: z.array(scopeItemInputSchema).max(1000).default([]),
});

export const newProjectSchema = projectDetailsSchema.extend({
  startDate: isoDate,
  phases: z.array(phaseInputSchema).min(1, 'validation.addAtLeastOnePhase'),
});

export const listValueInputSchema = z.object({
  name: z.string().trim().min(1, 'validation.nameRequired').max(100, 'validation.nameTooLong'),
  /** Omitted keeps whatever Arabic name is already saved; blank (after trimming) clears it. */
  nameAr: z
    .string()
    .trim()
    .max(100, 'validation.nameTooLong')
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
});

export type ProjectDetailsInput = z.input<typeof projectDetailsSchema>;
export type ProjectDetails = z.output<typeof projectDetailsSchema>;
export type NewProjectInput = z.input<typeof newProjectSchema>;
export type NewProject = z.output<typeof newProjectSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
  /** The message key, when the message is one of our own (see `toIssues`); absent for zod's own built-in text. */
  code?: MessageKey;
  params?: Params;
}

/**
 * Each issue's `message` is either one of our own message keys (set as the `.min()`/`.refine()` etc. message in
 * shared/schemas.ts) or zod's own built-in English text. Either way the English `message` stays byte-identical to
 * what this field used to hard-code: a known key is translated to English, and anything else is passed through.
 */
export function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => {
    const path = i.path.join('.');
    if (i.message.startsWith(TOO_LONG_PREFIX)) {
      const max = Number(i.message.slice(TOO_LONG_PREFIX.length));
      const params: Params = { max, count: max };
      return { path, message: translate('en', 'validation.tooLong', params), code: 'validation.tooLong', params };
    }
    if (isMessageKey(i.message)) return { path, message: translate('en', i.message), code: i.message };
    return { path, message: i.message, code: 'validation.invalid' as MessageKey };
  });
}

export const resourceInputSchema = z
  .object({
    name: z.string().trim().min(1, 'validation.nameRequired').max(200, tooLong(200)),
    side: z.enum(SIDES),
    roleId: optionalId,
    specialisation: z
      .enum(SPECIALISATIONS)
      .nullish()
      .transform((v) => v ?? null),
    email: optionalEmail,
    phone: optionalUaeMobile,
    capacity: z
      .number({ invalid_type_error: 'validation.capacityNumber' })
      .int('validation.capacityWholeNumber')
      .min(1, 'validation.capacityRange')
      .max(100, 'validation.capacityRange')
      .default(100),
    active: z.boolean().default(true),
  })
  // Business contacts have no role or specialisation, and are not counted in workload.
  .transform((r) => (r.side === 'business' ? { ...r, roleId: null, specialisation: null, capacity: 100 } : r));

export const leaveInputSchema = z
  .object({ start: isoDate, end: isoDate, note: optionalText(200) })
  .refine((l) => l.end >= l.start, { message: 'validation.endDateAfterStart', path: ['end'] });

export type ResourceInput = z.input<typeof resourceInputSchema>;
export type ResourceData = z.output<typeof resourceInputSchema>;
export type LeaveInput = z.input<typeof leaveInputSchema>;
export type LeaveData = z.output<typeof leaveInputSchema>;

export const assignmentsUpdateSchema = z.object({ assignments: phaseAssignmentsSchema });

export const overloadDecisionSchema = z.object({
  resourceId: z.number().int().positive(),
  weekStart: isoDate.refine((d) => !isISODate(d) || dayOfWeek(d) === 1, 'validation.weekMustBeMonday'),
  decision: z.enum(OVERLOAD_DECISIONS),
  note: optionalText(500),
});

export type AssignmentInput = z.input<typeof assignmentInputSchema>;
export type AssignmentData = z.output<typeof assignmentInputSchema>;
export type OverloadDecisionInput = z.input<typeof overloadDecisionSchema>;
export type OverloadDecisionData = z.output<typeof overloadDecisionSchema>;

export const toDoInputSchema = z.object({
  title: z.string().trim().min(1, 'validation.writeWhatNeedsDoing').max(200, 'validation.titleUnder200'),
  note: optionalText(2000),
  assigneeId: optionalId,
  dueDate: isoDate.nullish().transform((v) => v ?? null),
  phaseId: optionalId,
  done: z.boolean().default(false),
});
export const meInputSchema = z.object({ resourceId: z.number().int().positive().nullable() });
export type ToDoInput = z.input<typeof toDoInputSchema>;
export type ToDoData = z.output<typeof toDoInputSchema>;

export const followUpInputSchema = z.object({
  title: z.string().trim().min(1, 'validation.writeWhatNeedsDoing').max(200, 'validation.titleUnder200'),
  assigneeId: optionalId,
  dueDate: isoDate.nullish().transform((v) => v ?? null),
});

export const entryInputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  effectiveDate: isoDate,
  title: z.string().trim().min(1, 'validation.entryTitleRequired').max(200, tooLong(200)),
  body: z.string().trim().max(20000, tooLong(20000)).default(''),
  phaseId: optionalId,
  highlight: z.boolean().default(false),
  attendeeIds: z.array(z.number().int().positive()).max(100).default([]),
  /** On create only; ignored on update. */
  followUps: z.array(followUpInputSchema).max(50).default([]),
  /** Used from Task 2 on. */
  attachmentIds: z.array(z.number().int().positive()).max(50).default([]),
});

export type FollowUpInput = z.input<typeof followUpInputSchema>;
export type FollowUpData = z.output<typeof followUpInputSchema>;
export type EntryInput = z.input<typeof entryInputSchema>;
export type EntryData = z.output<typeof entryInputSchema>;

/** PUT /api/attachments/:id: metadata only. `documentDate` blank/omitted clears it. */
export const attachmentUpdateSchema = z.object({
  typeId: optionalId,
  phaseId: optionalId,
  documentDate: isoDate.nullish().transform((v) => v ?? null),
  entryId: optionalId,
});
export type AttachmentUpdateInput = z.input<typeof attachmentUpdateSchema>;
export type AttachmentUpdateData = z.output<typeof attachmentUpdateSchema>;

export const starterToDoInputSchema = z.object({
  phaseListId: z.number().int().positive(),
  title: z.string().trim().min(1, 'validation.writeWhatNeedsDoing').max(200, tooLong(200)),
});
export const starterTitleSchema = z.object({
  title: z.string().trim().min(1, 'validation.writeWhatNeedsDoing').max(200, tooLong(200)),
});
export const starterAcceptSchema = z.object({
  items: z
    .array(z.object({ phaseId: z.number().int().positive(), title: z.string().trim().min(1).max(200, tooLong(200)) }))
    .min(1)
    .max(200),
});
export type StarterToDoInput = z.input<typeof starterToDoInputSchema>;
export type StarterToDoData = z.output<typeof starterToDoInputSchema>;
export type StarterTitleInput = z.input<typeof starterTitleSchema>;
export type StarterAcceptInput = z.input<typeof starterAcceptSchema>;
export type StarterAcceptData = z.output<typeof starterAcceptSchema>;
