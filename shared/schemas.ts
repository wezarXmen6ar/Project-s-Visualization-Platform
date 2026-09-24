import { z } from 'zod';
import { isISODate } from './calendar';
import { CATEGORIES, PRIORITIES, SCOPE_KINDS } from './types';

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

export const phaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Phase name is required').max(200),
  durationDays: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number of days')
    .min(1, 'Duration must be at least 1 working day')
    .max(2000, 'Duration is too long'),
});

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
  projectManager: optionalText(200),
  businessOwner: optionalText(200),
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
